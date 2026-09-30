// 🛍 THE ETSY SHOP FROM THE TERMINAL (30 Sep 2026). Trym: "does etsy have an API so you can administrate the store
// for me?" … "yes, set up the Etsy API".
//
// Etsy Open API v3 with a SELLER APP (automatic approval, this shop only). Every call carries
// `x-api-key: keystring:shared_secret` and an OAuth 2.0 token (PKCE). The token lives an hour and refreshes itself
// from a refresh token that lives 90 days; past that, `login` again.
//
// ⚠️ SECRETS live in tools/etsy.local.json (gitignored, tools/*.local.json) and nowhere else: never printed, never in
// chat. The keystring and secret are typed into THIS terminal by the shop owner (`setup`), and the shop is connected by
// the owner clicking Allow on Etsy's own page (`login`).
// ⚠️ NOTHING PUBLIC CHANGES WITHOUT --apply: a command that writes to Etsy first prints what it would do. `publish`
// puts a listing live (Etsy's $0.20 fee) and is only ever run when Trym asks for that listing.
// ⚠️ Etsy only returns to an https:// address registered on the app, so `login` sends the owner to
// https://trymstene.com/etsy-callback/ (public/etsy-callback/index.html), which shows the one-time code to paste back.
//
//   node tools/etsy.mjs setup                  the app's keystring + shared secret (asked here, saved locally)
//   node tools/etsy.mjs login                  connect the shop: Etsy opens in the browser, paste the code back
//   node tools/etsy.mjs whoami                 the connected shop
//   node tools/etsy.mjs listings               every listing: id, state, price, favourites, title
//   node tools/etsy.mjs show <id>              one listing: title, tags, photos, files
//   node tools/etsy.mjs check                  the texts in tools/stream-pack/listings.json against Etsy's rules
//   node tools/etsy.mjs draft <key>            <key> from listings.json as a DRAFT, with its photos and zip  --apply
//   node tools/etsy.mjs photos <id> <key>      replace a listing's photos with the pack's current ones       --apply
//   node tools/etsy.mjs file <id> <key>        replace a listing's digital file with the pack's current zip  --apply
//   node tools/etsy.mjs text <id> <key>        a listing's title, description and tags from listings.json    --apply
//   node tools/etsy.mjs feature <id> [rank]    put a listing in the shop's featured row (rank 1 first)          --apply
//   node tools/etsy.mjs publish <id>           make a draft live (Etsy charges its listing fee)              --apply
//   node tools/etsy.mjs sales                  recent orders (dates, totals, items; never a buyer's details)
//   node tools/etsy.mjs pulse-connect          give Banana Pulse (HQ) its own read-only connection to the shop
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import readline from 'node:readline';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CFG = path.join(ROOT, 'tools', 'etsy.local.json');
const SPEC = path.join(ROOT, 'tools', 'stream-pack', 'listings.json');
const PACK = path.join(ROOT, 'tools', 'stream-pack', 'out', 'etsy');
const API = 'https://openapi.etsy.com/v3/application';
const TOKEN_URL = 'https://api.etsy.com/v3/public/oauth/token';
const REDIRECT = 'https://trymstene.com/etsy-callback/';
const SCOPES = 'listings_r listings_w shops_r transactions_r';
const EDITOR = (id) => 'https://www.etsy.com/your/shops/me/listing-editor/edit/' + id;

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const [cmd, a1, a2] = argv.filter((x) => !x.startsWith('--'));

// ── config ─────────────────────────────────────────────────────────────────────────────────────────────────
const readCfg = () => { try { return JSON.parse(fs.readFileSync(CFG, 'utf8')); } catch (e) { return {}; } };
const writeCfg = (c) => fs.writeFileSync(CFG, JSON.stringify(c, null, 2) + '\n', { mode: 0o600 });
function need(c, keys, hint) {
  const miss = keys.filter((k) => !c[k]);
  if (miss.length) { console.error('✗ ' + hint); process.exit(1); }
}

// a question in the terminal; `mute` shows a star for what is typed (readline redraws the whole line on some keys, so
// the prompt is written before it and everything readline writes afterwards is starred)
function ask(q, { mute = false } = {}) {
  return new Promise((resolve) => {
    if (mute) process.stdout.write(q);
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (mute) rl._writeToOutput = (s) => { if (s.replace(/[\r\n]/g, '')) rl.output.write('*'); };
    rl.question(mute ? '' : q, (a) => { rl.close(); if (mute) process.stdout.write('\n'); resolve(a.trim()); });
  });
}

// ── OAuth 2.0 with PKCE ────────────────────────────────────────────────────────────────────────────────────
const b64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function tokenRequest(c, body) {
  const r = await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: c.keystring, ...body }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error('Etsy refused the token request (' + r.status + '): ' + (j.error_description || j.error || 'no reason given'));
  c.access_token = j.access_token;
  c.refresh_token = j.refresh_token;
  c.expires_at = Date.now() + (j.expires_in || 3600) * 1000;
  c.user_id = String(j.access_token).split('.')[0];
  c.scope = j.scope || '';
  writeCfg(c);
  return c;
}

async function token() {
  const c = readCfg();
  need(c, ['keystring', 'secret'], 'no app keys yet: run  node tools/etsy.mjs setup');
  need(c, ['refresh_token'], 'the shop is not connected yet: run  node tools/etsy.mjs login');
  if (c.access_token && Date.now() < c.expires_at - 60000) return c;
  try {
    return await tokenRequest(c, { grant_type: 'refresh_token', refresh_token: c.refresh_token });
  } catch (e) {
    console.error('✗ the connection has lapsed (' + e.message + '): run  node tools/etsy.mjs login');
    process.exit(1);
  }
}

// ── the API ────────────────────────────────────────────────────────────────────────────────────────────────
async function api(method, p, { query, form, multipart } = {}) {
  const c = await token();
  const url = new URL(API + p);
  for (const [k, v] of Object.entries(query || {})) if (v != null) url.searchParams.set(k, Array.isArray(v) ? v.join(',') : String(v));
  const headers = { 'x-api-key': c.keystring + ':' + c.secret, Authorization: 'Bearer ' + c.access_token };
  let body;
  if (form) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    const f = new URLSearchParams();
    for (const [k, v] of Object.entries(form)) if (v != null) f.set(k, Array.isArray(v) ? v.join(',') : String(v));
    body = f;
  } else if (multipart) {
    body = multipart;   // FormData: fetch sets the boundary itself
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(url, { method, headers, body });
    if (r.status === 429) { await new Promise((ok) => setTimeout(ok, 1500 * (attempt + 1))); continue; }
    const text = await r.text();
    let j = null;
    try { j = text ? JSON.parse(text) : null; } catch (e) { j = { raw: text.slice(0, 300) }; }
    if (!r.ok) throw new Error(method + ' ' + p + ' → ' + r.status + ': ' + ((j && (j.error || j.error_description || j.raw)) || 'no reason given'));
    return j;
  }
  throw new Error(method + ' ' + p + ' → still rate-limited after three tries');
}

const money = (m) => (m && m.amount != null ? (m.amount / (m.divisor || 100)).toFixed(2) + ' ' + (m.currency_code || '') : '?');

// ── the listing texts (tools/stream-pack/listings.json) and Etsy's rules for them ──────────────────────────
function spec() { return JSON.parse(fs.readFileSync(SPEC, 'utf8')); }
function listingSpec(key) {
  const s = spec();
  const l = s.listings[key];
  if (!l) { console.error('✗ no listing "' + key + '" in listings.json (' + Object.keys(s.listings).join(', ') + ')'); process.exit(1); }
  return { ...l, key, taxonomy: s.taxonomy, taxonomy_id: l.taxonomy_id || s.taxonomy_id || null, quantity: s.quantity };
}

// Etsy's own rules (the OpenAPI spec's field notes): a title may hold letters, numbers, punctuation, maths symbols,
// spaces, ™ © ®, and each of % : & + only once; a tag letters, numbers, spaces, - ' ™ © ®, at most 20 characters,
// 13 tags at most. Plus Etsy's 2025 title guidance: under 15 words.
function problems(l) {
  const bad = [];
  if (/[^\p{L}\p{Nd}\p{P}\p{Sm}\p{Zs}™©®]/u.test(l.title)) bad.push('the title holds a character Etsy refuses');
  for (const ch of ['%', ':', '&', '+']) if (l.title.split(ch).length - 1 > 1) bad.push('the title uses "' + ch + '" more than once');
  if (l.title.length > 140) bad.push('the title is over 140 characters');
  if (l.title.split(/\s+/).filter((w) => /[\p{L}\p{Nd}]/u.test(w)).length >= 15) bad.push('the title is 15 words or more (Etsy asks for fewer)');
  if (!Array.isArray(l.tags) || l.tags.length > 13) bad.push('13 tags at most');
  for (const t of l.tags || []) {
    if (t.length > 20) bad.push('tag "' + t + '" is over 20 characters');
    if (/[^\p{L}\p{Nd}\p{Zs}\-'™©®]/u.test(t)) bad.push('tag "' + t + '" holds a character Etsy refuses');
  }
  if (new Set((l.tags || []).map((t) => t.toLowerCase())).size !== (l.tags || []).length) bad.push('a tag appears twice');
  if (!(l.price > 0)) bad.push('no price');
  if (!l.description || l.description.length < 50) bad.push('the description is missing or thin');
  return bad;
}

function packFiles(l) {
  const dir = path.join(PACK, l.folder);
  if (!fs.existsSync(dir)) return { dir, photos: [], zip: null };
  const photos = fs.readdirSync(dir).filter((f) => /^photo-\d+-.+\.(png|jpe?g)$/i.test(f))
    .sort((x, y) => parseInt(x.split('-')[1], 10) - parseInt(y.split('-')[1], 10)).map((f) => path.join(dir, f));
  const zip = fs.existsSync(path.join(dir, l.zip)) ? path.join(dir, l.zip) : null;
  return { dir, photos, zip };
}

// the category: a number in listings.json (`taxonomy_id`) wins; else its path of names ("Art & Collectibles >
// Drawing & Illustration > Digital") is looked up in Etsy's seller taxonomy
async function taxonomyId(l) {
  if (l.taxonomy_id) return l.taxonomy_id;
  const want = l.taxonomy.split('>').map((s) => s.trim().toLowerCase());
  const r = await api('GET', '/seller-taxonomy/nodes');
  let level = r.results || [];
  let node = null;
  for (const name of want) {
    const under = node ? node.name : 'the top';
    node = level.find((n) => String(n.name).toLowerCase() === name);
    if (!node) {
      throw new Error('Etsy has no category "' + name + '" under ' + under + ' (it has: ' + level.map((n) => n.name).slice(0, 30).join(', ')
        + '). Put the number in listings.json as "taxonomy_id": `show <id>` on a live listing prints its own.');
    }
    level = node.children || [];
  }
  return node.id;
}

function fileBlob(p) {
  const buf = fs.readFileSync(p);
  const type = /\.png$/i.test(p) ? 'image/png' : /\.jpe?g$/i.test(p) ? 'image/jpeg' : 'application/zip';
  return new Blob([buf], { type });
}

// ── the pieces the commands share ───────────────────────────────────────────────────────────────────────────
async function shopId() {
  const c = await token();
  if (c.shop_id) return c.shop_id;
  const me = await api('GET', '/users/me');
  c.shop_id = me.shop_id;
  writeCfg(c);
  return c.shop_id;
}

async function putPhotos(sid, id, l, files) {
  const current = (await api('GET', '/listings/' + id + '/images')).results || [];
  for (const [i, f] of files.photos.entries()) {
    const fd = new FormData();
    fd.append('image', fileBlob(f), path.basename(f));
    fd.append('rank', String(i + 1));
    fd.append('overwrite', 'true');
    if (l.alt && l.alt[i]) fd.append('alt_text', l.alt[i].slice(0, 500));
    await api('POST', '/shops/' + sid + '/listings/' + id + '/images', { multipart: fd });
    console.log('  ✓ photo ' + (i + 1) + ': ' + path.basename(f));
  }
  // the old pictures past the new count go (a listing keeps a photo the whole time: nothing is deleted first)
  for (const img of current.filter((x) => x.rank > files.photos.length)) {
    await api('DELETE', '/shops/' + sid + '/listings/' + id + '/images/' + img.listing_image_id);
    console.log('  ✓ removed old photo at rank ' + img.rank);
  }
}

async function putFile(sid, id, files) {
  const old = (await api('GET', '/shops/' + sid + '/listings/' + id + '/files')).results || [];
  const fd = new FormData();
  fd.append('file', fileBlob(files.zip), path.basename(files.zip));
  fd.append('name', path.basename(files.zip));
  fd.append('rank', '1');
  await api('POST', '/shops/' + sid + '/listings/' + id + '/files', { multipart: fd });
  console.log('  ✓ file: ' + path.basename(files.zip));
  // the old file goes only once the new one is in, so a buyer can always download something
  for (const f of old) {
    await api('DELETE', '/shops/' + sid + '/listings/' + id + '/files/' + f.listing_file_id);
    console.log('  ✓ removed the old file ' + (f.filename || f.listing_file_id));
  }
}

// the Allow click: Etsy's consent page in the browser, the one-time code pasted back (Etsy returns only to the registered
// https address, public/etsy-callback/, which shows it)
async function authorize(c, scopes) {
  const verifier = b64url(crypto.randomBytes(48));
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
  const state = b64url(crypto.randomBytes(18));
  const url = 'https://www.etsy.com/oauth/connect?' + new URLSearchParams({ response_type: 'code', client_id: c.keystring,
    redirect_uri: REDIRECT, scope: scopes, state, code_challenge: challenge, code_challenge_method: 'S256' }).toString().replace(/\+/g, '%20');
  console.log('Opening Etsy in your browser. Click Allow, and you land on trymstene.com with a code to copy.\n'
    + 'If the browser does not open, open this address yourself:\n\n' + url + '\n');
  try {
    const opener = process.platform === 'win32' ? ['rundll32', ['url.dll,FileProtocolHandler', url]]
      : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
    spawn(opener[0], opener[1], { detached: true, stdio: 'ignore' }).unref();
  } catch (e) { /* the address above is the way in */ }
  const pasted = await ask('Paste the code (or the whole address) here: ');
  let code = pasted;
  if (/^https?:\/\//i.test(pasted)) {
    const u = new URL(pasted);
    code = u.searchParams.get('code') || '';
    const back = u.searchParams.get('state');
    if (back && back !== state) { console.error('✗ that code belongs to a different login attempt: start again'); process.exit(1); }
  }
  if (!code) { console.error('✗ no code'); process.exit(1); }
  return { code, verifier };
}

// wrangler in a worker's folder; a secret goes in on stdin, and neither it nor wrangler's output is ever printed
function wrangler(args, stdin, cwd) {
  return new Promise((ok, fail) => {
    // Windows runs npx through a shell, so the command goes as one line (no user input is in it)
    const win = process.platform === 'win32';
    const p = win
      ? spawn(['npx.cmd', 'wrangler', ...args].map((a) => (/\s/.test(a) ? '"' + a + '"' : a)).join(' '),
        { cwd, shell: true, stdio: [stdin == null ? 'ignore' : 'pipe', 'ignore', 'pipe'] })
      : spawn('npx', ['wrangler', ...args], { cwd, stdio: [stdin == null ? 'ignore' : 'pipe', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => { err += d; });
    if (stdin != null) { p.stdin.write(stdin); p.stdin.end(); }   // no newline: a CRLF would ride into the secret
    p.on('error', fail);
    p.on('close', (code) => (code === 0 ? ok()
      : fail(new Error('wrangler ' + args.slice(0, 3).join(' ') + ' failed: ' + err.split('\n').filter((l) => l.trim()).slice(-2).join(' ').slice(0, 200)))));
  });
}

function plan(lines) {
  console.log(lines.join('\n'));
  if (!APPLY) { console.log('\n(dry run: nothing was sent. Add --apply to do it.)'); return false; }
  return true;
}

// ── the commands ───────────────────────────────────────────────────────────────────────────────────────────
const COMMANDS = {
  async setup() {
    console.log('Your app\'s keys are on https://www.etsy.com/developers/your-apps (they are saved only in tools/etsy.local.json).\n'
      + '⚠️ Type them here in the terminal, never into a chat.\n');
    const c = readCfg();
    const keystring = await ask('Keystring: ');
    const secret = await ask('Shared secret: ', { mute: true });
    if (!/^[a-z0-9]{10,}$/i.test(keystring) || !secret) { console.error('✗ that does not look like a keystring and a secret'); process.exit(1); }
    writeCfg({ ...c, keystring, secret });
    console.log('✓ saved. Next:  node tools/etsy.mjs login');
  },

  async login() {
    const c = readCfg();
    need(c, ['keystring', 'secret'], 'no app keys yet: run  node tools/etsy.mjs setup');
    const { code, verifier } = await authorize(c, SCOPES);
    await tokenRequest(c, { grant_type: 'authorization_code', redirect_uri: REDIRECT, code, code_verifier: verifier });
    delete c.shop_id;
    writeCfg(c);
    const sid = await shopId();
    const shop = await api('GET', '/shops/' + sid);
    const c2 = readCfg();
    c2.shop_name = shop.shop_name;
    writeCfg(c2);
    console.log('✓ connected to ' + shop.shop_name + ' (shop ' + sid + '). Scopes: ' + (c2.scope || SCOPES));
  },

  async whoami() {
    const sid = await shopId();
    const shop = await api('GET', '/shops/' + sid);
    console.log(shop.shop_name + '  (shop ' + sid + ')  ' + (shop.title || ''));
    console.log('listings: ' + (shop.listing_active_count ?? '?') + ' active · digital listings: ' + (shop.digital_listing_count ?? '?')
      + ' · sales: ' + (shop.transaction_sold_count ?? '?') + ' · currency ' + (shop.currency_code || '?'));
    console.log('url: ' + shop.url);
  },

  async listings() {
    const sid = await shopId();
    for (const state of ['active', 'draft', 'inactive', 'expired', 'sold_out']) {
      const r = await api('GET', '/shops/' + sid + '/listings', { query: { state, limit: 100 } });
      for (const l of r.results || []) {
        console.log(String(l.listing_id).padEnd(12) + state.padEnd(9) + money(l.price).padEnd(12)
          + ('♥ ' + (l.num_favorers ?? 0)).padEnd(6) + l.title);   // views come per listing: show <id>
      }
    }
  },

  async show() {
    if (!a1) { console.error('usage: show <listing id>'); process.exit(1); }
    const sid = await shopId();
    const l = await api('GET', '/listings/' + a1, { query: { includes: ['Images'] } });
    console.log(l.title + '\n' + l.url + '\nstate ' + l.state + ' · ' + money(l.price) + ' · qty ' + l.quantity + ' · views ' + (l.views ?? '?')
      + ' · ♥ ' + (l.num_favorers ?? 0) + ' · taxonomy ' + l.taxonomy_id + ' · type ' + (l.listing_type || '?')
      + (l.featured_rank >= 0 ? ' · featured #' + (l.featured_rank + 1) : ''));
    console.log('tags: ' + (l.tags || []).join(', '));
    if (l.suggested_title) console.log('Etsy suggests: ' + l.suggested_title);
    for (const im of l.images || []) console.log('  photo ' + im.rank + ': ' + im.listing_image_id + (im.alt_text ? ' — ' + im.alt_text : ''));
    const files = await api('GET', '/shops/' + sid + '/listings/' + a1 + '/files');
    for (const f of files.results || []) console.log('  file: ' + f.filename + ' (' + f.filesize + ')');
  },

  async check() {
    const s = spec();
    let fails = 0;
    for (const key of Object.keys(s.listings)) {
      const l = listingSpec(key);
      const bad = problems(l);
      const files = packFiles(l);
      if (!files.photos.length) bad.push('no photos in ' + files.dir + ' (build the pack first)');
      if (!files.zip) bad.push('no ' + l.zip + ' in ' + files.dir);
      console.log((bad.length ? '✗ ' : '✓ ') + key.padEnd(13) + l.title.length + ' chars · ' + l.tags.length + ' tags · '
        + files.photos.length + ' photos · ' + l.price + ' kr' + (bad.length ? '\n    ' + bad.join('\n    ') : ''));
      fails += bad.length;
    }
    process.exitCode = fails ? 1 : 0;
  },

  async draft() {
    if (!a1) { console.error('usage: draft <key>   (' + Object.keys(spec().listings).join(', ') + ')'); process.exit(1); }
    const l = listingSpec(a1);
    const bad = problems(l);
    const files = packFiles(l);
    if (bad.length || !files.photos.length || !files.zip) {
      console.error('✗ not ready:\n  ' + [...bad, ...(files.photos.length ? [] : ['no photos']), ...(files.zip ? [] : ['no zip'])].join('\n  '));
      process.exit(1);
    }
    const go = plan(['A DRAFT (not public) "' + l.title + '"', '  ' + l.price + ' kr · quantity ' + l.quantity + ' · ' + l.tags.length + ' tags · ' + l.taxonomy,
      '  photos: ' + files.photos.map((f) => path.basename(f)).join(', '), '  file: ' + path.basename(files.zip)]);
    if (!go) return;
    const sid = await shopId();
    const tax = await taxonomyId(l);
    const d = await api('POST', '/shops/' + sid + '/listings', { form: {
      quantity: l.quantity, title: l.title, description: l.description, price: l.price, who_made: 'i_did', when_made: '2020_2026',
      taxonomy_id: tax, type: 'download', is_supply: false, should_auto_renew: true, tags: l.tags } });
    console.log('✓ draft ' + d.listing_id);
    await putPhotos(sid, d.listing_id, l, files);
    await putFile(sid, d.listing_id, files);
    console.log('\nReady for you in the editor: ' + EDITOR(d.listing_id)
      + '\n⚠️ Set "How is this digital content created?" to "' + l.ai + '" there (the API cannot), check it, then Publish.');
  },

  async photos() {
    if (!a1 || !a2) { console.error('usage: photos <listing id> <key>'); process.exit(1); }
    const l = listingSpec(a2);
    const files = packFiles(l);
    if (!files.photos.length) { console.error('✗ no photos in ' + files.dir); process.exit(1); }
    if (!plan(['Listing ' + a1 + ': its photos become, in this order:', ...files.photos.map((f, i) => '  ' + (i + 1) + '. ' + path.basename(f))])) return;
    await putPhotos(await shopId(), a1, l, files);
  },

  async file() {
    if (!a1 || !a2) { console.error('usage: file <listing id> <key>'); process.exit(1); }
    const l = listingSpec(a2);
    const files = packFiles(l);
    if (!files.zip) { console.error('✗ no ' + l.zip + ' in ' + files.dir); process.exit(1); }
    if (!plan(['Listing ' + a1 + ': its download becomes ' + path.basename(files.zip) + ' (' + fs.statSync(files.zip).size + ' bytes)'])) return;
    await putFile(await shopId(), a1, files);
  },

  async text() {
    if (!a1 || !a2) { console.error('usage: text <listing id> <key>'); process.exit(1); }
    const l = listingSpec(a2);
    const bad = problems(l);
    if (bad.length) { console.error('✗ ' + bad.join('\n✗ ')); process.exit(1); }
    if (!plan(['Listing ' + a1 + ':', '  title: ' + l.title, '  tags: ' + l.tags.join(', '), '  description: ' + l.description.split('\n')[0] + ' …'])) return;
    await api('PATCH', '/shops/' + (await shopId()) + '/listings/' + a1, { form: { title: l.title, description: l.description, tags: l.tags } });
    console.log('✓ updated');
  },

  // the shop's featured row: rank 1 sits first on the shop page.
  // ⚠️ Etsy answers 200 to a featured_rank update and may still leave the listing unfeatured (30 Sep: the first one
  // took, three more came back -1), so the answer is read, never assumed; Shop Manager's star always works.
  async feature() {
    if (!a1) { console.error('usage: feature <listing id> [rank]'); process.exit(1); }
    const rank = parseInt(a2 || '1', 10);
    if (!(rank > 0)) { console.error('✗ the rank is a whole number from 1'); process.exit(1); }
    if (!plan(['Listing ' + a1 + ' becomes featured at position ' + rank + ' on the shop page.'])) return;
    const l = await api('PATCH', '/shops/' + (await shopId()) + '/listings/' + a1, { form: { featured_rank: rank } });
    if (l && l.featured_rank >= 0) console.log('✓ featured (Etsy counts it as #' + (l.featured_rank + 1) + ')');
    else { console.error('✗ Etsy took the call but did not feature it: star it in Shop Manager > Listings'); process.exitCode = 1; }
  },

  async publish() {
    if (!a1) { console.error('usage: publish <listing id>'); process.exit(1); }
    if (!plan(['Listing ' + a1 + ' goes LIVE on Etsy (Etsy charges its listing fee).'])) return;
    await api('PATCH', '/shops/' + (await shopId()) + '/listings/' + a1, { form: { state: 'active' } });
    console.log('✓ live');
  },

  // 🛍 Banana Pulse's own READ-ONLY connection (30 Sep 2026): its own Allow click, so this terminal's token and Pulse's
  // never trip over each other. The token and the app's keys go straight to the Pulse worker (one KV key, two worker
  // secrets): never into a chat, a log or git. Pulse renews it every day after that.
  async 'pulse-connect'() {
    const c = readCfg();
    need(c, ['keystring', 'secret'], 'no app keys yet: run  node tools/etsy.mjs setup');
    const sid = await shopId();
    console.log('Banana Pulse asks to READ the shop (listings, orders): nothing it can change.\n');
    const { code, verifier } = await authorize(c, 'listings_r shops_r transactions_r');
    const r = await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: c.keystring, grant_type: 'authorization_code', redirect_uri: REDIRECT, code, code_verifier: verifier }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.access_token) { console.error('✗ Etsy refused the code (' + r.status + '): ' + (j.error_description || j.error || 'no reason given')); process.exit(1); }
    const dir = path.join(ROOT, 'worker-pulse');
    for (const [name, value] of [['ETSY_KEY', c.keystring], ['ETSY_SECRET', c.secret]]) {
      await wrangler(['secret', 'put', name], value, dir);
      console.log('  ✓ the Pulse worker holds ' + name);
    }
    const tmp = path.join(os.tmpdir(), 'pulse-etsy-' + crypto.randomBytes(6).toString('hex') + '.json');
    fs.writeFileSync(tmp, JSON.stringify({ access_token: j.access_token, refresh_token: j.refresh_token,
      expires_at: Date.now() + (j.expires_in || 3600) * 1000, shop_id: sid, connected: Date.now() }), { mode: 0o600 });
    try {
      await wrangler(['kv', 'key', 'put', 'token', '--binding', 'ETSY', '--remote', '--path', tmp], null, dir);
    } finally {
      fs.rmSync(tmp, { force: true });
    }
    console.log('  ✓ the Pulse worker holds its token\n✓ Pulse is connected to the shop, read-only. The Etsy card on Banana HQ\'s Business floor fills on its next load.');
  },

  async sales() {
    const r = await api('GET', '/shops/' + (await shopId()) + '/receipts', { query: { limit: 25 } });
    const rows = r.results || [];
    if (!rows.length) { console.log('no orders yet'); return; }
    for (const o of rows) {
      const when = new Date((o.created_timestamp || o.create_timestamp) * 1000).toISOString().slice(0, 10);
      const items = (o.transactions || []).map((t) => t.quantity + '× ' + t.title).join('; ');
      console.log(when + '  ' + money(o.grandtotal).padEnd(12) + items);
    }
  },
};

const run = COMMANDS[cmd];
if (!run) {
  const top = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').filter((s) => s.startsWith('//   node')).map((s) => s.slice(3));
  console.log('Etsy from the terminal. Commands:\n' + top.join('\n'));
  process.exit(cmd ? 1 : 0);
}
run().catch((e) => { console.error('✗ ' + (e && e.message ? e.message : e)); process.exit(1); });
