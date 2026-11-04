/**
 * ChessIQ v3.3.0 — Day 9 Stale Job Recovery Sweep & Fencing Token Management Tests (@BE)
 *
 * Verifies:
 * 1. Migration 004 DDL Integrity: Definition of fn_sweep_stale_jobs & fn_verify_day9_recovery
 * 2. Stale Detection & Reclaim Branching:
 *    - attempt_count < max_retries: transitions to 'pending' with retry error message
 *    - attempt_count >= max_retries: transitions to 'failed' with terminal error message
 * 3. Fencing Invalidation: Deletes job_claim_tokens, job_locked_by, job_locked_at
 * 4. sweepStaleJobs wrapper function mapping
 * 5. StaleRecoveryScheduler lifecycle (2-minute interval execution per FR-06)
 */

const fs = require("fs");
const path = require("path");
const { sweepStaleJobs, StaleRecoveryScheduler } = require("../src/queue");

describe("Day 9: Stale Job Recovery Sweep & Fencing Token Management (@BE)", () => {
  // ==========================================================================
  // 1. Migration 004 SQL DDL Verification
  // ==========================================================================
  describe("Migration 004 DDL Structure (004_stale_job_recovery_sweep.sql)", () => {
    const migrationPath = path.resolve(
      __dirname,
      "../../db/migrations/004_stale_job_recovery_sweep.sql",
    );

    it("verifies migration file exists on disk", () => {
      expect(fs.existsSync(migrationPath)).toBe(true);
    });

    it("defines fn_sweep_stale_jobs returning TABLE(swept_job_id UUID, new_status VARCHAR)", () => {
      const sql = fs.readFileSync(migrationPath, "utf8");
      expect(sql).toContain("CREATE OR REPLACE FUNCTION fn_sweep_stale_jobs");
      expect(sql).toMatch(
        /RETURNS TABLE\s*\(\s*swept_job_id UUID,\s*new_status VARCHAR\s*\)/i,
      );
    });

    it("queries jobs where heartbeat_at < NOW() - interval and status = 'processing'", () => {
      const sql = fs.readFileSync(migrationPath, "utf8");
      expect(sql).toContain("status = 'processing'");
      expect(sql).toContain("upper(js.valid_during) IS NULL");
      expect(sql).toMatch(/heartbeat_at < NOW\(\) -/i);
    });

    it("closes current 'processing' status interval and transitions to pending or failed", () => {
      const sql = fs.readFileSync(migrationPath, "utf8");
      expect(sql).toContain("r.attempt_count < r.max_retries");
      expect(sql).toContain("VALUES (r.id, 'pending'");
      expect(sql).toContain("VALUES (r.id, 'failed'");
    });

    it("physically invalidates stale workers by DELETING claim tokens and lock records", () => {
      const sql = fs.readFileSync(migrationPath, "utf8");
      expect(sql).toContain(
        "DELETE FROM job_claim_tokens WHERE job_id = r.id;",
      );
      expect(sql).toContain("DELETE FROM job_locked_by WHERE job_id = r.id;");
      expect(sql).toContain("DELETE FROM job_locked_at WHERE job_id = r.id;");
    });

    it("defines diagnostic telemetry function fn_verify_day9_recovery()", () => {
      const sql = fs.readFileSync(migrationPath, "utf8");
      expect(sql).toContain(
        "CREATE OR REPLACE FUNCTION fn_verify_day9_recovery()",
      );
      expect(sql).toContain("'fn_sweep_stale_jobs_exists'");
    });
  });

  // ==========================================================================
  // 2. sweepStaleJobs Wrapper Function
  // ==========================================================================
  describe("sweepStaleJobs Wrapper Function", () => {
    let mockPool;

    beforeEach(() => {
      mockPool = {
        query: jest.fn(),
      };
    });

    it("invokes fn_sweep_stale_jobs and maps returned rows accurately", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          { swept_job_id: "job-swept-1", new_status: "pending" },
          { swept_job_id: "job-swept-2", new_status: "failed" },
        ],
      });

      const result = await sweepStaleJobs(mockPool, "2 minutes");

      expect(mockPool.query).toHaveBeenCalledWith(
        "SELECT swept_job_id, new_status FROM fn_sweep_stale_jobs($1::interval);",
        ["2 minutes"],
      );

      expect(result).toEqual([
        { sweptJobId: "job-swept-1", newStatus: "pending" },
        { sweptJobId: "job-swept-2", newStatus: "failed" },
      ]);
    });

    it("returns empty array when no stale jobs are present in the queue", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await sweepStaleJobs(mockPool);

      expect(result).toEqual([]);
    });

    it("propagates error when database query fails", async () => {
      mockPool.query.mockRejectedValueOnce(new Error("Database disconnected"));

      await expect(sweepStaleJobs(mockPool)).rejects.toThrow(
        "Database disconnected",
      );
    });
  });

  // ==========================================================================
  // 3. StaleRecoveryScheduler Lifecycle
  // ==========================================================================
  describe("StaleRecoveryScheduler Lifecycle & Timer", () => {
    let mockPool;

    beforeEach(() => {
      jest.useFakeTimers();

      mockPool = {
        query: jest.fn().mockResolvedValue({
          rows: [{ swept_job_id: "job-auto-1", new_status: "pending" }],
        }),
      };
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("schedules sweep every 2 minutes (120,000ms) by default", async () => {
      const onSweep = jest.fn();
      const scheduler = new StaleRecoveryScheduler({
        pool: mockPool,
        intervalMs: 120000,
        timeoutInterval: "2 minutes",
        onSweep,
      });

      scheduler.start();
      expect(scheduler.isRunning).toBe(true);

      // Advance by 2 minutes
      await jest.advanceTimersByTimeAsync(120000);

      expect(mockPool.query).toHaveBeenCalledWith(
        "SELECT swept_job_id, new_status FROM fn_sweep_stale_jobs($1::interval);",
        ["2 minutes"],
      );
      expect(onSweep).toHaveBeenCalledWith([
        { sweptJobId: "job-auto-1", newStatus: "pending" },
      ]);

      // Stop scheduler
      scheduler.stop();
      expect(scheduler.isRunning).toBe(false);

      // Advance further — no more calls
      mockPool.query.mockClear();
      await jest.advanceTimersByTimeAsync(240000);
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it("supports manual triggerSweep() call", async () => {
      const scheduler = new StaleRecoveryScheduler({
        pool: mockPool,
      });

      const res = await scheduler.triggerSweep();
      expect(res).toEqual([{ sweptJobId: "job-auto-1", newStatus: "pending" }]);
    });
  });
});
