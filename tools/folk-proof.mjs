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
const API = process.env.RAVE_API || 'http://127.0.0.1:8799';
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
  { pass: 'proof-ada-' + Date.now(), house: 'Ada Orchard', name: 'Ada' },
  { pass: 'proof-bo-' + Date.now(), house: 'Bo Bottom', name: 'Bo' },
  { pass: 'proof-nameless-' + Date.now(), house: 'Quiet Acre', name: '' },
];

for (const p of people) {
  const c = await yard('/claim', { pass: p.pass, alt: p.pass, name: p.house });
  p.slug = c.j && c.j.slug;
  ok(!!p.slug, 'claimed a homestead for ' + p.house, c.status + ' ' + JSON.stringify(c.j));
  const s = await yard('/save', {
    pass: p.pass, alt: p.pass, name: p.house,
    state: { stage: 1, items: [], soil: [] },
    ...(p.name ? { who: who(p.name) } : {}),
  });
  ok(s.status === 200, '…and saved it' + (p.name ? ' with who lives there' : ' with nobody named'), s.status);
}

// ── 👋 I AM HERE: the half /save cannot give, because a yard only publishes when it CHANGES ──
// somebody who opens their homestead, looks at the chickens and leaves must still reach the book
const lurker = { pass: 'proof-lurk-' + Date.now(), house: 'Quiet Gate', name: 'Lurk' };
{
  const c = await yard('/claim', { pass: lurker.pass, alt: lurker.pass, name: lurker.house });
  lurker.slug = c.j && c.j.slug;
  ok(!!lurker.slug, 'a homestead claimed and then never saved again', c.status);
  const before = ((await yard('/folk')).j || {}).folk || [];
  ok(!before.some((f) => f.slug === lurker.slug), '…is not in the book yet', 'it is');
  const w = await yard('/who', { pass: lurker.pass, alt: lurker.pass, who: who(lurker.name) });
  ok(w.status === 200, 'and one line says who lives there', w.status + ' ' + JSON.stringify(w.j));
  const after = ((await yard('/folk')).j || {}).folk || [];
  ok(after.some((f) => f.slug === lurker.slug), '…which is all it takes to be in it', 'still missing');
}
{
  const bare = await yard('/who', { pass: lurker.pass, alt: lurker.pass, who: { n: '' } });
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
  body: JSON.stringify({ to: people[0].slug, from: people[1].slug, text: 'The sunflowers came up crooked this year.' }) });
ok(send.status === 200, 'a first letter to a house found in the book is delivered', send.status);
const box = await fetch(API + '/post/box?slug=' + people[0].slug, { headers: O });
const bj = await box.json().catch(() => ({}));
ok(((bj.letters) || []).some((l) => l.from === people[1].slug), '…and it is in their mailbox', JSON.stringify(bj).slice(0, 80));

for (const [yes, what, saw] of out) console.log((yes ? '  ✓ ' : '  ✗ ') + what + (yes ? '' : '   — saw ' + saw));
if (bad) { console.error('\n✗ ' + bad + ' of ' + out.length + ' did not hold'); process.exit(1); }
console.log('\n✅ the address book holds: ' + out.length + ' checks — the bar, the search, what leaves the room,\n   and a first letter that lands');
