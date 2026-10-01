// 🍌📌 BANANABOT — Banana World's helper in the Discord (Trym, 30 Sep – 1 Oct 2026: "a fun assistant in text chat … stats,
// highscores, and information about the world … and ofcourse world events posts", "with a profile image and
// personality", "always on", "add the weekly poll and trivia"). It keeps the notice board in Banana Town and carries
// its news to the Discord.
//
//   POST /interactions   Discord's slash commands and buttons (signed by Discord; anything unsigned is a 401)
//   GET  /health         alive, and whether the gateway is meant to be on
//   GET  /stats          HQ's card (X-Bot-Token, through worker-contact's proxy — a wrong token is a 404)
//   POST /admin/*        tools/discord.mjs: channels, the gateway, a post now (X-Admin-Token — a wrong one is a 404)
//   cron                 every few minutes: the world's news, a closed poll read back, the connection kept up
//
// ⚠️ IT NEVER TALKS ABOUT LETTERS (Trym, 1 Oct: talking about users' letters could read as reading them): no route
// here reads the post, and the brain is told to step round the topic.
import { verify, json, reply, followup, PING, PONG, COMMAND, COMPONENT } from './discord.js';
import * as cmd from './commands.js';
export { BotRoom } from './bot-room.js';

const room = (env) => env.BOT.get(env.BOT.idFromName('bananabot'));
const ask = (env, path, body) => room(env).fetch(new Request('https://bot' + path, { method: 'POST', body: JSON.stringify(body || {}) }));
const same = (a, b) => !!a && !!b && String(a).trim() === String(b).trim();

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const p = url.pathname;

    if (p === '/interactions' && request.method === 'POST') {
      const v = await verify(request, env.DISCORD_PUBLIC_KEY);
      if (!v.ok) return new Response('bad signature', { status: 401 });
      let i = {};
      try { i = JSON.parse(v.body); } catch (e) { return new Response('bad body', { status: 400 }); }
      if (i.type === PING) return json({ type: PONG });
      if (i.type === COMMAND) {
        const name = String((i.data && i.data.name) || '');
        ctx.waitUntil(ask(env, '/count', { k: 'cmd_' + name }).catch(() => {}));
        if (name === 'trivia') return json(await (await ask(env, '/trivia')).json());
        const opt = ((i.data && i.data.options) || []).find((o) => o.name === 'game');
        const u = (i.member && i.member.user) || i.user || {};
        const user = { id: String(u.id || ''), name: String((i.member && i.member.nick) || u.global_name || u.username || '').slice(0, 40) };
        if (name === 'link') return json(await cmd.link(env, user));
        if (name === 'unlink') return json(await cmd.unlink(env, user));
        if (name === 'me') return json(await cmd.me(env, user, !!(((i.data && i.data.options) || []).find((o) => o.name === 'private') || {}).value));
        const out = name === 'world' ? await cmd.world(env)
          : name === 'today' ? cmd.todayCard()
            : name === 'top' ? await cmd.top(env, opt && opt.value)
              : name === 'citizens' ? await cmd.citizensCard(env)
                : name === 'dance' ? cmd.dance()
                  : cmd.help();
        return json(out);
      }
      if (i.type === COMPONENT && String((i.data && i.data.custom_id) || '').startsWith('tv:')) {
        const user = ((i.member && i.member.user) || i.user || {}).id;
        const o = await (await ask(env, '/answer', { id: i.data.custom_id, user })).json();
        if (o.private) ctx.waitUntil(followup(env.DISCORD_APP_ID, i.token, { content: o.private, flags: 64 }).catch(() => {}));
        return json(o.response);
      }
      return json(reply({ content: '…' }, true));
    }

    if (p === '/health') return json({ ok: true, gateway: String(env.GATEWAY_ON || '') === '1' });

    if (p === '/stats') {
      if (!same(request.headers.get('X-Bot-Token'), env.BOT_STATS_TOKEN)) return new Response('nope', { status: 404 });
      return ask(env, '/stats');
    }

    if (p.startsWith('/admin/') && request.method === 'POST') {
      if (!same(request.headers.get('X-Admin-Token'), env.BOT_ADMIN_TOKEN)) return new Response('nope', { status: 404 });
      const sub = p.slice('/admin'.length);
      if (!['/config', '/gateway', '/post', '/tick', '/stats'].includes(sub)) return new Response('nope', { status: 404 });
      return room(env).fetch(new Request('https://bot' + sub, { method: 'POST', body: await request.text() }));
    }
    return new Response('not found', { status: 404 });
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(ask(env, '/tick').catch(() => {}));
  },
};
