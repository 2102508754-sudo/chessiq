/**
 * ChessIQ v3.3.0 — Day 16: JWT Authentication Middleware
 * Single-Domain First-Party Cookie Session Verification
 *
 * Reads the signed `chessiq_session` HttpOnly cookie, verifies the JWT,
 * and populates `req.user` with the decoded payload.
 *
 * Usage:
 *   authenticate          — Optional: populates req.user if cookie present, never throws
 *   authenticate.required — Required: throws 401 if no valid session
 */

const jwt = require("jsonwebtoken");
const env = require("../config/env");
const logger = require("../utils/logger");
const AppError = require("../utils/AppError");

/**
 * Optional authentication middleware.
 * Populates req.user = { id, username, email, chess_rating } if a valid
 * signed session cookie is present. Silently skips if absent or invalid.
 */
function authenticate(req, res, next) {
  const token = req.signedCookies?.chessiq_session;

  if (!token) {
    // If user was already attached upstream (e.g. test harness / auth gateway), preserve it
    if (!req.user) {
      req.user = null;
    }
    return next();
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    req.user = {
      id: decoded.id,
      username: decoded.username,
      email: decoded.email,
      chess_rating: decoded.chess_rating ?? null,
    };
    logger.debug(
      { userId: decoded.id, username: decoded.username },
      "Session authenticated",
    );
    return next();
  } catch (err) {
    // Token is present but invalid/expired — clear the stale cookie
    res.clearCookie("chessiq_session");
    if (err.name === "TokenExpiredError") {
      logger.warn({ err: err.message }, "Session cookie expired — cleared");
    } else {
      logger.warn({ err: err.message }, "Session cookie invalid — cleared");
    }
    req.user = null;
    return next();
  }
}

/**
 * Required authentication middleware.
 * Throws 401 UNAUTHORIZED if no valid session cookie is present.
 */
authenticate.required = function requireAuth(req, res, next) {
  if (req.user) {
    return next();
  }

  const token = req.signedCookies?.chessiq_session;

  if (!token) {
    return next(
      AppError.unauthorized(
        "Authentication required. No valid session cookie found.",
      ),
    );
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    req.user = {
      id: decoded.id,
      username: decoded.username,
      email: decoded.email,
      chess_rating: decoded.chess_rating ?? null,
    };
    logger.debug(
      { userId: decoded.id, username: decoded.username },
      "Session authenticated (required)",
    );
    return next();
  } catch (err) {
    res.clearCookie("chessiq_session");
    if (err.name === "TokenExpiredError") {
      return next(
        AppError.unauthorized("Session expired. Please log in again."),
      );
    }
    return next(
      AppError.unauthorized("Invalid session token. Please log in again."),
    );
  }
};

module.exports = authenticate;
