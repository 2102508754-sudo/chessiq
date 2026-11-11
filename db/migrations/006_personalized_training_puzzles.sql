-- ============================================================================
-- ChessIQ v3.3.0 — Migration 006: Seed Curated Puzzles & Personalized Generator
-- Day 15: Personalized Training Puzzle Generator (v_training_puzzles) (@DB/@FE)
-- Target Engine: PostgreSQL 16.x / 17.x
-- ============================================================================

-- ============================================================================
-- 1. SEED 1NF THEME CATALOG (puzzle_theme_types)
-- ============================================================================
INSERT INTO puzzle_theme_types (theme_code, description) VALUES
    ('fork', 'Simultaneous tactical double attack on two or more pieces'),
    ('pin', 'Restriction of piece mobility along ray protecting valuable piece'),
    ('skewer', 'Linear attack through high-value piece exposing underlying unit'),
    ('discoveredAttack', 'Tactical reveal of an unmasked sliding piece attack'),
    ('backRankMate', 'Corridor checkmate along the back rank trapped by friendly pawns'),
    ('deflection', 'Distracting an enemy piece away from defending a vital square or unit'),
    ('hangingPiece', 'Exploitation of an undefended, loose tactical piece'),
    ('endgame', 'King, pawn, or minor piece endgame conversion technique'),
    ('mateIn2', 'Forced checkmate in exactly two moves'),
    ('sacrifice', 'Material sacrifice yielding decisive tactical compensation'),
    ('doubleCheck', 'Simultaneous double check forcing enemy king flight'),
    ('trappedPiece', 'Exploitation of restricted piece mobility leading to capture'),
    ('interference', 'Interruption of line of communication between two enemy pieces'),
    ('overloadedPiece', 'Exploitation of a piece assigned too many defensive duties'),
    ('smotheredMate', 'Knight checkmate delivered to king hemmed in by friendly units')
ON CONFLICT (theme_code) DO UPDATE
SET description = EXCLUDED.description;

-- ============================================================================
-- 2. SEED 6NF CURATED TRAINING PUZZLES
-- ============================================================================
DO $$
DECLARE
    -- Array of puzzle definitions: FEN, moves, rating, themes (comma-separated)
    puzzles_data TEXT[][] := ARRAY[
        ARRAY[
            'r4rk1/1pp2ppp/p1pb4/8/4n3/2NP1P2/PPP2P1P/R1B1R1K1 b - - 0 13',
            'e4c3 b2c3',
            '2100',
            'hangingPiece,fork'
        ],
        ARRAY[
            'b2r3r/k4p1p/p2q1np1/NppP4/3bP3/1B3P2/PP3Q1P/1K1R2R1 w - - 0 24',
            'd1d4 c5d4 f2d4',
            '2500',
            'sacrifice,discoveredAttack'
        ],
        ARRAY[
            '6k1/5ppp/8/8/8/8/4rPPP/2R3K1 w - - 0 1',
            'c1c8 e2e8 c8e8',
            '1050',
            'backRankMate'
        ],
        ARRAY[
            '3r2k1/5ppp/8/8/8/8/4QPPP/6K1 w - - 0 1',
            'e2e8 d8e8',
            '1100',
            'backRankMate'
        ],
        ARRAY[
            '2r3k1/5ppp/8/8/8/8/2q2PPP/1R4K1 w - - 0 1',
            'b1f1',
            '1150',
            'backRankMate'
        ],
        ARRAY[
            '2r3k1/1p3ppp/p7/3p4/3Q4/1P6/P4PPP/2q1R1K1 w - - 0 24',
            'e1c1 c8c1 d4d1 c1d1',
            '1250',
            'backRankMate,deflection'
        ],
        ARRAY[
            'r1b2r1k/ppp2Npp/8/8/2B5/8/PPP3PP/2KR4 w - - 0 1',
            'f7h6 g8h8 c4g8 f8g8 h6f7',
            '1650',
            'smotheredMate,sacrifice'
        ],
        ARRAY[
            'r1bqkb1r/pppp1ppp/2n5/4p3/2B1n3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 5',
            'c4f7 e8f7 d1e2',
            '1350',
            'fork'
        ],
        ARRAY[
            'r1bqk2r/pppp1ppp/2n2n2/4p3/1b1PP3/2N2N2/PPP2PPP/R1BQKB1R w KQkq - 1 5',
            'd4e5 f6e4 c1d2 e4c3',
            '1450',
            'pin'
        ],
        ARRAY[
            'r1b1k2r/ppppqppp/2n5/4n3/1bP5/2N2N2/PP1BPPPP/R2QKB1R w KQkq - 0 8',
            'f3e5 c6e5 d1b3',
            '1400',
            'pin,discoveredAttack'
        ],
        ARRAY[
            'r1bqkb1r/pp3ppp/2n5/2pnp3/8/2N2NP1/PP1PPPBP/R1BQK2R w KQkq - 0 7',
            'f3e5 d5c3 e5c6 c3d1 c6d8',
            '1750',
            'discoveredAttack,fork'
        ],
        ARRAY[
            'r1b1r1k1/pp3ppp/2n5/q1bp4/8/2N2N2/PPP1BPPP/R2Q1RK1 w - - 0 12',
            'd1d5 c5f2 f1f2 a5d5 c3d5',
            '1600',
            'deflection,sacrifice'
        ],
        ARRAY[
            'r1b1k2r/pppp1ppp/8/4q3/1bP5/2N1P3/PP3PPP/R1BQKB1R w KQkq - 0 9',
            'c1d2 e8g8 f1e2',
            '1200',
            'hangingPiece'
        ],
        ARRAY[
            'r1bqr1k1/ppp2ppp/2np4/8/2B1P3/2N5/PPP2PPP/R2QR1K1 w - - 0 11',
            'c4f7 g8f7 d1h5 f7g8',
            '1300',
            'hangingPiece,sacrifice'
        ],
        ARRAY[
            '8/5pk1/6p1/8/8/4K3/8/8 w - - 0 1',
            'e3f4 g7f6',
            '1350',
            'endgame'
        ],
        ARRAY[
            '8/8/5k2/8/8/4K3/4P3/8 w - - 0 1',
            'e3e4 f6e6',
            '1400',
            'endgame'
        ],
        ARRAY[
            '8/8/4k3/8/8/3K4/3R4/8 w - - 0 1',
            'd3e4 e6f6',
            '1200',
            'endgame'
        ],
        ARRAY[
            '4k3/8/8/8/3q4/8/8/3RK3 w - - 0 1',
            'd1d4 e8e7',
            '1100',
            'skewer'
        ],
        ARRAY[
            '8/8/8/4k3/8/8/4r3/4K2R w - - 0 1',
            'e1f1 e2a2',
            '1250',
            'skewer'
        ],
        ARRAY[
            'r1b2rk1/pp3ppp/2n5/q7/2B5/5N2/PP1Q1PPP/R3R1K1 w - - 0 1',
            'c4f7 f8f7 e1e8',
            '1600',
            'doubleCheck,backRankMate'
        ],
        ARRAY[
            'r1bqkb1r/pppp1ppp/8/4n3/4P3/8/PPP2PPP/RNBQKB1R w KQkq - 0 6',
            'f2f4 e5g6',
            '1300',
            'trappedPiece'
        ],
        ARRAY[
            'r1bqk1nr/pppp1ppp/2n5/4p3/1bB1P3/2P2N2/P2P1PPP/RNBQK2R b KQkq - 0 5',
            'b4a5',
            '1250',
            'trappedPiece'
        ],
        ARRAY[
            'r1b1r1k1/pp3ppp/2p5/q2p4/3Pn3/2PBPN2/P1Q2PPP/R1B2RK1 w - - 5 13',
            'c3c4 d5c4 d3e4',
            '1650',
            'overloadedPiece'
        ],
        ARRAY[
            'r5k1/5ppp/8/8/8/5Q2/5PPP/6K1 w - - 0 1',
            'f3a8 c8a8',
            '1000',
            'mateIn2,backRankMate'
        ],
        ARRAY[
            '4kb1r/p2rqppp/5n2/1B2p1B1/4P3/1Q6/PPP2PPP/2KR4 w k - 0 14',
            'b5d7 f6d7 b3b8 d7b8 d1d8',
            '1850',
            'pin,deflection,sacrifice'
        ],
        ARRAY[
            '5rk1/1p3ppp/8/3N4/8/8/5PPP/4R1K1 w - - 0 1',
            'd5e7 g8h8 e7g6',
            '1700',
            'sacrifice,smotheredMate'
        ],
        ARRAY[
            'r1b1k2r/pppp1ppp/5q2/4n3/1bP5/2N2N2/PP1BPPPP/R2QKB1R w KQkq - 0 8',
            'f3e5 f6e5 c3d5',
            '1550',
            'deflection,fork'
        ],
        ARRAY[
            'r2q1rk1/1pp2ppp/p1np1n2/4p3/2B1P1b1/2NPPN2/PPP3PP/R2Q1RK1 w - - 0 10',
            'c4f7 f8f7',
            '1600',
            'interference,sacrifice'
        ],
        ARRAY[
            '8/4k3/8/4P3/8/4K3/8/8 w - - 0 1',
            'e3e4 e7e6 e4d4',
            '1450',
            'endgame'
        ],
        ARRAY[
            'r1bq1rk1/ppp2ppp/2n1pn2/3p4/2PP4/2NBPN2/PP3PPP/R1BQK2R w KQ - 0 8',
            'd3h7 g8h7 f3g5 h7g8',
            '2000',
            'sacrifice,discoveredAttack'
        ]
    ];
    i INT;
    v_id UUID;
    v_fen VARCHAR(100);
    v_moves VARCHAR(255);
    v_rating INT;
    v_themes_str TEXT;
    v_theme TEXT;
BEGIN
    FOR i IN 1..array_length(puzzles_data, 1) LOOP
        v_fen := puzzles_data[i][1];
        v_moves := puzzles_data[i][2];
        v_rating := puzzles_data[i][3]::INT;
        v_themes_str := puzzles_data[i][4];

        -- Check if puzzle with this exact FEN and moves already exists
        SELECT p.id INTO v_id
        FROM training_puzzles p
        JOIN puzzle_fens pf ON p.id = pf.puzzle_id
        JOIN puzzle_moves pm ON p.id = pm.puzzle_id
        WHERE pf.fen = v_fen AND pm.moves = v_moves
        LIMIT 1;

        IF v_id IS NULL THEN
            v_id := uuid_generate_v4();

            -- 6NF Decomposition Inserts
            INSERT INTO training_puzzles (id) VALUES (v_id);
            INSERT INTO puzzle_fens (puzzle_id, fen) VALUES (v_id, v_fen);
            INSERT INTO puzzle_moves (puzzle_id, moves) VALUES (v_id, v_moves);
            INSERT INTO puzzle_ratings (puzzle_id, rating) VALUES (v_id, v_rating);
            INSERT INTO puzzle_created_times (puzzle_id, created_at) VALUES (v_id, CURRENT_TIMESTAMP);

            -- Themes associations
            FOREACH v_theme IN ARRAY string_to_array(v_themes_str, ',') LOOP
                v_theme := trim(v_theme);
                IF EXISTS (SELECT 1 FROM puzzle_theme_types WHERE theme_code = v_theme) THEN
                    INSERT INTO puzzle_themes (puzzle_id, theme_code)
                    VALUES (v_id, v_theme)
                    ON CONFLICT DO NOTHING;
                END IF;
            END LOOP;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. STORED FUNCTION: Extract Blunder Puzzle From Analyzed Game Move
-- Turns in-game tactical mistakes into personalized 6NF training puzzles.
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_extract_blunder_puzzle_from_game(
    p_analysis_id UUID,
    p_ply_number INT,
    p_theme_code VARCHAR(30) DEFAULT 'hangingPiece'
)
RETURNS UUID AS $$
DECLARE
    v_move RECORD;
    v_puzzle_id UUID;
    v_rating INT;
BEGIN
    SELECT 
        m.id,
        m.fen_before,
        m.best_move_uci,
        m.cpl_capped,
        m.mistake_type,
        m.color
    INTO v_move
    FROM v_move_analyses m
    WHERE m.analysis_id = p_analysis_id
      AND m.ply_number = p_ply_number;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Move not found for analysis % and ply %', p_analysis_id, p_ply_number;
    END IF;

    IF v_move.best_move_uci IS NULL OR trim(v_move.best_move_uci) = '' THEN
        RAISE EXCEPTION 'Cannot create puzzle: move at ply % has no best_move_uci', p_ply_number;
    END IF;

    -- Calibrate puzzle rating: base 1400 + scaled CPL
    v_rating := LEAST(2600, GREATEST(800, 1400 + COALESCE(v_move.cpl_capped, 100)));

    -- Decompose into 6NF relations
    v_puzzle_id := uuid_generate_v4();
    INSERT INTO training_puzzles (id) VALUES (v_puzzle_id);
    INSERT INTO puzzle_fens (puzzle_id, fen) VALUES (v_puzzle_id, v_move.fen_before);
    INSERT INTO puzzle_moves (puzzle_id, moves) VALUES (v_puzzle_id, v_move.best_move_uci);
    INSERT INTO puzzle_ratings (puzzle_id, rating) VALUES (v_puzzle_id, v_rating);
    INSERT INTO puzzle_created_times (puzzle_id, created_at) VALUES (v_puzzle_id, CURRENT_TIMESTAMP);

    -- Ensure theme code exists in catalog or fallback
    IF EXISTS (SELECT 1 FROM puzzle_theme_types WHERE theme_code = p_theme_code) THEN
        INSERT INTO puzzle_themes (puzzle_id, theme_code) VALUES (v_puzzle_id, p_theme_code);
    ELSE
        INSERT INTO puzzle_themes (puzzle_id, theme_code) VALUES (v_puzzle_id, 'hangingPiece');
    END IF;

    RETURN v_puzzle_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. STORED FUNCTION: Generate Personalized Puzzles For User
-- Dynamically matches puzzles based on user rating and phase weaknesses.
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_generate_personalized_puzzles(
    p_user_id UUID,
    p_limit INT DEFAULT 5
)
RETURNS TABLE (
    puzzle_id UUID,
    fen VARCHAR(100),
    moves VARCHAR(255),
    rating INT,
    created_at TIMESTAMPTZ,
    themes JSONB,
    match_reason TEXT
) AS $$
DECLARE
    v_user_rating INT := 1500;
    v_worst_phase VARCHAR(15) := 'MIDDLEGAME';
    v_blunder_count INT := 0;
BEGIN
    -- 1. Resolve user's active rating
    SELECT COALESCE(chess_rating, 1500)
    INTO v_user_rating
    FROM user_ratings
    WHERE user_id = p_user_id
      AND upper(valid_during) IS NULL
    ORDER BY lower(valid_during) DESC
    LIMIT 1;

    IF v_user_rating IS NULL THEN
        v_user_rating := 1500;
    END IF;

    -- 2. Determine player's primary blunder phase from recent analyses
    SELECT 
        vma.game_phase,
        COUNT(*)::INT as cnt
    INTO v_worst_phase, v_blunder_count
    FROM v_games vg
    JOIN v_game_analyses vga ON vg.id = vga.game_id
    JOIN v_move_analyses vma ON vga.id = vma.analysis_id
    WHERE vg.user_id = p_user_id
      AND vma.color = vg.user_color
      AND vma.mistake_type IN ('BLUNDER', 'MISTAKE')
    GROUP BY vma.game_phase
    ORDER BY cnt DESC
    LIMIT 1;

    IF v_worst_phase IS NULL THEN
        v_worst_phase := 'MIDDLEGAME';
    END IF;

    -- 3. Return curated training puzzles matching the diagnosed phase and rating
    RETURN QUERY
    SELECT 
        p.id AS puzzle_id,
        p.fen,
        p.moves,
        p.rating,
        p.created_at,
        p.themes,
        CASE 
            WHEN v_worst_phase = 'ENDGAME' AND EXISTS (
                SELECT 1 FROM jsonb_array_elements(p.themes) t WHERE t->>'theme_code' = 'endgame'
            ) THEN 'Recommended based on high Endgame conversion centipawn loss in your recent games.'
            WHEN v_worst_phase = 'OPENING' AND EXISTS (
                SELECT 1 FROM jsonb_array_elements(p.themes) t WHERE t->>'theme_code' IN ('fork', 'pin', 'backRankMate')
            ) THEN 'Recommended to reinforce early-game tactical alertness and punish opening oversights.'
            ELSE 'Recommended to sharpen calculation and reduce ' || v_worst_phase || ' tactical blunders.'
        END AS match_reason
    FROM v_training_puzzles p
    ORDER BY 
        CASE 
            WHEN v_worst_phase = 'ENDGAME' AND EXISTS (
                SELECT 1 FROM jsonb_array_elements(p.themes) t WHERE t->>'theme_code' = 'endgame'
            ) THEN 0
            WHEN v_worst_phase = 'MIDDLEGAME' AND EXISTS (
                SELECT 1 FROM jsonb_array_elements(p.themes) t WHERE t->>'theme_code' IN ('pin', 'fork', 'discoveredAttack', 'hangingPiece', 'deflection')
            ) THEN 0
            ELSE 1
        END ASC,
        ABS(p.rating - v_user_rating) ASC,
        p.rating ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 5. STORED PROCEDURE: Generate & Persist Training Recommendations
-- Records persistent recommendation entities into 6NF training_recommendations.
-- ============================================================================
CREATE OR REPLACE PROCEDURE sp_generate_user_training_recommendations(
    p_user_id UUID,
    p_limit INT DEFAULT 3
)
AS $$
DECLARE
    v_rec RECORD;
    v_rec_id UUID;
    v_count INT := 0;
BEGIN
    FOR v_rec IN (
        SELECT 
            p.puzzle_id,
            p.rating,
            p.match_reason,
            p.themes
        FROM fn_generate_personalized_puzzles(p_user_id, p_limit) p
    ) LOOP
        v_rec_id := uuid_generate_v4();

        -- Binary 6NF Decomposition into training_recommendations
        INSERT INTO training_recommendations (id) VALUES (v_rec_id);
        INSERT INTO recommendation_users (recommendation_id, user_id) VALUES (v_rec_id, p_user_id);
        INSERT INTO recommendation_puzzles (recommendation_id, puzzle_id) VALUES (v_rec_id, v_rec.puzzle_id);
        INSERT INTO recommendation_categories (recommendation_id, category) VALUES (v_rec_id, 'TACTICAL_TRAINING');
        INSERT INTO recommendation_descriptions (recommendation_id, description) VALUES (v_rec_id, v_rec.match_reason);
        INSERT INTO recommendation_metrics (recommendation_id, metric_evidence) VALUES (
            v_rec_id,
            jsonb_build_object(
                'puzzle_rating', v_rec.rating,
                'target_themes', v_rec.themes,
                'generated_at', CURRENT_TIMESTAMP
            )
        );
        INSERT INTO recommendation_completion_states (recommendation_id, is_completed) VALUES (v_rec_id, FALSE);
        INSERT INTO recommendation_creation_times (recommendation_id, created_at) VALUES (v_rec_id, CURRENT_TIMESTAMP);

        v_count := v_count + 1;
        EXIT WHEN v_count >= p_limit;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. DIAGNOSTIC TELEMETRY FUNCTION FOR DAY 15
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_verify_day15_puzzles()
RETURNS JSONB AS $$
DECLARE
    v_theme_count INT;
    v_puzzle_count INT;
    v_view_puzzle_count INT;
    v_sample_puzzle RECORD;
    v_test_user_id UUID;
    v_personalized_count INT;
    v_passed BOOLEAN;
BEGIN
    -- 1. Check theme catalog count
    SELECT COUNT(*)::INT INTO v_theme_count FROM puzzle_theme_types;

    -- 2. Check 6NF training_puzzles count
    SELECT COUNT(*)::INT INTO v_puzzle_count FROM training_puzzles;

    -- 3. Check 3NF reconstruction view v_training_puzzles
    SELECT COUNT(*)::INT INTO v_view_puzzle_count FROM v_training_puzzles;

    -- 4. Sample puzzle themes aggregation
    SELECT id, rating, themes INTO v_sample_puzzle FROM v_training_puzzles LIMIT 1;

    -- 5. Test fn_generate_personalized_puzzles
    SELECT id INTO v_test_user_id FROM users LIMIT 1;
    IF v_test_user_id IS NULL THEN
        v_test_user_id := uuid_generate_v4();
    END IF;

    SELECT COUNT(*)::INT INTO v_personalized_count
    FROM fn_generate_personalized_puzzles(v_test_user_id, 5);

    v_passed := (
        v_theme_count >= 10 AND
        v_puzzle_count >= 20 AND
        v_view_puzzle_count >= 20 AND
        v_sample_puzzle.id IS NOT NULL AND
        v_personalized_count > 0
    );

    RETURN jsonb_build_object(
        'status', CASE WHEN v_passed THEN 'PASSED' ELSE 'FAILED' END,
        'theme_types_count', v_theme_count,
        'puzzles_count', v_puzzle_count,
        'view_puzzles_count', v_view_puzzle_count,
        'sample_puzzle_id', v_sample_puzzle.id,
        'sample_puzzle_rating', v_sample_puzzle.rating,
        'personalized_generator_active', (v_personalized_count > 0),
        'verified_at', CURRENT_TIMESTAMP
    );
END;
$$ LANGUAGE plpgsql;
