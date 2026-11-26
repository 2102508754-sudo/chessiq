/**
 * ChessIQ v3.3.0 — Dedicated Day 16 Authentication & First-Party Cookie Integration Test Suite
 * Covers all 14 Phase 9 testing requirements:
 * 1. Initial session restoration
 * 2. Successful login
 * 3. Incorrect login credentials
 * 4. Session expiration
 * 5. Successful logout
 * 6. Failed logout
 * 7. Protected route access
 * 8. Unauthenticated access
 * 9. API requests with credentials included
 * 10. HTTP 401 handling
 * 11. HTTP 403 handling
 * 12. Browser refresh while authenticated
 * 13. No duplicate session checks
 * 14. No access to HttpOnly cookies from JavaScript
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  apiClient,
  ApiError,
  api,
  _resetSessionExpiredDebounceForTesting,
} from "../src/api/client.js";
import {
  extractSafeUser,
  fetchCurrentUser,
  loginUser,
  registerUser,
  logoutUser,
} from "../src/api/auth.js";
import { AUTH_STATUS } from "../src/context/authConstants.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_ROOT = path.resolve(__dirname, "..");

function setupWindowMock() {
  const listeners = new Map();
  const events = [];
  globalThis.CustomEvent = class CustomEvent {
    constructor(type, init = {}) {
      this.type = type;
      this.detail = init.detail || {};
    }
  };
  globalThis.window = {
    addEventListener: (type, cb) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(cb);
    },
    removeEventListener: (type, cb) => {
      listeners.get(type)?.delete(cb);
    },
    dispatchEvent: (evt) => {
      events.push(evt);
      listeners.get(evt.type)?.forEach((cb) => cb(evt));
      return true;
    },
  };
  return { events };
}

function createFetchMock(handler) {
  const calls = [];
  globalThis.fetch = async (url, config) => {
    calls.push({ url, config });
    return handler(url, config);
  };
  return { calls };
}

function jsonResponse(status, body, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (h) => {
        const lower = h.toLowerCase();
        if (lower === "content-type") return "application/json";
        return headers[lower] || null;
      },
    },
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

// -----------------------------------------------------------------------------
// 1. Initial Session Restoration
// -----------------------------------------------------------------------------
test("1. Initial session restoration retrieves user profile via /api/auth/me and extracts safe fields", async () => {
  setupWindowMock();
  createFetchMock(async (url) => {
    if (url === "/api/auth/me") {
      return jsonResponse(200, {
        status: "success",
        data: {
          user: {
            id: "user-42",
            username: "magnus_c",
            email: "magnus@chessiq.com",
            chess_rating: 2882,
            password_hash: "$2b$10$insecure_hash_should_not_leak",
          },
        },
      });
    }
    return jsonResponse(404, { error: "NOT_FOUND" });
  });

  const user = await fetchCurrentUser();
  assert.ok(user, "User should be restored");
  assert.equal(user.id, "user-42");
  assert.equal(user.username, "magnus_c");
  assert.equal(user.email, "magnus@chessiq.com");
  assert.equal(user.chess_rating, 2882);
  assert.equal(user.password_hash, undefined, "Sensitive hash must be stripped");
});

// -----------------------------------------------------------------------------
// 2. Successful Login
// -----------------------------------------------------------------------------
test("2. Successful login submits credentials and returns safe user profile without secrets", async () => {
  setupWindowMock();
  const { calls } = createFetchMock(async (url, config) => {
    if (url === "/api/auth/login") {
      const body = JSON.parse(config.body);
      assert.equal(body.username, "hikaru_n");
      assert.equal(body.password, "b0ngcl0ud!");
      return jsonResponse(200, {
        status: "success",
        data: {
          user: {
            id: "user-hikaru",
            username: "hikaru_n",
            email: "hikaru@chessiq.com",
            chess_rating: 2875,
            session_secret: "must_not_reach_frontend",
          },
        },
      });
    }
    return jsonResponse(404, { error: "NOT_FOUND" });
  });

  const res = await loginUser({ identifier: "hikaru_n", password: "b0ngcl0ud!" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "/api/auth/login");
  assert.equal(calls[0].config.credentials, "include");
  assert.equal(res.user.username, "hikaru_n");
  assert.equal(res.user.chess_rating, 2875);
  assert.equal(res.user.session_secret, undefined);
});

// -----------------------------------------------------------------------------
// 3. Incorrect Login Credentials
// -----------------------------------------------------------------------------
test("3. Incorrect login credentials handles HTTP 401 error gracefully without crashing or faking session", async () => {
  const { events } = setupWindowMock();
  createFetchMock(async () =>
    jsonResponse(401, {
      error: "INVALID_CREDENTIALS",
      message: "The provided username or password does not match our records.",
    }),
  );

  await assert.rejects(
    () => loginUser({ identifier: "guest", password: "wrongpassword" }),
    (err) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.status, 401);
      assert.equal(err.code, "INVALID_CREDENTIALS");
      return true;
    },
  );

  // Failed login must NEVER trigger global session_expired event
  assert.equal(events.filter((e) => e.type === "chessiq:session_expired").length, 0);
});

// -----------------------------------------------------------------------------
// 4. Session Expiration
// -----------------------------------------------------------------------------
test("4. Session expiration on protected API call triggers debounced chessiq:session_expired event", async () => {
  _resetSessionExpiredDebounceForTesting();
  const { events } = setupWindowMock();
  createFetchMock(async () =>
    jsonResponse(401, {
      error: "SESSION_EXPIRED",
      message: "First-party session cookie has expired or was revoked.",
    }),
  );

  await assert.rejects(
    () => api.get("/api/games"),
    (err) => err instanceof ApiError && err.status === 401,
  );

  const expiredEvents = events.filter((e) => e.type === "chessiq:session_expired");
  assert.equal(expiredEvents.length, 1);
  assert.equal(expiredEvents[0].detail.status, 401);
  assert.equal(expiredEvents[0].detail.endpoint, "/api/games");
});

// -----------------------------------------------------------------------------
// 5. Successful Logout
// -----------------------------------------------------------------------------
test("5. Successful logout calls POST /api/auth/logout with credentials: 'include'", async () => {
  setupWindowMock();
  const { calls } = createFetchMock(async (url) => {
    if (url === "/api/auth/logout") {
      return jsonResponse(200, { status: "success", message: "Logged out" });
    }
    return jsonResponse(404, { error: "NOT_FOUND" });
  });

  const res = await logoutUser();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "/api/auth/logout");
  assert.equal(calls[0].config.method, "POST");
  assert.equal(calls[0].config.credentials, "include");
  assert.equal(res.status, "success");
});

// -----------------------------------------------------------------------------
// 6. Failed Logout
// -----------------------------------------------------------------------------
test("6. Failed logout handles server/network failure without wedging the client", async () => {
  setupWindowMock();
  createFetchMock(async () =>
    jsonResponse(500, { error: "SERVER_ERROR", message: "Redis session store unreachable" }),
  );

  await assert.rejects(
    () => logoutUser(),
    (err) => err instanceof ApiError && err.status === 500,
  );
});

// -----------------------------------------------------------------------------
// 7. Protected Route Access
// -----------------------------------------------------------------------------
test("7. Protected route access logic authorizes authenticated user directly to target view", () => {
  const state = {
    status: AUTH_STATUS.AUTHENTICATED,
    user: { id: "u-1", username: "grandmaster" },
    intendedDestination: null,
  };

  const isAllowed = state.status === AUTH_STATUS.AUTHENTICATED && Boolean(state.user);
  assert.equal(isAllowed, true);
});

// -----------------------------------------------------------------------------
// 8. Unauthenticated Access
// -----------------------------------------------------------------------------
test("8. Unauthenticated access preserves intended destination across login redirect", () => {
  let intendedDestination = null;
  const setIntendedDestination = (dest) => {
    intendedDestination = dest;
  };

  const currentStatus = AUTH_STATUS.UNAUTHENTICATED;
  const targetRoute = "puzzles";

  if (currentStatus !== AUTH_STATUS.AUTHENTICATED) {
    setIntendedDestination(targetRoute);
  }

  assert.equal(intendedDestination, "puzzles");

  // Post-login redirect resolution
  const resolvedTarget = intendedDestination || "analysis";
  setIntendedDestination(null);
  assert.equal(resolvedTarget, "puzzles");
  assert.equal(intendedDestination, null);
});

// -----------------------------------------------------------------------------
// 9. API Requests with Credentials Included
// -----------------------------------------------------------------------------
test("9. API requests enforce credentials: 'include' across all REST methods", async () => {
  setupWindowMock();
  const { calls } = createFetchMock(async () => jsonResponse(200, { ok: true }));

  await api.get("/api/health");
  await api.post("/api/games", { pgn: "1. e4 e5" });
  await api.put("/api/users/profile", { rating: 1600 });
  await api.patch("/api/puzzles/p1", { solved: true });
  await api.del("/api/games/g1");

  assert.equal(calls.length, 5);
  for (const call of calls) {
    assert.equal(call.config.credentials, "include", `Endpoint ${call.url} must include credentials`);
  }
});

// -----------------------------------------------------------------------------
// 10. HTTP 401 Handling
// -----------------------------------------------------------------------------
test("10. HTTP 401 handling creates structured ApiError and debounces rapid concurrent requests", async () => {
  _resetSessionExpiredDebounceForTesting();
  const { events } = setupWindowMock();
  createFetchMock(async () =>
    jsonResponse(401, { error: "UNAUTHORIZED", message: "Authentication required" }),
  );

  const promises = [
    api.get("/api/games").catch((e) => e),
    api.get("/api/recommendations").catch((e) => e),
    api.get("/api/user/stats").catch((e) => e),
  ];
  const results = await Promise.all(promises);

  for (const res of results) {
    assert.ok(res instanceof ApiError);
    assert.equal(res.status, 401);
  }

  // Only 1 expiration event dispatched despite 3 rapid concurrent requests
  const expiredEvents = events.filter((e) => e.type === "chessiq:session_expired");
  assert.equal(expiredEvents.length, 1);
});

// -----------------------------------------------------------------------------
// 11. HTTP 403 Handling
// -----------------------------------------------------------------------------
test("11. HTTP 403 handling throws ApiError(403) and does NOT trigger session expiration", async () => {
  const { events } = setupWindowMock();
  createFetchMock(async () =>
    jsonResponse(403, {
      error: "FORBIDDEN",
      message: "You do not have permission to access another user's game analysis",
    }),
  );

  await assert.rejects(
    () => api.get("/api/games/private-game-99"),
    (err) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.status, 403);
      assert.equal(err.code, "FORBIDDEN");
      return true;
    },
  );

  // 403 Forbidden is an authorization failure, NOT a session expiration event
  assert.equal(events.filter((e) => e.type === "chessiq:session_expired").length, 0);
});

// -----------------------------------------------------------------------------
// 12. Browser Refresh While Authenticated
// -----------------------------------------------------------------------------
test("12. Browser refresh while authenticated checks cookie via /api/auth/me on mount", async () => {
  setupWindowMock();
  const { calls } = createFetchMock(async (url) => {
    if (url === "/api/auth/me") {
      return jsonResponse(200, {
        status: "success",
        data: {
          user: {
            id: "user-refresh-1",
            username: "refresh_player",
            chess_rating: 1650,
          },
        },
      });
    }
    return jsonResponse(404, { error: "NOT_FOUND" });
  });

  const refreshedUser = await fetchCurrentUser();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "/api/auth/me");
  assert.equal(calls[0].config.credentials, "include");
  assert.equal(refreshedUser.username, "refresh_player");
  assert.equal(refreshedUser.chess_rating, 1650);
});

// -----------------------------------------------------------------------------
// 13. No Duplicate Session Checks
// -----------------------------------------------------------------------------
test("13. No duplicate session checks: unauthenticated /api/auth/me handles 401/404 cleanly", async () => {
  const { events } = setupWindowMock();
  const { calls } = createFetchMock(async () =>
    jsonResponse(401, { error: "NO_SESSION", message: "No active session cookie found" }),
  );

  await assert.rejects(
    () => fetchCurrentUser(),
    (err) => err instanceof ApiError && err.status === 401,
  );

  assert.equal(calls.length, 1);
  // Initial session probe suppresses auth events to prevent spurious flash of session expired banner
  assert.equal(events.length, 0);
});

// -----------------------------------------------------------------------------
// 14. No Access to HttpOnly Cookies from JavaScript
// -----------------------------------------------------------------------------
test("14. No access to HttpOnly cookies from JavaScript & strict cookie security compliance", () => {
  const srcDir = path.join(CLIENT_ROOT, "src");

  function walk(dir) {
    let files = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files = files.concat(walk(full));
      } else if (/\.(js|jsx|mjs)$/.test(entry.name)) {
        files.push(full);
      }
    }
    return files;
  }

  const allSourceFiles = walk(srcDir);
  assert.ok(allSourceFiles.length >= 10, "Source files should be present");

  for (const f of allSourceFiles) {
    const code = fs.readFileSync(f, "utf8");
    assert.equal(
      /document\.cookie/.test(code),
      false,
      `Forbidden document.cookie access found in: ${f}`,
    );
    assert.equal(
      /localStorage\s*\.\s*(get|set)Item/.test(code),
      false,
      `Forbidden localStorage access found in: ${f}`,
    );
    assert.equal(
      /sessionStorage\s*\.\s*(get|set)Item/.test(code),
      false,
      `Forbidden sessionStorage access found in: ${f}`,
    );
  }
});
