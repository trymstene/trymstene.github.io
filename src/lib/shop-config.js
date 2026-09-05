// The one place the Shopify Storefront endpoint lives. sticker-core (the
// custom lane) and cart-ui (the global cart) both read it — cart-ui must NOT
// import sticker-core, which drags the whole banana engine onto every page.
export const SHOP = {
  workerBase: 'https://banana-sticker.trymstene.workers.dev',
  shopDomain: 'officialdancingbanana.myshopify.com',
  storefrontToken: '1032480366b6bf67760ba73ace4fe0f8',
};

export async function storefront(query, variables) {
  const res = await fetch('https://' + SHOP.shopDomain + '/api/2024-10/graphql.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': SHOP.storefrontToken },
    body: JSON.stringify({ query, variables }),
  });
  const data = await res.json();
  return data && data.data;
}

// ---- the shared cart (one Shopify cart for custom AND official lines) ----
// localStorage 'custom-cart-v1' = { id, checkoutUrl, n, at, ck }. The key
// predates the global cart (it began as the custom lane's standing order) —
// keep it, a rename would orphan carts people already started.
export const CART_KEY = 'custom-cart-v1';
export function cartRead() { try { return JSON.parse(localStorage.getItem(CART_KEY) || 'null'); } catch (e) { return null; } }
// quiet=true skips the ping — cart-ui's refresh saves quietly, or the ping
// re-triggers its own 'bb-cart' listener and the drawer polls forever
export function cartSave(c, quiet) {
  try { localStorage.setItem(CART_KEY, JSON.stringify(c)); } catch (e) {}
  if (!quiet) cartPing(c ? c.n : 0);
}
export function cartClear() {
  try { localStorage.removeItem(CART_KEY); } catch (e) {}
  cartPing(0);
}
// mutations announce themselves so the nav badge (and an open drawer) repaint
export function cartPing(n) {
  try { window.dispatchEvent(new CustomEvent('bb-cart', { detail: { n: n || 0 } })); } catch (e) {}
}

export const CART_FIELDS = 'id checkoutUrl totalQuantity';

// 📊 the ids a sale needs to be CREDITED, not just counted: the GA4 client id
// (worker → Measurement Protocol) and Meta's _fbp/_fbc (worker → Conversions
// API) ride every line as hidden attributes (underscore = not shown at
// checkout). Every buy door must attach them — a line without them still
// counts, but as a new anonymous user with no campaign. Mirrors trackIds()
// in public/js/shop.js and metaIds() in sticker-core.
export function trackIds() {
  const ck = (n) => (document.cookie.match('(^|; )' + n + '=([^;]*)') || [])[2];
  const out = [];
  const ga = ck('_ga');
  if (ga) { const cid = ga.split('.').slice(-2).join('.'); if (cid) out.push({ key: '_ga_cid', value: cid }); }
  const fbp = ck('_fbp'); if (fbp) out.push({ key: '_fbp', value: fbp });
  const fbc = ck('_fbc'); if (fbc) out.push({ key: '_fbc', value: fbc });
  return out;
}
const errsOf = (p) => ((p && p.userErrors) || []).map((e) => e.message).join('; ');

// Add prepared CartLineInputs to the stored cart, creating a fresh cart
// only when Shopify says the stored one is GONE (completed/expired → cart:
// null). ⚠️ Review doctrine (28 Aug): a network throw is NOT a dead cart —
// clearing on it orphaned a live multi-line cart — and userErrors ARE
// failure even when a cart with a checkoutUrl comes back beside them
// (unpublished variant, sold out): the old code called that success and
// checked out WITHOUT the line the buyer just added.
export const cartAddLine = (line) => cartAddLines([line]);
export async function cartAddLines(lines) {
  const prev = cartRead();
  if (prev && prev.id) {
    const d = await storefront(
      'mutation($cartId: ID!, $lines: [CartLineInput!]!) { cartLinesAdd(cartId: $cartId, lines: $lines) { cart { ' + CART_FIELDS + ' } userErrors { message } } }',
      { cartId: prev.id, lines });
    const payload = d && d.cartLinesAdd;
    if (!d) throw new Error('cart add failed: no response');
    const errs = errsOf(payload);
    if (errs) throw new Error('cart add failed: ' + errs);
    const cart = payload && payload.cart;
    if (cart && cart.checkoutUrl) {
      const c = { id: cart.id, checkoutUrl: cart.checkoutUrl, n: cart.totalQuantity || 0, at: Date.now(), ck: Date.now() };
      cartSave(c);
      return c;
    }
    // Shopify answered and the cart is gone — only NOW is a fresh one right
    cartClear();
  }
  const d = await storefront(
    'mutation($lines: [CartLineInput!]!) { cartCreate(input: { lines: $lines }) { cart { ' + CART_FIELDS + ' } userErrors { message } } }',
    { lines });
  const payload = d && d.cartCreate;
  const errs = errsOf(payload);
  if (errs) throw new Error('cart failed: ' + errs);
  const cart = payload && payload.cart;
  if (!cart || !cart.checkoutUrl || !cart.totalQuantity) throw new Error('cart failed: ' + JSON.stringify(d));
  const c = { id: cart.id, checkoutUrl: cart.checkoutUrl, n: cart.totalQuantity, at: Date.now(), ck: Date.now() };
  cartSave(c);
  return c;
}
