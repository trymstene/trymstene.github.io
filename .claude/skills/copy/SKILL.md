---
name: copy
description: Write or change any player-facing words for trymstene.com or Banana World — NPC dialogue, character lines, card and popup copy, headlines, buttons, toasts, labels, quest text, page prose, product or shop copy, error and empty states. Claude writes them itself (since 23 Sep 2026) into src/data/copy/*.json in the house voice (docs/voice.md), registers each file's rules in tools/copy-jobs.mjs and checks them with tools/check-copy.mjs. Use whenever a task involves choosing words a visitor or player will read.
---

# Writing the words

Trym, 23 Sep 2026: *"change of rule - dont go throught ChatGPT for copy anymore - Claude
writes copy aswell"*. From 12 to 23 Sep a GPT rig (`tools/copy.mjs`) drafted every line
and Claude only wired it in; that rig is retired and kept only in case he wants it back.
Claude writes the words now — and the structure the rig left behind stays, because it is
good on its own: one place for every word, a rulebook per file, and gates that catch the
faults that shipped before.

## The steps

1. **Read the voice.** `docs/voice.md` is the house voice: the world's facts, who the
   characters are, how a line sounds, what would break the game, and "a place answers
   plainly". Site pages (the builder, the pass page, the shop) are plainer still: say what
   happened and what to do next.

2. **Find or make the file.** Player-facing words live in `src/data/copy/<job>.json`, and the
   code imports them — code holds mechanics (where a resident stands, what a toast is for,
   which icon goes in front of it), never prose.
   - An existing file: edit the words there.
   - A new one: add an entry to `JOBS` in `tools/copy-jobs.mjs` — `id`, `title`, `what`,
     `approved` (the path), `reads` (the script that imports it), `top` (its top-level keys),
     `fields` (one spec per string path: `kind` `prose` for anything read as a sentence,
     `label` for UI words and buttons; `aim`/`max` lengths; `holds` for every `{placeholder}`
     the game fills; a `note` saying when the line is shown) and `shape` (a function returning
     `[]` or the file's own structural rules). A `brief` is optional now.
   - Toasts have helpers there: `toastLine(max, note, more)`, `holdsAll('coins', …)` (declares
     each hole AND requires it, so a line cannot silently lose its number) and `NO_MARKUP` (for
     a line that goes into innerHTML). A site toast may set `emojiOk` (the emoji is part of the
     sentence) or `clockOk` (a real promise like the review turnaround, not a game timer).

3. **Wire it.** Import the JSON, fill placeholders with a small helper (`fillWords` in
   `src/scripts/banana-town.js`: `{name}` → the value, a hole with no value stays visible),
   and keep icons and markup in the code: `toast('🪙 +' + n + ' ' + W.coins)` is fine; typed
   words are not.

4. **Check it.**
   ```
   node tools/check-copy.mjs          # every line against its field's limits + the voice rules (in CI)
   node tools/check-literal-says.mjs  # no words typed into say/toast/passToast/bigMoment (in check-all + CI)
   ```
   `/dev/copy/` shows every file's live words with lengths and rule flags.

5. **Show Trym.** Put the lines you added or changed in the reply, so he can read them there
   and ask for changes.

## 🔒 Locked sections — the words Trym wrote himself

When Trym writes or tunes lines himself, that section is **locked** in `tools/copy-jobs.mjs`:

```js
locked: { peel: 'Trym wrote and tuned Old Peel himself (13 Sep 2026). …' },
```

Today that is **Old Peel** in `park-npcs` — Trym, 13 Sep 2026: *"ive already optimized old
peels dialogue myself, no need to change it"*. Never rewrite a locked section, and never
remove a `locked` entry unless Trym asks for it by name.

- `tools/guard-copy.mjs`, a PreToolUse hook, applies every Edit/Write on a copy file in memory
  and **denies one that would change a locked section**. Everything else in the copy files is
  yours to write.
- `tools/check-copy.mjs` still proves the lock through the retired rig's `--approve` every
  run, and `tests/park-peel.spec.mjs` asserts on the built site that Old Peel says what the
  file says.

## The toast gate

`tools/check-literal-says.mjs` reads every `say` / `toast` / `passToast` / `bigMoment` call in
`src/scripts/*.js` and fails on a string literal with a letter in it (markup, entities,
`{placeholders}`, emoji and copy keys like `lifeWords('toasts')` are not words). Lines typed in
before 22 Sep 2026 are listed word for word in `tools/literal-says-owed.json`; that list only
shrinks — move a line into a copy file, then take it off.

## Not copy

Commit messages, code comments, this repo's docs and what you say to Trym in chat are not
player-facing: write those in the style of `bug-reporting-style` (three short beats, no lecture).
