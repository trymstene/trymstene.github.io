// 🛒 THE CHECKOUT CARD (24 Sep 2026). Trym: "it can take from 3-6-7 seconds before anything happens and youre sent to the
// checkout page … should we have a better loading popup … mobile friendly / desktop friendly".
//
// Every road to Shopify's checkout opens one card (src/lib/checkout-veil.js): what is being bought, the steps ticked off as
// they really happen (design library §3d), a bar the dancing banana walks along, "secure checkout by Shopify"; it stays up
// until the page leaves, turns into Try again / Close when something fails, and offers its own link when the page will not
// leave. Everything outside the page is stubbed — the sticker worker, Shopify's cart, the checkout page — with the delays a
// phone sees, so nothing reaches the store. Pictures of every state land in test-results/checkout-veil-*.png.
import { test, expect } from '@playwright/test';
import W from '../src/data/copy/checkout.json' with { type: 'json' };

const CHECKOUT = 'https://shop.example/cart/c/ok';
const PACK = '/shop/dancing-banana-official-sticker-pack-1/';
const slow = (ms) => new Promise((r) => setTimeout(r, ms));
const money = (a) => ({ amount: a, currencyCode: 'USD' });
const CART = { id: 'gid://shopify/Cart/c1', checkoutUrl: CHECKOUT, totalQuantity: 1, cost: { subtotalAmount: money('9.99') },
  lines: { nodes: [{ id: 'l1', quantity: 1, cost: { subtotalAmount: money('9.99'), totalAmount: money('9.99') }, discountAllocations: [], attributes: [],
    merchandise: { id: 'gid://shopify/ProductVariant/2', title: 'Default', price: money('9.99'), image: null, product: { title: 'Sticker pack', handle: 'dancing-banana-official-sticker-pack-1' } } }] } };

// `stay`: the checkout answers 204 No Content, and a browser keeps the page it is on when a navigation gets no content —
// so the card's last state can be looked at. Without it the page really leaves for the checkout.
async function stubs(page, { cartMs = 1500, upMs = 1200, mintMs = 900, fail = false, stay = false } = {}) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.route('**/upload', async (r) => { await slow(upMs); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ key: 'k.png', url: 'https://x/d/k.png' }) }); });
  await page.route('**/checkout', async (r) => { await slow(mintMs); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ variantGid: 'gid://shopify/ProductVariant/1111' }) }); });
  await page.route('**/graphql.json', async (r) => {
    const body = JSON.parse(r.request().postData() || '{}');
    const q = String(body.query || '');
    if (/cart\(id:/.test(q)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { cart: CART } }) });
    if (!/cartCreate|cartLinesAdd/.test(q)) return r.continue();
    await slow(cartMs);
    if (fail) return r.fulfill({ status: 502, contentType: 'text/plain', body: 'bad gateway' });
    const payload = { cart: CART, userErrors: [] };
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { cartCreate: payload, cartLinesAdd: payload } }) });
  });
  let nav = '';
  await page.route('https://shop.example/**', async (r) => {
    nav = r.request().url();
    if (stay) return r.fulfill({ status: 204, body: '' });
    await slow(900); r.fulfill({ status: 200, contentType: 'text/html', body: '<p>checkout</p>' });
  });
  return { errors, nav: () => nav };
}
// the card's life, sampled in the page from the click on: when it first showed, and each step that was current in turn
const watch = (page) => page.evaluate(() => {
  window.__ck = { t0: performance.now(), shown: 0, seq: [] };
  setInterval(() => {
    const v = document.querySelector('.ckv'), c = window.__ck;
    if (v && !c.shown) c.shown = performance.now() - c.t0;
    const now = v && v.querySelector('.ckv__step.is-now span');
    const s = now ? now.textContent : '';
    if (s && c.seq[c.seq.length - 1] !== s) c.seq.push(s);
  }, 30);
});
const ck = (page) => page.evaluate(() => window.__ck);
const shot = (page, name) => page.screenshot({ path: `test-results/checkout-veil-${name}.png` });
const nowIs = (page, words) => page.waitForFunction((l) => (document.querySelector('.ckv__step.is-now span') || {}).textContent === l, words, { timeout: 8000 });
async function pack(page) {
  await page.goto(PACK, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.pdp-buy:not([disabled])', { timeout: 20000 });
  await page.waitForFunction(() => typeof window.__bbVeil === 'function', null, { timeout: 10000 });
}

for (const [w, h, tag] of [[393, 852, 'phone'], [1280, 800, 'desktop']]) {
  test(`the official shop's Buy: the card opens at once and names each step as it happens — ${tag}`, async ({ page }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width: w, height: h });
    const s = await stubs(page, { stay: true });
    await pack(page);
    await page.waitForTimeout(1200);   // the page has been read for a moment: the card's chunk is warm
    await watch(page);
    await page.click('.pdp-buy');
    await page.waitForSelector('.ckv .ckv__step.is-now', { timeout: 3000 });
    expect((await ck(page)).shown, 'the card is up within a frame or two of the tap').toBeLessThan(400);
    expect(await page.textContent('.ckv__head')).toBe(W.title.order);
    expect(await page.textContent('.ckv__secure')).toContain(W.secure);
    expect(await page.locator('.ckv__art img').count(), 'the product is on the card').toBe(1);
    await page.waitForTimeout(700); await shot(page, `pack-cart-${tag}`);
    await nowIs(page, W.step.checkout);
    await page.waitForTimeout(700); await shot(page, `pack-checkout-${tag}`);
    await expect.poll(() => s.nav(), { timeout: 8000 }).toBe(CHECKOUT);
    expect((await ck(page)).seq, 'each step named in turn').toEqual([W.step.cart, W.step.checkout]);
    expect(s.errors).toEqual([]);
  });
}

test('the official shop\'s Buy really leaves for the checkout, with the card up until it does', async ({ page }) => {
  test.setTimeout(60000);
  const s = await stubs(page);
  await pack(page);
  await page.click('.pdp-buy');
  await page.waitForSelector('.ckv', { timeout: 3000 });
  await page.waitForFunction((u) => location.href.startsWith(u), CHECKOUT, { timeout: 15000 });
  expect(s.nav()).toBe(CHECKOUT);
  expect(s.errors).toEqual([]);
});

test('the official shop\'s Buy, failing: the card says so and that nothing was charged; Try again runs it again, Close closes', async ({ page }) => {
  test.setTimeout(60000);
  const s = await stubs(page, { fail: true, cartMs: 600 });
  await pack(page);
  await page.click('.pdp-buy');
  await page.waitForSelector('.ckv--fail', { timeout: 10000 });
  expect(await page.textContent('.ckv__head')).toBe(W.fail.title);
  expect(await page.textContent('.ckv__note')).toBe(W.fail.cart);
  expect(await page.locator('.ckv__acts button').allTextContents()).toEqual([W.retry, W.close]);
  expect(await page.locator('.ckv__step.is-fail').count(), 'the step that failed is marked').toBe(1);
  await shot(page, 'pack-failed');
  await page.click(`.ckv__acts button:has-text("${W.retry}")`);
  await page.waitForSelector('.ckv .ckv__step.is-now', { timeout: 5000 });   // it runs again…
  await page.waitForSelector('.ckv--fail', { timeout: 10000 });              // …and fails again, as stubbed
  await page.click(`.ckv__acts button:has-text("${W.close}")`);
  await expect(page.locator('.ckv')).toHaveCount(0);
  expect(await page.locator('.pdp-buy').isDisabled(), 'the button is back for another go').toBe(false);
  expect(s.errors).toEqual([]);
});

test('Make a Banana\'s Order: their banana on the card, the three steps in their order, then checkout', async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 393, height: 852 });
  const s = await stubs(page, { upMs: 1400, mintMs: 1200, cartMs: 900, stay: true });
  await page.goto('/make-a-banana/sticker/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#pdpBuy:not([disabled])', { timeout: 30000 });
  await watch(page);
  await page.click('#pdpBuy');
  await page.waitForSelector('.ckv', { timeout: 2000 });
  expect((await ck(page)).shown, 'the card is up before the print is rendered').toBeLessThan(400);
  expect(await page.textContent('.ckv__head')).toBe(W.title.item.replace('{product}', 'sticker'));
  expect(await page.locator('.ckv__art canvas').count(), 'their own banana is on the card').toBe(1);
  await page.waitForTimeout(600); await shot(page, 'custom-design');
  await nowIs(page, W.step.cart);
  await page.waitForTimeout(500); await shot(page, 'custom-cart');
  await nowIs(page, W.step.checkout);
  await page.waitForTimeout(700); await shot(page, 'custom-checkout');
  expect((await ck(page)).seq, 'each step named in turn, none skipped').toEqual([W.step.design, W.step.cart, W.step.checkout]);
  await expect.poll(() => s.nav(), { timeout: 8000 }).toBe(CHECKOUT);
  expect(s.errors).toEqual([]);
});

test('Make a Banana\'s add to cart: two steps, then the card gives way to the cart drawer', async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 393, height: 852 });
  const s = await stubs(page, { upMs: 900, mintMs: 700, cartMs: 700 });
  await page.goto('/make-a-banana/sticker/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#pdpAddMore:not([disabled])', { timeout: 30000 });
  await page.click('#pdpAddMore');
  await page.waitForSelector('.ckv', { timeout: 2000 });
  expect(await page.textContent('.ckv__head')).toBe(W.title.add.replace('{product}', 'sticker'));
  expect(await page.locator('.ckv__secure').count(), 'no checkout, so no checkout line').toBe(0);
  await page.waitForTimeout(500); await shot(page, 'custom-add');
  await expect(page.locator('.ckv')).toHaveCount(0, { timeout: 10000 });
  await expect(page.locator('#bbCartDrawer')).toBeVisible();
  expect(s.errors).toEqual([]);
});

test('the cart drawer\'s Checkout: one step and the secure line, on the way out', async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 393, height: 852 });
  await page.addInitScript((u) => { try { localStorage.setItem('custom-cart-v1', JSON.stringify({ id: 'gid://shopify/Cart/c1', checkoutUrl: u, n: 1, at: Date.now(), ck: Date.now() })); } catch (e) {} }, CHECKOUT);
  const s = await stubs(page, { stay: true });
  await page.goto('/shop/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__bbCart, null, { timeout: 10000 });
  await page.evaluate(() => window.__bbCart.open());
  await page.waitForSelector('#bbCartCheckout[href^="https://shop.example"]', { timeout: 10000 });
  await page.click('#bbCartCheckout');
  await page.waitForSelector('.ckv .ckv__step.is-now', { timeout: 5000 });
  expect(await page.locator('.ckv__step').allTextContents()).toEqual([W.step.checkout]);
  expect(await page.textContent('.ckv__secure')).toContain(W.secure);
  await page.waitForTimeout(500); await shot(page, 'drawer-checkout');
  await expect.poll(() => s.nav(), { timeout: 8000 }).toBe(CHECKOUT);
  expect(s.errors).toEqual([]);
});

test('reduced motion: no dancing banana, and the bar still shows how far along it is', async ({ page }) => {
  test.setTimeout(60000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await stubs(page, { cartMs: 3000 });
  await pack(page);
  await page.click('.pdp-buy');
  await page.waitForSelector('.ckv .ckv__step.is-now', { timeout: 3000 });
  await page.waitForTimeout(300);
  expect(await page.locator('.ckv__walk').count(), 'the banana stays home').toBe(0);
  const width = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.ckv__fill')).width));
  expect(width, 'a still bar, not none').toBeGreaterThan(20);
  await shot(page, 'reduced-motion');
});

test('a page that will not leave for the checkout gets its own link to it', async ({ page }) => {
  test.setTimeout(60000);
  await stubs(page, { cartMs: 400, stay: true });
  await pack(page);
  await page.click('.pdp-buy');
  await page.waitForFunction((l) => (document.querySelector('.ckv__note') || {}).textContent === l, W.stuck, { timeout: 20000 });
  const a = page.locator('.ckv__acts a');
  expect(await a.textContent()).toBe(W.open);
  expect(await a.getAttribute('href')).toBe(CHECKOUT);
  await shot(page, 'stuck');
});
