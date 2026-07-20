// Dancing Banana builder — the banana ALWAYS dances (authentic 8-frame arm-wave
// from the original 1999 GIF, via /assets/banana-dance.png spritesheet); stills
// are only chosen at export time (sticker/meme card). One canvas render path
// (drawComposite) drives the live preview, the chat-size emoji preview, the
// frame-picker thumbnails and both exports, so what you see is what you get.
import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import { dailyOutfit } from '../lib/banana-daily.js';
import { shelfAdd } from '../lib/banana-shelf.js';
import { passPatch, passStat, passVisit, passToast } from '../lib/banana-pass.js';
import {
  SHEET_SRC, FW, FH, NFRAMES, BASE_CYCLE_S, FRAMES, SVG, EFFECTS,
  PACKS, HAT_DEFS, SHADE_DEFS, EXTRA_DEFS, HAT_BY_ID, SHADE_BY_ID, HATS, GLASSES,
  PX, HAT_OVERLAP, SH_DY, FRAME_H_FRAC, FRAME_TOP_FRAC,
  sheet, assetsReady, drawComposite as engineDraw, resolveHands,
} from '../lib/banana-engine.js';
// shared sticker brain — one source of truth with the PDP (which owns the
// preview + checkout since 9 Jul; the builder only picks products + previews)
import {
  stickerCaptions, stickerEffect, captionsClean, localizedPrice,
  makeStickerMockup as coreMockup, ensureCaptionFont,
} from '../lib/sticker-core.js';
import { memeGif } from '../lib/meme-gif.js';

const SPD_MIN = 0.35, SPD_MAX = 1.6;
// FEET slot = footwear, a SINGLE-SELECT group (one pair at a time). Stored in
// state.extras like other extras (so the outfit shape / URL / bb-last / worker
// are all unchanged) but the builder + engine keep it mutually exclusive.
const FEET_DEFS = EXTRA_DEFS.filter((d) => d.anchor === 'feet' && !d.raveOnly && !d.preview);
// the BODY zone: chest-anchored garments + neckwear (bow tie, ties, chains, scarves…) —
// mutually exclusive in the builder, same single-select pattern as the feet
const BODY_DEFS = EXTRA_DEFS.filter((d) => d.zone === 'body' && !d.raveOnly && !d.preview);


const BGS = ['transparent','#ffe135','#ff4d6d','#6c8cff','#37d67a','#ffffff','#111111','#ff9f1c','#b388ff'];
// the EXTENDED standardized palette — same tray (it scrolls now), all at once
// in the inventory sheet. Surprise-me sticks to the core BGS above.
const BGS_MORE = [
  '#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#03a9f4',
  '#00bcd4', '#009688', '#8bc34a', '#cddc39', '#ff7043', '#795548',
  '#607d8b', '#ffd9e8', '#d9e8ff', '#d3f8e2', '#fff3c4', '#22163a',
];
// tiny monochrome pixel icons (currentColor) for the pause button
const ICON_PAUSE = '<svg class="pxi" viewBox="0 0 70 80" shape-rendering="crispEdges" aria-hidden="true" fill="currentColor"><rect x="10" y="10" width="20" height="60"/><rect x="40" y="10" width="20" height="60"/></svg>';
const ICON_PLAY = '<svg class="pxi" viewBox="0 0 70 80" shape-rendering="crispEdges" aria-hidden="true" fill="currentColor"><rect x="15" y="10" width="15" height="60"/><rect x="30" y="20" width="15" height="40"/><rect x="45" y="30" width="15" height="20"/></svg>';




const el = (id) => document.getElementById(id);
if (el('bbStage')) init();

function init() {
  const stage = el('bbStage');
  const canvas = el('bbCanvas');
  const topIn = el('bbTopText'), botIn = el('bbBottomText'), speed = el('bbSpeed');

  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const state = {
    bg: 'transparent', top: '', bottom: '', glasses: 'none', hat: 'none',
    extras: {}, effect: 'none', // extras keyed by def id, e.g. { mustache: true }
    spd: BASE_CYCLE_S, frame: 0, // frame = the sticker still
    paused: reducedMotion,
  };

  // ---- sprite + accessory image loading ----

  // the engine draws from explicit outfit args; this page has ONE banana whose
  // outfit lives in `state`, so wrap it once and every old call site works.
  const drawComposite = (ctx, W, idx, o) =>
    engineDraw(ctx, W, idx, { hat: state.hat, glasses: state.glasses, extras: state.extras, top: state.top, bottom: state.bottom, ...o });

  // ---- controls ----
  BGS.concat(BGS_MORE).forEach((c) => {
    const b = document.createElement('button');
    b.className = 'bb-swatch'; b.dataset.bg = c; b.setAttribute('aria-label', c);
    if (c === 'transparent') b.classList.add('bb-swatch--none'); else b.style.background = c;
    b.onclick = () => { state.bg = c; onState(); };
    el('bbSwatches').appendChild(b);
  });
  function chips(host, items, key) {
    items.forEach(([val, label]) => {
      const b = document.createElement('button');
      b.className = 'bb-chip'; b.textContent = label; b.dataset.val = val;
      b.onclick = () => { state[key] = val; onState(); };
      el(host).appendChild(b);
    });
  }
  // wearables show THEMSELVES — the asset art IS the button (Trym: takes up a
  // lot less space than words). 'none' = a dashed empty slot.
  // earned accessories: unlocked at the rave, remembered forever — each item
  // carries its OWN proof (a localStorage `flag`, or a minted pass `patch`).
  // Generic on purpose: a SECOND earned:'rave' item (the DJ-headphones drop)
  // must read ITS flag, not the glowstick's. Defined before iconChips runs.
  const earnedUnlocked = (d) => {
    if (!d.earned) return true;
    try {
      if (d.flag) return localStorage.getItem(d.flag) === '1';
      if (d.patch) return !!((JSON.parse(localStorage.getItem('pass-v1') || '{}').patches || {})[d.patch]);
    } catch (e) {}
    return false;
  };
  function iconChips(host, items, key, artFor, defFor) {
    items.forEach(([val, label]) => {
      if (val === 'none') return; // no 'none' chip — click the worn item to take it off (like extras)
      const def = defFor && defFor(val);
      if (def && !earnedUnlocked(def)) {
        // a locked drop is a DOOR: the chip links to where you catch it
        const a = document.createElement('a');
        a.className = 'bb-chip bb-chip--icon bb-chip--locked';
        a.href = '/rave/'; a.dataset.place = 'builder-locked';
        a.innerHTML = artFor(val) || label;
        a.title = (def.label || label) + ' — ' + (def.lock || 'earned at the rave');
        a.setAttribute('aria-label', (def.label || label) + ' (locked — catch it at the rave)');
        el(host).appendChild(a);
        return;
      }
      const b = document.createElement('button');
      b.className = 'bb-chip bb-chip--icon';
      b.innerHTML = artFor(val);
      b.dataset.val = val;
      b.title = label;
      b.setAttribute('aria-label', label);
      b.onclick = () => { state[key] = (state[key] === val ? 'none' : val); onState(); };
      el(host).appendChild(b);
    });
  }
  iconChips('bbGlassesChips', GLASSES, 'glasses', (id) => { const d = SHADE_BY_ID[id]; return d && SVG[d.front]; }, (id) => SHADE_BY_ID[id]);
  iconChips('bbHatChips', HATS, 'hat', (id) => { const d = HAT_BY_ID[id]; return d && SVG[d.art]; }, (id) => HAT_BY_ID[id]);
  chips('bbEffectChips', EFFECTS, 'effect'); // effects have no wearable art — words stay
  // HANDS — two gloves, one item each. The engine's resolveHands() derives
  // who-holds-what from the equipped SET (identical on every surface — no
  // hand state in outfits). Here we only enforce CAPACITY: equipping a third
  // held item frees the glove it prefers (the item resolved to that glove is
  // dropped) — like grabbing something new with that hand. New hand items
  // need nothing beyond their manifest entry; never special-case them here.
  const toggleHand = (d) => {
    if (state.extras[d.id]) { state.extras[d.id] = false; onState(); return; }
    const held = EXTRA_DEFS.filter((x) => x.anchor === 'hand' && !x.raveOnly && state.extras[x.id]);
    if (held.length >= 2) {
      const glove = resolveHands(state.extras);
      const evict = glove[d.hand === 'left' ? 'left' : 'right'] || held[0];
      state.extras[evict.id] = false;
    }
    state.extras[d.id] = true;
    onState();
  };

  // extras = independent toggles, not a single-choice row (the art is the button)
  EXTRA_DEFS.forEach((d) => {
    if (d.raveOnly) return; // session trophies (the happy-hour beer) are earned AT the rave, never dressed on
    if (d.preview) return; // review candidates live on /dev-wearables/ only
    if (d.anchor === 'feet') return; // shoes get their own single-select row below
    if (d.zone === 'body') return; // body garments too — one garment on the body at a time
    const art = SVG[d.front || d.art];
    if (!earnedUnlocked(d)) {
      // a locked souvenir is a DOOR: the chip links to where you earn it
      const a = document.createElement('a');
      a.className = 'bb-chip bb-chip--icon bb-chip--locked';
      a.href = '/rave/'; a.dataset.place = 'builder-locked';
      a.innerHTML = art || d.label;
      a.title = d.label + ' — ' + (d.lock || 'earned at the rave');
      a.setAttribute('aria-label', d.label + ' (locked — earn it at the rave)');
      el('bbExtrasChips').appendChild(a);
      return;
    }
    const b = document.createElement('button');
    b.className = 'bb-chip bb-chip--icon';
    b.innerHTML = art || d.label;
    b.dataset.val = d.id;
    b.title = d.label;
    b.setAttribute('aria-label', d.label);
    b.onclick = d.anchor === 'hand'
      ? () => toggleHand(d)
      : () => { state.extras[d.id] = !state.extras[d.id]; onState(); };
    el('bbExtrasChips').appendChild(b);
  });

  // FEET row — single-select: one shoe clears the others; a 'none' chip returns
  // to the banana's own baked-in shoes. setFeet enforces the exclusivity.
  const setFeet = (id) => { FEET_DEFS.forEach((d) => { state.extras[d.id] = (d.id === id); }); onState(); };
  if (el('bbFeetChips') && FEET_DEFS.length) {
    FEET_DEFS.forEach((d) => {
      const b = document.createElement('button');
      b.className = 'bb-chip bb-chip--icon';
      b.innerHTML = SVG[d.art];
      b.dataset.feet = d.id;
      b.title = d.label; b.setAttribute('aria-label', d.label);
      b.onclick = () => setFeet(state.extras[d.id] ? null : d.id); // click the active pair = take them off
      el('bbFeetChips').appendChild(b);
    });
  }

  // BODY row — same single-select contract as the feet (bow tie OR chain OR
  // tie, never a pile of neckwear on ten pixels of banana)
  const setBody = (id) => { BODY_DEFS.forEach((d) => { state.extras[d.id] = (d.id === id); }); onState(); };
  if (el('bbBodyChips') && BODY_DEFS.length) {
    BODY_DEFS.forEach((d) => {
      const b = document.createElement('button');
      b.className = 'bb-chip bb-chip--icon';
      b.innerHTML = SVG[d.front || d.art];
      b.dataset.body = d.id;
      b.title = d.label; b.setAttribute('aria-label', d.label);
      b.onclick = () => setBody(state.extras[d.id] ? null : d.id); // click the worn one = take it off
      el('bbBodyChips').appendChild(b);
    });
  }

  // ---- slot trays (#7 ownership stack): the chip rows scroll sideways so the
  // catalog can grow forever. trayify adds the browse affordances — edge fades
  // + arrows only WHEN items are actually hidden, an item count on the label,
  // and scrolls the worn item into view so a loaded outfit is never off-screen.
  function trayify(hostId) {
    const tray = el(hostId);
    if (!tray || !tray.children.length) return;
    const row = tray.closest('.bb-row');
    const label = row && row.querySelector('label');
    if (label && !label.querySelector('.bb-count')) {
      const slotName = label.textContent.trim();
      const n = document.createElement('span');
      n.className = 'bb-count';
      n.textContent = tray.children.length;
      label.appendChild(n);
      // the OVERVIEW door: trays show 4-5 at a time; the inventory sheet
      // shows the whole category at once (Trym: scanning a long sidescroll
      // for "that item somewhere at the end" is exhausting)
      const all = document.createElement('button');
      all.type = 'button';
      all.className = 'bb-seeall';
      all.textContent = '⊞ all';
      all.setAttribute('aria-label', 'Browse all ' + slotName.toLowerCase());
      all.onclick = () => openInventory(tray, slotName);
      label.appendChild(all);
    }
    let aL = null, aR = null;
    if (row) {
      const mk = (dir) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'bb-trayarrow bb-trayarrow--' + (dir < 0 ? 'l' : 'r');
        b.textContent = dir < 0 ? '‹' : '›';
        b.setAttribute('aria-label', dir < 0 ? 'Scroll back' : 'More items');
        b.onclick = () => tray.scrollBy({ left: dir * tray.clientWidth * 0.8, behavior: 'smooth' });
        row.appendChild(b);
        return b;
      };
      aL = mk(-1); aR = mk(1);
    }
    const sync = () => {
      const more = tray.scrollWidth - tray.clientWidth > 4;
      const atL = tray.scrollLeft < 4;
      const atR = tray.scrollLeft > tray.scrollWidth - tray.clientWidth - 4;
      tray.classList.toggle('bb-chips--fadeR', more && !atR);
      tray.classList.toggle('bb-chips--fadeL', more && !atL);
      if (aL) aL.hidden = !more || atL;
      if (aR) aR.hidden = !more || atR;
    };
    tray.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    sync();
  }
  ['bbSwatches', 'bbGlassesChips', 'bbHatChips', 'bbBodyChips', 'bbFeetChips', 'bbExtrasChips', 'bbEffectChips'].forEach(trayify);

  // ---- THE INVENTORY sheet: the whole category at once. Tiles are thin
  // PROXIES of the tray chips — clicks delegate to the real buttons, so every
  // selection rule (single-select hats/feet, toggling extras, locked doors)
  // stays in exactly one place. The sheet stays open to compare; the banana
  // above it tries things on live.
  let invTray = null;
  function syncInv() {
    if (!invTray) return;
    [...el('bbInvGrid').children].forEach((p, i) => {
      const s = invTray.children[i];
      if (s) p.setAttribute('aria-pressed', s.getAttribute('aria-pressed') || 'false');
    });
  }
  function openInventory(tray, slotName) {
    invTray = tray;
    el('bbInvTitle').textContent = slotName;
    el('bbInvCount').textContent = tray.children.length + ' item' + (tray.children.length === 1 ? '' : 's');
    const g = el('bbInvGrid');
    g.textContent = '';
    [...tray.children].forEach((src) => {
      const isLink = src.tagName === 'A';
      const p = document.createElement(isLink ? 'a' : 'button');
      if (isLink) { p.href = src.getAttribute('href'); p.dataset.place = 'builder-locked'; }
      // onState→refreshUI runs synchronously inside src.click(), so the tray's
      // aria-pressed is already fresh here (rAF would stall in occluded tabs)
      else { p.type = 'button'; p.onclick = () => { src.click(); syncInv(); }; }
      p.className = src.className;
      p.innerHTML = src.innerHTML;
      p.style.cssText = src.style.cssText; // swatches carry their colour inline
      if (src.dataset.bg) p.dataset.bg = src.dataset.bg; // refreshUI paints .bb-swatch by data-bg
      p.title = src.title || src.textContent;
      p.setAttribute('aria-label', src.getAttribute('aria-label') || src.textContent);
      g.appendChild(p);
    });
    syncInv();
    el('bbInv').hidden = false;
    document.documentElement.style.overflow = 'hidden'; // the sheet scrolls, not the page
    el('bbInvClose').focus({ preventScroll: true });
    track('inventory_open', { slot: slotName.toLowerCase() });
  }
  function closeInventory() {
    el('bbInv').hidden = true;
    invTray = null;
    document.documentElement.style.overflow = '';
  }
  el('bbInvClose').onclick = closeInventory;
  el('bbInvBack').onclick = closeInventory;
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !el('bbInv').hidden) closeInventory(); });
  // a loaded outfit's worn items scroll into view (never hidden in the overflow)
  function revealWorn() {
    document.querySelectorAll('.bb-chips [aria-pressed="true"]').forEach((c) => {
      const tray = c.parentElement;
      if (tray.scrollWidth - tray.clientWidth > 4) {
        tray.scrollLeft = Math.max(0, c.offsetLeft - tray.clientWidth / 2 + c.offsetWidth / 2);
        tray.dispatchEvent(new Event('scroll'));
      }
    });
  }
  setTimeout(revealWorn, 60); // after refreshUI paints aria-pressed

  topIn.addEventListener('input', () => { state.top = topIn.value; onState(); });
  botIn.addEventListener('input', () => { state.bottom = botIn.value; onState(); });
  // slider shows "faster to the right": invert into seconds-per-cycle
  speed.addEventListener('input', () => { state.spd = Math.round((SPD_MIN + SPD_MAX - parseFloat(speed.value)) * 100) / 100; onState(); });

  el('bbPause').onclick = () => { state.paused = !state.paused; refreshUI(); };

  // the top quick action reveals the SHOP (all three products, your banana
  // previewed on each) instead of teleporting to one PDP — the line is
  // sticker + magnet + tee now, and the choice converts better than a jump
  el('bbQuickSticker').onclick = () => {
    track('quick_action', { action: 'takehome' });
    const t = document.getElementById('bbTakeHome');
    if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // ---- the take-it-home bar: armed by the first customization tap, hidden
  // while the offer itself is on screen, dismissible for the session. Mobile
  // = bottom bar, desktop = floating card (CSS decides); the mini canvas
  // mirrors the main stage so YOUR banana dances on the nudge. ----
  const homeBar = el('bbHomeBar');
  const takeSec = document.getElementById('bbTakeHome');
  if (homeBar && takeSec) {
    let armed = false;
    let dismissed = false;
    let takeVisible = false;
    try { dismissed = sessionStorage.getItem('bb-homebar-x') === '1'; } catch (e) {}
    const sync = () => homeBar.classList.toggle('show', armed && !dismissed && !takeVisible);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((es) => {
        es.forEach((x) => { takeVisible = x.isIntersecting; });
        sync();
      }, { threshold: 0.12 }).observe(takeSec);
    }
    const arm = (delay) => {
      if (armed) return;
      armed = true;
      track('section_seen', { placement: 'homebar' });
      setTimeout(sync, delay);
    };
    document.querySelector('.bb-controls').addEventListener('click', (e) => {
      if (e.target.closest('#bbQuickSticker')) return; // the CTA isn't "playing"
      arm(800); // let the first change land before nudging
    });
    // scroll-only visitors (most ad traffic) never click a control — arm once
    // they're clearly into the page, so the nudge exists for them too
    addEventListener('scroll', () => { if (scrollY > 500) arm(400); }, { passive: true });
    el('bbHomeBarGo').onclick = () => {
      track('quick_action', { action: 'homebar' });
      takeSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    el('bbHomeBarX').onclick = () => {
      dismissed = true;
      try { sessionStorage.setItem('bb-homebar-x', '1'); } catch (e) {}
      sync();
    };
    // the mini stage: mirror the live main canvas while the bar is visible
    const barCv = el('bbHomeBarCv');
    const mainCv = el('bbCanvas');
    if (barCv && mainCv) {
      const bctx = barCv.getContext('2d');
      bctx.imageSmoothingEnabled = false;
      (function mirror() {
        if (homeBar.classList.contains('show')) {
          bctx.clearRect(0, 0, barCv.width, barCv.height);
          bctx.drawImage(mainCv, 0, 0, barCv.width, barCv.height);
        }
        requestAnimationFrame(mirror);
      })();
    }
  }

  // ---- dock the sticky preview on mobile: past the hero it becomes a small
  // floating picture-in-picture (top-right) so the controls get the screen
  // back. The wrap's LAYOUT height is pinned first, so the dock is purely
  // visual — no reflow, no scroll jumps, no compensation needed. ----
  const stagewrap = document.querySelector('.bb-stagewrap');
  if (stagewrap && window.matchMedia('(max-width: 819px)').matches
      && !document.documentElement.classList.contains('bb-overlay')) {
    let mini = false;
    let pinned = false;
    addEventListener('scroll', () => {
      // compact as soon as the hero is gone (Trym: it waited until the
      // Background row before docking — too late); small hysteresis
      const want = mini ? scrollY > 160 : scrollY > 240;
      if (want === mini) return;
      if (!pinned) { stagewrap.style.minHeight = stagewrap.offsetHeight + 'px'; pinned = true; }
      mini = want;
      stagewrap.classList.toggle('bb-mini', mini);
    }, { passive: true });
  }

  el('bbRandom').onclick = () => {
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const quips = [
      // banana / party / dance
      ['HELLO YES', "IT'S THE BANANA GUY"],
      ['IT IS', 'WEDNESDAY MY DUDES'],
      ['', 'PEANUT BUTTER JELLY TIME'],
      ['CERTIFIED', 'BANANA MOMENT'],
      ['NO THOUGHTS', 'JUST DANCE'],
      ['MOM SAID', "IT'S MY TURN TO DANCE"],
      ['CEO', 'OF DANCING'],
      ['ERROR 404', 'CHILL NOT FOUND'],
      ['LOCAL BANANA', 'REFUSES TO STOP'],
      ['ME AFTER', 'ONE COFFEE'],
      ['VIBE CHECK', 'PASSED'],
      ['5 AM', 'STILL DANCING'],
      ['THE FLOOR IS LAVA', 'ANYWAY'],
      ['BANANA', 'FOR SCALE'],
      ['UNLIMITED', 'POTASSIUM'],
      ['WHEN THE', 'BEAT DROPS'],
      ['MY LAST', 'BRAINCELL'],
      ['FRIDAY', 'ENERGY'],
      ['EMOTIONAL', 'SUPPORT BANANA'],
      ['GO', 'BANANAS'],
      ['DANCE LIKE NOBODY', 'IS WATCHING'],
      ['100%', 'RIPE'],
      ['POV:', 'YOU FOUND THE BANANA'],
      ['ME WHEN', 'THE BANANA'],
      ['THIS IS', 'FINE'],
      ['ONE MORE DANCE', 'I PROMISE'],
      ['ABSOLUTE', 'UNIT'],
      ['PEEL', 'GOOD VIBES'],
      ['MAXIMUM', 'WIGGLE'],
      ['BORN TO DANCE', 'FORCED TO WORK'],
      ['SINCE 1999', 'STILL DANCING'],
      ['MOISTURIZED', 'IN MY PEEL'],
      ['CARDIO?', 'THIS IS CARDIO'],
      ['LEG DAY', 'EVERY DAY'],
      ['THE RHYTHM', 'CHOSE ME'],
      ['SHAKE IT', 'TIL YOU MAKE IT'],
      ['ZERO CHILL', 'FULL WIGGLE'],
      ['POTASSIUM', 'POWERED'],
      ['CAUTION:', 'MAXIMUM FUNK'],
      ['DO NOT DISTURB', 'BANANA BUSY'],
      ['WEEKEND', 'LOADING…'],
      ['DANCE FIRST', 'THINK LATER'],
      // the office (sarcasm division)
      ['THIS MEETING', 'COULD BE A DANCE'],
      ['PER MY LAST', 'EMAIL'],
      ['CIRCLING BACK', 'NEVER'],
      ['QUICK CALL?', 'ABSOLUTELY NOT'],
      ['ON MUTE', 'ON PURPOSE'],
      ['REPLY ALL', 'REGRET ALL'],
      ['OUT OF OFFICE', 'FOREVER'],
      ['QUIET QUITTING', 'LOUD DANCING'],
      ['VERY PRODUCTIVE', '(I DANCED)'],
      ['MY MANAGER', "CAN'T SEE THIS"],
      ['SALARY:', 'EXPOSURE'],
      ['WORKING', 'HARDLY'],
      // life (ironic, fatalistic, dancing anyway)
      ['ADULTING', 'POSTPONED'],
      ['NOT THRIVING', 'BUT VIBING'],
      ["I CAN'T EVEN", 'THE BANANA CAN'],
      ['BILLS?', 'BANANAS.'],
      ['RENT IS DUE', 'DANCE IS FREE'],
      ['SOCIAL BATTERY', '2%'],
      ['LEFT ON READ', 'DANCING ANYWAY'],
      ['CHEAPER THAN', 'THERAPY'],
      ['PLOT?', 'LOST IT'],
      ['EVERYTHING IS', 'CONTENT'],
      ['MAIN CHARACTER', 'ENERGY'],
      ['TOUCHED GRASS', 'IT WAS MID'],
      ['IT IS WHAT', 'IT IS'],
      ['SLEEP SCHEDULE', 'FICTIONAL'],
      ['MONDAY AGAIN', 'HOW. WHY.'],
      ['PLANS CANCELLED', 'MOOD RESTORED'],
      ['THE FUTURE IS', 'UNCLEAR. DANCE.'],
      ['NO PLANS', 'NO PROBLEMS'],
      ['', ''],
    ];
    passPatch('chaos');
    const q = pick(quips);
    state.bg = pick(BGS); state.top = q[0]; state.bottom = q[1];
    // surprise-me never rolls a LOCKED drop (an unearned earned:'rave' hat/shade
    // like the DJ headphones) — you can only wear what you've caught
    const hatOK = HATS.filter(([id]) => id === 'none' || !HAT_BY_ID[id] || earnedUnlocked(HAT_BY_ID[id]));
    const shadeOK = GLASSES.filter(([id]) => id === 'none' || !SHADE_BY_ID[id] || earnedUnlocked(SHADE_BY_ID[id]));
    state.glasses = pick(shadeOK)[0]; state.hat = pick(hatOK)[0];
    // non-feet extras roll independently; feet are EXCLUSIVE (same rule
    // setFeet enforces) — at most one pair, so the chips can't show four
    // pressed shoes at once (Trym's catch)
    const feetIds = FEET_DEFS.map((d) => d.id);
    const bodyIds = BODY_DEFS.map((d) => d.id);
    const handDefs = EXTRA_DEFS.filter((d) => d.anchor === 'hand');
    const handIds = handDefs.map((d) => d.id);
    EXTRA_DEFS.forEach((d) => {
      state.extras[d.id] = !d.raveOnly && !d.preview && !feetIds.includes(d.id) && !bodyIds.includes(d.id)
        && !handIds.includes(d.id) && earnedUnlocked(d) && Math.random() < 0.3;
    });
    const shoeable = FEET_DEFS.filter((d) => !d.raveOnly && earnedUnlocked(d));
    if (shoeable.length && Math.random() < 0.45) state.extras[pick(shoeable).id] = true;
    // neckwear is EXCLUSIVE too (bow tie OR chain OR tie OR scarf, never a pile)
    const bodyable = BODY_DEFS.filter((d) => earnedUnlocked(d));
    if (bodyable.length && Math.random() < 0.4) state.extras[pick(bodyable).id] = true;
    // held items are exclusive PER GLOVE (Trym's catch: the independent roll
    // could double-fist one hand) — at most one item per glove; a left+right
    // pair (trophy + balloons) is legit, two mugs in one glove is not
    for (const glove of ['left', 'right']) {
      const holdable = handDefs.filter((d) => d.hand === glove && !d.raveOnly && earnedUnlocked(d));
      if (holdable.length && Math.random() < 0.35) state.extras[pick(holdable).id] = true;
    }
    state.effect = pick(['none','none','disco','sparkle','confetti']);
    // tempo stays at the DEFAULT (Trym: the surprise is the outfit + caption;
    // tempo is a deliberate final adjustment, and randomizing it also left the
    // slider out of sync with the actual speed)
    state.spd = BASE_CYCLE_S;
    speed.value = SPD_MIN + SPD_MAX - state.spd;
    topIn.value = state.top; botIn.value = state.bottom;
    onState();
    track('surprise_me');
  };

  let toastT;
  function toast(msg) { const t = el('bbToast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 1800); }
  // ---- share: links that unfurl as YOUR banana ----
  // The browser renders a 1200x630 OG card (the only place the banana can be
  // rendered faithfully) and posts it to the share worker; the short /s/<id>
  // link serves crawler-readable og tags + bounces humans to the builder.
  // Any failure falls back to copying the plain builder URL.
  const SHARE_BASE = 'https://banana-share.trymstene.workers.dev';
  function renderShareCard() {
    const W = 1200, H = 630;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    const cardBg = state.bg === 'transparent' ? '#ffe135' : state.bg;
    ctx.fillStyle = cardBg;
    ctx.fillRect(0, 0, W, H);
    // drawComposite clears its square first, so it must paint its own bg
    drawComposite(ctx, 630, state.frame, {
      bg: cardBg, captions: true, effect: state.effect,
      hue: state.effect === 'disco' ? (360 * state.frame / NFRAMES) : 0,
    });
    // the composite drew into the top-left 630px square; add the pitch right
    const ink = '#111111', paper = '#fffdf5';
    ctx.textAlign = 'left'; ctx.lineJoin = 'round';
    const line = (txt, x, y, size, fill) => {
      ctx.font = '800 ' + size + 'px "Archivo Black", "Arial Black", sans-serif';
      ctx.strokeStyle = fill === ink ? paper : ink;
      ctx.lineWidth = size * 0.18;
      ctx.strokeText(txt, x, y);
      ctx.fillStyle = fill;
      ctx.fillText(txt, x, y);
    };
    line('I made a', 660, 240, 52, ink);
    line('dancing banana', 660, 310, 60, ink);
    line('make yours at', 660, 420, 30, ink);
    line('trymstene.com', 660, 466, 36, ink);
    return cv;
  }
  el('bbShare').onclick = async () => {
    sync();
    const plain = location.href;
    let copied = plain, mode = 'plain';
    try {
      await assetsReady();
      await ensureCaptionFont(state); // the OG card bakes the caption too — wait for Anton
      const blob = await new Promise((r) => renderShareCard().toBlob(r, 'image/png'));
      const res = await fetch(SHARE_BASE + '/share?p=' + encodeURIComponent(location.search.slice(1)), {
        method: 'POST', headers: { 'Content-Type': 'image/png' }, body: blob,
      });
      if (res.ok) { const d = await res.json(); if (d && d.url) { copied = d.url; mode = 'unfurl'; } }
    } catch (e) { /* plain fallback stands */ }
    try {
      await navigator.clipboard.writeText(copied);
      toast(mode === 'unfurl' ? 'Link copied — it unfurls with YOUR banana!' : 'Share link copied!');
    } catch (e) { toast('Copy this URL from the address bar'); }
    track('share_link_copy', { design: designStr(), mode });
    saveToShelf(mode === 'unfurl' ? (copied.split('/s/')[1] || null) : null);
    passPatch('spreader');
  };
  // wall submission is two steps: the first click reveals the optional
  // signature (free text is fine here — it rides Trym's human review gate)
  el('bbWallSubmit').onclick = () => {
    sync();
    if (!location.search.slice(1)) { toast('Dress it up a little first 🍌'); return; }
    if (!captionsClean(state)) { toast('Let’s keep it family friendly 🍌 — try other words'); return; }
    const row = el('bbSignRow');
    row.hidden = !row.hidden;
    if (!row.hidden) {
      // continuity: the name written on the pass prefills the byline (still
      // editable, and it rides Trym's human review gate like any signature)
      try { if (!el('bbSignName').value) el('bbSignName').value = (localStorage.getItem('ps-name-v1') || '').slice(0, 24); } catch (e) {}
      el('bbSignName').focus();
    }
  };
  el('bbSignSend').onclick = async () => {
    sync();
    const params = location.search.slice(1);
    const by = el('bbSignName').value.trim().slice(0, 24);
    el('bbSignRow').hidden = true;
    toast('Rendering your banana… 🍌');
    try {
      // submissions carry the REAL rendered GIF (the same pixels the meme
      // download makes) — approved ones go straight onto /banana-memes/
      const { blob, isT, tw, th } = await renderMemeGif();
      const title = [state.top, state.bottom].filter(Boolean).join(' ').trim().slice(0, 60)
        || 'Custom dancing banana';
      // sid = this browser's anonymous claim ticket: the pass page later asks
      // /gallery/status how the review went and posts the verdict as a notice
      const sid = [...crypto.getRandomValues(new Uint8Array(8))].map((b) => b.toString(16).padStart(2, '0')).join('');
      const meta = { kind: 'banana', by, title, params, transparent: isT, w: tw, h: th, sid };
      const res = await fetch(SHARE_BASE + '/gallery/submit?meta=' + encodeURIComponent(JSON.stringify(meta)), {
        method: 'POST',
        headers: { 'Content-Type': 'image/gif' },
        body: blob,
      });
      if (res.ok) {
        try {
          const subs = JSON.parse(localStorage.getItem('gal-subs-v1') || '[]');
          subs.unshift({ sid, title, at: Date.now(), status: 'pending' });
          localStorage.setItem('gal-subs-v1', JSON.stringify(subs.slice(0, 20)));
        } catch (e) {}
        // passToast (not the builder's plain toast): renders the pass link +
        // stays up long enough to read the expectation-setting line
        passToast('🖼 <b>Sent to the banana guy for review!</b><br>The verdict lands on <a href="/pass/">your Banana Pass</a> — usually within 48 hours.', 9000);
        passPatch('exhibitor');
      } else {
        toast('The gallery is busy — try again in a bit');
      }
    } catch (e) { toast('The gallery is busy — try again in a bit'); }
    track('gallery_submit', { kind: 'banana', signed: by ? 1 : 0, design: designStr() });
  };

  el('bbOverlayLink').onclick = async (e) => {
    if (e) e.preventDefault(); // it's a text link now — no jumping to the top
    // the streamer overlay is the BANANA OF THE DAY (a fresh, date-seeded outfit
    // every day) — NOT the banana being built here. Bare /overlay/ resolves to
    // the daily outfit; so the streamer sets it once and it changes on its own.
    const url = location.origin + '/overlay/';
    try { await navigator.clipboard.writeText(url); toast('Overlay link copied — add it in OBS as a Browser Source!'); }
    catch (e) { toast(url); }
    track('overlay_link_copy');
  };

  function track(name, params) { if (window.gtag) window.gtag('event', name, params || {}); }
  // funnel step clock: seconds since the PREVIOUS funnel step (sessionStorage
  // so it survives builder->PDP navigation). >30min = wandered off, send
  // nothing. Read via GA4 custom metric secs_since_prev (avg per step).
  function stepSecs() {
    var now = Date.now(); var prev = 0;
    try { prev = +(sessionStorage.getItem('fk-t') || 0); sessionStorage.setItem('fk-t', String(now)); } catch (e) {}
    var s = prev ? Math.round((now - prev) / 1000) : -1;
    return (s >= 0 && s <= 1800) ? s : undefined;
  }
  function withSecs(params) {
    var s = stepSecs();
    params = params || {};
    if (s !== undefined) params.secs_since_prev = s;
    return params;
  }

  // creations you keep (downloaded / shared / ordered) are recorded to the
  // shelf — the shelf itself lives on your pass (/pass/); the builder just saves
  function saveToShelf(shareId) {
    sync(); // make sure location.search reflects the current banana
    shelfAdd({ kind: 'banana', params: location.search.slice(1), shareId: shareId || null });
  }
  // compact outfit fingerprint attached to downloads/orders — six months of
  // this tells us which accessories to build packs and pre-made stickers from
  function designStr() {
    const ex = Object.keys(state.extras).filter((k) => state.extras[k]).join('+') || 'none';
    return [state.hat, state.glasses, ex, state.effect, state.bg].join('|');
  }

  // ---- URL state ----
  function sync() {
    const p = new URLSearchParams();
    if (state.bg !== 'transparent') p.set('bg', state.bg);
    if (state.top) p.set('t', state.top);
    if (state.bottom) p.set('b', state.bottom);
    if (state.glasses !== 'none') p.set('g', state.glasses);
    if (state.hat !== 'none') p.set('h', state.hat);
    const exOn = EXTRA_DEFS.filter((d) => state.extras[d.id]).map((d) => d.id);
    if (exOn.length) p.set('ex', exOn.join('.'));
    if (state.effect !== 'none') p.set('e', state.effect);
    if (state.spd !== BASE_CYCLE_S) p.set('s', state.spd);
    if (state.frame !== 0) p.set('f', state.frame);
    history.replaceState(null, '', p.toString() ? '?' + p.toString() : location.pathname);
    // the rave (and future shelf) greet you with your latest banana. Fields the
    // builder doesn't manage (the caught community item `c`) are PRESERVED —
    // a builder visit must never silently undress a rave catch.
    try {
      let prev = {};
      try { prev = JSON.parse(localStorage.getItem('bb-last') || '{}') || {}; } catch (e2) {}
      localStorage.setItem('bb-last', JSON.stringify({ ...prev, hat: state.hat, glasses: state.glasses, extras: state.extras, effect: state.effect }));
    } catch (e) {}
  }
  function load() {
    const p = new URLSearchParams(location.search);
    // continuity: with no outfit in the URL, you dress the banana you HAVE —
    // the one the rave knows (bb-last). Opening the builder fresh used to
    // start from defaults, which read as "my outfit changed on its own"
    // when returning to the rave (wife-test).
    const hasOutfitParams = ['g', 'h', 'ex', 'mu', 'bt', 'e', 'm'].some((k) => p.has(k));
    if (!hasOutfitParams) {
      try {
        const saved = JSON.parse(localStorage.getItem('bb-last') || 'null');
        if (saved && typeof saved === 'object') {
          // an earned hat/shade only restores where it's actually earned (the
          // same gate the extras use below) — a synced outfit can't wear a drop
          // you haven't caught on THIS device
          if (HAT_BY_ID[saved.hat] && earnedUnlocked(HAT_BY_ID[saved.hat])) state.hat = saved.hat;
          if (GLASSES.some(([v]) => v === saved.glasses) && earnedUnlocked(SHADE_BY_ID[saved.glasses] || {})) state.glasses = saved.glasses;
          EXTRA_DEFS.forEach((d) => {
            if (saved.extras && saved.extras[d.id] && !d.raveOnly && earnedUnlocked(d)) state.extras[d.id] = true;
          });
          if (EFFECTS.some(([v]) => v === saved.effect)) state.effect = saved.effect;
        }
      } catch (e) {}
    }
    if (p.get('bg')) state.bg = p.get('bg');
    state.top = p.get('t') || ''; state.bottom = p.get('b') || '';
    if (hasOutfitParams) { // URL outfits win; a paramless open keeps the bb-last seed above
      const g = p.get('g'); state.glasses = GLASSES.some(([v]) => v === g) ? g : (g ? 'shades' : 'none'); // old classic/cool links → shades
      const h = p.get('h'); state.hat = HAT_BY_ID[h] ? h : 'none';
      state.extras = {};
      (p.get('ex') || '').split('.').forEach((id) => { if (EXTRA_DEFS.some((d) => d.id === id)) state.extras[id] = true; });
      if (p.get('mu') === '1') state.extras.mustache = true; // legacy params
      if (p.get('bt') === '1') state.extras.bowtie = true;
      const e = p.get('e') || p.get('m'); // old m=disco links still work
      if (EFFECTS.some(([v]) => v === e)) state.effect = e;
    }
    state.spd = p.get('s') ? parseFloat(p.get('s')) : BASE_CYCLE_S;
    if (!(state.spd >= SPD_MIN && state.spd <= SPD_MAX)) state.spd = BASE_CYCLE_S;
    const f = parseInt(p.get('f'), 10); if (f >= 0 && f < NFRAMES) state.frame = f;
    topIn.value = state.top; botIn.value = state.bottom;
    speed.value = SPD_MIN + SPD_MAX - state.spd;
  }


  // ---- live preview loop (pausable clock) ----
  const pctx = canvas.getContext('2d');
  let lastIdx = -1, dirty = true, animT = 0, lastNow = 0;
  function tick(now) {
    if (!lastNow) lastNow = now;
    if (!state.paused) animT += now - lastNow;
    lastNow = now;
    const delay = Math.max(20, state.spd * 1000 / NFRAMES);
    const idx = Math.floor(animT / delay) % NFRAMES;
    const cyc = (animT % (delay * NFRAMES)) / (delay * NFRAMES);
    const hue = state.effect === 'disco' ? 360 * cyc : 0;
    if (idx !== lastIdx || hue || dirty) {
      const size = Math.min(720, Math.round(stage.clientWidth * (window.devicePixelRatio || 1)));
      if (canvas.width !== size) { canvas.width = size; canvas.height = size; }
      drawComposite(pctx, size, idx, { bg: state.bg, captions: true, hue, effect: state.effect });
      lastIdx = idx; dirty = false;
      drawChat(idx, hue);
    }
    requestAnimationFrame(tick);
  }

  // ---- chat-size emoji preview (the "this is how it looks in chat" moment) ----
  const chatCvs = [el('bbEmoji32')].filter(Boolean); // one true chat size — the 48px sibling made the line wrap
  const OFF = document.createElement('canvas'); OFF.width = 240; OFF.height = 240;
  const offCtx = OFF.getContext('2d');
  let emojiBB = { x: 0, y: 0, w: 240, h: 240 };
  function recomputeEmojiBB() { // union across all frames = motion-aware crop
    const W = 240, datas = [];
    for (let i = 0; i < NFRAMES; i++) {
      drawComposite(offCtx, W, i, { bg: 'transparent', captions: false, effect: state.effect });
      datas.push(offCtx.getImageData(0, 0, W, W).data);
    }
    emojiBB = pad(bboxOf(datas, W), W);
  }
  function drawChat(idx, hue) {
    drawComposite(offCtx, 240, idx, { bg: 'transparent', captions: false, hue, effect: state.effect });
    for (const c of chatCvs) {
      const cctx = c.getContext('2d');
      cctx.clearRect(0, 0, c.width, c.height);
      cctx.imageSmoothingEnabled = true;
      const s = Math.min(c.width / emojiBB.w, c.height / emojiBB.h);
      const dw = emojiBB.w * s, dh = emojiBB.h * s;
      cctx.drawImage(OFF, emojiBB.x, emojiBB.y, emojiBB.w, emojiBB.h, (c.width - dw) / 2, (c.height - dh) / 2, dw, dh);
    }
  }

  // ---- frame picker (sticker card): freeze your favourite move ----
  const pickerHost = el('bbFrames');
  const pickerCvs = [];
  for (let i = 0; i < NFRAMES; i++) {
    const b = document.createElement('button');
    b.className = 'bb-frame'; b.dataset.frame = i; b.setAttribute('aria-label', 'Dance frame ' + (i + 1));
    const c = document.createElement('canvas'); c.width = 96; c.height = 96;
    b.appendChild(c); pickerCvs.push(c);
    b.onclick = () => { state.frame = i; onState(); };
    pickerHost.appendChild(b);
  }
  function drawPicker() { // thumbnails show the outfit, not the effects
    pickerCvs.forEach((c, i) => drawComposite(c.getContext('2d'), 96, i, { bg: 'transparent', captions: false }));
  }

  // ---- live product tiles (buy card = the picker): each tile previews the
  // user's banana ON that product (sticker, magnet, …). One design rendered
  // once, then mocked per product. Adding a product = one more tile, no button.
  function drawTiles() {
    const tiles = document.querySelectorAll('#bbPgrid [data-mock]');
    if (!tiles.length) return;
    const W = 512;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = W;
    const ctx = cv.getContext('2d');
    drawComposite(ctx, W, state.frame, {
      // die-cut = banana only; captions + confetti/sparkle would cut into loose
      // pieces (see sticker-core stickerCaptions / stickerEffect)
      bg: state.bg, captions: stickerCaptions(state), effect: stickerEffect(state),
      hue: state.effect === 'disco' ? (360 * state.frame / NFRAMES) : 0,
    });
    let design = cv;
    if (state.bg === 'transparent') {
      const data = ctx.getImageData(0, 0, W, W).data;
      design = crop(cv, pad(bboxOf([data], W), W));
    }
    tiles.forEach((c) => {
      const mock = coreMockup(state, design, 360, c.dataset.mock);
      c.width = mock.width; c.height = mock.height;
      c.getContext('2d').drawImage(mock, 0, 0);
    });
  }

  // ---- state change: repaint everything derived ----
  let bbT;
  let bbStarted = false;
  function onState() {
    if (!bbStarted) { bbStarted = true; track('builder_start', withSecs()); }
    dirty = true;
    refreshUI(); sync();
    clearTimeout(bbT);
    bbT = setTimeout(() => { recomputeEmojiBB(); drawPicker(); drawTiles(); dirty = true; }, 60);
  }
  function refreshUI() {
    if (state.bg === 'transparent') { stage.classList.add('bb-stage--transparent'); stage.style.background = ''; }
    else { stage.classList.remove('bb-stage--transparent'); stage.style.background = state.bg; }
    document.querySelectorAll('.bb-swatch').forEach((s) => s.setAttribute('aria-pressed', s.dataset.bg === state.bg));
    [['bbGlassesChips','glasses'],['bbHatChips','hat'],['bbEffectChips','effect']].forEach(([host, key]) => {
      document.querySelectorAll('#' + host + ' .bb-chip').forEach((c) => c.setAttribute('aria-pressed', c.dataset.val === state[key]));
    });
    document.querySelectorAll('#bbExtrasChips .bb-chip').forEach((c) => c.setAttribute('aria-pressed', String(!!state.extras[c.dataset.val])));
    const anyFeet = FEET_DEFS.some((d) => state.extras[d.id]); // 'none' lights up when no shoe is worn
    document.querySelectorAll('#bbFeetChips .bb-chip').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.feet === 'none' ? !anyFeet : !!state.extras[c.dataset.feet])));
    document.querySelectorAll('#bbBodyChips .bb-chip').forEach((c) => c.setAttribute('aria-pressed', String(!!state.extras[c.dataset.body])));
    document.querySelectorAll('.bb-frame').forEach((f) => f.setAttribute('aria-pressed', String(parseInt(f.dataset.frame, 10) === state.frame)));
    const pb = el('bbPause');
    pb.innerHTML = state.paused ? ICON_PLAY : ICON_PAUSE;
    pb.setAttribute('aria-label', state.paused ? 'Play the dance' : 'Pause the dance');
  }

  // ---- trim helpers ----
  function bboxOf(framesData, W) {
    let minX = W, minY = W, maxX = 0, maxY = 0, found = false;
    for (const data of framesData) for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
      if (data[(y * W + x) * 4 + 3] > 16) { found = true; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
    }
    if (!found) return { x: 0, y: 0, w: W, h: W };
    return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
  }
  function pad(bb, W) {
    const p = Math.round(Math.max(bb.w, bb.h) * 0.04);
    const x = Math.max(0, bb.x - p), y = Math.max(0, bb.y - p);
    return { x, y, w: Math.min(W - x, bb.w + p * 2), h: Math.min(W - y, bb.h + p * 2) };
  }
  function crop(cv, bb) {
    const o = document.createElement('canvas'); o.width = bb.w; o.height = bb.h;
    o.getContext('2d').drawImage(cv, bb.x, bb.y, bb.w, bb.h, 0, 0, bb.w, bb.h); return o;
  }
  function download(href, name) { const a = document.createElement('a'); a.href = href; a.download = name; document.body.appendChild(a); a.click(); a.remove(); }

  // ---- emoji GIF export: ALWAYS transparent, tight-trimmed, no captions ----
  el('bbDownloadGif').onclick = async () => {
    const btn = el('bbDownloadGif'); const label = btn.textContent; btn.disabled = true; btn.textContent = 'Rendering…';
    try {
      await assetsReady();
      const W = 360;
      const frames = [];
      const cv = document.createElement('canvas'); cv.width = W; cv.height = W; const ctx = cv.getContext('2d');
      for (let i = 0; i < NFRAMES; i++) {
        drawComposite(ctx, W, i, {
          bg: 'transparent', captions: false, effect: state.effect,
          hue: state.effect === 'disco' ? (360 * i / NFRAMES) : 0,
        });
        frames.push(ctx.getImageData(0, 0, W, W));
      }
      const bb = pad(bboxOf(frames.map((f) => f.data), W), W);
      const TARGET = 220;
      const s = TARGET / Math.max(bb.w, bb.h);
      const tw = Math.max(2, Math.round(bb.w * s)), th = Math.max(2, Math.round(bb.h * s));
      const delay = Math.max(20, Math.round((state.spd * 1000) / NFRAMES));

      const gif = GIFEncoder();
      const tmp = document.createElement('canvas'); tmp.width = tw; tmp.height = th; const tctx = tmp.getContext('2d');
      let palette = null;
      for (let i = 0; i < NFRAMES; i++) {
        const src = document.createElement('canvas'); src.width = W; src.height = W; src.getContext('2d').putImageData(frames[i], 0, 0);
        tctx.clearRect(0, 0, tw, th);
        tctx.imageSmoothingEnabled = false;
        tctx.drawImage(src, bb.x, bb.y, bb.w, bb.h, 0, 0, tw, th);
        const data = tctx.getImageData(0, 0, tw, th).data;
        for (let k = 3; k < data.length; k += 4) data[k] = data[k] < 110 ? 0 : 255; // 1-bit alpha
        if (!palette) palette = quantize(data, 128, { format: 'rgba4444', oneBitAlpha: true });
        const index = applyPalette(data, palette, 'rgba4444');
        gif.writeFrame(index, tw, th, { palette, delay, transparent: true, dispose: 2 });
      }
      gif.finish();
      const blob = new Blob([gif.bytes()], { type: 'image/gif' });
      download(URL.createObjectURL(blob), 'my-dancing-banana-trymstene.com.gif');
      toast('Emoji GIF downloaded!');
      track('gif_download', { file: 'builder-emoji.gif', design: designStr() });
      saveToShelf();
      passPatch('emoji'); passPatch('maker'); passStat('builds');
    } catch (e) { toast('GIF export hiccup — try again'); console.error(e); }
    finally { btn.disabled = false; btn.textContent = label; }
  };

  // ---- meme GIF export: the WHOLE dance, WITH captions + background + outfit
  // (the outfit rides every drawComposite via the wrapper; here we just turn
  // captions ON and keep the visitor's background, unlike the tight transparent
  // emoji GIF). Solid bg → full square; transparent bg → cropped to content
  // (captions included in the bbox) with 1-bit alpha. ----
  // shared meme-GIF renderer — the download button AND the gallery submission
  // use this, so what Trym reviews is pixel-identical to what visitors save
  // one render path lives in ../lib/meme-gif.js so the desk re-render is
  // pixel-identical to what visitors download here
  async function renderMemeGif() { return memeGif(state); }

  el('bbDownloadMemeGif').onclick = async () => {
    const btn = el('bbDownloadMemeGif'); const label = btn.textContent; btn.disabled = true; btn.textContent = 'Rendering…';
    try {
      const { blob } = await renderMemeGif();
      download(URL.createObjectURL(blob), 'my-dancing-banana-meme-trymstene.com.gif');
      toast('Meme GIF downloaded!');
      track('gif_download', { file: 'builder-meme.gif', design: designStr() });
      saveToShelf();
      passPatch('maker'); passStat('builds');
    } catch (e) { toast('GIF export hiccup — try again'); console.error(e); }
    finally { btn.disabled = false; btn.textContent = label; }
  };

  // ---- meme/sticker PNG export: the PICKED frame, captions + background ----
  el('bbDownloadPng').onclick = async () => {
    await assetsReady();
    const W = 720;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = W; const ctx = cv.getContext('2d');
    drawComposite(ctx, W, state.frame, {
      bg: state.bg, captions: true, effect: state.effect,
      hue: state.effect === 'disco' ? (360 * state.frame / NFRAMES) : 0,
    });
    let out = cv;
    if (state.bg === 'transparent') {
      const data = ctx.getImageData(0, 0, W, W).data;
      out = crop(cv, pad(bboxOf([data], W), W));
    }
    download(out.toDataURL('image/png'), 'my-dancing-banana-trymstene.com.png');
    toast('Image downloaded!');
    track('png_download', { file: 'builder-meme.png', design: designStr() });
    saveToShelf();
    passPatch('maker'); passStat('builds');
  };

  // ---- order it as a REAL printed sticker (Part B) ----
  // Ordering lives on the per-product PDPs (/make-a-banana/<product>/) since
  // 9 Jul — the tiles below navigate there with the design in the URL. All the
  // shared machinery (config, render, mockup, checkout) is in sticker-core.js.

  // ---- localized price on the Sticker tile: exactly what checkout charges
  // (shared sticker-core fetch: Worker /geo → Shopify @inContext). Any failure
  // leaves the static "$14.99" fallback in place.
  (async () => {
    const lp = await localizedPrice();
    if (!lp) return;
    const badge = el('bbPrice'); if (badge) badge.textContent = lp.display;
  })();

  // the picker: tap a product tile → go to that product's page. Sticker opens
  // its real PDP (same look as the shop, preview + checkout there); magnet is
  // shown but lands when its Printful backend is wired — never a dead-end.
  function goToProduct(prod) {
    sync(); // make sure the current design is in the URL before we carry it over
    saveToShelf();
    window.location.href = '/make-a-banana/' + prod + '/' + location.search;
  }
  const bbPgrid = el('bbPgrid');
  if (bbPgrid) bbPgrid.addEventListener('click', (e) => {
    const tile = e.target.closest('.bb-ptile'); if (!tile) return;
    const prod = tile.dataset.prod;
    track('product_tile_click', withSecs({ product: prod }));
    if (tile.hasAttribute('data-soon')) { // teaser product — not sellable yet
      const name = (tile.querySelector('.bb-ptile__name') || {}).textContent || 'That one';
      toast(name + 's land any day now \u{1F34C} — the sticker’s ready to order today');
      return;
    }
    goToProduct(prod);
  });
  // ---- scroll-visibility truth (Trym's CRO question: does anyone even SEE
  // the order button on mobile?): fire ONE section_seen per section per load
  // when it's half-visible. placement is a registered GA4 custom dimension,
  // so "saw the button ÷ builder_start" is a real, queryable rate.
  if ('IntersectionObserver' in window) {
    const seen = new Set();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        const place = en.target.dataset.seenPlace;
        if (seen.has(place)) return;
        seen.add(place);
        track('section_seen', { placement: place });
        io.unobserve(en.target);
      });
    }, { threshold: 0.5 });
    [['bbQuickSticker', 'order_btn_top'], ['bbTakeTitle', 'take_it'], ['bbPgrid', 'tiles']]
      .forEach(([id, place]) => {
        const t = el(id);
        if (t) { t.dataset.seenPlace = place; io.observe(t); }
      });
  }

  // exposed for debugging + future flows
  window.__bananaBuilder = { state, drawComposite, bboxOf, pad, crop, assetsReady, FRAMES, PACKS };

  // ---- boot ----
  load();

  // ---- OBS overlay mode (after load() so it can override the defaults) ----
  // ?overlay=1 (usually reached via /overlay/) strips all chrome via CSS on
  // <html> and leaves just the dancing banana on a transparent page — sized
  // for an OBS/streaming browser source. ?daily seeds the outfit from the
  // UTC date: same banana-of-the-day for everyone, changes at midnight.
  const urlP = new URLSearchParams(location.search);
  if (urlP.get('overlay') === '1') {
    document.documentElement.classList.add('bb-overlay');
    state.paused = false; // an overlay must dance, reduced-motion or not
    if (urlP.has('daily')) {
      // shared with /banana-of-the-day/ (built server-side) — same date,
      // same banana, everywhere. Algorithm lives in src/lib/banana-daily.js.
      const o = dailyOutfit();
      state.hat = o.hat; state.glasses = o.glasses;
      state.extras = o.extras; state.effect = o.effect;
    }
  }

  refreshUI();
  passVisit();
  // shelf 🏷 tags land here: walk the visitor straight to the sticker card
  if (urlP.get('go') === 'sticker') {
    const grid = el('bbPgrid');
    const card = grid && grid.closest('.bb-card');
    if (card) setTimeout(() => {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.classList.add('bb-card--pulse');
      track('shelf_sticker_land');
    }, 400);
  }
  // captions live behind a fold — open it when a share link arrives wearing them
  if (state.top || state.bottom) { const f = el('bbCaptionsFold'); if (f) f.open = true; }
  // assetsReady() waits on load/error events, not sheet.decode() — decode() can
  // hang forever on a cache-served image in Chromium and would stall boot.
  assetsReady().finally(() => {
    recomputeEmojiBB(); drawPicker(); drawTiles(); dirty = true;
    requestAnimationFrame(tick);
    // TRUE boot signal (added 14 Jul): fires after the first painted frame —
    // "the banana danced on their screen". builder_start does NOT mean this:
    // it fires on the first CUSTOMIZATION (misread as boot for a while —
    // passive watchers never counted, which made ad traffic look broken).
    // secs_since_prev on boot = time from navigation start to the first
    // painted dance frame (the page-load-speed metric); also arms the clock
    requestAnimationFrame(() => {
      stepSecs(); // arm the clock at boot; boot latency comes from performance
      track('builder_boot', { secs_since_prev: Math.min(1800, Math.round(performance.now() / 1000)) });
    });
  });
}
