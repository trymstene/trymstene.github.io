// THE CARD — client side of /pass/: draws the signature banana (from bb-last,
// dancing on the shared wall clock), lights earned patches, fills the gentle
// stats and hosts the Shelf in its true home. CLIENT-ONLY.
import { drawComposite, assetsReady, NFRAMES, BASE_CYCLE_S } from '../lib/banana-engine.js';
import { renderShelf } from '../lib/banana-shelf.js';
import { passGet, passVisit, passToast } from '../lib/banana-pass.js';
import { PATCHES } from '../lib/pass-defs.js';
import { passkeysSupported, linked, savePass, restorePass, pullLatest } from '../lib/pass-sync.js';

const el = (id) => document.getElementById(id);
if (el('psSig')) init();

// same naming as the rave's endurance board — your outfit IS your name
// (duplicated from banana-rave.js on purpose: the rave build must stay lean)
function autoName(o) {
  const adj = (o.extras && o.extras.glowstick ? 'Glowing' : null)
    || { shades: 'Cool', hearts: 'Lovestruck', visor: 'Sporty' }[o.glasses]
    || { disco: 'Disco', sparkle: 'Sparkly', confetti: 'Party' }[o.effect]
    || (o.extras && o.extras.mustache ? 'Distinguished' : 'Fresh');
  const noun = { cowboy: 'Cowboy', crown: 'Royal', tophat: 'Fancy', party: 'Birthday' }[o.hat]
    || (o.extras && o.extras.bowtie ? 'Dapper' : 'Dancing');
  return adj + ' ' + noun + ' Banana';
}

function signatureOutfit() {
  try {
    const saved = JSON.parse(localStorage.getItem('bb-last') || 'null');
    if (saved && typeof saved === 'object') {
      return { hat: saved.hat || 'none', glasses: saved.glasses || 'none', extras: saved.extras || {}, effect: saved.effect || 'none' };
    }
  } catch (e) {}
  return { hat: 'none', glasses: 'none', extras: {}, effect: 'none' };
}

async function init() {
  passVisit();
  if (window.gtag) window.gtag('event', 'pass_view');
  initSync();
  if (linked()) await pullLatest(); // freshest world BEFORE we draw it
  const pass = passGet();
  const outfit = signatureOutfit();

  // — the card —
  el('psName').textContent = autoName(outfit);
  const since = new Date(pass.created);
  el('psSince').textContent = 'member since ' + since.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  // — patches: light the earned, pin the first few to the card —
  const earned = PATCHES.filter((d) => pass.patches[d.id]);
  earned.forEach((d) => {
    const cell = document.querySelector(`.ps-patch[data-patch="${d.id}"]`);
    if (!cell) return;
    cell.classList.add('ps-patch--earned');
    const when = new Date(pass.patches[d.id]);
    cell.querySelector('.ps-patch__date').textContent = when.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  });
  const strip = el('psCardPatches');
  if (earned.length) {
    earned.slice(0, 6).forEach((d) => {
      const src = document.querySelector(`.ps-patch[data-patch="${d.id}"] svg`);
      if (src) strip.appendChild(src.cloneNode(true));
    });
  } else {
    strip.innerHTML = '<span style="font-size:0.72rem;opacity:0.6;">no patches yet — the floor awaits</span>';
  }

  // — gentle stats —
  const S = pass.stats || {};
  const rows = [
    [S.raveMin, 'rave minutes'],
    [S.drops, 'drops survived'],
    [S.fives, 'high-fives'],
    [S.beers, 'happy hours won'],
    [S.vinyls, 'records delivered'],
    [S.builds, 'bananas taken home'],
    [S.forges, 'emojis forged'],
    [pass.days.length, 'days on the pass'],
  ].filter(([n]) => n > 0);
  if (rows.length) {
    el('psStats').innerHTML = rows.map(([n, label]) => `<span class="ps-stat"><b>${n}</b>${label}</span>`).join('');
  }

  // — the shelf, at home —
  renderShelf(el('psShelf'), {
    onPick: (c) => {
      location.href = c.kind === 'emoji' ? '/forge/?shelf=' + c.id : '/make-a-banana/?' + c.params;
    },
  });

  // — the signature banana dances on the shared clock —
  const cv = el('psSig');
  const ctx = cv.getContext('2d');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let lastIdx = -1;
  function tick() {
    const cycleMs = BASE_CYCLE_S * 1000;
    const idx = reduced ? 2 : Math.floor((Date.now() % cycleMs) / (cycleMs / NFRAMES));
    if (idx !== lastIdx) {
      lastIdx = idx;
      drawComposite(ctx, 200, idx, {
        bg: 'transparent', captions: false,
        hat: outfit.hat, glasses: outfit.glasses, extras: outfit.extras, top: '', bottom: '',
        effect: outfit.effect,
      });
    }
    requestAnimationFrame(tick);
  }
  assetsReady().then(() => requestAnimationFrame(tick));

  initShare(outfit);
}

// ---- share my card: the membership card as a 1200×630 PNG ---------------
// (OG dimensions on purpose — it looks right posted anywhere)
function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function svgToImage(svg, px) {
  return new Promise((resolve) => {
    const clone = svg.cloneNode(true);
    clone.setAttribute('width', px);
    clone.setAttribute('height', px);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(clone));
  });
}

async function composeCard(outfit) {
  await assetsReady();
  await document.fonts.ready;
  await document.fonts.load('56px "Archivo Black"').catch(() => {});
  await document.fonts.load('700 24px "Space Grotesk"').catch(() => {});
  const ink = cssVar('--ink', '#111111');
  const paper = cssVar('--paper', '#faf6ee');
  const banana = cssVar('--banana', '#ffd93d');

  const cv = document.createElement('canvas');
  cv.width = 1200; cv.height = 630;
  const ctx = cv.getContext('2d');

  // paper page, ink card with a hard banana shadow — the house style
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, 1200, 630);
  ctx.fillStyle = banana;
  ctx.fillRect(84, 84, 1060, 490);
  ctx.fillStyle = ink;
  ctx.fillRect(70, 70, 1060, 490);

  // the signature banana on its dark checker, banana-framed
  const bx = 120, by = 130, bs = 370;
  for (let yy = 0; yy < bs; yy += 24) {
    for (let xx = 0; xx < bs; xx += 24) {
      ctx.fillStyle = ((xx + yy) / 24) % 2 ? '#2a2340' : '#221c30';
      ctx.fillRect(bx + xx, by + yy, 24, 24);
    }
  }
  const bcv = document.createElement('canvas');
  bcv.width = bcv.height = bs;
  drawComposite(bcv.getContext('2d'), bs, 2, {
    bg: 'transparent', captions: false,
    hat: outfit.hat, glasses: outfit.glasses, extras: outfit.extras, top: '', bottom: '',
    effect: outfit.effect,
  });
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(bcv, bx, by);
  ctx.strokeStyle = banana;
  ctx.lineWidth = 6;
  ctx.strokeRect(bx - 3, by - 3, bs + 6, bs + 6);

  // the words
  const tx = 550;
  ctx.fillStyle = banana;
  ctx.font = '700 24px "Space Grotesk", sans-serif';
  try { ctx.letterSpacing = '4px'; } catch (e) {}
  ctx.fillText('BANANA WORLD MEMBERSHIP', tx, 190);
  try { ctx.letterSpacing = '0px'; } catch (e) {}

  const name = el('psName').textContent;
  ctx.fillStyle = paper;
  let px = 56;
  do { ctx.font = px + 'px "Archivo Black", sans-serif'; px -= 2; }
  while (ctx.measureText(name).width > 540 && px > 26);
  ctx.fillText(name, tx, 260);

  ctx.globalAlpha = 0.7;
  ctx.font = '24px "Space Grotesk", sans-serif';
  ctx.fillText(el('psSince').textContent, tx, 306);
  ctx.globalAlpha = 1;

  // earned patches, straight off the page's own pixel icons
  const svgs = [...document.querySelectorAll('.ps-patch--earned svg')].slice(0, 8);
  const icons = (await Promise.all(svgs.map((s) => svgToImage(s, 56)))).filter(Boolean);
  icons.forEach((img, i) => ctx.drawImage(img, tx + i * 68, 340, 56, 56));

  ctx.fillStyle = paper;
  ctx.globalAlpha = 0.55;
  ctx.font = '22px "Space Grotesk", sans-serif';
  ctx.fillText('get yours: trymstene.com/pass', tx, 520);
  ctx.globalAlpha = 1;

  return cv;
}

function initShare(outfit) {
  const btn = el('psShareCard');
  if (!btn) return;
  let busy = false;
  btn.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    const was = btn.textContent;
    btn.textContent = '📸 Developing…';
    try {
      const cv = await composeCard(outfit);
      const blob = await new Promise((r) => cv.toBlob(r, 'image/png'));
      const file = new File([blob], 'my-banana-pass.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'My Banana Pass' });
        if (window.gtag) window.gtag('event', 'pass_share', { method: 'share' });
      } else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'my-banana-pass.png';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 30000);
        passToast('📸 <b>CARD SAVED</b><br>Post it anywhere — the club takes no attendance.');
        if (window.gtag) window.gtag('event', 'pass_share', { method: 'download' });
      }
    } catch (e) {
      if (!e || e.name !== 'AbortError') passToast('That didn’t work — try again in a moment.');
    }
    btn.textContent = was;
    busy = false;
  });
}

// ---- passkey sync panel ------------------------------------------------
function initSync() {
  const box = el('psSync');
  if (!box || !passkeysSupported()) return; // unsupported → the old device note stands
  box.hidden = false;
  el('psDevice').hidden = true;
  const note = el('psSyncNote');
  const showLinked = () => {
    box.classList.add('ps-sync--linked');
    el('psSyncLead').innerHTML = '<b>🔐 Pass saved.</b> Open <a href="/pass/">trymstene.com/pass</a> on any device, tap “I already have a pass”, and everything follows you.';
    note.textContent = '';
  };
  if (linked()) { showLinked(); return; }

  el('psSave').addEventListener('click', async () => {
    note.textContent = 'Your device will ask to confirm — that’s the passkey being made…';
    try {
      await savePass();
      showLinked();
      passToast('🔐 <b>PASS SAVED</b><br>Your patches and creations now follow you across devices.');
    } catch (e) {
      note.textContent = e && e.name === 'NotAllowedError'
        ? 'No worries — nothing was saved. Try again whenever you like.'
        : 'That didn’t work — try again in a moment.';
    }
  });

  el('psRestore').addEventListener('click', async () => {
    note.textContent = 'Pick the banana-world passkey on your device…';
    try {
      await restorePass();
      passToast('🎫 <b>WELCOME BACK</b><br>Your pass is on this device now.');
      setTimeout(() => location.reload(), 1200); // redraw the card with the merged world
    } catch (e) {
      note.textContent = e && e.name === 'NotAllowedError'
        ? 'No worries — nothing happened.'
        : 'Couldn’t find that pass — did you save it on your other device first?';
    }
  });
}
