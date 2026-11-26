/**
 * ChessIQ v3.3.0 — Personalized Training Puzzles Lifecycle Hook
 * Day 15 (@FE): Integrates with GET /api/recommendations (v_training_puzzles / v_training_recommendations),
 * drives multi-move chess.js validation, tracks elapsed attempt duration, prevents duplicate submissions,
 * and handles network errors without falsely marking puzzles completed.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { ApiError } from "../api/client";
import {
  fetchPersonalizedPuzzles,
  submitPuzzleAttempt,
  generateFreshRecommendations,
} from "../api/puzzles";
import {
  inspectPuzzlePosition,
  evaluatePuzzleMove,
  applyForcedReplyMove,
  buildPuzzleHint,
  filterPersonalizedPuzzles,
  aggregateTrainingDashboardStats,
  PUZZLE_DIFFICULTY_BANDS,
} from "../utils/puzzleUtils";

export const PUZZLE_SOLVE_STATE = {
  READY: "READY",
  INCORRECT: "INCORRECT",
  STEP_CORRECT: "STEP_CORRECT",
  SUBMITTING: "SUBMITTING",
  SOLVED: "SOLVED",
  SUBMISSION_ERROR: "SUBMISSION_ERROR",
};

const PAGE_LIMIT = 20;

export function useTrainingPuzzles({ enabled = true } = {}) {
  const [rawPuzzles, setRawPuzzles] = useState([]);
  const [backendStats, setBackendStats] = useState(null);
  const [backendWeaknesses, setBackendWeaknesses] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [pagination, setPagination] = useState({
    total: 0,
    offset: 0,
    hasMore: false,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [backendEndpointMissing, setBackendEndpointMissing] = useState(false);

  // Filter controls
  const [themeFilter, setThemeFilter] = useState("ALL");
  const [difficultyFilter, setDifficultyFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Active puzzle solving state
  const [activeIndex, setActiveIndex] = useState(0);
  const [boardFen, setBoardFen] = useState("");
  const [moveStepIndex, setMoveStepIndex] = useState(0);
  const [playedMoves, setPlayedMoves] = useState([]);
  const [solveState, setSolveState] = useState(PUZZLE_SOLVE_STATE.READY);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [submissionError, setSubmissionError] = useState(null);
  const [hintLevel, setHintLevel] = useState(0); // 0 = hidden, 1 = piece square, 2 = single move arrow
  const [boardOrientation, setBoardOrientation] = useState("white");
  const [localAttemptErrors, setLocalAttemptErrors] = useState(0);
  const [pendingSubmissionPayload, setPendingSubmissionPayload] =
    useState(null);

  // Refs for cleanup and concurrency locks
  const abortControllerRef = useRef(null);
  const replyTimerRef = useRef(null);
  const submitLockRef = useRef(false);
  const puzzleStartTimeRef = useRef(Date.now());

  const clearTimers = useCallback(() => {
    if (replyTimerRef.current) {
      clearTimeout(replyTimerRef.current);
      replyTimerRef.current = null;
    }
  }, []);

  // Filtered puzzle list
  const filteredPuzzles = useMemo(() => {
    return filterPersonalizedPuzzles(rawPuzzles, {
      theme: themeFilter,
      difficulty: difficultyFilter,
      statusFilter,
    });
  }, [rawPuzzles, themeFilter, difficultyFilter, statusFilter]);

  const activePuzzle = useMemo(() => {
    return filteredPuzzles[activeIndex] || null;
  }, [filteredPuzzles, activeIndex]);

  // Dashboard stats computed strictly from real backend items & stats
  const dashboardStats = useMemo(() => {
    return aggregateTrainingDashboardStats(
      rawPuzzles,
      backendStats,
      backendWeaknesses,
    );
  }, [rawPuzzles, backendStats, backendWeaknesses]);

  // Available tactical themes derived from backend recommendations
  const availableThemes = useMemo(() => {
    const map = new Map();
    rawPuzzles.forEach((p) => {
      if (p.category) map.set(p.category, p.category);
      (p.themes || []).forEach((t) => {
        if (t.theme_code) map.set(t.theme_code, t.description || t.theme_code);
      });
    });
    return Array.from(map.entries()).map(([code, label]) => ({ code, label }));
  }, [rawPuzzles]);

  // Initialize solver board whenever activePuzzle changes
  const initializePuzzleBoard = useCallback(
    (puzzle) => {
      clearTimers();
      submitLockRef.current = false;
      setPendingSubmissionPayload(null);
      setSubmissionError(null);
      setHintLevel(0);
      setPlayedMoves([]);
      setMoveStepIndex(0);
      setLocalAttemptErrors(0);
      puzzleStartTimeRef.current = Date.now();

      if (!puzzle || !puzzle.fen) {
        setBoardFen("");
        setSolveState(PUZZLE_SOLVE_STATE.READY);
        setFeedbackMessage("");
        return;
      }

      const info = inspectPuzzlePosition(puzzle.fen);
      setBoardFen(puzzle.fen);
      setBoardOrientation(info.orientation);

      if (puzzle.isCompleted) {
        setSolveState(PUZZLE_SOLVE_STATE.SOLVED);
        setFeedbackMessage(
          "You have completed this personalized tactical puzzle.",
        );
      } else {
        setSolveState(PUZZLE_SOLVE_STATE.READY);
        setFeedbackMessage(
          `Find the winning continuation for ${info.orientation === "white" ? "White" : "Black"}.`,
        );
      }
    },
    [clearTimers],
  );

  useEffect(() => {
    initializePuzzleBoard(activePuzzle);
    return clearTimers;
  }, [activePuzzle, initializePuzzleBoard, clearTimers]);

  // Fetch initial puzzles from backend
  const loadPuzzles = useCallback(
    async ({ reset = true } = {}) => {
      if (!enabled) return;

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const offset = reset ? 0 : pagination.offset + PAGE_LIMIT;
      if (reset) {
        setIsLoading(true);
        setFetchError(null);
        setBackendEndpointMissing(false);
      } else {
        setIsLoadingMore(true);
      }

      const band =
        PUZZLE_DIFFICULTY_BANDS[difficultyFilter] ||
        PUZZLE_DIFFICULTY_BANDS.ALL;

      try {
        const res = await fetchPersonalizedPuzzles({
          theme: themeFilter !== "ALL" ? themeFilter : undefined,
          minRating: band.min ?? undefined,
          maxRating: band.max ?? undefined,
          limit: PAGE_LIMIT,
          offset,
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;

        setRawPuzzles((prev) => (reset ? res.items : [...prev, ...res.items]));
        if (res.stats) setBackendStats(res.stats);
        if (res.weaknesses) setBackendWeaknesses(res.weaknesses);
        if (Array.isArray(res.recentActivity))
          setRecentActivity(res.recentActivity);

        setPagination({
          total:
            res.pagination?.total ??
            (reset ? res.items.length : rawPuzzles.length + res.items.length),
          offset,
          hasMore: Boolean(
            res.pagination?.has_more ?? res.items.length === PAGE_LIMIT,
          ),
        });

        if (reset) {
          setActiveIndex(0);
        }
      } catch (err) {
        if (controller.signal.aborted || err?.name === "AbortError") return;

        if (err instanceof ApiError && err.status === 404) {
          setBackendEndpointMissing(true);
          setFetchError(
            "Personalized puzzle endpoint (/api/recommendations) returned HTTP 404. Backend Day 15 route deployment is required.",
          );
        } else {
          setFetchError(
            err?.message || "Failed to load personalized training puzzles.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
          setIsLoadingMore(false);
        }
      }
    },
    [
      enabled,
      themeFilter,
      difficultyFilter,
      pagination.offset,
      rawPuzzles.length,
    ],
  );

  useEffect(() => {
    if (enabled) {
      loadPuzzles({ reset: true });
    }
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      clearTimers();
    };
    // Intentionally trigger when enabled or server-side filters change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, themeFilter, difficultyFilter]);

  // Execute authoritative backend attempt submission with strict duplicate-click lock
  const submitAttemptWithLock = useCallback(async (puzzle, payload) => {
    if (submitLockRef.current) return false;
    submitLockRef.current = true;
    setSolveState(PUZZLE_SOLVE_STATE.SUBMITTING);
    setSubmissionError(null);
    setPendingSubmissionPayload(payload);

    try {
      const response = await submitPuzzleAttempt(payload);

      // Verify backend confirmed completion authoritatively
      const verifiedCorrect =
        response?.is_correct !== false && response?.verified !== false;

      if (!verifiedCorrect) {
        setSolveState(PUZZLE_SOLVE_STATE.INCORRECT);
        setFeedbackMessage(
          response?.message ||
            "Backend verification rejected this continuation. Reset and try again.",
        );
        return false;
      }

      // Mark puzzle completed in local view strictly after backend confirms 200 OK
      setRawPuzzles((prev) =>
        prev.map((item) =>
          item.recommendationId === puzzle.recommendationId &&
          item.puzzleId === puzzle.puzzleId
            ? {
                ...item,
                isCompleted: Boolean(payload.isCompleted),
                lastResult: payload.isCorrect ? "CORRECT" : "INCORRECT",
                attemptsCount: (item.attemptsCount || 0) + 1,
              }
            : item,
        ),
      );

      if (response?.stats) {
        setBackendStats(response.stats);
      }

      if (payload.isCompleted) {
        setSolveState(PUZZLE_SOLVE_STATE.SOLVED);
        setFeedbackMessage(
          response?.message ||
            "Excellent! Solution verified and recorded to your training progression.",
        );
        setPendingSubmissionPayload(null);
      }

      return true;
    } catch (err) {
      // Do NOT mark completed on network/server failure!
      setSolveState(PUZZLE_SOLVE_STATE.SUBMISSION_ERROR);
      const errMsg =
        err instanceof ApiError && err.status === 404
          ? "Puzzle attempt endpoint returned HTTP 404 — cannot persist completion until backend attempt route is available."
          : err?.message ||
            "Network error while saving puzzle progress. Your completion was NOT recorded.";
      setSubmissionError(errMsg);
      setFeedbackMessage(
        "Progress verification failed due to a backend/network error.",
      );
      return false;
    } finally {
      submitLockRef.current = false;
    }
  }, []);

  // Retry failed submission without replaying moves
  const retrySubmission = useCallback(async () => {
    if (!activePuzzle || !pendingSubmissionPayload) return;
    await submitAttemptWithLock(activePuzzle, pendingSubmissionPayload);
  }, [activePuzzle, pendingSubmissionPayload, submitAttemptWithLock]);

  // Handle user drag-and-drop / click move on InteractiveChessboard
  const handleAttemptMove = useCallback(
    (move) => {
      if (!activePuzzle || !boardFen) return false;
      if (
        solveState === PUZZLE_SOLVE_STATE.SOLVED ||
        solveState === PUZZLE_SOLVE_STATE.SUBMITTING
      ) {
        return false;
      }

      const expectedMoveStr = activePuzzle.moves[moveStepIndex];
      if (!expectedMoveStr) return false;

      const evaluation = evaluatePuzzleMove({
        fen: boardFen,
        expectedMoveStr,
        move,
      });

      if (!evaluation.isLegal) {
        return false;
      }

      if (!evaluation.isMatch) {
        setLocalAttemptErrors((c) => c + 1);
        setSolveState(PUZZLE_SOLVE_STATE.INCORRECT);
        setFeedbackMessage(
          `${evaluation.playedMove.san} is inaccurate here. Re-examine the opponent's king safety and tactical motifs, or click Hint.`,
        );
        return false; // Keeps piece at prior square cleanly via disableExploration
      }

      // Move matches expected puzzle step!
      const updatedPlayedMoves = [...playedMoves, evaluation.playedMove.uci];
      setPlayedMoves(updatedPlayedMoves);
      setBoardFen(evaluation.nextFen);
      setHintLevel(0);

      const nextIndex = moveStepIndex + 1;

      // Did player complete the entire variation (or achieve checkmate)?
      if (nextIndex >= activePuzzle.moves.length || evaluation.isCheckmate) {
        const elapsedMs = Date.now() - puzzleStartTimeRef.current;
        submitAttemptWithLock(activePuzzle, {
          recommendationId: activePuzzle.recommendationId,
          puzzleId: activePuzzle.puzzleId,
          movesPlayed: updatedPlayedMoves,
          isCorrect: localAttemptErrors === 0,
          isCompleted: true,
          timeSpentMs: elapsedMs,
          usedHint: hintLevel > 0,
        });
        return true;
      }

      // Multi-move puzzle: play opponent's forced response after brief tactical pause
      setMoveStepIndex(nextIndex);
      setSolveState(PUZZLE_SOLVE_STATE.STEP_CORRECT);
      setFeedbackMessage(
        `${evaluation.playedMove.san} is accurate! Opponent is forced to respond...`,
      );

      clearTimers();
      const opponentMoveStr = activePuzzle.moves[nextIndex];
      replyTimerRef.current = setTimeout(() => {
        const reply = applyForcedReplyMove(evaluation.nextFen, opponentMoveStr);
        if (reply.ok) {
          const afterReplyMoves = [...updatedPlayedMoves, reply.move.uci];
          setBoardFen(reply.nextFen);
          setPlayedMoves(afterReplyMoves);

          const playerNextIndex = nextIndex + 1;
          if (playerNextIndex >= activePuzzle.moves.length) {
            // Variation concluded right after opponent move
            const elapsedMs = Date.now() - puzzleStartTimeRef.current;
            submitAttemptWithLock(activePuzzle, {
              recommendationId: activePuzzle.recommendationId,
              puzzleId: activePuzzle.puzzleId,
              movesPlayed: afterReplyMoves,
              isCorrect: localAttemptErrors === 0,
              isCompleted: true,
              timeSpentMs: elapsedMs,
              usedHint: hintLevel > 0,
            });
          } else {
            setMoveStepIndex(playerNextIndex);
            setSolveState(PUZZLE_SOLVE_STATE.READY);
            setFeedbackMessage(
              `Opponent played ${reply.move.san}. Find the follow-up continuation!`,
            );
          }
        }
      }, 420);

      return true;
    },
    [
      activePuzzle,
      boardFen,
      solveState,
      moveStepIndex,
      playedMoves,
      localAttemptErrors,
      hintLevel,
      clearTimers,
      submitAttemptWithLock,
    ],
  );

  // Active hint calculation (masked sequentially so solution variation isn't leaked)
  const hintVisuals = useMemo(() => {
    if (!activePuzzle || !boardFen || hintLevel === 0) {
      return { squareStyles: {}, arrows: [], hintText: null };
    }
    const expectedStr = activePuzzle.moves[moveStepIndex];
    const hint = buildPuzzleHint(boardFen, expectedStr, hintLevel >= 2);
    if (!hint) return { squareStyles: {}, arrows: [], hintText: null };

    const squareStyles = {
      [hint.fromSquare]: {
        boxShadow: "inset 0 0 0 3px #f59e0b",
        backgroundColor: "rgba(245, 158, 11, 0.25)",
      },
    };
    const arrows =
      hintLevel >= 2 && hint.toSquare
        ? [[hint.fromSquare, hint.toSquare, "rgba(245, 158, 11, 0.85)"]]
        : [];

    return {
      squareStyles,
      arrows,
      hintText: hint.sanHint,
    };
  }, [activePuzzle, boardFen, hintLevel, moveStepIndex]);

  const requestHint = useCallback(() => {
    setHintLevel((prev) => Math.min(2, prev + 1));
  }, []);

  const resetCurrentPuzzle = useCallback(() => {
    if (!activePuzzle) return;
    initializePuzzleBoard({ ...activePuzzle, isCompleted: false });
  }, [activePuzzle, initializePuzzleBoard]);

  const selectPuzzle = useCallback(
    (index) => {
      if (index >= 0 && index < filteredPuzzles.length) {
        setActiveIndex(index);
      }
    },
    [filteredPuzzles.length],
  );

  const nextPuzzle = useCallback(() => {
    if (activeIndex < filteredPuzzles.length - 1) {
      setActiveIndex((prev) => prev + 1);
    }
  }, [activeIndex, filteredPuzzles.length]);

  const prevPuzzle = useCallback(() => {
    if (activeIndex > 0) {
      setActiveIndex((prev) => prev - 1);
    }
  }, [activeIndex]);

  const generateNewPuzzles = useCallback(
    async (limit = 5) => {
      if (isGenerating) return;
      setIsGenerating(true);
      setFetchError(null);
      try {
        const generated = await generateFreshRecommendations(limit);
        setRawPuzzles(generated);
        setActiveIndex(0);
      } catch (err) {
        setFetchError(
          err?.message ||
            "Failed to generate new personalized recommendations.",
        );
      } finally {
        setIsGenerating(false);
      }
    },
    [isGenerating],
  );

  return {
    puzzles: filteredPuzzles,
    totalUnfilteredCount: rawPuzzles.length,
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
    moveStepIndex,
    dashboardStats,
    recentActivity,
    availableThemes,
    themeFilter,
    setThemeFilter: (theme) => {
      setThemeFilter(theme);
      setActiveIndex(0);
    },
    difficultyFilter,
    setDifficultyFilter: (diff) => {
      setDifficultyFilter(diff);
      setActiveIndex(0);
    },
    statusFilter,
    setStatusFilter: (st) => {
      setStatusFilter(st);
      setActiveIndex(0);
    },
    isLoading,
    isLoadingMore,
    isGenerating,
    fetchError,
    backendEndpointMissing,
    hasMore: pagination.hasMore,
    loadMore: () => loadPuzzles({ reset: false }),
    reloadPuzzles: () => loadPuzzles({ reset: true }),
    generateNewPuzzles,
    selectPuzzle,
    nextPuzzle,
    prevPuzzle,
    handleAttemptMove,
    requestHint,
    resetCurrentPuzzle,
    retrySubmission,
  };
}
