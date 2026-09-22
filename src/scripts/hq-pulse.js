// 📈 SERVER TRUTH — Banana World's own numbers, from the workers rather than
// from Google, plus the chart primitives every floor of Banana HQ draws with.
//
// Everything rendered by the render* functions here is server truth: no
// consent gate, no adblock loss, no sampling, no zero-row omission. Charts are
// hand-rolled SVG — no library, no CDN, no CSP argument.
//
//   renderPlayersRoll(el, { roll })            passes, activity, growth, retention, the kept-pass funnel, login links
//   renderEconomy(el, { roll })                coins by place and by source, refusals — all in plain words
//   renderHomesteads(el, { world })            the yard census and the neighbours
//   renderArcade(el, { arcade, arcadeWipe })   the five boards
//   renderHealth(el, { roll, world })          the ledger's own checks
//   renderLetters(el, letters, drop)           the post review queue, in one of three honest states
//
// ⚠️ EVERY SECTION WEARS A CHIP (22 Sep 2026). A card says where its number
// comes from and what time it measures, or the reader cannot tell a rollup
// from a census from Google. section() takes { src, when } and draws it.
//
// ⚠️ Colour does one job at a time. Areas and faucets carry IDENTITY, so they
// use the fixed categorical order below (validated for CVD separation against
// this desk's own dark surface — re-run tools before changing a hex). Single
// series wear ink, never a category colour. Status is reserved for state.
import { faucet, area as areaName, refusal, SOURCE } from '../data/hq-words.js';

// the categorical theme, in fixed order and never cycled
const CAT = ['#6E45E0', '#1F8A70', '#C85A1E', '#2F7BD6', '#A8447C'];
const AREA_C = { rave: CAT[0], park: CAT[1], homestead: CAT[2], beach: CAT[3], pass: CAT[4] };
const INK = '#f4eeff', DIM = '#9a90b8', GRID = 'rgba(244,238,255,.10)', LINE = '#ffe135';
const BAD = '#ff5d8f';
const catOf = (name, i) => AREA_C[name] || CAT[i % CAT.length];
const svgNS = 'http://www.w3.org/2000/svg';

const mk = (tag, attrs, parent) => {
  const e = document.createElementNS(svgNS, tag);
  for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
};
export const div = (cls, txt, parent) => {
  const e = document.createElement('div');
  if (cls) e.className = cls;
  if (txt != null) e.textContent = txt;
  if (parent) parent.appendChild(e);
  return e;
};
export const nfmt = (n) => (n >= 10000 ? Math.round(n / 1000) + 'k' : n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(Math.round(n || 0)));
export const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ── the chip: one word for the source, then the time it measures ───────────
export function chip(src, when, parent) {
  const c = document.createElement('span');
  c.className = 'hqp-chip is-' + (src || 'serv');
  c.textContent = (SOURCE[src] || SOURCE.serv) + (when ? ' · ' + when : '');
  if (parent) parent.appendChild(c);
  return c;
}

// ── a section: a title, its chip, and ONE VISIBLE SENTENCE saying what it
//    counts. The rest of the explainer opens with "more". The old (i) button
//    hid the best sentences on the desk behind a 22px circle.
//    meta = { src, when, deck }; with no deck the note's first sentence is it.
export function section(host, title, note, meta) {
  const m = meta || {};
  const s = div('hqp-sec', null, host);
  s.id = 'hq-' + slug(title);
  s.dataset.title = title;
  const h = div('hqp-h', null, s);
  div('hqp-htitle', title, h);
  if (m.src) chip(m.src, m.when, h);
  let deck = m.deck || '', rest = note || '';
  if (!deck && rest) {
    const cut = rest.search(/[.!?]\s/);
    if (cut > 0 && cut < rest.length - 2) { deck = rest.slice(0, cut + 1); rest = rest.slice(cut + 2).trim(); }
    else { deck = rest; rest = ''; }
  }
  if (deck) {
    const p = div('hqp-deck', deck, s);
    if (rest) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'hqp-more';
      b.textContent = 'more';
      b.setAttribute('aria-expanded', 'false');
      const note2 = div('hqp-note', rest, s);
      note2.hidden = true;
      b.addEventListener('click', () => { note2.hidden = !note2.hidden; b.textContent = note2.hidden ? 'more' : 'less'; b.setAttribute('aria-expanded', String(!note2.hidden)); });
      p.appendChild(document.createTextNode(' '));
      p.appendChild(b);
    }
  }
  return s;
}

// 📊 A REAL TABLE — one column per number, each under its own header.
//   cols = [{ h: 'page', w: 'minmax(9rem, 1fr)' }, { h: 'visits', w: '4.4rem', num: true }, ...]
//   rows = [[keyNodeOrString, v1, v2, ...], ...]
// A value of null prints an em dash; a 0 prints quiet, because a zero is not
// a finding and should not shout like one.
export function grid(host, cols, rows) {
  const wrap = div('hqp-grid', null, host);
  const inner = div('hqp-gin', null, wrap);
  inner.style.setProperty('--cols', cols.map((c) => c.w || 'auto').join(' '));
  const head = div('hqp-grow is-head', null, inner);
  cols.forEach((c) => {
    const e = div('hqp-gh', c.h, head);
    if (c.num) e.style.textAlign = 'right';
  });
  rows.forEach((r) => {
    const row = div('hqp-grow', null, inner);
    r.forEach((v, i) => {
      const c = cols[i] || {};
      if (v && v.nodeType) { v.classList.add(c.num ? 'hqp-gv' : 'hqp-gk'); row.appendChild(v); return; }
      const zero = c.num && (v === 0 || v === '0');
      const e = div((c.num ? 'hqp-gv' : 'hqp-gk') + (zero ? ' is-zero' : ''),
        v == null ? '—' : String(v), row);
      if (c.num) e.style.textAlign = 'right';
    });
  });
  return wrap;
}

export function tile(host, label, value, sub, tone) {
  const t = div('hqp-tile' + (tone ? ' is-' + tone : ''), null, host);
  div('hqp-tval', value, t);
  div('hqp-tlab', label, t);
  if (sub) div('hqp-tsub', sub, t);
  return t;
}

// ── change over time: one series, so it wears ink and needs no legend ──────
export function lineChart(host, pts, opts) {
  const o = opts || {};
  // ⚠️ SVG text scales with the viewBox. Sizing the viewBox to the real box
  // keeps the scale near 1 and the labels at the size they say they are. On a
  // wide desk the chart may grow to 1120px, flatter, so it does not become a wall.
  const box = Math.round(host.clientWidth || 640);
  const W = Math.max(320, Math.min(1120, box || 640));
  const H = Math.round(W * (W > 760 ? 0.26 : 0.4)) + 60, L = 40, R = 12, T = 16, B = 28;
  const wrap = div('hqp-chart', null, host);
  const svg = mk('svg', { viewBox: `0 0 ${W} ${H}`, class: 'hqp-svg', role: 'img',
    'aria-label': o.label || 'trend' }, wrap);
  if (!pts.length) { div('hqp-empty', 'no days rolled up yet', wrap); return; }
  // ⚠️ A SECOND SERIES SHARES THE SCALE, or the comparison lies.
  const k2 = o.second && o.second.key;
  const max = Math.max(1, ...pts.map((p) => p.v), ...(k2 ? pts.map((p) => +p[k2] || 0) : []));
  const x = (i) => L + (i * (W - L - R)) / Math.max(1, pts.length - 1);
  const y = (v) => T + (H - T - B) * (1 - v / max);
  [0, 0.5, 1].forEach((f) => {
    const yy = y(max * f);
    mk('line', { x1: L, x2: W - R, y1: yy, y2: yy, stroke: GRID, 'stroke-width': 1 }, svg);
    mk('text', { x: 6, y: yy + 4, fill: DIM, 'font-size': 12 }, svg).textContent = nfmt(max * f);
  });
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  if (!k2) {
    const gid = 'hqpg' + (host.childElementCount + 1) + '-' + Math.round(max);
    const grad = mk('linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 }, mk('defs', {}, svg));
    mk('stop', { offset: '0%', 'stop-color': o.color || LINE, 'stop-opacity': 0.34 }, grad);
    mk('stop', { offset: '100%', 'stop-color': o.color || LINE, 'stop-opacity': 0.02 }, grad);
    mk('path', { d: `${d} L${x(pts.length - 1)},${y(0)} L${x(0)},${y(0)} Z`, fill: 'url(#' + gid + ')' }, svg);
  }
  mk('path', { d, fill: 'none', stroke: o.color || LINE, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
  if (k2) {
    const d2 = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(+p[k2] || 0).toFixed(1)}`).join(' ');
    mk('path', { d: d2, fill: 'none', stroke: o.second.color || '#5ec8e0', 'stroke-width': 2,
      'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
    const l2 = pts[pts.length - 1][k2] || 0;
    mk('circle', { cx: x(pts.length - 1), cy: y(l2), r: 4, fill: o.second.color || '#5ec8e0',
      stroke: '#171326', 'stroke-width': 2 }, svg);
    const t2 = mk('text', { x: x(pts.length - 1) - 8, y: Math.min(H - B - 4, y(l2) + 16), fill: o.second.color || '#5ec8e0',
      'font-size': 12, 'font-weight': 700, 'text-anchor': 'end' }, svg);
    t2.textContent = nfmt(l2) + ' ' + (o.second.label || '');
  }
  const last = pts[pts.length - 1];
  mk('circle', { cx: x(pts.length - 1), cy: y(last.v), r: 4, fill: o.color || LINE, stroke: '#171326', 'stroke-width': 2 }, svg);
  const lx = x(pts.length - 1);
  const t1 = mk('text', { x: lx - 8, y: Math.max(T + 12, y(last.v) - 10), fill: INK, 'font-size': 13,
    'font-weight': 700, 'text-anchor': 'end' }, svg);
  t1.textContent = nfmt(last.v) + (k2 ? ' ' + (o.label1 || '') : '');
  [0, pts.length - 1].forEach((i) => {
    if (!pts[i]) return;
    const tx = mk('text', { x: x(i), y: H - 8, fill: DIM, 'font-size': 12,
      'text-anchor': i === 0 ? 'start' : 'end' }, svg);
    const lab = String(pts[i].d || '');
    tx.textContent = /^\d{4}-\d{2}-\d{2}$/.test(lab) ? lab.slice(5) : lab;
  });
  const tip = div('hqp-tip', null, wrap);
  tip.hidden = true;
  const cross = mk('line', { y1: T, y2: H - B, stroke: GRID, 'stroke-width': 1, opacity: 0 }, svg);
  const at = (ev) => {
    const r = svg.getBoundingClientRect();
    const px = ((ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left) / r.width * W;
    let i = Math.round(((px - L) / (W - L - R)) * (pts.length - 1));
    i = Math.max(0, Math.min(pts.length - 1, i));
    cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i)); cross.setAttribute('opacity', 1);
    tip.hidden = false;
    tip.textContent = pts[i].d + ' · ' + nfmt(pts[i].v) + (o.label1 ? ' ' + o.label1 : '')
      + (k2 ? '  ·  ' + nfmt(+pts[i][k2] || 0) + ' ' + (o.second.label || '') : '');
    tip.style.left = Math.max(0, Math.min(100, (x(i) / W) * 100)) + '%';
  };
  svg.addEventListener('pointermove', at);
  svg.addEventListener('pointerdown', at);
  svg.addEventListener('pointerleave', () => { tip.hidden = true; cross.setAttribute('opacity', 0); });
}

// ── magnitude by category: horizontal bars, direct-labelled, no legend box ──
export function barsH(host, rows, opts) {
  const o = opts || {};
  const wrap = div('hqp-bars', null, host);
  if (!rows.length) { div('hqp-empty', o.empty || 'nothing yet', wrap); return; }
  const max = Math.max(1, ...rows.map((r) => r.v));
  rows.forEach((r, i) => {
    const row = div('hqp-bar', null, wrap);
    const lab = div('hqp-blab', r.k, row);
    if (r.raw && r.raw !== r.k) lab.title = r.raw;
    const track = div('hqp-btrack', null, row);
    const fill = div('hqp-bfill', null, track);
    fill.style.width = (r.v ? Math.max(2, (r.v / max) * 100) : 0) + '%';
    fill.style.background = o.mono || catOf(r.raw || r.k, i);
    div('hqp-bval', nfmt(r.v), row);
  });
}

// ── a rate needs its denominator, and refuses to print under a sample gate ──
export function rate(host, label, hits, cohort) {
  const t = div('hqp-rate', null, host);
  const enough = cohort >= 20;
  div('hqp-rval', enough ? pct(hits, cohort) + '%' : '—', t);
  div('hqp-rlab', label, t);
  div('hqp-rsub', enough ? hits + ' of ' + cohort : 'needs 20 · has ' + cohort, t);
  return t;
}

// ── the funnel counts PEOPLE, and marks the step that is the work ──────────
export function funnel(host, steps) {
  const wrap = div('hqp-funnel', null, host);
  const top = Math.max(1, steps[0].v);
  steps.forEach((s, i) => {
    const row = div('hqp-fstep' + (s.work ? ' is-work' : ''), null, wrap);
    const bar = div('hqp-fbar', null, row);
    bar.style.width = Math.max(3, (s.v / top) * 100) + '%';
    bar.style.background = CAT[i % CAT.length];
    const lab = div('hqp-flab', null, row);
    div('hqp-fname', s.k, lab);
    div('hqp-fnum', nfmt(s.v) + (i ? '  ·  ' + pct(s.v, steps[i - 1].v) + '% of above' : ''), lab);
  });
}

// the last COMPLETE rollup day, or today's partial one — a row still being
// written is a partial scan of the pass store, not a quiet day
function lastDay(roll) {
  const days = ((roll && roll.days) || []).filter((d) => d && d.passes != null && d.done);
  return { days, now: days.length ? days[days.length - 1] : ((roll && roll.today) || null) };
}
const nope = (el) => div('hqp-empty', 'The rollup has not written a day yet. It walks the pass store every ten minutes; the first file lands within the hour.', el);

// ═══════════════════════════════════════════════════════════════════════════
// 🎫 PLAYERS — passes, activity, growth, retention, the kept-pass funnel
// ═══════════════════════════════════════════════════════════════════════════
export function renderPlayersRoll(el, data) {
  const { days, now } = lastDay(data.roll);
  if (!now) { nope(el); return; }
  const when = now.day + ' · the rollup';

  let s = section(el, 'Passes and who is active', 'A pass is a Banana World identity — anyone who has synced once, whether or not they ever typed an email. Active means the pass was seen that day. The pass worker counts all of it itself, so no consent banner or adblocker hides anyone.', { src: 'serv', when });
  let g = div('hqp-tiles', null, s);
  tile(g, 'passes', nfmt(now.passes), nfmt(now.anon) + ' never signed in');
  tile(g, 'active today', nfmt(now.dau), 'of ' + nfmt(now.mau) + ' this month');
  tile(g, 'active this week', nfmt(now.wau), nfmt(now.born7) + ' of them new');
  tile(g, 'share of the month here today', pct(now.dau, now.mau) + '%', 'active today ÷ active this month', pct(now.dau, now.mau) >= 20 ? 'ok' : '');
  if (days.length > 1) {
    lineChart(s, days.map((d) => ({ d: d.day, v: d.dau })), { label: 'active passes per day' });
    div('hqp-cap', 'active passes per day', s);
  }

  if (days.length > 1) {
    s = section(el, 'Growing?', 'Two lines, two questions. Passes ever made only goes up, so its slope is how fast new people arrive — flat means nobody new. Monthly actives can fall, and that line says whether the people already here still turn up.', { src: 'serv', when: days.length + ' rollup days' });
    lineChart(s, days.map((d) => ({ d: d.day, v: d.passes })), { label: 'passes ever made', color: '#7ee0a8' });
    div('hqp-cap', 'passes ever made — the slope is how fast new people arrive', s);
    lineChart(s, days.map((d) => ({ d: d.day, v: d.mau, wau: d.wau })), {
      label: 'monthly and weekly actives', color: '#ffd83d', label1: 'monthly',
      second: { key: 'wau', label: 'weekly', color: '#5ec8e0' },
    });
    div('hqp-cap', 'active in the last 30 days (yellow) and the last 7 (blue) — the gap is how much of the month shows up in a week', s);
    div('hqp-cap', days.length < 30
      ? days.length + ' days of rollup so far — the monthly line is still filling and reads low until it has 30.'
      : days.length + ' days of rollup.', s);
  }

  s = section(el, 'Coming back?', 'Of everyone old enough to qualify, the share who turned up again at least that many days after their first day. A rate is withheld under twenty people, because below that it is noise.', { src: 'serv', when });
  g = div('hqp-rates', null, s);
  rate(g, 'next day', now.ret.r1, now.ret.c1);
  rate(g, 'after a week', now.ret.r7, now.ret.c7);
  rate(g, 'after a month', now.ret.r30, now.ret.c30);

  s = section(el, 'From a pass to a kept pass', 'Each step counts people, not events. The step to watch is the one that turns a browser into somebody who can come back: a pass with an email on it survives a lost phone.', { src: 'serv', when });
  funnel(s, [
    { k: 'have a pass', v: now.passes },
    { k: 'chose a name', v: now.named },
    { k: 'started the questline', v: now.quest },
    { k: 'can get back in (email on the pass)', v: now.mailCreds, work: true },
    { k: 'supporters', v: now.member },
  ]);

  const mail = (data.roll && data.roll.mail) || {};
  const mdays = Object.keys(mail).sort();
  if (mdays.length) {
    const sum = (k) => mdays.reduce((t, d) => t + (mail[d][k] || 0), 0);
    const sent = sum('sent'), opened = sum('opened'), expired = sum('expired'), used = sum('used');
    const bad = sum('bad'), cool = sum('cooldown'), fail = sum('sendfail') + sum('unconfigured'), cap = sum('cap');
    s = section(el, 'Login links', 'Every email login, counted by the pass worker itself: links sent, links used to log in, and every way one dies. Read late means the 30-minute link expired; used twice is a second click or a mail scanner opening it first.', { src: 'serv', when: mdays.length + ' days' });
    g = div('hqp-tiles', null, s);
    tile(g, 'links sent', nfmt(sent), mdays[0].slice(5) + ' → ' + mdays[mdays.length - 1].slice(5));
    tile(g, 'used to log in', nfmt(opened), sent ? Math.round(opened / sent * 100) + '% of sent' : 'none sent', sent && opened / sent < 0.6 ? 'warn' : '');
    tile(g, 'read late', nfmt(expired), 'after the 30 min', expired ? 'warn' : '');
    tile(g, 'used twice', nfmt(used), 'or opened by a scanner', used ? 'warn' : '');
    tile(g, 'not a valid address', nfmt(bad), 'refused at the box');
    tile(g, 'asked again inside 2 min', nfmt(cool), 'quietly not sent');
    if (fail || cap) tile(g, 'failed to send', nfmt(fail + cap), cap ? 'daily cap hit' : 'the provider said no', 'warn');
  }
  const foot = div('hqp-foot', null, el);
  foot.textContent = 'rolled up ' + (now.done ? 'in full' : 'part-way') + ' · '
    + nfmt(now.scanned) + ' records over ' + nfmt(now.pages) + ' passes · ' + now.day;
}

// ═══════════════════════════════════════════════════════════════════════════
// 💰 THE ECONOMY — where coins come from, in words a reader knows
// ═══════════════════════════════════════════════════════════════════════════
export function renderEconomy(el, data) {
  const { now } = lastDay(data.roll);
  if (!now) { nope(el); return; }
  const when = now.day + ' · the rollup';
  let s = section(el, 'The economy', 'Every coin a player earns names the place and the source that paid it, and the pass worker keeps that tape. Google never sees a coin. Test tabs pay through a source the wallet refuses, and they are left out here.', { src: 'serv', when });
  const g = div('hqp-tiles', null, s);
  tile(g, 'earned, all time', nfmt(now.coins.earned));
  tile(g, 'spent', nfmt(now.coins.spent));
  tile(g, 'in wallets now', nfmt(now.coins.held), 'the float');
  const areaRows = Object.entries(now.area || {}).filter(([k]) => k !== 'qa')
    .map(([k, v]) => ({ k: areaName(k), raw: k, v })).sort((a, b) => b.v - a.v);
  barsH(s, areaRows, { empty: 'no coin events in the tape yet' });
  div('hqp-cap', 'coins by place', s);
  const facRows = Object.entries(now.faucet || {}).filter(([k]) => k !== 'qa')
    .map(([k, v]) => ({ k: faucet(k), raw: k, v })).sort((a, b) => b.v - a.v).slice(0, 8);
  barsH(s, facRows, { mono: CAT[1] });
  div('hqp-cap', 'coins by source · the top eight', s);
  const testCoins = (now.faucet && now.faucet.qa) || 0;
  if (testCoins) div('hqp-cap', nfmt(testCoins) + ' test coins from Trym’s own test tabs are in this day file and are not on the charts.', s);

  s = section(el, 'Refusals', 'A refusal is the game saying no to a coin grant: a cap reached, a source it does not know, a test grant. A few are normal. A pile under one reason is a rule that bites real players.', { src: 'serv', when });
  const refRows = Object.entries(now.refuse || {}).map(([k, v]) => ({ k: refusal(k), raw: k, v })).sort((a, b) => b.v - a.v);
  barsH(s, refRows, { mono: BAD, empty: 'nothing has been refused' });
  div('hqp-cap', 'refusals by reason', s);
}

// ═══════════════════════════════════════════════════════════════════════════
// 🏡 THE HOMESTEADS — a census taken from the yards themselves
// ═══════════════════════════════════════════════════════════════════════════
export function renderHomesteads(el, data) {
  const world = data.world || {};
  const c = world.census;
  let s = section(el, 'The homesteads', 'A census of every claimed homestead, read from the yards themselves as you open this floor. Test yards are left out — Trym’s own test farms once made this desk read as a boom.', { src: 'serv', when: 'right now' });
  if (!world.yards && !c) { div('hqp-empty', 'the rave worker did not answer the census', s); return; }
  const g = div('hqp-tiles', null, s);
  tile(g, 'homesteads', nfmt(world.yards || 0), nfmt(world.week || 0) + ' changed this week');
  if (c) {
    tile(g, 'animals', nfmt(c.animals), nfmt(c.withAnimals) + ' farms keep one');
    tile(g, 'planted', nfmt(c.planted));
    tile(g, 'named signs', nfmt(c.named));
    barsH(s, ['plot', 'tent', 'cabin', 'house'].map((k, i) => ({ k, v: c.stage[i] || 0 })), { mono: CAT[3] });
    div('hqp-cap', 'what the homesteads have grown into', s);
    s = section(el, 'Neighbours', 'What visitors did on other people’s farms, counted from the yards: the neighbourhood mechanic the farm launch was shipped to test.', { src: 'serv', when: 'right now' });
    barsH(s, [
      { k: 'visits', v: c.social.visits }, { k: 'guestbook signatures', v: c.social.signs },
      { k: 'waterings', v: c.social.waters }, { k: 'hugs', v: c.social.hugs },
      { k: 'troughs filled', v: c.social.feeds },
    ], { empty: 'nobody has been anywhere yet' });
  }
}

// 🕹 the Arcade's cabinets, by the key the pass worker's boards use
const ARC_NAMES = { peelout: 'Peel Out', snake: 'Banana Snake', invaders: 'Banana Invaders', pong: 'Banana Pong', stack: 'Banana Stack' };
export function renderArcade(el, data) {
  const arc = data.arcade && data.arcade.boards;
  if (!arc || !Object.keys(arc).length) return;
  const s = section(el, 'The Arcade boards', 'One board per cabinet, kept by the pass worker: how many bananas have a score on it, how many runs were posted, and who leads. A browser game can be fooled, so a board can be wiped from here when a score looks impossible; every pass keeps its own bests.', { src: 'serv', when: 'all time' });
  const g = div('hqp-tiles', null, s);
  for (const [gk, b] of Object.entries(arc)) {
    const lead = b.top && b.top[0];
    tile(g, ARC_NAMES[gk] || gk, nfmt(b.players || 0), nfmt(b.runs || 0) + ' runs' + (lead ? ' · ' + lead.n + ' leads with ' + nfmt(lead.s) : ' · nobody yet'));
  }
  if (typeof data.arcadeWipe === 'function') {
    const row = div('hqp-cap', 'wipe a board:', s);
    for (const gk of Object.keys(arc)) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'hqp-wipe'; b.textContent = ARC_NAMES[gk] || gk;
      b.addEventListener('click', () => {
        if (!confirm('Wipe the ' + (ARC_NAMES[gk] || gk) + ' board? Every score on it goes. The passes keep their own bests.')) return;
        b.disabled = true;
        data.arcadeWipe(gk).then((ok) => { b.textContent = ok ? (ARC_NAMES[gk] || gk) + ' · wiped' : (ARC_NAMES[gk] || gk) + ' · failed'; });
      });
      row.appendChild(b);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 🩺 HEALTH CHECKS — the ledger's own alarms (the Dev floor)
// ═══════════════════════════════════════════════════════════════════════════
export function renderHealth(el, data) {
  const { now } = lastDay(data.roll);
  const world = data.world || {};
  const s = section(el, 'Ledger checks', 'The pass worker’s own alarms. A coin grant with no source is a phone on old code paying itself without saying from where; strict rules stay off until that is zero for a day. World-token checks are the rave worker proving a phone is who it says, counted since that worker last restarted.', { src: 'serv', when: now ? now.day + ' · the rollup' : 'the rollup' });
  if (!now) { div('hqp-empty', 'no rollup day yet — needs the pass admin key, on the Players floor', s); return; }
  const g = div('hqp-tiles', null, s);
  tile(g, 'coin grants with no source', nfmt(now.unruled), now.unruled ? 'strict rules must wait' : 'ready to flip', now.unruled ? 'warn' : 'ok');
  tile(g, 'ledger events kept', nfmt(now.events), 'on the tape');
  const wt = world.wt || {};
  tile(g, 'world-token checks', nfmt(wt.ok || 0) + ' ok', (wt.miss || 0) + ' wrong · ' + (wt.none || 0) + ' absent · since the last restart', (wt.miss || 0) ? 'warn' : 'ok');
  tile(g, 'refused grants', nfmt(Object.values(now.refuse || {}).reduce((t, v) => t + v, 0)), 'by reason on the World floor');
  div('hqp-foot', 'rolled up ' + (now.done ? 'in full' : 'part-way') + ' · ' + nfmt(now.scanned) + ' records over ' + nfmt(now.pages) + ' passes · ' + now.day, s);
}

// ═══════════════════════════════════════════════════════════════════════════
// ✉️ REPORTED LETTERS — always drawn, in one of three honest states
// ═══════════════════════════════════════════════════════════════════════════
export function renderLetters(el, letters, drop) {
  const L = letters || { state: 'nokey', rows: [] };
  const s = section(el, 'Reported letters', 'Every letter a player reported, and every one the filter let through but flagged — kept whole, newest first. A report already took the letter out of the reader’s box, so nothing here is urgent for them. Clearing a row deletes this copy for good.', { src: 'serv', when: 'the review queue' });
  if (L.state === 'nokey') { div('hqp-empty', 'Needs the pass admin key — paste it once on the Players floor and this queue opens here.', s); return; }
  if (L.state === 'closed') { div('hqp-empty', 'The queue did not open with this key. The rave worker’s POST_ADMIN_KEY must be the same string as the pass admin key — until it is, this desk cannot tell an empty queue from a locked one.', s); return; }
  if (L.state === 'error') { div('hqp-empty', 'The rave worker did not answer — try again in a moment.', s); return; }
  const rows = Array.isArray(L.rows) ? L.rows : [];
  if (!rows.length) { div('hqp-empty', 'Nothing reported and nothing flagged. The queue is empty.', s); return; }
  const list = div('hqp-lets', null, s);
  for (const r of rows.slice(0, 40)) {
    const row = div('hqp-let' + (r.kind === 'flagged' ? ' is-flag' : ''), null, list);
    const head = div('hqp-let__h', null, row);
    head.textContent = (r.kind === 'flagged' ? 'FLAGGED' : 'REPORTED') + ' · '
      + (r.from || '?') + ' → ' + (r.to || '?') + ' · ' + when(r.queuedAt || r.reportedAt || r.at);
    // ⚠️ textContent, ALWAYS. This is the one string on the whole desk a stranger wrote.
    div('hqp-let__t', String(r.text || ''), row);
    if (typeof drop === 'function') {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'hqp-wipe'; b.textContent = 'clear';
      b.addEventListener('click', () => {
        b.disabled = true;
        drop([r.k]).then((ok) => { if (ok) row.remove(); else { b.textContent = 'failed'; b.disabled = false; } });
      });
      head.appendChild(b);
    }
  }
}

// how long ago, in the desk's own plain words
function when(t) {
  const m = Math.max(0, Math.round((Date.now() - (+t || 0)) / 60000));
  return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' d ago';
}
