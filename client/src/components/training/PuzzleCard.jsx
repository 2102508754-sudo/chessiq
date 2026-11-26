/**
 * ChessIQ v3.3.0 — Recommendation Puzzle Card
 * Day 15 (@FE): Renders individual personalized puzzle recommendation summary
 * from v_training_recommendations & v_training_puzzles.
 */

import React from "react";
import { CheckCircle2, Circle, Zap } from "lucide-react";

export default function PuzzleCard({ puzzle, index, isSelected, onSelect }) {
  if (!puzzle) return null;

  return (
    <button
      type="button"
      onClick={() => onSelect(index)}
      style={{
        width: "100%",
        textAlign: "left",
        padding: "12px 14px",
        borderRadius: "10px",
        border: isSelected
          ? "1px solid rgba(56, 189, 248, 0.55)"
          : "1px solid var(--border-color)",
        background: isSelected
          ? "rgba(56, 189, 248, 0.12)"
          : "rgba(255, 255, 255, 0.02)",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        transition: "border-color 0.15s ease, background 0.15s ease",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          width: "100%",
          gap: "8px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {puzzle.isCompleted ? (
            <CheckCircle2 size={14} color="var(--accent-emerald)" />
          ) : (
            <Circle size={14} color="var(--accent-cyan)" />
          )}
          <span
            style={{
              fontSize: "12px",
              fontWeight: "700",
              color: isSelected ? "var(--text-primary)" : "var(--accent-cyan)",
            }}
          >
            #{index + 1} • {puzzle.category}
          </span>
        </div>

        {puzzle.rating !== null && puzzle.rating !== undefined && (
          <span
            style={{
              fontSize: "11px",
              fontFamily: "var(--font-mono)",
              padding: "2px 6px",
              borderRadius: "4px",
              background: "rgba(99, 102, 241, 0.15)",
              color: "#a5b4fc",
            }}
          >
            {puzzle.rating}
          </span>
        )}
      </div>

      <p
        style={{
          fontSize: "12px",
          color: "var(--text-secondary)",
          lineHeight: "1.4",
          margin: 0,
        }}
      >
        {puzzle.description}
      </p>

      {puzzle.metricEvidence?.cpl_lost !== undefined && (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            fontSize: "11px",
            color: "#fbbf24",
          }}
        >
          <Zap size={12} /> Source blunder: {puzzle.metricEvidence.cpl_lost} cp
          loss
        </div>
      )}
    </button>
  );
}
