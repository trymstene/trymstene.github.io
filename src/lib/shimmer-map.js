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
// they havent heard of before"): its kind (an icon and a word a player knows) beside its name, and its line. 4 Oct 2026, of a
// card with two perks spelled out at once: "its easy to miss other text, like 'Next at star 12' … not all text is needed,
// some can also be tapped to get more information". So the card spells out ONE perk at a time: the one a star just lit; the
// next one is its name and kind on a row, and a tap opens what it does. The list works the same way, one open at a time.
const KIND_ICON = { wait: 'zap', more: 'party-popper-solid', lucky: 'star', easy: 'tools', banana: 'move', others: 'users', capstone: 'crown-solid' };
function perkLine(k, see, open) {
  const w = perkWords(k), d = document.createElement('div'); d.className = 'sm-pl' + (open ? ' is-open' : ' is-tap');
  const i = document.createElement('i'); i.className = 'sm-ki'; i.innerHTML = iconSvg(KIND_ICON[KIND[k]] || 'star', { size: 14 });
  const nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = w.name;
  const kd = document.createElement('em'); kd.textContent = (W.kinds && W.kinds[KIND[k]]) || ''; nm.appendChild(kd);
  const ln = document.createElement('div'); ln.className = 'ln'; ln.textContent = w.line;
  d.appendChild(i); d.appendChild(nm);
  if (!open) { const c = document.createElement('i'); c.className = 'sm-chev'; c.innerHTML = iconSvg('chevron-down', { size: 14 }); d.appendChild(c); }
  d.appendChild(ln);
  if (see) { const b = document.createElement('button'); b.type = 'button'; b.className = 'sm-btn sm-see'; b.textContent = W.map.see; b.onclick = (e) => { e.stopPropagation(); see(); }; d.appendChild(b); }
  if (!open) {
    d.setAttribute('role', 'button'); d.tabIndex = 0;
    const flip = () => {
      const was = d.classList.contains('is-open'), box = d.closest('.sm-lbody, .sm-next');
      if (box) for (const o of box.querySelectorAll('.sm-pl.is-open.is-tap')) o.classList.remove('is-open');   // one open at a time
      d.classList.toggle('is-open', !was);
    };
    d.addEventListener('click', flip);
    d.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } });
  }
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
.sm-next .sm-cap{color:#bfe3ff}
.sm-pl{display:grid;grid-template-columns:16px minmax(0,1fr) auto;column-gap:6px;row-gap:3px;align-items:center;min-width:0}
.sm-pl.is-tap{cursor:pointer}
.sm-pl:not(.is-open) .ln,.sm-pl:not(.is-open) .sm-see{display:none}
.sm-pl .sm-chev{grid-column:3;grid-row:1;display:block;width:14px;height:14px;color:#8fc4ff;transition:transform .15s}
.sm-pl .sm-chev svg{display:block;width:14px;height:14px}
.sm-pl.is-open .sm-chev{transform:rotate(180deg)}
.sm-pl:focus-visible{outline:2px solid #8fc4ff;outline-offset:2px}
.sm-pl .sm-ki{display:block;width:14px;height:14px;color:#8fc4ff}
.sm-pl .sm-ki svg{display:block;width:14px;height:14px}
.sm-pl .nm{font-size:.78rem;font-weight:900;color:#fff}
.sm-pl .nm em{font-style:normal;font-weight:800;font-size:.62rem;color:#8fc4ff;margin-left:6px;white-space:nowrap}
.sm-pl .ln{grid-column:2 / 4;font-size:.7rem;font-weight:700;color:#cfe6ff;line-height:1.3;white-space:normal}
.sm-pl .sm-see{grid-column:2 / 4;justify-self:end;height:22px;padding:0 7px;font-size:.62rem}
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
.sm-next.is-ready{background:linear-gradient(180deg,#14295a,#0b1730);box-shadow:inset 0 0 0 2px #bfe3ff,0 0 16px 3px rgba(127,191,255,.55)}
.sm-next.is-ready .sm-cap{color:#fff}
.sm-pips{display:flex;align-items:center;gap:6px;margin-top:2px}
.sm-pips img{width:9px;height:9px;image-rendering:pixelated;opacity:.28}
.sm-pips img.is-perk{width:13px;height:13px;opacity:.5}
.sm-pips img.is-on{opacity:1;filter:drop-shadow(0 0 3px rgba(127,191,255,.9))}
.sm-next.is-ready .sm-pips img.is-perk{opacity:1;animation:smPulse .9s ease-in-out infinite}
.sm-unlock{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;height:42px;margin-top:3px;background:linear-gradient(180deg,#fff,#cfe8ff);color:#0b1730;border:2px solid #000;box-shadow:2px 2px 0 #000,0 0 14px 3px rgba(127,191,255,.8);font:900 .9rem/1 inherit;white-space:nowrap;cursor:pointer;animation:smPulse 1.1s ease-in-out infinite}
.sm-unlock img{width:18px;height:18px;image-rendering:pixelated}
.sm-unlock[disabled]{opacity:.5;animation:none;cursor:default}
@keyframes smPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}
.sm-cel{position:absolute;inset:0;z-index:5;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at 50% 38%,#10224a,#060e22 70%);overflow:hidden}
.sm-rays{position:absolute;left:50%;top:40%;width:540px;height:540px;margin:-270px 0 0 -270px;pointer-events:none;background:repeating-conic-gradient(rgba(127,191,255,.17) 0 9deg,rgba(127,191,255,0) 9deg 18deg);-webkit-mask-image:radial-gradient(circle,#000 0 13%,transparent 40%);mask-image:radial-gradient(circle,#000 0 13%,transparent 40%);animation:smSpin 16s linear infinite}
.sm-cel.is-top .sm-rays{background:repeating-conic-gradient(rgba(255,226,140,.2) 0 9deg,rgba(255,226,140,0) 9deg 18deg)}
@keyframes smSpin{to{transform:rotate(360deg)}}
.sm-celin{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;gap:7px;padding:16px 14px;text-align:center;max-width:290px}
.sm-celin .sm-cap{font-size:.66rem;color:#8fd0ff}
.sm-badge{width:66px;height:66px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:radial-gradient(circle,#fff 0 30%,#cfe8ff 55%,#4f9dff 100%);border:3px solid #000;box-shadow:0 0 0 3px #bfe3ff,0 0 22px 6px rgba(127,191,255,.8);color:#0b1730}
.sm-cel.is-top .sm-badge{background:radial-gradient(circle,#fffdf0 0 30%,#ffe9a0 55%,#ffcf4a 100%);box-shadow:0 0 0 3px #ffe9a0,0 0 26px 8px rgba(255,214,90,.75)}
.sm-badge svg{display:block;width:34px;height:34px}
.sm-celin .n{font-size:1.35rem;font-weight:900;letter-spacing:.03em}
.sm-celin .k{font-style:normal;font-size:.7rem;font-weight:800;color:#8fc4ff}
.sm-celin .l{font-size:.8rem;font-weight:700;color:#dff0ff;line-height:1.35}
.sm-celin .sm-acts{justify-content:center;margin-top:4px}
.sm-ok{height:34px;padding:0 20px;font-size:.8rem}
.sm-spark{position:absolute;width:12px;height:12px;margin:-6px 0 0 -6px;image-rendering:pixelated;pointer-events:none;filter:drop-shadow(0 0 3px rgba(223,240,255,.9))}
.sm-pickbox{display:flex;flex-direction:column;gap:7px;width:100%;text-align:left}
@media (prefers-reduced-motion:reduce){.sm-unlock,.sm-rays,.sm-next.is-ready .sm-pips img.is-perk{animation:none}}
.sm-choice{display:block;width:100%;text-align:left;white-space:normal;padding:6px 7px;background:#13254d;border:2px solid #000;box-shadow:2px 2px 0 #000;cursor:pointer;font:inherit;min-width:0}
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
  let sel = Math.max(0, ORDER.indexOf(opts.select || ORDER[0])), live = true, flash = null, run = null, boom = null;
  const ready = (c) => { const lit = state.lit[c] || 0; return lit < STARS_EACH && lit % PER === PER - 1; };
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
      // the next star of the chosen one breathes, so you know where yours goes; one star from a perk, its star calls you
      if (on && lit < STARS_EACH) {
        const p = tipAt(c, lit + 1), px = Math.round(ox + p.x * f), py = Math.round(oy + p.y * f);
        if (ready(c)) {
          const k = still() ? 0.6 : 0.5 + 0.5 * Math.sin(now / 170), R = 7 + 4 * k, rot = still() ? 0 : now / 900;
          const gg = x.createRadialGradient(px, py, 0, px, py, R + 7); gg.addColorStop(0, 'rgba(223,240,255,' + (0.25 + 0.3 * k) + ')'); gg.addColorStop(1, 'rgba(127,191,255,0)');
          x.fillStyle = gg; x.fillRect(px - R - 7, py - R - 7, (R + 7) * 2, (R + 7) * 2);
          x.strokeStyle = 'rgba(255,255,255,' + (0.55 + 0.4 * k) + ')'; x.lineWidth = 1.5;
          x.beginPath(); x.arc(px + 0.5, py + 0.5, R, 0, Math.PI * 2); x.stroke();
          x.strokeStyle = 'rgba(191,227,255,' + (0.4 + 0.4 * k) + ')'; x.lineWidth = 1;
          for (let q = 0; q < 4; q++) { const a = rot + q * Math.PI / 2; x.beginPath(); x.moveTo(px + Math.cos(a) * (R + 2), py + Math.sin(a) * (R + 2)); x.lineTo(px + Math.cos(a) * (R + 8), py + Math.sin(a) * (R + 8)); x.stroke(); }
        } else {
          const k = still() ? 0.6 : 0.5 + 0.5 * Math.sin(now / 260);
          x.strokeStyle = 'rgba(191,227,255,' + (0.35 + 0.5 * k) + ')'; x.lineWidth = 1;
          x.beginPath(); x.arc(px + 0.5, py + 0.5, 4 + 2.5 * k, 0, Math.PI * 2); x.stroke();
        }
      }
      if (boom && boom.c === c) {   // a perk just lit: three rings of light out of its star, and a flash
        const t = (now - boom.t0) / 950;
        if (t < 1) {
          const q = FIG[c].pts[boom.j], px = ox + q[0] * f, py = oy + q[1] * f;
          for (let w = 0; w < 3; w++) { const tt = t - w * 0.14; if (tt <= 0) continue; x.strokeStyle = 'rgba(223,240,255,' + Math.max(0, 1 - tt) + ')'; x.lineWidth = 2.2 - w * 0.6; x.beginPath(); x.arc(px, py, 4 + tt * 34, 0, Math.PI * 2); x.stroke(); }
          const gg = x.createRadialGradient(px, py, 0, px, py, 24); gg.addColorStop(0, 'rgba(255,255,255,' + (1 - t) + ')'); gg.addColorStop(1, 'rgba(127,191,255,0)');
          x.fillStyle = gg; x.fillRect(px - 24, py - 24, 48, 48);
        }
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
  // ⭐ THE WAY TO A PERK, AND THE PERK (Trym, 4 Oct 2026: "theres not much exciting change visually that makes me see that im
  // about to unlock something, the button is the same, it stays at the same place … think game design here, how would you
  // build expectations when putting on stars, and how should it feel when you finally get the option to put on a perk"). Four
  // stars to a perk, as four pips that fill (the fourth is the perk). With one to go the next-perk box takes over: it glows, the
  // perk opens, and its own big pulsing Unlock button stands in for Place a star, while its star in the sky pulses wide. The
  // unlock bursts rings out of that star, and the card itself celebrates: turning light, the perk's badge, its name in
  // Shimmer's type, what it does.
  const paintFoot = (pop) => {
    const c = ORDER[sel], lit = state.lit[c] || 0, nm = W.constellations.find((q) => q.key === c);
    const nx = nextPerk(c, lit), rdy = !!nx && ready(c), can = state.toPlace > 0 && lit < STARS_EACH;
    foot.innerHTML = '';
    const row = document.createElement('div'); row.className = 'sm-row';
    const t = document.createElement('div'); t.className = 't';
    const b = document.createElement('b'); b.textContent = (nm ? nm.name : c) + ' · ' + lit + '/' + STARS_EACH;
    const s2 = document.createElement('span'); s2.textContent = nm ? nm.each || nm.area : '';
    t.appendChild(b); t.appendChild(s2);
    const go = document.createElement('button'); go.className = 'sm-go'; go.type = 'button';
    const gi = new Image(); gi.src = starSrc('m'); gi.alt = '';
    go.appendChild(gi); go.appendChild(document.createTextNode(W.map.place));
    go.disabled = !can;
    go.hidden = rdy;   // one star from a perk: the Unlock button below is the one to press
    go.onclick = () => place(go);
    row.appendChild(t); row.appendChild(go);
    foot.appendChild(row);
    const box = document.createElement('div'); box.className = 'sm-next' + (rdy ? ' is-ready' : '');
    const caprow = document.createElement('div'); caprow.className = 'sm-caprow';
    const cap = document.createElement('div'); cap.className = 'sm-cap';
    cap.textContent = !nx ? W.map.full : rdy ? W.map.nextOne : fillWords(W.map.nextIn, { n: nx[0] - lit }) + (nx.length > 2 ? ' · ' + W.map.pick : '');
    caprow.appendChild(cap); caprow.appendChild(button(W.map.all, () => showList()));
    box.appendChild(caprow);
    if (nx) for (const k of nx.slice(1)) box.appendChild(perkLine(k, seeFor(k), rdy && nx.length === 2));
    if (nx) box.appendChild(pips(lit, pop));
    if (rdy) {
      const u = document.createElement('button'); u.type = 'button'; u.className = 'sm-unlock';
      const ui = new Image(); ui.src = starSrc('l'); ui.alt = '';
      u.appendChild(ui);
      u.appendChild(document.createTextNode(nx.length > 2 ? W.map.choose : nx[0] === STARS_EACH ? W.map.unlockTop : fillWords(W.map.unlock, { perk: perkWords(nx[1]).name })));
      u.disabled = !can;
      u.onclick = () => place(u);
      box.appendChild(u);
    }
    foot.appendChild(box);
  };
  // the stars toward the next perk: four pips, the last the perk's own, bigger; the one just placed pops
  const pips = (lit, pop) => {
    const d = document.createElement('div'); d.className = 'sm-pips';
    for (let i = 1; i <= PER; i++) {
      const im = new Image(); im.alt = ''; im.src = starSrc(i === PER ? 'm' : 's');
      im.className = (i <= lit % PER ? 'is-on' : '') + (i === PER ? ' is-perk' : '');
      d.appendChild(im);
      if (pop && i === lit % PER && !still()) play(im, [{ scale: '0.3' }, { scale: '1.8', offset: 0.45 }, { scale: '1' }], { duration: 460, easing: 'ease-out' });
    }
    return d;
  };
  // 🎉 the perk is yours: the whole card celebrates it, and "Nice" hands the map back. The twentieth star asks first.
  const celebrate = (keys, star, done) => {
    const c = ORDER[sel], top = star === STARS_EACH;
    const o = document.createElement('div'); o.className = 'sm-cel' + (top ? ' is-top' : '');
    const rays = document.createElement('i'); rays.className = 'sm-rays';
    const inner = document.createElement('div'); inner.className = 'sm-celin';
    const head = document.createElement('div'); head.className = 'sm-cap';
    inner.appendChild(head); o.appendChild(rays); o.appendChild(inner);
    const show = (k) => {
      for (const n of inner.querySelectorAll('.sm-pickbox')) n.remove();
      head.textContent = top ? W.kinds.capstone : W.map.unlocked;
      const w = perkWords(k);
      const badge = document.createElement('div'); badge.className = 'sm-badge';
      badge.innerHTML = iconSvg(KIND_ICON[KIND[k]] || 'star', { size: 32 });
      const nmE = document.createElement('b'); nmE.className = 'n sh-txt'; nmE.textContent = w.name;
      const kd = document.createElement('em'); kd.className = 'k'; kd.textContent = (W.kinds && W.kinds[KIND[k]]) || '';
      const ln = document.createElement('div'); ln.className = 'l'; ln.textContent = w.line;
      const acts = document.createElement('div'); acts.className = 'sm-acts';
      const see = seeFor(k); if (see) acts.appendChild(button(W.map.see, see));
      const ok = document.createElement('button'); ok.type = 'button'; ok.className = 'sm-btn sm-ok'; ok.textContent = W.map.nice;
      ok.onclick = () => { o.remove(); done(); };
      acts.appendChild(ok);
      for (const n of [badge, nmE, kd, ln, acts]) inner.appendChild(n);
      requestAnimationFrame(() => { const or = o.getBoundingClientRect(), br = badge.getBoundingClientRect(); rays.style.left = (br.left + br.width / 2 - or.left) + 'px'; rays.style.top = (br.top + br.height / 2 - or.top) + 'px'; });
      if (!still()) {
        play(badge, [{ scale: '0', opacity: 0 }, { scale: '1.25', opacity: 1, offset: 0.6 }, { scale: '1', opacity: 1 }], { duration: 560, easing: 'ease-out' });
        [nmE, kd, ln, acts].forEach((n, i) => play(n, [{ translate: '0 10px', opacity: 0 }, { translate: '0 0', opacity: 1 }], { duration: 380, delay: 200 + i * 90, easing: 'ease-out', fill: 'backwards' }));
        sparks(o, badge, top ? 24 : 14);
      }
      tag(k); if (opts.lit) opts.lit(k);
    };
    if (keys.length > 1) {
      head.textContent = W.map.choose;
      const pick = document.createElement('div'); pick.className = 'sm-pickbox';
      for (const k of keys) { const bt = document.createElement('button'); bt.type = 'button'; bt.className = 'sm-choice'; bt.appendChild(perkLine(k, null, true)); bt.onclick = () => { state.chosen[c + star] = k; show(k); }; pick.appendChild(bt); }
      inner.appendChild(pick);
    } else show(keys[0]);
    card.appendChild(o);
    if (!still()) play(o, [{ opacity: 0 }, { opacity: 1 }], { duration: 280 });
  };
  const sparks = (o, badge, n) => requestAnimationFrame(() => {
    const or = o.getBoundingClientRect(), br = badge.getBoundingClientRect(), cx = br.left + br.width / 2 - or.left, cy = br.top + br.height / 2 - or.top;
    for (let i = 0; i < n; i++) {
      const sp = new Image(); sp.src = starSrc(i % 3 ? 's' : 'm'); sp.alt = ''; sp.className = 'sm-spark';
      sp.style.left = cx + 'px'; sp.style.top = cy + 'px'; o.appendChild(sp);
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.4, r = 64 + Math.random() * 74;
      play(sp, [{ translate: '0 0', scale: '0.4', opacity: 1 }, { translate: Math.cos(a) * r + 'px ' + Math.sin(a) * r + 'px', scale: '1.15', opacity: 1, offset: 0.7 }, { translate: Math.cos(a) * r * 1.12 + 'px ' + (Math.sin(a) * r * 1.12 + 12) + 'px', scale: '0.5', opacity: 0 }], { duration: 950 + Math.random() * 350, easing: 'cubic-bezier(.2,.8,.3,1)' }).then(() => sp.remove());
    }
  });
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
        const pl = perkLine(k, seeFor(k), false);
        if (st.length > 2 && state.chosen[c + st[0]] === k) pl.querySelector('.nm em').textContent += ' · ' + W.map.picked;
        li.appendChild(pl);
      }
      body.appendChild(li);
    }
    card.appendChild(list);
    const nextLi = body.querySelector('.is-next'); if (nextLi) body.scrollTop = Math.max(0, nextLi.offsetTop - body.offsetTop - 8);
  };
  const hideList = () => { if (list) { list.remove(); list = null; } card.querySelector('.sm-skywrap').hidden = false; foot.hidden = false; paintFoot(); };
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
    const big = isPerk(lit);
    const landed = () => {
      s.remove();
      state.lit[c] = lit + 1; state.toPlace -= 1; count();
      flash = { c, i: lit, t0: performance.now() };
      const star = lit + 1, got = big ? perkAt(c, star) : null;
      if (!got) { paintFoot(true); return; }
      boom = { c, j: star / PER, t0: performance.now() };
      run = { c, t0: performance.now() + 150 };
      paintFoot(false);
      const chosen = state.chosen[c + star];
      setTimeout(() => celebrate(chosen ? [chosen] : got, star, () => paintFoot(false)), still() ? 0 : 560);
    };
    if (still()) { landed(); return; }
    const mx = (fx + tx) / 2, my = Math.min(fy, ty) - 60;
    play(s, [
      { transform: 'translate(' + fx + 'px,' + fy + 'px) scale(.6)' },
      { transform: 'translate(' + mx + 'px,' + my + 'px) scale(' + (big ? 2.2 : 1.4) + ')', offset: 0.5 },
      { transform: 'translate(' + tx + 'px,' + ty + 'px) scale(.8)' },
    ], { duration: big ? 820 : 700, easing: 'cubic-bezier(.45,0,.4,1)' }).then(landed);
  };
  paintFoot();
  // the bench earns XP while the map is open: a level is a new star to place, said at once
  return { close, refresh() { count(); prog(); const can = state.toPlace > 0 && (state.lit[ORDER[sel]] || 0) < STARS_EACH; for (const g of foot.querySelectorAll('.sm-go, .sm-unlock')) g.disabled = !can; } };
}
