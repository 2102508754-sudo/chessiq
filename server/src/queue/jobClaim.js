/**
 * ChessIQ v3.3.0 — PostgreSQL FIFO Queue Claim CTE & Lifecycle Module
 * Day 7 (@BE): Implements deterministic FIFO queue claims using:
 *
 * 1. CTE-isolated row locking (`FOR UPDATE OF j, js SKIP LOCKED`) exclusively on inner joins
 * 2. Deterministic FIFO ordering via `job_created_at jca ORDER BY jca.created_at ASC`
 * 3. Microsecond GiST collision protection on temporal status validities
 * 4. Fencing lease establishment (`claim_token`, `locked_by`, `heartbeat_at`)
 */

const crypto = require("crypto");
const logger = require("../utils/logger");

/**
 * Isolated FIFO CTE Claim Query string.
 * Uses inner-joins inside the CTE for lock isolation and joins outer metadata tables outside.
 */
const FIFO_CLAIM_CTE_QUERY = `
  WITH locked_job AS (
    SELECT j.id AS job_id, jg.game_id
    FROM game_analysis_jobs j
    INNER JOIN job_games jg ON j.id = jg.job_id
    INNER JOIN job_statuses js
      ON js.job_id = j.id
      AND js.status = 'pending'
      AND upper(js.valid_during) IS NULL
    INNER JOIN job_created_at jca ON jca.job_id = j.id
    ORDER BY jca.created_at ASC
    LIMIT 1
    FOR UPDATE OF j, js SKIP LOCKED
  )
  SELECT
    lj.job_id,
    lj.game_id,
    jac.attempt_count,
    jmr.max_retries,
    jtp.total_plies
  FROM locked_job lj
  LEFT JOIN job_attempt_counts jac ON jac.job_id = lj.job_id
  LEFT JOIN job_max_retries jmr ON jmr.job_id = lj.job_id
  LEFT JOIN job_total_plies jtp ON jtp.job_id = lj.job_id;
`;

/**
 * Atomically claims the oldest pending analysis job using a FIFO CTE.
 *
 * @param {import('pg').Pool} pool - Database connection pool
 * @param {string} workerId - Unique hostname/PID identifier of worker
 * @returns {Promise<{ jobId: string, gameId: string, claimToken: string, attemptCount: number, totalPlies: number } | null>}
 */
async function claimNextJob(pool, workerId = `worker-${process.pid}`) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Isolated Row Lock with Deterministic FIFO Ordering
    const res = await client.query(FIFO_CLAIM_CTE_QUERY);
    if (res.rows.length === 0) {
      await client.query("ROLLBACK");
      return null;
    }

    const job = res.rows[0];
    const jobId = job.job_id;
    const claimToken = crypto.randomUUID();

    // 2. Close 'pending' status interval with GiST collision protection; open 'processing'
    await client.query(
      `
      UPDATE job_statuses
      SET valid_during = tstzrange(
        lower(valid_during),
        GREATEST(CURRENT_TIMESTAMP, lower(valid_during) + INTERVAL '1 millisecond'),
        '[)'
      )
      WHERE job_id = $1 AND upper(valid_during) IS NULL;
    `,
      [jobId],
    );

    await client.query(
      `
      INSERT INTO job_statuses (job_id, status, valid_during)
      VALUES (
        $1,
        'processing',
        tstzrange(CURRENT_TIMESTAMP, NULL, '[)')
      );
    `,
      [jobId],
    );

    // 3. Increment attempt count and record fencing lease metadata
    const nextAttempt = (job.attempt_count || 0) + 1;
    await client.query(
      `
      INSERT INTO job_attempt_counts (job_id, attempt_count)
      VALUES ($1, $2)
      ON CONFLICT (job_id) DO UPDATE SET attempt_count = job_attempt_counts.attempt_count + 1;
    `,
      [jobId, nextAttempt],
    );

    await client.query(
      `
      INSERT INTO job_claim_tokens (job_id, claim_token) VALUES ($1, $2::uuid)
      ON CONFLICT (job_id) DO UPDATE SET claim_token = EXCLUDED.claim_token;
    `,
      [jobId, claimToken],
    );

    await client.query(
      `
      INSERT INTO job_locked_by (job_id, locked_by) VALUES ($1, $2)
      ON CONFLICT (job_id) DO UPDATE SET locked_by = EXCLUDED.locked_by;
    `,
      [jobId, workerId],
    );

    const now = new Date();
    await client.query(
      `
      INSERT INTO job_locked_at (job_id, locked_at) VALUES ($1, $2)
      ON CONFLICT (job_id) DO UPDATE SET locked_at = EXCLUDED.locked_at;
    `,
      [jobId, now],
    );

    await client.query(
      `
      INSERT INTO job_heartbeat_at (job_id, heartbeat_at) VALUES ($1, $2)
      ON CONFLICT (job_id) DO UPDATE SET heartbeat_at = EXCLUDED.heartbeat_at;
    `,
      [jobId, now],
    );

    await client.query(
      `
      INSERT INTO job_started_at (job_id, started_at) VALUES ($1, $2)
      ON CONFLICT (job_id) DO NOTHING;
    `,
      [jobId, now],
    );

    await client.query(
      `
      INSERT INTO job_updated_at (job_id, updated_at) VALUES ($1, $2)
      ON CONFLICT (job_id) DO UPDATE SET updated_at = EXCLUDED.updated_at;
    `,
      [jobId, now],
    );

    await client.query("COMMIT");

    logger.info(
      { jobId, gameId: job.game_id, claimToken, attemptCount: nextAttempt, workerId },
      "Successfully claimed analysis job via FIFO CTE",
    );

    return {
      jobId,
      gameId: job.game_id,
      claimToken,
      attemptCount: nextAttempt,
      totalPlies: job.total_plies || 0,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error({ err: err.message, workerId }, "Failed to claim next job from queue");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Transitions a job from 'processing' to 'completed', cleans up lease tokens,
 * and sets completed_at timestamp.
 *
 * @param {import('pg').Pool | import('pg').PoolClient} pool - Database pool or client
 * @param {string} jobId - UUID of the job
 * @param {string} claimToken - Active worker claim token for fencing verification
 */
async function completeJob(pool, jobId, claimToken) {
  const client = await (pool.connect ? pool.connect() : pool);
  const shouldRelease = Boolean(pool.connect);

  try {
    await client.query("BEGIN");

    // Close 'processing' status interval, open 'completed'
    await client.query(
      `
      UPDATE job_statuses
      SET valid_during = tstzrange(
        lower(valid_during),
        GREATEST(CURRENT_TIMESTAMP, lower(valid_during) + INTERVAL '1 millisecond'),
        '[)'
      )
      WHERE job_id = $1 AND status = 'processing' AND upper(valid_during) IS NULL;
    `,
      [jobId],
    );

    await client.query(
      `
      INSERT INTO job_statuses (job_id, status, valid_during)
      VALUES ($1, 'completed', tstzrange(CURRENT_TIMESTAMP, NULL, '[)'));
    `,
      [jobId],
    );

    const now = new Date();
    await client.query(
      `
      INSERT INTO job_completed_at (job_id, completed_at) VALUES ($1, $2)
      ON CONFLICT (job_id) DO UPDATE SET completed_at = EXCLUDED.completed_at;
    `,
      [jobId, now],
    );

    await client.query(
      `
      INSERT INTO job_updated_at (job_id, updated_at) VALUES ($1, $2)
      ON CONFLICT (job_id) DO UPDATE SET updated_at = EXCLUDED.updated_at;
    `,
      [jobId, now],
    );

    // Release fencing lease
    await client.query("DELETE FROM job_claim_tokens WHERE job_id = $1;", [jobId]);
    await client.query("DELETE FROM job_locked_by WHERE job_id = $1;", [jobId]);
    await client.query("DELETE FROM job_locked_at WHERE job_id = $1;", [jobId]);

    await client.query("COMMIT");

    logger.info({ jobId, claimToken }, "Analysis job marked completed successfully");
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error({ err: err.message, jobId }, "Failed to complete analysis job");
    throw err;
  } finally {
    if (shouldRelease) client.release();
  }
}

/**
 * Transitions a job from 'processing' to 'failed' and logs the error reason.
 *
 * @param {import('pg').Pool | import('pg').PoolClient} pool - Database pool or client
 * @param {string} jobId - UUID of the job
 * @param {string} claimToken - Active worker claim token
 * @param {string} errorMessage - Error reason for job failure
 */
async function failJob(pool, jobId, claimToken, errorMessage) {
  const client = await (pool.connect ? pool.connect() : pool);
  const shouldRelease = Boolean(pool.connect);

  try {
    await client.query("BEGIN");

    // Close 'processing' status interval, open 'failed'
    await client.query(
      `
      UPDATE job_statuses
      SET valid_during = tstzrange(
        lower(valid_during),
        GREATEST(CURRENT_TIMESTAMP, lower(valid_during) + INTERVAL '1 millisecond'),
        '[)'
      )
      WHERE job_id = $1 AND status = 'processing' AND upper(valid_during) IS NULL;
    `,
      [jobId],
    );

    await client.query(
      `
      INSERT INTO job_statuses (job_id, status, valid_during)
      VALUES ($1, 'failed', tstzrange(CURRENT_TIMESTAMP, NULL, '[)'));
    `,
      [jobId],
    );

    await client.query(
      `
      INSERT INTO job_last_errors (job_id, last_error) VALUES ($1, $2)
      ON CONFLICT (job_id) DO UPDATE SET last_error = EXCLUDED.last_error;
    `,
      [jobId, errorMessage || "Unknown error occurred during analysis."],
    );

    await client.query(
      `
      INSERT INTO job_updated_at (job_id, updated_at) VALUES ($1, CURRENT_TIMESTAMP)
      ON CONFLICT (job_id) DO UPDATE SET updated_at = EXCLUDED.updated_at;
    `,
      [jobId],
    );

    // Release fencing lease
    await client.query("DELETE FROM job_claim_tokens WHERE job_id = $1;", [jobId]);
    await client.query("DELETE FROM job_locked_by WHERE job_id = $1;", [jobId]);
    await client.query("DELETE FROM job_locked_at WHERE job_id = $1;", [jobId]);

    await client.query("COMMIT");

    logger.warn({ jobId, claimToken, errorMessage }, "Analysis job marked failed");
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error({ err: err.message, jobId }, "Failed to fail analysis job");
    throw err;
  } finally {
    if (shouldRelease) client.release();
  }
}

module.exports = {
  FIFO_CLAIM_CTE_QUERY,
  claimNextJob,
  completeJob,
  failJob,
};

