// ✨ XP THAT LANDS LIKE COINS (2 Oct 2026). Trym: "i dont feel XP in banana world FEELS great, in the way getting banana
// coins does when getting coins on the spinning wheel … you have nice coins-animation that sends all the coins into your
// wallet in the HUD". Every grant in every area passes passStat → 'pass:rep'; the HUD (world-hud.js) holds its LVL chip
// where it stood and hands the grant here. Sparks fly from your banana into the chip on the wheel's own curve, the chip
// ticks as they land, a level crossed fills the bar to the top and starts it again while "LVL N" rides up off your banana,
// and a new title is the world's big moment once any card is shut (§27). One layer for the town, the rave, the park, the
// bay and the homestead (design library §53); the rave keeps its sound by hearing 'world:levelup'.
import W from '../data/copy/world-level.json';
import { fillWords } from './fill-words.js';
import { levelFor, rankFor, nextRank } from './pass-defs.js';
import { bigMoment } from './world-moment.js';
import SPARK from '../icons/pixelart/sparkles.svg?raw';

// each area: the frame the sparks fly in (they never leave the game), your banana, how long trickling grants merge before
// they fly (the rave pays one or two a second — a spark per grant would be wallpaper), and where its big moment goes
const AREAS = {
  town: { host: '#twView', me: '.tw-me', merge: 450 },
  park: { host: '#pkView', me: '#pkMe', merge: 450 },
  beach: { host: '#bhView', me: '#bhMe', merge: 450 },
  homestead: { host: '.hs-view', me: '#hsMe', merge: 450 },
  rave: { host: '.rv-club', me: '.rv-raver--me', merge: 1500, moment: '#rvFloor' },
};
// a card or a scene up: a title's big moment waits for it (the list the social layer's present waits on)
const BUSY = '.bwq-dlg, .bwq-intro, .tw-panel:not([hidden]), .tw-tray:not([hidden]), .tw-cup, .pk-panel:not([hidden]), .pk-shop:not([hidden]), .bh-panel:not([hidden]), .hs-veil:not([hidden])';
const TOP = 99;   // the last level (pass-defs levelFor)
const ARROW = '<svg width="21" height="24" viewBox="0 0 7 8" shape-rendering="crispEdges" aria-hidden="true"><rect x="3" y="0" width="1" height="1" fill="#ffe135"/><rect x="2" y="1" width="3" height="1" fill="#ffe135"/><rect x="1" y="2" width="5" height="1" fill="#ffe135"/><rect x="0" y="3" width="7" height="1" fill="#ffe135"/><rect x="2" y="4" width="3" height="4" fill="#ffe135"/></svg>';
const SPARK_SVG = String(SPARK).replace('<svg ', '<svg width="24" height="24" shape-rendering="crispEdges" aria-hidden="true" ');
const CSS = `
.wx-spark{position:absolute;left:0;top:0;width:24px;height:24px;margin:-12px 0 0 -12px;z-index:2170;pointer-events:none;color:#ffe135;filter:drop-shadow(1px 1px 0 #000) drop-shadow(-1px -1px 0 #000)}
.wx-spark svg{display:block}
.wx-plus,.wx-riser{position:absolute;left:0;top:0;pointer-events:none;white-space:nowrap;font-weight:800;letter-spacing:.04em;color:#ffe135;text-shadow:1px 1px 0 #000,-1px 1px 0 #000,1px -1px 0 #000,-1px -1px 0 #000,0 2px 0 #000}
.wx-plus{z-index:2172;font-size:.86rem}
.wx-riser{z-index:2171;font-size:1.05rem}
.wx-riser>span{display:flex;align-items:center;gap:6px;transform:translate(-50%,-100%)}
.wx-riser svg{image-rendering:pixelated;filter:drop-shadow(0 0 6px rgba(255,225,53,.9))}
`;

const areaKey = (() => { try { return location.pathname.split('/')[1] || ''; } catch (e) { return ''; } })();
const A = AREAS[areaKey] || null;
const $ = (s) => (s ? document.querySelector(s) : null);
const still = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
const busy = () => [...document.querySelectorAll(BUSY)].some((n) => n.getClientRects().length);

if (typeof document !== 'undefined') {
  const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s);
  // the big moment's own look, wherever the page did not link it yet (only the town does), and its face warmed now so a
  // title never shows a frame of fallback type
  if (!document.querySelector('link[href="/css/world-moment.css"]')) {
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = '/css/world-moment.css'; document.head.appendChild(l);
  }
  try { if (document.fonts && document.fonts.load) document.fonts.load('1rem Anton').catch(() => {}); } catch (e) {}
}

let api = null;            // the HUD's hands: { lvl, show(rep, crossed), release(), lift(on) }
let shown = null;          // what the chip says while sparks are out
let planned = null;        // the total the sparks already in the air will bring it to
let target = 0;            // the newest true total
let timer = 0;             // a merge window still open
let opened = 0;            // when it opened
const queue = [];          // flights waiting their turn
let flying = false;

// 📥 a grant (from the HUD): merge it with any still trickling in, then fly
export function grant(d, hud) {
  api = hud;
  if (!d || !(d.now > d.was)) return;
  if (!A || !api || !api.lvl) { finish(d.now); return; }
  if (shown == null) { shown = d.was; planned = d.was; }
  target = Math.max(target, d.now);
  // grants close together merge into one flight, but a steady trickle never holds it past twice the window: the rave's
  // spotlight pays every beat, and restarting the window on each one kept the XP from ever flying while you stood in it
  const t = Date.now();
  if (!timer) opened = t;
  clearTimeout(timer);
  timer = setTimeout(launch, Math.max(0, Math.min(A.merge, opened + 2 * A.merge - t)));
}

function launch() {
  timer = 0;
  if (target <= planned) return;
  queue.push({ from: planned, to: target });
  planned = target;
  if (!flying) next();
}

function next() {
  const b = queue.shift();
  if (!b) {
    flying = false;
    if (!timer && planned >= target) { shown = null; planned = null; target = 0; if (api) { api.lift(false); api.release(); } }
    return;
  }
  flying = true;
  fly(b);
}

// a whole batch landed at once: no frame to fly in, or motion is turned down
function finish(to) {
  const from = shown == null ? to : shown;
  step(from, to);
  shown = null; planned = null; target = 0;
  if (api) api.release();
}

function fly(b) {
  const host = $(A.host), me = $(A.me), chip = api && api.lvl;
  const hr = host && host.getBoundingClientRect(), mr = me && me.getBoundingClientRect(), cr = chip && chip.getBoundingClientRect();
  const onScreen = (r) => r && r.width && r.height && r.bottom > hr.top && r.top < hr.bottom && r.right > hr.left && r.left < hr.right;
  const at = (x, y) => ({ x: x - hr.left - host.clientLeft, y: y - hr.top - host.clientTop });
  const from = hr && onScreen(mr) ? at(mr.left + mr.width / 2, mr.top + mr.height * 0.2) : null;
  // into the bar, where it is filling (the coins drop into the purse; XP lands on the edge it pushes)
  const fill = chip && chip.querySelector('.wh__lvlbar i, [data-wh="lvlfill"]');
  const fr = fill && fill.getBoundingClientRect();
  const to = hr && onScreen(cr) ? (fr && fr.height ? at(Math.max(fr.left + 3, fr.right), fr.top + fr.height / 2) : at(cr.left + 14, cr.top + cr.height / 2)) : null;
  const amount = b.to - b.from;
  const dir = from && to && to.x < from.x ? -1 : 1;   // the side the chip is on: the sparks leave that way, "+N XP" the other
  if (from) plus(host, from, amount, -dir, still());
  if (!from || !to || still()) {   // nothing to fly between, or motion turned down: the chip says it at once
    step(shown, b.to); shown = b.to; next(); return;
  }
  api.lift(true);   // the strip rises out of any card's shade to catch them (§30.2)
  const n = Math.max(1, Math.min(8, 1 + Math.floor(Math.log2(Math.max(1, amount)))));
  let landed = 0;
  for (let i = 0; i < n; i++) {
    const s = document.createElement('i');
    s.className = 'wx-spark';
    s.innerHTML = SPARK_SVG;
    s.style.left = from.x + 'px'; s.style.top = from.y + 'px';
    host.appendChild(s);
    const sx = dir * (Math.random() * 60 - 12), sy = -30 - Math.random() * 55;   // up off the banana, then the swoop in
    const a = s.animate([
      { transform: 'translate(0, 0) scale(0.4)', opacity: 0 },
      { transform: 'translate(' + sx + 'px, ' + sy + 'px) scale(1.15)', opacity: 1, offset: 0.3, easing: 'cubic-bezier(.45,0,.85,.3)' },
      { transform: 'translate(' + (to.x - from.x) + 'px, ' + (to.y - from.y) + 'px) scale(0.55)', opacity: 1 },
    ], { duration: 640 + i * 24, delay: i * 50, easing: 'linear', fill: 'backwards' });
    const land = () => {
      s.remove();
      landed += 1;
      const v = landed === n ? b.to : b.from + Math.round((amount * landed) / n);
      step(shown, v);
      shown = v;
      if (landed === n) next();
    };
    a.onfinish = land;
    a.oncancel = land;
  }
}

// the chip moves from `a` to `b`: a tick, or a level crossed
function step(a, b) {
  if (!api) return;
  const la = levelFor(a).level, lb = levelFor(b).level;
  if (lb > la) {
    api.show(b, true);
    levelUp(la, lb);
  } else {
    api.show(b, false);
    if (api.lvl && api.lvl.animate && !still()) api.lvl.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(1)' }], { duration: 300, easing: 'cubic-bezier(.3,1.6,.5,1)' });
  }
}

function levelUp(from, to) {
  const chip = api && api.lvl;
  if (chip && chip.animate && !still()) chip.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.38)' }, { transform: 'scale(0.94)' }, { transform: 'scale(1)' }], { duration: 760, easing: 'ease-out' });
  // a title IS the bigger riser: never both (the riser crossed its line); the last level is a big moment too
  const titled = to >= TOP || rankFor(to).id !== rankFor(from).id;
  if (titled) titleMoment(to); else riser(to);
  try { document.dispatchEvent(new CustomEvent('world:levelup', { detail: { level: to, title: rankFor(to).title } })); } catch (e) {}
}

// "+N XP" beside your head as the sparks leave it: on the side away from the chip and drawn over them, so the sparks
// never cover what you got; it rises a little and holds long enough to read (still, under reduced motion)
function plus(host, p, n, side, calm) {
  const d = document.createElement('div');
  d.className = 'wx-plus';
  d.textContent = fillWords(W.plus, { n });
  d.style.left = (p.x + side * 12) + 'px'; d.style.top = p.y + 'px';
  host.appendChild(d);
  const at = (y) => 'translate(' + (side < 0 ? '-100%' : '0') + ', calc(-100% - ' + y + 'px))';
  if (!d.animate) { d.style.transform = at(6); setTimeout(() => d.remove(), 1400); return; }
  const a = d.animate(calm ? [
    { transform: at(6), opacity: 0 },
    { transform: at(6), opacity: 1, offset: 0.12 },
    { transform: at(6), opacity: 1, offset: 0.75 },
    { transform: at(6), opacity: 0 },
  ] : [
    { transform: at(0), opacity: 0 },
    { transform: at(8), opacity: 1, offset: 0.12 },
    { transform: at(22), opacity: 1, offset: 0.72 },
    { transform: at(34), opacity: 0 },
  ], { duration: 1400, easing: 'ease-out', fill: 'forwards' });
  a.onfinish = a.oncancel = () => d.remove();
}

// the arrow and "LVL N" ride up off your banana (lifted from the rave, where it has been since August), and stay with
// it if you walk on
function riser(level) {
  const host = $(A && A.host);
  const where = () => {
    const me = $(A.me), hr = host.getBoundingClientRect(), mr = me && me.getBoundingClientRect();
    return mr && mr.width ? { x: mr.left - hr.left - host.clientLeft + mr.width / 2, y: mr.top - hr.top - host.clientTop } : null;
  };
  const p0 = host && where();
  if (!p0) return;
  const d = document.createElement('div');
  d.className = 'wx-riser';
  d.innerHTML = '<span>' + ARROW + '<b></b></span>';
  d.querySelector('b').textContent = fillWords(W.riser, { n: level });
  const put = (p) => { d.style.transform = 'translate(' + p.x + 'px, ' + p.y + 'px)'; };
  put(p0);
  host.appendChild(d);
  const inner = d.firstChild;
  if (still() || !inner.animate) { setTimeout(() => d.remove(), 1600); return; }   // a still riser, never nothing (§3d)
  const a = inner.animate([
    { transform: 'translate(-50%, -60%) scale(0.5)', opacity: 0 },
    { transform: 'translate(-50%, -110%) scale(1.3)', opacity: 1, offset: 0.12 },
    { transform: 'translate(-50%, -125%) scale(1)', opacity: 1, offset: 0.26 },
    { transform: 'translate(-50%, -125%) scale(1)', opacity: 1, offset: 0.8 },
    { transform: 'translate(-50%, -260%) scale(1)', opacity: 0 },
  ], { duration: 1850, easing: 'ease-out', fill: 'forwards' });
  let live = true;
  const follow = () => { if (!live) return; const p = where(); if (p) put(p); requestAnimationFrame(follow); };
  requestAnimationFrame(follow);
  a.onfinish = a.oncancel = () => { live = false; d.remove(); };
}

// 🎖 a new title: the world's big moment — once no card or scene is up (§27), and only the newest if several wait
let titleWaiting = 0;
function titleMoment(level) {
  titleWaiting = level;
  const show = (tries) => {
    if (titleWaiting !== level) return;
    if (busy() && tries < 60) { setTimeout(() => show(tries + 1), 500); return; }
    titleWaiting = 0;
    const host = $(A && (A.moment || A.host));
    // under it, two lines that each fit a phone: the title you hold, then what comes next ("Legend of the Floor · next
    // title at level 90" on one line wrapped mid-phrase at 360 px)
    const rk = rankFor(level), nx = nextRank(level);
    bigMoment(host, fillWords(W.title, { n: level }),
      rk.title + '\n' + (level >= TOP ? W.max : nx ? fillWords(W.next, { at: nx.at }) : W.top));
  };
  setTimeout(() => show(0), 420);   // the chip pops first, then the world says it
}
