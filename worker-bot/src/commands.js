// 💬 THE SLASH COMMANDS — what anybody in the server can ask the notice board. Each answers from the world's public facts,
// in BananaBOT's own words (src/data/copy/bananabot.json); none of them knows anything about letters.
import W from '../../src/data/copy/bananabot.json' with { type: 'json' };
import { reply, links } from './discord.js';
import { counts, square, cursed, citizens, boards, today, remix, GAMES, LINKS, passCode, passCard, passUnlink, yardOf } from './world.js';

export const YELLOW = 0xffe135;
export const fill = (s, v) => String(s || '').replace(/\{(\w+)\}/g, (m, k) => (v && v[k] != null ? String(v[k]) : m));
export const pick = (list, rand = Math.random) => (Array.isArray(list) && list.length ? list[Math.floor(rand() * list.length)] : '');
const bold = (s) => '**' + String(s).replace(/\*/g, '') + '**';

/** The commands as Discord registers them (a guild's own list, so a change shows at once). */
export function definitions() {
  const C = W.commands;
  return [
    { name: 'world', description: C.world, type: 1 },
    { name: 'today', description: C.today, type: 1 },
    { name: 'top', description: C.top, type: 1, options: [{ type: 3, name: 'game', description: C.topGame, required: false,
      choices: Object.entries(GAMES).map(([value, name]) => ({ name, value })) }] },
    { name: 'citizens', description: C.citizens, type: 1 },
    { name: 'dance', description: C.dance, type: 1 },
    { name: 'trivia', description: C.trivia, type: 1 },
    { name: 'me', description: C.me, type: 1, options: [{ type: 5, name: 'private', description: C.mePrivate, required: false }] },
    { name: 'link', description: C.link, type: 1 },
    { name: 'unlink', description: C.unlink, type: 1 },
    { name: 'help', description: C.help, type: 1 },
  ];
}

const enter = () => links([{ label: W.world.enter, url: LINKS.town }]);

export async function world(env) {
  const [c, sq] = await Promise.all([counts(env), square(env)]);
  const t = today();
  const n = (x) => (x == null ? '–' : String(x));
  const all = [c.rave, c.park, c.bay, c.town];
  const nobody = all.every((x) => x === 0);
  return reply({
    embeds: [{
      color: YELLOW, title: W.world.title,
      description: [nobody ? W.world.empty : '', cursed(sq) ? W.world.cursed : W.world.plain, fill(W.world.today, { outfit: t.words })].filter(Boolean).join('\n'),
      fields: [['rave', c.rave], ['park', c.park], ['bay', c.bay], ['town', c.town]].map(([k, v]) => ({ name: W.world[k], value: n(v), inline: true })),
    }],
    components: [enter()],
  });
}

export function todayCard() {
  const t = today();
  return reply({
    embeds: [{ color: YELLOW, title: W.today.title, description: fill(W.today.line, { outfit: t.words }), image: { url: t.image } }],
    components: [links([{ label: W.today.button, url: t.page }])],
  });
}

export async function top(env, game) {
  const g = GAMES[game] ? game : '';
  const b = await boards(env, g || undefined);
  const lines = [];
  if (g) {
    const board = b[g];
    if (!board || !board.top.length) lines.push(W.top.nobody);
    else board.top.slice(0, 5).forEach((t, i) => lines.push((i + 1) + '. ' + bold(t.n) + ' · ' + t.s));
  } else {
    for (const [id, name] of Object.entries(GAMES)) {
      const t = b[id] && b[id].top[0];
      lines.push(bold(name) + ' · ' + (t ? fill(W.top.leader, { name: t.n, score: t.s }) : W.top.empty));
    }
  }
  return reply({
    embeds: [{ color: YELLOW, title: g ? GAMES[g] : W.top.title, description: lines.join('\n') }],
    components: [links([{ label: W.top.button, url: LINKS.arcade }])],
  });
}

export async function citizensCard(env) {
  const c = await citizens(env);
  const P = W.citizens.plaques;
  const order = ['citizen', 'gardener', 'neighbour', 'farmer', 'raver'];
  const lines = c && Object.keys(c.winners).length
    ? order.filter((p) => c.winners[p]).map((p) => bold(P[p] || p) + ' · ' + c.winners[p])
    : [W.citizens.empty];
  if (c && c.leaders.length) lines.push('', fill(W.citizens.leaders, { names: c.leaders.join(', ') }));
  return reply({
    embeds: [{ color: YELLOW, title: W.citizens.title, description: lines.join('\n') }],
    components: [links([{ label: W.citizens.button, url: LINKS.citizens }])],
  });
}

export function dance(rand) {
  const r = remix(rand);
  return reply({
    embeds: [{ color: YELLOW, title: r.title, url: r.page, description: fill(pick(W.dance.lines, rand), { title: r.title }), image: { url: r.gif } }],
    components: [links([{ label: W.dance.button, url: LINKS.remixes }])],
  });
}

// 🔗 /link: a one-time code, shown only to the one who asked, and the button that redeems it on their own pass page
export async function link(env, user) {
  const code = await passCode(env, user.id, user.name);
  if (!code) return reply({ content: W.link.error }, true);
  return reply({ content: fill(W.link.line, { code: '**' + code + '**' }), components: [links([{ label: W.link.button, url: LINKS.site + '/pass/?discord=' + code }])] }, true);
}
// 🍌 /me: the linked pass's public card, and its homestead when it has one (everyone sees it unless they ask otherwise)
export async function me(env, user, quietly) {
  const r = await passCard(env, user.id);
  if (!r) return reply({ content: W.me.error }, true);
  if (!r.linked || !r.card) return reply({ content: W.me.notLinked }, true);
  const c = r.card;
  const y = c.tag ? await yardOf(env, c.tag) : null;
  const fields = [
    { name: W.me.level, value: c.level + ' · ' + c.title, inline: true },
    { name: W.me.days, value: String(c.days), inline: true },
    { name: W.me.badges, value: String(c.badges), inline: true },
    { name: W.me.made, value: String(c.made), inline: true },
  ];
  if (y) fields.push({ name: W.me.home, value: (y.name || y.slug) + ' · ' + (W.me.stages[y.stage] || W.me.stages[0]), inline: false });
  return reply({ embeds: [{ color: YELLOW, title: c.name, fields }], components: y ? [links([{ label: W.me.visit, url: LINKS.site + '/homestead/' + y.slug + '/' }])] : [] }, quietly);
}
export async function unlink(env, user) {
  const r = await passUnlink(env, user.id);
  return reply({ content: !r ? W.me.error : r.was ? W.unlink.done : W.unlink.none }, true);
}

export function help() {
  return reply({ embeds: [{ color: YELLOW, title: W.help.title, description: W.help.lines.join('\n') }], components: [enter()] }, true);
}
