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
| named | yes, with a card you can tap | never — no name, no card, no tap |
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
  (`tools/build-home-stats.py` → `src/data/home-stats.json`, two significant figures rounded DOWN, printed with a "+"):
  a line about PEOPLE reads the event's users (`rave_join` fires on every reconnect, so "danced at the rave" is
  `rave_join_users`), a line about things reads only what the event counts (a fishing catch is "a catch", not "a
  fish"). Live lines — who is in the world now, the town's day, the Wheel of Peel's pot — come only when they say
  something (two or more) and a counter that does not answer is left out, never guessed.
- **An inline number keeps its spaces.** A flex row trims the whitespace at the edges of its text runs, so
  "today: 80 things" printed "today:80things"; the ticker's items are `inline-block`.
