# The design library

Rules that were paid for. Every one of these is here because it shipped wrong
first, was caught in a screenshot, and cost a round trip. They are written as
rules rather than advice so they can be checked.

`tools/check-design.mjs` enforces the mechanical ones on every push. The rest
are judgement, and the judgement is the point.

---

## 1. Vertical rhythm

**A heading needs more space above it than below it.** A heading's job is to
break content up. `margin: 0 0 0.2rem` gives it nothing above, so it lands
flush against whatever ended before it and stops breaking anything — it just
looks like a bigger line of the previous block.

Every surface declares its scale once, in custom properties, and nothing inside
invents its own number:

```css
.surface { --gap-sec: 3rem; --gap-part: 1.15rem; }
@media (min-width: 780px) { .surface { --gap-sec: 3.75rem; } }
.surface__sec + .surface__sec { margin-top: var(--gap-sec); }
```

- **`--gap-sec`** — between two top-level sections. Big enough that the eye
  knows a new thing started without needing a rule or a box to tell it.
- **`--gap-part`** — between a section's own sub-parts.
- A heading's own `margin-bottom` is small (`0.3rem`), because it belongs to
  the thing *underneath* it. The space that separates it from what came before
  is the section gap, not the heading's margin.

If you find yourself typing a `rem` value for vertical space that is not one of
these two, ask what section you are actually in.

## 2. Boxes

**Do not put a box inside a box inside a box.** Borders are how a web page
groups things; a game page groups with **air, colour and light**.

- To separate a block: a section gap, or a radial glow behind it, or a single
  left rule. Not a fourth border.
- To lift one item out of a list: light it from behind. `.pk-supstar` is a
  centred block over a radial gradient with no border at all.
- A card you *buy from* on a page may keep its edges. A card inside a modal may
  not.

## 3. Numbers are not a design

A statistic scaled up to 2.4rem and left floating is the laziest version of a
stat. Give the figure an **object** to sit on — a tile, a pill, something with
a border and a shadow, ideally knocked a couple of degrees off square so it
reads as a thing pinned to the page rather than a bigger word.

```css
.stat b {
  display: grid; place-items: center; min-width: 54px; height: 54px;
  background: var(--banana); border: 3px solid #000; box-shadow: 4px 4px 0 #000;
  transform: rotate(-3deg);
}
```

### 3b. A value is never quieter than its own label

Found on the Pulse desk 3 Sep 2026, where it had been true for a month:

```css
.hqp-tk { font-size: 0.82rem; }                       /* the label — full ink */
.hqp-tv { color: var(--hdim); font-size: 0.76rem; }   /* the NUMBER — dimmer  */
```

Every table on that dashboard whispered its own numbers. The reader's eye went
to the word and had to hunt for the figure. Whenever a block pairs a figure with
a name for it, three voices, always in this order of loudness:

| voice | job | treatment |
|---|---|---|
| **value** | the number | brightest ink, heaviest weight, `tabular-nums` |
| **label** | what it is | recessive ink, smaller, often uppercase + tracked |
| **prose** | why it matters | quietest, normal case, generous line-height |

`font-variant-numeric: tabular-nums` on every figure that sits in a column — a
digit that does not line up with the one above it is the everyday version of
"hard to read which line is which number".

### 3c. A wide row needs a leader

Past roughly 40rem, a short label on the left and a lone number on the right stop
being one row to the eye. Band alternate rows, highlight on hover, rule every
fifth row, and run a dotted leader between the two — a grid item in the middle
column, so it grows to exactly the gap:

```css
.row { display: grid; grid-template-columns: minmax(0, max-content) 1fr max-content; }
.row::after { content: ''; grid-column: 2; align-self: center; height: 0;
  margin: 0 0.7rem; border-bottom: 1px dotted rgba(244, 238, 255, 0.18); }
```

And never concatenate several values into one cell. `1.8k · 1.7k · 92 · 1.4k ·
5.4%` under a header reading `took · saw · coffee · no-thx · willing` asks the
reader to pair them by counting separators. Give every number its own column.

### 3d. A wait is told where the reader is looking

Trym, 4 Sep 2026, after clicking a magic link on his phone: *"i was still
there as a fresh banana for 5-6-7 seconds until suddenly my stuff loaded up…
6-7 seconds is enough for me to think and act on 'hmm ill try to click the
link in the email again'."*

The page **did** say `Signing you in…` — on a status row ninety lines below
the card, off the fold on a phone. A message the reader cannot see is not a
message, and the cost is not confusion: they take a **destructive action**
(re-spending a single-use link) because nothing looked like it was working.

- put the busy state **on the thing that will change**, not on a status row
- **name the step, and change the words when the step changes** — one word
  held for seven seconds reads as stalled; `Signing you in…` then
  `Loading your pass…` reads as progress
- clear it on **every** exit, including the failures
- a moving bar with `prefers-reduced-motion` gets a still one, not none

Anything that can exceed roughly a second gets this: a login, a pull, a
checkout hand-off, a render.

### 3e. Concrete, not clever

Trym, 4 Sep 2026, on a note that said *"add your email in My Pass to take it
anywhere"*: *"if you dont know what this is, or what anywhere is, it doesnt
make any sense - anywhere, as in i can take it to netflix.com? gmail? … keep
user-notification and communication very clear and concrete."*

Benefit-copy needs a mental model the reader has not built yet. Ninety seconds
in, they do not know what the world is, so a promise about it lands as noise.
The replacement — **"To save your progress, log into My Pass in the menu"** —
is shorter and says the two things they can act on.

Every notice: name the **outcome** in words they already own, then the
**action**, pointing at something that is **on the screen right now**.

| ✗ | ✓ |
|---|---|
| take it anywhere | to save your progress |
| could not settle your homestead | could not load your homestead |
| out of step with the server | the server keeps refusing to save it |
| this browser blocks session storage | this browser blocks storage |
| the server keeps changing its stamp | another device keeps changing it |

The right-hand column is not dumbed down, it is **de-jargoned**: *stamp*,
*session storage* and *yard* are words out of the source. Keep the precise
version on the analytics event, where precision is the point; the sentence a
person reads gets the plain one. And see [[named-things-must-be-findable]] —
never point at a name that is nowhere on screen.

## 4. `[hidden]` loses

**Any author `display:` beats the `hidden` attribute.** A flex row, a grid, an
`inline-block` — all of them render an element that JS has carefully hidden.

Every page with JS-toggled UI needs, once:

```css
[hidden] { display: none !important; }
```

Hit five times now. The last one shipped an empty supporter banner to every
visitor on the page that takes money. `tools/check-design.mjs` fails the build
if a page toggles `hidden` from script and has no guard.

## 5. One layer, not per-surface copies

Anything worn by more than one surface lives in `public/css/` and is linked, not
copied:

- `public/css/plaques.css` — the supporter plaques (`.bb-plaq*`), worn by the
  park's board and by `/supporters/`.
- `public/css/wardrobe.css` — the chip/tray/tooltip layer for the builder and
  the PDPs.

Two copies drift within a week. When a second surface needs it, move it out
first and *then* use it.

## 6. Pixel art scales by whole numbers

Drawn art is displayed at ×2 or ×3 with `image-rendering: pixelated`, never
×2.5 and never at a size the layout happens to produce. A fractional scale
blurs the pixels, and the whole reason the art exists is that it is not blurry.

Three-part art (drawn left cap, tiling middle, drawn right cap) is how a drawn
object stretches to fit variable text. The middle must be bands only, or any
decoration in it must land on the tile's own period, or it seams.

Glows on drawn art use `filter: drop-shadow()`, never `box-shadow` — the glow
has to follow the silhouette, not the rectangle it sits in.

An animation strip is never resized as one image. The resampler's phase walks
along the strip, so a basin drawn at the same x in six source frames came out
at 17, 16, 16, 16, 16, 15 in the built frames, and the town's fountain nudged
sideways in a loop (Trym, 11 Sep 2026, twice — the first fix chased the CSS).
Crop each frame at the source size and resize it on its own: same crop, same
resize, same pixels. Then show the frames as separate images in one box, in
turn, by a visibility animation with a positive delay per frame — a strip
stepped by `background-position` in a box of fractional width adds its own
sub-pixel wobble on top. The park's and the bay's strips were built the first
way; check them the day something there seems to breathe sideways.

Ground meets ground through the pack's autotiles, never through a drawn line.
The town's first paving was rectangles with 12 px bites and a ruler-straight
rim, and it read "technical, not organic". The autotile sheet has 47 edge and
corner pieces per family; index them by probing each tile's border pixels
(stone or grass at the four edge midpoints and four corners), cut the flat
fill away, and lay the pieces over the real ground texture. Pick a family whose
grass is the world's grass palette — a dull family shows as a band along every
edge.

## 7. Commit to a silhouette

Four variants of a thing should be four **objects**, not four colours of one
rectangle. Half-rounding and half-tearing reads as neither. Decide what each
one *is* — a plank, a plate, a torn slat — and let the shape carry it.

## 8. A modal outranks the chatter

Any floating UI has to be placed against the **whole surface's** z-stack, not
its neighbours. Park cards sat at `z-index: 12`, under a toast at 20 and the
questline's hint at 900, so background chatter fired across whatever the player
had opened to read.

Check with `document.elementFromPoint()` on the thing that should be on top —
comparing two `z-index` values tells you nothing when they live in different
stacking contexts.

## 9. Colour is inherited from further away than you think

A page-wide `a { color: … }` will repaint a link you styled somewhere else.
Anything drawn on its own background — a plaque, a token, a tile — must restate
its own ink when it is also a link.

**If you set `background`, set `color` in the same rule.** Not "usually" — every
time. The background is local and the ink travels, so a rule that paints only
half the pair is a bet that whatever is inherited happens to be readable on the
colour you just chose. That bet has now lost twice in one file:

```css
/* the homestead's build tools, 30 Aug — four of six labels were invisible */
.hs-planbar button { background: #fffdf5; }   /* ink inherited: #fffdf5 */
```

Cream on cream is contrast **1.0**. The only tool anyone could read was `done`,
for the single reason that it happened to declare `color`. The sibling rule
`.hs-act` had the same fault and looked fine only because every one of those
buttons is an emoji, and emoji ignore `color`.

Two things this teaches beyond the fix:

- **Emoji hide the bug.** A control labelled with a glyph will look correct
  while its text is unreadable. Check labels, not appearance.
- **A pressed/active state that declares its ink is not proof the base does.**
  Both offenders here had a correct `[aria-pressed="true"]`.

To sweep an area, measure rather than read: walk every visible control, resolve
the painted background by climbing ancestors through transparency, and flag
anything under a 3:1 ratio. Ignore rules whose background is a `gradient` or an
image — the computed `background-color` lies about those, and both false
positives in the 30 Aug sweep were exactly that.

## 10. A filled variant needs its own states

A `:hover` written for the outlined version of a component will not serve the
filled version. `border-color: banana; color: banana` reads well on a dark
outlined chip and paints **yellow text on a yellow background** on the filled
one — the label vanishes under the cursor.

Whenever you add a `--filled` / `--primary` modifier, give it its own `:hover`,
`:focus-visible` and `:active`, and exclude it from the base one:

```css
.chip:not(.chip--go):hover { border-color: var(--banana); color: var(--banana); }
.chip--go:hover { background: var(--banana-light); color: #111; }
```

Check every state of every variant, not just the default of each.

## 11. Copy

- Dates inside English sentences are formatted in English (`en-GB`), not in the
  visitor's locale. "19.9.2026" mid-sentence is a bug.
- Never fix copy by adding words. Restructure and come out shorter.
- Say the warm half of a true thing. "These bananas pay for the world to stay
  free" is accurate and reads like a notice nailed to a fence; "the whole world
  runs on these bananas" is the same fact, delivered.
- The same warning in three cards is not emphasis, it is small print. Say it
  once, under the row.

## 12. Money links live in one constant

Never hardcode a payment URL in a page. `src/data/pay-rail.js` owns every
address money can travel to. Ten links across the site were still pointing at a
platform abandoned months earlier — the footer, six localised pages, the
gif-meme page, and the download cards at the highest-traffic moment on the
site. `tools/check-design.mjs` fails the build on a hardcoded payment host.

## 13. Verify by looking

Mechanical checks are the floor. Walk the surface as a player on the built
site, screenshot every state, and *read the screenshots back*. A DOM assertion
that a class is present says nothing about whether the thing is legible.

⚠️ `astro dev` hot-reload lies on `<style is:inline>` edits. If a style change
does not show up, restart the dev server before you start debugging code that
was already correct.

## 14. The Banana Phone speaks softly

Inside the phone there are NO black borders (Trym, 1 Sep 2026: "this is the
way"). The language: sticker cards (border-radius 16, soft `0 3px 0` shadow),
pastel rounded thumb tiles, pill buttons and pill chips (`border-radius: 999px`;
hearts get pink), lists packed to the TOP with `align-content: start`, and one
fixed action-column width so every button is the same size no matter its label.
The world OUTSIDE the phone keeps its chunky black-border chrome — the contrast
is deliberate. Every new phone screen copies the `.hs-row` family, and every
phone-screen change is verified at the shell's real height (375×812 emulation),
never in a squat pane — a stretched list floats its rows to the middle and a
short viewport cannot show it.

## 15. The HUD is two things, and every control lives in one of them

A walkable area (park, bay, homestead, rave, town) wears the world HUD in two
halves, and a player control lives in one of the two — never as a button
floated into a corner of the map. The town's pocket shipped top-left, then as
a chip in the strip, and was wrong both times (Trym, 11 Sep 2026: "the action
bar at the bottom is part of the HUD").

**The strip** (`src/lib/world-hud.js`, `mountHud`): LVL · COINS · [an area
chip] · CROWD, top-right over the map. It is read, not pressed — level and
coins come from the pass, the crowd chip doubles as the save ask, the area
chip is a status (the bay's rally). Nothing in the strip opens anything.

**The action bar** sits under the view: a full-width band, `border-top: 4px
solid #000`, a centred flex row of 44 px buttons (world-travel's `.wt-row > *`
floor sets that height for every member, present and future). Left to right:

1. the VERB SLOT — yellow, `hidden` until it has something to do: the park's
   tool, the rave's quest button, the town's pocket. It is the only button that
   comes and goes, so it sits leftmost and never shuffles the rest;
2. the emotes — the pixel heart (`PixelIcon`, never an OS emoji); the float
   rides the button's own SVG so there is one art source;
3. the area's own verbs — the homestead's hammer and Banana Phone;
4. the TRAVEL DOOR, `initTravel({ here, mount, btnClass })` — every area, no
   exceptions; it is how five maps stay one world;
5. settings pinned right with `margin-left: auto` (the park's sound) — a
   setting is not an action and never moves.

**Icons, not words.** A bar button is a glyph from the pixel pack, and a
number rides it as a badge; it never spells its own name. "POCKET ×3" in
yellow capitals shipped on 11 Sep 2026 and was wrong (Trym: "the HUD is
mainly icons and visuals, not giant letters that say POCKET, or HEART, or
FAST TRAVEL DOOR — this is game design, not a website"). Words belong in the
cards and trays a button opens. ⚠️ The park's tool slot still says "🌿 pull"
with an OS emoji — the same rule, owed.

Same metrics in every bar, to the pixel: icon buttons `padding: 0.5rem 0.7rem;
font-size: 1.1rem; min-width: 46px`, every button `border: 3px solid #000;
box-shadow: 3px 3px 0 #000`, pressed = `translate(2px, 2px)`. Only the band's
fill changes with the area (park `#101a10`, bay `#17121f`, homestead `#10200c`,
town `#140d08`). ⚠️ The bar's CSS is still one copy per area (`.pk-act`,
`.bh-act`, `.hs-act`, `.rv-emote-btn`, `.tw-act`); §5 says it should be one
file, that move is owed, and until it lands a change to one bar is a change to
five.

A tray or popover a bar button opens rises from the bar's edge, inside the
view, and folds before its toast speaks (§8: nothing lands on what the player
just opened).

`tools/check-design.mjs` fails an area script that mounts the strip without
mounting the door.

## 16. A cabinet game is one card, and the board lives under the screen

The town's Arcade (12 Sep 2026) set the shape every in-world mini-game wears
from now on, so the next one is a copy, not a design:

- **one card, one canvas.** The game draws on a 300×440 canvas inside the
  world's card (`.tw-arc`), pixelated, with the score and the best as a small
  HUD in the canvas's top corners. The player is their own banana, drawn once
  by the engine and handed in as a bitmap; the game never draws a banana.
- **the board is part of the card.** Under the screen: two tabs (all time /
  this week), five rows (rank, name, score), and one line for you (your best,
  your rank). A game without its board is a demo.
- **the run has one end.** Every game reports exactly one `end(score)` with
  the run's duration; a tap on the ended screen is a new run; closing the card
  stops the loop. Nothing runs while the card is closed.
- **the score goes through the pass.** `POST /arcade/score` with the pass
  credential; anonymous runs keep a local best and never reach a board. The
  worker caps score per second of play (an implausible score is refused, never
  "proved"), throttles runs, and grants prizes the admin way. The desk (HQ →
  ledger room) can wipe a board.
- **prizes are gear, never coins.** A threshold per board grants `own_<id>`;
  the catalog entry carries `earned: 'arcade'` + `stat: 'own_<id>'`, and
  `secret: true` while the place that earns it is not public: a locked chip
  is not shown at all, so no door can point at a hidden page.
- **the names are ours.** Mechanics are free; names, art, sounds and layouts
  are not. Banana names, every pixel through our pipeline, one twist each,
  never "a clone of" anything on the site.

The games ship as one on-demand module (`src/scripts/town-games.js`, loaded
the first time a cabinet is tapped) so the area's own script keeps its budget.

## 17. The footer is on every page a visitor can reach

Every page a visitor can land on carries the footer (`src/components/Footer.astro`
through `BaseLayout`), the world's areas included: the park, the bay, the
homestead, the rave, the town, and the translated GIF pages. The footer is where
the safe-space line, the rules, the AI page, privacy and the host live; a page
without it is a page where a visitor cannot find them (Trym, 12 Sep 2026: "make
sure the footer is available on all our 400+ pages, even banana world area
pages"). Only the desk (`/inbox/`) and the dev pages (`/dev-wearables/`,
`/dev/design/`) pass `showFooter={false}`; nothing else may.

An area page's own bottom bar stays in flow above the footer, never fixed over
it; the safe-space line is centred by its own flex rule so no paragraph rule
around it can pull it left.

## 18. Dialogue has ONE template: the NPC card

Every character in Banana World speaks in the same card. It was drawn for the
park's Old Peel, the world's first full RPG NPC, and his own source comment
already said "future NPCs reuse pk-card--npc" — then the beach hand-copied it
for Shelly, Cap and Gil, and the town hand-copied the *shape* and got it wrong
(Trym, 12 Sep 2026: "the dialogue popups for the NPCs should follow the existing
dialogue popups we have … like Old Peel in the park … dialogue has a template,
with or without dialogue options for the users"). So it is a shared layer now,
the way `/css/wardrobe.css` holds the chip and tray grammar:

- **`/css/dialogue.css`** — the looks. `.wd-card` on a wrapper inside the
  area's own card, `.wd-pop` the portrait, `.wd-role` an optional line under the
  name, `.wd-say` what they say, `.wd-q` the question deck, `.wd-box` the
  console answer with its typing cursor and ▼.
- **`src/lib/world-dialogue.js`** — `mountDialogue(host, { name, role, line,
  portrait(ctx, size), topics, onClose })`. One call builds it and returns
  `{ say, ask, back, stop }`.

**The shape, which never changes per area.** A waist-up portrait, tilted −8°,
peeking over the card's top-left corner (180 px, 156 on a phone; the canvas is
drawn at 390 and zoomed `scale(1.5)` + `translate(-0.167, -0.22)` so the crop
fills the frame). The name beside it, inset 116 px so the portrait never covers
it. Their line under that. Then the two variants:

- **Without options** — portrait, name, line. A character with one thing to say.
- **With options** — a column of question buttons; pressing one hides the
  questions and TYPES the answer into the console box at 32 ms a character; a
  tap mid-type skips to the end, a tap when it is done walks a `seq` of beats or
  goes back to the questions. A topic with `close: true` says goodbye and shuts
  the card. `prefers-reduced-motion` gets the text instantly, same flow.

**Per area, only the colours change**, through variables on the card:
`--wd-btn`, `--wd-btn-hi`, `--wd-box`, `--wd-box-line`, `--wd-box-ink`,
`--wd-more`. The park's greens are the defaults; the town sets brick browns.
⚠️ The host card needs `overflow: visible` (the town adds `.tw-card--npc`) or
the portrait leaning past the corner is clipped.

**Rules that come with it.** A character never speaks anywhere else: no floating
text over a head, no ambient chatter (§ the quiet rule in the town's own notes).
You walk up to them first and the card opens on arrival, never on the tap
itself. The area's toast line is the WORLD talking to the player about what the
player just did, never a character's voice.

⚠️ **Owed:** the park's Old Peel and the beach's three still run their
hand-written copies (`.pk-npc*`, `.bh-npcpop`). They look right because the
shared layer was lifted from them verbatim, but they are three copies of one
design, and until they move onto `mountDialogue` a change to the template is a
change in four places.

## 19. The weather is ONE layer, and it hangs on the view

Trym, 13 Sep 2026: *"i want to add the weather from the Park, to Homestead, Banana Bay,
and Town … The weather can follow the same clock for all areas."*

The park had rain first and paid for every number in it. Four areas render it now, so it
is a shared layer like the dialogue card and the wardrobe chips:

- **`public/css/weather.css`** — two tiling rain sheets, a scrim, a lightning flash and
  five blown leaves. Every comment in it is a bug somebody already had: why the sheets
  scroll by `background-position` instead of `transform`, why the numbers must stay
  multiples of 256, why the storm's skew is positive.
- **`src/scripts/world-weather.js`** — `mountWeather(host, opts)` builds those elements,
  checks the clock once a second from the area's own rAF tick, and returns
  `{ tick, now, setKind, indoors, stop }`.

**The clock is already shared and is not a service.** `weatherAt` in `src/lib/world.js` is
a pure function of time, mirrored in the worker. Nothing asks a server what the weather is,
which is why rain starts on the same second for everyone, in every area, with no messages.

### The three rules

**1. It hangs on the area's VIEW, never its WORLD.** Every area translates its world
element by the camera each frame. Rain parented there pans with the map, and that does not
read as a bug — it reads as slightly wrong rain, and it survives review. `mountWeather`
refuses a host that is already transformed and says so in the console.

**2. An interior inside the panning world must call `indoors(true)`.** The town's arcade
room and the homestead's house are appended to the world element, which carries
`will-change: transform` and is therefore its own stacking context — so their z-2000
interiors cannot out-stack a z-8 sheet on the view, and it rains in the kitchen. The park
escapes this only because its shop is a sibling of the view. The sky keeps running while
you are inside; only the sheet is hidden, so stepping out shows the weather as it is now.

**3. What an area DOES about the weather stays in that area.** The shared layer is the
sheets and the tier. The park charges health, fills the pond with puddles you can splash,
stands the butterflies down and gives Old Peel new words; the homestead gathers its
animals. Those live in `park-weather.js` and `banana-homestead.js`, behind `onKind`.
**The morning-after notice is the park's alone** — Trym: *"no need for the Park 'After the
Storm' screen message there."*

### Adding weather to a new area

1. `mountWeather(view)` where `view` is the fixed box, and call `.tick(now)` from the loop.
2. Link `/css/weather.css` in the page's head.
3. Add the script and its page to `WX_PAGE_OF` in `tools/check-design.mjs`.
4. If the area has an interior inside its world, call `.indoors(true)` and `(false)` at
   the door.

## 20. Every walkable area is the SAME frame

Trym, 13 Sep 2026: *"why does frame sizes differ? The rave is something for itself, but
homestead, park, banana bay and town should all have the same frame size — looks like
thats part of the consistency issues you have like with the HUD, the frames for new areas
differ from what we already have set up."*

He was right, and it was measurable. Measured on the built site before the fix:

| area | 1280 wide | 393 wide | wrap | side padding | set |
|---|---|---|---|---|---|
| beach | 966 x 580 | 359 x 580 | 1000px | 0.8rem | 22 Jul |
| park | 966 x 580 | 359 x 580 | 1000px | 0.8rem | 27 Jul |
| homestead | **1060** x 580 | **353** x 580 | 1100px | 1rem | 12 Aug |
| town | **1060** x 580 | **353** x 580 | 1100px | 1rem | 7 Sep |

Height was never the problem. **Width was**, in two knobs at once, and it inverted on a
phone: wider on desktop, *narrower* on mobile, because only the padding binds there.
Nobody chose 1100 twice — the town copied the homestead, which is how the HUD's action
bar went missing too. A number that is only written down in the last area that used it
is a number the next area gets wrong.

### The rule

**`public/css/world-frame.css` owns the size. An area owns its own names and its own
background, never its dimensions.**

```css
--world-w     how wide the frame may grow          (1000px)
--world-pad   the gutter beside it on a phone      (0.8rem)
--world-h     its height                            max(240px, calc(min(74vh, 580px) - var(--world-ccb)))
--world-ccb   the cookie banner's band, in px, written by any area that measures it
```

So a page says `max-width: var(--world-w)` and `height: var(--world-h)`, and changing
every area at once is one number in one file.

**🍪 `--world-ccb` is why the height looks complicated.** The cookie banner pushes a
short phone's world off the bottom, so the frame gives that height back. Only the
homestead measures the banner today (`banana-homestead.js` writes the variable); every
other area reads 0 and is unaffected. When a second area learns to measure it, it gets
the behaviour for free instead of reinventing it.

**⚠️ The rave is deliberately outside this.** It is a room, not a map — Trym keeps it
*"something for itself"*. It never loads the file and is not in the gate's list.

### What the gate checks

`tools/check-design.mjs` fails an area page that sets its own `max-width` on a `-wrap`
rule, sets its own `height` on a `-view` rule, or does not link the stylesheet. Proven
to fail on all three.

## 21. A world area's STATE is drawn onto the props it already has

Trym, 14 Sep 2026 (the Town Life brief): *"the town should feel like a living community
that changes over time … reflected physically (lights, shop windows, closures, damage, NPC
activity, visitors, supernatural activity)."*

The town was the first area whose condition changes what is on the map, and three things
had to be true for that to work without a second art set:

**1. Every prop a state can touch has a NAME.** `place(…, key='cafe')` in
`tools/build-town-scene.py` rides OVERLAYS as a seventh column, `banana-town.js` mirrors it
onto `img.dataset.key` and a `PROPS` map. Before that, "the café's shutter" was
`querySelectorAll('.tw-ov')[7]`, which survives exactly until somebody adds a bush.

**2. A state is a SPRITE OVER the prop, never a repaint of the plate.** Loose files
(`public/assets/town/s-<key>-<i>.png`, sizes in `STATE`), stacked frames in one box the
fountain's way, stepped by the area's own clock. Light and ghosts are exported SOFT —
`blockify` thresholds alpha into a hard silhouette, which deletes a lamp's halo, a lantern's
glow and a fading ghost outright; that is right for props and wrong for light.

**3. Hide a frame stack with `[hidden]`, never `visibility`.** The frame that is on carries
`visibility: visible`, and a child's visible beats a hidden parent — five dark lamps kept
shining until this was found. `[hidden]` is `display`, and every world page already has
`[hidden] { display: none !important }` (§4).

**4. MOTION IS `transform` AND `opacity`. Nothing else.** A keyframe that animates `filter`,
`box-shadow`, `width`, `top` or a colour cannot be handed to the compositor: the browser
re-rasterises every element wearing it, on every frame, for as long as the loop runs. A glow
is a STATIC `filter` with an `opacity` animation over it — same look, one raster.

This has now cost the town twice. The first time it was every `is-todo` mark and paint became
the largest cost at night (15 Sep). The second time the very same file still had `twHum`
animating a filter on the cursed objects, and on a phone-class CPU the night scene dropped 57%
of its frames (19 Sep). Twice is a gate: `check-design.mjs` now reads every `@keyframes` in the
repo and fails any that animates a property the compositor cannot take.

The sky is the area's own: a scrim on the VIEW like the rain (§19), under the rain sheet,
with the beat's opacity; the shared weather layer is not asked to know about nights.

## 22. A ROOM IS ONE SCREEN, and the town hides behind it

An interior in this world is not a card and not a page. It is a **plate**: the square goes dark
under a shade, the room's own picture floats exactly where its building stands, and the banana
walks around on top of both. There is no close button anywhere on a room — **you leave by walking
back onto the doorway you came in by**, the gap in the frame at the bottom middle.

Three rooms are built this way today: the arcade and the general store in Banana Town
(`ROOMS` in `src/scripts/banana-town.js`), and the homestead's wooden houses. All of them are
baked by `tools/room_builder.py`, which is the only place that knows the shape of a room.

**The key is the door is the spot.** `ROOMS.store` ↔ `SPOTS.store` ↔ `ABOUT.store`. Keep that one
string true and entering, leaving and naming a room all fall out of it: you come back out of the
door you went in by without a line of code that knows which door it was.

**One plate, re-dressed.** There is a single `.tw-room` element and it is re-keyed on entry. The
first version set its box and its picture once, inside the branch that created it, so the second
room would have worn the first one's image at the first one's size, for ever, with nothing on
screen to say why.

### ⚠️ The invisible-sprite trap

While a room is up, `#twWorld` wears `.is-inside` and two hide lists blank the town: its props,
its residents, its state sprites, its fix marks, its tape. **Those lists name the very classes a
room's own fittings are drawn with.** A stocked shelf drawn over the store's plate as a
`.tw-state` renders `visibility: hidden` — no error, no warning, nothing on screen at all, and
several hours of looking for a z-index bug that is not there.

So: **every hide list must exempt the room's own things, and the gate fails a list that exempts
nothing.** Two grammars are in the world and both are honest:

- the town ends the whole list in **`:not(.is-in)`**, and anything belonging to a room wears
  `.is-in`. This is the one to copy for a new area: one class, one exemption, read in a second.
- the homestead exempts **per class inside the `:is(...)`** — `.hs-ov:not(.hs-ov--room)` — because
  its plate and its items already had names of their own.

What fails the gate is a list with no exemption at all.

Two more things a room sprite must get right, both measured on the real page:

- **z**: the shade is 2000 and the plate is 2010, while a world sprite is `100 + y`. A sprite on a
  shelf at y 800 lands at 900, under both. Inside a room a sprite takes the same `+2000` the
  banana already takes, so it is `2100 + y` — above the plate, and still depth-sorted against the
  banana, who is `2100 + pos.y`.
- **the early return**: indoors, a tap resolves against the room's own spots and nothing else.
  The store's plate sits directly over the store's shopfront, so a fall-through would find the
  front behind it and re-enter the room you are already standing in.

### What a room is not

A room is not a toll. If a card already answered at the door, it keeps answering at the door, and
the room is something you may do instead (docs/town-jobs-plan.md §4). Pip's shelf opens on one tap
of the shopfront exactly as it always did; **"Step inside" is one more row on that same card.**

## The enforcement ledger — which of these rules can actually fail a build

Trym, 12 Sep 2026: *"how can it be guaranteed without me having to think that i
need to remind you?"* This table is the honest answer. A rule with a gate has never
drifted. A rule with only a paragraph has drifted at least once.

| § | The rule | Defended by |
|---|---|---|
| 2 | `[hidden]` loses to an author `display:` | `check-design.mjs` (the site-wide guard must exist) |
| 12 | Payment URLs live in one constant | `check-design.mjs` (no other file may name a host) |
| 15 | The HUD is a strip AND an action bar | `check-design.mjs` (`mountHud` without `initTravel` fails) |
| 17 | The footer is on every visitor page | `check-design.mjs` (`showFooter={false}` outside the allowlist fails) |
| 18 | One NPC dialogue card | `check-design.mjs` (own dialogue markup without `mountDialogue` fails; the legacy list may only shrink) |
| 19 | One weather layer, hung on the view | `check-design.mjs` (own rain keyframes fail; an area that mounts it without linking `/css/weather.css` fails) |
| 20 | Every walkable area is the same frame | `check-design.mjs` (an area that sets its own frame width or view height, or skips `/css/world-frame.css`, fails) |
| 21 | An area's state is drawn onto named props; light stays soft; frame stacks hide with `[hidden]` | the town walk (`tests/town-life.spec.mjs`: dark lamps counted by `display`, the band's look asserted per band) |
| 21 | Motion is `transform` and `opacity`; a glow is a static filter under an opacity pulse | `check-design.mjs` (any `@keyframes` animating a non-composited property fails) |
| 22 | A room is one screen; every `.is-inside` hide list ends in `:not(.is-in)` | `check-design.mjs` (a hide list without it fails) + the town walk (the arcade and the store, entered, walked and left) |
| — | Every device key is declared | `check-storage.mjs` |
| — | Per-surface JS budgets | `check-budgets.mjs` (needs a build) |
| — | A new event is READ by Pulse | `check-pulse-areas.mjs` + `tools/pulse-stub-walk.mjs` |
| — | Copy came through the GPT rig and obeys the voice | `check-copy.mjs` |
| 16 | A cabinet game is one card with its board | the town walk's 19 checks |
| — | The quiet rule: no floating text over an NPC | the town walk's `silence` check |
| — | No front-facing standing pose | the town walk's `standingPose` check |
| 1, 3–11, 13, 14 | Judgement: grids, colour, motion, copy tone, naming | **nothing mechanical — a screenshot and Trym's eyes** |

`node tools/check-all.mjs` runs the source-only gates in about a second and is the
Stop hook, so a turn cannot end red. When a rule in the bottom row keeps drifting,
the answer is to move it up a row, not to make the paragraph longer.

