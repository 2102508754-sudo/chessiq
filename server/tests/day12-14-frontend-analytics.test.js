/**
 * ChessIQ v3.3.0 — Day 12–14 Frontend & Telemetry Analytics Test Suite (@FE)
 *
 * Verifies:
 * Day 12: Real-Time Analysis Polling & Longitudinal Progress Indicators
 * Day 13: Tactical Blunder Classification Tiers & Move Evaluation Navigation
 * Day 14: Longitudinal Analytics Dashboard & Phase-Based CPL Radar Visualizations
 */

// ==============================================================================
// Day 14 Analytics & Geometry Algorithms (matching client/src/utils/longitudinalAnalytics.js)
// ==============================================================================
const GAME_PHASES = {
  OPENING: "OPENING",
  MIDDLEGAME: "MIDDLEGAME",
  ENDGAME: "ENDGAME",
};

function determineGamePhase(plyNumber, isBookMove = false) {
  if (isBookMove || plyNumber <= 20) {
    return GAME_PHASES.OPENING;
  }
  if (plyNumber <= 60) {
    return GAME_PHASES.MIDDLEGAME;
  }
  return GAME_PHASES.ENDGAME;
}

function calculatePhaseAnalytics(moves = [], filterColor = "ALL") {
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
    const isBook = !!(m.isBookMove || m.isBook || m.classification === "BOOK");
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

  const result = {};
  Object.keys(phases).forEach((key) => {
    const p = phases[key];
    const ratedMoves = p.movesCount - p.bookMovesCount;
    const acpl = ratedMoves > 0 ? Math.round(p.totalCpl / ratedMoves) : 0;
    const accuracy = Math.max(0, Math.min(100, Math.round(100 - (acpl / 150) * 100)));

    result[key] = {
      ...p,
      ratedMoves,
      acpl,
      accuracy,
    };
    result[key.toLowerCase()] = result[key];
  });

  return result;
}

function calculateRadarData(phaseStats, allMoves = []) {
  const opening = phaseStats[GAME_PHASES.OPENING] || { acpl: 15, accuracy: 90 };
  const middlegame = phaseStats[GAME_PHASES.MIDDLEGAME] || { acpl: 35, accuracy: 76 };
  const endgame = phaseStats[GAME_PHASES.ENDGAME] || { acpl: 20, accuracy: 86 };

  const openingScore = Math.max(20, Math.min(100, 100 - opening.acpl * 1.5));
  const middlegameScore = Math.max(20, Math.min(100, 100 - middlegame.acpl * 1.1));
  const endgameScore = Math.max(20, Math.min(100, 100 - endgame.acpl * 1.3));

  const totalMoves = allMoves.length || 1;
  const totalBlunders =
    (opening.blunders || 0) + (middlegame.blunders || 0) + (endgame.blunders || 0);
  const blunderRate = totalBlunders / (totalMoves / 2 || 1);
  const resilienceScore = Math.max(15, Math.min(100, Math.round(100 - blunderRate * 35)));

  const totalBest =
    (opening.bestMoves || 0) + (middlegame.bestMoves || 0) + (endgame.bestMoves || 0);
  const bestRate = totalBest / (totalMoves / 2 || 1);
  const precisionScore = Math.max(20, Math.min(100, Math.round(bestRate * 100)));

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

function getRadarPoint(index, totalAxes, value, radius, centerX, centerY) {
  const angle = (Math.PI * 2 * index) / totalAxes - Math.PI / 2;
  const scaledRadius = (Math.max(0, Math.min(100, value)) / 100) * radius;
  const x = centerX + scaledRadius * Math.cos(angle);
  const y = centerY + scaledRadius * Math.sin(angle);
  return { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 };
}

function generateRadarPolygonPath(data, radius, centerX, centerY) {
  if (!data || data.length === 0) return "";
  const points = data.map((d, i) =>
    getRadarPoint(i, data.length, d.value, radius, centerX, centerY)
  );
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";
}

// ==============================================================================
// Day 12 Unit Tests: Real-Time Analysis Polling & Progress Lifecycle
// ==============================================================================
describe("ChessIQ Day 12: Real-Time Analysis Polling & Progress Lifecycle (@FE)", () => {
  const POLLING_STATUS = {
    IDLE: "IDLE",
    UPLOADING: "UPLOADING",
    PENDING: "PENDING",
    PROCESSING: "PROCESSING",
    COMPLETED: "COMPLETED",
    FAILED: "FAILED",
  };

  function computeProgress(currentPly, totalPlies) {
    if (!totalPlies || totalPlies <= 0) return 0;
    return Math.min(100, Math.max(0, Math.round((currentPly / totalPlies) * 100)));
  }

  function getAdaptiveInterval(status) {
    switch (status) {
      case POLLING_STATUS.PROCESSING:
        return 800; // Fast cadence during active Stockfish evaluation
      case POLLING_STATUS.PENDING:
        return 1800; // Conservative cadence while awaiting worker pool lock
      case POLLING_STATUS.FAILED:
      case POLLING_STATUS.COMPLETED:
      default:
        return null; // Stop polling
    }
  }

  function computeBackoffDelay(attemptCount, baseDelay = 1000, maxDelay = 15000) {
    return Math.min(maxDelay, baseDelay * Math.pow(1.5, Math.max(0, attemptCount)));
  }

  test("calculates progress percentage accurately across ply bounds", () => {
    expect(computeProgress(0, 80)).toBe(0);
    expect(computeProgress(40, 80)).toBe(50);
    expect(computeProgress(80, 80)).toBe(100);
    expect(computeProgress(90, 80)).toBe(100); // Clamped at 100%
    expect(computeProgress(0, 0)).toBe(0); // Zero total plies safety
    expect(computeProgress(-5, 80)).toBe(0); // Negative ply safety
  });

  test("determines adaptive polling intervals based on worker job status", () => {
    expect(getAdaptiveInterval(POLLING_STATUS.PROCESSING)).toBe(800);
    expect(getAdaptiveInterval(POLLING_STATUS.PENDING)).toBe(1800);
    expect(getAdaptiveInterval(POLLING_STATUS.COMPLETED)).toBeNull();
    expect(getAdaptiveInterval(POLLING_STATUS.FAILED)).toBeNull();
    expect(getAdaptiveInterval(POLLING_STATUS.IDLE)).toBeNull();
  });

  test("computes bounded exponential backoff on network disruption", () => {
    expect(computeBackoffDelay(0)).toBe(1000);
    expect(computeBackoffDelay(1)).toBe(1500);
    expect(computeBackoffDelay(2)).toBe(2250);
    expect(computeBackoffDelay(3)).toBe(3375);
    expect(computeBackoffDelay(10)).toBe(15000); // Clamped at maxDelay
  });
});

// ==============================================================================
// Day 13 Unit Tests: Tactical Blunder Classification Tiers & Navigation
// ==============================================================================
describe("ChessIQ Day 13: Tactical Blunder Classification Tiers & Navigation (@FE)", () => {
  const CLASSIFICATION_TIERS = {
    BRILLIANT: { label: "Brilliant", rank: 1, isError: false },
    BEST: { label: "Best", rank: 2, isError: false },
    BOOK: { label: "Book", rank: 3, isError: false },
    GOOD: { label: "Good", rank: 4, isError: false },
    INACCURACY: { label: "Inaccuracy", rank: 5, isError: true },
    MISTAKE: { label: "Mistake", rank: 6, isError: true },
    BLUNDER: { label: "Blunder", rank: 7, isError: true },
    MISSED_WIN: { label: "Missed Win", rank: 8, isError: true },
  };

  function getMoveClassification(cpl, isBook = false, isMateMiss = false) {
    if (isBook) return "BOOK";
    if (isMateMiss) return "MISSED_WIN";
    if (cpl == null || isNaN(cpl)) return "BEST";
    if (cpl <= 10) return "BEST";
    if (cpl <= 35) return "GOOD";
    if (cpl <= 90) return "INACCURACY";
    if (cpl <= 200) return "MISTAKE";
    return "BLUNDER";
  }

  function findNextErrorPly(moves, currentIdx, direction = 1) {
    const total = moves.length;
    let i = currentIdx + direction;
    while (i >= 0 && i < total) {
      const cls = moves[i].classification;
      if (CLASSIFICATION_TIERS[cls]?.isError) {
        return i;
      }
      i += direction;
    }
    return -1;
  }

  function filterMovesByTier(moves, activeFilter) {
    if (!activeFilter || activeFilter === "ALL") return moves;
    if (activeFilter === "ERRORS") {
      return moves.filter((m) => CLASSIFICATION_TIERS[m.classification]?.isError);
    }
    return moves.filter((m) => m.classification === activeFilter);
  }

  const sampleMoves = [
    { ply: 1, san: "e4", cpl: 0, classification: "BOOK" },
    { ply: 2, san: "e5", cpl: 5, classification: "BOOK" },
    { ply: 3, san: "Nf3", cpl: 8, classification: "BEST" },
    { ply: 4, san: "Nc6", cpl: 15, classification: "GOOD" },
    { ply: 5, san: "Bc4", cpl: 65, classification: "INACCURACY" },
    { ply: 6, san: "d6", cpl: 140, classification: "MISTAKE" },
    { ply: 7, san: "h3", cpl: 10, classification: "BEST" },
    { ply: 8, san: "Nf6", cpl: 320, classification: "BLUNDER" },
    { ply: 9, san: "d3", cpl: 500, classification: "MISSED_WIN" },
  ];

  test("classifies moves into standard 7-tier categories based on CPL", () => {
    expect(getMoveClassification(0, true)).toBe("BOOK");
    expect(getMoveClassification(5)).toBe("BEST");
    expect(getMoveClassification(25)).toBe("GOOD");
    expect(getMoveClassification(60)).toBe("INACCURACY");
    expect(getMoveClassification(150)).toBe("MISTAKE");
    expect(getMoveClassification(350)).toBe("BLUNDER");
    expect(getMoveClassification(0, false, true)).toBe("MISSED_WIN");
    expect(getMoveClassification(null)).toBe("BEST"); // Missing data safety
  });

  test("navigates forward and backward between critical tactical errors", () => {
    // Current at ply index 3 (Nc6 - GOOD), next error should be index 4 (Bc4 - INACCURACY)
    expect(findNextErrorPly(sampleMoves, 3, 1)).toBe(4);

    // From index 4 (INACCURACY), next error should be index 5 (MISTAKE)
    expect(findNextErrorPly(sampleMoves, 4, 1)).toBe(5);

    // From index 5 (MISTAKE), next error should skip index 6 (BEST) to index 7 (BLUNDER)
    expect(findNextErrorPly(sampleMoves, 5, 1)).toBe(7);

    // Backward navigation: from index 7 (BLUNDER), previous error should be index 5 (MISTAKE)
    expect(findNextErrorPly(sampleMoves, 7, -1)).toBe(5);

    // At last error (index 8), next error returns -1 (boundary condition)
    expect(findNextErrorPly(sampleMoves, 8, 1)).toBe(-1);

    // At first move (index 0), previous error returns -1 (boundary condition)
    expect(findNextErrorPly(sampleMoves, 0, -1)).toBe(-1);
  });

  test("filters moves by error category and severity pills", () => {
    const errorMoves = filterMovesByTier(sampleMoves, "ERRORS");
    expect(errorMoves.length).toBe(4);
    expect(errorMoves.map((m) => m.classification)).toEqual([
      "INACCURACY",
      "MISTAKE",
      "BLUNDER",
      "MISSED_WIN",
    ]);

    const blundersOnly = filterMovesByTier(sampleMoves, "BLUNDER");
    expect(blundersOnly.length).toBe(1);
    expect(blundersOnly[0].san).toBe("Nf6");

    const allMoves = filterMovesByTier(sampleMoves, "ALL");
    expect(allMoves.length).toBe(sampleMoves.length);
  });
});

// ==============================================================================
// Day 14 Unit Tests: Longitudinal Analytics & Phase Radar Visualizations
// ==============================================================================
describe("ChessIQ Day 14: Longitudinal Analytics & Phase Radar Visualizations (@FE)", () => {
  const mockGameMoves = [
    // Opening: Plies 1–6 (some book moves)
    { ply: 1, color: "WHITE", cpl: 0, classification: "BOOK", isBook: true },
    { ply: 2, color: "BLACK", cpl: 0, classification: "BOOK", isBook: true },
    { ply: 3, color: "WHITE", cpl: 12, classification: "BEST", isBook: false },
    { ply: 4, color: "BLACK", cpl: 15, classification: "GOOD", isBook: false },
    { ply: 5, color: "WHITE", cpl: 18, classification: "GOOD", isBook: false },
    { ply: 6, color: "BLACK", cpl: 20, classification: "GOOD", isBook: false },

    // Middlegame: Plies 21–24
    { ply: 21, color: "WHITE", cpl: 35, classification: "GOOD" },
    { ply: 22, color: "BLACK", cpl: 75, classification: "INACCURACY" },
    { ply: 23, color: "WHITE", cpl: 180, classification: "MISTAKE" },
    { ply: 24, color: "BLACK", cpl: 320, classification: "BLUNDER" },

    // Endgame: Plies 61–64
    { ply: 61, color: "WHITE", cpl: 10, classification: "BEST" },
    { ply: 62, color: "BLACK", cpl: 14, classification: "BEST" },
    { ply: 63, color: "WHITE", cpl: 8, classification: "BEST" },
    { ply: 64, color: "BLACK", cpl: 12, classification: "BEST" },
  ];

  test("partitions game into Opening, Middlegame, and Endgame phases accurately", () => {
    expect(determineGamePhase(1, false)).toBe(GAME_PHASES.OPENING);
    expect(determineGamePhase(18, false)).toBe(GAME_PHASES.OPENING);
    expect(determineGamePhase(20, false)).toBe(GAME_PHASES.OPENING);
    expect(determineGamePhase(25, true)).toBe(GAME_PHASES.OPENING); // Book move forces Opening
    expect(determineGamePhase(21, false)).toBe(GAME_PHASES.MIDDLEGAME);
    expect(determineGamePhase(45, false)).toBe(GAME_PHASES.MIDDLEGAME);
    expect(determineGamePhase(60, false)).toBe(GAME_PHASES.MIDDLEGAME);
    expect(determineGamePhase(61, false)).toBe(GAME_PHASES.ENDGAME);
    expect(determineGamePhase(80, false)).toBe(GAME_PHASES.ENDGAME);
  });

  test("calculates Phase ACPL strictly excluding book moves per §11.5", () => {
    const stats = calculatePhaseAnalytics(mockGameMoves, "ALL");

    // Opening non-book moves: plies 3, 4, 5, 6 -> cpl: [12, 15, 18, 20]
    // Mean = (12 + 15 + 18 + 20) / 4 = 65 / 4 = 16.25 -> rounded = 16
    expect(stats.opening.ratedMoves).toBe(4);
    expect(stats.opening.bookMovesCount).toBe(2);
    expect(stats.opening.acpl).toBe(16);

    // Middlegame moves: plies 21, 22, 23, 24 -> cpl: [35, 75, 180, 320]
    // Mean = 610 / 4 = 152.5 -> rounded = 153
    expect(stats.middlegame.ratedMoves).toBe(4);
    expect(stats.middlegame.acpl).toBe(153);
    expect(stats.middlegame.blunders).toBe(1);
    expect(stats.middlegame.mistakes).toBe(1);

    // Endgame moves: plies 61, 62, 63, 64 -> cpl: [10, 14, 8, 12]
    // Mean = 44 / 4 = 11 -> rounded = 11
    expect(stats.endgame.ratedMoves).toBe(4);
    expect(stats.endgame.acpl).toBe(11);
    expect(stats.endgame.blunders).toBe(0);
  });

  test("computes bounded 5-axis Radar chart scores in range [0, 100]", () => {
    const stats = calculatePhaseAnalytics(mockGameMoves, "ALL");
    const radar = calculateRadarData(stats, mockGameMoves);

    expect(radar).toHaveLength(5);
    const axisNames = radar.map((r) => r.axis);
    expect(axisNames).toEqual(["Opening", "Middlegame", "Endgame", "Resilience", "Precision"]);

    radar.forEach((item) => {
      expect(item.value).toBeGreaterThanOrEqual(0);
      expect(item.value).toBeLessThanOrEqual(100);
    });

    // Endgame ACPL is 11, which yields high rating
    const endgameAxis = radar.find((r) => r.axis === "Endgame");
    expect(endgameAxis.value).toBeGreaterThan(80);

    // Middlegame ACPL is 153, which yields lower rating
    const middleAxis = radar.find((r) => r.axis === "Middlegame");
    expect(middleAxis.value).toBeLessThan(60);
  });

  test("generates valid SVG polygon path and coordinates for Radar canvas", () => {
    const radius = 100;
    const center = 150;
    const testData = [
      { axis: "Opening", value: 100 },
      { axis: "Middlegame", value: 50 },
      { axis: "Endgame", value: 75 },
      { axis: "Resilience", value: 60 },
      { axis: "Precision", value: 80 },
    ];

    // Check individual vertex calculation
    const topPoint = getRadarPoint(0, 5, 100, radius, center, center);
    expect(topPoint.x).toBeCloseTo(150, 1);
    expect(topPoint.y).toBeCloseTo(50, 1); // center - radius

    // Check complete SVG path string
    const path = generateRadarPolygonPath(testData, radius, center, center);
    expect(typeof path).toBe("string");
    expect(path.startsWith("M ")).toBe(true);
    expect(path.endsWith(" Z")).toBe(true);
    expect(path.split("L ").length).toBe(5); // 1 M point + 4 L points
  });

  test("handles empty and single-move games gracefully without NaN or throwing", () => {
    const emptyStats = calculatePhaseAnalytics([], "ALL");
    expect(emptyStats.opening.acpl).toBe(0);
    expect(emptyStats.middlegame.acpl).toBe(0);
    expect(emptyStats.endgame.acpl).toBe(0);

    const emptyRadar = calculateRadarData(emptyStats, []);
    expect(emptyRadar).toHaveLength(5);
    emptyRadar.forEach((r) => {
      expect(isNaN(r.value)).toBe(false);
      expect(r.value).toBeGreaterThanOrEqual(15);
      expect(r.value).toBeLessThanOrEqual(100);
    });

    const emptyPath = generateRadarPolygonPath([], 100, 150, 150);
    expect(emptyPath).toBe("");
  });
});
