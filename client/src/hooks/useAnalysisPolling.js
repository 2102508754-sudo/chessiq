/**
 * ChessIQ v3.3.0 — Real-Time Analysis Polling Hook
 * Day 12 (@FE): Robust, lifecycle-safe polling for async Stockfish analysis jobs.
 *
 * Features:
 * - Polls /api/jobs/:id (or /api/games/jobs/:id) with adaptive backoff
 * - Fast polling (800ms) during 'processing' state; slower (1800ms) during 'pending'
 * - Auto-cleanup on component unmount via AbortController
 * - Duplicate request prevention via isPollingRef lock
 * - Graceful retry on transient errors with exponential backoff (max 5 retries)
 * - Exposes: status, currentPly, totalPlies, progressPercent, error, retry
 */

import { useState, useEffect, useRef, useCallback } from "react";
import api, { ApiError } from "../api/client";

export const POLLING_STATUS = {
  IDLE: "idle",
  UPLOADING: "uploading",
  PENDING: "pending",
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed",
};

/**
 * @param {Object} options
 * @param {string} [options.jobId] - Active job ID to poll
 * @param {string} [options.gameId] - Associated game ID
 * @param {Function} [options.onComplete] - Callback when analysis completes with full data
 * @param {Function} [options.onError] - Callback on fatal failure
 * @param {boolean} [options.enabled=true] - Whether polling is active
 * @param {number} [options.fastIntervalMs=900] - Interval during 'processing' state
 * @param {number} [options.slowIntervalMs=1800] - Interval during 'pending' state
 */
export function useAnalysisPolling({
  jobId: initialJobId = null,
  gameId: initialGameId = null,
  onComplete,
  onError,
  enabled = true,
  fastIntervalMs = 900,
  slowIntervalMs = 1800,
} = {}) {
  const [jobId, setJobId] = useState(initialJobId);
  const [gameId, setGameId] = useState(initialGameId);
  const [status, setStatus] = useState(initialJobId ? POLLING_STATUS.PENDING : POLLING_STATUS.IDLE);
  const [currentPly, setCurrentPly] = useState(0);
  const [totalPlies, setTotalPlies] = useState(0);
  const [progressPercent, setProgressPercent] = useState(0);
  const [attemptCount, setAttemptCount] = useState(0);
  const [error, setError] = useState(null);
  const [completedAnalysis, setCompletedAnalysis] = useState(null);

  // Synchronization refs to avoid stale closures in setTimeout/async loops
  const isPollingRef = useRef(false);
  const timeoutRef = useRef(null);
  const abortControllerRef = useRef(null);
  const retryCountRef = useRef(0);
  const statusRef = useRef(status);
  statusRef.current = status;

  // Cleanup active timer and network requests
  const stopPolling = useCallback(() => {
    isPollingRef.current = false;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  // Poll step
  const executePollStep = useCallback(
    async (activeId) => {
      if (!activeId || !isPollingRef.current) return;

      abortControllerRef.current = new AbortController();

      try {
        // Attempt query through /api/jobs/:id or /api/games/jobs/:id
        let res;
        try {
          res = await api.get(`/api/jobs/${activeId}`, {
            signal: abortControllerRef.current.signal,
            timeoutMs: 6000,
          });
        } catch (fetchErr) {
          // If /api/jobs/ isn't direct, try fallback endpoint
          res = await api.get(`/api/games/jobs/${activeId}`, {
            signal: abortControllerRef.current.signal,
            timeoutMs: 6000,
          });
        }

        const data = res?.data || res;
        if (!data) throw new Error("Empty response from job status endpoint");

        const remoteStatus = (data.status || "pending").toLowerCase();
        const cPly = parseInt(data.current_ply ?? 0, 10);
        const tPlies = parseInt(data.total_plies ?? 0, 10);
        const pct = tPlies > 0 ? Math.min(100, Math.round((cPly / tPlies) * 100)) : 0;

        setCurrentPly(cPly);
        setTotalPlies(tPlies);
        setProgressPercent(pct);
        setAttemptCount(data.attempt_count || 1);
        setStatus(remoteStatus);
        retryCountRef.current = 0; // Reset network retry count on success

        if (remoteStatus === "completed") {
          stopPolling();
          setStatus(POLLING_STATUS.COMPLETED);
          setProgressPercent(100);
          setCompletedAnalysis(data.analysis || data);
          if (onComplete) onComplete(data);
          return;
        }

        if (remoteStatus === "failed") {
          stopPolling();
          setStatus(POLLING_STATUS.FAILED);
          const failErr = new Error(data.last_error || "Analysis job failed on worker node");
          setError(failErr.message);
          if (onError) onError(failErr);
          return;
        }

        // Schedule next polling tick if still active
        if (isPollingRef.current) {
          const delay = remoteStatus === "processing" ? fastIntervalMs : slowIntervalMs;
          timeoutRef.current = setTimeout(() => {
            executePollStep(activeId);
          }, delay);
        }
      } catch (err) {
        if (err.name === "AbortError") return;

        // Transient error handling with exponential backoff (max 5 retries)
        retryCountRef.current += 1;
        if (retryCountRef.current <= 5 && isPollingRef.current) {
          const backoffDelay = Math.min(6000, 1000 * Math.pow(1.5, retryCountRef.current));
          timeoutRef.current = setTimeout(() => {
            executePollStep(activeId);
          }, backoffDelay);
        } else {
          stopPolling();
          setStatus(POLLING_STATUS.FAILED);
          const fatalErr = `Connection failed after ${retryCountRef.current} retries: ${err.message}`;
          setError(fatalErr);
          if (onError) onError(new Error(fatalErr));
        }
      }
    },
    [fastIntervalMs, slowIntervalMs, stopPolling, onComplete, onError]
  );

  // Public start method: kicks off polling for a newly enqueued jobId
  const startPolling = useCallback(
    (newJobId, newGameId = null, totalEstimate = 0) => {
      stopPolling();
      setJobId(newJobId);
      if (newGameId) setGameId(newGameId);
      if (totalEstimate > 0) setTotalPlies(totalEstimate);

      setCurrentPly(0);
      setProgressPercent(0);
      setError(null);
      setStatus(POLLING_STATUS.PENDING);
      setCompletedAnalysis(null);
      retryCountRef.current = 0;
      isPollingRef.current = true;

      executePollStep(newJobId);
    },
    [stopPolling, executePollStep]
  );

  // Manual retry method
  const retry = useCallback(() => {
    if (jobId) {
      startPolling(jobId, gameId, totalPlies);
    }
  }, [jobId, gameId, totalPlies, startPolling]);

  // Sync with initial props
  useEffect(() => {
    if (initialJobId && enabled) {
      startPolling(initialJobId, initialGameId);
    }
    return () => stopPolling();
  }, [initialJobId, initialGameId, enabled, startPolling, stopPolling]);

  return {
    jobId,
    gameId,
    status,
    currentPly,
    totalPlies,
    progressPercent,
    attemptCount,
    error,
    completedAnalysis,
    isPolling: status === POLLING_STATUS.PENDING || status === POLLING_STATUS.PROCESSING,
    isCompleted: status === POLLING_STATUS.COMPLETED,
    isFailed: status === POLLING_STATUS.FAILED,
    startPolling,
    stopPolling,
    retry,
    setUploading: () => setStatus(POLLING_STATUS.UPLOADING),
  };
}
