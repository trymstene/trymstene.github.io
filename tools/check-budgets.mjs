// Rig gate: per-surface JS budgets, measured on the BUILT output.
// Fails (exit 1) when any budgeted chunk outgrows its line, or the whole
// _astro JS payload passes the total. Run after `npm run build`.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const { budgets, totalBudget, adminBudget, adminPrefixes } = JSON.parse(readFileSync('tools/budgets.json', 'utf8'));
// ⚠️ TWO TOTALS, BECAUSE THERE ARE TWO AUDIENCES. Banana HQ is behind a token
// and no visitor ever downloads a byte of it, so counting it against the
// payload a player pays for was measuring the wrong thing — and it made the
// one number that guards the GAME creep toward red for reasons the game had
// nothing to do with. Both are still capped; admin weight is bounded and
// visible, not excused.
const isAdmin = (f) => (adminPrefixes || []).some((pre) => f.startsWith(pre));
const dir = 'dist/_astro';
const files = readdirSync(dir).filter((f) => f.endsWith('.js'));
if (!files.length) { console.error('budget check: no built JS found — did the build run?'); process.exit(1); }

let fail = false;
let total = 0;
let admin = 0;
const seen = new Set();
for (const f of files) {
  const size = statSync(join(dir, f)).size;
  if (isAdmin(f)) admin += size; else total += size;
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
const line = (label, got, cap) => {
  const pct = Math.round((got / cap) * 100);
  const txt = `${label}  ${got.toLocaleString()} B / ${cap.toLocaleString()} B  (${pct}%)`;
  if (got > cap) { console.error('❌ OVER  ' + txt); fail = true; }
  else console.log(`${pct >= 90 ? '⚠️ ' : '✅'} ${txt}`);
};
line('player _astro JS', total, totalBudget);
line('admin-only (HQ) ', admin, adminBudget);
process.exit(fail ? 1 : 0);
