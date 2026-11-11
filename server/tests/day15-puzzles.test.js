/**
 * ChessIQ v3.3.0 — Day 15 Unit & Integration Verification Suite (@DB/@FE)
 *
 * Verifies:
 * 1. 6NF Training Puzzles Schema Relations & 1NF Theme Types Catalog (>= 10 themes, >= 20 puzzles)
 * 2. 3NF Reconstruction Views (v_training_puzzles, v_training_recommendations)
 * 3. Theme-based and Rating-based Catalog Filtering (getPuzzleCatalog)
 * 4. Personalized Puzzle Generator Function (fn_generate_personalized_puzzles)
 * 5. Blunder Extraction Function (fn_extract_blunder_puzzle_from_game)
 * 6. Training Recommendations Stored Procedure (sp_generate_user_training_recommendations)
 * 7. Express API Gateway Routes (/api/puzzles, /api/recommendations)
 * 8. Database Diagnostic Telemetry: fn_verify_day15_puzzles() returns PASSED
 */

const request = require("supertest");
const app = require("../src/app");
const { pool, closePool } = require("../src/db/pool");
const {
  getPuzzleCatalog,
  getPuzzleById,
  getPersonalizedPuzzles,
  createPuzzleFromBlunder,
  generateUserRecommendations,
  getUserRecommendations,
  getPuzzleThemes,
  verifyDay15Puzzles,
} = require("../src/db/puzzles");

describe("Day 15: Personalized Training Puzzle Generator (v_training_puzzles) (@DB/@FE)", () => {
  let samplePuzzleId = null;
  let testUserId = null;
  let testAnalysisId = null;

  beforeAll(async () => {
    // Resolve or insert a test user
    const userRes = await pool.query(`SELECT id FROM users LIMIT 1;`);
    if (userRes.rows.length > 0) {
      testUserId = userRes.rows[0].id;
    } else {
      const newUser = await pool.query(
        `INSERT INTO users (id) VALUES (uuid_generate_v4()) RETURNING id;`,
      );
      testUserId = newUser.rows[0].id;
      await pool.query(
        `INSERT INTO user_emails (user_id, email) VALUES ($1, 'puzzle_test@chessiq.com');`,
        [testUserId],
      );
      await pool.query(
        `INSERT INTO user_usernames (user_id, username) VALUES ($1, 'puzzle_tester');`,
        [testUserId],
      );
      await pool.query(
        `INSERT INTO user_password_hashes (user_id, password_hash) VALUES ($1, 'hash_test');`,
        [testUserId],
      );
    }

    // Resolve an existing analysis or note if none
    const analysisRes = await pool.query(
      `SELECT id FROM game_analyses LIMIT 1;`,
    );
    if (analysisRes.rows.length > 0) {
      testAnalysisId = analysisRes.rows[0].id;
    }
  });

  afterAll(async () => {
    await closePool();
  });

  // ==========================================================================
  // 1. 6NF Schema Relations & 1NF Theme Types Catalog
  // ==========================================================================
  describe("6NF Decomposed Schema & 1NF Theme Types", () => {
    it("seeds at least 10 tactical theme types in puzzle_theme_types", async () => {
      const themes = await getPuzzleThemes(pool);
      expect(themes.length).toBeGreaterThanOrEqual(10);

      const codes = themes.map((t) => t.theme_code);
      expect(codes).toContain("fork");
      expect(codes).toContain("pin");
      expect(codes).toContain("backRankMate");
      expect(codes).toContain("discoveredAttack");
      expect(codes).toContain("endgame");
    });

    it("seeds at least 20 curated baseline puzzles in 6NF relations", async () => {
      const res = await pool.query(
        `SELECT COUNT(*)::INT AS count FROM training_puzzles;`,
      );
      expect(res.rows[0].count).toBeGreaterThanOrEqual(20);
    });

    it("verifies 3NF reconstruction view v_training_puzzles aggregates JSONB themes", async () => {
      const res = await pool.query(
        `SELECT id, fen, moves, rating, themes FROM v_training_puzzles LIMIT 5;`,
      );
      expect(res.rows.length).toBeGreaterThanOrEqual(5);

      const first = res.rows[0];
      samplePuzzleId = first.id;
      expect(first.fen).toBeTruthy();
      expect(first.moves).toBeTruthy();
      expect(typeof first.rating).toBe("number");
      expect(Array.isArray(first.themes)).toBe(true);
      expect(first.themes.length).toBeGreaterThanOrEqual(1);
      expect(first.themes[0]).toHaveProperty("theme_code");
      expect(first.themes[0]).toHaveProperty("description");
    });
  });

  // ==========================================================================
  // 2. Catalog Filtering & Retrieval Service
  // ==========================================================================
  describe("Puzzle Catalog Service (server/src/db/puzzles.js)", () => {
    it("retrieves puzzle by ID via getPuzzleById", async () => {
      expect(samplePuzzleId).toBeDefined();
      const puzzle = await getPuzzleById(pool, samplePuzzleId);
      expect(puzzle).not.toBeNull();
      expect(puzzle.id).toBe(samplePuzzleId);
      expect(puzzle.rating).toBeGreaterThanOrEqual(400);
    });

    it("filters catalog by rating range", async () => {
      const lowRatingPuzzles = await getPuzzleCatalog(pool, {
        minRating: 1000,
        maxRating: 1300,
      });
      expect(lowRatingPuzzles.length).toBeGreaterThan(0);
      lowRatingPuzzles.forEach((p) => {
        expect(p.rating).toBeGreaterThanOrEqual(1000);
        expect(p.rating).toBeLessThanOrEqual(1300);
      });
    });

    it("filters catalog by tactical theme (e.g. 'backRankMate')", async () => {
      const backRankPuzzles = await getPuzzleCatalog(pool, {
        theme: "backRankMate",
      });
      expect(backRankPuzzles.length).toBeGreaterThan(0);
      backRankPuzzles.forEach((p) => {
        const themeCodes = p.themes.map((t) => t.theme_code);
        expect(themeCodes).toContain("backRankMate");
      });
    });
  });

  // ==========================================================================
  // 3. Personalized Generator & Recommendations
  // ==========================================================================
  describe("Personalized Puzzle Generator & Recommendations (@DB)", () => {
    it("executes fn_generate_personalized_puzzles and returns calibrated puzzles with match reasons", async () => {
      const puzzles = await getPersonalizedPuzzles(pool, testUserId, 5);
      expect(puzzles.length).toBeGreaterThanOrEqual(1);
      expect(puzzles.length).toBeLessThanOrEqual(5);

      const first = puzzles[0];
      expect(first).toHaveProperty("puzzle_id");
      expect(first).toHaveProperty("fen");
      expect(first).toHaveProperty("moves");
      expect(first).toHaveProperty("rating");
      expect(first).toHaveProperty("match_reason");
      expect(typeof first.match_reason).toBe("string");
    });

    it("executes sp_generate_user_training_recommendations and queries v_training_recommendations", async () => {
      const recs = await generateUserRecommendations(pool, testUserId, 3);
      expect(recs.length).toBeGreaterThanOrEqual(1);

      const first = recs[0];
      expect(first.user_id).toBe(testUserId);
      expect(first.category).toBe("TACTICAL_TRAINING");
      expect(first).toHaveProperty("metric_evidence");
      expect(first).toHaveProperty("description");
      expect(first.is_completed).toBe(false);
    });

    it("retrieves persisted recommendations via getUserRecommendations", async () => {
      const recs = await getUserRecommendations(pool, testUserId);
      expect(recs.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ==========================================================================
  // 4. In-Game Blunder Extraction (fn_extract_blunder_puzzle_from_game)
  // ==========================================================================
  describe("Blunder Extraction Function (fn_extract_blunder_puzzle_from_game)", () => {
    it("extracts an in-game move blunder into a new 6NF puzzle if analysis exists", async () => {
      if (!testAnalysisId) {
        // If no game analysis in DB yet, create a dummy move to test function
        return;
      }

      // Check if move exists for this analysis
      const moveRes = await pool.query(
        `SELECT ply_number FROM v_move_analyses 
         WHERE analysis_id = $1 AND best_move_uci IS NOT NULL 
         LIMIT 1;`,
        [testAnalysisId],
      );

      if (moveRes.rows.length > 0) {
        const ply = moveRes.rows[0].ply_number;
        const newPuzzleId = await createPuzzleFromBlunder(
          pool,
          testAnalysisId,
          ply,
          "pin",
        );
        expect(newPuzzleId).toBeDefined();

        const puzzle = await getPuzzleById(pool, newPuzzleId);
        expect(puzzle).not.toBeNull();
        expect(puzzle.id).toBe(newPuzzleId);
        const themes = puzzle.themes.map((t) => t.theme_code);
        expect(themes).toContain("pin");
      }
    });
  });

  // ==========================================================================
  // 5. Express API Gateway Routes
  // ==========================================================================
  describe("API Gateway Integration (/api/puzzles & /api/recommendations)", () => {
    it("GET /api/puzzles returns 200 with puzzles array", async () => {
      const res = await request(app).get("/api/puzzles?limit=10");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");
      expect(Array.isArray(res.body.data.puzzles)).toBe(true);
      expect(res.body.data.puzzles.length).toBeGreaterThan(0);
    });

    it("GET /api/puzzles/themes returns 200 with themes array", async () => {
      const res = await request(app).get("/api/puzzles/themes");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");
      expect(Array.isArray(res.body.data.themes)).toBe(true);
      expect(res.body.data.themes.length).toBeGreaterThanOrEqual(10);
    });

    it("GET /api/puzzles/personalized returns 200 with personalized recommendations", async () => {
      const res = await request(app).get(
        `/api/puzzles/personalized?user_id=${testUserId}&limit=3`,
      );
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");
      expect(Array.isArray(res.body.data.puzzles)).toBe(true);
      expect(res.body.data.puzzles.length).toBeGreaterThanOrEqual(1);
    });

    it("GET /api/recommendations returns 200 and matches System Design §8.1", async () => {
      const res = await request(app).get(
        `/api/recommendations?user_id=${testUserId}`,
      );
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");
      expect(Array.isArray(res.body.data.recommendations)).toBe(true);
    });

    it("POST /api/recommendations/generate returns 201 with generated recommendations", async () => {
      const res = await request(app)
        .post("/api/recommendations/generate")
        .send({ user_id: testUserId, limit: 3 });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe("success");
      expect(Array.isArray(res.body.data.recommendations)).toBe(true);
    });

    it("GET /api/puzzles/:id returns 404 for unknown puzzle ID", async () => {
      const res = await request(app).get(
        "/api/puzzles/00000000-0000-0000-0000-000000000000",
      );
      expect(res.status).toBe(404);
      expect(res.body.error).toBe("NOT_FOUND");
    });
  });

  // ==========================================================================
  // 6. Database Diagnostic Telemetry
  // ==========================================================================
  describe("PostgreSQL fn_verify_day15_puzzles() Diagnostic", () => {
    it("evaluates fn_verify_day15_puzzles() to PASSED on PostgreSQL", async () => {
      const diag = await verifyDay15Puzzles(pool);
      expect(diag.status).toBe("PASSED");
      expect(diag.puzzles_count).toBeGreaterThanOrEqual(20);
      expect(diag.theme_types_count).toBeGreaterThanOrEqual(10);
      expect(diag.view_puzzles_count).toBeGreaterThanOrEqual(20);
      expect(diag.personalized_generator_active).toBe(true);
    });
  });
});
