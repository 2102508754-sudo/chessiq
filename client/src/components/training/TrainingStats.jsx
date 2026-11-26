/**
 * ChessIQ v3.3.0 — Training Progress & Weakness Telemetry Cards
 * Day 15 (@FE): Renders backend-derived puzzle metrics (total, completed, correct,
 * incorrect, success %, training progress bar, tactical weakness categories, and recent activity).
 */

import React from "react";
import {
  Target,
  CheckCircle2,
  XCircle,
  Award,
  Flame,
  Clock,
} from "lucide-react";

export default function TrainingStats({ stats, recentActivity = [] }) {
  const {
    total = 0,
    completed = 0,
    correct = 0,
    incorrect = 0,
    successPercentage = 0,
    progressPercentage = 0,
    weaknessCategories = [],
  } = stats || {};

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Top 4 KPI Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "12px",
        }}
      >
        <div
          className="glass-panel"
          style={{
            padding: "16px",
            borderLeft: "3px solid var(--accent-cyan)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "11px",
              color: "var(--text-muted)",
              textTransform: "uppercase",
              marginBottom: "6px",
            }}
          >
            <span>Personalized Puzzles</span>
            <Target size={14} color="var(--accent-cyan)" />
          </div>
          <div
            style={{
              fontSize: "24px",
              fontWeight: "800",
              color: "var(--text-primary)",
            }}
          >
            {total}
          </div>
          <div
            style={{
              fontSize: "11px",
              color: "var(--text-secondary)",
              marginTop: "4px",
            }}
          >
            {completed} completed ({progressPercentage}%)
          </div>
        </div>

        <div
          className="glass-panel"
          style={{
            padding: "16px",
            borderLeft: "3px solid var(--accent-emerald)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "11px",
              color: "var(--text-muted)",
              textTransform: "uppercase",
              marginBottom: "6px",
            }}
          >
            <span>Correct / Solved</span>
            <CheckCircle2 size={14} color="var(--accent-emerald)" />
          </div>
          <div
            style={{
              fontSize: "24px",
              fontWeight: "800",
              color: "var(--accent-emerald)",
            }}
          >
            {correct}
          </div>
          <div
            style={{
              fontSize: "11px",
              color: "var(--text-secondary)",
              marginTop: "4px",
            }}
          >
            Success rate: <strong>{successPercentage}%</strong>
          </div>
        </div>

        <div
          className="glass-panel"
          style={{
            padding: "16px",
            borderLeft: "3px solid var(--accent-rose)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "11px",
              color: "var(--text-muted)",
              textTransform: "uppercase",
              marginBottom: "6px",
            }}
          >
            <span>Incorrect Attempts</span>
            <XCircle size={14} color="var(--accent-rose)" />
          </div>
          <div
            style={{ fontSize: "24px", fontWeight: "800", color: "#fb7185" }}
          >
            {incorrect}
          </div>
          <div
            style={{
              fontSize: "11px",
              color: "var(--text-secondary)",
              marginTop: "4px",
            }}
          >
            Retry available on misses
          </div>
        </div>

        <div
          className="glass-panel"
          style={{
            padding: "16px",
            borderLeft: "3px solid var(--accent-indigo)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "11px",
              color: "var(--text-muted)",
              textTransform: "uppercase",
              marginBottom: "6px",
            }}
          >
            <span>Training Progress</span>
            <Award size={14} color="var(--accent-indigo)" />
          </div>
          <div
            style={{
              fontSize: "24px",
              fontWeight: "800",
              color: "var(--text-primary)",
            }}
          >
            {progressPercentage}%
          </div>
          <div
            style={{
              height: "6px",
              borderRadius: "4px",
              background: "rgba(255, 255, 255, 0.08)",
              marginTop: "8px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${progressPercentage}%`,
                height: "100%",
                background:
                  "linear-gradient(90deg, var(--accent-cyan), var(--accent-emerald))",
                transition: "width 0.35s ease",
              }}
            />
          </div>
        </div>
      </div>

      {/* Tactical Weakness Categories + Optional Recent Activity */}
      {(weaknessCategories.length > 0 || recentActivity.length > 0) && (
        <div
          className="glass-panel"
          style={{
            padding: "16px 20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          {weaknessCategories.length > 0 && (
            <div style={{ flex: 1, minWidth: "240px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "12px",
                  fontWeight: "700",
                  color: "var(--accent-amber)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  marginBottom: "10px",
                }}
              >
                <Flame size={14} /> Identified Tactical Weakness Categories
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {weaknessCategories.slice(0, 8).map((w) => (
                  <span
                    key={w.theme_code || w.category}
                    style={{
                      fontSize: "12px",
                      padding: "4px 10px",
                      borderRadius: "6px",
                      background: "rgba(245, 158, 11, 0.12)",
                      border: "1px solid rgba(245, 158, 11, 0.3)",
                      color: "#fbbf24",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <strong>{w.theme_code || w.category}</strong>
                    <span
                      style={{ opacity: 0.85, fontFamily: "var(--font-mono)" }}
                    >
                      ({w.completed ?? 0}/{w.count ?? w.puzzle_count ?? 0})
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {recentActivity.length > 0 && (
            <div style={{ flex: 1, minWidth: "240px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "12px",
                  fontWeight: "700",
                  color: "var(--accent-cyan)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  marginBottom: "10px",
                }}
              >
                <Clock size={14} /> Recent Training Activity
              </div>
              <div
                style={{ display: "flex", flexDirection: "column", gap: "6px" }}
              >
                {recentActivity.slice(0, 3).map((act, idx) => (
                  <div
                    key={act.id || idx}
                    style={{
                      fontSize: "12px",
                      color: "var(--text-secondary)",
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>{act.category || act.theme || "Puzzle Attempt"}</span>
                    <span
                      style={{
                        color: act.is_correct
                          ? "var(--accent-emerald)"
                          : "#fb7185",
                        fontWeight: "600",
                      }}
                    >
                      {act.is_correct ? "Solved" : "Missed"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
