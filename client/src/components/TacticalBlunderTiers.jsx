/**
 * ChessIQ v3.3.0 — Tactical Blunder Classification Tiers & Navigation
 * Day 13 (@FE): Multi-tier mistake classification, win probability delta (ΔW),
 * tactical blunder filters, next/prev mistake jump controls, and coach explanations.
 */

import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  Award,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Flame,
  HelpCircle,
  ShieldAlert,
  Sparkles,
  Target,
  Zap,
  TrendingDown,
  ArrowRight,
  Check,
} from "lucide-react";

/**
 * Tactical Classification Definitions matching §11.4 of System Design
 */
export const TACTICAL_TIERS = {
  BRILLIANT: {
    key: "BRILLIANT",
    label: "Brilliant",
    symbol: "!!",
    color: "#38bdf8",
    bg: "rgba(56, 189, 248, 0.15)",
    border: "rgba(56, 189, 248, 0.4)",
    description: "A profound, game-winning sacrifice finding the only winning resource.",
  },
  BEST: {
    key: "BEST",
    label: "Best Move",
    symbol: "★",
    color: "#10b981",
    bg: "rgba(16, 185, 129, 0.15)",
    border: "rgba(16, 185, 129, 0.4)",
    description: "The top engine move found by Stockfish NNUE (CPL <= 10).",
  },
  BOOK: {
    key: "BOOK",
    label: "Opening Book",
    symbol: "📖",
    color: "#60a5fa",
    bg: "rgba(96, 165, 250, 0.15)",
    border: "rgba(96, 165, 250, 0.4)",
    description: "Authoritative catalog opening move; excluded from ACPL calculation.",
  },
  GOOD: {
    key: "GOOD",
    label: "Good Move",
    symbol: "✓",
    color: "#94a3b8",
    bg: "rgba(148, 163, 184, 0.12)",
    border: "rgba(148, 163, 184, 0.3)",
    description: "A natural, solid continuation that maintains dynamic balance (10 < CPL <= 30).",
  },
  INACCURACY: {
    key: "INACCURACY",
    label: "Inaccuracy",
    symbol: "?!",
    color: "#f59e0b",
    bg: "rgba(245, 158, 11, 0.15)",
    border: "rgba(245, 158, 11, 0.4)",
    description: "Suboptimal move relinquishing slight positional pressure (30 < CPL <= 90).",
  },
  MISTAKE: {
    key: "MISTAKE",
    label: "Mistake",
    symbol: "?",
    color: "#f97316",
    bg: "rgba(249, 115, 22, 0.15)",
    border: "rgba(249, 115, 22, 0.4)",
    description: "Noticeable tactical concession worsening position significantly (90 < CPL <= 200).",
  },
  BLUNDER: {
    key: "BLUNDER",
    label: "Blunder",
    symbol: "??",
    color: "#f43f5e",
    bg: "rgba(244, 63, 94, 0.2)",
    border: "rgba(244, 63, 94, 0.5)",
    description: "Catastrophic oversight swinging evaluation drastically (CPL > 200 or ΔW >= 25%).",
  },
  MISSED_WIN: {
    key: "MISSED_WIN",
    label: "Missed Win",
    symbol: "⨉",
    color: "#a855f7",
    bg: "rgba(168, 85, 247, 0.18)",
    border: "rgba(168, 85, 247, 0.45)",
    description: "Failed to capitalize on a decisive winning advantage (Win Prob dropped from >80% to <55%).",
  },
};

export default function TacticalBlunderTiers({
  moves = [],
  currentPlyIndex = 0,
  onSelectPly,
}) {
  const [selectedFilter, setSelectedFilter] = useState("ALL"); // "ALL" | "BLUNDER" | "MISTAKE" | "INACCURACY" | "BEST"

  // Active move object
  const activeMove = useMemo(() => {
    if (currentPlyIndex === 0 || !moves.length) return null;
    return moves[currentPlyIndex - 1] || null;
  }, [currentPlyIndex, moves]);

  // Aggregate counts of classifications across all moves
  const tierCounts = useMemo(() => {
    const counts = {
      BLUNDER: 0,
      MISTAKE: 0,
      INACCURACY: 0,
      BEST: 0,
      BOOK: 0,
      GOOD: 0,
      BRILLIANT: 0,
      MISSED_WIN: 0,
    };
    moves.forEach((m) => {
      const cls = (m.classification || "").toUpperCase();
      if (counts[cls] !== undefined) counts[cls] += 1;
    });
    return counts;
  }, [moves]);

  // Filtered plies for fast navigation
  const filteredPlies = useMemo(() => {
    if (selectedFilter === "ALL") return moves;
    if (selectedFilter === "CRITICAL") {
      return moves.filter((m) => {
        const cls = (m.classification || "").toUpperCase();
        return cls === "BLUNDER" || cls === "MISTAKE" || cls === "MISSED_WIN";
      });
    }
    return moves.filter((m) => (m.classification || "").toUpperCase() === selectedFilter);
  }, [moves, selectedFilter]);

  // Find next and previous critical blunder/mistake relative to current ply
  const { prevCriticalPly, nextCriticalPly } = useMemo(() => {
    const critical = moves.filter((m) => {
      const cls = (m.classification || "").toUpperCase();
      return cls === "BLUNDER" || cls === "MISTAKE" || cls === "MISSED_WIN" || cls === "INACCURACY";
    });

    const prev = [...critical].reverse().find((m) => m.ply < currentPlyIndex);
    const next = critical.find((m) => m.ply > currentPlyIndex);

    return {
      prevCriticalPly: prev ? prev.ply : null,
      nextCriticalPly: next ? next.ply : null,
    };
  }, [moves, currentPlyIndex]);

  // Active Tier Definition
  const currentTier = useMemo(() => {
    if (!activeMove) return null;
    const cls = (activeMove.classification || "BEST").toUpperCase();
    return TACTICAL_TIERS[cls] || TACTICAL_TIERS.BEST;
  }, [activeMove]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      {/* TIER FILTER PILLS & JUMP CONTROLS */}
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
        {/* Filter Pills */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
          <button
            onClick={() => setSelectedFilter("ALL")}
            style={{
              padding: "4px 10px",
              borderRadius: "6px",
              fontSize: "12px",
              cursor: "pointer",
              background: selectedFilter === "ALL" ? "rgba(56, 189, 248, 0.2)" : "rgba(255, 255, 255, 0.05)",
              color: selectedFilter === "ALL" ? "var(--accent-cyan)" : "var(--text-secondary)",
              border: selectedFilter === "ALL" ? "1px solid rgba(56, 189, 248, 0.4)" : "1px solid var(--border-color)",
              fontWeight: "600",
            }}
          >
            All Moves ({moves.length})
          </button>

          <button
            onClick={() => setSelectedFilter("CRITICAL")}
            style={{
              padding: "4px 10px",
              borderRadius: "6px",
              fontSize: "12px",
              cursor: "pointer",
              background: selectedFilter === "CRITICAL" ? "rgba(244, 63, 94, 0.25)" : "rgba(255, 255, 255, 0.05)",
              color: selectedFilter === "CRITICAL" ? "#fb7185" : "var(--text-secondary)",
              border: selectedFilter === "CRITICAL" ? "1px solid rgba(244, 63, 94, 0.5)" : "1px solid var(--border-color)",
              fontWeight: "700",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <ShieldAlert size={13} color="#f43f5e" />
            Critical Errors ({tierCounts.BLUNDER + tierCounts.MISTAKE + tierCounts.MISSED_WIN})
          </button>

          <button
            onClick={() => setSelectedFilter("BLUNDER")}
            style={{
              padding: "4px 10px",
              borderRadius: "6px",
              fontSize: "12px",
              cursor: "pointer",
              background: selectedFilter === "BLUNDER" ? "rgba(244, 63, 94, 0.25)" : "rgba(255, 255, 255, 0.05)",
              color: selectedFilter === "BLUNDER" ? "#fb7185" : "var(--text-secondary)",
              border: selectedFilter === "BLUNDER" ? "1px solid rgba(244, 63, 94, 0.5)" : "1px solid var(--border-color)",
              fontWeight: "600",
            }}
          >
            ?? Blunders ({tierCounts.BLUNDER})
          </button>

          <button
            onClick={() => setSelectedFilter("MISTAKE")}
            style={{
              padding: "4px 10px",
              borderRadius: "6px",
              fontSize: "12px",
              cursor: "pointer",
              background: selectedFilter === "MISTAKE" ? "rgba(249, 115, 22, 0.25)" : "rgba(255, 255, 255, 0.05)",
              color: selectedFilter === "MISTAKE" ? "#fb923c" : "var(--text-secondary)",
              border: selectedFilter === "MISTAKE" ? "1px solid rgba(249, 115, 22, 0.5)" : "1px solid var(--border-color)",
              fontWeight: "600",
            }}
          >
            ? Mistakes ({tierCounts.MISTAKE})
          </button>

          <button
            onClick={() => setSelectedFilter("BEST")}
            style={{
              padding: "4px 10px",
              borderRadius: "6px",
              fontSize: "12px",
              cursor: "pointer",
              background: selectedFilter === "BEST" ? "rgba(16, 185, 129, 0.2)" : "rgba(255, 255, 255, 0.05)",
              color: selectedFilter === "BEST" ? "var(--accent-emerald)" : "var(--text-secondary)",
              border: selectedFilter === "BEST" ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid var(--border-color)",
              fontWeight: "600",
            }}
          >
            ★ Best ({tierCounts.BEST})
          </button>
        </div>

        {/* JUMP TO NEXT/PREV ERROR */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <button
            disabled={!prevCriticalPly}
            onClick={() => prevCriticalPly && onSelectPly(prevCriticalPly)}
            style={{
              padding: "6px 10px",
              background: prevCriticalPly ? "rgba(255, 255, 255, 0.08)" : "rgba(255, 255, 255, 0.02)",
              border: "1px solid var(--border-color)",
              borderRadius: "6px",
              color: prevCriticalPly ? "var(--text-primary)" : "var(--text-muted)",
              cursor: prevCriticalPly ? "pointer" : "not-allowed",
              fontSize: "11px",
              fontWeight: "600",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
            title="Jump to Previous Error"
          >
            <ChevronLeft size={14} /> Prev Error
          </button>

          <button
            disabled={!nextCriticalPly}
            onClick={() => nextCriticalPly && onSelectPly(nextCriticalPly)}
            style={{
              padding: "6px 12px",
              background: nextCriticalPly ? "rgba(244, 63, 94, 0.2)" : "rgba(255, 255, 255, 0.02)",
              border: nextCriticalPly ? "1px solid rgba(244, 63, 94, 0.4)" : "1px solid var(--border-color)",
              borderRadius: "6px",
              color: nextCriticalPly ? "#fb7185" : "var(--text-muted)",
              cursor: nextCriticalPly ? "pointer" : "not-allowed",
              fontSize: "11px",
              fontWeight: "700",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
            title="Jump to Next Blunder / Mistake"
          >
            Next Error <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* ACTIVE MOVE TACTICAL EVALUATION CARD */}
      {activeMove && currentTier ? (
        <div
          className="glass-panel"
          style={{
            padding: "16px 20px",
            borderLeft: `4px solid ${currentTier.color}`,
            background: `linear-gradient(135deg, ${currentTier.bg} 0%, rgba(18, 22, 31, 0.85) 100%)`,
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          {/* Top Row: Badge, Move, and Centipawn Loss */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "3px 10px",
                  borderRadius: "6px",
                  background: currentTier.bg,
                  border: `1px solid ${currentTier.border}`,
                  color: currentTier.color,
                  fontSize: "12px",
                  fontWeight: "800",
                  fontFamily: "var(--font-mono)",
                }}
              >
                <span>{currentTier.symbol}</span>
                <span>{currentTier.label.toUpperCase()}</span>
              </span>

              <span style={{ fontSize: "15px", fontWeight: "800" }}>
                {activeMove.moveNumber}
                {activeMove.color === "WHITE" ? "." : "..."} {activeMove.san}
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              {activeMove.cpl !== undefined && activeMove.classification !== "BOOK" && (
                <span
                  style={{
                    fontSize: "12px",
                    fontFamily: "var(--font-mono)",
                    color: activeMove.cpl > 150 ? "var(--accent-rose)" : "var(--text-secondary)",
                  }}
                >
                  Centipawn Loss: <strong>+{activeMove.cpl || 0} cp</strong>
                </span>
              )}
              <span
                style={{
                  fontSize: "12px",
                  fontFamily: "var(--font-mono)",
                  fontWeight: "700",
                  color: activeMove.eval >= 0 ? "var(--text-primary)" : "var(--accent-cyan)",
                }}
              >
                Eval: {activeMove.eval > 0 ? `+${activeMove.eval}` : activeMove.eval}
              </span>
            </div>
          </div>

          {/* Coach Narrative & Tactical Explanation */}
          <p
            style={{
              fontSize: "13px",
              lineHeight: "1.6",
              color: "var(--text-primary)",
              margin: 0,
            }}
          >
            {activeMove.comment || currentTier.description}
          </p>

          {/* Engine Recommendation Comparison */}
          {activeMove.bestMove && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                fontSize: "12px",
                padding: "8px 12px",
                borderRadius: "6px",
                background: "rgba(0, 0, 0, 0.35)",
                border: "1px solid var(--border-color)",
              }}
            >
              <Zap size={14} color="var(--accent-cyan)" />
              <span style={{ color: "var(--text-muted)" }}>Engine Alternative:</span>
              <span
                style={{
                  color: "var(--accent-cyan)",
                  fontFamily: "var(--font-mono)",
                  fontWeight: "700",
                }}
              >
                {activeMove.bestMove}
              </span>
              <span style={{ color: "var(--text-secondary)", fontSize: "11px" }}>
                (Preserves optimal dynamic evaluation)
              </span>
            </div>
          )}
        </div>
      ) : (
        <div
          className="glass-panel"
          style={{
            padding: "16px 20px",
            textAlign: "center",
            color: "var(--text-muted)",
            fontSize: "13px",
          }}
        >
          Select or navigate to any move to inspect tactical blunder telemetry and Stockfish explanations.
        </div>
      )}
    </div>
  );
}
