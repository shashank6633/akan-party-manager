#!/usr/bin/env node
/**
 * AKAN Party Manager — Production Watchdog  (v2)
 *
 * Runs every minute via cron (`* * * * *`).
 * Keeps production alive by ensuring:
 *   1. Node backend is running and listening on port 5001
 *   2. OpenLiteSpeed is running and listening on port 443
 *   3. /api/health responds 200
 *
 * v2 fixes:
 *   - Lock file prevents overlapping watchdog runs (previous run taking >60s
 *     would cause a second cron invocation to start killing processes).
 *   - Grace period after starting a process: writes a timestamp to
 *     /tmp/watchdog-started-{service}. If the file is <90s old, skips the
 *     restart for that service — gives the process time to bind its port.
 *   - Prefers process check (pgrep) BEFORE port check. If the process is
 *     running but port isn't bound yet, it's probably still starting up.
 *   - Only pkill when process is confirmed dead OR when the grace period has
 *     expired AND the port is still not bound.
 */

const { execSync, spawn } = require('child_process');
const https = require('https');
const fs = require('fs');
const path = require('path');

const LOG = '/tmp/backend-watchdog.log';
const LOCK_FILE = '/tmp/watchdog.lock';
const BACKEND_DIR = '/home/corporate.akanhyd.com/backend';
const BACKEND_LOG = '/tmp/backend.log';
const NODE_PORT = 5001;
const LSWS_BIN = '/usr/local/lsws/bin/openlitespeed';
const HEALTH_URL = 'https://corporate.akanhyd.com/api/health';
const GRACE_SECS = 90; // seconds after start before we'd kill and restart again

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try { fs.appendFileSync(LOG, line); } catch (_) {}
  process.stdout.write(line);
}

// ---------------------------------------------------------------------------
// Lock — prevent two watchdog runs from overlapping
// ---------------------------------------------------------------------------
function acquireLock() {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      const stat = fs.statSync(LOCK_FILE);
      const ageSec = (Date.now() - stat.mtimeMs) / 1000;
      // Stale lock from a crashed run — remove if >120s old
      if (ageSec > 120) {
        fs.unlinkSync(LOCK_FILE);
      } else {
        return false; // another run is active
      }
    }
    fs.writeFileSync(LOCK_FILE, String(process.pid));
    return true;
  } catch (_) {
    return false;
  }
}

function releaseLock() {
  try { fs.unlinkSync(LOCK_FILE); } catch (_) {}
}

// ---------------------------------------------------------------------------
// Grace period helpers
// ---------------------------------------------------------------------------
function graceFile(service) {
  return `/tmp/watchdog-started-${service}`;
}

function isWithinGracePeriod(service) {
  try {
    const stat = fs.statSync(graceFile(service));
    return (Date.now() - stat.mtimeMs) / 1000 < GRACE_SECS;
  } catch (_) {
    return false;
  }
}

function markStarted(service) {
  try { fs.writeFileSync(graceFile(service), new Date().toISOString()); } catch (_) {}
}

// ---------------------------------------------------------------------------
// Shell + checks
// ---------------------------------------------------------------------------
function sh(cmd) {
  try { return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
  catch (_) { return ''; }
}

function isPortListening(port) {
  // ss lives in /usr/sbin which may not be in cron's PATH — use absolute path
  const out = sh(`/usr/sbin/ss -tlnH sport = :${port} 2>/dev/null | head -1`);
  return out.length > 0;
}

function isNodeProcessRunning() {
  return sh(`pgrep -f 'node.*server\\.js'`).length > 0;
}

function isLswsProcessRunning() {
  return sh(`pgrep -f 'lshttpd'`).length > 0;
}

function nodeProcessCount() {
  const out = sh(`pgrep -cf 'node.*server\\.js'`);
  return parseInt(out, 10) || 0;
}

function killDuplicateNodes() {
  // If more than 1 node server.js is running, kill all and start fresh
  const count = nodeProcessCount();
  if (count > 1) {
    log(`Found ${count} node processes — killing all to clean up`);
    sh(`pkill -9 -f 'node.*server\\.js'`);
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Start functions
// ---------------------------------------------------------------------------
function startNode() {
  log('Starting Node backend...');
  const child = spawn('nohup', ['node', 'server.js'], {
    cwd: BACKEND_DIR,
    detached: true,
    stdio: ['ignore', fs.openSync(BACKEND_LOG, 'a'), fs.openSync(BACKEND_LOG, 'a')],
  });
  child.unref();
  markStarted('node');
}

function startLsws() {
  log('Starting OpenLiteSpeed...');
  if (!fs.existsSync(LSWS_BIN)) {
    const disabled = LSWS_BIN + '.disabled';
    if (fs.existsSync(disabled)) {
      log(`Restoring ${disabled} → ${LSWS_BIN}`);
      sh(`cp ${disabled} ${LSWS_BIN} && chmod 755 ${LSWS_BIN}`);
    } else {
      log('ERROR: openlitespeed binary not found');
      return;
    }
  }
  sh(`chmod 755 /usr/local/lsws/bin`);
  sh(`${LSWS_BIN} 2>&1`);
  markStarted('lsws');
}

function checkHealth() {
  return new Promise((resolve) => {
    const req = https.get(HEALTH_URL, { timeout: 8000 }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve(res.statusCode === 200 && body.includes('"success":true')));
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
(async () => {
  if (!acquireLock()) {
    // Another watchdog run is still active — exit silently
    process.exit(0);
  }

  try {
    let restarted = false;

    // --- Node backend ---
    const nodeRunning = isNodeProcessRunning();
    const nodePort = isPortListening(NODE_PORT);

    // Clean up duplicate node processes first
    if (killDuplicateNodes()) {
      await new Promise((r) => setTimeout(r, 2000));
      startNode();
      restarted = true;
      await new Promise((r) => setTimeout(r, 5000));
    } else if (!nodeRunning) {
      // Process is completely dead — start it
      log(`Node process not found — starting`);
      startNode();
      restarted = true;
      await new Promise((r) => setTimeout(r, 5000));
    } else if (!nodePort) {
      // Process is running but port not bound
      if (isWithinGracePeriod('node')) {
        log('Node process running, port not yet bound — within grace period, skipping');
      } else {
        log(`Node process running but port ${NODE_PORT} not bound (grace expired) — restarting`);
        sh(`pkill -9 -f 'node.*server\\.js'`);
        await new Promise((r) => setTimeout(r, 2000));
        startNode();
        restarted = true;
        await new Promise((r) => setTimeout(r, 5000));
      }
    }

    // --- OpenLiteSpeed ---
    const lswsRunning = isLswsProcessRunning();
    const lswsPort = isPortListening(443);

    if (!lswsRunning && !lswsPort) {
      // Completely dead
      log('OpenLiteSpeed not running — starting');
      startLsws();
      restarted = true;
      await new Promise((r) => setTimeout(r, 3000));
    } else if (lswsRunning && !lswsPort) {
      if (isWithinGracePeriod('lsws')) {
        log('OpenLiteSpeed process running, port 443 not yet bound — within grace period, skipping');
      } else {
        log('OpenLiteSpeed process running but port 443 not bound (grace expired) — restarting');
        sh(`pkill -9 -f 'lshttpd'`);
        sh(`pkill -9 -f 'lscgid'`);
        await new Promise((r) => setTimeout(r, 2000));
        startLsws();
        restarted = true;
        await new Promise((r) => setTimeout(r, 3000));
      }
    }

    // --- Health check (only if we didn't already restart something) ---
    if (!restarted) {
      const healthy = await checkHealth();
      if (!healthy) {
        log('Health check FAILED — restarting node');
        sh(`pkill -9 -f 'node.*server\\.js'`);
        await new Promise((r) => setTimeout(r, 2000));
        startNode();
        await new Promise((r) => setTimeout(r, 5000));

        // Re-check: if still unhealthy, restart lsws too
        const retry = await checkHealth();
        if (!retry) {
          log('Health check still failing after node restart — restarting OpenLiteSpeed');
          sh(`pkill -9 -f 'lshttpd'`);
          sh(`pkill -9 -f 'lscgid'`);
          await new Promise((r) => setTimeout(r, 2000));
          startLsws();
        }
      } else {
        // Quiet log: only log OK once per hour
        const now = new Date();
        if (now.getMinutes() === 0) log('OK — all services healthy');
      }
    }
  } finally {
    releaseLock();
  }
})();
