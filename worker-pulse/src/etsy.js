// 🛍 THE ETSY SHOP IN PULSE (30 Sep 2026). Trym: "is there a way of tracking Etsy sales, or close-to sales in Banana
// Pulse (HQ)?" … "yes build it".
//
// Pulse has a read-only connection of its own (listings_r shops_r transactions_r), made once by Trym's Allow click in
// `node tools/etsy.mjs pulse-connect`: the app's keystring and shared secret are worker secrets (ETSY_KEY, ETSY_SECRET),
// the token and the shop's id live in the ETSY KV namespace, and the token renews itself. The daily cron keeps it alive
// past Etsy's 90 days and writes one snapshot of every active listing's views and hearts: Etsy only gives running
// totals, so a window's views and hearts are the difference between two snapshots.
// ⚠️ Never a buyer's details: an order is counted, summed and named by product; nothing else leaves Etsy.

const API = 'https://openapi.etsy.com/v3/application';
const TOKEN_URL = 'https://api.etsy.com/v3/public/oauth/token';
const CACHE_MS = 5 * 60 * 1000;
const cache = new Map();   // window -> { t, data }

const osloDay = (back = 0) => new Date(Date.now() - back * 86400000).toLocaleDateString('en-CA', { timeZone: 'Europe/Oslo' });
const dayAfter = (d) => new Date(Date.parse(d + 'T12:00:00Z') + 86400000).toISOString().slice(0, 10);

// the moment a day starts in Oslo, as epoch ms (Etsy's order times are UTC seconds)
function osloMidnight(day) {
  const guess = Date.parse(day + 'T00:00:00Z');
  const shown = Date.parse(new Date(guess).toLocaleString('sv-SE', { timeZone: 'Europe/Oslo' }).replace(' ', 'T') + 'Z');
  return guess - (shown - guess);
}

// "Official Dancing Banana Hype Emote, Animated Party Banana for …" -> "Hype Emote"
function shortTitle(t) {
  const s = String(t || '').replace(/^Official Dancing Banana\s*/i, '').split(/\s*[|:]\s*/)[0];
  const parts = s.split(/\s*,\s*/);
  return (parts[0].length < 8 && parts[1] ? parts[0] + ', ' + parts[1] : parts[0]).slice(0, 48);
}

async function token(env) {
  const t = await env.ETSY.get('token', 'json');
  if (!t || !t.refresh_token || !t.shop_id) return { err: 'unconfigured' };
  if (t.access_token && Date.now() < t.expires_at - 60000) return { t };
  const r = await fetch(TOKEN_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', client_id: String(env.ETSY_KEY).trim(), refresh_token: t.refresh_token }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) return { err: 'reconnect', why: String(j.error_description || j.error || 'HTTP ' + r.status).slice(0, 120) };
  const n = { ...t, access_token: j.access_token, refresh_token: j.refresh_token || t.refresh_token,
    expires_at: Date.now() + (j.expires_in || 3600) * 1000, renewed: Date.now() };
  await env.ETSY.put('token', JSON.stringify(n));
  return { t: n };
}

async function etsy(env, t, path, query) {
  const u = new URL(API + path);
  for (const [k, v] of Object.entries(query || {})) u.searchParams.set(k, String(v));
  const r = await fetch(u, { headers: {
    'x-api-key': String(env.ETSY_KEY).trim() + ':' + String(env.ETSY_SECRET).trim(), Authorization: 'Bearer ' + t.access_token,
  } });
  if (!r.ok) throw new Error('Etsy said ' + r.status + ' to ' + path.split('/').slice(0, 3).join('/'));
  return r.json();
}

// every active listing, as { id: [views, hearts] } and { id: short title }
async function current(env, t) {
  const l = {};
  const titles = {};
  for (let offset = 0; offset < 1000; offset += 100) {
    const r = await etsy(env, t, '/shops/' + t.shop_id + '/listings', { state: 'active', limit: 100, offset });
    for (const x of r.results || []) {
      l[x.listing_id] = [x.views || 0, x.num_favorers || 0];
      titles[x.listing_id] = shortTitle(x.title);
    }
    if ((r.results || []).length < 100) break;
  }
  return { l, titles };
}

const configured = (env) => !!(env.ETSY && env.ETSY_KEY && env.ETSY_SECRET);

// the cron's job, once a day: renew the connection, keep today's totals
export async function etsySnapshot(env) {
  if (!configured(env)) return null;
  const { t } = await token(env);
  if (!t) return null;
  const now = await current(env, t);
  await env.ETSY.put('snap:' + osloDay(), JSON.stringify({ at: Date.now(), l: now.l }), { expirationTtl: 400 * 86400 });
  await env.ETSY.put('titles', JSON.stringify(now.titles));
  return now;
}

// /api/etsy — the window's views, hearts, orders and money, per listing
export async function apiEtsy(env, from, to) {
  if (!configured(env)) return { conn: 'unconfigured' };
  const res = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? s
    : osloDay(s === 'today' ? 0 : s === 'yesterday' ? 1 : Number(String(s).replace('daysAgo', '')) || 0));
  const a = res(from);
  const b = res(to);
  const key = a + ':' + b;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < CACHE_MS) return hit.data;

  const tk = await token(env);
  if (!tk.t) return { conn: tk.err, why: tk.why || '' };
  const t = tk.t;
  const today = osloDay();
  const now = await current(env, t);
  if (!(await env.ETSY.get('snap:' + today))) {   // the cron has not run yet today: today's totals are the first snapshot
    await env.ETSY.put('snap:' + today, JSON.stringify({ at: Date.now(), l: now.l }), { expirationTtl: 400 * 86400 });
    await env.ETSY.put('titles', JSON.stringify(now.titles));
  }
  const days = (await env.ETSY.list({ prefix: 'snap:' })).keys.map((k) => k.name.slice(5)).sort();
  // the totals when the window opened: the first snapshot on or after its first day (a snapshot is taken early in
  // its day, so it holds everything before that day); and when it closed: now, or the snapshot of the day after
  const startDay = days.find((d) => d >= a) || today;
  const start = (await env.ETSY.get('snap:' + startDay, 'json')) || { l: {} };
  const endDay = b >= today ? null : days.find((d) => d >= dayAfter(b));
  const end = endDay ? ((await env.ETSY.get('snap:' + endDay, 'json')) || { l: now.l }) : { l: now.l };

  const rows = [];
  let views = 0;
  let hearts = 0;
  for (const [id, [v1, h1]] of Object.entries(end.l)) {
    const [v0, h0] = start.l[id] || [0, 0];
    const dv = Math.max(0, v1 - v0);
    const dh = h1 - h0;
    views += dv;
    hearts += dh;
    const [tv, th] = now.l[id] || [v1, h1];
    rows.push({ title: now.titles[id] || 'listing ' + id, v: dv, h: dh, tv, th });
  }
  rows.sort((x, y) => y.v - x.v || y.h - x.h || y.tv - x.tv);

  // the orders placed in the window: counted, summed, named by product — never who bought
  const minC = Math.floor(osloMidnight(a) / 1000);
  const maxC = Math.floor(osloMidnight(dayAfter(b)) / 1000);
  const rec = await etsy(env, t, '/shops/' + t.shop_id + '/receipts', { min_created: minC, max_created: maxC, limit: 100 });
  let orders = 0;
  let money = 0;
  let currency = 'NOK';
  const recent = [];
  for (const o of rec.results || []) {
    if (/cancel/i.test(String(o.status || ''))) continue;
    orders += 1;
    const g = o.grandtotal || {};
    money += (g.amount || 0) / (g.divisor || 100);
    currency = g.currency_code || currency;
    if (recent.length < 6) {
      recent.push({ day: new Date((o.created_timestamp || o.create_timestamp || 0) * 1000).toLocaleDateString('en-CA', { timeZone: 'Europe/Oslo' }),
        total: Math.round(((g.amount || 0) / (g.divisor || 100)) * 100) / 100,
        items: (o.transactions || []).map((x) => shortTitle(x.title) + (x.quantity > 1 ? ' ×' + x.quantity : '')).join(', ') });
    }
  }
  const data = { conn: 'ok', from: a, to: b, since: startDay, partial: startDay > a, views, hearts,
    orders, money: Math.round(money * 100) / 100, currency, rows, recent,
    totals: Object.values(now.l).reduce((s, [v, h]) => [s[0] + v, s[1] + h], [0, 0]),
    listings: Object.keys(now.l).length, renewed: t.renewed || null };
  cache.set(key, { t: Date.now(), data });
  return data;
}
