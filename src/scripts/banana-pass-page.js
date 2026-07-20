// THE CARD — client side of /pass/: draws the signature banana (from bb-last,
// dancing on the shared wall clock), lights earned patches, fills the gentle
// stats and hosts the Shelf in its true home. CLIENT-ONLY.
import { drawComposite, assetsReady, NFRAMES, BASE_CYCLE_S } from '../lib/banana-engine.js';
import { renderShelf, shelfList } from '../lib/banana-shelf.js';
import { passGet, passVisit, passToast, passPush, passNotices, passNoticesMarkRead, checkGalleryVerdicts, checkCatalogVerdicts } from '../lib/banana-pass.js';
import { PATCHES, GEAR, rankFor, nextRank, levelFor } from '../lib/pass-defs.js';
import { passkeysSupported, linked, savePass, restorePass, pullLatest } from '../lib/pass-sync.js';
import { captionsClean } from '../lib/sticker-core.js';
import { iconSvg } from '../lib/pixel-icons.js';

const el = (id) => document.getElementById(id);
if (el('psSig')) init();

// same naming as the rave's endurance board — your outfit IS your name
// (duplicated from banana-rave.js on purpose: the rave build must stay lean)
function autoName(o) {
  const adj = (o.extras && o.extras.goldbanana ? 'Golden' : null) // the trophy outranks everything
    || (o.extras && o.extras.glowstick ? 'Glowing' : null)
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

  // — the card: YOUR name if you wrote one, the outfit-name otherwise —
  // ✏️ free text is fine HERE (Trym: the premium feel of a real pass): it
  // renders only on this device + the PNG the user shares themselves — no
  // site surface hosts it, so no moderation burden. The rave keeps its
  // outfit-names; the no-free-text-on-the-floor doctrine is untouched.
  const customName = () => { try { return (localStorage.getItem('ps-name-v1') || '').trim().slice(0, 24); } catch (e) { return ''; } };
  const renderName = () => { el('psName').textContent = customName() || autoName(outfit); };
  renderName();
  el('psNameEdit').onclick = () => {
    if (document.getElementById('psNameInput')) return;
    const inp = document.createElement('input');
    inp.id = 'psNameInput';
    inp.maxLength = 24;
    inp.value = customName();
    inp.placeholder = autoName(outfit);
    inp.setAttribute('aria-label', 'Your name on the pass');
    el('psName').replaceChildren(inp);
    inp.focus();
    let closed = false;
    const done = (save) => {
      if (closed) return;
      if (save) {
        const v = inp.value.trim().slice(0, 24);
        if (v && !captionsClean({ top: v })) {
          passToast('Let’s keep it family friendly 🍌 — try another name');
          inp.focus();
          return;
        }
        try { if (v) localStorage.setItem('ps-name-v1', v); else localStorage.removeItem('ps-name-v1'); } catch (e) {}
        passPush(); // the name rides the sync blob to your other devices
        if (v && v !== autoName(outfit)) passToast('🎫 <b>' + v.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</b> — it’s officially your pass now.');
      }
      closed = true;
      renderName();
    };
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') done(true);
      if (e.key === 'Escape') done(false);
    });
    inp.addEventListener('blur', () => done(true));
  };
  const since = new Date(pass.created);
  el('psSince').textContent = 'member since ' + since.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  // — your standing at the club, ON the card: level chip + rep bar —
  const rep = (pass.stats || {}).rep || 0;
  const lv = levelFor(rep);
  const rk = rankFor(lv.level), nx = nextRank(lv.level);
  el('psRank').innerHTML = '<span class="ps-rankchip">LVL ' + lv.level + ' · ' + rk.title.toUpperCase() + '</span>'
    + '<span class="ps-rankbar"><i style="width:' + Math.round((lv.into / lv.need) * 100) + '%"></i></span>'
    + '<span class="ps-ranknote">' + lv.into + ' / ' + lv.need + ' rep'
    + (nx ? ' — next title at level ' + nx.at : ' — top of the ladder') + '</span>';

  // — the official furniture: serial + barcode, same seeded pattern as the
  // share-card PNG (a real document keeps its number) —
  el('psSerial').textContent = 'Nº ' + pass.created.toString(36).toUpperCase();
  drawBarcode(el('psBarcode'), pass.created);

  // — 📯 club notices: verdicts on your gallery submissions (and future news
  // about YOUR stuff). Renders only when there is something to say. —
  renderNotices();
  checkGalleryVerdicts({ force: true }).then(renderNotices);
  checkCatalogVerdicts({ force: true }).then(renderNotices);
  setTimeout(passNoticesMarkRead, 1800); // seen = read (the unread highlight gets its moment)

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
    strip.innerHTML = '<span style="font-size:0.72rem;opacity:0.6;">no badges yet — the floor awaits</span>';
  }

  // — gentle stats (these feed the share card's proud one-liner) —
  const S = pass.stats || {};
  const rows = [
    [S.rep, 'rep at the club'],
    [S.raveMin, 'rave minutes'],
    [S.drops, 'drops survived'],
    [S.jelly, 'jelly collected'],
    [S.hypes, 'jelly times'],
    [S.fives, 'fistbumps'],
    [S.beers, 'happy hours won'],
    [S.vinyls, 'records delivered'],
    [S.builds, 'bananas taken home'],
    [S.forges, 'emojis forged'],
    [pass.days.length, 'days on the pass'],
  ].filter(([n]) => n > 0);

  // shelf counts — power the tab badges AND the overview
  const all = shelfList();
  const nBananas = all.filter((c) => c.kind === 'banana').length;
  const nItems = all.filter((c) => c.kind === 'wearable').length;
  const nEmotes = all.filter((c) => c.kind === 'emoji').length;

  // — OVERVIEW hero: three headline tiles, the three pillars (create · rave ·
  //   collect). Always three, even at zero — a full frontpage that gently
  //   points at what's still to do. —
  const hero = [
    ['🍌', S.builds || nBananas, 'bananas built'],
    ['🪩', S.raveMin || 0, 'rave minutes'],
    ['🏅', earned.length, 'badges earned'],
  ];
  if (el('psHeroStats')) {
    el('psHeroStats').innerHTML = hero.map(([e, n, l]) =>
      `<button type="button" class="ps-herostat" data-goto="stats" aria-label="${n} ${l} — see all your numbers"><b><em>${e}</em>${n}</b><span>${l}</span></button>`).join('');
  }

  // — STATS tab: every number we keep, shown in full (zeros included, so the
  //   gaps read as gentle nudges rather than hidden features) —
  if (el('psStats')) {
    const statAll = [
      [lv.level, 'level'],
      [S.rep || 0, 'rep at the club'],
      [S.raveMin || 0, 'rave minutes'],
      [S.drops || 0, 'drops survived'],
      [S.jelly || 0, 'jelly collected'],
      [S.hypes || 0, 'jelly times'],
      [S.fives || 0, 'fistbumps'],
      [S.beers || 0, 'happy hours won'],
      [S.vinyls || 0, 'records delivered'],
      [S.builds || nBananas, 'bananas taken home'],
      [S.forges || nEmotes, 'emojis forged'],
      [nItems, 'items made'],
      [earned.length, 'badges earned'],
      [pass.days.length, 'days on the pass'],
    ];
    el('psStats').innerHTML = statAll.map(([n, l]) => `<div class="ps-stat"><b>${n}</b><span>${l}</span></div>`).join('');
  }

  // — OVERVIEW recent badges: the latest few earned, deep-linking to the tab —
  const ov = el('psOvBadges');
  if (ov) {
    const recent = earned.slice().sort((a, b) => pass.patches[b.id] - pass.patches[a.id]).slice(0, 4);
    if (recent.length) {
      ov.innerHTML = '';
      recent.forEach((d) => {
        const src = document.querySelector(`.ps-patch[data-patch="${d.id}"] svg`);
        const cell = document.createElement('div');
        cell.className = 'ps-ov-badge';
        if (src) cell.appendChild(src.cloneNode(true));
        const b = document.createElement('b');
        b.textContent = d.title;
        cell.appendChild(b);
        ov.appendChild(cell);
      });
    } else {
      ov.innerHTML = '<p class="ps-ov-empty">No badges yet — most of them hide on the dance floor. <a href="/rave/">Step onto the floor →</a></p>';
    }
  }

  // — creations, SPLIT BY KIND so it's not a junk drawer: bananas (characters)
  //   open in the builder · items (wearables) + emotes open in the forge —
  renderShelf(el('psBananas'), { kinds: ['banana'], emptyMsg: 'No bananas yet — build one in the workshop.',
    onPick: (c) => { location.href = '/make-a-banana/?' + c.params; } });
  renderShelf(el('psItems'), { kinds: ['wearable'], emptyMsg: 'No items yet — make one in the Items Workshop.',
    onPick: (c) => { location.href = '/forge/?shelf=' + c.id; } });
  renderShelf(el('psEmotes'), { kinds: ['emoji'], emptyMsg: 'No emotes yet — draw one in the forge.',
    onPick: (c) => { location.href = '/forge/?shelf=' + c.id; } });

  // — OVERVIEW latest creations: a mixed strip of the newest few, each routed
  //   to its own tool (banana → builder, item/emote → forge) —
  renderShelf(el('psOvCreations'), { limit: 4,
    emptyMsg: 'Nothing yet — build a banana, forge an emoji or make an item and it lands here.',
    onPick: (c) => { location.href = c.kind === 'banana' ? '/make-a-banana/?' + c.params : '/forge/?shelf=' + c.id; } });

  // — tab counts —
  const setCount = (id, n) => { const e = el(id); if (e) e.textContent = n; };
  setCount('cnt-badges', earned.length + '/' + PATCHES.length);
  setCount('cnt-bananas', nBananas);
  setCount('cnt-items', nItems);
  setCount('cnt-emotes', nEmotes);

  // — THE GEAR ROW: earned wearables, toggled straight onto the banana.
  // bb-last is the toggle target (the rave, stickers and share cards all read
  // it) and it rides the sync blob — so gear follows you across devices. —
  function gearEarned(def) {
    if (def.flag) { try { return localStorage.getItem(def.flag) === '1'; } catch (e) { return false; } }
    if (def.patch) return !!pass.patches[def.patch];
    return false;
  }
  function saveOutfit() {
    try { localStorage.setItem('bb-last', JSON.stringify({ hat: outfit.hat, glasses: outfit.glasses, extras: outfit.extras, effect: outfit.effect })); } catch (e) {}
    passPush();
  }
  function renderGear() {
    const host = el('psGear');
    host.innerHTML = '';
    GEAR.forEach((def) => {
      const earned = gearEarned(def);
      // a gear slot is an extras id OR a head slot (hat/glasses)
      const isWorn = () => def.extra ? !!outfit.extras[def.extra]
        : def.hat ? outfit.hat === def.hat
        : def.glasses ? outfit.glasses === def.glasses : false;
      const wearing = earned && isWorn();
      const cell = document.createElement('div');
      cell.className = 'ps-gear__item' + (earned ? ' ps-gear__item--earned' : '');
      const cv = document.createElement('canvas');
      cv.width = cv.height = 168;
      cell.appendChild(cv);
      const h = document.createElement('h3');
      h.textContent = def.title;
      cell.appendChild(h);
      const p = document.createElement('p');
      p.textContent = def.hint;
      cell.appendChild(p);
      if (def.by) { // creator credit rides the item — "by Barty"
        const by = document.createElement('span');
        by.className = 'ps-gear__by';
        by.textContent = 'by ' + def.by;
        cell.appendChild(by);
      }
      if (earned) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'ps-gear__btn' + (wearing ? ' on' : '');
        b.textContent = wearing ? '✓ wearing it' : 'wear it';
        b.addEventListener('click', () => {
          // toggle the item's slot (extras id, or a head slot)
          if (def.extra) outfit.extras[def.extra] = !outfit.extras[def.extra];
          else if (def.hat) outfit.hat = (outfit.hat === def.hat ? 'none' : def.hat);
          else if (def.glasses) outfit.glasses = (outfit.glasses === def.glasses ? 'none' : def.glasses);
          saveOutfit();
          el('psName').textContent = autoName(outfit);
          lastIdx = -1; // the signature banana redraws on its next frame
          renderGear();
          if (window.gtag) window.gtag('event', 'gear_toggle', { gear: def.id, on: isWorn() });
        });
        cell.appendChild(b);
      }
      host.appendChild(cell);
      // a banana MODELS each item (frame 2, the classic pose); unearned slots
      // go grayscale via CSS — the closet doubles as the feature map
      assetsReady().then(() => {
        drawComposite(cv.getContext('2d'), 168, 2, {
          bg: 'transparent', captions: false,
          hat: def.hat || 'none', glasses: def.glasses || 'none',
          extras: def.extra ? { [def.extra]: true } : {}, top: '', bottom: '', effect: 'none',
        });
      });
    });
  }
  renderGear();
  setCount('cnt-gear', GEAR.filter(gearEarned).length);

  initTabs();

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

  initShare(outfit, pass, {
    rankLine: 'LVL ' + lv.level + ' · ' + rk.title.toUpperCase(),
    stats: rows.filter(([, l]) => l !== 'rep at the club').slice(0, 3),
  });
}

// ---- THE DASHBOARD TABS -------------------------------------------------
// The pass card is the persistent "avatar"; these tabs swap the content below
// it (ARIA tab pattern + arrow-key nav + #hash deep-links). Canvases render on
// init regardless of which panel is hidden — a canvas bitmap is independent of
// layout — so nothing needs lazy re-drawing when a tab is first shown.
function initTabs() {
  const tabs = [...document.querySelectorAll('.ps-tab')];
  if (!tabs.length) return;
  const panelOf = (name) => document.getElementById('panel-' + name);
  const names = tabs.map((t) => t.dataset.tab);

  function select(name, focus) {
    if (!names.includes(name)) name = 'overview';
    tabs.forEach((t) => {
      const on = t.dataset.tab === name;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      const p = panelOf(t.dataset.tab);
      if (p) p.hidden = !on;
      if (on && focus) t.focus();
    });
    try { history.replaceState(null, '', '#' + name); } catch (e) { location.hash = name; }
    if (window.gtag) window.gtag('event', 'pass_tab', { tab: name });
  }

  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(t.dataset.tab));
    t.addEventListener('keydown', (e) => {
      let j = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % tabs.length;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === 'Home') j = 0;
      else if (e.key === 'End') j = tabs.length - 1;
      if (j !== null) { e.preventDefault(); select(tabs[j].dataset.tab, true); }
    });
  });

  // anything with data-goto jumps to that tab: the overview's "See all →"
  // links AND the three headline stat tiles (→ the full Stats tab)
  document.querySelectorAll('[data-goto]').forEach((b) => {
    b.addEventListener('click', () => {
      select(b.dataset.goto);
      const p = panelOf(b.dataset.goto);
      if (p) p.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  // open on the hash if the page was linked to a specific tab (#gear …)
  const initial = (location.hash || '').replace('#', '');
  if (initial && names.includes(initial)) select(initial);
}

// ---- the on-page barcode: same seeded pattern family as the share card ----
function drawBarcode(cv, seed) {
  if (!cv) return;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.fillStyle = cssVar('--ink', '#111111');
  let s = (seed % 2147483647) >>> 0 || 7;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  let x = 0;
  while (x < cv.width - 4) {
    const w = 2 + Math.floor(rnd() * 5);
    if (rnd() > 0.42) ctx.fillRect(x, 0, w, cv.height);
    x += w + 2;
  }
}

// ---- 📯 club notices ------------------------------------------------------
function renderNotices() {
  const sec = el('psNoticesSec');
  if (!sec) return;
  const list = passNotices();
  let pend = 0, catPend = 0;
  try {
    pend = (JSON.parse(localStorage.getItem('gal-subs-v1') || '[]') || [])
      .filter((s) => s.status === 'pending' && Date.now() - s.at < 30 * 86400000).length;
  } catch (e) {}
  try {
    catPend = (JSON.parse(localStorage.getItem('cat-subs-v1') || '[]') || [])
      .filter((s) => s.status === 'pending' && Date.now() - s.at < 30 * 86400000).length;
  } catch (e) {}
  if (!list.length && !pend && !catPend) { sec.hidden = true; return; }
  sec.hidden = false;
  const fmt = (t) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  el('psNotices').innerHTML =
    (pend ? '<p class="ps-pendingline">⏳ ' + pend + (pend === 1 ? ' banana is' : ' bananas are')
      + ' with the banana guy for review — the verdict usually lands within 48 hours.</p>' : '')
    + (catPend ? '<p class="ps-pendingline">🎁 ' + catPend + (catPend === 1 ? ' item is' : ' items are')
      + ' with the club for review — approved items become rave drops.</p>' : '')
    + list.map((n) => '<div class="ps-notice' + (n.read ? '' : ' ps-notice--unread') + '">'
      + '<span class="ps-notice__icon">' + n.icon + '</span>'
      + '<div class="ps-notice__body">' + n.text
      + (n.link ? ' <a href="' + n.link + '">→</a>' : '')
      + '<span class="ps-notice__date">' + fmt(n.at) + '</span></div></div>').join('');
}

// ---- share my card: the membership card as a 1200×630 PNG ---------------
// (OG dimensions on purpose — it looks right posted anywhere). V2 (Trym's
// brief): OFFICIAL and YELLOW — the website's paper/ink/banana identity, not
// the rave's dark dancefloor. Sunburst + confetti behind a BIG tilted banana,
// ink header strip, rank chip, badge tiles, serial + pixel barcode, red
// OFFICIAL stamp. Revealed in our own modal (the OS share sheet is previewless
// on Windows — demoted to an opt-in button, the rave-card pattern).
function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

// deterministic per-pass scatter (confetti + barcode) — same card every render
function seededRand(seed) {
  let s = (seed % 2147483647) >>> 0 || 7;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
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

async function composeCard(outfit, pass, extra) {
  await assetsReady();
  await document.fonts.ready;
  await document.fonts.load('64px "Archivo Black"').catch(() => {});
  await document.fonts.load('800 26px "Space Grotesk"').catch(() => {});
  const ink = cssVar('--ink', '#111111');
  const paper = cssVar('--paper', '#faf6ee');
  const banana = cssVar('--banana', '#ffd93d');
  const white = '#fffdf5';
  const red = '#e22020';

  const cv = document.createElement('canvas');
  cv.width = 1200; cv.height = 630;
  const ctx = cv.getContext('2d');

  // the paper page + a whisper of halftone dots in two corners
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, 1200, 630);
  ctx.fillStyle = 'rgba(17,17,17,0.09)';
  for (let i = 0; i < 60; i++) {
    const gx = i % 12, gy = (i / 12) | 0;
    ctx.beginPath(); ctx.arc(22 + gx * 24, 22 + gy * 24, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(1178 - gx * 24, 608 - gy * 24, 3, 0, Math.PI * 2); ctx.fill();
  }

  // THE CARD: hard ink shadow, banana-yellow face, thick ink frame
  const CX = 56, CY = 62, CW = 1074, CH = 486;
  ctx.fillStyle = ink;
  ctx.fillRect(CX + 16, CY + 16, CW, CH);
  ctx.fillStyle = banana;
  ctx.fillRect(CX, CY, CW, CH);
  ctx.strokeStyle = ink; ctx.lineWidth = 8;
  ctx.strokeRect(CX + 4, CY + 4, CW - 8, CH - 8);

  // header strip + a punched lanyard hole (it's a PASS)
  ctx.fillStyle = ink;
  ctx.fillRect(CX + 8, CY + 8, CW - 16, 60);
  ctx.fillStyle = banana;
  ctx.font = '800 25px "Space Grotesk", sans-serif';
  try { ctx.letterSpacing = '5px'; } catch (e) {}
  ctx.fillText('★ BANANA WORLD · OFFICIAL MEMBERSHIP PASS', CX + 34, CY + 48);
  try { ctx.letterSpacing = '0px'; } catch (e) {}
  ctx.beginPath(); ctx.arc(CX + CW - 46, CY + 38, 12, 0, Math.PI * 2);
  ctx.fillStyle = paper; ctx.fill();
  ctx.strokeStyle = banana; ctx.lineWidth = 4; ctx.stroke();

  // sunburst rays + confetti behind the banana — clipped inside the frame
  const rnd = seededRand(pass.created || 7);
  ctx.save();
  ctx.beginPath(); ctx.rect(CX + 12, CY + 68, CW - 24, CH - 80); ctx.clip();
  ctx.save();
  ctx.translate(918, 316);
  for (let i = 0; i < 12; i++) {
    ctx.rotate(Math.PI / 6);
    ctx.fillStyle = 'rgba(255,253,245,0.5)';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-44, -560); ctx.lineTo(44, -560); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  const CONF = [ink, red, '#2f7fd1', white];
  for (let i = 0; i < 22; i++) {
    ctx.fillStyle = CONF[i % 4];
    ctx.globalAlpha = 0.4 + (i % 4) * 0.12;
    ctx.fillRect(660 + Math.floor(rnd() * 46) * 10, CY + 84 + Math.floor(rnd() * ((CH - 140) / 10)) * 10, 9, 9);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // THE BANANA — big, tilted the friendly way (+8°, mirroring the rave card's
  // lean), hat poking OVER the frame onto the paper, feet on the bottom frame
  const bcv = document.createElement('canvas');
  bcv.width = bcv.height = 1024;
  drawComposite(bcv.getContext('2d'), 1024, 2, {
    bg: 'transparent', captions: false, top: '', bottom: '',
    hat: outfit.hat, glasses: outfit.glasses, extras: outfit.extras, effect: outfit.effect,
  });
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(918, 296);
  ctx.rotate(8 * Math.PI / 180);
  ctx.drawImage(bcv, -260, -260, 520, 520);
  ctx.restore();

  // red rubber stamp across the banana's feet — passport energy
  ctx.save();
  ctx.translate(884, 498);
  ctx.rotate(-8 * Math.PI / 180);
  ctx.globalAlpha = 0.85;
  ctx.strokeStyle = red;
  ctx.lineWidth = 6;
  ctx.strokeRect(-142, -44, 284, 88);
  ctx.lineWidth = 3;
  ctx.strokeRect(-132, -34, 264, 68);
  ctx.fillStyle = red;
  ctx.font = '800 40px "Archivo Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('OFFICIAL', 0, 14);
  ctx.restore();
  ctx.textAlign = 'left';

  // LEFT COLUMN — the member
  const tx = CX + 44;
  const name = el('psName').textContent;
  ctx.fillStyle = ink;
  let px = 62;
  do { ctx.font = px + 'px "Archivo Black", sans-serif'; px -= 2; }
  while (ctx.measureText(name).width > 520 && px > 28);
  ctx.fillText(name, tx, CY + 148);

  ctx.font = '700 22px "Space Grotesk", sans-serif';
  ctx.globalAlpha = 0.8;
  ctx.fillText(el('psSince').textContent.toUpperCase(), tx, CY + 188);
  ctx.globalAlpha = 1;

  // the rank chip — ink slab, yellow type
  if (extra && extra.rankLine) {
    ctx.font = '800 25px "Space Grotesk", sans-serif';
    const w = ctx.measureText(extra.rankLine).width;
    ctx.fillStyle = ink;
    ctx.fillRect(tx - 2, CY + 212, w + 34, 46);
    ctx.fillStyle = banana;
    ctx.fillText(extra.rankLine, tx + 15, CY + 244);
  }

  // badges — white tiles with hard shadows, off the page's own pixel icons
  const svgs = [...document.querySelectorAll('.ps-patch--earned svg')];
  const shown = svgs.slice(0, 6);
  const icons = (await Promise.all(shown.map((s) => svgToImage(s, 44)))).filter(Boolean);
  const byRow = CY + 292;
  ctx.fillStyle = ink;
  ctx.font = '800 17px "Space Grotesk", sans-serif';
  try { ctx.letterSpacing = '3px'; } catch (e) {}
  ctx.fillText('BADGES', tx, byRow - 10);
  try { ctx.letterSpacing = '0px'; } catch (e) {}
  icons.forEach((img, i) => {
    const x = tx + i * 74;
    ctx.fillStyle = ink; ctx.fillRect(x + 4, byRow + 4, 62, 62);
    ctx.fillStyle = white; ctx.fillRect(x, byRow, 62, 62);
    ctx.strokeStyle = ink; ctx.lineWidth = 3; ctx.strokeRect(x + 1.5, byRow + 1.5, 59, 59);
    ctx.drawImage(img, x + 9, byRow + 9, 44, 44);
  });
  if (svgs.length > icons.length) {
    const x = tx + icons.length * 74;
    ctx.fillStyle = ink; ctx.fillRect(x, byRow, 62, 62);
    ctx.fillStyle = banana;
    ctx.font = '800 24px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('+' + (svgs.length - icons.length), x + 31, byRow + 40);
    ctx.textAlign = 'left';
  }
  if (!svgs.length) {
    ctx.globalAlpha = 0.7;
    ctx.font = '700 21px "Space Grotesk", sans-serif';
    ctx.fillText('none yet — the floor awaits', tx, byRow + 38);
    ctx.globalAlpha = 1;
  }

  // gentle stats, one proud line (auto-shrinks; never runs under the banana)
  const stats = (extra && extra.stats) || [];
  if (stats.length) {
    // "1 DAYS ON THE PASS" is not official-document grade — drop the first
    // plural s when the count is 1 (works for every label in the stats list)
    const line = stats.map(([n, l]) => n + ' ' + (n === 1 ? l.replace(/s\b/, '') : l).toUpperCase()).join('  ·  ');
    let sp = 21;
    do { ctx.font = '800 ' + sp + 'px "Space Grotesk", sans-serif'; sp -= 1; }
    while (ctx.measureText(line).width > 530 && sp > 14);
    ctx.fillStyle = ink;
    ctx.fillText(line, tx, CY + 404);
  }

  // serial + pixel barcode — the official furniture
  const serial = 'Nº ' + (pass.created || 0).toString(36).toUpperCase();
  const bcy = CY + CH - 68;
  let bxx = tx;
  ctx.fillStyle = ink;
  while (bxx < tx + 236) {
    const w = 3 + Math.floor(rnd() * 7);
    if (rnd() > 0.42) ctx.fillRect(bxx, bcy, w, 40);
    bxx += w + 3;
  }
  ctx.font = '800 20px "Space Grotesk", sans-serif';
  ctx.fillText(serial, tx + 254, bcy + 28);

  // the caption lives on the PAPER, under the card — museum-label style
  ctx.fillStyle = ink;
  ctx.globalAlpha = 0.75;
  ctx.font = '800 21px "Archivo Black", sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('get yours: trymstene.com/pass', 1144, 610);
  ctx.textAlign = 'left';
  ctx.globalAlpha = 1;

  return cv;
}

// the reveal is OUR modal, not the OS dialog (previewless on Windows — the
// rave card set the pattern); the system sheet stays as an opt-in button
const FILE_NAME = 'my-banana-pass-trymstene.com.png';
function openShareModal(cv) {
  const modal = el('psShareModal');
  el('psShareSlot').replaceChildren(cv);
  modal.hidden = false;
  el('psShareSys').hidden = !navigator.canShare;
  const toBlob = () => new Promise((r) => cv.toBlob(r, 'image/png'));
  el('psShareDl').onclick = async () => {
    const blob = await toBlob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = FILE_NAME;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    if (window.gtag) window.gtag('event', 'pass_share', { method: 'download' });
  };
  el('psShareCopy').onclick = async () => {
    try {
      const blob = await toBlob();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      el('psShareCopy').innerHTML = iconSvg('check', { size: 18 }) + ' Copied — paste it anywhere';
      if (window.gtag) window.gtag('event', 'pass_share', { method: 'copy' });
    } catch (e) {
      el('psShareCopy').textContent = 'Copy blocked — use download';
    }
    setTimeout(() => { el('psShareCopy').innerHTML = iconSvg('copy', { size: 18 }) + ' Copy image'; }, 2500);
  };
  el('psShareSys').onclick = async () => {
    const blob = await toBlob();
    const file = new File([blob], FILE_NAME, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'My Banana Pass' });
        if (window.gtag) window.gtag('event', 'pass_share', { method: 'share' });
      } catch (e) { /* user closed the sheet */ }
    }
  };
}

function initShare(outfit, pass, extra) {
  const btn = el('psShareCard');
  if (!btn) return;
  const closeShare = () => { el('psShareModal').hidden = true; };
  if (el('psShareModal')) {
    el('psShareClose').addEventListener('click', closeShare);
    el('psShareModal').addEventListener('click', (e) => { if (e.target === el('psShareModal')) closeShare(); });
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && !el('psShareModal').hidden) closeShare(); });
  }
  let busy = false;
  btn.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    const was = btn.innerHTML;
    btn.innerHTML = iconSvg('camera', { size: 18 }) + ' Developing…';
    try {
      const cv = await composeCard(outfit, pass, extra);
      openShareModal(cv);
      if (window.gtag) window.gtag('event', 'pass_share', { method: 'open' });
    } catch (e) {
      passToast('That didn’t work — try again in a moment.');
    }
    btn.innerHTML = was;
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
      passToast('🔐 <b>PASS SAVED</b> — your badges and creations follow you across devices');
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
