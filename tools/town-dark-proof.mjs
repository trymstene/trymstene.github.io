// 👻🔬 THE GHOSTS' DAMAGE, PROVEN ON A REAL WORKER (21 Sep 2026).
//
// Trym sat by the fountain through a night and the meter did not move: the town's own night is
// cosmetic and only Curse Nights charged it. Now a lamp a ghost puts out and a bin it tips are a
// point each (worker-rave TownRoom /life/dark). This is the walk for the rules that make that safe:
// the cap per person per day, the clamp per report, the floor, the proof of person, and that a fix
// does not quietly forgive the night — plus the night gate itself, which is a pure function of time.
//
// Run it against a local worker (nothing here should ever be written to production):
//   cd worker-rave && npx wrangler dev --port 8799 --local --var POST_OFF:0 --var MEMBER_HMAC:proof-secret \
//     --var LAUNCH_KEY:proof-key --var TOWN_NIGHT_ANYTIME:1
//   RAVE_API=http://127.0.0.1:8799 node tools/town-dark-proof.mjs
//
// ⚠️ TOWN_NIGHT_ANYTIME opens the night gate for the proof, because the gate is the town clock and
// the walk cannot wait up to ten minutes for beat 5. The gate's own arithmetic is checked here in
// node, from the same shared function the worker carries (src/lib/world.js CLOCK block).
import { createHmac, randomBytes } from 'node:crypto';
import { townNightAt, TOWN_DAY_MS } from '../src/lib/world.js';

const API = process.env.RAVE_API || 'http://127.0.0.1:8799';
const HMAC = process.env.MEMBER_HMAC || 'proof-secret';
const KEY = process.env.LAUNCH_KEY || 'proof-key';
const gid = () => randomBytes(8).toString('hex');
const tokenFor = (id, secret = HMAC) => {
  const base = id + '.' + (Date.now() + 3600000) + '.';
  return base + '.' + createHmac('sha256', secret).update('wt:' + base).digest('hex');
};
const O = { Origin: 'https://trymstene.com', 'Content-Type': 'application/json' };
const out = []; let bad = 0;
const ok = (yes, what, saw) => { out.push([yes, what, saw]); if (!yes) bad++; };

const room = async (path, body) => {
  const r = await fetch(API + '/town-life' + path, { method: body ? 'POST' : 'GET', headers: O, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = JSON.parse(await r.text() || 'null'); } catch (e) {}
  return { status: r.status, j };
};
const setLife = async (v) => (await room('/set', { key: KEY, life: v })).j;

// ── 1. the night gate, as arithmetic ─────────────────────────────────────────────────────────
const d0 = 1_700_000_000_000 - (1_700_000_000_000 % TOWN_DAY_MS);   // a dawn
ok(townNightAt(d0 + 600000) === true, 'beat 5 begins at 600000 and is night', townNightAt(d0 + 600000));
ok(townNightAt(d0 + 599999) === false, 'the last moment of the evening is not', townNightAt(d0 + 599999));
ok(townNightAt(d0 + 719999) === true, 'the last moment of the night is', townNightAt(d0 + 719999));
ok(townNightAt(d0 + 29999) === true, 'the first half-minute of dawn still counts as the night just gone', townNightAt(d0 + 29999));
ok(townNightAt(d0 + 30000) === false, '…and then it does not', townNightAt(d0 + 30000));

// ── 2. the payload carries the cap ───────────────────────────────────────────────────────────
const first = await room('');
ok(first.status === 200 && first.j && first.j.dark && first.j.dark.max === 8, 'the room says how much of a night one person may charge (dark.max 8)', first.status + ' ' + JSON.stringify(first.j && first.j.dark));
ok(first.j && first.j.today && typeof first.j.today.dark === 'number', "…and today's total is counted beside the fixes", JSON.stringify(first.j && first.j.today));

// ── 3. the charge, the clamp, the cap ────────────────────────────────────────────────────────
const s60 = await setLife(60);
ok(s60 && s60.life === 60, 'the town is set to 60 for the walk (LAUNCH_KEY)', JSON.stringify(s60 && (s60.err || s60.life)));
const A = gid();
const a1 = await room('/dark', { pass: A, alt: A, wt: tokenFor(A), n: 2 });
ok(a1.status === 200 && a1.j.counted === 2, 'two things broken: both counted', a1.status + ' ' + JSON.stringify(a1.j && { counted: a1.j.counted, life: a1.j.life }));
ok(a1.j && a1.j.life === 58, 'and the town is two lower', a1.j && a1.j.life);
ok(a1.j && a1.j.dark && a1.j.dark.used === 2, "the person's share says 2", JSON.stringify(a1.j && a1.j.dark));
const a2 = await room('/dark', { pass: A, alt: A, wt: tokenFor(A), n: 99 });
ok(a2.j && a2.j.counted === 6, 'a report of 99 is clamped to six', a2.j && a2.j.counted);
ok(a2.j && a2.j.life === 52 && a2.j.dark.used === 8, '…which spends the day: 52, share 8 of 8', JSON.stringify(a2.j && { life: a2.j.life, dark: a2.j.dark }));
const a3 = await room('/dark', { pass: A, alt: A, wt: tokenFor(A), n: 1 });
ok(a3.status === 200 && a3.j.counted === 0, 'past the cap nothing is counted — and it is not an error', a3.status + ' counted ' + (a3.j && a3.j.counted));
ok(a3.j && a3.j.life === 52, 'the meter stands where the cap left it', a3.j && a3.j.life);

// ── 4. a fix does not forgive the night ──────────────────────────────────────────────────────
const f1 = await room('/fix', { pass: A, alt: A, wt: tokenFor(A) });
ok(f1.j && f1.j.counted === 1 && f1.j.life === 54, 'a fix by the same person still lifts the town two', JSON.stringify(f1.j && { counted: f1.j.counted, life: f1.j.life }));
ok(f1.j && f1.j.dark && f1.j.dark.used === 8, "…and their night's share is still spent (k rides along on a fix)", JSON.stringify(f1.j && f1.j.dark));
const a4 = await room('/dark', { pass: A, alt: A, wt: tokenFor(A), n: 1 });
ok(a4.j && a4.j.counted === 0 && a4.j.life === 54, 'so the cap holds after a fix too', JSON.stringify(a4.j && { counted: a4.j.counted, life: a4.j.life }));

// ── 5. the floor ─────────────────────────────────────────────────────────────────────────────
await setLife(6);
const B = gid();
const b1 = await room('/dark', { pass: B, alt: B, wt: tokenFor(B), n: 3 });
ok(b1.j && b1.j.counted === 3 && b1.j.life === 5, 'a curse can empty the square, never delete the town: 6 − 3 stops at the floor, 5', JSON.stringify(b1.j && { counted: b1.j.counted, life: b1.j.life }));

// ── 6. proof of person ───────────────────────────────────────────────────────────────────────
const C = gid();
const c1 = await room('/dark', { pass: C, alt: gid(), wt: tokenFor(C, 'wrong-secret'), n: 1 });
ok(c1.status === 401, 'a person-id claim with a forged token is refused (401)', c1.status + ' ' + JSON.stringify(c1.j && c1.j.err));
const c2 = await room('/dark', { pass: '', alt: '', n: 1 });
ok(c2.status === 400, 'and no pass at all is a bad request', c2.status);

// ── 7. the total, seen by everybody ──────────────────────────────────────────────────────────
const last = await room('');
ok(last.j && last.j.today && last.j.today.dark === 11, "today's total is the sum of every person's share (8 + 3)", JSON.stringify(last.j && last.j.today));
await setLife(42);

for (const [yes, what, saw] of out) console.log((yes ? '  ✓ ' : '  ✗ ') + what + (yes ? '' : '   — saw ' + saw));
if (bad) { console.error('\n✗ ' + bad + ' of ' + out.length + ' did not hold'); process.exit(1); }
console.log('\n✅ the ghosts’ damage holds: ' + out.length + ' checks — the gate’s arithmetic, the charge, the clamp, the cap,\n   a fix that forgives nothing, the floor, and the proof of person');
