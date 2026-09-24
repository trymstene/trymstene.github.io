// 👀 A NEWCOMER'S FIRST MINUTES IN THE TOWN — for the eye, not a gate (24 Sep 2026). Fresh storage, a phone, no pass.
// It logs every line the player is shown, in order, and takes a picture of every state. Opt-in: NEWCOMER=1.
import { test } from '@playwright/test';
import fs from 'node:fs';
test.skip(!process.env.NEWCOMER, 'for the eye: NEWCOMER=1');
const SHOT = 'qa-shots/newcomer/';
const tap = async (page, sel) => { const b = await page.locator(sel).first().boundingBox(); if (!b) return false; await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); return true; };
const settled = async (page) => { let last = null; for (let i = 0; i < 40; i++) { const now = await page.locator('.bwq-dlg').textContent().catch(() => null); if (now === null) return ''; if (now === last) return now; last = now; await page.waitForTimeout(220); } return last || ''; };

test('a newcomer on a phone: what they are shown, in order', async ({ page }) => {
  test.setTimeout(300000);
  fs.mkdirSync(SHOT, { recursive: true });
  const log = [];
  const note = (s) => { log.push(s); };
  page.on('pageerror', (e) => note('PAGEERROR ' + e));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/town/?towntest&questreset', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band(), null, { timeout: 30000 });
  // what is on screen, as words: the chips, the note, the toast
  const words = () => page.evaluate(() => {
    const t = (s) => { const e = document.querySelector(s); return e && !e.hidden && e.offsetParent !== null ? (e.innerText || '').replace(/\s+/g, ' ').trim() : ''; };
    return { quest: t('.bwq-hint'), work: t('.twd-chip'), toast: t('#twToast'), hud: t('.hud, .bw-hud, #twHud') };
  });
  let shot = 0;
  const look = async (what) => { const w = await words(); note(`\n[${++shot}] ${what}\n    quest: ${w.quest}\n    work:  ${w.work}\n    toast: ${w.toast}`); await page.screenshot({ path: SHOT + String(shot).padStart(2, '0') + '-' + what.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.png' }); };
  await page.waitForTimeout(1500); await look('arrival');
  await page.waitForTimeout(4000); await look('five seconds in');
  // tap the ! over Nib
  const hit = await tap(page, '.bwq-mark, .bwq-bang, [data-quest-mark]');
  note('tapped the mark: ' + hit);
  if (!hit) { const n = await page.evaluate(() => { const r = window.__town.life.residents().find((x) => x.key === 'nib'); const w = document.getElementById('twWorld'), sc = parseFloat(w.style.getPropertyValue('--ws')), b = w.getBoundingClientRect(); return r ? { x: b.left + r.x * sc, y: b.top + (r.y - 30) * sc } : null; }); if (n) await page.mouse.click(n.x, n.y); note('tapped Nib by position: ' + JSON.stringify(n)); }
  await page.waitForTimeout(1200); await look('after tapping Nib'); await page.waitForSelector('.bwq-dlg', { timeout: 10000 }).catch(() => {});
  // play the scene, logging every bubble and every answer button
  for (let i = 0; i < 40; i++) {
    if (!(await page.locator('.bwq-dlg').count())) break;
    const said = await settled(page);
    const ans = await page.locator('.bwq-ans:not([hidden]) button').allTextContents().catch(() => []);
    note('  bubble: ' + said.replace(/\s+/g, ' ').trim() + (ans.length ? '   [buttons: ' + ans.join(' | ') + ']' : ''));
    if (i === 1) await look('mid-scene');
    if (ans.length) await tap(page, '.bwq-ans:not([hidden]) button'); else await tap(page, '.bwq-dlg');
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(1500); await look('after the scene');
  await page.waitForTimeout(5000); await look('five seconds after');
  // the things a newcomer taps next: a counter they do not work at, a shop with an inside, a boss
  for (const k of ['cafe', 'stand', 'post', 'store']) {
    await page.evaluate((key) => window.__town.open(key), k);
    await page.waitForTimeout(3500);
    const card = await page.evaluate(() => { const p = document.getElementById('twPanel'); return p && !p.hidden ? (document.getElementById('twCardBody') || p).innerText.replace(/\s+/g, ' ').trim().slice(0, 400) : ''; });
    await look('tapped ' + k);
    note('    card: ' + card);
    await page.evaluate(() => { const x = document.getElementById('twCardX'); if (x) x.click(); if (window.__town.rooms.now()) window.__town.rooms.exit(); });
    await page.waitForTimeout(800);
  }
  // asking a boss for a job with no pass
  const ask = await page.evaluate(() => window.__town.work.ask('bean'));
  note('\nasking Bean for a job with no pass: ' + JSON.stringify(ask));
  fs.writeFileSync(SHOT + 'log.txt', log.join('\n'));
});
