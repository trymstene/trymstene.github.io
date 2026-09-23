// 🏘️ BANANA TOWN — the hidden prototype chassis (7 Sep 2026).
//
// A walkable square baked from the pack at the world's prop scale
// (tools/build-town-scene.py), so the city plan can be judged on foot before a
// line of the real area is written. Nothing here is wired: doors and people
// say what they will be. The page is noindexed and linked from nowhere.
// Chassis = the park's essentials only: camera on both axes, tap-to-walk +
// keys, foot colliders, y-sorted overlays, the shared HUD.
import { unlocksAt, unlocked, ranksOf } from '../data/town/jobs.js';   // 🔓 what a rank lets you do (23 Sep 2026)
import { drawComposite, assetsReady, NFRAMES, BASE_CYCLE_S } from '../lib/banana-engine.js';
import { mountHud } from '../lib/world-hud.js';
import { initTravel } from './world-travel.js';
import { iconSvg } from '../lib/pixel-icons.js';
import { WORLD, BOUND, SPAWN, DOORS, OVERLAYS, SPOTS, NPCS, OB_RECTS, OB_CIRCLES, FOUNTAIN, ANIMS, ARCADE, STORE, CAFE_WIN } from './town-geo.js';
import { snapScale } from '../lib/world.js';   // 🔍 whole device pixels
import { initLife } from './town-life.js';
import { mountDialogue } from '../lib/world-dialogue.js';
import { bigMoment } from '../lib/world-moment.js';   // 🎖 the rave's big moment, shared: the town's first is being hired
import { mountWeather } from './world-weather.js';   // 🌦 the same sky as the park, on the same clock
import { fillWords } from '../lib/fill-words.js';   // a copy line with its {holes} filled
import { passGet, passStat } from '../lib/banana-pass.js';   // already in this bundle through the HUD
import { POCKET_KINDS, pocketHave, WEDGES } from '../data/town/market.js';   // 📈🎡 the market's one source, shared with worker-pass
import FRONTS from '../data/copy/town-fronts.json';   // 🏘️ what the hall, the bank, the print shop, the wheel, the exchange and an old cabinet say (the rig's, 22 Sep 2026)

const track = (n, p) => { try { if (window.gtag) window.gtag('event', n, p || {}); } catch (e) {} };
const view = document.getElementById('twView');
const world = document.getElementById('twWorld');
const toastEl = document.getElementById('twToast');
const W = WORLD.w, H = WORLD.h;
const pct = (v, span) => (v / span * 100) + '%';

// ---- the props: y-sorted overlays, % of the world so they ride the camera free
const BOXES = [];
// 🏘️ a keyed prop (the lamps, the kiosks, the bin, the shopfronts — OVERLAYS' 7th column
// since 14 Sep) is findable by name, so Town Life can swap, mark or darken it (town-room.js)
const PROPS = {};
for (const [fn, x, y, w, h, base, key] of OVERLAYS) {
  const img = new Image();
  img.src = '/assets/town/' + fn; img.className = 'tw-ov'; img.draggable = false; img.alt = '';
  if (key) { img.dataset.key = key; PROPS[key] = { el: img, x, y, w, h, base }; }
  img.style.left = pct(x, W); img.style.top = pct(y, H); img.style.width = pct(w, W);
  img.style.zIndex = String(100 + base);
  world.appendChild(img);
  BOXES.push([x, y, x + w, y + h, base]);
}

// ---- ⛲ the animated props: the fountain and the rest, frames as files, CSS-shown in turn
// (n frames in ONE box, one visible at a time, a positive delay per frame; a background strip
// stepped by position walked sideways at fractional widths). Keyframes per frame count live
// in town.astro: tw-fount for 6, tw-fount4 for 4.
const ANIM_ALL = [];
if (FOUNTAIN && FOUNTAIN.length) ANIM_ALL.push(['fountain', FOUNTAIN[0], FOUNTAIN[1], FOUNTAIN[2], FOUNTAIN[3], FOUNTAIN[4], 0.9]);
for (const a of (ANIMS || [])) ANIM_ALL.push(a);
for (const [key, fx, fbase, fw, fh, n, period] of ANIM_ALL) {
  const f = document.createElement('div');
  f.className = 'tw-fountain'; f.dataset.key = key;
  f.style.left = pct(fx - fw / 2, W); f.style.top = pct(fbase - fh, H); f.style.width = pct(fw, W);
  f.style.aspectRatio = fw + ' / ' + fh;
  for (let i = 0; i < n; i++) {
    const im = document.createElement('img');
    im.src = '/assets/town/a-' + key + '-' + i + '.png'; im.alt = ''; im.decoding = 'async';
    im.style.animationName = n === 4 ? 'tw-fount4' : n === 8 ? 'tw-fount8' : 'tw-fount';
    im.style.animationDuration = period + 's';
    im.style.animationDelay = (i * (period / n)).toFixed(3) + 's';
    f.appendChild(im);
  }
  f.style.zIndex = String(100 + fbase);
  world.appendChild(f);
  BOXES.push([fx - fw / 2, fbase - fh, fx + fw / 2, fbase, fbase]);
}

// ---- what each door is (the plan's words) and the plank that names it
const ABOUT = {
  // ⭐ the third field is a place's own line when tapped, and every one of them is the rig's now (docs/voice.md:
  // a place answers plainly). The planks' words stay here: a sign is a name, not prose.
  hall: ['TOWN HALL', 96, FRONTS.hall || ''],
  // ✉️ no third field: the post office answers for itself now, through the rig (town-post.json `front`)
  post: ['', 0, ''],
  store: ['', 104, ''],   // the store answers with Pip's shelf card (town-room openFor)
  bank: ['', 118, FRONTS.bank || ''],
  // the print shop's plank is an OVERLAY on the sprite's own STORE sign (measured: the sign band is 64×22 world px
  // centred at 1585,932): grey metal, a bit bigger, its bottom-centre 2 px under the sign (Trym, 15 Sep)
  print: ['STICKERS', 93, FRONTS.print || '', -35],
  // ☕ no third field: the café answers for itself now, through the rig (town-room openFor + town-cafe.json `front`)
  cafe: ['', 220, ''],
  exchange: ['THE EXCHANGE', 134, ''],   // 134: on the awning, not above it; the Exchange answers with its card
  wheel: ['WHEEL OF PEEL', 134, ''],   // the Wheel answers with its card
  // 👕 the clothes shop: a DRESSING ROOM and nothing else, so it has no room, no job and no boss.
  // The pack has no clothes front, so it wears a plank the way the print shop does — 93 and -35 are the
  // print shop's own numbers, and they transfer because this sprite is the same 279 px tall.
  // ⚠️ no third field: the shop answers for itself through the rig (town-dress.json `front`).
  clothes: ['CLOTHES', 93, '', -35],
  condo: ['ARCADE', 100, ''],   // the arcade's door is a room: town-life.json rooms.condo speaks inside
  // 🕹 the machines inside — names to be argued over; every one says what it will be
  g1: ['', 0, 'PEEL OUT'],
  g2: ['', 0, 'BANANA SNAKE'],
  g3: ['', 0, 'BANANA INVADERS'],
  g4: ['', 0, 'BANANA PONG'],
  g5: ['', 0, 'BANANA STACK'],
  g6: ['', 0, FRONTS.oldCabinet || ''],
  g7: ['', 0, FRONTS.oldCabinet || ''],
  g8: ['', 0, FRONTS.oldCabinet || ''],
  g9: ['', 0, FRONTS.oldCabinet || ''],
  // 🪧 the square's small spots: their lines are the rig's too since 22 Sep 2026 (town-fronts.json)
  counter: ['', 0, FRONTS.counter || ''],
  cart: ['', 0, FRONTS.cart || ''],
  fountain: ['', 0, FRONTS.fountain || ''],
  // the mini-areas (11 Sep evening): every small place says what it is for
  orchard: ['THE ORCHARD', 0, FRONTS.orchard || ''],
  monument: ['THE MONUMENT', 232, FRONTS.monument || ''],
  bus: ['BUS STOP', 122, ''],   // no line: the shelter opens the travel door (openFor 'bus')
  info: ['', 224, ''],          // no line: the kiosk opens its rack of maps (openFor 'info')
  terrace: ['', 132, FRONTS.terrace || ''],
  cut: ['THE CUT ↑', 0, FRONTS.cut || ''],
  garden_e: ['', 0, FRONTS.gardenE || ''],
  garden_w: ['', 0, FRONTS.gardenW || ''],
  // 🍋 no third field: the stand answers for itself now, through the rig (town-room openFor + town-lemon.json `front`)
  stand: ['LEMONADE', 93, ''],
};
for (const [key, spot] of Object.entries(SPOTS)) {
  const a = ABOUT[key];
  if (!a || !a[0]) continue;
  const p = document.createElement('div');
  // 🪧 THE TWO SHOPFRONTS WEAR THE SAME METAL SIGN, because they are the same sprite: Market_Small_7
  // and _11 both carry a 66×23 world-px STORE plate over the door, and a plank that does not cover it
  // leaves the pack's own word showing round the edges. Trym, 20 Sep 2026: "on the Clothes shop, the
  // Clothes sign should be more metallic like the sign on the Stickers shop. The sign on the Clothes
  // shop should be a bit bigger aswell to cover the sprite sign."
  const METAL = ['print', 'clothes'];
  p.className = 'tw-plank' + (key === 'exchange' || key === 'wheel' ? ' tw-plank--big' : METAL.includes(key) ? ' tw-plank--metal' : '');   // the stalls' signs at double size (Trym, 14 Sep)
  p.dataset.key = key;   // 🏘️ Town Life renames the board's sign to what the board says (town-room.js)
  p.textContent = a[0];
  p.style.left = pct(spot.x + (a[3] || 0), W); p.style.top = pct(spot.y - a[1], H);   // a[3]: a sideways nudge, world px
  p.style.zIndex = String(100 + spot.y + 3);
  // a sign is its place: the same walk-then-deed a tap on the place itself gets, and nothing mid-shift (23 Sep 2026 —
  // the stand's sign clocked a worker in where they stood, from across the square, or out in the middle of a shift)
  p.addEventListener('click', (e) => {
    e.stopPropagation();
    if (working()) return;
    const wasIn = inRoom;
    if (!openFor(key)) say(a[2]);
    if (inRoom === wasIn) { tgt.x = spot.x; tgt.y = spot.y + 30; }
  });
  p.addEventListener('pointerdown', (e) => { if (panel && !panel.hidden) e.stopPropagation(); });   // a prop under an open card is not tappable
  world.appendChild(p);
}

// 🎡 A LITTLE WHEEL ON THE WHEEL STALL'S COUNTER.
//
// Trym, 20 Sep 2026: "can we add a miniature visual of the Wheel of Peel on the outside of this
// stall-stand-sprite, doesnt have to animate or anything, just to tell the two stalls more apart."
// The Exchange and the Wheel are the SAME market stand from the pack, one flipped, so across the
// square they are one building twice — the plank is the only thing that tells them apart, and a plank
// is a word, which is the slowest thing on screen to read.
//
// ⭐ IT IS THE GAME'S OWN WHEEL, NOT A DRAWING OF ONE. drawWheel() and its eight WEDGES are what the
// card spins; this is the same function on a 30-px canvas with the labels left off, so the colours on
// the stall and the colours in the card can never disagree. No new art, no second palette, nothing to
// keep in step — and no pack sprite had to be invented for it (pack-fidelity doctrine).
//
// ⚠️ IT IS NOT A CONTROL: `pointer-events: none`, and the canvas is PAINTED once. It turns — slowly,
// a full circle a day's walk — but that is a CSS transform on the element, not a redraw (town.astro
// .tw-decal--spin). The stall underneath stays the tappable thing, which is what a thumb is aiming at.
function stallWheel() {
  const p = PROPS.wheel;
  if (!p) return;
  const cv = document.createElement('canvas');
  cv.className = 'tw-decal tw-decal--spin';
  cv.width = cv.height = 120;   // the drawing buffer; CSS shows it at world size
  cv.setAttribute('aria-hidden', 'true');
  // where it sits, as fractions of the stall's OWN box, so it rides with the prop if the prop moves:
  // the counter board runs y 88..120 of 147, and the right-hand third of it is clear of the posts.
  // ⚠️ 0.38, NOT 0.17. Trym, 20 Sep 2026: "the wheel of peel can be a bit more than double the size."
  // At 30 world px it read as a sticker on the counter; at 68 it reads as the wheel the stall is named
  // after, leaning on its own front — which is what tells the two identical market stands apart from
  // across the square. It now stands taller than the counter board, so it is centred on the board's
  // line rather than inside it.
  const d = Math.round(p.w * 0.38);
  const cx = p.x + p.w * 0.66, cy = p.y + p.h * 0.72;
  cv.style.left = pct(cx - d / 2, W); cv.style.top = pct(cy - d / 2, H);
  cv.style.width = pct(d, W);
  cv.style.zIndex = String(100 + p.base + 1);
  world.appendChild(cv);
  drawWheel(cv, true);
}

const park = document.createElement('div');
park.className = 'tw-plank tw-plank--way';
park.textContent = 'THE PARK ↓';
park.style.left = pct(DOORS.south.x, W); park.style.top = pct(H - 60, H); park.style.zIndex = String(100 + H);
world.appendChild(park);

// ---- the people: the residents live in town-life.js (their days, walks, speech, the litter, the windows)
const life = initLife({ world, W, H, pct });
// 🕯 CHAPTER ONE OPENS AT THE FOUNTAIN (21 Sep 2026): while its first scene is open Nib waits there —
// whatever the hour — and when it closes he walks up to the town hall. The chapter says so through
// window.bwqTalk.station once it has booted (after the room, a second in); before that the square
// reads the chapter's own save, so he is standing there from the first frame instead of walking down
// from his desk while the splash plays. ONE answer, read by the first override below and by
// town-room's composed one (overrideFor) from then on.
function nibStation() {
  const q = window.bwqTalk;
  if (q) return (q.who === 'nib' && q.station) || null;
  if (/[?&]chapter=2/.test(location.search)) return null;   // 🧪 the walk asked for the parked chapter: nobody waits at the fountain
  try { const s = JSON.parse(localStorage.getItem('bwq-c1') || 'null'); if (!s) return 'fountain'; return (!s.done && !(+s.s > 0)) ? 'fountain' : null; } catch (e) { return null; }
}
life.setOverride((n) => (n.key === 'nib' && nibStation()) ? { place: nibStation(), always: true } : null);

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
// 👕 THE OUTFIT CHANGED UNDER US. `ME_DRAW` is a const OBJECT and the whole town holds references to
// it — the café's at-work banana asks for it by getter, the twin draws from it — so it is mutated in
// place rather than replaced, and `lastF` is cleared because drawMe() skips a frame it has already
// drawn and the frame number has not changed just because the hat did.
function rewear() {
  try {
    const o = JSON.parse(localStorage.getItem('bb-last') || 'null') || {};
    myOutfit = { hat: o.hat || 'none', glasses: o.glasses || 'none', extras: o.extras || {} };
  } catch (e) {}
  ME_DRAW.hat = myOutfit.hat; ME_DRAW.glasses = myOutfit.glasses; ME_DRAW.extras = myOutfit.extras;
  lastF = -1;
  if (crowd) crowd.outfit();   // 👥 the square sees the change too
  drawMe();
}
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
  scale = snapScale(Math.min(1.7, maxIn, Math.max(0.55, fill, want)), 0.55, Math.min(1.7, maxIn));   // 🔍 whole device pixels — see world.js
  world.style.width = (W * scale) + 'px';
  world.style.height = (H * scale) + 'px';
  world.style.setProperty('--ws', scale.toFixed(3));   // the world's scale, for what CSS sizes in the world: the planks
}
addEventListener('resize', layout);
layout();
const pos = { x: SPAWN.x, y: SPAWN.y }, tgt = { x: SPAWN.x, y: SPAWN.y };
// 🎯 A COUNTER SHIFT FRAMES THE COUNTER (23 Sep 2026). On a phone the lemonade stand vanished during a shift: it stands near
// the top of the world, the camera put the player at 58% of the view, and that left the stand high up — under the work note
// and under every toast, which docks at the top while a counter's tray is up (design library §25). Measured at 393×852:
// the stand at y 298–368, the note over 236–319, the toast over 327–403. So while a counter holds the banana (the café, the
// stand, the post round, a repair) the camera frames the FIGURE AT WORK — the banana in the window or behind the table, or
// your own at a counter — in the band between the top notes (and a toast's place under them, three lines of it) and the
// tray. MEASURED, never a number per counter: the notes fold and unfold, the strip grows a line, the tray is its own height.
// A counter the world's edge will not let the camera reach (the café's hatch, low in the world) simply stays where it is.
let frameAt = -1e9, frameY = null;
function shiftFrameY(now) {
  if (now - frameAt < 250) return frameY;
  frameAt = now; frameY = null;
  if (!working()) return null;
  const tray = [...view.querySelectorAll('.tw-cup')].find((e) => !e.hidden && !e.classList.contains('is-folded'));
  const fig = world.querySelector('.tw-atwork') || me;
  if (!tray || !fig) return null;
  const v = view.getBoundingClientRect(), wr = world.getBoundingClientRect(), f = fig.getBoundingClientRect(), cs = getComputedStyle(toastEl);
  let low = 0;
  for (const el of document.querySelectorAll('.wh, .bwq-hint, .bwq-hint__badge, .twd-chip, .twd-chip__badge')) { const r = el.getBoundingClientRect(); if (r.height > 0 && r.bottom > v.top) low = Math.max(low, r.bottom - v.top); }
  const top = Math.max(14, low + 10) + (parseFloat(cs.lineHeight) || 18) * 3 + (parseFloat(cs.paddingTop) || 8) * 2 + 14, bot = tray.getBoundingClientRect().top - v.top - 8;
  const y0 = f.top - wr.top, y1 = f.bottom - wr.top;   // the figure, in the world's own scaled pixels
  frameY = bot - top >= y1 - y0 ? (y0 + y1) / 2 - (top + bot) / 2 : y0 - top;   // centred in the band, or its top at the band's top
  return frameY;
}
// 🔓 THE SQUARE IS THE ON-CALL JOBS' TOO, AND THE CAFÉ'S KEYHOLDER TIDIES IT (the ladder's slice 3, 23–24 Sep 2026). The room
// only REPORTS what happened — it is at its size cap — and the job hears it here:
//   🕹 the arcade's rank 3: a lamp put right on the square is one of Spinner's repairs; rank 4: litter picked up is its sweeping
//   ☕ the café's rank 4 (keyholder): a good shift ends with the nearest mess on the square put right — the town's health rises
// Each says so ONCE a day (design library §30): after that the work note's bar moving is enough.
const toldToday = {};
const tell = (k) => { const L = (work && work.seam.words()) || {}, d = Math.floor(Date.now() / 864e5); if ((L.told || {})[k] && toldToday[k] !== d) { toldToday[k] = d; say(L.told[k]); } };
let tidyNext = null;   // ☕ the keyholder's tidy waits for the receipt to close (§27: the moment comes after the card)
let roundNext = false;   // ✉️ the post office's satchel (rank 5) waits for the round's receipt to close, the same way
function roomTrack(e, p) {
  track(e, p);
  if (!work || !p) return;
  const j = work.seam.job(), rk = Math.max(1, ((j && j.lad && j.lad.rank) | 0));
  if (!j || !j.at) return;
  if (e === 'town_chore' && p.at === 'post' && p.kind === 'sort' && j.at === 'post' && unlocked('post', 'round', rk)) roundNext = true;   // ✉️ a round that counted: the satchel
  if (e === 'town_fix' && j.at === 'condo') {
    const kind = p.kind === 'lamp' && unlocked('condo', 'lamps', rk) ? 'lamp' : (p.kind === 'litter' || p.kind === 'leaves') && unlocked('condo', 'litter', rk) ? 'litter' : '';
    if (kind) { work.seam.chore(kind); tell(kind); }
  }
  // 👻 THE NIGHT SHIFT (the arcade's rank 5, 24 Sep 2026): the night manager's reach is the square after dark — a ghost caught
  // there is one of Spinner's repairs, the town's best content turned into the arcade's work. Said once a day, like the lamps.
  if (e === 'town_ghost' && p.caught && j.at === 'condo' && unlocked('condo', 'ghosts', rk)) { work.seam.chore('ghost'); tell('ghost'); }
  if (e === 'town_shift' && p.at === 'cafe' && p.step === 'out' && (p.cups | 0) >= KEYS_CUPS && j.at === 'cafe' && unlocked('cafe', 'keys', rk) && room && room.seam.problems) {
    const c = PROPS.cafe, cx = c.x + c.w / 2, cy = c.base;
    const near = room.seam.problems().filter((q) => q.type !== 'crows' && Math.hypot(q.x - cx, q.y - cy) < KEYS_REACH).sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy))[0];
    if (near) tidyNext = near.id;
  }
}
const KEYS_CUPS = 5, KEYS_REACH = 520;   // ☕ a good shift, and how far the keyholder's tidying reaches from the café
function camTarget() {
  const fy = shiftFrameY(performance.now());   // 🎯 a counter shift frames the counter
  // 🚪 INDOORS THE CAMERA FRAMES THE ROOM (23 Sep 2026). It followed the banana against the whole world, so at the store's
  // shelves a phone showed the dark beyond the left wall and lost the till off the right — where the customer waits.
  // A room as wide as the view (PLAZA_FIT) is centred and stays still; a wider one pans between its own walls.
  const b = roomNow() && roomNow().box;
  if (b) {
    const a = b[0] * scale, n = b[2] * scale;
    // indoors the framing may pass the world's edge: outside the room is dark already (§22), as it is beside a centred room
    return { x: n <= viewW ? a - (viewW - n) / 2 : Math.max(a, Math.min(a + n - viewW, pos.x * scale - viewW / 2)), y: fy != null ? fy : Math.max(0, Math.min(Math.max(0, H * scale - viewH), pos.y * scale - viewH * 0.58)) };
  }
  return {
    x: Math.max(0, Math.min(Math.max(0, W * scale - viewW), pos.x * scale - viewW / 2)),
    y: Math.max(0, Math.min(Math.max(0, H * scale - viewH), fy != null ? fy : pos.y * scale - viewH * 0.58)),
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
// 📦 a banana carrying something walks slower — the restock chore's whole feel is the weight of
// the crate, so the room sets this and the loop reads it (docs/town-jobs-plan.md §4). Two things can be carried at once —
// the room's crate and the square's parcel — so each keeps its own and the walk takes the heavier; neither can undo the other
let slowRoom = 1, slowCarry = 1;
const slowNow = () => Math.min(slowRoom, slowCarry);
const keys = {};
addEventListener('keydown', (e) => {
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
  const k = e.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(k)) { keys[k] = true; e.preventDefault(); }
});
addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
// 🚪 THE TOWN'S ROOMS (19 Sep 2026). `inRoom` is the KEY of the room you are standing in and ''
// out on the square, so a second interior costs a table row rather than a second branch everywhere.
// Inside a room, its own walls and fittings are the only colliders and the only things a tap finds.
// ⭐ THE KEY IS THE DOOR IS THE SPOT: ROOMS.condo ↔ SPOTS.condo ↔ ABOUT.condo. Keep that true and
// entering, leaving and naming a room all fall out of one string.
// ⚠️ ONE PLATE, RE-KEYED. The old code built the plate once inside `if (!inPlate)` with the arcade's
// box and image baked in, so a second room would have shown the first one's picture for ever. The
// plate is now re-dressed on every entry and remembers which room it wears (the homestead does the
// same across its three tiers). ⚠️ keep this table ABOVE blocked()/thingAt()/tick(): a module-scope
// const read before its line is the partial-init trap, and it takes the whole town with it.
const ROOMS = { condo: ARCADE, store: STORE };
let inRoom = '', inShade = null, inPlate = null, inPlateKey = '';
const roomNow = () => (inRoom && ROOMS[inRoom]) || null;
function blocked(x, y) {
  const rm = roomNow();
  if (rm) {
    const [bx, by, bw, bh] = rm.box;
    if (x < bx || x > bx + bw || y < by || y > by + bh) return true;
    for (const [x0, y0, x1, y1] of rm.cols) if (x >= x0 && x <= x1 && y >= y0 && y <= y1) return true;
    return false;
  }
  if (x < BOUND || x > W - BOUND || y < BOUND || y > H - 6) return true;
  for (const [x0, y0, x1, y1] of OB_RECTS) if (x >= x0 && x <= x1 && y >= y0 && y <= y1) return true;
  for (const [cx, cy, r] of OB_CIRCLES) if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r) return true;
  return false;
}
function thingAt(wx, wy) {
  const rm = roomNow();
  if (rm) {   // 🚪 indoors ONLY the room's own fittings exist — the early return is what stops a tap
    for (const [key, x0, y0, x1, y1] of rm.spots) if (wx >= x0 && wx <= x1 && wy >= y0 && wy <= y1) return ['spot', key];
    return null;   // falling through here would find the shopfront under the store's own plate
  }
  const rk = room && room.at(wx, wy);   // 🏘️ a problem to fix, a ghost, an object on the ground, a stall
  if (rk) return rk;
  const lk = life.at(wx, wy);   // a flyer on the street, or a resident where they stand right now
  if (lk) return lk;
  for (const [key, spot] of Object.entries(SPOTS)) {
    const box = BOXES.find((b) => spot.x >= b[0] && spot.x <= b[2] && spot.y - 2 >= b[1] && spot.y - 2 <= b[3] && Math.abs(b[4] - spot.y) < 4);
    if (box && wx >= box[0] && wx <= box[2] && wy >= box[1] && wy <= box[3]) {
      // ☕ THE COFFEE CUP ANSWERS AT ITS SERVING WINDOW, NOT ITS WHOLE FRONT (Trym, 21 Sep: "to walk into
      // the coffee shop for work i should have to tap the window - the hitbox now is a bit large so when i
      // try to walk past the coffee shop i start working there because i auto-jump into the building").
      // A tap on the rest of the kiosk is a walk like any other tap on a wall.
      if (key === 'cafe' && CAFE_WIN && CAFE_WIN.length > 6) {
        const [x0, y0, x1, y1] = CAFE_WIN.slice(3);
        const pad = 14;   // a thumb's slack round the hatch, no more
        if (!(wx >= x0 - pad && wx <= x1 + pad && wy >= y0 - pad && wy <= y1 + pad)) return null;
      }
      return ['spot', key];
    }
  }
  return null;
}
let dress = null;        // 👕 the clothes shop's dressing room, once its chunk is in
let post = null;         // ✉️ the post office's mailbox, once its chunk is in
let info = null;         // 🗺️ the kiosk's rack of maps, once its chunk is in
let arriveThen = null;   // 🕹 a cabinet opens when the banana reaches it, not on the tap (a walk behind an open card reads as a bug)
let work = null;         // 💼 src/scripts/town-work.js, once the square stands
let crowd = null;        // 👥 src/scripts/town-crowd.js — the other players, once the square stands (22 Sep 2026)
let duties = null;       // 💼 src/scripts/town-duties.js — the work note, once the jobs are up (22 Sep 2026)
view.addEventListener('pointerdown', (e) => {
  if (!panel.hidden) return;   // 🃏 a card is open: it owns every tap until it closes
  if (e.target.closest('.wh, .tw-plank, .tw-toast, .tw-panel, .tw-tray, .tw-cup, .bwq-hint, .twd-chip')) return;   // 📎 the two notes fold on a tap; they never walk   // ☕ .tw-cup is the COUNTER's tray (the pocket owns .tw-tray) — a thumb on the gauge is not a walk
  if (working()) return;   // 🔒 held at the counter: the tray's Leave button is the way out
  arriveThen = null;   // a new tap cancels a pending cabinet
  const r = view.getBoundingClientRect();
  const wx = (e.clientX - r.left + camX) / scale, wy = (e.clientY - r.top + camY) / scale;
  const hit = thingAt(wx, wy);
  if (hit) {
    // 🕹 …and a DARK cabinet is any of the nine: the day's dark one is drawn from all of them, and on the four old
    // ones' days (no game on them) the tap only said "old cabinet", so the staff could not earn the repair (23 Sep 2026)
    const dark = inRoom === 'condo' && !!(room && room.cabinetDead && room.cabinetDead(hit[1]));
    if (inRoom === 'condo' && (CABINET[hit[1]] || dark)) {   // walk to the machine's front; the card opens when you get there
      const r2 = ROOMS.condo.spots.find((q) => q[0] === hit[1]);
      // the five on the back wall face down the room; the four old ones stand on the side walls and face in
      const side = r2 ? (r2[3] < 400 ? 1 : r2[1] > 780 ? -1 : 0) : 0;
      if (r2) { tgt.x = side ? (side > 0 ? r2[3] + 28 : r2[1] - 28) : (r2[1] + r2[3]) / 2; tgt.y = side ? r2[4] - 20 : r2[4] + 26; }
      // 🕹 a cabinet gone dark is the arcade's own staff's to wake: the tap is a repair, not a game
      const key = hit[1]; arriveThen = () => ((room && room.cabinetDead && room.cabinetDead(key)) ? room.cabinetRepair(key) : gameCard(key));
      return;
    }
    if (hit[0] === 'room') { room.tap(hit[1], (x, y, then) => { tgt.x = x; tgt.y = y; arriveThen = then; }); return; }   // 🏘️ walk to it, then it happens
    if (hit[0] === 'npc') {   // 🗣 walk up first, THEN the dialogue opens (the park's Old Peel rule)
      const n = life.standBy(hit[1]);
      if (n) {
        tgt.x = n.x + (pos.x < n.x ? -58 : 58); tgt.y = n.y + 8;
        const key = hit[1];
        // 🕯 QUEST FIRST. Chapter 2's marks hang on buildings, because the residents walk — so the
        // resident himself is the OTHER door to the same sheet, and it has to be the same door the
        // park uses for Old Peel. The everyday card is what he says when the story wants nothing.
        arriveThen = () => {
          const q = window.bwqTalk;
          if (q && q.who === key && q.open) { q.open(); return; }
          npcCard(key);
        };
      }
      return;
    }
    if (hit[0] === 'flyer') { const f = life.flyer(hit[1]); if (f) { tgt.x = f.x; tgt.y = f.y + 12; arriveThen = () => { if (life.pick(hit[1])) { float(f.x, f.y - 30, '+1'); hud.refresh(); } }; } return; }   // walk to it, then it is picked up: a point of rep, the park's litter rule
    if (inRoom === 'store' && serve && serve.tap(hit[1])) return;   // 🛒 a customer is waiting: the shelves and the till are theirs first
    const spot = SPOTS[hit[1]], wasIn = inRoom;
    // ⚠️ a thing with nothing to say says NOTHING. This used to fall back to the raw key, which was
    // harmless while every tappable thing had an entry — a room full of shelves would have toasted "sh1".
    if (!openFor(hit[1]) && ABOUT[hit[1]] && ABOUT[hit[1]][2]) say(ABOUT[hit[1]][2]);   // ⚠️ an EMPTY third field says nothing rather than flashing an empty toast
    if (inRoom !== wasIn) return;   // 🚪 a door was used: the room placed the banana; a walk target here would march it straight back out
    if (spot) { tgt.x = spot.x; tgt.y = spot.y + 30; }
    else { const rm = roomNow(); const r2 = rm && rm.spots.find((q) => q[0] === hit[1]); if (r2) { tgt.x = (r2[1] + r2[3]) / 2; tgt.y = r2[4] + 26; } }   // a fitting: stand at its front
    return;
  }
  tgt.x = Math.max(BOUND, Math.min(W - BOUND, wx)); tgt.y = Math.max(BOUND, Math.min(H - 8, wy));
});
let toastT = 0;
// 💬 TWO OF TRYM'S RULES MEET HERE, AND BOTH HOLD. A message sits ABOVE the popup veil (21 Sep:
// "should be in the foreground") — and nothing of the world's chatter lands ON an open card (the café
// receipt rule, town-cafe.spec: two yellow boxes overlapping read as one broken layout). So the toast
// keeps its z over the veil and moves out of the card's rectangle: below it when there is room, above
// it when there is not. ⚠️ run from BOTH doors — a toast said while a card is open, and a card opened
// while a toast is up (the café's "off" line lands a beat before its receipt does).
function placeToast(opening) {
  toastEl.style.top = ''; toastEl.style.bottom = '';
  // ☕✉️ A COUNTER'S TRAY IS UP: the toast stands at the top of the view — under the HUD strip, AND under the
  // journal chips (the quest note, the work note), which is exactly where it used to land: the café's own
  // recipe measured the strip alone, and the notes were added later (seen on the post office's walk, 22 Sep).
  // Measured on every toast, so a note that unfolds or folds between two lines moves the next one.
  if (toastEl.classList.contains('is-above-tray')) {
    const v = view.getBoundingClientRect();
    let low = 0;
    for (const el of document.querySelectorAll('.wh, .bwq-hint, .bwq-hint__badge, .twd-chip, .twd-chip__badge')) { const r = el.getBoundingClientRect(); if (r.height > 0 && r.bottom > v.top) low = Math.max(low, r.bottom - v.top); }
    toastEl.style.setProperty('--tw-toast-top', Math.max(14, Math.round(low) + 10) + 'px');
  }
  if (toastEl.hidden || !panel || panel.hidden) return;
  const card = panel.querySelector('.tw-card');
  const v = view.getBoundingClientRect(), c = card ? card.getBoundingClientRect() : null, t = toastEl.getBoundingClientRect();
  if (!c || t.bottom <= c.top || t.top >= c.bottom) return;
  const below = v.bottom - c.bottom, above = c.top - v.top;
  if (below >= t.height + 20) toastEl.style.bottom = Math.max(14, Math.round((below - t.height) / 2)) + 'px';
  else if (above >= t.height + 20) { toastEl.style.bottom = 'auto'; toastEl.style.top = Math.round((above - t.height) / 2) + 'px'; }
  // 🃏 and when a card that fills the view has just OPENED, the line said before it gives way rather than sit on it — the
  // store's own arrival line landed on Pip's shelf the moment the shelf moved inside (23 Sep 2026). A line said while the
  // card is up (a purchase) is about the card, and stays.
  else if (opening) { toastEl.hidden = true; clearTimeout(toastT); }
}
function say(text) {
  if (!text) return;   // a line the rig has not written (or a chunk not landed yet) says nothing, never an empty box
  toastEl.textContent = text;
  toastEl.hidden = false;
  placeToast();
  clearTimeout(toastT);
  // ☕✉️ above a tray the toast stands at the TOP of the view while the eyes are at the bottom, and four seconds
  // was gone before anyone looked up (Trym, 22 Sep: "it disappeared so quickly"). Seven there; four elsewhere.
  toastT = setTimeout(() => { toastEl.hidden = true; }, toastEl.classList.contains('is-above-tray') ? 7000 : 4200);
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

// ---- 🌦 the weather — visuals only. The town has no health and no roster to thin
// out; it just gets the same sky as everywhere else (Trym, 13 Sep 2026). It hangs on
// #twView, never #twWorld, which the camera translates every frame.
const weather = mountWeather(view);

// ---- the loop
let last = performance.now(), leaving = false;
function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  // ⭐ NOTHING MOVES BEHIND AN OPEN CARD (Trym, 20 Sep 2026: "when a user opens a popup in bananaworld,
  // all movement in the background should be locked. it keeps happening that when i click on content in
  // a popup my banana moves in the background").
  //
  // ⚠️ AND THE TAP WAS NEVER THE LEAK. Every guard in this world stops a tap INSIDE a popup from
  // starting a walk, and all four areas were clean when probed that way. What actually happened is that
  // opening the card and starting the walk were the SAME tap: tapping a building answers with its card
  // AND sets a walk target at its door, so the banana set off across the square underneath the thing you
  // had just opened. Measured on the Exchange: 25 px of travel with the card up.
  //
  // So the lock is on the STEP, not on the tap. However a target got set, nothing crosses the square
  // while a card is up — and the target is pinned to where you stand, so closing the card leaves you
  // where you were rather than releasing a walk you never asked for.
  const frozen = !panel.hidden;
  if (frozen) { tgt.x = pos.x; tgt.y = pos.y; }
  let dx = 0, dy = 0;
  const kb = !frozen && !working();   // 🃏 an open card owns the keyboard too (Snake's arrows must not walk the town banana); 🔒 and so does a shift
  if (kb && (keys.arrowleft || keys.a)) dx -= 1;
  if (kb && (keys.arrowright || keys.d)) dx += 1;
  if (kb && (keys.arrowup || keys.w)) dy -= 1;
  if (kb && (keys.arrowdown || keys.s)) dy += 1;
  if (dx || dy) { tgt.x = pos.x; tgt.y = pos.y; const n = Math.hypot(dx, dy); dx /= n; dy /= n; }
  else { const ex = tgt.x - pos.x, ey = tgt.y - pos.y, d = Math.hypot(ex, ey); if (d > 2) { dx = ex / d; dy = ey / d; } }
  if (dx || dy) {
    const step = SPEED * dt * slowNow();
    const nx = pos.x + dx * step, ny = pos.y + dy * step;
    // ⚠️ A SLIDE THAT GOES NOWHERE IS A STOP. Blocked head-on, the banana slides along the wall by its
    // sideways component — and straight below a planter that component was 0.005, so it crept 0.01 px a
    // frame for ever, never "arrived, or stuck", and a round waiting on the walk never began (22 Sep).
    // Under a twelfth of the speed the slide is invisible anyway; it stops, and the pending deed fires.
    if (!blocked(nx, ny)) { pos.x = nx; pos.y = ny; }
    else if (Math.abs(dx) > 0.12 && !blocked(nx, pos.y)) pos.x = nx;
    else if (Math.abs(dy) > 0.12 && !blocked(pos.x, ny)) pos.y = ny;
    else { tgt.x = pos.x; tgt.y = pos.y; }
  }
  // ⚠️ and a pending arrival does NOT fire while a card is up: freezing the target would otherwise read
  // as "arrived" on the very next frame and open a second card over the first.
  if (!frozen && arriveThen && Math.hypot(tgt.x - pos.x, tgt.y - pos.y) <= 2) { const f = arriveThen; arriveThen = null; f(); }   // arrived, or stuck: the cabinet opens
  me.style.left = pct(pos.x, W); me.style.top = pct(pos.y, H); me.style.zIndex = String((inRoom ? 2100 : 100) + Math.round(pos.y));
  cam(false);
  drawMe();
  life.tick(now, dt);
  if (crowd) crowd.tick(now);   // 👥 the other players' frames, and my own position out to them
  weather.tick(now);
  if (room) room.tick(now, dt);
  if (room && inRoom === 'condo' && room.sweepAt) room.sweepAt(pos.x, pos.y);   // 🕹 walking onto arcade litter sweeps it (staff only)
  if (work) work.tick(now);
  if (sort) sort.tick(now);   // ✉️ the sorting round's clock and its mark
  if (deliver) deliver.tick(); else if (!deliverP && deliverWanted()) loadDeliver();   // 📦 the store's parcel (rank 3)
  if (roundNext && panel.hidden && deliver) { roundNext = false; deliver.give('round'); }   // ✉️ the satchel, once the receipt is closed
  if (tidyNext && panel.hidden && room && room.seam.fix) {   // ☕ the keyholder's tidy, once the receipt is closed — and only a mess still lying there is
    const id = tidyNext; tidyNext = null;                    // tidied and said: somebody may have picked it up while the receipt was up
    if (room.seam.problems().some((q) => q.id === id)) { room.seam.fix(id); tell('tidy'); }
  }   // ☕ the keyholder's tidy, once the receipt is closed
  { const rm = roomNow(); if (rm) { const [x0, y0, x1, y1] = rm.exit; if (pos.x >= x0 && pos.x <= x1 && pos.y >= y0 && pos.y <= y1) exitRoom(); } }
  if (!inRoom && !leaving && pos.y > H - 40 && Math.abs(pos.x - DOORS.south.x) < 70) {
    leaving = true;
    say(lifeWords('toasts').road);
    setTimeout(() => { location.href = '/park/'; }, 600);
  }
  requestAnimationFrame(tick);
}

// ---- 🃏 THE CARDS (round three, 11 Sep 2026): the town's three loops, touchable.
// The world's card grammar in the town's brick warmth. Prototype rules: nothing
// is saved, no coins move, the wheel's roll is the phone's — on the real one the
// server picks the wedge and writes the tape. The Exchange is the honest one:
// it reads the farm you actually have on this device and today's real price.
const panel = document.getElementById('twPanel'), cardBody = document.getElementById('twCardBody'), card = panel.querySelector('.tw-card');
function openCard(html) { cardBody.innerHTML = html; panel.hidden = false; placeToast(true); }
// ⚠️ EVERY MODIFIER THIS CARD CAN WEAR IS NAMED HERE. openCard() never clears a class, so a modifier
// left behind styles whatever the player opens NEXT — and every chunk that runs a loop inside the card
// (the dialogue's typewriter, an arcade game, the dressing room's mirror) stops here or it runs forever.
function closeCard() { panel.hidden = true; cardBody.innerHTML = ''; card.classList.remove('tw-card--npc', 'tw-card--health', 'tw-card--dress', 'tw-card--post', 'tw-card--info'); if (dialog) { dialog.stop(); dialog = null; } if (arcGame) { arcGame.stop(); arcGame = null; } if (dress) { dress.stop(); } if (post) { post.stop(); } if (info) { info.stop(); } }
document.getElementById('twCardX').addEventListener('click', closeCard);
panel.addEventListener('click', (e) => { if (e.target === panel) closeCard(); });
// 🗣 A RESIDENT'S DIALOGUE — THE WORLD'S card, not a new one (Trym, 12 Sep: "the dialogue popups for
// the NPCs should follow the existing dialogue popups we have … like Old Peel in the park"). The
// template is src/lib/world-dialogue.js + /css/dialogue.css, lifted from Old Peel: the tilted waist-up
// portrait over the corner, the name, their line, and the question deck whose answers type out.
// Nothing a resident says is ever drawn over their head; this card is the only place they speak.
let dialog = null;
// 🏘️ TOWN LIFE (14 Sep 2026): the town's condition, problems, shop, nights and ghosts — its own
// chunk (town-room.js), loaded after the assets so this script stays under its budget
let room = null;
function npcCard(key) {
  const d = life.talk(key);
  if (!d) return;
  openCard('');
  card.classList.add('tw-card--npc');   // the portrait leans out past the corner: let it
  // 💼 a boss can be asked for a job, and the question sits with the two they already answer
  const jobQs = work && work.topicsFor ? work.topicsFor(key) : [];   // the job question, and the way out while the job is yours
  dialog = mountDialogue(cardBody, {
    // 🪜 a boss's NEWS (a promotion waiting) is the first question on the card; the job's others follow the resident's own
    name: d.name, line: d.line, topics: jobQs.length ? [...jobQs.filter((t) => t.news), ...d.topics, ...jobQs.filter((t) => !t.news)] : d.topics,   // no role line: the name and the portrait are the header (Trym, 12 Sep)
    // ⚠️ A PORTRAIT IS A FACE, NOT A FULL LENGTH. `extras` holds exactly the resident's HELD TOOL
    // (town-life.js builds it as { [r.tool]: true }), and a wide one paints straight over the name
    // beside it — Pip's rubber chicken covered the P in "Pip" entirely, on the very card you tap to
    // ask him for a job. The hat and the glasses stay, because those are his face. The tool is still
    // in his hand out in the square, where it belongs. (Seen on the QA sweep, 20 Sep.)
    portrait: (ctx, size) => drawComposite(ctx, size, 0, { ...d.outfit, extras: {} }),
    onClose: closeCard,
  });
}
// 👕 the dressing room, loaded on the tap that wants it. ⚠️ the card opens when the chunk lands, not
// when the tap happens — a card that appears half a second later is the honest shape of a lazy import,
// and the alternative (a spinner in a card) is a website's answer, not a game's.
// ✉️ the post office's mailbox, loaded on the tap that wants it.
// ⚠️ YOUR HOUSE IS YOUR ADDRESS. The mailbox room is keyed by the yard slug the server gave you when you
// claimed a homestead, which is the plan's own shape (§6: "the mailbox room keyed by slug") — a post
// office delivers to houses. A player with no claimed yard therefore has no address yet, and today sees
// the same closed-counter line as everybody else, because the rail ships shut. ⚠️ that case wants its own
// line before the rail is turned on; it is not the same thing as the counter being closed.
const mySlug = () => { try { return (JSON.parse(localStorage.getItem('hs-v1') || '{}') || {}).slug || ''; } catch (e) { return ''; } };
let postP = null;
// ✉️ THE SORTING ROUND — the post office's counter, for its own staff (22 Sep 2026): its own lazy chunk on the
// café's tray. The mailbox card carries the button; the round starts when the banana REACHES the counter
// (the cabinets' rule), so a tray never rises over a walk.
let sort = null, sortP = null;
// 🔒 WORKING HOLDS THE BANANA (Trym, 22 Sep: "i can still move in the background while pressing the work-tasks … movement
// should be locked … better to lock it and have a button for leave work"). While a shift or a round is on, a tap on
// the world does not walk and a key does not move: the tray's own Leave button is the way out (the geography rule —
// off the mark it folds, far away it ends — stays underneath as the safety net for a banana that is moved anyway).
const working = () => !!(room && room.seam && room.seam.working && room.seam.working()) || !!(sort && sort.on()) || !!(repair && repair.on());
// 🔧 THE ARCADE'S REPAIR GAME (23 Sep 2026) — its own lazy chunk, loaded the first time a member of staff reaches a dark
// cabinet. The room hands over the cabinet; the game hands back a grade and the room wakes it.
let repair = null, repairP = null;
// 🛒 THE STORE'S CUSTOMERS (23 Sep 2026) — their own lazy chunk, loaded when the store's own staff walk into it
// 📦 THE STORE'S HOME DELIVERY (the store's rank 3, 23 Sep 2026) — its own lazy chunk, loaded once a worker of that rank holds the
// store: a parcel on the store's floor, carried across the square to a resident's door (town-deliver.js)
let deliver = null, deliverP = null;
const deliverWanted = () => { const j = work ? work.seam.job() : null, rk = Math.max(1, ((j && j.lad && j.lad.rank) | 0)); return !!(j && ((j.at === 'store' && unlocked('store', 'deliver', rk)) || (j.at === 'post' && unlocked('post', 'round', rk)))); };
function loadDeliver() {
  if (!deliverP) {
    deliverP = import('./town-deliver.js')
      .then((m) => { deliver = m.bootTownDeliver({ world, W, H, pct, pos, say, track, burst: (x, y) => burstAt(x, y, '', true),
        job: () => (work ? work.seam.job() : null), chore: (k, g) => (work && work.seam.chore ? work.seam.chore(k, g) : null),
        open: () => !!(room && room.seam.calls && room.seam.calls('store').some((c) => c.kind === 'deliver')), room: () => inRoom, homeOf: (k) => life.homeOf(k),
        setSlow: (v) => { slowCarry = +v > 0 ? +v : 1; }, morning: () => life.beat() === 0 }); if (window.__town) window.__town.deliver = deliver.seam; return deliver; })
      .catch((e) => { deliverP = null; console.warn('[town] the parcel did not come', e); return null; });
  }
  return deliverP;
}
let serve = null, serveP = null;
function loadServe() {
  if (!serveP) {
    serveP = import('./town-serve.js')
      .then((m) => { serve = m.bootTownServe({ world, view, W, H, pct, pos, say, track, drawMe: (g, size, frame, outfit) => drawComposite(g, size, frame, outfit),
        walk: (x, y, fn) => { tgt.x = x; tgt.y = y; arriveThen = fn; }, burst: (x, y) => burstAt(x, y, '', true),
        items: () => (room && room.seam.shelf ? room.seam.shelf() : []), job: () => (work ? work.seam.job() : null),
        chore: (k, g) => (work && work.seam.chore ? work.seam.chore(k, g) : null) }); if (window.__town) window.__town.serve = serve.seam; return serve; })
      .catch((e) => { serveP = null; console.warn('[town] the customers did not come', e); return null; });
  }
  return serveP;
}
function loadRepair() {
  if (!repairP) {
    repairP = import('./town-repair.js')
      .then((m) => { repair = m.bootTownRepair({ host: view, say, track, rank: () => { const j = work ? work.seam.job() : null; return Math.max(1, ((j && j.lad && j.lad.rank) | 0)); }, onFixed: (key, g, lit) => { if (room && room.seam.cabinetFixed) room.seam.cabinetFixed(key, g, lit); } }); if (window.__town) window.__town.repair = repair.seam; return repair; })
      .catch((e) => { repairP = null; console.warn('[town] the repair did not load', e); return null; });
  }
  return repairP;
}
function loadSort() {
  if (!sortP) {
    sortP = import('./town-sort.js')
      .then((m) => { sort = m.bootTownSort({ host: view, PROPS, pos, say, track: roomTrack, openCard, closeCard, esc, world, W, H, inside: () => !!inRoom, chore: (k, g) => (work && work.seam.chore ? work.seam.chore(k, g) : null), job: () => (work ? work.seam.job() : null) }); return sort; })
      .catch((e) => { sortP = null; console.warn('[town] the sorting counter did not load', e); return null; });
  }
  return sortP;
}
const isStaff = (at) => !!(work && work.seam && work.seam.job().at === at);
function startSort() {
  const p = PROPS.post;
  if (!p || !isStaff('post')) return false;
  closeCard();
  const mx = p.x + p.w / 2, my = p.base + 30;   // the counter's mark: the front's foot, on the street
  // already at the counter: the round starts now. Otherwise the walk, and the round on arrival — or where
  // the walk stops, in which case the counter says it is a step away (town-sort.js clockIn's own guard)
  if (Math.hypot(pos.x - mx, pos.y - my) <= 120) { loadSort().then((s) => { if (s) s.clockIn(); }); return true; }
  tgt.x = mx; tgt.y = my;
  arriveThen = () => { loadSort().then((s) => { if (s) s.clockIn(); }); };
  return true;
}
function postCard() {
  if (!postP) {
    postP = import('./town-post.js')
      .then((m) => { post = m.bootTownPost({ openCard, closeCard, card, say, track, slug: mySlug, staff: () => isStaff('post'), sort: startSort }); return post; })
      .catch((e) => { postP = null; console.warn('[town] the mailbox did not open', e); return null; });
  }
  postP.then((p) => { if (p) p.openBox(); });
}
// 🗺️ THE INFORMATION KIOSK'S RACK OF MAPS. Its own lazy chunk, and the heaviest of the three by
// what it PULLS rather than by what it weighs: four baked area maps, one of which is 1400 px wide. A
// player who never taps the kiosk downloads none of them, and the thumbnails are `loading="lazy"` so
// even opening the rack does not fetch a full map until one is asked for.
// ⚠️ town-room.js gets first refusal on 'info' and keeps it — a kiosk with its shutter down answers
// with the town's own closed line, which is the band talking and not the maps.
let infoP = null;
function infoCard() {
  if (!infoP) {
    infoP = import('./town-info.js')
      .then((m) => { info = m.bootTownInfo({ openCard, closeCard, card, track, shut: () => !!(room && room.seam && room.seam.shutNow && room.seam.shutNow('info')) }); return info; })
      .catch((e) => { infoP = null; console.warn('[town] the maps did not open', e); return null; });
  }
  infoP.then((i) => { if (i) i.open(); });
}
let dressP = null;
function dressCard() {
  if (!dressP) {
    dressP = import('./town-dress.js')
      .then((m) => { dress = m.bootTownDress({ openCard, closeCard, card, track, onWear: rewear }); return dress; })
      .catch((e) => { dressP = null; console.warn('[town] the wardrobe did not open', e); return null; });
  }
  dressP.then((d) => { if (d) d.open(); });
}
// 💼 THE STAFF CARD — your own workplace's card (23 Sep 2026, town-staff.js; the plan's slice 0a). A tap on the place
// you work opens it when the banana gets there, the way every reachable thing in this town answers; the work note is
// its other door. Its own lazy chunk: nobody without a job downloads a byte of it. Everybody else's tap, and your tap
// on anybody else's place, is untouched (openPlain below is the town's tap as it always was).
let staff = null, staffP = null;
function loadStaff() {
  if (!staffP) {
    staffP = import('./town-staff.js')
      .then((m) => {
        staff = m.bootTownStaff({ openCard, closeCard, esc, track, act: staffAct,
          job: () => (work ? work.seam.state() : { at: '' }),
          calls: (at) => (room && room.seam.calls ? room.seam.calls(at) : []),
          shut: (at) => !!(room && room.seam.shutNow && room.seam.shutNow(at)) });
        return staff;
      })
      .catch((e) => { staffP = null; console.warn('[town] the staff card did not open', e); return null; });
  }
  return staffP;
}
function staffCard(at, door) {
  return loadStaff().then((s) => {
    if (s && s.open(at, door)) return true;
    if (door === 'place') openPlain(at);   // no card after all (the words, or the job changed on the walk): the place answers as it always has
    return false;
  });
}
// the card's buttons hand their verb back here, and each does what a tap on the world already does
function walkThen(at, fn) {
  if (inRoom && inRoom !== at) exitRoom();
  const s = SPOTS[at];
  if (inRoom === at || !s || Math.hypot(pos.x - s.x, pos.y - (s.y + 30)) <= 12) { fn(); return; }
  tgt.x = s.x; tgt.y = s.y + 30; arriveThen = fn;
}
function staffAct(at, what) {
  if (what === 'go') {
    if (at === 'post') { if (inRoom) exitRoom(); startSort(); return; }   // ✉️ the round walks you to its own counter
    walkThen(at, () => { if (room && room.seam.clockIn) room.seam.clockIn(at); });   // ☕🍋 the shift starts at the counter
    return;
  }
  if (what === 'answer' || (what === 'second' && at === 'condo')) { walkThen(at, () => { if (inRoom !== at) enterRoom(at); }); return; }
  if (what === 'second' && at === 'post') { postCard(); return; }
  // 🏪 Pip's shelf, as a customer — and it is on the counter inside now, so the walk goes in first
  if (what === 'second' && at === 'store') walkThen('store', () => { if (inRoom !== 'store') enterRoom('store'); if (room && room.seam.cards) room.seam.cards.store(); });
}
// 🚪 A BUILDING WITH AN INSIDE IS A DOOR (Trym, 23 Sep 2026: "for the general store - right now when you click on the
// building, you get a popup with all the goods you can buy and a 'enter the store' button at the bottom of the popup - so
// this needs to move to inside the store instead since you can walk inside that store before anything happens, the same
// goes for the arcade really, theres an inside of that building aswell, while the others doesnt"). A tap on the store or
// the arcade walks the banana to its door and in — customers and staff alike — and what the place has for you is inside:
// Pip's shelf on the counter, the cabinets, the day's calls lit for its staff. A shut or locked front still answers at the
// door (openPlain), because there is no inside to go to then.
const INSIDES = ['store', 'condo'];
const DOOR_CARD = ['cafe', 'stand', 'post'];   // 💼 the workplaces with no inside answer their staff with the staff card
const barred = (key) => !!(room && ((room.seam.shutNow && room.seam.shutNow(key)) || (room.seam.hoardNow && room.seam.hoardNow(key))));
function openFor(key) {
  if (!inRoom && INSIDES.includes(key) && ROOMS[key] && !barred(key)) {
    arriveThen = () => { if (!inRoom) enterRoom(key); };
    return true;
  }
  // 💼 your own workplace (one with no inside) answers you with your staff card, when the banana gets there
  if (!inRoom && DOOR_CARD.includes(key) && isStaff(key) && !(room && room.seam.hoardNow && room.seam.hoardNow(key))) {
    arriveThen = () => { staffCard(key, 'place'); };
    return true;
  }
  return openPlain(key);
}
function openPlain(key) {
  if (room && room.openFor(key)) return true;   // 🏘️ the store's shelf, the notice board, a shut kiosk, a stall
  // 👕 THE CLOTHES SHOP is a dressing room and nothing else — no room, no job, no boss — so it lives
  // here beside the wheel rather than in town-room.js, whose business is the town's condition. Its own
  // lazy chunk: a player who never opens the wardrobe downloads none of it, and town-room is at 84%.
  if (key === 'clothes') { dressCard(); return true; }
  if (key === 'post') { postCard(); return true; }   // ✉️ your letters, and writing back
  if (key === 'info') { infoCard(); return true; }   // 🗺️ the rack of maps, and the rave's flyer
  if (key === 'wheel' || key === 'exchange') return marketCard(key);   // 🎡📈 real since 23 Sep 2026 (town-market.js)
  // 🚪 a door with a room behind it. The store and the arcade are walked into by openFor above (23 Sep 2026); a shut or
  // locked front reaches town-room.js first and says why. This is the fallback for any later door of their kind.
  if (ROOMS[key] && !inRoom) { enterRoom(key); return true; }
  if (key === 'bus') { travel.open(); return true; }   // the shelter is the travel door's place in the world
  if (inRoom === 'condo' && CABINET[key]) return gameCard(key);   // a cabinet is the arcade's alone: the key space is shared by every room
  return false;
}
// 🚪 step inside: the shade covers the town, the room floats over it, the banana rides above both
function enterRoom(key) {
  const rm = ROOMS[key]; if (!rm || inRoom) return;
  inRoom = key;
  world.classList.add('is-inside');
  world.dataset.room = key;   // 💼 which room: the work note stays up inside your own workplace
  if (duties) duties.render();
  if (crowd) crowd.rooms();   // 👥 the square's crowd is on another plate now
  if (!inShade) { inShade = document.createElement('div'); inShade.className = 'tw-inshade'; world.appendChild(inShade); }
  if (!inPlate) { inPlate = document.createElement('div'); inPlate.className = 'tw-room'; world.appendChild(inPlate); }
  // ⚠️ RE-DRESS THE PLATE. The box and the picture used to be set once, inside the `if (!inPlate)`
  // that built it — so the second room would have worn the first one's image for ever, at the first
  // one's size, with nothing on screen to say why.
  if (inPlateKey !== key) {
    const [bx, by, bw, bh] = rm.box;
    inPlate.style.left = pct(bx, W); inPlate.style.top = pct(by, H); inPlate.style.width = pct(bw, W); inPlate.style.height = pct(bh, H);
    inPlate.style.backgroundImage = 'url(/assets/town/' + rm.img + ')';
    inPlateKey = key;
  }
  inShade.hidden = false; inPlate.hidden = false;
  // 🏠 the room is appended to #twWorld, which carries will-change: transform and is
  // therefore its own stacking context — its z-2010 cannot out-stack a z-8 sheet on the
  // view. Without this it rains inside the arcade.
  weather.indoors(true);
  pos.x = rm.spawn[0]; pos.y = rm.spawn[1];
  tgt.x = pos.x; tgt.y = pos.y - 34;   // a step into the room, never back out through the door
  cam(true);
  if (room && room.roomShow) room.roomShow(key);   // 🧺 what the room shows of itself: the store's shelves fill with the town's health
  const rw = room && room.seam && room.seam.copyOf ? room.seam.copyOf('rooms') : null;   // the words are the rig's
  if (rw && rw[key]) say(rw[key]);
  if (key === 'store' && work && (work.seam.job() || {}).at === 'store') loadServe().then((c) => { if (c && inRoom === 'store') c.enter(); });   // 🛒 the store's own staff: customers may come in
}
function exitRoom() {
  const key = inRoom; if (!key) return;
  if (serve) serve.leave();   // 🛒 customers belong to the shop
  inRoom = '';
  if (room && room.roomShow) room.roomShow('');
  world.classList.remove('is-inside');
  delete world.dataset.room;
  if (duties) duties.render();
  if (crowd) crowd.rooms();   // 👥 …and back
  if (inShade) inShade.hidden = true;
  if (inPlate) inPlate.hidden = true;
  weather.indoors(false);
  const d = SPOTS[key] || SPAWN;   // ⭐ the key IS the door: you come out of the one you went in by
  pos.x = d.x; pos.y = d.y + 30;
  tgt.x = pos.x; tgt.y = pos.y + 30;
  cam(true);
}
const esc = (v) => String(v == null ? '' : v).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

// ---- 🎡📈 THE MARKET: the Wheel of Peel's card and the Exchange's live in their own lazy chunk (town-market.js)
// since 23 Sep 2026, when the server started rolling, charging and paying. The wheel painted on the stall stays
// here, because it is scenery the square draws at boot.
// ⚠️ `mini` LEAVES THE WORDS OFF. The same eight wedges are painted on the stall's counter at 30 world
// px, where a 24-px label is a smear of grey — the shape and the colours are what carry it that small.
function drawWheel(cv, mini, labels) {
  const ctx = cv.getContext('2d'), R2 = cv.width / 2, n = WEDGES.length, per = Math.PI * 2 / n;
  ctx.clearRect(0, 0, cv.width, cv.height);
  WEDGES.forEach((w, i) => {
    const a0 = -Math.PI / 2 + i * per, a1 = a0 + per;
    ctx.beginPath(); ctx.moveTo(R2, R2); ctx.arc(R2, R2, R2 - 6, a0, a1); ctx.closePath();
    ctx.fillStyle = w[1]; ctx.fill(); ctx.lineWidth = mini ? 7 : 4; ctx.strokeStyle = '#141208'; ctx.stroke();
    if (mini || !labels) return;
    // the label reads upright on both halves: left-side wedges are turned half a circle and drawn from the rim inward
    const mid = a0 + per / 2, left = Math.cos(mid) < 0;
    ctx.save(); ctx.translate(R2, R2); ctx.rotate(left ? mid + Math.PI : mid); ctx.textAlign = left ? 'left' : 'right'; ctx.textBaseline = 'middle';
    ctx.fillStyle = w[2]; ctx.font = 'bold 24px "Archivo Black", "Arial Black", sans-serif'; ctx.fillText(labels[i] || '', left ? -(R2 - 26) : R2 - 26, 0); ctx.restore();
  });
  ctx.beginPath(); ctx.arc(R2, R2, mini ? 22 : 26, 0, Math.PI * 2); ctx.fillStyle = '#141208'; ctx.fill();
  ctx.beginPath(); ctx.arc(R2, R2, mini ? 11 : 14, 0, Math.PI * 2); ctx.fillStyle = '#ffe135'; ctx.fill();
}
// ⚠️ CALLED HERE, NOT WHERE IT IS DEFINED. stallWheel() paints with drawWheel(), and a call from up beside the
// planks once threw out of a temporal dead zone — a module-scope throw kills every line after it, and the whole
// town booted to an empty green field (memory: partial-init-trap — consts above init, boot calls last).
stallWheel();

let market = null, marketP = null;
function loadMarket() {
  if (!marketP) {
    marketP = import('./town-market.js').then((m) => (market = m.bootMarket({ openCard, closeCard, isOpen: () => !panel.hidden,
      say, track, esc, drawWheel, pocketPaint, burstAt, view, pos, PROPS, FRONTS })));
    marketP.catch(() => { marketP = null; });
  }
  return marketP;
}
// a card from the market; if the chunk cannot load, the stall says what it is, the way a shut place does
function marketCard(which) { loadMarket().then((m) => m[which]()).catch(() => say(FRONTS[which] || '')); return true; }

// ---- 🏪 the General Store and the POCKET: buy, carry at most five of three kinds, use where it works
// 👝 THE POCKET: what the Wheel of Peel's prizes go into (a firework, a lure), at most five of a kind. Since 23 Sep
// 2026 it is the pass's own: pocket_<kind> counts in (the wheel's wins, written by the pass worker) and
// pocket_<kind>_used counts out, so a lure won here is still in the pocket at the beach and on your other devices.
const pocketOf = () => { const s = passGet().stats || {}; const o = {}; for (const k of POCKET_KINDS) { const n = pocketHave(s, k); if (n) o[k] = n; } return o; };
function pocketAdd(k) { passStat('pocket_' + k, 1); pocketPaint(); }   // 🧪 the QA seam's; a real prize arrives from the pass worker
function pocketPaint() {
  const n = Object.values(pocketOf()).reduce((a, b) => a + b, 0);
  // the bar's verb slot: hidden while empty, the count when not (the park's tool-slot grammar)
  pocketBtn.hidden = !n;
  pocketN.textContent = String(n);
  if (!n) tray.hidden = true;
}
const tray = document.getElementById('twTray');
const pocketBtn = document.getElementById('twPocket');
// the slot is a glyph with a count badge, never a word (the HUD is icons — Trym, 11 Sep); the pack's own pixel pocket
pocketBtn.innerHTML = iconSvg('pocket', { size: 22 }) + '<b class="tw-act__n" id="twPocketN">0</b>';
const pocketN = document.getElementById('twPocketN');
const POCKET_ICON = { firework: 'party-popper-solid', lure: 'fish-solid' };
// ⚠️ TWO TRAYS CANNOT SHARE THE BOTTOM OF THE SCREEN. The pocket is z 901 and the counter is z 1200,
// so during a shift the pocket opened completely behind the counter's tray and a tap on the bag did
// nothing a player could see. The counter yields while the bag is open and comes back when it closes —
// the same courtesy the toast already does for the pocket, two lines down.
const cafeYield = (v) => { try { const c = room && room.seam && room.seam.cafe && room.seam.cafe(); if (c && c.hold) c.hold(v); } catch (e) {} try { const l = room && room.seam && room.seam.lemon && room.seam.lemon(); if (l && l.hold) l.hold(v); } catch (e) {} try { if (sort && sort.hold) sort.hold(v); } catch (e) {} try { if (repair) repair.hold(v); } catch (e) {} try { if (serve) serve.hold(v); } catch (e) {} };
function toggleTray() {
  if (!tray.hidden) { tray.hidden = true; cafeYield(false); return; }
  cafeYield(true);
  toastEl.hidden = true; clearTimeout(toastT);   // the tray is what the player asked for; the chatter yields
  let html = '';
  const P = lifeWords('pocket');
  // a row = glyph + name; the verb button only where the item works HERE, otherwise one small line
  // saying where it does (a sentence in a button wrapped the row — buttons never line-break)
  for (const [k, v] of Object.entries(pocketOf())) if (v) {
    const here = k === 'firework';
    html += '<div class="tw-row"' + (here ? '' : ' data-say="' + k + '" role="button"') + '><div class="tw-row__it">' + iconSvg(POCKET_ICON[k], { size: 22 })
      + '<div><b>' + esc(P[k] || '') + ' ×' + v + '</b>' + (here ? '' : '<small>' + esc(P.lureWhere || '') + '</small>') + '</div></div>'
      + (here ? '<button type="button" data-use="' + k + '">' + esc(P.use || '') + '</button>' : '') + '</div>';
  }
  tray.innerHTML = html || '<div class="tw-row"><b>' + esc(P.empty || '') + '</b></div>';
  tray.hidden = false;
  // the tray folds first either way, so the toast never lands on it
  tray.querySelectorAll('[data-use]').forEach((b) => b.addEventListener('click', () => { tray.hidden = true; cafeYield(false); passStat('pocket_firework_used', 1); pocketPaint(); firework(); }));
  tray.querySelectorAll('[data-say]').forEach((r) => r.addEventListener('click', () => { tray.hidden = true; cafeYield(false); say(lifeWords('toasts').lure); }));
}

// ---- 🕹 THE CABINETS (12 Sep 2026): five games, one module, loaded the first time a cabinet is tapped.
// The games live in town-games.js so the town's own script stays under its budget; the
// card, the board and the score submit live there too. This side only knows which
// cabinet holds which game, draws the banana once for it, and keeps the one handle.
const CABINET = { g1: 'peelout', g2: 'snake', g3: 'invaders', g4: 'pong', g5: 'stack' };
let arcGame = null, gamesMod = null;
function bananaCanvas() { const off = document.createElement('canvas'); off.width = off.height = CV; drawComposite(off.getContext('2d'), CV, 1, ME_DRAW); return off; }
function gameCard(key) {
  const g = CABINET[key]; if (!g) return false;
  const go = (m) => { if (arcGame) { arcGame.stop(); arcGame = null; } arcGame = m.openGame(g, { openCard, say, bananaCanvas, words: () => lifeWords('toasts') }); };
  if (gamesMod) go(gamesMod);
  else {
    openCard('<h2>' + ABOUT[key][2].split('.')[0] + '</h2><p class="tw-card__sub">' + esc(lifeWords('toasts').warming || '') + '</p>');
    import('./town-games.js').then((m) => { gamesMod = m; if (!panel.hidden) go(m); }).catch(() => { closeCard(); say(lifeWords('toasts').asleep); });
  }
  return true;
}

// ---- 🎆 the firework: a burst over the square, the launcher's name under it
// Yours from the pocket, and since 22 Sep 2026 everybody else's too (Trym: "fix the firework so everyone
// sees it" — the item always promised it and only the launcher's screen drew it). town-crowd.js carries
// it and worker-rave's SquareRoom relays it with the room's own copy of the name. ONE loop draws every
// burst in flight, each anchored to its spot on the square, so the camera can pan under it.
let fxRuns = 0, fxLast = null, fxRaf = 0;
const bursts = [];
function burstAt(wx, wy, name, mine) {
  const parts = [];
  for (let i = 0; i < 70; i++) { const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 4; parts.push({ x: 0, y: 0, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, c: ['#ffe135', '#ff5c8a', '#fffdf5', '#7ec8ff'][i % 4], life: 60 + Math.random() * 30 }); }
  bursts.push({ wx, wy, name: name || '', parts, t0: performance.now() });
  fxRuns++;
  fxLast = { name: name || '', mine: !!mine };
  if (!fxRaf) fxRaf = requestAnimationFrame(fxFrame);
}
function fxFrame(now) {
  const cv = document.getElementById('twFx'), r = view.getBoundingClientRect();
  const w = Math.round(r.width), h = Math.round(r.height);
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  cv.hidden = false;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  for (let i = bursts.length - 1; i >= 0; i--) {
    const b = bursts[i], t = (now - b.t0) / 1000;
    const x0 = b.wx * scale - camX, y0 = b.wy * scale - camY - 150 * scale;
    let alive = 0;
    for (const p of b.parts) { if (p.life <= 0) continue; alive++; p.x += p.vx; p.y += p.vy; p.vy += 0.06; p.life -= 1; ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 40)); ctx.fillStyle = p.c; ctx.fillRect(Math.round(x0 + p.x), Math.round(y0 + p.y), 4, 4); }
    ctx.globalAlpha = 1;
    if (b.name && t < 1.6) { ctx.font = 'bold 14px "Archivo Black", sans-serif'; ctx.fillStyle = '#fffdf5'; ctx.textAlign = 'center'; ctx.shadowColor = '#000'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 1; ctx.shadowOffsetY = 1; ctx.fillText(b.name, x0, y0 + 46); ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; }
    if (!alive || t >= 2.2) bursts.splice(i, 1);
  }
  if (bursts.length) { fxRaf = requestAnimationFrame(fxFrame); return; }
  fxRaf = 0;
  ctx.clearRect(0, 0, cv.width, cv.height);
  cv.hidden = true;
}
function firework() {
  let name = ''; try { name = (localStorage.getItem('ps-name-v1') || '').trim().slice(0, 24); } catch (e) {}
  burstAt(pos.x, pos.y, name, true);
  const fx = lifeWords('fx');
  const said = name ? (fx.named || '').replace('{name}', name) : (fx.yours || '');
  if (said) say(said);
  if (crowd) crowd.burst();   // 👥 and out to everyone else on the square
}
// the town's world-voice words (town-life.json) live in the room chunk; before it lands there are none
const lifeWords = (k) => (room && room.seam && room.seam.copyOf ? room.seam.copyOf(k) : null) || {};
// 👥 somebody else's firework, where they stood. The toast is the same line the launcher's own names
// them with, so a burst off the edge of your view is still news; a nameless one just bursts.
function peerFirework(wx, wy, name) {
  if (inRoom) return;   // indoors, the square is not drawn
  burstAt(wx, wy, name, false);
  const fx = lifeWords('fx');
  if (name && fx.named) say(fx.named.replace('{name}', name));
}
// 💼 THE MOMENT YOU ARE HIRED (22 Sep 2026, Trym: "When i ask a boss / store owner if i can work there - the dialogue
// window should close and there should be some sort of salute or splash text saying something about the job i get.
// And the dialogue popup should close first, then splash."). The boss has said yes in their own card and the card
// has closed itself (world-dialogue.js `after`); now the world celebrates: a burst over your banana, the big
// moment over the square, and once it has gone up, one plain line saying where the work is. All words the rig's.
function hiredMoment(at) {
  const w = lifeWords('work');
  const where = (w.at || {})[at] || '';
  burstAt(pos.x, pos.y, '', true);
  if (w.moment) bigMoment(view, w.moment, (w.momentLine || '').replace('{where}', where));
  const start = (w.start || {})[at];
  if (start) setTimeout(() => say(start), 4400);
  // 📜 a reference started you higher: said after the start line, once the server has answered
  setTimeout(() => { const j = work && work.seam.job(), L = (work && work.seam.words()) || {}; if (j && j.at === at && j.ref && (L.ref || {})[at]) say(L.ref[at]); }, 9000);
}
// 🪜 PROMOTED (23 Sep 2026): the hire's own moment, for a rank the boss has just told you — the card has closed by now,
// and the square says what you are and where. The words are the staff card's (town-staff.json), loaded with the job.
function promotedMoment(at, rank) {
  const L = (work && work.seam.words()) || {};
  const where = (lifeWords('work').at || {})[at] || '';
  burstAt(pos.x, pos.y, '', true);
  if (L.promoMoment) bigMoment(view, L.promoMoment, (L.promoLine || '').replace('{title}', work.seam.title(at, rank)).replace('{where}', where));
  // 🔓 and, once it has gone up, what the new rank lets you do (the ladder's slice 3) — the hire's own beat for its start line
  const u = unlocksAt(at, rank).map((k) => ((L.unlock || {})[at] || {})[k]).filter(Boolean)[0];
  if (u) setTimeout(() => say(u), 4400);
  // 📜 the top rank: the boss's memento, a beat after the new thing has been said
  if (rank >= ranksOf(at) && work && work.seam.memento) setTimeout(() => { work.seam.memento(at).then((m) => { if (m) say(m); }); }, u ? 9000 : 4400);
}

// ---- boot: the engine's assets first, then the people, then the walk
// the world HUD, both halves (design library §15): the strip up top — level,
// coins, the crowd chip that is also the save ask (no room yet, so it reads
// solo) — and the ACTION BAR under the view: POCKET as the verb slot, the
// heart, the travel door. Every player control lives in one of the two.
const hud = mountHud({ mount: view, theme: { bg: 'rgba(30, 18, 10, 0.84)', border: 'rgba(255, 200, 120, 0.35)' }, chips: ['lvl', 'coins', 'slot', 'crowd'] });   // the slot carries the town's nightfall clock (town-room.js)
hud.setCrowd('solo');
pocketPaint();   // 👝 whatever the pass already carries
pocketBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleTray(); });
document.getElementById('twEmote').addEventListener('click', function () {
  // the float rides the button's own pixel heart — one art source (the park's grammar)
  const s = this.querySelector('svg');
  float(pos.x, pos.y - 44, s ? s.cloneNode(true) : '');
});
// 🚪 the travel door lands last in the bar. The town is the FRONT DOOR of Banana World since
// 21 Sep 2026, so it heads the module's list: every area's card offers it, and its own offers the four.
const travel = initTravel({ here: 'town', mount: document.querySelector('.tw-actions'), btnClass: 'tw-act tw-act--icon' });
assetsReady().then(() => {
  life.start();   // the residents take their stations for this hour of the town's day
  cam(true);
  drawMe();
  requestAnimationFrame(tick);
  track('town_open', { test: /[?&]towntest/.test(location.search) ? 1 : 0 });
  // 🏘️ Town Life, once the square stands: the room's word on the town, then everything it changes
  import('./town-room.js').then((m) => {
    room = m.bootTownLife({ world, view, W, H, pct, PROPS, life, weather, say, float, openCard, closeCard, cardBody, card, panel, pos, tgt,   // 🍋 tgt: a step round the back of the stand's table takes the walk with it
      hud, esc, track: roomTrack, inside: () => !!inRoom, inRoom: () => inRoom, enterRoom,
      setSlow: (v) => { slowRoom = +v > 0 ? +v : 1; },
      nibStation,   // 🕯 where chapter one wants Nib right now ('fountain' while its first scene is open)
      // ⭐ WALK TO IT, THEN IT HAPPENS — the grammar every other reachable thing in this world already
      // uses (a cabinet, a flyer, a resident, a town problem). The tap has already set the target to
      // the thing's own front by the time this runs, so all the room has to hand over is the deed.
      then: (fn) => { arriveThen = fn || null; },
      job: () => (work ? work.seam.job() : null),   // 💼 what the room may ask of you depends on who you work for
      sortOn: () => !!(sort && sort.on()),   // ✉️ the sorting round is on: Stamp steps aside
      chore: (k, g) => (work && work.seam.chore ? work.seam.chore(k, g) : null),   // 💼 …and what you did there counts on the week's sheet (🪜 and earns work XP by its grade)
      repair: (key) => loadRepair().then((r) => r && r.start(key)), repairing: () => !!(repair && repair.on()),   // 🔧 a dark cabinet is a repair game
      outfit: () => ME_DRAW,   // ☕ the café draws YOUR banana in its window, in one locked pose
      others: () => (crowd ? crowd.others() : []),   // 👥 other players' bananas on the square (the ghosts keep away from them)
      drawMe: (ctx, size, frame, outfit) => drawComposite(ctx, size, frame, outfit), mountDialogue });
    if (window.__town) window.__town.room = room.seam;
    // 👥 THE SQUARE IS SHARED (22 Sep 2026): the other players, on the park's rail, in their own chunk.
    // ⚠️ a QA walk stays OUT of the live room unless it asks (?towntest&crowd=1): every other town walk
    // would otherwise stand a headless banana in real players' squares for the length of the suite.
    const qa = /[?&]towntest/.test(location.search);
    if (!qa || /[?&]crowd=1/.test(location.search)) {
      import('./town-crowd.js').then((m) => {
        crowd = m.bootTownCrowd({ world, W, H, pct, hud, track, pos, outfit: () => ME_DRAW, inRoom: () => inRoom, onBurst: peerFirework, onPot: (pot, won, name) => { if (market || won) loadMarket().then((m) => m.pot(pot, won, name)).catch(() => {}); },
          name: () => { try { return (localStorage.getItem('ps-name-v1') || '').trim().slice(0, 24); } catch (e) { return ''; } } });
        if (window.__town) window.__town.crowd = crowd.seam;
      }).catch((e) => { console.warn('[town] the crowd did not load', e); });
    }
    // 💼 the jobs, once the room can answer for the words. ⚠️ AFTER the room, never before: the
    // question on a boss's card is copy, and a half-built question is worse than none.
    import('./town-work.js').then((w) => {
      work = w.bootTownWork({
        pos, PROPS, say, track,
        copy: () => (room && room.seam.copyOf ? room.seam.copyOf('work') : null),
        hired: (at) => hiredMoment(at),
        promoted: (at, rank) => promotedMoment(at, rank),   // 🪜 the boss told you: PROMOTED over the square
      });
      if (window.__town) { window.__town.work = work.seam; window.__town.moment = { hired: hiredMoment, promoted: promotedMoment }; }   // 🧪 the walks' doors to the two moments
      // 📜 a top-rank memento the shed had no room for is given on a later visit, once the job's words are in to say so
      if (work.seam.mementoDue) work.seam.wordsReady().then(() => { if (work.seam.mementoDue()) setTimeout(() => { work.seam.memento(work.seam.job().at).then((m) => { if (m) say(m); }); }, 6000); });
      // 💼 the duties chip — the quest chip's sibling for the job you hold (docs/town-jobs-plan.md §11.2)
      import('./town-duties.js').then((d) => {
        // 💼 a tap on the note opens your staff card — never over another card, and never mid-shift (the tray is the job then)
        // 📟 and a call that comes in while you stand in its room brings its work into the room there and then (slice 0b)
        duties = d.bootTownDuties({ view, work, track, open: (at) => { if (!panel.hidden || working()) return false; staffCard(at, 'note'); return true; },
          onCall: (at) => { if (inRoom === at && room && room.roomShow) room.roomShow(at); } });
        if (window.__town) window.__town.duties = duties ? duties.seam : null;
      }).catch((e) => { console.warn('[town] the work note did not load', e); });
    }).catch((e) => { console.warn('[town] work did not load', e); });
    // 🕯 THE STORY. Chapter one opens here since 21 Sep 2026 (Nib at the fountain); chapter two — the
    // four signatures — is parked, and only the walk plays it (?towntest&chapter=2). Last, and
    // deliberately: a chapter's marks are placed against the world's measured rects, so the square
    // has to be standing first.
    // ⚠️ THE DONE CHECK HAPPENS BEFORE THE IMPORT, exactly as the other four areas do it (see the
    // note in park.astro): bootQuest returns at once on S.done, but only after the chunk has been
    // fetched and parsed — so a finisher would pay for the whole questline on every visit forever.
    // The chapter's local state is one flag, and reading it costs nothing.
    const wantC2 = /[?&]towntest/.test(location.search) && /[?&]chapter=2/.test(location.search);
    let qdone = false;
    try { qdone = !!(JSON.parse((wantC2 ? localStorage.getItem('bwq-c2') : localStorage.getItem('bwq-c1')) || 'null') || {}).done; } catch (e) {}
    if (!qdone) import('../lib/world-quest.js').then((m) => m.bootQuest()).catch((e) => { console.warn('[town] the chapter did not load', e); });
  }).catch((e) => { console.warn('[town] life did not load', e); });
  window.__town = { pos, tgt, SPOTS, ABOUT, NPCS, PROPS, say, life: life.seam, room: room && room.seam, thing: (x, y) => thingAt(x, y),   // 🧪 what a tap on the square finds (a spot, a resident, a flyer, a room thing)
  // 🧪 the town's OWN tap answer — `room.open` is town-room's, and the wheel, the exchange, the travel
  // door and the clothes shop are answered here instead, so a walk had no way to reach any of them
  // ⚠️ the same answer a TAP gives: a place with no card of its own says its line (the fallback the tap handler has)
  open: (k) => { const ok = openFor(k); if (!ok && ABOUT[k] && ABOUT[k][2]) say(ABOUT[k][2]); return ok; }, dress: () => dress && dress.seam, post: () => post && post.seam, sort: () => sort && sort.seam, sortReady: () => loadSort().then((s) => !!s), startSort, staff: () => (staff ? staff.seam : null), staffReady: () => loadStaff().then((x) => !!x), staffOpen: (at, door) => staffCard(at, door || 'note'), staffAct, info: () => info && info.seam, OVERLAYS, cards: { wheel: () => marketCard('wheel'), exchange: () => marketCard('exchange') }, market: () => loadMarket().then((m) => m.seam), pocket: () => pocketOf(), pocketAdd: (k) => pocketAdd(k), fx: () => fxRuns, fxLast: () => fxLast, slow: slowNow, wx: (k) => weather.setKind(k), rooms: { enter: enterRoom, exit: exitRoom, now: () => inRoom, of: (k) => ROOMS[k] || null, keys: () => Object.keys(ROOMS) },
    arcade: { enter: () => enterRoom('condo'), exit: exitRoom, inside: () => inRoom === 'condo', spots: () => (ARCADE ? ARCADE.spots : []), box: () => (ARCADE ? ARCADE.box : null), door: () => (ARCADE ? ARCADE.exit : null), game: () => arcGame, play: (k) => gameCard(k || 'g1') } };   // QA seam for the walk
});
