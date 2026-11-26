/**
 * ChessIQ v3.3.0 — Puzzle Solution Feedback Panel
 * Day 15 (@FE): Renders state-driven training feedback for ready, step-progress,
 * incorrect attempt, submitting, backend error, and completed states.
 */

import React from "react";
import {
  CheckCircle2,
  XCircle,
  Sparkles,
  Loader2,
  AlertTriangle,
  ArrowRight,
  HelpCircle,
  RefreshCw,
} from "lucide-react";
import { PUZZLE_SOLVE_STATE } from "../../hooks/useTrainingPuzzles";

export default function PuzzleFeedback({
  puzzle,
  solveState,
  feedbackMessage,
  submissionError,
  hintText,
  playedMoves = [],
  onRetrySubmission,
  onNextPuzzle,
  hasNextPuzzle,
}) {
  if (!puzzle) return null;

  const isSolved = solveState === PUZZLE_SOLVE_STATE.SOLVED;
  const isIncorrect = solveState === PUZZLE_SOLVE_STATE.INCORRECT;
  const isSubmitting = solveState === PUZZLE_SOLVE_STATE.SUBMITTING;
  const isSubmissionError = solveState === PUZZLE_SOLVE_STATE.SUBMISSION_ERROR;
  const isStepCorrect = solveState === PUZZLE_SOLVE_STATE.STEP_CORRECT;

  const borderColor = isSolved
    ? "var(--accent-emerald)"
    : isIncorrect || isSubmissionError
      ? "var(--accent-rose)"
      : isStepCorrect
        ? "var(--accent-cyan)"
        : "var(--accent-indigo)";

  return (
    <div
      className="glass-panel"
      style={{
        padding: "16px 20px",
        borderLeft: `4px solid ${borderColor}`,
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {isSolved && <CheckCircle2 size={18} color="var(--accent-emerald)" />}
          {isIncorrect && <XCircle size={18} color="var(--accent-rose)" />}
          {isSubmitting && <Loader2 size={18} color="var(--accent-cyan)" />}
          {isSubmissionError && (
            <AlertTriangle size={18} color="var(--accent-rose)" />
          )}
          {(solveState === PUZZLE_SOLVE_STATE.READY || isStepCorrect) && (
            <Sparkles size={18} color="var(--accent-cyan)" />
          )}

          <span
            style={{
              fontSize: "13px",
              fontWeight: "700",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              color: isSolved
                ? "var(--accent-emerald)"
                : isIncorrect || isSubmissionError
                  ? "#fb7185"
                  : "var(--accent-cyan)",
            }}
          >
            {isSolved
              ? "Puzzle Solved & Verified"
              : isSubmitting
                ? "Verifying Solution with Backend..."
                : isSubmissionError
                  ? "Progress Sync Failed"
                  : isIncorrect
                    ? "Incorrect Continuation"
                    : isStepCorrect
                      ? "Best Move Found — Keep Calculating"
                      : puzzle.category}
          </span>
        </div>

        {puzzle.rating !== null && puzzle.rating !== undefined && (
          <span
            style={{
              fontSize: "11px",
              fontFamily: "var(--font-mono)",
              padding: "2px 8px",
              borderRadius: "4px",
              background: "rgba(99, 102, 241, 0.16)",
              color: "#a5b4fc",
            }}
          >
            Rating: {puzzle.rating}
          </span>
        )}
      </div>

      {/* Feedback Body */}
      <p
        style={{
          fontSize: "13px",
          color: "var(--text-primary)",
          lineHeight: "1.5",
          margin: 0,
        }}
      >
        {feedbackMessage}
      </p>

      {/* Hint Notice (Only reveals single active move square/hint without spoiling full sequence) */}
      {hintText && !isSolved && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 12px",
            borderRadius: "8px",
            background: "rgba(245, 158, 11, 0.14)",
            border: "1px solid rgba(245, 158, 11, 0.35)",
            color: "#fbbf24",
            fontSize: "12px",
          }}
        >
          <HelpCircle size={15} />
          <span>
            <strong>Tactical Hint:</strong> {hintText}
          </span>
        </div>
      )}

      {/* Themes Tags */}
      {puzzle.themes && puzzle.themes.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {puzzle.themes.map((t) => (
            <span
              key={t.theme_code}
              style={{
                fontSize: "11px",
                padding: "2px 8px",
                borderRadius: "4px",
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid var(--border-color)",
                color: "var(--text-secondary)",
              }}
              title={t.description}
            >
              #{t.theme_code}
            </span>
          ))}
        </div>
      )}

      {/* Solved Variation & Explanation (Shown strictly after solving) */}
      {isSolved && (
        <div
          style={{
            padding: "10px 12px",
            borderRadius: "8px",
            background: "rgba(16, 185, 129, 0.1)",
            border: "1px solid rgba(16, 185, 129, 0.3)",
            fontSize: "12px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}
        >
          {puzzle.explanation && (
            <div style={{ color: "var(--text-secondary)", lineHeight: "1.5" }}>
              <strong style={{ color: "var(--accent-emerald)" }}>
                Tactical Pattern:
              </strong>{" "}
              {puzzle.explanation}
            </div>
          )}
          <div
            style={{
              fontFamily: "var(--font-mono)",
              color: "var(--text-primary)",
            }}
          >
            <strong>Solution Line:</strong>{" "}
            {puzzle.rawMovesString || playedMoves.join(" ")}
          </div>
          {hasNextPuzzle && (
            <div style={{ marginTop: "4px" }}>
              <button
                type="button"
                onClick={onNextPuzzle}
                className="btn-primary"
                style={{ padding: "6px 14px", fontSize: "12px" }}
              >
                Next Puzzle <ArrowRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Network / Backend Submission Error Recovery */}
      {isSubmissionError && submissionError && (
        <div
          role="alert"
          style={{
            padding: "10px 12px",
            borderRadius: "8px",
            background: "rgba(244, 63, 94, 0.12)",
            border: "1px solid rgba(244, 63, 94, 0.35)",
            fontSize: "12px",
            color: "#fb7185",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <span>{submissionError}</span>
          {onRetrySubmission && (
            <div>
              <button
                type="button"
                onClick={onRetrySubmission}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 12px",
                  borderRadius: "6px",
                  background: "rgba(244, 63, 94, 0.22)",
                  border: "1px solid rgba(244, 63, 94, 0.45)",
                  color: "#fda4af",
                  fontSize: "12px",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                <RefreshCw size={13} /> Retry Submission
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
