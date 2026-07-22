# -*- coding: utf-8 -*-
"""🧱 BLOCKIFY — turn bought pixel-art sprites into OUR chunky banana-world style.

The bridge between the LimeZu Modern Exteriors pack (fine 48px-grid art with
soft shading and anti-aliased edges) and Banana World (chunky blocks, hard ink
outlines, punchy flat colour). Reads from the pack in OneDrive, never from the
repo, and writes derivatives into public/assets/.

⚠️ LICENSE: raw pack files stay in OneDrive and are NEVER committed. Only these
transformed derivatives ship, used as game art — which is what the pack is for.

The pipeline, per sprite:
  1. trim transparent margin
  2. area-average downsample by an integer factor (alpha-weighted, so soft
     edges collapse into solid blocks instead of muddy fringes)
  3. alpha threshold → a hard silhouette, no semi-transparent halo
  4. quantise to a handful of colours (adaptive), then punch saturation and
     contrast so it reads at banana-world's flatness
  5. optional warm shift toward our golden-hour palette
  6. add a 1px INK outline around the silhouette — our signature

Usage (as a library):
    from blockify import load_pack, blockify
    im = load_pack('21_Beach_48x48_Palm_Tree.png')
    small = blockify(im, factor=4, colors=6)
"""
import os
from PIL import Image, ImageEnhance

PACK_ROOT = os.path.expanduser(r'~\OneDrive\banana-art-pack\Modern_Exteriors_48x48')
INK = (17, 17, 17, 255)

_index = None


def _build_index():
    global _index
    _index = {}
    for dp, _, fns in os.walk(PACK_ROOT):
        for fn in fns:
            if fn.lower().endswith('.png'):
                _index.setdefault(fn, os.path.join(dp, fn))
    return _index


def load_pack(name):
    """find a sprite anywhere in the pack by filename"""
    idx = _index or _build_index()
    p = idx.get(name)
    if not p:
        raise FileNotFoundError(name + ' not in ' + PACK_ROOT)
    return Image.open(p).convert('RGBA')


def _downsample(img, factor, alpha_thresh):
    w, h = img.size
    nw, nh = max(1, round(w / factor)), max(1, round(h / factor))
    out = Image.new('RGBA', (nw, nh), (0, 0, 0, 0))
    src = img.load()
    dst = out.load()
    for by in range(nh):
        for bx in range(nw):
            ar = ag = ab = aa = 0
            n = 0
            for sy in range(by * factor, min(h, (by + 1) * factor)):
                for sx in range(bx * factor, min(w, (bx + 1) * factor)):
                    r, g, b, a = src[sx, sy]
                    n += 1
                    if a:
                        ar += r * a; ag += g * a; ab += b * a; aa += a
            if n and aa and (aa / (255.0 * n)) >= alpha_thresh:
                dst[bx, by] = (ar // aa, ag // aa, ab // aa, 255)
    return out


def _quantise(img, colors):
    """flatten to N colours — the pack's gradients become readable steps"""
    rgb = Image.new('RGB', img.size, (0, 0, 0))
    rgb.paste(img, mask=img.split()[3])
    q = rgb.quantize(colors=colors, method=Image.MEDIANCUT).convert('RGB')
    out = Image.new('RGBA', img.size, (0, 0, 0, 0))
    out.paste(q, mask=img.split()[3])
    return out


def _punch(img, sat=1.35, con=1.18):
    rgb = img.convert('RGB')
    rgb = ImageEnhance.Color(rgb).enhance(sat)
    rgb = ImageEnhance.Contrast(rgb).enhance(con)
    out = Image.new('RGBA', img.size, (0, 0, 0, 0))
    out.paste(rgb, mask=img.split()[3])
    return out


def _warm(img, amount):
    """nudge toward golden hour so everything shares one light"""
    if amount <= 0:
        return img
    px = img.load()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = px[x, y]
            if not a:
                continue
            px[x, y] = (min(255, int(r + 18 * amount)),
                        min(255, int(g + 6 * amount)),
                        max(0, int(b - 14 * amount)), a)
    return img


def _outline(img, ink=INK):
    out = Image.new('RGBA', (img.width + 2, img.height + 2), (0, 0, 0, 0))
    out.paste(img, (1, 1))
    src = out.load()
    edges = []
    for y in range(out.height):
        for x in range(out.width):
            if src[x, y][3]:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < out.width and 0 <= ny < out.height and src[nx, ny][3] > 0:
                    edges.append((x, y))
                    break
    for x, y in edges:
        src[x, y] = ink
    return out


def blockify(img, factor=4, colors=6, alpha_thresh=0.45, sat=1.35, con=1.18,
             warm=0.0, outline=True, trim=True):
    """the whole pipeline — a pack sprite in, a banana-world sprite out.

    ⚠️ trim=False is MANDATORY for ANIMATION FRAMES. Trimming crops each frame
    to its own bounding box, so a walk cycle (whose silhouette changes every
    frame as legs move) gets re-centred by a different amount each time and
    the sprite creeps around inside its own box while playing."""
    if trim:
        bbox = img.getbbox()
        if bbox:
            img = img.crop(bbox)
    small = _downsample(img, factor, alpha_thresh)
    small = _quantise(small, colors)
    small = _punch(small, sat, con)
    small = _warm(small, warm)
    return _outline(small) if outline else small
