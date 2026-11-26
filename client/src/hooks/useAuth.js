/**
 * ChessIQ v3.3.0 — Authentication Hook
 * Day 16 (@FE): Consumes AuthContext for session status, user metadata, login, register, and logout.
 */

import { useContext } from "react";
import { AuthContext, AUTH_STATUS } from "../context/AuthContext";

export { AUTH_STATUS };

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside an <AuthProvider>");
  }
  return ctx;
}
