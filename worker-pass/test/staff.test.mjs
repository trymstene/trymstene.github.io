// 💼 STAFF OF THE WEEK — one per workplace, crowned on the first lap after a week ends (24 Sep 2026).
//
// Trym: "we can build the logic for staff for the week, but implement it visually later … display it in the town or by the
// actual shops, and not in the park". This proves the logic against a fake R2 and a faked clock: the week's work XP decides;
// a poor week, a thin week, a nameless or unkept pass and a QA home are never crowned; a workplace nobody really worked names
// nobody; the crown lands on the job record once; the public board carries names and looks, never a key; and no week before
// STAFF_FROM (the first whose sheets count their XP) is ever crowned.
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
const ctx = { waitUntil() {} };
let pass = 0, fail = 0;
const ok = (name, cond, extra) => { if (cond) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name, extra === undefined ? '' : JSON.stringify(extra)); } };

// ── the clock: a Wednesday in W41, so last week is W40 (the first week staff of the week can crown) ──
const REAL_NOW = Date.now;
let CLOCK = Date.UTC(2026, 9, 7, 12, 0, 0);
Date.now = () => CLOCK;
function weekOf(ms) {   // the worker's own ISO week
  const d = new Date(ms), day = (d.getUTCDay() + 6) % 7;
  const start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - day * DAY;
  const th = new Date(start + 3 * DAY), jan1 = Date.UTC(th.getUTCFullYear(), 0, 1);
  return { id: th.getUTCFullYear() + '-W' + String(Math.floor((th.getTime() - jan1) / DAY / 7) + 1).padStart(2, '0'), from: start };
}
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);

function world() {
  const env = { PASSES: fakeR2(), ALLOWED_ORIGIN: ORIGIN, PASS_HMAC: 't', MEMBER_HMAC: 'h', PASS_ADMIN_KEY: 'desk-key' };
  const hit = (path) => worker.fetch(new Request('https://w.dev' + path, { headers: { Origin: ORIGIN } }), env, ctx).then((r) => r.json());
  // a worker: a name, a kept pass or not, and the week's sheets by week { at, xp, days, ...counts }
  const person = (key, name, sheets, opts = {}) => {
    const done = {}, wk = {};
    for (const [w, s] of Object.entries(sheets)) {
      const { days = 0, ...sheet } = s;
      done[w] = sheet;
      const from = weekOf(CLOCK).id === w ? weekOf(CLOCK).from : weekOf(CLOCK - 7 * DAY).id === w ? weekOf(CLOCK - 7 * DAY).from : weekOf(CLOCK - 14 * DAY).from;
      wk[w] = Object.fromEntries(Array.from({ length: days }, (_, i) => [iso(from + i * DAY), sheet.at]));
    }
    const rec = { updated: CLOCK, blob: { name, bbLast: { hat: 'party', glasses: 'none' }, shelf: [], pass: { created: CLOCK - 30 * DAY, patches: {}, days: [], base: {}, led: {}, stats: {} } },
      log: { ev: [], n: 0, seen: [], drop: 0, pushes: 0, unsure: 0, drift: {} },
      job: { at: Object.values(sheets)[0].at, since: CLOCK - 20 * DAY, wk, paid: {}, done, zero: 0, rf: 1 }, ...(opts.rec || {}) };
    env.PASSES._m.set('pass/' + key + '.json', JSON.stringify(rec));
    if (opts.kept !== false) env.PASSES._m.set('pass/m' + key + '.json', JSON.stringify({ link: key, mail: 1, tokens: {} }));
  };
  const lap = async () => { let r = await hit('/admin/rollup/tick?key=desk-key'), g = 0; while (!r.people && g++ < 20) r = await hit('/admin/rollup/tick?key=desk-key'); return r; };
  const rec = (key) => JSON.parse(env.PASSES._m.get('pass/' + key + '.json'));
  return { env, hit, person, lap, rec };
}

const W40 = weekOf(CLOCK - 7 * DAY).id, W41 = weekOf(CLOCK).id;
console.log('1. last week crowned, one per workplace, by the week’s work');
{
  const { env, hit, person, lap, rec } = world();
  person('aaaa0001', 'Mo', { [W40]: { at: 'cafe', xp: 300, cups: [0, 6, 20], r: 2, days: 4 }, [W41]: { at: 'cafe', xp: 50, cups: [0, 1, 3], r: 2, days: 1 } });
  person('aaaa0002', 'Lu', { [W40]: { at: 'cafe', xp: 200, cups: [0, 4, 8], r: 1, days: 3 } });
  person('aaaa0003', 'Pat', { [W40]: { at: 'store', xp: 500, restock: 1, serve: 0, r: 1, days: 5 } });     // a poor week: one duty of six
  person('aaaa0004', 'Ti', { [W40]: { at: 'stand', xp: 20, cups: [0, 1, 0], r: 1, days: 1 } });            // a thin week: under a day's work
  person('aaaa0005', '', { [W40]: { at: 'post', xp: 400, sort: 3, r: 1, days: 3 } });                      // nameless
  person('aaaa0006', 'Sam', { [W40]: { at: 'post', xp: 300, sort: 3, r: 1, days: 3 }, [W41]: { at: 'post', xp: 120, sort: 2, r: 1, days: 2 } });
  person('aaaa0007', 'Gus', { [W40]: { at: 'condo', xp: 250, sweep: 3, fix: 3, r: 1, days: 4 } }, { kept: false });   // never kept
  person('aaaa0008', 'Proofy', { [W40]: { at: 'cafe', xp: 999, cups: [0, 0, 40], r: 4, days: 7 } }, { rec: { qa: 1 } });   // the nightly proof
  const r = await lap();
  ok('the lap finished', r.people >= 6, r);
  const board = await hit('/staff');
  const s = (board.last && board.last.staff) || {};
  ok('⭐ last week is crowned: ' + W40, board.last && board.last.week === W40, board.last);
  ok('⭐ the Coffee Cup’s staff is the one who did the most work there (Mo, not Lu — and not the QA home)', s.cafe && s.cafe.name === 'Mo' && s.cafe.xp === 300 && s.cafe.weeks === 1, s.cafe);
  ok('the post office’s is Sam — the nameless worker above him has no name for the plaque', s.post && s.post.name === 'Sam', s.post);
  ok('a poor week is never crowned: the store names nobody', !s.store, s.store);
  ok('under a day’s work is not a week: the stand names nobody', !s.stand, s.stand);
  ok('an unkept pass is never crowned: the arcade names nobody', !s.condo, s.condo);
  ok('the crown landed on Mo’s job record', JSON.stringify(rec('aaaa0001').job.sotw) === JSON.stringify([{ week: W40, at: 'cafe' }]), rec('aaaa0001').job.sotw);
  ok('this week’s running board: the leaders so far, per workplace', board.live && board.live.week === W41 && board.live.top.cafe[0].name === 'Mo' && board.live.top.post[0].name === 'Sam' && board.live.top.post[0].xp === 120, board.live);
  const raw = JSON.stringify(board);
  ok('the public board carries names and looks, never a key', !/aaaa000/.test(raw) && !raw.includes('"home"'), raw.slice(0, 200));
  await lap();
  ok('the next lap does not crown the same week twice', rec('aaaa0001').job.sotw.length === 1, rec('aaaa0001').job.sotw);
  // a week later Mo is crowned again: the plaque counts the weeks
  CLOCK += 7 * DAY;
  const W41b = weekOf(CLOCK - 7 * DAY).id;
  const m = rec('aaaa0001');
  m.job.done[W41b] = { at: 'cafe', xp: 280, cups: [0, 5, 18], r: 2 };
  m.job.wk[W41b] = Object.fromEntries([0, 1, 2, 3].map((i) => [iso(weekOf(CLOCK - 7 * DAY).from + i * DAY), 'cafe']));
  env.PASSES._m.set('pass/aaaa0001.json', JSON.stringify(m));
  await lap();
  const b2 = await hit('/staff');
  ok('⭐ crowned a second week: the plaque says two weeks', b2.last.week === W41b && b2.last.staff.cafe && b2.last.staff.cafe.name === 'Mo' && b2.last.staff.cafe.weeks === 2, b2.last);
  CLOCK = Date.UTC(2026, 9, 7, 12, 0, 0);
}

console.log('\n2. no week before STAFF_FROM is crowned: its sheets never counted their work XP');
{
  CLOCK = Date.UTC(2026, 8, 30, 12, 0, 0);   // a Wednesday in W40: last week is W39
  const { env, hit, person, lap } = world();
  const W39 = weekOf(CLOCK - 7 * DAY).id;
  person('bbbb0001', 'Early', { [W39]: { at: 'cafe', xp: 300, cups: [0, 6, 20], r: 1, days: 4 } });
  await lap();
  const board = await hit('/staff');
  ok('W39 names nobody, and no final is written for it', !board.last && ![...env.PASSES._m.keys()].some((k) => k.startsWith('staff/final-')), board.last);
  CLOCK = Date.UTC(2026, 9, 7, 12, 0, 0);
}

Date.now = REAL_NOW;
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
