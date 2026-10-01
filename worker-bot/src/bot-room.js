// 🍌📌 BANANABOT'S ROOM — one Durable Object that is the bot: its memory (settings, counts, trivia rounds, what it last
// saw of the world), the scheduled posts, and — when it is switched on — the always-on connection to Discord's gateway
// that lets it hear people talk to it and greet whoever joins.
//
// ⚠️ THE CONNECTION RUNS ONLY WITH GATEWAY_ON = "1", AND ONLY ON WORKERS PAID. An open outbound socket cannot hibernate,
// so this object stays awake around the clock: ~10,800 GB-s a day, which on the free plan is most of the 13,000 the
// world's rooms share — and a free-plan Durable Object that runs out FAILS (the rave, the park, the town would stop).
// On Workers Paid it fits inside the included 400,000 GB-s a month. (Trym chose Paid, 1 Oct 2026.)
import W from '../../src/data/copy/bananabot.json' with { type: 'json' };
import { rest, quiet, reply, links, nameOf, json, UPDATE, EPHEMERAL } from './discord.js';
import { fill, pick, YELLOW } from './commands.js';
import * as trivia from './trivia.js';
import { checkEvents, pollResult, messages } from './events.js';
import { think, snapshot } from './brain.js';
import { counts, square, cursed, citizens, boards, today, LINKS } from './world.js';

const GATEWAY = 'https://gateway.discord.gg/?v=10&encoding=json';
// guilds · guild members (to welcome) · guild messages · message content (to read what is said to it)
export const INTENTS = (1 << 0) | (1 << 1) | (1 << 9) | (1 << 15);
const WATCH = 30000;                                    // the watchdog's beat while connected
const day = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);
// what a reply costs, at Haiku 4.5's prices (dollars per million tokens) — an estimate for HQ, never a bill
export const PRICE = { in: 1, out: 5 };

/** A message's words as a person reads them: mentions as names, custom emoji as :name:, nothing longer than a note. */
export function plain(m) {
  let t = String((m && m.content) || '');
  for (const u of (m && m.mentions) || []) t = t.split('<@' + u.id + '>').join('@' + (u.global_name || u.username)).split('<@!' + u.id + '>').join('@' + (u.global_name || u.username));
  return t.replace(/<a?(:\w+:)\d+>/g, '$1').replace(/<[@#&!]+\d+>/g, '').trim().slice(0, 500);
}

export class BotRoom {
  constructor(state, env) {
    this.state = state; this.env = env;
    this.ws = null; this.hb = null; this.seq = null; this.acked = true; this.lastAck = 0; this.me = null;
    this.live = ''; this.liveAt = 0; this.resuming = false;
  }
  get on() { return String(this.env.GATEWAY_ON || '') === '1' && !!this.env.DISCORD_TOKEN; }
  call() { return rest(this.env.DISCORD_TOKEN); }
  async get(k, d) { const v = await this.state.storage.get(k); return v === undefined ? d : v; }
  async put(k, v) { await this.state.storage.put(k, v); }

  // ── counts for HQ, one row a day, kept for two months ──────────────────────────────────────────────────────────
  async bump(field, n = 1) {
    const k = 'st:' + day();
    const s = await this.get(k, {});
    s[field] = (s[field] || 0) + n;
    await this.put(k, s);
  }
  async stats() {
    const rows = [...(await this.state.storage.list({ prefix: 'st:' })).entries()].map(([k, v]) => ({ d: k.slice(3), ...v })).sort((a, b) => (a.d < b.d ? -1 : 1));
    for (const r of rows.slice(0, Math.max(0, rows.length - 60))) await this.state.storage.delete('st:' + r.d);
    const use = [...(await this.state.storage.list({ prefix: 'use:' })).entries()].map(([k, v]) => ({ d: k.slice(4), ...v })).sort((a, b) => (a.d < b.d ? -1 : 1));
    const month = day().slice(0, 7);
    const m = use.filter((u) => u.d.startsWith(month)).reduce((t, u) => ({ n: t.n + (u.n || 0), in: t.in + (u.in || 0), out: t.out + (u.out || 0) }), { n: 0, in: 0, out: 0 });
    const cfg = await this.get('cfg', {});
    const gw = await this.get('gw', {});
    return {
      gateway: { on: this.on, connected: !!this.ws, lastAck: this.lastAck || 0, ready: gw.ready || 0, reconnects: gw.reconnects || 0 },
      days: rows.slice(-30), usage: { today: use.find((u) => u.d === day()) || { n: 0, in: 0, out: 0 }, month: m,
        dollars: Math.round(((m.in * PRICE.in + m.out * PRICE.out) / 1e6) * 100) / 100, cap: +this.env.DAILY_CAP || 80 },
      channels: { news: !!cfg.news, welcome: !!(cfg.welcome || cfg.system), guild: cfg.guildName || '' },
      polls: await this.get('polls', []),
      model: String(this.env.CLAUDE_MODEL || '') || 'claude-haiku-4-5',
    };
  }

  // ── the HTTP side: the router asks, the room answers ───────────────────────────────────────────────────────────
  async fetch(request) {
    const url = new URL(request.url);
    const p = url.pathname;
    let b = {};
    if (request.method === 'POST') { try { b = (await request.json()) || {}; } catch (e) { b = {}; } }

    if (p === '/count') { await this.bump(String(b.k || 'other').slice(0, 40)); return json({ ok: 1 }); }

    if (p === '/trivia') {
      const recent = await this.get('tv:recent', []);
      const round = trivia.newRound(recent);
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      await this.put('tv:r:' + id, { ...round, at: Date.now() });
      await this.put('tv:recent', [round.q, ...recent].slice(0, trivia.TRIVIA.RECENT));
      const all = [...(await this.state.storage.list({ prefix: 'tv:r:' })).keys()].sort();
      for (const k of all.slice(0, Math.max(0, all.length - trivia.TRIVIA.KEEP))) await this.state.storage.delete(k);
      await this.bump('trivia_asked');
      return json(reply(trivia.card(id, round)));
    }
    if (p === '/answer') {
      const [, id, k] = String(b.id || '').split(':');
      const user = String(b.user || '');
      const round = await this.get('tv:r:' + id, null);
      const res = trivia.answer(round, user, +k);
      if (res.gone) return json({ response: reply({ content: W.trivia.gone }, true) });
      if (res.again) return json({ response: reply({ content: W.trivia.again }, true) });
      await this.put('tv:r:' + id, round);
      let line = res.line;
      if (res.right) {
        const score = (await this.get('tv:u:' + user, 0)) + 1;
        await this.put('tv:u:' + user, score);
        line += ' ' + fill(W.trivia.score, { score });
      }
      await this.bump(res.right ? 'trivia_right' : 'trivia_wrong');
      return json({ response: { type: UPDATE, data: trivia.card(id, round) }, private: line });
    }

    if (p === '/tick') { await this.tick(); return json({ ok: 1 }); }
    if (p === '/stats') return json(await this.stats());
    if (p === '/config') {
      const cfg = await this.get('cfg', {});
      for (const k of ['news', 'welcome']) if (k in b) cfg[k] = /^\d{5,25}$/.test(String(b[k])) ? String(b[k]) : '';
      if ('welcomeOff' in b) cfg.welcomeOff = !!b.welcomeOff;
      if ('guild' in b) cfg.guild = /^\d{5,25}$/.test(String(b.guild)) ? String(b.guild) : cfg.guild;
      await this.put('cfg', cfg);
      return json({ ok: 1, cfg });
    }
    if (p === '/gateway') {
      if (b.start && this.on) { await this.connect(); await this.state.storage.setAlarm(Date.now() + WATCH); }
      if (b.stop) this.drop(false);
      return json({ on: this.on, connected: !!this.ws, me: this.me ? this.me.username : null });
    }
    if (p === '/post') {   // an admin's "post this now" for the scheduled kinds (the morning banana, a poll)
      const st = await this.get('ev', {});
      const kind = String(b.kind || '');
      if (!['morning', 'poll'].includes(kind)) return json({ ok: 0, err: 'kind' }, 400);
      const r = await this.send(kind, kind === 'poll' ? messages.poll(st.pollNext || 0) : messages.morning());
      if (kind === 'poll' && r.ok) { st.poll = { id: r.id, channel: r.channel, q: st.pollNext || 0, end: Date.now() + 72 * 3600000 }; st.pollNext = (st.pollNext || 0) + 1; await this.put('ev', st); }
      return json(r);
    }
    return json({ err: 'nope' }, 404);
  }

  /** Post to the news channel (none set: nothing is posted, and the event still counts as seen). */
  async send(kind, message) {
    const cfg = await this.get('cfg', {});
    if (!cfg.news) return { ok: false, err: 'no channel' };
    const r = await this.call()('POST', '/channels/' + cfg.news + '/messages', { allowed_mentions: quiet(), ...message });
    if (r.ok) await this.bump('post_' + kind);
    return { ok: r.ok, id: r.json && r.json.id, channel: cfg.news, status: r.status };
  }

  // ── the cron's beat: the world's news, a closed poll read back, and the connection kept up ──────────────────────
  async tick() {
    const st = await this.get('ev', {});
    try { await checkEvents(this.env, st, Date.now(), (kind, m) => this.send(kind, m)); } catch (e) { /* a quiet beat */ }
    if (st.poll && !st.poll.done && Date.now() > st.poll.end + 120000) {
      const r = await this.call()('GET', '/channels/' + st.poll.channel + '/messages/' + st.poll.id);
      const res = r.ok ? pollResult(r.json) : null;
      if (res || r.status === 404) {
        st.poll.done = 1;
        if (res) await this.put('polls', [{ ...res, at: Date.now() }, ...(await this.get('polls', []))].slice(0, 12));
      }
    }
    await this.put('ev', st);
    if (this.on && !this.ws) { await this.connect(); await this.state.storage.setAlarm(Date.now() + WATCH); }
  }

  // ── the gateway: the always-on half ───────────────────────────────────────────────────────────────────────────
  async connect() {
    if (!this.on || this.ws) return;
    const gw = await this.get('gw', {});
    this.resuming = !!(gw.session && gw.seq != null);
    let resp = null;
    try { resp = await fetch((this.resuming && gw.resume ? gw.resume.replace(/^wss:/, 'https:') + '/?v=10&encoding=json' : GATEWAY), { headers: { Upgrade: 'websocket' } }); } catch (e) { resp = null; }
    const ws = resp && resp.webSocket;
    if (!ws) return;
    ws.accept();
    this.ws = ws; this.acked = true; this.lastAck = Date.now();
    ws.addEventListener('message', (ev) => { this.onGateway(ev.data).catch(() => {}); });
    ws.addEventListener('close', () => { if (this.ws === ws) this.drop(true); });
    ws.addEventListener('error', () => { if (this.ws === ws) this.drop(true); });
  }
  drop(resume) {
    if (this.hb) { clearInterval(this.hb); this.hb = null; }
    const ws = this.ws;
    this.ws = null;
    // ⚠️ 4000, not 1000: closing with 1000 ends the session, and then there is nothing to resume
    try { if (ws) ws.close(resume ? 4000 : 1000, resume ? 'reconnect' : 'off'); } catch (e) {}
    if (!resume) this.state.storage.delete('gw').catch(() => {});
  }
  sendGw(o) { try { if (this.ws) this.ws.send(JSON.stringify(o)); } catch (e) {} }
  beat() {
    if (!this.acked) { this.drop(true); return; }   // no answer to the last beat: a zombie connection, start again
    this.acked = false;
    this.sendGw({ op: 1, d: this.seq });
  }
  async onGateway(data) {
    let m;
    try { m = JSON.parse(data); } catch (e) { return; }
    if (m.s != null) this.seq = m.s;
    if (m.op === 10) {
      const every = +(m.d && m.d.heartbeat_interval) || 41250;
      if (this.hb) clearInterval(this.hb);
      setTimeout(() => this.beat(), Math.floor(every * Math.random()));
      this.hb = setInterval(() => this.beat(), every);
      const gw = await this.get('gw', {});
      if (this.resuming && gw.session) this.sendGw({ op: 6, d: { token: this.env.DISCORD_TOKEN, session_id: gw.session, seq: gw.seq } });
      else this.sendGw({ op: 2, d: { token: this.env.DISCORD_TOKEN, intents: INTENTS, properties: { os: 'linux', browser: 'bananabot', device: 'bananabot' },
        presence: { since: null, status: 'online', afk: false, activities: [{ name: 'Custom Status', type: 4, state: W.presence }] } } });
      return;
    }
    if (m.op === 11) { this.acked = true; this.lastAck = Date.now(); return; }
    if (m.op === 1) { this.sendGw({ op: 1, d: this.seq }); return; }
    if (m.op === 7) { this.drop(true); return; }                                   // Discord asks for a reconnect
    if (m.op === 9) { if (!m.d) await this.state.storage.delete('gw'); this.resuming = false; this.drop(!!m.d); return; }
    if (m.op === 0) await this.dispatch(m.t, m.d);
  }
  async dispatch(t, d) {
    if (t === 'READY') {
      this.me = d.user;
      const gw = await this.get('gw', {});
      await this.put('gw', { session: d.session_id, resume: d.resume_gateway_url, seq: this.seq, ready: Date.now(), reconnects: (gw.reconnects || 0) + (gw.ready ? 1 : 0), me: d.user && d.user.id });
      return;
    }
    if (t === 'RESUMED') { const gw = await this.get('gw', {}); this.me = this.me || (gw.me ? { id: gw.me } : null); return; }
    if (t === 'GUILD_CREATE') {
      const cfg = await this.get('cfg', {});
      cfg.guild = cfg.guild || d.id; cfg.guildName = d.name || cfg.guildName; cfg.system = d.system_channel_id || cfg.system || '';
      await this.put('cfg', cfg);
      return;
    }
    if (t === 'GUILD_MEMBER_ADD') { await this.welcome(d); return; }
    if (t === 'MESSAGE_CREATE') await this.chat(d);
  }

  async welcome(d) {
    if (!d || !d.user || d.user.bot) return;
    const cfg = await this.get('cfg', {});
    const ch = cfg.welcome || cfg.system;
    if (!ch || cfg.welcomeOff) return;
    await this.call()('POST', '/channels/' + ch + '/messages', {
      content: fill(pick(W.welcome.lines), { name: '<@' + d.user.id + '>' }),
      components: [links([{ label: W.welcome.button, url: LINKS.town }])], allowed_mentions: quiet([d.user.id]),
    });
    await this.bump('welcome');
  }

  async liveText() {
    if (this.live && Date.now() - this.liveAt < 60000) return this.live;
    const [c, sq, ci, b] = await Promise.all([counts(this.env), square(this.env), citizens(this.env), boards(this.env)]);
    this.live = snapshot({ counts: c, square: sq ? { cursed: cursed(sq) } : null, today: today(), citizens: ci, boards: b });
    this.liveAt = Date.now();
    return this.live;
  }

  /** Somebody spoke to BananaBOT: a mention, or a reply to one of its messages. Claude writes the answer. */
  async chat(d) {
    const meId = (this.me && this.me.id) || (await this.get('gw', {})).me;
    if (!meId || !d || !d.author || d.author.bot || !d.guild_id) return;
    const mentioned = (d.mentions || []).some((u) => u.id === meId);
    const toMe = d.referenced_message && d.referenced_message.author && d.referenced_message.author.id === meId;
    if (!mentioned && !toMe) return;
    const call = this.call();
    const say = (content) => call('POST', '/channels/' + d.channel_id + '/messages', {
      content, message_reference: { message_id: d.id, fail_if_not_exists: false }, allowed_mentions: quiet([d.author.id]),
    });
    const now = Date.now();
    const useKey = 'use:' + day(now);
    const use = await this.get(useKey, { n: 0, in: 0, out: 0 });
    // the day's cap: said once, then quiet until tomorrow
    if (use.n >= (+this.env.DAILY_CAP || 80)) {
      if (!use.capSaid) { use.capSaid = 1; await this.put(useKey, use); await say(W.chat.cap); }
      return;
    }
    // each person's share: said once per hour they run past it
    const rlKey = 'rl:' + d.author.id;
    const rl = (await this.get(rlKey, [])).filter((t) => now - t < 3600000);
    if (rl.length >= (+this.env.USER_CAP || 8)) {
      const saidAt = await this.get(rlKey + ':said', 0);
      if (now - saidAt > 3600000) { await this.put(rlKey + ':said', now); await say(fill(W.chat.slow, { name: nameOf(d.member, d.author) })); }
      return;
    }
    call('POST', '/channels/' + d.channel_id + '/typing').catch(() => {});
    const hist = await call('GET', '/channels/' + d.channel_id + '/messages?limit=10');
    const msgs = (hist.ok && Array.isArray(hist.json) ? hist.json : []).filter((m) => m.id !== d.id && now - Date.parse(m.timestamp) < 30 * 60000).reverse();
    const chat = [...msgs, d].map((m) => ({ who: nameOf(m.member, m.author), bot: !!(m.author && m.author.id === meId), text: plain(m) })).filter((m) => m.text);
    const res = await think(this.env, chat, await this.liveText());
    if (!res) { await say(W.chat.error); await this.bump('chat_error'); return; }
    await say(res.text);
    use.n += 1; use.in += res.usage.in; use.out += res.usage.out;
    await this.put(useKey, use);
    await this.put(rlKey, [...rl, now]);
    await this.bump('chat');
  }

  // ── the watchdog: while switched on, keep the connection alive; switched off, let it go and stop beating ────────
  async alarm() {
    if (!this.on) { this.drop(false); return; }
    if (!this.ws || (this.lastAck && Date.now() - this.lastAck > 4 * WATCH)) { this.drop(true); await this.connect(); }
    else { const gw = await this.get('gw', {}); if (gw.session) await this.put('gw', { ...gw, seq: this.seq }); }
    await this.state.storage.setAlarm(Date.now() + WATCH);
  }
}
