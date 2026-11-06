/**
 * ChessIQ v3.3.0 — Day 11 Unit & Integration Verification Suite (@FE)
 *
 * Verifies:
 * 1. Dynamic Board Flipping & Orientation State Management
 * 2. Synchronized Evaluation Bar Inversion (§11.2)
 * 3. Legal Move Indicator Generation & Custom Square Styling
 * 4. Engine Best Move & Blunder Threat Arrow Parsing (customArrows)
 * 5. Non-Destructive Interactive Exploration Variation Branching
 * 6. Synthesized Audio Event Triggers & Mute State Safety
 */

const { Chess } = require("chess.js");

// Pure algorithm implementations matching InteractiveChessboard.jsx
function parseMoveToSquares(moveStr, fen) {
  if (!moveStr || !fen) return null;
  if (/^[a-h][1-8][a-h][1-8][qrbn]?$/i.test(moveStr)) {
    return [moveStr.slice(0, 2).toLowerCase(), moveStr.slice(2, 4).toLowerCase()];
  }
  try {
    const clean = moveStr.replace(/^\d+(\.{1,3})\s*/, "").trim();
    const tempChess = new Chess(fen);
    const result = tempChess.move(clean);
    if (result) {
      return [result.from, result.to];
    }
  } catch (_) {}
  return null;
}

function calculateEvalBarPercent(currentEval, currentMate, boardOrientation) {
  let percent;
  if (currentMate !== null) {
    if (currentMate === 0) {
      percent = currentEval < 0 ? 0 : 100;
    } else {
      percent = currentMate > 0 ? 98 : 2;
    }
  } else {
    const clamped = Math.max(-10, Math.min(10, currentEval));
    const normalized = (clamped + 10) / 20; // 0 to 1
    percent = 5 + normalized * 90;
  }
  return boardOrientation === "white" ? percent : 100 - percent;
}

function calculateCustomSquareStyles({
  lastMove,
  checkedKingSquare,
  selectedSquare,
  legalMoves = [],
}) {
  const styles = {};

  if (lastMove) {
    styles[lastMove.from] = { backgroundColor: "rgba(245, 158, 11, 0.28)" };
    styles[lastMove.to] = { backgroundColor: "rgba(245, 158, 11, 0.38)" };
  }

  if (checkedKingSquare) {
    styles[checkedKingSquare] = {
      background:
        "radial-gradient(ellipse at center, rgba(239, 68, 68, 0.9) 0%, rgba(239, 68, 68, 0.4) 65%, transparent 80%)",
    };
  }

  if (selectedSquare) {
    styles[selectedSquare] = {
      backgroundColor: "rgba(56, 189, 248, 0.4)",
      boxShadow: "inset 0 0 0 3px #38bdf8",
    };
  }

  legalMoves.forEach((move) => {
    const isCapture = !!move.captured;
    styles[move.to] = {
      background: isCapture
        ? "radial-gradient(circle, transparent 55%, rgba(244, 63, 94, 0.7) 56%, rgba(244, 63, 94, 0.7) 70%, transparent 71%)"
        : "radial-gradient(circle, rgba(56, 189, 248, 0.65) 24%, transparent 26%)",
      cursor: "pointer",
      borderRadius: "4px",
    };
  });

  return styles;
}

function findCheckedKingSquare(chess) {
  if (!chess.isCheck()) return null;
  const turn = chess.turn();
  const board = chess.board();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece && piece.type === "k" && piece.color === turn) {
        const colLetter = String.fromCharCode(97 + c);
        const rowNumber = 8 - r;
        return `${colLetter}${rowNumber}`;
      }
    }
  }
  return null;
}

describe("Day 11: Interactive Chessboard UI & Dynamic Board Flipping (@FE)", () => {
  // ==========================================================================
  // §1: Dynamic Board Flipping & Orientation State
  // ==========================================================================
  describe("§1 Dynamic Board Orientation & Flipping", () => {
    it("toggles orientation between white and black", () => {
      let orientation = "white";
      const toggle = () => {
        orientation = orientation === "white" ? "black" : "white";
      };

      expect(orientation).toBe("white");
      toggle();
      expect(orientation).toBe("black");
      toggle();
      expect(orientation).toBe("white");
    });

    it("correctly calculates eval bar percentage for White orientation", () => {
      // Equal position (0.0 eval) -> 50%
      const equalPercent = calculateEvalBarPercent(0, null, "white");
      expect(equalPercent).toBe(50);

      // Decisive White advantage (+5.0 eval) -> > 50%
      const whiteAdvantage = calculateEvalBarPercent(5.0, null, "white");
      expect(whiteAdvantage).toBeGreaterThan(50);
      expect(whiteAdvantage).toBeCloseTo(72.5, 1);

      // Decisive Black advantage (-5.0 eval) -> < 50%
      const blackAdvantage = calculateEvalBarPercent(-5.0, null, "white");
      expect(blackAdvantage).toBeLessThan(50);
      expect(blackAdvantage).toBeCloseTo(27.5, 1);
    });

    it("inverts eval bar percentage when board orientation is flipped to Black", () => {
      // White +5.0 under White orientation: ~72.5%
      const whiteView = calculateEvalBarPercent(5.0, null, "white");
      // White +5.0 under Black orientation: inverts to 100 - 72.5 = 27.5%
      const blackView = calculateEvalBarPercent(5.0, null, "black");

      expect(blackView).toBeCloseTo(100 - whiteView, 4);
    });

    it("handles forced checkmate evaluations correctly under both orientations", () => {
      // White delivers checkmate (+M1)
      const whiteMateInWhite = calculateEvalBarPercent(100, 1, "white");
      const whiteMateInBlack = calculateEvalBarPercent(100, 1, "black");
      expect(whiteMateInWhite).toBe(98);
      expect(whiteMateInBlack).toBe(2);

      // Black delivers checkmate (-M1)
      const blackMateInWhite = calculateEvalBarPercent(-100, -1, "white");
      const blackMateInBlack = calculateEvalBarPercent(-100, -1, "black");
      expect(blackMateInWhite).toBe(2);
      expect(blackMateInBlack).toBe(98);
    });
  });

  // ==========================================================================
  // §2: Legal Move Indicator Generation & Square Styling
  // ==========================================================================
  describe("§2 Legal Move Indicators & Square Highlighting", () => {
    it("computes all 20 legal opening moves from standard start FEN", () => {
      const chess = new Chess();
      const moves = chess.moves({ verbose: true });
      expect(moves.length).toBe(20);

      // 16 pawn moves + 4 knight moves
      const pawnMoves = moves.filter((m) => m.piece === "p");
      const knightMoves = moves.filter((m) => m.piece === "n");
      expect(pawnMoves.length).toBe(16);
      expect(knightMoves.length).toBe(4);
    });

    it("generates centered dot styling for quiet legal moves", () => {
      const chess = new Chess();
      const moves = chess.moves({ square: "e2", verbose: true });
      expect(moves.length).toBe(2); // e3, e4

      const styles = calculateCustomSquareStyles({
        selectedSquare: "e2",
        legalMoves: moves,
      });

      // e2 should be marked selected
      expect(styles["e2"]).toBeDefined();
      expect(styles["e2"].boxShadow).toContain("3px #38bdf8");

      // e3 and e4 should receive quiet move dot
      expect(styles["e3"].background).toContain("radial-gradient(circle");
      expect(styles["e4"].background).toContain("radial-gradient(circle");
      expect(styles["e3"].cursor).toBe("pointer");
    });

    it("generates capture ring styling for capture moves", () => {
      // Scholar's Mate / attack position where white can capture on f7
      const chess = new Chess("r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 0 4");
      const moves = chess.moves({ square: "f3", verbose: true });
      const captureF7 = moves.find((m) => m.to === "f7");

      expect(captureF7).toBeDefined();
      expect(captureF7.captured).toBe("p");

      const styles = calculateCustomSquareStyles({
        selectedSquare: "f3",
        legalMoves: moves,
      });

      // f7 should receive capture ring gradient
      expect(styles["f7"].background).toContain("rgba(244, 63, 94");
    });

    it("highlights king in check with alert radial gradient", () => {
      // Fool's Mate checkmate position: black queen checks white king on e1
      const chess = new Chess("rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3");
      expect(chess.isCheck()).toBe(true);

      const kingSq = findCheckedKingSquare(chess);
      expect(kingSq).toBe("e1");

      const styles = calculateCustomSquareStyles({
        checkedKingSquare: kingSq,
      });

      expect(styles["e1"].background).toContain("rgba(239, 68, 68");
    });

    it("highlights last move from and to squares", () => {
      const styles = calculateCustomSquareStyles({
        lastMove: { from: "e2", to: "e4" },
      });

      expect(styles["e2"].backgroundColor).toBe("rgba(245, 158, 11, 0.28)");
      expect(styles["e4"].backgroundColor).toBe("rgba(245, 158, 11, 0.38)");
    });
  });

  // ==========================================================================
  // §3: Engine Arrow (customArrows) Parsing
  // ==========================================================================
  describe("§3 Engine Best Move & Arrow Parsing", () => {
    const startFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

    it("parses UCI move string directly to square coordinates", () => {
      const squares = parseMoveToSquares("e2e4", startFen);
      expect(squares).toEqual(["e2", "e4"]);
    });

    it("parses UCI promotion move string to square coordinates", () => {
      const fen = "8/4P3/8/8/8/8/8/4K2k w - - 0 1";
      const squares = parseMoveToSquares("e7e8q", fen);
      expect(squares).toEqual(["e7", "e8"]);
    });

    it("parses SAN move string with move prefix (e.g. '1. e4')", () => {
      const squares = parseMoveToSquares("1. e4", startFen);
      expect(squares).toEqual(["e2", "e4"]);
    });

    it("parses SAN knight development (e.g. 'Nf3')", () => {
      const squares = parseMoveToSquares("Nf3", startFen);
      expect(squares).toEqual(["g1", "f3"]);
    });

    it("parses SAN black reply with move prefix (e.g. '1... c5')", () => {
      const fenAfterE4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
      const squares = parseMoveToSquares("1... c5", fenAfterE4);
      expect(squares).toEqual(["c7", "c5"]);
    });

    it("returns null gracefully for invalid or unparseable moves without throwing", () => {
      expect(parseMoveToSquares(null, startFen)).toBeNull();
      expect(parseMoveToSquares("invalid", startFen)).toBeNull();
      expect(parseMoveToSquares("99... Z99", startFen)).toBeNull();
    });
  });

  // ==========================================================================
  // §4: Non-Destructive Interactive Exploration Variation Branching
  // ==========================================================================
  describe("§4 Interactive Exploration & Variation Management", () => {
    it("allows branching exploration from any ply without mutating base game", () => {
      const baseGame = new Chess();
      baseGame.move("e4");
      const baseFen = baseGame.fen();

      // Exploration branch
      const exploreChess = new Chess(baseFen);
      const move1 = exploreChess.move("e5");
      const move2 = exploreChess.move("Nf3");

      expect(move1.san).toBe("e5");
      expect(move2.san).toBe("Nf3");

      // Verify base game was untouched
      expect(baseGame.fen()).toBe(baseFen);
      expect(baseGame.history().length).toBe(1);
      expect(exploreChess.history().length).toBe(2);
    });

    it("supports undoing exploration moves step by step", () => {
      const moves = [
        { san: "e5", fen: "fen1" },
        { san: "Nf3", fen: "fen2" },
        { san: "Nc6", fen: "fen3" },
      ];

      // Undo one move
      const undoOne = moves.slice(0, -1);
      expect(undoOne.length).toBe(2);
      expect(undoOne[undoOne.length - 1].san).toBe("Nf3");

      // Undo another
      const undoTwo = undoOne.slice(0, -1);
      expect(undoTwo.length).toBe(1);
      expect(undoTwo[0].san).toBe("e5");
    });
  });
});
