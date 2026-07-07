# -*- coding: utf-8 -*-
"""THE BANANA ASSET PIPELINE — every derived banana asset from Trym's masters.

Source of truth: public/assets/dancing-banana-highres/dancing-banana-2000x2000-frame-{1..8}.png
  Trym's 2026 remasters: 2000x2000 RGBA, transparent background, pure palette,
  the same art as the 1999 GIF at exactly 4x the sheet's 13px pixel unit.
  Remaster frame N == sheet frame N-1 (verified by silhouette IoU 0.97-1.00).

This replaces the old forensics era (tools/clean-sprite-transparency.py, the
white-pixel saga): assets are now GENERATED from clean masters, never repaired.

Stages (run: python tools/build-banana-assets.py <stage> [--write]):
  analyze     print geometry/palette checks, write nothing
  sheet       banana-dance.png (469x498 x8 strip, aligned to the OLD sheet's
              per-frame bboxes so every engine anchor survives) -> bump ?v!
  downloads   dancing-banana-gif.gif, dancing-banana-transparent.gif,
              dancing-banana-transparent.png, banana-classic/handsup/strut.png,
              dancing-banana-hd.gif (1000x1000 from masters)
  all         everything above
Without --write, stages only report what they WOULD write (dry run).
"""
import os
import sys
import numpy as np
from PIL import Image

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(SITE, 'public', 'assets')
HIRES = os.path.join(ASSETS, 'dancing-banana-highres')
FW, FH, N = 469, 498, 8
SCALE = 4          # master pixel unit 52 = 4 x the sheet's 13
MW = MH = 2000

# the remaster's own palette (verified census) — never invent colours
PALETTE = [
    (0, 0, 0),        # outline
    (255, 255, 0),    # banana yellow
    (255, 255, 255),  # gloves/shoes/eyes
    (206, 206, 0),    # shade
    (255, 0, 0),      # mouth
    (156, 156, 0),    # deep shade
]
WHITE_BG = (255, 255, 255)


def load_master(n):
    """frame n (1-based) -> cleaned full-res RGBA numpy array (h, w, 4).
    Cleaning = threshold alpha at 128, snap every opaque pixel to the nearest
    palette colour (kills the ~1% anti-aliased edge the PS export left)."""
    p = os.path.join(HIRES, 'dancing-banana-2000x2000-frame-%d.png' % n)
    a = np.asarray(Image.open(p).convert('RGBA')).copy()
    opaque = a[..., 3] >= 128
    a[~opaque] = 0
    a[opaque, 3] = 255
    rgb = a[..., :3].astype(np.int32)
    pal = np.array(PALETTE, dtype=np.int32)                      # (P,3)
    d = ((rgb[..., None, :] - pal[None, None, :, :]) ** 2).sum(-1)  # (h,w,P)
    nearest = d.argmin(-1)
    snapped = pal[nearest].astype(np.uint8)
    a[..., :3] = np.where(opaque[..., None], snapped, 0)
    return a


def downscale_mode(a):
    """4x4-block majority downscale (2000 -> 500), transparency-aware.
    Majority vote kills any lingering 1px edge noise exactly."""
    h, w = a.shape[:2]
    hh, ww = h // SCALE, w // SCALE
    # encode each pixel as a small int: 0 = transparent, 1+i = palette i
    code = np.zeros((h, w), dtype=np.uint8)
    opaque = a[..., 3] == 255
    pal = np.array(PALETTE, dtype=np.uint8)
    for i, c in enumerate(PALETTE):
        m = opaque & (a[..., 0] == c[0]) & (a[..., 1] == c[1]) & (a[..., 2] == c[2])
        code[m] = i + 1
    blocks = code.reshape(hh, SCALE, ww, SCALE).transpose(0, 2, 1, 3).reshape(hh, ww, SCALE * SCALE)
    K = len(PALETTE) + 1
    counts = np.zeros((hh, ww, K), dtype=np.uint8)
    for k in range(K):
        counts[..., k] = (blocks == k).sum(-1)
    winner = counts.argmax(-1)
    out = np.zeros((hh, ww, 4), dtype=np.uint8)
    for i in range(len(PALETTE)):
        m = winner == i + 1
        out[m, :3] = pal[i]
        out[m, 3] = 255
    return out


def bbox_of(a):
    ys, xs = np.nonzero(a[..., 3])
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def old_sheet_frames():
    sheet = Image.open(os.path.join(ASSETS, 'banana-dance.png')).convert('RGBA')
    return [np.asarray(sheet.crop((i * FW, 0, (i + 1) * FW, FH))) for i in range(N)]


def build_sheet_frames():
    """new 469x498 frames, content aligned to the OLD frames' bboxes.

    The old sheet is itself a ~1.09x nearest upscale of the true art (its
    'pixel' runs are a 13/14/15px jitter). The engine's anchors, accessory
    grid and display sizes are all built on THAT geometry, so the sheet keeps
    it: the full-res master content is NEAREST-fitted straight into each old
    frame's bbox (pure downscale from 4x — no mush, palette-exact). Engine
    canvases render at <=200px, where the sub-pixel jitter is invisible.
    Downloads do NOT go through this — they use the true remaster grid."""
    old = old_sheet_frames()
    frames = []
    report = []
    for i in range(N):
        m = load_master(i + 1)
        nb = bbox_of(m)
        ob = bbox_of(old[i])
        nw, nh = (nb[2] - nb[0]) // SCALE, (nb[3] - nb[1]) // SCALE
        ow, oh = ob[2] - ob[0], ob[3] - ob[1]
        content = np.asarray(Image.fromarray(m[nb[1]:nb[3], nb[0]:nb[2]])
                             .resize((ow, oh), Image.NEAREST))
        f = np.zeros((FH, FW, 4), dtype=np.uint8)
        f[ob[1]:ob[1] + oh, ob[0]:ob[0] + ow] = content
        # silhouette agreement with the old frame (sanity, not perfection —
        # the remaster IS allowed to differ where the old sheet had dirt)
        inter = int(((f[..., 3] > 0) & (old[i][..., 3] > 0)).sum())
        union = int(((f[..., 3] > 0) | (old[i][..., 3] > 0)).sum())
        report.append('frame %d: true %dx%d -> legacy box %dx%d (x%.3f) IoU %.3f' % (
            i, nw, nh, ow, oh, ow / nw, inter / union))
        frames.append(f)
    return frames, report


def assert_clean(frames, label):
    """the invariants that ended the white-pixel saga, now enforced at birth:
    every pixel fully transparent or fully opaque + in palette."""
    for i, f in enumerate(frames):
        alphas = np.unique(f[..., 3])
        assert set(alphas.tolist()) <= {0, 255}, '%s f%d partial alpha' % (label, i)
        op = f[f[..., 3] == 255][:, :3]
        cols = {tuple(c) for c in np.unique(op.reshape(-1, 3), axis=0)}
        bad = cols - set(PALETTE)
        assert not bad, '%s f%d off-palette %s' % (label, i, bad)
    print(label, 'CLEAN: binary alpha, palette-exact')


def save_png(arr, path, write):
    if write:
        Image.fromarray(arr).save(path, optimize=True)
    print(('wrote ' if write else 'DRY: would write ') + os.path.relpath(path, SITE),
          arr.shape[1], 'x', arr.shape[0])


def to_gif_frames(arrs, bg=None):
    """RGBA arrays -> P-mode frames with a fixed palette.
    bg None = transparent GIF (index 0 reserved); else flat background."""
    pal_img = Image.new('P', (1, 1))
    if bg is None:
        table = [255, 0, 255] + [v for c in PALETTE for v in c]   # 0 = sentinel
    else:
        table = [v for v in bg] + [v for c in PALETTE for v in c]  # 0 = bg
    pal_img.putpalette(table + [0, 0, 0] * (256 - len(table) // 3))
    out = []
    for a in arrs:
        rgb = a[..., :3].copy()
        if bg is None:
            rgb[a[..., 3] == 0] = (255, 0, 255)   # sentinel -> index 0
        else:
            rgb[a[..., 3] == 0] = bg
        im = Image.fromarray(rgb).quantize(palette=pal_img, dither=Image.NONE)
        out.append(im)
    return out


def save_gif(arrs, path, write, transparent):
    frames = to_gif_frames(arrs, bg=None if transparent else WHITE_BG)
    if write:
        kw = dict(save_all=True, append_images=frames[1:], duration=100,
                  loop=0, optimize=False)
        if transparent:
            kw.update(transparency=0, disposal=2)
        frames[0].save(path, **kw)
        size = os.path.getsize(path)
    else:
        size = -1
    print(('wrote ' if write else 'DRY: would write ') + os.path.relpath(path, SITE),
          '(%d bytes)' % size)


def stage_analyze():
    frames, report = build_sheet_frames()
    for r in report:
        print(r)
    assert_clean(frames, 'sheet')
    # identify which sheet frame each legacy static PNG is
    for name in ['banana-classic.png', 'banana-handsup.png', 'banana-strut.png',
                 'dancing-banana-transparent.png']:
        a = np.asarray(Image.open(os.path.join(ASSETS, name)).convert('RGBA'))
        best = max(range(N), key=lambda j: int(((a[..., 3] > 0) & (frames[j][..., 3] > 0)).sum())
                   / max(1, int(((a[..., 3] > 0) | (frames[j][..., 3] > 0)).sum())))
        ab, fb = bbox_of(a), bbox_of(frames[best])
        print(name, '-> frame', best, 'bbox match', ab == fb)
    return frames


def stage_sheet(write):
    frames, report = build_sheet_frames()
    for r in report:
        print(r)
    assert_clean(frames, 'sheet')
    strip = np.concatenate(frames, axis=1)
    save_png(strip, os.path.join(ASSETS, 'banana-dance.png'), write)
    return frames


STATIC_POSES = {  # identified by analyze — which sheet frame each file shows
    'banana-classic.png': 0,
    'dancing-banana-transparent.png': 0,
    'banana-strut.png': 4,
    'banana-handsup.png': 2,
}


def true_frames():
    """the remaster's own even grid at 500x500 (exact 4x4-block majority
    downscale, 13px unit) — what 1:1-viewed downloads are built from."""
    return [downscale_mode(load_master(n)) for n in range(1, N + 1)]


def stage_downloads(write, frames=None):
    tf = true_frames()
    assert_clean(tf, 'downloads')
    # the classic downloads move to the TRUE grid: 500x500, even pixels —
    # the 469x498 files were a jittered 1.09x upscale of this same art
    save_gif(tf, os.path.join(ASSETS, 'dancing-banana-gif.gif'), write, transparent=False)
    save_gif(tf, os.path.join(ASSETS, 'dancing-banana-transparent.gif'), write, transparent=True)
    for name, idx in STATIC_POSES.items():
        save_png(tf[idx], os.path.join(ASSETS, name), write)
    # HD animated GIF straight from the masters (1000x1000 — the 52px unit is
    # even, so a ::2 sample is exact; half the payload of full 2000px)
    hd = [load_master(n)[::2, ::2] for n in range(1, N + 1)]
    save_gif(hd, os.path.join(ASSETS, 'dancing-banana-hd.gif'), write, transparent=True)


if __name__ == '__main__':
    stage = sys.argv[1] if len(sys.argv) > 1 else 'analyze'
    write = '--write' in sys.argv
    if stage == 'analyze':
        stage_analyze()
    elif stage == 'sheet':
        stage_sheet(write)
    elif stage == 'downloads':
        stage_downloads(write)
    elif stage == 'all':
        f = stage_sheet(write)
        stage_downloads(write, f)
    else:
        print('unknown stage', stage)
