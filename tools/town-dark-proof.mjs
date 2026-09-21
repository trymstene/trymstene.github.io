// 👻🔬 THE GHOSTS' DAMAGE, PROVEN ON A REAL WORKER (21 Sep 2026).
//
// Trym sat by the fountain through a night and the meter did not move: the town's own night is
// cosmetic and only Curse Nights charged it. Now a lamp a ghost puts out and a bin it tips are a
// point each (worker-rave TownRoom /life/dark). This is the walk for the rules that make that safe:
// ten a night shared, the clamp per report, the ghosts' floor of sixty (the town's own floor under a
// Curse Night), the proof of person, and that a fix does not touch the night's take — plus the night
// gate itself, which is a pure function of time.
//
// Run it against a local worker (nothing here should ever be written to production):
//   cd worker-rave && npx wrangler dev --port 8799 --local --var POST_OFF:0 --var MEMBER_HMAC:proof-secret \
//     --var LAUNCH_KEY:proof-key --var TOWN_NIGHT_ANYTIME:1
// …and once more with --var TOWN_CURSED_ANYTIME:1 and CURSED=1 in the environment for the curse floor.
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

// ── 2. the payload carries the night's cap and the floor ────────────────────────────────────
const CURSED = process.env.CURSED === '1';
const first = await room('');
ok(first.status === 200 && first.j && first.j.dark && first.j.dark.max === 10, 'the room says how much a night may take (dark.max 10)', first.status + ' ' + JSON.stringify(first.j && first.j.dark));
ok(first.j && first.j.dark && first.j.dark.floor === (CURSED ? 5 : 60), CURSED ? 'under a Curse Night the floor is the town’s own, 5' : 'and where the ghosts stop: 60', JSON.stringify(first.j && first.j.dark));
ok(first.j && first.j.today && typeof first.j.today.dark === 'number', "…and today's total is counted beside the fixes", JSON.stringify(first.j && first.j.today));

// ── 3. the floor first, while the night is still unspent ──────────────────────────────────────
// ⚠️ the night's take is keyed by the clock, so a proof run inside one twelve-minute night shares it
// with any run before it: the walk reads what is already spent and works from there.
const spent0 = first.j.dark.used | 0;
if (spent0 >= 10) console.log('  · tonight’s ten are already spent by an earlier run — the counts below read 0, which is the cap working; wait for the next night to see them count');
const FLOOR = CURSED ? 5 : 60;
const s62 = await setLife(62);
ok(s62 && s62.life === 62, 'the town is set to 62 for the walk (LAUNCH_KEY)', JSON.stringify(s62 && (s62.err || s62.life)));
const C = gid();
const c5 = await room('/dark', { pass: C, alt: C, wt: tokenFor(C), n: 5 });
const c5n = Math.max(0, Math.min(5, 10 - spent0, 62 - FLOOR));
ok(c5.status === 200 && c5.j.counted === c5n, CURSED ? 'under a Curse Night five things broken cost five (the floor is far below)' : 'five things broken cost only two: sixty is the floor the ghosts cannot cross', c5.status + ' ' + JSON.stringify(c5.j && { counted: c5.j.counted, life: c5.j.life }));
ok(c5.j && c5.j.life === 62 - c5n, 'and the meter stands at ' + (62 - c5n), c5.j && c5.j.life);
ok(c5.j && c5.j.dark.floor === FLOOR, 'the payload names the floor: ' + FLOOR, c5.j && c5.j.dark.floor);
const spent1 = spent0 + c5n;

// ── 4. the charge, the clamp, the night's cap ────────────────────────────────────────────────
const s90 = await setLife(90);
ok(s90 && s90.life === 90, 'the town is set to 90', JSON.stringify(s90 && (s90.err || s90.life)));
const A = gid();
const a1 = await room('/dark', { pass: A, alt: A, wt: tokenFor(A), n: 2 });
const c1n = Math.max(0, Math.min(2, 10 - spent1));
ok(a1.status === 200 && a1.j.counted === c1n, 'two things broken: ' + c1n + ' counted', a1.status + ' ' + JSON.stringify(a1.j && { counted: a1.j.counted, life: a1.j.life }));
ok(a1.j && a1.j.life === 90 - c1n, 'and the town is that much lower', a1.j && a1.j.life);
ok(a1.j && a1.j.dark && a1.j.dark.used === spent1 + c1n, "tonight's take says so", JSON.stringify(a1.j && a1.j.dark));
const a2 = await room('/dark', { pass: A, alt: A, wt: tokenFor(A), n: 99 });
const c2n = Math.max(0, 10 - spent1 - c1n);
ok(a2.j && a2.j.counted === c2n, 'a report of 99 is clamped to what the night has left: ' + c2n, a2.j && a2.j.counted);
ok(a2.j && a2.j.dark.used === 10 && a2.j.life === 90 - c1n - c2n, '…which spends the night: 10 of 10', JSON.stringify(a2.j && { life: a2.j.life, dark: a2.j.dark }));
const B = gid();
const b1 = await room('/dark', { pass: B, alt: B, wt: tokenFor(B), n: 1 });
ok(b1.status === 200 && b1.j.counted === 0, 'somebody else watching the same night adds nothing past the ten — and it is not an error', b1.status + ' counted ' + (b1.j && b1.j.counted));

// ── 5. a fix does not touch the night ────────────────────────────────────────────────────────
const lifeBefore = b1.j.life;
const f1 = await room('/fix', { pass: A, alt: A, wt: tokenFor(A) });
ok(f1.j && f1.j.counted === 1 && f1.j.life === Math.min(100, lifeBefore + 2), 'a fix still lifts the town two', JSON.stringify(f1.j && { counted: f1.j.counted, life: f1.j.life }));
ok(f1.j && f1.j.dark && f1.j.dark.used === 10, "…and the night's take is still spent", JSON.stringify(f1.j && f1.j.dark));

// ── 6. proof of person ───────────────────────────────────────────────────────────────────────
const D = gid();
const d1 = await room('/dark', { pass: D, alt: gid(), wt: tokenFor(D, 'wrong-secret'), n: 1 });
ok(d1.status === 401, 'a person-id claim with a forged token is refused (401)', d1.status + ' ' + JSON.stringify(d1.j && d1.j.err));
const d2 = await room('/dark', { pass: '', alt: '', n: 1 });
ok(d2.status === 400, 'and no pass at all is a bad request', d2.status);
await setLife(42);

for (const [yes, what, saw] of out) console.log((yes ? '  ✓ ' : '  ✗ ') + what + (yes ? '' : '   — saw ' + saw));
if (bad) { console.error('\n✗ ' + bad + ' of ' + out.length + ' did not hold'); process.exit(1); }
console.log('\n✅ the ghosts’ damage holds: ' + out.length + ' checks — the gate’s arithmetic, the charge, the clamp, ten a night,\n   a fix that touches none of it, the floor, and the proof of person');
