// The community remix gallery client.
//
// Performance doctrine: 268 GIFs must never animate at once (phone CPUs).
// Cards render a STATIC first-frame thumb; an IntersectionObserver swaps the
// real GIF in only while the card is near the viewport, and swaps it back
// out when it leaves. Cards also render in batches of 60 behind a sentinel.
//
// Ratings: 1-5 bananas via the banana-remixes worker. Your own votes live in
// localStorage (rmx-votes) so the UI remembers you; the server swaps re-votes
// instead of stacking them. If the worker is unreachable the stars still
// work locally and simply sync nothing (fail-quiet, never block the gallery).

const WORKER = 'https://banana-remixes.trymstene.workers.dev';
const DIR = '/assets/dancing-banana-community-remixes/';
const THUMBS = '/assets/remix-thumbs/';
const BATCH = 60;

const grid = document.getElementById('rmxGrid');
if (grid) {
  const ALL = JSON.parse(document.getElementById('rmxData').textContent);
  let ratings = {}; // slug -> [sum, count]
  let votes = {};
  try { votes = JSON.parse(localStorage.getItem('rmx-votes') || '{}'); } catch (e) {}

  let cat = 'all';
  let sort = 'top';
  let shown = 0;
  let list = [];
  const moreBtn = document.getElementById('rmxMore');

  const avg = (r) => { const t = ratings[r.id]; return t && t[1] ? t[0] / t[1] : 0; };

  // GIFs animate only near the viewport — static thumbs otherwise
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const img = e.target;
      const want = e.isIntersecting ? img.dataset.gif : img.dataset.thumb;
      if (img.getAttribute('src') !== want) img.setAttribute('src', want);
    }
  }, { rootMargin: '200px' });

  const sentinel = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) renderMore();
  });

  function fillStars(wrap, r) {
    wrap.replaceChildren();
    wrap.setAttribute('aria-label', 'Rate ' + r.title + ' in bananas');
    const shownScore = votes[r.id] || Math.round(avg(r));
    for (let s = 1; s <= 5; s++) {
      const b = document.createElement('button');
      b.textContent = '🍌';
      b.title = s + '/5 bananas';
      if (s <= shownScore) b.classList.add('on');
      b.addEventListener('click', () => rate(r, s, wrap));
      wrap.appendChild(b);
    }
    return wrap;
  }
  function starRow(r) {
    const wrap = document.createElement('div');
    wrap.className = 'rmx-stars';
    return fillStars(wrap, r);
  }

  function rate(r, stars, wrap) {
    const prev = votes[r.id];
    votes[r.id] = stars;
    try { localStorage.setItem('rmx-votes', JSON.stringify(votes)); } catch (e) {}
    [...wrap.children].forEach((b, i) => b.classList.toggle('on', i < stars));
    // optimistic local tally so sorting reflects your vote immediately
    const t = ratings[r.id] || (ratings[r.id] = [0, 0]);
    if (prev) t[0] += stars - prev; else { t[0] += stars; t[1] += 1; }
    countEl(wrap).textContent = countText(r);
    fetch(WORKER + '/rate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: r.id, stars }),
    }).then((res) => res.ok && res.json()).then((d) => {
      if (d && d.ok) { ratings[r.id] = [d.sum, d.count]; countEl(wrap).textContent = countText(r); }
    }).catch(() => {}); // worker asleep? your vote still counts locally
  }

  const countEl = (wrap) => wrap.parentElement.querySelector('.rmx-count');
  function countText(r) {
    const t = ratings[r.id];
    if (!t || !t[1]) return votes[r.id] ? 'your vote is in 🍌' : 'be the first to rate';
    return (t[0] / t[1]).toFixed(1) + ' 🍌 · ' + t[1] + (t[1] === 1 ? ' vote' : ' votes');
  }

  function card(r) {
    const el = document.createElement('div');
    el.className = 'rmx-card';
    // the box + title are a real link to the detail page (crawlable, deep-linkable);
    // the grid click handler intercepts it into a modal for JS visitors
    const link = document.createElement('a');
    link.className = 'rmx-open';
    link.href = '/dancing-banana-remixes/' + r.slug + '/';
    const box = document.createElement('div');
    box.className = 'rmx-box';
    const img = document.createElement('img');
    img.dataset.gif = DIR + r.id + '.gif';
    img.dataset.thumb = THUMBS + r.id + '.png';
    img.src = img.dataset.thumb;
    img.alt = r.title + ' — a dancing banana meme';
    img.loading = 'lazy';
    img.width = r.w; img.height = r.h;
    box.appendChild(img);
    io.observe(img);
    const h = document.createElement('h3');
    h.textContent = r.title;
    link.append(box, h);
    const count = document.createElement('div');
    count.className = 'rmx-count';
    el.append(link, starRow(r), count);
    count.textContent = countText(r);
    const dl = document.createElement('a');
    dl.className = 'rmx-dl';
    dl.href = DIR + r.id + '.gif';
    dl.setAttribute('download', 'dancing-banana-remix-' + r.id + '-trymstene.com.gif');
    dl.textContent = 'Download ↓';
    el.appendChild(dl);
    return el;
  }

  function refresh() {
    list = ALL.filter((r) => cat === 'all' || r.cat === cat);
    if (sort === 'az') list.sort((a, b) => a.title.localeCompare(b.title));
    else if (sort === 'lucky') { for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; } }
    else list.sort((a, b) => (avg(b) - avg(a)) || ((ratings[b.id] || [0, 0])[1] - (ratings[a.id] || [0, 0])[1]) || a.title.localeCompare(b.title));
    grid.replaceChildren();
    shown = 0;
    renderMore();
  }

  function renderMore() {
    const next = list.slice(shown, shown + BATCH);
    for (const r of next) grid.appendChild(card(r));
    shown += next.length;
    moreBtn.hidden = shown >= list.length;
    sentinel.disconnect();
    if (shown < list.length) sentinel.observe(moreBtn);
  }

  moreBtn.addEventListener('click', renderMore);
  document.getElementById('rmxFilters').addEventListener('click', (e) => {
    const b = e.target.closest('.rmx-chip');
    if (!b) return;
    cat = b.dataset.cat;
    document.querySelectorAll('.rmx-chip').forEach((c) => c.setAttribute('aria-pressed', String(c === b)));
    refresh();
  });
  document.getElementById('rmxSort').addEventListener('change', (e) => { sort = e.target.value; refresh(); });

  // ---- URL-addressable modal: opens over the gallery, syncs a clean URL ------
  const modal = document.getElementById('rmxModal');
  const bySlug = {};
  ALL.forEach((r) => { if (r.slug) bySlug[r.slug] = r; });

  function openModal(r, push) {
    document.getElementById('rmxModalTitle').textContent = r.title;
    const img = document.getElementById('rmxModalImg');
    img.src = DIR + r.id + '.gif';
    img.width = r.w; img.height = r.h;
    img.alt = r.title + ' — a dancing banana meme (animated GIF)';
    const scale = Math.max(4, Math.min(8, Math.round(220 / Math.max(r.w, r.h))));
    img.style.width = Math.min(230, r.w * scale) + 'px';
    img.style.height = 'auto';
    fillStars(document.getElementById('rmxModalStars'), r);
    document.getElementById('rmxModalCount').textContent = countText(r);
    document.getElementById('rmxModalBlurb').textContent = r.blurb || '';
    const url = '/dancing-banana-remixes/' + r.slug + '/';
    const dl = document.getElementById('rmxModalDl');
    dl.href = DIR + r.id + '.gif';
    dl.setAttribute('download', 'dancing-banana-' + r.slug + '-trymstene.com.gif');
    document.getElementById('rmxModalPage').href = url;
    modal.hidden = false;
    document.body.classList.add('rmx-modal-open');
    document.getElementById('rmxModalClose').focus();
    if (push) history.pushState({ remix: r.slug }, '', url);
  }
  function closeModal() {
    modal.hidden = true;
    document.body.classList.remove('rmx-modal-open');
  }
  function requestClose() {
    if (history.state && history.state.remix) history.back();
    else { closeModal(); history.replaceState(null, '', '/dancing-banana-remixes/'); }
  }

  grid.addEventListener('click', (e) => {
    const a = e.target.closest('.rmx-open');
    if (!a) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; // let new-tab / middle-click work
    e.preventDefault();
    const slug = a.getAttribute('href').split('/').filter(Boolean).pop();
    if (bySlug[slug]) openModal(bySlug[slug], true);
  });
  modal.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) { e.preventDefault(); requestClose(); }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) requestClose(); });
  window.addEventListener('popstate', (e) => {
    const slug = e.state && e.state.remix;
    if (slug && bySlug[slug]) openModal(bySlug[slug], false);
    else closeModal();
  });

  refresh(); // paint immediately (alphabetical-ish until ratings land)
  fetch(WORKER + '/ratings').then((r) => r.ok && r.json()).then((d) => {
    if (d) { ratings = d; refresh(); }
  }).catch(() => {});
}
