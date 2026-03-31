# LiteSpeed Protection & Backend Watchdog Guide

## Problem History

On March 26, 2026, LiteSpeed Web Server reactivated despite being previously disabled and began intercepting all port 443 traffic, blocking the Node.js backend API. This caused complete application downtime.

## Solution Deployed

### 1. Force-Kill LiteSpeed
```bash
# Kill all LiteSpeed processes
fuser -k 443/tcp

# Verify Node.js now owns port 443
lsof -i :443 | grep node
```

### 2. Disable LiteSpeed Service
```bash
# Stop and disable systemd service
systemctl disable lsws.service
systemctl mask lsws.service

# Remove/rename LiteSpeed binaries
mv /usr/local/lsws/bin/openlitespeed /usr/local/lsws/bin/openlitespeed.disabled
mv /usr/local/lsws/bin/litespeed /usr/local/lsws/bin/litespeed.disabled
chmod 000 /usr/local/lsws/bin/  # Lock directory
```

### 3. Backend Watchdog (Auto-Restart Protection)

**Watchdog Script:** `backend/watchdog.js`
- Runs every minute via cron
- Checks if backend is responding on `/api/health`
- Automatically restarts Node.js if not responding
- Kills any LiteSpeed processes if they appear
- Logs all activity to `/tmp/backend-watchdog.log`

**Crontab entry (on server):**
```bash
* * * * * cd /home/corporate.akanhyd.com/backend && node watchdog.js >> /tmp/watchdog-cron.log 2>&1
```

## Verification Commands

```bash
# Check backend health
curl https://corporate.akanhyd.com/api/health | jq .

# Check Node.js process
ssh root@89.116.21.19 "ps aux | grep 'node.*server' | grep -v grep"

# Ensure LiteSpeed is not running
ssh root@89.116.21.19 "ps aux | grep -E 'openlitespeed|lshttpd' | grep -v grep"
# Should return: nothing

# Verify port 443 listener
ssh root@89.116.21.19 "lsof -i :443 | grep -E 'node|litespeed'"
# Should show: only node process

# Check watchdog logs
ssh root@89.116.21.19 "tail -20 /tmp/backend-watchdog.log"
```

## Incident Response

**If LiteSpeed reappears:**
```bash
ssh root@89.116.21.19 "fuser -9 -k 443/tcp && pkill -9 openlitespeed && pkill -9 lshttpd"
curl https://corporate.akanhyd.com/api/health | jq .
```

**If backend stops responding:**
```bash
# Watchdog should auto-restart within 1 minute
# Manual restart if needed:
ssh root@89.116.21.19 "cd /home/corporate.akanhyd.com/backend && nohup node server.js > /tmp/backend.log 2>&1 &"
```

## File Locations

| Component | Location |
|-----------|----------|
| Backend Server | `/home/corporate.akanhyd.com/backend/server.js` |
| Watchdog Script | `/home/corporate.akanhyd.com/backend/watchdog.js` |
| Backend Logs | `/tmp/backend.log` |
| Watchdog Logs | `/tmp/backend-watchdog.log` |
| LiteSpeed Binary | `/usr/local/lsws/bin/openlitespeed.disabled` |
| LiteSpeed Service | `/usr/lib/systemd/system/lsws.service` (disabled+masked) |

## Maintenance

- **Weekly:** Check watchdog logs for any restart events
- **Monthly:** Verify LiteSpeed binaries remain disabled
- **On Deploy:** Ensure watchdog still active after server restart

```bash
# Weekly health audit
ssh root@89.116.21.19 "echo '=== Backend ===' && ps aux | grep 'node.*server' | grep -v grep && echo '=== No LiteSpeed ===' && (ps aux | grep -E 'openlitespeed|lshttpd' | grep -v grep || echo 'Clean') && echo '=== Recent Watchdog ===' && tail -3 /tmp/backend-watchdog.log"
```
