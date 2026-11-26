/**
 * ChessIQ v3.3.0 — Personalized Training Puzzle Dashboard
 * Day 15 (@FE): Top-level container uniting backend stats, theme/difficulty filters,
 * interactive chess.js + InteractiveChessboard solver, authoritative backend submission,
 * and loading/empty/error states.
 */

import React from "react";
import {
  Target,
  Filter,
  RefreshCw,
  AlertTriangle,
  ServerCrash,
  Inbox,
  Swords,
  Loader2,
  Sparkles,
} from "lucide-react";
import {
  useTrainingPuzzles,
  PUZZLE_SOLVE_STATE,
} from "../../hooks/useTrainingPuzzles";
import { PUZZLE_DIFFICULTY_BANDS } from "../../utils/puzzleUtils";
import TrainingStats from "./TrainingStats";
import PuzzleBoard from "./PuzzleBoard";
import PuzzleControls from "./PuzzleControls";
import PuzzleFeedback from "./PuzzleFeedback";
import PuzzleCard from "./PuzzleCard";

export default function TrainingDashboard({
  isAuthenticated = false,
  isSoundEnabled = true,
  onToggleSound,
  onNavigateToAnalysis,
}) {
  const {
    puzzles,
    totalUnfilteredCount,
    activePuzzle,
    activeIndex,
    boardFen,
    boardOrientation,
    setBoardOrientation,
    solveState,
    feedbackMessage,
    submissionError,
    hintLevel,
    hintVisuals,
    playedMoves,
    dashboardStats,
    recentActivity,
    availableThemes,
    themeFilter,
    setThemeFilter,
    difficultyFilter,
    setDifficultyFilter,
    statusFilter,
    setStatusFilter,
    isLoading,
    isLoadingMore,
    isGenerating,
    fetchError,
    backendEndpointMissing,
    hasMore,
    loadMore,
    reloadPuzzles,
    generateNewPuzzles,
    selectPuzzle,
    nextPuzzle,
    prevPuzzle,
    handleAttemptMove,
    requestHint,
    resetCurrentPuzzle,
    retrySubmission,
  } = useTrainingPuzzles({ enabled: isAuthenticated });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Header Banner */}
      <div className="glass-panel" style={{ padding: "22px 24px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "4px",
              }}
            >
              <Target size={20} color="var(--accent-emerald)" />
              <h2 style={{ fontSize: "19px", fontWeight: "700" }}>
                Personalized Tactical Training
              </h2>
            </div>
            <p
              style={{
                fontSize: "13px",
                color: "var(--text-secondary)",
                lineHeight: "1.5",
              }}
            >
              Targeted training puzzles sourced from your personalized{" "}
              <code>v_training_puzzles</code> and{" "}
              <code>v_training_recommendations</code> backend telemetry.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => generateNewPuzzles(5)}
              disabled={isLoading || isGenerating}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                borderRadius: "8px",
                background: "rgba(16, 185, 129, 0.14)",
                border: "1px solid rgba(16, 185, 129, 0.4)",
                color: "var(--accent-emerald)",
                fontSize: "12px",
                fontWeight: "600",
                cursor: isLoading || isGenerating ? "wait" : "pointer",
              }}
            >
              <Sparkles size={14} />
              {isGenerating ? "Generating..." : "Generate Recommendations"}
            </button>

            <button
              type="button"
              onClick={reloadPuzzles}
              disabled={isLoading || isGenerating}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                borderRadius: "8px",
                background: "rgba(56, 189, 248, 0.12)",
                border: "1px solid rgba(56, 189, 248, 0.35)",
                color: "var(--accent-cyan)",
                fontSize: "12px",
                fontWeight: "600",
                cursor: isLoading || isGenerating ? "wait" : "pointer",
              }}
            >
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Real Backend Training KPIs & Weakness Categories */}
      <TrainingStats stats={dashboardStats} recentActivity={recentActivity} />

      {/* Loading Skeleton State */}
      {isLoading && (
        <div
          className="glass-panel"
          role="status"
          aria-busy="true"
          style={{
            padding: "48px 24px",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <Loader2 size={28} color="var(--accent-cyan)" />
          <h3 style={{ fontSize: "16px", fontWeight: "700" }}>
            Loading Personalized Puzzles...
          </h3>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
            Querying <code>/api/recommendations</code> for your historical game
            weaknesses.
          </p>
        </div>
      )}

      {/* Error / Backend Contract Missing State */}
      {!isLoading && fetchError && (
        <div
          className="glass-panel"
          role="alert"
          style={{
            padding: "28px 24px",
            borderLeft: `4px solid ${backendEndpointMissing ? "var(--accent-indigo)" : "var(--accent-rose)"}`,
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {backendEndpointMissing ? (
              <ServerCrash size={22} color="#a5b4fc" />
            ) : (
              <AlertTriangle size={22} color="var(--accent-rose)" />
            )}
            <h3 style={{ fontSize: "16px", fontWeight: "700" }}>
              {backendEndpointMissing
                ? "Awaiting Backend Personalized Training Endpoint"
                : "Unable to Retrieve Personalized Puzzles"}
            </h3>
          </div>
          <p
            style={{
              fontSize: "13px",
              color: "var(--text-secondary)",
              lineHeight: "1.6",
            }}
          >
            {fetchError}
          </p>
          <div>
            <button
              type="button"
              onClick={reloadPuzzles}
              className="btn-primary"
              style={{ padding: "8px 16px", fontSize: "12px" }}
            >
              <RefreshCw size={14} /> Retry Connection
            </button>
          </div>
        </div>
      )}

      {/* Main Content When Backend Responded Cleanly */}
      {!isLoading && !fetchError && (
        <>
          {/* Filter Controls Bar */}
          {totalUnfilteredCount > 0 && (
            <div
              className="glass-panel"
              style={{
                padding: "14px 18px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "12px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "12px",
                  fontWeight: "700",
                  color: "var(--text-secondary)",
                }}
              >
                <Filter size={14} color="var(--accent-cyan)" /> Filter Puzzles
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                <select
                  aria-label="Filter by tactical theme"
                  value={themeFilter}
                  onChange={(e) => setThemeFilter(e.target.value)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: "6px",
                    border: "1px solid var(--border-color)",
                    background: "var(--bg-secondary)",
                    color: "var(--text-primary)",
                    fontSize: "12px",
                  }}
                >
                  <option value="ALL">All Tactical Themes</option>
                  {availableThemes.map((t) => (
                    <option key={t.code} value={t.code}>
                      {t.code}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Filter by difficulty rating"
                  value={difficultyFilter}
                  onChange={(e) => setDifficultyFilter(e.target.value)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: "6px",
                    border: "1px solid var(--border-color)",
                    background: "var(--bg-secondary)",
                    color: "var(--text-primary)",
                    fontSize: "12px",
                  }}
                >
                  {Object.values(PUZZLE_DIFFICULTY_BANDS).map((b) => (
                    <option key={b.key} value={b.key}>
                      {b.label}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Filter by completion status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: "6px",
                    border: "1px solid var(--border-color)",
                    background: "var(--bg-secondary)",
                    color: "var(--text-primary)",
                    fontSize: "12px",
                  }}
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PENDING">Unsolved Only</option>
                  <option value="COMPLETED">Completed Only</option>
                </select>
              </div>
            </div>
          )}

          {/* Empty State: No Puzzles Found */}
          {puzzles.length === 0 ? (
            <div
              className="glass-panel"
              style={{
                padding: "48px 24px",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <Inbox size={32} color="var(--accent-cyan)" />
              <h3 style={{ fontSize: "17px", fontWeight: "700" }}>
                {totalUnfilteredCount > 0
                  ? "No Puzzles Match Selected Filters"
                  : "No Personalized Puzzles Available Yet"}
              </h3>
              <p
                style={{
                  fontSize: "13px",
                  color: "var(--text-secondary)",
                  maxWidth: "480px",
                  lineHeight: "1.6",
                }}
              >
                {totalUnfilteredCount > 0
                  ? "Adjust the theme, difficulty, or completion filters above to view available puzzles."
                  : "Upload and analyze your PGN games in Game Review so Stockfish can detect tactical blunders and generate tailored recommendations for your weaknesses."}
              </p>
              {totalUnfilteredCount > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setThemeFilter("ALL");
                    setDifficultyFilter("ALL");
                    setStatusFilter("ALL");
                  }}
                  className="btn-primary"
                  style={{ padding: "8px 16px", fontSize: "12px" }}
                >
                  Clear Filters
                </button>
              ) : (
                onNavigateToAnalysis && (
                  <button
                    type="button"
                    onClick={onNavigateToAnalysis}
                    className="btn-primary"
                    style={{ padding: "8px 16px", fontSize: "12px" }}
                  >
                    <Swords size={14} /> Upload Game to Analyze
                  </button>
                )
              )}
            </div>
          ) : (
            /* Interactive 2-Column Training Workspace */
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
                gap: "20px",
                alignItems: "start",
              }}
            >
              {/* Left Column: Chessboard Solver + Controls */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                }}
              >
                <PuzzleBoard
                  boardFen={boardFen}
                  boardOrientation={boardOrientation}
                  onOrientationChange={setBoardOrientation}
                  solveState={solveState}
                  hintVisuals={hintVisuals}
                  isSoundEnabled={isSoundEnabled}
                  onToggleSound={onToggleSound}
                  onAttemptMove={handleAttemptMove}
                />

                <PuzzleControls
                  activeIndex={activeIndex}
                  totalCount={puzzles.length}
                  hintLevel={hintLevel}
                  isSolved={solveState === PUZZLE_SOLVE_STATE.SOLVED}
                  isSubmitting={solveState === PUZZLE_SOLVE_STATE.SUBMITTING}
                  onPrevPuzzle={prevPuzzle}
                  onNextPuzzle={nextPuzzle}
                  onResetPuzzle={resetCurrentPuzzle}
                  onRequestHint={requestHint}
                />
              </div>

              {/* Right Column: Tactical Feedback + Personalized Queue */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                }}
              >
                <PuzzleFeedback
                  puzzle={activePuzzle}
                  solveState={solveState}
                  feedbackMessage={feedbackMessage}
                  submissionError={submissionError}
                  hintText={hintVisuals.hintText}
                  playedMoves={playedMoves}
                  onRetrySubmission={retrySubmission}
                  onNextPuzzle={nextPuzzle}
                  hasNextPuzzle={activeIndex < puzzles.length - 1}
                />

                {/* Recommendation Queue Selector */}
                <div className="glass-panel" style={{ padding: "16px" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "12px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: "700",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        color: "var(--text-secondary)",
                      }}
                    >
                      Recommended Queue ({puzzles.length})
                    </span>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                      maxHeight: "420px",
                      overflowY: "auto",
                    }}
                  >
                    {puzzles.map((p, idx) => (
                      <PuzzleCard
                        key={p.recommendationId || p.puzzleId || idx}
                        puzzle={p}
                        index={idx}
                        isSelected={idx === activeIndex}
                        onSelect={selectPuzzle}
                      />
                    ))}
                  </div>

                  {hasMore && (
                    <div style={{ marginTop: "12px", textAlign: "center" }}>
                      <button
                        type="button"
                        onClick={loadMore}
                        disabled={isLoadingMore}
                        style={{
                          width: "100%",
                          padding: "8px 14px",
                          borderRadius: "8px",
                          border: "1px solid var(--border-color)",
                          background: "rgba(255, 255, 255, 0.04)",
                          color: "var(--accent-cyan)",
                          fontSize: "12px",
                          fontWeight: "600",
                          cursor: isLoadingMore ? "wait" : "pointer",
                        }}
                      >
                        {isLoadingMore
                          ? "Loading More Puzzles..."
                          : "Load More Puzzles"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

