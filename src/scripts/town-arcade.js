// 🕹 THE ARCADE'S WEEK (22 Sep 2026; docs/town-jobs-plan.md §12) — its own chunk since 24 Sep 2026.
//
// Spinner's job had nothing to do behind its 60 a week. Now its staff find the floor littered and one cabinet dark each day:
// walking onto a piece sweeps it, a tap on the dark cabinet is a repair (the repair game, town-repair.js; the streetlight's
// hold as the fallback), and each counts on the week's sheet at the pass worker (town-work.js chore). Per player, per day,
// remembered on this device (tw-arcade-v1); nobody who does not work here sees any of it — an arcade that looks broken to a
// customer is a different feature.
//
// ✂️ WHY ITS OWN CHUNK (Trym, 24 Sep 2026: "do the arcade split"): town-room.js sat at 99% of its budget, and these are its
// staff's alone — so the room loads this when a worker of the arcade walks in, and nobody else downloads a byte of it. The
// room's helpers (sprites, marks, the burst, the day's hash) come in through ctx, so the daily picks are exactly as they were.
import { ARCADE } from './town-geo.js';
import { arrived as callIn } from '../lib/work-calls.js';

const ARC_KEY = 'tw-arcade-v1';
const ARC_LITTER = [[430, 470], [590, 404], [700, 500]];   // floor spots inside the arcade, off every collider
const ARC_CABS = ['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9'];

export function bootTownArcade(ctx) {
  const { world, W, H, pct, sprite, kill, burst, mark, h, dayNum, track } = ctx;
  const arcRead = () => { try { const a = JSON.parse(localStorage.getItem(ARC_KEY) || 'null'); return a && a.d === dayNum() && Array.isArray(a.swept) && Array.isArray(a.fixed) ? a : { d: dayNum(), swept: [], fixed: [] }; } catch (e) { return { d: dayNum(), swept: [], fixed: [] }; } };
  const arcWrite = (a) => { try { localStorage.setItem(ARC_KEY, JSON.stringify(a)); } catch (e) {} };
  let arcLitter = [], arcDead = null, arcLit = null;
  const arcStaff = () => { const j = ctx.job(); return !!(j && j.at === 'condo'); };
  let arcForce = null;   // 🧪 a walk may pick the day's dark cabinet (reset)
  const arcDeadKey = () => arcForce || ARC_CABS[Math.floor(h(dayNum(), 77, 1) * ARC_CABS.length) % ARC_CABS.length];

  function clear() {
    arcLitter.forEach((l) => kill(l.s)); arcLitter = [];
    if (arcDead) { arcDead.el.remove(); arcDead.m.remove(); arcDead = null; }
    if (arcLit) { arcLit.remove(); arcLit = null; }
  }
  function show() {
    clear();
    if (!arcStaff() || !ARCADE || !ARCADE.spots) return;
    const a = arcRead();
    const sweepIn = callIn('condo', 'sweep');   // 📟 the litter and the dark cabinet are the day's CALLS: drawn once each has come in
    // 🗑 LITTER THROUGH THE WEEK (23 Sep 2026): a sweep call brings ONE piece, on the spot of the three the day picks — so the
    // week's three are swept over three call days instead of all on the first (the ladder plan's complaint about the arcade)
    const li = Math.floor(h(dayNum(), 55, 2) * ARC_LITTER.length) % ARC_LITTER.length;
    ARC_LITTER.forEach(([x, y], i) => {
      if (i !== li || a.swept.includes(i) || !sweepIn) return;
      const s = sprite(['trash1', 'trash2', 'trash3'][i % 3], x, y, { z: 2000 + y, cls: 'is-in' });
      if (s) arcLitter.push({ i, s, x, y });
    });
    if (a.lit) litShow(a.lit);   // 🕹 the cabinet a perfect repair lit today (rank 2)
    const key = arcDeadKey();
    if (a.fixed.includes(key) || !callIn('condo', 'fix')) return;
    const el = cabBox(key, 'tw-dead');
    if (!el) return;
    const [, x0, , x1, y1] = ARCADE.spots.find((q) => q[0] === key);
    const m = mark((x0 + x1) / 2, y1, 60, 2000 + y1 + 2, true);
    m.classList.add('is-in');
    arcDead = { key, el, m, x: (x0 + x1) / 2, y: y1 };
  }
  // walking onto a piece of litter on the arcade floor sweeps it up
  function sweepAt(x, y) {
    if (!arcLitter.length) return false;
    const i = arcLitter.findIndex((l) => Math.hypot(l.x - x, l.y - y) < 40);
    if (i < 0) return false;
    const l = arcLitter.splice(i, 1)[0];
    kill(l.s); burst(l.x, l.y - 6);
    const a = arcRead(); a.swept.push(l.i); arcWrite(a);
    ctx.chore('sweep');
    track('town_chore', { at: 'condo', kind: 'sweep' });
    return true;
  }
  const cabinetDead = (key) => !!(arcDead && arcDead.key === key);
  function cabinetRepair(key) {
    if (!cabinetDead(key)) return false;
    // 🔧 a repair is the arcade's own skill game now (town-repair.js, 23 Sep 2026); the hold stays only as the fallback
    if (ctx.repair) ctx.repair(key); else ctx.workStart({ id: 'cab:' + key, type: 'cabinet', x: arcDead.x, y: arcDead.y, foot: arcDead.y, inRoom: true });
    return true;
  }
  // a box over a cabinet's own spot: the dark one, or 🕹 one a perfect repair lit for the rest of the day (rank 2)
  function cabBox(k, cls) {
    const sp = ARCADE.spots.find((q) => q[0] === k); if (!sp) return null;
    const [, x0, y0, x1, y1] = sp, el = document.createElement('i');
    el.className = cls + ' is-in';
    el.style.left = pct(x0, W); el.style.top = pct(y0, H); el.style.width = pct(x1 - x0, W); el.style.height = pct(y1 - y0, H);
    el.style.zIndex = String(2001 + y1);
    world.appendChild(el);
    return el;
  }
  function litShow(k) { arcLit = cabBox(k, 'tw-lit'); }
  function cabinetFixed(key, g, lit) {
    if (!arcDead || arcDead.key !== key) return;
    burst(arcDead.x, arcDead.y - 40);
    arcDead.el.remove(); arcDead.m.remove(); arcDead = null;
    const a = arcRead(); a.fixed.push(key); if (lit) { a.lit = key; litShow(key); } arcWrite(a);
    ctx.chore('fix', g);   // 🔧 the repair's grade is its work XP (src/data/town/jobs.js XP.condo.fix)
    track('town_chore', { at: 'condo', kind: 'fix', g: g | 0 });
  }
  return {
    show, clear, sweepAt, cabinetDead, cabinetRepair, cabinetFixed,
    state: () => ({ staff: arcStaff(), litter: arcLitter.map((l) => ({ i: l.i, x: l.x, y: l.y })), dead: arcDead ? arcDead.key : null, working: ctx.working() }),
    // 🧪 a fresh arcade day for its staff — and its calls already in (tw-calls-v1 qa, honoured under ?towntest alone)
    reset: (k) => { arcForce = ARC_CABS.includes(k) ? k : null; arcWrite({ d: dayNum(), swept: [], fixed: [] }); try { localStorage.setItem('tw-calls-v1', JSON.stringify({ d: dayNum(), t0: Date.now() - 36e5, qa: ['sweep', 'fix'] })); } catch (e) {} if (ctx.here() === 'condo') show(); return true; },
  };
}
