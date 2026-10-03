// 👋 THE SOCIAL LAYER — echoes, waves and the waves badge, in every walkable area (26 Sep 2026).
//
// Trym: "echoes … something for all areas, not just the town, so build it as something that stretches throughout the
// whole world and waves ofcourse" — and a wave never goes in the letterbox: "a separate icon shows up for general
// notifications on the top left corner with the quests and job-icons … for small easygoing messages". One lazy chunk; an
// area boots it with its own name and nothing else. The rules are docs/design-library.md §42, the server is worker-rave's
// YardRoom (/echoes /wave /notices /echo) and relayWave in every presence room, and the wire in and out of those rooms is
// two document events presenceRoom answers (world.js): world:wave-out and world:wave.
import { worldOwner, worldSid, worldToken, worldNewcomer } from './world.js';
import { drawComposite, assetsReady } from './banana-engine.js';
import { ensureAnon, passFlush } from './banana-pass.js';
import CLOSE from '../icons/pixelart/close.svg?raw';
import HOUSE from '../icons/pixelart/home.svg?raw';
import { fillWords } from './fill-words.js';
import HAND from '../icons/pixelart/hand-solid.svg?raw';
import W from '../data/copy/world-social.json';
import { ECHO_ROUTES } from '../data/echo-routes.js';   // 🚶 where an echo walks in the park and the bay

const API = 'https://banana-rave.trymstene.workers.dev/yards';
const KEY = 'bw-social-v1';
const MAX_OUT = 2;   // echoes in one area at once: company, not a crowd
// 🗺 each area: its view, its world and your banana; how wide a banana is there (% of the plate); and where an echo may
// be — a `route` to stroll between places on (src/data/echo-routes.js), a `road` to stroll along, or `own`: the town's own
// visitors wear them (town-folk.js).
// ⚠️ never the rave: its floor promises that every banana on it is a real one, here right now.
const AREAS = {
  town: { view: '#twView', world: '#twWorld', me: '.tw-me', own: 1 },
  park: { view: '#pkView', world: '#pkWorld', W: 2760, H: 1100, size: 3.6, me: '#pkMe', route: ECHO_ROUTES.park },   // the plaza round the fountain, clear of Old Peel's bench
  beach: { view: '#bhView', world: '#bhWorld', W: 2760, H: 1100, size: 3.6, me: '#bhMe', route: ECHO_ROUTES.beach },   // the sand paths: never the court, the hut, the bar or a stall
  homestead: { view: '.hs-view', world: '#hsWorld', W: 1800, H: 1100, size: 5.5, me: '#hsMe', road: 900, rest: [380, 640, 1480] },
};

const track = (ev, p) => { try { window.gtag && window.gtag('event', ev, p || {}); } catch (e) {} };
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } };
const write = (p) => { try { localStorage.setItem(KEY, JSON.stringify({ ...read(), ...p })); } catch (e) {} };
const today = () => new Date().toISOString().slice(0, 10);
// who this device waved at today: a card says Waved rather than offer a wave the server would count as the same one
const sentToday = (k) => { const s = read(); return !!k && s.day === today() && (s.sent || []).includes(k); };
// ✋ …and WHEN you last waved to each (29 Sep 2026, Trym: "had 2 waves available for kiwi … one 2 days back … is there a
// duplicate?"). "Waved" was kept for the day only, so at midnight every wave already answered offered a wave back again. A
// wave is answered once you have waved to its sender after it came; the day's list still stands for the server's one a day.
const markSent = (k) => {
  const s = read(); const sent = s.day === today() ? (s.sent || []) : []; if (k && !sent.includes(k)) sent.push(k);
  const back = Object.entries({ ...(s.back || {}), ...(k ? { [k]: Date.now() } : {}) }).sort((a, b) => b[1] - a[1]).slice(0, 80);
  write({ day: today(), sent: sent.slice(-60), back: Object.fromEntries(back) });
};
const answered = (k, t) => !!k && ((+(read().back || {})[k] || 0) >= t || sentToday(k));

const myName = () => { try { return (localStorage.getItem('ps-name-v1') || '').trim().slice(0, 24); } catch (e) { return ''; } };
const myFit = () => { try { const o = JSON.parse(localStorage.getItem('bb-last') || 'null') || {}; return { hat: o.hat || '', glasses: o.glasses || '', extras: o.extras || {} }; } catch (e) { return {}; } };
const mySlug = () => { try { return (JSON.parse(localStorage.getItem('hs-v1') || '{}') || {}).slug || ''; } catch (e) { return ''; } };
const DRAW = (f) => {
  const x = (f && f.extras) || {}, extras = {};
  for (const k of Object.keys(x)) if (x[k]) extras[k] = true;
  return { hat: (f && f.hat) || 'none', glasses: (f && f.glasses) || 'none', extras, top: '', bottom: '', bg: 'transparent', captions: false, effect: 'none' };
};
// 🍌 the welcome is Nib's, in the town hall clerk's own look (world-quest.js NIB_DRAW)
const NIB = { hat: 'tophat', glasses: 'potter', extras: { necktie: true } };

// ✋ the pack's hand (src/icons/pixelart/hand-solid.svg), gold with a one-pixel outline over a banana, gold on the badge
const HAND_D = (String(HAND).match(/ d="([^"]+)"/) || [])[1] || '';
function handSvg(fill, line) {
  let s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 26 26" shape-rendering="crispEdges" aria-hidden="true">';
  if (line) for (const t of ['-1 0', '1 0', '0 -1', '0 1']) s += '<path fill="' + line + '" transform="translate(' + t + ')" d="' + HAND_D + '"/>';
  return s + '<path fill="' + fill + '" d="' + HAND_D + '"/></svg>';
}
const HAND_URI = 'data:image/svg+xml,' + encodeURIComponent(handSvg('#ffe135', '#111'));
// ⚠️ the two icons it draws come in as their own strings, never through pixel-icons.js: the beach and the homestead
// must not carry the icon pack (tests/world-weight.spec.mjs), and this chunk loads there
const ico = (svg, n) => String(svg).replace('<svg ', '<svg width="' + n + '" height="' + n + '" shape-rendering="crispEdges" aria-hidden="true" focusable="false" ');

const CSS = `
.bws-echo { position:absolute; transform:translate(-50%,-100%); pointer-events:none; opacity:0; transition:opacity 1.2s ease; }
.bws-echo.is-on { opacity:.72; }
.bws-echo canvas { display:block; width:100%; height:auto; image-rendering:pixelated; }
.bws-echo:not(.tw-npc)::after { content:''; position:absolute; left:50%; bottom:-3px; width:76%; aspect-ratio:3/1; transform:translateX(-50%); background:rgba(20,40,18,.26); border-radius:50%; z-index:-1; }
.bws-tag { position:absolute; left:50%; top:-14px; transform:translateX(-50%); font-size:.5rem; font-weight:800; letter-spacing:.05em; color:#fffdf5; text-shadow:1px 1px 0 #000; white-space:nowrap; }
.bw-name, .bws-tag { display:flex; align-items:center; gap:3px; }
[data-pid] > .bw-name::before, .wm-twin[data-pid-of] > .bw-name::before { content:''; display:inline-block; width:4px; height:4px; background:#5fe36a; box-shadow:0 0 0 1px #000; }
[data-new] > .bw-name::after, [data-new] > .bws-tag::after, .wm-twin[data-new-of] > .bw-name::after, .wm-twin[data-new-of] > .bws-tag::after, .bws-new { content:var(--bws-new, ''); display:inline-block; padding:0 3px; background:#8de08d; color:#10220c; box-shadow:0 0 0 1px #000; text-shadow:none; font-size:.4rem; font-weight:900; letter-spacing:.06em; text-transform:uppercase; line-height:1.35; white-space:nowrap; }
.bws-new { position:absolute; left:100%; top:50%; transform:translateY(-50%); margin-left:5px; padding:0 2px; font-size:.46rem; }
.bws-hand { position:absolute; left:76%; top:24%; width:30%; transform:translate(-50%,-50%); transform-origin:50% 90%; pointer-events:none; image-rendering:pixelated; z-index:2; animation:bwsWave 1.6s ease-out forwards; }
@keyframes bwsWave { 0% { transform:translate(-50%,-50%) scale(.2); opacity:0; } 12% { transform:translate(-50%,-50%) scale(1); opacity:1; } 26% { transform:translate(-50%,-50%) rotate(-22deg); } 40% { transform:translate(-50%,-50%) rotate(18deg); } 54% { transform:translate(-50%,-50%) rotate(-16deg); } 68% { transform:translate(-50%,-50%) rotate(10deg); } 84% { transform:translate(-50%,-50%) rotate(0); opacity:1; } 100% { transform:translate(-50%,-80%); opacity:0; } }
.bws { position:absolute; left:18px; top:48px; width:0; height:0; z-index:10; pointer-events:none; transition:top 200ms ease-out; }
.bws[hidden] { display:none !important; }
.bws.is-open { z-index:12; }
.bws__b { position:absolute; left:-13px; top:-15px; line-height:0; background:#111; width:32px; height:32px; padding:0; border-radius:50%; display:flex; align-items:center; justify-content:center; box-sizing:border-box; transform:rotate(-8deg);
  box-shadow:2px 2px 0 rgba(0,0,0,.35); border:0; cursor:pointer; pointer-events:auto; touch-action:manipulation; -webkit-tap-highlight-color:transparent; }
.bws__b::after { content:''; position:absolute; inset:-8px; }
.bws__b svg { display:block; width:18px; height:18px; }
.bws__n { position:absolute; right:-7px; top:-7px; min-width:17px; height:17px; padding:0 3px; box-sizing:border-box; border-radius:9px; background:#ff4d6d; color:#fff; border:2px solid #111; font-size:.56rem; font-weight:900; line-height:13px; text-align:center; transform:rotate(8deg); }
.bws__n:empty { display:none; }
.bws.is-ring .bws__b { animation:bwsRing .8s ease-out; }
@keyframes bwsRing { 20% { transform:rotate(-24deg) scale(1.14); } 45% { transform:rotate(8deg) scale(1.14); } 70% { transform:rotate(-14deg); } }
body.pk-inside .bws, body.bh-inside .bws, .hs-world.is-inside ~ .bws, .tw-world.is-inside ~ .bws { display:none !important; }
.bws-list { position:absolute; left:-13px; top:24px; width:min(270px, calc(100vw - 40px)); max-height:var(--bws-max, 60vh); overflow-y:auto; box-sizing:border-box; background:#fffdf5; color:#241c00;
  border:3px solid #000; box-shadow:3px 3px 0 #000; border-radius:2px; padding:2px 10px 8px; pointer-events:auto; font-size:.74rem; line-height:1.25; transform-origin:0 0; animation:bwsIn .25s cubic-bezier(.34,1.56,.64,1); }
.bws-list[hidden] { display:none !important; }
.bws-list ol { list-style:none; margin:0; padding:0; }
.bws-li { display:grid; grid-template-columns:34px minmax(0,1fr) 78px; gap:8px; align-items:center; min-height:46px; padding:6px 0; box-sizing:border-box; border-top:2px dashed rgba(0,0,0,.16); }
.bws-li:first-child { border-top-color:transparent; }   /* the line goes, its 2 px stay: every row one height */
.bws-li.is-new { background:linear-gradient(90deg, rgba(255,225,53,.34), rgba(255,225,53,0)); }
.bws-li canvas { width:34px; height:34px; box-sizing:border-box; image-rendering:pixelated; background:#f3ead0; border:2px solid #000; border-radius:50%; }
.bws-li p { margin:0; min-width:0; }
.bws-li.is-hi p { grid-column:2 / -1; }
.bws-li b { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:.8rem; }
.bws-li small { display:block; opacity:.62; font-size:.64rem; margin-top:1px; }
.bws-back { appearance:none; box-sizing:border-box; width:78px; height:30px; padding:0; border:2px solid #000; display:flex; align-items:center; justify-content:center; font:inherit; font-size:.68rem; font-weight:900; white-space:nowrap; background:#111; color:#ffe135; cursor:pointer; }
.bws-back[disabled] { background:#e8e0c8; color:#6b6450; cursor:default; }
.bws-li small a { color:inherit; font-weight:800; text-decoration:underline; text-underline-offset:2px; }
.bws-me { display:flex; gap:8px; align-items:center; margin-top:4px; padding-top:8px; border-top:2px solid rgba(0,0,0,.18); font-weight:700; font-size:.68rem; cursor:pointer; }
.bws-me input { width:16px; height:16px; margin:0; accent-color:#111; flex:none; }
.bws-veil { position:absolute; inset:0; z-index:59; }
.bws-card { position:absolute; left:50%; bottom:12px; transform:translateX(-50%); z-index:60; width:min(300px, calc(100% - 24px)); box-sizing:border-box; background:#fffdf5; color:#241c00;
  border:3px solid #000; box-shadow:3px 3px 0 #000; border-radius:3px; padding:24px 12px 12px; animation:bwsUp .28s cubic-bezier(.34,1.56,.64,1); }
/* ⭐ THE CARD HAS ONE CENTRE, the middle between its two buttons: the name, the line under it and the line below all sit
   on it (Trym, 26 Sep: "it should align with the center between the two buttons"). The same padding both sides, the
   text starting under the portrait's reach, and the NEW sticker hung off the name so it never moves the name. */
.bws-card h2 { margin:0; padding:0 30px; display:flex; justify-content:center; font-size:1.05rem; line-height:1.15; text-align:center; }
.bws-nm { position:relative; min-width:0; overflow-wrap:anywhere; }
.bws-nm.has-new { max-width:calc(100% - 64px); }
.bws-role { margin:3px 0 0; padding:0 30px; font-size:.7rem; opacity:.72; text-align:center; }
.bws-say { margin:12px 0 10px; font-size:.8rem; line-height:1.35; text-align:center; }
.bws-pop { position:absolute; top:-56px; left:-16px; width:112px; height:112px; transform:rotate(-8deg); transform-origin:center bottom; clip-path:inset(0 0 26% 0); filter:drop-shadow(2px 3px 0 rgba(0,0,0,.4)); pointer-events:none; }
.bws-pop canvas { display:block; width:100%; height:100%; image-rendering:pixelated; }
.bws-row { display:flex; gap:8px; }
.bws-go, .bws-alt { flex:1 1 0; min-width:0; height:38px; box-sizing:border-box; display:flex; align-items:center; justify-content:center; gap:6px; white-space:nowrap; font:inherit; font-size:.8rem; font-weight:900; padding:0 .5rem; border:2px solid #000; box-shadow:2px 2px 0 #000; cursor:pointer; text-decoration:none; }
.bws-go { background:#111; color:#ffe135; }
.bws-go svg, .bws-alt svg { width:16px; height:16px; flex:none; }
.bws-go[disabled] { background:#e8e0c8; color:#6b6450; box-shadow:2px 2px 0 #000; cursor:default; }
.bws-alt { background:#fffdf5; color:#111; }
.bws-note { margin:8px 0 0; font-size:.72rem; font-weight:700; text-align:center; }
.bwg-ico { display:inline-block; vertical-align:-3px; color:#d99a00; }
.bws-note[hidden] { display:none; }
.bws-x { position:absolute; right:2px; top:2px; width:32px; height:32px; display:flex; align-items:center; justify-content:center; background:none; border:0; color:#111; cursor:pointer; padding:0; }
@keyframes bwsIn { 0% { transform:scale(.7); opacity:0; } 100% { transform:none; opacity:1; } }
@keyframes bwsUp { 0% { transform:translate(-50%,24px); opacity:0; } 100% { transform:translateX(-50%); opacity:1; } }
@media (prefers-reduced-motion:reduce) { .bws-card, .bws-list, .bws.is-ring .bws__b { animation:none; } .bws-hand { animation:bwsFade 1.6s forwards; } }
@keyframes bwsFade { 0%, 80% { opacity:1; } 100% { opacity:0; } }
`;

let A = null, area = '', view = null, world = null, api = null;
let rows = [], queue = [], nextAt = 0;
const out = new Map();   // slug → the echo that is out now (a sprite of ours, or the town's visitor wearing it)
let notes = [], seen = 0, openedAt = 0, echoOn, waited = false;
let root = null, list = null, card = null, veil = null, cardSlug = '';   // cardSlug: whose echo card is open (it stands while you read)
let press = null, quietUntil = 0, lastLive = 0;

// ---- the server, with the proof it asks for -------------------------------------------------------------------------
// ⚠️ A WAVE MINTS A PASS IF IT MUST (the post office's proof(), minus its "no address" early out): every visitor may
// wave, and ensureAnon is how a visitor who has done nothing yet becomes somebody the room can believe.
async function proof() {
  if (worldToken()) return true;
  try { await ensureAnon(); } catch (e) {}
  if (worldToken()) return true;
  try { passFlush(); } catch (e) {}
  for (let i = 0; i < 24 && !worldToken(); i++) await new Promise((r) => setTimeout(r, 140));
  return !!worldToken();
}
async function post(path, body, mint) {
  if (mint ? !(await proof()) : !worldToken()) return { status: 401 };
  try {
    const r = await fetch(API + path, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...(body || {}), pass: worldOwner(), alt: worldSid(), wt: worldToken() }),
    });
    const j = await r.json().catch(() => ({}));
    return { ...j, status: r.status };
  } catch (e) { return { status: 0 }; }
}

// ---- the echoes -----------------------------------------------------------------------------------------------------
const okRow = (e) => e && /^[a-z0-9-]{1,40}$/.test(e.slug || '') && typeof e.n === 'string' && !!e.n;
// 👥 AN ECHO IS SOMEONE WHO WAS HERE — never someone who IS (3 Oct 2026, Trym: "i see Bananaman echo, AND the actual user
// online - live bananaman in the park at the same time … double player where one is an echo looks quite bad"). A player in
// the room wears their name over their head ([data-pid] .bw-name, wherever the marks layer carries it): an echo by that
// name is never taken, and one already out fades the moment its player walks in.
const hereNow = () => {
  const s = new Set();
  for (const t of document.querySelectorAll('[data-pid] .bw-name')) { const n = (t.textContent || '').trim().toLowerCase(); if (n) s.add(n); }
  return s;
};
const isHere = (e, h) => h.has(String(e.n || '').trim().toLowerCase());
function dropHere() {
  if (!out.size) return;
  const h = hereNow();
  for (const s of [...out.values()]) {
    if (!isHere(s.e, h)) continue;
    if (s.el) { dropSprite(s, true); continue; }
    // the town's visitors wear their echoes themselves (town-folk.js): it sends that one home
    out.delete(s.e.slug);
    try { document.dispatchEvent(new CustomEvent('world:echo-here', { detail: s.e.slug })); } catch (e) {}
  }
}
async function loadEchoes() {
  const s = read();
  let got = s.ec && Date.now() - (s.ec.t || 0) < 600000 && Array.isArray(s.ec.rows) ? s.ec.rows : null;
  if (!got) {
    try {
      const r = await fetch(API + '/echoes?mine=' + encodeURIComponent(mySlug()));
      if (r.ok) { got = (await r.json()).echoes || []; write({ ec: { t: Date.now(), rows: got } }); }
    } catch (e) {}
  }
  const me = mySlug();
  rows = (got || []).filter((e) => okRow(e) && e.slug !== me);
  queue = rows.slice().sort(() => Math.random() - 0.5);
  nextAt = performance.now() + 2500 + Math.random() * 4000;
}
function takeEcho() {
  if (out.size >= MAX_OUT) return null;
  const h = hereNow();
  for (let i = 0; i < queue.length; i++) {
    const e = queue.shift();
    queue.push(e);
    if (!out.has(e.slug) && !isHere(e, h)) return e;
  }
  return null;
}

// 🚶 our own sprites (every area but the town): one strolls between places on its area's route, or along the road past your gate
function spawnEcho(now) {
  const e = takeEcho();
  if (!e) return;
  const s = { e, fit: DRAW(e.fit), el: document.createElement('div'), drawn: -1, bob: 0, bobAt: now, danceAt: now + 4000 + Math.random() * 6000 };
  if (A.road) {
    const l2r = Math.random() < 0.5;
    s.x = l2r ? -60 : A.W + 60; s.to = l2r ? A.W + 60 : -60;
    s.y = A.road + Math.round((Math.random() - 0.5) * 30);
    s.pauseAt = A.rest[Math.floor(Math.random() * A.rest.length)];   // a stop on open road (homestead-geo: the sign, gate and mailbox are 1010–1252)
  } else {
    // 🚶 in at a place on the area's route that no other echo holds; it stands a moment, then strolls
    const held = heldBy(null), free = A.route.pts.map((q, i) => i).filter((i) => !held.has(i));
    if (!free.length) return;
    s.node = free[Math.floor(Math.random() * free.length)];
    [s.x, s.y] = A.route.pts[s.node];
    s.rest = now + 2500 + Math.random() * 5000;
    s.until = now + 50000 + Math.random() * 50000;
  }
  const el = s.el;
  el.className = 'bws-echo';
  el.dataset.slug = e.slug;
  if (e.nw) el.dataset.new = '1';   // 🌱 an echo of a farm claimed in the last few days: a new banana to welcome
  el.noCull = true;   // ⚠️ the park's and the bay's cull sweeps rewrite `display` on every % child without it
  el.style.width = A.size + '%';
  const cv = document.createElement('canvas');
  cv.width = cv.height = 150;
  el.appendChild(cv);
  const tag = document.createElement('span');
  tag.className = 'bws-tag';
  tag.textContent = e.n;
  el.appendChild(tag);
  if (world.parentElement && world.parentElement.__wm) world.parentElement.__wm.lift(tag, el);   // 🔤 above the night (world-marks.js)
  s.g = cv.getContext('2d');
  world.appendChild(el);
  out.set(e.slug, s);
  placeSprite(s);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-on')));
}
function placeSprite(s) {
  s.el.style.left = (s.x / A.W * 100) + '%';
  s.el.style.top = (s.y / A.H * 100) + '%';
  s.el.style.zIndex = String(100 + Math.round(s.y));
}
function dropSprite(s, fade) {
  out.delete(s.e.slug);
  if (!fade) { s.el.remove(); return; }
  s.el.classList.remove('is-on');
  setTimeout(() => s.el.remove(), 1300);
}
// the places another echo holds: where it stands, or where it is walking to
function heldBy(me) {
  const h = new Set();
  for (const o of out.values()) if (o !== me && o.el) { if (o.node >= 0) h.add(o.node); if (o.leg != null) h.add(o.leg); }
  return h;
}
function stepSprite(s, now, dt) {
  let walk = 0, moving = false;
  if (A.route) {
    // 🚶 THE PARK AND THE BAY (Trym, 29 Sep 2026: "Echoes can move around in those areas too"): stand a while at a place,
    // then stroll to one beside it along the route; a card you opened on it holds it where it is while you read
    const R = A.route;
    if (s.leg != null) {
      if (cardSlug !== s.e.slug) {
        const [tx, ty] = R.pts[s.leg], dx = tx - s.x, dy = ty - s.y, d = Math.hypot(dx, dy), st = STROLL * dt;
        if (d <= st) { s.x = tx; s.y = ty; s.node = s.leg; s.leg = null; s.rest = now + 3000 + Math.random() * 7000; }
        else { s.x += dx / d * st; s.y += dy / d * st; moving = true; walk = Math.abs(dx) >= Math.abs(dy) ? Math.sign(dx) : 0; }
        placeSprite(s);
      }
    } else if (cardSlug === s.e.slug) { /* its card is open: it stays for you */ }
    else if (now > s.until) { dropSprite(s, true); return; }
    else if (now > s.rest) {
      const held = heldBy(s);
      // off the route (a QA walk stood it somewhere): back to the nearest free place first
      const next = s.node >= 0
        ? R.links.filter((l) => l[0] === s.node || l[1] === s.node).map((l) => (l[0] === s.node ? l[1] : l[0])).filter((j) => !held.has(j))
        : R.pts.map((q, i) => i).filter((i) => !held.has(i)).sort((a, b) => Math.hypot(R.pts[a][0] - s.x, R.pts[a][1] - s.y) - Math.hypot(R.pts[b][0] - s.x, R.pts[b][1] - s.y)).slice(0, 1);
      if (next.length) { s.leg = next[Math.floor(Math.random() * next.length)]; s.node = -1; }
      else s.rest = now + 2000;   // every way on is held: wait a moment
    }
  } else if (A.road) {
    const dir = Math.sign(s.to - s.x);
    if (s.rest > now) walk = 0;
    else if (!s.rested && (dir > 0 ? s.x >= s.pauseAt : s.x <= s.pauseAt)) { s.rested = 1; s.rest = now + 4000 + Math.random() * 5000; }
    else {
      s.x += dir * STROLL * dt;
      walk = dir; moving = true;
      if ((dir > 0 && s.x >= s.to) || (dir < 0 && s.x <= s.to)) { dropSprite(s); return; }
      placeSprite(s);
    }
  }
  // ⚠️ the engine's labels are inverted: 4/5 is the pair that visibly walks LEFT, 0/1 right (town-folk.js paint); walking
  // mostly up or down the screen is the front pair at the walking step, as the town's visitors do it
  if (now - s.bobAt > (moving ? 260 : 900)) { s.bobAt = now; s.bob = s.bob ? 0 : 1; }
  let f = walk < 0 ? 4 + s.bob : walk > 0 ? s.bob : 2 + s.bob;
  // ⭐ never a statue: now and then two bars of the dance, the way a resident at their post has them (§23)
  if (!moving && now > s.danceAt) {
    if (now < s.danceAt + 1600) f = Math.floor((now - s.danceAt) / 100) % 8;   // from its own first frame, each a whole 100 ms
    else s.danceAt = now + 7000 + Math.random() * 7000;
  }
  if (f !== s.drawn) {
    s.drawn = f;
    s.g.clearRect(0, 0, 150, 150);
    try { drawComposite(s.g, 150, f, s.fit); } catch (e) {}
  }
}
// ⭐ ON THE FRAME, like every other banana (Trym, 28 Sep 2026: "the echoes of other banana users walking by in the homestead
// are choppy in their movements, not fluid movement like normal"). A stroll was 8.4 px on a 120 ms beat: eight hops a second
// beside a yard that moves sixty times. The beat still brings one out; while one is out, the frame walks it.
const STROLL = 96;   // world px a second: a stroll, the town's visitors' own pace (town-folk.js WALK)
let raf = 0, lastAt = 0;
function tickEchoes() {
  if (document.hidden || !rows.length) return;
  dropHere();
  const now = performance.now();
  if (now > nextAt) { nextAt = now + 14000 + Math.random() * 16000; spawnEcho(now); }
  if (out.size && !raf) { lastAt = 0; raf = requestAnimationFrame(frameEchoes); }
}
function frameEchoes(now) {
  raf = 0;
  if (!out.size || document.hidden) return;
  const dt = lastAt ? Math.min(0.05, (now - lastAt) / 1000) : 0;
  lastAt = now;
  for (const s of [...out.values()]) stepSprite(s, now, dt);
  raf = requestAnimationFrame(frameEchoes);
}

// ---- a tap on a banana: an echo opens its card, a player here gets a wave ------------------------------------------------
// ⚠️ AT THE DOCUMENT, IN CAPTURE, because every area listens differently: the town on pointerdown, the others on click,
// the steer on touchstart. Stopped here, none of them sees a tap that landed on a banana, and every other tap is theirs.
const BODY = [0.26, 0.12, 0.74, 0.92];   // the part of a banana's square canvas that is banana (x0, y0, x1, y1)
function hitAt(x, y) {
  if (!world || card) return null;
  const top = document.elementFromPoint(x, y);
  if (!top || !(world.contains(top) || top === view)) return null;   // a card, a note, the HUD: not the world under the finger
  let best = null, bz = -Infinity;
  for (const el of world.querySelectorAll('.bws-echo.is-on, [data-pid]')) {
    if (el.hidden) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || x < r.left + r.width * BODY[0] || x > r.left + r.width * BODY[2] || y < r.top + r.height * BODY[1] || y > r.top + r.height * BODY[3]) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const z = parseFloat(cs.zIndex) || 0;
    if (z > bz) { bz = z; best = el; }
  }
  return best;
}
function listen() {
  document.addEventListener('pointerdown', (e) => {
    press = null;
    quietUntil = 0;   // a new tap: whatever click the last one owed has come or never will
    if (list && !list.hidden && !root.contains(e.target)) { closeList(); e.stopPropagation(); quietUntil = performance.now() + 700; return; }
    if (e.button > 0) return;
    const el = hitAt(e.clientX, e.clientY);
    if (!el) return;
    press = { el, x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
    e.stopPropagation();
  }, true);
  document.addEventListener('touchstart', (e) => { if (press && performance.now() - press.t < 120) e.stopPropagation(); }, true);
  document.addEventListener('pointerup', (e) => {
    const p = press;
    press = null;
    if (!p || e.pointerId !== p.id) return;
    e.stopPropagation();
    quietUntil = performance.now() + 700;
    if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > 16 || performance.now() - p.t > 900) return;
    if (p.el.dataset.pid) liveWave(p.el);
    else { const x = rows.find((r) => r.slug === p.el.dataset.slug); if (x) openEcho(x); }
  }, true);
  // ⚠️ the ONE click that follows a tap we took is ours too (it would land on the card that just opened under the finger,
  // or walk the banana) — exactly one: a quick second tap on the card's Wave is a tap, not an echo of the first
  document.addEventListener('click', (e) => { if (quietUntil && performance.now() < quietUntil) { quietUntil = 0; e.stopPropagation(); e.preventDefault(); } }, true);

  // 👋 a wave in the room you are in: the waver's hand goes up, and one for you rings the badge
  document.addEventListener('world:wave', (ev) => {
    const d = ev.detail || {};
    const el = d.id ? world.querySelector('[data-pid="' + String(d.id).replace(/[^a-z0-9-]/gi, '') + '"]') : null;
    if (el) hand(el);
    if (!d.to || d.to !== d.me) return;
    notes.unshift({ k: 'wave', n: d.name || '', t: Date.now(), pid: d.id, live: 1 });
    track('wave_got', { area });
    welcome(true);
    ring();
    render();
  });
  // 🚶 the town's visitors ask for an echo to wear as they come in off the road, and say when they have gone home
  document.addEventListener('world:echo', (ev) => {
    if (!A.own || !ev.detail) return;
    const e = takeEcho();
    if (e) { out.set(e.slug, { e }); ev.detail.echo = e; }
  });
  document.addEventListener('world:echo-gone', (ev) => { if (A.own) out.delete(ev.detail); });
}

const meEl = () => document.querySelector(A.me);
// ✋ the hand goes up beside a banana's head. An <img>, because a banana carries no words and no markup (the Quiet Rule's walk)
// the layer's look, once — whoever needs it first (an area booting the layer, or the town's welcome raising Nib's hand)
let styled = false;
function style() { if (styled) return; styled = true; const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st); }
export function raiseHand(el) { style(); hand(el); }   // 👋 for the town's welcome: Nib waves at a new banana (town-welcome.js)
function hand(el) {
  if (!el) return;
  const old = el.querySelector(':scope > .bws-hand');
  if (old) old.remove();
  const img = document.createElement('img');
  img.className = 'bws-hand';
  img.alt = '';
  img.src = HAND_URI;
  el.appendChild(img);
  setTimeout(() => img.remove(), 1700);
}
function liveWave(el) {
  const now = performance.now();
  if (now - lastLive < 1600) return;   // the room's own gap, so a double tap is one wave
  const d = { to: el.dataset.pid, sent: false };
  document.dispatchEvent(new CustomEvent('world:wave-out', { detail: d }));
  if (!d.sent) return;
  lastLive = now;
  hand(meEl());
  track('wave_live', { area });
  if (el.dataset.new) track('wave_welcome', { area, live: 1 });   // 🌱 a regular said hello to a new banana
  welcome();
}

// ---- an echo's card -------------------------------------------------------------------------------------------------
// waist-up, the dialogue card's own crop — or, for the list's round coins, `head` and shoulders
const CROP = { card: [1.5, 0.167, 0.22], head: [2, 0.25, 0.12] };
function portrait(cv, fit, head) {
  assetsReady().then(() => {
    const g = cv.getContext('2d'), S = cv.width, [k, tx, ty] = head ? CROP.head : CROP.card;
    g.clearRect(0, 0, S, S);
    g.save(); g.scale(k, k); g.translate(-S * tx, -S * ty);
    try { drawComposite(g, S, 2, fit); } catch (e) {}
    g.restore();
  }).catch(() => {});
}
const when = (d) => (d <= 0 ? W.card.when.today : d === 1 ? W.card.when.yesterday : fillWords(W.card.when.days, { n: d }));
function closeCard() {
  if (veil) veil.remove();
  if (card) card.remove();
  veil = card = null;
  cardSlug = '';
}
// 🃏 THE CARD, one shape for everything the social layer shows (an echo, Nib's present): a veil that closes it, a ✕, the
// portrait over its corner, and every tap kept off the world until it closes
function showCard(label, inner) {
  closeCard();
  closeList();
  veil = document.createElement('div');
  veil.className = 'bws-veil';
  card = document.createElement('div');
  card.className = 'bws-card';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', label);
  card.innerHTML = '<button type="button" class="bws-x" aria-label="' + esc(W.card.close) + '">' + ico(CLOSE, 18) + '</button>'
    + '<div class="bws-pop" aria-hidden="true"><canvas width="300" height="300"></canvas></div>' + inner;
  view.appendChild(veil);
  view.appendChild(card);
  for (const n of [veil, card]) for (const t of ['pointerdown', 'touchstart', 'click']) n.addEventListener(t, (ev) => ev.stopPropagation());
  veil.addEventListener('click', closeCard);
  card.querySelector('.bws-x').addEventListener('click', closeCard);
  return card;
}
function openEcho(e) {
  track('wave_card', { area });
  const done = sentToday(e.slug);
  showCard(e.n, '<h2><span class="bws-nm' + (e.nw ? ' has-new' : '') + '">' + esc(e.n) + (e.nw ? '<span class="bws-new">' + esc(W.card.new) + '</span>' : '') + '</span></h2>'
    + '<p class="bws-role">' + esc(when(e.d | 0)) + '</p>'   // ✂️ when, not the farm's name: Visit farm goes there, and a long name wrapped
    + '<p class="bws-say">' + esc(fillWords(W.card.away, { name: e.n })) + '</p>'
    + '<div class="bws-row"><button type="button" class="bws-go"' + (done ? ' disabled' : '') + '>' + handSvg('currentColor') + '<span>' + esc(done ? W.card.waved : W.card.wave) + '</span></button>'
    + '<a class="bws-alt" href="/homestead/?yard=' + encodeURIComponent(e.slug) + '"' + (e.house ? ' aria-label="' + esc(W.card.visit + ': ' + e.house) + '"' : '') + '>' + ico(HOUSE, 16) + '<span>' + esc(W.card.visit) + '</span></a></div>'
    + '<p class="bws-note" hidden></p>');
  portrait(card.querySelector('canvas'), DRAW(e.fit));
  cardSlug = e.slug;
  card.querySelector('.bws-alt').addEventListener('click', () => track('wave_visit', { area, from: 'echo' }));
  const go = card.querySelector('.bws-go');
  go.addEventListener('click', () => echoWave(e, go));
}
async function echoWave(e, go) {
  if (go.disabled) return;
  go.disabled = true;
  hand(meEl());
  const r = await post('/wave', { to: e.slug, n: myName(), fit: myFit() }, true);
  const label = go.querySelector('span');
  const note = go.closest('.bws-card') && go.closest('.bws-card').querySelector('.bws-note');
  if (r.ok) {
    markSent(e.slug);
    if (label) label.textContent = W.card.waved;
    if (!r.again) { track('wave_echo', { area }); if (e.nw) track('wave_welcome', { area, live: 0 }); welcome(); }
    return;
  }
  if (r.status !== 429) go.disabled = false;
  if (note) { note.textContent = r.status === 429 ? W.card.enough : W.card.off; note.hidden = false; }
}

// ---- the waves badge and its list --------------------------------------------------------------------------------------
// ⭐ IT NEVER STARTS EMPTY: the first wave you send (or the first that comes for you) brings Nib's welcome with it, so the
// icon has said what it is for before a wave from somebody else ever lands in it.
function welcome(under) {
  const s = read();
  if (s.wf) return;
  const t = under && notes.length ? Math.min(...notes.map((x) => x.t)) - 1 : Date.now();
  write({ wf: t });
  notes.push({ k: 'hi', t });
  notes.sort((a, b) => b.t - a.t);
  if (!under) ring();
  render();
}
const isNew = (x) => (x.k === 'hi' ? !read().w : x.t > Math.max(seen, openedAt));
// ONE ROW PER PERSON (the mailbox's own rule): their newest wave; notes are kept newest first
const rowsOf = () => { const had = new Set(); return notes.map((x, i) => [x, i]).filter(([x]) => { if (x.k === 'hi') return true; const k = keyOf(x); if (!k) return true; if (had.has(k)) return false; had.add(k); return true; }); };
const unread = () => rowsOf().filter(([x]) => isNew(x)).length;
function ring() {
  if (!root) return;
  root.classList.remove('is-ring');
  void root.offsetWidth;
  root.classList.add('is-ring');
}
function ago(t) {
  const m = Math.max(0, Math.floor((Date.now() - t) / 60000));
  if (m < 2) return W.list.when.now;
  if (m < 60) return fillWords(W.list.when.mins, { n: m });
  if (m < 60 * 24) return fillWords(W.list.when.hours, { n: Math.floor(m / 60) });
  const d = Math.floor(m / 1440);
  return d === 1 ? W.list.when.yesterday : fillWords(W.list.when.days, { n: d });
}
const livePeer = (pid) => (pid ? world.querySelector('[data-pid="' + String(pid).replace(/[^a-z0-9-]/gi, '') + '"]') : null);
const keyOf = (x) => x.s || x.h || x.pid || '';
function render() {
  if (!root) return;
  const n = unread();
  root.querySelector('.bws__n').textContent = n ? String(Math.min(n, 9)) : '';
  const was = root.hidden;
  root.hidden = !(n || openedAt);
  if (was && !root.hidden) placeBadge();   // placed the moment it shows, never a beat later where it first appeared
  if (!list.hidden) fill();
}
function fill() {
  list.querySelector('ol').innerHTML = rowsOf().map(([x, i]) => {
    if (x.k === 'hi') return '<li class="bws-li is-hi' + (isNew(x) ? ' is-new' : '') + '"><canvas width="120" height="120" data-i="' + i + '"></canvas><p>' + esc(W.list.welcome) + '<small>' + esc(W.list.nib) + '</small></p></li>';
    const can = x.live ? !!livePeer(x.pid) : !!(x.s || x.h);
    const done = answered(keyOf(x), x.t);
    return '<li class="bws-li' + (isNew(x) ? ' is-new' : '') + '"><canvas width="120" height="120" data-i="' + i + '"></canvas>'
      + '<p><b>' + esc(x.n || W.list.someone) + '</b><small>' + esc(ago(x.t))
      + (x.s ? ' · <a class="bws-home" href="/homestead/?yard=' + encodeURIComponent(x.s) + '">' + esc(W.list.visit) + '</a>' : '') + '</small></p>'
      + (can ? '<button type="button" class="bws-back" data-i="' + i + '"' + (done ? ' disabled' : '') + '>' + esc(done ? W.list.backed : W.list.back) + '</button>' : '<span></span>')
      + '</li>';
  }).join('');
  for (const cv of list.querySelectorAll('canvas')) {
    const x = notes[+cv.dataset.i];
    if (!x) continue;
    const peer = x.live && livePeer(x.pid);
    const pc = peer && peer.querySelector('canvas');
    if (pc) { const g = cv.getContext('2d'), [k, tx, ty] = CROP.head; g.save(); g.scale(k, k); g.translate(-cv.width * tx, -cv.width * ty); g.drawImage(pc, 0, 0, cv.width, cv.width); g.restore(); }
    else portrait(cv, DRAW(x.k === 'hi' ? NIB : x.fit), true);
  }
  const me = list.querySelector('.bws-me');
  if (me) me.remove();
  if (echoOn === 0 || echoOn === 1) {
    const l = document.createElement('label');
    l.className = 'bws-me';
    l.innerHTML = '<input type="checkbox"' + (echoOn ? ' checked' : '') + '><span>' + esc(W.list.me) + '</span>';
    list.appendChild(l);
  }
}
function openList() {
  const n = unread();
  closeCard();
  openedAt = Date.now();
  list.hidden = false;
  root.classList.add('is-open');
  root.querySelector('.bws__b').setAttribute('aria-expanded', 'true');
  const vr = view.getBoundingClientRect(), lr = list.getBoundingClientRect();
  list.style.setProperty('--bws-max', Math.max(140, Math.round(vr.bottom - lr.top - 16)) + 'px');
  fill();
  write({ w: 1 });
  track('wave_list', { area, n });
  post('/notices', { seen: 1 });
  render();
}
function closeList() {
  if (!list || list.hidden) return;
  list.hidden = true;
  root.classList.remove('is-open');
  root.querySelector('.bws__b').setAttribute('aria-expanded', 'false');
  render();
}
async function waveBack(x, btn) {
  btn.disabled = true;
  if (x.live) {
    const el = livePeer(x.pid);
    const d = { to: x.pid, sent: false };
    if (el) document.dispatchEvent(new CustomEvent('world:wave-out', { detail: d }));
    if (!d.sent) { btn.disabled = false; return; }
  } else {
    const r = await post('/wave', { ...(x.s ? { to: x.s } : { h: x.h }), n: myName(), fit: myFit() }, true);
    if (!r.ok) { if (r.status !== 429) btn.disabled = false; return; }
  }
  markSent(keyOf(x));
  btn.textContent = W.list.backed;
  hand(meEl());
  track('wave_back', { area, live: x.live ? 1 : 0 });
}
function mountBadge() {
  root = document.createElement('div');
  root.className = 'bws';
  root.hidden = true;
  root.innerHTML = '<button type="button" class="bws__b" aria-label="' + esc(W.list.title) + '" aria-expanded="false">' + handSvg('#ffe135') + '<span class="bws__n"></span></button>'
    + '<div class="bws-list" hidden role="dialog" aria-label="' + esc(W.list.title) + '"><ol></ol></div>';
  view.appendChild(root);
  list = root.querySelector('.bws-list');
  for (const t of ['pointerdown', 'touchstart']) root.addEventListener(t, (e) => e.stopPropagation());
  root.querySelector('.bws__b').addEventListener('click', (e) => { e.stopPropagation(); if (list.hidden) openList(); else closeList(); });
  list.addEventListener('click', (e) => {
    e.stopPropagation();
    const b = e.target.closest('.bws-back');
    if (b && !b.disabled) { const x = notes[+b.dataset.i]; if (x) waveBack(x, b); return; }
    if (e.target.closest('.bws-home')) track('wave_visit', { area, from: 'list' });
  });
  list.addEventListener('change', async (e) => {
    const box = e.target.closest('.bws-me input');
    if (!box) return;
    const on = box.checked ? 1 : 0;
    const r = await post('/echo', { on });
    if (r.ok) { echoOn = r.echo; track(on ? 'wave_show' : 'wave_hide', { area }); } else box.checked = !on;
  });
  // under the notes above it, never on them: the quest note, the town's work note, the pager (§28, §42)
  setInterval(placeBadge, 700);
  placeBadge();
}
const NOTES = [['.bwq-hint', '.bwq-hint__badge'], ['.twd-chip', '.twd-chip__badge'], ['.wkp', '.wkp__b']];
function placeBadge() {
  if (!root || root.hidden) return;
  const vr = view.getBoundingClientRect();
  let top = 48;
  // ⚠️ and under the HUD's chips where they reach this far left (the town's strip spans the width): the count pip
  // stands 22 px above the badge's anchor, so a badge first in the column sat on the town's LVL chip
  for (const c of document.querySelectorAll('.wh > *')) {
    const r = c.getBoundingClientRect();
    if (r.height && r.left < vr.left + 62 && r.right > vr.left + 4 && r.top >= vr.top - 4 && r.top < vr.top + 90) top = Math.max(top, Math.round(r.bottom - vr.top) + 24);
  }
  for (const [n, b] of NOTES) {
    const q = view.querySelector(n);
    if (!q || q.hidden || getComputedStyle(q).display === 'none') continue;
    const min = q.classList.contains('is-min');
    const r = (min ? q.querySelector(b) || q : q).getBoundingClientRect();
    if (!r.height) continue;
    top = Math.max(top, Math.round(r.bottom - vr.top) + (min ? 22 : 18));
  }
  root.style.top = top + 'px';
}
async function pollNotices() {
  if (!worldToken()) return;
  const r = await post('/notices', {});
  if (!Array.isArray(r.notices)) return;
  seen = Math.max(seen, r.seen || 0);
  echoOn = r.echo;
  const local = notes.filter((x) => x.live || x.k === 'hi');
  notes = [...r.notices.filter((x) => x.k === 'wave'), ...local].sort((a, b) => b.t - a.t);
  if (notes.some((x) => x.k === 'wave' && !x.live)) welcome(true);
  const n = unread();
  if (n && !waited) { waited = true; track('wave_waiting', { area, n }); }
  render();
}

export function bootSocial(name) {
  if (api) return api;
  const a = AREAS[name];
  if (!a) return null;
  view = document.querySelector(a.view);
  world = document.querySelector(a.world);
  if (!view || !world) return null;
  A = a; area = name;
  style();
  document.documentElement.style.setProperty('--bws-new', JSON.stringify(W.card.new));   // 🌱 the marker's word, from the copy file
  const s = read();
  if (s.wf && !s.w) notes.push({ k: 'hi', t: s.wf });   // a welcome not yet read waits for its first look
  mountBadge();
  listen();
  render();
  loadEchoes();
  setTimeout(pollNotices, 2500);
  setInterval(() => { if (!document.hidden) pollNotices(); }, 120000);
  if (!A.own) assetsReady().then(() => setInterval(tickEchoes, 120)).catch(() => {});
  else setInterval(() => { if (!document.hidden) dropHere(); }, 1000);   // 👥 the town's worn echoes: one whose player is here goes
  api = {
    seam: {
      echoes: () => rows.map((e) => e.slug),
      out: () => [...out.keys()],
      spawn: () => { if (!A.own) spawnEcho(performance.now()); return [...out.keys()]; },
      hold: () => { nextAt = Infinity; },   // QA: no echo comes out on its own clock while a walk is looking
      // QA: stand an echo at a world point (the walk cannot wait for one to land in view)
      put: (x, y, slug) => { const s = slug ? out.get(slug) : [...out.values()].pop(); if (!s || !s.el) return false; s.x = x; s.y = y; s.pauseAt = x; s.until = performance.now() + 120000; s.leg = null; s.node = -1; s.rest = s.until; placeSprite(s); return true; },
      // QA: every echo out steps off now (a walk cannot wait out the stand), and where each is
      stroll: () => { for (const s of out.values()) if (s.el) { s.rest = 0; s.until = Math.max(s.until || 0, performance.now() + 60000); } return out.size; },
      where: () => [...out.values()].filter((s) => s.el).map((s) => ({ slug: s.e.slug, x: s.x, y: s.y, node: s.node, leg: s.leg })),
      route: () => A.route || null,
      open: (slug) => { const e = rows.find((r) => r.slug === slug); if (e) openEcho(e); return !!e; },
      notes: () => notes.map((x) => ({ k: x.k, n: x.n || '', live: !!x.live, s: x.s || '', h: x.h || '', t: x.t })),
      unread,
      poll: pollNotices,
      list: () => (list.hidden ? openList() : closeList()),
      card: () => !!card,
    },
  };
  window.__bws = api.seam;
  // 🎁 NIB'S WELCOME PRESENT (world-gift.js): its own chunk, fetched only by somebody it can concern — a new banana, or
  // somebody whose present is still wrapped. It borrows this layer's card, portrait and words.
  const g = read().g;
  if ((worldNewcomer() && !g) || (g && !g.o && !g.none)) {
    import('./world-gift.js').then((m) => { const x = m.bootGift({ area, view, me: meEl, read, write, track, esc, showCard, closeCard, portrait, DRAW, NIB, myName,
      busy: () => !!card || (list && !list.hidden) }); window.__bwg = x && x.seam; }).catch(() => {});
  }
  return api;
}
