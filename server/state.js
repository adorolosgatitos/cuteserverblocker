// tiny json state, stored where dropship stores its config: %appdata% on windows
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const APP = 'cuteserverblocker';

export function configDir() {
  const base =
    process.platform === 'win32'
      ? process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming')
      : process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config');
  return path.join(base, APP);
}

const FILE = path.join(configDir(), 'state.json');

const DEFAULTS = {
  blocked: [], // region tokens that are blocked
  onlyWhileOpen: false, // remove all rules again when the app closes
};

function load() {
  try {
    const data = JSON.parse(readFileSync(FILE, 'utf8'));
    return {
      blocked: Array.isArray(data.blocked) ? data.blocked : [],
      onlyWhileOpen: Boolean(data.onlyWhileOpen),
    };
  } catch {
    return { ...DEFAULTS, blocked: [] };
  }
}

export const state = load();

export function save() {
  try {
    mkdirSync(configDir(), { recursive: true });
    writeFileSync(FILE, JSON.stringify(state, null, 2));
  } catch (err) {
    console.error('could not save state:', err.message);
  }
}

export function isBlocked(token) {
  return state.blocked.includes(token);
}

export function setBlocked(token, blocked) {
  const has = state.blocked.includes(token);
  if (blocked && !has) state.blocked.push(token);
  if (!blocked && has) state.blocked = state.blocked.filter((t) => t !== token);
  save();
}

export function unblockAll() {
  state.blocked = [];
  save();
}
