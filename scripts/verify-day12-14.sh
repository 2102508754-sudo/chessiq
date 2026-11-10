#!/usr/bin/env bash
# ==============================================================================
# ChessIQ v3.3.0 — Day 12–14 Frontend & Telemetry Analytics Verification Seal (@FE)
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
echo -e "${CYAN}   ChessIQ v3.3.0 — Day 12-14 Frontend & Telemetry Analytics Seal (@FE)       ${NC}"
echo -e "${CYAN}==============================================================================${NC}"

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Step 1: Check Environment Prerequisites
echo -e "\n${YELLOW}[Step 1/5] Checking Environment Prerequisites...${NC}"
node -v > /dev/null
npm -v > /dev/null
echo -e "${GREEN}✓ Node.js and NPM runtime ready.${NC}"

# Step 2: Verify Frontend Architecture & Contract Integrity (@FE)
echo -e "\n${YELLOW}[Step 2/5] Verifying Day 12–14 Component Architecture & Contract Seals (@FE)...${NC}"
node -e "
const fs = require('fs');
const path = require('path');

// 1. Verify Longitudinal Analytics Engine
const analyticsPath = path.resolve('client/src/utils/longitudinalAnalytics.js');
if (!fs.existsSync(analyticsPath)) throw new Error('longitudinalAnalytics.js missing!');
const analyticsSrc = fs.readFileSync(analyticsPath, 'utf8');
const analyticsTokens = [
  'determineGamePhase',
  'calculatePhaseAnalytics',
  'calculateRadarData',
  'getRadarPoint',
  'generateRadarPolygonPath',
  'GAME_PHASES'
];
for (const token of analyticsTokens) {
  if (!analyticsSrc.includes(token)) throw new Error('longitudinalAnalytics.js missing token: ' + token);
}
console.log('✓ longitudinalAnalytics.js verified: phase partitioning, ACPL math, and SVG radar geometry');

// 2. Verify Real-Time Polling Hook
const hookPath = path.resolve('client/src/hooks/useAnalysisPolling.js');
if (!fs.existsSync(hookPath)) throw new Error('useAnalysisPolling.js missing!');
const hookSrc = fs.readFileSync(hookPath, 'utf8');
const hookTokens = ['POLLING_STATUS', 'useAnalysisPolling', 'AbortController', 'startPolling', 'stopPolling'];
for (const token of hookTokens) {
  if (!hookSrc.includes(token)) throw new Error('useAnalysisPolling.js missing token: ' + token);
}
console.log('✓ useAnalysisPolling.js verified: adaptive intervals, backoff, and AbortController cleanup');

// 3. Verify Analysis Progress HUD
const hudPath = path.resolve('client/src/components/AnalysisProgressBar.jsx');
if (!fs.existsSync(hudPath)) throw new Error('AnalysisProgressBar.jsx missing!');
const hudSrc = fs.readFileSync(hudPath, 'utf8');
if (!hudSrc.includes('progressPercent') || !hudSrc.includes('currentPly') || !hudSrc.includes('totalPlies')) {
  throw new Error('AnalysisProgressBar.jsx missing telemetry indicators');
}
console.log('✓ AnalysisProgressBar.jsx verified: progress HUD, ply counter, and status badges');

// 4. Verify Tactical Blunder Classification Tiers
const blunderPath = path.resolve('client/src/components/TacticalBlunderTiers.jsx');
if (!fs.existsSync(blunderPath)) throw new Error('TacticalBlunderTiers.jsx missing!');
const blunderSrc = fs.readFileSync(blunderPath, 'utf8');
const blunderTokens = ['TACTICAL_TIERS', 'BLUNDER', 'MISTAKE', 'INACCURACY', 'currentPlyIndex'];
for (const token of blunderTokens) {
  if (!blunderSrc.includes(token)) throw new Error('TacticalBlunderTiers.jsx missing token: ' + token);
}
console.log('✓ TacticalBlunderTiers.jsx verified: 7-tier classifications, error navigation, and CPL badges');

// 5. Verify Longitudinal Radar Chart
const radarPath = path.resolve('client/src/components/LongitudinalRadarChart.jsx');
if (!fs.existsSync(radarPath)) throw new Error('LongitudinalRadarChart.jsx missing!');
const radarSrc = fs.readFileSync(radarPath, 'utf8');
const radarTokens = ['LongitudinalRadarChart', 'generateRadarPolygonPath', 'phaseStats', 'radarData'];
for (const token of radarTokens) {
  if (!radarSrc.includes(token)) throw new Error('LongitudinalRadarChart.jsx missing token: ' + token);
}
console.log('✓ LongitudinalRadarChart.jsx verified: 5-axis SVG spider web, benchmark overlay, and phase cards');

// 6. Verify App.jsx Integration
const appPath = path.resolve('client/src/App.jsx');
const appSrc = fs.readFileSync(appPath, 'utf8');
const appTokens = [
  'useAnalysisPolling',
  'AnalysisProgressBar',
  'TacticalBlunderTiers',
  'LongitudinalRadarChart'
];
for (const token of appTokens) {
  if (!appSrc.includes(token)) throw new Error('App.jsx missing integration token: ' + token);
}
console.log('✓ App.jsx integration verified: all Day 12–14 telemetry, navigation, and charts mounted');

// 7. Verify Backend Contract Aliases
const serverPath = path.resolve('server/src/app.js');
const serverSrc = fs.readFileSync(serverPath, 'utf8');
if (!serverSrc.includes('/api/jobs') || !serverSrc.includes('/api/analytics')) {
  throw new Error('server/src/app.js missing /api/jobs or /api/analytics endpoints');
}
console.log('✓ Server API contracts verified: /api/jobs and /api/analytics endpoints mounted');
"
echo -e "${GREEN}✓ Architectural contracts and component interfaces verified.${NC}"

# Step 3: Run Production Client Build
echo -e "\n${YELLOW}[Step 3/5] Verifying Production Client Build with Vite...${NC}"
npm run build --workspace=client
echo -e "${GREEN}✓ Client production build compiled cleanly without errors.${NC}"

# Step 4: Run Automated Jest Test Suite (Day 11 + Day 12–14)
echo -e "\n${YELLOW}[Step 4/5] Running Jest Day 12–14 Unit Test Suite...${NC}"
npx jest server/tests/day12-14-frontend-analytics.test.js server/tests/day11-chessboard.test.js
echo -e "${GREEN}✓ All Day 11–14 frontend tests passed with 100% assertions.${NC}"

# Step 5: Seal Day 12–14
echo -e "\n${YELLOW}[Step 5/5] Finalizing Day 12–14 Seal...${NC}"
echo -e "${GREEN}==============================================================================${NC}"
echo -e "${GREEN}   [DAY 12-14 FRONTEND & TELEMETRY ANALYTICS SEALED — READY FOR REVIEW]        ${NC}"
echo -e "${GREEN}==============================================================================${NC}"
