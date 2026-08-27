// 🌐 Rig gate: the world's PUBLIC endpoints must answer, from a real origin.
// ⚠️ WHY THIS EXISTS: a TDZ error in the park's garden read made every request
// throw. A throw means no CORS headers, so the browser reported a CORS failure
// — and the player-walk allowlists CORS noise (a local build genuinely cannot
// reach the workers), so the suite stayed green while the park loaded empty.
// Nothing else in the rig looks at a deployed worker. This does.
const ORIGIN = 'https://trymstene.com';
const CHECKS = [
  ['park garden', 'https://banana-rave.trymstene.workers.dev/park-garden?pass=00000000&alt=00000000', (d) => Array.isArray(d.slots)],
  ['yard stats', 'https://banana-rave.trymstene.workers.dev/yards/stats', (d) => typeof d.yards === 'number'],
  ['pass health', 'https://banana-pass.trymstene.workers.dev/health', (d) => d.ok === true],
  ['catalog tallies', 'https://banana-share.trymstene.workers.dev/catalog/catches?ids=c_probe', (d) => typeof d === 'object'],
  ['sticker health', 'https://banana-sticker.trymstene.workers.dev/health', (d) => !!d],
];
let bad = 0;
for (const [name, url, ok] of CHECKS) {
  try {
    const r = await fetch(url, { headers: { Origin: ORIGIN, 'User-Agent': 'banana-rig-endpoint-check' } });
    const cors = r.headers.get('access-control-allow-origin');
    const body = await r.json().catch(() => null);
    const good = r.ok && body !== null && ok(body);
    if (!good) { bad++; console.log(`❌ ${name} — HTTP ${r.status}, cors=${cors || 'NONE'}`); }
    else console.log(`✅ ${name} — ${r.status}, cors=${cors || 'none'}`);
  } catch (e) {
    bad++; console.log(`❌ ${name} — ${String(e.message).slice(0, 80)}`);
  }
}
if (bad) { console.log(`\n${bad} endpoint(s) down — the world is serving errors to real players.`); process.exit(1); }
console.log('\nall public endpoints answering.');
