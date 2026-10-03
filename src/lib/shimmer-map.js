// 🗺 THE STAR MAP (3 Oct 2026, the perk bench's; the design is the Claude Doc "Shimmer & the Star Map"). Every Shimmer level
// is a star you place in one of six constellations, one per area, each the shape of that area's own thing. Its forty stars
// TRACE the figure, so placing them draws it: you watch a watering can appear in the sky. Every fourth star is a bigger
// perk star, and the one that lights it lights the perk. Nothing here saves: it is the look, played on the bench.
import { WORDS as W, perkWords, starSrc, play, still, tag, els } from './shimmer-fx.js';
import { fillWords } from './fill-words.js';
import { LADDER, ORDER, STARS_EACH } from '../data/shimmer.js';

// each figure as strokes in a 100 × 80 cell; the forty stars are spread evenly along them, stroke by stroke
const circle = (cx, cy, r, n = 28, from = -Math.PI / 2) => Array.from({ length: n + 1 }, (_, i) => [cx + Math.cos(from + (i / n) * Math.PI * 2) * r, cy + Math.sin(from + (i / n) * Math.PI * 2) * r]);
const oval = (cx, cy, rx, ry, n = 28) => Array.from({ length: n + 1 }, (_, i) => [cx + Math.cos(Math.PI + (i / n) * Math.PI * 2) * rx, cy + Math.sin(Math.PI + (i / n) * Math.PI * 2) * ry]);
const FIG = {
  can: [[[30, 36], [32, 22], [52, 22], [54, 36]], [[24, 36], [60, 36], [60, 70], [24, 70], [24, 36]], [[60, 46], [80, 30], [86, 24]], [[81, 17], [92, 28]]],
  ball: [[[50, 2], [50, 14]], circle(50, 42, 27), [[23, 42], [77, 42]], [[50, 15], [50, 69]]],
  barn: [[[18, 72], [18, 40], [30, 24], [50, 14], [70, 24], [82, 40], [82, 72], [18, 72]], [[40, 72], [40, 52], [60, 52], [60, 72]], [[40, 52], [60, 72]]],
  fish: [oval(46, 40, 28, 16), [[73, 40], [92, 24], [92, 56], [73, 40]], [[30, 35], [31, 36]]],
  clock: [[[32, 32], [50, 8], [68, 32]], [[36, 32], [64, 32], [64, 74], [36, 74], [36, 32]], circle(50, 47, 8, 16)],
  hammer: [[[20, 14], [80, 14], [80, 32], [20, 32], [20, 14]], [[45, 32], [45, 76], [55, 76], [55, 32]]],
};
const POINTS = {};
function points(key) {
  if (POINTS[key]) return POINTS[key];
  const segs = [];
  FIG[key].forEach((st, s) => { for (let i = 1; i < st.length; i++) { const [x0, y0] = st[i - 1], [x1, y1] = st[i]; segs.push({ s, x0, y0, x1, y1, len: Math.hypot(x1 - x0, y1 - y0) }); } });
  const total = segs.reduce((a, g) => a + g.len, 0), step = total / STARS_EACH, out = [];
  let k = 0, acc = 0;
  for (let i = 0; i < STARS_EACH; i++) {
    const want = (i + 0.5) * step;
    while (k < segs.length - 1 && acc + segs[k].len < want) { acc += segs[k].len; k++; }
    const g = segs[k], t = g.len ? Math.min(1, (want - acc) / g.len) : 0;
    out.push({ x: g.x0 + (g.x1 - g.x0) * t, y: g.y0 + (g.y1 - g.y0) * t, s: g.s });
  }
  return (POINTS[key] = out);
}
const isPerk = (i) => (i + 1) % 4 === 0;
const perkAt = (key, star) => { const st = LADDER[key].steps.find((x) => x[0] === star); return st ? st.slice(1) : null; };
const nextPerk = (key, lit) => LADDER[key].steps.find((x) => x[0] > lit) || null;

// the figure, drawn into a canvas context at (ox, oy) with a scale: placed stars lit, the rest waiting. Shared with the
// night sky over the square (a finished constellation lights it), so it is the same drawing everywhere.
export function drawFigure(x, key, lit, ox, oy, f, opts = {}) {
  const pts = points(key);
  const P = (p) => [Math.round(ox + p.x * f), Math.round(oy + p.y * f)];
  x.save();
  x.lineWidth = 1;
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].s !== pts[i - 1].s) continue;
    const [ax, ay] = P(pts[i - 1]), [bx, by] = P(pts[i]), on = i < lit;
    x.setLineDash(on ? [] : [2, 3]);
    x.strokeStyle = on ? 'rgba(127,191,255,' + (opts.dim ? 0.45 : 0.85) + ')' : 'rgba(43,68,102,.9)';
    x.beginPath(); x.moveTo(ax + 0.5, ay + 0.5); x.lineTo(bx + 0.5, by + 0.5); x.stroke();
  }
  x.setLineDash([]);
  pts.forEach((p, i) => {
    const [px, py] = P(p), on = i < lit, big = isPerk(i);
    if (on) {
      const g = x.createRadialGradient(px, py, 0, px, py, big ? 9 : 6);
      g.addColorStop(0, 'rgba(191,227,255,' + (opts.dim ? 0.35 : 0.6) + ')'); g.addColorStop(1, 'rgba(79,157,255,0)');
      x.fillStyle = g; x.fillRect(px - 10, py - 10, 20, 20);
      x.fillStyle = '#ffffff';
      if (big) { x.fillRect(px - 1, py - 3, 3, 7); x.fillRect(px - 3, py - 1, 7, 3); x.fillStyle = '#bfe3ff'; x.fillRect(px - 1, py - 1, 3, 3); x.fillStyle = '#ffffff'; x.fillRect(px, py, 1, 1); }
      else x.fillRect(px - 1, py - 1, 2, 2);
    } else {
      x.fillStyle = big ? '#45618c' : '#2b4466';
      if (big) { x.fillRect(px - 1, py - 2, 3, 5); x.fillRect(px - 2, py - 1, 5, 3); } else x.fillRect(px - 1, py - 1, 2, 2);
    }
  });
  x.restore();
}
export const figurePoint = (key, i) => points(key)[i];

const CSS = `
.sm-veil{position:absolute;inset:0;z-index:2190;background:rgba(0,0,0,.38)}
.sm-card{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:2191;width:min(330px,calc(100% - 16px));max-height:calc(100% - 16px);overflow:auto;box-sizing:border-box;background:#0b1730;color:#cfe6ff;border:3px solid #000;box-shadow:3px 3px 0 #000,0 0 22px 4px rgba(60,130,255,.25);border-radius:4px;padding:10px 10px 10px;font-family:inherit}
.sm-x{position:absolute;right:6px;top:4px;width:28px;height:28px;border:0;background:none;color:#8fb6e6;font:900 18px/1 inherit;cursor:pointer}
.sm-top{display:flex;align-items:baseline;gap:8px;padding-right:26px}
.sm-top b{font-size:1.02rem;font-weight:900;color:#fff;letter-spacing:.05em}
.sm-top span{font-size:.7rem;font-weight:800;color:#8fc4ff;white-space:nowrap}
.sm-sky{display:block;margin:7px 0 8px;width:100%;border:2px solid #000;image-rendering:pixelated;touch-action:manipulation;cursor:pointer}
.sm-foot{display:flex;flex-direction:column;gap:7px;padding:8px 9px;background:#fffdf5;color:#241c00;border:2px solid #000;border-radius:3px}
.sm-row{display:flex;gap:9px;align-items:center}
.sm-row .t{flex:1;min-width:0}
.sm-row .t b{display:block;font-size:.76rem;font-weight:900}
.sm-row .t span{display:block;font-size:.68rem;font-weight:700;opacity:.78}
.sm-go{flex:none;height:36px;display:flex;align-items:center;gap:6px;padding:0 11px;background:#111;color:#8fd0ff;border:2px solid #000;box-shadow:2px 2px 0 #000;font:900 .76rem/1 inherit;white-space:nowrap;cursor:pointer}
.sm-go img{width:14px;height:14px;image-rendering:pixelated}
.sm-go[disabled]{opacity:.45;cursor:default}
.sm-skywrap{position:relative;margin:7px 0 8px}
.sm-skywrap .sm-sky{margin:0}
.sm-perk{position:absolute;left:6px;right:6px;bottom:6px;display:flex;flex-direction:column;gap:3px;padding:8px 9px;background:rgba(8,16,40,.94);border:2px solid #000;border-radius:3px;box-shadow:inset 0 0 0 1px rgba(127,191,255,.6),0 0 16px 2px rgba(60,130,255,.35)}
.sm-perk .n{display:flex;align-items:center;gap:6px;font-size:.92rem;font-weight:900;letter-spacing:.03em}
.sm-perk .n img{width:16px;height:16px;image-rendering:pixelated;filter:drop-shadow(0 0 3px rgba(127,191,255,.9))}
.sm-perk .l{font-size:.72rem;font-weight:700;color:#cfe6ff;line-height:1.35}
.sm-pick{display:flex;gap:6px}
.sm-pick button{flex:1;min-width:0;padding:7px 6px;background:#13254d;color:#dff0ff;border:2px solid #000;box-shadow:2px 2px 0 #000;font:900 .7rem/1.2 inherit;cursor:pointer}
.sm-fly{position:fixed;left:0;top:0;z-index:99999;width:18px;height:18px;margin:-9px 0 0 -9px;pointer-events:none;image-rendering:pixelated;filter:drop-shadow(0 0 3px #fff) drop-shadow(0 0 7px rgba(79,157,255,.9))}
`;
let styled = false;
const style = () => { if (styled) return; styled = true; const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s); };

// 🗺 open the map. `state` is the bench's: { lit: {can: 15, …}, toPlace: 12, chosen: {} }, mutated as stars are placed;
// `from` is where a placed star flies from (the HUD's Shimmer pill)
export function openMap(state, opts = {}) {
  style();
  const { view } = els(); if (!view) return null;
  for (const o of view.querySelectorAll(':scope > .sm-veil, :scope > .sm-card')) o.remove();
  const veil = document.createElement('div'); veil.className = 'sm-veil';
  const card = document.createElement('div'); card.className = 'sm-card'; card.setAttribute('role', 'dialog');
  card.innerHTML = '<button class="sm-x" type="button" aria-label="close">×</button><div class="sm-top"><b></b><span></span></div><div class="sm-skywrap"><canvas class="sm-sky"></canvas></div><div class="sm-foot"></div>';
  view.appendChild(veil); view.appendChild(card);
  // ⚠️ a tap on the map is the map's: it bubbled to the area under it, and the park opened a flower spot behind the card
  for (const el of [veil, card]) for (const t of ['pointerdown', 'pointerup', 'click', 'touchstart']) el.addEventListener(t, (e) => e.stopPropagation());
  const close = () => { live = false; veil.remove(); card.remove(); if (opts.closed) opts.closed(); };
  card.querySelector('.sm-x').onclick = close; veil.onclick = close;
  const cv = card.querySelector('.sm-sky'), foot = card.querySelector('.sm-foot');
  card.querySelector('.sm-top b').textContent = W.map.title;
  const count = () => { card.querySelector('.sm-top span').textContent = state.toPlace > 0 ? fillWords(W.map.toPlace, { n: state.toPlace }) : W.map.none; };
  count();
  // the sky's geometry: the North Star on top, then three rows of two
  const dpr = Math.max(1, Math.round(window.devicePixelRatio || 1));
  const cw = Math.max(240, Math.floor(cv.getBoundingClientRect().width || 300)), top = 32, cellH = 84, ch = top + cellH * 2 + 4;
  cv.width = cw * dpr; cv.height = ch * dpr; cv.style.height = ch + 'px';
  const x = cv.getContext('2d'); x.scale(dpr, dpr);
  // three across and two down, so the whole sky and its button fit a phone's view without a scroll
  const cellW = cw / 3, f = Math.min((cellW - 8) / 100, (cellH - 26) / 80);
  const cell = (i) => { const c = ORDER[i]; const ox = (i % 3) * cellW + (cellW - 100 * f) / 2, oy = top + Math.floor(i / 3) * cellH + 2; return { c, ox, oy }; };
  const BG = [];
  for (let i = 0; i < 90; i++) BG.push([(i * 97 + 13) % cw, (i * 53 + 7) % ch, i % 7 === 0 ? 2 : 1]);
  let sel = Math.max(0, ORDER.indexOf(opts.select || 'can')), live = true, flash = null, run = null;
  const font = getComputedStyle(card).fontFamily || 'sans-serif';
  const ns = new Image(); ns.src = starSrc('l');   // the North Star, drawn every frame from one image
  const draw = (now) => {
    const g = x.createRadialGradient(cw / 2, 0, 10, cw / 2, 0, ch);
    g.addColorStop(0, '#16305c'); g.addColorStop(0.55, '#0c1a38'); g.addColorStop(1, '#070f24');
    x.fillStyle = g; x.fillRect(0, 0, cw, ch);
    for (const [bx, by, s] of BG) { x.fillStyle = s > 1 ? 'rgba(160,200,255,.55)' : 'rgba(90,130,190,.5)'; x.fillRect(bx, by, s > 1 ? 2 : 1, 1); }
    // the North Star: dim until all six are full
    const full = ORDER.every((c) => (state.lit[c] || 0) >= STARS_EACH);
    x.globalAlpha = full ? 1 : 0.28; x.imageSmoothingEnabled = false;
    if (ns.complete) x.drawImage(ns, Math.round(cw / 2 - 7), 3, 14, 14);
    x.globalAlpha = 1;
    x.font = '800 8px ' + font; x.textAlign = 'center'; x.fillStyle = '#4d6a94';
    x.fillText(W.map.north, cw / 2, 27);
    ORDER.forEach((c, i) => {
      const { ox, oy } = cell(i), lit = state.lit[c] || 0, on = i === sel;
      if (on) { x.fillStyle = 'rgba(79,157,255,.10)'; x.fillRect(i % 3 * cellW + 2, oy - 1, cellW - 4, cellH - 2); }
      drawFigure(x, c, lit, ox, oy, f, { dim: !on && lit > 0 });
      // the next star of the chosen one breathes, so you know where yours goes
      if (on && lit < STARS_EACH) {
        const p = points(c)[lit], px = Math.round(ox + p.x * f), py = Math.round(oy + p.y * f);
        const k = still() ? 0.6 : 0.5 + 0.5 * Math.sin(now / 260);
        x.strokeStyle = 'rgba(191,227,255,' + (0.35 + 0.5 * k) + ')'; x.lineWidth = 1;
        x.beginPath(); x.arc(px + 0.5, py + 0.5, 4 + 2.5 * k, 0, Math.PI * 2); x.stroke();
      }
      if (flash && flash.c === c) {   // a star just placed: a ring of light goes out from it
        const t = (now - flash.t0) / 520;
        if (t < 1) { const p = points(c)[flash.i], px = ox + p.x * f, py = oy + p.y * f; x.strokeStyle = 'rgba(223,240,255,' + (1 - t) + ')'; x.lineWidth = 2; x.beginPath(); x.arc(px, py, 3 + t * 16, 0, Math.PI * 2); x.stroke(); }
      }
      if (run && run.c === c) {   // a perk or the capstone: the light runs the figure
        const t = (now - run.t0) / 900, k = Math.floor(t * lit);
        if (t < 1.2) { const pts = points(c); for (let j = Math.max(0, k - 3); j <= Math.min(lit - 1, k); j++) { const p = pts[j], px = ox + p.x * f, py = oy + p.y * f, gg = x.createRadialGradient(px, py, 0, px, py, 11); gg.addColorStop(0, 'rgba(255,255,255,.95)'); gg.addColorStop(1, 'rgba(127,191,255,0)'); x.fillStyle = gg; x.fillRect(px - 12, py - 12, 24, 24); } }
      }
      const name = W.constellations.find((q) => q.key === c);
      // its name, and under it how far it is: two short lines, as a third of a phone's width holds
      x.font = '900 8.5px ' + font; x.textAlign = 'center';
      x.fillStyle = on ? '#ffffff' : lit ? '#cfe6ff' : '#5b7aa6';
      x.fillText(name ? name.name : c, i % 3 * cellW + cellW / 2, oy + cellH - 15);
      x.font = '800 8px ' + font; x.fillStyle = on ? '#8fd0ff' : lit ? '#8fb6e6' : '#4d6a94';
      x.fillText(lit + '/' + STARS_EACH, i % 3 * cellW + cellW / 2, oy + cellH - 5);
    });
  };
  const loop = (now) => { if (!live || !card.isConnected) return; draw(now); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  cv.addEventListener('click', (e) => {
    const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    if (my < top) return;
    const i = Math.min(1, Math.floor((my - top) / cellH)) * 3 + Math.min(2, Math.floor(mx / cellW));
    if (i >= 0 && i < ORDER.length) { sel = i; paintFoot(); }
  });
  const paintFoot = (perkShown) => {
    const c = ORDER[sel], lit = state.lit[c] || 0, nm = W.constellations.find((q) => q.key === c);
    const nx = nextPerk(c, lit);
    foot.innerHTML = '';
    // the perk a star lit rises over the bottom of the sky, so the card never grows past a phone's view
    const wrap = card.querySelector('.sm-skywrap');
    for (const o of wrap.querySelectorAll('.sm-perk')) o.remove();
    if (perkShown) wrap.appendChild(perkShown);
    const row = document.createElement('div'); row.className = 'sm-row';
    const t = document.createElement('div'); t.className = 't';
    const b = document.createElement('b'); b.textContent = (nm ? nm.name : c) + ' · ' + lit + '/' + STARS_EACH;
    const s = document.createElement('span');
    s.textContent = nx ? fillWords(W.map.next, { at: nx[0], perk: nx.slice(1).map((k) => perkWords(k).name).join(' / ') }) : W.map.full;
    t.appendChild(b); t.appendChild(s);
    const go = document.createElement('button'); go.className = 'sm-go'; go.type = 'button';
    const gi = new Image(); gi.src = starSrc('m'); gi.alt = '';
    go.appendChild(gi); go.appendChild(document.createTextNode(W.map.place));
    go.disabled = !(state.toPlace > 0) || lit >= STARS_EACH;
    go.onclick = () => place(go);
    row.appendChild(t); row.appendChild(go);
    foot.appendChild(row);
  };
  // the perk a star just lit: its name in Shimmer's own type, and what it does; at the 20th, the choice of two
  const perkCard = (keys, onPick) => {
    const d = document.createElement('div'); d.className = 'sm-perk';
    if (keys.length > 1) {
      const pick = document.createElement('div'); pick.className = 'sm-pick';
      for (const k of keys) { const bt = document.createElement('button'); bt.type = 'button'; bt.textContent = perkWords(k).name; bt.onclick = () => onPick(k); pick.appendChild(bt); }
      d.appendChild(pick);
      return d;
    }
    const w = perkWords(keys[0]);
    const n = document.createElement('div'); n.className = 'n';
    const si = new Image(); si.src = starSrc('l'); si.alt = '';
    const nt = document.createElement('span'); nt.className = 'sh-txt'; nt.textContent = w.name;
    n.appendChild(si); n.appendChild(nt);
    const l = document.createElement('div'); l.className = 'l'; l.textContent = w.line;
    d.appendChild(n); d.appendChild(l);
    if (!still()) play(d, [{ scale: '0.7', opacity: 0 }, { scale: '1.04', opacity: 1, offset: 0.6 }, { scale: '1', opacity: 1 }], { duration: 380, easing: 'ease-out' });
    return d;
  };
  const place = (btn) => {
    const c = ORDER[sel], lit = state.lit[c] || 0;
    if (!(state.toPlace > 0) || lit >= STARS_EACH) return;
    btn.disabled = true;
    const p = points(c)[lit], { ox, oy } = cell(sel), r = cv.getBoundingClientRect();
    const tx = r.left + (ox + p.x * f) * (r.width / cw), ty = r.top + (oy + p.y * f) * (r.height / ch);
    const src = opts.from && opts.from.getBoundingClientRect ? opts.from.getBoundingClientRect() : card.querySelector('.sm-top span').getBoundingClientRect();
    const fx = src.left + src.width / 2, fy = src.top + src.height / 2;
    const s = new Image(); s.src = starSrc('l'); s.className = 'sm-fly'; s.alt = '';
    s.style.transform = 'translate(' + fx + 'px,' + fy + 'px)';
    document.body.appendChild(s);
    const landed = () => {
      s.remove();
      state.lit[c] = lit + 1; state.toPlace -= 1; count();
      flash = { c, i: lit, t0: performance.now() };
      const star = lit + 1, got = isPerk(lit) ? perkAt(c, star) : null;
      if (!got) { paintFoot(); return; }
      run = { c, t0: performance.now() + 150 };
      const show = (k) => { state.chosen[c + star] = k; paintFoot(perkCard([k])); tag(k); if (opts.lit) opts.lit(k); };
      if (got.length > 1 && !state.chosen[c + star]) paintFoot(perkCard(got, show));
      else show(state.chosen[c + star] || got[0]);
    };
    if (still()) { landed(); return; }
    const mx = (fx + tx) / 2, my = Math.min(fy, ty) - 60;
    play(s, [
      { transform: 'translate(' + fx + 'px,' + fy + 'px) scale(.6)' },
      { transform: 'translate(' + mx + 'px,' + my + 'px) scale(1.4)', offset: 0.5 },
      { transform: 'translate(' + tx + 'px,' + ty + 'px) scale(.8)' },
    ], { duration: 700, easing: 'cubic-bezier(.45,0,.4,1)' }).then(landed);
  };
  paintFoot();
  return { close };
}
