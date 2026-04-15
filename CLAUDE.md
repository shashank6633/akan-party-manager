# AKAN Party Manager — Claude Project Rules

## 🚨 DEPLOY RULES — NEVER VIOLATE

When the user asks to "deploy to GitHub and Production" (or any variation):

### 1. NEVER delete `backend/watchdog.js`
- It is the only thing that auto-recovers production when node or OpenLiteSpeed dies.
- It must exist **both locally and on the server** at `/home/corporate.akanhyd.com/backend/watchdog.js`.
- The deploy script (`deploy-production.sh`) already has `--exclude 'watchdog.js'` on the rsync — keep that flag.
- If you rewrite the deploy script, the exclude MUST remain.
- If `watchdog.js` is ever missing locally, restore it before deploying (see commit `eb1c30c` for reference content).

### 2. NEVER change ports in `backend/server.js`
- Node backend must continue to listen on `PORT` from `.env` (currently **5001**).
- OpenLiteSpeed reverse-proxies `443 → 5001` on the server.
- Do not "simplify" by moving node to 443 or 80. Do not add HTTPS listeners in `server.js`.
- Do not change the `const PORT = process.env.PORT || 5000;` fallback.

## Production infrastructure (for context)

| Component | Where |
|-----------|-------|
| Server | `root@89.116.21.19` (Hostinger VPS) |
| Domain | `corporate.akanhyd.com` |
| Server path | `/home/corporate.akanhyd.com/` |
| Web server | OpenLiteSpeed on `:80` + `:443` |
| Node backend | `nohup node server.js` on `:5001` |
| Watchdog | cron `* * * * *` runs `backend/watchdog.js` |
| Watchdog log | `/tmp/backend-watchdog.log` |
| Backend log | `/tmp/backend.log` |

## Deploy checklist

Before running `./deploy-production.sh`, verify:
- [ ] `backend/watchdog.js` exists locally
- [ ] `backend/server.js` still uses `PORT = process.env.PORT || 5000`
- [ ] `.env` on server has `PORT=5001` (don't touch it — deploy excludes `.env`)
- [ ] Rsync line still includes `--exclude 'watchdog.js'` and `--exclude '.env'`

After deploy:
- [ ] `curl https://corporate.akanhyd.com/api/health` returns `success:true`
- [ ] `ss -tlnH sport = :443` shows openlitespeed listening
- [ ] `ss -tlnH sport = :5001` shows node listening
