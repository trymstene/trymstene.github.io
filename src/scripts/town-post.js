// ✉️ THE POST OFFICE'S MAILBOX — your letters, and writing back (20 Sep 2026, docs/town-jobs-plan.md §6).
//
// ⭐ THIS IS THE FIRST SURFACE IN BANANA WORLD WHERE ONE PLAYER'S WORDS REACH ANOTHER, and Trym's three
// calls shape all of it: anyone may write to anyone, a refusal never says which rule it hit, and a
// reported letter leaves the reader's box on the tap while being kept whole for review.
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
// is the box AROUND it. Nothing here is rotated.
import { checkLetter, LETTER } from '../lib/letter-gate.js';

const COPY_MODS = import.meta.glob('../data/copy/town-post.json', { eager: true, import: 'default' });
export const COPY = Object.values(COPY_MODS)[0] || {};

const API = 'https://banana-rave.trymstene.workers.dev/post';
const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function bootTownPost(ctx) {
  const { openCard, card, closeCard, say, track, slug } = ctx;
  let box = null, open = null, writing = null, busy = false;

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

  // ---- the card ----------------------------------------------------------------------------------
  const paper = (l) => '<button type="button" class="tw-post__let' + (l.read ? '' : ' is-new') + '" data-id="' + esc(l.id) + '">'
    + '<b class="tw-post__who">' + esc((COPY.from || '{who}').replace('{who}', l.from)) + '</b>'
    + '<span class="tw-post__peek">' + esc(l.text.slice(0, 64)) + (l.text.length > 64 ? '…' : '') + '</span>'
    + '</button>';

  function html() {
    const w = COPY;
    let body;
    // ⚠️ THE BUILDING'S OWN LINE HAS ONE HOME AND IT IS HERE. Tapping the post office used to answer
    // with a hand-written toast ending "Not built yet."; now it opens this card, so the rig's `front`
    // line would have had nowhere to go. It says what the place IS on the two screens that are otherwise
    // one sentence in an empty box — and it stays out of the way once there is post to read.
    const bare = !box || box.error || !(box.letters || []).length;
    const front = (bare && !open && !writing && w.front) ? '<p class="tw-card__sub">' + esc(w.front) + '</p>' : '';
    if (box && box.error) body = '<p class="tw-post__none">' + esc(w.shut || '') + '</p>';
    else if (!box) body = '<p class="tw-post__none">' + esc(w.shut || '') + '</p>';
    else if (writing) {
      // ⚠️ maxlength is the SERVER's number, read from the one file that owns it, so the sheet cannot
      // let somebody write past what the rail will take and then refuse them for it.
      body = '<div class="tw-post__write">'
        + '<p class="tw-post__to">' + esc((w.sheet || '{who}').replace('{who}', writing.to)) + '</p>'
        + '<textarea class="tw-post__sheet" id="twPostText" maxlength="' + LETTER.max + '" rows="5" aria-label="' + esc((w.sheet || '').replace('{who}', writing.to)) + '"></textarea>'
        + '<button type="button" class="tw-cta" id="twPostSend"><span class="tw-cta__verb">' + esc(w.send || '') + '</span></button>'
        + '</div>';
    } else if (open) {
      body = '<div class="tw-post__open">'
        + '<b class="tw-post__who">' + esc((w.from || '{who}').replace('{who}', open.from)) + '</b>'
        + '<p class="tw-post__body">' + esc(open.text) + '</p>'
        + '<button type="button" class="tw-btn--in" id="twPostReply">' + esc(w.reply || '') + '</button>'
        + '<button type="button" class="tw-post__flag" id="twPostFlag">' + esc(w.report || '') + '</button>'
        + '</div>';
    } else if (!box.letters || !box.letters.length) {
      body = '<p class="tw-post__none">' + esc(w.empty || '') + '</p>';
    } else {
      body = '<div class="tw-post__stack">' + box.letters.map(paper).join('') + '</div>';
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
    card.querySelectorAll('.tw-post__let').forEach((b) => b.addEventListener('click', async () => {
      open = (box.letters || []).find((l) => l.id === b.dataset.id) || null;
      if (!open) return;
      render();
      if (!open.read) { open.read = true; ask('/read', { id: open.id }); track('post_read', { at: 'post' }); }
    }));
    const reply = card.querySelector('#twPostReply');
    if (reply) reply.addEventListener('click', () => { writing = { to: open.from }; render(); setTimeout(() => { const t = document.getElementById('twPostText'); if (t) t.focus(); }, 30); });
    const flag = card.querySelector('#twPostFlag');
    if (flag) flag.addEventListener('click', async () => {
      if (busy) return; busy = true;
      const id = open.id;
      // ⭐ GONE FROM THE BOX ON THE TAP. The reader never has to look at it again while they wait for
      // one person with a phone; the letter itself is kept whole in a review list on the server.
      box.letters = (box.letters || []).filter((l) => l.id !== id);
      open = null;
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
      const early = checkLetter(text);
      if (!early.ok) { say(COPY.refused || ''); track('post_refused', { at: 'post', why: 'page' }); return; }
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
      open = null; writing = null;
      box = null;
      render();                 // the closed line shows first: a card that appears at once beats a spinner
      await refresh();
      track('post_open', { at: 'post' });
      return true;
    },
    stop() { open = null; writing = null; },
    seam: {
      state: () => ({ letters: (box && box.letters) || [], open: open && open.id, writing: writing && writing.to, shut: !!(box && box.error) }),
      set: (b) => { box = b; open = null; writing = null; render(); },   // QA: a box without a worker
      tap: (sel) => { const b = card.querySelector(sel); if (b) b.click(); return !!b; },
      type: (s) => { const t = document.getElementById('twPostText'); if (t) t.value = s; return !!t; },
    },
  };
}
