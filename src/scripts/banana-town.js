// 🏘️ BANANA TOWN — the hidden prototype chassis (7 Sep 2026).
//
// A walkable square baked from the pack at the world's prop scale
// (tools/build-town-scene.py), so the city plan can be judged on foot before a
// line of the real area is written. Nothing here is wired: doors and people
// say what they will be. The page is noindexed and linked from nowhere.
// Chassis = the park's essentials only: camera on both axes, tap-to-walk +
// keys, foot colliders, y-sorted overlays, the shared HUD.
import { drawComposite, assetsReady, NFRAMES, BASE_CYCLE_S } from '../lib/banana-engine.js';
import { mountHud } from '../lib/world-hud.js';
import { initTravel } from './world-travel.js';
import { iconSvg } from '../lib/pixel-icons.js';
import { WORLD, BOUND, SPAWN, DOORS, OVERLAYS, SPOTS, NPCS, OB_RECTS, OB_CIRCLES, FOUNTAIN } from './town-geo.js';

const view = document.getElementById('twView');
const world = document.getElementById('twWorld');
const toastEl = document.getElementById('twToast');
const W = WORLD.w, H = WORLD.h;
const pct = (v, span) => (v / span * 100) + '%';

// ---- the props: y-sorted overlays, % of the world so they ride the camera free
const BOXES = [];
for (const [fn, x, y, w, h, base] of OVERLAYS) {
  const img = new Image();
  img.src = '/assets/town/' + fn; img.className = 'tw-ov'; img.draggable = false; img.alt = '';
  img.style.left = pct(x, W); img.style.top = pct(y, H); img.style.width = pct(w, W);
  img.style.zIndex = String(100 + base);
  world.appendChild(img);
  BOXES.push([x, y, x + w, y + h, base]);
}

// ---- ⛲ the fountain: the pack's six frames, one file each, CSS-shown in turn
if (FOUNTAIN && FOUNTAIN.length) {
  const [fx, fbase, fw, fh, n] = FOUNTAIN;
  const f = document.createElement('div');
  f.className = 'tw-fountain';
  f.style.left = pct(fx - fw / 2, W); f.style.top = pct(fbase - fh, H); f.style.width = pct(fw, W);
  f.style.aspectRatio = fw + ' / ' + fh;
  // six frames in ONE box, one visible at a time (the keyframes in town.astro, offset per
  // frame): a background strip stepped by position walked sideways at fractional widths
  for (let i = 0; i < n; i++) {
    const im = document.createElement('img');
    im.src = '/assets/town/a-fountain-' + i + '.png'; im.alt = ''; im.decoding = 'async';
    im.style.animationDelay = (i * (0.9 / n)).toFixed(3) + 's';   // positive: frame i takes the i-th sixth, in drawn order
    f.appendChild(im);
  }
  f.style.zIndex = String(100 + fbase);
  world.appendChild(f);
  BOXES.push([fx - fw / 2, fbase - fh, fx + fw / 2, fbase, fbase]);
}

// ---- what each door is (the plan's words) and the plank that names it
const ABOUT = {
  hall: ['TOWN HALL', 96, 'Town Hall. Nib’s desk and the big book, inside the clock tower. Chapter two starts here. Not built yet.'],
  post: ['', 0, 'Post Office. Stamp sends stock postcards; your mailbox is by the door. Not built yet.'],
  store: ['GENERAL STORE', 104, 'General Store. Pip sells fireworks, lures and duck bread. Not built yet.'],
  bank: ['BANK', 118, 'The bank. It is an ATM. Not built yet.'],
  print: ['STICKERS', 104, 'The print shop. The real sticker packs in the window. Not built yet.'],
  cafe: ['CAFÉ', 220, 'The Coffee Cup. Bean pours today’s fortune and a rumour about tomorrow’s prices. Not built yet.'],
  board: ['NOTICES', 132, 'The notice board. Board of Works projects, today’s wants, Monday’s results. Not built yet.'],
  exchange: ['THE EXCHANGE', 154, 'The Exchange. Fig Jr. buys eggs, milk and wool at today’s price. Not built yet.'],
  wheel: ['WHEEL OF PEEL', 154, 'The Wheel of Peel. One free spin a day, then a few coins a spin. Not built yet.'],
  lot: ['COMING SOON', 84, 'The worksite lot. The office and the arcade, later.'],
  condo: ['THE BUNCH', 100, 'The Bunch. Real players in its windows. Not built yet.'],
  cart: ['', 0, 'The fruit cart. Duck bread, later.'],
  plinth: ['', 0, 'The plinth. The Board of Works’ first statue goes here.'],
  fountain: ['', 0, 'The fountain. It works.'],
};
for (const [key, spot] of Object.entries(SPOTS)) {
  const a = ABOUT[key];
  if (!a || !a[0]) continue;
  const p = document.createElement('div');
  p.className = 'tw-plank';
  p.textContent = a[0];
  p.style.left = pct(spot.x, W); p.style.top = pct(spot.y - a[1], H);
  p.style.zIndex = String(100 + spot.y + 3);
  p.addEventListener('click', (e) => { e.stopPropagation(); if (!openFor(key)) say(a[2]); });
  world.appendChild(p);
}
const park = document.createElement('div');
park.className = 'tw-plank tw-plank--way';
park.textContent = 'THE PARK ↓';
park.style.left = pct(DOORS.south.x, W); park.style.top = pct(H - 60, H); park.style.zIndex = String(100 + H);
world.appendChild(park);

// ---- the people: engine bananas standing where the plan puts them
const NPC_LOOK = { nib: { hat: 'tophat' }, pip: { hat: 'backwardscap' }, stamp: { hat: 'buckethat' }, figjr: { hat: 'cowboy' },
  spinner: { hat: 'jester' }, bean: { hat: 'beanieprop' }, dot: {}, moss: { hat: 'woolbeanie' } };
const NPC_SAY = {
  nib: 'Nib: “Ah. You. The Mayor said somebody might come by the hall.”',
  pip: 'Pip: “Fireworks, lures, duck bread. Every one of them the last one.”',
  stamp: 'Stamp: “Postcards go out, mail comes in. I weigh everything.”',
  figjr: 'Fig Jr.: “Eggs are up today. Or down. One of those.”',
  spinner: 'Spinner: “One free spin a day. The pot is watching you.”',
  bean: 'Bean: “Your fortune is in the cup. So is the coffee.”',
  dot: 'Dot: “Have you seen a fish? A real one?”',
  moss: 'Moss: “Leaves. Again.”',
};
const npcEls = [];
for (const [key, x, y, name] of NPCS) {
  const el = document.createElement('div');
  el.className = 'tw-npc';
  el.style.left = pct(x, W); el.style.top = pct(y, H); el.style.zIndex = String(100 + y);
  const cv = document.createElement('canvas'); cv.width = cv.height = 150;
  const tag = document.createElement('span'); tag.textContent = name;
  el.appendChild(cv); el.appendChild(tag);
  world.appendChild(el);
  npcEls.push({ key, x, y, cv, el });
}

// ---- me
let myOutfit = { hat: 'none', glasses: 'none', extras: {} };
try {
  const o = JSON.parse(localStorage.getItem('bb-last') || 'null');
  if (o) myOutfit = { hat: o.hat || 'none', glasses: o.glasses || 'none', extras: o.extras || {} };
} catch (e) {}
const ME_DRAW = { ...myOutfit, top: '', bottom: '', bg: 'transparent', captions: false, effect: 'none' };
const me = document.createElement('div');
me.className = 'tw-me';
const meCv = document.createElement('canvas'); meCv.width = meCv.height = 150;
me.appendChild(meCv);
world.appendChild(me);
const meCtx = meCv.getContext('2d');
const CV = 150;
const frameNow = () => { const cyc = BASE_CYCLE_S * 1000; return Math.floor(((Date.now() % cyc) / cyc) * NFRAMES) % NFRAMES; };
let lastF = -1;
function drawMe() {
  const f = frameNow();
  if (f === lastF) return;
  lastF = f;
  drawComposite(meCtx, CV, f, ME_DRAW);
}

// ---- camera: pans both axes, the banana leads (the park's numbers)
const VIEW_ART_W = 900, VIEW_ART_V = 760, PLAZA_FIT = 520;
let scale = 1, viewW = 0, viewH = 0, camX = 0, camY = 0;
function layout() {
  const r = view.getBoundingClientRect();
  viewW = r.width; viewH = r.height;
  const want = Math.max(viewW / VIEW_ART_W, viewH / VIEW_ART_V);
  const fill = Math.max(viewW / W, viewH / H);
  const maxIn = viewW / PLAZA_FIT;
  scale = Math.min(1.7, maxIn, Math.max(0.55, fill, want));
  world.style.width = (W * scale) + 'px';
  world.style.height = (H * scale) + 'px';
}
addEventListener('resize', layout);
layout();
const pos = { x: SPAWN.x, y: SPAWN.y }, tgt = { x: SPAWN.x, y: SPAWN.y };
function camTarget() {
  return {
    x: Math.max(0, Math.min(Math.max(0, W * scale - viewW), pos.x * scale - viewW / 2)),
    y: Math.max(0, Math.min(Math.max(0, H * scale - viewH), pos.y * scale - viewH * 0.58)),
  };
}
let camWX = NaN, camWY = NaN;
function cam(snap) {
  const t = camTarget();
  camX += (t.x - camX) * (snap ? 1 : 0.12);
  camY += (t.y - camY) * (snap ? 1 : 0.12);
  if (Math.abs(t.x - camX) < 0.2) camX = t.x;
  if (Math.abs(t.y - camY) < 0.2) camY = t.y;
  if (camX === camWX && camY === camWY) return;
  camWX = camX; camWY = camY;
  world.style.transform = 'translate(' + (-camX) + 'px,' + (-camY) + 'px)';
}

// ---- walking: tap or keys, foot colliders, the world's edge
const SPEED = 168;
const keys = {};
addEventListener('keydown', (e) => {
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
  const k = e.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(k)) { keys[k] = true; e.preventDefault(); }
});
addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
function blocked(x, y) {
  if (x < BOUND || x > W - BOUND || y < BOUND || y > H - 6) return true;
  for (const [x0, y0, x1, y1] of OB_RECTS) if (x >= x0 && x <= x1 && y >= y0 && y <= y1) return true;
  for (const [cx, cy, r] of OB_CIRCLES) if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r) return true;
  return false;
}
function thingAt(wx, wy) {
  for (const n of npcEls) if (Math.abs(wx - n.x) < 34 && wy < n.y + 6 && wy > n.y - 90) return ['npc', n.key];
  for (const [key, spot] of Object.entries(SPOTS)) {
    const box = BOXES.find((b) => spot.x >= b[0] && spot.x <= b[2] && spot.y - 2 >= b[1] && spot.y - 2 <= b[3] && Math.abs(b[4] - spot.y) < 4);
    if (box && wx >= box[0] && wx <= box[2] && wy >= box[1] && wy <= box[3]) return ['spot', key];
  }
  return null;
}
view.addEventListener('pointerdown', (e) => {
  if (e.target.closest('.wh, .tw-plank, .tw-toast, .tw-panel, .tw-tray')) return;
  const r = view.getBoundingClientRect();
  const wx = (e.clientX - r.left + camX) / scale, wy = (e.clientY - r.top + camY) / scale;
  const hit = thingAt(wx, wy);
  if (hit) {
    if (hit[0] === 'npc') { say(NPC_SAY[hit[1]]); const n = npcEls.find((q) => q.key === hit[1]); tgt.x = n.x + (pos.x < n.x ? -60 : 60); tgt.y = n.y + 8; return; }
    const spot = SPOTS[hit[1]];
    if (!openFor(hit[1])) say(ABOUT[hit[1]] ? ABOUT[hit[1]][2] : hit[1]);
    tgt.x = spot.x; tgt.y = spot.y + 30;
    return;
  }
  tgt.x = Math.max(BOUND, Math.min(W - BOUND, wx)); tgt.y = Math.max(BOUND, Math.min(H - 8, wy));
});
let toastT = 0;
function say(text) {
  toastEl.textContent = text;
  toastEl.hidden = false;
  clearTimeout(toastT);
  toastT = setTimeout(() => { toastEl.hidden = true; }, 4200);
}
// a float over the player — the park's .pk-float: one node, gone in 900 ms
function float(x, y, node) {
  const d = document.createElement('div');
  d.className = 'tw-float';
  if (node && node.nodeType) d.appendChild(node); else d.textContent = node || '';
  d.style.left = pct(x, W); d.style.top = pct(y, H);
  world.appendChild(d);
  setTimeout(() => d.remove(), 900);
}

// ---- the loop
let last = performance.now(), leaving = false;
function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  let dx = 0, dy = 0;
  if (keys.arrowleft || keys.a) dx -= 1;
  if (keys.arrowright || keys.d) dx += 1;
  if (keys.arrowup || keys.w) dy -= 1;
  if (keys.arrowdown || keys.s) dy += 1;
  if (dx || dy) { tgt.x = pos.x; tgt.y = pos.y; const n = Math.hypot(dx, dy); dx /= n; dy /= n; }
  else { const ex = tgt.x - pos.x, ey = tgt.y - pos.y, d = Math.hypot(ex, ey); if (d > 2) { dx = ex / d; dy = ey / d; } }
  if (dx || dy) {
    const step = SPEED * dt;
    const nx = pos.x + dx * step, ny = pos.y + dy * step;
    if (!blocked(nx, ny)) { pos.x = nx; pos.y = ny; }
    else if (!blocked(nx, pos.y)) pos.x = nx;
    else if (!blocked(pos.x, ny)) pos.y = ny;
    else { tgt.x = pos.x; tgt.y = pos.y; }
  }
  me.style.left = pct(pos.x, W); me.style.top = pct(pos.y, H); me.style.zIndex = String(100 + Math.round(pos.y));
  cam(false);
  drawMe();
  if (!leaving && pos.y > H - 40 && Math.abs(pos.x - DOORS.south.x) < 70) {
    leaving = true;
    say('Back down the road to the park…');
    setTimeout(() => { location.href = '/park/'; }, 600);
  }
  requestAnimationFrame(tick);
}

// ---- 🃏 THE CARDS (round three, 11 Sep 2026): the town's three loops, touchable.
// The world's card grammar in the town's brick warmth. Prototype rules: nothing
// is saved, no coins move, the wheel's roll is the phone's — on the real one the
// server picks the wedge and writes the tape. The Exchange is the honest one:
// it reads the farm you actually have on this device and today's real price.
const panel = document.getElementById('twPanel'), cardBody = document.getElementById('twCardBody');
function openCard(html) { cardBody.innerHTML = html; panel.hidden = false; }
function closeCard() { panel.hidden = true; cardBody.innerHTML = ''; }
document.getElementById('twCardX').addEventListener('click', closeCard);
panel.addEventListener('click', (e) => { if (e.target === panel) closeCard(); });
function openFor(key) {
  if (key === 'wheel') { wheelCard(); return true; }
  if (key === 'exchange') { exchangeCard(); return true; }
  if (key === 'store') { storeCard(); return true; }
  return false;
}
// splitmix32 seeded by the UTC day, the daily banana's own rhythm
function mix32(seed) {
  let t = seed >>> 0;
  return () => { t = (t + 0x9e3779b9) >>> 0; let z = t; z = Math.imul(z ^ (z >>> 16), 0x21f0aaad); z = Math.imul(z ^ (z >>> 15), 0x735a2d97); z = z ^ (z >>> 15); return (z >>> 0) / 4294967296; };
}
const dayNum = (off) => Math.floor(Date.now() / 86400000) + (off || 0);
const esc = (v) => String(v == null ? '' : v).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

// ---- 📈 the Exchange: sell what the farm made, at today's price; sell now or hold
const GOODS = [['eggs', 'Eggs', 3, ['hen']], ['milk', 'Milk', 5, ['goat', 'cow']], ['wool', 'Wool', 8, ['sheep']]];
function priceOf(day, i) { const r = mix32(day * 7 + i * 131)(); return Math.round(GOODS[i][2] * (0.6 + r) * 10) / 10; }   // 0.6× to 1.6× the base
function myProduce() {
  try {
    const st = JSON.parse(localStorage.getItem('hs-v1') || 'null');
    const out = [0, 0, 0];
    for (const a of (st && st.animals) || []) GOODS.forEach((g, i) => { if (g[3].includes(a.sp)) out[i] += Math.floor(a.gs || 0); });
    return out;
  } catch (e) { return [0, 0, 0]; }
}
function exchangeCard() {
  const today = dayNum(), have = myProduce();
  let rows = '', total = 0;
  GOODS.forEach((g, i) => {
    const p = priceOf(today, i), y = priceOf(today - 1, i), n = have[i];
    total += n * p;
    const move = p > y ? 'up from ' + y + ' yesterday' : p < y ? 'down from ' + y + ' yesterday' : 'same as yesterday';
    rows += '<div class="tw-row"><div><b>' + g[1] + ' · ' + p + ' coins each</b><small>' + move + ' · you have ' + n + '</small></div><button type="button" data-sell="' + i + '"' + (n ? '' : ' disabled') + '>sell ' + n + '</button></div>';
  });
  const up = priceOf(today + 1, 0) > priceOf(today, 0), honest = mix32(today * 3 + 9)() < 0.7;
  const rumour = (up === honest) ? 'eggs go up tomorrow' : 'eggs drop tomorrow';
  openCard('<h2>The Exchange</h2><p class="tw-card__sub">Fig Jr. buys what your farm made, at today’s price. The price moves every day. Sell now, or hold.</p>'
    + '<div class="tw-rows">' + rows + '</div>'
    + '<p class="tw-result">Everything, today: <b>' + Math.round(total) + ' coins</b></p>'
    + '<p class="tw-fine">Bean at the café says “' + rumour + '.” He is right seven times in ten.</p>'
    + '<p class="tw-fine">Prototype: the prices are real for today, the sale is not. Your produce is read from your homestead on this device.</p>');
  cardBody.querySelectorAll('[data-sell]').forEach((b) => b.addEventListener('click', () => {
    const i = +b.dataset.sell; b.disabled = true; b.textContent = 'sold';
    say('Prototype: ' + have[i] + ' ' + GOODS[i][1].toLowerCase() + ' would bring ' + Math.round(have[i] * priceOf(today, i)) + ' coins. Nothing moved.');
  }));
}

// ---- 🎡 the Wheel of Peel: one free spin, then coins; the pot grows until a wedge takes it
const WEDGES = [['5 coins', '#ffe135', '#141208'], ['a firework', '#ff8a3d', '#141208'], ['a peel', '#d9d2c6', '#141208'], ['20 coins', '#ffe135', '#141208'],
  ['a lure', '#7ec8ff', '#141208'], ['spin again', '#c9f26a', '#141208'], ['a peel', '#d9d2c6', '#141208'], ['THE POT', '#ff5c8a', '#fffdf5']];
let pot = 120 + Math.floor(mix32(dayNum())() * 300), spins = 0, spinning = false, angle = 0;
function drawWheel(cv) {
  const ctx = cv.getContext('2d'), R2 = cv.width / 2, n = WEDGES.length, per = Math.PI * 2 / n;
  ctx.clearRect(0, 0, cv.width, cv.height);
  WEDGES.forEach((w, i) => {
    const a0 = -Math.PI / 2 + i * per, a1 = a0 + per;
    ctx.beginPath(); ctx.moveTo(R2, R2); ctx.arc(R2, R2, R2 - 6, a0, a1); ctx.closePath();
    ctx.fillStyle = w[1]; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = '#141208'; ctx.stroke();
    // the label reads upright on both halves: left-side wedges are turned half a circle and drawn from the rim inward
    const mid = a0 + per / 2, left = Math.cos(mid) < 0;
    ctx.save(); ctx.translate(R2, R2); ctx.rotate(left ? mid + Math.PI : mid); ctx.textAlign = left ? 'left' : 'right'; ctx.textBaseline = 'middle';
    ctx.fillStyle = w[2]; ctx.font = 'bold 24px "Archivo Black", "Arial Black", sans-serif'; ctx.fillText(w[0], left ? -(R2 - 26) : R2 - 26, 0); ctx.restore();
  });
  ctx.beginPath(); ctx.arc(R2, R2, 26, 0, Math.PI * 2); ctx.fillStyle = '#141208'; ctx.fill();
  ctx.beginPath(); ctx.arc(R2, R2, 14, 0, Math.PI * 2); ctx.fillStyle = '#ffe135'; ctx.fill();
}
function wheelCard() {
  openCard('<h2>The Wheel of Peel</h2><p class="tw-card__sub">One free spin a day. After that a few coins a spin, and every paid spin feeds the pot until one wedge takes it all.</p>'
    + '<p class="tw-pot">THE POT · <span id="twPot">' + pot + '</span> COINS</p>'
    + '<div class="tw-wheelwrap"><div class="tw-wheel__pin"></div><canvas class="tw-wheel" id="twWheel" width="440" height="440"></canvas></div>'
    + '<p class="tw-result" id="twSpinRes"></p>'
    + '<button class="tw-cta" id="twSpin" type="button"><span class="tw-cta__verb">' + (spins ? 'Spin again' : 'Free spin') + '</span><span class="tw-cta__rew">' + (spins ? '3 coins' : 'today’s free one') + '</span></button>'
    + '<p class="tw-fine">Prototype: the wheel is real, the coins are not. On the real one the server picks the wedge and the odds stay in the code.</p>');
  const cv = document.getElementById('twWheel');
  drawWheel(cv);
  cv.style.transform = 'rotate(' + angle + 'deg)';
  document.getElementById('twSpin').addEventListener('click', () => spin(cv));
}
function spin(cv) {
  if (spinning) return;
  spinning = true;
  const btn = document.getElementById('twSpin'); if (btn) btn.disabled = true;
  const w = Math.floor(Math.random() * WEDGES.length), per = 360 / WEDGES.length;
  const want = (360 - (w * per + per / 2) + 360) % 360;          // wedge w under the pin at the top
  const delta = ((want - (angle % 360)) % 360 + 360) % 360;
  angle += 5 * 360 + delta;                                        // always forward, never a snap back
  cv.style.transform = 'rotate(' + angle + 'deg)';
  if (spins > 0) { pot += 1; const p = document.getElementById('twPot'); if (p) p.textContent = pot; }
  spins++;
  setTimeout(() => {
    spinning = false;
    const won = WEDGES[w][0], res = document.getElementById('twSpinRes');
    let line = 'You won ' + won + '.';
    if (won === 'THE POT') { line = 'THE POT. ' + pot + ' coins, all yours. In the prototype, a very happy nothing.'; pot = 120; }
    else if (won === 'a peel') line = 'A banana peel. Nothing, but it was a good spin.';
    else if (won === 'spin again') line = 'Spin again, on the house.';
    else if (won === 'a firework' || won === 'a lure') { line = 'You won ' + won + '. It goes in your pocket.'; pocketAdd(won === 'a firework' ? 'firework' : 'lure'); }
    if (res) res.textContent = line;
    const p = document.getElementById('twPot'); if (p) p.textContent = pot;
    if (btn) { btn.disabled = false; btn.querySelector('.tw-cta__verb').textContent = 'Spin again'; btn.querySelector('.tw-cta__rew').textContent = won === 'spin again' ? 'free' : '3 coins'; }
  }, 3500);
}

// ---- 🏪 the General Store and the POCKET: buy, carry at most five of three kinds, use where it works
const ITEMS = { firework: ['Firework', 15, 'Launch it where people are. Everyone present sees the burst, with your name under it.'],
  lure: ['Lure', 20, 'Ten casts at the pier with better odds of a rare fish. Arms itself; nothing to carry.'],
  bread: ['Duck bread', 5, 'The park’s ducks follow you around for a minute.'] };
const pocket = {};     // this session only — the real one is two pass counters per kind
function pocketAdd(k) { pocket[k] = Math.min(5, (pocket[k] || 0) + 1); pocketPaint(); }
function pocketPaint() {
  const n = Object.values(pocket).reduce((a, b) => a + b, 0);
  // the bar's verb slot: hidden while empty, the count when not (the park's tool-slot grammar)
  pocketBtn.hidden = !n;
  pocketN.textContent = String(n);
  if (!n) tray.hidden = true;
}
function storeCard() {
  let rows = '';
  for (const [k, it] of Object.entries(ITEMS)) rows += '<div class="tw-row"><div><b>' + it[0] + ' · ' + it[1] + ' coins</b><small>' + it[2] + '</small></div><button type="button" data-buy="' + k + '">buy</button></div>';
  openCard('<h2>The General Store</h2><p class="tw-card__sub">Pip sells things you use, never things you wear. Three kinds, five of each at most. What you carry shows as POCKET in the HUD.</p>'
    + '<div class="tw-rows">' + rows + '</div>'
    + '<p class="tw-fine">Prototype: nothing is charged and nothing is saved. On the real one a buy is a pass spend and the server refuses more than five.</p>');
  cardBody.querySelectorAll('[data-buy]').forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.buy;
    if ((pocket[k] || 0) >= 5) { say('Pip: “Five is plenty. Use one first.”'); return; }
    if (k === 'lure') { pocket.lure = Math.min(5, (pocket.lure || 0) + 1); pocketPaint(); say('The lure arms itself: your next ten casts at the pier are the lucky ones. Nothing to carry.'); return; }
    pocketAdd(k);
    say(ITEMS[k][0] + ' bought. It is in your pocket.');
  }));
}
const tray = document.getElementById('twTray');
const pocketBtn = document.getElementById('twPocket');
// the slot is a glyph with a count badge, never a word (the HUD is icons — Trym, 11 Sep); the pack's own pixel pocket
pocketBtn.innerHTML = iconSvg('pocket', { size: 22 }) + '<b class="tw-act__n" id="twPocketN">0</b>';
const pocketN = document.getElementById('twPocketN');
const POCKET_ICON = { firework: 'party-popper-solid', lure: 'fish-solid', bread: 'bird-solid' };
function toggleTray() {
  if (!tray.hidden) { tray.hidden = true; return; }
  toastEl.hidden = true; clearTimeout(toastT);   // the tray is what the player asked for; the chatter yields
  let html = '';
  // a row = glyph + name; the verb button only where the item works HERE, otherwise one small line
  // saying where it does (a sentence in a button wrapped the row — buttons never line-break)
  for (const [k, v] of Object.entries(pocket)) if (v) {
    const here = k === 'firework';
    html += '<div class="tw-row"' + (here ? '' : ' data-say="' + k + '" role="button"') + '><div class="tw-row__it">' + iconSvg(POCKET_ICON[k], { size: 22 })
      + '<div><b>' + ITEMS[k][0] + ' ×' + v + '</b>' + (here ? '' : '<small>' + (k === 'lure' ? 'arms itself at the pier' : 'works in the park, by the pond') + '</small>') + '</div></div>'
      + (here ? '<button type="button" data-use="' + k + '">use here</button>' : '') + '</div>';
  }
  tray.innerHTML = html || '<div class="tw-row"><b>Empty.</b></div>';
  tray.hidden = false;
  // the tray folds first either way, so the toast never lands on it
  tray.querySelectorAll('[data-use]').forEach((b) => b.addEventListener('click', () => { tray.hidden = true; pocket.firework--; pocketPaint(); firework(); }));
  tray.querySelectorAll('[data-say]').forEach((r) => r.addEventListener('click', () => { tray.hidden = true; say(r.dataset.say === 'lure' ? 'Lures arm themselves at the pier. Nothing to do here.' : 'Duck bread works in the park, by the pond.'); }));
}

// ---- 🎆 the firework: a burst over the square where you stand, your name under it
let fxRuns = 0;
function firework() {
  const cv = document.getElementById('twFx'), r = view.getBoundingClientRect();
  cv.width = Math.round(r.width); cv.height = Math.round(r.height); cv.hidden = false;
  const ctx = cv.getContext('2d');
  const x0 = pos.x * scale - camX, y0 = pos.y * scale - camY - 150 * scale;
  let name = ''; try { name = (localStorage.getItem('ps-name-v1') || '').trim().slice(0, 24); } catch (e) {}
  const parts = [];
  for (let i = 0; i < 70; i++) { const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 4; parts.push({ x: x0, y: y0, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, c: ['#ffe135', '#ff5c8a', '#fffdf5', '#7ec8ff'][i % 4], life: 60 + Math.random() * 30 }); }
  const t0 = performance.now();
  fxRuns++;
  say((name ? name + '’s' : 'Your') + ' firework went up over the square.');
  (function frame(now) {
    const t = (now - t0) / 1000;
    ctx.clearRect(0, 0, cv.width, cv.height);
    let alive = 0;
    for (const p of parts) { if (p.life <= 0) continue; alive++; p.x += p.vx; p.y += p.vy; p.vy += 0.06; p.life -= 1; ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 40)); ctx.fillStyle = p.c; ctx.fillRect(Math.round(p.x), Math.round(p.y), 4, 4); }
    ctx.globalAlpha = 1;
    if (name && t < 1.6) { ctx.font = 'bold 14px "Archivo Black", sans-serif'; ctx.fillStyle = '#fffdf5'; ctx.textAlign = 'center'; ctx.shadowColor = '#000'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 1; ctx.shadowOffsetY = 1; ctx.fillText(name, x0, y0 + 46); ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; }
    if (alive && t < 2.2) requestAnimationFrame(frame); else { ctx.clearRect(0, 0, cv.width, cv.height); cv.hidden = true; }
  })(t0);
}

// ---- boot: the engine's assets first, then the people, then the walk
// the world HUD, both halves (design library §15): the strip up top — level,
// coins, the crowd chip that is also the save ask (no room yet, so it reads
// solo) — and the ACTION BAR under the view: POCKET as the verb slot, the
// heart, the travel door. Every player control lives in one of the two.
const hud = mountHud({ mount: view, theme: { bg: 'rgba(30, 18, 10, 0.84)', border: 'rgba(255, 200, 120, 0.35)' }, chips: ['lvl', 'coins', 'crowd'] });
hud.setCrowd('solo');
pocketBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleTray(); });
document.getElementById('twEmote').addEventListener('click', function () {
  // the float rides the button's own pixel heart — one art source (the park's grammar)
  const s = this.querySelector('svg');
  float(pos.x, pos.y - 44, s ? s.cloneNode(true) : '');
});
// 🚪 the travel door lands last in the bar. 'town' is not in the module's area
// list, so the card offers the four known areas and no area's card offers the
// town — the prototype stays unlisted (Rule Zero) while still being leavable.
initTravel({ here: 'town', mount: document.querySelector('.tw-actions'), btnClass: 'tw-act tw-act--icon' });
assetsReady().then(() => {
  for (const n of npcEls) {
    drawComposite(n.cv.getContext('2d'), 150, 0, { hat: 'none', glasses: 'none', extras: {}, ...NPC_LOOK[n.key], top: '', bottom: '', bg: 'transparent', captions: false, effect: 'none' });
  }
  cam(true);
  drawMe();
  requestAnimationFrame(tick);
  window.__town = { pos, tgt, SPOTS, NPCS, say, cards: { wheel: wheelCard, exchange: exchangeCard, store: storeCard }, pocket, fx: () => fxRuns };   // QA seam for the walk
});
