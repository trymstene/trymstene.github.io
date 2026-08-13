# -*- coding: utf-8 -*-
"""🎫 MY PASS — the membership card gets stamped OFFICIAL.

A deliberate UI close-up (law 2 allows it: the screen IS the subject), so no
world plate and no banana walking — the only things that move are the card,
the card's own live portrait (dance_frame, the engine's 10fps) and the stamp.

   0.00  the card SLIDES UP out_back, tilted, and settles        (HOOK)
   0.30  the rank bar fills, patches pop in one at a time        (ACTION)
   0.34  a shine sweeps across the face
   0.56  the red OFFICIAL stamp falls — speed lines
   0.71  ⭐ SLAM: flash, rings, shake, zoom punch, chroma split
   0.74  confetti, sparkles, a slow push-in                      (PAYOFF)

The card is honest to /pass/: banana-yellow face, hard ink drop shadow, ink
header strip with a punched hole, your banana portrait, ink BARS standing in
for every word (never letters), a pixel barcode, the red stamp.

⚠️ two traps paid for here: ImageDraw REPLACES pixels, so an alpha fill punches
a hole clean through the card (pre-mix against the yellow instead), and
out_back(0) returns 2e-16 — truthy enough to draw a 1px ghost.
"""
import math
import random

from PIL import Image, ImageDraw, ImageFilter

from engine import (H, W, banana, blink_fade, chroma_split, clamp01, confetti, dance_frame,
                    flicker, impact_ring, in_out, new_frame, out_back, out_cubic, pulse, seg,
                    shake_img, sparkle_burst, speed_lines, sun_rays, vignette, zoom_punch)

SECS = 4.6

BAN = (255, 225, 53, 255)
INK = (17, 17, 17, 255)
PAPER = (255, 253, 245, 255)
RED = (226, 32, 32)

CW, CH = 240, 150            # the card's design grid
CARD_W = 462                 # ...on screen
U = CARD_W / CW
SHD = 5                      # the site's hard ink drop shadow, in grid units

OUTFIT = {'hat': 'crown', 'glasses': 'shades'}
PATCH_COLS = [(255, 93, 143), (94, 200, 224), (94, 224, 138), (255, 170, 60)]

_GLOW = None


def u(v):
    return v * U


def mix(a, fg=(17, 17, 17), bg=(255, 225, 53)):
    """an OPAQUE colour that looks like `fg` at alpha `a` over the card face"""
    f = a / 255.0
    return tuple(round(fg[k] * f + bg[k] * (1 - f)) for k in range(3)) + (255,)


def glow_mask():
    global _GLOW
    if _GLOW is None:
        m = Image.new('L', (W // 3, H // 3), 0)
        ImageDraw.Draw(m).ellipse([W / 3 * 0.08, H / 3 * 0.24, W / 3 * 0.92, H / 3 * 0.70], fill=255)
        _GLOW = m.filter(ImageFilter.GaussianBlur(20)).resize((W, H), Image.BILINEAR)
    return _GLOW


def place(im, sprite, cx, cy):
    """paste centred, clipping instead of exploding on a negative offset"""
    x, y = round(cx - sprite.width / 2), round(cy - sprite.height / 2)
    if x < 0 or y < 0:
        sprite = sprite.crop((max(0, -x), max(0, -y), sprite.width, sprite.height))
        x, y = max(0, x), max(0, y)
    im.alpha_composite(sprite, (x, y))


def words(d, x, y, h, widths, gap, col):
    """dark blocks standing in for a line of text — NEVER letters"""
    cx = x
    for w in widths:
        d.rectangle([u(cx), u(y), u(cx + w), u(y + h)], fill=col)
        cx += w + gap


def card_img(t, i):
    """the pass card, drawn at screen resolution (hard shadow included)"""
    img = Image.new('RGBA', (round(u(CW + SHD)) + 2, round(u(CH + SHD)) + 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    d.rectangle([u(SHD), u(SHD), u(CW + SHD), u(CH + SHD)], fill=INK)          # hard shadow
    d.rectangle([0, 0, u(CW), u(CH)], fill=BAN, outline=INK, width=max(2, round(u(2.4))))

    # ── header strip + punched hole
    d.rectangle([u(6), u(6), u(CW - 6), u(25)], fill=INK)
    words(d, 12, 12, 6.5, [30, 44, 26], 5, BAN)
    hx, hy = u(CW - 17), u(15.5)
    d.ellipse([hx - u(7), hy - u(7), hx + u(7), hy + u(7)], fill=BAN)
    d.ellipse([hx - u(4.6), hy - u(4.6), hx + u(4.6), hy + u(4.6)], fill=PAPER)

    # ── the live portrait (the card's own banana, cycling at the engine's 10fps)
    b = banana(dance_frame(i), OUTFIT, height=round(u(58)))
    img.alpha_composite(b, (round(u(40) - b.width / 2), round(u(97) - b.height)))

    # ── the meta column: name, since, rank chip, rank bar, note
    words(d, 78, 35, 12, [56, 36], 7, INK)
    words(d, 78, 52, 5, [26, 20, 13], 5, mix(150))
    d.rectangle([u(78), u(62), u(116), u(74)], fill=INK)
    words(d, 82, 66, 4.5, [16, 11], 4, BAN)
    d.rectangle([u(78), u(79), u(178), u(84)], fill=mix(64))
    fill = out_cubic(seg(t, 0.30, 0.52)) * 0.74
    if fill > 0.01:
        d.rectangle([u(78), u(79), u(78 + 100 * fill), u(84)], fill=INK)
    words(d, 78, 88, 4, [24, 17], 5, mix(120))

    # ── patches, popping in one at a time
    for k in range(4):
        p = out_back(seg(t, 0.40 + k * 0.035, 0.47 + k * 0.035))
        if p <= 0.02:
            continue
        s = u(12) * min(1.35, p)
        cx, cy = u(84 + k * 15), u(102)
        d.rectangle([cx - s / 2 + u(1.6), cy - s / 2 + u(1.6),
                     cx + s / 2 + u(1.6), cy + s / 2 + u(1.6)], fill=INK)
        d.rectangle([cx - s / 2, cy - s / 2, cx + s / 2, cy + s / 2],
                    fill=PAPER, outline=INK, width=max(1, round(u(1.4))))
        d.rectangle([cx - s * 0.24, cy - s * 0.24, cx + s * 0.24, cy + s * 0.24],
                    fill=PATCH_COLS[k] + (255,))

    # ── foot: pixel barcode + serial blocks
    rnd = random.Random(9)
    bx = 12.0
    while bx < 86:
        bw = rnd.choice([1.5, 2.5, 4.0])
        if rnd.random() > 0.36:
            d.rectangle([u(bx), u(117), u(bx + bw), u(134)], fill=INK)
        bx += bw + 1.8
    words(d, 176, 125, 5, [18, 12, 22], 4, mix(210))
    return img


def stamp_layer(cx, cy, r, ang, alpha):
    """the red OFFICIAL stamp: double ring + banana silhouette, no letters"""
    ov = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    col = RED + (alpha,)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=col, width=max(2, round(r * 0.12)))
    d.ellipse([cx - r * 0.78, cy - r * 0.78, cx + r * 0.78, cy + r * 0.78],
              outline=col, width=max(1, round(r * 0.05)))
    bb = banana(2, None, height=max(4, round(r * 0.98)))
    sil = Image.new('RGBA', bb.size, RED + (255,))
    sil.putalpha(bb.split()[3].point(lambda p: alpha if p > 120 else 0))
    ov.alpha_composite(sil, (round(cx - bb.width / 2), round(cy - bb.height / 2)))
    return ov.rotate(ang, center=(cx, cy), resample=Image.BICUBIC)


def fn(t, i):
    ts = t * SECS
    im = new_frame((13, 11, 22, 255))
    payoff = in_out(seg(t, 0.70, 0.90))

    # 🌟 the bloom + slow rays behind the card (both brighten on the stamp)
    bloom = 0.32 + 0.20 * in_out(seg(t, 0.0, 0.30)) + 0.44 * pulse(t, 0.72, 0.14)
    g = Image.new('RGBA', (W, H), (255, 214, 60, 0))
    g.putalpha(glow_mask().point(lambda p: round(p * clamp01(bloom) * 0.62)))
    im.alpha_composite(g)
    sun_rays(im, W / 2, H * 0.45, ts, n=14, col=(255, 214, 60),
             alpha=round(8 + 26 * payoff), spin=0.22)

    # 🎉 confetti drifting BEHIND the card, wrapping so it never runs out
    d = ImageDraw.Draw(im)
    rnd = random.Random(4)
    for k in range(34):
        x0 = rnd.uniform(-10, W)
        y0 = rnd.uniform(0, H + 40)
        sp = rnd.uniform(34, 92)
        s = rnd.choice([6, 7, 9])
        y = (y0 + ts * sp) % (H + 40) - 20
        x = x0 + math.sin(ts * 1.4 + k) * 7
        col = [(255, 225, 53), (255, 93, 143), (94, 200, 224), (94, 224, 138)][k % 4]
        d.rectangle([x, y, x + s, y + s], fill=col + (110,))

    # 🎫 THE CARD — slides up with out_back, settles into a lazy float
    enter = out_back(seg(t, 0.02, 0.30))
    cy = H * 0.455 + (1 - enter) * H * 0.62 + math.sin(ts * 2.2) * 3
    cy += pulse(t, 0.715, 0.05) * 12                     # the stamp shoves it down
    ang = -9 + 6.4 * enter + math.sin(ts * 1.7) * 0.9

    card = card_img(t, i)
    rot = card.rotate(ang, expand=True, resample=Image.BICUBIC)
    tmp = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    place(tmp, rot, W / 2, cy)

    # ✨ the shine sweep, clipped to the card FACE (never the drop shadow —
    #    a shadow that catches a highlight reads as a bug)
    sh = seg(t, 0.34, 0.58)
    if 0 < sh < 1:
        face = Image.new('RGBA', card.size, (0, 0, 0, 0))
        ImageDraw.Draw(face).rectangle([0, 0, u(CW), u(CH)], fill=(255, 255, 255, 255))
        fl_ = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        place(fl_, face.rotate(ang, expand=True, resample=Image.BICUBIC), W / 2, cy)
        ov = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        do = ImageDraw.Draw(ov)
        x = -300 + sh * (W + 620)
        do.polygon([(x, 0), (x + 62, 0), (x - 118, H), (x - 180, H)], fill=(255, 255, 255, 95))
        do.polygon([(x + 62, 0), (x + 98, 0), (x - 82, H), (x - 118, H)], fill=(255, 255, 255, 48))
        ov.putalpha(Image.composite(ov.split()[3], Image.new('L', (W, H), 0), fl_.split()[3]))
        tmp.alpha_composite(ov)
    im.alpha_composite(tmp)

    # 🔴 THE STAMP — rides the card's tilt, hangs high, then slams
    a = math.radians(ang)
    ox, oy = u(64), u(30)
    sx = W / 2 + ox * math.cos(a) + oy * math.sin(a)
    sy = cy - ox * math.sin(a) + oy * math.cos(a)

    st = seg(t, 0.56, 0.715)
    if st > 0:
        far = (1 - st) ** 0.55
        settle = 1.0
        if st >= 1:
            settle = 1 + 0.05 * math.sin((t - 0.715) * 78) * math.exp(-(t - 0.715) * 15)
        r = u(41) * (1 + 1.55 * far) * settle
        alpha = round(90 + 155 * min(1.0, st * 1.8))
        im.alpha_composite(stamp_layer(sx, sy, r, ang - 8 - 12 * far, alpha))
        if st < 1:
            speed_lines(im, seg(t, 0.56, 0.73), n=16, seed=7, horizontal=False,
                        col=(255, 214, 214))

    # 💥 the landing
    impact_ring(im, sx, sy, seg(t, 0.715, 0.87), r0=u(40), r1=430, width=9)
    impact_ring(im, sx, sy, seg(t, 0.735, 0.94), r0=u(40), r1=580, width=7, col=(255, 225, 53))
    fl = pulse(t, 0.722, 0.028)
    if fl > 0:
        im.alpha_composite(Image.new('RGBA', (W, H), (255, 253, 245, round(118 * fl))))
    sparkle_burst(im, sx, sy, seg(t, 0.72, 0.95), n=16, dist=280, seed=11)
    sparkle_burst(im, W / 2 - 60, cy - 30, seg(t, 0.76, 1.0), n=14, dist=330, seed=3,
                  color=(255, 93, 143, 255))
    if t > 0.73:
        confetti(im, (t - 0.73) / 0.52, n=40, seed=21)

    # 📺 a live screen: scanlines, vignette, flicker
    sc = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ds = ImageDraw.Draw(sc)
    for y in range(0, H, 5):
        ds.line([0, y, W, y], fill=(0, 0, 0, 20))
    im.alpha_composite(sc)
    vignette(im, 88)
    im = flicker(im, ts, hz=8.5, depth=0.05)
    im.putalpha(255)

    hit = pulse(t, 0.722, 0.055)
    im = zoom_punch(im, 0.40 + 0.30 * in_out(seg(t, 0.30, 1.0)) + hit * 0.75)
    im = shake_img(im, hit * 17)
    im = chroma_split(im, hit * 9)
    im = blink_fade(im, 0.85 * (1 - seg(t, 0.0, 0.03)))
    return im


SCENE = {'name': 'pass', 'secs': SECS, 'fn': fn}
