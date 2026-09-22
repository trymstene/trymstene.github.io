// ✉️ THE POST ROOM — the rail that carries one player's words to another, and the only thing standing
// in front of it (20 Sep 2026, docs/town-jobs-plan.md §6).
//
// ⚠️ Trym's call: ANYONE MAY WRITE TO ANYONE — and since 22 Sep 2026 a house the reader has never had post
// from KNOCKS: the reader sees who, never what, until they let it in. Everything below is about that: what
// gets through, what knocks, what does not, what a refusal is allowed to say, where a reported letter
// goes — and the residents who write about what the reader did.
globalThis.WebSocketRequestResponsePair = class { constructor(a, b) { this.a = a; this.b = b; } };
const { PostRoom } = await import('../src/index.js');
const { CAPS } = await import('../../src/lib/letter-gate.js');

function fakeState() {
  const m = new Map();
  return {
    storage: {
      async get(k) { return m.has(k) ? structuredClone(m.get(k)) : undefined; },
      async put(k, v) { m.set(k, structuredClone(v)); },
      async delete(k) { m.delete(k); },
      async list(opts = {}) { const p = opts.prefix || ''; return new Map([...m.entries()].filter(([k]) => k.startsWith(p)).map(([k, v]) => [k, structuredClone(v)])); },
    },
    _m: m, getWebSockets: () => [], setWebSocketAutoResponse() {}, acceptWebSocket() {},
  };
}

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name, extra === undefined ? '' : JSON.stringify(extra)); }
};
const post = (room, path, body) => room.fetch(new Request('https://room' + path, { method: 'POST', body: JSON.stringify(body || {}) }));
const get = (room, path) => room.fetch(new Request('https://room' + path));
const jsonOf = async (res) => { try { return JSON.parse(await res.text()); } catch (e) { return {}; } };
// ✉️ writing to a house lets it in: the router tells the WRITER's room with /sent
const knowing = async (room, ...houses) => { for (const h of houses) await post(room, '/sent', { to: h, kind: 'letter' }); };

console.log('\n✉️  the post room');

// ── a letter that should arrive ──────────────────────────────────────────────────────────────────
{
  const room = new PostRoom(fakeState(), {});
  await knowing(room, 'ada');
  const res = await post(room, '/send', { from: 'ada', text: 'Your sunflowers are enormous. Well done.' });
  const body = await jsonOf(res);
  ok('an ordinary letter from a house the box knows is delivered', res.status === 200 && body.ok, body);

  const box = await jsonOf(await get(room, '/box'));
  ok('and it is in the box', box.letters.length === 1 && box.letters[0].from === 'ada' && box.letters[0].kind !== 'knock', box);
  ok('unread', box.unread === 1, box);

  await post(room, '/read', { id: box.letters[0].id });
  const after = await jsonOf(await get(room, '/box'));
  ok('reading it marks it read, and does not delete it', after.letters.length === 1 && after.unread === 0, after);
}

// ── 🚪 THE KNOCK: a house the box has never had post from ─────────────────────────────────────────
{
  const room = new PostRoom(fakeState(), {});
  const res = await post(room, '/send', { from: 'kit', text: 'Hello from the next plot over.', __name: 'Kit', __house: 'Kit’s Farm' });
  ok('a stranger’s letter is taken — the sender is told it went', res.status === 200 && (await jsonOf(res)).ok);
  let box = await jsonOf(await get(room, '/box'));
  const k = box.letters[0] || {};
  ok('⭐ it waits at the door as a knock', box.letters.length === 1 && k.kind === 'knock' && box.knocks === 1, box);
  ok('⭐ a knock carries who and never what', !('text' in k) && !('card' in k) && k.name === 'Kit' && k.house === 'Kit’s Farm', k);
  ok('a knock is not unread post', box.unread === 0, box);
  ok('a knock cannot be read', (await post(room, '/read', { id: k.id })).status === 409);
  ok('…nor reported, since nothing on it was shown', (await post(room, '/report', { id: k.id })).status === 409);
  await post(room, '/send', { from: 'kit', text: 'And a second one, before you answered.' });
  box = await jsonOf(await get(room, '/box'));
  ok('a second letter from the same house knocks too', box.knocks === 2 && box.letters.every((l) => l.kind === 'knock'), box);

  const acc = await jsonOf(await post(room, '/accept', { id: k.id }));
  ok('letting the house in answers ok and lets in both', acc.ok && acc.n === 2, acc);
  box = await jsonOf(await get(room, '/box'));
  ok('⭐ now they are letters, words and all', box.knocks === 0 && box.unread === 2 && box.letters.every((l) => l.kind !== 'knock' && l.text), box);
  await post(room, '/send', { from: 'kit', text: 'A third, after you let me in.' });
  box = await jsonOf(await get(room, '/box'));
  ok('and what the house sends after comes straight in', box.knocks === 0 && box.unread === 3, box);
}
{
  const room = new PostRoom(fakeState(), {});
  await post(room, '/send', { from: 'mal', text: 'a first letter nobody wanted' });
  let box = await jsonOf(await get(room, '/box'));
  const away = await jsonOf(await post(room, '/away', { id: box.letters[0].id }));
  ok('turning a house away answers ok', away.ok, away);
  box = await jsonOf(await get(room, '/box'));
  ok('the knock is gone', box.letters.length === 0, box);
  const res = await post(room, '/send', { from: 'mal', text: 'and another one' });
  ok('⭐ a turned-away house is told what everybody is told — it went', res.status === 200 && (await jsonOf(res)).ok);
  box = await jsonOf(await get(room, '/box'));
  ok('…and nothing lands', box.letters.length === 0, box);
  await knowing(room, 'mal');
  await post(room, '/send', { from: 'mal', text: 'you wrote to me, so here I am' });
  box = await jsonOf(await get(room, '/box'));
  ok('writing to a house you turned away lets it back in', box.letters.length === 1 && box.letters[0].kind !== 'knock', box);
}
{
  const room = new PostRoom(fakeState(), {});
  for (let i = 0; i < 16; i++) await post(room, '/send', { from: 'q' + i, text: 'knock knock number ' + i + ' here' });
  const box = await jsonOf(await get(room, '/box'));
  ok('a door is not a queue: twelve knocks at most, the newest kept', box.knocks === 12 && !box.letters.some((l) => l.from === 'q0'), box.knocks);
}

// ── what must never arrive, and what a refusal is allowed to say ─────────────────────────────────
{
  const room = new PostRoom(fakeState(), {});
  const cases = [
    ['a web address', 'come see trymstene.com'],
    ['an email', 'write to me at bob at gmail dot com'],
    ['a phone number', 'ring me on 555 123 4567'],
    ['a handle', 'im @bobtheduck over there'],
    ['an invitation elsewhere', 'add me on discord bobduck#1234'],
    ['language the family filter refuses', 'you are a total bitch'],
    ['an empty letter', '   '],
  ];
  for (const [what, text] of cases) {
    const res = await post(room, '/send', { from: 'mal', text });
    const body = await jsonOf(res);
    ok('refuses ' + what, res.status === 422 && body.error === 'refused', { status: res.status, body });
    // ⭐ AND SAYS NOTHING ABOUT WHY (Trym, 20 Sep). A precise reason is a tutorial for the next attempt.
    ok('  …without saying which rule it hit', !('why' in body) && !('reason' in body), body);
  }
  const box = await jsonOf(await get(room, '/box'));
  ok('none of them reached the box', box.letters.length === 0, box);
  // the reason IS kept, for our own logs — it just never goes back down the wire
  const kept = [...room.state._m.keys()].filter((k) => k.startsWith('refused:'));
  ok('the reasons are kept on our side', kept.length === cases.length, kept.length);
}

// ── a platform named with no way to reach anybody: delivered, and flagged ────────────────────────
{
  const room = new PostRoom(fakeState(), {});
  const res = await post(room, '/send', { from: 'ada', text: 'my friend plays roblox too' });
  ok('a bare platform word is delivered, not refused', res.status === 200, await jsonOf(res));
  const review = await jsonOf(await get(room, '/review'));
  ok('…but it is flagged for review', review.flagged.length === 1 && review.flagged[0].flag === 'platform', review);
}

// ── the cap: one person cannot bury one mailbox ──────────────────────────────────────────────────
{
  const room = new PostRoom(fakeState(), {});
  await knowing(room, 'mal', 'ada');
  let refused = 0;
  for (let i = 0; i < CAPS.sendTo + 3; i++) {
    const res = await post(room, '/send', { from: 'mal', text: 'letter number ' + i + ' for you' });
    if (res.status === 429) refused++;
  }
  const box = await jsonOf(await get(room, '/box'));
  ok('one sender gets exactly the cap into one box', box.letters.length === CAPS.sendTo, box.letters.length);
  ok('and the rest are refused', refused === 3, refused);
  // ⚠️ the cap is per SENDER, so a second person is not punished for the first one's flood
  const res2 = await post(room, '/send', { from: 'ada', text: 'hello from somebody else entirely' });
  ok('a different sender still gets through', res2.status === 200, await jsonOf(res2));
}

// ── a report: gone from the box on the tap, kept whole for review ────────────────────────────────
{
  const room = new PostRoom(fakeState(), {});
  await knowing(room, 'mal');
  await post(room, '/send', { from: 'mal', text: 'a letter somebody will report' });
  const box = await jsonOf(await get(room, '/box'));
  const id = box.letters[0].id;
  const res = await post(room, '/report', { id, by: 'ada' });
  ok('the report is taken', res.status === 200, await jsonOf(res));

  const after = await jsonOf(await get(room, '/box'));
  // ⭐ "HELD FOR REVIEW" MEANS HELD FOR TRYM, NOT LEFT IN FRONT OF THE READER. Nobody has to sit
  // looking at something they have just reported while they wait for one person with a phone.
  ok('it is gone from the reader’s box on the tap', after.letters.length === 0, after);
  const review = await jsonOf(await get(room, '/review'));
  ok('and kept whole in the review list, with who reported it', review.reported.length === 1 && review.reported[0].by === 'ada' && review.reported[0].text.includes('report'), review);
}

// ── an unread letter expires quietly ─────────────────────────────────────────────────────────────
{
  const st = fakeState();
  const room = new PostRoom(st, {});
  await post(room, '/send', { from: 'ada', text: 'a letter from a long time ago' });
  const key = [...st._m.keys()].find((k) => k.startsWith('L:'));
  const old = st._m.get(key);
  old.at = Date.now() - (CAPS.keepDays + 1) * 86400000;
  st._m.set(key, old);
  const box = await jsonOf(await get(room, '/box'));
  ok('past its keep, a letter is simply not there any more', box.letters.length === 0, box);
  ok('and it is gone from storage too, not just hidden', ![...st._m.keys()].some((k) => k.startsWith('L:')), [...st._m.keys()]);
}

// ── the box has a ceiling, and it drops what has been read first ─────────────────────────────────
{
  const st = fakeState();
  const room = new PostRoom(st, {});
  // fill past the ceiling from many senders, so the per-sender cap is not what is being measured — and
  // senders the box knows, so the knock cap is not either
  for (let i = 0; i < CAPS.boxMax + 5; i++) await post(room, '/sent', { to: 'p' + i });
  for (let i = 0; i < CAPS.boxMax + 5; i++) {
    await post(room, '/send', { from: 'p' + i, text: 'letter ' + i + ' saying hello to you' });
  }
  const box = await jsonOf(await get(room, '/box'));
  ok('the box never grows past its ceiling', box.letters.length === CAPS.boxMax, box.letters.length);
}

// ── ⭐ THE RESIDENTS WRITE ABOUT WHAT THE READER DID (22 Sep 2026) ─────────────────────────────────────
{
  // a yard room and a town room that answer the post room's two questions, and nothing else
  let stage = 1, fixes = { d: '', n: 0 };
  const stub = (answer) => ({ idFromName: () => 'x', get: () => ({ fetch: async (req) => new Response(JSON.stringify(answer(new URL(req.url))), { status: 200 }) }) });
  const env = {
    YARDS: stub((u) => (u.pathname === '/card' ? { stage, owner8: 'abcd1234' } : { slug: 'ada' })),
    TOWN: stub(() => fixes),
  };
  const st = fakeState();
  const room = new PostRoom(st, env);
  const notes = async () => (await jsonOf(await get(room, '/box?slug=ada'))).letters.filter((l) => l.kind === 'note');
  let n = await notes();
  ok('a new box gets the welcome first', n.length === 1 && n[0].note === 'welcome', n);
  // ✉️ the first post out — the sender's own room hears it went
  await knowing(room, 'bob');
  n = await notes();
  ok('⭐ a resident notices your first post going out', n.some((l) => l.note === 'first') && n.find((l) => l.note === 'first').text.length > 20, n.map((l) => l.note));
  await knowing(room, 'cy');
  n = await notes();
  ok('…once', n.filter((l) => l.note === 'first').length === 1, n.map((l) => l.note));
  // 🏡 a cabin goes up (the first look at the yard was the baseline, stage 1)
  const tick = () => { const s = st._m.get('notes'); s.factAt = 0; st._m.set('notes', s); };
  stage = 2; tick();
  n = await notes();
  ok('⭐ a cabin going up is written about', n.some((l) => l.note === 'cabin'), n.map((l) => l.note));
  stage = 3; tick();
  n = await notes();
  ok('…and then a house', n.some((l) => l.note === 'house'), n.map((l) => l.note));
  tick();
  n = await notes();
  ok('…and neither twice', n.filter((l) => l.note === 'house').length === 1 && n.filter((l) => l.note === 'cabin').length === 1, n.map((l) => l.note));
  // 🔧 the square put right today
  fixes = { d: Math.floor(Date.now() / 86400000), n: 4 }; tick();
  n = await notes();
  ok('⭐ putting the square right is written about', n.some((l) => l.note === 'fixed'), n.map((l) => l.note));
  tick();
  n = await notes();
  ok('…once for the day', n.filter((l) => l.note === 'fixed').length === 1, n.map((l) => l.note));
  // 🌑 a curse night is a pure function of time: find one that ended, and the morning after writes
  let curseAt = 0;
  for (let d = 0; d < 400 && !curseAt; d++) {
    const t = Date.UTC(2026, 8, 1) + d * 86400000 + 23.9 * 3600000;
    if ((await room.factNote(t, 'ada', { welcome: 1, factAt: t })) === 'curse') curseAt = t;
  }
  ok('⭐ the morning after a Curse Night is a letter', curseAt > 0, curseAt);
  const s2 = { welcome: 1, factAt: curseAt };
  await room.factNote(curseAt, 'ada', s2);
  ok('…and the same night is not written twice', (await room.factNote(curseAt + 3600000, 'ada', { ...s2, factAt: curseAt + 3600000 })) !== 'curse');
  // an old box never gets a "first post" letter: its first post happened before anybody was counting
  const old = new PostRoom(fakeState(), env);
  await old.state.storage.put('notes', { welcome: Date.now() - 864e5 * 9, quiet: Date.now() });
  await knowing(old, 'bob');
  const on = (await jsonOf(await get(old, '/box?slug=ada'))).letters.filter((l) => l.kind === 'note');
  ok('an older box is never told its first post went', !on.some((l) => l.note === 'first'), on.map((l) => l.note));
}

console.log('\n' + pass + ' pass, ' + fail + ' fail\n');
process.exit(fail ? 1 : 0);
