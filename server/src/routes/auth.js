/**
 * ChessIQ v3.3.0 — Day 16: Authentication API Routes
 * Single-Domain First-Party Cookie Session Management
 *
 * POST   /api/auth/register  — Create account + set chessiq_session cookie
 * POST   /api/auth/login     — Verify credentials + set chessiq_session cookie
 * GET    /api/auth/me        — Return current authenticated user
 * POST   /api/auth/logout    — Clear chessiq_session cookie
 */

const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const env = require("../config/env");
const logger = require("../utils/logger");
const AppError = require("../utils/AppError");
const { query, withTransaction } = require("../db/pool");
const authenticate = require("../middleware/authenticate");

const router = express.Router();

// ---------------------------------------------------------------------------
// Cookie configuration helper
// ---------------------------------------------------------------------------

/**
 * Returns cookie options consistent with the single-domain topology declared
 * in app.js and the health endpoint's `cookie_topology` field.
 */
function cookieOptions() {
  const isProduction = env.NODE_ENV === "production";
  return {
    httpOnly: true,
    signed: true,
    sameSite: isProduction ? "Lax" : "None",
    secure: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  };
}

/**
 * Signs a JWT for the given user payload.
 * @param {{ id: string, username: string, email: string, chess_rating: number|null }} user
 * @returns {string} Signed JWT
 */
function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      email: user.email,
      chess_rating: user.chess_rating ?? null,
    },
    env.JWT_SECRET,
    { expiresIn: "7d" },
  );
}

// ---------------------------------------------------------------------------
// Input validation helpers
// ---------------------------------------------------------------------------

function validateUsername(username) {
  if (!username || typeof username !== "string") return "Username is required.";
  const trimmed = username.trim();
  if (trimmed.length < 3 || trimmed.length > 30)
    return "Username must be between 3 and 30 characters.";
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed))
    return "Username may only contain letters, numbers, underscores, and hyphens.";
  return null;
}

function validateEmail(email) {
  if (!email || typeof email !== "string") return "Email is required.";
  // RFC 5321-approximate check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
    return "A valid email address is required.";
  return null;
}

function validatePassword(password) {
  if (!password || typeof password !== "string") return "Password is required.";
  if (password.length < 8)
    return "Password must be at least 8 characters long.";
  return null;
}

// ---------------------------------------------------------------------------
// POST /api/auth/register
// ---------------------------------------------------------------------------

router.post("/register", async (req, res, next) => {
  try {
    const { username, email, password, chess_rating } = req.body;

    // --- Input validation ---
    const usernameErr = validateUsername(username);
    if (usernameErr) throw AppError.validationError(usernameErr, { field: "username" });

    const emailErr = validateEmail(email);
    if (emailErr) throw AppError.validationError(emailErr, { field: "email" });

    const passwordErr = validatePassword(password);
    if (passwordErr) throw AppError.validationError(passwordErr, { field: "password" });

    const normalizedUsername = username.trim();
    const normalizedEmail = email.trim().toLowerCase();

    const ratingValue =
      chess_rating != null && !isNaN(Number(chess_rating))
        ? Math.max(100, Math.min(3000, Number(chess_rating)))
        : 1200;

    // --- Uniqueness checks ---
    const [existingUsername, existingEmail] = await Promise.all([
      query("SELECT user_id FROM user_usernames WHERE username = $1", [
        normalizedUsername,
      ]),
      query("SELECT user_id FROM user_emails WHERE email = $1", [
        normalizedEmail,
      ]),
    ]);

    if (existingUsername.rows.length > 0) {
      throw new AppError(
        "USERNAME_TAKEN",
        "That username is already in use. Please choose a different username.",
        409,
      );
    }
    if (existingEmail.rows.length > 0) {
      throw new AppError(
        "EMAIL_TAKEN",
        "An account with that email address already exists.",
        409,
      );
    }

    // --- Hash password ---
    const passwordHash = await bcrypt.hash(password, 12);

    // --- Insert into 6NF tables in a single transaction ---
    let newUser;
    await withTransaction(async (client) => {
      // 1. Create user anchor
      const userRes = await client.query(
        "INSERT INTO users DEFAULT VALUES RETURNING id",
      );
      const userId = userRes.rows[0].id;

      // 2. Set username
      await client.query(
        "INSERT INTO user_usernames (user_id, username) VALUES ($1, $2)",
        [userId, normalizedUsername],
      );

      // 3. Set email
      await client.query(
        "INSERT INTO user_emails (user_id, email) VALUES ($1, $2)",
        [userId, normalizedEmail],
      );

      // 4. Set password hash
      await client.query(
        "INSERT INTO user_password_hashes (user_id, password_hash) VALUES ($1, $2)",
        [userId, passwordHash],
      );

      // 5. Set initial rating with open-ended temporal range
      await client.query(
        `INSERT INTO user_ratings (user_id, chess_rating, valid_during)
         VALUES ($1, $2, tstzrange(NOW(), NULL, '[)'))`,
        [userId, ratingValue],
      );

      // 6. Set creation and update timestamps
      await client.query(
        "INSERT INTO user_created_at (user_id) VALUES ($1)",
        [userId],
      );
      await client.query(
        "INSERT INTO user_updated_at (user_id) VALUES ($1)",
        [userId],
      );

      newUser = {
        id: userId,
        username: normalizedUsername,
        email: normalizedEmail,
        chess_rating: ratingValue,
      };
    });

    // --- Issue JWT session cookie ---
    const token = signToken(newUser);
    res.cookie("chessiq_session", token, cookieOptions());

    logger.info(
      { userId: newUser.id, username: newUser.username },
      "New user registered",
    );

    return res.status(201).json({
      status: "success",
      data: { user: newUser },
    });
  } catch (err) {
    return next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------

router.post("/login", async (req, res, next) => {
  try {
    const { username, email, password } = req.body;

    if (!password || typeof password !== "string") {
      throw AppError.validationError("Password is required.", {
        field: "password",
      });
    }

    if (!username && !email) {
      throw AppError.validationError(
        "Either username or email is required.",
        { field: "username" },
      );
    }

    // --- Look up user by email or username ---
    let userIdRow;
    if (email || (username && username.includes("@"))) {
      const lookupEmail = (email || username).trim().toLowerCase();
      const res2 = await query(
        "SELECT user_id FROM user_emails WHERE email = $1",
        [lookupEmail],
      );
      userIdRow = res2.rows[0];
    } else {
      const res2 = await query(
        "SELECT user_id FROM user_usernames WHERE username = $1",
        [username.trim()],
      );
      userIdRow = res2.rows[0];
    }

    // --- Constant-time guard: always bcrypt.compare even on miss ---
    const DUMMY_HASH =
      "$2b$12$invalidhashfortimingnormalizationxxxxxxxxxxxxxxxxxxxxxxx";

    if (!userIdRow) {
      await bcrypt.compare(password, DUMMY_HASH);
      throw new AppError(
        "INVALID_CREDENTIALS",
        "Invalid username/email or password.",
        401,
      );
    }

    const userId = userIdRow.user_id;

    // --- Fetch password hash ---
    const hashRes = await query(
      "SELECT password_hash FROM user_password_hashes WHERE user_id = $1",
      [userId],
    );

    if (!hashRes.rows[0]) {
      await bcrypt.compare(password, DUMMY_HASH);
      throw new AppError(
        "INVALID_CREDENTIALS",
        "Invalid username/email or password.",
        401,
      );
    }

    const isValid = await bcrypt.compare(password, hashRes.rows[0].password_hash);
    if (!isValid) {
      throw new AppError(
        "INVALID_CREDENTIALS",
        "Invalid username/email or password.",
        401,
      );
    }

    // --- Fetch full user profile from 3NF view ---
    const profileRes = await query("SELECT * FROM v_users WHERE id = $1", [
      userId,
    ]);
    const profile = profileRes.rows[0];

    const user = {
      id: profile.id,
      username: profile.username,
      email: profile.email,
      chess_rating: profile.chess_rating ?? null,
    };

    // --- Issue JWT session cookie ---
    const token = signToken(user);
    res.cookie("chessiq_session", token, cookieOptions());

    logger.info({ userId: user.id, username: user.username }, "User logged in");

    return res.status(200).json({
      status: "success",
      data: { user },
    });
  } catch (err) {
    return next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/auth/me
// ---------------------------------------------------------------------------

router.get("/me", authenticate, async (req, res, next) => {
  try {
    if (!req.user) {
      throw AppError.unauthorized(
        "Not authenticated. Please log in to continue.",
      );
    }

    // Refresh profile from DB (rating may have changed since token was issued)
    const profileRes = await query("SELECT * FROM v_users WHERE id = $1", [
      req.user.id,
    ]);

    if (!profileRes.rows[0]) {
      // User deleted after token was issued
      res.clearCookie("chessiq_session");
      throw AppError.unauthorized("User account not found. Please log in again.");
    }

    const profile = profileRes.rows[0];
    const user = {
      id: profile.id,
      username: profile.username,
      email: profile.email,
      chess_rating: profile.chess_rating ?? null,
    };

    return res.status(200).json({
      status: "success",
      data: { user },
    });
  } catch (err) {
    return next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/logout
// ---------------------------------------------------------------------------

router.post("/logout", (req, res) => {
  res.clearCookie("chessiq_session");
  logger.info(
    { userId: req.signedCookies?.chessiq_session ? "unknown" : "none" },
    "User logged out",
  );
  return res.status(200).json({
    status: "success",
    message: "Logged out successfully.",
  });
});

module.exports = router;
