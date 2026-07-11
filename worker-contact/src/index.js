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
      const fakeOk = () => new Response(JSON.stringify({ ok: true }), { headers: cors }); // pretend success, store nothing — bots must never learn what failed
      // server-side Origin check: CORS headers only discipline browsers; the
      // first spam wave (11 Jul, two posts 3s apart) replayed the endpoint
      // directly from a server with no Origin at all
      const origin = request.headers.get('Origin') || '';
      if (!(env.ALLOWED_ORIGIN || '').split(',').includes(origin)) return fakeOk();
      if (String(body.website || '') !== '') return fakeOk(); // honeypot: bots love filling it
      // time-gate: humans read a page before writing; headless bots submit
      // instantly. `t` = ms between page load and submit (sent by the form).
      if (typeof body.t === 'number' && body.t >= 0 && body.t < 3000) return fakeOk();
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

    if (url.pathname === '/inbox' && request.method === 'GET') {
      const token = url.searchParams.get('token') || '';
      if (!env.INBOX_TOKEN || token !== env.INBOX_TOKEN) return new Response('nope', { status: 403 });
      const res = await stub.fetch('https://do/list');
      const items = await res.json();
      const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const rows = items.map((m) => `<article style="border:3px solid #111;padding:12px;margin:0 0 14px;background:#fffdf5;">
        <div style="font-size:12px;color:#666;">${new Date(m.ts).toISOString()} · <b>${esc(m.topic)}</b> · ${esc(m.sender)}</div>
        <div style="font-weight:700;">${esc(m.name || 'anonymous')} ${m.email ? '&lt;' + esc(m.email) + '&gt;' : ''}</div>
        <pre style="white-space:pre-wrap;font-family:inherit;margin:8px 0 0;">${esc(m.message)}</pre>
      </article>`).join('');
      return new Response(`<!doctype html><meta charset="utf-8"><title>banana mail</title>
        <body style="font-family:system-ui;background:#eee;max-width:720px;margin:2rem auto;padding:0 1rem;">
        <h1>🍌 banana mail — ${items.length} message${items.length === 1 ? '' : 's'}</h1>${rows || '<p>empty. peaceful.</p>'}`,
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
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
      return new Response(JSON.stringify([...list.values()]), { headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('not found', { status: 404 });
  }
}
