// 🌍 THE PIXEL EARTH — who is in Banana World right now, and how close they
// are to buying something.
//
// A faithful port of worker-pulse's map, out of its template literal and into
// a file that can be read and tested. Everything that made it worth keeping is
// here: the sonar rings, the purchase ladder, the ghosts of people who just
// left, and eight seconds of confetti when somebody actually pays.
//
// PURE RENDERER: no imports, no fetching. Hand it the map data and the
// payloads; it owns one canvas.
//
//   buildEarth(host, MAP, opts) -> { push, setMode, setLens, zoom, stop }
//     MAP  = { MAP_W, MAP_H, LAND_HEX, CENTROIDS }
//     push({ live, range, mode, lens })
//     opts = { onTip(html|null) }
//
// ⚠️ THE CONTRACT THAT CANNOT DRIFT (all of it is load-bearing):
//   · 6px cells, land drawn at 5px — the 1px gutter IS the pixel-earth look
//   · land painted ONCE offscreen and blitted; 4,776 cells per frame was the
//     thing this design exists to avoid
//   · the rAF loop idles when the tab is hidden or the map is off screen
//   · sonar: 2.6s period, two rings half a period apart, per-pin desync seed,
//     radius (r+0.5)*PX + p*3.5*PX, alpha (1-p)² × 0.4, line PX*0.9
//   · confetti fires on an INCREASE in the purchase count, not on an event

// ⚠️ PX IS MEASURED, NOT FIXED. A 1080px canvas squeezed into a 345px phone
// is a 0.32 downscale, and the 1px gutter between cells lands on a fraction of
// a pixel — the browser then drops whole ROWS of it and the earth renders as
// horizontal stripes. So the backing store is sized to the real displayed box
// and the cell size falls out of it; below 3px a cell the gutter is dropped
// entirely, because a sub-pixel gutter is the stripes.
let PX = 6;
const MAXDPR = 2;
const SEA = '#151129';
const LAND = '#453a75';
const COL = { live: '255,225,53', range: '255,93,143', event: '94,224,138' };
const GOLD = '255,215,0';
const GREEN = '94,224,138';
const CONFETTI = ['#ffe135', '#5ee08a', '#ff5d8f', '#5ec8e0'];
// the purchase ladder — the map's whole reason for pulsing
export const HOTTXT = {
  1: '👀 eyeing a product',
  2: '🛒 hit ORDER',
  3: '💳 reached the CHECKOUT',
  4: '💰 BOUGHT!',
};

export function buildEarth(host, MAP, opts) {
  const o = opts || {};
  const W = MAP.MAP_W, H = MAP.MAP_H;
  const LANDBITS = MAP.LAND_HEX.map((row) => {
    let b = '';
    for (const ch of row) b += ('000' + parseInt(ch, 16).toString(2)).slice(-4);
    return b;
  });

  const DPR = Math.min(MAXDPR, (window.devicePixelRatio || 1));
  const wrap = document.createElement('div');
  wrap.className = 'pm-wrap';
  const cv = document.createElement('canvas');
  cv.className = 'pm-cv';
  wrap.appendChild(cv);
  const tip = document.createElement('div');
  tip.className = 'pm-tip';
  tip.hidden = true;
  wrap.appendChild(tip);
  host.appendChild(wrap);
  const ctx = cv.getContext('2d');

  // the land never changes — render it once per size so 60fps costs almost nothing
  const landCv = document.createElement('canvas');
  function paintLand() {
    landCv.width = Math.round(W * PX);
    landCv.height = Math.round(H * PX);
    const g = landCv.getContext('2d');
    g.fillStyle = SEA;
    g.fillRect(0, 0, landCv.width, landCv.height);
    g.fillStyle = LAND;
    const gut = PX >= 3 ? Math.max(1, Math.round(PX * 0.16)) : 0;
    for (let y = 0; y < H; y++) {
      const row = LANDBITS[y];
      if (!row) continue;
      const y0 = Math.round(y * PX), yh = Math.max(1, Math.round((y + 1) * PX) - y0 - gut);
      for (let x = 0; x < W; x++) {
        if (row[x] !== '1') continue;
        const x0 = Math.round(x * PX);
        g.fillRect(x0, y0, Math.max(1, Math.round((x + 1) * PX) - x0 - gut), yh);
      }
    }
  }

  // the canvas is sized to the box it actually occupies, in device pixels, so
  // nothing is ever resampled on its way to the screen
  function layout() {
    const box = wrap.clientWidth || host.clientWidth || 0;
    if (!box) return false;                 // hidden: keep the size we had
    const px = Math.max(1.2, (box * DPR) / W);
    if (Math.abs(px - PX) < 0.01 && cv.width) return false;
    PX = px;
    cv.width = Math.round(W * PX);
    cv.height = Math.round(H * PX);
    cv.style.width = '100%';
    cv.style.height = 'auto';
    paintLand();
    return true;
  }
  layout();
  addEventListener('resize', layout);

  const view = { s: 1, ox: 0, oy: 0 };
  const clampView = () => {
    view.s = Math.max(1, Math.min(5, view.s));
    view.ox = Math.max(0, Math.min(W - W / view.s, view.ox));
    view.oy = Math.max(0, Math.min(H - H / view.s, view.oy));
  };

  let state = { live: null, range: null, mode: 'live', lens: '' };
  let dots = [];
  let flakes = [];
  let confettiUntil = 0;
  let lastPurchases = null;
  let raf = 0;

  // ⚠️ `hot` is an OBJECT keyed by country code — { US: 4, DE: 3 } — not a
  // list of rows. Treating it as an array threw on the first live payload.
  const hotOf = () => ((state.live && state.live.hot) || {});
  const stageOf = (cc) => +hotOf()[cc] || 0;

  function data() {
    if (state.mode === 'live') {
      return ((state.live && state.live.countries) || []).map((c) => ({ cc: c.cc || c.id || c.code, v: +c.v || 0, name: c.name || c.country || '' }));
    }
    if (state.mode === 'event') {
      const m = (state.range && state.range.eventMap && state.range.eventMap[state.lens]) || {};
      return Object.entries(m).map(([cc, v]) => ({ cc, v: +v || 0, name: cc }));
    }
    return ((state.range && state.range.countries) || []).map((c) => ({ cc: c.cc, v: +c.sessions || 0, name: c.name || c.cc }));
  }

  function fire() {
    confettiUntil = performance.now() + 8000;
    flakes = Array.from({ length: 90 }, () => ({
      x: Math.random(), y: -Math.random() * 0.4, vy: 0.12 + Math.random() * 0.22,
      c: CONFETTI[Math.floor(Math.random() * CONFETTI.length)], w: 3 + Math.random() * 4,
    }));
  }

  function draw(now) {
    const t = now / 1000;
    const cw = cv.width, ch = cv.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    // the viewport is in CELLS, so zoom is a source-rect crop of the land
    const sw = W / view.s, sh = H / view.s;
    ctx.drawImage(landCv, view.ox * PX, view.oy * PX, sw * PX, sh * PX, 0, 0, cw, ch);
    const k = view.s;
    const toX = (x) => (x - view.ox) * PX * k;
    const toY = (y) => (y - view.oy) * PX * k;

    const rows = data();
    const max = Math.max(1, ...rows.map((r) => r.v));
    dots = [];
    for (const d of rows) {
      const c = MAP.CENTROIDS[d.cc];
      if (!c) continue;                       // a country with no centroid is dropped, never guessed
      const r = 1 + Math.round(2 * Math.sqrt(d.v / max));
      const stage = state.mode === 'live' ? stageOf(d.cc) : 0;
      const col = stage >= 4 ? GOLD : COL[state.mode] || COL.live;
      const cx = toX(c[0] + 0.5), cy = toY(c[1] + 0.5);
      dots.push({ x: c[0], y: c[1], cx, cy, r, cc: d.cc, name: d.name, v: d.v, stage });
      if (cx < -40 || cy < -40 || cx > cw + 40 || cy > ch + 40) continue;
      // ── the sonar. Two rings half a period apart, desynced per pin so the
      //    map breathes instead of marching in step.
      if (state.mode === 'live') {
        const ringCol = stage >= 2 ? GREEN : col;
        const seed = ((d.cc.charCodeAt(0) * 7 + d.cc.charCodeAt(1) * 13) % 10) / 10;
        for (let i = 0; i < 2; i++) {
          const p = ((t / 2.6) + i * 0.5 + seed) % 1;
          const rad = ((r + 0.5) * PX + p * 3.5 * PX) * k;
          const a = Math.pow(1 - p, 2) * 0.4;
          ctx.strokeStyle = 'rgba(' + ringCol + ',' + a.toFixed(3) + ')';
          ctx.lineWidth = PX * 0.9 * k;
          ctx.beginPath();
          ctx.arc(cx, cy, rad, 0, 6.2832);
          ctx.stroke();
        }
      }
      // the pin: a shadow, a body, a highlight pixel
      const body = Math.max(PX, (2 * r - 1) * PX) * k;
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(cx - body / 2 + 1.5, cy - body / 2 + 2, body, body);
      ctx.fillStyle = 'rgb(' + col + ')';
      ctx.fillRect(cx - body / 2, cy - body / 2, body, body);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(cx - body / 2, cy - body / 2, Math.max(2, body * 0.28), Math.max(2, body * 0.28));
      // ── close to buying: brackets that breathe
      if (stage >= 2) {
        const br = 0.4 + 0.3 * (1 + Math.sin(t * 2.6));
        ctx.strokeStyle = 'rgba(' + (stage >= 4 ? GOLD : GREEN) + ',' + Math.min(1, br).toFixed(2) + ')';
        ctx.lineWidth = Math.max(1, 1.5 * k);
        const s2 = body * 1.5, arm = s2 * 0.35;
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => {
          const px2 = cx + sx * s2 / 2, py2 = cy + sy * s2 / 2;
          ctx.beginPath();
          ctx.moveTo(px2 - sx * arm, py2);
          ctx.lineTo(px2, py2);
          ctx.lineTo(px2, py2 - sy * arm);
          ctx.stroke();
        });
      }
    }
    // ── the ghosts: somebody who was about to buy and has already gone. The
    //    signal outlives the session, or it vanishes at the worst moment.
    if (state.mode === 'live') {
      const here = new Set(dots.map((d) => d.cc));
      for (const [cc, st] of Object.entries(hotOf())) {
        if (here.has(cc)) continue;
        const c = MAP.CENTROIDS[cc];
        if (!c) continue;
        const blink = 0.35 + 0.35 * (1 + Math.sin(t * 3));
        ctx.fillStyle = 'rgba(' + GREEN + ',' + Math.min(0.8, blink).toFixed(2) + ')';
        ctx.fillRect(toX(c[0] + 0.5) - PX * k / 2, toY(c[1] + 0.5) - PX * k / 2, PX * k, PX * k);
        dots.push({ x: c[0], y: c[1], cx: toX(c[0] + 0.5), cy: toY(c[1] + 0.5), r: 1,
          cc, name: cc, v: 0, stage: +st || 1, ghost: true });
      }
    }
    // ── and the eight seconds that say somebody actually paid. Drawn in
    //    SCREEN space so it does not zoom with the map.
    if (now < confettiUntil) {
      const life = 1 - (confettiUntil - now) / 8000;
      for (const f of flakes) {
        const yy = (f.y + life * f.vy * 8) * ch;
        if (yy < -10 || yy > ch + 10) continue;
        ctx.fillStyle = f.c;
        ctx.fillRect(f.x * cw, yy, f.w, f.w);
      }
    }
  }

  function loop() {
    // ⚠️ BOTH guards: a hidden canvas still costs a full draw per frame
    if (!document.hidden && wrap.offsetParent !== null) draw(performance.now());
    raf = requestAnimationFrame(loop);
  }

  function push(next) {
    Object.assign(state, next || {});
    // confetti follows an INCREASE in the realtime purchase count
    const ev = ((state.live && state.live.events) || []).find((e) => e.name === 'purchase');
    const n = ev ? +ev.v || 0 : 0;
    if (lastPurchases != null && n > lastPurchases) fire();
    lastPurchases = n;
  }

  const at = (ev) => {
    const r = cv.getBoundingClientRect();
    const mx = ((ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left) * (cv.width / r.width);
    const my = ((ev.touches ? ev.touches[0].clientY : ev.clientY) - r.top) * (cv.height / r.height);
    let best = null, bd = 26 * view.s;
    for (const d of dots) {
      const dist = Math.hypot(mx - d.cx, my - d.cy);
      if (dist < bd) { bd = dist; best = d; }
    }
    if (!best) { tip.hidden = true; if (o.onTip) o.onTip(null); return; }
    const bits = [(best.name || best.cc) + (best.v ? ' · ' + best.v : '')];
    if (best.stage) bits.push(HOTTXT[best.stage] + (best.ghost ? ' — left already' : ''));
    // in LIVE mode the tooltip also says what they are looking at
    if (state.mode === 'live' && state.live && state.live.countryPages) {
      const ps = state.live.countryPages[best.cc] || [];
      ps.slice(0, 3).forEach((p) => bits.push('· ' + (p.page || p)));
    }
    tip.hidden = false;
    tip.textContent = bits.join('\n');
    tip.style.left = Math.round((best.cx / cv.width) * 100) + '%';
    tip.style.top = Math.round((best.cy / cv.height) * 100) + '%';
    if (o.onTip) o.onTip(bits);
  };
  cv.addEventListener('pointermove', at);
  cv.addEventListener('pointerdown', at);
  cv.addEventListener('pointerleave', () => { tip.hidden = true; });

  // drag to pan, in cell units so it feels the same at every zoom
  let drag = null;
  cv.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, ox: view.ox, oy: view.oy }; });
  addEventListener('pointerup', () => { drag = null; });
  addEventListener('pointermove', (e) => {
    if (!drag || view.s === 1) return;
    const r = cv.getBoundingClientRect();
    view.ox = drag.ox - ((e.clientX - drag.x) / r.width) * (W / view.s);
    view.oy = drag.oy - ((e.clientY - drag.y) / r.height) * (H / view.s);
    clampView();
  });

  raf = requestAnimationFrame(loop);

  return {
    push,
    setMode(m) { state.mode = m; },
    setLens(l) { state.lens = l; },
    zoom(dir) {
      const cx = view.ox + W / view.s / 2, cy = view.oy + H / view.s / 2;
      view.s = Math.max(1, Math.min(5, view.s + dir));
      view.ox = cx - W / view.s / 2;
      view.oy = cy - H / view.s / 2;
      clampView();
      return view.s;
    },
    stop() { cancelAnimationFrame(raf); },
  };
}
