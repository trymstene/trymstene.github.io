// 🧪 THE SHIMMER BENCH (3 Oct 2026). Trym, starting Shimmer and the Star Map: "for the perks we should make a preview of the
// perks and how they would look visually so we can make sure they actually feel like something special". Add ?shimmer to
// any area: a panel under the game plays every perk's moment on YOUR banana in the real world — the bloom trail behind
// you as you walk the park, the ring on the rave's floor, a star falling to be caught — so the feel is judged where it
// would live, on a phone. NOTHING IS EARNED OR SAVED: no stat moves, the pill is only painted, the map is the bench's.
// First round: Shimmer itself (the pill, a level, level 99, the Star Map, a falling star, the stars' part of an XP) in every
// area, and every perk of the two constellations the roadmap starts with — the Watering Can (the park) and the Disco Ball
// (the rave). The other four show their perks' names until their round. The look itself is src/lib/shimmer-fx.js.
import * as F from './shimmer-fx.js';
import { openMap } from './shimmer-map.js';
import { LADDER, KIND, shimmerStep } from '../data/shimmer.js';

const W = F.WORDS;
const front = (dx = 44, dy = -2) => { const p = F.meWorld(); return p ? { x: p.x + F.sp(dx), y: p.y + F.sp(dy) } : null; };
const img = (src, w, h) => { const i = new Image(); i.src = src; i.alt = ''; i.draggable = false; Object.assign(i.style, { position: 'absolute', left: '0', top: '0', width: w + 'px', height: h + 'px', marginLeft: (-w / 2) + 'px', marginTop: (-h) + 'px', imageRendering: 'pixelated', pointerEvents: 'none', transformOrigin: '50% 100%' }); return i; };
const later = (ms, f) => setTimeout(f, ms);
let hint = () => {};   // the bench's caption, for a perk that needs the player somewhere (set by mount)

// a drop of water, as pixels: blue, or starlit (the extra pour a perk gave)
const DROP = ['.a.', 'aba', 'aba', '.a.'];
const dropSrc = (star) => { const c = document.createElement('canvas'); c.width = 3; c.height = 4; const x = c.getContext('2d'); DROP.forEach((r, y) => [...r].forEach((ch, i) => { if (ch === '.') return; x.fillStyle = star ? (ch === 'b' ? '#ffffff' : '#bfe3ff') : (ch === 'b' ? '#bfe6ff' : '#4f9dd9'); x.fillRect(i, y, 1, 1); })); return c.toDataURL(); };
function pour(at, star) {
  const me = F.meWorld(); if (!me || !at) return;
  const d = img(dropSrc(star), F.sp(9), F.sp(12));
  if (star) d.className = 'sh-star';
  F.inWorld(d, { x: me.x + F.sp(14), y: me.y - F.sp(30) }, F.meZ() + 2);
  F.play(d, [{ translate: '0 0' }, { translate: (at.x - me.x - F.sp(14)) + 'px ' + (at.y - me.y + F.sp(30)) + 'px' }], { duration: 380, easing: 'cubic-bezier(.4,0,.9,.6)' }).then(() => { d.remove(); if (star) F.glint(at, { size: 26, scale: 1 }); });
}

// ── 🌳 THE WATERING CAN, in the park
const parkPlants = () => [...document.querySelectorAll('#pkWorld .pk-plant')].filter((p) => p.getClientRects().length && p.style.backgroundImage);
const nearest = (list, n) => { const s = F.meScreen(); if (!s) return list.slice(0, n); return list.map((e) => { const r = e.getBoundingClientRect(); return [Math.hypot(r.left + r.width / 2 - s.x, r.bottom - s.feet), e]; }).sort((a, b) => a[0] - b[0]).slice(0, n).map((x) => x[1]); };
const BLOOMS = [['b-marigold.png', 17, 15], ['b-poppy.png', 12, 15], ['b-bluebell.png', 17, 15], ['b-primrose.png', 17, 12]];
const PARK = {
  bigcan() { const p = front(); for (let i = 0; i < 4; i++) later(i * 170, () => pour(p, i === 3)); later(4 * 170 + 260, () => F.tag('bigcan')); },
  dew() {
    const p = front(); pour(p, false);
    later(400, () => { F.spray(p, 12, { reach: 28, up: 22 }); F.glint(p, { size: 40 }); F.tag('dew'); F.buff('dew', 20 * 60, { fast: 40 }); });
  },
  seedback() {
    const p = front(); F.glint(p, { size: 36 });
    const s = img('/assets/park/g-sprout1.png', F.sp(22), F.sp(22));
    F.inWorld(s, p, F.meZ() + 3);
    const me = F.meWorld();
    F.play(s, [{ translate: '0 0', scale: '0.4' }, { translate: '0 ' + (-F.sp(46)) + 'px', scale: '1.3', offset: 0.45 }, { translate: (me.x - p.x) + 'px ' + (me.y - p.y - F.sp(60)) + 'px', scale: '0.5', opacity: 0.2 }], { duration: 1100, easing: 'ease-in-out' }).then(() => s.remove());
    later(250, () => F.tag('seedback'));
  },
  tidyplots() {
    const plants = nearest(parkPlants(), 4);
    if (!plants.length) { F.glint(front()); F.tag('tidyplots'); return; }
    const sw = plants.map((p) => F.sweep(p, { mask: p.style.backgroundImage, gap: 0, ms: 900 }));
    const badges = plants.map((p) => { const b = F.starEl('m', F.sp(12)); b.style.left = (p.offsetLeft + p.offsetWidth) + 'px'; b.style.top = p.offsetTop + 'px'; b.style.zIndex = String((parseInt(getComputedStyle(p).zIndex, 10) || 0) + 2); p.parentElement.appendChild(b); return b; });
    F.tag('tidyplots');
    later(3200, () => { sw.forEach((x) => x.stop()); badges.forEach((b) => b.remove()); });
  },
  greenstreak() {
    const pp = F.pips(5);
    for (let i = 0; i < 5; i++) later(i * 520, () => { pour(front(30 + i * 8, -4), false); later(380, () => pp.fill()); });
    later(5 * 520 + 500, () => pp.done().then(() => { F.buff('greenstreak', 180, { fast: 6 }); F.tag('greenstreak'); }));
  },
  compost() { const p = front(); F.spray(p, 8, { reach: 22 }); F.glint(p, { size: 34 }); F.tag('compost'); },
  golden() {
    const p = front(48, 0);
    const c = img('/assets/park/c-carrot-4.png', F.sp(40), F.sp(43));
    c.style.filter = 'sepia(1) saturate(3.2) hue-rotate(-12deg) brightness(1.18) drop-shadow(0 0 3px rgba(255,220,120,.9))';
    F.inWorld(c, p, F.meZ() - 1);
    F.play(c, [{ scale: '1 0.1' }, { scale: '1 1.15', offset: 0.6 }, { scale: '1 1' }], { duration: 420, easing: 'ease-out' });
    later(380, () => { F.glint({ x: p.x, y: p.y - F.sp(26) }, { gold: true, size: 44 }); F.spray({ x: p.x, y: p.y - F.sp(20) }, 9, { gold: true, reach: 30 }); F.tag('golden'); });
    later(700, () => F.glint({ x: p.x + F.sp(8), y: p.y - F.sp(12) }, { gold: true, size: 26, scale: 1 }));
    later(5200, () => F.play(c, [{ opacity: 1 }, { opacity: 0 }], { duration: 500 }).then(() => c.remove()));
  },
  neighbour() {
    const p = front(70, 4);
    const r = F.ring(48); later(1800, () => r.stop());
    const s = img('/assets/park/g-sprout1.png', F.sp(20), F.sp(20));
    F.inWorld(s, p, F.meZ() - 1);
    later(500, () => { s.src = '/assets/park/g-sprout2.png'; F.play(s, [{ scale: '1 0.6' }, { scale: '1 1.3', offset: 0.5 }, { scale: '1 1' }], { duration: 380, easing: 'ease-out' }); F.spray({ x: p.x, y: p.y - F.sp(10) }, 8, { reach: 22 }); F.tag('neighbour'); });
    later(4000, () => s.remove());
  },
  raincatch() {
    const me = F.meWorld(), p = front();
    for (let i = 0; i < 26; i++) later(i * 70, () => {
      const at = i % 4 === 0 ? { x: p.x + (Math.random() - 0.5) * F.sp(30), y: p.y + (Math.random() - 0.5) * F.sp(10) } : { x: me.x + (Math.random() - 0.5) * F.sp(220), y: me.y + (Math.random() - 0.5) * F.sp(90) };
      const d = img(dropSrc(i % 4 === 0), F.sp(5), F.sp(13));
      F.inWorld(d, { x: at.x, y: at.y - F.sp(120) }, F.meZ() + 200);
      F.play(d, [{ translate: '0 0', opacity: 0.2 }, { opacity: 0.9, offset: 0.2 }, { translate: '0 ' + F.sp(120) + 'px', opacity: 0.9 }], { duration: 420, easing: 'linear' }).then(() => { d.remove(); if (i % 4 === 0) F.glint(at, { size: 22, scale: 1 }); });
    });
    later(1300, () => F.tag('raincatch'));
  },
  bloom: { toggle: () => F.trail((p, n) => {
    // two at a step, either side of your feet: one alone read as a dropped petal on a phone. One holder carries both, so the
    // pair fades as one. At night they would be as dark as the park, so they rise into the light instead: starlit flowers, a
    // soft rim on each (a glow laid over them read as milk on a phone)
    const night = F.nightOn();
    const b = document.createElement('i');
    Object.assign(b.style, { width: '0', height: '0', pointerEvents: 'none' });
    (night ? F.inLight : F.inWorld)(b, p, F.meZ() - 1);
    [-1, 1].forEach((side, j) => {
      const [src, w, h] = BLOOMS[(n * 2 + j) % BLOOMS.length];
      const f = img('/assets/park/' + src, w, h);
      f.style.left = (side * F.sp(9 + (n % 3) * 2)) + 'px'; f.style.top = F.sp(side > 0 ? 3 : 0) + 'px';
      if (night) f.style.filter = 'drop-shadow(0 0 1px rgba(223,240,255,.95)) drop-shadow(0 0 4px rgba(127,191,255,.7))';
      b.appendChild(f);
      if (!F.still()) F.play(f, [{ scale: '0.2 0' }, { scale: '1.1 1.25', offset: 0.55 }, { scale: '1 1' }], { duration: 380, easing: 'ease-out', delay: j * 90 });
    });
    if (n % 3 === 0) F.glint({ x: p.x, y: p.y - F.sp(14) }, { size: 18, scale: 1, z: F.meZ() - 1 });
    return b;
  }, { step: F.sp(20), life: 6500 }) },
  cancap: { toggle: () => {
    const plants = parkPlants().slice(0, 24);
    if (!plants.length) hint('No plants in view: walk to the garden beds, your plots shimmer there.');
    const sw = plants.map((p, i) => F.sweep(p, { mask: p.style.backgroundImage, gap: 700 + (i % 5) * 260, ms: 1300 }));
    const tw = setInterval(() => { const p = plants[Math.floor(Math.random() * plants.length)]; if (!p) return; const at = F.screenToWorld(p.getBoundingClientRect().left + p.getBoundingClientRect().width * Math.random(), p.getBoundingClientRect().top + 4); F.glint(at, { size: 20, scale: 1, z: (parseInt(getComputedStyle(p).zIndex, 10) || 0) + 2 }); }, 420);
    F.tag('cancap');
    return { stop() { sw.forEach((x) => x.stop()); clearInterval(tw); } };
  } },
};

// ── 🪩 THE DISCO BALL, at the rave
const floor = () => document.getElementById('rvFloor');
function floorGlow(ms = 1600) {
  const f = floor(); if (!f) return;
  const g = document.createElement('i');
  Object.assign(g.style, { position: 'absolute', inset: '0', zIndex: '900', pointerEvents: 'none', boxShadow: 'inset 0 0 0 3px rgba(127,191,255,.85), inset 0 0 34px rgba(79,157,255,.65)' });
  f.appendChild(g);
  F.play(g, [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 0.35, offset: 0.7 }, { opacity: 0 }], { duration: ms }).then(() => g.remove());
}
const RAVE = {
  lightfeet() {
    // ⚠️ a placeholder: the real move is new frames for the banana (art). This only says where it would happen.
    const { me } = F.els(), cv = me && me.querySelector('canvas');
    if (cv && !F.still()) F.play(cv, [{ translate: '0 0', scale: '1 1' }, { translate: '0 -14px', scale: '-1 1', offset: 0.3 }, { translate: '0 -6px', scale: '1 1', offset: 0.6 }, { translate: '0 0', scale: '1 1' }], { duration: 700, easing: 'ease-in-out' });
    F.spray(F.meWorld(), 10, { reach: 34 });
    F.tag('lightfeet');
  },
  doors() { floorGlow(1800); F.tag('doors'); F.buff('doors', 600, { fast: 15 }); },
  spotlove() {
    const f = floor(), s = F.meScreen(); if (!f || !s) return;
    const fr = f.getBoundingClientRect(), x0 = s.x - fr.left, feet = s.feet - fr.top;
    const cone = document.createElement('i');
    Object.assign(cone.style, { position: 'absolute', left: (x0 - 70) + 'px', top: '0', width: '140px', height: (feet + 10) + 'px', zIndex: '800', pointerEvents: 'none', clipPath: 'polygon(42% 0, 58% 0, 100% 100%, 0 100%)', background: 'linear-gradient(180deg, rgba(223,240,255,.05), rgba(191,227,255,.32) 70%, rgba(223,240,255,.5))' });
    f.appendChild(cone);
    const tw = setInterval(() => { const st = F.starEl('s', 10); Object.assign(st.style, { left: (x0 - 40 + Math.random() * 80) + 'px', top: (feet * (0.35 + Math.random() * 0.6)) + 'px', zIndex: '801' }); f.appendChild(st); F.play(st, [{ scale: '0', opacity: 0 }, { scale: '1.2', opacity: 1, offset: 0.4 }, { scale: '0', opacity: 0 }], { duration: 700 }).then(() => st.remove()); }, 110);
    F.play(cone, [{ opacity: 0 }, { opacity: 1, offset: 0.15 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], { duration: 2600 }).then(() => { clearInterval(tw); cone.remove(); });
    later(300, () => F.tag('spotlove'));
  },
  jellykeep() {
    const m = document.getElementById('rvMixer');
    if (m) {
      const b = F.starEl('l', 18); Object.assign(b.style, { left: '100%', top: '0', zIndex: '5' });
      if (getComputedStyle(m).position === 'static') m.style.position = 'relative';
      m.appendChild(b);
      F.play(b, [{ scale: '0.2', opacity: 0 }, { scale: '1.5', opacity: 1, offset: 0.3 }, { scale: '1', opacity: 1, offset: 0.5 }, { scale: '1', opacity: 1 }], { duration: 900 });
      later(4200, () => b.remove());
      F.tag('jellykeep', () => { const r = m.getBoundingClientRect(), v = F.els().view.getBoundingClientRect(); return { x: r.left + r.width / 2 - v.left, y: r.top - v.top }; });
    } else F.tag('jellykeep');
  },
  filler() {
    const me = F.meWorld(); if (!me) return;
    const rx = F.sp(40), ry = rx * 0.42, m = document.createElement('i');
    Object.assign(m.style, { width: rx * 2 + 'px', height: ry * 2 + 'px', marginLeft: (-rx) + 'px', marginTop: (-ry) + 'px', borderRadius: '50%', pointerEvents: 'none', position: 'absolute' });
    F.inWorld(m, me, F.meZ() - 1);
    const t0 = performance.now(), T = 5200;
    const tick = (now) => {
      const k = Math.min(1, (now - t0) / T), p = F.meWorld();
      if (p) { m.style.left = p.x + 'px'; m.style.top = p.y + 'px'; }
      m.style.background = 'conic-gradient(rgba(191,227,255,.85) ' + (k * 360) + 'deg, rgba(43,68,102,.35) 0)';
      m.style.webkitMaskImage = m.style.maskImage = 'radial-gradient(closest-side, transparent 72%, #000 74%, #000 96%, transparent 100%)';
      if (k < 1) { requestAnimationFrame(tick); return; }
      m.remove(); floorGlow(1400); F.spray(F.meWorld(), 12, { reach: 40 }); F.tag('filler'); F.buff('filler', 120, { fast: 4 });
    };
    requestAnimationFrame(tick);
  },
  longpeak() { const b = F.buff('filler', 60, { fast: 2 }); later(900, () => { if (b) b.add(60); F.tag('longpeak'); }); },
  starter: { toggle: () => { F.tag('starter'); return F.ring(84); } },
  glowrain() {
    F.fall({ dist: 90, make: () => { const g = new Image(); g.src = '/assets/rave-guide/glowstick.png'; g.alt = ''; const w = F.sp(32); Object.assign(g.style, { position: 'absolute', width: w + 'px', height: w + 'px', marginLeft: (-w / 2) + 'px', marginTop: (-w / 2) + 'px', imageRendering: 'pixelated', pointerEvents: 'none', filter: 'drop-shadow(0 0 3px rgba(223,240,255,.9)) drop-shadow(0 0 7px rgba(79,157,255,.7))' }); return g; }, caught: () => F.tag('glowrain') });
  },
  peakhour() { floorGlow(1200); F.tag('peakhour'); F.buff('peakhour', 59 * 60, { fast: 120 }); },
  shadow: { toggle: () => F.trail((p) => {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * F.sp(58), big = Math.random() < 0.35;
    const s = F.starEl(big ? 'm' : 's', F.sp(big ? 16 : 12));
    F.inLight(s, { x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r * 0.42 }, F.meZ() - 1);
    if (!F.still()) F.play(s, [{ scale: '0', opacity: 0 }, { scale: '1.2', opacity: 1, offset: 0.35 }, { scale: '0', opacity: 0 }], { duration: 760 }).then(() => s.remove());
    else later(700, () => s.remove());
    return null;
  }, { step: Infinity, every: 55 }) },
  ballcap() {
    const scr = document.querySelector('.rv-screen');
    let name = ''; try { name = (localStorage.getItem('ps-name-v1') || '').trim(); } catch (e) {}
    if (scr) {
      const o = document.createElement('div');
      Object.assign(o.style, { position: 'absolute', inset: '0', zIndex: '6', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', background: 'rgba(6,14,36,.92)', pointerEvents: 'none' });
      const a = F.starEl('l', 22), b = F.starEl('l', 22);
      for (const s of [a, b]) Object.assign(s.style, { position: 'static', margin: '0' });
      const t = document.createElement('b'); t.className = 'sh-txt'; t.textContent = (name || 'YOUR NAME').toUpperCase();
      Object.assign(t.style, { font: '900 1.5rem/1 Anton, "Arial Black", sans-serif', letterSpacing: '.06em' });
      o.appendChild(a); o.appendChild(t); o.appendChild(b);
      if (getComputedStyle(scr).position === 'static') scr.style.position = 'relative';
      scr.appendChild(o);
      F.play(o, [{ opacity: 0 }, { opacity: 1, offset: 0.08 }, { opacity: 1, offset: 0.92 }, { opacity: 0 }], { duration: 6500 }).then(() => o.remove());
    }
    F.tag('ballcap');
  },
};
const PREVIEWS = { park: { c: 'can', fx: PARK }, rave: { c: 'ball', fx: RAVE } };
// the bench's own notes beside a perk whose look needs something not built yet (dev words, not copy)
const NEEDS = { lightfeet: 'needs art: the new dance move is new banana frames; the hop here is a stand-in', ballcap: 'the disco-ball hat needs art; the club sign is shown' };

const CSS = `
.shb{position:fixed;left:0;right:0;bottom:0;z-index:2147483000;background:#0b1730;color:#cfe6ff;border-top:3px solid #000;box-shadow:0 -4px 0 rgba(0,0,0,.35),0 -8px 24px rgba(40,100,220,.25);font:700 12px/1.3 system-ui,sans-serif;max-height:42vh;overflow:auto;padding:8px 10px 10px}
.shb.is-min{max-height:none;overflow:visible;padding:6px 10px}
.shb.is-min .shb-body{display:none}
.shb-top{display:flex;align-items:center;gap:8px}
.shb-top b{font-weight:900;letter-spacing:.08em;color:#fff;font-size:12px}
.shb-top span{opacity:.7;font-size:11px;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.shb-top button{background:#13254d;color:#dff0ff;border:2px solid #000;font:900 11px/1 system-ui,sans-serif;padding:5px 8px;cursor:pointer}
.shb-h{margin:8px 0 4px;font-size:10px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:#6f93c2}
.shb-row{display:flex;flex-wrap:wrap;gap:5px}
.shb-row button{display:flex;align-items:center;gap:5px;background:#13254d;color:#dff0ff;border:2px solid #000;box-shadow:2px 2px 0 #000;font:800 11.5px/1.1 system-ui,sans-serif;padding:6px 8px;cursor:pointer;white-space:nowrap}
.shb-row button i{font-style:normal;font-size:10px;color:#8fc4ff;font-weight:900}
.shb-row button.is-on{background:#2a5bb5;color:#fff}
.shb-row button[disabled]{opacity:.45;cursor:default}
.shb-cap{margin-top:7px;min-height:2.6em;font-size:11.5px;color:#dff0ff}
.shb-cap em{display:block;font-style:normal;color:#8fb6e6;font-size:10.5px;margin-top:2px}
`;

export function mount(api) {
  if (document.querySelector('.shb')) return;
  const chip = api && api.lvl;
  const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s);
  const box = document.createElement('div'); box.className = 'shb';
  box.innerHTML = '<div class="shb-top"><b>SHIMMER BENCH</b><span>a preview: nothing is earned or saved</span><button type="button" data-min>hide</button></div><div class="shb-body"></div>';
  document.body.appendChild(box);
  box.querySelector('[data-min]').onclick = (e) => { box.classList.toggle('is-min'); e.target.textContent = box.classList.contains('is-min') ? 'show' : 'hide'; };
  const body = box.querySelector('.shb-body');
  const cap = document.createElement('div'); cap.className = 'shb-cap';
  const say = (t, e) => { cap.textContent = t; if (e) { const m = document.createElement('em'); m.textContent = e; cap.appendChild(m); } };
  hint = (t) => { const m = document.createElement('em'); m.textContent = t; cap.appendChild(m); };
  const row = (title) => { const h = document.createElement('div'); h.className = 'shb-h'; h.textContent = title; const r = document.createElement('div'); r.className = 'shb-row'; body.appendChild(h); body.appendChild(r); return r; };
  const btn = (r, label, pre, fn, toggle) => {
    const b = document.createElement('button'); b.type = 'button';
    if (pre) { const i = document.createElement('i'); i.textContent = pre; b.appendChild(i); }
    b.appendChild(document.createTextNode(label));
    let live = null;
    b.onclick = () => {
      if (!toggle) { fn(); return; }
      if (live) { live.stop(); live = null; b.classList.remove('is-on'); return; }
      live = fn() || { stop() {} }; b.classList.add('is-on');
    };
    r.appendChild(b);
    return b;
  };
  const pv = PREVIEWS[F.areaKey];
  const myC = pv ? pv.c : Object.keys(LADDER).find((c) => LADDER[c].area === F.areaKey);
  // ── Shimmer itself, in every area. ONE LOOP, and the bench shows it whole (Trym, on the first bench: "wheres the Shimmer XP
  // progression? you want ongoing XP points for Shimmer, not a handful of stars you collect here and there?"): after 99 your
  // XP keeps flowing, into the blue bar; each time it fills you reach the next Shimmer level, and every level is ONE star to
  // place. So the stars you have are always your Shimmer level — placed plus waiting — and the map says how far the next is.
  const S = { level: 38, xp: 1400, lit: { can: 15, ball: 7, barn: 4, clock: 0, fish: 0, hammer: 0 }, toPlace: 12, chosen: {} };
  let on = false, map = null;
  const paint = () => F.pill(chip, on, S.level, S.xp / shimmerStep(S.level));
  const earn = (amount) => {
    on = true; paint();
    let given = 0;
    F.flowXP(chip, amount, (k, n) => {
      const part = Math.round((amount * k) / n) - given; given += part;
      S.xp += part;
      while (S.xp >= shimmerStep(S.level)) { S.xp -= shimmerStep(S.level); S.level += 1; S.toPlace += 1; F.levelUp(chip, S.level); }
      paint();
      if (map) map.refresh();
    });
  };
  const sh = row('Shimmer');
  btn(sh, 'Blue pill', '', () => { on = !on; paint(); say(on ? 'After 99 the level pill turns blue: a star and your Shimmer level, and the bar is the XP to the next one.' : 'The pill as it is today.'); });
  btn(sh, 'Earn XP', '', () => { earn(900); say('After 99 your XP keeps flowing, into the blue bar. Each time it fills you reach the next Shimmer level, and every level is one star to place.', 'Shimmer ' + S.level + ' · ' + S.toPlace + ' to place · the next level costs ' + shimmerStep(S.level).toLocaleString('en-US') + ' XP'); });
  btn(sh, 'Reach 99', '', () => {
    on = true; Object.assign(S, { level: 1, xp: 0, toPlace: 1, chosen: {}, lit: { can: 0, ball: 0, barn: 0, clock: 0, fish: 0, hammer: 0 } });
    F.arrive(chip); setTimeout(paint, 320); if (map) map.refresh();
    say('Level 99 becomes Shimmer 1: the biggest burst there is, the pill turns blue, and your first star waits on the map.');
  });
  // a perk "seen" from the map plays its preview right here (a lasting one runs a few seconds and stops)
  const playPerk = (k) => {
    const fx = pv && pv.fx[k]; if (!fx) return;
    say(F.perkWords(k).name, F.perkWords(k).line);
    if (typeof fx === 'object' && fx.toggle) { const t = fx.toggle(); setTimeout(() => { if (t && t.stop) t.stop(); }, 7000); } else fx();
  };
  btn(sh, 'Star Map', '', () => {
    map = openMap(S, { from: chip, select: myC, step: shimmerStep, canSee: (k) => !!(pv && pv.fx[k]), see: playPerk, lit: (k) => say(F.perkWords(k).name + ' · lit on the map', F.perkWords(k).line), closed: () => { map = null; } });
    say('Your stars are your Shimmer levels. Place one: the figure draws itself, and every fourth star lights a perk.');
  });
  btn(sh, 'Falling star', '', () => { F.fall({ caught: () => F.note(W.dust.replace('{n}', '2')) }); say('Not a map star: a falling star gives STARDUST, the thing wishes are bought with. Walk over it.'); });
  btn(sh, 'Area boost', '', () => { F.plusWithStars(24, 6); say('Always on: every star you place in this area’s constellation adds a little to the XP you earn here. The blue part is your stars’.'); });
  // ── this area's constellation
  if (myC) {
    const nm = W.constellations.find((q) => q.key === myC);
    const r = row((nm ? nm.name : myC) + (pv ? '' : ' · its round comes next'));
    for (const st of LADDER[myC].steps) {
      for (const k of st.slice(1)) {
        const w = F.perkWords(k), fx = pv && pv.fx[k];
        const isToggle = fx && typeof fx === 'object' && fx.toggle;
        const b = btn(r, w.name, String(st[0]), () => {
          say(w.name + ' · star ' + st[0] + ' · ' + KIND[k], w.line + (NEEDS[k] ? ' (' + NEEDS[k] + ')' : ''));
          return isToggle ? fx.toggle() : fx && fx();
        }, isToggle);
        if (!fx) b.disabled = true;
      }
    }
  }
  body.appendChild(cap);
  say('Tap a perk to see it happen on your banana. A lit button stays on: walk around with it.');
}
