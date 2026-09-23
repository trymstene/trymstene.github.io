// 🍋 THE LEMONADE STAND — Fig Jr.'s counter (22 Sep 2026, docs/town-jobs-plan.md §11.5).
//
// Fig Jr. hires you the way every boss does. You tap the stand, your banana walks up and takes its place
// behind the table, townsbananas come to the front the way they come to the café's rope, and you make
// each glass with three one-thumb gestures: squeeze a lemon (a hold), drop the ice (three taps on a
// pulse), pour to the line (a sweeping needle). Tips at clock-out, through the one faucet the server
// knows — a tips job like the café, never a payslip.
//
// ⭐ THE CAFÉ'S COUNTER ENGINE, WITH A LEMONADE DECK ON IT (the plan's own shape: "same tray, a lemonade
// deck"). town-cafe.js is configurable now — this file is the configuration and nothing else: the deck,
// the rope, the words, the held item, the mark and the way of standing behind the counter. Every rule the
// café learned the hard way (the thumb's own timestamp, the mark, the queue along a lane, the toast above
// the tray, one payout at the end) is inherited rather than re-learned.
import { bootTownCafe, CAFE_DECK } from './town-cafe.js';

// ⭐ THE WORDS ARE GLOBBED HERE, in the stand's own lazy chunk, the café's rule
const COPY_MODS = import.meta.glob('../data/copy/town-lemon.json', { eager: true, import: 'default' });
export const COPY = Object.values(COPY_MODS)[0] || {};

// the deck: the café's three MEASURED stations, in the order a lemonade is made — the numbers were
// tuned against a simulated thumb and hold for a hold, a pulse and a needle whatever they are called
export const LEMON_DECK = {
  id: 'lemon',
  order: ['squeeze', 'ice', 'pour'],
  stations: {
    squeeze: { ...CAFE_DECK.stations.pour, kind: 'hold' },    // a lemon squeezed until the glass has enough, let go in the band
    ice: { ...CAFE_DECK.stations.milk, kind: 'taps' },        // three cubes on the pulse
    pour: { ...CAFE_DECK.stations.grind, kind: 'sweep' },     // the water to the line: stop the needle
  },
  // the drinks, as PICTURES on the ticket — a lemon, a mint leaf, a splash of pink, ice; the names are the rig's
  drinks: {
    still: ['lemon', 'ice'],
    minty: ['lemon', 'mint', 'ice'],
    pink: ['lemon', 'pink', 'ice'],
  },
};

// 🍋 WHERE THE STAND IS. It is ONE overlay sprite (town-geo.js OVERLAYS: ov-50.png at 853,444, 74×101, base 545)
// with no PROPS entry, so its counter is these numbers, measured off the sprite: the board with the lemon on
// it at 453–483, an open gap of twelve pixels at 484–495, the table at 496–542, the LEMONADE plank hung above
// it all. The customers queue on Hall Street south of the table; the walk from a tap stops at its front.
export const STAND = { x: 890, front: { x: 890, y: 556 }, sprite: { top: 444, boardTop: 453, gapTop: 484, tableTop: 496, goodsTop: 502, base: 545, img: '/assets/town/ov-50.png', x0: 853, w: 74, h: 101 } };
// ⚠️ INSIDE A LANE, OR THE ROUTER WILL NOT WALK THEM THERE (town-folk.js): Hall Street is 156,560 → 2020,660.
// The first customer stands at the counter, the second one body-width (99 px) east of it, both with their
// feet on the street and the table between them and the vendor.
export const ROPE = [[890, 598], [989, 598]];

// ---- the vendor behind the counter ---------------------------------------------------------------
// ⭐ DRAWN IN FRONT OF THE STALL AND CLIPPED AT THE TABLE'S EDGE — the café's window recipe with the stall's own
// geometry. Trym, 22 Sep, with a screenshot: "my banana stands behind the sign, my banana should be anchored
// lower with at least half a banana". A banana simply walked behind the stall showed a sliver in the twelve-
// pixel gap, because the stall is one sprite and draws over everything behind it. So the vendor is its own
// canvas ABOVE the stall: feet below the counter's top edge, everything under that edge cut away, the upper
// body over the board, the head just under the plank — a banana of nearly full size, more than half of it
// in view, standing behind a table. Your own banana on the cobbles is hidden while it stands there.
const DRAWN = 66;      // the banana's height at the counter (the café's window banana is 58)
// ⚠️ CHEST-UP, LIKE THE CAFÉ'S WINDOW. At 522 the counter's edge cut the banana across the middle and it read as
// sawn in half (Trym, with a screenshot: "anchor my banana a little lower, you can see that the banana is cut in
// half"). Lower, the edge takes the body and leaves the head, the shoulders and the raised hands — the half of a
// banana that has a face in it, which is what standing behind a counter looks like.
const FLOOR = 536;     // its feet: well under the counter, so the edge leaves the head, the shoulders and the hands
// ⭐ AND THE STAND IS IN FRONT OF IT (Trym, 23 Sep, with a screenshot: "my banana in work mode behind the lemon stand is cut
// too much, we need to show more of the upper body, the anchoring looks fine but needs more of the user banana at the
// bottom and the stand should overflow the banana"). A straight clip at the table's edge took the mouth. Now the stall's
// own counter — the sprite from the table's edge down, the lemons and glasses on it — is drawn again OVER the vendor, so
// the banana shows down to where the goods start and the counter's shape, not a ruler line, hides the rest. Same anchor.
const POSE = 2;        // frame 2: front-facing, both hands up — the pack's serving pose
const FRAME_H_FRAC = 0.66, FRAME_TOP_FRAC = 0.20;   // src/lib/banana-geo.js — the drawn frame inside its square canvas

export function bootTownLemon(ctx) {
  const { world, W, H, pct, drawMe, outfit, pos } = ctx;
  let atWork = null, rz = 0;
  const w = DRAWN / FRAME_H_FRAC;                                    // the ELEMENT is bigger than the banana: hats live in the headroom
  const bottom = FLOOR + (1 - FRAME_TOP_FRAC - FRAME_H_FRAC) * w;    // where translate(-50%, -100%) puts the element's bottom edge
  const clipBelow = (bottom - STAND.sprite.goodsTop) / w * 100;      // the share of the canvas under the goods' top (the counter drawn over it hides the rest)
  const S = STAND.sprite, ROW = S.tableTop - S.top;                   // the counter's first row inside the sprite
  let front = null;
  function paint() {
    if (!atWork) return;
    const cv = atWork.firstChild;
    // ⚠️ drawn at the size it is shown, device ratio and all (the café's rule: the smallest banana on screen has the least room to be sloppy)
    const px = Math.max(24, Math.round(atWork.getBoundingClientRect().width * (window.devicePixelRatio || 1)));
    if (cv.width !== px) { cv.width = cv.height = px; }
    const g = cv.getContext('2d');
    g.clearRect(0, 0, px, px);
    try { drawMe(g, px, POSE, outfit ? outfit() : {}); } catch (e) {}
  }
  function standIn() {
    if (atWork || !world) return;
    const el = document.createElement('div');
    el.className = 'tw-atwork tw-atwork--stand';
    const cv = document.createElement('canvas');
    el.appendChild(cv);
    el.style.width = pct(w, W);
    el.style.left = pct(STAND.x, W);
    el.style.top = pct(bottom, H);
    el.style.zIndex = String(100 + STAND.sprite.base + 1);   // over the stall, under the customers at the rope
    el.style.clipPath = 'inset(0 0 ' + clipBelow.toFixed(2) + '% 0)';
    world.appendChild(el);
    atWork = el;
    front = document.createElement('div');   // the stall's counter, once more, over the vendor
    front.className = 'tw-atwork-front';
    front.style.cssText = 'position:absolute;overflow:hidden;pointer-events:none;left:' + pct(S.x0, W) + ';top:' + pct(S.tableTop, H) + ';width:' + pct(S.w, W) + ';height:' + pct(S.h - ROW, H) + ';z-index:' + (100 + S.base + 2);
    front.innerHTML = '<img alt="" draggable="false" src="' + S.img + '" style="position:absolute;left:0;width:100%;image-rendering:pixelated;top:' + (-ROW / (S.h - ROW) * 100).toFixed(3) + '%">';
    world.appendChild(front);
    paint();   // only once it is IN the world, because the size it is drawn at is the size it lands at
    const me = world.querySelector('.tw-me');
    if (me) me.classList.add('is-serving');   // ⚠️ a CLASS, never [hidden]: authored display beats it
  }
  function stepOut() {
    if (atWork) { atWork.remove(); atWork = null; }
    if (front) { front.remove(); front = null; }
    clearTimeout(rz);
    const me = world && world.querySelector('.tw-me');
    if (me) me.classList.remove('is-serving');
  }
  const onResize = () => { clearTimeout(rz); rz = setTimeout(paint, 120); };
  window.addEventListener('resize', onResize);

  const c = bootTownCafe(ctx, {
    at: 'stand', deck: LEMON_DECK, copy: COPY, rope: ROPE, item: 'lemoncup',
    mark: () => ({ x: STAND.front.x, y: STAND.front.y }),   // the counter is a distance from the table's front, where the walk stops
    standIn, stepOut,
  });
  void pos;
  return {
    ...c,
    redraw: paint,
    seam: {
      ...c.seam,
      // the vendor as drawn: where it stands, how much of it the counter's edge takes, and that it is over the stall
      vendor: () => (atWork ? { z: +atWork.style.zIndex, top: atWork.style.top, w: atWork.style.width, clip: atWork.style.clipPath, floor: FLOOR, drawn: DRAWN, tableTop: STAND.sprite.tableTop, goodsTop: STAND.sprite.goodsTop, frontZ: front ? +front.style.zIndex : 0 } : null),
    },
  };
}
