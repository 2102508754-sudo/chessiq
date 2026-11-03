/**
 * ChessIQ v3.3.0 — Queue, Heartbeat & Stale Recovery Architecture Exports
 * Days 7, 8, 9 (@BE)
 */

const {
  FIFO_CLAIM_CTE_QUERY,
  claimNextJob,
  completeJob,
  failJob,
} = require("./jobClaim");

const {
  HEARTBEAT_QUERY,
  UPDATE_CURRENT_PLY_QUERY,
  sendHeartbeat,
  terminateStockfishWithSigkill,
  HeartbeatWatchdog,
} = require("./heartbeat");

const {
  sweepStaleJobs,
  StaleRecoveryScheduler,
} = require("./staleRecovery");

const {
  calculateBackoffSleep,
  processJob,
  runWorkerLoop,
} = require("./workerLoop");

module.exports = {
  // Day 7: FIFO Claim CTE & Worker Loop
  FIFO_CLAIM_CTE_QUERY,
  claimNextJob,
  completeJob,
  failJob,
  calculateBackoffSleep,
  processJob,
  runWorkerLoop,

  // Day 8: Heartbeat Watchdog & SIGKILL Breaker
  HEARTBEAT_QUERY,
  UPDATE_CURRENT_PLY_QUERY,
  sendHeartbeat,
  terminateStockfishWithSigkill,
  HeartbeatWatchdog,

  // Day 9: Stale Job Recovery & Scheduler
  sweepStaleJobs,
  StaleRecoveryScheduler,
};

