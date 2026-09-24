// 🛒 THE CHECKOUT HAND-OFF (24 Sep 2026). Trym: *"it can take from 3-6-7 seconds before anything happens and youre sent to
// the checkout page … should we have a better loading popup … to show more visually better that its processing"*.
//
// Every road to Shopify's checkout opens this card over the page: what is being bought (their own banana, or the product),
// the steps ticked off AS THEY REALLY HAPPEN (design library §3d — one word held for seven seconds reads as stalled; name
// the step, change the words when it changes), a bar the dancing banana walks along, and "secure checkout by Shopify",
// because the next page is on another address. It stays up until the page leaves. A failure turns it into Try again /
// Close and says nothing was charged; a page that will not leave (an in-app browser can hold it) gets its own link; the
// back button from the checkout (a bfcache restore) takes it down. Words: src/data/copy/checkout.json.
import W from '../data/copy/checkout.json';

const GIF = '/assets/dancing-banana-emoji-128.gif';   // the 32 px dancing banana at ×4, shown at ×2
// how long each step usually takes, so the bar creeps toward (never past) the step's end while it runs
const EXPECT = { design: 2400, cart: 2600, checkout: 2800 };
const SLOW = 9000, STUCK = 12000;
const LOCK = '<svg viewBox="0 0 7 8" shape-rendering="crispEdges" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M2 0h3v1h1v2h1v5H0V3h1V1h1zM2 1v2h3V1zM3 4v2h1V4z"/></svg>';
const CSS = `
.ckv{--k:var(--ink,#111);--y:var(--banana,#ffe135);position:fixed;inset:0;z-index:3100;display:grid;place-items:center;padding:16px;background:rgba(17,17,17,.62);animation:ckvIn .16s ease-out}
.ckv__card{width:min(380px,100%);max-height:calc(100dvh - 32px);overflow:auto;background:var(--paper,#fffdf5);color:var(--k);border:4px solid var(--k);box-shadow:8px 8px 0 var(--k);font-family:"Space Grotesk",system-ui,sans-serif;outline:none}
.ckv__head{margin:0;padding:.85rem 1.1rem;background:var(--y);color:var(--k);border-bottom:4px solid var(--k);font-family:"Archivo Black",system-ui,sans-serif;font-size:1.15rem;line-height:1.15;text-wrap:balance}
.ckv__body{display:grid;gap:1rem;padding:1.15rem 1.1rem 1.05rem}
.ckv__art{justify-self:center;display:grid;place-items:center;width:132px;height:132px;padding:8px;background:#fff;color:var(--k);border:3px solid var(--k);box-shadow:4px 4px 0 var(--k);transform:rotate(-3deg)}
.ckv__art img,.ckv__art canvas{display:block;max-width:100%;max-height:100%;object-fit:contain}
.ckv__steps{list-style:none;margin:0;padding:0;display:grid;gap:.6rem}
.ckv__step{display:flex;align-items:center;gap:.7rem;font-size:1rem;font-weight:600;line-height:1.2}
.ckv__box{flex:0 0 auto;width:22px;height:22px;border:3px solid var(--k);background:#fff;display:grid;place-items:center}
.ckv__step.is-wait span{opacity:.45}
.ckv__step.is-now span::after{content:'…'}
.ckv__step.is-now .ckv__box{background:var(--y)}
.ckv__step.is-now .ckv__box::after{content:'';width:6px;height:6px;background:var(--k);animation:ckvBlink .8s steps(2) infinite}
.ckv__step.is-done .ckv__box{background:var(--k)}
.ckv__step.is-done .ckv__box::after{content:'';width:9px;height:5px;margin-top:-3px;border:solid var(--y);border-width:0 0 3px 3px;transform:rotate(-45deg)}
.ckv__step.is-fail .ckv__box{background:var(--hot,#ff4d6d)}
.ckv__step.is-fail .ckv__box::before,.ckv__step.is-fail .ckv__box::after{content:'';grid-area:1/1;width:12px;height:3px;background:#fff;transform:rotate(45deg)}
.ckv__step.is-fail .ckv__box::after{transform:rotate(-45deg)}
.ckv__track{position:relative;margin-top:60px}
.ckv--still .ckv__track{margin-top:.2rem}
.ckv__bar{height:18px;border:3px solid var(--k);background:#fff;overflow:hidden}
.ckv__fill{display:block;height:100%;width:0;background:repeating-linear-gradient(-45deg,var(--y) 0 8px,var(--banana-deep,#f5c400) 8px 16px);background-size:22.63px 22.63px;animation:ckvStripe .7s linear infinite}
.ckv__walk{position:absolute;left:0;bottom:calc(100% - 3px);width:64px;height:64px;image-rendering:pixelated;pointer-events:none}
.ckv__note{margin:0;font-size:.92rem;line-height:1.4}
.ckv__acts{display:flex;flex-wrap:wrap;gap:.6rem}
.ckv__acts .btn{font:inherit;font-weight:700;cursor:pointer;white-space:nowrap}
.ckv__secure{display:flex;align-items:center;gap:.45rem;margin:0;font-size:.8rem;font-weight:600;opacity:.72}
.ckv__secure svg{width:14px;height:16px;flex:0 0 auto}
.ckv--fail .ckv__fill{animation:none;background:var(--hot,#ff4d6d)}
.ckv--fail .ckv__walk{display:none}
.ckv--fail .ckv__track{margin-top:.2rem}
.ckv--fail .ckv__secure{display:none}
.ckv [hidden]{display:none!important}
@keyframes ckvStripe{to{background-position:22.63px 0}}
@keyframes ckvBlink{50%{opacity:.15}}
@keyframes ckvIn{from{opacity:0}}
@media (prefers-reduced-motion:reduce){.ckv,.ckv__fill,.ckv__step.is-now .ckv__box::after{animation:none}}
`;

let live = null;
const still = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const fillIn = (s, product) => String(s || '').replace('{product}', product || '');
// ⚠️ the back button from Shopify's checkout brings this page back from the bfcache with the card still up
if (typeof addEventListener === 'function') addEventListener('pageshow', (e) => { if (e.persisted && live) live.close(); });

/** Warm the card before anyone needs it: the dancing banana's frames. */
export function warm() { try { new Image().src = GIF; } catch (e) {} }

/**
 * Open the card. `title` is 'item' (their own design, with `product`), 'order' (the whole cart) or 'add' (into the cart,
 * no checkout); `steps` is any of ['design', 'cart', 'checkout'] in order; `art` is a canvas, an image or an image URL.
 * Returns { step(key), go(url), done(), fail(kind, retry), close() }. Nothing is started: the caller says each step.
 */
export function openVeil(o = {}) {
  if (live) live.close();
  if (!document.getElementById('ckvCss')) { const st = document.createElement('style'); st.id = 'ckvCss'; st.textContent = CSS; document.head.appendChild(st); }
  const steps = (o.steps || ['checkout']).filter((k) => W.step[k]);
  const quiet = still();
  const root = document.createElement('div');
  root.className = 'ckv' + (quiet ? ' ckv--still' : '');
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-labelledby', 'ckvT');
  root.innerHTML = '<div class="ckv__card" tabindex="-1"><h2 class="ckv__head" id="ckvT"></h2><div class="ckv__body">'
    + '<div class="ckv__art" hidden></div><ol class="ckv__steps" aria-live="polite"></ol>'
    + '<div class="ckv__track"><div class="ckv__bar"><i class="ckv__fill"></i></div>' + (quiet ? '' : '<img class="ckv__walk" alt="" src="' + GIF + '">') + '</div>'
    + '<p class="ckv__note" hidden></p><div class="ckv__acts" hidden></div>'
    + (steps.includes('checkout') ? '<p class="ckv__secure">' + LOCK + '<span></span></p>' : '')
    + '</div></div>';
  const $ = (s) => root.querySelector(s);
  const card = $('.ckv__card'), head = $('.ckv__head'), list = $('.ckv__steps'), bar = $('.ckv__fill'), walk = $('.ckv__walk'), note = $('.ckv__note'), acts = $('.ckv__acts');
  head.textContent = fillIn(W.title[o.title] || W.title.order, o.product);
  if ($('.ckv__secure span')) $('.ckv__secure span').textContent = W.secure;
  if (o.art) {
    const box = $('.ckv__art'), a = o.art;
    if (typeof a === 'string') { const im = new Image(); im.alt = ''; im.src = a; box.appendChild(im); }
    else {
      const w = a.naturalWidth || a.width, h = a.naturalHeight || a.height;
      if (w && h) {
        const k = Math.min(1, 240 / Math.max(w, h)), c = document.createElement('canvas');
        c.width = Math.round(w * k); c.height = Math.round(h * k);
        try { c.getContext('2d').drawImage(a, 0, 0, c.width, c.height); box.appendChild(c); } catch (e) {}
      }
    }
    box.hidden = !box.firstChild;
  }
  for (const k of steps) {
    const li = document.createElement('li');
    li.className = 'ckv__step is-wait';
    li.innerHTML = '<i class="ckv__box" aria-hidden="true"></i><span></span>';
    li.lastChild.textContent = W.step[k];
    list.appendChild(li);
  }
  document.body.appendChild(root);
  const was = document.documentElement.style.overflow, back = document.activeElement;
  document.documentElement.style.overflow = 'hidden';   // the page behind must not scroll under the card
  try { card.focus({ preventScroll: true }); } catch (e) {}

  let cur = -1, failed = false, closed = false, slowT = 0, stuckT = 0;
  // the bar and the banana on it move together; with reduced motion they jump from step to step (still, never none)
  const to = (p, ms, ease) => {
    const t = quiet ? 'none' : ms + 'ms ' + ease;
    bar.style.transition = quiet ? 'none' : 'width ' + t; bar.style.width = (p * 100).toFixed(2) + '%';
    if (walk) { walk.style.transition = 'left ' + t; walk.style.left = 'calc(' + p.toFixed(4) + ' * (100% - 64px))'; }
  };
  const mark = (i, cls) => [...list.children].forEach((li, j) => { li.className = 'ckv__step ' + (j < i ? 'is-done' : j === i ? cls : 'is-wait'); });
  function step(key) {
    const i = steps.indexOf(key);
    if (i < 0 || closed || failed || i < cur) return;
    cur = i; mark(i, 'is-now');
    const n = steps.length;
    to(i / n, 250, 'ease-out');
    // …then creep toward the step's end over the time it usually takes, and stop short of it
    requestAnimationFrame(() => requestAnimationFrame(() => { if (!closed && !failed && cur === i) to((i + 0.88) / n, EXPECT[key] || 2500, 'cubic-bezier(.15,.6,.35,1)'); }));
    clearTimeout(slowT); note.hidden = true;
    slowT = setTimeout(() => { if (!closed && !failed && cur === i) { note.textContent = W.slow; note.hidden = false; } }, SLOW);
  }
  const button = (words, cls, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = cls; b.textContent = words; b.addEventListener('click', fn); return b; };
  function go(url) {
    step('checkout');
    clearTimeout(stuckT);
    stuckT = setTimeout(() => {
      if (closed || failed) return;
      clearTimeout(slowT);
      note.textContent = W.stuck; note.hidden = false;
      const a = document.createElement('a'); a.className = 'btn btn--dark'; a.href = url; a.textContent = W.open;
      acts.replaceChildren(a); acts.hidden = false;
    }, STUCK);
    location.href = url;
  }
  function done() {
    if (closed || failed) return;
    clearTimeout(slowT);
    mark(steps.length, 'is-done');
    to(1, 220, 'ease-out');
    setTimeout(close, quiet ? 150 : 450);
  }
  function fail(kind, retry) {
    if (closed) return;
    failed = true; clearTimeout(slowT); clearTimeout(stuckT);
    root.classList.add('ckv--fail');
    mark(Math.max(0, cur), 'is-fail');
    head.textContent = W.fail.title;
    note.textContent = W.fail[kind] || W.fail.cart; note.hidden = false;
    const kids = [];
    if (typeof retry === 'function') kids.push(button(W.retry, 'btn btn--dark', () => { close(); retry(); }));
    kids.push(button(W.close, 'btn btn--light', close));
    acts.replaceChildren(...kids); acts.hidden = false;
    try { kids[0].focus({ preventScroll: true }); } catch (e) {}
  }
  function close() {
    if (closed) return;
    closed = true; clearTimeout(slowT); clearTimeout(stuckT);
    // focus goes back to where it came from — unless something opened meanwhile and took it (the cart drawer after an add)
    const ours = root.contains(document.activeElement) || document.activeElement === document.body;
    root.remove();
    document.documentElement.style.overflow = was;
    try { if (ours && back && back.focus) back.focus({ preventScroll: true }); } catch (e) {}
    if (live === api) live = null;
  }
  // the card keeps the keyboard while it is up; Escape closes it only once there is nothing left in flight
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && failed) { close(); return; }
    if (e.key !== 'Tab') return;
    const f = [...root.querySelectorAll('button, a[href]')];
    if (!f.length) { e.preventDefault(); return; }
    const i = f.indexOf(document.activeElement);
    if (e.shiftKey ? i <= 0 : i === f.length - 1) { e.preventDefault(); f[e.shiftKey ? f.length - 1 : 0].focus(); }
  });
  const api = { step, go, done, fail, close, el: root };
  live = api;
  return api;
}

/** A frame for the card to paint before a long synchronous job (the print render) holds the main thread. */
export const painted = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
