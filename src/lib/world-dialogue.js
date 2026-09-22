// 🗣 THE WORLD'S DIALOGUE CARD — the one NPC dialogue, for every area.
//
// The park's Old Peel was the first full RPG NPC and his card is the template
// (the tilted waist-up portrait over the corner, the name, the line, an
// optional deck of questions whose answers type out in a console box). The
// beach copied it by hand for Shelly, Cap and Gil; the town copied the SHAPE by
// hand and got it wrong. Trym, 12 Sep 2026: "the dialogue popups for the NPCs
// should follow the existing dialogue popups we have … dialogue has a template
// — with or without dialogue options for the users." So it lives here now.
//
// The looks are /css/dialogue.css (link it in the page's head). This file owns
// the markup and the behaviour only: one call builds the card into a host and
// hands back a small handle.
//
//   const d = mountDialogue(cardBody, {
//     name: 'Nib', role: 'Town Hall clerk', line: 'Good day…',
//     portrait: (ctx, size) => drawComposite(ctx, size, 0, outfit),
//     topics: [{ q: 'What are you doing?', a: 'Pinning the board straight.' }],
//     onClose: () => closeCard(),        // optional: a topic may end the talk
//   });
//   d.say('another line')                // replace the spoken line
//
// A topic may carry `a` (one answer), `seq` (several beats, ▼ walks them) or
// `close: true` (the answer is a goodbye and the card shuts itself), and `after` (read once the
// answer is chosen: a function handed back runs after the card has closed itself — a boss's yes, then
// the world's moment). Without
// `topics` you get the plain variant: portrait, name, line, nothing to press.
//
// See docs/design-library.md §18.

const PORTRAIT = 390;   // the canvas the portrait is drawn at (2× the card's 180, for crisp pixels)
const TYPE_MS = 32;

export function mountDialogue(host, opts) {
  const o = opts || {};
  const rm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const topics = (o.topics || []).filter((t) => t && t.q && (t.a || t.seq));

  host.innerHTML = '';
  const card = document.createElement('div');
  card.className = 'wd-card';
  card.setAttribute('role', 'group');

  const pop = document.createElement('div');
  pop.className = 'wd-pop';
  pop.setAttribute('aria-hidden', 'true');
  const cv = document.createElement('canvas');
  cv.width = cv.height = PORTRAIT;
  pop.appendChild(cv);
  card.appendChild(pop);

  const h2 = document.createElement('h2');
  h2.textContent = o.name || '';
  card.appendChild(h2);

  if (o.role) {
    const r = document.createElement('p');
    r.className = 'wd-role';
    r.textContent = o.role;
    card.appendChild(r);
  }

  const say = document.createElement('p');
  say.className = 'wd-say';
  say.textContent = o.line || '';
  card.appendChild(say);

  const qs = document.createElement('div');
  qs.className = 'wd-q';
  const box = document.createElement('div');
  box.className = 'wd-box';
  box.hidden = true;
  const boxP = document.createElement('p');
  boxP.setAttribute('aria-live', 'polite');
  const more = document.createElement('span');
  more.className = 'wd-box__more';
  more.setAttribute('aria-hidden', 'true');
  more.textContent = '▼';
  box.appendChild(boxP); box.appendChild(more);
  // ⭐ A TOPIC MAY LEAVE A DOOR OPEN (20 Sep 2026, design library §18). An answer is typed as text, so
  // a resident who has to send you somewhere — Bean telling a phone with no kept pass that a job needs
  // one — could only say so and stop, and a newcomer who hears "no" with nothing to tap puts the phone
  // down there. This is the park's own pk-cta--keep pattern, moved into the one dialogue template so
  // every area gets it rather than each growing its own.
  const cta = document.createElement('a');
  cta.className = 'wd-cta';
  cta.hidden = true;
  if (topics.length) { card.appendChild(qs); card.appendChild(box); card.appendChild(cta); }
  host.appendChild(card);

  // 🖼 the portrait: zoomed so the waist-up crop fills the frame (the park's numbers)
  if (typeof o.portrait === 'function') {
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, PORTRAIT, PORTRAIT);
    ctx.save();
    ctx.scale(1.5, 1.5);
    ctx.translate(-PORTRAIT * 0.167, -PORTRAIT * 0.22);
    o.portrait(ctx, PORTRAIT);
    ctx.restore();
  }

  // ---- the question deck and the typing box
  let timer = null, text = '', at = 0, seq = null, seqAt = 0, closing = false;
  // ⭐ A TOPIC MAY END THE TALK ITSELF (22 Sep 2026, Trym: "the dialogue window should close and there should be
  // some sort of salute or splash text … the dialogue popup should close first, then splash"). A topic's
  // `after`, read once its answer is chosen, may hand back a function: the answer types as usual, the card
  // holds it a beat, closes by itself, and THEN the function runs — so what the world does next happens on a
  // clear screen. A tap once the line is typed closes it at once.
  let leave = null, leaveT = 0;
  const LINGER = 1200;
  function leaveNow() {
    clearTimeout(leaveT); leaveT = 0;
    const go = leave; leave = null;
    if (typeof o.onClose === 'function') o.onClose();
    if (go) setTimeout(go, 60);
  }

  function done() {
    clearInterval(timer); timer = null;
    boxP.textContent = text;
    box.classList.remove('is-typing');
    box.classList.add('is-done');
    if (leave) { clearTimeout(leaveT); leaveT = setTimeout(leaveNow, LINGER); }
  }
  function type(s) {
    clearInterval(timer);
    text = String(s == null ? '' : s); at = 0;
    box.hidden = false; qs.hidden = true; say.hidden = true;
    box.classList.remove('is-done');
    if (rm) { done(); return; }
    box.classList.add('is-typing');
    boxP.textContent = '';
    timer = setInterval(() => {
      at += 1;
      boxP.textContent = text.slice(0, at);
      if (at >= text.length) done();
    }, TYPE_MS);
  }
  function back() {
    cta.hidden = true;
    leave = null; clearTimeout(leaveT); leaveT = 0;
    clearInterval(timer); timer = null;
    box.hidden = true;
    box.classList.remove('is-typing', 'is-done');
    seq = null; closing = false;
    qs.hidden = false; say.hidden = false;
  }
  function ask(t) {
    closing = !!t.close;
    if (t.seq && t.seq.length) { seq = t.seq; seqAt = 0; type(seq[0]); return; }
    seq = null;
    const said = typeof t.a === 'function' ? t.a() : t.a;
    // ⚠️ AFTER the answer, because a() is what decides whether the door is needed at all
    const d = typeof t.cta === 'function' ? t.cta() : t.cta;
    cta.hidden = !(d && d.href && d.label);
    if (!cta.hidden) { cta.href = d.href; cta.textContent = d.label; }
    // …and so is whether the talk ends itself (set BEFORE typing: a reduced-motion answer is done at once)
    const next = typeof t.after === 'function' ? t.after() : null;
    leave = typeof next === 'function' ? next : null;
    type(said);
  }
  for (const t of topics) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = t.q;
    b.addEventListener('click', () => ask(t));
    qs.appendChild(b);
  }
  // the box is the ▼: mid-type it skips, done it walks the sequence or goes back
  box.addEventListener('click', () => {
    if (timer) { done(); return; }
    if (!box.classList.contains('is-done')) return;
    if (leave) { leaveNow(); return; }
    if (seq && seqAt < seq.length - 1) { seqAt += 1; type(seq[seqAt]); return; }
    if (closing && typeof o.onClose === 'function') { o.onClose(); return; }
    back();
  });

  return {
    card,
    say: (s) => { say.textContent = s; back(); },
    ask,
    back,
    // a card closed from outside (the ✕, the veil) while the talk was ending itself still gets what comes after:
    // the boss said yes either way, and the moment belongs to the job, not to how the card was shut
    stop: () => { clearInterval(timer); timer = null; clearTimeout(leaveT); leaveT = 0; const go = leave; leave = null; if (go) setTimeout(go, 60); },
  };
}
