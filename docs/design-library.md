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

## 10. Copy

- Dates inside English sentences are formatted in English (`en-GB`), not in the
  visitor's locale. "19.9.2026" mid-sentence is a bug.
- Never fix copy by adding words. Restructure and come out shorter.
- Say the warm half of a true thing. "These bananas pay for the world to stay
  free" is accurate and reads like a notice nailed to a fence; "the whole world
  runs on these bananas" is the same fact, delivered.
- The same warning in three cards is not emphasis, it is small print. Say it
  once, under the row.

## 11. Money links live in one constant

Never hardcode a payment URL in a page. `src/data/pay-rail.js` owns every
address money can travel to. Ten links across the site were still pointing at a
platform abandoned months earlier — the footer, six localised pages, the
gif-meme page, and the download cards at the highest-traffic moment on the
site. `tools/check-design.mjs` fails the build on a hardcoded payment host.

## 12. Verify by looking

Mechanical checks are the floor. Walk the surface as a player on the built
site, screenshot every state, and *read the screenshots back*. A DOM assertion
that a class is present says nothing about whether the thing is legible.

⚠️ `astro dev` hot-reload lies on `<style is:inline>` edits. If a style change
does not show up, restart the dev server before you start debugging code that
was already correct.
