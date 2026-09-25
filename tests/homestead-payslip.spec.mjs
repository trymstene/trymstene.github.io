// 📄 THE PAYSLIP (22 Sep 2026; docs/town-jobs-plan.md §11.3, §12). Trym: *"the paycheck should have a different
// color paper or look or envelope style visual for when you get paid … the user gets the reasoning in the
// payslip why the pay is lower this time if they havent done much."*
//
// The wage letter in the homestead mailbox is a payslip: a kraft envelope in the Fresh drawer, and inside it
// kraft paper, a rubber stamp, Nib's line, and the figures printed under it — the workplace, the week's counts
// duty by duty, the share of the rate they came to, the total with its coin. All words are the rig's; the
// numbers are what /job/pay dropped in the row. A slip delivered before the counts existed keeps its line and
// prints no figures. And the boss's own letters land in the same box: the Thursday nudge, and the goodbye.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const COPY = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'copy', 'homestead-post.json'), 'utf8'));
const DUTY = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'copy', 'town-duties.json'), 'utf8'));

test('a cheque in the box is a payslip with the week’s counts and the share; the boss writes too', async ({ page }) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  // the post room is empty: this walk is about the world's own notes
  await page.route('**/post/box', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"letters":[],"unread":0,"knocks":0}' }));
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto('/homestead/?hstest=claimed', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__hs && window.__hs.mail, null, { timeout: 30000 });
  await page.evaluate(() => window.__hs.slug('my-yard'));
  // this week's slip with its counts, one from before the counts existed, and the boss's two letters
  await page.evaluate(() => {
    window.__hs.mail({ id: 'wage:2026-W37:condo', n: 30, d: 4, at: 'condo', r: 60, share: 0.5, duties: [{ kind: 'sweep', done: 2, of: 3 }, { kind: 'fix', done: 1, of: 3 }] });
    window.__hs.mail({ id: 'wage:2026-W36:store', n: 26 });
    window.__hs.mail({ id: 'nudge:2026-W38:condo', at: 'condo' });
    window.__hs.mail({ id: 'fired:2026-W38:store', at: 'store' });
  });
  await page.evaluate(() => window.__hs.post());
  await page.waitForSelector('#hsLetters .tw-post__env.is-wage', { timeout: 15000 });
  // 💼 the envelope already says it is pay: kraft, in the same Fresh drawer as everything else
  const envs = await page.evaluate(() => [...document.querySelectorAll('#hsLetters .tw-post__env.is-wage')].map((e) => ({ id: e.dataset.id, bg: getComputedStyle(e).backgroundColor })));
  expect(envs.map((e) => e.id).sort(), 'both slips arrive in kraft envelopes').toEqual(['w:wage:2026-W36:store', 'w:wage:2026-W37:condo']);
  await page.screenshot({ path: 'test-results/homestead-payslip-fresh.png' });

  // open each of the four the way a player does, and read the paper that comes out
  const papers = [];
  for (const id of ['w:wage:2026-W37:condo', 'w:wage:2026-W36:store', 'w:nudge:2026-W38:condo', 'w:fired:2026-W38:store']) {
    await page.locator(`#hsLetters .tw-post__env[data-id="${id}"]`).click();
    await page.waitForSelector('#hsLetters .tw-post__world .bw-paper', { timeout: 5000 });
    papers.push(await page.evaluate(() => {
      const p = document.querySelector('#hsLetters .tw-post__world .bw-paper');
      return {
        wage: p.classList.contains('bw-paper--wage'),
        stamp: (p.querySelector('.bw-slip__stamp') || {}).textContent || '',
        at: (p.querySelector('.bw-slip__at') || {}).textContent || '',
        duties: [...p.querySelectorAll('.bw-slip__duty')].map((d) => d.textContent.replace(/\s+/g, ' ').trim()),
        terms: (p.querySelector('.bw-slip__terms') || {}).textContent || '',
        total: (p.querySelector('.bw-slip__total b') || {}).textContent || '',
        rows: !!p.querySelector('.bw-slip__rows'),
        text: p.textContent,
        kraft: getComputedStyle(p).backgroundColor,
        from: (p.querySelector('.bw-paper__from') || {}).textContent || '',
      };
    }));
    if (id === 'w:wage:2026-W37:condo') {
      await page.waitForTimeout(700);   // the envelope comes open for half a second; the picture is of the settled slip
      await page.evaluate(() => { const r = document.querySelector('.bw-slip__rows'); if (r) r.scrollIntoView({ block: 'center' }); });
      await page.waitForTimeout(250);
      await page.screenshot({ path: 'test-results/homestead-payslip.png' });
    }
    await page.click('#twPostBack');
    await page.waitForTimeout(250);
  }
  const slips = papers.filter((p) => p.wage);
  expect(slips.length, 'both slips are in the box').toBe(2);
  const today = slips.find((s) => s.rows), old = slips.find((s) => !s.rows);
  expect(today, 'this week’s slip prints its figures').toBeTruthy();
  expect(today.stamp, 'the stamp is the rig’s word, in capitals').toBe(COPY.wage.stamp);
  expect(today.at, 'the workplace, as the rig prints it').toBe(COPY.wage.at.condo);
  expect(today.duties, 'the week’s counts, duty by duty, with the rig’s labels').toEqual([DUTY.kinds.sweep + ' 2/3', DUTY.kinds.fix + ' 1/3']);
  expect(today.terms, 'the share of the rate they came to').toContain('50%');
  expect(today.terms, '…and the rate').toContain('60');
  expect(today.terms.replace(/\d+%|\d+/g, '{}'), 'around the rig’s share line').toBe(COPY.wage.slip.replace(/\{pct\}|\{rate\}/g, '{}'));
  expect(today.total, 'the total with its coin').toBe('30');
  expect(today.text, 'Nib’s line carries the total too').toContain('30');
  expect(today.from, 'signed by the payroll desk').toBe(COPY.wage.from);
  expect(today.kraft, 'on kraft paper, not the cream sheet').toBe('rgb(217, 187, 142)');
  expect(old, 'the old slip is still a slip').toBeTruthy();
  expect(old.stamp, '…with the stamp').toBe(COPY.wage.stamp);
  expect(old.rows, '…but no figures it never had').toBe(false);
  // the boss's letters: Spinner asking, Pip saying goodbye — on the ordinary cream paper, in their own hand
  const nudgeText = COPY.bosses.nudge.condo.line.split('{home}')[0].trim().slice(0, 24);
  const nudge = papers.find((p) => !p.wage && p.text.includes(nudgeText));
  expect(nudge, 'Spinner’s Thursday letter is in the box').toBeTruthy();
  expect(nudge.from, 'signed by Spinner').toBe(COPY.bosses.nudge.condo.from);
  const fired = papers.find((p) => !p.wage && p.text.includes(COPY.bosses.fired.store.line.split('{home}')[0].trim().slice(0, 24)));
  expect(fired, 'Pip’s goodbye is in the box').toBeTruthy();
  expect(fired.from, 'signed by Pip').toBe(COPY.bosses.fired.store.from);
  // ⭐ read, all four are filed under who wrote them: Nib's two slips are one row, not two
  await page.locator('#hsLetters .tw-post__tab[data-drawer="kept"]').click();
  await page.waitForTimeout(200);
  const kept = await page.evaluate(() => window.__hs.card().state().threads.filter((t) => t.key.startsWith('r:')));
  const nib = kept.find((t) => t.name === COPY.wage.from);
  expect(nib && nib.n, 'the payroll desk’s slips are one row').toBeGreaterThanOrEqual(2);
  expect(errs, 'nothing threw').toEqual([]);
});

// 📄 A WEEK THAT PAID NOTHING ARRIVES TOO (22 Sep 2026, the jobs audit): the counts are the reason, on paper, before
// the boss ever writes about letting you go. "PAID" over nothing would be untrue, so it has its own stamp and line.
test('a week that paid nothing is a slip too: its NONE stamp, Nib’s line for it, and the counts that explain it', async ({ page }) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.route('**/post/box', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"letters":[],"unread":0,"knocks":0}' }));
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto('/homestead/?hstest=claimed', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__hs && window.__hs.mail, null, { timeout: 30000 });
  await page.evaluate(() => window.__hs.slug('my-yard'));
  await page.evaluate(() => window.__hs.mail({ id: 'wage:2026-W35:condo', n: 0, d: 0, at: 'condo', r: 60, share: 0, duties: [{ kind: 'sweep', done: 0, of: 3 }, { kind: 'fix', done: 0, of: 3 }] }));
  await page.evaluate(() => window.__hs.post());
  await page.waitForSelector('#hsLetters .tw-post__env[data-id="w:wage:2026-W35:condo"]', { timeout: 15000 });
  await page.locator('#hsLetters .tw-post__env[data-id="w:wage:2026-W35:condo"]').click();
  await page.waitForSelector('#hsLetters .tw-post__world .bw-paper--wage', { timeout: 5000 });
  const slip = await page.evaluate(() => {
    const p = document.querySelector('#hsLetters .tw-post__world .bw-paper--wage'), st = p.querySelector('.bw-slip__stamp');
    return { stamp: st.textContent, nil: st.classList.contains('is-nil'), ink: getComputedStyle(st).color, text: p.textContent,
      duties: [...p.querySelectorAll('.bw-slip__duty')].map((d) => d.textContent.replace(/\s+/g, ' ').trim()), total: (p.querySelector('.bw-slip__total b') || {}).textContent };
  });
  expect(slip.stamp, 'its own stamp, the rig’s word').toBe(COPY.wage.void);
  expect(slip.nil, 'in its own ink').toBe(true);
  expect(slip.ink, 'the clerk’s grey-blue, not the red of a paid slip').toBe('rgb(63, 84, 112)');
  expect(slip.text, 'Nib’s line for a week that paid nothing').toContain(COPY.wage.none);
  expect(slip.duties, 'and the counts that are the reason').toEqual([DUTY.kinds.sweep + ' 0/3', DUTY.kinds.fix + ' 0/3']);
  expect(slip.total, 'the total is nothing').toBe('0');
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'test-results/homestead-payslip-nil.png' });
  expect(errs, 'nothing threw').toEqual([]);
});

// 🪜 THE BOSS HAS NEWS, AND YOU HAVE NOT COME BY (23 Sep 2026; Trym: promotion happens AT THE BOSS, with a note in the
// mailbox if you don't come). The job view every /job/pay carries says the XP has crossed the line; the homestead drops
// the boss's letter once per rank waiting — and the letter only asks you over: the promotion is still told in person.
test('a promotion waiting at the boss is a letter from the boss, once per rank', async ({ page }) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.route('**/post/box', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"letters":[],"unread":0,"knocks":0}' }));
  const lad = { xp: 260, rank: 1, today: 0, news: true };
  await page.route('**/job/pay', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, total: 0, paid: [], job: { at: 'cafe', week: '2026-W39', days: 1, pay: 0, duties: [], share: 0, sofar: 0, owed: 0, nudge: false, fired: null, lad } }) }));
  await page.addInitScript(() => { try { localStorage.setItem('pass-link', JSON.stringify({ credId: 'c', token: 't' })); localStorage.setItem('tw-job-v1', JSON.stringify({ at: 'cafe' })); } catch (e) {} });
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto('/homestead/?hstest=claimed', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__hs && window.__hs.mail && window.__hs.wage, null, { timeout: 30000 });
  await page.evaluate(() => window.__hs.slug('my-yard'));
  await page.evaluate(() => window.__hs.wage());
  await page.waitForTimeout(500);
  let mail = await page.evaluate(() => window.__hs.mailOf());
  expect(mail.filter((m) => m.id.startsWith('news:')).map((m) => m.id), 'Bean’s letter, keyed by the rank that waits').toEqual(['news:2:cafe']);
  await page.evaluate(() => window.__hs.wage());
  await page.waitForTimeout(400);
  mail = await page.evaluate(() => window.__hs.mailOf());
  expect(mail.filter((m) => m.id.startsWith('news:')).length, 'and only once').toBe(1);
  await page.evaluate(() => window.__hs.post());
  await page.waitForSelector('#hsLetters .tw-post__env[data-id="w:news:2:cafe"]', { timeout: 15000 });
  await page.locator('#hsLetters .tw-post__env[data-id="w:news:2:cafe"]').click();
  await page.waitForSelector('#hsLetters .tw-post__world .bw-paper', { timeout: 5000 });
  const paper = await page.evaluate(() => { const p = document.querySelector('#hsLetters .tw-post__world .bw-paper'); return { text: p.textContent, from: (p.querySelector('.bw-paper__from') || {}).textContent || '', wage: p.classList.contains('bw-paper--wage') }; });
  expect(paper.text, 'in Bean’s own words').toContain(COPY.bosses.news.cafe.line);
  expect(paper.from, 'signed by Bean').toBe(COPY.bosses.news.cafe.from);
  expect(paper.wage, 'on the ordinary paper, not a payslip').toBe(false);
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/homestead-news-letter.png' });
  expect(errs, 'nothing threw').toEqual([]);
});

// ↕ A PAYSLIP CARRIES ITS WEEK'S REVIEW (23 Sep 2026): a full week's extra, or a poor week's cost and the word it brought
test('a payslip prints what the week’s review said', async ({ page }) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.route('**/post/box', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"letters":[],"unread":0,"knocks":0}' }));
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto('/homestead/?hstest=claimed', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__hs && window.__hs.mail, null, { timeout: 30000 });
  await page.evaluate(() => window.__hs.slug('my-yard'));
  await page.evaluate(() => {
    window.__hs.mail({ id: 'wage:2026-W37:store', n: 150, d: 3, at: 'store', r: 150, share: 1, duties: [{ kind: 'restock', done: 3, of: 3 }, { kind: 'days', done: 3, of: 3 }], rv: 'full', rx: 100 });
    window.__hs.mail({ id: 'wage:2026-W38:store', n: 25, d: 1, at: 'store', r: 180, share: 1 / 6, duties: [{ kind: 'restock', done: 0, of: 3 }, { kind: 'days', done: 1, of: 3 }], rv: 'poor', rx: -100, rw: true });
  });
  await page.evaluate(() => window.__hs.post());
  const read = async (id) => {
    await page.waitForSelector('#hsLetters .tw-post__env[data-id="' + id + '"]', { timeout: 15000 });
    await page.locator('#hsLetters .tw-post__env[data-id="' + id + '"]').click();
    await page.waitForSelector('#hsLetters .tw-post__world .bw-paper--wage', { timeout: 5000 });
    const t = await page.evaluate(() => [...document.querySelectorAll('#hsLetters .tw-post__world .bw-slip__duty')].map((d) => d.textContent.trim()));
    return t;
  };
  let rows = await read('w:wage:2026-W37:store');
  expect(rows, 'a full week says so on the slip').toContain(COPY.wage.review.full.replace('{xp}', '100'));
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'test-results/homestead-payslip-review.png' });
  await page.click('#twPostBack');
  await page.waitForTimeout(250);
  rows = await read('w:wage:2026-W38:store');
  expect(rows, 'a poor week says what it cost').toContain(COPY.wage.review.poor.replace('{xp}', '100'));
  expect(rows, '…and that the boss wants a word').toContain(COPY.wage.warned);
  expect(errs, 'nothing threw').toEqual([]);
});
