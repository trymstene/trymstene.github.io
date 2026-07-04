// THE BANANA RAVE — everyone on the page dances together, in sync, forever.
//
// The clock trick: dance phase = wall time mod cycle, so every banana on
// Earth is on the same frame with ZERO realtime animation traffic. The
// server (worker-rave, Durable Object) is presence only: who's here, in
// what outfit, plus emotes. No captions on the floor (fixed emotes only) =
// no moderation surface.
//
// THE DROP: clock-synced shared moment — every 3 minutes, for 10 seconds,
// the whole floor goes disco. Everyone sees it together because everyone
// shares the same clock. Zero server involvement.
import { drawComposite, assetsReady, NFRAMES } from '../lib/banana-engine.js';
import { dailyOutfit } from '../lib/banana-daily.js';

const RAVE_WS = 'wss://banana-rave.trymstene.workers.dev/ws';
const DROP_PERIOD = 180, DROP_LEN = 10; // seconds
const MAX_VISIBLE = 60;
// stay this long → the stage opens (server enforces the same; ?stagetest = solo-mode preview)
const STAGE_UNLOCK_MS = location.search.includes('stagetest') ? 5000 : 5 * 60 * 1000;
// walking (option A: you dance-walk — the dance keeps playing, mirror + lean give direction)
const WALK_SPEED = 16;     // % of floor per second
const MOVE_SEND_MS = 150;  // network throttle; local echo runs every frame
// the souvenir: survive this long → the glowstick is yours forever (client-side unlock, it's a joke not DRM)
const GLOW_MS = location.search.includes('stagetest') ? 20000 : 30 * 60 * 1000;
// HAPPY HOUR — clock-synced like the drop: same window for the whole planet,
// every 5th minute for 40s. First banana at the bar drinks free (server-arbitrated).
const HAPPY_PERIOD = 300, HAPPY_LEN = 40, HAPPY_OFFSET = 120; // seconds, wall clock
const BAR_ZONE = { x: 34, y: 70 }; // bottom-LEFT bar: at the bar = x < 34% AND y > 70% (down = nearer)
const happyPhase = (t) => (((t - HAPPY_OFFSET) % HAPPY_PERIOD) + HAPPY_PERIOD) % HAPPY_PERIOD;
const happyActive = (t) => happyPhase(t) < HAPPY_LEN;
const happyWin = (t) => Math.floor((t - HAPPY_OFFSET) / HAPPY_PERIOD);
const BAR_QUIPS = [
  'we only serve potassium',
  'the drop hits every third minute. the bar never misses',
  'nice moves. hydrate.',
  'I peeled at my first rave too',
  'happy hour every 5th minute — be quick',
];

const el = (id) => document.getElementById(id);
const floor = el('rvFloor');
const world = el('rvWorld');
if (floor) init();

function track(name, params) { if (window.gtag) window.gtag('event', name, params || {}); }

// outfit → a name with no moderation surface: built ONLY from known ids
function autoName(o) {
  const adj = (o.extras && o.extras.glowstick ? 'Glowing' : null)
    || { shades: 'Cool', hearts: 'Lovestruck', visor: 'Sporty' }[o.glasses]
    || { disco: 'Disco', sparkle: 'Sparkly', confetti: 'Party' }[o.effect]
    || (o.extras && o.extras.mustache ? 'Distinguished' : 'Fresh');
  const noun = { cowboy: 'Cowboy', crown: 'Royal', tophat: 'Fancy', party: 'Birthday' }[o.hat]
    || (o.extras && o.extras.bowtie ? 'Dapper' : 'Dancing');
  return adj + ' ' + noun + ' Banana';
}

function myOutfit() {
  try {
    const saved = JSON.parse(localStorage.getItem('bb-last') || 'null');
    if (saved && typeof saved === 'object') return saved;
  } catch (e) {}
  // first-timers get a party-ready random fit
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  return {
    hat: pick(['none', 'party', 'crown', 'tophat', 'cowboy']),
    glasses: pick(['none', 'shades', 'hearts', 'visor']),
    extras: { mustache: Math.random() < 0.25, bowtie: Math.random() < 0.25 },
    effect: 'none',
  };
}

function init() {
  const ravers = new Map(); // id -> {outfit, joined, stage, wrap, cv, x, y, size}
  let myId = null;
  let online = false;
  const sessionStart = Date.now();

  // deterministic floor position from id (no server coordinates needed)
  function place(id) {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    const x = 4 + (h % 79);            // 4..82 (%)
    const y = 6 + ((h >>> 8) % 68);    // 6..73 (%) — MUST be >>> : >> is signed, went negative for half of all ids and floated bananas above the floor
    return { x, y };
  }

  function addRaver(p, isMe) {
    if (ravers.has(p.id)) return;
    const { x, y } = (typeof p.x === 'number' && typeof p.y === 'number') ? { x: p.x, y: p.y } : place(p.id);
    const size = Math.round(74 + y * 0.9); // deeper = bigger (fake depth)
    const wrap = document.createElement('div');
    wrap.className = 'rv-raver' + (isMe ? ' rv-raver--me' : '');
    wrap.style.left = x + '%';
    wrap.style.top = y + '%';
    wrap.style.zIndex = String(100 + y);
    const cv = document.createElement('canvas');
    cv.width = 160; cv.height = 160;
    cv.style.width = size + 'px'; cv.style.height = size + 'px';
    wrap.appendChild(cv);
    if (isMe) {
      const tag = document.createElement('span');
      tag.className = 'rv-you';
      tag.textContent = 'you';
      wrap.appendChild(tag);
    }
    world.appendChild(wrap);
    ravers.set(p.id, { ...p, wrap, cv, x, y, size });
    if (p.stage) setStage(p.id, true);
    refreshHud();
  }

  // ---- walking ----
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  function setPos(r, x, y) {
    r.x = x; r.y = y;
    r.size = Math.round(74 + y * 0.9);
    if (r.stage) return; // stage members keep their spot for the return
    r.wrap.style.left = x + '%';
    r.wrap.style.top = y + '%';
    r.wrap.style.zIndex = String(100 + Math.round(y));
    r.cv.style.width = r.cv.style.height = r.size + 'px';
  }

  // mirror + lean into the direction of travel (rotate composes inside the flip,
  // so the same 4deg leans "forward" on both sides)
  function leanInto(r, dx) {
    if (dx < -0.01) r.facing = -1;
    else if (dx > 0.01) r.facing = 1;
    const flip = r.facing === -1 ? 'scaleX(-1) ' : '';
    r.cv.style.transform = flip + (Math.abs(dx) > 0.01 ? 'rotate(4deg)' : '');
    r.lastWalk = Date.now();
  }

  function stopLean(r) {
    r.cv.style.transform = r.facing === -1 ? 'scaleX(-1)' : '';
    r.lastWalk = 0;
  }

  let walkTarget = null;        // tap-to-move destination
  const keysDown = new Set();   // arrow/WASD state
  let lastMoveSent = 0;
  let walkedOnce = false;

  // first-night tip: how to move — fades on the first step or after a few seconds
  let tipDismiss = null;
  try {
    if (!localStorage.getItem('rv-tip')) {
      localStorage.setItem('rv-tip', '1');
      const tip = el('rvTip');
      tip.textContent = matchMedia('(pointer: coarse)').matches
        ? '👆 tap anywhere on the floor to walk over'
        : '🕹 walk with WASD / arrow keys — or click the floor';
      tip.hidden = false;
      let gone = false;
      tipDismiss = () => {
        if (gone) return;
        gone = true;
        tip.classList.add('rv-tip--fade');
        setTimeout(() => tip.remove(), 700);
      };
      setTimeout(tipDismiss, 7000);
    }
  } catch (e) {}

  // ---- the camera: follow-me zoom for small screens (walking IS panning) ----
  const CAM_SCALE = 1.75;
  const cam = { on: matchMedia('(max-width: 640px)').matches, s: 1, tx: 0, ty: 0 };
  let floorW = 0, floorH = 0;
  // the bar is SOLID — bananas stop at it instead of moonwalking through the counter.
  // It's sized in px, so its world-percent rect depends on the floor size: re-measured
  // with the floor. Occupied corner = x < barSolid.x AND y > barSolid.y.
  const barEl = document.querySelector('.rv-bar');
  const barSolid = { x: 0, y: 100 };
  const measureFloor = () => {
    floorW = floor.clientWidth;
    floorH = floor.clientHeight;
    if (barEl && floorW && floorH) {
      barSolid.x = ((barEl.offsetWidth - 18) / floorW) * 100;       // 18px bleeds off the left
      barSolid.y = 100 - (((barEl.offsetHeight - 52) / floorH) * 100); // 52px bleeds off the bottom
    }
  };
  measureFloor();
  addEventListener('resize', measureFloor);
  const insideBar = (x, y) => x < barSolid.x && y > barSolid.y;

  const zoomBtn = el('rvZoom');
  function refreshZoomBtn() { zoomBtn.hidden = false; zoomBtn.textContent = cam.on ? '🗺 whole floor' : '🔍 follow me'; }
  refreshZoomBtn();
  zoomBtn.addEventListener('click', () => { cam.on = !cam.on; refreshZoomBtn(); track('rave_zoom', { on: cam.on }); });

  function updateCam() {
    const me = myId && ravers.get(myId);
    if (!cam.on || !me || me.stage) {
      if (cam.s !== 1) { cam.s = 1; cam.tx = 0; cam.ty = 0; world.style.transform = ''; }
      return;
    }
    cam.s = CAM_SCALE;
    const px = (me.x / 100) * floorW * cam.s;
    const py = (me.y / 100) * floorH * cam.s;
    cam.tx = clamp(floorW / 2 - px, floorW - floorW * cam.s, 0);
    cam.ty = clamp(floorH / 2 - py, floorH - floorH * cam.s, 0);
    world.style.transform = `translate(${cam.tx}px, ${cam.ty}px) scale(${cam.s})`;
  }

  const KEYMAP = {
    ArrowLeft: 'l', ArrowRight: 'r', ArrowUp: 'u', ArrowDown: 'd',
    a: 'l', d: 'r', w: 'u', s: 'd', A: 'l', D: 'r', W: 'u', S: 'd',
  };
  addEventListener('keydown', (e) => {
    const k = KEYMAP[e.key];
    if (!k) return;
    e.preventDefault(); // arrows must not scroll the hall
    keysDown.add(k);
    walkTarget = null;
  });
  addEventListener('keyup', (e) => { const k = KEYMAP[e.key]; if (k) keysDown.delete(k); });
  addEventListener('blur', () => keysDown.clear());

  floor.addEventListener('click', (e) => {
    if (e.target.closest('.rv-zoom')) return; // the camera toggle is not a walk order
    const me = myId && ravers.get(myId);
    if (!me || me.stage) return;
    const rect = floor.getBoundingClientRect();
    // undo the camera: screen point → world percent
    walkTarget = {
      x: clamp(((e.clientX - rect.left - cam.tx) / (rect.width * cam.s)) * 100, 4, 96),
      y: clamp(((e.clientY - rect.top - cam.ty) / (rect.height * cam.s)) * 100, 6, 92),
    };
  });

  function stepMe(now, dtMs) {
    const me = myId && ravers.get(myId);
    if (!me || me.stage) return;
    let dx = 0, dy = 0;
    if (keysDown.size) {
      if (keysDown.has('l')) dx -= 1;
      if (keysDown.has('r')) dx += 1;
      if (keysDown.has('u')) dy -= 1;
      if (keysDown.has('d')) dy += 1;
    } else if (walkTarget) {
      dx = walkTarget.x - me.x; dy = walkTarget.y - me.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 1) { walkTarget = null; return; }
      dx /= dist; dy /= dist;
    }
    if (!dx && !dy) return;
    const norm = Math.hypot(dx, dy) || 1;
    const step = (WALK_SPEED * dtMs) / 1000;
    let nx = clamp(me.x + (dx / norm) * step, 4, 96);
    let ny = clamp(me.y + (dy / norm) * step, 6, 92);
    // the bar is solid: block ENTERING it (slide along the edge you hit); anyone
    // who spawned inside can still walk free
    if (insideBar(nx, ny) && !insideBar(me.x, me.y)) {
      if (me.x >= barSolid.x) nx = barSolid.x;      // hit the bar's right edge
      else if (me.y <= barSolid.y) ny = barSolid.y; // hit the countertop from above
      else { nx = me.x; ny = me.y; }
      if (walkTarget && insideBar(walkTarget.x, walkTarget.y)) walkTarget = null; // no tables inside the bar
    }
    setPos(me, nx, ny);
    leanInto(me, dx);
    if (!walkedOnce) { walkedOnce = true; track('rave_walk'); if (tipDismiss) tipDismiss(); }
    if (now - lastMoveSent > MOVE_SEND_MS && ws && ws.readyState === 1) {
      lastMoveSent = now;
      ws.send(JSON.stringify({ t: 'move', x: +me.x.toFixed(1), y: +me.y.toFixed(1) }));
    }
  }

  // move a raver between the floor and the stage line behind the DJ
  function setStage(id, on) {
    const r = ravers.get(id);
    if (!r) return;
    r.stage = !!on;
    if (on) {
      r.cv.style.width = r.cv.style.height = ''; // stage size comes from CSS
      r.wrap.style.left = r.wrap.style.top = r.wrap.style.zIndex = '';
      // balance the line around the centre gap (the DJ stands in the middle)
      const stageEl = el('rvStage');
      const gap = stageEl.querySelector('.rv-stage__gap');
      const kids = [...stageEl.children];
      const leftCount = kids.indexOf(gap);
      const rightCount = kids.length - 1 - leftCount;
      if (leftCount <= rightCount) stageEl.insertBefore(r.wrap, gap);
      else stageEl.appendChild(r.wrap);
    } else {
      r.cv.style.width = r.cv.style.height = r.size + 'px';
      r.wrap.style.left = r.x + '%';
      r.wrap.style.top = r.y + '%';
      r.wrap.style.zIndex = String(100 + r.y);
      world.appendChild(r.wrap);
    }
    if (id === myId) refreshStageUi();
    refreshHud();
  }

  function dropRaver(id) {
    const r = ravers.get(id);
    if (!r) return;
    r.wrap.remove();
    ravers.delete(id);
    refreshHud();
  }

  function floatEmote(id, kind) {
    const r = ravers.get(id);
    if (!r) return;
    const e = document.createElement('span');
    e.className = 'rv-emote rv-emote--' + kind;
    e.innerHTML = { heart: '&#10084;', confetti: '&#10022;', banana: '&#127820;', fire: '&#128293;' }[kind] || '';
    r.wrap.appendChild(e);
    setTimeout(() => e.remove(), 1900);
  }

  // ---- the DJ: banana of the day on the podium ----
  const djOutfit = dailyOutfit();
  const djCv = el('rvDj');

  // ---- the bar: Barty (static NPC, frame 4 = first left-facing pose) + happy hour ----
  let beerWin = -1;      // last claimed happy-hour window
  let lastBeerTry = 0;
  let bubbleSticky = false, bubbleT = null;
  function showBubble(text, sticky, ms) {
    const b = el('rvBubble');
    b.textContent = text;
    b.hidden = false;
    bubbleSticky = !!sticky;
    clearTimeout(bubbleT);
    if (!sticky) bubbleT = setTimeout(hideBubble, ms || 4000);
  }
  function hideBubble() { el('rvBubble').hidden = true; bubbleSticky = false; }

  function claimBeer(id) {
    const r = ravers.get(id);
    if (!r) return;
    r.outfit.extras = { ...(r.outfit.extras || {}), beer: true };
    beerWin = happyWin(Date.now() / 1000);
    el('rvCounterBeer').style.display = 'none'; // SVG: no .hidden property AND the UA [hidden] rule skips it — inline display only
    showBubble('SERVED! 🍺 ' + autoName(r.outfit) + ' drinks free', false, 6000);
    refreshHud();
    if (id === myId) track('rave_beer');
  }

  function barTick() {
    const t = Date.now() / 1000;
    const bub = el('rvBubble');
    if (happyActive(t)) {
      const win = happyWin(t);
      if (beerWin !== win) { // this window's beer still on the counter
        el('rvCounterBeer').style.display = '';
        if (!bubbleSticky) showBubble('HAPPY HOUR! 🍺 first banana to the bar drinks free', true);
        const me = myId && ravers.get(myId);
        const mine = me && me.outfit.extras && me.outfit.extras.beer;
        if (me && !me.stage && !mine && me.x < BAR_ZONE.x && me.y > BAR_ZONE.y && Date.now() - lastBeerTry > 2000) {
          lastBeerTry = Date.now();
          if (ws && ws.readyState === 1) ws.send('{"t":"beer"}');
          else claimBeer(myId); // solo mode: the bar is all yours
        }
      }
    } else {
      el('rvCounterBeer').style.display = 'none';
      if (bubbleSticky) hideBubble();
      // ambient Barty: the occasional quip between happy hours
      if (bub.hidden && Math.random() < 0.014) {
        showBubble(BAR_QUIPS[Math.floor(Math.random() * BAR_QUIPS.length)], false, 3500);
      }
    }
  }
  setInterval(barTick, 1000);

  // ---- HUD ----
  function refreshHud() {
    el('rvCount').textContent = String(ravers.size);
    const board = el('rvBoard');
    const now = Date.now();
    const rows = [...ravers.values()]
      .sort((a, b) => a.joined - b.joined)
      .slice(0, 5)
      .map((r) => {
        const mins = Math.max(0, Math.floor((now - r.joined) / 60000));
        const name = (r.stage ? '⭐ ' : '') + (r.outfit.extras && r.outfit.extras.beer ? '🍺 ' : '') + autoName(r.outfit) + (r.id === myId ? ' (you)' : '');
        return `<li${r.id === myId ? ' class="rv-me"' : ''}><span>${name}</span><b>${mins}m</b></li>`;
      });
    board.innerHTML = rows.join('') || '<li><span>the floor awaits…</span></li>';
  }
  setInterval(refreshHud, 30000);

  // ---- websocket presence ----
  let ws = null;
  let lastPong = 0;
  function connect() {
    if (ws && ws.readyState <= 1) return; // already live or connecting — never stack sockets (a stacked one = an orphaned ghost)
    try { ws = new WebSocket(RAVE_WS); } catch (e) { return soloMode(); }
    ws.onopen = () => {
      online = true;
      lastPong = Date.now();
      el('rvStatus').textContent = 'live';
      el('rvStatus').className = 'rv-live';
      ws.send(JSON.stringify({ t: 'hi', outfit: myOutfit() }));
    };
    ws.onmessage = (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.t === 'pong') { lastPong = Date.now(); }
      else if (m.t === 'roster') {
        myId = m.you;
        // a reconnect gets a fresh roster — clear ghosts from the dead session first
        const alive = new Set(m.all.map((p) => p.id));
        [...ravers.keys()].forEach((id) => { if (!alive.has(id)) dropRaver(id); });
        m.all.forEach((p) => addRaver(p, p.id === m.you));
        if (typeof m.beerWin === 'number') beerWin = m.beerWin; // late joiners learn this window's beer is gone
        track('rave_join', { count: m.all.length });
      } else if (m.t === 'join') addRaver(m.p, false);
      else if (m.t === 'leave') dropRaver(m.id);
      else if (m.t === 'emote') floatEmote(m.id, m.k);
      else if (m.t === 'outfit') { const r = ravers.get(m.id); if (r) { r.outfit = m.outfit; refreshHud(); } }
      else if (m.t === 'move') {
        const r = ravers.get(m.id);
        if (r && !r.stage && r.id !== myId) { leanInto(r, m.x - r.x); setPos(r, m.x, m.y); }
      }
      else if (m.t === 'beer') claimBeer(m.id);
      else if (m.t === 'stage') setStage(m.id, m.on);
      else if (m.t === 'stageNo') {
        el('rvMore').textContent = m.reason === 'full' ? 'the stage is packed — try again soon' : 'not yet — keep dancing';
        setTimeout(() => { el('rvMore').textContent = ''; }, 4000);
      }
    };
    ws.onclose = () => { if (!online) soloMode(); else { el('rvStatus').textContent = 'reconnecting…'; setTimeout(connect, 3000 + Math.random() * 4000); } };
    ws.onerror = () => {};
  }
  // say a clean goodbye when actually LEAVING (navigation / tab close) so the floor
  // drops your ghost instantly — iOS never sends a close frame on its own and the
  // banana kept dancing for minutes (Trym caught his own ghost). Brief app-switches
  // deliberately do NOT disconnect: pocket-AFK endurance farming is the sport.
  addEventListener('pagehide', () => { try { if (ws) ws.close(); } catch (e) {} });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && online && (!ws || ws.readyState > 1)) connect();
  });

  // heartbeat with a DEADLINE: the server pongs without waking (auto-response), so a
  // missing pong = zombie socket (readyState lies at 1 after a worker redeploy or NAT
  // drop — send() goes into the void). Force-close → the onclose reconnect takes over.
  setInterval(() => {
    if (!ws || ws.readyState !== 1) return;
    if (lastPong && Date.now() - lastPong > 100000) {
      try { ws.close(); } catch (e) {}
      return;
    }
    try { ws.send('{"t":"ping"}'); } catch (e) {}
  }, 40000);

  function soloMode() {
    el('rvStatus').textContent = 'solo mode (connection trouble) — still dancing';
    myId = 'me';
    addRaver({ id: 'me', outfit: myOutfit(), joined: Date.now() }, true);
  }

  // ---- emotes ----
  document.querySelectorAll('.rv-emote-btn').forEach((b) => {
    b.addEventListener('click', () => {
      const k = b.dataset.emote;
      if (ws && ws.readyState === 1) ws.send(JSON.stringify({ t: 'emote', k }));
      if (myId) floatEmote(myId, k); // instant local echo
      track('rave_emote', { k });
    });
  });

  // ---- the stage: survive STAGE_UNLOCK_MS → dance behind the DJ, earn the 🔥 ----
  const stageBtn = el('rvStageBtn');
  const fireBtn = document.querySelector('.rv-emote-btn--fire');
  const onStage = () => { const me = ravers.get(myId); return !!(me && me.stage); };

  function refreshStageUi() {
    if (!myId) return;
    const left = STAGE_UNLOCK_MS - (Date.now() - sessionStart);
    stageBtn.hidden = false;
    if (onStage()) {
      stageBtn.disabled = false;
      stageBtn.textContent = '↩ back to the floor';
    } else if (left > 0) {
      const m = Math.floor(left / 60000), s = Math.ceil((left % 60000) / 1000) % 60;
      stageBtn.disabled = true;
      stageBtn.textContent = `⭐ stage opens in ${m}:${String(s).padStart(2, '0')}`;
    } else {
      stageBtn.disabled = false;
      stageBtn.textContent = '⭐ join the stage';
    }
    fireBtn.hidden = !onStage();
  }
  setInterval(refreshStageUi, 1000);

  // ---- the glowstick souvenir: 30 minutes on the floor → a glowstick, forever ----
  let glowChecked = false;
  function checkGlowstick() {
    if (glowChecked || !myId || Date.now() - sessionStart < GLOW_MS) return;
    glowChecked = true;
    let had = false;
    try {
      had = localStorage.getItem('rv-glowstick') === '1';
      localStorage.setItem('rv-glowstick', '1');
    } catch (e) {}
    if (had) return; // already earned on an earlier night
    // put it on right here on the floor, for everyone to see
    const me = ravers.get(myId);
    if (me) {
      me.outfit.extras = { ...(me.outfit.extras || {}), glowstick: true };
      if (ws && ws.readyState === 1) ws.send(JSON.stringify({ t: 'outfit', outfit: me.outfit }));
    }
    // the saved builder banana wears it home too
    try {
      const saved = JSON.parse(localStorage.getItem('bb-last') || '{}');
      saved.extras = { ...(saved.extras || {}), glowstick: true };
      localStorage.setItem('bb-last', JSON.stringify(saved));
    } catch (e) {}
    const toast = document.createElement('div');
    toast.className = 'rv-glowtoast';
    toast.innerHTML = '🎉 <b>30 MINUTES ON THE FLOOR!</b><br>The glowstick is yours — forever. Your banana is holding it right now, and it\'s waiting in the builder too.';
    floor.appendChild(toast);
    setTimeout(() => toast.remove(), 9000);
    track('rave_glowstick_unlock');
  }
  setInterval(checkGlowstick, 5000);

  stageBtn.addEventListener('click', () => {
    if (stageBtn.disabled) return;
    const want = !onStage();
    if (ws && ws.readyState === 1) ws.send(JSON.stringify({ t: 'stage', on: want }));
    else if (myId) setStage(myId, want); // solo mode: the stage is all yours
    track(want ? 'rave_stage_join' : 'rave_stage_leave');
  });

  // ---- the render loop: everyone dances off the same clock ----
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let lastIdx = -1, lastDrop = null, lastTick = 0;
  function tick() {
    const now = Date.now();
    const dtMs = lastTick ? Math.min(now - lastTick, 100) : 16;
    lastTick = now;
    stepMe(now, dtMs);
    updateCam();
    for (const r of ravers.values()) {
      if (r.lastWalk && now - r.lastWalk > 300) stopLean(r); // came to rest — stand straight (keep facing)
    }
    const secs = (now / 1000) % DROP_PERIOD;
    const dropActive = secs < DROP_LEN;
    const cycleMs = dropActive ? 480 : 800;
    const idx = Math.floor((now % cycleMs) / (cycleMs / NFRAMES));

    if (dropActive !== lastDrop) {
      lastDrop = dropActive;
      document.body.classList.toggle('rv-drop', dropActive && !reduced);
      el('rvDropFlash').hidden = !dropActive;
    }
    if (idx !== lastIdx) {
      lastIdx = idx;
      const hue = dropActive ? Math.floor((now / 12) % 360) : 0;
      for (const r of [...ravers.values()].slice(0, MAX_VISIBLE)) {
        const o = r.outfit;
        drawComposite(r.cv.getContext('2d'), 160, idx, {
          bg: 'transparent', captions: false,
          hat: o.hat, glasses: o.glasses, extras: o.extras || {}, top: '', bottom: '',
          effect: dropActive ? 'confetti' : o.effect,
          hue: dropActive ? hue : (o.effect === 'disco' ? (360 * idx / NFRAMES) : 0),
        });
      }
      if (djCv) {
        drawComposite(djCv.getContext('2d'), 200, idx, {
          bg: 'transparent', captions: false,
          hat: djOutfit.hat, glasses: djOutfit.glasses, extras: djOutfit.extras, top: '', bottom: '',
          effect: dropActive ? 'disco' : djOutfit.effect,
          hue: dropActive ? Math.floor((now / 12) % 360) : 0,
        });
      }
      const extra = ravers.size - MAX_VISIBLE;
      el('rvMore').textContent = extra > 0 ? '+' + extra + ' more bananas in the back' : '';
    }
    requestAnimationFrame(tick);
  }

  assetsReady().then(() => {
    // Barty the bartender: drawn ONCE (static NPC — he's working, not dancing),
    // frame 4 = the first left-facing pose, moustache + bow tie = the uniform
    const barCv = el('rvBarman');
    if (barCv) {
      drawComposite(barCv.getContext('2d'), 160, 4, {
        bg: 'transparent', captions: false,
        hat: 'none', glasses: 'none', extras: { mustache: true, bowtie: true }, top: '', bottom: '',
        effect: 'none',
      });
    }
    connect();
    requestAnimationFrame(tick);
  });
}
