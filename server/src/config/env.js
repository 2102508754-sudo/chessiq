/**
 * ChessIQ v3.3.0 — Enterprise Environment Configuration & Runtime Validator
 * Strict Zod schema validation ensuring all required secrets, database credentials,
 * and distributed Stockfish engine parameters are validated before server startup.
 */

const path = require("path");
const dotenv = require("dotenv");
const { z } = require("zod");

// Explicitly resolve and load server/.env
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const envSchema = z.object({
  PORT: z
    .string()
    .default("5000")
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val > 0 && val < 65536, {
      message: "PORT must be a valid port number between 1 and 65535",
    }),

  HOST: z
    .string()
    .default(
      process.env.HOST ||
        (process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1"),
    ),

  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  FRONTEND_URL: z
    .string()
    .url({ message: "FRONTEND_URL must be a valid HTTP/HTTPS URL" })
    .default("http://localhost:3000"),

  DATABASE_URL: z
    .string()
    .min(1, { message: "DATABASE_URL is required" })
    .refine(
      (val) => val.startsWith("postgres://") || val.startsWith("postgresql://"),
      {
        message:
          "DATABASE_URL must be a valid postgres:// or postgresql:// connection URI",
      },
    ),

  JWT_SECRET: z.string().min(64, {
    message:
      "JWT_SECRET must be at least 64 characters long to ensure cryptographic security",
  }),

  COOKIE_SECRET: z.string().min(64, {
    message:
      "COOKIE_SECRET must be at least 64 characters long to prevent cookie tampering",
  }),

  STOCKFISH_PATH: z
    .string()
    .min(1, {
      message:
        "STOCKFISH_PATH must specify the absolute path to the stockfish binary",
    })
    .default("/usr/games/stockfish"),

  STOCKFISH_THREADS: z
    .string()
    .default("1")
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val >= 1 && val <= 64, {
      message: "STOCKFISH_THREADS must be an integer between 1 and 64",
    }),

  STOCKFISH_HASH_MB: z
    .string()
    .default("64")
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val >= 16 && val <= 4096, {
      message: "STOCKFISH_HASH_MB must be an integer between 16 and 4096 MB",
    }),

  STOCKFISH_DEPTH: z
    .string()
    .default("14")
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val >= 10 && val <= 30, {
      message: "STOCKFISH_DEPTH must be an integer between 10 and 30 ply",
    }),

  STOCKFISH_SEARCH_TIMEOUT_MS: z
    .string()
    .default("8000")
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val >= 1000, {
      message: "STOCKFISH_SEARCH_TIMEOUT_MS must be at least 1000ms",
    }),

  STOCKFISH_KILL_GRACE_MS: z
    .string()
    .default("1500")
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val >= 500, {
      message: "STOCKFISH_KILL_GRACE_MS must be at least 500ms",
    }),

  MAX_CONCURRENT_JOBS: z
    .string()
    .default("1")
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val >= 1 && val <= 16, {
      message: "MAX_CONCURRENT_JOBS must be between 1 and 16",
    }),

  // Optional OAuth 2.0 Providers (Google & GitHub)
  OAUTH_CALLBACK_BASE_URL: z.string().url().optional(),
  OAUTH_GOOGLE_CLIENT_ID: z.string().optional(),
  OAUTH_GOOGLE_CLIENT_SECRET: z.string().optional(),
  OAUTH_GITHUB_CLIENT_ID: z.string().optional(),
  OAUTH_GITHUB_CLIENT_SECRET: z.string().optional(),
});

let env;
try {
  env = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error("FATAL: Environment configuration validation failed:");
    error.errors.forEach((err) => {
      console.error(`  - [${err.path.join(".")}] ${err.message}`);
    });
    process.exit(1);
  }
  throw error;
}

module.exports = env;
