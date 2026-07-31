# -*- coding: utf-8 -*-
"""📱 THE THREE INSTAGRAM REELS ADS (1080x1920, 9:16) — Aug 2026 flight.

Three cuts, ONE proposition: make your own dancing banana. What changes is
where it takes you.

    world  ~22s  make a banana -> it's your character in the whole world
    beach  ~25s  make a banana -> take it to Banana Bay
    rave   ~22s  make a banana -> take it to the Banana Rave

⭐ THE ONE DESIGN IDEA: every area beat is shown INSIDE A GAME SCREEN — a
bordered viewport sitting in the middle of the frame, holding a 2x crop of the
REAL world plate (public/assets/beach|park/*.png) with real banana sprites
standing in it. Not a drawn impression of the game: the game. It also solves
9:16 honestly — a 2760x1100 landscape map cannot fill a portrait frame, and
letterboxing it would read as a mistake rather than a screen.

⚠️ SLOWER THAN AD C AND AD D ON PURPOSE (Trym: "make sure theres enough time
between transitions so it doesnt move too quick"). Nothing is on screen for
less than ~1.1s and most beats run 2.4-3.0s. Ad C's ~0.6s cuts read as a
seizure on a phone held at arm's length.

⚠️ REELS SAFE ZONES — Instagram's own chrome eats the edges:
      top ~260px  profile row + audio ribbon
   bottom ~480px  caption, handle, CTA button
    right ~160px  like/comment/share/more rail
Everything that must be READ lives between those. The viewport is centred in
what's left. (Ad D used TikTok's rails, which are close but not the same.)

⚠️ SILENT-SAFE. Reels are sound-on, but ads are scrolled past muted all day —
every beat carries its own caption, and no beat depends on the music landing.

INPUTS  ad-pack/renders-reels/<set>-<0..7>.png — 512px transparent engine
        renders (drawComposite). Sets: bare, dress1..4, raver1..4,
        beach1..3, park1..2. Regenerate with tools/ad-render-receiver.py plus
        the browser snippet in that file's docstring.

RUN     python tools/build-reels.py --reel world|beach|rave|all
"""
import argparse
import math
import os
import random
import subprocess
import tempfile

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H = 1080, 1920
FPS = 24

TOP_SAFE = 260
BOT_SAFE = H - 480
RIGHT_SAFE = W - 160

# the site's own palette
YELLOW = (255, 225, 53)
INK = (17, 17, 17)
CREAM = (250, 247, 234)
CYAN = (120, 235, 255)
PINK = (255, 77, 157)
GREEN = (88, 192, 92)
PURPLE = (179, 136, 255)
SAND = (250, 226, 170)
SEA = (54, 132, 158)
CLUB = (13, 11, 20)
CLUB_CHECK = (179, 136, 255)
LAWN = (104, 170, 74)
CONF = [YELLOW, PINK, CYAN, GREEN]

# the game screen: centred between the rails, 16:14-ish so the map reads wide
VP = (60, 560, 1020, 1400)          # x0, y0, x1, y1
VPW, VPH = VP[2] - VP[0], VP[3] - VP[1]

# ⚠️ ONE LAYOUT GRID FOR EVERY BEAT. Trym: the titles "are a bit clunky".
# They were, because each scene picked its own y. Headlines sit on HEAD_Y and
# captions on CAP_Y in every single beat, so the type never jumps between cuts
# and nothing is left floating in the middle of the frame.
HEAD_Y = 420                        # headline baseline (above the screen)
CAP_Y = 1530                        # caption chip centre (below the screen)


# ---------------------------------------------------------------- fonts
def load_fonts():
    from fontTools.ttLib import TTFont
    src = os.path.join(SITE, 'public', 'fonts')
    tmp = os.path.join(tempfile.gettempdir(), 'banana-ad-fonts')
    os.makedirs(tmp, exist_ok=True)
    out = {}
    for key, woff, wght in [('nunito', 'nunito-900-latin.woff2', 900),
                            ('archivo', 'archivoblack-400-latin.woff2', None)]:
        ttf = os.path.join(tmp, woff.replace('.woff2', '.ttf'))
        if not os.path.exists(ttf):
            f = TTFont(os.path.join(src, woff))
            f.flavor = None
            if wght and 'fvar' in f:
                from fontTools.varLib.instancer import instantiateVariableFont
                instantiateVariableFont(f, {'wght': wght}, inplace=True)
            f.save(ttf)
        out[key] = ttf
    return out


FONT_FILES = load_fonts()
_fc = {}


def font(kind, px):
    k = (kind, px)
    if k not in _fc:
        _fc[k] = ImageFont.truetype(FONT_FILES[kind], px)
    return _fc[k]


# ---------------------------------------------------------------- easing
def clamp01(t):
    return min(max(t, 0.0), 1.0)


def ease_out(t):
    return 1 - (1 - clamp01(t)) ** 3


def ease_out_back(t, s=1.70158):
    t = clamp01(t) - 1
    return t * t * ((s + 1) * t + s) + 1


def ease_in_out(t):
    t = clamp01(t)
    return 3 * t * t - 2 * t * t * t


# ---------------------------------------------------------------- assets
RENDERS = {}
PLATES = {}


def load_renders(d):
    for f in os.listdir(d):
        if f.endswith('.png') and '-' in f:
            name, idx = f[:-4].rsplit('-', 1)
            if idx.isdigit():
                RENDERS.setdefault(name, {})[int(idx)] = Image.open(os.path.join(d, f)).convert('RGBA')
    print('renders:', ', '.join(sorted(RENDERS)))


def plate(name):
    if name not in PLATES:
        PLATES[name] = Image.open(
            os.path.join(SITE, 'public', 'assets', name, name.split('/')[-1] + '.png')).convert('RGBA')
    return PLATES[name]


def banana(set_name, t, size, rot=0.0, fps=10.0):
    """the engine's own dance, sampled at the site's own cadence"""
    frames = RENDERS[set_name]
    im = frames.get(int(t * fps) % 8) or frames[0]
    im = im.resize((size, size), Image.NEAREST)
    if rot:
        im = im.rotate(rot, expand=True, resample=Image.NEAREST)
    return im


def paste_center(img, sprite, cx, cy):
    img.alpha_composite(sprite, (int(cx - sprite.width / 2), int(cy - sprite.height / 2)))


# ---------------------------------------------------------------- chrome
def pill(img, text, cy, px=62, pad=22, fg=INK, bg=YELLOW, max_w=880,
         cx=None, rot=0.0, kind='nunito', pop=1.0):
    """the site's caption chip: fat black border, hard shadow, slight tilt."""
    if pop <= 0.01:
        return
    cx = W / 2 if cx is None else cx
    d = ImageDraw.Draw(img)
    while px > 26 and d.textlength(text, font=font(kind, px)) > max_w:
        px -= 4
    f = font(kind, px)
    tw = d.textlength(text, font=f)
    hh = px + pad * 2
    lay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    dl = ImageDraw.Draw(lay)
    box = [cx - tw / 2 - pad * 1.4, cy - hh / 2, cx + tw / 2 + pad * 1.4, cy + hh / 2]
    dl.rectangle([box[0] + 9, box[1] + 11, box[2] + 9, box[3] + 11], fill=(0, 0, 0, 150))
    dl.rectangle(box, fill=bg, outline=INK, width=7)
    dl.text((cx, cy - px * 0.08), text, font=f, fill=fg, anchor='mm')
    if pop < 1.0 or rot:
        s = 0.6 + 0.4 * pop
        lay = lay.rotate(rot, resample=Image.BICUBIC, center=(cx, cy))
        if s < 0.999:
            small = lay.resize((int(W * s), int(H * s)), Image.BICUBIC)
            lay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
            lay.alpha_composite(small, (int(cx - cx * s), int(cy - cy * s)))
    img.alpha_composite(lay)


def center_text(img, text, cy, kind, px, fill, max_w=940, shadow=None):
    d = ImageDraw.Draw(img)
    while px > 22 and d.textlength(text, font=font(kind, px)) > max_w:
        px -= 4
    if shadow:
        d.text((W / 2 + 6, cy + 7), text, font=font(kind, px), fill=shadow, anchor='mm')
    d.text((W / 2, cy), text, font=font(kind, px), fill=fill, anchor='mm')


def confetti(img, n, seed, alpha=255, size=12):
    d = ImageDraw.Draw(img)
    rng = random.Random(seed)
    for i in range(n):
        c = CONF[i % len(CONF)]
        x = rng.randrange(0, W - size, size)
        y = rng.randrange(0, H - size, size)
        d.rectangle([x, y, x + size - 2, y + size - 2], fill=c + (alpha,))


def flash(img, amt):
    if amt > 0:
        img.alpha_composite(Image.new('RGBA', img.size, (255, 255, 255, int(255 * min(amt, 1)))))
    return img


# ---------------------------------------------------------------- the game screen
def screen(img, inner, t=0.0, tilt=0.0, label=None):
    """Frame `inner` (VPW x VPH) as a chunky game screen: hard black border,
    offset shadow, a soft inner vignette so the map doesn't fight the caption."""
    lay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    d.rectangle([VP[0] + 14, VP[1] + 18, VP[2] + 14, VP[3] + 18], fill=(0, 0, 0, 170))
    lay.alpha_composite(inner, (VP[0], VP[1]))
    d.rectangle([VP[0], VP[1], VP[2], VP[3]], outline=INK, width=9)
    if label:
        f = font('archivo', 38)
        tw = d.textlength(label, font=f)
        d.rectangle([VP[0] + 22, VP[1] + 22, VP[0] + 56 + tw, VP[1] + 92], fill=INK)
        d.text((VP[0] + 39, VP[1] + 57), label, font=f, fill=YELLOW, anchor='lm')
    if tilt:
        lay = lay.rotate(tilt, resample=Image.BICUBIC, center=(W / 2, (VP[1] + VP[3]) / 2))
    img.alpha_composite(lay)


class Shot:
    """A VPW x VPH window onto the real world plate, PLUS the world origin it
    was cropped from — which is the whole fix for the float.

    ⚠️⚠️ THE BUG THIS CLASS EXISTS TO KILL (Trym, 31 Jul): "when you simulate
    the bananas walking in the areas, other objects around float along with the
    banana." The old plate_shot returned bare pixels and the sprites were pasted
    at VIEWPORT coordinates. So when the crop panned, the palms and the wreck
    slid past a banana that never moved relative to the frame — the map floated
    and the character was pinned. Exactly backwards from every top-down game.

    Sprites are placed by WORLD coordinate now (at_world), so a banana standing
    beside a palm STAYS beside that palm no matter where the camera goes.
    """
    __slots__ = ('img', 'x0', 'y0', 'z')

    def __init__(self, img, x0, y0, z):
        self.img, self.x0, self.y0, self.z = img, x0, y0, z


def plate_shot(name, cx, cy, zoom=2.0):
    """crop centred on a WORLD point. NEAREST all the way — the whole point is
    that the pixels stay the size the game draws them."""
    p = plate(name)
    cw, ch = VPW / zoom, VPH / zoom
    x0 = min(max(cx - cw / 2, 0), p.width - cw)
    y0 = min(max(cy - ch / 2, 0), p.height - ch)
    crop = p.crop((int(x0), int(y0), int(x0 + cw), int(y0 + ch)))
    return Shot(crop.resize((VPW, VPH), Image.NEAREST).convert('RGBA'), int(x0), int(y0), zoom)


def in_screen(inner, sprite, vx, vy):
    """viewport-local placement, bottom-centre. Only for the DRAWN club floor,
    which has no map to anchor to — every plate scene uses at_world()."""
    inner.alpha_composite(sprite, (int(vx - sprite.width / 2), int(vy - sprite.height)))


def at_world(shot, sprite, wx, wy):
    """place a sprite at WORLD (wx, wy), bottom-centre anchored — the same
    contract the real game uses for every walker."""
    vx = (wx - shot.x0) * shot.z
    vy = (wy - shot.y0) * shot.z
    shot.img.alpha_composite(sprite, (int(vx - sprite.width / 2), int(vy - sprite.height)))


def walk(t, T, x0, x1, y):
    """⭐ THE CAMERA FOLLOWS THE WALKER, which is what makes it read as a game
    rather than a photo with a sticker on it. Returns the walker's world
    position; the caller centres the crop on it, so the banana holds its place
    in frame while the WORLD slides past — palms, nets and shells all moving
    together at the same rate, because they are all anchored to the same map."""
    return x0 + (x1 - x0) * ease_in_out(t / T), y


def hud_strip(inner, lvl='LVL 4', coins='120', extra=None):
    """the world HUD pill strip, so the screen reads as a game that counts.
    ⚠️ BOTTOM-LEFT, not top: the place-name tag and the LED banner both own
    the top of the viewport, and all three stacked there was a pile."""
    d = ImageDraw.Draw(inner)
    items = [('LVL', lvl.split()[-1]), ('COINS', coins)] + ([extra] if extra else [])
    x, y = 24, VPH - 92
    for k, v in items:
        f, fv = font('archivo', 26), font('nunito', 34)
        tw = d.textlength(k, font=f) + d.textlength(v, font=fv) + 46
        d.rectangle([x, y, x + tw, y + 66], fill=(20, 16, 30, 225), outline=INK, width=4)
        d.text((x + 16, y + 34), k, font=f, fill=(255, 255, 255, 150), anchor='lm')
        d.text((x + tw - 16, y + 33), v, font=fv, fill=YELLOW, anchor='rm')
        x += tw + 14


# ---------------------------------------------------------------- backdrops
def club_bg(t, seed=7):
    img = Image.new('RGBA', (W, H), CLUB + (255,))
    lay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    for ty in range(H // 90 + 1):
        for tx in range(W // 90 + 1):
            if (tx + ty) % 2:
                d.rectangle([tx * 90, ty * 90, tx * 90 + 90, ty * 90 + 90], fill=CLUB_CHECK + (46,))
    sway = math.sin(t * 2.0) * 90
    for bx in (250 + sway, 830 - sway):
        d.polygon([(bx - 30, 0), (bx + 30, 0), (bx + 150, H), (bx - 150, H)], fill=(255, 225, 53, 16))
    rng = random.Random(seed)
    for i in range(56):
        c = CONF[i % len(CONF)]
        x = rng.randrange(0, W - 12, 12)
        y = rng.randrange(0, H - 12, 12)
        d.rectangle([x, y, x + 10, y + 10], fill=c + (165,))
    img.alpha_composite(lay)
    return img


def club_inner(t, seed=11, ravers=True):
    """the rave, drawn in the viewport — the floor has no plate to crop."""
    inner = Image.new('RGBA', (VPW, VPH), CLUB + (255,))
    d = ImageDraw.Draw(inner)
    for ty in range(VPH // 70 + 1):
        for tx in range(VPW // 70 + 1):
            if (tx + ty) % 2:
                d.rectangle([tx * 70, ty * 70, tx * 70 + 70, ty * 70 + 70], fill=CLUB_CHECK + (52,))
    sway = math.sin(t * 2.2) * 70
    for bx in (240 + sway, 720 - sway):
        d.polygon([(bx - 40, 0), (bx + 40, 0), (bx + 210, VPH), (bx - 210, VPH)],
                  fill=(255, 225, 53, 24))
    if ravers:
        for i, (nm, vx, vy, sz, rot) in enumerate(
                [('raver1', 210, 470, 300, -7), ('raver3', 470, 400, 250, 5),
                 ('raver2', 740, 480, 310, 6), ('raver4', 360, 700, 330, -4),
                 ('bare', 700, 720, 300, 8)]):
            if nm in RENDERS:
                in_screen(inner, banana(nm, t + i * 0.21, sz, rot), vx, vy + 120)
    return inner


def jelly(img, t, seed, n=9, y0=0, y1=None):
    y1 = H if y1 is None else y1
    d = ImageDraw.Draw(img)
    rng = random.Random(seed)
    for i in range(n):
        x = rng.randrange(90, W - 130)
        fall = y0 + (t * 250 + i * 190) % (y1 - y0 + 180) - 90
        d.rectangle([x, fall, x + 34, fall + 34], fill=PINK + (235,))
        d.rectangle([x + 6, fall + 6, x + 15, fall + 15], fill=(255, 190, 225, 235))


def rain(inner, t, n, seed, speed=300.0):
    """the rave's jelly drops, CLIPPED TO THE GAME SCREEN — falling across the
    whole frame they read as an overlay on the ad, not weather in the game"""
    d = ImageDraw.Draw(inner)
    rng = random.Random(seed)
    for i in range(n):
        x = rng.randrange(60, VPW - 80)
        fall = (t * speed + i * 150) % (VPH + 160) - 80
        d.rectangle([x, fall, x + 30, fall + 30], fill=PINK + (240,))
        d.rectangle([x + 5, fall + 5, x + 13, fall + 13], fill=(255, 195, 228, 240))


def led(inner, t, lines, y=126):
    d = ImageDraw.Draw(inner)
    x0, x1, hh = 40, VPW - 40, 118
    d.rectangle([x0, y, x1, y + hh], fill=(20, 15, 32, 240), outline=PURPLE, width=5)
    for yy in range(y + 4, y + hh - 2, 6):
        d.line([(x0 + 4, yy), (x1 - 4, yy)], fill=(255, 255, 255, 12))
    msg = lines[int(t * 1.1) % len(lines)]
    col = CYAN if int(t * 1.1) % 2 == 0 else YELLOW
    f = font('archivo', 52)
    while d.textlength(msg, font=f) > (x1 - x0 - 40):
        f = font('archivo', f.size - 4)
    d.text((VPW / 2, y + hh / 2), msg, font=f, fill=col, anchor='mm')


# ================================================================ shared beats
def beat_hook(t, T, lines, sub=None, bg=YELLOW, set_name='bare'):
    """⚠️ THE FIRST SECOND IS THE WHOLE AD. It opens on the banana at full
    frame, because recognition is the hook — "what is this" is a question
    people ask AFTER they have already stopped scrolling.

    ⚠️⚠️ THE HEADLINE MUST BE A WHOLE SENTENCE (Trym, 31 Jul): the first cut
    read "MAKE A BANANA. TAKE IT TO" in 96px and then finished the thought in a
    54px chip 1000px further down — "so small that you cant quite pick it up".
    A hook that needs the reader to hunt for its own verb is not a hook. `lines`
    is now the COMPLETE sentence, every line set at the same weight, and `sub`
    may only ever carry a SEPARATE supporting fact.
    """
    img = Image.new('RGBA', (W, H), bg + (255,))
    confetti(img, 26, 3, alpha=64, size=14)
    pop = ease_out_back(t / 0.45)
    size = int(760 * max(pop, 0.01))
    if size > 4:
        paste_center(img, banana(set_name, t, size), W / 2, 1120)
    # one type size for the whole sentence, chosen so the LONGEST line fits —
    # mixed sizes inside one sentence is what made it read as two thoughts
    px = 108
    d = ImageDraw.Draw(img)
    while px > 56 and max(d.textlength(l, font=font('archivo', px)) for l in lines) > 940:
        px -= 4
    y = HEAD_Y - (len(lines) - 1) * (px * 0.62)
    for i, l in enumerate(lines):
        center_text(img, l, y + i * px * 1.24, 'archivo', px, INK)
    if sub and t > 0.8:
        pill(img, sub, CAP_Y, px=56, bg=(255, 255, 255), pop=ease_out((t - 0.8) / 0.3))
    return img


def beat_dress(t, T, steps):
    """the build, one item at a time — the ad's actual promise, and the beat
    that has to breathe. Each step gets its own second and its own chip."""
    img = Image.new('RGBA', (W, H), CREAM + (255,))
    confetti(img, 18, 5, alpha=48, size=14)
    center_text(img, 'DRESS YOUR BANANA', 400, 'archivo', 74, INK)
    per = T / len(steps)
    i = min(int(t / per), len(steps) - 1)
    nm, cap = steps[i]
    lt = (t - i * per) / per
    bump = 1.0 + 0.06 * (1 - ease_out(lt / 0.3)) if lt < 0.3 else 1.0
    paste_center(img, banana(nm, t, int(760 * bump)), W / 2, 1000)
    pill(img, cap, 1440, px=64, pop=ease_out(lt / 0.22), rot=-2)
    d = ImageDraw.Draw(img)
    for k in range(len(steps)):           # a progress rail, so it reads as a build
        x = W / 2 - (len(steps) - 1) * 40 + k * 80
        on = k <= i
        d.rectangle([x - 26, 1560, x + 26, 1594],
                    fill=YELLOW if on else (0, 0, 0, 0), outline=INK, width=5)
    return img


def beat_free(t, T, line='free · no app · no sign-up'):
    img = Image.new('RGBA', (W, H), YELLOW + (255,))
    confetti(img, 30, 9, alpha=70, size=14)
    paste_center(img, banana('bare', t, 620), W / 2, 1120)
    center_text(img, 'FREE', 480, 'archivo', 200, INK)
    pill(img, line, 700, px=50, bg=(255, 255, 255), pop=ease_out(t / 0.3))
    return img


def beat_end(t, T, cta='make your banana'):
    """⚠️ The CTA sits ABOVE Instagram's own button band and points DOWN at it —
    best practice is to hand off to the platform's button, not draw a fake one."""
    img = Image.new('RGBA', (W, H), INK + (255,))
    confetti(img, 34, 13, alpha=115, size=14)
    pop = ease_out_back(min(t / 0.5, 1))
    paste_center(img, banana('dress4' if 'dress4' in RENDERS else 'bare', t, int(560 * pop)), W / 2, 900)
    center_text(img, 'trymstene.com', 1230, 'archivo', 92, YELLOW)
    pill(img, cta, 1360, px=58, bg=YELLOW, pop=ease_out((t - 0.25) / 0.3))
    if t > 0.75:
        bob = math.sin(t * 6) * 12
        d = ImageDraw.Draw(img)
        d.text((W / 2, 1470 + bob), 'tap below', font=font('nunito', 46), fill=CREAM, anchor='mm')
        d.polygon([(W / 2 - 26, 1516 + bob), (W / 2 + 26, 1516 + bob), (W / 2, 1572 + bob)], fill=YELLOW)
    return img


def area_beat(t, T, shot, caption, label=None, bg=None):
    """one world beat, on the shared grid: PLACE NAME on HEAD_Y, the game
    screen, one chip on CAP_Y.

    ⚠️ THE PLACE NAME IS A HEADLINE, not a tag inside the screen. It used to
    be a 38px chip in the viewport's corner, which left the whole top band of
    the frame empty and made every area beat feel bottom-heavy — Trym's "the
    headlines and sub-headlines… are a bit clunky". Promoting it fills the
    grid, and it is finally big enough to read on a phone.”
    ⚠️ Still ONE caption. Two captions at arm's length is zero captions."""
    img = Image.new('RGBA', (W, H), (bg or INK) + (255,))
    confetti(img, 16, 21, alpha=40, size=14)
    if label:
        center_text(img, label, HEAD_Y, 'archivo', 92, YELLOW)
    screen(img, shot.img if isinstance(shot, Shot) else shot, t)
    pill(img, caption, CAP_Y, px=60, pop=ease_out(t / 0.28), rot=-1.5)
    return img


def stage(name, cx, cy, zoom=2.8):
    """⭐ THE CAMERA HOLDS STILL AND THE BANANA WALKS ACROSS IT.

    ⚠⚠ This is the fix for Trym's "other objects around float along with the
    banana". A panning crop with sprites pasted at VIEWPORT coordinates makes
    the palms and the wreck slide past a character who never moves — the world
    floats and the actor is pinned, which is backwards from every top-down game
    and is exactly what it looked like.

    A locked camera makes it unambiguous: the map is rock solid, and the only
    thing moving is the banana. Every other sprite is placed by WORLD
    coordinate (at_world), so it stays welded to the ground it stands on.

    ⚠️ ZOOM 2.8, NOT THE GAME'S OWN 2.0. At true game scale the banana is
    ~12% of the view — correct, and unreadable on a phone at arm's length. The
    camera pushes in instead of the sprite growing, so the banana stays IN SCALE
    with the palms and the net while filling far more of the frame. Sprite sizes
    below are derived from it: a 56px world banana × 2.8 ≈ 157px on screen, and
    the engine render is ~60% banana inside its square, so size ≈ 260."""
    return plate_shot(name, cx, cy, zoom)


# ================================================================ REEL 1 - THE WORLD
def world_hook(t, T):
    return beat_hook(t, T, ['THIS BANANA HAS BEEN', 'DANCING SINCE 1999'],
                     'and now it has somewhere to go')


def world_turn(t, T):
    img = Image.new('RGBA', (W, H), INK + (255,))
    confetti(img, 24, 4, alpha=90, size=14)
    center_text(img, 'NOW IT IS A PLACE', HEAD_Y, 'archivo', 104, YELLOW)
    x, y = walk(t, T, 2190, 2300, 700)
    sh = stage('beach', 2250, 650)
    at_world(sh, banana('beach2', t, 260), x, y)
    hud_strip(sh.img, coins='140', extra=('TIX', '12'))
    screen(img, sh.img, t)
    return img


DRESS_STEPS = [('dress1', 'give it a hat'), ('dress2', 'and shades'),
               ('dress3', 'and a rubber chicken'), ('dress4', 'and gold kicks')]


def world_dress(t, T):
    return beat_dress(t, T, DRESS_STEPS)


def world_rave(t, T):
    inner = club_inner(t)
    led(inner, t, ['LIVE RIGHT NOW', 'EVERYONE HERE IS REAL', 'DROP INCOMING'])
    hud_strip(inner, coins='120', extra=('CROWD', '9'))
    rain(inner, t, 5, 31)
    return area_beat(t, T, inner, 'dance with strangers', label='THE RAVE')


def world_park(t, T):
    x, y = walk(t, T, 640, 750, 810)
    sh = stage('park', 700, 755)
    at_world(sh, banana('park1', t, 260), x, y)
    at_world(sh, banana('park2', t + 0.5, 245), 800, 700)   # absolute: stays put
    hud_strip(sh.img, coins='86', extra=('PLOTS', '12'))
    return area_beat(t, T, sh, 'grow your own garden', label='THE PARK', bg=(24, 44, 22))


def world_beach(t, T):
    x, y = walk(t, T, 840, 950, 830)
    sh = stage('beach', 930, 780)
    at_world(sh, banana('beach1', t, 260), x, y)
    at_world(sh, banana('bare', t + 0.4, 245), 1010, 690)    # absolute: stays put
    hud_strip(sh.img, coins='140', extra=('SHELLS', '7'))
    return area_beat(t, T, sh, 'play on the beach', label='BANANA BAY', bg=(28, 48, 60))


def world_free(t, T):
    return beat_free(t, T, 'free · no app · plays in your browser')


def world_end(t, T):
    return beat_end(t, T, 'make your banana')


REEL_WORLD = [(3.0, world_hook), (2.8, world_turn), (4.4, world_dress),
              (2.8, world_rave), (2.8, world_park), (2.8, world_beach),
              (1.8, world_free), (3.0, world_end)]


# ================================================================ REEL 2 - THE BEACH
def beach_hook(t, T):
    return beat_hook(t, T, ['MAKE A BANANA', 'AND TAKE IT', 'TO THE BEACH'],
                     'free · plays in your browser', set_name='beach1')


BEACH_STEPS = [('dress1', 'pick a hat'), ('beach2', 'grab a flamingo ring'),
               ('beach1', 'or a snorkel')]


def beach_dress(t, T):
    return beat_dress(t, T, BEACH_STEPS)


def beach_arrive(t, T):
    x, y = walk(t, T, 1580, 1760, 810)
    sh = stage('beach', 1690, 730, zoom=2.2)
    at_world(sh, banana('beach1', t, 210), x, y)
    hud_strip(sh.img, coins='0', extra=('SHELLS', '0'))
    return area_beat(t, T, sh, 'a whole bay to walk around',
                     label='BANANA BAY', bg=(28, 48, 60))


def beach_volley(t, T):
    x, y = walk(t, T, 850, 940, 880)
    sh = stage('beach', 950, 800)
    at_world(sh, banana('beach2', t, 260), x, y)
    at_world(sh, banana('bare', t + 0.4, 245), 1030, 700)    # absolute: stays put
    # the ball arcs between them in WORLD space, so it flies over the real net
    bx = 900 + (t / T) * 110
    by = 760 - math.sin(clamp01(t / T) * math.pi) * 110
    d = ImageDraw.Draw(sh.img)
    vx, vy = (bx - sh.x0) * sh.z, (by - sh.y0) * sh.z
    d.ellipse([vx - 24, vy - 24, vx + 24, vy + 24], fill=(255, 255, 255), outline=INK, width=5)
    hud_strip(sh.img, coins='30', extra=('RALLY', str(2 + int(t * 3))))
    return area_beat(t, T, sh, 'volleyball with real people',
                     label='THE COURT', bg=(28, 48, 60))


def beach_shells(t, T):
    x, y = walk(t, T, 660, 770, 440)
    sh = stage('beach', 730, 410)
    d = ImageDraw.Draw(sh.img)
    for i, (sx, sy) in enumerate(((650, 366), (780, 392), (840, 350))):
        tw = math.sin(t * 4 + i) * 0.5 + 0.5
        vx, vy = (sx - sh.x0) * sh.z, (sy - sh.y0) * sh.z
        d.ellipse([vx - 16, vy - 12, vx + 16, vy + 12],
                  fill=(255, 240, 220), outline=(190, 120, 90), width=4)
        d.ellipse([vx - 6, vy - 5, vx + 4, vy + 4], fill=(255, 255, 255, int(120 + 120 * tw)))
    at_world(sh, banana('beach1', t, 260), x, y)
    hud_strip(sh.img, coins='30', extra=('SHELLS', str(7 + int(t * 2))))
    return area_beat(t, T, sh, 'comb the tide for shells',
                     label='29 TO COLLECT', bg=(28, 48, 60))


def beach_dig(t, T):
    x, y = walk(t, T, 1470, 1540, 960)
    sh = stage('beach', 1545, 915)
    patch = Image.open(os.path.join(SITE, 'public', 'assets', 'beach', 'dig-patch.png')).convert('RGBA')
    patch = patch.resize((int(patch.width * sh.z), int(patch.height * sh.z)), Image.NEAREST)
    pvx, pvy = (1600 - sh.x0) * sh.z, (975 - sh.y0) * sh.z
    sh.img.alpha_composite(patch, (int(pvx - patch.width / 2), int(pvy - patch.height / 2)))
    at_world(sh, banana('beach3', t, 260), x, y)
    return area_beat(t, T, sh, 'dig up buried treasure',
                     label='X MARKS THE SPOT', bg=(28, 48, 60))


def beach_pier(t, T):
    x, y = walk(t, T, 2200, 2310, 730)
    sh = stage('beach', 2260, 690)
    at_world(sh, banana('beach3', t, 260), x, y)
    hud_strip(sh.img, coins='140', extra=('TIX', '150'))
    return area_beat(t, T, sh, 'win the giant plush at the pier',
                     label='THE MIDWAY', bg=(28, 48, 60))


def beach_free(t, T):
    return beat_free(t, T, 'free · no app · plays in your browser')


def beach_end(t, T):
    return beat_end(t, T, 'make yours · hit the beach')


REEL_BEACH = [(3.0, beach_hook), (3.6, beach_dress), (2.8, beach_arrive),
              (2.8, beach_volley), (2.8, beach_shells), (2.6, beach_dig),
              (2.8, beach_pier), (1.8, beach_free), (3.0, beach_end)]


# ================================================================ REEL 3 - THE RAVE
def rave_hook(t, T):
    return beat_hook(t, T, ['MAKE A BANANA', 'AND TAKE IT', 'TO THE RAVE'],
                     'free · plays in your browser', set_name='raver1')


def rave_dress(t, T):
    return beat_dress(t, T, DRESS_STEPS)


def rave_floor(t, T):
    inner = club_inner(t)
    led(inner, t, ['LIVE RIGHT NOW', 'EVERYONE HERE IS REAL'])
    hud_strip(inner, coins='0', extra=('CROWD', '11'))
    return area_beat(t, T, inner, 'everyone on this floor is real', label='THE RAVE')


def rave_drop(t, T):
    inner = club_inner(t, ravers=True)
    led(inner, t, ['DROP INCOMING', 'CATCH IT', 'DROP INCOMING'])
    rain(inner, t, 8, 5)
    return area_beat(t, T, inner, 'catch the drops, keep the gear', label='DROP NIGHT')


def rave_wear(t, T):
    img = club_bg(t)
    center_text(img, 'WEAR WHAT YOU CATCH', HEAD_Y, 'archivo', 84, YELLOW)
    per = T / 3
    i = min(int(t / per), 2)
    nm = ['raver2', 'raver3', 'raver4'][i]
    lt = (t - i * per) / per
    bump = 1 + 0.05 * (1 - ease_out(lt / 0.3))
    paste_center(img, banana(nm if nm in RENDERS else 'bare', t, int(880 * bump)), W / 2, 1000)
    # DO NOT name the item here. The sets rotate and the copy would end up
    # describing a hat the banana on screen is not wearing.
    pill(img, ['catch it once, keep it forever', 'nobody else has your banana',
               'it follows you everywhere'][i],
         CAP_Y, px=58, pop=ease_out(lt / 0.22), rot=2)
    return img


def rave_free(t, T):
    return beat_free(t, T, 'free · no app · no sign-up')


def rave_end(t, T):
    return beat_end(t, T, 'make yours · join the rave')


REEL_RAVE = [(3.0, rave_hook), (4.4, rave_dress), (2.8, rave_floor),
             (2.8, rave_drop), (2.8, rave_wear), (1.8, rave_free), (3.0, rave_end)]


REELS = {
    'world': (REEL_WORLD, None),
    'beach': (REEL_BEACH, None),
    'rave': (REEL_RAVE, os.path.join(SITE, 'public', 'assets', 'audio', 'rave-loop.mp3')),
}


# ---------------------------------------------------------------- build
def build(name, renders_dir, out_path, music=None):
    scenes, default_music = REELS[name]
    music = music if music is not None else default_music
    total = sum(d for d, _ in scenes)
    n = int(total * FPS)
    print(f'{name}: {total:.1f}s -> {n} frames @ {FPS}fps')
    import imageio_ffmpeg
    silent = out_path if not music else out_path.replace('.mp4', '.silent.mp4')
    writer = imageio_ffmpeg.write_frames(
        silent, (W, H), fps=FPS, codec='libx264', pix_fmt_out='yuv420p',
        macro_block_size=1, output_params=['-crf', '20', '-movflags', '+faststart'])
    writer.send(None)
    for fi in range(n):
        t = fi / FPS
        acc, img = 0.0, None
        for dur, fn in scenes:
            if t < acc + dur:
                img = fn(t - acc, dur)
                break
            acc += dur
        if img is None:
            img = Image.new('RGBA', (W, H), INK + (255,))
        # ⚠️ a SOFTER cut than Ad C's: 0.09s of white at 0.45, not 0.06 at 0.55.
        # On a phone the hard blink read as a strobe once the beats got longer.
        if acc > 0 and 0 < t - acc < 0.09:
            img = flash(img, 0.45 * (1 - (t - acc) / 0.09))
        writer.send(np.array(img.convert('RGB')))
        if fi % 96 == 0:
            print(f'  {fi}/{n}')
    writer.close()

    if music:
        ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
        fade = max(0.0, total - 0.7)
        subprocess.run([ffmpeg, '-y', '-i', silent, '-i', music, '-filter_complex',
                        f'[1:a]atrim=0:{total},afade=t=out:st={fade:.2f}:d=0.7[a]',
                        '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac',
                        '-b:a', '160k', '-shortest', out_path], check=True)
        os.remove(silent)
    print('DONE', out_path, f'{os.path.getsize(out_path) / 1e6:.1f} MB')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--reel', default='all', choices=['all', 'world', 'beach', 'rave'])
    ap.add_argument('--renders', default=os.path.join(SITE, 'ad-pack', 'renders-reels'))
    ap.add_argument('--music', default=None)
    ap.add_argument('--outdir', default=os.path.join(SITE, 'ad-pack'))
    a = ap.parse_args()
    load_renders(a.renders)
    for r in (['world', 'beach', 'rave'] if a.reel == 'all' else [a.reel]):
        build(r, a.renders, os.path.join(a.outdir, f'reel-{r}-1080x1920.mp4'), a.music)
