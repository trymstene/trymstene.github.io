// 💼 THE JOBS, in-process against a fake R2 (19 Sep 2026, docs/town-jobs-plan.md §3 and §5).
//
// What this has to prove before it is deployed, because every one of these is a way the design
// could quietly leak coins or quietly cheat a player:
//   · a job is ONE AT A TIME, and changing never eats a week you already worked
//   · a KEPT PASS is required — an anonymous pass is one POST from being minted again
//   · a day is a DAY: marking Tuesday nine times is still one Tuesday
//   · the cheque is DERIVED — whole finished weeks only, never the current one
//   · it walks back at most PAY_BACK weeks, so three weeks away owes nothing
//   · a week is paid ONCE, and a second /job/pay pays nothing
//   · the coins land in the ledger slot `job`, never in the shared scalar
//   · ⭐ THE JOB SURVIVES A PUSH — it lived in the blob, and every ordinary sync erased it (§9)
//
// Pay is the §12 formula (src/data/town/jobs.js): the rate × the share of the week's duties met. The
// store's duties are restock 3 and serve 3 (customers at the till, since 23 Sep 2026 — it was days turned up).
//
// ⚠️ the clock is faked (Date.now) so a "week" can pass in a millisecond; the worker only ever
// reads Date.now(), so this exercises the real code path rather than a parallel one.
import worker from '../src/index.js';

const ORIGIN = 'https://trymstene.com';
let sent = [];
function fakeR2() {
  const m = new Map();
  return {
    _m: m,
    async get(k) { if (!m.has(k)) return null; const v = m.get(k); return { json: async () => JSON.parse(v), text: async () => v }; },
    async put(k, v) { m.set(k, typeof v === 'string' ? v : JSON.stringify(v)); },
    async delete(k) { m.delete(k); },
    async list(opts = {}) { const p = opts.prefix || ''; return { objects: [...m.keys()].filter((k) => k.startsWith(p)).map((key) => ({ key })), truncated: false }; },
  };
}
const env = { PASSES: fakeR2(), ALLOWED_ORIGIN: ORIGIN, PASS_HMAC: 'test-stamp', RESEND_KEY: 'test-key', MAIL_FROM: 'b@send.trymstene.com' };
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (String(url).includes('api.resend.com')) {
    const body = JSON.parse(init.body);
    sent.push({ link: (body.text.match(/https?:\/\/\S+/) || [''])[0] });
    return new Response(JSON.stringify({ id: 'fake' }), { status: 200 });
  }
  return realFetch(url, init);
};
const ctx = { waitUntil() {}, passThroughOnException() {} };
const hit = (path, init = {}) => worker.fetch(new Request('https://w.dev' + path, {
  ...init, headers: { Origin: ORIGIN, 'Content-Type': 'application/json', ...(init.headers || {}) },
}), env, ctx);
const post = (p, b) => hit(p, { method: 'POST', body: JSON.stringify(b) });

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, extra !== undefined ? '→ ' + JSON.stringify(extra) : ''); }
};

// ── the clock, so a week can pass in a millisecond ──────────────────────────
const REAL_NOW = Date.now;
// a Wednesday, so "this week" has room on both sides
let CLOCK = Date.UTC(2026, 9, 7, 12, 0, 0);   // a Wednesday in W41: the weekly review judges weeks from W40 (REVIEW_FROM)
Date.now = () => CLOCK;
const DAY = 86400000;

// ── a KEPT pass: the magic-link rail is the only in-process way to make one ──
const sha = async (str) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)))]
  .map((b) => b.toString(16).padStart(2, '0')).join('');
async function kept(email) {
  sent = [];
  await env.PASSES.delete(`mailcd/${await sha(email)}.json`);
  await post('/mail/signin', { email });
  const t = new URL(sent[0].link).searchParams.get('in');
  return (await (await hit('/mail/use?t=' + t)).json());
}

console.log('\n1. taking a job');
const me = await kept('worker@example.com');
ok('a kept pass exists', !!me.credId && !!me.token, me);

let r = await (await post('/job/take', { credId: me.credId, token: me.token, at: 'store' })).json();
ok('the store hires you', r.ok === true && r.job.at === 'store', r);
ok('and says what the week pays (the store’s full week at rank 1: 150)', r.job.pay === 150, r.job);

r = await (await post('/job/take', { credId: me.credId, token: me.token, at: 'nowhere' })).json();
ok('a job that does not exist is refused', r.error === 'no such job', r);

const anon = await (await post('/anon', {})).json();
r = await post('/job/take', { credId: anon.credId, token: anon.token, at: 'store' });
ok('an ANONYMOUS pass cannot be hired (403 keep)', r.status === 403 && (await r.json()).error === 'keep');

console.log('\n2. a day is a day');
for (let i = 0; i < 9; i++) await post('/job/chore', { credId: me.credId, token: me.token });
r = await (await post('/job/chore', { credId: me.credId, token: me.token, kind: 'serve', g: 2 })).json();   // 🛒 and one customer served
ok('turning up ten times on one day is one day', r.job.days === 1, r.job);

CLOCK += DAY;
await post('/job/chore', { credId: me.credId, token: me.token, kind: 'serve', g: 2 });
CLOCK += DAY;
await post('/job/chore', { credId: me.credId, token: me.token, kind: 'serve', g: 2 });
r = await (await post('/job/chore', { credId: me.credId, token: me.token })).json();
ok('three different days are three days', r.job.days === 3, r.job);

const noJob = await kept('idle@example.com');
r = await post('/job/chore', { credId: noJob.credId, token: noJob.token });
ok('a chore with no job is refused', r.status === 409 && (await r.json()).error === 'no job');

console.log('\n3. the cheque is derived, and only for finished weeks');
r = await (await post('/job/pay', { credId: me.credId, token: me.token })).json();
ok('this week pays NOTHING — a cheque is for a week that has finished', r.total === 0 && r.paid.length === 0, r);

CLOCK += 7 * DAY;                                  // now last week is a finished week
r = await (await post('/job/pay', { credId: me.credId, token: me.token })).json();
ok('once the week is over it pays the share of the duties met (3 of 6 of 150 = 75)', r.total === 75, r);
ok('and says which week and which job', r.paid[0] && r.paid[0].at === 'store' && r.paid[0].days === 3, r.paid);

r = await (await post('/job/pay', { credId: me.credId, token: me.token })).json();
ok('asking again pays nothing: a week is paid once', r.total === 0, r);

console.log('\n4. the coins are in the ledger slot, not the scalar');
{
  const keys = [...env.PASSES._m.keys()].filter((k) => k.startsWith('pass/'));
  let found = null;
  for (const k of keys) {
    const rec = JSON.parse(env.PASSES._m.get(k));
    const led = rec && rec.blob && rec.blob.pass && rec.blob.pass.led;
    if (led && led.coins_earned && led.coins_earned.job) found = led.coins_earned.job;
  }
  ok('the wage is in led.coins_earned.job', found === 75, found);
}

console.log('\n5. nothing accrues while you are away');
{
  const away = await kept('away@example.com');
  await post('/job/take', { credId: away.credId, token: away.token, at: 'condo' });
  await post('/job/chore', { credId: away.credId, token: away.token });   // one day, this week
  CLOCK += 28 * DAY;                                                      // four weeks away
  const g = await (await post('/job/pay', { credId: away.credId, token: away.token })).json();
  ok('four weeks away owes nothing — it walks back at most two', g.total === 0, g);
}

console.log('\n6. changing jobs does not eat a week you worked');
{
  const two = await kept('switch@example.com');
  await post('/job/take', { credId: two.credId, token: two.token, at: 'store' });
  await post('/job/chore', { credId: two.credId, token: two.token, kind: 'serve', g: 2 });
  CLOCK += DAY;
  await post('/job/chore', { credId: two.credId, token: two.token, kind: 'serve', g: 2 });
  const moved = await (await post('/job/take', { credId: two.credId, token: two.token, at: 'condo' })).json();
  ok('the arcade hires you away', moved.job.at === 'condo', moved.job);
  ok('and the days you already worked are still on the record', moved.job.days === 2, moved.job);
  CLOCK += 7 * DAY;
  const g = await (await post('/job/pay', { credId: two.credId, token: two.token })).json();
  // ⭐ the days pay at the job they were WORKED at, not the one you hold on payday: you did those
  // two days at the store, so the store pays for them (2 of 6 of 150 = 50)
  ok('the days pay at the job they were worked at (2 of 6 of 150 = 50)', g.total === 50, g);
  ok('and the cheque names that employer, not the new one', g.paid[0] && g.paid[0].at === 'store', g.paid);
}

console.log('\n6b. one day cannot be sold to two employers');
{
  const sly = await kept('sly@example.com');
  await post('/job/take', { credId: sly.credId, token: sly.token, at: 'store' });
  await post('/job/chore', { credId: sly.credId, token: sly.token });
  await post('/job/take', { credId: sly.credId, token: sly.token, at: 'condo' });
  await post('/job/chore', { credId: sly.credId, token: sly.token });   // the SAME day, second employer
  const v = await (await post('/job/chore', { credId: sly.credId, token: sly.token, kind: 'sweep' })).json();
  ok('switching twice in an afternoon is still one day', v.job.days === 1, v.job);
  CLOCK += 7 * DAY;
  const g = await (await post('/job/pay', { credId: sly.credId, token: sly.token })).json();
  // the day belongs to the last employer, and a mid-week move starts a fresh sheet: one sweep at the arcade
  ok('and it pays once, at the last employer of that day (1 sweep of 6 of 120 = 20)', g.total === 20 && g.paid.length === 1 && g.paid[0].at === 'condo', g);
}

console.log('\n7. the café pays tips, not a cheque');
{
  const barista = await kept('bean@example.com');
  const g = await (await post('/job/take', { credId: barista.credId, token: barista.token, at: 'cafe' })).json();
  ok('the Coffee Cup hires you', g.job.at === 'cafe', g.job);
  ok('and its weekly cheque is zero on purpose — tips come a cup at a time', g.job.pay === 0, g.job);
}

console.log('\n8. the cheque has to reach the WALLET, not only the ledger slot');
{
  // ⚠️ THE BUG THIS EXISTS FOR (found 19 Sep, a day after the cheque shipped): a coin written to
  // `led.coins_earned.job` is NOT spendable. The server wallet freezes on a device's first push and
  // from then on only `wallet.earned` counts — walletBal is base + earned + refunded - spent — and
  // the client's coinsNow() reads that wallet. adminGrant already says so out loud: "a slot alone
  // never moves it". So a cheque that only writes the slot pays coins nobody can see or spend.
  const DEV = 'dev00002';
  const blob = () => ({ pass: { created: 1, patches: {}, base: {}, led: { coins_earned: { [DEV]: 0 }, coins_spent: { [DEV]: 0 } }, days: [] }, ev: [], evDrop: 0, evDev: DEV });
  const spender = await kept('spender@example.com');
  const first = await (await post('/push', { credId: spender.credId, token: spender.token, blob: blob() })).json();
  ok('a push freezes the server wallet, the way a real device does', !!first.wallet, first);
  const before = first.wallet.bal;

  await post('/job/take', { credId: spender.credId, token: spender.token, at: 'store' });
  await post('/job/chore', { credId: spender.credId, token: spender.token, kind: 'serve', g: 2 });
  CLOCK += 7 * DAY;
  const g = await (await post('/job/pay', { credId: spender.credId, token: spender.token })).json();
  ok('the cheque pays for the day worked (1 of 6 of 150 = 25)', g.total === 25, g);

  const after = await (await post('/push', { credId: spender.credId, token: spender.token, blob: blob() })).json();
  ok('⭐ and the coins are SPENDABLE — the wallet moved by the cheque', after.wallet.bal === before + g.total, { before, after: after.wallet.bal, cheque: g.total });
  ok('the wallet’s seq moved too, so an older ack cannot undo it', (after.wallet.seq | 0) > (first.wallet.seq | 0), { first: first.wallet.seq, after: after.wallet.seq });

  const again = await (await post('/job/pay', { credId: spender.credId, token: spender.token })).json();
  const third = await (await post('/push', { credId: spender.credId, token: spender.token, blob: blob() })).json();
  ok('and paying twice does not pay twice', again.total === 0 && third.wallet.bal === before + g.total, { again: again.total, bal: third.wallet.bal });
}

console.log('\n9. ⭐ the job survives a push (it lived in the blob, and every sync erased it)');
{
  const DEV = 'dev00009';
  const blob = () => ({ pass: { created: 1, patches: {}, base: {}, led: { coins_earned: { [DEV]: 0 } }, days: [] }, ev: [], evDrop: 0, evDev: DEV });
  const w = await kept('keeper@example.com');
  await post('/push', { credId: w.credId, token: w.token, blob: blob() });
  await post('/job/take', { credId: w.credId, token: w.token, at: 'store' });
  await post('/job/chore', { credId: w.credId, token: w.token, kind: 'restock' });
  await post('/job/chore', { credId: w.credId, token: w.token, kind: 'serve', g: 2 });
  const ack = await (await post('/push', { credId: w.credId, token: w.token, blob: blob() })).json();
  ok('an ordinary push after taking the job…', ack.ok === true, ack);
  const v = await (await post('/job/view', { credId: w.credId, token: w.token })).json();
  ok('⭐ …leaves the job where it was', v.job.at === 'store', v.job);
  ok('…with the week’s work still counted', v.job.days === 1 && (v.job.duties.find((d) => d.kind === 'restock') || {}).done === 1, v.job);
  ok('⭐ and the push’s answer carries the job, so another phone learns it', ack.job && ack.job.at === 'store', ack.job);
  CLOCK += DAY;
  await post('/push', { credId: w.credId, token: w.token, blob: blob() });
  await post('/job/chore', { credId: w.credId, token: w.token, kind: 'restock' });
  await post('/job/chore', { credId: w.credId, token: w.token, kind: 'serve', g: 2 });
  await post('/push', { credId: w.credId, token: w.token, blob: blob() });
  CLOCK += 7 * DAY;
  const g = await (await post('/job/pay', { credId: w.credId, token: w.token })).json();
  // two crates restocked, two customers served: 4 of 6 of 150 = 100 — through three pushes
  ok('⭐ and payday pays the whole week, through every push in between (4 of 6 of 150 = 100)', g.total === 100, g);
  const rec = [...env.PASSES._m.entries()].map(([k, v2]) => JSON.parse(v2)).find((r) => r && r.job && r.job.at === 'store' && r.job.paid && Object.values(r.job.paid).includes(100));
  ok('the job is on the record itself, beside the wallet', !!rec, null);
  ok('and never in the blob a push rebuilds', !!rec && !(rec.blob && rec.blob.pass && rec.blob.pass.job), null);
}

console.log('\n10. a job still in an old blob moves over');
{
  const old = await kept('oldjob@example.com');
  await post('/job/take', { credId: old.credId, token: old.token, at: 'condo' });
  // put the record back the way it was before 22 Sep: the job inside the blob, nothing on the record
  for (const [k, v2] of env.PASSES._m.entries()) {
    const r2 = JSON.parse(v2);
    if (!r2 || !r2.job || r2.job.at !== 'condo' || r2.job.since === undefined) continue;
    r2.blob = r2.blob || {}; r2.blob.pass = r2.blob.pass || { created: 1, patches: {}, stats: {}, days: [] };
    r2.blob.pass.job = r2.job; delete r2.job;
    env.PASSES._m.set(k, JSON.stringify(r2));
  }
  const v = await (await post('/job/view', { credId: old.credId, token: old.token })).json();
  ok('the job is read from where it used to live', v.job.at === 'condo', v.job);
  await post('/job/chore', { credId: old.credId, token: old.token, kind: 'sweep' });
  const moved = [...env.PASSES._m.values()].map((v2) => JSON.parse(v2)).find((r2) => r2 && r2.job && r2.job.at === 'condo');
  ok('and the first write moves it onto the record', !!moved && !(moved.blob && moved.blob.pass && moved.blob.pass.job), moved && Object.keys(moved));
}

console.log('\n11. 🪜 the ladder: work XP, a rank the boss tells you, and the pay that comes with it');
{
  const p = await kept('ladder@example.com');
  const P = (path, body) => post(path, { credId: p.credId, token: p.token, ...(body || {}) }).then((x) => x.json());
  const DEV = 'dev00011';
  let earned = 0, n = 0;
  const tips = (d) => { earned += d; return post('/push', { credId: p.credId, token: p.token, blob: { pass: { created: 1, patches: {}, base: {}, led: { coins_earned: { [DEV]: earned } }, days: [] }, ev: [{ id: 'f' + String(++n).padStart(7, '0'), t: Date.now(), k: 'coins_earned', d, a: 'town', s: 'tips' }], evDrop: 0, evDev: DEV } }).then((x) => x.json()); };
  await post('/push', { credId: p.credId, token: p.token, blob: { pass: { created: 1, patches: {}, base: {}, led: { coins_earned: { [DEV]: 0 } }, days: [] }, ev: [], evDrop: 0, evDev: DEV } });

  let v = await P('/job/take', { at: 'cafe' });
  ok('a new barista starts at rank 1 with no XP', v.job.lad && v.job.lad.rank === 1 && v.job.lad.xp === 0 && v.job.lad.news === false, v.job.lad);
  // a shift, reported at clock-out as one list of grades
  v = await P('/job/chore', { kind: 'cup', g: [2, 2, 1, 0] });
  ok('the day’s first shift earns ten for turning up and each cup by its grade (10 + 6 + 6 + 3 + 0 = 25)', v.xp === 25 && v.job.lad.xp === 25 && v.job.lad.today === 25, v);
  v = await P('/job/chore', { kind: 'cup', g: Array(20).fill(2) });
  ok('a long shift stops at the day’s cap (80 at the Coffee Cup)', v.xp === 55 && v.job.lad.today === 80 && v.job.lad.xp === 80, v);
  v = await P('/job/chore', { kind: 'cup', g: [2] });
  ok('…and the rest of the day earns nothing more', v.xp === 0 && v.job.lad.xp === 80, v);
  ok('a cup is not a duty: the café’s cheque is still zero', v.counted === false && v.job.pay === 0, v.job);

  // ☕ the tips cap is the rank's: a fifth of the Coffee Cup's 90-coin week = 18 a day at rank 1
  let t = await tips(12);
  t = await tips(6);
  ok('eighteen coins of tips land at the first rank', t.wallet && t.wallet.bal === 18, t.wallet);
  t = await tips(1);
  ok('…and the nineteenth is refused', t.wallet && t.wallet.bal === 18, t.wallet);

  CLOCK += DAY;
  v = await P('/job/chore', { kind: 'cup', g: [9, -3, 'x'] });
  ok('a forged grade is a perfect cup and no more (10 + 6 + 0 + 0 = 16)', v.xp === 16, v);
  for (let d = 0; d < 3; d++) { CLOCK += DAY; await P('/job/chore', { kind: 'cup', g: Array(20).fill(2) }); }
  v = await P('/job/view');
  ok('⭐ XP past the line is NEWS, not yet a rank: the boss has not told you', v.job.lad.xp >= 250 && v.job.lad.rank === 1 && v.job.lad.news === true, v.job.lad);

  const other = await post('/job/promote', { credId: p.credId, token: p.token, at: 'store' });
  ok('another boss cannot promote you at the café', other.status === 409 && (await other.json()).error === 'not yours');
  v = await P('/job/promote', { at: 'cafe' });
  ok('⭐ the boss tells you: rank 2', v.promoted && v.promoted.from === 1 && v.promoted.to === 2 && v.job.lad.rank === 2 && v.job.lad.news === false, v);
  v = await P('/job/promote', { at: 'cafe' });
  ok('asking twice tells you nothing new', v.ok === true && v.promoted === null && v.job.lad.rank === 2, v);

  // ☕ and the tips cap rose with it: 90 × 1.2 = 108 a week, a fifth of it 22 a day
  t = await tips(12);
  t = await tips(10);
  ok('⭐ rank 2 takes home 22 a day', t.wallet && t.wallet.bal === 40, t.wallet);
  t = await tips(1);
  ok('…and not a coin more', t.wallet && t.wallet.bal === 40, t.wallet);

  // XP is never lost: another workplace has its own ladder, and the café keeps yours
  v = await P('/job/take', { at: 'stand' });
  ok('the stand starts its own ladder', v.job.lad.rank === 1 && v.job.lad.xp === 0 && v.job.lad.today === 0, v.job.lad);
  v = await P('/job/take', { at: 'cafe' });
  ok('and the café kept your XP and your rank while you were away', v.job.lad.rank === 2 && v.job.lad.xp >= 250, v.job.lad);
}

console.log('\n12. 🪜 a cheque pays the rank the week was worked at');
{
  const p = await kept('climber@example.com');
  const P = (path, body) => post(path, { credId: p.credId, token: p.token, ...(body || {}) }).then((x) => x.json());
  // the next Monday, nine in the morning (never back in time: the tokens were minted at CLOCK)
  const mon = (t) => { const d = new Date(t); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 7, 9); };
  CLOCK = mon(CLOCK);
  await P('/job/take', { at: 'store' });
  // a week at rank 1: three days, three crates — the full week, 150
  for (let d = 0; d < 3; d++) { await P('/job/chore', { kind: 'restock' }); await P('/job/chore', { kind: 'serve', g: 2 }); CLOCK += DAY; }
  let v = await P('/job/view');
  ok('the store pays its first rank (150 a full week)', v.job.pay === 150 && v.job.sofar === 150, v.job);
  ok('three crates, three customers and three days are 3 × (30 + 15 + 10) = 165 XP', v.job.lad.xp === 165, v.job.lad);
  // the next week: climb past 300 and hear it on the Thursday
  CLOCK = mon(CLOCK);
  for (let d = 0; d < 3; d++) { await P('/job/chore', { kind: 'restock' }); await P('/job/chore', { kind: 'restock' }); await P('/job/chore', { kind: 'serve', g: 2 }); CLOCK += DAY; }
  v = await P('/job/pay');
  ok('last week’s cheque is the first rank’s full week (150)', v.total === 150 && v.paid[0].rank === 1, v);
  v = await P('/job/promote', { at: 'store' });
  ok('the promotion lands on the Thursday', v.promoted && v.promoted.to === 2, v);
  ok('and this week’s wage so far is at the new rank (150 × 1.2 = 180 a full week)', v.job.pay === 180 && v.job.sofar === 180, v.job);
  CLOCK += 7 * DAY;
  v = await P('/job/pay');
  ok('⭐ so the week of the promotion pays at rank 2 (180)', v.total === 180 && v.paid[0].rank === 2, v);
}

// ↕ THE WEEKLY REVIEW (23 Sep 2026). Trym: "you should also be able to be demoted, or fired … if you want to be great and
// stay great you must do a good job" — and a firing means "you loose your job, and have to start over".
const monday = (t) => { const d = new Date(t); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 7, 9); };
const as = (p) => (path, body) => post(path, { credId: p.credId, token: p.token, ...(body || {}) }).then((x) => x.json());

console.log('\n13. ↕ a full week lifts you; a poor one warns you, and the next costs a rank');
{
  const P = as(await kept('review@example.com'));
  CLOCK = monday(CLOCK);
  await P('/job/take', { at: 'store' });
  for (let d = 0; d < 3; d++) { await P('/job/chore', { kind: 'restock' }); await P('/job/chore', { kind: 'serve', g: 2 }); CLOCK += DAY; }   // week A: every duty met
  CLOCK = monday(CLOCK);
  let v = await P('/job/view');
  ok('a full week is a day’s work XP extra (3 × 55 = 165, then + 100)', v.job.lad.xp === 265, v.job.lad);
  ok('and last week’s review rides the view', v.job.lad.last && v.job.lad.last.v === 'full' && v.job.lad.last.xp === 100, v.job.lad.last);
  await P('/job/chore', { kind: 'restock' }); await P('/job/chore', { kind: 'restock' }); await P('/job/chore', { kind: 'serve', g: 2 });   // week B: 365, over the line
  v = await P('/job/promote', { at: 'store' });
  ok('rank 2 is told', v.promoted && v.promoted.to === 2, v);
  CLOCK = monday(CLOCK);
  v = await P('/job/chore', { kind: 'serve', g: 2 });   // week C: one customer, nothing more
  ok('half the week’s work is an ordinary week: nothing moves (350, + 25 for the day and a customer)', v.job.lad.xp === 375 && v.job.lad.last.v === 'ok' && v.job.lad.last.xp === 0, v.job.lad);
  CLOCK = monday(CLOCK);
  v = await P('/job/view');
  ok('⭐ a poor week takes a day back, and under the rank’s line the boss warns you', v.job.lad.xp === 275 && v.job.lad.warn === true && v.job.lad.talk === 'warn' && v.job.lad.rank === 2, v.job.lad);
  v = await P('/job/promote', { at: 'store' });
  ok('the warning is heard at the boss, and the rank stays', v.heard === 'warn' && v.promoted === null && v.job.lad.talk === '' && v.job.lad.rank === 2 && v.job.lad.warn === true, v);
  await P('/job/chore', { kind: 'serve', g: 2 });   // week D: poor again
  CLOCK = monday(CLOCK);
  v = await P('/job/view');
  ok('⭐ warned, and another poor week: one rank down', v.job.lad.rank === 1 && v.job.lad.talk === 'demoted' && v.job.lad.warn === false && v.job.lad.xp === 200, v.job.lad);
  ok('and the pay follows the rank (a full week at the store’s first rank: 150)', v.job.pay === 150, v.job);
  v = await P('/job/promote', { at: 'store' });
  ok('the demotion is heard at the boss', v.heard === 'demoted' && v.job.lad.talk === '', v);
  const g = await P('/job/pay');
  const rows = Object.fromEntries(g.paid.map((r) => [r.review && r.review.demoted ? 'demoted' : r.review && r.review.warned ? 'warned' : 'other', r]));
  ok('the payslips say what the reviews said: the warning’s week…', rows.warned && rows.warned.review.v === 'poor' && rows.warned.review.xp === -100, g.paid);
  ok('…and the demotion’s, paid at the rank it was worked at', rows.demoted && rows.demoted.review.demoted.from === 2 && rows.demoted.review.demoted.to === 1 && rows.demoted.rank === 2, g.paid);
  ok('a demotion never goes below the first rank', (await P('/job/view')).job.lad.rank === 1);
}

console.log('\n14. ↕ a warning is lifted by climbing back over the line');
{
  const P = as(await kept('lift@example.com'));
  CLOCK = monday(CLOCK);
  await P('/job/take', { at: 'store' });
  for (let d = 0; d < 3; d++) { await P('/job/chore', { kind: 'restock' }); await P('/job/chore', { kind: 'serve', g: 2 }); CLOCK += DAY; }   // A: full → 265
  CLOCK = monday(CLOCK);
  await P('/job/chore', { kind: 'restock' }); await P('/job/chore', { kind: 'restock' }); await P('/job/chore', { kind: 'serve', g: 2 });   // B: 365
  await P('/job/promote', { at: 'store' });
  CLOCK = monday(CLOCK);
  await P('/job/chore', { kind: 'serve', g: 2 });   // C: poor after the ordinary B
  CLOCK = monday(CLOCK);
  let v = await P('/job/view');
  ok('warned at 275', v.job.lad.warn === true && v.job.lad.xp === 275, v.job.lad);
  for (let d = 0; d < 3; d++) { await P('/job/chore', { kind: 'restock' }); await P('/job/chore', { kind: 'serve', g: 2 }); CLOCK += DAY; }   // D: a full week, 440
  CLOCK = monday(CLOCK);
  v = await P('/job/view');
  ok('⭐ a full week back over the line lifts the warning, and the boss has nothing to say', v.job.lad.xp === 540 && v.job.lad.warn === false && v.job.lad.talk === '' && v.job.lad.rank === 2, v.job.lad);
}

console.log('\n15. ↕ two weeks without showing up: let go, and that workplace starts over — the others keep their XP');
{
  const P = as(await kept('vanish@example.com'));
  CLOCK = monday(CLOCK);
  await P('/job/take', { at: 'cafe' });
  await P('/job/chore', { kind: 'cup', g: Array(20).fill(2) });   // the café: 80 XP, kept
  CLOCK += DAY;
  await P('/job/take', { at: 'condo' });
  for (let d = 0; d < 3; d++) { for (const k of ['sweep', 'sweep', 'sweep', 'fix']) await P('/job/chore', { kind: k }); CLOCK += DAY; }   // 300 at the arcade
  let v = await P('/job/promote', { at: 'condo' });
  ok('the arcade’s second rank is told', v.promoted && v.promoted.to === 2 && v.job.lad.xp === 300, v);
  CLOCK = monday(monday(monday(CLOCK)));   // two whole weeks with no visit at all
  v = await P('/job/view');
  ok('⭐ two empty weeks — never came — and the boss lets you go', v.job.at === '' && v.job.fired && v.job.fired.at === 'condo', v.job);
  v = await P('/job/take', { at: 'condo' });
  ok('⭐ asked again, you start over: the first rank, no XP', v.job.at === 'condo' && v.job.lad.rank === 1 && v.job.lad.xp === 0 && !v.job.fired, v.job);
  v = await P('/job/take', { at: 'cafe' });
  ok('and the café kept every XP you earned there', v.job.lad.xp === 80, v.job.lad);
}

console.log('\n16. ↕ quitting keeps your standing, however long you are away');
{
  const P = as(await kept('quitter@example.com'));
  CLOCK = monday(CLOCK);
  await P('/job/take', { at: 'store' });
  for (let d = 0; d < 3; d++) { await P('/job/chore', { kind: 'restock' }); await P('/job/chore', { kind: 'serve', g: 2 }); CLOCK += DAY; }
  CLOCK = monday(CLOCK);
  await P('/job/chore', { kind: 'restock' }); await P('/job/chore', { kind: 'restock' }); await P('/job/chore', { kind: 'serve', g: 2 });
  await P('/job/promote', { at: 'store' });
  await P('/job/take', { at: '' });   // quits properly, mid-week
  CLOCK += 30 * DAY;
  let v = await P('/job/view');
  ok('a month away without a job: nothing to review, no sack', v.job.at === '' && !v.job.fired, v.job);
  v = await P('/job/take', { at: 'store' });
  ok('⭐ back at the store at the rank you left with, every XP there', v.job.lad.rank === 2 && v.job.lad.xp === 350 && !v.job.lad.warn, v.job.lad);
}

console.log('\n17. ↕ at a counter the review reads the cups — and a counter job can be let go too');
{
  const P = as(await kept('counter@example.com'));
  CLOCK = monday(CLOCK);
  await P('/job/take', { at: 'cafe' });
  await P('/job/chore', { kind: 'cup', g: [0, 0, 0, 0, 0, 2] });   // five of six spoiled: 10 + 6 = 16
  CLOCK = monday(CLOCK);
  let v = await P('/job/view');
  ok('more than half the cups spoiled is a poor week (16 back to 0; never below nothing)', v.job.lad.last && v.job.lad.last.v === 'poor' && v.job.lad.last.xp === -16 && v.job.lad.xp === 0, v.job.lad);
  for (let d = 0; d < 3; d++) { await P('/job/chore', { kind: 'cup', g: Array(10).fill(2) }); CLOCK += DAY; }   // 3 × 70 = 210
  CLOCK = monday(CLOCK) + 3 * DAY;   // the Thursday of the week after, nothing done yet
  v = await P('/job/view');
  ok('three good days at the counter are a full week (210 + 80)', v.job.lad.last.v === 'full' && v.job.lad.xp === 290, v.job.lad);
  ok('⭐ and on a Thursday with nothing done, the Coffee Cup nudges too', v.job.nudge === true, v.job);
  CLOCK = monday(monday(CLOCK));   // that week and the next, empty
  v = await P('/job/view');
  ok('two empty weeks at the counter: let go, the café starts over', v.job.at === '' && v.job.fired && v.job.fired.at === 'cafe', v.job);
  v = await P('/job/take', { at: 'cafe' });
  ok('back at the first rank with nothing', v.job.lad.rank === 1 && v.job.lad.xp === 0, v.job.lad);
}

console.log('\n18. 🔓 the rank-2 unlocks: a basket is a customer served, and a cleared rush is a bonus at the café');
{
  const P = as(await kept('unlocks@example.com'));
  CLOCK = monday(CLOCK);
  await P('/job/take', { at: 'store' });
  let v = await P('/job/chore', { kind: 'basket', g: 2 });   // the day's ten and a perfect basket's 22
  ok('🧺 a basket counts on the sheet as a customer served', v.job.duties.find((d) => d.kind === 'serve').done === 1, v.job.duties);
  ok('and earns a basket’s XP, half again a customer’s (10 + 22)', v.job.lad.xp === 32, v.job.lad);
  v = await P('/job/chore', { kind: 'basket', g: 1 });
  ok('a fine basket is 15', v.job.lad.xp === 47 && v.job.duties.find((d) => d.kind === 'serve').done === 2, v.job);
  v = await P('/job/take', { at: 'cafe' });   // taking another job is the switch (there is no separate quit)
  v = await P('/job/chore', { kind: 'rush' });
  ok('☕ a rush served to the last customer is a bonus of 15 at the café (10 for the day + 15)', v.job.lad.xp === 25, v.job.lad);
  ok('and is nothing on the week’s cups', !(v.job.done && v.job.done.cups), v.job);
}

console.log('\n19. 🔓 rank 3: the day holds more, a delivery earns its XP, and a lamp is one of the arcade’s repairs');
{
  const P = as(await kept('rank3@example.com'));
  CLOCK = monday(CLOCK);
  await P('/job/take', { at: 'store' });
  const fullDay = async () => { await P('/job/chore', { kind: 'restock' }); await P('/job/chore', { kind: 'restock' }); await P('/job/chore', { kind: 'serve', g: 2 }); await P('/job/chore', { kind: 'serve', g: 2 }); };
  for (let d = 0; d < 10; d++) { await fullDay(); CLOCK += DAY; }
  let v = await P('/job/promote', { at: 'store' });
  ok('ten full days at the store, and Pip tells you the rank they earned: 3', v.job.lad.rank === 3, v.job.lad);
  CLOCK += DAY;
  await fullDay();
  v = await P('/job/view');
  ok('a full day at the store is 100', v.job.lad.today === 100, v.job.lad);
  v = await P('/job/chore', { kind: 'deliver' });
  ok('📦 a delivery on top still counts at rank 3: the rank’s day holds 130 (100 × 1.3)', v.xp === 30 && v.job.lad.today === 130, v);
  v = await P('/job/chore', { kind: 'deliver' });
  ok('…and stops there', v.xp === 0 && v.job.lad.today === 130, v);
  v = await P('/job/take', { at: 'condo' });
  v = await P('/job/chore', { kind: 'lamp' });
  ok('🕹 a lamp on the square is one of the arcade’s repairs on the week’s sheet', v.job.duties.find((d) => d.kind === 'fix').done === 1, v.job.duties);
}

console.log('\n20. 📜 a reference: the top rank at the stand starts you at the café’s second rank — and only there, and only the first time');
{
  const P = as(await kept('reference@example.com'));
  CLOCK = monday(CLOCK);
  await P('/job/take', { at: 'stand' });
  for (let d = 0; d < 11; d++) { await P('/job/chore', { kind: 'cup', g: Array(20).fill(2) }); CLOCK += DAY; }
  let v = await P('/job/promote', { at: 'stand' });
  ok('the stand’s top rank, told', v.job.lad.rank === 3, v.job.lad);
  v = await P('/job/take', { at: 'cafe' });
  ok('⭐ Fig Jr.’s reference: the Coffee Cup starts you at its second rank', v.ref === 'stand' && v.job.lad.rank === 2 && v.job.lad.xp === 250, v);
  v = await P('/job/take', { at: 'stand' });
  v = await P('/job/take', { at: 'cafe' });
  ok('back again later: no second start, the café keeps what you had', !v.ref && v.job.lad.rank === 2, v);
  v = await P('/job/take', { at: 'condo' });
  ok('the arcade is two rungs up: the stand’s reference is not for it', !v.ref && v.job.lad.rank === 1, v);
}

console.log('\n21. ⚖️ a week is judged only if it could have been passed');
const LATEST = CLOCK;   // §21 goes back to September for its weeks; the sections after it carry on from here (the IP throttle counts a minute forward)
{
  CLOCK = Date.UTC(2026, 8, 18, 12, 0, 0);   // Friday of W38, before the chores and the review
  const P = as(await kept('fair@example.com'));
  await P('/job/take', { at: 'condo' });
  await P('/job/chore', {});   // turned up: a sheet, and no sweep or fix existed yet
  CLOCK = Date.UTC(2026, 8, 25, 12, 0, 0);   // Friday of W39
  await P('/job/chore', {});
  CLOCK = Date.UTC(2026, 8, 30, 12, 0, 0);   // Wednesday of W40: W38 and W39 are finished
  let v = await P('/job/view');
  ok('the weeks before the review began are never a strike: still employed', v.job.at === 'condo' && !v.job.fired, v.job);
  // the store's transition: a W39 week of turning up still pays what it earned under the old duties
  const S = as(await kept('fair-store@example.com'));
  CLOCK = Date.UTC(2026, 8, 21, 9, 0, 0);   // Monday of W39
  await S('/job/take', { at: 'store' });
  for (let d = 0; d < 3; d++) { await S('/job/chore', {}); CLOCK += DAY; }   // three days turned up, no customers (the duty did not exist yet)
  CLOCK = Date.UTC(2026, 8, 30, 12, 0, 0);
  const pay = await S('/job/pay');
  ok('⭐ three days turned up in W39 pay the half of the store’s week they earned (75)', pay.total === 75, pay);
  // a week joined after its Monday is not judged
  const F = as(await kept('friday@example.com'));
  CLOCK = Date.UTC(2026, 9, 9, 12, 0, 0);   // Friday of W41
  await F('/job/take', { at: 'post' });
  await F('/job/chore', { kind: 'sort', g: 10 });
  CLOCK = Date.UTC(2026, 9, 14, 12, 0, 0);   // Wednesday of W42
  v = await F('/job/view');
  ok('a Friday hire’s first week is not a poor week: no XP taken back, no warning', !(v.job.lad.last && v.job.lad.last.v) && !v.job.lad.warn && v.job.lad.xp > 0, v.job.lad);
}

console.log('\n22. 🪜 a promotion overtakes a word still waiting');
{
  CLOCK = LATEST + 14 * DAY;
  const P = as(await kept('overtaken@example.com'));
  await P('/job/take', { at: 'stand' });
  await P('/job/chore', {});
  // warned last week, and — however it got there — over the next rank's line now: seeded straight into the record
  for (const [k, v] of env.PASSES._m) {
    const rec = JSON.parse(v);
    if (rec && rec.job && rec.job.at === 'stand' && rec.job.xp && rec.job.xp.stand === 10) {
      rec.job.xp.stand = 650; rec.job.rk = { stand: 2 }; rec.job.warn = { stand: '2026-W42' }; rec.job.talk = { stand: 'warn' };
      env.PASSES._m.set(k, JSON.stringify(rec));
    }
  }
  const v = await P('/job/promote', { at: 'stand' });
  ok('the promotion is told, not the warning', v.promoted && v.promoted.to === 3 && !v.heard, v);
  ok('⭐ and the warning is gone with it: nothing left for the boss to say after', v.job.lad.warn === false && v.job.lad.talk === '', v.job.lad);
}

console.log('\n23. 📜 the top rank’s memento: owed at the promotion, handed over once');
{
  CLOCK += 7 * DAY;
  const P = as(await kept('memento@example.com'));
  await P('/job/take', { at: 'stand' });
  await P('/job/chore', {});
  let v = await P('/job/memento', { at: 'stand' });
  ok('nothing is owed below the top', v.given === null && v.job.lad.mem === 0, v);
  for (const [k, raw] of env.PASSES._m) {
    const rec = JSON.parse(raw);
    if (rec && rec.job && rec.job.at === 'stand' && rec.job.xp && rec.job.xp.stand === 10) { rec.job.xp.stand = 650; rec.job.rk = { stand: 2 }; env.PASSES._m.set(k, JSON.stringify(rec)); }
  }
  v = await P('/job/promote', { at: 'stand' });
  ok('promoted to the top: the memento is owed', v.promoted && v.promoted.to === 3 && v.job.lad.mem === 1, v);
  v = await P('/job/memento', { at: 'stand' });
  ok('⭐ asked for, it is given', v.given === 'stand' && v.job.lad.mem === 2, v);
  v = await P('/job/memento', { at: 'stand' });
  ok('⭐ asked again — a second device, a cleared browser — there is nothing to give', v.given === null && v.job.lad.mem === 2, v);
  v = await P('/job/memento', { at: 'cafe' });
  ok('and a workplace you never topped gives nothing', v.given === null, v);
}

console.log('\n24. 👻 the night shift: a ghost caught is one of the arcade’s repairs');
{
  CLOCK += 7 * DAY;
  const P = as(await kept('night@example.com'));
  await P('/job/take', { at: 'condo' });
  const v = await P('/job/chore', { kind: 'ghost' });
  ok('⭐ on the week’s sheet as a repair, and twenty XP on top of the day’s ten', v.job.duties.find((r) => r.kind === 'fix').done === 1 && v.job.lad.xp === 30, v.job);
}

Date.now = REAL_NOW;
globalThis.fetch = realFetch;
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
