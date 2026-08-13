// ── 🪪 THE NAMING MOMENT ───────────────────────────────────────────────────
//
// Until now a visitor only got a name if they went looking for the little
// pencil on /pass/. Nobody was ever ASKED — so plants read "sown by a stranger"
// and birdhouses carried nothing, and the world felt anonymous by accident.
//
// ⚠️ THIS IS NOT A SIGNUP WALL, and the whole design turns on that:
//  · it arrives AFTER the thing is already done — the seed is planted, the
//    house is up. Nothing is being gated, so "not now" costs the visitor
//    nothing and costs us nothing.
//  · it asks once. Ever. Answered or dismissed, it does not come back.
//  · it only fires where a name would ACTUALLY BE SHOWN to someone else.
//    Asking on arrival would be a form; asking when your work is about to be
//    labelled is a reason.
//
// ⚠️ NO ENGINE IMPORT. This is shared world UI and must stay cheap — the
// caller passes `paint` if it already has the compositor loaded (the park
// does), and otherwise the card simply shows no banana. See the static-import
// back door in banana-world-engineering.
import { passPush } from './banana-pass.js';

const KEY = 'ps-name-v1';
const ASKED = 'ps-name-asked-v1';

export function myName() {
  try { return (localStorage.getItem(KEY) || '').trim().slice(0, 24); } catch (e) { return ''; }
}

const asked = () => { try { return localStorage.getItem(ASKED) === '1'; } catch (e) { return true; } };
const markAsked = () => { try { localStorage.setItem(ASKED, '1'); } catch (e) {} };

const CSS = `
.bid-veil{ position:fixed; inset:0; z-index:80; display:flex; align-items:center;
  justify-content:center; padding:18px; background:rgba(10,8,4,.62);
  -webkit-backdrop-filter:blur(3px); backdrop-filter:blur(3px); }
.bid-card{ width:100%; max-width:340px; background:#fffdf5; color:#1a1408;
  border:3px solid #1a1408; box-shadow:7px 7px 0 rgba(0,0,0,.45); padding:18px 16px 16px;
  font-family:inherit; text-align:center; }
.bid-face{ width:72px; height:72px; image-rendering:pixelated; display:block; margin:0 auto 6px; }
.bid-card h2{ font-size:1.05rem; margin:0 0 4px; line-height:1.25; }
.bid-card p{ font-size:.82rem; line-height:1.5; margin:0 0 12px; opacity:.8; }
.bid-in{ width:100%; font:inherit; font-size:1rem; padding:10px 11px; text-align:center;
  border:3px solid #1a1408; background:#fff; color:#1a1408; margin-bottom:10px; }
.bid-in:focus{ outline:3px solid #ffd23f; outline-offset:1px; }
.bid-go{ font:inherit; font-weight:700; font-size:.9rem; width:100%; padding:11px 12px;
  border:3px solid #1a1408; background:#ffe135; color:#1a1408; cursor:pointer;
  box-shadow:4px 4px 0 rgba(0,0,0,.35); }
.bid-go:hover{ background:#1a1408; color:#ffe135; }
.bid-go[disabled]{ opacity:.45; cursor:default; box-shadow:none; }
.bid-skip{ display:block; margin:9px auto 0; background:none; border:0; font:inherit;
  font-size:.72rem; color:#1a1408; opacity:.55; cursor:pointer; text-decoration:underline; }
.bid-err{ font-size:.74rem; color:#b3261e; margin:-4px 0 8px; }
/* ✓ saved — the beat that makes it feel like something happened */
.bid-done{ font-size:1.15rem; margin:6px 0 0; }
@media (prefers-reduced-motion:no-preference){
  .bid-card{ animation:bidIn .18s ease-out; }
  @keyframes bidIn{ from{ transform:translateY(8px); opacity:0; } }
}
`;

let styled = false;
function injectCss() {
  if (styled) return;
  styled = true;
  const st = document.createElement('style');
  st.textContent = CSS;
  document.head.appendChild(st);
}

/**
 * 🪪 Ask for a name, once, at a moment where it means something.
 *
 * @param {object} o
 *   o.why    one short line naming what just happened ("your first seed is in")
 *   o.label  what they are being called here — "gardener", "builder"
 *   o.paint  optional (canvas) => void, from a caller that already has the
 *            engine. Falls back to the avatar baked by /pass/, then to nothing.
 * @returns {Promise<string>} the saved name, or '' if skipped/already handled
 */
export function askName(o = {}) {
  return new Promise((resolve) => {
    // ⚠️ every early exit is silent — a visitor who already has a name, or who
    // already said no, must never see this twice.
    if (typeof document === 'undefined' || myName() || asked()) { resolve(''); return; }
    markAsked();
    injectCss();

    const veil = document.createElement('div');
    veil.className = 'bid-veil';
    const card = document.createElement('div');
    card.className = 'bid-card';
    veil.appendChild(card);

    // the face: drawn by the caller if it can, else the still baked by /pass/
    let facePainted = false;
    if (typeof o.paint === 'function') {
      const cv = document.createElement('canvas');
      cv.width = 72; cv.height = 72; cv.className = 'bid-face';
      try { o.paint(cv); card.appendChild(cv); facePainted = true; } catch (e) { /* no face, no problem */ }
    }
    if (!facePainted) {
      let av = '';
      try { av = localStorage.getItem('ps-avatar-v1') || ''; } catch (e) {}
      if (av) {
        const im = new Image(72, 72);
        im.className = 'bid-face'; im.src = av; im.alt = '';
        card.appendChild(im);
      }
    }

    const h = document.createElement('h2');
    h.textContent = 'What should we call you?';
    const p = document.createElement('p');
    // ⚠️ this names the PLAYER, and the copy must say so — "put a name on
    // it" pointed back at whatever the `why` mentioned (the sign, the seed)
    // and read as naming THAT twice (Trym, mid-claim)
    p.textContent = (o.why ? o.why + ' ' : '')
      + 'This is your banana’s name — it shows over your head, and signs everything you make in Banana World.';
    const err = document.createElement('p');
    err.className = 'bid-err'; err.hidden = true;
    const inp = document.createElement('input');
    inp.className = 'bid-in';
    inp.maxLength = 24;
    inp.placeholder = 'your name';
    inp.setAttribute('aria-label', 'Your name');
    const go = document.createElement('button');
    go.className = 'bid-go'; go.type = 'button';
    go.textContent = 'That’s me';
    go.disabled = true;
    const skip = document.createElement('button');
    skip.className = 'bid-skip'; skip.type = 'button';
    skip.textContent = 'not now';

    card.append(h, p, err, inp, go, skip);
    document.body.appendChild(veil);
    setTimeout(() => { try { inp.focus(); } catch (e) {} }, 30);

    let closed = false;
    const close = (val) => {
      if (closed) return;
      closed = true;
      veil.remove();
      resolve(val);
    };

    inp.addEventListener('input', () => { go.disabled = !inp.value.trim(); err.hidden = true; });

    const save = async () => {
      const v = inp.value.trim().slice(0, 24);
      if (!v || go.disabled) return;
      // ⚠️ the same family-friendly bar the pass's own editor uses — a name
      // shown on other people's screens has to clear it too.
      // ⚠️ AWAITED: the checker lives in a lazily-imported module, so `clean`
      // returns a PROMISE — and a promise is always truthy, which would have
      // waved every name straight through.
      go.disabled = true;
      let ok = true;
      try { ok = o.clean ? await o.clean(v) : true; } catch (e) { ok = true; }
      if (!ok) {
        err.textContent = 'Let’s keep it family friendly — try another one.';
        err.hidden = false;
        go.disabled = false;
        inp.focus();
        return;
      }
      try { localStorage.setItem(KEY, v); } catch (e) {}
      try { passPush(); } catch (e) {}   // the name rides the sync blob
      // the '✓ saved' beat — brief, then gone. It is the whole point of the
      // ritual: something happened, and it was you that did it.
      card.replaceChildren();
      const done = document.createElement('p');
      done.className = 'bid-done';
      done.textContent = '✓ saved — hello, ' + v;
      card.appendChild(done);
      setTimeout(() => close(v), 1100);
    };

    go.addEventListener('click', save);
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') save();
      if (e.key === 'Escape') close('');
    });
    skip.addEventListener('click', () => close(''));
    veil.addEventListener('click', (e) => { if (e.target === veil) close(''); });
  });
}
