/**
 * ChessIQ v3.3.0 — Chess Openings Catalog API Route
 * Day 10 (@BE): Provides endpoints to query opening book catalog,
 * match move sequences against canonical ECO lines, and inspect book plies.
 */

const express = require("express");
const { openingCatalog, normalizeSanMoves } = require("../services/openingCatalog");
const { pool } = require("../db/pool");
const AppError = require("../utils/AppError");

const router = express.Router();

/**
 * GET /api/openings
 * Returns all catalog openings (from 3NF view v_chess_openings if DB available,
 * falling back to in-memory opening catalog).
 */
router.get("/", async (req, res, next) => {
  try {
    const { search, eco } = req.query;

    let openings = [];
    try {
      let queryText = "SELECT eco_code, name, variation, pgn_moves FROM v_chess_openings";
      const params = [];

      if (eco) {
        queryText += " WHERE eco_code = $1";
        params.push(eco.toUpperCase());
      } else if (search) {
        queryText += " WHERE name ILIKE $1 OR variation ILIKE $1 OR eco_code ILIKE $1";
        params.push(`%${search}%`);
      }

      queryText += " ORDER BY eco_code ASC;";
      const result = await pool.query(queryText, params);
      openings = result.rows.map((r) => ({
        ecoCode: r.eco_code,
        name: r.name,
        variation: r.variation,
        pgnMoves: r.pg_moves || r.pgn_moves,
      }));
    } catch (_) {
      // Fallback to in-memory catalog
      openings = openingCatalog.getAllOpenings();
      if (eco) {
        openings = openings.filter((o) => o.ecoCode === eco.toUpperCase());
      } else if (search) {
        const s = search.toLowerCase();
        openings = openings.filter(
          (o) =>
            o.name.toLowerCase().includes(s) ||
            (o.variation && o.variation.toLowerCase().includes(s)) ||
            o.ecoCode.toLowerCase().includes(s),
        );
      }
    }

    return res.status(200).json({
      status: "success",
      total: openings.length,
      data: openings,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/openings/:eco
 * Returns a single opening by its 3-character ECO code.
 */
router.get("/:eco", async (req, res, next) => {
  try {
    const ecoCode = req.params.eco.toUpperCase();
    let opening = null;

    try {
      const result = await pool.query(
        "SELECT eco_code, name, variation, pgn_moves FROM v_chess_openings WHERE eco_code = $1;",
        [ecoCode],
      );
      if (result.rows.length > 0) {
        const r = result.rows[0];
        opening = {
          ecoCode: r.eco_code,
          name: r.name,
          variation: r.variation,
          pgnMoves: r.pgn_moves,
        };
      }
    } catch (_) {
      opening = openingCatalog.getOpeningByEco(ecoCode);
    }

    if (!opening) {
      opening = openingCatalog.getOpeningByEco(ecoCode);
    }

    if (!opening) {
      throw AppError.notFound(`Opening with ECO code ${ecoCode} not found.`);
    }

    return res.status(200).json({
      status: "success",
      data: opening,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/openings/match
 * Matches a move sequence against the authoritative catalog.
 * Accepts { moves: ["e4", "c5", "Nf3"] } or { pgn: "1. e4 c5 2. Nf3 d6" }.
 */
router.post("/match", async (req, res, next) => {
  try {
    const { moves, pgn } = req.body;
    const moveInput = moves || pgn;

    if (!moveInput) {
      throw AppError.validationError("Please provide 'moves' (array or string) or 'pgn' text.");
    }

    const matched = openingCatalog.match(moveInput);

    return res.status(200).json({
      status: "success",
      data: matched,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

