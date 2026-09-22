// 🏘️👥 THE SQUARE IS SHARED — other players' bananas in Banana Town (22 Sep 2026).
//
// Trym: "if the town isnt «multiplayer» yet, make it so aswell". The town is the front door now and
// its crowd chip read "solo" for everybody, whoever else was standing in the square. This is the park's
// rail (banana-park.js: presenceRoom over the ParkRoom DO — join, move, outfit, leave), on its own room
// (worker-rave SquareRoom, `/town`), in its own lazy chunk so the square's script stays inside its budget.
//
// ⚠️ THE WIRE IS IN PERCENT of the town plate (W 2200 × H 1300), the park's convention: the room clamps
// it, so a client can never place a banana off the map. ⚠️ A banana INDOORS (the arcade, the store) is
// on another plate: it rides the wire with its `room`, and it is not drawn on the square — nor is anybody
// drawn while YOU are indoors. Others inside the same room with you is a later refinement; today the
// square is what is shared.
// Fails silently by design: no socket, no crowd, the town works solo exactly as it did.
import { presenceRoom, poofInto } from '../lib/world.js';
import { drawComposite, NFRAMES, BASE_CYCLE_S } from '../lib/banana-engine.js';

const WS = 'wss://banana-rave.trymstene.workers.dev/town';
const CV = 150;

export function bootTownCrowd(ctx) {
  const { world, W, H, pct, hud, track, pos, outfit, name, inRoom, onBurst } = ctx;
  const peers = new Map();   // id → { el, ctx, outfit, name, x, y, room, lastF }
  let myId = null, sendAt = 0, sawPeer = false, sentRoom = '';
  const lastSent = { x: -1, y: -1 };
  // the same clock the player's own banana dances to (banana-town.js frameNow)
  const frameNow = () => { const cyc = BASE_CYCLE_S * 1000; return Math.floor(((Date.now() % cyc) / cyc) * NFRAMES) % NFRAMES; };
  const toPX = (x) => x / W * 100, toPY = (y) => y / H * 100;
  const fromPX = (x) => (Number(x) || 50) / 100 * W, fromPY = (y) => (Number(y) || 90) / 100 * H;
  const fit = (o) => ({ ...(o || {}), top: '', bottom: '', bg: 'transparent', captions: false, effect: 'none' });
  const here = () => (inRoom && inRoom()) || '';
  const visible = (p) => !p.room && !here();

  function refreshCrowd() { if (hud && hud.setCrowd) hud.setCrowd(peers.size ? String(peers.size + 1) : 'solo'); }
  function drawPeer(p, force) {
    const f = frameNow();
    if (!force && f === p.lastF) return;
    p.lastF = f;
    try { drawComposite(p.ctx, CV, f, fit(p.outfit)); } catch (e) {}
  }
  function placePeer(p) {
    p.el.style.left = pct(p.x, W);
    p.el.style.top = pct(p.y, H);
    p.el.style.zIndex = String(100 + Math.round(p.y));   // the square's own depth: z = 100 + y
    p.el.hidden = !visible(p);
  }
  function addPeer(d) {
    if (!d || d.id === myId || peers.has(d.id)) return;
    if (!sawPeer) { sawPeer = true; track('town_multiplayer'); }
    const el = document.createElement('div');
    el.className = 'tw-npc tw-peer';
    const cv = document.createElement('canvas');
    cv.width = CV; cv.height = CV;
    el.appendChild(cv);
    // a player's name over their head is the park's grammar — the QUIET RULE is about speech, and
    // about the residents; a person is a person
    if (d.name) { const tag = document.createElement('span'); tag.className = 'tw-peer__name'; tag.textContent = d.name; el.appendChild(tag); }
    world.appendChild(el);
    const p = { el, ctx: cv.getContext('2d'), outfit: d.outfit || {}, name: d.name || '', x: fromPX(d.x), y: fromPY(d.y), room: d.room || '', lastF: -1 };
    peers.set(d.id, p);
    placePeer(p);
    drawPeer(p, true);
    refreshCrowd();
  }
  function dropPeer(id) {
    const p = peers.get(id);
    if (!p) return;
    if (!p.el.hidden) poofInto(world, 'tw-poof', p.x / W * 100, (p.y - 26) / H * 100);
    p.el.remove();
    peers.delete(id);
    refreshCrowd();
  }

  const room = presenceRoom({
    url: WS,
    hi: () => ({ outfit: outfit(), x: toPX(pos.x), y: toPY(pos.y), name: name(), room: here() }),
    onMessage: (m) => {
      if (m.t === 'roster') { myId = m.you; (m.all || []).forEach(addPeer); refreshCrowd(); }
      else if (m.t === 'join') addPeer(m.p);
      else if (m.t === 'move') {
        const p = peers.get(m.id);
        if (p) { p.x = fromPX(m.x); p.y = fromPY(m.y); p.room = m.room || ''; placePeer(p); }
      } else if (m.t === 'outfit') {
        const p = peers.get(m.id);
        if (p) { p.outfit = m.outfit || {}; drawPeer(p, true); }
      } else if (m.t === 'leave') dropPeer(m.id);
      // 🎆 somebody's firework: where the room says they stood, with the room's copy of their name
      else if (m.t === 'burst' && onBurst && !here()) onBurst(fromPX(m.x), fromPY(m.y), m.name || '');
    },
    onDown: () => { peers.forEach((p) => p.el.remove()); peers.clear(); refreshCrowd(); },
  });

  function tick(now) {
    for (const p of peers.values()) if (!p.el.hidden) drawPeer(p);
    if (!room.live || now - sendAt < 150) return;
    const r = here();
    const moved = Math.abs(pos.x - lastSent.x) >= 1 || Math.abs(pos.y - lastSent.y) >= 1;
    if (!moved && r === sentRoom) return;
    sendAt = now; lastSent.x = pos.x; lastSent.y = pos.y; sentRoom = r;
    room.send({ t: 'move', x: toPX(pos.x), y: toPY(pos.y), room: r });
  }

  return {
    tick,
    // 🚪 through a door, either way: everybody on the square hides or shows again at once
    rooms: () => { for (const p of peers.values()) placePeer(p); },
    outfit: () => { if (room.live) room.send({ t: 'outfit', outfit: outfit() }); },
    // 🎆 my firework, out to everyone on the square (the room drops one sent from indoors)
    burst: () => { if (room.live && !here()) room.send({ t: 'burst', x: toPX(pos.x), y: toPY(pos.y) }); },
    others: () => { const out = []; for (const p of peers.values()) if (!p.el.hidden) out.push({ x: p.x, y: p.y }); return out; },
    seam: {
      live: () => !!room.live,
      me: () => myId,
      peers: () => [...peers.entries()].map(([id, p]) => ({ id, name: p.name, x: Math.round(p.x), y: Math.round(p.y), room: p.room, hidden: !!p.el.hidden })),
    },
  };
}
