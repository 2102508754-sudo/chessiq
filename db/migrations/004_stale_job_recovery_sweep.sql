-- ============================================================================
-- ChessIQ v3.3.0 — Migration 004: Stale Job Recovery Sweep Function (@DB/@BE)
-- Day 9: Stale Job Recovery Sweep (fn_sweep_stale_jobs) & Fencing Token Management
-- Target Engine: PostgreSQL 16.x / 17.x
-- ============================================================================

-- Stale Job Recovery Sweep (PL/pgSQL Stored Function)
-- Executes periodically (e.g. every 2 minutes). Reclaims processing jobs
-- whose heartbeat_at exceeds 2 minutes. Closes valid_during intervals,
-- reschedules to 'pending' or marks 'failed', and DELETES claim tokens
-- so that partitioned/stale workers will evaluate rowCount === 0 on their next
-- heartbeat and trip their SIGKILL circuit breaker.
CREATE OR REPLACE FUNCTION fn_sweep_stale_jobs(
    p_timeout_interval INTERVAL DEFAULT INTERVAL '2 minutes'
)
RETURNS TABLE(swept_job_id UUID, new_status VARCHAR) AS $$
DECLARE
    r RECORD;
    v_closed_time TIMESTAMPTZ;
BEGIN
    FOR r IN
        SELECT
            j.id,
            COALESCE(jac.attempt_count, 0) AS attempt_count,
            COALESCE(jmr.max_retries, 3)   AS max_retries
        FROM game_analysis_jobs j
        INNER JOIN job_statuses js
            ON js.job_id = j.id
            AND js.status = 'processing'
            AND upper(js.valid_during) IS NULL
        INNER JOIN job_heartbeat_at jha
            ON jha.job_id = j.id
        LEFT JOIN job_attempt_counts jac
            ON jac.job_id = j.id
        LEFT JOIN job_max_retries jmr
            ON jmr.job_id = j.id
        WHERE jha.heartbeat_at < NOW() - p_timeout_interval
    LOOP
        -- 1. Close current 'processing' status interval without microsecond GiST collisions
        v_closed_time := GREATEST(CURRENT_TIMESTAMP, (
            SELECT lower(valid_during) + INTERVAL '1 millisecond'
            FROM job_statuses
            WHERE job_id = r.id AND upper(valid_during) IS NULL
        ));

        UPDATE job_statuses
        SET valid_during = tstzrange(lower(valid_during), v_closed_time, '[)')
        WHERE job_id = r.id AND upper(valid_during) IS NULL;

        -- 2. Transition to pending (retry) or failed (terminal)
        IF r.attempt_count < r.max_retries THEN
            INSERT INTO job_statuses (job_id, status, valid_during)
            VALUES (r.id, 'pending', tstzrange(v_closed_time, NULL, '[)'));

            INSERT INTO job_last_errors (job_id, last_error)
            VALUES (
                r.id,
                'Worker heartbeat timed out (>120s); rescheduled (attempt ' ||
                (r.attempt_count + 1)::text || '/' || r.max_retries::text || ')'
            )
            ON CONFLICT (job_id) DO UPDATE SET last_error = EXCLUDED.last_error;

            swept_job_id := r.id;
            new_status := 'pending';
        ELSE
            INSERT INTO job_statuses (job_id, status, valid_during)
            VALUES (r.id, 'failed', tstzrange(v_closed_time, NULL, '[)'));

            INSERT INTO job_last_errors (job_id, last_error)
            VALUES (
                r.id,
                'Worker heartbeat timed out; max retries exceeded (' ||
                r.max_retries::text || '/' || r.max_retries::text || ')'
            )
            ON CONFLICT (job_id) DO UPDATE SET last_error = EXCLUDED.last_error;

            swept_job_id := r.id;
            new_status := 'failed';
        END IF;

        -- 3. Invalidate fencing token and lock records
        -- This guarantees that the stale worker's next sendHeartbeat() evaluates rowCount === 0
        DELETE FROM job_claim_tokens WHERE job_id = r.id;
        DELETE FROM job_locked_by WHERE job_id = r.id;
        DELETE FROM job_locked_at WHERE job_id = r.id;

        -- Update job updated_at timestamp
        INSERT INTO job_updated_at (job_id, updated_at) VALUES (r.id, CURRENT_TIMESTAMP)
        ON CONFLICT (job_id) DO UPDATE SET updated_at = EXCLUDED.updated_at;

        RETURN NEXT;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Diagnostic telemetry verification function for Day 9
CREATE OR REPLACE FUNCTION fn_verify_day9_recovery()
RETURNS JSONB AS $$
DECLARE
    v_func_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.proname = 'fn_sweep_stale_jobs'
    ) INTO v_func_exists;

    RETURN jsonb_build_object(
        'status', CASE WHEN v_func_exists THEN 'PASSED' ELSE 'FAILED' END,
        'fn_sweep_stale_jobs_exists', v_func_exists,
        'verified_at', CURRENT_TIMESTAMP
    );
END;
$$ LANGUAGE plpgsql;

