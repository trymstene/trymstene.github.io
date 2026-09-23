// 💼 THE STAFF CARD — one card for the five workplaces (23 Sep 2026; the plan:
// https://claude.ai/artifact/Ub4HFW4zdQcDiCGrUZNJxH, slice 0a).
//
// Trym, 23 Sep: "if youve accepted to work one place, that you click on the workplace to see your progress in a
// separate workplace badge thats standardized for all workplaces" — and then: "theres two different dynamics
// involved here": at the stand, the café and the post office you PLAY A ROUND; at the arcade and the store the
// town CALLS you and you go and see to it. "As long as we treat both jobs with the same amount of weight."
//
// So the top half is the same everywhere (where you work, for whom, what you are called there) and the bottom
// half follows the kind of job: a shift job shows today's tips or the week's work and a Go to work; an on-call job
// shows today's calls and Answer the calls — or says plainly that nothing needs you — and the week and the wage.
// Both end on the place's other use, so a room is never a toll (design library §22).
//
// ⚠️ IT DECIDES NOTHING. The counts, the wage and the tips are what the work note already reads (town-work.js's
// mirror of the pass worker, ruleUsed for the tips); the calls are the chores the rooms already show their staff;
// every button hands its verb back to the town (ctx.act), which walks, clocks in or opens the room the way a tap on
// the world always has. A card that did any of that itself would be a second copy of the town's rules.
// ⚠️ THE WORDS ARE THE COPY FILE'S (src/data/copy/town-staff.json). No words, no card: the town's own tap stands.
import DUTY from '../data/copy/town-duties.json';
import { ruleUsed } from '../lib/banana-pass.js';
import { tipsCap, weekPay, xpAt, ranksOf, LADDER, unlocksAt, dayCap, refTo } from '../data/town/jobs.js';   // 🪜 the ladder (23 Sep 2026)
import { daysToPayday } from './town-duties.js';
const COPY_MODS = import.meta.glob('../data/copy/town-staff.json', { eager: true, import: 'default' });
const COPY = Object.values(COPY_MODS)[0] || null;

export const SHIFT = ['cafe', 'stand', 'post'];   // a round you play
export const ONCALL = ['condo', 'store'];         // the town calls you
export const WORKPLACES = [...SHIFT, ...ONCALL];
const TIPS = ['cafe', 'stand'];                   // paid per glass, not by payslip (src/data/town/jobs.js JOB_PAY 0)
const CALL_KINDS = ['sweep', 'fix', 'restock', 'serve', 'deliver'];

const CSS = `
.tws { display:grid; gap:0.55rem; }
.tws-of { margin:0; font-size:0.62rem; letter-spacing:0.1em; text-transform:uppercase; font-weight:800; opacity:0.72; padding-right:26px; }
.tws h2 { margin:0; }
.tws-lab { display:block; font-size:0.62rem; letter-spacing:0.1em; text-transform:uppercase; font-weight:800; opacity:0.72; margin-bottom:0.25rem; }
.tws-stat { display:inline-flex; align-items:baseline; gap:0.35rem; padding:0.4rem 0.8rem; border:2px solid #000; border-radius:999px; background:#2a1a10; box-shadow:2px 2px 0 rgba(0,0,0,0.45); }
.tws-stat b { font-size:1.2rem; line-height:1; color:#ffe135; font-variant-numeric:tabular-nums; }
.tws-stat small { font-size:0.8rem; opacity:0.72; font-variant-numeric:tabular-nums; }
.tws-bar { height:10px; border:2px solid #000; background:#2a1a10; margin-top:0.35rem; overflow:hidden; }
.tws-bar i { display:block; height:100%; background:linear-gradient(#ffe14d,#f2c012); transform-origin:0 50%; }
.tws-note { margin:0.3rem 0 0; font-size:0.74rem; opacity:0.8; line-height:1.35; }
.tws-unlock { opacity:1; font-weight:700; color:#ffe135; }
.tws-rows { list-style:none; margin:0; padding:0; display:grid; gap:4px; }
.tws-rows li { display:flex; align-items:center; justify-content:space-between; gap:0.6rem; background:#2a1a10; border:2px solid #000; padding:0.35rem 0.55rem; font-size:0.8rem; }
.tws-rows b { color:#ffe135; font-variant-numeric:tabular-nums; white-space:nowrap; }
.tws-rows li.is-done b { color:#a8e08a; }
.tws-calls li { background:#3a2410; border-color:#000; box-shadow:inset 3px 0 0 #ffb347; }
.tws-wage { display:flex; align-items:center; justify-content:space-between; gap:0.6rem; font-size:0.8rem; background:#2a1a10; border:2px solid #000; padding:0.35rem 0.55rem; }
.tws-wage b { font-size:1.05rem; color:#ffe135; font-variant-numeric:tabular-nums; }
.tws-wage + .tws-note { margin-top:-0.25rem; }
.tws-quiet { margin:0.1rem 0 0; font-size:0.84rem; font-weight:700; opacity:0.85; }
.tws-shut { margin:0; font-size:0.8rem; font-weight:700; color:#ffb347; }
.tws .tw-cta, .tws .tw-btn--in { margin-top:0.15rem; }
.tws-rank { display:flex; align-items:center; gap:0.5rem; font-size:0.72rem; font-weight:800; opacity:0.9; }
.tws-pips { display:flex; gap:3px; }
.tws-pips i { width:10px; height:10px; border:2px solid #000; background:#2a1a10; }
.tws-pips i.is-on { background:#ffe135; }
.tws-xp .tws-bar i { background:linear-gradient(#a8e08a,#6fbf4a); }
.tws-xp .tws-bar.is-under i { background:linear-gradient(#ffc36b,#f29a2e); }
.tws-news { margin:0; padding:0.4rem 0.6rem; border:2px solid #000; background:#b5de86; color:#1e3310; font-size:0.82rem; font-weight:800; box-shadow:2px 2px 0 rgba(0,0,0,0.45); }
.tws-news.is-word { background:#f2c98a; color:#3a2410; }
.tws-warn { margin:0; font-size:0.8rem; font-weight:800; color:#ffb347; }
`;
let styled = false;
function injectCss() { if (styled) return; styled = true; const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st); }

const fill = (line, vals) => String(line || '').replace(/\{(\w+)\}/g, (m, k) => (k in vals ? String(vals[k]) : m));

export function bootTownStaff(ctx) {
  const { openCard, closeCard, esc, track } = ctx;
  if (!COPY) return null;
  injectCss();
  let last = null;   // what the card showed last, for the walk

  // today's calls at an on-call workplace: the chores its room shows its staff, as [{ kind, n }] with n > 0
  const callsOf = (at) => (ONCALL.includes(at) && ctx.calls ? (ctx.calls(at) || []) : []).filter((c) => c && CALL_KINDS.includes(c.kind) && (c.n | 0) > 0);

  function weekHtml(s) {
    const rows = (s.duties || []).map((r) => {
      const done = (r.done | 0) >= (r.of | 0);
      return '<li' + (done ? ' class="is-done"' : '') + '><span>' + esc((DUTY.kinds || {})[r.kind] || r.kind) + '</span><b>' + (r.done | 0) + '/' + (r.of | 0) + '</b></li>';
    }).join('');
    if (!rows) return '';
    const days = daysToPayday();
    return '<section><span class="tws-lab">' + esc(COPY.week) + '</span><ul class="tws-rows">' + rows + '</ul></section>'
      + '<div class="tws-wage"><span>' + esc(COPY.wage) + '</span><b>' + (s.sofar | 0) + '</b></div>'
      + (COPY.payday && days ? '<p class="tws-note">' + esc(fill(COPY.payday, { days })) + '</p>' : '');
  }
  function tipsHtml(at, rank) {
    let got = 0; try { got = ruleUsed('town:tips').used | 0; } catch (e) {}
    const cap = tipsCap(at, rank), used = Math.min(cap, got);
    const k = cap ? Math.max(0, Math.min(1, used / cap)) : 0;
    return '<section><span class="tws-lab">' + esc(COPY.tips) + '</span>'
      + '<div class="tws-stat"><b>' + used + '</b>' + (cap ? '<small>/ ' + cap + '</small>' : '') + '</div>'
      + (cap ? '<div class="tws-bar"><i style="transform:scaleX(' + k.toFixed(3) + ')"></i></div>' : '')
      + (cap && COPY.tipsCap ? '<p class="tws-note">' + esc(fill(COPY.tipsCap, { cap })) + '</p>' : '')
      + '</section>';
  }
  function callsHtml(calls) {
    if (!calls.length) return COPY.quiet ? '<p class="tws-quiet">' + esc(COPY.quiet) + '</p>' : '';
    return '<section><span class="tws-lab">' + esc(COPY.calls) + '</span><ul class="tws-rows tws-calls">'
      + calls.map((c) => '<li data-call="' + c.kind + '"><span>' + esc((COPY.call || {})[c.kind] || c.kind) + '</span>' + ((c.n | 0) > 1 ? '<b>' + (c.n | 0) + '</b>' : '') + '</li>').join('')
      + '</ul>' + (COPY.until ? '<p class="tws-note">' + esc(COPY.until) + '</p>' : '') + '</section>';
  }
  // 🪜 THE LADDER, on the card (23 Sep 2026): the rank you hold as pips, your work XP against the next rank's line, today's
  // XP against the day's cap, and what the next rank gives — or the boss's news once the XP has crossed the line
  function ladderHtml(at, l) {
    const of = ranksOf(at), a = xpAt(at, l.rank) | 0;
    // ↕ a poor week can leave you UNDER your own rank's line: then the bar is the climb back over it, in amber
    const under = l.xp < a, lo = under ? xpAt(at, l.rank - 1) | 0 : a, b = under ? a : xpAt(at, l.rank + 1);
    const k = b == null ? 1 : Math.max(0, Math.min(1, (l.xp - lo) / (b - lo)));
    let pips = '';
    for (let i = 1; i <= of; i++) pips += '<i' + (i <= l.rank ? ' class="is-on"' : '') + '></i>';
    const next = COPY.ranks[at][l.rank];
    const nextLine = !next ? COPY.top : TIPS.includes(at) ? fill(COPY.nextTips, { title: next, cap: tipsCap(at, l.rank + 1) }) : fill(COPY.nextWeek, { title: next, coins: weekPay(at, l.rank + 1) });
    return '<div class="tws-rank"><span class="tws-pips">' + pips + '</span><span>' + esc(fill(COPY.rank, { n: l.rank, of })) + '</span></div>'
      + (l.news && (COPY.news || {})[at] ? '<p class="tws-news">' + esc(COPY.news[at]) + '</p>' : '')
      // ↕ the weekly review: the boss's word waiting, the warning that stands, and what last week came to
      + (!l.news && l.talk && (COPY.word || {})[at] ? '<p class="tws-news is-word">' + esc(COPY.word[at]) + '</p>' : '')
      + (l.warn && COPY.warnCard ? '<p class="tws-warn">' + esc(COPY.warnCard) + '</p>' : '')
      + '<section class="tws-xp"><span class="tws-lab">' + esc(COPY.xp) + '</span>'
      + '<div class="tws-stat"><b>' + l.xp + '</b>' + (b != null ? '<small>/ ' + b + '</small>' : '') + '</div>'
      + '<div class="tws-bar' + (under ? ' is-under' : '') + '"><i style="transform:scaleX(' + k.toFixed(3) + ')"></i></div>'
      + '<p class="tws-note">' + esc(fill(COPY.today, { n: l.today, cap: dayCap(at, l.rank) })) + '</p>'
      + (l.last && (COPY.last || {})[l.last.v] ? '<p class="tws-note">' + esc(fill(COPY.last[l.last.v], { xp: Math.abs(l.last.xp | 0) })) + '</p>' : '')
      + (nextLine ? '<p class="tws-note">' + esc(nextLine) + '</p>' : '')
      // 🔓 and what the next rank lets you DO (the ladder's slice 3): the reason to climb, in the card's own words
      + unlocksAt(at, l.rank + 1).map((k) => ((COPY.unlock || {})[at] || {})[k]).filter(Boolean).map((u) => '<p class="tws-note tws-unlock">' + esc(u) + '</p>').join('')
      // 📜 and at the top rank, the reference it has earned you at the next rung up
      + (!next && refTo(at) && (COPY.refCard || {})[at] ? '<p class="tws-note tws-unlock">' + esc(COPY.refCard[at]) + '</p>' : '') + '</section>';
  }
  const cta = (id, verb, off) => '<button type="button" class="tw-cta" id="' + id + '"' + (off ? ' disabled' : '') + '><span class="tw-cta__verb">' + esc(verb) + '</span></button>';
  const plain = (id, label) => '<button type="button" class="tw-btn--in" id="' + id + '">' + esc(label) + '</button>';

  // open(at, door): the card for the workplace `at`, opened from `door` ('place' | 'note')
  function open(at, door) {
    if (!WORKPLACES.includes(at) || !((COPY.ranks || {})[at] || []).length) return false;
    const s = ctx.job ? ctx.job() : { at: '' };
    if (s.at !== at) return false;   // only your own workplace has a staff card for you
    const l = s.lad && s.lad.at === at ? s.lad : { xp: 0, rank: 1, today: 0, news: false };
    const shut = !!(ctx.shut && ctx.shut(at));
    const kind = SHIFT.includes(at) ? 'shift' : 'oncall';
    const calls = kind === 'oncall' ? callsOf(at) : [];
    const second = (COPY.second || {})[at] || '';
    let body = '';
    if (kind === 'shift') {
      body += TIPS.includes(at) ? tipsHtml(at, l.rank) : weekHtml(s);
      if (shut && COPY.shut) body += '<p class="tws-shut">' + esc(COPY.shut) + '</p>';
      body += cta('twsGo', COPY.go, shut);
    } else {
      if (shut && COPY.shut) body += '<p class="tws-shut">' + esc(COPY.shut) + '</p>';
      else {
        body += callsHtml(calls);
        if (calls.length) body += cta('twsGo', COPY.answer, false);
      }
      body += weekHtml(s);
    }
    if (second && !shut) body += plain('twsSecond', second);
    openCard('<div class="tws" data-at="' + at + '" data-kind="' + kind + '">'
      + '<p class="tws-of">' + esc((COPY.of || {})[at] || '') + '</p>'
      + '<h2>' + esc(COPY.ranks[at][l.rank - 1] || COPY.ranks[at][0]) + '</h2>'
      + ladderHtml(at, l)
      + body + '</div>');
    const go = document.getElementById('twsGo'), sec = document.getElementById('twsSecond');
    const verb = kind === 'shift' ? 'go' : 'answer';
    if (go) go.addEventListener('click', () => { if (go.disabled) return; closeCard(); track('town_staff', { at, door, act: verb }); if (ctx.act) ctx.act(at, verb); });
    if (sec) sec.addEventListener('click', () => { closeCard(); track('town_staff', { at, door, act: 'second' }); if (ctx.act) ctx.act(at, 'second'); });
    last = { at, door, kind, shut, calls: calls.map((c) => ({ ...c })), go: !!go && !go.disabled, second: !!sec, rank: l.rank, xp: l.xp, news: !!l.news, title: COPY.ranks[at][l.rank - 1] || '', warn: !!l.warn, talk: l.talk || '' };
    track('town_staff', { at, door, act: 'open', calls: calls.length });
    return true;
  }

  return { open, seam: { last: () => (last ? { ...last } : null), words: () => COPY } };
}
