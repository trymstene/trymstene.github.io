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

const KEY = 'bwq-c1';
const AREAS = {
  homestead: { sel: '#hsWorld' },
  park: { sel: '#pkWorld' },
  beach: { sel: '#bhWorld' },
  rave: { sel: '#rvFloor' },
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
const WHO = {
  nib: { n: 'Nib', c: '#8ecbff' },
  peel: { n: 'old peel', c: '#c8e6a0' },
  split: { n: 'captain split', c: '#ffb36b' },
  shelly: { n: 'shelly', c: '#ffa0c8' },
  barty: { n: 'barty', c: '#ffe135' },
  you: { n: 'you', c: '#fffdf5' },
};

// ---- chapter one ----------------------------------------------------------
// kind: talk (marker → dialogue) · objects (tap the spawned things) ·
//       goal (watch for a real-world condition, homestead tent)
// at: {sel} anchors to a live element, {x,y} = % of the world plate.
const STEPS = [
  { id: 'c1_nib_hello', area: 'homestead', kind: 'talk', who: 'nib', at: { x: 63, y: 78 },
    lines: [
      ['nib', 'Plot 11! All yours! Sign here. And here. Initial the hen clause.'],
      ['you', '…who are you?'],
      ['nib', 'Nib! Deputy Assistant Registrar, Office of the Mayor. i alphabetise Banana World.'],
      ['you', 'why did i get a plot?'],
      ['nib', 'excellent question! *flips pages* …hm. no application. no transfer. just… this.'],
      ['paper', '“the eleventh plot, to whoever comes asking. it has waited long enough.”'],
      ['nib', 'that is not a form. i can’t file feelings.'],
      ['nib', 'the registry starts in 1999. nothing before it. but Old Peel? Peel is older than the registry.'],
      ['nib', 'the Park. east of here. tell him it’s official business — he hates that.'],
    ],
    linesRes: [
      ['nib', 'hello! registry audit! routine! do not be alarm— *flips pages* …you’re not IN the book.'],
      ['you', 'i’ve lived here for ages?'],
      ['nib', 'you misunderstand. Plot 11 has NO ENTRY. i feel physically unwell.'],
      ['nib', 'and there’s this. dead-letter drawer. it was waiting here before YOU ever were.'],
      ['paper', '“the eleventh plot, to whoever comes asking. it has waited long enough.”'],
      ['nib', 'the registry starts in 1999. Old Peel is older than the registry. the Park. east.'],
      ['nib', 'tell him it’s official business. he hates that. it’s the only fun i’m allowed.'],
    ],
    hint: 'find Old Peel in the Park' },

  { id: 'c1_peel_hi', area: 'park', kind: 'talk', who: 'peel', at: { sel: '.pk-old', x: 50, y: 40 },
    lines: [
      ['peel', 'official business? pah. FORMS is what killed the marigolds.'],
      ['peel', 'you’re the one on eleven, eh. hm. HM.'],
      ['peel', 'memory works better when the beds are watered. that’s not a bribe, lad. it’s horticulture.'],
    ],
    hint: 'help Old Peel — water 3 beds, pull 2 weeds' },

  { id: 'c1_peel_chores', area: 'park', kind: 'objects', hint: 'water 3 beds, pull 2 weeds',
    objects: [
      { id: 'bed1', x: 44, y: 47, taps: 1, kind: 'bed', done: 'watered.' },
      { id: 'bed2', x: 52, y: 51, taps: 1, kind: 'bed', done: 'watered.' },
      { id: 'bed3', x: 47, y: 56, taps: 1, kind: 'bed', done: 'watered.' },
      { id: 'weed1', x: 57, y: 45, taps: 1, kind: 'weed', done: 'pulled.' },
      { id: 'weed2', x: 41, y: 53, taps: 1, kind: 'weed', done: 'pulled.' },
    ] },

  { id: 'c1_peel_memory', area: 'park', kind: 'talk', who: 'peel', at: { sel: '.pk-old', x: 50, y: 40 },
    lines: [
      ['peel', 'there WAS somebody on eleven. long time back.'],
      ['peel', 'and it bothers me, lad. i remember every banana that ever set foot in this park. not them.'],
      ['peel', 'no face. no name. gone like a smell.'],
      ['peel', 'two things stuck, mind. little drawings. sat out front every evening, drawing the same thing over and over. like they were practising.'],
      ['peel', 'and every morning — EVERY morning, rain or shine — down to the Bay. never came back carrying a thing.'],
      ['peel', 'so what in blazes were they DOING down there? go on. ask the shore.'],
    ],
    reward: { coins: 15, note: '🪣 Peel’s old watering can — yours now' },
    hint: 'go to Banana Bay — search the shore' },

  { id: 'c1_dig', area: 'beach', kind: 'objects', hint: 'that sand looks disturbed — dig',
    objects: [
      { id: 'dig', x: 46, y: 58, taps: 3, kind: 'dig',
        steps: ['a fork. of course.', 'one boot. classic beach.', '📦 a sealed TIN — heavy, old, deliberate'] },
    ] },

  { id: 'c1_split', area: 'beach', kind: 'talk', who: 'split', at: { x: 30, y: 46 },
    lines: [
      ['split', 'HALT. everything the tide touches is MINE. maritime law. i wrote it.'],
      ['you', 'it was buried. above the tide line.'],
      ['split', '…then it is yours by burial law. which you now owe me for teaching you.'],
      ['split', 'a tin, eh? sealed. old. the sort of thing an OLD banana would recognise.'],
      ['split', 'the park keeps one of those. go. Split has spoken.'],
    ],
    hint: 'take the tin back to Old Peel' },

  { id: 'c1_peel_fuss', area: 'park', kind: 'talk', who: 'peel', at: { sel: '.pk-old', x: 50, y: 40 },
    lines: [
      ['peel', 'a tin? give here— no. NO. not over an untidy lawn.'],
      ['peel', 'litter first. i can’t remember over mess. nobody can. it’s science.'],
    ],
    hint: 'bin the litter (2)' },

  { id: 'c1_litter', area: 'park', kind: 'objects', hint: 'bin the litter (2)',
    objects: [
      { id: 'lit1', x: 55, y: 58, taps: 1, kind: 'trash', done: 'binned.' },
      { id: 'lit2', x: 43, y: 44, taps: 1, kind: 'trash', done: 'binned.' },
    ] },

  { id: 'c1_peel_tin', area: 'park', kind: 'talk', who: 'peel', at: { sel: '.pk-old', x: 50, y: 40 },
    lines: [
      ['peel', '*opens it slow* …a photograph. that’s eleven, that is. with a little house on it.'],
      ['peel', 'there’s no house on eleven, lad. never has been. …except i’m looking at one.'],
      ['peel', 'and a flower. pressed flat.'],
      ['peel', 'i know this flower. grows ONE place in the whole world — end of the pier, where nobody planted nothing.'],
      ['peel', '…except somebody did. didn’t they.'],
    ],
    reward: { coins: 10, note: '🌸 the pressed flower — keep it safe' },
    hint: 'the pier at Banana Bay — where the flowers grow' },

  { id: 'c1_fish', area: 'beach', kind: 'objects', hint: 'fish at the flower spot (pier end)',
    objects: [
      { id: 'fish', x: 74, y: 47, taps: 2, kind: 'fish',
        steps: ['an old boot. the sea has a theme.', '🎞 a wrapped BUNDLE — eight little drawings. a flipbook.'] },
    ] },

  { id: 'c1_shelly', area: 'beach', kind: 'talk', who: 'shelly', at: { sel: '#bhShelly', x: 60, y: 40 },
    lines: [
      ['shelly', 'OH. oh oh oh. barnacle rings. do you know what these MEAN?'],
      ['you', '…old?'],
      ['shelly', 'OLD?? this wrap predates my charts. my EARLIER charts. arguably barnacles THEMSELVES.'],
      ['shelly', 'and inside — paper! eight little pages! flip them. go on. flip!'],
      ['fb', ''],
      ['you', '…it’s a banana. dancing.'],
      ['shelly', 'i don’t do dancing. the floor man does dancing. the loud room. GO.'],
    ],
    reward: { coins: 15 },
    hint: 'show the flipbook to Barty at the Rave' },

  { id: 'c1_barty_look', area: 'rave', kind: 'talk', who: 'barty', at: { x: 18, y: 72 },
    lines: [
      ['barty', 'howdy howdy! whatcha got there— a flipbook! cute!'],
      ['fb', ''],
      ['barty', 'that’s just how bananas dance, friend!'],
      ['you', '…who taught YOU the dance, Barty?'],
      ['barty', 'taught? nobody TEACHES it! you just… know it!'],
      ['barty', '…huh.'],
      ['barty', 'keep my floor warm a minute. i need to think. *mutter* never done that before.'],
    ],
    hint: 'keep the floor warm — dance + send 3 ❤' },

  { id: 'c1_floor', area: 'rave', kind: 'watch', hint: 'dance 30s · send 3 reactions',
    watch: { secs: 30, taps: 3 } },

  { id: 'c1_barty_truth', area: 'rave', kind: 'talk', who: 'barty', at: { x: 18, y: 72 },
    lines: [
      ['barty', 'every banana. same dance. since before there was a floor to do it ON.'],
      ['barty', 'and your little book is older than my floor.'],
      ['barty', '*mutter* i sleep under that bar. thought i knew everything under it. anyway!'],
      ['barty', 'whoever drew these taught the whole world to dance… and never signed their name.'],
      ['barty', 'go home, friend. things that wait get buried. and somethin’ on eleven has waited a LONG time.'],
    ],
    reward: { coins: 20, note: '🖼 the flipbook — a keepsake for your wall' },
    hint: 'go home — you live here now' },

  { id: 'c1_move_in', area: 'homestead', kind: 'goal', hint: 'pitch your tent — 📱 order it on the phone',
    resSkip: '🖼 the photograph goes up on your wall — it’s home now' },

  { id: 'c1_nib_registry', area: 'homestead', kind: 'talk', who: 'nib', at: { x: 63, y: 78 },
    lines: [
      ['nib', 'a DWELLING! i can register a dwelling! this is the best day of my— *opens book*'],
      ['nib', '…there is already an entry on this page.'],
      ['nib', 'scratched out. by hand. dated 1999.'],
      ['you', 'who scratches out a registry entry?'],
      ['nib', 'NOBODY. that is not a thing that CAN happen. i laminated the rulebook MYSELF.'],
      ['nib', '…i need to sit down. i have never needed to sit down.'],
      ['paper', 'CHAPTER ONE — complete. 🍌 (chapter two: soon)'],
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
.bwq-mark {
  position:absolute; z-index:2400; width:26px; height:34px; margin-left:-13px;
  cursor:pointer; animation:bwqBob 1.1s ease-in-out infinite;
}
.bwq-mark i {
  display:block; width:100%; height:100%;
  background:#ffe135; border:3px solid #000; box-shadow:2px 2px 0 rgba(0,0,0,0.45);
  color:#000; font:900 20px/28px "Archivo Black","Arial Black",sans-serif; text-align:center;
  font-style:normal;
}
@keyframes bwqBob { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-7px); } }
.bwq-obj {
  position:absolute; z-index:2350; width:34px; height:34px; margin:-17px 0 0 -17px;
  cursor:pointer; display:grid; place-items:center;
}
.bwq-obj i {
  display:block; width:22px; height:22px; border:3px solid #000; border-radius:50%;
  box-shadow:0 0 0 3px rgba(255,225,53,0.35), 2px 2px 0 rgba(0,0,0,0.4);
  animation:bwqPulse 1.3s ease-in-out infinite;
}
.bwq-obj--bed i { background:#5f8a3c; border-radius:6px; }
.bwq-obj--weed i { background:#3e6b2a; }
.bwq-obj--trash i { background:#b9a06a; border-radius:4px; }
.bwq-obj--dig i { background:#c9a86a; }
.bwq-obj--fish i { background:#4aa5c9; }
@keyframes bwqPulse { 0%,100% { transform:scale(1); } 50% { transform:scale(1.22); } }
.bwq-hint {
  position:absolute; left:8px; top:44px; z-index:900; max-width:62%;
  background:rgba(10,14,8,0.85); color:#ffe135; border:2px solid #ffe135;
  font-size:0.62rem; font-weight:800; padding:4px 8px; border-radius:4px;
  pointer-events:none; line-height:1.35;
}
.bwq-dlg {
  position:fixed; left:50%; bottom:12px; transform:translateX(-50%); z-index:5000;
  width:min(480px, calc(100vw - 20px)); box-sizing:border-box;
  background:#14240f; color:#fffdf5; border:4px solid #000; box-shadow:6px 6px 0 #000;
  padding:0.8rem 0.95rem 0.9rem; cursor:pointer;
}
.bwq-dlg[hidden] { display:none !important; }
.bwq-dlg b { display:block; font-size:0.68rem; letter-spacing:0.12em; text-transform:uppercase; margin-bottom:0.3rem; }
.bwq-dlg p { margin:0; font-size:0.92rem; line-height:1.5; font-weight:700; }
.bwq-dlg small { display:block; margin-top:0.55rem; font-size:0.62rem; opacity:0.55; font-weight:800; text-transform:uppercase; letter-spacing:0.1em; }
.bwq-dlg .bwq-paper {
  background:#f4e9c8; color:#3a2c14; border:2px solid #3a2c14; padding:0.6rem 0.7rem;
  font-style:italic; font-weight:700; font-size:0.88rem; line-height:1.5;
}
.bwq-dlg canvas { display:block; margin:0.2rem auto 0.3rem; image-rendering:pixelated;
  border:3px solid #000; background:#fffdf5; }
.bwq-toast {
  position:fixed; left:50%; top:64px; transform:translateX(-50%); z-index:5200;
  background:#14240f; color:#ffe135; border:3px solid #000; box-shadow:3px 3px 0 #000;
  font-size:0.8rem; font-weight:800; padding:0.5rem 0.85rem; max-width:88vw;
  text-align:center; pointer-events:none; opacity:0; transition:opacity 0.25s ease;
}
.bwq-toast.on { opacity:1; }
@media (prefers-reduced-motion:reduce) { .bwq-mark, .bwq-obj i { animation:none; } }
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
    // anchor to a live element's own % position when it exists — the marker
    // follows whatever the engine decided; fixed % otherwise
    let x = at.x, y = at.y;
    if (at.sel) {
      const t = document.querySelector(at.sel);
      if (t && t.style.left) { x = parseFloat(t.style.left); y = parseFloat(t.style.top); }
    }
    el.style.left = x + '%';
    el.style.top = (y - 4) + '%';
  }

  function openDialog(step) {
    const lines = (S.res && step.linesRes) ? step.linesRes : step.lines;
    let i = 0;
    if (dlg) dlg.remove();
    dlg = document.createElement('div');
    dlg.className = 'bwq-dlg';
    document.body.appendChild(dlg);
    const show = () => {
      const [who, text] = lines[i];
      if (who === 'paper') {
        dlg.innerHTML = '<div class="bwq-paper"></div><small>tap to continue</small>';
        dlg.querySelector('.bwq-paper').textContent = text;
      } else if (who === 'fb') {
        dlg.innerHTML = '<b style="color:#ffe135">the flipbook</b><small>tap to continue</small>';
        dlg.insertBefore(flipbookCanvas(), dlg.querySelector('small'));
      } else {
        const w = WHO[who];
        dlg.innerHTML = '<b></b><p></p><small>tap to continue</small>';
        dlg.querySelector('b').textContent = w.n;
        dlg.querySelector('b').style.color = w.c;
        dlg.querySelector('p').textContent = text;
      }
    };
    dlg.addEventListener('click', () => {
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

    // the journal chip — always present in the ACTIVE area, and it is also the
    // "you're in the wrong area" compass: the hint names where to go
    if (step.hint) {
      const h = document.createElement('div');
      h.className = 'bwq-hint';
      h.textContent = '🕯 ' + step.hint;
      w.appendChild(h); layer.push(h);
    }
    if (step.area !== area) return;      // objective lives elsewhere — hint covers it

    if (step.kind === 'talk') {
      const m = document.createElement('div');
      m.className = 'bwq-mark';
      m.innerHTML = '<i>!</i>';
      place(m, step.at);
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

  // engines rebuild bits of their world — re-assert the layer if it got wiped
  setInterval(() => {
    if (S.done || dlg) return;
    const w = world();
    if (w && layer.length && !layer[0].isConnected) render();
  }, 2500);

  render();
  track('quest_boot', { area, step: STEPS[S.s] && STEPS[S.s].id });
}
