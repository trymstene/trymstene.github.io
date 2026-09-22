// 📊 GOOGLE'S FLOORS — the renderers that read a WINDOW (Visitors, Business,
// the World's area cards) and the live lists on the Now floor.
//
// ⚠️ THINGS THAT LOOK LIKE DETAILS AND ARE NOT:
//   · `daily` is NOT zero-filled — a dead day is MISSING from the array, so a
//     chart must fill the gaps or it draws a lie with a straight line
//   · funnel steps count PEOPLE (`u`), never events (`v`): six shop views can
//     be two humans
//   · a rate needs 20 behind it before it is printed at all
//   · every ▲▼ comes from a SECOND range call for the previous window; the
//     payload carries no comparison of its own
//   · every section wears a chip: GOOGLE · <the window> — and never a live
//     number beside a window number (22 Sep 2026)
import { section, tile, lineChart, barsH, grid, div, nfmt, pct, chip } from './hq-pulse.js';
import { headText, CARD_LIST } from '../data/pack-heads.js';
import { EV_LABEL, explain } from '../data/pulse-events.js';
import { flag, place, FUNNELS, DL_NAMES, AREAS, SHOPS } from '../data/pulse-dicts.js';
import { windowWord } from '../data/hq-words.js';

const MIN_N = 20;
const DEV_ICON = { desktop: '🖥', mobile: '📱', tablet: '📟' };
const SKIP_EV = new Set(['session_start', 'first_visit']);
export const WINDOWS = [['today', 'today', 'TODAY'], ['yesterday', 'yesterday', 'YESTERDAY'],
  ['6daysAgo', 'today', '7 DAYS'], ['27daysAgo', 'today', '28 DAYS']];

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
const fmtDur = (n) => (n < 90 ? Math.round(n) + 's' : Math.floor(n / 60) + 'm ' + Math.round(n % 60) + 's');

// ── the window chips, drawn at the top of every Google floor ───────────────
export function windowBar(host, S, pick) {
  const bar = div('ps-range', null, host);
  div('ps-rlab', '📅 window', bar);
  WINDOWS.forEach(([f, t, label]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ps-chip';
    b.textContent = label;
    b.setAttribute('aria-pressed', String(S.from === f && S.to === t));
    b.addEventListener('click', () => pick(f, t));
    bar.appendChild(b);
  });
  div('ps-rnote', 'Google’s report for the window. Client-fired and consent-gated: an adblocker or a declined banner hides a visit, and today lags by hours.', bar);
  return bar;
}

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

// a page path → the name a reader knows; longest prefix wins
export function pageName(page) {
  const p = String(page || '');
  let best = null;
  for (const [pre, name] of DL_NAMES) if (p.indexOf(pre) === 0 && (!best || pre.length > best[0].length)) best = [pre, name];
  if (!best) return p === '/' ? 'The front page' : p;
  const rest = p.slice(best[0].length).replace(/\/$/, '');
  return rest ? best[1] + ' · ' + rest.split('/').pop().replace(/-/g, ' ') : best[1];
}

// ═══════════════════════════════════════════════════════════════════════════
// 📊 VISITORS — who came, from where, what they read and did
// ═══════════════════════════════════════════════════════════════════════════
export function renderVisitors(into, S, mapCard) {
  const R = S.range, P = S.prev;
  const W = windowWord(S.from, S.to);
  if (!R) { div('hqp-empty', 'reading Google’s report…', into); return; }
  const k = R.kpis || {};
  const pk = (P && P.kpis) || {};

  let s = section(into, 'Visits in this window', 'A visit is one session on the site; a visitor is a person, counted once for the whole window. An engaged visit stayed ten seconds, saw two pages or did something. Every arrow compares this window with the one just before it, of the same length.', { src: 'goog', when: W });
  const g = div('hqp-tiles', null, s);
  tile(g, 'visits', nfmt(k.sessions), delta(k.sessions, pk.sessions) || 'sessions, in Google’s words');
  tile(g, 'visitors', nfmt(k.users), delta(k.users, pk.users) || 'people, counted once');
  tile(g, 'first-time visitors', nfmt(k.newUsers), delta(k.newUsers, pk.newUsers) || 'never seen before');
  tile(g, 'engaged visits', Math.round((k.engagementRate || 0) * 100) + '%', delta(k.engagementRate, pk.engagementRate) || 'of all visits');
  const dv = (R.devices || []).slice().sort((x, y) => y.sessions - x.sessions);
  const top = dv[0];
  tile(g, top ? 'on ' + (top.dev === 'desktop' ? 'desktop' : top.dev + 's') : 'devices',
    top ? pct(top.sessions, k.sessions) + '%' : '—',
    dv.map((d) => (DEV_ICON[d.dev] || d.dev) + ' ' + pct(d.sessions, k.sessions) + '%').join(' · ') || 'no device data');
  if (S.to === 'today' && !k.sessions) {
    div('hqp-note', 'Google has not produced today’s report yet — its own lag, sometimes 12 hours. The Now floor is unaffected, and today’s numbers fill in on their own.', s).hidden = false;
  }
  const daily = fillDaily(R.daily, 'sessions');
  if (daily.length > 1) {
    lineChart(s, daily, { label: 'visits per day' });
    div('hqp-cap', 'visits per day · a day with nothing is a real zero, not a gap', s);
    const mau = fillDaily(R.daily, 'a28');
    const wau = fillDaily(R.daily, 'a7');
    if (mau.some((x) => x.v > 0)) {
      lineChart(s, mau.map((x, i) => ({ d: x.d, v: x.v, w: (wau[i] && wau[i].v) || 0 })), {
        label: 'people on the site, 28-day and 7-day', color: '#ffd83d', label1: '28-day',
        second: { key: 'w', label: '7-day', color: '#5ec8e0' },
      });
      div('hqp-cap', 'people on the site in the last 28 days (yellow) and the last 7 (blue) — Google’s own rolling windows, so a campaign stays in the yellow line for four weeks after it stops', s);
    }
  }

  // ── which pages they read (22 Sep 2026) ──────────────────────────────────
  s = section(into, 'Which pages they read', 'Every page with a visit in the window, biggest first: how many visits touched it, how many times it was viewed, how many people, and the time they spent on it on average.', { src: 'goog', when: W });
  if (R.pages === undefined) div('hqp-empty', 'the page report needs the newer pulse worker — deploy worker-pulse', s);
  else if (R.pages === null) div('hqp-empty', 'Google did not answer the page report — try another window', s);
  else if (!R.pages.length) div('hqp-empty', 'no pages in this window', s);
  else {
    const hasSess = R.pages.some((p) => p.sessions != null);
    grid(s, [
      { h: 'page', w: 'minmax(12rem, 1fr)' },
      ...(hasSess ? [{ h: 'visits', w: '4.6rem', num: true }] : []),
      { h: 'views', w: '4.6rem', num: true },
      { h: 'people', w: '4.8rem', num: true },
      { h: 'time on it', w: '5.4rem', num: true },
    ], R.pages.map((p) => {
      const kcell = div('', pageName(p.page), null);
      if (pageName(p.page) !== p.page) div('hqp-gsub', p.page, kcell);
      return [kcell, ...(hasSess ? [nfmt(p.sessions)] : []), nfmt(p.views), nfmt(p.users),
        p.views ? fmtDur(p.secs / p.views) : null];
    }));
  }

  // ── where they came from ────────────────────────────────────────────────
  s = section(into, 'Where they came from', 'Visits by source and medium, with how engaged each one was and how many pages it read. Campaigns get their own table only when a real utm campaign lands.', { src: 'goog', when: W });
  barsH(s, (R.sources || []).slice(0, 8).map((x) => ({ k: x.source || '(direct)', v: x.sessions })), { mono: '#2F7BD6' });
  const srcRows = (R.sources || []).slice(0, 8);
  if (srcRows.length) {
    grid(s, [
      { h: 'source', w: 'minmax(9rem, 1fr)' },
      { h: 'medium', w: 'minmax(5rem, auto)' },
      { h: 'visits', w: '5.2rem', num: true },
      { h: 'engaged', w: '4.8rem', num: true },
      { h: 'pages each', w: '5.6rem', num: true },
    ], srcRows.map((x) => [x.source || '(direct)', x.medium || '—', nfmt(x.sessions),
      pct(x.engaged, x.sessions) + '%',
      x.sessions ? (x.views / x.sessions).toFixed(1) : '0']));
  }
  const camps = (R.camps || []).filter((c) => c.name && c.name !== '(not set)');
  if (camps.length) {
    const cs = section(into, 'Campaigns', 'utm_campaign by utm_content. Shown only when a real campaign lands, so an empty table never implies a dead ad.', { src: 'goog', when: W });
    grid(cs, [
      { h: 'campaign', w: 'minmax(9rem, 1fr)' },
      { h: 'content', w: 'minmax(6rem, auto)' },
      { h: 'visits', w: '5.2rem', num: true },
      { h: 'engaged', w: '4.8rem', num: true },
    ], camps.map((c) => [c.name, c.content || '—', nfmt(c.sessions), pct(c.engaged, c.sessions) + '%']));
  }

  // ── the window's map ──────────────────────────────────────────────────────
  if (typeof mapCard === 'function') {
    s = section(into, 'Where visitors were', 'Every visit in the window, by country. Pick one thing people did to see where that happened instead. Tap a dot to keep its label.', { src: 'goog', when: W });
    mapCard(s);
  }

  // ── what they did ───────────────────────────────────────────────────────
  s = section(into, 'What they did', 'Every event in the window, biggest first. Tap a row to read what it means — that explainer is the only written record of what these events measure and where they mislead.', { src: 'goog', when: W });
  const evs = (R.events || []).filter((e) => !SKIP_EV.has(e.name)).slice(0, 25);
  const note = div('hqp-note', '', s);
  note.hidden = true;
  if (!evs.length) { div('hqp-empty', 'no events in this window', s); return; }
  const evTable = grid(s, [
    { h: 'what they did', w: 'minmax(11rem, 1fr)' },
    { h: 'times', w: '5rem', num: true },
    { h: 'people', w: '5rem', num: true },
  ], evs.map((e) => [div('', EV_LABEL[e.name] || e.name, null), nfmt(e.v), e.u ? nfmt(e.u) : null]));
  [...evTable.querySelectorAll('.hqp-grow')].slice(1).forEach((row, i) => {
    const e = evs[i];
    if (!e) return;
    row.style.cursor = 'pointer';
    row.addEventListener('click', () => { note.hidden = false; note.textContent = e.name + ' — ' + explain(e.name).why; });
  });
}

// ── who is on screen right now (the Now floor's lists) ─────────────────────
const DEVI = { mobile: '📱', desktop: '💻', tablet: '📲', smart_tv: '📺' };
export function renderNowLists(into, S) {
  const L = S.live;
  if (!L) { div('hqp-empty', 'waiting for the live read…', into); return; }
  let s = section(into, 'Pages open now', 'The pages people have open, from Google’s realtime feed: everyone active in the last 30 minutes.', { src: 'live', when: 'last 30 min' });
  const t = div('hqp-tbl', null, s);
  (L.pages || []).slice(0, 10).forEach((p) => {
    const row = div('hqp-trow', null, t);
    div('hqp-tk', String(p.page || '').replace(' | Trym Stene', ''), row);
    div('hqp-tv', nfmt(p.v), row);
  });
  if (!(L.pages || []).length) div('hqp-empty', 'nobody is reading anything right now', t);
  s = section(into, 'Cities', 'Where the people on the site now are reading from.', { src: 'live', when: 'last 30 min' });
  const t2 = div('hqp-tbl', null, s);
  (L.cities || []).slice(0, 12).forEach((c) => {
    const row = div('hqp-trow', null, t2);
    div('hqp-tk', place(c.cc, c.name || c.city), row);
    div('hqp-tv', nfmt(c.v), row);
  });
  if (!(L.cities || []).length) div('hqp-empty', 'no cities on the board', t2);
  const dev = Object.entries(L.devices || {}).sort((x, y) => y[1] - x[1]);
  if (dev.length) {
    const tot = dev.reduce((a2, d) => a2 + (+d[1] || 0), 0) || 1;
    const s3 = section(into, 'Devices', 'What the people on the site now are holding.', { src: 'live', when: 'last 30 min' });
    const strip = div('ps-devs', null, s3);
    dev.forEach(([name, v]) => {
      const c = div('ps-dev', null, strip);
      div('ps-devi', DEVI[name] || '🖥', c);
      div('ps-devn', name, c);
      div('ps-devv', nfmt(v) + '  ·  ' + Math.round((v / tot) * 100) + '%', c);
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 💰 BUSINESS — did a free file turn into a sale?
// ═══════════════════════════════════════════════════════════════════════════
const DLSET = new Set(['gif_download', 'png_download', 'wallpaper_download', 'offer_shown',
  'offer_click', 'offer_skip', 'offer_world', 'offer_discord', 'offer_support', 'offer_pack', 'offer_swap']);
export { DLSET };

// GA4's item_list_name → the place a person would recognise. The shop grid
// sends no list name, so GA4 files it under "(not set)".
const LIST_NAMES = {
  '(not set)': 'The shop grid', shop_custom_lane: 'The shop · custom lane',
  packs_gif_hero: 'The GIF page · pack carousel, top',
  packs_gif_hub: 'The GIF page · pack carousel, download hub',
};
function listName(l) {
  const k = String(l || '');
  if (LIST_NAMES[k]) return LIST_NAMES[k];
  if (k.indexOf(CARD_LIST) === 0) return 'Download card · “' + (headText(k.slice(CARD_LIST.length)) || k.slice(CARD_LIST.length)) + '”';
  if (k.indexOf('shopstrip_') === 0) return 'Shop strip · ' + k.slice(10).replace(/_/g, ' ');
  if (k.indexOf('packs_') === 0) return 'Pack carousel · ' + k.slice(6).replace(/_/g, ' ');
  return k || 'The shop grid';
}

// ⚠️ steps count PEOPLE (totalUsers), never raw events: six shop views from
// two visitors must read as two, or every step flatters itself
function stepVal(R, key) {
  if (key === 'sessions') return (R.kpis && R.kpis.sessions) || 0;
  if (key === 'transactions') return (R.kpis && R.kpis.transactions) || 0;
  const e = (R.events || []).find((x) => x.name === key);
  return e ? (e.u != null ? +e.u : +e.v) || 0 : 0;
}

function renderFunnel(host, R, steps, title, sub, explainNote, W) {
  const s = section(host, title, sub, { src: 'goog', when: W });
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
    bar.style.width = (vals[i] && vals[0] ? Math.min(100, Math.max(1.2, vals[i] / vals[0] * 100)) : 0) + '%';
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

export function renderBusiness(into, S, probe) {
  const R = S.range;
  const W = windowWord(S.from, S.to);
  // ── checkout works? a real cart test, its own card because it is Shopify's clock, not Google's
  let s = section(into, 'Checkout works?', 'A real cart test against the shop, run when this floor opens. The silent-unbuyable day: a whole product line once refused to sell for a day and nothing said so.', { src: 'shop', when: 'right now' });
  const gp = div('hqp-tiles', null, s);
  tile(gp, 'checkout', probe === null || probe === undefined ? '…' : probe === 'ok' ? '✓ yes' : probe === 'bad' ? '✗ CHECK IT' : '?',
    probe === 'bad' ? 'a product refuses to sell' : 'the cart accepts every product', probe === 'ok' ? 'ok' : probe === 'bad' ? 'warn' : '');
  if (!R) { div('hqp-empty', 'reading Google’s report…', into); return; }
  const k = R.kpis || {};

  s = section(into, 'Money, as Google counts it', 'Google’s revenue and purchase count for the window. It reads 0 while the Shopify → GA4 purchase link is broken, so Shopify’s own orders are the truth; this card exists so the day it starts counting is noticed.', { src: 'goog', when: W });
  const gm = div('hqp-tiles', null, s);
  tile(gm, 'revenue', Math.round(k.revenue || 0) + ' kr', 'Google · the link is broken');
  tile(gm, 'purchases', nfmt(k.transactions), 'Google · Shopify has the truth');
  if (S.to === 'today' && !k.sessions) {
    div('hqp-note', '⏳ waiting for Google’s intraday data — today’s visits land here when Google catches up.', s).hidden = false;
  }

  // ── free files ────────────────────────────────────────────────────────────
  const rows = R.downloads || [];
  s = section(into, 'Free files', 'Giving files away is the product here. Files is what was handed over; pack cards shown is the sticker-pack card that opens before every download; tap rate is pack taps over cards shown. A rate needs twenty cards behind it before it is printed: three out of five is three taps, not sixty per cent.', { src: 'goog', when: W });
  if (!rows.length) div('hqp-empty', 'no downloads in this window', s);
  else {
    const sum = (key) => rows.reduce((a, r) => a + (+r[key] || 0), 0);
    const tf = sum('files'), ts = sum('shown'), tc = sum('click'), tk = sum('skip');
    const tw = sum('world'), td = sum('disc'), tcof = sum('coffee');
    const tp = sum('pack'), tsw = sum('swap');
    const oldAsks = tw + td + tc + tcof;
    const sessions = k.sessions || 0;
    const g = div('hqp-tiles', null, s);
    tile(g, 'files taken', nfmt(tf));
    tile(g, 'per 100 visits', sessions ? (tf / sessions * 100).toFixed(1) : '–');
    tile(g, 'pack cards shown', nfmt(ts));
    tile(g, 'pack taps', nfmt(tp), 'tapped through to a pack');
    tile(g, 'tap rate', ts >= MIN_N ? (tp / ts * 100).toFixed(1) + '%' : '–', ts >= MIN_N ? 'of cards shown' : 'needs 20 cards');
    tile(g, 'browsed packs', nfmt(tsw), 'flipped through the minis');
    tile(g, 'took the file instead', nfmt(tk), 'the no-thanks button');
    if (oldAsks) tile(g, 'retired card buttons', nfmt(oldAsks), 'world · Discord · coffee · merch');
    div('hqp-cap', ts >= MIN_N
      ? 'Of every 100 people shown the card, ' + (tp / ts * 100).toFixed(1) + ' tapped through to a sticker pack. Sales land in Shopify, not here.'
      : 'Not enough cards yet to judge the ask — come back when a few hundred have been shown.', s);

    const dl = (R.dlDaily || []).slice().sort((a, b) => (a.d < b.d ? -1 : 1));
    if (dl.length) {
      const s2 = section(into, 'Files per day', 'One bar per day of the window. Tap a bar for that day’s files, cards and pack taps.', { src: 'goog', when: W });
      const wrap = div('hqp-bars2', null, s2);
      const dmax = Math.max(1, ...dl.map((r) => +r.files || 0));
      const note2 = div('hqp-note', '', null);
      dl.forEach((r) => {
        const col = div('hqp-b2', null, wrap);
        const fill = div('hqp-b2f', null, col);
        fill.style.height = (+r.files ? Math.max(2, Math.round((+r.files || 0) / dmax * 100)) : 0) + '%';
        const d = r.d.slice(6, 8) + '.' + r.d.slice(4, 6);
        col.addEventListener('click', () => {
          note2.hidden = false;
          const was = (r.world || 0) + (r.disc || 0) + (r.click || 0) + (r.coffee || 0);
          note2.textContent = d + ' — ' + (r.files || 0) + ' files, ' + (r.shown || 0) + ' cards shown, '
            + (r.pack || 0) + ' pack taps' + (was ? ', ' + was + ' on retired buttons' : '');
        });
      });
      s2.appendChild(note2);
      note2.hidden = true;
      div('hqp-cap', dl[0].d.slice(6, 8) + '.' + dl[0].d.slice(4, 6) + ' → '
        + dl[dl.length - 1].d.slice(6, 8) + '.' + dl[dl.length - 1].d.slice(4, 6)
        + ' · peak ' + dmax + ' in a day · tap a bar for the detail', s2);
    }

    const s5 = section(into, 'Downloads by page', 'Which page handed the file over, and what the pack card did there. The card rides every download, so cards shown should track files closely; a big gap on a page is wiring.', { src: 'goog', when: W });
    grid(s5, [
      { h: 'page', w: 'minmax(11rem, 1fr)' },
      { h: 'files', w: '4.2rem', num: true },
      { h: 'cards shown', w: '6.2rem', num: true },
      { h: 'pack taps', w: '5.4rem', num: true },
      { h: 'took the file', w: '6rem', num: true },
      { h: 'tap rate', w: '4.8rem', num: true },
    ], rows.slice().sort((a, b) => (+b.files || 0) - (+a.files || 0)).map((r) => {
      const kcell = div('', null, null);
      kcell.textContent = pageName(r.page);
      if ((+r.files || 0) >= MIN_N && !(+r.shown || 0)) div('hqp-warn', ' ⚠ no card shown', kcell);
      return [kcell, nfmt(r.files), nfmt(r.shown), nfmt(r.pack || 0), nfmt(r.skip),
        (+r.shown || 0) >= MIN_N ? ((+r.pack || 0) / r.shown * 100).toFixed(1) + '%' : null];
    }));

    const em = R.eventMap || {};
    const geo = {};
    ['gif_download', 'png_download', 'wallpaper_download'].forEach((key) => {
      Object.entries(em[key] || {}).forEach(([cc, v]) => { geo[cc] = (geo[cc] || 0) + (+v || 0); });
    });
    const geoRows = Object.entries(geo).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const s3 = section(into, 'Downloads by country', 'The ten countries that took the most files in the window.', { src: 'goog', when: W });
    const t3 = div('hqp-tbl', null, s3);
    geoRows.forEach(([cc, v]) => {
      const row = div('hqp-trow', null, t3);
      div('hqp-tk', place(cc), row);
      div('hqp-tv', nfmt(v), row);
    });
    if (!geoRows.length) div('hqp-empty', 'no country data in this window', t3);
  }

  // ── the pack card: one question, two answers ─────────────────────────────
  const ask = FUNNELS[2];
  const shown = stepVal(R, ask[0][0]);
  const s2 = section(into, 'The pack card', 'The download card opens before any file moves and shows a sticker pack. The two lines under it are answers, not steps after it — taking the file is the no-thanks button. Counted in people.', { src: 'goog', when: W });
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
    bar.style.width = (v && shown ? Math.max(2, (v / shown) * 100) : 0) + '%';
    bar.style.background = i === 0 ? '#1F8A70' : '#4a4270';
    const lab = div('hqp-flab', null, row);
    div('hqp-fname', '↳ ' + st[1], lab);
    div('hqp-fnum', nfmt(v), lab);
    div('hqp-fdrop', shown >= MIN_N ? pct(v, shown) + '% of the cards shown' : 'needs 20 cards before a rate means anything', row);
    row.addEventListener('click', () => { note2.hidden = false; note2.textContent = st[2]; });
  });
  const lists = R.lists;
  const heads = (lists || []).filter((l) => String(l.list || '').indexOf(CARD_LIST) === 0);
  if (lists && heads.length) {
    const s3 = section(into, 'Which headline works', 'Each download card shows one headline at random. A row is a headline: tapped / shown, and the rate once twenty cards have carried it. The words live in src/data/pack-heads.js — add a line there and it appears here.', { src: 'goog', when: W });
    const t3 = div('hqp-tbl', null, s3);
    heads.slice().sort((a, b) => (+b.views || 0) - (+a.views || 0)).forEach((l) => {
      const row = div('hqp-trow', null, t3);
      div('hqp-tk', '“' + (headText(l.list.slice(CARD_LIST.length)) || l.list) + '”', row);
      const v = +l.views || 0, c = +l.clicks || 0;
      div('hqp-tv', nfmt(c) + ' / ' + nfmt(v) + (v >= MIN_N ? ' · ' + (c / v * 100).toFixed(1) + '%' : ' · needs 20'), row);
    });
  }

  // ── the two funnels ───────────────────────────────────────────────────────
  renderFunnel(into, R, FUNNELS[0], 'From a custom banana to an order',
    'The make-a-banana line: a tee, a sticker or a magnet with their banana on it. Every step counts people, not events. The last two steps are store-wide, because Shopify fires them for the official line too. Tap a step to read what it measures.',
    'the highlighted step is the one people stall on — the page to fix, not the one they fail to reach', W);
  renderFunnel(into, R, FUNNELS[1], 'From the shop to a purchase', 'The official merch line, from the /shop/ grid to a paid order. Purchases read 0 while the purchase link is broken.', null, W);
  if (lists) {
    const s1 = section(into, 'Where product clicks come from', 'Every product tile click, by the list it sat in: the shop grid, a shop strip on a content page, the GIF page’s pack carousel.', { src: 'goog', when: W });
    if (!lists.length) div('hqp-empty', 'no product clicks in this window', s1);
    else {
      const t1 = div('hqp-tbl', null, s1);
      lists.slice().sort((a, b) => (+b.clicks || 0) - (+a.clicks || 0)).forEach((l) => {
        const row = div('hqp-trow', null, t1);
        div('hqp-tk', listName(l.list), row);
        div('hqp-tv', nfmt(l.clicks || 0), row);
      });
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 🌍 THE WORLD — one card per place, and each card asks its own question
// ═══════════════════════════════════════════════════════════════════════════
const LIVE_KEY = { rave: 'rave', park: 'park', beach: 'beach', town: 'town' };
export function renderWorldCards(into, S) {
  const R = S.range;
  const W = windowWord(S.from, S.to);
  const counts = S.counts || {};
  const evs = (R && R.events) || [];
  const cnt = (n) => { const e = evs.find((x) => x.name === n); return e ? +e.v || 0 : 0; };

  let s = section(into, 'Each place, one question', 'Every place in Banana World is a different product, so each card asks its own question. The big number is the door: how many came in during the window. Where a room keeps a live count, it is written on the card too.', { src: 'goog', when: W });
  const wrap = div('hqp-areas', null, s);
  AREAS.forEach((A) => {
    const mine = evs.filter((e) => e.name.indexOf(A.key + '_') === 0 || e.name === A.door);
    const total = mine.reduce((a, e) => a + (+e.v || 0), 0);
    const card = div('hqp-area' + (total ? '' : ' is-dead'), null, wrap);
    div('hqp-aname', A.icon + ' ' + A.name, card);
    const lk = LIVE_KEY[A.key];
    if (lk && counts[lk] != null) {
      const live = div('hqp-alive', null, card);
      chip('live', 'now', live);
      div('hqp-alivev', nfmt(counts[lk]) + (counts[lk] === 1 ? ' banana here now' : ' bananas here now'), live);
    }
    if (!R) { div('hqp-empty', 'reading Google’s report…', card); return; }
    if (!total) { div('hqp-empty', 'nobody came in this window', card); return; }
    div('hqp-aq', A.q, card);
    const door = cnt(A.door);
    if (!A.door) div('hqp-warn', '⚠ no arrival event — this area cannot answer “how many came” until one is added', card);
    else {
      const big = div('hqp-abig', null, card);
      div('hqp-abigv', nfmt(door), big);
      div('hqp-abigl', EV_LABEL[A.door] || A.door, big);
    }
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

  if (!R) return;
  s = section(into, 'The shops inside', 'Every storefront a banana can walk into. Some sell for coins and some take real money — the card says which.', { src: 'goog', when: W });
  const shops = div('hqp-shops', null, s);
  SHOPS.forEach((sh) => {
    const vals = sh.steps.map(([key]) => cnt(key));
    const top = vals[0] || 0;
    const vmax = Math.max(1, ...vals);   // ⚠️ scale to the BIGGEST step: a till can predate its own door
    const card = div('hqp-area' + (vals.some((v) => v) ? '' : ' is-dead'), null, shops);
    const head = div('hqp-aname', null, card);
    head.textContent = sh.icon + ' ' + sh.name + ' · ' + sh.where;
    if (sh.real) div('hqp-real', ' · real money', head);
    if (!vals.some((v) => v)) { div('hqp-empty', 'nobody walked in during this window', card); return; }
    const fw = div('hqp-funnel', null, card);
    sh.steps.forEach(([key, label], i) => {
      const row = div('hqp-fstep', null, fw);
      const bar = div('hqp-fbar', null, row);
      bar.style.width = (vals[i] ? Math.max(2, (vals[i] / vmax) * 100) : 0) + '%';
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

// ── 🎫 the ask: from the blinking pill to a kept pass (the Players floor) ──
export function renderAsk(into, S) {
  const R = S.range;
  const W = windowWord(S.from, S.to);
  const s = section(into, 'From the “not saved” pill to a kept pass', 'The amber pill in the world HUD blinks only for anonymous players with something to lose. Each step counts people: saw it, tapped it, asked for a login link, logged in. The step to watch is saw → tapped; the pass page owns the rest.', { src: 'goog', when: W });
  if (!R) { div('hqp-empty', 'reading Google’s report…', s); return; }
  const evs = R.events || [];
  const ppl = (n) => { const e = evs.find((x) => x.name === n); return e ? (+e.u || +e.v || 0) : 0; };
  const askShown = ppl('pass_ask_shown'), askTap = ppl('pass_ask_tap');
  const askLink = ppl('pass_mail_signin'), askIn = ppl('pass_mail_login') + ppl('pass_mail_attached');
  const ga = div('hqp-tiles', null, s);
  tile(ga, 'saw the pill', nfmt(askShown), askShown ? 'people' : 'nobody yet');
  tile(ga, 'tapped the pill', nfmt(askTap), askShown >= MIN_N ? (askTap / askShown * 100).toFixed(1) + '% of them' : 'needs 20 shown');
  tile(ga, 'asked for a link', nfmt(askLink), 'typed an email');
  tile(ga, 'logged in', nfmt(askIn), 'kept for good');
  const wall = ppl('park_citizens'), wallKeep = ppl('citizens_keep');
  tile(ga, 'citizens’ wall opened', nfmt(wall), wall ? 'people' : 'nobody yet');
  tile(ga, 'keep-my-pass from the wall', nfmt(wallKeep), wall >= MIN_N ? (wallKeep / wall * 100).toFixed(1) + '% of them' : 'needs 20 opens');
}

// ── 🚨 phones that could not save (the Dev floor) ─────────────────────────
export function renderSync(into, S) {
  const R = S.range;
  const W = windowWord(S.from, S.to);
  const s = section(into, 'Phones that could not save', 'Every time a phone could not save its homestead or its pass it says so on screen and sends one of these. Zero is the only good number. A re-addressed homestead or a re-minted pass is a heal that worked — the phone kept everything.', { src: 'goog', when: W });
  if (!R) { div('hqp-empty', 'reading Google’s report…', s); return; }
  const evs = R.events || [];
  const ppl = (n) => { const e = evs.find((x) => x.name === n); return e ? (+e.u || +e.v || 0) : 0; };
  const refused = ppl('homestead_save_refused'), reatt = ppl('homestead_reattach');
  const prefused = ppl('pass_sync_refused'), reminted = ppl('pass_reminted');
  const gs = div('hqp-tiles', null, s);
  tile(gs, 'homestead saves refused', nfmt(refused), refused ? 'people' : 'none', refused ? 'warn' : 'ok');
  tile(gs, 'homesteads re-addressed', nfmt(reatt), 'healed');
  tile(gs, 'pass syncs refused', nfmt(prefused), prefused ? 'people' : 'none', prefused ? 'warn' : 'ok');
  tile(gs, 'passes re-minted', nfmt(reminted), 'healed');
  if (refused || prefused) div('hqp-warn', '⚠ ' + nfmt(refused + prefused) + ' phones hit a wall in this window — the why rides the event (token · unclaimed · offline)', s);
}
