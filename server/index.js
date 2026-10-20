#!/usr/bin/env node
// cuteserverblocker ~ a cutesy server selector for overwatch 2
// serves a local web ui and manages outbound windows firewall rules.

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { createReadStream, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

import { regions, cidrsFor } from './data/regions.js';
import { loadGcp } from './gcp.js';
import { state, save, isBlocked, setBlocked, unblockAll, configDir } from './state.js';
import { pingAll, enableDemo } from './ping.js';
import { createFirewall, syncAll } from './firewall/index.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(HERE, '..', 'public');
const SCRIPT = path.join(HERE, 'index.js');

// ---------- cli ----------

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const value = (name, fallback) => {
  const i = argv.indexOf(name);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
};

const PORT = Number(value('--port', process.env.PORT ?? 7331));
const DRY_RUN = flag('--dry-run') || process.env.DRY_RUN === '1';
const DEMO_PINGS = flag('--demo-pings') || process.env.DEMO_PINGS === '1';
const NO_OPEN = flag('--no-open') || process.env.NO_OPEN === '1' || process.env.CI === 'true';

if (DEMO_PINGS) enableDemo();

// ---------- boot ----------

const pkg = JSON.parse(await readFile(path.join(HERE, '..', 'package.json'), 'utf8'));

const wantedScopes = [...new Set(regions.map((r) => r.gcpScope).filter(Boolean))];
const gcp = await loadGcp(wantedScopes, path.join(configDir(), 'gcp-cloud.json'));

const firewall = await createFirewall({ dryRun: DRY_RUN });
let syncErrors = [];

console.log('');
console.log('  (=^･ω･^=)  cute server blocker v' + pkg.version);
console.log('  ──────────────────────────────────────────');
console.log(`   mode      ${firewall.mode}${DRY_RUN ? ' (forced)' : process.platform !== 'win32' ? ' (non-windows host)' : ''}`);
console.log(`   admin     ${firewall.isAdmin ? 'yes ♡' : 'no  → windows will ask for elevation'}`);
console.log(`   gcp ips   ${gcp.source}${gcp.version ? ` (${gcp.version})` : ''}`);
console.log(`   pings     ${DEMO_PINGS ? 'demo (simulated)' : 'live (system ping)'}`);
console.log(`   config    ${configDir()}`);
syncErrors = await syncAll(firewall, regions, (r) => cidrsFor(r, gcp.scopes), state.blocked);
for (const e of syncErrors) console.log(`   ! could not sync ${e.token}: ${e.message}`);
console.log(`   ui        http://127.0.0.1:${PORT}`);
console.log('');

// ---------- helpers ----------

async function regionPayload() {
  const pings = await pingAll(regions.map((r) => r.ping));
  return regions.map((r) => ({
    token: r.token,
    title: r.title,
    flag: r.flag,
    pingTarget: r.ping,
    ranges: cidrsFor(r, gcp.scopes).length,
    blocked: isBlocked(r.token),
    pingMs: pings[r.ping] ?? null,
  }));
}

function json(res, code, body) {
  const data = JSON.stringify(body);
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(data);
}

function readBody(req) {
  return new Promise((resolve) => {
    let buf = '';
    req.on('data', (c) => {
      buf += c;
      if (buf.length > 16_384) req.destroy();
    });
    req.on('end', () => {
      try {
        resolve(buf ? JSON.parse(buf) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
};

function serveStatic(req, res, urlPath) {
  const rel = urlPath === '/' ? 'index.html' : decodeURIComponent(urlPath.slice(1));
  const file = path.normalize(path.join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC) || !existsSync(file)) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('nyaa~ 404 (ฅ•́ ﻌ •̀)ฅ');
    return;
  }
  res.writeHead(200, {
    'content-type': MIME[path.extname(file)] ?? 'application/octet-stream',
  });
  createReadStream(file).pipe(res);
}

// ---------- api ----------

async function handleApi(req, res, url) {
  const { pathname } = url;

  if (req.method === 'GET' && pathname === '/api/status') {
    return json(res, 200, {
      name: pkg.name,
      version: pkg.version,
      mode: firewall.mode,
      admin: firewall.isAdmin,
      canElevate: typeof firewall.elevate === 'function',
      onlyWhileOpen: state.onlyWhileOpen,
      demoPings: DEMO_PINGS,
      blockedCount: state.blocked.length,
      gcpSource: gcp.source,
      platform: process.platform,
      syncErrors,
    });
  }

  if (req.method === 'GET' && pathname === '/api/regions') {
    return json(res, 200, { regions: await regionPayload() });
  }

  if (
    (req.method === 'GET' || req.method === 'POST') &&
    pathname === '/api/ping'
  ) {
    const targets = await pingAll(regions.map((r) => r.ping), true);
    return json(res, 200, { pings: targets });
  }

  const blockMatch = pathname.match(/^\/api\/regions\/([a-z0-9]+)$/);
  if (req.method === 'POST' && blockMatch) {
    const token = blockMatch[1];
    const region = regions.find((r) => r.token === token);
    if (!region) return json(res, 404, { error: 'unknown region' });

    const body = await readBody(req);
    const want = Boolean(body.blocked);
    try {
      if (want) await firewall.apply(token, cidrsFor(region, gcp.scopes));
      else await firewall.remove(token);
      setBlocked(token, want);
      syncErrors = syncErrors.filter((e) => e.token !== token);
      return json(res, 200, { token, blocked: isBlocked(token) });
    } catch (err) {
      return json(res, 409, { error: err.message, token, blocked: isBlocked(token) });
    }
  }

  if (req.method === 'POST' && pathname === '/api/unblock-all') {
    const errors = await syncAll(firewall, regions, (r) => cidrsFor(r, gcp.scopes), []);
    if (errors.length) {
      return json(res, 409, { error: errors[0].message, errors });
    }
    unblockAll();
    syncErrors = [];
    return json(res, 200, { blocked: [] });
  }

  if (req.method === 'POST' && pathname === '/api/only-while-open') {
    const body = await readBody(req);
    state.onlyWhileOpen = Boolean(body.value);
    save();
    return json(res, 200, { onlyWhileOpen: state.onlyWhileOpen });
  }

  if (req.method === 'POST' && pathname === '/api/elevate') {
    if (!firewall.elevate) return json(res, 400, { error: 'not supported here' });
    try {
      await firewall.elevate({ port: PORT, script: SCRIPT });
      json(res, 200, { ok: true });
      // the elevated copy takes over the same port, so bow out
      setTimeout(() => process.exit(0), 600);
    } catch (err) {
      json(res, 409, { error: err.message });
    }
    return;
  }

  return json(res, 404, { error: 'not found' });
}

// ---------- server ----------

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) await handleApi(req, res, url);
    else if (req.method === 'GET') serveStatic(req, res, url.pathname);
    else json(res, 405, { error: 'nope' });
  } catch (err) {
    console.error('request error:', err);
    if (!res.headersSent) json(res, 500, { error: 'oops' });
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`  (◕ᴗ◕✿) port ${PORT} is already in use — another kitty is running?`);
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, '127.0.0.1', () => {
  if (!NO_OPEN) openBrowser(`http://127.0.0.1:${PORT}`);
});

function openBrowser(target) {
  const [cmd, args] =
    process.platform === 'win32'
      ? ['cmd', ['/c', 'start', '', target]]
      : process.platform === 'darwin'
        ? ['open', [target]]
        : ['xdg-open', [target]];
  try {
    spawn(cmd, args, { detached: true, stdio: 'ignore' }).unref();
  } catch {
    // fine, the url is printed above
  }
}

// ---------- shutdown ----------

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n  (◕ᴗ◕✿) ${signal} ~ bye bye`);
  if (state.onlyWhileOpen) {
    console.log('  removing rules (only-while-open mode)...');
    await syncAll(firewall, regions, (r) => cidrsFor(r, gcp.scopes), []).catch(() => {});
  }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref();
}

process.on('SIGINT', () => shutdown('ctrl+c'));
process.on('SIGTERM', () => shutdown('sigterm'));
process.on('SIGHUP', () => shutdown('close'));
