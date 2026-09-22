---
name: copy
description: Write or change any player-facing words for trymstene.com or Banana World — NPC dialogue, character lines, card and popup copy, headlines, buttons, toasts, labels, quest text, page prose, product or shop copy, error and empty states. Routes the writing to the GPT model through tools/copy.mjs and the house voice guide instead of hand-writing it, then validates and stages it for Trym's approval. Use whenever a task involves choosing words a visitor or player will read.
---

# The copy rig — GPT writes the words

Claude writes code. GPT writes the words. Trym, 12 Sep 2026: *"youre not very good
at content copy for NPCs … i want to use GPT LLM for copy and text-content, and you
can concentrate on code."*

**So do not hand-write player-facing copy, ever — not even one line, not even as a
placeholder that "we can fix later".** A placeholder written by hand is how
hand-written copy ships.

## The five steps

1. **Read the voice.** `docs/voice.md` is the house voice: the world's facts, who
   the characters are, what each kind of line is for, the length limits, the
   prohibitions and a DO / NOT-THIS table. If a rule you are about to rely on is
   not in there, add it there first — that file is what the writer is handed.

2. **Find or make the job.** Jobs are registered in `tools/copy-jobs.mjs`, each
   with a brief in `tools/copy-briefs/<job>.md` and a strict JSON schema.
   - An existing job (e.g. `town-npcs`): go to step 3.
   - A new one: write the brief (who speaks, what each field is for, how many
     lines, the hard limits, what the reader is doing when they read it) and add
     the registry entry. The schema's field notes are part of the prompt, so put
     the per-field limits there, not only in the brief.

3. **Run it.**
   ```
   node tools/copy.mjs <job> --dry     # read the assembled prompt first; calls nothing
   node tools/copy.mjs <job>           # GPT drafts into tools/copy-out/<job>.json
   ```
   The draft is validated as it is written and every violation is printed with its
   field path. A failing draft still lands on disk so it can be looked at, but the
   exit code is 1 — fix the brief or the schema and run it again rather than
   editing the words by hand.

4. **Show Trym.** Build, then point him at `/dev/copy/`: the draft beside the live
   copy, per character, with lengths and rule flags. He reads it. Do not approve on
   his behalf.

5. **Approve and wire.**
   ```
   node tools/copy.mjs <job> --approve   # moves the draft into src/data/copy/<job>.json
   node tools/check-copy.mjs             # the gate, which also runs in CI
   ```
   The game imports `src/data/copy/*.json`. Code holds mechanics — where an NPC
   stands, what they carry, when they walk — and never prose.

## 🔒 Locked sections — the words Trym wrote himself

The rig owns `src/data/copy`, with one exception. When Trym writes or tunes a
character's lines himself, that section is **locked** in `tools/copy-jobs.mjs`:

```js
locked: { peel: 'Trym wrote and tuned Old Peel himself (13 Sep 2026). …' },
```

Today that is **Old Peel** in `park-npcs` — Trym, 13 Sep 2026: *"ive already
optimized old peels dialogue myself, no need to change it"*.

A locked section is not a request to be careful. It is enforced:

- it is stripped from the JSON schema sent to the model, so a draft cannot contain it;
- its field notes are left out of the prompt, and the prompt says whose words they are;
- `--approve` splices the approved file's own words back in **before** it validates
  and writes, so even a hand-edited draft cannot replace them;
- `tools/check-copy.mjs` runs a real `--approve` against a poisoned draft in a throwaway
  copy of the repo every time, and fails if the locked words moved. It runs the CLI, not
  the merge helper, because a test that only proves a helper is faithful proves nothing
  about whether anyone still calls it.

So you may run a locked job freely: the other voices get rewritten, the locked one
never moves. **Never unlock a section to "refresh" it.** Removing a `locked` entry
needs Trym asking for it, in that commit message, by name.

Two more things hold the line, and you will meet both:

- **`--approve` refuses a draft with no `_meta` receipt.** `_meta` is written by the rig
  and by nothing else, so a hand-typed `tools/copy-out/<job>.json` cannot be approved.
- **Editing `src/data/copy/*.json` with Edit or Write is blocked** by `tools/guard-copy.mjs`,
  a PreToolUse hook. If you are denied there, that is the rule working: run the rig. A hook
  only sees Claude's tool calls, so Trym's own editing is untouched.
- **A toast cannot hold typed words.** `tools/check-literal-says.mjs` (in `check-all` and CI) reads
  every `say` / `toast` / `passToast` / `bigMoment` call in `src/scripts/*.js` and fails on a string
  literal with a letter in it (markup, entities, `{placeholders}`, emoji and copy keys like
  `lifeWords('toasts')` are not words). Lines typed in before 22 Sep 2026 are listed word for word in
  `tools/literal-says-owed.json`; that list only shrinks — route a line, then take it off.
- The park's walk (`tests/park-peel.spec.mjs`) asserts on the built site that Old Peel says
  what the file says — his greeting, his deck, his five bands, his lore beats, his weather
  lines. Change the wiring and CI says so.

## Hard rules

- **No key anywhere but `tools/copy.local.json`** (gitignored). Never print it, not
  truncated, not in an error. Never put it in a memory file or a commit.
- **Never hardcode a model name.** It comes from that config. `--models` lists what
  the account can see.
- **The API contract is proven, do not guess it:** `POST /v1/responses`, structured
  output via `text.format = { type: 'json_schema', strict: true, … }`, the text at
  `d.output[].content[].text`, errors at `d.error` (check that first). Strict mode
  needs `additionalProperties: false` and every property in `required` on every
  object, so an optional field is `["string","null"]` and still required.
- **A line is only the spoken words.** The game draws the character's name, so a
  line must never start `Name:`. The rules module rejects it.
- **The gate is not optional.** `node tools/check-copy.mjs` runs in CI, so copy
  that breaks the house rules cannot ship even if a future session forgets this
  skill exists.

## When the answer is "not the rig"

The rig is for words a visitor or player reads. It is not for commit messages, code
comments, this repo's docs, or what you say to Trym in chat — write those yourself,
in the style of `bug-reporting-style` (three short beats, no lecture).
