# -*- coding: utf-8 -*-
"""🕯 THE QUESTLINE — a mystery waiting at your gate.

   0.00 HOOK   Nib stands in the gate opening, the golden ! bobbing over his
               head with a breathing glow — one gold ping to catch the eye
   0.05 ACTION the player walks in off the road (Walk: 168px/s, hard stop,
               a beat of standing, then the last step up to the gate)
   0.45 STOP   dust, a ring, a small camera punch — he ARRIVES
   0.50        the ! pops and bursts: the talk begins
   0.55 PAYOFF the 1999 letter UNFURLS (torn paper, ruled lines, handwriting
               squiggles) with a flicker, and the camera pushes slowly in on
               it while gold sparkles rise — darker vignette all the way
"""
import math
import random

from PIL import Image, ImageDraw, ImageFilter

from engine import (BAN_H, FPS, Cam, Walk, asset, banana, blink_fade, chroma_split, clamp01,
                    flicker, handheld, impact_ring, in_out, out_cubic, poof, pulse, scaled,
                    seg, shake_img, sparkle, sparkle_burst, vignette, world_banana,
                    zoom_punch)

SECS = 5.0

# 🍌 the cast (world-quest.js NIB_DRAW — the mayor's official: top hat,
# clerk spectacles, necktie; nobody else wears all three)
NIB = {'hat': 'tophat', 'glasses': 'potter', 'extras': ['necktie']}
ME = {'hat': 'backwardscap', 'extras': ['sneakers']}

# homestead-geo.js: GATE 1152,816 · ROAD y900 · fence tier 1 · plot 864-1296
NIB_X, NIB_Y = 1140, 848          # in the gate opening (south fence gap 1104-1200)
ME_X, ME_Y = 1246, 866            # he stops on the road shoulder beside Nib
MARK_WH = 58                      # the ! in world px (~half a banana)

_C = {}


# ---- the dressed plate (static — built once) -------------------------------
def _plate():
    if 'plate' not in _C:
        p = asset('homestead/homestead.png').copy()
        p.alpha_composite(asset('homestead/ov-fyard1.png'), (816, 432))
        p.alpha_composite(asset('homestead/ov-fsouth1.png'), (816, 764))
        tent = asset('homestead/ov-tent1.png')
        p.alpha_composite(tent, (1150 - tent.width // 2, 640 - tent.height))
        # a lived-in yard: real homestead decor, native size, inside the plot
        for path, dx, dy in (('homestead/d-flowerbush.png', 1072, 716),
                             ('homestead/d-bush.png', 1246, 722),
                             ('homestead/d-birdhouse.png', 1302, 702)):
            s = asset(path)
            p.alpha_composite(s, (dx - s.width // 2, dy - s.height))
        mg = scaled('park/b-marigold.png', 1.4)
        for dx, dy in ((1016, 748), (1092, 754), (1216, 750), (1290, 742)):
            p.alpha_composite(mg, (dx - mg.width // 2, dy - mg.height))
        _C['plate'] = p
    return _C['plate']


# ---- the quest mark (world-quest.js MARK_SVG, rect for rect) ---------------
def _mark():
    if 'mark' not in _C:
        im = Image.new('RGBA', (14, 24), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)

        def r(x0, y0, x1, y1, col):
            d.rectangle([x0, y0, x1 - 1, y1 - 1], fill=col)
        ink, gold, shine = (17, 17, 17, 255), (255, 210, 63, 255), (255, 243, 168, 255)
        r(4, 0, 10, 10, ink)
        r(5, 10, 9, 14, ink)
        r(4, 17, 10, 22, ink)
        r(5, 1, 9, 9, gold)
        r(6, 9, 8, 13, gold)
        r(5, 18, 9, 21, gold)
        r(5, 1, 7, 9, shine)
        r(5, 18, 6, 21, shine)
        _C['mark'] = im
    return _C['mark']


def _glow(px, col, alpha):
    """a soft round halo — cached per (size, colour, alpha)"""
    px = max(8, int(px) // 8 * 8)              # quantised so the cache stays small
    key = ('glow', px, col, int(alpha) // 5 * 5)
    if key not in _C:
        m = Image.new('L', (128, 128), 0)
        ImageDraw.Draw(m).ellipse([30, 30, 98, 98], fill=255)
        m = m.filter(ImageFilter.GaussianBlur(20))
        a = int(clamp01(key[3] / 255.0) * 255)
        m = m.point(lambda p: p * a // 255)
        g = Image.new('RGBA', (128, 128), col + (0,))
        g.putalpha(m)
        _C[key] = g.resize((px, px), Image.BILINEAR)
    return _C[key]


# ---- 📜 the 1999 letter -----------------------------------------------------
# Paper, not a text box: torn edges, ruled lines, fold creases, and HANDWRITING
# that is pure squiggle — wobbling ink strokes, never a glyph.
LW, LH = 470, 306
PAPER = (246, 236, 208)


def _on_paper(col, a):
    """⚠️ ImageDraw REPLACES pixels on an RGBA image — a translucent ink would
    punch a hole in the paper and let the world through. Ink is pre-blended."""
    return tuple(round(PAPER[c] + (col[c] - PAPER[c]) * a) for c in range(3)) + (255,)


def _letter():
    if 'letter' in _C:
        return _C['letter']
    rnd = random.Random(1999)
    im = Image.new('RGBA', (LW + 26, LH + 28), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    x0, y0, x1, y1 = 8, 8, 8 + LW, 8 + LH

    pts = []
    x = x0
    while x < x1:
        pts.append((x, y0 + rnd.choice([0, 5, 9, 2, 7, 3])))
        x += 26
    pts.append((x1, y0 + 4))
    y = y0
    while y < y1:
        pts.append((x1 - rnd.choice([0, 3, 6]), y))
        y += 24
    pts.append((x1 - 3, y1))
    x = x1
    while x > x0:
        pts.append((x, y1 - rnd.choice([0, 6, 10, 2, 8])))
        x -= 26
    pts.append((x0, y1 - 5))
    y = y1
    while y > y0:
        pts.append((x0 + rnd.choice([0, 3, 6]), y))
        y -= 24

    d.polygon([(px + 8, py + 9) for px, py in pts], fill=(18, 11, 6, 130))   # its shadow
    d.polygon(pts, fill=PAPER + (255,))                                     # the paper

    # ruled lines
    rule = _on_paper((122, 88, 40), 0.26)
    for li in range(7):
        ly = 52 + li * 34
        d.line([(x0 + 28, ly), (x1 - 28, ly)], fill=rule, width=1)

    # ✍️ the handwriting — ink squiggles, deliberately unreadable
    ink = (67, 48, 26, 255)
    for li in range(6):
        yb = 52 + li * 34 - 7
        x = x0 + 32 + rnd.uniform(0, 16)
        stop = x1 - 40 - (rnd.uniform(10, 70) if li < 5 else 190)
        while x < stop:
            wl = min(rnd.uniform(30, 76), stop - x)
            if wl < 16:
                break
            amp, ph = rnd.uniform(3.4, 6.0), rnd.uniform(0, 6.28)
            fq = rnd.uniform(0.8, 1.35)
            n = max(5, int(wl / 3))
            line = [(x + wl * s / n,
                     yb + math.sin(s * fq + ph) * amp + math.sin(s * 0.29 + ph) * 1.7)
                    for s in range(n + 1)]
            d.line(line, fill=ink, width=3, joint='curve')
            if rnd.random() < 0.34:
                tx = x + wl * rnd.uniform(0.25, 0.75)
                d.line([(tx, yb - amp - 10), (tx + 2, yb + amp)], fill=ink, width=3)
            x += wl + rnd.uniform(11, 20)

    # the sign-off: one long flourish, low and to the right
    fy = 52 + 5 * 34 + 20
    fx = x1 - 210
    line = [(fx + s * 3.2,
             fy + math.sin(s * 0.42) * 11 + math.sin(s * 0.13) * 5)
            for s in range(54)]
    d.line(line, fill=ink, width=3, joint='curve')

    # fold creases — it lived folded in a drawer
    dk, lt = _on_paper((90, 60, 20), 0.17), _on_paper((255, 252, 235), 0.6)
    for f in (0.36, 0.7):
        fx2 = round(x0 + LW * f)
        d.line([(fx2, y0 + 16), (fx2, y1 - 16)], fill=dk, width=2)
        d.line([(fx2 + 2, y0 + 16), (fx2 + 2, y1 - 16)], fill=lt, width=1)
    fy2 = round(y0 + LH * 0.52)
    d.line([(x0 + 18, fy2), (x1 - 18, fy2)], fill=dk, width=2)
    d.line([(x0 + 18, fy2 + 2), (x1 - 18, fy2 + 2)], fill=lt, width=1)

    # age: soft brown blooms, blurred on their own layer
    st = Image.new('RGBA', im.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(st)
    for cxs, cys, r2 in ((36, 44, 40), (LW - 20, 40, 34), (LW - 6, LH - 26, 46),
                         (60, LH - 10, 38), (LW * 0.5, LH * 0.42, 30)):
        sd.ellipse([cxs - r2, cys - r2, cxs + r2, cys + r2], fill=(120, 84, 38, 46))
    st = st.filter(ImageFilter.GaussianBlur(16))
    st.putalpha(st.getchannel('A').point(lambda p: p * 200 // 255))
    im.alpha_composite(Image.composite(st, Image.new('RGBA', im.size, (0, 0, 0, 0)),
                                       _paper_mask(pts, im.size)))

    d.line(pts + [pts[0]], fill=(107, 74, 36, 255), width=3)                 # the torn edge
    _C['letter'] = im
    return im


def _paper_mask(pts, size):
    m = Image.new('L', size, 0)
    ImageDraw.Draw(m).polygon(pts, fill=255)
    return m


# ---- ✨ gold motes drifting at the gate -------------------------------------
MOTES = [(1140 + random.Random(7 + k).uniform(-120, 130),
          760 + random.Random(70 + k).uniform(-90, 120),
          random.Random(700 + k).uniform(6, 15),
          random.Random(7000 + k).uniform(0, 6.28)) for k in range(9)]
# gold rising around the letter while the camera pushes in (screen space)
LMOTES = [(random.Random(31 + k).uniform(-250, 250),
           random.Random(310 + k).uniform(-30, 190),
           random.Random(3100 + k).uniform(26, 62),
           random.Random(31000 + k).uniform(0, 6.28)) for k in range(14)]


def fn(t, i):
    rt = i / FPS
    plate = _plate()

    # 🎥 the camera: a settled medium on the gate, then a slow push into the
    # letter. cy stays high enough that vh never runs off the 1100 plate.
    settle = in_out(seg(t, 0.10, 0.45))
    push = in_out(seg(t, 0.66, 1.0))
    vw = 402 - settle * 16 - push * 46
    hx, hy = handheld(rt, amp=2.1)
    cam = Cam(plate, 1236 - settle * 34 - push * 8 + hx, 692 + settle * 8 + push * 4 + hy, vw)

    # 🚶 the player walks in off the road: leg, hard stop, beat, last step up
    # ⚠️ he starts BEYOND the frame edge (1520 vs a right edge of ~1437): parked
    # at 1470 a sliver of him hung on the edge through the whole hook
    walk = Walk([(1520, 900), (1330, 900), (ME_X, ME_Y)], pause=0.32, start_pause=0.26)
    wx, wy, moving = walk.at(rt)
    arrive = 0.450                                   # t of the hard stop

    hit = pulse(t, arrive, 0.045) * 7 + pulse(t, 0.565, 0.05) * 9
    cam.shake_amt = hit * 0.4
    im, k = cam.shot()

    # 🍌 Nib: the game locks him to one standing frame — only a slow breath
    nb = banana(0, NIB, height=max(2, round(BAN_H * k)))
    nx, ny = cam.tf(NIB_X, NIB_Y - 1.5 - 1.5 * math.cos(rt * 2.0))
    im.alpha_composite(nb, (round(nx - nb.width / 2), round(ny - nb.height)))

    # …and the player, dancing at the engine's true 10fps the whole way
    world_banana(im, cam, i, ME, wx, wy, flip=True,
                 lift=-abs(math.sin(i * 0.5)) * 3 if moving else 0)

    # the arrival: dust and a ring under his feet
    fx, fy = cam.tf(ME_X, ME_Y)
    poof(im, fx, fy - 6, seg(t, arrive - 0.01, arrive + 0.12), seed=4, big=0.8)
    impact_ring(im, fx, fy, seg(t, arrive, arrive + 0.085), r1=118, width=5,
                col=(255, 244, 200))

    # 🌒 dusk grade — the mystery mood, deepening into the payoff
    im.alpha_composite(Image.new('RGBA', im.size, (14, 10, 38, 62 + round(38 * push))))
    # …and a warm pool of light at the gate, so the mark's glow lands on ground
    lamp = _glow(round(300 * k), (255, 214, 96), 54)
    lx, ly = cam.tf(NIB_X, NIB_Y - 40)
    im.alpha_composite(lamp, (round(lx - lamp.width / 2), round(ly - lamp.height / 2)))

    # ✨ motes hanging in the air at the gate (their own layer: alpha must BLEND)
    ov = Image.new('RGBA', im.size, (0, 0, 0, 0))
    md = ImageDraw.Draw(ov)
    for mx, my, sp, ph in MOTES:
        yy = my - ((rt * sp + ph * 9) % 150)
        a = 0.35 + 0.65 * (0.5 - 0.5 * math.cos(rt * 2.4 + ph))
        sx2, sy2 = cam.tf(mx, yy)
        sparkle(md, sx2, sy2, 2.0 + 1.6 * a, (255, 236, 150, round(150 * a)))
    im.alpha_composite(ov)

    # 🕯 THE QUEST MARK — bobbing over Nib, glowing, then popping away
    mp = seg(t, 0.495, 0.55)
    if mp < 1:
        ping = pulse(t, 0.075, 0.075)                 # 🪝 the hook: it announces itself
        bobw = -7 * (0.5 - 0.5 * math.cos(rt / 1.1 * math.tau))
        scale = (1 + 0.16 * out_cubic(ping)) * (1 + 0.95 * out_cubic(mp))
        alpha = 1 - mp
        mkw = MARK_WH * k * scale
        spr = _mark().resize((max(1, round(mkw * 14 / 24)), max(1, round(mkw))), Image.NEAREST)
        if alpha < 1:
            spr.putalpha(spr.getchannel('A').point(lambda p: round(p * alpha)))
        gx, gy = cam.tf(NIB_X, NIB_Y - BAN_H - 12 + bobw)
        ga = (0.4 + 0.6 * (0.5 - 0.5 * math.cos(rt / 1.8 * math.tau))) * alpha
        gl = _glow(round(mkw * (3.0 + 0.9 * ping)), (255, 225, 53), round(165 * ga * (1 + 0.6 * ping)))
        im.alpha_composite(gl, (round(gx - gl.width / 2), round(gy - spr.height / 2 - gl.height / 2)))
        im.alpha_composite(spr, (round(gx - spr.width / 2), round(gy - spr.height)))
        sparkle_burst(im, gx, gy - spr.height / 2, seg(t, 0.02, 0.17), n=10, dist=110, seed=21)
    sparkle_burst(im, *cam.tf(NIB_X, NIB_Y - BAN_H - 34), t01=seg(t, 0.50, 0.61),
                  n=14, dist=130, seed=3)

    # 📜 THE LETTER unfurls, then the push grows it
    unfurl = out_cubic(seg(t, 0.55, 0.665))
    if unfurl > 0:
        g = 0.70 + 0.30 * push
        base = _letter()
        lw2 = max(2, round(base.width * g))
        lh2 = max(2, round(base.height * g * (0.10 + 0.90 * unfurl)))
        spr = base.resize((lw2, lh2), Image.BICUBIC).rotate(-1.5, expand=True,
                                                            resample=Image.BICUBIC)
        lcx, lcy = 270, 352 - 16 * push
        gl = _glow(round(620 * g), (255, 226, 130), round(102 * unfurl))
        im.alpha_composite(gl, (round(lcx - gl.width / 2), round(lcy - gl.height / 2)))
        im.alpha_composite(spr, (round(lcx - spr.width / 2), round(lcy - spr.height / 2)))
        sparkle_burst(im, lcx, lcy, seg(t, 0.56, 0.76), n=18, dist=270, seed=7)
        sparkle_burst(im, lcx, lcy + 10, seg(t, 0.76, 1.0), n=14, dist=330, seed=11)
        lov = Image.new('RGBA', im.size, (0, 0, 0, 0))
        ld = ImageDraw.Draw(lov)
        for mx, my, sp, ph in LMOTES:
            yy = lcy + my - ((rt * sp + ph * 22) % 210)
            a = unfurl * (0.3 + 0.7 * (0.5 - 0.5 * math.cos(rt * 3.1 + ph)))
            sparkle(ld, lcx + mx, yy, 2.2 + 2.0 * a, (255, 232, 140, round(190 * a)))
        im.alpha_composite(lov)

    # the unfurl flash
    fl = pulse(t, 0.565, 0.05)
    if fl > 0:
        im.alpha_composite(Image.new('RGBA', im.size, (255, 248, 218, round(78 * fl))))

    vignette(im, int(round((112 + 58 * push) / 10.0)) * 10)
    im = flicker(im, rt, hz=6.5, depth=0.055 + 0.09 * fl)
    im.putalpha(255)
    im = zoom_punch(im, hit / 9)
    im = shake_img(im, hit)
    im = chroma_split(im, max(0.0, fl - 0.72) * 11)
    im = blink_fade(im, 0.82 * (1 - seg(t, 0.0, 0.035)))
    return im


SCENE = {'name': 'quest', 'secs': SECS, 'fn': fn}
