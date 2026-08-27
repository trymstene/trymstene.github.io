# /pass/ — the build spec (final)

Synthesised from the UX review + three critiques in `pass-ux-review.md`.
Where the proposal and a critique disagreed, the ruling is here and is final.

## The diagnosis, in one line
Every link in the world promises "your stuff" or "your verdict"; the page opens
with an account console, an H1 that says *log in*, and a newsletter ask — and
puts the shelf 1592px down.

## Ruling principles
1. **The card is the page header.** Account is a ROW, not a page.
2. **A zero is never a number, a zero is a door.**
3. **Nothing on the first screen that a player does once ever.**
4. **The zero state has no navigation** — a newcomer gets doors, not three empty drawers.

## MOBILE ORDER (the only order; desktop is a two-column re-flow of it)
1. `THE CARD` — full width, ONE size (delete the `--mini` variant entirely).
   Badge strip visible. Whole card taps to the share modal.
2. `THE PROMISE` — one line under the card, kept verbatim from today's best
   sentence: *Everything you make and win saves automatically.*
3. `NEWS FOR YOU` — only when non-empty. Render ALL UNREAD + the 2 most recent
   read. Mark read ONLY what was rendered.
4. `THE ASK` — newsletter, folded into the FOOT of the news strip. Above the
   doors, never below them. Self-hides for people already subscribed.
5. `SUBNAV` — 3 tabs, `flex:1 1 0; min-width:0`. **Not rendered at all in the
   zero state.** `Numbers` is not rendered until some stat is non-zero.
6. `PANE`
7. `DOORS OUT`
8. `THE KEEP ROW` — the account. Collapsed to one row when logged in.
9. Footer.

## THE ZERO STATE (nothing made, nothing earned)
No subnav. No panes. No stat tiles. No merch card. In the pane slot, ONE block:
three doors — `Make a banana →` `Forge an emoji →` `Make an item →` — using the
existing door grammar. The card's signature slot renders a dashed placeholder
frame reading *your banana goes here*, tapping through to the builder. The rank
block renders the TITLE only (no bar, no rep number) until rep > 0.
The keep row is ONE quiet 48px row: *Save this to your email later →*.

## THE PANES
- **`Made`** (default) — one mixed-kind shelf, newest first. KEEP the mixed-kind
  `onPick` router (banana → builder, wearable → items workshop, emoji → forge);
  it relocates, it does not disappear. Filter chips ONLY when ≥2 kinds are
  non-zero; with one kind the heading carries the count.
  Each tile gets a 44px labelled `Make it real` button in its foot (PixelIcon,
  never the bare 🏷 emoji) — the ask belongs at the last click, on the item.
- **`Earned`** — **GEAR FIRST** (actionable), then Badges (a trophy case), each
  earned-first. Chip row `Gear · Badges`.
- **`Numbers`** — keep zero rows as DIMMED TILES WITH THEIR EARN HINT (the badge
  pane's own pattern), non-zero ranked first. Never a grey "still at zero" list.
  **Add coins** — the one value with a live economy behind it.
  Fix the label collision: `bananas built` and `bananas taken home` are the same
  expression under two names. One name.

## THE KEEP ROW (account)
One DOM tree, one email form, two densities.
- Logged in → ONE 48px row. Its HEADER IS THE SYNC LINE (*Saved to your email* /
  *Signing you in…* / *Offline — showing this device*) so magic-link feedback and
  the offline apology are never hidden. Expanded: link a device, enter a code,
  the `psMailWhose` shared-tablet warning verbatim, `Log out` LAST and smallest.
- Logged out → expanded only when there is something to keep
  (`shelf.length || builds || earned.length`), with a concrete claim
  (*Keep DISCO DEBBIE — one email, no password*). Otherwise one quiet row.
- KEEP the three perks verbatim — *No password · Any device · Keeps everything
  you've made*. They are plain text and they are the only answer to "why give
  you my address". (The review confused them with the newsletter topic chips.)

## DEFAULT TAB
`hash || lastTab || dotDerived || 'made'`. `lastTab` written on every select.
`dotDerived`: if the nav dot counted badges/notices, open `Earned`.
Alias old hashes: `overview|bananas|items|emotes → made`, `badges|gear → earned`,
`stats → numbers`.

## DESKTOP (≥900px)
Two columns, `max-width: 1120`. Left rail ~320px holds card, promise, subnav,
doors, keep row. **Sticky the CARD ONLY** — a rail taller than the viewport
strands the doors at 1280×800. Right column: news, then the pane, 4-up.
Under 900px it unstacks to the mobile order above.

## KEEP (do not "fix")
- The `X` delete on tiles — housekeeping is a veteran act. Make it a 44px inset
  hit area with a low-contrast glyph that reaches full contrast on hover/focus.
  Do NOT add an Edit mode, and do NOT add a `readonly` flag to the shared
  `renderShelf`.
- All existing sync/link/mail logic and copy.
- The double opt-in and the unbundled-consent separation.

## HONESTY FIXES
- Merch flag: `flag: fit.made ? 'MADE BY YOU' : ''`, and show the classic banana
  bare when the outfit isn't theirs. Never stamp MADE BY YOU on a default banana.
- Every new component uses PixelIcon, never an OS emoji.
- Relabel the exit `To the dancefloor →`.
- Gloss `rep` where it first appears.

## HARD CONSTRAINTS
- **JS budget: `pass.astro` is at 94% of 38 000 B. The rebuild MUST come out
  SMALLER.** If it cannot, stop and say so rather than raising the line.
- Tap targets ≥44px on every named job (name, share, wear, make-it-real, tabs).
- Verify at **375×667 and 360×640**, not just 393×852 — the subnav must be on
  the first screen in every state where it renders.
- Height claims must include the ~870px footer or say "above the footer".
