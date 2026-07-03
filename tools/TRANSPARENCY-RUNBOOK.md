# Runbook: white/grey pixels on the dancing banana's transparent background

**If Trym points you at this file, the "white pixel bug" is back (or looks like
it's back). Read this whole document before touching anything. This exact
problem burned a full day in July 2026 across FOUR wrong fixes — everything a
fresh session needs is here, no screenshots or re-explaining required.**

---

## 1. What the bug looks like

White or grey-white patches that should be transparent, visible whenever the
banana is shown on a coloured/transparent background:

- **at the gloves' inner edges** (small chunks attached beside the white gloves)
- **in the gaps between the arms and the body** (bigger irregular patches —
  can be nearly glove-sized)
- **between the legs / at the crotch** (small dot or strip)
- or as a faint **light halo along the whole outline**

Where it shows up: the make-a-banana builder preview (`/make-a-banana/`),
downloaded emoji GIFs / meme PNGs / sticker print files (all render from the
same spritesheet), and the hub's downloadable `dancing-banana-transparent.gif`.

## 2. The assets involved (all must be fixed together)

| Asset | Role |
|---|---|
| `public/assets/banana-dance.png` | THE spritesheet: 8 frames of 469×498, side by side (3752×498). Everything in the generator renders from this. |
| `public/assets/dancing-banana-transparent.gif` | The hub's downloadable transparent GIF — historically generated FROM the sheet (100 ms/frame, disposal=2, transparency index 255). Regenerate it whenever the sheet changes. |
| `SHEET_SRC` in `src/scripts/banana-builder.js` | The sheet URL carries a `?v=N` cache-buster. **Bump N on any pixel change** or returning visitors keep rendering their cached old sheet. |

## 3. Root cause (historical)

The sprite frames were extracted from a 1999 GIF that had a **white
background**. The extraction left three distinct classes of dirt:

1. **Pure-white speckles/strips** (RGB ≥ 235) touching transparency — small
   separate components.
2. **A grey anti-aliasing halo** around the entire silhouette (RGB ~124–228,
   neutral grey = white bg blended into the black outline). 1,000–2,000 px per
   frame.
3. **Enclosed white gap patches** between arm and body — up to **1,475 px,
   i.e. the same size as a glove**, and **fully surrounded by black pixels**.

## 4. Why naive fixes fail (the four graves — do not fall in them again)

| Attempt | Why it failed |
|---|---|
| "It's browser cache" | Falsified by incognito. The dirt was in the source pixels. |
| Remove pure white (>235) touching transparency | Missed dirt class 2 and 3 entirely — the halo is GREY, and the gap patches never touch transparency. |
| Scan the rendered canvas for white-next-to-background | **False negative**: the 720px preview downscales the 498px frame ~0.87× with nearest-neighbour, silently dropping 1px dirt rows. **Audits must run on RAW asset pixels.** |
| Iterative "defringe" (delete grey edge pixels) + size-threshold auto-removal | Two regressions: the peel went THROUGH thin outline spots and **ate bites out of the glove/shoe whites** (bg bled into them), and a ≤200px auto-pass **deleted the far eye** — on side-facing frames the far eye is SPLIT by the pupil into two 141–202px white pieces that look like dirt to any size filter. |

## 5. The correct fix

**Run `tools/clean-sprite-transparency.py`** (same directory as this file — it
is the working, verified pipeline with all of this encoded). Input is the
pristine original sheet from git history; see its header for the exact
extraction command and usage.

The algorithm, in case the tool needs adapting:

- Classify every opaque pixel: **dark** (max ≤ 110) keep · **saturated**
  (max−min ≥ 35: yellow/red) keep · **white** (min ≥ 235) keep ·
  **grey AA** (the rest) → decide:
  - grey with a **white 8-neighbour** → paint **BLACK** (it is the white
    object's missing outline — *removal is the wrong verb here*)
  - other grey → **transparent** (halo)
- White is **never deleted** except: (a) the six explicitly seeded gap patches
  on frames 0 and 4, (b) white components ≤ 400 px that touch transparency
  (the class-1 speckles).
- Classify white components against the **known anatomy** before removing
  anything: per frame = 2 eye whites (side frames: + two 141–202 px far-eye
  halves), 2 gloves (~1,400 px), 2 shoes (~1,500 px). Anything else white is
  dirt.
- Finish: any bright pixel still touching transparency → recolour to outline
  black `#111`.

**Hard invariants** (the tool prints them per frame; all must be 0):
`whiteLost`, `brightNonWhiteEdge`, `whiteTouchingBg`.

## 6. Verification (where every wrong fix died — non-negotiable)

1. **Raw pixels, never a scaled canvas**: audit the PNG/GIF files directly
   with Pillow.
2. **Zoom crops, not whole frames**: render 3× crops of (a) the arm/body gaps,
   (b) gloves, (c) shoes, (d) the face — on loud magenta/pink. Whole-frame
   eyeballing misses 1–2 px damage. Check BOTH that dirt is gone AND that
   nothing legit was eaten.
3. **All 8 frames** as a grid — dirt and damage are frame-specific
   (the lean frames 0/4 carry the gap patches).
4. **After deploy**: with the chrome-devtools MCP, draw the LIVE sheet's
   frames onto a canvas over a loud background in a real browser and
   screenshot. Then have Trym hard-refresh (Ctrl+Shift+R).
5. Regenerate `dancing-banana-transparent.gif` from the cleaned frames and
   audit it the same way; bump `?v=N` in `SHEET_SRC`.

## 7. Rules of engagement

- **Trym's eyes are the ground truth.** He was right four times in a row while
  automated audits reported "clean". If he says it's still broken, it is —
  zoom to the exact regions he circles and look at raw pixels there.
- Every fix must re-verify what it could BREAK (the whites), not just what it
  fixes.
- Thresholds lie. Enumerate components and classify against anatomy.
