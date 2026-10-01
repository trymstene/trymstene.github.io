// 🔌 DISCORD, THE PLUMBING — the signature on an interaction, the REST API with the bot's token, and the shapes of an
// answer. Nothing in here knows what BananaBOT says; it only knows how Discord wants to be spoken to.

export const API = 'https://discord.com/api/v10';
export const EPHEMERAL = 64;
// interaction types, and the answers to them
export const PING = 1, COMMAND = 2, COMPONENT = 3;
export const PONG = 1, REPLY = 4, DEFER = 5, UPDATE = 7;

const hexBytes = (s) => new Uint8Array(String(s || '').match(/../g).map((h) => parseInt(h, 16)));

/**
 * ⚠️ EVERY INTERACTION IS SIGNED, AND ONE THAT IS NOT IS NOTHING. Discord signs the timestamp + body with the app's key;
 * a wrong or missing signature is a 401, which is also how Discord tests the endpoint before it accepts the URL.
 */
export async function verify(request, publicKey) {
  const sig = request.headers.get('x-signature-ed25519') || '';
  const ts = request.headers.get('x-signature-timestamp') || '';
  const body = await request.text();
  if (!/^[0-9a-f]{128}$/i.test(sig) || !ts || !publicKey) return { ok: false, body };
  try {
    const key = await crypto.subtle.importKey('raw', hexBytes(String(publicKey).trim()), { name: 'Ed25519' }, false, ['verify']);
    const ok = await crypto.subtle.verify('Ed25519', key, hexBytes(sig), new TextEncoder().encode(ts + body));
    return { ok, body };
  } catch (e) { return { ok: false, body }; }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The REST API as the bot: { ok, status, json }. A 429 waits out Discord's own retry_after (twice at most). */
export function rest(token) {
  const auth = 'Bot ' + String(token || '').trim();
  return async function call(method, path, body, opts = {}) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const headers = { Authorization: auth, 'User-Agent': 'DiscordBot (https://trymstene.com, 1.0)' };
      if (body != null) headers['Content-Type'] = 'application/json';
      if (opts.reason) headers['X-Audit-Log-Reason'] = encodeURIComponent(String(opts.reason).slice(0, 400));
      const r = await fetch(API + path, { method, headers, body: body == null ? undefined : JSON.stringify(body) });
      if (r.status === 429 && attempt < 2) {
        const j = await r.json().catch(() => ({}));
        await sleep(Math.min(5000, Math.ceil((+j.retry_after || 1) * 1000)));
        continue;
      }
      const text = await r.text();
      let json = null;
      try { json = text ? JSON.parse(text) : null; } catch (e) { json = null; }
      return { ok: r.ok, status: r.status, json };
    }
    return { ok: false, status: 429, json: null };
  };
}

// ⚠️ NOBODY GETS PINGED BY ACCIDENT: every message the bot sends says exactly who may be mentioned — nobody, unless a
// welcome names its newcomer or a reply answers its asker
export const quiet = (users) => ({ parse: [], users: users || [], replied_user: !!(users && users.length) });

export const json = (o, status = 200, headers = {}) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json', ...headers } });

/** An answer to an interaction: a message, visible to all unless `ephemeral`. */
export const reply = (data, ephemeral) => ({ type: REPLY, data: { allowed_mentions: quiet(), ...data, ...(ephemeral ? { flags: EPHEMERAL } : {}) } });

/** A link button row: [{ label, url }]. */
export const links = (buttons) => ({ type: 1, components: buttons.slice(0, 5).map((b) => ({ type: 2, style: 5, label: String(b.label).slice(0, 80), url: b.url })) });

/** Follow up on an interaction after answering it (the interaction's own token, valid for fifteen minutes). */
export function followup(appId, token, data) {
  return fetch(API + '/webhooks/' + appId + '/' + token, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ allowed_mentions: quiet(), ...data }),
  });
}

/** The display name Discord would show for the author of a message or an interaction. */
export function nameOf(member, user) {
  const u = user || (member && member.user) || {};
  return String((member && member.nick) || u.global_name || u.username || 'banana').slice(0, 40);
}
