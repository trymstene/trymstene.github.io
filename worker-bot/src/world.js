// 🌍 WHAT BANANAWORLD LOOKS LIKE RIGHT NOW, read from the world's own workers through service bindings (a worker on
// workers.dev calling another one by its public address can be refused; a binding cannot). Public facts only: how
// many bananas are where, whether the square is cursed tonight, the boards, the plaques, the Banana Stand's catalog.
// ⚠️ NOTHING ABOUT LETTERS. Trym, 1 Oct 2026: "if we talk about users letters we are basically also saying we read the
// letters which we dont" — the post rooms are not read here, and nothing here may ever start to.
import { dailyOutfit, describeOutfit } from '../../src/lib/banana-daily.js';
import REMIXES from '../../src/data/remix-meta.json' with { type: 'json' };

const SITE = 'https://trymstene.com';
const ORIGIN = { Origin: SITE };
export const GAMES = { peelout: 'Peel Out', snake: 'Banana Snake', invaders: 'Banana Invaders', pong: 'Banana Pong', stack: 'Banana Stack' };

async function getJson(binding, url, headers) {
  try {
    const r = binding ? await binding.fetch(new Request(url, { headers })) : await fetch(url, { headers });
    return r.ok ? await r.json() : null;
  } catch (e) { return null; }
}

/** How many bananas are in each walkable place (a number each; null when a room did not answer). */
export async function counts(env) {
  const one = (p) => getJson(env.RAVE, 'https://banana-rave' + p, ORIGIN).then((j) => (j && Number.isFinite(+j.count) ? +j.count : null));
  const [rave, park, bay, town] = await Promise.all(['/count', '/park-count', '/beach-count', '/town-count'].map(one));
  return { rave, park, bay, town };
}

/** The square tonight: the curse clock's own word ('none' on a plain night) and whether it is dark. */
export async function square(env) {
  const j = await getJson(env.RAVE, 'https://banana-rave/town-life', ORIGIN);
  if (!j) return null;
  return { curse: String(j.curse || 'none'), night: !!(j.dark && j.dark.night), band: String(j.band || '') };
}
// a hush is cosmetic and writes nothing (worker-rave factNote): it is not a Curse Night worth a word
export const cursed = (sq) => !!sq && sq.curse !== 'none' && sq.curse !== 'hush';

/** The Citizens of the Week: the last crowned week's winners by plaque, and who leads this week so far. */
export async function citizens(env) {
  const j = await getJson(env.PASS, 'https://banana-pass/citizen', ORIGIN);
  if (!j) return null;
  const last = j.last || {};
  const winners = Object.fromEntries(Object.entries(last.winners || {}).filter(([, w]) => w && w.name).map(([p, w]) => [p, String(w.name)]));
  const live = j.live || {};
  return { week: last.week || '', winners, leaders: (live.citizen || []).map((x) => String((x && (x.name || x.n)) || '')).filter(Boolean).slice(0, 3) };
}

/** One Arcade board, or all five: { game: { name, top: [{ n, s }], players } }. */
export async function boards(env, only) {
  const ids = only ? [only] : Object.keys(GAMES);
  const got = await Promise.all(ids.map((g) => getJson(env.PASS, 'https://banana-pass/arcade/board?game=' + g, ORIGIN)));
  const out = {};
  ids.forEach((g, i) => {
    const b = got[i];
    if (b) out[g] = { name: GAMES[g], players: +b.players || 0, top: (b.top || []).filter((t) => t && t.n).map((t) => ({ n: String(t.n), s: +t.s || 0 })) };
  });
  return out;
}

/** The Banana Stand's community shelf: approved Forge pieces that are worn (homestead decor is not). */
export async function catalog(env) {
  const j = await getJson(env.SHARE, 'https://banana-share/catalog/items.json', ORIGIN);
  return Array.isArray(j) ? j.filter((it) => it && it.id && it.kind !== 'decor' && !it.retired).map((it) => ({ id: it.id, title: String(it.title || ''), by: String(it.by || ''), added: +it.added || 0 })) : null;
}

/** The banana of the day, the same one the site and the stream overlay show today (a UTC day). */
export function today(date = new Date()) {
  const o = dailyOutfit(date);
  const day = date.toISOString().slice(0, 10);
  return { day, outfit: o, words: describeOutfit(o), image: SITE + '/assets/daily/today.png?d=' + day, page: SITE + '/banana-of-the-day/' };
}

/** A dancing banana remix from the gallery: its GIF, its title and its page. */
export function remix(rand = Math.random) {
  const all = Array.isArray(REMIXES) ? REMIXES : Object.values(REMIXES);
  const r = all[Math.floor(rand() * all.length)] || all[0];
  return { title: String(r.title || 'A banana'), gif: SITE + '/assets/dancing-banana-community-remixes/' + r.id + '.gif', page: SITE + '/dancing-banana-remixes/' + r.slug + '/' };
}

// 🔗 A PASS AND A DISCORD ACCOUNT (worker-pass, its internal half — only this binding can reach it). The player links
// on their own pass page with a one-time code; the bot only ever sees the public card of a pass that chose to link.
const passJson = async (env, path, body) => {
  try {
    const r = await env.PASS.fetch(new Request('https://internal' + path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}));
    return r.ok ? await r.json() : null;
  } catch (e) { return null; }
};
export const passCode = (env, uid, name) => passJson(env, '/discord/code', { uid, name }).then((j) => (j && j.code) || null);
export const passCard = (env, uid) => passJson(env, '/discord/me?uid=' + encodeURIComponent(uid));
export const passUnlink = (env, uid) => passJson(env, '/discord/unlink', { uid });
/** The homestead whose owner tag is `tag` (the yards publish the same tag the pass card carries). */
export async function yardOf(env, tag) {
  const j = await getJson(env.RAVE, 'https://banana-rave/yards/stats', ORIGIN);
  const y = j && (j.list || []).find((x) => x && x.owner === tag);
  return y ? { slug: String(y.slug), name: String(y.name || ''), stage: +y.stage || 0 } : null;
}

export const LINKS = { site: SITE, town: SITE + '/town/', builder: SITE + '/make-a-banana/', stand: SITE + '/park/', arcade: SITE + '/town/', citizens: SITE + '/', remixes: SITE + '/dancing-banana-remixes/' };
