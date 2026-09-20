// ✉️🔒 THE PUBLIC POST RAIL REACHES FOUR PATHS, AND THE REVIEW QUEUE IS NOT ONE OF THEM.
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
  const want = ['/box', '/read', '/report', '/send'];
  if (allowed.join(',') !== want.join(',')) {
    fail.push(`the rail allows ${allowed.join(', ')} — it must allow exactly ${want.join(', ')}`);
  }
}

// ── 2. every path the room answers is either on that list or admin-only ─────────────────────────
// ⚠️ THE POINT OF THIS ONE. The list above cannot rot on its own; what rots is somebody adding a path
// to PostRoom and nobody thinking about the rail. Each new one has to be named here deliberately.
const room = src.slice(src.indexOf('export class PostRoom'));
const paths = [...room.matchAll(/url\.pathname === '([^']+)'/g)].map((x) => x[1]);
const PUBLIC = ['/send', '/box', '/read', '/report'];
const ADMIN = ['/review', '/queue', '/queue-put', '/queue-drop'];   // reached by the router alone, never by an origin
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

if (fail.length) {
  console.error('❌ the post rail:\n' + fail.map((f) => '   · ' + f).join('\n'));
  process.exit(1);
}
console.log('✅ post rail: 4 public paths, the review queue behind POST_ADMIN_KEY, the kill switch'
  + ' first,\n   and a postcard that outlives a letters shutdown');
