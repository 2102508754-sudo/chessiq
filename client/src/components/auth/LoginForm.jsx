/**
 * ChessIQ v3.3.0 — Single-Domain Authentication Form
 * Day 16 (@FE): Login & Registration UI communicating exclusively via /api/auth/*
 * using browser-managed first-party HttpOnly session cookies.
 */

import React, { useState } from "react";
import {
  Lock,
  Mail,
  User,
  ShieldCheck,
  AlertCircle,
  ArrowRight,
  Loader2,
  UserPlus,
  LogIn,
  ServerCrash,
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";

export default function LoginForm({
  destinationLabel = null,
  onSuccess,
  initialMode = "login",
}) {
  const {
    login,
    register,
    isSubmitting,
    authError,
    isExpired,
    backendAuthUnavailable,
    clearAuthError,
  } = useAuth();

  const [mode, setMode] = useState(initialMode); // "login" | "register"
  const [identifier, setIdentifier] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [chessRating, setChessRating] = useState("1500");
  const [localError, setLocalError] = useState(null);

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setLocalError(null);
    clearAuthError();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError(null);
    clearAuthError();

    if (mode === "login") {
      if (!identifier.trim() || !password) {
        setLocalError("Please enter both your username/email and password.");
        return;
      }
      const res = await login({ identifier: identifier.trim(), password });
      if (res.ok && onSuccess) {
        onSuccess(res.user);
      }
      return;
    }

    // Registration validation
    if (!username.trim() || !email.trim() || !password) {
      setLocalError("Username, email, and password are required.");
      return;
    }
    if (password.length < 8) {
      setLocalError("Password must be at least 8 characters long.");
      return;
    }

    const res = await register({
      username: username.trim(),
      email: email.trim(),
      password,
      chess_rating: chessRating ? Number(chessRating) : undefined,
    });
    if (res.ok && onSuccess) {
      onSuccess(res.user);
    }
  };

  const activeError = localError || authError;

  return (
    <div
      className="glass-panel"
      style={{
        maxWidth: "460px",
        margin: "24px auto",
        padding: "28px",
        borderTop: "3px solid var(--accent-cyan)",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: "20px" }}>
        <div
          style={{
            width: "48px",
            height: "48px",
            borderRadius: "12px",
            background: "rgba(56, 189, 248, 0.14)",
            border: "1px solid rgba(56, 189, 248, 0.35)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "12px",
          }}
        >
          <Lock size={22} color="var(--accent-cyan)" />
        </div>
        <h2
          style={{ fontSize: "20px", fontWeight: "700", marginBottom: "6px" }}
        >
          {mode === "login" ? "Sign In to ChessIQ" : "Create ChessIQ Account"}
        </h2>
        <p
          style={{
            fontSize: "13px",
            color: "var(--text-secondary)",
            lineHeight: "1.5",
          }}
        >
          {destinationLabel
            ? `Authentication is required to access ${destinationLabel}.`
            : "Access your analyzed games, longitudinal radar telemetry, and personalized training puzzles."}
        </p>
      </div>

      {/* Mode Switcher */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "6px",
          padding: "4px",
          background: "rgba(255, 255, 255, 0.04)",
          borderRadius: "8px",
          border: "1px solid var(--border-color)",
          marginBottom: "18px",
        }}
      >
        <button
          type="button"
          onClick={() => switchMode("login")}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            padding: "8px",
            borderRadius: "6px",
            fontSize: "13px",
            fontWeight: "600",
            cursor: "pointer",
            background:
              mode === "login" ? "rgba(56, 189, 248, 0.2)" : "transparent",
            color:
              mode === "login"
                ? "var(--text-primary)"
                : "var(--text-secondary)",
            border:
              mode === "login"
                ? "1px solid rgba(56, 189, 248, 0.4)"
                : "1px solid transparent",
          }}
        >
          <LogIn size={14} /> Sign In
        </button>
        <button
          type="button"
          onClick={() => switchMode("register")}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            padding: "8px",
            borderRadius: "6px",
            fontSize: "13px",
            fontWeight: "600",
            cursor: "pointer",
            background:
              mode === "register" ? "rgba(99, 102, 241, 0.2)" : "transparent",
            color:
              mode === "register"
                ? "var(--text-primary)"
                : "var(--text-secondary)",
            border:
              mode === "register"
                ? "1px solid rgba(99, 102, 241, 0.4)"
                : "1px solid transparent",
          }}
        >
          <UserPlus size={14} /> Register
        </button>
      </div>

      {/* Session Expired Warning */}
      {isExpired && !activeError && (
        <div
          role="alert"
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
            padding: "10px 12px",
            borderRadius: "8px",
            background: "rgba(245, 158, 11, 0.14)",
            border: "1px solid rgba(245, 158, 11, 0.35)",
            color: "#fbbf24",
            fontSize: "12px",
            marginBottom: "14px",
          }}
        >
          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: "1px" }} />
          <span>Your previous session expired. Please sign in again.</span>
        </div>
      )}

      {/* Backend 404 Contract Notice */}
      {backendAuthUnavailable && (
        <div
          role="status"
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
            padding: "10px 12px",
            borderRadius: "8px",
            background: "rgba(99, 102, 241, 0.12)",
            border: "1px solid rgba(99, 102, 241, 0.35)",
            color: "#a5b4fc",
            fontSize: "12px",
            lineHeight: "1.45",
            marginBottom: "14px",
          }}
        >
          <ServerCrash size={16} style={{ flexShrink: 0, marginTop: "2px" }} />
          <span>
            Backend authentication routes (<code>/api/auth/login</code>,{" "}
            <code>/api/auth/me</code>) returned HTTP 404 and are awaiting Day 16
            backend route deployment.
          </span>
        </div>
      )}

      {/* Error Message */}
      {activeError && (
        <div
          role="alert"
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
            padding: "10px 12px",
            borderRadius: "8px",
            background: "rgba(244, 63, 94, 0.14)",
            border: "1px solid rgba(244, 63, 94, 0.38)",
            color: "#fb7185",
            fontSize: "12px",
            lineHeight: "1.45",
            marginBottom: "14px",
          }}
        >
          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: "1px" }} />
          <span>{activeError}</span>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "14px" }}
      >
        {mode === "login" ? (
          <div>
            <label
              htmlFor="chessiq-login-id"
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: "600",
                color: "var(--text-secondary)",
                marginBottom: "6px",
              }}
            >
              Username or Email
            </label>
            <div style={{ position: "relative" }}>
              <User
                size={15}
                color="var(--text-muted)"
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                }}
              />
              <input
                id="chessiq-login-id"
                type="text"
                autoComplete="username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="grandmaster@chessiq.com"
                disabled={isSubmitting}
                style={{
                  width: "100%",
                  padding: "10px 12px 10px 36px",
                  borderRadius: "8px",
                  border: "1px solid var(--border-color)",
                  background: "rgba(10, 12, 16, 0.65)",
                  color: "var(--text-primary)",
                  fontSize: "13px",
                  outline: "none",
                }}
              />
            </div>
          </div>
        ) : (
          <>
            <div>
              <label
                htmlFor="chessiq-reg-username"
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: "600",
                  color: "var(--text-secondary)",
                  marginBottom: "6px",
                }}
              >
                Username
              </label>
              <div style={{ position: "relative" }}>
                <User
                  size={15}
                  color="var(--text-muted)"
                  style={{
                    position: "absolute",
                    left: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                  }}
                />
                <input
                  id="chessiq-reg-username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="tactical_player"
                  disabled={isSubmitting}
                  style={{
                    width: "100%",
                    padding: "10px 12px 10px 36px",
                    borderRadius: "8px",
                    border: "1px solid var(--border-color)",
                    background: "rgba(10, 12, 16, 0.65)",
                    color: "var(--text-primary)",
                    fontSize: "13px",
                    outline: "none",
                  }}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="chessiq-reg-email"
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: "600",
                  color: "var(--text-secondary)",
                  marginBottom: "6px",
                }}
              >
                Email Address
              </label>
              <div style={{ position: "relative" }}>
                <Mail
                  size={15}
                  color="var(--text-muted)"
                  style={{
                    position: "absolute",
                    left: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                  }}
                />
                <input
                  id="chessiq-reg-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="player@chessiq.com"
                  disabled={isSubmitting}
                  style={{
                    width: "100%",
                    padding: "10px 12px 10px 36px",
                    borderRadius: "8px",
                    border: "1px solid var(--border-color)",
                    background: "rgba(10, 12, 16, 0.65)",
                    color: "var(--text-primary)",
                    fontSize: "13px",
                    outline: "none",
                  }}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="chessiq-reg-rating"
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: "600",
                  color: "var(--text-secondary)",
                  marginBottom: "6px",
                }}
              >
                Initial Chess Rating (100–4000)
              </label>
              <input
                id="chessiq-reg-rating"
                type="number"
                min={100}
                max={4000}
                value={chessRating}
                onChange={(e) => setChessRating(e.target.value)}
                disabled={isSubmitting}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--border-color)",
                  background: "rgba(10, 12, 16, 0.65)",
                  color: "var(--text-primary)",
                  fontSize: "13px",
                  outline: "none",
                }}
              />
            </div>
          </>
        )}

        <div>
          <label
            htmlFor="chessiq-auth-password"
            style={{
              display: "block",
              fontSize: "12px",
              fontWeight: "600",
              color: "var(--text-secondary)",
              marginBottom: "6px",
            }}
          >
            Password
          </label>
          <div style={{ position: "relative" }}>
            <Lock
              size={15}
              color="var(--text-muted)"
              style={{
                position: "absolute",
                left: "12px",
                top: "50%",
                transform: "translateY(-50%)",
              }}
            />
            <input
              id="chessiq-auth-password"
              type="password"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={isSubmitting}
              style={{
                width: "100%",
                padding: "10px 12px 10px 36px",
                borderRadius: "8px",
                border: "1px solid var(--border-color)",
                background: "rgba(10, 12, 16, 0.65)",
                color: "var(--text-primary)",
                fontSize: "13px",
                outline: "none",
              }}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="btn-primary"
          style={{
            width: "100%",
            justifyContent: "center",
            padding: "11px 18px",
            marginTop: "4px",
            opacity: isSubmitting ? 0.7 : 1,
            cursor: isSubmitting ? "wait" : "pointer",
          }}
        >
          {isSubmitting ? (
            <>
              <Loader2 size={16} /> Authenticating...
            </>
          ) : mode === "login" ? (
            <>
              Sign In <ArrowRight size={16} />
            </>
          ) : (
            <>
              Create Account <ArrowRight size={16} />
            </>
          )}
        </button>
      </form>

      <div
        style={{
          marginTop: "18px",
          paddingTop: "14px",
          borderTop: "1px solid var(--border-color)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          fontSize: "11px",
          color: "var(--text-muted)",
        }}
      >
        <ShieldCheck size={14} color="var(--accent-emerald)" />
        <span>
          Single-Domain First-Party Session Cookies (HttpOnly • SameSite=Lax)
        </span>
      </div>
    </div>
  );
}
