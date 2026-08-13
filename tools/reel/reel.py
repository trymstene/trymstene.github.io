# -*- coding: utf-8 -*-
"""🎬 REEL SCENES — isolated 4-5s vertical clips for the Instagram reel.

Every clip: 1080x1920, 30fps, h264, NO text, NO audio. Rendered at 540x960
logical and upscaled 2x NEAREST so the pixel art stays chunky. Real game
assets only (pack-fidelity doctrine): the engine's own banana sheet via
banana_render, the real area plates, the real sprites.

    python reel.py            # render everything to out/
    python reel.py rave       # one scene
    python reel.py rave --still   # 5 preview stills only (fast iteration)
"""
import math
import os
import random
import subprocess
import sys

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
TOOLS = os.path.dirname(HERE)
SITE = os.path.dirname(TOOLS)
ASSETS = os.path.join(SITE, 'public', 'assets')
OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True)

sys.path.insert(0, TOOLS)
import banana_render  # noqa: E402  (the engine's Python mirror)

W, H = 540, 960          # logical canvas; final = 2x NEAREST -> 1080x1920
FPS = 30

# ---- asset cache ----------------------------------------------------------
_CACHE = {}


def asset(path):
    if path not in _CACHE:
        _CACHE[path] = Image.open(os.path.join(ASSETS, path)).convert('RGBA')
    return _CACHE[path]


def strip_frame(path, n_frames, idx, gap=0):
    """frame idx of a horizontal sprite strip"""
    im = asset(path)
    fw = (im.width - gap * (n_frames - 1)) // n_frames
    x = idx * (fw + gap)
    return im.crop((x, 0, x + fw, im.height))


_BANANA_CACHE = {}


def banana(frame, outfit=None, height=220):
    """the engine's banana, dressed, cropped, at a target pixel height"""
    key = (frame, str(sorted((outfit or {}).items())), height)
    if key not in _BANANA_CACHE:
        im = banana_render.render(frame % 8, outfit or {}, scale=1)
        im = im.crop(im.getbbox())
        w = round(im.width * height / im.height)
        _BANANA_CACHE[key] = im.resize((w, height), Image.NEAREST)
    return _BANANA_CACHE[key]


def scaled(path, factor):
    key = ('scaled', path, factor)
    if key not in _CACHE:
        im = asset(path)
        _CACHE[key] = im.resize((round(im.width * factor), round(im.height * factor)), Image.NEAREST)
    return _CACHE[key]


# ---- easing ---------------------------------------------------------------
def clamp01(x):
    return max(0.0, min(1.0, x))


def out_cubic(x):
    x = clamp01(x)
    return 1 - (1 - x) ** 3


def out_back(x, s=1.70158):
    x = clamp01(x)
    return 1 + (s + 1) * (x - 1) ** 3 + s * (x - 1) ** 2


def in_out(x):
    x = clamp01(x)
    return x * x * (3 - 2 * x)


def seg(t, a, b):
    """0..1 progress inside the window [a, b] of scene time t (0..1)"""
    if b <= a:
        return 1.0
    return clamp01((t - a) / (b - a))


# ---- drawing helpers ------------------------------------------------------
def sparkle(draw, x, y, r, color=(255, 253, 245, 255)):
    """4-point star"""
    draw.polygon([(x, y - r), (x + r * 0.28, y - r * 0.28), (x + r, y),
                  (x + r * 0.28, y + r * 0.28), (x, y + r),
                  (x - r * 0.28, y + r * 0.28), (x - r, y),
                  (x - r * 0.28, y - r * 0.28)], fill=color)


def sparkle_burst(im, cx, cy, t01, n=10, dist=90, seed=1, color=(255, 225, 53, 255)):
    """stars flying outward and fading over t01 0..1"""
    if t01 <= 0 or t01 >= 1:
        return
    rnd = random.Random(seed)
    d = ImageDraw.Draw(im)
    for i in range(n):
        a = rnd.uniform(0, math.tau)
        dd = dist * (0.4 + 0.6 * rnd.random()) * out_cubic(t01)
        r = (1 - t01) * rnd.uniform(4, 9)
        if r < 1:
            continue
        col = color if i % 3 else (255, 253, 245, 255)
        col = col[:3] + (round(255 * (1 - t01 * t01)),)
        sparkle(d, cx + math.cos(a) * dd, cy + math.sin(a) * dd, r, col)


def poof(im, cx, cy, t01, seed=3, big=1.0):
    """dust cloud: grey puffs expanding + fading"""
    if t01 <= 0 or t01 >= 1:
        return
    rnd = random.Random(seed)
    ov = Image.new('RGBA', im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    for i in range(8):
        a = rnd.uniform(0, math.tau)
        dd = 46 * big * out_cubic(t01) * (0.5 + 0.5 * rnd.random())
        r = big * (14 + 10 * rnd.random()) * (1 - 0.6 * t01)
        x, y = cx + math.cos(a) * dd, cy + math.sin(a) * dd * 0.6
        col = (232, 234, 242, round(210 * (1 - t01)))
        d.ellipse([x - r, y - r, x + r, y + r], fill=col)
    im.alpha_composite(ov)


def vignette(im, strength=90):
    key = ('vig', im.size, strength)
    if key not in _CACHE:
        m = Image.new('L', (im.width // 4, im.height // 4), 0)
        d = ImageDraw.Draw(m)
        d.ellipse([-m.width * 0.25, -m.height * 0.25, m.width * 1.25, m.height * 1.25], fill=255)
        m = m.resize(im.size).filter(ImageFilter.GaussianBlur(60))
        ov = Image.new('RGBA', im.size, (0, 0, 0, strength))
        ov.putalpha(Image.eval(m, lambda p: round((255 - p) * strength / 255)))
        _CACHE[key] = ov
    im.alpha_composite(_CACHE[key])


def flash(im, amount):
    """white flash overlay, amount 0..1"""
    if amount <= 0:
        return im
    ov = Image.new('RGBA', im.size, (255, 253, 245, round(255 * clamp01(amount))))
    im.alpha_composite(ov)
    return im


def paste_center(im, sprite, cx, cy, scale=1.0, rot=0):
    s = sprite
    if scale != 1.0:
        s = s.resize((max(1, round(s.width * scale)), max(1, round(s.height * scale))), Image.NEAREST)
    if rot:
        s = s.rotate(rot, expand=True, resample=Image.NEAREST)
    im.alpha_composite(s, (round(cx - s.width / 2), round(cy - s.height / 2)))


def plate_cam(plate, cx, cy, view_w):
    """crop a 9:16 window centred (cx,cy) of width view_w from a plate, -> WxH"""
    vw = view_w
    vh = vw * H / W
    x0 = max(0, min(plate.width - vw, cx - vw / 2))
    y0 = max(0, min(plate.height - vh, cy - vh / 2))
    box = (round(x0), round(y0), round(x0 + vw), round(y0 + vh))
    return plate.crop(box).resize((W, H), Image.NEAREST)


# ---- the renderer ---------------------------------------------------------
def encode(name, frames_dir, n):
    import imageio_ffmpeg
    exe = imageio_ffmpeg.get_ffmpeg_exe()
    dst = os.path.join(OUT, name + '.mp4')
    subprocess.run([exe, '-y', '-framerate', str(FPS),
                    '-i', os.path.join(frames_dir, '%04d.png'),
                    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '17',
                    '-movflags', '+faststart', dst],
                   check=True, capture_output=True)
    return dst


def render_scene(name, fn, secs=4.5, stills_only=False):
    n = round(secs * FPS)
    frames_dir = os.path.join(HERE, 'frames', name)
    os.makedirs(frames_dir, exist_ok=True)
    still_at = [0, n // 4, n // 2, 3 * n // 4, n - 1]
    for i in range(n):
        t = i / (n - 1)
        if stills_only and i not in still_at:
            continue
        im = fn(t, i)
        big = im.resize((W * 2, H * 2), Image.NEAREST).convert('RGB')
        big.save(os.path.join(frames_dir, '%04d.png' % i))
        if i in still_at:
            big.resize((W // 2, H // 2)).save(os.path.join(OUT, '_%s_%d.png' % (name, still_at.index(i))))
    if stills_only:
        print('stills:', name)
        return
    dst = encode(name, frames_dir, n)
    print('encoded:', dst, '%0.1fMB' % (os.path.getsize(dst) / 1e6))


# ═══════════════════════════════════════════════════════════════════════════
# SCENES
# ═══════════════════════════════════════════════════════════════════════════

OUTFITS = [
    {'hat': 'crown', 'glasses': 'shades'},
    {'hat': 'tophat', 'glasses': 'monocle', 'extras': ['mustache']},
    {'hat': 'fishbowl'},
    {'hat': 'sombrero', 'glasses': 'hearts'},
    {'hat': 'djheadphones', 'extras': ['boombox']},
    {'hat': 'viking', 'extras': ['goldchain']},
    {'hat': 'party', 'glasses': 'threed', 'extras': ['balloons']},
]


def scene_builder(t, i):
    """MAKE YOUR OWN BANANA — one banana, outfits swapping with pop + burst"""
    im = Image.new('RGBA', (W, H), (255, 225, 53, 255))
    # slowly rotating sunburst
    d = ImageDraw.Draw(im)
    cx, cy = W / 2, H * 0.46
    rot = t * 0.5
    for k in range(12):
        a0 = k * math.tau / 12 + rot
        d.polygon([(cx, cy),
                   (cx + math.cos(a0) * 1400, cy + math.sin(a0) * 1400),
                   (cx + math.cos(a0 + 0.13) * 1400, cy + math.sin(a0 + 0.13) * 1400)],
                  fill=(255, 236, 120, 255))
    n_looks = 6
    seg_t = (t * n_looks) % 1.0
    look = min(n_looks - 1, int(t * n_looks))
    pop = out_back(seg(seg_t, 0.0, 0.35))
    b = banana(i // 4, OUTFITS[look], height=430)
    paste_center(im, b, cx, cy, scale=0.7 + 0.3 * pop)
    sparkle_burst(im, cx, cy - 60, seg(seg_t, 0.0, 0.5), n=12, dist=230, seed=look * 7 + 1)
    # ground shadow
    d = ImageDraw.Draw(im)
    d.ellipse([cx - 130, cy + 205, cx + 130, cy + 245], fill=(200, 168, 30, 160))
    vignette(im, 60)
    return im


def scene_rave(t, i):
    """THE RAVE — dark checker floor, neon wash, a crowd of dancing bananas"""
    im = Image.new('RGBA', (W, H), (13, 11, 20, 255))
    d = ImageDraw.Draw(im)
    # colour wash cycles
    wash = [(255, 77, 157), (94, 200, 224), (94, 224, 138), (201, 156, 255)]
    wi = int(t * 8) % 4
    # checkerboard floor with slow scroll
    tile = 64
    off = round(t * 90)
    for yy in range(-1, H // tile + 2):
        for xx in range(-1, W // tile + 2):
            if (xx + yy) % 2 == 0:
                col = (26, 22, 40, 255)
            else:
                col = (16, 13, 26, 255)
            d.rectangle([xx * tile, yy * tile + off % tile - tile,
                         xx * tile + tile, yy * tile + off % tile - tile + tile], fill=col)
    # neon beams from the top
    ov = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    do = ImageDraw.Draw(ov)
    for k in range(4):
        a = math.sin(t * math.tau * 2 + k * 1.7) * 0.5
        bx = W * (0.2 + 0.2 * k)
        col = wash[(wi + k) % 4] + (60,)
        do.polygon([(bx, -10), (bx + 400 * a - 90, H), (bx + 400 * a + 90, H)], fill=col)
    im.alpha_composite(ov)
    # disco ball
    bally = 90 + math.sin(t * math.tau) * 6
    d = ImageDraw.Draw(im)
    d.line([W / 2, 0, W / 2, bally], fill=(120, 120, 140, 255), width=4)
    d.ellipse([W / 2 - 44, bally - 44, W / 2 + 44, bally + 44], fill=(200, 205, 220, 255))
    for gy in range(-40, 41, 12):
        for gx in range(-40, 41, 12):
            if gx * gx + gy * gy < 40 * 40:
                shade = 160 + ((gx + gy + round(t * 96)) // 12 % 3) * 40
                d.rectangle([W / 2 + gx, bally + gy, W / 2 + gx + 9, bally + gy + 9],
                            fill=(shade, shade, min(255, shade + 25), 255))
    # glints off the ball
    rnd = random.Random(int(t * 12))
    for _ in range(3):
        sparkle(d, rnd.uniform(40, W - 40), rnd.uniform(40, H * 0.5), rnd.uniform(4, 10),
                (255, 253, 245, 200))
    # the crowd — five bananas, different outfits, same beat
    crowd = [(-0.32, 0.16, {'hat': 'djheadphones'}, 200),
             (0.3, 0.13, {'glasses': 'shades'}, 210),
             (-0.16, 0.30, {'hat': 'party'}, 250),
             (0.18, 0.33, {'hat': 'crown', 'glasses': 'hearts'}, 260),
             (0.0, 0.05, {'glasses': 'dwi'}, 170)]
    crowd.sort(key=lambda c: c[1])
    for k, (ox, oy, fit, hh) in enumerate(crowd):
        bb = banana((i // 4 + k) % 8, fit, height=hh)
        bounce = abs(math.sin((i / 4 + k) * math.pi / 2)) * 8
        paste_center(im, bb, W / 2 + ox * W, H * 0.52 + oy * H - bounce)
    # colour pulse overlay on the beat
    pulse = max(0.0, math.sin(t * math.tau * 8)) ** 6
    ov2 = Image.new('RGBA', (W, H), wash[wi] + (round(34 * pulse),))
    im.alpha_composite(ov2)
    vignette(im, 120)
    # strobe hits at thirds
    for hit in (0.33, 0.66):
        f = seg(t, hit, hit + 0.05)
        if 0 < f < 1:
            flash(im, (1 - f) * 0.5)
    return im


def draw_bar(d, x, y, w, h, col=(26, 20, 8, 255), r=None):
    """a redacted-text bar (placeholder — Trym adds real text in post)"""
    r = r if r is not None else h / 2
    d.rounded_rectangle([x, y, x + w, y + h], radius=r, fill=col)


def pass_card(width=430):
    """the official pass card, text-free: bars stand in for words"""
    sc = 2
    cw, ch = width, round(width * 128 / 220)
    im = Image.new('RGBA', (cw * sc, ch * sc), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    S = cw * sc / 220
    d.rounded_rectangle([0, 0, 220 * S - 1, 128 * S - 1], radius=8 * S, fill=(20, 16, 31, 255))
    d.rounded_rectangle([3 * S, 3 * S, 217 * S, 125 * S], radius=6 * S, fill=(255, 225, 53, 255))
    # header strip + punched hole
    d.rounded_rectangle([8 * S, 8 * S, 212 * S, 28 * S], radius=4 * S, fill=(20, 20, 20, 255))
    draw_bar(d, 14 * S, 14 * S, 120 * S, 8 * S, (255, 225, 53, 255))
    d.ellipse([198 * S, 14 * S, 206 * S, 22 * S], fill=(255, 253, 245, 255))
    # the banana portrait
    b = banana(0, {'glasses': 'shades'}, height=round(60 * S))
    im.alpha_composite(b, (round(12 * S), round(32 * S)))
    # name/meta bars
    draw_bar(d, 76 * S, 40 * S, 100 * S, 11 * S)
    draw_bar(d, 76 * S, 58 * S, 70 * S, 7 * S, (20, 20, 20, 140))
    d.rounded_rectangle([76 * S, 72 * S, 148 * S, 87 * S], radius=3 * S, fill=(20, 20, 20, 255))
    draw_bar(d, 82 * S, 77 * S, 58 * S, 5 * S, (255, 225, 53, 255))
    # barcode
    rnd = random.Random(9)
    bx = 12 * S
    while bx < 80 * S:
        bw = rnd.choice([2, 3, 4]) * S
        if rnd.random() > 0.4:
            d.rectangle([bx, 102 * S, bx + bw, 118 * S], fill=(20, 20, 20, 255))
        bx += bw + 2 * S
    return im, S


def scene_pass(t, i):
    """MY PASS — card slides up, shine sweeps, red stamp SLAMS"""
    im = Image.new('RGBA', (W, H), (13, 11, 22, 255))
    d = ImageDraw.Draw(im)
    # drifting confetti bg
    rnd = random.Random(4)
    for k in range(26):
        x = rnd.uniform(0, W)
        y = (rnd.uniform(0, H) + t * 120 * rnd.uniform(0.5, 1.5)) % H
        col = [(255, 225, 53), (255, 93, 143), (94, 200, 224), (94, 224, 138)][k % 4]
        d.rectangle([x, y, x + 7, y + 7], fill=col + (120,))
    card, S = pass_card(430)
    # slide in with bounce
    enter = out_back(seg(t, 0.0, 0.28))
    cy = H * 0.42 + (1 - enter) * H * 0.7
    rot = math.sin(t * math.tau) * 1.6
    c2 = card.rotate(rot - 3, expand=True, resample=Image.BICUBIC)
    tmp = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    paste_center(tmp, c2, W / 2, cy, scale=0.5)
    # shine sweep
    sh = seg(t, 0.34, 0.58)
    if 0 < sh < 1:
        ov = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        do = ImageDraw.Draw(ov)
        x = -200 + sh * (W + 400)
        do.polygon([(x, 0), (x + 90, 0), (x - 60, H), (x - 150, H)], fill=(255, 255, 255, 90))
        mask = tmp.split()[3]
        ov.putalpha(Image.composite(ov.split()[3], Image.new('L', (W, H), 0), mask))
        tmp.alpha_composite(ov)
    im.alpha_composite(tmp)
    # the STAMP — red ring slams down
    st = seg(t, 0.62, 0.78)
    if st > 0:
        sc = 3.2 - 2.2 * out_cubic(st)
        alpha = round(235 * min(1, st * 3))
        ov = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        do = ImageDraw.Draw(ov)
        r = 74 * sc
        cxs, cys = W / 2 + 88, cy + 66
        do.ellipse([cxs - r, cys - r, cxs + r, cys + r], outline=(226, 32, 32, alpha), width=round(7 * sc))
        do.ellipse([cxs - r * 0.8, cys - r * 0.8, cxs + r * 0.8, cys + r * 0.8],
                   outline=(226, 32, 32, alpha), width=round(3 * sc))
        bb = banana(2, None, height=round(74 * sc))
        bmask = bb.copy()
        red = Image.new('RGBA', bb.size, (226, 32, 32, alpha))
        red.putalpha(Image.eval(bb.split()[3], lambda p: round(p * alpha / 255)))
        ov.alpha_composite(red, (round(cxs - bb.width / 2), round(cys - bb.height / 2)))
        ov = ov.rotate(-9, center=(cxs, cys), resample=Image.BICUBIC)
        im.alpha_composite(ov)
        if 0.05 < st < 0.6:
            sparkle_burst(im, cxs, cys, seg(st, 0.05, 0.6), n=10, dist=150, seed=11, color=(255, 93, 143, 255))
    # camera shake on the slam
    hit = seg(t, 0.62, 0.68)
    if 0 < hit < 1:
        dx = round(math.sin(hit * 40) * 8 * (1 - hit))
        im = im.transform(im.size, Image.AFFINE, (1, 0, dx, 0, 1, 0))
    vignette(im, 90)
    return im


def walker(im, path, n_frames, fw, idx, x, y, height, flip=False):
    fr = strip_frame(path, n_frames, idx % n_frames)
    if flip:
        fr = fr.transpose(Image.FLIP_LEFT_RIGHT)
    h = height
    w = round(fr.width * h / fr.height)
    fr = fr.resize((w, h), Image.NEAREST)
    im.alpha_composite(fr, (round(x - w / 2), round(y - h)))


def scene_park(t, i):
    """THE PARK — a slow pan across the real plate, critters + birds + a stroll"""
    plate = asset('park/park.png')
    cx = 700 + in_out(t) * 1300
    im = plate_cam(plate, cx, 560, 560)
    sc = 560 / W  # world px per screen px is uniform; sprites drawn in screen space
    # a strolling banana keeping pace with the camera
    b = banana(i // 4, {'hat': 'cowboy'}, height=180)
    im.alpha_composite(b, (round(W * 0.5 - b.width / 2 + math.sin(t * 6) * 4), round(H * 0.58)))
    # critters wander through
    walker(im, 'park/a-chicken1.png', 6, 36, i // 5, W * 0.22 + t * 60, H * 0.78, 64)
    walker(im, 'park/a-rabbit.png', 6, 72, i // 5, W * 0.8 - t * 220, H * 0.88, 76, flip=True)
    # birds crossing the sky
    bird = asset('park/bird-blue-jay.png').crop((32 * (i // 4 % 2), 0, 32 * (i // 4 % 2) + 32, 32))
    bird = bird.resize((56, 56), Image.NEAREST)
    im.alpha_composite(bird, (round(-60 + t * (W + 160)), round(H * 0.12 + math.sin(t * 9) * 22)))
    bird2 = bird.transpose(Image.FLIP_LEFT_RIGHT)
    im.alpha_composite(bird2, (round(W + 40 - t * (W + 200)), round(H * 0.2 + math.cos(t * 7) * 18)))
    # drifting petals
    rnd = random.Random(7)
    d = ImageDraw.Draw(im)
    for k in range(12):
        px = (rnd.uniform(0, W) + t * 140 * rnd.uniform(0.4, 1)) % W
        py = (rnd.uniform(0, H) + t * 60) % H
        d.rectangle([px, py, px + 5, py + 5], fill=(255, 214, 232, 170))
    vignette(im, 60)
    return im


def scene_bay(t, i):
    """BANANA BAY — shoreline pan: foam, gull, crab, glinting coins"""
    plate = asset('beach/beach.png')
    cx = 2100 - in_out(t) * 1300
    im = plate_cam(plate, cx, 520, 560)
    # animated foam along the waterline (the plate's own foam strip, re-laid)
    foam = strip_frame('beach/foam.png', 6, i // 6)
    fw = round(foam.width * 1.6)
    foam = foam.resize((fw, round(foam.height * 1.6)), Image.NEAREST)
    yline = round(H * 0.245)
    shift = round((cx * -1) % fw)
    for x in range(-fw, W + fw, fw):
        im.alpha_composite(foam, (x + shift, yline))
    # gull crossing
    walker(im, 'beach/a-gull.png', 6, 48, i // 4, W * 0.2 + t * W * 0.9, H * 0.12, 60)
    # crab scuttling the sand
    walker(im, 'beach/a-crab.png', 20, 48, i // 3, W * 0.75 - t * 260, H * 0.62, 56)
    # a banana with a snorkel bounding along
    b = banana(i // 4, {'glasses': 'snorkelmask'}, height=190)
    im.alpha_composite(b, (round(W * 0.36 - b.width / 2), round(H * 0.66 - abs(math.sin(t * 12)) * 14)))
    # coin glints on the sand
    coin = strip_frame('banana-stand/coin-spin.png', 6, i // 5)
    coin = coin.resize((40, 40), Image.NEAREST)
    for k, (ox, oy) in enumerate([(0.62, 0.8), (0.18, 0.88), (0.82, 0.72)]):
        im.alpha_composite(coin, (round(W * ox), round(H * oy)))
    d = ImageDraw.Draw(im)
    rnd = random.Random(int(t * 10))
    for _ in range(2):
        sparkle(d, rnd.uniform(30, W - 30), rnd.uniform(H * 0.6, H * 0.95), rnd.uniform(3, 7))
    vignette(im, 60)
    return im


HS_SPOT = (1050, 560)   # the plot, in homestead-plate coords


def scene_homestead(t, i):
    """THE HOMESTEAD — tent pops, fence builds, decor lands, HOUSE upgrade"""
    plate = asset('homestead/homestead.png').copy()
    px, py = HS_SPOT
    layer = Image.new('RGBA', plate.size, (0, 0, 0, 0))

    # 1) tent pops in
    tp = out_back(seg(t, 0.06, 0.16))
    house_t = seg(t, 0.74, 0.86)
    if tp > 0 and house_t <= 0:
        tent = scaled('homestead/ov-tent1.png', 1.3)
        paste_center(layer, tent, px, py - tent.height * 0.28, scale=max(0.05, tp))
    # 2) fence rises
    fs = seg(t, 0.2, 0.34)
    if fs > 0:
        yard = asset('homestead/ov-fyard1.png')
        south = asset('homestead/ov-fsouth1.png')
        fx, fy = px - yard.width / 2, py - 190
        n_show = round(out_cubic(fs) * 100)
        crop_w = max(2, round(yard.width * n_show / 100))
        layer.alpha_composite(yard.crop((0, 0, crop_w, yard.height)), (round(fx), round(fy)))
        layer.alpha_composite(south.crop((0, 0, crop_w, south.height)), (round(fx), round(fy + 332)))
    # 3) decor pops, staggered
    DECOR = [('homestead/d-bench.png', -170, 108, 1.4, 0.38),
             ('park/a-fountain.png', 150, 60, 0.8, 0.46),
             ('homestead/d-birdhouse.png', -220, -60, 1.6, 0.54),
             ('homestead/m-mail.png', 235, 128, 1.4, 0.6)]
    for pth, ox, oy, sc2, at in DECOR:
        pp = out_back(seg(t, at, at + 0.09))
        if pp > 0:
            if 'fountain' in pth:
                spr = strip_frame(pth, 3, i // 5)
                spr = spr.resize((round(spr.width * sc2), round(spr.height * sc2)), Image.NEAREST)
            else:
                spr = scaled(pth, sc2)
            paste_center(layer, spr, px + ox, py + oy, scale=max(0.05, pp))
    # flowers sprinkle
    for k, (ox, oy) in enumerate([(-100, 150), (-40, 170), (40, 160), (110, 175)]):
        fp = out_back(seg(t, 0.62 + k * 0.025, 0.68 + k * 0.025))
        if fp > 0:
            fl = scaled('park/b-marigold.png', 2.2)
            paste_center(layer, fl, px + ox, py + oy, scale=max(0.05, fp))
    # 4) THE HOUSE lands
    if house_t > 0:
        hp = out_back(house_t)
        house = scaled('homestead/ov-country.png', 1.1)
        paste_center(layer, house, px, py - house.height * 0.3, scale=max(0.05, hp))
    plate.alpha_composite(layer)

    # camera: slow zoom OUT from the plot
    vw = 430 + in_out(t) * 260
    im = plate_cam(plate, px, py - 40, vw)
    # scale factor world->screen for effect anchors
    k = W / vw
    sx, sy = W / 2, (py - 40 - (py - 40) + H / (2 * k)) * k  # centre-ish
    cy_screen = H / 2
    # poofs + bursts in screen space
    for at, big in [(0.06, 1.2), (0.2, 0.9), (0.74, 1.6)]:
        pf = seg(t, at, at + 0.14)
        poof(im, W / 2, cy_screen - 40, pf, seed=int(at * 100), big=big)
    burst = seg(t, 0.86, 1.0)
    sparkle_burst(im, W / 2, cy_screen - 80, burst, n=16, dist=260, seed=5)
    # confetti at the end
    if t > 0.86:
        rnd = random.Random(12)
        d = ImageDraw.Draw(im)
        for kk in range(30):
            fall = (t - 0.86) / 0.14
            x = rnd.uniform(0, W)
            y = rnd.uniform(-H * 0.3, H * 0.2) + fall * H * 0.9 * rnd.uniform(0.6, 1.2)
            col = [(255, 225, 53), (255, 93, 143), (94, 200, 224), (94, 224, 138)][kk % 4]
            d.rectangle([x, y, x + 8, y + 8], fill=col + (220,))
    vignette(im, 60)
    return im


def _svg_rects(name):
    """the engine's pixel-SVG accessory art as [(x,y,w,h,(r,g,b))]"""
    import re as _re
    svg = banana_render.SVGS[name]
    out = []
    for m in _re.finditer(r'<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)" fill="(#\w+)"', svg):
        x, y, w, h = (float(m.group(k)) for k in range(1, 5))
        hexc = m.group(5).lstrip('#')
        col = tuple(int(hexc[j:j + 2], 16) for j in (0, 2, 4))
        out.append((x, y, w, h, col))
    return out


def scene_items(t, i):
    """ITEMS WORKSHOP — a hat drawn pixel by pixel, worn; a couch lands in a room"""
    im = Image.new('RGBA', (W, H), (26, 20, 8, 255))
    d = ImageDraw.Draw(im)
    # workshop wall: subtle plank stripes
    for y in range(0, H, 90):
        d.rectangle([0, y, W, y + 45], fill=(31, 24, 10, 255))
    beat2 = seg(t, 0.55, 1.0)
    if beat2 <= 0:
        bt = seg(t, 0.0, 0.52)
        # the canvas panel
        d.rounded_rectangle([W * 0.1, H * 0.16, W * 0.9, H * 0.62], radius=18, fill=(20, 16, 31, 255),
                            outline=(255, 225, 53, 255), width=5)
        # grid
        g0x, g0y, cell = W * 0.17, H * 0.2, (W * 0.66) / 15
        for gx in range(16):
            d.line([g0x + gx * cell, g0y, g0x + gx * cell, g0y + 15 * cell], fill=(46, 38, 68, 255))
            d.line([g0x, g0y + gx * cell, g0x + 15 * cell, g0y + gx * cell], fill=(46, 38, 68, 255))
        rects = _svg_rects('tophat')
        # svg space is 13px units*10; normalise to grid
        xs = [r[0] for r in rects]; ys = [r[1] for r in rects]
        ws = [r[0] + r[2] for r in rects]; hs = [r[1] + r[3] for r in rects]
        span = max(max(ws) - min(xs), max(hs) - min(ys))
        u = 13 * cell / span
        shown = round(out_cubic(bt) * len(rects))
        rnd = random.Random(2)
        order = list(range(len(rects))); rnd.shuffle(order)
        for k in order[:shown]:
            x, y, w2, h2, col = rects[k]
            X = g0x + cell + (x - min(xs)) * u
            Y = g0y + cell + (y - min(ys)) * u
            d.rectangle([X, Y, X + w2 * u, Y + h2 * u], fill=col + (255,))
        # cursor blip at the newest pixel
        if shown and shown < len(rects):
            x, y, w2, h2, col = rects[order[min(shown, len(rects) - 1)]]
            X = g0x + cell + (x - min(xs)) * u; Y = g0y + cell + (y - min(ys)) * u
            d.rectangle([X - 3, Y - 3, X + w2 * u + 3, Y + h2 * u + 3], outline=(255, 253, 245, 255), width=3)
        # the banana waits below, undressed
        b = banana(i // 4, None, height=250)
        paste_center(im, b, W / 2, H * 0.82)
    else:
        # the hat POPS onto the banana
        hp = out_back(seg(beat2, 0.0, 0.3))
        b = banana(i // 4, {'hat': 'tophat'}, height=330)
        paste_center(im, b, W / 2 - 90, H * 0.42, scale=0.75 + 0.25 * hp)
        sparkle_burst(im, W / 2 - 90, H * 0.3, seg(beat2, 0.0, 0.45), n=12, dist=190, seed=21)
        # ...and a couch lands in a real room
        room = asset('homestead/in-wood3.png')
        rw = round(W * 0.86)
        room2 = room.resize((rw, round(room.height * rw / room.width)), Image.NEAREST)
        ry = round(H * 0.6)
        im.alpha_composite(room2, (round(W * 0.07), ry))
        cp = out_back(seg(beat2, 0.35, 0.6))
        if cp > 0:
            couch = scaled('homestead/d-bigcouch.png', 2.6)
            drop = (1 - cp) * -140
            paste_center(im, couch, W / 2, ry + room2.height * 0.62 + drop, scale=max(0.1, cp))
        pf = seg(beat2, 0.52, 0.72)
        poof(im, W / 2, ry + room2.height * 0.65, pf, seed=8, big=1.2)
        sparkle_burst(im, W / 2, ry + room2.height * 0.55, seg(beat2, 0.6, 1.0), n=10, dist=160, seed=9)
    vignette(im, 80)
    return im


NIB = {'hat': 'tophat', 'glasses': 'potter', 'extras': ['necktie']}


def gold_mark(im, x, y, t, q=False):
    """the quest ! — gold, black outline, bobbing with a glow"""
    bob = math.sin(t * math.tau * 2) * 8
    y = y + bob
    ov = Image.new('RGBA', im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    glow = 30 + 14 * (0.5 + 0.5 * math.sin(t * math.tau * 3))
    d.ellipse([x - glow, y - glow - 10, x + glow, y + glow + 10], fill=(255, 210, 63, 60))
    def px_rect(x0, y0, w, h, col):
        u = 3
        d.rectangle([x + (x0 - 7) * u, y + (y0 - 12) * u, x + (x0 - 7 + w) * u, y + (y0 - 12 + h) * u], fill=col)
    # the thin ! from MARK_SVG (14x24 grid)
    px_rect(4, 0, 6, 10, (17, 17, 17, 255)); px_rect(4, 17, 6, 5, (17, 17, 17, 255))
    px_rect(5, 1, 4, 8, (255, 210, 63, 255)); px_rect(5, 18, 4, 3, (255, 210, 63, 255))
    px_rect(5, 1, 2, 8, (255, 243, 168, 255)); px_rect(5, 18, 1, 3, (255, 243, 168, 255))
    im.alpha_composite(ov)


def scene_quest(t, i):
    """THE QUESTLINE — Nib waits with the golden !, you walk up, the letter"""
    plate = asset('homestead/homestead.png')
    im = plate_cam(plate, 1150, 700, 520)
    nib_x, nib_y = W * 0.64, H * 0.55
    nib = banana(0, NIB, height=210)
    im.alpha_composite(nib, (round(nib_x - nib.width / 2), round(nib_y - nib.height)))
    gold_mark(im, nib_x, nib_y - 248, t)
    # the player walks in from the left
    wt = in_out(seg(t, 0.05, 0.45))
    pxx = -80 + wt * (W * 0.36 + 80)
    pb = banana(i // 3 if wt < 1 else 0, {'hat': 'backwardscap'}, height=210)
    im.alpha_composite(pb, (round(pxx - pb.width / 2), round(H * 0.60 - pb.height)))
    # the letter unfurls
    lt = seg(t, 0.55, 0.75)
    if lt > 0:
        un = out_cubic(lt)
        pw, ph = W * 0.56, H * 0.23 * un
        ox, oy = W / 2 - pw / 2, H * 0.22 - ph / 2
        ov = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        do = ImageDraw.Draw(ov)
        # torn parchment
        rnd = random.Random(6)
        pts = [(ox + k * pw / 8, oy + rnd.uniform(-6, 6)) for k in range(9)]
        pts += [(ox + pw + rnd.uniform(-5, 5), oy + k * ph / 4) for k in range(1, 5)]
        pts += [(ox + pw - k * pw / 8, oy + ph + rnd.uniform(-6, 6)) for k in range(9)]
        pts += [(ox + rnd.uniform(-5, 5), oy + ph - k * ph / 4) for k in range(1, 5)]
        do.polygon(pts, fill=(246, 236, 208, 250), outline=(107, 74, 36, 255))
        # ruled lines + handwriting squiggles (abstract — no readable text)
        if ph > 40:
            yy = oy + 26
            rnd2 = random.Random(3)
            while yy < oy + ph - 18:
                do.line([ox + 22, yy, ox + pw - 22, yy], fill=(122, 88, 40, 60), width=2)
                sx = ox + 26
                while sx < ox + pw - 40:
                    seg_w = rnd2.uniform(18, 52)
                    do.line([sx, yy - 6 + rnd2.uniform(-2, 2), sx + seg_w, yy - 6 + rnd2.uniform(-2, 2)],
                            fill=(97, 72, 42, 150), width=2)
                    sx += seg_w + rnd2.uniform(8, 18)
                yy += 34
        ov = ov.rotate(-2, center=(W / 2, H * 0.22), resample=Image.BICUBIC)
        im.alpha_composite(ov)
    sparkle_burst(im, W / 2, H * 0.22, seg(t, 0.55, 0.8), n=8, dist=180, seed=14)
    vignette(im, 80)
    return im


def scene_shops(t, i):
    """SHOPS — the banana stand: shopkeeper, goods, coins flying in"""
    bg = asset('banana-stand/park.png')
    im = bg.resize((W, round(bg.height * W / bg.width)), Image.NEAREST)
    canvas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    canvas.alpha_composite(im, (0, round((H - im.height) / 2) - 60))
    # top/bottom fill
    d = ImageDraw.Draw(canvas)
    d.rectangle([0, 0, W, round((H - im.height) / 2) - 60], fill=(58, 121, 59, 255))
    d.rectangle([0, round((H - im.height) / 2) - 60 + im.height, W, H], fill=(58, 121, 59, 255))
    im = canvas
    # the stand pops up first
    sp = out_back(seg(t, 0.0, 0.18))
    hut = scaled('banana-stand/hut.png', 3.4)
    hx, hy = W / 2, H * 0.45
    if sp > 0:
        paste_center(im, hut, hx, hy, scale=max(0.05, sp))
    poof(im, hx, hy + 80, seg(t, 0.1, 0.26), seed=4, big=1.5)
    # the shopkeeper pops up IN the window, then goods land on the sill
    if t > 0.2:
        rise = out_back(seg(t, 0.2, 0.3))
        keeper = banana(i // 4, {'hat': 'buckethat', 'extras': ['mustache']}, height=150)
        kw = Image.new('RGBA', (keeper.width, keeper.height), (0, 0, 0, 0))
        kw.alpha_composite(keeper)
        show_h = round(keeper.height * 0.62 * rise)
        if show_h > 2:
            crop = kw.crop((0, 0, kw.width, show_h))
            im.alpha_composite(crop, (round(hx - kw.width / 2), round(hy + 46 - show_h)))
        # the counter sill re-drawn over the keeper's waist
        sill = hut.crop((0, round(hut.height * 0.72), hut.width, hut.height))
        im.alpha_composite(sill, (round(hx - hut.width / 2), round(hy - hut.height / 2 + hut.height * 0.72)))
    GOODS = [('banana-stand/ticket.png', -92, 1.0, 0.36), ('banana-stand/stack.png', 4, 1.6, 0.44),
             ('banana-stand/coins.png', 92, 1.8, 0.52)]
    for pth, ox, sc2, at in GOODS:
        gp = out_back(seg(t, at, at + 0.1))
        if gp > 0:
            spr = scaled(pth, sc2)
            paste_center(im, spr, hx + ox, hy + 88, scale=max(0.05, gp))
    # coins fly in from the customer side
    for k in range(5):
        ct = seg(t, 0.55 + k * 0.07, 0.75 + k * 0.07)
        if 0 < ct < 1:
            e = in_out(ct)
            x = W * 0.9 - e * (W * 0.9 - hx)
            y = H * 0.86 - math.sin(e * math.pi) * 260 - e * (H * 0.86 - hy - 60)
            coin = strip_frame('banana-stand/coin-spin.png', 6, (i + k) // 3)
            coin = coin.resize((46, 46), Image.NEAREST)
            paste_center(im, coin, x, y)
    sparkle_burst(im, hx, hy + 30, seg(t, 0.8, 1.0), n=12, dist=180, seed=17)
    vignette(im, 70)
    return im


def scene_stalls(t, i):
    """GAME-STALLS — the pier claw machine grabs a plush banana"""
    im = Image.new('RGBA', (W, H), (20, 16, 31, 255))
    d = ImageDraw.Draw(im)
    # boardwalk planks
    for y in range(round(H * 0.72), H, 34):
        d.rectangle([0, y, W, y + 17], fill=(124, 86, 47, 255))
        d.rectangle([0, y + 17, W, y + 34], fill=(107, 74, 36, 255))
    # cabinet
    cw, chh = W * 0.72, H * 0.58
    cx0, cy0 = W / 2 - cw / 2, H * 0.14
    d.rounded_rectangle([cx0 - 14, cy0 - 14, cx0 + cw + 14, cy0 + chh + 40], radius=16,
                        fill=(226, 32, 32, 255), outline=(17, 17, 17, 255), width=6)
    d.rectangle([cx0, cy0 + 30, cx0 + cw, cy0 + chh], fill=(29, 24, 48, 255))
    # marquee bulbs chase
    for k in range(14):
        on = (k + i // 4) % 3 == 0
        bx = cx0 - 2 + k * (cw + 4) / 13
        d.ellipse([bx - 6, cy0 - 8, bx + 6, cy0 + 4], fill=(255, 225, 53, 255) if on else (120, 90, 20, 255))
    # plush pile: little bananas
    pile = [(0.18, 0.86, 3), (0.36, 0.9, 5), (0.56, 0.86, 1), (0.74, 0.9, 6), (0.3, 0.95, 0),
            (0.5, 0.95, 2), (0.68, 0.96, 4), (0.85, 0.92, 7)]
    for k, (ox, oy, pf) in enumerate(pile):
        pb = banana(pf, None, height=92)
        pb = pb.rotate([-14, 8, -6, 12, 4, -9, 6, -12][k % 8], expand=True, resample=Image.NEAREST)
        im.alpha_composite(pb, (round(cx0 + ox * cw - pb.width / 2), round(cy0 + chh * 0.985 - pb.height)))
    # THE CLAW — track, drop, grab, lift
    drop = in_out(seg(t, 0.18, 0.42))
    lift = in_out(seg(t, 0.62, 0.9))
    claw_x = cx0 + cw * 0.42
    top_y = cy0 + 44
    grab_y = cy0 + chh - 96
    cy = top_y + (grab_y - top_y) * (drop - lift if lift < 1 else 0)
    cy = top_y + (grab_y - top_y) * max(0.0, drop - lift)
    d.rectangle([cx0, top_y - 12, cx0 + cw, top_y - 4], fill=(90, 90, 110, 255))
    d.line([claw_x, top_y - 6, claw_x, cy], fill=(200, 205, 220, 255), width=5)
    closed = t > 0.46
    spread = 26 if not closed else 12
    for sgn in (-1, 1):
        d.line([claw_x, cy, claw_x + sgn * spread, cy + 34], fill=(230, 234, 245, 255), width=8)
        d.line([claw_x + sgn * spread, cy + 34, claw_x + sgn * (spread - 8), cy + 52], fill=(230, 234, 245, 255), width=8)
    # the caught plush rides the claw up
    if closed:
        pb = banana(2, None, height=92)
        im.alpha_composite(pb, (round(claw_x - pb.width / 2), round(cy + 24)))
    if 0 < seg(t, 0.44, 0.5) < 1:
        sparkle_burst(im, claw_x, grab_y + 30, seg(t, 0.44, 0.58), n=8, dist=110, seed=19)
    # prize glow at the end
    end = seg(t, 0.9, 1.0)
    if end > 0:
        sparkle_burst(im, claw_x, top_y + 60, end, n=12, dist=160, seed=23)
    vignette(im, 90)
    return im


def scene_treasure(t, i):
    """TREASURE HUNT — map unfurls, circle draws, dig, the CHEST"""
    plate = asset('beach/beach.png')
    im = plate_cam(plate, 520, 620, 560)
    # beat 1: the torn map
    mt = seg(t, 0.02, 0.4)
    if t < 0.5:
        un = out_cubic(seg(mt, 0.0, 0.5))
        mw, mh = W * 0.78, H * 0.34 * un
        ox, oy = W / 2 - mw / 2, H * 0.3 - mh / 2
        ov = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        do = ImageDraw.Draw(ov)
        rnd = random.Random(5)
        pts = [(ox + k * mw / 10, oy + rnd.uniform(-7, 7)) for k in range(11)]
        pts += [(ox + mw + rnd.uniform(-6, 6), oy + k * mh / 4) for k in range(1, 5)]
        pts += [(ox + mw - k * mw / 10, oy + mh + rnd.uniform(-7, 7)) for k in range(11)]
        pts += [(ox + rnd.uniform(-6, 6), oy + mh - k * mh / 4) for k in range(1, 5)]
        do.polygon(pts, fill=(217, 194, 144, 252), outline=(107, 74, 36, 255))
        if mh > 60:
            # map marks: sea band, pier, palms
            do.rectangle([ox + 16, oy + 14, ox + mw - 16, oy + mh * 0.3], fill=(159, 185, 189, 255))
            do.rectangle([ox + mw * 0.7, oy + 14, ox + mw * 0.78, oy + mh * 0.45], fill=(143, 106, 63, 255))
            for pxx in (0.2, 0.5):
                do.ellipse([ox + mw * pxx, oy + mh * 0.55, ox + mw * pxx + 22, oy + mh * 0.55 + 22],
                           fill=(109, 138, 90, 255))
            # the red circle draws itself on
            ct2 = seg(mt, 0.5, 1.0)
            if ct2 > 0:
                cxm, cym, r = ox + mw * 0.32, oy + mh * 0.52, 52
                arc = round(360 * out_cubic(ct2))
                do.arc([cxm - r, cym - r, cxm + r, cym + r], start=-90, end=-90 + arc,
                       fill=(176, 50, 38, 255), width=8)
        ov = ov.rotate(-2.5, center=(W / 2, H * 0.3), resample=Image.BICUBIC)
        im.alpha_composite(ov)
    # beat 2: dig + chest
    dt = seg(t, 0.5, 0.72)
    if dt > 0:
        dx, dy = W / 2, H * 0.62
        d = ImageDraw.Draw(im)
        # the mound grows
        mr = 20 + out_cubic(dt) * 60
        d.ellipse([dx - mr, dy - mr * 0.45, dx + mr, dy + mr * 0.45], fill=(194, 178, 128, 255))
        d.ellipse([dx - mr * 0.7, dy - mr * 0.5, dx + mr * 0.7, dy + mr * 0.28], fill=(226, 212, 166, 255))
        # sand flying
        rnd = random.Random(int(t * 24))
        if dt < 1:
            for _ in range(8):
                a = rnd.uniform(-math.pi, 0)
                dd2 = rnd.uniform(30, 110)
                d.ellipse([dx + math.cos(a) * dd2 - 5, dy + math.sin(a) * dd2 * 0.9 - 5,
                           dx + math.cos(a) * dd2 + 5, dy + math.sin(a) * dd2 * 0.9 + 5],
                          fill=(208, 190, 140, 230))
    ch = seg(t, 0.74, 0.88)
    if ch > 0:
        chest = scaled('banana-stand/chest.png', 2.2)
        rise = out_back(ch)
        # golden glow behind
        ov = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        do = ImageDraw.Draw(ov)
        gr = 130 * rise
        do.ellipse([W / 2 - gr, H * 0.56 - gr, W / 2 + gr, H * 0.56 + gr], fill=(255, 225, 53, 70))
        im.alpha_composite(ov)
        paste_center(im, chest, W / 2, H * 0.56 - rise * 60, scale=max(0.1, rise))
        # coins burst
        sparkle_burst(im, W / 2, H * 0.5, seg(t, 0.8, 1.0), n=14, dist=240, seed=25)
        coin = strip_frame('banana-stand/coin-spin.png', 6, i // 3)
        coin = coin.resize((44, 44), Image.NEAREST)
        rnd = random.Random(31)
        bt2 = seg(t, 0.78, 1.0)
        for k in range(6):
            a = rnd.uniform(-math.pi * 0.9, -math.pi * 0.1)
            dd2 = 190 * out_cubic(bt2)
            paste_center(im, coin, W / 2 + math.cos(a) * dd2,
                         H * 0.52 + math.sin(a) * dd2 + bt2 * bt2 * 160)
    vignette(im, 70)
    return im


def scene_fishing(t, i):
    """FISHING — cast off the pier, bob, ripples, the CATCH leaps"""
    plate = asset('beach/beach.png')
    im = plate_cam(plate, 1860, 480, 520)   # the pier, sea at the top
    rod_x, rod_y = W * 0.52, H * 0.40
    # the angler on the pier
    b = banana(0 if t > 0.1 else i // 4, {'hat': 'buckethat'}, height=200)
    im.alpha_composite(b, (round(rod_x - b.width / 2 + 30), round(rod_y - 30)))
    d = ImageDraw.Draw(im)
    # cast: line flies out in an arc
    cast = in_out(seg(t, 0.06, 0.22))
    bob_x = rod_x - cast * 190
    bob_y = H * 0.20
    tip_x, tip_y = rod_x - 26, rod_y + 6
    if cast > 0:
        mid_x, mid_y = (tip_x + bob_x) / 2, min(tip_y, bob_y) - 90 * (1 - cast * 0.5)
        pts = []
        for k in range(21):
            u = k / 20
            x = (1 - u) ** 2 * tip_x + 2 * (1 - u) * u * mid_x + u * u * bob_x
            y = (1 - u) ** 2 * tip_y + 2 * (1 - u) * u * mid_y + u * u * bob_y
            pts.append((x, y))
        d.line(pts, fill=(255, 253, 245, 220), width=3)
        # the float
        fb = strip_frame('beach/a-floatball.png', 6, i // 5)
        fb = fb.resize((52, 52), Image.NEAREST)
        dip = 10 * math.sin(i / 3) if seg(t, 0.5, 0.62) > 0 else 0
        strike = seg(t, 0.55, 0.62)
        paste_center(im, fb, bob_x, bob_y + (4 if cast < 1 else 10) + dip * strike)
        # ripple rings
        for k in range(3):
            rt = ((t * 2 + k * 0.33) % 1)
            rr = 14 + rt * 46
            alpha = round(180 * (1 - rt))
            d.ellipse([bob_x - rr, bob_y + 10 - rr * 0.4, bob_x + rr, bob_y + 10 + rr * 0.4],
                      outline=(224, 244, 255, alpha), width=3)
    # THE CATCH — a fish leaps with splash
    ct = seg(t, 0.66, 0.92)
    if ct > 0:
        leap = math.sin(min(1, ct) * math.pi)
        fish = strip_frame('beach/a-fish2.png', 14, i // 3)
        fish = fish.resize((110, 110), Image.NEAREST).rotate(-40 + 80 * ct, resample=Image.NEAREST, expand=True)
        paste_center(im, fish, bob_x + ct * 60, bob_y + 20 - leap * 120)
        # splash
        sp2 = seg(ct, 0.0, 0.4)
        if 0 < sp2 < 1:
            rnd = random.Random(27)
            for _ in range(10):
                a = rnd.uniform(-math.pi, 0)
                dd2 = rnd.uniform(20, 90) * out_cubic(sp2)
                d.ellipse([bob_x + math.cos(a) * dd2 - 5, bob_y + math.sin(a) * dd2 - 5,
                           bob_x + math.cos(a) * dd2 + 5, bob_y + math.sin(a) * dd2 + 5],
                          fill=(224, 244, 255, round(230 * (1 - sp2))))
        sparkle_burst(im, bob_x + 40, bob_y - 150, seg(t, 0.72, 1.0), n=10, dist=170, seed=29)
    vignette(im, 70)
    return im


def scene_tending(t, i):
    """LOOK AFTER THE PARK — water a wilting flower back to life, pull a weed"""
    plate = asset('park/park.png')
    im = plate_cam(plate, 2450, 420, 460)   # near Peel's flowerbed corner
    # the bed: a neat row of soil tiles
    wet = seg(t, 0.12, 0.42) > 0.3
    tile2 = scaled('park/g-soil-wet.png' if wet else 'park/g-soil-dry.png', 3.2)
    for k in range(3):
        im.alpha_composite(tile2, (round(W * 0.24 + k * tile2.width), round(H * 0.55)))
    fx, fy = W * 0.35, H * 0.57
    # the flower: wilted -> bloom
    heal = out_back(seg(t, 0.4, 0.52))
    fl = scaled('park/g-daisy.png', 4.0)
    if heal <= 0:
        wil = fl.convert('LA').convert('RGBA')
        wil = ImageEnhance.Brightness(wil).enhance(0.8)
        wil = wil.rotate(24, expand=True, resample=Image.NEAREST)
        im.alpha_composite(wil, (round(fx - wil.width / 2), round(fy - wil.height + 10)))
    else:
        fl2 = fl.resize((round(fl.width * (0.8 + 0.3 * heal)), round(fl.height * (0.8 + 0.3 * heal))), Image.NEAREST)
        im.alpha_composite(fl2, (round(fx - fl2.width / 2), round(fy - fl2.height + 6)))
    # water droplets
    wt2 = seg(t, 0.12, 0.42)
    if 0 < wt2 < 1:
        d = ImageDraw.Draw(im)
        rnd = random.Random(int(t * 40))
        for _ in range(7):
            dx = fx + rnd.uniform(-34, 34)
            dy = fy - 190 + ((t * 900 + rnd.uniform(0, 160)) % 170)
            d.ellipse([dx - 5, dy - 8, dx + 5, dy + 8], fill=(120, 190, 255, 230))
    sparkle_burst(im, fx, fy - 60, seg(t, 0.42, 0.62), n=10, dist=130, seed=33)
    # the gardener banana stands by
    g = banana(i // 4 if t < 0.4 or t > 0.55 else 0, {'hat': 'cowboy'}, height=190)
    im.alpha_composite(g, (round(W * 0.68 - g.width / 2), round(H * 0.56 - g.height)))
    # beat 2: the weed pops out
    weed_x, weed_y = W * 0.62, H * 0.63
    pt2 = seg(t, 0.68, 0.8)
    if pt2 <= 0:
        w2 = scaled('park/w-weed1.png', 3.2)
        wob = math.sin(i / 2) * 6 if t > 0.6 else 0
        w2 = w2.rotate(wob, expand=True, resample=Image.NEAREST)
        im.alpha_composite(w2, (round(weed_x - w2.width / 2), round(weed_y - w2.height)))
    elif pt2 < 1:
        w2 = scaled('park/w-weed1.png', 3.2).rotate(30 * pt2, expand=True, resample=Image.NEAREST)
        fly = out_cubic(pt2)
        im.alpha_composite(w2, (round(weed_x - w2.width / 2 + fly * 90), round(weed_y - w2.height - fly * 260)))
    poof(im, weed_x, weed_y - 20, seg(t, 0.68, 0.82), seed=35)
    sparkle_burst(im, weed_x, weed_y - 60, seg(t, 0.82, 1.0), n=8, dist=110, seed=37)
    vignette(im, 70)
    return im


SCENES = {
    'builder': (scene_builder, 4.5),
    'rave': (scene_rave, 4.5),
    'pass': (scene_pass, 4.5),
    'park': (scene_park, 4.5),
    'bay': (scene_bay, 4.5),
    'homestead': (scene_homestead, 5.0),
    'items': (scene_items, 5.0),
    'quest': (scene_quest, 4.5),
    'shops': (scene_shops, 4.5),
    'stalls': (scene_stalls, 4.5),
    'treasure': (scene_treasure, 5.0),
    'fishing': (scene_fishing, 4.5),
    'tending': (scene_tending, 4.5),
}

if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    stills = '--still' in sys.argv
    todo = args or list(SCENES)
    for nm in todo:
        fn, secs = SCENES[nm]
        render_scene(nm, fn, secs, stills_only=stills)
