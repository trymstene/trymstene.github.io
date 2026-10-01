// 🍌📌 A PASS AND A DISCORD ACCOUNT, TIED ONLY BY A TAP (1 Oct 2026). BananaBOT's /link hands its asker a one-time code and a
// button to /pass/?discord=CODE. The code leaves the address bar at once; the card names the Discord account the code belongs
// to and ties nothing until the tap (a code sent to somebody else must never tie THEIR pass to a stranger). Beside Log out,
// the tied account and an Unlink. Nothing leaves the machine: every worker answer below is a stub.
import { test, expect } from '@playwright/test';
import WORDS from '../src/data/copy/pass-toasts.json' with { type: 'json' };

const D = WORDS.discord;
const CODE = 'QAK7PX';

async function land(page, { url = '/pass/?discord=' + CODE, peek = { name: 'qa.banana' }, linkedAlready = false, pass = true } = {}) {
  const errs = [], calls = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  let tied = linkedAlready;
  // ⚠️ the LAST route added answers first, so every stub goes in after the blanket abort
  await page.route(/workers\.dev|googletagmanager|google-analytics|cloudflareinsights|facebook|clarity/, (r) => r.abort());
  await page.route(/banana-pass\.trymstene\.workers\.dev\/anon$/, (r) => { calls.push('anon'); r.fulfill({ json: { credId: 'a:qa-disc', token: 'qa-anon-token', gid: 'qa-disc-1' } }); });
  await page.route(/banana-pass\.trymstene\.workers\.dev\/discord\/(peek|link|status|forget)$/, async (r) => {
    const what = r.request().url().split('/discord/')[1];
    const body = JSON.parse(r.request().postData() || '{}');
    calls.push({ what, body });
    if (what === 'peek') return r.fulfill(peek ? { json: peek } : { status: 404, json: { error: 'gone' } });
    if (what === 'link') { tied = true; return r.fulfill({ json: { ok: true, name: 'qa.banana' } }); }
    if (what === 'status') return r.fulfill({ json: tied ? { linked: true, name: 'qa.banana' } : { linked: false } });
    if (what === 'forget') { tied = false; return r.fulfill({ json: { ok: true } }); }
  });
  await page.addInitScript(([pass]) => {
    if (sessionStorage.getItem('qa-disc-seeded')) return;
    sessionStorage.setItem('qa-disc-seeded', '1');
    localStorage.setItem('tt-internal', '1');
    localStorage.setItem('world-gid', 'qa-disc-1');
    if (pass) localStorage.setItem('pass-link', JSON.stringify({ credId: 'm:qa-disc', token: 'qa-token' }));
  }, [pass]);
  await page.goto(url);
  await page.waitForTimeout(1500);
  return { errs, calls };
}
const toastText = (page) => page.evaluate(() => [...document.querySelectorAll('.pass-toast, [class*="toast"]')].map((t) => t.textContent.trim()).filter(Boolean).join(' | '));
const onScreen = (page, sel) => page.evaluate((s) => {
  const e = document.querySelector(s);
  if (!e || e.hidden) return null;
  const r = e.getBoundingClientRect();
  return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, vw: innerWidth, vh: innerHeight };
}, sel);

for (const [w, h] of [[360, 640], [393, 852], [1280, 800]]) {
  test(`a /link code asks first, names the account, and ties only on the tap (${w}×${h})`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    const { errs, calls } = await land(page);
    expect(new URL(page.url()).search, 'the code leaves the address bar at once').toBe('');
    const box = await onScreen(page, '#psDiscord');
    expect(box, 'the ask is up').not.toBeNull();
    expect(box.top >= 0 && box.bottom <= box.vh && box.left >= 0 && box.right <= box.vw, 'whole and on screen: ' + JSON.stringify(box)).toBe(true);
    expect(await page.textContent('#psDiscordAsk')).toBe(D.ask.replace('{name}', 'qa.banana'));
    expect(await page.textContent('#psDiscordNote')).toBe(D.note);
    expect(await page.textContent('#psDiscordGo')).toBe(D.go);
    expect(calls.filter((c) => c.what === 'link'), '⭐ nothing is tied before the tap').toEqual([]);
    const go = await page.evaluate(() => { const b = document.getElementById('psDiscordGo'); return { h: b.getBoundingClientRect().height, lh: parseFloat(getComputedStyle(b).lineHeight) || 0 }; });
    expect(go.h, 'the button holds one line').toBeLessThan(60);
    if (w === 393) await page.screenshot({ path: 'test-results/pass-discord-ask.png' });

    await page.click('#psDiscordGo');
    await page.waitForTimeout(700);
    const link = calls.find((c) => c.what === 'link');
    expect(link && link.body, 'the tap ties the code to THIS pass').toEqual({ code: CODE, credId: 'm:qa-disc', token: 'qa-token' });
    expect(await page.isHidden('#psDiscord'), 'the ask goes away').toBe(true);
    expect(await page.isHidden('#psShareModal'), '⭐ a tap on the strip is not a tap on the card: the share card stays shut').toBe(true);
    expect(await toastText(page)).toContain(D.doneTitle);

    // the account drawer: the tied Discord, and Unlink beside Log out
    await page.click('#psKeep > summary');
    await page.waitForTimeout(300);
    expect(await page.textContent('#psDiscordName')).toBe(D.row.replace('{name}', 'qa.banana'));
    const row = await onScreen(page, '#psDiscordRow');
    expect(row, 'the row shows').not.toBeNull();
    if (w === 393) { await page.locator('#psDiscordRow').scrollIntoViewIfNeeded(); await page.screenshot({ path: 'test-results/pass-discord-row.png' }); }
    await page.click('#psDiscordUnlink');
    await page.waitForTimeout(600);
    expect(calls.some((c) => c.what === 'forget'), 'Unlink asks the worker').toBe(true);
    expect(await page.isHidden('#psDiscordRow'), 'and the row goes').toBe(true);
    expect(await toastText(page)).toContain(D.unlinkedTitle);
    expect(errs).toEqual([]);
  });
}

test('a code that ran out says how to get a new one, and asks nothing', async ({ page }) => {
  const { errs, calls } = await land(page, { peek: null });
  expect(await page.isHidden('#psDiscord')).toBe(true);
  expect(await toastText(page)).toContain(D.gone);
  expect(calls.filter((c) => c.what === 'link')).toEqual([]);
  expect(errs).toEqual([]);
});

test('“Not now” leaves the pass untied', async ({ page }) => {
  const { errs, calls } = await land(page);
  expect(await page.textContent('#psDiscordLater')).toBe(D.later);
  await page.click('#psDiscordLater');
  await page.waitForTimeout(400);
  expect(await page.isHidden('#psDiscord')).toBe(true);
  expect(await page.isHidden('#psShareModal')).toBe(true);
  expect(calls.filter((c) => c.what === 'link')).toEqual([]);
  expect(errs).toEqual([]);
});

test('a visitor with no pass yet gets one on the tap, and that pass is the one tied', async ({ page }) => {
  const { errs, calls } = await land(page, { pass: false });
  await page.click('#psDiscordGo');
  await page.waitForTimeout(900);
  expect(calls.includes('anon'), 'the anonymous pass is minted first').toBe(true);
  const link = calls.find((c) => c.what === 'link');
  expect(link && link.body).toEqual({ code: CODE, credId: 'a:qa-disc', token: 'qa-anon-token' });
  expect(await toastText(page)).toContain(D.doneTitle);
  expect(errs).toEqual([]);
});

test('a tied pass shows its Discord in the account drawer on an ordinary visit', async ({ page }) => {
  const { errs } = await land(page, { url: '/pass/', linkedAlready: true });
  expect(await page.isHidden('#psDiscord')).toBe(true);
  await page.click('#psKeep > summary');
  await page.waitForTimeout(300);
  expect(await page.textContent('#psDiscordName')).toBe(D.row.replace('{name}', 'qa.banana'));
  expect(await page.textContent('#psDiscordUnlink')).toBe(D.unlink);
  expect(errs).toEqual([]);
});

// the login strip is the same kind of strip on the same card: "Log me in" from a mail link opened the share card over the
// page until 1 Oct 2026 (the card's own tap-to-share heard the tap)
test('“Log me in” from a mail link does not open the share card', async ({ page }) => {
  const { errs } = await land(page, { url: '/pass/?in=qa-ticket', peek: null, pass: false });
  expect(await page.isVisible('#psFinish'), 'the login strip waits for the tap').toBe(true);
  await page.click('#psFinishGo');
  await page.waitForTimeout(800);
  expect(await page.isHidden('#psShareModal')).toBe(true);
  expect(errs).toEqual([]);
});
