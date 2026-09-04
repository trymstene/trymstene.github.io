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
