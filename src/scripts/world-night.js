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
// 🔤 the words in the world — a player's name, an animal's heart — are not lit at all: they stand ABOVE the night, in
// src/lib/world-marks.js. ⚠️ Clear patches cut into the light map round them were tried (3 Oct 2026): they lit whatever stood
// in front of a bubble, trailed a moving name and flickered (Trym: "dont add light effect on it … goes for all areas").

/**
 * Hang the night on an area's viewport.
 *
 * @param host  the area's VIEW element — the fixed box, never the panning world (the weather's rule, §19)
 * @param opts  { lights(dark) → [{ x, y, r, c:[r,g,b], i, bloom, sq, rect:[w,h], flicker:'fire'|'stutter' }] in view px,
 *                hour() → the town hour (default: the real clock), mood() → null | { amb:[r,g,b], floor, name }, cell,
 *                cam() → { x, y }: the camera, i.e. how far the area's world is translated, so the light lies on the
 *                ground and not on the screen }
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
    Object.assign(c.style, { position: 'absolute', left: '0', top: '0', pointerEvents: 'none', transformOrigin: '0 0',
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

  let hidden = false, pinned = null, last = '', W = 0, H = 0, count = 0, shift = '';
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
  function draw(lights, sc, step, fx, fy) {
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
      const x = Math.round((L.x + fx) / S) - sp.cx, y = Math.round((L.y + fy) / S) - sp.cy;
      if (x > W || y > H || x + sp.w < 0 || y + sp.h < 0) return;
      count++;
      mc.globalAlpha = Math.min(1, a); mc.drawImage(sp.light, x, y);
      if (L.bloom) { bc.globalAlpha = Math.min(1, L.bloom * Math.min(1, sc * 1.2) * f); bc.drawImage(sp.glow, x, y); }
    });
  }
  function show(on) {
    const v = on ? '' : 'none';
    if (map.style.display !== v) { map.style.display = v; bloom.style.display = v; }
  }

  // ⭐ THE LIGHT LIES STILL ON THE GROUND (3 Oct 2026, Trym: "the streetlight on the ground slightly moves when i move around
  // with my banana … the light on the ground should be completely still"). Three things made a pool swim behind the camera:
  // ⚠️ the map was repainted twenty times a second while the world pans every frame, so between paints it hung on the
  // screen as the ground slid under it; ⚠️ an area ticked the night BEFORE its camera moved, a frame behind; ⚠️ and its
  // 2-px cells were cut from the SCREEN, so a pool's rings stepped across the cobbles as the camera crept. Now it is called
  // every frame, after the camera, and the cells are cut from the GROUND: the canvases sit one cell bigger than the view,
  // pulled back by the camera's fraction of a cell, so a light only lands in a new cell when the ground does. A paint still
  // happens only when something changed — while the camera glides inside a cell it is one transform.
  function tick(now) {
    sky();
    if (host.__wm) host.__wm.tick(!hidden && dark > 0.004);   // 🔤 names, emotes and floats ride above the night while it shows (world-marks.js)
    if (hidden || dark <= 0.004) { show(false); last = ''; count = 0; return; }
    show(true);
    const cw = Math.ceil(host.clientWidth / S) + 1, ch = Math.ceil(host.clientHeight / S) + 1;
    if (cw !== W || ch !== H) {
      W = cw; H = ch; map.width = bloom.width = W; map.height = bloom.height = H; last = '';
      for (const c of [map, bloom]) { c.style.width = W * S + 'px'; c.style.height = H * S + 'px'; }
    }
    const c = opts.cam ? opts.cam() : null;
    const fx = c ? ((c.x % S) + S) % S : 0, fy = c ? ((c.y % S) + S) % S : 0;
    const sh = 'translate(' + (-fx) + 'px,' + (-fy) + 'px)';
    if (sh !== shift) { shift = sh; map.style.transform = bloom.style.transform = sh; }
    const lights = opts.lights ? opts.lights(dark) || [] : [];
    const sc = Math.min(1.05, Math.pow(Math.max(0, 1 - luma(amb) / 255), 1.3) * 1.45);
    const step = still ? 0 : Math.floor(now / 110);
    let sig = amb.join(',') + '|' + sc.toFixed(3) + '|' + W + 'x' + H;
    for (const L of lights) sig += ';' + Math.round((L.x + fx) / S) + ',' + Math.round((L.y + fy) / S) + ',' + Math.round(L.r) + ',' + (L.i == null ? 1 : L.i).toFixed(2) + (L.flicker ? ',' + step : '');
    if (sig === last) return;
    last = sig;
    draw(lights, sc, step, fx, fy);
  }

  // ⚠️ THE SKY IS KNOWN FROM THE START. An area may read state() before the night's first tick — the homestead's cat asks
  // "is it night?" earlier in the yard's frame than the night ticks — and a default 'day' there let her doorstep gift be
  // looked for in the dark (3 Oct 2026). sky() runs now, and again whenever a walk pins the hour.
  sky();
  return {
    tick,
    /** 🏠 inside a room there is no sky: linked to the weather (weather.link(night)), so one door hides both */
    indoors: (on) => { hidden = !!on; last = ''; if (hidden) { show(false); if (host.__wm) host.__wm.tick(false); } },   // the words go home at the door, an area's loop may stop inside; the door back out repaints on the next frame
    /** 0 (day) to 1 (night), the area's mood included — what the lamps, the clock and the walks read */
    level: () => dark,
    state: () => ({ dark: Math.round(dark * 1000) / 1000, phase, hour: Math.round(hourNow * 100) / 100, mood: moodName, hidden: hidden || dark <= 0.004, lights: count }),
    /** QA: pin the hour this sky reads (null hands it back to the clock) — an area with its own pinned clock passes hour() */
    hour: (h) => { pinned = h == null ? null : +h; last = ''; sky(); },
    stop: () => { map.remove(); bloom.remove(); },
  };
}
