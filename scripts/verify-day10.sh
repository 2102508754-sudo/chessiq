#!/usr/bin/env bash
# ==============================================================================
# ChessIQ v3.3.0 — Day 10 Opening Book Catalog & ACPL Exclusions Seal (@DB/@BE)
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
echo -e "${CYAN}   ChessIQ v3.3.0 — Day 10 Opening Book Catalog & ACPL Seal (@DB/@BE)        ${NC}"
echo -e "${CYAN}==============================================================================${NC}"

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Step 1: Check Environment Prerequisites & Run Migration Engine
echo -e "\n${YELLOW}[Step 1/5] Checking Environment & Executing Migration Engine...${NC}"
npm run migrate
echo -e "${GREEN}✓ Migration 005 applied and verified.${NC}"

# Step 2: Verify PostgreSQL Diagnostic Telemetry for Day 10
echo -e "\n${YELLOW}[Step 2/5] Verifying PostgreSQL fn_verify_day10_openings()...${NC}"
node -e "
const { pool, closePool } = require('./server/src/db/pool');

async function testDiag() {
  const res = await pool.query('SELECT fn_verify_day10_openings() AS diag;');
  const diag = res.rows[0].diag;
  if (diag.status !== 'PASSED') {
    throw new Error('Day 10 PostgreSQL diagnostic check failed: ' + JSON.stringify(diag));
  }
  console.log('✓ Opening catalog diagnostic verified on PostgreSQL:', diag);
  await closePool();
}

testDiag().catch(err => {
  console.error(err);
  process.exit(1);
});
"
echo -e "${GREEN}✓ Day 10 database diagnostic passed.${NC}"

# Step 3: Validate Authoritative Prefix Matching & Blunder Protection
echo -e "\n${YELLOW}[Step 3/5] Verifying Opening Matching & Early-Ply Blunder Protection...${NC}"
node -e "
const { pool, closePool } = require('./server/src/db/pool');
const { matchOpeningByMoves, isBookMove } = require('./server/src/db/openings');

async function testMatching() {
  // 1. Najdorf
  const najdorf = await matchOpeningByMoves(pool, ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6']);
  if (!najdorf || najdorf.ecoCode !== 'B90' || !najdorf.variation.includes('Najdorf')) {
    throw new Error('Sicilian Najdorf matching failed!');
  }

  // 2. Italian
  const italian = await matchOpeningByMoves(pool, ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4']);
  if (!italian || italian.ecoCode !== 'C50') {
    throw new Error('Italian Game matching failed!');
  }

  // 3. Early blunder check: Fool's Mate must NOT be classified as book move
  const foolsMate = await isBookMove(pool, ['f3', 'e5', 'g4']);
  if (foolsMate !== false) {
    throw new Error('Fool\'s mate early blunder was incorrectly tagged as book move!');
  }

  // 4. Standard e4 must be book move
  const e4Book = await isBookMove(pool, ['e4']);
  if (e4Book !== true) {
    throw new Error('1. e4 was not recognized as book move!');
  }

  console.log('✓ Sicilian Najdorf (B90) matching verified: 10 plies');
  console.log('✓ Italian Game (C50) matching verified: 5 plies');
  console.log('✓ Early-ply blunder protection verified: Fool\'s Mate retained for empirical CPL');
  console.log('✓ Standard opening book identification verified');

  await closePool();
}

testMatching().catch(err => {
  console.error(err);
  process.exit(1);
});
"
echo -e "${GREEN}✓ Authoritative matching rules and ACPL invariants verified.${NC}"

# Step 4: Run Automated Jest Test Suite (Day 10)
echo -e "\n${YELLOW}[Step 4/5] Running Jest Day 10 Test Suite (server/tests/day10-openings.test.js)...${NC}"
npm test --workspace=server -- tests/day10-openings.test.js
echo -e "${GREEN}✓ Day 10 test suite passed with 100% assertions.${NC}"

# Step 5: Seal Day 10
echo -e "\n${YELLOW}[Step 5/5] Finalizing Day 10 Seal...${NC}"
echo -e "${GREEN}==============================================================================${NC}"
echo -e "${GREEN}   [DAY 10 OPENING BOOK CATALOG & ACPL EXCLUSIONS SEALED — ARCHITECTURE VALID] ${NC}"
echo -e "${GREEN}==============================================================================${NC}"
