#!/bin/bash
# ============================================================================
# AKAN Party Manager - VPS Deployment Script
# Domain: corporate.akanhyd.com
# ============================================================================

set -e

# ── CONFIGURATION (Edit these before first run) ─────────────────────────────
VPS_IP=""                          # e.g., 103.xx.xx.xx
VPS_USER="root"                    # SSH username
VPS_PORT="22"                      # SSH port
DOMAIN="corporate.akanhyd.com"
APP_DIR="/var/www/akan-party"      # App directory on VPS
NODE_VERSION="20"                  # Node.js LTS version

# Local paths
LOCAL_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$LOCAL_DIR/backend"
FRONTEND_DIR="$LOCAL_DIR/frontend"
CREDENTIALS_FILE="$LOCAL_DIR/akan-party-manager-491201-1efe0437e2d8.json"

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

# ── PRE-FLIGHT CHECKS ───────────────────────────────────────────────────────
if [ -z "$VPS_IP" ]; then
  echo ""
  echo "============================================"
  echo "  AKAN Party Manager - Deploy to VPS"
  echo "============================================"
  echo ""
  read -p "Enter VPS IP address: " VPS_IP
  read -p "Enter SSH username [root]: " input_user
  VPS_USER="${input_user:-root}"
  read -p "Enter SSH port [22]: " input_port
  VPS_PORT="${input_port:-22}"
  echo ""
fi

SSH_CMD="ssh -o StrictHostKeyChecking=no -p $VPS_PORT $VPS_USER@$VPS_IP"
SCP_CMD="scp -o StrictHostKeyChecking=no -P $VPS_PORT"

info "Testing SSH connection to $VPS_USER@$VPS_IP..."
$SSH_CMD "echo 'Connected successfully'" || error "Cannot connect to VPS. Check IP/credentials."
log "SSH connection successful"

# ── STEP 1: BUILD FRONTEND LOCALLY ──────────────────────────────────────────
info "Building frontend..."
cd "$FRONTEND_DIR"
npm run build 2>&1 | tail -3
log "Frontend built successfully"

# ── STEP 2: PREPARE DEPLOYMENT PACKAGE ──────────────────────────────────────
info "Creating deployment package..."
DEPLOY_TMP="/tmp/akan-deploy-$(date +%s)"
mkdir -p "$DEPLOY_TMP/backend"
mkdir -p "$DEPLOY_TMP/frontend-dist"

# Copy backend (exclude node_modules)
rsync -a --exclude='node_modules' --exclude='.env' "$BACKEND_DIR/" "$DEPLOY_TMP/backend/"

# Copy frontend build
cp -r "$FRONTEND_DIR/dist/"* "$DEPLOY_TMP/frontend-dist/"

# Copy Google credentials file
if [ -f "$CREDENTIALS_FILE" ]; then
  cp "$CREDENTIALS_FILE" "$DEPLOY_TMP/backend/"
  log "Google credentials file included"
else
  warn "Google credentials file not found at $CREDENTIALS_FILE"
fi

# Create tarball
cd /tmp
tar -czf akan-deploy.tar.gz -C "$DEPLOY_TMP" .
DEPLOY_SIZE=$(du -sh /tmp/akan-deploy.tar.gz | cut -f1)
log "Deployment package created ($DEPLOY_SIZE)"

# ── STEP 3: SETUP VPS (First time only) ────────────────────────────────────
info "Setting up VPS environment..."
$SSH_CMD << 'SETUP_EOF'
set -e

# Install Node.js if not present
if ! command -v node &> /dev/null; then
  echo "[→] Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
echo "[✓] Node.js $(node -v)"

# Install PM2 if not present
if ! command -v pm2 &> /dev/null; then
  echo "[→] Installing PM2..."
  npm install -g pm2
fi
echo "[✓] PM2 installed"

# Install Nginx if not present
if ! command -v nginx &> /dev/null; then
  echo "[→] Installing Nginx..."
  apt-get update -qq
  apt-get install -y nginx
fi
echo "[✓] Nginx installed"

# Install certbot for SSL
if ! command -v certbot &> /dev/null; then
  echo "[→] Installing Certbot..."
  apt-get install -y certbot python3-certbot-nginx 2>/dev/null || true
fi
SETUP_EOF
log "VPS environment ready"

# ── STEP 4: UPLOAD FILES ────────────────────────────────────────────────────
info "Uploading deployment package to VPS..."
$SCP_CMD /tmp/akan-deploy.tar.gz "$VPS_USER@$VPS_IP:/tmp/akan-deploy.tar.gz"
log "Upload complete"

# ── STEP 5: DEPLOY ON VPS ──────────────────────────────────────────────────
info "Deploying application on VPS..."
$SSH_CMD << DEPLOY_EOF
set -e

APP_DIR="$APP_DIR"
DOMAIN="$DOMAIN"

# Create app directory
mkdir -p \$APP_DIR/backend
mkdir -p \$APP_DIR/frontend

# Backup current .env if exists
if [ -f "\$APP_DIR/backend/.env" ]; then
  cp "\$APP_DIR/backend/.env" /tmp/akan-env-backup
  echo "[✓] Existing .env backed up"
fi

# Extract new files
cd \$APP_DIR
tar -xzf /tmp/akan-deploy.tar.gz

# Move files to correct locations
cp -r backend/* \$APP_DIR/backend/ 2>/dev/null || true
cp -r frontend-dist/* \$APP_DIR/frontend/ 2>/dev/null || true
rm -rf backend frontend-dist

# Restore .env if it was backed up
if [ -f "/tmp/akan-env-backup" ]; then
  cp /tmp/akan-env-backup \$APP_DIR/backend/.env
  echo "[✓] .env restored from backup"
fi

# Check if .env exists, create template if not
if [ ! -f "\$APP_DIR/backend/.env" ]; then
  cat > "\$APP_DIR/backend/.env" << 'ENV_EOF'
# Server Configuration
PORT=5001
NODE_ENV=production

# JWT Secret (CHANGE THIS!)
JWT_SECRET=your-secret-key-change-this

# Google Sheets
GOOGLE_SHEETS_ID=your-sheet-id
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY_FILE=./akan-party-manager-491201-1efe0437e2d8.json

# SMTP Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SALES_EMAIL=sales@akanhyd.com
ENV_EOF
  echo "[!] Created .env template - EDIT IT with real values: nano \$APP_DIR/backend/.env"
fi

# Install backend dependencies
cd \$APP_DIR/backend
npm install --production 2>&1 | tail -3
echo "[✓] Dependencies installed"

# Stop existing PM2 process if running
pm2 stop akan-backend 2>/dev/null || true
pm2 delete akan-backend 2>/dev/null || true

# Start with PM2
pm2 start server.js --name akan-backend --cwd \$APP_DIR/backend \\
  --max-memory-restart 512M \\
  --time \\
  -e \$APP_DIR/logs/error.log \\
  -o \$APP_DIR/logs/output.log

# Save PM2 config & setup startup
mkdir -p \$APP_DIR/logs
pm2 save
pm2 startup 2>/dev/null || true

echo "[✓] Backend running with PM2"

# ── NGINX CONFIGURATION ──
cat > /etc/nginx/sites-available/\$DOMAIN << 'NGINX_EOF'
server {
    listen 80;
    server_name $DOMAIN;

    # Frontend - serve static files
    root $APP_DIR/frontend;
    index index.html;

    # Cache busting - HTML files never cached
    location / {
        try_files \$uri \$uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
    }

    # JS/CSS/Images - cache with versioned filenames
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # API proxy to backend
    location /api/ {
        proxy_pass http://127.0.0.1:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;
    gzip_min_length 1000;
}
NGINX_EOF

# Fix Nginx config - replace variable placeholders
sed -i "s|\\\$DOMAIN|$DOMAIN|g" /etc/nginx/sites-available/\$DOMAIN 2>/dev/null || true
sed -i "s|\\\$APP_DIR|$APP_DIR|g" /etc/nginx/sites-available/\$DOMAIN 2>/dev/null || true

# Enable site
ln -sf /etc/nginx/sites-available/\$DOMAIN /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

# Test and reload Nginx
nginx -t && systemctl reload nginx
echo "[✓] Nginx configured for \$DOMAIN"

# Try SSL with certbot (non-interactive, will skip if domain not pointed)
certbot --nginx -d \$DOMAIN --non-interactive --agree-tos --email admin@akanhyd.com 2>/dev/null && echo "[✓] SSL certificate installed" || echo "[!] SSL skipped - run manually: certbot --nginx -d \$DOMAIN"

# Cleanup
rm -f /tmp/akan-deploy.tar.gz

echo ""
echo "============================================"
echo "  Deployment Complete!"
echo "============================================"
echo "  App:     http://\$DOMAIN"
echo "  Backend: http://\$DOMAIN/api/"
echo "  PM2:     pm2 status / pm2 logs akan-backend"
echo "  Logs:    \$APP_DIR/logs/"
echo "============================================"
DEPLOY_EOF

# ── CLEANUP LOCAL ───────────────────────────────────────────────────────────
rm -rf "$DEPLOY_TMP" /tmp/akan-deploy.tar.gz

echo ""
log "Deployment complete!"
echo ""
echo "  🌐 Site: http://$DOMAIN"
echo ""
echo "  Useful VPS commands:"
echo "    pm2 status              - Check app status"
echo "    pm2 logs akan-backend   - View live logs"
echo "    pm2 restart akan-backend - Restart backend"
echo "    nano $APP_DIR/backend/.env - Edit environment variables"
echo ""
