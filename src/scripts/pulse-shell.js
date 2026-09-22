// 🍌 BANANA HQ — the core. It owns the state and the polling, and paints one
// floor at a time into the hosts the page hands it. The page owns the floors
// (the rail, the tabs, the desks that never needed Google); this module owns
// every number that comes from a worker.
//
//   mountHQ(hosts, io) -> app
//     hosts.now        the Now floor's live strip, map and ticker (built once)
//     hosts.nowLists   pages open now · cities · devices (repainted every poll)
//     hosts.visitors · business · world · players · letters · health
//     hosts.analystBtn the letterhead button that opens yesterday's report
//     io.live()            -> /api/live          (Google realtime)
//     io.range(from, to)   -> /api/range         (Google, the window)
//     io.analyst() / io.report()
//     io.roll()            -> { roll, arcade }   (the pass worker; null without a key)
//     io.world()           -> /yards/stats       (the rave worker; no key)
//     io.letters()         -> { state, rows }    (the post review queue)
//     io.letterDrop(keys) · io.arcadeWipe(game) · io.key() · io.onLetters(state)
//
// ⚠️ THE DISCIPLINE THAT KEEPS GA4 FROM 429ing: live is polled every 60s and
// NEVER while the tab is hidden; refocusing catches up immediately instead of
// waiting out the interval. The server caches live for 60s on its side too.
//
// ⚠️ ONE CLOCK PER CARD (22 Sep 2026). The Now floor is live only; the Google
// floors read the window; the server floors say which rollup day or "right
// now". A floor may mix, a card never does — the chip on every section is
// what makes that checkable.
import { buildEarth, HOTTXT } from './pulse-map.js';
import * as MAP from '../data/pulse-map.js';
import { EV_LABEL, explain } from '../data/pulse-events.js';
import { flag, inWorld } from '../data/pulse-dicts.js';
import { div, nfmt, chip, renderPlayersRoll, renderEconomy, renderHomesteads, renderArcade, renderHealth, renderLetters } from './hq-pulse.js';
import { renderVisitors, renderBusiness, renderWorldCards, renderAsk, renderSync, renderNowLists, prevWindow, windowBar } from './pulse-rooms.js';

const LENSES = ['gif_download', 'builder_boot', 'builder_start', 'rave_join', 'sticker_pdp_view',
  'checkout_redirect', 'begin_checkout', 'purchase', 'view_item', 'select_item', 'wallpaper_download',
  'license_click', 'homestead_open', 'offer_pack', 'quest_step', 'arcade_board', 'town_open', 'post_open'];
// ⚠️ THE HOROSCOPE RULE, kept: the analyst is allowed to say nothing
// happened, and to say a sample is too small to call. One that finds a story
// every single day is not an analyst — the silence is what makes a loud day
// worth reading. These four labels are its whole vocabulary.
const VLABEL = { notable: 'something happened', quiet: 'nothing needed',
  thin: 'too small to call', 'no-baseline': 'not enough history' };
const RPT_KEY = 'pulse-rpt-read';
// the report is dated in Oslo, the property's timezone, and stepped from a UTC
// midnight — subtracting a day from a local timestamp slips an hour twice a year
const osloYesterday = () => {
  const t0 = Date.parse(new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Oslo' }) + 'T00:00:00Z');
  return new Date(t0 - 86400000).toISOString().slice(0, 10);
};
// the hot line speaks a shade louder than the map tooltip
const HOTLINE = { 2: 'hit ORDER 🛒', 3: 'reached the CHECKOUT 💳', 4: 'BOUGHT 💰🎉' };
const el = (tag, cls, txt, parent) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt != null) e.textContent = txt;
  if (parent) parent.appendChild(e);
  return e;
};
const GOOGLE_FLOORS = ['visitors', 'business', 'world', 'players', 'dev'];

export function mountHQ(hosts, io) {
  const H = hosts;
  const S = { floor: '', from: 'today', to: 'today', winLens: '', live: null, range: null, prev: null,
    analyst: null, roll: null, arcade: null, rollErr: false, rollBusy: false, world: null,
    letters: { state: io.key() ? 'loading' : 'nokey', rows: [] }, counts: {}, probe: null, err: '' };
  const timers = new Set();
  const every = (fn, ms) => { const t = setInterval(fn, ms); timers.add(t); return t; };

  // ── the analyst button lives in the letterhead, on every floor ────────────
  let rptDot = null;
  const rptSeen = () => { try { return localStorage.getItem(RPT_KEY) || ''; } catch (e) { return ''; } };
  const syncDot = () => { if (rptDot) rptDot.hidden = rptSeen() === osloYesterday(); };
  if (H.analystBtn) {
    rptDot = el('span', 'ps-rptdot', '', H.analystBtn);
    syncDot();
    H.analystBtn.addEventListener('click', () => openAnalyst());
  }

  // ── 🟢 THE NOW FLOOR — built once, fed every minute ──────────────────────
  let earthNow = null, nowUI = null;
  function buildNow() {
    const host = H.now;
    host.textContent = '';
    const bar = div('ps-bar', null, host);
    const mkStat = (label) => {
      const s = div('ps-stat', null, bar);
      const v = el('b', null, '—', s);
      el('span', null, label, s);
      return v;
    };
    const vNow = mkStat('on the site now');
    const vWorld = mkStat('in Banana World now');
    const hotWrap = div('ps-stat is-hot', null, bar);
    const vHot = el('b', null, '0', hotWrap);
    el('span', null, 'close to buying', hotWrap);
    hotWrap.hidden = true;
    const sw = div('ps-sparkwrap', null, bar);
    const spark = el('canvas', 'ps-spark', null, sw);
    spark.width = 120; spark.height = 26;
    el('span', 'ps-sparklab', 'last 30 min, by the minute', sw);
    chip('live', 'last 30 min', bar);

    const mapCard = div('ps-mapcard', null, host);
    const zoomer = div('ps-zoom', null, mapCard);
    const zIn = el('button', 'ps-zbtn', '＋', zoomer);
    zIn.type = 'button'; zIn.setAttribute('aria-label', 'zoom in');
    const zOut = el('button', 'ps-zbtn', '−', zoomer);
    zOut.type = 'button'; zOut.setAttribute('aria-label', 'zoom out');
    zOut.hidden = true;
    // 📌 a tapped dot keeps its label; this only appears once something is pinned
    const zClear = el('button', 'ps-zbtn ps-zbtn--wide', 'unpin all', zoomer);
    zClear.type = 'button';
    zClear.hidden = true;
    earthNow = buildEarth(mapCard, MAP, { onPins: (pins) => { zClear.hidden = !pins.length; } });
    zClear.addEventListener('click', () => earthNow.clearPins());
    zIn.addEventListener('click', () => { zOut.hidden = earthNow.zoom(1) <= 1; });
    zOut.addEventListener('click', () => { zOut.hidden = earthNow.zoom(-1) <= 1; });
    if (S.live) earthNow.push({ live: S.live, range: S.range, mode: 'live' });

    const legend = div('ps-legend', 'tap a dot to keep its label · hover to peek', host);
    const hotLine = div('ps-hotline', '', host);
    hotLine.hidden = true;
    const tick = div('ps-ticker', null, host);
    const tickIn = div('ps-tickin', 'warming up the decks…', tick);
    const note = div('ps-tnote', null, host);
    note.hidden = true;
    nowUI = { vNow, vWorld, hotWrap, vHot, spark, legend, hotLine, tickIn, note };
  }

  function drawSpark() {
    const g = nowUI.spark.getContext('2d');
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
    if (!L || !nowUI) return;
    const U = nowUI;
    U.vNow.textContent = nfmt(L.total || 0);
    U.vWorld.textContent = nfmt((L.pages || []).reduce((a, p) => a + (inWorld(p.page) ? +p.v || 0 : 0), 0));
    const hot = Object.entries(L.hot || {}).map(([cc, stage]) => ({ cc, stage: +stage || 0 }));
    const near = hot.filter((h) => h.stage >= 2).length;
    U.hotWrap.hidden = !near;
    U.vHot.textContent = nfmt(near);
    drawSpark();
    U.legend.textContent = 'who is on the site right now (' + nfmt(L.total || 0) + ') · tap a dot to keep its label · hover to peek';
    const worst = hot.filter((h) => h.stage >= 2).sort((a, b) => b.stage - a.stage);
    U.hotLine.hidden = !worst.length;
    if (worst.length) {
      U.hotLine.textContent = '🟢 last 30 min: ' + worst.slice(0, 4)
        .map((h) => flag(h.cc) + ' someone ' + (HOTLINE[h.stage] || HOTTXT[h.stage] || '')).join('  ·  ');
    }
    const rec = L.recent || [];
    U.tickIn.textContent = '';
    if (!rec.length) {
      U.tickIn.textContent = 'quiet out there right now… the banana dances alone 🍌';
    } else {
      U.tickIn.appendChild(el('span', 'ps-tlead', '⏱ Last 5 min:  ', null));
      rec.forEach((r, i) => {
        if (i) U.tickIn.appendChild(el('span', 'ps-tsep', '   ·   ', null));
        const b = el('button', 'ps-tev', flag(r.cc) + ' ' + (EV_LABEL[r.name] || r.name) + (r.v > 1 ? ' ×' + r.v : ''), null);
        b.type = 'button';
        b.addEventListener('click', () => {
          const x = explain(r.name);
          U.note.hidden = false;
          U.note.textContent = x.label + ' — ' + x.why;
        });
        U.tickIn.appendChild(b);
      });
      U.tickIn.appendChild(el('span', 'ps-tsep', '   🍌', null));
    }
    if (H.nowLists) { H.nowLists.textContent = ''; renderNowLists(H.nowLists, S); }
  }

  // ── the window's map, on the Visitors floor ──────────────────────────────
  let earthWin = null;
  function winMap(sec) {
    if (earthWin) { earthWin.stop(); earthWin = null; }
    const card = div('ps-mapcard', null, sec);
    const zoomer = div('ps-zoom', null, card);
    const zIn = el('button', 'ps-zbtn', '＋', zoomer);
    zIn.type = 'button'; zIn.setAttribute('aria-label', 'zoom in');
    const zOut = el('button', 'ps-zbtn', '−', zoomer);
    zOut.type = 'button'; zOut.setAttribute('aria-label', 'zoom out');
    zOut.hidden = true;
    const zClear = el('button', 'ps-zbtn ps-zbtn--wide', 'unpin all', zoomer);
    zClear.type = 'button';
    zClear.hidden = true;
    const earth = buildEarth(card, MAP, { onPins: (pins) => { zClear.hidden = !pins.length; } });
    earthWin = earth;
    zClear.addEventListener('click', () => earth.clearPins());
    zIn.addEventListener('click', () => { zOut.hidden = earth.zoom(1) <= 1; });
    zOut.addEventListener('click', () => { zOut.hidden = earth.zoom(-1) <= 1; });
    const sel = el('select', 'ps-lens', null, sec);
    sel.setAttribute('aria-label', 'what the map shows');
    const op0 = document.createElement('option');
    op0.value = '';
    op0.textContent = 'visitors by country';
    sel.appendChild(op0);
    LENSES.forEach((l) => {
      const op = document.createElement('option');
      op.value = l;
      op.textContent = 'where they ' + (EV_LABEL[l] || l);
      sel.appendChild(op);
    });
    sel.value = S.winLens;
    const apply = () => earth.push({ live: S.live, range: S.range, mode: S.winLens ? 'event' : 'range', lens: S.winLens || LENSES[0] });
    sel.addEventListener('change', () => { S.winLens = sel.value; apply(); });
    apply();
  }

  // ── one paint per floor ───────────────────────────────────────────────────
  const errLine = (host) => { if (S.err) div('hqp-note', 'Google’s half is not answering: ' + S.err, host).hidden = false; };
  const needKey = (host, what) => div('hqp-empty', what + ' need the pass admin key — paste it once on the Players floor and they open here.', host);
  function pickWindow(f, t) { S.from = f; S.to = t; loadRange(); paint(); }
  function paint() {
    const f = S.floor;
    if (f === 'now') { if (!nowUI) buildNow(); applyLive(); return; }
    if (f === 'visitors') {
      H.visitors.textContent = '';
      windowBar(H.visitors, S, pickWindow);
      errLine(H.visitors);
      renderVisitors(H.visitors, S, winMap);
      return;
    }
    if (f === 'business') {
      H.business.textContent = '';
      windowBar(H.business, S, pickWindow);
      errLine(H.business);
      renderBusiness(H.business, S, S.probe);
      return;
    }
    if (f === 'world') {
      H.world.textContent = '';
      windowBar(H.world, S, pickWindow);
      errLine(H.world);
      renderWorldCards(H.world, S);
      renderHomesteads(H.world, { world: S.world || {} });
      if (S.roll) {
        renderArcade(H.world, { arcade: S.arcade, arcadeWipe: io.arcadeWipe });
        renderEconomy(H.world, { roll: S.roll });
      } else needKey(H.world, 'The economy and the Arcade boards');
      return;
    }
    if (f === 'players') {
      H.players.textContent = '';
      if (!io.key()) { div('hqp-empty', 'Paste the pass admin key above to open this floor. It is remembered on this device.', H.players); return; }
      if (!S.roll) {
        div('hqp-empty', S.rollErr ? '❌ the pass worker says no — wrong key, or PASS_ADMIN_KEY is not set on the worker yet.' : 'reading the rollup…', H.players);
        return;
      }
      renderPlayersRoll(H.players, { roll: S.roll });
      renderAsk(H.players, S);
      return;
    }
    if (f === 'mail') { H.letters.textContent = ''; renderLetters(H.letters, S.letters, io.letterDrop); return; }
    if (f === 'dev') {
      H.health.textContent = '';
      renderSync(H.health, S);
      if (S.roll) renderHealth(H.health, { roll: S.roll, world: S.world || {} });
      else needKey(H.health, 'The ledger checks');
    }
  }

  function show(f) {
    S.floor = f;
    paint();
    if (io.key() && !S.roll && !S.rollBusy && ['players', 'world', 'dev'].includes(f)) loadRoll();
    if (f === 'mail' && io.key() && (S.letters.state === 'nokey' || S.letters.state === 'loading')) loadLetters();
    if (!S.world && ['world', 'dev'].includes(f)) loadWorld();
  }

  // ── 🍌📊 THE ANALYST — the judgement, not the numbers ───────────────────
  let veil = null;
  async function openAnalyst() {
    try { localStorage.setItem(RPT_KEY, osloYesterday()); } catch (e) {}
    syncDot();
    if (veil) veil.remove();
    // ⚠️ MOUNT IT INSIDE THE WRAP, not on <body>. Every colour on this desk is
    // a custom property declared on .bm-wrap, so an overlay parented to the
    // body inherits none of them and renders completely transparent.
    const root = (H.now && H.now.closest('.bm-wrap')) || document.querySelector('.bm-wrap') || document.body;
    veil = el('div', 'ps-veil', null, root);
    const card = el('div', 'ps-rcard', null, veil);
    const x = el('button', 'ps-rx', '✕', card);
    x.type = 'button';
    x.setAttribute('aria-label', 'close');
    x.addEventListener('click', () => close());
    veil.addEventListener('click', (e) => { if (e.target === veil) close(); });
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    addEventListener('keydown', onKey);
    function close() {
      removeEventListener('keydown', onKey);
      if (veil) veil.remove();
      veil = null;
    }
    el('div', 'ps-rload', 'reading yesterday…', card);
    const [an, rp] = await Promise.all([
      S.analyst ? Promise.resolve(S.analyst) : io.analyst().catch(() => null),
      io.report ? io.report().catch(() => null) : Promise.resolve(null),
    ]);
    S.analyst = an || S.analyst;
    card.querySelectorAll('.ps-rload').forEach((n) => n.remove());
    if (!an) { el('div', 'hqp-empty', 'the analyst could not be read just now', card); return; }
    el('div', 'ps-verdict is-' + (an.verdict || 'quiet'), VLABEL[an.verdict] || an.verdict || 'reading', card);
    el('h3', 'ps-rhead', an.headline || '', card);
    (an.body || []).forEach((line) => el('p', 'ps-rbody', line, card));
    (an.reads || []).forEach((r) => {
      const row = el('div', 'ps-read', null, card);
      el('span', 'ps-ricon', (r && r.icon) || '•', row);
      el('span', 'ps-rtext', (r && (r.text || r.line)) || String(r), row);
    });
    (an.recs || []).forEach((r) => el('div', 'ps-rec', typeof r === 'string' ? r : (r.text || r.rec || ''), card));
    if (an.confidence) {
      el('div', 'hqp-cap', an.confidence
        + (an.sessions != null ? ' · ' + nfmt(an.sessions) + ' visits against ' + nfmt(an.avgSessions) + ' usual' : ''), card);
    }
    if (rp) {
      // ⚠️ these lines are written HTML from our OWN worker — <b> tags and all.
      // Nothing here is player-authored, which is why innerHTML is safe.
      el('h4', 'ps-rsub', 'the numbers behind it', card);
      (rp.lines || []).forEach((line) => { const p = el('p', 'ps-rline', null, card); p.innerHTML = String(line); });
      (rp.notes || []).forEach((n) => { const p = el('div', 'ps-rnote', null, card); p.innerHTML = String(n); });
    }
  }

  // ── the loaders ───────────────────────────────────────────────────────────
  async function loadLive() {
    if (document.hidden) return;
    const L = await io.live().catch(() => null);
    if (L && L.__err) { S.err = L.__err; if (S.floor === 'visitors' || S.floor === 'business') paint(); return; }
    if (L && !L.error) {
      S.live = L; S.err = '';
      if (earthNow) earthNow.push({ live: L, range: S.range, mode: 'live' });
      if (earthWin) earthWin.push({ live: L });
      applyLive();
    }
  }
  async function loadRange() {
    const [pf, pt] = prevWindow(S.from, S.to);
    // ⚠️ the payload carries no comparison of its own — every arrow on the
    // Visitors floor comes from this second call for the window before
    const [R, P] = await Promise.all([
      io.range(S.from, S.to).catch(() => null),
      io.range(pf, pt).catch(() => null),
    ]);
    S.prev = P;
    if (R && R.__err) S.err = R.__err;
    if (R && !R.__err) { S.range = R; S.err = ''; }
    if (earthWin) earthWin.push({ range: S.range });
    if (GOOGLE_FLOORS.includes(S.floor)) paint();
  }
  async function loadRoll() {
    S.rollBusy = true;
    const d = await io.roll().catch(() => null);
    S.rollBusy = false;
    if (!d || !d.roll) { S.rollErr = !!io.key(); S.roll = null; }
    else { S.roll = d.roll; S.arcade = d.arcade || null; S.rollErr = false; }
    if (['players', 'world', 'dev'].includes(S.floor)) paint();
  }
  async function loadWorld() {
    S.world = (await io.world().catch(() => null)) || {};
    if (['world', 'dev'].includes(S.floor)) paint();
  }
  async function loadLetters() {
    if (!io.key()) S.letters = { state: 'nokey', rows: [] };
    else S.letters = (await io.letters().catch(() => null)) || { state: 'error', rows: [] };
    if (io.onLetters) io.onLetters(S.letters);
    if (S.floor === 'mail') paint();
  }

  loadLive();
  loadRange();
  if (io.key()) { loadRoll(); loadLetters(); }
  loadWorld();
  io.analyst().then((a) => { S.analyst = a; }).catch(() => {});
  every(loadLive, 60000);
  const onVis = () => { if (!document.hidden) { loadLive(); if (S.to === 'today') loadRange(); } };
  document.addEventListener('visibilitychange', onVis);

  return {
    show, paint, openAnalyst,
    counts(c) { S.counts = { ...S.counts, ...(c || {}) }; if (S.floor === 'world') paint(); },
    probe(v) { S.probe = v; if (S.floor === 'business') paint(); },
    keyChanged() { S.roll = null; S.rollErr = false; S.rollBusy = false; loadRoll(); loadLetters(); },
    refreshLetters() { return loadLetters(); },
    letters: () => S.letters,
    pins: () => (earthNow ? earthNow.pins() : []),
    pin: (cc) => { if (earthNow) earthNow.pin(cc); },
    state: S,
    destroy() {
      timers.forEach(clearInterval);
      timers.clear();
      document.removeEventListener('visibilitychange', onVis);
      if (earthNow) earthNow.stop();
      if (earthWin) earthWin.stop();
    },
  };
}
