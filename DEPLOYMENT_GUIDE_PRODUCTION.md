# AKAN Party Manager - Production Deployment Guide

**Last Updated:** March 31, 2026
**Production URL:** https://corporate.akanhyd.com
**Server:** 89.116.21.19 (root@89.116.21.19)

---

## CRITICAL - DO NOT MODIFY

### Server Files (Keep Untouched)
```
/etc/letsencrypt/live/corporate.akanhyd.com/
  ├── fullchain.pem  (SSL certificate)
  └── privkey.pem    (SSL private key)
```

### Production Backend Config
- **Port:** 443 (HTTPS) + 8080 (HTTP backup) + 80 (redirect)
- **Location:** `/home/corporate.akanhyd.com/backend/`
- **CORS Origin:** `https://corporate.akanhyd.com`
- **Cache Control:** HTML (no-cache), JS/CSS (1 year)

### Files NOT to Change on Server
- `backend/server.js` - Keep HTTPS config, cache control, and port 443
- `backend/package.json` - Dependencies locked
- `.env` file on server - Contains production credentials
- Frontend build process - Use `npm run build`

---

## Project Structure

```
akan-party-manager/
├── backend/
│   ├── server.js              (HTTPS server with cache control)
│   ├── package.json
│   ├── routes/                (API endpoints)
│   ├── services/              (Google Sheets, Email, Reports)
│   ├── middleware/            (Auth, Role Check)
│   ├── utils/                 (Calculations)
│   ├── config/                (Google Sheets config)
│   ├── data/                  (JSON settings files)
│   ├── watchdog.js            (Auto-restart monitor)
│   └── reset-admin.js         (Password reset utility)
├── frontend/
│   ├── src/                   (React source)
│   ├── dist/                  (Built files - auto-generated)
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
├── deploy-production.sh       (Automated deploy script)
├── DEPLOYMENT_GUIDE_PRODUCTION.md (This file)
├── QUICK_REFERENCE.md
├── LITESPEED_PROTECTION.md
└── SETUP_GUIDE.md             (Local setup docs)
```

---

## Safe Deployment Process

### Step 1: Prepare Changes Locally
```bash
cd /Users/shashankreddy/Desktop/Claude/akan-party-manager

# Make changes to backend or frontend
# Test locally first
cd frontend && npm run build
```

### Step 2: Backup Before Deploy
```bash
# Automated deploy script creates backups automatically
# Or manually:
cp -r /Users/shashankreddy/Desktop/Claude/akan-party-manager \
      /Users/shashankreddy/Desktop/Claude/akan-party-manager.backup-$(date +%Y%m%d-%H%M%S)
```

### Step 3: Deploy (Automated)
```bash
bash /Users/shashankreddy/Desktop/Claude/akan-party-manager/deploy-production.sh
```

### Step 4: Deploy (Manual)

**Stop backend:**
```bash
ssh root@89.116.21.19 "pkill -f 'node.*server.js'"
sleep 2
```

**Upload backend files:**
```bash
rsync -avz /Users/shashankreddy/Desktop/Claude/akan-party-manager/backend/ \
  root@89.116.21.19:/home/corporate.akanhyd.com/backend/ \
  --exclude node_modules --exclude .env
```

**Upload frontend build:**
```bash
rsync -avz /Users/shashankreddy/Desktop/Claude/akan-party-manager/frontend/dist/ \
  root@89.116.21.19:/home/corporate.akanhyd.com/frontend/dist/
```

**Restart backend:**
```bash
ssh root@89.116.21.19 "cd /home/corporate.akanhyd.com/backend && nohup node server.js > /tmp/backend.log 2>&1 &"
sleep 3
```

**Verify:**
```bash
curl -s https://corporate.akanhyd.com/api/health | jq .
```

---

## Rollback to Previous Version

```bash
# Stop current backend
ssh root@89.116.21.19 "pkill -f 'node.*server.js'"
sleep 2

# Upload backup
rsync -avz /Users/shashankreddy/Desktop/Claude/akan-party-manager.backup-YYYYMMDD-HHMMSS/backend/ \
  root@89.116.21.19:/home/corporate.akanhyd.com/backend/

# Restart
ssh root@89.116.21.19 "cd /home/corporate.akanhyd.com/backend && nohup node server.js > /tmp/backend.log 2>&1 &"

# Verify
curl -s https://corporate.akanhyd.com/api/health
```

---

## Key Configuration

### Server Port Mapping
- **443** → HTTPS (main — Node.js serves both API + frontend)
- **8080** → HTTP backup
- **80** → Auto-redirect to HTTPS

### Environment Variables (.env on server)
```bash
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://corporate.akanhyd.com
GOOGLE_SHEETS_ID=<your-sheet-id>
GOOGLE_SERVICE_ACCOUNT_EMAIL=<service-account>
GOOGLE_PRIVATE_KEY=<private-key>
JWT_SECRET=<secret>
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=<email>
SMTP_PASS=<app-password>
SALES_EMAIL=sales@akanhyd.com
MANAGER_EMAIL=manager@akanhyd.com
ADMIN_EMAIL=admin@akanhyd.com
```

### Frontend API Calls
```javascript
// Uses relative paths: /api/*
// Works because backend serves both frontend + API from same domain
const API_BASE = import.meta.env.VITE_API_URL || '/api';
```

### SSL Certificates
- **Path:** `/etc/letsencrypt/live/corporate.akanhyd.com/`
- **Valid Until:** June 23, 2026
- **Auto-Renew:** Let's Encrypt renewal runs automatically

---

## Cron Jobs (Auto-Running on Server)

| Time | Job | Description |
|------|-----|-------------|
| Every 1 min | Watchdog | Health check + auto-restart + LiteSpeed killer |
| 2:30 AM UTC (8:00 AM IST) | Payment Reminders | Sends payment due reminders to guests |
| 4:00 AM UTC (9:30 AM IST) | Pending Payments | Daily report to ACCOUNTS role |
| 9:00 AM IST | Follow-ups | Daily follow-up & payment alerts |
| 10:00 PM IST | Daily Report | Sends daily party statistics |

**Check if cron is running:**
```bash
ssh root@89.116.21.19 "ps aux | grep 'node.*server'"
```

---

## Common Tasks

### Update Admin Password
```bash
ssh root@89.116.21.19 "cd /home/corporate.akanhyd.com/backend && node reset-admin.js"
```

### View Backend Logs
```bash
ssh root@89.116.21.19 "tail -f /tmp/backend.log"
```

### Check Port Status
```bash
ssh root@89.116.21.19 "netstat -tlnp | grep -E ':(443|8080|80)'"
```

### Restart Backend from Server
```bash
ssh root@89.116.21.19
cd /home/corporate.akanhyd.com/backend
pkill -f 'node.*server.js'
sleep 2
nohup node server.js > /tmp/backend.log 2>&1 &
```

---

## Deployment Checklist

**Before deploying:**
- [ ] Tested changes locally
- [ ] Built frontend: `cd frontend && npm run build`
- [ ] Created backup of current version
- [ ] NOT modifying server.js HTTPS config
- [ ] .env file NOT included in upload
- [ ] node_modules NOT synced

**After deploying:**
- [ ] Backend running: `ps aux | grep node`
- [ ] Health check: `curl https://corporate.akanhyd.com/api/health`
- [ ] Frontend loads correctly
- [ ] Users can login

---

## Production Features Active

- HTTPS/SSL (port 443)
- Cache control (HTML: no-cache, JS/CSS: 1 year)
- Static frontend serving from Node.js
- Payment reminder system (8:00 AM IST daily)
- Pending payments report to ACCOUNTS (9:30 AM IST daily)
- Daily reports (10:00 PM)
- Follow-up reminders (9:00 AM)
- Stale enquiry alerts (every 15 min)
- Role-based email routing
- Google Sheets integration
- JWT authentication
- Backend watchdog (auto-restart)
- LiteSpeed protection

---

**Server IP:** 89.116.21.19
**Domain:** corporate.akanhyd.com
**SSL Valid Until:** June 23, 2026
