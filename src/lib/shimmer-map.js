// 🗺 THE STAR MAP (3 Oct 2026, the perk bench's; the design is the Claude Doc "Shimmer & the Star Map"). Every Shimmer level
// is a star you place in one of six constellations: five drawn after a thing players know from an area (a sunflower, a hen,
// a ghost, a fish, a record) and the banana itself. Its forty stars draw the figure as you place them. Every fourth star is
// a bigger perk star, and the one that lights it lights the perk. Nothing here saves: it is the look, played on the bench.
import { WORDS as W, perkWords, starSrc, play, still, tag, els } from './shimmer-fx.js';
import { fillWords } from './fill-words.js';
import { LADDER, ORDER, STARS_EACH, KIND } from '../data/shimmer.js';
// ⚠️ the icons come through pixel-icons.js, the chunk every script already shares: an icon imported here on its own was SPLIT
// into a chunk of its own beside the player code that also uses it, and the bench cost players 1.4 KB (3 Oct 2026)
import { iconSvg } from './pixel-icons.js';

// 💬 A PERK IS SAID BY WHAT IT DOES (Trym, 3 Oct 2026: "no user understands what a skill / perc is by just reading a perk-name
// they havent heard of before"). Wherever the map names a perk it shows its kind (an icon and a word a player knows) and its
// line: the next one under the chosen constellation, every one in its list, and both sides of a choice.
const KIND_ICON = { wait: 'zap', more: 'party-popper-solid', lucky: 'star', easy: 'tools', banana: 'move', seen: 'sparkles', others: 'users', capstone: 'crown-solid' };
function perkLine(k, see) {
  const w = perkWords(k), d = document.createElement('div'); d.className = 'sm-pl';
  const i = document.createElement('i'); i.className = 'sm-ki'; i.innerHTML = iconSvg(KIND_ICON[KIND[k]] || 'star', { size: 14 });
  const nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = w.name;
  const kd = document.createElement('em'); kd.textContent = (W.kinds && W.kinds[KIND[k]]) || ''; nm.appendChild(kd);
  const ln = document.createElement('div'); ln.className = 'ln'; ln.textContent = w.line;
  d.appendChild(i); d.appendChild(nm);
  if (see) { const b = document.createElement('button'); b.type = 'button'; b.className = 'sm-btn sm-see'; b.textContent = W.map.see; b.onclick = see; d.appendChild(b); }
  d.appendChild(ln);
  return d;
}

// ✏️ EACH SIGN IS TEN STARS PLACED BY HAND (Trym, 3 Oct 2026, of the first map: "the star signs looks a bit cluttery, dots looks
// a bit random … parts of the shape has much dot-clutter here and there"). Forty dots spread along outlines bunched wherever two
// strokes met. Now a sign is a root and ten PERK stars, in order, that draw its object like a real star chart, and the forty
// Shimmer stars are the LINE between them: each star you place lights a quarter of the way to the next perk star, the fourth
// lights the perk star itself. `deco` are the lines that finish the picture (a stem, a ring closed), lit once both their
// stars are, and `dots` are the small marks no star stands on (a ghost's eyes). A 100 × 80 cell; segments kept within 14–34
// so the quarters read evenly. 4 Oct 2026: the signs are things that are IN the game (no can, barn, clock tower or disco ball is).
const FIG = {
  sunflower: { pts: [[50, 79], [64, 64], [50, 44], [63.5, 39.1], [70.7, 26.6], [68.2, 12.5], [57.2, 3.3], [42.8, 3.3], [31.8, 12.5], [29.3, 26.6], [36.5, 39.1]], deco: [[10, 2], [0, 2]], dots: [[50, 18], [55, 23], [50, 28], [45, 23]] },
  hen: { pts: [[44, 79], [44, 63], [26, 55], [20, 38], [8, 30], [22, 18], [36, 28], [58, 30], [78, 12], [86, 34], [70, 58]], deco: [[10, 1]], dots: [[21, 27]] },
  ghost: { pts: [[40, 66], [28, 77], [26, 52], [30, 30], [42, 13], [58, 11], [70, 26], [74, 50], [72, 77], [60, 66], [50, 77]], deco: [[10, 0]], dots: [[42, 34], [58, 34]] },
  fish: { pts: [[14, 40], [30, 26], [47, 23], [63, 27], [76, 36], [94, 22], [86, 40], [94, 58], [76, 44], [60, 54], [36, 56]], deco: [[10, 0]], dots: [[24, 36]] },
  vinyl: { pts: [[90, 4], [84, 26], [70.4, 31.1], [70.4, 48.9], [59, 62.5], [41.5, 65.6], [26.1, 56.7], [20, 40], [26.1, 23.3], [41.5, 14.4], [59, 17.5]], deco: [[10, 2]], dots: [[46, 40]] },
  banana: { pts: [[22, 10], [24, 28], [30, 46], [42, 60], [60, 68], [80, 64], [94, 52], [78, 50], [60, 52], [46, 42], [38, 26]], deco: [[10, 1]] },
};
const PER = STARS_EACH / 10;   // four Shimmer stars to each perk star
const at = (key, i) => { const q = FIG[key].pts[i]; return { x: q[0], y: q[1] }; };
// where the n-th star placed lands (1-based): along the line from one perk star to the next
export function tipAt(key, n) {
  const k = Math.max(0, Math.min(9, Math.floor((n - 1) / PER))), t = (((n - 1) % PER) + 1) / PER;
  const a = at(key, k), b = at(key, k + 1);
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
const isPerk = (i) => (i + 1) % PER === 0;
const perkAt = (key, star) => { const st = LADDER[key].steps.find((x) => x[0] === star); return st ? st.slice(1) : null; };
const nextPerk = (key, lit) => LADDER[key].steps.find((x) => x[0] > lit) || null;
const nodeLit = (i, lit) => (i === 0 ? lit > 0 : lit >= i * PER);

// the sign, drawn into a canvas context at (ox, oy) with a scale: its picture always there, faint; the line your stars have
// drawn lit, and the perk stars you reached shining. Shared with the night sky over the square (a finished constellation lights
// it), so it is the same drawing everywhere.
export function drawFigure(x, key, lit, ox, oy, f, opts = {}) {
  const F = FIG[key], P = (i) => [ox + F.pts[i][0] * f, oy + F.pts[i][1] * f], dim = opts.dim ? 0.5 : 1;
  x.save();
  x.lineCap = 'round';
  // the picture, waiting: thin dashes, the finishing lines fainter still
  x.setLineDash([2, 3]); x.lineWidth = 1;
  x.strokeStyle = 'rgba(52,82,124,.85)';
  for (let k = 0; k < 10; k++) { const [ax, ay] = P(k), [bx, by] = P(k + 1); x.beginPath(); x.moveTo(ax, ay); x.lineTo(bx, by); x.stroke(); }
  x.strokeStyle = 'rgba(52,82,124,.5)';
  for (const [i, j] of F.deco) { const [ax, ay] = P(i), [bx, by] = P(j); x.beginPath(); x.moveTo(ax, ay); x.lineTo(bx, by); x.stroke(); }
  x.setLineDash([]);
  // the line your stars drew: a soft glow under a bright thread, a quarter of a segment a star
  for (let k = 0; k < 10; k++) {
    const fr = Math.max(0, Math.min(1, (lit - k * PER) / PER));
    if (!fr) continue;
    const [ax, ay] = P(k), [bx, by] = P(k + 1), ex = ax + (bx - ax) * fr, ey = ay + (by - ay) * fr;
    x.strokeStyle = 'rgba(110,175,255,' + 0.28 * dim + ')'; x.lineWidth = 3.2;
    x.beginPath(); x.moveTo(ax, ay); x.lineTo(ex, ey); x.stroke();
    x.strokeStyle = 'rgba(214,236,255,' + 0.95 * dim + ')'; x.lineWidth = 1.2;
    x.beginPath(); x.moveTo(ax, ay); x.lineTo(ex, ey); x.stroke();
  }
  for (const [i, j] of F.deco) {
    if (!nodeLit(i, lit) || !nodeLit(j, lit)) continue;
    const [ax, ay] = P(i), [bx, by] = P(j);
    x.strokeStyle = 'rgba(150,200,255,' + 0.6 * dim + ')'; x.lineWidth = 1;
    x.beginPath(); x.moveTo(ax, ay); x.lineTo(bx, by); x.stroke();
  }
  // the stars: the root a small point, the ten perk stars crosses of light once reached, small hollow crosses until then
  for (let i = 0; i <= 10; i++) {
    const [fx, fy] = P(i), px = Math.round(fx), py = Math.round(fy), on = nodeLit(i, lit);
    if (i === 0) { x.fillStyle = on ? 'rgba(214,236,255,' + dim + ')' : '#34527c'; x.fillRect(px - 1, py - 1, 2, 2); continue; }
    if (on) {
      const g = x.createRadialGradient(px + 0.5, py + 0.5, 0, px + 0.5, py + 0.5, 9);
      g.addColorStop(0, 'rgba(200,230,255,' + 0.55 * dim + ')'); g.addColorStop(1, 'rgba(79,157,255,0)');
      x.fillStyle = g; x.fillRect(px - 9, py - 9, 19, 19);
      x.globalAlpha = dim;
      x.fillStyle = '#bfe3ff'; x.fillRect(px, py - 3, 1, 7); x.fillRect(px - 3, py, 7, 1);
      x.fillStyle = '#ffffff'; x.fillRect(px - 1, py - 1, 3, 3);
      x.globalAlpha = 1;
    } else {
      x.fillStyle = '#4a6a98'; x.fillRect(px, py - 2, 1, 5); x.fillRect(px - 2, py, 5, 1);
      x.fillStyle = '#0b1730'; x.fillRect(px, py, 1, 1);
    }
  }
  for (const [dx, dy] of F.dots || []) { x.fillStyle = lit > 0 ? 'rgba(214,236,255,' + 0.9 * dim + ')' : '#34527c'; x.fillRect(Math.round(ox + dx * f) - 1, Math.round(oy + dy * f) - 1, 2, 2); }
  // the tip of the line, mid-way between two perk stars: the last star you placed, a small bright point
  if (lit > 0 && lit < STARS_EACH && lit % PER) { const q = tipAt(key, lit), tx = Math.round(ox + q.x * f), ty = Math.round(oy + q.y * f); x.fillStyle = 'rgba(255,255,255,' + dim + ')'; x.fillRect(tx - 1, ty - 1, 2, 2); }
  x.restore();
}
export const figurePoint = (key, n) => tipAt(key, n);

const CSS = `
.sm-veil{position:absolute;inset:0;z-index:2190;background:rgba(0,0,0,.38)}
.sm-card{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:2191;width:min(330px,calc(100% - 16px));max-height:calc(100% - 16px);overflow:auto;box-sizing:border-box;background:#0b1730;color:#cfe6ff;border:3px solid #000;box-shadow:3px 3px 0 #000,0 0 22px 4px rgba(60,130,255,.25);border-radius:4px;padding:10px 10px 10px;font-family:inherit}
.sm-x{position:absolute;right:6px;top:4px;width:28px;height:28px;border:0;background:none;color:#8fb6e6;font:900 18px/1 inherit;cursor:pointer}
.sm-top{display:flex;align-items:baseline;gap:8px;padding-right:26px}
.sm-top b{font-size:1.02rem;font-weight:900;color:#fff;letter-spacing:.05em}
.sm-top span{font-size:.7rem;font-weight:800;color:#8fc4ff;white-space:nowrap}
.sm-prog{display:flex;align-items:center;gap:7px;margin-top:6px;font-size:.66rem;font-weight:800;color:#8fc4ff}
.sm-prog b{color:#dff0ff;font-weight:900;white-space:nowrap}
.sm-prog>span:last-child{white-space:nowrap}
.sm-pbar{flex:1;min-width:40px;height:6px;background:rgba(14,30,66,.95);border:1px solid #000;overflow:hidden}
.sm-pbar i{display:block;height:100%;width:100%;transform-origin:0 50%;transform:scaleX(0);background:linear-gradient(90deg,#4f9dff,#dff0ff);transition:transform .3s cubic-bezier(.25,.9,.3,1)}
.sm-sky{display:block;margin:7px 0 8px;width:100%;border:2px solid #000;image-rendering:pixelated;touch-action:manipulation;cursor:pointer}
.sm-foot{display:flex;flex-direction:column;gap:7px;padding:8px 9px;background:#0e1d3d;color:#cfe6ff;border:2px solid #000;border-radius:3px}
.sm-next{display:flex;flex-direction:column;gap:5px;padding:7px 8px;background:#0b1730;border:2px solid #000;border-radius:3px;box-shadow:inset 0 0 0 1px rgba(127,191,255,.45)}
.sm-cap{font-size:.6rem;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:#6f93c2}
.sm-pl{display:grid;grid-template-columns:16px minmax(0,1fr) auto;column-gap:6px;row-gap:1px;align-items:center;min-width:0}
.sm-pl .sm-ki{display:block;width:14px;height:14px;color:#8fc4ff}
.sm-pl .sm-ki svg{display:block;width:14px;height:14px}
.sm-pl .nm{font-size:.78rem;font-weight:900;color:#fff}
.sm-pl .nm em{font-style:normal;font-weight:800;font-size:.62rem;color:#8fc4ff;margin-left:6px;white-space:nowrap}
.sm-pl .ln{grid-column:2 / 4;font-size:.7rem;font-weight:700;color:#cfe6ff;line-height:1.3;white-space:normal}
.sm-pl .sm-see{grid-column:3;grid-row:1;height:22px;padding:0 7px;font-size:.62rem}
.sm-caprow{display:flex;align-items:center;justify-content:space-between;gap:8px}
.sm-caprow .sm-btn{height:22px;padding:0 7px;font-size:.62rem}
.sm-lbody{display:flex;flex-direction:column;gap:6px;overflow:auto;min-height:0}
.sm-acts{display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap}
.sm-btn{height:28px;padding:0 9px;background:#13254d;color:#dff0ff;border:2px solid #000;box-shadow:2px 2px 0 #000;font:900 .68rem/1 inherit;white-space:nowrap;cursor:pointer}
.sm-list{display:flex;flex-direction:column;gap:6px;margin:7px 0 0;min-height:0}
.sm-lhead{display:flex;align-items:center;gap:8px;font-size:.78rem;font-weight:900;color:#fff}
.sm-li{display:flex;flex-direction:column;gap:5px;padding:7px 8px;background:#0e1d3d;border:2px solid #000;border-radius:3px}
.sm-li.is-lit{box-shadow:inset 0 0 0 1px rgba(191,227,255,.7)}
.sm-li.is-next{box-shadow:inset 0 0 0 2px #4f9dff,0 0 10px 1px rgba(80,150,255,.35)}
.sm-li.is-dim{opacity:.62}
.sm-li .st{display:flex;align-items:center;gap:6px;font-size:.6rem;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#6f93c2}
.sm-li .st b{color:#dff0ff}
.sm-li .st img{width:12px;height:12px;image-rendering:pixelated}
.sm-row{display:flex;gap:9px;align-items:center}
.sm-row .t{flex:1;min-width:0}
.sm-row .t b{display:block;font-size:.8rem;font-weight:900;color:#fff}
.sm-row .t span{display:block;font-size:.68rem;font-weight:700;color:#8fb6e6}
.sm-go{flex:none;height:36px;display:flex;align-items:center;gap:6px;padding:0 11px;background:#111;color:#8fd0ff;border:2px solid #000;box-shadow:2px 2px 0 #000;font:900 .76rem/1 inherit;white-space:nowrap;cursor:pointer}
.sm-go img{width:14px;height:14px;image-rendering:pixelated}
.sm-go[disabled]{opacity:.45;cursor:default}
.sm-skywrap{position:relative;margin:7px 0 8px}
.sm-skywrap .sm-sky{margin:0}
.sm-perk{position:absolute;left:6px;right:6px;bottom:6px;display:flex;flex-direction:column;gap:3px;padding:8px 9px;background:rgba(8,16,40,.94);border:2px solid #000;border-radius:3px;box-shadow:inset 0 0 0 1px rgba(127,191,255,.6),0 0 16px 2px rgba(60,130,255,.35)}
.sm-perk .n{display:flex;align-items:center;gap:6px;font-size:.92rem;font-weight:900;letter-spacing:.03em}
.sm-perk .n img{width:16px;height:16px;image-rendering:pixelated;filter:drop-shadow(0 0 3px rgba(127,191,255,.9))}
.sm-perk .l{font-size:.72rem;font-weight:700;color:#cfe6ff;line-height:1.35}
.sm-choice{display:block;width:100%;text-align:left;white-space:normal;padding:6px 7px;background:#13254d;border:2px solid #000;box-shadow:2px 2px 0 #000;cursor:pointer;font:inherit;min-width:0}
.sm-perk .sm-pl .ln{font-size:.68rem}
.sm-fly{position:fixed;left:0;top:0;z-index:99999;width:18px;height:18px;margin:-9px 0 0 -9px;pointer-events:none;image-rendering:pixelated;filter:drop-shadow(0 0 3px #fff) drop-shadow(0 0 7px rgba(79,157,255,.9))}
`;
let styled = false;
const style = () => { if (styled) return; styled = true; const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s); };

// 🗺 open the map. `state` is the bench's: { lit: {sunflower: 15, …}, toPlace: 12, chosen: {} }, mutated as stars are placed;
// `from` is where a placed star flies from (the HUD's Shimmer pill)
export function openMap(state, opts = {}) {
  style();
  const { view } = els(); if (!view) return null;
  for (const o of view.querySelectorAll(':scope > .sm-veil, :scope > .sm-card')) o.remove();
  const veil = document.createElement('div'); veil.className = 'sm-veil';
  const card = document.createElement('div'); card.className = 'sm-card'; card.setAttribute('role', 'dialog');
  card.innerHTML = '<button class="sm-x" type="button" aria-label="close">×</button><div class="sm-top"><b></b><span></span></div><div class="sm-prog"><b></b><span class="sm-pbar"><i></i></span><span></span></div><div class="sm-skywrap"><canvas class="sm-sky"></canvas></div><div class="sm-foot"></div>';
  view.appendChild(veil); view.appendChild(card);
  // ⚠️ a tap on the map is the map's: it bubbled to the area under it, and the park opened a flower spot behind the card
  for (const el of [veil, card]) for (const t of ['pointerdown', 'pointerup', 'click', 'touchstart']) el.addEventListener(t, (e) => e.stopPropagation());
  const close = () => { live = false; veil.remove(); card.remove(); if (opts.closed) opts.closed(); };
  card.querySelector('.sm-x').onclick = close; veil.onclick = close;
  const cv = card.querySelector('.sm-sky'), foot = card.querySelector('.sm-foot');
  card.querySelector('.sm-top b').textContent = W.map.title;
  const count = () => { card.querySelector('.sm-top span').textContent = state.toPlace > 0 ? fillWords(W.map.toPlace, { n: state.toPlace }) : W.map.none; };
  // ⭐ WHERE THE STARS COME FROM, said on the map itself: your Shimmer level (every level is a star), its XP bar, and how much XP
  // is left to the next one — Trym read a handful of stars collected here and there before this line was here (3 Oct 2026)
  const prog = () => {
    const pr = card.querySelector('.sm-prog'), need = opts.step ? opts.step(state.level) : 0;
    if (!need || state.level == null) { pr.hidden = true; return; }
    pr.hidden = false;
    pr.querySelector('b').textContent = fillWords(W.map.level, { n: state.level });
    pr.querySelector('.sm-pbar i').style.transform = 'scaleX(' + Math.max(0, Math.min(1, (state.xp || 0) / need)) + ')';
    pr.lastChild.textContent = fillWords(W.map.nextStar, { xp: Math.max(0, Math.ceil(need - (state.xp || 0))).toLocaleString('en-US') });
  };
  count(); prog();
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
  let sel = Math.max(0, ORDER.indexOf(opts.select || ORDER[0])), live = true, flash = null, run = null;
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
        const p = tipAt(c, lit + 1), px = Math.round(ox + p.x * f), py = Math.round(oy + p.y * f);
        const k = still() ? 0.6 : 0.5 + 0.5 * Math.sin(now / 260);
        x.strokeStyle = 'rgba(191,227,255,' + (0.35 + 0.5 * k) + ')'; x.lineWidth = 1;
        x.beginPath(); x.arc(px + 0.5, py + 0.5, 4 + 2.5 * k, 0, Math.PI * 2); x.stroke();
      }
      if (flash && flash.c === c) {   // a star just placed: a ring of light goes out from it
        const t = (now - flash.t0) / 520;
        if (t < 1) { const p = tipAt(c, flash.i + 1), px = ox + p.x * f, py = oy + p.y * f; x.strokeStyle = 'rgba(223,240,255,' + (1 - t) + ')'; x.lineWidth = 2; x.beginPath(); x.arc(px, py, 3 + t * 16, 0, Math.PI * 2); x.stroke(); }
      }
      if (run && run.c === c) {   // a perk or the capstone: the light runs the figure
        const t = (now - run.t0) / 900, k = Math.floor(t * lit);
        if (t < 1.2) { const k = Math.floor(t * 10); for (let j = Math.max(1, k - 1); j <= Math.min(10, k + 1); j++) { if (!nodeLit(j, lit)) continue; const q = FIG[c].pts[j], px = ox + q[0] * f, py = oy + q[1] * f, gg = x.createRadialGradient(px, py, 0, px, py, 12); gg.addColorStop(0, 'rgba(255,255,255,.95)'); gg.addColorStop(1, 'rgba(127,191,255,0)'); x.fillStyle = gg; x.fillRect(px - 13, py - 13, 26, 26); } }
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
    const s2 = document.createElement('span'); s2.textContent = nm ? nm.each || nm.area : '';
    t.appendChild(b); t.appendChild(s2);
    const go = document.createElement('button'); go.className = 'sm-go'; go.type = 'button';
    const gi = new Image(); gi.src = starSrc('m'); gi.alt = '';
    go.appendChild(gi); go.appendChild(document.createTextNode(W.map.place));
    go.disabled = !(state.toPlace > 0) || lit >= STARS_EACH;
    go.onclick = () => place(go);
    row.appendChild(t); row.appendChild(go);
    foot.appendChild(row);
    // what the next perk star gives, in words a player knows: its kind and its line, not only its name
    const box = document.createElement('div'); box.className = 'sm-next';
    const caprow = document.createElement('div'); caprow.className = 'sm-caprow';
    const cap = document.createElement('div'); cap.className = 'sm-cap';
    cap.textContent = nx ? fillWords(W.map.nextAt, { at: nx[0] }) + (nx.length > 2 ? ' · ' + W.map.pick : '') : W.map.full;
    caprow.appendChild(cap); caprow.appendChild(button(W.map.all, () => showList()));
    box.appendChild(caprow);
    if (nx) for (const k of nx.slice(1)) box.appendChild(perkLine(k, seeFor(k)));
    foot.appendChild(box);
  };
  const button = (label, fn) => { const bt = document.createElement('button'); bt.type = 'button'; bt.className = 'sm-btn'; bt.textContent = label; bt.onclick = fn; return bt; };
  const seeFor = (k) => (opts.canSee && opts.canSee(k) ? () => { close(); opts.see(k); } : null);
  // 📜 EVERY PERK OF THE CHOSEN CONSTELLATION, what each does: yours (lit), the next, and the ones still dark
  let list = null;
  const showList = () => {
    const c = ORDER[sel], lit = state.lit[c] || 0, nm = W.constellations.find((q) => q.key === c);
    const wrap = card.querySelector('.sm-skywrap');
    const h = wrap.offsetHeight + foot.offsetHeight;
    wrap.hidden = true; foot.hidden = true;
    if (list) list.remove();
    list = document.createElement('div'); list.className = 'sm-list'; list.style.maxHeight = h + 'px';
    const body = document.createElement('div'); body.className = 'sm-lbody';
    const head = document.createElement('div'); head.className = 'sm-lhead';
    head.appendChild(button(W.map.back, hideList));
    const hn = document.createElement('span'); hn.textContent = (nm ? nm.name : c) + ' · ' + lit + '/' + STARS_EACH; head.appendChild(hn);
    list.appendChild(head); list.appendChild(body);
    const nx = nextPerk(c, lit);
    for (const st of LADDER[c].steps) {
      const li = document.createElement('div');
      li.className = 'sm-li ' + (st[0] <= lit ? 'is-lit' : nx && nx[0] === st[0] ? 'is-next' : 'is-dim');
      const top2 = document.createElement('div'); top2.className = 'st';
      const si = new Image(); si.src = starSrc(st[0] <= lit ? 'm' : 's'); si.alt = '';
      const sb = document.createElement('b'); sb.textContent = fillWords(W.map.star, { n: st[0] });
      top2.appendChild(si); top2.appendChild(sb);
      if (st[0] <= lit) top2.appendChild(document.createTextNode(' · ' + W.map.litNote));
      if (st.length > 2) top2.appendChild(document.createTextNode(' · ' + W.map.pick));
      li.appendChild(top2);
      for (const k of st.slice(1)) {
        const pl = perkLine(k, seeFor(k));
        if (st.length > 2 && state.chosen[c + st[0]] === k) pl.querySelector('.nm em').textContent += ' · ' + W.map.picked;
        li.appendChild(pl);
      }
      body.appendChild(li);
    }
    card.appendChild(list);
    const nextLi = body.querySelector('.is-next'); if (nextLi) body.scrollTop = Math.max(0, nextLi.offsetTop - body.offsetTop - 8);
  };
  const hideList = () => { if (list) { list.remove(); list = null; } card.querySelector('.sm-skywrap').hidden = false; foot.hidden = false; paintFoot(); };
  // the perk a star just lit: its name in Shimmer's own type, and what it does; at the 20th, the choice of two
  const perkCard = (keys, onPick) => {
    const d = document.createElement('div'); d.className = 'sm-perk';
    if (keys.length > 1) {   // the choice: both sides, each by what it does, each a button
      const cap = document.createElement('div'); cap.className = 'sm-cap'; cap.textContent = W.map.pick;
      d.appendChild(cap);
      for (const k of keys) { const bt = document.createElement('button'); bt.type = 'button'; bt.className = 'sm-choice'; bt.appendChild(perkLine(k)); bt.onclick = () => onPick(k); d.appendChild(bt); }
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
    const p = tipAt(c, lit + 1), { ox, oy } = cell(sel), r = cv.getBoundingClientRect();
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
  // the bench earns XP while the map is open: a level is a new star to place, said at once
  return { close, refresh() { count(); prog(); const go = foot.querySelector('.sm-go'); if (go) go.disabled = !(state.toPlace > 0) || (state.lit[ORDER[sel]] || 0) >= STARS_EACH; } };
}
