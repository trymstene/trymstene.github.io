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
// store's duties are restock 3 and days 3, so days alone pay at most half the rate.
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
let CLOCK = Date.UTC(2026, 8, 16, 12, 0, 0);
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
ok('and says what the week pays', r.job.pay === 90, r.job);

r = await (await post('/job/take', { credId: me.credId, token: me.token, at: 'nowhere' })).json();
ok('a job that does not exist is refused', r.error === 'no such job', r);

const anon = await (await post('/anon', {})).json();
r = await post('/job/take', { credId: anon.credId, token: anon.token, at: 'store' });
ok('an ANONYMOUS pass cannot be hired (403 keep)', r.status === 403 && (await r.json()).error === 'keep');

console.log('\n2. a day is a day');
for (let i = 0; i < 9; i++) await post('/job/chore', { credId: me.credId, token: me.token });
r = await (await post('/job/chore', { credId: me.credId, token: me.token })).json();
ok('turning up ten times on one day is one day', r.job.days === 1, r.job);

CLOCK += DAY;
await post('/job/chore', { credId: me.credId, token: me.token });
CLOCK += DAY;
await post('/job/chore', { credId: me.credId, token: me.token });
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
ok('once the week is over it pays the share of the duties met (3 of 6 of 90 = 45)', r.total === 45, r);
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
  ok('the wage is in led.coins_earned.job', found === 45, found);
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
  await post('/job/chore', { credId: two.credId, token: two.token });
  CLOCK += DAY;
  await post('/job/chore', { credId: two.credId, token: two.token });
  const moved = await (await post('/job/take', { credId: two.credId, token: two.token, at: 'condo' })).json();
  ok('the arcade hires you away', moved.job.at === 'condo', moved.job);
  ok('and the days you already worked are still on the record', moved.job.days === 2, moved.job);
  CLOCK += 7 * DAY;
  const g = await (await post('/job/pay', { credId: two.credId, token: two.token })).json();
  // ⭐ the days pay at the job they were WORKED at, not the one you hold on payday: you did those
  // two days at the store, so the store pays for them (2 of 6 of 90 = 30)
  ok('the days pay at the job they were worked at (2 of 6 of 90 = 30)', g.total === 30, g);
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
  ok('and it pays once, at the last employer of that day (1 sweep of 6 of 60 = 10)', g.total === 10 && g.paid.length === 1 && g.paid[0].at === 'condo', g);
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
  await post('/job/chore', { credId: spender.credId, token: spender.token });
  CLOCK += 7 * DAY;
  const g = await (await post('/job/pay', { credId: spender.credId, token: spender.token })).json();
  ok('the cheque pays for the day worked (1 of 6 of 90 = 15)', g.total === 15, g);

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
  const ack = await (await post('/push', { credId: w.credId, token: w.token, blob: blob() })).json();
  ok('an ordinary push after taking the job…', ack.ok === true, ack);
  const v = await (await post('/job/view', { credId: w.credId, token: w.token })).json();
  ok('⭐ …leaves the job where it was', v.job.at === 'store', v.job);
  ok('…with the week’s work still counted', v.job.days === 1 && (v.job.duties.find((d) => d.kind === 'restock') || {}).done === 1, v.job);
  ok('⭐ and the push’s answer carries the job, so another phone learns it', ack.job && ack.job.at === 'store', ack.job);
  CLOCK += DAY;
  await post('/push', { credId: w.credId, token: w.token, blob: blob() });
  await post('/job/chore', { credId: w.credId, token: w.token, kind: 'restock' });
  await post('/push', { credId: w.credId, token: w.token, blob: blob() });
  CLOCK += 7 * DAY;
  const g = await (await post('/job/pay', { credId: w.credId, token: w.token })).json();
  // two days turned up, two crates restocked: 4 of 6 of 90 = 60 — through three pushes
  ok('⭐ and payday pays the whole week, through every push in between (4 of 6 of 90 = 60)', g.total === 60, g);
  const rec = [...env.PASSES._m.entries()].map(([k, v2]) => JSON.parse(v2)).find((r) => r && r.job && r.job.at === 'store' && r.job.paid && Object.values(r.job.paid).includes(60));
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

Date.now = REAL_NOW;
globalThis.fetch = realFetch;
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
