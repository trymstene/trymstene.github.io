// 📬 THE WORLD'S OWN POST (19 Sep 2026): the mailbox is a mailbox — a dot when something is in it, the
// letters on the world's paper, no orders in there (they live on the phone) and no move button (that is
// build mode's job). The letters are device-local by design: they never ride the public yard read.
// Since 22 Sep 2026 they are sealed envelopes in the same two-drawer card as everybody else's post.
import { test, expect } from '@playwright/test';

async function mailbox(page) {
  const g = await page.evaluate(() => { const t = window.__hs, g = t.mailGeo(); t.pos.x = t.tgt.x = g.at.x - 40; t.pos.y = t.tgt.y = g.at.y + 16; return g; });
  await page.waitForTimeout(400);
  const r = await page.locator('#hsWorld').boundingBox();
  for (let i = 0; i < 6; i++) {
    await page.mouse.click(r.x + g.at.x / g.W * r.width, r.y + (g.at.y - 20) / g.H * r.height);
    await page.waitForTimeout(500);
    if (await page.locator('#hsLetters').isVisible()) return true;
  }
  return false;
}

test('the mailbox holds the world’s post, shows a dot, and nothing else', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/homestead/?hstest=claimed', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__hs && window.__hs.mailGeo, null, { timeout: 30000 });
  await page.waitForTimeout(1500);

  // the world has written: the dot is up before anything is opened
  expect(await page.locator('.hs-maildot').isVisible(), 'the unread dot').toBe(true);
  {  // …and it reads as a dot on the box, from where a player stands
    const g = await page.evaluate(() => { const t = window.__hs, g = t.mailGeo(); t.pos.x = t.tgt.x = g.at.x - 40; t.pos.y = t.tgt.y = g.at.y + 16; return g; });
    await page.waitForTimeout(700);
    const r = await page.locator('#hsWorld').boundingBox();
    const x = r.x + g.at.x / g.W * r.width, y = r.y + g.at.y / g.H * r.height;
    await page.screenshot({ path: 'test-results/homestead-maildot.png', clip: { x: Math.max(0, x - 90), y: Math.max(0, y - 120), width: 180, height: 150 } });
  }

  expect(await mailbox(page), 'the mailbox opened its post').toBe(true);
  // ⭐ the world's notes are sealed envelopes in the Fresh drawer, signed by whoever wrote them
  const env = page.locator('#hsLetters .tw-post__env[data-id^="w:"]');
  await env.first().waitFor({ timeout: 10000 });
  const names = await env.evaluateAll((els) => els.map((e) => e.textContent.trim()));
  expect(names.length).toBeGreaterThan(0);
  expect(names.every((n) => n.length > 1 && !n.includes('{')), 'every envelope is signed: ' + names.join(' | ')).toBe(true);
  await page.locator('#hsLetters .tw-card').screenshot({ path: 'test-results/homestead-post.png' });

  // …and nothing that is not post: no orders, no move button
  const card = (await page.locator('#hsLetters').textContent()) || '';
  expect(card).not.toMatch(/on the way|move it|✥/);

  // opened, a note is on the world's paper, in the world's hand
  await env.first().click();
  const paper = page.locator('#hsLetters .tw-post__world .bw-paper').first();
  await paper.waitFor({ timeout: 5000 });
  expect(await paper.evaluate((e) => getComputedStyle(e).fontFamily)).toContain('Caveat');
  expect(await paper.textContent()).not.toContain('{');   // the placeholders are filled

  // reading it clears the dot
  await page.waitForTimeout(400);
  await page.click('#hsLettersX');
  await page.waitForTimeout(500);
  const left = await page.evaluate(() => window.__hs.mailGeo().unread);
  expect(await page.locator('.hs-maildot').isVisible()).toBe(left > 0);

  // the post is kept on the device, and ONLY there — it is not in what the yard publishes, so a
  // visitor can never read somebody's letters (⚠️ a scenario reload would re-seed the yard, so this
  // reads the store itself rather than reloading)
  const kept = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('hs-v1') || '{}'); } catch (e) { return {}; } });
  expect((kept.mail || []).length, 'the letters are saved on the device').toBeGreaterThan(0);
  expect(kept.mail[0].id).toBeTruthy();
  expect(JSON.stringify(kept.mail)).not.toContain('big book');   // a row keeps its key, never the prose
  expect(errors, 'page errors: ' + errors.join(' | ')).toEqual([]);
});

// 💼 THE CHEQUE ARRIVES (19 Sep 2026, docs/town-jobs-plan.md §3). You ask a boss for a job in the
// town, you turn up, and at the end of a week that has FINISHED a letter is waiting here saying
// what the work came to. It is the first thing in this world that ever arrives while the player was
// not looking, so the test that matters most is the quiet one: a player who has never held a job
// must never cause the request at all.
test('the cheque: a letter that arrived while you were not looking', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  let asked = 0;
  let answer = { ok: true, paid: [], total: 0 };
  await page.route('**/job/pay', async (route) => {
    asked++;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(answer) });
  });
  // ⚠️ a KEPT pass on the device, or the guard that fires first is the wrong one: passPost refuses
  // before the wire when there is no link, and then this would pass for a reason it is not testing
  await page.addInitScript(() => { try { localStorage.setItem('pass-link', JSON.stringify({ credId: 'c', token: 't' })); } catch (e) {} });
  await page.goto('/homestead/?hstest=claimed', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__hs && window.__hs.mailGeo, null, { timeout: 30000 });
  await page.waitForTimeout(2200);

  // ⭐ a kept pass, and still nobody who has never worked ever asks
  expect(asked, 'a player with a pass but no job never calls the pay route').toBe(0);

  // …now this device has held a job, and a finished week owes something
  await page.evaluate(() => localStorage.setItem('tw-job-v1', JSON.stringify({ at: 'store', week: '2026-W38', days: 3 })));
  // the server's own row shape: `pay` is the workplace's full rate — and a café week pays tips, never a cheque (rate 0)
  answer = { ok: true, total: 39, paid: [{ week: '2026-W38', at: 'store', days: 3, coins: 39, pay: 90 }, { week: '2026-W38', at: 'cafe', days: 2, coins: 0, pay: 0 }] };
  await page.evaluate(() => window.__hs.wage());
  await page.waitForTimeout(600);
  const mail = await page.evaluate(() => window.__hs.mailOf());
  const cheque = mail.find((m) => m.id.startsWith('wage:'));
  expect(cheque, 'the cheque is in the box').toBeTruthy();
  expect(cheque.id, 'and it is keyed by the week it paid for').toBe('wage:2026-W38:store');
  expect(cheque.n).toBe(39);
  expect(cheque.read, 'unread, so the dot is up').toBe(0);
  expect(mail.filter((m) => m.id.startsWith('wage:')).length, 'a tips job’s week is not a payslip').toBe(1);
  expect(await page.locator('.hs-maildot').isVisible()).toBe(true);

  // ⚠️ the same answer twice must not become two letters
  const before = (await page.evaluate(() => window.__hs.mailOf())).length;
  await page.evaluate(() => window.__hs.wage());
  await page.waitForTimeout(400);
  expect((await page.evaluate(() => window.__hs.mailOf())).length, 'a week is delivered once').toBe(before);

  // …and it reads as a letter, on the world's own paper, with the amount in it — a kraft envelope first
  expect(await mailbox(page), 'the mailbox opens').toBe(true);
  const kraft = page.locator('#hsLetters .tw-post__env.is-wage');
  await kraft.first().waitFor({ timeout: 10000 });
  expect(await kraft.count(), 'the cheque is a kraft envelope in Fresh').toBe(1);
  await kraft.first().click();
  const gold = page.locator('#hsLetters .bw-paper--wage');
  await gold.first().waitFor({ timeout: 5000 });
  expect(await gold.count(), 'the cheque is on the same paper, with its own seam').toBe(1);
  const text = await gold.first().textContent();
  expect(text).toContain('39');
  expect(text, 'no placeholder survives to the page').not.toContain('{n}');
  expect(text.length).toBeGreaterThan(30);
  expect(errors).toEqual([]);
});
