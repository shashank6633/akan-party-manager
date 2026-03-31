# AKAN Party Manager - Quick Reference Card

## Quick Deploy (3 Steps)

```bash
# 1. Build frontend
cd /Users/shashankreddy/Desktop/Claude/akan-party-manager/frontend && npm run build

# 2. Run automated deploy script
bash /Users/shashankreddy/Desktop/Claude/akan-party-manager/deploy-production.sh

# 3. Verify
curl https://corporate.akanhyd.com/api/health
```

---

## DO NOT TOUCH

| File/Folder | Reason |
|-------------|--------|
| `backend/server.js` (on server) | Has HTTPS config (port 443), cache control, CORS setup |
| `/etc/letsencrypt/` | SSL certificates - breaking this breaks HTTPS |
| `.env` file on server | Contains sensitive credentials |
| `frontend/dist/` | Build output - always regenerate |

---

## SAFE TO MODIFY

| File/Folder | What You Can Do |
|-------------|-----------------|
| `backend/routes/` | Add new endpoints, modify existing routes |
| `backend/services/` | Add new services, modify existing logic |
| `backend/middleware/` | Auth, role check modifications |
| `frontend/src/pages/` | Add new pages, modify existing pages |
| `frontend/src/components/` | Add new components, modify existing |
| `backend/utils/` | Add utility functions |

---

## Deploy Changes

### Option 1: Automated (Recommended)
```bash
bash /Users/shashankreddy/Desktop/Claude/akan-party-manager/deploy-production.sh
```

### Option 2: Manual Steps
```bash
# Build frontend
cd /Users/shashankreddy/Desktop/Claude/akan-party-manager/frontend && npm run build

# Stop backend
ssh root@89.116.21.19 "pkill -f 'node.*server.js'" && sleep 2

# Upload backend
rsync -avz /Users/shashankreddy/Desktop/Claude/akan-party-manager/backend/ \
  root@89.116.21.19:/home/corporate.akanhyd.com/backend/ \
  --exclude node_modules --exclude .env

# Upload frontend
rsync -avz /Users/shashankreddy/Desktop/Claude/akan-party-manager/frontend/dist/ \
  root@89.116.21.19:/home/corporate.akanhyd.com/frontend/dist/

# Restart backend
ssh root@89.116.21.19 "cd /home/corporate.akanhyd.com/backend && nohup node server.js > /tmp/backend.log 2>&1 &"
```

---

## Key URLs & Paths

| Item | Value |
|------|-------|
| **Production URL** | https://corporate.akanhyd.com |
| **API Base** | https://corporate.akanhyd.com/api |
| **Health Check** | https://corporate.akanhyd.com/api/health |
| **Server IP** | 89.116.21.19 |
| **Server Path** | /home/corporate.akanhyd.com/ |
| **Local Path** | /Users/shashankreddy/Desktop/Claude/akan-party-manager/ |

---

## Server Configuration

### Port Mapping
- **443** → HTTPS (main API + frontend)
- **8080** → HTTP backup
- **80** → Auto-redirect to HTTPS

### Cron Jobs (Auto-Running)
- **Every 1 min** → Watchdog (health check + auto-restart)
- **2:30 AM UTC** → Payment reminders (8:00 AM IST)
- **4:00 AM UTC** → Pending payments to ACCOUNTS (9:30 AM IST)
- **9:00 AM IST** → Follow-up reminders
- **10:00 PM IST** → Daily report email

---

## User Roles

| Role | Access |
|------|--------|
| GRE | Add parties, view dashboard (no edit) |
| CASHIER | Billing for confirmed parties only |
| ACCOUNTS | View confirmed parties, billing fields only, daily payment reports |
| SALES | Full party management, F&P, reports |
| MANAGER | Everything except settings/user management |
| ADMIN | Full access including settings, user management, delete |

---

## Troubleshooting

### Backend not responding
```bash
ssh root@89.116.21.19 "cd /home/corporate.akanhyd.com/backend && pkill -f 'node.*server.js'; sleep 2; nohup node server.js > /tmp/backend.log 2>&1 &"
curl https://corporate.akanhyd.com/api/health
```

### Frontend showing old version
Users: Press `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)

### Check logs
```bash
ssh root@89.116.21.19 "tail -50 /tmp/backend.log"
ssh root@89.116.21.19 "tail -20 /tmp/backend-watchdog.log"
```

---

**Version:** 3.0 (March 31, 2026)
