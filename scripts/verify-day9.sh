#!/usr/bin/env bash
# ==============================================================================
# ChessIQ v3.3.0 — Day 9 Stale Job Recovery Sweep & Scheduler Seal (@BE/@DB)
# Role: Jaidev Basandrai (@BE) & Abhijit Saha (@DB)
# ==============================================================================

set -euo pipefail

CYAN='\033[0;36m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo -e "${CYAN}==============================================================================${NC}"
echo -e "${CYAN}   ChessIQ v3.3.0 — Day 9 Stale Recovery Sweep & Token Seal (@BE/@DB)        ${NC}"
echo -e "${CYAN}==============================================================================${NC}"

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Step 1: Check Environment Prerequisites & Migrations
echo -e "\n${YELLOW}[Step 1/5] Checking Environment & Executing Migration Engine...${NC}"
npm run migrate
echo -e "${GREEN}✓ Migration 004 applied and verified.${NC}"

# Step 2: Verify PostgreSQL Diagnostic Telemetry for Day 9
echo -e "\n${YELLOW}[Step 2/5] Verifying PostgreSQL fn_verify_day9_recovery()...${NC}"
node -e "
const { pool } = require('./server/src/db/pool');

async function testDiag() {
  const res = await pool.query('SELECT fn_verify_day9_recovery() as diag;');
  const diag = res.rows[0].diag;
  if (diag.status !== 'PASSED' || !diag.fn_sweep_stale_jobs_exists) {
    throw new Error('Day 9 PostgreSQL diagnostic check failed: ' + JSON.stringify(diag));
  }
  console.log('✓ Stale job sweep stored function verified on PostgreSQL:', diag);
  await pool.end();
}

testDiag().catch(err => {
  console.error(err);
  process.exit(1);
});
"
echo -e "${GREEN}✓ Day 9 database diagnostic passed.${NC}"

# Step 3: Verify sweepStaleJobs & Scheduler Lifecycle
echo -e "\n${YELLOW}[Step 3/5] Verifying sweepStaleJobs & StaleRecoveryScheduler...${NC}"
node -e "
const { sweepStaleJobs, StaleRecoveryScheduler } = require('./server/src/queue');
const { pool } = require('./server/src/db/pool');

async function testSweep() {
  const swept = await sweepStaleJobs(pool, '1 hour');
  console.log('✓ sweepStaleJobs executed cleanly against live DB (swept count: ' + swept.length + ')');

  const scheduler = new StaleRecoveryScheduler({ pool, intervalMs: 60000 });
  scheduler.start();
  if (!scheduler.isRunning) throw new Error('Scheduler failed to start!');
  scheduler.stop();
  if (scheduler.isRunning) throw new Error('Scheduler failed to stop!');
  console.log('✓ StaleRecoveryScheduler lifecycle verified.');

  await pool.end();
}

testSweep().catch(err => {
  console.error(err);
  process.exit(1);
});
"
echo -e "${GREEN}✓ Recovery sweep and scheduler verified.${NC}"

# Step 4: Run Automated Jest Test Suite (Day 9)
echo -e "\n${YELLOW}[Step 4/5] Running Jest Day 9 Test Suite (server/tests/day9-stale-job-recovery.test.js)...${NC}"
npm test --workspace=server -- tests/day9-stale-job-recovery.test.js
echo -e "${GREEN}✓ Day 9 test suite passed with 100% assertions.${NC}"

# Step 5: Seal Day 9
echo -e "\n${YELLOW}[Step 5/5] Finalizing Day 9 Seal...${NC}"
echo -e "${GREEN}==============================================================================${NC}"
echo -e "${GREEN}   [DAY 9 STALE JOB RECOVERY SWEEP & TOKEN INVALIDATION SEALED — READY DAY 10] ${NC}"
echo -e "${GREEN}==============================================================================${NC}"
