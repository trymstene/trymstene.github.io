# /pass/ UX review — raw working notes (saved mid-run 26 Aug)

> The proposal + the critiques that had finished when the session was stopped.
> The merged final spec had not run yet.



---

## Part 1

I've read all four screenshots and the source. Here is the spec.

---

# /pass/ — review & restructure

## 0. The one-line diagnosis

**Every link in the world that points at this page promises the same two things, and the page delivers neither above the fold.**

The actual inbound copy, from the codebase:

- `ForgeStudio.astro:468` — "🎉 Saved to **your shelf**" → `/pass/`
- `ForgeStudio.astro:469` — "The verdict lands on **your pass**" → `/pass/`
- `banana-builder.js:844` — "Sent for review — the verdict lands on **your Banana Pass**"
- `banana-pass.js:289` — "🎖 *Badge* — **badge on your pass**"
- `banana-rave.js:62` — "CLAIM YOUR BANANA PASS — badges · gear · stats →"
- `Nav.astro:40` — "🎫 My Pass"

Nobody is promised a login screen. Every arrival expects **my stuff** or **my verdict**. The page opens with an account console, an H1 that says `log in to banana world`, and a newsletter ask — and puts the shelf 1592px down. The page is answering a question nobody asked on the way in.

Nothing links to `/pass/#gear` or any other tab hash (I grepped `src/` and `public/` — zero hits), so the tab structure carries no external contract. It can be rebuilt freely.

---

## 1. REVIEW — ordered by what it costs the player

### 1.1 WRONG ORDER (they can't find what they came for) — the expensive stuff

**① The pass card is below the fold for a logged-in player. `veteran-mobile-full.png`**

Measured from the screenshot: nav ends 74px, and the card's black header strip starts at **693px**. On a 393×852 device with browser chrome the usable viewport is ~700–750px, so the emotional centre of the page — a keepsake, a share object, the thing the card CSS comment calls "the PNG people share" — is a strip of black at the very bottom edge, if it's visible at all.

What occupies those 693px instead, in order: a green `LOGGED IN ✓` chip, an H1, a lead line, **a two-line network-failure apology** ("Couldn't reach your account just now…"), `Link another device`, `Log out`, a dashed rule, and the full newsletter block (heading + 5 chips + email field + button + 2 lines of fine print). That is 21% of a 3309px page and 100% of the first screen spent on things a player does roughly once ever.

The returner's job is "what's new, what did I get". They get: an error message and two admin buttons.

**② `Log out` is above the player's own content.**

At y≈384 — 300px *before* their card. Log out is the single most destructive control on the page and it sits in the prime slot, twice as prominent as anything they own. There is no state in which this is right.

**③ The 7 tabs overflow and hide 4 of 7 sections.** `veteran-mobile-full.png`

The row reads `Overview | Stats | Badges 4/18 | Gea…` — the 4th tab is clipped mid-word. Gear, Bananas, Items and GIFs & emotes exist only if you guess that the row scrolls sideways. There is no scroll affordance (`.ps-tabs` sets `scrollbar-width: none`, no fade, no chevron). Two of the four named jobs in the brief — *find a GIF I downloaded*, *get my sticker made* — live behind that clipped edge.

This is the [[below-fold-trap]] in its horizontal form: the control exists, works, and is off-screen.

**④ The Overview tab is a table of contents to a page one tap wide.**

Everything in the Overview pane is a preview of another pane on the same page:

| Overview block | duplicates |
|---|---|
| 3 hero stat tiles (`bananas built`, `rave minutes`, `badges earned`) | the Stats pane rows + the card's own level/rep bar |
| Recent badges + "See all →" | the Badges pane |
| Latest creations + "See all →" | the Bananas / Items / GIFs panes |

`paint()` renders "bananas built" **three times** on one page: hero tile, `statAll` row, tab count. The default landing pane contains zero unique content. Every tap on "See all →" is a tap the player only needed because the Overview stood between them and the thing.

**⑤ The doors out are 2310px down.**

`Make a banana →` / `To the floor →` sit under the whole page. A first-timer sent here by the builder has no visible way onward until they scroll 3 screens past a wall of zeros and an ad.

### 1.2 WRONG CONTENT (shouldn't be here at all)

**⑥ A brand-new player's first screen after login is `0 / 0 / 0`, then "No badges yet", then "Nothing yet", then an advert.** `newbie-mobile-full.png`

Three big yellow tiles containing zeros are not a "gentle nudge" — they are three trophies for nothing. The `paint()` comment says "a full frontpage that gently points at what's still to do", but a zero doesn't point anywhere; it's a dead end with a border and a drop shadow.

**⑦ The merch card claims a banana the newbie didn't make.**

In `newbie-mobile-full.png` the offer card carries the red **MADE BY YOU** flag over a default banana (`myOutfit()` fallback) that the player has never touched, priced at $4.99, as the final thing on their first visit. It's a false claim, and given the shop's measured history it is also the worst possible use of a first-visit slot.

**⑧ The newsletter ask is at position 2 of the page.**

It is the only block on /pass/ whose value accrues to the business rather than the player, and it is above the player's card, their badges, and everything they've made. The code comment correctly argues it must never be bundled with the login — that argument is about *consent*, and it was answered by putting the ask in the second-most valuable slot on the page. Right principle, wrong slot.

**⑨ The network apology has permanent furniture in the layout.**

`.ps-sync__note` reserves `min-height: 1em` and, when a fetch loses the race, fills two lines at y≈256 — above the card. Honest, correct behaviour, wrong altitude: a transient sync note belongs next to the sync status, not above the identity.

**⑩ 14 stat tiles, most of them zero for almost everyone.**

`drops survived`, `jelly times`, `fistbumps`, `happy hours won`, `records delivered` — a full pane of counters, with no aggregation and no story. Rich in the world, meaningless as a grid.

### 1.3 MESSY (aesthetic / consistency) — cheap to fix, worth fixing

**⑪ OS emoji used as UI icons, next to correct PixelIcon usage.** Direct violation of [[reuse-world-ui-grammar]], and it's the main reason the page reads as unfinished:
- hero tiles: `🍌 🪩 🏅`
- perks chips: `🌍 ✨ 🎁 🔧 🛒`
- `🔗 Link another device`, `📣 Want a note…`, `✏️ Tap the pencil…`, `🎫 Everything is saved…`, `⏳`/`🎁` pending lines, `n.icon` in notices, `🏷` on shelf tiles
- meanwhile `PixelArtIcon` is used correctly for save / download / card / close / bell / edit

**⑫ Two card sizes, and the small one is the one you see.** `.ps-official--mini` is 18 CSS overrides re-tuning every part of the card down, existing only because the card was squeezed into a 340px sidebar beside the login form. Its own comment documents the fragility ("these rules must stay AFTER the base ones… source order is what decides the size"). The keepsake is displayed at 68px signature canvas, patches `display: none`.

**⑬ Tap targets under 44px, on the named jobs.** Measured from the CSS:
- `.ps-nameedit` pencil ≈ 20px — this is *name your banana*, one of the four jobs in the brief
- `.ps-seeall` "See all →" ≈ 19px
- `.ps-alt__toggle` "Or use Face ID" / "Log out" ≈ 17px
- `.ps-tab` ≈ 39px
- `.ps-gear__btn` "wear it" ≈ 38px
- `.shelf-x` delete = 24px, and it is the highest-contrast element on every creation tile (black square, white border, top-right, overhanging by 12px). On the overview strip in `veteran-mobile-full.png` the X buttons visually collide with neighbouring tiles. **Delete is the loudest affordance on the things they're proudest of.**

**⑭ The H1 lies about state, and the kicker does two jobs.** Logged out the H1 is `log in to banana world` — but the pass already exists on the device; the card to its right is already theirs. The page frames a free thing they already own as a gate. Meanwhile `.kicker` is a joke on one state ("MEMBERS ONLY (EVERYONE'S A MEMBER)") and a status light on the other ("LOGGED IN ✓"). One element, two unrelated jobs — that's why the top reads muddled.

**⑮ Panel leads are permanent tutorials.** Every pane opens with 1–3 lines of `.ps-panel__lead` explanation, shown forever. Gear's is three lines. A veteran reads them on every visit. Explanation is empty-state content.

### 1.4 DESKTOP `veteran-desktop-full.png` / `newbie-desktop-full.png`

`.ps-wrap` is `max-width: 900px`, centred in 1280. The top does split into two columns (login left, card right), then **everything below the tab bar is a single 900px column with ~380px of permanent dead space** and the notices list capped at 640px inside it. The veteran page is still 2228px tall — 2.5 screens on a desktop that could show the whole thing at once. Four creation thumbnails sit in a row with two-thirds of the row empty. Nothing is sticky, so scrolling to the shelf loses the card, the level bar and the doors.

---

## 2. RESTRUCTURE

### 2.1 The principle

The page has three jobs and today they are stacked worst-first:

| job | frequency | today's position | should be |
|---|---|---|---|
| **be my identity** (card, name, level, share) | every visit | 693px down | the page header |
| **hold my stuff** (made / earned) | every visit | 1592px down | the body |
| **run my account** (login, devices, logout, list) | once ever, then never | 117–668px | one row |

So: **card → status row → news (if any) → 3 tabs → pane → doors → the ask.** Account is a row, not a page. Login is a *means*, and it gets the space a means deserves.

### 2.2 The three arrivals

**A. First-timer, just made a banana, doesn't know what a pass is.**
Needs, in order: *(1)* "that's my banana, on a card with my name on it" — recognition before explanation; *(2)* "it's saved here, and one line of email keeps it forever" — the reason a pass exists, stated as a benefit next to the thing being kept; *(3)* **doors, not zeros** — three things to go do.
Never sees: a stat tile, a "0", a wall of grey "nothing yet", or a merch ad for a banana they didn't build.

**B. Returner: "what's new, what did I get".**
Needs: *(1)* the card with the level bar (progress since last time, on the object it belongs to); *(2)* **News for you** — verdicts, approved items, drops — only when there is something, directly above the tabs so it costs zero taps; *(3)* the newest thing they made, top-left of the default pane.
Never sees: an account console, or an Overview pane that previews the pane below it.

**C. Job-doer.** Four named jobs, and the tap cost now vs. proposed:

| job | today | proposed |
|---|---|---|
| log in on a new phone | 0 taps (it's the whole first screen) | 0 taps — logged-out state opens the row expanded, field visible under the card |
| find a GIF I downloaded | horizontal-scroll a clipped tab row to tab 7 | 2 taps: `Made` → `GIFs` chip |
| name my banana | hit a 20px pencil 950px down | 1 tap on a 44px name row in the first screen |
| get my sticker made | scroll 1848px, or find tab 5 and the 🏷 on a tile | `Made` → 🏷 on the tile, or the offer card at the foot of `Made` |

### 2.3 Section order — MOBILE (393px)

1. **THE PASS CARD** — full width, one size, first element. Signature canvas at 104–128px, name row, member-since, level chip + rep bar, **badge strip visible** (it is currently `display:none` on the size everyone sees), barcode + serial, OFFICIAL stamp. Whole card tappable → share modal.
2. **`Open my pass`** — full-width button, 48px. Unchanged behaviour, unchanged modal.
3. **THE KEEP ROW** — one disclosure element, two densities (§2.6).
4. **NEWS FOR YOU** — renders only when non-empty (already conditional in `renderNotices()`); **max 2 items**.
5. **SUBNAV** — 3 tabs (§2.5).
6. **PANE** — `Made` (default) / `Earned` / `Numbers`.
7. **DOORS OUT** — `Make a banana →` `To the floor →`.
8. **THE ASK** — newsletter, as a one-line disclosure (§2.6).
9. Site footer.

Cut from the flow entirely: the kicker chip, the state-swapping H1, the lead line, the perks chips, the two `ps-device` hint paragraphs, the Overview pane, the hero stat tiles, both "See all →" rows, the standalone newsletter block.

### 2.4 Above the fold on 393×852 — the budget

```
  74   site nav
  16   pad
 240   THE PASS CARD (full width, 361 content)
  12
  48   [ Open my pass ]
  12
  48   keep row, collapsed  (logged in)      |  150  keep row, expanded (logged out)
  16
  48   Made · Earned · Numbers
─────
 514  → first pane rows begin visible        |  616  → subnav still visible
```

Both states put **card + status + navigation** inside the first screen with room to spare, against today's 693px-of-admin. Non-negotiable: the subnav must be on the first screen in every state, because it is the only route to 100% of the page's content.

Target for the whole page: **veteran mobile ≤ ~1700px (2 screens)**, down from 3309px.

### 2.5 The subnavigation

**Three items. `Made` · `Earned` · `Numbers`.**

The player's own question is "which pile is it in?", and there are exactly two piles — *things I made* and *things I was given* — plus the numbers. Seven tabs asked them to know the difference between a wearable, an item and an emote before they could look at any of them.

| today | → | notes |
|---|---|---|
| Overview | **CUT** | contained nothing of its own |
| Bananas (n) | `Made` → chip `Bananas` | `renderShelf` already takes a `kinds` array — the merge is a filter, not new code |
| Items (n) | `Made` → chip `Items` | |
| GIFs & emotes (n) | `Made` → chip `GIFs` | |
| Badges (n/18) | `Earned` → block 1, heading `Badges 4/18` | all 18 tiles, earned first |
| Gear (n) | `Earned` → block 2, heading `Gear 3/9` | manifest gear + community items, `renderGear()` untouched |
| Stats | `Numbers` | slimmed, §2.7 |
| World notifications | page-level strip above the tabs | it's temporal, not a collection — it was never a peer of the others |

Naming: rejected `Collection` (doesn't separate earned from made — the whole point), rejected `Stats` (dashboard word; `Numbers` matches the existing house line "Every number the pass keeps").

**Phone behaviour.** One row, three chips, no counts in the chip labels, `flex: 1` so they share the width — no horizontal scroll, ever. Counts move into the pane headings, where they have room to be readable ("Badges 4/18", not a 0.68rem pill). Min-height 44px. Measured at 360px: `Made` ≈94 + `Earned` ≈100 + `Numbers` ≈100 + gaps 16 = **310 < 328 available**. Fits the narrowest target with margin. **If a 4th tab is ever proposed, it overflows — the 3-tab cap is the design.**

**Desktop behaviour.** The same three become a vertical list in the sticky left rail. Same `data-tab` contract, same ARIA tab pattern, same arrow keys, same `#hash` — only the flex direction changes.

**Default pane: `Made`.** Most sessions arrive from a tool that just said "saved to your shelf". Newest-first across all kinds, which *is* "Latest creations" — so that Overview block disappears rather than moving.

**Hashes.** Keep `#made` / `#earned` / `#numbers` via the existing `replaceState`. Add a 4-line alias map for old bookmarks: `overview|bananas|items|emotes → made`, `badges|gear → earned`, `stats → numbers`.

### 2.6 Where the account and the newsletter go

**THE KEEP ROW** — one DOM tree, one email form, one set of listeners, two densities. Not a modal: no overlay, no focus trap, no second home for the email field, and the `[hidden] { display: none !important }` guard already in the stylesheet keeps it honest.

*Logged out — expanded by default* (this is a conversion moment; it does not get hidden):
```
┌─────────────────────────────────────────────┐
│ ▸ Nothing is saved yet                      │  ← 44px+, yellow, ink border
│   One email keeps this card forever.        │
│  ┌──────────────────────────┐ ┌───────────┐ │
│  │ you@email.com            │ │  Log in   │ │
│  └──────────────────────────┘ └───────────┘ │
│   Other ways in                             │  ← 44px text row → passkey + code box
└─────────────────────────────────────────────┘
```
*Logged in — collapsed to one row:*
```
┌─────────────────────────────────────────────┐
│ [lock] Saved to your email      Account  ▾  │  ← 48px, quiet, paper not banana
└─────────────────────────────────────────────┘
```
*Expanded (the job "log in on my new phone"):* `Link another device` + code display · `Got a code from your other device?` · the **sync note lands here** (this is where "couldn't reach your account" belongs — beside the sync status, not above the card) · add-email field for passkey-only passes, with the existing `psMailWhose` shared-tablet warning verbatim · `Log out` last, smallest, at the bottom.

All existing copy and all existing logic in `initSync()` / `wireMail()` / `wireLink()` survive; only the container and the default-open rule change. `Log out` moving from y≈384 to the bottom of a collapsed row is the single biggest safety improvement on the page.

**THE ASK** — newsletter, last slot, below the doors out:
```
📣 Want a note when the world gets bigger?  →    ← one 44px row, expands to field + button
```
It stays a separate form with its own submit and its own double opt-in, so the unbundled-consent doctrine in the code comment is fully preserved — it is now *further* from the login than before, not closer. And bottom-of-page is where a satisfied player is standing, which is a better moment to ask than the second thing they see. **Cut the five topic chips** — they are five OS emoji in pills; the scope-is-the-consent requirement is met by one line of copy ("new areas, features, items and the odd bit of merch — one click unsubscribes").

### 2.7 Empty states: a zero is never a number, a zero is a door

**Rule: no count is ever displayed as its own tile. A count of zero renders as the thing you'd do to make it non-zero.**

- **Hero stat tiles: cut.** Progress lives on the card's level chip + rep bar, where it belongs — a card with a level on it is a status object; three tiles saying 0 are three failures.
- **`Made`, empty** → three door cards, in the existing `/dev/design/` "where to?" door grammar (already canon, already styled, zero new visual language):
  ```
  Build a banana →   Forge an emoji →   Make an item →
  ```
- **`Made`, one filter empty** (e.g. `GIFs` with 0) → that filter's single door, not a grey sentence. The chip still renders with its count, because the empty chips are a feature map.
- **`Earned`, empty** → **already correct today** and nobody sees it: 18 badge tiles in dark silhouette with hints, "the dark ones tell you where the fun is hiding". That is the best empty state on the site and it's behind a clipped tab. Promoting it is most of the fix. Same for gear's grayscale closet.
- **`Numbers`, empty/sparse** → render tiles only for non-zero rows; collect the zeros into one quiet wrapped line: *"still at zero: drops survived · fistbumps · records delivered · happy hours won"*. Fewer nodes, no wall.
- **The merch offer** → gated on `nBananas > 0 || S.builds > 0`. A newbie gets the `Build a banana →` door in that slot instead. This removes both the false **MADE BY YOU** claim and an advert from the first-visit experience.
- **The `✏️ Tap the pencil` hint** → only while the name is still auto-generated. Once named, it's noise forever.

### 2.8 Desktop — what the width buys

Two columns at ≥900px, `max-width` raised **900 → 1120** so the right column actually gets ~760px (a real 4-up grid).

- **LEFT RAIL, ~320px, `position: sticky`** — the card, `Open my pass`, the keep row, the vertical subnav, the doors out. Everything about *who you are and where you can go* never scrolls away. A membership card pinned to the side of the page is the right metaphor and the right ergonomics.
- **RIGHT COLUMN, fluid** — News for you, then the pane, on a 4-up grid (`minmax(150px, 1fr)` already does this; it just needs the room). The notices `max-width: 640px` cap stays — that's a measure limit, correctly applied.

Under 900px the rail unstacks to the mobile order (§2.3) — one media query, replacing the `.ps-top` grid that gets cut.

---

## 3. Wireframes

### 3.1 Mobile — first-timer, logged out, nothing made

```
┌───────────────────────────────────────┐
│ TRYMSTENE                         ☰   │
├───────────────────────────────────────┤
│ ╔═══════════════════════════════════╗ │
│ ║ ★ BANANA WORLD · MEMBERSHIP PASS ○║ │
│ ║ ┌──────┐  Fresh Dancing Banana ✏ ║ │ ← whole name row = 44px tap
│ ║ │ 🕺   │  MEMBER SINCE TODAY      ║ │
│ ║ │banana│  ▐LVL 1 · FRESH PEEL▌    ║ │
│ ║ │ 104px│  ▓░░░░░░░  0/195 rep     ║ │
│ ║ └──────┘  [·][·][·] ← badge strip ║ │   (visible now, not display:none)
│ ║ ▌▐▌▌▐▌▐         Nº MT9FPGIO ⟨OFFICIAL⟩║
│ ╚═══════════════════════════════════╝ │
│ ┌───────────────────────────────────┐ │
│ │ ▣  Open my pass                   │ │  48px
│ └───────────────────────────────────┘ │
│ ┌───────────────────────────────────┐ │
│ │ Nothing is saved yet              │ │  ← yellow, ink border
│ │ One email keeps this card forever.│ │
│ │ ┌─────────────────┐ ┌───────────┐ │ │
│ │ │ you@email.com   │ │  Log in   │ │ │
│ │ └─────────────────┘ └───────────┘ │ │
│ │ Other ways in                     │ │
│ └───────────────────────────────────┘ │
│ ┌────────┬────────┬─────────┐        │
│ │ Made ▉ │ Earned │ Numbers │        │  ══════ FOLD ~616px ══════
│ └────────┴────────┴─────────┘        │
│  All · Bananas · Items · GIFs         │
│                                       │
│  Nothing here yet — go make something.│
│ ┌─────────────────┐ ┌───────────────┐ │
│ │ Build a banana →│ │Forge an emoji→│ │  ← doors, not zeros
│ └─────────────────┘ └───────────────┘ │
│ ┌─────────────────┐                   │
│ │ Make an item  → │                   │
│ └─────────────────┘                   │
├───────────────────────────────────────┤
│ [Make a banana →] [To the floor →]    │
│ 📣 Want a note when the world grows? →│
└───────────────────────────────────────┘
```
No zeros. No advert. No "log in to banana world" H1 framing a free thing as a gate. Total ≈ 1100px.

### 3.2 Mobile — returner, logged in, has stuff

```
┌───────────────────────────────────────┐
│ TRYMSTENE                         ☰   │
├───────────────────────────────────────┤
│ ╔═══════════════════════════════════╗ │
│ ║ ★ BANANA WORLD · MEMBERSHIP PASS ○║ │
│ ║ ┌──────┐  DISCO DEBBIE          ✏ ║ │
│ ║ │ 🕺   │  MEMBER SINCE 13 MAY 2026║ │
│ ║ │      │  ▐LVL 11 · FACE AT DOOR▌ ║ │
│ ║ └──────┘  ▓▓▓▓▓░░  225/645 rep    ║ │
│ ║  [M][N][R][OG]  ← 4 badges earned ║ │
│ ║ ▌▐▌▌▐▌▐         Nº MP4LCJPB ⟨OFFICIAL⟩║
│ ╚═══════════════════════════════════╝ │
│ [ ▣  Open my pass ]                   │
│ ┌───────────────────────────────────┐ │
│ │ 🔒 Saved to your email  Account ▾ │ │  48px, quiet
│ └───────────────────────────────────┘ │
│ News for you                          │
│ ┌───────────────────────────────────┐ │
│ │ ▲ Your banana can wear more than  │ │  max 2
│ │   one club item now. …→     26 AUG│ │
│ └───────────────────────────────────┘ │
│ ┌────────┬────────┬─────────┐        │
│ │ Made ▉ │ Earned │ Numbers │        │  ══ FOLD ~640px ══
│ └────────┴────────┴─────────┘        │
│  All ▉ · Bananas 7 · Items 0 · GIFs 0 │
│  ┌────┐ ┌────┐ ┌────┐                │
│  │ 🍌🏷│ │ 🍌🏷│ │ 🍌🏷│  newest first │
│  └────┘ └────┘ └────┘                │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐         │
│  │ 🍌 │ │ 🍌 │ │ 🍌 │ │ 🍌 │         │
│  └────┘ └────┘ └────┘ └────┘         │
│ ┌───────────────────────────────────┐ │
│ │ MAKE IT REAL — off the screen     │ │ ← only because builds > 0
│ │ [ See it as a sticker → ]         │ │
│ └───────────────────────────────────┘ │
├───────────────────────────────────────┤
│ [Make a banana →] [To the floor →]    │
│ 📣 Want a note when the world grows? →│
└───────────────────────────────────────┘
```
Card, level bar, news and navigation all inside the first screen. Delete X's are gone from the tile corners → moved behind a long-press / an `Edit` toggle on the pane header (see §4).

### 3.3 Mobile — the `Earned` pane (was tabs 3 + 4)

```
│ ┌────────┬────────┬─────────┐        │
│ │  Made  │Earned ▉│ Numbers │        │
│ └────────┴────────┴─────────┘        │
│ Badges 4/18                           │  ← count as a heading, readable
│ ┌──────┐ ┌──────┐ ┌──────┐           │
│ │ ★    │ │ ✦    │ │ ▤    │  earned   │
│ │Maker │ │First │ │Regula│  = yellow │
│ │13 MAY│ │ Night│ │ 2 JUN│           │
│ └──────┘ └──────┘ └──────┘           │
│ ┌──────┐ ┌──────┐ ┌──────┐           │
│ │ ▒▒▒  │ │ ▒▒▒  │ │ ▒▒▒  │  unearned │
│ │ ???  │ │ ???  │ │ ???  │  = grey +  │
│ │hint… │ │hint… │ │hint… │    hint    │
│ └──────┘ └──────┘ └──────┘           │
│                                       │
│ Gear 3/9                              │
│ ┌────────────┐ ┌────────────┐        │
│ │  🕺 banana │ │  🕺 banana │        │
│ │  Glowstick │ │  Wolf Tail │        │
│ │  by Barty  │ │            │        │
│ │[✓ wearing ]│ │[  wear it ]│        │  ← 44px buttons
│ └────────────┘ └────────────┘        │
```

### 3.4 Desktop ≥900px

```
┌──────────────────────────────────────────────────────────────────────────┐
│ TRYMSTENE                                                            ☰   │
├────────────────────────┬─────────────────────────────────────────────────┤
│ ╔════════════════════╗ │  News for you                                   │
│ ║★ MEMBERSHIP PASS  ○║ │  ┌───────────────────────────────────────────┐  │
│ ║ ┌────┐ DISCO DEBBIE║ │  │ ▲ Your banana can wear more than one …→   │  │
│ ║ │ 🕺 │ SINCE 13 MAY║ │  └───────────────────────────────────────────┘  │
│ ║ │128 │ ▐LVL 11▌    ║ │                                                 │
│ ║ └────┘ ▓▓▓▓░ 225/645│  All ▉ · Bananas 7 · Items 0 · GIFs 0           │
│ ║ [M][N][R][OG]      ║ │  ┌────┐┌────┐┌────┐┌────┐                     │
│ ║ ▌▐▌▐  Nº MP4LCJPB  ║ │  │ 🍌 ││ 🍌 ││ 🍌 ││ 🍌 │  ← real 4-up grid   │
│ ╚════════════════════╝ │  └────┘└────┘└────┘└────┘                     │
│ [ ▣ Open my pass     ] │  ┌────┐┌────┐┌────┐                           │
│ ┌────────────────────┐ │  │ 🍌 ││ 🍌 ││ 🍌 │                           │
│ │🔒 Saved  Account ▾ │ │  └────┘└────┘└────┘                           │
│ └────────────────────┘ │  ┌───────────────────────────────────────────┐  │
│                        │  │ MAKE IT REAL  [ See it as a sticker → ]   │  │
│  ▉ Made          7     │  └───────────────────────────────────────────┘  │
│    Earned      4/18    │                                                 │
│    Numbers             │                                                 │
│                        │                                                 │
│  [ Make a banana → ]   │                                                 │
│  [ To the floor →  ]   │                                                 │
│  ↑ sticky: never       │                                                 │
│    scrolls away        │                                                 │
└────────────────────────┴─────────────────────────────────────────────────┘
   320px rail                    fluid, ~760px @ 1120 max-width
```

---

## 4. THE CUT LIST

The JS bundle is at **35,714 / 38,000 bytes = 94%** (`dist/_astro/pass.astro_astro_type_script_index_0_lang.DkSFD_uo.js`). This restructure must come out smaller. It should, because it is mostly deletion.

**Cut — JS in `banana-pass-page.js`**
1. `psHeroStats` render block + the `hero` array — 3 tiles that duplicate the card and the Numbers pane.
2. `psOvBadges` render block (~18 lines of `createElement` + the "No badges yet" empty string).
3. The `psOvCreations` `renderShelf` call and its mixed-kind `onPick` router.
4. The `data-goto` delegated click handler in `initTabs()` — nothing deep-links between panes any more, because there is no pane that previews another.
5. `setCount('cnt-bananas'|'cnt-items'|'cnt-emotes')` → one `cnt-made`; `cnt-badges` + `cnt-gear` → one `cnt-earned`. Two fewer count writes, and the counts move to pane headings where the `.ps-tab__count` pill styling is no longer needed.
6. Two of the three `renderShelf` calls for the split shelves → one call with a `kinds` array (the API already supports it) plus a small chip handler. Net roughly neutral.
7. `statAll` trimmed to non-zero rows + one joined string of zero labels — fewer nodes, same code size.

**Cut — CSS in `pass.astro`**
8. **The entire `.ps-official--mini` block, 18 rules** (lines 74–94). One card, one size. This also deletes the documented source-order fragility ("these rules must stay AFTER the base ones").
9. `.ps-hero-stats` / `.ps-herostat` + their 4 overrides in the `560px` media query.
10. `.ps-ov-badges` / `.ps-ov-badge` / `.ps-ov-head` / `.ps-seeall` / `.ps-ov-empty`.
11. `.ps-perks` (both uses) and `.ps-news__what` / `.ps-news__fine` / `.ps-news__lead` — the whole 5-chip newsletter apparatus collapses to one row + one field.
12. `.ps-top` grid + `.ps-top__main` / `.ps-top__pass` — replaced by the rail grid, not added to it.

**Cut — markup / content**
13. The `#panel-overview` section entirely.
14. The `.kicker` chip (both states — the joke and the status light).
15. The state-swapping H1 + `#psSyncLead`. One honest `<h1>your banana pass</h1>`, visually the card. Keep an sr-only H1 for a11y if the card is the visual heading.
16. Both `.ps-device` hint paragraphs → one conditional pencil hint (auto-named only).
17. `.ps-panel__lead` on `Made` and `Earned` when non-empty. Explanation is empty-state content; the empty state already carries it.
18. Four of the five tab-count `<span>`s; four of the seven `<button role="tab">`s.

**Cut — behaviour**
19. The merch offer, when the player has built nothing (§2.7). This deletes a false claim, not just a card.
20. The delete `.shelf-x` from tile corners by default. Put deletion behind an `Edit` toggle in the pane header, or long-press. Reason: delete is currently the highest-contrast element on the things the player is proudest of, at 24px, overhanging its own tile. (`banana-shelf.js` is shared — if this is out of scope for this page, pass a `readonly` flag and gate the X on it, which is smaller than the current unconditional render.)

**Explicit non-goals for v1** — good ideas that cost bytes and are not the problem: "new badges since your last visit" tracking; a notices archive; per-badge detail pages; migrating `n.icon` emoji in notices to PixelIcon (needs a worker-side icon vocabulary — do it when the vocabulary changes anyway).

**The budget rule:** the built chunk must come in **below 35,714 bytes**. Twelve CSS blocks and one whole panel are leaving; only a filter-chip handler and an expand toggle are arriving. If it comes out bigger, the restructure has been implemented as an addition and is wrong — **do not raise the `pass.astro` line in `tools/budgets.json` to make it pass.**

---

## 5. Build order

1. **Move the card to the top; delete `.ps-official--mini`.** One change, fixes finding ①, ⑫ and half of ⑬. Ship it alone and screenshot both states at 393.
2. **Collapse the account block into the keep row; move the newsletter to the foot.** Fixes ②, ⑧, ⑨, ⑭.
3. **7 tabs → 3; delete the Overview pane.** Fixes ③, ④, and the JS budget.
4. **Empty states → doors; gate the offer.** Fixes ⑥, ⑦.
5. **Desktop rail.** Fixes §1.4.
6. **Icon and tap-target sweep** against `/dev/design/`. Fixes ⑪, ⑬.

Verify per [[verify-visually-first]]: walk it as a player on the built site at 360, 375×667 and 393×852, in all four states (new+out, new+in, veteran+out, veteran+in), plus the network-cold state — that last one is how the apology paragraph got above the card in the first place.

---

## Part 2

**(a) THE ONE IDEA TO KEEP**

"Account is a row, not a page" — collapsing login/logout/device-linking into one disclosure and putting the pass card first is correct, and the returning player benefits most from it. Keep it exactly as specified.

---

**(b) WHERE IT FAILS THE RETURNING PLAYER**

**1. The nav dot promises "3 new" and the proposal's landing pane is the one pane that can't answer it.**
`public/js/main.js:344-400` paints a count on the My Pass nav item = `(earned badges − pass-seen-v1) + unread notices`. That dot is the returner's dominant entry point — bigger than all six inbound copy strings the proposal quotes, because it fires on every page in the world. The proposal defaults to `Made`, which the dot never counts. Cost: the number that got them here is unexplained on arrival; they must find `Earned` and scan 18 tiles for the change. Fix: derive the default pane from what the dot counted (badge/notice delta → `Earned`, otherwise `Made`) — ~6 lines in `initTabs`, no new subsystem.

**2. "New since your last visit" is declared a non-goal, but the data already exists and the page destroys it on load.**
`pass-seen-v1` holds the badge count at the last `/pass/` visit. `main.js` is loaded `is:inline` at the end of `<body>` (`src/layouts/*.astro:74`) — a classic script, so it runs *synchronously before* the deferred module `banana-pass-page.js`. `markSeen()` overwrites `pass-seen-v1` with the current count before `init()` gets a single frame. Same shape for notices: `passNoticesMarkRead` at +1800ms (`banana-pass-page.js:149`) marks all read whether or not anything was shown. Cost: the returner's core question is answerable today with data that is thrown away every visit, and the proposal writes it off as "tracking that costs bytes". Fix: export `passTakeUnseen()` from `banana-pass.js` that reads-before-clear, stash the ids in a module const, and mark those badge/gear tiles with a `--new` outline reusing the existing `.ps-patch--earned` outline grammar. ~15 lines, one CSS rule.

**3. The rep bar is sold as "progress since last time". It is an absolute number and there is no stored previous value.**
§2.2 arrival B: "the card with the level bar (progress since last time)". `banana-pass-page.js:215-218` renders `225 / 645 rep — next title at level 20`. Stats are cumulative totals via `statTotal`; nothing anywhere stores rep-at-last-visit. Cost: the proposal's headline answer to the returner is a relabel. Fix: stamp `rep` next to `pass-seen-v1` in `passVisit()` and render `+38 rep since you were last here` as a chip on the bar — the same three lines as #2, and it makes the card actually do the job the proposal assigns it.

**4. Gear moves from "tab 4, top of pane" to "below eighteen badge tiles".**
`.ps-patches` is `repeat(auto-fill, minmax(150px, 1fr))` (`pass.astro:287`) = **2 columns at 393px**, so 18 badges is 9 rows ≈ 1300-1500px before the `Gear` heading. And `renderGear()` (`banana-pass-page.js:458-470`) renders the *whole* GEAR catalog including unearned grey items, so `Earned` becomes ~27 tiles of which ~20 are things the player does not have. "wear it" is the most repeated action a returning player performs on this page. Cost: 1 horizontal swipe + 1 tap → 1 tap + a ~1400px scroll past a wall of silhouettes. Fix: give `Earned` the same chip row `Made` gets — `Gear · Badges`, **Gear first** (it is actionable; badges are a trophy case) — and sort earned-first inside each.

**5. The `Made` filter chips are a permanent second nav row that is empty for most players.**
`veteran-desktop-full.png` shows the real distribution: Bananas 7, Items 0, GIFs 0. For the typical player `All` and `Bananas` are the same view, and two chips are zeroes — which §2.7 elsewhere forbids ("a zero is never a number"), then re-permits here as "the empty chips are a feature map". Cost: ~44px of the first content row on every visit, forever, for a minority case. Fix: render the chip row only when ≥2 kinds are non-zero; with one kind the pane heading reads `Bananas 7` and there are no chips.

**6. "News for you — max 2 items" is silent data loss aimed precisely at the returner.**
`renderNotices()` (`banana-pass-page.js:693-717`) renders the full stored list today (capped at 30 in `passNoticeAdd`), and `passNoticesMarkRead()` marks **every** entry read regardless of what was rendered. Cap the render at 2 while marking all 30 read, and notices 3..N lose their unread highlight and — since "a notices archive" is an explicit non-goal — become permanently unreachable. The only player who ever has more than 2 unread is the one who has been away. That includes gallery and catalog verdicts on things they made. Cost: a verdict can vanish unseen. Fix: render all *unread* plus the 2 most recent read, with a "show older" toggle; at minimum change `passNoticesMarkRead` to take the ids actually rendered.

**7. Collapsing the account row hides the magic-link arrival feedback.**
`init()` writes `LOGIN_WAIT` into `#psSyncNote` when `landing.kind === 'in'` (`banana-pass-page.js:145-148`), and `refresh()` writes the cold-network apology into the same node. The proposal moves `psSyncNote` inside a disclosure that is collapsed by default when logged in. Cost: the returner who just clicked the email link on a new phone gets zero feedback that the link is being spent — the exact failure mode that put the apology above the card in the first place. Fix: the collapsed row's *header* is the sync line ("Saved to your email" / "Signing you in…" / "⚠ Offline — showing this device"); detail lives inside.

**8. A single default pane cannot serve both arrivals; last-tab memory can.**
`initTabs` (`banana-pass-page.js:627-673`) reads `location.hash` and nothing else — no memory. The proposal replaces one wrong default (`overview`) with another (`made`), justified by first-visit and tool-referral traffic. That is the brief's own warning: first-visit clarity charged to the 100th visit. Fix: `select(hash || lastTab || dotDerived || 'made')`, `lastTab` written on every `select()`. Two lines.

**9. Deletion behind an Edit toggle is a regression that also grows a shared module.**
`renderShelf` (`src/lib/banana-shelf.js:172`) has no `readonly` option; `.shelf-x` is created unconditionally at line 221. A veteran clearing a dud banana goes from 1 tap + confirm to 3 taps, and housekeeping is a *veteran* activity. Fix: keep the X, fix the actual complaint. `.shelf-x { top:-12px; right:-12px; width:24px; height:24px }` (`pass.astro:306`) becomes an inset 44px hit area with a low-contrast glyph that reaches full contrast only on hover/focus. Pure CSS, zero JS, no shared-module change, and it fixes the 24px tap target the proposal correctly flags.

**10. `Numbers` folds the zeros away, and the returner is the person who watches a zero become a one.**
`drops survived` going 0 → 1 is the returning player's evidence that a mechanic they hadn't met exists. Collected into "still at zero: drops survived · fistbumps · records delivered" it reads as a list of failures instead of a map. Fix: keep them as tiles, non-zero ranked first, zeros dimmed and carrying the earn-hint — which is exactly the badge pane's pattern the proposal calls "the best empty state on the site" and then declines to apply here.

**11. Coins are still nowhere on the identity page.** `coinsNow()` is exported (`src/lib/banana-pass.js:390`) and rendered by nothing in `pass.astro`. `statAll` (`banana-pass-page.js:288-302`) lists 14 rows and coins is not one of them. The restructure rewrites `Numbers` and leaves the one value with a live economy behind it off the pass.

**12. The sticky desktop rail will pin taller than the viewport and strand the doors.**
Card at a 128px canvas (~280) + Open 48 + keep row 48 + 3 vertical nav rows ~132 + 2 doors ~96 + gaps ≈ 640-700px, under a 74px nav. On a 1280×800 laptop usable height is ~700px. A `position: sticky` element taller than the viewport pins its top and its bottom becomes unreachable — "To the floor →" can never be clicked. Fix: sticky the card + Open button only, or `max-height: calc(100dvh - 90px); overflow-y:auto` on the rail. Verify at **1280×800**, not the 1280×900 that was captured.

**13. Three tabs is a mobile constraint charged to desktop.**
`veteran-desktop-full.png`: all 7 tabs fit inside ~1070 of 1280px *with their counts* — the tab bar is a one-glance inventory (`Badges 4/18 · Gear 0 · Bananas 7 · Items 0 · GIFs 0`). The proposal replaces it with 3 rail items and 2 counts, pushing per-kind counts into headings you have to navigate to. Fix: keep the 3-group IA but let the desktop rail nest the sub-counts (`Made 7 › Bananas 7 · Items 0 · GIFs 0`), `display:none` on the sub-line under 900px. Same DOM, no extra JS.

---

**(c) FACTUALLY WRONG OR NOT BUILDABLE AS SPECIFIED**

**A. The height targets are arithmetically impossible.** The site footer is ~850-900px tall on a 393px phone (it begins around y≈2400 of the 3309px veteran capture) and ~600px on desktop. §2.4 targets "veteran mobile ≤ ~1700px … down from 3309px" and wireframe 3.1 claims "Total ≈ 1100px" — but 3309 *includes* the footer. Nav 74 + card 240 + Open 48 + keep row 48 + subnav 48 + footer ~870 = **1328px before one item of content**. The logged-out 1100px figure is below the floor. Restate as "~2100-2200px for the veteran", or explicitly as "above the footer" — otherwise §4's pass/fail budget rule is being checked against a number that cannot be hit.

**B. "The merge is a filter, not new code" understates it.** The three shelf calls (`banana-pass-page.js:331-336`) each carry a distinct `onPick` route *and* a distinct `emptyMsg`. Merged, you need the mixed-kind router — which is exactly the `psOvCreations` router at line 340 that cut list item #3 deletes. It relocates; it does not disappear. Net saving is one call and two strings.

**C. "pass a `readonly` flag and gate the X on it, which is smaller than the current unconditional render" is false.** Current = create + append, unconditional. Proposed = the same code plus a flag, plus a gate, plus a page-side Edit toggle and its state — in a module shared by builder, forge and pass. It is strictly larger.

**D. "the level bar (progress since last time)" describes a value that does not exist** anywhere in storage. See (b)#3.

**E. Both mobile wireframes under-draw their own pane density.** 3.3 draws badges 3-up; `.ps-patches` `minmax(150px,1fr)` gives **2-up** at 393px. 3.2 draws a 4-up shelf row; `.shelf-item` is an 88px canvas + 3px borders inside a `0.8rem` flex gap → **3 per row** at 361px content. Both panes are ~35-50% taller than drawn, which is where the height target went missing.

**F. `flex: 1` and the 360px measurement contradict each other.** §2.5 both sets `flex: 1` (so the tabs always fill the row) and proves fit by measuring intrinsic widths. With `flex:1` plus the inherited `white-space: nowrap` (`pass.astro:112`), the text overflows its box rather than the box shrinking — the clipping the proposal is fixing returns at 320px. Needs `min-width: 0` and a shorter third label.

**G. Minor self-contradiction in the diagnosis.** §1.1④ says the Overview pane "contains zero unique content", but `#psNoticesSec` — World notifications — lives *only* inside `#panel-overview` (`pass.astro:491-499`) and is unique. The plan promotes it, so the outcome is right; but the correct reading is that Overview's one unique block was the returning player's block, badly surrounded — evidence the pane was mistargeted, not empty.

---

## Part 3

**(a) The strongest idea — keep this:** *"A zero is never a number, a zero is a door"* (§2.7) plus gating the merch card on having actually made something — that single rule is the only part of the spec that changes what a first-timer feels rather than where they scroll.

---

**(b) What is wrong with it, from the first-timer's seat**

**1. The new first screen has no sentence on it. None.**
§4 cuts the kicker, the state-swapping H1, the lead line, the perks chips and both `.ps-device` hints, and makes the H1 `sr-only`. What a cold arrival (nav "🎫 My Pass", the rave banner `banana-rave.js:62`) now meets, in order: a yellow card reading `★ BANANA WORLD · MEMBERSHIP PASS` in 0.68rem caps, a banana they have never seen, the auto-name *Fresh Dancing Banana*, `MEMBER SINCE 26 AUG 2026`, `LVL 1 · FRESH PEEL`, `0 / 195 rep — next title at level 5`, a barcode, `Nº MT9FPGIO`, a red `OFFICIAL` stamp — then a button, then an email field. **Player cost:** five seconds in and they cannot answer "what is this, and why is there a serial number on it". The proposal's §2.2 says "recognition before explanation" — but recognition requires something to recognise, and in the measured newbie state (`newbie-mobile-full.png`) the card's banana is the *default*, not theirs. **Alternative:** one visible 44px line directly under the card, in house display type, that is a promise not a heading: *"This card is already yours. Everything you make and win lands on it."* That is the current `#psSyncLead` ("Everything you make and win saves automatically") — the single best sentence on the page today, and the proposal deletes it.

**2. It condemns the false MADE BY YOU claim, then makes the same default banana the hero of the page.**
§1.2⑦ is right that the merch card lying about a default banana is unacceptable. §2.3 item 1 then puts that identical `myOutfit()` fallback banana at 104–128px as the emotional centre, on a card stamped OFFICIAL, above the fold, for a player who has built nothing. **Player cost:** the first thing they own is a thing they didn't make. **Alternative:** in the zero state the signature slot renders the *pass mascot* explicitly framed as a placeholder — a dashed pixel frame with "your banana goes here" and the card's tap target routed to `/make-a-banana/`. Same card, no false ownership, and the empty slot is itself the strongest door on the page.

**3. Two of the first three elements are the same object.**
Card → `Open my pass` (48px, full-width, black) → the login ask. The button opens a bigger copy of the thing immediately above it, and it outranks the conversion CTA visually. **Player cost:** ~60px of the first screen and a naming puzzle — "open" what, I'm *on* my pass. **Alternative:** the card is already `cursor:pointer` with `title="Open my pass"` (`src/pages/pass.astro:448`); drop the standalone button on mobile, put a small `[card icon] tap to share` inside the card foot beside the serial, and spend the reclaimed height on the doors. If a button survives, label it what it does: *Share my pass*.

**4. The login is still demanded, not earned — the proposal only fixed this for the newsletter.**
§2.6 makes the keep row expanded-by-default for every logged-out visitor, at position 3, headed *"Nothing is saved yet."* **Player cost:** an email demand before they have made a single thing worth saving, framed as a loss. It is also directly contradicted by §1.3⑭'s own argument ("the pass already exists on the device") and by the card 100px above it that says MEMBER SINCE TODAY. **Alternative:** key the expansion on *having something*, not on auth state. `shelfList().length || S.builds || earned.length` → expanded, with a concrete claim (*"Keep Disco Debbie — one email, no password"*). Zero-state → one quiet 48px row, *"Save this to your email later →"*, and the doors move above it. The email ask arrives the moment the shelf stops being empty, which is the moment it is true.

**5. The value prop for logging in is deleted by mistake.** See (c)/1 — §1.3⑪ and §4.11 cut `.ps-perks`, which is **"No password · Any device · Keeps everything you've made"** (`pass.astro:365-368`), the only three phrases on the page that answer "why give you my address". They are replaced with one line, *"One email keeps this card forever"*, which for a first-timer preserves nothing. **Alternative:** keep the three pills verbatim inside the keep row; they are plain text, cost nothing, and are already house grammar.

**6. The subnav — declared "non-negotiable on the first screen in every state" — is below the fold on two of the three named target devices.**
§2.4 budgets only 393×852. Run it at **375×667** (a stated primary target): 74 nav + 16 + card + 12 + 48 + 12 + 150 (logged-out keep row) + 16 ≈ **568–600px before the tab row**, against ~553px usable under iOS Safari chrome. Same failure at 360×640. And the card measurement is optimistic: the base card is 104px canvas on phones (`pass.astro:337`) with a 1.3rem Archivo Black name in a ~209px column — *Fresh Dancing Banana* wraps to two lines at 393 and three at 360, putting the card at **~265–295px, not 240**. §4.16 also keeps the pencil hint for auto-named players — i.e. exactly the newbie — and never budgets its ~24px. **Player cost:** the [[below-fold-trap]] again, in the state the whole restructure exists to fix. **Alternative:** stack the card body (canvas above meta) under 380px so the name gets full width, cap the phone canvas at 96px, and drop `Open my pass` per (3). Then re-run the budget at 667 height before writing any code.

**7. For a first-timer, all three tabs are empty — and the proposal promotes the empty drawers to the most prominent nav on the page.**
`Made` = nothing. `Earned` = 18 dark silhouettes + a grey closet. `Numbers` = every row zero. The Overview wall of zeros hasn't been removed; it has been redistributed into three labelled drawers with the handles above the fold. **Player cost:** three taps, three empties, and a page that reads as "you have nothing" three different ways. **Alternative:** don't render the subnav at all until there is one thing in any pile. Zero state gets a single START HERE block in the pane slot: three doors and nothing else. Fewer nodes, smaller JS, better screen, and it removes the width pressure that makes the 3-tab cap so tight.

**8. `Numbers` is a primary nav item that resolves to one grey sentence for a newcomer.**
§2.7 says render only non-zero rows and collapse the zeros into a line. For a brand-new player every row is zero, so the tab opens onto: *"still at zero: drops survived · fistbumps · records delivered · happy hours won…"* — a list of 14 things they have failed to do, reached by a tab they were invited to press. **Alternative:** hide the `Numbers` tab until any stat is non-zero. This also fixes the width math in §2.5 by making the newcomer's nav two chips.

**9. "Made" and "Earned" are both past-tense claims about someone who has done neither, and the split is not obvious.** A wearable another player forged that you caught: made or earned? A badge you got *for* making things? **Player cost:** a categorisation decision before any content. **Alternative:** name the piles by verb-of-arrival, not tense — `Stuff I made` / `Stuff I found` — or, cheaper and stronger for the zero state, label them by content once content exists (`Bananas & emoji` / `Badges & gear`).

**10. Jargon audit — the restructure adds density and removes every gloss.** On the proposed first screen a newcomer meets: *pass, member since, LVL, FRESH PEEL, rep, next title at level 5, OFFICIAL, Nº MT9FPGIO*, then *Made / Earned / Numbers*, then *To the floor →*. **`rep` is never defined anywhere on the page** — the only gloss is the Stats row "rep at the club" (`banana-pass-page.js:254`), which §2.7 collapses into the grey zero-line for exactly the people who need it. And `To the floor →` is one of the two primary exit doors: the least parseable label on the page, kept verbatim. **Alternative:** in the zero state the rank block renders as the title only ("FRESH PEEL — brand new") with no bar and no number; the first time rep is non-zero, the bar appears with "rep · what you get for showing up". Relabel the door `To the dancefloor →`.

**11. The zero-state wireframe still says "Nothing here yet" — the thing §2.2 promises they'll never see.** §2.2 arrival A: "Never sees … a wall of grey 'nothing yet'". Wireframe 3.1: *"Nothing here yet — go make something."* directly above the doors. **Alternative:** delete the sentence; the doors are the message. If a line is wanted, make it forward-facing: *"Three ways to put something on this card."*

**12. The first-timer wireframe shows five doors, two of which are the same door with different verbs.** 3.1 renders `Build a banana →`, `Forge an emoji →`, `Make an item →` in the pane, then `Make a banana →` and `To the floor →` at the foot. `Build a banana` and `Make a banana` go to the same place. **Player cost:** hesitation and a wrong mental model of how many places exist. **Alternative:** one door set. In the zero state the pane doors *are* the exits — cut the §2.3 item 7 row entirely when the pane is empty, and use the site's existing verb, "Make a banana", everywhere.

**13. The merch gate is the wrong gate, and the honest fix is one word the proposal walks past.** `myOutfit()` already returns `made: false` when there is no `bb-last` (`src/lib/make-it-real.js:138-147`), and `banana-pass-page.js:354` already computes it — then line 362 passes `flag: 'MADE BY YOU'` unconditionally. `flag: fit.made ? 'MADE BY YOU' : ''` removes the lie without removing the offer. The proposal's gate (`nBananas > 0 || S.builds > 0`) is coarser *and* leaky: the shelf syncs across devices, `bb-last` is localStorage-only, so a veteran on a new phone passes the gate, gets the default banana, and still gets stamped MADE BY YOU. **Alternative:** gate the *flag* on `fit.made` and the *card* on `fit.made || nBananas > 0`, showing the classic banana bare (`bare: true` already exists in `buildCard`) when the outfit isn't theirs.

**14. The one affordance the page's revenue depends on is left as a 24px OS emoji.** §4.20 correctly removes the delete `X` from tile corners, but the `🏷` buy affordance stays exactly as it is — an emoji, sub-44px, on a tile. §1.3⑪ names it as a grammar violation and then does not fix it. Per [[cro-placement-doctrine]] the ask belongs at the last click, on the item. **Alternative:** the tile footer gets one labelled 44px `[PixelIcon] Make it real` button; the pane-foot offer card becomes the second ask, not the only one.

**15. The newsletter is placed after two exit doors.** §2.3 orders: 7 doors out → 8 the ask. The only owned-audience asset on the site is positioned below two large "leave now" buttons. "Bottom-of-page is where a satisfied player is standing" is asserted, not evidenced — and it isn't true when you put the exits directly above it. **Alternative:** swap 7 and 8, or better: fold the ask into the foot of the `News for you` strip. Same subject ("a note when the world gets bigger" under the block that *is* world news), earned by the content above it, and it self-hides for people already on the list.

**16. The post-login return has no payoff.** The magic link lands back on `/pass/?in=…` (`banana-pass-page.js:1265+`) — the login is a round trip that ends on this same page. The proposal deletes the H1, the kicker and the lead — the only three elements that could visibly change state — so the return is a green nothing plus a toast that disappears. **Player cost:** the ask cost them a context switch and paid nothing back. **Alternative:** on `kind:'in'`, the keep row collapses to *"Saved to you@…"* and the card plays a one-shot stamp animation. Cheap, on-brand, and it is what makes the *next* ask credible.

**17. Desktop pins the demand.** §2.8 makes the sticky left rail contain the keep row. Logged out, that row is expanded (150px) — so the email form follows a browsing first-timer down the entire page and never goes away. **Alternative:** sticky the card + subnav + doors; let the keep row scroll off with the rest.

**18. The spec violates its own icon rule in the components it invents.** §1.3⑪ bans OS emoji as UI icons; §2.6 and both wireframes then specify `🔒 Saved to your email` and `📣 Want a note when the world gets bigger? →`. These are new components, so they will ship as written. Use PixelIcon `lock` / `bell` — the latter is already imported on this page.

---

**(c) Factually wrong, or not buildable as written**

1. **"perks chips: `🌍 ✨ 🎁 🔧 🛒`" (§1.3⑪) is wrong.** `.ps-perks` at `pass.astro:365-368` is plain text — *No password · Any device · Keeps everything you've made*. The emoji list is `.ps-perks.ps-news__what` at `pass.astro:423-428` (the newsletter topic chips). The proposal has merged two different lists, and §4.11's instruction to cut `.ps-perks` ("both uses") therefore deletes the login value prop for a reason that never applied to it.

2. **"`paint()` renders 'bananas built' three times" (§1.1④) is wrong, and the truth is worse.** The hero tile says `bananas built` (`banana-pass-page.js:277`); the Stats row says **`bananas taken home`** (line 299) for the same expression `S.builds || nBananas`. One number, two different names — that is the actual comprehension bug, and the proposal doesn't catch it because it assumed a duplicate label.

3. **Cut-list item 3 deletes the code §2.5 requires.** "Cut … the `psOvCreations` `renderShelf` call **and its mixed-kind `onPick` router**" — but the merged `Made` pane is precisely a mixed-kind shelf and needs exactly that router (banana → builder, wearable → items workshop, emoji → forge). It moves; it does not leave.

4. **Five of the twelve "cuts" cannot reduce the budget the spec is measured against.** `tools/budgets.json` is explicit: *"Per-surface JS budgets in BYTES, measured on the BUILT output (dist/_astro)"*, prefix-matched on chunk filenames. Items 8–12 are CSS in an Astro `<style>` block, which Astro extracts to a stylesheet — zero bytes off the JS chunk. Against that, the spec *adds* JS: a filter-chip handler, two disclosure toggles, a hash alias map, three door-card builders plus per-filter doors, non-zero stat filtering with a joined zero-label line, a `readonly` flag threaded through shared `banana-shelf.js`, an offer gate and a conditional pencil hint. The real JS deletions are the hero block, `psOvBadges`, one `renderShelf` call, one delegated handler and four `setCount` writes — the spec itself concedes items 6 and 7 are "roughly neutral" / "same code size". **"It should [come out smaller], because it is mostly deletion" is not supported.** Re-run the sum against the JS chunk only before making "below 35,714 bytes" a ship gate, or the correct call gets made under a false premise.

5. **`renderShelf` has no `readonly` option** (`src/lib/banana-shelf.js:172`, the `.shelf-x` at :221 is unconditional) and `shelfRemove` is re-called through a recursive `renderShelf(host, {onPick, limit, kinds, emptyMsg})` that would drop any new flag on redraw. §4.20's "smaller than the current unconditional render" is false — it is a new option, a new default, and a recursion fix, in a file shared by other surfaces.

6. **SEO reasoning is moot, and one cut is bigger than the spec thinks.** The page is `noindex` (documented in the `pass.astro` header comment), so §4.15's sr-only H1 costs nothing to search — but it does remove the only visible page title on a site whose every other page opens with an Archivo Black H1. That is a house-grammar break, not just a copy cut.

7. **"News for you … renders only when non-empty" is already true, and that means the first-timer's first screen is emptier than the wireframe suggests.** `renderNotices()` (`banana-pass-page.js:693-706`) hides the section when there are no notices and no pendings, and notices are per-device and event-driven. So wireframe 3.1's first screen is, in full: a card of a banana they didn't make, a button that opens a bigger copy of it, an email demand, and a tab bar over three empty drawers. That is the state to design *first*, not the veteran's.