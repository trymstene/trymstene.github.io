// ✨ XP YOU CAN FEEL, IN EVERY AREA (2 Oct 2026, design library §53). Trym, first: "i dont feel XP in banana world FEELS
// great, in the way getting banana coins does"; then, of the sparks that flew from the banana into the HUD: "the sparkle
// graphics looks a bit static flying over the screen … its better with a soft pulsating golden glow around the banana when
// experience points are received, and that the XP-bar also glows up at the same time, maybe with a small shake animation
// … and an animation showing the xp bar growing". Every grant in every area passes passStat → 'pass:rep'; the HUD
// (world-hud.js) holds its LVL chip where it stood and hands the grant here. Then, in one beat: a golden glow pulses round
// your banana as "+N XP" rises beside it, and the chip lights, swells, gives a little shake while its bar grows with the
// part just earned lit. A level crossed fills the bar to the top and starts it again while "LVL N" rides up off your banana;
// a new title is the world's big moment once any card is shut (§27). One layer for the town, the rave, the park, the bay
// and the homestead; the rave keeps its sound by hearing 'world:levelup'.
import W from '../data/copy/world-level.json';
import { fillWords } from './fill-words.js';
import { levelFor, rankFor, nextRank } from './pass-defs.js';
import { bigMoment } from './world-moment.js';
import { burst, ARROW } from './world-burst.js';   // 💥 the level-up's own explosion, the same one other players see

// each area: the frame its words go in, your banana, how long trickling grants merge into one beat (the rave pays one or
// two a second — a glow per grant would never rest), and where its big moment goes
const AREAS = {
  town: { host: '#twView', me: '.tw-me', merge: 450 },
  park: { host: '#pkView', me: '#pkMe', merge: 450 },
  beach: { host: '#bhView', me: '#bhMe', merge: 450 },
  homestead: { host: '.hs-view', me: '#hsMe', merge: 450 },
  rave: { host: '.rv-club', me: '.rv-raver--me', merge: 1500, moment: '#rvFloor' },
};
// a card or a scene up: a title's big moment waits for it (the list the social layer's present waits on)
const BUSY = '.bwq-dlg, .bwq-intro, .tw-panel:not([hidden]), .tw-tray:not([hidden]), .tw-cup, .pk-panel:not([hidden]), .pk-shop:not([hidden]), .bh-panel:not([hidden]), .hs-veil:not([hidden])';
const TOP = 99;      // the last level (pass-defs levelFor)
const BEAT = 900;    // one grant's beat before the next may start
// the glows are static shadows under an opacity pulse (§21.4: never animate a filter or a shadow); the halo keeps its own
// filter over an area’s “the banana’s canvas” rules (the rave tints a canvas for its effects), which it otherwise shares
const CSS = `
.wx-me{isolation:isolate}
.wx-halo{position:absolute;z-index:-1;pointer-events:none;opacity:0;image-rendering:pixelated;filter:drop-shadow(0 0 1px #fffef6) drop-shadow(0 0 2px #fff4cc) drop-shadow(0 0 5px rgba(255,224,145,.9))!important}
.wx-orb{position:absolute;left:0;top:0;width:9px;height:9px;margin:-4.5px 0 0 -4.5px;border-radius:50%;z-index:2170;pointer-events:none;background:radial-gradient(circle,#fffffa 0 35%,#fff3c8 62%,#ffe08a 100%);box-shadow:0 0 4px 2px rgba(255,240,190,.95),0 0 10px 4px rgba(255,214,120,.6)}
.wx-glow{position:absolute;inset:-3px;border-radius:inherit;pointer-events:none;opacity:0;background:rgba(255,244,205,.13);box-shadow:inset 0 0 7px rgba(255,246,215,.55),0 0 0 2px rgba(255,250,228,.95),0 0 10px 3px rgba(255,234,170,.85)}
.wx-gain{position:absolute;left:0;top:0;bottom:0;pointer-events:none;opacity:0;background:linear-gradient(90deg,rgba(255,252,236,.55),#fffdf2);box-shadow:0 0 5px 1px rgba(255,240,190,.95)}
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
let shown = null;          // what the chip says while beats are queued
let planned = null;        // the total the queued beats will bring it to
let target = 0;            // the newest true total
let timer = 0;             // a merge window still open
let opened = 0;            // when it opened
let lastBeat = -1e9;       // when the last beat began
const queue = [];          // beats waiting their turn
let playing = false;

// 📥 a grant (from the HUD): merge it with any still trickling in, then play its beat
export function grant(d, hud) {
  api = hud;
  if (!d || !(d.now > d.was)) return;
  if (!A || !api || !api.lvl) { finish(d.now); return; }
  if (shown == null) { shown = d.was; planned = d.was; }
  target = Math.max(target, d.now);
  const t = Date.now();
  // ⚡ the first grant in a while plays AT ONCE (Trym, 2 Oct 2026: "it takes some time from picking up garbage to the glow
  // animation and the orbs shows up, can it be much faster"): the merge used to hold every grant for its window first. Only
  // grants that follow inside the window merge — into the next beat — so a trickle is still never wallpaper
  if (!playing && !timer && t - lastBeat >= A.merge) { launch(); return; }
  // grants close together merge into one beat, but a steady trickle never holds it past twice the window: the rave's
  // spotlight pays every beat of the music, and restarting the window on each one kept the XP from ever landing
  if (!timer) opened = t;
  clearTimeout(timer);
  timer = setTimeout(launch, Math.max(0, Math.min(A.merge, opened + 2 * A.merge - t)));
}

function launch() {
  timer = 0;
  lastBeat = Date.now();
  if (target <= planned) return;
  queue.push({ from: planned, to: target });
  planned = target;
  if (!playing) next();
}

function next() {
  const b = queue.shift();
  if (!b) {
    playing = false;
    if (!timer && planned >= target) { shown = null; planned = null; target = 0; if (api) { api.lift(false); api.release(); } }
    return;
  }
  playing = true;
  land(b);
}

// a whole batch with no area to play it in: the chip says it
function finish(to) {
  const from = shown == null ? to : shown;
  step(from, to);
  shown = null; planned = null; target = 0;
  if (api) api.release();
}

// 🌟 one beat: the banana glows and "+N XP" rises beside it, small glowing orbs of the same light fly from it into the XP
// pill and its bar counts up as each one lands, and the last one in lights the pill up, swells it and shakes it (Trym:
// "small strong-glowing balls of the same style fly into the xp stickerpill when counting up the new XP")
const RING = []; for (let dx = -3; dx <= 3; dx++) for (let dy = -3; dy <= 3; dy++) if ((dx || dy) && dx * dx + dy * dy <= 10) RING.push([dx, dy]);   // the halo’s copy, dilated ~3 canvas px
function land(b) {
  const host = $(A.host), me = $(A.me), chip = api && api.lvl;
  const hr = host && host.getBoundingClientRect(), mr = me && me.getBoundingClientRect(), cr = chip && chip.getBoundingClientRect();
  const on = (r) => !!(hr && r && r.width && r.height && r.bottom > hr.top && r.top < hr.bottom && r.right > hr.left && r.left < hr.right);
  const at = (x, y) => ({ x: x - hr.left - host.clientLeft, y: y - hr.top - host.clientTop });
  const amount = b.to - b.from;
  if (on(mr)) {
    glowMe(me, amount);
    plus(host, at(mr.left + mr.width / 2, mr.top + mr.height * 0.2), amount);
  }
  api.lift(true);   // the strip rises out of any card's shade so the orbs land where they are seen (§30.2)
  if (!on(mr) || !on(cr) || still()) {   // nothing to fly between, or motion turned down: the pill says it in the beat
    lightChip(chip, b.from, b.to);
    step(shown, b.to, false, b.from);
    shown = b.to;
    setTimeout(next, still() ? 250 : BEAT);
    return;
  }
  const from = at(mr.left + mr.width / 2, mr.top + mr.height * 0.5);
  const fill = chip.querySelector('.wh__lvlbar i, [data-wh="lvlfill"]'), fr = fill && fill.getBoundingClientRect();
  const to = fr && fr.height ? at(Math.max(fr.left + 3, fr.right), fr.top + fr.height / 2) : at(cr.left + 14, cr.top + cr.height / 2);
  const dir = to.x < from.x ? -1 : 1;   // the side the pill is on: the orbs leave that way, "+N XP" the other
  const n = Math.max(1, Math.min(8, 1 + Math.floor(Math.log2(Math.max(1, amount)))));   // one to eight, by the size of the grant
  let landed = 0;
  for (let i = 0; i < n; i++) {
    const o = document.createElement('i');
    o.className = 'wx-orb';
    o.style.left = from.x + 'px'; o.style.top = from.y + 'px';
    host.appendChild(o);
    const sx = dir * (Math.random() * 52 - 12), sy = -26 - Math.random() * 48;   // up off the banana, then the swoop in
    const a = o.animate([
      { transform: 'translate(0, 0) scale(0.3)', opacity: 0 },
      { transform: 'translate(' + sx + 'px, ' + sy + 'px) scale(1.15)', opacity: 1, offset: 0.3, easing: 'cubic-bezier(.45,0,.85,.3)' },
      { transform: 'translate(' + (to.x - from.x) + 'px, ' + (to.y - from.y) + 'px) scale(0.55)', opacity: 1 },
    ], { duration: 520 + i * 20, delay: i * 55, easing: 'linear', fill: 'backwards' });
    const done = () => {
      o.remove();
      landed += 1;
      if (landed < n) {   // the bar counts up as each one lands (and the number with it, through every level crossed)
        const v = b.from + Math.round((amount * landed) / n);
        step(shown, v, true);
        shown = v;
        flashRing(chip);
        return;
      }
      lightChip(chip, b.from, b.to);   // the last one in: the pill lights up, swells and shakes
      step(shown, b.to, false, b.from);
      shown = b.to;
      setTimeout(next, 420);
    };
    a.onfinish = done;
    a.oncancel = done;
  }
}

// the glow HUGS your banana and everything it wears (Trym: "close glow tight to the shape of the banana and its wearables,
// not glow with alot of spread, and whiter golden, not yellow"): a pale copy of its own canvas, just behind it, wearing a
// tight whitish-gold shadow that is static (§21.4: never animate a filter) under an opacity pulse — two soft pulses, and a
// steady trickle keeps it glowing rather than stacking glows. Under reduced motion it is lit and then gone (§3d).
let halo = null, haloAnim = null, haloOff = 0, haloUntil = 0, haloLoop = false;
function glowMe(me, amount) {
  const cv = me.querySelector('canvas:not(.wx-halo)');
  if (!cv) return;
  if (!halo || halo.parentNode !== me) {
    if (halo) halo.remove();
    halo = document.createElement('canvas');
    halo.className = 'wx-halo';
    halo.setAttribute('aria-hidden', 'true');
    me.classList.add('wx-me');   // a stacking context of its own: the glow sits behind the banana, not behind the world
    me.insertBefore(halo, me.firstChild);
  }
  // exactly on the banana's own canvas (a curse that scales or mirrors it, the copy too)
  const cs = getComputedStyle(cv);
  Object.assign(halo.style, { left: cv.offsetLeft + 'px', top: cv.offsetTop + 'px', width: cv.offsetWidth + 'px', height: cv.offsetHeight + 'px', scale: cs.scale, transformOrigin: cs.transformOrigin });
  const draw = () => {
    if (!halo) return;
    if (halo.width !== cv.width || halo.height !== cv.height) { halo.width = cv.width; halo.height = cv.height; }
    const x = halo.getContext('2d');
    x.globalCompositeOperation = 'copy'; x.drawImage(cv, 0, 0);   // its silhouette, this frame…
    x.globalCompositeOperation = 'source-over';
    for (const [dx, dy] of RING) x.drawImage(cv, dx, dy);   // …three canvas pixels fatter all round, so the rim reads strong (Trym: "fatten it some more")
    x.globalCompositeOperation = 'source-in'; x.fillStyle = '#fff6dc'; x.fillRect(0, 0, halo.width, halo.height);
    x.globalCompositeOperation = 'source-over';
  };
  draw();
  haloUntil = performance.now() + (still() ? 1300 : 1800);   // it dances with the banana while it glows
  if (!haloLoop) {
    haloLoop = true;
    const tick = () => { if (!halo || performance.now() > haloUntil) { haloLoop = false; return; } try { draw(); } catch (e) {} requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }
  const peak = 1;   // strong at its height, every time (Trym: "fatten it some more so it looks stronger")
  if (haloAnim) haloAnim.cancel();
  clearTimeout(haloOff);
  if (still() || !halo.animate) {
    halo.style.opacity = String(peak);
    haloOff = setTimeout(() => { if (halo) halo.style.opacity = '0'; }, 1300);
    return;
  }
  halo.style.opacity = '0';
  haloAnim = halo.animate([{ opacity: 0 }, { opacity: peak, offset: 0.08 }, { opacity: peak * 0.4, offset: 0.4 }, { opacity: peak, offset: 0.62 }, { opacity: 0 }], { duration: 1600, easing: 'ease-out' });
}

// the chip in the same beat: it lights up from inside with a glow round it, the bar's fill flashes up to its new length as
// the bar grows into it, and it swells with a small shake. A level crossed has its own bigger pop (levelUp) and its own fill-to-the-top, so it only gets the glow.
function ring(chip) {
  let g = chip.querySelector(':scope > .wx-glow');
  if (!g) {
    if (getComputedStyle(chip).position === 'static') chip.style.position = 'relative';
    g = document.createElement('i');
    g.className = 'wx-glow';
    chip.appendChild(g);
  }
  return g;
}
// an orb lands: the pill's ring flashes, once
function flashRing(chip) {
  if (!chip || still()) return;
  const g = ring(chip);
  if (g.animate) g.animate([{ opacity: 0.25 }, { opacity: 0.9, offset: 0.3 }, { opacity: 0 }], { duration: 300, easing: 'ease-out' });
}
function lightChip(chip, a, b) {
  if (!chip) return;
  const la = levelFor(a), lb = levelFor(b), crossed = lb.level > la.level;
  const g = ring(chip);
  if (still() || !g.animate) { g.style.opacity = '1'; setTimeout(() => { g.style.opacity = '0'; }, 1100); }
  else g.animate([{ opacity: 0 }, { opacity: 1, offset: 0.15 }, { opacity: 0.45, offset: 0.45 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }], { duration: 1500, easing: 'ease-in-out' });
  const bar = chip.querySelector('.wh__lvlbar, .rv-mixer__lvlbar');
  if (bar && !crossed) {
    const f1 = Math.max(0, Math.min(1, lb.into / lb.need));
    if (getComputedStyle(bar).position === 'static') bar.style.position = 'relative';
    const s = document.createElement('i');
    s.className = 'wx-gain';
    s.style.width = 'max(3px, ' + (f1 * 100).toFixed(2) + '%)';   // the whole fill lights up to its new length: a small gain is a pixel
    bar.appendChild(s);
    if (still() || !s.animate) { s.style.opacity = '0.9'; setTimeout(() => s.remove(), 1100); }
    else { const an = s.animate([{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 1, offset: 0.55 }, { opacity: 0 }], { duration: 1300, easing: 'ease-out' }); an.onfinish = an.oncancel = () => s.remove(); }
  }
  if (!crossed && chip.animate && !still()) {
    const S = (x) => 'scale(1.13) translateX(' + x + 'px)';
    chip.animate([
      { transform: 'scale(1)' }, { transform: S(0), offset: 0.18 },
      { transform: S(-2), offset: 0.3 }, { transform: S(2), offset: 0.42 }, { transform: S(-1), offset: 0.54 }, { transform: S(0), offset: 0.66 },
      { transform: 'scale(1)' },
    ], { duration: 950, easing: 'ease-out' });
  }
}

// the chip moves from `a` to `b`: the bar grows (world-hud.js paints it), or a level is crossed. Only a beat's LAST step
// celebrates (the orbs before it are `quiet`), from the level the beat began on (`from`): a grant that crosses ten levels is
// ONE burst, one "LVL N" or title and one word to the room, never one per orb in the same second (Trym, 3 Oct 2026: "handle it
// gracefully if a LVL 1 banana joins and takes out a ghost and gets 10 levelups at once - so nothing breaks")
function step(a, b, quiet, from) {
  if (!api) return;
  const la = levelFor(a).level, lb = levelFor(b).level, l0 = from == null ? la : levelFor(from).level;
  api.show(b, lb > la);
  if (!quiet && lb > l0) levelUp(l0, lb);
}

function levelUp(from, to) {
  const chip = api && api.lvl;
  if (chip && chip.animate && !still()) chip.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.38)' }, { transform: 'scale(0.94)' }, { transform: 'scale(1)' }], { duration: 760, easing: 'ease-out' });
  // 💥 and your banana bursts with the same light (world-burst.js; Trym: "same style but more explosive celebration when
  // leveling up") — the room hears 'world:levelup' below and shows the others the same
  if (A) burst($(A.me));
  // a title IS the bigger riser: never both (the riser crossed its line); the last level is a big moment too
  const titled = to >= TOP || rankFor(to).id !== rankFor(from).id;
  if (titled) titleMoment(to); else riser(to);
  try { document.dispatchEvent(new CustomEvent('world:levelup', { detail: { level: to, title: rankFor(to).title } })); } catch (e) {}
}

// "+N XP" beside your head (the side, so "LVL N" can rise straight up when a level comes with it): it rises a little and
// holds long enough to read (still, under reduced motion)
function plus(host, p, n) {
  const d = document.createElement('div');
  d.className = 'wx-plus';
  d.textContent = fillWords(W.plus, { n: n.toLocaleString('en-US') });   // "+4,000 XP": the day's first ghost reads at a glance
  d.style.left = (p.x + 12) + 'px'; d.style.top = p.y + 'px';
  host.appendChild(d);
  const at = (y) => 'translate(0, calc(-100% - ' + y + 'px))';
  if (!d.animate) { d.style.transform = at(6); setTimeout(() => d.remove(), 1400); return; }
  const a = d.animate(still() ? [
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
