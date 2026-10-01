// 📌 WHAT BANANABOT PINS ON ITS OWN — checked every few minutes by the cron: a Curse Night beginning, the Citizens of the
// Week crowned, a new name at the top of an Arcade board, a new Forge piece at the Banana Stand, the banana of the day in
// the morning, and the weekly poll on Monday. ⚠️ THE FIRST LOOK IS A BASELINE: the first time it runs it only notes where
// everything stands, so switching the bot on never posts a week of old news. Nothing about letters, ever.
import W from '../../src/data/copy/bananabot.json' with { type: 'json' };
import { fill, pick, YELLOW } from './commands.js';
import { links } from './discord.js';
import { square, cursed, citizens, boards, catalog, today, GAMES, LINKS } from './world.js';

export const MORNING = 9;                     // the banana of the day goes up at nine, Oslo time
export const POLL = { day: 'Mon', hour: 17, hours: 72 };

/** The wall clock in Oslo, where the world keeps its days. */
export function oslo(now) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Oslo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23' }).formatToParts(new Date(now));
  const g = (t) => (parts.find((x) => x.type === t) || {}).value;
  return { day: `${g('year')}-${g('month')}-${g('day')}`, hour: +g('hour'), minute: +g('minute'), weekday: g('weekday') };
}
/** ISO week of a YYYY-MM-DD day, as 2026-W40. */
export function isoWeek(day) {
  const d = new Date(day + 'T12:00:00Z');
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dow);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return t.getUTCFullYear() + '-W' + String(Math.ceil(((t - y0) / 86400000 + 1) / 7)).padStart(2, '0');
}

const P = () => W.posts;
const card = (title, description, extra = {}) => ({ embeds: [{ color: YELLOW, title, description, ...extra }] });

export const messages = {
  curse: () => ({ content: pick(P().curse), components: [links([{ label: P().buttonTown, url: LINKS.town }])] }),
  crowned: (c) => {
    const order = ['citizen', 'gardener', 'neighbour', 'farmer', 'raver'];
    const plaques = W.citizens.plaques;
    const lines = order.filter((p) => c.winners[p]).map((p) => '**' + (plaques[p] || p) + '** · ' + c.winners[p]);
    return { ...card(P().crownedTitle, [pick(P().crowned), '', ...lines].join('\n')), components: [links([{ label: W.citizens.button, url: LINKS.citizens }])] };
  },
  record: (g, t) => ({ content: fill(pick(P().record), { game: GAMES[g] || g, name: '**' + String(t.n).replace(/\*/g, '') + '**', score: t.s }) }),
  forge: (it) => ({
    content: it.by ? fill(P().forge, { item: '**' + it.title.replace(/\*/g, '') + '**', maker: it.by }) : fill(P().forgeAnon, { item: '**' + it.title.replace(/\*/g, '') + '**' }),
    components: [links([{ label: P().buttonStand, url: LINKS.stand }])],
  }),
  morning: () => {
    const t = today();
    return { ...card(W.today.title, [pick(P().morning), fill(W.today.line, { outfit: t.words })].join('\n'), { image: { url: t.image } }), components: [links([{ label: W.today.button, url: t.page }])] };
  },
  poll: (i) => {
    const item = (W.polls.items || [])[i % (W.polls.items || []).length];
    return {
      content: W.polls.intro,
      poll: { question: { text: item.q.slice(0, 300) }, answers: item.a.slice(0, 10).map((a) => ({ poll_media: { text: String(a).slice(0, 55) } })),
        duration: POLL.hours, allow_multiselect: false, layout_type: 1 },
    };
  },
};

/**
 * One look at the world. `st` is the bot's own memory of the last look (mutated and returned); `send(kind, message)`
 * posts to the news channel and answers { ok, id }. Returns what was posted.
 */
export async function checkEvents(env, st, now, send) {
  const first = !st.init;
  const done = [];
  const post = async (kind, m) => { const r = await send(kind, m); done.push({ kind, ok: !!(r && r.ok) }); return r; };

  // 🌑 a Curse Night begins (a hush is cosmetic and is not one)
  const sq = await square(env);
  if (sq) {
    const on = cursed(sq);
    if (on && !st.curseOn && !first) await post('curse', messages.curse());
    st.curseOn = on;
  }
  // 🏆 the Citizens of the Week crowned
  const c = await citizens(env);
  if (c && c.week) {
    if (st.citizensWeek && c.week !== st.citizensWeek && Object.keys(c.winners).length) await post('crowned', messages.crowned(c));
    st.citizensWeek = c.week;
  }
  // 🕹 a new name at the top of an Arcade board — a higher score than the last one seen (a wiped board just resets it)
  const b = await boards(env);
  st.tops = st.tops || {};
  for (const [g, board] of Object.entries(b)) {
    const t = board.top[0];
    if (!t) continue;
    const was = st.tops[g];
    if (was && !first && t.s > was.s) await post('record', messages.record(g, t));
    st.tops[g] = { n: t.n, s: t.s };
  }
  // 🧵 a new Forge piece at the Banana Stand (more than a handful at once is a resync, never news)
  const cat = await catalog(env);
  if (cat) {
    const seen = new Set(st.seen || []);
    const fresh = cat.filter((it) => !seen.has(it.id));
    if (st.seen && fresh.length && fresh.length <= 4) for (const it of fresh.slice(0, 2)) await post('forge', messages.forge(it));
    st.seen = cat.map((it) => it.id);
  }
  // 🍌 the banana of the day, in the morning — the first look marks today done only if the morning has already passed
  const o = oslo(now);
  const morning = o.hour >= MORNING;
  if (first) { if (morning) st.morningDay = o.day; }
  else if (morning && st.morningDay !== o.day) { await post('morning', messages.morning()); st.morningDay = o.day; }
  // 🗳 the weekly poll, Monday evening (its results are read back once it has closed) — the same baseline: a week whose
  // poll moment has already gone by is marked done, one whose moment is still to come gets its poll
  const wk = isoWeek(o.day);
  const DOW = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  const pollTime = o.weekday === POLL.day && o.hour >= POLL.hour;
  const pollPassed = pollTime || (DOW[o.weekday] || 0) > DOW[POLL.day];
  if (first) { if (pollPassed) st.pollWeek = wk; }
  else if (pollTime && st.pollWeek !== wk) {
    const i = st.pollNext || 0;
    const r = await post('poll', messages.poll(i));
    if (r && r.ok) { st.poll = { id: r.id, channel: r.channel, q: i, end: now + POLL.hours * 3600000 }; st.pollNext = i + 1; }
    st.pollWeek = wk;
  }
  st.init = 1;
  return done;
}

/** A closed poll's result, read from Discord: { q, total, answers: [{ text, count }] }, or null while it is open. */
export function pollResult(msg) {
  const p = msg && msg.poll;
  if (!p || !p.results || !p.results.is_finalized) return null;
  const count = Object.fromEntries((p.results.answer_counts || []).map((x) => [x.id, x.count]));
  const answers = (p.answers || []).map((a) => ({ text: String((a.poll_media && a.poll_media.text) || ''), count: count[a.answer_id] || 0 }));
  return { q: String((p.question && p.question.text) || ''), total: answers.reduce((t, a) => t + a.count, 0), answers };
}
