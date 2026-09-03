// 📊 PULSE 2.0 — the shell: the sticky live bar, the window chips, the rooms,
// and the living half (the earth, the hot line, the five-minute ticker).
//
// It owns the state and the polling; each room is handed the payloads and
// paints. Rooms arrive one at a time — anything not built yet says so rather
// than rendering an empty box.
//
//   mountPulse(host, io) -> { destroy() }
//     io.live()            -> /api/live
//     io.range(from, to)   -> /api/range
//     io.analyst()         -> /api/analyst
//     io.ledger()          -> { roll, world }  (the workers' own numbers)
//
// ⚠️ THE DISCIPLINE THAT KEEPS GA4 FROM 429ing: live is polled every 60s and
// NEVER while the tab is hidden; refocusing catches up immediately instead of
// waiting out the interval. The server caches live for 60s on its side too.
import { buildEarth, HOTTXT } from './pulse-map.js';
import * as MAP from '../data/pulse-map.js';
import { EV_LABEL, explain } from '../data/pulse-events.js';
import { renderLedger } from './hq-pulse.js';
import { renderOverview, renderNow, renderDownloads, renderShop, renderWorld, prevWindow } from './pulse-rooms.js';

const LENSES = ['gif_download', 'builder_boot', 'builder_start', 'rave_join', 'sticker_pdp_view',
  'checkout_redirect', 'begin_checkout', 'purchase', 'view_item', 'select_item', 'wallpaper_download',
  'license_click', 'homestead_open', 'offer_world', 'offer_discord', 'offer_support', 'quest_step'];
const WINDOWS = [['today', 'today', 'TODAY'], ['yesterday', 'yesterday', 'YESTERDAY'],
  ['6daysAgo', 'today', '7 DAYS'], ['27daysAgo', 'today', '28 DAYS']];
const ROOMS = [
  ['live', 'LIVE', '#ffe135'],
  ['overview', 'OVERVIEW', '#ffe135'],
  ['downloads', 'DOWNLOADS', '#5ec8e0'],
  ['shop', 'SHOP', '#ff5d8f'],
  ['world', 'WORLD', '#5ee08a'],
  ['ledger', 'LEDGER', '#c99cff'],
];
// the hot line speaks a shade louder than the map tooltip
const HOTLINE = { 2: 'hit ORDER 🛒', 3: 'reached the CHECKOUT 💳', 4: 'BOUGHT 💰🎉' };
const flag = (cc) => (/^[A-Z]{2}$/.test(cc || '')
  ? String.fromCodePoint(...[...cc].map((c) => 127397 + c.charCodeAt(0))) : '🏳');
const el = (tag, cls, txt, parent) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt != null) e.textContent = txt;
  if (parent) parent.appendChild(e);
  return e;
};
const nfmt = (n) => (n >= 10000 ? Math.round(n / 1000) + 'k' : String(Math.round(n || 0)));

export function mountPulse(host, io) {
  host.textContent = '';
  const S = { room: 'live', mode: 'live', lens: LENSES[0], from: 'today', to: 'today',
    live: null, range: null, prev: null, analyst: null, ledger: null };
  try { S.room = localStorage.getItem('pulse-pane') || 'live'; } catch (e) {}
  const timers = new Set();
  const every = (fn, ms) => { const t = setInterval(fn, ms); timers.add(t); return t; };

  // ── the sticky bar: four numbers and half an hour of heartbeat ──────────
  const bar = el('div', 'ps-bar', null, host);
  const mkStat = (id, label) => {
    const s = el('div', 'ps-stat', null, bar);
    const v = el('b', null, '—', s);
    el('span', null, label, s);
    return v;
  };
  const vNow = mkStat('now', 'now');
  const vWorld = mkStat('world', 'in world');
  const vToday = mkStat('today', 'today');
  const hotWrap = el('div', 'ps-stat is-hot', null, bar);
  const vHot = el('b', null, '0', hotWrap);
  el('span', null, 'near buying', hotWrap);
  hotWrap.hidden = true;
  const spark = el('canvas', 'ps-spark', null, bar);
  spark.width = 120; spark.height = 26;

  // ── the window, above every room because it drives all of them ──────────
  const rangeBar = el('div', 'ps-range', null, host);
  el('span', 'ps-rlab', '📅 window', rangeBar);
  const chips = [];
  WINDOWS.forEach(([f, t, label]) => {
    const b = el('button', 'ps-chip', label, rangeBar);
    b.type = 'button';
    b.addEventListener('click', () => { S.from = f; S.to = t; markWindow(); loadRange(); });
    chips.push([b, f, t]);
  });
  const markWindow = () => chips.forEach(([b, f, t]) => b.setAttribute('aria-pressed', String(S.from === f && S.to === t)));

  // ── the rooms ───────────────────────────────────────────────────────────
  const tabs = el('div', 'ps-rooms', null, host);
  const tabEls = {};
  ROOMS.forEach(([id, label, acc]) => {
    const b = el('button', 'ps-room', label, tabs);
    b.type = 'button';
    b.style.setProperty('--racc', acc);
    const badge = el('span', 'ps-rbadge', '', b);
    badge.hidden = true;
    b.addEventListener('click', () => {
      S.room = id;
      try { localStorage.setItem('pulse-pane', id); } catch (e) {}
      paint();
    });
    tabEls[id] = { b, badge, acc };
  });
  const body = el('div', 'ps-body', null, host);

  // ── the living half ─────────────────────────────────────────────────────
  let earth = null;
  function liveRoom(into) {
    into.style.setProperty('--acc', '#ffe135');
    const mapCard = el('div', 'ps-mapcard', null, into);
    const zoomer = el('div', 'ps-zoom', null, mapCard);
    const zIn = el('button', 'ps-zbtn', '＋', zoomer);
    const zOut = el('button', 'ps-zbtn', '−', zoomer);
    zOut.hidden = true;
    earth = buildEarth(mapCard, MAP, {});
    zIn.addEventListener('click', () => { zOut.hidden = earth.zoom(1) <= 1; });
    zOut.addEventListener('click', () => { zOut.hidden = earth.zoom(-1) <= 1; });

    const modes = el('div', 'ps-modes', null, into);
    const modeDefs = [['live', "LIVE · who's on now"], ['range', 'RANGE · visitors'], ['event', 'RANGE · event lens']];
    const mchips = [];
    modeDefs.forEach(([m, label]) => {
      const b = el('button', 'ps-chip', label, modes);
      b.type = 'button';
      b.addEventListener('click', () => { S.mode = m; earth.setMode(m); syncModes(); });
      mchips.push([b, m]);
    });
    const sel = el('select', 'ps-lens', null, modes);
    LENSES.forEach((l) => {
      const op = document.createElement('option');
      op.value = l;
      op.textContent = EV_LABEL[l] || l;
      sel.appendChild(op);
    });
    sel.value = S.lens;
    sel.addEventListener('change', () => { S.lens = sel.value; S.mode = 'event'; earth.setLens(S.lens); earth.setMode('event'); syncModes(); });
    const syncModes = () => mchips.forEach(([b, m]) => b.setAttribute('aria-pressed', String(S.mode === m)));
    syncModes();

    const legend = el('div', 'ps-legend', '', into);
    const hotLine = el('div', 'ps-hotline', '', into);
    hotLine.hidden = true;
    const tick = el('div', 'ps-ticker', null, into);
    const tickIn = el('div', 'ps-tickin', 'warming up the decks…', tick);
    // ⚠️ the old ticker hid its explainer in a title= attribute, invisible to
    // the 85% of traffic on a phone. Here a tap opens it.
    const note = el('div', 'ps-tnote', null, into);
    note.hidden = true;

    into._live = () => {
      const L = S.live;
      if (!L) return;
      const hot = L.hot || [];
      legend.textContent = S.mode === 'live'
        ? 'who is on the site right now (' + nfmt(L.total || 0) + ')'
        : S.mode === 'event' ? 'where ' + (EV_LABEL[S.lens] || S.lens) + ' happened in this window'
          : 'visitors in this window';
      const worst = hot.filter((h) => (+h.stage || 0) >= 2).sort((a, b) => b.stage - a.stage);
      hotLine.hidden = !worst.length;
      if (worst.length) {
        hotLine.textContent = '🟢 last 30 min: ' + worst.slice(0, 4)
          .map((h) => flag(h.cc || h.code) + ' ' + (HOTLINE[h.stage] || HOTTXT[h.stage] || '')).join('  ·  ');
      }
      const rec = L.recent || [];
      tickIn.textContent = '';
      if (!rec.length) {
        tickIn.textContent = 'quiet out there right now… the banana dances alone 🍌';
      } else {
        const parts = [];
        rec.forEach((r) => {
          const b = el('button', 'ps-tev', flag(r.cc) + ' ' + (EV_LABEL[r.name] || r.name) + (r.v > 1 ? ' ×' + r.v : ''), null);
          b.type = 'button';
          b.addEventListener('click', () => {
            const x = explain(r.name);
            note.hidden = false;
            note.textContent = x.label + ' — ' + x.why;
          });
          parts.push(b);
        });
        const lead = el('span', 'ps-tlead', '⏱ Last 5 min:  ', null);
        tickIn.appendChild(lead);
        parts.forEach((b, i) => {
          if (i) tickIn.appendChild(el('span', 'ps-tsep', '   ·   ', null));
          tickIn.appendChild(b);
        });
        tickIn.appendChild(el('span', 'ps-tsep', '   🍌', null));
      }
    };
  }

  function paint() {
    Object.entries(tabEls).forEach(([id, t]) => t.b.setAttribute('aria-pressed', String(S.room === id)));
    if (earth) { earth.stop(); earth = null; }
    body.textContent = '';
    const acc = (ROOMS.find((r) => r[0] === S.room) || ROOMS[0])[2];
    body.style.setProperty('--acc', acc);
    if (S.room === 'live') { liveRoom(body); if (body._live) body._live(); return; }
    if (S.room === 'overview') { renderOverview(body, S); renderNow(body, S); return; }
    if (S.room === 'downloads') { renderDownloads(body, S); return; }
    if (S.room === 'shop') { renderShop(body, S); return; }
    if (S.room === 'world') { renderWorld(body, S); return; }
    if (S.room === 'ledger') {
      if (!S.ledger) { el('div', 'hqp-empty', 'reading the world…', body); io.ledger().then((d) => { S.ledger = d; if (S.room === 'ledger') paint(); }); return; }
      renderLedger(body, { ...S.ledger, analyst: S.analyst, live: S.live });
      return;
    }
    el('div', 'hqp-empty', 'This room is next — the shell landed first so the living half works. '
      + 'Everything it showed is inventoried and nothing has been dropped.', body);
  }

  // ── the sparkline: 30 minute buckets, index 29 is NOW ───────────────────
  function drawSpark() {
    const g = spark.getContext('2d');
    g.clearRect(0, 0, 120, 26);
    const arr = (S.live && S.live.spark) || [];
    const max = Math.max(1, ...arr);
    g.fillStyle = '#ffd23f';
    for (let i = 0; i < 30; i++) {
      const v = arr[i] || 0;
      const h = v ? Math.max(1, Math.round((v / max) * 22)) : 1;   // a baseline stub even at zero
      g.fillRect(i * 4, 26 - h, 3, h);
    }
  }

  function applyLive() {
    const L = S.live;
    if (!L) return;
    vNow.textContent = nfmt(L.total || 0);
    const inWorld = (L.pages || []).filter((p) => /\/(rave|park|beach|homestead|banana-world)\//.test(p.page || ''))
      .reduce((a, p) => a + (+p.v || 0), 0);
    vWorld.textContent = nfmt(inWorld);
    const near = (L.hot || []).filter((h) => (+h.stage || 0) >= 2).length;
    hotWrap.hidden = !near;
    vHot.textContent = nfmt(near);
    drawSpark();
    if (earth) earth.push({ live: L, range: S.range, mode: S.mode, lens: S.lens });
    if (S.room === 'live' && body._live) body._live();
  }

  async function loadLive() {
    if (document.hidden) return;
    const L = await io.live().catch(() => null);
    if (L && !L.error) { S.live = L; applyLive(); }
  }
  async function loadRange() {
    const [pf, pt] = prevWindow(S.from, S.to);
    // ⚠️ the payload carries no comparison of its own — every arrow on the
    // overview comes from this second call for the window before
    const [R, P] = await Promise.all([
      io.range(S.from, S.to).catch(() => null),
      io.range(pf, pt).catch(() => null),
    ]);
    S.prev = P;
    if (R) {
      S.range = R;
      vToday.textContent = nfmt((R.kpis && R.kpis.sessions) || 0);
      if (earth) earth.push({ live: S.live, range: R, mode: S.mode, lens: S.lens });
      if (S.room !== 'live' && S.room !== 'ledger') paint();
    }
  }

  markWindow();
  paint();
  loadLive();
  loadRange();
  io.analyst().then((a) => { S.analyst = a; }).catch(() => {});
  every(loadLive, 60000);
  const onVis = () => { if (!document.hidden) { loadLive(); if (S.to === 'today') loadRange(); } };
  document.addEventListener('visibilitychange', onVis);

  return {
    destroy() {
      timers.forEach(clearInterval);
      timers.clear();
      document.removeEventListener('visibilitychange', onVis);
      if (earth) earth.stop();
    },
  };
}
