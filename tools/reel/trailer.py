# -*- coding: utf-8 -*-
"""🎬 THE TOWN TRAILER (1 Oct 2026) — the Instagram Reel ad: 1080x1920, 30 fps, ~30 s, silent-safe, the words burned in.
Trym: "an amazing ad video of banana world but the town as the highlight … fast cuts, dramatic scenes, trailer-style …
strong fun and humorous copy … pets like a dog or a cat … free without ads, discord".

The footage is the REAL game, filmed by tools/reel/capture (frames/cap/<shot>/, the clock stepped one frame at a time);
this file is only the edit: a camera over the footage, the cuts, the effects and the words
(src/data/copy/reel-town.json, checked by tools/check-copy.mjs).

RUN   python tools/reel/trailer.py                 -> tools/reel/out/banana-world-town-trailer-1080x1920.mp4
      python tools/reel/trailer.py --contact       -> out/_trailer_sheet.png (a frame every ~0.5 s)
      python tools/reel/trailer.py --beat dog --contact   (one beat)
"""
import argparse
import importlib.util
import json
import math
import os
import sys
import tempfile

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(os.path.dirname(HERE))
CAP = os.path.join(HERE, 'frames', 'cap')
OUT = os.path.join(HERE, 'out')
sys.path.insert(0, os.path.join(SITE, 'tools'))

W, H, FPS = 1080, 1920, 30
# ⚠️ REELS SAFE ZONES (the July reels' rule): the profile row + audio ribbon over the top ~260, the caption, handle and
# CTA under the bottom ~480, the like/share rail down the right ~160. Everything that must be READ lives inside.
TOP_SAFE, BOT_SAFE, RAIL = 260, H - 480, 160
TX = (W - RAIL) // 2 + 20          # the centre line for words: the middle of what the rail leaves
HEAD_Y, SUB_Y = 430, 575           # the headline and its sub sit on ONE grid in every beat

COPY = json.load(open(os.path.join(SITE, 'src', 'data', 'copy', 'reel-town.json'), encoding='utf-8'))
YELLOW, YELLOW2 = (255, 225, 53), (255, 242, 122)
INK, CREAM = (17, 17, 17), (255, 253, 245)
PINK, BLUE, GREEN = (255, 77, 109), (85, 170, 255), (88, 192, 92)
NIGHT = (20, 18, 44)


# ---------------------------------------------------------------- fonts (the site's own, as in the July reels)
def _ttf(woff, wght=None):
    from fontTools.ttLib import TTFont
    tmp = os.path.join(tempfile.gettempdir(), 'banana-ad-fonts')
    os.makedirs(tmp, exist_ok=True)
    ttf = os.path.join(tmp, woff.replace('.woff2', '' if wght is None else '-' + str(wght)) + '.ttf')
    if not os.path.exists(ttf):
        f = TTFont(os.path.join(SITE, 'public', 'fonts', woff))
        f.flavor = None
        if wght and 'fvar' in f:
            from fontTools.varLib.instancer import instantiateVariableFont
            instantiateVariableFont(f, {'wght': wght}, inplace=True)
        f.save(ttf)
    return ttf


FONTS = {'archivo': _ttf('archivoblack-400-latin.woff2'), 'nunito': _ttf('nunito-900-latin.woff2', 900),
         'grotesk': _ttf('spacegrotesk-400-latin.woff2', 700)}
_fc = {}


def font(kind, px):
    k = (kind, px)
    if k not in _fc:
        _fc[k] = ImageFont.truetype(FONTS[kind], px)
    return _fc[k]


# ---------------------------------------------------------------- easing
def clamp01(x):
    return 0.0 if x < 0 else 1.0 if x > 1 else x


def seg(t, a, b):
    return clamp01((t - a) / (b - a)) if b > a else float(t >= b)


def out_cubic(x):
    x = clamp01(x)
    return 1 - (1 - x) ** 3


def in_cubic(x):
    x = clamp01(x)
    return x ** 3


def in_out(x):
    x = clamp01(x)
    return 4 * x ** 3 if x < 0.5 else 1 - (-2 * x + 2) ** 3 / 2


def out_back(x, s=1.9):
    x = clamp01(x)
    c3 = s + 1
    return 1 + c3 * (x - 1) ** 3 + s * (x - 1) ** 2


def lerp(a, b, t):
    return a + (b - a) * t


# ---------------------------------------------------------------- footage
class Shot:
    """A filmed shot: frames/cap/<name>/NNNN.png (+ notes.json from the crew)."""
    def __init__(self, name):
        self.name = name
        self.dir = os.path.join(CAP, name)
        self.ok = os.path.isdir(self.dir)
        self.files = sorted(f for f in os.listdir(self.dir) if f.endswith('.png')) if self.ok else []
        self.n = len(self.files)
        self.ok = self.ok and self.n > 0
        p = os.path.join(self.dir, 'notes.json')
        self.notes = json.load(open(p, encoding='utf-8')) if self.ok and os.path.exists(p) else {}
        self._cache = {}
        self.size = Image.open(os.path.join(self.dir, self.files[0])).size if self.ok else (W, H)

    def frame(self, k):
        k = max(0, min(self.n - 1, int(round(k))))
        if k not in self._cache:
            if len(self._cache) > 6:
                self._cache.pop(next(iter(self._cache)))
            self._cache[k] = Image.open(os.path.join(self.dir, self.files[k])).convert('RGB')
        return self._cache[k]


_shots = {}


def shot(name):
    if name not in _shots:
        _shots[name] = Shot(name)
    return _shots[name]


def cam(src, cx, cy, z):
    """The camera: a window of the source centred on (cx, cy) at zoom z (output px per source px), kept inside the
    source (z rises if the window would be bigger than the footage), resampled to the frame."""
    sw, sh = src.size
    z = max(z, W / sw, H / sh)
    ww, wh = W / z, H / z
    x0 = max(0.0, min(max(cx - ww / 2, 0), sw - ww))   # max(0, …): a window the size of the footage rounds a hair past it
    y0 = max(0.0, min(max(cy - wh / 2, 0), sh - wh))
    ww, wh = min(ww, sw - x0), min(wh, sh - y0)
    return src.resize((W, H), Image.LANCZOS if z < 1 else Image.BICUBIC, box=(x0, y0, x0 + ww, y0 + wh))


def keyed(keys, t):
    """Camera keyframes [(t, cx, cy, z, ease?), …] -> (cx, cy, z) at t (seconds into the beat)."""
    if t <= keys[0][0]:
        return keys[0][1:4]
    for a, b in zip(keys, keys[1:]):
        if t <= b[0]:
            e = b[4] if len(b) > 4 else in_out
            p = e(seg(t, a[0], b[0]))
            return tuple(lerp(a[i], b[i], p) for i in (1, 2, 3))
    return keys[-1][1:4]


# ---------------------------------------------------------------- words
_tl = {}


def words(text, kind='archivo', px=112, fill=CREAM, stroke=INK, sw=None, shadow=(8, 11)):
    """A line of type in the series style: cream, a thick black stroke, a hard black shadow. Cached RGBA layer."""
    key = (text, kind, px, fill, stroke, sw, shadow)
    if key in _tl:
        return _tl[key]
    f = font(kind, px)
    sw = sw if sw is not None else max(5, px // 10)
    bb = ImageDraw.Draw(Image.new('L', (1, 1))).textbbox((0, 0), text, font=f, stroke_width=sw)
    pad = sw + 10
    sx, sy = shadow or (0, 0)
    im = Image.new('RGBA', (bb[2] - bb[0] + 2 * pad + sx, bb[3] - bb[1] + 2 * pad + sy), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    ox, oy = pad - bb[0], pad - bb[1]
    if shadow:
        d.text((ox + sx, oy + sy), text, font=f, fill=INK, stroke_width=sw, stroke_fill=INK)
    d.text((ox, oy), text, font=f, fill=fill, stroke_width=sw, stroke_fill=stroke)
    _tl[key] = im
    return im


def fit_words(text, kind='archivo', px=112, max_w=860, **kw):
    while px > 40:
        im = words(text, kind, px, **kw)
        if im.width <= max_w:
            return im
        px -= 6
    return words(text, kind, px, **kw)


def pill(text, px=46, fg=INK, bg=CREAM, kind='grotesk', border=6, shadow=8, padx=28, pady=14):
    """The banner's pill: cream (or any) ground, a black border, a hard shadow."""
    key = ('pill', text, px, fg, bg, kind)
    if key in _tl:
        return _tl[key]
    f = font(kind, px)
    bb = ImageDraw.Draw(Image.new('L', (1, 1))).textbbox((0, 0), text, font=f)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    w, h = tw + 2 * padx + 2 * border, th + 2 * pady + 2 * border
    im = Image.new('RGBA', (w + shadow, h + shadow), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rectangle((shadow, shadow, w + shadow - 1, h + shadow - 1), fill=INK)
    d.rectangle((0, 0, w - 1, h - 1), fill=INK)
    d.rectangle((border, border, w - border - 1, h - border - 1), fill=bg)
    d.text((border + padx - bb[0], border + pady - bb[1]), text, font=f, fill=fg)
    _tl[key] = im
    return im


def place(frame, layer, cx, cy, scale=1.0, rot=0.0, alpha=1.0):
    """Paste a layer centred on (cx, cy), scaled and turned, faded by alpha."""
    if alpha <= 0.01 or scale <= 0.01:
        return
    lay = layer
    if abs(scale - 1) > 0.004:
        lay = lay.resize((max(1, round(lay.width * scale)), max(1, round(lay.height * scale))), Image.BICUBIC)
    if abs(rot) > 0.05:
        lay = lay.rotate(rot, Image.BICUBIC, expand=True)
    if alpha < 0.999:
        a = lay.getchannel('A').point(lambda v: int(v * alpha))
        lay = lay.copy()
        lay.putalpha(a)
    frame.alpha_composite(lay, (int(round(cx - lay.width / 2)), int(round(cy - lay.height / 2))))


def slam(frame, layer, cx, cy, t, at, rot=-3.0, big=1.7, dur=0.3, out_at=None):
    """A word lands: big and see-through -> its size with an overshoot, the tilt settling; optional quick exit."""
    p = seg(t, at, at + dur)
    if p <= 0:
        return
    s = lerp(big, 1.0, out_back(p))
    r = rot * (1 + 1.5 * (1 - out_cubic(p)))
    a = clamp01(p * 3)
    if out_at is not None and t > out_at:
        q = seg(t, out_at, out_at + 0.12)
        s *= 1 - 0.25 * q
        a *= 1 - q
    place(frame, layer, cx, cy, s, r, a)


def pop(frame, layer, cx, cy, t, at, rot=2.0, dur=0.22):
    """A pill pops up from below its place."""
    p = seg(t, at, at + dur)
    if p <= 0:
        return
    place(frame, layer, cx, cy + 40 * (1 - out_cubic(p)), lerp(0.6, 1.0, out_back(p)), rot, clamp01(p * 2.5))


# ---------------------------------------------------------------- effects (1080x1920, numpy)
def flash(img, amt, col=CREAM):
    if amt <= 0.01:
        return img
    return Image.blend(img, Image.new('RGB', img.size, col), clamp01(amt))


def chroma(img, amt):
    """Red and blue pulled apart by `amt` px — edges clamped, never wrapped."""
    n = int(round(amt))
    if n < 1:
        return img
    a = np.asarray(img).copy()
    r, b = a[:, :, 0].copy(), a[:, :, 2].copy()
    a[:, n:, 0] = r[:, :-n]
    a[:, :n, 0] = r[:, :1]
    a[:, :-n, 2] = b[:, n:]
    a[:, -n:, 2] = b[:, -1:]
    return Image.fromarray(a)


def whip(img, amt, horizontal=True):
    """A whip pan's smear: the frame averaged with itself shifted up to `amt` px."""
    n = int(amt)
    if n < 2:
        return img
    a = np.asarray(img).astype(np.float32)
    acc = np.zeros_like(a)
    steps = 9
    for k in range(steps):
        s = int(n * k / (steps - 1))
        acc += np.roll(a, s, axis=1 if horizontal else 0)
    return Image.fromarray(np.clip(acc / steps, 0, 255).astype(np.uint8))


def grade(img, tint=None, dark=0.0, sat=1.0):
    """Colour grade: desaturate, darken, tint (the night)."""
    a = np.asarray(img).astype(np.float32)
    if sat != 1.0:
        g = a.mean(axis=2, keepdims=True)
        a = g + (a - g) * sat
    if dark:
        a *= 1 - dark
    if tint is not None:
        t = np.array(tint, np.float32).reshape(1, 1, 3) / 255.0
        a = a * (0.55 + 0.45 * t * 1.6)
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


_vig = None


def vignette(img, strength=0.35):
    global _vig
    if _vig is None:
        y, x = np.mgrid[0:H, 0:W].astype(np.float32)
        d = np.sqrt(((x - W / 2) / (W / 2)) ** 2 + ((y - H / 2) / (H / 2)) ** 2) / math.sqrt(2)
        _vig = np.clip(d, 0, 1) ** 2.2
    a = np.asarray(img).astype(np.float32)
    a *= (1 - strength * _vig)[:, :, None]
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def top_shade(img, alpha=0.45, height=760):
    """A soft dark wash behind the headline so the words read over any footage."""
    a = np.asarray(img).astype(np.float32)
    ramp = np.clip(1 - np.arange(height, dtype=np.float32) / height, 0, 1) ** 1.6 * alpha
    a[:height] *= (1 - ramp)[:, None, None]
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def bars(img, amt):
    """Letterbox bars sliding in (the night turns cinematic)."""
    h = int(240 * out_cubic(amt))
    if h <= 0:
        return img
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, W, h), fill=(6, 6, 10))
    d.rectangle((0, H - h, W, H), fill=(6, 6, 10))
    return img


_ang = None


def rays(t, cx=540, cy=760, spin=6.0):
    """The party: yellow rays turning slowly, a white glow — the homepage / banner look."""
    global _ang
    if _ang is None or _ang[0] != (cx, cy):
        y, x = np.mgrid[0:H, 0:W].astype(np.float32)
        ang = (np.degrees(np.arctan2(y - cy, x - cx)) + 360) % 360
        rad = np.sqrt((x - cx) ** 2 + ((y - cy) * 1.15) ** 2)
        _ang = ((cx, cy), ang, rad)
    _, ang, rad = _ang
    a = (ang + t * spin) % 18 < 9
    img = np.where(a[:, :, None], np.array(YELLOW2, np.float32), np.array(YELLOW, np.float32))
    glow = np.clip(1 - rad / 760, 0, 1) ** 1.5 * 0.85
    img = img + (255 - img) * glow[:, :, None]
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))


CONF = [PINK, BLUE, INK, CREAM, GREEN, (255, 123, 172)]


def confetti(frame, t, n=36, seed=3, fall=260, area=(0, 0, W, H)):
    """Square confetti drifting down, every piece seeded (deterministic)."""
    d = ImageDraw.Draw(frame)
    x0, y0, x1, y1 = area
    for k in range(n):
        rx = ((k * 97 + seed * 31) % 1000) / 1000
        ry = ((k * 53 + seed * 17) % 1000) / 1000
        sp = 0.6 + ((k * 29) % 10) / 12
        x = x0 + rx * (x1 - x0) + 24 * math.sin(t * 2.2 + k)
        y = y0 + ((ry * (y1 - y0) + t * fall * sp) % (y1 - y0))
        s = 12 + (k % 3) * 4
        ang = t * (90 + k * 7) + k * 40
        c, sn = math.cos(math.radians(ang)), math.sin(math.radians(ang))
        pts = [(x + c * dx - sn * dy, y + sn * dx + c * dy) for dx, dy in ((-s, -s), (s, -s), (s, s), (-s, s))]
        d.polygon(pts, fill=CONF[k % len(CONF)])


# ---------------------------------------------------------------- the classic banana (the real dance, 10 fps)
_ban = {}


def classic(k_px=24):
    """The 8 dance frames of the plain banana at exactly k_px per art pixel (one shared crop, so he never jumps)."""
    if k_px in _ban:
        return _ban[k_px]
    import banana_render
    S = 4
    P = 128 * S / 9                                  # one art pixel at this render scale (see the bot-card trick)
    raw = [banana_render.render(i, {'hat': 'none', 'glasses': 'none', 'extras': {}}, scale=S, lenient=True) for i in range(8)]
    boxes = [r.getbbox() for r in raw]
    box = (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))
    out = []
    for r in raw:
        c = r.crop(box)
        out.append(c.resize((round(c.width * k_px / P), round(c.height * k_px / P)), Image.NEAREST))
    _ban[k_px] = out
    return out


def dance_frame(t):
    return int(t * 10) % 8          # BASE_CYCLE_S 0.8 over 8 frames: the engine's true 10 fps


# ---------------------------------------------------------------- beats
def missing(name, t):
    img = Image.new('RGB', (W, H), (40, 30, 50))
    d = ImageDraw.Draw(img)
    d.text((80, 900), 'FOOTAGE TO COME: ' + name, font=font('grotesk', 48), fill=CREAM)
    return img.convert('RGBA')


def beat_hook(b, t, i):
    """0-2.2 s: the classic banana dancing in the party, everybody's banana since 1999 — then the punch and the flash."""
    T = b['secs']
    img = rays(t).convert('RGBA')
    confetti(img, t, n=26, seed=5, fall=180)
    frames = classic(24)
    f = frames[dance_frame(t)]
    punch = in_cubic(seg(t, T - 0.55, T - 0.05))
    sc = 1.0 + 0.55 * punch
    place(img, f, 520, 1000 + 160 * punch, sc)
    slam(img, fit_words(COPY['hook']['line'], px=104), TX, HEAD_Y, t, 0.18)
    pop(img, pill(COPY['hook']['sub'], px=44), TX, SUB_Y, t, 0.75)
    rgb = img.convert('RGB')
    if punch > 0:
        rgb = whip(rgb, 30 * punch, horizontal=False)
    return rgb, {'flash': seg(t, T - 0.12, T)}


def _best(s):
    """The crew's best range (notes.json best[0]), else the whole shot."""
    best = (s.notes.get('best') or [{}])[0]
    return (int(best.get('from', 0)), int(best.get('to', s.n - 1)))


def _auto_cam(s, b):
    """No keys given: centre on the crew's focus points (notes.json, device px) in frame order, pushing in from z0 to
    z1 over the beat; with no focus, the middle of the footage."""
    z0, z1 = b.get('z', (0.92, 1.06))
    T = b['secs']
    f0, f1 = b.get('frames') or _best(s)
    fp = sorted((p for p in s.notes.get('focus', []) if 'x' in p and 'y' in p), key=lambda p: p.get('frame', 0))
    if not fp:
        cx, cy = s.size[0] / 2, s.size[1] / 2
        return [(0, cx, cy, z0), (T, cx, cy, z1)]
    keys = []
    for p in fp:
        tt = (p.get('frame', f0) - f0) / FPS / b.get('speed', 1.0)
        keys.append((max(0.0, min(T, tt)), p['x'], p['y']))
    keys.sort()
    out = [(0.0, keys[0][1], keys[0][2])] + [k for k in keys if 0 < k[0] < T] + [(T, keys[-1][1], keys[-1][2])]
    return [(tt, x, y, lerp(z0, z1, tt / T)) for tt, x, y in out]


def beat_footage(b, t, i):
    """A filmed beat: footage frames through the camera keys, the grade, then the words."""
    s = shot(b['shot'])
    if not s.ok:
        return missing(b['shot'], t).convert('RGB'), {}
    f0, f1 = b.get('frames') or _best(s)
    speed = b.get('speed', 1.0)
    k = f0 + t * FPS * speed
    if b.get('hold_end', True):
        k = min(k, f1)
    src = s.frame(k)
    cx, cy, z = keyed(b['cam'] if isinstance(b.get('cam'), list) else _auto_cam(s, b), t)
    if b.get('punch_in'):
        z *= 1 + 0.18 * (1 - out_cubic(seg(t, 0, 0.25)))
    if b.get('shake'):
        at, amt = b['shake']
        q = seg(t, at, at + 0.35)
        if 0 < q < 1:
            cx += amt * (1 - q) * math.sin(i * 2.7) * 2
            cy += amt * (1 - q) * math.cos(i * 3.1) * 2
    img = cam(src, cx, cy, z)
    g = b.get('grade')
    if g:
        img = grade(img, **(g(t) if callable(g) else g))
    img = top_shade(img, alpha=b.get('shade', 0.42))
    img = vignette(img, 0.28)
    img = img.convert('RGBA')
    for w in b.get('words', []):
        kind = w.get('kind', 'slam')
        layer = fit_words(w['text'], px=w.get('px', 104)) if kind == 'slam' else pill(w['text'], px=w.get('px', 46), bg=w.get('bg', CREAM), fg=w.get('fg', INK))
        y = w.get('y', HEAD_Y if kind == 'slam' else SUB_Y)
        if kind == 'slam':
            slam(img, layer, TX, y, t, w.get('at', 0.15), rot=w.get('rot', -3.0), big=w.get('big', 1.7), out_at=w.get('out'))
        else:
            pop(img, layer, TX, y, t, w.get('at', 0.55), rot=w.get('rot', 2.0))
    rgb = img.convert('RGB')
    fx = {}
    if b.get('bars'):
        rgb = bars(rgb, b['bars'](t))
    if b.get('glitch'):
        rgb = chroma(rgb, b['glitch'](t, i))
    return rgb, fx


def arched(img, text, cy, t, at=0.05, px=150, max_w=880):
    """The series' arched name (the homepage / banner): letters at their own widths, a parabola down to both ends
    (translateY(t² · 0.26em)), each turned t · 7°, landing one after another."""
    f = font('archivo', px)
    adv = [f.getlength(ch) * (0.55 if ch == ' ' else 1.0) for ch in text]
    total = sum(adv)
    k = min(1.0, max_w / total)
    x = TX - total * k / 2
    n = len(text)
    for j, ch in enumerate(text):
        w = adv[j] * k
        if ch != ' ':
            tt = (2 * j) / (n - 1) - 1
            p = seg(t, at + 0.03 * j, at + 0.3 + 0.03 * j)
            if p > 0:
                lay = words(ch, 'archivo', px, sw=12, shadow=(9, 12))
                y = cy + tt * tt * 0.26 * px * k + 70 * (1 - out_back(p))
                place(img, lay, x + w / 2, y, k * lerp(1.6, 1.0, out_back(p)), -tt * 7, clamp01(p * 3))
        x += w


def two_line_pill(top, big, top_px=30, big_px=50, fg=YELLOW, sub=CREAM, bg=INK, border=6, shadow=8, padx=30, pady=14):
    """A black pill with a small line over a big one: what to do, then where."""
    key = ('pill2', top, big)
    if key in _tl:
        return _tl[key]
    f1, f2 = font('grotesk', top_px), font('grotesk', big_px)
    d0 = ImageDraw.Draw(Image.new('L', (1, 1)))
    b1, b2 = d0.textbbox((0, 0), top, font=f1), d0.textbbox((0, 0), big, font=f2)
    tw = max(b1[2] - b1[0], b2[2] - b2[0])
    gap = 10
    w = tw + 2 * padx + 2 * border
    h = (b1[3] - b1[1]) + gap + (b2[3] - b2[1]) + 2 * pady + 2 * border
    im = Image.new('RGBA', (w + shadow, h + shadow), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rectangle((shadow, shadow, w + shadow - 1, h + shadow - 1), fill=(0, 0, 0, 90))
    d.rectangle((0, 0, w - 1, h - 1), fill=bg)
    y = border + pady
    d.text(((w - (b1[2] - b1[0])) / 2 - b1[0], y - b1[1]), top, font=f1, fill=sub)
    y += (b1[3] - b1[1]) + gap
    d.text(((w - (b2[2] - b2[0])) / 2 - b2[0], y - b2[1]), big, font=f2, fill=fg)
    _tl[key] = im
    return im


ORGANIC = False   # --organic: the end card also says where the link is (an ad has Instagram's own button instead)


def beat_end(b, t, i):
    """The end card: the party again, BANANA WORLD arched over the classic banana, what it costs, where it is, the
    Discord. Everything between the safe lines (top 260, bottom 1440)."""
    img = rays(t, cy=760).convert('RGBA')
    confetti(img, t + 3, n=34, seed=9, fall=200)
    arched(img, COPY['end']['title'].upper(), 400, t)
    f = classic(15)[dance_frame(t)]
    place(img, f, TX, 745, 1.0)
    pop(img, pill(COPY['end']['free'], px=46, bg=CREAM), TX, 1078, t, 0.5, rot=-1.5)
    pop(img, two_line_pill(COPY['end']['playLabel'], COPY['end']['play']), TX, 1190, t, 0.8, rot=1.2)
    av = _avatar(118)
    disc = pill(COPY['end']['discord'], px=42, bg=BLUE, fg=CREAM)
    p = seg(t, 1.1, 1.35)
    if p > 0:
        row_w = av.width + 20 + disc.width
        x0 = TX - row_w / 2
        place(img, av, x0 + av.width / 2, 1335, lerp(0.5, 1, out_back(p)), 0, clamp01(p * 2.5))
        place(img, disc, x0 + av.width + 20 + disc.width / 2, 1335, lerp(0.5, 1, out_back(p)), -1.0, clamp01(p * 2.5))
    if ORGANIC:
        pop(img, words(COPY['end']['bio'], 'grotesk', 40, sw=4, shadow=(3, 4)), TX, 1420, t, 1.6, rot=0)
    return img.convert('RGB'), {}


_av = {}


def _avatar(px):
    if px not in _av:
        a = Image.open(os.path.join(SITE, 'worker-bot', 'avatar.png')).convert('RGBA').resize((px, px), Image.LANCZOS)
        m = Image.new('L', (px, px), 0)
        ImageDraw.Draw(m).ellipse((0, 0, px - 1, px - 1), fill=255)
        ring = Image.new('RGBA', (px + 12, px + 12), (0, 0, 0, 0))
        ImageDraw.Draw(ring).ellipse((0, 0, px + 11, px + 11), fill=INK)
        ring.paste(a, (6, 6), m)
        _av[px] = ring
    return _av[px]


def beat_panel(b, t, i):
    """Footage set as a framed screen under the headline — for a screen whose top matters (the arcade's score row,
    the Items Workshop's hat), which a full-frame crop would hide under Instagram's top bar or under the words. Over the
    arcade room (blurred, dark) or the party rays. Cuts: [(t, shot, first frame), …]."""
    if b.get('bg') == 'rays':
        img = rays(t, cy=1000).convert('RGBA')
        confetti(img, t + 7, n=18, seed=4, fall=160)
    else:
        room = shot('town-arcade-room')
        if room.ok:
            bg = cam(room.frame(60 + t * FPS), 1000, 820, 1.11).filter(ImageFilter.GaussianBlur(6))
            bg = grade(bg, dark=0.5, sat=0.8)
        else:
            bg = Image.new('RGB', (W, H), NIGHT)
        img = vignette(bg, 0.5).convert('RGBA')
    cuts = b['cuts']
    t0, name, f0 = [c for c in cuts if t >= c[0]][-1]
    s = shot(name)
    if s.ok:
        g = s.frame(f0 + (t - t0) * FPS)
        w = b.get('panel_w', 900)
        g = g.resize((w, round(g.height * w / g.width)), Image.LANCZOS)
        panel = Image.new('RGBA', (w + 18 + 14, g.height + 18 + 14), (0, 0, 0, 0))
        d = ImageDraw.Draw(panel)
        d.rectangle((14, 14, w + 18 + 13, g.height + 18 + 13), fill=(0, 0, 0, 150))
        d.rectangle((0, 0, w + 17, g.height + 17), fill=INK)
        panel.paste(g, (9, 9))
        q = 1 - out_cubic(seg(t, t0, t0 + 0.2))
        place(img, panel, TX, b.get('panel_top', 545) + panel.height / 2, 1 + 0.1 * q, b.get('panel_rot', -1.2) + 2.5 * q)
    for w_ in b.get('words', []):
        slam(img, fit_words(w_['text'], px=w_.get('px', 100)), TX, HEAD_Y, t, w_.get('at', 0.12))
    rgb = img.convert('RGB')
    for c in cuts[1:]:
        rgb = flash(rgb, 0.8 * (1 - seg(t, c[0], c[0] + 0.12)) if t >= c[0] else 0)
    return rgb, {}


def night_grade(t):
    return {'tint': (90, 110, 255), 'dark': 0.18, 'sat': 0.8}


# The cut. Each beat: secs, fn, and for footage the shot, its frame range, camera keys [(t, cx, cy, z)], words.
# Cut-ins: 'cut_in' = 'flash' | 'whip' | 'punch' | 'dark'. Copy comes from COPY (reel-town.json).
C = COPY
BEATS = [
    {'name': 'hook', 'secs': 2, 'fn': beat_hook},
    {'name': 'town', 'secs': 2.1, 'fn': beat_footage, 'shot': 'town-crowd', 'frames': (0, 70), 'cut_in': 'flash',
     'cam': [(0, 1000, 470, 1.25), (0.32, 1000, 520, 1.22), (1.05, 1000, 1180, 0.86), (2.1, 1000, 1420, 0.92)],
     'words': [{'text': C['town']['line'], 'at': 0.2}]},
    {'name': 'job', 'secs': 2.1, 'fn': beat_footage, 'shot': 'town-job-hired', 'frames': (58, 124), 'cut_in': 'whip',
     'cam': [(0, 640, 1150, 1.18), (0.95, 640, 1010, 1.12), (1.34, 640, 930, 1.38, out_cubic), (2.1, 640, 990, 1.42)],
     'words': [{'text': C['job']['line'], 'at': 0.12}, {'kind': 'pill', 'text': C['job']['sub'], 'at': 0.7}]},
    {'name': 'arcade', 'secs': 2, 'fn': beat_panel, 'cut_in': 'punch',
     'cuts': [(0.0, 'town-arcade-stack', 38), (1.05, 'town-arcade-snake', 77)],
     'words': [{'text': C['arcade']['line'], 'at': 0.12}]},
    {'name': 'wheel', 'secs': 1.5, 'fn': beat_footage, 'shot': 'town-wheel-clean', 'frames': (68, 119), 'cut_in': 'whip',
     'cam': [(0, 640, 1040, 1.22), (0.93, 640, 1030, 1.26), (1.1, 640, 1025, 1.36, out_cubic), (1.5, 640, 1020, 1.4)],
     'words': [{'text': C['wheel']['line'], 'at': 0.12}]},
    {'name': 'night', 'secs': 1.7, 'fn': beat_footage, 'shot': 'town-night-fall', 'frames': (28, 85), 'cut_in': 'dark',
     'cam': [(0, 1100, 1250, 0.8), (1.7, 1100, 1330, 0.9)], 'grade': {'tint': (150, 165, 255), 'dark': 0.06, 'sat': 0.9},
     'bars': lambda t: seg(t, 0.0, 0.5),
     'words': [{'text': C['night']['line'], 'at': 0.3, 'big': 1.3, 'rot': -2}]},
    {'name': 'curse', 'secs': 1.6, 'fn': beat_footage, 'shot': 'town-night-fall', 'frames': (82, 130), 'cut_in': 'flash',
     'cam': [(0, 1100, 1350, 0.92), (1.6, 1100, 1480, 1.3)], 'bars': lambda t: 1.0,
     'glitch': lambda t, i: 12 if t < 0.25 or (i % 9) in (0, 1) else 0,
     'words': [{'text': C['curse']['line'], 'at': 0.08}]},
    {'name': 'ghost', 'secs': 1.7, 'fn': beat_footage, 'shot': 'town-night-ghost', 'frames': (50, 104), 'cut_in': 'whip',
     'cam': [(0, 640, 900, 1.35), (1.04, 450, 890, 1.7), (1.7, 390, 885, 1.95)], 'bars': lambda t: 1.0,
     'words': [{'text': C['ghost']['line'], 'at': 0.1}]},
    {'name': 'giant', 'secs': 2, 'fn': beat_footage, 'shot': 'town-night-giant', 'frames': (46, 112), 'cut_in': 'punch',
     'cam': [(0, 420, 1250, 1.25), (0.56, 400, 1290, 1.35), (0.73, 390, 1300, 1.9, out_cubic), (2, 520, 1260, 1.7)],
     'bars': lambda t: 1.0 - seg(t, 1.7, 2.2), 'shake': (0.68, 26),
     'words': [{'text': C['giant']['line'], 'at': 0.15, 'px': 92}, {'kind': 'pill', 'text': C['giant']['sub'], 'at': 0.85, 'px': 58, 'bg': PINK, 'fg': CREAM}]},
    {'name': 'home', 'secs': 1.8, 'fn': beat_footage, 'shot': 'home-farm', 'frames': (8, 66), 'cut_in': 'flash',
     'cam': [(0, 700, 620, 1.05), (0.66, 760, 760, 1.05), (1.18, 900, 1150, 1.6), (1.8, 920, 1190, 1.75)],
     'words': [{'text': C['home']['line'], 'at': 0.15}]},
    {'name': 'dog', 'secs': 2, 'fn': beat_footage, 'shot': 'home-dog', 'frames': (40, 106), 'cut_in': 'whip',
     'cam': [(0, 420, 1080, 1.55), (0.91, 640, 1260, 1.85), (2, 690, 1290, 2.1)],
     'words': [{'text': C['dog']['line'], 'at': 0.15}]},
    {'name': 'cat', 'secs': 1.8, 'fn': beat_footage, 'shot': 'home-cat', 'frames': (50, 110), 'cut_in': 'whip',
     'cam': [(0, 660, 1120, 1.7), (1.8, 684, 1140, 2.1)],
     'words': [{'text': C['cat']['line'], 'at': 0.15}]},
    {'name': 'm-rave', 'secs': 0.9, 'fn': beat_footage, 'shot': 'rave-floor', 'frames': (26, 53), 'cut_in': 'flash',
     'cam': [(0, 680, 900, 1.06), (0.9, 560, 800, 1.22)], 'words': [{'text': C['montage'][0], 'at': 0.04, 'big': 1.4}]},
    {'name': 'm-bay', 'secs': 0.9, 'fn': beat_footage, 'shot': 'bay-dig', 'frames': (64, 91), 'cut_in': 'punch',
     'cam': [(0, 808, 1330, 0.98), (0.9, 804, 1300, 1.12)], 'words': [{'text': C['montage'][1], 'at': 0.04, 'big': 1.4}]},
    {'name': 'm-park', 'secs': 0.9, 'fn': beat_footage, 'shot': 'park-garden', 'frames': (24, 51), 'cut_in': 'punch',
     'cam': [(0, 720, 1330, 1.3), (0.9, 712, 1350, 1.5)], 'words': [{'text': C['montage'][2], 'at': 0.04, 'big': 1.4}]},
    {'name': 'm-forge', 'secs': 1.5, 'fn': beat_panel, 'bg': 'rays', 'cuts': [(0.0, 'forge-draw', 54)], 'panel_w': 880, 'panel_top': 560,
     'panel_rot': 1.5, 'cut_in': 'punch', 'words': [{'text': C['montage'][3], 'at': 0.04}]},
    {'name': 'crowd', 'secs': 2, 'fn': beat_footage, 'shot': 'town-wave', 'frames': (10, 80), 'cut_in': 'flash',
     'cam': [(0, 600, 1320, 1.0), (1.09, 520, 1360, 1.5), (2, 490, 1300, 1.75)],
     'words': [{'text': C['crowd']['line'], 'at': 0.15}, {'kind': 'pill', 'text': C['crowd']['sub'], 'at': 0.8}]},
    {'name': 'end', 'secs': 3, 'fn': beat_end, 'cut_in': 'flash'},
]


def cut_in(kind, img, t, prev):
    """The first frames of a beat: a white flash, a whip smear, a zoom punch, or up from black."""
    if kind == 'flash':
        return flash(img, 1 - seg(t, 0, 0.16))
    if kind == 'whip':
        q = 1 - out_cubic(seg(t, 0, 0.2))
        return whip(img, 140 * q) if q > 0.02 else img
    if kind == 'punch':
        q = 1 - out_cubic(seg(t, 0, 0.18))
        if q < 0.02:
            return img
        s = 1 + 0.16 * q
        big = img.resize((round(W * s), round(H * s)), Image.BICUBIC)
        x0, y0 = (big.width - W) // 2, (big.height - H) // 2
        return flash(big.crop((x0, y0, x0 + W, y0 + H)), 0.35 * q)
    if kind == 'dark':
        return Image.blend(Image.new('RGB', img.size, (0, 0, 0)), img, out_cubic(seg(t, 0, 0.35)))
    return img


def timeline(only=None):
    out, t0 = [], 0.0
    for b in BEATS:
        n = round(b['secs'] * FPS)
        if only is None or b['name'] == only:
            out.append((b, t0, n))
        t0 += n / FPS
    return out


def render_frame(b, i):
    t = i / FPS
    img, fx = b['fn'](b, t, i)
    img = cut_in(b.get('cut_in'), img, t, None)
    if fx.get('flash'):
        img = flash(img, fx['flash'])
    return img


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--contact', action='store_true')
    ap.add_argument('--beat')
    ap.add_argument('--every', type=float, default=0.5)
    ap.add_argument('--organic', action='store_true', help='the end card says where the link is (an organic post)')
    args = ap.parse_args()
    global ORGANIC
    ORGANIC = args.organic
    os.makedirs(OUT, exist_ok=True)
    tl = timeline(args.beat)
    total = sum(n for _, _, n in tl)
    if args.contact:
        thumbs = []
        for b, t0, n in tl:
            step = max(1, round(args.every * FPS))
            for i in list(range(0, n, step)) + [n - 1]:
                im = render_frame(b, i).resize((216, 384), Image.LANCZOS)
                ImageDraw.Draw(im).text((6, 4), '%s %.2f' % (b['name'], t0 + i / FPS), fill=(255, 255, 0))
                thumbs.append(im)
        cols = 10
        rows = (len(thumbs) + cols - 1) // cols
        sheet = Image.new('RGB', (cols * 220 + 4, rows * 388 + 4), (16, 16, 20))
        for k, th in enumerate(thumbs):
            sheet.paste(th, (4 + (k % cols) * 220, 4 + (k // cols) * 388))
        p = os.path.join(OUT, '_trailer_sheet' + ('_' + args.beat if args.beat else '') + '.png')
        sheet.save(p)
        print(p, sheet.size, '%.1f s' % (total / FPS))
        return
    import imageio_ffmpeg
    dst = os.path.join(OUT, 'banana-world-town-trailer-1080x1920' + ('-organic' if ORGANIC else '') + '.mp4')
    # ⚠️ macro_block_size=1: the default pads 1080 to 1088 wide, which is no longer 9:16
    wr = imageio_ffmpeg.write_frames(dst, (W, H), fps=FPS, codec='libx264', pix_fmt_out='yuv420p', macro_block_size=1,
                                     output_params=['-crf', '17', '-preset', 'slow', '-movflags', '+faststart'])
    wr.send(None)
    done = 0
    for b, t0, n in tl:
        for i in range(n):
            wr.send(np.ascontiguousarray(render_frame(b, i)).tobytes())
            done += 1
        print('  %-8s %3d frames  (%d/%d)' % (b['name'], n, done, total), flush=True)
    wr.close()
    print(dst, '%.1f s' % (total / FPS), '%.1f MB' % (os.path.getsize(dst) / 1e6))


if __name__ == '__main__':
    main()
