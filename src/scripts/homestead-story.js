// 📖 THE FARM STORY — a deck of polaroids of what happened here while you
// were out. You swipe it. It is a picture, not a list.
//
// PURE RENDERER, like homestead-tree.js: this file imports NOTHING and knows
// nothing about the yard. Every variable thing arrives through `opts`, so the
// same deck can be benched standalone in an HTML page with mock rows.
//
//   item: { k: 'visit'|'sign'|'water'|'hug'|'feed', n, t, x?, sp?, an? }
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

// every size is fixed here and nothing downstream invents one
const CARD_W = 168, CARD_H = 210, PHOTO_H = 116, PAD = 8, GAP = 14, SUB = 1.8;
const DAY = 86400000;

// one subject per kind: a photo of the thing that happened, never an icon of it
const PROP = {
  water: ['d-sprout.png', 27, 23, 3],
  feed: ['d-trough-full.png', 65, 33, 2],
  sign: ['m-sign.png', 31, 31, 2],
  none: ['m-sign.png', 31, 31, 2],
};

export function buildStory(view, items, opts) {
  const icon = (n, px) => opts.icon(n, px);
  const timers = new Set();
  const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };

  const deck = document.createElement('div');
  deck.className = 'hs-sdeck';
  view.appendChild(deck);

  // "today" and "yesterday" are warmer than a date, and a date is en-GB
  const fmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
  function when(t) {
    if (!t) return '';
    const d0 = Math.floor(opts.now / DAY), d1 = Math.floor(t / DAY);
    if (d1 >= d0) return 'today';
    if (d1 === d0 - 1) return 'yesterday';
    return fmt.format(new Date(t));
  }

  function line(it) {
    const who = it.n || 'a banana';
    if (it.k === 'sign') return it.x || (who + ' signed the guestbook');
    if (it.k === 'water') return who + ' watered the beds';
    if (it.k === 'feed') return who + ' filled the trough';
    if (it.k === 'hug') return who + ' hugged ' + (it.an || 'one of yours');
    return who + ' came by';
  }

  // the subject of the photo: an animal strip, a prop, or the visitor herself
  function subject(it) {
    if (it.k === 'visit') {
      const el = opts.banana(Math.round(96));
      if (el) { el.className = 'hs-ssub hs-ssub--banana'; return el; }
    }
    const i = document.createElement('i');
    i.className = 'hs-ssub';
    let file, fw, fh, w, strip = false;
    if (it.k === 'hug' && opts.thumb(it.sp)) {
      const t = opts.thumb(it.sp);
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
    a.className = 'hs-scard' + (it.t && opts.now - it.t > 2 * DAY ? ' is-old' : '');
    // a hand-stacked deck, not a grid: the tilt is deterministic per position
    a.style.transform = 'rotate(' + (((n * 37) % 5) - 2) * 0.7 + 'deg)';
    const ph = document.createElement('div');
    ph.className = 'hs-sphoto';
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

  return {
    paint,
    refit() { deck.scrollLeft = 0; },
    destroy() { timers.forEach(clearTimeout); timers.clear(); },
  };
}
