// 🏆 CITIZENS OF THE WEEK — the weekly fold, in-process against a fake R2 and a
// fake neighbourhood. Two weeks of server-stamped tape rows; a named-but-unkept
// leader, a kept runner-up, a nameless grinder; last week's winners crowned on
// the first lap, badges stamped, a four-week no-repeat honoured, and one public
// route with names and looks but never an id.
import worker from '../src/index.js';

const ORIGIN = 'https://trymstene.com';
const DAY = 86400000;
function fakeR2() {
  const m = new Map();
  return {
    _m: m,
    async get(k) { if (!m.has(k)) return null; const v = m.get(k); return { etag: 'e', json: async () => JSON.parse(v), text: async () => v }; },
    async put(k, v) { m.set(k, typeof v === 'string' ? v : JSON.stringify(v)); return { etag: 'e' }; },
    async delete(k) { m.delete(k); },
    async list(opts = {}) {
      const p = opts.prefix || '', lim = opts.limit || 1000;
      const all = [...m.keys()].filter((k) => k.startsWith(p)).sort();
      const from = opts.cursor ? all.indexOf(opts.cursor) + 1 : 0;
      const page = all.slice(from, from + lim);
      return { objects: page.map((key) => ({ key })), truncated: from + lim < all.length, cursor: page[page.length - 1] };
    },
  };
}
// the neighbourhood answers per window: last week Kiwi (id prefix 'kiwi0000') was
// the kindest visitor; this week Be ('be000000') is
let hoodCalls = [];
const RAVE = { fetch: async (req) => {
  const u = new URL(req.url); hoodCalls.push(u.pathname + u.search);
  const from = +u.searchParams.get('from');
  const thisWeek = from > Date.now() - 7 * DAY;
  const who = thisWeek ? { be000000: { hugs: 4, feeds: 1, waters: 2, signs: 1, visits: 3 } }
    : { kiwi0000: { hugs: 6, feeds: 2, waters: 3, signs: 0, visits: 9 } };
  return new Response(JSON.stringify({ from, to: +u.searchParams.get('to'), who }), { headers: { 'Content-Type': 'application/json' } });
} };
const env = { PASSES: fakeR2(), RAVE, ALLOWED_ORIGIN: ORIGIN, PASS_HMAC: 't', MEMBER_HMAC: 'h', PASS_ADMIN_KEY: 'desk-key' };
const ctx = { waitUntil() {} };
const hit = (path) => worker.fetch(new Request('https://w.dev' + path, { headers: { Origin: ORIGIN } }), env, ctx).then((r) => r.json());
let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name, extra === undefined ? '' : JSON.stringify(extra)); }
};

// ── the world's week clock, exactly as the worker computes it ──
const monday = (ms) => { const d = new Date(ms); const day = (d.getUTCDay() + 6) % 7; return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - day * DAY; };
const curFrom = monday(Date.now()), prevFrom = curFrom - 7 * DAY;
const row = (at, k, d, a, s) => ({ id: Math.random().toString(16).slice(2, 10), t: at, at, k, d, a, ...(s ? { s } : {}) });
const days = (from, n) => Array.from({ length: n }, (_, i) => from + i * DAY + 3600000);

// records: the key is the home key; a name, an optional mail pointer (kept), a tape
const homes = {};
function person(key, name, opts = {}) {
  const ev = opts.ev || [];
  const rec = { updated: Date.now(), blob: { name, bbLast: opts.look || { hat: 'party', glasses: 'none' }, shelf: opts.shelf || [],
    pass: { created: Date.now() - 30 * DAY, patches: {}, days: [], base: {}, led: {}, stats: {} } },
    log: { ev, n: ev.length, seen: [], drop: 0, pushes: 0, unsure: 0, drift: {} }, ...(opts.rec || {}) };
  env.PASSES._m.set('pass/' + key + '.json', JSON.stringify(rec));
  if (opts.kept) env.PASSES._m.set('pass/m' + key + '.json', JSON.stringify({ link: key, mail: 1, tokens: {} }));
  homes[name] = key;
}
// worldGid(env, homeKey) = hmac(PASS_HMAC?, 'world:' + key).slice(0,16) — the test does not need to
// know it; the neighbourhood is keyed by the gid prefix, which only the worker can compute, so the
// neighbour plaque is exercised through the Kiwi/Be records' gids below (see the probe)
// LAST WEEK: Jade (kept) gardened hard and raved; Sparkly (unkept) gardened harder; Nameless did everything
person('aaaa1111', 'Jade', { kept: true, ev: [
  ...days(prevFrom, 4).map((at) => row(at, 'garden_harvests', 2, 'park')),
  ...days(prevFrom, 2).map((at) => row(at, 'drops', 3, 'rave')),
  row(prevFrom + DAY, 'coins_earned', 5, 'park', 'weed'),
] });
person('bbbb2222', 'Sparkly', { kept: false, ev: [
  ...days(prevFrom, 6).map((at) => row(at, 'garden_harvests', 3, 'park')),
] });
person('cccc3333', '', { kept: true, ev: [
  ...days(prevFrom, 7).map((at) => row(at, 'garden_harvests', 9, 'park')),
  ...days(prevFrom, 7).map((at) => row(at, 'hs_fed', 1, 'homestead')),
] });
// THIS WEEK: Be (kept) farms daily; Jade builds two bananas on the shelf
person('dddd4444', 'Be', { kept: true, ev: [
  ...days(curFrom, 3).map((at) => row(at, 'hs_fed', 1, 'homestead')),
  ...days(curFrom, 3).map((at) => row(at, 'hs_day', 1, 'homestead')),
  row(curFrom + DAY, 'coins_earned', 25, 'homestead', 'stall'),
] });
env.PASSES._m.set('pass/aaaa1111.json', JSON.stringify({ ...JSON.parse(env.PASSES._m.get('pass/aaaa1111.json')),
  blob: { ...JSON.parse(env.PASSES._m.get('pass/aaaa1111.json')).blob, shelf: [{ params: 'x=1', created: curFrom + 2 * DAY }, { params: 'x=2', created: curFrom + 2 * DAY + 5 }] } }));
// a QA-stamped home never competes
person('eeee5555', 'Proofy', { kept: true, rec: { qa: 1 }, ev: days(prevFrom, 7).map((at) => row(at, 'garden_harvests', 50, 'park')) });
// a previous final: Jade already won Raver two weeks ago → she sits Raver out
const prevPrevId = (() => { const d = new Date(prevFrom - 7 * DAY + 3 * DAY); const jan1 = Date.UTC(d.getUTCFullYear(), 0, 1); const n = Math.floor((d.getTime() - jan1) / DAY / 7) + 1; return d.getUTCFullYear() + '-W' + String(n).padStart(2, '0'); })();
// (the tag is computed by the worker; we learn Jade's tag from the live board first, then plant the old win)

console.log('1. a lap walks the bucket and writes the running board');
let r = await hit('/admin/rollup/tick?key=desk-key');
let guard = 0;
while (!r.people && guard++ < 20) r = await hit('/admin/rollup/tick?key=desk-key');
ok('the lap finished', r.people >= 4, r);
ok('the neighbourhood was asked twice per lap (this week, last week)', hoodCalls.length >= 2 && hoodCalls.every((c) => c.startsWith('/yards/week?from=')), hoodCalls);
let board = await hit('/citizen');
ok('the public route answers with live + last', board.live && 'last' in board, Object.keys(board));
const live = board.live;
ok('this week: Be leads farmer (kept)', live.plaques.farmer[0] && live.plaques.farmer[0].name === 'Be' && live.plaques.farmer[0].kept === true, live.plaques.farmer);
ok('this week: Jade leads maker with two shelved bananas', live.plaques.maker[0] && live.plaques.maker[0].name === 'Jade' && live.plaques.maker[0].score === 4, live.plaques.maker);
ok('a nameless pass never appears', JSON.stringify(live).indexOf('cccc3333') < 0 && !Object.values(live.plaques).flat().some((x) => !x.name), live.plaques);
ok('a QA home never appears', !JSON.stringify(live).includes('Proofy'), live.plaques.gardener);
ok('rows carry a look for the frames and no id', live.plaques.farmer[0].look && live.plaques.farmer[0].look.hat === 'party' && !('home' in live.plaques.farmer[0]) && !('id' in live.plaques.farmer[0]), live.plaques.farmer[0]);

console.log('2. last week was crowned on that first lap');
const last = board.last;
ok('a final exists for last week', last && last.winners, last);
ok('gardener went to the KEPT pass, not the unkept leader', last.winners.gardener && last.winners.gardener.name === 'Jade', last.winners.gardener);
ok('…and the unkept leader is named, so the board can nudge her', last.unkept.gardener && last.unkept.gardener.name === 'Sparkly', last.unkept);
ok('raver went to Jade too (nobody else raved)', last.winners.raver && last.winners.raver.name === 'Jade', last.winners.raver);
ok('citizen is the widest kept pass', last.winners.citizen && last.winners.citizen.name === 'Jade', last.winners.citizen);
ok('farmer had no kept, named contender — no plaque, honestly', !last.winners.farmer, last.winners);
const jade = JSON.parse(env.PASSES._m.get('pass/aaaa1111.json'));
ok('the badges landed on the record', jade.blob.pass.patches['wk-gardener'] > 0 && jade.blob.pass.patches['wk-citizen'] > 0, jade.blob.pass.patches);
ok('…with the honour written down', Array.isArray(jade.honours) && jade.honours.some((h) => h.plaque === 'gardener'), jade.honours);
const finalsBefore = [...env.PASSES._m.keys()].filter((k) => k.startsWith('citizen/final-')).length;
guard = 0; r = { people: 0 };
while (!r.people && guard++ < 20) r = await hit('/admin/rollup/tick?key=desk-key');
ok('the next lap does not crown the same week twice', [...env.PASSES._m.keys()].filter((k) => k.startsWith('citizen/final-')).length === finalsBefore
  && JSON.parse(env.PASSES._m.get('pass/aaaa1111.json')).honours.filter((h) => h.plaque === 'gardener').length === 1);

console.log('3. a winner sits the next four weeks out');
// plant Jade as last week's raver winner in the week before, then re-crown last week
const jadeTag = last.winners.gardener.tag;
env.PASSES._m.set('citizen/final-' + prevPrevId + '.json', JSON.stringify({ week: prevPrevId, winners: { raver: { name: 'Jade', tag: jadeTag } } }));
for (const k of [...env.PASSES._m.keys()]) if (k.startsWith('citizen/final-') && !k.includes(prevPrevId)) env.PASSES._m.delete(k);
env.PASSES._m.set('rollup/state.json', JSON.stringify({ ...JSON.parse(env.PASSES._m.get('rollup/state.json')), citFinal: null }));
guard = 0; r = { people: 0 };
while (!r.people && guard++ < 20) r = await hit('/admin/rollup/tick?key=desk-key');
board = await hit('/citizen');
ok('raver skipped Jade this time (no other kept raver → no plaque)', !board.last.winners.raver, board.last.winners);
ok('gardener still hers (a different plaque)', board.last.winners.gardener && board.last.winners.gardener.name === 'Jade', board.last.winners.gardener);

console.log('4. the route is public and cached, and carries nothing secret');
const res = await worker.fetch(new Request('https://w.dev/citizen', { headers: { Origin: ORIGIN } }), env, ctx);
ok('no key needed, CORS on, five-minute cache', res.status === 200 && res.headers.get('Access-Control-Allow-Origin') === ORIGIN && /max-age=300/.test(res.headers.get('Cache-Control') || ''), [res.status, res.headers.get('Cache-Control')]);
const txt = JSON.stringify(await res.json());
ok('no record key or credential in the payload', !/aaaa1111|bbbb2222|dddd4444|tokens/.test(txt));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
