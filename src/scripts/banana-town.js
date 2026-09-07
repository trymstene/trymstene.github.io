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
import { WORLD, BOUND, SPAWN, DOORS, OVERLAYS, SPOTS, NPCS, OB_RECTS, OB_CIRCLES } from './town-geo.js';

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

// ---- what each door is (the plan's words) and the plank that names it
const ABOUT = {
  hall: ['TOWN HALL', 120, 'Town Hall. Nib’s desk and the big book. Chapter two starts here. Not built yet.'],
  post: ['POST OFFICE', 100, 'Post Office. Stamp sends stock postcards; your mailbox is by the door. Not built yet.'],
  store: ['GENERAL STORE', 100, 'General Store. Pip sells fireworks, lures and duck bread. Not built yet.'],
  bank: ['BANK', 110, 'The bank. It is an ATM. Not built yet.'],
  print: ['STICKERS', 110, 'The print shop. The real sticker packs in the window. Not built yet.'],
  cafe: ['CAFÉ', 236, 'The Coffee Cup. Bean pours today’s fortune and a rumour about tomorrow’s prices. Not built yet.'],
  board: ['NOTICES', 132, 'The notice board. Board of Works projects, today’s wants, Monday’s results. Not built yet.'],
  exchange: ['THE EXCHANGE', 154, 'The Exchange. Fig Jr. buys eggs, milk and wool at today’s price. Not built yet.'],
  wheel: ['WHEEL OF PEEL', 154, 'The Wheel of Peel. One free spin a day, then a few coins a spin. Not built yet.'],
  lot: ['COMING SOON', 90, 'The worksite lot. The office and the arcade, later.'],
  condo: ['THE BUNCH', 140, 'The Bunch. Five real players in its windows. Not built yet.'],
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
  p.addEventListener('click', (e) => { e.stopPropagation(); say(a[2]); });
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
  if (e.target.closest('.wh, .tw-plank, .tw-toast')) return;
  const r = view.getBoundingClientRect();
  const wx = (e.clientX - r.left + camX) / scale, wy = (e.clientY - r.top + camY) / scale;
  const hit = thingAt(wx, wy);
  if (hit) {
    if (hit[0] === 'npc') { say(NPC_SAY[hit[1]]); const n = npcEls.find((q) => q.key === hit[1]); tgt.x = n.x + (pos.x < n.x ? -60 : 60); tgt.y = n.y + 8; return; }
    const spot = SPOTS[hit[1]];
    say(ABOUT[hit[1]] ? ABOUT[hit[1]][2] : hit[1]);
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

// ---- boot: the engine's assets first, then the people, then the walk
mountHud({ mount: view, theme: { bg: 'rgba(30, 18, 10, 0.84)', border: 'rgba(255, 200, 120, 0.35)' }, chips: ['lvl', 'coins'] });
assetsReady().then(() => {
  for (const n of npcEls) {
    drawComposite(n.cv.getContext('2d'), 150, 0, { hat: 'none', glasses: 'none', extras: {}, ...NPC_LOOK[n.key], top: '', bottom: '', bg: 'transparent', captions: false, effect: 'none' });
  }
  cam(true);
  drawMe();
  requestAnimationFrame(tick);
  window.__town = { pos, tgt, SPOTS, NPCS, say };   // QA seam for the walk
});
