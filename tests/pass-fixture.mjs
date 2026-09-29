// 🎫 a BUSY pass for walking the pass page: logged in, a member, a full shelf, badges, news and a weekly standing (tests/pass-layout.spec.mjs)
import { createHash } from 'node:crypto';
export const GID = 'qa-pass-rich-1';
export const TAG = createHash('sha256').update(GID).digest('hex').slice(0, 8);
const DAY = 86400000;
const OUTFITS = ['g=shades&h=party', 'g=none&h=crown', 'g=nerd&h=cowboy', 'g=heart&h=beanie', 'g=none&h=tophat', 'g=star&h=none',
  'g=shades&h=chef', 'g=none&h=jester', 'g=nerd&h=party', 'g=heart&h=crown', 'g=none&h=pirate', 'g=star&h=beanie'];
export async function richPass(page, { member = true, logged = true } = {}) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.route(/workers\.dev|googletagmanager|google-analytics|cloudflareinsights|facebook|clarity/, (r) => r.abort());
  await page.route(/banana-pass\.trymstene\.workers\.dev\/citizen/, (r) => r.fulfill({ json: { live: { plaques: { neighbour: [{ tag: 'aaaaaaaa', name: 'A' }, { tag: TAG, name: 'Me' }], farmer: [{ tag: TAG, name: 'Me' }] }, citizen: [] } } }));
  await page.route(/\/pay\/manage/, (r) => r.fulfill({ json: { ok: true, known: true, ending: true, endsAt: new Date(Date.now() + 2 * DAY).toISOString() } }));
  await page.addInitScript(([gid, member, logged, outfits]) => {
    if (localStorage.getItem('qa-rich-seeded')) return;
    const now = Date.now(), D = 86400000;
    localStorage.setItem('qa-rich-seeded', '1');
    localStorage.setItem('tt-internal', '1');
    localStorage.setItem('world-gid', gid);
    localStorage.setItem('ps-name-v1', 'Trym Stene');
    const patches = {};
    ['maker', 'wk-farmer', 'chaos', 'emoji', 'spreader', 'smith', 'exhibitor', 'raver', 'survivor', 'round', 'regular', 'og', 'collector'].forEach((k, i) => { patches[k] = now - i * D; });
    localStorage.setItem('pass-v1', JSON.stringify({ created: now - 87 * D, patches, stats: { rep: 21000, raveMin: 5294, builds: 55, forges: 4, drops: 38, jelly: 912, hypes: 12, fives: 140, beers: 6, vinyls: 9 }, days: Array.from({ length: 40 }, (_, i) => new Date(now - i * D).toISOString().slice(0, 10)) }));
    localStorage.setItem('shelf-v1', JSON.stringify(outfits.map((p, i) => ({ id: 'cqa' + i, kind: i % 5 === 4 ? 'emoji' : 'banana', params: p, shareId: null, created: now - i * 3600000, made: now - i * 3600000 }))));
    localStorage.setItem('ps-notices-v1', JSON.stringify([
      { id: 'qa-n1', icon: '🖼', text: '<b>“Party Peel” made the gallery!</b> The banana guy hung it up — it has its own page now.', link: '/banana-memes/', at: now - 3600000, read: false },
      { id: 'news-farm-2026-09', icon: '🐔', text: 'The homestead is a farm now: hens, goats, sheep, a cow and a dog, a kitchen you watch, a tailor for the wool, and a family tree. Tap the blank sign to claim yours.', link: '/homestead/', at: now - 27 * D, read: true },
      { id: 'seed-drop-2808', icon: '🍓', text: '<b>New seeds at the park!</b> Carrot, strawberry, sweetcorn and rare watermelon are in the seed list now.', link: '/park/', at: now - 32 * D, read: true },
    ]));
    if (member) localStorage.setItem('bb-member', JSON.stringify({ t: 'sup-t1', until: now + 10 * D }));
    if (logged) localStorage.setItem('pass-link', JSON.stringify({ credId: 'm:qa-rich', token: 'qa-token' }));
  }, [GID, member, logged, OUTFITS]);
  await page.goto('/pass/');
  await page.waitForTimeout(2200);
  return errs;
}
