// 📖 THE FARM STORY — a deck of polaroids of what happened here while you
// were out. You swipe it. It is a picture, not a list.
//
// PURE RENDERER, like homestead-tree.js: this file imports NOTHING and knows
// nothing about the yard. Every variable thing arrives through `opts`, so the
// same deck can be benched standalone in an HTML page with mock rows.
//
//   item: { k: 'found'|'arrive'|'born'|'rest'|'away'|'visit'|'sign'|'water'|'hug'|'feed', n, t, x?, sp?, an? }
//           n = the name somebody signed with · t = ms · x = a guestbook line
//           sp/an = the species and name of the animal a hug was for
//   opts: { art: '/assets/homestead/',
//           icon(name, px) -> inline <svg> string,
//           thumb(sp) -> [file, frameW, frameH, showW]   (an animal strip)
//           banana(px) -> an element to stand in the photo, or null,
//           now: Date.now() }
//   returns { paint, refit, destroy }
//
// ⚠️ A guestbook line is written by another player: it goes in with
// textContent, never innerHTML. Only opts.icon() output is trusted markup.

// ⚠️ THE DECK'S GEOMETRY LIVES IN ONE PLACE and it is the CSS block in
// homestead.astro (.hs-scard is a fixed 202x296, one 14px gap, packed to the
// top so a card sits in the same spot on a tall phone and a short one). The
// only number here is how much bigger an animal stands in a photo than she
// does in a list.
const SUB = 2.6;
const DAY = 86400000;

// one subject per kind: a photo of the thing that happened, never an icon of it
const PROP = {
  water: ['d-sprout.png', 27, 23, 3],
  feed: ['d-trough-full.png', 65, 33, 2],
  sign: ['m-sign.png', 31, 31, 2],
  found: ['m-sign.png', 31, 31, 2],
  none: ['m-sign.png', 31, 31, 2],
};
// the kinds whose photograph is an animal
const ANIMAL = { hug: 1, arrive: 1, born: 1, rest: 1, away: 1 };
// how long a photograph keeps its colour: fresh today, black and white by the
// end of a fortnight, so scrolling back is visibly scrolling into the past
const FADE = 14 * 86400000;

export function buildStory(view, items, opts) {
  const icon = (n, px) => opts.icon(n, px);
  const timers = new Set();
  const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };

  const deck = document.createElement('div');
  deck.className = 'hs-sdeck';
  view.appendChild(deck);

  // ⚠️ FIXED GEOMETRY, ONE SCALE — the tree's answer, not a media query. The
  // card is always 202x300; a tall phone shows it bigger and a short one
  // smaller, so the deck fills the paper it is on and a photo never lands in
  // a different place on a different phone.
  function fit() {
    const h = view.clientHeight || 0, w = view.clientWidth || 0;
    const cw = (deck.firstElementChild && deck.firstElementChild.offsetWidth) || 202;
    if (!h || !w) return;
    // fill the height, but never so much that the next photograph stops
    // peeking — the peek is the only thing that says this deck is swipeable
    const s = Math.max(0.75, Math.min(1.5, (h - 52) / 310, (w * 0.68) / cw));
    deck.style.transformOrigin = '0 0';
    deck.style.transform = 'scale(' + s.toFixed(3) + ')';
    deck.style.width = (100 / s) + '%';
    deck.style.height = (100 / s) + '%';
    // ⚠️ the pills are NOT inside the scaled deck, so the room a card must
    // leave for them shrinks as the deck grows — reserve it in the deck's
    // own units or a card lands on top of them
    deck.style.paddingBottom = Math.round(50 / s) + 'px';
  }
  const onResize = () => fit();
  addEventListener('resize', onResize);
  addEventListener('orientationchange', onResize);

  // "today" and "yesterday" are warmer than a date, and a date is en-GB
  const fmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
  function when(t) {
    if (!t) return '';
    const d0 = Math.floor(opts.now / DAY), d1 = Math.floor(t / DAY);
    if (d1 >= d0) return 'today';
    if (d1 === d0 - 1) return 'yesterday';
    return fmt.format(new Date(t));
  }

  // an animal with a name is a somebody; without one she is still hers
  const her = (it) => it.an || ('the ' + (it.sp || 'hen'));
  function line(it) {
    const who = it.n || 'a banana';
    if (it.k === 'found') return 'you founded ' + (it.n || 'this homestead');
    if (it.k === 'arrive') return her(it) + ' arrived';
    if (it.k === 'born') return her(it) + ' was born here';
    if (it.k === 'rest') return her(it) + ' went to the long grass';
    if (it.k === 'away') return her(it) + ' found a new farm';
    if (it.k === 'sign') return it.x || (who + ' signed the guestbook');
    if (it.k === 'water') return who + ' watered the beds';
    if (it.k === 'feed') return who + ' filled the trough';
    if (it.k === 'hug') return who + ' hugged ' + (it.an || 'one of yours');
    return who + ' came by';
  }

  // the subject of the photo: an animal strip, a prop, or the visitor herself
  function subject(it) {
    if (it.k === 'visit') {
      const el = opts.banana(132);
      if (el) { el.className = 'hs-ssub hs-ssub--banana'; return el; }
    }
    const i = document.createElement('i');
    i.className = 'hs-ssub';
    let file, fw, fh, w, strip = false;
    // a birth is photographed as the little one she was that day
    const t = ANIMAL[it.k] && (opts.thumb((it.k === 'born' ? 'y' : '') + it.sp) || opts.thumb(it.sp));
    if (t) {
      file = t[0]; fw = t[1]; fh = t[2]; w = Math.round(t[3] * SUB); strip = true;
    } else {
      const p = PROP[it.k] || PROP.none;
      file = p[0]; fw = p[1]; fh = p[2]; w = p[1] * p[3];
    }
    i.style.backgroundImage = "url('" + opts.art + file + "')";
    i.style.width = w + 'px';
    i.style.aspectRatio = fw + ' / ' + fh;
    if (strip) i.style.backgroundSize = '400% 100%';
    return i;
  }

  function card(it, n) {
    const a = document.createElement('article');
    a.className = 'hs-scard';
    // a hand-stacked deck, not a grid: the tilt is deterministic per position
    a.style.transform = 'rotate(' + (((n * 37) % 5) - 2) * 0.7 + 'deg)';
    const ph = document.createElement('div');
    ph.className = 'hs-sphoto';
    // the colour drains with age: today is a colour photograph, a fortnight
    // ago is black and white, and everything between is on its way there
    const age = it.t ? Math.min(1, Math.max(0, (opts.now - it.t) / FADE)) : 0;
    if (age > 0.02) {
      ph.style.filter = 'grayscale(' + age.toFixed(2) + ') contrast(' + (1 - age * 0.08).toFixed(2) + ')';
      a.style.background = age > 0.6 ? '#f7f3e6' : '#fff';
    }
    ph.appendChild(subject(it));
    if (it.k === 'hug') {
      const h = document.createElement('span');
      h.className = 'hs-sheart';
      h.innerHTML = icon('heart-solid', 16);
      ph.appendChild(h);
    }
    a.appendChild(ph);
    const cap = document.createElement('div');
    cap.className = 'hs-scap';
    const b = document.createElement('b');
    b.textContent = line(it);          // ⚠️ player-written: never innerHTML
    const s = document.createElement('small');
    s.textContent = when(it.t);
    cap.appendChild(b); cap.appendChild(s);
    a.appendChild(cap);
    return a;
  }

  function paint() {
    deck.textContent = '';
    if (!items.length) {
      const a = card({ k: 'none', n: '', t: 0 }, 0);
      a.querySelector('.hs-scap b').textContent = 'nobody has been by yet';
      a.querySelector('.hs-scap small').textContent = 'your sign shares the address';
      deck.appendChild(a);
      return;
    }
    items.forEach((it, n) => {
      const el = card(it, n);
      el.classList.add('is-new');
      deck.appendChild(el);
      el.style.transitionDelay = Math.min(n, 5) * 70 + 'ms';
      void el.offsetWidth;
      el.classList.remove('is-new');
      later(() => { el.style.transitionDelay = ''; }, 700);
    });
  }

  // the pills: back to the newest, and what this screen is
  const top = document.createElement('button');
  top.type = 'button';
  top.className = 'hs-spill hs-spill--top';
  top.innerHTML = icon('chevron-left', 18);
  top.setAttribute('aria-label', 'back to the newest');
  top.addEventListener('click', (e) => { e.stopPropagation(); deck.scrollTo({ left: 0, behavior: 'smooth' }); });

  const note = document.createElement('div');
  note.className = 'hs-snote';
  note.hidden = true;
  const nb = document.createElement('b');
  nb.textContent = 'What people did here while you were away.';
  const np = document.createElement('span');
  np.textContent = 'Visitors arrive from the address on your sign, and from the homesteads on the front page. Hugs and a filled trough count for your animals overnight.';
  note.appendChild(nb); note.appendChild(np);

  const info = document.createElement('button');
  info.type = 'button';
  info.className = 'hs-spill hs-spill--info';
  info.innerHTML = icon('info-box', 18);
  info.setAttribute('aria-label', 'what is this');
  info.addEventListener('click', (e) => { e.stopPropagation(); note.hidden = !note.hidden; });

  view.appendChild(note);
  view.appendChild(top);
  view.appendChild(info);
  paint();
  fit();

  return {
    paint,
    refit: fit,
    // ⚠️ the tree drops its handle and leaks a timer per node; this one is
    // held by the caller and takes its listeners and timers with it
    destroy() {
      timers.forEach(clearTimeout); timers.clear();
      removeEventListener('resize', onResize);
      removeEventListener('orientationchange', onResize);
    },
  };
}
