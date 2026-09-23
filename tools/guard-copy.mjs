#!/usr/bin/env node
// 🚧 THE COPY GUARD — a PreToolUse hook that keeps Trym's own words where he put them.
//
// Since 23 Sep 2026 Claude writes the copy itself (CLAUDE.md: Trym, "dont go throught ChatGPT for copy
// anymore - Claude writes copy aswell"), so Edit and Write on src/data/copy/*.json are allowed — except
// a change to a LOCKED section. Old Peel in park-npcs is Trym's own writing (he wrote and tuned him on
// 13 Sep), and no assistant rewrites it. The hook applies the edit to the file in memory, compares every
// locked section before and after, and denies only when one of them would move.
//
// It constrains the assistant, never Trym — a hook only sees Claude's own tool calls.
// Wired as a PreToolUse hook on Edit|Write in .claude/settings.json (tracked).
// stdin: { tool_name, tool_input: { file_path, content | old_string, new_string, replace_all } }
let raw = '';
for await (const chunk of process.stdin) raw += chunk;

let input = {};
try { input = JSON.parse(raw || '{}'); } catch (e) { process.exit(0); }   // not for us to judge

const ti = input.tool_input || {};
// windows backslashes, mixed separators and doubled slashes all normalise to one shape
const path = String(ti.file_path || '').replace(/\\/g, '/').replace(/\/{2,}/g, '/');
if (!/(^|\/)src\/data\/copy\/[^/]+\.json$/.test(path)) process.exit(0);

const { readFileSync } = await import('node:fs');
const { jobForFile, lockedTops } = await import('./copy-jobs.mjs');
const file = path.split('/').pop();
const job = jobForFile(file);
const locked = job ? lockedTops(job) : [];
if (!locked.length) process.exit(0);   // nothing in this file is anybody's but the house's

let cur = '';
try { cur = readFileSync(ti.file_path, 'utf8'); } catch (e) { process.exit(0); }   // a new file has nothing locked yet
let next = null;
if (input.tool_name === 'Write') next = String(ti.content || '');
else if (input.tool_name === 'Edit') {
  const a = String(ti.old_string || ''), b = String(ti.new_string || '');
  next = ti.replace_all ? cur.split(a).join(b) : cur.replace(a, () => b);
}
if (next == null) process.exit(0);

let before = null, after = null;
try { before = JSON.parse(cur); after = JSON.parse(next); } catch (e) { process.exit(0); }   // a broken file is the copy gate's to report
const moved = locked.filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
if (!moved.length) process.exit(0);

console.log(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'deny',
    permissionDecisionReason:
      `This edit would change ${moved.map((k) => `"${k}"`).join(', ')} in ${file}, and that section is LOCKED: `
      + `${moved.map((k) => job.locked[k]).join(' ')}\n`
      + `Trym's own writing is never rewritten by an assistant. Leave it as it is — if he has asked for a change `
      + `to it, say so and let him make it.`,
  },
}));
