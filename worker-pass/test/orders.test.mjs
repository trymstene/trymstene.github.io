// 📋 THE ORDER BOARD, in-process against the fakes (27 Sep 2026). What has to hold before it deploys, because each is a
// way coins could leak or a player lose goods for nothing:
//   · today's three orders are the shared module's (src/data/town/orders.js) and only those: yesterday's id is gone
//   · a farm order takes from the saved farm ALL OR NOTHING: short of it, not one egg moves and nothing is paid
//   · a bay or park order is given out of a pass count into the server's own og_ slot, and gives no more than is spare
//   · each order is paid once a day, into the wallet, and the answer carries the server slots for the device
import worker from '../src/index.js';
import { ordersOf, givenOf, statOf, spareOf, ASKS } from '../../src/data/town/orders.js';
import { ORDER_ASKS, TOWN_CAST } from '../../tools/copy-jobs.mjs';
import { dayOf } from '../../src/data/town/market.js';

const ORIGIN = 'https://trymstene.com';
function fakeR2() {
  const m = new Map();
  let ver = 0;
  return {
    _m: m,
    async get(k) { if (!m.has(k)) return null; const { v, etag } = m.get(k); return { etag, json: async () => JSON.parse(v), text: async () => v }; },
    async put(k, v, opts) {
      const cur = m.get(k), want = opts && opts.onlyIf && opts.onlyIf.etagMatches;
      if (want !== undefined && (!cur || cur.etag !== want)) return null;
      const etag = 'e' + (++ver);
      m.set(k, { v: typeof v === 'string' ? v : JSON.stringify(v), etag });
      return { etag };
    },
    async delete(k) { m.delete(k); },
    async list(opts = {}) { const p = opts.prefix || ''; return { objects: [...m.keys()].filter((k) => k.startsWith(p)).sort().map((key) => ({ key })), truncated: false }; },
  };
}
// the neighbourhood as the pass worker reaches it: /yards/take, honouring `all` the way worker-rave does
let farm = { eggs: 0, milk: 0, wool: 0 }, farmOn = true;
const took = [];
const RAVE = {
  async fetch(req) {
    const u = new URL(req.url), b = await req.json().catch(() => ({}));
    if (u.pathname === '/yards/take') {
      if (!farmOn) return new Response(JSON.stringify({ err: 'nofarm' }), { status: 404 });
      const have = farm[b.good] | 0;
      if (b.all && have < (b.n | 0)) return new Response(JSON.stringify({ ok: 1, took: 0, short: 1, left: have, updated: 1000, prev: 1000 }));
      const t = Math.min(have, b.n | 0);
      farm[b.good] = have - t;
      took.push([b.good, t, !!b.all]);
      return new Response(JSON.stringify({ ok: 1, took: t, left: have - t, updated: 2000, prev: 1000 }));
    }
    return new Response('{}', { status: 404 });
  },
};
const env = { PASSES: fakeR2(), ALLOWED_ORIGIN: ORIGIN, PASS_HMAC: 't', MEMBER_HMAC: 'h', RULES_STRICT: '0', RESEND_KEY: 'k', MAIL_FROM: 'b@send.trymstene.com', RAVE };
const ctx = { waitUntil() {}, passThroughOnException() {} };
let ipN = 0;
const hit = (path, init = {}) => worker.fetch(new Request('https://w.dev' + path, {
  ...init, headers: { Origin: ORIGIN, 'Content-Type': 'application/json', 'CF-Connecting-IP': '10.0.3.' + (++ipN % 250), ...(init.headers || {}) },
}), env, ctx);
const post = (p, b) => hit(p, { method: 'POST', body: JSON.stringify(b) });
const J = async (r) => ({ status: r.status, ...(await r.json().catch(() => ({}))) });
let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, extra !== undefined ? '→ ' + JSON.stringify(extra) : ''); }
};
const CLOCK = Date.UTC(2026, 8, 27, 12, 0, 0);
Date.now = () => CLOCK;
const TODAY = ordersOf(dayOf(CLOCK));
const byArea = (a) => TODAY.find((o) => o.area === a);

// a pass with coins and some counts, the way a device pushes them
const DEV = 'dev0000o';
async function anonWith(coins, counts = {}) {
  const a = await J(await post('/anon', {}));
  const led = { coins_earned: { [DEV]: coins }, coins_spent: { [DEV]: 0 } };
  for (const k in counts) led[k] = { [DEV]: counts[k] };
  const blob = { pass: { created: 1, patches: {}, base: {}, led, days: [] }, ev: [], evDrop: 0, evDev: DEV };
  const p = await J(await post('/push', { credId: a.credId, token: a.token, blob }));
  return { ...a, wallet: p.wallet };
}
const order = async (me, id) => J(await post('/town/order', { credId: me.credId, token: me.token, id }));
const view = async (me) => J(await post('/town/order', { credId: me.credId, token: me.token, view: 1 }));

console.log('\n0. the day');
ok('three orders, one for each of the other areas, three different residents',
  TODAY.length === 3 && TODAY.map((o) => o.area).join() === 'farm,bay,park' && new Set(TODAY.map((o) => o.who)).size === 3, TODAY);

ok('the copy gate’s mirror of who asks for what is the board’s own (tools/copy-jobs.mjs ORDER_ASKS)', JSON.stringify(ASKS) === JSON.stringify(ORDER_ASKS), { ASKS, ORDER_ASKS });
ok('everybody who asks is a resident', Object.values(ASKS).flat().every(([who]) => TOWN_CAST.some(([k]) => k === who)));
let dup = 0;
for (let d = dayOf(CLOCK) - 400; d < dayOf(CLOCK) + 400; d++) if (new Set(ordersOf(d).map((o) => o.who)).size !== 3) dup++;
ok('eight hundred days in a row, never one resident with two orders on one day', dup === 0, dup);
const shell = { want: 'shell', kind: 'mussel' };
ok('a shell spent in the old three-for-one swap is not spare either (the beach’s held() subtracts shx_ too)',
  spareOf({ sh_mussel: 5, shx_mussel: 2, og_sh_mussel: 1 }, shell) === 2 && spareOf({ fish_goby: 4, og_fish_goby: 1 }, { want: 'fish', kind: 'goby' }) === 3);

console.log('\n1. the view');
const farmO = byArea('farm');
const me = await anonWith(40);
let v = await view(me);
ok('view: nothing delivered yet today', v.ok && Array.isArray(v.done) && v.done.length === 0 && v.day === dayOf(CLOCK), v);

console.log('\n2. a farm order, short');
farm = { eggs: 0, milk: 0, wool: 0, [farmO.want]: farmO.n - 1 };
let r = await order(me, farmO.id);
ok('a farm one short of the order: refused as short, with what it has', r.status === 409 && r.error === 'short' && r.have === farmO.n - 1, r);
ok('…and not one of them moved', farm[farmO.want] === farmO.n - 1, farm);
ok('…and nothing was paid', !r.wallet, r);

console.log('\n3. a farm order, delivered');
farm[farmO.want] = farmO.n + 2;
took.length = 0;
r = await order(me, farmO.id);
ok('delivered: paid what the order says', r.ok && r.coins === farmO.coins && r.who === farmO.who && r.n === farmO.n, r);
ok('…the whole order taken from the farm, asked for all-or-nothing', took.length === 1 && took[0][1] === farmO.n && took[0][2] === true && farm[farmO.want] === 2, { took, farm });
ok('…into the WALLET', r.wallet && r.wallet.bal === 40 + farmO.coins, r.wallet);
ok('…and the answer carries the server slot for the device', r.slots && r.slots.coins_earned && r.slots.coins_earned.order === farmO.coins, r.slots);
ok('…the farm\'s new stamp comes back for the device to follow', r.yard && r.yard.updated === 2000 && r.yard.prev === 1000, r.yard);
ok('…and today\'s list says so', Array.isArray(r.done) && r.done.includes(farmO.id), r.done);

console.log('\n4. the same order twice');
took.length = 0;
r = await order(me, farmO.id);
ok('a second delivery of the same order is refused as done', r.status === 409 && r.error === 'done', r);
ok('…nothing more taken from the farm', took.length === 0 && farm[farmO.want] === 2, { took, farm });
v = await view(me);
ok('…the view still lists it once', v.done.filter((x) => x === farmO.id).length === 1, v.done);

console.log('\n5. a bay order, out of a pass count');
const bayO = byArea('bay');
const stat = statOf(bayO), given = givenOf(bayO);
const fisher = await anonWith(10, { [stat]: bayO.n - 1 });
r = await order(fisher, bayO.id);
ok('one short of the order: refused as short, with what is spare', r.status === 409 && r.error === 'short' && r.have === bayO.n - 1, r);
const fisher2 = await anonWith(10, { [stat]: bayO.n + 1, [given]: 1 });
r = await order(fisher2, bayO.id);
ok('what orders took before is not spare: n+1 caught, 1 given already, so exactly n to give', r.ok && r.coins === bayO.coins, r);
ok('…the count given is written to the server\'s own og_ slot, carried back to the device', r.slots && r.slots[given] && r.slots[given].order === bayO.n, r.slots);
ok('…and paid into the wallet', r.wallet && r.wallet.bal === 10 + bayO.coins, r.wallet);
r = await order(fisher2, bayO.id);
ok('…once', r.status === 409 && r.error === 'done', r);

console.log('\n6. a park order');
const parkO = byArea('park');
const gardener = await anonWith(0, { [statOf(parkO)]: parkO.n });
r = await order(gardener, parkO.id);
ok('exactly enough is enough', r.ok && r.coins === parkO.coins && r.slots[givenOf(parkO)].order === parkO.n, r);

console.log('\n7. what is not an order today');
const yesterday = ordersOf(dayOf(CLOCK) - 1)[0].id;
r = await order(me, yesterday);
ok('yesterday\'s order is gone', r.status === 409 && r.error === 'gone', r);
r = await order(me, 'nonsense');
ok('…and so is a made-up one', r.status === 409 && r.error === 'gone', r);

console.log('\n8. no farm');
farmOn = false;
const nofarm = await anonWith(5);
r = await order(nofarm, farmO.id);
ok('a banana with no farm is told so', r.status === 404 && r.error === 'nofarm', r);
farmOn = true;
r = await J(await post('/town/order', { credId: 'x', token: 'y', id: farmO.id }));
ok('a stranger is refused', r.status === 403 && r.error === 'not linked', r);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
