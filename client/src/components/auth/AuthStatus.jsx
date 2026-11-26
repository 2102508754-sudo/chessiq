/**
 * ChessIQ v3.3.0 — Header Authentication Status Pill
 * Day 16 (@FE): Displays current authenticated profile or Sign In trigger.
 */

import React from "react";
import { UserCheck, LogOut, LogIn, ShieldAlert, Loader2 } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";

export default function AuthStatus({ onOpenLogin }) {
  const { isAuthenticated, isLoading, isExpired, isSubmitting, user, logout } =
    useAuth();

  if (isLoading) {
    return (
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          padding: "7px 12px",
          borderRadius: "8px",
          border: "1px solid var(--border-color)",
          background: "rgba(255, 255, 255, 0.03)",
          fontSize: "12px",
          color: "var(--text-secondary)",
        }}
      >
        <Loader2 size={14} /> Session Check...
      </div>
    );
  }

  if (isAuthenticated && user) {
    return (
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "10px",
          padding: "6px 12px",
          borderRadius: "8px",
          border: "1px solid rgba(16, 185, 129, 0.35)",
          background: "rgba(16, 185, 129, 0.08)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <UserCheck size={15} color="var(--accent-emerald)" />
          <span
            style={{
              fontSize: "13px",
              fontWeight: "600",
              color: "var(--text-primary)",
            }}
          >
            {user.username}
          </span>
          {user.chess_rating !== null && user.chess_rating !== undefined && (
            <span
              style={{
                fontSize: "11px",
                fontFamily: "var(--font-mono)",
                padding: "1px 6px",
                borderRadius: "4px",
                background: "rgba(56, 189, 248, 0.14)",
                color: "var(--accent-cyan)",
              }}
            >
              {user.chess_rating}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={logout}
          disabled={isSubmitting}
          title="Sign Out"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            padding: "4px 8px",
            borderRadius: "6px",
            border: "1px solid rgba(244, 63, 94, 0.35)",
            background: "rgba(244, 63, 94, 0.12)",
            color: "#fb7185",
            fontSize: "11px",
            fontWeight: "600",
            cursor: isSubmitting ? "wait" : "pointer",
          }}
        >
          <LogOut size={12} /> Logout
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpenLogin}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "8px 14px",
        borderRadius: "8px",
        border: isExpired
          ? "1px solid rgba(245, 158, 11, 0.5)"
          : "1px solid rgba(56, 189, 248, 0.4)",
        background: isExpired
          ? "rgba(245, 158, 11, 0.15)"
          : "rgba(56, 189, 248, 0.14)",
        color: isExpired ? "#fbbf24" : "var(--accent-cyan)",
        fontSize: "13px",
        fontWeight: "600",
        cursor: "pointer",
      }}
    >
      {isExpired ? <ShieldAlert size={15} /> : <LogIn size={15} />}
      {isExpired ? "Session Expired — Sign In" : "Sign In"}
    </button>
  );
}
