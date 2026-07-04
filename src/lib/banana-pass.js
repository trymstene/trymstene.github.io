// THE BANANA PASS — the persistent self (Phase 1: local-first; the passkey
// sync backbone arrives in Phase 2 and carries this exact blob).
//
// Everything is localStorage on existing event hooks: no accounts, no PII,
// no server. Patches are minted once and celebrated with a toast; stats are
// gentle counters. CLIENT-ONLY module.
import { PATCHES, OG_CUTOFF } from './pass-defs.js';

const KEY = 'pass-v1';

function read() {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (p && typeof p === 'object') return { created: p.created || Date.now(), patches: p.patches || {}, stats: p.stats || {}, days: p.days || [] };
  } catch (e) {}
  return { created: Date.now(), patches: {}, stats: {}, days: [] };
}
function write(p) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) {}
}

export function passGet() { return read(); }

// mint a patch (once). Returns true only the FIRST time — callers can skip
// their own celebration; we toast here so every surface behaves the same.
export function passPatch(id, opts = {}) {
  if (!PATCHES.some((d) => d.id === id)) return false;
  const p = read();
  if (p.patches[id]) return false;
  p.patches[id] = Date.now();
  write(p);
  const def = PATCHES.find((d) => d.id === id);
  if (!opts.quiet) passToast('🎖 <b>PATCH EARNED: ' + def.title + '</b><br>It’s pinned to <a href="/pass/">your banana pass</a>.');
  if (window.gtag) window.gtag('event', 'patch_earn', { patch: id });
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
