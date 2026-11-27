/**
 * ChessIQ v3.3.0 — Single-Domain Authentication API Client
 * Day 16 (@FE): Connects to /api/auth/* routes over same-origin credentials ("include").
 * Session persistence is managed solely via HttpOnly first-party cookies set by the backend.
 */

import api from "./client.js";

/**
 * Normalizes backend user response payload while stripping any accidental sensitive keys.
 * @param {any} response
 * @returns {Object|null}
 */
export function extractSafeUser(response) {
  const raw =
    response?.data?.user || response?.user || response?.data || response;
  if (!raw || typeof raw !== "object") return null;
  if (!raw.id && !raw.username && !raw.email) return null;

  return {
    id: raw.id,
    username: raw.username || raw.email?.split("@")[0] || "Player",
    email: raw.email || null,
    chess_rating:
      raw.chess_rating !== undefined && raw.chess_rating !== null
        ? Number(raw.chess_rating)
        : null,
    created_at: raw.created_at || null,
  };
}

/**
 * Probes current authenticated session via first-party session cookie.
 * Uses suppressAuthEvent: true so an unauthenticated initial visit does not emit a session_expired event.
 * @param {AbortSignal} [signal]
 */
export async function fetchCurrentUser(signal) {
  const res = await api.get("/api/auth/me", {
    signal,
    suppressAuthEvent: true,
  });
  return extractSafeUser(res);
}

/**
 * Authenticates a user with credentials; backend sets HttpOnly cookie (`chessiq_session`).
 * @param {{ identifier?: string, username?: string, email?: string, password: string }} credentials
 */
export async function loginUser({ identifier, username, email, password }) {
  const trimmed = (identifier || email || username || "").trim();
  const payload = trimmed.includes("@")
    ? { email: email || trimmed, username: username || trimmed, password }
    : { username: username || trimmed, email: email || undefined, password };

  const res = await api.post("/api/auth/login", payload);
  return {
    user: extractSafeUser(res),
    raw: res,
  };
}

/**
 * Registers a new user account; backend sets HttpOnly cookie (`chessiq_session`).
 * @param {{ username: string, email: string, password: string, chess_rating?: number }} registration
 */
export async function registerUser({
  username,
  email,
  password,
  chess_rating,
}) {
  const payload = {
    username: username.trim(),
    email: email.trim(),
    password,
  };
  if (
    chess_rating !== undefined &&
    chess_rating !== "" &&
    !isNaN(Number(chess_rating))
  ) {
    payload.chess_rating = Number(chess_rating);
  }

  const res = await api.post("/api/auth/register", payload);
  return {
    user: extractSafeUser(res),
    raw: res,
  };
}

/**
 * Terminates the active session on the backend and instructs browser to clear session cookie.
 */
export async function logoutUser() {
  return api.post("/api/auth/logout", {});
}

/**
 * Fetches configured OAuth 2.0 providers from the backend.
 * @param {AbortSignal} [signal]
 * @returns {Promise<Array<{ id: string, name: string }>>}
 */
export async function fetchOAuthProviders(signal) {
  try {
    const res = await api.get("/api/auth/oauth/providers", {
      signal,
      suppressAuthEvent: true,
    });
    return res?.data?.providers || res?.providers || [];
  } catch {
    return [];
  }
}

/**
 * Returns the same-origin URL that initiates the OAuth 2.0 Authorization Code flow.
 * @param {string} provider
 * @returns {string}
 */
export function getOAuthStartUrl(provider) {
  return `/api/auth/oauth/${encodeURIComponent(provider)}`;
}
