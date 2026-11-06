/**
 * ChessIQ v3.3.0 — Interactive Chessboard & Dynamic Board Flipping Component
 *
 * Implements Day 11 Sprint Specification:
 * - High-performance react-chessboard integration with legal piece dragging and click-to-move
 * - Dynamic board flipping (White/Black) with keyboard shortcut ('F') and synchronized eval bar inversion
 * - Full legal move indicators (centered dots for quiet moves, target rings for captures)
 * - Last move highlights, check alerts, and engine best-move arrows (react-chessboard customArrows)
 * - Non-destructive Interactive Exploration / Try-a-Move variation engine
 * - Synthesized zero-latency Web Audio sound effects (move, capture, check, castle)
 * - Customizable theme palettes (Classic Emerald, Ocean Marine, Slate Modern, Cyber Purple)
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import {
  RotateCcw,
  Volume2,
  VolumeX,
  Compass,
  Palette,
  Undo2,
  XCircle,
  Eye,
  EyeOff,
  Sparkles,
  Crown,
} from "lucide-react";
import { chessAudio } from "../utils/chessAudio";

// Board color themes
export const BOARD_THEMES = {
  emerald: {
    name: "Classic Emerald",
    dark: "#779556",
    light: "#eaebd0",
  },
  marine: {
    name: "Ocean Marine",
    dark: "#4a75a0",
    light: "#cddbe8",
  },
  slate: {
    name: "Slate Modern",
    dark: "#475569",
    light: "#cbd5e1",
  },
  cyber: {
    name: "Cyber Purple",
    dark: "#312e81",
    light: "#818cf8",
  },
};

/**
 * Safely parse a SAN string or UCI string against a FEN position to extract [from, to] squares
 */
export function parseMoveToSquares(moveStr, fen) {
  if (!moveStr || !fen) return null;

  // Case 1: UCI string (e.g. "e2e4" or "e7e8q")
  if (/^[a-h][1-8][a-h][1-8][qrbn]?$/i.test(moveStr)) {
    return [moveStr.slice(0, 2).toLowerCase(), moveStr.slice(2, 4).toLowerCase()];
  }

  // Case 2: SAN string (e.g. "25... Re8", "Nxe4", "e4", "O-O")
  try {
    const clean = moveStr.replace(/^\d+(\.{1,3})\s*/, "").trim();
    const tempChess = new Chess(fen);
    const result = tempChess.move(clean);
    if (result) {
      return [result.from, result.to];
    }
  } catch (_) {
    // If exact move isn't legal from this FEN, return null
  }
  return null;
}

export default function InteractiveChessboard({
  position,
  currentMove = null,
  boardOrientation = "white",
  onOrientationChange,
  evalBarPercent = 50,
  advantage = { scoreStr: "0.0", leader: "EQUAL" },
  onMovePlayed,
  showEngineArrow = true,
  onToggleEngineArrow,
  isSoundEnabled = true,
  onToggleSound,
}) {
  // Exploration / Variation Mode State
  const [isExploring, setIsExploring] = useState(false);
  const [explorationMoves, setExplorationMoves] = useState([]);
  const [explorationFen, setExplorationFen] = useState(null);

  // Click-to-Move Selection State
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [legalMoves, setLegalMoves] = useState([]);

  // Board Theme
  const [themeKey, setThemeKey] = useState("emerald");
  const currentTheme = BOARD_THEMES[themeKey] || BOARD_THEMES.emerald;

  // Active FEN: Exploration FEN if in exploration mode, otherwise base position
  const activeFen = useMemo(() => {
    return isExploring && explorationFen ? explorationFen : position;
  }, [isExploring, explorationFen, position]);

  // Active Chess instance for legal move calculation and check detection
  const activeChess = useMemo(() => {
    try {
      return new Chess(activeFen);
    } catch (_) {
      return new Chess();
    }
  }, [activeFen]);

  // Reset exploration mode when base position changes externally (user navigated moves)
  useEffect(() => {
    setIsExploring(false);
    setExplorationMoves([]);
    setExplorationFen(null);
    setSelectedSquare(null);
    setLegalMoves([]);
  }, [position]);

  // Sound sync
  useEffect(() => {
    chessAudio.setMuted(!isSoundEnabled);
  }, [isSoundEnabled]);

  // Find King square if in check
  const checkedKingSquare = useMemo(() => {
    if (!activeChess.isCheck()) return null;
    const turn = activeChess.turn(); // 'w' | 'b'
    const targetPiece = `${turn}K`; // 'wK' | 'bK'
    const board = activeChess.board();
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
  }, [activeChess]);

  // Last move squares (from & to) for highlighting
  const lastMoveSquares = useMemo(() => {
    if (isExploring && explorationMoves.length > 0) {
      const last = explorationMoves[explorationMoves.length - 1];
      return { from: last.from, to: last.to };
    }
    if (currentMove?.uci && currentMove.uci.length >= 4) {
      return {
        from: currentMove.uci.slice(0, 2),
        to: currentMove.uci.slice(2, 4),
      };
    }
    return null;
  }, [isExploring, explorationMoves, currentMove]);

  // Custom Square Styles (selected square, legal move dots, check glow, last move tint)
  const customSquareStyles = useMemo(() => {
    const styles = {};

    // 1. Highlight Last Move
    if (lastMoveSquares) {
      styles[lastMoveSquares.from] = {
        backgroundColor: "rgba(245, 158, 11, 0.28)",
      };
      styles[lastMoveSquares.to] = {
        backgroundColor: "rgba(245, 158, 11, 0.38)",
      };
    }

    // 2. Highlight King in Check
    if (checkedKingSquare) {
      styles[checkedKingSquare] = {
        background:
          "radial-gradient(ellipse at center, rgba(239, 68, 68, 0.9) 0%, rgba(239, 68, 68, 0.4) 65%, transparent 80%)",
      };
    }

    // 3. Highlight Selected Square
    if (selectedSquare) {
      styles[selectedSquare] = {
        backgroundColor: "rgba(56, 189, 248, 0.4)",
        boxShadow: "inset 0 0 0 3px #38bdf8",
      };
    }

    // 4. Highlight Legal Moves (Quiet = Centered Dot, Capture = Ring)
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
  }, [lastMoveSquares, checkedKingSquare, selectedSquare, legalMoves]);

  // Best Move / Threat Arrows via react-chessboard customArrows
  const customArrows = useMemo(() => {
    if (!showEngineArrow) return [];
    const arrows = [];

    // If game review provides a recommended bestMove
    if (currentMove?.bestMove) {
      const squares = parseMoveToSquares(currentMove.bestMove, currentMove.fenBefore || position);
      if (squares) {
        arrows.push([squares[0], squares[1], "rgb(56, 189, 248)"]); // Bright Cyan
      }
    }

    // If the move was a blunder/mistake, optionally add a threat indicator
    if (
      currentMove &&
      (currentMove.classification === "BLUNDER" || currentMove.classification === "MISTAKE") &&
      lastMoveSquares
    ) {
      arrows.push([lastMoveSquares.from, lastMoveSquares.to, "rgba(244, 63, 94, 0.75)"]); // Rose Red
    }

    return arrows;
  }, [showEngineArrow, currentMove, position, lastMoveSquares]);

  // Execute sound trigger based on move flags
  const triggerMoveSound = useCallback(
    (moveResult, chessInstance) => {
      if (!isSoundEnabled) return;
      if (chessInstance.isCheck() || chessInstance.isCheckmate()) {
        chessAudio.playCheck();
      } else if (moveResult.captured) {
        chessAudio.playCapture();
      } else if (moveResult.flags.includes("k") || moveResult.flags.includes("q")) {
        chessAudio.playCastle();
      } else {
        chessAudio.playMove();
      }
    },
    [isSoundEnabled]
  );

  // Handle Piece Drop (Drag & Drop)
  const handlePieceDrop = useCallback(
    (sourceSquare, targetSquare) => {
      try {
        const tempChess = new Chess(activeFen);
        const move = tempChess.move({
          from: sourceSquare,
          to: targetSquare,
          promotion: "q", // Auto-queen on drag-and-drop
        });

        if (!move) return false;

        // Play audio
        triggerMoveSound(move, tempChess);

        // Check if this move matches the actual game review line
        if (onMovePlayed) {
          const matched = onMovePlayed(move);
          if (matched) {
            setSelectedSquare(null);
            setLegalMoves([]);
            return true;
          }
        }

        // Diverging move: enter exploration / try-a-move mode
        setIsExploring(true);
        const newMoves = [
          ...explorationMoves,
          {
            san: move.san,
            from: move.from,
            to: move.to,
            captured: move.captured,
            fen: tempChess.fen(),
          },
        ];
        setExplorationMoves(newMoves);
        setExplorationFen(tempChess.fen());
        setSelectedSquare(null);
        setLegalMoves([]);
        return true;
      } catch (_) {
        // Illegal move: react-chessboard will snap back
        return false;
      }
    },
    [activeFen, explorationMoves, triggerMoveSound, onMovePlayed]
  );

  // Handle Square Click (Click-to-Move)
  const handleSquareClick = useCallback(
    (square) => {
      // If a piece is already selected:
      if (selectedSquare) {
        // Clicking same square deselects
        if (selectedSquare === square) {
          setSelectedSquare(null);
          setLegalMoves([]);
          return;
        }

        // Check if target square is in legal moves
        const isLegal = legalMoves.some((m) => m.to === square);
        if (isLegal) {
          handlePieceDrop(selectedSquare, square);
          return;
        }

        // If clicking another piece of the current turn's color, switch selection
        const pieceOnSquare = activeChess.get(square);
        if (pieceOnSquare && pieceOnSquare.color === activeChess.turn()) {
          setSelectedSquare(square);
          const moves = activeChess.moves({ square, verbose: true });
          setLegalMoves(moves);
          return;
        }

        // Otherwise deselect
        setSelectedSquare(null);
        setLegalMoves([]);
        return;
      }

      // No piece selected: check if clicked square contains active player's piece
      const piece = activeChess.get(square);
      if (piece && piece.color === activeChess.turn()) {
        setSelectedSquare(square);
        const moves = activeChess.moves({ square, verbose: true });
        setLegalMoves(moves);
      }
    },
    [selectedSquare, legalMoves, activeChess, handlePieceDrop]
  );

  // Reset Exploration mode
  const exitExploration = useCallback(() => {
    setIsExploring(false);
    setExplorationMoves([]);
    setExplorationFen(null);
    setSelectedSquare(null);
    setLegalMoves([]);
  }, []);

  // Undo last move in exploration mode
  const undoExplorationMove = useCallback(() => {
    if (explorationMoves.length <= 1) {
      exitExploration();
      return;
    }
    const updated = explorationMoves.slice(0, -1);
    setExplorationMoves(updated);
    setExplorationFen(updated[updated.length - 1].fen);
    setSelectedSquare(null);
    setLegalMoves([]);
  }, [explorationMoves, exitExploration]);

  // Flip Board
  const toggleOrientation = useCallback(() => {
    if (onOrientationChange) {
      onOrientationChange(boardOrientation === "white" ? "black" : "white");
    }
  }, [boardOrientation, onOrientationChange]);

  // Cycle Theme
  const cycleTheme = useCallback(() => {
    const keys = Object.keys(BOARD_THEMES);
    const nextIdx = (keys.indexOf(themeKey) + 1) % keys.length;
    setThemeKey(keys[nextIdx]);
  }, [themeKey]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {/* EXPLORATION VARIATION BANNER */}
      {isExploring && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "linear-gradient(135deg, rgba(56, 189, 248, 0.15) 0%, rgba(99, 102, 241, 0.15) 100%)",
            border: "1px solid rgba(56, 189, 248, 0.4)",
            borderRadius: "8px",
            padding: "8px 14px",
            fontSize: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Sparkles size={16} color="var(--accent-cyan)" />
            <span>
              <strong>Exploration Line:</strong>{" "}
              {explorationMoves.map((m, idx) => (
                <span
                  key={idx}
                  style={{
                    fontFamily: "var(--font-mono)",
                    marginRight: "6px",
                    color: "var(--accent-cyan)",
                    fontWeight: "600",
                  }}
                >
                  {m.san}
                </span>
              ))}
            </span>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={undoExplorationMove}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                padding: "4px 8px",
                borderRadius: "4px",
                background: "rgba(255, 255, 255, 0.08)",
                border: "1px solid var(--border-color)",
                color: "var(--text-primary)",
                cursor: "pointer",
                fontSize: "11px",
              }}
              title="Undo Last Explored Move"
            >
              <Undo2 size={13} /> Undo
            </button>
            <button
              onClick={exitExploration}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                padding: "4px 8px",
                borderRadius: "4px",
                background: "rgba(244, 63, 94, 0.2)",
                border: "1px solid rgba(244, 63, 94, 0.4)",
                color: "#fb7185",
                cursor: "pointer",
                fontSize: "11px",
                fontWeight: "600",
              }}
              title="Return to Game Review"
            >
              <XCircle size={13} /> Exit Line
            </button>
          </div>
        </div>
      )}

      {/* CHESSBOARD WITH SYNCHRONIZED EVALUATION BAR */}
      <div
        className="glass-panel"
        style={{
          padding: "16px",
          display: "flex",
          gap: "14px",
          alignItems: "stretch",
        }}
      >
        {/* Synchronized Evaluation Bar with Dynamic Flipping Inversion */}
        <div
          style={{
            width: "32px",
            background: "#1e293b",
            borderRadius: "6px",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            justifyContent: boardOrientation === "white" ? "flex-end" : "flex-start",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            position: "relative",
            boxShadow: "inset 0 2px 4px rgba(0, 0, 0, 0.5)",
          }}
          title={`Evaluation: ${advantage.scoreStr} pawns (${boardOrientation.toUpperCase()} perspective)`}
        >
          {/* Top Piece Marker */}
          <span
            style={{
              position: "absolute",
              top: "4px",
              left: 0,
              right: 0,
              textAlign: "center",
              fontSize: "9px",
              color: boardOrientation === "white" ? "#94a3b8" : "#f8fafc",
              zIndex: 3,
            }}
          >
            {boardOrientation === "white" ? "B" : "W"}
          </span>

          {/* White Advantage Fill Bar */}
          <div
            style={{
              width: "100%",
              height: `${evalBarPercent}%`,
              background: "#f8fafc",
              transition: "height 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          />

          {/* Evaluation Score Label */}
          <span
            style={{
              position: "absolute",
              bottom: evalBarPercent > 50 ? "18px" : "auto",
              top: evalBarPercent <= 50 ? "18px" : "auto",
              left: 0,
              right: 0,
              textAlign: "center",
              fontSize: "10px",
              fontFamily: "var(--font-mono)",
              color: evalBarPercent > 50 ? "#0f172a" : "#f8fafc",
              fontWeight: "800",
              zIndex: 4,
              textShadow: evalBarPercent <= 50 ? "0 1px 2px rgba(0,0,0,0.8)" : "none",
            }}
          >
            {advantage.scoreStr}
          </span>

          {/* Bottom Piece Marker */}
          <span
            style={{
              position: "absolute",
              bottom: "4px",
              left: 0,
              right: 0,
              textAlign: "center",
              fontSize: "9px",
              color: boardOrientation === "white" ? "#0f172a" : "#94a3b8",
              zIndex: 3,
            }}
          >
            {boardOrientation === "white" ? "W" : "B"}
          </span>
        </div>

        {/* Interactive react-chessboard */}
        <div style={{ flex: 1, maxWidth: "510px", position: "relative" }}>
          <Chessboard
            position={activeFen}
            boardOrientation={boardOrientation}
            arePiecesDraggable={true}
            autoPromoteToQueen={true}
            onPieceDrop={handlePieceDrop}
            onSquareClick={handleSquareClick}
            customSquareStyles={customSquareStyles}
            customArrows={customArrows}
            customDarkSquareStyle={{ backgroundColor: currentTheme.dark }}
            customLightSquareStyle={{ backgroundColor: currentTheme.light }}
            customBoardStyle={{
              borderRadius: "8px",
              boxShadow: "0 10px 30px rgba(0, 0, 0, 0.55)",
            }}
            animationDuration={250}
          />
        </div>
      </div>

      {/* QUICK TOOLBAR: THEME, ARROW TOGGLE, SOUND TOGGLE & ORIENTATION */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "8px 12px",
          background: "rgba(255, 255, 255, 0.03)",
          borderRadius: "8px",
          border: "1px solid var(--border-color)",
          fontSize: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {/* Flip Board Button */}
          <button
            onClick={toggleOrientation}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              borderRadius: "6px",
              background: "rgba(56, 189, 248, 0.12)",
              border: "1px solid rgba(56, 189, 248, 0.3)",
              color: "var(--accent-cyan)",
              cursor: "pointer",
              fontWeight: "600",
            }}
            title="Flip Board Orientation (HotKey: F)"
          >
            <RotateCcw size={14} />
            <span>Flip ({boardOrientation.toUpperCase()})</span>
          </button>

          {/* Theme Selector */}
          <button
            onClick={cycleTheme}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              borderRadius: "6px",
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid var(--border-color)",
              color: "var(--text-secondary)",
              cursor: "pointer",
            }}
            title={`Switch Board Theme (Current: ${currentTheme.name})`}
          >
            <Palette size={14} />
            <span>{currentTheme.name}</span>
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {/* Engine Arrow Toggle */}
          <button
            onClick={onToggleEngineArrow}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 10px",
              borderRadius: "6px",
              background: showEngineArrow
                ? "rgba(16, 185, 129, 0.15)"
                : "rgba(255, 255, 255, 0.05)",
              border: showEngineArrow
                ? "1px solid rgba(16, 185, 129, 0.4)"
                : "1px solid var(--border-color)",
              color: showEngineArrow ? "var(--accent-emerald)" : "var(--text-secondary)",
              cursor: "pointer",
            }}
            title="Toggle Engine Best Move Arrow (HotKey: A)"
          >
            {showEngineArrow ? <Eye size={14} /> : <EyeOff size={14} />}
            <span>Best Arrow</span>
          </button>

          {/* Audio Mute Toggle */}
          <button
            onClick={onToggleSound}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 10px",
              borderRadius: "6px",
              background: isSoundEnabled
                ? "rgba(255, 255, 255, 0.08)"
                : "rgba(244, 63, 94, 0.15)",
              border: isSoundEnabled
                ? "1px solid var(--border-color)"
                : "1px solid rgba(244, 63, 94, 0.3)",
              color: isSoundEnabled ? "var(--text-secondary)" : "#fb7185",
              cursor: "pointer",
            }}
            title="Toggle Audio Feedback (HotKey: M)"
          >
            {isSoundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
            <span>{isSoundEnabled ? "Sound ON" : "Muted"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

