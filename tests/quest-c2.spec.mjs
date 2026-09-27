// 👻 CHAPTER TWO, GHOST WRITER (27 Sep 2026), walked as a player on a phone.
//
// Trym: *"after finishing chapter 1, you can get a quest-letter in your mailbox at the Homestead - that letter must be a
// different color than other letters - blue maybe … And thats where Nib calls for you to come visit the town … chapter 2
// must be spooky, have some twists, have some emotional stuff, and have a cliffhanger at the end"*, and his calls:
// one night, The Four Signatures retired, the quest letters blue and M.'s black.
//
// Three walks, the chapter's three places: the blue letter at home (it opens the chapter and plays its splash); every
// scene in the town in order — the page, the ink on the cobbles, the statue, Gran Fig, Stamp, Moss, the tap-tap, the
// notes, and the last night, which only opens in the dark and takes the Mayor's light with it; and the black letter at
// home, which ends it. Screenshots go to test-results/c2-*.png: this chapter is only done when it has been LOOKED at.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const COPY = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'copy', 'quest-c2.json'), 'utf8'));
const POST = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'copy', 'homestead-post.json'), 'utf8')).letters;
const SHOT = 'test-results/c2-';
const step = (k) => COPY.steps.find((s) => s.key === k);

const save = (page) => page.evaluate(() => { try { return JSON.parse(localStorage.getItem('bwq-c2') || 'null') || {}; } catch (e) { return {}; } });
// ⚠️ with a timeout: boundingBox() otherwise WAITS for the element, and the tap after a sheet's last line waits for ever
const tap = async (page, sel) => {
  const b = await page.locator(sel).first().boundingBox({ timeout: 3000 });
  if (!b) throw new Error('nothing to tap at ' + sel);
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
};
// play the open sheet to its end: your own line is a button, everything else advances on a tap; `at` names the
// lines to stop on and photograph (by the prop or speaker showing), so each prop is LOOKED at in its own scene
const playSheet = async (page, name, at = []) => {
  const seen = [];
  for (let i = 0; i < 60; i++) {
    if (!(await page.locator('.bwq-dlg').count())) return seen;
    const now = await page.evaluate(() => {
      const d = document.querySelector('.bwq-dlg');
      if (!d || d.classList.contains('is-away')) return 'away';
      const sp = d.querySelector('.bwq-sp');
      if (sp && !sp.hidden) { const pr = sp.querySelector('.bwq-prop, .bwq-mnote, .bw-paper'); return 'prop:' + (pr ? pr.className : ''); }
      return 'who:' + (d.querySelector('h2') || {}).textContent;
    });
    if (now === 'away') {
      if (!seen.includes('dark')) {
        seen.push('dark');
        if (at.includes('dark')) { await page.waitForTimeout(900); await page.screenshot({ path: SHOT + name + '-dark.png' }); }
      }
      await page.waitForTimeout(500); continue;
    }
    if (!seen.length || seen[seen.length - 1] !== now) {
      seen.push(now);
      const hit = at.find((a) => now.includes(a));
      if (hit) { await page.waitForTimeout(650); await page.screenshot({ path: SHOT + name + '-' + hit.replace(/\W+/g, '') + '.png' }); }
    }
    if (await page.locator('.bwq-ans:not([hidden]) button').count()) { await tap(page, '.bwq-ans:not([hidden]) button'); await page.waitForTimeout(240); continue; }
    await tap(page, '.bwq-dlg'); await page.waitForTimeout(120);
    await tap(page, '.bwq-dlg').catch(() => {}); await page.waitForTimeout(160);   // the first tap finishes the typing, the second moves on
  }
  throw new Error('the sheet never closed');
};
const gotIt = async (page, name) => {
  await page.waitForSelector('.bwq-reward', { timeout: 8000 });
  await page.waitForTimeout(400);
  if (name) await page.screenshot({ path: SHOT + name + '.png' });
  const text = await page.locator('.bwq-reward').textContent();
  await tap(page, '.bwq-reward button');
  await page.waitForTimeout(250);
  return text;
};

test('the blue letter at home opens chapter two, and its splash plays once it is put away', async ({ page }) => {
  test.setTimeout(120000);
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.addInitScript(() => {
    if (sessionStorage.getItem('c2-seeded')) return;
    sessionStorage.setItem('c2-seeded', '1');
    localStorage.setItem('bwq-c1', JSON.stringify({ s: 17, done: 1, in: 1 }));
    localStorage.removeItem('bwq-c2');
  });
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto('/homestead/?hstest=claimed', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__hs && window.__hs.post, null, { timeout: 30000 });

  // ── the chapter boots at home, on the letter: the note says where it is, and the mailbox holds it
  await page.waitForSelector('.bwq-hint', { timeout: 20000 });
  expect(await page.locator('.bwq-hint span').textContent()).toBe(step('letter').find);
  await page.waitForFunction(() => window.__hs.mailOf().some((m) => m.id === 'questblue'), null, { timeout: 10000 });
  await page.screenshot({ path: SHOT + '01-home-note.png' });

  await page.evaluate(() => window.__hs.post());
  await page.waitForSelector('#hsLetters .tw-post__env[data-id="w:questblue"]', { timeout: 20000 });
  const env = await page.evaluate(() => {
    const e = document.querySelector('#hsLetters .tw-post__env[data-id="w:questblue"]');
    return { cls: e.className, bg: getComputedStyle(e).backgroundColor, who: e.textContent };
  });
  expect(env.cls, 'a quest letter is a BLUE envelope').toContain('is-quest');
  expect(env.bg).toBe('rgb(158, 192, 234)');
  expect(env.who).toContain('Nib');
  await page.screenshot({ path: SHOT + '02-mailbox-blue.png' });

  // ── read it: blue paper, every paragraph, signed
  await tap(page, '#hsLetters .tw-post__env[data-id="w:questblue"]');
  await page.waitForSelector('#hsLetters .bw-paper--quest', { timeout: 8000 });
  await page.waitForTimeout(500);
  const paper = await page.locator('#hsLetters .bw-paper--quest').textContent();
  for (const l of POST.questblue.lines) expect(paper).toContain(l);
  await page.screenshot({ path: SHOT + '03-blue-letter.png' });
  expect(await page.locator('.bwq-intro').count(), 'no splash over the letter itself').toBe(0);

  // ── put it away: the splash, then the chapter moves to the town
  await tap(page, '#hsLettersX');
  await page.waitForSelector('.bwq-intro.is-on', { timeout: 8000 });
  const sp = await page.locator('.bwq-intro').textContent();
  expect(sp).toContain(COPY.chapter);
  expect(sp).toContain(COPY.title);
  await page.screenshot({ path: SHOT + '04-splash.png' });
  await page.waitForFunction(() => { try { return JSON.parse(localStorage.getItem('bwq-c2')).s === 1; } catch (e) { return false; } }, null, { timeout: 10000 });
  await page.waitForSelector('.bwq-hint', { timeout: 8000 });
  expect(await page.locator('.bwq-hint span').textContent(), 'the note points at the town').toBe(step('page').find);
  expect(errs).toEqual([]);
});

// ---- the town ------------------------------------------------------------------------------
const W = 2200, H = 1300;
const resident = (page, key) => page.evaluate((k) => window.__town.life.residents().find((r) => r.key === k) || null, key);
// ⚠️ a banana is PUT where the scene is, not walked: this walk is about the chapter, and the square's own walking has walks of its own
const standAt = async (page, x, y) => {
  await page.evaluate(([px, py]) => { const t = window.__town; t.pos.x = px; t.pos.y = py; t.tgt.x = px; t.tgt.y = py; }, [x, y]);
  await page.waitForTimeout(500);
};
// the resident the open scene belongs to walks to their place; stand beside them, the ! must be over their head, tap it
const meet = async (page, key, name) => {
  await page.waitForFunction((k) => window.bwqTalk && window.bwqTalk.who === k && window.bwqTalk.open, key, { timeout: 15000 });
  await page.waitForFunction((k) => { const r = window.__town.life.residents().find((q) => q.key === k); return r && !r.hidden && !r.walking && r.place === window.bwqTalk.station; }, key, { timeout: 60000 });
  const r = await resident(page, key);
  await standAt(page, r.x + (r.x > 1100 ? -60 : 60), r.y + 14);
  await page.waitForSelector('.bwq-mark:not([hidden])', { timeout: 5000 });
  const geo = await page.evaluate((k) => {
    const m = document.querySelector('.bwq-mark').getBoundingClientRect();
    const b = document.querySelector('.tw-npc[data-k="' + k + '"]').getBoundingClientRect();
    return { dx: Math.abs((m.left + m.width / 2) - (b.left + b.width / 2)), above: m.bottom <= b.top + b.height * 0.35 };
  }, key);
  expect(geo.dx, 'the ! rides ' + key + '’s head').toBeLessThan(26);
  expect(geo.above, 'and hangs above it').toBe(true);
  if (name) await page.screenshot({ path: SHOT + name + '.png' });
  await tap(page, '.bwq-mark');
  await page.waitForSelector('.bwq-dlg', { timeout: 6000 });
};

test('chapter two in the town: every scene in order, the ink, the statue, and the last night', async ({ page }) => {
  test.setTimeout(420000);   // nine scenes, sixty-odd bubbles typed out, four walks across the square and a nightfall
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.addInitScript(() => {
    window.__ev = []; window.gtag = (kind, name, p) => window.__ev.push(name);
    if (sessionStorage.getItem('c2-seeded')) return;
    sessionStorage.setItem('c2-seeded', '1');
    localStorage.setItem('bwq-c1', JSON.stringify({ s: 17, done: 1, in: 1 }));
    localStorage.setItem('bwq-c2', JSON.stringify({ s: 1, k: {}, in: 1 }));
    localStorage.setItem('pass-link', JSON.stringify({ credId: 'c', token: 't' }));
    localStorage.removeItem('tw-job-v1');
  });
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto('/town/?towntest', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band(), null, { timeout: 30000 });
  // a plain morning in a lively town (a struggling town keeps residents indoors), from the start of the beat
  await page.evaluate(() => { window.__town.room.curse('none'); window.__town.room.set(85); window.__town.life.set(4); });

  // ── 1. THE PAGE: Nib, held at the hall whatever the hour, the ! riding his head
  await meet(page, 'nib', '05-nib-at-hall');
  expect((await resident(page, 'nib')).place, 'the chapter holds Nib at the town hall').toBe('hall');
  await playSheet(page, '06-page', ['bwq-prop--page']);
  expect(await gotIt(page, '07-receipt-page')).toContain(step('page').note);

  // ── 2. THE INK: drops from the hall's door to the plinth, walked over, drying up behind you
  await page.waitForFunction(() => document.querySelectorAll('.bwq-drip').length === 12, null, { timeout: 8000 });
  await standAt(page, 1100, 640);
  await page.screenshot({ path: SHOT + '08-ink-at-door.png' });
  const drips = await page.evaluate(() => [...document.querySelectorAll('.bwq-drip')].map((d) => [parseFloat(d.style.left) * 22, parseFloat(d.style.top) * 13]));
  for (const [i, [x, y]] of drips.entries()) {
    await standAt(page, x, y + 2);
    if (i === 6) await page.screenshot({ path: SHOT + '09-ink-walked.png' });
  }
  // ── 3. THE STATUE opens by itself where the ink ends
  await page.waitForSelector('.bwq-dlg', { timeout: 8000 });
  await playSheet(page, '10-statue', ['bwq-prop--plinth']);
  expect((await save(page)).s, 'the statue scene pays nothing and moves on').toBe(4);

  // ── 4. GRAN FIG, in her garden
  await meet(page, 'granfig', '11-granfig-mark');
  await playSheet(page, '12-granfig', ['who:Gran Fig']);
  expect(await gotIt(page)).toContain(step('granfig').note);

  // ── 5. STAMP, at the post office: the parcel, the plaque front and back, kept as a keepsake
  await meet(page, 'stamp');
  const stampSeen = await playSheet(page, '13-stamp', ['is-scraped', 'bwq-prop--plaque']);
  expect(stampSeen.filter((s) => s.includes('bwq-prop--plaque')).length, 'the plaque, front then back').toBeGreaterThanOrEqual(2);
  expect(await gotIt(page, '14-receipt-plaque')).toContain(step('stamp').note);

  // ── 6. MOSS, in the square: the nights, and the oldest flyer
  await meet(page, 'moss');
  await playSheet(page, '15-moss', ['bwq-prop--flyer']);
  expect(await gotIt(page, '16-receipt-flyer')).toContain(step('moss').note);

  // ── 7 + 8. NIB AGAIN: tap, tap — and the Mayor's notes
  await meet(page, 'nib');
  await playSheet(page, '17-taptap', ['bwq-prop--dots']);
  await meet(page, 'nib');
  await playSheet(page, '18-notes', ['bwq-mnote']);
  expect(await gotIt(page)).toContain(step('notes').note);

  // ── 9. THE LAST NIGHT: nothing by day — no !, and Nib is only Nib
  await page.waitForFunction(() => window.bwqTalk && window.bwqTalk.who === 'nib', null, { timeout: 8000 });
  const day = await page.evaluate(() => ({ open: !!window.bwqTalk.open, mark: !!document.querySelector('.bwq-mark'), ghost: !!document.querySelector('.bwq-ghost') }));
  expect(day, 'by day the last scene waits: no !, no ghost, a tap on Nib is his own card').toEqual({ open: false, mark: false, ghost: false });
  expect(await page.locator('.bwq-hint span').textContent()).toBe(step('night').find);
  await page.evaluate(() => window.__town.life.set(20.2));   // nightfall
  await page.waitForSelector('.bwq-ghost', { timeout: 10000 });
  await page.waitForSelector('.bwq-water', { timeout: 3000 });
  await standAt(page, 1416, 400);
  await page.waitForTimeout(700);
  await page.screenshot({ path: SHOT + '19-night-statue-runs.png' });
  await meet(page, 'nib', '20-night-hall');
  const lit = await page.evaluate(() => !!document.querySelector('.bwq-mayor:not(.is-out)'));
  expect(lit, 'the Mayor’s window is lit for this player tonight').toBe(true);
  const night = await playSheet(page, '21-night', ['bwq-prop--glow', 'dark', 'bwq-prop--blank']);
  expect(night, 'the card stepped aside for the dark').toContain('dark');
  const s = await save(page);
  expect(s.s, 'the chapter now waits at home').toBe(10);
  expect(s.mail, 'for the black letter').toBe('questblack');
  expect(await page.locator('.bwq-hint span').textContent()).toBe(step('black').find);
  const ev = await page.evaluate(() => window.__ev.filter((e) => /^quest_step_c2_/.test(e)));
  expect(ev).toEqual(['quest_step_c2_page', 'quest_step_c2_drips', 'quest_step_c2_statue', 'quest_step_c2_granfig', 'quest_step_c2_stamp',
    'quest_step_c2_moss', 'quest_step_c2_taptap', 'quest_step_c2_notes', 'quest_step_c2_night']);
  expect(errs).toEqual([]);
});

test('the black letter at home ends chapter two, from M., in lower case and unsealed', async ({ page }) => {
  test.setTimeout(120000);
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.addInitScript(() => {
    window.__ev = []; window.gtag = (kind, name, p) => window.__ev.push(name);
    if (sessionStorage.getItem('c2-seeded')) return;
    sessionStorage.setItem('c2-seeded', '1');
    localStorage.setItem('bwq-c1', JSON.stringify({ s: 17, done: 1, in: 1 }));
    localStorage.setItem('bwq-c2', JSON.stringify({ s: 10, k: {}, in: 1, mail: 'questblack' }));
    localStorage.setItem('ps-name-v1', 'Testy');
  });
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto('/homestead/?hstest=claimed', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__hs && window.__hs.post, null, { timeout: 30000 });
  await page.waitForFunction(() => window.__hs.mailOf().some((m) => m.id === 'questblack'), null, { timeout: 15000 });
  expect(await page.locator('.bwq-hint span').textContent()).toBe(step('black').find);

  await page.evaluate(() => window.__hs.post());
  await page.waitForSelector('#hsLetters .tw-post__env[data-id="w:questblack"]', { timeout: 20000 });
  const env = await page.evaluate(() => {
    const e = document.querySelector('#hsLetters .tw-post__env[data-id="w:questblack"]');
    return { cls: e.className, bg: getComputedStyle(e).backgroundColor, seal: getComputedStyle(e, '::after').display, who: e.textContent };
  });
  expect(env.cls, 'M.’s letter is a BLACK envelope').toContain('is-mayor');
  expect(env.bg).toBe('rgb(27, 27, 34)');
  expect(env.seal, 'with no seal on it').toBe('none');
  expect(env.who).toContain('M.');
  await page.screenshot({ path: SHOT + '22-mailbox-black.png' });

  await tap(page, '#hsLetters .tw-post__env[data-id="w:questblack"]');
  await page.waitForSelector('#hsLetters .bw-paper--mayor', { timeout: 8000 });
  await page.waitForTimeout(500);
  const paper = await page.locator('#hsLetters .bw-paper--mayor').textContent();
  expect(paper, 'it knows your name').toContain('Testy.');
  for (const l of POST.questblack.lines.slice(1)) expect(paper).toContain(l);
  await page.screenshot({ path: SHOT + '23-black-letter.png' });

  // ── put it away: the chapter's last receipt, and the chapter is over
  await tap(page, '#hsLettersX');
  const got = await gotIt(page, '24-receipt-black');
  expect(got).toContain(step('black').note);
  await page.waitForFunction(() => { try { return JSON.parse(localStorage.getItem('bwq-c2')).done === 1; } catch (e) { return false; } }, null, { timeout: 8000 });
  const ev = await page.evaluate(() => window.__ev);
  expect(ev).toContain('quest_step_c2_black');
  expect(ev).toContain('quest_c2_done');
  expect(await page.locator('.bwq-hint').count(), 'no note left: there is nothing after the chapter').toBe(0);
  expect(errs).toEqual([]);
});

test('finishing chapter one at home turns the page over to chapter two, with no reload', async ({ page }) => {
  test.setTimeout(150000);
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.addInitScript(() => {
    if (sessionStorage.getItem('c2-seeded')) return;
    sessionStorage.setItem('c2-seeded', '1');
    localStorage.setItem('bwq-c1', JSON.stringify({ s: 16, k: {}, res: 1, resSet: 1, in: 1 }));
    localStorage.removeItem('bwq-c2');
  });
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto('/homestead/?hstest=claimed', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__hs && window.__hs.post, null, { timeout: 30000 });
  // chapter one's last scene: Nib at the plot, the name scratched out of the book
  await page.waitForFunction(() => window.bwqTalk && window.bwqTalk.who === 'nib' && window.bwqTalk.open, null, { timeout: 20000 });
  await page.evaluate(() => window.bwqTalk.open());
  await page.waitForSelector('.bwq-dlg', { timeout: 6000 });
  await playSheet(page, 'c1-end', []);
  await gotIt(page);
  await page.waitForFunction(() => { try { return JSON.parse(localStorage.getItem('bwq-c1')).done === 1; } catch (e) { return false; } }, null, { timeout: 8000 });
  // …and on the same page, a few seconds on: the blue letter is in the mailbox and the note says so
  await page.waitForFunction((t) => { const h = document.querySelector('.bwq-hint span'); return h && h.textContent === t; }, step('letter').find, { timeout: 15000 });
  await page.waitForFunction(() => window.__hs.mailOf().some((m) => m.id === 'questblue' && !m.read), null, { timeout: 8000 });
  await page.screenshot({ path: SHOT + '25-c1-to-c2.png' });
  expect(errs).toEqual([]);
});
