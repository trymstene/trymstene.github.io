// 📊 PULSE 2.0 — the rooms that read a WINDOW rather than the last half hour.
//
// One file, one room per export, all of them handed the same two payloads by
// the shell. They share the chart primitives with the ledger room instead of
// growing a second chart engine.
//
// ⚠️ THINGS THAT LOOK LIKE DETAILS AND ARE NOT:
//   · `daily` is NOT zero-filled — a dead day is MISSING from the array, so a
//     chart must fill the gaps or it draws a lie with a straight line
//   · funnel steps count PEOPLE (`u`), never events (`v`): six shop views can
//     be two humans
//   · a rate needs 20 behind it before it is printed at all
//   · every ▲▼ comes from a SECOND range call for the previous window; the
//     payload carries no comparison of its own
import { section, tile, lineChart, barsH, div, nfmt, pct } from './hq-pulse.js';
import { EV_LABEL, explain } from '../data/pulse-events.js';
import { FUNNELS, DL_NAMES, AREAS, SHOPS } from '../data/pulse-dicts.js';

const MIN_N = 20;
const DEV_ICON = { desktop: '🖥', mobile: '📱', tablet: '📟' };
const flag = (cc) => (/^[A-Z]{2}$/.test(cc || '')
  ? String.fromCodePoint(...[...cc].map((c) => 127397 + c.charCodeAt(0))) : '🏳');
const SKIP_EV = new Set(['session_start', 'first_visit']);

// ── the previous window of equal length, so every number can carry a delta ──
export function prevWindow(from, to) {
  const rel = (s) => (s === 'today' ? 0 : s === 'yesterday' ? 1 : (/^(\d+)daysAgo$/.exec(s) || [])[1]);
  const a = rel(from), b = rel(to);
  if (a != null && b != null) {
    const A = +a, B = +b, len = A - B + 1;
    const mk = (n) => (n === 0 ? 'today' : n === 1 ? 'yesterday' : n + 'daysAgo');
    return [mk(A + len), mk(B + len)];
  }
  return [from, to];   // a hand-typed ISO pair keeps its own window
}

const delta = (now, was) => {
  if (!was) return null;
  const d = Math.round(((now - was) / was) * 100);
  if (!isFinite(d) || Math.abs(d) < 1) return null;
  return (d > 0 ? '▲ ' : '▼ ') + Math.abs(d) + '%';
};

// ── the daily series, with the missing days put back ────────────────────────
function fillDaily(daily, key) {
  const rows = (daily || []).slice().sort((a, b) => (a.d < b.d ? -1 : 1));
  if (!rows.length) return [];
  const iso = (s) => s.slice(0, 4) + '-' + s.slice(4, 6) + '-' + s.slice(6, 8);
  const t0 = Date.parse(iso(rows[0].d) + 'T00:00:00Z');
  const t1 = Date.parse(iso(rows[rows.length - 1].d) + 'T00:00:00Z');
  const by = new Map(rows.map((r) => [r.d, r]));
  const out = [];
  for (let t = t0; t <= t1; t += 86400000) {
    const d = new Date(t).toISOString().slice(0, 10);
    const k = d.replace(/-/g, '');
    const r = by.get(k);
    out.push({ d, v: r ? (+r[key] || 0) : 0 });    // ⚠️ a day GA4 omitted is a real zero
  }
  return out;
}

export function renderOverview(into, S) {
  const R = S.range, P = S.prev;
  if (!R) { div('hqp-empty', 'reading the window…', into); return; }
  const k = R.kpis || {};
  const pk = (P && P.kpis) || {};

  let s = section(into, 'The window', 'Sessions are visits, visitors are deduplicated people across the whole window, and engaged is session-weighted rather than an average of daily rates. Every arrow compares this window with the one immediately before it, of the same length.');
  const g = div('hqp-tiles', null, s);
  tile(g, 'sessions', nfmt(k.sessions), delta(k.sessions, pk.sessions) || 'visits');
  tile(g, 'visitors', nfmt(k.users), delta(k.users, pk.users) || 'deduplicated');
  tile(g, 'new', nfmt(k.newUsers), delta(k.newUsers, pk.newUsers) || 'first time here');
  tile(g, 'engaged', Math.round((k.engagementRate || 0) * 100) + '%', delta(k.engagementRate, pk.engagementRate) || 'of sessions');
  tile(g, 'revenue', Math.round(k.revenue || 0) + ' kr', nfmt(k.transactions) + ' purchases');
  // ⚠️ the big slot is for a NUMBER — an emoji in it reads as a broken tile
  const dv = (R.devices || []).slice().sort((x, y) => y.sessions - x.sessions);
  const top = dv[0];
  tile(g, top ? 'on ' + (top.dev === 'desktop' ? 'desktop' : top.dev + 's') : 'devices',
    top ? pct(top.sessions, k.sessions) + '%' : '—',
    dv.map((d) => (DEV_ICON[d.dev] || d.dev) + ' ' + pct(d.sessions, k.sessions) + '%').join(' · ') || 'no device data');

  // ⏳ GA4's own intraday lag, said out loud so a zero day never reads as a crash
  if (S.to === 'today' && !k.sessions) {
    div('hqp-note', 'GA4 has not produced today’s report data yet — Google-side intraday lag, sometimes 12h+. The live map and the ticker are unaffected, and today’s numbers backfill on their own.', s).hidden = false;
  }

  const daily = fillDaily(R.daily, 'sessions');
  if (daily.length > 1) {
    lineChart(s, daily, { label: 'sessions per day' });
    div('hqp-cap', 'sessions per day · a day with nothing is a real zero, not a gap', s);
  }

  // ── where they came from ────────────────────────────────────────────────
  s = section(into, 'Where they came from', 'Sessions by source and medium, with how engaged each one was and how many pages it read. A campaign panel appears only when a real utm campaign lands.');
  barsH(s, (R.sources || []).slice(0, 8).map((x) => ({ k: x.source || '(direct)', v: x.sessions })), { mono: '#2F7BD6' });
  const srcRows = (R.sources || []).slice(0, 8);
  if (srcRows.length) {
    const t = div('hqp-tbl', null, s);
    srcRows.forEach((x) => {
      const row = div('hqp-trow', null, t);
      div('hqp-tk', (x.source || '(direct)') + ' · ' + (x.medium || '—'), row);
      div('hqp-tv', nfmt(x.sessions) + '  ·  ' + pct(x.engaged, x.sessions) + '% eng  ·  '
        + (x.sessions ? (x.views / x.sessions).toFixed(1) : '0') + ' pages', row);
    });
  }
  const camps = (R.camps || []).filter((c) => c.name && c.name !== '(not set)');
  if (camps.length) {
    const cs = section(into, 'Campaigns', 'utm_campaign by utm_content. It stays hidden until a real campaign lands, so an empty panel never implies a dead ad.');
    const t = div('hqp-tbl', null, cs);
    camps.forEach((c) => {
      const row = div('hqp-trow', null, t);
      div('hqp-tk', c.name + (c.content ? ' · ' + c.content : ''), row);
      div('hqp-tv', nfmt(c.sessions) + '  ·  ' + pct(c.engaged, c.sessions) + '% eng', row);
    });
  }

  // ── what they did ───────────────────────────────────────────────────────
  s = section(into, 'What they did', 'Every event in the window, biggest first. Tap one to read what it means — that explainer is the only written record of what these events measure and where they mislead.');
  const evs = (R.events || []).filter((e) => !SKIP_EV.has(e.name)).slice(0, 20);
  const note = div('hqp-note', '', s);
  note.hidden = true;
  const t = div('hqp-tbl', null, s);
  evs.forEach((e) => {
    const row = div('hqp-trow is-tap', null, t);
    div('hqp-tk', EV_LABEL[e.name] || e.name, row);
    div('hqp-tv', nfmt(e.v) + (e.u ? '  ·  ' + nfmt(e.u) + ' people' : ''), row);
    row.addEventListener('click', () => {
      const x = explain(e.name);
      note.hidden = false;
      note.textContent = e.name + ' — ' + x.why;
    });
  });
  if (!evs.length) div('hqp-empty', 'no events in this window', t);
}

// ── who is on screen right this second ──────────────────────────────────────
export function renderNow(into, S) {
  const L = S.live;
  if (!L) { div('hqp-empty', 'waiting for the live read…', into); return; }
  let s = section(into, 'On screen right now', 'The pages people have open this minute, and where they are reading from.');
  const t = div('hqp-tbl', null, s);
  (L.pages || []).slice(0, 10).forEach((p) => {
    const row = div('hqp-trow', null, t);
    div('hqp-tk', String(p.page || '').replace(' | Trym Stene', ''), row);
    div('hqp-tv', nfmt(p.v), row);
  });
  if (!(L.pages || []).length) div('hqp-empty', 'nobody is reading anything this minute', t);
  s = section(into, 'Cities visiting right now', null);
  const t2 = div('hqp-tbl', null, s);
  (L.cities || []).slice(0, 12).forEach((c) => {
    const row = div('hqp-trow', null, t2);
    div('hqp-tk', flag(c.cc) + ' ' + (c.name || c.city || '—'), row);
    div('hqp-tv', nfmt(c.v), row);
  });
  if (!(L.cities || []).length) div('hqp-empty', 'no cities on the board', t2);
}

// ════════════════════════════════════════════════════════════════════════════
// 📥 DOWNLOADS — giving files away IS the product here, so this is the volume
// side of the site. TOOK = files handed over. SAW = the card appeared, which
// since 12 Aug rides EVERY download, so it counts cards and not people.
// ════════════════════════════════════════════════════════════════════════════

// longest prefix wins; a deeper path keeps the surface and adds its own slug
function dlName(page) {
  const p = String(page || '');
  let best = null;
  for (const [pre, name] of DL_NAMES) if (p.indexOf(pre) === 0 && (!best || pre.length > best[0].length)) best = [pre, name];
  if (!best) return p === '/' ? 'The front page' : p;
  const rest = p.slice(best[0].length).replace(/\/$/, '');
  return rest ? best[1] + ' · ' + rest.split('/').pop().replace(/-/g, ' ') : best[1];
}
const DLSET = new Set(['gif_download', 'png_download', 'wallpaper_download', 'offer_shown',
  'offer_click', 'offer_skip', 'offer_world', 'offer_discord']);

export function renderDownloads(into, S) {
  const R = S.range;
  if (!R) { div('hqp-empty', 'reading the window…', into); return; }
  const rows = R.downloads || [];
  let s = section(into, 'The download business', 'TOOK is files handed over. SAW is the card appearing — since 12 Aug it rides every download, so it counts cards, not people. The card makes one honest ask, and WILLINGNESS is coffee clicks over cards shown. A rate needs twenty cards behind it before it is printed: three out of five is three clicks, not sixty per cent.');
  if (!rows.length) { div('hqp-empty', 'no downloads in this window', s); return; }
  const sum = (k) => rows.reduce((a, r) => a + (+r[k] || 0), 0);
  const tf = sum('files'), ts = sum('shown'), tc = sum('click'), tk = sum('skip');
  const tw = sum('world'), td = sum('disc'), tcof = sum('coffee');
  const warm = tw + td + tc;
  const sessions = (R.kpis && R.kpis.sessions) || 0;
  const g = div('hqp-tiles', null, s);
  tile(g, 'files taken', nfmt(tf));
  tile(g, 'per 100 visits', sessions ? (tf / sessions * 100).toFixed(1) : '–');
  tile(g, 'cards shown', nfmt(ts));
  tile(g, 'coffee clicks', nfmt(tcof), '☕ the ask');
  tile(g, 'willingness', ts >= MIN_N ? (tcof / ts * 100).toFixed(1) + '%' : '–', ts >= MIN_N ? 'of cards shown' : 'needs 20 cards');
  tile(g, 'no-thanks', nfmt(tk));
  tile(g, 'warm-up', warm ? Math.round(warm / Math.max(ts, 1) * 100) + '%' : '–', 'retired ask');
  div('hqp-cap', ts >= MIN_N
    ? 'Of every 100 people shown the card, ' + (tcof / ts * 100).toFixed(1) + ' clicked the ☕ ask. The money lands on the payment dashboard, not here.'
    : 'Not enough cards yet to judge the ask — come back when a few hundred have been shown.', s);

  // ── files, day by day ──────────────────────────────────────────────────
  const dl = (R.dlDaily || []).slice().sort((a, b) => (a.d < b.d ? -1 : 1));
  if (dl.length) {
    const s2 = section(into, 'Files taken, day by day', null);
    const wrap = div('hqp-bars2', null, s2);
    const dmax = Math.max(1, ...dl.map((r) => +r.files || 0));
    dl.forEach((r) => {
      const col = div('hqp-b2', null, wrap);
      const fill = div('hqp-b2f', null, col);
      fill.style.height = Math.max(2, Math.round((+r.files || 0) / dmax * 100)) + '%';
      const d = r.d.slice(6, 8) + '.' + r.d.slice(4, 6);
      col.addEventListener('click', () => {
        note2.hidden = false;
        note2.textContent = d + ' — ' + (r.files || 0) + ' files, ' + (r.shown || 0) + ' cards shown, '
          + ((r.world || 0) + (r.disc || 0) + (r.click || 0)) + ' warmed';
      });
    });
    var note2 = div('hqp-note', '', s2);
    note2.hidden = true;
    div('hqp-cap', dl[0].d.slice(6, 8) + '.' + dl[0].d.slice(4, 6) + ' → '
      + dl[dl.length - 1].d.slice(6, 8) + '.' + dl[dl.length - 1].d.slice(4, 6)
      + ' · peak ' + dmax + ' in a day · tap a bar for the detail', s2);
  }

  // ── who is taking them, free off the event map ─────────────────────────
  const em = R.eventMap || {};
  const geo = {};
  ['gif_download', 'png_download', 'wallpaper_download'].forEach((k) => {
    Object.entries(em[k] || {}).forEach(([cc, v]) => { geo[cc] = (geo[cc] || 0) + (+v || 0); });
  });
  const geoRows = Object.entries(geo).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const s3 = section(into, 'Who is taking them', null);
  const t3 = div('hqp-tbl', null, s3);
  geoRows.forEach(([cc, v]) => {
    const row = div('hqp-trow', null, t3);
    div('hqp-tk', flag(cc) + ' ' + cc, row);
    div('hqp-tv', nfmt(v), row);
  });
  if (!geoRows.length) div('hqp-empty', 'no country data in this window', t3);

  // ── the last five minutes ──────────────────────────────────────────────
  const s4 = section(into, 'Just downloaded', 'The last five minutes, straight off the realtime feed.');
  const t4 = div('hqp-tbl', null, s4);
  const recent = ((S.live && S.live.recent) || []).filter((r) => DLSET.has(r.name));
  recent.forEach((r) => {
    const row = div('hqp-trow', null, t4);
    div('hqp-tk', flag(r.cc) + ' ' + (EV_LABEL[r.name] || r.name) + (r.v > 1 ? ' ×' + r.v : ''), row);
    div('hqp-tv', '', row);
  });
  if (!recent.length) div('hqp-empty', 'nothing in the last five minutes', t4);

  // ── every surface that hands a file over ───────────────────────────────
  const s5 = section(into, 'Every surface that hands a file over', 'Since 12 Aug the card rides every download, so in a fresh window SAW should track TOOK closely. A big gap means the wiring; in an old window it is just the retired once-per-visit cap.');
  const t5 = div('hqp-tbl', null, s5);
  const head = div('hqp-trow is-head', null, t5);
  div('hqp-tk', 'surface', head);
  div('hqp-tv', 'took · saw · ☕ · no-thx · willing', head);
  const fmax = Math.max(1, ...rows.map((r) => +r.files || 0));
  rows.slice().sort((a, b) => (+b.files || 0) - (+a.files || 0)).forEach((r) => {
    const row = div('hqp-trow', null, t5);
    const k = div('hqp-tk', null, row);
    k.textContent = dlName(r.page);
    // ⚠️ files went out here but the offer never appeared — that is wiring
    if ((+r.files || 0) >= MIN_N && !(+r.shown || 0)) {
      const w = div('hqp-warn', ' ⚠ no offer', k);
      w.title = '';
    }
    const bar = div('hqp-mini', null, k);
    bar.style.width = Math.max(2, Math.round((+r.files || 0) / fmax * 70)) + 'px';
    div('hqp-tv', nfmt(r.files) + ' · ' + nfmt(r.shown) + ' · ' + nfmt(r.coffee) + ' · ' + nfmt(r.skip)
      + ' · ' + ((+r.shown || 0) >= MIN_N ? ((+r.coffee || 0) / r.shown * 100).toFixed(1) + '%' : '–'), row);
  });
}

// ════════════════════════════════════════════════════════════════════════════
// 🏷️ SHOP — two funnels, told apart purely by which events they name. There
// is no product-type dimension anywhere in GA4 for this site.
// ════════════════════════════════════════════════════════════════════════════

// ⚠️ steps count PEOPLE (totalUsers), never raw events: six shop views from
// two visitors must read as two, or every step flatters itself
function stepVal(R, key) {
  if (key === 'sessions') return (R.kpis && R.kpis.sessions) || 0;
  if (key === 'transactions') return (R.kpis && R.kpis.transactions) || 0;
  const e = (R.events || []).find((x) => x.name === key);
  return e ? (e.u != null ? +e.u : +e.v) || 0 : 0;
}
const fmtDur = (n) => (n < 90 ? n + 's' : Math.floor(n / 60) + 'm ' + (n % 60) + 's');

function renderFunnel(host, R, steps, title, sub, explainNote) {
  const s = section(host, title, sub);
  const vals = steps.map(([k]) => stepVal(R, k));
  // ⚠️ THE HOTSPOT marks the step people STALL ON — the page to fix — not the
  // step they fail to reach. Pass one needs 20 behind the source; if nothing
  // qualifies, pass two drops the size gate rather than marking nothing.
  let worst = -1, worstRate = 2;
  for (let i = 1; i < vals.length; i++) {
    if (vals[i - 1] < MIN_N) continue;
    const r = vals[i - 1] ? vals[i] / vals[i - 1] : 1;
    if (r < worstRate) { worstRate = r; worst = i; }
  }
  if (worst < 0) {
    for (let i = 1; i < vals.length; i++) {
      if (!vals[i - 1]) continue;
      const r = vals[i] / vals[i - 1];
      if (r < worstRate) { worstRate = r; worst = i; }
    }
  }
  const wrap = div('hqp-funnel', null, s);
  const note = div('hqp-note', '', s);
  note.hidden = true;
  steps.forEach(([key, label, why], i) => {
    const row = div('hqp-fstep' + (i === worst - 1 ? ' is-work' : ''), null, wrap);
    const bar = div('hqp-fbar', null, row);
    // clamped: a later step can legitimately exceed step 0 (GA4 counts events)
    bar.style.width = (vals[0] ? Math.min(100, Math.max(1.2, vals[i] / vals[0] * 100)) : 0) + '%';
    bar.style.background = i === worst - 1 ? '#ff5d8f' : '#6E45E0';
    const lab = div('hqp-flab', null, row);
    const nm = div('hqp-fname', null, lab);
    nm.textContent = String(label).replace(' ⌁store-wide', '');
    if (String(label).indexOf('⌁store-wide') > -1) div('hqp-fstore', ' (store-wide)', nm);
    div('hqp-fnum', nfmt(vals[i]), lab);
    if (i > 0) {
      const t = (R.stepTimes || {})[key];
      div('hqp-fdrop', pct(vals[i], vals[i - 1]) + '% make it from “' + String(steps[i - 1][1]).replace(' ⌁store-wide', '') + '”'
        + (t ? ' · ⌀ ' + fmtDur(t) + ' to get here' : ''), row);
    }
    if (i === worst - 1 && worst > 0) {
      div('hqp-fwork', '⟵ WORK HERE · only ' + pct(vals[worst], vals[i]) + '% continue to “'
        + String(steps[worst][1]).replace(' ⌁store-wide', '') + '”', row);
    }
    row.addEventListener('click', () => { note.hidden = false; note.textContent = why || label; });
  });
  if (explainNote) div('hqp-cap', explainNote, s);
}

export function renderShop(into, S) {
  const R = S.range;
  if (!R) { div('hqp-empty', 'reading the window…', into); return; }
  if (S.to === 'today' && !((R.kpis || {}).sessions)) {
    div('hqp-note', '⏳ waiting for GA4’s intraday data — today’s visits land here when Google catches up.', into).hidden = false;
  }
  renderFunnel(into, R, FUNNELS[0], 'Custom banana funnel',
    'make-a-banana → tee, sticker or magnet. Every step counts people, not events. The last two steps are store-wide, because Shopify fires them for the official line too. Tap a step to read what it measures.',
    'the highlighted step is the one people stall on — the page to fix, not the one they fail to reach');
  renderFunnel(into, R, FUNNELS[1], 'Official merch funnel', 'The /shop/ line.', null);
  // ⚠️ NOT A FUNNEL. The old page defined these three and never drew them,
  // and now I know why: taking the file is a SIBLING of clicking the ask, not
  // a step after it. Chained, it printed "1800% make it from" — so it is drawn
  // as what it is, one question with two answers.
  const ask = FUNNELS[2];
  const shown = stepVal(R, ask[0][0]);
  const s2 = section(into, 'The support ask',
    'The download card opens before any file moves and makes one honest ask. The two lines below are answers to it, not steps after it — the file is the no-thanks button.');
  const card = div('hqp-funnel', null, s2);
  const note2 = div('hqp-note', '', s2);
  note2.hidden = true;
  const topRow = div('hqp-fstep', null, card);
  const topBar = div('hqp-fbar', null, topRow);
  topBar.style.width = '100%';
  topBar.style.background = '#6E45E0';
  const topLab = div('hqp-flab', null, topRow);
  div('hqp-fname', ask[0][1], topLab);
  div('hqp-fnum', nfmt(shown), topLab);
  topRow.addEventListener('click', () => { note2.hidden = false; note2.textContent = ask[0][2]; });
  [ask[1], ask[2]].forEach((st, i) => {
    const v = stepVal(R, st[0]);
    const row = div('hqp-fstep', null, card);
    const bar = div('hqp-fbar', null, row);
    bar.style.width = Math.max(2, shown ? (v / shown) * 100 : 0) + '%';
    bar.style.background = i === 0 ? '#1F8A70' : '#4a4270';
    const lab = div('hqp-flab', null, row);
    div('hqp-fname', '↳ ' + st[1], lab);
    div('hqp-fnum', nfmt(v), lab);
    div('hqp-fdrop', shown >= MIN_N ? pct(v, shown) + '% of the cards shown' : 'needs 20 cards before a rate means anything', row);
    row.addEventListener('click', () => { note2.hidden = false; note2.textContent = st[2]; });
  });
}

// ════════════════════════════════════════════════════════════════════════════
// 🎠 THE WORLD — the areas are different products, so they get different
// questions. Each card carries its own.
// ════════════════════════════════════════════════════════════════════════════
export function renderWorld(into, S) {
  const R = S.range;
  if (!R) { div('hqp-empty', 'reading the window…', into); return; }
  const evs = R.events || [];
  const cnt = (n) => { const e = evs.find((x) => x.name === n); return e ? +e.v || 0 : 0; };

  let s = section(into, 'The world — one question per area', 'Each area is a different product, so each is asked a different thing. The card shows its headline door number and everything that happened inside it in this window.');
  AREAS.forEach((A) => {
    const mine = evs.filter((e) => e.name.indexOf(A.key + '_') === 0 || e.name === A.door);
    const total = mine.reduce((a, e) => a + (+e.v || 0), 0);
    const card = div('hqp-area' + (total ? '' : ' is-dead'), null, s);
    div('hqp-aname', A.icon + ' ' + A.name, card);
    if (!total) { div('hqp-empty', 'nobody came in this window', card); return; }
    div('hqp-aq', A.q, card);
    const door = cnt(A.door);
    if (!A.door) div('hqp-warn', '⚠ no arrival event — this area cannot answer “how many came” until one is added', card);
    else div('hqp-abig', nfmt(door) + '  ' + (EV_LABEL[A.door] || A.door), card);
    div('hqp-cap', nfmt(total) + ' things done inside', card);
    const acts = mine.filter((e) => e.name !== A.door).sort((a, b) => b.v - a.v).slice(0, 6);
    if (!acts.length) { div('hqp-empty', 'they arrived and did nothing else — the door works, the room does not', card); return; }
    const t = div('hqp-tbl', null, card);
    const note = div('hqp-note', '', card);
    note.hidden = true;
    acts.forEach((e) => {
      const row = div('hqp-trow is-tap', null, t);
      div('hqp-tk', EV_LABEL[e.name] || e.name, row);
      div('hqp-tv', nfmt(e.v), row);
      row.addEventListener('click', () => { note.hidden = false; note.textContent = e.name + ' — ' + explain(e.name).why; });
    });
  });
  div('hqp-cap', 'the rave, the park, the bay and the forge share one room until one of them is busy enough to fill its own — an empty room reads worse than a short one', s);

  // ── the shops inside the world ─────────────────────────────────────────
  s = section(into, 'The shops inside the world', 'Every storefront a banana can walk into. Some sell for coins and some take real money — the row says which.');
  SHOPS.forEach((sh) => {
    const vals = sh.steps.map(([k]) => cnt(k));
    const top = vals[0] || 0;
    const vmax = Math.max(1, ...vals);   // ⚠️ scale to the BIGGEST step: a till can predate its own door
    const card = div('hqp-area' + (vals.some((v) => v) ? '' : ' is-dead'), null, s);
    const head = div('hqp-aname', null, card);
    head.textContent = sh.icon + ' ' + sh.name + ' · ' + sh.where;
    if (sh.real) div('hqp-real', ' · real money', head);
    if (!vals.some((v) => v)) { div('hqp-empty', 'nobody walked in during this window', card); return; }
    const wrap = div('hqp-funnel', null, card);
    sh.steps.forEach(([key, label], i) => {
      const row = div('hqp-fstep', null, wrap);
      const bar = div('hqp-fbar', null, row);
      bar.style.width = Math.max(2, (vals[i] / vmax) * 100) + '%';
      bar.style.background = sh.real ? '#C85A1E' : '#1F8A70';
      const lab = div('hqp-flab', null, row);
      div('hqp-fname', label, lab);
      div('hqp-fnum', nfmt(vals[i]) + (i > 0 && vals[i - 1] >= MIN_N && vals[i] <= vals[i - 1]
        ? '  ·  ' + pct(vals[i], vals[i - 1]) + '% of the step above' : ''), lab);
    });
    if (sh.aside) {
      const av = cnt(sh.aside[0]);
      if (av) div('hqp-cap', '⤷ ' + nfmt(av) + ' ' + sh.aside[1], card);
    }
    if (sh.steps.length > 1 && top >= MIN_N && !vals[vals.length - 1]) {
      div('hqp-warn', '⚠ ' + nfmt(top) + ' came in and nobody reached the last step — that is the shop to work on', card);
    }
  });
}
