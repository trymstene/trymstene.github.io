// 💼 THE DUTIES CHIP — what your job wants from you today (22 Sep 2026; docs/town-jobs-plan.md §9.2).
//
// Trym: "there should also be notifications similar to the quest notifications, maybe a different
// color or something if you have duties regarding your job … a collected amount of pay so far with a
// counter until payday". The quest's journal chip's sibling, in the town's brown-and-cream paper:
// ONE line — today's duty, or the wage so far and the days to payday once you have turned up, or
// "your payslip is in the letterbox" when a cheque has been paid. It folds like the quest chip.
//
// ⚠️ THE WORDS ARE THE RIG'S (src/data/copy/town-duties.json). No words, no chip — the town-life rule.
// ⚠️ THE NUMBERS ARE THE PASS WORKER'S: `sofar` is the cheque's own formula (JOB_PAY × days ÷ 7), and
// payday is Monday, counted here from the UTC clock. The chip never promises a coin the cheque will
// not pay.
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
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// the numbers go in bold, so the eye finds them; the words stay the rig's
const fill = (line, vals) => esc(line).replace(/\{(coins|days)\}/g, (m, k) => '<b>' + (vals[k] | 0) + '</b>');

export function bootTownDuties({ view, work, track }) {
  if (!COPY || !COPY.duty) return null;   // the words are not approved yet: the square has no chip, not a broken one
  injectCss();
  const el = document.createElement('div');
  el.className = 'twd-chip';
  el.hidden = true;
  el.innerHTML = '<button type="button" class="twd-chip__badge" aria-label="fold the work note"></button><span></span>';
  el.querySelector('button').innerHTML = CASE_SVG;
  const badge = el.querySelector('button'), text = el.querySelector('span');
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

  function lineFor(s) {
    if (!s || !s.at) return '';
    if (s.owed > 0 && COPY.payslip) return esc(COPY.payslip);
    if (!s.turnedUp) return esc(COPY.duty[s.at] || '');
    if (s.at === 'cafe') return esc(COPY.cafeDone || '');
    return COPY.wage ? fill(COPY.wage, { coins: s.sofar, days: daysToPayday() }) : '';
  }
  function render() {
    const s = work.seam.state();
    const html = lineFor(s);
    if (!html) { el.hidden = true; shown = ''; return; }
    if (html !== shown) {
      shown = html;
      text.innerHTML = html;
      // 📡 Pulse hears the chip once per line per day: a duty shown, a wage shown, a payslip announced
      const kind = s.owed > 0 ? 'payslip' : (!s.turnedUp ? 'duty' : 'wage');
      const key = today() + ':' + s.at + ':' + kind;
      if (work.seam.told() !== key) { work.seam.tell(key); track('town_duty', { at: s.at, kind }); }
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
      line: () => text.textContent,
      html: () => text.innerHTML,
      folded: () => el.classList.contains('is-min'),
      top: () => el.style.top,
      stop: () => clearInterval(placer),
    },
  };
}
