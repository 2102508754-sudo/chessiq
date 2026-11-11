/**
 * ChessIQ v3.3.0 — Formalized Engine Evaluation Mathematics Module
 * Day 6 (@BE): Implements the complete evaluation math pipeline from the
 * v3.3.0 specification (§11.2, §11.3, §11.4):
 *
 * 1. Polarity Inversion:  Eval_played_mover = -1 × Eval(fen_after)
 * 2. Continuous Mate Mapping:  Eval(mate M) = ±10000 ∓ (M × 100)
 * 3. Logistic Win Probability: W(cp) = 1 / (1 + 10^(-cp/400))
 * 4. Centipawn Loss:  CPL_raw = max(0, Eval_best - Eval_played)
 * 5. Mistake Classification Tiers (BEST → BLUNDER / MISSED_WIN)
 */

const logger = require("../utils/logger");

// ============================================================================
// §11.3 — Continuous Mate Mapping
// ============================================================================

/**
 * Converts a Stockfish mate-in-M evaluation to a continuous centipawn value.
 * Prevents NaN / division-by-zero during forced mate transitions.
 *
 * Formula:
 *   If M > 0 (mover delivers mate):  +10000 - (M × 100)
 *   If M < 0 (opponent delivers mate): -10000 - (M × 100)
 *     = -10000 + (|M| × 100) when expanded
 *
 * Examples:
 *   mate +2 → +10000 - 200 = +9800
 *   mate +1 → +10000 - 100 = +9900
 *   mate -1 → -10000 + 100 = -9900
 *   mate -3 → -10000 + 300 = -9700
 *
 * @param {number} mateDistance - Mate distance from Stockfish (positive = mover mates)
 * @returns {number} Continuous centipawn equivalent
 */
function mateToCentipawns(mateDistance) {
  if (mateDistance === 0) {
    // Stalemate — should not typically occur, treat as drawn
    return 0;
  }

  if (mateDistance > 0) {
    // Mover delivers checkmate
    return 10000 - mateDistance * 100;
  } else {
    // Opponent delivers checkmate (M is negative)
    return -10000 - mateDistance * 100;
  }
}

// ============================================================================
// §11.2 — Polarity Inversion
// ============================================================================

/**
 * Inverts the evaluation from Stockfish's perspective (side to move in fen_after)
 * to the active mover's perspective.
 *
 * When evaluating fen_after:
 *   - Stockfish reports relative to whoever is "to move" in fen_after
 *   - That person is the OPPONENT (since the mover just played)
 *   - So we negate: Eval_played_mover = -1 × Eval(fen_after)
 *
 * @param {Object} rawEval - Raw engine evaluation
 * @param {string} rawEval.type - 'cp' for centipawns, 'mate' for forced mate
 * @param {number} rawEval.value - Raw numeric value from Stockfish
 * @returns {{ centipawns: number, type: string, rawValue: number }}
 */
function invertEvaluation(rawEval) {
  let centipawns;

  if (rawEval.type === "mate") {
    // Convert mate to continuous centipawn scale, then invert
    centipawns = -1 * mateToCentipawns(rawEval.value);
  } else {
    // Centipawn evaluation — invert directly
    centipawns = -1 * rawEval.value;
  }

  return {
    centipawns,
    type: rawEval.type,
    rawValue: rawEval.value,
  };
}

// ============================================================================
// §11.4 — Logistic Win Probability
// ============================================================================

/**
 * Computes the logistic win probability from a centipawn evaluation.
 * Uses the standard chess sigmoid: W(cp) = 1 / (1 + 10^(-cp / 400))
 *
 * @param {number} centipawns - Evaluation in centipawns (from mover's perspective)
 * @returns {number} Win probability between 0.0 and 1.0 (4 decimal precision)
 */
function winProbability(centipawns) {
  // Clamp extreme values to avoid floating-point overflow
  const clamped = Math.max(-10000, Math.min(10000, centipawns));
  const wp = 1.0 / (1.0 + Math.pow(10, -clamped / 400));
  return Math.round(wp * 10000) / 10000; // 4 decimal precision
}

// ============================================================================
// §11.2 — Centipawn Loss Computation
// ============================================================================

/**
 * Computes raw and capped centipawn loss between the best move and the played move.
 *
 * CPL_raw = max(0, Eval_best_mover - Eval_played_mover)
 * CPL_capped = min(1000, CPL_raw)
 *
 * @param {number} evalBest - Best move evaluation in centipawns (from mover's perspective)
 * @param {number} evalPlayed - Played move evaluation in centipawns (from mover's perspective)
 * @returns {{ cplRaw: number, cplCapped: number }}
 */
function computeCentipawnLoss(evalBest, evalPlayed) {
  const cplRaw = Math.max(0, evalBest - evalPlayed);
  const cplCapped = Math.min(1000, cplRaw);
  return { cplRaw, cplCapped };
}

// ============================================================================
// §11.4 — Mistake Classification Tiers
// ============================================================================

/**
 * Classifies a move into a tactical quality tier based on win probability loss
 * and centipawn loss thresholds defined in the v3.3.0 specification.
 *
 * | Tier        | ΔW Condition        | CPL Condition    |
 * |-------------|---------------------|------------------|
 * | BEST        | ΔW < 0.02           | CPL ≤ 10         |
 * | GOOD        | 0.02 ≤ ΔW < 0.05   | 10 < CPL ≤ 30    |
 * | INACCURACY  | 0.05 ≤ ΔW < 0.12   | 30 < CPL ≤ 90    |
 * | MISTAKE     | 0.12 ≤ ΔW < 0.25   | 90 < CPL ≤ 200   |
 * | BLUNDER     | ΔW ≥ 0.25           | CPL > 200         |
 * | MISSED_WIN  | W_before > 0.80 drops to W_after < 0.55 |
 *
 * @param {number} evalBestCp - Best move eval in centipawns
 * @param {number} evalPlayedCp - Played move eval in centipawns
 * @param {number} [prevEvalCp] - Previous position eval (for MISSED_WIN detection)
 * @returns {{ mistakeType: string, winProbBefore: number, winProbAfter: number, winProbDelta: number, cplRaw: number, cplCapped: number }}
 */
function classifyMove(evalBestCp, evalPlayedCp, prevEvalCp = null) {
  const { cplRaw, cplCapped } = computeCentipawnLoss(evalBestCp, evalPlayedCp);

  const wpBest = winProbability(evalBestCp);
  const wpPlayed = winProbability(evalPlayedCp);
  const deltaW = Math.max(0, wpBest - wpPlayed);

  // Check for MISSED_WIN: had a winning position (W > 0.80) that collapsed (W < 0.55)
  const wpBefore = prevEvalCp !== null ? winProbability(prevEvalCp) : wpBest;
  if (wpBefore > 0.8 && wpPlayed < 0.55) {
    return {
      mistakeType: "MISSED_WIN",
      winProbBefore: wpBefore,
      winProbAfter: wpPlayed,
      winProbDelta: deltaW,
      cplRaw,
      cplCapped,
    };
  }

  // Standard tier classification
  let mistakeType;
  if (deltaW < 0.02 || cplCapped <= 10) {
    mistakeType = "BEST";
  } else if (deltaW < 0.05 && cplCapped <= 30) {
    mistakeType = "GOOD";
  } else if (deltaW < 0.12 && cplCapped <= 90) {
    mistakeType = "INACCURACY";
  } else if (deltaW < 0.25 && cplCapped <= 200) {
    mistakeType = "MISTAKE";
  } else {
    mistakeType = "BLUNDER";
  }

  return {
    mistakeType,
    winProbBefore: wpBest,
    winProbAfter: wpPlayed,
    winProbDelta: deltaW,
    cplRaw,
    cplCapped,
  };
}

/**
 * Computes the average centipawn loss for a set of moves.
 * Book moves (is_book_move = true) are excluded from the calculation per §11.5.
 *
 * @param {Array<{ cplCapped: number, isBookMove: boolean }>} moves
 * @returns {number} Average centipawn loss (0 if no non-book moves)
 */
function computeACPL(moves) {
  const nonBookMoves = moves.filter((m) => !m.isBookMove);
  if (nonBookMoves.length === 0) return 0;

  const totalCpl = nonBookMoves.reduce((sum, m) => sum + m.cplCapped, 0);
  return Math.round(totalCpl / nonBookMoves.length);
}

/**
 * Normalizes a raw Stockfish evaluation into a standard { type, value } structure.
 * Parses UCI "info score" output like "score cp 32" or "score mate 3".
 *
 * @param {string} type - 'cp' or 'mate'
 * @param {number} value - Numeric value from Stockfish
 * @returns {{ type: string, value: number }}
 */
function normalizeRawEval(type, value) {
  return {
    type: type === "mate" ? "mate" : "cp",
    value: parseInt(value, 10) || 0,
  };
}

/**
 * Converts any evaluation (cp or mate) to a unified centipawn value
 * suitable for comparison and arithmetic.
 *
 * @param {string} type - 'cp' or 'mate'
 * @param {number} value - Raw value
 * @returns {number} Centipawn equivalent
 */
function evalToCentipawns(type, value) {
  if (type === "mate") {
    return mateToCentipawns(value);
  }
  return value;
}

/**
 * Computes ACPL partitioned by White and Black, strictly excluding book moves.
 *
 * @param {Array<{ cplCapped: number, isBookMove?: boolean, plyNumber?: number }>} moves
 * @returns {{ whiteAcpl: number, blackAcpl: number }}
 */
function computeGameACPLByColor(moves) {
  const whiteMoves = moves.filter((m, i) =>
    typeof m.plyNumber === "number" ? m.plyNumber % 2 === 1 : i % 2 === 0,
  );
  const blackMoves = moves.filter((m, i) =>
    typeof m.plyNumber === "number" ? m.plyNumber % 2 === 0 : i % 2 === 1,
  );

  return {
    whiteAcpl: computeACPL(whiteMoves),
    blackAcpl: computeACPL(blackMoves),
  };
}

module.exports = {
  mateToCentipawns,
  invertEvaluation,
  winProbability,
  computeCentipawnLoss,
  classifyMove,
  computeACPL,
  computeGameACPLByColor,
  normalizeRawEval,
  evalToCentipawns,
};
