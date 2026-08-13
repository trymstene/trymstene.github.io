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


# ═══════════════════════════════════════════════════════════════════════════
# SCENES v2 — honest scale, camera-driven
# ═══════════════════════════════════════════════════════════════════════════

BAN_H = 104   # the banana's true in-world height on the plates


def cam(plate, cx, cy, vw):
    """crop a 9:16 window; returns (im, to_screen, k) — k = screen px per world px"""
    vh = vw * H / W
    x0 = max(0, min(plate.width - vw, cx - vw / 2))
    y0 = max(0, min(plate.height - vh, cy - vh / 2))
    im = plate.crop((round(x0), round(y0), round(x0 + vw), round(y0 + vh))).resize((W, H), Image.NEAREST)
    k = W / vw
    def to_screen(wx, wy):
        return ((wx - x0) * k, (wy - y0) * k)
    return im, to_screen, k


def put_world(im, tf, k, sprite, wx, wy, native=1.0):
    """paste a NATIVE-scale sprite bottom-centred at world (wx, wy)"""
    w = max(1, round(sprite.width * native * k))
    h = max(1, round(sprite.height * native * k))
    s = sprite.resize((w, h), Image.NEAREST)
    x, y = tf(wx, wy)
    im.alpha_composite(s, (round(x - w / 2), round(y - h)))


def world_banana(im, tf, k, frame, outfit, wx, wy, flip=False):
    b = banana(frame, outfit, height=max(2, round(BAN_H * k)))
    if flip:
        b = b.transpose(Image.FLIP_LEFT_RIGHT)
    x, y = tf(wx, wy)
    im.alpha_composite(b, (round(x - b.width / 2), round(y - b.height)))


def gold_mark(im, x, y, t, u=2.4):
    """the quest ! at chip scale, bobbing, glow blended on an overlay"""
    bob = math.sin(t * math.tau * 2) * 5
    y = y + bob
    ov = Image.new('RGBA', im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    glow = 20 + 8 * (0.5 + 0.5 * math.sin(t * math.tau * 3))
    d.ellipse([x - glow, y - 26 * u / 2 - glow * 0.5, x + glow, y + glow * 0.5], fill=(255, 210, 63, 80))
    for (rx, ry, rw, rh, col) in [(-3, -22, 6, 10, (17, 17, 17, 255)), (-3, -8, 6, 5, (17, 17, 17, 255)),
                                  (-2, -21, 4, 8, (255, 210, 63, 255)), (-2, -7, 4, 3, (255, 210, 63, 255)),
                                  (-2, -21, 2, 8, (255, 243, 168, 255))]:
        d.rectangle([x + rx * u, y + ry * u, x + (rx + rw) * u, y + (ry + rh) * u], fill=col)
    im.alpha_composite(ov)


# ── UI CLOSE-UPS (honest to their screens) ─────────────────────────────────

OUTFITS = [
    {'hat': 'crown', 'glasses': 'shades'},
    {'hat': 'tophat', 'glasses': 'monocle', 'extras': ['mustache']},
    {'hat': 'fishbowl'},
    {'hat': 'sombrero', 'glasses': 'hearts'},
    {'hat': 'djheadphones', 'extras': ['boombox']},
    {'hat': 'viking', 'extras': ['goldchain']},
]


def scene_builder(t, i):
    """MAKE YOUR OWN BANANA — the builder IS a big banana on a bright page"""
    im = Image.new('RGBA', (W, H), (255, 225, 53, 255))
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
    d.ellipse([cx - 130, cy + 205, cx + 130, cy + 245], fill=(200, 168, 30, 160))
    paste_center(im, b, cx, cy, scale=0.7 + 0.3 * pop)
    sparkle_burst(im, cx, cy - 60, seg(seg_t, 0.0, 0.5), n=12, dist=230, seed=look * 7 + 1)
    vignette(im, 60)
    return im


def draw_bar(d, x, y, w, h, col=(26, 20, 8, 255), r=None):
    r = r if r is not None else h / 2
    d.rounded_rectangle([x, y, x + w, y + h], radius=r, fill=col)


def pass_card(width=430):
    sc = 2
    cw, ch = width, round(width * 128 / 220)
    im = Image.new('RGBA', (cw * sc, ch * sc), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    S = cw * sc / 220
    d.rounded_rectangle([0, 0, 220 * S - 1, 128 * S - 1], radius=8 * S, fill=(20, 16, 31, 255))
    d.rounded_rectangle([3 * S, 3 * S, 217 * S, 125 * S], radius=6 * S, fill=(255, 225, 53, 255))
    d.rounded_rectangle([8 * S, 8 * S, 212 * S, 28 * S], radius=4 * S, fill=(20, 20, 20, 255))
    draw_bar(d, 14 * S, 14 * S, 120 * S, 8 * S, (255, 225, 53, 255))
    d.ellipse([198 * S, 14 * S, 206 * S, 22 * S], fill=(255, 253, 245, 255))
    b = banana(0, {'glasses': 'shades'}, height=round(60 * S))
    im.alpha_composite(b, (round(12 * S), round(32 * S)))
    draw_bar(d, 76 * S, 40 * S, 100 * S, 11 * S)
    draw_bar(d, 76 * S, 58 * S, 70 * S, 7 * S, (20, 20, 20, 140))
    d.rounded_rectangle([76 * S, 72 * S, 148 * S, 87 * S], radius=3 * S, fill=(20, 20, 20, 255))
    draw_bar(d, 82 * S, 77 * S, 58 * S, 5 * S, (255, 225, 53, 255))
    rnd = random.Random(9)
    bx = 12 * S
    while bx < 80 * S:
        bw = rnd.choice([2, 3, 4]) * S
        if rnd.random() > 0.4:
            d.rectangle([bx, 102 * S, bx + bw, 118 * S], fill=(20, 20, 20, 255))
        bx += bw + 2 * S
    return im, S


def scene_pass(t, i):
    """MY PASS — the card, the shine, the stamp: honest to the pass page"""
    im = Image.new('RGBA', (W, H), (13, 11, 22, 255))
    d = ImageDraw.Draw(im)
    rnd = random.Random(4)
    for k in range(26):
        x = rnd.uniform(0, W)
        y = (rnd.uniform(0, H) + t * 120 * rnd.uniform(0.5, 1.5)) % H
        col = [(255, 225, 53), (255, 93, 143), (94, 200, 224), (94, 224, 138)][k % 4]
        d.rectangle([x, y, x + 7, y + 7], fill=col + (120,))
    card, S = pass_card(430)
    enter = out_back(seg(t, 0.0, 0.28))
    cy = H * 0.42 + (1 - enter) * H * 0.7
    rot = math.sin(t * math.tau) * 1.6
    c2 = card.rotate(rot - 3, expand=True, resample=Image.BICUBIC)
    tmp = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    paste_center(tmp, c2, W / 2, cy, scale=0.5)
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
        red = Image.new('RGBA', bb.size, (226, 32, 32, alpha))
        red.putalpha(Image.eval(bb.split()[3], lambda p: round(p * alpha / 255)))
        ov.alpha_composite(red, (round(cxs - bb.width / 2), round(cys - bb.height / 2)))
        ov = ov.rotate(-9, center=(cxs, cys), resample=Image.BICUBIC)
        im.alpha_composite(ov)
        if 0.05 < st < 0.6:
            sparkle_burst(im, cxs, cys, seg(st, 0.05, 0.6), n=10, dist=150, seed=11, color=(255, 93, 143, 255))
    hit = seg(t, 0.62, 0.68)
    if 0 < hit < 1:
        dx = round(math.sin(hit * 40) * 8 * (1 - hit))
        im = im.transform(im.size, Image.AFFINE, (1, 0, dx, 0, 1, 0))
    vignette(im, 90)
    return im


def scene_stalls(t, i):
    """GAME-STALLS — an arcade cabinet IS a close-up; the plushes stay plush-size"""
    im = Image.new('RGBA', (W, H), (20, 16, 31, 255))
    d = ImageDraw.Draw(im)
    for y in range(round(H * 0.72), H, 34):
        d.rectangle([0, y, W, y + 17], fill=(124, 86, 47, 255))
        d.rectangle([0, y + 17, W, y + 34], fill=(107, 74, 36, 255))
    cw, chh = W * 0.72, H * 0.58
    cx0, cy0 = W / 2 - cw / 2, H * 0.14
    d.rounded_rectangle([cx0 - 14, cy0 - 14, cx0 + cw + 14, cy0 + chh + 40], radius=16,
                        fill=(226, 32, 32, 255), outline=(17, 17, 17, 255), width=6)
    d.rectangle([cx0, cy0 + 30, cx0 + cw, cy0 + chh], fill=(29, 24, 48, 255))
    for k in range(14):
        on = (k + i // 4) % 3 == 0
        bx = cx0 - 2 + k * (cw + 4) / 13
        d.ellipse([bx - 6, cy0 - 8, bx + 6, cy0 + 4], fill=(255, 225, 53, 255) if on else (120, 90, 20, 255))
    pile = [(0.18, 0.86, 3), (0.36, 0.9, 5), (0.56, 0.86, 1), (0.74, 0.9, 6), (0.3, 0.95, 0),
            (0.5, 0.95, 2), (0.68, 0.96, 4), (0.85, 0.92, 7)]
    for k, (ox, oy, pf) in enumerate(pile):
        pb = banana(pf, None, height=78)
        pb = pb.rotate([-14, 8, -6, 12, 4, -9, 6, -12][k % 8], expand=True, resample=Image.NEAREST)
        im.alpha_composite(pb, (round(cx0 + ox * cw - pb.width / 2), round(cy0 + chh * 0.985 - pb.height)))
    drop = in_out(seg(t, 0.18, 0.42))
    lift = in_out(seg(t, 0.62, 0.9))
    claw_x = cx0 + cw * 0.42
    top_y = cy0 + 44
    grab_y = cy0 + chh - 84
    cy = top_y + (grab_y - top_y) * max(0.0, drop - lift)
    d.rectangle([cx0, top_y - 12, cx0 + cw, top_y - 4], fill=(90, 90, 110, 255))
    d.line([claw_x, top_y - 6, claw_x, cy], fill=(200, 205, 220, 255), width=5)
    closed = t > 0.46
    spread = 24 if not closed else 11
    for sgn in (-1, 1):
        d.line([claw_x, cy, claw_x + sgn * spread, cy + 30], fill=(230, 234, 245, 255), width=8)
        d.line([claw_x + sgn * spread, cy + 30, claw_x + sgn * (spread - 8), cy + 46], fill=(230, 234, 245, 255), width=8)
    if closed:
        pb = banana(2, None, height=78)
        im.alpha_composite(pb, (round(claw_x - pb.width / 2), round(cy + 20)))
    if 0 < seg(t, 0.44, 0.5) < 1:
        sparkle_burst(im, claw_x, grab_y + 24, seg(t, 0.44, 0.58), n=8, dist=110, seed=19)
    end = seg(t, 0.9, 1.0)
    if end > 0:
        sparkle_burst(im, claw_x, top_y + 60, end, n=12, dist=160, seed=23)
    vignette(im, 90)
    return im


def scene_items(t, i):
    """ITEMS WORKSHOP — the forge grid close-up, then the piece lands IN a
    room at the room's own proportions"""
    im = Image.new('RGBA', (W, H), (26, 20, 8, 255))
    d = ImageDraw.Draw(im)
    for y in range(0, H, 90):
        d.rectangle([0, y, W, y + 45], fill=(31, 24, 10, 255))
    beat2 = seg(t, 0.55, 1.0)
    if beat2 <= 0:
        bt = seg(t, 0.0, 0.52)
        d.rounded_rectangle([W * 0.1, H * 0.16, W * 0.9, H * 0.62], radius=18, fill=(20, 16, 31, 255),
                            outline=(255, 225, 53, 255), width=5)
        g0x, g0y, cell = W * 0.17, H * 0.2, (W * 0.66) / 15
        for gx in range(16):
            d.line([g0x + gx * cell, g0y, g0x + gx * cell, g0y + 15 * cell], fill=(46, 38, 68, 255))
            d.line([g0x, g0y + gx * cell, g0x + 15 * cell, g0y + gx * cell], fill=(46, 38, 68, 255))
        rects = _svg_rects('tophat')
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
        if shown and shown < len(rects):
            x, y, w2, h2, col = rects[order[min(shown, len(rects) - 1)]]
            X = g0x + cell + (x - min(xs)) * u; Y = g0y + cell + (y - min(ys)) * u
            d.rectangle([X - 3, Y - 3, X + w2 * u + 3, Y + h2 * u + 3], outline=(255, 253, 245, 255), width=3)
        b = banana(i // 4, None, height=250)
        paste_center(im, b, W / 2, H * 0.82)
    else:
        hp = out_back(seg(beat2, 0.0, 0.3))
        b = banana(i // 4, {'hat': 'tophat'}, height=320)
        paste_center(im, b, W / 2, H * 0.34, scale=0.75 + 0.25 * hp)
        sparkle_burst(im, W / 2, H * 0.22, seg(beat2, 0.0, 0.45), n=12, dist=190, seed=21)
        # the CAMERA zooms into the room's middle — the couch stays at the
        # room's own ratio, the slice makes it big enough to read
        room = asset('homestead/in-wood3.png').crop((150, 90, 474, 340))
        zf = W * 1.02 / room.width
        room2 = room.resize((round(room.width * zf), round(room.height * zf)), Image.NEAREST)
        ry = round(H * 0.56)
        im.alpha_composite(room2, (round(W / 2 - room2.width / 2), ry))
        cp = out_back(seg(beat2, 0.35, 0.6))
        if cp > 0:
            couch = asset('homestead/d-bigcouch.png')
            couch = couch.resize((round(couch.width * zf), round(couch.height * zf)), Image.NEAREST)
            drop = (1 - cp) * -120
            paste_center(im, couch, W / 2, ry + room2.height * 0.72 + drop, scale=max(0.1, cp))
        pf = seg(beat2, 0.52, 0.72)
        poof(im, W / 2, ry + room2.height * 0.66, pf, seed=8, big=1.1)
        sparkle_burst(im, W / 2, ry + room2.height * 0.5, seg(beat2, 0.6, 1.0), n=10, dist=140, seed=9)
    vignette(im, 80)
    return im


# ── WORLD SCENES (true scale on the real plates) ───────────────────────────

def scene_park(t, i):
    """THE PARK — a stroll through the plaza, everything at game scale"""
    plate = asset('park/park.png')
    im, tf, k = cam(plate, 760 + in_out(t) * 1150, 585, 640)
    walk_x = 700 + in_out(t) * 1210
    world_banana(im, tf, k, i // 4, {'hat': 'cowboy'}, walk_x, 700)
    world_banana(im, tf, k, (i // 4 + 3) % 8, {'glasses': 'shades'}, 1470, 610)
    world_banana(im, tf, k, (i // 4 + 5) % 8, {'hat': 'party'}, 1330, 530, flip=True)
    put_world(im, tf, k, strip_frame('park/a-chicken1.png', 6, i // 5), 1180 + t * 60, 760)
    put_world(im, tf, k, strip_frame('park/a-rabbit.png', 6, i // 5), 1620 - t * 160, 820)
    bird = asset('park/bird-blue-jay.png').crop((32 * (i // 4 % 2), 0, 32 * (i // 4 % 2) + 32, 32))
    im.alpha_composite(bird.resize((round(32 * k), round(32 * k)), Image.NEAREST),
                       (round(-40 + t * (W + 100)), round(H * 0.14 + math.sin(t * 9) * 20)))
    d = ImageDraw.Draw(im)
    rnd = random.Random(7)
    for kk in range(10):
        px = (rnd.uniform(0, W) + t * 120 * rnd.uniform(0.4, 1)) % W
        py = (rnd.uniform(0, H) + t * 50) % H
        d.rectangle([px, py, px + 4, py + 4], fill=(255, 214, 232, 150))
    vignette(im, 55)
    return im


def scene_bay(t, i):
    """BANANA BAY — shoreline pan at game scale: court, hut, crab, coins"""
    plate = asset('beach/beach.png')
    im, tf, k = cam(plate, 2050 - in_out(t) * 1150, 545, 640)
    world_banana(im, tf, k, i // 4, {'glasses': 'snorkelmask'}, 1750 - in_out(t) * 1000, 660)
    world_banana(im, tf, k, (i // 4 + 4) % 8, {'hat': 'buckethat'}, 1180, 590, flip=True)
    put_world(im, tf, k, strip_frame('beach/a-crab.png', 20, i // 3), 1420 - t * 130, 700)
    put_world(im, tf, k, strip_frame('beach/a-gull.png', 6, i // 4), 900 + t * 900, 180)
    coin = strip_frame('banana-stand/coin-spin.png', 6, i // 5)
    for wx, wy in [(1520, 730), (990, 690), (2140, 640)]:
        put_world(im, tf, k, coin, wx, wy)
    d = ImageDraw.Draw(im)
    rnd = random.Random(int(t * 10))
    for _ in range(2):
        sparkle(d, rnd.uniform(30, W - 30), rnd.uniform(H * 0.55, H * 0.95), rnd.uniform(3, 6))
    vignette(im, 55)
    return im


HS_SPOT = (1050, 560)


def scene_homestead(t, i):
    """THE HOMESTEAD — the build-up story, every sprite at its real size"""
    plate = asset('homestead/homestead.png').copy()
    px, py = HS_SPOT
    layer = Image.new('RGBA', plate.size, (0, 0, 0, 0))
    house_t = seg(t, 0.74, 0.86)
    tp = out_back(seg(t, 0.06, 0.16))
    if tp > 0 and house_t <= 0:
        tent = asset('homestead/ov-tent1.png')
        paste_center(layer, tent, px, py - tent.height * 0.28, scale=max(0.05, tp))
    fs = seg(t, 0.2, 0.34)
    if fs > 0:
        yard = asset('homestead/ov-fyard1.png')
        south = asset('homestead/ov-fsouth1.png')
        fx, fy = px - yard.width / 2, py - 190
        crop_w = max(2, round(yard.width * out_cubic(fs)))
        layer.alpha_composite(yard.crop((0, 0, crop_w, yard.height)), (round(fx), round(fy)))
        layer.alpha_composite(south.crop((0, 0, crop_w, south.height)), (round(fx), round(fy + 332)))
    DECOR2 = [('homestead/d-bench.png', -150, 108, 0.38),
              ('homestead/d-fountain.gif', 150, 80, 0.46),
              ('homestead/d-birdhouse.png', -195, -40, 0.54),
              ('homestead/m-mail.png', 205, 128, 0.6)]
    for pth, ox, oy, at in DECOR2:
        pp = out_back(seg(t, at, at + 0.09))
        if pp > 0:
            spr = asset(pth)
            paste_center(layer, spr, px + ox, py + oy - spr.height / 2, scale=max(0.05, pp))
    for kk, (ox, oy) in enumerate([(-100, 150), (-40, 170), (40, 160), (110, 175)]):
        fp = out_back(seg(t, 0.62 + kk * 0.025, 0.68 + kk * 0.025))
        if fp > 0:
            fl = scaled('park/b-marigold.png', 1.4)
            paste_center(layer, fl, px + ox, py + oy, scale=max(0.05, fp))
    if house_t > 0:
        hp = out_back(house_t)
        house = asset('homestead/ov-country.png')
        paste_center(layer, house, px, py - house.height * 0.3, scale=max(0.05, hp))
    # neighbours drop by as the yard grows
    if t > 0.4:
        world = plate
        b1 = banana(i // 4, {'hat': 'crown'}, BAN_H)
        layer.alpha_composite(b1, (round(px - 320 - b1.width / 2), round(py + 240 - b1.height)))
    if t > 0.6:
        b2 = banana((i // 4 + 2) % 8, None, BAN_H)
        layer.alpha_composite(b2, (round(px + 300 - b2.width / 2), round(py + 280 - b2.height)))
    plate.alpha_composite(layer)
    vw = 470 + in_out(t) * 240
    im, tf, k = cam(plate, px, py + 40, vw)
    for at, big in [(0.06, 1.1), (0.2, 0.8), (0.74, 1.4)]:
        pf = seg(t, at, at + 0.14)
        sx, sy = tf(px, py - 30)
        poof(im, sx, sy, pf, seed=int(at * 100), big=big)
    sx, sy = tf(px, py - 120)
    sparkle_burst(im, sx, sy, seg(t, 0.86, 1.0), n=16, dist=240, seed=5)
    if t > 0.86:
        rnd = random.Random(12)
        d = ImageDraw.Draw(im)
        for kk in range(28):
            fall = (t - 0.86) / 0.14
            x = rnd.uniform(0, W)
            y = rnd.uniform(-H * 0.3, H * 0.2) + fall * H * 0.9 * rnd.uniform(0.6, 1.2)
            col = [(255, 225, 53), (255, 93, 143), (94, 200, 224), (94, 224, 138)][kk % 4]
            d.rectangle([x, y, x + 7, y + 7], fill=col + (220,))
    vignette(im, 55)
    return im


def scene_quest(t, i):
    """THE QUESTLINE — Nib waits at the gate, true scale; the letter unfurls"""
    plate = asset('homestead/homestead.png')
    im, tf, k = cam(plate, 1090, 760, 560)
    nib_w = (1180, 880)
    world_banana(im, tf, k, 0, {'hat': 'tophat', 'glasses': 'potter', 'extras': ['necktie']}, *nib_w)
    nx, ny = tf(nib_w[0], nib_w[1] - BAN_H)
    gold_mark(im, nx, ny - 30, t)
    wt = in_out(seg(t, 0.05, 0.45))
    world_banana(im, tf, k, i // 3 if wt < 1 else 0, {'hat': 'backwardscap'},
                 700 + wt * 380, 900)
    lt = seg(t, 0.55, 0.75)
    if lt > 0:
        un = out_cubic(lt)
        pw, ph = W * 0.52, H * 0.2 * un
        ox, oy = W / 2 - pw / 2, H * 0.24 - ph / 2
        ov = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        do = ImageDraw.Draw(ov)
        rnd = random.Random(6)
        pts = [(ox + kk * pw / 8, oy + rnd.uniform(-5, 5)) for kk in range(9)]
        pts += [(ox + pw + rnd.uniform(-4, 4), oy + kk * ph / 4) for kk in range(1, 5)]
        pts += [(ox + pw - kk * pw / 8, oy + ph + rnd.uniform(-5, 5)) for kk in range(9)]
        pts += [(ox + rnd.uniform(-4, 4), oy + ph - kk * ph / 4) for kk in range(1, 5)]
        do.polygon(pts, fill=(246, 236, 208, 255), outline=(107, 74, 36, 255))
        if ph > 40:
            yy = oy + 22
            rnd2 = random.Random(3)
            while yy < oy + ph - 14:
                sx = ox + 22
                while sx < ox + pw - 34:
                    seg_w = rnd2.uniform(14, 40)
                    do.line([sx, yy + rnd2.uniform(-1.5, 1.5), sx + seg_w, yy + rnd2.uniform(-1.5, 1.5)],
                            fill=(105, 78, 46, 200), width=2)
                    sx += seg_w + rnd2.uniform(7, 14)
                yy += 26
        ov = ov.rotate(-2, center=(W / 2, H * 0.24), resample=Image.BICUBIC)
        im.alpha_composite(ov)
        sparkle_burst(im, W / 2, H * 0.24, seg(t, 0.55, 0.8), n=8, dist=150, seed=14)
    vignette(im, 65)
    return im


def scene_shops(t, i):
    """SHOPS — the stand on its own plate; booth and banana keep their ratio"""
    bg = asset('banana-stand/park.png')
    zf = W / bg.width
    im = Image.new('RGBA', (W, H), (58, 121, 59, 255))
    bgs = bg.resize((W, round(bg.height * zf)), Image.NEAREST)
    im.alpha_composite(bgs, (0, round((H - bgs.height) / 2)))
    k = zf   # the stand plate's own scale
    hx, hy = W / 2, H * 0.47
    sp = out_back(seg(t, 0.0, 0.18))
    hut = asset('banana-stand/hut.png')
    hut = hut.resize((round(hut.width * 2.4), round(hut.height * 2.4)), Image.NEAREST)
    if sp > 0:
        paste_center(im, hut, hx, hy, scale=max(0.05, sp))
    poof(im, hx, hy + 70, seg(t, 0.1, 0.26), seed=4, big=1.3)
    if t > 0.2:
        rise = out_back(seg(t, 0.2, 0.3))
        keeper = banana(i // 4, {'hat': 'buckethat', 'extras': ['mustache']}, height=126)
        show_h = round(keeper.height * 0.6 * rise)
        if show_h > 2:
            im.alpha_composite(keeper.crop((0, 0, keeper.width, show_h)),
                               (round(hx - keeper.width / 2), round(hy + 34 - show_h)))
        sill = hut.crop((0, round(hut.height * 0.72), hut.width, hut.height))
        im.alpha_composite(sill, (round(hx - hut.width / 2), round(hy - hut.height / 2 + hut.height * 0.72)))
    GOODS = [('banana-stand/ticket.png', -74, 0.75, 0.36), ('banana-stand/stack.png', 2, 1.0, 0.44),
             ('banana-stand/coins.png', 70, 1.0, 0.52)]
    for pth, ox, sc2, at in GOODS:
        gp = out_back(seg(t, at, at + 0.1))
        if gp > 0:
            spr = scaled(pth, sc2)
            paste_center(im, spr, hx + ox, hy + 74, scale=max(0.05, gp))
    for kk in range(5):
        ct = seg(t, 0.55 + kk * 0.07, 0.75 + kk * 0.07)
        if 0 < ct < 1:
            e = in_out(ct)
            x = W * 0.9 - e * (W * 0.9 - hx)
            y = H * 0.84 - math.sin(e * math.pi) * 240 - e * (H * 0.84 - hy - 60)
            coin = strip_frame('banana-stand/coin-spin.png', 6, (i + kk) // 3)
            paste_center(im, coin, x, y)
    sparkle_burst(im, hx, hy + 30, seg(t, 0.8, 1.0), n=12, dist=170, seed=17)
    vignette(im, 65)
    return im


def scene_treasure(t, i):
    """TREASURE HUNT — the map close-up, then a TRUE-scale dig: chest at its
    real size, glow and coins doing the drama"""
    plate = asset('beach/beach.png')
    im, tf, k = cam(plate, 520, 640, 560)
    world_banana(im, tf, k, 0 if 0.4 < t < 0.75 else i // 4, {'hat': 'tricorn', 'glasses': 'eyepatch'}, 420, 700)
    mt = seg(t, 0.02, 0.4)
    if t < 0.48:
        un = out_cubic(seg(mt, 0.0, 0.5))
        mw, mh = W * 0.6, H * 0.24 * un
        ox, oy = W / 2 - mw / 2, H * 0.26 - mh / 2
        ov = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        do = ImageDraw.Draw(ov)
        rnd = random.Random(5)
        pts = [(ox + kk * mw / 10, oy + rnd.uniform(-6, 6)) for kk in range(11)]
        pts += [(ox + mw + rnd.uniform(-5, 5), oy + kk * mh / 4) for kk in range(1, 5)]
        pts += [(ox + mw - kk * mw / 10, oy + mh + rnd.uniform(-6, 6)) for kk in range(11)]
        pts += [(ox + rnd.uniform(-5, 5), oy + mh - kk * mh / 4) for kk in range(1, 5)]
        do.polygon(pts, fill=(217, 194, 144, 252), outline=(107, 74, 36, 255))
        if mh > 50:
            do.rectangle([ox + 14, oy + 12, ox + mw - 14, oy + mh * 0.3], fill=(159, 185, 189, 255))
            do.rectangle([ox + mw * 0.7, oy + 12, ox + mw * 0.78, oy + mh * 0.45], fill=(143, 106, 63, 255))
            for pxx in (0.2, 0.5):
                do.ellipse([ox + mw * pxx, oy + mh * 0.55, ox + mw * pxx + 18, oy + mh * 0.55 + 18],
                           fill=(109, 138, 90, 255))
            ct2 = seg(mt, 0.5, 1.0)
            if ct2 > 0:
                cxm, cym, r = ox + mw * 0.32, oy + mh * 0.52, 40
                do.arc([cxm - r, cym - r, cxm + r, cym + r], start=-90, end=-90 + round(360 * out_cubic(ct2)),
                       fill=(176, 50, 38, 255), width=7)
        ov = ov.rotate(-2.5, center=(W / 2, H * 0.26), resample=Image.BICUBIC)
        im.alpha_composite(ov)
    dt = seg(t, 0.5, 0.72)
    dxw, dyw = 560, 700
    if dt > 0:
        sx, sy = tf(dxw, dyw)
        d = ImageDraw.Draw(im)
        mr = (14 + out_cubic(dt) * 34) * k
        d.ellipse([sx - mr, sy - mr * 0.45, sx + mr, sy + mr * 0.45], fill=(194, 178, 128, 255))
        d.ellipse([sx - mr * 0.7, sy - mr * 0.5, sx + mr * 0.7, sy + mr * 0.28], fill=(226, 212, 166, 255))
        rnd = random.Random(int(t * 24))
        if dt < 1:
            for _ in range(7):
                a = rnd.uniform(-math.pi, 0)
                dd2 = rnd.uniform(16, 60) * k * out_cubic(dt)
                d.ellipse([sx + math.cos(a) * dd2 - 4, sy + math.sin(a) * dd2 * 0.9 - 4,
                           sx + math.cos(a) * dd2 + 4, sy + math.sin(a) * dd2 * 0.9 + 4],
                          fill=(208, 190, 140, 230))
    ch = seg(t, 0.74, 0.88)
    if ch > 0:
        chest = asset('banana-stand/chest.png')   # 144x108 — its real size
        rise = out_back(ch)
        sx, sy = tf(dxw, dyw - 10)
        ov = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        do = ImageDraw.Draw(ov)
        gr = 110 * rise
        do.ellipse([sx - gr, sy - 40 - gr, sx + gr, sy - 40 + gr], fill=(255, 225, 53, 60))
        im.alpha_composite(ov)
        cs = chest.resize((max(1, round(chest.width * k * rise)), max(1, round(chest.height * k * rise))), Image.NEAREST)
        im.alpha_composite(cs, (round(sx - cs.width / 2), round(sy - 40 * rise - cs.height)))
        sparkle_burst(im, sx, sy - 60, seg(t, 0.8, 1.0), n=14, dist=200, seed=25)
        coin = strip_frame('banana-stand/coin-spin.png', 6, i // 3)
        rnd = random.Random(31)
        bt2 = seg(t, 0.78, 1.0)
        for kk in range(6):
            a = rnd.uniform(-math.pi * 0.9, -math.pi * 0.1)
            dd2 = 150 * out_cubic(bt2)
            paste_center(im, coin, sx + math.cos(a) * dd2, sy - 50 + math.sin(a) * dd2 + bt2 * bt2 * 130)
    vignette(im, 60)
    return im


def scene_fishing(t, i):
    """FISHING — the pier at game scale: small bob, ripples, a real fish"""
    plate = asset('beach/beach.png')
    im, tf, k = cam(plate, 1830, 500, 560)
    ax, ay = 1930, 420
    world_banana(im, tf, k, 0 if t > 0.1 else i // 4, {'hat': 'buckethat'}, ax, ay)
    d = ImageDraw.Draw(im)
    sxr, syr = tf(ax - 26, ay - BAN_H * 0.55)
    cast = in_out(seg(t, 0.06, 0.22))
    bwx, bwy = ax - 210, 200
    bx, by = tf(bwx, bwy)
    if cast > 0:
        mid_x, mid_y = (sxr + bx) / 2, min(syr, by) - 70 * (1 - cast * 0.5)
        pts = []
        for kk in range(21):
            u = kk / 20
            x = (1 - u) ** 2 * sxr + 2 * (1 - u) * u * mid_x + u * u * bx
            y = (1 - u) ** 2 * syr + 2 * (1 - u) * u * mid_y + u * u * by
            pts.append((x, y))
        d.line(pts, fill=(255, 253, 245, 220), width=2)
        # the bob: small, drawn — red cap, white belly, like the game's
        strike = seg(t, 0.55, 0.62)
        dip = 6 * math.sin(i / 2) * strike
        d.ellipse([bx - 7, by - 7 + dip, bx + 7, by + 7 + dip], fill=(226, 60, 50, 255), outline=(17, 17, 17, 255))
        d.chord([bx - 7, by - 7 + dip, bx + 7, by + 7 + dip], 0, 180, fill=(255, 253, 245, 255))
        for kk in range(3):
            rt = ((t * 2 + kk * 0.33) % 1)
            rr = (8 + rt * 30)
            alpha = round(160 * (1 - rt))
            d.ellipse([bx - rr, by + 6 - rr * 0.35, bx + rr, by + 6 + rr * 0.35],
                      outline=(224, 244, 255, alpha), width=2)
    ct = seg(t, 0.66, 0.92)
    if ct > 0:
        leap = math.sin(min(1, ct) * math.pi)
        fish = strip_frame('beach/a-fish2.png', 14, i // 3)
        fh = max(2, round(48 * k * 1.2))
        fish = fish.resize((fh, fh), Image.NEAREST).rotate(-30 + 70 * ct, resample=Image.NEAREST, expand=True)
        paste_center(im, fish, bx + ct * 50, by + 14 - leap * 120)
        sp2 = seg(ct, 0.0, 0.4)
        if 0 < sp2 < 1:
            rnd = random.Random(27)
            for _ in range(9):
                a = rnd.uniform(-math.pi, 0)
                dd2 = rnd.uniform(12, 56) * out_cubic(sp2)
                d.ellipse([bx + math.cos(a) * dd2 - 4, by + math.sin(a) * dd2 - 4,
                           bx + math.cos(a) * dd2 + 4, by + math.sin(a) * dd2 + 4],
                          fill=(224, 244, 255, round(220 * (1 - sp2))))
        sparkle_burst(im, bx + 30, by - 110, seg(t, 0.72, 1.0), n=9, dist=130, seed=29)
    vignette(im, 60)
    return im


def scene_tending(t, i):
    """LOOK AFTER THE PARK — watering and weeding at true garden scale"""
    plate = asset('park/park.png')
    im, tf, k = cam(plate, 2470, 420, 470)
    # the real flowerbed corner: soil pots at native size
    soil = asset('park/g-soil-wet.png' if seg(t, 0.12, 0.42) > 0.3 else 'park/g-soil-dry.png')
    for kk in range(3):
        put_world(im, tf, k, soil, 2380 + kk * 48, 540)
    fwx, fwy = 2380, 522
    heal = out_back(seg(t, 0.4, 0.52))
    fl = asset('park/g-daisy.png')
    if heal <= 0:
        wil = fl.convert('LA').convert('RGBA')
        wil = ImageEnhance.Brightness(wil).enhance(0.75)
        wil = wil.rotate(22, expand=True, resample=Image.NEAREST)
        put_world(im, tf, k, wil, fwx, fwy)
    else:
        put_world(im, tf, k, fl, fwx, fwy, native=0.9 + 0.25 * heal)
    wt2 = seg(t, 0.12, 0.42)
    sx, sy = tf(fwx, fwy)
    if 0 < wt2 < 1:
        d = ImageDraw.Draw(im)
        rnd = random.Random(int(t * 40))
        for _ in range(6):
            dx = sx + rnd.uniform(-20, 20)
            dy = sy - 120 + ((t * 700 + rnd.uniform(0, 120)) % 110)
            d.ellipse([dx - 4, dy - 6, dx + 4, dy + 6], fill=(120, 190, 255, 230))
    sparkle_burst(im, sx, sy - 40, seg(t, 0.42, 0.62), n=9, dist=100, seed=33)
    world_banana(im, tf, k, i // 4 if t < 0.4 or t > 0.55 else 0, {'hat': 'cowboy'}, 2540, 600)
    wwx, wwy = 2500, 640
    pt2 = seg(t, 0.68, 0.8)
    if pt2 <= 0:
        w2 = asset('park/w-weed1.png')
        wob = math.sin(i / 2) * 5 if t > 0.6 else 0
        w2r = w2.rotate(wob, expand=True, resample=Image.NEAREST)
        put_world(im, tf, k, w2r, wwx, wwy)
    elif pt2 < 1:
        w2 = asset('park/w-weed1.png').rotate(28 * pt2, expand=True, resample=Image.NEAREST)
        fly = out_cubic(pt2)
        put_world(im, tf, k, w2, wwx + fly * 70, wwy - fly * 200)
    wx2, wy2 = tf(wwx, wwy - 10)
    poof(im, wx2, wy2, seg(t, 0.68, 0.82), seed=35, big=0.8)
    sparkle_burst(im, wx2, wy2 - 40, seg(t, 0.82, 1.0), n=8, dist=90, seed=37)
    vignette(im, 60)
    return im


def scene_rave(t, i):
    """THE RAVE — the floor from above: one crowd, one scale, big light show"""
    im = Image.new('RGBA', (W, H), (13, 11, 20, 255))
    d = ImageDraw.Draw(im)
    wash = [(255, 77, 157), (94, 200, 224), (94, 224, 138), (201, 156, 255)]
    wi = int(t * 8) % 4
    tile = 48
    off = round(t * 70)
    for yy in range(-1, H // tile + 2):
        for xx in range(-1, W // tile + 2):
            col = (26, 22, 40, 255) if (xx + yy) % 2 == 0 else (16, 13, 26, 255)
            d.rectangle([xx * tile, yy * tile + off % tile - tile,
                         xx * tile + tile, yy * tile + off % tile - tile + tile], fill=col)
    ov = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    do = ImageDraw.Draw(ov)
    for kk in range(4):
        a = math.sin(t * math.tau * 2 + kk * 1.7) * 0.5
        bx = W * (0.2 + 0.2 * kk)
        do.polygon([(bx, -10), (bx + 380 * a - 80, H), (bx + 380 * a + 80, H)], fill=wash[(wi + kk) % 4] + (55,))
    im.alpha_composite(ov)
    bally = 74 + math.sin(t * math.tau) * 5
    d.line([W / 2, 0, W / 2, bally], fill=(120, 120, 140, 255), width=3)
    d.ellipse([W / 2 - 34, bally - 34, W / 2 + 34, bally + 34], fill=(200, 205, 220, 255))
    for gy in range(-30, 31, 10):
        for gx in range(-30, 31, 10):
            if gx * gx + gy * gy < 30 * 30:
                shade = 160 + ((gx + gy + round(t * 80)) // 10 % 3) * 40
                d.rectangle([W / 2 + gx, bally + gy, W / 2 + gx + 7, bally + gy + 7],
                            fill=(shade, shade, min(255, shade + 25), 255))
    rnd = random.Random(int(t * 12))
    for _ in range(3):
        sparkle(d, rnd.uniform(40, W - 40), rnd.uniform(40, H * 0.5), rnd.uniform(3, 8), (255, 253, 245, 200))
    # ONE crowd, one scale — size varies only slightly with row depth
    crowd = [(-0.3, 0.14, {'hat': 'djheadphones'}, 128), (0.28, 0.12, {'glasses': 'shades'}, 128),
             (-0.13, 0.27, {'hat': 'party'}, 140), (0.14, 0.3, {'hat': 'crown', 'glasses': 'hearts'}, 140),
             (0.02, 0.44, {'glasses': 'dwi'}, 152), (-0.28, 0.42, {'extras': ['bowtie']}, 152),
             (0.3, 0.45, {'hat': 'backwardscap'}, 152)]
    crowd.sort(key=lambda c: c[1])
    for kk, (ox, oy, fit, hh) in enumerate(crowd):
        bb = banana((i // 4 + kk) % 8, fit, height=hh)
        bounce = abs(math.sin((i / 4 + kk) * math.pi / 2)) * 7
        paste_center(im, bb, W / 2 + ox * W, H * 0.42 + oy * H - bounce)
    pulse = max(0.0, math.sin(t * math.tau * 8)) ** 6
    im.alpha_composite(Image.new('RGBA', (W, H), wash[wi] + (round(30 * pulse),)))
    vignette(im, 110)
    for hit in (0.33, 0.66):
        f = seg(t, hit, hit + 0.05)
        if 0 < f < 1:
            flash(im, (1 - f) * 0.45)
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
