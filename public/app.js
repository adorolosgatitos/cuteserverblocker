// cute server blocker ~ frontend

const $ = (sel, root = document) => root.querySelector(sel);

const grid = $('#grid');
const banners = $('#banners');
const modeChip = $('#modeChip');
const toasts = $('#toasts');
const blockedHint = $('#blockedHint');
const onlyWhileOpen = $('#onlyWhileOpen');

let status = null;
let regions = [];
let busy = new Set();

// ~~~~~ api ~~~~~

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'content-type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `http ${res.status}`);
  return data;
}

// ~~~~~ toasts ~~~~~

function toast(message, kind = '') {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = message;
  toasts.append(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 320);
  }, 3200);
}

// ~~~~~ ping faces ~~~~~

function pingInfo(ms) {
  if (ms == null) return { cls: 'none', face: '૮ ˶ᵔ ᵕ ᵔ˶ ა', word: 'nope' };
  if (ms <= 60) return { cls: 'good', face: 'ฅ=^･ω･^=ฅ', word: 'purrfect' };
  if (ms <= 120) return { cls: 'ok', face: 'ฅ^•ﻌ•^ฅ', word: 'fine' };
  if (ms <= 200) return { cls: 'meh', face: 'ฅ^•ω•ฅ', word: 'meh' };
  return { cls: 'none', face: 'ฅ^•ﻌ•ฅ', word: 'far' };
}

function pingText(ms) {
  const info = pingInfo(ms);
  return ms == null ? `${info.face} nope` : `${info.face} ${ms} ms`;
}

// ~~~~~ render ~~~~~

function cardHtml(r, i) {
  const info = pingInfo(r.pingMs);
  return `
    <article class="card ${r.blocked ? 'blocked' : ''}" data-token="${r.token}" style="animation-delay:${i * 40}ms">
      <div class="card-top">
        <span class="flag">${r.flag}</span>
        <span class="token">${r.token}</span>
        <span class="ping ${info.cls}" title="${info.word}">${pingText(r.pingMs)}</span>
      </div>
      <h2>${r.title}</h2>
      <p class="ranges">${r.ranges} ip range${r.ranges === 1 ? '' : 's'}${r.blocked ? ' · swatted' : ''}</p>
      <div class="card-bottom">
        <label class="switch">
          <input type="checkbox" ${r.blocked ? 'checked' : ''} aria-label="block ${r.title}" />
          <span class="track"><span class="knob">🐾</span></span>
        </label>
        <span class="switch-label">${r.blocked ? 'blocked! nyaa' : 'block me'}</span>
      </div>
      <span class="stamp">bapped ♡</span>
    </article>`;
}

function renderGrid() {
  grid.innerHTML = regions.map(cardHtml).join('');
  updateHint();
}

function updateHint() {
  const n = regions.filter((r) => r.blocked).length;
  blockedHint.textContent =
    n === 0 ? 'everything is open ♡' : `${n} server${n === 1 ? '' : 's'} bapped`;
}

function applyCardState(r) {
  const card = grid.querySelector(`[data-token="${r.token}"]`);
  if (!card) return;
  card.classList.toggle('blocked', r.blocked);
  card.querySelector('input[type=checkbox]').checked = r.blocked;
  card.querySelector('.switch-label').textContent = r.blocked ? 'blocked! nyaa' : 'block me';
  const ranges = card.querySelector('.ranges');
  ranges.innerHTML = `${r.ranges} ip range${r.ranges === 1 ? '' : 's'}${r.blocked ? ' · swatted' : ''}`;
  updateHint();
}

function updatePings() {
  for (const r of regions) {
    const card = grid.querySelector(`[data-token="${r.token}"]`);
    if (!card) continue;
    const chip = card.querySelector('.ping');
    const info = pingInfo(r.pingMs);
    chip.className = `ping ${info.cls}`;
    chip.textContent = pingText(r.pingMs);
    chip.title = info.word;
  }
}

// ~~~~~ banners & toolbar ~~~~~

function renderStatus() {
  modeChip.classList.remove('dry', 'warn');
  if (status.mode === 'dry-run') {
    modeChip.textContent = '🧪 dry-run mode';
    modeChip.classList.add('dry');
  } else if (status.admin) {
    modeChip.textContent = '🛡 firewall armed ♡';
  } else {
    modeChip.textContent = '⚠ needs admin';
    modeChip.classList.add('warn');
  }

  const list = [];
  if (status.mode === 'dry-run') {
    list.push(`
      <div class="banner info">
        <span>🧪</span>
        <span>dry-run mode — the kitty is only pretending to swat (dev build / non-windows host)</span>
      </div>`);
  }
  if (status.demoPings) {
    list.push(`
      <div class="banner info">
        <span>🎲</span>
        <span>demo pings — latencies are simulated (no real icmp in this environment)</span>
      </div>`);
  }
  if (status.mode === 'windows' && !status.admin && status.canElevate) {
    list.push(`
      <div class="banner warn">
        <span>😿</span>
        <span>windows won't let us touch the firewall without admin rights</span>
        <button class="btn-small" id="elevateBtn">restart as admin ♡</button>
      </div>`);
  }
  if (status.gcpSource === 'snapshot' || status.gcpSource === 'cache') {
    list.push(`
      <div class="banner info">
        <span>📦</span>
        <span>using ${status.gcpSource} google cloud ip list (offline)</span>
      </div>`);
  }
  if (status.syncErrors?.length) {
    list.push(`
      <div class="banner warn">
        <span>🙀</span>
        <span>${status.syncErrors.map((e) => `${e.token}: ${e.message}`).join(' · ')}</span>
      </div>`);
  }
  banners.innerHTML = list.join('');

  const elevateBtn = $('#elevateBtn');
  if (elevateBtn) elevateBtn.addEventListener('click', elevate);

  onlyWhileOpen.checked = Boolean(status.onlyWhileOpen);
}

async function elevate() {
  try {
    toast('say yes to the uac window ♡ reloading…', 'good');
    await api('/api/elevate', { method: 'POST', body: '{}' });
    setTimeout(() => location.reload(), 2500);
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ~~~~~ sparkles ~~~~~

function celebrate(card) {
  const knob = card.querySelector('.knob');
  const rect = knob.getBoundingClientRect();
  const glyphs = ['✦', '♡', '✿', '★', '🐾'];
  for (let i = 0; i < 10; i++) {
    const s = document.createElement('span');
    s.className = 'sparkle';
    s.textContent = glyphs[i % glyphs.length];
    s.style.left = `${rect.left + rect.width / 2}px`;
    s.style.top = `${rect.top + rect.height / 2}px`;
    s.style.setProperty('--dx', `${Math.random() * 150 - 75}px`);
    s.style.setProperty('--dy', `${-45 - Math.random() * 80}px`);
    s.style.animationDelay = `${i * 25}ms`;
    document.body.append(s);
    setTimeout(() => s.remove(), 1300);
  }
}

// ~~~~~ actions ~~~~~

async function toggle(r, want) {
  if (busy.has(r.token)) return;
  busy.add(r.token);
  const card = grid.querySelector(`[data-token="${r.token}"]`);
  const input = card?.querySelector('input[type=checkbox]');
  if (input) input.disabled = true;
  r.blocked = want;
  applyCardState(r);
  try {
    await api(`/api/regions/${r.token}`, {
      method: 'POST',
      body: JSON.stringify({ blocked: want }),
    });
    toast(
      want
        ? `nyaa~ ${r.title} has been bapped ฅ^•ω•^=ฅ`
        : `${r.title} is free again ♡ purrr`,
      'good',
    );
    if (want) celebrate(card);
  } catch (err) {
    r.blocked = !want;
    applyCardState(r);
    toast(`nya-o! ${err.message}`, 'error');
  } finally {
    if (input) input.disabled = false;
    busy.delete(r.token);
  }
}

async function refreshPings(silent = false) {
  try {
    const { pings } = await api('/api/ping');
    for (const r of regions) r.pingMs = pings[r.pingTarget] ?? null;
    updatePings();
    if (!silent) toast('lag re-checked ฅ^•ﻌ•^ฅ', 'good');
  } catch (err) {
    if (!silent) toast(`ping failed: ${err.message}`, 'error');
  }
}

// ~~~~~ events ~~~~~

grid.addEventListener('change', (e) => {
  const input = e.target.closest('input[type=checkbox]');
  if (!input) return;
  const card = input.closest('.card');
  const r = regions.find((x) => x.token === card?.dataset.token);
  if (!r) return;
  if (busy.has(r.token)) {
    input.checked = r.blocked; // busy: snap back to reality
    return;
  }
  toggle(r, input.checked);
});

$('#pingBtn').addEventListener('click', (e) => {
  const btn = e.currentTarget;
  btn.disabled = true;
  refreshPings().finally(() => {
    btn.disabled = false;
  });
});

$('#unbanBtn').addEventListener('click', async () => {
  if (!regions.some((r) => r.blocked)) return toast('nobody is blocked right now ♡');
  if (!confirm('let all the smol servers go? ฅ(>﹏<)ฅ')) return;
  try {
    await api('/api/unblock-all', { method: 'POST', body: '{}' });
    regions.forEach((r) => {
      r.blocked = false;
      applyCardState(r);
    });
    toast('everyone is free! purrr ♡', 'good');
  } catch (err) {
    toast(`nya-o! ${err.message}`, 'error');
  }
});

onlyWhileOpen.addEventListener('change', async (e) => {
  try {
    const { onlyWhileOpen: v } = await api('/api/only-while-open', {
      method: 'POST',
      body: JSON.stringify({ value: e.target.checked }),
    });
    e.target.checked = v;
    toast(v ? 'blocks will vanish when i close ♡' : 'blocks are permanent now', 'good');
  } catch (err) {
    e.target.checked = !e.target.checked;
    toast(err.message, 'error');
  }
});

// ~~~~~ background sky ~~~~~

function makeSky() {
  const sky = $('#sky');
  const glyphs = ['🐾', '♡', '✦', '🌸', '★'];
  for (let i = 0; i < 14; i++) {
    const s = document.createElement('span');
    s.textContent = glyphs[i % glyphs.length];
    s.style.left = `${Math.random() * 100}%`;
    s.style.animationDuration = `${14 + Math.random() * 16}s`;
    s.style.animationDelay = `${-Math.random() * 24}s`;
    s.style.fontSize = `${16 + Math.random() * 16}px`;
    s.style.setProperty('--r', `${Math.random() * 60 - 30}deg`);
    s.style.setProperty('--o', `${0.25 + Math.random() * 0.4}`);
    sky.append(s);
  }
}

// ~~~~~ boot ~~~~~

async function boot() {
  makeSky();
  try {
    status = await api('/api/status');
    renderStatus();
  } catch (err) {
    toast(`could not reach the backend: ${err.message}`, 'error');
  }
  try {
    const data = await api('/api/regions');
    regions = data.regions;
    renderGrid();
    refreshPings(true);
  } catch (err) {
    toast(`could not load regions: ${err.message}`, 'error');
  }

  setInterval(() => {
    if (document.visibilityState === 'visible') refreshPings(true);
  }, 45_000);
}

boot();
