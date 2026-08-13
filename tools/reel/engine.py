# -*- coding: utf-8 -*-
"""🎬 REEL ENGINE — the shared stage for promo scenes.

Every scene module exports `SCENE = {'name', 'secs', 'fn'}` where
fn(t, i) -> RGBA 540x960 image (t = 0..1 scene progress, i = frame index).
render.py encodes it to 1080x1920 @30fps, no text, no audio.

⚠️ THE THREE LAWS (Trym's verdict on v1/v2):
 1. MOTION IS GAMEPLAY. A banana walks the way the game walks it: 168 world
    px/s, hard stop on arrival, a beat of standing, then the next leg — and
    the dance frames cycle at the engine's real 10fps THROUGHOUT. Never a
    constant sub-pixel drift across a whole clip: that reads as a bug.
    If a shot cannot carry honest motion, leave the banana out.
 2. SCALE IS HONEST. Sprites render at their true in-game size on the real
    plates. Bigness comes from the CAMERA (push in, crop, close-up), never
    from inflating a prop.
 3. IT MUST SELL. This is a reel, not a tour. Every clip needs a beat: a
    hook, an action, a payoff — with effects (flicker, shake, blink-fade,
    speed lines, impact rings) carrying the energy.
"""
import math
import os
import random
import sys

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
TOOLS = os.path.dirname(HERE)
SITE = os.path.dirname(TOOLS)
ASSETS = os.path.join(SITE, 'public', 'assets')

sys.path.insert(0, TOOLS)
import banana_render  # noqa: E402  (the engine's Python mirror)

W, H = 540, 960
FPS = 30

# the engine's own timing (banana-geo.js): 8 frames x 100ms
NFRAMES, BASE_CYCLE_S = 8, 0.8
WALK_SPEED = 168.0        # world px/s — banana-park/beach/homestead all agree

_CACHE = {}


# ---- assets ---------------------------------------------------------------
def asset(path):
    if path not in _CACHE:
        _CACHE[path] = Image.open(os.path.join(ASSETS, path)).convert('RGBA')
    return _CACHE[path]


def strip_frame(path, n_frames, idx, gap=0):
    im = asset(path)
    fw = (im.width - gap * (n_frames - 1)) // n_frames
    x = (idx % n_frames) * (fw + gap)
    return im.crop((x, 0, x + fw, im.height))


def sheet_cell(path, cols, rows, cx, cy):
    """one cell of a grid sheet (the park's 4x4 bird sheets)"""
    im = asset(path)
    cw, ch = im.width // cols, im.height // rows
    return im.crop((cx * cw, cy * ch, (cx + 1) * cw, (cy + 1) * ch))


def scaled(path, factor):
    key = ('scaled', path, factor)
    if key not in _CACHE:
        im = asset(path)
        _CACHE[key] = im.resize((max(1, round(im.width * factor)),
                                 max(1, round(im.height * factor))), Image.NEAREST)
    return _CACHE[key]


_BAN = {}


def banana(frame, outfit=None, height=220):
    """the engine's banana, dressed, cropped, at a pixel height"""
    key = (frame % NFRAMES, str(sorted((outfit or {}).items())), height)
    if key not in _BAN:
        im = banana_render.render(frame % NFRAMES, outfit or {}, scale=1)
        im = im.crop(im.getbbox())
        w = max(1, round(im.width * height / im.height))
        _BAN[key] = im.resize((w, height), Image.NEAREST)
    return _BAN[key]


def dance_frame(i):
    """THE cycle: 10fps, exactly what the site plays (0.8s / 8 frames)"""
    return int(i / (FPS * BASE_CYCLE_S / NFRAMES)) % NFRAMES


# ---- easing / timing ------------------------------------------------------
def clamp01(x):
    return max(0.0, min(1.0, x))


def out_cubic(x):
    x = clamp01(x)
    return 1 - (1 - x) ** 3


def in_cubic(x):
    x = clamp01(x)
    return x * x * x


def out_back(x, s=1.70158):
    x = clamp01(x)
    return 1 + (s + 1) * (x - 1) ** 3 + s * (x - 1) ** 2


def out_elastic(x):
    x = clamp01(x)
    if x in (0.0, 1.0):
        return x
    return 2 ** (-9 * x) * math.sin((x * 10 - 0.75) * (2 * math.pi / 3)) + 1


def in_out(x):
    x = clamp01(x)
    return x * x * (3 - 2 * x)


def seg(t, a, b):
    """progress inside window [a,b] of scene time"""
    if b <= a:
        return 1.0
    return clamp01((t - a) / (b - a))


def pulse(t, at, w=0.06):
    """a 0→1→0 spike centred on `at`"""
    d = abs(t - at)
    return max(0.0, 1 - d / w)


# ---- ⭐ GAMEPLAY MOTION ---------------------------------------------------
class Walk:
    """A banana walking the way the GAME walks it.

    Waypoints in WORLD px; between them the banana moves at the engine's
    168 px/s and then STANDS for `pause` seconds (a tap lands, it walks, it
    arrives, it waits). Query .at(t_seconds) -> (x, y, moving).

        w = Walk([(1200, 700), (1400, 640), (1400, 760)], pause=0.55)
        x, y, moving = w.at(t * secs)
    """

    def __init__(self, points, pause=0.6, speed=WALK_SPEED, start_pause=0.0):
        self.pts = [(float(x), float(y)) for x, y in points]
        self.pause = pause
        self.speed = speed
        self.legs = []
        clock = start_pause
        for a, b in zip(self.pts, self.pts[1:]):
            d = math.hypot(b[0] - a[0], b[1] - a[1])
            dur = d / speed if speed else 0
            self.legs.append((clock, clock + dur, a, b))
            clock += dur + pause
        self.total = clock

    def at(self, ts):
        if ts <= 0:
            return self.pts[0][0], self.pts[0][1], False
        for t0, t1, a, b in self.legs:
            if ts < t0:
                return a[0], a[1], False
            if ts <= t1:
                u = (ts - t0) / max(1e-6, t1 - t0)
                return a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, True
        last = self.pts[-1]
        return last[0], last[1], False


def bob(i, moving, amp=3.0):
    """the little vertical lift while walking (the sprite already dances)"""
    return -abs(math.sin(i * 0.5)) * amp if moving else 0.0


# ---- camera ---------------------------------------------------------------
class Cam:
    """A camera over a plate. Everything is world px; the camera decides px."""

    def __init__(self, plate, cx, cy, view_w):
        self.plate = plate
        self.cx, self.cy, self.vw = float(cx), float(cy), float(view_w)
        self.shake_amt = 0.0

    def look(self, cx, cy, view_w=None):
        self.cx, self.cy = float(cx), float(cy)
        if view_w:
            self.vw = float(view_w)
        return self

    def shot(self):
        """render the current view -> (im, k) with k = screen px per world px"""
        vw = self.vw
        vh = vw * H / W
        x0 = max(0, min(self.plate.width - vw, self.cx - vw / 2))
        y0 = max(0, min(self.plate.height - vh, self.cy - vh / 2))
        if self.shake_amt:
            x0 += self.shake_amt * math.sin(self.shake_amt * 7.3)
            y0 += self.shake_amt * math.cos(self.shake_amt * 5.1)
            x0 = max(0, min(self.plate.width - vw, x0))
            y0 = max(0, min(self.plate.height - vh, y0))
        self._x0, self._y0 = x0, y0
        self._k = W / vw
        im = self.plate.crop((round(x0), round(y0), round(x0 + vw), round(y0 + vh)))
        return im.resize((W, H), Image.NEAREST), self._k

    def tf(self, wx, wy):
        return ((wx - self._x0) * self._k, (wy - self._y0) * self._k)

    @property
    def k(self):
        return self._k


def handheld(t, amp=3.0, seed=0.0):
    """a lazy drift so static shots breathe (never a slide)"""
    return (math.sin(t * 5.1 + seed) * amp, math.cos(t * 3.7 + seed * 1.3) * amp * 0.6)


def put_world(im, cam, sprite, wx, wy, native=1.0, flip=False, anchor='bottom'):
    """paste a NATIVE-size sprite at world (wx, wy)"""
    if flip:
        sprite = sprite.transpose(Image.FLIP_LEFT_RIGHT)
    w = max(1, round(sprite.width * native * cam.k))
    h = max(1, round(sprite.height * native * cam.k))
    s = sprite.resize((w, h), Image.NEAREST)
    x, y = cam.tf(wx, wy)
    oy = h if anchor == 'bottom' else h / 2
    im.alpha_composite(s, (round(x - w / 2), round(y - oy)))


BAN_H = 104   # the banana's true world height on the plates


def world_banana(im, cam, i, outfit, wx, wy, flip=False, lift=0.0, h=BAN_H):
    b = banana(dance_frame(i), outfit, height=max(2, round(h * cam.k)))
    if flip:
        b = b.transpose(Image.FLIP_LEFT_RIGHT)
    x, y = cam.tf(wx, wy)
    im.alpha_composite(b, (round(x - b.width / 2), round(y - b.height + lift)))


# ---- compositing ----------------------------------------------------------
def paste_center(im, sprite, cx, cy, scale=1.0, rot=0):
    s = sprite
    if scale != 1.0:
        s = s.resize((max(1, round(s.width * scale)), max(1, round(s.height * scale))), Image.NEAREST)
    if rot:
        s = s.rotate(rot, expand=True, resample=Image.BICUBIC)
    im.alpha_composite(s, (round(cx - s.width / 2), round(cy - s.height / 2)))


def hero_banana(im, i, outfit, cx, cy, height, tilt=0.0, crop_head=False):
    """⭐ a COOL ANGLE: the banana big in frame, dutch-tilted, optional face crop"""
    b = banana(dance_frame(i), outfit, height=height)
    if crop_head:
        b = b.crop((0, 0, b.width, round(b.height * 0.62)))
    if tilt:
        b = b.rotate(tilt, expand=True, resample=Image.NEAREST)
    im.alpha_composite(b, (round(cx - b.width / 2), round(cy - b.height / 2)))


# ---- effects --------------------------------------------------------------
def sparkle(draw, x, y, r, color=(255, 253, 245, 255)):
    draw.polygon([(x, y - r), (x + r * 0.28, y - r * 0.28), (x + r, y),
                  (x + r * 0.28, y + r * 0.28), (x, y + r),
                  (x - r * 0.28, y + r * 0.28), (x - r, y),
                  (x - r * 0.28, y - r * 0.28)], fill=color)


def sparkle_burst(im, cx, cy, t01, n=10, dist=90, seed=1, color=(255, 225, 53, 255)):
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
        sparkle(d, cx + math.cos(a) * dd, cy + math.sin(a) * dd, r,
                col[:3] + (round(255 * (1 - t01 * t01)),))


def poof(im, cx, cy, t01, seed=3, big=1.0):
    if t01 <= 0 or t01 >= 1:
        return
    rnd = random.Random(seed)
    ov = Image.new('RGBA', im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    for _ in range(8):
        a = rnd.uniform(0, math.tau)
        dd = 46 * big * out_cubic(t01) * (0.5 + 0.5 * rnd.random())
        r = big * (14 + 10 * rnd.random()) * (1 - 0.6 * t01)
        x, y = cx + math.cos(a) * dd, cy + math.sin(a) * dd * 0.6
        d.ellipse([x - r, y - r, x + r, y + r], fill=(232, 234, 242, round(210 * (1 - t01))))
    im.alpha_composite(ov)


def impact_ring(im, cx, cy, t01, r0=10, r1=190, col=(255, 253, 245), width=7):
    """a shockwave ring — the punch under any landing"""
    if t01 <= 0 or t01 >= 1:
        return
    r = r0 + (r1 - r0) * out_cubic(t01)
    ov = Image.new('RGBA', im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    d.ellipse([cx - r, cy - r * 0.42, cx + r, cy + r * 0.42],
              outline=col + (round(220 * (1 - t01)),), width=max(1, round(width * (1 - t01))))
    im.alpha_composite(ov)


def speed_lines(im, t01, n=14, seed=5, col=(255, 253, 245), horizontal=True):
    """anime whoosh streaks — sell a fast move"""
    if t01 <= 0 or t01 >= 1:
        return
    rnd = random.Random(seed)
    ov = Image.new('RGBA', im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    a = round(200 * math.sin(t01 * math.pi))
    for _ in range(n):
        if horizontal:
            y = rnd.uniform(0, H)
            ln = rnd.uniform(60, 260)
            x = rnd.uniform(-100, W)
            d.line([x, y, x + ln, y], fill=col + (a,), width=rnd.choice([2, 3, 4]))
        else:
            x = rnd.uniform(0, W)
            ln = rnd.uniform(60, 300)
            y = rnd.uniform(-100, H)
            d.line([x, y, x, y + ln], fill=col + (a,), width=rnd.choice([2, 3, 4]))
    im.alpha_composite(ov)


def flash(im, amount, col=(255, 253, 245)):
    if amount <= 0:
        return im
    im.alpha_composite(Image.new('RGBA', im.size, col + (round(255 * clamp01(amount)),)))
    return im


def flicker(im, t, hz=9.0, depth=0.10, seed=0.0):
    """a live-screen flicker: brightness jitters a touch"""
    f = 1.0 + depth * math.sin(t * hz * math.tau + seed) * (0.6 + 0.4 * math.sin(t * 3.1))
    return ImageEnhance.Brightness(im).enhance(f)


def blink_fade(im, t01, col=(10, 8, 16)):
    """hard cut cover: 0 = clear, 1 = fully covered (use for beat switches)"""
    if t01 <= 0:
        return im
    im.alpha_composite(Image.new('RGBA', im.size, col + (round(255 * clamp01(t01)),)))
    return im


def shake_img(im, amount):
    """translate the whole frame — camera punch"""
    if amount <= 0.2:
        return im
    dx = math.sin(amount * 9.7) * amount
    dy = math.cos(amount * 7.1) * amount * 0.7
    return im.transform(im.size, Image.AFFINE, (1, 0, dx, 0, 1, dy), resample=Image.NEAREST)


def zoom_punch(im, amount):
    """a quick scale-up on a hit (amount 0..1 = up to +12%)"""
    if amount <= 0:
        return im
    z = 1 + 0.12 * amount
    w2, h2 = round(W * z), round(H * z)
    big = im.resize((w2, h2), Image.NEAREST)
    return big.crop(((w2 - W) // 2, (h2 - H) // 2, (w2 - W) // 2 + W, (h2 - H) // 2 + H))


def chroma_split(im, amount):
    """RGB fringing — a glitchy pulse for drops/wins.

    ⚠️ ImageChops.offset WRAPS: the pixels pushed off one edge reappear on the
    other as a coloured bar down the frame (caught in review — a red stripe on
    the park's left edge). The shifted channels get their edge strips written
    back from the original, so the fringe lives in the picture, not the border.
    """
    if amount <= 0.5:
        return im
    o = max(1, round(amount))
    r, g, b, a = im.split()
    r = ImageChops.offset(r, o, 0)
    b = ImageChops.offset(b, -o, 0)
    out = Image.merge('RGBA', (r, g, b, a))
    w, h = im.size
    o2 = min(o + 1, w // 2)
    out.paste(im.crop((0, 0, o2, h)), (0, 0))
    out.paste(im.crop((w - o2, 0, w, h)), (w - o2, 0))
    return out


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


def sun_rays(im, cx, cy, t, n=12, col=(255, 236, 120), alpha=70, spin=0.4):
    ov = Image.new('RGBA', im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    for k in range(n):
        a0 = k * math.tau / n + t * spin
        d.polygon([(cx, cy),
                   (cx + math.cos(a0) * 1500, cy + math.sin(a0) * 1500),
                   (cx + math.cos(a0 + 0.14) * 1500, cy + math.sin(a0 + 0.14) * 1500)],
                  fill=col + (alpha,))
    im.alpha_composite(ov)


def confetti(im, t01, n=30, seed=12):
    if t01 <= 0:
        return
    rnd = random.Random(seed)
    d = ImageDraw.Draw(im)
    for k in range(n):
        x = rnd.uniform(0, W)
        y = rnd.uniform(-H * 0.35, H * 0.15) + t01 * H * 1.1 * rnd.uniform(0.6, 1.25)
        col = [(255, 225, 53), (255, 93, 143), (94, 200, 224), (94, 224, 138)][k % 4]
        s = rnd.choice([6, 7, 9])
        d.rectangle([x, y, x + s, y + s], fill=col + (225,))


def svg_rects(name):
    """the engine's pixel-SVG accessory art -> [(x, y, w, h, (r,g,b))]"""
    import re
    svg = banana_render.SVGS[name]
    out = []
    for m in re.finditer(r'<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)" fill="(#\w+)"', svg):
        x, y, w, h = (float(m.group(k)) for k in range(1, 5))
        hexc = m.group(5).lstrip('#')
        out.append((x, y, w, h, tuple(int(hexc[j:j + 2], 16) for j in (0, 2, 4))))
    return out


def new_frame(bg=(13, 11, 20, 255)):
    return Image.new('RGBA', (W, H), bg)
