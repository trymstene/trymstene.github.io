// THE WEARABLE CATALOG — the single source of truth for every hat, pair of
// shades and extra the banana can wear. PURE DATA (no DOM, no Image, no SVG
// strings) so it imports safely EVERYWHERE: the client render engine
// (banana-engine.js), the server-safe daily picker (banana-daily.js), Astro
// frontmatter, and — copied verbatim — the rave worker's allowlist.
//
// Before this file the same catalog lived in three places that had to be kept
// in sync by hand (engine PACKS + daily PACK_POOLS + worker EXTRA_IDS). Now
// there is ONE list. To add a wearable: add an entry here, then (client only)
// paste its pixel SVG into the SVG dict in banana-engine.js under the `art` key.
//
// FIELD REFERENCE
//   id            stable key, stored in outfits + URLs + bb-last (never rename)
//   label         builder chip text
//   phrase        sentence form for the daily banana ("a party hat")
//   art           key into banana-engine.js's SVG dict (the pixel art)
//   front / side  art keys for face-anchored pieces that differ by facing
//   seat          hat-only: vertical seating tweak (outlined hats sit -1)
//   anchor        extra-only: 'face' | 'chest' | 'hand'
//   dy, sideDx    extra placement offsets (grid units)
//   hand, grip    hand-anchored items: which glove + grip depth (grid units)
//   earned        gates the item behind proof — 'rave' | 'golden' (builder shows a locked chip)
//   raveOnly      server-granted / draw-time only; never a builder chip, never randomized, excluded from the daily
//   lock          the locked-chip explanation shown in the builder
//
// Packs group wearables; `always:true` = the core set. A seasonal pack adds a
// `window: { from:'MM-DD', to:'MM-DD' }` and auto-activates in that range.
// Each CONSUMER applies its own active-check (the engine honours ?pack= and
// local date; the daily uses the UTC date) — so only the data lives here.

export const WEARABLE_PACKS = {
  core: {
    label: 'The classics',
    always: true,
    hats: [
      { id: 'party',  label: 'Party',   phrase: 'a party hat',  art: 'party',  seat: -1 },
      { id: 'crown',  label: 'Crown',   phrase: 'a crown',      art: 'crown',  seat: -1 },
      { id: 'tophat', label: 'Top hat', phrase: 'a top hat',    art: 'tophat', seat: 0  },
      { id: 'cowboy', label: 'Cowboy',  phrase: 'a cowboy hat', art: 'cowboy', seat: -1 },
      { id: 'viking', label: 'Viking', phrase: 'a viking helmet', art: 'viking', seat: -1 },
      { id: 'sombrero', label: 'Sombrero', phrase: 'a big sombrero', art: 'sombrero', seat: -1 },
      // NEW ITEMS ship via the review loop: add with `preview: true` (drawable,
      // /dev-wearables/ renders it, but hidden from every public surface),
      // Trym approves on the desk, then delete the flag + extend the worker
      // HAT_IDS/SHADE_IDS/EXTRA_IDS mirrors + deploy worker-rave.
      { id: 'halo', label: 'Halo', phrase: 'a golden halo', art: 'halo', seat: -1 },
      { id: 'beanieprop', label: 'Propeller beanie', phrase: 'a propeller beanie', art: 'beanieprop', seat: -1 },
      { id: 'backwardscap', label: 'Backwards cap', phrase: 'a backwards cap', art: 'backwardscap', seat: 0 },
      { id: 'gradcap', label: 'Graduation cap', phrase: 'a graduation cap', art: 'gradcap', seat: -1 },
      { id: 'tricorn', label: 'Pirate tricorn', phrase: 'a pirate tricorn', art: 'tricorn', seat: -1 },
      { id: 'jester', label: 'Jester hat', phrase: 'a jester hat with bells', art: 'jester', seat: -1 },
      // BATCH 3 (17 Jul, the absurd edition - approved through 5 review rounds)
      { id: 'friedegg', label: 'Fried egg', phrase: 'a fried egg on top', art: 'friedegg', seat: -1 },
      // perched, not worn: 5 transparent bottom rows in the art + seat -1 ≈ feet on the tip
      { id: 'pigeon', label: 'Pigeon', phrase: 'a pigeon passenger', art: 'pigeon', seat: -1 },
      // the gag rides THROUGH the head, not on it — positive seat pushes it down
      { id: 'arrowthru', label: 'Arrow gag', phrase: 'an arrow through the head', art: 'arrowthru', seat: 3 },
      { id: 'fishbowl', label: 'Fishbowl helmet', phrase: 'a fishbowl helmet with a goldfish', art: 'fishbowl', seat: -1 },
      { id: 'devilhorns', label: 'Devil horns', phrase: 'devil horns', art: 'devilhorns', seat: 0 },
      // BATCH 4 (18 Jul, the goodnight set — rides Giphy's evergreen 'goodnight' tag)
      { id: 'nightcap', label: 'Nightcap', phrase: 'a cosy nightcap', art: 'nightcap', seat: -1 },
      // 🎧 THE FIRST RAVE DROP (18 Jul) — caught on the dance floor, never in the
      // default builder (locked chip until you catch it). earned:'rave' + its own
      // `flag`; `drop:true` lists it in DROPS (the catchable lineup); `by` credits
      // the maker (Barty's booth). seat pushes it down so the band caps the head
      // and the cyan cups reach ear level.
      { id: 'djheadphones', label: 'DJ headphones', phrase: 'DJ headphones', art: 'djheadphones', side: 'djheadphonesSide', seat: 8, sideSeat: 8, behindFront: true,
        earned: 'rave', flag: 'rv-djheadphones', by: 'Barty', drop: true,
        lock: 'a rave drop: catch it on the dance floor — straight from Barty’s booth' },
      // 🍌🏪 STAND BATCH 1 (21 Jul, the absurd edition — banana-stand exclusives,
      // on the /dev-wearables/ desk awaiting Trym's verdicts)
      { id: 'duckhat', label: 'Duck on your head', phrase: 'a duck passenger', art: 'duckhat', seat: -2, preview: true },
      { id: 'melticecream', label: 'Melting ice cream', phrase: 'a melting ice cream scoop', art: 'melticecream', seat: 0, preview: true },
      { id: 'watermelonhat', label: 'Watermelon helmet', phrase: 'half a watermelon, worn open side down', art: 'watermelonhat', seat: -1, preview: true },
      { id: 'buckethat', label: 'Bucket', phrase: 'a bucket, worn confidently', art: 'buckethat', seat: 0, preview: true },
      { id: 'snailhat', label: 'Snail', phrase: 'a snail passenger', art: 'snailhat', seat: -1, preview: true },
      // tentacles hang DOWN the head: positive seat, the arrowthru trick
      { id: 'squidhat', label: 'Squid hat', phrase: 'a squid hugging the head', art: 'squidhat', seat: 6, preview: true },
    ],
    shades: [
      { id: 'shades', label: 'Shades', phrase: 'sunglasses', front: 'shadesFront', side: 'shadesSide' },
      { id: 'dwi', label: 'Deal with it', phrase: '"deal with it" shades', front: 'dwiFront', side: 'dwiSide' },
      { id: 'hearts', label: 'Hearts',       phrase: 'heart shades',          front: 'heartsFront', side: 'heartsSide' },
      { id: 'visor',  label: 'Visor',        phrase: 'a visor',               front: 'visorFront',  side: 'visorSide'  },
      { id: 'threed', label: '3D', phrase: '3D glasses', front: 'threedFront', side: 'threedSide' },
      { id: 'potter', label: 'Rounds', phrase: 'round wizard glasses', front: 'potterFront', side: 'potterSide' },
      { id: 'nerd', label: 'Nerd glasses', phrase: 'taped nerd glasses', front: 'nerdFront', side: 'nerdSide' },
      { id: 'monocle', label: 'Monocle', phrase: 'a gold monocle', front: 'monocleFront', side: 'monocleSide' },
      { id: 'groucho', label: 'Groucho', phrase: 'the full groucho disguise', front: 'grouchoFront', side: 'grouchoSide' },
      { id: 'eyepatch', label: 'Eye patch', phrase: 'a pirate eye patch', front: 'eyepatchFront', side: 'eyepatchSide' },
      // BATCH 3 (17 Jul, the absurd edition - approved through 5 review rounds)
      { id: 'googlyeyes', label: 'Googly eyes', phrase: 'giant googly eyes', front: 'googlyFront', side: 'googlySide' },
      { id: 'cucumbers', label: 'Cucumber slices', phrase: 'spa cucumber slices', front: 'cucumberFront', side: 'cucumberSide' },
      // 🍌🏪 STAND BATCH 1 (21 Jul) — on the desk (coineyes + xrayspecs killed round 2)
      { id: 'snorkelmask', label: 'Snorkel & mask', phrase: 'a snorkel and mask', front: 'snorkelmaskFront', side: 'snorkelmaskSide', preview: true },
    ],
    // extras anchor to the FACE (eye anchor + dy, front/side art, mirrored on
    // left-facing frames), the CHEST (per-frame btCx body centre + dy), or a
    // HAND (per-frame glove centre + grip).
    extras: [
      { id: 'mustache', label: 'Moustache', phrase: 'a fine moustache', anchor: 'face',  dy: 4.0, sideDx: -1.2, front: 'mustacheFront', side: 'mustacheSide' },
      { id: 'fatstache', label: 'Fat moustache', phrase: 'a fat black moustache', anchor: 'face', dy: 4.0, sideDx: -1.2, front: 'fatstacheFront', side: 'fatstacheSide' },
      // the BODY zone — chest-anchored garments + neckwear that all fight for
      // the same torso pixels (bow tie, ties, chains, scarves, nightshirts…),
      // so the builder treats them as a mutually-exclusive group (zone is UI
      // grouping only; the engine keeps drawing via the chest anchor + per-item dy).
      { id: 'bowtie',   label: 'Bow tie',   phrase: 'a bow tie',        anchor: 'chest', zone: 'body', dy: 9.5, art: 'bowtie' },
      { id: 'necktie',  label: 'Necktie',   phrase: 'a blue necktie',   anchor: 'chest', zone: 'body', dy: 11.5, art: 'necktie' },
      { id: 'goldchain', label: 'Gold chain', phrase: 'a gold chain',   anchor: 'chest', zone: 'body', dy: 9.0, art: 'goldchain' },
      { id: 'scarf',    label: 'Scarf',     phrase: 'a cosy red scarf', anchor: 'chest', zone: 'body', dy: 8.5, art: 'scarf' },
      // id is coneofshame, NOT cone (the rave owns 'cone'
      // as the happy-hour traffic-cone grant); open middle so the face shows
      // dy 2 + tall solid art = the rim reaches the eyes and the face vanishes
      // into the cone (Trym: that IS the joke)
      { id: 'coneofshame', label: 'Cone of shame', phrase: 'the cone of shame', anchor: 'chest', zone: 'body', dy: 3, art: 'coneofshame' },
      // replaced duckfloatie (yellow-on-yellow, killed round 2)
      { id: 'lifering', label: 'Life ring', phrase: 'a life preserver ring', anchor: 'chest', zone: 'body', dy: 10, art: 'lifering' },
      // BATCH 4 (18 Jul) — the nightshirt, first true BODY GARMENT (proves the
      // renamed slot holds torso wear, not just neckwear); A-line skirt flare so
      // it reads as cloth; dy tuned low so it drapes the torso but the face +
      // feet still show
      { id: 'nightshirt', label: 'Nightshirt', phrase: 'a cosy nightshirt', anchor: 'chest', zone: 'body', dy: 15, art: 'nightshirt' },
      // 🍌🏪 STAND BATCH 1 (21 Jul) — body zone, on the desk
      { id: 'flamingoring', label: 'Flamingo ring', phrase: 'a flamingo pool ring', art: 'flamingoring', anchor: 'chest', dy: 12, zone: 'body', preview: true },
      { id: 'medal', label: 'Participation medal', phrase: 'a participation medal', art: 'medal', anchor: 'chest', dy: 11, zone: 'body', preview: true },
      // the FEET slot — footwear rides the feet anchor; single-select (one pair
      // at a time), so these behave as a mutually-exclusive group in the builder.
      { id: 'sneakers',     label: 'Red sneakers',  phrase: 'red sneakers',  anchor: 'feet', art: 'sneakers' },
      { id: 'sneakersblue', label: 'Blue sneakers', phrase: 'blue sneakers', anchor: 'feet', art: 'sneakersblue' },
      { id: 'sneakersgold', label: 'Gold sneakers', phrase: 'gold sneakers', anchor: 'feet', art: 'sneakersgold' },
      { id: 'skates', label: 'Roller skates', phrase: 'roller skates', anchor: 'feet', art: 'skates' },
      { id: 'clownshoes', label: 'Clown shoes', phrase: 'big clown shoes', anchor: 'feet', art: 'clownshoes' },
      { id: 'cowboyboots', label: 'Cowboy boots', phrase: 'cowboy boots', anchor: 'feet', art: 'cowboyboots' },
      { id: 'discoboots', label: 'Disco boots', phrase: 'golden disco boots', anchor: 'feet', art: 'discoboots' },
      { id: 'ledsneakers', label: 'LED sneakers', phrase: 'LED sneakers', anchor: 'feet', art: 'ledsneakers' },
      { id: 'flamekicks', label: 'Flame kicks', phrase: 'flaming sneakers', anchor: 'feet', art: 'flamekicks' },
      { id: 'flippers', label: 'Swim flippers', phrase: 'swim flippers', anchor: 'feet', art: 'flippers' },
      // 🍌🏪 STAND BATCH 1 (21 Jul) — the forbidden combo, on the desk
      { id: 'sockssandals', label: 'Socks & sandals', phrase: 'socks with sandals', art: 'sockssandals', anchor: 'feet', preview: true },
      { id: 'boombox', label: 'Boombox', phrase: 'a boombox', anchor: 'hand', hand: 'left', grip: 1, art: 'boombox' },
      { id: 'mug', label: 'Coffee mug', phrase: 'a coffee mug', anchor: 'hand', hand: 'left', grip: 6, art: 'mug' },
      { id: 'trophy', label: 'Trophy', phrase: 'a golden trophy', anchor: 'hand', hand: 'right', grip: 5, art: 'trophy' },
      { id: 'boingball', label: 'Boing Ball', phrase: 'a red-white checkered ball', anchor: 'hand', hand: 'left', grip: 4, art: 'boingball' },
      // id is balloons, NOT balloon — the rave already owns 'balloon' as an
      // fx id AND a conveyor item kind; three namespaces sharing one word is a trap
      // LEFT hand (flipped 17 Jul): was right, where the rubber chicken also
      // lives — equipping both stacked one glove (Trym caught it in the ad)
      { id: 'balloons', label: 'Balloons', phrase: 'a bunch of balloons', anchor: 'hand', hand: 'left', grip: 15, art: 'balloons' },
      // batch-3 hands, balanced: chicken/sign right, fish left
      { id: 'rubberchicken', label: 'Rubber chicken', phrase: 'a rubber chicken', anchor: 'hand', hand: 'right', grip: 10, art: 'rubberchicken' },
      { id: 'bigfish', label: 'Big fish', phrase: 'a big unhappy fish', anchor: 'hand', hand: 'left', grip: 7, art: 'bigfish' },
      // behind: true = drawn BEFORE the banana body (engine behind pass), so
      // the big board rides at head height PEEKING OUT behind the head
      { id: 'protestsign', label: 'Protest sign', phrase: 'a GO BANANAS protest sign', anchor: 'hand', hand: 'right', grip: 14, art: 'protestsign', behind: true },
      // BATCH 4 (18 Jul) — the bedtime chamberstick candle
      { id: 'candle', label: 'Candle', phrase: 'a bedtime candle', anchor: 'hand', hand: 'left', grip: 11, art: 'candle' },
      // 🍌🏪 STAND BATCH 1 (21 Jul) — hands, on the desk (banana-shaped items
      // derive from the circle-diff crescent, never freehand)
      { id: 'foamfinger', label: 'Foam finger', phrase: 'a big blue foam finger', art: 'foamfinger', anchor: 'hand', grip: 9, hand: 'left', preview: true },
      { id: 'balloondog', label: 'Balloon dog', phrase: 'a balloon dog', art: 'balloondog', anchor: 'hand', grip: 10, hand: 'right', preview: true },
      { id: 'potato', label: 'A potato', phrase: 'a potato', art: 'potato', anchor: 'hand', grip: 4, hand: 'right', preview: true },
      { id: 'cactuspot', label: 'Cactus in a pot', phrase: 'a potted cactus', art: 'cactuspot', anchor: 'hand', grip: 13, hand: 'left', preview: true },
      // earned, never given: unlocked by surviving 30 min at the rave (builder shows a locked door chip).
      // NOT in the daily pools on purpose — the daily banana doesn't wear souvenirs it didn't earn.
      // anchor 'hand' rides the per-frame glove centres; grip = art grid-units from the
      // art top to where the glove wraps it (here: the black cap).
      // earned items carry their OWN proof: `flag` = a localStorage key, or
      // `patch` = a minted pass patch. earnedUnlocked() reads these generically
      // (a second earned:'rave' item must NOT unlock off the glowstick's flag).
      { id: 'glowstick', label: 'Glowstick', anchor: 'hand', hand: 'right', grip: 8.5, art: 'glowstick', earned: 'rave', flag: 'rv-glowstick',
        lock: 'a rave souvenir: survive 30 minutes on the dance floor and it’s yours forever' },
      // the trophy: earned by catching the golden banana at the rave (patch
      // `golden` is the proof of the moment); worn from the pass or the builder
      { id: 'goldbanana', label: 'Golden Banana', anchor: 'hand', hand: 'left', grip: 2, art: 'goldbanana', earned: 'golden', patch: 'golden',
        lock: 'the trophy: catch the golden banana at the rave — it strikes every half hour' },
      // happy-hour trophy: lives for one rave session, granted by the worker (first
      // banana at the bar). raveOnly = never a builder chip, never randomized.
      { id: 'cone', label: 'Traffic cone', anchor: 'face', dy: -10.5, sideDx: 0, front: 'cone', side: 'cone', raveOnly: true },
      { id: 'beer', label: 'Beer', anchor: 'hand', hand: 'left', grip: 3.5, art: 'beer', raveOnly: true },
      // the courier's record: injected at DRAW time from the rave's carry flag
      // (never in outfit broadcasts); left glove — it overflows the beer while carried
      { id: 'vinyl', label: 'Vinyl', anchor: 'hand', hand: 'left', grip: 1.5, art: 'vinyl', raveOnly: true },
      // the nightshift broom — injected at draw time from the rave's chore flag
      { id: 'broom', label: 'Broom', anchor: 'hand', hand: 'right', grip: 3, art: 'broom', raveOnly: true },
      // dinner props: worn while the rave's 'slice'/'box' fx runs (draw-time inject)
      { id: 'slice', label: 'Pizza slice', anchor: 'hand', hand: 'right', grip: 1, art: 'pizzaslice', raveOnly: true },
      { id: 'pizzabox', label: 'Pizza box', anchor: 'hand', hand: 'left', grip: 3.5, art: 'pizzaboxheld', raveOnly: true },
    ],
  },
  // Example future pack (art not drawn yet):
  // xmas: { label: 'Christmas', window: { from: '12-01', to: '12-26' },
  //         hats: [{ id: 'santa', label: 'Santa', phrase: 'a Santa hat', art: 'santa', seat: -1 }], shades: [], extras: [] },
};

// The wearable ids the RAVE WORKER should accept in a client outfit = every
// non-raveOnly extra (raveOnly items are server-granted and stripped from
// client outfits). Copy this list into worker-rave when the catalog changes;
// deriving it here means the worker can never silently drift from the engine.
export const CLIENT_EXTRA_IDS = Object.values(WEARABLE_PACKS)
  .flatMap((p) => p.extras || [])
  .filter((e) => !e.raveOnly)
  .map((e) => e.id);

// 🎁 THE DROP LINEUP — every wearable flagged `drop:true` is CATCHABLE on the
// rave floor (curation IS the drop: approving an item = adding it here). Each
// carries its slot ('hat'|'glasses'|'extra'), art key, proof `flag`, `by`
// credit and label — the rave, builder and pass all read this one list so a
// new drop never needs three edits. A dropped item is also `earned:'rave'`, so
// it's already excluded from the default builder/daily and shown locked.
export const DROPS = Object.values(WEARABLE_PACKS).flatMap((p) => [
  ...(p.hats || []).filter((d) => d.drop).map((d) => ({ id: d.id, slot: 'hat', art: d.art, flag: d.flag, by: d.by, label: d.label })),
  ...(p.shades || []).filter((d) => d.drop).map((d) => ({ id: d.id, slot: 'glasses', art: d.front, flag: d.flag, by: d.by, label: d.label })),
  ...(p.extras || []).filter((d) => d.drop).map((d) => ({ id: d.id, slot: 'extra', art: d.art || d.front, flag: d.flag, by: d.by, label: d.label })),
]);
