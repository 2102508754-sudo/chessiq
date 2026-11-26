#!/usr/bin/env bash
# ==============================================================================
# ChessIQ v3.3.0 — Day 17 End-to-End Concurrency & Fault-Injection Chaos Seal
# ==============================================================================

set -euo pipefail

CYAN='\033[0;36m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${CYAN}==============================================================================${NC}"
echo -e "${CYAN}   ChessIQ v3.3.0 — Day 17 Concurrency & Chaos Fault-Injection Seal          ${NC}"
echo -e "${CYAN}==============================================================================${NC}"

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Step 1: Check PostgreSQL & Migration Integrity
echo -e "\n${YELLOW}[Step 1/5] Verifying PostgreSQL Connection & 6NF Migrations...${NC}"
npm run migrate
echo -e "${GREEN}✓ All 7 database migrations and PostgreSQL diagnostic checks verified.${NC}"

# Step 2: Execute Day 17 Chaos & Concurrency Stress Suite
echo -e "\n${YELLOW}[Step 2/5] Running Day 17 Concurrency & Fault-Injection Stress Suite...${NC}"
npm test --workspace=server -- tests/day17-chaos-stress.test.js
echo -e "${GREEN}✓ Day 17 chaos & fault-injection stress tests passed (100% assertions).${NC}"

# Step 3: Execute Full Server CI Regression Suite
echo -e "\n${YELLOW}[Step 3/5] Running Full Monorepo Server CI Suite (All 14 Suites)...${NC}"
CI=true npm run test:ci --workspace=server
echo -e "${GREEN}✓ All backend unit & integration test suites passed.${NC}"

# Step 4: Execute Frontend Unit Tests & Production Build
echo -e "\n${YELLOW}[Step 4/5] Running Frontend ESM Suite & Vite Production Build...${NC}"
npm test --workspace=client
npm run build --workspace=client
echo -e "${GREEN}✓ Frontend tests and production bundle compiled cleanly.${NC}"

# Step 5: Final Day 17 Seal
echo -e "\n${YELLOW}[Step 5/5] Finalizing Day 17 Chaos Verification Seal...${NC}"
echo -e "${GREEN}==============================================================================${NC}"
echo -e "${GREEN}   [DAY 17 END-TO-END CONCURRENCY & CHAOS VERIFICATION SEALED — PASSED]       ${NC}"
echo -e "${GREEN}==============================================================================${NC}"
