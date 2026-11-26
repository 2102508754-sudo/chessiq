/**
 * ChessIQ v3.3.0 — Personalized Training Puzzles API Client
 * Day 15 (@FE): Interfaces with GET /api/recommendations (exposing v_training_recommendations
 * joined with v_training_puzzles) and submits authoritative attempt verifications.
 */

import api from "./client.js";

/**
 * Normalizes a recommendation + puzzle record whether returned nested (`item.puzzle`)
 * or flat (3NF joined columns from `v_training_recommendations` & `v_training_puzzles`).
 * @param {any} raw
 * @returns {Object|null}
 */
export function normalizePuzzleRecommendation(raw) {
  if (!raw || typeof raw !== "object") return null;

  const p = raw.puzzle && typeof raw.puzzle === "object" ? raw.puzzle : raw;
  const fen = p.fen || raw.fen || null;
  const rawMoves = p.moves ?? raw.moves ?? "";
  const movesArray = Array.isArray(rawMoves)
    ? rawMoves.filter(Boolean)
    : typeof rawMoves === "string"
      ? rawMoves.trim().split(/\s+/).filter(Boolean)
      : [];

  const rawThemes = Array.isArray(p.themes)
    ? p.themes
    : Array.isArray(raw.themes)
      ? raw.themes
      : [];

  const themes = rawThemes
    .map((t) => {
      if (typeof t === "string") {
        return { theme_code: t, description: t };
      }
      return {
        theme_code: t.theme_code || t.code || "tactics",
        description: t.description || t.theme_code || "Tactical motif",
      };
    })
    .filter((t) => t.theme_code);

  const isCompleted = Boolean(raw.is_completed ?? p.is_completed ?? false);
  const lastResult = raw.attempt_result ?? raw.result ?? null;

  return {
    recommendationId: raw.id || raw.recommendation_id || p.id || null,
    puzzleId: raw.puzzle_id || p.id || raw.id || null,
    userId: raw.user_id || null,
    category: raw.category || (themes[0]?.theme_code ?? "TACTICAL_TRAINING"),
    description:
      raw.description ||
      raw.match_reason ||
      p.explanation ||
      themes[0]?.description ||
      "Find the decisive tactical continuation from this game position.",
    metricEvidence: raw.metric_evidence || null,
    isCompleted,
    lastResult,
    attemptsCount: Number(raw.attempts_count ?? 0),
    createdAt: raw.created_at || p.created_at || null,
    fen,
    moves: movesArray,
    rawMovesString: Array.isArray(rawMoves) ? rawMoves.join(" ") : rawMoves,
    rating:
      p.rating !== undefined && p.rating !== null ? Number(p.rating) : null,
    themes,
    explanation:
      raw.explanation ||
      p.explanation ||
      raw.match_reason ||
      raw.description ||
      null,
  };
}

/**
 * Fetches personalized training puzzles & recommendations from /api/recommendations.
 * Only sends supported query filters when explicitly chosen.
 *
 * @param {{
 *   theme?: string,
 *   minRating?: number,
 *   maxRating?: number,
 *   limit?: number,
 *   offset?: number,
 *   signal?: AbortSignal,
 * }} [params]
 */
export async function fetchPersonalizedPuzzles(params = {}) {
  const { theme, minRating, maxRating, limit, offset, signal } = params;

  const query = new URLSearchParams();
  if (theme && theme !== "ALL") query.set("theme", theme);
  if (minRating !== undefined && minRating !== null)
    query.set("min_rating", String(minRating));
  if (maxRating !== undefined && maxRating !== null)
    query.set("max_rating", String(maxRating));
  if (limit !== undefined && limit !== null) query.set("limit", String(limit));
  if (offset !== undefined && offset !== null)
    query.set("offset", String(offset));

  const qs = query.toString();
  const endpoint = qs ? `/api/recommendations?${qs}` : "/api/recommendations";

  const res = await api.get(endpoint, { signal });
  const payload = res?.data || res || {};

  const rawList = Array.isArray(payload)
    ? payload
    : Array.isArray(payload.recommendations)
      ? payload.recommendations
      : Array.isArray(payload.puzzles)
        ? payload.puzzles
        : [];

  const items = rawList
    .map(normalizePuzzleRecommendation)
    .filter(
      (item) => item !== null && Boolean(item.fen) && item.moves.length > 0,
    );

  return {
    items,
    rawCount: rawList.length,
    stats: payload.stats || null,
    pagination: payload.pagination || null,
    weaknesses: payload.weaknesses || payload.weakness_categories || null,
    recentActivity: payload.recent_activity || null,
  };
}

/**
 * Submits a puzzle attempt to the backend for authoritative validation & progress persistence.
 * Never retried automatically because POST mutates recommendation_completion_states.
 *
 * @param {{
 *   recommendationId?: string,
 *   puzzleId?: string,
 *   movesPlayed: string[],
 *   isCorrect: boolean,
 *   isCompleted: boolean,
 *   timeSpentMs?: number,
 *   usedHint?: boolean,
 * }} payload
 */
export async function submitPuzzleAttempt({
  recommendationId,
  puzzleId,
  movesPlayed,
  isCorrect,
  isCompleted,
  timeSpentMs = 0,
  usedHint = false,
}) {
  const targetId = recommendationId || puzzleId;
  if (!targetId) {
    throw new Error(
      "Missing recommendationId or puzzleId for puzzle attempt submission",
    );
  }

  const endpoint = recommendationId
    ? `/api/recommendations/${encodeURIComponent(recommendationId)}/attempt`
    : `/api/puzzles/${encodeURIComponent(puzzleId)}/attempt`;

  const res = await api.post(endpoint, {
    recommendation_id: recommendationId || null,
    puzzle_id: puzzleId || null,
    moves_played: movesPlayed,
    is_correct: Boolean(isCorrect),
    is_completed: Boolean(isCompleted),
    time_spent_ms: Math.max(0, Math.round(timeSpentMs)),
    used_hint: Boolean(usedHint),
  });

  return res?.data || res;
}

/**
 * Queries the 1NF tactical themes catalog via GET /api/puzzles/themes.
 * @param {AbortSignal} [signal]
 */
export async function fetchPuzzleThemes(signal) {
  const res = await api.get("/api/puzzles/themes", { signal });
  const data = res?.data || res || {};
  return Array.isArray(data.themes) ? data.themes : [];
}

/**
 * Triggers backend stored procedure sp_generate_user_training_recommendations
 * via POST /api/recommendations/generate and returns normalized recommendations.
 * @param {number} [limit=5]
 */
export async function generateFreshRecommendations(limit = 5) {
  const res = await api.post("/api/recommendations/generate", { limit });
  const payload = res?.data || res || {};
  const rawList = Array.isArray(payload.recommendations)
    ? payload.recommendations
    : [];
  return rawList
    .map(normalizePuzzleRecommendation)
    .filter(
      (item) => item !== null && Boolean(item.fen) && item.moves.length > 0,
    );
}

/**
 * Fetches puzzle catalog rows directly from GET /api/puzzles (v_training_puzzles).
 */
export async function fetchPuzzleCatalog({
  theme,
  minRating,
  maxRating,
  limit = 20,
  offset = 0,
  signal,
} = {}) {
  const query = new URLSearchParams();
  if (theme && theme !== "ALL") query.set("theme", theme);
  if (minRating !== undefined && minRating !== null)
    query.set("min_rating", String(minRating));
  if (maxRating !== undefined && maxRating !== null)
    query.set("max_rating", String(maxRating));
  query.set("limit", String(limit));
  query.set("offset", String(offset));

  const res = await api.get(`/api/puzzles?${query.toString()}`, { signal });
  const payload = res?.data || res || {};
  const rawList = Array.isArray(payload.puzzles) ? payload.puzzles : [];
  return rawList
    .map(normalizePuzzleRecommendation)
    .filter(
      (item) => item !== null && Boolean(item.fen) && item.moves.length > 0,
    );
}
