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

**The checkout hand-off is ONE card** (24 Sep 2026; Trym: *"it can take from
3-6-7 seconds before anything happens and youre sent to the checkout page"*).
`src/lib/checkout-veil.js` serves every road to Shopify's checkout — the
official shop's Buy, Make a Banana's Order and its add-to-cart, the cart
drawer's Checkout: what is being bought, the steps ticked off as they really
happen, a bar the dancing banana walks along, and "Secure checkout by Shopify"
because the next page is on another address. It stays up until the page
leaves, fails into Try again / Close (and says nothing was charged), and a page
that will not leave gets its own link. A new buy road uses it — `openVeil`
from a module, `window.__bbVeil` from a page that cannot import — never a
button whose words change. `tests/checkout-veil.spec.mjs` walks every state.

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
- `public/css/area-guide.css` — the field guide under every world area's frame
  (§37); four per-area copies of it were retired on 25 Sep 2026.

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

**The strip is ONE line on a phone** (Trym, 28 Sep 2026: *"On mobile, the HUD
doesnt have LVL, Coins, Gardener level and Online players … on one line"*).
Four chips at their desk size are ~370 px; a phone's frame leaves the strip
310 px at 360 and 343 at 393. Under 440 px the chips tighten (padding, gap,
shorter bars) and under 380 the type steps down, so four chips hold one line
at 360 with LVL 99, five-digit coins and the save ask on. A new chip is
measured the same way: `tests/hud-one-line.spec.mjs` walks every area at 360,
375, 390 and 393 and fails on a second row.

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

### A building with an inside is a door

Trym, 23 Sep 2026: *"for the general store - right now when you click on the building, you get a
popup with all the goods you can buy and a 'enter the store' button at the bottom of the popup - so
this needs to move to inside the store instead since you can walk inside that store before anything
happens, the same goes for the arcade really, theres an inside of that building aswell, while the
others doesnt"*.

So a tap on a building that HAS a room walks the banana to its door and in, with nothing popping up
at the door, for customers and staff alike. What the place has for you is inside: Pip's shelf is the
counter's card (the till), the arcade's cabinets are its games, the day's calls are lit in the room for
its staff. A building with no inside (the café's hatch, the lemonade stand, the post office, the kiosk)
answers with its card where it stands. A shut or locked front answers at the door too, because there
is no inside to go to then.

⚠️ This REVERSES the rule that was here ("a room is not a toll: Pip's shelf opens on one tap of the
shopfront, and 'Step inside' is one more row on that same card", docs/town-jobs-plan.md §4). Do not
put a shop card back on a door that has a room behind it.

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
| — | No front-facing standing pose | the town walk's `standingPose` check (⚠️ it compared a `"frame:tool"` string to numbers and could not fail until 25 Sep 2026) |
| 23 | A resident at their post is never a statue: sway, glance, dance, talk | the town walk's `lively` check (`tests/town-life.spec.mjs`) |
| 37 | Every area explains itself under its frame, on the one sheet | `check-design.mjs` (an area page without `id="what"` and `id="do"`, without `/css/area-guide.css`, or styling a guide class of its own fails) + `tests/town-guide.spec.mjs` (the town's windows fill their box at whole pixels) |
| 38 | The front page's party clips (never scrolls), its crew is the builder's strips on whole CSS pixels with nothing to tap, the name's shadow is a black drop-shadow, its ticker's numbers are the stats file's read low and its live lines come only when the world answers | `tests/home-hero.spec.mjs` (a CSS property cannot be grepped for a meaning, so the walk asserts the outcome at 360–1440 px) |
| 39 | A variable font is one URL across its weights; the front page's pictures are WebP at their shown size, nothing below the fold is eager, every picture arrives | `check-design.mjs` (two @font-face URLs with identical files fail) + `tests/home-hero.spec.mjs` (the banana is WebP, the slides lazy WebP, the band's stickers small, every image loads, Space Grotesk fetched once) |
| 40 | The mailbox's envelopes are drawn, never a scaled item sprite; a letter from somebody new is never called a knock; the counter offers a postcard beside a letter; the postcard sheet is whole on its card at every size | `check-copy.mjs` (knock or door in the first-letter words; `card.make` ≤ 13) + `tests/town-post.spec.mjs` (the first-letter flow, the counter's two buttons whole at 360, the sheet with nothing below the fold at 360×640, 375×667, 1366×625 and 1280×720, the words go round) + `tests/homestead-letters.spec.mjs` (no postcard at home) |
| 41 | A fitting that opens a card looks like what it does in its own art, its keeper stands behind it (feet hidden by its front, round its end to leave, a tap on them is them and a tap on the counter is the counter), the whole drawn piece answers a tap, the banana walks to it before the card opens, and a customer sees it lit once until first use — never its own staff, never while shut | `tests/town-store-till.spec.mjs` (the register's counter lit for a new customer and visible above the plate, a real tap on its right third walks there and opens the shop on arrival, the light gone for good after, none for the staff, none when shut) + Pip behind the counter (the front above him, out at noon with the room saying so, his tap and the counter’s kept apart, walking out round the counter’s end for his staff) + tests/town-spinner.spec.mjs (nobody on the floor you work) + `tests/town-arcade-counter.spec.mjs` (Spinner behind the arcade's prize desk, its front over him, his tap and the desk's apart, out round its end for his staff) — a behaviour, so a walk rather than a grep; the odd-errand rule is in check-design.mjs |
| 15 | The HUD strip is one line on a phone | `tests/hud-one-line.spec.mjs` (every area at 360, 375, 390 and 393 with LVL 99, five-digit coins and the save ask on: one row, inside the frame) |
| 40 | Every letter opens on the world's paper, under a veil that covers the screen | `tests/town-post.spec.mjs` (an open letter is `.bw-paper` in the hand, signed, no cream box) + `tests/homestead-letters.spec.mjs` (Moss's note on the same paper; the veil edge to edge on a scrolled phone) |
| 42 | An echo walks only on open ground | `check-design.mjs` via `tools/echo-routes-check.mjs` (every point and every 4 px of every link of `src/data/echo-routes.js` against the area's colliders and the places a stranger never stands; it proves it bites on a walk across the court) + `tests/world-social.spec.mjs` (a leg filmed on every frame, on the route's lines) |
| 45 | The bananacoin is the stand's coin, never the stock emoji | `check-design.mjs` (the emoji in a page's markup fails; in a script it must ride a line writer, and every world toast, float and say draws it through `src/lib/coin.js`; the check proves it bites every run) |
| 46 | A page that orders its blocks with CSS states every block's place, and its standing line and membership card are where they belong | `check-design.mjs` §46 (every child of the pass page's spine is in its `order` list, every block of the wrap spans both desktop columns; a self-test first) + `tests/pass-layout.spec.mjs` (the card first at 393 and 1280, the standing under the promise with its sparkle and its words, the membership card below the piles and in the rail, its three answers) |
| 46.1 | No raw control characters in source | `check-design.mjs` §46.1 (src, tools, tests, docs, workers, public js/css; a self-test first) + `tests/pass-layout.spec.mjs` ("1 day on the pass") |
| 47 | A badge wears a coloured drawing of what it is for, never the nav's mono glyphs | `check-design.mjs` §47 (every PATCHES icon exists in PixelIcon.astro and is not mono; a parse self-check first) |
| 48 | The pass page is one column in reading order with the account under the card, big iconed tabs, read news folded, and nothing outside the card under 12 px | `tests/pass-layout.spec.mjs` (a busy pass at 360 and 1280: the order, the shared column, the room, no sideways scroll, the type floor in every tab and the open drawer, whole 16-px tabs; the newcomer, the logged-out account, the news fold) |
| 49 | The citizens' frames carry a real-text brass plate sized off the frame (nothing under 11.5 px, long names break between their parts), and every winner is drawn in their own things, catalog items included | `check-design.mjs` §49 (every engine art pack is read by the Python mirror; every wearable's art is reachable) + `tests/citizens-frames.spec.mjs` (both surfaces at 393 and 1280: order, names, sizes, nothing cut, the big frame wide, the squid hat on the park's Citizen) |
| 50 | The front page's homesteads are the game's own drawing of lived-in yards, picked fresh each day: four photos, then sticker pills | `tests/home-yards.spec.mjs` (the pick's rules without a browser; the page at 1280, 393 and 360: the manifest's photos in order, 4:3, tags whole, two to a row or one, pills whole on one line and on screen, no OS emoji) |
| 51 | Where a banana stands for Trym and the site, it is OUR banana (`<Nana />`, the favicon's art at 38 px), never the fruit icon or an OS 🍌 | `PixelIcon.astro` (it has no banana: `name="banana"` fails the build and names `<Nana />`) |
| 52 | A hand holds ONE thing, whatever it is: the game's items and community pieces share two gloves, and the newest wins | `tools/check-hands.mjs` (the engine and the print renderer on one table of cases; the builder, the stand and an approval use `makeRoom`) |
| 53 | XP you can feel in every area: the chip holds, then one beat — a whitish-gold glow hugging your banana and what it wears, "+N XP" beside its head, the chip lit with its bar growing — a level rides up off you, a new title is the world’s big moment on its own card; an area grants and never shows its own XP | `tests/world-xp.spec.mjs` (all five areas on a phone: the hold, the glow behind the banana, the chip’s glow and lit bar, the bar growing, the label, the level, the title in the copy file’s words with no riser, level 99, the longest title at 360 px, reduced motion still, a trickle as one label) |
| 54 | Your banana wears what is saved, on the screen you are looking at: a sync from another device or another tab re-dresses it in every area and tells the room; every area draws Forge pieces | `tests/outfit-follows.spec.mjs` (the phone dresses its old save, the sync's answer is held until then and lands through the real pull; all five areas and their rooms, and a second tab — red in all six with the re-dress off) |
| — | A page's FAQ markup is what its page shows | `check-structured-data.mjs` (every FAQPage question and answer must be on the page as written, on every page — nothing exempt) |
| 1, 3–11, 13, 14 | Judgement: grids, colour, motion, copy tone, naming | **nothing mechanical — a screenshot and Trym's eyes** |

`node tools/check-all.mjs` runs the source-only gates in about a second and is the
Stop hook, so a turn cannot end red. When a rule in the bottom row keeps drifting,
the answer is to move it up a row, not to make the paragraph longer.


---

## 23. RESIDENTS ARE FIXTURES; VISITORS ARE TRAFFIC

Trym, 18 and 20 Sep 2026: *"maybe it's best if the townsfolk NPCs don't do too much other than walk
about sometimes greeting each other or doing small stuff but mainly standing by their shops, to keep
some consistency and not make it too messy with tons of bananas always on the move everywhere, it
can get chaotic."*

A town has two populations and they must be **opposite**:

| | the residents | the visitors |
|---|---|---|
| what they are | the town's **fixtures** | its **traffic** |
| how many | nine, always | at most six at a time |
| where | at their own shop, most of the day | in from the roads that leave the map |
| named | yes, with a card you can tap | never — no name, no card, no tap (except an ECHO, which is a real player: §42) |
| what they give | somewhere to find somebody | the feeling that the place is used |

**A resident's day is POST, POST, a break, POST, POST, home** — about three walks, so they are where
you would look for them for two thirds of the day. `tools/check-design.mjs` fails a resident who
walks more than four times a day. The small life that makes them alive needs no schedule: they
potter between the marks of their own station, they turn to face each other when they share one, and
`ODD_SPOTS` still puts one of them somewhere they never stand, once in a while.

**A fixture is not a statue** (25 Sep 2026, Trym: *"lots of town bananas just standing there statically - not a great
first impression"*). `idle()` in `src/scripts/town-life.js` gives a resident at their post a life with no new frame: a
sway you can see (1–2.3 s), a glance round and back, two bars of the original dance now and then — never beside another
dancer, the first within seconds of a visit — and in a pair, the talk: whoever's turn it is gives two little hops, the
shadow staying on the ground. ⚠️ It runs in BOTH ways of standing: at the post, and waiting there with a walk on the
clock, which is where every refresh (the square's condition arriving on a first load) puts the whole town for up to a
minute. The town walk's `lively` check asks for all of it inside half a minute.

⚠️ **The sweeper is exempt, and the exemption is load-bearing.** Moss's beats are written into
`LITTER`'s fourth column — the beat each flyer is swept on — so pinning him stops the flyers being
collected. One banana crossing the square with a broom is character, not chaos.

⭐ **The square is only the CENTRE of the town.** *"that's not really the whole town, it's just a part
of it, the centre of it — so it makes sense that the map really is bigger but in the background."*
That is what makes the visitors honest rather than decoration: they come in from the south road, the
north road and the bus stop, do something ordinary, and leave. See `src/scripts/town-folk.js`.

## §24 A PROBLEM'S TAP BOX IS SHAPED LIKE THE THING (20 Sep 2026)

Trym, 18 Sep: *"i see a broken streetlight in the square board, but i dont see any options to fix it
… no fix icon on any streetlight"*. That was fixed once — in the reseed — by giving a lamp's problem
a repair icon at `lift: 118` (ON the lantern, not floating above it where it reads as belonging to
whatever stands behind) and a tap box `grab: 54, tall: 190` reaching from the icon down to the foot,
so the whole lamp answers a tap.

**It was fixed in one of the two places that plant lamps.** The ghosts' own mischief path
(`town-night.js addProblem`) kept the default box, so a lamp a ghost had just put out could not be
tapped anywhere near its own repair icon — the closed-door rule again, and the second time in this
class. So it is a check now, not a paragraph:

- the numbers live in **one** exported constant, `LAMP_HIT` in `src/scripts/town-room.js`
- `tools/check-design.mjs` §24 fails the build on any hard-coded `grab:`/`tall:` in
  `src/scripts/town-*.js` whose own line does not name `LAMP_HIT` — both the object-literal shape
  (`grab: 54`) and the assignment shape (`p.grab = 54`)

⚠️ two traps in writing that gate, both of which made it pass on air: the block's `slurp()` joins a
**relative** path onto ROOT, so handing it `walk()`'s absolute paths read nothing at all; and a
lookback of 200 characters accepted a literal that sat two lines under the constant's own name, which
is exactly the shape the bug had. The check reads the **same line**, and a red run was proven for
both shapes before it went in.

## §25 TWO TRAYS CANNOT SHARE THE BOTTOM OF THE SCREEN (20 Sep 2026)

The town has two things that rise from the bottom edge: the pocket (`.tw-tray`, z 901) and the
café counter (`.tw-cup`, z 1200). During a shift the pocket opened completely **behind** the
counter, so tapping the bag did nothing a player could see.

- the lower one does not fight its way up: the counter **yields** (`cafe.hold(true)`) while the bag
  is open and comes back when it closes, which is the same courtesy the toast already does
- and the world's own voice needs somewhere to stand. The toast is z 2000 and docks at the bottom,
  so it landed on the gauge; raising it by a fixed 172 px landed it square on the barista's face in
  the serving window instead (measured at 360×740: toast 419–495, the banana 455–510). While a shift
  is on it docks at the **top** of the view, under the HUD strip — and the offset is MEASURED from
  the strip and watched with a `ResizeObserver`, because the strip grows a line when the save pill
  appears. `tests/town-cafe.spec.mjs` asserts the toast overlaps neither the tray, the strip, nor
  `.tw-atwork`.

## §26 BANANA HQ: ONE QUESTION PER FLOOR, ONE CLOCK PER CARD (22 Sep 2026)

Trym, after a month of desks growing one at a time: *"theres alot of tabs and sub-tabs and it
feels very messy … Realtime is mixed with GA4 historic running data … 'qa' is at the top of the
list - i dont understand what that is … make in general the HQ more pedagogic"*. The rebuild
(`src/pages/inbox.astro` + `src/scripts/pulse-shell.js`, the plan at
https://claude.ai/artifact/VV4qniZaLfEQwcAMmVtaGH) is held to four rules:

- **A floor is a question, and it is one scrolling page.** Now · Visitors · Business · Players ·
  World · Mail · Reviews · Dev. No rooms inside floors; the open floor's sections are a jump list
  in the rail (desk) or a strip under the tabs (phone).
- **Every section wears a chip** — `section(host, title, note, { src, when })` in
  `hq-pulse.js` — that says where the number comes from (LIVE · GOOGLE · SERVER · INBOX · SHOPIFY
  · GITHUB) and what time it measures ("last 30 min", "7 days", "2026-09-21 · the rollup", "right
  now"). A floor may mix clocks; **a card never does.** The Now floor is live only; the Google
  floors read the window; the window's map lives on Visitors, never on the live map.
- **No worker code reaches the screen.** Coin sources, places and refusal reasons go through
  `src/data/hq-words.js` (`faucet()`, `area()`, `refusal()`); an unknown key is humanised and
  marked "no name yet". Test coins (`qa`) are dropped in the rollup fold and never drawn.
- **One visible sentence under every title** (`.hqp-deck`), the rest behind "more". The old 22 px
  (i) hid the best sentences on the desk.

**Enforced by** `tools/pulse-stub-walk.mjs` (run after a build): every floor at 1440 and 393 with
every worker stubbed, no page error, the phone never scrolls sideways, a tapped map dot keeps its
label and lets go on the second tap (no labels toggle exists), the Visitors floor lists pages with
visits, the Business floor speaks the new words and none of the old, the World floor prints none of
`qa` `deny` `src` `unruled` `faucet`, and Reported letters is drawn in all three states with a
working clear.

## §27 A BEAT THAT CHANGES WHAT YOU ARE GETS THE BIG MOMENT — AFTER THE CARD HAS CLOSED (22 Sep 2026)

Trym: *"When i ask a boss / store owner if i can work there - the dialogue window should close and
there should be some sort of salute or splash text saying something about the job i get. And the
dialogue popup should close first, then splash."*

- **One look for it: `/css/world-moment.css` + `src/lib/world-moment.js`** — `bigMoment(host, title,
  sub)`: yellow Anton over the world with a ring of hard black shadows, a small caps line under it, in
  over 0.3 s, held 3.8 s, up and out; `pointer-events: none`, so the world goes on under it. Lifted
  verbatim from the rave's `.rv-bigmoment` (a new title over the dance floor since August). Its height
  is the world's: `--wm-top` on the host (the rave's floor wants 26%; the town sets 36% so it rises
  below the work note that appears in the same beat).
  ⚠️ **Owed:** the rave's `.rv-bigmoment` and the park's one-size-down copy still run their own CSS; they
  move onto this layer the next time either is touched.
- **Its second beat: PROMOTED (23 Sep 2026, the job ladder).** A boss tells you your new rank in their own card,
  the card closes itself, then PROMOTED and "Now {title} at {where}" (`town-staff.json promoMoment/promoLine`).
  The same order, the same layer; the work note turns GREEN while the news waits (yellow is the quest, amber the pager).
- **The order is the rule, and the dialogue template holds it.** A topic in `mountDialogue` may carry
  `after`, read once its answer is chosen: a function handed back means the answer types as usual, the
  card holds it 1.2 s, closes itself, and THEN the function runs — the world's moment happens on a clear
  screen. A tap once the line is typed closes it at once; closing the card from outside still runs it
  (the moment belongs to what happened, not to how the card was shut). A character still only ever
  speaks in their card (§18): the boss says yes there, and the splash is the world's voice.
- **Proven by** `tests/town-hired.spec.mjs`: the card closes before the moment appears (timed in the
  page), the words are the rig's, the moment sits inside the view at 360 and 393, a burst went up, the
  where-to-start line follows, a ✕ during the yes still gets the moment, and a "no" never sets it off.
- **Big happenings in the world get it too** (Trym, 27 Sep 2026: *"Big texts (like the promotion splash text banners) is
  nice, i like to use those for big events or information of big happenings in the game"*). The first: a VERY CURSED
  NIGHT opens with it and its dawn closes with it (`town-life.json big.*`, town-night.js enterCurse/leaveCurse) — half of
  the town's own haunted nights and the evening Curse Nights; a plain or haunted night keeps its toast. Reach for it for
  an event, never for a routine beat: a banner every twelve minutes is wallpaper.
- **One at a time.** A new moment replaces one still up (`bigMoment` removes it): a night that ended inside its own opening
  moment's hold put DAWN on top of VERY CURSED NIGHT as one jumble. `tests/town-life.spec.mjs` walks the night and its dawn.

## §28 THE CORNER BADGES ARE ONE CIRCLE (23 Sep 2026)

Trym: *"The icon for quests in players top left corner is a different circle shape than the jobs icon - make it
consistent - both should be a round circle with the icon centered horizontally and vertically inside it. Make sure its
consistent for all areas."* The quest badge (`.bwq-hint__badge`, world-quest.js, every area), the town's work badge
(`.twd-chip__badge`, town-duties.js) and the work pager's badge in the other areas (`.wkp__b`, work-pager.js) had each
taken their shape from padding around a differently sized icon, so one was a tall oval and the others wide ones. All
three are now the same **32 px circle** (`width/height 32px; padding 0; border-radius 50%`), the icon centred by flex.
**Checked:** `tools/check-design.mjs` §28 reads the three rules and fails if any loses one of those declarations.

## §29 A COUNTER SHIFT FRAMES THE COUNTER, AND THE TOAST USES ITS WIDTH (23 Sep 2026)

On a phone the lemonade stand vanished during a shift. It stands near the top of the world, the camera put the player at
58% of the view, and that left the stand high in the view — under the work note and under every toast, which docks at
the top while a tray is up (§25). Measured at 393×852: the stand at y 298–368, the note over 236–319, the toast over
327–403. The café never showed it only because its hatch is low in the world, where the camera cannot go further.

- **The camera frames the FIGURE AT WORK.** While a counter holds the banana (the café, the stand, the post round, a
  repair), `banana-town.js shiftFrameY` places the figure — the banana in the window or behind the table (`.tw-atwork`),
  or your own at a counter — in the band between the top notes plus a toast's place under them (three lines, measured
  from the toast's own style) and the tray. MEASURED every quarter second, never a number per counter: the notes fold
  and unfold, the strip grows a line, a tray is its own height. Indoors the framing may pass the world's edge, because
  outside a room is dark already (§22).
- **…and the QUEUE in front of it** (29 Sep 2026). A counter's customers stand at its rope, and at 360×640 the band under
  the work note is shorter than the barista, so the figure went to the band's top and the café's customers stood 3–6 px
  behind the tray. The shift puts its counter's lowest rope foot on the figure (`data-rope`, town-cafe.js), and the
  framing keeps that line above the band's bottom — lifting the figure into the toast's room if it must, never into the
  notes. `tests/town-cafe.spec.mjs` measures the rope's feet against the tray at 360×640, 375×667, 393×852 and 360×740.
- **A toast uses its width.** Placed from the middle of the view (`left: 50%` + `translateX(-50%)`), an absolutely
  positioned box shrinks to fit HALF the view — a line of the town's took five rows. `width: max-content` under the same
  `max-width` gives it the whole 92%, and the same line takes two. A short toast is also a smaller slot to keep clear.
- **Proof:** `tests/town-counter-frame.spec.mjs` walks all four counters at 360 and 393 on the built site and asserts
  the figure (and the stand's own sprite) intersects neither `.twd-chip`, `.bwq-hint` nor a showing `#twToast`, and
  sits above the tray. Failed 5 of 8 before the fix.

## §30 INFORMATION HAS A MOMENT: say it when it applies, once, and then let the world show it (24 Sep 2026)

Trym, 23 Sep: *"always game design first, and getting the correct timing of what information the players gets of whats
happening, when it should happen, and when the player doesnt need to see information to avoid clutter — thats the art
of it."* The rules the jobs' unlocks settled on, for every new mechanic in the world:

- **Before it exists, one line where you plan.** What the next rank brings is a line on the staff card, under the next
  rank's pay (`town-staff.json unlock`). It is the reason to climb, read when you are looking at your progress — never a
  toast out of nowhere.
- **When it arrives, one line.** A promotion says what the new rank lets you do once PROMOTED has gone up (§27), and the
  first time a new thing happens in a shift it says itself once: the big glass, the special order, the jug. The second
  time it is silent — the ticket's pictures and the button's own words carry it.
- **A signpost beats commentary.** The parcel's line says who it is for and where, once, at pickup; after that a marker
  bounces over the door and nothing speaks until it arrives. A lamp's own dark look is its signpost. No running
  instructions, no timers on screen that do not change a decision.
- **The tray note is for an EMPTY tray.** A tray with an order on it has no room for a line (it is capped at 150 px, and a
  second line is cut off below the view — measured twice: the post office's hint and the jug's offer). A one-time line
  that belongs to an order is the town's toast, said once.
- **Never a rate or a timetable** (docs/voice.md): "some customers", not "one in two"; "once a day" is the game's
  business, not the line's.
- **Pictures before words on a ticket.** A bigger glass is bigger pictures; a special order is one more picture (the
  syrup); a basket is two pictures. The words say only what a picture cannot: the gesture on the button, the one-time line.
- **A thing earned in one place and used in another is told at BOTH ends** (24 Sep 2026 — Be, a player: "Where do I find
  my harvested seeds from the park and how do I plant them?"; Trym: "nothing says that you can plant seeds on that
  dirt"). Where it is earned, the line names where it goes ("a seed to plant at your homestead") and nothing talks over
  it. Where it is used, arriving says what you hold and the one thing to tap while that thing glows; each later step
  (the soil tool, the first patch, done) says the next step when it can be taken; the place to use it is lit; a far tap on
  it walks there AND does it. ☝ ALL OF IT ONCE (Trym: "Only once i hope? It takes a lot of attention to address just one of
  the many mechanisms"): each line the first time it applies on the device, the hammer's detour into the soil tool only
  from the glowing hammer, the glow until the first seed is planted — then it is one quiet mechanism among the others. No new button for it: an action bar
  that is full stays full (Trym) — the steps point at the buttons that already exist. `tests/homestead-seeds.spec.mjs`.

### §30.1 The counter's cups, the day's last tip, and the stakes (24 Sep 2026, the copy review)

The same rule, applied to what the counters said on every cup (the review read every line against what the screen does):

- **A line for a cup only when it tells you something.** The +n over the hatch already says a good cup tipped, so the
  first good cup and the first spot-on cup of a shift speak — what the grade was, and that the middle of the GREEN BAND
  tips more — and then the float carries it. A WRONG cup speaks every time: nothing floats, and the line is the only thing
  that says why ("A step missed the green band. They take it, but leave no tip."). `town-cafe.js onCup`, walked in
  `town-cafe.spec` "the counter speaks at the moment…".
- **Name only what is on screen.** "The green band", "the ticket", "the pigeonhole with the same picture" — never the
  code's names ("the rope", "the lane", "Hall Street"), never a drink's name the ticket never shows.
- **The day's limit is said at the cup that meets it**, once (`tipsAll`), and the work note says it after
  (`town-duties.json tipsAll`). Without it the cups after the limit floated nothing and read as wrong cups.
- **A receipt says the result and nothing else.** The take (or why there is none), the work XP and its bar. The receipt IS
  the end of the shift, so no toast says "shift over" as it opens. Every card closes with "Close".
- **A consequence is said before it happens, not after.** The Thursday nudge says the stake — two empty weeks in a row
  and the job is gone — because the sack must never arrive unannounced. "Under half last week's work done" says what
  a poor week IS. A rule the player is judged by is not a mystery (voice.md's mystery rule is for timetables and odds).
- **The first line after HIRED names the button that starts the work** ("Tap the Coffee Cup, then Go to work"), and a
  button says what it does ("Stop serving", then a toast: no more customers until you step out and back in).

### §30.2 A roll answers when it stops, and a win lands where it goes (25 Sep 2026, the Wheel of Peel)

Trym: *"i click the button - it takes 3-4 seconds before anything happens … then if i've won i see my banana coins
increase before the wheel has given me the result … i get half of the answers on my spin by just watching my banana
coins in my HUD … if im winning something there should be a bit more 'wow'"*.

- **A tap moves something at once.** A server that rolls takes its second or two while the thing turns; the answer
  plans the slow-down from wherever it is (`src/scripts/town-market.js`, the spin: wind-up, full speed, a quartic stop
  onto the wedge the server named). A dark button over a still wheel reads as broken.
- **Nothing an answer carries shows before the moment that tells it.** The HUD reads the wallet every second, so the
  wallet (`walletKeep`), the pocket and the pot wait for the wheel to STOP — and a coin win pays its wallet as the first
  coin lands in the purse. A spin that fails stops on a line between two wedges, never inside one.
- **A win is sized to the win.** The common "nothing" (a peel: more than half of all spins) is only its line; a
  spin-again bounces its button; an item or a few coins lights the wedge, throws confetti and flies the prize to where
  it lands (the pocket on the bar, the HUD's purse — which rises out of the card's shade to catch it); more coins, more
  of all of it; the pot, then the square's big moment (§27). `tests/town-market.spec.mjs` holds all four.

## §31 THE FIRST FRAME IS THE REAL ONE, AND A SCENE OWNS THE SCREEN (24 Sep 2026, the newcomer walk)

- **A newcomer sees the town as it loads, so a walk must too.** Every town walk pinned the hour first, and that second
  placement hid a first-load bug for weeks: seven of nine residents stood at their front doors and chapter one's "!" hung
  over an empty fountain for up to a minute. `tests/town-first-frame.spec.mjs` loads the town AS IT COMES (no `life.set`).
  A new world or area needs the same kind of walk.
- **A scene owns the screen.** While chapter one's splash or sheet is up, no place opens a card and nobody walks
  (banana-town `sceneOn`): a tap during the four-second splash used to open the town's card UNDER Nib's sheet. One card at
  a time, and the story's card first.
- **The first instruction names the action.** The quest chip's first line says what to do and where ("talk to nib at the
  fountain in banana town"), not only a place.

## §32 A JOB IS TOLD IN ITS ORDER (24 Sep 2026, the job QA — a real saved pass walked through all five workplaces)

Trym: *"are we giving the proper messages to users before, while, and after users gets a job? … i need you to atleast have
high confidence that this will feel good for players"*. The live journey (tests/job-journey.spec.mjs, a QA pass on the live
pass worker, every line recorded with its time) found what no stubbed walk could, and these are the rules it left:

- **A job's first minute delivers the loop.** The hire day of an on-call job has all its calls in at once (work-calls.js
  `hired`): the new hire was told "Inside Pip's store: fill shelves…" and walked into a store with nothing to do, because
  calls came one to eight minutes later. What a start line promises must be there when the player gets there.
- **Counted is not announced.** Turning up counts on the server and moves the note's counters; nothing is said. The old
  "You turned up for work today" landed on top of the hire's start line, a shift's opening line, a round's.
- **One line, then the next.** A one-time line (the big glass, the special order, the rush, the jug) waits for the line on
  screen to be read (`sayNext`, 2.4 s) instead of wiping it — a wrong cup's "no tip" was being wiped by the next order's news.
- **An opening line is for the first time.** A counter's "Behind the counter…" and the post office's "A tray of post…" are
  said at a player's first shift there (lib/once.js); after that the tray says the rest. A receipt is the end: nothing is
  said over it (the round's "The tray is put away" is gone).
- **Money always arrives.** A worker with no homestead is paid in the town ("Payday: {coins} coins…") — before, they were
  told to open a payslip they had no mailbox for, and the week fell away unpaid. With a homestead, the payslip ritual stays.
- **Today's thing comes first.** On the work note an open call outranks the payslip (the payslip waits; the call closes).
- **A consequence is said before it bites.** One empty week on the record: the stake ("two empty weeks in a row and the job
  is gone") is on the note from Monday, and the staff card says last week was empty. The sack's letter says what it was for —
  no work done — never "you stopped coming".
- **A place greets strangers, not its own staff** — and to strangers it says it hires.
- **"Go to work" walks the streets, and a counter is only worked at the counter.** The player's banana walks straight lines
  and a walk that meets a wall stops — and a stop counts as arrival. From the corner by the Exchange, "Go to work" on the
  note's staff card clocked a worker in 300 px short of the café's window, and the counter ended the shift 8 s later for
  being off its mark, with an empty receipt. A walk to work now follows town-life's street graph (`walkThen` → `life.route`,
  the residents' own), and a counter reached short of its mark says "Walk right up to…, then try again" instead of starting
  (town-cafe.js `clockIn(host, walked)`, the post office's rule). Any deed that needs you AT a place must check you are there
  when it fires, never trust "arrived" — `tests/town-go-to-work.spec.mjs` holds a shift past the 8 s.
- **A shut workplace says so at the hire.** A hire on the day its front is taped shut hears the front's own line (what is
  wrong, and that fixing it opens the door), not a start line that sends you inside.
- **A new job unfolds the note.** A fold belongs to the job it was folded on; a hire is when the note has the most to say.
- **Nobody says a shop is open unless it always is.** Pip's first greeting said "General store open" beside a taped-shut
  store. A resident's line about a front that can close must be true on the day it shuts.

## §33 A JOB'S PEOPLE AND THINGS MOVE LIKE THE WORLD'S (24 Sep 2026, Trym testing the store)

Trym, on the store's customers: *"the idea and mechanisms are OK"* — and the visuals were not. The rules it left, for any
job, counter or chore that puts a body or a thing on the floor:

- **A banana walks on its feet.** Anybody who comes or goes steps on the town's own two-frame walk (town-folk's pairs:
  right 0/1, left 4/5, front 2 — the engine's `face` labels are inverted), never one still picture sliding. A customer who
  has waited long shifts their weight (2/3). They walk back OUT too; nobody blinks away where they stood.
- **The thing itself, no card.** Wares on a shelf are their own sprite with a thin shadow — never a white square round them.
- **Point at the world, not at a picture of it.** What is wanted GLOWS where it is (a static glow whose opacity breathes,
  §21.4), instead of an icon on the tray: one less thing to read, and the eye is already on the shelf.
- **The goal is a person, said as a person.** "Give it to the customer", never a trade word ("till"). The customer is
  tappable themselves, and a lit square stands under them while you carry — so "the counter or the customer?" never comes
  up. The first time ever, a pointer walks the player through it with two plain lines (lib/once.js); after that, none.
- **A carried thing rides a hand.** The engine's glove anchors (`wearAnchor(frame, 'hand', side)`, the dance clock's frame)
  put it in the right hand — a second thing in the left — and it pumps with the dance like every held wearable. Never the belly.
- `tests/town-serve.spec.mjs` checks each: the walking frames, no card, the glow, the hand, the square, the lesson.

## §34 A ROOM SHOWS WHO IS IN IT, BELOW THE NOTES (24 Sep 2026, the arcade walk)

Trym: *"Spinner should hang around the arcade, walk in and out, look busy there - not stand by the wheel of peel … in the
few moments Spinner stands in front of the arcade - Moss comes around and stand on top of Spinner"*, and then *"seeing
other players in the store and arcade"*. The rules it left, for any room a player walks into:

- **A keeper keeps their place.** A resident whose home is a room spends their daytime home beats IN it (town-life.js
  `INSIDE`): drawn on its floor while you are inside, pottering between marks that never stand in front of a tappable
  fitting, the litter or the way in, and in and out through its doorway. A tap on them in there is the same card as outside.
  One place, one keeper: the Wheel of Peel has its own (Twirl), so the arcade's boss is never found at the wheel.
- **Nobody loiters on a doorstep.** The wait before a walk is spent indoors: a resident steps out of the door when it is time
  to go, never the moment the beat turns. Two residents never stand stacked on one step (Moss stood on Spinner).
- **Other players are where you are.** On the square you see the square's; inside a room, that room's, on the players' own
  layer (2100 + y). Through a door they appear — no glide across a wall (town-crowd.js).
- **The room sits below the notes.** Indoors the camera frames the room in the band between the lowest note along the top
  (the HUD strip, the quest note, the work note) and the view's bottom: centred when it fits, following the banana when it
  does not. A fitting under a note cannot be tapped, so it must not be under one (a tap on the dark cabinet opened the staff card).
- **A thing to do indoors looks like one outdoors.** Litter on a room's floor wears the square's halo (`is-todo`) and its mark;
  a dead cabinet dims its LIGHTS (marquee, screen, buttons), never a black box over the machine.
- Walked by `tests/town-spinner.spec.mjs` (the keeper, the doorstep), `tests/town-crowd.spec.mjs` (two phones meet in the
  arcade, on the real room) and `tests/town-arcade-chores.spec.mjs`.

## §35 A GAME ENDS ON WHAT YOU CAN SEE, AND SAYS WHICH END IT WAS (25 Sep 2026, Trym playing Banana Invaders)

Trym: *"i got "swarmed" in this scenario - not close to a bullet, and the swarm was still high up … should be able to use S
key to shoot so you dont have to tap mousepad to shoot. hopefully none of the other games has these kind of issues"*. A fly's
drop had ended the run from 30 px over the banana, drawn UNDER it, and the end had one word for both ways to lose. The rules
it left, for every arcade game (src/scripts/town-games.js) and any game after them:

- **What hits is what is drawn.** A run ends only where something drawn meets the banana's drawn body: a box or circle
  measured off the sprite's own pixels, a little inside them, never a wider zone round it. An obstacle is hit by ONE
  geometry that both draws it and collides (Peel Out's `vine()`), so the two cannot drift apart.
- **The thing that ended it is on top and marked.** Drawn over the banana, never under, and ringed when it lands.
- **The end says which end it was.** One word per cause ("HIT!" for a drop, "SWARMED" for the flies at the bottom, "HIT THE
  EDGE" and "BITTEN" in Snake), from `src/data/copy/town-games.json`, and the copy gate refuses two causes sharing a word.
- **Every game plays from the keyboard, and a computer is told its keys.** Held keys move at the game's own speed, read each
  frame (`heldKeys`), never at the keyboard's repeat rate; one press is one action (a held Space does not drop the whole
  Stack). The screen names the keys where there is a mouse or a touchpad (`(hover: hover) and (pointer: fine)`), and the tap
  everywhere else.
- **The press for another go is only that.** It restarts and plays nothing in the new run (`stopImmediatePropagation`: the
  same tap used to drop Stack's first crate at the edge). The first real press is a real move, timed like every other.
- Walked by `tests/town-arcade-fair.spec.mjs`: each game on the built site, Trym's drop included.

## §36 A LANGUAGE PAGE IS THE HUB IN ITS OWN LANGUAGE (25 Sep 2026, the international upgrade)

Trym: *"upgrade all international pages … extend the FAQs … bring in sticker-packs … update the Banana World link - add
thumbnails of the areas … add more big languages that probably searches for the banana"*. The rules it left:

- **One registry, one template, one rulebook.** `src/data/locale-codes.js` lists the languages; everything that lists
  them (hreflang, the switch, the sitemap, the pages) reads it; `src/pages/[locale].astro` is every page; every word is
  in `src/data/copy/locale-<code>.json` under `localeJob` in `tools/copy-jobs.mjs`. A hand-kept list of languages anywhere
  else is the bug this replaced (three of them had drifted apart).
- **Their own search words, not a translation of ours.** The title, the h1 and the FAQ questions use what people in that
  language type (the numbers are in the memory `intl-pages`); a page that already ranks keeps its title and h1.
- **The page runs in the order its visitors move:** the GIF beside the ask (the hub's hero, `/css/gifpage.css`), every
  format, the builder, the packs, the world, the story, the questions. The world is shown by its own door pictures
  (`/css/doors.css`, the builder's doors) under the names on the world's signs, and entered at Banana Town.
- **Nothing English where a visitor reads.** The pack components and the download card take the page's words (`t`,
  `card.*`); a product's own name ("Pack 3", "Park Life") stays as printed. The site chrome (nav, footer) stays English.
- **A language's own moment is a section on its page, not a new page** (nl: Hyves came back on 22 Sep 2026): the page
  that already ranks catches the spike; a second page would split the same searches.
- Walked by `tests/intl-pages.spec.mjs`: every page, its mesh, its FAQ against its schema, its doors and packs, no raw
  mark on screen, and the card in Dutch.

## §37 AN AREA EXPLAINS ITSELF UNDER ITS FRAME (25 Sep 2026, the town's field guide)

Trym, opening Banana World: *"all other areas have a concrete explanation of what you can do in the area underneath its
game-frame - the Banana Town page doesnt have this yet … make sure the Banana Town also has a nice, visually excellent,
concrete explanation of what you can do in Banana Town and what place it is - and dont give it all away, some can be
more vague so we dont give it all away."*

- **Every area page carries a field guide under the frame:** what is this place (`id="what"`), what you do there
  (`id="do"`), and then whatever that area needs (the rave's clock, the park's meter, the town's rumours), the
  questions, the doors out. `check-design.mjs` fails an area page without the first two.
- **One sheet: `/css/area-guide.css`**, worn by all five areas since 25 Sep 2026. An area is a THEME — a set of the
  `--ag-*` tokens as `.ag--<area>` at the end of the sheet (colours, and for the rave its wider column and bigger
  sprite boxes) — and nothing else. Until that day the rave, the park, the bay and the homestead each carried their own
  copy (`.rvg`, `.pkg`, `.bhg`, `.hsg`) and they had drifted in every number: three block spacings, three heading
  sizes, two kicker fonts, text running 750 px wide. Moving them made those one, on purpose. `check-design.mjs` fails an
  area page that does not link the sheet, or that styles a guide class of its own.
- **Two kinds of card.** A WINDOW card (the town): the picture flush on top, shot from the built area. A SPRITE card
  (`.ag__card--sprite`, the other four): padded, one sprite centred in a fixed box (`.ag__thumb`), an `<img>` never
  bigger than the box, an `<i>` being one frame of a strip that its own style sizes and scales whole. Lists
  (`.ag__list`), a table of facts (`.ag__table`) and a line of small print (`.ag__sub`) are the sheet's too.
- **The pictures are the built area's own.** A card's picture is a WINDOW: the area shot at 1× with its residents at
  their posts (`tools/build-town-guide-art.mjs` for the town — the player, the HUD and the passing visitors hidden),
  shown with `object-fit: none` so a narrow box crops it and never scales it (§6). A window is shot wider than the
  widest box it lands in (a phone's card, one to a row), or the box shows its edges. The one exception is the MAP of
  the whole area, which is a smooth miniature like Dot's maps at her counter, sized to the page.
- **The places are said plainly; the mysteries are only named.** A card says what you do and what it gets you (docs/voice.md,
  a place answers plainly). A rumour says a fact a newcomer can go and look at — the statue with no plaque, the light
  in the hall's window, the road north — and never the answer or the timetable. The copy job's `GIVEAWAY` rule fails a
  rumour, an alt or an answer that says what the mystery is.
- **The words are a copy file** (`src/data/copy/town-guide.json`, the `town-guide` job; the other four areas'
  questions are `<area>-guide.json`, and the rest of their guides' words can move in beside them).
- **The questions are ONE list.** `src/components/AreaFaq.astro` draws them and `faqLd()` (`src/lib/faq.js`) makes the
  page's FAQPage from the same array; an answer links a page of the site as `[words](/path/)`. Two hand-kept copies had
  drifted on every area that had both: the rave's markup asked six questions its page never showed, the park's answers
  were other answers, and the bay's questions were not on screen at all. `tools/check-structured-data.mjs` now fails
  any page whose FAQPage is not on the page as written. The emoji, GIF, Peanut Butter Jelly Time and size-chart pages
  followed the same day: their own FAQ look, drawn through `src/components/CopyLine.astro` (a line's links, **bold** and
  *italic*), their words in `<page>-page.json`; the size chart takes two answers straight from the deep guides
  (`src/data/guides.js`), so it can never disagree with one. A question stands on its own ("Can I use the Dancing Banana?",
  never "Can I use it?") — the copy gate fails one that ends on "it".
- **The line under the sign is the whole town's.** Trym: *"Nib shouldnt be part of the top description … Banana Town
  isnt all about Nib."* The `town-page` tag fails on any resident's name.

---

## §38 THE FRONT PAGE IS A PARTY, AND ITS NUMBERS ARE TRUE (26 Sep 2026, the homepage hero)

Trym, on the old hero: *"mostly white background … the dancing banana in a big white space … a bit stiff and boring"*;
then *"hello there, and welcome to BANANA WORLD … small text on top and banana world in a slight arc and big text"*, the
hero buttons *"not a big fan of the emojis / icons … maybe its better with no icons"*, and a ticker of *"the best ones
based on popularity"*. Built in `src/pages/index.astro`, words in `src/data/copy/home-hero.json`.

- **The party is transform and opacity only, and it rests.** Rays turn behind a spotlit banana, confetti falls, the
  name bobs a letter at a time, a crew in builder outfits dances either side on the GIF's 0.8 s beat. All of it pauses
  while the hero is off screen (`.hw--rest`) and stands still under reduced motion.
- **The crew is the builder's own render, resized ONCE.** `tools/build-hero-dancers.py` draws every frame through
  `tools/banana_render.py` (drawComposite's mirror, the one the print-parity rig holds to the builder) at the builder's
  native 469×498, crops all 64 frames on one box snapped to the banana's 13 px grid, and resizes each frame once with an
  area filter to exactly 6 px an art pixel; the page shows 2 or 3 CSS px an art pixel, one file pixel per device pixel
  on a 3× phone and a 2× laptop. The first build sampled every frame back onto the banana's art grid, and every hat —
  which the builder places by its anchor, not on that grid — lost cells (Trym: *"many pixel errors and looks a bit
  broken in the details … Better to take the pure exports and resizing them"*). **Never resample the builder's art onto
  a grid it was not drawn on.** One lossless WebP strip per outfit, 4–5 KB each, so a phone loads two; the strip steps
  by `transform` inside a clipped box of whole CSS width, never by `background-position` (§6).
- **The name's shadow is black, and a drop-shadow on each letter** (Trym: *"black is better"*). WebKit drops a
  `text-shadow` on text that sets `paint-order` (the outline outside the fill), so the pink first version showed no
  shadow at all in Safari; `filter: drop-shadow` draws the same in both engines, outline included, and each letter
  still moves as one layer.
- **A decorative layer bigger than the page CLIPS, it never HIDES.** The rays are wider than any screen, and
  `overflow: hidden` made the hero a scroll container: scrolling a dancer into view (and so a keyboard focus, or
  find-in-page) slid the whole hero 47 px sideways. `overflow: clip` scrolls nothing. The same rule as `html`/`body`
  in `styles.css` ("CLIP, NOT HIDDEN"), one level down.
- **Doors have no icons; the arrow is drawn and moves.** Every "Enter Banana World" on the page is the copy file's
  words plus a drawn arrow that nudges — no globe, no palette.
- **No toy on the crew.** A coin for every tap on a dancer, a pill under the banana counting them and a "tap a dancer"
  sticker were built and taken out the same night (Trym: *"it becomes noise with that extra coin-element underneath"*).
  A tap on the big banana throws confetti, and that is all the hero does when touched.
- **The ticker's numbers count what the line says, read low.** All-time floors from GA4
  (`tools/build-home-stats.py` → `src/data/home-stats.json`, two significant figures rounded DOWN, printed with a "+";
  every deploy refreshes them, so the page is at most a day old, and a count never goes lower than the committed one):
  a line about PEOPLE reads the event's users (`rave_join` fires on every reconnect, so "danced at the rave" is
  `rave_join_users`), a line about things reads only what the event counts (a fishing catch is "a catch", not "a
  fish"). Live lines — who is in the world now, the town's day, the Wheel of Peel's pot — come only when they say
  something (two or more) and a counter that does not answer is left out, never guessed.
- **An inline number keeps its spaces.** A flex row trims the whitespace at the edges of its text runs, so
  "today: 80 things" printed "today:80things"; the ticker's items are `inline-block`.

---

## §39 A PAGE LOADS WHAT IT SHOWS, THE SIZE IT SHOWS IT (26 Sep 2026, the front-page speed audit)

Trym: *"are there things we can do to optimize performance on the frontpage … can you do an audit?"* Measured cold on a
throttled phone (Lighthouse's mobile profile: 150 ms, 1.6 Mbps, 4× CPU), the banana painted at about 1.7 s, but the
page then pulled 1.6 MB (2.0 MB for a US visitor) and US visitors' trackers kept the phone busy another 0.5–1.5 s.

- **A picture ships in the format and at the size it is shown.** The world strip's slides and feature cards were
  1.09 MB of JPG; as WebP at their shown sizes (a card in two widths, `srcset`) they are about a third. The exporters
  write the WebP beside the JPG themselves (`tools/webp_siblings.py`, called by `tools/reel/export_hero.py`,
  `export_stills.py` and `tools/build-pack-art.py`), so a sibling can never go stale; `python tools/webp_siblings.py`
  remakes them all. The 1999 banana is served as lossless animated WebP, 3.3 KB for its 39 KB GIF, checked pixel for
  pixel on every write, with the GIF under it in a `<picture>`.
- **Nothing below the first screen is fetched first.** The strip's first slide was `loading="eager"` and downloaded
  alongside the banana. Chrome also starts lazy images 1,250–2,500 px early, so a picture the page shows small must
  also BE small: the sticker band shows `<slug>-sm.webp` (300 px tall), the shop's big fan keeps the full sticker.
- **A variable font is one URL across all its weights** — the way Google serves it. Each weight named its own
  byte-identical copy and the browser fetched the same file twice. `tools/check-design.mjs` fails two `@font-face`
  URLs whose files are identical.
- **The trackers' files wait for the page; their commands do not.** Consent, config, the page view and every event
  queue at once and in order (`dataLayer`, `fbq`'s and `clarity`'s queues); only gtag.js, the Meta pixel and Clarity
  load after `load` and an idle moment (4 s at the latest). ⚠️ NOT a deferred main.js: page modules would then run
  before it and fire their events ahead of the consent default and the config.
- **CSS ships minified**, all of `public/css` at build (styles.css 47 → 29 KB), and the two small sheets
  (fonts.css, paper.css) are written into every page's head instead of costing two render-blocking requests.
- **A live number does not wait for the pictures.** The ticker's live lines start at idle, not at `load` (which on a
  slow phone came 8.5 s in).
- ⏳ Open, and Trym's call because it is a DNS change: GitHub Pages caches every file for 10 minutes. Long cache rules
  need the site behind Cloudflare's proxy.

## §40 THE MAILBOX IS PAPER, AND EVERY CONTROL OF IT IS ON THE CARD (26 Sep 2026, Trym's notes on the mail view)

Trym: *"i dont see any postcard option at the post office anymore. And why do we call a letter received from someone
new a «Knock»? Its a letter, not a knock. And the letter icon sprite looks very pixelated and ugly … I think the mail
view is a bit messy"*.

- **An envelope is drawn, never a scaled item sprite.** The pack's letter item is nine art pixels; at 52, 40 and 30 px
  it broke unevenly. The mailbox's envelopes are CSS (`public/css/town-post.css`): a flap of two lines meeting in the
  middle, a red wax seal while it is unopened, the sender's name across the front in Caveat, kraft for a payslip. The
  sprite stays in the WORLD (the delivery round), where it is drawn at whole pixels. ⚠️ A handwritten name in a clipped
  box needs side padding: Caveat's last stroke runs past its letter's box, and the clip took the tail off "Pip".
- **A letter from somebody new is a letter.** A tile in New like the rest, tagged "first letter"; a tap shows who,
  never what, with Open it and Send back side by side. The server still says `knock` and the events keep their names
  (`post_knock`, `post_accept`, `post_away`); no screen says it, HQ included, and the copy gate fails knock or door
  in those words.
- **What the counter can do is at the foot of the mailbox.** Write a letter and Send a postcard, side by side, even
  with an empty box. Home is letters only.
- **A card's controls are ON the card — measured, never scrolled to.** The postcard sheet's eight lines were a list
  scrolling inside a card that also scrolled, and Send postcard sat below both at every size. Now the words are one
  line between two drawn arrows, Go back shares the last row with Send postcard, and on a short screen (a 1366×768
  laptop leaves the card about 430 px) the picture steps down to a half or a third of its 600-px plate before anything
  else gives. The last row also holds to the card's bottom edge, the guarantee for a screen shorter still. ⚠️ The thumb
  walk scrolls a control into view before it taps, so it cannot see this class; the sheet's test measures the card.
- **A label is measured in its own row at 360 px.** "Send a postcard" fits the counter's half-row at 0.82rem and not
  an open letter's (about 92 px), where the answer stays "Send a card". Measure the verb span, which is what clips.
- **Every letter opens on the world's paper** (Trym, 28 Sep 2026: *"Some letters are in plain normal text with
  «computer»-fonts, and some are with more paper visuals and a handwritten font … All should have the paper and
  handwritten style"*). A player's letter, a resident's note and the world's own note (a payslip, a quest letter) are one
  sheet: `.bw-paper` (/css/paper.css), Caveat on the ruled lines, the date over it in the card's ink, the sender's name
  signed at the foot (`bw-paper__from`), and no cream box round it (`.tw-post__open.is-paper`). Only a postcard is a
  picture instead. `tests/town-post.spec.mjs` fails a letter that opens in anything but the hand.
- **The mailbox's veil covers the screen** (Trym, 28 Sep 2026: *"the black overlay doesnt cover the whole mobile screen
  when opening a letter"*). The card wears the town's `.tw-panel` (`position: absolute; inset: 0`), which is right inside
  the town's view; the homestead hangs it outside any positioned box, where it covered only the document's first
  screen-height, so a phone scrolled a little saw the world bright under its bottom edge. There it is `position: fixed`,
  like every homestead card (`.hs-veil`). `tests/homestead-letters.spec.mjs` opens it on a scrolled 393×852 page.

## §41 A COUNTER LOOKS LIKE WHAT IT DOES, AND SAYS SO ONCE (26 Sep 2026, Trym in the store)

Trym: *"when i enter the store its not very intuitive that you can click on the store counter for opening the inventory of
the store - it should be solved visually with something rather than add another information message or textbox"*.

The store's counter was the pack's bare wooden counter: nothing on it, nobody behind it, a third of it dead to a tap, and a
card that opened from across the room. Four rules came out of it, for any fitting in a room that opens a card:

- **It looks like what it does, in its own art.** The pack's cash register (grocery single 308) stands on the counter:
  the one object anybody reads as "pay here". Pack art, baked into the plate (`till_piece` in
  `tools/build-town-scene.py`), and true in every state of the shop. ⚠️ Not an OPEN sign: the shop shuts at the lowest band,
  and "nobody says a shop is open unless it always is" (§32).
- **One piece, one spot.** The counter was two singles and only the first had a key, so a tap on its right third found
  nothing. It is one composited piece now, keyed `till`, so the whole drawn thing answers a tap (§24's rule, indoors) and
  the whole of it can glow.
- **Walk first, then the card** (§18). Every other thing indoors is walked to before it answers; the counter opened on the
  tap, from anywhere. A card that appears from across the room does not say where it came from.
- **A customer's invitation, once.** The town's own halo (`is-todo`, the restock chore's invitation) on the counter, register
  and all, for somebody who is not the shop's staff and has never opened its card on this device — gone at the first
  opening and never back (`seen()` / `once()` in `src/lib/once.js`: §30, say it when it applies, once). Never for the
  staff (a place greets strangers, §32), never while the shop is shut (an invitation only shines for somebody who can
  answer it). It lights the counter's own front piece (below), and `room.seam.invite()` is never the chore's `hints()`.
- **A keeper stands BEHIND their counter** (26 Sep 2026, Trym: *"maybe pip should be behind the counter, can sometimes walk
  out, but mainly is behind the counter. Feels organic if he has errands"*). Pip's daytime beats are on the store's floor
  (`INSIDE.store` in `town-life.js`) but noon at the cash machine and the day's odd errand when it is his. Four things make
  "behind" true, and each is needed:
  - **a front over him.** A plate cannot be in front of anybody, so the counter's front is a copy of the plate's own counter
    laid over it at the depth of its foot (`is-front`, town-room.js). His marks put his feet INSIDE the counter's footprint,
    so the front hides them, and left of the register, so nothing of the till is covered — and far enough in that his
    shadow does not peek past the counter's end.
  - **a way round.** `via` walks him round the counter's left end and down the aisle to the doorway; straight, he walked
    through the tables and the counter's face.
  - **two taps that stay two.** Indoors a resident is hit-tested before the fittings, so his box stops at the counter top
    (`clip`): tap HIM, his card; tap the counter, even straight under him, the shop. And he is talked to across the counter
    (`talk`): the banana walks to its front, never round behind.
  - **the room says where he is.** Its greeting names who runs it only while they are in (`rooms.storeOut`,
    `rooms.condoOut`; §3e: never name somebody who is nowhere on screen).
  While his own staff work the room he steps out to the bank's step — the aside INSISTS, because his store beats are
  indoor ones. Today's odd errand pulls a keeper out of their room too; the design gate knows a daytime home beat in a
  home with a room is a post.
  🎟 **The arcade's prize desk is the second** (29 Sep 2026, Trym: *"like a desk or reception for the arcade"*). Its TV
  shelf and two side-on bar stools became the TV studio's neon news desk with a gold cup on it and the clothing store's cap
  stand behind it (the Joy cap is an arcade prize), and Spinner's indoor beats stand behind the desk the same four ways:
  `INSIDE.condo` (in round its left end, past the last cabinet), its front `ARCADE.over.counter`, laid by the same
  `roomShow()`. Its line says what it is and sends you to the cabinets, and never names Spinner: he is not always there.
- **A "full" face must LOOK full — judge the pack's pair by eye, never by its number** (26 Sep 2026, Trym: *"most of
  the times the shelves in the store looks empty … seems like banana worlds saddest store"*). The store's stocked
  shelves were singles 403–405, written down as "406–408 filled": they are the same bare units painted green, so the
  shop looked empty in every band and "full" read as green lockers. The real pair is the white shop shelving, 104 bare
  and 98–106 with goods on every board. And the order faces fill in is a look too: every other unit first (1, 3, 5,
  then 2, 4), so a store running low has gaps along its wall instead of one empty half. The logic did not change: one
  face per thing Pip sells today, three at Struggling, the whole wall at Recovering (the town's resting point), the
  flower tables only for a Lively or Thriving town.

## §42 OTHER PLAYERS ARE EVERYWHERE, AND SAY SO HONESTLY (26 Sep 2026, the social layer)

Trym: *"users must find emotional connection to Banana World in simpler, familiar ways"*, then *"the echo-thing sounds cool,
wave - sure"*, *"for these social messages i dont think the letter mailbox is the right place, but maybe a separate icon
shows up for general notifications on the top left corner with the quests and job-icons"*, and *"build it as something
that stretches throughout the whole world and waves ofcourse"*. One chunk does it for every walkable area:
`src/lib/world-social.js`, loaded by the town, the park, the bay and the homestead. The server half is worker-rave's
YardRoom (`/echoes`, `/wave`, `/notices`, `/echo`) and `relayWave` in every presence room.

- **An echo is a real player, drawn as one, and never pretends to be here.** The players the address book already shows
  (a Pass, a Homestead, a name, about in the last two weeks) walk about the world under their own name, in their own
  banana, a little see-through. The town's visitors wear them (at most two at once, never at the café's rope); the park and
  the bay let them STROLL a route of places on open ground (`src/data/echo-routes.js`, Trym 29 Sep 2026: *"Echoes can move
  around in those areas too"*): a loop round the fountain on the plaza's paving and out along three paths; the bay's sand
  trail — never the court, the hut, the bar, a stall, the water, a bench already taken or Old Peel's. One stands a while at
  a place (swaying, now and then two bars of the dance), then walks to a place beside it that no other echo holds; the
  homestead lets them stroll the PUBLIC road past your gate and stop on open road, never in your yard. An echo whose card
  you opened stands where it is until you close it. A tap opens THEIR card — the NPC card's grammar — and its line says
  plainly they are not here: an echo that could be mistaken for a live player breaks trust, doubly with children.
- **Never on the rave floor.** Its copy promises that every banana on it is a real one, here now.
- **An echo walks on the animation frame, like every banana** (Trym, 28 Sep 2026: *"the echoes of other banana users
  walking by in the homestead are choppy in their movements"*). The stroll stepped 8.4 px on a 120 ms beat, eight hops a
  second; the beat now only brings one out, and while one is out the frame walks it — at the town visitors' own 96 px a
  second (town-folk.js WALK), dt-scaled, the two-frame step every 260 ms. The walks film an echo every frame (the homestead
  road, and a whole leg of the park's and the bay's routes) and fail on a hop or a step off the route. An echo is yard traffic: indoors it is in the
  homestead's `.is-inside` hide list, so under the shade it neither paints nor takes a tap (a tap on the dark over the
  road opened the card of a stranger nobody could see).
- **A live player wears a green dot on their name tag; an echo does not.** A person is a person (the Quiet Rule is about
  the residents and about speech): another player's name over their head is allowed, one tag, the name and nothing
  else. The town walk's silence check allows exactly that and still fails any other word on any banana.
- **A wave is one tap, and says nothing.** Tap a player here: your hand goes up and theirs sees it. Tap an echo: its card,
  then Wave. There is no typing anywhere in the social layer — every word in it is the world's
  (`src/data/copy/world-social.json`), so there is nothing to moderate.
- **Waves live in the corner, never in the letterbox.** The waves badge is the fourth of the top-left column's one 32 px
  circle (§28), UNDER whatever notes stand above it (the quest note, the town's work note, the pager), shown only while
  something new is in it and for the rest of that visit once opened. Its list: who waved, when, Wave back, and the
  switch that keeps your own banana out of other people's echoes. ONE ROW PER PERSON, at their newest wave (the
  mailbox's own rule), and a wave is answered once you have waved to them after it came — kept past midnight (Trym, 29
  Sep 2026: *"had 2 waves available for kiwi … a wave 2 days back, and another one 2 hrs ago — so a duplicate"*: "Waved"
  was kept for one day, so every answered wave offered itself again after midnight). The badge counts people too. It never starts empty: the first wave you send, or the
  first that comes for you, brings Nib's welcome, so the icon has said what it is for before it matters.
- **Small, plain, aligned** (Trym, 26 Sep: *"not too much text not too big popups … make sure buttons are consistent in size
  and centered … dont take more view than needed … if we can cut text, cut it"*). The echo card is its name, its farm and
  when, ONE short line, and one row of two equal buttons centred in it, no wider than 300 px and no dimming veil; a
  list row is who and when (a farm's link rides the when), its one Wave back in one column at one size, every row one
  height. `tests/world-social.spec.mjs` measures all of it, so it cannot drift back.
- **A new banana says so** (Trym, 26 Sep: *"build the new banana markers so regulars can welcome newcomers"*). A player
  in their first three days (their pass's `created`, the earliest any device of it knew: `worldNewcomer()` in world.js)
  wears a small green NEW chip after the name above their head — a nameless newcomer gets a tag for it to sit on — and an
  echo of a farm claimed in the last three days wears it too, on its tag and beside its name on the card. Every room
  hands the flag on (`nw`); a wave at one counts as a welcome (`wave_welcome`).
- **The card has ONE centre: the middle between its two buttons** (Trym: *"isnt centered under the player-name"*, then
  *"it should align with the center between the two buttons"*). The name, the line under it (when they played, one line:
  the farm's name left it because a long one wrapped) and the line below all sit on it — the same padding both sides, the
  text starting below the portrait's reach, and the NEW sticker hung off the name (absolutely, never wrapping) so it can
  never push the name off the middle. The walk measures all three centres against the buttons.
- **A tap on a banana is caught once, at the document.** Every area listens differently (the town on pointerdown, the
  others on click, the steer on touchstart), so the social layer takes a tap that lands on a banana's body in capture,
  before any of them, and swallows exactly the one click that tap owes — never a second, which is a new tap. The
  park's and the bay's cull sweeps leave an echo alone (`noCull`).
- **A new banana is handed a present that opens tomorrow** (Trym, 26 Sep: *"i believe in giving secret gifts or mystery
  chests … users get something others dont have"*). Forty-five seconds into a new banana's first visit, in whichever area,
  Nib hands it over on the social layer's own card (his portrait, one line, one button), never while another card, a
  story scene or a counter shift is up (every area's cards sit above it). It never opens that day: on any
  later day it opens by itself when they come back, greets them BY NAME, says what was inside and offers Wear it. The pass
  worker rolls it (`/gift`: a Banana Stand wearable they do not own, rarer the dearer) and owns it for them the way a
  purchase does, so a phone can neither choose it nor forge one. `src/lib/world-gift.js` loads only for somebody it
  concerns; walked by `tests/world-gift.spec.mjs`, proven by `worker-pass/test/gift.test.mjs`.
- **The town's first minute says itself without a word** (13 newcomers walked into the town in its first week as the front
  door; 5 found Nib). A new banana's own banana wears a small gold arrow just above its head until their first tap; three
  coins run up its RIGHT-HAND SIDE to Nib (2 each, once per person: worker-pass RULES `town.trail`) — beside the banana,
  never over it: at a phone's scale a coin on the straight path sat on your own head and the arrow floated inside the
  trail; and Nib waves (the social layer's hand) until you have met him. `src/scripts/town-welcome.js`, loaded only by a
  new banana (`?welcome=1` forces it for a walk).
- Walked by `tests/world-social.spec.mjs` (an echo in the park, the bay, the homestead and the town; the card, the wave,
  the badge under the quest note, the list and a wave back) and proven server-side by `worker-rave/test/social.test.mjs`.

## §43 A KEEPER AT THEIR POST IS THEIR PLACE: ONE TAP, ONE ANSWER (27 Sep 2026, Trym at the Exchange)

Trym: *"its a bit confusing that theres a different click between the actual stall, and the NPC responsible for the stall -
this goes for all NPCs standing outside something - like the wheel of peel aswell"*. Tally stood in front of her stall and a
tap on her opened her card, a tap an inch higher opened the orders. `banana-town.js` KEEP holds the rule:

- **A stall with a card of its own** (the Exchange, the Wheel of Peel): a tap on its keeper at their post is a tap on the stall
  — the same walk, the same card — and the card has them at its head: their face beside the stall's name and its own plain
  line, and "Talk to Tally" opening their card (`town-market.js keeperHead`). ⚠️ They do not SPEAK on it: a character speaks
  only in the one NPC card (§18), so the head carries their face and the way to them, never a line of theirs.
- **A place with only a line to say** (the Town Hall; the Coffee Cup and the lemonade stand for anybody who does not work
  there): a tap on it while its keeper stands at their post opens the keeper's card, which says more — a boss's holds the job.
- **Away from their post** (lunch, an errand, the night, a newcomer's Nib at the fountain) each answers for itself again, and
  a shut or hoarded front still says why before anybody speaks for it. Your own workplace is still going to work.
- ⚠️ Not a door with a room (the arcade, the store: you walk in), not the post office (the mailbox is your own letters), not
  the print shop (its line is the one pointer to the sticker packs).
- A resident on a card is a FACE and a NAME PILL: the head and shoulders (`town-market.js face`: the dialogue's drawing at 2.4,
  hat to mouth — Trym: "you only see the eyes") and the world's sticker-pill (`.tw-who`, /css/doors.css `.bb-door__pill`) —
  never their name run into a sentence ("Bean Milk for the coffee").
- Walked by `tests/town-keepers.spec.mjs` (real taps on Tally, the stall, Twirl, the Town Hall and the café's window, at their
  posts and at lunch); the order board's fit at 360×640 on the longest day of the year by `tests/town-orders.spec.mjs`.

## §44 THE STORY HAS ITS OWN COLOURS, AND ITS ! RIDES THE ONE IT MEANS (27 Sep 2026, chapter two)

Trym: *"that letter must be a different color than other letters - blue maybe as a quest-letter"* — and his call 6 on the
Ghost Writer plan: every quest letter is blue, black always means M.

- **A quest letter is BLUE**, the envelope (`.tw-post__env.is-quest`) and the ruled paper (`.bw-paper--quest`), under the
  Town Hall's gold seal. **Black always means M.** (`is-mayor`, `.bw-paper--mayor`): no seal, a silver lower-case hand. A
  letter's tone is one of the three the world writes (wage, quest, mayor), never whatever a letter arrives carrying: it is
  spliced into a class (`town-post.js sealed`).
- **A scene's resident waits at a place of their own, and the ! rides their head** (`src/data/quest-c2.js` station + follow).
  The town's residents walk, so a mark pinned where one stood at boot hangs over empty cobbles. A scene with nobody in it
  (the statue) hangs its ! on the thing, at the thing's depth, and a tap on the thing opens it (`banana-town.js`, the story
  first).
- **A prop is drawn in the page and its words are the copy's** (`src/lib/quest-c2-fx.js propEl`, a lazy chunk): what is
  printed on the plaque, the flyer, M.'s notes, the chalk. No prop, line or letter ever shows the first banana's name —
  writing that must not be read is HANDWRITING THAT SPELLS NOTHING (motifs that are no letter on their own), never letters.
- **A prop is the world's own art where the world has it**: the statue up close is the town's statue (ov-51, its size held
  by `tools/check-quest-c2.mjs`), never a diagram beside the pixel art (28 Sep 2026, Trym saw "a flat diagram").
- **Your reply sits UNDER what you answer**, and wraps: a reply is a sentence, a content card, not a button label.
- **What the night brings is only for the player in the chapter** (the Ghost Writer, the Mayor's lit window, the statue's
  water): drawn in the quest's own layer and gone at its next render. ⚠️ **A LIGHT GOES ON THE VIEW, OVER THE DARK**: the
  town's night is a scrim on the view (`.tw-night`), so anything lit inside the world comes out grey under it. The lights
  (`.bwq-light`, `mix-blend-mode: screen`) are pinned to world points every frame; a light laid over a face washes it
  white, so a light on a character is a HALO with a clear middle.
- **What the camera cannot show, the card shows**: at the hall on a phone the statue is off screen, so its water running is
  a cutaway prop (“meanwhile, outside”) and its stopping a small inset while the card stands aside (the `dark` line).
- **A scene owns its stage**: a resident held for a scene runs no errand (`n.insist`), and the town's own ghosts that
  would share it step out for this player (`window.bwqHush`, town-night.js).
- **A chapter opens and ends on a title card** over a dimmed world (`.bwq-scrim`), in the frame's middle where no area's
  toast lands — never on a toast.
- Walked by `tests/quest-c2.spec.mjs`: both letters, every scene in order, the ink, the night, the end card, the card's fit
  and the reply's place at every line, and the tallest scenes at 360×640; screenshots in test-results/c2-*.

## §45 THE BANANACOIN IS OURS (28 Sep 2026, Trym on the Banana Phone)

Trym: *"The «Sell goods» on Banana Phone shows a moon emoji - we do have our own Banana Coin symbol / icon"* — the second
time: the homestead's prices already said *"the REAL bananacoin, never the stock emoji"*. An iPhone draws the stock 🪙 as a
grey disc; the world's coin is the Banana Stand's gold one (`/assets/banana-stand/coin.png`, 44 px).

- **A line may still SAY 🪙** — it is how a toast or a float writes its coin, and the owed toast lines keep their words —
  and **every surface that writes a line draws it as the coin**: `src/lib/coin.js` (`coinText` into an element as text,
  `coinHtml` for markup the code builds, `coinImg()` for a coin on its own). The homestead's, the bay's, the park's, the
  club's and the town's toasts, floats and says, the quest's toast and its reward note all go through it.
- **In a page's markup, never the emoji**: an `<img>` of the stand's coin, sized to its line (`height: 1.1em`), or at its
  own 44 px where it is the picture (the bay's catch card). App icons on the Banana Phone are drawn at 34 px.
- `tools/check-design.mjs` §45: the emoji in an .astro page fails; in a script it must sit in the arguments of a line
  writer (toast, float, floatPlus, say, shopNote, phoneNote, payReward, coinText, coinHtml); a writer defined in the same
  file must draw through coin.js; and the world's own writers (HOSTS) are checked by name, so one that is rewritten
  without it fails. The check runs a catch-and-pass self-test first.

## §46 A PAGE THAT RE-ORDERS ITS BLOCKS STATES EVERY BLOCK'S PLACE (29 Sep 2026, Trym on his own pass)

Trym: *"something weird showed up at the Pass page on my profile - maybe do a little review of the Pass page if theres some
bugs here that does this"*. The week's standing ("This week you are 2nd for Neighbour, 1st for Farmer.") sat alone in the
top-left corner, above the card, behind a frame icon that read as an empty checkbox.

- **The pass page lays its blocks out with CSS `order`** — one column on a phone, a rail and a body on a laptop — and a
  block with no `order` is order 0, which is FIRST. The standing line and the membership card were both added without one:
  on a laptop the line landed in the rail's 320-px cell above the card, and on a phone both stood over the pass. Every block
  of the spine was named in one `order` list that afternoon — and by the evening the page ordered nothing at all: it reads
  in markup order since the redesign (§48). `tools/check-design.mjs` §46 reads the markup and the style and fails a spine
  that places SOME blocks by `order` and not others, and — if the wrap is ever a grid on a laptop again — a block that does
  not span its columns; it bites first, on a small page that orders two blocks and forgets a third.
- **The standing reads as an honour, not a form**: under the promise, aligned as the promise is (left on a phone, centred
  on a laptop), behind a small sparkle — never the Citizen's frame (a checkbox at 16 px), and never a plaque's own badge
  inline (the Farmer's is the three-bar "burger", which reads as a menu). Best place first, in Trym's words for it: "in the
  running" and "Log in to get nominated" (`pass-toasts.json` → `week`). The ask moves to its own line whole.
- **A card claims only what the server said.** The membership card told a member their subscription "was probably paid with
  a different email address" whenever its status call failed or they were not logged in — that sentence belongs to the
  server's own `known: false`. No answer claims nothing: the Polar link is the door, and the Cancel button waits until the
  server has matched the subscription.
- Proof: `tests/pass-layout.spec.mjs` (the card first and the standing under its promise at 393 and 1280, the membership
  card under the piles on a phone and under the tabs in the rail on a laptop, its three answers, "1 day on the pass").

### §46.1 A source file holds no control characters

The fresh pass said "1 DAYS ON THE PASS". Its singular rule was `/s\b/` — but a Python edit had written the `\b` without
`r''`, which is a BACKSPACE, so the rule looked for "s" then a backspace and never matched. The same slip had killed six voice
rules in `tools/copy-jobs.mjs` (the postcard's "a line never names its picture", the round's "no gesture", and a
neighbour's letter never sounding like an app, a debt or pity) — every one of them silently true for weeks — and left raw
NULs in the letter filter, so git called it a binary file. `tools/check-design.mjs` §46.1 fails any control character but
tab, newline and carriage return in src, tools, tests, docs, the workers and the public scripts and styles. Write the
escape; and in a Python edit, bytes that must be a backslash are `bytes([92])`, never a heredoc (it eats them too).

## §47 A BADGE WEARS ITS OWN ART, NEVER THE SITE'S CONTROLS (29 Sep 2026, Trym on his pass)

Trym: *"Make the Farmer badge icon farm-like, not a menu"*. Farmer of the Week and The Regular both wore `burger` — the
site's own menu glyph, drawn in the text colour — so on the card's badge strip and in the Earned pane a badge looked like a
button that opens a menu.

- A badge's icon is one of `PixelIcon.astro`'s coloured drawings of what it is for: a red **barn** with its hayloft for
  Farmer of the Week, a **calendar** with five days ticked green for The Regular ("Show up on five different days").
- `burger` and `close` are the nav's controls and stay the nav's. `tools/check-design.mjs` §47 reads the PATCHES list and
  the icon maps and fails a badge whose icon does not exist or is mono (drawn only in `M`, the text colour).

## §48 THE PASS PAGE BREATHES (29 Sep 2026, Trym on his pass)

Trym: *"it looks a bit cramped, small text, not much space, its a bit tight view with small detailed text - i feel the gui
need to breathe more on desktop and mobile - maybe all of it needs a bit of a revision on the Pass page to open it up a bit -
maybe change the navigation to make it better to navigate and see the information and the options better. The Membership
pass up front is important, its a cool and nice visual, but everything else i think could use a modernized design, to
categorize the information better and make it less cluttery."*

- **The card stays exactly as it was** — it is the keepsake, and its small print is part of the document look.
- **One column, in reading order, on every screen**: the card, its two lines (the promise, the week's standing), your
  account, the news, your things behind the tabs, the membership, the doors out, the newsletter. A laptop gets the same
  column wider (920 px) with 32 px between sections; the old 320-px rail beside a body mixed the tabs, the membership, the
  doors and the account drawer into one strip, and that was the clutter.
- **The account is one bar right under the card**, not the foot of the rail: its summary is the sync line, and it opens by
  itself with the email box for a pass that has something to lose and is not logged in — the login ask is the first thing
  under the card, where it was a collapsed row at the bottom.
- **The tabs are the page's navigation**: one joined control across the column, 58 px tall, an icon and a label each —
  Made, Earned, Stats (Trym's own word for it in July; it had become "Numbers"). A newcomer still gets doors, not empty tabs.
- **News you have read waits behind one row** ("Earlier news (n)"); only unread news stands. The farm's launch notice had
  stood on every visit for a month.
- **Type and room**: running text 14–16 px, nothing outside the card under 12 px; cards padded 16–20 px; an earned badge
  or piece of gear is a card with its date, one still to earn is a dashed outline with its how-to in full-strength ink (it
  was the faintest text on the page); heading counts are set quieter than their names.
- Proof: `tests/pass-layout.spec.mjs` walks a busy pass (`tests/pass-fixture.mjs`) at 360 and 1280: every section in
  reading order in one shared column with room between, nothing wider than the screen, no text under 12 px outside the card
  in any tab or the open account drawer, the tabs whole and 16 px; plus the newcomer's doors, the logged-out account opening
  under the card, and the news fold.

## §49 THE CITIZENS' FRAMES: A PLATE YOU CAN READ, A BANANA IN ITS OWN THINGS (29 Sep 2026, Trym on the front page)

Trym: *"the tiny name-badge-signs are a bit small and tight, they could be a bit more readable, and look visually a bit
better. I think this also goes for the board in the Park … especially the titles like Farmer and Gardener … very small … not
much space between title and name … also it doesnt look like their wearables are showing in the pictures of them … they
are all clean bananas"*.

- **The plate is real text, never baked into the picture.** The front page's plate was drawn by the bake at 15 px on a
  480-px frame shown at 197 px — its title read at 6 px. One brass plate (`src/styles/citizen-plate.css`: a brass gradient,
  a screw at each end, the title in spaced capitals, the name in Archivo Black, air between) is worn by the front page's
  frames and the park's card; both pages inline the file at build time (`?raw`), so the front page makes no extra request.
- **Sized off its own frame**, never a fixed px: the frame is a size container and the plate's type follows its width. No
  title under 11.5 px, no name under 11.5 px; a long name steps down a size (11+, 14+, 18+ letters) and breaks between its
  capitalised parts (a `<wbr>` the page puts there: "KiwiRainbow / Rain") — never mid-letter, never an ellipsis.
- ⚠️ **A size container needs a real width.** The Citizen's frame sits between auto margins; as a container it shrank to
  nothing (a sliver of plate) until it was given `width: 100%`.
- **The winner wears what they wear.** The bake's renderer (`tools/banana_render.py`, which also makes the print files)
  read only the wearart source, so the tailor's knitwear, the Arcade's prizes and the town's tools had no art there, and
  the site stores extras as `{id: on/off}` — a switched-OFF wool scarf still reached it. It threw on the scarf and the bake
  fell back to a bare banana for four frames of five. Now it reads every art pack the engine does, draws only what is on,
  leaves off a piece it cannot draw instead of the outfit (for pictures only — print stays strict), shows member hats, and
  hangs the winner's own catalog items on them (their look's `c`, converted by `wear-render.js`, placed by the engine's
  anchor maths). The frame shows the banana hat to hips, as wide as the paper allows, so what they hold is in the picture.
  The park's card draws with the engine itself and now adds the catalog items too.
- `tools/check-design.mjs` §49: every art pack `banana-engine.js` imports is named in the mirror, and every wearable's art
  is in what the mirror reads. `tests/citizens-frames.spec.mjs`: both surfaces at 393 and 1280 — five plates in order,
  the front page's names from the week's file, nothing under 11.5 px, nothing cut, air between title and name, the
  Citizen's frame wide, the pictures decorative (the plate names them); the park's card from a fixed board with a long
  camel-cased name, and its Citizen drawn in the squid hat's lilac.

## §50 THE FRONT PAGE'S HOMESTEADS ARE TODAY'S, AND THE GAME DRAWS THEM (29 Sep 2026, Trym on the front page)

Trym: *"this view over Homesteads on the frontpage needs some love too, they all look the same, and i think they in
reality dont? probably all are very early snapshots of users homesteads and they all look empty - but maybe it could look
nicer with 4 updated homesteads, or most active ones so you see their content, and underneath is more stickerpills of
other homesteads - it could probably be shuffled amongst active homesteads so we dont show lots of inactive ones on the
frontpage"*.

- **A picture of a player's place is drawn by the game, never re-drawn.** The old strip was a PIL copy of each yard (the
  house, the decor, the soil; no animals, no fences, no crops), run once on 6 Sep and never again: eight tents. Now
  `tools/build-yard-cards.mjs` opens the live visitor view (`/homestead/?yard=<slug>`) in headless Chromium, lays the world
  flat at scale 1 with the game's chrome hidden, and photographs it, so whatever the game draws next is in the picture
  with nobody touching the bake. ⚠️ The network is shut except the site, the yard's public doc and the catalog: a photo
  never counts as a visit, never mints a pass, never reaches analytics.
- **The framing finds the yard.** Every 4:3 window is scored by what it holds (the house most, and never cut in half; then
  animals, things, crops, soil, fences), and the smallest window that keeps 90 % of the most any window holds wins,
  centred on the yard's weight: a small yard up close, a big one whole. 1:1 pixels, webp, 30 to 80 KB.
- **Only lived-in yards, a new pick every day** (`tools/yard-pick.mjs`): a real yard (never testy, trym, qa, proofy), stage 1
  or more, saved in the last 14 days and saved again at least 12 hours after it was made, one per owner. A weighted
  shuffle seeded by the UTC day (weight = what is in it × how recent the last save), so the liveliest come up most days and
  every active yard gets its turn; the first four furnished ones are photos, the next twelve are pills, never one name twice.
- **Four photos, then sticker pills.** Two to a row up to 1000 px (one under 640 px), big enough to see what is in a yard;
  the name on a tilted yellow tag with the pack's house (never 🏡), a dark "visit →"; under them the pills (yellow, white,
  pink, tilted, a hard shadow, never on two lines) and a dashed "+ Claim a free plot" last. Words: `src/data/copy/home-yards.json`.
- **The deploy keeps it fresh.** The day's first deploy photographs (the runner's own Chrome, no browser download) and
  `actions/cache` keeps that day's set for the later pushes; without photos the committed set stays.
- `tests/home-yards.spec.mjs`: the pick's rules without a browser (QA and one-sitting yards out, one per owner, the same
  order all day and another the next, the fuller yard up on more days while a thin one still gets its turn, names whole
  and never twice), then the page at 1280, 393 and 360: the manifest's photos in order, 4:3, tags whole and clear of the
  button, two to a row on a desktop and one on a phone, pills whole on one line and on screen, no sideways scroll, no emoji.

## §51 OUR BANANA, NEVER A STAND-IN (30 Sep 2026, Trym on the footer and his HQ)

Trym: *"why does my HQ have a stock-banana emoji in its logo header and not our actual banana? And why does the footer
on the site say 'Trym Stene - the banana guy' followed by a random pixel drawn banana, and not our actual banana?"*

- **Where a banana stands for Trym or the site, it is THE dancing banana:** `<Nana />` (src/components/Nana.astro), the
  real art in `/favicon.svg` (38×38 squares). The footer's signature, the HQ letterhead, the builder's banana_guy, the
  "Get the GIF" and "Download meme GIF" buttons, the OG badge, "The banana — me", the doors to make one.
- **38 px or 76, nothing in between.** 38 px is one art pixel each; any other size smears the face. In a button or a
  pill it tucks into the padding (the control keeps its height); in a line of words that line grows.
- **The generic fruit is gone.** `PixelIcon` had a code-drawn banana fruit; it stood in for him in 20 places and read as
  "a random pixel drawn banana". It is deleted, and `<PixelIcon name="banana">` now fails the build with the way to
  `<Nana />`. An OS 🍌 in chrome (a logo, a letterhead, a button) is the same mistake; in content strings (toasts, a
  news line) emoji stay tolerated, as the icon set's house rule says.
- **A smaller redraw of the character is Trym's call, never ours** (his character, his art).

## §52 TWO GLOVES, ONE THING EACH — WHATEVER THE THING IS (1 Oct 2026, Trym on the Citizens' board)

Trym: *"the banana user has two items / wearables equipped at once in both hands? on one hand boxing gloves and a
lightstick, and the other hand boxing glove and miniature banana? It shouldnt be possible to have two wearable items in
one hand at the same time."*

- **A hand holds one thing, whatever it is.** The game's own hand items and a community piece drawn for a hand share the
  same two gloves. `src/lib/hands.js` decides every glove (src/data/wearables.js re-exports it, so every surface that
  dresses a banana already has it): the moment's item first (a beer at the rave, the broom at work), then a community
  piece on the glove it was drawn for, then the game's items in catalog order. What does not fit is not drawn.
- **The newest wins.** Putting a thing in a hand makes that hand let go (`makeRoom`), so the saved banana is the drawn one:
  the builder (a hand chip, "Wear it", the closet's `?wear=`, a loaded outfit, Surprise me), the Banana Stand, an approved
  Forge piece. A community piece's spot is its anchor AND its glove: a left glove leaves the right one on. Six spots, so
  the builder keeps six community pieces, and over the cap the oldest goes, never the newest.
- **The picture renderer agrees glove for glove.** `tools/banana_render.py` (the Citizens' frames, the stream pack, print
  files) takes the rule from `tools/hands_rule.py`, in catalog order — never the outfit's own key order, which once put
  the plush and the glowstick in opposite gloves to the game.
- The banana of the day keeps, and names, only what its two hands hold — and wears ONE garment on the body (one of the
  rolled ones, picked by a last draw so every other draw of the day stands). It piled up to seven on 298 days a year.
- **Every surface that puts a thing on lets its spot go, Forge pieces included** (`src/lib/wear-spot.js` `letGo`): the
  town's dressing room (its mirror now draws the Forge pieces; a save takes off only the pieces a pick displaced, by
  name), Nib's present, the beach's plush. The product page keeps one garment on the body and one pair of shoes (a
  sticker could print a bow tie over a tie) and makes room in the hands.
- **A room passes on six Forge pieces, the newest** (worker-rave `sanitizeCList`): it kept the first four, so everybody
  else saw a banana without what it had put on last. A malformed id drops on its own, never the whole slot.
- **Enforced by** `tools/check-hands.mjs` (check-all and CI): one table of cases through both copies of the rule, the
  newest-wins cases a wardrobe meets, and the engine, the print renderer, the builder, the stand and the approval path
  each using it.

## §53 XP YOU CAN FEEL, IN EVERY AREA (2 Oct 2026, Trym on level 99, the wheel and the glow)

Trym: *"i dont feel XP in banana world FEELS great, in the way getting banana coins does when getting coins on the
spinning wheel"*; then, of the first cut's sparks flying to the HUD: *"its better with a soft pulsating golden glow around
the banana when experience points are received, and that the XP-bar also glows up at the same time, maybe with a small
shake animation … and an animation showing the xp bar growing"*, and of the glow: *"close glow tight to the shape of the
banana and its wearables, not glow with alot of spread, and whiter golden, not yellow"*.

- **One layer for every grant.** XP is `passStat('rep', n)` in every area, and passStat says so once (`pass:rep`, with
  the true before and after, the double-XP pie included). The world HUD (`src/lib/world-hud.js`) hears it and hands it
  to `src/lib/world-xp.js`, a lazy chunk that is the same in the town, the park, the bay, the homestead and the rave.
  **An area grants and never shows its own XP**: no bare "+2" float, no XP pill of its own, no level toast.
- **One beat, together** (§30.2: nothing before the moment that tells it). The LVL chip holds until the beat; then the
  glow pulses round your banana as "+N XP" rises beside its head, and the chip lights up, swells, gives a small shake and
  its bar grows, the fill flashing up to its new length. Grants that trickle merge into one beat (450 ms in the areas,
  1.5 s on the rave's floor, never held past twice that), so a run of small ones is one "+N XP", never wallpaper.
- **The glow hugs the banana and what it wears**: a pale copy of its own canvas, just behind it, under a tight
  whitish-gold shadow — never a halo with spread, never plain yellow. It is a static filter under an opacity pulse
  (§21.4), it dances with the banana while it glows, and it keeps its own filter over an area's canvas rules.
- **A level is the chip's moment.** The bar fills to the top, the number turns, the bar starts again from empty (it never
  drains backwards, and it is never full a step short), the chip pops, and the arrow with "LVL N" rides up off your
  banana and stays with it if you walk on. **A new title is the world's big moment instead** (§27: once no card is up),
  in the words of `src/data/copy/world-level.json`, and so is level 99, the last. Never both.
- **The big moment stands on its own card** — the HUD chips' dark see-through ground and gold edge — so its white lines
  read over cobbles, grass, sand and the floor; the title you hold and what comes next are two lines that each fit a
  360-px phone.
- **Reduced motion** (§3d): nothing pulses, swells or shakes; the glows are lit and then gone, the chip says it in the
  beat, the label and the riser stand still, and a title still gets its moment.
- **The rave keeps what only the floor has:** the roster's level, the room's `lvl`, and the four-note arpeggio, which
  plays on `world:levelup`, as the level lands.
- **Enforced by** `tests/world-xp.spec.mjs`. A feel cannot be grepped, so the walk asserts the order of things in all
  five areas on a phone: the hold, the glow behind the banana, the chip's glow and its lit bar, the bar growing, the
  label, a level and its riser, the title in the copy file's words with no riser, level 99, the longest title at 360 px,
  reduced motion standing still, and a trickle as one label.

## §54 YOUR BANANA WEARS WHAT IS SAVED, ON THE SCREEN YOU ARE LOOKING AT (2 Oct 2026, Trym on two devices)

Trym: *"on my laptop my banana is styled clean with only a pigeon hat on my head, im now on my phone many hours later and
here my banana has the red scarf and top hat on … the preview in the clothes shop shows my banana with a pigeon hat. Why
are my banana wearing different clothes and wearables across devices?"* (the second time in two days his banana was not
what he had put on; the first was the daily banana’s overlay, 05c3c9a6).

- **The save is the outfit, and the banana on screen follows it.** Every area dresses its banana from `bb-last` at load,
  and the sync from another device is a fetch that lands after that (at load and whenever the tab comes back). When a
  pull changes the save (`applyBlob`), or another tab of the same browser does (`storage`), banana-pass.js says
  `world:rewear`, and every area puts it on the next frame — the town, the park, the bay, the homestead and the rave — and
  tells its room, so the other players see it too. The community piece (`c`) comes along (`wearSaved`).
- **The same things in every area.** The town's square drew nobody's Forge pieces, yours included, while its clothes
  shop and the other areas did; it draws them now, on you and on everyone in the square (`src/lib/custom-art.js`, the
  catalog fetched only when somebody wears one).
- **A floor-only thing stays in hand:** the rave's free beer is the floor's, never saved; a re-dress keeps it, and a
  jelly-time peak keeps its disco legs until the peak ends.
- **Never dress a banana from a copy read once and kept:** a surface that shows your banana either reads the save when it
  draws (the clothes shop, the social card, the quest) or answers `world:rewear`.
- **Enforced by** `tests/outfit-follows.spec.mjs`: the phone's old outfit saved and dressed, the sync's answer held until
  then, the laptop's outfit landed through the real pull — the banana on screen and the room must wear it, in all five
  areas, and a second tab's change reaches the first. It fails in all six with the re-dress switched off (checked). On the
  square, your Forge piece and a passer-by's are in the drawing (real catalog pieces, tests/catalog-hands-fixture.json).
