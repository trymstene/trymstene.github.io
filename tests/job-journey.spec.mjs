// 💼 THE JOB JOURNEY, LIVE (24 Sep 2026; Trym: "are we giving the proper messages to users before, while, and after users
// gets a job? … i need you to atleast have high confidence that this will feel good for players").
//
// Every other job walk hires through the walk's door (work.set) and stubs the pass worker, so none of them has ever
// experienced a job the way a player does. This one does, on a phone, against the LIVE pass worker (a QA-stamped pass from
// the QA login door, erased at the end): a stranger taps the workplaces, asks a boss with no saved pass, saves it, asks
// again, is hired, works a first shift or answers the first calls at each of the five workplaces, and quits. A recorder in
// the page writes down every line the player is shown — toast, work note, card, tray, big moment — with the time it
// appeared, so what is said WHEN can be read afterwards (qa-shots/journey/timeline.txt), beside a picture of each state.
// It asserts little on purpose: it is the evidence a person reads.
import { test } from '@playwright/test';
import fs from 'node:fs';
import LIFE from '../src/data/copy/town-life.json' with { type: 'json' };
import STAFF from '../src/data/copy/town-staff.json' with { type: 'json' };
import NPCS from '../src/data/copy/town-npcs.json' with { type: 'json' };

const NAMES = Object.fromEntries(NPCS.residents.map((r) => [r.key, r.name]));

const PASS_API = 'https://banana-pass.trymstene.workers.dev';
const KEY = (process.env.QA_KEY || '').trim();
const OUT = 'qa-shots/journey/';
test.skip(!KEY, 'QA_KEY is not set — the journey needs the pass worker\'s QA login door');

async function ticket(who) {
  const r = await fetch(PASS_API + '/qa/ticket', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://trymstene.com' }, body: JSON.stringify({ key: KEY, who }) });
  if (!r.ok) throw new Error('qa ticket answered ' + r.status);
  return (await r.json()).t;
}

// the recorder: every change to what the player can read, stamped with the page's clock
const RECORD = () => {
  window.__msgs = []; let last = {};
  const vis = (el) => !!el && !el.hidden && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).display !== 'none' && +getComputedStyle(el).opacity > 0.05;
  const txt = (el) => ((el && el.innerText) || '').replace(/\s+/g, ' ').trim();
  setInterval(() => {
    try {
      const panel = document.getElementById('twPanel');
      const tray = [...document.querySelectorAll('.tw-cup')].find(vis);
      const cur = {
        toast: vis(document.getElementById('twToast')) ? txt(document.getElementById('twToast')) : '',
        note: vis(document.querySelector('.twd-chip')) ? txt(document.querySelector('.twd-chip')) : '',
        card: panel && !panel.hidden ? txt(document.getElementById('twCardBody')) : '',
        moment: txt(document.querySelector('.wm-moment')),
        tray: tray ? (txt(tray.querySelector('.tw-cup__note')) + ' ⟨' + txt(tray.querySelector('.tw-cup__go')) + '⟩') : '',
        // where the banana is while a counter's tray is up, to the nearest 40 px (a shift ends 8 s off its mark)
        pos: tray && window.__town ? Math.round(window.__town.pos.x / 40) * 40 + ',' + Math.round(window.__town.pos.y / 40) * 40 + (tray.classList.contains('is-folded') ? ' folded' : '') : '',
      };
      for (const k in cur) if (cur[k] !== last[k]) window.__msgs.push([Math.round(performance.now()), k, cur[k]]);
      last = cur;
    } catch (e) {}
  }, 100);
};

test('a real player’s job journey, every line in order', async ({ browser }) => {
  fs.mkdirSync(OUT, { recursive: true });
  const who = 'journey-' + new Date().toISOString().slice(5, 16).replace(/[-T:]/g, '') + '-' + Math.random().toString(36).slice(2, 6);
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, hasTouch: true, isMobile: true });
  await ctx.addInitScript(() => { try { localStorage.setItem('cookie-consent-v1', 'n'); } catch (e) {} });
  // chapter one is behind this player: the journey is about work, and the newcomer's first minute has its own walk
  await ctx.addInitScript(() => { try { if (!localStorage.getItem('bwq-c1')) localStorage.setItem('bwq-c1', JSON.stringify({ s: 16, k: {}, res: 0, done: 1, resSet: 1 })); } catch (e) {} });
  await ctx.addInitScript(RECORD);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  const timeline = [];
  let step = '', shot = 0, t0 = 0;
  const flush = async () => {
    try {
      const m = await page.evaluate(() => { const a = window.__msgs || []; window.__msgs = []; return a; });
      for (const [t, k, v] of m) timeline.push(`${String(((t - t0) / 1000).toFixed(1)).padStart(6)}s  ${k.padEnd(6)} ${v === '' ? '∅' : v}`);
    } catch (e) {}
  };
  const mark = async (s) => { await flush(); step = s; timeline.push('\n── ' + s); t0 = await page.evaluate(() => performance.now()).catch(() => 0); };
  const look = async (what) => { await page.screenshot({ path: OUT + String(++shot).padStart(2, '0') + '-' + what.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.png' }); };
  const wait = (ms) => page.waitForTimeout(ms);
  const town = async () => {
    await flush();
    await page.goto('/town/', { waitUntil: 'domcontentloaded' });
    t0 = 0;   // a new page, a new clock: times after a load count from the load
    await page.waitForFunction(() => window.__town && window.__town.room && window.__town.work && window.__town.life && window.__town.life.residents().some((r) => r.place), null, { timeout: 45000 });
    await wait(2500);
  };
  // walk up to a resident and tap them, the way a thumb does: a tap on their body walks you there, then the card opens
  // ⚠️ residents stand close at some beats (run 4: at night Stamp stood in front of Bean, the tap on Bean's middle opened
  // Stamp's card, and "the café hire" was a post office hire) — so the card's NAME is checked, and a miss is closed and
  // the tap moves up the body, where the one behind shows over the one in front
  const talk = async (key) => {
    const name = NAMES[key];
    for (let i = 0; i < 60; i++) {
      const out = await page.evaluate((k) => { const r = window.__town.life.residents().find((x) => x.key === k); return !!r && !r.hidden; }, key);
      if (out) break;
      if (i === 0) timeline.push(`   (${name} is not out in the square; waiting)`);
      await wait(3000);
    }
    await page.evaluate((k) => { const t = window.__town, r = t.life.residents().find((x) => x.key === k); if (r) { t.pos.x = t.tgt.x = r.x + 90; t.pos.y = t.tgt.y = r.y + 10; } }, key);
    await wait(900);
    const spots = [[0.5, 0.45], [0.5, 0.2], [0.35, 0.12], [0.65, 0.12], [0.5, 0.06], [0.3, 0.3]];
    for (const [fx, fy] of spots) {
      const b = await page.locator(`.tw-npc[data-k="${key}"]`).boundingBox().catch(() => null);
      if (b) await page.mouse.click(b.x + b.width * fx, b.y + b.height * fy);
      try { await page.waitForSelector('.wd-card', { timeout: 3500 }); } catch (e) { continue; }
      const got = await page.locator('.wd-card h2').first().innerText().catch(() => '');
      if (got.trim() === name) return true;
      timeline.push(`   (a tap meant for ${name} opened ${got.trim() || 'a card'}'s — tapping higher up)`);
      await closeCard(); await wait(600);
    }
    return false;
  };
  const ask = async (q) => {
    const btn = page.locator('.wd-q button', { hasText: q }).first();
    if (!(await btn.count())) return false;
    await btn.click({ timeout: 5000 }).catch(() => {});
    await wait(4200);   // the answer types out, and a hire closes the card by itself after a beat
    return true;
  };
  const closeCard = async () => { await page.evaluate(() => { const x = document.getElementById('twCardX'); if (x && !document.getElementById('twPanel').hidden) x.click(); }); await wait(400); };
  const staffGo = async (at) => {
    await page.evaluate((k) => window.__town.open(k), at);
    try { await page.waitForSelector('.tws-go, .tw-card .tw-cta', { timeout: 8000 }); } catch (e) {}
    await wait(600);
  };

  try {
    // ── A. a stranger in the square
    await town();
    await mark('A. a stranger arrives in the town (no job, an anonymous pass)');
    await expectPass(page);
    await look('stranger-arrives');
    for (const k of ['cafe', 'stand', 'post']) {
      await mark('A. taps ' + k + ' as a stranger');
      await page.evaluate((key) => window.__town.open(key), k);
      await wait(4500); await look('stranger-' + k); await closeCard();
    }
    for (const k of ['store', 'condo']) {
      await mark('A. walks into ' + k + ' as a stranger');
      await page.evaluate((key) => window.__town.open(key), k);
      await wait(5000); await look('stranger-inside-' + k);
      await page.evaluate(() => { if (window.__town.rooms.now()) window.__town.rooms.exit(); }); await wait(1500);
    }

    // ── B. asking without a saved pass
    await mark('B. asks Bean for a job with an unsaved pass');
    if (await talk('bean')) { await look('bean-card'); await ask(LIFE.work.ask); await look('bean-says-save'); await closeCard(); }

    // ── the pass is saved (the QA door: the same ticket an inbox would get)
    await mark('B. saves the pass (logs in with an email)');
    const t1 = await ticket(who);
    await page.goto('/pass/?in=' + t1, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#psFinishGo', { state: 'visible', timeout: 20000 }); await page.click('#psFinishGo');
    await page.waitForFunction(() => { try { return /^m:/.test(JSON.parse(localStorage.getItem('pass-link') || '{}').credId || ''); } catch (e) { return false; } }, null, { timeout: 30000 });
    await look('pass-saved');

    // ── C/D/E/F. each workplace in turn: hired, the first minutes, the first work, after it, and leaving
    const ONLY = (process.env.JOBS || '').split(',').filter(Boolean);
    const JOBS = [
      { at: 'cafe', boss: 'bean', kind: 'shift' }, { at: 'stand', boss: 'figjr', kind: 'shift' }, { at: 'post', boss: 'stamp', kind: 'round' },
      { at: 'store', boss: 'pip', kind: 'oncall' }, { at: 'condo', boss: 'spinner', kind: 'oncall' },
    ].filter((J) => !ONLY.length || ONLY.includes(J.at));
    for (const J of JOBS) {
      await town();
      await mark(`C. asks ${J.boss} for a job at ${J.at} (a saved pass)`);
      if (!(await talk(J.boss))) { timeline.push('   !! could not open ' + J.boss + '’s card'); continue; }
      await ask(LIFE.work.ask);
      const got = await page.evaluate(() => window.__town.work.job().at || '');
      if (got !== J.at) { timeline.push(`   !! asked for ${J.at}, holds ${got || 'no job'} — skipping`); continue; }
      await mark(`D. the first seconds after being hired at ${J.at}`);
      await wait(1200); await look(J.at + '-hired');
      await wait(5000); await look(J.at + '-start-line');
      await wait(7000);
      await mark(`D. the work note and the staff card for ${J.at}`);
      await page.evaluate(() => { const n = document.querySelector('.twd-chip'); if (n) n.click(); });
      await wait(2500); await look(J.at + '-staff-card'); await closeCard();

      if (J.kind === 'shift') {
        await mark(`E. goes to work at ${J.at}`);
        await staffGo(J.at);
        await look(J.at + '-staff-card-at-the-place');
        await page.locator('.tw-card button', { hasText: STAFF.go }).first().click({ timeout: 5000 }).catch(() => {});
        await page.waitForFunction(() => { const c = window.__town.room.cafe ? window.__town.room.cafe() : null, l = window.__town.room.lemon ? window.__town.room.lemon() : null; return !!((c && c.on && c.on()) || (l && l.on && l.on())); }, null, { timeout: 20000 }).catch(() => {});
        await wait(1500); await look(J.at + '-shift-on');
        // three cups as the customers come: right, off the middle, wrong
        const which = J.at === 'cafe' ? 'cafe' : 'lemon';
        for (const off of [0, 0.18, 0.9]) {
          if (!(await page.evaluate((w) => { const c = window.__town.room[w](); return !!(c && c.on()); }, which))) { timeline.push('   !! the shift is not on'); break; }
          await page.waitForFunction((w) => { const c = window.__town.room[w](); c.serve(); return !!c.cup(); }, which, { timeout: 60000 }).catch(() => {});
          await page.evaluate(async ([w, o]) => {
            const wait = (ms) => new Promise((r) => setTimeout(r, ms));
            const c = window.__town.room[w](), g = c.gest(), first = c.cup();
            for (let s = 0; s < 20 && c.cup() && c.cup() === first; s++) {
              const key = g.station(); if (!key) break;
              const t = g.best(performance.now()); await wait(Math.max(0, t - performance.now()));
              const z = g.zone ? g.zone() : null, span = 900 * o;
              if (key === 'pour' || key === 'squeeze' || key === 'fill') { g.press(performance.now()); await wait(30); g.release(g.best(performance.now()) + span); }
              else g.press(g.best(performance.now()) + span);
              await wait(25);
            }
          }, [which, off]);
          await wait(1800);
        }
        await look(J.at + '-after-cups');
        await mark(`F. leaves work at ${J.at}`);
        await page.locator('.tw-cup:not([hidden]) .tw-cup__leave').first().click({ timeout: 5000 }).catch(() => {});
        await wait(1800); await look(J.at + '-receipt');
        await page.evaluate(() => { const b = document.getElementById('twTillX'); if (b) b.click(); });
        await wait(5000); await look(J.at + '-after-shift');
      } else if (J.kind === 'round') {
        await mark('E. goes to work at the post office (a round of sorting)');
        await staffGo('post');
        await page.locator('.tw-card button', { hasText: STAFF.go }).first().click({ timeout: 5000 }).catch(() => {});
        await page.waitForFunction(() => { const s = window.__town.sort && window.__town.sort(); return !!(s && s.round && s.round()); }, null, { timeout: 25000 }).catch(() => {});
        await wait(1500); await look('post-round-on');
        const S = (fn) => page.evaluate((src) => (0, eval)('(' + src + ')')(window.__town.sort()), fn.toString());
        for (let i = 0; i < 24 && (await S((s) => !!s.round() && !s.round().done)); i++) {
          if (await S((s) => s.weighing())) await S((s) => s.weigh(s.bestWeigh(performance.now())));
          else await S((s) => s.sort(s.card()));
          await wait(350);
        }
        await wait(1500); await look('post-receipt');
        await mark('F. closes the round’s receipt');
        await page.evaluate(() => { const b = document.getElementById('twSortX'); if (b) b.click(); });
        await wait(5000); await look('post-after-round');
      } else {
        timeline.push('   (calls in at the hire: ' + JSON.stringify(await page.evaluate((k) => window.__town.room.calls(k), J.at)) + ')');
        if (await page.evaluate((k) => !!(window.__town.room.shutNow && window.__town.room.shutNow(k)), J.at)) {
          await mark(`E. taps ${J.at}, which is shut today`);
          await page.evaluate((k) => window.__town.open(k), J.at);
          await wait(4500); await look(J.at + '-shut-today');
          await mark(`E. fixes ${J.at}'s shutter (through the walk's door: the repair has its own walk)`);
          await page.evaluate((k) => window.__town.room.fix('shutter:' + k), J.at);
          await wait(3000); await look(J.at + '-shutter-fixed');
        }
        await mark(`E. walks into ${J.at} as its new staff`);
        await page.evaluate((k) => window.__town.open(k), J.at);
        await page.waitForFunction((k) => window.__town.rooms.now() === k, J.at, { timeout: 30000 }).catch(() => {});
        await wait(4000); await look(J.at + '-inside');
        await mark(`E. answers the first call at ${J.at}`);
        if (J.at === 'store') {
          for (let i = 0; i < 2; i++) {
            if ((await page.evaluate(() => window.__town.room.bare())) < 0) { timeline.push('   (no bare shelf face to fill)'); break; }
            await page.evaluate(() => window.__town.room.open('cr1'));
            await page.waitForFunction(() => window.__town.room.carrying(), null, { timeout: 8000 }).catch(() => {});
            await wait(1500);
            const face = await page.evaluate(() => window.__town.rooms.of('store').full[window.__town.room.bare()][0]);
            await page.evaluate((fc) => window.__town.room.open(fc), face);
            await page.waitForFunction(() => !window.__town.room.carrying(), null, { timeout: 8000 }).catch(() => {});
            await wait(3000);
          }
        } else {
          const lit = await page.evaluate(() => (window.__town.room.arcade().litter || []).map((l) => [l.x, l.y]));
          if (!lit.length) timeline.push('   (no litter on the arcade floor)');
          for (const [x, y] of lit) { await page.evaluate(([lx, ly]) => window.__town.room.sweepAt(lx, ly), [x, y]); await wait(3000); }
        }
        await look(J.at + '-call-answered');
        timeline.push('   (calls still open: ' + JSON.stringify(await page.evaluate((k) => window.__town.room.calls(k), J.at)) + ')');
        await wait(2000);
        await page.evaluate(() => { if (window.__town.rooms.now()) window.__town.rooms.exit(); }); await wait(2500);
      }

      await mark(`K. quits ${J.at}`);
      await town();
      if (await talk(J.boss)) { await ask(LIFE.work.quit); await look(J.at + '-quit'); await closeCard(); }
      await wait(3000);
    }
  } finally {
    await flush();
    fs.writeFileSync(OUT + 'timeline.txt', timeline.join('\n') + '\n\nerrors: ' + JSON.stringify(errs, null, 1));
    try {
      const r = await fetch(PASS_API + '/qa/erase', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://trymstene.com' }, body: JSON.stringify({ key: KEY, who }) });
      console.log('cleanup', r.status, JSON.stringify(await r.json().catch(() => ({}))));
    } catch (e) { console.log('cleanup failed', String(e)); }
    await ctx.close();
  }
});

async function expectPass(page) {
  // the anonymous pass is minted at boot (a first visit has one within a few seconds)
  for (let i = 0; i < 30; i++) {
    const l = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('pass-link') || 'null'); } catch (e) { return null; } });
    if (l && l.credId) return l.credId;
    await page.waitForTimeout(1000);
  }
  return '';
}
