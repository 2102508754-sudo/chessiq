/**
 * ChessIQ v3.3.0 — Real-Time Analysis Progress HUD & Telemetry Component
 * Day 12 (@FE): Visualizes live analysis polling states, progress bars,
 * active ply evaluation counter, worker lease telemetry, and retry controls.
 */

import React from "react";
import {
  Cpu,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Zap,
  Upload,
  XCircle,
} from "lucide-react";
import { POLLING_STATUS } from "../hooks/useAnalysisPolling";

export default function AnalysisProgressBar({
  status = POLLING_STATUS.IDLE,
  currentPly = 0,
  totalPlies = 0,
  progressPercent = 0,
  attemptCount = 1,
  error = null,
  onRetry,
  onDismiss,
}) {
  if (status === POLLING_STATUS.IDLE) return null;

  const isUploading = status === POLLING_STATUS.UPLOADING;
  const isPending = status === POLLING_STATUS.PENDING;
  const isProcessing = status === POLLING_STATUS.PROCESSING;
  const isCompleted = status === POLLING_STATUS.COMPLETED;
  const isFailed = status === POLLING_STATUS.FAILED;

  return (
    <div
      className="glass-panel"
      style={{
        padding: "16px 20px",
        background: isFailed
          ? "linear-gradient(135deg, rgba(244, 63, 94, 0.12) 0%, rgba(18, 22, 31, 0.8) 100%)"
          : isCompleted
            ? "linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(18, 22, 31, 0.8) 100%)"
            : "linear-gradient(135deg, rgba(56, 189, 248, 0.12) 0%, rgba(18, 22, 31, 0.8) 100%)",
        border: isFailed
          ? "1px solid rgba(244, 63, 94, 0.4)"
          : isCompleted
            ? "1px solid rgba(16, 185, 129, 0.4)"
            : "1px solid rgba(56, 189, 248, 0.4)",
        borderRadius: "12px",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        transition: "all 0.3s ease",
      }}
    >
      {/* HEADER ROW */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {isUploading && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Upload size={18} color="var(--accent-cyan)" className="animate-pulse" />
              <span style={{ fontSize: "14px", fontWeight: "700", color: "var(--accent-cyan)" }}>
                Uploading Game PGN...
              </span>
            </div>
          )}

          {isPending && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Clock size={18} color="var(--accent-amber)" />
              <span style={{ fontSize: "14px", fontWeight: "700", color: "var(--accent-amber)" }}>
                Queued in FIFO Pipeline (Attempt #{attemptCount})
              </span>
            </div>
          )}

          {isProcessing && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Cpu size={18} color="var(--accent-cyan)" />
              <span style={{ fontSize: "14px", fontWeight: "700", color: "var(--accent-cyan)" }}>
                Stockfish 16.1 NNUE Deep Analysis Active
              </span>
            </div>
          )}

          {isCompleted && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <CheckCircle2 size={18} color="var(--accent-emerald)" />
              <span style={{ fontSize: "14px", fontWeight: "700", color: "var(--accent-emerald)" }}>
                Analysis Complete &amp; Verified (6NF Telemetry Synced)
              </span>
            </div>
          )}

          {isFailed && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <AlertTriangle size={18} color="var(--accent-rose)" />
              <span style={{ fontSize: "14px", fontWeight: "700", color: "var(--accent-rose)" }}>
                Analysis Processing Interrupted
              </span>
            </div>
          )}
        </div>

        {/* CONTROLS */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {isFailed && onRetry && (
            <button
              onClick={onRetry}
              className="btn-primary"
              style={{
                padding: "4px 10px",
                fontSize: "12px",
                gap: "4px",
                background: "rgba(244, 63, 94, 0.25)",
                border: "1px solid rgba(244, 63, 94, 0.5)",
                color: "#fb7185",
              }}
            >
              <RotateCcw size={13} /> Retry
            </button>
          )}

          {onDismiss && (
            <button
              onClick={onDismiss}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text-muted)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
              }}
              title="Dismiss Progress HUD"
            >
              <XCircle size={16} />
            </button>
          )}
        </div>
      </div>

      {/* PROGRESS TRACK & PERCENTAGE */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <div
          style={{
            height: "8px",
            background: "rgba(255, 255, 255, 0.08)",
            borderRadius: "4px",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${Math.max(4, Math.min(100, progressPercent))}%`,
              background: isFailed
                ? "var(--accent-rose)"
                : isCompleted
                  ? "linear-gradient(90deg, #10b981 0%, #34d399 100%)"
                  : "linear-gradient(90deg, #38bdf8 0%, #818cf8 100%)",
              borderRadius: "4px",
              transition: "width 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          />
        </div>

        {/* METRIC SUB-ROW */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "12px",
            color: "var(--text-secondary)",
            fontFamily: "var(--font-mono)",
          }}
        >
          <span>
            {isProcessing && `Analyzing ply ${currentPly} of ${totalPlies}...`}
            {isPending && "Awaiting Stockfish process pool worker acquisition..."}
            {isUploading && "Parsing PGN headers & generating canonical signature..."}
            {isCompleted && `${totalPlies} plies successfully evaluated & classified`}
            {isFailed && (error || "Worker lease error. Check database or queue.")}
          </span>
          <span style={{ fontWeight: "700", color: "var(--text-primary)" }}>
            {progressPercent}%
          </span>
        </div>
      </div>

      {/* TELEMETRY FOOTER */}
      {(isProcessing || isPending) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            fontSize: "11px",
            color: "var(--text-muted)",
            borderTop: "1px solid var(--border-color)",
            paddingTop: "8px",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <Zap size={12} color="var(--accent-cyan)" /> Depth: <strong>14 Ply</strong>
          </span>
          <span>
            Worker: <strong>Stockfish NNUE Worker Pool</strong>
          </span>
          <span>
            Heartbeat: <strong style={{ color: "var(--accent-emerald)" }}>Active (3.0s Lease)</strong>
          </span>
        </div>
      )}
    </div>
  );
}
