// THE BANANA PASS — the persistent self (Phase 1: local-first; the passkey
// sync backbone arrives in Phase 2 and carries this exact blob).
//
// Everything is localStorage on existing event hooks: no accounts, no PII,
// no server. Patches are minted once and celebrated with a toast; stats are
// gentle counters. CLIENT-ONLY module.
import { PATCHES, OG_CUTOFF } from './pass-defs.js';

const KEY = 'pass-v1';
export const PASS_API = 'https://banana-pass.trymstene.workers.dev';

function read() {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (p && typeof p === 'object') return { created: p.created || Date.now(), patches: p.patches || {}, stats: p.stats || {}, days: p.days || [] };
  } catch (e) {}
  return { created: Date.now(), patches: {}, stats: {}, days: [] };
}
function write(p) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) {}
  schedulePush();
}

export function passGet() { return read(); }

// ---- sync push (Phase 2) ----------------------------------------------
// If this device is linked to a passkey (pass-sync.js stores 'pass-link'),
// every pass write quietly pushes the whole world after a 10s debounce.
// The worker merges (union/max), so pushes can never lose remote progress.
export function collectBlob() {
  const g = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  let shelf = [];
  let bbLast = null;
  try { shelf = JSON.parse(g('shelf-v1') || '[]'); } catch (e) {}
  try { bbLast = JSON.parse(g('bb-last') || 'null'); } catch (e) {}
  return { pass: read(), shelf, bbLast, glow: g('rv-glowstick') === '1' ? '1' : '' };
}

let pushT = null;
function schedulePush() {
  let link = null;
  try { link = JSON.parse(localStorage.getItem('pass-link') || 'null'); } catch (e) {}
  if (!link || !link.credId || !link.token) return;
  clearTimeout(pushT);
  pushT = setTimeout(() => {
    fetch(PASS_API + '/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credId: link.credId, token: link.token, blob: collectBlob() }),
    }).catch(() => {});
  }, 10000);
}

// nudge a sync push without touching the pass — for writes that live OUTSIDE
// pass-v1 but ride the blob (the gear toggle writes bb-last)
export function passPush() { schedulePush(); }

// merge a synced blob INTO this device's localStorage (union/max — the same
// semantics as the worker, so order never matters). Lives HERE (not in
// pass-sync.js) so the ambient pull below avoids a circular import.
export function applyBlob(blob) {
  if (!blob) return;
  try {
    const local = collectBlob();
    const patches = { ...(local.pass.patches || {}) };
    for (const [id, ts] of Object.entries((blob.pass && blob.pass.patches) || {})) patches[id] = Math.min(patches[id] || ts, ts);
    const stats = { ...(local.pass.stats || {}) };
    for (const [k, v] of Object.entries((blob.pass && blob.pass.stats) || {})) stats[k] = Math.max(stats[k] || 0, v);
    const days = [...new Set([...(local.pass.days || []), ...((blob.pass && blob.pass.days) || [])])].sort().slice(-400);
    localStorage.setItem('pass-v1', JSON.stringify({
      created: Math.min(local.pass.created || Date.now(), (blob.pass && blob.pass.created) || Date.now()),
      patches, stats, days,
    }));
    const seen = new Set();
    const shelf = [...(blob.shelf || []), ...(local.shelf || [])]
      .filter((c) => c && c.params && !seen.has(c.params) && seen.add(c.params))
      .slice(0, 24);
    localStorage.setItem('shelf-v1', JSON.stringify(shelf));
    if (!local.bbLast && blob.bbLast) localStorage.setItem('bb-last', JSON.stringify(blob.bbLast));
    if (blob.glow === '1') localStorage.setItem('rv-glowstick', '1');
    try { document.dispatchEvent(new CustomEvent('pass:change')); } catch (e) {}
  } catch (e) {}
}

// AMBIENT PULL (12 Jul — Trym's badge dot showed 9 on the laptop, 13 on the
// phone): earned badges used to converge only on /pass/ visits. Now any page
// that loads this module pulls the synced blob when linked, at most every
// 10 minutes — the nav dot converges within a page-view.
(() => {
  try {
    const link = JSON.parse(localStorage.getItem('pass-link') || 'null');
    if (!link || !link.credId || !link.token) return;
    const last = parseInt(localStorage.getItem('pass-pull-at') || '0', 10) || 0;
    if (Date.now() - last < 600000) return;
    localStorage.setItem('pass-pull-at', String(Date.now()));
    fetch(PASS_API + `/pull?credId=${encodeURIComponent(link.credId)}&token=${encodeURIComponent(link.token)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && d.blob) applyBlob(d.blob); })
      .catch(() => {});
  } catch (e) {}
})();

// mint a patch (once). Returns true only the FIRST time — callers can skip
// their own celebration; we toast here so every surface behaves the same.
export function passPatch(id, opts = {}) {
  if (!PATCHES.some((d) => d.id === id)) return false;
  const p = read();
  if (p.patches[id]) return false;
  p.patches[id] = Date.now();
  write(p);
  const def = PATCHES.find((d) => d.id === id);
  // players read "badge"; the code keeps saying patch (the JELLY precedent —
  // ids, storage and GA events never rename)
  if (!opts.quiet) passToast('🎖 <b>' + def.title + '</b> — <a href="/pass/">badge on your pass</a>');
  if (window.gtag) window.gtag('event', 'patch_earn', { patch: id });
  // pop the nav's badge-notification dot live (rendered by main.js)
  try { document.dispatchEvent(new CustomEvent('pass:change')); } catch (e) {}
  return true;
}

export function passStat(key, delta = 1) {
  const p = read();
  p.stats[key] = (p.stats[key] || 0) + delta;
  write(p);
  return p.stats[key];
}

// call once per page that counts as "being here" — tracks distinct days,
// mints The Regular at five, and OG before the launch cutoff
export function passVisit() {
  const p = read();
  const today = new Date().toISOString().slice(0, 10);
  if (!p.days.includes(today)) {
    p.days.push(today);
    if (p.days.length > 400) p.days = p.days.slice(-400);
    write(p);
  }
  if (p.days.length >= 5) passPatch('regular');
  if (today < OG_CUTOFF) passPatch('og', { quiet: true }); // quietly — it's a surprise for later
}

// the one toast pattern for pass moments, shared by every page
let toastT = null;
export function passToast(html, ms = 7000) {
  let t = document.getElementById('passToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'passToast';
    t.className = 'pass-toast';
    document.body.appendChild(t);
  }
  t.innerHTML = html;
  t.classList.add('pass-toast--show');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('pass-toast--show'), ms);
}
