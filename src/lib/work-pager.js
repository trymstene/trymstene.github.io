// 📟 THE PAGER, EVERYWHERE ELSE (23 Sep 2026; the staff card plan, slice 0b, decision 6 — Trym took it: a call reaches
// you "everywhere, the way the quest note already follows you", because a call is what brings an on-call worker back to
// town and it can only do that if it reaches you in the park).
//
// The park, the bay and the homestead carry the work note's calling twin (its amber) while a call is open: the note's own words
// (src/data/copy/town-duties.json `call`), the same briefcase that folds it, and the same fold (tw-job-v1 `hm`, which the
// town's note reads too). A tap opens the world's own travel card, where the town is one row away. The rave stays clean,
// as the quest's compass does there. It knows nothing the town does not: the calls are src/lib/work-calls.js.
import DUTY from '../data/copy/town-duties.json';
import { calls, jobAt, ONCALL_JOBS } from './work-calls.js';

const CASE_SVG = '<svg viewBox="0 0 16 14" aria-hidden="true"><path fill="#111" d="M5 0h6v1H5zM4 1h1v2H4zM11 1h1v2h-1zM0 3h16v1H0zM0 4h1v9H0zM15 4h1v9h-1zM0 13h16v1H0z"/><path fill="#c8823a" d="M1 4h14v9H1z"/><path fill="#8a5a2b" d="M1 8h14v1H1zM6 1h4v2H6z"/><path fill="#ffd23f" d="M7 7h2v3H7z"/></svg>';
// the town's note in its calling amber (town-duties.js .twd-chip--call): one look for one note wherever it is read. ⚠️ z-index 10
// is the quest chip's, and load-bearing (world-quest.js .bwq-hint): above the map and the weather, below every card.
const CSS = `
.wkp { position:absolute; left:18px; top:48px; z-index:10; max-width:62%; background:linear-gradient(#ffc36b,#f29a2e); color:#2a1606;
  border:3px solid #000; box-shadow:3px 3px 0 #000; border-radius:2px; font-size:0.78rem; font-weight:800; padding:7px 11px 7px 22px; line-height:1.35;
  cursor:pointer; pointer-events:auto; touch-action:manipulation; -webkit-tap-highlight-color:transparent; transition:top 200ms ease-out; }
.wkp[hidden] { display:none !important; }
.wkp.is-min { max-width:none; padding:0; width:0; height:0; background:none; border-color:transparent; box-shadow:none; pointer-events:none; }
.wkp.is-min > span { display:none; }
.wkp__b { position:absolute; left:-13px; top:-15px; line-height:0; background:#111; border-radius:999px; padding:6px 7px; transform:rotate(-8deg);
  box-shadow:2px 2px 0 rgba(0,0,0,0.35); border:0; cursor:pointer; pointer-events:auto; touch-action:manipulation; -webkit-tap-highlight-color:transparent; }
.wkp.is-min .wkp__b { background:#f29a2e; }
.wkp__b::after { content:''; position:absolute; inset:-8px; }
.wkp__b svg { display:block; width:18px; height:16px; }
.wkp.is-ring:not(.is-min), .wkp.is-ring .wkp__b { animation:wkpRing 0.8s ease-out; }
@keyframes wkpRing { 20% { transform:rotate(-6deg) scale(1.08); } 45% { transform:rotate(5deg) scale(1.08); } 70% { transform:rotate(-3deg); } }
@media (prefers-reduced-motion: reduce) { .wkp.is-ring, .wkp.is-ring .wkp__b { animation:none; } }
body.pk-inside .wkp, body.bh-inside .wkp, .hs-world.is-inside ~ .wkp { display:none !important; }
`;
const track = (ev, p) => { try { window.gtag && window.gtag('event', ev, p || {}); } catch (e) {} };
const JOB = 'tw-job-v1';
const readJob = () => { try { return JSON.parse(localStorage.getItem(JOB) || 'null') || {}; } catch (e) { return {}; } };
// the fold is the town note's own (tw-job-v1 hm): fold it here and it is folded there, and back
const folded = () => !!readJob().hm;
const setFold = (v) => { try { const j = readJob(); j.hm = v ? 1 : 0; localStorage.setItem(JOB, JSON.stringify(j)); } catch (e) {} };

export function bootWorkPager({ view, area }) {
  if (!view || !DUTY.call || area === 'rave') return null;
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const el = document.createElement('div');
  el.className = 'wkp';
  el.hidden = true;
  el.innerHTML = '<button type="button" class="wkp__b" aria-label="fold the work note">' + CASE_SVG + '</button><span></span>';
  const badge = el.firstChild, text = el.lastChild;
  view.appendChild(el);
  let rung = '';
  const fold = () => { el.classList.toggle('is-min', folded()); badge.setAttribute('aria-expanded', folded() ? 'false' : 'true'); };
  badge.addEventListener('click', (e) => { e.stopPropagation(); setFold(!folded()); fold(); });
  el.addEventListener('pointerdown', (e) => { if (!el.classList.contains('is-min')) e.stopPropagation(); });   // a tap on the note never walks the banana
  // the way back: the world's own travel card (the door on the action bar), where the town is one row away
  el.addEventListener('click', (e) => {
    if (el.classList.contains('is-min') || e.target.closest('.wkp__b')) return;
    e.stopPropagation();
    track('town_staff', { at: jobAt(), door: 'pager', act: 'travel', area });
    const door = document.getElementById('wtBtn');
    if (door) door.click(); else location.href = '/town/';
  });
  // under the quest note, never on it (the town note's own column rule). ⚠️ its space is kept while it is still WAITING to
  // pop in (bwq-hint--wait is invisible, not absent): measured only once it showed, the note popped in on top of this one
  function place() {
    const q = view.querySelector('.bwq-hint');
    let top = 48;
    if (q && !q.hidden && getComputedStyle(q).display !== 'none') {
      const vr = view.getBoundingClientRect();
      if (q.classList.contains('is-min')) { const b = q.querySelector('.bwq-hint__badge'), r = b && b.getBoundingClientRect(); top = r && r.height ? Math.round(r.bottom - vr.top) + 22 : 92; }
      else top = Math.round(q.getBoundingClientRect().bottom - vr.top) + 18;
    }
    el.style.top = top + 'px';
  }
  function tick() {
    const at = jobAt();
    const ring = ONCALL_JOBS[at] ? calls(at).find((c) => c.open) : null;
    const line = ring ? DUTY.call[ring.kind] : '';
    if (!line) { el.hidden = true; rung = ''; return; }
    if (line !== rung) {
      rung = line; text.textContent = line;
      el.classList.remove('is-ring'); void el.offsetWidth; el.classList.add('is-ring');
      track('town_staff', { at, door: 'pager', act: 'ring', kind: ring.kind, area });
    }
    el.hidden = false;
    fold();
    place();
  }
  tick();
  // the calls change by the minute; the quest note above can pop in, fold or grow at any moment, so the place is kept
  // on its own quicker beat
  const timer = setInterval(tick, 3000), placer = setInterval(() => { if (!el.hidden) place(); }, 700);
  return { seam: { hidden: () => el.hidden, line: () => text.textContent, folded: () => el.classList.contains('is-min'), tick, stop: () => { clearInterval(timer); clearInterval(placer); } } };
}
