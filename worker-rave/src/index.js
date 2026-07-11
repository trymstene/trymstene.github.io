// Banana rave worker — the realtime dance floor.
//
// The trick that makes this nearly free: the dance itself needs ZERO server
// traffic. Every banana on Earth dances in phase off the wall clock
// (t = Date.now() % cycle). The server only does PRESENCE: who's on the
// floor (outfit ids + join time) and the occasional emote. A rave is,
// technically, a chat room where nobody talks.
//
// Moderation surface: NONE by design — outfits are validated against the
// id allowlists below (no free text anywhere), emotes are a fixed set.
//
// Cost guardrails: WebSocket hibernation (idle connections ≈ free), room cap,
// per-connection emote throttle, Origin allowlist. Free plan fails closed.
//
// Routes:
//   GET /ws      upgrade → the room ("main-floor")
//   GET /count   current floor count (for the homepage proof-of-life later)

// ⚠️ MIRROR of the single-source catalog in src/data/wearables.js — a separate
// worker bundle can't import site source, so these are copied by hand. The
// canonical order: edit wearables.js, then paste here. EXTRA_IDS === its
// CLIENT_EXTRA_IDS export (non-raveOnly extras); raveOnly items (beer/cone/
// vinyl/broom) are server-granted and MUST stay out so sanitize strips them.
const HAT_IDS = ['none', 'party', 'crown', 'tophat', 'cowboy'];
const SHADE_IDS = ['none', 'shades', 'hearts', 'visor'];
const EXTRA_IDS = ['mustache', 'bowtie', 'sneakers', 'sneakersblue', 'sneakersgold', 'glowstick', 'goldbanana'];
const EFFECT_IDS = ['none', 'disco', 'sparkle', 'confetti'];
const EMOTES = ['heart', 'confetti', 'banana', 'fire']; // fire = stage members only
const ROOM_CAP = 200;
const STAGE_CAP = 8;                  // spots on the line behind the DJ
const STAGE_MIN_MS = 5 * 60 * 1000;   // survive 5 min on the floor → the stage opens (keep in sync with STAGE_UNLOCK_MS in banana-rave.js)
// HAPPY HOUR — same wall-clock windows as the client (keep in sync with banana-rave.js).
// One beer per window, first claim wins; the beer lives in outfit.extras but is
// SERVER-GRANTED only ('beer' is deliberately NOT in EXTRA_IDS → sanitize strips it).
const HAPPY_PERIOD = 300_000, HAPPY_LEN = 40_000, HAPPY_OFFSET = 120_000;
function happyWindow(now) {
  const ph = (((now - HAPPY_OFFSET) % HAPPY_PERIOD) + HAPPY_PERIOD) % HAPPY_PERIOD;
  return ph < HAPPY_LEN ? Math.floor((now - HAPPY_OFFSET) / HAPPY_PERIOD) : -1;
}
// THE LOST VINYL — courier quest (keep schedule + spot math in sync with banana-rave.js):
// spawns every 7 min at a clock-seeded spot, first banana to reach it carries it,
// delivering to the stage edge buys the whole floor a bonus drop.
const VINYL_PERIOD = 420_000, VINYL_WAIT = 180_000, VINYL_OFFSET = 210_000;
function vinylWindow(now) {
  const ph = (((now - VINYL_OFFSET) % VINYL_PERIOD) + VINYL_PERIOD) % VINYL_PERIOD;
  return ph < VINYL_WAIT ? Math.floor((now - VINYL_OFFSET) / VINYL_PERIOD) : -1;
}
function seedRand(n) {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}
function vinylSpot(w) {
  let x = 12 + seedRand(0x5eed + w * 2) * 70;
  let y = 26 + seedRand(0x5eed + w * 2 + 1) * 46; // open floor only — high spawns near the stage edge were unreachable on iOS
  if (x < 36 && y > 66) y -= 30;
  return { x, y };
}
// HOT SAUCE — a bottle on the open floor every 4 min; grabbing it grants a timed
// flame-trail fx. fx is SERVER-GRANTED like the beer: clients only render what
// the roster says, so effects can't be spoofed.
const SAUCE_PERIOD = 180_000, SAUCE_WAIT = 100_000, SAUCE_OFFSET = 60_000;
function sauceWindow(now) {
  const ph = (((now - SAUCE_OFFSET) % SAUCE_PERIOD) + SAUCE_PERIOD) % SAUCE_PERIOD;
  return ph < SAUCE_WAIT ? Math.floor((now - SAUCE_OFFSET) / SAUCE_PERIOD) : -1;
}
function sauceSpot(w) {
  let x = 12 + seedRand(0xf1a5 + w * 2) * 70;
  let y = 26 + seedRand(0xf1a5 + w * 2 + 1) * 46;
  if (x < 36 && y > 66) y -= 30;
  return { x, y };
}
// THE GOLDEN BANANA — a rare drop (~every 30 min); the finder mints a patch and
// the whole floor gets a confetti party. A moment, not a power-up.
const GOLD_PERIOD = 1_800_000, GOLD_WAIT = 240_000, GOLD_OFFSET = 660_000;
function goldWindow(now) {
  const ph = (((now - GOLD_OFFSET) % GOLD_PERIOD) + GOLD_PERIOD) % GOLD_PERIOD;
  return ph < GOLD_WAIT ? Math.floor((now - GOLD_OFFSET) / GOLD_PERIOD) : -1;
}
function goldSpot(w) {
  let x = 12 + seedRand(0x601d + w * 2) * 70;
  let y = 26 + seedRand(0x601d + w * 2 + 1) * 46;
  if (x < 36 && y > 66) y -= 30;
  return { x, y };
}
// THE CONVEYOR — one unified item stream so the floor is NEVER dead (Trym's
// low-traffic brief: solo visitors need a constant chase). A new item every 75s
// at a clock-seeded spot; the type comes from the same seed. Effect items ride
// the fx system; snacks (candy/pizza/balloon) are pure chase + client-side chain.
// items live FIVE SECONDS on the floor (Trym: reflex, not patience) — the
// client shows/poofs at 5s; the server window carries 1.5s latency grace
const ITEM_PERIOD = 75_000, ITEM_WAIT = 6_500, ITEM_OFFSET = 15_000;
function itemWindow(now) {
  const ph = (((now - ITEM_OFFSET) % ITEM_PERIOD) + ITEM_PERIOD) % ITEM_PERIOD;
  return ph < ITEM_WAIT ? Math.floor((now - ITEM_OFFSET) / ITEM_PERIOD) : -1;
}
function itemSpot(w) {
  let x = 12 + seedRand(0x17e6 + w * 2) * 70;
  let y = 26 + seedRand(0x17e6 + w * 2 + 1) * 46;
  if (x < 36 && y > 66) y -= 30;
  return { x, y };
}
function itemType(w) { // keep weights in sync with banana-rave.js
  const r = seedRand(0x7ab1e + w);
  // 22 kinds — classics keep a slight edge; the R4.5 six close the table
  return r < 0.08 ? 'sauce' : r < 0.15 ? 'zap' : r < 0.22 ? 'fizz'
    : r < 0.28 ? 'candy' : r < 0.34 ? 'pizza' : r < 0.40 ? 'balloon'
    : r < 0.45 ? 'shard' : r < 0.50 ? 'cone' : r < 0.55 ? 'popper'
    : r < 0.59 ? 'remote' : r < 0.63 ? 'kazoo' : r < 0.67 ? 'glitter'
    : r < 0.71 ? 'phone' : r < 0.75 ? 'cube' : r < 0.78 ? 'pizzabox'
    : r < 0.81 ? 'wand' : r < 0.85 ? 'boots' : r < 0.88 ? 'gel'
    : r < 0.91 ? 'sparkler' : r < 0.94 ? 'magnet' : r < 0.97 ? 'vhs' : 'star';
}
const ITEM_FX = { // all rendering is client-side; the server only stamps fx ids
  sauce: 'flames', zap: 'zap', fizz: 'fizz', balloon: 'balloon',
  shard: 'prism', cone: 'cone', popper: 'popper', remote: 'fog', kazoo: 'notes',
  glitter: 'glitter', phone: 'flash', cube: 'slide', wand: 'bubbles',
  boots: 'boots', gel: 'wobble', sparkler: 'sparkler', magnet: 'magnet', vhs: 'vhs', star: 'conga',
  // the snacks wear their dinner now (Trym round 2): held pizza props + the
  // sugar shakes; pizzabox still pays its jelly client-side on top
  pizza: 'slice', pizzabox: 'box', candy: 'sugar',
};
// BARTY'S SPECIALS — between happy hours a rotating cocktail lands on the counter;
// first banana at the bar drinks it and wears its effect for a while.
const SPECIAL_PERIOD = 300_000, SPECIAL_LEN = 35_000, SPECIAL_OFFSET = 270_000;
const COCKTAILS = ['daiquiri', 'fizz', 'espresso', 'lagoon', 'colada', 'margarita', 'champagne', 'milkshake', 'jellyshot', 'water']; // keep in sync with banana-rave.js
function specialWindow(now) {
  const ph = (((now - SPECIAL_OFFSET) % SPECIAL_PERIOD) + SPECIAL_PERIOD) % SPECIAL_PERIOD;
  return ph < SPECIAL_LEN ? Math.floor((now - SPECIAL_OFFSET) / SPECIAL_PERIOD) : -1;
}
// effects are MOMENTS, not outfits — 10s baseline with the item menu cycling
// (Trym's call; was 150s/60s). Clients also cap at first sight (capFx).
// Trym's juice pass: the crowd favourites earn longer runs (keep in sync
// with banana-rave.js FX_DUR — the client cap clamps to the same table).
const FX_MS = 10_000;
const FX_DUR = { cone: 30_000, balloon: 20_000, zap: 20_000, conga: 15_000, boots: 15_000, magnet: 12_000, sparkler: 12_000, fog: 20_000 };
const fxLen = (id) => FX_DUR[id] || FX_MS;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const room = env.RAVE.get(env.RAVE.idFromName('main-floor'));
    if (url.pathname === '/ws') {
      const allowed = (env.ALLOWED_ORIGIN || '').split(',').map((s) => s.trim());
      if (!allowed.includes(request.headers.get('Origin') || '')) {
        return new Response('forbidden', { status: 403 });
      }
      return room.fetch(request);
    }
    if (url.pathname === '/count') {
      const res = await room.fetch(new Request('https://room/count'));
      return new Response(await res.text(), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' },
      });
    }
    return new Response('not found', { status: 404 });
  },
};

function sanitizeOutfit(o) {
  o = o && typeof o === 'object' ? o : {};
  const extras = {};
  EXTRA_IDS.forEach((id) => { if (o.extras && o.extras[id] === true) extras[id] = true; });
  return {
    hat: HAT_IDS.includes(o.hat) ? o.hat : 'none',
    glasses: SHADE_IDS.includes(o.glasses) ? o.glasses : 'none',
    extras,
    effect: EFFECT_IDS.includes(o.effect) ? o.effect : 'none',
  };
}

export class RaveRoom {
  constructor(state) {
    this.state = state;
    // auto-respond to pings without waking the object (hibernation-friendly)
    this.state.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair('{"t":"ping"}', '{"t":"pong"}')
    );
  }

  // GHOST REAPER (12 Jul — Trym saw his own iOS zombie twice on the floor):
  // iOS drops the goodbye close-frame on quick reloads/backgrounding, so dead
  // sessions linger in the roster. Liveness = the hibernation auto-response
  // timestamp (every client pings ~30s; the runtime stamps it WITHOUT waking
  // us) — so pocket-AFK farmers stay safe and no client change is needed.
  reapStale() {
    const now = Date.now();
    for (const ws of this.state.getWebSockets()) {
      let last = 0;
      try {
        const t = this.state.getWebSocketAutoResponseTimestamp(ws);
        if (t) last = t.getTime();
      } catch (e) {}
      let a = null;
      try { a = ws.deserializeAttachment(); } catch (e) {}
      if (a && a.joined > last) last = a.joined; // fresh sockets haven't pinged yet
      if (last && now - last > 120_000) { // 4 missed pings = dead
        // close() is async — the socket stays in getWebSockets() this tick, so
        // mark the attachment dead and roster()/count filter it out NOW
        if (a) { a.dead = true; try { ws.serializeAttachment(a); } catch (e) {} }
        try { ws.close(1011, 'stale'); } catch (e) {}
        if (a) this.broadcast({ t: 'leave', id: a.id }, ws);
      }
    }
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/count') {
      this.reapStale(); // the homepage door polls this — free periodic sweeps
      return new Response(JSON.stringify({ count: this.roster().length }));
    }
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('expected websocket', { status: 426 });
    }
    this.reapStale(); // ghosts must never hold seats against the cap
    if (this.roster().length >= ROOM_CAP) {
      return new Response('floor full', { status: 503 });
    }
    const pair = new WebSocketPair();
    this.state.acceptWebSocket(pair[1]);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  roster() {
    return this.state.getWebSockets()
      .map((ws) => { try { return ws.deserializeAttachment(); } catch (e) { return null; } })
      .filter((a) => a && !a.dead);
  }

  broadcast(msg, exceptWs) {
    const s = JSON.stringify(msg);
    for (const ws of this.state.getWebSockets()) {
      if (ws === exceptWs) continue;
      try { ws.send(s); } catch (e) {}
    }
  }

  async webSocketMessage(ws, raw) {
    let msg;
    try { msg = JSON.parse(raw); } catch (e) { return; }
    if (!msg || typeof msg !== 'object') return;

    let me = null;
    try { me = ws.deserializeAttachment(); } catch (e) {}
    if (me && me.dead) return; // reaped — everyone already saw the leave; no resurrection

    if (msg.t === 'hi' && !me) {
      this.reapStale(); // every join clears the zombies before the roster ships
      const p = {
        id: crypto.randomUUID().slice(0, 8),
        outfit: sanitizeOutfit(msg.outfit),
        joined: Date.now(),
        // floor time carried across reconnects: iOS re-sockets on every
        // background/foreground, so gating the stage on `joined` alone made
        // the button LOOK ready (client clock) while the server said "early"
        // (fresh socket clock). The client reports its floor time; clamp it
        // and keep it AWAY from `joined` — the ghost reaper trusts `joined`
        // as the liveness floor for fresh sockets, so backdating it would get
        // newcomers reaped before their first ping.
        since: Date.now() - Math.min(Math.max(Number(msg.sess) || 0, 0), 86_400_000),
        lvl: sanLvl(msg.lvl),
        lastEmote: 0,
      };
      ws.serializeAttachment(p);
      const beerWin = (await this.state.storage.get('beerWin')) ?? null;
      const vinylWin = (await this.state.storage.get('vinylWin')) ?? null;
      const sauceWin = (await this.state.storage.get('sauceWin')) ?? null;
      const cocktailWin = (await this.state.storage.get('cocktailWin')) ?? null;
      const goldWin = (await this.state.storage.get('goldWin')) ?? null;
      const itemWin = (await this.state.storage.get('itemWin')) ?? null;
      ws.send(JSON.stringify({ t: 'roster', you: p.id, all: this.roster().map(strip), beerWin, vinylWin, sauceWin, cocktailWin, goldWin, itemWin }));
      this.broadcast({ t: 'join', p: strip(p) }, ws);
      return;
    }

    if (msg.t === 'beer' && me && !me.beer) { // first banana at the bar this window
      const win = happyWindow(Date.now());
      if (win < 0) return;
      // you must actually WALK to the bar. The zone is a GENEROUS anti-cheat
      // bound: the solid counter's edge scales with the client's floor width
      // (x≈50-62% on phones), so the precise at-the-counter gate lives client-
      // side and this only blocks cross-floor spoofing.
      if (!(typeof me.x === 'number' && me.x < 70 && typeof me.y === 'number' && me.y > 64)) return;
      if (this.beerWin === win) return;   // sync fast-path — two claims in the same window can't both pass
      this.beerWin = win;                 // claim in-memory BEFORE any await (DO interleaves at await points)
      const stored = await this.state.storage.get('beerWin');
      if (stored === win) return;         // claimed before a hibernation wipe of the instance field
      await this.state.storage.put('beerWin', win);
      me.beer = true;
      me.outfit.extras = { ...(me.outfit.extras || {}), beer: true };
      ws.serializeAttachment(me);
      this.broadcast({ t: 'beer', id: me.id });
      return;
    }

    if (msg.t === 'emote' && me && EMOTES.includes(msg.k)) {
      if (msg.k === 'fire' && !me.stage) return; // the 🔥 is earned, not given
      const now = Date.now();
      if (now - (me.lastEmote || 0) < 1500) return; // throttle: no spam cannons
      me.lastEmote = now;
      ws.serializeAttachment(me);
      this.broadcast({ t: 'emote', id: me.id, k: msg.k });
      return;
    }

    if (msg.t === 'move' && me) { // walking: position relay, sender echoes locally
      const x = Number(msg.x), y = Number(msg.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      const now = Date.now();
      if (now - (me.lastMove || 0) < 100) return; // rate guard: client sends at 150ms
      me.lastMove = now;
      me.x = Math.min(96, Math.max(4, Math.round(x * 10) / 10));
      me.y = Math.min(92, Math.max(6, Math.round(y * 10) / 10));
      ws.serializeAttachment(me);
      this.broadcast({ t: 'move', id: me.id, x: me.x, y: me.y }, ws);
      return;
    }

    if (msg.t === 'vinyl' && me && !me.vinyl) { // first banana to the lost record
      const win = vinylWindow(Date.now());
      if (win < 0) return;
      if (this.vinylWin === win) return;      // sync guard before any await
      const spot = vinylSpot(win);
      if (!(typeof me.x === 'number' && Math.abs(me.x - spot.x) < 14 && typeof me.y === 'number' && Math.abs(me.y - spot.y) < 14)) return;
      this.vinylWin = win;
      const stored = await this.state.storage.get('vinylWin');
      if (stored === win) return;
      await this.state.storage.put('vinylWin', win);
      me.vinyl = true;
      ws.serializeAttachment(me);
      this.broadcast({ t: 'vinyl', id: me.id });
      return;
    }

    if (msg.t === 'item' && me) { // first banana to this window's conveyor item
      const win = itemWindow(Date.now());
      if (win < 0) return;
      if (this.itemWin === win) return;       // sync guard before any await
      const spot = itemSpot(win);
      if (!(typeof me.x === 'number' && Math.abs(me.x - spot.x) < 14 && typeof me.y === 'number' && Math.abs(me.y - spot.y) < 14)) return;
      this.itemWin = win;
      const stored = await this.state.storage.get('itemWin');
      if (stored === win) return;
      await this.state.storage.put('itemWin', win);
      const kind = itemType(win);
      if (ITEM_FX[kind]) {
        me.fx = { id: ITEM_FX[kind], until: Date.now() + fxLen(ITEM_FX[kind]) };
        ws.serializeAttachment(me);
      }
      this.broadcast({ t: 'item', id: me.id, win, kind, fx: ITEM_FX[kind] ? me.fx : undefined });
      return;
    }

    // legacy: pre-conveyor clients still send 'sauce' against the old windows
    if (msg.t === 'sauce' && me) { // first banana to the hot-sauce bottle
      const win = sauceWindow(Date.now());
      if (win < 0) return;
      if (this.sauceWin === win) return;      // sync guard before any await
      const spot = sauceSpot(win);
      if (!(typeof me.x === 'number' && Math.abs(me.x - spot.x) < 14 && typeof me.y === 'number' && Math.abs(me.y - spot.y) < 14)) return;
      this.sauceWin = win;
      const stored = await this.state.storage.get('sauceWin');
      if (stored === win) return;
      await this.state.storage.put('sauceWin', win);
      me.fx = { id: 'flames', until: Date.now() + fxLen('flames') };
      ws.serializeAttachment(me);
      this.broadcast({ t: 'fx', id: me.id, fx: me.fx, src: 'sauce' });
      return;
    }

    if (msg.t === 'gold' && me) { // first banana to the golden one
      const win = goldWindow(Date.now());
      if (win < 0) return;
      if (this.goldWin === win) return;       // sync guard before any await
      const spot = goldSpot(win);
      if (!(typeof me.x === 'number' && Math.abs(me.x - spot.x) < 14 && typeof me.y === 'number' && Math.abs(me.y - spot.y) < 14)) return;
      this.goldWin = win;
      const stored = await this.state.storage.get('goldWin');
      if (stored === win) return;
      await this.state.storage.put('goldWin', win);
      this.broadcast({ t: 'gold', id: me.id });
      return;
    }

    if (msg.t === 'cocktail' && me) { // first banana at the bar during specials
      const win = specialWindow(Date.now());
      if (win < 0) return;
      if (this.cocktailWin === win) return;   // sync guard before any await
      // same generous walk-to-the-bar bound as the beer (client gates precisely)
      if (!(typeof me.x === 'number' && me.x < 70 && typeof me.y === 'number' && me.y > 64)) return;
      this.cocktailWin = win;
      const stored = await this.state.storage.get('cocktailWin');
      if (stored === win) return;
      await this.state.storage.put('cocktailWin', win);
      const drink = COCKTAILS[((win % COCKTAILS.length) + COCKTAILS.length) % COCKTAILS.length];
      me.fx = { id: drink, until: Date.now() + fxLen(drink) };
      ws.serializeAttachment(me);
      this.broadcast({ t: 'fx', id: me.id, fx: me.fx, src: 'cocktail' });
      return;
    }

    if (msg.t === 'vinylDrop' && me && me.vinyl) { // courier reached the stage edge
      if (!(typeof me.y === 'number' && me.y < 18 && me.x > 26 && me.x < 74)) return;
      me.vinyl = false;
      ws.serializeAttachment(me);
      this.broadcast({ t: 'minidrop', id: me.id });
      return;
    }

    if (msg.t === 'stage' && me) {
      if (msg.on) {
        if (Date.now() - (me.since || me.joined) < STAGE_MIN_MS) { // since = floor time across reconnects
          ws.send('{"t":"stageNo","reason":"early"}');
          return;
        }
        if (this.roster().filter((p) => p.stage).length >= STAGE_CAP) {
          ws.send('{"t":"stageNo","reason":"full"}');
          return;
        }
        me.stage = true;
      } else {
        me.stage = false;
      }
      ws.serializeAttachment(me);
      this.broadcast({ t: 'stage', id: me.id, on: me.stage }); // includes sender = server-authoritative echo
      return;
    }

    if (msg.t === 'lvl' && me) { // levelled up mid-rave — the roster title updates live
      const n = sanLvl(msg.n);
      if (!n || n === me.lvl) return;
      if (me.lvl && n < me.lvl) return; // levels only climb (no-decay rule, enforced here too)
      me.lvl = n;
      ws.serializeAttachment(me);
      this.broadcast({ t: 'lvl', id: me.id, n });
      return;
    }

    if (msg.t === 'outfit' && me) { // changed clothes mid-rave (via builder link back)
      me.outfit = sanitizeOutfit(msg.outfit);
      if (msg.sober) { me.beer = false; me.fx = undefined; } // the water: a clean slate is a CLEAN slate
      if (me.beer) me.outfit.extras.beer = true; // the beer survives a wardrobe change
      ws.serializeAttachment(me);
      this.broadcast({ t: 'outfit', id: me.id, outfit: me.outfit });
    }
  }

  async webSocketClose(ws) {
    let me = null;
    try { me = ws.deserializeAttachment(); } catch (e) {}
    if (me && !me.dead) this.broadcast({ t: 'leave', id: me.id }, ws); // reaped ghosts already announced their leave
  }

  async webSocketError(ws) {
    return this.webSocketClose(ws);
  }
}

function strip(p) {
  return {
    id: p.id, outfit: p.outfit, joined: p.joined, stage: !!p.stage, vinyl: !!p.vinyl, x: p.x, y: p.y,
    fx: p.fx && p.fx.until > Date.now() ? p.fx : undefined, // active effects survive a rejoin, expired ones don't travel
    lvl: p.lvl || undefined, // club level (REP) — titles show on the floor roster
  };
}
const sanLvl = (v) => { const n = Math.round(Number(v)); return n >= 1 && n <= 99 ? n : undefined; };
