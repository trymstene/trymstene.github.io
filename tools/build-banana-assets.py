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
    # HD animated GIF straight from the cleaned masters at FULL 2000x2000
    # (Trym's own PS export had grey AA edge colours — generated is pure)
    hd = [load_master(n) for n in range(1, N + 1)]
    save_gif(hd, os.path.join(ASSETS, 'dancing-banana-hd.gif'), write, transparent=True)
    # and the animated master in the highres folder gets the same clean bytes
    save_gif(hd, os.path.join(HIRES, 'dancing-banana-2000x2000-animated-transparent.gif'),
             write, transparent=True)


_TRUE_CACHE = None


def true_cached():
    global _TRUE_CACHE
    if _TRUE_CACHE is None:
        _TRUE_CACHE = true_frames()
    return _TRUE_CACHE


def render_true(idx, height):
    """true-grid frame idx rendered to `height` px tall (NEAREST, RGBA array)."""
    f = true_cached()[idx]
    b = bbox_of(f)
    content = Image.fromarray(f[b[1]:b[3], b[0]:b[2]])
    w = round(content.width * height / content.height)
    return np.asarray(content.resize((w, height), Image.NEAREST))


def paste_rgba(canvas, sprite, cx, cy):
    """paste sprite (RGBA array) onto canvas (PIL RGB) centred at cx, cy."""
    im = Image.fromarray(sprite)
    canvas.paste(im, (int(cx - im.width / 2), int(cy - im.height / 2)), im)


WALLPAPER_POSE = 2   # the arms-up frame every wallpaper/icon uses
CAPTION = 'the dancing banana · since 1999 · trymstene.com'
FONT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ArchivoBlack.ttf')


def stage_wallpapers(write):
    from PIL import ImageDraw, ImageFont
    WP = os.path.join(ASSETS, 'wallpapers')
    pose = WALLPAPER_POSE

    def rebuild_flat(name, size):
        """classic/ink: keep the design (flat bg, centred banana, caption),
        rebuild every layer clean — the caption gets re-set with the site's
        Archivo Black (also fixes the phone caption that overflowed)."""
        old = Image.open(os.path.join(WP, name)).convert('RGB')
        w, h = size
        bg = old.getpixel((4, 4))
        # measure the old banana: non-bg bbox in the upper 85% of the frame
        a = np.asarray(old)
        nonbg = (np.abs(a.astype(int) - np.array(bg)).sum(-1) > 30)
        nonbg[int(old.height * 0.87):] = False
        ys, xs = np.nonzero(nonbg)
        oldh = int(ys.max() - ys.min())
        cx, cy = int(xs.mean()), int((ys.min() + ys.max()) / 2)
        # scale positions if the output size differs from the old file's
        sx, sy = w / old.width, h / old.height
        canvas = Image.new('RGB', (w, h), bg)
        paste_rgba(canvas, render_true(pose, int(oldh * sy)), cx * sx, cy * sy)
        # caption: sample the old caption colour, re-set to fit 88% width
        cap_band = np.asarray(old)[int(old.height * 0.9):]
        cap_px = cap_band[(np.abs(cap_band.astype(int) - np.array(bg)).sum(-1) > 30)]
        cap_col = tuple(int(v) for v in cap_px.mean(0)) if len(cap_px) else (17, 17, 17)
        fs = int(h * 0.028)
        font = ImageFont.truetype(FONT, fs)
        d = ImageDraw.Draw(canvas)
        while d.textlength(CAPTION, font=font) > w * 0.88:
            fs -= 1
            font = ImageFont.truetype(FONT, fs)
        tw = d.textlength(CAPTION, font=font)
        d.text(((w - tw) / 2, h - int(h * 0.045) - fs), CAPTION, font=font, fill=cap_col)
        out = os.path.join(WP, name)
        if write:
            canvas.save(out, optimize=True)
        print(('wrote ' if write else 'DRY: ') + os.path.relpath(out, SITE), w, 'x', h)

    def rebuild_pattern(name, size):
        """tiled poses on flat yellow, staggered rows — rebuilt clean."""
        old = Image.open(os.path.join(WP, name)).convert('RGB')
        bg = old.getpixel((4, 4))
        w, h = size
        canvas = Image.new('RGB', (w, h), bg)
        sh = int(h * 0.16)                      # sprite height
        step_x, step_y = int(w * 0.104), int(h * 0.153)
        k = 0
        for row, y in enumerate(range(0, h + sh, step_y)):
            off = (step_x // 2) if row % 2 else 0
            for x in range(-step_x, w + step_x, step_x):
                paste_rgba(canvas, render_true(k % N, sh), x + off, y)
                k += 1
        out = os.path.join(WP, name)
        if write:
            canvas.save(out, optimize=True)
        print(('wrote ' if write else 'DRY: ') + os.path.relpath(out, SITE), w, 'x', h)

    for kind, size in [('desktop', (1920, 1080)), ('4k', (3840, 2160)), ('phone', (1080, 1920))]:
        rebuild_flat('dancing-banana-wallpaper-classic-%s.png' % kind, size)
        rebuild_flat('dancing-banana-wallpaper-ink-%s.png' % kind, size)
        rebuild_pattern('dancing-banana-wallpaper-pattern-%s.png' % kind, size)


def stage_emoji(write):
    """platform cuts from the masters: Discord/Slack want 128x128 (Slack caps
    at 128KB), Telegram stickers are 512x512. The crop is the UNION bbox of
    all 8 frames (a per-frame crop would make the banana jump), squared and
    padded ~4% so nothing touches the edge."""
    frames = [load_master(n) for n in range(1, N + 1)]
    x0 = min(bbox_of(f)[0] for f in frames)
    y0 = min(bbox_of(f)[1] for f in frames)
    x1 = max(bbox_of(f)[2] for f in frames)
    y1 = max(bbox_of(f)[3] for f in frames)
    side = max(x1 - x0, y1 - y0)
    pad = round(side * 0.04)
    side += 2 * pad
    cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
    left, top = cx - side // 2, cy - side // 2
    def cut(size):
        out = []
        for f in frames:
            sq = np.zeros((side, side, 4), dtype=np.uint8)
            sx0, sy0 = max(0, left), max(0, top)
            sx1, sy1 = min(MW, left + side), min(MH, top + side)
            sq[sy0 - top:sy1 - top, sx0 - left:sx1 - left] = f[sy0:sy1, sx0:sx1]
            out.append(np.asarray(Image.fromarray(sq).resize((size, size), Image.NEAREST)))
        return out
    save_gif(cut(128), os.path.join(ASSETS, 'dancing-banana-emoji-128.gif'), write, transparent=True)
    frames512 = cut(512)
    save_gif(frames512, os.path.join(ASSETS, 'dancing-banana-sticker-512.gif'), write, transparent=True)
    # Telegram STICKER PACKS (@Stickers bot) only take static 512x512 PNG/WEBP
    save_png(frames512[0], os.path.join(ASSETS, 'dancing-banana-sticker-512.png'), write)


def stage_icons(write):
    """apple-touch-icon: flat yellow, arms-up banana, 180x180 (the old one
    was an upscaled-sheet render). favicon.ico / the SVGs are hand-authored
    pixel icons, NOT sheet-derived — they stay."""
    old = Image.open(os.path.join(SITE, 'public', 'apple-touch-icon.png')).convert('RGB')
    bg = old.getpixel((2, 2))
    canvas = Image.new('RGB', (180, 180), bg)
    paste_rgba(canvas, render_true(WALLPAPER_POSE, 150), 90, 92)
    out = os.path.join(SITE, 'public', 'apple-touch-icon.png')
    if write:
        canvas.save(out, optimize=True)
    print(('wrote ' if write else 'DRY: ') + os.path.relpath(out, SITE))


if __name__ == '__main__':
    stage = sys.argv[1] if len(sys.argv) > 1 else 'analyze'
    write = '--write' in sys.argv
    if stage == 'analyze':
        stage_analyze()
    elif stage == 'sheet':
        stage_sheet(write)
    elif stage == 'downloads':
        stage_downloads(write)
    elif stage == 'wallpapers':
        stage_wallpapers(write)
    elif stage == 'icons':
        stage_icons(write)
    elif stage == 'emoji':
        stage_emoji(write)
    elif stage == 'all':
        f = stage_sheet(write)
        stage_downloads(write, f)
        stage_wallpapers(write)
        stage_icons(write)
        stage_emoji(write)
    else:
        print('unknown stage', stage)
