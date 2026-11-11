/**
 * ChessIQ v3.3.0 — Personalized Training Puzzles & Recommendations Route (@DB/@BE)
 * Day 15: Personalized Training Puzzle Generator (v_training_puzzles) (@DB/@FE)
 *
 * Endpoints:
 * - GET  /api/puzzles                 Query puzzle catalog from v_training_puzzles
 * - GET  /api/puzzles/themes          List available 1NF tactical themes
 * - GET  /api/puzzles/personalized    Retrieve personalized puzzles tailored to player weaknesses
 * - GET  /api/puzzles/:id             Retrieve specific puzzle by UUID
 * - POST /api/puzzles/from-blunder    Create 6NF training puzzle from an analyzed in-game blunder
 * - GET  /api/recommendations         Retrieve personalized recommendations (System Design §8.1)
 * - POST /api/recommendations/generate Generate recommendations based on user blunder telemetry
 */

const express = require("express");
const {
  getPuzzleCatalog,
  getPuzzleById,
  getPersonalizedPuzzles,
  createPuzzleFromBlunder,
  generateUserRecommendations,
  getUserRecommendations,
  getPuzzleThemes,
} = require("../db/puzzles");
const { query } = require("../db/pool");
const AppError = require("../utils/AppError");
const logger = require("../utils/logger");

const router = express.Router();

/**
 * Helper to resolve user ID from request session or fallback to first available user
 */
async function resolveUserId(req) {
  if (req.user?.id) return req.user.id;
  if (req.query.user_id) return req.query.user_id;

  // Fallback to first existing user in DB (for dev/demo/test exploration)
  try {
    const res = await query(`SELECT id FROM users LIMIT 1;`);
    return res.rows[0]?.id || "00000000-0000-0000-0000-000000000001";
  } catch (err) {
    return "00000000-0000-0000-0000-000000000001";
  }
}

/**
 * GET /api/puzzles/themes
 * Returns list of available tactical themes from puzzle_theme_types
 */
router.get("/themes", async (req, res, next) => {
  try {
    const themes = await getPuzzleThemes();
    return res.json({
      status: "success",
      data: { themes },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/puzzles/personalized
 * Returns personalized puzzles tailored to player weakness and rating
 */
router.get("/personalized", async (req, res, next) => {
  try {
    const userId = await resolveUserId(req);
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 5));

    const puzzles = await getPersonalizedPuzzles(undefined, userId, limit);
    return res.json({
      status: "success",
      data: {
        user_id: userId,
        puzzles,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/puzzles/from-blunder
 * Extracts a puzzle from an analyzed blunder move in a game
 */
router.post("/from-blunder", async (req, res, next) => {
  try {
    const { analysis_id, ply_number, theme_code = "hangingPiece" } = req.body;

    if (!analysis_id) {
      throw AppError.validationError("analysis_id is required", {
        field: "analysis_id",
      });
    }
    if (!ply_number || typeof ply_number !== "number") {
      throw AppError.validationError(
        "ply_number is required and must be an integer",
        {
          field: "ply_number",
        },
      );
    }

    const puzzleId = await createPuzzleFromBlunder(
      undefined,
      analysis_id,
      ply_number,
      theme_code,
    );
    const puzzle = await getPuzzleById(undefined, puzzleId);

    return res.status(201).json({
      status: "success",
      data: {
        puzzle_id: puzzleId,
        puzzle,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/puzzles
 * Catalog search across v_training_puzzles
 */
router.get("/", async (req, res, next) => {
  try {
    const theme = req.query.theme || null;
    const minRating = parseInt(req.query.min_rating, 10) || 400;
    const maxRating = parseInt(req.query.max_rating, 10) || 3200;
    const limit = Math.min(
      50,
      Math.max(1, parseInt(req.query.limit, 10) || 20),
    );
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);

    const puzzles = await getPuzzleCatalog(undefined, {
      theme,
      minRating,
      maxRating,
      limit,
      offset,
    });

    return res.json({
      status: "success",
      data: {
        puzzles,
        count: puzzles.length,
        filters: { theme, minRating, maxRating, limit, offset },
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/puzzles/:id
 * Retrieve a specific puzzle by UUID
 */
router.get("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const puzzle = await getPuzzleById(undefined, id);

    if (!puzzle) {
      throw AppError.notFound(`Training puzzle not found: ${id}`);
    }

    return res.json({
      status: "success",
      data: { puzzle },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
