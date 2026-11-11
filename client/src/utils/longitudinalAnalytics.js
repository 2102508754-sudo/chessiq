/**
 * ChessIQ v3.3.0 — Longitudinal Analytics & Phase-Based CPL Engine
 * Day 14 (@FE): Phase partitioning (Opening, Middlegame, Endgame),
 * CPL calculations excluding catalog book moves (§11.5), and
 * Radar (Spider) Chart geometric projection mathematics.
 */

/**
 * Phase definitions:
 * - OPENING: Plies 1 to 20 (Moves 1-10) or any move tagged as book move
 * - MIDDLEGAME: Plies 21 to 60 (Moves 11-30)
 * - ENDGAME: Plies 61+ (Moves 31+)
 */
export const GAME_PHASES = {
  OPENING: "OPENING",
  MIDDLEGAME: "MIDDLEGAME",
  ENDGAME: "ENDGAME",
};

/**
 * Determines the game phase of a given ply
 * @param {number} plyNumber - 1-based ply index
 * @param {boolean} [isBookMove=false]
 * @returns {"OPENING" | "MIDDLEGAME" | "ENDGAME"}
 */
export function determineGamePhase(plyNumber, isBookMove = false) {
  if (isBookMove || plyNumber <= 20) {
    return GAME_PHASES.OPENING;
  }
  if (plyNumber <= 60) {
    return GAME_PHASES.MIDDLEGAME;
  }
  return GAME_PHASES.ENDGAME;
}

/**
 * Calculates phase-based centipawn loss and mistake telemetry for a list of moves
 * Excludes book moves from ACPL calculations per §11.5 specification.
 *
 * @param {Array<Object>} moves - Array of move objects with { ply, cpl, isBookMove, classification, color }
 * @param {"WHITE" | "BLACK" | "ALL"} [filterColor="ALL"]
 * @returns {Object} Phase breakdown statistics
 */
export function calculatePhaseAnalytics(moves = [], filterColor = "ALL") {
  const filtered = moves.filter((m) => {
    if (filterColor === "ALL") return true;
    const moveColor = m.color || (m.ply % 2 === 1 ? "WHITE" : "BLACK");
    return moveColor === filterColor;
  });

  const phases = {
    [GAME_PHASES.OPENING]: {
      name: "Opening Repertoire",
      movesCount: 0,
      totalCpl: 0,
      bookMovesCount: 0,
      blunders: 0,
      mistakes: 0,
      inaccuracies: 0,
      bestMoves: 0,
    },
    [GAME_PHASES.MIDDLEGAME]: {
      name: "Middlegame Tactics",
      movesCount: 0,
      totalCpl: 0,
      bookMovesCount: 0,
      blunders: 0,
      mistakes: 0,
      inaccuracies: 0,
      bestMoves: 0,
    },
    [GAME_PHASES.ENDGAME]: {
      name: "Endgame Conversion",
      movesCount: 0,
      totalCpl: 0,
      bookMovesCount: 0,
      blunders: 0,
      mistakes: 0,
      inaccuracies: 0,
      bestMoves: 0,
    },
  };

  filtered.forEach((m) => {
    const isBook = !!(m.isBookMove || m.classification === "BOOK");
    const phase = m.gamePhase || determineGamePhase(m.ply, isBook);
    const target = phases[phase] || phases[GAME_PHASES.MIDDLEGAME];

    target.movesCount += 1;
    if (isBook) {
      target.bookMovesCount += 1;
    } else {
      const cpl = Math.min(1000, Math.max(0, m.cpl ?? m.cplCapped ?? 0));
      target.totalCpl += cpl;
    }

    const cls = (m.classification || "").toUpperCase();
    if (cls === "BLUNDER" || cls === "MISSED_WIN") {
      target.blunders += 1;
    } else if (cls === "MISTAKE") {
      target.mistakes += 1;
    } else if (cls === "INACCURACY") {
      target.inaccuracies += 1;
    } else if (cls === "BEST" || cls === "BRILLIANT") {
      target.bestMoves += 1;
    }
  });

  // Calculate ACPL per phase (excluding book moves)
  const result = {};
  Object.keys(phases).forEach((key) => {
    const p = phases[key];
    const ratedMoves = p.movesCount - p.bookMovesCount;
    const acpl = ratedMoves > 0 ? Math.round(p.totalCpl / ratedMoves) : 0;
    const accuracy = Math.max(
      0,
      Math.min(100, Math.round(100 - (acpl / 150) * 100)),
    );

    result[key] = {
      ...p,
      ratedMoves,
      acpl,
      accuracy,
    };
    // Also provide convenient lowercase alias
    result[key.toLowerCase()] = result[key];
  });

  return result;
}

/**
 * Calculates 5-Axis Radar Chart Scores (0 to 100) from game or historical moves
 *
 * Axes:
 * 1. Opening: Book adherence and low early-ply ACPL
 * 2. Middlegame: Tactical accuracy and low middlegame ACPL
 * 3. Endgame: Technical precision and conversion ACPL
 * 4. Blunder Resilience: % of moves played without BLUNDER or MISSED_WIN
 * 5. Resourcefulness: Ratio of BEST/BRILLIANT moves under tactical tension
 *
 * @param {Object} phaseStats - Result from calculatePhaseAnalytics
 * @param {Array<Object>} [allMoves=[]]
 * @returns {Array<{ axis: string, value: number, label: string, detail: string }>}
 */
export function calculateRadarData(phaseStats, allMoves = []) {
  const opening = phaseStats[GAME_PHASES.OPENING] || { acpl: 15, accuracy: 90 };
  const middlegame = phaseStats[GAME_PHASES.MIDDLEGAME] || {
    acpl: 35,
    accuracy: 76,
  };
  const endgame = phaseStats[GAME_PHASES.ENDGAME] || { acpl: 20, accuracy: 86 };

  // 1. Opening Score (0 - 100)
  const openingScore = Math.max(20, Math.min(100, 100 - opening.acpl * 1.5));

  // 2. Middlegame Score (0 - 100)
  const middlegameScore = Math.max(
    20,
    Math.min(100, 100 - middlegame.acpl * 1.1),
  );

  // 3. Endgame Score (0 - 100)
  const endgameScore = Math.max(20, Math.min(100, 100 - endgame.acpl * 1.3));

  // 4. Blunder Resilience (0 - 100): High score means very few blunders
  const totalMoves = allMoves.length || 1;
  const totalBlunders =
    (opening.blunders || 0) +
    (middlegame.blunders || 0) +
    (endgame.blunders || 0);
  const blunderRate = totalBlunders / (totalMoves / 2 || 1); // Blunders per player moves
  const resilienceScore = Math.max(
    15,
    Math.min(100, Math.round(100 - blunderRate * 35)),
  );

  // 5. Tactical Precision / Resourcefulness (0 - 100)
  const totalBest =
    (opening.bestMoves || 0) +
    (middlegame.bestMoves || 0) +
    (endgame.bestMoves || 0);
  const bestRate = totalBest / (totalMoves / 2 || 1);
  const precisionScore = Math.max(
    20,
    Math.min(100, Math.round(bestRate * 100)),
  );

  return [
    {
      axis: "Opening",
      value: Math.round(openingScore),
      label: "Opening Repertoire",
      detail: `${opening.acpl} ACPL • ${opening.bookMovesCount || 0} Book moves`,
    },
    {
      axis: "Middlegame",
      value: Math.round(middlegameScore),
      label: "Middlegame Tactics",
      detail: `${middlegame.acpl} ACPL • ${middlegame.blunders || 0} Blunders`,
    },
    {
      axis: "Endgame",
      value: Math.round(endgameScore),
      label: "Endgame Conversion",
      detail: `${endgame.acpl} ACPL • Precision technique`,
    },
    {
      axis: "Resilience",
      value: Math.round(resilienceScore),
      label: "Blunder Resilience",
      detail: `${totalBlunders} Critical oversights in game`,
    },
    {
      axis: "Precision",
      value: Math.round(precisionScore),
      label: "Tactical Precision",
      detail: `${totalBest} Engine-optimal moves played`,
    },
  ];
}

/**
 * Geometric projection for SVG Radar / Spider Chart
 * Computes (x, y) coordinates on a circle of given radius and center.
 *
 * @param {number} index - 0 to totalAxes - 1
 * @param {number} totalAxes - Total number of spokes (typically 5)
 * @param {number} value - Metric value (0 to 100)
 * @param {number} radius - Maximum outer radius in pixels
 * @param {number} centerX - SVG center X
 * @param {number} centerY - SVG center Y
 * @returns {{ x: number, y: number }}
 */
export function getRadarPoint(
  index,
  totalAxes,
  value,
  radius,
  centerX,
  centerY,
) {
  // Start from top (-PI/2) and rotate clockwise
  const angle = (Math.PI * 2 * index) / totalAxes - Math.PI / 2;
  const scaledRadius = (Math.max(0, Math.min(100, value)) / 100) * radius;
  const x = centerX + scaledRadius * Math.cos(angle);
  const y = centerY + scaledRadius * Math.sin(angle);
  return { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 };
}

/**
 * Generates an SVG path 'd' attribute string connecting radar points into a closed polygon
 * @param {Array<{ value: number }>} data - Array of axis items with value 0-100
 * @param {number} radius - Maximum radius in pixels
 * @param {number} centerX
 * @param {number} centerY
 * @returns {string} SVG polygon path string
 */
export function generateRadarPolygonPath(data, radius, centerX, centerY) {
  if (!data || data.length === 0) return "";
  const points = data.map((d, i) =>
    getRadarPoint(i, data.length, d.value, radius, centerX, centerY),
  );
  return (
    points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") +
    " Z"
  );
}
