// ═══════════════════════════════════════════════════════════════════════
// 🍌 BANANA PULSE — Trym's private realtime dashboard.
// One worker: token door → GA4 proxy (realtime + core reports) → one page.
// The browser never sees the GA4 key; Google never sees the browser.
// Wrong token = a plain 404, indistinguishable from nothing existing.
// ═══════════════════════════════════════════════════════════════════════
import { MAP_W, MAP_H, LAND_HEX, CENTROIDS } from './mapdata.js';

const GA = 'https://analyticsdata.googleapis.com/v1beta/properties/';

// events worth plotting on the map / showing in the ticker (the rest is noise)
const LENS_EVENTS = [
  'gif_download', 'png_download', 'wallpaper_download', 'builder_boot', 'builder_start',
  'generator_click', 'surprise_me', 'share_link_copy', 'rave_join',
  'sticker_pdp_view', 'sticker_pdp_checkout', 'checkout_redirect',
  'select_item', 'view_item', 'license_click', 'tip_click', 'forge_start',
  'begin_checkout', 'purchase', 'shop_view',
];

let tokCache = { v: null, exp: 0 };
const rspCache = new Map(); // key -> {t, data}

function noRobots(h = {}) {
  return {
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
    'Referrer-Policy': 'no-referrer',
    'Cache-Control': 'no-store',
    ...h,
  };
}

function deny() {
  return new Response('404 — this banana doesn’t exist', {
    status: 404, headers: noRobots({ 'Content-Type': 'text/plain' }),
  });
}

function b64url(s) {
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlBytes(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return b64url(s);
}

async function gaToken(env) {
  if (tokCache.v && Date.now() < tokCache.exp - 120000) return tokCache.v;
  const key = JSON.parse(env.GA4_KEY.trim());
  const now = Math.floor(Date.now() / 1000);
  const input = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' })) + '.' + b64url(JSON.stringify({
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/analytics.readonly https://www.googleapis.com/auth/webmasters.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now, exp: now + 3600,
  }));
  const pem = key.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const ck = await crypto.subtle.importKey('pkcs8', der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', ck,
    new TextEncoder().encode(input)));
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')
      + '&assertion=' + input + '.' + b64urlBytes(sig),
  });
  const d = await r.json();
  if (!d.access_token) throw new Error('token exchange failed: ' + JSON.stringify(d).slice(0, 200));
  tokCache = { v: d.access_token, exp: Date.now() + (d.expires_in || 3600) * 1000 };
  return tokCache.v;
}

async function gaPost(env, method, body) {
  const tok = await gaToken(env);
  const r = await fetch(GA + env.PROPERTY_ID + ':' + method, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error('GA4 ' + method + ' ' + r.status + ': ' + (await r.text()).slice(0, 300));
  return r.json();
}

function rows(resp) {
  return (resp && resp.rows) || [];
}
function dim(row, i) { return row.dimensionValues[i].value; }
function met(row, i) { return Number(row.metricValues[i].value) || 0; }

// ── /api/live — the realtime pulse ───────────────────────────────────────
// Quota discipline (learned the 429 way): the realtime bucket is small and
// hourly, so this is 4 merged queries (was 7), cached 60s, and clients only
// poll while visible. geo carries countries+cities; events carries the
// 30-min totals AND the 5-min ticker via two minuteRanges; pages carries
// both the aggregate list and the per-country hover detail.
async function apiLive(env) {
  const hit = rspCache.get('live');
  if (hit && Date.now() - hit.t < 60000) return hit.data;

  const q = (body) => gaPost(env, 'runRealtimeReport', body);
  const [geo, events, pagesByCc, spark] = await Promise.all([
    q({ dimensions: [{ name: 'countryId' }, { name: 'country' }, { name: 'city' },
        { name: 'deviceCategory' }],
        metrics: [{ name: 'activeUsers' }], limit: 250 }),
    q({ dimensions: [{ name: 'eventName' }, { name: 'countryId' }],
        metrics: [{ name: 'eventCount' }], limit: 250,
        minuteRanges: [
          { name: 'full', startMinutesAgo: 29, endMinutesAgo: 0 },
          { name: 'now5', startMinutesAgo: 4, endMinutesAgo: 0 },
        ] }),
    q({ dimensions: [{ name: 'countryId' }, { name: 'unifiedScreenName' }],
        metrics: [{ name: 'activeUsers' }], limit: 100,
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }] }),
    q({ dimensions: [{ name: 'minutesAgo' }], metrics: [{ name: 'activeUsers' }], limit: 30 }),
  ]);

  const countries = {}; const cityMap = {}; const devices = {};
  for (const r of rows(geo)) {
    const cc = dim(r, 0); const v = met(r, 0);
    countries[cc] = countries[cc] || { cc, name: dim(r, 1), v: 0 };
    countries[cc].v += v;
    const city = dim(r, 2);
    if (city && city !== '(not set)') {
      const k = city + '|' + cc;
      cityMap[k] = cityMap[k] || { city, cc, v: 0 };
      cityMap[k].v += v;
    }
    const dev = dim(r, 3);
    devices[dev] = (devices[dev] || 0) + v;
  }
  const cities = Object.values(cityMap).sort((a, b) => b.v - a.v);

  // multi-minuteRange rows carry the range name as the LAST dimension value
  // hot = per-country purchase proximity in the last 30 min:
  // 1 eyeing a product · 2 hit ORDER · 3 at the checkout · 4 PAID
  const STAGE = {
    sticker_pdp_view: 1, view_item: 1, select_item: 1,
    sticker_pdp_checkout: 2, checkout_redirect: 3, begin_checkout: 3, purchase: 4,
  };
  const evFull = {}; const evNow = []; const hot = {};
  for (const r of rows(events)) {
    const which = dim(r, r.dimensionValues.length - 1);
    const name = dim(r, 0); const cc = dim(r, 1); const v = met(r, 0);
    if (which === 'now5') {
      if (LENS_EVENTS.includes(name)) evNow.push({ name, cc, v });
    } else {
      evFull[name] = (evFull[name] || 0) + v;
      const st = STAGE[name];
      if (st && cc && cc !== '(not set)') hot[cc] = Math.max(hot[cc] || 0, st);
    }
  }
  evNow.sort((a, b) => b.v - a.v);

  const pages = {}; const countryPages = {};
  for (const r of rows(pagesByCc)) {
    const cc = dim(r, 0); const v = met(r, 0);
    const page = dim(r, 1).replace(/\s*\|\s*Trym Stene\s*$/, '');
    pages[page] = (pages[page] || 0) + v;
    (countryPages[cc] = countryPages[cc] || []).push({ page, v });
  }

  const sparkArr = new Array(30).fill(0);
  for (const r of rows(spark)) {
    const m = Number(dim(r, 0));
    if (m >= 0 && m < 30) sparkArr[29 - m] = met(r, 0);
  }
  const cList = Object.values(countries).sort((a, b) => b.v - a.v);
  const data = {
    at: Date.now(),
    total: cList.reduce((a, c) => a + c.v, 0),
    countries: cList,
    cities: cities.slice(0, 12),
    pages: Object.entries(pages).map(([page, v]) => ({ page, v }))
      .sort((a, b) => b.v - a.v).slice(0, 12),
    events: Object.entries(evFull).map(([name, v]) => ({ name, v }))
      .sort((a, b) => b.v - a.v),
    spark: sparkArr,
    recent: evNow.slice(0, 25),
    countryPages,
    devices,
    hot,
  };
  rspCache.set('live', { t: Date.now(), data });
  return data;
}

// ── /api/range — today / picked window (cached 60s per window) ──────────
const RANGE_RE = /^(today|yesterday|\d{1,3}daysAgo|\d{4}-\d{2}-\d{2})$/;

async function apiRange(env, from, to) {
  if (!RANGE_RE.test(from) || !RANGE_RE.test(to)) throw new Error('bad range');
  const key = 'range:' + from + ':' + to;
  const hit = rspCache.get(key);
  if (hit && Date.now() - hit.t < 60000) return hit.data;

  const dateRanges = [{ startDate: from, endDate: to }];
  const resp = await gaPost(env, 'batchRunReports', {
    requests: [
      { dateRanges, dimensions: [{ name: 'countryId' }, { name: 'country' },
        { name: 'deviceCategory' }],
        metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'engagedSessions' }],
        limit: 500 },
      { dateRanges, dimensions: [{ name: 'sessionSource' }, { name: 'sessionMedium' }],
        metrics: [{ name: 'sessions' }, { name: 'engagedSessions' }, { name: 'screenPageViews' }],
        limit: 12, orderBys: [{ metric: { metricName: 'sessions' }, desc: true }] },
      { dateRanges, dimensions: [{ name: 'eventName' }],
        metrics: [{ name: 'eventCount' }], limit: 200,
        orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }] },
      { dateRanges, dimensions: [{ name: 'date' }],
        metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'newUsers' },
          { name: 'engagementRate' }, { name: 'totalRevenue' }, { name: 'transactions' }],
        orderBys: [{ dimension: { dimensionName: 'date' } }], limit: 400 },
      { dateRanges, dimensions: [{ name: 'countryId' }, { name: 'eventName' }],
        metrics: [{ name: 'eventCount' }], limit: 2000,
        dimensionFilter: { filter: { fieldName: 'eventName',
          inListFilter: { values: LENS_EVENTS } } } },
    ],
  });
  const [countries, sources, events, daily, evmap] = resp.reports || [];

  // avg seconds-from-previous-step per funnel event (client sends
  // secs_since_prev since 14 Jul). Separate call + swallow errors: until the
  // custom metric is registered in GA4 admin, the API rejects it.
  const stepTimes = {};
  try {
    const st = await gaPost(env, 'runReport', {
      dateRanges,
      dimensions: [{ name: 'eventName' }],
      metrics: [{ name: 'averageCustomEvent:secs_since_prev' }],
      dimensionFilter: { filter: { fieldName: 'eventName', inListFilter: { values: [
        'builder_boot', 'builder_start', 'product_tile_click', 'sticker_pdp_view',
        'sticker_pdp_checkout', 'checkout_redirect', 'shop_view', 'select_item',
        'view_item', 'begin_checkout',
      ] } } },
      limit: 20,
    });
    for (const r of rows(st)) {
      const v = met(r, 0);
      if (v > 0) stepTimes[dim(r, 0)] = Math.round(v);
    }
  } catch (e) { /* metric not registered yet — funnel just shows no times */ }

  const dailyRows = rows(daily).map((r) => ({
    d: dim(r, 0), sessions: met(r, 0), users: met(r, 1), newUsers: met(r, 2),
    eng: met(r, 3), revenue: met(r, 4), tx: met(r, 5),
  }));
  const sum = (k) => dailyRows.reduce((a, x) => a + x[k], 0);
  const evmapObj = {};
  for (const r of rows(evmap)) {
    const cc = dim(r, 0); const ev = dim(r, 1);
    (evmapObj[ev] = evmapObj[ev] || {})[cc] = met(r, 0);
  }
  const data = {
    at: Date.now(), from, to,
    kpis: {
      sessions: sum('sessions'), users: sum('users'), newUsers: sum('newUsers'),
      engagementRate: dailyRows.length
        ? dailyRows.reduce((a, x) => a + x.eng * x.sessions, 0) / Math.max(1, sum('sessions')) : 0,
      revenue: sum('revenue'), transactions: sum('tx'),
    },
    daily: dailyRows,
    countries: Object.values(rows(countries).reduce((acc, r) => {
      const cc = dim(r, 0);
      acc[cc] = acc[cc] || { cc, name: dim(r, 1), sessions: 0, users: 0 };
      acc[cc].sessions += met(r, 0); acc[cc].users += met(r, 1);
      return acc;
    }, {})),
    devices: Object.values(rows(countries).reduce((acc, r) => {
      const dev = dim(r, 2);
      acc[dev] = acc[dev] || { dev, sessions: 0, engaged: 0 };
      acc[dev].sessions += met(r, 0); acc[dev].engaged += met(r, 2);
      return acc;
    }, {})).sort((a, b) => b.sessions - a.sessions),
    sources: rows(sources).map((r) => ({ source: dim(r, 0), medium: dim(r, 1),
      sessions: met(r, 0), engaged: met(r, 1), views: met(r, 2) })),
    events: rows(events).map((r) => ({ name: dim(r, 0), v: met(r, 0) })),
    eventMap: evmapObj,
    stepTimes,
  };
  rspCache.set(key, { t: Date.now(), data });
  return data;
}

// ── /api/report — the ANALYST BANANA's morning summary of yesterday ──────
// Generated on demand (no cron, no storage): by the time Trym wakes up,
// GA4's "yesterday" is queryable live — fresher than any 5AM snapshot.
// Cached per day in the isolate; regenerating costs two batch queries.
const FLAG_S = (cc) => (cc && cc.length === 2)
  ? String.fromCodePoint(127397 + cc.charCodeAt(0), 127397 + cc.charCodeAt(1)) : '·';
const escS = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function pctDelta(cur, prev) {
  if (!prev) return cur ? '<i class="up">new</i>' : '<i class="flat">—</i>';
  const d = Math.round(((cur - prev) / prev) * 100);
  if (d === 0) return '<i class="flat">±0%</i>';
  return d > 0 ? '<i class="up">▲' + d + '%</i>' : '<i class="down">▼' + Math.abs(d) + '%</i>';
}

async function gscYesterday(env, dateStr) {
  const tok = await gaToken(env);
  const r = await fetch('https://searchconsole.googleapis.com/webmasters/v3/sites/'
    + encodeURIComponent(env.GSC_SITE) + '/searchAnalytics/query', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
    body: JSON.stringify({ startDate: dateStr, endDate: dateStr, dataState: 'all', rowLimit: 1 }),
  });
  if (!r.ok) throw new Error('gsc ' + r.status);
  const d = await r.json();
  return (d.rows && d.rows[0]) || null;
}

async function apiReport(env) {
  const now = new Date();
  const osloDay = (offset) => {
    const d = new Date(now.getTime() - offset * 86400000);
    return d.toLocaleDateString('en-CA', { timeZone: 'Europe/Oslo' }); // YYYY-MM-DD
  };
  const yDate = osloDay(1);
  const hit = rspCache.get('report:' + yDate);
  if (hit && Date.now() - hit.t < 1800000) return hit.data; // fresh for 30 min

  const [cur, prev] = await Promise.all([
    apiRange(env, 'yesterday', 'yesterday'),
    apiRange(env, '2daysAgo', '2daysAgo'),
  ]);
  let gsc = null;
  try { gsc = await gscYesterday(env, yDate); } catch (e) { /* still baking */ }

  const ev = (R, name) => { for (const e of R.events) if (e.name === name) return e.v; return 0; };
  const k = cur.kpis, pk = prev.kpis;
  const nice = new Date(yDate + 'T12:00:00').toLocaleDateString('en-GB',
    { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Oslo' });

  const devLine = cur.devices.map((d) => {
    const share = k.sessions ? Math.round((d.sessions / k.sessions) * 100) : 0;
    const er = d.sessions ? Math.round((d.engaged / d.sessions) * 100) : 0;
    const ico = { desktop: '🖥', mobile: '📱', tablet: '📟' }[d.dev] || '';
    return ico + ' ' + share + '% (' + er + '% eng)';
  }).join(' · ');
  const srcLine = cur.sources.slice(0, 3).map((s) => {
    const er = s.sessions ? Math.round((s.engaged / s.sessions) * 100) : 0;
    return escS(s.source) + ' <b>' + s.sessions + '</b> (' + er + '%)';
  }).join(' · ');
  const geoLine = cur.countries.sort((a, b) => b.sessions - a.sessions).slice(0, 3)
    .map((c) => FLAG_S(c.cc) + ' ' + c.sessions).join(' · ');

  const fun = [ev(cur, 'builder_start'), ev(cur, 'sticker_pdp_view'),
    ev(cur, 'sticker_pdp_checkout'), ev(cur, 'checkout_redirect')];
  const merch = [ev(cur, 'shop_view'), ev(cur, 'select_item'), ev(cur, 'view_item')];

  // the analyst's verdicts — rule-based, max 3, most important first
  const notes = [];
  if (k.transactions > 0) notes.push('💰 <b>' + Math.round(k.revenue) + ' kr from '
    + k.transactions + ' purchase' + (k.transactions > 1 ? 's' : '') + '!</b> Check Shopify for details.');
  const sDelta = pk.sessions ? (k.sessions - pk.sessions) / pk.sessions : 0;
  if (Math.abs(sDelta) >= 0.3) notes.push(sDelta > 0
    ? 'Traffic jumped ' + Math.round(sDelta * 100) + '% vs the day before.'
    : 'Traffic dipped ' + Math.round(-sDelta * 100) + '% vs the day before.');
  const paid = cur.sources.find((s) => s.medium === 'paid' || s.medium === 'cpc');
  if (paid && k.sessions && paid.sessions / k.sessions > 0.5) {
    const er = paid.sessions ? Math.round((paid.engaged / paid.sessions) * 100) : 0;
    notes.push('Ads drove ' + Math.round((paid.sessions / k.sessions) * 100)
      + '% of traffic at ' + er + '% engagement — the organic core behaves differently, read them separately.');
  }
  if (fun[0] >= 10 && fun[1] === 0) notes.push('⚠ ' + fun[0]
    + ' customized bananas but nobody reached a product page — the custom funnel died at step one.');
  const gifs = ev(cur, 'gif_download'); const pgifs = ev(prev, 'gif_download');
  if (gifs >= 5 && pgifs && gifs / pgifs >= 2) notes.push('GIF downloads doubled (' + gifs + ') — something is spreading.');
  if (!notes.length) notes.push('A quiet, normal day on the floor. The banana kept dancing.');

  const lines = [
    '👥 <b>' + k.sessions + '</b> sessions ' + pctDelta(k.sessions, pk.sessions)
      + ' · ' + k.users + ' visitors · ' + k.newUsers + ' new · '
      + Math.round(k.engagementRate * 100) + '% engaged ' + pctDelta(k.engagementRate, pk.engagementRate),
    devLine,
    '🚪 ' + (srcLine || 'no source data'),
    '🌍 ' + (geoLine || 'nobody? spooky'),
    '🎬 ' + gifs + ' GIF downloads ' + pctDelta(gifs, pgifs)
      + ' · ' + ev(cur, 'builder_start') + ' bananas customized ' + pctDelta(ev(cur, 'builder_start'), ev(prev, 'builder_start'))
      + ' · ' + ev(cur, 'rave_join') + ' rave joins ' + pctDelta(ev(cur, 'rave_join'), ev(prev, 'rave_join')),
    '🏷️ Custom funnel (tee/sticker/magnet): customized <b>' + fun[0] + '</b> → PDP <b>' + fun[1] + '</b> → order <b>'
      + fun[2] + '</b> → checkout <b>' + fun[3] + '</b>',
    '👕 Merch: shop <b>' + merch[0] + '</b> → picked <b>' + merch[1] + '</b> → product page <b>' + merch[2] + '</b>',
    '💰 ' + Math.round(k.revenue) + ' kr · ' + k.transactions + ' purchases · '
      + ev(cur, 'begin_checkout') + ' checkout starts',
    gsc ? '🔎 Google: ' + Math.round(gsc.clicks) + ' clicks from ' + Math.round(gsc.impressions)
        + ' impressions (pos ' + (gsc.position || 0).toFixed(1) + ')'
      : '🔎 Google Search data still baking (GSC lags a day or two)',
  ];
  const data = { date: yDate, niceDate: nice, generatedAt: Date.now(), lines, notes };
  rspCache.set('report:' + yDate, { t: Date.now(), data });
  return data;
}

// ── the page ─────────────────────────────────────────────────────────────
function page() {
  const mapJson = JSON.stringify({ w: MAP_W, h: MAP_H, land: LAND_HEX, cent: CENTROIDS });
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive">
<title>🍌 Banana Pulse</title>
<style>
  :root{ --bg:#0d0b16; --panel:#171326; --line:#4a3f14; --ink:#f4eeff; --dim:#9a9070;
         --nana:#ffe135; --hot:#ff5d8f; --ok:#5ee08a; --bad:#ff6b6b; --cool:#5ec8e0; }
  *{ box-sizing:border-box; margin:0; padding:0; }
  html{ -webkit-text-size-adjust:100%; }
  body{ background:var(--bg); color:var(--ink);
        font-family:'Courier New',ui-monospace,monospace; font-weight:700;
        padding:14px; max-width:1180px; margin:0 auto; }
  h1{ font-size:clamp(1.3rem,4.5vw,2rem); letter-spacing:.06em; }
  h2{ font-size:.8rem; letter-spacing:.22em; text-transform:uppercase; color:var(--nana);
      margin-bottom:10px; }
  .head{ display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin-bottom:14px; }
  .head img{ width:44px; height:auto; image-rendering:pixelated; }
  .live-dot{ display:inline-block; width:10px; height:10px; background:var(--ok);
             box-shadow:0 0 8px var(--ok); animation:blink 1.2s steps(2) infinite; }
  @keyframes blink{ 50%{ opacity:.25; } }
  .bignum{ font-size:1.5rem; color:var(--nana); }
  .panel{ background:var(--panel); border:3px solid var(--nana); box-shadow:7px 7px 0 #000;
          padding:14px; margin-bottom:18px; }
  h1{ color:var(--nana); text-shadow:3px 3px 0 #000; }
  .grid2{ display:grid; grid-template-columns:1fr 1fr; gap:16px; }
  @media(max-width:800px){ .grid2{ grid-template-columns:1fr; } }
  canvas#map{ width:100%; image-rendering:pixelated; display:block; background:#151129;
              border:3px solid #000; }
  .hotline{ font-size:.74rem; margin-top:6px; color:var(--ok); }
  .hotline.gold{ color:#ffd700; text-shadow:0 0 8px rgba(255,215,0,.5); }
  .tt{ cursor:help; border-bottom:2px dotted #6b5c16; position:relative;
       -webkit-tap-highlight-color:transparent; }
  .tt:hover, .tt.show{ border-bottom-color:var(--nana); }
  .tt::after{ content:attr(data-tip); display:none; position:absolute; left:0; top:140%;
       z-index:9; width:250px; background:#000; border:2px solid var(--nana); color:var(--ink);
       padding:7px 9px; font-size:.68rem; font-weight:700; line-height:1.45; text-align:left;
       box-shadow:4px 4px 0 rgba(0,0,0,.6); white-space:normal; }
  .tt:hover::after, .tt.show::after{ display:block; }
  .chips{ display:flex; gap:6px; flex-wrap:wrap; margin:10px 0; }
  .chip{ font:inherit; font-size:.72rem; padding:5px 9px; background:#0a0814; color:#d8c96a;
         border:2px solid #6b5c16; cursor:pointer; letter-spacing:.05em; }
  .chip:hover{ border-color:var(--nana); color:var(--nana); }
  .chip.on{ background:var(--nana); color:#000; border-color:var(--nana); box-shadow:3px 3px 0 #000; }
  .mzoom{ position:absolute; top:8px; right:8px; z-index:6; display:flex; gap:6px; }
  .mzoom button{ font:inherit; font-weight:800; font-size:1rem; min-width:40px; min-height:40px;
    background:rgba(13,11,20,.85); color:#fffdf5; border:3px solid var(--nana); cursor:pointer;
    touch-action:manipulation; -webkit-tap-highlight-color:transparent; user-select:none; }
  .mzoom button:hover{ background:var(--nana); color:#111; }
  select,input[type=date]{ font:inherit; font-size:.72rem; background:#0a0814; color:var(--ink);
         border:2px solid var(--line); padding:4px 6px; }
  .ticker{ overflow:hidden; white-space:nowrap; border-block:2px solid var(--line);
           padding:7px 0; font-size:.78rem; }
  .ticker .in{ display:inline-block; padding-left:100%; animation:tick 17s linear infinite; }
  @keyframes tick{ to{ transform:translateX(-100%); } }
  .kpis{ display:grid; grid-template-columns:repeat(auto-fit,minmax(120px,1fr)); gap:10px; }
  .kpi{ background:var(--nana); border:3px solid #000; box-shadow:4px 4px 0 #000; padding:10px; }
  .kpi .l{ font-size:.62rem; color:#6b5a00; letter-spacing:.14em; text-transform:uppercase; }
  .kpi .v{ font-size:1.25rem; color:#111; margin-top:2px; }
  .kpi .d{ font-size:.68rem; margin-top:2px; }
  .up{ color:var(--ok); } .down{ color:var(--bad); } .flat{ color:var(--dim); }
  i.up, i.down, i.flat{ font-style:normal; }
  .kpi .up{ color:#0a7a3c; } .kpi .down{ color:#c81e1e; } .kpi .flat{ color:#6b5a00; }
  .fstep{ margin-bottom:8px; }
  .fstep .row{ display:flex; justify-content:space-between; font-size:.74rem; margin-bottom:3px; }
  .info{ display:inline-flex; align-items:center; justify-content:center; width:15px; height:15px;
         border:2px solid #6b5c16; color:#d8c96a; font-size:.6rem; font-style:normal;
         cursor:help; position:relative; vertical-align:1px; user-select:none;
         -webkit-tap-highlight-color:transparent; }
  .info:hover, .info.show{ border-color:var(--nana); color:var(--nana); }
  .info::after{ content:attr(data-tip); display:none; position:absolute; left:-10px; top:150%;
         z-index:9; width:230px; background:#000; border:2px solid var(--nana); color:var(--ink);
         padding:7px 9px; font-size:.68rem; font-weight:700; line-height:1.45; text-align:left;
         box-shadow:4px 4px 0 rgba(0,0,0,.6); white-space:normal; }
  .info:hover::after, .info.show::after{ display:block; }
  .fbar{ height:16px; background:#0a0814; border:2px solid var(--line); position:relative; overflow:hidden; }
  .fbar .fill{ height:100%; background:var(--nana); }
  .fbar.hotspot .fill{ background:var(--hot); box-shadow:0 0 10px var(--hot); }
  .fdrop{ font-size:.66rem; color:var(--dim); text-align:right; margin:2px 0 6px; }
  .fdrop b{ color:var(--hot); }
  table{ width:100%; border-collapse:collapse; font-size:.76rem; }
  td,th{ padding:5px 6px; text-align:left; border-bottom:1px solid var(--line); }
  td.num,th.num{ text-align:right; color:var(--nana); }
  .minibar{ height:8px; background:var(--nana); display:inline-block; vertical-align:middle; }
  .src .fbar .fill{ background:var(--cool); }
  .foot{ color:var(--dim); font-size:.66rem; text-align:center; margin:20px 0 8px; }
  .err{ background:var(--bad); color:#000; padding:8px 10px; font-size:.75rem; display:none;
        margin-bottom:12px; }
  .muted{ color:var(--dim); font-size:.7rem; }
  a{ color:var(--cool); }
</style></head><body>
<div class="head">
  <img src="https://trymstene.com/assets/dancing-banana-transparent.gif" alt="">
  <h1>BANANA PULSE</h1>
  <span class="live-dot"></span>
  <span><span class="bignum" id="liveTotal">…</span> <span class="muted">on the site right now</span></span>
  <canvas id="spark" width="120" height="26" style="image-rendering:pixelated;"></canvas>
  <button class="chip" id="rptBtn" style="position:relative;">🍌📊 MORNING REPORT<span id="rptDot" hidden
    style="position:absolute;top:-5px;right:-5px;width:11px;height:11px;background:var(--hot);
    border:2px solid #000;border-radius:0;box-shadow:0 0 8px var(--hot);"></span></button>
</div>
<div class="err" id="err"></div>

<!-- the ANALYST BANANA's speech bubble -->
<div id="rptWrap" style="display:none;position:fixed;inset:0;z-index:50;background:rgba(6,4,12,.72);
  align-items:flex-start;justify-content:center;padding:16px;overflow-y:auto;">
  <div style="max-width:560px;width:100%;margin-top:4vh;position:relative;">
    <div style="display:flex;align-items:flex-end;gap:4px;margin-left:6px;">
      <img src="https://trymstene.com/assets/dancing-banana-transparent.gif" alt=""
           style="width:54px;image-rendering:pixelated;">
      <div style="width:16px;height:16px;background:var(--panel);border-left:3px solid var(--nana);
           border-top:3px solid var(--nana);transform:rotate(45deg) translate(8px,8px);"></div>
    </div>
    <div class="panel" style="margin-bottom:40px;">
      <div style="display:flex;justify-content:space-between;align-items:start;gap:10px;">
        <h2 style="margin-bottom:4px;">📊 Yesterday, <span id="rptDate">…</span></h2>
        <button class="chip" id="rptClose" style="min-width:44px;min-height:38px;font-size:1rem;">✕</button>
      </div>
      <div id="rptBody" style="max-height:62vh;overflow-y:auto;-webkit-overflow-scrolling:touch;">
        <p class="muted">the analyst banana is crunching…</p>
      </div>
    </div>
  </div>
</div>

<div class="panel">
  <h2>🌍 Pixel earth</h2>
  <div style="position:relative;">
    <canvas id="map"></canvas>
    <div class="mzoom">
      <button id="zIn" aria-label="Zoom in">🔍+</button>
      <button id="zOut" aria-label="Zoom out" style="display:none;">−</button>
    </div>
    <div id="mapTip" style="display:none;position:absolute;pointer-events:none;z-index:5;
      background:#000;border:2px solid var(--nana);padding:7px 9px;font-size:.72rem;
      max-width:240px;box-shadow:4px 4px 0 rgba(0,0,0,.6);"></div>
  </div>
  <div class="chips" id="mapModes">
    <button class="chip on" data-mode="live">LIVE · who&#39;s on now</button>
    <button class="chip" data-mode="range">RANGE · visitors</button>
    <button class="chip" data-mode="event">RANGE · event lens:</button>
    <select id="lensSel"></select>
  </div>
  <div class="muted" id="mapLegend"></div>
  <div class="hotline" id="hotLine" style="display:none;"></div>
  <div class="ticker"><div class="in" id="ticker">warming up the decks…</div></div>
</div>

<div class="panel">
  <h2>📅 Time window <span class="muted">(everything below the map)</span></h2>
  <div class="chips" id="rangeChips">
    <button class="chip on" data-r="today,today">TODAY</button>
    <button class="chip" data-r="yesterday,yesterday">YESTERDAY</button>
    <button class="chip" data-r="6daysAgo,today">7 DAYS</button>
    <button class="chip" data-r="27daysAgo,today">28 DAYS</button>
    <input type="date" id="dFrom"> <input type="date" id="dTo">
    <button class="chip" id="dGo">GO</button>
  </div>
  <div class="kpis" id="kpis"></div>
  <div class="kpis" id="devRow" style="margin-top:10px;"></div>
  <p class="muted" style="margin-top:8px;">deltas = vs the previous window of the same length ·
     GA4 intraday lags ~4–8h, so “today” fills in through the day</p>
</div>

<div class="grid2">
  <div class="panel"><h2>🏷️ Custom banana funnel <span class="muted">(make-a-banana · tee/sticker/magnet)</span></h2><div id="fun0"></div></div>
  <div class="panel"><h2>👕 Official merch funnel <span class="muted">(/shop/)</span></h2><div id="fun1"></div></div>
</div>

<div class="grid2">
  <div class="panel src"><h2>🚪 Where they came from</h2><div id="sources"></div></div>
  <div class="panel"><h2>⚡ Top events</h2>
    <div class="chips" style="margin-top:0;">
      <button class="chip on" data-n="10">TOP 10</button>
      <button class="chip" data-n="20">TOP 20</button>
    </div>
    <table id="events"></table>
  </div>
</div>

<div class="grid2">
  <div class="panel"><h2>📄 On screen right now</h2><table id="livePages"></table></div>
  <div class="panel"><h2>🏙️ Cities visiting right now</h2><table id="liveCities"></table></div>
</div>

<p class="foot">🍌 private — token door, noindex, no links from anywhere · live refresh 30s · range refresh 5m</p>

<script>
var MAP = ${mapJson};
var TOKEN = new URLSearchParams(location.search).get('t') || '';
var FLAG = function(cc){ if(!cc||cc.length!==2) return '·';
  return String.fromCodePoint(127397+cc.charCodeAt(0),127397+cc.charCodeAt(1)); };
var EV_LABEL = {
  gif_download:'grabbed the GIF', png_download:'grabbed the PNG',
  wallpaper_download:'took a wallpaper',
  builder_boot:'the banana danced', builder_start:'customized a banana',
  generator_click:'headed to the builder', surprise_me:'hit surprise me',
  share_link_copy:'shared a banana', rave_join:'joined the rave',
  sticker_pdp_view:'eyed a custom product', sticker_pdp_checkout:'hit ORDER',
  checkout_redirect:'went to checkout 💰', select_item:'picked merch',
  view_item:'viewed merch', license_click:'read the license',
  tip_click:'eyed the tip jar 💛', forge_start:'fired up the forge',
  begin_checkout:'started checkout 💳', purchase:'PAID 💰💰💰',
  shop_view:'browsed the shop',
  rave_exit_stand:'slipped out to the stand 🏪', stand_counter:'reached the stand counter',
  stand_item_view:'eyed stand gear', stand_buy_try:'tried to BUY at the stand 🔥' };
var LENSES = ['gif_download','builder_boot','builder_start','rave_join','sticker_pdp_view',
  'checkout_redirect','begin_checkout','purchase','view_item','select_item',
  'wallpaper_download','license_click'];
// what each event MEANS — hover any event name to see what the visitor did
var EV_EXPLAIN = {
  page_view:'loaded any page on the site (GA4 auto)',
  session_start:'a new visit began (GA4 auto)',
  first_visit:'a brand-new visitor GA4 has never seen before',
  user_engagement:'stayed 10s+, clicked or scrolled (GA4 auto)',
  scroll:'scrolled 90% of the way down a page (GA4 auto)',
  click:'clicked an outbound link (GA4 auto)',
  file_download:'downloaded a file via a direct link (GA4 auto)',
  gif_download:'downloaded the dancing banana GIF — the classic grab',
  png_download:'downloaded their custom banana as a full-size meme image',
  wallpaper_download:'downloaded a wallpaper from the wallpaper page',
  builder_boot:'the make-a-banana page finished loading and the banana danced on their screen — the TRUE page-load signal (counting starts 14 Jul)',
  builder_start:'made their FIRST customization in the builder — an interaction, NOT a page load (⚠ was misread as "builder loaded" until 14 Jul; passive watchers never fire it)',
  generator_click:'clicked a make-your-own-banana link somewhere on the site',
  surprise_me:'hit SURPRISE ME in the builder — random outfit + caption',
  share_link_copy:'copied a share link to their custom banana',
  section_seen:'scrolled a key builder section into view (order button / take-home card / product tiles)',
  quick_action:'used a shortcut: the take-it-home button or the bottom bar',
  pdp_pose_pick:'picked which dance pose gets printed, on a product page',
  pdp_option_pick:'picked a tee color or size on the product page',
  sticker_pdp_view:'opened a custom-product page (sticker / magnet / tee) with THEIR banana on it',
  sticker_pdp_checkout:'clicked the big ORDER button on a custom-product page',
  checkout_redirect:'their design uploaded fine and they were sent to the Shopify checkout',
  sticker_order_fail:'the order pipeline errored before checkout — a spike here = something broke',
  sticker_order_fail_upload:'order failed while uploading the design (network/worker)',
  sticker_order_fail_cart:'order failed while creating the Shopify cart',
  sticker_order_fail_render:'order failed while rendering the print file (device/canvas)',
  sticker_order_fail_product:'order failed resolving the product/variant',
  begin_checkout:'a Shopify checkout page actually opened (store-wide)',
  purchase:'real money changed hands 💰 (via the Shopify→GA4 link)',
  shop_view:'opened the official Banana Shop front page (/shop/)',
  select_item:'clicked a product tile in the shop',
  view_item:'opened a merch product page (mug, tee & friends)',
  license_click:'opened the licensing page',
  tip_click:'clicked the buy-me-a-coffee link — a click, not a paid tip',
  rave_join:'stepped onto the rave dance floor',
  rave_run:'kept dancing — fires periodically while on the floor',
  rave_emote:'sent an emote at the rave',
  rave_fx:'triggered a dance-floor effect at the rave',
  rave_call:'answered a DJ call at the rave',
  rave_call_miss:'missed a DJ call at the rave',
  rave_hype:'helped fill the hype meter at the rave',
  rave_levelup:'earned rave rep and levelled up',
  rave_spotlight:'got the spotlight at the rave',
  rave_zoom:'used the rave camera zoom',
  rave_tour_start:'started the club tour with Barty',
  rave_share_night:'made a share-my-night card at the rave',
  rave_jelly_special:'found a rare jelly at the rave (rainbow flyby / mega pudding)',
  rave_invite_copy:'copied the rave invite link from the INVITE A FRIEND sign',
  rave_invite_nudge:'Barty nudged a lonely floor to bring a friend',
  rave_highfive:'fistbumped another real banana at the rave',
  patch_earn:'earned a badge (⚠ the OG badge auto-mints for every new visitor — inflated at traffic spikes)',
  pass_view:'opened their Banana Pass',
  forge_start:'started drawing in the Pixel Forge',
  forge_export:'exported a creation from the Pixel Forge',
  overlay_link_copy:'copied the OBS overlay link — a streamer!',
  rave_walk:'took their first steps on the dance floor (once per visit)',
  rave_beer:'won a happy-hour round at Barty’s bar',
  rave_snack:'caught a conveyor snack on the floor (kind = which one)',
  rave_gold:'caught THE GOLDEN BANANA 🏆 — the 30-minute rarity',
  rave_drop_catch:'caught tonight’s wearable drop — theirs forever (item = which)',
  rave_vinyl_pickup:'picked up the DJ’s lost vinyl',
  rave_vinyl_delivered:'carried the vinyl back to the booth — courier complete',
  rave_shot:'fired a confetti popper at another banana',
  rave_splat:'got splatted by a popper shot',
  rave_sit:'sat down on their own bar stool (a five-nightshift regular)',
  rave_screen_ad:'clicked a house ad on the LED club screen (ad = which one)',
  rave_exit_stand:'left the club through the EXIT by the bar → the banana stand (via = door or field-guide link)',
  stand_counter:'walked their banana up to the stand counter — the shop actually opened (once per visit)',
  stand_item_view:'tapped a shelf item at the banana stand — the spotlight look (item = which)',
  stand_buy_try:'pressed the LOCKED buy button at the stand 🔥 purchase intent BEFORE the till exists — this list prices S2b (item = which)' };
function explain(name){ return EV_EXPLAIN[name] || (EV_LABEL[name] ? 'a visitor '+EV_LABEL[name] : 'raw GA4 event — no explainer written for it yet'); }
var state = { mode:'live', lens:'gif_download', from:'today', to:'today',
              topN:10, live:null, range:null, prev:null };

function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function api(path){
  return fetch(path + (path.indexOf('?')>=0?'&':'?') + 't=' + encodeURIComponent(TOKEN))
    .then(function(r){
      return r.json().catch(function(){ return {}; }).then(function(d){
        if(r.status===503 && d.quota) throw new Error('QUOTA');
        if(!r.ok) throw new Error('api ' + r.status + (d.error? ' — '+d.error.slice(0,120):''));
        return d;
      });
    });
}
function friendly(e, what){
  if(e.message==='QUOTA')
    return 'GA4’s hourly quota is napping 💤 — keeping the last picture, fresh data returns within the hour';
  return what + ': ' + e.message;
}
function showErr(m){ var e=document.getElementById('err'); e.textContent='⚠ '+m; e.style.display='block';
  setTimeout(function(){ e.style.display='none'; }, 8000); }

// ── the pixel earth ──
var LAND = MAP.land.map(function(hexRow){
  var bits=''; for(var i=0;i<hexRow.length;i++){ bits+=('000'+parseInt(hexRow[i],16).toString(2)).slice(-4); }
  return bits; });
var mapCv = document.getElementById('map');
var PX = 6; mapCv.width = MAP.w*PX; mapCv.height = MAP.h*PX;
var mctx = mapCv.getContext('2d');
// the land never changes — render it ONCE so 60fps costs almost nothing
var landCv = document.createElement('canvas');
landCv.width = MAP.w*PX; landCv.height = MAP.h*PX;
var view = { s:1, ox:0, oy:0 }; // zoom scale + pan offset in map cells
function clampView(){
  view.s = Math.max(1, Math.min(5, view.s));
  view.ox = Math.max(0, Math.min(MAP.w - MAP.w/view.s, view.ox));
  view.oy = Math.max(0, Math.min(MAP.h - MAP.h/view.s, view.oy));
}
function mapData(){
  if(state.mode==='live') return (state.live? state.live.countries.map(function(c){ return {cc:c.cc,v:c.v,name:c.name}; }):[]);
  if(state.mode==='range') return (state.range? state.range.countries.map(function(c){ return {cc:c.cc,v:c.sessions,name:c.name}; }):[]);
  var em = state.range && state.range.eventMap[state.lens] || {};
  return Object.keys(em).map(function(cc){ return {cc:cc,v:em[cc],name:cc}; });
}
// corner brackets — the "locked on, close to buying" marker
function brackets(x,y,r,col){
  var o=r+2, b=2;
  mctx.fillStyle=col;
  [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(function(s){
    var cx=x+s[0]*o, cy=y+s[1]*o;
    // horizontal arm points inward, vertical arm points inward
    mctx.fillRect((s[0]<0?cx:cx-b+1)*PX, cy*PX, b*PX, PX);
    mctx.fillRect(cx*PX, (s[1]<0?cy:cy-b+1)*PX, PX, b*PX);
  });
}
var CONF_COLS=['#ffe135','#ff5d8f','#78ebff','#5ee08a'];
var confettiUntil=0;
function drawPin(d, hotStage){
  var x=d.x, y=d.y, r=Math.max(1,d.r);
  var t=performance.now()/1000;
  var col = state.mode==='event' ? '94,224,138' : state.mode==='range' ? '255,93,143' : '255,225,53';
  if(hotStage>=4) col='255,215,0';
  if(state.mode==='live'){ // two soft sonar rings — time-based, sub-pixel smooth
    var ringCol = hotStage>=2 ? '94,224,138' : col;
    var cx=(x+0.5)*PX, cy=(y+0.5)*PX;
    var seed=((x*7+y*13)%10)/10; // desync pins slightly so they don't march in step
    for(var k=0;k<2;k++){
      var p=(t/2.6 + k*0.5 + seed)%1;
      var rad=(r+0.5)*PX + p*3.5*PX;
      var a=Math.pow(1-p,2)*0.4;
      mctx.strokeStyle='rgba('+ringCol+','+a.toFixed(3)+')';
      mctx.lineWidth=PX*0.9;
      mctx.beginPath();
      mctx.arc(cx, cy, rad, 0, 6.2832);
      mctx.stroke();
    }
  }
  // drop shadow, then a rounded plus-shape body + a light catch pixel
  var w=2*r-1;
  function plus(ox,oy,fill){
    mctx.fillStyle=fill;
    if(r<2){ mctx.fillRect((x+ox)*PX,(y+oy)*PX,PX,PX); return; }
    // small pins stay solid squares — corner-rounding a 3×3 body leaves a "+"
    if(r<3){ mctx.fillRect((x-r+1+ox)*PX,(y-r+1+oy)*PX,w*PX,w*PX); return; }
    mctx.fillRect((x-r+1+ox)*PX,(y-r+2+oy)*PX,w*PX,(w-2)*PX);
    mctx.fillRect((x-r+2+ox)*PX,(y-r+1+oy)*PX,(w-2)*PX,w*PX);
  }
  plus(1,1,'rgba(0,0,0,.5)');
  plus(0,0,'rgb('+col+')');
  if(r>=2){ mctx.fillStyle='rgba(255,255,255,.85)';
    mctx.fillRect((x-r+2)*PX,(y-r+2)*PX,PX,PX); }
  if(hotStage>=2){ // soft breathing glow on the brackets while someone shops
    mctx.globalAlpha=0.4+0.6*(0.5+0.5*Math.sin(t*2.6));
    brackets(x,y,r, hotStage>=4?'#ffd700':'#5ee08a');
    mctx.globalAlpha=1;
  }
  if(d.v>1){ // count rides a little badge, not the pin's face
    var txt=String(d.v);
    mctx.font='bold '+(PX*2)+'px monospace'; mctx.textAlign='left';
    var tw=mctx.measureText(txt).width;
    var bx=(x+r)*PX+2, by=(y-r-2)*PX;
    if(bx+tw+6>MAP.w*PX) bx=(x-r)*PX-tw-8;
    if(by<0) by=(y+r+1)*PX;
    mctx.fillStyle='#000'; mctx.fillRect(bx-3, by-2, tw+7, PX*2+4);
    mctx.fillStyle='rgb('+col+')'; mctx.fillText(txt, bx, by+PX*1.7);
  }
}
(function paintLand(){
  var g=landCv.getContext('2d');
  g.fillStyle='#151129'; g.fillRect(0,0,landCv.width,landCv.height);
  g.fillStyle='#453a75';
  for(var y=0;y<MAP.h;y++){ var row=LAND[y];
    for(var x=0;x<MAP.w;x++){ if(row[x]==='1') g.fillRect(x*PX,y*PX,PX-1,PX-1); } }
})();
function drawMap(){
  mctx.setTransform(1,0,0,1,0,0);
  mctx.fillStyle='#151129'; mctx.fillRect(0,0,mapCv.width,mapCv.height);
  mctx.setTransform(view.s,0,0,view.s,-view.ox*PX*view.s,-view.oy*PX*view.s);
  mctx.drawImage(landCv,0,0);
  var data=mapData(); var max=1;
  data.forEach(function(d){ if(d.v>max) max=d.v; });
  var HOT=(state.mode==='live' && state.live && state.live.hot)||{};
  lastDots=[];
  data.forEach(function(d){
    var c=MAP.cent[d.cc]; if(!c) return;
    var r=1+Math.round(2*Math.sqrt(d.v/max));
    var hs=HOT[d.cc]||0;
    lastDots.push({x:c[0], y:c[1], r:r, cc:d.cc, name:d.name, v:d.v, hot:hs});
    drawPin(lastDots[lastDots.length-1], hs);
  });
  if(state.mode==='live'){ // hot countries whose visitor already left = small green ghosts
    Object.keys(HOT).forEach(function(cc){
      if(data.some(function(d){ return d.cc===cc; })) return;
      var c=MAP.cent[cc]; if(!c) return;
      var g={x:c[0], y:c[1], r:1, cc:cc, name:cc, v:0, hot:HOT[cc], ghost:true};
      lastDots.push(g);
      var gt=performance.now()/1000;
      mctx.fillStyle='rgba(94,224,138,'+(0.5+0.25*Math.sin(gt*2)).toFixed(3)+')';
      mctx.fillRect(c[0]*PX, c[1]*PX, PX, PX);
      mctx.globalAlpha=0.35+0.5*(0.5+0.5*Math.sin(gt*2.6));
      brackets(c[0], c[1], 1, '#5ee08a');
      mctx.globalAlpha=1;
    });
  }
  if(Date.now()<confettiUntil){ // 💰 the purchase rain
    mctx.setTransform(1,0,0,1,0,0);
    var t=Date.now()/40;
    for(var i=0;i<90;i++){
      mctx.fillStyle=CONF_COLS[i%4];
      var cx2=((i*97)%(MAP.w))*PX + ((i*31)%PX);
      var cy2=((t*(1+(i%3)*0.4) + i*137) % (MAP.h*PX+80)) - 40;
      mctx.fillRect(cx2, cy2, PX, PX);
    }
  }
  var lg=document.getElementById('mapLegend');
  var total=data.reduce(function(a,d){ return a+d.v; },0);
  lg.textContent = state.mode==='live'
    ? '● gold pings = visitors now ('+total+') · 🟢 brackets = close to buying (last 30 min) · gold+confetti = PAID'
    : state.mode==='range' ? '● pink = sessions, '+state.from+' → '+state.to+' ('+total+' total)'
    : '● green = “'+(EV_LABEL[state.lens]||state.lens)+'” ('+state.lens+'), '+state.from+' → '+state.to+' ('+total+' total)';
}
// 60fps via rAF (idles with the tab) — the old 120ms interval read as lag
(function mapLoop(){ if(!document.hidden) drawMap(); requestAnimationFrame(mapLoop); })();
var lastDots=[];

// hover a pulse → who/where/what they're looking at (LIVE mode gets pages)
var mapTip=document.getElementById('mapTip');
function tipFor(ev){
  var rect=mapCv.getBoundingClientRect();
  var cx=view.ox+(ev.clientX-rect.left)/rect.width*(MAP.w/view.s);
  var cy=view.oy+(ev.clientY-rect.top)/rect.height*(MAP.h/view.s);
  var best=null, bd=1e9;
  lastDots.forEach(function(d){
    var dx=Math.abs(cx-d.x), dy=Math.abs(cy-d.y);
    var dist=Math.max(dx,dy);
    if(dist<=d.r+1.5 && dist<bd){ bd=dist; best=d; }
  });
  if(!best){ mapTip.style.display='none'; return; }
  var html='<div style="color:var(--nana);">'+FLAG(best.cc)+' '+esc(best.name)+'</div>';
  if(state.mode==='live'){
    html+= best.ghost ? '<div class="muted">left already, but…</div>'
                      : '<div>'+best.v+' visiting now</div>';
    if(best.hot){
      var HOTTXT={1:'👀 eyeing a product',2:'🛒 hit ORDER',3:'💳 reached the CHECKOUT',4:'💰 BOUGHT!'};
      html+='<div style="color:'+(best.hot>=4?'#ffd700':'var(--ok)')+';">'
        +HOTTXT[best.hot]+' <span class="muted">(last 30 min)</span></div>';
    }
    var pgs=(state.live && state.live.countryPages && state.live.countryPages[best.cc])||[];
    pgs.slice(0,3).forEach(function(p){
      html+='<div class="muted">▸ '+esc(p.page)+(p.v>1?' ×'+p.v:'')+'</div>'; });
  } else if(state.mode==='range'){
    html+='<div>'+best.v+' sessions · '+state.from+' → '+state.to+'</div>';
  } else {
    html+='<div>'+best.v+'× '+(EV_LABEL[state.lens]||state.lens)+'</div>';
  }
  mapTip.innerHTML=html;
  mapTip.style.display='block';
  var wrap=mapCv.parentElement.getBoundingClientRect();
  var tx=ev.clientX-wrap.left+14, ty=ev.clientY-wrap.top+10;
  if(tx>wrap.width-250) tx=Math.max(4,tx-270);
  mapTip.style.left=tx+'px'; mapTip.style.top=ty+'px';
}
mapCv.addEventListener('mousemove', function(ev){ if(!drag.on) tipFor(ev); });
mapCv.addEventListener('mouseleave', function(){ mapTip.style.display='none'; });

// zoom — the rave's camera button, ported to the earth
var zIn=document.getElementById('zIn'), zOut=document.getElementById('zOut');
function setZoom(s){
  var cxc=view.ox+(MAP.w/view.s)/2, cyc=view.oy+(MAP.h/view.s)/2;
  view.s=s; view.ox=cxc-(MAP.w/s)/2; view.oy=cyc-(MAP.h/s)/2;
  clampView();
  zOut.style.display = view.s>1 ? '' : 'none';
  zIn.textContent = view.s>=5 ? '🔍 max' : '🔍+';
  mapCv.style.cursor = view.s>1 ? 'grab' : 'crosshair';
  mapCv.style.touchAction = view.s>1 ? 'none' : 'auto'; // pan the MAP when zoomed, the PAGE when not
  drawMap();
}
zIn.onclick=function(){ setZoom(Math.min(5, view.s+1)); };
zOut.onclick=function(){ setZoom(Math.max(1, view.s-1)); };

// drag to pan when zoomed; a tap without movement = the tooltip (mobile)
var drag={ on:false, moved:false, x:0, y:0, ox:0, oy:0 };
mapCv.addEventListener('pointerdown', function(ev){
  drag.on=true; drag.moved=false; drag.x=ev.clientX; drag.y=ev.clientY;
  drag.ox=view.ox; drag.oy=view.oy;
  mapCv.setPointerCapture(ev.pointerId);
  if(view.s>1) mapCv.style.cursor='grabbing';
});
mapCv.addEventListener('pointermove', function(ev){
  if(!drag.on || view.s<=1) return;
  var rect=mapCv.getBoundingClientRect();
  var dx=ev.clientX-drag.x, dy=ev.clientY-drag.y;
  if(Math.abs(dx)+Math.abs(dy)>6) drag.moved=true;
  if(drag.moved){
    mapTip.style.display='none';
    view.ox=drag.ox-dx/rect.width*(MAP.w/view.s);
    view.oy=drag.oy-dy/rect.height*(MAP.h/view.s);
    clampView(); drawMap();
  }
});
mapCv.addEventListener('pointerup', function(ev){
  var wasTap=!drag.moved; drag.on=false;
  mapCv.style.cursor = view.s>1 ? 'grab' : 'crosshair';
  if(wasTap) tipFor(ev);
});

// ── live widgets ──
function drawSpark(){
  var cv=document.getElementById('spark'); var cx=cv.getContext('2d');
  cx.clearRect(0,0,cv.width,cv.height);
  if(!state.live) return;
  var s=state.live.spark; var max=Math.max.apply(null,s.concat([1]));
  cx.fillStyle='#ffd23f';
  for(var i=0;i<30;i++){ var h=Math.round((s[i]/max)*22);
    cx.fillRect(i*4, 24-h, 3, h+1); }
}
function tbl(el, rows){
  el.innerHTML = rows.map(function(r){
    return '<tr><td>'+r[0]+'</td><td class="num">'+r[1]+'</td></tr>'; }).join('');
}
var lastPurch=-1;
function renderLive(){
  var L=state.live; if(!L) return;
  document.getElementById('liveTotal').textContent = L.total;
  drawSpark();
  renderDevices(); // refresh the "on now" per device
  tbl(document.getElementById('livePages'), L.pages.map(function(p){ return [esc(p.page), p.v]; }));
  tbl(document.getElementById('liveCities'), L.cities.map(function(c){ return [FLAG(c.cc)+' '+esc(c.city), c.v]; }));
  var t = L.recent.map(function(e){
    return '<span title="'+esc(explain(e.name))+'">'+FLAG(e.cc)+' '
      +esc(EV_LABEL[e.name]||e.name)+(e.v>1?' ×'+e.v:'')+'</span>'; });
  document.getElementById('ticker').innerHTML =
    t.length ? '⏱ Last 5 min:  '+t.join('   ·   ')+'   🍌' : 'quiet out there right now… the banana dances alone 🍌';
  // the hot line — who is CLOSE right now (stage 2+), gold when someone PAID
  var hot=L.hot||{}; var msgs=[]; var anyGold=false;
  var HOTTXT={2:'hit ORDER 🛒',3:'reached the CHECKOUT 💳',4:'BOUGHT 💰🎉'};
  Object.keys(hot).sort(function(a,b){ return hot[b]-hot[a]; }).forEach(function(cc){
    if(hot[cc]>=2 && msgs.length<4){ msgs.push(FLAG(cc)+' someone '+HOTTXT[hot[cc]]);
      if(hot[cc]>=4) anyGold=true; }
  });
  var hl=document.getElementById('hotLine');
  if(msgs.length){ hl.style.display='';
    hl.className='hotline'+(anyGold?' gold':'');
    hl.textContent='🟢 last 30 min: '+msgs.join('  ·  ');
  } else hl.style.display='none';
  // 💰 celebration: confetti over the pixel earth whenever a purchase shows up
  var p30=0; L.events.forEach(function(e){ if(e.name==='purchase') p30=e.v; });
  if(p30>Math.max(lastPurch,0)) confettiUntil=Date.now()+8000;
  lastPurch=p30;
}
function loadLive(){
  if(document.hidden) return; // background tabs don't spend quota
  api('/api/live').then(function(d){ state.live=d; renderLive(); })
    .catch(function(e){ showErr(friendly(e,'live')); });
}

// ── range widgets ──
function fmt(n){ return n>=10000 ? (n/1000).toFixed(1)+'k' : String(Math.round(n)); }
function delta(cur, prev){
  if(prev==null) return '';
  if(!prev) return cur? '<span class="up">new</span>' : '<span class="flat">—</span>';
  var d=Math.round(((cur-prev)/prev)*100);
  if(d===0) return '<span class="flat">±0%</span>';
  return d>0 ? '<span class="up">▲'+d+'%</span>' : '<span class="down">▼'+Math.abs(d)+'%</span>';
}
function evCount(R,name){ if(!R) return 0;
  for(var i=0;i<R.events.length;i++) if(R.events[i].name===name) return R.events[i].v; return 0; }
function stepVal(R,key){
  if(!R) return 0;
  if(key==='sessions') return R.kpis.sessions;
  if(key==='transactions') return R.kpis.transactions;
  return evCount(R,key);
}
var FUNNELS=[
  [['sessions','On the site',
    'A visit to trymstene.com — any page, any door. Everyone starts here.'],
   ['builder_boot','Banana danced',
    'The make-a-banana page finished loading and the banana danced on their screen — the TRUE page-load signal. Counting starts 14 Jul (new event).'],
   ['builder_start','Customized it',
    'They touched a control — a hat, a caption, surprise me… their first change to the banana. This is an INTERACTION, not a page load (it was mislabeled "Builder loaded" until 14 Jul).'],
   ['sticker_pdp_view','Product page',
    'They clicked to order their design and landed on a custom product page — tee, sticker or magnet, their banana on it.'],
   ['sticker_pdp_checkout','Hit ORDER',
    'They clicked the big ORDER button on a custom product page.'],
   ['checkout_redirect','→ Shopify checkout',
    'Their design uploaded fine and the browser sent them off to the Shopify checkout.'],
   ['begin_checkout','Checkout started ⌁store-wide',
    'Shopify saw a checkout page actually open. Store-wide: custom products AND official merch count together here.'],
   ['purchase','PAID 💰 ⌁store-wide',
    'Shopify reported real money paid. Store-wide — and stays 0 until the Shopify→GA4 purchase link is fixed (your errand in the G&Y channel).']],
  [['sessions','On the site',
    'A visit to trymstene.com — any page, any door. Everyone starts here.'],
   ['shop_view','Browsed the shop',
    'They opened the Banana Shop front page (/shop/) and saw the product grid. Counting starts 13 Jul — the event is new.'],
   ['select_item','Picked a product',
    'They clicked a product tile in the Banana Shop (/shop/).'],
   ['view_item','Product page',
    'They opened a merch product page — mug, tee, and friends.'],
   ['transactions','Purchases 💰',
    'Completed paid orders as GA4 counts them — rides the same broken Shopify purchase link, so 0 for now.']]];
function fmtDur(s){
  if(s<90) return s+'s';
  return Math.floor(s/60)+'m '+(s%60)+'s';
}
function renderFunnel(el, steps){
  var R=state.range, P=state.prev;
  var times=(R&&R.stepTimes)||{};
  var vals=steps.map(function(s){ return stepVal(R,s[0]); });
  var pvals=steps.map(function(s){ return P? stepVal(P,s[0]) : null; });
  // worst transition by rate, but only where the base is big enough to mean
  // something — 0/12 must not outrank 12/197 (the tail steps are tiny)
  var worst=-1, worstRate=2, MIN_N=20;
  for(var i=1;i<vals.length;i++){ var rate=vals[i-1]? vals[i]/vals[i-1] : 1;
    if(vals[i-1]>=MIN_N && rate<worstRate){ worstRate=rate; worst=i; } }
  if(worst<0) for(var i=1;i<vals.length;i++){ var rate=vals[i-1]? vals[i]/vals[i-1] : 1;
    if(vals[i-1]>0 && rate<worstRate){ worstRate=rate; worst=i; } }
  var html='';
  for(var i=0;i<steps.length;i++){
    // clamp the BAR to its track: a later step can legitimately exceed step 0
    // (GA4 counts events, not sessions — "banana danced" can fire more than
    // once per visit, or carry over from a session that started earlier), which
    // rendered a >100% fill that burst out of the panel. The honest % still
    // prints in the drop-line below; only the drawn bar is capped.
    var pct=vals[0]? Math.min(100,Math.max(1.2,(vals[i]/vals[0])*100)) : 0;
    var conv=i>0 ? (vals[i-1]? Math.round((vals[i]/vals[i-1])*100) : 0) : null;
    var lbl=steps[i][1].replace(' ⌁store-wide',' <span class="muted">(store-wide)</span>');
    if(steps[i][2]) lbl+=' <span class="info" data-tip="'+esc(steps[i][2])+'">i</span>';
    // avg seconds the CONVERTERS took to get here from the previous step
    var t=times[steps[i][0]];
    var tTxt=(i>0 && t)?' · ⌀ '+fmtDur(t)+' to get here':'';
    // the hotspot marks the step people STALL ON (the page to fix), not the
    // step they fail to reach — worst is the arrival index, so mark worst-1
    html+='<div class="fstep"><div class="row"><span>'+lbl+'</span>'+
      '<span>'+fmt(vals[i])+' '+delta(vals[i],pvals[i])+'</span></div>'+
      '<div class="fbar'+(i===worst-1?' hotspot':'')+'"><div class="fill" style="width:'+pct+'%"></div></div>'+
      (i>0?'<div class="fdrop">'+conv+'% make it from “'+steps[i-1][1].replace(/ ⌁.*$/,'')+'”'+tTxt+'</div>':'')+
      (i===worst-1?'<div class="fdrop"><b>⟵ WORK HERE · </b>only '+Math.round(worstRate*100)+'% continue to “'+steps[worst][1].replace(/ ⌁.*$/,'')+'”</div>':'')+
      '</div>';
  }
  el.innerHTML=html;
}
var DEV_ICON={ desktop:'🖥', mobile:'📱', tablet:'📟' };
function renderDevices(){
  var R=state.range; if(!R || !R.devices) return;
  var P=state.prev, L=state.live;
  var prevOf=function(dev){ if(!P||!P.devices) return null;
    for(var i=0;i<P.devices.length;i++) if(P.devices[i].dev===dev) return P.devices[i].sessions;
    return 0; };
  document.getElementById('devRow').innerHTML = R.devices.map(function(d){
    var er=d.sessions? Math.round((d.engaged/d.sessions)*100):0;
    var now=(L&&L.devices&&L.devices[d.dev])||0;
    return '<div class="kpi"><div class="l">'+(DEV_ICON[d.dev]||'')+' '+esc(d.dev)+'</div>'+
      '<div class="v">'+fmt(d.sessions)+' <span style="font-size:.7rem;">'+delta(d.sessions,prevOf(d.dev))+'</span></div>'+
      '<div class="d" style="color:#6b5a00;">'+er+'% engaged'+(now?' · <b>'+now+' on now</b>':'')+'</div></div>';
  }).join('');
}
function renderRange(){
  var R=state.range, P=state.prev; if(!R) return;
  var k=R.kpis, pk=P&&P.kpis;
  var kr = k.revenue>0 ? Math.round(k.revenue)+' kr' : '0 kr';
  document.getElementById('kpis').innerHTML =
    kpi('Sessions',fmt(k.sessions),delta(k.sessions,pk&&pk.sessions))+
    kpi('Visitors',fmt(k.users),delta(k.users,pk&&pk.users))+
    kpi('New',fmt(k.newUsers),delta(k.newUsers,pk&&pk.newUsers))+
    kpi('Engagement',Math.round(k.engagementRate*100)+'%',delta(k.engagementRate,pk&&pk.engagementRate))+
    kpi('Revenue',kr,delta(k.revenue,pk&&pk.revenue))+
    kpi('Purchases',fmt(k.transactions),delta(k.transactions,pk&&pk.transactions));
  function kpi(l,v,d){ return '<div class="kpi"><div class="l">'+l+'</div><div class="v">'+v+'</div><div class="d">'+d+'</div></div>'; }
  // GA4 sometimes takes >12h to produce ANY intraday rows for a new day —
  // say so instead of showing spooky zeros (the live layer is unaffected)
  var lateNote=document.getElementById('lateNote');
  if(lateNote) lateNote.remove();
  if(state.to==='today' && k.sessions===0){
    document.getElementById('kpis').insertAdjacentHTML('afterend',
      '<p class="muted" id="lateNote" style="margin-top:8px;color:var(--hot);">'+
      '⏳ GA4 hasn’t produced today’s report data yet (Google-side intraday lag, sometimes 12h+). '+
      'The LIVE map and ticker above are unaffected — today’s numbers will backfill on their own.</p>');
  }
  renderDevices();
  renderFunnel(document.getElementById('fun0'),FUNNELS[0]);
  renderFunnel(document.getElementById('fun1'),FUNNELS[1]);
  if(state.to==='today' && k.sessions===0){ // the funnels ride the same lagged window
    ['fun0','fun1'].forEach(function(id){
      document.getElementById(id).insertAdjacentHTML('afterbegin',
        '<p class="muted" style="margin-bottom:8px;color:var(--hot);">⏳ waiting for GA4’s intraday data — today’s visits land here when Google catches up</p>');
    });
  }
  var smax=R.sources.length? R.sources[0].sessions:1;
  document.getElementById('sources').innerHTML = R.sources.slice(0,8).map(function(s){
    var er=s.sessions? Math.round((s.engaged/s.sessions)*100):0;
    var pps=s.sessions? (s.views/s.sessions).toFixed(1):'0';
    return '<div class="fstep"><div class="row"><span>'+esc(s.source+' / '+s.medium)+'</span>'+
      '<span>'+fmt(s.sessions)+' <span class="muted">· '+er+'% eng · '+pps+' pg/s</span></span></div>'+
      '<div class="fbar"><div class="fill" style="width:'+Math.max(2,(s.sessions/smax)*100)+'%"></div></div></div>';
  }).join('');
  var evs=R.events.filter(function(e){ return e.name!=='session_start'&&e.name!=='first_visit'; })
    .slice(0,state.topN);
  var emax=evs.length? evs[0].v:1;
  document.getElementById('events').innerHTML =
    evs.map(function(e){ return '<tr><td><span class="tt" data-tip="'+esc(explain(e.name))+'">'+esc(e.name)+'</span></td>'+
      '<td><span class="minibar" style="width:'+Math.max(2,Math.round((e.v/emax)*90))+'px"></span></td>'+
      '<td class="num">'+fmt(e.v)+'</td></tr>'; }).join('');
  drawMap();
}
function prevWindow(from,to){
  function toDate(s){
    var t=new Date(); t.setHours(12,0,0,0);
    if(s==='today') return t;
    if(s==='yesterday'){ t.setDate(t.getDate()-1); return t; }
    var m=s.match(/^(\\d+)daysAgo$/); if(m){ t.setDate(t.getDate()-Number(m[1])); return t; }
    return new Date(s+'T12:00:00');
  }
  function iso(d){ return d.toISOString().slice(0,10); }
  var a=toDate(from), b=toDate(to);
  var len=Math.round((b-a)/86400000)+1;
  var pb=new Date(a); pb.setDate(pb.getDate()-1);
  var pa=new Date(pb); pa.setDate(pa.getDate()-(len-1));
  return [iso(pa),iso(pb)];
}
function loadRange(){
  var pw=prevWindow(state.from,state.to);
  Promise.all([
    api('/api/range?from='+state.from+'&to='+state.to),
    api('/api/range?from='+pw[0]+'&to='+pw[1]),
  ]).then(function(rs){ state.range=rs[0]; state.prev=rs[1]; renderRange(); })
   .catch(function(e){ showErr(friendly(e,'range')); });
}

// ── controls ──
var lensSel=document.getElementById('lensSel');
lensSel.innerHTML=LENSES.map(function(l){ return '<option value="'+l+'">'+(EV_LABEL[l]||l)+'</option>'; }).join('');
lensSel.onchange=function(){ state.lens=lensSel.value; state.mode='event'; syncModeChips(); drawMap(); };
function syncModeChips(){
  document.querySelectorAll('#mapModes .chip').forEach(function(c){
    c.classList.toggle('on', c.dataset.mode===state.mode); });
}
document.querySelectorAll('#mapModes .chip').forEach(function(c){
  c.onclick=function(){ state.mode=c.dataset.mode; syncModeChips(); drawMap(); }; });
document.querySelectorAll('#rangeChips .chip[data-r]').forEach(function(c){
  c.onclick=function(){
    document.querySelectorAll('#rangeChips .chip').forEach(function(x){ x.classList.remove('on'); });
    c.classList.add('on');
    var p=c.dataset.r.split(','); state.from=p[0]; state.to=p[1]; loadRange(); }; });
document.getElementById('dGo').onclick=function(){
  var f=document.getElementById('dFrom').value, t=document.getElementById('dTo').value;
  if(!f||!t) return;
  document.querySelectorAll('#rangeChips .chip').forEach(function(x){ x.classList.remove('on'); });
  state.from=f; state.to=t; loadRange(); };
document.querySelectorAll('.chip[data-n]').forEach(function(c){
  c.onclick=function(){
    document.querySelectorAll('.chip[data-n]').forEach(function(x){ x.classList.remove('on'); });
    c.classList.add('on'); state.topN=Number(c.dataset.n); renderRange(); }; });

// ── THE ANALYST BANANA: yesterday's report in a speech bubble ──
// NEW dot until the day's report has been opened once (per browser).
(function(){
  var wrap=document.getElementById('rptWrap');
  var btn=document.getElementById('rptBtn');
  var dot=document.getElementById('rptDot');
  function osloYesterday(){
    return new Date(Date.now()-86400000).toLocaleDateString('en-CA',{timeZone:'Europe/Oslo'});
  }
  function refreshDot(){
    var read=''; try{ read=localStorage.getItem('pulse-rpt-read')||''; }catch(e){}
    dot.hidden = (read===osloYesterday());
  }
  refreshDot();
  setInterval(refreshDot, 600000); // a new day re-lights the dot without a reload
  btn.onclick=function(){
    wrap.style.display='flex';
    try{ localStorage.setItem('pulse-rpt-read', osloYesterday()); }catch(e){}
    refreshDot();
    api('/api/report').then(function(r){
      document.getElementById('rptDate').textContent=r.niceDate;
      document.getElementById('rptBody').innerHTML =
        r.lines.map(function(l){ return '<p style="margin:0 0 9px;font-size:.85rem;line-height:1.5;">'+l+'</p>'; }).join('')
        + '<div style="border-top:2px solid var(--line);margin:12px 0 9px;"></div>'
        + r.notes.map(function(n){ return '<p style="margin:0 0 9px;font-size:.85rem;line-height:1.5;color:var(--nana);">⭐ '+n+'</p>'; }).join('')
        + '<p class="muted" style="margin-top:10px;">the analyst banana · numbers can still settle through the morning (GA4 processing lag)</p>';
    }).catch(function(e){
      document.getElementById('rptBody').innerHTML='<p class="muted">⚠ '+friendly(e,'report')+'</p>';
    });
  };
  document.getElementById('rptClose').onclick=function(){ wrap.style.display='none'; };
  wrap.addEventListener('click', function(e){ if(e.target===wrap) wrap.style.display='none'; });
})();

// info ⓘ + event-name tooltips on touch: tap toggles, tapping elsewhere closes
document.addEventListener('click', function(e){
  var cl = e.target.classList;
  var isTip = cl && (cl.contains('info') || cl.contains('tt'));
  document.querySelectorAll('.info.show, .tt.show').forEach(function(el){
    if(el!==e.target) el.classList.remove('show'); });
  if(isTip) e.target.classList.toggle('show');
});

loadLive(); loadRange();
setInterval(loadLive, 60000);
setInterval(function(){ if(state.to==='today' && !document.hidden) loadRange(); }, 300000);
document.addEventListener('visibilitychange', function(){
  if(!document.hidden){ loadLive(); if(state.to==='today') loadRange(); }
});
</script>
</body></html>`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const t = (url.searchParams.get('t') || '').trim();
    if (!env.DASH_TOKEN || t !== env.DASH_TOKEN.trim()) return deny();

    try {
      if (url.pathname === '/api/live') {
        return new Response(JSON.stringify(await apiLive(env)), {
          headers: noRobots({ 'Content-Type': 'application/json' }),
        });
      }
      if (url.pathname === '/api/report') {
        return new Response(JSON.stringify(await apiReport(env)), {
          headers: noRobots({ 'Content-Type': 'application/json' }),
        });
      }
      if (url.pathname === '/api/range') {
        const from = url.searchParams.get('from') || 'today';
        const to = url.searchParams.get('to') || 'today';
        return new Response(JSON.stringify(await apiRange(env, from, to)), {
          headers: noRobots({ 'Content-Type': 'application/json' }),
        });
      }
      if (url.pathname === '/') {
        return new Response(page(), {
          headers: noRobots({
            'Content-Type': 'text/html; charset=utf-8',
            'Content-Security-Policy':
              "default-src 'none'; img-src https://trymstene.com; style-src 'unsafe-inline'; "
              + "script-src 'unsafe-inline'; connect-src 'self'",
          }),
        });
      }
      return deny();
    } catch (e) {
      const msg = String(e.message || e);
      const quota = msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED');
      return new Response(JSON.stringify({ error: msg.slice(0, 300), quota }), {
        status: quota ? 503 : 502,
        headers: noRobots({ 'Content-Type': 'application/json' }),
      });
    }
  },
};
