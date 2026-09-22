// ✉️🔒 THE PUBLIC POST RAIL REACHES SIX PATHS, AND THE REVIEW QUEUE IS NOT ONE OF THEM.
//
// worker-rave's /post route forwards whatever comes after /post straight into the recipient's room —
// and the room also answers /review, the list of letters somebody REPORTED, kept whole. A yard slug
// is public (it is the sign on the fence), so `/post/review?slug=anyone` from any allowed origin was
// a reader for the one thing in this world that is held on purpose. The room's own comment said
// "internal only: no origin ever reaches this", and it was wrong the day it was written.
//
// This is a SOURCE check, not a live one: it runs before a deploy, on the branch, with no secrets and
// no network — the place a hole like this has to be caught.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(ROOT, 'worker-rave/src/index.js'), 'utf8');
const fail = [];

// ── 1. the rail allow-lists, and it lists exactly the four the game calls ───────────────────────
const m = /if \(!\[([^\]]*)\]\.includes\(path\)\)/.exec(src);
if (!m) {
  fail.push('the /post route no longer allow-lists its sub-paths — anything the room answers is public again');
} else {
  const allowed = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]).sort();
  const want = ['/accept', '/away', '/box', '/read', '/report', '/send'];   // 🚪 22 Sep: the knock's two answers
  if (allowed.join(',') !== want.join(',')) {
    fail.push(`the rail allows ${allowed.join(', ')} — it must allow exactly ${want.join(', ')}`);
  }
}

// ── 2. every path the room answers is either on that list or admin-only ─────────────────────────
// ⚠️ THE POINT OF THIS ONE. The list above cannot rot on its own; what rots is somebody adding a path
// to PostRoom and nobody thinking about the rail. Each new one has to be named here deliberately.
const room = src.slice(src.indexOf('export class PostRoom'));
const paths = [...room.matchAll(/url\.pathname === '([^']+)'/g)].map((x) => x[1]);
const PUBLIC = ['/send', '/box', '/read', '/report', '/accept', '/away'];
const ADMIN = ['/review', '/queue', '/queue-put', '/queue-drop', '/sent'];   // reached by the router alone, never by an origin (/sent: the sender's own room hears where its post went)
for (const p of paths) {
  if (!PUBLIC.includes(p) && !ADMIN.includes(p)) {
    fail.push(`PostRoom answers ${p} and tools/check-post-rail.mjs has never heard of it — say whether the rail may reach it`);
  }
}
for (const p of PUBLIC) if (!paths.includes(p)) fail.push(`the rail allows ${p} and the room does not answer it`);

// ── 3. the desk's door is key-gated and fails closed ────────────────────────────────────────────
const desk = /if \(url\.pathname === '\/post-review'\) \{([\s\S]{0,400})/.exec(src);
if (!desk) fail.push('there is no /post-review route — the reported letters land nowhere anybody opens');
else {
  if (!/env\.POST_ADMIN_KEY/.test(desk[1])) fail.push('/post-review is not gated on POST_ADMIN_KEY');
  if (!/!env\.POST_ADMIN_KEY/.test(desk[1])) fail.push('/post-review does not FAIL CLOSED — an unset secret must read as 404, never as an open desk');
  if (!/status: 404/.test(desk[1])) fail.push('/post-review answers something other than 404 when refused — deny-as-nothing is the house pattern');
}

// ── 4. 📮 a postcard survives a letters shutdown ───────────────────────────────────────────
// ⭐ THE PLAN'S OWN PROMISE (§6): "the line is picked from the rig's deck, never typed, so the postcard
// survives a letters shutdown and has no moderation surface of its own." That is only true while the
// CARD path answers BEFORE the TEXT_OFF check — put the switch first and the feature it was built to
// spare goes down with the words it was built to be free of. It is an ordering, so a source check can
// hold it: walked live once (a letter 503s, a card 200s), and this is what stops it drifting back.
const room2 = src.slice(src.indexOf('export class PostRoom'));
const iCard = room2.indexOf('if (b.card)');
const iText = room2.indexOf('TEXT_OFF');
if (iCard < 0) fail.push('PostRoom has no postcard path — /send only takes free text');
else if (iText < 0) fail.push('nothing checks TEXT_OFF in the room — the letters-only switch does nothing');
else if (iCard > iText) fail.push('TEXT_OFF is checked BEFORE the postcard path: a letters shutdown would take the postcards down too, which is the one thing they exist not to do');
if (!/checkCard/.test(src)) fail.push('the room does not run checkCard — a postcard’s shape is not judged anywhere');

// ── 5. and the kill switch is still checked before anything else ────────────────────────
const rail = src.slice(src.indexOf("url.pathname === '/post'"));
const off = rail.indexOf('POST_OFF');
const originCheck = rail.indexOf('allowed.includes(origin)) return');
if (off < 0) fail.push('the /post route no longer checks POST_OFF');
else if (originCheck > -1 && off > originCheck) fail.push('POST_OFF is checked AFTER the origin — the kill switch must be the first thing in the route');

// ── 6. 🛡 A LETTER COMES FROM SOMEBODY WHO PROVED IT ───────────────────────────────
// `from` was read straight off the request body and never checked — anybody could drop a letter into
// anybody's mailbox signed with any house's name. It was only ever hidden by the fact that nobody
// could find out another player's address, and the town's address book (21 Sep) publishes exactly
// that, by design. The sender is resolved from the world token in the ROUTER now and handed to the
// room as `__from`; this holds the three halves of that so none of them can quietly come undone.
{
  // ⚠️ SCOPED TO THE ROUTER, not to the file. `__from` also appears in the ROOM (where it is read),
  // so a whole-file search for it passed happily with the injection deleted — which is the exact
  // failure this check exists to catch. Proven red by removing the injection.
  const route = src.slice(src.indexOf("url.pathname === '/post'"), src.indexOf('export class PostRoom'));
  if (!/__from: sender/.test(route)) {
    fail.push('the rail no longer injects __from — a letter’s sender would be whatever the caller typed');
  }
  if (!/worldTokenOf\(env, String\(body\.wt/.test(route)) {
    fail.push('the /post route does not verify a world token, so __from is not resolved from a proof');
  }
  if (!/status: 401/.test(route)) {
    fail.push('an unproven /send is not refused — it must be 401, never delivered under a borrowed name');
  }
  const send = room2.slice(room2.indexOf("url.pathname === '/send'"), room2.indexOf("url.pathname === '/send'") + 600);
  if (!/b\.__from \|\| b\.from/.test(send)) {
    fail.push('PostRoom reads `from` before `__from` (or instead of it) — the caller’s claim must never win');
  }
}

// ── 7. ⭐ A MAILBOX OPENS FOR ITS OWNER (22 Sep 2026) ────────────────────────────────────
// Reading, marking, reporting, letting in and turning away were addressed by slug alone — and a slug is the
// sign on the fence, which the address book publishes — so anybody could read anybody's letters. Every path
// but a send must now prove that the caller's own house IS the box. Plain substring checks: a regex written
// through a patch script has crashed this gate before.
{
  const route = src.slice(src.indexOf("url.pathname === '/post'"), src.indexOf('export class PostRoom'));
  const ownerLine = "if (path !== '/send' && (!sender || sender !== to)) return new Response('{\"error\":\"whose\"}', { status: 401";
  if (!route.includes(ownerLine)) {
    fail.push('a mailbox path other than /send does not demand that the caller owns the box — anybody could read anybody’s letters again');
  }
  const boxPart = room2.slice(room2.indexOf("url.pathname === '/box'"), room2.indexOf("url.pathname === '/read'"));
  if (!boxPart.includes("? { id: x.id, from: x.from, at: x.at, kind: 'knock', read: false, name: x.name || '', house: x.house || '' }")) {
    fail.push('a knock in /box is not reduced to who and when — the page could be handed words the reader has not let in');
  }
}

if (fail.length) {
  console.error('❌ the post rail:\n' + fail.map((f) => '   · ' + f).join('\n'));
  process.exit(1);
}
console.log('✅ post rail: 6 public paths, every mailbox path owner-only, a knock carries no words, the review queue behind POST_ADMIN_KEY, the kill switch'
  + ' first,\n   and a postcard that outlives a letters shutdown');
