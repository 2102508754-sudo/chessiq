/**
 * ChessIQ v3.3.0 — Chess Puzzle Mechanics & Statistics Utilities
 * Day 15 (@FE): Pure chess.js puzzle position initialization, multi-move variation
 * validation, orientation resolution, hint masking, and backend telemetry aggregation.
 */

import { Chess } from "chess.js";

export const PUZZLE_DIFFICULTY_BANDS = {
  ALL: { key: "ALL", label: "All Ratings", min: null, max: null },
  BEGINNER: {
    key: "BEGINNER",
    label: "< 1200 (Beginner)",
    min: 400,
    max: 1199,
  },
  INTERMEDIATE: {
    key: "INTERMEDIATE",
    label: "1200 – 1799 (Club)",
    min: 1200,
    max: 1799,
  },
  ADVANCED: { key: "ADVANCED", label: "1800+ (Master)", min: 1800, max: 3200 },
};

/**
 * Validates puzzle FEN and extracts the active side-to-move for board orientation.
 * @param {string} fen
 * @returns {{ valid: boolean, orientation: "white" | "black", turn: "w" | "b", error?: string }}
 */
export function inspectPuzzlePosition(fen) {
  if (!fen || typeof fen !== "string") {
    return {
      valid: false,
      orientation: "white",
      turn: "w",
      error: "Missing FEN position",
    };
  }
  try {
    const chess = new Chess(fen);
    const turn = chess.turn();
    return {
      valid: true,
      orientation: turn === "b" ? "black" : "white",
      turn,
    };
  } catch (err) {
    return {
      valid: false,
      orientation: "white",
      turn: "w",
      error: err.message || "Invalid FEN format",
    };
  }
}

/**
 * Normalizes a move string (UCI or SAN) against a position into canonical { from, to, promotion, uci, san }.
 * @param {string} fen
 * @param {string} moveStr
 */
export function resolveExpectedMove(fen, moveStr) {
  if (!fen || !moveStr) return null;
  try {
    const chess = new Chess(fen);
    const trimmed = String(moveStr).trim();
    if (/^[a-h][1-8][a-h][1-8][qrbn]?$/i.test(trimmed)) {
      const from = trimmed.slice(0, 2).toLowerCase();
      const to = trimmed.slice(2, 4).toLowerCase();
      const promotion = trimmed[4] ? trimmed[4].toLowerCase() : undefined;
      const result = chess.move({ from, to, promotion });
      if (!result) return null;
      return {
        from: result.from,
        to: result.to,
        promotion: result.promotion || "",
        uci: `${result.from}${result.to}${result.promotion || ""}`,
        san: result.san,
        nextFen: chess.fen(),
      };
    }

    const result = chess.move(trimmed);
    if (!result) return null;
    return {
      from: result.from,
      to: result.to,
      promotion: result.promotion || "",
      uci: `${result.from}${result.to}${result.promotion || ""}`,
      san: result.san,
      nextFen: chess.fen(),
    };
  } catch (_) {
    return null;
  }
}

/**
 * Validates a user's candidate move against the legal rules of `chess.js` and compares it
 * against the expected move in the current puzzle step.
 *
 * @param {{
 *   fen: string,
 *   expectedMoveStr: string,
 *   move: { from: string, to: string, promotion?: string, san?: string }
 * }} params
 */
export function evaluatePuzzleMove({ fen, expectedMoveStr, move }) {
  try {
    const chess = new Chess(fen);
    const moveInput =
      typeof move === "string"
        ? move
        : {
            from: move.from,
            to: move.to,
            promotion: move.promotion || undefined,
          };

    let played;
    try {
      played = chess.move(moveInput);
    } catch (_) {
      // Fallback if promotion piece was supplied unnecessarily on a non-promotion move
      if (typeof moveInput === "object" && moveInput.promotion) {
        played = chess.move({ from: moveInput.from, to: moveInput.to });
      }
    }

    if (!played) {
      return { isLegal: false, isMatch: false, playedMove: null, nextFen: fen };
    }

    const playedUci = `${played.from}${played.to}${played.promotion || ""}`;
    const nextFen = chess.fen();
    const expected = resolveExpectedMove(fen, expectedMoveStr);

    // Match by canonical UCI OR checkmate equivalence
    const isExactMatch = Boolean(
      expected &&
      (playedUci === expected.uci ||
        played.san === expected.san ||
        chess.isCheckmate()),
    );

    return {
      isLegal: true,
      isMatch: isExactMatch,
      playedMove: {
        from: played.from,
        to: played.to,
        san: played.san,
        uci: playedUci,
        captured: played.captured || null,
      },
      expectedMove: expected,
      nextFen,
      isCheckmate: chess.isCheckmate(),
    };
  } catch (_) {
    return { isLegal: false, isMatch: false, playedMove: null, nextFen: fen };
  }
}

/**
 * Executes an opponent reply move cleanly during multi-move puzzle variations.
 */
export function applyForcedReplyMove(fen, replyMoveStr) {
  const resolved = resolveExpectedMove(fen, replyMoveStr);
  if (!resolved) {
    return { ok: false, nextFen: fen, move: null };
  }
  return {
    ok: true,
    nextFen: resolved.nextFen,
    move: resolved,
  };
}

/**
 * Computes hint highlight data without prematurely exposing the full multi-move variation.
 * Level 1 hint highlights the piece square; Level 2 (if explicitly requested) shows the target move square.
 */
export function buildPuzzleHint(
  fen,
  expectedMoveStr,
  revealDestination = false,
) {
  const expected = resolveExpectedMove(fen, expectedMoveStr);
  if (!expected) return null;
  return {
    fromSquare: expected.from,
    toSquare: revealDestination ? expected.to : null,
    sanHint: revealDestination
      ? expected.san
      : `Move piece on ${expected.from.toUpperCase()}`,
  };
}

/**
 * Filters normalized puzzles by tactical theme, rating band, and completion status.
 */
export function filterPersonalizedPuzzles(
  items = [],
  { theme = "ALL", difficulty = "ALL", statusFilter = "ALL" } = {},
) {
  const band =
    PUZZLE_DIFFICULTY_BANDS[difficulty] || PUZZLE_DIFFICULTY_BANDS.ALL;

  return items.filter((item) => {
    if (theme && theme !== "ALL") {
      const themeMatch =
        item.category === theme ||
        (item.themes || []).some((t) => t.theme_code === theme);
      if (!themeMatch) return false;
    }

    if (band.min !== null && band.max !== null) {
      if (item.rating === null || item.rating === undefined) return false;
      if (item.rating < band.min || item.rating > band.max) return false;
    }

    if (statusFilter === "PENDING" && item.isCompleted) return false;
    if (statusFilter === "COMPLETED" && !item.isCompleted) return false;

    return true;
  });
}

/**
 * Computes dashboard statistics from authentic backend recommendation rows and optional server stats.
 * Never fabricates baseline stats when no backend data exists.
 */
export function aggregateTrainingDashboardStats(
  items = [],
  backendStats = null,
  backendWeaknesses = null,
) {
  const total =
    backendStats?.total_puzzles !== undefined
      ? Number(backendStats.total_puzzles)
      : items.length;

  const completed =
    backendStats?.completed !== undefined
      ? Number(backendStats.completed)
      : backendStats?.completed_count !== undefined
        ? Number(backendStats.completed_count)
        : items.filter((p) => p.isCompleted).length;

  const correct =
    backendStats?.correct !== undefined
      ? Number(backendStats.correct)
      : backendStats?.correct_count !== undefined
        ? Number(backendStats.correct_count)
        : items.filter((p) => p.isCompleted && p.lastResult !== "INCORRECT")
            .length;

  const incorrect =
    backendStats?.incorrect !== undefined
      ? Number(backendStats.incorrect)
      : backendStats?.incorrect_count !== undefined
        ? Number(backendStats.incorrect_count)
        : items.filter((p) => p.lastResult === "INCORRECT").length;

  const attemptsTotal = correct + incorrect;
  const successPercentage =
    backendStats?.success_rate !== undefined
      ? Math.round(Number(backendStats.success_rate))
      : attemptsTotal > 0
        ? Math.round((correct / attemptsTotal) * 100)
        : completed > 0 && total > 0
          ? Math.round((completed / total) * 100)
          : 0;

  const progressPercentage =
    total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;

  // Build weakness breakdown purely from real items or backend weaknesses array
  const themeCounts = new Map();
  items.forEach((item) => {
    const codes =
      item.themes && item.themes.length > 0
        ? item.themes.map((t) => ({
            code: t.theme_code,
            label: t.description || t.theme_code,
          }))
        : item.category
          ? [{ code: item.category, label: item.category }]
          : [];
    codes.forEach(({ code, label }) => {
      const prev = themeCounts.get(code) || {
        theme_code: code,
        label,
        count: 0,
        completed: 0,
      };
      prev.count += 1;
      if (item.isCompleted) prev.completed += 1;
      themeCounts.set(code, prev);
    });
  });

  const weaknessCategories =
    Array.isArray(backendWeaknesses) && backendWeaknesses.length > 0
      ? backendWeaknesses
      : Array.from(themeCounts.values()).sort((a, b) => b.count - a.count);

  return {
    total,
    completed,
    correct,
    incorrect,
    successPercentage,
    progressPercentage,
    weaknessCategories,
  };
}
