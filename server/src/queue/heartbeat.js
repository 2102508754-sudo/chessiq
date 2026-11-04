/**
 * ChessIQ v3.3.0 — Heartbeat Watchdog & SIGKILL Circuit Breaker
 * Day 8 (@BE): Implements the critical lease watchdog and driver-accurate circuit breaker.
 *
 * Driver Invariant:
 * The `pg` driver stores affected row counts on `result.rowCount`. It does NOT define `rowsAffected`.
 * If `result.rowCount === 0`, the worker's fencing lease has expired or been revoked by the
 * stale job sweep.
 *
 * Uncatchable SIGKILL Execution:
 * Upon circuit breaker trip, the worker MUST immediately issue an uncatchable SIGKILL to the
 * Stockfish child process to guarantee fencing, abort analysis, and throw 'STALE_LEASE_EVICTION'.
 */

const logger = require("../utils/logger");

const HEARTBEAT_QUERY = `
  UPDATE job_heartbeat_at
  SET heartbeat_at = CURRENT_TIMESTAMP
  WHERE job_id = $1
    AND EXISTS (
      SELECT 1
      FROM job_claim_tokens
      WHERE job_id = $1 AND claim_token = $2
    )
    AND EXISTS (
      SELECT 1
      FROM job_statuses
      WHERE job_id = $1
        AND status = 'processing'
        AND upper(valid_during) IS NULL
    );
`;

const UPDATE_CURRENT_PLY_QUERY = `
  INSERT INTO job_current_plies (job_id, current_ply) VALUES ($1, $2)
  ON CONFLICT (job_id) DO UPDATE SET current_ply = EXCLUDED.current_ply;
`;

/**
 * Executes a single heartbeat ping targeting job_heartbeat_at.
 * Evaluates lease validity strictly via result.rowCount.
 * If rowCount === 0: trips circuit breaker with instant SIGKILL.
 *
 * @param {import('pg').Pool | import('pg').PoolClient} pool - Database pool or client
 * @param {string} jobId - UUID of the active analysis job
 * @param {string} claimToken - UUID fencing claim token
 * @param {number} [currentPly=0] - Current ply progress
 * @param {import('../engine/stockfishWorker') | import('child_process').ChildProcess | Object} [stockfishProcess] - Stockfish process/worker to terminate if tripped
 * @returns {Promise<{ ok: boolean, rowCount: number }>}
 * @throws {Error} STALE_LEASE_EVICTION if rowCount === 0
 */
async function sendHeartbeat(
  pool,
  jobId,
  claimToken,
  currentPly = 0,
  stockfishProcess = null,
) {
  const result = await pool.query(HEARTBEAT_QUERY, [jobId, claimToken]);

  // CIRCUIT BREAKER TRIP: result.rowCount === 0
  if (result.rowCount === 0) {
    logger.error(
      { jobId, claimToken, rowCount: result.rowCount },
      "CRITICAL: Fencing token invalid or lease expired. Tripping circuit breaker immediately.",
    );

    // 1. Uncatchable SIGKILL on Stockfish process
    terminateStockfishWithSigkill(stockfishProcess);

    // 2. Abort worker execution loop immediately
    throw new Error("STALE_LEASE_EVICTION");
  }

  // Update progress ply (separate non-blocking statement)
  if (typeof currentPly === "number" && currentPly >= 0) {
    try {
      await pool.query(UPDATE_CURRENT_PLY_QUERY, [jobId, currentPly]);
    } catch (plyErr) {
      logger.warn(
        { jobId, plyErr: plyErr.message },
        "Failed to update job_current_plies",
      );
    }
  }

  return { ok: true, rowCount: result.rowCount };
}

/**
 * Helper to execute uncatchable SIGKILL on a Stockfish worker or process object.
 * @param {any} target - StockfishWorker instance, ChildProcess, or mock
 */
function terminateStockfishWithSigkill(target) {
  if (!target) return;

  try {
    // If target is StockfishWorker with a kill method
    if (typeof target.kill === "function") {
      target.kill("SIGKILL");
    } else if (target.process && typeof target.process.kill === "function") {
      target.process.kill("SIGKILL");
    }
  } catch (killErr) {
    logger.error(
      { err: killErr.message },
      "Failed to issue SIGKILL on Stockfish process",
    );
  }
}

/**
 * Watchdog class that issues heartbeats at fixed intervals during analysis.
 */
class HeartbeatWatchdog {
  /**
   * @param {Object} options
   * @param {import('pg').Pool} options.pool - Database pool
   * @param {string} options.jobId - UUID of the active analysis job
   * @param {string} options.claimToken - UUID fencing claim token
   * @param {number} [options.intervalMs=3000] - Heartbeat frequency (default 3.0s per FR-05)
   * @param {any} [options.stockfishProcess] - Stockfish worker or process instance
   * @param {Function} [options.onTrip] - Callback invoked when circuit breaker trips
   */
  constructor(options) {
    this.pool = options.pool;
    this.jobId = options.jobId;
    this.claimToken = options.claimToken;
    this.intervalMs = options.intervalMs || 3000;
    this.stockfishProcess = options.stockfishProcess || null;
    this.onTrip = options.onTrip || null;

    this.currentPly = 0;
    this._timer = null;
    this._isRunning = false;
    this._isTripped = false;
  }

  /**
   * Starts the background heartbeat timer.
   */
  start() {
    if (this._isRunning) return;
    this._isRunning = true;
    this._isTripped = false;

    this._timer = setInterval(async () => {
      try {
        await this.ping();
      } catch (err) {
        if (err.message === "STALE_LEASE_EVICTION") {
          this._isTripped = true;
          this.stop();
          if (this.onTrip) {
            this.onTrip(err);
          }
        }
      }
    }, this.intervalMs);

    // Don't keep the event loop alive solely for heartbeats
    if (this._timer && typeof this._timer.unref === "function") {
      this._timer.unref();
    }
  }

  /**
   * Sends an immediate heartbeat ping and updates progress.
   * @returns {Promise<{ ok: boolean, rowCount: number }>}
   */
  async ping() {
    return sendHeartbeat(
      this.pool,
      this.jobId,
      this.claimToken,
      this.currentPly,
      this.stockfishProcess,
    );
  }

  /**
   * Updates the current ply number sent on subsequent heartbeats.
   * @param {number} plyNumber
   */
  updatePly(plyNumber) {
    this.currentPly = plyNumber;
  }

  /**
   * Stops the background heartbeat timer.
   */
  stop() {
    this._isRunning = false;
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  get isRunning() {
    return this._isRunning;
  }

  get isTripped() {
    return this._isTripped;
  }
}

module.exports = {
  HEARTBEAT_QUERY,
  UPDATE_CURRENT_PLY_QUERY,
  sendHeartbeat,
  terminateStockfishWithSigkill,
  HeartbeatWatchdog,
};
