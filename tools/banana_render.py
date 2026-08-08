# -*- coding: utf-8 -*-
"""🍌 THE BANANA, DRESSED, AT PRINT RESOLUTION.

A Python mirror of banana-engine.js `drawComposite`, so print art can put the
banana in the same outfits the site can. Everything that could drift is READ,
never retyped:

    FRAMES / SVG art / constants   regexed out of src/lib/banana-engine.js
    the wearable manifest          imported for real, via `node`

The banana itself comes from public/assets/banana-dance.png — the engine's own
sheet, 469x498 per frame, verified crisp (two alpha levels, six colours, hard
edges). Scaling it by an INTEGER with NEAREST is lossless, which is what makes
this print-safe. ⚠️ Never a non-integer factor: the "fat arms and legs" defect
was a 1.2x rescale of a 500px derivative.

Accessories are pixel SVGs on the banana's own 13px grid, so they rasterise
exactly at any scale — they are drawn as rectangles, not resampled.

    from banana_render import render
    render(2, {'hat': 'fishbowl', 'extras': ['boombox']}, scale=8)   # RGBA
"""
import json
import os
import re
import subprocess

from PIL import Image, ImageDraw

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENGINE = open(os.path.join(SITE, 'src', 'lib', 'banana-engine.js'), encoding='utf-8').read()

FW, FH, PX, NFRAMES = 469, 498, 13, 8
HAT_OVERLAP, SH_DY = 7.3, -0.5
FEET_CX, FEET_BOTTOM = 234, 501

# ---- read the engine ------------------------------------------------------

SVGS = dict(re.findall(r"(\w+): '(<svg[^']+</svg>)'", ENGINE))
# a couple of accessories are PNG art, not vectors (the plush is the ORIGINAL
# hands-up banana). Same `art:` namespace, different rasteriser.
PNGS = dict(re.findall(r"(\w+): '(/assets/[^']+\.png)'", ENGINE))
assert 'fishbowl' in SVGS and 'plushbanana' in PNGS, 'art parse drifted'

FRAMES = []
# every separator is \s* — the table is column-ALIGNED, so short values carry a
# second padding space ("face: 'left',  hands:") that a single literal space misses
for m in re.finditer(
        r'\{\s*eyeCx:\s*(\d+),\s*eyeCy:\s*(\d+),\s*hatCx:\s*(\d+),\s*btCx:\s*(\d+),\s*tipY:\s*(\d+),\s*'
        r"face:\s*'(\w+)',\s*hands:\s*\[\[(-?\d+),\s*(-?\d+)\],\s*\[(-?\d+),\s*(-?\d+)\]\],\s*"
        r'feetX:\s*\[(-?\d+),\s*(-?\d+)\]', ENGINE):
    g = m.groups()
    FRAMES.append(dict(eyeCx=int(g[0]), eyeCy=int(g[1]), hatCx=int(g[2]), btCx=int(g[3]),
                       tipY=int(g[4]), face=g[5],
                       hands=[[int(g[6]), int(g[7])], [int(g[8]), int(g[9])]],
                       feetX=[int(g[10]), int(g[11])]))
assert len(FRAMES) == NFRAMES, 'anchor parse drifted: %d frames' % len(FRAMES)

# ---- read the manifest (a real import — the entry shapes vary per slot) ----

_NODE = ("import { WEARABLE_PACKS } from './src/data/wearables.js';"
         'const all = Object.values(WEARABLE_PACKS)'
         '  .flatMap((p) => Object.values(p).flat())'
         '  .filter((x) => x && x.id);'
         'process.stdout.write(JSON.stringify(all));')
ITEMS = {d['id']: d for d in json.loads(subprocess.run(
    ['node', '--input-type=module', '-e', _NODE], cwd=SITE,
    capture_output=True, text=True, check=True).stdout)}
assert 'fishbowl' in ITEMS and 'boombox' in ITEMS, 'manifest import drifted'

HATS = {k: v for k, v in ITEMS.items() if 'seat' in v}
SHADES = {k: v for k, v in ITEMS.items() if 'front' in v and 'anchor' not in v}
EXTRAS = {k: v for k, v in ITEMS.items() if 'anchor' in v}

_SHEET = None


def sheet():
    global _SHEET
    if _SHEET is None:
        _SHEET = Image.open(os.path.join(SITE, 'public', 'assets', 'banana-dance.png')).convert('RGBA')
    return _SHEET


# ---- drawing --------------------------------------------------------------

def grid_w(key):
    return int(re.search(r'viewBox="0 0 (\d+)', SVGS[key]).group(1)) / 10


def grid_h(key):
    return int(re.search(r'viewBox="0 0 \d+ (\d+)', SVGS[key]).group(1)) / 10


def svg_layer(key, w, h, flip=False):
    """Rasterise a rect-grid SVG at exactly w*h. Rectangles, never a resample —
    that is why an accessory stays as crisp as the sprite at any print size."""
    im = Image.new('RGBA', (max(1, round(w)), max(1, round(h))), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    vb = re.search(r'viewBox="0 0 (\d+) (\d+)"', SVGS[key])
    sx, sy = im.width / int(vb.group(1)), im.height / int(vb.group(2))
    for r in re.finditer(r'<rect x="(-?\d+)" y="(-?\d+)" width="(\d+)" height="(\d+)" fill="([^"]+)"', SVGS[key]):
        x, y, w0, h0 = (int(r.group(i)) for i in range(1, 5))
        d.rectangle([round(x * sx), round(y * sy),
                     round((x + w0) * sx) - 1, round((y + h0) * sy) - 1], fill=r.group(5))
    return im.transpose(Image.FLIP_LEFT_RIGHT) if flip else im


def png_layer(key, h, flip=False):
    """A few accessories are PNGs, not vectors (the plush banana is the ORIGINAL
    hands-up art). NEAREST so they stay on-model."""
    im = Image.open(os.path.join(SITE, 'public', key.lstrip('/'))).convert('RGBA')
    w = round(h * im.width / im.height)
    im = im.resize((max(1, w), max(1, round(h))), Image.NEAREST)
    return im.transpose(Image.FLIP_LEFT_RIGHT) if flip else im


def _resolve_hands(extras):
    """Each glove carries at most one item, mirroring resolveHands: the item's
    preferred hand wins, a second item takes the other glove."""
    glove = {}
    for d in (EXTRAS[i] for i in extras if i in EXTRAS and EXTRAS[i].get('anchor') == 'hand'):
        pref = 'left' if d.get('hand') == 'left' else 'right'
        other = 'right' if pref == 'left' else 'left'
        if pref not in glove:
            glove[pref] = d
        elif other not in glove:
            glove[other] = d
    return glove


def render(idx, outfit=None, scale=8):
    """Frame `idx` wearing `outfit`, at `scale`x the engine's 469x498 space.
    Returns RGBA on transparency, uncropped (call .crop(im.getbbox())).

    outfit: {'hat': id, 'glasses': id, 'extras': [ids]}
    """
    o = outfit or {}
    extras = list(o.get('extras') or [])
    S = scale
    unit = PX * S
    F = FRAMES[idx]
    side = F['face'] != 'front'
    mirror = -1 if F['face'] == 'left' else 1

    # generous canvas: hats climb well above the frame and held items swing wide
    pad = round(FW * 0.55) * S
    W, H = FW * S + 2 * pad, FH * S + 2 * pad
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    fx = fy = pad

    def paste(layer, x, y):
        im.alpha_composite(layer, (round(x), round(y)))

    def acc(name, x, y, w, h, flip=False):
        """`name` is a manifest `art:` value — an SVG key or a PNG one."""
        paste(svg_layer(name, w, h, flip) if name in SVGS else png_layer(PNGS[name], h, flip), x, y)

    def draw_held(gside, d):
        hx, hy = F['hands'][0 if gside == 'left' else 1]
        if d['art'] not in SVGS:          # PNG art sizes off manifest `gh`, not a viewBox
            gh = (d.get('gh') or 24) * unit
            lay = png_layer(PNGS[d['art']], gh)
            paste(lay, fx + hx * S - lay.width / 2, fy + hy * S - d.get('grip', 0) * unit)
            return
        gw, gh = grid_w(d['art']) * unit, grid_h(d['art']) * unit
        acc(d['art'], fx + hx * S - gw / 2, fy + hy * S - d.get('grip', 0) * unit, gw, gh)

    def draw_hat(hd):
        turns = side and hd.get('side')
        art = hd['side'] if turns else hd['art']
        hw, hh = grid_w(art) * unit, grid_h(art) * unit
        seat_units = hd['sideSeat'] if (turns and hd.get('sideSeat') is not None) else hd.get('seat', 0)
        h_bottom = fy + F['tipY'] * S + (HAT_OVERLAP + seat_units) * unit
        acc(art, fx + F['hatCx'] * S - hw / 2, h_bottom - hh, hw, hh,
            bool(turns) and F['face'] == 'left')

    hat_def = HATS.get(o.get('hat'))
    hat_behind = bool(hat_def and hat_def.get('behindFront') and not side)
    glove = _resolve_hands(extras)

    # ---- BEHIND the body ----
    for gs in ('left', 'right'):
        if gs in glove and glove[gs].get('behind'):
            draw_held(gs, glove[gs])
    for i in extras:
        d = EXTRAS.get(i)
        if not d or not d.get('behind') or d.get('anchor') != 'chest':
            continue
        if d.get('sideOnly') and not side:
            continue
        bw, bh = grid_w(d['art']) * unit, grid_h(d['art']) * unit
        acc(d['art'], fx + F['btCx'] * S - bw / 2,
            fy + (F['eyeCy'] + d['dy'] * PX) * S - bh / 2, bw, bh, F['face'] == 'left')
    if hat_behind:
        draw_hat(hat_def)

    # ---- the banana ----
    frame = sheet().crop((idx * FW, 0, (idx + 1) * FW, FH))
    paste(frame.resize((FW * S, FH * S), Image.NEAREST), fx, fy)

    # ---- in FRONT ----
    if hat_def and not hat_behind:
        draw_hat(hat_def)
    sd = SHADES.get(o.get('glasses'))
    if sd:
        art = sd['side'] if side else sd['front']
        gw, gh = grid_w(art) * unit, grid_h(art) * unit
        acc(art, fx + F['eyeCx'] * S - gw / 2,
            fy + (F['eyeCy'] + SH_DY * PX) * S - gh / 2, gw, gh, F['face'] == 'left')

    feet_drawn = False
    for i in extras:
        d = EXTRAS.get(i)
        if not d or d.get('behind') or d.get('anchor') == 'hand':
            continue
        if d['anchor'] == 'feet' and feet_drawn:
            continue
        if d['anchor'] == 'face':
            art = d['side'] if side else d['front']
            mw, mh = grid_w(art) * unit, grid_h(art) * unit
            mx = fx + F['eyeCx'] * S + (mirror * d.get('sideDx', 0) * unit if side else 0)
            acc(art, mx - mw / 2, fy + (F['eyeCy'] + d['dy'] * PX) * S - mh / 2,
                mw, mh, F['face'] == 'left')
        elif d['anchor'] == 'feet':
            feet_drawn = True
            fw2, fh2 = grid_w(d['art']) * unit, grid_h(d['art']) * unit
            fby = fy + FEET_BOTTOM * S + d.get('dy', 0) * unit
            for fi, cxu in enumerate(F['feetX']):     # one shoe per foot, left mirrored
                fcx = fx + (cxu + d.get('dx', 0) * PX) * S
                acc(d['art'], fcx - fw2 / 2, fby - fh2, fw2, fh2, fi == 0)
        else:                                          # chest
            bw, bh = grid_w(d['art']) * unit, grid_h(d['art']) * unit
            acc(d['art'], fx + F['btCx'] * S - bw / 2,
                fy + (F['eyeCy'] + d['dy'] * PX) * S - bh / 2, bw, bh, F['face'] == 'left')

    for gs in ('left', 'right'):
        if gs in glove and not glove[gs].get('behind'):
            draw_held(gs, glove[gs])
    return im


def dressed(idx, outfit=None, scale=8):
    """render() cropped to its ink."""
    im = render(idx, outfit, scale)
    b = im.getbbox()
    return im.crop(b) if b else im


def one_ink(art, ink=(17, 17, 17, 255), cut=170):
    """Single colour, garment showing through. Threshold on LUMINANCE — going
    by alpha alone floods the eyes and the highlight and the mark stops
    reading as a banana (the v1 halftone mistake, same root cause).

    `cut` lowered to ~90 keeps ONLY what is already near-black. At full-body
    scale the default is right; on a face close-up it turns the red mouth into
    a solid slab, because a mouth that was six pixels is now a third of the
    design."""
    out = Image.new('RGBA', art.size, (0, 0, 0, 0))
    px, op = art.convert('RGBA').load(), out.load()
    for y in range(art.height):
        for x in range(art.width):
            r, g, b, a = px[x, y]
            if a > 90 and (0.299 * r + 0.587 * g + 0.114 * b) < cut:
                op[x, y] = ink
    return out


def pad_for(scale):
    """The transparent margin render() lays around the 469x498 frame. Callers
    that need an ANCHOR in canvas space (linking hands into a chain) compose
    with uncropped renders and offset by this."""
    return round(FW * 0.55) * scale
