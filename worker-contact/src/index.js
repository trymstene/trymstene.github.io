// Contact inbox — the form at /contact/ posts here; messages are STORED,
// never emailed (no sending infra to break, no address to leak). Trym reads
// the inbox at GET /inbox?token=… — the token is a wrangler secret.
//
// Spam posture (a static banana site, not a bank):
//   - honeypot field ("website") must be empty — bots love filling it
//   - Origin allowlist
//   - 5 messages/day per ip+ua hash, enforced in the DO
//   - hard length caps; no HTML is ever rendered from user input unescaped
//
// Upgrade path if Trym ever wants push delivery: add a Resend/API key and
// forward from the DO — the storage stays as the archive either way.

const MAX_MSG = 4000, MAX_META = 200, PER_DAY = 5;

function corsHeaders(env, origin) {
  const allowed = (env.ALLOWED_ORIGIN || '').split(',');
  const ok = allowed.includes(origin) ? origin : allowed[0];
  return {
    'Access-Control-Allow-Origin': ok,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(env, request.headers.get('Origin') || '');
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    const stub = env.INBOX.get(env.INBOX.idFromName('inbox'));

    if (url.pathname === '/send' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch (e) { return new Response('bad json', { status: 400, headers: cors }); }
      // GATE-TRIPPED = QUARANTINED, not discarded (Trym, 20 Jul: "nice to
      // always have the raw data"). The sender still sees the identical fake
      // "ok" — bots learn nothing — but the message lands in an s:-prefixed
      // spam folder (capped + 30-day-expiring, pruned in the DO) that the desk
      // can inspect. Rescues the false positives (e.g. autofill filling the
      // honeypot) that used to vanish without a trace.
      const quarantine = async (reason) => {
        try {
          await stub.fetch('https://do/spam', {
            method: 'POST',
            body: JSON.stringify({
              name: String(body.name || '').slice(0, MAX_META),
              email: String(body.email || '').slice(0, MAX_META),
              topic: String(body.topic || 'general').slice(0, 40),
              message: String(body.message || '').slice(0, MAX_MSG),
              reason,
              ts: Date.now(),
            }),
          });
        } catch (e) { /* quarantine is best-effort — the fake ok ships regardless */ }
        return new Response(JSON.stringify({ ok: true }), { headers: cors });
      };
      // server-side Origin check: CORS headers only discipline browsers; the
      // first spam wave (11 Jul, two posts 3s apart) replayed the endpoint
      // directly from a server with no Origin at all
      const origin = request.headers.get('Origin') || '';
      if (!(env.ALLOWED_ORIGIN || '').split(',').includes(origin)) return quarantine('bad-origin');
      if (String(body.website || '') !== '') return quarantine('honeypot'); // bots love filling it
      // time-gate: humans read a page before writing; headless bots submit
      // instantly. `t` = ms between page load and submit (sent by the form).
      if (typeof body.t === 'number' && body.t >= 0 && body.t < 3000) return quarantine('too-fast');
      const msg = String(body.message || '').trim();
      if (msg.length < 5 || msg.length > MAX_MSG) return new Response('message length', { status: 400, headers: cors });
      const ip = request.headers.get('CF-Connecting-IP') || '?';
      const ua = request.headers.get('User-Agent') || '?';
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip + '|' + ua));
      const sender = [...new Uint8Array(buf)].slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('');
      const res = await stub.fetch('https://do/send', {
        method: 'POST',
        body: JSON.stringify({
          name: String(body.name || '').slice(0, MAX_META),
          email: String(body.email || '').slice(0, MAX_META),
          topic: String(body.topic || 'general').slice(0, 40),
          message: msg,
          sender,
          ts: Date.now(),
        }),
      });
      return new Response(await res.text(), { status: res.status, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    // the old bookmark keeps working: it now opens BANANA MAIL™ (the client at
    // /inbox/ on the site) with the token riding the FRAGMENT (never logged)
    if (url.pathname === '/inbox' && request.method === 'GET') {
      const token = url.searchParams.get('token') || '';
      if (!env.INBOX_TOKEN || token !== env.INBOX_TOKEN) return new Response('nope', { status: 403 });
      return Response.redirect('https://trymstene.com/inbox/#token=' + encodeURIComponent(token), 302);
    }

    if (url.pathname === '/messages' && request.method === 'GET') {
      const token = url.searchParams.get('token') || '';
      if (!env.INBOX_TOKEN || token !== env.INBOX_TOKEN) return new Response('nope', { status: 403, headers: cors });
      const res = await stub.fetch('https://do/list');
      return new Response(await res.text(), { headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    // the spam quarantine — same token, separate list (the desk's inspect-once-
    // in-a-while folder, never part of the daily mail)
    if (url.pathname === '/spam' && request.method === 'GET') {
      const token = url.searchParams.get('token') || '';
      if (!env.INBOX_TOKEN || token !== env.INBOX_TOKEN) return new Response('nope', { status: 403, headers: cors });
      const res = await stub.fetch('https://do/spamlist');
      return new Response(await res.text(), { headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    if (url.pathname === '/delete' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch (e) { return new Response('bad json', { status: 400, headers: cors }); }
      if (!env.INBOX_TOKEN || String(body.token || '') !== env.INBOX_TOKEN) return new Response('nope', { status: 403, headers: cors });
      const keys = Array.isArray(body.keys) ? body.keys.filter((k) => typeof k === 'string' && (k.startsWith('m:') || k.startsWith('s:'))).slice(0, 128) : [];
      const res = await stub.fetch('https://do/delete', { method: 'POST', body: JSON.stringify({ keys }) });
      return new Response(await res.text(), { headers: { ...cors, 'Content-Type': 'application/json' } });
    }
    return new Response('not found', { status: 404, headers: cors });
  },
};

export class ContactInbox {
  constructor(state) {
    this.state = state;
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/send') {
      const m = await request.json();
      // per-sender daily cap
      const day = new Date().toISOString().slice(0, 10);
      const rlKey = 'rl:' + m.sender + ':' + day;
      const used = (await this.state.storage.get(rlKey)) || 0;
      if (used >= PER_DAY) return new Response(JSON.stringify({ ok: false, err: 'slow down' }), { status: 429 });
      await this.state.storage.put(rlKey, used + 1);
      await this.state.storage.put('m:' + String(m.ts).padStart(15, '0') + ':' + m.sender.slice(0, 4), m);
      return new Response(JSON.stringify({ ok: true }));
    }
    if (url.pathname === '/list') {
      const list = await this.state.storage.list({ prefix: 'm:', reverse: true, limit: 200 });
      // each message carries its storage key = the id the client deletes by
      return new Response(JSON.stringify([...list.entries()].map(([key, m]) => ({ key, ...m }))), { headers: { 'Content-Type': 'application/json' } });
    }
    if (url.pathname === '/spam') {
      // quarantine store: keep the raw data, but it's a holding cell, not an
      // archive — prune >30 days old and keep at most the newest 300 so a spam
      // flood can never balloon the storage
      const m = await request.json();
      await this.state.storage.put('s:' + String(m.ts).padStart(15, '0'), m);
      const all = await this.state.storage.list({ prefix: 's:' });
      const cutoff = Date.now() - 30 * 86400000;
      const keys = [...all.keys()]; // ascending = oldest first
      const dead = keys.filter((k, i) => (all.get(k) || {}).ts < cutoff || i < keys.length - 300);
      if (dead.length) await this.state.storage.delete(dead);
      return new Response(JSON.stringify({ ok: true }));
    }
    if (url.pathname === '/spamlist') {
      const list = await this.state.storage.list({ prefix: 's:', reverse: true, limit: 300 });
      return new Response(JSON.stringify([...list.entries()].map(([key, m]) => ({ key, ...m }))), { headers: { 'Content-Type': 'application/json' } });
    }
    if (url.pathname === '/delete') {
      const { keys } = await request.json();
      let deleted = 0;
      if (Array.isArray(keys) && keys.length) deleted = await this.state.storage.delete(keys);
      return new Response(JSON.stringify({ ok: true, deleted }));
    }
    return new Response('not found', { status: 404 });
  }
}
