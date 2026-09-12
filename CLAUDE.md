# trymstene.com / Banana World

Astro SSG on GitHub Pages, one solo dev (Trym Stene). Cloudflare Workers behind it.
This file is loaded at the start of every session in this repo. Keep it short.

## ⭐ CLAUDE WRITES CODE. GPT WRITES THE WORDS.

Trym, 12 Sep 2026: *"i want to use GPT LLM for copy and text-content, and you can
concentrate on code."*

**Never hand-write player-facing words.** Not NPC lines, card copy, headlines,
buttons, toasts, labels, quest text, page prose or product copy. Route them
through the copy rig:

```
node tools/copy.mjs <job>          # GPT drafts it into tools/copy-out/
node tools/copy.mjs <job> --dry    # see the prompt, call nothing
node tools/check-copy.mjs          # the rules gate (also runs in CI)
node tools/copy.mjs <job> --approve # Trym has read it: move it into src/data/copy/
```

- The house voice is **`docs/voice.md`** — the writer gets it every time. Read it
  before you touch anything about wording.
- A new writing job = a brief in `tools/copy-briefs/` + an entry in
  `tools/copy-jobs.mjs`. Then run the rig. Do not shortcut it by writing the
  copy yourself "just this once".
- Approved copy lives in **`src/data/copy/*.json`** and the code imports it.
  Code holds mechanics, never prose.
- Trym approves every draft on `/dev/copy/` before it ships.
- The skill `/copy` has the full procedure.

## ⭐ A RULE TRYM STATES TWICE BECOMES A CHECK, NOT A PARAGRAPH

Trym, 12 Sep 2026: *"after sessions are compacting, and you loose context, things
starts to shake … like the HUD not including the action bar, or the Park not having
a footer added … how can it be guaranteed without me having to think that i need to
remind you?"*

It cannot be guaranteed by a document. So when he corrects the same class of thing
twice, the correction goes into `tools/check-design.mjs` (or its own gate) as a
grep, and the design-library section gets its number cited in the failure message.
If a rule genuinely cannot be checked, say so out loud instead of filing another
paragraph — and cover it with an assertion in that area's Playwright walk instead.

`node tools/check-all.mjs` runs every source-only gate in about a second and is
wired as a **Stop hook** (`.claude/settings.json`), so a turn cannot end while a
gate is red. The build-dependent gates (budgets, pulse) run in CI and before a push.

## Before any visual work
`docs/design-library.md` is the design system — read it, then
`node tools/check-design.mjs`. Fix the CLASS, never the instance.

## The gates (all must pass before a push)
```
npx astro build
node tools/check-budgets.mjs   node tools/check-design.mjs
node tools/check-storage.mjs   node tools/check-pulse-areas.mjs
node tools/check-copy.mjs      node tools/build-worker-allowlists.mjs --check
```

## Standing rules worth knowing here
- Verify by looking: walk the change on the BUILT site in headless Chromium and
  look at the screenshots before presenting it.
- Secrets live in `tools/*.local.json` (gitignored) and nowhere else. Never in
  git, chat, a memory file, or a log line.
- `/town` is a hidden prototype: noindex, in no sitemap, linked from nowhere.
- Commit and push automatically when work is done and green; never for
  destructive or DNS changes.
