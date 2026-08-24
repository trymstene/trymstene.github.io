// Rig gate: per-surface JS budgets, measured on the BUILT output.
// Fails (exit 1) when any budgeted chunk outgrows its line, or the whole
// _astro JS payload passes the total. Run after `npm run build`.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const { budgets, totalBudget } = JSON.parse(readFileSync('tools/budgets.json', 'utf8'));
const dir = 'dist/_astro';
const files = readdirSync(dir).filter((f) => f.endsWith('.js'));
if (!files.length) { console.error('budget check: no built JS found — did the build run?'); process.exit(1); }

let fail = false;
let total = 0;
const seen = new Set();
for (const f of files) {
  const size = statSync(join(dir, f)).size;
  total += size;
  for (const [prefix, cap] of Object.entries(budgets)) {
    if (!f.startsWith(prefix)) continue;
    seen.add(prefix);
    const pct = Math.round((size / cap) * 100);
    const line = `${f}  ${size.toLocaleString()} B / ${cap.toLocaleString()} B  (${pct}%)`;
    if (size > cap) { console.error('❌ OVER BUDGET  ' + line); fail = true; }
    else console.log(`${pct >= 90 ? '⚠️ ' : '✅'} ${line}`);
  }
}
for (const prefix of Object.keys(budgets)) {
  if (!seen.has(prefix)) console.log(`ℹ️  no chunk matched "${prefix}" (renamed? update budgets.json)`);
}
const tp = Math.round((total / totalBudget) * 100);
if (total > totalBudget) { console.error(`❌ TOTAL OVER  ${total.toLocaleString()} B / ${totalBudget.toLocaleString()} B`); fail = true; }
else console.log(`${tp >= 90 ? '⚠️ ' : '✅'} total _astro JS  ${total.toLocaleString()} B / ${totalBudget.toLocaleString()} B  (${tp}%)`);
process.exit(fail ? 1 : 0);
