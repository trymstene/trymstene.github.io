// 🕹 WORLD STEERING — hold-and-drag movement for the canvas areas, extracted
// from the rave's field-verified implementation (banana-rave.js keeps its own
// inline copy: it must also re-align its game frame on quest arm).
//
// The three gestures split at the moment the finger first moves, so they never
// collide: a swipe moves immediately and stays the browser's scroll; a tap
// walks (the area's own click handler, untouched — activities keep their tap
// dispatch); a finger HELD STILL ~200ms arms the leash — from then on
// touchmoves are claimed (they stay cancelable until a real scroll starts) and
// the area is fed continuous WALK orders only, never its tap-dispatch chain,
// so no stall/bed/NPC can misfire from a steer. A steer's touchend eats the
// synthetic click (plus a capture-phase swallow, belt and braces).
//
// Contract: initSteer({ view, blocked(e), toWorld(cx,cy), onArm(), onMove(w), first() })
//  - blocked(e): true = never arm from this touch (chrome, rooms, build modes)
//  - toWorld: the area's live screen→world transform (closes over camX/scale)
//  - onArm: what a ground tap does before walking (clear pendings, stand up)
//  - onMove(w): set the area's walk target — called per move AND per frame,
//    because the follow-cam shifts the world beneath a held-still finger
//  - first(): fired once per page load on the first steer (analytics)

const HOLD = 200, SLOP = 10;

let cssDone = false;
function injectCss() {
  if (cssDone) return;
  cssDone = true;
  const st = document.createElement('style');
  st.textContent = `
.ws-ring {
  position: absolute; width: 38px; height: 38px; transform: translate(-50%, -50%);
  border: 2px solid rgba(255, 253, 245, 0.85); border-radius: 50%;
  box-shadow: 0 0 8px rgba(57, 255, 20, 0.5), inset 0 0 6px rgba(57, 255, 20, 0.35);
  pointer-events: none; z-index: 40;
  animation: wsRingPop 0.18s steps(3);
}
@keyframes wsRingPop { from { transform: translate(-50%, -50%) scale(1.6); } }`;
  document.head.appendChild(st);
}

export function initSteer({ view, blocked, toWorld, onArm, onMove, first }) {
  if (!view) return;
  injectCss();
  let timer = 0, on = false, endAt = 0, fired = false;
  let cx = 0, cy = 0, ring = null, raf = 0;

  const clampView = () => {
    const r = view.getBoundingClientRect();
    return {
      x: Math.max(r.left + 2, Math.min(r.right - 2, cx)),
      y: Math.max(r.top + 2, Math.min(r.bottom - 2, cy)),
      r,
    };
  };
  const feed = () => {
    const p = clampView();
    onMove(toWorld(p.x, p.y));
    if (ring) { ring.style.left = (p.x - p.r.left) + 'px'; ring.style.top = (p.y - p.r.top) + 'px'; }
  };
  const stop = () => {
    clearTimeout(timer); timer = 0;
    cancelAnimationFrame(raf); raf = 0;
    if (on) { on = false; endAt = Date.now(); }
    if (ring) { ring.remove(); ring = null; }
  };
  const frame = () => { if (!on) return; feed(); raf = requestAnimationFrame(frame); };
  const arm = () => {
    timer = 0;
    on = true;
    ring = document.createElement('div');
    ring.className = 'ws-ring';
    view.appendChild(ring);
    if (onArm) onArm();
    feed();
    raf = requestAnimationFrame(frame);
    if (!fired) { fired = true; if (first) first(); }
  };

  view.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1 || (blocked && blocked(e))) { stop(); return; }
    cx = e.touches[0].clientX; cy = e.touches[0].clientY;
    clearTimeout(timer);
    timer = setTimeout(arm, HOLD);
  }, { passive: true });
  view.addEventListener('touchmove', (e) => {
    if (e.touches.length !== 1) { stop(); return; }
    const t = e.touches[0];
    if (on) {
      if (!e.cancelable) { stop(); return; } // a scroll won after all — let go
      e.preventDefault();
      cx = t.clientX; cy = t.clientY;
      return; // the rAF feeds onMove
    }
    if (timer && Math.hypot(t.clientX - cx, t.clientY - cy) > SLOP) {
      clearTimeout(timer); timer = 0; // moved early = a scroll, not a hold
    }
  }, { passive: false });
  // ⚠️ THE RELEASE LISTENS ON THE WINDOW, not the view: if onArm removes the
  // node under the finger (the bay's biting float did exactly this), a
  // view-bound touchend never fires and the steer is stranded ON — the ring
  // stays and the banana keeps walking at a finger that has let go.
  addEventListener('touchend', (e) => {
    if (!on && !timer) return;
    if (on && e.cancelable) e.preventDefault(); // no ghost tap after a steer
    stop();
  }, { passive: false });
  addEventListener('touchcancel', stop, { passive: true });
  // belt + braces: some engines still deliver the click a steer produced
  view.addEventListener('click', (e) => {
    if (Date.now() - endAt < 400) { e.stopPropagation(); e.preventDefault(); }
  }, true);
}
