# trymstene.com / Banana World

Astro SSG on GitHub Pages, one solo dev (Trym Stene). Cloudflare Workers behind it.
This file is loaded at the start of every session in this repo. Keep it short.

## ⭐ CLAUDE WRITES THE WORDS TOO (since 23 Sep 2026)

Trym, 23 Sep 2026: *"change of rule - dont go throught ChatGPT for copy anymore - Claude
writes copy aswell"*. (From 12 to 23 Sep a GPT rig, `tools/copy.mjs`, drafted every line; it
is retired and kept only in case he wants it back.)

- Player-facing words still live in **`src/data/copy/*.json`** and the code imports them —
  code holds mechanics, the copy files hold the words. Write them there yourself, in the house
  voice: **`docs/voice.md`** (read it before you touch wording).
- Each copy file has an entry in `tools/copy-jobs.mjs`: its fields, their limits and the
  placeholders the game fills. A new file = a new entry. Then:
  ```
  node tools/check-copy.mjs          # every line against its limits and the voice rules (also in CI)
  node tools/check-literal-says.mjs  # no words typed into say/toast/passToast/bigMoment (older ones owed: tools/literal-says-owed.json, which only shrinks)
  ```
- Show Trym the changed lines in the reply whenever you add or change words.
- 🔒 **Old Peel is Trym's own writing** (`locked` in `park-npcs`): never rewrite it, and never
  remove a lock unless he asks by name. `tools/guard-copy.mjs` (a PreToolUse hook) refuses any
  edit that would change a locked section.
- The skill `/copy` has the procedure.

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
node tools/check-structured-data.mjs   (JSON-LD: a page node on every indexable page, licensable images)
```

## Standing rules worth knowing here
- Verify by looking: walk the change on the BUILT site in headless Chromium and
  look at the screenshots before presenting it.
- Secrets live in `tools/*.local.json` (gitignored) and nowhere else. Never in
  git, chat, a memory file, or a log line.
- `/town/` is the FRONT DOOR of Banana World (21 Sep 2026): indexed, in the sitemap, every
  "Enter Banana World" link lands there, chapter one opens at its fountain. It was a hidden
  prototype from 7 Sep to 21 Sep.
- Commit and push automatically when work is done and green; never for
  destructive or DNS changes.
