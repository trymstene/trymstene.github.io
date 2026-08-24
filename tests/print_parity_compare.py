# -*- coding: utf-8 -*-
"""🖨 PRINT PARITY (rig step 4, Dev Desk issue #4) — the python half.

tools/banana_render.py produces the ACTUAL print files (Printful gets its
pixels from it). This script renders the fixed parity outfits through it and
pixel-diffs each frame against the browser renders that
tests/print-parity.spec.mjs saved from the real drawComposite. Divergence
means a customer's merch would not match their preview — that fails CI.

ALIGNMENT (no eyeballing, no bbox guessing): the browser rendered at W=8300,
the one canvas size where drawComposite's layout is an integer sprite scale
(11), context pre-translated +0.5px in x → the 469×498 frame origin sits at
exactly (1571, 1660). banana_render renders at scale=11 with its own pad;
cropping its canvas at (pad-1571, pad-1660) size 8300² puts both images in
the SAME pixel space by construction.

THRESHOLD (the honest part): the two rasterisers may legally disagree by ONE
device pixel along accessory edges — Chromium places fractional rect edges by
pixel-centre coverage and anti-aliases them (accessories draw with smoothing
on), Pillow rounds them to whole pixels — and one device pixel here is 1/11
of a sprite pixel. So: exact-equal pixels pass; a differing pixel is forgiven
only if BOTH hold, in premultiplied-RGBA space with a slack of 8/255:
  · the browser's pixel is a blend of colours the print shows within the
    3×3 neighbourhood (on a segment between two of them, or — at a corner
    where three regions meet — inside a triangle of three), and
  · the print's pixel appears within the browser's 3×3 neighbourhood.
What survives is "hard". One legal class of hard remains: where two layers
abut, the rasterisers can disagree about the boundary pixel and REVEAL a
different layer (1px of banana outline beside the sombrero brim; the shade
lens leaking through the moustache tip's AA) — always a ≤1px-wide SLIVER
line, never an area. So the verdict is shape-aware:
  · any CORED hard pixel (all 8 neighbours also hard — i.e. a 2D region of
    real difference; even one dropped art pixel is 14×14 device px) FAILS,
  · total hard above SLIVER_BUDGET fails (long/wide displacement bands),
  · thin slivers under the budget are the rasteriser boundary noise above.
A real divergence (wrong art, wrong layer order, mirrored/misplaced item,
missing feature) always produces cored regions and/or thousands of hard px —
the scarf mirror this rig caught on day one measured 400k.

Run after the browser half:
    npm run build
    npx playwright test --config playwright.parity.config.mjs
    python tests/print_parity_compare.py
On failure, side-by-side crops + a diff overlay land in
test-results/print-parity/diff/.
"""
import json
import os
import re
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(SITE, 'tools'))
import banana_render as br  # noqa: E402 — needs the path bootstrap above

SPECS = json.load(open(os.path.join(HERE, 'print-parity-outfits.json'), encoding='utf-8'))
W_B = SPECS['browserCanvas']
BROWSER_DIR = os.path.join(SITE, 'test-results', 'print-parity', 'browser')
DIFF_DIR = os.path.join(SITE, 'test-results', 'print-parity', 'diff')
CORE_LIMIT = 0      # 2D regions of real difference — the budget is zero
SLIVER_BUDGET = 2000  # boundary-noise slivers per pair (observed ≤ ~300)

# ---- mirror the harness geometry, from the engine's own constants ----------

GEO = open(os.path.join(SITE, 'src', 'lib', 'banana-geo.js'), encoding='utf-8').read()
H_FRAC = float(re.search(r'FRAME_H_FRAC = ([0-9.]+)', GEO).group(1))
TOP_FRAC = float(re.search(r'FRAME_TOP_FRAC = ([0-9.]+)', GEO).group(1))

S = W_B * H_FRAC / br.FH
assert abs(S - round(S)) < 1e-9, (
    'browserCanvas %d no longer yields an integer scale (%.4f) — FRAME_H_FRAC '
    'changed; pick a new W in print-parity-outfits.json + the spec' % (W_B, S))
S = round(S)
FX_B = (W_B - br.FW * S) / 2 + 0.5  # + the harness ctx.translate(0.5, 0)
FY_B = W_B * TOP_FRAC
assert FX_B == int(FX_B) and FY_B == int(FY_B), 'frame origin not integer: %r %r' % (FX_B, FY_B)
PAD = br.pad_for(S)
X0, Y0 = PAD - int(FX_B), PAD - int(FY_B)  # browser (0,0) in banana_render's canvas


TOL2 = 8.0 ** 2  # premul-space slack² for AA rounding; real art colours differ by ≥ tens


def rgba32(arr):
    """HxWx4 u8 → HxW u32 (one comparable word per pixel)."""
    return np.ascontiguousarray(arr).view(np.uint32).reshape(arr.shape[:2])


def premul(vals_u32):
    """K u32 pixels → K×4 float premultiplied — the space where an
    anti-aliased coverage blend sits BETWEEN the colours that produced it."""
    c = np.ascontiguousarray(vals_u32[:, None]).view(np.uint8).reshape(-1, 4).astype(np.float32)
    al = c[:, 3:4] / 255.0
    return np.concatenate([c[:, :3] * al, c[:, 3:4]], axis=1)


def seg_d2(x, p0, p1):
    """squared distance from points x to segments p0→p1 (all K×4)."""
    v = p1 - p0
    den = np.maximum((v * v).sum(axis=1), 1e-9)
    t = np.clip(((x - p0) * v).sum(axis=1) / den, 0.0, 1.0)
    proj = p0 + t[:, None] * v
    return ((x - proj) ** 2).sum(axis=1)


OFF9 = [(dy, dx) for dy in (0, 1, 2) for dx in (0, 1, 2)]


def in_triangle(x, cols):
    """is point x within TOL of a triangle of any 3 distinct colours in cols?
    Only the INTERIOR case matters — edge blends already had their segment
    pass — so: project onto the triangle's plane, accept if the projection's
    barycentrics are inside and the residual is small."""
    from itertools import combinations
    for c0, c1, c2 in combinations(cols, 3):
        u, v = c1 - c0, c2 - c0
        g = np.array([[u @ u, u @ v], [u @ v, v @ v]])
        if abs(np.linalg.det(g)) < 1e-6:
            continue  # degenerate (collinear) — the segment pass owned it
        s, t = np.linalg.solve(g, np.array([u @ (x - c0), v @ (x - c0)]))
        if s < -1e-6 or t < -1e-6 or s + t > 1 + 1e-6:
            continue
        if ((x - (c0 + s * u + t * v)) ** 2).sum() <= TOL2:
            return True
    return False


def compare(a_img, b_img):
    """→ (raw, hard, core, hard_mask). a = browser, b = print — aligned."""
    a = np.array(a_img, dtype=np.uint8)
    b = np.array(b_img, dtype=np.uint8)
    a[a[..., 3] == 0] = 0
    b[b[..., 3] == 0] = 0
    a32, b32 = rgba32(a), rgba32(b)

    ne = a32 != b32
    raw = int(ne.sum())
    if raw == 0:
        return 0, 0, 0, None

    ys, xs = np.nonzero(ne)
    a_p = np.pad(a32, 1, mode='edge')
    b_p = np.pad(b32, 1, mode='edge')
    hard_mask = np.zeros(a32.shape, dtype=bool)
    hard = 0
    for i in range(0, len(ys), 50000):  # chunked: K×9 float gathers add up
        cy, cx = ys[i:i + 50000], xs[i:i + 50000]
        x_pm = premul(a32[cy, cx])
        bv_pm = premul(b32[cy, cx])
        b9 = [premul(b_p[cy + dy, cx + dx]) for dy, dx in OFF9]
        a9 = [premul(a_p[cy + dy, cx + dx]) for dy, dx in OFF9]
        a_ok = np.zeros(len(cy), dtype=bool)  # browser px = AA of an edge the print has here
        for j in range(9):
            for k in range(j, 9):
                a_ok |= seg_d2(x_pm, b9[j], b9[k]) <= TOL2
        b_ok = np.zeros(len(cy), dtype=bool)  # print's colour exists next door in the browser
        for j in range(9):
            b_ok |= ((bv_pm - a9[j]) ** 2).sum(axis=1) <= TOL2
        # corner rescue: where three regions meet on one pixel the browser
        # blends three colours — a segment can't explain that, a triangle can.
        # Skipped when survivors are legion (a real divergence, not corners).
        need_tri = np.nonzero(~a_ok & b_ok)[0]
        if 0 < len(need_tri) <= 2000:
            for n in need_tri:
                cols = np.unique(np.stack([b9[j][n] for j in range(9)]), axis=0)
                if len(cols) >= 3 and in_triangle(x_pm[n], cols):
                    a_ok[n] = True
        bad = ~(a_ok & b_ok)
        hard += int(bad.sum())
        hard_mask[cy[bad], cx[bad]] = True

    # cored = hard with all 8 neighbours hard — a 2D region, not a sliver
    hm_p = np.pad(hard_mask, 1)
    core_mask = hard_mask.copy()
    h, w = hard_mask.shape
    for dy, dx in OFF9:
        if (dy, dx) != (1, 1):
            core_mask &= hm_p[dy:dy + h, dx:dx + w]
    return raw, hard, int(core_mask.sum()), hard_mask


def write_artifacts(name, a_img, b_img, hard_mask):
    """On failure: a zoomed browser|print|marker strip at the worst spot and a
    downscaled overlay of every hard pixel — enough to see WHAT diverged."""
    os.makedirs(DIFF_DIR, exist_ok=True)
    ys, xs = np.nonzero(hard_mask)
    cy, cx = int(np.median(ys)), int(np.median(xs))
    r = 320
    box = (max(0, cx - r), max(0, cy - r), min(W_B, cx + r), min(W_B, cy + r))
    a_crop, b_crop = a_img.crop(box), b_img.crop(box)
    marker = Image.new('RGBA', a_crop.size, (255, 255, 255, 255))
    mk = np.array(marker)
    sub = hard_mask[box[1]:box[3], box[0]:box[2]]
    mk[sub] = (255, 0, 200, 255)
    strip = Image.new('RGBA', (a_crop.width * 3 + 20, a_crop.height), (34, 34, 40, 255))
    strip.paste(a_crop, (0, 0), a_crop)
    strip.paste(b_crop, (a_crop.width + 10, 0), b_crop)
    strip.paste(Image.fromarray(mk), (a_crop.width * 2 + 20, 0))
    strip.save(os.path.join(DIFF_DIR, '%s-zoom.png' % name))

    ds, side = 10, (W_B // 10) * 10
    small = a_img.crop((0, 0, side, side)).resize((side // ds, side // ds), Image.BILINEAR)
    sm = np.array(small.convert('L').convert('RGBA'))
    hs = hard_mask[:side, :side].reshape(side // ds, ds, side // ds, ds).any(axis=(1, 3))
    sm[hs] = (255, 0, 200, 255)
    Image.fromarray(sm).save(os.path.join(DIFF_DIR, '%s-overlay.png' % name))
    b_img.save(os.path.join(DIFF_DIR, '%s-print.png' % name))


def main():
    failures = []
    for spec in SPECS['outfits']:
        outfit = {'hat': spec['hat'], 'glasses': spec['glasses'], 'extras': spec['extras']}
        for idx in range(br.NFRAMES):
            name = '%s-f%d' % (spec['name'], idx)
            path = os.path.join(BROWSER_DIR, name + '.png')
            assert os.path.exists(path), (
                'missing browser render %s — run the playwright half first '
                '(npx playwright test --config playwright.parity.config.mjs)' % path)
            a_img = Image.open(path).convert('RGBA')
            assert a_img.size == (W_B, W_B), '%s is %r, expected %d²' % (name, a_img.size, W_B)
            a_edge = np.array(a_img)[:, :, 3]
            assert not (a_edge[0].any() or a_edge[-1].any() or a_edge[:, 0].any() or a_edge[:, -1].any()), \
                '%s has ink on the canvas border — the outfit outgrew W=%d' % (name, W_B)

            full = br.render(idx, outfit, scale=S)
            bbox = full.getbbox()
            assert bbox and bbox[0] >= X0 and bbox[1] >= Y0 and bbox[2] <= X0 + W_B and bbox[3] <= Y0 + W_B, \
                '%s: print ink %r outside the compare window' % (name, bbox)
            b_img = full.crop((X0, Y0, X0 + W_B, Y0 + W_B))

            raw, hard, core, hard_mask = compare(a_img, b_img)
            ok = core <= CORE_LIMIT and hard <= SLIVER_BUDGET
            print('%-14s raw %-7d hard %-5d core %-5d %s'
                  % (name, raw, hard, core, 'OK' if ok else 'DIVERGED'))
            if not ok:
                failures.append((name, hard, core))
                write_artifacts(name, a_img, b_img, hard_mask)

    if failures:
        print('\nFAIL: %d/%d pairs diverged - the print files would not match the '
              'preview. Diff artifacts: %s' % (len(failures), len(SPECS['outfits']) * br.NFRAMES, DIFF_DIR))
        for name, hard, core in failures:
            print('   %s: %d hard px, %d cored' % (name, hard, core))
        sys.exit(1)
    print('\nPASS: print parity holds across %d outfit-frame pairs'
          % (len(SPECS['outfits']) * br.NFRAMES))


if __name__ == '__main__':
    main()
