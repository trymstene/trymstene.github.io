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
import { drawComposite, assetsReady } from './banana-engine.js';

// 🍌 NIB IS A REAL BANANA (Trym's polish verdict: "theres no banana NPC
// greeting me" — a floating ! is not a character). Engine-rendered like Old
// Peel: one locked standing frame, plain suit; the clipboard is CSS chrome.
const NIB_DRAW = {
  // potter = the round clerk spectacles (Peel's, but Peel has the cane and the
  // bench — without SOMETHING Nib is identical to a default player banana)
  hat: 'none', glasses: 'potter', extras: {},
  top: '', bottom: '', bg: 'transparent', captions: false, effect: 'none',
};

const KEY = 'bwq-c1';
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
  rave: { sel: '#rvFloor', view: '#rvFloor' },
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
  split: { n: 'captain split', c: '#ffb36b', f: 2, d: { hat: 'tricorn', glasses: 'eyepatch', extras: {}, ...NPC } },
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
  { id: 'c1_nib_hello', area: 'homestead', kind: 'talk', who: 'nib', at: { x: 63, y: 76 },
    find: 'someone is waiting by your gate — go say hello!',
    lines: [
      ['nib', 'Welcome, welcome! Plot 11 is officially yours. Sign here, please.'],
      ['you', 'Wait — who are you? And why do I get a whole plot?'],
      ['nib', 'I’m Nib! I keep Banana World’s registry — every plot, every name, all in this book.'],
      ['nib', 'And honestly? I have no idea why you got it. There’s no application. No paperwork at all.'],
      ['nib', 'There’s only this old letter. It’s been waiting for years.'],
      ['paper', '“the eleventh plot, to whoever comes asking. it has waited long enough.”'],
      ['you', 'That’s… mysterious.'],
      ['nib', 'It’s worse than mysterious. It’s UNFILED.'],
      ['nib', 'My registry only goes back to 1999. But Old Peel in the Park? He’s older than any book.'],
      ['nib', 'Go ask him about Plot 11. Tell him it’s official business — he absolutely hates that.'],
    ],
    linesRes: [
      ['nib', 'Hello! Routine registry audit! Nothing to worry ab— hold on. You’re not in the book.'],
      ['you', 'I’ve lived here for ages?'],
      ['nib', 'Exactly! And Plot 11 has NO entry. None. I feel unwell.'],
      ['nib', 'And look — this letter has been sitting in the dead-letter drawer since before you even arrived.'],
      ['paper', '“the eleventh plot, to whoever comes asking. it has waited long enough.”'],
      ['nib', 'My registry only goes back to 1999. But Old Peel in the Park is older than any book.'],
      ['nib', 'Go ask him about Plot 11. Tell him it’s official business — he absolutely hates that.'],
    ],
    hint: 'find Old Peel in the Park' },

  { id: 'c1_peel_hi', area: 'park', kind: 'talk', who: 'peel', at: { sel: '.pk-old', x: 50, y: 40 },
    lines: [
      ['peel', 'Official business? Bah. Paperwork is what killed my marigolds.'],
      ['peel', 'So YOU’RE the one living on Plot 11 now. Hm. HM.'],
      ['peel', 'I’ll tell you what I remember — after you help me a little. The plants are thirsty, and my knees are done for the day.'],
    ],
    hint: 'the plants are thirsty — tap the glowing beds to water them, and pull the weeds' },

  { id: 'c1_peel_chores', area: 'park', kind: 'objects',
    hint: 'tap the glowing beds to water them 💧 and the weeds to pull them',
    objects: [
      { id: 'bed1', sel: '.pk-old', dx: 9, dy: 5, taps: 1, kind: 'bed', done: '💧 watered — it perks right up' },
      { id: 'bed2', sel: '.pk-old', dx: 14, dy: 9, taps: 1, kind: 'bed', done: '💧 watered' },
      { id: 'bed3', sel: '.pk-old', dx: 7, dy: 11, taps: 1, kind: 'bed', done: '💧 watered' },
      { id: 'weed1', sel: '.pk-old', dx: 18, dy: 4, taps: 1, kind: 'weed', done: '🌿 pulled!' },
      { id: 'weed2', sel: '.pk-old', dx: 12, dy: 14, taps: 1, kind: 'weed', done: '🌿 pulled!' },
    ] },

  { id: 'c1_peel_memory', area: 'park', kind: 'talk', who: 'peel', at: { sel: '.pk-old', x: 50, y: 40 },
    lines: [
      ['peel', 'Good work. Now listen close.'],
      ['peel', 'There WAS somebody on Plot 11. Long ago.'],
      ['peel', 'And here’s the strange part: I remember every banana that ever set foot in this park. But not them. No face. No name. Nothing.'],
      ['peel', 'Only two things stuck with me.'],
      ['peel', 'Every evening, they sat outside drawing. The same little drawings, over and over. Like they were practising something.'],
      ['peel', 'And every morning they walked down to the Bay. Every single morning. And always came back empty-handed.'],
      ['peel', 'So what were they DOING down there? Go to Banana Bay and search along the shore.'],
    ],
    reward: { coins: 15, note: '🪣 Peel gives you his old watering can' },
    hint: 'go to Banana Bay — search along the shore' },

  { id: 'c1_dig', area: 'beach', kind: 'objects',
    hint: 'that patch of sand looks freshly dug — tap it to dig',
    objects: [
      { id: 'dig', sel: '#bhShelly', dx: -5, dy: 7, x: 46, y: 58, taps: 3, kind: 'dig',
        steps: ['…a rusty fork. huh.', '…an old boot. the sea loves boots.',
          '📦 A sealed TIN — heavy, old… someone buried this on purpose'] },
    ] },

  { id: 'c1_split', area: 'beach', kind: 'talk', who: 'split', at: { sel: '#bhCap', x: 30, y: 46 },
    find: 'Captain Split wants a word about that tin',
    lines: [
      ['split', 'STOP RIGHT THERE. Everything on this beach belongs to me. Maritime law. I wrote it myself.'],
      ['you', 'It was buried in the sand. Above the tide line.'],
      ['split', '…Then it’s yours by burial law. Which also exists. You’re welcome.'],
      ['split', 'A sealed tin, eh? Old thing like that… the old gardener in the Park has been around forever. He’d know it.'],
      ['split', 'Take it to him. Split has spoken.'],
    ],
    hint: 'bring the tin back to Old Peel in the Park' },

  { id: 'c1_peel_fuss', area: 'park', kind: 'talk', who: 'peel', at: { sel: '.pk-old', x: 50, y: 40 },
    lines: [
      ['peel', 'A tin? Let me see— no. NO. Not with litter on my lawn.'],
      ['peel', 'Pick up that rubbish first. I can’t think over mess. Nobody can.'],
    ],
    hint: 'pick up the 2 pieces of litter — tap them' },

  { id: 'c1_litter', area: 'park', kind: 'objects',
    hint: 'pick up the 2 pieces of litter — tap them',
    objects: [
      { id: 'lit1', sel: '.pk-old', dx: 16, dy: 8, taps: 1, kind: 'trash', done: '🗑 picked up' },
      { id: 'lit2', sel: '.pk-old', dx: 6, dy: 8, taps: 1, kind: 'trash', done: '🗑 picked up' },
    ] },

  { id: 'c1_peel_tin', area: 'park', kind: 'talk', who: 'peel', at: { sel: '.pk-old', x: 50, y: 40 },
    lines: [
      ['peel', '(he opens the tin slowly)'],
      ['peel', '…A photograph. That’s Plot 11 alright. But with a little house on it.'],
      ['peel', 'There has NEVER been a house on Plot 11. Never. …And yet here’s a photo of one.'],
      ['peel', 'And a flower, pressed flat between the papers.'],
      ['peel', 'I know this flower. It grows in exactly ONE place: by the pier, down at the Bay.'],
      ['peel', 'Nobody ever planted flowers there. …Except somebody clearly did.'],
    ],
    reward: { coins: 10, note: '🌸 the pressed flower — keep it safe' },
    hint: 'go to the pier at Banana Bay — find where the flowers grow' },

  { id: 'c1_fish', area: 'beach', kind: 'objects',
    hint: 'cast a line at the glowing spot by the flowers — tap to fish',
    objects: [
      { id: 'fish', sel: '#bhGil', dx: 4, dy: 6, x: 74, y: 47, taps: 2, kind: 'fish',
        steps: ['🎣 …an old boot. Another one.',
          '🎞 A wrapped BUNDLE — inside: eight small drawings. A flipbook!'] },
    ] },

  { id: 'c1_shelly', area: 'beach', kind: 'talk', who: 'shelly', at: { sel: '#bhShelly', x: 60, y: 40 },
    find: 'show the bundle to Shelly',
    lines: [
      ['shelly', 'OH! Oh oh oh. Look at the barnacle rings on that wrapping. Do you know what this MEANS?'],
      ['you', '…That it’s old?'],
      ['shelly', 'Old?? This has been underwater longer than I’ve kept charts. And I chart EVERYTHING.'],
      ['shelly', 'And inside — paper! Eight little pages! Go on, flip through them!'],
      ['fb', ''],
      ['you', '…It’s a banana. Dancing.'],
      ['shelly', 'Dancing is not my department. The loud room handles dancing. Show it to Barty at the Rave!'],
    ],
    reward: { coins: 15 },
    hint: 'show the flipbook to Barty at the Rave' },

  { id: 'c1_barty_look', area: 'rave', kind: 'talk', who: 'barty', at: { x: 28, y: 84 },
    find: 'show the flipbook to Barty at the bar',
    lines: [
      ['barty', 'Howdy howdy! What can I get— oh! A flipbook! Cute!'],
      ['fb', ''],
      ['barty', 'Ha! That’s just how bananas dance, friend!'],
      ['you', 'Barty… who taught YOU the dance?'],
      ['barty', 'Taught? Nobody teaches it! You’re born knowing it! Everybody just… knows it!'],
      ['barty', '…Huh. That IS weird, ain’t it.'],
      ['barty', 'Give me a minute to think. Keep my floor warm while I do — dance a little, send some hearts.'],
    ],
    hint: 'keep the floor warm — dance for 30s and send 3 ❤' },

  { id: 'c1_floor', area: 'rave', kind: 'watch', hint: 'dance 30s · send 3 reactions',
    watch: { secs: 30, taps: 3 } },

  { id: 'c1_barty_truth', area: 'rave', kind: 'talk', who: 'barty', at: { x: 28, y: 84 },
    lines: [
      ['barty', 'Okay. So. Every banana in the world does the SAME dance. Since before this club existed.'],
      ['barty', 'And your little book of drawings is OLDER than my floor.'],
      ['barty', 'Whoever drew those pages taught the whole world to dance… and never told anyone their name.'],
      ['barty', 'Go home, friend. Whoever they were — they lived on YOUR plot. If anything’s left of them, it’s there.'],
    ],
    reward: { coins: 20, note: '🎞 the flipbook — a keepsake' },
    hint: 'head home to the Homestead' },

  { id: 'c1_move_in', area: 'homestead', kind: 'goal',
    hint: 'make it official — order a tent on your 📱 phone and move in',
    resSkip: '🖼 the old photograph goes up on your wall. home.' },

  { id: 'c1_nib_registry', area: 'homestead', kind: 'talk', who: 'nib', at: { x: 63, y: 76 },
    find: 'Nib is back at your gate',
    lines: [
      ['nib', 'A dwelling! Wonderful! I can finally register Plot 11 properly. Let me just open the—'],
      ['nib', '…There’s already an entry on this page.'],
      ['nib', 'Somebody wrote a name here, long ago. And then scratched it out. It’s dated 1999.'],
      ['you', 'Who scratches a name OUT of a registry?'],
      ['nib', 'NOBODY. It isn’t possible. I laminated the rulebook myself.'],
      ['nib', '…I need to sit down. I have never needed to sit down in my life.'],
      ['paper', 'CHAPTER ONE — complete 🍌 (chapter two is coming)'],
    ],
    reward: { note: '🖼 the photograph — the house that isn’t there' },
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
/* 🎯 quest objects — drawn things, not dots (Trym: "green dots" failed) */
.bwq-obj {
  position:absolute; z-index:2350; width:40px; height:36px; margin:-18px 0 0 -20px;
  cursor:pointer; display:grid; place-items:center;
}
.bwq-obj::after {
  content:''; position:absolute; inset:-3px; border:2px dashed #ffe135;
  border-radius:8px; animation:bwqPulse 1.3s ease-in-out infinite; pointer-events:none;
}
.bwq-obj i { display:block; }
.bwq-obj--bed i {
  width:30px; height:18px; border:2px solid #241c00; border-radius:5px;
  background:#7a5230 repeating-linear-gradient(90deg, transparent 0 5px, rgba(30,16,4,0.35) 5px 7px);
}
.bwq-obj--weed i {
  width:22px; height:20px; background:#3e6b2a; border:2px solid #142008;
  clip-path:polygon(50% 0, 68% 38%, 100% 22%, 74% 62%, 92% 100%, 50% 78%, 8% 100%, 26% 62%, 0 22%, 32% 38%);
}
.bwq-obj--trash i {
  width:20px; height:18px; background:#cfc4a8; border:2px solid #241c00;
  clip-path:polygon(12% 0, 88% 8%, 100% 55%, 78% 100%, 18% 92%, 0 45%);
}
.bwq-obj--dig i {
  width:30px; height:16px; border:2px solid #7a5c33; border-radius:50%;
  background:#d9b67c; box-shadow:inset 3px 3px 0 #b78f52, inset -4px -2px 0 #eecf96;
}
.bwq-obj--fish i {
  width:28px; height:16px; border:2px solid #1d4b60; border-radius:50%;
  background:#4aa5c9; box-shadow:inset 0 3px 0 rgba(255,255,255,0.45);
}
@keyframes bwqPulse { 0%,100% { transform:scale(1); opacity:0.9; } 50% { transform:scale(1.14); opacity:0.45; } }
/* 🕯 the journal — a game card, not an info-box (Trym's verdict) */
.bwq-hint {
  position:absolute; left:10px; top:48px; z-index:900; max-width:64%;
  background:linear-gradient(#ffe14d,#f2c012); color:#241c00;
  border:3px solid #000; box-shadow:3px 3px 0 #000; border-radius:2px;
  font-size:0.78rem; font-weight:800; padding:7px 11px; line-height:1.35;
  pointer-events:none; animation:bwqCardIn 0.32s cubic-bezier(0.34,1.56,0.64,1);
}
@keyframes bwqCardIn { 0% { transform:scale(0.6) rotate(-3deg); opacity:0; } 100% { transform:none; opacity:1; } }
/* 💬 the dialogue — the park's NPC-card grammar (pk-card--npc: tilted
   waist-up portrait peeking over the corner, name beside it, console box
   that TYPES) — docked INSIDE the game frame, never the browser bottom */
.bwq-dlg {
  position:absolute; left:50%; bottom:12px; transform:translateX(-50%); z-index:4600;
  width:min(420px, calc(100% - 20px)); box-sizing:border-box;
  background:#101a10; color:#fffdf5; border:4px solid #000; box-shadow:6px 6px 0 #000;
  padding:0.8rem 0.9rem 0.9rem; cursor:pointer;
  animation:bwqCardIn 0.26s cubic-bezier(0.34,1.56,0.64,1);
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
.bwq-toast {
  position:fixed; left:50%; top:64px; transform:translateX(-50%); z-index:5200;
  background:#14240f; color:#ffe135; border:3px solid #000; box-shadow:3px 3px 0 #000;
  font-size:0.8rem; font-weight:800; padding:0.5rem 0.85rem; max-width:88vw;
  text-align:center; pointer-events:none; opacity:0; transition:opacity 0.25s ease;
}
.bwq-toast.on { opacity:1; }
@media (prefers-reduced-motion:reduce) { .bwq-mark, .bwq-mark::before, .bwq-obj::after, .bwq-hint, .bwq-dlg, .bwq-paper, .bwq-box.is-typing p::after, .bwq-more { animation:none; } }
`;
  document.head.appendChild(st);
}

// ---- tiny ui helpers ------------------------------------------------------
let toastEl = null, toastT = 0;
function toast(msg, ms) {
  if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'bwq-toast'; document.body.appendChild(toastEl); }
  toastEl.textContent = msg;
  toastEl.classList.add('on');
  clearTimeout(toastT);
  toastT = setTimeout(() => toastEl.classList.remove('on'), ms || 2600);
}

function payReward(r) {
  if (!r) return;
  if (r.coins) {
    passStat('coins_earned', r.coins);
    toast('🪙 +' + r.coins + ' bananacoins' + (r.note ? ' · ' + r.note : ''), 3400);
  } else if (r.note) {
    toast(r.note, 3400);
  }
}

// the flipbook: the REAL eight frames off the engine's own sheet — the prop is
// literally the site's 1999 GIF, which is the whole point of the story
function flipbookCanvas() {
  const cv = document.createElement('canvas');
  cv.width = 94; cv.height = 100;
  const ctx = cv.getContext('2d');
  const img = new Image();
  img.src = '/assets/banana-dance.png?v=7';
  let f = 0;
  const t = setInterval(() => {
    if (!cv.isConnected) { clearInterval(t); return; }
    if (!img.complete || !img.naturalWidth) return;
    ctx.clearRect(0, 0, 94, 100);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, f * 469, 0, 469, 498, 3, 3, 88, 94);
    f = (f + 1) % 8;
  }, 130);
  return cv;
}

// ---- the engine -----------------------------------------------------------
export function bootQuest() {
  const path = location.pathname;
  const area = path.includes('homestead') ? 'homestead'
    : path.includes('park') ? 'park'
      : path.includes('beach') ? 'beach'
        : path.includes('rave') ? 'rave' : null;
  if (!area || S.done) return;

  // test conveniences
  if (/[?&]questreset/.test(location.search)) { S = { s: 0, k: {}, res: 0, done: 0 }; save(); }
  const jump = location.search.match(/[?&]queststep=(\d+)/);
  if (jump) { S.s = Math.min(STEPS.length - 1, +jump[1]); S.k = {}; save(); }

  // resident branch: decided ONCE, at the moment the quest first runs
  if (S.s === 0 && !S.resSet) {
    try { S.res = ((JSON.parse(localStorage.getItem('hs-v1') || '{}').stage) || 0) >= 1 ? 1 : 0; } catch (e) {}
    S.resSet = 1; save();
  }

  ensureCss();
  const layer = [];   // live quest DOM in this area
  let dlg = null, dlgTimer = null, watchTimer = null;

  const world = () => document.querySelector(AREAS[area].sel);

  function clearLayer() {
    layer.splice(0).forEach((el) => el.remove());
    if (dlg) { dlg.remove(); dlg = null; }
    clearInterval(watchTimer);
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

  function openDialog(step) {
    const lines = (S.res && step.linesRes) ? step.linesRes : step.lines;
    let i = 0, typeT = null, txt = '', at = 0, popWho = '';
    if (dlg) dlg.remove();
    dlg = document.createElement('div');
    dlg.className = 'bwq-dlg';
    dlg.innerHTML = '<div class="bwq-pop"><canvas width="390" height="390"></canvas></div>'
      + '<h2></h2>'
      + '<div class="bwq-box"><p></p><span class="bwq-more" aria-hidden="true">▼</span></div>'
      + '<div class="bwq-sp" hidden></div>';
    // ⚠️ docked INSIDE the game frame — fixed-to-viewport put it below the
    // world on desktop, out of frame entirely (Trym's screenshots)
    (document.querySelector(AREAS[area].view) || document.body).appendChild(dlg);
    const pop = dlg.querySelector('.bwq-pop'), popCv = pop.querySelector('canvas'),
      h2 = dlg.querySelector('h2'), box = dlg.querySelector('.bwq-box'),
      p = box.querySelector('p'), sp = dlg.querySelector('.bwq-sp');
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
    const show = () => {
      const [who, text] = lines[i];
      const w = WHO[who];
      if (!w) {   // paper / fb — the prop takes the stage alone
        pop.hidden = true; h2.hidden = true; box.hidden = true; sp.hidden = false;
        if (who === 'paper') {
          sp.innerHTML = '<div class="bwq-paper"></div><small>tap to continue</small>';
          sp.querySelector('.bwq-paper').textContent = text;
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
    dlg.addEventListener('click', () => {
      if (typeT) { typeDone(); return; }   // mid-type tap = the whole line now
      i++;
      if (i < lines.length) { show(); return; }
      dlg.remove(); dlg = null;
      payReward(step.reward);
      advance();
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
      ? (step.find || ('talk to ' + (WHO[step.who] || {}).n)) : step.hint;
    if (label) {
      const h = document.createElement('div');
      h.className = 'bwq-hint';
      h.textContent = '🕯 ' + label;
      (document.querySelector(AREAS[area].view) || w).appendChild(h);
      layer.push(h);
    }
    if (step.area !== area) return;      // objective lives elsewhere — hint covers it

    if (step.kind === 'talk') {
      // 🍌 Nib stands there in person — the ! floats above HIM, and tapping
      // either talks. Existing NPCs (Peel, Barty…) already have bodies.
      if (step.who === 'nib') {
        const n = document.createElement('div');
        n.className = 'bwq-npc';
        const cv = document.createElement('canvas');
        cv.width = 150; cv.height = 160;
        n.appendChild(cv);
        place(n, step.at);
        // the area's own depth formula — the player passes in FRONT below him
        n.style.zIndex = String(100 + Math.round((AREAS[area].wh || 1100) * step.at.y / 100));
        n.addEventListener('pointerdown', (e) => e.stopPropagation());
        n.addEventListener('click', (e) => { e.stopPropagation(); openDialog(step); });
        w.appendChild(n); layer.push(n);
        assetsReady().then(() => { try { drawComposite(cv.getContext('2d'), 150, 0, NIB_DRAW); } catch (e) {} });
      }
      const m = document.createElement('div');
      m.className = 'bwq-mark';
      // a drawn pixel !: THIN gold bar tapering to the dot, white shine
      m.innerHTML = '<svg viewBox="0 0 14 24" aria-hidden="true">'
        + '<path fill="#111" d="M4 0h6v10h-1v4H5v-4H4z"/>'
        + '<path fill="#111" d="M4 17h6v5H4z"/>'
        + '<path fill="#ffd23f" d="M5 1h4v8h-1v4H6v-4H5z"/>'
        + '<path fill="#ffd23f" d="M5 18h4v3H5z"/>'
        + '<path fill="#fff3a8" d="M5 1h2v8H5zM5 18h1v3H5z"/>'
        + '</svg>';
      // above the NPC's head — a WORLD-% offset, since Nib is %-sized too
      place(m, step.who === 'nib' ? { ...step.at, y: step.at.y - 11.5 } : step.at);
      m.addEventListener('click', (e) => { e.stopPropagation(); openDialog(step); });
      m.addEventListener('pointerdown', (e) => e.stopPropagation());
      w.appendChild(m); layer.push(m);
    } else if (step.kind === 'objects') {
      step.objects.forEach((o) => {
        if ((S.k[o.id] || 0) >= o.taps) return;
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
          if (S.k[o.id] >= o.taps) el.remove();
          if (step.objects.every((q) => (S.k[q.id] || 0) >= q.taps)) advance();
        });
        w.appendChild(el); layer.push(el);
      });
    } else if (step.kind === 'watch') {
      // the rave floor beat: time on the floor + reactions, both client-true.
      // Reactions are clicks on the existing emote buttons — listened for by
      // DELEGATION, so the rave's own code is untouched.
      let secs = S.k.secs || 0, taps = S.k.taps || 0;
      const need = step.watch;
      const chip = layer[0];   // reuse the hint chip as the progress line
      const paint = () => { if (chip) chip.textContent = '🕯 dance ' + Math.min(secs, need.secs) + '/' + need.secs + 's · ❤ ' + Math.min(taps, need.taps) + '/' + need.taps; };
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
        passStat('coins_earned', 50 - coinBal());
        toast('🪙 Nib’s relocation grant — “it’s a fund. i invented it today.”', 3800);
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

  render();
  track('quest_boot', { area, step: STEPS[S.s] && STEPS[S.s].id });
}
