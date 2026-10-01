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
import math
import os
import re
import subprocess
import sys

from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hands_rule import glove_of, resolve_hands   # ✋ one thing per glove: the engine's own rule (src/lib/hands.js)


def _r(v):
    """round-half-UP — the browser's convention at .5 ties. Python's round()
    half-EVENs, which let two adjacent accessories round a shared half-pixel
    in OPPOSITE directions — a 1px seam drawComposite never shows (the print-
    parity rig caught it: mustache tip vs shade rim on the front frames)."""
    return math.floor(v + 0.5)

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENGINE = open(os.path.join(SITE, 'src', 'lib', 'banana-engine.js'), encoding='utf-8').read()

FW, FH, PX, NFRAMES = 469, 498, 13, 8
HAT_OVERLAP, SH_DY = 7.3, -0.5
FEET_CX, FEET_BOTTOM = 234, 501

# ---- read the engine ------------------------------------------------------

# 🎨 the wearable art moved OUT of the engine on 19 Sep 2026: 195 804 B of inline <rect> SVG
# now ships packed (src/data/wearart.js, about 17 KB) and the readable source lives here, outside
# src/ so it is never bundled. This rig reads the SOURCE, so the Python compositor needs no
# decoder of its own and the two halves of the render cannot drift apart.
ART_SRC = open(os.path.join(SITE, 'tools', 'wearart-source.js'), encoding='utf-8').read()
SVGS = dict(re.findall(r"(\w+): '(<svg[^']+</svg>)'", ART_SRC))
# a couple of accessories are PNG art, not vectors (the plush is the ORIGINAL
# hands-up banana). Same `art:` namespace, different rasteriser.
PNGS = dict(re.findall(r"(\w+): '(/assets/[^']+\.png)'", ART_SRC))
assert 'fishbowl' in SVGS and 'plushbanana' in PNGS, 'art parse drifted'

# 🧶🕹🏘️ THE THREE PACKS THE ENGINE SPREADS IN FRONT OF IT (29 Sep 2026). banana-engine.js builds its art map as
# { ...KNIT_SVG, ...ARCADE_SVG, ...TOWN_SVG, ...the wearart } — the tailor's knitwear, the Arcade's prizes and the town's
# hand tools live in their own modules, two of them BUILT by JS helpers (no literal to regex). This mirror read only the
# wearart, so a winner in a wool scarf rendered as a bare banana on the front page (the render threw on 'woolscarf' and the
# bake fell back). They are imported for real, like the manifest, and the wearart still wins a clash, as in the engine.
_PACKS_NODE = ("import { KNIT_SVG } from './src/data/knitwear.js';"
               "import { ARCADE_SVG } from './src/data/arcadewear.js';"
               "import { TOWN_SVG } from './src/data/townwear.js';"
               'process.stdout.write(JSON.stringify({ ...KNIT_SVG, ...ARCADE_SVG, ...TOWN_SVG }));')
for _k, _v in json.loads(subprocess.run(['node', '--input-type=module', '-e', _PACKS_NODE], cwd=SITE,
                                        capture_output=True, text=True, check=True).stdout).items():
    SVGS.setdefault(_k, _v)
assert 'woolscarf' in SVGS and 'arcvisor' in SVGS, 'pack import drifted'

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

# member: (supporter) gear never reaches print output — this IS the compositor
# Printful's files come from, and nothing permanent may carry a revocable hat.
# BANANA_RENDER_MEMBER=1 lifts the gate for art review renders only.
if not os.environ.get('BANANA_RENDER_MEMBER'):
    ITEMS = {k: v for k, v in ITEMS.items() if 'member' not in v}

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

def _vb(svg, i):
    return int(re.search(r'viewBox="0 0 (\d+) (\d+)"', svg).group(i)) / 10


def grid_w(key):
    return _vb(SVGS[key], 1)


def grid_h(key):
    return _vb(SVGS[key], 2)


def _svg_raster(svg, w, h, flip=False):
    im = Image.new('RGBA', (max(1, _r(w)), max(1, _r(h))), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    vb = re.search(r'viewBox="0 0 (\d+) (\d+)"', svg)
    sx, sy = im.width / int(vb.group(1)), im.height / int(vb.group(2))
    for r in re.finditer(r'<rect x="(-?\d+)" y="(-?\d+)" width="(\d+)" height="(\d+)" fill="([^"]+)"', svg):
        x, y, w0, h0 = (int(r.group(i)) for i in range(1, 5))
        d.rectangle([_r(x * sx), _r(y * sy),
                     _r((x + w0) * sx) - 1, _r((y + h0) * sy) - 1], fill=r.group(5))
    return im.transpose(Image.FLIP_LEFT_RIGHT) if flip else im


def svg_layer(key, w, h, flip=False):
    """Rasterise a rect-grid SVG at exactly w*h. Rectangles, never a resample —
    that is why an accessory stays as crisp as the sprite at any print size."""
    return _svg_raster(SVGS[key], w, h, flip)


def wear_anchor(idx, kind, hand=None):
    """banana-engine.js wearAnchor — where a community item (the `custom` channel) hangs on frame `idx`."""
    F = FRAMES[idx] if 0 <= idx < len(FRAMES) else FRAMES[2]
    if kind == 'face':
        return F['eyeCx'], F['eyeCy']
    if kind in ('chest', 'body'):
        return F['btCx'], F['eyeCy']
    if kind == 'feet':
        return (F['feetX'][0] + F['feetX'][1]) / 2, FEET_BOTTOM
    if kind == 'hand':
        h = F['hands'][0] if hand == 'left' else F['hands'][1]
        return h[0], h[1]
    return F['hatCx'], F['tipY']   # head (default)


def png_layer(key, h, flip=False):
    """A few accessories are PNGs, not vectors (the plush banana is the ORIGINAL
    hands-up art). NEAREST so they stay on-model."""
    im = Image.open(os.path.join(SITE, 'public', key.lstrip('/'))).convert('RGBA')
    w = _r(h * im.width / im.height)
    im = im.resize((max(1, w), max(1, _r(h))), Image.NEAREST)
    return im.transpose(Image.FLIP_LEFT_RIGHT) if flip else im


def _resolve_hands(extras, customs=None):
    """Each glove carries ONE thing, whatever it is: tools/hands_rule.py, the engine's resolveHands. The game's items
    go in CATALOG order (EXTRAS is the manifest's order), never the outfit's own key order. Returns the game item per
    glove, and the community item per glove ('own')."""
    on = set(extras)
    r = resolve_hands([d for i, d in EXTRAS.items() if i in on and d.get('anchor') == 'hand'], customs)
    glove = {g: r[g] for g in ('left', 'right') if r[g]}
    glove['own'] = r['own']
    return glove


def render(idx, outfit=None, scale=8, lenient=False):
    """Frame `idx` wearing `outfit`, at `scale`x the engine's 469x498 space.
    Returns RGBA on transparency, uncropped (call .crop(im.getbbox())).

    outfit: {'hat': id, 'glasses': id, 'extras': [ids] or {id: on}, 'custom': [engine custom payloads]}
    `custom` is the engine's community-item channel ({art: svg, anchor, hand, ox, oy, scale, mirror}; build it with
    wear-render.js wearToCustom). `lenient` skips a piece with no art instead of raising — for a picture of a player
    (the citizens' frames), never for print, where a missing piece must stop the file.
    """
    o = outfit or {}
    ex = o.get('extras') or []
    # the site keeps extras as {id: true|false} (a switched-OFF item is still a key) — only the ones that are on
    extras = [k for k, v in ex.items() if v] if isinstance(ex, dict) else list(ex)
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
        im.alpha_composite(layer, (_r(x), _r(y)))

    def acc(name, x, y, w, h, flip=False):
        """`name` is a manifest `art:` value — an SVG key or a PNG one."""
        if lenient and name not in SVGS and name not in PNGS:
            print('  banana_render: no art for', name, '- left off')
            return
        paste(svg_layer(name, w, h, flip) if name in SVGS else png_layer(PNGS[name], h, flip), x, y)

    def draw_held(gside, d):
        hx, hy = F['hands'][0 if gside == 'left' else 1]
        if lenient and d['art'] not in SVGS and d['art'] not in PNGS:
            print('  banana_render: no art for', d['art'], '- left off')
            return
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
        if lenient and art not in SVGS and art not in PNGS:
            print('  banana_render: no art for', art, '- left off')
            return
        hw, hh = grid_w(art) * unit, grid_h(art) * unit
        seat_units = hd['sideSeat'] if (turns and hd.get('sideSeat') is not None) else hd.get('seat', 0)
        h_bottom = fy + F['tipY'] * S + (HAT_OVERLAP + seat_units) * unit
        acc(art, fx + F['hatCx'] * S - hw / 2, h_bottom - hh, hw, hh,
            bool(turns) and F['face'] == 'left')

    if lenient:   # a piece whose art this mirror cannot find is left off whole, before anything measures it
        def _has(d):
            return all(a in SVGS or a in PNGS for a in (d.get('art'), d.get('front'), d.get('side')) if a)
        for i in [i for i in extras if i in EXTRAS and not _has(EXTRAS[i])]:
            print('  banana_render: no art for', i, '- left off')
        extras = [i for i in extras if i not in EXTRAS or _has(EXTRAS[i])]
    hat_def = HATS.get(o.get('hat'))
    hat_behind = bool(hat_def and hat_def.get('behindFront') and not side)
    glove = _resolve_hands(extras, o.get('custom'))

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
    if sd and lenient and (sd['side'] if side else sd['front']) not in SVGS:
        print('  banana_render: no art for', o.get('glasses'), '- left off')
        sd = None
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
        else:                                          # chest — NEVER mirrored:
            # drawComposite draws front-pass chest garments unflipped on every
            # frame (only BEHIND-chest art mirrors). This mirrored them on
            # left frames until the print-parity rig caught the scarf printing
            # backwards on frames 4/5.
            bw, bh = grid_w(d['art']) * unit, grid_h(d['art']) * unit
            acc(d['art'], fx + F['btCx'] * S - bw / 2,
                fy + (F['eyeCy'] + d['dy'] * PX) * S - bh / 2, bw, bh, False)

    for gs in ('left', 'right'):
        if gs in glove and not glove[gs].get('behind'):
            draw_held(gs, glove[gs])

    # 🧢 COMMUNITY ITEMS — drawComposite's `custom` channel, the same maths: the item's top-left sits at the anchor plus the
    # offset captured when it was drawn (ox/oy in sprite units), scaled by `scale`; a turned-away frame mirrors it around the
    # anchor, and `mirror` (the opposite glove) cancels that out
    for c in (o.get('custom') or []):
        if (c or {}).get('anchor') == 'hand' and glove['own'][glove_of(c)] is not c:
            continue   # ✋ that glove already holds something
        svg = (c or {}).get('art') or ''
        if not svg.startswith('<svg') or 'viewBox="0 0 ' not in svg:
            continue
        s = c.get('scale') or 1
        cw, ch = _vb(svg, 1) * unit * s, _vb(svg, 2) * unit * s
        ax, ay = wear_anchor(idx, c.get('anchor'), c.get('hand'))
        flip = (F['face'] == 'left') != bool(c.get('mirror'))
        ox, oy = (c.get('ox') or 0) * unit, (c.get('oy') or 0) * unit
        px = fx + ax * S - (ox + cw) if flip else fx + ax * S + ox
        paste(_svg_raster(svg, cw, ch, flip), px, fy + ay * S + oy)
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
