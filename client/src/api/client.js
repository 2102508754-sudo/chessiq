/**
 * ChessIQ v3.3.0 — Enterprise Frontend API Client
 * Wraps native fetch with first-party cookie credentials, automatic JSON serialization,
 * timeout cancellation via AbortController, structured ApiError decoding, and 401 session expiration dispatch.
 */

export class ApiError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {number} status
   * @param {Record<string, any>} [details]
   */
  constructor(code, message, status, details = {}) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
    this.existing_game_id = details.existing_game_id || null;
  }
}

const DEFAULT_TIMEOUT_MS = 15000;
let lastSessionExpiredDispatchAt = 0;

/**
 * Resets the 401 session expiration debounce timer (for testing).
 */
export function _resetSessionExpiredDebounceForTesting() {
  lastSessionExpiredDispatchAt = 0;
}

/**
 * Executes an HTTP request through the single-domain reverse proxy (/api)
 * @param {string} endpoint - API path (e.g. '/api/health')
 * @param {RequestInit & { timeoutMs?: number, suppressAuthEvent?: boolean }} [options]
 * @returns {Promise<any>}
 */
export async function apiClient(endpoint, options = {}) {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    headers = {},
    suppressAuthEvent = false,
    ...fetchOptions
  } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const config = {
    method: "GET",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...headers,
    },
    signal: controller.signal,
    ...fetchOptions,
    credentials: "include", // Strictly enforce first-party cookie transmission
  };

  try {
    const response = await fetch(endpoint, config);
    clearTimeout(timeoutId);

    // Parse response body safely
    let data;
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      data = await response.json();
    } else {
      data = { message: await response.text() };
    }

    if (!response.ok) {
      // Avoid triggering session expiration for login/register probes or suppressed checks
      const isAuthCredentialEndpoint =
        typeof endpoint === "string" &&
        (endpoint.startsWith("/api/auth/login") ||
          endpoint.startsWith("/api/auth/register"));

      // 401 Unauthorized Session Expiration Dispatch (debounced to prevent concurrent storms)
      if (
        response.status === 401 &&
        !suppressAuthEvent &&
        !isAuthCredentialEndpoint &&
        typeof window !== "undefined"
      ) {
        const now = Date.now();
        if (now - lastSessionExpiredDispatchAt > 1000) {
          lastSessionExpiredDispatchAt = now;
          window.dispatchEvent(
            new CustomEvent("chessiq:session_expired", {
              detail: {
                status: 401,
                error: data?.error || "UNAUTHORIZED",
                endpoint,
              },
            }),
          );
        }
      }

      throw new ApiError(
        data?.error || `HTTP_${response.status}`,
        data?.message || `Request failed with status ${response.status}`,
        response.status,
        data,
      );
    }

    return data;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error.name === "AbortError") {
      throw new ApiError(
        "REQUEST_TIMEOUT",
        `Request timed out after ${timeoutMs}ms`,
        408,
      );
    }

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(
      "NETWORK_ERROR",
      error.message || "Network connection failed",
      0,
    );
  }
}

// REST Verb Conveniences
export const api = {
  get: (endpoint, options) =>
    apiClient(endpoint, { method: "GET", ...options }),
  post: (endpoint, body, options) =>
    apiClient(endpoint, {
      method: "POST",
      body: JSON.stringify(body),
      ...options,
    }),
  put: (endpoint, body, options) =>
    apiClient(endpoint, {
      method: "PUT",
      body: JSON.stringify(body),
      ...options,
    }),
  patch: (endpoint, body, options) =>
    apiClient(endpoint, {
      method: "PATCH",
      body: JSON.stringify(body),
      ...options,
    }),
  del: (endpoint, options) =>
    apiClient(endpoint, { method: "DELETE", ...options }),
};

export default api;
