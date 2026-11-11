/**
 * ChessIQ v3.3.0 — Transactional SHA-256 Checksum Verified Migration Engine
 * Reads migrations in lexical order from db/migrations/*.sql, asserts checksum consistency,
 * tracks execution time, and verifies the 6NF baseline diagnostic function.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { pool, closePool } = require("./pool");
const logger = require("../utils/logger");

const MIGRATIONS_DIR = path.resolve(__dirname, "../../../db/migrations");

/**
 * Calculates SHA-256 hex digest for file content
 * @param {string} content
 * @returns {string}
 */
function computeChecksum(content) {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

/**
 * Run migrations sequentially
 */
async function runMigrations() {
  const startTime = Date.now();
  logger.info(
    { dir: MIGRATIONS_DIR },
    "Starting ChessIQ database migration run...",
  );

  if (!fs.existsSync(MIGRATIONS_DIR)) {
    throw new Error(`Migrations directory does not exist: ${MIGRATIONS_DIR}`);
  }

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    logger.warn("No SQL migration files discovered.");
    return;
  }

  // Ensure schema_migrations table exists prior to reading audit records
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(100) PRIMARY KEY,
      checksum VARCHAR(64) NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      execution_ms INT NOT NULL
    );
  `);

  // Fetch already applied migrations
  const { rows: appliedRows } = await pool.query(
    "SELECT version, checksum, applied_at, execution_ms FROM schema_migrations ORDER BY version ASC;",
  );
  const appliedMap = new Map(appliedRows.map((r) => [r.version, r]));

  logger.info(
    { total_files: files.length, applied_count: appliedMap.size },
    "Scanning migrations",
  );

  let newlyApplied = 0;

  for (const file of files) {
    const filePath = path.join(MIGRATIONS_DIR, file);
    const content = fs.readFileSync(filePath, "utf8");
    const checksum = computeChecksum(content);
    const existing = appliedMap.get(file);

    if (existing) {
      if (existing.checksum !== checksum) {
        logger.error(
          {
            migration: file,
            expected_checksum: existing.checksum,
            actual_checksum: checksum,
          },
          "FATAL: Migration file checksum mismatch! Migration has been tampered with or modified.",
        );
        throw new Error(
          `Tampered migration detected: ${file}. Existing checksum ${existing.checksum} !== ${checksum}`,
        );
      }
      logger.debug(
        { migration: file },
        "Migration already applied and verified with checksum match",
      );
      continue;
    }

    // Apply new migration in an isolated transaction
    logger.info({ migration: file }, "Applying migration...");
    const client = await pool.connect();
    const migrationStart = Date.now();

    try {
      await client.query("BEGIN");
      await client.query(content);

      const executionMs = Date.now() - migrationStart;
      await client.query(
        `INSERT INTO schema_migrations (version, checksum, applied_at, execution_ms)
         VALUES ($1, $2, CURRENT_TIMESTAMP, $3);`,
        [file, checksum, executionMs],
      );

      await client.query("COMMIT");
      newlyApplied++;
      logger.info(
        {
          migration: file,
          execution_ms: executionMs,
          checksum: checksum.slice(0, 12) + "...",
        },
        "Migration applied successfully",
      );
    } catch (err) {
      await client.query("ROLLBACK");
      logger.error(
        { migration: file, error: err.message },
        "Migration transaction rolled back due to error",
      );
      throw err;
    } finally {
      client.release();
    }
  }

  // Execute 6NF baseline verification function if available
  try {
    const { rows: verifyRows } = await pool.query(
      "SELECT fn_verify_6nf_baseline() AS diagnostic;",
    );
    const diagnostic = verifyRows[0]?.diagnostic;
    logger.info(
      { diagnostic },
      "PostgreSQL 6NF baseline diagnostic verified successfully",
    );
  } catch (err) {
    logger.warn(
      { error: err.message },
      "Note: fn_verify_6nf_baseline() could not be evaluated yet",
    );
  }

  // Execute 6NF schema & 3NF views verification function if available (Day 2+)
  try {
    const { rows: schemaRows } = await pool.query(
      "SELECT fn_verify_6nf_schema() AS diagnostic;",
    );
    const schemaDiagnostic = schemaRows[0]?.diagnostic;
    logger.info(
      { schemaDiagnostic },
      "PostgreSQL 6NF Master Schema & 3NF Reconstruction Views verified",
    );
  } catch (err) {
    logger.debug(
      { error: err.message },
      "Note: fn_verify_6nf_schema() not yet available or not applied",
    );
  }

  // Execute Day 3 High-Performance Ingestion & GiST verification if available (Day 3+)
  try {
    const { rows: day3Rows } = await pool.query(
      "SELECT fn_verify_day3_ingestion() AS diagnostic;",
    );
    const day3Diagnostic = day3Rows[0]?.diagnostic;
    logger.info(
      { day3Diagnostic },
      "PostgreSQL Day 3 Batch Ingestion Procedure & GiST constraints verified",
    );
  } catch (err) {
    logger.debug(
      { error: err.message },
      "Note: fn_verify_day3_ingestion() not yet available or not applied",
    );
  }

  // Execute Day 15 Personalized Puzzles verification if available (Day 15+)
  try {
    const { rows: day15Rows } = await pool.query(
      "SELECT fn_verify_day15_puzzles() AS diagnostic;",
    );
    const day15Diagnostic = day15Rows[0]?.diagnostic;
    logger.info(
      { day15Diagnostic },
      "PostgreSQL Day 15 Curated Puzzles & Generator verified",
    );
  } catch (err) {
    logger.debug(
      { error: err.message },
      "Note: fn_verify_day15_puzzles() not yet available or not applied",
    );
  }

  const totalTime = Date.now() - startTime;
  logger.info(
    {
      newly_applied: newlyApplied,
      total_applied: appliedMap.size + newlyApplied,
      total_duration_ms: totalTime,
    },
    "Database migrations completed successfully",
  );
}

if (require.main === module) {
  runMigrations()
    .then(async () => {
      await closePool();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error("Migration failed:", err);
      try {
        await closePool();
      } catch (_) {}
      process.exit(1);
    });
}

module.exports = { runMigrations, computeChecksum };
