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
      // ⏳ PREVIEW BATCH (17 Jul) — visible only on /dev-wearables/ until Trym
      // approves; ship an item by deleting its preview flag (+ worker EXTRA_IDS
      // for extras, then Trym redeploys worker-rave)
      { id: 'halo', label: 'Halo', phrase: 'a golden halo', art: 'halo', seat: -1 },
      { id: 'beanieprop', label: 'Propeller beanie', phrase: 'a propeller beanie', art: 'beanieprop', seat: -1 },
      { id: 'backwardscap', label: 'Backwards cap', phrase: 'a backwards cap', art: 'backwardscap', seat: 0 },
      // ⏳ BATCH 2 PREVIEW (17 Jul) — on /dev-wearables/ until Trym approves
      { id: 'gradcap', label: 'Graduation cap', phrase: 'a graduation cap', art: 'gradcap', seat: -1, preview: true },
      { id: 'tricorn', label: 'Pirate tricorn', phrase: 'a pirate tricorn', art: 'tricorn', seat: -1, preview: true },
      { id: 'jester', label: 'Jester hat', phrase: 'a jester hat with bells', art: 'jester', seat: -1, preview: true },
    ],
    shades: [
      { id: 'shades', label: 'Shades', phrase: 'sunglasses', front: 'shadesFront', side: 'shadesSide' },
      { id: 'dwi', label: 'Deal with it', phrase: '"deal with it" shades', front: 'dwiFront', side: 'dwiSide' },
      { id: 'hearts', label: 'Hearts',       phrase: 'heart shades',          front: 'heartsFront', side: 'heartsSide' },
      { id: 'visor',  label: 'Visor',        phrase: 'a visor',               front: 'visorFront',  side: 'visorSide'  },
      { id: 'threed', label: '3D', phrase: '3D glasses', front: 'threedFront', side: 'threedSide' },
      { id: 'potter', label: 'Rounds', phrase: 'round wizard glasses', front: 'potterFront', side: 'potterSide' },
      { id: 'nerd', label: 'Nerd glasses', phrase: 'taped nerd glasses', front: 'nerdFront', side: 'nerdSide' },
      { id: 'monocle', label: 'Monocle', phrase: 'a gold monocle', front: 'monocleFront', side: 'monocleSide', preview: true },
      { id: 'groucho', label: 'Groucho', phrase: 'the full groucho disguise', front: 'grouchoFront', side: 'grouchoSide', preview: true },
      { id: 'eyepatch', label: 'Eye patch', phrase: 'a pirate eye patch', front: 'eyepatchFront', side: 'eyepatchSide', preview: true },
    ],
    // extras anchor to the FACE (eye anchor + dy, front/side art, mirrored on
    // left-facing frames), the CHEST (per-frame btCx body centre + dy), or a
    // HAND (per-frame glove centre + grip).
    extras: [
      { id: 'mustache', label: 'Moustache', phrase: 'a fine moustache', anchor: 'face',  dy: 4.0, sideDx: -1.2, front: 'mustacheFront', side: 'mustacheSide' },
      { id: 'fatstache', label: 'Fat moustache', phrase: 'a fat black moustache', anchor: 'face', dy: 4.0, sideDx: -1.2, front: 'fatstacheFront', side: 'fatstacheSide' },
      // the NECK zone — chest-anchored items that all fight for the same few
      // pixels (bow tie, ties, chains, scarves…), so the builder treats them
      // as a mutually-exclusive group (zone is UI grouping only; the engine
      // keeps drawing via the chest anchor + per-item dy).
      { id: 'bowtie',   label: 'Bow tie',   phrase: 'a bow tie',        anchor: 'chest', zone: 'neck', dy: 9.5, art: 'bowtie' },
      { id: 'necktie',  label: 'Necktie',   phrase: 'a blue necktie',   anchor: 'chest', zone: 'neck', dy: 11.5, art: 'necktie' },
      { id: 'goldchain', label: 'Gold chain', phrase: 'a gold chain',   anchor: 'chest', zone: 'neck', dy: 9.0, art: 'goldchain' },
      { id: 'scarf',    label: 'Scarf',     phrase: 'a cosy red scarf', anchor: 'chest', zone: 'neck', dy: 8.5, art: 'scarf' },
      // the FEET slot — footwear rides the feet anchor; single-select (one pair
      // at a time), so these behave as a mutually-exclusive group in the builder.
      { id: 'sneakers',     label: 'Red sneakers',  phrase: 'red sneakers',  anchor: 'feet', art: 'sneakers' },
      { id: 'sneakersblue', label: 'Blue sneakers', phrase: 'blue sneakers', anchor: 'feet', art: 'sneakersblue' },
      { id: 'sneakersgold', label: 'Gold sneakers', phrase: 'gold sneakers', anchor: 'feet', art: 'sneakersgold' },
      { id: 'skates', label: 'Roller skates', phrase: 'roller skates', anchor: 'feet', art: 'skates' },
      { id: 'clownshoes', label: 'Clown shoes', phrase: 'big clown shoes', anchor: 'feet', art: 'clownshoes' },
      { id: 'cowboyboots', label: 'Cowboy boots', phrase: 'cowboy boots', anchor: 'feet', art: 'cowboyboots' },
      { id: 'discoboots', label: 'Disco boots', phrase: 'golden disco boots', anchor: 'feet', art: 'discoboots' },
      { id: 'ledsneakers', label: 'LED sneakers', phrase: 'LED sneakers', anchor: 'feet', art: 'ledsneakers', preview: true },
      { id: 'flamekicks', label: 'Flame kicks', phrase: 'flaming sneakers', anchor: 'feet', art: 'flamekicks', preview: true },
      { id: 'boombox', label: 'Boombox', phrase: 'a boombox', anchor: 'hand', hand: 'left', grip: 1, art: 'boombox' },
      { id: 'mug', label: 'Coffee mug', phrase: 'a coffee mug', anchor: 'hand', hand: 'left', grip: 6, art: 'mug' },
      { id: 'trophy', label: 'Trophy', phrase: 'a golden trophy', anchor: 'hand', hand: 'right', grip: 5, art: 'trophy', preview: true },
      { id: 'boingball', label: 'Boing Ball', phrase: 'a red-white checkered ball', anchor: 'hand', hand: 'left', grip: 4, art: 'boingball', preview: true },
      // id is balloons, NOT balloon — the rave already owns 'balloon' as an
      // fx id AND a conveyor item kind; three namespaces sharing one word is a trap
      { id: 'balloons', label: 'Balloons', phrase: 'a bunch of balloons', anchor: 'hand', hand: 'right', grip: 15, art: 'balloons', preview: true },
      // earned, never given: unlocked by surviving 30 min at the rave (builder shows a locked door chip).
      // NOT in the daily pools on purpose — the daily banana doesn't wear souvenirs it didn't earn.
      // anchor 'hand' rides the per-frame glove centres; grip = art grid-units from the
      // art top to where the glove wraps it (here: the black cap).
      { id: 'glowstick', label: 'Glowstick', anchor: 'hand', hand: 'right', grip: 8.5, art: 'glowstick', earned: 'rave',
        lock: 'a rave souvenir: survive 30 minutes on the dance floor and it’s yours forever' },
      // the trophy: earned by catching the golden banana at the rave (patch
      // `golden` is the proof of the moment); worn from the pass or the builder
      { id: 'goldbanana', label: 'Golden Banana', anchor: 'hand', hand: 'left', grip: 2, art: 'goldbanana', earned: 'golden',
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
