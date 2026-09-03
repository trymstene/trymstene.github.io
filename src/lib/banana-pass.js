// THE BANANA PASS — the persistent self (Phase 1: local-first; the passkey
// sync backbone arrives in Phase 2 and carries this exact blob).
//
// Everything is localStorage on existing event hooks: no accounts, no PII,
// no server. Patches are minted once and celebrated with a toast; stats are
// gentle counters. CLIENT-ONLY module.
import { PATCHES, OG_CUTOFF } from './pass-defs.js';
import { worldSid } from './world.js';

const KEY = 'pass-v1';
export const PASS_API = 'https://banana-pass.trymstene.workers.dev';

// 💰 THE LEDGER. Stats used to be plain scalars merged with Math.max, which
// silently ATE progress: two devices playing inside one sync window kept the
// larger number, not the sum — 200 coins earned could land as 160, and a
// concurrent purchase could cost nothing. Counters now live in PER-DEVICE
// slots (`led[stat][device]`) that are summed on read; max-merging a slot is
// safe because only its own device ever writes it.
// ⚠️ SLOTS MUST STAY MONOTONIC — never write a negative delta (a later merge
// would restore the higher pre-refund value). Refunds go to passRefund().
// The old scalar stays as a FROZEN legacy floor, so no migration is needed and
// a device still running old code keeps working through the transition.
const DEV = () => { try { return String(worldSid() || 'dev').slice(0, 8); } catch (e) { return 'dev'; } };
const sumSlots = (o) => { let n = 0; for (const k in o) { const v = +o[k]; if (Number.isFinite(v)) n += v; } return n; };
// `base` is the frozen pre-ledger floor, `led` the per-device slots, and
// `stats` a DERIVED MIRROR of base+slots kept in storage so the many places
// that read pass-v1.stats directly (gear unlock gates, the builder, the pass
// page) keep working with no change and no under-reporting.
export function statTotal(raw, key) {
  if (!raw) return 0;
  const led = raw.led && raw.led[key];
  return (+(raw.base && raw.base[key]) || 0) + (led ? sumSlots(led) : 0);
}
function mirror(raw) {
  const stats = { ...raw.base };
  for (const k in raw.led) stats[k] = statTotal(raw, k);
  return stats;
}

function readRaw() {
  let p = null;
  try { p = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
  if (!p || typeof p !== 'object') return { created: Date.now(), patches: {}, stats: {}, base: {}, led: {}, days: [] };
  const led = (p.led && typeof p.led === 'object') ? p.led : {};
  // one-time freeze: a pass written before the ledger has no base, so its
  // scalars ARE the floor. Idempotent — it only ever runs while base is absent.
  let base = (p.base && typeof p.base === 'object') ? p.base : null;
  if (!base) base = { ...(p.stats || {}) };
  const raw = { created: p.created || Date.now(), patches: p.patches || {}, base, led, days: p.days || [], stats: {} };
  // ⚠️ a device still running pre-ledger code writes the MIRROR directly, so
  // anything above base+slots is real progress that has to be adopted
  for (const k in (p.stats || {})) {
    const implied = (+p.stats[k] || 0) - sumSlots(led[k] || {});
    if (implied > (+base[k] || 0)) base[k] = implied;
  }
  raw.stats = mirror(raw);
  return raw;
}
function read() {
  const raw = readRaw();
  return { created: raw.created, patches: raw.patches, stats: raw.stats, days: raw.days };
}
function writeRaw(raw) {
  raw.stats = mirror(raw);
  try { localStorage.setItem(KEY, JSON.stringify(raw)); } catch (e) {}
  schedulePush();
}
// ⚠️ stats/led are NEVER taken from the caller — read() hands out materialised
// totals, and writing those back would collapse the slots into the scalar and
// double-count on the next merge. Only patches/days/created ride this path.
function write(p) {
  const raw = readRaw();
  writeRaw({ created: p.created || raw.created, patches: p.patches || raw.patches, days: p.days || raw.days, base: raw.base, led: raw.led });
}

export function passGet() { return read(); }
export function passRaw() { return readRaw(); }

// ---- sync push (Phase 2) ----------------------------------------------
// If this device is linked to a passkey (pass-sync.js stores 'pass-link'),
// every pass write quietly pushes the whole world after a 10s debounce.
// The worker merges (union/max), so pushes can never lose remote progress.
export function collectBlob() {
  const g = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  let shelf = [];
  let bbLast = null;
  let shelfDel = {};
  try { shelf = JSON.parse(g('shelf-v1') || '[]'); } catch (e) {}
  try { bbLast = JSON.parse(g('bb-last') || 'null'); } catch (e) {}
  try { const d = JSON.parse(g('shelf-del-v1') || '{}'); if (d && typeof d === 'object') shelfDel = d; } catch (e) {}
  // ⏱ NAME + OUTFIT NEED A CLOCK. Both used to be "whoever has one wins",
  // which never converges: a rename never reached the other device and a
  // cleared name came straight back. The writers are spread over eight files,
  // so the clock is stamped HERE, the moment a change is first observed.
  const nameNow = (g('ps-name-v1') || '').slice(0, 24);
  const bbNow = g('bb-last') || '';
  return {
    pass: readRaw(),                      // ⚠️ RAW — materialised totals would double-count on merge
    shelf, shelfDel, bbLast,
    glow: g('rv-glowstick') === '1' ? '1' : '',
    name: nameNow, nameAt: stampClock('ps-name-seen', 'ps-name-at', nameNow),
    bbAt: stampClock('bb-seen', 'bb-at', bbNow),
    member: readMemberGrant(),            // 🎩 person-scoped, max(until)-merged
    ev: evRead().slice(0, 300), evDrop: evDropped, evDev: DEV(),   // 📜 the tape (stripped server-side, never stored in the blob)
  };
}

// a change-clock for values written elsewhere: stamp the first time we SEE a
// new value. A device that has never witnessed a change keeps clock 0, so a
// fresh install can never out-rank a real edit made on another device.
function stampClock(seenKey, atKey, cur) {
  let seen = null, at = 0;
  try { seen = localStorage.getItem(seenKey); at = +(localStorage.getItem(atKey) || 0) || 0; } catch (e) {}
  if (seen === null) { try { localStorage.setItem(seenKey, cur); } catch (e) {} return at; }
  if (seen !== cur) {
    at = Date.now();
    try { localStorage.setItem(seenKey, cur); localStorage.setItem(atKey, String(at)); } catch (e) {}
  }
  return at;
}

// 🪪 THE WORLD ID. The pass worker mints a stable per-PERSON id (an HMAC
// of the primary record's key — see worldGid there) and hands it back on every
// push and pull. We keep it so the walkable world can tell one PERSON apart
// from one BROWSER, which is what the garden always assumed it could do and
// never could. Cleared on logout by pass-sync.
// ⚠️ It is an identifier, not a credential — it proves nothing and gates
// nothing that matters. Ownership of a plot is not a secret.
export const GID_KEY = 'world-gid';
export const WT_KEY = 'world-wt';   // 🪪 its proof — see worldToken() in world.js
function keepGid(d, force) {
  try {
    if (d && typeof d.gid === 'string' && /^[a-f0-9]{8,32}$/.test(d.gid)) {
      localStorage.setItem(GID_KEY, d.gid);
    }
    if (d && typeof d.worldToken === 'string' && /^[a-f0-9]{16}\.\d+\.[a-f0-9,]*\.[a-f0-9]{64}$/.test(d.worldToken)) {
      localStorage.setItem(WT_KEY, d.worldToken);
    }
  } catch (e) {}
  walletKeep(d, force);   // 💰 the server wallet + the tape ids it has seen (a push ack is always the freshest)
  // 🎩 the signed member token (mirror of pass-sync.js keepGid — change both):
  // rooms present it so other players get to SEE the supporter hat
  try {
    if (d && typeof d.memberToken === 'string' && /^sup-t[123]\.\d+\.[a-f0-9]{64}$/.test(d.memberToken)) {
      localStorage.setItem('bb-mtok', d.memberToken);
    }
  } catch (e) {}
  return d;
}

let pushT = null, pushDue = 0, pushBound = false;
// a worker that is down or an address that is over its minute budget must not
// be asked again every 10 s by every open tab — that is how a throttle stays
// on. Each failure doubles the wait (30 s → 15 min, jittered), a success or a
// fresh answer clears it. A new write never collapses the wait back to 10 s.
let pushFail = 0, pushHold = 0;
function pushBackoff() {
  pushFail = Math.min(pushFail + 1, 6);
  pushHold = Date.now() + Math.round(Math.min(900000, 30000 * Math.pow(2, pushFail - 1)) * (0.75 + Math.random() * 0.5));
}
// ⚠️ A TRAILING DEBOUNCE ALONE UPLOADS NOTHING during real play: a busy rave
// session re-arms the 10s timer on every coin and never fires, then the tab
// closes and the whole session lives on one device only. So: a hard 60s
// ceiling from the first pending write, plus a flush when the page goes away.
function pushNow() {
  clearTimeout(pushT); pushT = null; pushDue = 0;
  let link = null;
  try { link = JSON.parse(localStorage.getItem('pass-link') || 'null'); } catch (e) {}
  if (!link || !link.credId || !link.token) return;
  const blob = collectBlob();
  const sent = new Set((blob.ev || []).map((e) => e.id));
  const body = JSON.stringify({ credId: link.credId, token: link.token, blob, nakAck: nakDone() });
  // sendBeacon survives the page going away; fetch is the everyday path
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden' && navigator.sendBeacon) {
    try { navigator.sendBeacon(PASS_API + '/push', new Blob([body], { type: 'application/json' })); return; } catch (e) {}
  }
  fetch(PASS_API + '/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })
    .then((r) => { if (r && r.ok) { pushFail = 0; pushHold = 0; return r.json(); } if (!r || r.status >= 500 || r.status === 429) { pushBackoff(); schedulePush(); } return null; })
    .then((d) => { if (d && d.ok) { keepGid(d, true); evDropped = 0; } else keepGid(d); })   // acked by `seen`, never by ok alone
    .catch(() => { pushBackoff(); schedulePush(); });   // a dropped connection tries again, each time later than the last
}
// 🫧 AN ANONYMOUS PASS AT THE FIRST MEANINGFUL WRITE. Every player gets a
// server-side home — and a world id + the token that proves it — the moment
// they earn or make something. Nothing on screen: no email, no passkey, no
// prompt. It makes ownership a PERSON from day one (a yard or a plot is keyed
// to the id, not the browser) and lets the world workers verify who is
// writing. ⚠️ It is NOT recovery: the credential lives in this browser like
// any device token. Only the email link survives a wipe, and that ask stays
// at the investment moment (banana-id). One try an hour when the worker is
// down, so a dead pass worker costs one call.
let anonP = null;
export function ensureAnon() {
  if (anonP) return anonP;
  let link = null;
  try { link = JSON.parse(localStorage.getItem('pass-link') || 'null'); } catch (e) {}
  if (link && link.credId && link.token) return Promise.resolve(true);
  try {
    if (+(localStorage.getItem('anon-try-at') || 0) > Date.now() - 3600000) return Promise.resolve(false);
    localStorage.setItem('anon-try-at', String(Date.now()));
  } catch (e) { return Promise.resolve(false); }
  anonP = fetch(PASS_API + '/anon', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blob: collectBlob() }),
  })
    .then((r) => (r && r.ok ? r.json() : null))
    .then((d) => {
      if (!d || !d.credId || !d.token) return false;
      let cur = null;
      try { cur = JSON.parse(localStorage.getItem('pass-link') || 'null'); } catch (e) {}
      if (cur && cur.credId && cur.token) return false;   // a real login landed meanwhile — it wins, the mint is dropped
      localStorage.setItem('pass-link', JSON.stringify({ credId: d.credId, token: d.token }));
      localStorage.removeItem('pass-pull-at');
      keepGid(d);
      try { document.dispatchEvent(new CustomEvent('pass:change')); } catch (e) {}
      if (window.gtag) window.gtag('event', 'pass_anon');
      return true;
    })
    .catch(() => false)
    .then((ok) => { anonP = null; return ok; });
  return anonP;
}
if (typeof document !== 'undefined') document.addEventListener('world:noid', () => { ensureAnon(); });
export const anonInFlight = () => anonP;   // a login entrance awaits this before reading the link

function schedulePush() {
  let link = null;
  try { link = JSON.parse(localStorage.getItem('pass-link') || 'null'); } catch (e) {}
  if (!link || !link.credId || !link.token) {
    // 🫧 the first write of an unlinked device mints its pass, then pushes
    ensureAnon().then((ok) => { if (ok) schedulePush(); });
    return;
  }
  const now = Date.now();
  if (!pushDue) pushDue = now + 60000;
  if (!pushBound && typeof document !== 'undefined') {
    pushBound = true;
    const flush = () => { if (pushT) pushNow(); };
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
    addEventListener('pagehide', flush);
  }
  clearTimeout(pushT);
  pushT = setTimeout(pushNow, Math.max(Math.max(0, Math.min(10000, pushDue - now)), pushHold ? pushHold - now : 0));
}

// nudge a sync push without touching the pass — for writes that live OUTSIDE
// pass-v1 but ride the blob (the gear toggle writes bb-last)
export function passPush() { schedulePush(); }
export function passFlush() { pushNow(); }   // 🎩 a purchase settles now, not in ten seconds

// merge a synced blob INTO this device's localStorage (union/max — the same
// semantics as the worker, so order never matters). Lives HERE (not in
// pass-sync.js) so the ambient pull below avoids a circular import.
export function applyBlob(blob) {
  if (!blob) return;
  try {
    const local = collectBlob();
    const patches = { ...(local.pass.patches || {}) };
    for (const [id, ts] of Object.entries((blob.pass && blob.pass.patches) || {})) patches[id] = Math.min(patches[id] || ts, ts);
    // the frozen legacy scalars still merge by max (a device on old code keeps
    // incrementing them); the per-device slots merge by max PER DEVICE, which
    // is lossless because a slot has exactly one writer
    const rp = (blob.pass) || {};
    const impliedBase = (pass) => {
      const b = { ...(pass.base || {}) };
      for (const k in (pass.stats || {})) {
        const imp = (+pass.stats[k] || 0) - sumSlots((pass.led || {})[k] || {});
        if (imp > (+b[k] || 0)) b[k] = imp;
      }
      return b;
    };
    // 🎩 stand ownership is server-authored: a LOCAL own_<stand id> entry has
    // no vote here unless its purchase is still in the outbox (pending); the
    // server's entries are adopted as they are. QA devices keep their ledger.
    const pendOwn = new Set(evRead().filter((e) => e.k === 'coins_spent' && e.i).map((e) => 'own_' + e.i));
    const authored = (k) => k.startsWith('own_') && OWN_IDS.includes(k.slice(4)) && !pendOwn.has(k) && !walletOff();
    const base = {};
    [impliedBase(local.pass || {}), impliedBase(rp)].forEach((src, idx) => {
      for (const [k, v] of Object.entries(src)) {
        if (idx === 0 && authored(k)) continue;
        base[k] = Math.max(base[k] || 0, +v || 0);
      }
    });
    const led = {};
    [(local.pass && local.pass.led) || {}, (blob.pass && blob.pass.led) || {}].forEach((src, idx) => {
      for (const [k, slots] of Object.entries(src)) {
        if (!slots || typeof slots !== 'object') continue;
        if (idx === 0 && authored(k)) continue;
        led[k] = led[k] || {};
        for (const [dev, v] of Object.entries(slots)) led[k][dev] = Math.max(led[k][dev] || 0, +v || 0);
      }
    });
    const merged = { base, led };
    const stats = {};
    for (const k of new Set([...Object.keys(base), ...Object.keys(led)])) stats[k] = statTotal(merged, k);
    const days = [...new Set([...(local.pass.days || []), ...((blob.pass && blob.pass.days) || [])])].sort().slice(-400);
    localStorage.setItem('pass-v1', JSON.stringify({
      created: Math.min(local.pass.created || Date.now(), (blob.pass && blob.pass.created) || Date.now()),
      patches, stats, base, led, days,
    }));
    // tombstones union (max ts) — a deleted shelf item stays deleted across
    // devices; keep the newest copy per params, minus anything tombstoned after
    // it was made (re-creating the same banana later beats its old tombstone)
    let delLocal = {};
    try { const d = JSON.parse(localStorage.getItem('shelf-del-v1') || '{}'); if (d && typeof d === 'object') delLocal = d; } catch (e) {}
    const del = { ...delLocal };
    for (const [k, ts] of Object.entries(blob.shelfDel || {})) del[k] = Math.max(del[k] || 0, ts);
    const byParams = new Map();
    for (const c of [...(blob.shelf || []), ...(local.shelf || [])]) {
      if (!c || !c.params) continue;
      const ex = byParams.get(c.params);
      if (!ex || (c.created || 0) > (ex.created || 0)) byParams.set(c.params, c);
    }
    const shelf = [...byParams.values()]
      .filter((c) => !(del[c.params] && (c.created || 0) <= del[c.params]))
      .sort((a, b) => (b.created || 0) - (a.created || 0))
      .slice(0, 24);
    localStorage.setItem('shelf-v1', JSON.stringify(shelf));
    localStorage.setItem('shelf-del-v1', JSON.stringify(Object.fromEntries(Object.entries(del).sort((a, b) => b[1] - a[1]).slice(0, 200))));
    // ⏱ newest edit wins, both directions — "only if we have none" left two
    // devices permanently disagreeing and made a cleared name immortal
    // 🎩 the person-scoped membership grant arrives with the blob — merge it
    // BEFORE the outfit lands, so a freshly-linked device of a live member
    // never mistakes the incoming hat for unlicensed gear
    try {
      const bm = blob.member;
      const cur = readMemberGrant();
      // adopt on a longer grant, OR a higher tier at the same until (a
      // prorated upgrade keeps the renewal date — rank must break the tie
      // both here and in worker-pass mergeBlob, or it can never propagate)
      if (bm && memberRankOf(bm.t) && Number.isFinite(+bm.until)
        && (+bm.until > ((cur || {}).until || 0)
          || (+bm.until === (cur || {}).until && memberRankOf(bm.t) > memberRankOf(cur.t)))) {
        localStorage.setItem('bb-member', JSON.stringify({ t: bm.t, until: +bm.until }));
      }
    } catch (e) {}
    const localBbAt = +(localStorage.getItem('bb-at') || 0) || 0;
    if (blob.bbLast && +(blob.bbAt || 0) > localBbAt) {
      const bb = JSON.stringify(blob.bbLast);
      localStorage.setItem('bb-last', bb);
      localStorage.setItem('bb-at', String(+blob.bbAt));
      localStorage.setItem('bb-seen', bb);
    } else if (!local.bbLast && blob.bbLast) {
      localStorage.setItem('bb-last', JSON.stringify(blob.bbLast));
    }
    sweepMemberGear();
    if (blob.glow === '1') localStorage.setItem('rv-glowstick', '1');
    const localNameAt = +(localStorage.getItem('ps-name-at') || 0) || 0;
    if (blob.name !== undefined && +(blob.nameAt || 0) > localNameAt) {
      const nm = String(blob.name || '').slice(0, 24);
      if (nm) localStorage.setItem('ps-name-v1', nm); else localStorage.removeItem('ps-name-v1');
      localStorage.setItem('ps-name-at', String(+blob.nameAt));
      localStorage.setItem('ps-name-seen', nm);
    } else if (blob.name && !localStorage.getItem('ps-name-v1')) {
      localStorage.setItem('ps-name-v1', String(blob.name).slice(0, 24));
    }
    try { document.dispatchEvent(new CustomEvent('pass:change')); } catch (e) {}
  } catch (e) {}
}

// AMBIENT PULL (12 Jul — Trym's badge dot showed 9 on the laptop, 13 on the
// phone): earned badges used to converge only on /pass/ visits. Now any page
// that loads this module pulls the synced blob when linked, at most every
// 10 minutes — the nav dot converges within a page-view.
// pullIfStale(maxAge): once at load (10 min), again when the tab comes back to
// the foreground (2 min), and on demand where a stale number would mislead —
// the stand's shelf, a stall — so a second device's spending is seen before
// the phone promises something the server will refuse
export function pullIfStale(maxAge = 600000) {
  try {
    const link = JSON.parse(localStorage.getItem('pass-link') || 'null');
    if (!link || !link.credId || !link.token) return Promise.resolve(false);
    const last = parseInt(localStorage.getItem('pass-pull-at') || '0', 10) || 0;
    if (Date.now() - last < maxAge) return Promise.resolve(false);
    localStorage.setItem('pass-pull-at', String(Date.now()));
    return fetch(PASS_API + `/pull?credId=${encodeURIComponent(link.credId)}&token=${encodeURIComponent(link.token)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && d.blob) applyBlob(d.blob); keepGid(d); return !!d; })
      .catch(() => false);
  } catch (e) { return Promise.resolve(false); }
}
pullIfStale();
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') pullIfStale(120000); });
}

// mint a patch (once). Returns true only the FIRST time — callers can skip
// their own celebration; we toast here so every surface behaves the same.
export function passPatch(id, opts = {}) {
  if (!PATCHES.some((d) => d.id === id)) return false;
  const p = read();
  if (p.patches[id]) return false;
  p.patches[id] = Date.now();
  write(p);
  evAdd('patch:' + id, 1);
  const def = PATCHES.find((d) => d.id === id);
  // players read "badge"; the code keeps saying patch (the JELLY precedent —
  // ids, storage and GA events never rename)
  if (!opts.quiet) passToast('🎖 <b>' + def.title + '</b> — <a href="/pass/">badge on your pass</a>');
  if (window.gtag) window.gtag('event', 'patch_earn', { patch: id });
  // pop the nav's badge-notification dot live (rendered by main.js)
  try { document.dispatchEvent(new CustomEvent('pass:change')); } catch (e) {}
  return true;
}

// 🎩 mirrored from src/data/wearables.js (member gear + grant check) — same
// budget seam as lvlOf below. Change both or neither.
// THE GRANT IS PERSON-SCOPED: 'bb-member' = {t, until-ms} rides the sync blob
// merged by max(until) — every device of the member agrees, and REVOCATION
// HAPPENS BY TIME (the grant just stops renewing), never by a negative delta
// or a removal. A device-local grant was the first design and it corrupted
// shared state: a grant-less linked device stripped the incoming outfit and
// re-exported it at the donor's clock, erasing a paying member's hat
// server-side (the pass-ledger max-merge lesson, again).
const MEMBER_TIER = { tophatblue: 'sup-t1', tophatsilver: 'sup-t2', tophatgold: 'sup-t3' };
const MEMBER_RANK = { 'sup-t1': 1, 'sup-t2': 2, 'sup-t3': 3 };
const MEMBER_GRACE = 72 * 3600 * 1000; // renewal lag must never strip a payer
const memberRankOf = (t) => (Object.prototype.hasOwnProperty.call(MEMBER_RANK, t) ? MEMBER_RANK[t] : 0);
function readMemberGrant() {
  try {
    const g = JSON.parse(localStorage.getItem('bb-member') || 'null');
    return (g && memberRankOf(g.t) && Number.isFinite(+g.until)) ? { t: g.t, until: +g.until } : null;
  } catch (e) { return null; }
}
function memberGearOk(id) {
  const need = MEMBER_TIER[id];
  if (!need) return true;
  const g = readMemberGrant();
  return !!(g && memberRankOf(g.t) >= MEMBER_RANK[need] && g.until + MEMBER_GRACE > Date.now());
}
// The ONE place a revoked hat comes off: rewrite the LOCAL bb-last (only when
// something actually fails the grant) and leave bb-seen alone — the next
// collectBlob then stamps a fresh clock, so the strip is an authored outfit
// change that propagates and WINS on every device. Never strip an INCOMING
// blob in place: persisting a strip at the donor's clock ties with the wearer's
// pushes and the server value flip-flops forever. Shelf thumbnails keep their
// snapshot (like a photo) — wearing and product doors are gated, display isn't.
function sweepMemberGear() {
  try {
    const o = JSON.parse(localStorage.getItem('bb-last') || 'null');
    if (!o || typeof o !== 'object') return;
    let dirty = false;
    const out = { ...o, extras: o.extras ? { ...o.extras } : o.extras };
    if (out.hat && !memberGearOk(out.hat)) { out.hat = 'none'; dirty = true; }
    if (out.glasses && !memberGearOk(out.glasses)) { out.glasses = 'none'; dirty = true; }
    if (out.extras) for (const k in out.extras) { if (!memberGearOk(k)) { delete out.extras[k]; dirty = true; } }
    if (dirty) localStorage.setItem('bb-last', JSON.stringify(out));
  } catch (e) {}
}

// ⚠️ mirrored from pass-defs.js (levelStep/levelFor). Importing that module
// here would drag the whole patch + gear catalog into every page that touches
// the pass, which is nearly all of them — the JS budget wins over DRY at this
// seam ([[banana-world-engineering]]). Change both or neither.
const lvlOf = (rep) => {
  let n = 1, c = 0;
  while (n < 99 && rep >= c + 150 + n * 45) { c += 150 + n * 45; n++; }
  return n;
};
const areaOf = () => {
  const p = (typeof location !== 'undefined' && location.pathname) || '';
  return p.indexOf('/rave') === 0 ? 'rave' : p.indexOf('/park') === 0 ? 'park'
    : p.indexOf('/beach') === 0 ? 'beach' : p.indexOf('/forge') === 0 ? 'forge'
    : p.indexOf('/homestead') === 0 ? 'homestead' : p.indexOf('/make-a-banana') === 0 ? 'builder'
    : p.indexOf('/pass') === 0 ? 'pass' : 'site';
};

// 📜 THE LEDGER TAPE (2 Sep 2026, slice 1 of the server-side ledger). Every
// stat write also drops a small event — key, delta, area, optional source —
// into an outbox that rides the next push. The pass worker keeps the last few
// hundred per player INSIDE the pass record (no extra storage calls), dedupes
// by id (a beacon push has no ack, so events can travel twice), and compares
// what this device's own slot moved against what its events explain: the
// DRIFT. Totals stay client-authoritative — this is the audit trail, not the
// wallet. Device-only key; pass-sync wipes it on an account switch.
const EV_KEY = 'pass-ev-v1', EV_CAP = 800;
// 💰 THE SERVER WALLET (slice 2). The pass worker keeps a balance built only
// from tape events it accepted, frozen at this player's own number on their
// first push after it shipped. It arrives as { bal, seq } with every pull/push
// answer, together with the tape ids the server has seen. coinsNow() shows
// that number PLUS what the outbox still holds, so a coin earned offline
// counts at once and the two agree the moment the push is acked. A spend the
// server refused simply never lands in `bal` — the overlay lets go of it when
// its event is acked, which is the honest moment. Cleared on logout/switch.
const WALLET_KEY = 'pass-wallet-v1';
// 📏 PER-AREA RULES (slice 3). The pass worker refuses a coin event that
// breaks its faucet's rule and hands back, with every answer, how much of
// each per-PERSON cap this player has used today (`rules`). ruleUsed() is
// that number plus what this device's outbox still holds for the same
// faucet — so a cap is a person's cap on every device, not a device's.
// 🧪 pass-wallet-off = a QA device: coins stay on the local ledger (the
// server refuses the 'qa' faucet and never counts them). Set by ?hstest=rich.
const RULES_KEY = 'pass-rules-v1', WALLET_OFF = 'pass-wallet-off';
// 🎩 STAND OWNERSHIP THROUGH AN ACCEPTED SPEND (slice 4). For these ids
// own_<id> is SERVER-authored: the spend row names the item (`i`), the pass
// worker prices it from the manifest, authors ownership only on an accepted
// spend, strips any client claim, and answers with `own` (what you hold) and
// `nak` (what it refused). The client stays optimistic: the hat is worn on
// the next frame and settles on the ack. Readers are untouched — they read
// pass-v1.stats, which reconcileOwn keeps equal to the server's word plus
// this device's still-pending purchases. QA devices (pass-wallet-off) keep
// their local ledger. ⚠️ GENERATED from src/data/wearables.js — never edit.
// OWN-IDS-START — GENERATED by tools/build-worker-allowlists.mjs (the stand ids
// whose ownership the pass worker authors). NEVER edit by hand.
const OWN_IDS = ['duckhat', 'melticecream', 'watermelonhat', 'buckethat', 'snailhat', 'squidhat', 'snorkelmask', 'flamingoring', 'medal', 'sockssandals', 'balloondog', 'potato', 'cactuspot'];
// OWN-IDS-END
const walletOff = () => { try { return sessionStorage.getItem(WALLET_OFF) === '1'; } catch (e) { return false; } };   // 🧪 per TAB: a one-off test URL never detaches a real device
export function ruleUsed(key) {
  let srv = null;
  try { srv = (JSON.parse(localStorage.getItem(RULES_KEY) || 'null') || {})[key] || null; } catch (e) {}
  const today = new Date().toISOString().slice(0, 10);
  let used = srv && srv.d === today ? +srv.used || 0 : 0;
  let total = srv ? +srv.total || 0 : 0;
  let n = srv ? +srv.n || 0 : 0;
  const [area, src] = String(key).split(':');
  for (const e of evRead()) {
    if (e.k === 'coins_earned' && e.a === area && e.s === src) { used += +e.d || 0; total += +e.d || 0; n++; }
  }
  return { used, total, n };
}
function walletRead() {
  try {
    const w = JSON.parse(localStorage.getItem(WALLET_KEY) || 'null');
    return w && Number.isFinite(+w.bal) ? { bal: +w.bal, seq: +w.seq || 0, at: +w.at || 0 } : null;
  } catch (e) { return null; }
}
// 🎩 the server's word on stand gear (`own`) becomes the local ledger's word:
// a base flag for every id it names, no local slot left behind; a local flag
// it does NOT name goes — unless its purchase is still in the outbox. Returns
// the ids that went (a forged flag, or a refused buy after its ack).
function reconcileOwn(d) {
  if (!Array.isArray(d.own) || walletOff() || !OWN_IDS.length) return [];
  const pend = new Set(evRead().filter((e) => e.k === 'coins_spent' && e.i).map((e) => 'own_' + e.i));
  const raw = readRaw();
  let dirty = false;
  const gone = [];
  for (const id of OWN_IDS) {
    const k = 'own_' + id;
    if (d.own.includes(id)) {
      if (!raw.base[k]) { raw.base[k] = 1; dirty = true; }
      if (raw.led[k]) { delete raw.led[k]; dirty = true; }
    } else if (!pend.has(k) && (raw.base[k] || raw.led[k])) {
      delete raw.base[k]; delete raw.led[k]; dirty = true; gone.push(id);
    }
  }
  if (dirty) writeRaw(raw);
  return gone;
}
// the by-id twin of sweepMemberGear: take these ids off the worn outfit
// (LOCAL bb-last only — the next collectBlob stamps a fresh authored clock)
function sweepStandGear(ids) {
  if (!ids.length) return false;
  try {
    const o = JSON.parse(localStorage.getItem('bb-last') || 'null');
    if (!o || typeof o !== 'object') return false;
    let dirty = false;
    const out = { ...o, extras: o.extras ? { ...o.extras } : o.extras };
    for (const id of ids) {
      if (out.hat === id) { out.hat = 'none'; dirty = true; }
      if (out.glasses === id) { out.glasses = 'none'; dirty = true; }
      if (out.extras && out.extras[id]) { delete out.extras[id]; dirty = true; }
    }
    if (dirty) localStorage.setItem('bb-last', JSON.stringify(out));
    return dirty;
  } catch (e) { return false; }
}
export function walletKeep(d, force) {
  if (!d || typeof d !== 'object') return;
  try {
    // ⏱ answers can arrive out of order: an older one (lower wallet seq) must
    // not delete a hat the newer one just confirmed. A push ack is always the
    // freshest (force) — it also wins over a forged local snapshot.
    const cur = walletRead();
    const seq = d.wallet && Number.isFinite(+d.wallet.bal) ? +d.wallet.seq || 0 : null;
    // an older answer (an ack that overtook a newer one) changes nothing — unless
    // the stored seq is absurdly ahead, which only a forged snapshot can be
    const forgedLocal = !!(cur && seq != null && cur.seq > seq + 100);
    if (cur && seq != null && seq < cur.seq && !forgedLocal) return;
    let balChanged = false;
    if (seq != null) { balChanged = !cur || cur.bal !== +d.wallet.bal; localStorage.setItem(WALLET_KEY, JSON.stringify({ bal: +d.wallet.bal, seq, at: Date.now() })); }
    // ids the tape already holds (a beacon push has no ack) leave the outbox now
    if (Array.isArray(d.seen) && d.seen.length) evAck(new Set(d.seen.map(String)));
    if (d.rules && typeof d.rules === 'object') localStorage.setItem(RULES_KEY, JSON.stringify(d.rules));   // 📏 the caps used
    // 🎩 after the seen-ack (so an answered purchase no longer counts as pending)
    const gone = reconcileOwn(d);
    // a duplicate buy refused as 'owned' is still owned — never take that one off
    const ownNow = Array.isArray(d.own) ? d.own.map(String) : [];
    const naksAll = (Array.isArray(d.nak) ? d.nak.filter((x) => x && typeof x === 'object') : []).filter((x) => !nakDone().includes(String(x.id || '')));
    // a refused STAND purchase undresses the banana; every other refusal is
    // handed to whichever surface can put things right (the stall returns
    // the eggs) — quietly, the number simply reads what the server holds
    const naks = naksAll.filter((x) => x.i && OWN_IDS.includes(String(x.i)) && !ownNow.includes(String(x.i)));
    const swept = sweepStandGear([...gone, ...naks.map((x) => String(x.i))]);
    for (const x of naksAll) {
      if (x.i && OWN_IDS.includes(String(x.i)) && ownNow.includes(String(x.i))) continue;   // a duplicate buy: still owned, nothing to say
      try { document.dispatchEvent(new CustomEvent('pass:refused', { detail: { id: String(x.id || ''), i: x.i ? String(x.i) : '', k: String(x.k || ''), d: +x.d || 0, r: String(x.r || ''), s: x.s ? String(x.s) : '' } })); } catch (e) {}
    }
    if (gone.length || swept || balChanged) { try { document.dispatchEvent(new CustomEvent('pass:change')); } catch (e) {} }
  } catch (e) {}
}
// 🧾 a refusal the player's surface actually put right (the stall handed the
// eggs back). Only a CLAIMED one is acked — the rest ride along until they age
// out of the record's ring, so whichever page opens next still hears them.
const NAK_KEY = 'pass-nak-v1';
function nakDone() {
  try { const a = JSON.parse(localStorage.getItem(NAK_KEY) || '[]'); return Array.isArray(a) ? a.map(String) : []; } catch (e) { return []; }
}
export function passNakDone(id) {
  const v = String(id || ''); if (!v) return;
  const a = nakDone(); if (a.includes(v)) return;
  a.push(v);
  try { localStorage.setItem(NAK_KEY, JSON.stringify(a.slice(-40))); } catch (e) {}
  schedulePush();
}
let evDropped = 0;
function evRead() {
  try { const a = JSON.parse(localStorage.getItem(EV_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; }
}
function evWrite(a) { try { localStorage.setItem(EV_KEY, JSON.stringify(a)); } catch (e) {} }
function evAdd(k, d, src, item) {
  const a = evRead();
  a.push({ id: Math.random().toString(16).slice(2, 10).padEnd(8, '0'), t: Date.now(), k, d, a: areaOf(),
    ...(src ? { s: String(src).slice(0, 32) } : {}), ...(item ? { i: String(item).slice(0, 40) } : {}) });
  if (a.length > EV_CAP) { evDropped += a.length - EV_CAP; a.splice(0, a.length - EV_CAP); }
  evWrite(a);
}
function evAck(ids) { if (ids && ids.size) evWrite(evRead().filter((e) => !ids.has(e.id))); }

// 🍳 THE KITCHEN'S REACH (Homestead M2): a cooked dish buffs the WHOLE world
// from this one crossing — every coin/rep grant in every area flows through
// passStat, so the multiplier lives here and nowhere else. Spends never double.
export function buffGet() {
  try {
    const b = JSON.parse(localStorage.getItem('hs-buff-v1') || 'null');
    if (b && b.until > Date.now()) return b;
  } catch (e) {}
  return null;
}
export function buffSet(fx, mins) {
  try {
    localStorage.setItem('hs-buff-v1', JSON.stringify({ fx, until: Date.now() + mins * 60000 }));
  } catch (e) {}
}

// 🌱 THE SEED POUCH (Trym: "plant on the bed myself, with seeds from the
// park"): park crop harvests pocket a seed, the homestead bed spends it.
// Same additive ledger shape as the wallet — blob stats merge by MAX, so
// both sides only ever increment and the pouch follows you across devices.
export function seedGain(crop) { return passStat('seedg_' + crop, 1); }
export function seedUse(crop) { return passStat('seedu_' + crop, 1); }
export function seedCount(crop) {
  const s = read().stats;
  return Math.max(0, (s['seedg_' + crop] || 0) - (s['seedu_' + crop] || 0));
}

export function passStat(key, delta = 1, src, item) {
  const b = (delta > 0 && (key === 'coins_earned' || key === 'rep')) ? buffGet() : null;
  if (b && ((key === 'coins_earned' && b.fx === 'coins2') || (key === 'rep' && b.fx === 'rep2'))) {
    delta *= 2;
  }
  const p = readRaw();
  const was = statTotal(p, key);
  p.base = p.base || {};
  // ⚠️ a negative delta would break slot monotonicity and could be undone by a
  // later max-merge. A spend refund has its own monotonic counter; anything
  // else negative is a caller bug and is refused rather than silently kept.
  if (delta < 0) {
    if (key === 'coins_spent') return passRefund(-delta);
    if (typeof console !== 'undefined') console.warn('passStat: negative delta refused for', key);
    return was;
  }
  p.led = p.led || {};
  p.led[key] = p.led[key] || {};
  const d = DEV();
  p.led[key][d] = (+p.led[key][d] || 0) + delta;
  writeRaw(p);
  evAdd(key, delta, src, item);   // 📜 the tape sees the delta the slot really moved (buff included)
  const now = statTotal(p, key);
  // 🎖 LEVELS HAPPEN EVERYWHERE, BUT ONLY THE RAVE EVER SAID SO. rep is a world
  // stat — the park waters it up, the beach digs it up — and every grant in
  // every area passes through here, so the crossing is caught once rather than
  // bolted onto each surface. Answers "does anyone level up in the park?",
  // which was previously unanswerable.
  // ⚠️ the rave ALSO fires its own older rave_levelup, so the two overlap on
  // the floor — world_levelup is the superset, never add them together.
  if (key === 'rep' && delta > 0 && typeof window !== 'undefined' && window.gtag) {
    const lv = lvlOf(now);
    if (lv > lvlOf(was)) window.gtag('event', 'world_levelup', { level: lv, where: areaOf() });
  }
  return now;   // the TRUE new total — callers must not re-derive it from the delta (the buff can double it)
}

// 💰 the only two ways money moves. passSpend refuses an overdraft instead of
// digging a hole the wallet reads as an empty purse (an overdrawn wallet used
// to silently swallow everything the player earned until it refilled).
export function passSpend(n, src, item) {
  const cost = Math.max(0, Math.round(+n || 0));
  if (!cost) return true;
  if (coinsNow() < cost) return false;
  passStat('coins_spent', cost, src, item);   // 🎩 `item` = the stand id this spend buys (judged server-side)
  return true;
}
export function passRefund(n, src) {
  const back = Math.max(0, Math.round(+n || 0));
  if (!back) return 0;
  return passStat('coins_refunded', back, src);
}
// the wallet, in the one place that owns the formula (world-hud re-exports it)
// 🍲 what a grant actually pays right now: the stew doubles every coins_earned
// on this device, so a toast that prints the nominal number lies by half
export const coinsPaid = (n) => { const b = buffGet(); return b && b.fx === 'coins2' ? n * 2 : n; };
export function coinsNow() {
  const raw = readRaw();
  const ledger = statTotal(raw, 'coins_earned') + statTotal(raw, 'coins_refunded') - statTotal(raw, 'coins_spent');
  const w = walletRead();
  if (!w || walletOff()) return ledger;   // no server number yet (or a QA device) — the ledger is the wallet
  let pend = 0;                      // what this device wrote since the server last answered
  for (const e of evRead()) {
    if (e.k === 'coins_earned' || e.k === 'coins_refunded') pend += +e.d || 0;
    else if (e.k === 'coins_spent') pend -= +e.d || 0;
  }
  return w.bal + pend;
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
  noticeMultiItem();
  noticeItemsWorkshopMove();
}

// 🧢 THE ONE FEATURE NOTICE. A visitor wrote in on 2 Aug asking to wear
// three community items at once; it shipped the same morning, and telling the
// people who asked is the whole point of having a timeline.
//
// ⚠️ BUT THE DOCTRINE BELOW SAYS NOTICES CARRY VALUE, NOT SYSTEM CHATTER — and
// a shipping announcement IS chatter to someone with nothing to wear. So it is
// GATED: only a banana that actually owns a community item ever sees it. For
// them it is not news about the site, it is news about something they own.
// Fires once, ever (fixed id), device-local like everything else here.
function ownsAnyCatalogItem() {
  try {
    const own = JSON.parse(localStorage.getItem('cat-own-v1') || '{}');
    if (own && typeof own === 'object' && Object.keys(own).length) return true;
  } catch (e) {}
  const st = read().stats || {};
  return Object.keys(st).some((k) => k.indexOf('own_c_') === 0 && st[k] > 0);
}

export function noticeMultiItem() {
  if (!ownsAnyCatalogItem()) return;
  passNoticeAdd({
    id: 'multi-item-2026-08',
    icon: '🧢',
    text: '<b>Your banana can wear more than one club item now.</b> Somebody wrote in and '
      + 'asked — so: one item per spot, so a hat and a jacket and boots all fit at once. '
      + 'Go and pile them on.',
    link: '/make-a-banana/',
  });
}

// 🔨 THE WORKSHOP MOVED (task #102, 3 Aug 2026). Same anti-fatigue gate as
// above: only someone who has actually MADE an item — a wearable on the shelf
// or a catalog submission — gets told the bench has its own address. Everyone
// else never had a workshop to lose. Old /forge/?shelf= links self-redirect.
function madeAnyItem() {
  try {
    const shelf = JSON.parse(localStorage.getItem('shelf-v1') || '[]');
    if (Array.isArray(shelf) && shelf.some((c) => c && c.kind === 'wearable')) return true;
  } catch (e) {}
  try {
    const subs = JSON.parse(localStorage.getItem('cat-subs-v1') || '[]');
    if (Array.isArray(subs) && subs.length) return true;
  } catch (e) {}
  return false;
}

export function noticeItemsWorkshopMove() {
  if (!madeAnyItem()) return;
  passNoticeAdd({
    id: 'items-workshop-move-2026-08',
    icon: '🔨',
    text: '<b>The Items Workshop has its own bench now.</b> It moved next door to '
      + '<b>/forge/items/</b> — same canvas, same banana, same submit-to-the-club. '
      + 'Your saved items open there automatically, and old links find their own way over.',
    link: '/forge/items/',
  });
}

// ---- WORLD NOTIFICATIONS — the pass page's tiny timeline ----------------
// Renamed from “Club notices” 2 Aug 2026: “club” is RAVE vocabulary, and the
// feed carries gallery verdicts, item approvals and world news — none of it
// the rave's. ⚠️ the storage key stays `ps-notices-v1`: renaming it would
// orphan every notice anyone is already holding.
// Anti-fatigue doctrine (Trym's): a notice must carry VALUE — verdicts on
// things YOU made, not system chatter. Device-local (like the pass itself);
// the nav's badge dot counts unread notices alongside unseen badges.
const NOTICE_KEY = 'ps-notices-v1';

export function passNotices() {
  try {
    const l = JSON.parse(localStorage.getItem(NOTICE_KEY) || '[]');
    return Array.isArray(l) ? l : [];
  } catch (e) { return []; }
}

export function passNoticeAdd(n) {
  const list = passNotices();
  if (n.id && list.some((x) => x.id === n.id)) return; // idempotent — polls can repeat
  list.unshift({ id: n.id || String(Date.now()), icon: n.icon || '🍌', text: n.text || '', link: n.link || '', at: Date.now(), read: false });
  try { localStorage.setItem(NOTICE_KEY, JSON.stringify(list.slice(0, 30))); } catch (e) {}
  try { document.dispatchEvent(new CustomEvent('pass:change')); } catch (e) {}
}

export function passNoticesMarkRead() {
  const list = passNotices();
  if (!list.some((x) => !x.read)) return;
  list.forEach((x) => { x.read = true; });
  try { localStorage.setItem(NOTICE_KEY, JSON.stringify(list)); } catch (e) {}
  try { document.dispatchEvent(new CustomEvent('pass:change')); } catch (e) {}
}

// ---- gallery submission verdicts -> notices -----------------------------
// The builder stores {sid, title, at} per submission in gal-subs-v1; here we
// ask worker-share's /gallery/status what happened and turn NEW verdicts
// into notices. Throttled + only runs when something is actually unresolved,
// so 99% of visitors never generate a request.
const SUBS_KEY = 'gal-subs-v1';
const SHARE_API = 'https://banana-share.trymstene.workers.dev';

export async function checkGalleryVerdicts(opts = {}) {
  let subs;
  try { subs = JSON.parse(localStorage.getItem(SUBS_KEY) || '[]'); } catch (e) { return; }
  if (!Array.isArray(subs)) return;
  const open = subs.filter((s) => s.status === 'pending' && Date.now() - s.at < 30 * 86400000);
  if (!open.length) return;
  try {
    const last = parseInt(localStorage.getItem('gal-check-at') || '0', 10) || 0;
    if (!opts.force && Date.now() - last < 6 * 3600000) return;
    localStorage.setItem('gal-check-at', String(Date.now()));
  } catch (e) {}
  try {
    const r = await fetch(SHARE_API + '/gallery/status?ids=' + open.map((s) => s.sid).join(','));
    if (!r.ok) return;
    const verdicts = await r.json();
    const esc = (t) => String(t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    let changed = false;
    for (const s of subs) {
      const v = verdicts[s.sid];
      if (!v || s.status !== 'pending') continue;
      s.status = v.s === 'ok' ? 'approved' : 'rejected';
      changed = true;
      const title = esc(s.title) || 'Your banana';
      if (v.s === 'ok') {
        passNoticeAdd({
          id: 'gal-' + s.sid,
          icon: '🖼',
          text: '<b>“' + title + '” made the gallery!</b> The banana guy hung it up — it has its own page now.',
          link: v.slug && /^[a-z0-9-]{1,80}$/.test(v.slug) ? '/banana-memes/by/' + v.slug + '/' : '/banana-memes/',
        });
        passPatch('exhibitor', { quiet: true }); // in case the submit-time mint was missed
      } else {
        passNoticeAdd({
          id: 'gal-' + s.sid,
          icon: '💌',
          text: '<b>“' + title + '”</b> didn’t make the wall this time — the banana guy hangs only a few. Dress up another and try again!',
          link: '/make-a-banana/',
        });
      }
    }
    if (changed) {
      try { localStorage.setItem(SUBS_KEY, JSON.stringify(subs.slice(0, 20))); } catch (e) {}
    }
  } catch (e) { /* offline is fine — next visit asks again */ }
}

// ---- 💬 replies from Trym -> notices -------------------------------------
// Mailing Banana HQ with a pass attached sets bm-mailed-v1 on the device;
// ONLY those devices ever poll ($0 doctrine — 99% of visitors never ask).
// A reply lands as a "Message from Trym" world notification; the whole
// thread stays readable at HQ per pass id.
const CONTACT_API = 'https://banana-contact.trymstene.workers.dev';
// 🪪 the mailbox key was stamped AT SEND TIME, so someone who mailed
// anonymously and minted a world-gid afterwards has the answer filed under
// their old park-sid — poll that one too or the reply never arrives. The
// fallback is addressing only: park-sid stays a connection id, never identity.
const LEGACY_MAILBOX_KEY = 'bm-reply-legacy-v1';

export async function checkTrymReplies(opts = {}) {
  let mailedAt = 0, pass = '', legacy = '', legacyDone = false;
  try {
    mailedAt = parseInt(localStorage.getItem('bm-mailed-v1') || '0', 10) || 0;
    const gid = localStorage.getItem('world-gid') || '';
    const sid = localStorage.getItem('park-sid') || '';
    pass = gid || sid;
    legacy = gid && sid && sid !== gid ? sid : '';
    legacyDone = !!localStorage.getItem(LEGACY_MAILBOX_KEY);
  } catch (e) { return; }
  if (!pass || !mailedAt || Date.now() - mailedAt > 90 * 86400000) return;
  try {
    const last = parseInt(localStorage.getItem('bm-reply-check-at') || '0', 10) || 0;
    if (!opts.force && Date.now() - last < 6 * 3600000) return;
    localStorage.setItem('bm-reply-check-at', String(Date.now()));
  } catch (e) {}
  const esc = (t) => String(t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const notify = (replies) => {
    replies.forEach((rp) => {
      // the reply may land DAYS after the mail — quote what they wrote so
      // the answer stands on its own (Trym)
      const re = String(rp.re || '');
      const quote = re
        ? '<i>You wrote: “' + esc(re) + (re.length >= 300 ? '…' : '') + '”</i><br>' : '';
      passNoticeAdd({
        id: 'trym-' + rp.key, // key carries the mailbox id — the two never collide
        icon: '💬',
        text: '<b>Message from Trym</b><br>' + quote + esc(rp.text).replace(/\n/g, '<br>'),
        link: '/contact/',
      });
    });
  };
  const ask = async (id) => {
    const r = await fetch(CONTACT_API + '/replies?pass=' + encodeURIComponent(id));
    if (!r.ok) return null; // 💤 leave it for the next poll
    const j = await r.json();
    return Array.isArray(j) ? j : [];
  };
  try {
    const mine = await ask(pass);
    if (!mine) return;
    notify(mine);
    // /replies takes ONE id per call, so the old mailbox costs a second
    // request — only while the current one is still empty (a mailbox that has
    // ever answered never empties again), plus one lifetime backfill for
    // devices that got a gid-addressed reply before this shipped.
    if (legacy && (!mine.length || !legacyDone)) {
      const old = await ask(legacy);
      if (!old) return;
      notify(old);
      try { localStorage.setItem(LEGACY_MAILBOX_KEY, '1'); } catch (e) {}
    }
  } catch (e) { /* offline is fine — next visit asks again */ }
}

// ---- 🎁 item-catalog submission verdicts -> notices ---------------------
// The forge stores {sid, title, at} per club submission in cat-subs-v1; same
// throttled polling pattern as the gallery verdicts above.
const CAT_SUBS_KEY = 'cat-subs-v1';

export async function checkCatalogVerdicts(opts = {}) {
  let subs;
  try { subs = JSON.parse(localStorage.getItem(CAT_SUBS_KEY) || '[]'); } catch (e) { return; }
  if (!Array.isArray(subs)) return;
  const open = subs.filter((s) => s.status === 'pending' && Date.now() - s.at < 30 * 86400000);
  if (!open.length) return;
  try {
    const last = parseInt(localStorage.getItem('cat-check-at') || '0', 10) || 0;
    if (!opts.force && Date.now() - last < 6 * 3600000) return;
    localStorage.setItem('cat-check-at', String(Date.now()));
  } catch (e) {}
  try {
    const r = await fetch(SHARE_API + '/catalog/status?ids=' + open.map((s) => s.sid).join(','));
    if (!r.ok) return;
    const verdicts = await r.json();
    const esc = (t) => String(t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    let changed = false, equippedOwn = false;
    for (const s of subs) {
      const v = verdicts[s.sid];
      if (!v || s.status !== 'pending') continue;
      s.status = v.s === 'ok' ? 'approved' : 'rejected';
      changed = true;
      const title = esc(s.title) || 'Your item';
      if (v.s === 'ok') {
        // 🎉 YOU MADE IT TO WEAR IT: the moment it's approved the item is YOURS
        // and goes straight onto your banana (rides bb-last to the rave / pass
        // card / share). No more "approved into a void" — instant payoff.
        if (v.item && /^c_[a-f0-9]{6,32}$/.test(v.item)) {
          try {
            const own = JSON.parse(localStorage.getItem('cat-own-v1') || '{}') || {};
            own[v.item] = 1;
            localStorage.setItem('cat-own-v1', JSON.stringify(own));
            passStat('own_' + v.item, 1);   // rides the pass blob now — every device, not only the one that heard the verdict
            const bl = JSON.parse(localStorage.getItem('bb-last') || '{}') || {};
            // ⚖ one item per body spot: the new piece JOINS the worn set (it
            // used to evict everything), and whatever sat on its spot comes
            // off — the anchor comes from the catalog, the feet ids from the
            // wearables data (dynamic import: approvals are rare, the every-
            // page pass lib stays light). Both lookups failing = plain equip.
            let anchor = '';
            try {
              const cr = await fetch(SHARE_API + '/catalog/items.json');
              const items = cr.ok ? await cr.json() : [];
              const anchorOf = (id) => (((items.find((x) => x.id === id) || {}).wear || {}).anchor) || '';
              anchor = anchorOf(v.item);
              const kept = String(bl.c || '').split(',').map((t) => t.trim())
                .filter((id) => id && id !== v.item && !(anchor && anchorOf(id) === anchor));
              bl.c = kept.concat(v.item).join(',');
            } catch (e2) { bl.c = v.item; }
            if (anchor === 'head') bl.hat = 'none';
            if (anchor === 'feet' && bl.extras) {
              const w = await import('../data/wearables.js');
              Object.values(w.WEARABLE_PACKS).forEach((pk) => (pk.extras || []).forEach((d) => {
                if (d.anchor === 'feet') delete bl.extras[d.id];
              }));
            }
            localStorage.setItem('bb-last', JSON.stringify(bl));
            equippedOwn = true;
          } catch (e) {}
        }
        passNoticeAdd({
          id: 'cat-' + s.sid,
          icon: '🎉',
          text: '<b>“' + title + '” made it in!</b> It’s on the shelf at the Banana Stand now, your name on the label — and it’s already on your banana. Every visitor can buy it and wear your design across the world. Go see it on sale →',
          link: '/park/',
        });
      } else {
        passNoticeAdd({
          id: 'cat-' + s.sid,
          icon: '🔧',
          text: '<b>“' + title + '”</b> didn’t make the catalog this time — the club hangs only a few. Back to the workshop!',
          link: '/forge/items/',
        });
      }
    }
    if (changed) {
      try { localStorage.setItem(CAT_SUBS_KEY, JSON.stringify(subs.slice(0, 20))); } catch (e) {}
    }
    if (equippedOwn) passPush(); // ride the newly-worn creation to their other devices
  } catch (e) { /* offline is fine — next visit asks again */ }
}

// ambient verdict check: any page that loads the pass lib (builder, rave,
// pass…) quietly resolves pending submissions so the nav dot can light up
checkGalleryVerdicts();
checkCatalogVerdicts();

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

// 🎩 revocation-by-time needs a broom: any page that loads the pass layer
// (nearly all of them) sweeps an expired member hat out of the saved outfit
// before the world draws it. Self-catching, no-op while the grant is live.
sweepMemberGear();
