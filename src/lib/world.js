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
export const COIN_PERIOD = COIN_TEST ? 30 : 240;
export const COIN_WAIT = COIN_TEST ? 24 : 18;
export const COIN_OFFSET = 150;
export function coinAmountFor(w) { // 70% one / 25% three / 5% five
  const r = seedRand(0xc01e * 7 + w);
  return r < 0.70 ? 1 : r < 0.95 ? 3 : 5;
}

// the world-wide per-browser session id (localStorage key `park-sid` — the
// name is historic, the park minted it first). Joining a room with this sid
// SUPERSEDES your own ghost sockets server-side.
export function worldSid() {
  let sid = '';
  try {
    sid = localStorage.getItem('park-sid') || '';
    if (!sid) { sid = crypto.randomUUID().slice(0, 12); localStorage.setItem('park-sid', sid); }
  } catch (e) { sid = String(Math.random()).slice(2, 14); }
  return sid;
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
      sock.send(JSON.stringify({ t: 'hi', sid: worldSid(), ...hi() }));
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
  addEventListener('pagehide', () => {
    closedForGood = true;
    clearInterval(pinger);
    try { if (ws) ws.close(1000, 'bye'); } catch (e) {}
  });
  return {
    send(obj) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj)); },
    get live() { return !!ws && ws.readyState === 1; },
  };
}
