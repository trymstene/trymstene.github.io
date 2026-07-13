"""Ad C — the full-site sizzle reel (1080x1080 MP4 for Meta ads).

A ~23s fast-cut tour of everything fun on trymstene.com, in the visual
language of ad-B (cream stage, chunky pixel banana, yellow caption pill with
fat black border) plus the rave share-card's club look (near-black, spotlight
beams, confetti pixels, tilted bananas).

Scenes: hook -> builder dress-up -> rave -> tee + sticker -> community wall
        -> pixel forge -> GIF-for-every-platform -> end card.

INPUTS
- Banana frames come from the REAL site engine (drawComposite), rendered in a
  browser against the astro dev server and saved as 512px transparent PNGs
  named <set>-<frame>.png (sets: bare/hat/hatdwi/kicks/full/raver1..4/disco1..2,
  frames 0..7). Regenerate with the snippet at the bottom of this docstring.
- Fonts: converted at runtime from the site's own woff2 (needs fonttools+brotli).
- Remix GIFs + tee photo straight from public/assets/.

RUN
  python tools/build-ad-sizzle.py --renders <dir-with-set-frame-pngs> \
         [--out ad-pack/ad-C-site-sizzle-1080.mp4]

Browser render snippet (dev server running, any page):
  const eng = await import('/src/lib/banana-engine.js'); await eng.assetsReady;
  // for each set: draw eng.drawComposite(ctx, 512, i, {bg:'transparent',
  // captions:false, top:'', bottom:'', ...outfit}) for i in 0..7, then POST
  // the toDataURL PNGs to a local receiver that writes <set>-<i>.png.
"""
import argparse
import math
import os
import random
import sys
import tempfile

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S = 1080
FPS = 24

# palette — the ad-B + rave share-card language
CREAM = (250, 247, 234)
YELLOW = (255, 225, 53)
INK = (17, 17, 17)
PINK = (255, 77, 157)
CLUB = (13, 11, 20)
CLUB_CHECK = (179, 136, 255)
CONF = [(255, 225, 53), (255, 77, 157), (120, 235, 255), (88, 192, 92)]
DISCORD = (49, 51, 56)

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
            # the site woff2s are VARIABLE fonts — PIL renders the default
            # (regular) weight unless we pin the axis to the heavy end
            if wght and 'fvar' in f:
                from fontTools.varLib.instancer import instantiateVariableFont
                instantiateVariableFont(f, {'wght': wght}, inplace=True)
            f.save(ttf)
        out[key] = ttf
    return out

FONT_FILES = load_fonts()
_font_cache = {}
def font(kind, px):
    k = (kind, px)
    if k not in _font_cache:
        _font_cache[k] = ImageFont.truetype(FONT_FILES[kind], px)
    return _font_cache[k]

# ---------------------------------------------------------------- easing
def ease_out_back(t, s=1.70158):
    t = min(max(t, 0.0), 1.0) - 1
    return t * t * ((s + 1) * t + s) + 1

def ease_out(t):
    t = min(max(t, 0.0), 1.0)
    return 1 - (1 - t) ** 3

def clamp01(t):
    return min(max(t, 0.0), 1.0)

# ---------------------------------------------------------------- assets
RENDERS = {}
def load_renders(d):
    for f in os.listdir(d):
        if f.endswith('.png') and '-' in f:
            name, idx = f[:-4].rsplit('-', 1)
            RENDERS.setdefault(name, {})[int(idx)] = Image.open(os.path.join(d, f)).convert('RGBA')

def banana(set_name, t, size, rot=0.0):
    """One dance frame, engine-authentic 10fps step, nearest-neighbour scale."""
    idx = int(t * 10) % 8
    im = RENDERS[set_name][idx].resize((size, size), Image.NEAREST)
    if rot:
        im = im.rotate(rot, expand=True, resample=Image.NEAREST)
    return im

REMIX_PICKS = [
    'aliendance-pbj', 'bananadance-angel', 'bananadance-devil', 'bananadance-clown',
    'bananadance-cop', 'bananadance-christmas', 'bananadance-fire', 'bananadance-cape',
    'bananadance-cheerleader', 'bananadance-cow', 'bananadance-dragon', 'babymariodance-pbj',
    'appledance-red-pbj', 'bananadance-bling', 'bananadance-fro', 'bananadance-cyclops',
]
def load_remixes():
    d = os.path.join(SITE, 'public', 'assets', 'dancing-banana-community-remixes')
    out = []
    for slug in REMIX_PICKS:
        p = os.path.join(d, slug + '.gif')
        if not os.path.exists(p):
            continue
        g = Image.open(p)
        frames = []
        for fi in (0, max(1, g.n_frames // 2)):
            g.seek(fi)
            frames.append(g.convert('RGBA'))
        out.append(frames)
    return out

def load_tee():
    p = os.path.join(SITE, 'public', 'assets', 'tee', 'tee-woman-royal.jpg')
    im = Image.open(p).convert('RGBA')
    side = min(im.size)
    im = im.crop(((im.width - side) // 2, 0, (im.width + side) // 2, side))
    return im.resize((900, 900), Image.LANCZOS)

# ---------------------------------------------------------------- drawing
def pill(draw_img, text, cy, px=64, pad=26, fg=INK, bg=YELLOW, max_w=880):
    """The ad-B caption pill: yellow, fat black border, centered. Shrinks the
    font before it ever crosses the safe margins (Trym: keep text inside)."""
    d = ImageDraw.Draw(draw_img)
    while px > 30:
        f = font('nunito', px)
        w = d.textlength(text, font=f)
        if w <= max_w:
            break
        px -= 4
    f = font('nunito', px)
    w = d.textlength(text, font=f)
    h = px + pad * 2
    x0 = (S - w) / 2 - pad * 1.4
    x1 = (S + w) / 2 + pad * 1.4
    d.rectangle([x0, cy - h / 2, x1, cy + h / 2], fill=bg, outline=INK, width=6)
    d.text((S / 2, cy - px * 0.06), text, font=f, fill=fg, anchor='mm')

def center_text(img, text, cy, kind, px, fill, max_w=900):
    d = ImageDraw.Draw(img)
    while px > 24 and d.textlength(text, font=font(kind, px)) > max_w:
        px -= 4
    d.text((S / 2, cy), text, font=font(kind, px), fill=fill, anchor='mm')

def paste_center(img, sprite, cx, cy):
    img.alpha_composite(sprite, (int(cx - sprite.width / 2), int(cy - sprite.height / 2)))

def confetti(img, n, seed, alpha=255, area=(0, 0, S, S)):
    d = ImageDraw.Draw(img)
    rng = random.Random(seed)
    x0, y0, x1, y1 = area
    for i in range(n):
        c = CONF[i % len(CONF)]
        x = rng.randrange(x0, x1 - 12, 12)
        y = rng.randrange(y0, y1 - 12, 12)
        d.rectangle([x, y, x + 10, y + 10], fill=c + (alpha,))

def flash(img, amt):
    if amt <= 0:
        return img
    white = Image.new('RGBA', img.size, (255, 255, 255, int(255 * min(amt, 1))))
    img.alpha_composite(white)
    return img

def club_bg(t, seed=7):
    """The rave share-card look: near-black, checker-whisper floor, two beams.
    Translucent layers go through alpha_composite — ImageDraw alone REPLACES
    pixels (alpha included) instead of blending, which turned the whisper
    into a full-blast purple floor in draft 1."""
    img = Image.new('RGBA', (S, S), CLUB + (255,))
    lay = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    for ty in range(6, 12):
        for tx in range(12):
            if (tx + ty) % 2:
                d.rectangle([tx * 90, ty * 90, tx * 90 + 90, ty * 90 + 90],
                            fill=CLUB_CHECK + (85,))
    sway = math.sin(t * 2.2) * 90
    for bx, tilt in [(220 + sway, 0.5), (760 - sway, -0.35)]:
        d.polygon([(bx - 40, 0), (bx + 40, 0),
                   (bx + tilt * S + 190, S), (bx + tilt * S - 190, S)],
                  fill=(255, 225, 53, 60))
    rng = random.Random(seed)
    for i in range(46):
        c = CONF[i % len(CONF)]
        x = rng.randrange(0, S - 12, 12)
        y = rng.randrange(0, S - 12, 12)
        d.rectangle([x, y, x + 10, y + 10], fill=c + (185,))
    img.alpha_composite(lay)
    return img

def die_cut(sprite, border=14):
    """White die-cut outline via alpha dilation — the sticker look."""
    a = np.array(sprite.split()[3])
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (border * 2 + 1, border * 2 + 1))
    fat = cv2.dilate(a, k)
    out = Image.new('RGBA', sprite.size, (0, 0, 0, 0))
    white = Image.new('RGBA', sprite.size, (255, 255, 255, 255))
    out.paste(white, (0, 0), Image.fromarray(fat))
    out.alpha_composite(sprite)
    return out

# ---------------------------------------------------------------- scenes
def sc_hook(t, T):
    img = Image.new('RGBA', (S, S), YELLOW + (255,))
    confetti(img, 26, 3, alpha=70)
    pop = ease_out_back(t / 0.5)
    size = int(620 * max(pop, 0.01))
    if size > 2:
        paste_center(img, banana('bare', t, size), S / 2, 470)
    if t > 0.55:
        pill(img, 'You know this banana.', 880, px=68)
    if t > 1.35:
        chip = Image.new('RGBA', (S, S), (0, 0, 0, 0))
        pill(chip, "He's got NEW MOVES", 130, px=58, bg=(255, 255, 255), fg=INK)
        img.alpha_composite(chip.rotate(-3, resample=Image.BICUBIC, center=(S / 2, 130)))
        confetti(img, 40, 11)
    return flash(img, (0.35 - t) * 1.2 if t < 0.35 else 0)

BUILD_STEPS = [(0.0, 'bare', None), (0.5, 'hat', 'HAT!'), (1.1, 'hatdwi', 'SHADES!'),
               (1.7, 'kicks', 'KICKS!'), (2.3, 'full', 'BOOMBOX!')]
def sc_builder(t, T):
    img = Image.new('RGBA', (S, S), CREAM + (255,))
    set_name, label, since = 'bare', None, 99.0
    for start, name, lab in BUILD_STEPS:
        if t >= start:
            set_name, label, since = name, lab, t - start
    b = banana(set_name, t, 600)
    if since < 0.22 and label:  # pop bounce on each new item
        s = 1 + 0.10 * math.sin(clamp01(since / 0.22) * math.pi)
        b = b.resize((int(600 * s), int(600 * s)), Image.NEAREST)
    paste_center(img, b, S / 2, 470)
    if label and since < 0.55:
        chip = Image.new('RGBA', (S, S), (0, 0, 0, 0))
        pill(chip, label, 210, px=54, bg=(255, 255, 255), max_w=500)
        img.alpha_composite(chip.rotate(6, resample=Image.BICUBIC, center=(S / 2, 210)))
    pill(img, 'Dress your own dancing banana', 900, px=60)
    center_text(img, 'free · no signup', 985, 'nunito', 40, PINK)
    return img

RAVERS = [('raver1', 250, 620, 420, -8), ('disco2', 540, 560, 340, 0),
          ('raver3', 830, 620, 420, 8), ('disco1', 60, 560, 300, -4)]
def sc_rave(t, T):
    img = club_bg(t, seed=int(t * 4) % 5 + 5)
    for i, (name, cx, cy, size, rot) in enumerate(RAVERS):
        bob = math.sin((t + i * 0.35) * 5.2) * 14
        k = ease_out_back(clamp01((t - i * 0.12) / 0.4))
        paste_center(img, banana(name, t + i * 0.2, int(size * max(k, 0.01)), rot), cx, cy + bob)
    center_text(img, 'JOIN THE BANANA RAVE', 150, 'archivo', 74, YELLOW)
    center_text(img, 'a live dance floor — dance with friends', 235, 'nunito', 44, (255, 253, 245))
    stro = math.sin(t * 8.5)
    return flash(img, 0.10 if stro > 0.92 else 0)

def sc_merch(t, T, tee_img):
    img = Image.new('RGBA', (S, S), CREAM + (255,))
    if t < T / 2:  # beat A: the tee
        k = ease_out(t / 0.45)
        tee = tee_img.copy()
        chest = banana('full', 0.25, 230)  # frozen pose, like the print
        tee.alpha_composite(chest, (int(900 * 0.500 - 115), int(900 * 0.335)))
        paste_center(img, tee, S / 2 + (1 - k) * 900, 430)
        pill(img, 'Get YOURS on a t-shirt…', 950, px=60)
    else:  # beat B: the sticker
        tb = t - T / 2
        k = ease_out_back(tb / 0.45)
        stick = die_cut(banana('full', 0.25, 560), border=16)
        rot = -8 + math.sin(tb * 2.5) * 2
        stick = stick.rotate(rot, expand=True, resample=Image.BICUBIC)
        sh = Image.new('RGBA', (S, S), (0, 0, 0, 0))
        shd = stick.split()[3].point(lambda v: int(v * 0.25))
        sh.paste((17, 17, 17, 60), (int(S / 2 - stick.width / 2) + 14, int(430 - stick.height / 2) + 18), shd)
        img.alpha_composite(sh)
        paste_center(img, stick.resize((int(stick.width * min(k, 1)), int(stick.height * min(k, 1))) if k < 1 else stick.size, Image.BICUBIC) if k > 0.01 else stick, S / 2, 430)
        pill(img, '…or a die-cut sticker', 900, px=60)
        center_text(img, 'ships free worldwide', 985, 'nunito', 40, PINK)
    return img

def sc_wall(t, T, remixes):
    img = Image.new('RGBA', (S, S), CREAM + (255,))
    cell, gap = 172, 20
    grid_w = 4 * cell + 3 * gap
    x0 = (S - grid_w) // 2
    y0 = 300
    for i, frames in enumerate(remixes[:16]):
        r, c = divmod(i, 4)
        k = ease_out_back(clamp01((t - i * 0.06) / 0.3))
        if k <= 0.01:
            continue
        fr = frames[int(t * 3 + i) % len(frames)]
        card = Image.new('RGBA', (cell, cell), (255, 255, 255, 255))
        side = int(cell * 0.78)
        gif = fr.resize((side, side), Image.NEAREST)
        card.alpha_composite(gif, ((cell - side) // 2, (cell - side) // 2))
        ImageDraw.Draw(card).rectangle([0, 0, cell - 1, cell - 1], outline=INK, width=5)
        sz = int(cell * k) if k < 1 else cell
        if sz > 1:
            card = card.resize((sz, sz), Image.BICUBIC)
        paste_center(img, card, x0 + c * (cell + gap) + cell / 2, y0 + r * (cell + gap) + cell / 2)
    pill(img, '266 bananas made by the internet', 160, px=56)
    center_text(img, 'remixed since 1999 — all in the gallery', 240, 'nunito', 40, INK)
    return img

def sc_forge(t, T):
    img = Image.new('RGBA', (S, S), (28, 26, 36, 255))
    d = ImageDraw.Draw(img)
    small = RENDERS['bare'][2].resize((26, 26), Image.NEAREST)
    px_size = 26
    ox, oy = (S - 26 * px_size) // 2, 240
    for gx in range(0, 27):  # the forge grid
        d.line([(ox + gx * px_size, oy), (ox + gx * px_size, oy + 26 * px_size)], fill=(255, 255, 255, 14))
        d.line([(ox, oy + gx * px_size), (ox + 26 * px_size, oy + gx * px_size)], fill=(255, 255, 255, 14))
    arr = np.array(small)
    filled = [(x, y) for y in range(26) for x in range(26) if arr[y, x, 3] > 60]
    random.Random(4).shuffle(filled)  # pixels rain in, not a top-down scan
    n = int(len(filled) * clamp01(t / (T * 0.75)))
    for x, y in filled[:n]:
        r, g, b, a = arr[y, x]
        d.rectangle([ox + x * px_size, oy + y * px_size, ox + (x + 1) * px_size - 1, oy + (y + 1) * px_size - 1],
                    fill=(int(r), int(g), int(b), 255))
    if n < len(filled):  # the painting cursor
        cx, cy = filled[min(n, len(filled) - 1)]
        d.rectangle([ox + cx * px_size - 3, oy + cy * px_size - 3,
                     ox + (cx + 1) * px_size + 2, oy + (cy + 1) * px_size + 2], outline=YELLOW, width=4)
    pill(img, 'Draw your own pixel GIFs', 140, px=58)
    center_text(img, 'in the Pixel Forge — free, in your browser', 985, 'nunito', 40, (255, 253, 245))
    return img

PLATFORMS = 'Discord · Slack · WhatsApp · Teams · Twitch'
def sc_platforms(t, T):
    img = Image.new('RGBA', (S, S), DISCORD + (255,))
    d = ImageDraw.Draw(img)
    rows = [('banana enjoyer', 'today at 9:41', 260), ('jelly time fan', 'today at 9:42', 520)]
    for i, (name, ts, y) in enumerate(rows):
        k = ease_out(clamp01((t - i * 0.35) / 0.4))
        if k <= 0.01:
            continue
        x = 120 + (1 - k) * 500
        d.ellipse([x, y, x + 84, y + 84], fill=YELLOW)
        av = banana('bare', 0.2, 72)
        img.alpha_composite(av, (int(x) + 6, y + 4))
        d.text((x + 110, y + 6), name, font=font('nunito', 40), fill=(242, 201, 76))
        d.text((x + 110 + d.textlength(name, font=font('nunito', 40)) + 18, y + 16), ts,
               font=font('nunito', 26), fill=(148, 155, 164))
        reps = 3 if i == 1 else 1  # second row spams the emoji, chat-style
        for r in range(reps):
            gif = banana('bare', t + r * 0.15, 150)
            img.alpha_composite(gif, (int(x) + 104 + r * 130, y + 52))
    pill(img, 'The original GIF — free for every platform', 880, px=52)
    center_text(img, PLATFORMS, 970, 'nunito', 36, (148, 155, 164))
    return img

def sc_end(t, T):
    img = Image.new('RGBA', (S, S), YELLOW + (255,))
    confetti(img, 30, 21, alpha=80)
    center_text(img, 'One banana.', 140, 'archivo', 88, INK)
    center_text(img, 'Endless party.', 245, 'archivo', 88, INK)
    k = ease_out_back(clamp01(t / 0.4))
    paste_center(img, banana('full', t, int(520 * max(k, 0.01))), S / 2, 560)
    center_text(img, 'trymstene.com', 905, 'archivo', 72, INK)
    center_text(img, 'free · no signup', 990, 'nunito', 44, PINK)
    return img

# ---------------------------------------------------------------- timeline
def build(renders_dir, out_path):
    load_renders(renders_dir)
    remixes = load_remixes()
    tee_img = load_tee()
    scenes = [
        (2.3, sc_hook),
        (3.2, sc_builder),
        (3.2, sc_rave),
        (3.4, lambda t, T: sc_merch(t, T, tee_img)),
        (3.0, lambda t, T: sc_wall(t, T, remixes)),
        (2.6, sc_forge),
        (2.4, sc_platforms),
        (3.4, sc_end),
    ]
    total = sum(d for d, _ in scenes)
    n_frames = int(total * FPS)
    print(f'{total:.1f}s -> {n_frames} frames @ {FPS}fps')
    # H.264 via imageio-ffmpeg's bundled binary — OpenCV's openh264 is
    # version-mismatched on this machine and silently falls back to mp4v
    import imageio_ffmpeg
    writer = imageio_ffmpeg.write_frames(
        out_path, (S, S), fps=FPS, codec='libx264', pix_fmt_out='yuv420p',
        macro_block_size=1,  # keep EXACTLY 1080 — default pads to 1088
        output_params=['-crf', '21', '-movflags', '+faststart'])
    writer.send(None)
    for fi in range(n_frames):
        t = fi / FPS
        acc = 0.0
        for dur, fn in scenes:
            if t < acc + dur:
                img = fn(t - acc, dur)
                break
            acc += dur
        # hard-cut white blink on every scene boundary (fast-cut punch)
        if acc > 0 and 0 < t - acc < 0.08:
            img = flash(img, 0.5)
        writer.send(np.array(img.convert('RGB')))
        if fi % 120 == 0:
            print(f'  frame {fi}/{n_frames}')
    writer.close()
    print('wrote', out_path, f'{os.path.getsize(out_path) / 1e6:.1f} MB')

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--renders', required=True)
    ap.add_argument('--out', default=os.path.join(SITE, 'ad-pack', 'ad-C-site-sizzle-1080.mp4'))
    a = ap.parse_args()
    build(a.renders, a.out)
