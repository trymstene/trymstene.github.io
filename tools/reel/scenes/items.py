# -*- coding: utf-8 -*-
"""🔨 THE ITEMS WORKSHOP — draw a wearable pixel by pixel, then WEAR it.

   0.00 the dark bench, finished wearables on the rack above
   0.02 the forge canvas SLAMS down — ring, dust, punch
   0.05 a real wearable draws itself, bottom-up, one pixel at a time: the
        cursor block rides the newest pixel, the palette swatch follows the
        colour being painted, the art bleeds a soft glow onto the bench
   0.36 the last pixel (a horn tip) lands — gold flash, ring, sparkles
   0.47 HARD CUT
   0.47 the banana WEARING it: head close-up, dutch tilt, rays spinning
   0.69 punch out to the whole banana dancing in it + confetti

Every pixel is the engine's own accessory art (svg_rects), the canvas is the
forge's real canvas — its checkerboard, its grid weights, its palette.
"""
import math
import random

from PIL import Image, ImageDraw, ImageFilter

from engine import (H, W, banana, blink_fade, chroma_split, clamp01, confetti, dance_frame,
                    flicker, handheld, impact_ring, in_out, new_frame, out_back, out_cubic,
                    pulse, seg, shake_img, sparkle_burst, speed_lines, sun_rays, svg_rects,
                    vignette, zoom_punch)
import banana_render  # engine already puts tools/ on the path — read-only use

SECS = 5.0
CUT = 0.47
ART = 'viking'                       # the wearable being forged
OUTFIT = {'hat': ART}
RACK = ('crown', 'party', 'cowboy', 'sombrero')

INK = (17, 17, 17)
HOT = (255, 77, 109)                 # the forge's own selection accent
GOLD = (255, 225, 53)
# the forge's eight main swatches (FORGE_PALETTE 1,2,3,6,18,9,11,26)
MAINS = [(17, 17, 17), (255, 253, 245), (255, 225, 53), (226, 32, 32),
         (198, 134, 66), (55, 214, 122), (77, 184, 255), (106, 27, 154)]

PCX, PCY = 270, 466                  # the canvas panel
RACK_Y = 152                         # the shelf of finished wearables
PAL_Y = 776                          # the swatch row


# ---- the engine's own pixel art, expanded to single grid cells -------------
_CELLS = {}


def cells(name):
    if name not in _CELLS:
        grid = {}
        for x, y, w, h, rgb in svg_rects(name):
            gx0, gy0 = int(round(x / 10)), int(round(y / 10))
            for a in range(max(1, int(round(w / 10)))):
                for b in range(max(1, int(round(h / 10)))):
                    grid[(gx0 + a, gy0 + b)] = rgb
        mx = min(k[0] for k in grid)
        my = min(k[1] for k in grid)
        grid = {(k[0] - mx, k[1] - my): v for k, v in grid.items()}
        _CELLS[name] = (grid, max(k[0] for k in grid) + 1, max(k[1] for k in grid) + 1)
    return _CELLS[name]


PIX, GW, GH = cells(ART)
# bottom-up scanline: rows fill from the base up, left to right (never random)
ORDER = sorted(PIX, key=lambda k: (-k[1], k[0]))
COLS, ROWS = GW + 4, GH + 4
OX, OY = (COLS - GW) // 2, (ROWS - GH) // 2

# a constant scale for the hero, so the banana never pulses in size between
# dance frames (the frames' own bboxes differ by ~18%)
NAT = []
for _f in range(8):
    _bb = banana_render.render(_f, OUTFIT, scale=1).getbbox()
    NAT.append(_bb[3] - _bb[1])

_SPR = {}


def art_sprite(name, cell):
    key = (name, cell)
    if key not in _SPR:
        grid, gw, gh = cells(name)
        im = Image.new('RGBA', (gw * cell, gh * cell), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        for (gx, gy), c in grid.items():
            d.rectangle([gx * cell, gy * cell, (gx + 1) * cell - 1, (gy + 1) * cell - 1],
                        fill=c + (255,))
        _SPR[key] = im
    return _SPR[key]


# ---- little compositing helpers (negative-safe) ---------------------------
def blit(im, spr, x, y):
    lay = Image.new('RGBA', im.size, (0, 0, 0, 0))
    lay.paste(spr, (int(round(x)), int(round(y))))
    im.alpha_composite(lay)


def fade(spr, a):
    c = spr.copy()
    c.putalpha(c.getchannel('A').point(lambda p: int(p * clamp01(a))))
    return c


_GLOW = {}


def glow(r, col):
    key = (r, col)
    if key not in _GLOW:
        m = Image.new('L', (r * 2, r * 2), 0)
        d = ImageDraw.Draw(m)
        for k in range(24, 0, -1):
            rr = r * k / 24.0
            d.ellipse([r - rr, r - rr, r + rr, r + rr], fill=int(255 * (1 - k / 24.0) ** 2))
        ov = Image.new('RGBA', (r * 2, r * 2), col + (0,))
        ov.putalpha(m.filter(ImageFilter.GaussianBlur(r * 0.14)))
        _GLOW[key] = ov
    return _GLOW[key]


def put_glow(im, cx, cy, r, col, amt):
    if amt <= 0.01:
        return
    blit(im, fade(glow(r, col), amt), cx - r, cy - r)


def nearest_main(rgb):
    return min(range(len(MAINS)),
               key=lambda k: sum((MAINS[k][j] - rgb[j]) ** 2 for j in range(3)))


# ---- the bench ------------------------------------------------------------
_BG = None


def bench():
    global _BG
    if _BG is None:
        im = Image.new('RGBA', (W, H), (24, 18, 12, 255))
        d = ImageDraw.Draw(im)
        rnd = random.Random(7)
        y = -30
        while y < H:
            hgt = rnd.randint(58, 92)
            base = rnd.choice([(35, 26, 17), (28, 21, 14), (23, 17, 11)])
            d.rectangle([0, y, W, y + hgt], fill=base + (255,))
            for _ in range(8):
                gy = rnd.uniform(y + 5, y + hgt - 5)
                x0 = rnd.uniform(-60, W)
                ln = rnd.uniform(90, 340)
                col = rnd.choice([(13, 9, 6, 74), (48, 36, 23, 30)])
                d.line([x0, gy, x0 + ln, gy], fill=col, width=1)
            d.line([0, y + hgt, W, y + hgt], fill=(11, 8, 5, 210), width=2)
            y += hgt
        d.rectangle([0, 872, W, H], fill=(16, 11, 7, 205))   # the bench's front lip
        d.line([0, 872, W, 872], fill=(70, 52, 33, 230), width=2)
        _BG = im
    return _BG.copy()


def draw_rack(im, amt):
    """the shelf of finished wearables above the bench (real accessory art)"""
    d = ImageDraw.Draw(im)
    d.rectangle([36, RACK_Y, 504, RACK_Y + 16], fill=(62, 45, 29, 255))
    d.rectangle([36, RACK_Y, 504, RACK_Y + 3], fill=(104, 77, 48, 255))
    d.rectangle([36, RACK_Y + 16, 504, RACK_Y + 23], fill=(13, 9, 6, 255))
    sprs = [art_sprite(n, 5) for n in RACK]
    total = sum(s.width for s in sprs)
    gap = (432 - total) / (len(sprs) - 1)
    cur = 54.0
    for s in sprs:
        # a lit backing board so dark art still reads on dark wood
        d.rectangle([cur - 8, RACK_Y - s.height - 10, cur + s.width + 7, RACK_Y - 1],
                    fill=(46, 34, 22, 210))
        sh = Image.new('RGBA', (s.width, 9), (0, 0, 0, 0))
        ImageDraw.Draw(sh).ellipse([2, 0, s.width - 2, 8], fill=(0, 0, 0, 120))
        blit(im, sh, cur, RACK_Y - 5)
        blit(im, fade(s, 0.9 * amt), cur, RACK_Y - s.height)
        cur += s.width + gap


# ---- the canvas -----------------------------------------------------------
def draw_canvas(im, cell, n_shown, cur):
    pw, ph = COLS * cell, ROWS * cell
    x0, y0 = PCX - pw / 2, PCY - ph / 2
    d = ImageDraw.Draw(im)

    # the game's 3px ink border, on a warm bevel
    d.rectangle([x0 - 12, y0 - 12, x0 + pw + 11, y0 + ph + 11], fill=(84, 62, 38, 255))
    d.rectangle([x0 - 7, y0 - 7, x0 + pw + 6, y0 + ph + 6], fill=INK + (255,))

    # the transparency checkerboard, exactly the forge's two greys
    for gy in range(ROWS):
        b1 = round(y0 + gy * cell)
        b2 = max(b1, round(y0 + (gy + 1) * cell) - 1)
        for gx in range(COLS):
            a1 = round(x0 + gx * cell)
            a2 = max(a1, round(x0 + (gx + 1) * cell) - 1)
            d.rectangle([a1, b1, a2, b2],
                        fill=((232, 228, 216, 255) if (gx + gy) % 2 else (244, 241, 232, 255)))

    def box(gx, gy):
        a1, b1 = round(x0 + (OX + gx) * cell), round(y0 + (OY + gy) * cell)
        return (a1, b1, max(a1, round(x0 + (OX + gx + 1) * cell) - 1),
                max(b1, round(y0 + (OY + gy + 1) * cell) - 1))

    # the art, twice: blurred (the soft glow bleeding off the bench) then crisp
    lay = Image.new('RGBA', im.size, (0, 0, 0, 0))
    ld = ImageDraw.Draw(lay)
    for k in range(n_shown):
        key = ORDER[k]
        c = PIX[key]
        age = n_shown - 1 - k
        if age < 4:                       # the newest pixels are still white-hot
            m = (1 - age / 4.0) * 0.8
            c = tuple(round(c[j] + (255 - c[j]) * m) for j in range(3))
        ld.rectangle(box(*key), fill=c + (255,))
    if n_shown:
        # a soft drop shadow so pale pixels still read on the light canvas
        sh = Image.new('RGBA', im.size, (46, 33, 18, 0))
        sh.putalpha(lay.getchannel('A'))
        blit(im, fade(sh.filter(ImageFilter.GaussianBlur(5)), 0.55), 3, 5)
        im.alpha_composite(fade(lay.filter(ImageFilter.GaussianBlur(10)), 0.42))
        im.alpha_composite(lay)

    # grid lines — light every cell, stronger every 8 (the forge's own weights)
    ov = Image.new('RGBA', im.size, (0, 0, 0, 0))
    od = ImageDraw.Draw(ov)
    for gx in range(COLS + 1):
        x = round(x0 + gx * cell)
        od.line([x, round(y0), x, round(y0 + ph)], fill=INK + (58 if gx % 8 == 0 else 20,))
    for gy in range(ROWS + 1):
        y = round(y0 + gy * cell)
        od.line([round(x0), y, round(x0 + pw), y], fill=INK + (58 if gy % 8 == 0 else 20,))

    # the cursor block on the newest pixel, on a lit scan row
    if 0 < n_shown and cur > 0.02:
        a1, b1, a2, b2 = box(*ORDER[n_shown - 1])
        a = round(255 * cur)
        od.rectangle([round(x0), b1, round(x0 + pw), b2], fill=(245, 196, 0, round(44 * cur)))
        od.rectangle([a1, b1, a2, b2], fill=(255, 253, 245, a))
        od.rectangle([a1 - 4, b1 - 4, a2 + 4, b2 + 4], outline=HOT + (a,), width=3)
    im.alpha_composite(ov)


def draw_palette(im, active, amt, hit):
    d = ImageDraw.Draw(im)
    s, gap = 34, 14
    x = 270 - (len(MAINS) * s + (len(MAINS) - 1) * gap) / 2
    a = round(255 * clamp01(amt))
    for k, c in enumerate(MAINS):
        g = (5 + round(4 * hit)) if k == active else 0
        d.rectangle([x - 3 - g, PAL_Y - s / 2 - 3 - g, x + s + 2 + g, PAL_Y + s / 2 + 2 + g],
                    fill=INK + (a,))
        d.rectangle([x - g, PAL_Y - s / 2 - g, x + s - 1 + g, PAL_Y + s / 2 - 1 + g], fill=c + (a,))
        if k == active:
            d.rectangle([x - 7 - g, PAL_Y - s / 2 - 7 - g, x + s + 6 + g, PAL_Y + s / 2 + 6 + g],
                        outline=HOT + (a,), width=3)
        x += s + gap


def dust(im, ts, amt):
    if amt <= 0.02:
        return
    rnd = random.Random(31)
    ov = Image.new('RGBA', im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    for _ in range(24):
        bx, by = rnd.uniform(24, 516), rnd.uniform(200, 720)
        x = bx + math.sin(ts * 0.6 + rnd.uniform(0, 6.3)) * 12
        y = (by - ts * rnd.uniform(6, 18)) % 540 + 200
        r = rnd.choice([1, 2, 2])
        d.rectangle([x, y, x + r, y + r], fill=(255, 224, 150, round(rnd.uniform(40, 125) * amt)))
    im.alpha_composite(ov)


# ---- BEAT 1: the item draws itself ---------------------------------------
def beat1(t, i):
    im = bench()
    # the clip opens ALREADY drawing — first pixels down, cursor hot
    boot = 0.9 + 0.1 * out_back(seg(t, 0.0, 0.05))
    fillp = seg(t, -0.02, 0.355)
    push = in_out(seg(t, 0.02, 0.45))             # a small camera push
    cell = max(2.0, (19.4 + 2.4 * push) * boot)
    n = min(len(ORDER), int(round(len(ORDER) * fillp)))

    draw_rack(im, 1.0)
    put_glow(im, PCX, PCY, 340, (255, 190, 62),
             0.20 + 0.40 * fillp + 0.45 * pulse(t, 0.365, 0.05))
    # the shockwaves ride the bench BEHIND the canvas, never across the art
    impact_ring(im, PCX, PCY, seg(t, 0.008, 0.15), r1=330, width=8)
    impact_ring(im, PCX, PCY, seg(t, 0.365, 0.46), r1=440, width=10, col=GOLD)
    draw_canvas(im, cell, n, 1.0 - seg(t, 0.355, 0.385))

    colr = PIX[ORDER[max(0, n - 1)]] if n else MAINS[2]
    draw_palette(im, nearest_main(colr), clamp01(boot), pulse(t, 0.365, 0.05))
    dust(im, t * SECS, boot)

    hit = max(pulse(t, 0.012, 0.035) * 11, pulse(t, 0.365, 0.05) * 15)
    fl = max(pulse(t, 0.004, 0.03) * 0.9, pulse(t, 0.362, 0.032))
    if fl > 0:
        im.alpha_composite(Image.new('RGBA', im.size, (255, 244, 205, round(88 * fl))))
    sparkle_burst(im, PCX, PCY - 10, seg(t, 0.365, 0.50), n=18, dist=270, seed=11)
    sparkle_burst(im, 270, PAL_Y, seg(t, 0.385, 0.49), n=9, dist=190, seed=4)

    im = flicker(im, t * SECS, hz=6.5, depth=0.04)
    vignette(im, 122)
    im = zoom_punch(im, hit / 24)
    im = shake_img(im, hit)
    im = chroma_split(im, fl * 4)
    return im


# ---- BEAT 2: the banana wears it ------------------------------------------
def hero(im, i, cx, factor, tilt=0.0, top=None, bottom=None):
    """the hero shot, at a CONSTANT scale so the dance never resizes it"""
    f = dance_frame(i)
    b = banana(f, OUTFIT, height=max(2, round(NAT[f] * factor)))
    if tilt:
        b = b.rotate(tilt, expand=True, resample=Image.NEAREST)
        b = b.crop(b.getbbox())
    blit(im, b, cx - b.width / 2, top if top is not None else bottom - b.height)


def beat2(t, i):
    u = seg(t, CUT, 1.0)
    ts = t * SECS
    im = new_frame((15, 11, 20, 255))
    close = u < 0.42
    hx, hy = handheld(ts, amp=3.4, seed=2.0)
    fy = 330 if close else 430

    put_glow(im, 270 + hx, fy + hy, 430, (255, 190, 70), 0.60 + 0.18 * math.sin(u * 5))
    sun_rays(im, 270 + hx, fy + hy, ts, n=16, col=(255, 236, 120),
             alpha=54 + round(16 * math.sin(u * 6)), spin=0.5)

    # the pixels that were just drawn, snapping onto the banana's head
    land = seg(t, CUT, CUT + 0.075)
    if 0 < land < 1:
        rnd = random.Random(23)
        ov = Image.new('RGBA', im.size, (0, 0, 0, 0))
        od = ImageDraw.Draw(ov)
        for _ in range(22):
            a = rnd.uniform(0, math.tau)
            dd = (1 - out_cubic(land)) * rnd.uniform(190, 470)
            x, y = 270 + math.cos(a) * dd, 300 + math.sin(a) * dd * 0.8
            s = 9 + 9 * (1 - land)
            col = rnd.choice([(176, 176, 200), (255, 253, 245), (214, 160, 36)])
            od.rectangle([x, y, x + s, y + s], fill=col + (round(235 * (1 - land ** 2)),))
        im.alpha_composite(ov)

    if close:
        hero(im, i, 270 + hx, 2.25, tilt=-7.5 + 3.0 * math.sin(u * 4.4), top=38 + hy)
    else:
        hero(im, i, 270 + hx, 1.11, tilt=4.5 * math.sin((u - 0.42) * 3.6), bottom=896 + hy)

    hit = max(pulse(t, CUT + 0.006, 0.04) * 21, pulse(t, CUT + 0.222, 0.04) * 17)
    speed_lines(im, seg(t, CUT, CUT + 0.05), n=18, seed=6, horizontal=False)
    speed_lines(im, seg(t, CUT + 0.216, CUT + 0.262), n=11, seed=9)
    impact_ring(im, 270, 300, seg(t, CUT, CUT + 0.085), r1=580, width=12, col=GOLD)
    impact_ring(im, 270, 884, seg(t, CUT + 0.222, CUT + 0.33), r1=430, width=9, col=GOLD)

    sparkle_burst(im, 270, 210, seg(t, CUT + 0.03, CUT + 0.16), n=12, dist=220, seed=2)
    sparkle_burst(im, 306, 270, seg(t, CUT + 0.13, CUT + 0.25), n=8, dist=150, seed=7)
    sparkle_burst(im, 270, 430, seg(t, CUT + 0.23, CUT + 0.40), n=20, dist=330, seed=15)
    sparkle_burst(im, 270, 400, seg(t, 0.86, 1.0), n=16, dist=310, seed=21)
    if u > 0.44:
        confetti(im, (u - 0.44) / 0.56, n=36)

    fl = max(pulse(t, CUT + 0.004, 0.026), pulse(t, CUT + 0.222, 0.022) * 0.75)
    if fl > 0:
        im.alpha_composite(Image.new('RGBA', im.size, (255, 250, 232, round(140 * fl))))

    vignette(im, 96)
    # the close-up may overflow the frame; the wide shot must not, so its
    # punch stays gentle
    im = zoom_punch(im, max(pulse(t, CUT + 0.006, 0.04),
                            pulse(t, CUT + 0.222, 0.04) * 0.42,
                            0.5 * in_out(seg(t, 0.78, 1.0))))   # a slow push to the last beat
    im = shake_img(im, hit)
    im = chroma_split(im, fl * 7 + pulse(t, CUT + 0.10, 0.03) * 5)
    return im


def fn(t, i):
    im = beat1(t, i) if t < CUT else beat2(t, i)
    im = blink_fade(im, clamp01(1 - abs(t - CUT) / 0.019))       # the hard cut
    im = blink_fade(im, 0.35 * (1 - seg(t, 0.0, 0.03)))          # clean in
    return im


SCENE = {'name': 'items', 'secs': SECS, 'fn': fn}
