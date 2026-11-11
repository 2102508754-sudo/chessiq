/**
 * ChessIQ v3.3.0 — Authoritative Opening Book Catalog & Verification Service
 * Day 10 (@DB / @BE): Implements prefix-tree opening book verification,
 * dynamic ECO classification, and strict ACPL book move exclusions (§11.5).
 */

const logger = require("../utils/logger");

/**
 * Standard seed dataset of canonical ECO openings.
 * Synchronized with db/migrations/005_seed_chess_openings_catalog.sql.
 */
const DEFAULT_OPENINGS_CATALOG = [
  // ECO A: Flank Openings & Queen's Pawn Irregular
  { ecoCode: "A00", name: "Polish Opening", variation: null, pgnMoves: "1. b4" },
  { ecoCode: "A04", name: "Réti Opening", variation: null, pgnMoves: "1. Nf3" },
  { ecoCode: "A10", name: "English Opening", variation: null, pgnMoves: "1. c4" },
  { ecoCode: "A20", name: "English Opening", variation: "King's English Variation", pgnMoves: "1. c4 e5" },
  { ecoCode: "A40", name: "Queen's Pawn Game", variation: null, pgnMoves: "1. d4" },
  { ecoCode: "A45", name: "Trompowsky Attack", variation: null, pgnMoves: "1. d4 Nf6 2. Bg5" },
  { ecoCode: "A51", name: "Budapest Gambit", variation: null, pgnMoves: "1. d4 Nf6 2. c4 e5" },
  { ecoCode: "A80", name: "Dutch Defense", variation: null, pgnMoves: "1. d4 f5" },

  // ECO B: Semi-Open Games
  { ecoCode: "B00", name: "King's Pawn Opening", variation: null, pgnMoves: "1. e4" },
  { ecoCode: "B01", name: "Scandinavian Defense", variation: null, pgnMoves: "1. e4 d5" },
  { ecoCode: "B02", name: "Alekhine's Defense", variation: null, pgnMoves: "1. e4 Nf6" },
  { ecoCode: "B07", name: "Pirc Defense", variation: null, pgnMoves: "1. e4 d6 2. d4 Nf6 3. Nc3 g6" },
  { ecoCode: "B10", name: "Caro-Kann Defense", variation: null, pgnMoves: "1. e4 c6" },
  { ecoCode: "B12", name: "Caro-Kann Defense", variation: "Advance Variation", pgnMoves: "1. e4 c6 2. d4 d5 3. e5" },
  { ecoCode: "B13", name: "Caro-Kann Defense", variation: "Exchange Variation", pgnMoves: "1. e4 c6 2. d4 d5 3. exd5 cxd5" },
  { ecoCode: "B14", name: "Caro-Kann Defense", variation: "Panov-Botvinnik Attack", pgnMoves: "1. e4 c6 2. d4 d5 3. exd5 cxd5 4. c4" },
  { ecoCode: "B18", name: "Caro-Kann Defense", variation: "Classical Variation", pgnMoves: "1. e4 c6 2. d4 d5 3. Nc3 dxe4 4. Nxe4 Bf5" },
  { ecoCode: "B20", name: "Sicilian Defense", variation: null, pgnMoves: "1. e4 c5" },
  { ecoCode: "B21", name: "Sicilian Defense", variation: "Smith-Morra Gambit", pgnMoves: "1. e4 c5 2. d4 cxd4 3. c3" },
  { ecoCode: "B22", name: "Sicilian Defense", variation: "Alapin Variation", pgnMoves: "1. e4 c5 2. c3" },
  { ecoCode: "B23", name: "Sicilian Defense", variation: "Closed", pgnMoves: "1. e4 c5 2. Nc3" },
  { ecoCode: "B30", name: "Sicilian Defense", variation: "Old Sicilian", pgnMoves: "1. e4 c5 2. Nf3 Nc6" },
  { ecoCode: "B33", name: "Sicilian Defense", variation: "Sveshnikov Variation", pgnMoves: "1. e4 c5 2. Nf3 Nc6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 e5" },
  { ecoCode: "B50", name: "Sicilian Defense", variation: "Modern Variations", pgnMoves: "1. e4 c5 2. Nf3 d6" },
  { ecoCode: "B51", name: "Sicilian Defense", variation: "Moscow Variation", pgnMoves: "1. e4 c5 2. Nf3 d6 3. Bb5+" },
  { ecoCode: "B70", name: "Sicilian Defense", variation: "Dragon Variation", pgnMoves: "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 g6" },
  { ecoCode: "B90", name: "Sicilian Defense", variation: "Najdorf Variation", pgnMoves: "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6" },

  // ECO C: Open Games & French Defense
  { ecoCode: "C00", name: "French Defense", variation: null, pgnMoves: "1. e4 e6" },
  { ecoCode: "C01", name: "French Defense", variation: "Exchange Variation", pgnMoves: "1. e4 e6 2. d4 d5 3. exd5 exd5" },
  { ecoCode: "C02", name: "French Defense", variation: "Advance Variation", pgnMoves: "1. e4 e6 2. d4 d5 3. e5" },
  { ecoCode: "C10", name: "French Defense", variation: "Paulsen Variation", pgnMoves: "1. e4 e6 2. d4 d5 3. Nc3" },
  { ecoCode: "C11", name: "French Defense", variation: "Classical Variation", pgnMoves: "1. e4 e6 2. d4 d5 3. Nc3 Nf6" },
  { ecoCode: "C15", name: "French Defense", variation: "Winawer Variation", pgnMoves: "1. e4 e6 2. d4 d5 3. Nc3 Bb4" },
  { ecoCode: "C20", name: "King's Pawn Game", variation: null, pgnMoves: "1. e4 e5" },
  { ecoCode: "C23", name: "Bishop's Opening", variation: null, pgnMoves: "1. e4 e5 2. Bc4" },
  { ecoCode: "C25", name: "Vienna Game", variation: null, pgnMoves: "1. e4 e5 2. Nc3" },
  { ecoCode: "C30", name: "King's Gambit", variation: null, pgnMoves: "1. e4 e5 2. f4" },
  { ecoCode: "C40", name: "King's Knight Opening", variation: null, pgnMoves: "1. e4 e5 2. Nf3" },
  { ecoCode: "C41", name: "Philidor Defense", variation: null, pgnMoves: "1. e4 e5 2. Nf3 d6" },
  { ecoCode: "C42", name: "Petrov's Defense", variation: null, pgnMoves: "1. e4 e5 2. Nf3 Nf6" },
  { ecoCode: "C44", name: "Scotch Opening", variation: null, pgnMoves: "1. e4 e5 2. Nf3 Nc6 3. d4" },
  { ecoCode: "C45", name: "Scotch Game", variation: null, pgnMoves: "1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. Nxd4" },
  { ecoCode: "C46", name: "Three Knights Game", variation: null, pgnMoves: "1. e4 e5 2. Nf3 Nc6 3. Nc3" },
  { ecoCode: "C47", name: "Four Knights Game", variation: null, pgnMoves: "1. e4 e5 2. Nf3 Nc6 3. Nc3 Nf6" },
  { ecoCode: "C50", name: "Italian Game", variation: null, pgnMoves: "1. e4 e5 2. Nf3 Nc6 3. Bc4" },
  { ecoCode: "C51", name: "Italian Game", variation: "Evans Gambit", pgnMoves: "1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. b4" },
  { ecoCode: "C53", name: "Italian Game", variation: "Giuoco Pianissimo", pgnMoves: "1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d3" },
  { ecoCode: "C55", name: "Two Knights Defense", variation: null, pgnMoves: "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6" },
  { ecoCode: "C60", name: "Ruy Lopez", variation: null, pgnMoves: "1. e4 e5 2. Nf3 Nc6 3. Bb5" },
  { ecoCode: "C65", name: "Ruy Lopez", variation: "Berlin Defense", pgnMoves: "1. e4 e5 2. Nf3 Nc6 3. Bb5 Nf6" },
  { ecoCode: "C68", name: "Ruy Lopez", variation: "Exchange Variation", pgnMoves: "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Bxc6 dxc6" },
  { ecoCode: "C70", name: "Ruy Lopez", variation: "Morphy Defense", pgnMoves: "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4" },
  { ecoCode: "C78", name: "Ruy Lopez", variation: "Archangelsk Variation", pgnMoves: "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O b5 6. Bb3 Bb7" },
  { ecoCode: "C80", name: "Ruy Lopez", variation: "Open Variation", pgnMoves: "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Nxe4" },
  { ecoCode: "C88", name: "Ruy Lopez", variation: "Closed Variation", pgnMoves: "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O" },

  // ECO D: Closed Games
  { ecoCode: "D00", name: "Queen's Pawn Game", variation: null, pgnMoves: "1. d4 d5" },
  { ecoCode: "D02", name: "Queen's Pawn Game", variation: "London System", pgnMoves: "1. d4 d5 2. Nf3 Nf6 3. Bf4" },
  { ecoCode: "D06", name: "Queen's Gambit", variation: null, pgnMoves: "1. d4 d5 2. c4" },
  { ecoCode: "D10", name: "Slav Defense", variation: null, pgnMoves: "1. d4 d5 2. c4 c6" },
  { ecoCode: "D20", name: "Queen's Gambit Accepted", variation: null, pgnMoves: "1. d4 d5 2. c4 dxc4" },
  { ecoCode: "D30", name: "Queen's Gambit Declined", variation: null, pgnMoves: "1. d4 d5 2. c4 e6" },
  { ecoCode: "D35", name: "Queen's Gambit Declined", variation: "Exchange Variation", pgnMoves: "1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. cxd5 exd5" },
  { ecoCode: "D50", name: "Queen's Gambit Declined", variation: "4. Bg5", pgnMoves: "1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. Bg5" },
  { ecoCode: "D80", name: "Grünfeld Defense", variation: null, pgnMoves: "1. d4 Nf6 2. c4 g6 3. Nc3 d5" },
  { ecoCode: "D85", name: "Grünfeld Defense", variation: "Exchange Variation", pgnMoves: "1. d4 Nf6 2. c4 g6 3. Nc3 d5 4. cxd5 Nxd5 5. e4 Nxc3 6. bxc3 Bg7" },

  // ECO E: Indian Defenses
  { ecoCode: "E00", name: "Catalan Opening", variation: null, pgnMoves: "1. d4 Nf6 2. c4 e6 3. g3" },
  { ecoCode: "E12", name: "Queen's Indian Defense", variation: null, pgnMoves: "1. d4 Nf6 2. c4 e6 3. Nf3 b6" },
  { ecoCode: "E20", name: "Nimzo-Indian Defense", variation: null, pgnMoves: "1. d4 Nf6 2. c4 e6 3. Nc3 Bb4" },
  { ecoCode: "E32", name: "Nimzo-Indian Defense", variation: "Classical Variation", pgnMoves: "1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. Qc2" },
  { ecoCode: "E60", name: "King's Indian Defense", variation: null, pgnMoves: "1. d4 Nf6 2. c4 g6" },
  { ecoCode: "E70", name: "King's Indian Defense", variation: "Classical Variation", pgnMoves: "1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. Nf3 O-O 6. Be2 e5" },
];

/**
 * Normalizes any move sequence representation (array or string) into
 * a clean array of SAN moves.
 *
 * Examples:
 *   "1. e4 c5 2. Nf3 d6" -> ["e4", "c5", "Nf3", "d6"]
 *   "e4 c5 Nf3 d6"       -> ["e4", "c5", "Nf3", "d6"]
 *   ["e4", "c5", "Nf3"]  -> ["e4", "c5", "Nf3"]
 *
 * @param {string | string[]} input - PGN move string or array
 * @returns {string[]} Clean SAN moves
 */
function normalizeSanMoves(input) {
  if (Array.isArray(input)) {
    return input.map((m) => cleanSanToken(m)).filter(Boolean);
  }

  if (typeof input !== "string" || input.trim().length === 0) {
    return [];
  }

  // Remove move numbers like "1.", "2...", comments, and result notations
  const sanitized = input
    .replace(/\{[^}]*\}/g, "") // remove comments
    .replace(/\([^)]*\)/g, "") // remove variations
    .replace(/\$[0-9]+/g, "")   // remove NAGs
    .replace(/[0-9]+\.\.\./g, "")
    .replace(/[0-9]+\./g, "")
    .replace(/1-0|0-1|1\/2-1\/2|\*/g, "");

  return sanitized
    .trim()
    .split(/\s+/)
    .map(cleanSanToken)
    .filter(Boolean);
}

/**
 * Removes extraneous punctuation but preserves standard SAN pieces, files, and checks (+, #).
 */
function cleanSanToken(token) {
  if (!token) return "";
  return token.replace(/[!?]/g, "").trim();
}

/**
 * Prefix Tree (Trie) Node for Opening Hierarchy
 */
class OpeningTrieNode {
  constructor() {
    /** @type {Map<string, OpeningTrieNode>} */
    this.children = new Map();
    /** @type {Object|null} */
    this.opening = null;
  }
}

/**
 * OpeningCatalog manages opening book lookup, longest-prefix matching,
 * and book move classification.
 */
class OpeningCatalog {
  constructor(initialData = DEFAULT_OPENINGS_CATALOG) {
    this._root = new OpeningTrieNode();
    this._openingsByEco = new Map();
    this._totalOpenings = 0;

    this.initialize(initialData);
  }

  /**
   * Initializes the Trie from a list of opening records.
   * @param {Array<Object>} openings
   */
  initialize(openings) {
    this._root = new OpeningTrieNode();
    this._openingsByEco.clear();
    this._totalOpenings = 0;

    for (const op of openings) {
      this.addOpening(op);
    }

    logger.debug(
      { totalOpenings: this._totalOpenings },
      "OpeningCatalog initialized with ECO lines",
    );
  }

  /**
   * Inserts an opening record into the Trie and lookup map.
   * @param {Object} opening
   */
  addOpening(opening) {
    const { ecoCode, name, variation, pgnMoves } = opening;
    const moves = normalizeSanMoves(pgnMoves);

    if (moves.length === 0) return;

    let current = this._root;
    for (const move of moves) {
      if (!current.children.has(move)) {
        current.children.set(move, new OpeningTrieNode());
      }
      current = current.children.get(move);
    }

    const entry = {
      ecoCode,
      name,
      variation: variation || null,
      pgnMoves,
      plyCount: moves.length,
      moves,
    };

    current.opening = entry;
    this._openingsByEco.set(ecoCode, entry);
    this._totalOpenings++;
  }

  /**
   * Loads or refreshes openings from PostgreSQL v_chess_openings view.
   * @param {import('pg').Pool | import('pg').PoolClient} pool
   */
  async loadFromDatabase(pool) {
    try {
      const res = await pool.query(
        "SELECT eco_code, name, variation, pgn_moves FROM v_chess_openings ORDER BY eco_code ASC;",
      );

      if (res.rows.length > 0) {
        const dbOpenings = res.rows.map((r) => ({
          ecoCode: r.eco_code,
          name: r.name,
          variation: r.variation,
          pgnMoves: r.pgn_moves,
        }));
        this.initialize(dbOpenings);
        logger.info(
          { count: dbOpenings.length },
          "OpeningCatalog reloaded from database v_chess_openings",
        );
      }
    } catch (err) {
      logger.warn(
        { err: err.message },
        "Could not load openings from database. Continuing with default static catalog.",
      );
    }
  }

  /**
   * Authoritative Opening Book Matcher (§11.5).
   *
   * Finds the longest matching opening line in the catalog for the played moves.
   * Plies 1..K matching a catalog line have isBookMove = true.
   * Once a move deviates from the catalog book lines, that move and all subsequent
   * moves have isBookMove = false.
   *
   * @param {string | string[]} gameMoves - SAN moves sequence
   * @returns {{
   *   matchedOpening: Object | null,
   *   bookPlies: number,
   *   isBookMoveForPly: (plyNumber: number) => boolean,
   *   annotatedMoves: Array<{ plyNumber: number, moveSan: string, isBookMove: boolean }>
   * }}
   */
  match(gameMoves) {
    const moves = normalizeSanMoves(gameMoves);
    let current = this._root;
    let bookPlies = 0;
    let deepestOpening = null;

    for (let i = 0; i < moves.length; i++) {
      const move = moves[i];
      if (current.children.has(move)) {
        current = current.children.get(move);
        bookPlies = i + 1;
        if (current.opening) {
          deepestOpening = current.opening;
        }
      } else {
        // Player deviated from opening book
        break;
      }
    }

    const annotatedMoves = moves.map((moveSan, idx) => ({
      plyNumber: idx + 1,
      moveSan,
      isBookMove: idx + 1 <= bookPlies,
    }));

    return {
      matchedOpening: deepestOpening,
      bookPlies,
      isBookMoveForPly: (plyNumber) => plyNumber >= 1 && plyNumber <= bookPlies,
      annotatedMoves,
    };
  }

  /**
   * Retrieves an opening by its ECO code.
   * @param {string} ecoCode
   * @returns {Object|null}
   */
  getOpeningByEco(ecoCode) {
    return this._openingsByEco.get(ecoCode) || null;
  }

  /**
   * Returns all loaded openings.
   * @returns {Array<Object>}
   */
  getAllOpenings() {
    return Array.from(this._openingsByEco.values());
  }

  get totalOpenings() {
    return this._totalOpenings;
  }
}

// Global singleton instance initialized with the standard ECO catalog
const openingCatalog = new OpeningCatalog();

module.exports = {
  OpeningCatalog,
  openingCatalog,
  normalizeSanMoves,
  DEFAULT_OPENINGS_CATALOG,
};

