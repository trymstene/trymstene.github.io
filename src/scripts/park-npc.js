// 🍌 OLD PEEL — the bench elder by the fountain, the park's ambient
// commentator and first full RPG NPC (the pattern the Gardener reuses).
// Split from banana-park.js (P5); wired through the shared ctx.
import { drawComposite, assetsReady } from '../lib/banana-engine.js';
import { OLDBENCH } from './park-geo.js';
import { track, esc } from './park-util.js';

// A NORMAL engine banana (drawComposite) LOCKED to the first standing frame —
// no dancing, too old — round glasses + walking cane (the cap/beard drafts
// were dropped; his look is glasses and cane).
const OLD_NAME = 'old peel';
const OLD_DRAW = {
  hat: 'none', glasses: 'potter', extras: { oldcane: true },
  top: '', bottom: '', bg: 'transparent', captions: false, effect: 'none',
};
// his lines, a band per phase — grief → worry → cautious hope → warmth →
// joy. Trym's lines verbatim where they fit; hints, never orders.
// 🌦 …and what he says about the WEATHER, which overrides the health band
// while it is falling: the park's mood is the sky's for as long as it lasts.
// He is the only one who never leaves the bench.
const OLD_WX = {
  drizzle: ['just a bit of drizzle. does the beds good.',
    'nothing wrong with a soft day like this.',
    'smell that? that’s the soil waking up.'],
  heavy: ['proper rain, this. beds’ll drink well tonight.',
    'the hens have all found a tree. sensible birds.',
    'don’t mind me. i’ve sat through worse.'],
  storm: ['now THIS is weather.',
    'hold on to something, lad.',
    'we’ll be picking this up for days, mark me.',
    'the birds knew. they always know first.'],
};
const OLD_LINES = [
  ['its so sad to see the park like this…',
    'someone should clean up this mess…',
    'i remember when this lawn was all green. long time ago now.',
    'even the fountain gave up. dry as my elbows.'],
  ['she’s hurting, this old park. weeds everywhere.',
    'the hens won’t lay in a place like this, you know.',
    'a little weeding would go a long way…'],
  ['wish someone could tend to the plants',
    'the soil’s still good, you know',
    'green in patches. she’s trying, i can tell.',
    'a bit of water works wonders. always has.'],
  ['the squirrels came back. good sign, that.',
    'she’s nearly herself again. keep at it.',
    'sat here all morning. didn’t want to leave.'],
  ['haven’t seen her this beautiful in years',
    'butterflies! my missus loved the butterflies.',
    'this is how i remember it. exactly this.',
    'some days this bench is the best seat in the world.'],
];
// 💬 his DIALOGUE — a topic answers with `byPhase` (index = health band 0-4),
// one static `line`, or a `seq` of lore beats stepped per ask; `close` ends
// the talk after the answer. Lowercase, warm, lean.
const OLD_GREET = 'ah, company. sit a while — what’s on your mind?';
const OLD_TOPICS = [
  { id: 'park', q: 'what happened to the park?', byPhase: [
    'she used to be the pride of banana world. then the footsteps stopped, and the weeds moved in.',
    'she’s coming back from a rough patch. parks don’t heal alone, you know.',
    'she’s half herself again. green in patches, like spring remembering the way.',
    'look at her. nearly the park i first sat down in, all those years ago.',
    'this is her. the real her. i knew she had it in her.',
  ] },
  { id: 'help', q: 'what can i do to help?', byPhase: [
    'pull the weeds, pick up the rubbish. small hands make green grass.',
    'keep weeding — and water anything anyone’s planted. she notices.',
    'plant something. and water the thirsty ones, even a stranger’s flowers.',
    'keep her watered and she’ll keep blooming. we’re nearly there.',
    'you’ve done it, friend. sit down. enjoy her. that helps too.',
  ] },
  { id: 'lore', q: 'tell me about yourself', seq: [
    'kept this park for forty years, i did. mowed her, planted her, knew every bench by its wobble.',
    'my missus and i had our first picnic right here. she loved the butterflies — said they were flowers that got restless.',
    'now i just sit. somebody else’s turn to keep her. maybe yours, eh?',
  ] },
  { id: 'shop', q: 'what’s that mushroom house?', line: 'inka’s little print shop, past the stand. everything else in this park costs coins — her wall is the one real thing. good sort, inka.' },
  { id: 'bye', q: 'goodbye', byPhase: [
    'mind the weeds on your way, friend.',
    'come back soon. she needs the footsteps.',
    'off you go. bring a watering can next time, eh?',
    'lovely day for it. off you go.',
    'enjoy her, friend. that’s what she’s for.',
  ], close: true },
];

// 🌼 OLD PEEL'S FLOWERBED — his pride, east of the bench: three REAL bed
// ditches (g-bed grammar) holding a daisy, a sunflower and a midnight tulip.
// Pure client decoration, identical for every visitor, no server state —
// which is exactly why nobody can touch it: always watered, never wilting.
// The questline is the ONE exception (it wilts them quest-holder-only and
// has you water them back — world-quest.js drives that via CSS classes).
const PEEL_BED = [
  [1652, 762, 'g-daisy.png', 26, 31],
  [1712, 762, 'g-sunflower.png', 31, 47],
  [1772, 762, 'g-tulip.png', 31, 26],
];
const PEEL_BED_LINES = [
  'my flowerbed. a daisy, a sunflower, and one midnight tulip.',
  'i water them before the sun comes up. never missed a morning.',
  'look, don’t touch, eh? forty years of practice in that little bed.',
];

export function initOldPeel(ctx) {
  const { W, H, world, pct, depth, onScreen, pos, tgt } = ctx;

  // Ambient commentator (the animal-bubble grammar, words instead of moods):
  // one line pops on first sight each session, a tap peeks the next line, a
  // phase change refreshes him mid-sit. No walking, no scene, no event.
  // A player-sized engine banana (frame 0, never redrawn) sat ON TOP of the
  // plate's bench: full body visible, feet landing just past the seat's
  // front edge — no clipping (Trym: he overflows the bench, never cut).
  const OLD_X = OLDBENCH[0], OLD_Y = OLDBENCH[1];
  const OLD_CW = 0.036 * W;              // the player size class (.pk-me)
  const OLD_BOT = OLD_Y + 13;            // canvas bottom → feet at the bench front
  const oldEl = document.createElement('div');
  oldEl.className = 'pk-old';
  const oldCv = document.createElement('canvas');
  oldCv.width = 150; oldCv.height = 150;
  oldEl.appendChild(oldCv);
  const oldBub = document.createElement('span');
  oldBub.className = 'pk-mood pk-oldsay';
  oldEl.appendChild(oldBub);
  oldEl.style.left = pct(OLD_X, W);
  oldEl.style.top = pct(OLD_BOT, H);
  oldEl.style.width = pct(OLD_CW, W);
  depth(oldEl, OLD_Y);
  world.appendChild(oldEl);
  // portrait for his dialogue card: the SAME composite, drawn 2× for
  // crispness and zoomed so the waist-up crop fills the frame (beach v2)
  const oldPortraitCv = document.getElementById('pkOldPortrait');
  assetsReady().then(() => {           // one still frame + the redraw belt
    const drawOld = () => {
      drawComposite(oldCv.getContext('2d'), 150, 0, OLD_DRAW);
      const pc = oldPortraitCv.getContext('2d');
      pc.clearRect(0, 0, 390, 390);
      pc.save();
      pc.scale(1.5, 1.5); pc.translate(-390 * 0.167, -390 * 0.22);
      drawComposite(pc, 390, 0, OLD_DRAW);
      pc.restore();
    };
    drawOld();
    setTimeout(drawOld, 700);
  });
  // 🌼 his flowerbed — bed ground at plate-layer z (a bed is GROUND, see
  // park-garden's renderBeds note), flowers above it, plate-identical art
  PEEL_BED.forEach(([bx, by, img, bw, bh], i) => {
    const soil = document.createElement('div');
    soil.className = 'pk-bedsoil';
    soil.style.left = pct(bx, W);
    soil.style.top = pct(by, H);
    soil.style.width = pct(58, W);
    soil.style.height = pct(88, H);
    soil.style.zIndex = '2';
    world.appendChild(soil);
    const fl = document.createElement('div');
    fl.className = 'pk-plant pk-peelplant';
    fl.dataset.peel = String(i);
    fl.style.backgroundImage = "url('/assets/park/" + img + "')";
    fl.style.width = pct(bw, W);
    fl.style.height = pct(bh, H);
    fl.style.left = pct(bx, W);
    fl.style.top = pct(by - 22, H);
    fl.style.zIndex = '3';
    world.appendChild(fl);
  });
  let peelBedIdx = 0;
  function tapPeelBed(wx, wy) {
    if (!(wx > 1616 && wx < 1808 && wy > 670 && wy < 790)) return false;
    if (window.bwqTend) return false;   // quest chores own the bed right now
    // outside the quest the bed only answers with Peel fussing — it's HIS
    oldBub.innerHTML = '<i>' + OLD_NAME + '</i>' + esc(PEEL_BED_LINES[peelBedIdx++ % PEEL_BED_LINES.length]);
    oldBub.classList.add('is-on');
    clearTimeout(oldTimer);
    oldTimer = setTimeout(() => oldBub.classList.remove('is-on'), 5600);
    return true;
  }

  let oldSeen = false, oldIdx = 0, oldBand = -1, oldTimer = null;
  function oldSay() {
    // 🕯 he holds his tongue while the questline has business with him
    if (window.bwqTalk && window.bwqTalk.who === 'peel') return;
    // the weather takes precedence over the health band while it falls
    const wx = ctx.weather && ctx.weather.now && ctx.weather.now();
    const band = Math.max(0, ctx.phase());
    if (band !== oldBand) { oldBand = band; oldIdx = 0; }
    const lines = (wx && OLD_WX[wx]) || OLD_LINES[band];
    oldBub.innerHTML = '<i>' + OLD_NAME + '</i>' + esc(lines[oldIdx++ % lines.length]);
    oldBub.classList.add('is-on');
    clearTimeout(oldTimer);
    oldTimer = setTimeout(() => oldBub.classList.remove('is-on'), 5600);
  }
  function oldTick() {
    if (oldSeen || ctx.phase() < 0) return;
    // 🕯 the first-sight line WAITS through a quest step instead of burning
    if (window.bwqTalk && window.bwqTalk.who === 'peel') return;
    if (onScreen(OLD_X, OLD_Y)) { oldSeen = true; oldSay(); }
  }
  function oldPhasePoke() {
    if (oldSeen && onScreen(OLD_X, OLD_Y)) oldSay();   // live phase → fresh words
  }
  // 💬 the talk — walk-then-open (beach NPC grammar). Console-RPG flow
  // (Trym): tap a question → the deck hides and the answer TYPES into the
  // box (~32ms/char, blinking ▌); a tap skips to the full text; ▼ steps
  // lore beats / returns to the questions; goodbye closes after its line.
  // Presentation only — OLD_TOPICS stays data-driven (the Gardener inherits).
  const oldPanel = document.getElementById('pkOldPanel');
  const oldLineEl = document.getElementById('pkOldLine');
  const oldQsEl = document.getElementById('pkOldQs');
  const oldBox = document.getElementById('pkOldBox');
  const oldBoxText = document.getElementById('pkOldBoxText');
  const OLD_TALK_AT = { x: OLD_X, y: OLD_Y + 46 };   // stand at the bench front
  const RM_TYPE = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let pendingOld = false;
  let oldCloseTimer = null, typeTimer = null, typeText = '', typeAt = 0;
  let oldSeq = null, oldSeqAt = 0, oldClosing = false, oldNpcTracked = false;
  function oldTypeDone() {
    clearInterval(typeTimer);
    typeTimer = null;
    oldBoxText.textContent = typeText;
    oldBox.classList.remove('is-typing');
    oldBox.classList.add('is-done');
    if (oldClosing) { clearTimeout(oldCloseTimer); oldCloseTimer = setTimeout(closeOld, 1700); }
  }
  function oldType(text) {
    clearInterval(typeTimer);
    typeText = text;
    typeAt = 0;
    oldBox.hidden = false;
    oldQsEl.hidden = true;
    oldLineEl.hidden = true;
    oldBox.classList.remove('is-done');
    if (RM_TYPE) { oldTypeDone(); return; }   // instant text, same flow
    oldBox.classList.add('is-typing');
    oldBoxText.textContent = '';
    typeTimer = setInterval(() => {
      typeAt += 1;
      oldBoxText.textContent = typeText.slice(0, typeAt);
      if (typeAt >= typeText.length) oldTypeDone();
    }, 32);
  }
  function oldBackToQs() {
    oldBox.hidden = true;
    oldBox.classList.remove('is-typing', 'is-done');
    oldSeq = null;
    oldQsEl.hidden = false;
    oldLineEl.hidden = false;
  }
  oldBox.addEventListener('click', () => {
    if (typeTimer) { oldTypeDone(); return; }        // mid-type tap = skip
    if (!oldBox.classList.contains('is-done')) return;
    if (oldClosing) { closeOld(); return; }          // goodbye: tap = leave now
    if (oldSeq && oldSeqAt < oldSeq.length - 1) {    // ▼ = the next lore beat
      oldSeqAt += 1;
      oldType(oldSeq[oldSeqAt]);
      return;
    }
    oldBackToQs();                                   // ▼ = the question deck
  });
  function oldAsk(t) {
    oldClosing = !!t.close;
    if (t.seq) { oldSeq = t.seq; oldSeqAt = 0; oldType(t.seq[0]); return; }
    oldSeq = null;
    oldType(t.byPhase ? t.byPhase[Math.max(0, Math.min(4, ctx.phase()))] : t.line);
  }
  function openOld() {
    clearTimeout(oldCloseTimer);
    if (!oldNpcTracked) { oldNpcTracked = true; track('park_npc', { who: 'oldpeel' }); }
    oldClosing = false;
    oldBackToQs();
    oldLineEl.textContent = OLD_GREET;
    if (!oldQsEl.childElementCount) {
      OLD_TOPICS.forEach((t) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = t.q;
        b.addEventListener('click', () => oldAsk(t));
        oldQsEl.appendChild(b);
      });
    }
    oldPanel.hidden = false;
  }
  function closeOld() {
    clearTimeout(oldCloseTimer);
    clearInterval(typeTimer);
    typeTimer = null;
    oldPanel.hidden = true;
  }
  document.getElementById('pkOldClose').addEventListener('click', closeOld);
  oldPanel.addEventListener('click', (e) => { if (e.target === oldPanel) closeOld(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !oldPanel.hidden) closeOld(); });
  function tapOld(wx, wy) {
    if (!(Math.abs(wx - OLD_X) < 45 && wy > OLD_Y - 90 && wy < OLD_Y + 12)) return false;
    // 🕯 quest first: while the questline has a talk waiting at Peel, HIS tap
    // opens it — the bench chat returns once the quest step is done
    const q = window.bwqTalk;
    if (q && q.who === 'peel') { q.open(); return true; }
    if (Math.hypot(pos.x - OLD_TALK_AT.x, pos.y - OLD_TALK_AT.y) < 130) { openOld(); return true; }
    pendingOld = true;                        // walk up first, then talk
    tgt.x = OLD_TALK_AT.x;
    tgt.y = OLD_TALK_AT.y;
    return true;
  }
  function oldWalkTick() {
    if (pendingOld && Math.hypot(pos.x - OLD_TALK_AT.x, pos.y - OLD_TALK_AT.y) < 130) {
      pendingOld = false;
      openOld();
    }
  }

  return {
    oldTick, oldWalkTick, oldPhasePoke, tapOld, tapPeelBed,
    clearPending: () => { pendingOld = false; },
  };
}
