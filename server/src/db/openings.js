/**
 * ChessIQ v3.3.0 — Opening Book Catalog & ACPL Aggregation Service (@DB)
 * Day 10 (@DB/@BE): Implements database access and query routines for:
 *
 * 1. Authoritative ECO Opening Matching against v_chess_openings (fn_match_opening_prefix)
 * 2. Per-ply opening book identification (fn_is_book_move)
 * 3. Empirical ACPL computation excluding book moves (§11.5, fn_calculate_game_acpl)
 * 4. Linking game_ecos binary 6NF relations
 */

const logger = require("../utils/logger");

/**
 * Matches a played sequence of SAN moves against the authoritative chess_openings catalog.
 * Resolves the deepest specific ECO opening line.
 *
 * @param {import('pg').Pool | import('pg').PoolClient} pool - Database pool or client
 * @param {string[]} sanMoves - Array of clean SAN moves (e.g. ['e4', 'c5', 'Nf3', 'd6'])
 * @returns {Promise<{ ecoCode: string, name: string, variation: string, pgnMoves: string, matchedPlies: number } | null>}
 */
async function matchOpeningByMoves(pool, sanMoves) {
  if (!Array.isArray(sanMoves) || sanMoves.length === 0) {
    return null;
  }

  try {
    const res = await pool.query(
      `SELECT eco_code, name, variation, pgn_moves, matched_plies
       FROM fn_match_opening_prefix($1::text[]);`,
      [sanMoves],
    );

    if (res.rows.length === 0) {
      return null;
    }

    const row = res.rows[0];
    return {
      ecoCode: row.eco_code,
      name: row.name,
      variation: row.variation,
      pgnMoves: row.pgn_moves,
      matchedPlies: parseInt(row.matched_plies, 10) || 0,
    };
  } catch (err) {
    logger.error({ err: err.message }, "Error matching opening by moves");
    return null;
  }
}

/**
 * Checks whether the moves played so far (up to the current ply) belong to any catalog opening line.
 *
 * @param {import('pg').Pool | import('pg').PoolClient} pool - Database pool or client
 * @param {string[]} sanMovesSoFar - Array of moves from ply 1 to current ply
 * @returns {Promise<boolean>} TRUE if the moves match an authoritative opening line
 */
async function isBookMove(pool, sanMovesSoFar) {
  if (!Array.isArray(sanMovesSoFar) || sanMovesSoFar.length === 0) {
    return false;
  }

  try {
    const res = await pool.query(
      "SELECT fn_is_book_move($1::text[]) AS is_book;",
      [sanMovesSoFar],
    );
    return Boolean(res.rows[0]?.is_book);
  } catch (err) {
    logger.warn({ err: err.message }, "Error checking isBookMove in catalog");
    return false;
  }
}

/**
 * Computes White and Black ACPL directly from v_move_analyses using SQL filters.
 * Excludes opening book moves (is_book_move = TRUE) per FR-07 and §11.5.
 *
 * @param {import('pg').Pool | import('pg').PoolClient} pool - Database pool or client
 * @param {string} analysisId - UUID of the game analysis
 * @param {boolean} [excludeBook=true] - Whether to exclude book moves from ACPL
 * @returns {Promise<{
 *   whiteAcpl: number,
 *   blackAcpl: number,
 *   whiteMovesCounted: number,
 *   blackMovesCounted: number,
 *   whiteBookExcluded: number,
 *   blackBookExcluded: number
 * }>}
 */
async function calculateGameAcpl(pool, analysisId, excludeBook = true) {
  try {
    const res = await pool.query(
      `SELECT
         white_acpl,
         black_acpl,
         white_moves_counted,
         black_moves_counted,
         white_book_excluded,
         black_book_excluded
       FROM fn_calculate_game_acpl($1::uuid, $2::boolean);`,
      [analysisId, excludeBook],
    );

    if (res.rows.length === 0) {
      return {
        whiteAcpl: 0,
        blackAcpl: 0,
        whiteMovesCounted: 0,
        blackMovesCounted: 0,
        whiteBookExcluded: 0,
        blackBookExcluded: 0,
      };
    }

    const row = res.rows[0];
    return {
      whiteAcpl: parseInt(row.white_acpl, 10) || 0,
      blackAcpl: parseInt(row.black_acpl, 10) || 0,
      whiteMovesCounted: parseInt(row.white_moves_counted, 10) || 0,
      blackMovesCounted: parseInt(row.black_moves_counted, 10) || 0,
      whiteBookExcluded: parseInt(row.white_book_excluded, 10) || 0,
      blackBookExcluded: parseInt(row.black_book_excluded, 10) || 0,
    };
  } catch (err) {
    logger.error(
      { err: err.message, analysisId },
      "Error calculating game ACPL via SQL",
    );
    throw err;
  }
}

/**
 * Links a game to an ECO opening code in the 6NF game_ecos relation.
 *
 * @param {import('pg').Pool | import('pg').PoolClient} pool - Database pool or client
 * @param {string} gameId - UUID of the game
 * @param {string} ecoCode - 3-character ECO code (e.g., 'B20')
 */
async function linkGameEco(pool, gameId, ecoCode) {
  if (!gameId || !ecoCode) return;

  try {
    await pool.query(
      `INSERT INTO game_ecos (game_id, eco_code)
       VALUES ($1, $2)
       ON CONFLICT (game_id) DO UPDATE SET eco_code = EXCLUDED.eco_code;`,
      [gameId, ecoCode],
    );
  } catch (err) {
    logger.warn(
      { err: err.message, gameId, ecoCode },
      "Failed to link game_ecos",
    );
  }
}

/**
 * Retrieves the full chess openings catalog from the 3NF view v_chess_openings.
 *
 * @param {import('pg').Pool | import('pg').PoolClient} pool - Database pool or client
 * @returns {Promise<Array<{ ecoCode: string, name: string, variation: string, pgnMoves: string }>>}
 */
async function getOpeningCatalog(pool) {
  const res = await pool.query(
    "SELECT eco_code, name, variation, pgn_moves FROM v_chess_openings ORDER BY eco_code ASC;",
  );
  return res.rows.map((r) => ({
    ecoCode: r.eco_code,
    name: r.name,
    variation: r.variation,
    pgnMoves: r.pgn_moves,
  }));
}

module.exports = {
  matchOpeningByMoves,
  isBookMove,
  calculateGameAcpl,
  linkGameEco,
  getOpeningCatalog,
};
