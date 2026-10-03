// ✨ SHIMMER, THE LIGHT EVERY PERK SPEAKS IN (3 Oct 2026). The endgame after level 99 is the Claude Doc "Shimmer & the Star
// Map"; Trym, on starting it: "for the perks we should make a preview of the perks and how they would look visually so we
// can make sure they actually feel like something special". This is that look, written to become the real layer: today
// only the perk bench plays it (src/lib/shimmer-bench.js, ?shimmer in any area), and nothing here earns or changes a stat.
//
// ONE LIGHT. Everything a star does is drawn in starlight — blue-white pixel stars under a static glow (§21.4: transform
// and opacity move, a filter never does) — so a player learns "a blue sparkle is my stars". The XP's own light stays
// whitish gold; Shimmer is the blue one. Each KIND of perk has one way to show itself:
//   daily, streak   a buff chip under the HUD with the game's own clock (a streak fills star pips over your head first)
//   lucky           a star glint where the luck landed, and the perk's starlit tag
//   shared          a ring of starlight on the ground that the players inside it can see
//   comfort         a small star on the thing it improves, and the tag when it saves you something
//   always on       the blue part beside "+N XP"
//   shine           its own effect, every time
import W from '../data/copy/shimmer.json';
import WL from '../data/copy/world-level.json';
import { fillWords } from './fill-words.js';
import { burst } from './world-burst.js';
import { bigMoment } from './world-moment.js';

export const WORDS = W;
const PERK = Object.fromEntries(W.perks.map((p) => [p.key, p]));
export const perkWords = (k) => PERK[k] || { key: k, name: k, line: '' };

// each area: its view (the frame), its world (what pans) and your banana in it — world-xp.js's own table, plus the world
export const AREAS = {
  town: { view: '#twView', world: '#twWorld', me: '.tw-me' },
  park: { view: '#pkView', world: '#pkWorld', me: '#pkMe' },
  beach: { view: '#bhView', world: '#bhWorld', me: '#bhMe' },
  homestead: { view: '.hs-view', world: '.hs-world', me: '#hsMe' },
  rave: { view: '.rv-club', world: '#rvFloor', me: '.rv-raver--me', moment: '#rvFloor' },
};
export const areaKey = (() => { try { return location.pathname.split('/')[1] || ''; } catch (e) { return ''; } })();
const A = AREAS[areaKey] || null;
const $ = (s) => (s ? document.querySelector(s) : null);
export const still = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
export const els = () => ({ view: $(A && A.view), world: $(A && A.world), me: $(A && A.me) });

// ── the pixel star, in three sizes: a white heart, pale-blue arms, blue tips. Drawn once, used everywhere.
const ART = {
  s: ['..a..', '..b..', 'abcba', '..b..', '..a..'],
  m: ['...a...', '...b...', '..bcb..', 'abcccba', '..bcb..', '...b...', '...a...'],
  l: ['....a....', '....b....', '...bcb...', '..bcccb..', 'abcccccba', '..bcccb..', '...bcb...', '....b....', '....a....'],
};
const INK = { a: '#7fbfff', b: '#bfe3ff', c: '#ffffff' };
const GOLD = { a: '#ffcf4a', b: '#ffe9a0', c: '#fffdf0' };
const made = {};
export function starSrc(size = 'm', ink = INK) {
  const key = size + (ink === GOLD ? 'g' : '');
  if (made[key]) return made[key];
  const rows = ART[size], c = document.createElement('canvas');
  c.width = rows[0].length; c.height = rows.length;
  const x = c.getContext('2d');
  rows.forEach((r, y) => [...r].forEach((ch, i) => { if (ink[ch]) { x.fillStyle = ink[ch]; x.fillRect(i, y, 1, 1); } }));
  return (made[key] = c.toDataURL());
}
export const starPx = (size) => ART[size][0].length;
export const GOLD_INK = GOLD;

const CSS = `
.sh-star{position:absolute;left:0;top:0;pointer-events:none;image-rendering:pixelated;filter:drop-shadow(0 0 2px rgba(223,240,255,.95)) drop-shadow(0 0 6px rgba(79,157,255,.75))}
.sh-star--gold{filter:drop-shadow(0 0 2px rgba(255,248,214,.95)) drop-shadow(0 0 6px rgba(255,200,80,.7))}
.sh-glow{position:absolute;left:0;top:0;pointer-events:none;border-radius:50%;background:radial-gradient(circle,rgba(223,240,255,.85) 0,rgba(127,191,255,.45) 35%,rgba(79,157,255,0) 70%)}
.sh-txt{background:linear-gradient(100deg,#7fbfff 0%,#bfe3ff 30%,#fff 46%,#fff7d6 50%,#fff 54%,#bfe3ff 70%,#7fbfff 100%);background-size:260% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:shSweep 2.4s linear infinite}
@keyframes shSweep{from{background-position:130% 0}to{background-position:-30% 0}}
.sh-tag{position:absolute;left:0;top:0;z-index:2180;pointer-events:none;display:flex;align-items:center;gap:5px;padding:3px 9px 3px 5px;white-space:nowrap;background:linear-gradient(180deg,rgba(20,42,90,.96),rgba(8,16,40,.96));border:2px solid #000;border-radius:4px;box-shadow:inset 0 0 0 1px rgba(127,191,255,.6),2px 2px 0 #000,0 0 12px 2px rgba(80,150,255,.55);font-size:.72rem;font-weight:900;letter-spacing:.04em}
.sh-tag img{width:14px;height:14px;image-rendering:pixelated;flex:none;filter:drop-shadow(0 0 3px rgba(127,191,255,.9))}
.sh-tag>span{filter:drop-shadow(0 1px 0 #000)}
.sh-buffs{position:absolute;z-index:2175;display:flex;flex-direction:column;align-items:flex-start;gap:4px;pointer-events:none}
.sh-buff{display:flex;align-items:center;gap:5px;padding:2px 8px 2px 4px;background:rgba(8,16,40,.92);border:2px solid #000;border-radius:999px;box-shadow:inset 0 0 0 1px rgba(127,191,255,.65),0 0 9px 1px rgba(80,150,255,.5);font-size:.64rem;font-weight:900;color:#dff0ff;white-space:nowrap}
.sh-buff img{width:12px;height:12px;image-rendering:pixelated}
.sh-buff b{font-variant-numeric:tabular-nums;color:#8fd0ff;font-weight:900}
.sh-pips{position:absolute;left:0;top:0;z-index:2176;display:flex;gap:3px;pointer-events:none;transform:translate(-50%,-100%)}
.sh-pips img{width:14px;height:14px;image-rendering:pixelated;opacity:.32;filter:grayscale(1) brightness(.7)}
.sh-pips img.is-on{opacity:1;filter:drop-shadow(0 0 3px rgba(191,227,255,.95)) drop-shadow(0 0 6px rgba(79,157,255,.8))}
.sh-ring{position:absolute;left:0;top:0;pointer-events:none;border-radius:50%;background:radial-gradient(closest-side,rgba(127,191,255,0) 62%,rgba(127,191,255,.22) 76%,rgba(207,232,255,.6) 88%,rgba(127,191,255,0) 100%)}
.sh-plus{position:absolute;left:0;top:0;z-index:2172;pointer-events:none;white-space:nowrap;font-weight:800;letter-spacing:.04em;font-size:.86rem;display:flex;align-items:center;gap:6px}
.sh-plus .y{color:#ffe135;text-shadow:1px 1px 0 #000,-1px 1px 0 #000,1px -1px 0 #000,-1px -1px 0 #000,0 2px 0 #000}
.sh-plus .b{display:flex;align-items:center;gap:3px;color:#cfe6ff;text-shadow:1px 1px 0 #000,-1px 1px 0 #000,1px -1px 0 #000,-1px -1px 0 #000,0 2px 0 #000}
.sh-plus .b img{width:12px;height:12px;image-rendering:pixelated;filter:drop-shadow(0 0 3px rgba(127,191,255,.9))}
.sh-riser{position:absolute;left:0;top:0;z-index:2171;pointer-events:none;white-space:nowrap;font-weight:900;letter-spacing:.05em;font-size:1rem;color:#dff0ff;text-shadow:1px 1px 0 #000,-1px 1px 0 #000,1px -1px 0 #000,-1px -1px 0 #000,0 2px 0 #000}
.sh-riser>span{display:flex;align-items:center;gap:6px;transform:translate(-50%,-100%)}
.sh-riser img{width:18px;height:18px;image-rendering:pixelated;filter:drop-shadow(0 0 5px rgba(127,191,255,.95))}
.wh__lvl.sh-pill,[data-wh="lvl"].sh-pill{color:#a9d6ff!important;border-color:#4f9dff!important;background:rgba(10,22,48,.92)!important;box-shadow:0 0 0 2px rgba(110,180,255,.28),0 0 10px 3px rgba(80,150,255,.5)!important}
.sh-pill .wh__lvln,.sh-pill [data-wh="lvln"]{display:none!important}
.sh-lvln{display:none}
.sh-pill .sh-lvln{display:flex;align-items:center;gap:4px;font-weight:900}
.sh-lvln img{width:13px;height:13px;image-rendering:pixelated;filter:drop-shadow(0 0 3px rgba(127,191,255,.9))}
.sh-pill .wh__lvlbar,.sh-pill .rv-mixer__lvlbar{display:none!important}
.sh-bar{display:none}
.sh-pill .sh-bar{display:block;flex:1 1 34px;min-width:26px;height:6px;align-self:center;background:rgba(14,30,66,.95);border:1px solid #000;overflow:hidden}
.sh-bar i{display:block;height:100%;width:100%;transform-origin:0 50%;transform:scaleX(0);background:linear-gradient(90deg,#4f9dff,#dff0ff);transition:transform .3s cubic-bezier(.25,.9,.3,1)}
.sh-orb{position:absolute;left:0;top:0;z-index:2170;pointer-events:none}
.wm-moment.sh-moment{background:rgba(6,14,36,.8);border-color:rgba(127,191,255,.75);box-shadow:0 4px 0 rgba(0,0,0,.4),0 0 26px 4px rgba(80,150,255,.45)}
.wm-moment.sh-moment b{color:#dff0ff}
.wm-moment.sh-moment small{color:#cfe6ff}
.sh-sweep{position:absolute;pointer-events:none;overflow:hidden;border-radius:3px}
.sh-sweep i{position:absolute;top:-20%;bottom:-20%;width:38%;left:-45%;background:linear-gradient(100deg,rgba(191,227,255,0),rgba(223,240,255,.55) 45%,rgba(255,255,255,.85) 50%,rgba(223,240,255,.55) 55%,rgba(191,227,255,0));transform:skewX(-12deg)}
.sh-lp{position:absolute;left:0;top:0;transform-origin:0 0;pointer-events:none;overflow:visible}
.sh-fall{position:absolute;left:0;top:0;pointer-events:none;height:3px;border-radius:2px;transform-origin:100% 50%;background:linear-gradient(90deg,rgba(127,191,255,0),rgba(191,227,255,.75) 70%,#fff)}
@media (prefers-reduced-motion:reduce){.sh-txt{animation:none;background-position:50% 0}}
`;
let styled = false;
function style() {
  if (styled) return;
  styled = true;
  const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s);
}

// ── where things are. World points are the world's own px (what pans and scales with it); view points the frame's.
function worldScale(world) {
  const r = world.getBoundingClientRect();
  return { r, sx: (r.width / (world.offsetWidth || r.width)) || 1, sy: (r.height / (world.offsetHeight || r.height)) || 1 };
}
export function screenToWorld(cx, cy) {
  const { world } = els(); if (!world) return null;
  const { r, sx, sy } = worldScale(world);
  return { x: (cx - r.left) / sx, y: (cy - r.top) / sy };
}
export function worldToView(p) {
  const { view, world } = els(); if (!view || !world || !p) return null;
  const { r, sx, sy } = worldScale(world), vr = view.getBoundingClientRect();
  return { x: r.left + p.x * sx - vr.left - view.clientLeft, y: r.top + p.y * sy - vr.top - view.clientTop };
}
// your banana's feet and head on the screen (its canvas: the banana is drawn with headroom for a hat)
export function meScreen() {
  const { me } = els(); if (!me) return null;
  const cv = me.querySelector('canvas:not(.wx-halo):not(.wb-shape)') || me, r = cv.getBoundingClientRect();
  if (!r.width) return null;
  return { x: r.left + r.width / 2, feet: r.top + r.height * 0.93, head: r.top + r.height * 0.18, w: r.width };
}
export const meWorld = () => { const s = meScreen(); return s ? screenToWorld(s.x, s.feet) : null; };
export function meZ() { const { me } = els(); const z = me ? parseInt(getComputedStyle(me).zIndex, 10) : NaN; return Number.isFinite(z) ? z : 50; }
const worldPxPerScreen = () => { const { world } = els(); return world ? 1 / worldScale(world).sx : 1; };
// ⚠️ every size and reach in the world is given in SCREEN px and turned into the world's own here: the areas scale their
// worlds differently (the town shrinks to fit a phone, the park magnifies), and a star must look the same size in all of them
export const sp = (screenPx) => screenPx * worldPxPerScreen();

// a thing in the world, at a world point, standing on its feet (bottom centre)
function inWorld(el, p, z) {
  const { world } = els(); if (!world) return null;
  el.style.position = 'absolute';
  el.style.left = p.x + 'px'; el.style.top = p.y + 'px';
  el.style.zIndex = String(z == null ? meZ() - 1 : z);
  world.appendChild(el);
  return el;
}
// ✨ LIGHT GOES ABOVE THE NIGHT. Starlight drawn in the world was darkened with it, and a star is what should shine at
// night. So light (a glint, a spray, a ring, a falling star, a sweep) rises into a pane over the night once it shows — the
// marks layer's rule for words (world-marks.js) — and that pane copies the world's own size and transform every frame, so a
// world point, a size and a flight all hold there. Things (a flower, a crop, a drop) stay in the world, night and all.
let lp = null;
const nightOn = () => { const { view } = els(); const wm = view && view.__wm; return !!(wm && wm.on && wm.on()); };
function mirror() {
  const { view, world } = els(); if (!lp || !view || !world) return;
  const vr = view.getBoundingClientRect(), wr = world.getBoundingClientRect();
  const sx = wr.width / (world.offsetWidth || wr.width) || 1, sy = wr.height / (world.offsetHeight || wr.height) || 1, st = lp.style;
  st.width = world.offsetWidth + 'px'; st.height = world.offsetHeight + 'px';
  st.transform = 'translate(' + (wr.left - vr.left - view.clientLeft) + 'px,' + (wr.top - vr.top - view.clientTop) + 'px) scale(' + sx + ',' + sy + ')';
  st.zIndex = String((parseInt(getComputedStyle(view).getPropertyValue('--wn-z'), 10) || 7) + 2);
}
function lightPane() {
  const { view } = els(); if (!view) return null;
  if (!lp || !lp.isConnected) {
    lp = document.createElement('div'); lp.className = 'sh-lp'; view.appendChild(lp);
    const sync = () => { if (!lp || !lp.isConnected) return; if (!lp.firstChild) { lp.remove(); lp = null; return; } mirror(); requestAnimationFrame(sync); };
    requestAnimationFrame(sync);
  }
  mirror();
  return lp;
}
function inLight(el, p, z) {
  const pane = nightOn() ? lightPane() : null;
  if (!pane) return inWorld(el, p, z);
  el.style.position = 'absolute';
  el.style.left = p.x + 'px'; el.style.top = p.y + 'px';
  el.style.zIndex = String(z == null ? meZ() : z);
  pane.appendChild(el);
  return el;
}
// a thing in the view, following a world point (or your banana) every frame until it is removed
function follow(el, at) {
  const { view } = els(); if (!view) return () => {};
  el.style.position = 'absolute';
  view.appendChild(el);
  let live = true;
  // by left/top, so the element's own transform (its centring) and its animated translate and scale all still apply
  const put = () => { const p = at(); if (p) { el.style.left = Math.round(p.x) + 'px'; el.style.top = Math.round(p.y) + 'px'; } };
  put();
  const tick = () => { if (!live || !el.isConnected) return; put(); requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  return () => { live = false; };
}
const overMe = (dy = 0) => () => { const s = meScreen(), { view } = els(); if (!s || !view) return null; const vr = view.getBoundingClientRect(); return { x: s.x - vr.left - view.clientLeft, y: s.head - vr.top - view.clientTop + dy }; };

export function starEl(size = 'm', px = 0, gold) {
  style();
  const i = new Image();
  i.src = starSrc(size, gold ? GOLD : INK);
  i.className = 'sh-star' + (gold ? ' sh-star--gold' : '');
  px = px || starPx(size) * 2;
  i.width = px; i.height = px; i.style.width = px + 'px'; i.style.height = px + 'px';
  i.style.marginLeft = (-px / 2) + 'px'; i.style.marginTop = (-px / 2) + 'px';
  i.alt = ''; i.draggable = false;
  return i;
}
const play = (el, frames, opt) => new Promise((ok) => {
  if (!el.animate) { ok(); return; }
  const a = el.animate(frames, { fill: 'both', ...opt });
  a.onfinish = a.oncancel = ok;
});

// ── ✦ THE TAG: the perk's name rising off where it happened, in Shimmer's own type — how a player learns which star did it
export const tag = (perkKey, at) => note(perkWords(perkKey).name, at);
// …and the same starlit label with any words (the stardust a falling star gave)
export function note(text, at) {
  style();
  const d = document.createElement('div');
  d.className = 'sh-tag';
  const s = new Image(); s.src = starSrc('m'); s.alt = '';
  const t = document.createElement('span'); t.className = 'sh-txt'; t.textContent = text;
  d.appendChild(s); d.appendChild(t);
  const stop = follow(d, at || overMe(-8));
  const inner = d;
  d.style.marginLeft = '0';
  const run = still()
    ? new Promise((ok) => setTimeout(ok, 1800))
    : play(inner, [
      { translate: '-50% -60%', scale: '0.6', opacity: 0 },
      { translate: '-50% -110%', scale: '1.08', opacity: 1, offset: 0.1 },
      { translate: '-50% -120%', scale: '1', opacity: 1, offset: 0.2 },
      { translate: '-50% -150%', scale: '1', opacity: 1, offset: 0.82 },
      { translate: '-50% -190%', scale: '1', opacity: 0 },
    ], { duration: 2100, easing: 'ease-out' });
  if (still()) d.style.translate = '-50% -130%';
  run.then(() => { stop(); d.remove(); });
}

// ── a glint: a star pops where something lucky landed (gold for a golden thing)
export function glint(p, opts = {}) {
  if (!p) return;
  style();
  const g = document.createElement('i'); g.className = 'sh-glow';
  const size = sp(opts.size || 60);
  Object.assign(g.style, { width: size + 'px', height: size + 'px', marginLeft: (-size / 2) + 'px', marginTop: (-size / 2) + 'px' });
  const s = starEl('l', sp(starPx('l') * (opts.scale || 4)), opts.gold);
  const z = opts.z == null ? meZ() + 400 : opts.z;
  inLight(g, p, z); inLight(s, p, z + 1);
  if (still()) { setTimeout(() => { g.remove(); s.remove(); }, 900); return; }
  play(g, [{ opacity: 0, scale: '0.3' }, { opacity: 1, scale: '1', offset: 0.25 }, { opacity: 0, scale: '1.4' }], { duration: 760, easing: 'ease-out' }).then(() => g.remove());
  play(s, [{ scale: '0.2', rotate: '-45deg', opacity: 0 }, { scale: '1.5', rotate: '0deg', opacity: 1, offset: 0.3 }, { scale: '1', rotate: '0deg', opacity: 1, offset: 0.6 }, { scale: '0.6', rotate: '20deg', opacity: 0 }], { duration: 820, easing: 'cubic-bezier(.2,.8,.3,1)' }).then(() => s.remove());
}

// ── a spray of small stars out of a point (a catch, a perk lighting, the dew)
export function spray(p, n = 10, opts = {}) {
  if (!p || still()) return;
  const reach = sp(opts.reach || 44), up = sp(opts.up || 16), z = opts.z == null ? meZ() + 400 : opts.z;
  for (let i = 0; i < n; i++) {
    const sz = i % 3 ? 's' : 'm', s = starEl(sz, sp(starPx(sz) * 2), opts.gold);
    inLight(s, p, z);
    const t = (i / n) * Math.PI * 2 + Math.random() * 0.6, r = reach * (0.6 + Math.random() * 0.7);
    const dx = Math.cos(t) * r, dy = Math.sin(t) * r * 0.7 - up;
    play(s, [
      { translate: '0 0', scale: '0.4', opacity: 1 },
      { translate: (dx * 0.7).toFixed(1) + 'px ' + (dy * 0.7).toFixed(1) + 'px', scale: '1.1', opacity: 1, offset: 0.45 },
      { translate: dx.toFixed(1) + 'px ' + (dy + sp(10)).toFixed(1) + 'px', scale: '0.3', opacity: 0 },
    ], { duration: 620 + Math.random() * 260, easing: 'cubic-bezier(.12,.8,.3,1)' }).then(() => s.remove());
  }
}

// ── ⏱ THE BUFF CHIP: a daily or a streak running, under the HUD, with its clock (the length is the game's, never the copy's)
let buffBox = null;
export function buff(perkKey, secs, opts = {}) {
  style();
  const { view } = els(); if (!view) return null;
  const hud = view.querySelector('.wh, .rv-mixer') || null;
  if (!buffBox || !buffBox.isConnected) { buffBox = document.createElement('div'); buffBox.className = 'sh-buffs'; view.appendChild(buffBox); }
  const vr = view.getBoundingClientRect(), hr = hud ? hud.getBoundingClientRect() : null;
  buffBox.style.left = (hr ? Math.max(8, hr.left - vr.left) : 8) + 'px';
  buffBox.style.top = (hr ? hr.bottom - vr.top + 6 : 52) + 'px';
  const w = perkWords(perkKey);
  const c = document.createElement('div'); c.className = 'sh-buff';
  const s = new Image(); s.src = starSrc('m'); s.alt = '';
  const t = document.createElement('span'); t.textContent = w.chip || w.name;
  const b = document.createElement('b');
  c.appendChild(s); c.appendChild(t); c.appendChild(b);
  buffBox.appendChild(c);
  let left = secs, timer = 0;
  const show = () => { const m = Math.floor(left / 60), x = Math.max(0, Math.floor(left % 60)); b.textContent = m + ':' + String(x).padStart(2, '0'); };
  show();
  if (!still()) play(c, [{ scale: '0.5', opacity: 0 }, { scale: '1.12', opacity: 1, offset: 0.5 }, { scale: '1', opacity: 1 }], { duration: 360, easing: 'ease-out' });
  const end = () => { clearInterval(timer); if (still()) { c.remove(); return; } play(c, [{ opacity: 1 }, { opacity: 0, translate: '0 -6px' }], { duration: 400 }).then(() => c.remove()); };
  // a bench speeds the clock up so its ending can be seen (opts.fast); the game's would tick once a second
  timer = setInterval(() => { left -= opts.fast || 1; show(); if (left <= 0) end(); }, 1000);
  return { end, add: (more) => { left += more; show(); if (!still()) play(c, [{ scale: '1' }, { scale: '1.15' }, { scale: '1' }], { duration: 320 }); } };
}

// ── ⭐ STREAK PIPS: small stars over your head that light one by one; full, they fly into the HUD and the buff starts
export function pips(n) {
  style();
  const d = document.createElement('div'); d.className = 'sh-pips';
  const stars = [];
  for (let i = 0; i < n; i++) { const s = new Image(); s.src = starSrc('m'); s.alt = ''; d.appendChild(s); stars.push(s); }
  const stop = follow(d, overMe(-30));
  let k = 0;
  return {
    fill() {
      if (k >= n) return k;
      const s = stars[k++];
      s.classList.add('is-on');
      if (!still()) play(s, [{ scale: '1.9' }, { scale: '0.9', offset: 0.6 }, { scale: '1' }], { duration: 300, easing: 'ease-out' });
      return k;
    },
    done() {
      if (still()) { stop(); d.remove(); return Promise.resolve(); }
      return play(d, [{ scale: '1', opacity: 1 }, { scale: '1.35', opacity: 1, offset: 0.35 }, { scale: '0.4', opacity: 0, translate: '0 -160%' }], { duration: 520, easing: 'ease-in' }).then(() => { stop(); d.remove(); });
    },
    drop() { stop(); d.remove(); },
  };
}

// ── 🫂 A SHARED RING: starlight on the ground round you, a few stars walking it; the players inside it get a star too
export function ring(radiusScreen = 74) {
  style();
  const r = document.createElement('i'); r.className = 'sh-ring';
  const stars = [0, 1, 2, 3, 4, 5].map(() => starEl('s', sp(10)));
  const marked = new Map();
  let live = true;
  const t0 = performance.now();
  const tick = (now) => {
    if (!live) return;
    const p = meWorld();
    if (p) {
      const rx = sp(radiusScreen), ry = rx * 0.42;
      if (!r.isConnected) inLight(r, p, meZ() - 2);
      Object.assign(r.style, { left: (p.x - rx) + 'px', top: (p.y - ry) + 'px', width: rx * 2 + 'px', height: ry * 2 + 'px', zIndex: String(meZ() - 2) });
      if (!still()) r.style.opacity = String(0.75 + 0.25 * Math.sin((now - t0) / 520));
      stars.forEach((s, i) => {
        if (!s.isConnected) inLight(s, p, meZ() - 1);
        const a = (now - t0) / 2600 + (i / stars.length) * Math.PI * 2;
        s.style.left = (p.x + Math.cos(a) * rx * 0.92) + 'px'; s.style.top = (p.y + Math.sin(a) * ry * 0.92) + 'px';
        s.style.zIndex = String(Math.sin(a) > 0 ? meZ() + 1 : meZ() - 1);
        s.style.opacity = String(0.55 + 0.45 * Math.sin(a * 2 + i));
      });
      // the other bananas standing in it: a small star over each (they see the ring too)
      const sc = meScreen();
      for (const o of document.querySelectorAll('.rv-raver:not(.rv-raver--me), .tw-npc:not([hidden]), .pk-peer, [data-pid]')) {
        const ob = o.getBoundingClientRect(); if (!ob.width || !sc) continue;
        const inside = Math.hypot((ob.left + ob.width / 2 - sc.x) / (rx / worldPxPerScreen()), (ob.top + ob.height * 0.93 - sc.feet) / (ry / worldPxPerScreen())) < 1;
        if (inside && !marked.has(o)) { const s = starEl('m', 14); s.style.left = '50%'; s.style.top = '4%'; s.style.zIndex = '5'; if (getComputedStyle(o).position === 'static') o.style.position = 'relative'; o.appendChild(s); marked.set(o, s); if (!still()) play(s, [{ scale: '0.2', opacity: 0 }, { scale: '1.3', opacity: 1, offset: 0.5 }, { scale: '1', opacity: 1 }], { duration: 360 }); }
        else if (!inside && marked.has(o)) { marked.get(o).remove(); marked.delete(o); }
      }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return { stop() { live = false; r.remove(); stars.forEach((s) => s.remove()); marked.forEach((s) => s.remove()); marked.clear(); } };
}

// ── 👣 A TRAIL: something left where you walk (blooms, floor sparkles), each lives a while and goes
export function trail(make, opts = {}) {
  let live = true, last = null, n = 0;
  const step = opts.step || 22, life = opts.life || 6500, every = opts.every || 0;
  let lastAt = 0;
  const tick = (now) => {
    if (!live) return;
    const p = meWorld();
    if (p) {
      const moved = last ? Math.hypot(p.x - last.x, p.y - last.y) : Infinity;
      if (moved >= step || (every && now - lastAt > every)) {
        last = p; lastAt = now;
        const el = make(p, n++);
        if (el) setTimeout(() => { if (still() || !el.animate) { el.remove(); return; } play(el, [{ opacity: 1, scale: '1' }, { opacity: 0, scale: '0.6' }], { duration: 700, easing: 'ease-in' }).then(() => el.remove()); }, life);
      }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return { stop() { live = false; } };
}
export { inWorld, inLight, play, follow, overMe, nightOn };

// ── 🌠 SOMETHING FALLS from the sky to a spot near you and waits there to be walked over (a falling star, a glowstick)
export function fall(opts = {}) {
  style();
  const me = meWorld(); if (!me) return Promise.resolve(false);
  const a = Math.random() * Math.PI * 2, dist = sp(opts.dist || 96);
  const at = opts.at || { x: me.x + Math.cos(a) * dist, y: me.y + Math.sin(a) * dist * 0.45 };
  const z = meZ() + 300;
  const s = opts.make ? opts.make(at) : starEl('l', sp(28));
  const from = { x: at.x - sp(170), y: at.y - sp(300) };
  const tail = document.createElement('i'); tail.className = 'sh-fall';
  const len = sp(64), ang = Math.atan2(at.y - from.y, at.x - from.x);
  Object.assign(tail.style, { width: len + 'px', height: sp(3) + 'px', marginLeft: (-len) + 'px', marginTop: (-sp(1.5)) + 'px', rotate: ang + 'rad' });
  inLight(s, from, z); inLight(tail, from, z - 1);
  return new Promise((done) => {
    const land = () => {
      tail.remove();
      for (const an of s.getAnimations ? s.getAnimations() : []) an.cancel();   // the flight's end offset would move it twice
      Object.assign(s.style, { left: at.x + 'px', top: at.y + 'px', translate: '', zIndex: String(Math.round(meZ() - 1)) });
      glint(at, { size: 40, scale: 2 });
      if (opts.landed) opts.landed(at);
      // it waits, breathing, until a banana's feet come over it
      const t0 = performance.now();
      let bob = null;
      if (!still() && s.animate) bob = s.animate([{ translate: '0 0', opacity: 1 }, { translate: '0 -3px', opacity: 0.75 }, { translate: '0 0', opacity: 1 }], { duration: 1200, iterations: Infinity });
      const watch = () => {
        if (!s.isConnected) { done(false); return; }
        const p = meWorld();
        if (p && Math.hypot(p.x - at.x, (p.y - at.y) * 1.6) < sp(opts.reach || 30)) {
          if (bob) bob.cancel();
          s.remove();
          spray(at, 10, { reach: 40 });
          if (opts.caught) opts.caught(at);
          done(true);
          return;
        }
        if (performance.now() - t0 > (opts.wait || 45000)) { s.remove(); done(false); return; }
        requestAnimationFrame(watch);
      };
      requestAnimationFrame(watch);
    };
    if (still() || !s.animate) { land(); return; }
    const dx = at.x - from.x, dy = at.y - from.y;
    play(s, [{ translate: '0 0', scale: '0.7' }, { translate: dx + 'px ' + dy + 'px', scale: '1' }], { duration: 900, easing: 'cubic-bezier(.35,.05,.7,.4)' }).then(land);
    play(tail, [{ translate: '0 0', opacity: 0 }, { opacity: 1, offset: 0.15 }, { translate: dx + 'px ' + dy + 'px', opacity: 0.9 }], { duration: 900, easing: 'cubic-bezier(.35,.05,.7,.4)' });
  });
}

// ── a sweep of starlight across an element (your plots shimmering, a sign lighting)
export function sweep(el, opts = {}) {
  style();
  const { view } = els(); if (!view || !el) return { stop() {} };
  const box = document.createElement('div'); box.className = 'sh-sweep';
  const band = document.createElement('i'); box.appendChild(band);
  let live = true;
  const host = opts.into || (nightOn() ? lightPane() : el.parentElement);
  if (!host) return { stop() {} };
  Object.assign(box.style, { left: el.offsetLeft + 'px', top: el.offsetTop + 'px', width: el.offsetWidth + 'px', height: el.offsetHeight + 'px', zIndex: String((parseInt(getComputedStyle(el).zIndex, 10) || 0) + 1) });
  if (opts.mask) { box.style.webkitMaskImage = box.style.maskImage = opts.mask; box.style.webkitMaskSize = box.style.maskSize = '100% 100%'; }
  host.appendChild(box);
  const go = () => { if (!live) return; if (still()) { band.style.left = '30%'; return; } play(band, [{ left: '-45%' }, { left: '110%' }], { duration: opts.ms || 1500, easing: 'ease-in-out', delay: opts.gap == null ? 900 : opts.gap }).then(go); };
  go();
  return { stop() { live = false; box.remove(); } };
}

// ── the HUD's level chip in Shimmer: blue, a star and your Shimmer level instead of "LVL", and its OWN bar — the XP to the next
// Shimmer level, which is the next star (Trym, 3 Oct 2026, on the first bench: "wheres the Shimmer XP progression?" — the
// old yellow bar stayed under the blue number, so the pill read as a count of stars)
let pillEl = null, barEl = null;
export function pill(chip, on, level, frac) {
  style();
  if (!chip) return;
  if (!pillEl || !chip.contains(pillEl)) {
    pillEl = document.createElement('span'); pillEl.className = 'sh-lvln';
    const s = new Image(); s.src = starSrc('m'); s.alt = '';
    pillEl.appendChild(s); pillEl.appendChild(document.createElement('b'));
    barEl = document.createElement('span'); barEl.className = 'sh-bar'; barEl.appendChild(document.createElement('i'));
    const n = chip.querySelector('.wh__lvln, [data-wh="lvln"]');
    chip.insertBefore(pillEl, n ? n.nextSibling : chip.firstChild);
    pillEl.after(barEl);
  }
  pillEl.querySelector('b').textContent = String(level);
  if (frac != null) barEl.firstChild.style.transform = 'scaleX(' + Math.max(0, Math.min(1, frac)) + ')';
  chip.classList.toggle('sh-pill', !!on);
}
// ⭐ XP AFTER 99 KEEPS FLOWING, INTO SHIMMER: the "+N XP" over your banana (the world's own words) and blue orbs into the pill's
// bar, which counts up as each lands — the same beat as world-xp.js, in Shimmer's light. onStep(k, n) as the k-th of n lands.
export function flowXP(chip, amount, onStep) {
  style();
  const { view } = els(), s = meScreen();
  if (!view || !s || !chip) { onStep(1, 1); return Promise.resolve(); }
  const lab = document.createElement('div'); lab.className = 'sh-plus';
  const y = document.createElement('span'); y.className = 'y'; y.textContent = fillWords(WL.plus, { n: amount.toLocaleString('en-US') });
  lab.appendChild(y);
  const stop = follow(lab, () => { const p = overMe(12)(); return p ? { x: p.x + 14, y: p.y } : null; });
  if (still()) setTimeout(() => { stop(); lab.remove(); }, 1500);
  else play(lab, [{ translate: '0 0', opacity: 0 }, { translate: '0 -8px', opacity: 1, offset: 0.12 }, { translate: '0 -24px', opacity: 1, offset: 0.72 }, { translate: '0 -36px', opacity: 0 }], { duration: 1500, easing: 'ease-out' }).then(() => { stop(); lab.remove(); });
  const n = Math.max(3, Math.min(8, 1 + Math.floor(Math.log2(Math.max(1, amount / 20)))));
  if (still()) { onStep(n, n); return Promise.resolve(); }
  const vr = view.getBoundingClientRect(), br = (chip.querySelector('.sh-bar') || chip).getBoundingClientRect();
  const fx = s.x - vr.left, fy = (s.head + s.feet) / 2 - vr.top, tx = br.left + br.width / 2 - vr.left, ty = br.top + br.height / 2 - vr.top;
  let landed = 0;
  return Promise.all(Array.from({ length: n }, (_, i) => {
    const o = starEl(i % 2 ? 's' : 'm', i % 2 ? 10 : 14); o.classList.add('sh-orb');
    o.style.left = fx + 'px'; o.style.top = fy + 'px';
    view.appendChild(o);
    const sx = (Math.random() * 52 - 26), sy = -30 - Math.random() * 40;
    return play(o, [
      { translate: '0 0', scale: '0.3', opacity: 0 },
      { translate: sx + 'px ' + sy + 'px', scale: '1.2', opacity: 1, offset: 0.3, easing: 'cubic-bezier(.45,0,.85,.3)' },
      { translate: (tx - fx) + 'px ' + (ty - fy) + 'px', scale: '0.6', opacity: 1 },
    ], { duration: 560 + i * 20, delay: i * 60, easing: 'linear' }).then(() => { o.remove(); landed += 1; onStep(landed, n); });
  }));
}
export function pillPop(chip) { if (chip && chip.animate && !still()) chip.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.38)' }, { transform: 'scale(0.94)' }, { transform: 'scale(1)' }], { duration: 760, easing: 'ease-out' }); }

// ── a Shimmer level: the burst in blue, "SHIMMER N" riding up off your banana
export function levelUp(chip, level) {
  style();
  const { me } = els();
  if (me) burst(me, 'shimmer');
  pill(chip, true, level);
  pillPop(chip);
  const d = document.createElement('div'); d.className = 'sh-riser';
  const sp = document.createElement('span');
  const s = new Image(); s.src = starSrc('l'); s.alt = '';
  const b = document.createElement('b'); b.textContent = fillWords(W.riser, { n: level });
  sp.appendChild(s); sp.appendChild(b); d.appendChild(sp);
  const stop = follow(d, overMe(-4));
  if (still()) { setTimeout(() => { stop(); d.remove(); }, 1600); return; }
  play(sp, [
    { transform: 'translate(-50%, -60%) scale(0.5)', opacity: 0 },
    { transform: 'translate(-50%, -110%) scale(1.3)', opacity: 1, offset: 0.12 },
    { transform: 'translate(-50%, -125%) scale(1)', opacity: 1, offset: 0.26 },
    { transform: 'translate(-50%, -125%) scale(1)', opacity: 1, offset: 0.8 },
    { transform: 'translate(-50%, -260%) scale(1)', opacity: 0 },
  ], { duration: 1850, easing: 'ease-out' }).then(() => { stop(); d.remove(); });
}

// ── 🌟 LEVEL 99 BECOMES SHIMMER 1: the pill turns blue, the biggest burst, the moment in blue
export function arrive(chip) {
  style();
  const { me } = els();
  if (me) { burst(me, 'shimmer'); setTimeout(() => burst(me, 'shimmer'), 380); }
  setTimeout(() => { pill(chip, true, 1); pillPop(chip); }, 300);
  const host = $(A && (A.moment || A.view));
  setTimeout(() => {
    const d = bigMoment(host, W.arrive.title, W.titles[0] + '\n' + W.arrive.sub, { hold: 4600 });
    if (d) {
      d.classList.add('sh-moment');
      const b = d.querySelector('b'); if (b) b.classList.add('sh-txt');
    }
  }, 520);
}

// ── the "+N XP" as it lands, with the part your stars added in blue beside it (always-on: the area's +1% a star)
export function plusWithStars(base, extra) {
  style();
  const d = document.createElement('div'); d.className = 'sh-plus';
  const y = document.createElement('span'); y.className = 'y'; y.textContent = fillWords(WL.plus, { n: base });
  const b = document.createElement('span'); b.className = 'b';
  const s = new Image(); s.src = starSrc('m'); s.alt = '';
  const t = document.createElement('span'); t.textContent = fillWords(W.plus, { n: extra });
  b.appendChild(t); b.appendChild(s);
  d.appendChild(y); d.appendChild(b);
  const stop = follow(d, () => { const p = overMe(12)(); return p ? { x: p.x + 14, y: p.y } : null; });
  if (still()) { setTimeout(() => { stop(); d.remove(); }, 1500); return; }
  play(d, [{ translate: '0 0', opacity: 0 }, { translate: '0 -8px', opacity: 1, offset: 0.12 }, { translate: '0 -24px', opacity: 1, offset: 0.72 }, { translate: '0 -36px', opacity: 0 }], { duration: 1500, easing: 'ease-out' }).then(() => { stop(); d.remove(); });
  if (!still()) play(b, [{ scale: '0.4', opacity: 0 }, { scale: '0.4', opacity: 0, offset: 0.18 }, { scale: '1.3', opacity: 1, offset: 0.3 }, { scale: '1', opacity: 1 }], { duration: 1500 });
}
