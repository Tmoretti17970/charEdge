#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# TradeForge — Deployment Script
#
# Zero-downtime deployment to Hetzner EX44 via Docker Compose.
#
# Usage:
#   ./deploy.sh                 # Full deploy (build + restart)
#   ./deploy.sh --build-only    # Build without restarting
#   ./deploy.sh --restart-only  # Restart without building
#   ./deploy.sh --status        # Show current status
# ═══════════════════════════════════════════════════════════════════

set -euo pipefail

# ─── Configuration ───────────────────────────────────────────────

REMOTE_HOST="${DEPLOY_HOST:-}"
REMOTE_USER="${DEPLOY_USER:-root}"
REMOTE_DIR="${DEPLOY_DIR:-/opt/tradeforge}"
COMPOSE_FILE="docker-compose.yml"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[DEPLOY]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
err() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# ─── Parse Arguments ─────────────────────────────────────────────

BUILD=true
RESTART=true

case "${1:-}" in
  --build-only)   RESTART=false ;;
  --restart-only) BUILD=false ;;
  --status)
    if [ -n "$REMOTE_HOST" ]; then
      ssh "$REMOTE_USER@$REMOTE_HOST" "cd $REMOTE_DIR && docker compose ps && echo '---' && docker compose logs --tail=20 tradeforge"
    else
      docker compose ps && echo '---' && docker compose logs --tail=20 tradeforge
    fi
    exit 0
    ;;
  --help)
    echo "Usage: ./deploy.sh [--build-only|--restart-only|--status|--help]"
    exit 0
    ;;
esac

# ─── Pre-flight Checks ──────────────────────────────────────────

log "Pre-flight checks..."

# Ensure we're in the right directory
if [ ! -f "$COMPOSE_FILE" ]; then
  err "docker-compose.yml not found. Run from project root."
fi

# Check Node/npm
command -v node >/dev/null 2>&1 || err "Node.js not installed"
command -v npm >/dev/null 2>&1 || err "npm not installed"

# ─── Build ───────────────────────────────────────────────────────

if [ "$BUILD" = true ]; then
  log "Installing dependencies..."
  npm ci --production=false

  log "Building production bundle..."
  npm run build

  log "Build complete. Checking output..."
  if [ ! -d "dist" ]; then
    err "Build failed — dist/ directory not found"
  fi

  BUILD_SIZE=$(du -sh dist/ | awk '{print $1}')
  log "Bundle size: $BUILD_SIZE"
fi

# ─── Deploy ──────────────────────────────────────────────────────

if [ "$RESTART" = true ]; then
  if [ -n "$REMOTE_HOST" ]; then
    # Remote deployment
    log "Syncing to $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR ..."

    rsync -avz --delete \
      --exclude='node_modules' \
      --exclude='.git' \
      --exclude='data/' \
      --exclude='.env' \
      ./ "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/"

    log "Restarting containers on remote..."
    ssh "$REMOTE_USER@$REMOTE_HOST" "cd $REMOTE_DIR && docker compose up -d --build && docker compose ps"

  else
    # Local deployment
    log "Deploying locally..."
    docker compose up -d --build

    # Wait for health check
    log "Waiting for health check..."
    sleep 5

    if docker compose ps | grep -q "healthy"; then
      log "✅ Deployment successful! Service is healthy."
    else
      warn "Service may still be starting. Check: docker compose ps"
    fi
  fi
fi

# ─── Post-Deploy ─────────────────────────────────────────────────

log "Deployment summary:"
echo "  App:    http://localhost:3000"
echo "  Nginx:  https://tradeforge.app (if configured)"
echo "  Status: docker compose ps"
echo "  Logs:   docker compose logs -f tradeforge"

log "Done! 🚀"
