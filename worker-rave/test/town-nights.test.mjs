// 🌃 THE NIGHTS BITE (23 Sep 2026), in-process against a fake DO with a clock the test holds.
//
// Trym: "the nights still doesnt feel very scary - town health went to 99% and then we where right up to 100% again -
// its been 100% the whole day when ive dropped by". He chose "Hard" and haunted nights about every two hours:
//   · every town night takes its TOLL by itself, watched or not (1, a haunted one 3) — above its floor (45 / 20)
//   · a wrecked thing costs 2 (relighting pays 2: an answered night no longer leaves the town higher)
//   · a night may take 15 points of wrecks (a haunted one, or a real Curse Night, 25), never below its floor
//   · one town night in ten is haunted, seeded by its index: the shared clock and this room agree without a message
const mod = await import('../src/index.js');
const { TownRoom } = mod;
const W = await import('../../src/lib/world.js');
const { weatherBetween, curseBetween, townHaunted, TOWN_DAY_MS } = W;

function fakeState() {
  const m = new Map();
  return { storage: { async get(k) { return m.has(k) ? structuredClone(m.get(k)) : undefined; }, async put(k, v) { m.set(k, structuredClone(v)); }, async delete(k) { m.delete(k); } } };
}
let pass = 0, fail = 0;
const ok = (name, cond, extra) => { if (cond) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name, extra === undefined ? '' : JSON.stringify(extra)); } };
let NOW = 0;
const realNow = Date.now;
Date.now = () => NOW;
const room = () => new TownRoom(fakeState(), { LAUNCH_KEY: 'k' });
const call = (r, path, body) => r.fetch(new Request('https://room' + path, body ? { method: 'POST', body: JSON.stringify(body) } : {})).then((x) => x.json());
const set = (r, v) => call(r, '/life/set', { key: 'k', life: v });
const quiet = (a, b) => !weatherBetween(a, b).some((e) => e.type === 'heavy' || e.type === 'storm') && !curseBetween(a, b).length;
const nightsIn = (a, b) => { const out = []; for (let n = Math.floor((a - 600000) / TOWN_DAY_MS) + 1; n <= Math.floor((b - 600000) / TOWN_DAY_MS); n++) out.push(n); return out; };
// a window of `hours` from a whole town day with no weather hit and no Curse Night, optionally with/without haunted nights
function windowOf(hours, want) {
  let t = Date.UTC(2026, 8, 25, 2, 0, 0); t -= t % TOWN_DAY_MS;
  for (let k = 0; k < 2000; k++) {
    const a = t + k * TOWN_DAY_MS, b = a + hours * 3600000;
    if (!quiet(a, b)) continue;
    const h = nightsIn(a, b).filter(townHaunted).length;
    if (want === 'none' && h) continue;
    if (want === 'some' && !h) continue;
    return { a, b, nights: nightsIn(a, b).length, haunted: h };
  }
  throw new Error('no window');
}

console.log('\n1. a night nobody watched still takes its toll');
{
  const w = windowOf(6, 'some');
  const r = room();
  NOW = w.a; await set(r, 100);
  NOW = w.b; const j = await call(r, '/life');
  const expect = 100 - 0.6 * 6 - (w.nights - w.haunted) * 1 - w.haunted * 3;
  ok(`six quiet hours (${w.nights} nights, ${w.haunted} haunted): 100 → ${expect.toFixed(1)}`, Math.abs(j.life - expect) < 0.15, { life: j.life, expect });
  ok('…a town that sat at the top between two visits is now visibly lower', j.life < 70, j.life);
}

console.log('\n2. a plain night\'s toll stops at 45; the drift alone goes on');
{
  const w = windowOf(1, 'none');
  const r = room();
  NOW = w.a; await set(r, 46);
  NOW = w.b; const j = await call(r, '/life');
  ok(`five plain nights from 46: no lower than the floor, less the hour's drift (${j.life})`, j.life >= 44.3 && j.life <= 45, j.life);
}

console.log('\n3. a watched night: two points a wreck, fifteen a night, never below 45');
{
  const w = windowOf(1, 'none');
  const n0 = nightsIn(w.a, w.b)[0];
  const r = room();
  NOW = n0 * TOWN_DAY_MS + 650000;   // inside a plain night
  await set(r, 100);
  let j = await call(r, '/life');
  ok('the room says it is night, and a plain one', j.dark && j.dark.night === true && j.dark.haunt === false, j.dark);
  ok('…fifteen points a night, floor 45, two a wreck', j.dark.max === 15 && j.dark.floor === 45 && j.dark.per === 2, j.dark);
  j = await call(r, '/life/dark', { pass: 'abcdef12', n: 3 });
  ok('three wrecks cost six', j.counted === 3 && Math.abs(j.life - 94) < 0.01 && j.dark.used === 6, { c: j.counted, life: j.life, used: j.dark.used });
  j = await call(r, '/life/dark', { pass: 'abcdef12', n: 10 });
  ok('…ten more: only four fit in the night\'s fifteen', j.counted === 4 && Math.abs(j.life - 86) < 0.01 && j.dark.used === 14, { c: j.counted, life: j.life, used: j.dark.used });
  j = await call(r, '/life/dark', { pass: 'abcdef12', n: 2 });
  ok('…and the last point is not a whole wreck: nothing more', j.counted === 0 && Math.abs(j.life - 86) < 0.01, { c: j.counted, life: j.life });
  j = await call(r, '/life/fix', { pass: 'abcdef12' });
  ok('a relight pays two: the answered wreck breaks even, never better', j.counted === 1 && Math.abs(j.life - 88) < 0.01, { life: j.life });
  // near the floor
  await set(r, 48);
  j = await call(r, '/life/dark', { pass: 'abcdef12', n: 5 });
  ok('at 48 the night can take one wreck and stop at the floor', j.counted === 0 || (j.life >= 45), { c: j.counted, life: j.life });
}

console.log('\n4. a haunted night takes more, and lower');
{
  const w = windowOf(4, 'some');
  const hn = nightsIn(w.a, w.b).find(townHaunted);
  const r = room();
  NOW = hn * TOWN_DAY_MS + 650000;
  await set(r, 30);
  let j = await call(r, '/life');
  ok('the room knows the night is haunted', j.dark && j.dark.haunt === true && j.dark.max === 25 && j.dark.floor === 20, j.dark);
  j = await call(r, '/life/dark', { pass: 'abcdef12', n: 10 });
  ok('from 30 the ghosts may take it to 20, five wrecks', j.counted === 5 && Math.abs(j.life - 20) < 0.01, { c: j.counted, life: j.life });
}

console.log('\n5. by day, no ghost can cost the town anything');
{
  const w = windowOf(1, 'none');
  const r = room();
  NOW = nightsIn(w.a, w.b)[0] * TOWN_DAY_MS + 300000;   // mid-morning of a town day
  await set(r, 80);
  const j = await call(r, '/life/dark', { pass: 'abcdef12', n: 3 });
  ok('a daytime report counts nothing', j.counted === 0 && j.why === 'day' && Math.abs(j.life - 80) < 0.01, { c: j.counted, why: j.why, life: j.life });
}

console.log('\n6. one night in ten is haunted, and the same nights for everybody');
{
  let h = 0; for (let n = 0; n < 50000; n++) if (townHaunted(n)) h++;
  ok('about one in ten over fifty thousand nights', Math.abs(h / 50000 - 0.1) < 0.01, h / 50000);
  ok('a night is haunted or not by its index alone', townHaunted(123456) === townHaunted(123456));
}

Date.now = realNow;
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
