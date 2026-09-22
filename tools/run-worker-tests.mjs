// 🧪 THE WORKERS' OWN TESTS, AS A GATE (22 Sep 2026).
//
// Until today no workflow ran them. worker-pass/test/jobs.test.mjs sat at five failing checks for three days
// while the job it tests was being erased by every ordinary sync (the jobs audit found both). Every
// *.test.mjs under a worker's test/ folder runs in-process against its own fakes; each is judged by its exit
// code AND by the fail count it prints, so a file that forgot `process.exit(1)` cannot pass by omission, and
// a file that prints no summary at all has proven nothing and fails too.
//
//   node tools/run-worker-tests.mjs          (CI runs it; ~30 s, too slow for the Stop hook)
import { readdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WORKERS = readdirSync(ROOT).filter((d) => d.startsWith('worker') && existsSync(join(ROOT, d, 'test')));
const bad = [];
let files = 0, checks = 0;
for (const w of WORKERS) {
  const dir = join(ROOT, w, 'test');
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.test.mjs')).sort()) {
    files++;
    const r = spawnSync(process.execPath, [join(dir, f)], { cwd: join(ROOT, w), encoding: 'utf8', timeout: 180000 });
    const out = String(r.stdout || '') + String(r.stderr || '');
    const sums = out.split('\n').map((l) => l.match(/(\d+)\s+pass(?:ed)?,\s+(\d+)\s+fail/)).filter(Boolean);
    const last = sums[sums.length - 1];
    const failed = last ? +last[2] : -1;
    if (last) checks += +last[1];
    const name = w + '/test/' + f;
    if (r.status !== 0 || failed !== 0) {
      bad.push(name + (r.error ? ' — ' + r.error.message : '') + ' (exit ' + r.status + ', ' + (last ? failed + ' failed' : 'no summary line') + ')');
      const tail = out.split('\n').filter((l) => /✗|Error|error/.test(l)).slice(0, 8);
      for (const l of tail) bad.push('    ' + l.trim());
    }
  }
}
if (bad.length) {
  console.error('✗ worker tests:\n  ' + bad.join('\n  '));
  process.exit(1);
}
console.log('✓ worker tests: ' + files + ' files across ' + WORKERS.join(', ') + ', ' + checks + ' checks, none failed');
