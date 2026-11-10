/**
 * ChessIQ v3.3.0 — Express Security Gateway & API Application
 * Configures Helmet, strict CORS, cookieParser, Pino HTTP logging, rate limiting,
 * live telemetry health route, and centralized AppError exception handling.
 */

const crypto = require("crypto");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const pinoHttp = require("pino-http");

const env = require("./config/env");
const logger = require("./utils/logger");
const AppError = require("./utils/AppError");
const { pool, query } = require("./db/pool");

const app = express();

// 1. Correlation ID & Request Context Middleware
app.use((req, res, next) => {
  const requestId = req.headers["x-request-id"] || crypto.randomUUID();
  req.id = requestId;
  res.setHeader("X-Request-Id", requestId);
  next();
});

// 2. Structured HTTP Request Telemetry
app.use(
  pinoHttp({
    logger,
    genReqId: (req) => req.id,
    customLogLevel: (req, res, err) => {
      if (res.statusCode >= 500 || err) return "error";
      if (res.statusCode >= 400) return "warn";
      return "info";
    },
    serializers: {
      req: (req) => ({
        id: req.id,
        method: req.method,
        url: req.url,
      }),
      res: (res) => ({
        statusCode: res.statusCode,
      }),
    },
  }),
);

// 3. Security Headers via Helmet
app.use(
  helmet({
    contentSecurityPolicy: false, // Managed by Frontend Reverse Proxy / Edge
    crossOriginEmbedderPolicy: false,
  }),
);

// 4. Strict CORS Policy
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id", "Accept"],
    exposedHeaders: ["X-Request-Id"],
  }),
);

// 5. Signed Cookie Parser
app.use(cookieParser(env.COOKIE_SECRET));

// 6. Body Parsers
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// 7. General API Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Limit each IP to 500 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "TOO_MANY_REQUESTS",
    message: "Too many requests from this client. Please slow down.",
  },
});
app.use("/api", apiLimiter);

// 8. Health & System Telemetry Endpoint
app.get("/api/health", async (req, res, next) => {
  const start = Date.now();
  try {
    // Check database connectivity and engine version
    const dbRes = await query(`
      SELECT 
        version() AS engine_version,
        current_database() AS db_name,
        current_setting('server_version_num')::INT AS version_num;
    `);

    // Verify required 6NF extensions
    const extRes = await query(`
      SELECT extname FROM pg_extension WHERE extname IN ('uuid-ossp', 'btree_gist');
    `);
    const installedExts = extRes.rows.map((r) => r.extname);
    const hasUuidOssp = installedExts.includes("uuid-ossp");
    const hasBtreeGist = installedExts.includes("btree_gist");

    let schemaDiag = null;
    try {
      const diagRes = await query("SELECT fn_verify_6nf_schema() AS diag;");
      schemaDiag = diagRes.rows[0]?.diag;
    } catch (_) {
      // Schema may not be migrated yet in early stages
    }

    let day3Diag = null;
    try {
      const day3Res = await query("SELECT fn_verify_day3_ingestion() AS diag;");
      day3Diag = day3Res.rows[0]?.diag;
    } catch (_) {
      // Day 3 migration may not be applied yet
    }

    const isHealthy = hasUuidOssp && hasBtreeGist;
    const statusCode = isHealthy ? 200 : 503;

    const isProduction = env.NODE_ENV === "production";

    const healthPayload = {
      status: isHealthy ? "healthy" : "unhealthy",
      version: "3.3.0",
      timestamp: new Date().toISOString(),
      uptime_seconds: Math.floor(process.uptime()),
      latency_ms: Date.now() - start,
      environment: env.NODE_ENV,
      database: {
        status: "connected",
        engine_version: dbRes.rows[0]?.engine_version,
        database_name: dbRes.rows[0]?.db_name,
        version_num: dbRes.rows[0]?.version_num,
        extensions: {
          uuid_ossp: hasUuidOssp,
          btree_gist: hasBtreeGist,
        },
        schema_6nf: schemaDiag,
        day3_ingestion: day3Diag,
        pool: {
          total: pool.totalCount,
          idle: pool.idleCount,
          waiting: pool.waitingCount,
        },
      },
      cookie_topology: {
        mode: isProduction
          ? "single_domain_first_party"
          : "local_dev_partitioned",
        same_site: isProduction ? "Lax" : "None",
        secure: true,
        http_only: true,
      },
    };

    return res.status(statusCode).json(healthPayload);
  } catch (err) {
    logger.error({ err }, "Health check database diagnostic failed");
    return res.status(503).json({
      status: "unhealthy",
      version: "3.3.0",
      timestamp: new Date().toISOString(),
      error: "DATABASE_DISCONNECTED",
      message: err.message,
    });
  }
});

// 9. Core Domain API Routes
const gamesRouter = require("./routes/games");
app.use("/api/games", gamesRouter);

// Day 12 & 14 API Route Aliases per System Design §8.1
app.use("/api/jobs", (req, res, next) => {
  req.url = "/jobs" + req.url;
  gamesRouter(req, res, next);
});
app.use("/api/analytics", (req, res, next) => {
  req.url = "/analytics" + req.url;
  gamesRouter(req, res, next);
});

// 10. 404 Route Fallback
app.use((req, res, next) => {
  next(AppError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
});

// 11. Centralized Operational & Exception Error Handler
app.use((err, req, res, next) => {
  // If headers already sent, delegate to Express default handler
  if (res.headersSent) {
    return next(err);
  }

  // Handle known operational AppError
  if (err instanceof AppError) {
    logger.warn(
      {
        requestId: req.id,
        code: err.code,
        statusCode: err.statusCode,
        message: err.message,
        details: err.details,
      },
      "Operational error handled",
    );
    return res.status(err.statusCode).json(err.toJSON());
  }

  // Handle uncaught or unknown runtime exceptions
  logger.error(
    {
      requestId: req.id,
      name: err.name,
      message: err.message,
      stack: err.stack,
    },
    "Uncaught internal server exception",
  );

  const isProduction = env.NODE_ENV === "production";
  return res.status(500).json({
    error: "INTERNAL_SERVER_ERROR",
    message: isProduction
      ? "An unexpected internal server error occurred."
      : err.message,
    ...(isProduction ? {} : { stack: err.stack }),
  });
});

module.exports = app;
