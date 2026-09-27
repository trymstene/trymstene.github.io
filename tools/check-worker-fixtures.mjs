// 🧪 A WORKER TEST'S LEDGER EVENTS MUST CARRY IDS THE SERVER ACCEPTS (27 Sep 2026).
//
// worker-pass's tape takes an event only if its id is 6 to 12 hex characters (tapeIn: /^[a-f0-9]{6,12}$/), the way a
// phone mints them (src/lib/banana-pass.js), and it drops any other id WITHOUT A WORD. A test that pushes 'buyduckhat'
// proves nothing about the event it thinks it sent, and passes or fails for some other reason. It has bitten three
// times: race.test's fixture (2 Sep), gift.test's purchases, which made that file fail about one CI run in four on a
// random draw, and market.test's forged exchange coin, whose "refused" check passed against any worker. So it is a
// check (CLAUDE.md: a lesson learned twice becomes a check, not a paragraph).
//
// Source-only and fast (tools/check-all.mjs runs it): every object literal in a worker test that has a ledger key
// (`k: '…'`) and an `id:` is read. A string id must be hex and 6 to 12 long; an id built by `+` must start with a hex
// literal (the rest is the test's own counter). Anything else is named with its line, unless the line says the id is
// bad ON PURPOSE (event-log.test proves junk is dropped): put `bad id on purpose` in a comment on that line.
//   node tools/check-worker-fixtures.mjs [file …]   (files: scan just those, e.g. to prove the check bites)
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const HEX = /^[a-f0-9]{6,12}$/, HEXPART = /^[a-f0-9]*$/;
const args = process.argv.slice(2);
const FILES = args.length ? args.map((p) => [p, p])
  : readdirSync(ROOT).filter((d) => d.startsWith('worker') && existsSync(join(ROOT, d, 'test')))
    .flatMap((w) => readdirSync(join(ROOT, w, 'test')).filter((x) => x.endsWith('.mjs')).map((f) => [join(ROOT, w, 'test', f), w + '/test/' + f]));
const bad = [];
let seen = 0;
for (const [path, name] of FILES) {
  readFileSync(path, 'utf8').split('\n').forEach((line, i) => {
    if (/bad id on purpose/i.test(line)) return;
    // an event row: an object literal naming a ledger key (`k: '…'`, or a helper's shorthand `k`), up to its first closing brace
    for (const m of line.matchAll(/\{[^{}]*(?:\bk:\s*['"][^'"]*['"]|[{,]\s*k\s*[,}])[^{}]*\}?/g)) {
      const id = m[0].match(/\bid:\s*(['"])([^'"]*)\1(\s*\+)?/);
      if (!id) continue;
      seen++;
      const [, , lit, plus] = id;
      const okId = plus ? HEXPART.test(lit) && lit.length <= 12 : HEX.test(lit);
      if (!okId) bad.push(name + ':' + (i + 1) + '  id ' + JSON.stringify(lit) + (plus ? ' + …' : '') + ' — the server drops it silently');
    }
  });
}
if (bad.length) {
  console.error('❌ worker test fixtures: ledger events with ids the server never takes (6–12 hex characters, like a phone\'s):\n   '
    + bad.join('\n   '));
  process.exit(1);
}
console.log('✅ worker test fixtures: ' + seen + ' ledger event ids, every one hex, the way a phone mints them');
