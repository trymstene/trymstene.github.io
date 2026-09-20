// ✉️ THE POST OFFICE'S MAILBOX — your letters, and writing back (20 Sep 2026, docs/town-jobs-plan.md §6).
//
// ⭐ THIS IS THE FIRST SURFACE IN BANANA WORLD WHERE ONE PLAYER'S WORDS REACH ANOTHER, and Trym's three
// calls shape all of it: anyone may write to anyone, a refusal never says which rule it hit, and a
// reported letter leaves the reader's box on the tap while being kept whole for review.
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
import { checkLetter, LETTER } from '../lib/letter-gate.js';

const COPY_MODS = import.meta.glob('../data/copy/town-post.json', { eager: true, import: 'default' });
export const COPY = Object.values(COPY_MODS)[0] || {};

const API = 'https://banana-rave.trymstene.workers.dev/post';
const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function bootTownPost(ctx) {
  const { openCard, card, closeCard, say, track, slug } = ctx;
  let box = null, open = null, writing = null, busy = false;
  let thread = null;      // whose letters we are looking through, or null for the mailbox itself
  let opening = false;    // one pass of the envelope coming open, then it is just a letter

  // ---- the rail ----------------------------------------------------------------------------------
  // ⚠️ EVERY CALL FAILS SOFT. The kill switch answers 503 by design and it ships ON, so "the counter is
  // closed" is the NORMAL path today, not an error — a card that showed a stack trace for the expected
  // state would be wrong on the day it shipped.
  async function ask(path, body) {
    const me = slug ? slug() : '';
    if (!me) return { error: 'off' };
    try {
      const res = await fetch(API + path + (body ? '' : '?slug=' + encodeURIComponent(me)), {
        method: body ? 'POST' : 'GET',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify({ ...body, slug: me }) : undefined,
      });
      const j = await res.json().catch(() => ({}));
      return res.ok ? j : { error: j.error || 'off', status: res.status };
    } catch (e) { return { error: 'off' }; }
  }

  // ---- the pieces --------------------------------------------------------------------------------
  const who = (n) => esc((COPY.from || '{who}').replace('{who}', n));
  const peek = (t) => esc(String(t || '').slice(0, 64)) + (String(t || '').length > 64 ? '…' : '');

  // ✉️ the state is in the ART, not in a badge: the pack ships two envelopes, one with a red wax seal
  // and one without. You can see which post is new from across a room, which is what a mailbox is for.
  const sealed = (l) => '<button type="button" class="tw-post__env" data-id="' + esc(l.id) + '">'
    + '<i class="tw-post__stamp" aria-hidden="true"></i>'
    + '<b class="tw-post__who">' + who(l.from) + '</b>'
    + '</button>';

  const rowOf = (o) => '<button type="button" class="tw-post__thread' + (o.unread ? ' is-new' : '') + '"'
    + (o.id ? ' data-id="' + esc(o.id) + '"' : ' data-who="' + esc(o.from) + '"') + '>'
    + '<i class="tw-post__stamp is-open" aria-hidden="true"></i>'
    + '<span class="tw-post__row"><b class="tw-post__who">' + who(o.from) + '</b>'
    + '<span class="tw-post__peek">' + peek(o.last) + '</span></span>'
    + '</button>';

  const backBtn = () => (COPY.back ? '<button type="button" class="tw-post__back" id="twPostBack">' + esc(COPY.back) + '</button>' : '');

  // ⭐ ONE ROW PER PERSON, NOT PER LETTER. A flat list of sixty letters is sixty rows and a thumb-ache;
  // the same sixty from eight people is eight rows, and each one is a conversation. Letters ARE
  // correspondence — the reply button was already addressed to a person rather than to a letter.
  function threadsOf(letters) {
    const by = new Map();
    for (const l of letters) {
      const t = by.get(l.from) || { from: l.from, letters: [], unread: 0, at: 0, last: '' };
      t.letters.push(l);
      if (!l.read) t.unread++;
      if (l.at >= t.at) { t.at = l.at; t.last = l.text; }
      by.set(l.from, t);
    }
    const out = [...by.values()].sort((a, b) => b.at - a.at);
    for (const t of out) t.letters.sort((a, b) => b.at - a.at);
    return out;
  }

  // ---- the card ----------------------------------------------------------------------------------
  function html() {
    const w = COPY;
    const letters = (box && box.letters) || [];
    let body;
    // ⚠️ THE BUILDING'S OWN LINE HAS ONE HOME AND IT IS HERE. Tapping the post office used to answer with
    // a hand-written toast ending "Not built yet."; now it opens this card, so the rig's `front` line
    // would have had nowhere to go. It says what the place IS on the screens that are otherwise one
    // sentence in an empty box, and stays out of the way once there is post to read.
    const bare = !box || box.error || !letters.length;
    const front = (bare && !open && !writing && !thread && w.front) ? '<p class="tw-card__sub">' + esc(w.front) + '</p>' : '';

    if (!box || box.error) {
      body = '<p class="tw-post__none">' + esc(w.shut || '') + '</p>';
    } else if (writing) {
      // ⚠️ maxlength is the SERVER's number, read from the one file that owns it, so the sheet cannot let
      // somebody write past what the rail will take and then refuse them for it.
      body = '<div class="tw-post__write">'
        + '<p class="tw-post__to">' + esc((w.sheet || '{who}').replace('{who}', writing.to)) + '</p>'
        + '<textarea class="tw-post__sheet" id="twPostText" maxlength="' + LETTER.max + '" rows="5" aria-label="' + esc((w.sheet || '').replace('{who}', writing.to)) + '"></textarea>'
        + '<button type="button" class="tw-cta" id="twPostSend"><span class="tw-cta__verb">' + esc(w.send || '') + '</span></button>'
        + backBtn() + '</div>';
    } else if (open) {
      // ⭐ THE ENVELOPE COMES OPEN AND THE LETTER COMES OUT. Both halves run ONCE, on transform and
      // opacity only: the envelope lifts and fades, the sheet rises out from behind it. The class is
      // dropped afterwards so a re-render while you are reading — a report, a reply — does not play the
      // envelope again over a letter that is already open.
      body = '<div class="tw-post__open' + (opening ? ' is-opening' : '') + '">'
        + (opening ? '<i class="tw-post__flap" aria-hidden="true"></i>' : '')
        + '<div class="tw-post__sheetin"><b class="tw-post__who">' + who(open.from) + '</b>'
        + '<p class="tw-post__body">' + esc(open.text) + '</p></div>'
        + '<button type="button" class="tw-btn--in" id="twPostReply">' + esc(w.reply || '') + '</button>'
        + '<div class="tw-post__feet">' + backBtn()
        + '<button type="button" class="tw-post__flag" id="twPostFlag">' + esc(w.report || '') + '</button></div>'
        + '</div>';
    } else if (thread) {
      // ⚠️ INSIDE a thread a row opens THAT letter, not the thread again — so it carries the id, and the
      // handler prefers an id over a name. An unread one in here is still a sealed envelope.
      const t = threadsOf(letters).find((x) => x.from === thread);
      const rows = t ? t.letters.map((l) => (l.read ? rowOf({ from: l.from, last: l.text, id: l.id }) : sealed(l))).join('') : '';
      body = '<div class="tw-post__stack">' + rows + '</div>' + backBtn();
    } else if (!letters.length) {
      body = '<p class="tw-post__none">' + esc(w.empty || '') + '</p>';
    } else {
      const fresh = letters.filter((l) => !l.read).sort((a, b) => b.at - a.at);
      const kept = threadsOf(letters.filter((l) => l.read));
      body = (fresh.length ? '<div class="tw-post__new">' + fresh.map(sealed).join('') + '</div>' : '')
        + (kept.length ? '<b class="tw-post__of">' + esc(w.threads || '') + '</b><div class="tw-post__stack">' + kept.map(rowOf).join('') + '</div>' : '');
    }
    return '<div class="tw-post">' + (w.title ? '<h2>' + esc(w.title) + '</h2>' : '') + body + front + '</div>';
  }

  function render() {
    openCard(html());
    card.classList.add('tw-card--post');
    card.scrollTop = 0;
    wire();
  }

  function wire() {
    card.querySelectorAll('.tw-post__env').forEach((b) => b.addEventListener('click', () => {
      open = ((box && box.letters) || []).find((l) => l.id === b.dataset.id) || null;
      if (!open) return;
      opening = true;
      render();
      setTimeout(() => { opening = false; }, 520);
      if (!open.read) { open.read = true; ask('/read', { id: open.id }); track('post_read', { at: 'post' }); }
    }));
    card.querySelectorAll('.tw-post__thread').forEach((b) => b.addEventListener('click', () => {
      const id = b.dataset.id;
      if (id) { open = ((box && box.letters) || []).find((l) => l.id === id) || null; render(); return; }
      thread = b.dataset.who; open = null; render();
      track('post_open', { at: 'post', step: 'thread' });
    }));
    const back = card.querySelector('#twPostBack');
    if (back) back.addEventListener('click', () => {
      // one step at a time: the sheet → the letter → the thread → the mailbox
      if (writing) writing = null;
      else if (open) open = null;
      else thread = null;
      render();
    });
    const reply = card.querySelector('#twPostReply');
    if (reply) reply.addEventListener('click', () => { writing = { to: open.from }; render(); setTimeout(() => { const t = document.getElementById('twPostText'); if (t) t.focus(); }, 30); });
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
      if (thread && !(box.letters || []).some((l) => l.from === thread)) thread = null;
      render();
      say(COPY.reported || '');
      track('post_report', { at: 'post' });
      await ask('/report', { id });
      busy = false;
    });
    const send = card.querySelector('#twPostSend');
    if (send) send.addEventListener('click', async () => {
      if (busy) return;
      const t = document.getElementById('twPostText');
      const text = t ? t.value : '';
      // the page's own read of the gate: it spares a round trip, it does not decide anything
      if (!checkLetter(text).ok) { say(COPY.refused || ''); track('post_refused', { at: 'post', why: 'page' }); return; }
      busy = true;
      const res = await ask('/send', { to: writing.to, from: (slug ? slug() : ''), text });
      busy = false;
      if (res && res.ok) {
        writing = null; open = null;
        say(COPY.sent || '');
        track('post_send', { at: 'post' });
        await refresh();
      } else {
        // ⚠️ THE SAME LINE WHATEVER THE SERVER SAID. It answers `refused` for the filter and for the cap
        // alike, and even if it did not, telling somebody WHICH wall they hit is a lesson in getting
        // round it next time. The reason rides the event for us, never the screen for them.
        say(COPY.refused || '');
        track('post_refused', { at: 'post', why: (res && res.error) || 'off' });
      }
    });
  }

  async function refresh() {
    box = await ask('/box');
    render();
  }

  return {
    async openBox() {
      open = null; writing = null; thread = null; opening = false;
      box = null;
      render();                 // the closed line shows first: a card that appears at once beats a spinner
      await refresh();
      track('post_open', { at: 'post' });
      return true;
    },
    stop() { open = null; writing = null; thread = null; opening = false; },
    seam: {
      state: () => ({
        letters: (box && box.letters) || [], open: open && open.id, writing: writing && writing.to,
        thread, opening, shut: !!(box && box.error),
        threads: threadsOf(((box && box.letters) || []).filter((l) => l.read)).map((t) => ({ from: t.from, n: t.letters.length })),
      }),
      set: (b) => { box = b; open = null; writing = null; thread = null; render(); },   // QA: a box without a worker
      tap: (sel) => { const b = card.querySelector(sel); if (b) b.click(); return !!b; },
      type: (s) => { const t = document.getElementById('twPostText'); if (t) t.value = s; return !!t; },
    },
  };
}
