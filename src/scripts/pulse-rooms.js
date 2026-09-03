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
