// 🏘️ TOWN LIFE — Banana Town's condition, its problems, its shop, its nights (14 Sep 2026).
//
// Trym's brief, in one line: the town should feel like a living community that changes
// over time, needs occasional attention, rewards caring, has a curse underneath, and
// stays worth revisiting indefinitely — even with no storyline. docs/town-life-plan.md is
// the decisions record; this file is the client half. The other half is the TownRoom in
// worker-rave (one shared number, 0–100, drifting toward a set point, charged by the
// weather and the curse clocks, raised by contributions under a per-person daily cap).
//
// What lives here, each its own section and its own data table (src/data/town/):
//   the room      read on arrival and polled; the band, with hysteresis
//   condition     the band → how the town LOOKS: lamps, windows, shutters, litter, crows,
//                 visitors, décor. Seeded by the day, the same for everybody
//   problems      what THIS player can put right today: seeded by (player, day, band),
//                 fixed by walking up and tapping, paid on the pass, pooled on the room
//   the shop      Pip's shelf for the HOMESTEAD (decor.js rows), rotating daily by band;
//                 a travelling merchant; a night vendor
//   today         a few seeded things that are simply happening
//   the curse     curseAt() from world.js — the weather clock's twin: a dark sky, the
//                 storm, residents in, ghosts, cursed objects, the vendor's stall
//   story         the hooks a chapter calls: local to the player who is in the chapter
//
// ⚠️ THE ROOM OWNS THE NUMBER. Nothing here computes Town Life; the client renders what
// the room said and asks it to count a fix. ⚠️ THE QUIET RULE holds: no text over any
// banana or ghost — a ghost with a line says it in the town's toast. ⚠️ EVERY WORD is copy:
// src/data/copy/town-life.json, written by the rig, approved at /dev/copy/. Until it lands
// the town runs wordless and picks the words up the day they are approved.
import { seedRand, worldOwner, worldSid, worldToken, curseAt, curseDay, CURSE_DAY_MS, poofInto, burstInto } from '../lib/world.js';
import { passStat, passSpend, passRaw, statTotal, coinsNow } from '../lib/banana-pass.js';
import { DECOR } from '../data/decor.js';
import { grantToShed, orderFor, takeFromShed, hasInShed, homeStage, canHold, shipMin } from '../lib/homestead-inventory.js';
import { STATE } from './town-geo.js';
import { iconSvg } from '../lib/pixel-icons.js';   // the board's three notes wear pixel icons, never OS emoji
import { BANDS, BAND_LO, HYST, LOOK, PROBLEM_COUNT, NIGHT, DECOR_SPOTS, VISITOR_SPOTS } from '../data/town/condition.js';
import { PROBLEMS, ANCHORS } from '../data/town/problems.js';
import { POOLS, SHELF, MERCHANT, CURSE_SHELF } from '../data/town/stock.js';
import { TODAY, TODAY_N, ODD_SPOTS, CLOSABLE } from '../data/town/today.js';
import { GHOSTS, NIGHT_GHOSTS, DAY_GHOSTS } from '../data/town/ghosts.js';
import { OBJECTS, WHERE, RARITY_W, BOUNTY } from '../data/town/objects.js';

// ✍️ the words. A glob, not an import: the file does not exist until Trym approves the
// draft, and a static import of a missing file would fail the build. Empty until then.
const COPY_MODS = import.meta.glob('../data/copy/town-life.json', { eager: true, import: 'default' });
const COPY = Object.values(COPY_MODS)[0] || {};
const W_BAND = (COPY.bands || []).reduce((m, b) => { if (b && b.key) m[b.key] = b; return m; }, {});
const W_OBJ = (COPY.objects || []).reduce((m, o) => { if (o && o.id) m[o.id] = o; return m; }, {});

const LIFE_API = 'https://banana-rave.trymstene.workers.dev/town-life';
const TEST = /[?&]towntest/.test(location.search);
const DEX = {}; DECOR.forEach((d) => { DEX[d.id] = d; });
const dayNum = () => Math.floor(Date.now() / 86400000);
// a stable 0..1 from a few small numbers, the same for everyone looking (no Math.random in
// anything two players should agree on)
const h = (...n) => seedRand(0x70a1 + n.reduce((a, v, i) => a + Math.round(v) * [7919, 313, 131, 53, 17, 3][i % 6], 0));
const pickN = (list, n, seed) => {   // n distinct picks, seeded
  const a = list.slice(), out = [];
  for (let i = 0; i < n && a.length; i++) out.push(a.splice(Math.floor(h(seed, i, a.length) * a.length), 1)[0]);
  return out;
};
const weighted = (rows, w, seed) => {   // one weighted pick
  const tot = rows.reduce((t, r) => t + w(r), 0);
  let r = h(seed, 1) * tot;
  for (const row of rows) { r -= w(row); if (r <= 0) return row; }
  return rows[rows.length - 1];
};
const nameOf = () => { let n = ''; try { n = (localStorage.getItem('ps-name-v1') || '').trim().slice(0, 24); } catch (e) {} return n || 'friend'; };
const fill = (s, item) => String(s || '').replace(/\{name\}/g, nameOf()).replace(/\{item\}/g, item || '');
const one = (list, seed) => (Array.isArray(list) && list.length ? list[Math.floor(h(seed, list.length) * list.length)] : '');

export function bootTownLife(ctx) {
  const { world, view, W, H, pct, PROPS, life, weather, say, float, openCard, closeCard, cardBody, card, panel, hud, esc, track, inside, drawMe } = ctx;
  const me = () => worldOwner().slice(0, 8);

  // ═══════════════════════════════════════ the room ═══════════════════════════════════
  let L = { life: 42, band: 'recovering', set: 42, cap: { used: 0, max: 10 }, today: { fixes: 0, people: 0 }, curse: 'none', stormAt: 0, curseAt: 0 };
  let band = null, nudge = 0, readAt = 0, lastErr = '';
  // 🧪 ?towntest: the room's arithmetic in memory, so the whole town can be walked with no
  // worker and pushed to any band from the QA seam. The shim answers like the room does.
  const shim = { v: 42, used: 0, fixes: 0, people: 0 };
  function bandOf(v) {
    let b = BANDS[0];
    for (const k of BANDS) if (v >= BAND_LO[k]) b = k;
    // ⚠️ HYSTERESIS: a band is left only three points below where it was entered
    if (band && BANDS.indexOf(b) < BANDS.indexOf(band) && v >= BAND_LO[band] - HYST) return band;
    return b;
  }
  async function lifeFetch(path, body) {
    const own = worldOwner(), sid = worldSid(), wt = worldToken();
    if (TEST) {
      if (path === '/fix') { if (shim.used < 10) { shim.v = Math.min(100, shim.v + 1.2); shim.used++; shim.fixes++; shim.people = 1; } }
      return { life: Math.round(shim.v * 10) / 10, band: bandOf(shim.v), set: 42, cap: { used: shim.used, max: 10 }, today: { fixes: shim.fixes, people: shim.people },
        curse: curseAt(Date.now()).type, stormAt: 0, curseAt: 0, ok: 1 };
    }
    if (body) { body.pass = own; body.alt = sid; if (wt) body.wt = wt; }
    try {
      const r = await fetch(LIFE_API + path + (body ? '' : '?pass=' + encodeURIComponent(own.slice(0, 8)) + '&alt=' + encodeURIComponent(sid.slice(0, 8))
        + (wt ? '&wt=' + encodeURIComponent(wt) : '')), body
        ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
        : undefined);
      return await r.json();
    } catch (e) { lastErr = String(e && e.message || e); return null; }   // no worker, no life — the town stands as it always did
  }
  let toldArrival = false;
  function apply(j) {
    if (!j || typeof j.life !== 'number') return;
    Object.assign(lampWas, cond.lamps);
    L = j;
    const b = bandOf(Math.max(0, Math.min(100, j.life + nudge)));
    // today first (it decides what is shut), then the look, then what you can put right
    if (b !== band) { band = b; todayStage(); condition(); reseedProblems(); }
    // 🪧 on arrival the town says what state it is in — the board's own words for the band — so a
    // player knows at once what the fixing is about (Trym, 14 Sep: "i dont understand for what and why")
    const wb = W_BAND[band] || {};
    if (!toldArrival && wb.name) { toldArrival = true; say(wb.name + ' — ' + fill(wb.line || '')); }
    // 🎉 a band change while you are here is an EVENT: the new name, and what it brings (up) or
    // what it looks like (down) — and a puff on every lamp whose state changed
    else if (wasBand && wasBand !== band && wb.name) { say(wb.name + ' — ' + fill((BANDS.indexOf(band) > BANDS.indexOf(wasBand) ? wb.brings : wb.line) || '')); for (const k of ANCHORS.lamps) { const p = propOf(k); if (p && lampWas[k] && lampWas[k] !== cond.lamps[k]) poof(p.x + p.w / 2, p.base - 40); } }
    wasBand = band;
    paintMeter();
  }
  let wasBand = null;
  const lampWas = {};
  async function read() { readAt = Date.now(); apply(await lifeFetch('')); }
  // a read on arrival, then every minute while the tab is looked at; a tab that comes back
  // reads at once (a storm may have passed)
  read();
  setInterval(() => { if (!document.hidden && Date.now() - readAt > 55000) read(); }, 15000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - readAt > 20000) read(); });

  // 🪧 the board's sign in the square says what the board's card says (the copy's title), so the
  // plank and the card agree the day the words land; without words it keeps its old label
  if (COPY.board && COPY.board.title) { const pl = world.querySelector('.tw-plank[data-key="board"]'); if (pl) pl.textContent = String(COPY.board.title).toUpperCase(); }

  // 🌸 THE TOWN HEALTH BAR — the park's, to the pixel (Trym, 15 Sep: "look at the health bar in
  // the park for park health, make it the same"): bottom-docked, the face and the palette ride
  // the band, the fill takes the RAW value (one decimal, so one fix visibly moves it), the (i)
  // cap says it opens. Tap = the town-health card below.
  const FACES = ['skull', 'frown', 'meh', 'smile', 'laugh'];
  const hbar = document.createElement('button');
  hbar.type = 'button'; hbar.className = 'tw-hbar tw-hbar--p2'; hbar.setAttribute('aria-label', 'town health');
  hbar.innerHTML = '<span class="tw-hbar__face" aria-hidden="true"></span>'
    + '<span class="tw-hbar__track"><i class="tw-hbar__fill"></i><b class="tw-hbar__pct">—</b></span>'
    + '<span class="tw-hbar__more" aria-hidden="true">' + iconSvg('info-box', { size: 15 }) + '</span>';
  view.appendChild(hbar);
  const hFace = hbar.querySelector('.tw-hbar__face'), hFill = hbar.querySelector('.tw-hbar__fill'), hPct = hbar.querySelector('.tw-hbar__pct');
  let hbarPhase = -1;
  function renderHBar() {
    if (!band) return;
    const v = Math.max(0, Math.min(100, L.life + nudge)), p = BANDS.indexOf(band);
    hFill.style.width = v + '%';
    hPct.textContent = Math.round(v) + '%';
    hPct.style.left = v + '%';
    hPct.classList.toggle('is-out', v < 20);   // slim fill: the % steps outside
    if (hbarPhase !== p) { hbarPhase = p; hbar.className = 'tw-hbar tw-hbar--p' + p; hFace.innerHTML = iconSvg(FACES[p], { size: 20 }); }
    // the card is open — nudge it live
    const f = document.getElementById('twBfill');
    if (f) {
      f.style.clipPath = 'inset(0 ' + (100 - v) + '% 0 0)';
      cardBody.querySelectorAll('.tw-bglyph').forEach((g, i) => g.classList.toggle('is-now', i === p));
      const num = document.getElementById('twBnum'); if (num) num.textContent = Math.round(v) + '%';
    }
  }
  const paintMeter = renderHBar;
  // 🌸 THE TOWN-HEALTH CARD — the park's health card: the band's name, the big number, ONE
  // continuous bar with the five bands as zones (ticks at the band lines, a glyph over each,
  // the live one ringed), tap a zone and read that band's line; then today's tally and your
  // ten pips. Every word is the copy file's.
  function healthCard() {
    const v = Math.max(0, Math.min(100, L.life + nudge)), p = BANDS.indexOf(band), w = COPY.board || {}, wb = W_BAND[band] || {};
    const starts = BANDS.map((k) => BAND_LO[k]), ends = starts.slice(1).concat([100]);
    const used = Math.min(10, (L.cap && L.cap.used) | 0);
    // the label is what the number IS (the park says "park health"); the band's NAME rides the
    // explainer line under the bar, with its line (Trym, 15 Sep: "'mending along' … You mean Town Health?")
    openCard('<div class="whg"><p class="whg__label">' + esc(w.health || '') + '</p><p class="whg__num" id="twBnum">' + Math.round(v) + '%</p></div>'
      + '<div class="tw-bbar">'
      + '<div class="tw-bglyphs">' + FACES.map((f, i) => '<span class="tw-bglyph' + (i === p ? ' is-now' : '') + '" style="flex:' + (ends[i] - starts[i]) + '">' + iconSvg(f, { size: 17 }) + '</span>').join('') + '</div>'
      + '<div class="tw-btrack"><i class="tw-bramp"></i><i class="tw-bfill" id="twBfill" style="clip-path:inset(0 ' + (100 - v) + '% 0 0)"></i>'
      + starts.slice(1).map((t) => '<i class="tw-btick" style="left:' + t + '%"></i>').join('') + '</div>'
      + FACES.map((f, i) => '<button class="tw-bzone" type="button" data-p="' + i + '" style="left:' + starts[i] + '%;width:' + (ends[i] - starts[i]) + '%" aria-label="town health band ' + (i + 1) + ' of 5"></button>').join('')
      + '</div>'
      + '<p id="twBexp"></p>'
      + '<p class="tw-bmeta">' + (L.today.fixes | 0) + ' ' + esc((w.fixes || '').toLowerCase()) + ' · ' + (L.today.people | 0) + ' ' + esc((w.people || '').toLowerCase()) + '</p>'
      + '<div class="tw-bpips' + (used >= 10 ? ' is-done' : '') + '">' + FACES.concat(FACES).map((_, i) => '<i' + (i < used ? ' class="is-on"' : '') + '></i>').join('') + '</div>');
    const exp = document.getElementById('twBexp');
    const show = (i) => {
      const bw = W_BAND[BANDS[i]] || {};
      exp.className = 'tw-bexp' + (i <= 1 ? ' tw-bexp--sad' : '');
      exp.textContent = (bw.name ? bw.name + (bw.line ? ' — ' : '') : '') + fill(bw.line || '');
      cardBody.querySelectorAll('.tw-bglyph').forEach((g, gi) => g.classList.toggle('is-open', gi === i));
    };
    if (card) card.classList.add('tw-card--health');
    cardBody.querySelectorAll('.tw-bzone').forEach((bz) => bz.addEventListener('click', () => show(+bz.dataset.p)));
    show(Math.max(0, p));
    track('town_health', { life: Math.round(v) });
    return true;
  }
  hbar.addEventListener('click', (e) => { e.stopPropagation(); healthCard(); });
  hbar.addEventListener('pointerdown', (e) => e.stopPropagation());   // the view's tap-to-walk must not fire under it

  // 🌙 THE NIGHTFALL CLOCK in the HUD's slot: the town's day is twelve real minutes and night is
  // its last two; the chip says how long until it falls (or, at night, until dawn) — so a player
  // knows whether to stick around (Trym, 14 Sep: "i dont as a player understand when nightfall is")
  const slot = hud && hud.el ? hud.el.querySelector('.wh__slot') : null;
  let clockAt = 0;
  function paintClock(now) {
    if (!slot || now < clockAt) return;
    clockAt = now + 1000;
    const h = life.seam.hour();   // 0–24 town hours, 30 real seconds each; night is 20–24 (the hour lives on the QA seam)
    const isNight = h >= 20, left = Math.max(0, ((isNight ? 24 : 20) - h) * 30);
    const m = Math.floor(left / 60), sec = Math.floor(left % 60);
    slot.innerHTML = '<span class="tw-clock">' + iconSvg(isNight ? 'sun-solid' : 'moon-solid', { size: 14 }) + '<b>' + m + ':' + (sec < 10 ? '0' : '') + sec + '</b></span>';
  }

  // ═══════════════════════════════ sprites, marks, bodies ══════════════════════════════
  // a state sprite: STATE[key] frames stacked in one box (the fountain's way), stepped from
  // tick() at its own fps. mode: 'loop' | 'pulse' (0..n-1 and back) | 'once' (then hide) |
  // 'flicker' (on, mostly) | 'off'
  const sprites = new Set();
  function sprite(key, cx, base, opts = {}) {
    const st = STATE[key]; if (!st) return null;
    const k = opts.size || 1, w = st[0] * k, hh = st[1] * k, n = st[2];
    const el = document.createElement('div');
    el.className = 'tw-state' + (opts.cls ? ' ' + opts.cls : '');
    el.style.left = pct(opts.left != null ? opts.left : cx - w / 2, W); el.style.top = pct(opts.top != null ? opts.top : base - hh, H);
    el.style.width = pct(w, W); el.style.aspectRatio = w + ' / ' + hh;
    el.style.zIndex = String(100 + Math.round(opts.z != null ? opts.z : base));
    for (let i = 0; i < n; i++) { const im = document.createElement('img'); im.src = '/assets/town/s-' + key + '-' + i + '.png'; im.alt = ''; im.decoding = 'async'; im.draggable = false; if (i === 0) im.className = 'is-on'; el.appendChild(im); }
    world.appendChild(el);
    const s = { key, el, n, i: 0, acc: 0, fps: opts.fps || 6, mode: opts.mode || (n > 1 ? 'loop' : 'still'), dir: 1, x: cx, y: base, w, h: hh, gone: false };
    sprites.add(s);
    return s;
  }
  function show(s, i) { if (s.i === i) return; s.el.children[s.i].classList.remove('is-on'); s.el.children[i].classList.add('is-on'); s.i = i; }
  function kill(s) { if (!s || s.gone) return; s.gone = true; s.el.remove(); sprites.delete(s); for (let i = ghosts.length - 1; i >= 0; i--) if (ghosts[i].s === s) ghosts.splice(i, 1); }
  function stepSprites(dt) {
    for (const s of sprites) {
      if (s.n < 2 || s.mode === 'still' || s.mode === 'off') continue;
      s.acc += dt;
      if (s.acc < 1 / s.fps) continue;
      s.acc = 0;
      if (s.mode === 'loop') show(s, (s.i + 1) % s.n);
      else if (s.mode === 'pulse') { let ni = s.i + s.dir; if (ni >= s.n || ni < 0) { s.dir = -s.dir; ni = s.i + s.dir; } show(s, ni); }
      // ⚠️ hidden, never visibility: a child's `visibility: visible` (the is-on frame) beats a
      // hidden PARENT, so the halos of five dark lamps kept shining (14 Sep). [hidden] is display.
      else if (s.mode === 'once') { const ni = s.i + (s.rev ? -1 : 1); if (ni < 0 || ni >= s.n) { s.el.hidden = true; s.mode = 'done'; if (s.onDone) s.onDone(s); } else show(s, ni); }
      else if (s.mode === 'flicker') { const on = Math.random() < 0.72; s.el.hidden = !on; if (on) show(s, Math.floor(Math.random() * s.n)); }
    }
  }
  // 🔧 a problem's mark: the ring on the ground AND a tools icon bobbing above the thing, day or
  // night — a ring alone among the cobbles was missed (Trym, 14 Sep: "which streetlight must I fix?")
  // 🔧 the repair icon rides ONLY over a street lamp; everything smaller glows instead (Trym, 15 Sep:
  // "it has become an icon bonanza … it just looks like you're picking up icons and not fixing
  // town-problems"). The mark is otherwise an invisible anchor.
  const mark = (x, y, lift, z, icon) => { const m = document.createElement('i'); m.className = 'tw-mark'; m.style.left = pct(x, W); m.style.top = pct(y, H); m.style.zIndex = String(z != null ? z : 100 + Math.round(y) - 1);
    if (icon) { const ic = document.createElement('span'); ic.className = 'tw-mark__ic'; ic.innerHTML = iconSvg('tools', { size: 18 }); ic.style.top = (-(lift || 40)) + 'px'; m.appendChild(ic); } world.appendChild(m); return m; };
  const poof = (x, y) => poofInto(world, 'tw-poof', x / W * 100, (y - 10) / H * 100);   // the town's own puff (town.astro .tw-poof): a thing that merely vanishes
  const burst = (x, y) => burstInto(world, 'tw-burst', x / W * 100, (y - 16) / H * 100);   // ✨ a fix or a find: the moment (town.astro .tw-burst)
  // a banana body that is not a resident: a visitor, the merchant, the vendor
  function body(x, y, outfit) {
    const el = document.createElement('div');
    el.className = 'tw-npc tw-visitor';
    const cv = document.createElement('canvas'); cv.width = cv.height = 150; el.appendChild(cv);
    el.style.left = pct(x, W); el.style.top = pct(y, H); el.style.zIndex = String(100 + Math.round(y));
    world.appendChild(el);
    const b = { el, cv, ctx: cv.getContext('2d'), x, y, outfit: { hat: outfit.hat || 'none', glasses: outfit.glasses || 'none', extras: outfit.extras || {}, top: '', bottom: '', bg: 'transparent', captions: false, effect: 'none' }, face: x > 1100 ? 4 : 0, sw: 0, swayAt: 0, period: 2200 + Math.random() * 2600 };
    drawMe(b.ctx, 150, b.face, b.outfit);
    return b;
  }
  const bodies = new Set();
  function swayBodies(now) {
    for (const b of bodies) if (now - b.swayAt > b.period) { b.swayAt = now; b.sw = b.sw ? 0 : 1; drawMe(b.ctx, 150, b.face + b.sw, b.outfit); }
  }
  const killBody = (b) => { if (b) { b.el.remove(); bodies.delete(b); } };

  // ══════════════════════════════════ the condition ═══════════════════════════════════
  // the look of the band, seeded by the day: the same dark lamps for everyone today
  const cond = { lamps: {}, shut: new Set(), fountainDry: false, full: new Set(), crows: [], visitors: [], decor: [], dayghost: null, fixedShut: new Set() };
  const propOf = (key) => PROPS[key] || null;
  // a crow on a perch paints OVER the prop it sits on (the fountain is a keyed animation, not an overlay)
  const perchZ = (key) => (key === 'fountain' ? 900 : propOf(key) ? propOf(key).base : 1000) + 2;
  const lampHalo = {};      // key → sprite (the halo over the lamp, lit at night)
  const fullSprites = {}, sideSprites = {};   // key → the full-state sprite over a bin or a dumpster, and what stands beside it
  let dryFountain = null;
  const shutSprites = {};
  function condition() {
    const look = LOOK[band], d = dayNum();
    // lamps: which are out and which stutter, from the day seed
    const order = pickN(ANCHORS.lamps, ANCHORS.lamps.length, d * 7 + 1);
    ANCHORS.lamps.forEach((k) => { cond.lamps[k] = 'ok'; });
    order.slice(0, look.lampsOut).forEach((k) => { cond.lamps[k] = 'out'; });
    order.slice(look.lampsOut, look.lampsOut + look.lampsFlicker).forEach((k) => { cond.lamps[k] = 'flicker'; });
    // the fixes this device already made today still hold
    for (const id of fixed()) { const [t, k] = id.split(':'); if (t === 'lamp' && cond.lamps[k]) cond.lamps[k] = 'ok'; }
    lamps();
    // windows: some homes stay dark in a low town
    life.setGlow((n) => h(d, 2, n.idx) >= look.windowsDark);
    // who stays in: the shut kiosks' keepers, Pip when the store is shut, and a seeded few
    cond.shut = new Set(look.shut);
    todayShut.forEach((k) => cond.shut.add(k));
    shutters();
    life.setKeep(keepFn);
    life.setLitter(look.litter);
    // which street bins and dumpsters are full today (a fix this device made today holds)
    const fullNow = new Set([...pickN(ANCHORS.bins, look.bins, d * 17 + 3), ...pickN(ANCHORS.dumps, look.dumps, d * 19 + 7)]);
    for (const k of [...ANCHORS.bins, ...ANCHORS.dumps]) setFull(k, fullNow.has(k) && !isFixed((ANCHORS.dumps.includes(k) ? 'dumpster' : 'bin') + ':' + k));
    setFountain(look.fountain === 'dry' && !isFixed('fountain:fountain'));
    // crows, visitors, décor, a daylight ghost
    cond.crows.forEach(kill); cond.crows = [];
    pickN(ANCHORS.perches, look.crows + (todayHas('crows') ? 2 : 0), d * 3 + 5).forEach(([x, y, k]) => { const s = sprite('crow', x, y, { fps: 2, z: perchZ(k) }); if (s) { s.perch = [x, y]; cond.crows.push(s); } });
    cond.visitors.forEach(killBody); cond.visitors = [];
    pickN(VISITOR_SPOTS, look.visitors, d * 5 + 9).forEach(([x, y], i) => {
      const hats = ['tophat', 'buckethat', 'cowboy', 'backwardscap', 'woolbeanie', 'snailhat', 'none'], gl = ['none', 'shades', 'nerd', 'none'];
      const b = body(x, y, { hat: hats[Math.floor(h(d, 11, i) * hats.length)], glasses: gl[Math.floor(h(d, 12, i) * gl.length)] });
      bodies.add(b); cond.visitors.push(b);
    });
    cond.decor.forEach(kill); cond.decor = [];
    DECOR_SPOTS.slice(0, look.decor).flat().forEach(([x, y]) => { const s = sprite('lantern', x, y, { fps: 4, mode: 'pulse' }); if (s) { s.el.hidden = true; cond.decor.push(s); } });
    kill(cond.dayghost); cond.dayghost = null;
    if (look.dayghost || todayHas('dayghost')) cond.dayghost = ghostOf('wisp');
  }
  const keepFn = (n, beat) => {
    if (beat === 5) return false;
    if (curse && curse !== 'hush') return true;
    if (n.key === 'pip' && !SHELF[band]) return true;
    if (n.key === 'bean' && cond.shut.has('cafe') && !cond.fixedShut.has('cafe')) return true;
    if (n.key === 'dot' && cond.shut.has('info') && !cond.fixedShut.has('info')) return true;
    return h(dayNum(), 4, n.idx) >= LOOK[band].outside;
  };
  // 🔦 the halo over each lamp: lit at evening and night when the lamp is fine, stuttering
  // when it flickers, nothing when it is out or by day. The frame is the halo's box; STATE
  // carries where it sits over the placed lamp (dx for west lamps, dxf for the mirrored east ones).
  function lamps() {
    const [, , , dx, dy, dxf] = STATE.lamp || [0, 0, 0, 0, 0, 0];
    for (const k of ANCHORS.lamps) {
      const p = propOf(k); if (!p) continue;
      if (!lampHalo[k]) {
        const flip = p.x + p.w / 2 > 1100;
        const s = sprite('lamp', 0, 0, { left: p.x + (flip ? dxf : dx), top: p.y + dy, z: p.base, fps: 3, mode: 'pulse', cls: flip ? 'is-flip' : '' });
        if (!s) continue;
        lampHalo[k] = s;
      }
    }
    lampsByHour();
  }
  let lampsLit = null;
  function lampsByHour() {
    const beat = life.beat();
    const dark = beat === 4 || beat === 5 || (curse && curse !== 'hush');
    for (const k of ANCHORS.lamps) {
      const s = lampHalo[k]; if (!s) continue;
      const st = cond.lamps[k];
      // by day a dead lamp is grey and a faulty one stutters faintly — Trym, 14 Sep: "it's daytime
      // and they are all off so I don't understand if any of them is broken"
      const p = propOf(k); if (p) p.el.classList.toggle('is-dark', st === 'out');
      const on = (dark && st !== 'out') || (!dark && st === 'flicker');
      s.el.hidden = !on;
      s.el.style.opacity = !dark && st === 'flicker' ? '0.45' : '';
      s.mode = !on ? 'off' : st === 'flicker' ? 'flicker' : 'pulse';
      if (s.mode === 'pulse') s.fps = 3; else if (s.mode === 'flicker') s.fps = 9;
    }
    lampsLit = dark;
  }
  function shutters() {
    for (const k of CLOSABLE) {
      const want = cond.shut.has(k) && !cond.fixedShut.has(k);
      if (want && !shutSprites[k]) {
        const p = propOf(k); if (!p) continue;
        const key = k === 'cafe' ? 'shutcafe' : 'shutinfo';
        const [sw, sh] = STATE[key] || [0, 0];
        shutSprites[k] = sprite(key, p.x + p.w / 2 + (k === 'cafe' ? 1 : 0), p.base - (k === 'cafe' ? 3 : 43), { z: p.base + 1 });   // measured on the plate: the shutter's badge over the kiosk's own
        if (shutSprites[k] && problems.some((q) => q.type === 'shutter' && q.key === k)) shutSprites[k].el.classList.add('is-todo');
        void sw; void sh;
      } else if (!want && shutSprites[k]) { kill(shutSprites[k]); shutSprites[k] = null; }
    }
  }
  // 🎬 a shutter goes UP: the pack's roll played backwards, then the kiosk is open
  function rollUp(k) {
    const still = shutSprites[k]; if (!still) { shutters(); return; }
    const p = propOf(k); const key = k === 'cafe' ? 'rollcafe' : 'rollinfo';
    if (!STATE[key] || !p) { shutters(); return; }
    const s = sprite(key, still.x, still.y, { z: p.base + 1, fps: 22, mode: 'once' });
    kill(still); shutSprites[k] = null;
    if (!s) return;
    s.rev = true; show(s, s.n - 1); s.onDone = () => kill(s);
  }
  // 🐦 crows leave: the pair flaps off up and away, then is gone
  const flying = [];
  function flyOff(s) {
    if (!s || s.gone) return;
    const f = sprite('flap', s.x, s.y, { z: 100 + Math.round(s.y) + 900, fps: 12, mode: 'loop' });
    kill(s);
    if (!f) return;
    f.el.classList.add('is-fade');
    flying.push({ s: f, t: 0 });
  }
  function stepFlying(dt) {
    for (let i = flying.length - 1; i >= 0; i--) {
      const fl = flying[i]; fl.t += dt;
      moveSprite(fl.s, fl.s.x - 70 * dt, fl.s.y - 110 * dt);
      if (fl.t > 0.5) fl.s.el.style.opacity = '0';
      if (fl.t > 1.6) { kill(fl.s); flying.splice(i, 1); }
    }
  }
  // 🗑 a bin or a dumpster, full or not: the full state is a sprite over the prop (the pack's own
  // open-and-full dumpsters, the small full can); emptied, the prop shows again — closed
  const FULL_ART = { dump0: 'dumpfulls', dump1: 'dumpfull' };
  const SWEEP_R = 170;   // a container fixed takes the litter this close with it
  const SIDE = { dump0: [['bag1', 50, 2], ['box1', 28, 16], ['bag2', 0, 16]], dump1: [['bag1', -44, 6], ['box1', 42, 4], ['bag2', 14, 16]] };
  function setFull(key, full) {
    const p = propOf(key); if (!p) return;
    if (full) cond.full.add(key); else cond.full.delete(key);
    const cx = p.x + p.w / 2;
    if (full && !fullSprites[key]) {
      fullSprites[key] = sprite(FULL_ART[key] || 'binfull', cx, p.base, { z: p.base }); p.el.hidden = true;
      // …and what stands beside it: bags and a box by a dumpster, a pizza box or a bag by a bin (Trym, 15 Sep)
      // (the works-yard one has the timber stack on its left, so its bags stand right and in front)
      const side = SIDE[key] || [[h(dayNum(), 31, key.charCodeAt(key.length - 1)) < 0.5 ? 'trash2' : 'bag3', 18, 4]];
      sideSprites[key] = side.map(([k, dx, dy]) => sprite(k, cx + dx, p.base + dy, { z: p.base + dy })).filter(Boolean);
    } else if (!full && fullSprites[key]) {
      kill(fullSprites[key]); fullSprites[key] = null; p.el.hidden = false;
      (sideSprites[key] || []).forEach((s2) => { poof(s2.x, s2.y - 6); kill(s2); }); sideSprites[key] = [];
    }
  }
  // 🎬 a dumpster emptied: the bags puff away, the pack's lid comes down over it, and the works-yard
  // one (open by nature) stays closed for the day
  function emptyDumpster(key) {
    const p = propOf(key); if (!p) return;
    setFull(key, false);
    const cx = p.x + p.w / 2;
    if (key === 'dump0') { p.el.hidden = true; const c = sprite('dumpclosed', cx, p.base, { z: p.base }); if (c) fullSprites.closed0 = c; }
    const s = sprite('dumpclose', cx, p.base, { z: p.base + 1, fps: 10, mode: 'once' });
    if (s) s.onDone = () => kill(s);
  }
  function setFountain(dry) {
    cond.fountainDry = dry;
    const f = world.querySelector('.tw-fountain[data-key="fountain"]');
    if (dry && !dryFountain) { dryFountain = sprite('fountainoff', 1100, 900, { z: 900 }); if (f) f.hidden = true; }
    else if (!dry && dryFountain) { kill(dryFountain); dryFountain = null; if (f) f.hidden = false; }
  }

  // ═══════════════════════════════════ the problems ═══════════════════════════════════
  // YOURS: seeded by (you, the day, the band). Fixed ones are remembered on this device for
  // the day (tw-fixed-v1); the coins are capped per person on the pass worker and the
  // contribution per person on the room, so a second device costs nothing but a repeat.
  const FIXED_KEY = 'tw-fixed-v1';
  function fixed() { try { const f = JSON.parse(localStorage.getItem(FIXED_KEY) || 'null'); return f && f.d === dayNum() && Array.isArray(f.ids) ? f.ids : []; } catch (e) { return []; } }
  const isFixed = (id) => fixed().includes(id);
  function remember(id) { try { localStorage.setItem(FIXED_KEY, JSON.stringify({ d: dayNum(), ids: [...fixed(), id] })); } catch (e) {} }
  let problems = [];   // { id, type, x, y, key, pays, rep, el: mark, sprite }
  function reseedProblems() {
    problems.forEach((p) => { if (p.el) p.el.remove(); kill(p.sprite); });
    problems = [];
    const look = LOOK[band], d = dayNum(), who = parseInt(me().slice(0, 6), 16) || 7;
    const seed = who % 100000 + d * 31 + BANDS.indexOf(band);
    const stormRecent = L.stormAt && Date.now() - L.stormAt < 6 * 3600000;
    const types = PROBLEMS.filter((t) => t.bands.includes(band) && (!t.wx || (t.wx === 'storm' && stormRecent)));
    // every candidate instance, then a weighted seeded draw without repeating an anchor
    const cands = [];
    const usedPerch = new Set(cond.crows.map((s) => s.perch.join(',')));
    for (const t of types) {
      if (t.on === 'lamps') ANCHORS.lamps.filter((k) => cond.lamps[k] !== 'ok').forEach((k) => { const p = propOf(k); if (p) cands.push({ t, key: k, x: p.x + p.w / 2, y: p.base + 4 }); });
      else if (t.on === 'street') ANCHORS.street.forEach(([x, y], i) => cands.push({ t, key: 's' + i, x, y }));
      else if (t.on === 'walls') ANCHORS.walls.forEach(([x, y, k]) => cands.push({ t, key: k, x, y }));
      else if (t.on === 'perches') ANCHORS.perches.filter(([x, y]) => !usedPerch.has(x + ',' + y)).forEach(([x, y, k]) => cands.push({ t, key: k, x, y }));
      else if (t.on === 'kiosks') [...cond.shut].forEach((k) => { const p = propOf(k); if (p) cands.push({ t, key: k, x: p.x + p.w / 2, y: p.base + 6 }); });
      else if (t.on === 'bins' || t.on === 'dumps') ANCHORS[t.on].filter((k) => cond.full.has(k)).forEach((k) => { const p = propOf(k); if (p) cands.push({ t, key: k, x: p.x + p.w / 2, y: p.base + 4 }); });
      else if (t.on === 'fountain') { if (look.fountain === 'dry') cands.push({ t, key: 'fountain', x: 1100, y: 920 }); }
    }
    const n = PROBLEM_COUNT[band];
    // ⚠️ a kiosk shut by TODAY is always one of your problems, whatever the count: a closed
    // door with no way to open it is the one thing the design forbids
    for (const k of todayShut) {
      const c = cands.find((q) => q.t.on === 'kiosks' && q.key === k);
      if (!c || isFixed(c.t.id + ':' + k)) continue;
      cands.splice(cands.indexOf(c), 1);
      const p = { id: c.t.id + ':' + k, type: c.t.id, x: c.x, y: c.y, key: k, pays: c.t.pays, rep: c.t.rep, el: mark(c.x, c.y), sprite: null };
      problems.push(p);
    }
    for (let i = 0; i < n && cands.length; i++) {
      // rarer types get a smaller share than the street's many spots would give them
      const pick = weighted(cands, (c) => (c.t.on === 'street' ? 1 : c.t.on === 'lamps' ? 2.5 : 3), seed + i * 17);
      const id = pick.t.id + ':' + pick.key;
      for (let k = cands.length - 1; k >= 0; k--) if (cands[k].key === pick.key && cands[k].t.on === pick.t.on) cands.splice(k, 1);
      if (isFixed(id)) continue;
      const p = { id, type: pick.t.id, x: pick.x, y: pick.y, key: pick.key, pays: pick.t.pays, rep: pick.t.rep, el: null, sprite: null,
        foot: pick.t.id === 'crows' ? (propOf(pick.key) || { base: pick.y + 100 }).base : pick.y };   // where the tap's walk ends (a crow's perch is a roof)
      // ⚠️ a mark must paint IN FRONT of the prop it belongs to: a tag sits on a wall above the
      // building's foot, and a ring at the tag's own y painted BEHIND the shopfront (Trym, 14 Sep:
      // "its a task, but its hidden behind the building"). The ring goes to the prop's foot, in
      // front, and the icon rides above the thing itself.
      const pb = propOf(p.key) ? propOf(p.key).base : null;
      const onProp = p.type === 'crows' || p.type === 'graffiti';
      const my = onProp && pb != null ? pb + 4 : p.y;
      p.el = mark(p.x, my, 150, pb != null ? 100 + pb + 3 : null, p.type === 'lamp');
      if (p.type === 'litter') p.sprite = sprite(['pile', 'trash1', 'trash2', 'trash3'][Math.floor(h(seed, i, 4) * 4)], p.x, p.y);
      else if (p.type === 'graffiti') p.sprite = sprite(h(seed, i, 2) < 0.5 ? 'graffiti1' : 'graffiti2', p.x, p.y, { z: (propOf(p.key) || { base: p.y }).base + 1 });
      else if (p.type === 'crows') p.sprite = sprite('crow', p.x, p.y, { fps: 2, z: perchZ(p.key) });
      else if (p.type === 'leaves') { const s = sprite('trash1', p.x, p.y); if (s) { s.el.firstChild.src = '/assets/park/l-leaf' + (1 + (i % 2)) + '.png'; p.sprite = s; } }
      problems.push(p);
      glowProblem(p);
    }
  }
  // a subtle glow on the thing itself — its own sprite, or the shared state sprite it sits on
  function glowProblem(p) {
    const g = p.sprite || (p.type === 'bin' || p.type === 'dumpster' ? fullSprites[p.key] : p.type === 'fountain' ? dryFountain : p.type === 'shutter' ? shutSprites[p.key] : null);
    if (g && g.el) g.el.classList.add('is-todo');
  }
  async function fix(id) {
    const i = problems.findIndex((p) => p.id === id); if (i < 0) return false;
    const p = problems.splice(i, 1)[0];
    if (p.el) p.el.remove();
    if (p.type === 'crows') flyOff(p.sprite); else kill(p.sprite);
    if (p.type !== 'crows') burst(p.x, p.y - 8);
    remember(id);
    // what the fix changes for THIS player — and the moment it makes: the lamp flashes on even by
    // day, the shutter rolls up, the crows flap off, the meter pulses (Trym, 14 Sep: "repairing
    // doesnt really give any satisfaction, i just go pick stuff up that disappear")
    if (p.type === 'lamp') { cond.lamps[p.key] = 'ok'; lampsByHour(); const s = lampHalo[p.key]; if (s) { s.el.hidden = false; s.el.style.opacity = ''; s.mode = 'pulse'; s.fps = 6; setTimeout(() => lampsByHour(), 1400); } }
    else if (p.type === 'bin') setFull(p.key, false);
    else if (p.type === 'dumpster') emptyDumpster(p.key);
    else if (p.type === 'fountain') setFountain(false);
    else if (p.type === 'shutter') { cond.fixedShut.add(p.key); rollUp(p.key); life.setKeep(keepFn); }
    // 🧹 a container fixed is a clean-up: the litter lying round it goes too, one piece after another and paid
    // like any fix, and the flyers on the same cobbles are picked up (Trym, 15 Sep)
    if (p.type === 'bin' || p.type === 'dumpster') {
      problems.filter((q) => (q.type === 'litter' || q.type === 'leaves') && Math.hypot(q.x - p.x, q.y - p.y) < SWEEP_R).forEach((q, k) => setTimeout(() => fix(q.id), 160 + k * 160));
      life.sweep(p.x, p.y, SWEEP_R);
    }
    // the optimistic notch: the room's word replaces it on the reply (and if the day's share is
    // spent the notch is not drawn at all — the bar never lies and comes back)
    if (L.cap && L.cap.used < L.cap.max) { L.life = Math.min(100, L.life + 1.2); L.cap.used += 1; paintMeter(); }
    // the pay: on the pass, area 'town', faucet 'fix' (worker-pass RULES.town.fix)
    const coins = p.pays[0] + Math.floor(h(dayNum(), i, 99) * (p.pays[1] - p.pays[0] + 1));
    const got = passStat('coins_earned', coins, 'fix') != null ? coins : 0;
    passStat('rep', p.rep);
    if (hud && hud.refresh) hud.refresh();
    float(p.x, p.y - 40, '+' + got);
    track('town_fix', { kind: p.type, coins: got });
    // the contribution, pooled on the room (past the person's cap it still clears and pays)
    const j = await lifeFetch('/fix', {});
    if (j && typeof j.life === 'number') apply(j);
    return true;
  }

  // ═══════════════════════════════════ the shop ══════════════════════════════════════
  const SALT_SHELF = 0x5e1f;
  function shelfFor() {
    const s = SHELF[band]; if (!s) return null;
    const d = dayNum(), out = [];
    for (const [tier, n] of Object.entries(s)) pickN(POOLS[tier].filter((id) => DEX[id]), n, SALT_SHELF + d * 13 + tier.length).forEach((id) => out.push(id));
    return out;
  }
  function rows(ids, markup, where) {
    const stage = homeStage(), coins = coinsNow(), room = canHold(), ws = COPY.store || {};
    return ids.map((id) => {
      const d = DEX[id]; if (!d) return '';
      const price = Math.max(1, Math.round(d.price * (markup || 1)));
      const can = d.stage <= stage && coins >= price && room;
      // the two notes are copy (store.needs / store.van): nothing until the words are approved
      return '<div class="tw-row"><div class="tw-store__it"><img src="' + esc(d.img) + '" alt=""><div><b>' + esc(d.name) + '</b><small>' + price + ' coins' + (d.stage > stage && ws.needs ? ' · ' + esc(ws.needs) : '') + (shipMin(d) && ws.van ? ' · ' + esc(ws.van) : '') + '</small></div></div>'
        + '<button type="button" data-town-buy="' + esc(id) + '" data-price="' + price + '" data-where="' + esc(where) + '"' + (can ? '' : ' disabled') + '>buy</button></div>';
    }).join('');
  }
  function wireBuys(soldLines) {
    cardBody.querySelectorAll('[data-town-buy]').forEach((b) => b.addEventListener('click', () => {
      const id = b.dataset.townBuy, price = +b.dataset.price, d = DEX[id]; if (!d) return;
      if (!canHold()) return;
      if (!passSpend(price, 'townstore', id)) return;
      const mins = shipMin(d);
      if (mins) orderFor(id, mins); else grantToShed(id);
      if (hud && hud.refresh) hud.refresh();
      b.disabled = true;
      const line = fill(one(soldLines, price + id.length), d.name.toLowerCase());
      if (line) say(line);
      track('town_buy', { id, price, where: b.dataset.where });
      // 🛍 the rest of the shelf re-prices against what is left in the purse
      cardBody.querySelectorAll('[data-town-buy]').forEach((o) => { if (!o.disabled && +o.dataset.price > coinsNow()) o.disabled = true; });
    }));
  }
  function storeCard() {
    const ids = shelfFor();
    const w = COPY.store || {};
    openCard('<h2>The General Store</h2>'
      + (ids ? (w.greet ? '<p class="tw-card__sub">' + esc(fill(w.greet)) + '</p>' : '') + '<div class="tw-store">' + rows(ids, 1, 'store') + '</div>'
        : (w.shut ? '<p class="tw-card__sub">' + esc(fill(w.shut)) + '</p>' : '<p class="tw-card__sub"></p>')));
    if (ids) wireBuys(w.sold);
    return true;
  }
  // the merchant and the vendor: a body by a stall, a shelf when you walk up
  let merchant = null, vendor = null;
  function merchantCard() {
    const w = COPY.merchant || {};
    const ids = pickN(MERCHANT.pool.filter((id) => DEX[id]), MERCHANT.n, SALT_SHELF + dayNum() * 29);
    openCard('<h2>' + esc(w.name || 'The travelling stall') + '</h2>' + (w.greet ? '<p class="tw-card__sub">' + esc(fill(w.greet)) + '</p>' : '')
      + '<div class="tw-store">' + rows(ids, MERCHANT.markup, 'merchant') + '</div>');
    wireBuys(w.lines);
    track('town_merchant', { n: ids.length });
    return true;
  }
  function vendorCard() {
    const w = COPY.vendor || {};
    const ids = pickN(CURSE_SHELF.pool.filter((id) => DEX[id]), CURSE_SHELF.n, SALT_SHELF + dayNum() * 37);
    // what the player holds that the vendor wants: cursed finds sitting in the shed
    const held = OBJECTS.filter((o) => hasInShed(o.decor) > 0 && found(o.id));
    openCard('<h2>' + esc(w.name || 'The night stall') + '</h2>' + (w.greet ? '<p class="tw-card__sub">' + esc(fill(w.greet)) + '</p>' : '')
      + '<div class="tw-store">' + rows(ids, CURSE_SHELF.markup, 'vendor') + '</div>'
      + (held.length ? '<div class="tw-store">' + held.map((o) => { const d = DEX[o.decor]; const wo = W_OBJ[o.id] || {}; return '<div class="tw-row"><div class="tw-store__it"><img src="' + esc(d.img) + '" alt=""><div><b>' + esc(wo.name || d.name) + '</b><small>' + BOUNTY[o.rarity] + ' coins</small></div></div><button type="button" data-town-sell="' + o.id + '">sell</button></div>'; }).join('') + '</div>' : ''));
    wireBuys(w.lines);
    cardBody.querySelectorAll('[data-town-sell]').forEach((b) => b.addEventListener('click', () => {
      const o = OBJECTS.find((x) => x.id === b.dataset.townSell); if (!o) return;
      if (!takeFromShed(o.decor)) return;
      passStat('coins_earned', BOUNTY[o.rarity], 'object');
      if (hud && hud.refresh) hud.refresh();
      b.disabled = true;
      const line = fill(w.bought, (W_OBJ[o.id] || {}).name || DEX[o.decor].name);
      if (line) say(line);
      track('town_object', { id: o.id, sold: 1 });
    }));
    return true;
  }
  // 📌 THE NOTICE BOARD — the card IS the board (Trym, 14 Sep: "make this more visual and look
  // like a game-popup, not a website popup"): a wooden frame, the title on a plank, the
  // town's word for itself stamped on a pinned notice with five street lamps under it (as
  // many lit as the town is well — the one place its state is drawn), and three pinned
  // notes for the tally. The words are the copy file's; the pictures are the town's own.
  function boardCard() {
    const w = COPY.board || {}, wb = W_BAND[band] || {};
    const foundN = OBJECTS.filter((o) => found(o.id)).length;
    const note = (icon, n, label, cls) => '<div class="tw-paper tw-paper--note ' + (cls || '') + '"><i class="tw-pin"></i>' + iconSvg(icon, { size: 26 }) + '<b>' + n + '</b><small>' + esc(label) + '</small></div>';
    // the second notice: what is going on — a night tonight, a night on, the morning after — or,
    // on an ordinary day, that nights exist at all; and always what fixing is for
    const om = omenNow(), after = !curse && !om && L.curseAt && Date.now() - L.curseAt < 8 * 3600000;
    const news = curse && curse !== 'hush' ? w.night : om ? w.omen : after ? w.after : w.curse;
    const bi = BANDS.indexOf(band), nb = W_BAND[BANDS[bi + 1]] || null;
    openCard('<div class="tw-board2">'
      + '<div class="tw-board2__head"><span class="tw-plank tw-plank--card">' + esc(w.title || 'Notices') + '</span></div>'
      + '<div class="tw-paper tw-paper--notice"><i class="tw-pin tw-pin--b"></i>'
      + (wb.name ? '<div class="tw-stamp' + (curse && curse !== 'hush' ? ' tw-stamp--night' : '') + '">' + esc(wb.name) + '</div>' : '')
      + '<canvas class="tw-lamps" width="220" height="66" aria-hidden="true"></canvas>'
      + (nb && nb.name ? '<small class="tw-next">' + (w.next ? esc(w.next) + ' ' : '') + '<b>' + esc(nb.name) + '</b>' + (nb.brings ? ' — ' + esc(fill(nb.brings)) : '') + '</small>' : '')
      + (wb.line ? '<p>' + esc(fill(wb.line)) + '</p>' : '')
      + '</div>'
      + (w.why || news ? '<div class="tw-paper tw-paper--news' + (om || (curse && curse !== 'hush') ? ' is-omen' : '') + '"><i class="tw-pin' + (om || (curse && curse !== 'hush') ? '' : ' tw-pin--b') + '"></i>'
        + (news ? '<p class="tw-news__now">' + esc(fill(news)) + '</p>' : '') + (w.why ? '<p>' + esc(fill(w.why)) + '</p>' : '') + '</div>' : '')
      + '<div class="tw-tally">' + note('tools', L.today.fixes | 0, w.fixes || '', 'is-a') + note('users', L.today.people | 0, w.people || '', 'is-b') + note('moon-solid', foundN + '/' + OBJECTS.length, w.found || '', 'is-c') + '</div>'
      + (foundN ? '<div class="tw-paper tw-paper--list"><i class="tw-pin"></i>' + OBJECTS.filter((o) => found(o.id)).map((o) => { const d = DEX[o.decor], wo = W_OBJ[o.id] || {}; return '<div class="tw-store__it"><img src="' + esc(d.img) + '" alt=""><div><b>' + esc(wo.name || d.name) + '</b>' + (wo.desc ? '<small>' + esc(wo.desc) + '</small>' : '') + '</div></div>'; }).join('') + '</div>' : '')
      + '</div>');
    if (card) card.classList.add('tw-card--board');
    // the way to the next state: how far the town is through this band, no number
    const lo = BAND_LO[band], hi = bi + 1 < BANDS.length ? BAND_LO[BANDS[bi + 1]] : 100;
    drawLamps(cardBody.querySelector('.tw-lamps'), bi + 1, Math.max(0, Math.min(1, ((L.life + nudge) - lo) / Math.max(1, hi - lo))));
    return true;
  }
  // five of the town's own lamps in a row, `lit` of them glowing — drawn from the placed
  // lamp's sprite so the board never needs art of its own
  function drawLamps(cv, lit, frac) {
    if (!cv) return;
    const p = propOf('lamp0'); if (!p) return;
    const img = new Image();
    img.src = p.el.src;
    img.onload = () => {
      const g = cv.getContext('2d'); if (!g) return;
      g.imageSmoothingEnabled = false;
      const n = 5, slot = cv.width / n, lw = 20, lh = Math.round(lw * img.naturalHeight / img.naturalWidth);
      // the bar under the lamps: this band's stretch, filled as far as the town has come
      if (frac != null) { g.fillStyle = '#3a2a10'; g.fillRect(10, cv.height - 7, cv.width - 20, 6); g.fillStyle = '#ffe135'; g.fillRect(11, cv.height - 6, Math.round((cv.width - 22) * frac), 4); }
      for (let i = 0; i < n; i++) {
        const x = Math.round(i * slot + slot / 2), on = i < lit, top = cv.height - lh - 12;
        if (on) {
          const r = g.createRadialGradient(x + 4, top + 8, 2, x + 4, top + 8, 20);
          r.addColorStop(0, 'rgba(255, 225, 90, 0.75)'); r.addColorStop(1, 'rgba(255, 200, 40, 0)');
          g.fillStyle = r; g.fillRect(x - 18, top - 14, 44, 44);
        }
        g.drawImage(img, x - lw / 2, top, lw, lh);
        if (!on) { g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(20, 16, 30, 0.55)'; g.fillRect(x - lw / 2, top, lw, lh); g.globalCompositeOperation = 'source-over'; }
      }
    };
  }
  function openFor(key) {
    if (key === 'store') return storeCard();
    if (key === 'board') return boardCard();
    if ((key === 'cafe' || key === 'info') && cond.shut.has(key) && !cond.fixedShut.has(key)) { const line = one(COPY.closed, dayNum() + key.length); if (line) say(fill(line)); return !!line; }
    return false;
  }

  // ════════════════════════════════════ today ════════════════════════════════════════
  let today = [], parked = null;
  const todayShut = new Set();
  // the day's picks, for any day: today's, or tomorrow's for the parked cart
  function picksFor(d) {
    const n = TODAY_N[band] || 2, left = TODAY.filter((t) => (t.w[band] || 0) > 0), out = [];
    for (let i = 0; i < n && left.length; i++) { const r = weighted(left, (t) => t.w[band], d * 11 + i * 5 + 3); out.push(r.id); left.splice(left.indexOf(r), 1); }
    return out;
  }
  const todayHas = (id) => today.includes(id);
  let oddKey = null;
  function todayStage() {
    const d = dayNum();
    today = picksFor(d);
    todayShut.clear();
    if (todayHas('closed')) todayShut.add(CLOSABLE[Math.floor(h(d, 21) * CLOSABLE.length)]);
    cond.shut = new Set([...LOOK[band].shut, ...todayShut]);
    shutters();
    // the odd spot: one resident, one beat, somewhere they never stand
    oddKey = todayHas('oddspot') ? Object.keys(ODD_SPOTS)[Math.floor(h(d, 22) * 9)] : null;
    life.setOverride(oddKey ? (n2, beat) => (n2.key === oddKey && ODD_SPOTS[oddKey][1] === beat ? ODD_SPOTS[oddKey][0] : null) : null);
    // the merchant
    killBody(merchant); merchant = null;
    if (todayHas('merchant') && MERCHANT.bands.includes(band)) { merchant = body(MERCHANT.at[0], MERCHANT.at[1], { hat: 'cowboy', glasses: 'shades', extras: { backpack: true } }); bodies.add(merchant); }
    // 🧳 and if the stall comes TOMORROW, its cart is parked at the bus stop today — a promise a
    // player can see and come back for (a sign, not a timetable)
    kill(parked); parked = null;
    if (!merchant && MERCHANT.bands.includes(band) && picksFor(d + 1).includes('merchant')) parked = sprite('cartp', 1990, 296, { z: 296 });
    // a strange object by daylight
    if (todayHas('object') && !objects.some((o) => o.day)) spawnObject(d * 3 + 1, true);
  }

  // ════════════════════════════════ the curse, the ghosts, the objects ═══════════════
  let curse = null, forced = null, forcedUntil = 0, curseTold = '', plainNight = false;
  const ghosts = [];   // { def, s, ... }
  const objects = [];  // { def, s, x, y, day }
  let candles = [], night = null;
  function ghostOf(id, def0, set) {   // set: one of a night's set — one of each, over a plain night's; an omen's or a day's wisp is its own
    const def = def0 || GHOSTS.find((g) => g.id === id); if (!def) return null;
    const out = set && ghosts.find((g) => g.def.id === id && !g.done && g.night); if (out) return out.s;
    const at = def.at || def.from || (def.path && def.path[0]) || [1100, 950];
    const s = sprite(def.art, at[0], at[1], { fps: def.fps || 6, cls: 'is-fade is-haunt', mode: def.loop || def.id === 'wisp' ? 'once' : 'loop', z: def.z });   // is-haunt: the curse's purple, weaker than a cursed object's; z: in front of what it sits on
    if (!s) return null;
    const g = { def, s, x: at[0], y: at[1], dir: 1, hideT: 0, done: false, night: !!set };
    if (def.id === 'wisp' || def.loop) s.onDone = () => { g.hideT = 2 + Math.random() * 3; };
    ghosts.push(g);
    return s;
  }
  function moveSprite(s, x, y) { s.x = x; s.y = y; s.el.style.left = pct(x - s.w / 2, W); s.el.style.top = pct(y - s.h, H); s.el.style.zIndex = String(100 + Math.round(y)); }
  function stepGhosts(dt) {
    for (const g of ghosts) {
      if (g.done) continue;
      const d = g.def, s = g.s;
      // 👣 walked into, a ghost fades and keeps away a while (the drift has its own shyness below); the leader
      // hurries on instead — it is leading you (Trym, 15 Sep: "the ghosts should also flee or fade when i walk into them")
      const near = Math.hypot(ctx.pos.x - g.x, ctx.pos.y - g.y);
      if (d.from && d.to) g.hurry = near < 56 ? 3 : Math.max(0, (g.hurry || 0) - dt);
      else if (!d.path) {
        if (!g.fled && near < 42) { g.fled = 1; g.fleeT = 4 + Math.random() * 3; s.el.style.opacity = '0'; }
        else if (g.fled) { g.fleeT -= dt; if (g.fleeT <= 0 && near > 70) { g.fled = 0; s.el.style.opacity = ''; } }
      }
      if ((d.id === 'wisp' || d.loop) && s.mode === 'done') { g.hideT -= dt; if (g.hideT <= 0) { s.el.hidden = false; show(s, 0); s.mode = 'once'; } continue; }
      if (d.path) {   // back and forth, and shy of the player
        const [a, b] = d.path, tx = g.dir > 0 ? b[0] : a[0];
        const nx = g.x + Math.sign(tx - g.x) * d.speed * dt;
        if (Math.abs(tx - g.x) < 3) g.dir = -g.dir;
        moveSprite(s, nx, g.y);
        s.el.classList.toggle('is-flip', g.dir < 0);
        const near = Math.hypot(ctx.pos.x - g.x, ctx.pos.y - g.y) < (d.near || 90);
        if (near && !g.shy) { g.shy = 1; s.el.style.opacity = '0'; g.hideT = 6; }
        else if (g.shy) { g.hideT -= dt; if (g.hideT <= 0 && !near) { g.shy = 0; s.el.style.opacity = ''; } }
      } else if (d.from && d.to) {   // walks to somewhere and is gone; something is left there
        const dx = d.to[0] - g.x, dy = d.to[1] - g.y, dist = Math.hypot(dx, dy);
        if (dist < 4) { g.done = true; s.el.style.opacity = '0'; setTimeout(() => kill(s), 1500); if (d.leaves === 'object') spawnObject(dayNum() * 7 + 2, false, d.to); }
        else { const st = Math.min(dist, d.speed * (g.hurry > 0 ? 2.4 : 1) * dt); moveSprite(s, g.x + dx / dist * st, g.y + dy / dist * st); s.el.classList.toggle('is-flip', dx < 0); }
      } else if (d.bob) {   // leaning at a door
        g.t = (g.t || 0) + dt;
        s.el.style.transform = 'translateY(' + (Math.sin(g.t * 2.2) * 3).toFixed(1) + 'px)';
      }
    }
  }
  function clearGhosts(keepDay) {
    for (const g of ghosts.slice()) { if (keepDay && g.s === cond.dayghost) continue; g.done = true; g.s.el.style.opacity = '0'; const s = g.s; setTimeout(() => kill(s), 1500); ghosts.splice(ghosts.indexOf(g), 1); }
  }
  const found = (id) => { try { return statTotal(passRaw(), 'cur_' + id) > 0; } catch (e) { return false; } };
  function spawnObject(seed, day, at, forced) {
    const def = forced || weighted(OBJECTS, (o) => RARITY_W[o.rarity], seed);   // a chapter names its object; a night draws one
    // its place by seed, then a spot in it nothing else stands on (two on one spot hid each other, 15 Sep)
    const spots = WHERE[def.where[Math.floor(h(seed, 3) * def.where.length)]] || [[1100, 1000]];
    let spot = at;
    if (!spot) { const j = Math.floor(h(seed, 5) * spots.length); for (let q = 0; q < spots.length && !spot; q++) { const c = spots[(j + q) % spots.length]; if (!objects.some((o) => Math.hypot(o.x - c[0], o.y - c[1]) < 60)) spot = c; } spot = spot || spots[j]; }
    const d = DEX[def.decor]; if (!d) return null;
    // an ordinary decor sprite, on the ground, with its small wrongness
    const el = document.createElement('div');
    el.className = 'tw-state' + (def.fx === 'hum' ? ' is-hum' : def.fx === 'flicker' ? ' is-flicker' : '');
    const w = Math.round(d.w * 0.9), hh = Math.round(d.h * 0.9);
    el.style.left = pct(spot[0] - w / 2, W); el.style.top = pct(spot[1] - hh, H); el.style.width = pct(w, W); el.style.aspectRatio = w + ' / ' + hh; el.style.zIndex = String(100 + spot[1]);
    const im = document.createElement('img'); im.src = d.img; im.alt = ''; im.className = 'is-on'; if (def.fx === 'turn') im.style.transform = 'scaleX(-1)'; el.appendChild(im);
    world.appendChild(el);
    el.classList.add('is-cursed');
    // 🔮 the curse shows on it: a dark purple aura on the ground, the pack's low flame (tinted purple in CSS)
    // licking round its foot behind it, sparks in front (Trym, 15 Sep: "a dark purple flaming glow")
    const k = Math.max(1.4, w / 26), aw = Math.round(Math.max(90, w * 3)), ah = Math.round(aw * 0.45);
    const aura = document.createElement('div');
    aura.className = 'tw-aura';
    aura.style.left = pct(spot[0] - aw / 2, W); aura.style.top = pct(spot[1] - ah / 2, H); aura.style.width = pct(aw, W); aura.style.aspectRatio = aw + ' / ' + ah; aura.style.zIndex = String(100 + spot[1] - 2);
    world.appendChild(aura);
    const flame = sprite('flame', spot[0], spot[1] + 12 * k, { z: spot[1] - 1, fps: 8, cls: 'is-flame', size: k });
    const lick = sprite('flame', spot[0], spot[1] + 12 * k * 0.45 + 3, { z: spot[1] + 1, fps: 9, cls: 'is-flame is-lick', size: k * 0.45 });   // small, at the foot only: the thing itself stays readable
    const spark = sprite('spark', spot[0], spot[1] + 13 * k - hh * 0.2, { z: spot[1] + 2, fps: 7, cls: 'is-flame', size: k });
    const o = { def, el, x: spot[0], y: spot[1], day: !!day, m: mark(spot[0], spot[1] + 2), aura, flame, lick, spark };
    objects.push(o);
    return o;
  }
  function unhaunt(o) { if (o.aura) o.aura.remove(); kill(o.flame); kill(o.lick); kill(o.spark); }
  function takeObject(o) {
    const i = objects.indexOf(o); if (i < 0) return;
    objects.splice(i, 1); o.el.remove(); o.m.remove(); unhaunt(o); burst(o.x, o.y - 6);
    const first = !found(o.def.id);
    passStat('cur_' + o.def.id, 1);
    const ok = grantToShed(o.def.decor);
    const wo = W_OBJ[o.def.id] || {};
    if (wo.name) say(wo.name + (wo.desc ? '. ' + wo.desc : ''));
    track('town_object', { id: o.def.id, first: first ? 1 : 0, kept: ok ? 1 : 0 });
    if (first) passStat('rep', 5);
  }
  function enterCurse(type) {
    curse = type;
    if (night) night.style.opacity = String(type === 'hush' ? NIGHT.hush : NIGHT.curse);
    weather.setKind(type === 'deep' ? 'storm' : type === 'creep' ? 'heavy' : null);
    if (type !== 'hush') {
      life.setKeep(keepFn); life.setGlow(() => false);
      cond.shut.add('cafe'); cond.shut.add('info'); shutters();
      candles = [[1100, 596], [1700, 596], [480, 1076], [1620, 1076]].map(([x, y]) => sprite('candle', x, y, { fps: 5 })).filter(Boolean);
    }
    (NIGHT_GHOSTS[type] || []).forEach((id) => ghostOf(id, null, true));
    const nObj = type === 'deep' ? 2 : type === 'creep' ? 1 : 0;
    for (let i = 0; i < nObj; i++) spawnObject(dayNum() * 5 + i * 3 + 11, false);
    if (type === 'deep') { vendor = body(CURSE_SHELF.at[0], CURSE_SHELF.at[1], { hat: 'tophat', glasses: 'nerd' }); bodies.add(vendor); }
    lampsByHour();
    if (curseTold !== type + dayNum()) { curseTold = type + dayNum(); track('town_curse', { tier: type }); }
  }
  function leaveCurse() {
    curse = null;
    weather.setKind(null);
    life.setGlow((n) => h(dayNum(), 2, n.idx) >= LOOK[band].windowsDark);
    cond.shut = new Set([...LOOK[band].shut, ...todayShut]); shutters();
    life.setKeep(keepFn);
    candles.forEach(kill); candles = [];
    clearGhosts(true); plainNight = false;   // still night? the plain set comes back on the next look
    killBody(vendor); vendor = null;
    for (const o of objects.slice()) if (!o.day) { objects.splice(objects.indexOf(o), 1); o.el.remove(); o.m.remove(); unhaunt(o); }
    lampsByHour();
  }
  // 🌒 THE OMENS. A night that will charge the town is foreshadowed for three hours before it:
  // crows gather on every perch, a wisp shows by daylight, the sky goes wrong at the edges, and
  // the board pins a red notice. A sign, never a time — the clock is still nobody's to read.
  const OMEN_MS = 3 * 3600000;
  let omenOn = false, omenCrows = [], omenWisp = null;
  function omenNow() {
    if (forced) return forced === 'omen' ? { type: 'deep' } : null;   // a chapter, or the QA seam, can call the omen up
    const d = Math.floor(Date.now() / CURSE_DAY_MS), t = Date.now();
    for (const e of curseDay(d)) { if (e.type === 'hush') continue; const at = d * CURSE_DAY_MS + e.at; if (t >= at - OMEN_MS && t < at) return { at, type: e.type }; }
    return null;
  }
  function omens(on) {
    omenOn = on;
    omenCrows.forEach(kill); omenCrows = [];
    if (on) {
      const taken = new Set([...cond.crows.filter((s) => !s.gone).map((s) => s.perch.join(',')), ...problems.filter((p) => p.type === 'crows').map((p) => p.x + ',' + p.y)]);
      for (const [x, y, k] of ANCHORS.perches) if (!taken.has(x + ',' + y)) { const s = sprite('crow', x, y, { fps: 2, z: perchZ(k) }); if (s) omenCrows.push(s); }
      if (!omenWisp) omenWisp = ghostOf('wisp');
      night.style.background = '#2a1040';
    } else { kill(omenWisp); omenWisp = null; night.style.background = ''; }
  }
  function curseNow() {
    if (forced && Date.now() < forcedUntil) return forced === 'omen' ? 'none' : forced;   // a chapter's own night — or 'none', a chapter's own calm
    if (forced) forced = null;
    return curseAt(Date.now()).type;
  }

  // ═══════════════════════════════════ the sky, the tick ═════════════════════════════
  night = document.createElement('i'); night.className = 'tw-night'; view.appendChild(night);
  let lastBeat = -1, secAt = 0;
  // 🚶 WALK-OVER: everything but a lamp is picked up or fixed by walking onto it (or up to it, for a thing you
  // cannot stand on) — a lamp is a repair, and a repair is a tap (Trym, 15 Sep: "it became tedious to tap on all
  // objects. streetlights can be tapped"). The reach is measured from the thing's foot; the tap's own walk
  // ends 26 px in front of it, so every reach covers that spot too.
  const REACH = { litter: 30, leaves: 30, bin: 60, dumpster: 64, shutter: 62, fountain: 72, graffiti: 56, crows: 74 };
  let autoAt = 0;
  function autoPick(now) {
    if (now - autoAt < 120 || (ctx.inside && ctx.inside())) return;
    autoAt = now;
    const px = ctx.pos.x, py = ctx.pos.y;
    for (const p of problems) { const r = REACH[p.type]; if (r && Math.hypot(p.x - px, (p.foot != null ? p.foot : p.y) - py) < r) { fix(p.id); return; } }
    for (const o of objects) if (Math.hypot(o.x - px, o.y - py) < 34) { takeObject(o); return; }
    const f = life.pickAt ? life.pickAt(px, py, 30) : null;
    if (f) { float(f.x, f.y - 30, '+1'); if (hud && hud.refresh) hud.refresh(); }
  }
  function tick(now, dt) {
    stepSprites(dt);
    autoPick(now);
    stepGhosts(dt);
    stepFlying(dt);
    swayBodies(now);
    paintClock(now);
    if (now < secAt) return;
    secAt = now + 500;
    const c = curseNow(), cType = c === 'none' ? null : c;
    if (cType !== curse) { if (curse) leaveCurse(); if (cType) enterCurse(cType); }
    const om = !curse && !!omenNow();
    if (om !== omenOn) omens(om);
    const beat = life.beat();
    if (beat !== lastBeat) { lastBeat = beat; lampsByHour(); }
    night.hidden = inside();
    hbar.hidden = inside();
    if (!curse) night.style.opacity = String(beat === 5 ? NIGHT.night : beat === 4 ? NIGHT.evening : omenOn ? 0.12 : 0);
    // 👻 every night has its ghosts; dawn takes them (a Curse Night owns its own until it ends)
    if (beat === 5 && !curse && !plainNight) { plainNight = true; (NIGHT_GHOSTS.night || []).forEach((id) => ghostOf(id, null, true)); }
    else if (beat !== 5 && plainNight) { plainNight = false; if (!curse) clearGhosts(true); }
    const dark = beat === 4 || beat === 5 || !!curse;
    for (const s of cond.decor) s.el.hidden = !dark;
    // crows fly when you come close (and settle again on the next condition)
    for (const s of cond.crows) if (!s.gone && Math.hypot(ctx.pos.x - s.x, ctx.pos.y - s.y) < 70) flyOff(s);
    // a day changes under a long visit: the seeds move on
    if (dayNum() !== dayAt) { dayAt = dayNum(); todayStage(); condition(); reseedProblems(); }
  }
  let dayAt = dayNum();

  // ═══════════════════════════════ taps: what is under the finger ════════════════════
  function at(wx, wy) {
    for (const p of problems) if (Math.abs(wx - p.x) < 40 && wy < (p.foot || p.y) + 16 && wy > p.y - 64) return ['room', 'p:' + p.id];
    for (const o of objects) if (Math.abs(wx - o.x) < 34 && wy < o.y + 10 && wy > o.y - 60) return ['room', 'o:' + o.def.id];
    for (const g of ghosts) if (!g.done && g.def.tap && Math.abs(wx - g.x) < 34 && wy < g.y + 6 && wy > g.y - 80) return ['room', 'g:' + g.def.id];
    if (merchant && Math.abs(wx - merchant.x) < 34 && wy < merchant.y + 6 && wy > merchant.y - 90) return ['room', 'm'];
    if (vendor && Math.abs(wx - vendor.x) < 34 && wy < vendor.y + 6 && wy > vendor.y - 90) return ['room', 'v'];
    return null;
  }
  function tap(id, walkTo) {
    const [kind, rest] = [id.slice(0, 1), id.slice(2)];
    if (kind === 'p') { const p = problems.find((q) => q.id === rest); if (p) walkTo(p.x, (p.foot || p.y) + 26, () => fix(rest)); }
    else if (kind === 'o') { const o = objects.find((q) => q.def.id === rest); if (o) walkTo(o.x, o.y + 22, () => takeObject(o)); }
    else if (kind === 'g') { const g = ghosts.find((q) => q.def.id === rest && !q.done); if (g) walkTo(g.x + (ctx.pos.x < g.x ? -56 : 56), g.y + 6, () => { const line = one(COPY.ghosts, dayNum() + ghosts.length); if (line) say(fill(line)); if (g.s.n > 1) { g.s.fps = 9; setTimeout(() => { g.s.fps = g.def.fps || 5; }, 2500); } track('town_ghost', { id: rest }); }); }
    else if (kind === 'm' && merchant) walkTo(merchant.x + (ctx.pos.x < merchant.x ? -58 : 58), merchant.y + 8, merchantCard);
    else if (kind === 'v' && vendor) walkTo(vendor.x + (ctx.pos.x < vendor.x ? -58 : 58), vendor.y + 8, vendorCard);
  }

  // ═══════════════════════════════════ the story's hooks ═════════════════════════════
  // ⚠️ LOCAL to the player in the chapter — the questline's ONE RULE (world-quest.js):
  // a chapter never touches shared state. A forced night here is this player's night.
  const story = {
    forceCurse: (o = {}) => { forced = o.tier || 'deep'; forcedUntil = Date.now() + (o.mins || 15) * 60000; },
    endCurse: () => { forced = null; forcedUntil = 0; },
    addGhost: (def) => ghostOf(def.id, { fps: 6, ...def }),
    plantObject: (id, at) => { const def = OBJECTS.find((o) => o.id === id); return def ? spawnObject(dayNum() + id.length, true, at, def) : null; },
    closeShop: (key) => { if (CLOSABLE.includes(key)) { cond.shut.add(key); cond.fixedShut.delete(key); shutters(); life.setKeep(keepFn); } },
    nudgeLife: (delta) => { nudge += +delta || 0; apply({ ...L }); },
  };

  // ═══════════════════════════════════ the QA seam ═══════════════════════════════════
  const seam = {
    life: () => L, band: () => band, test: TEST, err: () => lastErr,
    set: (v) => { if (!TEST) return false; shim.v = Math.max(0, Math.min(100, +v)); return read(); },   // through the real read, hysteresis and all
    curse: (t) => { if (t) story.forceCurse({ tier: t, mins: 30 }); else story.endCurse(); },   // 'none' = a forced calm, 'omen' = the signs without the night
    omen: () => omenOn, nextIn: () => { const o = omenNow(); return o && o.at ? Math.round((o.at - Date.now()) / 60000) : null; },
    problems: () => problems.map((p) => ({ id: p.id, type: p.type, x: p.x, y: p.y, key: p.key })),
    // QA: one more problem — of a container type at the first full one with none, or a litter piece at a spot
    plant: (type, at) => {
      if (!TEST) return null;
      const t = PROBLEMS.find((r) => r.id === type); if (!t) return null;
      let p;
      if (at) { const key = 'qa' + problems.length; p = { id: t.id + ':' + key, type: t.id, x: at[0], y: at[1], key, pays: t.pays, rep: t.rep, el: mark(at[0], at[1], 150, null, false), sprite: sprite('pile', at[0], at[1]), foot: at[1] }; }
      else { const key = (ANCHORS[t.on] || []).find((k) => (t.on === 'lamps' ? cond.lamps[k] !== 'ok' : cond.full.has(k)) && !problems.some((q) => q.key === k)); const p0 = propOf(key); if (!p0) return null; p = { id: t.id + ':' + key, type: t.id, x: p0.x + p0.w / 2, y: p0.base + 4, key, pays: t.pays, rep: t.rep, el: mark(p0.x + p0.w / 2, p0.base + 4, 150, 100 + p0.base + 3, t.id === 'lamp'), sprite: null, foot: p0.base + 4 }; }
      problems.push(p); glowProblem(p); return p.id;
    },
    fix, fixed,
    lamps: () => ({ ...cond.lamps }), lit: () => !!lampsLit,
    shut: () => [...cond.shut].filter((k) => !cond.fixedShut.has(k)),
    ghosts: () => ghosts.filter((g) => !g.done).map((g) => ({ id: g.def.id, x: Math.round(g.x), y: Math.round(g.y), hidden: g.s.el.style.opacity === '0' })),
    objects: () => objects.map((o) => ({ id: o.def.id, x: o.x, y: o.y, day: o.day })),
    take: (id) => { const o = objects.find((q) => q.def.id === id); if (o) takeObject(o); return !!o; },
    night: () => +night.style.opacity || 0,
    shelf: () => shelfFor(), today: () => today.slice(), odd: () => oddKey,
    merchant: () => !!merchant, vendor: () => !!vendor, visitors: () => cond.visitors.length, crows: () => cond.crows.filter((s) => !s.gone).length,
    full: () => [...cond.full], fountain: () => (cond.fountainDry ? 'dry' : 'on'),
    cards: { store: storeCard, board: boardCard, merchant: merchantCard, vendor: vendorCard, health: healthCard },
    story, copy: () => Object.keys(COPY),
    coins: () => coinsNow(), found,
    hbar: () => ({ pct: hPct.textContent, fill: hFill.style.width, phase: hbarPhase, used: Math.min(10, (L.cap && L.cap.used) | 0) }),
    clock: () => (slot ? slot.textContent : ''), parked: () => !!parked,
    // 🧪 a QA purse (the pass worker refuses the 'qa' faucet; the coins stay on the local ledger)
    rich: () => (TEST ? passStat('coins_earned', 500, 'qa') : 0),
  };
  return { tick, at, tap, openFor, seam, story };
}
