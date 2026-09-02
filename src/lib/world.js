// 🌍 BANANA WORLD — the shared primitives every room imports.
// Born from the keep-in-sync registry (banana-world-engineering): seedRand,
// the coin faucet, the smoke poof and the presence protocol used to live as
// hand-synced copies in banana-rave.js and banana-stand.js; now they live
// ONCE. CLIENT-ONLY module (reads location/localStorage).

// deterministic 0..1 from an integer — same math as worker-rave (Math.imul
// is exact); every clock-seeded spawn in the world derives from this
export function seedRand(n) {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

// 🪙 THE ONE COIN FAUCET — identical clock, odds and QA switch in every room.
// The claimed-window key `bc-win` is shared, so a window caught anywhere is
// caught everywhere (no double-dipping). Rooms roll their OWN spot salts.
export const COIN_TEST = typeof location !== 'undefined' && location.search.includes('cointest');
// ⚠️ retuned 29 Jul (Trym, HQ ledger read: "theres actually a shortage of
// coins") — 240min windows at EV 1.6 paid a daily visitor ~2-3 coins against
// 10-300 coin sinks. Hourly windows at EV ~4.8 → an active day pays 5-15:
// snail hat in 2-3 days, squid in ~2 weeks, golden wheat = a real saga.
export const COIN_PERIOD = COIN_TEST ? 30 : 60;
export const COIN_WAIT = COIN_TEST ? 24 : 18;
export const COIN_OFFSET = 150;
// (bumped again same day — Trym: "rather have more coins, than too little,
// i can always add things that cost money"; sinks are easy, faucets are hard)
export function coinAmountFor(w) { // 60% five / 30% ten / 10% twenty
  const r = seedRand(0xc01e * 7 + w);
  return r < 0.60 ? 5 : r < 0.90 ? 10 : 20;
}

// ⚠️ READ THE CLAIM AT CLAIM TIME, NEVER AT LOAD. Rooms snapshot `bc-win` into
// a module local when they start, so two tabs open on two rooms each hold a
// stale copy from before the other one caught anything — and the same window
// pays twice. Ask storage on the claim itself and "caught anywhere is caught
// everywhere" holds across tabs.
export function coinWinClaimed(w) {
  try { return parseInt(localStorage.getItem('bc-win') || '-1', 10) === w; } catch (e) { return false; }
}
// take window w — true only for the FIRST caller, in any tab, in any room
export function coinWinClaim(w) {
  if (coinWinClaimed(w)) return false;
  try { localStorage.setItem('bc-win', String(w)); } catch (e) {} // storage blocked never blocks a coin
  return true;
}

// the world-wide per-browser session id (localStorage key `park-sid` — the
// name is historic, the park minted it first). Joining a room with this sid
// SUPERSEDES your own ghost sockets server-side.
// ⚠️ MINTED ONCE PER PAGE. When storage is unreadable (private mode, a
// third-party frame) the fallback used to run on every call, so the connection
// id — and worldOwner() with it — changed between one request and the next: a
// new ghost in the room each ping, and nothing you claimed stayed yours.
let sidMem = '';
// 🎩 the signed member token (minted by worker-pass, verified by worker-rave):
// presented on hi/outfit so rooms let the supporter hat through sanitize and
// OTHER players see it. undefined = not a member; the token expires on its own.
export function memberTok() {
  try { return localStorage.getItem('bb-mtok') || undefined; } catch (e) { return undefined; }
}

export function worldSid() {
  if (sidMem) return sidMem;
  try {
    sidMem = localStorage.getItem('park-sid') || '';
    if (!sidMem) { sidMem = crypto.randomUUID().slice(0, 12); localStorage.setItem('park-sid', sidMem); }
  } catch (e) {}
  if (!sidMem) sidMem = String(Math.random()).slice(2, 14); // storage said no — memory holds it
  return sidMem;
}

// 🪪 WHO OWNS A THING, as opposed to WHO IS CONNECTED.
//
// ⚠⚠ worldSid() ABOVE IS A CONNECTION ID, NOT A PERSON. It is a random UUID
// per browser and the presence rooms depend on that — the sid-supersede
// contract kills your own ghost socket by matching it, so it MUST stay
// per-device. Using it for OWNERSHIP was the bug Jade found on 1 Aug 2026: the
// park garden keyed plots on it, so one human on two devices was two
// gardeners, could water the same plant twice, and could not harvest her own
// plants from the other device.
//
// worldOwner() is the answer to "whose is this": the pass's world id when
// signed in (stable across every device on the account), the local sid when
// not. Anonymous players are unchanged — they are still one-browser-one-player,
// which is the most anyone can promise without an account.
let noidSent = false;
export function worldOwner() {
  try {
    const gid = localStorage.getItem('world-gid');
    if (gid) return gid;
  } catch (e) {}
  // 🫧 no person-id yet: tell the pass module once, and it mints an anonymous
  // pass (banana-pass.js ensureAnon) so the NEXT write is a person's, not a
  // browser's. An event, not an import — banana-pass imports this file.
  if (!noidSent && typeof document !== 'undefined') {
    noidSent = true;
    try { document.dispatchEvent(new CustomEvent('world:noid')); } catch (e) {}
  }
  return worldSid();
}

// 🪪 THE WORLD TOKEN — proof, for the world workers, that this browser holds
// the pass behind worldOwner(). Minted by worker-pass on every pull/push
// (`gid.exp.aliases.sig`, 30 days) and kept next to the gid; the workers
// refuse a wrong one and, once WT_ENFORCE is on, an absent one. undefined =
// nothing to show (signed out, or a token that has run out).
export function worldToken() {
  try {
    const t = localStorage.getItem('world-wt') || '';
    return +(t.split('.')[1] || 0) > Date.now() ? t : undefined;
  } catch (e) { return undefined; }
}

// the three-frame smoke puff — leavers and expired pickups go in a puff,
// never a blink (art authored once for the rave floor, worn world-wide)
export const POOF_FRAMES = ['<svg viewBox="0 0 12 6" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="1" width="2" height="1" fill="#b8bcd0"/><rect x="3" y="2" width="1" height="1" fill="#b8bcd0"/><rect x="4" y="2" width="2" height="1" fill="#e8eaf2"/><rect x="6" y="2" width="1" height="1" fill="#b8bcd0"/><rect x="3" y="3" width="1" height="1" fill="#8890a8"/><rect x="4" y="3" width="2" height="1" fill="#e8eaf2"/><rect x="6" y="3" width="1" height="1" fill="#8890a8"/><rect x="4" y="4" width="2" height="1" fill="#8890a8"/></svg>', '<svg viewBox="0 0 12 6" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="0" width="2" height="1" fill="#b8bcd0"/><rect x="7" y="0" width="1" height="1" fill="#b8bcd0"/><rect x="1" y="1" width="1" height="1" fill="#b8bcd0"/><rect x="2" y="1" width="2" height="1" fill="#e8eaf2"/><rect x="4" y="1" width="1" height="1" fill="#b8bcd0"/><rect x="6" y="1" width="1" height="1" fill="#b8bcd0"/><rect x="7" y="1" width="1" height="1" fill="#8890a8"/><rect x="8" y="1" width="1" height="1" fill="#b8bcd0"/><rect x="0" y="2" width="1" height="1" fill="#b8bcd0"/><rect x="1" y="2" width="1" height="1" fill="#8890a8"/><rect x="2" y="2" width="3" height="1" fill="#e8eaf2"/><rect x="5" y="2" width="1" height="1" fill="#b8bcd0"/><rect x="6" y="2" width="1" height="1" fill="#8890a8"/><rect x="7" y="2" width="1" height="1" fill="#e8eaf2"/><rect x="8" y="2" width="1" height="1" fill="#8890a8"/><rect x="1" y="3" width="1" height="1" fill="#8890a8"/><rect x="2" y="3" width="2" height="1" fill="#e8eaf2"/><rect x="4" y="3" width="1" height="1" fill="#8890a8"/><rect x="5" y="3" width="3" height="1" fill="#e8eaf2"/><rect x="8" y="3" width="1" height="1" fill="#8890a8"/><rect x="2" y="4" width="2" height="1" fill="#8890a8"/><rect x="4" y="4" width="1" height="1" fill="#b8bcd0"/><rect x="5" y="4" width="2" height="1" fill="#e8eaf2"/><rect x="7" y="4" width="1" height="1" fill="#8890a8"/><rect x="4" y="5" width="3" height="1" fill="#8890a8"/></svg>', '<svg viewBox="0 0 12 6" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="1" height="1" fill="#8890a8" opacity="0.6"/><rect x="1" y="0" width="1" height="1" fill="#b8bcd0" opacity="0.6"/><rect x="5" y="0" width="1" height="1" fill="#b8bcd0" opacity="0.6"/><rect x="9" y="0" width="1" height="1" fill="#8890a8" opacity="0.6"/><rect x="0" y="1" width="1" height="1" fill="#b8bcd0" opacity="0.6"/><rect x="2" y="1" width="1" height="1" fill="#8890a8" opacity="0.6"/><rect x="4" y="1" width="1" height="1" fill="#b8bcd0" opacity="0.6"/><rect x="6" y="1" width="1" height="1" fill="#b8bcd0" opacity="0.6"/><rect x="3" y="2" width="1" height="1" fill="#b8bcd0" opacity="0.6"/><rect x="7" y="2" width="1" height="1" fill="#8890a8" opacity="0.6"/><rect x="9" y="2" width="1" height="1" fill="#b8bcd0" opacity="0.6"/><rect x="0" y="3" width="1" height="1" fill="#8890a8" opacity="0.6"/><rect x="3" y="3" width="1" height="1" fill="#b8bcd0" opacity="0.6"/><rect x="5" y="3" width="1" height="1" fill="#8890a8" opacity="0.6"/><rect x="2" y="4" width="1" height="1" fill="#8890a8" opacity="0.6"/><rect x="7" y="4" width="1" height="1" fill="#b8bcd0" opacity="0.6"/><rect x="10" y="4" width="1" height="1" fill="#8890a8" opacity="0.6"/></svg>'];

// stamp the puff into a container at (x%, y%) — caller owns the CSS class
// (.rv-poof / .bs-poof share the same three-span steps() choreography)
export function poofInto(container, className, x, y, extraStyle) {
  const d = document.createElement('div');
  d.className = className;
  d.style.left = x + '%';
  d.style.top = y + '%';
  if (extraStyle) d.style.cssText += extraStyle;
  d.innerHTML = '<span class="' + className + '__1">' + POOF_FRAMES[0] + '</span>' +
    '<span class="' + className + '__2">' + POOF_FRAMES[1] + '</span>' +
    '<span class="' + className + '__3">' + POOF_FRAMES[2] + '</span>';
  container.appendChild(d);
  setTimeout(() => d.remove(), 750);
  return d;
}

// 🌐 THE PRESENCE ROOM — the client half of the room protocol contract
// (banana-world-engineering): connect, hi{sid,...}, ping keepalive, retry
// with backoff, respect 'superseded' (never reconnect-fight), clean pagehide
// goodbye. Every future room joins through this.
export function presenceRoom({ url, hi, onMessage, onDown, retries = 5, pingMs = 25000 }) {
  let ws = null, tries = 0, closedForGood = false;
  function connect() {
    if (closedForGood) return;
    let sock;
    try { sock = new WebSocket(url); } catch (e) { return; }
    ws = sock;
    sock.onopen = () => {
      tries = 0;
      // 🪪 the OWNER rides along so a person shows up ONCE, not once per
      // device — the room supersedes an older socket for the same account.
      sock.send(JSON.stringify({ t: 'hi', sid: worldSid(), own: worldOwner(), mt: memberTok(), ...hi() }));
    };
    sock.onmessage = (ev) => {
      let m;
      try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m && m.t !== 'pong') onMessage(m);
    };
    sock.onclose = (ev) => {
      if (ws !== sock) return;
      ws = null;
      if (onDown) onDown();
      if (closedForGood || (ev && ev.reason === 'superseded')) return; // a newer you took over
      if (tries++ < retries) setTimeout(connect, 4000 * tries);
    };
    sock.onerror = () => { try { sock.close(); } catch (e) {} };
  }
  connect();
  const pinger = setInterval(() => { if (ws && ws.readyState === 1) ws.send('{"t":"ping"}'); }, pingMs);
  // navigation/tab-close backstop: close the socket but do NOT latch
  // closedForGood — a bfcache/app-switch restore must be able to rejoin
  // (a real unload destroys the page anyway, so nothing can reconnect-fight)
  addEventListener('pagehide', () => {
    try { if (ws) ws.close(1000, 'bye'); } catch (e) {}
  });
  // 📱 coming back from the background: mobile OSes kill idle sockets, and the
  // retry budget may have burned out while hidden — without this a returning
  // player reads "solo" until reload. Reset the budget and rejoin on return
  // (the rave's own socket had this; now every presenceRoom room does).
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !closedForGood && (!ws || ws.readyState > 1)) { tries = 0; connect(); }
  });
  return {
    // 🎩 outfit changes re-present the member token — the worker verifies per
    // message, so a wardrobe change mid-visit keeps the supporter hat visible
    send(obj) {
      if (!(ws && ws.readyState === 1)) return;
      if (obj && obj.t === 'outfit') obj = { mt: memberTok(), ...obj };
      ws.send(JSON.stringify(obj));
    },
    get live() { return !!ws && ws.readyState === 1; },
    // 🚪 leave NOW, don't wait for pagehide. Walking out a door runs a cut
    // animation before navigating, and pagehide only fires when the nav
    // actually happens — so the socket closes ~200ms late and other players
    // watch you stand frozen for that beat. Closing here makes the poof land
    // the instant you commit to leaving. (pagehide is still the backstop for
    // tab-close and hard exits.)
    leave() { closedForGood = true; clearInterval(pinger); try { if (ws) ws.close(1000, 'bye'); } catch (e) {} },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 🌦 THE WEATHER CLOCK — a PURE FUNCTION OF TIME. No state, no cron, no sync
// message: the client renders from it and the ParkRoom charges health from it,
// and they agree because they run the same arithmetic over the same clock.
// (The coin-window pattern, one level up.)
// ⚠️⚠️ MIRRORED VERBATIM IN worker-rave/src/index.js — CHANGE BOTH OR NEITHER.
//
// ⚠️ EVENTS PER DAY, NOT DICE PER WINDOW. Rolling weather every 20 minutes is
// 72 draws a day, so even a 5% chance compounds to near-certainty and hand-
// watering dies no matter how short the watering window is. The window length
// was never the lever — the SHAPE of the rain is. Each DAY seeds its events,
// so weather comes in FRONTS: dry days, changeable days, wet days, and real dry
// stretches between them. Those dry stretches are why watering still matters.
//
// Simulated over 730 days before shipping (tools note, 30 Jul):
//   heavy rain every 2.9 days · storms every 17.1 days
//   drizzle on screen 7.3% of the time · heavy 0.49% · storm 0.04%
// You will rarely catch a storm live — but you will often walk into what it
// did, because the wreckage stays until somebody clears it. That asymmetry is
// the design, not a side effect.
export const WEATHER_SALT = 0x7a1e;
export const WEATHER_DAY_MS = 86400000;
const WEATHER_MINS = { drizzle: [30, 62], heavy: [15, 26], storm: [8, 13] };

// 🌩 SCHEDULED STORMS — hand-placed weather sitting on top of the seeded clock.
// Still a pure function of time: the table IS part of the function, so the park
// and the ParkRoom keep agreeing without a single message.
//
// Why this exists: in the first TWELVE DAYS live, not one storm fired — computed
// over the real function, not sampled. The seeded rate was one per ~17.8 days,
// 8-13 minutes long. The most dramatic thing the park can do had never once
// happened. This is how we fire one on purpose — for a launch, an event, or a
// quest beat that needs the tide to have thrown something up the beach.
// ⚠️⚠️ MIRRORED VERBATIM IN worker-rave/src/index.js — CHANGE BOTH OR NEITHER.
const STORMS_SCHEDULED = [
  [Date.UTC(2026, 7, 9, 14, 0), 15],   // 9 Aug 16:00 CEST — the park's first storm
];

// one day of weather, from its day index alone
export function weatherDay(d) {
  const r = seedRand(WEATHER_SALT + d * 7919);
  const kind = r < 0.45 ? 'dry' : r < 0.80 ? 'changeable' : 'wet';
  const nDrizzle = kind === 'dry' ? 1 : kind === 'changeable' ? 3 : 4;
  const heavy = kind === 'wet' ? 1
    : (kind === 'changeable' && seedRand(WEATHER_SALT + d * 401) < 0.40 ? 1 : 0);
  // ⚠️ RETUNED 9 Aug (Trym: "it can trigger once or twice a week"). Was an
  // extra 0.30 roll ON TOP of the 20% wet-day chance = 6%/day = one per 17.8
  // days, which is why zero had ever landed. A wet day is now simply THE stormy
  // day: 20%/day ≈ one every 5 days. The park recovers fast when worked
  // (watering pays +2 a slot, so a 64-slot garden is +128 bloom), so a storm
  // makes chores rather than damage — and chores are the park's actual game.
  const storm = kind === 'wet' ? 1 : 0;
  const types = [];
  for (let i = 0; i < nDrizzle; i++) types.push('drizzle');
  for (let i = 0; i < heavy; i++) types.push('heavy');
  for (let i = 0; i < storm; i++) types.push('storm');
  const n = types.length, out = [];
  for (let i = 0; i < n; i++) {
    const type = types[i], [lo, hi] = WEATHER_MINS[type];
    const ms = Math.round((lo + seedRand(WEATHER_SALT + d * 313 + i * 53) * (hi - lo)) * 60000);
    // one slot each, so two events can never overlap
    const slot = WEATHER_DAY_MS / n;
    const at = Math.floor(i * slot + seedRand(WEATHER_SALT + d * 131 + i * 17) * Math.max(0, slot - ms));
    out.push({ type, at, ms });
  }
  // 🌩 merge in anything hand-scheduled for this day. Doing it HERE and not in
  // weatherAt is the whole point: weatherBetween walks weatherDay too, and that
  // is what the ParkRoom charges health from on its lazy read. Patch only the
  // renderer and the sky storms while nothing takes a scratch.
  for (const [when, mins] of STORMS_SCHEDULED) {
    const sd = Math.floor(when / WEATHER_DAY_MS);
    if (sd !== d) continue;
    const s = { type: 'storm', at: when - sd * WEATHER_DAY_MS, ms: mins * 60000 };
    // a scheduled storm CLEARS the sky it lands in — events are read first-match
    // in time order, so an overlapping seeded drizzle would otherwise sort ahead
    // of it and weatherAt would answer "drizzle" for the whole window
    for (let i = out.length - 1; i >= 0; i--) {
      if (out[i].at < s.at + s.ms && s.at < out[i].at + out[i].ms) out.splice(i, 1);
    }
    out.push(s);
  }
  return out.sort((a, b) => a.at - b.at);
}

// what is falling at t? → { type:'clear'|'drizzle'|'heavy'|'storm', since, left }
export function weatherAt(t) {
  const d = Math.floor(t / WEATHER_DAY_MS);
  const inDay = t - d * WEATHER_DAY_MS;
  for (const e of weatherDay(d)) {
    if (inDay >= e.at && inDay < e.at + e.ms) {
      return { type: e.type, since: inDay - e.at, left: e.at + e.ms - inDay };
    }
  }
  return { type: 'clear', since: 0, left: 0 };
}

// every event that STARTED in (from, to] — the ParkRoom walks this on its lazy
// read, so weather nobody was present for still lands
export function weatherBetween(from, to) {
  const out = [];
  for (let d = Math.floor(from / WEATHER_DAY_MS); d <= Math.floor(to / WEATHER_DAY_MS); d++) {
    for (const e of weatherDay(d)) {
      const at = d * WEATHER_DAY_MS + e.at;
      if (at > from && at <= to) out.push({ type: e.type, at, ms: e.ms });
    }
  }
  return out.sort((a, b) => a.at - b.at);
}
