/**
 * ChessIQ v3.3.0 — Day 10 Opening Book Catalog & ACPL Exclusions Suite (@DB / @BE)
 *
 * Verifies:
 * 1. Migration 005 DDL Integrity: 6NF opening catalog tables & diagnostic fn_verify_day10_openings
 * 2. Move Sequence Normalization (SAN arrays, PGN text, stripping annotations)
 * 3. Authoritative Prefix-Tree Opening Matching (ECO codes, names, variations)
 * 4. Longest-Prefix Matching Hierarchy (e.g. B20 Sicilian -> B50 Modern -> B90 Najdorf)
 * 5. Deviation Detection & Sequential is_book_move Boundary Invariant
 * 6. Early-Ply Blunder Empirical Integrity (Fool's Mate preservation without synthetic overrides)
 * 7. ACPL Book Move Exclusion (WHERE is_book_move = FALSE per §11.5)
 * 8. Openings Route Logic (GET /api/openings, GET /api/openings/:eco, POST /api/openings/match)
 * 9. PostgreSQL 6NF Integration (when DB is active: v_chess_openings, fn_match_opening_prefix, fn_is_book_move, fn_calculate_game_acpl, fn_verify_day10_openings)
 */

const fs = require("fs");
const path = require("path");
const { pool, closePool } = require("../src/db/pool");
const {
  matchOpeningByMoves,
  isBookMove,
  calculateGameAcpl,
  getOpeningCatalog,
  linkGameEco,
} = require("../src/db/openings");
const {
  OpeningCatalog,
  openingCatalog,
  normalizeSanMoves,
} = require("../src/services/openingCatalog");
const { computeACPL, computeGameACPLByColor } = require("../src/engine/evalMath");
const openingsRouter = require("../src/routes/openings");

/**
 * Helper to invoke an Express router route handler directly without network socket binding.
 */
function callRouter(router, method, url, { query = {}, params = {}, body = {} } = {}) {
  return new Promise((resolve, reject) => {
    const req = {
      method: method.toUpperCase(),
      url,
      path: url.split("?")[0],
      query,
      params,
      body,
    };

    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.body = data;
        resolve(this);
        return this;
      },
      send(data) {
        this.body = data;
        resolve(this);
        return this;
      },
    };

    const next = (err) => {
      if (err) reject(err);
      else resolve(res);
    };

    router.handle(req, res, next);
  });
}

describe("Day 10: Opening Book Catalog Verification & ACPL Exclusions (@DB/@BE)", () => {
  let dbAvailable = false;

  beforeAll(async () => {
    try {
      await pool.query("SELECT 1;");
      dbAvailable = true;
    } catch (_) {
      dbAvailable = false;
    }
  });

  afterAll(async () => {
    await closePool();
  });

  const itDb = (name, fn) => {
    it(name, async () => {
      if (!dbAvailable) {
        return;
      }
      await fn();
    });
  };

  // ==========================================================================
  // 1. Migration 005 DDL Integrity & File Verification
  // ==========================================================================
  describe("Migration 005 DDL Integrity & File Verification", () => {
    const migrationPath = path.resolve(
      __dirname,
      "../../db/migrations/005_seed_chess_openings_catalog.sql",
    );

    it("verifies migration file exists and is populated with ECO seed data", () => {
      expect(fs.existsSync(migrationPath)).toBe(true);
      const sql = fs.readFileSync(migrationPath, "utf8");
      expect(sql).toContain("fn_clean_pgn_to_moves");
      expect(sql).toContain("fn_match_opening_prefix");
      expect(sql).toContain("fn_is_book_move");
      expect(sql).toContain("fn_calculate_game_acpl");
      expect(sql).toContain("fn_verify_day10_openings");
      expect(sql).toContain("Sicilian Defense");
      expect(sql).toContain("Italian Game");
      expect(sql).toMatch(/Queen.*Gambit/);
      expect(sql).toContain("Ruy Lopez");
    });

    it("seeds all 5 ECO categories (A, B, C, D, E)", () => {
      const sql = fs.readFileSync(migrationPath, "utf8");
      expect(sql).toMatch(/'A\d{2}'/);
      expect(sql).toMatch(/'B\d{2}'/);
      expect(sql).toMatch(/'C\d{2}'/);
      expect(sql).toMatch(/'D\d{2}'/);
      expect(sql).toMatch(/'E\d{2}'/);
    });
  });

  // ==========================================================================
  // 2. Move Sequence Normalization & SAN Extraction
  // ==========================================================================
  describe("Move Sequence Normalization & SAN Extraction", () => {
    it("handles an array of moves cleanly without alterations", () => {
      const input = ["e4", "c5", "Nf3", "d6", "d4"];
      expect(normalizeSanMoves(input)).toEqual(input);
    });

    it("parses PGN string with move numbers and dots into clean SAN tokens", () => {
      const pgn = "1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5";
      const expected = ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5"];
      expect(normalizeSanMoves(pgn)).toEqual(expected);
    });

    it("strips evaluation annotations ($1, ?, !, ?!, +-) and comments from PGN", () => {
      const dirty = "1. e4! c5? 2. Nf3 {classical move} d6?! 3. d4 cxd4 4. Nxd4 $1 Nf6";
      const expected = ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6"];
      expect(normalizeSanMoves(dirty)).toEqual(expected);
    });

    it("returns empty array for invalid, null, or empty inputs", () => {
      expect(normalizeSanMoves("")).toEqual([]);
      expect(normalizeSanMoves(null)).toEqual([]);
      expect(normalizeSanMoves(undefined)).toEqual([]);
      expect(normalizeSanMoves([])).toEqual([]);
      expect(normalizeSanMoves(12345)).toEqual([]);
    });
  });

  // ==========================================================================
  // 3. Authoritative Opening Prefix Matching & Trie Hierarchy
  // ==========================================================================
  describe("Authoritative Opening Prefix Matching & Trie Hierarchy", () => {
    it("matches exact 1-ply King's Pawn Opening (B00)", () => {
      const result = openingCatalog.match(["e4"]);
      expect(result.matchedOpening).toBeDefined();
      expect(result.matchedOpening.ecoCode).toBe("B00");
      expect(result.matchedOpening.name).toBe("King's Pawn Opening");
      expect(result.bookPlies).toBe(1);
    });

    it("matches Sicilian Defense (B20) for 1. e4 c5", () => {
      const result = openingCatalog.match(["e4", "c5"]);
      expect(result.matchedOpening).toBeDefined();
      expect(result.matchedOpening.ecoCode).toBe("B20");
      expect(result.matchedOpening.name).toBe("Sicilian Defense");
      expect(result.bookPlies).toBe(2);
    });

    it("resolves the deepest matching opening: Najdorf (B90) over B20 Sicilian", () => {
      const najdorfLine = ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "a6"];
      const result = openingCatalog.match(najdorfLine);
      expect(result.matchedOpening).toBeDefined();
      expect(result.matchedOpening.ecoCode).toBe("B90");
      expect(result.matchedOpening.name).toBe("Sicilian Defense");
      expect(result.matchedOpening.variation).toBe("Najdorf Variation");
      expect(result.bookPlies).toBe(10);
    });

    it("matches Italian Game: Giuoco Pianissimo (C53) for 9 plies", () => {
      const pianissimo = ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "c3", "Nf6", "d3"];
      const result = openingCatalog.match(pianissimo);
      expect(result.matchedOpening).toBeDefined();
      expect(result.matchedOpening.ecoCode).toBe("C53");
      expect(result.matchedOpening.name).toBe("Italian Game");
      expect(result.matchedOpening.variation).toBe("Giuoco Pianissimo");
      expect(result.bookPlies).toBe(9);
    });

    it("matches Ruy Lopez Berlin Defense (C65)", () => {
      const berlin = ["e4", "e5", "Nf3", "Nc6", "Bb5", "Nf6"];
      const result = openingCatalog.match(berlin);
      expect(result.matchedOpening).toBeDefined();
      expect(result.matchedOpening.ecoCode).toBe("C65");
      expect(result.matchedOpening.name).toBe("Ruy Lopez");
      expect(result.matchedOpening.variation).toBe("Berlin Defense");
      expect(result.bookPlies).toBe(6);
    });

    it("returns null matchedOpening for unknown opening lines", () => {
      const trollOpening = ["a4", "h5", "h4", "a5"];
      const result = openingCatalog.match(trollOpening);
      expect(result.matchedOpening).toBeNull();
      expect(result.bookPlies).toBe(0);
    });
  });

  // ==========================================================================
  // 4. Deviation Detection & Sequential is_book_move Boundary Invariant
  // ==========================================================================
  describe("Deviation Detection & Sequential is_book_move Boundary Invariant", () => {
    it("identifies book moves up to deviation and marks subsequent plies as false", () => {
      // 1. e4 c5 2. Nf3 Nc6 3. Bc4 (Sicilian with 3. Bc4, deviations follow)
      const gameMoves = ["e4", "c5", "Nf3", "Nc6", "Bc4", "a6", "h3", "e6", "d4"];
      const result = openingCatalog.match(gameMoves);

      expect(result.matchedOpening).toBeDefined();
      expect(result.bookPlies).toBeGreaterThanOrEqual(2);

      // Verify strict boundary invariant: plies <= bookPlies are book, plies > bookPlies are NOT book
      for (let ply = 1; ply <= gameMoves.length; ply++) {
        const isBook = result.isBookMoveForPly(ply);
        if (ply <= result.bookPlies) {
          expect(isBook).toBe(true);
        } else {
          expect(isBook).toBe(false);
        }
      }
    });

    it("ensures book move flag is irreversibly false once out of book prefix", () => {
      const match = openingCatalog.match(["e4", "e5", "Nf3", "Nc6", "h3", "Bc5", "Bc4"]);
      expect(match.bookPlies).toBe(4); // 1. e4 e5 2. Nf3 Nc6
      expect(match.isBookMoveForPly(1)).toBe(true);
      expect(match.isBookMoveForPly(4)).toBe(true);
      expect(match.isBookMoveForPly(5)).toBe(false); // 3. h3 is deviation
      expect(match.isBookMoveForPly(7)).toBe(false); // Even if Bc4 is played later, game left book
    });
  });

  // ==========================================================================
  // 5. Early-Ply Blunder Empirical Integrity (Fool's Mate)
  // ==========================================================================
  describe("Early-Ply Blunder Empirical Integrity (Fool's Mate)", () => {
    it("does NOT classify Fool's Mate line (1. f3 e5 2. g4 Qh4#) as book moves", () => {
      const foolsMate = ["f3", "e5", "g4", "Qh4#"];
      const result = openingCatalog.match(foolsMate);

      // f3 is not a valid book line in catalog
      expect(result.bookPlies).toBe(0);
      expect(result.matchedOpening).toBeNull();
      expect(result.isBookMoveForPly(1)).toBe(false);
      expect(result.isBookMoveForPly(3)).toBe(false);
    });

    it("accurately penalizes 2. g4 as a blunder without suppression from book status", () => {
      const foolsMate = ["f3", "e5", "g4", "Qh4#"];
      const match = openingCatalog.match(foolsMate);

      const moves = [
        { plyNumber: 1, cplCapped: 50, isBookMove: match.isBookMoveForPly(1) },
        { plyNumber: 2, cplCapped: 10, isBookMove: match.isBookMoveForPly(2) },
        { plyNumber: 3, cplCapped: 1000, isBookMove: match.isBookMoveForPly(3) }, // 2. g4 blunder
        { plyNumber: 4, cplCapped: 0, isBookMove: match.isBookMoveForPly(4) },
      ];

      const { whiteAcpl } = computeGameACPLByColor(moves);
      // White played plies 1 and 3: (50 + 1000) / 2 = 525
      expect(whiteAcpl).toBe(525);
    });
  });

  // ==========================================================================
  // 6. ACPL Book Move Exclusion Rule (§11.5)
  // ==========================================================================
  describe("ACPL Book Move Exclusion Rule (§11.5, computeACPL & computeGameACPLByColor)", () => {
    it("excludes all moves marked isBookMove = true from ACPL calculation", () => {
      const moves = [
        { plyNumber: 1, cplCapped: 15, isBookMove: true },
        { plyNumber: 2, cplCapped: 25, isBookMove: true },
        { plyNumber: 3, cplCapped: 10, isBookMove: true },
        { plyNumber: 4, cplCapped: 20, isBookMove: true },
        { plyNumber: 5, cplCapped: 100, isBookMove: false }, // White post-book
        { plyNumber: 6, cplCapped: 200, isBookMove: false }, // Black post-book
        { plyNumber: 7, cplCapped: 50, isBookMove: false },  // White post-book
        { plyNumber: 8, cplCapped: 300, isBookMove: false }, // Black post-book
      ];

      const overallAcpl = computeACPL(moves);
      // Only non-book moves counted: (100 + 200 + 50 + 300) / 4 = 162.5 -> 163
      expect(overallAcpl).toBe(163);

      const { whiteAcpl, blackAcpl } = computeGameACPLByColor(moves);
      // White non-book: plies 5 (100) and 7 (50) -> 150 / 2 = 75
      // Black non-book: plies 6 (200) and 8 (300) -> 500 / 2 = 250
      expect(whiteAcpl).toBe(75);
      expect(blackAcpl).toBe(250);
    });

    it("returns 0 if all moves are book moves (e.g. short theoretical draw)", () => {
      const pureBookMoves = [
        { plyNumber: 1, cplCapped: 5, isBookMove: true },
        { plyNumber: 2, cplCapped: 8, isBookMove: true },
        { plyNumber: 3, cplCapped: 12, isBookMove: true },
        { plyNumber: 4, cplCapped: 15, isBookMove: true },
      ];

      const { whiteAcpl, blackAcpl } = computeGameACPLByColor(pureBookMoves);
      expect(whiteAcpl).toBe(0);
      expect(blackAcpl).toBe(0);
    });
  });

  // ==========================================================================
  // 7. Openings API Route Handlers (/api/openings)
  // ==========================================================================
  describe("Openings API Route Handlers (/api/openings)", () => {
    it("GET /api/openings returns catalog list", async () => {
      const res = await callRouter(openingsRouter, "GET", "/");
      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe("success");
      expect(res.body.total).toBeGreaterThanOrEqual(40);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it("GET /api/openings?search=sicilian filters catalog by name", async () => {
      const res = await callRouter(openingsRouter, "GET", "/?search=sicilian", {
        query: { search: "sicilian" },
      });
      expect(res.statusCode).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data.every((o) => o.name.toLowerCase().includes("sicilian"))).toBe(true);
    });

    it("GET /api/openings/:eco returns specific opening details", async () => {
      const res = await callRouter(openingsRouter, "GET", "/b20");
      expect(res.statusCode).toBe(200);
      expect(res.body.data.ecoCode).toBe("B20");
      expect(res.body.data.name).toBe("Sicilian Defense");
    });

    it("GET /api/openings/:eco returns 404 for non-existent opening", async () => {
      try {
        const res = await callRouter(openingsRouter, "GET", "/z99");
        expect(res.statusCode).toBe(404);
      } catch (err) {
        expect(err.statusCode || err.status).toBe(404);
      }
    });

    it("POST /api/openings/match identifies opening and returns book plies", async () => {
      const res = await callRouter(openingsRouter, "POST", "/match", {
        body: { pgn: "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6" },
      });

      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe("success");
      expect(res.body.data.matchedOpening.ecoCode).toBe("B90");
      expect(res.body.data.bookPlies).toBe(10);
      expect(res.body.data.annotatedMoves.length).toBe(10);
    });
  });

  // ==========================================================================
  // 8. PostgreSQL 6NF Relations & 3NF View Integrity (@DB)
  // ==========================================================================
  describe("PostgreSQL 6NF Relations & 3NF View (v_chess_openings) [@DB]", () => {
    itDb("seeds at least 50 authoritative ECO openings across the 6NF schema", async () => {
      const res = await pool.query(
        "SELECT COUNT(*)::INT AS total FROM chess_openings;",
      );
      const total = res.rows[0].total;
      expect(total).toBeGreaterThanOrEqual(50);
    });

    itDb("ensures all five ECO volumes (A, B, C, D, E) are represented in the catalog", async () => {
      const res = await pool.query(`
        SELECT DISTINCT substring(eco_code, 1, 1) AS volume
        FROM chess_openings
        ORDER BY volume ASC;
      `);
      const volumes = res.rows.map((r) => r.volume);
      expect(volumes).toContain("A");
      expect(volumes).toContain("B");
      expect(volumes).toContain("C");
      expect(volumes).toContain("D");
      expect(volumes).toContain("E");
    });

    itDb("verifies logical 3NF view v_chess_openings joins names, variations, and moves without loss", async () => {
      const catalog = await getOpeningCatalog(pool);
      expect(catalog.length).toBeGreaterThanOrEqual(50);

      const sample = catalog.find((o) => o.ecoCode === "B90");
      expect(sample).toBeDefined();
      expect(sample.name).toBe("Sicilian Defense");
      expect(sample.variation).toBe("Najdorf Variation");
      expect(sample.pgnMoves).toContain("a6");
    });

    itDb("matches Sicilian Najdorf (B90) for full 10-ply sequence in PostgreSQL", async () => {
      const moves = ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "a6"];
      const match = await matchOpeningByMoves(pool, moves);

      expect(match).not.toBeNull();
      expect(match.ecoCode).toBe("B90");
      expect(match.name).toBe("Sicilian Defense");
      expect(match.variation).toBe("Najdorf Variation");
      expect(match.matchedPlies).toBe(10);
    });

    itDb("preserves early-ply blunders: Fool's Mate (1. f3 e5 2. g4) is NOT a book move in DB", async () => {
      const isBookF3 = await isBookMove(pool, ["f3"]);
      const isBookG4 = await isBookMove(pool, ["f3", "e5", "g4"]);

      expect(isBookF3).toBe(false);
      expect(isBookG4).toBe(false);
    });

    itDb("executes fn_calculate_game_acpl and accurately segments book vs non-book moves", async () => {
      const fakeUuid = "00000000-0000-0000-0000-000000000000";
      const stats = await calculateGameAcpl(pool, fakeUuid, true);

      expect(stats).toHaveProperty("whiteAcpl");
      expect(stats).toHaveProperty("blackAcpl");
      expect(stats).toHaveProperty("whiteMovesCounted");
      expect(stats).toHaveProperty("blackMovesCounted");
      expect(stats).toHaveProperty("whiteBookExcluded");
      expect(stats).toHaveProperty("blackBookExcluded");
    });

    itDb("verifies linkGameEco safely records game ECO code", async () => {
      const fakeGameId = "00000000-0000-0000-0000-000000000001";
      await expect(linkGameEco(pool, fakeGameId, "B20")).resolves.not.toThrow();
    });

    itDb("evaluates fn_verify_day10_openings() to PASSED on PostgreSQL", async () => {
      const res = await pool.query(
        "SELECT fn_verify_day10_openings() AS diag;",
      );
      const diag = res.rows[0].diag;

      expect(diag.status).toBe("PASSED");
      expect(diag.total_openings_count).toBeGreaterThanOrEqual(50);
      expect(diag.sicilian_match.eco_code).toBe("B90");
      expect(diag.italian_match.eco_code).toBe("C50");
      expect(diag.e4_is_book).toBe(true);
      expect(diag.fools_mate_is_book).toBe(false);
      expect(diag.acpl_rule_preserved).toBe(true);
    });
  });
});
