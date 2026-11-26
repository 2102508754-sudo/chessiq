/**
 * ChessIQ v3.3.0 — Single-Domain Authentication State Provider
 * Day 16 (@FE): Manages cookie-backed session state without reading HttpOnly cookies
 * or storing credentials in localStorage/sessionStorage.
 * Handles concurrent 401 expiration events safely and preserves intended navigation destination.
 */

import React, {
  createContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { ApiError } from "../api/client";
import {
  fetchCurrentUser,
  loginUser,
  registerUser,
  logoutUser,
} from "../api/auth";
import { AUTH_STATUS } from "./authConstants";

export { AUTH_STATUS };

export const AuthContext = createContext(null);

export function AuthProvider({ children, onSessionExpired, onLogoutComplete }) {
  const [status, setStatus] = useState(AUTH_STATUS.LOADING);
  const [user, setUser] = useState(null);
  const [authError, setAuthError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [backendAuthUnavailable, setBackendAuthUnavailable] = useState(false);
  const [intendedDestination, setIntendedDestination] = useState(null);

  // Prevents simultaneous 401 session-expiration handler executions
  const sessionExpiryHandledRef = useRef(false);
  const statusRef = useRef(status);
  statusRef.current = status;

  const restoreSession = useCallback(async (signal) => {
    setStatus(AUTH_STATUS.LOADING);
    setAuthError(null);
    setBackendAuthUnavailable(false);

    try {
      const currentUser = await fetchCurrentUser(signal);
      if (signal?.aborted) return null;

      if (currentUser) {
        setUser(currentUser);
        setStatus(AUTH_STATUS.AUTHENTICATED);
        sessionExpiryHandledRef.current = false;
        return currentUser;
      }

      setUser(null);
      setStatus(AUTH_STATUS.UNAUTHENTICATED);
      return null;
    } catch (err) {
      if (signal?.aborted || err?.code === "REQUEST_TIMEOUT") {
        // On abort during unmount or StrictMode remount, avoid clobbering state
        if (err?.name === "AbortError") return null;
      }

      setUser(null);

      if (err instanceof ApiError) {
        if (err.status === 401) {
          // Normal unauthenticated state
          setStatus(AUTH_STATUS.UNAUTHENTICATED);
          return null;
        }
        if (err.status === 404) {
          setBackendAuthUnavailable(true);
          setStatus(AUTH_STATUS.UNAUTHENTICATED);
          return null;
        }
        setAuthError(err.message);
      } else {
        setAuthError(err?.message || "Unable to verify session status");
      }

      setStatus(AUTH_STATUS.UNAUTHENTICATED);
      return null;
    }
  }, []);

  // Probe active session via first-party cookie on initial mount
  useEffect(() => {
    const controller = new AbortController();
    restoreSession(controller.signal);
    return () => {
      controller.abort();
    };
  }, [restoreSession]);

  // Listen for 401 expiration events emitted by apiClient
  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleSessionExpired = () => {
      // Only trigger expiry transition once if the user previously had an authenticated session
      // or avoid infinite loops while already UNAUTHENTICATED/EXPIRED
      if (sessionExpiryHandledRef.current) return;
      sessionExpiryHandledRef.current = true;

      const wasAuthenticated = statusRef.current === AUTH_STATUS.AUTHENTICATED;
      setUser(null);
      setStatus(
        wasAuthenticated ? AUTH_STATUS.EXPIRED : AUTH_STATUS.UNAUTHENTICATED,
      );
      if (wasAuthenticated) {
        setAuthError(
          "Your session has expired. Please sign in again to continue.",
        );
      }

      if (onSessionExpired) {
        onSessionExpired();
      }
    };

    window.addEventListener("chessiq:session_expired", handleSessionExpired);
    return () => {
      window.removeEventListener(
        "chessiq:session_expired",
        handleSessionExpired,
      );
    };
  }, [onSessionExpired]);

  const login = useCallback(async (credentials) => {
    setIsSubmitting(true);
    setAuthError(null);
    setBackendAuthUnavailable(false);

    try {
      const { user: loggedInUser } = await loginUser(credentials);

      // Authoritatively retrieve current user profile if login returned minimal response
      let verifiedUser = loggedInUser;
      if (!verifiedUser) {
        verifiedUser = await fetchCurrentUser();
      }

      if (!verifiedUser) {
        throw new Error(
          "Login succeeded but no authenticated user profile was returned.",
        );
      }

      sessionExpiryHandledRef.current = false;
      setUser(verifiedUser);
      setStatus(AUTH_STATUS.AUTHENTICATED);
      return { ok: true, user: verifiedUser };
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setBackendAuthUnavailable(true);
        const msg =
          "Authentication endpoint (/api/auth/login) is not yet available on the backend (pending Day 16 backend deployment).";
        setAuthError(msg);
        return { ok: false, error: msg, status: 404 };
      }

      const msg =
        err?.message ||
        "Invalid credentials or unable to reach authentication server.";
      setAuthError(msg);
      return { ok: false, error: msg, status: err?.status || 0 };
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const register = useCallback(async (registration) => {
    setIsSubmitting(true);
    setAuthError(null);
    setBackendAuthUnavailable(false);

    try {
      const { user: registeredUser } = await registerUser(registration);
      let verifiedUser = registeredUser;
      if (!verifiedUser) {
        verifiedUser = await fetchCurrentUser();
      }

      if (!verifiedUser) {
        throw new Error(
          "Registration succeeded but failed to load authenticated profile.",
        );
      }

      sessionExpiryHandledRef.current = false;
      setUser(verifiedUser);
      setStatus(AUTH_STATUS.AUTHENTICATED);
      return { ok: true, user: verifiedUser };
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setBackendAuthUnavailable(true);
        const msg =
          "Registration endpoint (/api/auth/register) is not yet available on the backend (pending Day 16 backend deployment).";
        setAuthError(msg);
        return { ok: false, error: msg, status: 404 };
      }

      const msg = err?.message || "Registration failed.";
      setAuthError(msg);
      return { ok: false, error: msg, status: err?.status || 0 };
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsSubmitting(true);
    setAuthError(null);
    try {
      await logoutUser();
    } catch (err) {
      // Even if cookie was already invalid/missing on server, clear local React state
      if (!(
        err instanceof ApiError &&
        (err.status === 401 || err.status === 404)
      )) {
        setAuthError(err?.message || "Logout encountered a network error");
      }
    } finally {
      sessionExpiryHandledRef.current = false;
      setUser(null);
      setStatus(AUTH_STATUS.UNAUTHENTICATED);
      setIntendedDestination(null);
      setIsSubmitting(false);
      if (onLogoutComplete) {
        onLogoutComplete();
      }
    }
  }, [onLogoutComplete]);

  const clearAuthError = useCallback(() => {
    setAuthError(null);
  }, []);

  const value = useMemo(
    () => ({
      status,
      user,
      isAuthenticated: status === AUTH_STATUS.AUTHENTICATED && Boolean(user),
      isLoading: status === AUTH_STATUS.LOADING,
      isExpired: status === AUTH_STATUS.EXPIRED,
      isSubmitting,
      authError,
      backendAuthUnavailable,
      intendedDestination,
      setIntendedDestination,
      login,
      register,
      logout,
      refreshSession: () => restoreSession(),
      clearAuthError,
    }),
    [
      status,
      user,
      isSubmitting,
      authError,
      backendAuthUnavailable,
      intendedDestination,
      login,
      register,
      logout,
      restoreSession,
      clearAuthError,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

