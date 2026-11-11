#!/usr/bin/env bash
# ==============================================================================
# ChessIQ v3.3.0 — Day 15 Personalized Training Puzzle Generator Seal (@DB/@FE)
# Role: Abhijit Saha — Database Architect & System Ideation Lead (@DB)
# ==============================================================================

set -euo pipefail

CYAN='\033[0;36m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo -e "${CYAN}==============================================================================${NC}"
echo -e "${CYAN}   ChessIQ v3.3.0 — Day 15 Personalized Puzzle Generator Seal (@DB/@FE)      ${NC}"
echo -e "${CYAN}==============================================================================${NC}"

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Step 1: Check Environment Prerequisites & Run Migration Engine
echo -e "\n${YELLOW}[Step 1/5] Checking Environment & Executing Migration Engine...${NC}"
npm run migrate
echo -e "${GREEN}✓ Migration 006 applied and verified.${NC}"

# Step 2: Verify PostgreSQL Diagnostic Telemetry for Day 15
echo -e "\n${YELLOW}[Step 2/5] Verifying PostgreSQL fn_verify_day15_puzzles()...${NC}"
node -e "
const { pool, closePool } = require('./server/src/db/pool');

async function testDiag() {
  const res = await pool.query('SELECT fn_verify_day15_puzzles() AS diag;');
  const diag = res.rows[0].diag;
  if (diag.status !== 'PASSED') {
    throw new Error('Day 15 PostgreSQL diagnostic check failed: ' + JSON.stringify(diag));
  }
  console.log('✓ Puzzle generator diagnostic verified on PostgreSQL:', diag);
  await closePool();
}

testDiag().catch(err => {
  console.error(err);
  process.exit(1);
});
"
echo -e "${GREEN}✓ Day 15 database diagnostic passed.${NC}"

# Step 3: Validate 3NF View Integrity & Personalized Matching
echo -e "\n${YELLOW}[Step 3/5] Verifying v_training_puzzles View & Generator Service...${NC}"
node -e "
const { pool, closePool } = require('./server/src/db/pool');
const { getPuzzleCatalog, getPersonalizedPuzzles, getPuzzleThemes } = require('./server/src/db/puzzles');

async function testService() {
  // 1. Verify themes
  const themes = await getPuzzleThemes(pool);
  if (themes.length < 10) throw new Error('Theme catalog incomplete: ' + themes.length);
  console.log('✓ Tactical theme catalog verified (' + themes.length + ' themes)');

  // 2. Verify catalog query
  const catalog = await getPuzzleCatalog(pool, { minRating: 1000, maxRating: 2500, limit: 10 });
  if (catalog.length < 5) throw new Error('Catalog query returned insufficient puzzles');
  console.log('✓ v_training_puzzles view verified with JSONB themes (' + catalog.length + ' sample puzzles)');

  // 3. Verify personalized generator
  const userRes = await pool.query('SELECT id FROM users LIMIT 1;');
  const userId = userRes.rows[0]?.id || '00000000-0000-0000-0000-000000000001';
  const personalized = await getPersonalizedPuzzles(pool, userId, 3);
  if (!personalized || personalized.length === 0) throw new Error('Personalized generator failed to yield puzzles');
  console.log('✓ fn_generate_personalized_puzzles verified: generated ' + personalized.length + ' tailored puzzles');

  await closePool();
}

testService().catch(err => {
  console.error(err);
  process.exit(1);
});
"
echo -e "${GREEN}✓ Puzzle service layer and 3NF reconstruction view verified.${NC}"

# Step 4: Run Automated Jest Test Suite
echo -e "\n${YELLOW}[Step 4/5] Running Jest Day 15 Test Suite (server/tests/day15-puzzles.test.js)...${NC}"
npm run test --workspace=server -- tests/day15-puzzles.test.js
echo -e "${GREEN}✓ Day 15 test suite passed with 100% assertions.${NC}"

# Step 5: Finalize Day 15 Seal
echo -e "\n${YELLOW}[Step 5/5] Finalizing Day 15 Seal...${NC}"
echo -e "${GREEN}==============================================================================${NC}"
echo -e "${GREEN}   [DAY 15 PERSONALIZED TRAINING PUZZLE GENERATOR SEALED — ARCHITECTURE VALID] ${NC}"
echo -e "${GREEN}==============================================================================${NC}"
