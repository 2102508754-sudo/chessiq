/**
 * ChessIQ v3.3.0 — Stale Job Recovery Sweep & Scheduler Module
 * Day 9 (@BE): Reclaims abandoned jobs and invalidates fencing tokens.
 *
 * Implements:
 * 1. Invocation of `fn_sweep_stale_jobs(interval)` stored function
 * 2. Transition of timed-out jobs to 'pending' (retry) or 'failed' (terminal)
 * 3. Physical deletion of stale worker claim tokens from `job_claim_tokens`
 * 4. Periodic background scheduler running every 2 minutes per FR-06
 */

const logger = require("../utils/logger");

/**
 * Invokes the PL/pgSQL stored function fn_sweep_stale_jobs() to reclaim
 * abandoned jobs whose heartbeat_at exceeds the specified timeout interval.
 *
 * @param {import('pg').Pool | import('pg').PoolClient} pool - Database pool or client
 * @param {string} [timeoutInterval='2 minutes'] - PostgreSQL interval string
 * @returns {Promise<Array<{ sweptJobId: string, newStatus: string }>>}
 */
async function sweepStaleJobs(pool, timeoutInterval = "2 minutes") {
  try {
    const res = await pool.query(
      "SELECT swept_job_id, new_status FROM fn_sweep_stale_jobs($1::interval);",
      [timeoutInterval],
    );

    const swept = res.rows.map((r) => ({
      sweptJobId: r.swept_job_id,
      newStatus: r.new_status,
    }));

    if (swept.length > 0) {
      logger.warn(
        { sweptCount: swept.length, sweptJobs: swept },
        "Stale job recovery sweep completed — reclaimed abandoned jobs",
      );
    } else {
      logger.trace("Stale job recovery sweep completed — zero stale jobs found");
    }

    return swept;
  } catch (err) {
    logger.error({ err: err.message }, "Error executing stale job recovery sweep");
    throw err;
  }
}

/**
 * Background periodic scheduler that executes fn_sweep_stale_jobs() at fixed intervals.
 */
class StaleRecoveryScheduler {
  /**
   * @param {Object} options
   * @param {import('pg').Pool} options.pool - Database pool
   * @param {number} [options.intervalMs=120000] - Interval between sweeps (default 2 minutes = 120,000ms per FR-06)
   * @param {string} [options.timeoutInterval='2 minutes'] - Job stale threshold passed to PostgreSQL
   * @param {Function} [options.onSweep] - Callback invoked when stale jobs are reclaimed
   */
  constructor(options) {
    this.pool = options.pool;
    this.intervalMs = options.intervalMs || 120000;
    this.timeoutInterval = options.timeoutInterval || "2 minutes";
    this.onSweep = options.onSweep || null;

    this._timer = null;
    this._isRunning = false;
  }

  /**
   * Starts the background recovery scheduler.
   */
  start() {
    if (this._isRunning) return;
    this._isRunning = true;

    this._timer = setInterval(async () => {
      try {
        const swept = await this.triggerSweep();
        if (swept.length > 0 && this.onSweep) {
          this.onSweep(swept);
        }
      } catch (err) {
        logger.error({ err: err.message }, "Stale recovery scheduler iteration failed");
      }
    }, this.intervalMs);

    if (this._timer && typeof this._timer.unref === "function") {
      this._timer.unref();
    }

    logger.info(
      { intervalMs: this.intervalMs, timeoutInterval: this.timeoutInterval },
      "Stale job recovery scheduler started",
    );
  }

  /**
   * Triggers an immediate sweep cycle.
   * @returns {Promise<Array<{ sweptJobId: string, newStatus: string }>>}
   */
  async triggerSweep() {
    return sweepStaleJobs(this.pool, this.timeoutInterval);
  }

  /**
   * Stops the background scheduler.
   */
  stop() {
    this._isRunning = false;
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    logger.info("Stale job recovery scheduler stopped");
  }

  get isRunning() {
    return this._isRunning;
  }
}

module.exports = {
  sweepStaleJobs,
  StaleRecoveryScheduler,
};

