# -*- coding: utf-8 -*-
"""📱 THE STICKER REEL v2 (1080x1920, 30fps, copy burned in) — 6 Sep 2026.

Trym: "i need some copy on it - concrete clear copy … dont show the stickers
on a big sheet - looks a bit cheap, but show off a couple of the packs with
the pack visuals, background and all, and animate in the different stickers -
maybe show them getting plastered on a laptop … copy that says something about
the price - we're only doing the unique, official, 9,99USD, fun type of reel."

Seven beats, one line each, the price twice:
    hook    the dancing banana, at its own 10fps          "The dancing banana" · since 1999
    flip    FLASH — he is his own kiss-cut sticker         "Now: official stickers"
    pack1   Park Life: its painted ground, six stickers   "Pack 1 · Park Life" · 6 stickers · $9.99
            pop in exactly where the pack's picture seats them (same seats, seeds, tilts)
    pack4   Party: its pink burst, same choreography        "Pack 4 · Party" · 6 stickers · $9.99
    laptop  three stickers slap onto a laptop lid at their  "Put him on your laptop" · Peel. Stick. Done.
            real size (a 5.5 cm sticker on a 30 cm lid)
    eight   the eight pack cards fan in, Party on top       "8 packs to collect" · the classic banana in every pack
    end     the Party Hat sticker, big                      "Official Banana stickers" · $9.99 a pack · link in bio

Reels safe zones (top 260, bottom 480, right 160) from build-reels.py; every
line sits inside them. Silent-safe. Same fonts, pills and grounds as the site.

    python tools/build-sticker-reel.py            # tools/reel/out/banana-stickers-reel-v2.mp4
    python tools/build-sticker-reel.py --contact  # 14 sample frames on one sheet, no video
"""
import importlib.util
import math
import os
import random
import sys

from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(HERE)
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, 'reel'))


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


BR = load('build_reels', os.path.join(HERE, 'build-reels.py'))      # fonts, pill, center_text (1080x1920)
BPA = load('build_pack_art', os.path.join(HERE, 'build-pack-art.py'))  # grounds, seats, kiss-cut
from engine import (blink_fade, dance_frame, handheld, impact_ring, in_out, out_back,  # noqa: E402
                    out_cubic, pulse, seg, shake_img, sparkle_burst, sun_rays, vignette)
import banana_render  # noqa: E402

W, H, FPS = 1080, 1920, 30
INK, YELLOW, CREAM = BR.INK, BR.YELLOW, BR.CREAM
OUT = os.path.join(HERE, 'reel', 'out')
os.makedirs(OUT, exist_ok=True)
PACKS_DIR = os.path.join(SITE, 'public', 'assets', 'packs')
HEAD_Y, PILL_Y = 400, 1390            # inside the safe zones (bottom 1440)
S, OY = 960, 330                      # the pack square: clear of the headline above and the chip below

_C = {}


def cached(key, fn):
    if key not in _C:
        _C[key] = fn()
    return _C[key]


# ---------------------------------------------------------------- grounds
def ground_burst(base, ray):
    return cached(('burst', base, ray), lambda: BPA.burst(base, ray, W, H, cx=0.5, cy=0.5))


def ground_painted(pack):
    def make():
        sq = BPA.MOODS[str(pack)](H)          # the pack's own painted scene, tall enough for 9:16
        return sq.crop(((H - W) // 2, 0, (H - W) // 2 + W, H))
    return cached(('painted', pack), make)


def ground_ink():
    def make():
        im = Image.new('RGBA', (W, H), (13, 11, 20, 255))
        sun_rays(im, W / 2, 900, 0.0, n=14, col=(255, 225, 53), alpha=55, spin=0.0)
        return im
    return cached('ink', make)


# ---------------------------------------------------------------- the stickers, seated like the pack's picture
def seats(pack):
    """the six stickers of a pack, cut and tilted exactly as build-pack-art seats
    them on the spread (same SEATS, same seeds, same draw order), at S=1080"""
    def make():
        cells = BPA.BSP.PACKS[str(pack)]
        rnd = random.Random(100 + int(pack))
        arts = [BPA.BSP.art_for(c, 1)[0] for c in cells]
        out = []
        for idx, fx, fy, share, tilt, jit in BPA.SEATS:
            a, k = BPA.fit(arts[idx], S * share)
            tilt = tilt * (0.6 if k < 0.9 else 1.0)
            st = BPA.kiss_cut(a, border=12).rotate(rnd.uniform(-tilt, tilt), expand=True, resample=Image.BICUBIC)
            cx, cy = S * fx + rnd.uniform(-jit, jit), OY + S * fy + rnd.uniform(-jit, jit) * 0.7
            out.append((st, cx, cy))
        return out
    return cached(('seats', pack), make)


def cutout(pack, slug, art_h):
    """the site's kiss-cut cut-out with its ART `art_h` tall (crisp when scaling up)"""
    def make():
        im = Image.open(os.path.join(PACKS_DIR, 'stickers', slug + '.webp')).convert('RGBA')
        c = next(x for x in BPA_ART['packs'][str(pack)] if x['slug'] == slug)
        fitted_h = 420 * c['h'] / max(c['w'], c['h'])
        k = art_h / fitted_h
        return im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))),
                         Image.NEAREST if k >= 1 else Image.LANCZOS)
    return cached(('cut', pack, slug, round(art_h)), make)


import json  # noqa: E402
BPA_ART = json.load(open(os.path.join(SITE, 'src', 'data', 'pack-art.json'), encoding='utf-8'))


def card(n, width):
    return cached(('card', n, width), lambda: Image.open(os.path.join(PACKS_DIR, 'pack-%d-card.webp' % n))
                  .convert('RGBA').resize((width, width), Image.LANCZOS))


_NAT = None


def hero(frame, height):
    """the engine's own banana at a constant scale (no pulsing between frames)"""
    global _NAT
    if _NAT is None:
        _NAT = [banana_render.render(f, {}, scale=1).getbbox() for f in range(8)]
    def make():
        im = banana_render.render(frame % 8, {}, scale=1).crop(_NAT[frame % 8])
        k = height / max(b[3] - b[1] for b in _NAT)
        return im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.NEAREST)
    return cached(('hero', frame % 8, height), make)


def paste(im, sp, cx, cy, scale=1.0, rot=0.0):
    s = sp
    if abs(scale - 1) > 0.003:
        s = s.resize((max(1, round(s.width * scale)), max(1, round(s.height * scale))), Image.BICUBIC)
    if abs(rot) > 0.2:
        s = s.rotate(rot, expand=True, resample=Image.BICUBIC)
    im.alpha_composite(s, (round(cx - s.width / 2), round(cy - s.height / 2)))


def zoom(im, amount):
    if amount <= 0:
        return im
    z = 1 + 0.10 * amount
    w2, h2 = round(W * z), round(H * z)
    big = im.resize((w2, h2), Image.BICUBIC)
    return big.crop(((w2 - W) // 2, (h2 - H) // 2, (w2 - W) // 2 + W, (h2 - H) // 2 + H))


def confetti(im, t01, n=50, seed=12):
    if t01 <= 0:
        return
    rnd = random.Random(seed)
    d = ImageDraw.Draw(im)
    for k in range(n):
        x = rnd.uniform(0, W)
        y = rnd.uniform(-H * 0.35, H * 0.15) + t01 * H * 1.1 * rnd.uniform(0.6, 1.25)
        col = [(255, 225, 53), (255, 93, 143), (94, 200, 224), (94, 224, 138)][k % 4]
        s = rnd.choice([12, 14, 18])
        d.rectangle([x, y, x + s, y + s], fill=col + (225,))


def headline(im, text, px=88, fill=INK, y=HEAD_Y, shadow=None):
    BR.center_text(im, text, y, 'archivo', px, fill, max_w=940, shadow=shadow)


def chip(im, text, y=PILL_Y, px=60, fg=INK, bg=YELLOW, pop=1.0, rot=-2.0):
    BR.pill(im, text, y, px=px, fg=fg, bg=bg, pop=pop, rot=rot, max_w=900)


# ---------------------------------------------------------------- beats: fn(t, i) with t in 0..1
def beat_hook(t, i):
    im = ground_burst(BPA.YELLOW, BPA.DEEP).copy()
    dx, dy = handheld(t, 5, 1.0)
    b = hero(dance_frame(i), 780)
    im.alpha_composite(b, (round(W / 2 + dx - b.width / 2), round(1290 + dy - b.height)))
    headline(im, 'The dancing banana', 96)
    chip(im, 'since 1999', pop=out_back(seg(t, 0.10, 0.30)))
    return im


def beat_flip(t, i):
    im = ground_burst(BPA.YELLOW, BPA.DEEP).copy()
    FLIP = 0.18
    dx, dy = handheld(t, 5, 2.0)
    if t < FLIP:
        b = hero(dance_frame(i), 780)
        im.alpha_composite(b, (round(W / 2 + dx - b.width / 2), round(1290 + dy - b.height)))
    else:
        u = seg(t, FLIP, FLIP + 0.12)
        st = cutout(4, 'the-original', 780)
        paste(im, st, W / 2 + dx, 900 + dy, scale=max(0.05, 0.55 + 0.45 * out_back(u)), rot=-6 + 2.5 * math.sin(t * 9))
        sparkle_burst(im, W / 2, 900, seg(t, FLIP, FLIP + 0.4), n=18, dist=380, seed=4, color=(255, 253, 245, 255))
    impact_ring(im, W / 2, 900, seg(t, FLIP, FLIP + 0.25), r0=60, r1=640, width=12)
    im = BR.flash(im, pulse(t, FLIP, 0.03) * 0.9)
    im = shake_img(im, pulse(t, FLIP + 0.02, 0.06) * 14)
    headline(im, 'Now: official stickers', 92)
    chip(im, 'unique · nobody else prints these', px=52, pop=out_back(seg(t, FLIP + 0.05, FLIP + 0.3)))
    return im


def beat_pack(pack, name, ground):
    POP0, GAP, POP = 0.08, 0.11, 0.22

    def fn(t, i):
        im = ground().copy()
        dx, dy = handheld(t, 4, 3.0 + pack)
        for n, (st, cx, cy) in enumerate(seats(pack)):
            at = POP0 + n * GAP
            u = seg(t, at, at + POP)
            if u <= 0:
                continue
            paste(im, st, cx + dx, cy + dy, scale=max(0.05, out_back(u, 1.4)))
            impact_ring(im, cx, cy + st.height * 0.35, seg(t, at + 0.06, at + 0.30), r0=20, r1=260, width=6)
        last = POP0 + (len(BPA.SEATS) - 1) * GAP
        sparkle_burst(im, seats(pack)[-1][1], seats(pack)[-1][2], seg(t, last + 0.05, last + 0.45), n=16, dist=300, seed=8)
        im = zoom(im, pulse(t, last + 0.10, 0.08) * 0.8)
        im = shake_img(im, pulse(t, last + 0.10, 0.05) * 10)
        headline(im, name, 88)
        chip(im, '6 stickers · $9.99', px=64, pop=out_back(seg(t, 0.12, 0.34)))
        return im
    return fn


def beat_laptop(t, i):
    im = ground_burst(BPA.PAPER, BPA.CREAM2).copy()
    d = ImageDraw.Draw(im)
    # the lid: a laptop seen from behind, flat and plain, nothing to read on it
    # the camera is close: the lid runs past the left edge, so a 5.5 cm sticker on a 30 cm lid reads
    lid = [-300, 600, 1000, 1560]
    d.rounded_rectangle([lid[0] + 12, lid[1] + 16, lid[2] + 12, lid[3] + 16], radius=44, fill=(0, 0, 0, 60))
    d.rounded_rectangle(lid, radius=44, fill=(44, 46, 56, 255), outline=(22, 22, 28, 255), width=8)
    d.rounded_rectangle([lid[0] + 18, lid[1] + 18, lid[2] - 18, lid[3] - 18], radius=34, outline=(64, 66, 80, 255), width=4)
    d.rounded_rectangle([lid[0] - 30, lid[3] - 8, lid[2] + 30, lid[3] + 40], radius=14, fill=(30, 30, 38, 255))
    # three stickers slap on at their real size: a 5.5 cm sticker on a 30 cm lid (1300 px) = 238 px
    SLAPS = [('party-hat', 0.14, 330, 880, -8), ('the-original', 0.40, 720, 820, 6), ('boombox', 0.64, 540, 1150, -4)]
    for slug, at, cx, cy, rot in SLAPS:
        u = seg(t, at, at + 0.22)
        if u <= 0:
            continue
        st = cutout(4, slug, 238)
        paste(im, st, cx, cy, scale=1 + 1.4 * (1 - out_back(u, 1.2)), rot=rot)
        impact_ring(im, cx, cy + 60, seg(t, at + 0.10, at + 0.34), r0=24, r1=260, col=(255, 253, 245), width=6)
    for slug, at, cx, cy, rot in SLAPS:
        im = shake_img(im, pulse(t, at + 0.12, 0.05) * 9)
    headline(im, 'Put him on your laptop', 84)
    chip(im, 'Peel. Stick. Done.', px=58, pop=out_back(seg(t, 0.72, 0.92)))
    return im


def beat_eight(t, i):
    im = ground_ink().copy()
    ORDER = [1, 2, 3, 5, 6, 7, 8, 4]
    T0, GAP, FLY = 0.04, 0.075, 0.16
    CX, CY = W / 2, 980
    for k, n in enumerate(ORDER):
        at = T0 + k * GAP
        u = seg(t, at, at + FLY)
        if u <= 0:
            continue
        c = card(n, 560)
        ang = -17 + k * 4.8
        sx, sy = CX + (k - 3.5) * 30, CY + abs(k - 3.5) * 9
        y = sy + (1 - out_back(u, 1.3)) * 1400
        r = c.rotate(ang * out_cubic(u), expand=True, resample=Image.BICUBIC)
        im.alpha_composite(r, (round(sx - r.width / 2), round(y - r.height / 2)))
        impact_ring(im, sx, sy + 260, seg(t, at + 0.09, at + 0.30), r0=40, r1=400, width=8)
    last = T0 + 7 * GAP
    sparkle_burst(im, CX, CY - 40, seg(t, last + 0.08, last + 0.45), n=20, dist=480, seed=9)
    im = zoom(im, pulse(t, last + 0.12, 0.08) * 0.9)
    im = shake_img(im, pulse(t, last + 0.12, 0.05) * 12)
    vignette(im, 90)
    headline(im, '8 packs to collect', 92, fill=YELLOW)
    chip(im, 'the classic banana in every pack', px=50, bg=CREAM, pop=out_back(seg(t, last + 0.1, last + 0.35)))
    return im


def beat_end(t, i):
    im = ground_burst(BPA.HOT, BPA.HOT2).copy()
    dx, dy = handheld(t, 5, 4.0)
    st = cutout(4, 'party-hat', 760)
    paste(im, st, W / 2 + dx, 860 + dy, scale=max(0.05, 0.6 + 0.4 * out_back(seg(t, 0.0, 0.18))), rot=-7 + 3 * math.sin(t * 6))
    impact_ring(im, W / 2, 860, seg(t, 0.02, 0.28), r0=60, r1=620, width=12)
    confetti(im, seg(t, 0.15, 1.0), n=60, seed=11)
    headline(im, 'Official Banana stickers', 88)
    chip(im, '$9.99 a pack', y=1320, px=80, pop=out_back(seg(t, 0.16, 0.36)))
    BR.center_text(im, 'trymstene.com/shop · link in bio', 1425, 'nunito', 44, INK, max_w=900)
    return im


BEATS = [(2.4, beat_hook), (2.6, beat_flip),
         (3.2, beat_pack(1, 'Pack 1 · Park Life', lambda: ground_painted(1))),
         (3.2, beat_pack(4, 'Pack 4 · Party', lambda: ground_burst(BPA.HOT, BPA.HOT2))),
         (3.4, beat_laptop), (2.6, beat_eight), (2.8, beat_end)]
CUT = 0.07   # seconds of dark at every beat start, so the cuts read as cuts


def frames():
    i = 0
    for secs, fn in BEATS:
        n = round(secs * FPS)
        for k in range(n):
            t = k / (n - 1)
            im = fn(t, i)
            im = blink_fade(im, 1 - seg(k / FPS, 0, CUT))
            yield im
            i += 1


def contact():
    total = sum(round(s * FPS) for s, _ in BEATS)
    picks = set(round(x * (total - 1)) for x in [k / 13 for k in range(14)])
    shots = [im.convert('RGB') for k, im in enumerate(frames()) if k in picks]
    cw, ch = 216, 384
    sheet = Image.new('RGB', (cw * 7 + 16, ch * 2 + 12), (24, 22, 30))
    for k, im in enumerate(shots[:14]):
        sheet.paste(im.resize((cw, ch)), ((k % 7) * (cw + 2) + 2, (k // 7) * (ch + 4) + 4))
    p = os.path.join(OUT, '_sheet_sticker_reel.png')
    sheet.save(p)
    print('contact sheet:', p)


def build():
    import imageio_ffmpeg
    dst = os.path.join(OUT, 'banana-stickers-reel-v2.mp4')
    # ⚠️ macro_block_size=1: the default pads 1080 to 1088 wide, which is no longer 9:16
    writer = imageio_ffmpeg.write_frames(dst, (W, H), fps=FPS, codec='libx264', pix_fmt_out='yuv420p',
                                         macro_block_size=1, output_params=['-crf', '17', '-movflags', '+faststart'])
    writer.send(None)
    n = 0
    for im in frames():
        writer.send(im.convert('RGB').tobytes())
        n += 1
    writer.close()
    print('encoded: %s  %d frames  %0.1fs  %0.1fMB' % (dst, n, n / FPS, os.path.getsize(dst) / 1e6))


if __name__ == '__main__':
    if '--contact' in sys.argv:
        contact()
    else:
        build()
