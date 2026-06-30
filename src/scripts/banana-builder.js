// Dancing Banana builder — preview + exports.
// Bundled by Astro/Vite (so it can import gifenc). Renders the "simple dance"
// to canvas frames and exports a TRIMMED transparent animated GIF (for emoji),
// a trimmed still PNG, and a print-res still (for the sticker order flow).
import { GIFEncoder, quantize, applyPalette } from 'gifenc';

const SVG = {
  classic: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 44" width="120" height="44"><g fill="#111"><rect x="6" y="6" width="44" height="30" rx="9"/><rect x="70" y="6" width="44" height="30" rx="9"/><rect x="50" y="15" width="20" height="7"/></g></svg>',
  // "side visor" variant — used on Classic/Strut where the head is shown at an angle (one wide
  // eye-block, not two forward eyes). A single solid blob read as paint on the face, not glasses,
  // so this is two foreshortened lenses (big near lens + smaller far lens peeking out behind it,
  // with a visible gap/bridge) plus a shine streak so the silhouette reads as glass, not a blot.
  classicSide: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 60" width="120" height="60"><g fill="#111"><rect x="60" y="6" width="36" height="26" rx="10"/><rect x="8" y="16" width="62" height="38" rx="14"/><rect x="58" y="30" width="14" height="8" rx="3"/><rect x="92" y="14" width="20" height="9" rx="4"/></g><rect x="20" y="24" width="9" height="20" rx="3" fill="#fff" opacity="0.55" transform="rotate(18 24 34)"/></svg>',
  party:   '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 92" width="80" height="92"><polygon points="40,4 72,82 8,82" fill="#ff4d6d" stroke="#111" stroke-width="4" stroke-linejoin="round"/><circle cx="40" cy="6" r="7" fill="#ffe135" stroke="#111" stroke-width="3"/><circle cx="28" cy="40" r="4" fill="#fff"/><circle cx="50" cy="58" r="4" fill="#fff"/><circle cx="36" cy="66" r="4" fill="#fff"/></svg>',
  crown:   '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 70" width="100" height="70"><path d="M10 62 L10 24 L30 40 L50 14 L70 40 L90 24 L90 62 Z" fill="#ffd400" stroke="#111" stroke-width="4" stroke-linejoin="round"/><circle cx="50" cy="12" r="5" fill="#ff4d6d" stroke="#111" stroke-width="3"/></svg>',
  tophat:  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 86" width="100" height="86"><rect x="28" y="4" width="44" height="56" fill="#111"/><rect x="8" y="58" width="84" height="13" rx="5" fill="#111"/><rect x="28" y="42" width="44" height="10" fill="#ff4d6d"/></svg>'
};
const VB = { classic:[120,44], classicSide:[120,60], party:[80,92], crown:[100,70], tophat:[100,86] };
// "Cool" = Trym's hand-picked pixel-art "deal with it" shades (real PNGs, pre-trimmed to content
// bbox — the source files have huge transparent padding that would throw off the sizing math).
// coolSide is cropped to just the lens shape (the source also had a long thin temple-arm tail
// trailing off to one side, which dragged the whole image's aspect ratio flat and made it render
// as a thin sliver at any sane width-based scale).
const GLASS_RASTER = {
  coolFront: { src: '/assets/cool-shades-trim.png?v=1', w: 844, h: 172 },
  coolSide:  { src: '/assets/cool-shades-sideways-trim.png?v=2', w: 257, h: 60 },
};

const BGS = ['transparent','#ffe135','#ff4d6d','#6c8cff','#37d67a','#ffffff','#111111','#ff9f1c','#b388ff'];
const GLASSES = [['none','None'],['classic','Classic'],['cool','Cool']];
const HATS = [['none','None'],['party','Party'],['crown','Crown'],['tophat','Top hat']];
const MOVES = [['bounce','Bounce'],['spin','Spin'],['shake','Shake'],['disco','Disco'],['none','Still']];

// accessory sizing
const HAT_W = 0.34, GLASS_W = 0.38;
// poses, each with its own measured accessory anchors (centre x, hat base from top, glasses top).
// glassSide: use the single-lens side-visor (Classic/Strut face at an angle) instead of the
// two-lens frontal pair (Hands-up faces forward). The SVG "Classic" shades and the photo "Cool"
// shades are sized/tilted/flipped/positioned independently (glassScale/glassRot/glassFlip/glassTop
// vs coolScale/coolRot/coolFlip/coolTop) because they're different assets with different native
// proportions and the photo's lens/temple-arm orientation runs the opposite way from the SVG's.
const POSES = [
  { id: 'classic', label: 'Classic',  src: '/assets/banana-classic.png?v=3', hatCx: 0.55, hatBase: 0.28, glassCx: 0.52, glassTop: 0.35, glassSide: true,  glassRot: 8,  glassFlip: false, glassScale: 0.96, coolTop: 0.38, coolScale: 1.35, coolRot: 4,  coolFlip: false },
  { id: 'handsup', label: 'Hands up', src: '/assets/banana-handsup.png?v=3', hatCx: 0.52, hatBase: 0.07, glassCx: 0.50, glassTop: 0.22, glassSide: false, glassRot: 0,  glassFlip: false, glassScale: 1.18, coolTop: 0.22, coolScale: 1.18, coolRot: 0, coolFlip: false },
  { id: 'strut',   label: 'Strut',    src: '/assets/banana-strut.png?v=3',    hatCx: 0.45, hatBase: 0.28, glassCx: 0.48, glassTop: 0.35, glassSide: true,  glassRot: -8, glassFlip: true,  glassScale: 0.96, coolTop: 0.38, coolScale: 1.35, coolRot: -4, coolFlip: true },
];
const curPose = (id) => POSES.find((p) => p.id === id) || POSES[0];
// resolves the right shades asset for a pose + style. 'cool' is a real pixel-art "deal with it"
// PNG — but only on frontal poses (Hands-up): the side crop never sat right on the angled head
// after several sizing/mirroring rounds, so it's parked for a hand-made asset later. Side poses
// fall back to the SVG side-visor for BOTH styles until then. key is either inline SVG markup
// (starts with '<') or an image URL — imgFor()/drawAccSync() handle both transparently.
function usesCoolRaster(pose, style) { return style === 'cool' && !pose.glassSide; }
function glassAsset(pose, style) {
  if (usesCoolRaster(pose, style)) {
    const r = GLASS_RASTER.coolFront;
    return { key: r.src, w: r.w, h: r.h };
  }
  const k = pose.glassSide ? 'classicSide' : 'classic';
  return { key: SVG[k], w: VB[k][0], h: VB[k][1] };
}
const glassScaleFor = (pose, style) => (usesCoolRaster(pose, style) ? pose.coolScale : pose.glassScale);
const glassRotFor = (pose, style) => (usesCoolRaster(pose, style) ? pose.coolRot : pose.glassRot);
const glassTopFor = (pose, style) => (usesCoolRaster(pose, style) ? pose.coolTop : pose.glassTop);
const glassFlipFor = (pose, style) => (usesCoolRaster(pose, style) ? pose.coolFlip : pose.glassFlip);

const el = (id) => document.getElementById(id);
const root = el('bbStage');
if (root) init();

function init() {
  const stage = el('bbStage'), banana = el('bbBanana');
  const topIn = el('bbTopText'), botIn = el('bbBottomText'), speed = el('bbSpeed');

  const state = { pose:'classic', bg:'transparent', top:'', bottom:'', glasses:'none', hat:'none', move:'bounce', spd:0.7 };

  // swatches
  BGS.forEach((c) => {
    const b = document.createElement('button');
    b.className = 'bb-swatch'; b.dataset.bg = c; b.setAttribute('aria-label', c);
    if (c === 'transparent') b.classList.add('bb-swatch--none'); else b.style.background = c;
    b.onclick = () => { state.bg = c; render(); sync(); };
    el('bbSwatches').appendChild(b);
  });
  function chips(host, items, key) {
    items.forEach(([val, label]) => {
      const b = document.createElement('button');
      b.className = 'bb-chip'; b.textContent = label; b.dataset.val = val;
      b.onclick = () => { state[key] = val; render(); sync(); };
      el(host).appendChild(b);
    });
  }
  chips('bbPoseChips', POSES.map((p) => [p.id, p.label]), 'pose');
  chips('bbGlassesChips', GLASSES, 'glasses');
  chips('bbHatChips', HATS, 'hat');
  chips('bbMoveChips', MOVES, 'move');

  topIn.addEventListener('input', () => { state.top = topIn.value; render(); sync(); });
  botIn.addEventListener('input', () => { state.bottom = botIn.value; render(); sync(); });
  speed.addEventListener('input', () => { state.spd = parseFloat(speed.value); render(); sync(); });

  const glassesEl = el('bbGlasses'), hatEl = el('bbHat'), char = el('bbChar');
  const topCap = el('bbTop'), botCap = el('bbBottom');

  function render() {
    const pose = curPose(state.pose);
    if (banana.getAttribute('src') !== pose.src) banana.setAttribute('src', pose.src);
    hatEl.style.left = (pose.hatCx * 100) + '%'; hatEl.style.bottom = ((1 - pose.hatBase) * 100) + '%';
    glassesEl.style.left = (pose.glassCx * 100) + '%'; glassesEl.style.top = (glassTopFor(pose, state.glasses) * 100) + '%';
    glassesEl.style.width = (GLASS_W * 100 * glassScaleFor(pose, state.glasses)) + '%';
    glassesEl.style.transform = 'translateX(-50%) ' + (glassFlipFor(pose, state.glasses) ? 'scaleX(-1) ' : '') + 'rotate(' + glassRotFor(pose, state.glasses) + 'deg)';
    if (state.bg === 'transparent') { stage.classList.add('bb-stage--transparent'); stage.style.background = ''; }
    else { stage.classList.remove('bb-stage--transparent'); stage.style.background = state.bg; }
    topCap.textContent = state.top;
    botCap.textContent = state.bottom;
    if (state.glasses === 'none') glassesEl.hidden = true; else {
      glassesEl.hidden = false;
      const a = glassAsset(pose, state.glasses);
      glassesEl.innerHTML = a.key.charAt(0) === '<' ? a.key : '<img src="' + a.key + '" alt="" style="display:block;width:100%;height:auto" draggable="false">';
    }
    if (state.hat === 'none') hatEl.hidden = true; else { hatEl.hidden = false; hatEl.innerHTML = SVG[state.hat]; }
    char.className = 'bb-char';
    if (state.move !== 'none') { char.classList.add('move-' + state.move); char.style.setProperty('--spd', state.spd + 's'); }
    document.querySelectorAll('.bb-swatch').forEach((s) => s.setAttribute('aria-pressed', s.dataset.bg === state.bg));
    [['bbPoseChips','pose'],['bbGlassesChips','glasses'],['bbHatChips','hat'],['bbMoveChips','move']].forEach(([host, key]) => {
      document.querySelectorAll('#' + host + ' .bb-chip').forEach((c) => c.setAttribute('aria-pressed', c.dataset.val === state[key]));
    });
  }

  // ---- URL state ----
  function sync() {
    const p = new URLSearchParams();
    if (state.pose !== 'classic') p.set('pose', state.pose);
    if (state.bg !== 'transparent') p.set('bg', state.bg);
    if (state.top) p.set('t', state.top);
    if (state.bottom) p.set('b', state.bottom);
    if (state.glasses !== 'none') p.set('g', state.glasses);
    if (state.hat !== 'none') p.set('h', state.hat);
    if (state.move !== 'bounce') p.set('m', state.move);
    if (state.spd !== 0.7) p.set('s', state.spd);
    history.replaceState(null, '', p.toString() ? '?' + p.toString() : location.pathname);
  }
  function load() {
    const p = new URLSearchParams(location.search);
    state.pose = p.get('pose') || 'classic';
    if (p.get('bg')) state.bg = p.get('bg');
    state.top = p.get('t') || ''; state.bottom = p.get('b') || '';
    state.glasses = p.get('g') || 'none'; state.hat = p.get('h') || 'none';
    state.move = p.get('m') || 'bounce'; state.spd = p.get('s') ? parseFloat(p.get('s')) : 0.7;
    topIn.value = state.top; botIn.value = state.bottom; speed.value = state.spd;
  }

  el('bbRandom').onclick = () => {
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const quips = [['HELLO YES',"IT'S THE BANANA GUY"],['B','A N A N A'],['IT IS','WEDNESDAY MY DUDES'],['','PEANUT BUTTER JELLY TIME'],['CERTIFIED','BANANA MOMENT'],['',''],['ME WHEN','THE BANANA']];
    const q = pick(quips);
    state.pose = pick(POSES).id; state.bg = pick(BGS); state.top = q[0]; state.bottom = q[1];
    state.glasses = pick(GLASSES)[0]; state.hat = pick(HATS)[0];
    state.move = pick(MOVES.slice(0, 4))[0]; state.spd = Math.round((0.4 + Math.random() * 0.9) * 100) / 100;
    topIn.value = state.top; botIn.value = state.bottom; speed.value = state.spd; render(); sync();
  };

  let toastT;
  function toast(msg) { const t = el('bbToast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 1800); }

  el('bbShare').onclick = async () => { sync(); try { await navigator.clipboard.writeText(location.href); toast('Share link copied!'); } catch (e) { toast('Copy this URL from the address bar'); } };

  // ---- rendering a single composite frame onto a square canvas of size W ----
  // phase in [0,1) drives the dance. bananaScale = fraction of W the figure height takes.
  function danceTransform(phase) {
    const p = (1 - Math.cos(2 * Math.PI * phase)) / 2; // 0..1..0
    const osc = Math.cos(2 * Math.PI * phase);          // 1..-1..1
    switch (state.move) {
      case 'bounce': return { dx:0, dy:(6 - 14 * p), rot:0, hue:0 };
      case 'spin':   return { dx:0, dy:0, rot:360 * phase, hue:0 };
      case 'shake':  return { dx:-4 * osc, dy:0, rot:-6 * osc, hue:0 };
      case 'disco':  return { dx:0, dy:(6 - 14 * p), rot:0, hue:360 * phase };
      default:       return { dx:0, dy:0, rot:0, hue:0 };
    }
  }

  function drawFrame(ctx, W, phase, withCaptions) {
    ctx.clearRect(0, 0, W, W);
    if (state.bg !== 'transparent') { ctx.fillStyle = state.bg; ctx.fillRect(0, 0, W, W); }
    const bh = W * 0.52, scale = bh / (banana.naturalHeight || 498), bw = (banana.naturalWidth || 469) * scale;
    const bx = (W - bw) / 2, by = (W - bh) / 2;
    const cx = bx + bw / 2, cy = by + bh / 2;
    const t = danceTransform(phase);

    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(t.rot * Math.PI / 180); ctx.translate(-cx, -cy);
    ctx.translate((t.dx / 100) * bw, (t.dy / 100) * bh);
    // banana (crisp pixels; hue for disco)
    ctx.imageSmoothingEnabled = false;
    ctx.filter = t.hue ? `hue-rotate(${t.hue}deg)` : 'none';
    try { ctx.drawImage(banana, bx, by, bw, bh); } catch (e) {}
    ctx.filter = 'none';
    ctx.imageSmoothingEnabled = true;
    // accessories ride along (per-pose anchors)
    const P = curPose(state.pose);
    if (state.hat !== 'none') { const hw = HAT_W * bw, hh = hw * VB[state.hat][1] / VB[state.hat][0]; drawAccSync(ctx, SVG[state.hat], bx + P.hatCx * bw - hw / 2, (by + P.hatBase * bh) - hh, hw, hh); }
    if (state.glasses !== 'none') {
      const a = glassAsset(P, state.glasses);
      const gw = GLASS_W * bw * glassScaleFor(P, state.glasses), gh = gw * a.h / a.w;
      drawAccSync(ctx, a.key, bx + P.glassCx * bw - gw / 2, by + glassTopFor(P, state.glasses) * bh, gw, gh, glassFlipFor(P, state.glasses), glassRotFor(P, state.glasses));
    }
    ctx.restore();

    if (withCaptions) { caption(ctx, W, state.top, true); caption(ctx, W, state.bottom, false); }
  }

  // pre-rasterized accessory images (so canvas draw is synchronous). key is either inline SVG
  // markup or an image URL (real PNG assets, e.g. the Cool shades) — both cache/draw the same way.
  const imgCache = {};
  function imgFor(key) {
    if (imgCache[key]) return imgCache[key];
    const img = new Image();
    img.src = key.charAt(0) === '<' ? 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(key) : key;
    imgCache[key] = img; return img;
  }
  function drawAccSync(ctx, key, dx, dy, dw, dh, flip, rotDeg) {
    const img = imgFor(key); if (!(img.complete && img.naturalWidth)) return;
    if (!flip && !rotDeg) { ctx.drawImage(img, dx, dy, dw, dh); return; }
    ctx.save();
    const ccx = dx + dw / 2, ccy = dy + dh / 2;
    ctx.translate(ccx, ccy);
    if (flip) ctx.scale(-1, 1);
    if (rotDeg) ctx.rotate(rotDeg * Math.PI / 180);
    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
  }

  function caption(ctx, W, text, top) {
    if (!text) return;
    let fs = Math.round(W * 0.095);
    ctx.font = '900 ' + fs + 'px "Archivo Black", Impact, sans-serif';
    while (ctx.measureText(text.toUpperCase()).width > W * 0.92 && fs > 14) { fs -= 2; ctx.font = '900 ' + fs + 'px "Archivo Black", Impact, sans-serif'; }
    ctx.textAlign = 'center'; ctx.textBaseline = top ? 'top' : 'bottom';
    ctx.lineWidth = fs * 0.16; ctx.strokeStyle = '#111'; ctx.fillStyle = '#fff'; ctx.lineJoin = 'round';
    const y = top ? W * 0.035 : W * 0.965;
    ctx.strokeText(text.toUpperCase(), W / 2, y); ctx.fillText(text.toUpperCase(), W / 2, y);
  }

  // union bounding box of non-transparent pixels across frames
  function bboxOf(framesData, W) {
    let minX = W, minY = W, maxX = 0, maxY = 0, found = false;
    for (const data of framesData) for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
      if (data[(y * W + x) * 4 + 3] > 16) { found = true; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
    }
    if (!found) return { x:0, y:0, w:W, h:W };
    return { x:minX, y:minY, w:maxX - minX + 1, h:maxY - minY + 1 };
  }

  async function ensureAssetsReady() {
    const imgs = [banana, ...Object.values(imgCache)];
    await Promise.all(imgs.map((i) => (i.complete && i.naturalWidth) ? Promise.resolve() : i.decode().catch(() => {})));
  }

  // ---- still PNG (trimmed if transparent) ----
  el('bbDownloadPng').onclick = async () => {
    // make sure any selected accessory images are pre-loaded
    if (state.hat !== 'none') imgFor(SVG[state.hat]); if (state.glasses !== 'none') imgFor(glassAsset(curPose(state.pose), state.glasses).key);
    await ensureAssetsReady();
    const W = 720;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = W; const ctx = cv.getContext('2d');
    drawFrame(ctx, W, 0, true);
    let out = cv;
    if (state.bg === 'transparent') {
      const data = ctx.getImageData(0, 0, W, W).data;
      const bb = pad(bboxOf([data], W), W);
      out = crop(cv, bb);
    }
    download(out.toDataURL('image/png'), 'my-dancing-banana.png'); toast('PNG downloaded!');
  };

  // ---- animated GIF (trimmed transparent, for emoji) ----
  el('bbDownloadGif').onclick = async () => {
    const btn = el('bbDownloadGif'); const label = btn.textContent; btn.disabled = true; btn.textContent = 'Rendering…';
    try {
      if (state.hat !== 'none') imgFor(SVG[state.hat]); if (state.glasses !== 'none') imgFor(glassAsset(curPose(state.pose), state.glasses).key);
      await ensureAssetsReady();
      const W = 360;
      const N = state.move === 'none' ? 1 : (state.move === 'spin' ? 24 : 18);
      // render frames (captions included only if present; fine at sticker/post size)
      const frames = [];
      for (let i = 0; i < N; i++) {
        const cv = document.createElement('canvas'); cv.width = W; cv.height = W; const ctx = cv.getContext('2d');
        drawFrame(ctx, W, i / N, true);
        frames.push(ctx.getImageData(0, 0, W, W));
      }
      // trim: transparent -> tight to content+motion; bg -> full square
      let bb = state.bg === 'transparent' ? pad(bboxOf(frames.map((f) => f.data), W), W) : { x:0, y:0, w:W, h:W };
      const TARGET = 220;
      const scale = TARGET / Math.max(bb.w, bb.h);
      const tw = Math.max(2, Math.round(bb.w * scale)), th = Math.max(2, Math.round(bb.h * scale));
      const delay = Math.max(20, Math.round((state.spd * 1000) / N));

      const gif = GIFEncoder();
      const tmp = document.createElement('canvas'); tmp.width = tw; tmp.height = th; const tctx = tmp.getContext('2d');
      let palette = null;
      for (let i = 0; i < N; i++) {
        const src = document.createElement('canvas'); src.width = W; src.height = W; src.getContext('2d').putImageData(frames[i], 0, 0);
        tctx.clearRect(0, 0, tw, th);
        if (state.bg !== 'transparent') { tctx.fillStyle = state.bg; tctx.fillRect(0, 0, tw, th); }
        tctx.imageSmoothingEnabled = false;
        tctx.drawImage(src, bb.x, bb.y, bb.w, bb.h, 0, 0, tw, th);
        const data = tctx.getImageData(0, 0, tw, th).data;
        // 1-bit alpha to avoid fringe
        if (state.bg === 'transparent') for (let k = 3; k < data.length; k += 4) data[k] = data[k] < 110 ? 0 : 255;
        if (!palette) palette = quantize(data, 128, { format: 'rgba4444', oneBitAlpha: state.bg === 'transparent' });
        const index = applyPalette(data, palette, 'rgba4444');
        gif.writeFrame(index, tw, th, { palette, delay, transparent: state.bg === 'transparent', dispose: 2 });
      }
      gif.finish();
      const blob = new Blob([gif.bytes()], { type: 'image/gif' });
      download(URL.createObjectURL(blob), 'my-dancing-banana.gif');
      toast('GIF downloaded! 🍌');
    } catch (e) { toast('GIF export hiccup — try again'); console.error(e); }
    finally { btn.disabled = false; btn.textContent = label; }
  };

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

  // expose the frame drawer for the sticker (print-res) flow later
  window.__bananaBuilder = { state, drawFrame, bboxOf, pad, crop, ensureAssetsReady, imgFor, SVG };

  load(); render();
}
