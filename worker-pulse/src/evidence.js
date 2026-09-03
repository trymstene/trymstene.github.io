// ── THE EVIDENCE PACK ─────────────────────────────────────────────────────
// Every fact the analyst is allowed to reason about, computed once, with its
// baseline, its significance and — the part that was missing — HOW MANY DAYS
// RUNNING it has been true.
//
// ⚠️ WHY THIS FILE EXISTS. The old analyst was nine hard-coded checks that each
// emitted a fixed sentence. On 3 Sep Trym said it "seems the analysis is just
// the same each time with new numbers", and he was right twice over: the prose
// was templated, AND the level-change check fired nearly every day and always
// owned the headline, so the report literally opened with the same sentence for
// a week. Facts and prose are separated here so the prose can stop repeating.
//
// ⚠️ EVERY NUMBER A REPORT MAY PRINT IS COMPUTED HERE. The writer is forbidden
// from doing arithmetic (see writer.js) — if a percentage is worth saying, this
// file works it out and puts it in the pack.
//
// Pure functions. No fetch, no env.

// ── statistics ────────────────────────────────────────────────────────────
export const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

function median(a) {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// ⚠️ MEDIAN + MAD, NOT MEAN + SD. One ad day in a seven-day window drags the
// mean up and inflates the sd, so the days after it read as "normal" and the ad
// day itself reads as unremarkable — exactly backwards. The median ignores it.
function mad(a) {
  if (a.length < 2) return 0;
  const m = median(a);
  return median(a.map((x) => Math.abs(x - m))) * 1.4826;   // ≈ sd for normal data
}

// how far outside its own noise a number sits. The floor stops a freakishly
// steady week turning a one-session wobble into a z of 40.
export function robustZ(cur, base) {
  if (base.length < 3) return 0;
  const m = median(base);
  const s = Math.max(mad(base), Math.max(1.5, m * 0.12));
  return (cur - m) / s;
}

export const pct = (cur, base) => (base ? Math.round(((cur - base) / base) * 100) : null);
export const rate = (n, d) => (d ? n / d : 0);
const r1 = (x) => Math.round(x * 10) / 10;
const pctText = (p) => (p == null ? null : (p >= 0 ? '+' : '') + p + '%');

// "up 40%" / "collapsed" — plain words beat ±40% inside a sentence
export function moveWord(p) {
  const a = Math.abs(p);
  const dir = p > 0 ? 'up' : 'down';
  if (a >= 200) return dir === 'up' ? 'more than tripled' : 'collapsed';
  if (a >= 100) return dir === 'up' ? 'more than doubled' : 'fell by half or more';
  if (a >= 60) return dir + ' by well over half';
  if (a >= 40) return dir + ' sharply';
  return dir + ' ' + a + '%';
}

// ── the honesty gates ─────────────────────────────────────────────────────
// Rates on tiny numbers are noise wearing a suit. 3 of 5 is not 60%, it is
// three. These thresholds ARE the honesty and they are deliberately blunt.
export const MIN_RATE_N = 40;   // below this: counts, never percentages
export const MIN_STEP_N = 20;   // below this: do not narrate a funnel step
const Z_LOUD = 2.4;             // outside this, a number wants explaining
const Z_WORTH = 1.8;

// significance: 0 colour · 1 worth knowing · 2 wants a decision · 3 drop everything
function sigOf(z, n, absDelta) {
  const a = Math.abs(z);
  if (n < 8 || absDelta < 3) return 0;          // too small to mean anything
  if (a >= 3.2 && n >= MIN_RATE_N) return 3;
  if (a >= Z_LOUD) return 2;
  if (a >= Z_WORTH) return 1;
  return 0;
}

// the facts the report is built around, whether or not they are interesting
const CORE = new Set(['sessions', 'engagement', 'level', 'blackout', 'money',
  'downloads', 'offer', 'newcomers', 'search', 'campaign']);

const fact = (o) => ({
  id: o.id, area: o.area, label: o.label,
  value: o.value, unit: o.unit || null,
  base: o.base == null ? null : Math.round(o.base * 10) / 10,
  deltaPct: o.deltaPct == null ? null : o.deltaPct,
  deltaPctText: pctText(o.deltaPct),
  n: o.n == null ? o.value : o.n,
  z: o.z == null ? null : r1(o.z),
  sig: o.sig,
  daysRunning: 1,
  say: o.say || null,
  because: o.because || null,
});

// ── THE LEVEL SHIFT, done properly ────────────────────────────────────────
// The old test compared mean(last 3 days) with mean(first 4) and fired at 35%.
// On a site that runs 40 sessions one day and 300 the next, a 35% gap between
// two short windows is the WEATHER — it fired almost every day, and because it
// carried the top weight it owned the headline every time.
//
// A level shift is only a level shift when the two windows are further apart
// than their own spread explains, AND the gap is big enough to act on, AND it
// has held. All three, or it is just a busy Tuesday.
export function levelShift(series) {
  if (series.length < 7) return null;
  const after = series.slice(-3);
  const before = series.slice(0, 4);
  const mAfter = median(after);
  const mBefore = median(before);
  const spread = Math.max(mad(before), mad(after), Math.max(2, mBefore * 0.15));
  const sep = Math.abs(mAfter - mBefore) / spread;      // in units of its own noise
  const p = pct(mAfter, mBefore);
  const absGap = Math.abs(mAfter - mBefore);
  // ⚠️ ALL THREE. Separation alone fires on a steady week with one odd day;
  // percentage alone fires constantly at low volume; the absolute floor stops
  // "12 to 4 sessions is a 67% collapse" from ever leading a report.
  if (sep < 2.2 || p == null || Math.abs(p) < 40 || absGap < 25) return null;
  return { from: Math.round(mBefore), to: Math.round(mAfter), pct: p,
    separation: r1(sep), direction: p > 0 ? 'up' : 'down' };
}

// ══════════════════════════════════════════════════════════════════════════
// THE PACK
// ══════════════════════════════════════════════════════════════════════════
/**
 * @param d  as gathered by index.js
 *   d.days       [{d,sessions,users,newUsers,eng,revenue,tx}] oldest→newest
 *   d.events     { name: [8 daily counts] }
 *   d.eventUsers { name: [8 daily PEOPLE counts] }
 *   d.campaigns  [{name, sessions, engaged, secs}]  yesterday only
 *   d.sources    [{source, medium, sessions, engaged}] yesterday only
 *   d.gsc, d.gscBase
 *   d.world      the public yard census, or null
 *   d.areas      [{key,name,icon,door,q}] from the site's AREAS
 * @param upTo   how many days to treat as "known" — the whole series by
 *               default. Re-running the pack with upTo-1 is how daysRunning is
 *               computed, which is what stops the report repeating itself.
 */
export function buildFacts(d, upTo) {
  const allDays = d.days || [];
  const days = upTo == null ? allDays : allDays.slice(0, upTo);
  const today = days[days.length - 1];
  const base = days.slice(0, -1);
  if (!today || base.length < 3) return null;

  const cut = days.length;                       // events series honour upTo too
  const evArr = (n) => ((d.events || {})[n] || []).slice(0, cut);
  const evUArr = (n) => (((d.eventUsers || {})[n] || (d.events || {})[n] || []).slice(0, cut));
  const ev = (n) => { const a = evArr(n); return a.length ? (a[a.length - 1] || 0) : 0; };
  const evU = (n) => { const a = evUArr(n); return a.length ? (a[a.length - 1] || 0) : 0; };
  const evBase = (n) => { const a = evArr(n); return a.length > 1 ? median(a.slice(0, -1)) : 0; };
  const evZ = (n) => { const a = evArr(n); return a.length > 1 ? robustZ(a[a.length - 1] || 0, a.slice(0, -1)) : 0; };

  const S = today.sessions;
  const baseS = base.map((x) => x.sessions);
  const facts = [];
  const push = (o) => { if (o) facts.push(o); };

  // ── the level, if there genuinely is one ────────────────────────────────
  const shift = levelShift(baseS.concat([S]));
  if (shift) {
    push(fact({
      id: 'level', area: 'traffic', label: 'the level the site runs at',
      value: shift.to, base: shift.from, deltaPct: shift.pct, n: S,
      z: shift.separation, sig: 3,
      say: 'The site is running at about ' + shift.to + ' sessions a day against '
        + shift.from + ' earlier in the window.',
      because: shift.from + ' → ' + shift.to + ' sessions a day',
    }));
  }

  // ── traffic ─────────────────────────────────────────────────────────────
  const judgeAgainst = shift ? baseS.slice(-3) : baseS;
  const zS = robustZ(S, judgeAgainst);
  const pS = pct(S, median(judgeAgainst));
  push(fact({
    id: 'sessions', area: 'traffic', label: 'sessions',
    value: S, base: median(judgeAgainst), deltaPct: pS, n: S, z: zS,
    // ⚠️ a day INSIDE a level it already reported is not separately notable
    sig: shift ? Math.min(1, sigOf(zS, S, Math.abs(S - median(judgeAgainst))))
      : sigOf(zS, S, Math.abs(S - median(judgeAgainst))),
    say: pS == null ? S + ' sessions.'
      : 'Traffic ' + moveWord(pS) + ' to ' + S + ' against a usual '
        + Math.round(median(judgeAgainst)) + '.',
    because: S + ' vs ' + Math.round(median(judgeAgainst)) + ' a day',
  }));

  // ── a day with nothing in it is never a quiet Sunday ────────────────────
  if (S === 0) {
    push(fact({
      id: 'blackout', area: 'traffic', label: 'zero sessions',
      value: 0, base: median(baseS), deltaPct: -100, n: 0, z: -9, sig: 3,
      say: 'Yesterday recorded ZERO sessions against ' + Math.round(median(baseS))
        + ' a day for the week behind it. A live site does not record none — this '
        + 'is an outage or a dead tag, and every number below is wrong until it is fixed.',
      because: Math.round(median(baseS)) + ' a day, then 0',
    }));
  }

  // ── engagement ──────────────────────────────────────────────────────────
  const E = today.eng;
  const baseE = base.map((x) => x.eng);
  const ptsE = Math.round((E - median(baseE)) * 100);
  const zE = robustZ(E * 100, baseE.map((x) => x * 100));
  push(fact({
    id: 'engagement', area: 'quality', label: 'engagement rate',
    value: Math.round(E * 100), unit: '%', base: Math.round(median(baseE) * 100),
    deltaPct: null, n: S, z: zE,
    sig: S < MIN_RATE_N ? 0 : sigOf(zE, S, Math.abs(ptsE)),
    say: 'Engagement at ' + Math.round(E * 100) + '% against '
      + Math.round(median(baseE) * 100) + '% for the week, a difference of '
      + Math.abs(ptsE) + ' points.',
    because: Math.abs(ptsE) + ' points ' + (ptsE >= 0 ? 'above' : 'below') + ' the week',
  }));

  // ── who they were ───────────────────────────────────────────────────────
  if (today.users) {
    const newShare = Math.round(rate(today.newUsers, today.users) * 100);
    const baseShare = Math.round(median(base.map((x) => rate(x.newUsers, x.users))) * 100);
    push(fact({
      id: 'newcomers', area: 'quality', label: 'share who had never been here',
      value: newShare, unit: '%', base: baseShare, deltaPct: null,
      n: today.users, z: 0,
      sig: today.users >= MIN_RATE_N && Math.abs(newShare - baseShare) >= 12 ? 1 : 0,
      say: newShare + '% of yesterday had never been here before, against '
        + baseShare + '% normally. ' + today.newUsers + ' of ' + today.users + ' people.',
      because: today.newUsers + ' new of ' + today.users,
    }));
  }

  // ── where they came from (yesterday only — no daily series) ─────────────
  const srcs = (d.sources || []).filter((s) => s.sessions > 0)
    .sort((a, b) => b.sessions - a.sessions).slice(0, 6);
  const siteEng = Math.round(E * 100);
  srcs.forEach((s, i) => {
    const share = Math.round(rate(s.sessions, S) * 100);
    const eng = Math.round(rate(s.engaged, s.sessions) * 100);
    const gap = eng - siteEng;
    push(fact({
      id: 'source:' + s.source, area: 'source', label: s.source + ' · ' + s.medium,
      value: s.sessions, base: null, deltaPct: null, n: s.sessions, z: 0,
      sig: i === 0 || (s.sessions >= MIN_RATE_N && Math.abs(gap) >= 12) ? 1 : 0,
      say: s.source + ' sent ' + s.sessions + ' sessions, ' + share + '% of the day, '
        + (s.sessions >= MIN_RATE_N
          ? eng + '% of them engaged against ' + siteEng + '% site-wide.'
          : 'too few to judge on quality.'),
      because: s.sessions + ' sessions · ' + share + '% of the day',
    }));
  });

  // ── the flight that is live right now ───────────────────────────────────
  // ⚠️ GA4 puts its own placeholders here — (direct), (organic), (not set).
  // Anything bracketed is filler, not a campaign.
  const camps = (d.campaigns || []).filter((c) => c.name && c.sessions > 0
    && !/^\(.*\)$/.test(c.name)).sort((a, b) => b.sessions - a.sessions);
  if (camps[0]) {
    const c = camps[0];
    const cEng = Math.round(rate(c.engaged, c.sessions) * 100);
    const cSecs = Math.round(rate(c.secs, c.sessions));
    const gap = cEng - siteEng;
    push(fact({
      id: 'campaign', area: 'source', label: 'the live ad flight (' + c.name + ')',
      value: c.sessions, base: null, deltaPct: null, n: c.sessions, z: 0,
      sig: c.sessions < MIN_STEP_N ? 0 : (Math.abs(gap) >= 10 ? 2 : 1),
      say: c.name + ' brought ' + c.sessions + ' sessions'
        + (c.sessions < MIN_STEP_N ? ', too few to judge the creative on.'
          : ' at ' + cEng + '% engaged and ' + cSecs + 's average, against '
            + siteEng + '% site-wide.'),
      because: c.sessions + ' sessions at ' + cEng + '% engaged',
    }));
  }

  // ── the money funnel, step by step ──────────────────────────────────────
  const STEPS = [['builder_boot', 'the banana danced'], ['builder_start', 'customised it'],
    ['sticker_pdp_view', 'reached a product page'], ['sticker_pdp_checkout', 'hit ORDER'],
    ['checkout_redirect', 'went to checkout'], ['purchase', 'paid']];
  const stepVals = STEPS.map(([k, label]) => ({ k, label, v: evU(k) }));
  push(fact({
    id: 'funnel', area: 'funnel', label: 'the custom-banana funnel',
    value: stepVals[0].v, base: null, deltaPct: null, n: stepVals[0].v, z: 0, sig: 0,
    say: stepVals.map((x) => x.label + ' ' + x.v).join(', ') + '.',
    because: 'people, not events, at every step',
  }));
  // the worst SURVIVING transition, where the denominator earns a percentage
  let worst = null;
  for (let i = 0; i < stepVals.length - 1; i++) {
    const from = stepVals[i], to = stepVals[i + 1];
    if (from.v < MIN_STEP_N) continue;
    const r = Math.round(rate(to.v, from.v) * 100);
    if (!worst || r < worst.r) worst = { from, to, r };
  }
  if (worst) {
    push(fact({
      id: 'funnel:worst', area: 'funnel', label: 'the step people stall on',
      value: worst.r, unit: '%', base: null, deltaPct: null, n: worst.from.v, z: 0,
      sig: worst.r <= 12 ? 2 : 1,
      say: 'Of the ' + worst.from.v + ' who ' + worst.from.label + ', '
        + worst.to.v + ' ' + worst.to.label + ' — ' + worst.r + '%. That is the '
        + 'narrowest surviving step, so it caps everything downstream of it.',
      because: worst.from.v + ' → ' + worst.to.v + ' (' + worst.r + '%)',
    }));
  }

  // ── the download card ───────────────────────────────────────────────────
  const oShown = ev('offer_shown');
  const oWarm = ev('offer_world') + ev('offer_discord') + ev('offer_support') + ev('offer_click');
  if (oShown > 0) {
    // ⚠️ MIN_RATE_N, not MIN_STEP_N. 2 takers of 26 cards printed "8%", which
    // is two people wearing a percentage — the exact thing the gates exist for.
    const ctr = oShown >= MIN_RATE_N ? Math.round(rate(oWarm, oShown) * 100) : null;
    push(fact({
      id: 'offer', area: 'downloads', label: 'the download card',
      value: oWarm, base: null, deltaPct: null, n: oShown, z: 0,
      sig: oShown >= MIN_STEP_N && oWarm === 0 ? 2 : (oShown >= MIN_STEP_N ? 1 : 0),
      // ⚠️ NAME EVERY DOOR THE SUM COUNTS. The old line said "warmed 2" then
      // printed "0 to the world, 0 to the Discord" — because the support ask
      // and the retired merch click were in the total and not in the sentence.
      say: 'The card appeared ' + oShown + ' times and warmed ' + oWarm
        + (ctr == null ? '' : ' — ' + ctr + '%')
        + ' (' + ev('offer_world') + ' to the world, ' + ev('offer_discord')
        + ' to the Discord, ' + ev('offer_support') + ' to the support ask'
        + (ev('offer_click') ? ', ' + ev('offer_click') + ' on the retired merch link' : '')
        + '). ' + ev('offer_skip') + ' took the file and left.',
      because: oWarm + ' warmed of ' + oShown + ' shown',
    }));
  }

  // ── the volume channel ──────────────────────────────────────────────────
  const gifs = ev('gif_download');
  const zGif = evZ('gif_download');
  push(fact({
    id: 'downloads', area: 'downloads', label: 'files handed over',
    value: gifs, base: evBase('gif_download'), deltaPct: pct(gifs, evBase('gif_download')),
    n: gifs, z: zGif, sig: sigOf(zGif, gifs, Math.abs(gifs - evBase('gif_download'))),
    say: gifs + ' GIFs taken against a usual ' + Math.round(evBase('gif_download'))
      + '. This is the awareness channel, and it moves before everything else does.',
    because: gifs + ' vs ' + Math.round(evBase('gif_download')) + ' a day',
  }));

  // ── every door into the world, not four of them ─────────────────────────
  (d.areas || []).forEach((A) => {
    if (!A.door) return;
    const v = ev(A.door);
    const b = evBase(A.door);
    const z = evZ(A.door);
    push(fact({
      id: 'world:' + A.key, area: 'world', label: A.name,
      value: v, base: b, deltaPct: pct(v, b), n: v, z,
      sig: sigOf(z, v, Math.abs(v - b)),
      say: v + ' came through ' + A.name + (b ? ' against a usual ' + Math.round(b) : '') + '.',
      because: v + ' vs ' + Math.round(b) + ' a day',
    }));
  });

  // ── money ───────────────────────────────────────────────────────────────
  push(fact({
    id: 'money', area: 'money', label: 'purchases',
    value: today.tx, base: null, deltaPct: null, n: today.tx, z: 0,
    sig: today.tx > 0 ? 3 : 0,
    say: today.tx > 0
      ? today.tx + ' purchase' + (today.tx > 1 ? 's' : '') + ', ' + Math.round(today.revenue)
        + ' kr. Check Shopify for whose it is before celebrating — every order so far has '
        + 'been one of Trym\'s own tests.'
      : 'No purchases.',
    because: today.tx + ' purchases · ' + Math.round(today.revenue) + ' kr',
  }));

  // ── search ──────────────────────────────────────────────────────────────
  if (d.gsc && d.gscBase && d.gscBase.impressions >= 50) {
    const dp = r1(d.gscBase.position - d.gsc.position);        // + = improved
    const pi = pct(d.gsc.impressions, d.gscBase.impressions);
    push(fact({
      id: 'search', area: 'search', label: 'Google',
      value: d.gsc.clicks, base: d.gscBase.clicks, deltaPct: pct(d.gsc.clicks, d.gscBase.clicks),
      n: d.gsc.impressions, z: 0,
      sig: Math.abs(dp) >= 0.8 ? 2 : (pi != null && Math.abs(pi) >= 45 ? 1 : 0),
      say: d.gsc.clicks + ' clicks from ' + d.gsc.impressions + ' impressions at position '
        + r1(d.gsc.position) + ', against ' + Math.round(d.gscBase.clicks) + ' clicks from '
        + Math.round(d.gscBase.impressions) + ' at ' + r1(d.gscBase.position) + '.',
      because: 'position moved ' + Math.abs(dp),
    }));
  }

  // ── the world's own state, which GA4 cannot see ─────────────────────────
  if (d.world && d.world.census) {
    const c = d.world.census;
    const soc = c.social || {};
    push(fact({
      id: 'yards', area: 'world', label: 'the farms that exist',
      value: d.world.yards || 0, base: null, deltaPct: null, n: d.world.yards || 0, z: 0,
      sig: 0,
      say: (d.world.yards || 0) + ' farms exist, ' + (d.world.day || 0) + ' visited yesterday, '
        + (d.world.week || 0) + ' in the last week. ' + (c.animals || 0) + ' animals across '
        + (c.withAnimals || 0) + ' of them, ' + (c.named || 0) + ' claimed with a sign, '
        + (c.fedToday || 0) + ' fed yesterday.',
      because: (d.world.day || 0) + ' of ' + (d.world.yards || 0) + ' farms visited',
    }));
    push(fact({
      id: 'yards:social', area: 'world', label: 'farm visits between players',
      value: soc.visits || 0, base: null, deltaPct: null, n: soc.visits || 0, z: 0, sig: 0,
      say: (soc.visits || 0) + ' visits to other people\'s farms all-time, '
        + (soc.hugs || 0) + ' hugs, ' + (soc.waters || 0) + ' waterings, '
        + (soc.feeds || 0) + ' troughs filled, ' + (soc.signs || 0) + ' signs read.',
      because: 'the only two-player loop in the world',
    }));
  }

  return facts;
}

// ── the pack, with persistence ────────────────────────────────────────────
// ⚠️ THE POINT OF THIS FUNCTION. Re-running the fact engine as it would have
// run on each of the previous days is what lets the report know it has already
// said something. Without it the analyst leads with the same finding every
// morning until the window rolls past it, which is precisely what made Trym
// stop reading it.
export function buildPack(d) {
  const facts = buildFacts(d);
  if (!facts) return null;
  const days = d.days || [];

  const back = [];
  for (let k = 1; k <= 3; k++) {
    const prev = buildFacts(d, days.length - k);
    if (prev) back.push(new Set(prev.filter((f) => f.sig >= 2).map((f) => f.id)));
  }
  for (const f of facts) {
    let n = 1;
    for (const set of back) { if (f.sig >= 2 && set.has(f.id)) n++; else break; }
    f.daysRunning = f.sig >= 2 ? n : 0;
  }

  const today = days[days.length - 1];
  const S = today.sessions;
  const loud = facts.filter((x) => x.sig >= 2);
  const fresh = loud.filter((x) => x.daysRunning <= 1);

  return {
    date: null, niceDate: null,                       // index.js stamps these
    sessions: S,
    // ⚠️ "usual" means the level the site is IN. Once a level shift is
    // established, the whole-window median is a number the site left behind —
    // printing it produced "92 sessions against a usual 330" on a day the
    // report had already said the site now runs at 120.
    baselineSessions: (facts.find((f) => f.id === 'sessions') || {}).base
      || Math.round(median(days.slice(0, -1).map((x) => x.sessions))),
    levelChanged: !!facts.find((f) => f.id === 'level'),
    daysOfHistory: days.length,
    sampleIsThin: S < MIN_RATE_N,
    rules: {
      minSessionsForARate: MIN_RATE_N,
      minStepForARate: MIN_STEP_N,
      note: 'Below minSessionsForARate, say counts and not percentages. A fact whose '
        + 'daysRunning is 2 or more was already reported on previous mornings and must '
        + 'not lead again.',
    },
    counts: { facts: facts.length, significant: loud.length, newToday: fresh.length },
    // ⚠️ CORE always survives the cut even at sig 0. The narrator quotes
    // sessions and engagement for context on EVERY shape, so dropping a quiet
    // one is a crash, not a tidier pack.
    facts: facts.filter((f) => f.sig > 0 || CORE.has(f.id)
      || f.area === 'funnel' || f.area === 'world'),
    quietFacts: facts.filter((f) => f.sig === 0).map((f) => f.because).filter(Boolean),
  };
}
