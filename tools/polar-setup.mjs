// 🐻‍❄️ POLAR SETUP — creates the three membership products and the webhook
// endpoint through the API, so the tiers never have to be hand-built twice
// (sandbox and production are the same run with a different token/base).
//
//   POLAR_TOKEN=polar_oat_xxx node tools/polar-setup.mjs            # production
//   POLAR_TOKEN=... POLAR_BASE=https://sandbox-api.polar.sh node tools/polar-setup.mjs
//   …add --dry to print what it WOULD create and touch nothing.
//
// Idempotent: a product whose name already exists is reused, never duplicated.
// Prints the exact `wrangler secret put` lines to finish the wiring.
const BASE = process.env.POLAR_BASE || 'https://api.polar.sh';
const TOKEN = process.env.POLAR_TOKEN || '';
const HOOK = process.env.POLAR_HOOK_URL || 'https://banana-pass.trymstene.workers.dev/polar-hook';
const DRY = process.argv.includes('--dry');

const TIERS = [
  { key: 'POLAR_T1', name: 'Friend of the Banana', cents: 500,
    description: 'You keep the lights on and the banana dancing. The Blue Top Hat on your banana — never for sale — a blue glow under it wherever it goes, and your name on the supporters board in the park.' },
  { key: 'POLAR_T2', name: 'Patron of the Park', cents: 1000,
    description: 'Everything from Friend of the Banana, plus the Silver Top Hat, a moonlight glow, and your name higher up the wall. A real part of why Banana World stays free.' },
  { key: 'POLAR_T3', name: 'Legend of Banana World', cents: 1500,
    description: 'The Gold Top Hat — the tallest hat in the world, worn only by legends — with the full golden radiance under your banana, your name in gold on the board, and my honest gratitude.' },
];

// ☕ the tip jar as a product: pay-what-you-want, one-time, no reward attached.
// Created only with --tips, because Ko-fi takes 0% on donations and is a fair
// home for them — this exists so the whole page CAN be hop-free if we want it.
const TIP = { key: 'POLAR_TIP', name: 'Buy the banana a coffee', min: 300, preset: 500,
  description: 'A one-off thank-you, any amount. No hat and nothing gated — just help keeping Banana World free, and your name on the supporters wall.' };
const WANT_TIPS = process.argv.includes('--tips');

if (!TOKEN) { console.error('POLAR_TOKEN is required (an organization access token).'); process.exit(1); }

const api = async (path, opts = {}) => {
  const r = await fetch(BASE + path, {
    ...opts,
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  const text = await r.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch (e) { body = { raw: text.slice(0, 300) }; }
  if (!r.ok) throw new Error(`${opts.method || 'GET'} ${path} → ${r.status} ${JSON.stringify(body).slice(0, 400)}`);
  return body;
};

console.log('· base:', BASE, DRY ? '(dry run)' : '');
const existing = await api('/v1/products?limit=100');
const byName = new Map((existing.items || []).map((p) => [p.name, p]));
console.log('· products already there:', [...byName.keys()].join(', ') || '(none)');

const secrets = [];
for (const t of TIERS) {
  const found = byName.get(t.name);
  if (found) {
    console.log(`= ${t.name} exists → ${found.id}`);
    secrets.push([t.key, found.id]);
    continue;
  }
  if (DRY) { console.log(`+ would create ${t.name} ($${t.cents / 100}/mo)`); continue; }
  const made = await api('/v1/products', {
    method: 'POST',
    body: JSON.stringify({
      name: t.name,
      description: t.description,
      recurring_interval: 'month',
      prices: [{ amount_type: 'fixed', price_currency: 'usd', price_amount: t.cents }],
    }),
  });
  console.log(`+ created ${t.name} → ${made.id}`);
  secrets.push([t.key, made.id]);
}

if (WANT_TIPS) {
  const found = byName.get(TIP.name);
  if (found) {
    console.log(`= ${TIP.name} exists → ${found.id}`);
    secrets.push([TIP.key, found.id]);
  } else if (DRY) {
    console.log(`+ would create ${TIP.name} (pay what you want, min $${TIP.min / 100})`);
  } else {
    const made = await api('/v1/products', {
      method: 'POST',
      body: JSON.stringify({
        name: TIP.name,
        description: TIP.description,
        recurring_interval: null,       // one-time
        prices: [{ amount_type: 'custom', price_currency: 'usd',
          minimum_amount: TIP.min, preset_amount: TIP.preset }],
      }),
    });
    console.log(`+ created ${TIP.name} → ${made.id}`);
    secrets.push([TIP.key, made.id]);
  }
}

// the webhook endpoint — same events the worker actually handles
const EVENTS = ['subscription.created', 'subscription.active', 'subscription.updated',
  'subscription.cycled', 'subscription.revoked', 'order.paid'];
let hookSecret = null;
if (!DRY) {
  const hooks = await api('/v1/webhooks/endpoints?limit=100').catch(() => ({ items: [] }));
  const already = (hooks.items || []).find((h) => h.url === HOOK);
  if (already) {
    console.log('= webhook endpoint exists →', already.id, '(its secret is only shown at creation)');
  } else {
    const made = await api('/v1/webhooks/endpoints', {
      method: 'POST',
      body: JSON.stringify({ url: HOOK, format: 'raw', events: EVENTS }),
    });
    hookSecret = made.secret || null;
    console.log('+ created webhook endpoint →', made.id);
  }
}

console.log('\n--- finish the wiring (run in worker-pass/) ---');
for (const [k, v] of secrets) console.log(`printf '%s' "${v}" | npx.cmd wrangler secret put ${k}`);
if (hookSecret) console.log(`printf '%s' "${hookSecret}" | npx.cmd wrangler secret put POLAR_WEBHOOK_SECRET`);
else console.log('# POLAR_WEBHOOK_SECRET: copy it from the endpoint in the Polar dashboard');
console.log(`printf '%s' "$POLAR_TOKEN" | npx.cmd wrangler secret put POLAR_TOKEN`);
if (BASE !== 'https://api.polar.sh') console.log(`printf '%s' "${BASE}" | npx.cmd wrangler secret put POLAR_BASE`);
console.log('\nthen flip RAIL to "polar" in src/data/pay-rail.js');
