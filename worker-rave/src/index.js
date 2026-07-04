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

// ⚠️ keep in sync with PACKS in src/lib/banana-engine.js
const HAT_IDS = ['none', 'party', 'crown', 'tophat', 'cowboy'];
const SHADE_IDS = ['none', 'shades', 'hearts', 'visor'];
const EXTRA_IDS = ['mustache', 'bowtie', 'glowstick'];
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

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/count') {
      return new Response(JSON.stringify({ count: this.state.getWebSockets().length }));
    }
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('expected websocket', { status: 426 });
    }
    if (this.state.getWebSockets().length >= ROOM_CAP) {
      return new Response('floor full', { status: 503 });
    }
    const pair = new WebSocketPair();
    this.state.acceptWebSocket(pair[1]);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  roster() {
    return this.state.getWebSockets()
      .map((ws) => { try { return ws.deserializeAttachment(); } catch (e) { return null; } })
      .filter(Boolean);
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

    if (msg.t === 'hi' && !me) {
      const p = {
        id: crypto.randomUUID().slice(0, 8),
        outfit: sanitizeOutfit(msg.outfit),
        joined: Date.now(),
        lastEmote: 0,
      };
      ws.serializeAttachment(p);
      const beerWin = (await this.state.storage.get('beerWin')) ?? null;
      ws.send(JSON.stringify({ t: 'roster', you: p.id, all: this.roster().map(strip), beerWin }));
      this.broadcast({ t: 'join', p: strip(p) }, ws);
      return;
    }

    if (msg.t === 'beer' && me && !me.beer) { // first banana at the bar this window
      const win = happyWindow(Date.now());
      if (win < 0) return;
      // you must actually WALK to the bar — the server knows your position from the
      // move messages (keep the zone in sync with BAR_ZONE in banana-rave.js)
      if (!(typeof me.x === 'number' && me.x < 34 && typeof me.y === 'number' && me.y > 70)) return;
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

    if (msg.t === 'stage' && me) {
      if (msg.on) {
        if (Date.now() - me.joined < STAGE_MIN_MS) {
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

    if (msg.t === 'outfit' && me) { // changed clothes mid-rave (via builder link back)
      me.outfit = sanitizeOutfit(msg.outfit);
      if (me.beer) me.outfit.extras.beer = true; // the beer survives a wardrobe change
      ws.serializeAttachment(me);
      this.broadcast({ t: 'outfit', id: me.id, outfit: me.outfit });
    }
  }

  async webSocketClose(ws) {
    let me = null;
    try { me = ws.deserializeAttachment(); } catch (e) {}
    if (me) this.broadcast({ t: 'leave', id: me.id }, ws);
  }

  async webSocketError(ws) {
    return this.webSocketClose(ws);
  }
}

function strip(p) {
  return { id: p.id, outfit: p.outfit, joined: p.joined, stage: !!p.stage, x: p.x, y: p.y };
}
