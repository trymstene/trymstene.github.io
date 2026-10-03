// 🔤 THE WORLD'S MARKS STAND ABOVE ITS NIGHT (3 Oct 2026, design library §56).
//
// A player's name, an animal's heart, a reward's +1 are said to YOU, they are not the scene. Trym, 3 Oct 2026: "the
// nicknames can overflow the dark, dont add light effect on it - it flickers and look weird when they move around, goes
// for all areas", and of an animal's emote: "speechbubbles with emotes like heart and broken heart emotes can overflow the
// darkness and have no light around the bubble elements".
// ⚠️ Clear patches cut into the light map round them were tried first: they lit whatever stood in front of a bubble (a hen
// behind the angel statue left a bright square on the statue), trailed every moving name and flickered.
//
// So at night they LEAVE the world. One layer on the area's VIEW, above the world, its night and its rain and under the HUD:
//   · a name or a bubble rides in a TWIN of its owner's box — its box where it is on screen and its flip, read every frame
//     after the camera — so the mark's own CSS still places it (a bubble's 15%-and-7px lift, a counter-flip) and nothing in
//     the world ever stands in front of it. ⚠️ A twin carries NONE of its owner's classes or data-pid: a page-wide
//     `.tw-peer` or `[data-pid]` must still find each player once. A name is dressed by its own class here, and the green
//     dot and the NEW chip read the twin's data-pid-of / data-new-of (world-social.js);
//   · a float rises in a pane laid exactly over the world, so its own % position still holds — and so does a word the area
//     places in the world's % itself (the bay's keepers' speech bubbles: pin());
// By day, and indoors, every mark is back in its owner and the world is exactly what it was. The night drives it: world-night
// ticks the layer (on while the night shows), so an area only registers its marks — marksFor(view, world) at boot, lift()
// as a name or a bubble is made, float() instead of appending a float to the world.
const CSS = '.wm{position:absolute;inset:0;pointer-events:none;overflow:hidden}'
  + '.wm[hidden]{display:none!important}'
  + '.wm>.wm-twin{position:absolute!important;transition:none!important;animation:none!important;background:none!important;'
  + 'filter:none!important;box-shadow:none!important;border:0!important;pointer-events:none!important;margin:0!important}'
  + '.wm>.wm-twin>.bw-name{position:absolute;left:50%;top:-14px;transform:translateX(-50%);font-size:.5rem;font-weight:800;'
  + 'letter-spacing:.05em;color:#fffdf5;text-shadow:1px 1px 0 #000;white-space:nowrap}'
  + '.wm>.wm-pan{position:absolute;pointer-events:none}';

/**
 * The view's marks layer, made once. ⚠️ Pass the world on the first call — a float needs it.
 * @returns { lift(mark, owner), float(el), pin(el), tick(on), on() }
 */
export function marksFor(view, world) {
  if (!view) return null;
  if (view.__wm) { if (world && !view.__wm.world) view.__wm.world = world; return view.__wm; }
  if (!document.getElementById('wm-css')) { const st = document.createElement('style'); st.id = 'wm-css'; st.textContent = CSS; document.head.appendChild(st); }
  const layer = document.createElement('div');
  layer.className = 'wm';
  layer.hidden = true;
  layer.setAttribute('aria-hidden', 'true');
  layer.style.zIndex = String((parseInt(getComputedStyle(view).getPropertyValue('--wn-z'), 10) || 7) + 1);   // one over the night
  const pan = document.createElement('div');
  pan.className = 'wm-pan';
  layer.appendChild(pan);
  view.appendChild(layer);
  const live = [];   // { mark, owner, twin, pid, nw, fl, seen }
  const pinned = [];   // words placed in the world's own % (a keeper's bubble): the pane by night, the world by day
  let night = false;

  // a mark is done with when its owner has left the world (after having been in it), or the area took the mark away
  function gone(m) {
    if (m.owner.isConnected) m.seen = true;
    return (m.seen && !m.owner.isConnected) || (m.mark.parentNode !== m.owner && m.mark.parentNode !== m.twin);
  }
  function place(m, lb) {
    const r = m.owner.getBoundingClientRect(), t = m.twin.style;
    if (!r.width) { if (t.visibility !== 'hidden') t.visibility = 'hidden'; return; }
    const cs = getComputedStyle(m.owner);
    const pid = m.owner.dataset.pid || '', nw = m.owner.dataset.new || '';
    if (pid !== m.pid) { m.pid = pid; if (pid) m.twin.dataset.pidOf = pid; else delete m.twin.dataset.pidOf; }
    if (nw !== m.nw) { m.nw = nw; if (nw) m.twin.dataset.newOf = nw; else delete m.twin.dataset.newOf; }
    const fl = /^matrix\(\s*-/.test(cs.transform) ? 'scaleX(-1)' : 'none';   // a flipped owner flips its twin: a counter-flip still lands
    if (fl !== m.fl) { m.fl = fl; t.transform = fl; }
    t.left = (r.left - lb.left) + 'px'; t.top = (r.top - lb.top) + 'px';
    t.width = r.width + 'px'; t.height = r.height + 'px';
    t.opacity = cs.opacity; t.visibility = cs.visibility;
  }

  const api = {
    world: world || null,
    /** a name or a bubble, made inside its owner: at night it rides above the dark in the owner's twin */
    lift(mark, owner) {
      if (!mark || !owner) return mark;
      mark.wmOwner = owner;   // 🧪 whose word it is, wherever it rides (a walk finds an echo's name by it)
      const twin = document.createElement('div');
      twin.className = 'wm-twin';
      layer.appendChild(twin);
      live.push({ mark, owner, twin, pid: '', nw: '', fl: '', seen: false });   // the next night tick lifts it, once its owner is placed
      return mark;
    },
    /** a float, positioned in the world's own % — over the world by day, in the pane above the night at night */
    float(el) { (night ? pan : (api.world || pan)).appendChild(el); return el; },
    /** a word the area keeps in the world's own % for good (a keeper's speech bubble): over the night at night */
    pin(el) { if (el) { pinned.push(el); if (night) pan.appendChild(el); } return el; },
    /** world-night calls this every frame, after the area's camera: on = the night is showing */
    tick(on) {
      if (!on) {
        if (!night) return;
        night = false;
        layer.hidden = true;
        for (let i = live.length - 1; i >= 0; i--) {
          const m = live[i];
          if (gone(m)) { m.twin.remove(); live.splice(i, 1); continue; }
          if (m.mark.parentNode === m.twin) m.owner.appendChild(m.mark);   // home for the day
        }
        if (api.world) for (const el of pinned) if (el.parentNode === pan) api.world.appendChild(el);
        return;
      }
      if (!night) { night = true; layer.hidden = false; }
      const lb = layer.getBoundingClientRect();
      for (let i = live.length - 1; i >= 0; i--) {
        const m = live[i];
        if (gone(m)) { m.twin.remove(); live.splice(i, 1); continue; }
        if (!m.owner.isConnected) continue;   // made, not yet in the world
        if (m.mark.parentNode !== m.twin) m.twin.appendChild(m.mark);
        place(m, lb);
      }
      for (const el of pinned) if (el.parentNode !== pan) pan.appendChild(el);
      if (api.world && pan.firstChild) {
        const wr = api.world.getBoundingClientRect(), p = pan.style;
        p.left = (wr.left - lb.left) + 'px'; p.top = (wr.top - lb.top) + 'px'; p.width = wr.width + 'px'; p.height = wr.height + 'px';
      }
    },
    on: () => night,
  };
  return (view.__wm = api);
}
