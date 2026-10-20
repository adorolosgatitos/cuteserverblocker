// latency check per region: system ping first, tcp handshake as fallback
import { execFile } from 'node:child_process';
import net from 'node:net';

const TTL_MS = 30_000;
const cache = new Map(); // ip -> { ms, at }

// demo mode: simulated latencies for containers/sandboxes without real
// icmp (dev boxes, screenshots, ci) — stable base per ip + small jitter
let demo = false;
export function enableDemo() {
  demo = true;
}

function hashIp(ip) {
  let h = 0;
  for (const ch of ip) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

function demoValue(ip) {
  const base = 42 + (hashIp(ip) % 208); // 42..249, stable per target
  const jitter = Math.floor(Math.random() * 21) - 10; // ±10 on re-check
  return Math.max(18, base + jitter);
}

function systemPing(ip) {
  const args =
    process.platform === 'win32'
      ? ['-n', '1', '-w', '1500', ip]
      : ['-c', '1', '-W', '2', ip];
  return new Promise((resolve) => {
    execFile('ping', args, { timeout: 4000, windowsHide: true }, (err, stdout) => {
      if (err) return resolve(null);
      // matches "time=12ms", "Tiempo=12ms", "time=12 ms"
      const m = String(stdout).match(/(\d+(?:\.\d+)?)\s*ms/i);
      resolve(m ? Number(m[1]) : null);
    });
  });
}

function tcpPing(ip) {
  return new Promise((resolve) => {
    const start = Date.now();
    const sock = net.connect({ port: 443, host: ip, timeout: 1500 });
    const done = (ms) => {
      sock.destroy();
      resolve(ms);
    };
    sock.on('connect', () => done(Date.now() - start));
    sock.on('timeout', () => done(null));
    sock.on('error', () => done(null));
  });
}

async function measure(ip) {
  const ms = (await systemPing(ip)) ?? (await tcpPing(ip));
  return ms;
}

/** ping one region target, cached for 30s unless force */
export async function pingHost(ip, force = false) {
  if (demo) return demoValue(ip);
  const hit = cache.get(ip);
  if (!force && hit && Date.now() - hit.at < TTL_MS) return hit.ms;
  const ms = await measure(ip);
  cache.set(ip, { ms, at: Date.now() });
  return ms;
}

export async function pingAll(targets, force = false) {
  const entries = await Promise.all(
    targets.map(async (ip) => [ip, await pingHost(ip, force)]),
  );
  return Object.fromEntries(entries);
}
