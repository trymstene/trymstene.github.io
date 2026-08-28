// 📖 THE FIELD GUIDE — one small "how this area works" card per area (park,
// bay, homestead — the rave teaches itself). Game-design information rules
// (Trym, 28 Aug): SHORT and VISUAL — each mechanic is one row of [sprite]
// [verb] [one clause], never a paragraph. Pack art for every row, pixel icon
// for the button, no emoji chrome. Same shared-module shape as world-travel:
// the button joins the area's action bar, the card rides a veil.
import { iconSvg } from './pixel-icons.js';

let cssDone = false;
function injectCss() {
  if (cssDone) return;
  cssDone = true;
  const st = document.createElement('style');
  st.textContent = `
/* a MODAL — above every transient (quest note z900, quest banner z4700) */
.fg-veil { position: fixed; inset: 0; z-index: 5000; display: grid; place-items: center;
  background: rgba(0, 0, 0, 0.55); padding: 16px; }
.fg-veil[hidden] { display: none !important; }
.fg-card { width: min(92vw, 360px); max-height: 86vh; overflow-y: auto; box-sizing: border-box;
  background: #101a10; color: #e8f4e8; border: 4px solid #000; box-shadow: 8px 8px 0 rgba(0, 0, 0, 0.6);
  padding: 1rem 1.1rem 1.15rem; position: relative; }
.fg-card h2 { margin: 0 0 0.15rem; font-size: 0.66rem; font-weight: 800;
  letter-spacing: 0.24em; text-transform: uppercase; opacity: 0.6; text-align: center; }
.fg-card h3 { margin: 0 0 0.75rem; font-family: "Archivo Black", "Space Grotesk", sans-serif;
  font-size: 1.35rem; text-align: center; color: #8de08d; }
.fg-row { display: flex; align-items: center; gap: 0.8rem; padding: 0.5rem 0;
  border-bottom: 2px dashed rgba(255, 255, 255, 0.12); }
.fg-row:last-of-type { border-bottom: none; }
.fg-row__art { width: 42px; height: 42px; flex: none; display: grid; place-items: center; }
.fg-row__art img { max-width: 42px; max-height: 42px; image-rendering: pixelated; }
.fg-row__txt b { display: block; font-size: 0.95rem; }
.fg-row__txt span { display: block; font-size: 0.8rem; opacity: 0.7; line-height: 1.35; }
.fg-close { position: absolute; top: 0.45rem; right: 0.55rem; background: none; border: 0;
  color: #e8f4e8; font-size: 1.3rem; line-height: 1; cursor: pointer; padding: 4px; }`;
  document.head.appendChild(st);
}

/**
 * @param mount    the area's action bar (same one world-travel joins)
 * @param before   sibling to insert the button before (optional)
 * @param btnClass the bar's own button classes, so the guide matches its row
 * @param area     'park' | 'beach' | 'homestead' — rides the open event
 * @param title    the card's big line, e.g. 'the park'
 * @param rows     [{ art: '/assets/…png', verb, line, fw?, fh? }] — ≤6, keep
 *                 it short. fw/fh crop the FIRST FRAME of a sprite strip
 *                 (integer-scaled to fit, pixel-crisp) instead of the sheet.
 */
export function initGuide({ mount, before, btnClass, area, title, rows, track }) {
  if (!mount || !rows || !rows.length) return;
  injectCss();
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = (btnClass || '') + ' fg-btn';
  btn.setAttribute('aria-label', 'field guide — how ' + title + ' works');
  btn.innerHTML = iconSvg('note', { size: 22 });

  let veil = null;
  const close = () => { if (veil) veil.hidden = true; };
  btn.addEventListener('click', () => {
    if (!veil) {   // built on first open — most visits never pay for it
      veil = document.createElement('div');
      veil.className = 'fg-veil';
      veil.innerHTML = '<div class="fg-card" role="dialog" aria-modal="true" aria-label="field guide">'
        + '<button class="fg-close" type="button" aria-label="close">✕</button>'
        + '<h2>field guide</h2><h3>' + title + '</h3>'
        + rows.map((r) => {
          const art = r.fw
            ? (() => {
              const k = Math.max(1, Math.floor(38 / Math.max(r.fw, r.fh)));   // integer scale — fractional pixels stripe
              return '<i style="display:block;width:' + r.fw + 'px;height:' + r.fh + 'px;'
                + 'background:url(' + r.art + ') 0 0 no-repeat;image-rendering:pixelated;'
                + 'transform:scale(' + k + ');transform-origin:center"></i>';
            })()
            : '<img src="' + r.art + '" alt="" loading="lazy" />';
          return '<div class="fg-row">'
            + '<span class="fg-row__art">' + art + '</span>'
            + '<span class="fg-row__txt"><b>' + r.verb + '</b><span>' + r.line + '</span></span>'
            + '</div>';
        }).join('')
        + '</div>';
      veil.addEventListener('click', (e) => { if (e.target === veil) close(); });
      veil.querySelector('.fg-close').addEventListener('click', close);
      addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
      document.body.appendChild(veil);
    }
    veil.hidden = false;
    if (track) track('guide_open', { area });
  });
  mount.insertBefore(btn, (before && before.parentNode === mount) ? before : null);
}
