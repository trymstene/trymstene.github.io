// 🗺️ THE INFORMATION KIOSK — a rack of maps and one flyer (Trym, 20 Sep 2026).
//
// "i think the info kiosk can open a nice interactive view of each area of banana world — world maps
// of all areas, thumbnails first, and you can click and zoom around on a bigger version … mobile
// friendlyness here is important — swiping and zooming and so on. It can all be in a popup i think —
// bigger popup for desktop. Also for the Rave — not needed with a map for that area — but more like a
// promotional image of the Rave, can maybe look like a Flyer."
//
// ⭐ THIS IS THE FIRST THING IN BANANA WORLD THAT SAYS WHAT IS IN IT. Everything else teaches by being
// walked into; the kiosk is the one surface that can show a stranger the whole place at once. That is
// why it opens at Struggling and not at Thriving — a town worth exploring should tell you so early.
//
// ⚠️ 261 × 440 CSS px is the phone budget: the measured content box of a town card at 360×640, the
// narrowest phone the house supports. The desktop card grows (public/css/town-info.css) and nothing
// here may assume it has.
//
// ⚠️ THE MAPS ARE BAKED, NOT SCREENSHOTTED. tools/build-area-maps.py composites each area's plate with
// its own OVERLAYS in the game's own painter's-algorithm order. So a map cannot drift from the place —
// re-bake the area, re-bake the map.
//
// ⚠️ NOBODY WORKS HERE. Trym: "You cant work in the kiosk." The banana in the kiosk window belongs to
// town-room.js and is the kiosk being open, not a person with a card. Nothing in this file speaks.
import { drawComposite, assetsReady } from '../lib/banana-engine.js';
import { drawable } from '../lib/wardrobe-slots.js';

// ⭐ GLOBBED INSIDE THE KIOSK'S OWN LAZY CHUNK, so a player who never opens the maps never downloads
// a byte of this — the same rule the dressing room and the post office follow.
const COPY_MODS = import.meta.glob('../data/copy/town-info.json', { eager: true, import: 'default' });
export const COPY = Object.values(COPY_MODS)[0] || {};

// the four baked maps, in the order the rack hangs them: where you are, then outward
const AREAS = [
  { key: 'town', w: 1400, h: 827 },
  { key: 'park', w: 1400, h: 558 },
  { key: 'bay', w: 1400, h: 558 },
  { key: 'homestead', w: 1400, h: 856 },
];
const SRC = (k, thumb) => '/assets/world/map-' + k + (thumb ? '-thumb' : '') + '.png';

const MIN_Z = 1, MAX_Z = 4;
// the headliner's kit: the rave's own DJ headphones (a hat that turns with the head) and shades
const DJ = { hat: 'djheadphones', glasses: 'shades', extras: {} };
const CV = 150;   // the flyer's DJ, drawn at the size it is shown
const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function bootTownInfo(ctx) {
  const { openCard, card, track, shut } = ctx;
  let at = '';            // '' = the rack, an area key = that map, 'rave' = the flyer
  let raf = 0, g = null, t0 = 0;
  // the view on an open map, in map pixels: a scale and a top-left offset
  let z = 1, ox = 0, oy = 0, box = null, img = null;

  // ── the rack ────────────────────────────────────────────────────────────────────────────────────
  const tile = (key, name, thumb) => '<button type="button" class="tw-info__tile" data-go="' + esc(key) + '">'
    + '<img class="tw-info__shot" src="' + esc(thumb) + '" alt="" loading="lazy" decoding="async">'
    + '<b class="tw-info__name">' + esc(name) + '</b></button>';

  function rackHtml() {
    const a = COPY.areas || {};
    const r = COPY.rave || {};
    return '<div class="tw-info__rack">'
      + AREAS.map((x) => tile(x.key, (a[x.key] || {}).name || x.key, SRC(x.key, true))).join('')
      // 🪩 the fifth tile is not a map and does not pretend to be one: it is a poster, pinned in the
      // same rack, and it wears the flyer's own colours so it reads as paper of a different kind
      + '<button type="button" class="tw-info__tile is-flyer" data-go="rave">'
      // ⚠️ NO NAME STRIP UNDER THIS ONE. The four maps need a caption because a thumbnail of a place
      // is not its name; the poster IS its name, set large, and printing it again underneath reads as
      // a mistake rather than as a label.
      + '<span class="tw-info__poster"><i>' + esc(r.tonight || '') + '</i><b>' + esc(r.name || '') + '</b></span></button>'
      + '</div>';
  }

  // ── an open map ─────────────────────────────────────────────────────────────────────────────────
  const backBtn = () => (COPY.back ? '<button type="button" class="tw-info__back" id="twInfoBack">' + esc(COPY.back) + '</button>' : '');

  function mapHtml(key) {
    const a = (COPY.areas || {})[key] || {};
    return '<div class="tw-info__open">'
      + '<b class="tw-info__title">' + esc(a.name || '') + '</b>'
      + '<div class="tw-info__view" id="twInfoView">'
      + '<img class="tw-info__map" id="twInfoMap" src="' + esc(SRC(key)) + '" alt="' + esc(a.name || '') + '" draggable="false">'
      + '</div>'
      + (a.line ? '<p class="tw-card__sub">' + esc(a.line) + '</p>' : '')
      + backBtn() + '</div>';
  }

  // 🪩 THE FLYER. Not a map and not a card: a poster, so it is built out of type and one banana
  // rather than out of rows.
  //
  // ⭐ THE BANANA ON IT IS THE HEADLINER, NOT THE PLAYER. A poster shows you who is ON — it is the
  // top name on the bill given a face — so the outfit is fixed: the rave's own DJ headphones and a
  // pair of shades, the same on every phone, every day. Drawing the player here would have made the
  // flyer a mirror, and a mirror is what the dressing room is for.
  // ⚠️ drawComposite wants a WHOLE outfit or it throws on the first extra it looks for, so this
  // goes through drawable() like every other banana in the world.
  function flyerHtml() {
    const r = COPY.rave || {};
    return '<div class="tw-info__open tw-info__flyer">'
      + '<div class="tw-info__bill">'
      + '<i class="tw-info__when">' + esc(r.tonight || '') + '</i>'
      + '<b class="tw-info__big">' + esc(r.name || '') + '</b>'
      + '<canvas class="tw-info__dj" id="twInfoDj" width="' + CV + '" height="' + CV + '" aria-hidden="true"></canvas>'
      + '<ol class="tw-info__acts">' + (r.bill || []).map((b, i) => '<li' + (i ? '' : ' class="is-top"') + '>' + esc(b) + '</li>').join('') + '</ol>'
      + (r.lines || []).map((l) => '<p>' + esc(l) + '</p>').join('')
      + '<i class="tw-info__door">' + esc(r.door || '') + '</i>'
      + '</div>' + backBtn() + '</div>';
  }

  function html() {
    if (shut && shut()) return '<div class="tw-info">' + head() + '<p class="tw-info__none">' + esc(COPY.shut || '') + '</p></div>';
    if (at === 'rave') return '<div class="tw-info">' + head() + flyerHtml() + '</div>';
    if (at) return '<div class="tw-info">' + head() + mapHtml(at) + '</div>';
    return '<div class="tw-info">' + head() + rackHtml()
      + (COPY.line ? '<p class="tw-card__sub">' + esc(COPY.line) + '</p>' : '') + '</div>';
  }
  const head = () => (COPY.title ? '<h2>' + esc(COPY.title) + '</h2>' : '');

  // ── the pan and the pinch ───────────────────────────────────────────────────────────────────────
  // ⚠️ POINTER EVENTS, NOT TOUCH EVENTS. One code path then serves a thumb, a mouse and a pen, and the
  // pointer ids give the pinch its two fingers for free. `touch-action: none` on the viewport (see
  // town-info.css) is what stops the browser scrolling the card out from under the drag.
  const pts = new Map();
  let pinch = 0, pinchZ = 1, pinchAt = null;

  function clamp() {
    if (!box || !img) return;
    const w = img.naturalWidth || 1, h = img.naturalHeight || 1;
    const fit = Math.min(box.width / w, box.height / h);   // the scale at which the whole map is in view
    const sw = w * fit * z, sh = h * fit * z;
    // ⭐ A MAP SMALLER THAN ITS WINDOW IS CENTRED, NOT PINNED. At z = 1 one of the two axes always has
    // slack (the maps are wider than the card), and letting it sit at 0 leaves the map against one
    // edge with a black bar down the other — which reads as a broken image rather than as a map.
    ox = sw <= box.width ? (box.width - sw) / 2 : Math.min(0, Math.max(box.width - sw, ox));
    oy = sh <= box.height ? (box.height - sh) / 2 : Math.min(0, Math.max(box.height - sh, oy));
    img.style.width = sw + 'px';
    img.style.height = sh + 'px';
    img.style.transform = 'translate(' + ox + 'px,' + oy + 'px)';
  }

  function zoomTo(nz, cx, cy) {
    const old = z;
    z = Math.max(MIN_Z, Math.min(MAX_Z, nz));
    if (z === old) return;
    // keep the point under the fingers (or the cursor) where it was
    ox = cx - (cx - ox) * (z / old);
    oy = cy - (cy - oy) * (z / old);
    clamp();
  }

  function wireMap() {
    const view = card.querySelector('#twInfoView');
    img = card.querySelector('#twInfoMap');
    if (!view || !img) return;
    const size = () => { box = view.getBoundingClientRect(); };
    const local = (e) => { const b = view.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; };
    // ⭐ THE WINDOW TAKES THE MAP'S OWN SHAPE. Every map is wider than it is tall and the card is the
    // other way round, so a fixed window fitted each one into a letterbox with black above and below
    // it — on a phone, more black than map. The window is given the map's aspect ratio the moment the
    // image knows its own size, and the stylesheet caps how tall that may get.
    const fit = () => {
      z = 1; ox = 0; oy = 0;
      const w = img.naturalWidth, h = img.naturalHeight;
      if (w && h) view.style.aspectRatio = w + ' / ' + h;
      size(); clamp();
      // ⚠️ an aspect ratio only lands after a layout pass, so the box is measured again next frame
      requestAnimationFrame(() => { size(); clamp(); });
    };
    if (img.complete && img.naturalWidth) fit(); else img.addEventListener('load', fit, { once: true });
    size();

    view.addEventListener('pointerdown', (e) => {
      view.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, local(e));
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        pinch = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        pinchZ = z;
        pinchAt = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      }
    });
    view.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) return;
      const p = local(e), was = pts.get(e.pointerId);
      pts.set(e.pointerId, p);
      if (pts.size >= 2 && pinch) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        zoomTo(pinchZ * (d / pinch), pinchAt.x, pinchAt.y);
        return;
      }
      ox += p.x - was.x; oy += p.y - was.y;
      clamp();
    });
    const up = (e) => {
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = 0;
      try { view.releasePointerCapture(e.pointerId); } catch (err) {}
    };
    view.addEventListener('pointerup', up);
    view.addEventListener('pointercancel', up);
    // 🖱 a wheel on a desktop, and a double tap on a phone: the two ways everybody already knows
    view.addEventListener('wheel', (e) => { e.preventDefault(); const p = local(e); zoomTo(z * (e.deltaY < 0 ? 1.18 : 1 / 1.18), p.x, p.y); }, { passive: false });
    view.addEventListener('dblclick', (e) => { const p = local(e); zoomTo(z > 1.2 ? 1 : 2.2, p.x, p.y); });
    window.addEventListener('resize', fit);
    view.__fit = fit;
  }

  // ── the flyer's DJ ──────────────────────────────────────────────────────────────────────────────
  function paint(now) {
    raf = 0;
    if (!g) return;
    if (!t0) t0 = now;
    const f = Math.floor(((now - t0) / 150) % 4);   // dancing, not strolling: the rave's own tempo
    g.clearRect(0, 0, CV, CV);
    try { drawComposite(g, CV, f, drawable(DJ)); } catch (e) {}
    raf = requestAnimationFrame(paint);
  }
  const wake = () => { if (!raf && g) raf = requestAnimationFrame(paint); };
  const sleep = () => { if (raf) { cancelAnimationFrame(raf); raf = 0; } g = null; };

  function render() {
    sleep();
    const body = card.querySelector('#twCardBody') || card;
    body.innerHTML = html();
    card.scrollTop = 0;
    if (at && at !== 'rave') wireMap();
    if (at === 'rave') {
      const cv = card.querySelector('#twInfoDj');
      g = cv ? cv.getContext('2d') : null;
      t0 = 0;
      assetsReady().then(wake).catch(() => {});
      wake();
    }
    card.querySelectorAll('.tw-info__tile').forEach((b) => b.addEventListener('click', () => {
      at = b.dataset.go;
      track('town_info', { at: 'info', step: at === 'rave' ? 'flyer' : 'map', id: at });
      render();
    }));
    const back = card.querySelector('#twInfoBack');
    if (back) back.addEventListener('click', () => { at = ''; render(); });
  }

  function open() {
    at = '';
    openCard(html());
    card.classList.add('tw-card--info');
    render();
    track('town_info', { at: 'info', step: 'open' });
    return true;
  }

  return {
    open,
    stop: () => { sleep(); pts.clear(); },
    seam: {
      open,
      at: () => at,
      go: (k) => { const b = card.querySelector('.tw-info__tile[data-go="' + k + '"]'); if (b) b.click(); return !!b; },
      back: () => { const b = card.querySelector('#twInfoBack'); if (b) b.click(); return !!b; },
      view: () => ({ z, ox: Math.round(ox), oy: Math.round(oy) }),
      zoom: (nz) => { if (!box) return null; zoomTo(nz, box.width / 2, box.height / 2); return { z, ox: Math.round(ox), oy: Math.round(oy) }; },
      pan: (dx, dy) => { ox += dx; oy += dy; clamp(); return { z, ox: Math.round(ox), oy: Math.round(oy) }; },
      maps: () => AREAS.map((a) => a.key),
    },
  };
}
