#!/usr/bin/env node
// 🚧 THE COPY GUARD — a PreToolUse hook that stops Claude editing approved copy by hand.
//
// Everything else in the rig defends src/data/copy from the RIG: the lock keeps GPT out of
// Old Peel, the gate proves the lock, the receipt keeps a typed draft from being approved.
// None of that stops the simplest route of all — an assistant opening the JSON and editing
// a line, which is exactly what CLAUDE.md forbids in prose and nothing enforced.
//
// So: Edit or Write aimed at src/data/copy/*.json is DENIED here, with the reason and the
// command to use instead. It constrains the assistant, never Trym — a hook only ever sees
// Claude's own tool calls, so his editor, his git and his hands are untouched.
//
// Wired as a PreToolUse hook on Edit|Write in .claude/settings.json (tracked).
// stdin: { tool_name, tool_input: { file_path, … } }
let raw = '';
for await (const chunk of process.stdin) raw += chunk;

let input = {};
try { input = JSON.parse(raw || '{}'); } catch (e) { process.exit(0); }   // not for us to judge

// windows backslashes, mixed separators and doubled slashes all normalise to one shape,
// so the guard cannot be stepped around by how a path happens to be spelled
const path = String((input.tool_input || {}).file_path || '').replace(/\\/g, '/').replace(/\/{2,}/g, '/');
const guarded = /(^|\/)src\/data\/copy\/[^/]+\.json$/.test(path);

if (!guarded) process.exit(0);

const file = path.split('/').pop();
const job = file.replace(/\.json$/, '');
console.log(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'deny',
    permissionDecisionReason:
      `${file} is approved player-facing copy. Claude writes code; GPT writes the words (CLAUDE.md).\n`
      + `Editing it here would hand-write copy and skip Trym's review, so this is blocked.\n\n`
      + `To change these words:  node tools/copy.mjs ${job}   → read it at /dev/copy/ → `
      + `node tools/copy.mjs --approve ${job}\n`
      + `Some sections are LOCKED because Trym wrote them himself (Old Peel in park-npcs). `
      + `The rig will not rewrite those, and neither should you — if he has asked for a change `
      + `to a locked section, say so and let him make it.`,
  },
}));
