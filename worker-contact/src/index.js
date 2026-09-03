// Contact inbox — the form at /contact/ posts here; messages are STORED,
// never emailed (no sending infra to break, no address to leak). Trym reads
// the inbox at GET /inbox?token=… — the token is a wrangler secret.
//
// Spam posture (a static banana site, not a bank):
//   - honeypot field ("website") must be empty — bots love filling it
//   - Origin allowlist
//   - 5 messages/day per ip+ua hash AND 12/day per ip hash, enforced in the DO
//   - hard length caps; no HTML is ever rendered from user input unescaped
//
// Upgrade path if Trym ever wants push delivery: add a Resend/API key and
// forward from the DO — the storage stays as the archive either way.

const MAX_MSG = 4000, MAX_META = 200, PER_DAY = 5;
// ⚠️ the per-sender bucket folds in User-Agent, which the client controls —
// a rotating UA mints a fresh quota. PER_IP_DAY is the cap a header loop
// cannot dodge; it sits above PER_DAY so a shared NAT still gets through.
const PER_IP_DAY = 12;
// 🧹 accepted mail is an archive, so it expires by count not by age — the
// desk lists 200, and an unbounded store lets a flood bury the real mail
const MAX_KEEP = 2000;
const PRUNE_TO = MAX_KEEP - 100;   // prune below the ceiling, so a full archive doesn't re-list on every message

// ⚠️ .trim(): one stray space in the wrangler allowlist would quarantine every
// real submission from that origin as 'bad-origin' while the sender is still
// shown "✓ sent" (quarantine answers 200 ok by design)
const allowList = (env) => (env.ALLOWED_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);

function corsHeaders(env, origin) {
  const allowed = allowList(env);
  const ok = allowed.includes(origin) ? origin : (allowed[0] || '');
  return {
    'Access-Control-Allow-Origin': ok,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Inbox-Token',
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
      if (!allowList(env).includes(origin)) return quarantine('bad-origin');
      if (String(body.website || '') !== '') return quarantine('honeypot'); // bots love filling it
      // time-gate: humans read a page before writing; headless bots submit
      // instantly. `t` = ms between page load and submit (sent by the form).
      if (typeof body.t === 'number' && body.t >= 0 && body.t < 3000) return quarantine('too-fast');
      const msg = String(body.message || '').trim();
      if (msg.length < 5 || msg.length > MAX_MSG) return new Response('message length', { status: 400, headers: cors });
      const ip = request.headers.get('CF-Connecting-IP') || '?';
      const ua = request.headers.get('User-Agent') || '?';
      // this worker stores a DIGEST and never the raw ip — the ip-only one is
      // the throttle key, the ip+ua one stays the sender identity (dedup)
      const digest = async (s) => {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
        return [...new Uint8Array(buf)].slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('');
      };
      const sender = await digest(ip + '|' + ua);
      const ipHash = await digest('ip|' + ip);
      const res = await stub.fetch('https://do/send', {
        method: 'POST',
        body: JSON.stringify({
          name: String(body.name || '').slice(0, MAX_META),
          email: String(body.email || '').slice(0, MAX_META),
          topic: String(body.topic || 'general').slice(0, 40),
          message: msg,
          sender,
          ipHash,
          // 🎫 the sender's pass identity (form-attached when they have one)
          // — the road back when they left no email: Trym's reply lands as a
          // My Pass world notification instead
          pass: String(body.pass || '').slice(0, 64),
          passName: String(body.passName || '').slice(0, 24),
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

    // 💬 REPLY TO A PASS — Trym answers a mail whose sender left no email but
    // carried a pass id: the reply is stored per-pass and the pass page polls
    // it into a "Message from Trym" world notification. The store IS the
    // correspondence archive.
    if (url.pathname === '/reply' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch (e) { return new Response('bad json', { status: 400, headers: cors }); }
      if (!env.INBOX_TOKEN || String(body.token || '') !== env.INBOX_TOKEN) return new Response('nope', { status: 403, headers: cors });
      const pass = String(body.pass || '').slice(0, 64);
      const text = String(body.text || '').trim().slice(0, 2000);
      if (!pass || text.length < 1) return new Response('bad reply', { status: 400, headers: cors });
      const res = await stub.fetch('https://do/reply', {
        method: 'POST',
        body: JSON.stringify({ pass, text, re: String(body.re || '').slice(0, 300), ts: Date.now() }),
      });
      return new Response(await res.text(), { headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    // the pass-holder's mailbox: their own device polls this with the id only
    // it holds (same trust model as the per-sid gallery verdicts)
    if (url.pathname === '/replies' && request.method === 'GET') {
      const pass = String(url.searchParams.get('pass') || '').slice(0, 64);
      if (!pass) return new Response('[]', { headers: { ...cors, 'Content-Type': 'application/json' } });
      const res = await stub.fetch('https://do/replies?pass=' + encodeURIComponent(pass));
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
    // ── 🛠 THE DEV DESK (Banana HQ rig console) ──────────────────────────
    // Reads are client-side against GitHub's public API (public repo — no
    // secrets needed). These two routes are only the WRITE half: they proxy
    // triage actions to GitHub with a PAT held as a wrangler secret, behind
    // the same inbox token as every other desk. No PAT set = the desk runs
    // read-only and says so.
    if (url.pathname === '/dev/ping' && request.method === 'GET') {
      const token = url.searchParams.get('token') || '';
      if (!env.INBOX_TOKEN || token !== env.INBOX_TOKEN) return new Response('nope', { status: 403, headers: cors });
      return new Response(JSON.stringify({ ok: true, pat: !!env.GITHUB_PAT }),
        { headers: { ...cors, 'Content-Type': 'application/json' } });
    }
    // 📡 THE PULSE PROXY — Banana Pulse behind the door HQ already has.
    // The dashboard token lives HERE as this worker's own secret, so it never
    // reaches a browser and Trym carries one key, not two. Server-to-server,
    // so worker-pulse needs no CORS header and keeps its own gate exactly as
    // it is: a wrong token there is still a 404 to the whole world.
    if (url.pathname === '/pulse' && request.method === 'GET') {
      // ⚠️ THE TOKEN COMES IN A HEADER, NOT THE QUERY STRING. A key in a URL
      // lands in browser history, in devtools, and in any screenshot of the
      // console — which is exactly how this one first got shown to somebody.
      // The query form still works so an old tab does not break.
      const tok = (request.headers.get('X-Inbox-Token') || url.searchParams.get('token') || '').trim();
      if (!env.INBOX_TOKEN || tok !== env.INBOX_TOKEN) return new Response('nope', { status: 403, headers: cors });
      if (!env.DASH_TOKEN) {
        return new Response(JSON.stringify({ ok: false, err: 'no dash token' }),
          { status: 503, headers: { ...cors, 'Content-Type': 'application/json' } });
      }
      const want = String(url.searchParams.get('r') || 'analyst');
      if (!['live', 'analyst', 'report', 'range'].includes(want)) {
        return new Response(JSON.stringify({ ok: false, err: 'bad room' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
      }
      // ⚠️ .trim(): `wrangler secret put` keeps a trailing newline if the
      // paste had one, and Pulse answers a wrong token with a plain 404 — so
      // an invisible character reads as "the whole dashboard is missing"
      const q = new URLSearchParams({ t: String(env.DASH_TOKEN).trim() });
      if (want === 'range') {
        q.set('from', String(url.searchParams.get('from') || 'today').slice(0, 12));
        q.set('to', String(url.searchParams.get('to') || 'today').slice(0, 12));
      }
      try {
        const up = await fetch('https://banana-pulse.trymstene.workers.dev/api/' + want + '?' + q.toString());
        const body = await up.text();
        // Pulse says 404 for a wrong token AND for a wrong path. Passing that
        // straight through told the desk "not found" for what is really "the
        // dashboard token is wrong", so name it.
        if (up.status === 404) {
          return new Response(JSON.stringify({ ok: false, err: 'pulse refused the dashboard token' }),
            { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } });
        }
        return new Response(body, { status: up.status,
          headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
      } catch (e) {
        return new Response(JSON.stringify({ ok: false, err: 'pulse unreachable' }),
          { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } });
      }
    }
    if (url.pathname === '/dev/gh' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch (e) { return new Response('bad json', { status: 400, headers: cors }); }
      if (!env.INBOX_TOKEN || String(body.token || '') !== env.INBOX_TOKEN) return new Response('nope', { status: 403, headers: cors });
      if (!env.GITHUB_PAT) return new Response(JSON.stringify({ ok: false, err: 'no pat' }), { status: 503, headers: { ...cors, 'Content-Type': 'application/json' } });
      const num = parseInt(body.number, 10);
      const action = String(body.action || '');
      // 🚀 'deploy' carries no issue number: community gallery + catalog pages
      // are built at BUILD TIME, so an approval is invisible until the site
      // rebuilds (nightly otherwise). A maker told "you're live" would click
      // through to a 404 — this closes that window.
      if (!['approve', 'dismiss', 'comment', 'file', 'merge', 'deploy'].includes(action)
          || (action !== 'file' && action !== 'deploy' && !num)) {
        return new Response(JSON.stringify({ ok: false, err: 'bad action' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
      }
      const note = String(body.body || '').slice(0, 4000);
      // an empty 'comment' posts nothing yet answers ok — the desk would then
      // clear the typed textarea and paint the card settled over a no-op
      if (action === 'comment' && !note.trim()) {
        return new Response(JSON.stringify({ ok: false, err: 'no note' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
      }
      const GH = 'https://api.github.com/repos/trymstene/trymstene.github.io';
      // ⚠️ fetch never rejects on HTTP status: a revoked PAT 401s and the bare
      // Response sails on as success. Every call throws its status into the
      // catch below instead, so no write is ever reported as {ok:true} unsent.
      const gh = async (path, method, payload) => {
        const r = await fetch(GH + path, {
          method,
          headers: {
            Authorization: 'Bearer ' + env.GITHUB_PAT,
            Accept: 'application/vnd.github+json',
            'User-Agent': 'banana-hq-dev-desk',
            'Content-Type': 'application/json',
          },
          body: payload ? JSON.stringify(payload) : undefined,
        });
        if (!r.ok) {
          let why = '';
          try { why = String((await r.json()).message || ''); } catch (e) { /* html error page */ }
          throw new Error('github ' + r.status + (why ? ': ' + why : ''));
        }
        return r;
      };
      try {
        // 🚀 rebuild the site now — a workflow_dispatch on the deploy workflow.
        // ⚠️ needs Actions: read+write on the PAT; the desk shows the refusal
        // rather than pretending the page went live.
        if (action === 'deploy') {
          await gh('/actions/workflows/deploy.yml/dispatches', 'POST', { ref: 'main' });
          return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, 'Content-Type': 'application/json' } });
        }
        // 📝 the summon box — file a new item onto the desk without leaving HQ
        if (action === 'file') {
          const title = String(body.title || '').trim().slice(0, 200);
          if (!title) return new Response(JSON.stringify({ ok: false, err: 'no title' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
          const r2 = await gh('/issues', 'POST', { title, body: note, labels: ['from-hq'] });
          const j2 = await r2.json();
          return new Response(JSON.stringify({ ok: !!j2.number, number: j2.number }), { headers: { ...cors, 'Content-Type': 'application/json' } });
        }
        // 🔀 the merge button — squash keeps main linear, one commit per PR,
        // matching the house history style. GitHub enforces mergeability.
        if (action === 'merge') {
          const r3 = await gh('/pulls/' + num + '/merge', 'PUT', { merge_method: 'squash' });
          const j3 = await r3.json();
          return new Response(JSON.stringify({ ok: !!j3.merged, err: j3.merged ? undefined : (j3.message || 'not merged') }),
            { headers: { ...cors, 'Content-Type': 'application/json' } });
        }
        if (note) await gh('/issues/' + num + '/comments', 'POST', { body: note });
        if (action === 'approve') {
          await gh('/issues/' + num + '/labels', 'POST', { labels: ['approved'] });
        } else if (action === 'dismiss') {
          await gh('/issues/' + num + '/labels', 'POST', { labels: ['dismissed'] });
          await gh('/issues/' + num, 'PATCH', { state: 'closed', state_reason: 'not_planned' });
        }
        return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, 'Content-Type': 'application/json' } });
      } catch (e) {
        // the desk prints this on the button — carry github's own reason
        return new Response(JSON.stringify({ ok: false, err: String((e && e.message) || 'github said no').slice(0, 200) }),
          { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } });
      }
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
      // two daily caps: per-sender (ip+ua) and per-ip. The ip one is the real
      // ceiling — a bot rotating User-Agent walks straight past the other, and
      // it also bounds how many rl: keys one address can mint in a day.
      const day = new Date().toISOString().slice(0, 10);
      const slowDown = () => new Response(JSON.stringify({ ok: false, err: 'slow down' }), { status: 429 });
      const rlKey = 'rl:' + m.sender + ':' + day;
      const ipKey = 'rlip:' + (m.ipHash || m.sender) + ':' + day;
      const used = (await this.state.storage.get(rlKey)) || 0;
      if (used >= PER_DAY) return slowDown();
      const ipUsed = (await this.state.storage.get(ipKey)) || 0;
      if (ipUsed >= PER_IP_DAY) return slowDown();
      await this.state.storage.put(rlKey, used + 1);
      await this.state.storage.put(ipKey, ipUsed + 1);
      await this.state.storage.put('m:' + String(m.ts).padStart(15, '0') + ':' + m.sender.slice(0, 4), m);
      // the quarantine's discipline, minus the age cutoff (real mail never
      // expires). The counter keeps the common path O(1) — listing 'm:' loads
      // every message BODY, so that only runs when we are actually over.
      const n = ((await this.state.storage.get('mcount')) || 0) + 1;
      if (n > MAX_KEEP) {
        const keys = [...(await this.state.storage.list({ prefix: 'm:' })).keys()]; // ascending = oldest first
        // ⚠️ 128 keys is the per-call delete ceiling, and the message is ALREADY
        // stored above — an oversized batch would throw and answer 5xx for mail
        // that actually arrived. Prune to a floor below MAX_KEEP so the next
        // message doesn't re-list (listing loads every message BODY).
        const over = Math.max(0, keys.length - PRUNE_TO);
        if (over) await this.state.storage.delete(keys.slice(0, Math.min(over, 128)));
        await this.state.storage.put('mcount', Math.max(0, keys.length - Math.min(over, 128)));
      } else {
        await this.state.storage.put('mcount', n);
      }
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
    // 💬 per-pass replies: keyed r:<pass>:<ts> so one list() call serves one
    // person's whole thread — the archive Trym reads AND the mailbox the
    // pass polls. Capped at the newest 40 per pass.
    if (url.pathname === '/reply') {
      const r = await request.json();
      await this.state.storage.put('r:' + r.pass + ':' + String(r.ts).padStart(15, '0'), r);
      const all = await this.state.storage.list({ prefix: 'r:' + r.pass + ':' });
      const keys = [...all.keys()];
      if (keys.length > 40) await this.state.storage.delete(keys.slice(0, keys.length - 40));
      return new Response(JSON.stringify({ ok: true }));
    }
    if (url.pathname === '/replies') {
      const pass = url.searchParams.get('pass') || '';
      const list = await this.state.storage.list({ prefix: 'r:' + pass + ':', reverse: true, limit: 40 });
      return new Response(JSON.stringify([...list.entries()].map(([key, r]) => ({ key, text: r.text, re: r.re, ts: r.ts }))), { headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('not found', { status: 404 });
  }
}
