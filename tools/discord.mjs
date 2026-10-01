// 🍌📌 BANANABOT AND THE DISCORD SERVER, FROM HERE (1 Oct 2026). Trym: "it would be great if i can administrate the
// discord server through prompting here" — he asks Claude Code in plain words, Claude runs these. The keys come from
// tools/discord.local.json (git-ignored) and are never printed.
//
// ⚠️ A DESTRUCTIVE OR PUBLIC STEP NEEDS --yes, and Claude passes --yes only after Trym has said yes to that very step:
// deleting a message or a channel, a kick, a ban, a timeout, and anything posted where people will read it.
//
// The bot
//   deploy                     keys → banana-bot's secrets, deploy worker-bot, point Discord's interactions at it
//   invite                     the link that adds BananaBOT to a server (Administrator)
//   avatar                     set its picture (worker-bot/avatar.png, drawn by tools/build-bot-avatar.py)
//   commands                   register the slash commands in every server the bot is in
//   status                     who the bot is, its servers, its endpoint, the gateway, today's counts
//   gateway on|off             the always-on connection (ONLY on Workers Paid — see worker-bot/src/bot-room.js)
//   news <channel>             where its posts go          welcome <channel>|off   where it greets newcomers
//   post morning|poll --yes    the banana of the day / this week's poll, now
//   tick                       run the scheduled look at the world now
// The server
//   channels · roles · members [query]
//   say <channel> <text> --yes            edit <channel> <message id> <text> --yes   (both: --from <post.md>; say: --file <png>)
//   pin|unpin <channel> <message id>      delete-message <channel> <message id> --yes
//   create-channel <name> [--category <name>] [--topic <text>] [--voice]
//   rename-channel <channel> <name>       topic <channel> <text>       slowmode <channel> <seconds>
//   lock <channel> --yes · unlock <channel> --yes      delete-channel <channel> --yes
//   create-role <name> [--color #rrggbb] [--hoist] [--mentionable]
//   give-role <member> <role> · take-role <member> <role>
//   timeout <member> <minutes> [reason] --yes · untimeout <member>
//   kick <member> [reason] --yes · ban <member> [reason] --yes · unban <user id> --yes
//   api <METHOD> <path> [json] [--yes]    anything else in Discord's API (a write needs --yes)
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const KEYS = join(ROOT, 'tools', 'discord.local.json');
const WORKER = join(ROOT, 'worker-bot');
const BOT_URL = 'https://banana-bot.trymstene.workers.dev';
const API = 'https://discord.com/api/v10';
const args = process.argv.slice(2);
const YES = args.includes('--yes');
const flag = (name) => { const i = args.indexOf('--' + name); return i > -1 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : undefined; };
const pos = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--') && !['--yes', '--voice', '--hoist', '--mentionable'].includes(args[i - 1])));

let keys;
try { keys = JSON.parse(readFileSync(KEYS, 'utf8')); } catch (e) { console.error('no tools/discord.local.json — fill it first'); process.exit(1); }
const token = String(keys.botToken || '').trim();
if (!token) { console.error('tools/discord.local.json has no botToken'); process.exit(1); }

async function dc(method, path, body, reason) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const headers = { Authorization: 'Bot ' + token, 'User-Agent': 'DiscordBot (https://trymstene.com, 1.0)' };
    const form = body instanceof FormData;   // a message with a picture goes as multipart (withFiles)
    if (body != null && !form) headers['Content-Type'] = 'application/json';
    if (reason) headers['X-Audit-Log-Reason'] = encodeURIComponent(String(reason).slice(0, 400));
    const r = await fetch(API + path, { method, headers, body: body == null ? undefined : form ? body : JSON.stringify(body) });
    if (r.status === 429 && attempt < 2) { const j = await r.json().catch(() => ({})); await new Promise((ok) => setTimeout(ok, Math.ceil((+j.retry_after || 1) * 1000))); continue; }
    const text = await r.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch (e) { json = text; }
    if (!r.ok) throw new Error(method + ' ' + path + ' → ' + r.status + ' ' + JSON.stringify(json).slice(0, 300));
    return json;
  }
  throw new Error('rate limited');
}

function wrangler(cmdArgs, stdin) {
  return new Promise((ok, fail) => {
    const win = process.platform === 'win32';
    const p = win
      ? spawn(['npx.cmd', 'wrangler', ...cmdArgs].map((a) => (/\s/.test(a) ? '"' + a + '"' : a)).join(' '), { cwd: WORKER, shell: true, stdio: [stdin == null ? 'ignore' : 'pipe', 'pipe', 'pipe'] })
      : spawn('npx', ['wrangler', ...cmdArgs], { cwd: WORKER, stdio: [stdin == null ? 'ignore' : 'pipe', 'pipe', 'pipe'] });
    let out = '', err = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { err += d; });
    if (stdin != null) { p.stdin.write(stdin); p.stdin.end(); }   // no newline: a CRLF would ride into the secret
    p.on('error', fail);
    p.on('close', (code) => (code === 0 ? ok(out) : fail(new Error('wrangler ' + cmdArgs.slice(0, 2).join(' ') + ' failed: ' + err.split('\n').filter((l) => l.trim()).slice(-2).join(' ').slice(0, 240)))));
  });
}
// the bot's own admin routes (X-Admin-Token, a key this script made and keeps in tools/discord.local.json)
async function bot(path, body) {
  const r = await fetch(BOT_URL + '/admin' + path, { method: 'POST', headers: { 'X-Admin-Token': String(keys.adminToken || ''), 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
  const text = await r.text();
  if (!r.ok) throw new Error('the bot said ' + r.status + (r.status === 404 ? ' (is it deployed, and is adminToken its BOT_ADMIN_TOKEN?)' : ''));
  try { return JSON.parse(text); } catch (e) { return text; }
}

// ── finding things by name ────────────────────────────────────────────────────────────────────────────────────────
let GUILD = null;
async function guild() {
  if (GUILD) return GUILD;
  const gs = await dc('GET', '/users/@me/guilds');
  if (!gs.length) throw new Error('BananaBOT is in no server yet — run `node tools/discord.mjs invite` and add it');
  GUILD = gs[0];
  return GUILD;
}
const norm = (s) => String(s || '').toLowerCase().replace(/^#/, '').replace(/[^a-z0-9À-￿]+/g, '');
// a message and its pictures as Discord's multipart: the JSON part names each file it carries
function withFiles(payload, files) {
  const fd = new FormData();
  fd.append('payload_json', JSON.stringify({ ...payload, attachments: files.map((f, i) => ({ id: i, filename: basename(f) })) }));
  files.forEach((f, i) => fd.append('files[' + i + ']', new Blob([readFileSync(f)], { type: /\.png$/i.test(f) ? 'image/png' : /\.jpe?g$/i.test(f) ? 'image/jpeg' : 'application/octet-stream' }), basename(f)));
  return fd;
}
// a post's words: from --from <file> (a long announcement keeps its line breaks), else the rest of the command line
function words(rest) {
  const from = flag('from');
  const text = typeof from === 'string' ? readFileSync(from, 'utf8').replace(/\r\n/g, '\n').trim() : rest.join(' ');
  if (text.length > 2000) throw new Error('Discord takes 2000 characters in a message; this is ' + text.length);
  return text;
}

async function channel(ref) {
  const g = await guild();
  const all = await dc('GET', '/guilds/' + g.id + '/channels');
  const c = all.find((x) => x.id === String(ref).replace(/[<#>]/g, '')) || all.find((x) => norm(x.name) === norm(ref));
  if (!c) throw new Error('no channel called ' + ref);
  return c;
}
async function role(ref) {
  const g = await guild();
  const all = await dc('GET', '/guilds/' + g.id + '/roles');
  const r = all.find((x) => x.id === String(ref).replace(/[<@&>]/g, '')) || all.find((x) => norm(x.name) === norm(ref));
  if (!r) throw new Error('no role called ' + ref);
  return r;
}
async function member(ref) {
  const g = await guild();
  const id = String(ref).replace(/[<@!>]/g, '');
  if (/^\d{5,25}$/.test(id)) return dc('GET', '/guilds/' + g.id + '/members/' + id);
  const found = await dc('GET', '/guilds/' + g.id + '/members/search?limit=5&query=' + encodeURIComponent(String(ref).replace(/^@/, '')));
  if (found.length !== 1) throw new Error(found.length ? 'more than one member matches ' + ref + ': ' + found.map((m) => m.user.username).join(', ') : 'no member called ' + ref);
  return found[0];
}
const who = (m) => (m.nick || m.user.global_name || m.user.username) + ' (' + m.user.username + ', ' + m.user.id + ')';
function needYes(what) {
  if (YES) return true;
  console.log('⏸  ' + what + '\n   Not done: this step needs --yes, given only after Trym has said yes to it.');
  return false;
}

// ── the commands ─────────────────────────────────────────────────────────────────────────────────────────────────
const C = {
  async deploy() {
    let changed = false;
    if (!keys.adminToken) { keys.adminToken = randomBytes(24).toString('hex'); changed = true; }
    if (!keys.statsToken) { keys.statsToken = randomBytes(24).toString('hex'); changed = true; }
    if (changed) writeFileSync(KEYS, JSON.stringify(keys, null, 2) + '\n');
    const app = await dc('GET', '/applications/@me');
    if (app.id !== String(keys.appId).trim()) throw new Error('the bot token belongs to another application than appId');
    console.log('deploying worker-bot…');
    await wrangler(['deploy']);
    for (const [name, value] of [['DISCORD_TOKEN', token], ['ANTHROPIC_KEY', String(keys.anthropicKey || '').trim()], ['BOT_ADMIN_TOKEN', keys.adminToken], ['BOT_STATS_TOKEN', keys.statsToken]]) {
      if (!value) { console.log('  · ' + name + ' is empty in tools/discord.local.json — skipped'); continue; }
      await wrangler(['secret', 'put', name], value);
      console.log('  ✓ secret ' + name);
    }
    // ⚠️ Discord tests the URL with a signed PING before it takes it — the worker has to be up first (it is, above)
    await dc('PATCH', '/applications/@me', { interactions_endpoint_url: BOT_URL + '/interactions' });
    console.log('  ✓ Discord sends slash commands and buttons to ' + BOT_URL + '/interactions');
  },
  async hq() {
    // HQ reads the bot's card through worker-contact's proxy, which holds the stats key as BOT_STATS_TOKEN
    if (!keys.statsToken) throw new Error('no statsToken yet — run deploy first');
    await wrangler(['secret', 'put', 'BOT_STATS_TOKEN', '--cwd', join(ROOT, 'worker-contact')], keys.statsToken);
    console.log('  ✓ secret BOT_STATS_TOKEN on banana-contact');
    await wrangler(['deploy', '--cwd', join(ROOT, 'worker-contact')]);
    console.log('  ✓ banana-contact deployed: HQ can read the bot’s card');
  },
  async avatar() {
    // the picture tools/build-bot-avatar.py draws: our banana in a graduation cap (Discord allows two changes an hour)
    const png = readFileSync(join(WORKER, 'avatar.png'));
    const me = await dc('PATCH', '/users/@me', { avatar: 'data:image/png;base64,' + png.toString('base64') });
    console.log('BananaBOT’s picture is set (' + me.username + ')');
  },
  async invite() {
    console.log('https://discord.com/oauth2/authorize?client_id=' + String(keys.appId).trim() + '&scope=bot%20applications.commands&permissions=8');
  },
  async commands() {
    const { definitions } = await import('../worker-bot/src/commands.js');
    const gs = await dc('GET', '/users/@me/guilds');
    if (!gs.length) throw new Error('BananaBOT is in no server yet — add it with the invite link first');
    for (const g of gs) {
      const done = await dc('PUT', '/applications/' + String(keys.appId).trim() + '/guilds/' + g.id + '/commands', definitions());
      console.log('  ✓ ' + done.length + ' commands in ' + g.name + ': ' + done.map((c) => '/' + c.name).join(' '));
    }
  },
  async status() {
    const me = await dc('GET', '/users/@me');
    const app = await dc('GET', '/applications/@me');
    const gs = await dc('GET', '/users/@me/guilds');
    console.log('bot: ' + me.username + ' (' + me.id + ')');
    console.log('servers: ' + (gs.map((g) => g.name).join(', ') || 'none yet'));
    console.log('interactions endpoint: ' + (app.interactions_endpoint_url || 'not set'));
    try {
      const s = await (await fetch(BOT_URL + '/stats', { headers: { 'X-Bot-Token': String(keys.statsToken || '') } })).json();
      console.log('gateway: ' + (s.gateway.on ? (s.gateway.connected ? 'connected' : 'on, not connected') : 'off'));
      console.log('channels: news ' + (s.channels.news ? 'set' : 'not set') + ' · welcome ' + (s.channels.welcome ? 'set' : 'not set'));
      const t = s.days.find((d) => d.d === new Date().toISOString().slice(0, 10)) || {};
      console.log('today: ' + (Object.entries(t).filter(([k]) => k !== 'd').map(([k, v]) => k + ' ' + v).join(' · ') || 'nothing yet'));
      console.log('claude this month: ' + s.usage.month.n + ' replies, about $' + s.usage.dollars);
    } catch (e) { console.log('the bot itself did not answer /stats'); }
  },
  async gateway() {
    const on = pos[1] === 'on';
    if (!['on', 'off'].includes(pos[1])) throw new Error('gateway on|off');
    const toml = join(WORKER, 'wrangler.toml');
    const t = readFileSync(toml, 'utf8');
    writeFileSync(toml, t.replace(/GATEWAY_ON = "[01]"/, 'GATEWAY_ON = "' + (on ? '1' : '0') + '"'));
    await wrangler(['deploy']);
    const r = await bot('/gateway', on ? { start: 1 } : { stop: 1 });
    console.log('gateway ' + (on ? 'on' : 'off') + ': ' + JSON.stringify(r));
  },
  async news() { const c = await channel(pos[1]); console.log(JSON.stringify(await bot('/config', { news: c.id })) + '  → #' + c.name); },
  async welcome() {
    if (pos[1] === 'off') { console.log(JSON.stringify(await bot('/config', { welcomeOff: true }))); return; }
    const c = await channel(pos[1]);
    console.log(JSON.stringify(await bot('/config', { welcome: c.id, welcomeOff: false })) + '  → #' + c.name);
  },
  async post() {
    if (!['morning', 'poll'].includes(pos[1])) throw new Error('post morning|poll');
    if (!needYes('post the ' + pos[1] + ' in the news channel now')) return;
    console.log(JSON.stringify(await bot('/post', { kind: pos[1] })));
  },
  async tick() { console.log(JSON.stringify(await bot('/tick'))); },

  async channels() {
    const g = await guild();
    const all = await dc('GET', '/guilds/' + g.id + '/channels');
    const cats = Object.fromEntries(all.filter((c) => c.type === 4).map((c) => [c.id, c.name]));
    const kind = { 0: 'text', 2: 'voice', 4: 'category', 5: 'news', 13: 'stage', 15: 'forum' };
    for (const c of all.sort((a, b) => a.position - b.position)) console.log((kind[c.type] || c.type) + '\t' + c.id + '\t' + (c.parent_id ? cats[c.parent_id] + ' / ' : '') + c.name);
  },
  async roles() {
    const g = await guild();
    for (const r of (await dc('GET', '/guilds/' + g.id + '/roles')).sort((a, b) => b.position - a.position)) console.log(r.id + '\t' + r.name + (r.managed ? '  (a bot’s own)' : ''));
  },
  async members() {
    const g = await guild();
    const list = pos[1]
      ? await dc('GET', '/guilds/' + g.id + '/members/search?limit=25&query=' + encodeURIComponent(pos[1]))
      : await dc('GET', '/guilds/' + g.id + '/members?limit=100');
    for (const m of list) console.log(who(m) + (m.roles.length ? '  roles ' + m.roles.length : ''));
  },
  async say() {
    const c = await channel(pos[1]);
    const text = words(pos.slice(2));
    const file = flag('file');
    if (!text && typeof file !== 'string') throw new Error('say <channel> <text> | --from <post.md> [--file <picture>]');
    const shown = text.length > 140 ? text.slice(0, 140) + '…' : text;
    if (!needYes('post as BananaBOT in #' + c.name + ': “' + shown + '”' + (typeof file === 'string' ? ' with ' + basename(file) : ''))) return;
    const payload = { content: text, allowed_mentions: { parse: [] } };   // ⚠️ it never pings anybody
    const m = await dc('POST', '/channels/' + c.id + '/messages', typeof file === 'string' ? withFiles(payload, [file]) : payload);
    console.log('posted ' + m.id + ' in #' + c.name);
  },
  async edit() {
    const c = await channel(pos[1]);
    const text = words(pos.slice(3));
    if (!needYes('edit message ' + pos[2] + ' in #' + c.name)) return;
    await dc('PATCH', '/channels/' + c.id + '/messages/' + pos[2], { content: text, allowed_mentions: { parse: [] } });
    console.log('edited');
  },
  async pin() { const c = await channel(pos[1]); await dc('PUT', '/channels/' + c.id + '/pins/' + pos[2]); console.log('pinned in #' + c.name); },
  async unpin() { const c = await channel(pos[1]); await dc('DELETE', '/channels/' + c.id + '/pins/' + pos[2]); console.log('unpinned in #' + c.name); },
  async 'delete-message'() {
    const c = await channel(pos[1]);
    if (!needYes('delete message ' + pos[2] + ' in #' + c.name)) return;
    await dc('DELETE', '/channels/' + c.id + '/messages/' + pos[2], null, flag('reason'));
    console.log('deleted');
  },
  async 'create-channel'() {
    const g = await guild();
    const name = pos[1];
    const body = { name, type: flag('voice') ? 2 : 0 };
    if (flag('topic')) body.topic = String(flag('topic'));
    if (flag('category')) body.parent_id = (await channel(flag('category'))).id;
    const c = await dc('POST', '/guilds/' + g.id + '/channels', body);
    console.log('created #' + c.name + ' (' + c.id + ')');
  },
  async 'rename-channel'() { const c = await channel(pos[1]); await dc('PATCH', '/channels/' + c.id, { name: pos[2] }); console.log('#' + c.name + ' → #' + pos[2]); },
  async topic() { const c = await channel(pos[1]); await dc('PATCH', '/channels/' + c.id, { topic: pos.slice(2).join(' ') }); console.log('topic set on #' + c.name); },
  async slowmode() { const c = await channel(pos[1]); await dc('PATCH', '/channels/' + c.id, { rate_limit_per_user: Math.max(0, Math.min(21600, +pos[2] || 0)) }); console.log('slowmode ' + (+pos[2] || 0) + ' s on #' + c.name); },
  async lock() { await C.lockAs(true); },
  async unlock() { await C.lockAs(false); },
  async lockAs(lock) {
    const g = await guild();
    const c = await channel(pos[1]);
    if (!needYes((lock ? 'lock' : 'unlock') + ' #' + c.name + ' for everyone')) return;
    const SEND = 1n << 11n;
    const cur = (c.permission_overwrites || []).find((o) => o.id === g.id) || { allow: '0', deny: '0' };
    const deny = lock ? (BigInt(cur.deny) | SEND) : (BigInt(cur.deny) & ~SEND);
    await dc('PUT', '/channels/' + c.id + '/permissions/' + g.id, { type: 0, allow: String(BigInt(cur.allow) & ~SEND), deny: String(deny) });
    console.log((lock ? 'locked' : 'unlocked') + ' #' + c.name);
  },
  async 'delete-channel'() {
    const c = await channel(pos[1]);
    if (!needYes('delete #' + c.name + ' and everything in it')) return;
    await dc('DELETE', '/channels/' + c.id, null, flag('reason'));
    console.log('deleted #' + c.name);
  },
  async 'create-role'() {
    const g = await guild();
    const body = { name: pos[1], hoist: !!flag('hoist'), mentionable: !!flag('mentionable') };
    if (flag('color')) body.color = parseInt(String(flag('color')).replace('#', ''), 16);
    const r = await dc('POST', '/guilds/' + g.id + '/roles', body);
    console.log('created role ' + r.name + ' (' + r.id + ')');
  },
  async 'give-role'() { const g = await guild(); const m = await member(pos[1]); const r = await role(pos[2]); await dc('PUT', '/guilds/' + g.id + '/members/' + m.user.id + '/roles/' + r.id); console.log(who(m) + ' + ' + r.name); },
  async 'take-role'() { const g = await guild(); const m = await member(pos[1]); const r = await role(pos[2]); await dc('DELETE', '/guilds/' + g.id + '/members/' + m.user.id + '/roles/' + r.id); console.log(who(m) + ' − ' + r.name); },
  async timeout() {
    const g = await guild(); const m = await member(pos[1]);
    const mins = Math.max(1, Math.min(40320, +pos[2] || 10));
    if (!needYes('time out ' + who(m) + ' for ' + mins + ' minutes')) return;
    await dc('PATCH', '/guilds/' + g.id + '/members/' + m.user.id, { communication_disabled_until: new Date(Date.now() + mins * 60000).toISOString() }, pos.slice(3).join(' '));
    console.log('timed out ' + who(m));
  },
  async untimeout() { const g = await guild(); const m = await member(pos[1]); await dc('PATCH', '/guilds/' + g.id + '/members/' + m.user.id, { communication_disabled_until: null }); console.log('timeout lifted: ' + who(m)); },
  async kick() {
    const g = await guild(); const m = await member(pos[1]);
    if (!needYes('kick ' + who(m))) return;
    await dc('DELETE', '/guilds/' + g.id + '/members/' + m.user.id, null, pos.slice(2).join(' '));
    console.log('kicked ' + who(m));
  },
  async ban() {
    const g = await guild(); const m = await member(pos[1]);
    if (!needYes('ban ' + who(m))) return;
    await dc('PUT', '/guilds/' + g.id + '/bans/' + m.user.id, {}, pos.slice(2).join(' '));
    console.log('banned ' + who(m));
  },
  async unban() {
    const g = await guild();
    if (!needYes('unban ' + pos[1])) return;
    await dc('DELETE', '/guilds/' + g.id + '/bans/' + pos[1]);
    console.log('unbanned ' + pos[1]);
  },
  async api() {
    const method = String(pos[1] || 'GET').toUpperCase();
    const path = String(pos[2] || '');
    if (!path.startsWith('/')) throw new Error('api <METHOD> </path> [json]');
    if (method !== 'GET' && !needYes(method + ' ' + path)) return;
    const out = await dc(method, path, pos[3] ? JSON.parse(pos[3]) : null);
    console.log(JSON.stringify(out, null, 1).slice(0, 6000));
  },
};

const name = pos[0];
if (!name || !C[name] || name === 'lockAs') {
  console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').filter((l) => l.startsWith('//')).slice(4, 32).map((l) => l.slice(3)).join('\n'));
  process.exit(name ? 1 : 0);
}
C[name]().catch((e) => { console.error('✗ ' + (e.message || e)); process.exit(1); });
