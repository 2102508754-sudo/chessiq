/**
 * ChessIQ v3.3.0 — Reactive Worker Event Loop & Job Processor
 * Day 7 (@BE): Combines reactive PostgreSQL LISTEN/NOTIFY with
 * truncated exponential backoff and full jitter (Uniform(0.5, 1.5)).
 *
 * Days 8 & 9 Integration:
 * - Mounts HeartbeatWatchdog during analysis
 * - Evaluates driver rowCount and trips circuit breaker upon STALE_LEASE_EVICTION
 * - Safe resource cleanup with StockfishPool release
 */

const crypto = require("crypto");
const { Chess } = require("chess.js");
const { claimNextJob, completeJob, failJob } = require("./jobClaim");
const { HeartbeatWatchdog } = require("./heartbeat");
const { createListenClient } = require("../db/pool");
const { ingestGameAnalysis6NF } = require("../db/ingestion");
const { parsePgn } = require("../services/pgnParser");
const {
  invertEvaluation,
  classifyMove,
  winProbability,
  mateToCentipawns,
} = require("../engine/evalMath");
const logger = require("../utils/logger");

/**
 * Calculates exponential backoff sleep with full jitter (Uniform(0.5, 1.5))
 * @param {number} consecutiveEmpty - Count of sequential empty claims
 * @param {number} [baseMs=200] - Base delay in ms
 * @param {number} [maxMs=5000] - Max delay cap in ms
 * @param {() => number} [randomFn=Math.random] - RNG function
 * @returns {number} Sleep time in milliseconds
 */
function calculateBackoffSleep(
  consecutiveEmpty,
  baseMs = 200,
  maxMs = 5000,
  randomFn = Math.random,
) {
  const cappedMs = Math.min(maxMs, baseMs * Math.pow(2, consecutiveEmpty));
  const jitterMultiplier = 0.5 + randomFn(); // Uniform(0.5, 1.5)
  return Math.floor(cappedMs * jitterMultiplier);
}

/**
 * Processes a single claimed game analysis job end-to-end:
 * 1. Fetches game PGN and user_color from database
 * 2. Acquires an isolated Stockfish worker from the pool
 * 3. Mounts 3.0s HeartbeatWatchdog
 * 4. Iterates through game plies with depth evaluation & math inversion
 * 5. Calls sp_ingest_game_analysis_6nf atomic batch ingestion
 * 6. Closes job status to 'completed'
 *
 * @param {import('pg').Pool} pool - Database pool
 * @param {Object} job - Claimed job metadata from claimNextJob
 * @param {import('../engine/stockfishPool')} stockfishPool - Engine pool
 * @param {Object} [options]
 * @returns {Promise<Object>}
 */
async function processJob(pool, job, stockfishPool, options = {}) {
  const { jobId, gameId, claimToken } = job;
  const depth = options.depth || 14;

  let worker = null;
  let watchdog = null;

  try {
    // 1. Fetch Game Metadata & PGN
    const gameRes = await pool.query(
      `
      SELECT
        g.id,
        gpr.pgn_raw,
        guc.user_color
      FROM games g
      JOIN game_pgn_raws gpr ON g.id = gpr.game_id
      JOIN game_user_colors guc ON g.id = guc.game_id
      WHERE g.id = $1
      LIMIT 1;
    `,
      [gameId],
    );

    if (gameRes.rows.length === 0) {
      throw new Error(`Game ${gameId} not found for job ${jobId}`);
    }

    const game = gameRes.rows[0];
    const parsed = parsePgn(game.pgn_raw);
    const moves = parsed.moves;

    // 2. Acquire Stockfish Worker from Pool
    worker = await stockfishPool.acquire();

    // 3. Mount 3.0s Heartbeat Watchdog (§10.3)
    watchdog = new HeartbeatWatchdog({
      pool,
      jobId,
      claimToken,
      intervalMs: options.heartbeatIntervalMs || 3000,
      stockfishProcess: worker,
    });
    watchdog.start();

    // 4. Analyze Plies Iteratively
    const chess = new Chess();
    const moveAnalyses = [];

    let whiteBlunders = 0;
    let whiteMistakes = 0;
    let whiteInaccuracies = 0;
    let blackBlunders = 0;
    let blackMistakes = 0;
    let blackInaccuracies = 0;

    let whiteTotalCpl = 0;
    let whiteCount = 0;
    let blackTotalCpl = 0;
    let blackCount = 0;

    for (let i = 0; i < moves.length; i++) {
      const plyNumber = i + 1;
      const moveData = moves[i];
      const fenBefore = chess.fen();

      // Update watchdog progress
      watchdog.updatePly(plyNumber);

      // Evaluate position before move to get best engine move and root eval
      let bestEval;
      try {
        bestEval = await worker.evaluatePosition(fenBefore, depth);
      } catch (evalErr) {
        if (watchdog.isTripped) throw new Error("STALE_LEASE_EVICTION");
        throw evalErr;
      }

      // Execute played move on board state
      chess.move(moveData.san);
      const fenAfter = chess.fen();

      // Evaluate post-move position
      let playedEval;
      try {
        playedEval = await worker.evaluatePosition(fenAfter, depth);
      } catch (evalErr) {
        if (watchdog.isTripped) throw new Error("STALE_LEASE_EVICTION");
        throw evalErr;
      }

      // Check opening book match in catalog if requested
      let isBookMove = false;
      try {
        const bookCheck = await pool.query(
          `SELECT 1 FROM chess_openings co
           JOIN chess_opening_pgn_moves cop ON co.eco_code = cop.eco_code
           WHERE cop.pgn_moves LIKE $1
           LIMIT 1;`,
          [`%${moveData.san}%`],
        );
        isBookMove = bookCheck.rows.length > 0;
      } catch (_) {
        isBookMove = false;
      }

      // Apply Polarity Inversion & Loss Math
      const bestMoveMover = bestEval.score;
      const playedMover = invertEvaluation(playedEval.score);

      const bestCp =
        bestMoveMover.type === "mate"
          ? mateToCentipawns(bestMoveMover.value)
          : bestMoveMover.value;

      const classification = classifyMove(bestCp, playedMover.centipawns);
      const winProb = winProbability(playedMover.centipawns);
      const isWhite = plyNumber % 2 === 1;

      // Track aggregate counts (exclude catalog book moves from ACPL per FR-07)
      if (!isBookMove) {
        if (isWhite) {
          whiteTotalCpl += classification.cplCapped;
          whiteCount++;
        } else {
          blackTotalCpl += classification.cplCapped;
          blackCount++;
        }
      }

      if (classification.mistakeType === "BLUNDER") {
        if (isWhite) whiteBlunders++;
        else blackBlunders++;
      } else if (classification.mistakeType === "MISTAKE") {
        if (isWhite) whiteMistakes++;
        else blackMistakes++;
      } else if (classification.mistakeType === "INACCURACY") {
        if (isWhite) whiteInaccuracies++;
        else blackInaccuracies++;
      }

      moveAnalyses.push({
        plyNumber,
        moveSan: moveData.san,
        moveUci: moveData.uci || "",
        fenBefore,
        fenAfter,
        rawEvalType: playedEval.score.type,
        rawEvalValue: playedEval.score.value,
        evalCentipawns: playedMover.centipawns,
        evalMate:
          playedEval.score.type === "mate" ? playedEval.score.value : null,
        cplRaw: classification.cplRaw,
        cplCapped: classification.cplCapped,
        winProbability: winProb,
        winProbDelta: classification.winProbDelta,
        bestMoveUci: bestEval.bestMove || null,
        mistakeType: classification.mistakeType,
        gamePhase:
          plyNumber <= 20
            ? "OPENING"
            : plyNumber <= 60
              ? "MIDDLEGAME"
              : "ENDGAME",
        pvLine: playedEval.pv || [],
        isBookMove,
      });
    }

    // Stop watchdog before database persistence
    watchdog.stop();

    // 5. Ingest Batch into 6NF Tables via sp_ingest_game_analysis_6nf
    const analysisId = crypto.randomUUID();
    const whiteAcpl =
      whiteCount > 0 ? Math.round(whiteTotalCpl / whiteCount) : 0;
    const blackAcpl =
      blackCount > 0 ? Math.round(blackTotalCpl / blackCount) : 0;

    await ingestGameAnalysis6NF(pool, {
      analysisId,
      gameId,
      whiteAcpl,
      blackAcpl,
      whiteBlunders,
      whiteMistakes,
      whiteInaccuracies,
      blackBlunders,
      blackMistakes,
      blackInaccuracies,
      engineDepth: depth,
      moves: moveAnalyses,
    });

    // 6. Complete Analysis Job
    await completeJob(pool, jobId, claimToken);

    return {
      jobId,
      gameId,
      analysisId,
      pliesAnalyzed: moveAnalyses.length,
      whiteAcpl,
      blackAcpl,
    };
  } catch (err) {
    if (watchdog) watchdog.stop();

    if (err.message === "STALE_LEASE_EVICTION") {
      logger.warn(
        { jobId, claimToken },
        "Job aborted due to STALE_LEASE_EVICTION — leaving state untouched for recovery worker",
      );
    } else {
      logger.error({ jobId, err: err.message }, "Error during job processing");
      try {
        await failJob(pool, jobId, claimToken, err.message);
      } catch (failErr) {
        logger.error(
          { jobId, failErr: failErr.message },
          "Failed to record job failure in DB",
        );
      }
    }

    throw err;
  } finally {
    if (worker && stockfishPool) {
      try {
        await stockfishPool.release(worker);
      } catch (relErr) {
        logger.warn(
          { err: relErr.message },
          "Error releasing worker back to pool",
        );
      }
    }
  }
}

/**
 * Runs the reactive worker event loop.
 *
 * @param {import('pg').Pool} pool - Database pool
 * @param {string} workerId - Unique worker identifier
 * @param {import('../engine/stockfishPool')} stockfishPool - Engine pool
 * @param {Object} [options]
 * @returns {Promise<{ stop: () => Promise<void> }>}
 */
async function runWorkerLoop(pool, workerId, stockfishPool, options = {}) {
  let isStopped = false;
  let consecutiveEmpty = 0;
  const baseMs = options.baseMs || 200;
  const maxMs = options.maxMs || 5000;

  let listenHandle = null;
  try {
    listenHandle = await createListenClient("new_analysis_job", () => {
      // Immediate wakeup on new job notification (§10.2)
      consecutiveEmpty = 0;
    });
  } catch (listenErr) {
    logger.warn(
      { err: listenErr.message },
      "Could not attach dedicated LISTEN client; falling back to polling",
    );
  }

  const loopPromise = (async () => {
    while (!isStopped) {
      try {
        const job = await claimNextJob(pool, workerId);
        if (job) {
          consecutiveEmpty = 0;
          await processJob(pool, job, stockfishPool, options);
        } else {
          consecutiveEmpty++;
          const sleepMs = calculateBackoffSleep(
            consecutiveEmpty,
            baseMs,
            maxMs,
          );
          await new Promise((resolve) => setTimeout(resolve, sleepMs));
        }
      } catch (err) {
        if (err.message !== "STALE_LEASE_EVICTION") {
          logger.error(
            { err: err.message, workerId },
            "Unhandled error in worker loop iteration",
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  })();

  return {
    async stop() {
      isStopped = true;
      if (listenHandle && typeof listenHandle.close === "function") {
        await listenHandle.close();
      }
      await loopPromise;
    },
  };
}

module.exports = {
  calculateBackoffSleep,
  processJob,
  runWorkerLoop,
};
