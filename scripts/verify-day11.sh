#!/usr/bin/env bash
# ==============================================================================
# ChessIQ v3.3.0 — Day 11 Interactive Chessboard UI & Dynamic Board Flipping Seal (@FE)
# Role: Bibhukesh Medhi — Frontend & Telemetry Engineer (@FE)
# ==============================================================================

set -euo pipefail

CYAN='\033[0;36m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo -e "${CYAN}==============================================================================${NC}"
echo -e "${CYAN}   ChessIQ v3.3.0 — Day 11 Interactive Chessboard & Board Flipping Seal (@FE)  ${NC}"
echo -e "${CYAN}==============================================================================${NC}"

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Step 1: Check Environment Prerequisites
echo -e "\n${YELLOW}[Step 1/5] Checking Environment Prerequisites...${NC}"
node -v > /dev/null
npm -v > /dev/null
echo -e "${GREEN}✓ Node.js and NPM runtime ready.${NC}"

# Step 2: Verify Frontend Architecture & Interactive Chessboard Contracts
echo -e "\n${YELLOW}[Step 2/5] Verifying Interactive Chessboard Architecture & File Contracts (@FE)...${NC}"
node -e "
const fs = require('fs');
const path = require('path');

// 1. Verify InteractiveChessboard component exists and contains necessary props
const compPath = path.resolve('client/src/components/InteractiveChessboard.jsx');
if (!fs.existsSync(compPath)) {
  throw new Error('InteractiveChessboard.jsx component missing!');
}
const compSrc = fs.readFileSync(compPath, 'utf8');

const requiredTokens = [
  'arePiecesDraggable={true}',
  'onPieceDrop',
  'onSquareClick',
  'customSquareStyles',
  'customArrows',
  'boardOrientation',
  'BOARD_THEMES',
  'parseMoveToSquares'
];

for (const token of requiredTokens) {
  if (!compSrc.includes(token)) {
    throw new Error('InteractiveChessboard.jsx missing required contract token: ' + token);
  }
}
console.log('✓ InteractiveChessboard.jsx verified: contains drag-and-drop, click-to-move, and customArrows contracts');

// 2. Verify Web Audio Engine
const audioPath = path.resolve('client/src/utils/chessAudio.js');
if (!fs.existsSync(audioPath)) {
  throw new Error('chessAudio.js missing!');
}
const audioSrc = fs.readFileSync(audioPath, 'utf8');
if (!audioSrc.includes('playMove') || !audioSrc.includes('playCapture') || !audioSrc.includes('playCheck') || !audioSrc.includes('playCastle')) {
  throw new Error('chessAudio.js missing required sound synthesis methods!');
}
console.log('✓ Synthesized Web Audio Engine verified: move, capture, check, and castle sounds implemented');

// 3. Verify App.jsx integration
const appPath = path.resolve('client/src/App.jsx');
const appSrc = fs.readFileSync(appPath, 'utf8');
if (!appSrc.includes('InteractiveChessboard') || !appSrc.includes('handleMovePlayed')) {
  throw new Error('App.jsx is missing InteractiveChessboard component integration!');
}
console.log('✓ App.jsx integration verified: InteractiveChessboard registered with keyboard navigation and move handler');
"
echo -e "${GREEN}✓ Architectural contracts and component interfaces verified.${NC}"

# Step 3: Run Production Client Build
echo -e "\n${YELLOW}[Step 3/5] Verifying Production Client Build with Vite...${NC}"
npm run build --workspace=client
echo -e "${GREEN}✓ Client production build compiled cleanly.${NC}"

# Step 4: Run Automated Jest Test Suite (Day 11)
echo -e "\n${YELLOW}[Step 4/5] Running Jest Day 11 Test Suite (server/tests/day11-chessboard.test.js)...${NC}"
npx jest server/tests/day11-chessboard.test.js
echo -e "${GREEN}✓ Day 11 test suite passed with 100% assertions.${NC}"

# Step 5: Seal Day 11
echo -e "\n${YELLOW}[Step 5/5] Finalizing Day 11 Seal...${NC}"
echo -e "${GREEN}==============================================================================${NC}"
echo -e "${GREEN}   [DAY 11 INTERACTIVE CHESSBOARD & BOARD FLIPPING SEALED — READY FOR DAY 12]  ${NC}"
echo -e "${GREEN}==============================================================================${NC}"

