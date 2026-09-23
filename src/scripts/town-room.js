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
import { seedRand, worldOwner, worldSid, worldToken, curseAt, curseDay, CURSE_DAY_MS, poofInto, burstInto, townHauntAt } from '../lib/world.js';
import { passStat, passSpend, passRaw, statTotal, coinsNow, ruleUsed, coinsPaid } from '../lib/banana-pass.js';
import { DECOR } from '../data/decor.js';
import { grantToShed, orderFor, takeFromShed, hasInShed, homeStage, canHold, shipMin } from '../lib/homestead-inventory.js';
import { STATE, OB_RECTS, OB_CIRCLES, STORE, HOARD, CAFE_WIN, INFO_WIN, OVERLAYS, ARCADE } from './town-geo.js';
import { HOARD_ON, HOARDABLE, SIGNATURES, SIGN_AT } from '../data/town/locks.js';
import { iconSvg } from '../lib/pixel-icons.js';   // the board's three notes wear pixel icons, never OS emoji
import { arrived as callIn, calls as callsAt } from '../lib/work-calls.js';   // 📟 the on-call staff's work comes in as calls (slice 0b)
import { BANDS, BAND_LO, HYST, LOOK, PROBLEM_OPEN, WAVES, NIGHT, VISITOR_SPOTS, NIGHT_AFTER, NIGHT_AFTER_MS } from '../data/town/condition.js';
import { PROBLEMS, ANCHORS } from '../data/town/problems.js';
import { POOLS, SHELF, MERCHANT, CURSE_SHELF } from '../data/town/stock.js';
import { TODAY, TODAY_N, ODD_SPOTS, CLOSABLE } from '../data/town/today.js';
import { GHOSTS, NIGHT_GHOSTS, DAY_GHOSTS, ROAM } from '../data/town/ghosts.js';
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
// 🔁 the day is cut into WAVES: a fresh set of your own things about every six hours, so the town is
// worth opening twice in a day (condition.js explains the arithmetic). waveOfs is the walk's door.
let waveOfs = 0;
function waveNum() { return Math.floor((Date.now() % 86400000) / (86400000 / WAVES)) + waveOfs; }
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
  let L = { life: 42, band: 'recovering', set: 42, cap: { used: 0, max: 24 }, today: { fixes: 0, people: 0 }, curse: 'none', stormAt: 0, curseAt: 0 };
  let band = null, nudge = 0, readAt = 0, lastErr = '';
  // 🧪 ?towntest: the room's arithmetic in memory, so the whole town can be walked with no
  // worker and pushed to any band from the QA seam. The shim answers like the room does.
  // 🌑 `night` is the QA door for the MORNING AFTER: a walk cannot wait a month for a deep Curse
  // Night (3% of days) and then stay up for it. { tier, at } is exactly what the room would say.
  const shim = { v: 42, used: 0, fixes: 0, people: 0, night: null, dark: 0 };   // dark = tonight's take (the shim has one long night)
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
      if (path === '/fix') { if (shim.used < 24) { shim.v = Math.min(100, shim.v + 2); shim.used++; shim.fixes++; shim.people = 1; } }   // mirrors worker-rave TOWN_FIX / TOWN_FIX_CAP
      let counted = 0;
      // 👻 mirrors worker-rave TOWN_DARK (2 a wreck) / TOWN_DARK_NIGHT (15 points) / TOWN_DARK_FLOOR (45): the shim is one long plain night
      if (path === '/dark') { const n = Math.max(1, Math.min(10, Math.round(+(body && body.n)) || 1)); counted = Math.max(0, Math.min(n, Math.floor(Math.min(15 - shim.dark, Math.floor(shim.v - 45 + 1e-9)) / 2))); shim.v = Math.max(5, shim.v - 2 * counted); shim.dark += 2 * counted; }
      return { life: Math.round(shim.v * 10) / 10, band: bandOf(shim.v), set: 42, cap: { used: shim.used, max: 24 }, dark: { used: shim.dark, max: 15, floor: 45, night: true, per: 2 }, counted, today: { fixes: shim.fixes, people: shim.people, dark: shim.dark },
        // ⚠️ a forced MORNING says a night happened and that none is happening now — setting `curse`
        // to the tier put ghosts in the square in daylight, which is a different thing entirely.
        curse: curseAt(Date.now()).type, stormAt: 0,
        curseAt: shim.night ? shim.night.at : 0, curseKind: shim.night ? shim.night.tier : '', ok: 1 };
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
  function apply(j) {
    if (!j || typeof j.life !== 'number') return;
    Object.assign(lampWas, cond.lamps);
    L = j;
    const b = bandOf(Math.max(0, Math.min(100, j.life + nudge)));
    // today first (it decides what is shut), then the look, then what you can put right
    // ⚠️ …OR WHEN THE NIGHT'S MARK CHANGES. This ran on a band change alone, so a Curse Night that
    // did not move the band changed nothing on screen — which, since every band above 65 looks
    // identical, meant the hardest night in the game was invisible on a healthy town. The mark
    // coming ON at dawn and OFF twelve hours later are both events the square has to notice.
    const mk = wornKind();
    if (b !== band || mk !== wasMark) { band = b; wasMark = mk; todayStage(); condition(); reseedProblems(); if (roomAt) roomShow(roomAt); }
    // 🎉 a band change while you are here is an EVENT: the new name, and what it brings (up) or
    // what it looks like (down) — and a puff on every lamp whose state changed. (An arrival toast with the
    // band's words used to show on every load; the board and the health card say the same — Trym, 15 Sep:
    // "i dont get why its there … if it doesnt bring any value remove it")
    const wb = W_BAND[band] || {};
    if (wasBand && wasBand !== band && wb.name) { say(BANDS.indexOf(band) > BANDS.indexOf(wasBand) && wb.brings ? wb.name + ' — ' + fill(wb.brings) : wb.name); for (const k of ANCHORS.lamps) { const p = propOf(k); if (p && lampWas[k] && lampWas[k] !== cond.lamps[k]) poof(p.x + p.w / 2, p.base - 40); } }
    wasBand = band;
    paintMeter();
  }
  let wasBand = null, wasMark = '';
  const lampWas = {};
  async function read() { readAt = Date.now(); apply(await lifeFetch('')); }
  // 👻 A GHOST'S DAMAGE IS CHARGED TO THE TOWN (21 Sep 2026; Trym: "the meter didnt move a bit -
  // doesnt feel very scary then"). Each lamp a ghost puts out and each bin it tips is a point off the
  // meter — at once here, and on the room's word a moment later (worker-rave /life/dark: capped per
  // person per day, taken only while ghosts are out). Batched: a ghost rests every twenty seconds or
  // so, so a night is a handful of calls, never one a frame.
  let darkN = 0, darkT = 0;
  const flushDark = async () => {
    clearTimeout(darkT); darkT = 0;
    const n = darkN; darkN = 0;
    if (!n) return null;
    track('town_dark', { n });
    const j = await lifeFetch('/dark', { n });
    if (j) apply(j);
    return j;
  };
  function dark(n) {
    n = Math.max(1, Math.round(+n || 1));
    // the optimistic notch, the fix's mirror: drawn only while tonight's take is unspent and the meter
    // is above the ghosts' floor, so the bar never shows a drop the room will not confirm. The room counts
    // POINTS, `per` a wreck (2 since 23 Sep 2026, when the nights were made to bite)
    const p = n * ((L.dark && L.dark.per) || 2);
    const can = !L.dark || (L.dark.used + p <= L.dark.max && L.life - p >= (L.dark.floor == null ? 0 : L.dark.floor));
    if (can) { L.life = Math.max(0, L.life - p); if (L.dark) L.dark.used += p; paintMeter(); }
    darkN += n;
    if (!darkT) darkT = setTimeout(flushDark, 1500);
  }
  // a read on arrival, then every minute while the tab is looked at; a tab that comes back
  // reads at once (a storm may have passed)
  read();
  setInterval(() => { if (!document.hidden && Date.now() - readAt > 55000) read(); }, 15000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - readAt > 20000) read(); });

  // 🪧 ❌ THE BOARD'S PLANK WENT WITH THE BOARD (20 Sep 2026). Its sign used to be renamed here to
  // whatever the copy's `board.title` said, so the square and the card agreed the day the words landed.
  // There is no board and no plank now — `board.title` is the heading of nothing, and COPY.board's other
  // fields are the Square Report, which the health card mounts (town-shop.js report()).

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
  // 🌸 THE TOWN-HEALTH CARD — and since 20 Sep 2026 it is the ONLY place the town reports itself.
  //
  // It is the park's health card to start with: the band's name, the big number, ONE continuous bar
  // with the five bands as zones (ticks at the band lines, a glyph over each, the live one ringed),
  // tap a zone and read that band's line; then your ten pips.
  //
  // ⭐ AND THEN THE SQUARE REPORT, which used to be a notice board you walked across the square to
  // read. Trym: "the Square Report sign is a bit unnecessary now that we have the Town Health Meter
  // popup — can we move the Square Report content into the Town Health popup? And remove the sign?"
  // The two said the same thing twice. The meter is on screen at all times, so the report lives under
  // it: the eight lamps as they are, what wants doing today, tonight's news, and the tally.
  //
  // ⚠️ THE REPORT COMES FROM town-shop.js, a lazy chunk, and this card mounts an empty host for it.
  // Not tidiness — budget: that block pulls the cursed-object table, the decor catalogue and the icon
  // set, and this file is at 87% of its ceiling. The meter is up instantly and the report lands a
  // frame later, which is the whole point of a chunk.
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
      // ⚠️ THE TALLY LINE WENT WITH THE BOARD. It said "3 fixes · 2 people" in plain text; the report
      // below says the same in the three pinned notes it always had, with the cursed objects beside
      // them. Two tallies a finger apart is how a card starts repeating itself.
      // ⭐ THE REPORT SITS BETWEEN THE BAND AND THE PIPS. Reading down: how the town IS, what wants
      // doing about it, what was done today, and how much of that was yours. The pips are the last of
      // the three "today" things and belong beside the tally, not stranded above the whole report.
      + '<div id="twReport"></div>'
      + '<div class="tw-bpips' + (used >= 10 ? ' is-done' : '') + '">' + FACES.concat(FACES).map((_, i) => '<i' + (i < used ? ' class="is-on"' : '') + '></i>').join('') + '</div>');
    const exp = document.getElementById('twBexp');
    const show = (i) => {
      const bw = W_BAND[BANDS[i]] || {};
      exp.className = 'tw-bexp' + (i <= 1 ? ' tw-bexp--sad' : '');
      exp.textContent = (bw.name || '') + (bw.brings ? ' — ' + fill(bw.brings) : '');   // the state, and what it brings
      cardBody.querySelectorAll('.tw-bglyph').forEach((g, gi) => g.classList.toggle('is-open', gi === i));
    };
    if (card) card.classList.add('tw-card--health');
    cardBody.querySelectorAll('.tw-bzone').forEach((bz) => bz.addEventListener('click', () => show(+bz.dataset.p)));
    show(Math.max(0, p));
    // 📌 and the report underneath, out of its own chunk. ⚠️ the host is looked up again when the
    // chunk lands, not closed over: a card opened and shut while the import was in flight would
    // otherwise have the report painted into a node that is no longer on the page.
    loadShop().then((s) => { const h = document.getElementById('twReport'); if (s && h) s.report(h); }).catch(() => {});
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
    let isNight = h >= 20, left = Math.max(0, ((isNight ? 24 : 20) - h) * 30);
    // a Curse Night is a NIGHT however long it runs: the moon, and the time the curse has left (Trym, 15 Sep: the sun
    // on the clock with ghosts about read as "ghosts spawning when daytime arrives")
    if (curse && curse !== 'hush') { isNight = true; left = Math.max(0, (forced ? forcedUntil - Date.now() : curseAt(Date.now()).left) / 1000); }
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
  // ⚠️ the ghost list moved to town-night.js, and this is the generic sprite killer — about twenty
  // call sites. It hands the dead sprite over instead; miss this and a killed ghost stays in the
  // list for ever, haunting the step loop with an element that is not on the page.
  function kill(s) { if (!s || s.gone) return; s.gone = true; s.el.remove(); sprites.delete(s); if (dusk) dusk.unghost(s); }
  function stepSprites(dt) {
    for (const s of sprites) {
      if (s.n < 2 || s.mode === 'still' || s.mode === 'off') continue;
      s.acc += dt;
      if (s.acc < 1 / s.fps) continue;
      s.acc = 0;
      if (s.mode === 'loop') { const lo = s.lo || 0, hi = s.hi != null ? s.hi : s.n - 1; show(s, s.i + 1 > hi || s.i < lo ? lo : s.i + 1); }   // a window of frames: one facing of a four-facing stack
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
  // 💡 THE LAMP'S OWN HIT BOX, AND IT LIVES HERE ONCE (Trym, 18 Sep: "i see a broken streetlight in the
  // square board, but i dont see any options to fix it … no fix icon on any streetlight"). A lamp is
  // 190 px tall and its lantern is where the eye goes, so the icon rides at -118 (ON the lantern, not
  // above it where it reads as belonging to whatever stands behind) and the tap box reaches from the
  // icon down to the foot — the whole lamp answers. ⚠️ the numbers were copied into the reseed only,
  // and the ghosts' own path planted lamps with the default box, so a lamp a ghost put out could not
  // be tapped where its icon was. Two places, two behaviours: now it is one exported constant, and
  // tools/check-design.mjs §24 fails the build if a second copy of the numbers appears.
  const LAMP_HIT = { lift: 118, grab: 54, tall: 190 };
  // 🗑️ the eight kinds of dropped rubbish, and `pile` is the heap the bag rule keeps apart from
  // its own kind (LITTER_GAP below). Every one of them is a thing you can name — see the note in
  // tools/build-town-scene.py for why none of them is grey any more.
  const LITTER_ART = ['pile', 'trash1', 'trash2', 'trash3', 'trash4', 'trash5', 'trash6', 'trash7'];
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
  // the merchant and the vendor: a body by a stall, a shelf when you walk up. ⚠️ these were declared in
  // the middle of the cards block until 19 Sep; they are written by seven sites here, one of them inside
  // lampsByHour(), so they never belonged to the chunk that moved out.
  let merchant = null, vendor = null;
  function swayBodies(now) {
    for (const b of bodies) if (now - b.swayAt > b.period) { b.swayAt = now; b.sw = b.sw ? 0 : 1; drawMe(b.ctx, 150, b.face + b.sw, b.outfit); }
  }
  const killBody = (b) => { if (b) { b.el.remove(); bodies.delete(b); } };

  // ℹ️ SOMEBODY IN THE INFO KIOSK, and the kiosk overflows THEM. Trym, 20 Sep: "if we can make a
  // banana sit inside the kiosk sprite-wise aswell that would be cool — must be implemented like we did
  // with the coffee shop, half upper body-banana that sits inside the info kiosk in locked hands-up-frame,
  // same size on the kiosk-banana as for the coffee shop-banana."
  //
  // It is the café's own recipe (town-cafe.js standIn) with two differences that matter:
  //   · the clip is a RECTANGLE, because the recess is a square-cut counter and not an arch. Its
  //     straight lower edge is what makes this read as half a banana leaning on a counter.
  //   · nobody works here — Trym: "you cant work in the kiosk" — so this banana is never the player and
  //     never has a card of its own. It is the kiosk being OPEN, the way a lit window is a house being
  //     awake, and it goes when the shutter comes down.
  // ⚠️ AND IT NEVER SPEAKS. The Quiet Rule: no bubble over any banana in this town, ever.
  const KIOSK = { drawn: 58, lean: 3, hFrac: 0.66, topFrac: 0.20 };   // the café's numbers, so the two are the same size
  let kiosker = null;
  function kioskOpen() {
    const p = PROPS && PROPS.info;
    if (!INFO_WIN || !p) return false;
    if (cond.shut.has('info') && !cond.fixedShut.has('info')) return false;   // the shutter is down
    if (hoardNow && hoardNow('info')) return false;                            // it is not built for you yet
    return life.beat() !== 5;                                                  // and everybody goes home at night
  }
  function kioskShow() {
    const want = kioskOpen();
    if (!want) { if (kiosker) { kiosker.remove(); kiosker = null; } return; }
    if (kiosker) return;
    const [cx, top, x0, y0, x1, y1] = INFO_WIN;
    const w = KIOSK.drawn / KIOSK.hFrac;   // the ELEMENT is taller than the banana: a hat lives in the headroom
    const floor = top + KIOSK.lean + KIOSK.drawn;
    const el = document.createElement('div');
    // ⚠️ ITS OWN CLASS, NOT `tw-atwork`. That class means THE PLAYER IS AT WORK HERE — the café's
    // walk counts it to prove a stranger is not standing in the serving window — and nobody works in
    // the kiosk at all (Trym: "you cant work in the kiosk"). Borrowing it made the café's own test
    // find a barista who was never hired, which is exactly what that assertion is for.
    el.className = 'tw-kiosker';
    const cv = document.createElement('canvas');
    cv.width = cv.height = 150;
    el.appendChild(cv);
    el.style.width = pct(w, W);
    el.style.left = pct(cx, W);
    el.style.top = pct(floor + (1 - KIOSK.topFrac - KIOSK.hFrac) * w, H);
    el.style.zIndex = String(100 + Math.round(PROPS.info.base) + 1);
    const l = cx - w / 2, t = floor - (KIOSK.topFrac + KIOSK.hFrac) * w;
    // ⚠️ CLAMPED AT ZERO. The recess is 110 world px across and the element is 88, so both side insets
    // come out NEGATIVE — and a negative inset is not "no clip", it is invalid, and the whole rule is
    // dropped by some engines and normalised to three values by others. Nothing needs clipping
    // sideways here; only the counter's edge and the sign above it do any cutting.
    const pc = (v) => (Math.max(0, v) / w * 100).toFixed(2) + '%';
    // inset(top right bottom left) against the element's own square box, in world px
    el.style.clipPath = 'inset(' + pc(y0 - t) + ' ' + pc(l + w - x1) + ' ' + pc(t + w - y1) + ' ' + pc(x0 - l) + ')';
    world.appendChild(el);
    kiosker = el;
    // ⚠️ drawn ONCE IT IS IN THE WORLD, because drawMe paints at the size the canvas is shown at
    const d = dayNum();
    const hats = ['none', 'buckethat', 'woolbeanie', 'backwardscap', 'tophat', 'snailhat'];
    try {
      drawMe(el.firstChild.getContext('2d'), 150, 2, {
        hat: hats[Math.floor(h(d, 41, 0) * hats.length)] || 'none',
        glasses: h(d, 42, 0) < 0.3 ? 'nerd' : 'none',
        extras: {}, top: '', bottom: '', bg: 'transparent', captions: false, effect: 'none',
      });
    } catch (e) { /* a partial outfit throws and would take every banana after it with it */ }
  }

  // ══════════════════════════════════ the condition ═══════════════════════════════════
  // the look of the band, seeded by the day: the same dark lamps for everyone today
  const cond = { lamps: {}, shut: new Set(), fountainDry: false, full: new Set(), crows: [], visitors: [], dayghost: null, fixedShut: new Set() };
  const propOf = (key) => PROPS[key] || null;
  // a crow on a perch paints OVER the prop it sits on (the fountain is a keyed animation, not an overlay)
  const perchZ = (key) => (propOf(key) ? propOf(key).base : 1000) + 2;   // ⚠️ the fountain's own case went with its perch (problems.js)
  const lampHalo = {};      // key → sprite (the halo over the lamp, lit at night)
  const fullSprites = {}, sideSprites = {};   // key → the full-state sprite over a bin or a dumpster, and what stands beside it
  let dryFountain = null;
  const shutSprites = {};
  // 🌑 WHAT THE SQUARE WEARS: the band, plus the mark a Curse Night left on it.
  // See NIGHT_AFTER in src/data/town/condition.js for why — in short, every band above 65 looks
  // identical, so the hardest night in the game used to change nothing you could see or fix.
  // ⚠️ SHARED, because it hangs off the clock's own curse time (L.curseAt, the room's word for when
  // the night was) rather than off anything this device decided. Everyone sees the same morning.
  // which night the square is still wearing, or '' — the identity apply() watches, because the mark
  // can come and go without the band moving an inch.
  function wornKind() {
    const at = +L.curseAt || 0;
    if (!at) return '';
    const since = Date.now() - at;
    if (!(since >= 0 && since < NIGHT_AFTER_MS)) return '';
    // ⚠️ THE ROOM'S WORD FIRST. It watched the night happen and says which tier it was; the clock is
    // the fallback for a room that has not been redeployed yet, and L.curse (what is happening NOW) is
    // the last resort — by the morning that is 'none', which is the whole reason the other two exist.
    let kind = L.curseKind || '';
    if (!NIGHT_AFTER[kind]) { try { kind = curseAt(at + 60000).type; } catch (e) { kind = ''; } }
    if (!NIGHT_AFTER[kind] && NIGHT_AFTER[L.curse]) kind = L.curse;
    return NIGHT_AFTER[kind] ? kind : '';
  }

  function wornLook() {
    const base = LOOK[band];
    const at = +L.curseAt || 0;
    if (!at) return base;
    const since = Date.now() - at;
    if (!(since >= 0 && since < NIGHT_AFTER_MS)) return base;
    // ⚠️ WHICH NIGHT IT WAS, asked of the CLOCK rather than carried on the wire. L.curse is what is
    // happening NOW ('none', by the morning); the tier of the night that left this mark is a pure
    // function of when it was, and the room and the page already agree about that function.
    const mark = NIGHT_AFTER[wornKind()] || null;
    if (!mark) return base;
    const cap = (n, m) => Math.min(m, n);
    return { ...base,
      lampsOut: cap(base.lampsOut + mark.lampsOut, ANCHORS.lamps.length),
      lampsFlicker: cap(base.lampsFlicker + mark.lampsFlicker, Math.max(0, ANCHORS.lamps.length - base.lampsOut - mark.lampsOut)),
      litter: cap(base.litter + mark.litter, 2),
      bins: cap(base.bins + mark.bins, ANCHORS.bins.length),
      dumps: cap(base.dumps + mark.dumps, ANCHORS.dumps.length),
      crows: base.crows + mark.crows };
  }

  function condition() {
    const look = wornLook(), d = dayNum();
    // lamps: which are out and which stutter, from the day seed
    const order = pickN(ANCHORS.lamps, ANCHORS.lamps.length, d * 7 + 1);
    ANCHORS.lamps.forEach((k) => { cond.lamps[k] = 'ok'; });
    order.slice(0, look.lampsOut).forEach((k) => { cond.lamps[k] = 'out'; });
    order.slice(look.lampsOut, look.lampsOut + look.lampsFlicker).forEach((k) => { cond.lamps[k] = 'flicker'; });
    // ⚠️ THE FIXES THIS DEVICE ALREADY MADE TODAY STILL HOLD — AND A SHUTTER IS ONE OF THEM. Only the
    // lamps were restored here, so a reload put the tape back on a front you had already opened while
    // isFixed() still said it was done, which means the forced "every shut front is one of your
    // problems" loop below SKIPPED it. A dark door with no way to open it, until UTC midnight rolled
    // the day — the exact state the comment down there forbids — and it kept Bean, Pip or Dot indoors
    // with it. Found by a verifier that was refuting a different claim.
    // ⚠️ REBUILT, not added to: fixed() is day-gated, so this also drops yesterday's opened fronts if
    // the page is left open across UTC midnight.
    cond.fixedShut = new Set();
    for (const id of fixed()) {
      const [t, k] = id.split(':');
      if (t === 'lamp' && cond.lamps[k]) cond.lamps[k] = 'ok';
      if (t === 'shutter') cond.fixedShut.add(k);
    }
    lamps();
    // windows: some homes stay dark in a low town
    life.setGlow((n) => h(d, 2, n.idx) >= look.windowsDark);
    // who stays in: the shut kiosks' keepers, Pip when the store is shut, and a seeded few
    cond.shut = new Set(look.shut);
    todayShut.forEach((k) => cond.shut.add(k));
    hoardings();   // ⚠️ BEFORE shutters(): the tape asks hoardNow() whether it may paint at all
    shutters();
    kioskShow();
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
    // ❌ THE DÉCOR LANTERNS ARE GONE, and the reason is a rule rather than a taste. A thriving town
    // hung four and then eight pulsing lanterns about the square at nightfall — scenery, nothing else.
    // Trym asked about them twice: first "the lantern that shows up as a pickup / cleaning-thing — not
    // sure why its there", then, once its sprite was fixed, "why is there lanterns showing up in the
    // middle of the way in nighttime, dont need those if they dont add any mechanics or gameplay." A
    // glowing, pulsing thing standing in the walkway is the town's own vocabulary for SOMETHING TO DO
    // (the chore halo, the restock invitation, the full bin), so pure decoration wearing that costume
    // lies to the player every night. The band still shows itself through the lamps, the shut fronts,
    // the fountain, the crows and who is standing about — all of which mean something.
    kill(cond.dayghost); cond.dayghost = null;
    // ⚠️ A WISP BY DAYLIGHT. This is the one call that makes the night's chunk a DAY dependency, and
    // it is why loadDusk() is not gated on the clock: a low band draws one at noon.
    if (look.dayghost || todayHas('dayghost')) loadDusk().then((d) => { if (d && (look.dayghost || todayHas('dayghost'))) cond.dayghost = d.ghostOf('wisp'); });
  }
  const keepFn = (n, beat) => {
    if (beat === 5) return false;
    if (curse && curse !== 'hush') return true;
    if (n.key === 'pip' && (!SHELF[band] || (cond.shut.has('store') && !cond.fixedShut.has('store')))) return true;
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
    // 🌙 nobody stands about at night: the visitors and the travelling stall are gone until morning, like the residents
    // indoors (Trym, 15 Sep: "aren't the townsbananas supposed to go inside in the night?" — they were; these were not)
    const nightOut = beat === 5 || (curse && curse !== 'hush');
    for (const b of cond.visitors) b.el.hidden = nightOut;
    if (merchant) merchant.el.hidden = nightOut;
  }
  const SHUT_STILL = { cafe: ['shutcafe', 1, 3], info: ['shutinfo', 0, 43] };   // key → [still, dx, lift]; a front with no entry wears only the tape
  function shutters() {
    for (const k of CLOSABLE) {
      const want = cond.shut.has(k) && !cond.fixedShut.has(k) && !hoardNow(k);   // your lock wins the display
      const on = !!shutSprites[k] || shutNoStill.has(k);
      if (want && !on) {
        const p = propOf(k); if (!p) continue;
        // the two kiosks have a shutter still in the pack; a shopfront that has none is closed by the
        // dark front, the tape and the red sign alone — which is why SHUT_STILL may have no entry
        const st = SHUT_STILL[k];
        if (st) shutSprites[k] = sprite(st[0], p.x + p.w / 2 + st[1], p.base - st[2], { z: p.base + 1, cls: 'is-shut' });   // measured on the plate
        else shutNoStill.add(k);
        p.el.classList.add('is-dark');   // 🌑 a shut front goes dark and grey, like a dead lamp, so open and shut read from across the square (Trym, 15 Sep)
        barricade(k, p);
        if (shutSprites[k] && problems.some((q) => q.type === 'shutter' && q.key === k)) shutSprites[k].el.classList.add('is-todo');
      } else if (!want && on) {
        kill(shutSprites[k]); shutSprites[k] = null; shutNoStill.delete(k);
        const p = propOf(k); if (p) p.el.classList.remove('is-dark');
        unbarricade(k);
      }
    }
  }
  // 🚧 a shut kiosk is TAPED OFF: hazard tape across its front from both sides, and a little red sign on the window
  // with the one approved word (Trym, 15 Sep: "under construction tape across the building from both sides and a tiny
  // red square sign on the window saying closed"). The tape and the sign are drawn, not pack art: there is no tape in the pack.
  const tapes = {};
  const shutNoStill = new Set();   // fronts wearing the tape with no shutter sprite of their own
  function barricade(k, p) {
    if (tapes[k]) return;
    const els = [];
    // a BELT round the bottom of the building: two bands strung across the front near the ground, each tilted a
    // little the other way so they cross slightly (Trym, 15 Sep: "not wide crosses … more like a belt at the bottom")
    const hh = p.h || (p.base - (p.y != null ? p.y : p.base - 200)), w = p.w, cx = p.x + w / 2, len = w * 1.12;
    for (const sgn of [1, -1]) {
      const cy = p.base - hh * (sgn > 0 ? 0.25 : 0.18);
      const t = document.createElement('i'); t.className = 'tw-tape';
      t.style.left = pct(cx - len / 2, W); t.style.top = pct(cy - 5, H); t.style.width = pct(len, W); t.style.height = pct(10, H);
      t.style.transform = 'rotate(' + (sgn * 6) + 'deg)'; t.style.zIndex = String(100 + p.base + 2);
      world.appendChild(t); els.push(t);
    }
    if (COPY.shutSign) {
      const sgn = document.createElement('b'); sgn.className = 'tw-shutsign'; sgn.textContent = COPY.shutSign;
      sgn.style.left = pct(cx, W); sgn.style.top = pct(p.base - hh * 0.34, H); sgn.style.zIndex = String(100 + p.base + 3);
      world.appendChild(sgn); els.push(sgn);
    }
    tapes[k] = els;
  }
  function unbarricade(k) { (tapes[k] || []).forEach((e) => e.remove()); tapes[k] = null; }
  // 🎬 a shutter goes UP: the pack's roll played backwards, then the kiosk is open
  function rollUp(k) {
    const still = shutSprites[k]; if (!still) { shutters(); return; }
    const p = propOf(k); const key = k === 'cafe' ? 'rollcafe' : 'rollinfo';
    if (!STATE[key] || !p) { shutters(); return; }
    const s = sprite(key, still.x, still.y, { z: p.base + 1, fps: 22, mode: 'once' });
    kill(still); shutSprites[k] = null; { const p0 = propOf(k); if (p0) p0.el.classList.remove('is-dark'); } unbarricade(k);   // open again: lit and coloured
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
    workStop();   // a job in hand cannot outlive the list it belongs to
    problems.forEach((p) => { if (p.el) p.el.remove(); kill(p.sprite); });
    problems = [];
    // 🌑 the night's mark counts here too — a dark lamp it left is one of your problems like any
    // other, which is the whole point: the morning after a Curse Night has WORK in it.
    const look = wornLook(), d = dayNum(), who = parseInt(me().slice(0, 6), 16) || 7;
    const seed = who % 100000 + d * 31 + BANDS.indexOf(band) + waveNum() * 7919;   // the wave moves the draw on
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
      // ⚠️ shutNow, NEVER cond.shut RAW. cond.shut is the town's lock; shutNow is what a player can
      // actually see and act on, and it is the one that also asks whether YOUR lock has boarded the
      // front. Reading the raw set here handed out a shutter to raise on a building behind a worksite
      // fence — a job you cannot do, because tapping the front opens the signpost instead. The forced
      // pass below has always guarded this; the weighted draw did not, so the bug only appeared on the
      // days the draw happened to pick that shutter, and it showed up as a flaky walk rather than a bug.
      else if (t.on === 'shops') [...cond.shut].filter(shutNow).forEach((k) => { const p = propOf(k); if (p) cands.push({ t, key: k, x: p.x + p.w / 2, y: p.base + 6 }); });
      else if (t.on === 'bins' || t.on === 'dumps') ANCHORS[t.on].filter((k) => cond.full.has(k)).forEach((k) => { const p = propOf(k); if (p) cands.push({ t, key: k, x: p.x + p.w / 2, y: p.base + 4 }); });
      else if (t.on === 'fountain') { if (look.fountain === 'dry') cands.push({ t, key: 'fountain', x: 1100, y: 920 }); }
    }
    const n = PROBLEM_OPEN;
    // ⚠️ a kiosk shut by TODAY is always one of your problems, whatever the count: a closed
    // door with no way to open it is the one thing the design forbids
    // …and it is every SHUT front, not only the one today's event shut: a band that closes the store
    // must hand you the shutter to raise (19 Sep)
    for (const k of [...cond.shut]) {
      if (cond.fixedShut.has(k) || hoardNow(k)) continue;   // a front you cannot act on owes you no problem
      const c = cands.find((q) => q.t.on === 'shops' && q.key === k);
      if (!c || isFixed(c.t.id + ':' + k)) continue;
      cands.splice(cands.indexOf(c), 1);
      const p = { id: c.t.id + ':' + k, type: c.t.id, x: c.x, y: c.y, key: k, pays: c.t.pays, rep: c.t.rep, el: mark(c.x, c.y), sprite: null };
      problems.push(p); glowProblem(p);   // its shutter glows like every other small thing (it never did until 15 Sep)
    }
    // 💡 every dark or stuttering lamp is ALWAYS one of your problems, whatever the count: a lamp the square shows
    // dark with no way to light it is the closed-door rule again (Trym, 18 Sep: "i see a broken streetlight in the
    // square board, but i dont see any options to fix it … no fix icon on any streetlight")
    for (const c of cands.filter((q) => q.t.on === 'lamps')) {
      cands.splice(cands.indexOf(c), 1);
      const id = c.t.id + ':' + c.key; if (isFixed(id)) continue;
      const pb = propOf(c.key) ? propOf(c.key).base : null;
      problems.push({ id, type: c.t.id, x: c.x, y: c.y, key: c.key, pays: c.t.pays, rep: c.t.rep, el: mark(c.x, c.y, LAMP_HIT.lift, pb != null ? 100 + pb + 3 : null, true), sprite: null, foot: c.y,
        grab: LAMP_HIT.grab, tall: LAMP_HIT.tall });   // ⬆ the icon used to ride at -150, clear of the lamp's own top, so it read as
        // belonging to whatever stood behind it (a phone box, in Trym's square). At -118 it sits ON the
        // lantern, and the box reaches from the icon down to the foot: the whole lamp answers a tap.
    }
    // ⚠️ COUNT WHAT IS PLACED, NOT WHAT IS DRAWN (19 Sep). A draw that lands on something you already
    // fixed today is skipped — and it used to spend one of the six anyway, so the more you did the
    // less the next wave handed you. The loop now keeps drawing until six are actually standing.
    for (let i = 0, placed = 0; placed < n && cands.length; i++) {
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
      if (p.type === 'litter') p.sprite = sprite(LITTER_ART[Math.floor(h(seed, i, 8) * LITTER_ART.length)], p.x, p.y);
      else if (p.type === 'graffiti') p.sprite = sprite(h(seed, i, 2) < 0.5 ? 'graffiti1' : 'graffiti2', p.x, p.y, { z: (propOf(p.key) || { base: p.y }).base + 1 });
      else if (p.type === 'crows') p.sprite = sprite('crow', p.x, p.y, { fps: 2, z: perchZ(p.key) });
      else if (p.type === 'leaves') { const s = sprite('leaf', p.x, p.y); if (s) { s.el.firstChild.src = '/assets/park/l-leaf' + (1 + (i % 2)) + '.png'; p.sprite = s; } }
      problems.push(p); placed++;
      glowProblem(p);
    }
  }
  // a subtle glow on the thing itself — its own sprite, or the shared state sprite it sits on
  function glowProblem(p) {
    const g = p.sprite || (p.type === 'bin' || p.type === 'dumpster' ? fullSprites[p.key] : p.type === 'fountain' ? dryFountain : p.type === 'shutter' ? shutSprites[p.key] : null);
    if (g && g.el) g.el.classList.add('is-todo');
    p.glow = g || null;   // kept so the walk can ask which problem has no glow
  }
  async function fix(id) {
    if (String(id).indexOf('cab:') === 0) { cabinetFixed(String(id).slice(4)); return true; }   // 🕹 a dark cabinet woken (the arcade's week)
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
    if (L.cap && L.cap.used < L.cap.max) { L.life = Math.min(100, L.life + 2); L.cap.used += 1; paintMeter(); }   // 2 = worker-rave TOWN_FIX
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
  // 📦 THE RESTOCK CHORE pays in the ROOM, never in coins (docs/town-jobs-plan.md §3): a face you
  // filled is on the shelf in front of you and on the till ten steps away, and that is the whole
  // wage. One device-local number per day, so tomorrow the shop is the town's again.
  const RESTOCK = 'tw-restock-v1';
  const STAFF_FACES = 2;   // 📦 the faces the day's delivery always leaves for the store's own staff
  function restocked() {
    try { const r = JSON.parse(localStorage.getItem(RESTOCK) || 'null'); return r && r.d === dayNum() ? (r.n | 0) : 0; } catch (e) { return 0; }
  }
  function restockAdd() {
    const n = restocked() + 1;
    try { localStorage.setItem(RESTOCK, JSON.stringify({ d: dayNum(), n })); } catch (e) {}
    if (ctx.chore) ctx.chore('restock');   // 💼 a crate to the till is the store's week's work (docs/town-jobs-plan.md §12)
    return n;
  }
  function shelfFor() {
    const s = SHELF[band]; if (!s) return null;
    const d = dayNum(), out = [];
    for (const [tier, n] of Object.entries(s)) pickN(POOLS[tier].filter((id) => DEX[id]), n, SALT_SHELF + d * 13 + tier.length).forEach((id) => out.push(id));
    // 📦 THE DAY'S DELIVERY IS THE STAFF'S (22 Sep 2026, the jobs audit). The band fills 3, 5, 6 or 7 of the seven
    // faces by itself, so a THRIVING town left no bare face and the restock duty could not be done at all — the
    // store paid at most half its rate in exactly the town it is the reward for. On its own staff's screen the
    // band's picks now leave two faces for them every day (the shelf is drawn per device: nobody else's changes).
    const j = ctx.job && ctx.job();
    if (j && j.at === 'store' && STORE && STORE.full && out.length > STORE.full.length - STAFF_FACES && callIn('store', 'restock')) out.length = Math.max(0, STORE.full.length - STAFF_FACES);   // 📟 once the day's delivery call is in
    // ⭐ and the rows YOU put out today, drawn from the same pools with a different salt so they are
    // never the band's own picks twice. This is why the till has the row on it before you leave.
    const mine = restocked();
    if (mine) pickN(POOLS.basic.filter((id) => DEX[id] && !out.includes(id)), mine, SALT_SHELF + d * 7 + 3).forEach((id) => out.push(id));
    return out;
  }
  // 📦 THE CARDS ARE A CHUNK (19 Sep 2026, Trym: "optimize and chunk things if needed for performance").
  // Pip's shelf, the travelling stall, the night vendor and the notice board are six kilobytes of
  // markup-building that nothing on the walk-around path ever touches — and this file had 2.2 KB left of
  // its 56 000. They live in ./town-shop.js now. It arrives on the first card, or a beat after the square
  // settles, whichever comes first, so a tap is almost never the thing waiting.
  //
  // ⚠️ FOUR OF THESE ARE GETTERS AND THAT IS NOT DECORATION. `L`, `band`, `problems` and `curse` are all
  // REASSIGNED here — a whole new `L` arrives from the room on every poll — so a value passed once would
  // freeze the notice board at whatever the town was when the chunk loaded. `cond` is the opposite case:
  // a const object mutated in place, so the reference holds.
  // which spots in the baked plate are crates to lift and which are faces to fill
  const CRATES = ['cr1', 'cr2'];
  const SHELVES = ['sh1', 'sh2', 'sh3', 'sh4', 'sh5', 'tbl1', 'tbl2'];
  // the first face with nothing on it, or -1 when the shop is as full as the plate allows
  const bareShelf = () => { const n = (shelfFor() || []).length; return n < (STORE && STORE.full ? STORE.full.length : 0) ? n : -1; };
  // ⭐ and WHICH face that is, because a crate lands on the next bare one or nowhere: putting it down
  // on a shelf that already has goods on it would fill a different shelf across the room.
  const bareKey = () => { const i = bareShelf(); return i < 0 ? '' : STORE.full[i][0]; };

  let shop = null, shopP = null;
  function shopCtx() {
    return { COPY, W_BAND, W_OBJ, DEX, BANDS, ANCHORS, MERCHANT, CURSE_SHELF, OBJECTS, BOUNTY, SALT_SHELF,
      cond, propOf, pickN, one, fill, found, omenNow, shelfFor,
      band: () => band, life: () => L, problems: () => problems, curse: () => curse,
      openCard, closeCard, cardBody, card, esc, say, hud, track, enterRoom: ctx.enterRoom };
  }
  function loadShop() {
    if (!shopP) {
      shopP = import('./town-shop.js')
        .then((m) => { shop = m.bootTownShop(shopCtx()); return shop; })
        .catch((e) => { shopP = null; console.warn('[town] the shop did not load', e); return null; });
    }
    return shopP;
  }
  // ⚠️ A CARD MUST NEVER SILENTLY DO NOTHING. On the rare tap that beats the chunk, the frame opens on
  // the same beat as the tap and fills the moment it lands — and only if it is still the card on screen.
  const shopSeam = (name) => (shop ? Promise.resolve(shop[name]()) : loadShop().then((s) => !!(s && s[name]())));
  function shopCard(name) {
    if (shop) return shop[name]();
    openCard('');
    loadShop().then((s) => { if (panel.hidden) return; if (s) s[name](); else closeCard(); });   // a chunk that never came closes its own frame rather than leaving a blank card
    return true;
  }
  setTimeout(loadShop, 1200);   // the square is walking by now; nothing is waiting on this

  // 🚶 THE TOWN'S VISITORS — bananas from the rest of Banana Town, wandering into the square from
  // the roads that leave the map. Its own chunk, loaded a beat after the square settles the way the
  // shop's is: nobody waits on it, and a visitor who arrives a second late is a visitor.
  let folk = null, folkP = null;
  function loadFolk() {
    if (!folkP) {
      folkP = import('./town-folk.js')
        .then((m) => { folk = m.bootTownFolk({ world, W, H, pct, PROPS, drawMe, inside, band: () => band, nightOut: () => life.beat() === 5 || (curse && curse !== 'hush') }); return folk; })
        .catch((e) => { folkP = null; console.warn('[town] the visitors did not come', e); return null; });
    }
    return folkP;
  }
  setTimeout(loadFolk, 1600);

  // ☕ THE COFFEE CUP'S COUNTER — its own chunk, loaded the first time somebody who works there taps
  // the kiosk. ⚠️ NOT town-work.js: that one is imported for every visitor to the square, so the
  // counter's weight would be downloaded by a banana who only ever restocks Pip's shelves.
  let cafe = null, cafeP = null;
  function cafeCtx(at = 'cafe') {
    return { world, view, W, H, pct, PROPS, CAFE_WIN, drawMe, say, track, float,
      outfit: ctx.outfit || (() => ({})),
      folk: () => folk,   // ☕ the counter borrows its customers from the town's own visitors
      pos: ctx.pos,   // ☕ the counter mark is a DISTANCE: step off it and the tray folds
      inside,   // ☕ walking into a shop is walking away from the counter
      shutHere: () => shutNow('cafe') || hoardNow('cafe'),   // ☕ a front that closes under a running shift
      openCard, closeCard, esc, hud,
      // ⭐ THE TILL lives in town-cafe.js since 23 Sep 2026 (the rank's tips cap); the counter reads the job mirror for
      // the rank and hands the shift's cups to the week's sheet as one chore
      job: ctx.job, chore: ctx.chore,
      // ⚠️ GETTERS, not values: this file reassigns every one of them
      band: () => band, life: () => L, problems: () => problems, curse: () => curse };
  }
  function loadCafe() {
    if (!cafeP) {
      cafeP = import('./town-cafe.js')
        .then((m) => { cafe = m.bootTownCafe(cafeCtx()); return cafe; })
        .catch((e) => { cafeP = null; console.warn('[town] the counter did not load', e); return null; });
    }
    return cafeP;
  }
  // 🍋 THE LEMONADE STAND — the café's counter engine with Fig Jr.'s deck on it (22 Sep 2026): its own chunk, loaded the
  // first time somebody taps the stand. The stand never shuts (it is not a front), and it has the town's own
  // target so a step round the back of the table can take the banana's walk with it.
  let lemon = null, lemonP = null;
  function loadLemon() {
    if (!lemonP) {
      lemonP = import('./town-lemon.js')
        .then((m) => { lemon = m.bootTownLemon({ ...cafeCtx('stand'), tgt: ctx.tgt, shutHere: () => false }); return lemon; })
        .catch((e) => { lemonP = null; console.warn('[town] the stand did not load', e); return null; });
    }
    return lemonP;
  }


  // ═══════════════════════ 🚧 YOUR LOCK: a building the story has not opened ═══════════════
  // The town's lock is the tape; this is the other one (src/data/town/locks.js has the whole rule).
  // ⚠️ SHIPPED OFF: HOARD_ON is false until chapter 2 exists to open these fronts AND somebody has
  // read how many players finish chapter 1. Flipping it before then boards up the store, the post
  // office and the café for everyone who never finished — the one outcome the plan forbids.
  let qaOpen = null, qaHoard = null;   // the walk's door: which fronts count as opened, and whether the lock is on at all
  function openedSet() {
    if (qaOpen) return qaOpen;
    try { const q = JSON.parse(localStorage.getItem('bwq-c2') || 'null'); return new Set((q && q.open) || []); } catch (e) { return new Set(); }
  }
  const hoardNow = (key) => (qaHoard == null ? HOARD_ON : qaHoard) && HOARDABLE.includes(key) && !!HOARD[key] && !openedSet().has(key);
  const hoards = {};
  function hoardings() {
    for (const k of HOARDABLE) {
      const want = hoardNow(k), h = HOARD[k];
      if (want && !hoards[k] && h) {
        const f = sprite(h.art, h.cx, h.base, { z: h.base + 2 });
        const at = SIGN_AT[k] || [0, 0];
        const g = sprite('hoardsign', h.cx + at[0], h.base + at[1], { z: h.base + 3 });
        hoards[k] = { f, g, x: h.cx + at[0], y: h.base + at[1] };
        const p = propOf(k); if (p) p.el.classList.add('is-hoard');
      } else if (!want && hoards[k]) {
        kill(hoards[k].f); kill(hoards[k].g); hoards[k] = null;
        const p = propOf(k); if (p) p.el.classList.remove('is-hoard');
      }
    }
  }
  // ⭐ PRECEDENCE: YOUR LOCK WINS THE DISPLAY. A front can be hoarded and health-shut at once, and
  // the town's mood there is irrelevant to a player who could not use it either way — so a hoarded
  // front never wears the tape and never hands out a shutter to fix. One building, one state, and
  // always the one whose action is available to you now.
  const shutNow = (key) => !hoardNow(key) && CLOSABLE.includes(key) && cond.shut.has(key) && !cond.fixedShut.has(key);
  // 🚧 what a signpost says: what this will be, that the STORY opens it, and HOW FAR ALONG YOU
  // ARE. Trym, 19 Sep: "the buildings must show clear visual indications on what you are missing".
  // A sign that only says no is a dead end; the third line is what makes it a hook.
  function lockCard(key) {
    const w = COPY.locks || {};
    const done = SIGNATURES.filter((k) => openedSet().has(k)).length;
    openCard('<div class="tw-lock">'
      + (w[key] ? '<p class="tw-lock__is">' + esc(fill(w[key])) + '</p>' : '')
      + (w.story ? '<p class="tw-card__sub">' + esc(fill(w.story)) + '</p>' : '')
      + (w.step ? '<p class="tw-lock__step">' + esc(fill(w.step).replace('{n}', done).replace('{of}', SIGNATURES.length)) + '</p>' : '')
      + '</div>');
    track('town_locked', { key });
    return true;
  }
  function openFor(key) {
    // 🚪 A SHUT DOOR SAYS WHY, and there are two whys (19 Sep). Today's event is a one-day fault with
    // a name — a bolt, a split hose — and somebody will see to it. The BAND is the other thing: the
    // town is too low to keep its fronts open at all, and the only line that helps says the square is
    // the reason and hands are what bring it back (Trym: "it must be well explained").
    if (shutNow(key)) {
      const day = todayShut.has(key);
      // ⚠️ THE REASON BELONGS TO THE FRONT, not to the day. This indexed one flat deck by
      // dayNum() + key.length, so the line naming the coffee propeller could hang on the general store
      // and the one naming the ARCADE FLOOR could hang on a front the arcade is forbidden to have — and
      // 'cafe' and 'info' are both four characters, so those two printed the SAME reason on the same
      // day. Measured hit rate: about one in eighteen. COPY.closed is a map keyed by front now; the
      // band's own lowShut stays one deck because being too poor to open is not any one building's
      // fault (its brief says so).
      const deck = day ? (COPY.closed || {})[key] : COPY.lowShut;
      const line = one(deck, dayNum() + key.length);
      if (line) say(fill(line));
      return !!line;
    }
    // 🚧 a hoarded front answers with YOUR lock, before anything else can answer with the town's
    if (hoardNow(key)) return lockCard(key);
    // ☕ THE COUNTER. Bean hires you on their own card; this is turning up. ⭐ the deed waits for the
    // walk (ctx.then) like every reachable thing in this town, and it returns TRUTHY either way — a
    // falsy answer here lets banana-town toast ABOUT.cafe ("Not built yet.") straight over the shift.
    if (key === 'cafe') {
      const mine = ctx.job && ctx.job();
      if (!mine || mine.at !== 'cafe') {
        // ⚠️ AND A STRANGER GETS THE CAFÉ'S OWN LINE, not the world's fallback. This returned false, and
        // banana-town then toasted ABOUT.cafe — which ended "Not built yet." on the building carrying the
        // biggest thing in the release, with Bean standing outside it and a queue at its rope. Four of the
        // six critics found the same sentence. The line comes from the rig (town-cafe.json `front`) and it
        // lives in the café's own lazy chunk, so a tap on the kiosk is what fetches it — which is exactly
        // the tap that wants it. Truthy either way: the fallback must not speak over this.
        loadCafe().then((c) => { const t = c && c.front && c.front(); if (t) say(t); });
        return true;
      }
      ctx.then(() => { loadCafe().then((c) => { if (c) (c.on() ? c.clockOut() : c.clockIn(view)); }); });
      return true;
    }
    // 🍋 THE STAND: Fig Jr. hires on his own card; a tap here is turning up, and the deed waits for the walk
    if (key === 'stand') {
      const mine = ctx.job && ctx.job();
      if (!mine || mine.at !== 'stand') { loadLemon().then((l) => { const t = l && l.front && l.front(); if (t) say(t); }); return true; }
      ctx.then(() => { loadLemon().then((l) => { if (l) (l.on() ? l.clockOut() : l.clockIn(view)); }); });
      return true;
    }
    // 📦 THE RESTOCK, and it only exists for somebody who works here. ⚠️ it answers BEFORE the till
    // so that a tap on a shelf while you are holding a crate puts the crate down rather than opening a
    // card over your own hands. ⭐ and it only ANSWERS here — the deed waits until the banana has walked
    // to the thing (ctx.then), because a crate that appears over your head from across the room reads
    // as a bug, and the slow walk between the stack and the shelf IS the chore.
    if (roomAt === 'store' && (CRATES.includes(key) || SHELVES.includes(key))) {
      const mine = ctx.job && ctx.job();
      if (!mine || mine.at !== 'store') return false;   // not your shop: the spot is scenery
      if (!carry && !CRATES.includes(key)) return false;   // a shelf with empty hands is just a shelf
      if (carry && key !== bareKey()) return false;         // and with full hands, only the bare face answers
      ctx.then(() => chore(key));
      return true;
    }
    if (key === 'store' || key === 'till') return shopCard('store');   // 🏪 the counter inside (a tap on the front walks you in since 23 Sep 2026: banana-town.js openFor)
    return false;
  }

  // ════════════════════════════════════ today ════════════════════════════════════════
  let today = [], parked = null, todayPin = TEST ? [] : null, todayFront = null;   // ?towntest walks a PLAIN day unless the walk pins its own (room.today([...])): the date's own draw made the walks date-flaky (22 Sep: the day's closed event shut the store)
  const todayShut = new Set();
  // the day's picks, for any day: today's, or tomorrow's for the parked cart
  function picksFor(d) {
    const n = TODAY_N[band] || 2, left = TODAY.filter((t) => (t.w[band] || 0) > 0), out = [];
    for (let i = 0; i < n && left.length; i++) { const r = weighted(left, (t) => t.w[band], d * 11 + i * 5 + 3); out.push(r.id); left.splice(left.indexOf(r), 1); }
    return out;
  }
  const todayHas = (id) => today.includes(id);
  let oddKey = null;
  // ☕ THE OWNER STEPS OFF HIS OWN PITCH WHILE YOU WORK IT (Trym, 20 Sep). Bean's whole day is spent at
  // the café, which is exactly where the player now stands too — so while a shift runs he takes his own
  // terrace and leaves the counter to you. It is a REFRESH, so he walks there rather than blinking out.
  // ⚠️ COMPOSED, never replaced: setOverride has one slot and the day's `oddspot` event already owns it,
  // so assigning a café-only function here would silently delete that event for the day.
  let shiftOn = false;
  let standOn = false;   // 🍋 the lemonade stand's shift, polled like the café's
  let workingWas = '';   // 🧍 which workplace of yours was being worked at the last poll
  // 🕯 …and the chapter's claim on Nib comes first (21 Sep 2026): at the fountain while chapter one's
  // first scene is open — whatever the hour, so `always` — then up to the town hall for the rest of
  // the beat it closed in, so "he walks up to his regular place" is what you see, not a lunch break.
  let nibSt = ctx.nibStation ? ctx.nibStation() : null, nibHallBeat = -1;
  const overrideFor = (n2, beat) => {
    if (n2.key === 'nib') {
      if (nibSt) return { place: nibSt, always: true };
      if (nibHallBeat === beat && beat !== 5) return { place: 'hall', always: true };   // insists: never kept in on the walk up
    }
    // 🧍 A BOSS STEPS ASIDE WHILE YOU WORK THEIR PLACE (Trym, 22 Sep: "their default position while you work at their
    // workplace should be a bit away from the workplace so they dont distort the queue that lines up or is in the way
    // visually"): Bean to the terrace, Fig Jr. to the phone box, Stamp to the monument lane, Pip to the bank's step,
    // Spinner to the fruit cart — for as long as the shift, the round, or your time in their room lasts. They still
    // potter about their aside as they would about any station; only the station moved.
    const wa = workingAt();
    if (wa && n2.key === ASIDE_BOSS[wa] && beat !== 5) return ASIDE[n2.key];
    return oddKey && n2.key === oddKey && ODD_SPOTS[oddKey][1] === beat ? ODD_SPOTS[oddKey][0] : null;
  };
  const ASIDE = { bean: 'terrace', figjr: 'booth', stamp: 'monument', pip: 'bank', spinner: 'cart' };
  const ASIDE_BOSS = { cafe: 'bean', stand: 'figjr', post: 'stamp', store: 'pip', condo: 'spinner' };
  // which workplace of yours is being worked right now: a counter's shift, the post office's round, or your own boss's room
  const workingAt = () => {
    if (shiftOn) return 'cafe';
    if (standOn) return 'stand';
    if (ctx.sortOn && ctx.sortOn()) return 'post';
    const mine = ctx.job && ctx.job();
    return roomAt && mine && mine.at === roomAt ? roomAt : '';
  };
  function todayStage() {
    const d = dayNum();
    today = todayPin || picksFor(d);
    todayShut.clear();
    if (todayHas('closed')) todayShut.add(todayFront || CLOSABLE[Math.floor(h(d, 21) * CLOSABLE.length)]);   // a walk may name the front
    cond.shut = new Set([...LOOK[band].shut, ...todayShut]);
    shutters();
    // the odd spot: one resident, one beat, somewhere they never stand
    oddKey = todayHas('oddspot') ? Object.keys(ODD_SPOTS)[Math.floor(h(d, 22) * 9)] : null;
    life.setOverride(overrideFor);
    // the merchant
    killBody(merchant); merchant = null;
    if (todayHas('merchant') && MERCHANT.bands.includes(band)) { merchant = body(MERCHANT.at[0], MERCHANT.at[1], { hat: 'cowboy', glasses: 'shades', extras: { backpack: true } }); bodies.add(merchant); }
    // 🧳 and if the stall comes TOMORROW, its cart is parked at the bus stop today — a promise a
    // player can see and come back for (a sign, not a timetable)
    kill(parked); parked = null;
    if (!merchant && MERCHANT.bands.includes(band) && picksFor(d + 1).includes('merchant')) parked = sprite('cartp', 1990, 296, { z: 296 });
    // a strange object by daylight
  }

  // ════════════════════════════════ the curse, the ghosts, the objects ═══════════════
  let curse = null, forced = null, forcedUntil = 0, curseTold = '', plainNight = false;
  let night = null;   // the sky; the candles went with the night's own chunk
  function moveSprite(s, x, y, dz = 0) { s.x = x; s.y = y; s.el.style.left = pct(x - s.w / 2, W); s.el.style.top = pct(y - s.h, H); s.el.style.zIndex = String(100 + Math.round(y + dz)); }
  const found = (id) => { try { return statTotal(passRaw(), 'cur_' + id) > 0; } catch (e) { return false; } };
  // 🌚 THE NIGHT LIVES IN ITS OWN CHUNK (src/scripts/town-night.js): ghosts, cursed objects and
  // the Curse Nights, 21 KB of this file until 20 Sep, when it had 1 188 bytes of its cap left.
  //
  // ⚠️ THE GATE IS NOT SIMPLY "IS IT DARK". condition() asks for a wisp in DAYLIGHT when the band is
  // low enough to draw one, so the chunk is pulled the moment the evening beat arrives, a Curse Night
  // is on, an omen is up, or the day wants its ghost — and every call site below tolerates the beat
  // or two before it lands, because a town that throws while the import is in flight is a dead town.
  let dusk = null, duskP = null;
  function duskCtx() {
    // ⚠️ `pos` is the PLAYER'S OWN position object, handed over by reference because banana-town
    // mutates it in place every frame — the ghosts keep their distance from whoever is standing
    // there, and six lines of the moved code still say ctx.pos.
    return { pos: ctx.pos, todayShut, DEX, W_OBJ, ANCHORS, W, H, pct, view, world, cond, life, weather, say, track, LAMP_HIT, litterRoom,
      poof, burst, mark, sprite, show, kill, moveSprite, body, bodies, killBody, propOf, perchZ,
      glowProblem, setFull, lampsByHour, shutters, dayNum, found, weighted, h, one, fill, keepFn,
      // ⚠️ GETTERS, because this file reassigns every one of them
      band: () => band, problems: () => problems, curse: () => curse, vendor: () => vendor,
      night: () => night, plainNight: () => plainNight, curseTold: () => curseTold,
      // 👻 what a ghost's mischief costs the town, and the float that shows it where it happens
      dark, float,
      hauntLine: () => ((COPY.toasts || {}).haunt || ''),   // 👻 what the square says as a haunted night falls
      // …and setters, because a getter cannot stand on the left of an assignment
      setCurse: (v) => { curse = v; }, setVendor: (v) => { vendor = v; },
      setPlainNight: (v) => { plainNight = v; }, setCurseTold: (v) => { curseTold = v; } };
  }
  function loadDusk() {
    if (!duskP) {
      duskP = import('./town-night.js')
        .then((m) => { dusk = m.bootTownNight(duskCtx()); return dusk; })
        .catch((e) => { duskP = null; console.warn('[town] the night did not fall', e); return null; });
    }
    return duskP;
  }
  const NO_NIGHT = [];
  const objectsNow = () => (dusk ? dusk.objects() : NO_NIGHT);
  const ghostsNow = () => (dusk ? dusk.ghosts() : NO_NIGHT);

  const OMEN_MS = 3 * 3600000;
  function omenNow() {
    if (forced) return forced === 'omen' ? { type: 'deep' } : null;   // a chapter, or the QA seam, can call the omen up
    const d = Math.floor(Date.now() / CURSE_DAY_MS), t = Date.now();
    for (const e of curseDay(d)) { if (e.type === 'hush') continue; const at = d * CURSE_DAY_MS + e.at; if (t >= at - OMEN_MS && t < at) return { at, type: e.type }; }
    return null;
  }
  function curseNow() {
    if (forced && Date.now() < forcedUntil) return forced === 'omen' ? 'none' : forced;   // a chapter's own night — or 'none', a chapter's own calm
    if (forced) forced = null;
    const c = curseAt(Date.now()).type;
    return c !== 'none' ? c : townHauntAt(Date.now()) ? 'haunt' : 'none';   // 👻 one town night in ten is haunted (23 Sep 2026)
  }

  // ═══════════════════════════════════ the sky, the tick ═════════════════════════════
  night = document.createElement('i'); night.className = 'tw-night'; view.appendChild(night);
  let lastBeat = -1, secAt = 0;
  // 🚶 WALK-OVER: everything but a lamp is picked up or fixed by walking onto it (or up to it, for a thing you
  // cannot stand on) — a lamp is a repair, and a repair is a tap (Trym, 15 Sep: "it became tedious to tap on all
  // objects. streetlights can be tapped"). The reach is measured from the thing's foot; the tap's own walk
  // ends 26 px in front of it, so every reach covers that spot too.
  // 🗑 HOW CLOSE TWO PIECES OF RUBBISH MAY LIE (Trym, 20 Sep 2026): "always one garbage bag by
  // itself … but only one garbage bags-sprite at once each town location … small litter can overlap some
  // no worries, but total overlap cant happen."
  //
  // ⚠️ TWO DIFFERENT NUMBERS, because they are two different things. A bin bag is a 65 px heap and the
  // eye reads it as ONE object, so two of them on the same patch read as a rendering fault rather than
  // as a mess — they keep a whole body's length apart. A crisp packet is small and a few of them lying
  // together IS what litter looks like, so they only have to be distinguishable from each other.
  const LITTER_GAP = { pile: 118, small: 26 };

  const isBag = (k) => k === 'pile';
  // true = this spot is clear enough to drop `kind` on. Reads the live problem list, so it holds across
  // the seeded street litter and whatever a ghost throws down in the night.
  function litterRoom(x, y, kind) {
    for (const q of problems) {
      if (q.type !== 'litter' && q.type !== 'leaves') continue;
      const other = q.sprite && q.sprite.key;
      const gap = (isBag(kind) && isBag(other)) ? LITTER_GAP.pile : LITTER_GAP.small;
      if (Math.hypot(q.x - x, q.y - y) < gap) return false;
    }
    // ⚠️ AND NEVER BEHIND A BUILDING. Trym: "not behind buildings where users cant see them." A tall
    // overlay draws over anything whose foot is above its own, so rubbish dropped there is paid work the
    // player can never find. 120 px is the shortest thing in the town you could lose a bin bag behind.
    for (const o of OVERLAYS) {
      if (o[4] < 90) continue;   // a bench or a kerb hides nothing; a tree or a shopfront hides a bin bag
      if (x > o[1] - 8 && x < o[1] + o[3] + 8 && y > o[2] - 8 && y < o[2] + o[4] - 10) return false;
    }
    return true;
  }
  const REACH = { litter: 30, leaves: 30, bin: 60, dumpster: 64, shutter: 62, fountain: 72, graffiti: 56, crows: 74 };
  let autoAt = 0;
  // 🚶 A PICKUP NEEDS A STEP (23 Sep 2026). The arrival point (1100,1230) is 28 px from street spot s19, inside litter's
  // reach, so about one visit in twelve the seeded draw put rubbish there and it was fixed and paid as the page loaded —
  // a chore nobody did (and a town-life walk that flaked on the same draw). Nothing is picked up until the banana has moved.
  let still = [ctx.pos.x, ctx.pos.y];
  function autoPick(now) {
    if (now - autoAt < 120 || (ctx.inside && ctx.inside())) return;
    autoAt = now;
    const px = ctx.pos.x, py = ctx.pos.y;
    if (still) { if (Math.hypot(px - still[0], py - still[1]) < 1) return; still = null; }
    for (const p of problems) { const r = REACH[p.type]; if (r && Math.hypot(p.x - px, (p.foot != null ? p.foot : p.y) - py) < r) { fix(p.id); return; } }
    for (const o of objectsNow()) if (Math.hypot(o.x - px, o.y - py) < 34) { dusk.takeObject(o); return; }
    const f = life.pickAt ? life.pickAt(px, py, 30) : null;
    if (f) { float(f.x, f.y - 30, '+1'); if (hud && hud.refresh) hud.refresh(); }
  }
  function tick(now, dt) {
    stepSprites(dt);
    carryTick();
    if (folk) folk.tick(now, dt);
    if (cafe) cafe.tick(now);
    if (lemon) lemon.tick(now);
    workTick(now);
    autoPick(now);
    if (dusk) { dusk.stepMeCurse(now); dusk.stepGhosts(dt, now); }
    stepFlying(dt);
    swayBodies(now);
    paintClock(now);
    if (now < secAt) return;
    secAt = now + 500;
    // ☕ every way a shift can start or end lands here: the kiosk tap, walking off the mark, stepping into
    // a shop, a front closing, or the page going away. One poll is cheaper than five call sites agreeing.
    shiftOn = !!(cafe && cafe.on()); standOn = !!(lemon && lemon.on());
    const wa = workingAt();
    if (wa !== workingWas) { workingWas = wa; life.setOverride(overrideFor); }   // 🧍 the boss steps aside, or comes back
    const c = curseNow(), cType = c === 'none' ? null : c;
    const om0 = !curse && !!omenNow();
    const beat = life.beat();
    // 🕯 the chapter released (or claimed) Nib: a refresh walks him where he now belongs
    const ns = ctx.nibStation ? ctx.nibStation() : null;
    if (ns !== nibSt) { const freed = nibSt && !ns; if (freed) nibHallBeat = beat; nibSt = ns; life.setOverride(overrideFor); if (freed && life.nudge) life.nudge('nib'); }
    // ⭐ THE GATE. Evening, a Curse Night, an omen — or a day ghost, which condition() asks for itself.
    if (!dusk && (beat >= 4 || cType || om0)) loadDusk();
    if (dusk) {
      if (cType !== curse) { if (curse) dusk.leaveCurse(); if (cType) dusk.enterCurse(cType); }
      if (om0 !== dusk.omenOn()) dusk.omens(om0);
    }
    if (beat !== lastBeat) { lastBeat = beat; lampsByHour(); kioskShow(); }   // ℹ️ the kiosk's own banana goes home with everybody else
    if (dusk) dusk.setBananas([...life.seam.residents().filter((r) => !r.hidden).map((r) => ({ x: r.x, y: r.y })), ...(ctx.others ? ctx.others() : [])]);
    night.hidden = inside();
    hbar.hidden = inside();
    if (!curse) night.style.opacity = String(beat === 5 ? NIGHT.night : beat === 4 ? NIGHT.evening : (dusk && dusk.omenOn()) ? 0.12 : 0);
    // 👻 every night has its ghosts; dawn takes them (a Curse Night owns its own until it ends)
    const cursedNight = !!(curse && curse !== 'hush');
    if (beat === 5 && !cursedNight && !plainNight && dusk) { plainNight = true; (NIGHT_GHOSTS.night || []).forEach((id) => dusk.ghostOf(id, null, true)); dusk.nightBegins(2); }   // 🔮 the night's cursed things come through it
    else if (beat !== 5 && plainNight) { plainNight = false; if (!cursedNight && dusk) { dusk.clearGhosts(true); dusk.nightEnds(); } }
    if (dusk) dusk.spawnThroughNight(now);
    // crows fly when you come close (and settle again on the next condition)
    for (const s of cond.crows) if (!s.gone && Math.hypot(ctx.pos.x - s.x, ctx.pos.y - s.y) < 70) flyOff(s);
    // a day changes under a long visit: the seeds move on
    if (dayNum() !== dayAt) { dayAt = dayNum(); todayStage(); condition(); reseedProblems(); }
    // …and a wave turns over inside a day: the look does not move, only what there is to do
    else if (waveNum() !== waveAt) { waveAt = waveNum(); reseedProblems(); }
  }
  let dayAt = dayNum(), waveAt = waveNum();

  // ═════════════════════════════ 🔧 a repair is WORK, not a pickup ═══════════════════════
  // Rubbish is gone the moment you reach it and that is right — but a streetlight is a job, and an
  // instant lamp felt like one more thing that merely vanished (Trym, 19 Sep: "a 4-5 second mini
  // progress bar … so its not instant like the garbage pickups"). WORK names the types that take
  // time; anything not named here still lands at once. Walk off and the job simply stops: nothing is
  // spent, nothing is lost, and the lamp is still there to come back to.
  const WORK = { lamp: 4500, cabinet: 3200 };
  let work = null;
  function workStop() { if (work) { work.el.remove(); work = null; } }
  function workStart(p) {
    workStop();
    const el = document.createElement('i');
    el.className = 'tw-work' + (p.inRoom ? ' is-in' : '');   // 🕹 a repair inside a room rides above the room's plate
    el.style.left = pct(p.x, W); el.style.top = pct((p.foot || p.y) - 100, H);   // under the icon, clear of the banana's own head
    el.style.zIndex = String((p.inRoom ? 2000 : 100) + Math.round(p.foot || p.y) + 4);
    el.innerHTML = '<b></b>';
    world.appendChild(el);
    work = { id: p.id, x: p.x, y: p.foot || p.y, el, bar: el.firstChild, t0: 0, ms: WORK[p.type] || 0 };
  }
  function workTick(now) {
    if (!work) return;
    if (!work.t0) work.t0 = now;
    if (Math.hypot(ctx.pos.x - work.x, ctx.pos.y - work.y) > 96) { workStop(); return; }   // walked away
    const f = Math.min(1, (now - work.t0) / work.ms);
    work.bar.style.width = (f * 100).toFixed(1) + '%';
    if (f >= 1) { const id = work.id; workStop(); fix(id); }
  }

  // ═══════════════════════════════ taps: what is under the finger ════════════════════
  function at(wx, wy) {
    // ⚠️ THE BOX HAS TO COVER WHAT YOU CAN SEE. A thing's default box is 80 wide and reaches 64 px
    // above its foot, which is right for a bin on the cobbles — but a streetlight's tools icon bobs 150 px
    // up at the lamp head, a clear 86 px ABOVE the box, so tapping the one visible affordance did nothing
    // (Trym, 19 Sep: "it was hard to actually figure out where to tap"). A problem may now say how far it
    // reaches; a lamp claims its whole post and its icon.
    for (const p of problems) if (Math.abs(wx - p.x) < (p.grab || 40) && wy < (p.foot || p.y) + 16 && wy > p.y - (p.tall || 64)) return ['room', 'p:' + p.id];
    for (const o of objectsNow()) if (Math.abs(wx - o.x) < 34 && wy < o.y + 10 && wy > o.y - 60) return ['room', 'o:' + o.def.id];
    for (const k in hoards) { const h = hoards[k]; if (h && Math.abs(wx - h.x) < 34 && wy < h.y + 10 && wy > h.y - 120) return ['room', 'h:' + k]; }
    for (const g of ghostsNow()) if (!g.done && g.def.tap && Math.abs(wx - g.x) < 34 && wy < g.y + 6 && wy > g.y - 80) return ['room', 'g:' + g.def.id];
    if (merchant && Math.abs(wx - merchant.x) < 34 && wy < merchant.y + 6 && wy > merchant.y - 90) return ['room', 'm'];
    if (vendor && Math.abs(wx - vendor.x) < 34 && wy < vendor.y + 6 && wy > vendor.y - 90) return ['room', 'v'];
    return null;
  }
  function tap(id, walkTo) {
    const [kind, rest] = [id.slice(0, 1), id.slice(2)];
    if (kind === 'p') { const p = problems.find((q) => q.id === rest); if (p) walkTo(p.x, (p.foot || p.y) + 26, () => { const q = problems.find((z) => z.id === rest); if (!q) return; if (WORK[q.type]) workStart(q); else fix(rest); }); }
    else if (kind === 'h') { const h = hoards[rest]; if (h) walkTo(h.x, h.y + 26, () => lockCard(rest)); }
    else if (kind === 'o') { const o = objectsNow().find((q) => q.def.id === rest); if (o) walkTo(o.x, o.y + 22, () => dusk.takeObject(o)); }
    else if (kind === 'g') { const g = ghostsNow().find((q) => q.def.id === rest && !q.done); if (g) walkTo(g.x + (ctx.pos.x < g.x ? -56 : 56), g.y + 6, () => { const line = one(COPY.ghosts, dayNum() + ghostsNow().length); if (line) say(fill(line)); if (g.s.n > 1) { g.s.fps = 9; setTimeout(() => { g.s.fps = g.def.fps || 5; }, 2500); } track('town_ghost', { id: rest }); }); }
    else if (kind === 'm' && merchant && !merchant.el.hidden) walkTo(merchant.x + (ctx.pos.x < merchant.x ? -58 : 58), merchant.y + 8, () => shopCard('merchant'));
    else if (kind === 'v' && vendor) walkTo(vendor.x + (ctx.pos.x < vendor.x ? -58 : 58), vendor.y + 8, () => shopCard('vendor'));
  }

  // ═══════════════════════════════════ the story's hooks ═════════════════════════════
  // ⚠️ LOCAL to the player in the chapter — the questline's ONE RULE (world-quest.js):
  // a chapter never touches shared state. A forced night here is this player's night.
  const story = {
    forceCurse: (o = {}) => { forced = o.tier || 'deep'; forcedUntil = Date.now() + (o.mins || 15) * 60000; },
    endCurse: () => { forced = null; forcedUntil = 0; },
    addGhost: (def) => (dusk ? dusk.ghostOf(def.id, { fps: 6, ...def }) : null),
    plantObject: (id, at) => { const def = OBJECTS.find((o) => o.id === id); return def && dusk ? dusk.spawnObject(dayNum() + id.length, true, at, def) : null; },
    closeShop: (key) => { if (CLOSABLE.includes(key)) { cond.shut.add(key); cond.fixedShut.delete(key); shutters(); life.setKeep(keepFn); } },
    nudgeLife: (delta) => { nudge += +delta || 0; apply({ ...L }); },
  };

  // ═══════════════════════════════════ the QA seam ═══════════════════════════════════
  const seam = {
    life: () => L, band: () => band, test: TEST, err: () => lastErr,
    wave: () => waveNum(),
    hoarded: () => HOARDABLE.filter(hoardNow),
    carrying: () => !!carry,
    restocked: () => restocked(),
    bare: () => bareShelf(),
    hints: () => hints.map((s2) => s2.key),
    // ☕ the counter, once its chunk is in: the walk cannot wait on an import it did not ask for
    cafe: () => (cafe ? cafe.seam : null),
    lemon: () => (lemon ? lemon.seam : null),   // 🍋 the stand's counter, once its chunk is in
    working: () => !!((cafe && cafe.on()) || (lemon && lemon.on())),   // 🔒 a counter's shift is on: the banana is held there
    lemonReady: () => loadLemon().then((l) => !!l),
    folk: () => (folk ? folk.seam : null),
    folkReady: () => loadFolk().then((f) => !!f),
    cafeReady: () => loadCafe().then((c) => !!c),   // ⚠️ not `lit`: the lamps already own that word on this seam
    chore: (k) => chore(k),
    // ⚠️ the walk cannot play chapter 2, and HOARD_ON is false in the shipped data on purpose — so the
    // only way to see this lock at all is through here, and it is gated on ?towntest like set()
    locks: (on, opened) => { if (!TEST) return false; qaHoard = on == null ? null : !!on; qaOpen = opened ? new Set(opened) : null; hoardings(); shutters(); reseedProblems(); return HOARDABLE.filter(hoardNow); },

    hit: (x, y) => at(x, y),                                   // what a finger at (x,y) would find
    work: () => (work ? { id: work.id, w: work.bar.style.width } : null),
    tapAt: (id) => tap(id, (x, y, then) => { ctx.pos.x = x; ctx.pos.y = y; then(); }),   // tap, walk, arrive
    shutWhy: (k) => (todayShut.has(k) ? 'today' : 'band'),
    // 🧪 shut one front on purpose: the walk cannot wait for the day to roll one, and the reason a
    // shut front gives has to be checked against the front it hangs on
    // 🗑 QA: may a piece of rubbish of this kind lie here? The end-to-end heap is probabilistic — it
    // needs a ghost resting twice on one waypoint — so the walk asserts the RULE directly as well.
    litterRoom: (x, y, kind) => litterRoom(x, y, kind),
    shutShop: (k, today) => { if (!TEST) return false; if (today) todayShut.add(k); story.closeShop(k); return [...cond.shut]; },
    copyOf: (k) => COPY[k],
    open: (k) => openFor(k),
    shutNow,   // 🗺️ the kiosk's card asks whether its own shutter is down
    nextWave: () => { if (!TEST) return -1; waveOfs++; waveAt = waveNum(); reseedProblems(); return waveNum(); },   // the walk cannot wait six hours for the next set
    set: (v) => { if (!TEST) return false; shim.v = Math.max(0, Math.min(100, +v)); shim.dark = 0; return read(); },   // through the real read, hysteresis and all; a set is a fresh night for the ghosts' take
    curse: (t) => { if (t) story.forceCurse({ tier: t, mins: 30 }); else story.endCurse(); },   // 'none' = a forced calm, 'omen' = the signs without the night
    // 🌑 THE MORNING AFTER: say a night of this tier ended `agoMins` ago and let the square wear it.
    // The only way to see it otherwise is to wait for a deep night, which is 3% of days.
    // ⚠️ `morning`, not `night` — this seam already has a night() further down (the darkness level)
    // and the later key silently wins, so the door answered 0.5 and the walk saw nothing change.
    // 👻 QA: charge the town for a ghost's damage, through the real path (the notch, the batch, the room's reply)
    dark: (n) => { if (!TEST) return null; dark(n); return flushDark(); },
    morning: (tier, agoMins) => { if (!TEST) return null; shim.night = tier ? { tier, at: Date.now() - (agoMins || 0) * 60000 } : null; return read().then(() => ({ kind: L.curseKind, at: L.curseAt, now: L.curse })); },
    omen: () => !!(dusk && dusk.omenOn()), nextIn: () => { const o = omenNow(); return o && o.at ? Math.round((o.at - Date.now()) / 60000) : null; },
    // ⚠️ `art` is the SPRITE this problem wears, not its type: a litter problem is a bin bag or a
    // crisp packet and the spacing rule is different for each, so a walk cannot check it without this.
    problems: () => problems.map((p) => ({ id: p.id, type: p.type, x: p.x, y: p.y, key: p.key, art: (p.sprite && p.sprite.key) || '', glow: !!(p.glow && p.glow.el && p.glow.el.classList.contains('is-todo') && !p.glow.gone) })),
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
    ghosts: () => ghostsNow().filter((g) => !g.done).map((g) => ({ id: g.def.id, x: Math.round(g.x), y: Math.round(g.y), hidden: g.s.el.style.opacity === '0', face: g.face || null, mess: g.mess || 0 })),
    nightSpawn: () => { if (!TEST || !dusk) return null; return dusk.resetSpawn(); },   // QA: the night's next thing, now
    cursedMe: () => !!(dusk && dusk.cursedMe()), meFx: () => (dusk ? dusk.meFx() : ''),
    mischief: (id) => { if (!TEST || !dusk) return null; const g = dusk.ghosts().find((q) => q.def.roam && !q.done && (!id || q.def.id === id)); return g ? dusk.mischief(g, true) : null; },   // QA: a roamer makes its mess now
    // ⚠️ the walk cannot assert a ghost into being while its chunk is still on the wire (the
    // shopReady precedent): await this first and the night is in hand.
    nightReady: () => loadDusk().then((d) => !!d),
    litterAt: (x, y, kind, clear) => (TEST && dusk ? dusk.litterAt(x, y, kind, clear) : null),   // QA: one piece of rubbish exactly here (clear = sweep the rest first)
    objects: () => objectsNow().map((o) => ({ id: o.def.id, x: o.x, y: o.y, day: o.day })),
    take: (id) => { const o = objectsNow().find((q) => q.def.id === id); if (o) dusk.takeObject(o); return !!o; },
    night: () => +night.style.opacity || 0,
    shelf: () => shelfFor(), today: (list, front) => { if (TEST && Array.isArray(list)) { todayPin = list.slice(); todayFront = front || null; todayStage(); condition(); reseedProblems(); } return today.slice(); }, odd: () => oddKey,
    merchant: () => !!merchant, vendor: () => !!vendor, visitors: () => cond.visitors.length, visitorsOut: () => cond.visitors.filter((b) => !b.el.hidden).length, crows: () => cond.crows.filter((s) => !s.gone).length,
    full: () => [...cond.full], fountain: () => (cond.fountainDry ? 'dry' : 'on'),
    // the four that moved out answer with a PROMISE so a walk can await the render either way
    cards: { store: () => shopSeam('store'), merchant: () => shopSeam('merchant'), vendor: () => shopSeam('vendor'), health: healthCard },
    shopReady: () => loadShop().then(() => true),
    story, copy: () => Object.keys(COPY),
    coins: () => coinsNow(), found,
    hbar: () => ({ pct: hPct.textContent, fill: hFill.style.width, phase: hbarPhase, used: Math.min(10, (L.cap && L.cap.used) | 0) }),
    clock: () => (slot ? slot.textContent : ''), parked: () => !!parked,
    // 🧪 a QA purse (the pass worker refuses the 'qa' faucet; the coins stay on the local ledger)
    rich: () => (TEST ? passStat('coins_earned', 500, 'qa') : 0),
  };
  // 🧺 HOW FULL THE SHOP LOOKS IS THE TOWN'S HEALTH (docs/town-jobs-plan.md §4). The store's plate is
  // baked at its emptiest on purpose, and the stocked faces are sprites laid over it — the pack's very
  // same units with goods on them, so a full shop is the same shop rather than a different one. One face
  // per thing on Pip's shelf TODAY, read from the same shelfFor() the card reads, so the room and the
  // card cannot disagree: nothing at Abandoned, three at Struggling, seven at Thriving.
  // ⚠️ TWO THINGS OR IT IS INVISIBLE (design library §22, measured on the page): `.is-in`, or the
  // is-inside hide list blanks it; and +2000 on the z, or the room's own plate (2010) covers it. The
  // banana is 2100 + its y, so 2100 + base keeps the depth sorting honest against it.
  let stocked = [], roomAt = '';
  // 📦 the crate rides with you and the walk slows: the weight IS the chore. One sprite, moved on
  // the room's own beat, killed the moment it is put down or the room is left.
  let carry = null;
  function carryOn(on) {
    if (!on && carry) { kill(carry); carry = null; ctx.setSlow(1); hintShow(); return; }
    if (on && !carry) {
      // ⚠️ MEASURED, not guessed: the banana is drawn from pos.y-79 (the top of its head) to pos.y-14
      // (its feet). A crate with its foot at -18 and 36 px of height sits across the body and leaves the
      // head clear — at -30 it covered the face, which reads as a banana wearing a box.
      carry = sprite('crate', ctx.pos.x, ctx.pos.y - 18, { z: 2040 + ctx.pos.y, cls: 'is-in', size: 0.45 });
      ctx.setSlow(0.62);
      hintShow();   // ⭐ taken up: the invitation goes out, so the only lit thing left is the shelf
    }
  }
  // ⚠️ 2040, not 0: moveSprite's z is 100 + y + dz and the room's own plate is 2010, so a crate
  // without the lift is carried BEHIND the shop floor (design library §22).
  function carryTick() { if (carry) moveSprite(carry, ctx.pos.x, ctx.pos.y - 18, 2040); }
  // the deed itself, once you are standing at it
  function chore(key) {
    if (roomAt !== 'store') return false;
    const w = COPY.work || {};
    if (bareShelf() < 0) { if (w.full) say(fill(w.full)); return true; }   // stocked to the last face: nothing to do
    if (CRATES.includes(key)) {
      if (carry) return false;
      carryOn(true);
      if (w.crate) say(fill(w.crate));
      track('town_chore', { at: 'store', step: 'lift' });
      return true;
    }
    if (!carry || key !== bareKey()) return false;
    carryOn(false);
    restockAdd();
    roomShow('store');            // the face fills, from the very shelf the till's card reads
    burst(ctx.pos.x, ctx.pos.y - 30);
    if (w.stocked) say(fill(w.stocked));
    track('town_chore', { at: 'store', step: 'stock' });
    return true;
  }
  // ✨ THE INVITATION, AND IT IS THE WHOLE INSTRUCTION. Empty hands: the two crate stacks glow.
  // Carrying one: the bare face glows instead. That is the chore taught with no words and no arrows —
  // and it only ever shines for somebody who can answer it, so it is never a tease.
  // Each glowing thing is the SAME single the plate already painted, laid exactly over itself, so
  // nothing moves and nothing is added to the room: it just picks up the town's own `is-todo` halo.
  let hints = [];
  function hintShow() {
    hints.forEach(kill); hints = [];
    if (roomAt !== 'store' || !STORE || !STORE.over) return;
    const mine = ctx.job && ctx.job();
    if (!mine || mine.at !== 'store' || bareShelf() < 0) return;
    for (const k of (carry ? [bareKey()] : CRATES)) {
      const o = STORE.over[k]; if (!o) continue;
      const sp = sprite(o[0], o[1], o[2], { z: 2000 + o[2], cls: 'is-in is-todo' });
      if (sp) hints.push(sp);
    }
  }
  function roomShow(key) {
    roomAt = key || '';
    if (roomAt === 'condo') arcadeShow(); else arcadeClear();   // 🕹 the arcade's week: litter and a dark cabinet, for its own staff
    if (roomAt !== 'store') carryOn(false);   // a crate belongs to the shop it came from
    stocked.forEach(kill); stocked = [];
    if (roomAt !== 'store' || !STORE || !STORE.full) { hintShow(); return; }
    const n = (shelfFor() || []).length;
    for (const [, sk, cx, base] of STORE.full.slice(0, n)) {
      const sp = sprite(sk, cx, base, { z: 2000 + base, cls: 'is-in' });
      if (sp) stocked.push(sp);
    }
    hintShow();
  }

  // ═══════════════════════════ 🕹 THE ARCADE'S WEEK (22 Sep 2026; docs/town-jobs-plan.md §12) ═══════════
  // Spinner's job had nothing to do behind its 60 a week. Now its staff find the floor littered and one
  // cabinet dark each day: walking onto a piece sweeps it, a tap on the dark cabinet is a repair (the
  // streetlight's hold, on the room's own plate), and each counts on the week's sheet at the pass worker
  // (town-work.js chore). Per player, per day, remembered on this device (tw-arcade-v1); nobody who does
  // not work here sees any of it — an arcade that looks broken to a customer is a different feature.
  const ARC_KEY = 'tw-arcade-v1';
  const ARC_LITTER = [[430, 470], [590, 404], [700, 500]];   // floor spots inside the arcade, off every collider
  const ARC_CABS = ['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9'];
  const arcRead = () => { try { const a = JSON.parse(localStorage.getItem(ARC_KEY) || 'null'); return a && a.d === dayNum() && Array.isArray(a.swept) && Array.isArray(a.fixed) ? a : { d: dayNum(), swept: [], fixed: [] }; } catch (e) { return { d: dayNum(), swept: [], fixed: [] }; } };
  const arcWrite = (a) => { try { localStorage.setItem(ARC_KEY, JSON.stringify(a)); } catch (e) {} };
  let arcLitter = [], arcDead = null;
  const arcStaff = () => { const j = ctx.job && ctx.job(); return !!(j && j.at === 'condo'); };
  let arcForce = null;   // 🧪 a walk may pick the day's dark cabinet (arcadeReset)
  const arcDeadKey = () => arcForce || ARC_CABS[Math.floor(h(dayNum(), 77, 1) * ARC_CABS.length) % ARC_CABS.length];
  function arcadeClear() {
    arcLitter.forEach((l) => kill(l.s)); arcLitter = [];
    if (arcDead) { arcDead.el.remove(); arcDead.m.remove(); arcDead = null; }
  }
  function arcadeShow() {
    arcadeClear();
    if (!arcStaff() || !ARCADE || !ARCADE.spots) return;
    const a = arcRead();
    const sweepIn = callIn('condo', 'sweep');   // 📟 the litter and the dark cabinet are the day's CALLS: drawn once each has come in
    ARC_LITTER.forEach(([x, y], i) => {
      if (a.swept.includes(i) || !sweepIn) return;
      const s = sprite(['trash1', 'trash2', 'trash3'][i % 3], x, y, { z: 2000 + y, cls: 'is-in' });
      if (s) arcLitter.push({ i, s, x, y });
    });
    const key = arcDeadKey();
    if (a.fixed.includes(key) || !callIn('condo', 'fix')) return;
    const sp = ARCADE.spots.find((q) => q[0] === key);
    if (!sp) return;
    const [, x0, y0, x1, y1] = sp;
    const el = document.createElement('i');
    el.className = 'tw-dead is-in';
    el.style.left = pct(x0, W); el.style.top = pct(y0, H); el.style.width = pct(x1 - x0, W); el.style.height = pct(y1 - y0, H);
    el.style.zIndex = String(2000 + y1 + 1);
    world.appendChild(el);
    const m = mark((x0 + x1) / 2, y1, 60, 2000 + y1 + 2, true);
    m.classList.add('is-in');
    arcDead = { key, el, m, x: (x0 + x1) / 2, y: y1 };
  }
  // walking onto a piece of litter on the arcade floor sweeps it up
  function sweepAt(x, y) {
    if (!arcLitter.length) return false;
    const i = arcLitter.findIndex((l) => Math.hypot(l.x - x, l.y - y) < 40);
    if (i < 0) return false;
    const l = arcLitter.splice(i, 1)[0];
    kill(l.s); burst(l.x, l.y - 6);
    const a = arcRead(); a.swept.push(l.i); arcWrite(a);
    if (ctx.chore) ctx.chore('sweep');
    track('town_chore', { at: 'condo', kind: 'sweep' });
    return true;
  }
  const cabinetDead = (key) => !!(arcDead && arcDead.key === key);
  function cabinetRepair(key) {
    if (!cabinetDead(key)) return false;
    workStart({ id: 'cab:' + key, type: 'cabinet', x: arcDead.x, y: arcDead.y, foot: arcDead.y, inRoom: true });
    return true;
  }
  function cabinetFixed(key) {
    if (!arcDead || arcDead.key !== key) return;
    burst(arcDead.x, arcDead.y - 40);
    arcDead.el.remove(); arcDead.m.remove(); arcDead = null;
    const a = arcRead(); a.fixed.push(key); arcWrite(a);
    if (ctx.chore) ctx.chore('fix');
    track('town_chore', { at: 'condo', kind: 'fix' });
  }
  seam.arcade = () => ({ staff: arcStaff(), litter: arcLitter.map((l) => ({ i: l.i, x: l.x, y: l.y })), dead: arcDead ? arcDead.key : null, working: !!(work && String(work.id).indexOf('cab:') === 0) });
  // 🧪 a fresh arcade day for its staff — and its calls already in (tw-calls-v1 qa, honoured under ?towntest alone)
  seam.arcadeReset = (k) => { if (!TEST) return false; arcForce = ARC_CABS.includes(k) ? k : null; arcWrite({ d: dayNum(), swept: [], fixed: [] }); try { localStorage.setItem('tw-calls-v1', JSON.stringify({ d: dayNum(), t0: Date.now() - 36e5, qa: ['sweep', 'fix'] })); } catch (e) {} if (roomAt === 'condo') arcadeShow(); return true; };
  seam.cabinetDead = cabinetDead; seam.cabinetRepair = cabinetRepair; seam.sweepAt = sweepAt;   // the walk's doors to the same three

  // 💼 THE STAFF CARD ASKS THIS ROOM TWO THINGS (23 Sep 2026, town-staff.js): what is waiting for its worker today —
  // the same litter, dark cabinet and bare faces the rooms already show their staff — and the shift begun at the
  // counter the worker has walked to. Both are this file's own state and this file's own deeds; the card copies neither.
  seam.calls = (at) => {
    const j = ctx.job && ctx.job();
    if (!j || j.at !== at) return [];
    return callsAt(at).filter((c) => c.open).map((c) => ({ kind: c.kind, n: c.left }));   // 📟 the calls that have come in and are not yet answered
  };
  seam.clockIn = (at) => {
    if (at === 'cafe') { loadCafe().then((c) => { if (c && !c.on()) c.clockIn(view); }); return true; }
    if (at === 'stand') { loadLemon().then((l) => { if (l && !l.on()) l.clockIn(view); }); return true; }
    return false;
  };
  seam.hoardNow = hoardNow;

  return { tick, at, tap, openFor, seam, story, roomShow, sweepAt, cabinetDead, cabinetRepair };
}
