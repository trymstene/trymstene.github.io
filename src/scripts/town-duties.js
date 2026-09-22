// 💼 THE WORK NOTE — what your job wants from you this week (22 Sep 2026; docs/town-jobs-plan.md §12).
//
// Trym: "we should have optional quest-notifications in a different color letting users know that they
// have work-stuff to forfill and a time-span they have to fix it, and if not they will get deducted on
// the salary … say what they need to do like Arcade: Swept floor 0/3, fixed Arcade machine 0/3".
//
// The quest's journal chip's sibling, in the town's brown-and-cream paper. Two lines: the week's counts
// against their targets (the workplace, then each duty as done, e.g. "floor swept 1/3"), and under them
// ONE line — the wage so far and the days to payday, the week's work done, the boss asking if you're
// coming in, the boss letting you go, or "your payslip is in the letterbox". A tips job (the café) keeps
// its own two lines. It folds like the quest chip and sits under it when both are up.
//
// ⚠️ THE WORDS ARE THE RIG'S (src/data/copy/town-duties.json; the workplace names are the payslip's,
// src/data/copy/homestead-post.json). No words, no chip. ⚠️ THE NUMBERS ARE THE PASS WORKER'S: the counts
// and the wage come from its job view (src/data/town/jobs.js is the one arithmetic); payday is Monday,
// counted here from the UTC clock. The chip never promises a coin the cheque will not pay.
import POST from '../data/copy/homestead-post.json';
const COPY_MODS = import.meta.glob('../data/copy/town-duties.json', { eager: true, import: 'default' });
const COPY = Object.values(COPY_MODS)[0] || null;

// 💼 a briefcase, in the world's pixel grammar — the badge that folds the chip (the quest's ! twin)
const CASE_SVG = '<svg viewBox="0 0 16 14" aria-hidden="true">'
  + '<path fill="#111" d="M5 0h6v1H5zM4 1h1v2H4zM11 1h1v2h-1zM0 3h16v1H0zM0 4h1v9H0zM15 4h1v9h-1zM0 13h16v1H0z"/>'
  + '<path fill="#c8823a" d="M1 4h14v9H1z"/>'
  + '<path fill="#8a5a2b" d="M1 8h14v1H1zM6 1h4v2H6z"/>'
  + '<path fill="#ffd23f" d="M7 7h2v3H7z"/>'
  + '</svg>';

const CSS = `
.twd-chip {
  position:absolute; left:18px; top:48px; z-index:10; max-width:62%;
  background:linear-gradient(#f7ecd2,#e8d7b3); color:#3a2a1c;
  border:3px solid #000; box-shadow:3px 3px 0 #000; border-radius:2px;
  font-size:0.78rem; font-weight:800; padding:7px 11px 7px 22px; line-height:1.35;
  pointer-events:none; animation:twdIn 0.32s cubic-bezier(0.34,1.56,0.64,1);
}
.twd-chip[hidden] { display:none !important; }
.tw-world.is-inside ~ .twd-chip { display:none !important; }
.twd-chip.is-min { max-width:none; padding:0; width:0; height:0; background:none; border-color:transparent; box-shadow:none; animation:none; }
.twd-chip.is-min > span { display:none; }
.twd-chip__top { display:block; font-size:0.68rem; letter-spacing:0.02em; opacity:0.92; margin-bottom:3px; }
.twd-chip__top i { font-style:normal; text-transform:uppercase; letter-spacing:0.08em; font-size:0.6rem; }
.twd-chip__top:empty { display:none; }
.twd-chip__top.is-pop { animation: twdPop 420ms cubic-bezier(0.2, 0.8, 0.2, 1); transform-origin: 0 50%; }
@keyframes twdPop { 0% { transform: scale(1); } 35% { transform: scale(1.12); } 100% { transform: scale(1); } }
@media (prefers-reduced-motion: reduce) { .twd-chip__top.is-pop { animation: none; } }
.twd-chip__line { display:block; }
.twd-chip--nudge { background:linear-gradient(#ffe8c2,#f2c98a); }
.twd-chip--fired { background:linear-gradient(#e8dcd2,#cdbcae); }
.twd-chip__badge {
  position:absolute; left:-13px; top:-15px; line-height:0;
  background:#111; border-radius:999px; padding:6px 7px;
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
const FIRED_SHOWN_MS = 3 * 86400000;   // the sack is on the note for three days, then the note is quiet
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// the numbers go in bold, so the eye finds them; the words stay the rig's
const fill = (line, vals) => esc(line).replace(/\{(coins|days)\}/g, (m, k) => '<b>' + (vals[k] | 0) + '</b>');

export function bootTownDuties({ view, work, track }) {
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

  const fold = () => {
    const min = !!work.seam.folded();
    el.classList.toggle('is-min', min);
    badge.setAttribute('aria-expanded', min ? 'false' : 'true');
  };
  badge.addEventListener('click', (e) => { e.stopPropagation(); work.seam.fold(!work.seam.folded()); fold(); });

  // 📎 UNDER THE QUEST'S CHIP when both are up, never on top of it: the same corner, one card below
  function place() {
    const q = view.querySelector('.bwq-hint');
    if (q && !q.hidden && !q.classList.contains('is-min') && !q.classList.contains('bwq-hint--wait')) {
      el.style.top = Math.round(q.offsetTop + q.offsetHeight + 14) + 'px';
    } else el.style.top = '';
  }

  // the counts line: the workplace as the payslip prints it, then each duty as done — "floor swept 1/3"
  function countsFor(s) {
    const names = (POST.wage && POST.wage.at) || {};
    const rows = (s.duties || []).map((r) => esc(COPY.kinds[r.kind] || r.kind) + ' <b>' + (r.done | 0) + '/' + (r.of | 0) + '</b>');
    if (!rows.length) return '';
    return (names[s.at] ? '<i>' + esc(names[s.at]) + '</i> · ' : '') + rows.join(' · ');
  }
  function saysFor(s) {
    if (!s) return null;
    // 🪓 the sack: the note says so for a few days after, whatever job you hold now (none, usually)
    const f = s.fired;
    if (f && f.at && COPY.fired && COPY.fired[f.at] && Date.now() - (f.t || 0) < FIRED_SHOWN_MS && !s.at) return { top: '', line: esc(COPY.fired[f.at]), kind: 'fired' };
    if (!s.at) return null;
    if (s.at === 'cafe') {
      if (!s.turnedUp) return COPY.duty && COPY.duty.cafe ? { top: '', line: esc(COPY.duty.cafe), kind: 'duty' } : null;
      return COPY.cafeDone ? { top: '', line: esc(COPY.cafeDone), kind: 'wage' } : null;
    }
    const top = countsFor(s);
    if (s.owed > 0 && COPY.payslip) return { top, line: esc(COPY.payslip), kind: 'payslip' };
    if (s.nudge && COPY.nudge && COPY.nudge[s.at]) return { top, line: esc(COPY.nudge[s.at]), kind: 'nudge' };
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
      // 📡 Pulse hears the chip once per line per day: a duty shown, a wage shown, a nudge, the sack, a payslip announced
      const at = s.at || (s.fired && s.fired.at) || '';
      const pk = today() + ':' + at + ':' + says.kind;
      if (work.seam.told() !== pk) { work.seam.tell(pk); track('town_duty', { at, kind: says.kind }); }
    }
    el.hidden = false;
    fold();
    place();
  }
  work.seam.onChange(render);
  render();
  const placer = setInterval(place, 1200);
  return {
    render,
    seam: {
      hidden: () => el.hidden,
      top: () => top.textContent,
      line: () => text.textContent,
      html: () => text.innerHTML,
      kind: () => (el.classList.contains('twd-chip--nudge') ? 'nudge' : el.classList.contains('twd-chip--fired') ? 'fired' : ''),
      folded: () => el.classList.contains('is-min'),
      offset: () => el.style.top,
      stop: () => clearInterval(placer),
    },
  };
}
