// google cloud ip ranges: live fetch -> local cache -> bundled snapshot
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const GCP_URL = 'https://www.gstatic.com/ipranges/cloud.json';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SNAPSHOT = path.join(HERE, 'data', 'gcp-snapshot.json');

function pickScopes(data, wanted) {
  const out = {};
  for (const prefix of data.prefixes ?? []) {
    const scope = prefix.scope;
    if (!wanted.includes(scope)) continue;
    const cidr = prefix.ipv4Prefix ?? prefix.ipv6Prefix;
    if (!cidr) continue;
    (out[scope] ??= []).push(cidr);
  }
  return out;
}

/**
 * @param {string[]} scopes needed gcp scope names
 * @param {string} cachePath where a fresh copy may be stored
 * @returns {Promise<{scopes: Record<string,string[]>, source: 'live'|'cache'|'snapshot', version?: string}>}
 */
export async function loadGcp(scopes, cachePath) {
  try {
    const res = await fetch(GCP_URL, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`http ${res.status}`);
    const data = await res.json();
    const picked = pickScopes(data, scopes);
    if (Object.keys(picked).length === 0) throw new Error('scopes missing in live data');
    writeFile(cachePath, JSON.stringify(data)).catch(() => {});
    return { scopes: picked, source: 'live', version: data.version };
  } catch {
    // fall back to cache, then to the snapshot bundled with the repo
    for (const [file, source] of [
      [cachePath, 'cache'],
      [SNAPSHOT, 'snapshot'],
    ]) {
      try {
        const data = JSON.parse(await readFile(file, 'utf8'));
        const picked = pickScopes(data, scopes);
        if (Object.keys(picked).length > 0) {
          return { scopes: picked, source, version: data.version };
        }
      } catch {
        // try next source
      }
    }
    return { scopes: {}, source: 'none' };
  }
}
