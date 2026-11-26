/**
 * ChessIQ v3.3.0 — Puzzle Navigation & Hint Controls
 * Day 15 (@FE): Supports Prev/Next puzzle switching, puzzle reset, and incremental hints.
 */

import React from "react";
import { ChevronLeft, ChevronRight, RotateCcw, Lightbulb } from "lucide-react";

export default function PuzzleControls({
  activeIndex,
  totalCount,
  hintLevel,
  isSolved,
  isSubmitting,
  onPrevPuzzle,
  onNextPuzzle,
  onResetPuzzle,
  onRequestHint,
}) {
  return (
    <div
      className="glass-panel"
      style={{
        padding: "12px 16px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "10px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <button
          type="button"
          onClick={onRequestHint}
          disabled={isSolved || isSubmitting || hintLevel >= 2}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "7px 12px",
            borderRadius: "6px",
            background: "rgba(245, 158, 11, 0.14)",
            border: "1px solid rgba(245, 158, 11, 0.38)",
            color: "#fbbf24",
            fontSize: "12px",
            fontWeight: "600",
            cursor:
              isSolved || isSubmitting || hintLevel >= 2
                ? "not-allowed"
                : "pointer",
            opacity: isSolved || isSubmitting || hintLevel >= 2 ? 0.5 : 1,
          }}
          title="Reveal source piece first, or move direction on second click"
        >
          <Lightbulb size={14} />
          {hintLevel === 0
            ? "Hint"
            : hintLevel === 1
              ? "Show Move Arrow"
              : "Hint Active"}
        </button>

        <button
          type="button"
          onClick={onResetPuzzle}
          disabled={isSubmitting}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "7px 12px",
            borderRadius: "6px",
            background: "rgba(255, 255, 255, 0.05)",
            border: "1px solid var(--border-color)",
            color: "var(--text-secondary)",
            fontSize: "12px",
            fontWeight: "600",
            cursor: isSubmitting ? "wait" : "pointer",
          }}
        >
          <RotateCcw size={14} /> Reset Puzzle
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <button
          type="button"
          onClick={onPrevPuzzle}
          disabled={activeIndex <= 0}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            padding: "7px 10px",
            borderRadius: "6px",
            background: "rgba(255, 255, 255, 0.05)",
            border: "1px solid var(--border-color)",
            color:
              activeIndex <= 0 ? "var(--text-muted)" : "var(--text-primary)",
            fontSize: "12px",
            fontWeight: "600",
            cursor: activeIndex <= 0 ? "not-allowed" : "pointer",
          }}
        >
          <ChevronLeft size={14} /> Prev
        </button>

        <span
          style={{
            fontSize: "12px",
            fontFamily: "var(--font-mono)",
            color: "var(--text-secondary)",
          }}
        >
          {totalCount > 0 ? `${activeIndex + 1} / ${totalCount}` : "0 / 0"}
        </span>

        <button
          type="button"
          onClick={onNextPuzzle}
          disabled={activeIndex >= totalCount - 1}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            padding: "7px 10px",
            borderRadius: "6px",
            background: "rgba(56, 189, 248, 0.14)",
            border: "1px solid rgba(56, 189, 248, 0.35)",
            color:
              activeIndex >= totalCount - 1
                ? "var(--text-muted)"
                : "var(--accent-cyan)",
            fontSize: "12px",
            fontWeight: "600",
            cursor: activeIndex >= totalCount - 1 ? "not-allowed" : "pointer",
          }}
        >
          Next <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
