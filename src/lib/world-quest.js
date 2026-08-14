// 🕯 RETURN TO SENDER — Chapter 1. The world's narrative questline.
//
// ⚠️ THE ONE RULE: the quest NEVER touches shared state. Every object it needs
// (dry beds, weeds, dig spots, fishing spots) is spawned CLIENT-SIDE, visible
// only to the quest holder, at fixed positions — so no weather, no other
// player, and no full garden can ever block a step. The engines' own worlds
// are read-only scenery to this module.
//
// Loaded DYNAMICALLY by the four area pages, gated on the dev flag — zero
// bytes for regular visitors until launch (the per-surface budget doctrine).
// State is local-first in `bwq-c1`; the step index is mirrored into a pass
// stat (max-merge) so later chapters can sync cross-device.
//
// QA: ?questtest (sticky per device) · ?questtest=off · ?questreset ·
//     ?queststep=N jumps (test only).
import { passStat } from './banana-pass.js';
import { drawComposite, assetsReady, NFRAMES } from './banana-engine.js';

// 🍌 NIB IS A REAL BANANA (Trym's polish verdict: "theres no banana NPC
// greeting me" — a floating ! is not a character). Engine-rendered like Old
// Peel: one locked standing frame, plain suit; the clipboard is CSS chrome.
const NIB_DRAW = {
  // the mayor's official wears the OFFICE (Trym): top hat + round clerk
  // spectacles + a proper necktie — nobody else in the cast wears any of
  // the three together, so his silhouette reads at a glance
  hat: 'tophat', glasses: 'potter', extras: { necktie: true },
  top: '', bottom: '', bg: 'transparent', captions: false, effect: 'none',
};

const KEY = 'bwq-c1';
// 🔤 THE SPLASH FONT, warmed at boot and gated at show time. Anton is only
// FETCHED on first use (font-display:swap), so the first chapter splash on a
// page flashed the fallback font for a beat and swapped (Trym). Two-part
// cure, the pattern for ALL future chapter texts: fontWarm() at bootQuest
// starts the download in idle time, and the splash only fades in once the
// face resolves — raced against 800ms so a hung font can never hold the
// show. The fade-from-0 is what makes the gate airtight: nothing is ever
// visible in the wrong font.
const fontWarm = () => ((typeof document !== 'undefined' && document.fonts && document.fonts.load)
  ? document.fonts.load('1rem Anton').catch(() => {}) : Promise.resolve());

// the quest glyph — a THIN pixel ! (gold, black outline, white shine). ONE
// art source: the bobbing world marker AND the journal chip's icon (the 🕯
// emoji there rendered as an illegible smudge at chip size — Trym).
const MARK_SVG = '<svg viewBox="0 0 14 24" aria-hidden="true">'
  + '<path fill="#111" d="M4 0h6v10h-1v4H5v-4H4z"/>'
  + '<path fill="#111" d="M4 17h6v5H4z"/>'
  + '<path fill="#ffd23f" d="M5 1h4v8h-1v4H6v-4H5z"/>'
  + '<path fill="#ffd23f" d="M5 18h4v3H5z"/>'
  + '<path fill="#fff3a8" d="M5 1h2v8H5zM5 18h1v3H5z"/>'
  + '</svg>';
// …and its sibling the ?, the RPG canon's other half: ! = a new task waits,
// ? = you're RETURNING to somebody (turn in, report back). `turnin: 1` on a
// talk step swaps the glyph.
// (v2: shoulders flare BELOW the top bar on both sides — the left one stops
// short, which is what makes it an open curve instead of a broken !)
const MARKQ_SVG = '<svg viewBox="0 0 14 24" aria-hidden="true">'
  + '<path fill="#111" d="M4 0h7v4H4zM2 1h5v5H2zM7 1h5v5H7zM7 4h5v5H7zM5 7h5v7H5zM5 17h5v5H5z"/>'
  + '<path fill="#ffd23f" d="M5 1h5v2H5zM3 2h3v3H3zM8 2h3v3H8zM8 5h3v3H8zM6 8h3v5H6zM6 18h3v3H6z"/>'
  + '<path fill="#fff3a8" d="M5 1h2v1H5zM3 2h1v2H3zM6 18h1v2H6z"/>'
  + '</svg>';
// 🎫 the pass icon = the SAME pixelarticons 'card' glyph the pass page and
// its buttons use — never an OS wallet emoji beside our own icon set (Trym)
const ICON_CARD = '<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" shape-rendering="crispEdges" aria-hidden="true"><path d="M20 20H4v-2h16v2ZM4 18H2V6h2v12Zm18 0h-2V6h2v12ZM20 6H4V4h16v2Z"/></svg>';
// ⚠️ the hint chip anchors to the VIEW (the clipping viewport), never the
// world: the world PANS, so a world-anchored chip lives at the map's top-left
// corner and is off-screen almost always — which read as "the quest doesn't
// exist" on the live site (Trym: "i dont see anything"). Markers stay in the
// world (they mark places); the journal stays on the glass.
const AREAS = {
  // wh = the area's world-coordinate height (homestead-geo WORLD.h) — feeds
  // the same depth formula the area uses (zIndex = 100 + world y)
  homestead: { sel: '#hsWorld', view: '.hs-view', wh: 1100 },
  park: { sel: '#pkWorld', view: '#pkView' },
  beach: { sel: '#bhWorld', view: '#bhView' },
  // chipHost: the journal chip docks on the BOOTH, riding the stage line —
  // at floor-top it covered the dancefloor on mobile, and at the LED wall
  // it covered the screen (Trym): the line between them is nobody's pixels
  rave: { sel: '#rvFloor', view: '#rvFloor', chipHost: '.rv-booth' },
};

// ---- state ----------------------------------------------------------------
let S = { s: 0, k: {}, res: 0, done: 0 };
try { S = { ...S, ...(JSON.parse(localStorage.getItem(KEY) || '{}')) }; } catch (e) {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
const track = (ev, p) => { try { window.gtag && window.gtag('event', ev, p || {}); } catch (e) {} };

const coinBal = () => {
  try {
    const st = (JSON.parse(localStorage.getItem('pass-v1') || '{}').stats) || {};
    return Math.max(0, (st.coins_earned || 0) - (st.coins_spent || 0));
  } catch (e) { return 0; }
};

// ---- the cast -------------------------------------------------------------
// Voices (Trym: Silicon Valley energy, exaggerated, never overlapping):
//   NIB — process-worshipping registrar; earnest to the point of concern
//   PEEL — cranky oracle; everything is horticulture; weaponised fussing
//   SPLIT — bombast; claims ownership of everything; folds instantly
//   SHELLY — cannot summarise; dates everything; delighted by barnacles
//   BARTY — canon: over-cheer, beat, dark mutter (never break his DNA)
// f = locked frame, d = portrait draw — each NPC's REAL in-world look (Peel's
// cane, Split's tricorn, Barty's uniform), so the card face matches the body
const NPC = { top: '', bottom: '', bg: 'transparent', captions: false, effect: 'none' };
const WHO = {
  nib: { n: 'Nib', c: '#8ecbff', f: 0, d: NIB_DRAW },
  peel: { n: 'old peel', c: '#c8e6a0', f: 0, d: { hat: 'none', glasses: 'potter', extras: { oldcane: true }, ...NPC } },
  // ⚠️ 'split' is only the internal key — the LIVE beach named him Captain
  // Sabreface everywhere players look (his desk, the page FAQ, Sandy's
  // lines), and the quest must speak the world's one name
  split: { n: 'captain sabreface', c: '#ffb36b', f: 2, d: { hat: 'tricorn', glasses: 'eyepatch', extras: {}, ...NPC } },
  shelly: { n: 'shelly', c: '#ffa0c8', f: 2, d: { hat: 'snailhat', glasses: 'none', extras: {}, ...NPC } },
  barty: { n: 'barty', c: '#ffe135', f: 4, d: { hat: 'none', glasses: 'none', extras: { mustache: true, bowtie: true }, ...NPC } },
  you: { n: 'you', c: '#fffdf5', f: 0 },
};
// 'you' wears whatever the player wears — bb-last rides every area already
function myDraw() {
  let o = { hat: 'none', glasses: 'none', extras: {} };
  try {
    const b = JSON.parse(localStorage.getItem('bb-last') || 'null');
    if (b) o = { hat: b.hat || 'none', glasses: b.glasses || 'none', extras: b.extras || {} };
  } catch (e) {}
  return { ...o, ...NPC };
}

// ---- chapter one ----------------------------------------------------------
// kind: talk (marker → dialogue) · objects (tap the spawned things) ·
//       goal (watch for a real-world condition, homestead tent)
// at: {sel} anchors to a live element, {x,y} = % of the world plate.
const STEPS = [
  // ⚠️ atRes: for RESIDENTS (stage ≥ 1) the gate spot sits in their fence
  // opening / on their built plot — Nib waits on the far side of the road
  // instead, a bit further down, off their property (Trym)
  // ⚠️ NIB MUST BE ON SCREEN AT SPAWN (14 Aug, from the ad's day-one funnel).
  // At the gate (63%) he sat ~1000 world px east of the west road entrance
  // where a direct visit lands — so the chip pointed at somebody the camera
  // was not showing, and 7 of 181 arrivals ever tapped him. He now waits a
  // short walk up the road, in the frame, between the newcomer and the plot.
  // ⚠️ MEASURED, not guessed: at the west spawn a 393-wide phone sees world
  // x 6-591 only. 34% (x612) was clipped at the right edge; 24% (x432) sits
  // ~3/4 across the frame — plainly visible, still a real walk away.
  { id: 'c1_nib_hello', area: 'homestead', kind: 'talk', who: 'nib', leave: 1, at: { x: 24, y: 83 },
    atRes: { x: 66, y: 90 },
    find: 'someone is waiting up the road — go say hello!',
    findRes: 'someone is waiting across the road — go say hello!',
    // ✍️ THE VOICE BAR (Trym, 12 Aug round 3): dialogue a 13-year-old and a
    // 50-year-old both read without a stumble — short sentences, plain
    // words, a STORYTELLER's warmth, no bureaucrat jargon ("registry/deed/
    // archive" → "the big book"). Nib helps the MAYOR (plants ch.2) and
    // heard a RUMOUR (a rumour has a source — also ch.2).
    lines: [
      ['nib', 'Oh! Hello hello! You’re here!'],
      ['nib', 'I’m Nib. I help the Mayor keep track of Banana World — every banana, every plot of land, every little shop. It all goes in my big book.'],
      ['nib', 'And this morning I heard a rumour. Somebody new was coming to town today. That’s you!'],
      ['you', 'Me? I only just got here.'],
      ['nib', 'Then the rumour was right! And it gets stranger. This is Plot 11 — nobody has lived here since 1999.'],
      ['nib', 'There’s no owner in my book. No name. Nothing. Just one old letter, waiting in a drawer all these years.'],
      ['paper', '“the eleventh plot, to whoever comes asking. it has waited long enough.”'],
      ['you', 'Whoever comes asking… that could be anyone.'],
      ['nib', 'Could be. But you’re the one standing here, aren’t you? Sign your name, and Plot 11 is yours.'],
      ['nib', 'Who wrote the letter? Nobody knows. My book only goes back to 1999 — but Old Peel, in the Park? He’s older than any book.'],
      ['nib', 'Go ask him about Plot 11. Tell him it’s official business. He hates official business. It’s wonderful.'],
    ],
    linesRes: [
      ['nib', 'Hello hello! I’m Nib. I help the Mayor keep track of Banana World — every banana, every plot of land, every little shop. It all goes in my big book.'],
      ['nib', 'I heard somebody finally lives on Plot 11 again — so I came to write you in. That’s you!'],
      ['you', 'That’s me. Is something wrong?'],
      ['nib', 'A little, yes. Nobody lived here since 1999. And when I looked up your plot in the book… there was no owner at all. No name. Nothing.'],
      ['nib', 'Just this one old letter, waiting in a drawer all these years.'],
      ['paper', '“the eleventh plot, to whoever comes asking. it has waited long enough.”'],
      ['you', 'Who wrote it?'],
      ['nib', 'Nobody knows! No name on it. No date. It isn’t even filed properly. I had to sit down.'],
      ['nib', 'My book only goes back to 1999 — but Old Peel, in the Park? He’s older than any book.'],
      ['nib', 'Go ask him about Plot 11. Tell him it’s official business. He hates official business. It’s wonderful.'],
    ],
    hint: 'find Old Peel in the Park' },

  { id: 'c1_peel_hi', area: 'park', kind: 'talk', who: 'peel', at: { sel: '.pk-old', x: 50, y: 40 },
    lines: [
      ['peel', 'Official business? Bah. Paperwork is what killed my flowers.'],
      ['peel', 'So YOU’RE the one living on Plot 11 now. Hm. HM.'],
      ['peel', 'I remember a thing or two about that plot. And I’ll tell you — after you help me a little.'],
      ['peel', 'My flowerbed is up in the garden corner, past the mushroom shop. The weeds have taken it over, the flowers are thirsty — and my knees are done for today.'],
    ],
    hint: 'water old peel’s flowerbed 💧 — the garden corner, top right, past the mushroom shop' },

  // 🌼 the chores happen on PEEL'S OWN FLOWERBED (park-npc PEEL_BED, world
  // px 2420/2480/2540 × 330 → %) — quest-holder-only wilt via `thirst`, each
  // watering `heal`s its own flower back to bloom (with a glow burst). The
  // weeds are REAL pk-weed sprites pulled with the park's OWN 🌿 pull button
  // (window.bwqWeeds feeds the tool scan — one grammar, Trym), spawned
  // quest-side by the no-blocker rule. Six, scattered ON and around the bed,
  // so the overtaken-by-weeds line is true on screen and the chore breathes.
  { id: 'c1_peel_chores', area: 'park', kind: 'objects', tend: 1,
    thirst: '.pk-peelplant',
    hint: 'water the flowers 💧 (tap them) — and pull every weed: walk close, press 🌿 pull',
    objects: [
      { id: 'bed1', x: 87.7, y: 26.8, taps: 1, kind: 'bed', heal: '[data-peel="0"]', done: '💧 watered — it perks right up' },
      { id: 'bed2', x: 89.9, y: 26.8, taps: 1, kind: 'bed', heal: '[data-peel="1"]', done: '💧 watered' },
      { id: 'bed3', x: 92.0, y: 26.8, taps: 1, kind: 'bed', heal: '[data-peel="2"]', done: '💧 watered' },
      { id: 'weed1', x: 88.9, y: 26.9, taps: 1, kind: 'weed' },
      { id: 'weed2', x: 91.3, y: 27.3, taps: 1, kind: 'weed' },
      { id: 'weed3', x: 86.4, y: 32.5, taps: 1, kind: 'weed' },
      { id: 'weed4', x: 89.2, y: 34.2, taps: 1, kind: 'weed' },
      { id: 'weed5', x: 92.2, y: 33.1, taps: 1, kind: 'weed' },
      { id: 'weed6', x: 94.9, y: 29.3, taps: 1, kind: 'weed' },
    ] },

  { id: 'c1_peel_memory', area: 'park', kind: 'talk', who: 'peel', turnin: 1, at: { sel: '.pk-old', x: 50, y: 40 },
    lines: [
      ['peel', 'Good work. The weeds are gone, and the flowers thank you. Now sit down and listen.'],
      ['peel', 'Somebody DID live on Plot 11. Long, long ago.'],
      ['peel', 'And here’s the strange part. I remember every banana that ever walked this park. But that one? No face. No name. Gone, like a smell.'],
      ['peel', 'Only two things stuck with me.'],
      ['peel', 'Every evening, that strange banana sat outside drawing. The same little drawings, over and over. Like they were practising something.'],
      ['peel', 'And every morning, the stranger walked down to the Bay. Every single morning. And came back with nothing.'],
      ['peel', 'What was that banana DOING down there? Go to the Bay and ask Captain Sabreface, by the wreck. Nothing happens on that sand without him seeing it.'],
    ],
    reward: { coins: 15, note: '🪣 Peel gives you his old watering can' },
    hint: 'go to Banana Bay — ask Captain Sabreface by the wreck' },

  // 🗺 Sabreface's CHART (Trym): the dig spot is not handed out — Split maps
  // an AREA (a bold circle, not an X) on the quiet NW shore past the sunbeds,
  // and you dig it out with the REAL ⛏ verb. Spent-sand spacing means the
  // circle takes real exploring.
  { id: 'c1_map', area: 'beach', kind: 'talk', who: 'split', at: { sel: '#bhCap', x: 30, y: 46 },
    find: 'ask Captain Sabreface, by the wreck, about the morning banana',
    lines: [
      ['split', 'HALT. Who goes there! …You’re asking about the morning banana? On MY beach?'],
      ['you', 'You knew them?'],
      ['split', 'Knew them! Every morning, for years, that quiet banana walked my shore. Never took a thing. Never said a word. And one day — gone.'],
      ['split', 'But nothing happens on this beach without Sabreface seeing it. And Sabreface MAPS everything.'],
      ['map', ''],
      ['split', 'See the circle? The quiet stretch past the sunbeds, where the tide comes highest. That’s where the stranger always stopped.'],
      ['split', 'If they buried anything, it’s there. Dig inside the circle — and bring me what the sand coughs up. Maritime law.'],
    ],
    hint: 'dig inside the circle on Sabreface’s map — the quiet shore past the sunbeds' },

  // ten fresh digs to the tin (Trym: found on the 4th, should be ~the 10th)
  // — the spent-sand rule spaces every dig, so ten finds = a real search of
  // the circle, with the flavor line building toward the strike
  { id: 'c1_dig', area: 'beach', kind: 'digzone', need: 10,
    hint: 'dig inside the circle — the quiet shore past the sunbeds (⛏ digs at your feet)',
    steps: ['…a rusty fork. huh.', '…an old boot. the sea loves boots.',
      '…just sand. keep going.', '…a bottle cap from 2003.',
      '…more sand. the circle is big.', '…a crab claw. the crab kept the rest.',
      '…something metal! …no. a third boot.', '…the sand feels looser here.',
      '…so close — you can FEEL it.',
      '📦 An old METAL BOX — sealed tight, heavy… someone buried this on purpose'] },

  { id: 'c1_split', area: 'beach', kind: 'talk', who: 'split', turnin: 1, at: { sel: '#bhCap', x: 30, y: 46 },
    find: 'Captain Sabreface wants a word about that box',
    lines: [
      ['split', 'A BOX! Hand it over! Salvage rights! Maritime law! I wrote it myself.'],
      ['you', 'You sent me to dig it up.'],
      ['split', '…True. Then it’s yours, by finder’s law. Which also exists. You’re welcome.'],
      ['split', 'An old sealed box like that, though… Take it to the old gardener in the Park. He’s been around forever — he’ll know it.'],
      ['split', 'Go on. Sabreface has spoken.'],
    ],
    hint: 'bring the metal box back to Old Peel in the Park' },

  { id: 'c1_peel_fuss', area: 'park', kind: 'talk', who: 'peel', turnin: 1, at: { sel: '.pk-old', x: 50, y: 40 },
    lines: [
      ['peel', 'A box? Let me see— no. NO. Not with litter blowing all over my park.'],
      ['peel', 'Pick it up first. Every last piece. I can’t think over mess. Nobody can.'],
    ],
    hint: 'litter has blown all over the park — walk over every piece to pick it up' },

  // 🗑 eight pieces spread across the WHOLE park (Trym: let the chore show
  // the place off) — REAL pk-trash sprites picked up by WALKING OVER them,
  // exactly like everyday litter: window.bwqTrash rides park-garden's
  // trashTick, same is-popped animation, same +2 rep.
  // ⚠️ PLACEMENT RULE (Trym: pieces hid behind trees): every point must
  // clear EVERY park-geo OVERLAYS rect (the y-sorted canopies that draw
  // over things) by ≥25 world px — a piece under a crown is invisible and
  // the chore turns into checking behind every tree. lit2 sat fully under
  // the pond-side tree (ov-15) and lit7 hugged the market cart before this.
  { id: 'c1_litter', area: 'park', kind: 'objects', sweep: 1,
    hint: 'litter has blown all over the park — walk over every piece to pick it up',
    objects: [
      { id: 'lit1', x: 15.6, y: 63.6, taps: 1, kind: 'trash' },
      { id: 'lit2', x: 38.0, y: 50.9, taps: 1, kind: 'trash' },
      { id: 'lit3', x: 27.5, y: 84.5, taps: 1, kind: 'trash' },
      { id: 'lit4', x: 48.2, y: 87.3, taps: 1, kind: 'trash' },
      { id: 'lit5', x: 64.5, y: 38.2, taps: 1, kind: 'trash' },
      { id: 'lit6', x: 76.1, y: 65.5, taps: 1, kind: 'trash' },
      { id: 'lit7', x: 89.5, y: 53.6, taps: 1, kind: 'trash' },
      { id: 'lit8', x: 58.0, y: 58.2, taps: 1, kind: 'trash' },
    ] },

  { id: 'c1_peel_tin', area: 'park', kind: 'talk', who: 'peel', turnin: 1, at: { sel: '.pk-old', x: 50, y: 40 },
    lines: [
      ['peel', '(he opens the box, slow as Sunday)'],
      ['peel', '…A photograph. That’s Plot 11 alright. But look — there’s a little house on it.'],
      // 🖼 SHOW the photo (Trym: show, don't tell) — the player sees the
      // house and the lit window BEFORE Peel says it can't exist
      ['photo', ''],
      ['peel', 'There has never been a house on Plot 11. Never. And yet here’s a photo of one.'],
      ['peel', 'And underneath it… a fishing lure. Old. Carved by hand.'],
      ['peel', 'So THAT’s what the stranger did at the Bay every morning. Fished off the pier. And came home with an empty bucket, every single time.'],
      ['you', 'Who fishes every morning and never catches anything?'],
      ['peel', 'Exactly. Somebody who isn’t fishing for fish. Take the lure — cast where that banana cast, off the pier. I’d wager there’s something still down there.'],
    ],
    reward: { coins: 10, note: '🎣 the stranger’s hand-carved lure — keep it safe' },
    hint: 'fish off the pier at the Bay — cast at the stranger’s spot' },

  // 🎣 the REAL rod, not a quest puddle (Trym): the player fishes with the
  // bay's own mechanic — cast, wait for the bite, tap the float — and the
  // FIFTH catch reels up the bundle instead of a fish (window.bwqFish rides
  // reel() in banana-beach.js; ordinary catches in between stay ordinary,
  // one voice per reel).
  { id: 'c1_fish', area: 'beach', kind: 'fishline', need: 5,
    hint: 'fish off the pier — cast a line, wait for the bite, tap the float',
    found: '🎞 Something heavy on the line — a wrapped BUNDLE! Inside: eight little drawings. A flipbook!' },

  { id: 'c1_shelly', area: 'beach', kind: 'talk', who: 'shelly', turnin: 1, at: { sel: '#bhShelly', x: 60, y: 40 },
    find: 'show the bundle to Shelly',
    lines: [
      ['shelly', 'OH! Oh oh oh. You fished that out of the bay?? Let me see, let me see!'],
      ['shelly', 'Look how the water aged this paper. This little book has been down there longer than I’ve kept charts. And I chart EVERYTHING.'],
      ['you', 'How is it not ruined?'],
      ['shelly', 'Because somebody sealed it up like it MATTERED. Watertight. On purpose.'],
      ['shelly', 'Eight little pages! Go on — flip through them. Quick quick!'],
      ['fb', ''],
      ['you', '…It’s a banana. Dancing.'],
      ['shelly', 'Dancing is not my department. The loud room handles dancing. Show it to Barty, at the Rave!'],
    ],
    reward: { coins: 15 },
    hint: 'show the flipbook to Barty at the Rave' },

  // ⚠️ the mark anchors to Barty's MEASURED body (the Peel grammar) — the
  // hardcoded floor % floated it beside him, and the rave zooms besides
  { id: 'c1_barty_look', area: 'rave', kind: 'talk', who: 'barty', turnin: 1,
    at: { sel: '#rvBarman', dh: 0.15, x: 28, y: 84 },
    tapSel: '#rvBarman',
    find: 'show the flipbook to Barty at the bar',
    lines: [
      ['barty', 'Howdy howdy! What can I get— oh! A flipbook! Cute!'],
      ['fb', ''],
      ['barty', 'Ha! Well sure — that’s just how bananas dance, friend!'],
      ['you', 'Barty… who taught YOU the dance?'],
      ['barty', 'Taught? Nobody teaches it! You’re born knowing it. Everybody just… knows it.'],
      ['barty', '…Huh. That IS weird, ain’t it.'],
      ['barty', 'Give me a minute to think. Keep my floor warm while I do — dance a little, send some hearts.'],
    ],
    hint: 'keep the floor warm — dance for 30s and send 3 ❤' },

  { id: 'c1_floor', area: 'rave', kind: 'watch', hint: 'dance 30s · send 3 reactions',
    watch: { secs: 30, taps: 3 } },

  { id: 'c1_barty_truth', area: 'rave', kind: 'talk', who: 'barty', turnin: 1,
    at: { sel: '#rvBarman', dh: 0.15, x: 28, y: 84 },
    tapSel: '#rvBarman',
    lines: [
      ['barty', 'Okay. So. Every banana in the world does the SAME dance. Since before this club existed.'],
      ['barty', 'And your little book of drawings? Older than my floor.'],
      ['barty', 'Whoever drew those pages taught the whole world to dance… and never told a soul their name.'],
      ['barty', 'Go home, friend. Whoever they were — they lived on YOUR plot. If anything’s left of them, it’s there.'],
    ],
    reward: { coins: 20, note: '🎞 the flipbook — a keepsake' },
    hint: 'head home to the Homestead' },

  { id: 'c1_move_in', area: 'homestead', kind: 'goal',
    // the phone icon is the REAL banana-phone sprite, matching the action
    // bar — an OS 📱 emoji beside the actual button art read as two phones
    hint: 'make it official — order a tent on your <img src="/assets/homestead/phone.png" alt=""> banana phone and move in',
    resSkip: 'the old photograph goes up on your wall. home.' },

  { id: 'c1_nib_registry', area: 'homestead', kind: 'talk', who: 'nib', turnin: 1, leave: 1, at: { x: 63, y: 76 },
    atRes: { x: 66, y: 90 },
    find: 'Nib is back at your gate',
    findRes: 'Nib is back — across the road',
    lines: [
      ['nib', 'A home! A real home on Plot 11! Wonderful. Now I can finally write you into the book. Let me just—'],
      ['nib', '…That’s strange. There’s already something on this page.'],
      ['nib', 'Somebody wrote a name here, long ago. And then scratched it out. It’s dated 1999.'],
      ['you', 'Who scratches a name OUT of a book?'],
      ['nib', 'Nobody! You can’t! I laminated the rules myself!'],
      ['nib', '…I need to sit down. I have never needed to sit down in my life.'],
      // 🎫 the chapter's landing: Nib the registrar warms up (word travels,
      // everyone liked you, please stay) and THEN naturally pitches the
      // BANANA PASS — the funnel's next step (My Pass login) wrapped in his
      // process-love; the receipt card carries the actual door to /pass/
      ['nib', '…Right. Deep breaths. There is one pleasant piece of paperwork left, resident, and I saved it for last.'],
      ['nib', 'Word travels fast in a small world. Peel talks. Shelly talks. Barty talks a LOT.'],
      ['nib', 'And every word about you has been kind. The flowers. The clean park. The little book from the bay. I do hope you decide to stay — Banana World is better with you in it.'],
      ['nib', 'Which is why you should carry a PASS, like every proper citizen. Your name, your things, your story. All in one place.'],
      ['nib', 'Go to MY PASS and sign yourself in. Then it’s truly official. More official than my book, even. And I laminated my book.'],
      ['paper', 'CHAPTER ONE — complete 🍌 (chapter two is coming)'],
    ],
    reward: { note: 'the photograph — the house that isn’t there', art: () => photoCanvas(),
      link: { href: '/pass/', label: 'open My Pass', icon: ICON_CARD,
        pill: 'your name · badges · keepsakes', art: () => passCanvas() } },
    hint: '' },
];

// ---- css ------------------------------------------------------------------
let styled = false;
function ensureCss() {
  if (styled) return;
  styled = true;
  const st = document.createElement('style');
  st.textContent = `
/* ⚠️ the marker is a BOXLESS glyph on purpose (Trym: the yellow box read as
   "a test-thing" — every UI chip here is a yellow box with a black border, so
   a quest marker must NOT be one). A chunky free-standing gold ! with a pixel
   outline is the classic RPG shape and can't be mistaken for a text box. */
/* delicate, not dry (Trym): a THIN gold ! with a soft breathing glow —
   the halo is a ::before pulsing opacity (cheap; no filter animation) */
.bwq-mark {
  position:absolute; z-index:2400; width:22px; height:36px; margin-left:-11px;
  cursor:pointer; animation:bwqBob 1.1s ease-in-out infinite;
  filter:drop-shadow(0 0 4px rgba(255,220,80,0.75)) drop-shadow(2px 3px 0 rgba(0,0,0,0.3));
}
.bwq-mark::before {
  content:''; position:absolute; inset:-10px; pointer-events:none;
  background:radial-gradient(circle, rgba(255,225,53,0.4) 0%, transparent 62%);
  animation:bwqGlow 1.8s ease-in-out infinite;
}
@keyframes bwqGlow { 0%,100% { opacity:0.4; } 50% { opacity:1; } }
.bwq-mark svg { display:block; width:100%; height:100%; }
@keyframes bwqBob { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-7px); } }
/* 📱 the world shrinks but the px-sized mark doesn't — smaller and lifted a
   touch on phones or it sits ON Nib's head (Trym) */
@media (max-width:480px) {
  .bwq-mark { width:17px; height:28px; margin-left:-8px; margin-top:-12px; }
}
/* 🍌 the quest NPC — an engine banana, one still frame.
   ⚠️ sized in % OF THE WORLD like the player (.hs-me is width:5.5%): a px
   width put Nib at a third of the player's size (Trym's screenshot). The CSS
   clipboard prop is gone too — a floating white rectangle read as a glitch,
   not a prop. If Nib gets a look, it comes from the real wearable manifest.
   ⚠️ NO fixed z-index: he gets the area's depth formula inline (100 + world
   y) so the player walks in FRONT of him below and BEHIND him above — a flat
   2380 kept him painted over the player from every side. Tapping him talks. */
.bwq-npc { position:absolute; width:5.4%; transform:translate(-50%,-94%); cursor:pointer; }
.bwq-npc canvas { display:block; width:100%; image-rendering:pixelated; }
/* 🚶 when his business is done he WALKS off toward the park — a blink-away
   read as a glitch (Trym). The dance frames sell the walk (drawn in JS);
   the class just retires the pointer. */
.bwq-npc--walk { cursor:default; }
/* 🗺 the map button — rides the beach action bar for the whole dig hunt,
   glowing so nobody has to remember where the circle was (Trym) */
.bwq-mapbtn { position:relative; }
.bwq-mapbtn::before {
  content:''; position:absolute; inset:-6px; pointer-events:none; border-radius:6px;
  box-shadow:0 0 14px 4px rgba(255,225,53,0.6);
  animation:bwqGlow 1.6s ease-in-out infinite;
}
.bwq-mapbtn svg { display:block; width:1.35em; height:auto; }
/* 🌿🗑 quest weeds and litter wear the quest's dashed ring — a thing that
   LOOKS like every other one still has to say "I am part of this" (Trym) */
.bwq-qweed, .bwq-qtrash { overflow:visible; }
.bwq-qweed::after, .bwq-qtrash::after {
  content:''; position:absolute; inset:-7px; border:2px dashed #ffe135;
  border-radius:8px; animation:bwqPulse 1.3s ease-in-out infinite; pointer-events:none;
}
/* 🎯 quest objects — drawn things, not dots (Trym: "green dots" failed) */
.bwq-obj {
  position:absolute; z-index:2350; width:40px; height:36px; margin:-18px 0 0 -20px;
  cursor:pointer; display:grid; place-items:center;
}
.bwq-obj::after {
  content:''; position:absolute; inset:-3px; border:2px dashed #ffe135;
  border-radius:8px; animation:bwqPulse 1.3s ease-in-out infinite; pointer-events:none;
}
.bwq-obj i { display:block; image-rendering:pixelated; background-size:100% 100%; background-repeat:no-repeat; }
/* 🌼 park chores wear the PARK'S art (Trym: the drawn boxes read as weirdly
   placed items): beds = a bare glow ring over Peel's real ditches, weeds and
   litter = the park's own sprites */
.bwq-obj--bed i { display:none; }
.bwq-obj--weed i { width:26px; height:32px; background-image:url('/assets/park/w-weed1.png'); }
.bwq-obj--trash i { width:22px; height:20px; background-image:url('/assets/park/t-litter1.png'); }
.bwq-obj--dig i {
  width:30px; height:16px; border:2px solid #7a5c33; border-radius:50%;
  background:#d9b67c; box-shadow:inset 3px 3px 0 #b78f52, inset -4px -2px 0 #eecf96;
}
@keyframes bwqPulse { 0%,100% { transform:scale(1); opacity:0.9; } 50% { transform:scale(1.14); opacity:0.45; } }
/* 🎬 THE CHAPTER SPLASH — the park's post-storm register (big type ON the
   world, no box): a sticker pill, the title under it, fade in → hold → out,
   THEN Nib's dialogue opens. Shows once (S.in). pointer-events:none is
   load-bearing — the world walks on taps and this sits mid-screen. */
.bwq-intro {
  position:absolute; left:50%; top:24%; z-index:4700; width:max-content; max-width:92%;
  text-align:center; pointer-events:none; opacity:0; transform:translate(-50%,-8px);
  transition:opacity 0.5s ease, transform 0.5s ease;
}
.bwq-intro.is-on { opacity:1; transform:translate(-50%,0); }
.bwq-intro i {
  display:inline-block; font-style:normal; font-size:0.72rem; font-weight:900;
  letter-spacing:0.22em; text-transform:uppercase; color:#241c00;
  background:linear-gradient(#ffe14d,#f2c012); border:3px solid #000;
  border-radius:999px; padding:0.32rem 0.95rem; box-shadow:3px 3px 0 #000;
  transform:rotate(-2deg);
}
.bwq-intro b {
  display:block; margin-top:0.6rem;
  font-family:"Anton","Archivo Black","Arial Black",sans-serif;
  font-size:clamp(1.6rem, 6.4vw, 2.8rem); line-height:0.92; letter-spacing:0.015em;
  text-transform:uppercase; color:#ffe135; text-wrap:balance;
  text-shadow:-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000,
    -3px 0 0 #000, 3px 0 0 #000, 0 -3px 0 #000, 0 3px 0 #000, 5px 6px 0 #000;
}
@media (prefers-reduced-motion:reduce) { .bwq-intro { transition:none; } }
/* 🕯 the journal — a game card, not an info-box (Trym's verdict).
   Its FIRST appearance of a visit holds back ~5s and then pops (the world
   deserves a beat before the UI starts talking); re-renders after a talk
   show instantly. Toggling animation:none off is what replays the pop. */
.bwq-hint {
  position:absolute; left:18px; top:48px; z-index:900; max-width:62%;
  background:linear-gradient(#ffe14d,#f2c012); color:#241c00;
  border:3px solid #000; box-shadow:3px 3px 0 #000; border-radius:2px;
  font-size:0.78rem; font-weight:800; padding:7px 11px 7px 22px; line-height:1.35;
  pointer-events:none; animation:bwqCardIn 0.32s cubic-bezier(0.34,1.56,0.64,1);
}
.bwq-hint[hidden] { display:none !important; }
.bwq-hint--wait { visibility:hidden; animation:none; }
/* at the rave the chip rides the STAGE LINE — half over the booth's bottom
   edge, clear of both the LED wall and the dancefloor */
.rv-booth > .bwq-hint { top:auto; bottom:-14px; left:14px; z-index:5; }
/* the chip's ! is a BADGE, not an inline character (Trym: a game, not a
   website message-box) — a black stickerpill pinned over the chip's corner,
   the gold ! big and overflowing it. Same MARK_SVG art as the world marker. */
.bwq-hint__badge {
  position:absolute; left:-13px; top:-15px; line-height:0;
  background:#111; border-radius:999px; padding:5px 8px 6px;
  transform:rotate(-8deg); box-shadow:2px 2px 0 rgba(0,0,0,0.35);
}
.bwq-hint__badge svg { display:block; width:13px; height:22px; }
.bwq-hint span img { height:1.1em; width:auto; image-rendering:pixelated; vertical-align:-0.18em; }
@keyframes bwqCardIn { 0% { transform:scale(0.6) rotate(-3deg); opacity:0; } 100% { transform:none; opacity:1; } }
/* 💬 the dialogue — the park's NPC-card grammar (pk-card--npc: tilted
   waist-up portrait peeking over the corner, name beside it, console box
   that TYPES) — docked INSIDE the game frame, never the browser bottom */
.bwq-dlg {
  position:absolute; left:50%; bottom:12px; transform:translateX(-50%); z-index:4600;
  width:min(420px, calc(100% - 20px)); box-sizing:border-box;
  background:#101a10; color:#fffdf5; border:4px solid #000; box-shadow:6px 6px 0 #000;
  padding:0.8rem 0.9rem 0.9rem; cursor:pointer;
  animation:bwqDlgIn 0.26s cubic-bezier(0.34,1.56,0.64,1);
}
/* 🗣 ⚠️ THE CARD MUST NOT SIT ON THE CAST (14 Aug, Trym): these conversations
   happen ON THE ROAD, which the camera clamps to the bottom of the frame — so
   a bottom-docked card covered both Nib AND the player, and a new arrival's
   first look at the world's first scene was a box over an empty field.
   --mid lifts the card off them when the speaker is low. MIDDLE, not top:
   pinned to 12px it crowded the HUD chips and read as falling out of frame.
   ⚠️ MUST FOLLOW .bwq-dlg — same specificity, so source order decides whose
   bottom wins; placed before, the card kept bottom:12px alongside top and
   stretched the whole frame (556px of 580px).
   ⚠️ centred by MARGIN, never transform: bwqDlgIn's keyframes carry
   translateX(-50%) and a keyframe transform REPLACES the base one, so a
   translate(-50%,-50%) here would be thrown away the moment it animates. */
.bwq-dlg--mid { top:0; bottom:32%; height:max-content; margin-block:auto; }
/* the 32% floor is what keeps the cast clear: dead-centre still clipped
   the top of Nib's hat, because the road sits low and the camera clamps
   there — this centres the card in the frame ABOVE them instead. */
/* ⚠️ the dialogue is CENTERED by transform, and keyframe transforms REPLACE
   the base transform — bwqCardIn (scale only) stripped the -50% for its
   0.26s and the card popped in half a width to the RIGHT, then snapped
   (Trym). Its own keyframes carry the centering through every frame. */
@keyframes bwqDlgIn {
  0% { transform:translateX(-50%) scale(0.6) rotate(-3deg); opacity:0; }
  100% { transform:translateX(-50%); opacity:1; }
}
.bwq-dlg [hidden], .bwq-dlg[hidden] { display:none !important; }
.bwq-pop {
  position:absolute; top:-62px; left:-22px; z-index:3; width:150px; height:150px;
  transform:rotate(-8deg); transform-origin:center bottom; pointer-events:none;
  clip-path:inset(0 0 26% 0);
  filter:drop-shadow(2px 3px 0 rgba(0,0,0,0.4));
}
.bwq-pop canvas { display:block; width:100%; height:100%; image-rendering:pixelated; }
.bwq-dlg h2 {
  font-family:"Archivo Black","Arial Black",sans-serif; font-size:1.05rem;
  margin:0 0 0.45rem; padding-left:100px; min-height:48px;
  display:flex; align-items:center; letter-spacing:0.03em;
}
.bwq-box {
  min-height:4em; background:#0b130b; border:3px solid #000;
  box-shadow:inset 0 0 0 2px #2c4a2c; padding:0.55rem 0.65rem 0.8rem;
  position:relative; touch-action:manipulation; -webkit-tap-highlight-color:transparent;
}
.bwq-box p { margin:0; font-size:0.9rem; line-height:1.5; font-weight:700; }
.bwq-box.is-typing p::after { content:'▌'; margin-left:1px; animation:bwqCursor 0.9s steps(1) infinite; }
@keyframes bwqCursor { 0%,49% { opacity:1; } 50%,100% { opacity:0; } }
.bwq-more {
  position:absolute; right:8px; bottom:3px; color:#ffe135; font-size:0.8rem;
  display:none; animation:bwqMore 1s ease-in-out infinite;
}
.bwq-box.is-done .bwq-more { display:block; }
@keyframes bwqMore { 0%,100% { transform:translateY(0); } 50% { transform:translateY(3px); } }
/* 🗣 YOUR lines are BUTTONS you click to say (Trym: tap-through blurred who
   was speaking) — the park NPC question-deck grammar, one reply at a time */
.bwq-ans { margin-top:0.55rem; display:flex; flex-direction:column; gap:6px; }
.bwq-ans button {
  appearance:none; text-align:left; font:inherit; font-size:0.82rem; font-weight:700;
  background:#182a18; color:#fffdf5; border:2px solid #000; padding:0.5rem 0.65rem;
  cursor:pointer;
}
.bwq-ans button:hover { background:#234023; }
.bwq-sp b { display:block; color:#ffe135; font-size:0.7rem; letter-spacing:0.14em; text-transform:uppercase; margin-bottom:0.35rem; }
.bwq-sp small { display:block; margin-top:0.55rem; font-size:0.62rem; opacity:0.55; font-weight:800; text-transform:uppercase; letter-spacing:0.1em; }
/* 📜 the letter is PAPER: torn edges, ruled lines, handwriting, a tilt */
.bwq-dlg .bwq-paper {
  background:#f6ecd0 repeating-linear-gradient(180deg, transparent 0 24px, rgba(122,88,40,0.22) 24px 25px);
  color:#43301a; padding:1rem 1rem 0.9rem; transform:rotate(-1.4deg);
  font-family:"Segoe Script","Bradley Hand","Comic Sans MS",cursive;
  font-weight:700; font-size:1.02rem; line-height:1.55;
  box-shadow:3px 4px 0 rgba(0,0,0,0.4);
  clip-path:polygon(0 3%, 4% 0, 9% 2%, 15% 0, 22% 3%, 30% 1%, 38% 3%, 47% 0, 55% 2%,
    63% 0, 71% 3%, 79% 1%, 87% 3%, 94% 0, 100% 2%, 100% 97%, 95% 100%, 88% 98%,
    80% 100%, 71% 97%, 62% 100%, 53% 98%, 44% 100%, 35% 97%, 26% 100%, 17% 98%,
    9% 100%, 3% 97%, 0 100%);
  animation:bwqUnfold 0.4s ease-out;
}
@keyframes bwqUnfold { 0% { transform:rotate(-1.4deg) scaleY(0.12); opacity:0; } 100% { transform:rotate(-1.4deg) scaleY(1); opacity:1; } }
.bwq-sp canvas { display:block; margin:0.2rem auto 0.3rem; image-rendering:pixelated;
  border:3px solid #000; background:#fffdf5; box-shadow:3px 3px 0 rgba(0,0,0,0.4); }
/* the torn map, the flipbook and the photograph are OBJECTS — no card
   frame, their own paper edges ARE the edge */
.bwq-sp canvas.bwq-map, .bwq-sp canvas.bwq-fb, .bwq-sp canvas.bwq-photo {
  border:0; background:transparent; box-shadow:none; transform:rotate(-1.5deg);
  filter:drop-shadow(3px 4px 0 rgba(0,0,0,0.4));
}
.bwq-sp canvas.bwq-photo { width:150px; height:auto; image-rendering:auto; }
/* ⚠️ ABSOLUTE inside the game view, never fixed to the viewport — a fixed
   toast rendered ABOVE the frame on desktop (Trym missed the fishing find
   entirely: the whole payoff played where nobody looks) */
.bwq-toast {
  position:absolute; left:50%; top:52px; transform:translateX(-50%); z-index:5200;
  background:#14240f; color:#ffe135; border:3px solid #000; box-shadow:3px 3px 0 #000;
  font-size:0.8rem; font-weight:800; padding:0.5rem 0.85rem; max-width:88%;
  text-align:center; pointer-events:none; opacity:0; transition:opacity 0.25s ease;
}
.bwq-toast.on { opacity:1; }
/* 🎁 the reward receipt — a card you must click away (the catch-panel
   grammar): what an NPC just gave you, front and centre */
.bwq-rveil {
  position:absolute; inset:0; z-index:5000; display:grid; place-items:center;
  background:rgba(4,8,4,0.55);
}
.bwq-reward {
  width:min(300px, calc(100% - 40px)); box-sizing:border-box;
  background:#101a10; color:#fffdf5; border:4px solid #000; box-shadow:6px 6px 0 #000;
  padding:1rem 1.1rem 1.1rem; text-align:center;
  animation:bwqRwdIn 0.26s cubic-bezier(0.34,1.56,0.64,1);
}
@keyframes bwqRwdIn { 0% { transform:scale(0.6) rotate(-2deg); opacity:0; } 100% { transform:none; opacity:1; } }
.bwq-reward i {
  display:block; font-style:normal; font-size:0.68rem; letter-spacing:0.2em;
  text-transform:uppercase; color:#ffe135; margin-bottom:0.6rem;
}
.bwq-reward p { margin:0 0 0.6rem; font-size:0.92rem; font-weight:800; line-height:1.45; }
/* smooth downscale of the 44px stand coin — pixelated at 16px ate the emboss */
.bwq-reward p img { width:16px; height:16px; vertical-align:-2px; }
.bwq-reward button {
  width:100%; cursor:pointer; font-family:inherit; font-weight:800; font-size:0.95rem;
  background:linear-gradient(#ffe14d,#f2c012); color:#241c00;
  border:3px solid #000; box-shadow:3px 3px 0 #000; padding:0.6rem;
}
.bwq-reward button:active { transform:translate(2px,2px); box-shadow:1px 1px 0 #000; }
/* a reward can carry a DOOR (the finale's My Pass link): the link wears the
   primary yellow and got-it steps back to a quiet ghost */
.bwq-reward a.bwq-reward__go {
  display:block; box-sizing:border-box; width:100%; margin-bottom:0.5rem;
  font-weight:800; font-size:0.95rem; text-decoration:none;
  background:linear-gradient(#ffe14d,#f2c012); color:#241c00;
  border:3px solid #000; box-shadow:3px 3px 0 #000; padding:0.6rem;
}
.bwq-reward a.bwq-reward__go:active { transform:translate(2px,2px); box-shadow:1px 1px 0 #000; }
.bwq-reward a.bwq-reward__go svg { vertical-align:-3px; }
/* 🏷 the fine print: a tilted black stickerpill overflowing the button top */
.bwq-reward a.bwq-reward__go { position:relative; margin-top:0.9rem; overflow:visible; }
.bwq-reward__pill {
  position:absolute; top:-13px; right:-7px; transform:rotate(-4deg);
  font-style:normal; font-size:0.6rem; font-weight:800; line-height:1;
  background:#111; color:#ffe135; border-radius:999px; padding:5px 9px 6px;
  box-shadow:2px 2px 0 rgba(0,0,0,0.4); white-space:nowrap; pointer-events:none;
}
.bwq-reward--link button { background:#182a18; color:#fffdf5; }
/* 🖼 reward ART: the received thing drawn on the receipt, lying at a tilt */
.bwq-reward__art { width:max-content; margin:0 auto 0.55rem; transform:rotate(-2deg); }
.bwq-reward__art canvas, .bwq-reward__peek canvas { display:block; }
.bwq-reward .bwq-photo { width:126px; height:auto; box-shadow:4px 5px 0 rgba(0,0,0,0.45); }
/* 🎫 the pass peek — the picture of the door, itself a door */
.bwq-reward__peek { display:block; width:max-content; margin:0.15rem auto 0.6rem; transform:rotate(1.4deg); }
.bwq-reward__peek:hover { transform:rotate(0deg); }
.bwq-pass { width:204px; height:auto; box-shadow:4px 5px 0 rgba(0,0,0,0.45); }
/* 🎞 the bundle RISES from the water at the float — the strike must happen
   where the player is looking, not in a corner chip */
.bwq-bundle {
  position:absolute; z-index:3000; transform:translate(-50%,-60%);
  pointer-events:none; animation:bwqBundleUp 7s ease-out forwards;
}
.bwq-bundle canvas {
  display:block; image-rendering:pixelated; border:0; background:transparent;
  filter:drop-shadow(0 0 14px rgba(255,225,53,0.9)) drop-shadow(3px 4px 0 rgba(0,0,0,0.4));
}
@keyframes bwqBundleUp {
  0% { opacity:0; margin-top:26px; }
  6% { opacity:1; margin-top:0; }
  92% { opacity:1; }
  100% { opacity:0; margin-top:-8px; }
}
@media (prefers-reduced-motion:reduce) { .bwq-mark, .bwq-mark::before, .bwq-obj::after, .bwq-hint, .bwq-dlg, .bwq-paper, .bwq-box.is-typing p::after, .bwq-more, .bwq-npc--walk, .bwq-qweed::after, .bwq-qtrash::after, .bwq-mapbtn::before { animation:none; } }
`;
  document.head.appendChild(st);
}

// ---- tiny ui helpers ------------------------------------------------------
let toastEl = null, toastT = 0;
let activeView = null;   // set at boot — toasts dock INSIDE the game frame
function toast(msg, ms) {
  const host = activeView || document.body;
  if (!toastEl || toastEl.parentElement !== host) {
    if (toastEl) toastEl.remove();
    toastEl = document.createElement('div');
    toastEl.className = 'bwq-toast';
    host.appendChild(toastEl);
  }
  toastEl.textContent = msg;
  toastEl.classList.add('on');
  clearTimeout(toastT);
  toastT = setTimeout(() => toastEl.classList.remove('on'), ms || 2600);
}

// 🎁 a RECEIVED thing demands a RECEIPT (Trym): the reward toast collided
// with the journal chip and vanished half-read. Every NPC reward now shows
// a card the player must click away — the catch-panel grammar: what you
// got, front and centre, confirmed by you.
function payReward(r) {
  if (!r) return;
  if (r.coins) passStat('coins_earned', r.coins);
  const veil = document.createElement('div');
  veil.className = 'bwq-rveil';
  const card = document.createElement('div');
  card.className = 'bwq-reward';
  let rows = '';
  if (r.coins) rows += '<p><img src="/assets/banana-stand/coin.png" alt=""> +' + r.coins + ' bananacoins</p>';
  if (r.note) rows += '<p></p>';
  // a reward may carry a DOOR (the finale's My Pass link) — the link takes
  // the primary style and got-it steps back to a ghost
  const linkHtml = r.link
    ? '<a class="bwq-reward__go" href="' + r.link.href + '"></a>' : '';
  card.innerHTML = '<i>you received</i>' + rows + linkHtml + '<button type="button">🍌 got it</button>';
  if (r.note) card.querySelectorAll('p')[r.coins ? 1 : 0].textContent = r.note;
  // a reward may carry ART — the received thing itself, drawn, not just named
  if (r.art) {
    const fig = document.createElement('div');
    fig.className = 'bwq-reward__art';
    fig.appendChild(r.art());
    card.insertBefore(fig, card.children[1] || null);
  }
  if (r.link) {
    const go = card.querySelector('.bwq-reward__go');
    // internal constants only — the icon is our own inline pixelarticon svg
    go.innerHTML = (r.link.icon || '') + '<span></span>';
    go.querySelector('span').textContent = (r.link.icon ? ' ' : '') + r.link.label;
    card.classList.add('bwq-reward--link');
    // the chapter's funnel target — count the actual walk-throughs
    go.addEventListener('click', () => track('quest_pass', { href: r.link.href }));
    // 🏷 the door's fine print rides a tilted stickerpill overflowing the
    // button's top corner (the chip-badge grammar) — the button itself
    // stays one short line (Trym)
    if (r.link.pill) {
      const pl = document.createElement('i');
      pl.className = 'bwq-reward__pill';
      pl.textContent = r.link.pill;
      go.appendChild(pl);
    }
    // …and the door may show WHAT it opens (the finale: the pass itself,
    // your banana and name already printed on it) — the picture is a link too
    if (r.link.art) {
      const peek = document.createElement('a');
      peek.className = 'bwq-reward__peek';
      peek.href = r.link.href;
      peek.appendChild(r.link.art());
      peek.addEventListener('click', () => track('quest_pass', { href: r.link.href }));
      card.insertBefore(peek, go);
    }
  }
  veil.appendChild(card);
  (activeView || document.body).appendChild(veil);
  ['pointerdown', 'pointerup', 'touchstart'].forEach((ev) =>
    veil.addEventListener(ev, (e) => e.stopPropagation()));
  card.querySelector('button').addEventListener('click', (e) => { e.stopPropagation(); veil.remove(); });
  veil.addEventListener('click', (e) => { e.stopPropagation(); if (e.target === veil) veil.remove(); });
}

// 🗺 SABREFACE'S MAP — an OBJECT, not a diagram (Trym): a folded-out sheet
// with ragged torn edges, fold creases, sun-bleached colours and worn
// corners. Landmarks (sea, pier, boathouse, court, palms) mirror
// beach-geo.js; the bold red CIRCLE marks an AREA, never an X — the quiet
// NW shore past the sunbeds, where the morning walker always stopped.
const DIG_CIRCLE = { x: 310, y: 355, r: 230 };   // r230: the circle reads BIG and the zone honestly matches it
function questMapCanvas() {
  const cv = document.createElement('canvas');
  cv.width = 310; cv.height = 132;
  cv.className = 'bwq-map';
  const c = cv.getContext('2d');
  const ox = 10, oy = 10, sx = 290 / 2760, sy = 112 / 1100;
  const X = (wx) => ox + wx * sx, Y = (wy) => oy + wy * sy;
  // the ragged tear — FIXED jitter, so the sheet is the same every unfold
  const J = [4, 8, 3, 9, 5, 2, 8, 4, 7, 3, 6, 9, 2, 5];
  let j = 0;
  const jit = () => J[j++ % J.length] * 0.55;
  const tear = () => {
    j = 0;
    c.beginPath();
    for (let x = 6; x <= 304; x += 18) c.lineTo(x, 4 + jit());
    for (let y = 6; y <= 126; y += 14) c.lineTo(306 - jit(), y);
    for (let x = 304; x >= 6; x -= 18) c.lineTo(x, 128 - jit());
    for (let y = 126; y >= 6; y -= 14) c.lineTo(4 + jit(), y);
    c.closePath();
  };
  tear();
  c.save();
  c.clip();
  // old ink on old paper — everything a shade paler than the world it maps
  c.fillStyle = '#d9c290'; c.fillRect(0, 0, 310, 132);                    // worn parchment
  c.fillStyle = '#9fb9bd'; c.fillRect(0, 0, 310, Y(292));                 // the sea, sun-bleached
  c.strokeStyle = 'rgba(150,100,50,0.7)'; c.lineWidth = 1.5; c.setLineDash([3, 2]);
  c.strokeRect(X(690), Y(532), 480 * sx, 480 * sy);                       // the court
  c.setLineDash([]);
  c.fillStyle = '#8f6a3f'; c.fillRect(X(1812), oy, 156 * sx, 320 * sy);   // the pier
  c.fillStyle = '#7d5c35'; c.fillRect(X(1640), Y(720), 120 * sx, 80 * sy); // the boathouse
  c.fillStyle = '#6d8a5a';
  [[160, 545], [1585, 460], [1418, 838]].forEach(([px, py]) => { c.beginPath(); c.arc(X(px), Y(py), 6, 0, 7); c.fill(); });
  c.strokeStyle = '#b03226'; c.lineWidth = 4;                             // the circle, not an X
  c.beginPath(); c.arc(X(DIG_CIRCLE.x), Y(DIG_CIRCLE.y), DIG_CIRCLE.r * sx, 0, 7); c.stroke();
  // fold creases — it lived folded in eighths in a pirate's coat
  [0.27, 0.52, 0.76].forEach((f) => {
    const fx2 = Math.round(310 * f);
    c.fillStyle = 'rgba(90,60,20,0.15)'; c.fillRect(fx2, 0, 2, 132);
    c.fillStyle = 'rgba(255,250,225,0.3)'; c.fillRect(fx2 + 2, 0, 1, 132);
  });
  c.fillStyle = 'rgba(90,60,20,0.13)'; c.fillRect(0, 64, 310, 2);
  c.fillStyle = 'rgba(255,250,225,0.25)'; c.fillRect(0, 66, 310, 1);
  // worn corners + an old stain, then one sepia wash over the lot
  [[10, 12, 30], [298, 14, 26], [12, 120, 28], [296, 118, 32], [160, 70, 24]].forEach(([px, py, r2]) => {
    const g = c.createRadialGradient(px, py, 2, px, py, r2);
    g.addColorStop(0, 'rgba(110,78,36,0.22)'); g.addColorStop(1, 'rgba(110,78,36,0)');
    c.fillStyle = g; c.fillRect(px - r2, py - r2, r2 * 2, r2 * 2);
  });
  c.fillStyle = 'rgba(180,150,105,0.13)'; c.fillRect(0, 0, 310, 132);
  c.restore();
  tear();
  c.strokeStyle = '#6b4a24'; c.lineWidth = 2.5; c.stroke();               // the torn edge itself
  return cv;
}

// 🎞 THE FLIPBOOK — a PROP, not a pasted GIF (Trym: the raw frames on a
// white box read as the homepage image inserted into the game). A stack of
// torn, aged pages stitched at the top, and the banana drawn as an INK
// SKETCH on the paper: the real 8 frames off the engine sheet, luminance-
// mapped to pencil ink — because the story says the stranger practised
// "the same little drawings, over and over". The dance is still the real
// 1999 dance; it just looks drawn by a hand.
function flipbookCanvas() {
  const cv = document.createElement('canvas');
  cv.width = 132; cv.height = 144;
  cv.className = 'bwq-fb';
  const c = cv.getContext('2d');
  const img = new Image();
  img.src = '/assets/banana-dance.png?v=7';
  // pre-ink the 8 frames once the sheet lands (cheap: 84×90 each)
  const inks = [];
  const makeInks = () => {
    if (inks.length || !img.complete || !img.naturalWidth) return;
    for (let i = 0; i < 8; i++) {
      const o = document.createElement('canvas');
      o.width = 84; o.height = 90;
      const oc = o.getContext('2d');
      oc.imageSmoothingEnabled = false;
      oc.drawImage(img, i * 469, 0, 469, 498, 0, 0, 84, 90);
      const d = oc.getImageData(0, 0, 84, 90);
      const px = d.data;
      for (let p = 0; p < px.length; p += 4) {
        if (px[p + 3] === 0) continue;
        const lum = (px[p] + px[p + 1] + px[p + 2]) / 3;
        px[p] = 66; px[p + 1] = 48; px[p + 2] = 28;          // pencil-brown ink
        px[p + 3] = Math.min(255, Math.max(0, (255 - lum) * 1.25));
      }
      oc.putImageData(d, 0, 0);
      inks.push(o);
    }
  };
  // a rough-edged page — FIXED jitter (the map's trick), so the tear holds still
  const J = [2, 4, 1, 5, 3, 2, 5, 1, 4, 2];
  const page = (x, y, rot, w, h, fill) => {
    c.save();
    c.translate(x + w / 2, y + h / 2);
    c.rotate(rot);
    c.beginPath();
    let j = 0;
    const jit = () => J[j++ % J.length] * 0.5;
    for (let px2 = -w / 2; px2 <= w / 2; px2 += 14) c.lineTo(px2, -h / 2 + jit());
    for (let py2 = -h / 2; py2 <= h / 2; py2 += 12) c.lineTo(w / 2 - jit(), py2);
    for (let px2 = w / 2; px2 >= -w / 2; px2 -= 14) c.lineTo(px2, h / 2 - jit());
    for (let py2 = h / 2; py2 >= -h / 2; py2 -= 12) c.lineTo(-w / 2 + jit(), py2);
    c.closePath();
    c.fillStyle = fill;
    c.fill();
    c.strokeStyle = '#6b4a24';
    c.lineWidth = 1.5;
    c.stroke();
    c.restore();
  };
  let f = 0;
  const draw = () => {
    makeInks();
    c.clearRect(0, 0, 132, 144);
    // the stack: two dog-eared pages peeking out behind the top one
    page(14, 14, 0.05, 108, 122, '#cdb684');
    page(9, 8, -0.035, 110, 124, '#d9c493');
    page(6, 4, 0.012, 112, 126, '#e8d7a6');
    // the stitching that binds it — two dark thread loops at the top
    c.fillStyle = '#3a2a16';
    c.fillRect(34, 2, 5, 12);
    c.fillRect(88, 3, 5, 12);
    // the drawing on the top page
    if (inks.length) {
      c.imageSmoothingEnabled = false;
      c.drawImage(inks[f], 22, 24);
    }
    // the practising hand's scribbled page line
    c.fillStyle = 'rgba(90,60,20,0.35)';
    c.fillRect(30, 118, 66, 2);
  };
  draw();
  const t = setInterval(() => {
    if (!cv.isConnected) { clearInterval(t); return; }
    f = (f + 1) % 8;
    draw();
  }, 130);
  return cv;
}

// 🖼 THE PHOTOGRAPH — the chapter's whole mystery in one object (Trym: if a
// photograph is referenced, make art for it — show, don't tell). An old
// chemist print: warm-white border, the wide chin, and a sepia scene of
// Plot 11 with the little house that has never stood there — one window lit.
// A hand wrote the where and when on the chin. Drawn at 2× for crisp text.
function photoCanvas() {
  const cv = document.createElement('canvas');
  cv.width = 300; cv.height = 344;
  cv.className = 'bwq-photo';
  const c = cv.getContext('2d');
  c.scale(2, 2);
  // the paper, edges gone cream with age
  c.fillStyle = '#efe7d2'; c.fillRect(0, 0, 150, 172);
  c.strokeStyle = '#d8c9a4'; c.lineWidth = 2; c.strokeRect(1, 1, 148, 170);
  const px = 11, py = 11, pw = 128, ph = 118;
  c.save();
  c.beginPath(); c.rect(px, py, pw, ph); c.clip();
  // sky, gone tea-coloured
  const sky = c.createLinearGradient(0, py, 0, py + 74);
  sky.addColorStop(0, '#e0d0a8'); sky.addColorStop(1, '#cdb98c');
  c.fillStyle = sky; c.fillRect(px, py, pw, 74);
  // the treeline behind the plot
  c.fillStyle = '#9a865e';
  [[10, 16], [34, 12], [126, 13], [142, 17]].forEach(([tx, tr]) => {
    c.beginPath(); c.arc(px + tx, py + 62, tr, 0, 7); c.fill();
  });
  // the ground
  const gr = c.createLinearGradient(0, py + 64, 0, py + ph);
  gr.addColorStop(0, '#b3a077'); gr.addColorStop(1, '#9c885e');
  c.fillStyle = gr; c.fillRect(px, py + 64, pw, ph - 64);
  // the path to the door
  c.fillStyle = '#c6b489';
  c.beginPath();
  c.moveTo(px + 52, py + ph); c.lineTo(px + 70, py + ph);
  c.lineTo(px + 80, py + 92); c.lineTo(px + 73, py + 92);
  c.closePath(); c.fill();
  // THE HOUSE — small, gabled, real as anything
  c.fillStyle = '#6d5838'; c.fillRect(px + 58, py + 52, 46, 40);
  c.fillStyle = '#7d6644'; c.fillRect(px + 58, py + 52, 12, 40);
  c.fillStyle = '#4b3922';
  c.beginPath(); c.moveTo(px + 52, py + 54); c.lineTo(px + 81, py + 32);
  c.lineTo(px + 110, py + 54); c.closePath(); c.fill();
  c.fillStyle = '#59452a'; c.fillRect(px + 96, py + 37, 7, 13);   // chimney
  c.fillStyle = '#42311c'; c.fillRect(px + 72, py + 74, 11, 18);  // door
  // THE WINDOW — lit. warm. somebody home.
  const wg = c.createRadialGradient(px + 93, py + 66, 2, px + 93, py + 66, 16);
  wg.addColorStop(0, 'rgba(245,215,120,0.5)'); wg.addColorStop(1, 'rgba(245,215,120,0)');
  c.fillStyle = wg; c.fillRect(px + 77, py + 50, 32, 32);
  c.fillStyle = '#f2da8c'; c.fillRect(px + 88, py + 60, 11, 11);
  c.strokeStyle = '#42311c'; c.lineWidth = 1.5;
  c.strokeRect(px + 88, py + 60, 11, 11);
  c.beginPath(); c.moveTo(px + 93.5, py + 60); c.lineTo(px + 93.5, py + 71);
  c.moveTo(px + 88, py + 65.5); c.lineTo(px + 99, py + 65.5); c.stroke();
  // the tree by the house
  c.fillStyle = '#57432a'; c.fillRect(px + 26, py + 58, 5, 26);
  c.fillStyle = '#8a7448';
  [[24, 13, 50], [36, 11, 50], [29, 10, 40]].forEach(([tx, tr, ty]) => {
    c.beginPath(); c.arc(px + tx, py + ty, tr, 0, 7); c.fill();
  });
  // grass tufts up front
  c.strokeStyle = 'rgba(70,55,30,0.5)'; c.lineWidth = 1.5;
  [[20, 108], [34, 114], [96, 110], [112, 116], [124, 106]].forEach(([gx, gy]) => {
    c.beginPath(); c.moveTo(px + gx, py + gy); c.lineTo(px + gx - 2, py + gy - 5);
    c.moveTo(px + gx, py + gy); c.lineTo(px + gx + 2, py + gy - 5); c.stroke();
  });
  // age: corner vignettes, one scratch, dust
  [[px, py], [px + pw, py], [px, py + ph], [px + pw, py + ph]].forEach(([vx, vy]) => {
    const v = c.createRadialGradient(vx, vy, 4, vx, vy, 42);
    v.addColorStop(0, 'rgba(72,52,26,0.32)'); v.addColorStop(1, 'rgba(72,52,26,0)');
    c.fillStyle = v; c.fillRect(vx - 42, vy - 42, 84, 84);
  });
  c.strokeStyle = 'rgba(255,250,232,0.5)'; c.lineWidth = 1;
  c.beginPath(); c.moveTo(px + 96, py + 6); c.lineTo(px + 74, py + 112); c.stroke();
  c.fillStyle = 'rgba(255,250,232,0.65)';
  [[30, 30], [104, 22], [58, 96], [120, 74], [20, 80]].forEach(([dx, dy]) => c.fillRect(px + dx, py + dy, 1.5, 1.5));
  c.fillStyle = 'rgba(122,92,50,0.10)'; c.fillRect(px, py, pw, ph);   // sepia wash
  c.restore();
  c.strokeStyle = 'rgba(90,70,40,0.45)'; c.lineWidth = 1.5; c.strokeRect(px, py, pw, ph);
  // the chin: a hand wrote where and when (the 1999 of the registry page)
  c.fillStyle = '#6a5836';
  c.font = 'italic 700 13px Georgia, "Times New Roman", serif';
  c.textAlign = 'center';
  c.fillText('plot 11 — 1999', 75, 154);
  return cv;
}

// 🎫 THE PASS — the receipt shows the REAL thing (Trym: My Pass has a card
// visual, use it). A canvas rendition of /pass/'s official card — banana
// face, ink header + punched hole, YOUR banana and YOUR name already on it,
// barcode, serial, red OFFICIAL stamp — so the door under it explains itself.
function passCanvas() {
  const cv = document.createElement('canvas');
  cv.width = 440; cv.height = 256;
  cv.className = 'bwq-pass';
  const c = cv.getContext('2d');
  c.scale(2, 2);
  // the yellow face + ink frame
  c.fillStyle = '#141414'; c.fillRect(0, 0, 220, 128);
  c.fillStyle = '#ffe135'; c.fillRect(3, 3, 214, 122);
  // header strip + punched hole
  c.fillStyle = '#141414'; c.fillRect(8, 8, 204, 20);
  c.fillStyle = '#ffe135';
  // spaced caps like the real header — but never under the punched hole:
  // step the letter-spacing down until the line clears it
  let ls = 1.5;
  const hdrFont = () => {
    try { c.letterSpacing = ls + 'px'; } catch (e) {}
    c.font = '800 8px Verdana, sans-serif';
  };
  hdrFont();
  while (c.measureText('BANANA WORLD · RESIDENT PASS').width > 176 && ls > 0) { ls -= 0.25; hdrFont(); }
  c.fillText('BANANA WORLD · RESIDENT PASS', 14, 21);
  try { c.letterSpacing = '0px'; } catch (e) {}
  c.fillStyle = '#fffdf5'; c.beginPath(); c.arc(202, 18, 4, 0, 7); c.fill();
  // your banana, on your pass (lands when the engine sheet is ready)
  assetsReady().then(() => {
    if (!cv.isConnected) return;
    const o = document.createElement('canvas');
    o.width = 160; o.height = 160;
    try { drawComposite(o.getContext('2d'), 160, 0, myDraw()); } catch (e) { return; }
    c.imageSmoothingEnabled = false;
    c.drawImage(o, 12, 32, 58, 58);
  });
  // your name (or the pass page's own default), shrunk to fit
  let nm = '';
  try { nm = (localStorage.getItem('ps-name-v1') || '').trim(); } catch (e) {}
  nm = (nm || 'fresh dancing banana').slice(0, 24);
  c.fillStyle = '#141414';
  let fs = 14;
  c.font = '900 ' + fs + 'px "Archivo Black", Verdana, sans-serif';
  while (c.measureText(nm).width > 132 && fs > 9) {
    fs -= 1;
    c.font = '900 ' + fs + 'px "Archivo Black", Verdana, sans-serif';
  }
  c.fillText(nm, 76, 52);
  c.font = '800 7px Verdana, sans-serif';
  c.globalAlpha = 0.72;
  c.fillText('MEMBER SINCE — TODAY?', 76, 66);
  c.globalAlpha = 1;
  // rank chip
  c.fillStyle = '#141414'; c.fillRect(76, 74, 72, 15);
  c.fillStyle = '#ffe135'; c.font = '800 8px Verdana, sans-serif';
  c.fillText('NEW IN TOWN', 83, 84.5);
  // barcode + serial (plot 11, the registry's 1999)
  const BARS = [3, 1, 2, 1, 1, 3, 1, 2, 2, 1, 3, 1, 1, 2, 1, 3, 2, 1, 1, 2, 3, 1, 2, 1];
  let bx = 12;
  c.fillStyle = '#141414';
  BARS.forEach((w2, i2) => { if (i2 % 2 === 0) c.fillRect(bx, 102, w2, 16); bx += w2 + 1; });
  c.font = '800 7px Verdana, sans-serif';
  c.fillText('Nº 11 · 1999', 92, 115);
  // the red OFFICIAL stamp
  c.save();
  c.translate(179, 97); c.rotate(-0.14);
  c.globalAlpha = 0.85;
  c.strokeStyle = '#e22020'; c.lineWidth = 2.5; c.strokeRect(-34, -12, 68, 24);
  c.lineWidth = 1; c.strokeRect(-31, -9, 62, 18);
  c.fillStyle = '#e22020'; c.font = '900 11px "Archivo Black", Verdana, sans-serif';
  c.textAlign = 'center';
  c.fillText('OFFICIAL', 0, 4);
  c.restore();
  return cv;
}

// ---- the engine -----------------------------------------------------------
export function bootQuest() {
  const path = location.pathname;
  const area = path.includes('homestead') ? 'homestead'
    : path.includes('park') ? 'park'
      : path.includes('beach') ? 'beach'
        : path.includes('rave') ? 'rave' : null;
  if (!area) return;

  // test conveniences — ⚠️ questreset must run BEFORE the done gate, or a
  // finished chapter can never be replayed on the device
  if (/[?&]questreset/.test(location.search)) { S = { s: 0, k: {}, res: 0, done: 0 }; save(); }
  if (S.done) return;
  const jump = location.search.match(/[?&]queststep=(\d+)/);
  if (jump) { S.s = Math.min(STEPS.length - 1, +jump[1]); S.k = {}; save(); }

  // resident branch: decided ONCE, at the moment the quest first runs
  if (S.s === 0 && !S.resSet) {
    try { S.res = ((JSON.parse(localStorage.getItem('hs-v1') || '{}').stage) || 0) >= 1 ? 1 : 0; } catch (e) {}
    S.resSet = 1; save();
  }

  ensureCss();
  activeView = document.querySelector(AREAS[area].view) || null;
  const layer = [];   // live quest DOM in this area
  let dlg = null, dlgTimer = null, watchTimer = null, introBusy = false;
  let chipDelayed = false;   // the first chip of a visit holds back ~5s
  let nibEl = null;          // his body — so a finished talk can walk him off

  // 🚶 done talking, Nib LEAVES — steps down to the road, then walks east
  // toward the park until the trees take him. Spliced out of the layer
  // first, so the advance()'s clearLayer doesn't blink him away mid-stride.
  function nibWalkOff(n) {
    const at = layer.indexOf(n);
    if (at >= 0) layer.splice(at, 1);
    nibEl = null;
    n.classList.add('bwq-npc--walk');
    // 🕺 a MOVING banana dances — the locked standing frame gliding along
    // read as a statue on wheels (Trym). Same cadence as every walker.
    const cv = n.querySelector('canvas');
    let f = 0;
    const anim = setInterval(() => {
      if (!cv || !cv.isConnected) { clearInterval(anim); return; }
      f = (f + 1) % NFRAMES;
      try { drawComposite(cv.getContext('2d'), 150, f, NIB_DRAW); } catch (e) {}
    }, 110);
    n.style.zIndex = String(100 + Math.round((AREAS[area].wh || 1100) * 0.82));
    n.style.transition = 'left 1.2s linear, top 1.2s linear';
    requestAnimationFrame(() => { n.style.top = '81%'; });          // onto the road
    setTimeout(() => {
      n.style.transition = 'left 5.5s linear';
      n.style.left = '97%';                                          // and off east
    }, 1300);
    setTimeout(() => n.remove(), 7200);
  }

  const world = () => document.querySelector(AREAS[area].sel);

  const unhook = [];   // listeners planted on the areas' own NPC elements

  function clearLayer() {
    layer.splice(0).forEach((el) => el.remove());
    if (dlg) { dlg.remove(); dlg = null; }
    clearInterval(watchTimer);
    unhook.splice(0).forEach((f) => f());
    window.bwqTalk = null;
  }

  function place(el, at) {
    // ⚠️ anchor by MEASURED RECT, never by style.left — Peel's marker landed on
    // the FOUNTAIN because .pk-old isn't positioned the way its style implies.
    // Measuring the element against the world is true for every engine.
    let x = at.x, y = at.y;
    const t = at.sel && document.querySelector(at.sel);
    const w = world();
    if (t && w) {
      const tr = t.getBoundingClientRect(), wr = w.getBoundingClientRect();
      if (tr.width && wr.width) {
        x = ((tr.left + tr.width / 2) - wr.left) / wr.width * 100 + (at.dx || 0);
        y = (tr.top - wr.top) / wr.height * 100 + (at.dy || 0);
        // `dh` = extra offset as a FRACTION of the anchor's own height —
        // for anchors whose box has empty headroom (Barty's 150px canvas:
        // his hat sits ~40% down it, so rect-top floated the mark high)
        if (at.dh) y += tr.height / wr.height * 100 * at.dh;
      } else if (t.style.left) {
        // ⚠️ the beach hides its NPCs (display:none) until you walk up, so
        // there is no rect — but their style.left/top % is still the true
        // world position. The park is the OPPOSITE (.pk-old's style misleads,
        // its rect is true). Rect when laid out, style when hidden.
        x = parseFloat(t.style.left) + (at.dx || 0);
        y = parseFloat(t.style.top) + (at.dy || 0);
      }
    }
    el.__at = at;             // the self-heal tick re-places from this
    el.style.left = x + '%';
    el.style.top = (y - 1) + '%';
  }

  // the journal chip steps aside while a talk is on (Trym) — the next
  // objective's render() brings it back
  function hideHint() {
    const h = document.querySelector('.bwq-hint');
    if (h) h.hidden = true;
  }

  // `replay` = an informational re-show (Sabreface's chart mid-hunt): the
  // dialogue closes without paying or advancing anything
  function openDialog(step, replay) {
    hideHint();
    const lines = (S.res && step.linesRes) ? step.linesRes : step.lines;
    let i = 0, typeT = null, txt = '', at = 0, popWho = '';
    if (dlg) dlg.remove();
    dlg = document.createElement('div');
    dlg.className = 'bwq-dlg';
    dlg.innerHTML = '<div class="bwq-pop"><canvas width="390" height="390"></canvas></div>'
      + '<h2></h2>'
      + '<div class="bwq-box"><p></p><span class="bwq-more" aria-hidden="true">▼</span></div>'
      + '<div class="bwq-ans" hidden></div>'
      + '<div class="bwq-sp" hidden></div>';
    // ⚠️ docked INSIDE the game frame — fixed-to-viewport put it below the
    // world on desktop, out of frame entirely (Trym's screenshots)
    const host = document.querySelector(AREAS[area].view) || document.body;
    host.appendChild(dlg);
    // dock the card AWAY from whoever is speaking: measure the NPC (or the
    // marker) against the frame's midline and flip to the top if they are low
    try {
      const hostR = host.getBoundingClientRect();
      const who = nibEl || document.querySelector('.bwq-mark')
        || (step.tapSel && document.querySelector(step.tapSel));
      if (who) {
        const r = who.getBoundingClientRect();
        if (r.top + r.height / 2 > hostR.top + hostR.height * 0.5) dlg.classList.add('bwq-dlg--mid');
      }
    } catch (e) { /* no measurement, keep the default bottom dock */ }
    const pop = dlg.querySelector('.bwq-pop'), popCv = pop.querySelector('canvas'),
      h2 = dlg.querySelector('h2'), box = dlg.querySelector('.bwq-box'),
      p = box.querySelector('p'), sp = dlg.querySelector('.bwq-sp'),
      ans = dlg.querySelector('.bwq-ans');
    let awaiting = false;   // a reply button is up — only IT may advance
    const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const typeDone = () => {
      clearInterval(typeT); typeT = null;
      p.textContent = txt;
      box.classList.remove('is-typing');
      box.classList.add('is-done');
    };
    const type = (t) => {
      clearInterval(typeT); typeT = null;
      txt = t; at = 0;
      box.classList.remove('is-done');
      if (RM) { typeDone(); return; }
      box.classList.add('is-typing');
      p.textContent = '';
      typeT = setInterval(() => {
        if (!p.isConnected) { clearInterval(typeT); return; }
        at += 1;
        p.textContent = txt.slice(0, at);
        if (at >= txt.length) typeDone();
      }, 32);
    };
    // the portrait: the SAME zoomed waist-up crop as Old Peel's card, redrawn
    // only when the speaker changes (nib → you → nib mid-scene)
    const portrait = (who) => {
      if (who === popWho) return;
      popWho = who;
      const w = WHO[who];
      const d = who === 'you' ? myDraw() : w.d;
      assetsReady().then(() => {
        if (popWho !== who || !popCv.isConnected) return;
        const pc = popCv.getContext('2d');
        pc.clearRect(0, 0, 390, 390);
        pc.save();
        pc.scale(1.5, 1.5); pc.translate(-390 * 0.167, -390 * 0.22);
        try { drawComposite(pc, 390, w.f || 0, d); } catch (e) {}
        pc.restore();
      });
    };
    const next = () => {
      i++;
      if (i < lines.length) { show(); return; }
      dlg.remove(); dlg = null;
      if (replay) { render(); return; }   // the chip comes back, nothing moves
      payReward(step.reward);
      if (step.leave && nibEl && nibEl.isConnected) nibWalkOff(nibEl);
      advance();
    };
    const show = () => {
      const [who, text] = lines[i];
      // 🗣 YOUR line = a reply BUTTON (Trym: tap-through blurred who was
      // speaking; the park question-deck grammar instead). The NPC's last
      // words stay on the card, your reply waits as a button, and clicking
      // it IS saying it — straight into the NPC's answer.
      if (who === 'you') {
        awaiting = true;
        sp.hidden = true; pop.hidden = false; h2.hidden = false; box.hidden = false;
        box.classList.remove('is-done');   // the ▼ yields to the reply button
        ans.innerHTML = '';
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = text;
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          awaiting = false;
          ans.hidden = true;
          next();
        });
        ans.appendChild(b);
        ans.hidden = false;
        return;
      }
      ans.hidden = true;
      const w = WHO[who];
      if (!w) {   // paper / map / fb — the prop takes the stage alone
        pop.hidden = true; h2.hidden = true; box.hidden = true; sp.hidden = false;
        if (who === 'paper') {
          sp.innerHTML = '<div class="bwq-paper"></div><small>tap to continue</small>';
          sp.querySelector('.bwq-paper').textContent = text;
        } else if (who === 'map') {
          sp.innerHTML = '<b>sabreface’s map</b><small>tap to continue</small>';
          sp.insertBefore(questMapCanvas(), sp.querySelector('small'));
        } else if (who === 'photo') {
          sp.innerHTML = '<b>the photograph</b><small>tap to continue</small>';
          sp.insertBefore(photoCanvas(), sp.querySelector('small'));
        } else {
          sp.innerHTML = '<b>the flipbook</b><small>tap to continue</small>';
          sp.insertBefore(flipbookCanvas(), sp.querySelector('small'));
        }
        return;
      }
      sp.hidden = true; pop.hidden = false; h2.hidden = false; box.hidden = false;
      h2.textContent = w.n;
      h2.style.color = w.c;
      portrait(who);
      type(text);
    };
    // ⚠️ the sheet lives INSIDE the view — without these stops every tap on it
    // ALSO walks the banana underneath (the areas walk on view click/pointerup)
    ['pointerdown', 'pointerup', 'touchstart'].forEach((ev) =>
      dlg.addEventListener(ev, (e) => e.stopPropagation()));
    dlg.addEventListener('click', (e) => {
      e.stopPropagation();
      if (typeT) { typeDone(); return; }   // mid-type tap = the whole line now
      if (awaiting) return;                // your reply button is the only door
      next();
    });
    show();
  }

  function advance() {
    track('quest_step', { id: STEPS[S.s] && STEPS[S.s].id, done: 1 });
    S.s++; S.k = {};
    passStat('quest_c1', 1);            // monotonic mirror for future sync
    if (S.s >= STEPS.length) { S.done = 1; toast('🍌 CHAPTER ONE — complete', 4200); }
    save();
    render();
  }

  function render() {
    clearLayer();
    if (S.done) return;
    const step = STEPS[S.s];
    if (!step) return;
    const w = world();
    if (!w) { setTimeout(render, 400); return; }   // world still booting

    // the journal chip — always present, and it is also the "you're in the
    // wrong area" compass. ⚠️ a TALK step shows its `find` line (who to find),
    // not its hint (what comes AFTER the talk) — step 0 was captioned "find
    // Old Peel" before Nib had said a word.
    const label = (step.kind === 'talk')
      ? ((S.res && step.findRes) || step.find || ('talk to ' + (WHO[step.who] || {}).n)) : step.hint;
    if (label) {
      const h = document.createElement('div');
      h.className = 'bwq-hint';
      h.innerHTML = '<i class="bwq-hint__badge">' + MARK_SVG + '</i><span></span>';
      // internal strings only — a hint may carry an inline sprite (the
      // banana phone) so chip icons match the action bar's real art
      h.querySelector('span').innerHTML = label;
      if (!chipDelayed) {   // let the world land first, then pop the journal in
        chipDelayed = true;
        h.classList.add('bwq-hint--wait');
        setTimeout(() => { if (h.isConnected) h.classList.remove('bwq-hint--wait'); }, 5000);
      }
      (document.querySelector(AREAS[area].chipHost || AREAS[area].view) || w).appendChild(h);
      layer.push(h);
    }
    if (step.area !== area) return;      // objective lives elsewhere — hint covers it

    if (step.kind === 'talk') {
      // residents get their own anchor where a step carries one (Nib waits
      // across the road instead of in their fence opening)
      const at = (S.res && step.atRes) || step.at;
      // 🎬 CHAPTER I splash — plays when you OPEN the questline at Nib, not
      // on area boot (Trym: it must never compete with the homestead's
      // first-visit tutorial). Fade in → hold → fade out → the dialogue.
      // Once per device (S.in); ?questreset replays it.
      const talk = () => {
        if (introBusy) return;
        if (step.who !== 'nib' || S.s !== 0 || S.in) { openDialog(step); return; }
        introBusy = true;
        hideHint();          // the chip yields to the splash too
        S.in = 1; save();
        const sp = document.createElement('div');
        sp.className = 'bwq-intro';
        sp.innerHTML = '<i>chapter i</i><b>what the plot?</b>';
        (document.querySelector(AREAS[area].view) || document.body).appendChild(sp);
        track('quest_intro');
        // fade in only once the display font is ready — the FOUT hides
        // inside the pre-fade; the hold clock starts at the reveal
        Promise.race([fontWarm(), new Promise((r) => setTimeout(r, 800))]).then(() => {
          requestAnimationFrame(() => sp.classList.add('is-on'));
          setTimeout(() => {
            sp.classList.remove('is-on');
            setTimeout(() => sp.remove(), 600);
            introBusy = false;
            openDialog(step);
          }, 3000);
        });
      };
      // 🗣 QUEST FIRST (Trym): while a talk step targets an NPC, tapping the
      // NPC starts the QUEST — not their everyday dialogue. Two prongs:
      // window.bwqTalk is the handle the areas' own tap zones check (park's
      // tapOld, the beach NPC rects), and a capture listener on the body
      // catches direct element clicks (Barty has no tap of his own at all).
      // `mark: 1` = a quest marker hangs over this NPC right now — their
      // ambient chit-chat holds its tongue (chatter under the ! / ? is
      // noise, Trym). The digzone's bwqTalk carries no mark, so Sabreface
      // may still mutter during the hunt.
      window.bwqTalk = { who: step.who, open: talk, mark: 1 };
      // (document-level capture, delegated: the NPC element may not exist yet
      // when this render runs, and it fires before every area handler)
      const tapSel = step.tapSel || (step.at && step.at.sel);
      if (tapSel) {
        // ⚠️ the rave's bar strip is pointer-events:none (decor over the
        // floor) — a click over Barty targeted the FLOOR and closest() never
        // matched, so only the mark worked (Trym). While his talk step is
        // live, the body opts back in (a child may override the parent's
        // none) — restored on unhook. Retried briefly: some NPC bodies are
        // drawn after assetsReady.
        let peTries = 0;
        const optIn = () => {
          const body = document.querySelector(tapSel);
          if (!body) { if (peTries++ < 10) setTimeout(optIn, 400); return; }
          const prevPe = body.style.pointerEvents, prevCur = body.style.cursor;
          body.style.pointerEvents = 'auto';
          body.style.cursor = 'pointer';
          unhook.push(() => { body.style.pointerEvents = prevPe; body.style.cursor = prevCur; });
        };
        optIn();
        const onTap = (e) => {
          if (!e.target.closest || !e.target.closest(tapSel)) return;
          e.stopPropagation();
          talk();
        };
        document.addEventListener('click', onTap, true);
        unhook.push(() => document.removeEventListener('click', onTap, true));
      }
      // 🍌 Nib stands there in person — the ! floats above HIM, and tapping
      // either talks. Existing NPCs (Peel, Barty…) already have bodies.
      if (step.who === 'nib') {
        const n = document.createElement('div');
        n.className = 'bwq-npc';
        const cv = document.createElement('canvas');
        cv.width = 150; cv.height = 160;
        n.appendChild(cv);
        place(n, at);
        // the area's own depth formula — the player passes in FRONT below him
        n.style.zIndex = String(100 + Math.round((AREAS[area].wh || 1100) * at.y / 100));
        n.addEventListener('pointerdown', (e) => e.stopPropagation());
        n.addEventListener('click', (e) => { e.stopPropagation(); talk(); });
        w.appendChild(n); layer.push(n);
        nibEl = n;
        assetsReady().then(() => { try { drawComposite(cv.getContext('2d'), 150, 0, NIB_DRAW); } catch (e) {} });
      }
      const m = document.createElement('div');
      m.className = 'bwq-mark';
      m.innerHTML = step.turnin ? MARKQ_SVG : MARK_SVG;
      // above the NPC's head — a WORLD-% offset, since Nib is %-sized too
      // (-9: -11.5 floated it a full head-height too high — Trym)
      place(m, step.who === 'nib' ? { ...at, y: at.y - 9 } : at);
      m.addEventListener('click', (e) => { e.stopPropagation(); talk(); });
      m.addEventListener('pointerdown', (e) => e.stopPropagation());
      w.appendChild(m); layer.push(m);
    } else if (step.kind === 'objects') {
      // 🌼 Peel's bed steps: `tend` hands the bed to the quest (his fussing
      // pauses), `thirst` wilts his flowers ON THIS DEVICE ONLY, and each
      // watering `heal`s its own flower straight back to bloom.
      if (step.tend) {
        window.bwqTend = true;
        unhook.push(() => { window.bwqTend = false; });
      }
      if (step.thirst) {
        const dry = () => document.querySelectorAll(step.thirst).forEach((p) => {
          const healed = step.objects.some((o) => o.heal && p.matches(o.heal) && (S.k[o.id] || 0) >= o.taps);
          p.classList.toggle('bwq-thirsty', !healed);
        });
        dry();
        const dryT = setInterval(dry, 1200);   // the park may lay out late
        unhook.push(() => {
          clearInterval(dryT);
          document.querySelectorAll(step.thirst).forEach((p) => p.classList.remove('bwq-thirsty'));
        });
      }
      step.objects.forEach((o) => {
        if ((S.k[o.id] || 0) >= o.taps) return;
        if (step.tend && o.kind === 'weed') return;   // rendered as REAL weeds below
        if (step.sweep && o.kind === 'trash') return; // rendered as REAL litter below
        const el = document.createElement('div');
        el.className = 'bwq-obj bwq-obj--' + o.kind;
        el.innerHTML = '<i></i>';
        place(el, o);
        el.addEventListener('pointerdown', (e) => e.stopPropagation());
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          S.k[o.id] = (S.k[o.id] || 0) + 1;
          save();
          const msg = o.steps ? o.steps[S.k[o.id] - 1] : o.done;
          if (msg) toast(msg);
          if (S.k[o.id] >= o.taps) {
            el.remove();
            if (o.heal) {
              const p = document.querySelector(o.heal);
              // 💧 the watering pays off VISIBLY: bloom back + a glow burst
              if (p) {
                p.classList.remove('bwq-thirsty');
                p.classList.add('bwq-healed');
                setTimeout(() => p.classList.remove('bwq-healed'), 950);
              }
            }
          }
          if (step.objects.every((q) => (S.k[q.id] || 0) >= q.taps)) advance();
        });
        w.appendChild(el); layer.push(el);
      });
      // 🌿 the quest weeds are REAL pk-weed sprites, pulled with the park's
      // own 🌿 pull button — window.bwqWeeds feeds park-garden's tool scan,
      // and pull() plays the exact is-pulled pop the everyday weeds play.
      if (step.tend) {
        const qw = [];
        step.objects.forEach((o, idx) => {
          if (o.kind !== 'weed' || (S.k[o.id] || 0) >= o.taps) return;
          const el = document.createElement('div');
          el.className = 'pk-weed pk-weed--' + (1 + idx % 2) + ' bwq-qweed';
          el.style.left = o.x + '%';
          el.style.top = o.y + '%';
          const wx = o.x / 100 * 2760, wy = o.y / 100 * 1100;   // park world units
          el.style.zIndex = String(100 + Math.round(wy));
          w.appendChild(el); layer.push(el);
          qw.push({ id: o.id, x: wx, y: wy, el,
            pull: () => {
              el.classList.add('is-pulled');
              setTimeout(() => el.remove(), 360);
              S.k[o.id] = 1;
              save();
              passStat('rep', 1);   // same little wage the everyday pull pays
              toast('🌿 pulled!');
              window.bwqWeeds = (window.bwqWeeds || []).filter((q) => q.id !== o.id);
              if (step.objects.every((q2) => (S.k[q2.id] || 0) >= q2.taps)) advance();
            } });
        });
        window.bwqWeeds = qw;
        unhook.push(() => { window.bwqWeeds = null; });
      }
      // 🗑 quest litter = REAL pk-trash sprites, picked up by WALKING over
      // them (window.bwqTrash rides park-garden's trashTick) — the chip
      // counts the sweep so the park-wide walk always shows progress
      if (step.sweep) {
        const total = step.objects.filter((o) => o.kind === 'trash').length;
        const chipTxt = layer[0] && layer[0].querySelector('span');
        const paintT = () => {
          if (!chipTxt) return;
          const n = step.objects.filter((o) => o.kind === 'trash' && (S.k[o.id] || 0) >= o.taps).length;
          chipTxt.textContent = step.hint + ' · ' + n + '/' + total;
        };
        paintT();
        const qt = [];
        step.objects.forEach((o, idx) => {
          if (o.kind !== 'trash' || (S.k[o.id] || 0) >= o.taps) return;
          const el = document.createElement('div');
          el.className = 'pk-trash pk-trash--' + (1 + idx % 3) + ' bwq-qtrash';
          el.style.left = o.x + '%';
          el.style.top = o.y + '%';
          const wx = o.x / 100 * 2760, wy = o.y / 100 * 1100;   // park world units
          el.style.zIndex = String(100 + Math.round(wy));
          w.appendChild(el); layer.push(el);
          qt.push({ id: o.id, x: wx, y: wy, el,
            take: () => {
              el.classList.add('is-popped');   // the everyday litter pop
              setTimeout(() => el.remove(), 360);
              S.k[o.id] = 1;
              save();
              passStat('rep', 2);              // same wage as everyday litter
              toast('🗑 litter cleared');
              paintT();
              window.bwqTrash = (window.bwqTrash || []).filter((q) => q.id !== o.id);
              if (step.objects.every((q2) => (S.k[q2.id] || 0) >= q2.taps)) advance();
            } });
        });
        window.bwqTrash = qt;
        unhook.push(() => { window.bwqTrash = null; });
      }
    } else if (step.kind === 'digzone') {
      // 🗺 dig the circle with the REAL ⛏: the beach makes a .bh-hole for
      // every FRESH dig (spent sand makes none — the farm fix is the pacing
      // here), so watching #bhDigs is a read-only seam: no beach code touched,
      // and the 3 finds need 3 genuinely different spots inside the circle.
      const chip = layer[0];
      const chipTxt = chip && chip.querySelector('span');
      const paint = () => { if (chipTxt) chipTxt.textContent = step.hint + ' · ' + Math.min(S.k.dz || 0, step.need) + '/' + step.need; };
      paint();
      // 🗺 the map stays one tap away for the WHOLE hunt: a glowing button
      // on the beach's own action bar reopens it (tapping Sabreface works
      // too). A pixel map icon, never an OS emoji — the heart lesson.
      const MAP_AGAIN = { kind: 'talk', who: 'split',
        lines: [['split', 'Lost already? Look —'], ['map', ''], ['split', 'The quiet stretch past the sunbeds. Inside the circle. DIG.']] };
      window.bwqTalk = { who: 'split', open: () => openDialog(MAP_AGAIN, true) };
      // the quest is the only voice inside its circle — the beach's own
      // loot rolls (doubloons, coins, map pieces) pause in there
      window.bwqDigzone = DIG_CIRCLE;
      unhook.push(() => { window.bwqDigzone = null; });
      const bar = document.querySelector('.bh-actions');
      if (bar) {
        const mb = document.createElement('button');
        mb.type = 'button';
        mb.className = 'bh-act bh-act--icon bwq-mapbtn';
        mb.setAttribute('aria-label', 'see the treasure map');
        mb.innerHTML = '<svg viewBox="0 0 16 13" shape-rendering="crispEdges" aria-hidden="true">'
          + '<path fill="#5a3c14" d="M0 0h16v13H0z"/>'
          + '<path fill="#e7cd91" d="M1 1h14v11H1z"/>'
          + '<path fill="#9fb9bd" d="M1 1h14v3H1z"/>'
          + '<path fill="rgba(90,60,20,0.3)" d="M8 1h1v11H8z"/>'
          + '<circle cx="5" cy="8" r="2.4" fill="none" stroke="#b03226" stroke-width="1.6"/>'
          + '</svg>';
        mb.addEventListener('click', (e) => { e.stopPropagation(); openDialog(MAP_AGAIN, true); });
        bar.insertBefore(mb, bar.firstChild);
        layer.push(mb);
      }
      const wrap = document.getElementById('bhDigs');
      if (wrap) {
        const obs = new MutationObserver((muts) => muts.forEach((m) => m.addedNodes.forEach((n) => {
          if (!(n.classList && n.classList.contains('bh-hole'))) return;
          const hx = parseFloat(n.style.left) / 100 * 2760;
          const hy = parseFloat(n.style.top) / 100 * 1100;
          if (Math.hypot(hx - DIG_CIRCLE.x, hy - DIG_CIRCLE.y) > DIG_CIRCLE.r) return;
          S.k.dz = (S.k.dz || 0) + 1;
          save();
          toast(step.steps[Math.min(step.steps.length, S.k.dz) - 1], 3200);
          paint();
          if (S.k.dz >= step.need) { obs.disconnect(); advance(); }
        })));
        obs.observe(wrap, { childList: true });
        unhook.push(() => obs.disconnect());
      }
    } else if (step.kind === 'fishline') {
      // 🎣 the bay's OWN rod does the work: window.bwqFish.reel() is called
      // by banana-beach's reel() on every real bite — we count them, and on
      // the last one return true so the quest's bundle replaces the fish.
      // In-between catches stay completely ordinary (one voice per reel).
      const chip = layer[0];
      const chipTxt = chip && chip.querySelector('span');
      const paint = () => { if (chipTxt) chipTxt.textContent = step.hint + ' · ' + Math.min(S.k.fl || 0, step.need) + '/' + step.need; };
      paint();
      window.bwqFish = {
        reel: (bob) => {
          S.k.fl = (S.k.fl || 0) + 1;
          save();
          paint();
          if (S.k.fl >= step.need) {
            // 🎞 the payoff happens AT THE FLOAT: the flipbook rises out of
            // the water, glowing, right where the player is looking —
            // appended straight to the world (not the layer) so the step
            // advancing underneath can't cut the moment short
            if (bob) {
              const rev = document.createElement('div');
              rev.className = 'bwq-bundle';
              rev.style.left = (bob.x / 2760 * 100) + '%';
              rev.style.top = (bob.y / 1100 * 100) + '%';
              rev.appendChild(flipbookCanvas());
              w.appendChild(rev);
              setTimeout(() => rev.remove(), 7100);   // ~7s on stage (Trym: 3.4s vanished too fast)
            }
            toast(step.found, 4600);
            advance();
            return true;   // the quest takes this catch
          }
          return false;    // an ordinary fish — the bay narrates it
        },
      };
      unhook.push(() => { window.bwqFish = null; });
    } else if (step.kind === 'watch') {
      // the rave floor beat: time on the floor + reactions, both client-true.
      // Reactions are clicks on the existing emote buttons — listened for by
      // DELEGATION, so the rave's own code is untouched.
      let secs = S.k.secs || 0, taps = S.k.taps || 0;
      const need = step.watch;
      const chip = layer[0];   // reuse the hint chip as the progress line
      const chipTxt = chip && chip.querySelector('span');
      const paint = () => { if (chipTxt) chipTxt.textContent = 'dance ' + Math.min(secs, need.secs) + '/' + need.secs + 's · ❤ ' + Math.min(taps, need.taps) + '/' + need.taps; };
      paint();
      const onTap = (e) => { if (e.target.closest('[data-emote]')) { taps++; S.k.taps = taps; save(); paint(); } };
      document.addEventListener('click', onTap);
      watchTimer = setInterval(() => {
        secs++; S.k.secs = secs; save(); paint();
        if (secs >= need.secs && taps >= need.taps) {
          clearInterval(watchTimer);
          document.removeEventListener('click', onTap);
          toast('🪩 the floor is warm');
          advance();
        }
      }, 1000);
    } else if (step.kind === 'goal') {
      // the tent. Residents already live here — their beat is the photo line.
      if (S.res) { toast(step.resSkip, 3600); advance(); return; }
      if (coinBal() < 50) {
        payReward({ coins: 50 - coinBal(),
          note: '🪙 Nib’s relocation grant — “it’s a fund. i invented it today.”' });
      }
      watchTimer = setInterval(() => {
        try {
          if (((JSON.parse(localStorage.getItem('hs-v1') || '{}').stage) || 0) >= 1) {
            clearInterval(watchTimer);
            advance();
          }
        } catch (e) {}
      }, 1500);
    }
  }

  // engines rebuild bits of their world — re-assert the layer if it got wiped,
  // and re-place anchored things (an NPC that lays out late moves its marker)
  setInterval(() => {
    if (S.done || dlg) return;
    const w = world();
    if (w && layer.length && !layer[0].isConnected) { render(); return; }
    layer.forEach((el) => { if (el.__at && el.__at.sel) place(el, el.__at); });
  }, 2500);

  fontWarm();   // start the splash font download now, in idle time
  render();
  track('quest_boot', { area, step: STEPS[S.s] && STEPS[S.s].id });
}
