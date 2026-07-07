// Community remix ratings — the 1-5 banana score behind /dancing-banana-remixes/.
//
// Design: one Durable Object ("tally") stores {sum, count} per remix slug.
// No accounts, no text, no moderation surface. Anti-spam is deliberately
// LIGHT (this is a banana gallery, not an election): one vote per remix per
// client fingerprint (ip+ua hash) kept server-side; re-votes UPDATE the old
// vote instead of stacking. localStorage guards the UI client-side.
//
// Routes:
//   GET  /ratings            -> { slug: [sum, count], ... }  (whole board)
//   POST /rate {id, stars}   -> { ok, sum, count }
//
// Cost: reads are cached 60s at the edge; one DO, tiny storage. Free plan.

const SLUG_RE = /^[a-z0-9-]{2,64}$/;

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

    const id = env.RATINGS.idFromName('tally');
    const stub = env.RATINGS.get(id);

    if (url.pathname === '/ratings' && request.method === 'GET') {
      const res = await stub.fetch('https://do/ratings');
      return new Response(await res.text(), {
        headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' },
      });
    }
    if (url.pathname === '/rate' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch (e) { return new Response('bad json', { status: 400, headers: cors }); }
      const slug = String(body.id || '');
      const stars = Math.round(Number(body.stars));
      if (!SLUG_RE.test(slug) || !(stars >= 1 && stars <= 5)) {
        return new Response('bad vote', { status: 400, headers: cors });
      }
      // light per-client fingerprint: ip + ua, hashed — re-votes replace
      const ip = request.headers.get('CF-Connecting-IP') || '?';
      const ua = request.headers.get('User-Agent') || '?';
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip + '|' + ua));
      const voter = [...new Uint8Array(buf)].slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('');
      const res = await stub.fetch('https://do/rate', {
        method: 'POST',
        body: JSON.stringify({ slug, stars, voter }),
      });
      return new Response(await res.text(), { status: res.status, headers: { ...cors, 'Content-Type': 'application/json' } });
    }
    return new Response('not found', { status: 404, headers: cors });
  },
};

export class RemixRatings {
  constructor(state) {
    this.state = state;
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/ratings') {
      // tallies live under t:<slug> = [sum, count]
      const list = await this.state.storage.list({ prefix: 't:' });
      const out = {};
      for (const [k, v] of list) out[k.slice(2)] = v;
      return new Response(JSON.stringify(out), { headers: { 'Content-Type': 'application/json' } });
    }
    if (url.pathname === '/rate') {
      const { slug, stars, voter } = await request.json();
      const vKey = 'v:' + slug + ':' + voter;
      const tKey = 't:' + slug;
      const prev = await this.state.storage.get(vKey);
      const tally = (await this.state.storage.get(tKey)) || [0, 0];
      if (prev) {
        tally[0] += stars - prev; // changed their mind — swap the old vote
      } else {
        tally[0] += stars;
        tally[1] += 1;
      }
      await this.state.storage.put(vKey, stars);
      await this.state.storage.put(tKey, tally);
      return new Response(JSON.stringify({ ok: true, sum: tally[0], count: tally[1] }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response('not found', { status: 404 });
  }
}
