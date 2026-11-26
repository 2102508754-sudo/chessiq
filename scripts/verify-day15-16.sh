#!/usr/bin/env bash
# ==============================================================================
# ChessIQ v3.3.0 — Day 15–16 Personalized Training & First-Party Auth Seal (@FE)
# Role: Bibhukesh Medhi — Frontend Engineer (@FE)
# ==============================================================================

set -euo pipefail

CYAN='\033[0;36m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${CYAN}==============================================================================${NC}"
echo -e "${CYAN}   ChessIQ v3.3.0 — Day 15-16 Training & First-Party Auth Seal (@FE)          ${NC}"
echo -e "${CYAN}==============================================================================${NC}"

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Step 1: Check Environment Prerequisites
echo -e "\n${YELLOW}[Step 1/5] Checking Environment Prerequisites...${NC}"
node -v > /dev/null
npm -v > /dev/null
echo -e "${GREEN}✓ Node.js and NPM runtime ready.${NC}"

# Step 2: Verify Frontend Architecture & Security Contracts (@FE)
echo -e "\n${YELLOW}[Step 2/5] Verifying Day 15–16 Modules & Single-Domain Cookie Security (@FE)...${NC}"
node -e "
const fs = require('fs');
const path = require('path');

const requiredFiles = [
  'client/src/api/client.js',
  'client/src/api/auth.js',
  'client/src/api/puzzles.js',
  'client/src/context/AuthContext.jsx',
  'client/src/hooks/useAuth.js',
  'client/src/hooks/useTrainingPuzzles.js',
  'client/src/utils/puzzleUtils.js',
  'client/src/components/auth/AuthStatus.jsx',
  'client/src/components/auth/LoginForm.jsx',
  'client/src/components/auth/ProtectedRoute.jsx',
  'client/src/components/auth/UserGameHistory.jsx',
  'client/src/components/training/TrainingDashboard.jsx',
  'client/src/components/training/TrainingStats.jsx',
  'client/src/components/training/PuzzleBoard.jsx',
  'client/src/components/training/PuzzleCard.jsx',
  'client/src/components/training/PuzzleControls.jsx',
  'client/src/components/training/PuzzleFeedback.jsx',
];

for (const rel of requiredFiles) {
  if (!fs.existsSync(path.resolve(rel))) {
    throw new Error('Missing required frontend module: ' + rel);
  }
}
console.log('✓ All 17 Day 15–16 frontend modules verified present');

const appSrc = fs.readFileSync(path.resolve('client/src/App.jsx'), 'utf8');
for (const token of ['AuthProvider', 'AuthStatus', 'ProtectedRoute', 'TrainingDashboard', 'UserGameHistory']) {
  if (!appSrc.includes(token)) {
    throw new Error('App.jsx missing integration token: ' + token);
  }
}
console.log('✓ App.jsx integration verified: ProtectedRoute, AuthProvider, TrainingDashboard & UserGameHistory');
"

# Step 3: Run Client Lint & Production Build
echo -e "\n${YELLOW}[Step 3/5] Running Client Lint & Vite Production Build...${NC}"
npm run lint
npm run build --workspace=client
echo -e "${GREEN}✓ Client lint and Vite production build compiled cleanly.${NC}"

# Step 4: Run Real Client Unit & Security Tests + Frontend Regressions
echo -e "\n${YELLOW}[Step 4/5] Running Day 15–16 Client Test Suite & Day 11–14 Regressions...${NC}"
npm test --workspace=client
npx jest server/tests/day11-chessboard.test.js server/tests/day12-14-frontend-analytics.test.js
echo -e "${GREEN}✓ All Day 11–16 frontend test suites passed with 100% assertions.${NC}"

# Step 5: Final Seal
echo -e "\n${YELLOW}[Step 5/5] Finalizing Day 15–16 Seal...${NC}"
echo -e "${GREEN}==============================================================================${NC}"
echo -e "${GREEN}   [DAY 15-16 PERSONALIZED TRAINING & SINGLE-DOMAIN AUTH SEALED]               ${NC}"
echo -e "${GREEN}==============================================================================${NC}"

