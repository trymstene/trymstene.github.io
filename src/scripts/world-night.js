// 🌗 THE WORLD'S NIGHT — the light layer an outdoor area hangs on its VIEW, beside the weather (design library §56).
//
// Trym, 2 Oct 2026: "maybe nights and weather is something that should be on the world layer - except for 'inside'
// areas" … "isnt this an opportunity to really make cozy lighting? that lamps and bonfires, streetlights, windows,
// decorations and all this actually makes the night light a bit up - this is core cozy".
//
// HOW DARK it is comes from skyAt() in src/lib/world.js, a pure function of the town's twelve-minute clock, so the dusk
// falls on the same second in every area. WHERE the lights are is the area's business: it hands over a list in view px
// every time it is asked. This module paints the two together — a LIGHT MAP multiplied over the view (the night's own
// colour where nothing shines, warm light added round every lamp, window and fire in stepped, dithered rings one art
// pixel to a cell) and a small bloom screened over each flame and pane.
// ⚠️ A dark sheet with holes cut in it was the first try (the 2 Oct mock): it read as grey fog round torch beams.
// ⚠️ A light is as strong as the sky is dark. At full strength in the dusk every pool was a bright green ring on the grass.
import { skyAt, townHourAt } from '../lib/world.js';

const WHITE = [255, 255, 255];
const NIGHT_AMB = [52, 60, 116];   // a white wall at night with nothing lit near it
const DUSK_MID = [232, 166, 150];  // the sun going down, gold into rose
const DAWN_MID = [198, 182, 216];  // and coming up again, a cooler lilac
// six rings, inside out: [outer radius as a share, light]
const RING = [[0.16, 1], [0.32, 0.82], [0.48, 0.62], [0.64, 0.44], [0.82, 0.26], [1, 0.1]];
const BAYER = [0, 0.5, 0.75, 0.25];
const mix = (a, b, t) => [0, 1, 2].map((j) => Math.round(a[j] + (b[j] - a[j]) * t));
const luma = (c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
const hash = (a, b) => { const x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return x - Math.floor(x); };

// 💡 when each of an area's lights comes on is litAt(dark, k) in src/lib/world.js, beside the sky it reads

// 🔤 WHAT IS WRITTEN STAYS READABLE (3 Oct 2026). A speech bubble and a player's name are words, not the world: at full dark
// the multiply turned a cream bubble navy and a name into dark blue on dark grass. Every visible one gets a clear patch in
// the light map, cut a cell inside its box so its own dark border keeps the night; a name also takes a dark chip once the
// host carries wn-dark (world-social.js), since its letters stand on bare ground. An area adds its bubbles with opts.keep.
// A float (a coin's +1, a heart) has no box of its own to clear — a patch would show the day behind its letters — so it
// glows instead, a soft light the size of the float that fades with it (opts.glow).
const KEEP = '.bw-name, .bws-tag';
const GLOW = [255, 236, 196];

/**
 * Hang the night on an area's viewport.
 *
 * @param host  the area's VIEW element — the fixed box, never the panning world (the weather's rule, §19)
 * @param opts  { lights(dark) → [{ x, y, r, c:[r,g,b], i, bloom, sq, rect:[w,h], flicker:'fire'|'stutter' }] in view px,
 *                hour() → the town hour (default: the real clock), mood() → null | { amb:[r,g,b], floor, name }, cell,
 *                keep → a selector for the area's own words in the world (a speech bubble), beside the names (KEEP),
 *                glow → a selector for its floats, which glow instead }
 * @returns { tick, indoors, level, state, hour, stop } — call tick(now) from the area's loop; link it to the weather
 *          (weather.link(night)) so stepping inside hides rain and night together
 */
export function mountNight(host, opts = {}) {
  const dead = { tick: () => {}, indoors: () => {}, level: () => 0, state: () => ({ dark: 0, phase: 'day', hidden: true, lights: 0 }), hour: () => {}, stop: () => {} };
  if (!host) return dead;
  const moved = getComputedStyle(host).transform;
  if (moved && moved !== 'none') {
    console.warn('[night] refused: ' + (host.id || host.className) + ' is transformed, so the night would pan with the map. Mount on the VIEW, not the WORLD.');
    return dead;
  }
  const S = opts.cell || 2;   // css px to a light cell: one art pixel on a phone
  const map = document.createElement('canvas'), bloom = document.createElement('canvas');
  map.className = 'wn wn--map'; bloom.className = 'wn wn--bloom';
  for (const c of [map, bloom]) {
    c.setAttribute('aria-hidden', 'true');
    Object.assign(c.style, { position: 'absolute', left: '0', top: '0', width: '100%', height: '100%', pointerEvents: 'none',
      imageRendering: 'pixelated', zIndex: 'var(--wn-z, 7)', display: 'none' });
    host.appendChild(c);
  }
  map.style.mixBlendMode = 'multiply';
  bloom.style.mixBlendMode = 'screen';
  const mc = map.getContext('2d'), bc = bloom.getContext('2d');
  const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // one ring texture per (radius, colour, shape), drawn once at cell size and reused every frame
  const cache = new Map();
  function spriteFor(L) {
    const sq = L.rect ? 1 : (L.sq || 1.25), r = Math.max(3, Math.round(L.r));
    const rw = L.rect ? L.rect[0] / 2 : 0, rh = L.rect ? L.rect[1] / 2 : 0;
    const key = r + '|' + L.c.join(',') + '|' + sq + '|' + rw + 'x' + rh;
    let sp = cache.get(key);
    if (sp) return sp;
    if (cache.size > 96) cache.clear();
    const w = Math.ceil(2 * (r + rw) / S) + 2, h = Math.ceil(2 * (r / sq + rh) / S) + 2;
    const cx = Math.floor(w / 2), cy = Math.floor(h / 2);
    const light = document.createElement('canvas'), glow = document.createElement('canvas');
    light.width = glow.width = w; light.height = glow.height = h;
    const lx = light.getContext('2d'), gx = glow.getContext('2d');
    const LD = lx.createImageData(w, h), GD = gx.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const px = (x - cx + 0.5) * S, py = (y - cy + 0.5) * S;
      let d, inside = false;
      if (L.rect) {
        const ex = Math.max(0, Math.abs(px) - rw), ey = Math.max(0, Math.abs(py) - rh);
        inside = !ex && !ey;
        d = inside ? 0 : Math.hypot(ex, ey) / r;
      } else d = Math.hypot(px, py * sq) / r;
      d -= BAYER[(y & 1) * 2 + (x & 1)] * 0.06;   // the ring edges dither, the pixel way
      if (d >= 1) continue;
      const v = (RING.find((q) => d < q[0]) || RING[RING.length - 1])[1];
      const i = (y * w + x) * 4;
      LD.data[i] = L.c[0] * v; LD.data[i + 1] = L.c[1] * v; LD.data[i + 2] = L.c[2] * v; LD.data[i + 3] = 255;
      const b = inside ? 1 : d < 0.22 ? 0.55 : d < 0.42 ? 0.18 : 0;
      if (b) { GD.data[i] = L.c[0]; GD.data[i + 1] = L.c[1]; GD.data[i + 2] = L.c[2]; GD.data[i + 3] = Math.round(255 * b); }
    }
    lx.putImageData(LD, 0, 0); gx.putImageData(GD, 0, 0);
    sp = { light, glow, cx, cy, w, h };
    cache.set(key, sp);
    return sp;
  }

  let hidden = false, pinned = null, last = '', drawAt = 0, W = 0, H = 0, count = 0;
  let dark = 0, phase = 'day', amb = WHITE, moodName = null, hourNow = 0;
  function sky() {
    hourNow = pinned != null ? pinned : opts.hour ? opts.hour() : townHourAt(Date.now());
    const s = skyAt(hourNow);
    phase = s.phase;
    let d = s.dark;
    if (phase === 'dusk') amb = d < 0.5 ? mix(WHITE, DUSK_MID, d / 0.5) : mix(DUSK_MID, NIGHT_AMB, (d - 0.5) / 0.5);
    else if (phase === 'dawn') amb = d < 0.5 ? mix(WHITE, DAWN_MID, d / 0.5) : mix(DAWN_MID, NIGHT_AMB, (d - 0.5) / 0.5);
    else amb = phase === 'night' ? NIGHT_AMB : WHITE;
    // 🌑 an area's own sky over the clock's (the town's Curse Nights, its haunted nights, an omen): never lighter than the
    // clock — a quiet curse at midnight is still midnight — and in its own colour
    const m = opts.mood ? opts.mood() : null;
    moodName = m ? m.name || 'mood' : null;
    if (m) { d = Math.max(d, m.floor || 0); amb = mix(WHITE, m.amb || NIGHT_AMB, d); }
    dark = d;
  }
  function flick(L, k, step) {
    if (!L.flicker || still) return 1;
    const n = hash(step, k + 1);
    return L.flicker === 'stutter' ? (n < 0.3 ? 0.2 : 1) : 0.9 + 0.1 * n;   // a faulty lamp catches; a fire breathes
  }
  // every visible box a selector finds in the host, in view px (see KEEP)
  const keepSel = KEEP + (opts.keep ? ', ' + opts.keep : '');
  function boxes(sel) {
    const out = [], hb = host.getBoundingClientRect();
    for (const el of host.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.right < hb.left || r.left > hb.right || r.bottom < hb.top || r.top > hb.bottom) continue;
      out.push({ el, l: r.left - hb.left, t: r.top - hb.top, r: r.right - hb.left, b: r.bottom - hb.top });
    }
    return out;
  }
  // …the words' clear patches in cells, [x0, y0, x1, y1], cut a cell inside each box
  function holes() {
    const out = [];
    for (const q of boxes(keepSel)) {
      const x0 = Math.ceil(q.l / S), y0 = Math.ceil(q.t / S), x1 = Math.floor(q.r / S), y1 = Math.floor(q.b / S);
      if (x1 > x0 && y1 > y0) out.push([x0, y0, x1, y1]);
    }
    return out;
  }
  // …and the floats' glows, as lights
  function glows() {
    if (!opts.glow) return [];
    return boxes(opts.glow).map((q) => ({ x: (q.l + q.r) / 2, y: (q.t + q.b) / 2, r: 14, c: GLOW, bloom: 0.25, rect: [q.r - q.l, q.b - q.t],
      i: 0.95 * Math.min(1, +getComputedStyle(q.el).opacity || 0) }));
  }
  function draw(lights, sc, step, keep) {
    mc.globalCompositeOperation = 'source-over'; mc.globalAlpha = 1;
    mc.fillStyle = 'rgb(' + amb.join(',') + ')';
    mc.fillRect(0, 0, W, H);
    bc.globalCompositeOperation = 'source-over'; bc.globalAlpha = 1;
    bc.clearRect(0, 0, W, H);
    mc.globalCompositeOperation = 'lighter'; bc.globalCompositeOperation = 'lighter';
    count = 0;
    lights.forEach((L, k) => {
      const f = flick(L, k, step);
      const a = (L.i == null ? 1 : L.i) * sc * f;
      if (a <= 0.004) return;
      const sp = spriteFor(L);
      const x = Math.round(L.x / S) - sp.cx, y = Math.round(L.y / S) - sp.cy;
      if (x > W || y > H || x + sp.w < 0 || y + sp.h < 0) return;
      count++;
      mc.globalAlpha = Math.min(1, a); mc.drawImage(sp.light, x, y);
      if (L.bloom) { bc.globalAlpha = Math.min(1, L.bloom * Math.min(1, sc * 1.2) * f); bc.drawImage(sp.glow, x, y); }
    });
    mc.globalCompositeOperation = 'source-over'; mc.globalAlpha = 1; mc.fillStyle = '#fff';
    for (const [x0, y0, x1, y1] of keep) { mc.fillRect(x0, y0, x1 - x0, y1 - y0); bc.clearRect(x0, y0, x1 - x0, y1 - y0); }
  }
  function show(on) {
    const v = on ? '' : 'none';
    if (map.style.display !== v) { map.style.display = v; bloom.style.display = v; }
  }

  // ⚡ twenty paints a second at most, and none when nothing changed: the light mostly stands still and the camera is
  // the fast thing. In daylight it is two hidden canvases and a few sums.
  function tick(now) {
    if (now < drawAt) return;
    drawAt = now + 50;
    sky();
    host.classList.toggle('wn-dark', !hidden && dark > 0.45);   // 🔤 a name takes its chip (world-social.js)
    if (hidden || dark <= 0.004) { show(false); last = ''; count = 0; return; }
    show(true);
    const cw = Math.ceil(host.clientWidth / S), ch = Math.ceil(host.clientHeight / S);
    if (cw !== W || ch !== H) { W = cw; H = ch; map.width = bloom.width = W; map.height = bloom.height = H; last = ''; }
    const lights = (opts.lights ? opts.lights(dark) || [] : []).concat(glows());
    const sc = Math.min(1.05, Math.pow(Math.max(0, 1 - luma(amb) / 255), 1.3) * 1.45);
    const step = still ? 0 : Math.floor(now / 110);
    let sig = amb.join(',') + '|' + sc.toFixed(3) + '|' + W + 'x' + H;
    for (const L of lights) sig += ';' + Math.round(L.x / S) + ',' + Math.round(L.y / S) + ',' + Math.round(L.r) + ',' + (L.i == null ? 1 : L.i).toFixed(2) + (L.flicker ? ',' + step : '');
    const keep = holes();
    sig += '|' + keep.join(';');
    if (sig === last) return;
    last = sig;
    draw(lights, sc, step, keep);
  }

  return {
    tick,
    /** 🏠 inside a room there is no sky: linked to the weather (weather.link(night)), so one door hides both */
    indoors: (on) => { hidden = !!on; last = ''; drawAt = 0; if (hidden) show(false); },   // …and the door back out repaints on the next frame
    /** 0 (day) to 1 (night), the area's mood included — what the lamps, the clock and the walks read */
    level: () => dark,
    state: () => ({ dark: Math.round(dark * 1000) / 1000, phase, hour: Math.round(hourNow * 100) / 100, mood: moodName, hidden: hidden || dark <= 0.004, lights: count, kept: holes().length }),
    /** QA: pin the hour this sky reads (null hands it back to the clock) — an area with its own pinned clock passes hour() */
    hour: (h) => { pinned = h == null ? null : +h; last = ''; drawAt = 0; },
    stop: () => { map.remove(); bloom.remove(); },
  };
}
