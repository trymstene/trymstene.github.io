// ═══════════════════════════════════════════════════════════════════════
// 🍌 BANANA PULSE — Trym's private realtime dashboard.
// One worker: token door → GA4 proxy (realtime + core reports) → one page.
// The browser never sees the GA4 key; Google never sees the browser.
// Wrong token = a plain 404, indistinguishable from nothing existing.
// ═══════════════════════════════════════════════════════════════════════
import { analyse } from './analyst.js';
import { writeReport } from './writer.js';

const GA = 'https://analyticsdata.googleapis.com/v1beta/properties/';

// 📥 the download family + the offer that rides it. Downloads are the
// biggest thing that happens on this site; until now they were one number.
const DL_EVENTS = ['gif_download', 'png_download', 'wallpaper_download',
  'offer_shown', 'offer_click', 'offer_skip',
  'offer_world', 'offer_discord',    // 🌍💬 the warm-up pivot, 12 Aug (offer_click = retired merch CTA)
  'offer_support',                   // ☕ the SUPPORT TEST, 27 Aug – 5 Sep
  'offer_pack', 'offer_swap'];       // 🎟 THE PACK CARD, 5 Sep — the card shows a sticker pack now

// events worth plotting on the map / showing in the ticker (the rest is noise)
const LENS_EVENTS = [
  'gif_download', 'png_download', 'wallpaper_download', 'builder_boot', 'builder_start',
  'generator_click', 'surprise_me', 'share_link_copy', 'rave_join',
  'sticker_pdp_view', 'sticker_pdp_checkout', 'pdp_add_to_order', 'checkout_redirect',
  'select_item', 'view_item', 'license_click', 'tip_click', 'forge_start',
  'begin_checkout', 'purchase', 'shop_view',
  'offer_shown', 'offer_click', 'offer_skip',   // 🛍 the make-it-real card (offer-FIRST since 6 Aug)
  'offer_world', 'offer_discord',               // 🌍💬 the warm-up pivot, 12 Aug (retired 27 Aug)
  'offer_support',                              // ☕ the support ask, 27 Aug (retired 5 Sep)
  'offer_pack',                                 // 🎟 the pack card, 5 Sep
  'homestead_open',               // 🏡 the home area's door, 6 Aug
  'homestead_save_refused', 'homestead_reattach', 'pass_sync_refused', 'pass_reminted',   // 🚨 sync health, 6 Sep
  'pass_ask_shown', 'pass_ask_tap', 'pass_mail_signin', 'pass_mail_login', 'pass_mail_attached',   // 🎫 the save ask → a kept pass, 6 Sep
  'park_citizens', 'citizens_keep',   // 🏆 the citizens' wall, 6 Sep
  'quest_step',                   // 🕯 chapter-1 funnel, live 13 Aug
  'shop_door',                    // 🚪 the world→commerce bridge, 31 Jul
  // 🏪 every in-world shopfront, 1 Aug — these are real storefronts and
  // deserve the map lens as much as any download does
  'stand_counter', 'stand_buy', 'stand_cart_view',
  'beach_hut_view', 'park_seedshop', 'rave_screen_ad',
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
    sticker_pdp_view: 1, view_item: 1, select_item: 1, offer_pack: 1,
    sticker_pdp_checkout: 2, pdp_add_to_order: 2, add_to_cart: 2, checkout_redirect: 3, begin_checkout: 3, purchase: 4,
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

// YYYY-MM-DD in the property's timezone, `back` days before now
const osloDate = (back) => new Date(Date.now() - back * 86400000)
  .toLocaleDateString('en-CA', { timeZone: 'Europe/Oslo' });

// every YYYYMMDD key a window covers, oldest→newest. ⚠️ GA4 omits any row
// whose metrics are all zero, so an empty day must be GENERATED or it vanishes
// out of the series instead of reading 0. Stepping from a UTC midnight keeps
// the count exact across a DST weekend.
function rangeDayKeys(from, to) {
  const resolve = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? s
    : osloDate(s === 'today' ? 0 : s === 'yesterday' ? 1 : Number(s.replace('daysAgo', ''))));
  const a = Date.parse(resolve(from) + 'T00:00:00Z');
  const b = Date.parse(resolve(to) + 'T00:00:00Z');
  const out = [];
  if (!(a <= b)) return out;
  for (let t = a; t <= b; t += 86400000) {
    out.push(new Date(t).toISOString().slice(0, 10).replace(/-/g, ''));
  }
  return out;
}

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
        metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }], limit: 200,
        orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }] },
      // ⚠️ metricAggregations is the ONLY deduped read of totalUsers. GA4
      // dedupes people inside a row, never across the date dimension, so
      // summing the daily column counts a five-day visitor five times. Costs
      // no extra request — the total rides back in the same response.
      // 📈 active1/7/28DayUsers are GA4's OWN rolling windows: on any given day,
      // how many distinct people had been on the site in the last 1 / 7 / 28.
      // Two things make them worth the columns: they are computed by Google, so
      // they go BACKWARDS — our own rollup only knows days since the cron
      // started — and they count VISITORS, where the pass rollup counts people
      // who have a banana pass. Different questions, both true, never mixed.
      { dateRanges, dimensions: [{ name: 'date' }],
        metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'newUsers' },
          { name: 'engagementRate' }, { name: 'totalRevenue' }, { name: 'transactions' },
          { name: 'active1DayUsers' }, { name: 'active7DayUsers' }, { name: 'active28DayUsers' }],
        metricAggregations: ['TOTAL'],
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
  // 📥 the downloads room: which SURFACE gave the file away, and what the
  // offer did there. pagePath needs no custom dimension registered — the
  // `from` param on offer_* would, so the page split carries this instead.
  //
  // ⚠️ ITS OWN CALL, NOT A 6TH BATCH ENTRY: GA4 caps batchRunReports at FIVE
  // requests and rejects the whole batch with a 400 if you add a sixth — which
  // takes the entire dashboard down, not just the new panel.
  // ⚠️ date is in here so ONE call feeds both the per-surface table and the
  // per-day shape. A generous limit because date × page × event multiplies fast
  // on a 28-day window, and a truncated tail would silently bend the daily bars.
  const dlsP = gaPost(env, 'runReport', {
    dateRanges,
    dimensions: [{ name: 'date' }, { name: 'pagePath' }, { name: 'eventName' }],
    metrics: [{ name: 'eventCount' }], limit: 20000,
    dimensionFilter: { filter: { fieldName: 'eventName',
      inListFilter: { values: DL_EVENTS } } },
  }).catch(() => null);

  // 📣 THE CAMPAIGN SPLIT (13 Aug) — the source panel says "instagram /
  // paid_social", which cannot tell one ad from the next. This adds the
  // utm_campaign × utm_content rows underneath, so a paid push can be read
  // creative by creative. Its OWN call: the batch above is at GA4's hard cap
  // of five requests, and a sixth 400s the whole dashboard.
  // ⚠️ falls back to campaign-only if sessionManualAdContent is rejected, and
  // to nothing at all if the campaign dimension itself fails — a missing panel
  // must never take the page down.
  const campP = gaPost(env, 'runReport', {
    dateRanges,
    dimensions: [{ name: 'sessionCampaignName' }, { name: 'sessionManualAdContent' }],
    metrics: [{ name: 'sessions' }, { name: 'engagedSessions' }],
    limit: 12, orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
  }).catch(() => gaPost(env, 'runReport', {
    dateRanges,
    dimensions: [{ name: 'sessionCampaignName' }],
    metrics: [{ name: 'sessions' }, { name: 'engagedSessions' }],
    limit: 12, orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
  }).catch(() => null));

  // 🎟 which list a product click came from: the shop grid ("(not set)"), a
  // shop strip, the GIF page's pack carousel. Item-scoped on both sides —
  // itemListName × itemsClickedInList — the pairing GA4 accepts (its event-
  // scoped cousin itemListClickEvents is refused as incompatible; tested 5 Sep).
  // Its own request (the batch is full at five) and it fails soft: a null
  // reaches the page as "no section", never as a zero.
  const listsP = gaPost(env, 'runReport', {
    dateRanges,
    dimensions: [{ name: 'itemListName' }],
    metrics: [{ name: 'itemsClickedInList' }, { name: 'itemsViewedInList' }],   // 🎟 6 Sep: viewed too — the download card's headlines are lists
    limit: 40, orderBys: [{ metric: { metricName: 'itemsClickedInList' }, desc: true }],
  }).catch(() => null);

  const stepTimes = {};
  try {
    const st = await gaPost(env, 'runReport', {
      dateRanges,
      dimensions: [{ name: 'eventName' }],
      metrics: [{ name: 'averageCustomEvent:secs_since_prev' }],
      dimensionFilter: { filter: { fieldName: 'eventName', inListFilter: { values: [
        'builder_boot', 'builder_start', 'product_tile_click', 'sticker_pdp_view',
        'sticker_pdp_checkout', 'checkout_redirect', 'shop_view', 'select_item',
        'view_item', 'begin_checkout', 'offer_shown', 'offer_click', 'offer_pack',
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
    a1: met(r, 6), a7: met(r, 7), a28: met(r, 8),
  }));
  const sum = (k) => dailyRows.reduce((a, x) => a + x[k], 0);
  // 👥 people, counted once for the whole window. metricValues here follow the
  // daily request's metric order, so totalUsers is index 1. newUsers stays a
  // plain sum — a new user is new on exactly one day, so it IS additive.
  const dailyTot = daily && daily.totals && daily.totals[0] && daily.totals[0].metricValues;
  const windowUsers = dailyTot && dailyTot[1] ? Number(dailyTot[1].value) || 0 : sum('users');
  const evmapObj = {};
  for (const r of rows(evmap)) {
    const cc = dim(r, 0); const ev = dim(r, 1);
    (evmapObj[ev] = evmapObj[ev] || {})[cc] = met(r, 0);
  }
  const dls = await dlsP;
  const campRes = await campP;
  const listsRes = await listsP;
  const dlMap = {};
  const dayMap = {};
  const DL_KEY = { gif_download: 'gif', png_download: 'png', wallpaper_download: 'wall',
    offer_shown: 'shown', offer_click: 'click', offer_skip: 'skip',
    offer_world: 'world', offer_discord: 'disc', offer_support: 'coffee',
    offer_pack: 'pack', offer_swap: 'swap' };
  for (const r of (dls ? rows(dls) : [])) {
    const day = dim(r, 0); const page = dim(r, 1);
    const key = DL_KEY[dim(r, 2)];
    if (!key) continue;
    const v = met(r, 0);
    const row = dlMap[page] || (dlMap[page] = { page, gif: 0, png: 0, wall: 0, shown: 0, click: 0, skip: 0, world: 0, disc: 0, coffee: 0, pack: 0, swap: 0 });
    row[key] += v;
    const d = dayMap[day] || (dayMap[day] = { d: day, files: 0, shown: 0, click: 0, skip: 0, world: 0, disc: 0, coffee: 0, pack: 0, swap: 0 });
    if (key === 'gif' || key === 'png' || key === 'wall') d.files += v; else d[key] += v;
  }
  // ⚠️ a day with no download events sends no row, so the bars used to close
  // the gap up and imply a continuity the window never had. Walk the window's
  // own dates and draw the missing ones as real zeros. An all-empty window
  // stays EMPTY — the chart's "nothing in this window" line beats 28 flat bars.
  const dlKeys = [...new Set(rangeDayKeys(from, to).concat(Object.keys(dayMap)))].sort();
  const dlDaily = Object.keys(dayMap).length
    ? dlKeys.map((d) => dayMap[d]
      || { d, files: 0, shown: 0, click: 0, skip: 0, world: 0, disc: 0, coffee: 0, pack: 0, swap: 0 })
    : [];
  const downloads = Object.values(dlMap)
    .map((r) => ({ ...r, files: r.gif + r.png + r.wall }))
    // ⚠️ keep offer-only rows: a surface showing the card with NOTHING
    // downloaded is a wiring bug, and dropping it would hide exactly that.
    .filter((r) => r.files > 0 || r.shown > 0)
    .sort((a, b) => (b.files - a.files) || (b.shown - a.shown))
    .slice(0, 40);

  const data = {
    at: Date.now(), from, to,
    downloads, dlDaily,
    // null = the report failed (the room hides the section); [] = nobody clicked
    lists: listsRes ? rows(listsRes).map((r) => ({ list: dim(r, 0), clicks: met(r, 0), views: met(r, 1) })).filter((l) => l.clicks > 0 || l.views > 0) : null,
    kpis: {
      sessions: sum('sessions'), users: windowUsers, newUsers: sum('newUsers'),
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
    // 📣 utm_campaign × utm_content — organic sessions land in GA4 as
    // "(organic)"/"(direct)"/(not set); those are already the source panel's
    // job, so only REAL campaign names reach the row
    camps: (campRes ? rows(campRes) : []).map((r) => ({
      name: dim(r, 0), content: dim(r, 1) || '', sessions: met(r, 0), engaged: met(r, 1),
    })).filter((c) => c.name && !/^\((not set|direct|organic|referral)\)$/i.test(c.name)),
    events: rows(events).map((r) => ({ name: dim(r, 0), v: met(r, 0), u: met(r, 1) })),
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
// ── /api/analyst — yesterday, JUDGED against the trailing week ────────
// Three GA4 reports + two Search Console calls, normalised into per-day
// series so analyst.js can ask "is this outside the normal wobble?" instead
// of the far weaker "is this bigger than yesterday?".
//
// ⚠️ 8 days, not 7: the last row is yesterday and the first seven ARE the
// baseline. A baseline that contains the day being judged flattens exactly
// the spike you are trying to detect.
const ANALYST_EVENTS = [
  'builder_start', 'builder_boot', 'sticker_pdp_view', 'sticker_pdp_checkout',
  'pdp_add_to_order', 'add_to_cart', 'cart_open', 'checkout_redirect', 'gif_download', 'wallpaper_download', 'shop_view',
  'shop_door', 'view_item', 'offer_shown', 'offer_click',
  'offer_world', 'offer_discord', 'offer_support',
  'offer_pack', 'offer_swap',      // 🎟 the pack card, 5 Sep
  'rave_join', 'park_join', 'beach_join', 'forge_open', 'purchase',
  'quest_step', 'stand_counter',
  // 🏡 without this the analyst structurally cannot mention the farm — the
  // busiest thing built this year was invisible to its own judgement
  'homestead_open',
  // 🚨 a phone that could not save its homestead or its pass now SAYS so
  'homestead_save_refused', 'homestead_reattach', 'pass_sync_refused', 'pass_reminted',
  // 🎫 the save ask (the HUD's blinking pill) and the email rail it leads to
  'pass_ask_shown', 'pass_ask_tap', 'pass_mail_signin', 'pass_mail_login', 'pass_mail_attached',
  // 🏆 the citizens' wall — the other reason to keep a pass
  'park_citizens', 'citizens_keep',
];

// every door into the world, so the analyst can talk about all of them and not
// the four somebody hard-coded into it. Mirrors AREAS in src/data/pulse-dicts.js.
const WORLD_DOORS = [
  { key: 'rave', name: 'the rave', door: 'rave_join' },
  { key: 'park', name: 'the park', door: 'park_join' },
  { key: 'beach', name: 'Banana Bay', door: 'beach_join' },
  { key: 'homestead', name: 'the homestead', door: 'homestead_open' },
  { key: 'forge', name: 'the Pixel Forge', door: 'forge_open' },
  { key: 'stand', name: 'the Banana Stand', door: 'stand_counter' },
];

// the world's own state — free (our own worker, no GA4 quota) and the only
// numbers here that GA4 structurally cannot see
const WORLD_STATS = 'https://banana-rave.trymstene.workers.dev/yards/stats';

// 📜 THE LEDGER. worker-pass writes one rollup row a night: how many people
// hold a pass, how many claimed a name, how many can get back in after a lost
// phone, and how many are PAYING. GA4 sees none of that — it is behind the
// consent banner, the adblocker and the sampling, and coins never reach Google
// at all. The analyst was blind to the only numbers the business plan turns on.
// ⚠️ adminRollup clamps days to 60. Needs `wrangler secret put PASS_ADMIN_KEY`.
const PASS_ROLLUP = 'https://banana-pass.trymstene.workers.dev/admin/rollup';

async function gscRange(env, from, to) {
  const tok = await gaToken(env);
  const r = await fetch('https://searchconsole.googleapis.com/webmasters/v3/sites/'
    + encodeURIComponent(env.GSC_SITE) + '/searchAnalytics/query', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
    body: JSON.stringify({ startDate: from, endDate: to, dataState: 'all', rowLimit: 1 }),
  });
  if (!r.ok) throw new Error('gsc ' + r.status);
  const d = await r.json();
  return (d.rows && d.rows[0]) || null;
}

async function apiAnalyst(env) {
  const now = new Date();
  // ⚠️ DST-SAFE STEPPING: anchor on the Oslo calendar date, then step whole
  // days from a UTC midnight. Subtracting 86_400_000 from a local timestamp
  // slips an hour twice a year — on the fall-back night osloDay(1) returns
  // TODAY, and since the dates below are generated (not read off the rows)
  // that fabricates a zero day and fires the dead-day alarm against a healthy
  // week. UTC has no DST, so stepping there cannot drift.
  const t0 = Date.parse(now.toLocaleDateString('en-CA', { timeZone: 'Europe/Oslo' }) + 'T00:00:00Z');
  const osloDay = (offset) => new Date(t0 - offset * 86400000).toISOString().slice(0, 10);
  const yDate = osloDay(1);
  const hit = rspCache.get('analyst:' + yDate);
  if (hit && Date.now() - hit.t < 1800000) return hit.data;

  const window8 = [{ startDate: '8daysAgo', endDate: 'yesterday' }];
  const resp = await gaPost(env, 'batchRunReports', {
    requests: [
      { dateRanges: window8, dimensions: [{ name: 'date' }],
        metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'newUsers' },
          { name: 'engagementRate' }, { name: 'totalRevenue' }, { name: 'transactions' }],
        orderBys: [{ dimension: { dimensionName: 'date' } }], limit: 30 },
      { dateRanges: window8, dimensions: [{ name: 'date' }, { name: 'eventName' }],
        metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }], limit: 2000,
        dimensionFilter: { filter: { fieldName: 'eventName',
          inListFilter: { values: ANALYST_EVENTS } } } },
      { dateRanges: [{ startDate: 'yesterday', endDate: 'yesterday' }],
        dimensions: [{ name: 'sessionCampaignName' }],
        metrics: [{ name: 'sessions' }, { name: 'engagedSessions' },
          { name: 'userEngagementDuration' }], limit: 10,
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }] },
      // ⚠️ the analyst read d.sources for a month and was never given any —
      // apiAnalyst simply never fetched them, so that whole branch was dead.
      // The batch caps at FIVE requests and this is the fourth.
      { dateRanges: [{ startDate: 'yesterday', endDate: 'yesterday' }],
        dimensions: [{ name: 'sessionSource' }, { name: 'sessionMedium' }],
        metrics: [{ name: 'sessions' }, { name: 'engagedSessions' }], limit: 12,
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }] },
    ],
  });
  const [dailyR, evR, campR, srcR] = resp.reports || [];

  // ⚠️ THE EIGHT DATES ARE GENERATED, NEVER TAKEN OFF THE ROWS. GA4 sends no
  // row at all for a day whose metrics are all zero, so a dead day used to
  // vanish — and the analyst's "yesterday" silently became the day before,
  // printed under yesterday's date. Generated dates keep the last entry
  // genuinely yesterday and the baseline genuinely seven days.
  const order = [];
  for (let o = 8; o >= 1; o--) order.push(osloDay(o).replace(/-/g, ''));
  const idx = {};
  order.forEach((d, i) => { idx[d] = i; });
  const dayRow = {};
  for (const r of rows(dailyR)) dayRow[dim(r, 0)] = r;
  const days = order.map((d) => {
    const r = dayRow[d];
    return r
      ? { d, sessions: met(r, 0), users: met(r, 1), newUsers: met(r, 2),
        eng: met(r, 3), revenue: met(r, 4), tx: met(r, 5),
        a1: met(r, 6), a7: met(r, 7), a28: met(r, 8) }
      : { d, sessions: 0, users: 0, newUsers: 0, eng: 0, revenue: 0, tx: 0, a1: 0, a7: 0, a28: 0 };
  });

  // one zero-filled series per event — ⚠️ a day with no rows must read 0,
  // not vanish, or the baseline silently averages over fewer days than it says.
  const events = {};
  const eventUsers = {}; // PEOPLE per day — the analyst's person-claims read these
  for (const n of ANALYST_EVENTS) { events[n] = order.map(() => 0); eventUsers[n] = order.map(() => 0); }
  for (const r of rows(evR)) {
    const i = idx[dim(r, 0)];
    const n = dim(r, 1);
    if (i === undefined || !events[n]) continue;
    events[n][i] = met(r, 0);
    eventUsers[n][i] = met(r, 1);
  }

  const campaigns = rows(campR).map((r) => ({
    name: dim(r, 0), sessions: met(r, 0), engaged: met(r, 1), secs: met(r, 2),
  }));
  const sources = rows(srcR).map((r) => ({
    source: dim(r, 0), medium: dim(r, 1), sessions: met(r, 0), engaged: met(r, 1),
  }));

  // the world census — never allowed to take the report down with it
  let world = null;
  try {
    const w = await fetch(WORLD_STATS);
    if (w.ok) world = await w.json();
  } catch (e) { /* the farm is a bonus, not a dependency */ }

  // the ledger, aligned to the SAME eight days as `days`, index for index.
  // ⚠️ THIS ALIGNMENT IS LOAD-BEARING. buildFacts slices d.days by `upTo` to
  // work out how many mornings running a fact has been true; a series that does
  // not slice in lockstep reads identically on every replay, lands on
  // daysRunning 4, and is then permanently barred from ever leading a report.
  // ⚠️ a part-way row (done: 0) is a partial scan, not a small day — dropped.
  let roll = null;
  let rollNote = '';
  try {
    if (!env.PASS_ADMIN_KEY) {
      rollNote = 'no PASS_ADMIN_KEY set';
    } else {
      // ⚠️ env.PASS.fetch, never a global fetch to that hostname — see the note
      // in wrangler.toml. The host in the Request is a formality over a binding.
      const rurl = PASS_ROLLUP + '?days=60&key=' + encodeURIComponent(String(env.PASS_ADMIN_KEY).trim());
      const rr = env.PASS ? await env.PASS.fetch(new Request(rurl)) : await fetch(rurl);
      if (!rr.ok) {
        // ⚠️ A REFUSED KEY AND AN UNREACHABLE WORKER LOOK IDENTICAL from here:
        // adminRollup denies as a 404, and so does anything that never arrives.
        // /health is public and unauthenticated, so it tells the two apart —
        // without it this just says "key refused" forever and the key gets
        // rotated three times for nothing.
        let probe = '';
        try {
          const hurl = PASS_ROLLUP.replace('/admin/rollup', '/health');
          const h = env.PASS ? await env.PASS.fetch(new Request(hurl)) : await fetch(hurl);
          probe = h.ok ? 'worker-pass is up, so the key really is wrong'
            : 'worker-pass /health says ' + h.status + ' — not the key, the worker';
        } catch (e) { probe = 'worker-pass unreachable from here: ' + String(e.message || e).slice(0, 60); }
        rollNote = 'rollup said ' + rr.status + ' · ' + probe;
      } else {
        const rj = await rr.json();
        const all = rj.days || [];
        const byDay = {};
        for (const row of all) {
          if (row && row.done) byDay[String(row.day).replace(/-/g, '')] = row;
        }
        roll = order.map((dd) => byDay[dd] || null);
        const hit = roll.filter(Boolean).length;
        if (!hit) {
          rollNote = all.length
            ? all.length + ' rows, ' + all.filter((x) => x && x.done).length + ' finished, none '
              + 'inside the window ' + order[0] + '-' + order[order.length - 1]
              + ' (newest row ' + String((all[all.length - 1] || {}).day) + ')'
            : 'rollup returned no rows at all';
        }
      }
    }
  } catch (e) { rollNote = 'rollup unreachable: ' + String(e.message || e).slice(0, 90); }

  let gsc = null; let gscBase = null;
  try {
    const [a, b] = await Promise.all([
      gscRange(env, yDate, yDate),
      gscRange(env, osloDay(8), osloDay(2)),
    ]);
    gsc = a;
    if (b) gscBase = { clicks: b.clicks / 7, impressions: b.impressions / 7, position: b.position };
  } catch (e) { /* GSC lags a day or two — the analyst just skips search */ }

  const out = analyse({ days, events, eventUsers, campaigns, sources, gsc, gscBase,
    world, roll, areas: WORLD_DOORS });
  const nice = new Date(yDate + 'T12:00:00').toLocaleDateString('en-GB',
    { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Oslo' });

  // ── the written report ────────────────────────────────────────────────
  // ⚠️ THE DETERMINISTIC ONE IS ALWAYS COMPUTED FIRST and is what ships if the
  // writer is off, unreachable, slow or caught inventing a number. A report is
  // only worth having if every figure in it is real.
  const { pack, ...det } = out;
  // how many of the eight days the ledger actually answered for. 0 means the
  // rollup was not read at all (no PASS_ADMIN_KEY, or worker-pass was down) —
  // without this the report just quietly says less and nothing tells you why.
  let data = { ...det, date: yDate, niceDate: nice, generatedAt: Date.now(), by: 'rules',
    ledgerDays: (roll || []).filter(Boolean).length,
    ledgerNote: rollNote || undefined };
  if (pack && env.ANTHROPIC_KEY) {
    pack.date = yDate;
    pack.niceDate = nice;
    const written = await writeReport(env, pack);
    if (written && !written.__err) {
      data = { ...data, ...written, by: 'written', shape: det.shape };
    } else if (written && written.__err) {
      data.writerNote = written.__err;   // shown nowhere; read it in the payload
    }
  }
  rspCache.set('analyst:' + yDate, { t: Date.now(), data });
  return data;
}

// 🏛 THE PAGE IS RETIRED (3 Sep 2026). Pulse lives inside Banana HQ at
// /inbox/ -> the Pulse tab, which reads the four endpoints below through
// worker-contact's service binding. What stood here was 1,783 lines of HTML
// inside ONE template literal — the richest source of bugs in this repo, since
// a stray backtick or backslash silently ate part of the page and it still
// looked alive. Deleting it deletes the whole class.
//
// The old bookmark still resolves, so it says where everything went.
const MOVED_TO = 'https://trymstene.com/inbox/';
function movedPage() {
  return '<!doctype html><html lang="en"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>Pulse has moved</title><style>'
    + 'body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0d0b16;'
    + 'color:#f4eeff;font:16px/1.6 system-ui,sans-serif;text-align:center;padding:2rem}'
    + 'h1{font-size:1.4rem;margin:0 0 .6rem}'
    + 'p{color:#9a90b8;max-width:26rem;margin:0 auto}'
    + 'a{display:inline-block;margin-top:1.4rem;background:#ffe135;color:#14101f;'
    + 'font-weight:700;text-decoration:none;padding:.7rem 1.3rem;border-radius:999px}'
    + '</style></head><body><div>'
    + '<h1>🍌 Pulse moved into Banana HQ</h1>'
    + '<p>The map, the rooms and the analyst all live on the Pulse tab now, next '
    + 'to the mail and the world data. Update the bookmark.</p>'
    + '<a href="' + MOVED_TO + '">Open Banana HQ</a>'
    + '</div></body></html>';
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
      if (url.pathname === '/api/analyst') {
        return new Response(JSON.stringify(await apiAnalyst(env)), {
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
        return new Response(movedPage(), {
          headers: noRobots({
            'Content-Type': 'text/html; charset=utf-8',
            // nothing loads any more, so nothing is permitted to
            'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
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
