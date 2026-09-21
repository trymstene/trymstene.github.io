// 📇🔬 THE ADDRESS BOOK, PROVEN ON A REAL WORKER.
//
// The post office shipped REPLY-ONLY — Write back hangs off a letter you already have, and nothing
// in this world ever wrote the first one. This is the walk for the thing that fixed it: a yard says
// who lives there, the book lists them, the book LEAVES OUT the people it is supposed to, and a
// letter addressed out of the book actually lands.
//
// Run it against a local worker (nothing here should ever be written to production):
//   cd worker-rave && npx wrangler dev --port 8788 --local --var POST_OFF:0
//   RAVE_API=http://127.0.0.1:8788 node tools/folk-proof.mjs
//
// ⚠️ THE LAST TWO CHECKS NEED THE LETTER RAIL OPEN. POST_OFF is the first line in the /post route
// and it ships SHUT, so without --var POST_OFF:0 they answer 503 — which is the switch working, not
// a fault in the walk.
import { createHmac, randomBytes } from 'node:crypto';

const API = process.env.RAVE_API || 'http://127.0.0.1:8799';
// 🪪 A REAL WORLD TOKEN, minted the way worker-rave signs one — because a letter's sender is now
// resolved from the PROOF and never from the body, so a walk that cannot prove who it is cannot send
// a letter either. The worker needs the matching secret:
//   npx wrangler dev --local --var POST_OFF:0 --var MEMBER_HMAC:proof-secret
const HMAC = process.env.MEMBER_HMAC || 'proof-secret';
const gid = () => randomBytes(8).toString('hex');
const tokenFor = (id) => {
  // ⚠️ FOUR fields: gid.expiry.aliases.signature — and the aliases field is EMPTY, not absent, so
  // the dot before the signature is load-bearing. Three fields do not match the worker's regex at all.
  const base = id + '.' + (Date.now() + 3600000) + '.';
  return base + '.' + createHmac('sha256', HMAC).update('wt:' + base).digest('hex');
};
const O = { Origin: 'https://trymstene.com', 'Content-Type': 'application/json' };
const out = []; let bad = 0;
const ok = (yes, what, saw) => { out.push([yes, what, saw]); if (!yes) bad++; };

const yard = async (path, body) => {
  const r = await fetch(API + '/yards' + path, {
    method: body ? 'POST' : 'GET', headers: O,
    body: body ? JSON.stringify(body) : undefined,
  });
  let j = null; try { j = JSON.parse(await r.text() || 'null'); } catch (e) {}
  return { status: r.status, j };
};

// three neighbours: one full citizen, one with no name yet, and one who is me
const who = (n) => ({ n, fit: { hat: 'tophat', glasses: 'shades', extras: { bowtie: true } } });
const people = [
  { pass: gid(), house: 'Ada Orchard', name: 'Ada' },
  { pass: gid(), house: 'Bo Bottom', name: 'Bo' },
  { pass: gid(), house: 'Quiet Acre', name: '' },
];
for (const p of people) p.wt = tokenFor(p.pass);

for (const p of people) {
  const c = await yard('/claim', { pass: p.pass, alt: p.pass, wt: p.wt, name: p.house });
  p.slug = c.j && c.j.slug;
  ok(!!p.slug, 'claimed a homestead for ' + p.house, c.status + ' ' + JSON.stringify(c.j));
  const s = await yard('/save', {
    pass: p.pass, alt: p.pass, wt: p.wt, name: p.house,
    state: { stage: 1, items: [], soil: [] },
    ...(p.name ? { who: who(p.name) } : {}),
  });
  ok(s.status === 200, '…and saved it' + (p.name ? ' with who lives there' : ' with nobody named'), s.status);
}

// ── 👋 I AM HERE: the half /save cannot give, because a yard only publishes when it CHANGES ──
// somebody who opens their homestead, looks at the chickens and leaves must still reach the book
const lurker = { pass: gid(), house: 'Quiet Gate', name: 'Lurk' };
lurker.wt = tokenFor(lurker.pass);
{
  const c = await yard('/claim', { pass: lurker.pass, alt: lurker.pass, wt: lurker.wt, name: lurker.house });
  lurker.slug = c.j && c.j.slug;
  ok(!!lurker.slug, 'a homestead claimed and then never saved again', c.status);
  const before = ((await yard('/folk')).j || {}).folk || [];
  ok(!before.some((f) => f.slug === lurker.slug), '…is not in the book yet', 'it is');
  const w = await yard('/who', { pass: lurker.pass, alt: lurker.pass, wt: lurker.wt, who: who(lurker.name) });
  ok(w.status === 200, 'and one line says who lives there', w.status + ' ' + JSON.stringify(w.j));
  const after = ((await yard('/folk')).j || {}).folk || [];
  ok(after.some((f) => f.slug === lurker.slug), '…which is all it takes to be in it', 'still missing');
}
{
  const bare = await yard('/who', { pass: lurker.pass, alt: lurker.pass, wt: lurker.wt, who: { n: '' } });
  ok(bare.status === 400, 'a nameless hello is refused rather than filed', bare.status);
}

// ── the book ────────────────────────────────────────────────────────────────────────────────
const all = await yard('/folk');
const folk = (all.j || {}).folk || [];
const by = (slug) => folk.find((f) => f.slug === slug);
ok(all.status === 200, 'the book answers', all.status);
ok(!!by(people[0].slug), 'a player with a pass, a house and a name is in it', 'missing');
ok(!!by(people[1].slug), '…and so is the second', 'missing');
// ⭐ THE BAR IS TRYM'S: a Pass and a Homestead. A yard nobody has put a name to is not a person yet.
ok(!by(people[2].slug), 'a homestead with nobody named is NOT in the book', 'it is listed');

const ada = by(people[0].slug) || {};
ok(ada.n === 'Ada', 'the row carries the player’s own name', ada.n);
ok(ada.house === 'Ada Orchard', '…and the name of their house', ada.house);
ok(!!(ada.fit && ada.fit.hat === 'tophat' && ada.fit.glasses === 'shades'), '…and the banana they wear', JSON.stringify(ada.fit));
ok(!!(ada.fit && ada.fit.extras && ada.fit.extras.bowtie), '…down to what is in their hands', JSON.stringify(ada.fit));
ok(ada.pass === undefined && ada.owner === undefined, 'and nothing that identifies the ACCOUNT leaves the room', JSON.stringify(Object.keys(ada)));

// ── you are never in your own address book ──────────────────────────────────────────────────
const mine = await yard('/folk?mine=' + encodeURIComponent(people[0].slug));
ok(!((mine.j || {}).folk || []).some((f) => f.slug === people[0].slug), 'you are not in your own book', 'you are');

// ── the search ──────────────────────────────────────────────────────────────────────────────
for (const [q, want, what] of [['ada', people[0].slug, 'by their name'],
  ['bottom', people[1].slug, 'by the name of their house'],
  ['ADA', people[0].slug, 'and it does not care about case']]) {
  const r = await yard('/folk?q=' + encodeURIComponent(q));
  const rows = (r.j || {}).folk || [];
  ok(rows.some((f) => f.slug === want), 'found ' + what + ' ("' + q + '")', rows.length + ' rows');
}
const none = await yard('/folk?q=zzzznobody');
ok((((none.j || {}).folk) || []).length === 0, 'a search for nobody finds nobody', 'found some');

// ── and a letter to an address out of the book actually lands ───────────────────────────────
const send = await fetch(API + '/post/send', { method: 'POST', headers: O,
  body: JSON.stringify({ to: people[0].slug, wt: people[1].wt, text: 'The sunflowers came up crooked this year.' }) });
ok(send.status === 200, 'a first letter to a house found in the book is delivered', send.status);
const box = await fetch(API + '/post/box?slug=' + people[0].slug, { headers: O });
const bj = await box.json().catch(() => ({}));
ok(((bj.letters) || []).some((l) => l.from === people[1].slug), '…and it is in their mailbox', JSON.stringify(bj).slice(0, 80));

// ── 🛡 A LETTER COMES FROM SOMEBODY WHO PROVED IT ────────────────────────────────────
// `from` was read off the request body and never checked, so anybody could drop a letter into
// anybody's mailbox signed with any house's name. The address book made every house findable, which
// is what turned that from theoretical into usable.
{
  const forged = await fetch(API + '/post/send', { method: 'POST', headers: O,
    body: JSON.stringify({ to: people[0].slug, from: people[1].slug, text: 'I am definitely your neighbour.' }) });
  ok(forged.status === 401, 'a letter signed with somebody else’s house is refused', forged.status);

  const nowt = await fetch(API + '/post/send', { method: 'POST', headers: O,
    body: JSON.stringify({ to: people[0].slug, text: 'From nobody at all.' }) });
  ok(nowt.status === 401, '…and so is one with no proof on it', nowt.status);

  const junk = await fetch(API + '/post/send', { method: 'POST', headers: O,
    body: JSON.stringify({ to: people[0].slug, wt: 'deadbeef.9999999999999.".64hex"', text: 'Hello.' }) });
  ok(junk.status === 401, '…and a made-up proof proves nothing', junk.status);

  const box2 = await fetch(API + '/post/box?slug=' + people[0].slug, { headers: O });
  const bj2 = await box2.json().catch(() => ({}));
  ok(!((bj2.letters) || []).some((l) => /definitely your neighbour|nobody at all/.test(l.text || '')),
    '…and none of the three is in the mailbox', 'one got in');
}

// ── ✉️ NOBODY'S FIRST MAILBOX IS EMPTY ──────────────────────────────────────────
// The plan calls this the load-bearing beam: at ten players most boxes are empty most of the time,
// and an empty mailbox is where a social feature quietly dies.
{
  // ⚠️ A REAL HOUSE, because a welcome only goes to one. Reading an empty box CREATES the room, so
  // before that check a note landed in any slug anybody typed — four resident names became four
  // mailboxes when a diagnostic merely looked at them.
  const fp = gid(), fwt = tokenFor(fp);
  const fc = await yard('/claim', { pass: fp, alt: fp, wt: fwt, name: 'First Light' });
  const fresh = (fc.j && fc.j.slug) || '';
  ok(!!fresh, 'a brand-new homestead is claimed', fc.status);
  const r = await fetch(API + '/post/box?slug=' + fresh, { headers: O });
  const j = await r.json().catch(() => ({}));
  const ls = j.letters || [];
  ok(ls.length === 1, 'a mailbox nobody has ever written to has a letter in it', ls.length + ' letters');
  const n = ls[0] || {};
  ok(n.kind === 'note', '…and it is a note from the town', n.kind);
  ok(!!n.name && /^[A-Z]/.test(n.name), '…signed with a NAME, not a lower-case id', JSON.stringify(n.name));
  ok(!!String(n.text || '').trim(), '…with something actually written on it', JSON.stringify(n.text));
  ok(!/\d/.test(String(n.text || '')), '…and the world still publishes no numbers', n.text);

  // …and a box with no house behind it stays empty, which is the truth about it
  const nowhere = await (await fetch(API + '/post/box?slug=qa-no-such-house-' + Math.random().toString(36).slice(2, 7), { headers: O })).json();
  ok(((nowhere.letters) || []).length === 0, 'a mailbox with no house behind it is not written to', ((nowhere.letters) || []).length);

  // ⚠️ ONCE. A welcome that lands on every open is a mailbox that fills itself with itself.
  await fetch(API + '/post/box?slug=' + fresh, { headers: O });
  const again = await (await fetch(API + '/post/box?slug=' + fresh, { headers: O })).json();
  ok(((again.letters) || []).length === 1, '…and opening the box again does not write another', ((again.letters) || []).length);

  // ⭐ and two different people do not get the same resident every time
  const whos = new Set();
  for (let i = 0; i < 8; i++) {
    const p = gid();
    const c = await yard('/claim', { pass: p, alt: p, wt: tokenFor(p), name: 'Who House ' + i });
    const sl = (c.j && c.j.slug) || '';
    if (!sl) continue;
    const b = await (await fetch(API + '/post/box?slug=' + sl, { headers: O })).json();
    const l = ((b.letters) || [])[0]; if (l) whos.add(l.from);
  }
  ok(whos.size > 1, 'and the same resident does not write to everybody', [...whos].join(', '));
}

for (const [yes, what, saw] of out) console.log((yes ? '  ✓ ' : '  ✗ ') + what + (yes ? '' : '   — saw ' + saw));
if (bad) { console.error('\n✗ ' + bad + ' of ' + out.length + ' did not hold'); process.exit(1); }
console.log('\n✅ the address book holds: ' + out.length + ' checks — the bar, the search, what leaves the room,\n   and a first letter that lands');
