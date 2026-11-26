/**
 * ChessIQ v3.3.0 — Interactive Training Puzzle Board
 * Day 15 (@FE): Reuses InteractiveChessboard with side-to-move orientation,
 * drag-and-drop / click-to-move support, chess.js legal move constraints,
 * and sequential hint highlights without duplicating board UI logic.
 */

import React from "react";
import InteractiveChessboard from "../InteractiveChessboard";
import { PUZZLE_SOLVE_STATE } from "../../hooks/useTrainingPuzzles";

export default function PuzzleBoard({
  boardFen,
  boardOrientation,
  onOrientationChange,
  solveState,
  hintVisuals,
  isSoundEnabled,
  onToggleSound,
  onAttemptMove,
}) {
  if (!boardFen) return null;

  const isLocked =
    solveState === PUZZLE_SOLVE_STATE.SOLVED ||
    solveState === PUZZLE_SOLVE_STATE.SUBMITTING;

  const sideToMove = boardFen.split(" ")[1] === "b" ? "Black" : "White";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {/* Side-to-Move Tactical Indicator Bar */}
      <div
        className="glass-panel"
        style={{
          padding: "10px 16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span
            style={{
              display: "inline-block",
              width: "14px",
              height: "14px",
              borderRadius: "50%",
              background: sideToMove === "White" ? "#f8fafc" : "#0f172a",
              border: "2px solid var(--accent-cyan)",
            }}
          />
          <span
            style={{
              fontSize: "13px",
              fontWeight: "700",
              color: "var(--text-primary)",
            }}
          >
            {sideToMove} to Move
          </span>
        </div>

        <span
          style={{
            fontSize: "11px",
            fontFamily: "var(--font-mono)",
            color:
              solveState === PUZZLE_SOLVE_STATE.SOLVED
                ? "var(--accent-emerald)"
                : "var(--text-secondary)",
          }}
        >
          {solveState === PUZZLE_SOLVE_STATE.SOLVED
            ? "COMPLETED"
            : "INTERACTIVE SOLVER"}
        </span>
      </div>

      {/* Reused InteractiveChessboard Component */}
      <InteractiveChessboard
        position={boardFen}
        currentMove={null}
        boardOrientation={boardOrientation}
        onOrientationChange={onOrientationChange}
        showEngineArrow={false}
        showEvalBar={false}
        disableExploration={true}
        allowInteraction={!isLocked}
        extraSquareStyles={hintVisuals?.squareStyles}
        extraArrows={hintVisuals?.arrows}
        isSoundEnabled={isSoundEnabled}
        onToggleSound={onToggleSound}
        onMovePlayed={onAttemptMove}
      />
    </div>
  );
}
