// 💼 THE WORK NOTE — what your job wants from you this week (22 Sep 2026; docs/town-jobs-plan.md §12).
//
// Trym: "we should have optional quest-notifications in a different color letting users know that they
// have work-stuff to forfill and a time-span they have to fix it, and if not they will get deducted on
// the salary … say what they need to do like Arcade: Swept floor 0/3, fixed Arcade machine 0/3".
//
// The quest's journal chip's sibling, in the town's brown-and-cream paper. Two lines: the week's counts
// against their targets (the workplace, then each duty as done, e.g. "floor swept 1/3"), and under them
// ONE line — the wage so far and the days to payday, the week's work done, the boss asking if you're
// coming in, the boss letting you go, or "your payslip is in the letterbox". A tips job (the café, the
// stand) has today's tips over its own line. A tap opens the staff card (town-staff.js); the briefcase
// badge folds it like the quest chip's, and it sits under the quest chip when both are up.
//
// ⚠️ THE WORDS ARE THE COPY FILE'S (src/data/copy/town-duties.json; your title and the boss's news are the staff card's,
// src/data/copy/town-staff.json, which town-work.js loads with the job). No words, no chip. ⚠️ THE NUMBERS ARE THE PASS WORKER'S: the counts
// and the wage come from its job view (src/data/town/jobs.js is the one arithmetic); payday is Monday,
// counted here from the UTC clock. The chip never promises a coin the cheque will not pay.
import { ruleUsed } from '../lib/banana-pass.js';
import { tipsCap, xpAt } from '../data/town/jobs.js';
import { calls as callsAt, ONCALL_JOBS } from '../lib/work-calls.js';
const COPY_MODS = import.meta.glob('../data/copy/town-duties.json', { eager: true, import: 'default' });
const COPY = Object.values(COPY_MODS)[0] || null;

// 💼 a briefcase, in the world's pixel grammar — the badge that folds the chip (the quest's ! twin)
const CASE_SVG = '<svg viewBox="0 0 16 14" aria-hidden="true">'
  + '<path fill="#111" d="M5 0h6v1H5zM4 1h1v2H4zM11 1h1v2h-1zM0 3h16v1H0zM0 4h1v9H0zM15 4h1v9h-1zM0 13h16v1H0z"/>'
  + '<path fill="#c8823a" d="M1 4h14v9H1z"/>'
  + '<path fill="#8a5a2b" d="M1 8h14v1H1zM6 1h4v2H6z"/>'
  + '<path fill="#ffd23f" d="M7 7h2v3H7z"/>'
  + '</svg>';

// ⚠️ NO COMMENTS INSIDE THE STRING: they ship to every visitor of the town. So, out here: a tap on the paper opens the
// staff card (23 Sep) and the briefcase badge folds it and brings it back; `top` transitions so the column re-stacks in
// one small move; and INSIDE your own workplace the note stays up, because the arcade and the store are where the
// week's work is (the jobs audit, 22 Sep 2026) — that is the .is-here rule. 🪜 The ladder (23 Sep): a thin bar along the
// note's foot is your work XP to the next rank, and the note turns GREEN when your boss has news (the quest's note is
// the yellow one, the pager the amber).
const CSS = `
.twd-chip {
  position:absolute; left:18px; top:48px; z-index:10; max-width:62%;
  background:linear-gradient(#f7ecd2,#e8d7b3); color:#3a2a1c;
  border:3px solid #000; box-shadow:3px 3px 0 #000; border-radius:2px;
  font-size:0.78rem; font-weight:800; padding:7px 11px 7px 22px; line-height:1.35;
  pointer-events:auto; cursor:pointer; touch-action:manipulation; -webkit-tap-highlight-color:transparent;
  animation:twdIn 0.32s cubic-bezier(0.34,1.56,0.64,1); transition:top 200ms ease-out;
}
.twd-chip.is-min { pointer-events:none; }
.twd-chip[hidden] { display:none !important; }
.tw-world.is-inside ~ .twd-chip:not(.is-here) { display:none !important; }
.twd-chip.is-min { max-width:none; padding:0; width:0; height:0; background:none; border-color:transparent; box-shadow:none; animation:none; }
.twd-chip.is-min > span { display:none; }
.twd-chip__top { display:block; font-size:0.68rem; letter-spacing:0.02em; opacity:0.92; margin-bottom:3px; }
.twd-chip__top i { font-style:normal; text-transform:uppercase; letter-spacing:0.08em; font-size:0.6rem; }
.twd-chip__top:empty { display:none; }
.twd-chip__top.is-pop { animation: twdPop 420ms cubic-bezier(0.2, 0.8, 0.2, 1); transform-origin: 0 50%; }
@keyframes twdPop { 0% { transform: scale(1); } 35% { transform: scale(1.12); } 100% { transform: scale(1); } }
@media (prefers-reduced-motion: reduce) { .twd-chip__top.is-pop { animation: none; } }
.twd-chip__line { display:block; }
.twd-chip--nudge, .twd-chip--word { background:linear-gradient(#ffe8c2,#f2c98a); }
.twd-chip--fired { background:linear-gradient(#e8dcd2,#cdbcae); }
.twd-chip--call { background:linear-gradient(#ffc36b,#f29a2e); color:#2a1606; }
.twd-chip--news { background:linear-gradient(#e2f5c4,#b5de86); color:#1e3310; }
.has-xp:not(.is-min) { padding-bottom:11px; }
.has-xp:not(.is-min)::after { content:''; position:absolute; left:22px; right:11px; bottom:4px; height:3px; background:linear-gradient(90deg,#6fbf4a var(--xp),rgba(58,42,28,0.2) 0); }
.twd-chip--call.is-min .twd-chip__badge { background:#f29a2e; }
.twd-chip.is-ring:not(.is-min), .twd-chip.is-ring .twd-chip__badge { animation:twdRing 0.8s ease-out; }
@keyframes twdRing { 20% { transform:rotate(-6deg) scale(1.08); } 45% { transform:rotate(5deg) scale(1.08); } 70% { transform:rotate(-3deg); } }
@media (prefers-reduced-motion: reduce) { .twd-chip.is-ring, .twd-chip.is-ring .twd-chip__badge { animation:none; } }
.twd-chip__badge {
  position:absolute; left:-13px; top:-15px; line-height:0;
  background:#111; width:32px; height:32px; padding:0; border-radius:50%; display:flex; align-items:center; justify-content:center; box-sizing:border-box;
  transform:rotate(-8deg); box-shadow:2px 2px 0 rgba(0,0,0,0.35);
  border:0; cursor:pointer; pointer-events:auto;
  touch-action:manipulation; -webkit-tap-highlight-color:transparent;
}
.twd-chip__badge::after { content:''; position:absolute; inset:-8px; }
.twd-chip__badge:active { transform:rotate(-8deg) translate(1px,1px); box-shadow:1px 1px 0 rgba(0,0,0,0.35); }
.twd-chip__badge svg { display:block; width:18px; height:16px; }
.twd-chip b { color:#8a4a12; }
@keyframes twdIn { 0% { transform:scale(0.6) rotate(-3deg); opacity:0; } 100% { transform:none; opacity:1; } }
`;
let styled = false;
function injectCss() { if (styled) return; styled = true; const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st); }

const today = () => new Date().toISOString().slice(0, 10);
// Monday is payday: the days until the next one, by the UTC clock (a Monday reads as a week away —
// the cheque for the week just gone is already on its way, and the new week starts from nothing)
export const daysToPayday = (t) => { const d = (new Date(t == null ? Date.now() : t).getUTCDay() + 6) % 7; return (7 - d) % 7 || 7; };
const TIPS = ['cafe', 'stand'];   // the jobs paid per glass, never by payslip (src/data/town/jobs.js JOB_PAY 0)
const FIRED_SHOWN_MS = 3 * 86400000;   // the sack is on the note for three days, then the note is quiet
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// the numbers go in bold, so the eye finds them; the words stay the rig's
const fill = (line, vals) => esc(line).replace(/\{(coins|days)\}/g, (m, k) => '<b>' + (vals[k] | 0) + '</b>');

export function bootTownDuties({ view, work, track, open, onCall }) {
  if (!COPY || !COPY.kinds) return null;   // the words are not approved yet: the square has no chip, not a broken one
  injectCss();
  const el = document.createElement('div');
  el.className = 'twd-chip';
  el.hidden = true;
  el.innerHTML = '<button type="button" class="twd-chip__badge" aria-label="fold the work note"></button><span class="twd-chip__top"></span><span class="twd-chip__line"></span>';
  el.querySelector('button').innerHTML = CASE_SVG;
  const badge = el.querySelector('button'), top = el.querySelector('.twd-chip__top'), text = el.querySelector('.twd-chip__line');
  view.appendChild(el);
  let shown = '';   // what the chip last said, so a re-render is free and Pulse hears each line once
  let rung = '';    // 📟 the call the note last rang for: a count moving under a call is not a new call

  const fold = () => {
    const min = !!work.seam.folded();
    el.classList.toggle('is-min', min);
    badge.setAttribute('aria-expanded', min ? 'false' : 'true');
  };
  badge.addEventListener('click', (e) => { e.stopPropagation(); work.seam.fold(!work.seam.folded()); fold(); });
  // 📎 a tap on the note never walks the banana: pointerdown is stopped before the view sees it
  el.addEventListener('pointerdown', (e) => { if (!el.classList.contains('is-min')) e.stopPropagation(); });
  // 💼 AND IT OPENS YOUR STAFF CARD (23 Sep 2026, the staff card plan's decision 2): the note is the card's second
  // door, the one that is on screen from anywhere in the town. Folding is the briefcase badge's alone now. A note
  // with no job behind it (the sack, for a few days) has no card, so a tap still folds it.
  el.addEventListener('click', (e) => {
    if (el.classList.contains('is-min') || e.target.closest('.twd-chip__badge')) return;
    e.stopPropagation();
    const at = work.seam.state().at;
    if (at && open && open(at)) return;
    work.seam.fold(true); fold();
  });

  // 📎 ONE COLUMN, TWO NOTES (Trym, 22 Sep: "there needs to be some harmony between the main questline icon and
  // notification, and the work-job-icon and notification - so they dont disturb or get in eachothers way").
  // The quest note is first and the work note sits under it — under the NOTE while it is open, under its
  // BADGE once it is folded, because a folded note is a 0×0 anchor with the badge hanging at its corner. So two
  // folded notes are two badges stacked, never one on top of the other, and a fold above moves this note in the
  // same beat (a ResizeObserver on the quest note; the interval only catches it arriving or leaving).
  const REST = 48;         // the column's top: the quest note's own resting place (world-quest.js .bwq-hint)
  const BADGE_ROOM = 18;   // our badge hangs 15 px above our top edge: room for it under whatever is above
  let watched = null, ro = null;
  function place() {
    const wd = view.querySelector('.tw-world'), inAt = wd && wd.dataset.room;
    el.classList.toggle('is-here', !!inAt && inAt === (work.seam.state().at || ''));
    const q = view.querySelector('.bwq-hint');
    if (q !== watched) {
      if (ro) { ro.disconnect(); ro = null; }
      watched = q;
      if (q && typeof ResizeObserver === 'function') { ro = new ResizeObserver(() => place()); ro.observe(q); }
    }
    let top = REST;
    if (q && !q.hidden && !q.classList.contains('bwq-hint--wait') && getComputedStyle(q).display !== 'none') {
      const vr = view.getBoundingClientRect();
      if (q.classList.contains('is-min')) {
        const b = q.querySelector('.bwq-hint__badge'), r = b && b.getBoundingClientRect();
        top = r && r.height ? Math.round(r.bottom - vr.top) + BADGE_ROOM + 4 : REST + 44;
      } else {
        top = Math.round(q.getBoundingClientRect().bottom - vr.top) + BADGE_ROOM;
      }
    }
    el.style.top = top + 'px';
  }

  // the counts line: the workplace as the payslip prints it, then each duty as done — "floor swept 1/3"
  // 🪜 the counts and the tips lead with your TITLE (the ladder, 23 Sep 2026: it replaced the payslip's workplace name,
  // and with it the whole homestead-post.json this chunk used to carry for three words); nothing until the words land
  const head = (s) => { const t = work.seam.title && work.seam.title(s.at, s.lad.rank); return t ? '<i>' + esc(t) + '</i> · ' : ''; };
  function countsFor(s) {
    const rows = (s.duties || []).map((r) => esc(COPY.kinds[r.kind] || r.kind) + ' <b>' + (r.done | 0) + '/' + (r.of | 0) + '</b>');
    return rows.length ? head(s) + rows.join(' · ') : '';
  }
  // 🪜 the boss has a promotion to tell you: the staff card's own line (town-staff.json, loaded with the job) — one line, two surfaces
  const newsOf = (s) => (s.lad && s.lad.news && ((work.seam.words && work.seam.words()) || {}).news || {})[s.at] || '';
  // ↕ …or a word to hear (a warning, a demotion: the weekly review), in the nudge's colour
  const wordOf = (s) => (s.lad && s.lad.talk && ((work.seam.words && work.seam.words()) || {}).word || {})[s.at] || '';
  const home = () => { try { return !!(JSON.parse(localStorage.getItem('hs-v1') || '{}') || {}).claimedAt; } catch (e) { return false; } };   // no homestead: the town pays (town-work)
  function saysFor(s) {
    if (!s) return null;
    // 🪓 the sack: the note says so for a few days after, whatever job you hold now (none, usually)
    const f = s.fired;
    if (f && f.at && COPY.fired && COPY.fired[f.at] && Date.now() - (f.t || 0) < FIRED_SHOWN_MS && !s.at) return { top: '', line: esc(COPY.fired[f.at]), kind: 'fired' };
    if (!s.at) return null;
    // ☕🍋 a tips job has no counts on the week's sheet — but it has today's tips against the day's cap, and the note
    // had no numbers at all for it until the staff card (23 Sep 2026). Then its duty until you have clocked in today,
    // and its after-line once you have.
    if (TIPS.includes(s.at)) {
      const d = COPY.duty && COPY.duty[s.at], after = COPY[s.at + 'Done'];
      const cap = tipsCap(s.at, s.lad.rank);
      let used = 0; try { used = Math.min(cap, ruleUsed('town:tips').used | 0); } catch (e) {}
      const tipsTop = COPY.tips ? head(s) + esc(COPY.tips) + ' <b>' + used + '</b>/' + cap : '';
      if (newsOf(s)) return { top: tipsTop, line: esc(newsOf(s)), kind: 'news' };
      if (wordOf(s)) return { top: tipsTop, line: esc(wordOf(s)), kind: 'word' };
      if (s.nudge && COPY.nudge && COPY.nudge[s.at]) return { top: tipsTop, line: esc(COPY.nudge[s.at]), kind: 'nudge' };
      if (!s.turnedUp) return d ? { top: tipsTop, line: esc(d), kind: 'duty' } : null;
      if (used >= cap && cap > 0 && COPY.tipsAll) return { top: tipsTop, line: esc(COPY.tipsAll), kind: 'wage' };   // the day's tips are all earned: shifts still count, say so
      return after ? { top: tipsTop, line: esc(after), kind: 'wage' } : null;
    }
    const top = countsFor(s);
    // 📟 THE PAGER (slice 0b): at the arcade and the store the town CALLS you, and the note is where the call lands —
    // amber (the quest's note is the gold one), the call's own line, until it is answered; then the next one; then one line for a day's calls all answered
    const cs = ONCALL_JOBS[s.at] ? callsAt(s.at) : [];
    const ring = cs.find((c) => c.open);
    if (ring && COPY.call && COPY.call[ring.kind]) return { top, line: esc(COPY.call[ring.kind]), kind: 'call' };
    if (s.owed > 0 && COPY.payslip && home()) return { top, line: esc(COPY.payslip), kind: 'payslip' };   // an open call first: it is today's; the payslip waits
    if (newsOf(s)) return { top, line: esc(newsOf(s)), kind: 'news' };
    if (wordOf(s)) return { top, line: esc(wordOf(s)), kind: 'word' };
    if (s.nudge && COPY.nudge && COPY.nudge[s.at]) return { top, line: esc(COPY.nudge[s.at]), kind: 'nudge' };
    if (cs.length && cs.every((c) => c.done) && COPY.answered) return { top, line: esc(COPY.answered), kind: 'answered' };
    if (s.share >= 1 && COPY.done) return { top, line: esc(COPY.done), kind: 'done' };
    return COPY.wage ? { top, line: fill(COPY.wage, { coins: s.sofar, days: daysToPayday() }), kind: 'wage' } : null;
  }
  function render() {
    const s = work.seam.state();
    const says = saysFor(s);
    if (!says || !says.line) { el.hidden = true; shown = ''; return; }
    const key = says.top + '|' + says.line;
    if (key !== shown) {
      const moved = !!shown && !!top.innerHTML && says.top !== top.innerHTML;   // a count moved: the line pops once
      shown = key;
      top.innerHTML = says.top;
      if (moved) { top.classList.remove('is-pop'); void top.offsetWidth; top.classList.add('is-pop'); }
      text.innerHTML = says.line;
      el.classList.toggle('twd-chip--nudge', says.kind === 'nudge');
      el.classList.toggle('twd-chip--fired', says.kind === 'fired');
      el.classList.toggle('twd-chip--news', says.kind === 'news');
      el.classList.toggle('twd-chip--word', says.kind === 'word');
      // 📟 a call is amber, and a NEW call rings the note once — its badge too, if you folded it — and tells the town, so
      // a room you are standing in draws the work it just brought (no sound: nowhere outside the rave has any, or a mute)
      el.classList.toggle('twd-chip--call', says.kind === 'call');
      if (says.kind === 'call' && says.line !== rung) { rung = says.line; el.classList.remove('is-ring'); void el.offsetWidth; el.classList.add('is-ring'); if (onCall) onCall(s.at); }
      if (says.kind !== 'call') rung = '';
      // 📡 Pulse hears the chip once per line per day: a duty shown, a wage shown, a nudge, the sack, a payslip announced
      const at = s.at || (s.fired && s.fired.at) || '';
      const pk = today() + ':' + at + ':' + says.kind;
      if (work.seam.told() !== pk) { work.seam.tell(pk); track('town_duty', { at, kind: says.kind }); }
    }
    // 🪜 the thin bar: your work XP from this rank's line to the next one's (full at the top rank)
    const l = s.lad, b = l && s.at ? xpAt(s.at, l.rank + 1) : null, a = l && s.at ? xpAt(s.at, l.rank) | 0 : 0;
    el.classList.toggle('has-xp', !!(l && s.at));
    if (l && s.at) el.style.setProperty('--xp', (b == null ? 100 : Math.max(0, Math.min(100, (l.xp - a) / (b - a) * 100))).toFixed(1) + '%');
    el.hidden = false;
    fold();
    place();
  }
  work.seam.onChange(render);
  render();
  const placer = setInterval(render, 1200);   // render places it too; and a shift's tips reach the note with no job change to say so
  return {
    render,
    seam: {
      hidden: () => el.hidden,
      top: () => top.textContent,
      line: () => text.textContent,
      html: () => text.innerHTML,
      kind: () => (el.classList.contains('twd-chip--nudge') ? 'nudge' : el.classList.contains('twd-chip--fired') ? 'fired' : el.classList.contains('twd-chip--call') ? 'call' : el.classList.contains('twd-chip--news') ? 'news' : el.classList.contains('twd-chip--word') ? 'word' : ''),
      xp: () => (el.classList.contains('has-xp') ? el.style.getPropertyValue('--xp') : ''),
      rang: () => el.classList.contains('is-ring'),
      folded: () => el.classList.contains('is-min'),
      offset: () => el.style.top,
      stop: () => { clearInterval(placer); if (ro) ro.disconnect(); },
    },
  };
}
