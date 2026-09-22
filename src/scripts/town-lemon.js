// 🍋 THE LEMONADE STAND — Fig Jr.'s counter (22 Sep 2026, docs/town-jobs-plan.md §11.5).
//
// Fig Jr. hires you the way every boss does. You tap the stand, your banana walks up and steps round the
// back of the table, townsbananas come to the front the way they come to the café's rope, and you make
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

// 🍋 WHERE THE STAND IS (tools/build-town-scene.py: the stall at 890,545, its table 854–926 × 529–549). It has
// no PROPS entry — it is baked scenery with a spot — so its counter is these numbers, measured on the built
// square: the vendor stands BEHIND the table at 518 (feet above the table's edge, the table drawn over the
// legs, the face in the gap under the awning — the stall's own pixels frame the banana, no clip needed),
// the walk from a tap stops at the table's front, and the customers queue on Hall Street south of it.
export const STAND = { behind: { x: 890, y: 518 }, front: { x: 890, y: 556 } };
// ⚠️ INSIDE A LANE, OR THE ROUTER WILL NOT WALK THEM THERE (town-folk.js): Hall Street is 156,560 → 2020,660.
// The first customer stands at the counter, the second one body-width (99 px) east of it, both with their
// feet on the street and the table between them and the vendor.
export const ROPE = [[890, 598], [989, 598]];
const STEP = 70;   // a tap on the stand walks you to its front; from this close the shift begins with a step round the back

export function bootTownLemon(ctx) {
  const { pos, tgt } = ctx;
  return bootTownCafe(ctx, {
    at: 'stand', deck: LEMON_DECK, copy: COPY, rope: ROPE, item: 'lemoncup',
    mark: () => ({ x: STAND.behind.x, y: STAND.behind.y }),
    // 🍋 STEPPING BEHIND THE COUNTER. The table is solid, so the walk from a tap stops in front of it; the shift
    // begins with one step round the back — only from the front, never from across the square, so coming back
    // on the mark after a wander is a walk and not a jump.
    standIn: () => {
      if (Math.hypot(pos.x - STAND.front.x, pos.y - STAND.front.y) > STEP) return;
      pos.x = STAND.behind.x; pos.y = STAND.behind.y;
      if (tgt) { tgt.x = pos.x; tgt.y = pos.y; }
    },
    stepOut: () => {},
  });
}
