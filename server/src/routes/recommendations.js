/**
 * ChessIQ v3.3.0 — Training Recommendations API Route (@DB/@BE)
 * Day 15: Personalized Training Puzzle Generator (v_training_puzzles) (@DB/@FE)
 *
 * Implements System Design §8.1:
 * - GET  /api/recommendations           Retrieve personalized puzzle recommendations matching blunder themes
 * - POST /api/recommendations/generate  Force generate fresh recommendations from longitudinal telemetry
 */

const express = require("express");
const {
  getUserRecommendations,
  generateUserRecommendations,
} = require("../db/puzzles");
const { query } = require("../db/pool");
const logger = require("../utils/logger");

const router = express.Router();

/**
 * Helper to resolve user ID from request session or fallback to first available user
 */
async function resolveUserId(req) {
  if (req.user?.id) return req.user.id;
  if (req.query.user_id) return req.query.user_id;

  try {
    const res = await query(`SELECT id FROM users LIMIT 1;`);
    return res.rows[0]?.id || "00000000-0000-0000-0000-000000000001";
  } catch (err) {
    return "00000000-0000-0000-0000-000000000001";
  }
}

/**
 * GET /api/recommendations
 * Retrieves personalized puzzle recommendations matching player blunder themes
 */
router.get("/", async (req, res, next) => {
  try {
    const userId = await resolveUserId(req);
    let recommendations = await getUserRecommendations(undefined, userId);

    // If user has no recommendations yet, automatically generate them
    if (recommendations.length === 0) {
      recommendations = await generateUserRecommendations(undefined, userId, 3);
    }

    return res.json({
      status: "success",
      data: {
        user_id: userId,
        recommendations,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/recommendations/generate
 * Force generation of fresh training recommendations
 */
router.post("/generate", async (req, res, next) => {
  try {
    const userId = await resolveUserId(req);
    const limit = Math.min(10, Math.max(1, parseInt(req.body.limit, 10) || 3));

    const recommendations = await generateUserRecommendations(
      undefined,
      userId,
      limit,
    );

    return res.status(201).json({
      status: "success",
      data: {
        user_id: userId,
        recommendations,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
