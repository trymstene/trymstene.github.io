// 📈 THE WORLD DESK — Banana World's own numbers, from the workers rather
// than from Google. Everything here is server truth: no consent gate, no
// adblock loss, no sampling, no zero-row omission.
//
// PURE RENDERER: no imports. It is handed two payloads and paints into an
// element. Charts are hand-rolled SVG — no library, no CDN, no CSP argument.
//
//   renderPulse(el, { roll, world })
//     roll  = worker-pass /admin/rollup  → { days: [...], today }
//     world = worker-rave /yards/stats   → { yards, day, week, census, wt }
//
// ⚠️ Colour does one job at a time. Areas and faucets carry IDENTITY, so they
// use the fixed categorical order below (validated for CVD separation against
// this desk's own dark surface — re-run tools before changing a hex). Single
// series wear ink, never a category colour. Status is reserved for state.

// the categorical theme, in fixed order and never cycled
const CAT = ['#6E45E0', '#1F8A70', '#C85A1E', '#2F7BD6', '#A8447C'];
const AREA_C = { rave: CAT[0], park: CAT[1], homestead: CAT[2], beach: CAT[3], pass: CAT[4] };
const INK = '#f4eeff', DIM = '#9a90b8', GRID = 'rgba(244,238,255,.10)', LINE = '#ffe135';
const OK = '#5ee08a', WARN = '#ffb45e', BAD = '#ff5d8f';
const catOf = (name, i) => AREA_C[name] || CAT[i % CAT.length];
const svgNS = 'http://www.w3.org/2000/svg';

const mk = (tag, attrs, parent) => {
  const e = document.createElementNS(svgNS, tag);
  for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
};
const div = (cls, txt, parent) => {
  const e = document.createElement('div');
  if (cls) e.className = cls;
  if (txt != null) e.textContent = txt;
  if (parent) parent.appendChild(e);
  return e;
};
const nfmt = (n) => (n >= 10000 ? Math.round(n / 1000) + 'k' : n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(Math.round(n || 0)));
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);

// ── a section, and the (i) that carries anything needing more than a label ──
function section(host, title, note) {
  const s = div('hqp-sec', null, host);
  const h = div('hqp-h', null, s);
  div('hqp-htitle', title, h);
  if (note) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'hqp-i';
    b.textContent = 'i';
    b.setAttribute('aria-label', 'what this means');
    const p = div('hqp-note', note, s);
    p.hidden = true;
    b.addEventListener('click', () => { p.hidden = !p.hidden; });
    h.appendChild(b);
  }
  return s;
}

// ── a headline number. A stat with no plot needs no chart, but it does need
//    an object to sit on and a second line saying what it is measured against.
function tile(host, label, value, sub, tone) {
  const t = div('hqp-tile' + (tone ? ' is-' + tone : ''), null, host);
  div('hqp-tval', value, t);
  div('hqp-tlab', label, t);
  if (sub) div('hqp-tsub', sub, t);
  return t;
}

// ── change over time: one series, so it wears ink and needs no legend ──────
function lineChart(host, pts, opts) {
  const o = opts || {};
  const W = 640, H = 258, L = 40, R = 12, T = 16, B = 28;
  const wrap = div('hqp-chart', null, host);
  const svg = mk('svg', { viewBox: `0 0 ${W} ${H}`, class: 'hqp-svg', role: 'img',
    'aria-label': o.label || 'trend' }, wrap);
  if (!pts.length) { div('hqp-empty', 'no days rolled up yet', wrap); return; }
  const max = Math.max(1, ...pts.map((p) => p.v));
  const x = (i) => L + (i * (W - L - R)) / Math.max(1, pts.length - 1);
  const y = (v) => T + (H - T - B) * (1 - v / max);
  // a recessive grid: three lines, labelled at the ends only
  [0, 0.5, 1].forEach((f) => {
    const yy = y(max * f);
    mk('line', { x1: L, x2: W - R, y1: yy, y2: yy, stroke: GRID, 'stroke-width': 1 }, svg);
    mk('text', { x: 6, y: yy + 4, fill: DIM, 'font-size': 12 }, svg).textContent = nfmt(max * f);
  });
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  mk('path', { d: `${d} L${x(pts.length - 1)},${y(0)} L${x(0)},${y(0)} Z`, fill: (o.color || LINE) + '22' }, svg);
  mk('path', { d, fill: 'none', stroke: o.color || LINE, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
  // the last point is the one that gets a label — never a number on every point
  const last = pts[pts.length - 1];
  mk('circle', { cx: x(pts.length - 1), cy: y(last.v), r: 4, fill: o.color || LINE, stroke: '#171326', 'stroke-width': 2 }, svg);
  const lx = x(pts.length - 1);
  const t1 = mk('text', { x: lx - 8, y: Math.max(T + 12, y(last.v) - 10), fill: INK, 'font-size': 13,
    'font-weight': 700, 'text-anchor': 'end' }, svg);
  t1.textContent = nfmt(last.v);
  [0, pts.length - 1].forEach((i) => {
    if (!pts[i]) return;
    const tx = mk('text', { x: x(i), y: H - 8, fill: DIM, 'font-size': 12,
      'text-anchor': i === 0 ? 'start' : 'end' }, svg);
    const lab = String(pts[i].d || '');
    tx.textContent = /^\d{4}-\d{2}-\d{2}$/.test(lab) ? lab.slice(5) : lab;
  });
  // the hover layer: an HTML chart is interactive, so it reads on touch too
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
    tip.textContent = pts[i].d + ' · ' + nfmt(pts[i].v);
    tip.style.left = Math.max(0, Math.min(100, (x(i) / W) * 100)) + '%';
  };
  svg.addEventListener('pointermove', at);
  svg.addEventListener('pointerdown', at);
  svg.addEventListener('pointerleave', () => { tip.hidden = true; cross.setAttribute('opacity', 0); });
}

// ── magnitude by category: horizontal bars, direct-labelled, no legend box ──
function barsH(host, rows, opts) {
  const o = opts || {};
  const wrap = div('hqp-bars', null, host);
  if (!rows.length) { div('hqp-empty', o.empty || 'nothing yet', wrap); return; }
  const max = Math.max(1, ...rows.map((r) => r.v));
  rows.forEach((r, i) => {
    const row = div('hqp-bar', null, wrap);
    div('hqp-blab', r.k, row);
    const track = div('hqp-btrack', null, row);
    const fill = div('hqp-bfill', null, track);
    fill.style.width = Math.max(2, (r.v / max) * 100) + '%';
    fill.style.background = o.mono || catOf(r.k, i);
    div('hqp-bval', nfmt(r.v), row);
  });
}

// ── a rate needs its denominator, and refuses to print under a sample gate ──
function rate(host, label, hits, cohort, note) {
  const t = div('hqp-rate', null, host);
  const enough = cohort >= 20;
  div('hqp-rval', enough ? pct(hits, cohort) + '%' : '—', t);
  div('hqp-rlab', label, t);
  div('hqp-rsub', enough ? hits + ' of ' + cohort : 'needs 20 · has ' + cohort, t);
  if (note) t.title = '';
  return t;
}

// ── the funnel counts PEOPLE, and marks the step that is the work ──────────
function funnel(host, steps) {
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

// ── 📡 what Google saw. A DIFFERENT KIND OF NUMBER from everything below
// it, and the note says so: these are client-fired and consent-gated, so an
// adblocker or a declined banner makes a visit invisible. The two will
// disagree. Neither is correcting the other.
function googleBlock(el, an, live) {
  if (!an && !live) return;
  const s = section(el, 'What Google saw', 'Client-fired and consent-gated: an adblocker or a declined cookie banner makes a visit invisible here, and Google drops rows it considers empty. Everything below this section comes from the workers instead and misses nobody. Expect the two to disagree — neither is a correction of the other.');
  if (live) {
    const g = div('hqp-tiles', null, s);
    tile(g, 'on the site now', nfmt(live.total || 0), (live.countries || []).length + ' countries');
    const top = (live.pages || [])[0];
    if (top) tile(g, 'busiest page', nfmt(top.v), String(top.page) || '/');
    const ev = (live.events || [])[0];
    if (ev) tile(g, 'top event now', nfmt(ev.v), ev.name);
    if (live.spark && live.spark.length) {
      const pts = live.spark.map((v, i) => ({ d: (29 - i) + ' min ago', v }));
      lineChart(s, pts, { label: 'people on the site, last half hour', color: '#5ec8e0' });
      div('hqp-cap', 'people on the site, by the minute', s);
    }
  }
  if (!an || !an.headline) return;
  const card = div('hqp-analyst', null, s);
  div('hqp-verdict is-' + (an.verdict || 'normal'), an.verdict || 'reading', card);
  div('hqp-ahead', an.headline, card);
  (an.body || []).slice(0, 3).forEach((line) => div('hqp-abody', line, card));
  (an.reads || []).slice(0, 4).forEach((r) => {
    const row = div('hqp-aread', null, card);
    div('hqp-aicon', r.icon || '•', row);
    div('hqp-atext', r.text || String(r), row);
  });
  (an.recs || []).slice(0, 2).forEach((r) => div('hqp-arec', typeof r === 'string' ? r : (r.text || r.rec || ''), card));
  if (an.confidence) div('hqp-cap', an.confidence + (an.sessions != null ? ' · ' + nfmt(an.sessions) + ' sessions vs ' + nfmt(an.avgSessions) + ' usual' : ''), card);
}

export function renderLedger(el, data) {
  const roll = data.roll || {};
  const world = data.world || {};
  const days = (roll.days || []).filter((d) => d && d.passes != null);
  const now = days.length ? days[days.length - 1] : (roll.today || null);
  el.textContent = '';

  googleBlock(el, data.analyst, data.live);

  if (!now) {
    div('hqp-empty', 'The rollup has not written a day yet. It walks the bucket every ten minutes; the first file lands within the hour.', el);
    return;
  }

  // ── who is here ───────────────────────────────────────────────────────────
  let s = section(el, 'Who is here', 'Every number on this screen comes from the workers, not from Google: no consent banner, no adblocker, no sampling. Stickiness is daily actives over monthly actives — the share of your monthly players who turned up today.');
  let g = div('hqp-tiles', null, s);
  tile(g, 'people', nfmt(now.passes), nfmt(now.anon) + ' never signed in');
  tile(g, 'active today', nfmt(now.dau), 'of ' + nfmt(now.mau) + ' this month');
  tile(g, 'active this week', nfmt(now.wau), nfmt(now.born7) + ' of them new');
  tile(g, 'stickiness', pct(now.dau, now.mau) + '%', 'daily ÷ monthly', pct(now.dau, now.mau) >= 20 ? 'ok' : '');
  if (days.length > 1) {
    lineChart(s, days.map((d) => ({ d: d.day, v: d.dau })), { label: 'active people per day' });
    div('hqp-cap', 'active people per day', s);
  }

  // ── do they come back ─────────────────────────────────────────────────────
  s = section(el, 'Do they come back', 'Rolling retention: of everyone old enough to qualify, the share who turned up at least that many days after their first day. A rate is withheld under twenty people, because below that it is noise.');
  g = div('hqp-rates', null, s);
  rate(g, 'next day', now.ret.r1, now.ret.c1);
  rate(g, 'after a week', now.ret.r7, now.ret.c7);
  rate(g, 'after a month', now.ret.r30, now.ret.c30);

  // ── the funnel ────────────────────────────────────────────────────────────
  s = section(el, 'From a visit to a home', 'Each step counts people, not events. The step to watch is the one that turns a browser into somebody who can come back: a pass that survives a lost phone.');
  funnel(s, [
    { k: 'have a pass', v: now.passes },
    { k: 'chose a name', v: now.named },
    { k: 'started the questline', v: now.quest },
    { k: 'can get back in', v: now.mailCreds, work: true },
    { k: 'supporters', v: now.member },
  ]);

  // ── the economy ───────────────────────────────────────────────────────────
  s = section(el, 'Where the coins come from', 'Every coin event names the area and the faucet that paid it. This is the question GA4 has no event for at all — coins are never sent to it.');
  g = div('hqp-tiles', null, s);
  tile(g, 'earned, all time', nfmt(now.coins.earned));
  tile(g, 'spent', nfmt(now.coins.spent));
  tile(g, 'still held', nfmt(now.coins.held), 'the float');
  const areaRows = Object.entries(now.area || {}).map(([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v);
  barsH(s, areaRows, { empty: 'no coin events in the tape yet' });
  div('hqp-cap', 'coins by area', s);
  const facRows = Object.entries(now.faucet || {}).map(([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v).slice(0, 8);
  barsH(s, facRows, { mono: CAT[1] });
  div('hqp-cap', 'top faucets', s);

  // ── the world itself ──────────────────────────────────────────────────────
  const c = world.census;
  s = section(el, 'The world itself', 'A census of every homestead, taken from the documents themselves. QA yards are excluded — Trym’s own test farms once made this desk read as a boom.');
  g = div('hqp-tiles', null, s);
  tile(g, 'homesteads', nfmt(world.yards || 0), nfmt(world.week || 0) + ' touched this week');
  if (c) {
    tile(g, 'animals', nfmt(c.animals), nfmt(c.withAnimals) + ' farms keep one');
    tile(g, 'planted', nfmt(c.planted));
    tile(g, 'named signs', nfmt(c.named));
  }
  if (c) {
    barsH(s, ['plot', 'tent', 'cabin', 'house'].map((k, i) => ({ k, v: c.stage[i] || 0 })), { mono: CAT[3] });
    div('hqp-cap', 'homesteads by what they have grown into', s);
    s = section(el, 'Is anyone visiting', 'The neighbourhood mechanic, measured: what visitors actually did on other people’s farms. This is the question the farm launch was shipped to ask.');
    barsH(s, [
      { k: 'visits', v: c.social.visits }, { k: 'guestbook', v: c.social.signs },
      { k: 'waterings', v: c.social.waters }, { k: 'hugs', v: c.social.hugs },
      { k: 'troughs filled', v: c.social.feeds },
    ], { empty: 'nobody has been anywhere yet' });
  }

  // ── the health board ──────────────────────────────────────────────────────
  s = section(el, 'The health board', 'Refusals are the game saying no: a cap reached, a price unmet, an overdraft. Unnamed events are coin grants arriving from a ruled area with no faucet named — the flag that gates strict rules stays off until this is zero for a day.');
  g = div('hqp-tiles', null, s);
  tile(g, 'unnamed events', nfmt(now.unruled), now.unruled ? 'strict rules must wait' : 'ready to flip', now.unruled ? 'warn' : 'ok');
  tile(g, 'events on the tape', nfmt(now.events));
  const wt = world.wt || {};
  tile(g, 'world tokens', nfmt(wt.ok || 0) + ' ok', (wt.miss || 0) + ' wrong · ' + (wt.none || 0) + ' absent', (wt.miss || 0) ? 'warn' : 'ok');
  const refRows = Object.entries(now.refuse || {}).map(([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v);
  barsH(s, refRows, { mono: BAD, empty: 'nothing has been refused' });
  div('hqp-cap', 'refusals by reason', s);

  const foot = div('hqp-foot', null, el);
  foot.textContent = 'rolled up ' + (now.done ? 'in full' : 'part-way') + ' · '
    + nfmt(now.scanned) + ' records over ' + nfmt(now.pages) + ' passes · ' + now.day;
}
