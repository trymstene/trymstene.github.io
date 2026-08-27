// 🛒 THE GLOBAL CART — badge in the nav, drawer over everything. One Shopify
// cart holds custom lines (minted per-design variants, print attributes) and
// official-shop lines together, so a custom tee + a custom sticker + an
// official shirt check out as one order.
//
// Loaded by Nav.astro on EVERY page, so it stays lean: the badge paints from
// localStorage instantly; Shopify is only asked when the drawer opens (plus a
// throttled ambient revalidate, because checkouts complete on the shop domain
// where no storage event can reach us).
//
// ⚠️ REFRESH NEVER PINGS. cart-ui's own saves are quiet (cartSave(c, true)) —
// a pinging refresh re-triggers the 'bb-cart' listener while the drawer is
// open and the loop polls Shopify forever (adversarial review, 28 Aug).
import { storefront, cartRead, cartSave, cartClear } from './shop-config.js';

const $ = (sel, root) => (root || document).querySelector(sel);
const fmt = (m) => {
  if (!m || !m.amount) return '';
  const a = (Math.round(parseFloat(m.amount) * 100) / 100).toFixed(2);
  return m.currencyCode === 'USD' ? '$' + a : a + ' ' + m.currencyCode;
};
const esc = (t) => String(t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const CART_Q = `query($id: ID!) { cart(id: $id) {
  id checkoutUrl totalQuantity
  cost { subtotalAmount { amount currencyCode } }
  lines(first: 50) { nodes {
    id quantity
    cost { totalAmount { amount currencyCode } }
    attributes { key value }
    merchandise { ... on ProductVariant {
      id title
      price { amount currencyCode }
      image { url }
      product { title }
    } }
  } }
} }`;

let built = false, lastFocus = null, prevOverflow = '';

function badge(n) {
  const b = $('#navCartCount');
  const btn = $('#navCartBtn');
  if (!b || !btn) return;
  b.textContent = n > 99 ? '99+' : String(n || 0);
  b.hidden = !n;
  btn.setAttribute('aria-label', n ? 'Cart, ' + n + ' item' + (n === 1 ? '' : 's') : 'Cart, empty');
}

function ensureDrawer() {
  if (built) return;
  built = true;
  const host = document.createElement('div');
  host.id = 'bbCartHost';
  host.innerHTML = `
    <div class="bbc-backdrop" id="bbCartBackdrop" hidden></div>
    <aside class="bbc" id="bbCartDrawer" hidden role="dialog" aria-modal="true" aria-label="Your cart">
      <div class="bbc__head">
        <h2><svg class="bbc__ic" viewBox="0 0 120 120" shape-rendering="crispEdges" aria-hidden="true"><rect x="10" y="10" width="20" height="10" fill="#262233"/><rect x="20" y="20" width="10" height="10" fill="#262233"/><rect x="20" y="30" width="90" height="10" fill="#262233"/><rect x="20" y="40" width="10" height="30" fill="#262233"/><rect x="100" y="40" width="10" height="30" fill="#262233"/><rect x="30" y="40" width="70" height="30" fill="#fff"/><rect x="20" y="70" width="90" height="10" fill="#262233"/><rect x="30" y="90" width="20" height="20" fill="#262233"/><rect x="80" y="90" width="20" height="20" fill="#262233"/></svg> Your cart</h2>
        <button type="button" class="bbc__close" id="bbCartClose" aria-label="Close cart">✕</button>
      </div>
      <div class="bbc__body" id="bbCartBody"><p class="bbc__hint">Looking in the basket…</p></div>
      <div class="bbc__foot" id="bbCartFoot" hidden>
        <p class="bbc__row"><span>Subtotal</span><b id="bbCartSubtotal"></b></p>
        <p class="bbc__row bbc__row--dim"><span>Shipping</span><span>calculated at checkout · ships worldwide</span></p>
        <a class="btn btn--dark bbc__checkout" id="bbCartCheckout" href="#">Checkout</a>
        <p class="bbc__doors"><a href="/make-a-banana/">make another banana →</a><a href="/shop/">official shop →</a></p>
      </div>
    </aside>`;
  document.body.appendChild(host);
  $('#bbCartClose').addEventListener('click', close);
  $('#bbCartBackdrop').addEventListener('click', close);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  $('#bbCartCheckout').addEventListener('click', () => {
    if (window.gtag) window.gtag('event', 'begin_checkout', { from: 'cart_drawer' });
  });
}

function close() {
  const d = $('#bbCartDrawer'), bd = $('#bbCartBackdrop');
  if (!d || d.hidden) return;
  d.classList.remove('bbc--in'); d.hidden = true;
  if (bd) bd.hidden = true;
  document.body.style.overflow = prevOverflow;
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}

async function open() {
  ensureDrawer();
  const d = $('#bbCartDrawer'), bd = $('#bbCartBackdrop');
  if (d.hidden) {
    lastFocus = document.activeElement;
    prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';   // the page behind must not scroll
    d.hidden = false; bd.hidden = false;
    requestAnimationFrame(() => d.classList.add('bbc--in'));
    $('#bbCartClose').focus();
    if (window.gtag) window.gtag('event', 'cart_open', { n: (cartRead() || {}).n || 0 });
  }
  await refresh();
}

function emptyState() {
  $('#bbCartBody').innerHTML =
    '<div class="bbc__empty"><p class="bbc__emptyart">🍌</p>' +
    '<p><b>Nothing in the cart yet.</b></p>' +
    '<p class="bbc__hint">Make a banana and put it on something real — or grab the official shirt.</p>' +
    '<p class="bbc__doors bbc__doors--big"><a class="btn" href="/make-a-banana/">make a banana →</a>' +
    '<a class="btn" href="/shop/">official shop →</a></p></div>';
  $('#bbCartFoot').hidden = true;
}

// stale responses must never paint over fresh ones — every refresh takes a
// ticket and only the newest is allowed to touch the DOM or the stored blob
let seq = 0;
async function refresh() {
  const my = ++seq;
  const c = cartRead();
  if (!c || !c.id) { badge(0); emptyState(); return; }
  let cart = null, failed = false;
  try {
    const data = await storefront(CART_Q, { id: c.id });
    cart = data && data.cart;
  } catch (e) { failed = true; }
  if (my !== seq) return;
  if (failed) {
    $('#bbCartBody').innerHTML = '<p class="bbc__hint">Couldn’t reach the shop — check the connection and try again.</p>';
    $('#bbCartFoot').hidden = true;   // a dead footer must not sell a stale subtotal
    return;
  }
  if (!cart || !cart.totalQuantity) { cartClear(); badge(0); emptyState(); return; }
  cartSave({ id: cart.id, checkoutUrl: cart.checkoutUrl, n: cart.totalQuantity, at: c.at || Date.now(), ck: Date.now() }, true);
  render(cart);
}

function render(cart) {
  badge(cart.totalQuantity);
  const body = $('#bbCartBody');
  const nodes = (cart.lines && cart.lines.nodes) || [];
  const rows = nodes.map((ln) => {
    const m = ln.merchandise || {};
    const attrs = Object.fromEntries((ln.attributes || []).map((a) => [a.key, a.value]));
    const isCustom = !!attrs._design_key;
    const img = (m.image && m.image.url) || '';
    const title = (m.product && m.product.title) || 'Banana thing';
    const subBits = [];
    if (attrs.Color) subBits.push(attrs.Color);
    if (attrs.Size) subBits.push(attrs.Size);
    if (!isCustom && m.title && m.title !== 'Default Title') subBits.push(m.title);
    if (isCustom) subBits.push('your design');
    return '<div class="bbc__line" data-line="' + esc(ln.id) + '">' +
      (img ? '<img class="bbc__thumb' + (isCustom ? ' bbc__thumb--pixel' : '') + '" src="' + esc(img) + '" alt="" loading="lazy">'
           : '<span class="bbc__thumb bbc__thumb--blank">🍌</span>') +
      '<div class="bbc__mid"><b class="bbc__title">' + esc(title) + '</b>' +
      (subBits.length ? '<span class="bbc__sub">' + esc(subBits.join(' · ')) + '</span>' : '') +
      '<span class="bbc__qty"><button type="button" class="bbc__step" data-step="-1" aria-label="One less">−</button>' +
      '<span class="bbc__n">' + ln.quantity + '</span>' +
      '<button type="button" class="bbc__step" data-step="1" aria-label="One more">+</button>' +
      '<button type="button" class="bbc__rm" aria-label="Remove from cart">remove</button></span></div>' +
      '<b class="bbc__price">' + fmt(ln.cost && ln.cost.totalAmount) + '</b></div>';
  });
  // 50 lines fit far more carts than anyone builds — but if one overflows,
  // say so instead of silently hiding lines the subtotal still counts
  const shown = nodes.reduce((a, ln) => a + ln.quantity, 0);
  if (cart.totalQuantity > shown) rows.push('<p class="bbc__hint">…and more — the checkout shows every item.</p>');
  body.innerHTML = rows.join('');
  $('#bbCartSubtotal').textContent = fmt(cart.cost && cart.cost.subtotalAmount);
  $('#bbCartCheckout').setAttribute('href', cart.checkoutUrl);
  $('#bbCartFoot').hidden = false;

  body.querySelectorAll('.bbc__line').forEach((row) => {
    const lineId = row.dataset.line;
    const node = nodes.find((x) => x.id === lineId);
    row.querySelectorAll('.bbc__step').forEach((btn) => {
      btn.addEventListener('click', () => {
        const q = Math.max(0, (node ? node.quantity : 1) + parseInt(btn.dataset.step, 10));
        mutateLine(cart.id, lineId, q);
      });
    });
    row.querySelector('.bbc__rm').addEventListener('click', () => mutateLine(cart.id, lineId, 0));
  });
}

// `mutating` covers the WHOLE round trip incl. the re-render — released
// earlier, a fast second tap stepped from a stale snapshot (review, 28 Aug)
let mutating = false;
async function mutateLine(cartId, lineId, quantity) {
  if (mutating) return;
  mutating = true;
  try {
    if (quantity > 0) {
      await storefront(
        'mutation($cartId: ID!, $lines: [CartLineUpdateInput!]!) { cartLinesUpdate(cartId: $cartId, lines: $lines) { cart { id } userErrors { message } } }',
        { cartId, lines: [{ id: lineId, quantity }] });
    } else {
      await storefront(
        'mutation($cartId: ID!, $lineIds: [ID!]!) { cartLinesRemove(cartId: $cartId, lineIds: $lineIds) { cart { id } userErrors { message } } }',
        { cartId, lineIds: [lineId] });
    }
    await refresh();
  } catch (e) {
  } finally { mutating = false; }
}

export function initCartUi() {
  const btn = $('#navCartBtn');
  if (!btn) return;
  const stored = cartRead();
  badge((stored || {}).n || 0);
  btn.addEventListener('click', open);
  // surfaces that add lines ping 'bb-cart' (cart-ui's own saves are QUIET);
  // other tabs arrive via the storage event
  window.addEventListener('bb-cart', (e) => {
    badge((e.detail && e.detail.n) || 0);
    if (built && !$('#bbCartDrawer').hidden) refresh();
  });
  window.addEventListener('storage', (e) => {
    if (e.key !== 'custom-cart-v1') return;
    badge((cartRead() || {}).n || 0);
    if (built && !$('#bbCartDrawer').hidden) refresh();
  });
  // ambient revalidate, throttled: a checkout completes on the shop domain
  // where nothing can tell this origin — without this the badge lies forever
  if (stored && stored.id && Date.now() - (stored.ck || 0) > 10 * 60 * 1000) {
    storefront('query($id: ID!) { cart(id: $id) { totalQuantity } }', { id: stored.id })
      .then((d) => {
        const cart = d && d.cart;
        if (!cart || !cart.totalQuantity) { cartClear(); badge(0); return; }
        cartSave({ ...stored, n: cart.totalQuantity, ck: Date.now() }, true);
        badge(cart.totalQuantity);
      })
      .catch(() => {});
  }
  // surfaces that can't import modules (public/js/shop.js) call these
  window.__bbCart = { open, refresh };
}
