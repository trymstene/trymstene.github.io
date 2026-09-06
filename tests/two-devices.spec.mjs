// 📱📱 THE TWO-DEVICE PROOF (6 Sep 2026; Trym: "a user, across devices, always
// is the same user … AS LONG AS it actually saves PERFECT").
//
// Phone A arrives fresh, gets its anonymous pass at boot, claims a homestead,
// names itself and adds an email. Phone B logs in with that email and must
// see all of it: the same world id, the same name, the same coins, the same
// homestead with the same animals. B renames the sign; A comes back and must
// see that. The real player journey, on the REAL workers — nothing stubbed —
// so a regression anywhere in the seam (mint, attach, login, pull, yard
// follow, two-way yard sync) turns this red the same night.
//
// Runs from playwright.proof.config.mjs (localhost:8803, the one local origin
// the workers admit). Needs QA_KEY — the pass worker's QA login door mints the
// same ticket an inbox would get, for an identity that can never be an
// address. Cleans up after itself: /yards/qa-erase (only a testy-proof-… yard,
// only by its proven owner) and /qa/erase (only a qa-stamped pass).
import { test, expect } from '@playwright/test';

const PASS_API = 'https://banana-pass.trymstene.workers.dev';
const YARD_API = 'https://banana-rave.trymstene.workers.dev/yards';
const KEY = (process.env.QA_KEY || '').trim();
const OUT = 'test-results/proof';

// the workers ARE reachable from this origin, so worker errors are real;
// only third-party tags and the presence socket (origin-checked) are noise
const NOISE = [
  /googletagmanager|google-analytics|clarity\.ms|facebook/,
  /WebSocket/i,
  /banana-contact|banana-share|banana-sticker/,
  // the yard's stale-save handshake: a phone that comes back after ANOTHER
  // phone changed the homestead is told 409 "pull first", and the client
  // resyncs — that is the two-device protocol working (parity batch, 3 Sep),
  // and Chrome logs every non-2xx as a console error. The assertion that A
  // ends up with B's sign is what proves the handshake did its job.
  /Failed to load resource: the server responded with a status of 409/,
];
const realErrors = (errs) => errs.filter((e) => !NOISE.some((rx) => rx.test(e)));

// every read tolerates a page mid-navigation (the homestead reloads once
// after adopting a yard) — a null just makes the poll try again
async function ls(page, k) {
  try { return await page.evaluate((key) => { try { return localStorage.getItem(key); } catch (e) { return null; } }, k); }
  catch (e) { return null; }
}
async function lsJ(page, k) { const v = await ls(page, k); try { return v ? JSON.parse(v) : null; } catch (e) { return null; } }
const yard = (page) => lsJ(page, 'hs-v1');
const link = (page) => lsJ(page, 'pass-link');

async function phone(browser) {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, hasTouch: true, isMobile: true });
  // no consent banner over the world — the proof is not about analytics
  await ctx.addInitScript(() => { try { localStorage.setItem('cookie-consent-v1', 'n'); } catch (e) {} });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
  return { ctx, page, errs };
}

async function ticket(who) {
  const r = await fetch(PASS_API + '/qa/ticket', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://trymstene.com' },
    body: JSON.stringify({ key: KEY, who }),
  });
  if (!r.ok) throw new Error('qa ticket answered ' + r.status);
  return (await r.json()).t;
}

// the sign board on screen: the fixture painted from m-psign*.png
async function signBox(page) {
  try {
    return await page.evaluate(() => {
      const el = [...document.querySelectorAll('#hsWorld .hs-ov')].find((e) => /m-psign/.test(e.style.backgroundImage || ''));
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height * 0.55, vw: innerWidth, vh: innerHeight };
    });
  } catch (e) { return null; }
}
// tap the sign until the panel opens — a far tap only walks the banana there,
// and a sign off-screen gets a tap towards it first
async function tapSignUntil(page, selector) {
  for (let i = 0; i < 8; i++) {
    const b = await signBox(page);
    if (!b) throw new Error('no sign on screen');
    const inView = b.x > 4 && b.x < b.vw - 4 && b.y > 60 && b.y < b.vh - 60;
    const x = inView ? b.x : Math.max(24, Math.min(b.vw - 24, b.x));
    const y = inView ? b.y : Math.max(120, Math.min(b.vh - 120, b.y));
    await page.mouse.click(x, y);
    try { await page.waitForSelector(selector, { state: 'visible', timeout: 3500 }); return; } catch (e) {}
  }
  throw new Error('the sign never answered: ' + selector);
}
const settled = async (page) => { const y = await yard(page); return !!(y && y.pubUpdated && !y.dirty); };
const outboxEmpty = async (page) => { const ev = await lsJ(page, 'pass-ev-v1'); return !ev || ev.length === 0; };

test.skip(!KEY, 'QA_KEY is not set — the proof needs the pass worker\'s QA login door');

test('phone A plays and adds an email; phone B logs in and sees it all; B renames; A sees that', async ({ browser }, info) => {
  const stamp = new Date().toISOString().slice(5, 16).replace(/[-T:]/g, '');   // MMDDHHmm
  const who = `proof-${stamp}-r${info.retry}-${Math.random().toString(36).slice(2, 6)}`;
  const YARD_A = `Testy Proof ${stamp.slice(2)}`;
  const YARD_B = `Testy Proof B ${stamp.slice(2)}`;
  const NAME_A = 'Proofy ' + stamp.slice(4);
  const A = await phone(browser), B = await phone(browser);
  let gid = '', sid = '', wt = '', snapA = null, passed = false;
  try {
    await test.step('A arrives and gets its pass', async () => {
      await A.page.goto('/homestead/', { waitUntil: 'domcontentloaded' });
      await A.page.waitForSelector('#hsWorld canvas', { timeout: 40000 });
      await expect.poll(async () => ((await link(A.page)) || {}).credId || '', { timeout: 45000, message: 'the anonymous pass never landed' }).toMatch(/^a:/);
      await expect.poll(() => ls(A.page, 'world-gid'), { timeout: 15000, message: 'no world id after the mint' }).toMatch(/^[a-f0-9]{16}$/);
      gid = await ls(A.page, 'world-gid');
      await A.page.screenshot({ path: `${OUT}/1-a-arrived.png` });
    });

    await test.step('A claims the homestead and names itself', async () => {
      await A.page.waitForTimeout(4000);   // the arrival walk
      await tapSignUntil(A.page, '#hsClaim');
      await A.page.fill('#hsClaimName', YARD_A);
      await A.page.click('#hsClaimGo');
      await expect.poll(async () => ((await yard(A.page)) || {}).slug || '', { timeout: 30000, message: 'the claim never got an address' }).toMatch(/^testy-proof-/);
      await A.page.waitForSelector('.bid-in', { timeout: 15000 });   // the naming ritual follows the deed
      await A.page.fill('.bid-in', NAME_A);
      await A.page.click('.bid-go');
      await expect.poll(() => ls(A.page, 'ps-name-v1'), { timeout: 15000, message: 'the name was not kept' }).toBe(NAME_A);
      await expect.poll(() => settled(A.page), { timeout: 45000, message: 'the yard save was never accepted' }).toBe(true);
      await expect.poll(() => outboxEmpty(A.page), { timeout: 90000, message: 'the pass push was never acked' }).toBe(true);
      await A.page.screenshot({ path: `${OUT}/2-a-claimed.png` });
    });

    await test.step('A adds the email', async () => {
      const t1 = await ticket(who);
      await A.page.goto('/pass/?in=' + t1, { waitUntil: 'domcontentloaded' });
      await expect.poll(async () => ((await link(A.page)) || {}).credId || '', { timeout: 30000, message: 'the email never attached' }).toMatch(/^m:/);
      expect(await ls(A.page, 'world-gid'), 'the address joined THIS pass — same person, same world id').toBe(gid);
      await A.page.waitForSelector('.ps-card--stamped', { timeout: 15000 });
      await expect.poll(() => outboxEmpty(A.page), { timeout: 60000, message: 'the pass page push was never acked' }).toBe(true);
      snapA = await A.page.evaluate(() => {
        const y = JSON.parse(localStorage.getItem('hs-v1') || '{}');
        const w = JSON.parse(localStorage.getItem('pass-wallet-v1') || 'null');
        return { slug: y.slug, name: y.name, animals: (y.animals || []).map((a) => a.id).sort(), passName: localStorage.getItem('ps-name-v1'), bal: w ? w.bal : null };
      });
      expect(snapA.slug).toMatch(/^testy-proof-/);
      expect(snapA.animals.length, 'the farm grant put animals in the yard').toBeGreaterThan(0);
      expect(snapA.bal, 'the server wallet is on the phone').not.toBeNull();
      await A.page.screenshot({ path: `${OUT}/3-a-email.png` });
    });

    await test.step('B logs in with the email and sees A\'s world', async () => {
      const t2 = await ticket(who);
      await B.page.goto('/pass/?in=' + t2, { waitUntil: 'domcontentloaded' });
      await expect.poll(async () => ((await link(B.page)) || {}).credId || '', { timeout: 30000, message: 'B never logged in' }).toMatch(/^m:/);
      await expect.poll(() => ls(B.page, 'world-gid'), { timeout: 15000, message: 'B is not the same person' }).toBe(gid);
      await expect.poll(() => ls(B.page, 'ps-name-v1'), { timeout: 15000, message: 'the name did not follow' }).toBe(NAME_A);
      await expect.poll(async () => { const w = await lsJ(B.page, 'pass-wallet-v1'); return w ? w.bal : null; }, { timeout: 15000, message: 'the coins did not follow' }).toBe(snapA.bal);
      await B.page.screenshot({ path: `${OUT}/4-b-login.png` });
      await B.page.goto('/homestead/', { waitUntil: 'domcontentloaded' });
      await B.page.waitForSelector('#hsWorld canvas', { timeout: 40000 });
      await expect.poll(async () => ((await yard(B.page)) || {}).slug || '', { timeout: 60000, message: 'B never found the homestead' }).toBe(snapA.slug);
      await expect.poll(async () => ((await yard(B.page)) || {}).name || '', { timeout: 15000 }).toBe(YARD_A);
      const yB = await yard(B.page);
      expect((yB.animals || []).map((a) => a.id).sort(), 'the animals followed').toEqual(snapA.animals);
      await expect(B.page.locator('#hsWorld .hs-signname')).toHaveText(YARD_A, { timeout: 20000 });
      sid = await ls(B.page, 'park-sid'); wt = await ls(B.page, 'world-wt');
      await B.page.screenshot({ path: `${OUT}/5-b-homestead.png` });
    });

    await test.step('B renames the sign', async () => {
      await B.page.waitForTimeout(3000);
      await tapSignUntil(B.page, '#hsGuest');
      await B.page.click('#hsGuest button:has-text("rename")');
      await B.page.waitForSelector('#hsClaim', { state: 'visible', timeout: 5000 });
      await B.page.fill('#hsClaimName', YARD_B);
      await B.page.click('#hsClaimGo');
      await expect.poll(async () => ((await yard(B.page)) || {}).name || '', { timeout: 10000 }).toBe(YARD_B);
      await expect.poll(() => settled(B.page), { timeout: 45000, message: 'B\'s save was never accepted' }).toBe(true);
      await B.page.screenshot({ path: `${OUT}/6-b-renamed.png` });
    });

    await test.step('A comes back and sees B\'s sign', async () => {
      await A.page.goto('/homestead/', { waitUntil: 'domcontentloaded' });
      await A.page.waitForSelector('#hsWorld canvas', { timeout: 40000 });
      await expect.poll(async () => ((await yard(A.page)) || {}).name || '', { timeout: 60000, message: 'A never saw the rename' }).toBe(YARD_B);
      expect(((await yard(A.page)) || {}).slug, 'a rename keeps the address').toBe(snapA.slug);
      await expect(A.page.locator('#hsWorld .hs-signname')).toHaveText(YARD_B, { timeout: 20000 });
      await A.page.screenshot({ path: `${OUT}/7-a-sees-b.png` });
    });

    const badA = realErrors(A.errs), badB = realErrors(B.errs);
    expect(badA, `phone A console:\n${badA.join('\n')}`).toHaveLength(0);
    expect(badB, `phone B console:\n${badB.join('\n')}`).toHaveLength(0);
    passed = true;
  } finally {
    // the proof leaves nothing behind: the yard by its proven owner, the pass by the QA door
    const clean = { yard: null, pass: null };
    try {
      if (wt && gid && sid) {
        clean.yard = await B.page.evaluate(async ({ api, body }) => {
          const r = await fetch(api + '/qa-erase', { method: 'POST', body: JSON.stringify(body) });
          return { status: r.status, ...(await r.json().catch(() => ({}))) };
        }, { api: YARD_API, body: { pass: gid, alt: sid, wt } });
      }
    } catch (e) { clean.yard = String(e); }
    try {
      const r = await fetch(PASS_API + '/qa/erase', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://trymstene.com' },
        body: JSON.stringify({ key: KEY, who }),
      });
      clean.pass = { status: r.status, ...(await r.json().catch(() => ({}))) };
    } catch (e) { clean.pass = String(e); }
    console.log('cleanup ' + JSON.stringify(clean));
    await A.ctx.close(); await B.ctx.close();
    if (passed) {
      expect(clean.yard && clean.yard.ok === 1 && (clean.yard.gone || []).includes(snapA.slug), 'the yard was erased: ' + JSON.stringify(clean.yard)).toBe(true);
      expect(clean.pass && clean.pass.ok === true && clean.pass.gone >= 1, 'the pass was erased: ' + JSON.stringify(clean.pass)).toBe(true);
    }
  }
});
