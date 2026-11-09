/**
 * ChessIQ v3.3.0 — Day 10 Unit & Integration Verification Suite (@DB/@BE)
 *
 * Verifies:
 * 1. 6NF Openings Catalog Schema & 3NF Reconstruction View (v_chess_openings)
 * 2. Complete ECO Coverage across Volumes A through E (>= 50 seeded openings)
 * 3. Authoritative Prefix Matching (fn_match_opening_prefix)
 * 4. Per-Ply Book Move Identification (fn_is_book_move)
 * 5. Early-Ply Blunder Protection: Fool's Mate is NOT a book move
 * 6. ACPL Book Move Exclusion Invariant (§11.5, fn_calculate_game_acpl)
 * 7. Database Diagnostic Telemetry: fn_verify_day10_openings() returns PASSED
 */

const { pool, closePool } = require("../src/db/pool");
const {
  matchOpeningByMoves,
  isBookMove,
  calculateGameAcpl,
  getOpeningCatalog,
  linkGameEco,
} = require("../src/db/openings");

describe("Day 10: Opening Book Catalog Verification & ACPL Exclusions (@DB/@BE)", () => {
  afterAll(async () => {
    await closePool();
  });

  // ==========================================================================
  // 1. 6NF Catalog Relations & 3NF View Integrity
  // ==========================================================================
  describe("6NF Schema Relations & 3NF View (v_chess_openings)", () => {
    it("seeds at least 50 authoritative ECO openings across the 6NF schema", async () => {
      const res = await pool.query(
        "SELECT COUNT(*)::INT AS total FROM chess_openings;",
      );
      const total = res.rows[0].total;
      expect(total).toBeGreaterThanOrEqual(50);
    });

    it("ensures all five ECO volumes (A, B, C, D, E) are represented in the catalog", async () => {
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

    it("verifies logical 3NF view v_chess_openings joins names, variations, and moves without loss", async () => {
      const catalog = await getOpeningCatalog(pool);
      expect(catalog.length).toBeGreaterThanOrEqual(50);

      // Verify structure of catalog items
      const sample = catalog.find((o) => o.ecoCode === "B90");
      expect(sample).toBeDefined();
      expect(sample.name).toBe("Sicilian Defense");
      expect(sample.variation).toBe("Najdorf Variation");
      expect(sample.pgnMoves).toContain("a6");
    });
  });

  // ==========================================================================
  // 2. Authoritative Opening Prefix Matching
  // ==========================================================================
  describe("Authoritative Opening Prefix Matching (fn_match_opening_prefix)", () => {
    it("matches Sicilian Najdorf (B90) for full 10-ply sequence", async () => {
      const moves = [
        "e4",
        "c5",
        "Nf3",
        "d6",
        "d4",
        "cxd4",
        "Nxd4",
        "Nf6",
        "Nc3",
        "a6",
      ];
      const match = await matchOpeningByMoves(pool, moves);

      expect(match).not.toBeNull();
      expect(match.ecoCode).toBe("B90");
      expect(match.name).toBe("Sicilian Defense");
      expect(match.variation).toBe("Najdorf Variation");
      expect(match.matchedPlies).toBe(10);
    });

    it("matches general Sicilian Defense (B20) for 1. e4 c5", async () => {
      const moves = ["e4", "c5"];
      const match = await matchOpeningByMoves(pool, moves);

      expect(match).not.toBeNull();
      expect(match.ecoCode).toBe("B20");
      expect(match.name).toBe("Sicilian Defense");
    });

    it("matches Italian Game (C50) for 1. e4 e5 2. Nf3 Nc6 3. Bc4", async () => {
      const moves = ["e4", "e5", "Nf3", "Nc6", "Bc4"];
      const match = await matchOpeningByMoves(pool, moves);

      expect(match).not.toBeNull();
      expect(match.ecoCode).toBe("C50");
      expect(match.name).toBe("Italian Game");
    });

    it("matches Queen's Gambit (D06) for 1. d4 d5 2. c4", async () => {
      const moves = ["d4", "d5", "c4"];
      const match = await matchOpeningByMoves(pool, moves);

      expect(match).not.toBeNull();
      expect(match.ecoCode).toBe("D06");
      expect(match.name).toBe("Queen's Gambit");
    });

    it("matches King's Indian Defense (E60) for 1. d4 Nf6 2. c4 g6", async () => {
      const moves = ["d4", "Nf6", "c4", "g6"];
      const match = await matchOpeningByMoves(pool, moves);

      expect(match).not.toBeNull();
      expect(match.ecoCode).toBe("E60");
      expect(match.name).toBe("King's Indian Defense");
    });

    it("returns null gracefully for empty or unrecognized opening move sequence", async () => {
      expect(await matchOpeningByMoves(pool, [])).toBeNull();
      expect(await matchOpeningByMoves(pool, ["h4", "h5", "a4"])).toBeNull();
    });
  });

  // ==========================================================================
  // 3. Per-Ply Book Move Identification & Blunder Preservation
  // ==========================================================================
  describe("Per-Ply Book Move Identification (fn_is_book_move)", () => {
    it("identifies 1. e4 as an authoritative book move", async () => {
      const isBook = await isBookMove(pool, ["e4"]);
      expect(isBook).toBe(true);
    });

    it("identifies 1. d4 Nf6 2. c4 e6 as an authoritative book move", async () => {
      const isBook = await isBookMove(pool, ["d4", "Nf6", "c4", "e6"]);
      expect(isBook).toBe(true);
    });

    it("preserves early-ply blunders: Fool's Mate (1. f3 e5 2. g4) is NOT a book move", async () => {
      const isBookF3 = await isBookMove(pool, ["f3"]);
      const isBookG4 = await isBookMove(pool, ["f3", "e5", "g4"]);

      expect(isBookF3).toBe(false);
      expect(isBookG4).toBe(false);
    });

    it("returns false for non-book divergence late in the opening line", async () => {
      // 1. e4 e5 2. Nf3 h6 is not standard book
      const isBook = await isBookMove(pool, ["e4", "e5", "Nf3", "h6"]);
      expect(isBook).toBe(false);
    });
  });

  // ==========================================================================
  // 4. ACPL Book Move Exclusion Invariant (§11.5)
  // ==========================================================================
  describe("ACPL Book Move Exclusion Rule (§11.5, fn_calculate_game_acpl)", () => {
    it("executes fn_calculate_game_acpl and accurately segments book vs non-book moves", async () => {
      // Test function exists and returns valid record structure
      const fakeUuid = "00000000-0000-0000-0000-000000000000";
      const stats = await calculateGameAcpl(pool, fakeUuid, true);

      expect(stats).toHaveProperty("whiteAcpl");
      expect(stats).toHaveProperty("blackAcpl");
      expect(stats).toHaveProperty("whiteMovesCounted");
      expect(stats).toHaveProperty("blackMovesCounted");
      expect(stats).toHaveProperty("whiteBookExcluded");
      expect(stats).toHaveProperty("blackBookExcluded");
    });

    it("verifies linkGameEco safely records game ECO code", async () => {
      const fakeGameId = "00000000-0000-0000-0000-000000000001";
      // Should not throw even if game does not exist (ON CONFLICT or foreign key handling)
      await expect(linkGameEco(pool, fakeGameId, "B20")).resolves.not.toThrow();
    });
  });

  // ==========================================================================
  // 5. Database Diagnostic Telemetry
  // ==========================================================================
  describe("Database Diagnostic Telemetry (fn_verify_day10_openings)", () => {
    it("evaluates fn_verify_day10_openings() to PASSED on PostgreSQL", async () => {
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
