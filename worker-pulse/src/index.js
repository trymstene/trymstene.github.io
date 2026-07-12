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
  'gif_download', 'png_download', 'wallpaper_download', 'builder_start',
  'generator_click', 'surprise_me', 'share_link_copy', 'rave_join',
  'sticker_pdp_view', 'sticker_pdp_checkout', 'checkout_redirect',
  'select_item', 'view_item', 'license_click', 'tip_click', 'forge_start',
  'begin_checkout', 'purchase',
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
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
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

// ── /api/live — the realtime pulse (cached 25s) ─────────────────────────
async function apiLive(env) {
  const hit = rspCache.get('live');
  if (hit && Date.now() - hit.t < 25000) return hit.data;

  const q = (body) => gaPost(env, 'runRealtimeReport', body);
  const [countries, cities, pages, events, spark, recent, cpages] = await Promise.all([
    q({ dimensions: [{ name: 'countryId' }, { name: 'country' }],
        metrics: [{ name: 'activeUsers' }], limit: 250 }),
    q({ dimensions: [{ name: 'city' }, { name: 'countryId' }],
        metrics: [{ name: 'activeUsers' }], limit: 15,
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }] }),
    q({ dimensions: [{ name: 'unifiedScreenName' }],
        metrics: [{ name: 'activeUsers' }], limit: 12,
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }] }),
    q({ dimensions: [{ name: 'eventName' }], metrics: [{ name: 'eventCount' }], limit: 40,
        orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }] }),
    q({ dimensions: [{ name: 'minutesAgo' }], metrics: [{ name: 'activeUsers' }], limit: 30 }),
    q({ dimensions: [{ name: 'eventName' }, { name: 'countryId' }],
        metrics: [{ name: 'eventCount' }], limit: 60,
        minuteRanges: [{ startMinutesAgo: 4, endMinutesAgo: 0 }],
        orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }] }),
    q({ dimensions: [{ name: 'countryId' }, { name: 'unifiedScreenName' }],
        metrics: [{ name: 'activeUsers' }], limit: 80,
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }] }),
  ]);

  const sparkArr = new Array(30).fill(0);
  for (const r of rows(spark)) {
    const m = Number(dim(r, 0));
    if (m >= 0 && m < 30) sparkArr[29 - m] = met(r, 0);
  }
  const data = {
    at: Date.now(),
    total: rows(countries).reduce((a, r) => a + met(r, 0), 0),
    countries: rows(countries).map((r) => ({ cc: dim(r, 0), name: dim(r, 1), v: met(r, 0) })),
    cities: rows(cities).map((r) => ({ city: dim(r, 0), cc: dim(r, 1), v: met(r, 0) }))
      .filter((c) => c.city && c.city !== '(not set)'),
    pages: rows(pages).map((r) => ({ page: dim(r, 0).replace(/\s*\|\s*Trym Stene\s*$/, ''), v: met(r, 0) })),
    events: rows(events).map((r) => ({ name: dim(r, 0), v: met(r, 0) })),
    spark: sparkArr,
    recent: rows(recent).map((r) => ({ name: dim(r, 0), cc: dim(r, 1), v: met(r, 0) }))
      .filter((e) => LENS_EVENTS.includes(e.name)),
    countryPages: rows(cpages).reduce((acc, r) => {
      const cc = dim(r, 0);
      (acc[cc] = acc[cc] || []).push({
        page: dim(r, 1).replace(/\s*\|\s*Trym Stene\s*$/, ''), v: met(r, 0) });
      return acc;
    }, {}),
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
      { dateRanges, dimensions: [{ name: 'countryId' }, { name: 'country' }],
        metrics: [{ name: 'sessions' }, { name: 'totalUsers' }], limit: 250 },
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
    countries: rows(countries).map((r) => ({ cc: dim(r, 0), name: dim(r, 1),
      sessions: met(r, 0), users: met(r, 1) })),
    sources: rows(sources).map((r) => ({ source: dim(r, 0), medium: dim(r, 1),
      sessions: met(r, 0), engaged: met(r, 1), views: met(r, 2) })),
    events: rows(events).map((r) => ({ name: dim(r, 0), v: met(r, 0) })),
    eventMap: evmapObj,
  };
  rspCache.set(key, { t: Date.now(), data });
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
  :root{ --bg:#0d0b16; --panel:#171326; --line:#2b2344; --ink:#f4eeff; --dim:#8f86ad;
         --nana:#ffd23f; --hot:#ff5d8f; --ok:#5ee08a; --bad:#ff6b6b; --cool:#5ec8e0; }
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
  .panel{ background:var(--panel); border:3px solid #000; box-shadow:6px 6px 0 #000;
          padding:14px; margin-bottom:16px; }
  .grid2{ display:grid; grid-template-columns:1fr 1fr; gap:16px; }
  @media(max-width:800px){ .grid2{ grid-template-columns:1fr; } }
  canvas#map{ width:100%; image-rendering:pixelated; display:block; background:#0a0814;
              border:3px solid #000; }
  .chips{ display:flex; gap:6px; flex-wrap:wrap; margin:10px 0; }
  .chip{ font:inherit; font-size:.72rem; padding:5px 9px; background:#0a0814; color:var(--dim);
         border:2px solid var(--line); cursor:pointer; letter-spacing:.05em; }
  .chip.on{ background:var(--nana); color:#000; border-color:var(--nana); }
  select,input[type=date]{ font:inherit; font-size:.72rem; background:#0a0814; color:var(--ink);
         border:2px solid var(--line); padding:4px 6px; }
  .ticker{ overflow:hidden; white-space:nowrap; border-block:2px solid var(--line);
           padding:7px 0; font-size:.78rem; }
  .ticker .in{ display:inline-block; padding-left:100%; animation:tick 40s linear infinite; }
  @keyframes tick{ to{ transform:translateX(-100%); } }
  .kpis{ display:grid; grid-template-columns:repeat(auto-fit,minmax(120px,1fr)); gap:10px; }
  .kpi{ background:#0a0814; border:2px solid var(--line); padding:10px; }
  .kpi .l{ font-size:.62rem; color:var(--dim); letter-spacing:.14em; text-transform:uppercase; }
  .kpi .v{ font-size:1.25rem; color:var(--nana); margin-top:2px; }
  .kpi .d{ font-size:.68rem; margin-top:2px; }
  .up{ color:var(--ok); } .down{ color:var(--bad); } .flat{ color:var(--dim); }
  .fstep{ margin-bottom:8px; }
  .fstep .row{ display:flex; justify-content:space-between; font-size:.74rem; margin-bottom:3px; }
  .fbar{ height:16px; background:#0a0814; border:2px solid var(--line); position:relative; }
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
</div>
<div class="err" id="err"></div>

<div class="panel">
  <h2>🌍 Pixel earth</h2>
  <div style="position:relative;">
    <canvas id="map"></canvas>
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
  <p class="muted" style="margin-top:8px;">deltas = vs the previous window of the same length ·
     GA4 intraday lags ~4–8h, so “today” fills in through the day</p>
</div>

<div class="grid2">
  <div class="panel"><h2>🏷️ Sticker shop funnel <span class="muted">(make-a-banana)</span></h2><div id="fun0"></div></div>
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
  wallpaper_download:'took a wallpaper', builder_start:'opened the builder',
  generator_click:'headed to the builder', surprise_me:'hit surprise me',
  share_link_copy:'shared a banana', rave_join:'joined the rave',
  sticker_pdp_view:'eyed a sticker', sticker_pdp_checkout:'hit ORDER',
  checkout_redirect:'went to checkout 💰', select_item:'picked merch',
  view_item:'viewed merch', license_click:'read the license',
  tip_click:'tipped the banana 💛', forge_start:'fired up the forge',
  begin_checkout:'started checkout 💳', purchase:'PAID 💰💰💰' };
var LENSES = ['gif_download','builder_start','rave_join','sticker_pdp_view',
  'checkout_redirect','begin_checkout','purchase','view_item','select_item',
  'wallpaper_download','license_click'];
var state = { mode:'live', lens:'gif_download', from:'today', to:'today',
              topN:10, live:null, range:null, prev:null };

function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function api(path){
  return fetch(path + (path.indexOf('?')>=0?'&':'?') + 't=' + encodeURIComponent(TOKEN))
    .then(function(r){ if(!r.ok) throw new Error('api ' + r.status); return r.json(); });
}
function showErr(m){ var e=document.getElementById('err'); e.textContent='⚠ '+m; e.style.display='block';
  setTimeout(function(){ e.style.display='none'; }, 8000); }

// ── the pixel earth ──
var LAND = MAP.land.map(function(hexRow){
  var bits=''; for(var i=0;i<hexRow.length;i++){ bits+=('000'+parseInt(hexRow[i],16).toString(2)).slice(-4); }
  return bits; });
var mapCv = document.getElementById('map');
var PX = 8; mapCv.width = MAP.w*PX; mapCv.height = MAP.h*PX;
var mctx = mapCv.getContext('2d');
var pulse = 0;
function mapData(){
  if(state.mode==='live') return (state.live? state.live.countries.map(function(c){ return {cc:c.cc,v:c.v,name:c.name}; }):[]);
  if(state.mode==='range') return (state.range? state.range.countries.map(function(c){ return {cc:c.cc,v:c.sessions,name:c.name}; }):[]);
  var em = state.range && state.range.eventMap[state.lens] || {};
  return Object.keys(em).map(function(cc){ return {cc:cc,v:em[cc],name:cc}; });
}
function drawMap(){
  pulse=(pulse+1)%60;
  mctx.fillStyle='#0a0814'; mctx.fillRect(0,0,mapCv.width,mapCv.height);
  mctx.fillStyle='#241d3a';
  for(var y=0;y<MAP.h;y++){ var row=LAND[y];
    for(var x=0;x<MAP.w;x++){ if(row[x]==='1') mctx.fillRect(x*PX,y*PX,PX-1,PX-1); } }
  var data=mapData(); var max=1;
  data.forEach(function(d){ if(d.v>max) max=d.v; });
  lastDots=[];
  data.forEach(function(d){
    var c=MAP.cent[d.cc]; if(!c) return;
    var r=1+Math.round(2*Math.sqrt(d.v/max));
    lastDots.push({x:c[0], y:c[1], r:r, cc:d.cc, name:d.name, v:d.v});
    var glow=(state.mode==='live')? (0.55+0.45*Math.sin((pulse/60)*6.283)) : 1;
    mctx.fillStyle = state.mode==='event' ? 'rgba(94,224,138,'+glow+')'
      : (state.mode==='live' ? 'rgba(255,210,63,'+glow+')' : 'rgba(255,93,143,'+glow+')');
    mctx.fillRect((c[0]-r+1)*PX,(c[1]-r+1)*PX,(2*r-1)*PX,(2*r-1)*PX);
    mctx.fillStyle='#000';
    if(d.v>0 && r>1){ mctx.font='bold '+(PX*2)+'px monospace'; mctx.textAlign='center';
      mctx.fillText(d.v, c[0]*PX+PX/2, (c[1]+1)*PX+PX*0.1); }
  });
  var lg=document.getElementById('mapLegend');
  var total=data.reduce(function(a,d){ return a+d.v; },0);
  lg.textContent = state.mode==='live'
    ? '● yellow pulses = active visitors, last 30 min ('+total+' total)'
    : state.mode==='range' ? '● pink = sessions, '+state.from+' → '+state.to+' ('+total+' total)'
    : '● green = “'+(EV_LABEL[state.lens]||state.lens)+'” ('+state.lens+'), '+state.from+' → '+state.to+' ('+total+' total)';
}
setInterval(drawMap, 120);
var lastDots=[];

// hover a pulse → who/where/what they're looking at (LIVE mode gets pages)
var mapTip=document.getElementById('mapTip');
function tipFor(ev){
  var rect=mapCv.getBoundingClientRect();
  var cx=(ev.clientX-rect.left)/rect.width*MAP.w;
  var cy=(ev.clientY-rect.top)/rect.height*MAP.h;
  var best=null, bd=1e9;
  lastDots.forEach(function(d){
    var dx=Math.abs(cx-d.x), dy=Math.abs(cy-d.y);
    var dist=Math.max(dx,dy);
    if(dist<=d.r+1.5 && dist<bd){ bd=dist; best=d; }
  });
  if(!best){ mapTip.style.display='none'; return; }
  var html='<div style="color:var(--nana);">'+FLAG(best.cc)+' '+esc(best.name)+'</div>';
  if(state.mode==='live'){
    html+='<div>'+best.v+' visiting now</div>';
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
mapCv.addEventListener('mousemove', tipFor);
mapCv.addEventListener('mouseleave', function(){ mapTip.style.display='none'; });
mapCv.addEventListener('click', tipFor); // tap on mobile

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
function renderLive(){
  var L=state.live; if(!L) return;
  document.getElementById('liveTotal').textContent = L.total;
  drawSpark();
  tbl(document.getElementById('livePages'), L.pages.map(function(p){ return [esc(p.page), p.v]; }));
  tbl(document.getElementById('liveCities'), L.cities.map(function(c){ return [FLAG(c.cc)+' '+esc(c.city), c.v]; }));
  var t = L.recent.map(function(e){
    return FLAG(e.cc)+' '+(EV_LABEL[e.name]||e.name)+(e.v>1?' ×'+e.v:''); });
  document.getElementById('ticker').textContent =
    t.length ? '⏱ Last 5 min:  '+t.join('   ·   ')+'   🍌' : 'quiet out there right now… the banana dances alone 🍌';
}
function loadLive(){
  api('/api/live').then(function(d){ state.live=d; renderLive(); })
    .catch(function(e){ showErr('live: '+e.message); });
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
  [['sessions','On the site'],['builder_start','Builder loaded'],
   ['sticker_pdp_view','Product page'],['sticker_pdp_checkout','Hit ORDER'],
   ['checkout_redirect','→ Shopify checkout'],
   ['begin_checkout','Checkout started ⌁store-wide'],['purchase','PAID 💰 ⌁store-wide']],
  [['sessions','On the site'],['select_item','Picked a product'],
   ['view_item','Product page'],['transactions','Purchases 💰']]];
function renderFunnel(el, steps){
  var R=state.range, P=state.prev;
  var vals=steps.map(function(s){ return stepVal(R,s[0]); });
  var pvals=steps.map(function(s){ return P? stepVal(P,s[0]) : null; });
  var worst=-1, worstRate=2;
  for(var i=1;i<vals.length;i++){ var rate=vals[i-1]? vals[i]/vals[i-1] : 1;
    if(vals[i-1]>0 && rate<worstRate){ worstRate=rate; worst=i; } }
  var html='';
  for(var i=0;i<steps.length;i++){
    var pct=vals[0]? Math.max(1.2,(vals[i]/vals[0])*100) : 0;
    var conv=i>0 ? (vals[i-1]? Math.round((vals[i]/vals[i-1])*100) : 0) : null;
    var lbl=steps[i][1].replace(' ⌁store-wide',' <span class="muted">(store-wide)</span>');
    html+='<div class="fstep"><div class="row"><span>'+lbl+'</span>'+
      '<span>'+fmt(vals[i])+' '+delta(vals[i],pvals[i])+'</span></div>'+
      '<div class="fbar'+(i===worst?' hotspot':'')+'"><div class="fill" style="width:'+pct+'%"></div></div>'+
      (i>0?'<div class="fdrop">'+(i===worst?'<b>⟵ WORK HERE · </b>':'')+conv+'% make it from “'+steps[i-1][1].replace(/ ⌁.*$/,'')+'”</div>':'')+
      '</div>';
  }
  el.innerHTML=html;
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
  renderFunnel(document.getElementById('fun0'),FUNNELS[0]);
  renderFunnel(document.getElementById('fun1'),FUNNELS[1]);
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
    evs.map(function(e){ return '<tr><td>'+esc(e.name)+'</td>'+
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
   .catch(function(e){ showErr('range: '+e.message); });
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

loadLive(); loadRange();
setInterval(loadLive, 30000);
setInterval(function(){ if(state.to==='today') loadRange(); }, 300000);
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
      return new Response(JSON.stringify({ error: String(e.message || e).slice(0, 300) }), {
        status: 502, headers: noRobots({ 'Content-Type': 'application/json' }),
      });
    }
  },
};
