// 👻 CHAPTER TWO'S PICTURES — what its scenes SHOW, and the last night (27–28 Sep 2026).
//
// Loaded by world-quest.js loadC2() beside the chapter's table and its words, so a player still in chapter one downloads
// none of it; its look is public/css/quest-c2.css, loaded the same way. The props are drawn in the page rather than on
// a canvas because their words are the copy file's (a prop line's text is what is printed on it), and text in the page
// wraps, scales and reads.
// ⚠️ NOTHING HERE EVER WRITES THE FIRST BANANA'S NAME: the page's ink is handwriting that spells nothing, the plaque's
// front is scraped, the flyer's host is torn off.
import { drawComposite, assetsReady } from './banana-engine.js';

const NPC = { hat: 'none', glasses: 'none', extras: {}, top: '', bottom: '', bg: 'transparent', captions: false, effect: 'none' };

// ⛲ the town's own statue (build-town-scene.py draws it as ov-51, 110 × 206 — tools/check-quest-c2.mjs holds the size)
// and, for a statue that runs, the park fountain's six frames of water laid over it (tools/build-statue-water.py)
const statue = (water) => '<span class="bwq-statue"><img alt="" src="/assets/town/ov-51.png">'
  + (water ? '<span class="bwq-statue__water"></span>' : '') + '</span>';

// ✍️ HANDWRITING THAT SPELLS NOTHING (28 Sep 2026: the first ink read as a scribble, and a drawn glyph can read as a real
// letter). Each letter-slot is one of seven motifs — loops and waves, none of them a Latin letter on its own — smoothed
// through its points and joined to the next, so there is never a gap to read a letter in.
const MOTIF = [
  [[0, 0], [2.2, -7], [3.8, -12.5], [2.4, -13.4], [1.4, -8], [3.4, -2], [6.2, -1.4], [8.4, -3.2]],
  [[0, 0], [1.4, -3.6], [3, -4.6], [4, -2], [3.2, -0.8], [5, -3.6], [6.8, -4.8], [7.8, -1.2], [9.4, -0.4]],
  [[0, 0], [2.4, -5.2], [0.6, -4], [2, -1.6], [4.8, -5.8], [6.2, -1.6], [8.6, -0.6]],
  [[0, 0], [1.6, -3.4], [3.4, -3.2], [3.2, 2.6], [2, 6.4], [0.8, 4.4], [3.8, 0.4], [6.6, -1.8]],
  [[0, 0], [2.6, -3.6], [4.8, -7.4], [5.4, -3.8], [3.6, -1.8], [6.2, 0.2], [8.2, -2.6]],
  [[0, 0], [1.2, -2.8], [2.8, -3.6], [3.4, -1.2], [4.6, -4.2], [5.8, -8.8], [6.2, -4.4], [8.4, -0.8]],
  [[0, 0], [2.2, -2.4], [3.2, -6.2], [1.8, -6.6], [2.6, -2.2], [5.4, -0.8], [7.4, -3.4], [9, -1.2]],
];
const SLOT = 20, X0 = 28, BASE = 25;
const f1 = (v) => v.toFixed(1);
// the writing from slot `from` up to (not including) `to`, as one Catmull-Rom curve through every point
function scribble(from, to) {
  const p = [];
  for (let i = from; i < to; i++) {
    const m = MOTIF[(i * 3 + 1) % MOTIF.length], ox = X0 + i * SLOT;
    for (const [x, y] of m) p.push([ox + x * 2.1, BASE + y * 1.75]);
  }
  let d = 'M' + f1(p[0][0]) + ' ' + f1(p[0][1]);
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i - 1] || p[i], b = p[i], c = p[i + 1], e = p[i + 2] || c;
    d += 'C' + f1(b[0] + (c[0] - a[0]) / 6) + ' ' + f1(b[1] + (c[1] - a[1]) / 6) + ' ' + f1(c[0] - (e[0] - b[0]) / 6)
      + ' ' + f1(c[1] - (e[1] - b[1]) / 6) + ' ' + f1(c[0]) + ' ' + f1(c[1]);
  }
  return '<path class="bwq-ink" d="' + d + '"/>';
}
const inked = (cls, from, to) => scribble(from, to).replace('bwq-ink', 'bwq-ink ' + cls);
// Plot 11's page: Nib's own scratch through the line, his two taps in front of it, and the name coming back above it —
// dry, the newest letter still wet and running (page); whole and too bright to read (glow); run off again (blank); or
// seen close, where the scratch begins (dots)
function inkPage(kind) {
  const H = kind === 'blank' ? 70 : 64;
  const scratch = 'M24 36' + Array.from({ length: 19 }, (_, i) => 'L' + (32 + i * 8) + ' ' + (i % 2 ? 39 : 29)).join('');
  let ink = '';
  if (kind === 'page') {
    const x = X0 + 5 * SLOT - 6;
    ink = inked('is-dry', 0, 4) + inked('is-wet', 4, 5)
      + '<path class="bwq-drip-line" d="M' + x + ' ' + (BASE + 1) + 'c0.6 8 -0.8 17 0.3 ' + (H - BASE - 9) + '"/>'
      + '<circle class="bwq-drip-end" cx="' + (x + 0.3) + '" cy="' + (H - 6.5) + '" r="2"/>';
  } else if (kind === 'glow') {
    ink = inked('is-whole', 0, 7)
      + '<defs><radialGradient id="bwqG"><stop offset="0" stop-color="#fffbe6"/><stop offset=".55" stop-color="#ffe89a" stop-opacity=".92"/>'
      + '<stop offset="1" stop-color="#ffe89a" stop-opacity="0"/></radialGradient></defs>'
      + '<ellipse cx="' + (X0 + 3.5 * SLOT) + '" cy="' + (BASE - 5) + '" rx="' + (3.9 * SLOT) + '" ry="17" fill="url(#bwqG)"/>';
  } else if (kind === 'blank') {
    ink = inked('is-gone', 0, 7);
    for (let i = 0; i < 7; i++) {
      const x = X0 + i * SLOT + 7 + (i % 2);
      ink += '<path class="bwq-run" d="M' + x + ' ' + (BASE - 6) + 'c0.9 10 -0.7 22 0.4 ' + (34 + (i % 3) * 4) + '"/>';
    }
  }
  return '<svg viewBox="' + (kind === 'dots' ? '6 17 44 28' : '0 0 200 ' + H) + '" aria-hidden="true">'
    + '<path class="bwq-scratch" d="' + scratch + '"/><circle class="bwq-tap" cx="13" cy="34" r="1.3"/><circle class="bwq-tap" cx="18" cy="34" r="1.3"/>'
    + ink + '</svg>';
}

export function propEl(kind, text) {
  const el = document.createElement('div');
  el.className = 'bwq-prop bwq-prop--' + kind;
  if (kind === 'page' || kind === 'glow' || kind === 'blank' || kind === 'dots') {
    el.innerHTML = (kind === 'dots' ? '' : '<b></b>') + inkPage(kind);
    if (kind !== 'dots') el.querySelector('b').textContent = text || '';
  } else if (kind === 'statue') {
    // the statue up close: its basin and base, the clean patch where the plaque hung with its four screw holes, and the
    // chalk somebody left on the stone (the line's text)
    el.innerHTML = '<div class="bwq-close">' + statue(0) + '<span class="bwq-close__patch"></span><span class="bwq-close__chalk"></span></div>';
    el.querySelector('.bwq-close__chalk').textContent = text || '';
  } else if (kind === 'fountain') {
    // meanwhile, outside: the statue at night with its water back, and one line under it
    el.innerHTML = '<div class="bwq-cut">' + statue(1) + '</div><p></p>';
    el.querySelector('p').textContent = text || '';
  } else if (kind === 'plaque') {
    // brass, four screws; the front gouged to the metal where the words were, the back engraved (and turned over to show it)
    el.innerHTML = '<p></p>';
    el.classList.toggle('is-scraped', !text);
    el.classList.toggle('is-back', !!text);
    el.querySelector('p').textContent = text || '';
    if (!text) {
      let g = '', r = 7;
      const rnd = () => ((r = (r * 1103515245 + 12345) % 2147483648) / 2147483648);   // the same gouges every time
      for (let i = 0; i < 18; i++) {
        const x = rnd() * 92, y = 4 + rnd() * 30, dx = 6 + rnd() * 16, dy = (rnd() - 0.5) * 7;
        g += '<path d="M' + f1(x) + ' ' + f1(y) + 'l' + f1(dx) + ' ' + f1(dy) + '" stroke="' + (i % 3 ? '#6b4a12' : '#fff1bf') + '" stroke-width="' + (i % 3 ? 0.9 : 0.6) + '"/>';
      }
      el.insertAdjacentHTML('beforeend', '<svg viewBox="0 0 100 38" preserveAspectRatio="none" aria-hidden="true" stroke-linecap="round" opacity=".85">' + g + '</svg>');
    }
  } else if (kind === 'flyer') {
    // the headline's capitals big, the rest of its sentence under them, the small print, and a last line with no full
    // stop is where it tore. ⚠️ split by hand, never a lookbehind: an older Safari fails to PARSE one, and a parse
    // error is the whole module.
    const parts = String(text || '').split('. ').map((p, i, a) => (i < a.length - 1 ? p + '.' : p));
    const torn = /\.$/.test(parts[parts.length - 1] || '.') ? '' : parts.pop();
    const head = parts.shift() || '', big = (head.match(/^[A-Z][A-Z ]*[A-Z](?=\s)/) || [head])[0];
    el.innerHTML = '<h3></h3>' + (big !== head ? '<b></b>' : '') + '<p></p>' + (torn ? '<i></i>' : '');
    el.querySelector('h3').textContent = big;
    if (big !== head) el.querySelector('b').textContent = head.slice(big.length).trim();
    el.querySelector('p').textContent = parts.join(' ');
    if (torn) el.querySelector('i').textContent = torn;
    // …and a little dancing banana in its corner, drawn by the engine every banana in the world is drawn by
    const cv = document.createElement('canvas');
    cv.width = 90; cv.height = 90;
    el.appendChild(cv);
    assetsReady().then(() => { try { drawComposite(cv.getContext('2d'), 90, 3, NPC); } catch (e) {} });
  } else {
    // a note from M.: the Mayor's own small lower-case hand, on black
    el.className = 'bw-paper bwq-mnote';
    el.textContent = text || '';
  }
  return el;
}

// 🎁 a thing handed over and never shown in the scene (Nib's spare lantern): its own sprite, on the receipt
export function giftEl(src) {
  const i = new Image();
  i.src = src; i.alt = ''; i.className = 'bwq-gift';
  return i;
}

// 🌙 THE LAST NIGHT, FOR YOUR EYES ONLY — the questline's one rule: nothing shared changes. In the world: the Ghost Writer
// at the hall's door with its ink still wet under it, a light in the Mayor's window (the town lights it only in the
// evening), and the statue's water, off until the name is whole. On the VIEW, over the town's own dark: the lantern Nib
// gave you, the ghost's cold light and the Mayor's window — a light inside the world is under that dark and came out grey
// (28 Sep). Everything goes into the quest's layer, so the next render clears it; dark() is the moment it all goes.
// o = { w: the panning world, view, layer, unhook, at: quest-c2.js NIGHT, me: () => the player's chest in world px }
export function night(o) {
  const { w, view, layer, at } = o;
  const add = (host, tag, cls, x, y, z) => {
    const el = document.createElement(tag);
    el.className = cls;
    if (x != null) { el.style.left = x / 22 + '%'; el.style.top = y / 13 + '%'; el.style.zIndex = String(z); }
    host.appendChild(el); layer.push(el);
    return el;
  };
  const g = at.ghost;
  // the town's own ghosts that would share this stage step out for the night's scene (town-night.js stepGhosts)
  window.bwqHush = ['knock', 'wisp'];
  o.unhook.push(() => { window.bwqHush = null; });
  // the Ghost Writer faces you: the town ghost's front frames (ghost4 24–31, town/ghosts.js), cold instead of green
  const ghost = add(w, 'div', 'bwq-ghost', g.x, g.y, 100 + g.y + 5);
  ghost.innerHTML = '<img alt="" src="/assets/town/s-ghost4-24.png">';
  const wet = [add(w, 'i', 'bwq-drip bwq-drip--fresh', g.x - 18, g.y + 8, 100 + g.y + 8), add(w, 'i', 'bwq-drip bwq-drip--fresh', g.x + 16, g.y + 16, 100 + g.y + 16)];
  let f = 0;
  const gt = setInterval(() => { f = (f + 1) % 8; const im = ghost.firstChild; if (im) im.src = '/assets/town/s-ghost4-' + (24 + f) + '.png'; }, 160);
  o.unhook.push(() => clearInterval(gt));
  const glow = add(w, 'div', 'tw-glow tw-glow--mayor bwq-mayor', at.glow.x, at.glow.y, 100 + at.glow.base + 3);
  const water = add(w, 'div', 'bwq-water is-dry', at.water.x, at.water.y, 100 + at.water.base + 2);
  const lights = add(view, 'div', 'bwq-lights');
  lights.innerHTML = '<i class="bwq-light bwq-light--lantern"></i><i class="bwq-light bwq-light--ghost"></i><i class="bwq-light bwq-light--window"></i>';
  const [lan, gl, win] = lights.children;
  // a light is pinned to a world point every frame, read off the world's own size and pan (banana-town.js cam())
  const pin = [[lan, o.me], [gl, () => ({ x: g.x, y: g.y - 34 })], [win, () => at.glow]];
  let raf = 0, was = '';
  const tick = () => {
    raf = requestAnimationFrame(tick);
    const s = parseFloat(w.style.width) / 2200 || 1;
    const t = /(-?[\d.]+)px,\s*(-?[\d.]+)px/.exec(w.style.transform || '') || [0, 0, 0];
    for (const [el, p] of pin) { const q = p(); if (q) el.style.transform = 'translate(' + (q.x * s + +t[1]) + 'px,' + (q.y * s + +t[2]) + 'px)'; }
    const k = s.toFixed(3);
    if (k !== was) { was = k; lights.style.setProperty('--s', k); }
  };
  tick();
  o.unhook.push(() => cancelAnimationFrame(raf));
  return {
    // the scene showed a prop: the whole name brings the statue's water back
    prop: (who) => { if (who === 'fountain') water.classList.remove('is-dry'); },
    // 🌑 THE DARK: the Mayor's light out, the ghost and its ink gone, the water stopped, your lantern shaken — and, while
    // the card stands aside, a small window on the statue (off the screen of a phone at the hall) to see it stop
    dark: () => {
      [glow, win, gl].forEach((el) => el.classList.add('is-out'));
      [ghost, ...wet].forEach((el) => el.classList.add('is-gone'));
      water.classList.add('is-dry');
      lan.classList.add('is-gust');
      const ins = add(view, 'div', 'bwq-inset');
      ins.innerHTML = statue(1);
      setTimeout(() => ins.classList.add('is-dry'), 700);
      setTimeout(() => ins.classList.add('is-gone'), 2600);
    },
  };
}
