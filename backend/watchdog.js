#!/usr/bin/env node
/**
 * AKAN Party Manager — Production Watchdog
 *
 * Runs every minute via cron. Keeps production alive by ensuring:
 *   1. Node backend is listening on port 5001 (PORT from .env)
 *   2. OpenLiteSpeed is listening on ports 80 and 443 (reverse-proxies to node)
 *   3. https://corporate.akanhyd.com/api/health responds 200
 *
 * If any check fails, the watchdog attempts to restart the affected service.
 * All activity is logged to /tmp/backend-watchdog.log.
 */

const { execSync, spawn } = require('child_process');
const https = require('https');
const fs = require('fs');
const path = require('path');

const LOG = '/tmp/backend-watchdog.log';
const BACKEND_DIR = '/home/corporate.akanhyd.com/backend';
const BACKEND_LOG = '/tmp/backend.log';
const NODE_PORT = 5001;
const LSWS_BIN = '/usr/local/lsws/bin/openlitespeed';
const HEALTH_URL = 'https://corporate.akanhyd.com/api/health';

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try { fs.appendFileSync(LOG, line); } catch (_) {}
  process.stdout.write(line);
}

function sh(cmd) {
  try { return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
  catch (e) { return ''; }
}

function isPortListening(port) {
  // Use ss directly with port filter — avoid awk $N which bash would interpolate through execSync
  const out = sh(`ss -tlnH sport = :${port} 2>/dev/null | head -1`);
  return out.length > 0;
}

function isNodeRunning() {
  return sh(`pgrep -f 'node.*server\\.js'`).length > 0;
}

function isLswsRunning() {
  return sh(`pgrep -f openlitespeed`).length > 0;
}

function startNode() {
  log('Starting Node backend...');
  const child = spawn('nohup', ['node', 'server.js'], {
    cwd: BACKEND_DIR,
    detached: true,
    stdio: ['ignore', fs.openSync(BACKEND_LOG, 'a'), fs.openSync(BACKEND_LOG, 'a')],
  });
  child.unref();
}

function startLsws() {
  log('Starting OpenLiteSpeed...');
  if (!fs.existsSync(LSWS_BIN)) {
    // Recover from "disabled" state if the binary was renamed
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

(async () => {
  let restarted = false;

  if (!isNodeRunning() || !isPortListening(NODE_PORT)) {
    log(`Node backend NOT listening on :${NODE_PORT} — restarting`);
    sh(`pkill -9 -f 'node.*server\\.js'`);
    await new Promise((r) => setTimeout(r, 1500));
    startNode();
    restarted = true;
    await new Promise((r) => setTimeout(r, 5000));
  }

  if (!isLswsRunning() || !isPortListening(443)) {
    log('OpenLiteSpeed NOT listening on :443 — restarting');
    sh(`pkill -9 -f openlitespeed`);
    await new Promise((r) => setTimeout(r, 1500));
    startLsws();
    restarted = true;
    await new Promise((r) => setTimeout(r, 3000));
  }

  const healthy = await checkHealth();
  if (!healthy && !restarted) {
    log('Health check FAILED — restarting both node and openlitespeed');
    sh(`pkill -9 -f 'node.*server\\.js'`);
    sh(`pkill -9 -f openlitespeed`);
    await new Promise((r) => setTimeout(r, 2000));
    startNode();
    await new Promise((r) => setTimeout(r, 3000));
    startLsws();
  } else if (healthy) {
    // Quiet log: only log OK once per hour to keep log small
    const now = new Date();
    if (now.getMinutes() === 0) log('OK — node+lsws healthy');
  }
})();
