# -*- coding: utf-8 -*-
"""🎨 MOTIFS — print-ready artwork, no product in mind.

build-shop-art.py makes ONE mark in four treatments, sized to specific slate
products. This makes MOTIFS: standalone designs at print resolution on
transparency, for Trym to place on whatever he likes.

    python tools/build-shop-motifs.py            write print-files/motifs/
    python tools/build-shop-motifs.py --only ring,face

Every file is RGBA with a fully transparent ground — no background colour
anywhere, so the garment or paper shows through.

The four families:

    CHARACTER   the banana in an outfit, full colour, full body
    CLOSE-UP    cropped hard to the face — the graphic nobody has seen big
    CROWD       many bananas: the cycle as a ring, a wave, a stack, a swarm
    EMBLEM      badge, numerals, sunburst — the marks that carry type

⚠️ Pixel scale is always an INTEGER. Every banana is drawn at the largest whole
multiple that fits its slot and then LEFT ALONE — a motif is composed by moving
crisp pieces around, never by resampling one.
"""
import math
import os
import sys

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from banana_render import FH, FRAMES, FW, one_ink, pad_for, render  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
OUT = os.path.join(REPO, 'print-files', 'motifs')
FONT = os.path.join(HERE, 'ArchivoBlack.ttf')
INK, WHITE = (17, 17, 17, 255), (255, 255, 255, 255)
o = lambda s: sys.stdout.buffer.write((s + '\n').encode('utf-8', 'replace'))

_CACHE = {}


def banana(idx, outfit=None, scale=4):
    """A cropped, crisp banana. Cached — the crowd motifs reuse heavily."""
    key = (idx, repr(outfit), scale)
    if key not in _CACHE:
        im = render(idx, outfit, scale)
        b = im.getbbox()
        _CACHE[key] = im.crop(b) if b else im
    return _CACHE[key]


def canvas(w, h):
    return Image.new('RGBA', (int(w), int(h)), (0, 0, 0, 0))


def place(dst, src, cx, cy):
    """Composite `src` centred on (cx, cy)."""
    dst.alpha_composite(src, (int(cx - src.width / 2), int(cy - src.height / 2)))


def trimmed(im, margin=0):
    b = im.getbbox()
    if not b:
        return im
    im = im.crop(b)
    if not margin:
        return im
    c = canvas(im.width + 2 * margin, im.height + 2 * margin)
    c.alpha_composite(im, (margin, margin))
    return c


# ---- CHARACTER ------------------------------------------------------------
# Frames 0/1 face right and 4/5 face left, so picking the frame IS picking the
# camera angle — a 3/4 view without ever rotating a pixel.

CHARACTERS = [
    ('fishbowl',  2, dict(hat='fishbowl')),
    ('dj',        2, dict(hat='djheadphones', extras=['vinyl', 'ledsneakers'])),
    ('captain',   4, dict(hat='tricorn', glasses='eyepatch', extras=['bigfish'])),
    ('party',     2, dict(hat='party', glasses='hearts', extras=['balloons'])),
    ('coolside',  1, dict(glasses='dwi', extras=['goldchain', 'boombox'])),
    ('king',      2, dict(hat='crown', extras=['goldbanana'])),
    ('duck',      6, dict(hat='duckhat', extras=['flamekicks'])),
    # ⛔ CUT: snorkel mask + life ring + flippers. Three loud shapes over one
    # small body and none of them read — a wearable motif needs ONE loud idea
    # and quiet everywhere else, which is why the fishbowl works alone.
]


def m_character(idx, outfit):
    return trimmed(banana(idx, outfit, 9))


# ---- CLOSE-UP -------------------------------------------------------------
# Frame 7's arms hang below the eyeline, so a tight head crop keeps no severed
# arm stub floating at the edge (frame 2's arms cut straight through it).

def m_face(idx=7, half_w=118, up=95, down=150, scale=10):
    im = render(idx, {}, scale)
    F, pad = FRAMES[idx], pad_for(scale)
    cx, cy = pad + F['eyeCx'] * scale, pad + F['eyeCy'] * scale
    return im.crop((int(cx - half_w * scale), int(cy - up * scale),
                    int(cx + half_w * scale), int(cy + down * scale)))


# ---- CROWD ----------------------------------------------------------------

def m_ring(scale=3, gap=1.10):
    """One full dance cycle laid around a circle — eight frames, so the loop
    reads as a rotation rather than eight copies of a pose."""
    b = [banana(i, None, scale) for i in range(8)]
    bw, bh = max(x.width for x in b), max(x.height for x in b)
    r = gap * bw * 8 / (2 * math.pi) + bh * 0.30
    size = 2 * r + bh * 1.15
    c = canvas(size, size)
    for i, im in enumerate(b):
        a = -math.pi / 2 + i * 2 * math.pi / 8
        place(c, im, size / 2 + r * math.cos(a), size / 2 + r * math.sin(a))
    return trimmed(c)


def m_wave(scale=4, amp=0.20, overlap=0.86):
    """The cycle in a line, riding a sine — a long, low motif for a sleeve, a
    mug wrap or a bumper sticker, where a square design has nowhere to go."""
    b = [banana(i, None, scale) for i in range(8)]
    bw, bh = max(x.width for x in b), max(x.height for x in b)
    step = bw * overlap
    c = canvas(step * 8 + bw, bh * (1 + 2 * amp))
    for i, im in enumerate(b):
        place(c, im, bw / 2 + i * step,
              c.height / 2 + math.sin(i / 8 * 2 * math.pi) * bh * amp)
    return trimmed(c)


def m_totem(scale=5, n=4, overlap=0.90):
    """Tall and narrow: the shape a poster, a banner or a long tee print wants
    and the square treatments cannot fill."""
    b = [banana(i * 2, None, scale) for i in range(n)]
    bw, bh = max(x.width for x in b), max(x.height for x in b)
    step = bh * overlap
    c = canvas(bw * 1.1, step * n + bh * 0.15)
    for i, im in enumerate(b):
        place(c, im, c.width / 2, bh / 2 + i * step)
    return trimmed(c)


def m_crowd():
    """One banana front and centre, the floor packed in behind it. Depth by
    SIZE only — smaller reads as further, and the sprite never has to shrink
    off its own pixel grid because each rank gets its own whole scale.

    ⚠️ Ranks are placed by ANGLE around the hero, not on a grid. The first
    version scattered them across a 15,900px field and the hero stopped being
    the hero — a crowd has to CLUSTER or it is just a sparse pattern."""
    big = banana(2, None, 8)
    w, h = big.width, big.height
    c = canvas(w * 3.05, h * 1.95)
    ox, oy = c.width / 2, c.height * 0.60
    ranks = [(3, 9, 1.16, -0.16), (5, 5, 0.80, 0.05)]   # scale, n, radius, y-bias
    seq = 0
    for scale, n, rad, bias in ranks:                    # far rank first
        for k in range(n):
            a = math.pi + (k + 0.5) * math.pi / n        # a shallow arc BEHIND, not a ring
            place(c, banana(seq % 8, None, scale),
                  ox + math.cos(a) * w * rad * 1.28,
                  oy + math.sin(a) * h * rad * 0.42 + bias * h)
            seq += 1
    place(c, big, ox, oy)
    return trimmed(c)


def m_chain(n=5, scale=5):
    """Hands linked, the way THE CHAIN forms on the rave floor. Composed from
    UNCROPPED renders so each banana's glove anchor is still in canvas space —
    the join is exact, not eyeballed."""
    order = [2, 6] * ((n + 1) // 2)
    pad = pad_for(scale)
    xs, x = [0], 0
    for i in range(n - 1):
        x += (FRAMES[order[i]]['hands'][1][0] - FRAMES[order[i + 1]]['hands'][0][0]) * scale
        xs.append(x)
    c = canvas(x + FW * scale + 2 * pad, FH * scale + 2 * pad)
    for i in range(n):
        c.alpha_composite(render(order[i], {}, scale), (int(xs[i]), 0))
    return trimmed(c)


def m_highfive(scale=8):
    """Two bananas meeting in the middle. Frames 0 and 4 are the sheet's own
    mirrored pair, so this is a real facing couple, not one sprite flipped."""
    pad = pad_for(scale)
    dx = (FRAMES[0]['hands'][1][0] - FRAMES[4]['hands'][0][0]) * scale
    c = canvas(dx + FW * scale + 2 * pad, FH * scale + 2 * pad)
    c.alpha_composite(render(0, {}, scale), (0, 0))
    c.alpha_composite(render(4, {}, scale), (int(dx), 0))
    return trimmed(c)


def m_heart(n=30, scale=3):
    """The cast arranged into a heart. The one motif that is a SHAPE first and
    a character second — it reads from a distance at which every other design
    here is still just a yellow smudge."""
    b = [banana(i, None, scale) for i in range(8)]
    bw, bh = max(x.width for x in b), max(x.height for x in b)
    pts = []
    for k in range(n):
        t = k * 2 * math.pi / n
        pts.append((16 * math.sin(t) ** 3,
                    -(13 * math.cos(t) - 5 * math.cos(2 * t)
                      - 2 * math.cos(3 * t) - math.cos(4 * t))))
    k = bw * n / 128.0                                 # spacing scales with the cast size
    c = canvas(34 * k + bw * 1.2, 30 * k + bh * 1.2)
    for i, (x, y) in enumerate(pts):
        place(c, b[i % 8], c.width / 2 + x * k, c.height / 2 + y * k)
    return trimmed(c)


def m_filmstrip(scale=4, ink=INK):
    """The eight frames as a strip of film. Says what the thing IS — a hand-
    drawn 8-frame loop from 1999 — without a word of copy."""
    b = [banana(i, None, scale) for i in range(8)]
    cw = int(max(x.width for x in b) * 1.22)
    ch = int(max(x.height for x in b) * 1.12)
    band = int(ch * 0.20)                              # the sprocket rails
    gut = int(cw * 0.045)
    c = canvas(cw * 8 + gut * 9, ch + band * 2)
    d = ImageDraw.Draw(c)
    d.rectangle([0, 0, c.width - 1, c.height - 1], fill=ink)
    hole_w, hole_h = int(cw * 0.20), int(band * 0.44)
    for i in range(8):
        x0 = gut + i * (cw + gut)
        d.rectangle([x0, band, x0 + cw - 1, band + ch - 1], fill=(0, 0, 0, 0))
        place(c, b[i], x0 + cw / 2, band + ch / 2)
        for by in (band * 0.28, c.height - band * 0.72):
            d.rounded_rectangle([x0 + cw * 0.30, by, x0 + cw * 0.30 + hole_w, by + hole_h],
                                radius=hole_h * 0.28, fill=(0, 0, 0, 0))
    return c


def m_swarm(cols=7, rows=7, scale=2, jitter=0.16):
    """A dense field of the whole cast. Not a seamless tile — a finite scatter
    with a ragged edge, which is what a chest print wants; the seamless tile in
    build-shop-art.py is the one for cut-sew wraps."""
    b = [banana(i, None, scale) for i in range(8)]
    bw, bh = max(x.width for x in b), max(x.height for x in b)
    stepx, stepy = bw * 1.16, bh * 1.10
    c = canvas(stepx * cols + bw, stepy * rows + bh)
    n = 0
    for r in range(rows):
        for q in range(cols):
            im = b[(q * 3 + r * 5) % 8]              # coprime strides = no visible run
            jx = ((n * 37) % 21 / 20 - 0.5) * 2 * jitter * bw
            jy = ((n * 53) % 17 / 16 - 0.5) * 2 * jitter * bh
            n += 1
            place(c, im, bw / 2 + q * stepx + jx + (stepx / 2 if r % 2 else 0),
                  bh / 2 + r * stepy + jy)
    return trimmed(c)


# ---- EMBLEM ---------------------------------------------------------------

def arc_text(c, text, cx, cy, r, size, fill, start=-90, flip=False, spread=None):
    """Set `text` around a circle, one glyph at a time. PIL cannot curve a
    string, and a pre-rotated word block would shear the letters.

    ⚠️ The bottom arc reads right-to-left in canvas angles, so its glyphs go on
    REVERSED. Rotating each glyph upright without also reversing the string set
    the first seal's rim to "9991 ECNIS"."""
    if flip:
        text = text[::-1]
    f = ImageFont.truetype(FONT, size)
    widths = [ImageDraw.Draw(c).textlength(ch, font=f) for ch in text]
    total = sum(widths)
    span = spread if spread is not None else math.degrees(total / r)
    a = start - span / 2
    for ch, w in zip(text, widths):
        step = span * w / total
        g = Image.new('RGBA', (int(size * 1.6), int(size * 1.9)), (0, 0, 0, 0))
        ImageDraw.Draw(g).text((g.width / 2, g.height / 2), ch, font=f, fill=fill, anchor='mm')
        ang = a + step / 2
        g = g.rotate(-(ang + 90) if not flip else -(ang - 90), resample=Image.BICUBIC, expand=True)
        t = math.radians(ang)
        place(c, g, cx + r * math.cos(t), cy + r * math.sin(t))
        a += step


def m_seal(ink=INK, scale=6):
    """The badge: banana in a ruled circle, the story set around the rim. The
    one motif that says WHO MADE IT without a separate line of copy."""
    b = banana(2, None, scale)
    r_in = max(b.width, b.height) * 0.62
    ring = r_in * 1.30
    size = int(ring * 2 + r_in * 0.62)
    c = canvas(size, size)
    d = ImageDraw.Draw(c)
    cx = cy = size / 2
    lw = max(4, int(size * 0.011))
    d.ellipse([cx - ring, cy - ring, cx + ring, cy + ring], outline=ink, width=lw * 2)
    d.ellipse([cx - r_in * 1.05, cy - r_in * 1.05, cx + r_in * 1.05, cy + r_in * 1.05],
              outline=ink, width=lw)
    place(c, b, cx, cy + r_in * 0.04)
    t = int(size * 0.052)
    arc_text(c, 'THE ORIGINAL DANCING BANANA', cx, cy, ring * 0.86, t, ink, start=-90, spread=200)
    arc_text(c, 'SINCE 1999', cx, cy, ring * 0.86, t, ink, start=90, flip=True, spread=90)
    for s in (-1, 1):                                # the two rim stars that close the ring
        d.regular_polygon((cx + s * ring * 0.86, cy, t * 0.34), 4, rotation=0, fill=ink)
    return trimmed(c)


def m_est(ink=INK, scale=6):
    """Numerals doing the work, the banana as punctuation. The one motif that
    reads from across a room."""
    b = banana(2, None, scale)
    f = ImageFont.truetype(FONT, int(b.height * 0.86))
    probe = ImageDraw.Draw(canvas(1, 1))
    tw = probe.textlength('1999', font=f)
    gap = b.width * 0.24
    c = canvas(tw + b.width + gap * 2, b.height * 1.25)
    ImageDraw.Draw(c).text((0, c.height / 2), '1999', font=f, fill=ink, anchor='lm')
    place(c, b, tw + gap + b.width / 2, c.height / 2)
    sub = ImageFont.truetype(FONT, int(b.height * 0.115))
    d = ImageDraw.Draw(c)
    sw = d.textlength('THE ORIGINAL DANCING BANANA', font=sub)
    d.text(((tw - sw) / 2, c.height / 2 + b.height * 0.47),
           'THE ORIGINAL DANCING BANANA', font=sub, fill=ink, anchor='lm')
    return trimmed(c)


def m_sunburst(rays=24, ink=INK, scale=7):
    """Rays behind the character — the oldest sticker composition there is, and
    the only motif here that fills a circle edge to edge."""
    b = banana(2, None, scale)
    r = max(b.width, b.height) * 1.30
    size = int(r * 2)
    c = canvas(size, size)
    d = ImageDraw.Draw(c)
    cx = cy = size / 2
    for i in range(rays):
        if i % 2:
            continue
        a0 = i * 360 / rays
        a1 = a0 + 360 / rays
        pts = [(cx, cy)] + [(cx + r * 1.5 * math.cos(math.radians(a)),
                             cy + r * 1.5 * math.sin(math.radians(a)))
                            for a in (a0, (a0 + a1) / 2, a1)]
        d.polygon(pts, fill=ink)
    mask = canvas(size, size)
    ImageDraw.Draw(mask).ellipse([0, 0, size - 1, size - 1], fill=(255, 255, 255, 255))
    c.putalpha(Image.composite(c.getchannel('A'), Image.new('L', (size, size), 0),
                               mask.getchannel('A')))
    place(c, b, cx, cy)
    return trimmed(c)


# ---- NECK LABELS ----------------------------------------------------------
# The "official, not RedBubble" signal, and it is NOT a second front print.
# Printful sells `label_inside` at +$0.99 and `label_outside` at +$2.49 on every
# DTG garment in the slate — against +$5.95 for a back print. See §THE OFFICIAL
# STAMP in the shop-design-direction memory for the full comparison.
#
# These are drawn for a ~2.5-3in tag, so the type is CHUNKY on purpose: a label
# that needs a squint is worse than no label. Black for light garments, white
# for dark; nothing here depends on colour.

def _fit_line(d, text, font_path, target_w, start):
    """Largest size at which `text` fits `target_w`. A neck label has a fixed
    width and variable copy — sizing by eye guarantees one line overhangs."""
    sz = start
    while sz > 8 and d.textlength(text, font=ImageFont.truetype(font_path, sz)) > target_w:
        sz -= 2
    return ImageFont.truetype(font_path, sz)


def l_stamp(ink=INK, scale=4):
    """The seal, reduced to what survives at neck size: OFFICIAL over the top,
    the domain under it, and nothing else."""
    b = banana(2, None, scale)
    r_in = max(b.width, b.height) * 0.60
    ring = r_in * 1.34
    size = int(ring * 2 + r_in * 0.30)
    c = canvas(size, size)
    d = ImageDraw.Draw(c)
    cx = cy = size / 2
    lw = max(3, int(size * 0.016))
    d.ellipse([cx - ring, cy - ring, cx + ring, cy + ring], outline=ink, width=lw * 2)
    place(c, b, cx, cy + r_in * 0.06)
    t = int(size * 0.088)
    arc_text(c, 'OFFICIAL', cx, cy, ring * 0.80, t, ink, start=-90, spread=104)
    arc_text(c, 'TRYMSTENE.COM', cx, cy, ring * 0.80, int(t * 0.72), ink, start=90, flip=True, spread=112)
    return trimmed(c)


def l_tag(ink=INK, scale=3):
    """Woven-tag proportions: mark on the left, three short lines on the right.
    The shape a real garment label is, so it reads as one at a glance."""
    b = banana(2, None, scale)
    gap = int(b.width * 0.38)
    lines = [('THE ORIGINAL', 0.30), ('DANCING BANANA', 0.46), ('TRYMSTENE.COM · 1999', 0.24)]
    tw = int(b.width * 3.5)
    c = canvas(b.width + gap * 2 + tw, b.height * 1.16)
    d = ImageDraw.Draw(c)
    place(c, b, b.width / 2 + gap * 0.4, c.height / 2)
    fonts = [(s, _fit_line(d, s, FONT, tw, int(b.height * k * 0.5))) for s, k in lines]
    total = sum(f.size * 1.22 for _, f in fonts)
    y = c.height / 2 - total / 2
    for s, f in fonts:
        d.text((b.width + gap * 1.4, y), s, font=f, fill=ink)
        y += f.size * 1.22
    return trimmed(c)


def l_stack(ink=INK, scale=3):
    """Centred and vertical — the layout that survives being printed small and
    slightly crooked, because nothing has to line up with anything."""
    b = banana(2, None, scale)
    w = int(b.width * 3.2)
    c = canvas(w, b.height * 2.2)
    d = ImageDraw.Draw(c)
    place(c, b, w / 2, b.height * 0.60)
    y = b.height * 1.16
    rule_w = w * 0.72
    d.rectangle([(w - rule_w) / 2, y, (w + rule_w) / 2, y + max(3, w * 0.010)], fill=ink)
    y += b.height * 0.13
    for s, k in [('OFFICIAL DANCING BANANA', 0.115), ('TRYMSTENE.COM', 0.098), ('SINCE 1999', 0.082)]:
        f = _fit_line(d, s, FONT, rule_w, int(b.height * k))
        d.text((w / 2, y), s, font=f, fill=ink, anchor='ma')
        y += f.size * 1.42
    return trimmed(c)


LABELS = [('stamp', l_stamp), ('tag', l_tag), ('stack', l_stack)]


# ---- the set --------------------------------------------------------------
# `inks` lists the one-ink variants to emit beside the colour file. A motif that
# depends on colour to be legible (the goldfish, the vinyl label) gets none.

MOTIFS = [(name, (lambda i=idx, o2=out: m_character(i, o2)), ()) for name, idx, out in CHARACTERS] + [
    ('face',      m_face,      ('black', 'white')),
    ('ring',      m_ring,      ('black', 'white')),
    ('wave',      m_wave,      ('black', 'white')),
    ('totem',     m_totem,     ('black', 'white')),
    ('crowd',     m_crowd,     ('black',)),
    ('swarm',     m_swarm,     ('black', 'white')),
    ('chain',     m_chain,     ('black', 'white')),
    ('highfive',  m_highfive,  ('black', 'white')),
    ('heart',     m_heart,     ('black', 'white')),
    ('filmstrip', m_filmstrip, ('white',)),
    ('seal',      m_seal,      ('white',)),
    ('est1999',   m_est,       ('white',)),
    ('sunburst',  m_sunburst,  ('white',)),
]

# these DRAW their ink, so a white variant must be re-rendered, not recoloured —
# one_ink would flatten the banana into the ring / the strip
REDRAW = {'seal': m_seal, 'est1999': m_est, 'sunburst': m_sunburst, 'filmstrip': m_filmstrip}
# The palette is six colours: black 0, red 76, dark-yellow 138, mid 183,
# yellow 226, white 255. The shipped one-ink treatment cuts at 170, which inks
# black + red + the shadow side — right for a whole body. The close-up's mouth
# is a third of the design, so it cuts BELOW red at 50 and inks the outline only.
INK_CUT = {'face': 50}


def main():
    only = None
    for i, a in enumerate(sys.argv):
        if a == '--only' and i + 1 < len(sys.argv):
            only = set(sys.argv[i + 1].split(','))
    os.makedirs(OUT, exist_ok=True)
    made = []
    for name, fn, inks in MOTIFS:
        if only and name not in only:
            continue
        base = fn()
        made.append((name, base))
        for tone in inks:
            colour = WHITE if tone == 'white' else INK
            im = (REDRAW[name](ink=colour) if name in REDRAW
                  else one_ink(base, colour, INK_CUT.get(name, 170)))
            made.append((name + '-ink-' + tone, im))
    labels = []
    for name, fn in LABELS:
        if only and name not in only:
            continue
        for tone, colour in (('black', INK), ('white', WHITE)):
            labels.append((name + '-' + tone, fn(ink=colour)))
    for n, im in made:
        p = os.path.join(OUT, 'motif-' + n + '.png')
        im.save(p, optimize=True)
        o('  %-26s %5dx%-5d %6d KB' % (n, im.width, im.height, os.path.getsize(p) // 1024))
    for n, im in labels:
        p = os.path.join(OUT, 'label-' + n + '.png')
        im.save(p, optimize=True)
        o('  label-%-20s %5dx%-5d %6d KB' % (n, im.width, im.height, os.path.getsize(p) // 1024))
    contact(made + labels)
    index(made, labels)
    o('%d files -> %s' % (len(made), os.path.relpath(OUT, REPO)))


BLURBS = {
    'fishbowl': 'Goldfish helmet. One loud idea, quiet everywhere else.',
    'dj': 'Headphones, a record, LED sneakers — the rave in one figure.',
    'captain': 'Tricorn, eyepatch, a fish bigger than he is. A 3/4 angle.',
    'party': 'Party hat, heart shades, a fistful of balloons.',
    'coolside': 'Sombrero, Deal With It, boombox. Turned away from you.',
    'king': 'Crown, and a golden banana held like a sceptre.',
    'duck': 'A duck sitting on his head. He has not noticed.',
    'face': 'THE CLOSE-UP. Cropped to the head — the graphic nobody has seen big.',
    'ring': 'All eight frames around a circle: one full rotation of the loop.',
    'wave': 'The loop in a line on a sine. Long and low — sleeves, wraps, bumpers.',
    'totem': 'Four stacked. Tall and narrow, for a poster or a long print.',
    'crowd': 'One hero, the floor packed in behind. Depth by size alone.',
    'swarm': 'Forty-nine of them, half-dropped. A field, not a tile.',
    'chain': 'Five with their hands linked, like THE CHAIN on the rave floor.',
    'highfive': 'Two meeting in the middle — the sheet\'s own mirrored pair.',
    'heart': 'The cast arranged into a heart. Reads as a SHAPE from across a room.',
    'filmstrip': 'The eight frames as film. Says what it is without a word of copy.',
    'seal': 'The badge: THE ORIGINAL DANCING BANANA / SINCE 1999 around the rim.',
    'est1999': 'Big numerals, the banana as punctuation. Reads from a distance.',
    'sunburst': 'Rays behind him. The oldest sticker composition there is.',
}


def index(made, labels=()):
    """A README beside the files — the folder IS the deliverable, so what each
    motif is for has to live next to it, not in a chat message."""
    L = ['# Motifs — print-ready, transparent, no product in mind', '',
         'Built by `python tools/build-shop-motifs.py`. Every file is RGBA with a',
         'fully transparent ground: **no background colour anywhere.**', '',
         '`-ink-black` / `-ink-white` are the same design in ONE colour — black for',
         'light garments, white for dark. A motif that needs its colour to be legible',
         '(the goldfish, the record label) has no ink variant.', '',
         '| Motif | Size | What it is |', '|---|---|---|']
    seen = set()
    for n, im in made:
        base = n.split('-ink-')[0]
        if base in seen:
            continue
        seen.add(base)
        variants = sorted({x.split('-ink-')[1] for x, _ in made if x.startswith(base + '-ink-')})
        v = (' · ink: ' + '/'.join(variants)) if variants else ''
        L.append('| `motif-%s` | %d×%d%s | %s |' % (base, im.width, im.height, v,
                                                    BLURBS.get(base, '')))
    L += ['', '⚠️ Sizes are print resolution, not screen. The smallest here (`face`,',
          '2360px) is still 15″ wide at 150 DPI; the largest are over 18,000px.', '']
    if labels:
        L += ['', '## Neck labels — the "official, not RedBubble" stamp', '',
              'These go in the **`label_inside` placement, not on the front**. Printful',
              'charges **+$0.99** for it on every DTG garment in the slate (outside label',
              '+$2.49, back print +$5.95), so it lands as **+$1.00** on the shelf price',
              'once the pricing rule rounds up — not the +$6 a second front print costs.', '',
              'Drawn chunky on purpose: they print at ~2.5–3″ and a label that needs a',
              'squint is worse than no label. `-black` for light garments, `-white` for dark.', '',
              '| Label | Size | Layout |', '|---|---|---|']
        blurb = {'stamp': 'A round seal — OFFICIAL over the top, the domain under it.',
                 'tag': 'Woven-tag proportions: mark left, three short lines right.',
                 'stack': 'Centred and vertical. Survives being printed small and crooked.'}
        for n, im in labels:
            if not n.endswith('-black'):
                continue
            b = n[:-6]
            L.append('| `label-%s` | %d×%d · black/white | %s |' % (b, im.width, im.height, blurb.get(b, '')))
        L.append('')
    open(os.path.join(OUT, 'README.md'), 'w', encoding='utf-8').write('\n'.join(L))


def contact(made):
    """A checkerboard contact sheet — transparency has to be VISIBLE or a white
    fill and a hole in the art look identical."""
    cols, cell, lab = 5, 460, 34
    rows = (len(made) + cols - 1) // cols
    s = Image.new('RGB', (cols * cell, rows * (cell + lab)), (255, 255, 255))
    chk = Image.new('RGB', (cell, cell), (247, 247, 247))
    dc = ImageDraw.Draw(chk)
    for y in range(0, cell, 28):
        for x in range(0, cell, 28):
            if (x // 28 + y // 28) % 2:
                dc.rectangle([x, y, x + 27, y + 27], fill=(228, 228, 228))
    try:
        f = ImageFont.truetype('arialbd.ttf', 19)
    except Exception:
        f = ImageFont.load_default()
    d = ImageDraw.Draw(s)
    for i, (n, im) in enumerate(made):
        cx, cy = (i % cols) * cell, (i // cols) * (cell + lab)
        s.paste(chk, (cx, cy))
        k = min((cell - 34) / im.width, (cell - 34) / im.height)
        t = im.resize((max(1, int(im.width * k)), max(1, int(im.height * k))), Image.LANCZOS)
        s.paste(t, (cx + (cell - t.width) // 2, cy + (cell - t.height) // 2), t)
        d.text((cx + 12, cy + cell + 7), '%s  %dx%d' % (n, im.width, im.height), font=f, fill=(30, 30, 30))
    p = os.path.join(OUT, '_SHEET.png')
    s.save(p)
    o('sheet: ' + os.path.relpath(p, REPO))


if __name__ == '__main__':
    main()
