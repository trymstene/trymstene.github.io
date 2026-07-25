// Rating + download tracking for a Banana Gallery item page. Rides the same
// worker as the remix gallery (GET /ratings whole-board, POST /rate) with
// gallery ids namespaced `gal-<id>` so the two galleries never collide.
const WORKER = 'https://banana-remixes.trymstene.workers.dev';
const root = document.getElementById('gallery-detail');
if (root) {
  const id = 'gal-' + root.dataset.id;
  const starsEl = root.querySelector('.gd-stars');
  const countEl = root.querySelector('.gd-count');
  let votes = {};
  try { votes = JSON.parse(localStorage.getItem('gal-votes') || '{}'); } catch (e) {}
  let tally = null; // [sum, count]
  // seed from the server-rendered rating so the visible stars/count match the
  // AggregateRating markup from first paint (no unrated flash); /ratings reconciles
  const seedCount = +(starsEl.dataset.count || 0);
  if (seedCount) tally = [+(starsEl.dataset.sum || 0), seedCount];

  const avg = () => (tally && tally[1] ? tally[0] / tally[1] : 0);
  function countText() {
    if (!tally || !tally[1]) return votes[id] ? 'your vote is in 🍌' : 'be the first to rate 🍌';
    return avg().toFixed(1) + ' 🍌 · ' + tally[1] + (tally[1] === 1 ? ' vote' : ' votes');
  }
  function paint() {
    const shown = votes[id] || Math.round(avg());
    [...starsEl.children].forEach((b, i) => b.classList.toggle('on', i < shown));
    countEl.textContent = countText();
  }
  function vote(stars) {
    const prev = votes[id];
    votes[id] = stars;
    try { localStorage.setItem('gal-votes', JSON.stringify(votes)); } catch (e) {}
    tally = tally || [0, 0];
    if (prev) tally[0] += stars - prev; else { tally[0] += stars; tally[1] += 1; }
    paint();
    fetch(WORKER + '/rate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, stars }),
    }).then((res) => res.ok && res.json()).then((d) => {
      if (d && d.ok) { tally = [d.sum, d.count]; paint(); }
    }).catch(() => {});
    if (window.gtag) gtag('event', 'gallery_rate', { item: root.dataset.id, stars });
  }
  // hydrate the server-rendered star buttons (fall back to building them if a
  // stale cache served the old empty markup)
  let starBtns = [...starsEl.querySelectorAll('button')];
  if (!starBtns.length) {
    for (let s = 1; s <= 5; s++) {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = '🍌';
      b.title = s + '/5 bananas'; b.setAttribute('aria-label', s + ' of 5 bananas');
      starsEl.appendChild(b);
    }
    starBtns = [...starsEl.querySelectorAll('button')];
  }
  starBtns.forEach((b, i) => b.addEventListener('click', () => vote(i + 1)));
  paint();
  fetch(WORKER + '/ratings').then((r) => r.ok && r.json()).then((board) => {
    if (board && board[id]) { tally = board[id]; paint(); }
  }).catch(() => {});

  const dl = document.getElementById('gdDownload');
  if (dl) dl.addEventListener('click', () => {
    if (window.gtag) gtag('event', 'gallery_download', { item: root.dataset.id });
  });
}
