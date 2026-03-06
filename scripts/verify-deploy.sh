#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# charEdge — Post-Deploy Health Verification
#
# Validates that a deployed instance is healthy:
#   1. GET /api/health → status: ok
#   2. Version matches expected (if provided)
#   3. Checks service availability
#
# Usage:
#   ./scripts/verify-deploy.sh https://charedge.com
#   ./scripts/verify-deploy.sh https://charedge.com v2.1.0
#
# Exit codes:
#   0 = all checks passed
#   1 = health check failed
#   2 = version mismatch
#   3 = connectivity error
#
# Task: 3.2.14 (Post-deploy health verification)
# ═══════════════════════════════════════════════════════════════════

set -euo pipefail

# ─── Arguments ───────────────────────────────────────────────────

BASE_URL="${1:-http://localhost:3000}"
EXPECTED_VERSION="${2:-}"
TIMEOUT=10
MAX_RETRIES=3
RETRY_DELAY=5

# ─── Colors ──────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  charEdge — Post-Deploy Verification${NC}"
echo -e "${CYAN}  Target: ${BASE_URL}${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# ─── Health Check ────────────────────────────────────────────────

echo -e "${YELLOW}[1/3]${NC} Checking health endpoint..."

HEALTH_URL="${BASE_URL}/api/health"
ATTEMPT=0
HEALTH_OK=false

while [ $ATTEMPT -lt $MAX_RETRIES ]; do
  ATTEMPT=$((ATTEMPT + 1))
  echo -e "  Attempt ${ATTEMPT}/${MAX_RETRIES}..."

  HTTP_RESPONSE=$(curl -s -w "\n%{http_code}" --connect-timeout $TIMEOUT "$HEALTH_URL" 2>/dev/null || echo -e "\n000")

  HTTP_CODE=$(echo "$HTTP_RESPONSE" | tail -1)
  BODY=$(echo "$HTTP_RESPONSE" | head -n -1)

  if [ "$HTTP_CODE" = "200" ]; then
    STATUS=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))" 2>/dev/null || echo "")
    if [ "$STATUS" = "ok" ]; then
      HEALTH_OK=true
      UPTIME=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('uptime_seconds','?'))" 2>/dev/null || echo "?")
      DEPLOY_VERSION=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('version','unknown'))" 2>/dev/null || echo "unknown")
      echo -e "  ${GREEN}✅ Health OK${NC} — uptime: ${UPTIME}s, version: ${DEPLOY_VERSION}"
      break
    fi
  fi

  if [ $ATTEMPT -lt $MAX_RETRIES ]; then
    echo -e "  ${YELLOW}⏳ Retrying in ${RETRY_DELAY}s...${NC}"
    sleep $RETRY_DELAY
  fi
done

if [ "$HEALTH_OK" = false ]; then
  echo -e "  ${RED}❌ Health check FAILED${NC} (HTTP ${HTTP_CODE})"
  echo -e "  Response: ${BODY:-'(empty)'}"
  exit 1
fi

# ─── Version Check ───────────────────────────────────────────────

echo ""
echo -e "${YELLOW}[2/3]${NC} Checking version..."

if [ -n "$EXPECTED_VERSION" ]; then
  if [ "$DEPLOY_VERSION" = "$EXPECTED_VERSION" ]; then
    echo -e "  ${GREEN}✅ Version matches${NC}: ${DEPLOY_VERSION}"
  else
    echo -e "  ${RED}❌ Version MISMATCH${NC}: expected ${EXPECTED_VERSION}, got ${DEPLOY_VERSION}"
    exit 2
  fi
else
  echo -e "  ${YELLOW}⏭ Skipped${NC} (no expected version specified)"
fi

# ─── Frontend Check ─────────────────────────────────────────────

echo ""
echo -e "${YELLOW}[3/3]${NC} Checking frontend..."

FRONTEND_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout $TIMEOUT "$BASE_URL" 2>/dev/null || echo "000")

if [ "$FRONTEND_RESPONSE" = "200" ] || [ "$FRONTEND_RESPONSE" = "304" ]; then
  echo -e "  ${GREEN}✅ Frontend reachable${NC} (HTTP ${FRONTEND_RESPONSE})"
else
  echo -e "  ${RED}❌ Frontend UNREACHABLE${NC} (HTTP ${FRONTEND_RESPONSE})"
  exit 3
fi

# ─── Summary ─────────────────────────────────────────────────────

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  ✅ All checks passed — deploy verified!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
exit 0
