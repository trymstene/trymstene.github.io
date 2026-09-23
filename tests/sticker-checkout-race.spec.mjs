// 🧾 THE CUSTOM STICKER'S CHECKOUT SURVIVES A VARIANT THE STOREFRONT DOES NOT KNOW YET (24 Sep 2026).
//
// Trym: "the checkout button didnt work for Custom Sticker on Make A Banana". GA4 had it: two of three orders on 23 Sep
// failed at the cart with "The merchandise with id … does not exist" — the worker mints a per-order product wearing the
// buyer's design, and the Storefront API had not caught up with it yet. sticker-core addMinted now asks the cart again after
// a beat, twice, and then puts the SHARED variant in (a generic thumbnail, never a broken checkout).
//
// Everything outside the page is stubbed: the worker's /upload and /checkout, and Shopify's cart mutations. Nothing reaches
// the store.
import { test, expect } from '@playwright/test';

const TEMP = 'gid://shopify/ProductVariant/1111', CHECKOUT = 'https://shop.example/cart/c/ok';
async function pdp(page, { failTemp }) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const carts = [];
  await page.route('**/upload', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ key: 'k.png', url: 'https://x/d/k.png' }) }));
  await page.route('**/checkout', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ variantGid: TEMP }) }));
  await page.route('**/graphql.json', async (r) => {
    const body = JSON.parse(r.request().postData() || '{}');
    const q = String(body.query || '');
    if (!/cartCreate|cartLinesAdd/.test(q)) return r.continue();
    const id = ((body.variables || {}).lines || [])[0].merchandiseId;
    carts.push(id);
    const unknown = id === TEMP && carts.filter((x) => x === TEMP).length <= failTemp;
    const payload = unknown
      ? { cart: null, userErrors: [{ message: 'The merchandise with id ' + id + ' does not exist.' }] }
      : { cart: { id: 'gid://shopify/Cart/c1', checkoutUrl: CHECKOUT, totalQuantity: 1, lines: { nodes: [] }, cost: { subtotalAmount: { amount: '4.99', currencyCode: 'USD' } } }, userErrors: [] };
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { cartCreate: payload, cartLinesAdd: payload } }) });
  });
  let nav = '';
  await page.route('https://shop.example/**', (r) => { nav = r.request().url(); r.fulfill({ status: 200, contentType: 'text/html', body: '<p>checkout</p>' }); });
  await page.goto('/make-a-banana/sticker/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#pdpBuy:not([disabled])', { timeout: 30000 });
  return { errors, carts, nav: () => nav };
}

test('a variant the storefront does not know yet is asked for again, and the checkout opens', async ({ page }) => {
  test.setTimeout(60000);
  const s = await pdp(page, { failTemp: 1 });
  await page.click('#pdpBuy');
  await page.waitForFunction((u) => location.href.startsWith(u), CHECKOUT, { timeout: 20000 });
  expect(s.carts, 'refused once, then the same per-order variant goes in').toEqual([TEMP, TEMP]);
  expect(s.errors).toEqual([]);
});

test('a variant the storefront never finds falls back to the shared sticker: a generic thumbnail, never a dead button', async ({ page }) => {
  test.setTimeout(60000);
  const s = await pdp(page, { failTemp: 99 });
  await page.click('#pdpBuy');
  await page.waitForFunction((u) => location.href.startsWith(u), CHECKOUT, { timeout: 20000 });
  expect(s.carts.slice(0, 3), 'three asks for the per-order variant').toEqual([TEMP, TEMP, TEMP]);
  expect(s.carts[3], 'then the shared variant').toMatch(/^gid:\/\/shopify\/ProductVariant\/\d+$/);
  expect(s.carts[3]).not.toBe(TEMP);
  expect(s.errors).toEqual([]);
});
