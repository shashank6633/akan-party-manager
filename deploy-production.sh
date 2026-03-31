#!/bin/bash
# ============================================================================
# AKAN Party Manager - Production Deployment Script
# Server: 89.116.21.19
# Domain: corporate.akanhyd.com
# Path:   /home/corporate.akanhyd.com/
# ============================================================================

set -e

# ── CONFIGURATION ──────────────────────────────────────────────────────────
SERVER="root@89.116.21.19"
SERVER_PATH="/home/corporate.akanhyd.com"
LOCAL_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$LOCAL_DIR/backend"
FRONTEND_DIR="$LOCAL_DIR/frontend"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }
info() { echo -e "${BLUE}[→]${NC} $1"; }

echo ""
echo "============================================"
echo "  AKAN Party Manager - Deploy to Production"
echo "  Server: 89.116.21.19"
echo "  Domain: corporate.akanhyd.com"
echo "============================================"
echo ""

# ── PRE-FLIGHT CHECK ───────────────────────────────────────────────────────
info "Testing SSH connection..."
ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no $SERVER "echo 'Connected'" || error "Cannot connect to server. Check SSH key/access."
log "SSH connection successful"

# ── STEP 1: CREATE LOCAL BACKUP ────────────────────────────────────────────
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="$LOCAL_DIR.backup-$TIMESTAMP"
info "Creating local backup at $BACKUP_DIR..."
cp -r "$BACKEND_DIR" "$BACKUP_DIR-backend" 2>/dev/null || true
if [ -d "$FRONTEND_DIR/dist" ]; then
  cp -r "$FRONTEND_DIR/dist" "$BACKUP_DIR-frontend-dist" 2>/dev/null || true
fi
log "Backup created"

# ── STEP 2: BUILD FRONTEND ────────────────────────────────────────────────
info "Building frontend..."
cd "$FRONTEND_DIR"
npm run build 2>&1 | tail -5
log "Frontend built successfully"

# ── STEP 3: STOP BACKEND ON SERVER ────────────────────────────────────────
info "Stopping backend on server..."
ssh $SERVER "pkill -f 'node.*server.js'" 2>/dev/null || true
sleep 2
log "Backend stopped"

# ── STEP 4: UPLOAD BACKEND ────────────────────────────────────────────────
info "Uploading backend files..."
rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude '.env' \
  --exclude 'watchdog.js' \
  --exclude 'server.js' \
  "$BACKEND_DIR/" "$SERVER:$SERVER_PATH/backend/" 2>&1 | tail -3
log "Backend uploaded"

# ── STEP 5: INSTALL DEPENDENCIES (if package.json changed) ────────────────
info "Installing backend dependencies..."
ssh $SERVER "cd $SERVER_PATH/backend && npm install --production 2>&1 | tail -3"
log "Dependencies installed"

# ── STEP 6: UPLOAD FRONTEND BUILD ─────────────────────────────────────────
info "Uploading frontend build..."
rsync -avz --delete \
  "$FRONTEND_DIR/dist/" "$SERVER:$SERVER_PATH/frontend/dist/" 2>&1 | tail -3
log "Frontend uploaded"

# ── STEP 7: RESTART BACKEND ───────────────────────────────────────────────
info "Starting backend..."
ssh -f $SERVER "cd $SERVER_PATH/backend && nohup node server.js > /tmp/backend.log 2>&1 & disown"
sleep 3
log "Backend started"

# ── STEP 8: VERIFY DEPLOYMENT ─────────────────────────────────────────────
info "Verifying deployment..."

# Check API health
HEALTH=$(curl -s --max-time 10 https://corporate.akanhyd.com/api/health 2>/dev/null || echo '{"success":false}')
if echo "$HEALTH" | grep -q '"success":true'; then
  log "API health check passed"
else
  warn "API health check failed — check server logs: ssh $SERVER 'tail -50 /tmp/backend.log'"
fi

# Check frontend
FRONTEND_CHECK=$(curl -s --max-time 10 https://corporate.akanhyd.com/ 2>/dev/null | head -c 500)
if echo "$FRONTEND_CHECK" | grep -qi "akan\|react\|root"; then
  log "Frontend loads correctly"
else
  warn "Frontend check inconclusive — verify manually"
fi

# ── DONE ───────────────────────────────────────────────────────────────────
echo ""
echo "============================================"
echo -e "  ${GREEN}Deployment Complete!${NC}"
echo "============================================"
echo "  App:     https://corporate.akanhyd.com"
echo "  API:     https://corporate.akanhyd.com/api/health"
echo "  Logs:    ssh $SERVER 'tail -f /tmp/backend.log'"
echo "  Backup:  $BACKUP_DIR-backend"
echo "============================================"
echo ""
