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

  function starRow(r) {
    const wrap = document.createElement('div');
    wrap.className = 'rmx-stars';
    wrap.setAttribute('aria-label', 'Rate ' + r.title + ' in bananas');
    const mine = votes[r.id] || 0;
    const shownScore = mine || Math.round(avg(r));
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
    const count = document.createElement('div');
    count.className = 'rmx-count';
    el.append(box, h, starRow(r), count);
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

  refresh(); // paint immediately (alphabetical-ish until ratings land)
  fetch(WORKER + '/ratings').then((r) => r.ok && r.json()).then((d) => {
    if (d) { ratings = d; refresh(); }
  }).catch(() => {});
}
