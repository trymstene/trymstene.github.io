// 💥 THE LEVEL-UP BURST (2 Oct 2026, design library §53). Trym: "when leveling up, reuse the glow-animation from when getting
// XP, just maximize it visually, like a glow animation around the banana silhouette that starts from the silhouette and expands
// outwards around the banana, but very fast, like a glowing explosion, it can also overlay the banana in the millisecond it
// explodes, and then fades out outwards - like getting hit by a lightning (without the lightning) and just pulsates outwards
// before it dies out, everything in a very quick animation". Then: "if other users can see other users leveling up thats
// also fun".
//
// So it is the XP glow's own light — the banana's silhouette in whitish gold, the orbs — in one explosive beat, under a
// second: the banana goes white for an instant, the glow bursts out of its silhouette and rushes outward, two more rings of it
// pulse out after, and a spray of orbs flies off. Yours plays as the level lands on the chip (world-xp.js); another player's
// when their room says so (world.js presenceRoom `lvlup`, the rave's `lvl`), with "LVL N" riding up off their banana.
// ⚠️ The glows are STATIC filters under transform and opacity (§21.4: never animate a filter or a shadow).
import W from '../data/copy/world-level.json';
import { fillWords } from './fill-words.js';

export const ARROW = '<svg width="21" height="24" viewBox="0 0 7 8" shape-rendering="crispEdges" aria-hidden="true"><rect x="3" y="0" width="1" height="1" fill="#ffe135"/><rect x="2" y="1" width="3" height="1" fill="#ffe135"/><rect x="1" y="2" width="5" height="1" fill="#ffe135"/><rect x="0" y="3" width="7" height="1" fill="#ffe135"/><rect x="2" y="4" width="3" height="4" fill="#ffe135"/></svg>';
const CSS = `
.wx-me{isolation:isolate}
.wb-shape{position:absolute;pointer-events:none;image-rendering:pixelated;opacity:0}
.wb-back{z-index:-1;filter:drop-shadow(0 0 2px #fff) drop-shadow(0 0 6px #fff6d8) drop-shadow(0 0 14px rgba(255,212,110,.95))!important}
.wb-front{z-index:1;filter:drop-shadow(0 0 3px #fffef6)!important}
.wb-orb{position:absolute;width:8px;height:8px;margin:-4px 0 0 -4px;border-radius:50%;z-index:2;pointer-events:none;background:radial-gradient(circle,#fffffa 0 35%,#fff3c8 62%,#ffe08a 100%);box-shadow:0 0 4px 2px rgba(255,240,190,.9)}
.wb-riser{position:absolute;left:50%;top:0;z-index:3;pointer-events:none;white-space:nowrap;font-weight:800;letter-spacing:.04em;font-size:.9rem;color:#ffe135;text-shadow:1px 1px 0 #000,-1px 1px 0 #000,1px -1px 0 #000,-1px -1px 0 #000,0 2px 0 #000}
.wb-riser>span{display:flex;align-items:center;gap:5px}
.wb-riser svg{width:16px;height:18px;image-rendering:pixelated;filter:drop-shadow(0 0 5px rgba(255,225,53,.9))}
`;
let styled = false;
function style() {
  if (styled || typeof document === 'undefined') return;
  styled = true;
  const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s);
}
const still = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };

// the banana's own canvas as a shape of light: `fat` canvas pixels fatter all round; a `ring` keeps only the band outside
// the banana, so it rushes outward as a wave instead of a blob
function shape(cv, fat, ring, color) {
  const c = document.createElement('canvas');
  c.width = cv.width; c.height = cv.height;
  const x = c.getContext('2d');
  for (let dx = -fat; dx <= fat; dx++) for (let dy = -fat; dy <= fat; dy++) if (dx * dx + dy * dy <= fat * fat + 1) x.drawImage(cv, dx, dy);
  if (ring) { x.globalCompositeOperation = 'destination-out'; x.drawImage(cv, 0, 0); }
  x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
  return c;
}
// where the banana's body is inside its canvas, so the light rushes out from IT and not from the frame's corner
function middle(cv) {
  try {
    const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    let x0 = cv.width, y0 = cv.height, x1 = -1, y1 = -1;
    for (let y = 0; y < cv.height; y += 2) for (let x = 0; x < cv.width; x += 2) {
      if (d[(y * cv.width + x) * 4 + 3] < 40) continue;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    if (x1 >= 0) return [(x0 + x1) / 2 / cv.width, (y0 + y1) / 2 / cv.height];
  } catch (e) {}   // a canvas wearing art from another origin cannot be read: the frame's own middle will do
  return [0.5, 0.58];
}

// 💥 the burst on a banana element (one that holds the banana's canvas): your own or another player's
export function burst(el) {
  const cv = el && el.querySelector('canvas:not(.wx-halo):not(.wb-shape)');
  if (!cv || !cv.width || !cv.offsetWidth || !el.getClientRects().length) return;
  style();
  el.classList.add('wx-me');   // a stacking context of its own: the light behind the banana stays in front of the world
  const cs = getComputedStyle(cv), curse = cs.scale && cs.scale !== 'none';
  const [mx, my] = middle(cv);
  const origin = curse ? cs.transformOrigin : (mx * 100).toFixed(1) + '% ' + (my * 100).toFixed(1) + '%';
  const made = [];
  const put = (c, cls) => {
    c.className = 'wb-shape ' + cls;
    c.setAttribute('aria-hidden', 'true');
    Object.assign(c.style, { left: cv.offsetLeft + 'px', top: cv.offsetTop + 'px', width: cv.offsetWidth + 'px', height: cv.offsetHeight + 'px', scale: cs.scale, transformOrigin: origin });
    el.appendChild(c);
    made.push(c);
    return c;
  };
  const gone = () => { for (const n of made) n.remove(); made.length = 0; };
  const core = put(shape(cv, 5, false, '#fff8e2'), 'wb-back');
  if (still() || !core.animate) {   // §3d: lit, and then gone — no flash, nothing flies
    core.style.opacity = '1';
    setTimeout(gone, 900);
    return;
  }
  const play = (n, frames, opt) => { const a = n.animate(frames, { fill: 'both', ...opt }); return new Promise((ok) => { a.onfinish = a.oncancel = ok; }); };
  const OUT = 'cubic-bezier(.12,.8,.3,1)';   // off like a shot, then easing into nothing
  const flash = put(shape(cv, 1, false, '#ffffff'), 'wb-front');
  const ring1 = put(shape(cv, 7, true, '#fffcf0'), 'wb-back'), ring2 = put(shape(cv, 6, true, '#fffdf4'), 'wb-back');
  const runs = [
    // the instant it explodes: white over the whole banana, and gone
    play(flash, [{ opacity: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 1, offset: 0.34 }, { opacity: 0 }], { duration: 280, easing: 'ease-out' }),
    // the glow bursts out of the silhouette…
    play(core, [{ opacity: 1, transform: 'scale(1)' }, { opacity: 1, transform: 'scale(1.45)', offset: 0.3 }, { opacity: 0, transform: 'scale(2.05)' }], { duration: 500, easing: OUT }),
    // …and pulses outward twice more before it dies out
    play(ring1, [{ opacity: 0, transform: 'scale(1)' }, { opacity: 1, transform: 'scale(1.2)', offset: 0.1 }, { opacity: 0.85, transform: 'scale(1.75)', offset: 0.45 }, { opacity: 0, transform: 'scale(2.25)' }], { duration: 580, delay: 70, easing: OUT }),
    play(ring2, [{ opacity: 0, transform: 'scale(1)' }, { opacity: 1, transform: 'scale(1.25)', offset: 0.1 }, { opacity: 0.7, transform: 'scale(2.1)', offset: 0.45 }, { opacity: 0, transform: 'scale(2.8)' }], { duration: 620, delay: 200, easing: OUT }),
  ];
  // a spray of the XP's own orbs flies off it
  const ox = cv.offsetLeft + mx * cv.offsetWidth, oy = cv.offsetTop + my * cv.offsetHeight, reach = cv.offsetWidth * 0.75;
  for (let i = 0; i < 10; i++) {
    const o = document.createElement('i');
    o.className = 'wb-orb';
    o.style.left = ox + 'px'; o.style.top = oy + 'px';
    el.appendChild(o);
    made.push(o);
    const t = (i / 10) * Math.PI * 2 + Math.random() * 0.5, r = reach * (0.75 + Math.random() * 0.6);
    const dx = Math.cos(t) * r, dy = Math.sin(t) * r * 0.8 - 8;
    runs.push(play(o, [
      { transform: 'translate(0, 0) scale(0.5)', opacity: 1 },
      { transform: 'translate(' + (dx * 0.7).toFixed(1) + 'px, ' + (dy * 0.7).toFixed(1) + 'px) scale(1.15)', opacity: 1, offset: 0.4 },
      { transform: 'translate(' + dx.toFixed(1) + 'px, ' + dy.toFixed(1) + 'px) scale(0.3)', opacity: 0 },
    ], { duration: 480 + Math.random() * 140, easing: OUT }));
  }
  Promise.all(runs).then(gone);
  setTimeout(gone, 1600);   // a tab put away mid-burst never leaves its light behind
}

// "LVL N" rides up off another player's banana, with it as it walks (yours has the HUD's own, world-xp.js)
export function riser(el, level) {
  if (!el || !el.getClientRects().length || !(level > 1)) return;
  style();
  el.classList.add('wx-me');
  const d = document.createElement('div');
  d.className = 'wb-riser';
  d.innerHTML = '<span>' + ARROW + '<b></b></span>';
  d.querySelector('b').textContent = fillWords(W.riser, { n: level });
  el.appendChild(d);
  const inner = d.firstChild;
  if (still() || !inner.animate) { inner.style.transform = 'translate(-50%, -125%)'; setTimeout(() => d.remove(), 1600); return; }
  const a = inner.animate([
    { transform: 'translate(-50%, -60%) scale(0.5)', opacity: 0 },
    { transform: 'translate(-50%, -110%) scale(1.25)', opacity: 1, offset: 0.12 },
    { transform: 'translate(-50%, -125%) scale(1)', opacity: 1, offset: 0.26 },
    { transform: 'translate(-50%, -125%) scale(1)', opacity: 1, offset: 0.8 },
    { transform: 'translate(-50%, -240%) scale(1)', opacity: 0 },
  ], { duration: 1850, easing: 'ease-out', fill: 'forwards' });
  a.onfinish = a.oncancel = () => d.remove();
}

// 💥 another player levelled up in this room: the burst and "LVL N" on their banana, wherever the area draws them
// (every presence area tags a player's element with data-pid — world-social.js reads the same)
export function peerBurst(id, level) {
  const el = id ? document.querySelector('[data-pid="' + String(id).replace(/[^a-z0-9-]/gi, '') + '"]') : null;
  if (!el) return false;
  burst(el);
  riser(el, level);
  return true;
}
