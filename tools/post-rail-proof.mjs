// ✉️🔬 THE LETTER RAIL, PROVEN ON THE REAL WORKER.
//
// The plan's rule for the kill switch is flat (docs/town-jobs-plan.md §6): flip POST_OFF to "0" only
// when the filter, the caps, the report and the review list have all been walked ON THE REAL WORKER.
// Nothing in the repo could do that, so the flip was a leap. This is the walk.
//
// ⚠️ IT ONLY WORKS WITH THE SWITCH OFF, and that is not a fault in the walk. POST_OFF is checked before
// the origin and before the body — it is the first thing in the route, by design — so while it is "1"
// every path answers 503 and nothing below can be tested. Run it in the window between flipping the
// switch off and letting anybody in.
//
// Run (PowerShell):
//   node tools/post-rail-proof.mjs --key <POST_ADMIN_KEY>
//
// What it proves, in order:
//   1. a plain letter is delivered
//   2. a letter carrying a way to REACH somebody is refused — and the refusal says nothing
//   3. a letter merely NAMING a platform is delivered AND flagged
//   4. the per-sender-per-box cap bites
//   5. the box lists what was delivered and nothing that was not
//   6. reporting takes the letter out of the box on the tap
//   7. the reported letter is on the desk, behind the key
//   8. the desk is not reachable without the key, and /post/review is not reachable at all
//   9. …and it clears up after itself
//
// ⚠️ IT WRITES TO A REAL MAILBOX. `qa-post-proof` is a yard nobody has; what it leaves behind is at
// most two delivered letters, which expire on the rail's own 30-day clock, and the queue rows it
// makes are dropped at the end.
import { CAPS, CARD } from '../src/lib/letter-gate.js';

const API = process.env.RAVE_API || 'https://banana-rave.trymstene.workers.dev';
const ORIGIN = process.env.POST_ORIGIN || 'https://trymstene.com';
const KEY = (process.argv[process.argv.indexOf('--key') + 1] || process.env.POST_ADMIN_KEY || '').trim();
const BOX = 'qa-post-proof';
// ⚠️ A SENDER PER RUN. The cap is per sender, per box, per DAY — so a fixed sender means the walk can
// be run once and then refuses itself for the rest of the day, which is exactly what it did the second
// time. The box is stable (it is the thing being read); the sender is not.
const FROM = 'qa-post-' + Math.random().toString(36).slice(2, 8);

if (!KEY || KEY.startsWith('--')) {
  console.error('✗ no key. node tools/post-rail-proof.mjs --key <POST_ADMIN_KEY>');
  process.exit(2);
}

const out = [];
let bad = 0;
const ok = (yes, what, saw) => { out.push([yes, what, saw]); if (!yes) bad++; };

async function rail(path, body, qs) {
  const res = await fetch(API + '/post' + path + (qs || ''), {
    method: body ? 'POST' : 'GET',
    headers: { Origin: ORIGIN, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let j = null;
  try { j = JSON.parse(await res.text() || 'null'); } catch (e) { j = null; }
  return { status: res.status, j };
}
const send = (text, from) => rail('/send', { to: BOX, from: from || FROM, text });
const desk = (key, body) => fetch(API + '/post-review?key=' + encodeURIComponent(key), {
  method: body ? 'POST' : 'GET',
  headers: body ? { 'Content-Type': 'application/json' } : undefined,
  body: body ? JSON.stringify(body) : undefined,
}).then(async (r) => ({ status: r.status, j: await r.json().catch(() => null) }));

// ── 0. the switch is off, or none of this means anything ─────────────────────────────────────────
const first = await rail('/box', null, '?slug=' + BOX);
if (first.status === 503) {
  console.error('✗ POST_OFF is still "1" — every path answers 503 before anything else is read, which is\n'
    + '  exactly right and also why this walk cannot run. Flip it to "0", deploy, run this, then let\n'
    + '  anybody in:  wrangler deploy --var POST_OFF:0   (or edit wrangler.toml and deploy)');
  process.exit(3);
}
ok(first.status === 200, 'the rail is open and the box answers', first.status);

// ── 1. a plain letter ────────────────────────────────────────────────────────────────────────────
const stamp = Date.now().toString(36);
const good = await send('The sunflowers came up crooked this year. ' + stamp);
ok(good.status === 200 && good.j && good.j.ok, 'a plain letter is delivered', good.status);

// ── 2. …and one carrying a way to reach somebody is not ──────────────────────────────────────────
// ⭐ AND THE REFUSAL SAYS NOTHING. The whole point: a precise reason is a tutorial for getting round
// the filter, so the body may carry `refused` and never a rule, a word or a shape.
const TELLS = /link|url|website|email|phone|number|address|handle|username|discord|contact|@/i;
for (const [what, text] of [
  ['a web address', 'come and see mine at bananaworld dot com ' + stamp],
  ['an email', 'write to me at ada at example dot com ' + stamp],
  ['a phone number', 'ring me on 555 0134 992 ' + stamp],
  ['an @handle', 'find me @adabanana ' + stamp],
  ['an invitation', 'add me on there and we can talk ' + stamp],
]) {
  const r = await send(text);
  ok(r.status === 422, 'refused: ' + what, r.status);
  ok(!TELLS.test(JSON.stringify(r.j || {})), '…and the refusal names no rule (' + what + ')', JSON.stringify(r.j));
}

// ── 3. a platform NAMED is delivered and flagged ─────────────────────────────────────────────────
// the plan is explicit: refusing the word would refuse innocent letters while this world links its own
const flag = await send('the discord is quieter than here these days ' + stamp);
ok(flag.status === 200, 'a letter merely naming a platform is delivered', flag.status);

// ── 4. the cap ───────────────────────────────────────────────────────────────────────────────────
// ⚠️ THE NUMBER COMES FROM THE FILE THAT OWNS IT, never from this walk — and how many sends are left
// depends on how many got THROUGH above, because a refusal does not count against the cap. Counting
// them is the difference between a walk that tests the cap and one that happens to agree with it.
let sent = 0;
for (const r of [good, flag]) if (r.status === 200) sent++;
while (sent < CAPS.sendTo) {
  const r = await send('another one ' + sent + ' ' + stamp);
  ok(r.status === 200, 'letter ' + (sent + 1) + ' of the day is delivered', r.status);
  sent++;
}
const capped = await send('one over ' + stamp);
ok(capped.status === 429, 'the ' + (CAPS.sendTo + 1) + 'th to one box in a day is refused', capped.status);
ok(!/\d/.test(String((capped.j || {}).error || '')), '…without publishing the number', JSON.stringify(capped.j));

// ── 4b. 📮 A POSTCARD TAKES THE SAME RAIL ──────────────────────────────────────────────
// ⚠️ from a FRESH sender, because the cap above is spent — a card is post and pays the same cap
const CFROM = 'qa-card-' + Math.random().toString(36).slice(2, 8);
const card = await rail('/send', { to: BOX, from: CFROM, card: { tpl: 'rave', line: 2, look: { hat: 'tophat', glasses: 'shades', extras: {} } } });
ok(card.status === 200, 'a postcard is delivered', card.status);
for (const [what, c] of [
  ['an unknown place', { tpl: 'somewhere', line: 0 }],
  ['a line off the end of the deck', { tpl: 'park', line: CARD.lines }],
  ['a line that is not a number', { tpl: 'park', line: '0' }],
]) {
  const r = await rail('/send', { to: BOX, from: CFROM + 'x', card: c });
  ok(r.status === 422, 'refused: ' + what, r.status);
}
// ⭐ AND IT CARRIES NO WORDS AT ALL. The one claim that makes a card moderation-free: whatever a
// sender puts in `text` beside a card is not stored, because the card path never looks at it.
const sneaky = await rail('/send', { to: BOX, from: CFROM + 'y', card: { tpl: 'park', line: 0 }, text: 'come and see me at bananaworld dot com' });
ok(sneaky.status === 200, 'a card sent with text beside it still goes', sneaky.status);
const peek = await rail('/box', null, '?slug=' + BOX);
const sneaked = ((peek.j || {}).letters || []).find((l) => l.id === (sneaky.j || {}).id);
ok(!!sneaked && sneaked.kind === 'card', '…as a card', sneaked && sneaked.kind);
ok(!!sneaked && !sneaked.text, '…and the text beside it was never stored', sneaked && sneaked.text);

// ── 5. the box ───────────────────────────────────────────────────────────────────────────────────
const box = await rail('/box', null, '?slug=' + BOX);
const mine = ((box.j || {}).letters || []).filter((l) => String(l.text || '').includes(stamp));
ok(mine.length === sent, 'the box holds every letter that was delivered and none that was refused', mine.length + ' of ' + sent);
ok(((box.j || {}).letters || []).some((l) => l.kind === 'card' && l.card && l.card.tpl === 'rave'), 'and the postcard is in it, as a recipe', 'no');

// ── 6. a report takes it out on the tap ──────────────────────────────────────────────────────────
const victim = mine[0];
const rep = victim ? await rail('/report', { slug: BOX, id: victim.id, by: BOX }) : { status: 0 };
ok(rep.status === 200, 'a letter can be reported', rep.status);
const after = await rail('/box', null, '?slug=' + BOX);
ok(!((after.j || {}).letters || []).some((l) => l.id === (victim || {}).id), '…and it is out of the box', 'still there');

// ── 7. the desk has it ───────────────────────────────────────────────────────────────────────────
const d = await desk(KEY);
ok(d.status === 200, 'the desk answers with the key', d.status);
const rows = (d.j || {}).rows || [];
const got = rows.find((r) => r.id === (victim || {}).id);
ok(!!got, 'the reported letter is on the desk', rows.length + ' rows');
ok(got && got.to === BOX, '…filed under the box it came out of', got && got.to);
ok(rows.some((r) => r.kind === 'flagged' && String(r.text || '').includes(stamp)), 'and the flagged one is there too', 'no');

// ── 8. and the doors are shut ────────────────────────────────────────────────────────────────────
const nokey = await desk('not-the-key');
ok(nokey.status === 404, 'the desk is 404 without the key', nokey.status);
// ⚠️ THE ONE THIS WALK EXISTS FOR. /post forwards what comes after it into the room, and the room also
// answers /review — the reported letters, kept whole, in a box addressed by a PUBLIC slug.
const sneak = await rail('/review', null, '?slug=' + BOX);
ok(sneak.status === 404, 'the review list is not reachable from the public rail', sneak.status);
for (const p of ['/queue', '/queue-put', '/queue-drop']) {
  const s = await rail(p, null, '?slug=' + BOX);
  ok(s.status === 404, 'nor is ' + p, s.status);
}

// ── 9. clear up ──────────────────────────────────────────────────────────────────────────────────
const keys = rows.filter((r) => String(r.text || '').includes(stamp)).map((r) => r.k);
if (keys.length) await desk(KEY, { keys });
const left = await desk(KEY);
ok(!((left.j || {}).rows || []).some((r) => String(r.text || '').includes(stamp)), 'the desk clears a row', 'still there');

// ── the receipt ──────────────────────────────────────────────────────────────────────────────────
for (const [yes, what, saw] of out) console.log((yes ? '  ✓ ' : '  ✗ ') + what + (yes ? '' : '   — saw ' + saw));
if (bad) {
  console.error('\n✗ the letter rail is NOT ready: ' + bad + ' of ' + out.length + ' did not hold.\n'
    + '  Put POST_OFF back to "1" and deploy before anybody finds it.');
  process.exit(1);
}
console.log('\n✅ the letter rail holds on the real worker: ' + out.length + ' checks — the filter BOTH ways,\n'
  + '   the cap, the report, the desk and every shut door. ' + (sent - 1) + ' letters are left in ' + BOX + ';\n'
  + '   they expire on the rail’s own ' + CAPS.keepDays + '-day clock.');
