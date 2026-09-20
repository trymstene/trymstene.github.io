// ✉️ THE POST ROOM — the rail that carries one player's words to another, and the only thing standing
// in front of it (20 Sep 2026, docs/town-jobs-plan.md §6).
//
// ⚠️ Trym's call: ANYONE MAY WRITE TO ANYONE. There is no accept-a-house step, so the filter, the caps
// and the report ARE the defence rather than a second line behind a consent gate. Everything below is
// about that: what gets through, what does not, what a refusal is allowed to say, and where a reported
// letter goes. Gate one of the plan — "POST_OFF deployed and proven to refuse" — is the first block.
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

console.log('\n✉️  the post room');

// ── a letter that should arrive ──────────────────────────────────────────────────────────────────
{
  const room = new PostRoom(fakeState(), {});
  const res = await post(room, '/send', { from: 'ada', text: 'Your sunflowers are enormous. Well done.' });
  const body = await jsonOf(res);
  ok('an ordinary letter is delivered', res.status === 200 && body.ok, body);

  const box = await jsonOf(await get(room, '/box'));
  ok('and it is in the box', box.letters.length === 1 && box.letters[0].from === 'ada', box);
  ok('unread', box.unread === 1, box);

  await post(room, '/read', { id: box.letters[0].id });
  const after = await jsonOf(await get(room, '/box'));
  ok('reading it marks it read, and does not delete it', after.letters.length === 1 && after.unread === 0, after);
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
  // fill past the ceiling from many senders, so the per-sender cap is not what is being measured
  for (let i = 0; i < CAPS.boxMax + 5; i++) {
    await post(room, '/send', { from: 'p' + i, text: 'letter ' + i + ' saying hello to you' });
  }
  const box = await jsonOf(await get(room, '/box'));
  ok('the box never grows past its ceiling', box.letters.length === CAPS.boxMax, box.letters.length);
}

console.log('\n' + pass + ' pass, ' + fail + ' fail\n');
process.exit(fail ? 1 : 0);
