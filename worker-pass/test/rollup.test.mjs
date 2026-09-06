// 📊 THE ROLLUP — the desk's numbers stop being a 46-record sample.
// The read cap is a hard budget (an R2 get is one of the free plan's 50
// subrequests), so totals computed live on a request are a truncated sample
// presented as a population. A cron pages the bucket instead and writes one
// small file a day; the desk reads it in one get.
const ORIGIN = 'https://trymstene.com';
function fakeR2() {
  const m = new Map();
  return {
    _m: m,
    async get(k) { if (!m.has(k)) return null; const v = m.get(k); return { json: async () => JSON.parse(v), text: async () => v }; },
    async put(k, v) { m.set(k, typeof v === 'string' ? v : JSON.stringify(v)); },
    async delete(k) { m.delete(k); },
    // a cursor the way R2 gives one, so the paging is actually exercised
    async list(opts = {}) {
      const p = opts.prefix || '', lim = opts.limit || 1000;
      const all = [...m.keys()].filter((k) => k.startsWith(p)).sort();
      const from = opts.cursor ? all.indexOf(opts.cursor) + 1 : 0;
      const page = all.slice(from, from + lim);
      const truncated = from + lim < all.length;
      return { objects: page.map((key) => ({ key })), truncated, cursor: page[page.length - 1] };
    },
  };
}
const env = { PASSES: fakeR2(), ALLOWED_ORIGIN: ORIGIN, PASS_HMAC: 't', MEMBER_HMAC: 'h', PASS_ADMIN_KEY: 'desk-key' };
const ctx = { waitUntil() {} };
const worker = (await import('../src/index.js')).default;

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name, extra === undefined ? '' : JSON.stringify(extra)); }
};
const DAY = 86400000;
const iso = (t) => new Date(t).toISOString().slice(0, 10);
const today = iso(Date.now());
const ago = (n) => iso(Date.now() - n * DAY);

// a population the read cap could never have counted in one request
function seed(n) {
  for (let i = 0; i < n; i++) {
    const bornAgo = i % 40;                       // a spread of ages
    const days = [ago(bornAgo)];
    if (bornAgo >= 1 && i % 3 !== 0) days.push(ago(Math.max(0, bornAgo - 1)));   // came back
    if (bornAgo >= 7 && i % 4 === 0) days.push(ago(Math.max(0, bornAgo - 8)));   // still here after a week
    if (i % 5 === 0) days.push(today);            // active today
    const rec = {
      updated: Date.now(),
      ...(i % 9 === 0 ? { anon: 1 } : {}),
      ...(i % 11 === 0 ? { veteran: 1 } : {}),
      wallet: { base: 100, earned: i, spent: 0, refunded: 0, seq: 1 },
      log: { ev: [{ k: 'coins_earned', d: 5, a: i % 2 ? 'park' : 'rave', s: i % 2 ? 'weed' : 'spot' }],
        rr: i % 6 === 0 ? { day: 1 } : {}, unruled: i % 7 === 0 ? 1 : 0, drift: {} },
      blob: { name: i % 2 ? 'Player ' + i : '', quest: { s: i % 3, done: i % 10 === 0 ? 1 : 0 },
        pass: { created: Date.now() - bornAgo * DAY, patches: { og: 1 }, days,
          base: { coins_earned: 100 + i, coins_spent: 10, rep: i }, led: {}, stats: {} } },
    };
    env.PASSES._m.set('pass/' + String(i).padStart(4, '0') + 'aaaa.json', JSON.stringify(rec));
    if (i % 8 === 0) env.PASSES._m.set('pass/mail' + i + '.json', JSON.stringify({ link: String(i).padStart(4, '0') + 'aaaa', alg: 'mail' }));
  }
}
const N = 130;
seed(N);

const hit = (path) => worker.fetch(new Request('https://w.dev' + path, { headers: { Origin: ORIGIN } }), env, ctx).then((r) => r.json());

console.log('1. one tick reads a PAGE, not the population');
let r = await hit('/admin/rollup/tick?key=desk-key');
ok('a tick walks a page and leaves a cursor', r.scanned === 40 && !r.done, r);
ok('…and reports which day it is building', r.day === today, r);

console.log('2. the cron comes back until the day is walked');
let guard = 0;
while (!r.done && guard++ < 40) r = await hit('/admin/rollup/tick?key=desk-key');
ok('the whole bucket is walked across ticks', r.done === 1, r);
const passKeys = [...env.PASSES._m.keys()].filter((k) => k.startsWith('pass/')).length;
ok('…every record, not the 46 a request could read', r.scanned === passKeys, { scanned: r.scanned, passKeys });
ok('…in more pages than one request could ever spend', r.pages >= 4, r.pages);

console.log('3. the desk reads a whole population in ONE get');
r = await hit('/admin/rollup?key=desk-key&days=7');
const d = (r.days || []).find((x) => x.day === today);
ok('the finished day is a FILE, read in one get', !!d, (r.days || []).map((x) => x.day));
ok('every pass is counted, pointers are not people', d.passes === N, { passes: d.passes, want: N });
ok('a recovery credential is counted as recovery, not as a person', d.mailCreds > 0 && d.mailCreds < N, d.mailCreds);
ok('anonymous and veteran passes are told apart', d.anon > 0 && d.veteran > 0, { anon: d.anon, veteran: d.veteran });

console.log('4. the KPIs a sample could not honestly report');
ok('DAU / WAU / MAU are population counts', d.dau > 0 && d.wau >= d.dau && d.mau >= d.wau, { dau: d.dau, wau: d.wau, mau: d.mau });
ok('rolling retention has a cohort AND a survivor count', d.ret.c1 > 0 && d.ret.r1 > 0 && d.ret.r1 <= d.ret.c1, d.ret);
ok('…and a 30-day cohort only counts people old enough to be in it', d.ret.c30 > 0 && d.ret.c30 < d.ret.c1, d.ret);
ok('coins are split into earned, spent and still held', d.coins.earned > 0 && d.coins.spent > 0 && d.coins.held > 0, d.coins);
ok('every coin is attributed to an AREA — the question GA4 has no event for', (d.area.park || 0) > 0 && (d.area.rave || 0) > 0, d.area);
ok('…and to a FAUCET', (d.faucet.weed || 0) > 0 && (d.faucet.spot || 0) > 0, d.faucet);
ok('refusals are kept by reason, and unnamed events are counted', (d.refuse.day || 0) > 0 && d.unruled > 0, { refuse: d.refuse, unruled: d.unruled });
ok('the questline reports a funnel, not a flag', d.quest > 0 && d.questDone > 0 && d.questDone < d.quest, { quest: d.quest, done: d.questDone });

console.log('5. the same day is never counted twice');
const before = d.passes;
r = await hit('/admin/rollup/tick?key=desk-key');
ok('a finished day keeps walking — for the people index, not the day file', r.done === 1 && r.skipped !== 1 && r.lap > 0, r);
r = await hit('/admin/rollup?key=desk-key&days=7');
const d2 = (r.days || []).find((x) => x.day === today);
ok('…and the file it wrote is unchanged', d2.passes === before, { now: d2.passes, before });

console.log('7. the people index — the whole population, pointers resolved across pages');
// a proof home stamped qa must never be a person; it goes in BEFORE the lap reads its page
env.PASSES._m.set('pass/zzzzqa01.json', JSON.stringify({ qa: 1, anon: 1, updated: Date.now(), blob: { name: 'Proofy', pass: { created: Date.now(), days: [today], base: {}, led: {}, stats: {} } } }));
// a bucket nobody has walked yet: the desk is told so, instead of an empty list
{
  const fresh = { ...env, PASSES: fakeR2() };
  const b0 = await worker.fetch(new Request('https://w.dev/admin/people?key=desk-key', { headers: { Origin: ORIGIN } }), fresh, ctx).then((x) => x.json());
  ok('before any lap the desk is told the index is building', b0.building === 1 && !b0.rows, b0);
}
// the day lap already wrote the index once (section 2); the next lap picks up the stamped record above
guard = 0; r = { people: 0 };
while (!r.people && guard++ < 40) r = await hit('/admin/rollup/tick?key=desk-key');
ok('a lap ends by writing the index', r.people === N, { people: r.people, want: N });
r = await hit('/admin/people?key=desk-key');
ok('the desk reads every person in one get', Array.isArray(r.rows) && r.rows.length === N && r.n === N && r.at > 0, { n: r.n, rows: r.rows && r.rows.length });
const withMail = r.rows.filter((p) => p.mail === true);
ok('email pointers are resolved to their homes even though they list on other pages', withMail.length === Math.ceil(N / 8), { withMail: withMail.length, want: Math.ceil(N / 8) });
ok('…and each such home counts the pointer as a device', withMail.every((p) => p.devices >= 1), withMail.slice(0, 3).map((p) => p.devices));
ok('nobody is marked unknown — the walk had no read cap to hide behind', r.rows.every((p) => p.mail === true || p.mail === false));
ok('the proof\'s stamped home is not a person', !r.rows.some((p) => p.name === 'Proofy'));
ok('rows carry what the desk row needs', r.rows.every((p) => typeof p.id === 'string' && typeof p.tag === 'string' && 'level' in p && 'coins' in p && 'days' in p && 'updated' in p));
ok('newest seen first', r.rows.every((p, i) => i === 0 || r.rows[i - 1].updated >= p.updated));
const at1 = r.at;
guard = 0; let r2 = { people: 0 };
while (!r2.people && guard++ < 40) r2 = await hit('/admin/rollup/tick?key=desk-key');
r = await hit('/admin/people?key=desk-key');
ok('the next lap rewrites it (seen is at most a lap stale)', r.at >= at1 && r.lap && r.lap.laps >= 2, { at1, at: r.at, lap: r.lap });
const nokey = await worker.fetch(new Request('https://w.dev/admin/people', { headers: { Origin: ORIGIN } }), env, ctx);
ok('no key → 404, deny as nothing', nokey.status === 404, nokey.status);

console.log('6. the desk is reachable FROM A BROWSER');
// ⚠️ this route is called by the HQ page; without the header the browser
// blocks the answer and the desk can only say "refused" for every fault
const withCors = await worker.fetch(new Request('https://w.dev/admin/rollup?key=desk-key&days=7',
  { headers: { Origin: ORIGIN } }), env, ctx);
ok('the rollup answers with the CORS header the other admin routes send',
  withCors.headers.get('Access-Control-Allow-Origin') === ORIGIN, withCors.headers.get('Access-Control-Allow-Origin'));
const tickCors = await worker.fetch(new Request('https://w.dev/admin/rollup/tick?key=desk-key',
  { headers: { Origin: ORIGIN } }), env, ctx);
ok('…and so does the manual tick', tickCors.headers.get('Access-Control-Allow-Origin') === ORIGIN, tickCors.headers.get('Access-Control-Allow-Origin'));

console.log('7. the desk is still a locked door');
const bad = await worker.fetch(new Request('https://w.dev/admin/rollup?key=nope', { headers: { Origin: ORIGIN } }), env, ctx);
ok('a wrong key gets nothing at all', bad.status === 404, bad.status);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
