// ✉️ THE POST OFFICE'S MAILBOX — your letters, and writing back (20 Sep 2026, docs/town-jobs-plan.md §6).
//
// ⭐ THIS IS THE FIRST SURFACE IN BANANA WORLD WHERE ONE PLAYER'S WORDS REACH ANOTHER, and Trym's three
// calls shape all of it: anyone may write to anyone, a refusal never says which rule it hit, and a
// reported letter leaves the reader's box on the tap while being kept whole for review. Since 22 Sep 2026
// post from a house you have never had post from KNOCKS: you see who, never what, until you let them in.
//
// 📬 TWO DRAWERS (22 Sep 2026, Trym: "make sure it looks great visually in the mailbox when you have lots of
// letters so its not all in a long list, maybe a 'read' or 'archive' minitab for old letters, so you always
// see the fresh letters youve received from anyone, users and residents"). Fresh: the knocks, then every
// unopened thing as a tile. Kept: the postcards as pictures, then one row per person. The box always opens
// on Fresh, and at home the world's own notes (Nib's book, a payslip, a boss) are post in the same drawers.
//
// ⭐ AN UNREAD LETTER IS A SEALED ENVELOPE, AND OLD POST IS FILED BY WHO WROTE IT (Trym, 20 Sep: "it
// would be cool if the letter actually looked like a letter when you receive it and you have to tap it
// to open it, with some sort of animation … also letters need to be sorted well if a user receives and
// sends alot of letters, so you dont have to scroll forever through old stuff"). So the mailbox has two
// halves: the new post, as envelopes you open, and everything else as ONE ROW PER PERSON. Sixty letters
// from eight people is eight rows, and each row is a conversation rather than a pile.
//
// ⚠️ THE SERVER DECIDES EVERYTHING. Nothing here filters, caps or judges — `src/lib/letter-gate.js` runs
// in the PostRoom and this card only shows what came back. A filter in the page is a suggestion: the
// request can be made by hand. The one thing the page does with the gate is spare somebody a round trip
// on a letter that is obviously not going, and even then the server's answer is the one that counts.
//
// ⚠️ A TEXTAREA, NOT A CONTENTEDITABLE. The plan names the caret inside a tilted, torn, clipped sheet as
// the risk no test can discharge, and a contenteditable is where that risk lives: iOS puts the caret
// where it likes inside a transformed box, and selection handles land outside it. A real <textarea>
// dressed as paper keeps the native caret, the native selection and the native keyboard, and the paper
// is the box AROUND it. Nothing a caret sits in is rotated.
import { checkLetter, LETTER, CARD } from '../lib/letter-gate.js';
import { drawComposite, assetsReady } from '../lib/banana-engine.js';
import { readWorn, drawable } from '../lib/wardrobe-slots.js';
// 🪪 the proof that a letter is really from your house — the rail resolves the sender from this
// and never from anything the page claims, so a send without it is refused.
import { worldToken, worldOwner, worldSid } from '../lib/world.js';
import { passFlush, ensureAnon } from '../lib/banana-pass.js';

const COPY_MODS = import.meta.glob('../data/copy/town-post.json', { eager: true, import: 'default' });
export const COPY = Object.values(COPY_MODS)[0] || {};

const API = 'https://banana-rave.trymstene.workers.dev/post';
// 📇 the address book lives on the YARD room, not the post room: it is built out of who has a
// homestead, which is the thing the yard room knows and the post room does not.
const FOLK_API = 'https://banana-rave.trymstene.workers.dev/yards/folk';
const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function bootTownPost(ctx) {
  // ✉️📮 TWO DOORS TO ONE MAILBOX (Trym, 21 Sep): "only letters in the mailbox at the homestead —
  // the post office in town can send post cards". Same letters, same address book, same paper; what
  // differs is WHERE YOU ARE STANDING, so that is what the module is told rather than a list of
  // flags that happen to correlate with it.
  //   'post' — the counter in town: postcards are made here, and the BUILDING has a line of its own
  //   'home' — your own mailbox: letters only, and no building to describe (you live here)
  const { openCard, card, closeCard, say, track, slug, at = 'post', staff, sort, local } = ctx;
  const cards = at === 'post';
  let box = null, open = null, writing = null, busy = false;
  let thread = null;      // whose letters we are looking through (a person's key), or null for the mailbox itself
  let drawer = '';        // 📬 'fresh' or 'kept' — '' means "open on fresh", which is where the mailbox always opens
  let opening = false;    // one pass of the envelope coming open, then it is just a letter
  // 📮 the postcard being made: who it is for, which of the three places, which line of the deck
  let making = null;
  // 📇 THE ADDRESS BOOK — the answer to the first letter (Trym, 21 Sep: "i must be able to actually
  // send a letter for the first time"). The rail shipped REPLY-ONLY: Write back hangs off a letter
  // you already have, and nothing in this world ever wrote the first one — so a new player's box
  // was a dead end, and no page anywhere even held another player's address.
  // null = shut · { q, rows, busy, asked } = open
  let folk = null;
  let folkT = 0;   // the search waits a beat for the typing to stop
  let raf = 0;            // the banana in the picture, drawn in its own loop while a card is on screen

  // ---- the rail ----------------------------------------------------------------------------------
  // ⚠️ EVERY CALL FAILS SOFT. The kill switch answers 503 by design and it ships ON, so "the counter is
  // closed" is the NORMAL path today, not an error — a card that showed a stack trace for the expected
  // state would be wrong on the day it shipped.
  // 🪪 A SEND NEEDS A PROOF, AND A PROOF GOES STALE. `world-wt` lasts 30 days and is refreshed
  // by a pass push — which happens constantly while somebody is playing, and not at all for
  // somebody who comes back after a month and walks straight to the post office. Without this
  // their letter would be refused by the rail and the card would show the MODERATION line: telling
  // a person their perfectly ordinary letter was rejected, which is the one lie this card must
  // never tell. So a missing proof is FETCHED rather than reported.
  // ⚠️ verified on the live site: a fresh visitor to the town already has 30 days on the clock, so
  // this path is for the returning player and nobody else — it costs nothing when the token is good.
  async function proof() {
    if (worldToken()) return true;
    // ⚠️ HOPELESS IS ANSWERED AT ONCE. With neither a link nor a world id there is nothing a push
    // could refresh, and waiting 3.4 s to learn that holds the card BUSY — so the Report tapped straight
    // after was ignored. This line was here, was lost in the best-effort rewrite, and the thumb walk
    // caught its absence the same way it caught it the first time.
    let known = false;
    try { known = !!(localStorage.getItem('pass-link') || localStorage.getItem('world-gid')); } catch (e) {}
    if (!known) return false;
    try { await ensureAnon(); } catch (e) {}
    if (worldToken()) return true;
    // ⚠️ passFlush, NEVER passPush. schedulePush debounces by SIXTY SECONDS, so the first version of
    // this waited 1.4s for something that could not possibly have happened yet and then told the
    // player their letter was staying in the writing tray. That is what Trym hit on his first real
    // send. passFlush pushes now, and the poll ends the moment the token lands.
    try { passFlush(); } catch (e) {}
    for (let i = 0; i < 24 && !worldToken(); i++) await new Promise((r) => setTimeout(r, 140));
    return !!worldToken();
  }

  // ⚠️ A REFUSAL AND A STRANGER ARE NOT THE SAME THING. Everything the server turns down says the
  // same deliberately uninformative line, because a precise reason is a lesson in getting round
  // the filter. But “the counter does not know who you are” is not a judgement on the letter, and
  // showing the refusal there tells somebody their ordinary words were rejected — the one lie this
  // card must never tell. (⚠️ this helper was deleted once by a patch that sliced from proof() to
  // ask() and took everything between; the thumb walk found the ReferenceError the same night.)
  const turnedDown = (res) => ((res && res.error === 'noproof') ? (COPY.nopass || COPY.refused || '') : (COPY.refused || ''));

  async function ask(path, body) {
    const me = slug ? slug() : '';
    // ✉️⚠️ NO ADDRESS IS NOT A CLOSED COUNTER. A mailbox is keyed to the homestead's sign name, so a
    // player who has never claimed a yard has nowhere for a letter to land — and this returned the kill
    // switch's own error, so the card told them the post office was shut. It is not; they have no door.
    if (!me) return { error: 'noaddress' };
    // ⚠️ THE SEND, AND NOTHING ELSE. This was every POST for a few minutes, which quietly broke
    // REPORTING — caught by the thumb walk. Reading, reporting and marking a letter read are things
    // you do to YOUR OWN box, addressed by a slug the router already has; only a send has to be
    // signed, because only a send puts your name on somebody else's screen. And the one path that
    // must never be blocked by a stale anything is the one that takes a bad letter away.
    //
    // ⭐ AND IT IS BEST-EFFORT, NEVER A GATE. This used to refuse the send itself when it could not
    // find a proof — so a bug in proof() was a bug that stopped letters, which is exactly what
    // happened. The SERVER decides; all this does is fetch a stale proof first so the server can say
    // yes. A 401 coming back is the only thing that means "it does not know who you are".
    // 🪪 ⭐ AND SINCE 22 SEP 2026 EVERY PATH PROVES WHO IS ASKING. A mailbox opens for its owner and for
    // nobody else — reading, marking, reporting and answering a knock were addressed by slug alone, and a
    // slug is the sign on the fence — so the proof is fetched first for all of them. Still best-effort
    // here: the server decides, and a stale proof is refreshed rather than reported.
    await proof();
    try {
      const res = await fetch(API + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // ⚠️ `from` is NOT sent any more, because it was never believed: the rail reads the world
        // token, asks the yard room which address it belongs to, and signs the letter with that.
        body: JSON.stringify({ ...(body || {}), slug: me, wt: worldToken(), pass: worldOwner(), alt: worldSid() }),
      });
      const j = await res.json().catch(() => ({}));
      return res.ok ? j : { error: res.status === 401 ? 'noproof' : (j.error || 'off'), status: res.status };
    } catch (e) { return { error: 'off' }; }
  }

  // ---- 📮 the picture -----------------------------------------------------------------------------
  //
  // ⭐ A CARD TRAVELS AS A RECIPE, NOT AN IMAGE (docs/town-jobs-plan.md §6). Three template ids, an
  // index into the approved deck, and what the sender's banana was wearing — a few hundred bytes
  // through a Durable Object instead of forty kilobytes, which is the whole reason this fits the
  // $0 model. Everything below is the receiver's own browser putting it back together.
  //
  // ⚠️ THE PICTURE IS A BACKGROUND, NOT A CANVAS. The template is an <img> and the banana is a canvas
  // on top of it: drawing the plate into the canvas would mean loading a 600×400 PNG through a
  // CanvasRenderingContext on every frame of the idle loop, for a picture that never changes.
  const CV = 150;
  const picture = (c, cls) => '<div class="tw-pc' + (cls ? ' ' + cls : '') + '">'
    + '<img class="tw-pc__bg" src="/assets/world/pc-' + esc(c.tpl) + '.png" alt="" draggable="false">'
    + '<canvas class="tw-pc__me" width="' + CV + '" height="' + CV + '" aria-hidden="true"></canvas>'
    + '<b class="tw-pc__place">' + esc(((COPY.card || {}).places || {})[c.tpl] || '') + '</b>'
    + '<p class="tw-pc__line">' + esc(((COPY.card || {}).lines || [])[c.line] || '') + '</p>'
    + '</div>';

  // ⚠️ drawComposite wants a WHOLE outfit or it throws on the first extra it looks for, and every
  // banana after it silently never draws. drawable() is that literal, in one place.
  function paintPictures(now) {
    raf = 0;
    const cvs = card.querySelectorAll('.tw-pc__me');
    if (!cvs.length) return;
    const f = Math.floor((now / 380) % 4);
    for (const cv of cvs) {
      if (cv.dataset.f === String(f)) continue;
      cv.dataset.f = String(f);
      let look = {};
      try { look = JSON.parse(cv.dataset.look || '{}'); } catch (e) { look = {}; }
      const g = cv.getContext('2d');
      g.clearRect(0, 0, CV, CV);
      try { drawComposite(g, CV, f, drawable(look)); } catch (e) {}
    }
    raf = requestAnimationFrame(paintPictures);
  }
  const wake = () => { if (!raf && card.querySelector('.tw-pc__me')) raf = requestAnimationFrame(paintPictures); };
  const sleep = () => { if (raf) { cancelAnimationFrame(raf); raf = 0; } };
  // the outfit rides on the element, so one loop serves the sheet's preview and a boxful of cards
  function dressPictures(looks) {
    card.querySelectorAll('.tw-pc').forEach((el, i) => {
      const cv = el.querySelector('.tw-pc__me');
      if (cv) { cv.dataset.look = JSON.stringify(looks[i] || {}); cv.dataset.f = ''; }
    });
    assetsReady().then(wake).catch(() => {});
    wake();
  }

  // 📇 who can be written to: a Pass, a Homestead, and somebody who still plays. The server holds
  // that bar (worker-rave FOLK_DAYS) — this only asks and draws.
  async function askFolk(q) {
    const me = slug ? slug() : '';
    try {
      const res = await fetch(FOLK_API + '?mine=' + encodeURIComponent(me) + (q ? '&q=' + encodeURIComponent(q) : ''));
      const j = await res.json().catch(() => ({}));
      return Array.isArray(j.folk) ? j.folk : [];
    } catch (e) { return []; }
  }

  const focusSheet = () => setTimeout(() => { const t = document.getElementById('twPostText'); if (t) t.focus(); }, 30);

  // ---- the pieces --------------------------------------------------------------------------------
  // ⚠️ a letter carries a NAME when the world has one (a resident's note does) and an address when
  // it does not — a mailbox is the one place a person must never be shown as a lower-case id.
  const who = (n) => esc((COPY.from || '{who}').replace('{who}', n));
  const nameOf = (l) => (l && l.name) || (l && l.from) || '';
  // ⚠️ `bare` is already taken inside html() for something else entirely — a shadowed helper is a
  // bug waiting for the day somebody moves a line.
  const plain = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const same = (a, b) => !b || plain(a) === plain(b);
  const peek = (t) => esc(String(t || '').slice(0, 64)) + (String(t || '').length > 64 ? '…' : '');
  // 🏡 AT HOME THE WORLD'S OWN NOTES ARE POST TOO. The homestead hands them over as `local` — Nib's big book,
  // the payslips, a boss's letter — and here they are sealed while new and filed under whoever wrote them
  // once read. The post office in town has none of them: they live in the yard, and the town never saves one.
  // ⚠️ they do not wait on the post room: offline, still loading or with no address yet, Nib's notes and the
  // payslips are in the yard and still show — only the post other players sent needs the room's answer
  const all = () => [...((box && !box.error && box.letters) || []),
    ...(local ? local.list().map((m) => ({ ...m, kind: 'world' })) : [])];
  const resident = (l) => !!l && (l.kind === 'note' || l.kind === 'world');
  // one row per PERSON: a neighbour by their house, a resident by name — so Nib's note from the post room
  // and Nib's payslip from the homestead are one row, not two
  const keyOf = (l) => (resident(l) ? 'r:' + plain(nameOf(l)) : 'p:' + l.from);
  const textOf = (l) => String((l.kind === 'world' ? l.peek : l.text) || '');
  // 🚪 one knock per HOUSE, the newest: a house that knocked three times is one somebody at the door
  const knocksOf = (ls) => {
    const by = new Map();
    for (const l of ls) if (l.kind === 'knock' && !by.has(l.from)) by.set(l.from, l);
    return [...by.values()].sort((a, b) => b.at - a.at);
  };
  const where = () => (cards ? 'post' : 'home');
  // ✍️ the door OUT of the mailbox. ⭐ it is at the top level and not on a letter, which is the whole
  // fix: before this, writing to somebody required already having heard from them.
  const writeBtn = () => '<button type="button" class="tw-cta tw-post__write" id="twPostNew">'
    + '<span class="tw-cta__verb">' + esc(((COPY.folk || {}).write) || '') + '</span></button>';
  // ✉️ THE ROUND, for the post office's own staff (22 Sep 2026): one more button at the foot of the mailbox,
  // and only here — a stranger's mailbox has no counter behind it. The words are the rig's (`round.start`).
  const sortBtn = () => (cards && staff && staff() && (COPY.round || {}).start
    ? '<button type="button" class="tw-cta tw-post__sort" id="twPostSort"><span class="tw-cta__verb">' + esc(COPY.round.start) + '</span></button>' : '');

  // 📮 A POSTCARD IS A PICTURE, at tile size in the fresh drawer and in the kept strip alike. An envelope you
  // open is the letter's grammar; a card has nothing to open, so it shows its own picture and who sent it.
  // ⚠️ A TILE SAYS WHO, BARE. The envelope or the picture already says it is post, and at tile size the
  // prefixed line came out "From Ne…" — which said neither. The whole line is still on the open card.
  const cardTile = (l) => '<button type="button" class="tw-post__pctile' + (l.read ? '' : ' is-new') + '" data-id="' + esc(l.id) + '">'
    + '<img class="tw-post__pcthumb" src="/assets/world/pc-' + esc((l.card || {}).tpl || 'park') + '.png" alt="" loading="lazy">'
    + '<b class="tw-post__who">' + esc(nameOf(l)) + '</b></button>';

  // ✉️ the state is in the ART, not in a badge: the pack ships two envelopes, one with a red wax seal
  // and one without. You can see which post is new from across a room, which is what a mailbox is for.
  // 💼 a payslip is a KRAFT envelope, the same way its paper is kraft when it opens.
  const sealed = (l) => (l.kind === 'card' ? cardTile(l) : '<button type="button" class="tw-post__env' + (l.tone === 'wage' ? ' is-wage' : '') + '" data-id="' + esc(l.id) + '">'
    + '<i class="tw-post__stamp" aria-hidden="true"></i>'
    + '<b class="tw-post__who">' + esc(nameOf(l)) + '</b>'
    + '</button>');

  // 🚪 A KNOCK: who, and the house when it adds something — never a word of what they wrote. Two answers
  // side by side, the same weight: letting a house in and turning one away are both ordinary.
  const knockRow = (l) => {
    const k = COPY.knock || {};
    return '<div class="tw-knock" data-id="' + esc(l.id) + '">'
      + '<i class="tw-post__stamp is-knock" aria-hidden="true"></i>'
      + '<span class="tw-knock__who"><b>' + esc((k.line || '{who}').replace('{who}', nameOf(l))) + '</b>'
      + (l.house && !same(nameOf(l), l.house) ? '<small>' + esc(l.house) + '</small>' : '') + '</span>'
      + '<span class="tw-knock__two">'
      + '<button type="button" class="tw-btn--in" data-in="' + esc(l.id) + '">' + esc(k.in || '') + '</button>'
      + '<button type="button" class="tw-post__away" data-away="' + esc(l.id) + '">' + esc(k.away || '') + '</button>'
      + '</span></div>';
  };

  const rowOf = (o) => '<button type="button" class="tw-post__thread' + (o.unread ? ' is-new' : '') + '"'
    + (o.id ? ' data-id="' + esc(o.id) + '"' : ' data-who="' + esc(o.key) + '"') + '>'
    + '<i class="tw-post__stamp is-open" aria-hidden="true"></i>'
    + '<span class="tw-post__row"><b class="tw-post__who">' + who(o.name) + '</b>'
    + '<span class="tw-post__peek">' + peek(o.last) + '</span></span>'
    + (o.n > 1 ? '<b class="tw-post__n">' + o.n + '</b>' : '')
    + '</button>';

  // ✉️📮 TWO WAYS TO ANSWER, side by side under anything you have open. A letter is words and a
  // postcard is a picture; the plan's whole differentiator is that the second is an OBJECT rather than
  // a message ("sending is giving someone décor with your name on it"), so it is not hidden behind
  // the first.
  // ⚠️ …EXCEPT FROM A RESIDENT. Nib, Stamp, Moss and Bean write to you (the server does, so nobody
  // can forge one) and they have no mailbox of their own — writing back to “nib” would address a yard
  // nobody owns. A button that cannot work is worse than no button, so a note carries neither.
  const replies = (w, note) => (note ? '' : '<div class="tw-post__two">'
    + '<button type="button" class="tw-btn--in" id="twPostReply">' + esc(w.reply || '') + '</button>'
    + (cards ? '<button type="button" class="tw-btn--in" id="twPostCard">' + esc((w.card || {}).make || '') + '</button>' : '')
    + '</div>');
  const backBtn = () => (COPY.back ? '<button type="button" class="tw-post__back" id="twPostBack">' + esc(COPY.back) + '</button>' : '');

  // ⭐ ONE ROW PER PERSON, NOT PER LETTER. A flat list of sixty letters is sixty rows and a thumb-ache;
  // the same sixty from eight people is eight rows, and each one is a conversation.
  function threadsOf(letters) {
    const by = new Map();
    for (const l of letters) {
      const k = keyOf(l);
      const t = by.get(k) || { key: k, from: l.from, name: nameOf(l), letters: [], unread: 0, at: 0, last: '' };
      t.letters.push(l);
      if (!l.read) t.unread++;
      if (l.at >= t.at) { t.at = l.at; t.last = textOf(l); t.name = nameOf(l) || t.name; }
      by.set(k, t);
    }
    const out = [...by.values()].sort((a, b) => b.at - a.at);
    for (const t of out) { t.letters.sort((a, b) => b.at - a.at); t.n = t.letters.length; }
    return out;
  }

  // ---- the card ----------------------------------------------------------------------------------
  function html() {
    const w = COPY;
    const letters = all();
    let body;
    // ⚠️ THE BUILDING'S OWN LINE HAS ONE HOME AND IT IS HERE. Tapping the post office used to answer with
    // a hand-written toast ending "Not built yet."; now it opens this card, so the rig's `front` line
    // would have had nowhere to go. It says what the place IS on the screens that are otherwise one
    // sentence in an empty box, and stays out of the way once there is post to read.
    const bare = !box || box.error || !letters.length;
    // ⚠️ …and NOT in the address book. The building's own line (“the post office keeps your letters
    // in its mailbox”) is about the room you are standing in, and in a list of PEOPLE it is both the
    // wrong subject and the 38 px that pushed Go back below the fold on a 360×640 phone.
    const front = (cards && bare && !open && !writing && !thread && !folk && w.front) ? '<p class="tw-card__sub">' + esc(w.front) + '</p>' : '';

    // 🏡 a closed room or a missing address only fills the card when there is nothing else to show — at home
    // the world's own notes are still yours to read (and the write door stays shut until the room answers)
    const roomDown = !box || !!box.error;
    if (box && box.error === 'noaddress' && !letters.length) {
      // ✉️⚠️ A DOOR, NOT A CLOSED COUNTER. A mailbox is keyed to the homestead's sign name, so a player
      // who has never claimed a yard has nowhere for a letter to land — and this branch used to print
      // the kill switch's line, which told them the post office was shut. It is not; they have no door.
      body = '<p class="tw-post__none">' + esc(w.noaddress || w.shut || '') + '</p>' + sortBtn();   // ✉️ the round is the counter's, not the mailbox's: staff can sort with no address
    } else if (roomDown && !letters.length) {
      body = '<p class="tw-post__none">' + esc(w.shut || '') + '</p>' + sortBtn();   // …or while the post room is down
    } else if (writing) {
      // ⚠️ maxlength is the SERVER's number, read from the one file that owns it, so the sheet cannot let
      // somebody write past what the rail will take and then refuse them for it.
      body = '<div class="tw-post__write">'
        + '<p class="tw-post__to">' + esc((w.sheet || '{who}').replace('{who}', writing.name || writing.to)) + '</p>'
        + '<textarea class="tw-post__sheet" id="twPostText" maxlength="' + LETTER.max + '" rows="5" aria-label="' + esc((w.sheet || '').replace('{who}', writing.name || writing.to)) + '"></textarea>'
        + '<button type="button" class="tw-cta" id="twPostSend"><span class="tw-cta__verb">' + esc(w.send || '') + '</span></button>'
        + backBtn() + '</div>';
    } else if (making) {
      // 📮 THE SHEET. Three places, eight lines, and the picture changes under your thumb as you
      // pick — which is the whole of the fun and the reason the preview is the same component the
      // receiver sees rather than an approximation of it.
      const c = (COPY.card || {});
      body = '<div class="tw-post__make">'
        + '<p class="tw-post__to">' + esc((w.sheet || '{who}').replace('{who}', making.to)) + '</p>'
        + picture(making, 'is-big')
        + '<div class="tw-pc__row" role="group" aria-label="' + esc(c.title || '') + '">'
        + CARD.tpl.map((t) => '<button type="button" class="tw-pc__pick' + (t === making.tpl ? ' is-on' : '')
          + '" data-tpl="' + esc(t) + '" aria-pressed="' + (t === making.tpl ? 'true' : 'false') + '">'
          + '<img src="/assets/world/pc-' + esc(t) + '.png" alt="' + esc((c.places || {})[t] || t) + '" loading="lazy">'
          + '</button>').join('')
        + '</div>'
        + '<div class="tw-pc__deck">'
        + (c.lines || []).map((l, i) => '<button type="button" class="tw-pc__say' + (i === making.line ? ' is-on' : '')
          + '" data-line="' + i + '" aria-pressed="' + (i === making.line ? 'true' : 'false') + '">' + esc(l) + '</button>').join('')
        + '</div>'
        + '<button type="button" class="tw-cta" id="twPostCardGo"><span class="tw-cta__verb">' + esc(c.send || '') + '</span></button>'
        + backBtn() + '</div>';
    } else if (open && open.kind === 'card' && open.card) {
      // 📮 a postcard that arrived: the picture, who sent it, and the same two feet every open
      // letter has — a card can be reported like anything else, even though nothing on it was typed
      body = '<div class="tw-post__open">'
        + '<b class="tw-post__who">' + esc(((COPY.card || {}).got || '{who}').replace('{who}', nameOf(open))) + '</b>'
        + picture(open.card, 'is-big')
        + replies(w, resident(open))
        + '<div class="tw-post__feet">' + backBtn()
        + (resident(open) ? '' : '<button type="button" class="tw-post__flag" id="twPostFlag">' + esc(w.report || '') + '</button>') + '</div>'
        + '</div>';
    } else if (open && open.kind === 'world') {
      // 🏡 one of the world's own notes, on its own paper — the homestead draws it into the space held
      // here (a payslip carries figures and a coin), and the envelope still comes open over it
      body = '<div class="tw-post__open is-world' + (opening ? ' is-opening' : '') + '">'
        + (opening ? '<i class="tw-post__flap" aria-hidden="true"></i>' : '')
        + '<div class="tw-post__sheetin"><div class="tw-post__world" data-local="' + esc(open.id) + '"></div></div>'
        + '<div class="tw-post__feet">' + backBtn() + '</div>'
        + '</div>';
    } else if (open) {
      // ⭐ THE ENVELOPE COMES OPEN AND THE LETTER COMES OUT. Both halves run ONCE, on transform and
      // opacity only: the envelope lifts and fades, the sheet rises out from behind it. The class is
      // dropped afterwards so a re-render while you are reading — a report, a reply — does not play the
      // envelope again over a letter that is already open.
      body = '<div class="tw-post__open' + (opening ? ' is-opening' : '') + '">'
        + (opening ? '<i class="tw-post__flap" aria-hidden="true"></i>' : '')
        + '<div class="tw-post__sheetin"><b class="tw-post__who">' + who(nameOf(open)) + '</b>'
        + '<p class="tw-post__body">' + esc(open.text) + '</p></div>'
        + replies(w, resident(open))
        + '<div class="tw-post__feet">' + backBtn()
        + (resident(open) ? '' : '<button type="button" class="tw-post__flag" id="twPostFlag">' + esc(w.report || '') + '</button>') + '</div>'
        + '</div>';
    } else if (thread) {
      // ⚠️ INSIDE a thread a row opens THAT letter, not the thread again — so it carries the id, and the
      // handler prefers an id over a name. An unread one in here is still a sealed envelope, and a
      // postcard is still a picture rather than a row with nothing to preview.
      const t = threadsOf(letters.filter((l) => l.kind !== 'knock')).find((x) => x.key === thread);
      const rows = t ? t.letters.map((l) => (l.kind === 'card' ? cardTile(l) : !l.read ? sealed(l)
        : rowOf({ key: keyOf(l), name: nameOf(l), last: textOf(l), id: l.id }))).join('') : '';
      body = '<div class="tw-post__stack">' + rows + '</div>' + backBtn();
    } else if (folk) {
      // 📇 one row per person: their banana, their name, their house. ⚠️ the canvas is painted after
      // the card is in the DOM (dressFolk), never from a string — an outfit is somebody else's data.
      const f = w.folk || {};
      const rows = folk.rows.map((p) => '<button type="button" class="tw-folk__row" data-slug="' + esc(p.slug) + '" data-name="' + esc(p.n) + '">'
        + '<span class="tw-folk__pic"><canvas class="tw-folk__me" width="' + CV + '" height="' + CV + '"></canvas></span>'
        // ⚠️ A PERSON AND THEIR HOUSE ARE OFTEN THE SAME WORDS. Plenty of players name the
        // homestead after themselves — Trym's own row came back “Trym Stene / Trym Stene” — and a
        // row that says it twice reads as a bug. One name, once; the house only when it adds
        // something. Compared loosely, because “Ada” and “ada's” are not two facts either.
        + '<span class="tw-folk__who"><b>' + esc(p.n) + '</b>'
        + (same(p.n, p.house) ? '' : '<small>' + esc(p.house) + '</small>') + '</span>'
        + '</button>').join('');
      body = '<div class="tw-folk">'
        + '<input type="search" class="tw-folk__find" id="twFolkFind" autocomplete="off" spellcheck="false"'
        + ' maxlength="24" placeholder="' + esc(f.find || '') + '" aria-label="' + esc(f.find || '') + '" value="' + esc(folk.q) + '">'
        + (rows ? '<div class="tw-folk__stack">' + rows + '</div>'
          : '<p class="tw-post__none">' + esc((folk.asked ? (folk.q ? f.none : f.empty) : f.wait) || '') + '</p>')
        + '</div>' + backBtn();
    } else if (!letters.length) {
      body = '<p class="tw-post__none">' + esc(w.empty || '') + '</p>' + writeBtn() + sortBtn();
    } else {
      // 📬 THE TWO DRAWERS. Fresh holds whoever is knocking and everything not yet opened, as tiles that
      // wrap three to a row and scroll inside themselves; Kept holds the postcards as a strip of pictures
      // and one row per person. ⭐ The mailbox always opens on Fresh, so new post can never be under old.
      const d = w.drawers || {};
      const knocks = knocksOf(letters);
      const fresh = letters.filter((l) => l.kind !== 'knock' && !l.read).sort((a, b) => b.at - a.at);
      const kept = letters.filter((l) => l.kind !== 'knock' && l.read);
      if (!drawer) drawer = 'fresh';
      if (drawer === 'kept' && !kept.length) drawer = 'fresh';
      const tab = (k, label, n, off) => '<button type="button" role="tab" class="tw-post__tab" data-drawer="' + k + '"'
        + ' aria-selected="' + (drawer === k ? 'true' : 'false') + '"' + (off ? ' disabled' : '') + '>'
        + '<span>' + esc(label || '') + '</span>' + (n ? '<b>' + n + '</b>' : '') + '</button>';
      const tabs = '<div class="tw-post__tabs" role="tablist">'
        + tab('fresh', d.fresh, knocks.length + fresh.length, false)
        + tab('kept', d.kept, kept.length, !kept.length) + '</div>';
      let inner = '';
      if (drawer === 'fresh') {
        inner = (knocks.length ? '<p class="tw-post__about">' + esc((w.knock || {}).about || '') + '</p>'
          + '<div class="tw-post__knocks">' + knocks.map(knockRow).join('') + '</div>' : '')
          + (fresh.length ? '<div class="tw-post__grid">' + fresh.map(sealed).join('') + '</div>' : '')
          + (!knocks.length && !fresh.length ? '<p class="tw-post__none">' + esc(d.none || '') + '</p>' : '');
      } else {
        const keptCards = kept.filter((l) => l.kind === 'card').sort((a, b) => b.at - a.at);
        const threads = threadsOf(kept.filter((l) => l.kind !== 'card'));
        inner = (keptCards.length ? '<div class="tw-post__cards">' + keptCards.map(cardTile).join('') + '</div>' : '')
          + (threads.length ? '<div class="tw-post__stack is-kept">' + threads.map(rowOf).join('') + '</div>' : '');
      }
      body = tabs + '<div class="tw-post__drawer is-' + drawer + '" role="tabpanel">' + inner + '</div>' + (roomDown ? '' : writeBtn()) + sortBtn();
    }
    // ⚠️ THE HEADING NAMES THE ROOM YOU ARE IN. Every state wore the mailbox's own title, so
    // tapping “Write a letter” landed you on a page headed “Your Mailbox” — the wrong name over the
    // right thing, which is the one mistake the world's naming rule is about.
    const head = (folk ? (w.folk || {}).title : '') || w.title;
    return '<div class="tw-post">' + (head ? '<h2>' + esc(head) + '</h2>' : '') + front + body + '</div>';
  }

  function render() {
    sleep();
    openCard(html());
    card.classList.add('tw-card--post');
    card.scrollTop = 0;
    // 🏡 the world's note on its own paper, drawn by the homestead into the space held for it
    const ph = card.querySelector('.tw-post__world');
    if (ph && local && local.el) { const e = local.el(ph.dataset.local); if (e) ph.appendChild(e); }
    wire();
    // 📮 every picture on screen gets the outfit that belongs to it, and one loop draws them all:
    // the sheet's own preview wears what YOU have on, a card in the box wears what its sender had on.
    const looks = [];
    card.querySelectorAll('.tw-pc').forEach((el) => {
      const big = el.classList.contains('is-big');
      looks.push(making && big && !open ? making.look : (open && open.card ? open.card.look : {}));
    });
    if (looks.length) dressPictures(looks);
    // 📇 the address book's faces, and the caret the rebuild would otherwise throw away
    if (folk) dressFolk();
  }

  // 📇 one banana per row, drawn once. ⚠️ A STILL, NOT A LOOP: the postcard preview animates
  // because it is one banana being posed; forty of them bobbing in a list is a flicker and forty
  // rAF draws a frame. Frame 2 is the standing pose the whole world uses for a portrait.
  function dressFolk() {
    const cvs = card.querySelectorAll('.tw-folk__me');
    if (!cvs.length) return;
    const draw = () => cvs.forEach((cv, i) => {
      const p = folk && folk.rows[i];
      if (!p || !cv.isConnected) return;
      try { drawComposite(cv.getContext('2d'), CV, 2, drawable(p.fit || {})); } catch (e) {}
    });
    draw();
    assetsReady().then(draw).catch(() => {});
    // ⚠️ THE KEYBOARD SURVIVES THE SEARCH. render() rebuilds the card from a string, so the input
    // is a brand-new element every keystroke's answer — without this the field loses focus and the
    // phone keyboard drops mid-word, which is the one thing a search box may never do.
    const find = card.querySelector('#twFolkFind');
    if (find && folk && folk.q && document.activeElement !== find) {
      find.focus();
      try { find.setSelectionRange(folk.q.length, folk.q.length); } catch (e) {}
    }
  }

  function wire() {
    // ⚠️ ONE WAY TO MARK A THING OPENED, whichever drawer or door it came from: a world note is the
    // homestead's to save, a letter the post room's, and each is counted where Pulse reads it
    const byId = (id) => all().find((l) => l.id === id) || null;
    const opened = (l) => {
      if (!l || l.read) return;
      l.read = true;
      if (l.kind === 'world') { if (local && local.read) local.read(l.id); track('post_note', { at: where(), note: 'world' }); return; }
      const bl = ((box && box.letters) || []).find((x) => x.id === l.id);
      if (bl) bl.read = true;
      ask('/read', { id: l.id });
      if (l.kind === 'note') track('post_note', { at: where(), note: l.note || '' });
      else track('post_read', { at: where(), ...(l.kind === 'card' ? { kind: 'card' } : {}) });
    };
    // 📮 a postcard opens flat — there is no envelope on one, so no flap and no animation
    card.querySelectorAll('.tw-post__pctile').forEach((b) => b.addEventListener('click', () => {
      open = byId(b.dataset.id);
      if (!open) return;
      render();
      opened(open);
    }));
    card.querySelectorAll('.tw-post__env').forEach((b) => b.addEventListener('click', () => {
      open = byId(b.dataset.id);
      if (!open) return;
      opening = true;
      render();
      setTimeout(() => { opening = false; }, 520);
      opened(open);
    }));
    card.querySelectorAll('.tw-post__thread').forEach((b) => b.addEventListener('click', () => {
      const id = b.dataset.id;
      if (id) { open = byId(id); render(); opened(open); return; }
      thread = b.dataset.who; open = null; render();
      track('post_open', { at: where(), step: 'thread' });
    }));
    // 📬 the drawers
    card.querySelectorAll('.tw-post__tab').forEach((b) => b.addEventListener('click', () => {
      if (b.disabled || drawer === b.dataset.drawer) return;
      drawer = b.dataset.drawer;
      render();
    }));
    // 🚪 LET IN: the house is known from now on, and everything it knocked with comes in to be opened
    card.querySelectorAll('[data-in]').forEach((b) => b.addEventListener('click', async () => {
      if (busy) return;
      busy = true;
      const res = await ask('/accept', { id: b.dataset.in });
      busy = false;
      if (res && res.ok) { track('post_accept', { at: where() }); await refresh(); }
      else say(COPY.shut || '');
    }));
    // 🚪 TURN AWAY: gone on the tap, the way a report is — every knock from that house leaves at once,
    // and the house never knocks again. ⚠️ the sender is told nothing, ever.
    card.querySelectorAll('[data-away]').forEach((b) => b.addEventListener('click', async () => {
      if (busy) return;
      const k = byId(b.dataset.away);
      if (!k || !box) return;
      box.letters = (box.letters || []).filter((l) => !(l.kind === 'knock' && l.from === k.from));
      render();
      say(((COPY.knock || {}).gone) || '');
      track('post_away', { at: where() });
      busy = true;
      await ask('/away', { id: k.id });
      busy = false;
    }));
    const back = card.querySelector('#twPostBack');
    if (back) back.addEventListener('click', () => {
      // one step at a time: the sheet → the address book → the letter → the thread → the mailbox
      if (making) making = null;
      else if (writing) writing = null;
      else if (folk) folk = null;
      else if (open) open = null;
      else thread = null;
      render();
    });
    const reply = card.querySelector('#twPostReply');
    if (reply) reply.addEventListener('click', () => { writing = { to: open.from, name: open.name || '' }; render(); focusSheet(); });

    // ── 📇 THE ADDRESS BOOK ───────────────────────────────────────────────────────────────────
    const sortB = card.querySelector('#twPostSort');
    if (sortB) sortB.addEventListener('click', () => { if (typeof sort === 'function') sort(); });
    const fresh = card.querySelector('#twPostNew');
    if (fresh) fresh.addEventListener('click', async () => {
      folk = { q: '', rows: [], asked: false };
      open = null; writing = null; thread = null;
      render();
      track('post_folk', { at: 'post', step: 'open' });
      const rows = await askFolk('');
      if (!folk) return;                       // they closed it while the book was on its way
      folk.rows = rows; folk.asked = true;
      render();
    });
    const find = card.querySelector('#twFolkFind');
    if (find) {
      // ⚠️ the caret is restored by hand after every render: the card is rebuilt from a string, so
      // the input is a NEW element each time and a naive re-render throws the keyboard away mid-word.
      find.addEventListener('input', () => {
        if (!folk) return;
        folk.q = find.value.slice(0, 24);
        clearTimeout(folkT);
        folkT = setTimeout(async () => {
          const q = folk && folk.q;
          const rows = await askFolk(q);
          if (!folk || folk.q !== q) return;   // they kept typing; a later answer owns the list
          folk.rows = rows; folk.asked = true;
          render();
        }, 260);
      });
    }
    card.querySelectorAll('.tw-folk__row').forEach((b) => b.addEventListener('click', () => {
      writing = { to: b.dataset.slug, name: b.dataset.name || '' };
      folk = null;
      render();
      focusSheet();
      track('post_folk', { at: 'post', step: 'pick' });
    }));
    const flag = card.querySelector('#twPostFlag');
    if (flag) flag.addEventListener('click', async () => {
      if (busy || !open) return; busy = true;
      const id = open.id;
      // ⭐ GONE FROM THE BOX ON THE TAP. The reader never has to look at it again while they wait for one
      // person with a phone; the letter itself is kept whole in a review list on the server.
      box.letters = (box.letters || []).filter((l) => l.id !== id);
      open = null;
      // a thread with nothing left in it is not a thread: fall back to the mailbox rather than to an
      // empty screen with a Go back button on it
      if (thread && !all().some((l) => keyOf(l) === thread)) thread = null;
      render();
      say(COPY.reported || '');
      track('post_report', { at: 'post' });
      await ask('/report', { id });
      busy = false;
    });
    // 📮 the card path: open the sheet, pick a place, pick a line, send it
    const pc = card.querySelector('#twPostCard');
    if (pc) pc.addEventListener('click', () => {
      // ⚠️ THE OUTFIT IS READ WHEN THE SHEET OPENS, not when the card is sent. It is what your banana
      // is wearing at the moment you make it — which is what the picture shows you, so the two cannot
      // disagree between the preview and the post.
      const tk = (thread && thread.indexOf('p:') === 0) ? thread.slice(2) : '';
      making = { to: (open && open.from) || (writing && writing.to) || tk, tpl: CARD.tpl[0], line: 0, look: readWorn() };
      open = null; writing = null;
      render();
      track('post_card', { at: 'post', step: 'open' });   // the sheet opened: against post_send kind=card, how many pick one up and put it down
    });
    card.querySelectorAll('.tw-pc__pick').forEach((b) => b.addEventListener('click', () => {
      if (!making) return; making.tpl = b.dataset.tpl; render();
    }));
    card.querySelectorAll('.tw-pc__say').forEach((b) => b.addEventListener('click', () => {
      if (!making) return; making.line = +b.dataset.line; render();
    }));
    const go = card.querySelector('#twPostCardGo');
    if (go) go.addEventListener('click', async () => {
      if (busy || !making) return;
      busy = true;
      const to = making.to;
      const res = await ask('/send', { to, card: { tpl: making.tpl, line: making.line, look: making.look } });
      busy = false;
      if (res && res.ok) {
        // ⚠️ THE TEMPLATE IS READ BEFORE THE SHEET IS CLEARED. This fired after `making = null` and sent
        // `id: null` on every card — the one number that says WHICH of the three places people send.
        const tpl = making.tpl, line = making.line;
        making = null;
        say((COPY.card || {}).sent || '');
        // ⭐ A CARD IS A SEND. It rides post_send with the rest so the reply rate counts both kinds of
        // answer, and carries `kind` so the desk can still ask whether the OBJECT beats the message.
        track('post_send', { at: 'post', kind: 'card', tpl, line });
        await refresh();
      } else {
        // ⚠️ THE SAME LINE WHATEVER THE SERVER SAID, exactly as for a letter: a card can only be
        // refused by the cap or by the master switch, and neither is the sender's business.
        say(turnedDown(res));
        track('post_refused', { at: 'post', why: (res && res.error) || 'off' });
      }
    });
    const send = card.querySelector('#twPostSend');
    if (send) send.addEventListener('click', async () => {
      if (busy) return;
      const t = document.getElementById('twPostText');
      const text = t ? t.value : '';
      // the page's own read of the gate: it spares a round trip, it does not decide anything
      if (!checkLetter(text).ok) { say(COPY.refused || ''); track('post_refused', { at: 'post', why: 'page' }); return; }
      busy = true;
      const res = await ask('/send', { to: writing.to, text });
      busy = false;
      if (res && res.ok) {
        writing = null; open = null;
        say(COPY.sent || '');
        track('post_send', { at: 'post', kind: 'letter' });
        await refresh();
      } else {
        // ⚠️ THE SAME LINE WHATEVER THE SERVER SAID. It answers `refused` for the filter and for the cap
        // alike, and even if it did not, telling somebody WHICH wall they hit is a lesson in getting
        // round it next time. The reason rides the event for us, never the screen for them.
        say(turnedDown(res));
        track('post_refused', { at: 'post', why: (res && res.error) || 'off' });
      }
    });
  }

  // ⚠️ A BOX THE WALK SET IS THE BOX, and a reply in flight may not overwrite it. Before the rail was
  // opened this never came up — `ask` failed fast and the walk's letters survived by luck. The moment
  // POST_OFF went to "0" the real (empty) box started landing a beat after every `set()`, and half the
  // post walk began photographing an empty mailbox. A pin, not a timing guess.
  let pinned = false;
  // ⚠️ A CLOSED CARD STAYS CLOSED. The box's answer can land after the card is gone — Start sorting closes it and
  // walks you to the counter; a quick ✕ does too — and render() goes through openCard, which popped the mailbox
  // back open over the walk (and a popup freezes the banana). Found by the sorting walk the day the button
  // started to appear before the box did.
  let live = false;
  async function refresh() {
    if (pinned) return;
    const b = await ask('/box');
    if (!live) return;
    // ⚠️ CHECKED AGAIN AFTER THE AWAIT. The first check is not enough: openBox() starts a refresh and
    // the walk sets its box a beat later, so the guard had already passed and the reply landed on top
    // of it anyway. A request in flight when the pin goes in is exactly the case this exists for.
    if (pinned) return;
    box = b;
    render();
  }

  return {
    async openBox() {
      live = true;
      open = null; writing = null; thread = null; opening = false; making = null; drawer = '';
      box = null;
      render();                 // the closed line shows first: a card that appears at once beats a spinner
      await refresh();
      track('post_open', { at: where() });
      // 🚪 somebody at the door, counted once per open with how many houses
      const kn = knocksOf(all());
      if (kn.length) track('post_knock', { at: where(), n: kn.length });
      return true;
    },
    // 🏡 the homestead's notes changed under an open card (a payslip landed): draw it again. ⚠️ only a card
    // that is ON SCREEN (render() goes through openCard, which would pop a closed mailbox open by itself),
    // and never over a sheet somebody is writing on — a rebuild is a new, empty textarea.
    redraw() {
      if (writing || making || folk || !card.getClientRects().length || !card.querySelector('.tw-post')) return;
      render();
    },
    stop() { live = false; sleep(); open = null; writing = null; thread = null; opening = false; making = null; drawer = ''; },
    seam: {
      state: () => ({
        letters: all(), open: open && open.id, writing: writing && writing.to,
        thread, opening, shut: !!(box && box.error), why: (box && box.error) || '', drawer,
        knocks: knocksOf(all()).map((k) => k.from),
        threads: threadsOf(all().filter((l) => l.read && l.kind !== 'knock' && l.kind !== 'card')).map((t) => ({ from: t.from, key: t.key, name: t.name, n: t.letters.length })),
      }),
      drawer: (d) => { drawer = d; render(); },
      set: (b) => { pinned = true; box = b; open = null; writing = null; thread = null; making = null; render(); },   // QA: a box without a worker, and nothing may replace it
      unpin: () => { pinned = false; },
      tap: (sel) => { const b = card.querySelector(sel); if (b) b.click(); return !!b; },
      type: (s) => { const t = document.getElementById('twPostText'); if (t) t.value = s; return !!t; },
    },
  };
}
