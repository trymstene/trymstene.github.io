"""Ad D — the TikTok sizzle (1080x1920 MP4, 9:16 vertical, ~15.5s).

Ad C's fast-cut full-site tour rebuilt for TikTok best practice:
- 9:16 vertical, ~15s (TikTok's ad sweet spot is 9-15s), hard cuts + white
  blinks, hook inside the first second, no talking head.
- SAFE ZONES respected: nothing important in the right icon rail (~140px),
  the bottom caption/CTA band (~400px) or the very top (~200px).
- The link goes to the BUILDER, so the builder + sharing carry the ad; the
  rave / gallery / forge / pass are one-beat flexes. The absurd batch-3
  wearables (fishbowl, googly eyes, rubber chicken, balloons, cone of shame)
  are the montage stars — they're the screenshot-able moments.
- Ends pointing at TikTok's own CTA button (bottom-left) — best practice is
  to hand off to the platform button, not fight it.
- Silent on purpose: TikTok is sound-on, but ads must use LICENSED audio —
  add a track from TikTok's Commercial Music Library at upload time (or DJ
  Sentry's own set, since Trym owns it).

INPUTS: engine renders as <set>-<frame>.png (512px transparent), sets:
  bare / step1..step5 (the dress-up arc) / raver1..4 / passb / coney.
  Rendered in the browser via drawComposite + a local POST receiver.
RUN: python tools/build-ad-tiktok.py --renders <dir> [--out ad-pack/ad-D-tiktok-1080x1920.mp4]
"""
import argparse
import math
import os
import random
import tempfile

import numpy as np
from PIL import Image, ImageDraw, ImageFont

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H = 1080, 1920
FPS = 24

# safe-zone rails (TikTok in-feed UI)
TOP_SAFE = 220
BOT_SAFE = H - 420   # caption + CTA band starts here
RIGHT_SAFE = W - 150

CREAM = (250, 247, 234)
YELLOW = (255, 225, 53)
INK = (17, 17, 17)
PINK = (255, 77, 157)
RED = (226, 32, 32)
CLUB = (13, 11, 20)
CLUB_CHECK = (179, 136, 255)
CONF = [(255, 225, 53), (255, 77, 157), (120, 235, 255), (88, 192, 92)]
DISCORD = (49, 51, 56)
PAPER = (250, 246, 238)

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

# ---------------------------------------------------------------- drawing
def pill(draw_img, text, cy, px=64, pad=26, fg=INK, bg=YELLOW, max_w=860, cx=None, rot=0.0):
    cx = W / 2 if cx is None else cx
    d = ImageDraw.Draw(draw_img)
    while px > 28:
        f = font('nunito', px)
        if d.textlength(text, font=f) <= max_w:
            break
        px -= 4
    f = font('nunito', px)
    tw = d.textlength(text, font=f)
    h = px + pad * 2
    if rot:
        lay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        dl = ImageDraw.Draw(lay)
        dl.rectangle([cx - tw / 2 - pad * 1.4, cy - h / 2, cx + tw / 2 + pad * 1.4, cy + h / 2],
                     fill=bg, outline=INK, width=6)
        dl.text((cx, cy - px * 0.06), text, font=f, fill=fg, anchor='mm')
        draw_img.alpha_composite(lay.rotate(rot, resample=Image.BICUBIC, center=(cx, cy)))
    else:
        d.rectangle([cx - tw / 2 - pad * 1.4, cy - h / 2, cx + tw / 2 + pad * 1.4, cy + h / 2],
                    fill=bg, outline=INK, width=6)
        d.text((cx, cy - px * 0.06), text, font=f, fill=fg, anchor='mm')

def center_text(img, text, cy, kind, px, fill, max_w=900):
    d = ImageDraw.Draw(img)
    while px > 22 and d.textlength(text, font=font(kind, px)) > max_w:
        px -= 4
    d.text((W / 2, cy), text, font=font(kind, px), fill=fill, anchor='mm')

def paste_center(img, sprite, cx, cy):
    img.alpha_composite(sprite, (int(cx - sprite.width / 2), int(cy - sprite.height / 2)))

def confetti(img, n, seed, alpha=255):
    d = ImageDraw.Draw(img)
    rng = random.Random(seed)
    for i in range(n):
        c = CONF[i % len(CONF)]
        x = rng.randrange(0, W - 12, 12)
        y = rng.randrange(0, H - 12, 12)
        d.rectangle([x, y, x + 10, y + 10], fill=c + (alpha,))

def flash(img, amt):
    if amt <= 0:
        return img
    white = Image.new('RGBA', img.size, (255, 255, 255, int(255 * min(amt, 1))))
    img.alpha_composite(white)
    return img

def club_bg(t, seed=7):
    img = Image.new('RGBA', (W, H), CLUB + (255,))
    lay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    for ty in range(12, 22):
        for tx in range(12):
            if (tx + ty) % 2:
                d.rectangle([tx * 90, ty * 90, tx * 90 + 90, ty * 90 + 90],
                            fill=CLUB_CHECK + (85,))
    sway = math.sin(t * 2.2) * 90
    for bx, tilt in [(260 + sway, 0.4), (820 - sway, -0.3)]:
        d.polygon([(bx - 46, 0), (bx + 46, 0),
                   (bx + tilt * H * 0.4 + 220, H), (bx + tilt * H * 0.4 - 220, H)],
                  fill=(255, 225, 53, 60))
    rng = random.Random(seed)
    for i in range(70):
        c = CONF[i % len(CONF)]
        x = rng.randrange(0, W - 12, 12)
        y = rng.randrange(0, H - 12, 12)
        d.rectangle([x, y, x + 10, y + 10], fill=c + (185,))
    img.alpha_composite(lay)
    return img

# ---------------------------------------------------------------- scenes
def sc_hook(t, T):
    img = Image.new('RGBA', (W, H), YELLOW + (255,))
    confetti(img, 34, 3, alpha=70)
    pop = ease_out_back(t / 0.45)
    size = int(860 * max(pop, 0.01))
    if size > 2:
        paste_center(img, banana('bare', t, size), W / 2, 900)
    if t > 0.4:
        pill(img, 'You know this banana.', 380, px=72)
    if t > 0.95:
        pill(img, 'since 1999', 1420, px=54, bg=(255, 255, 255), rot=-3)
    return flash(img, (0.3 - t) * 1.2 if t < 0.3 else 0)

BUILD_STEPS = [(0.0, 'step1', 'FISHBOWL!'), (0.55, 'step2', 'GOOGLY EYES!'),
               (1.1, 'step3', 'FLAME KICKS!'), (1.65, 'step4', 'RUBBER CHICKEN!'),
               (2.2, 'step5', 'BALLOONS!')]
def sc_builder(t, T):
    img = Image.new('RGBA', (W, H), CREAM + (255,))
    set_name, label, since = 'bare', None, 99.0
    for start, name, lab in BUILD_STEPS:
        if t >= start:
            set_name, label, since = name, lab, t - start
    b = banana(set_name, t, 820)
    if since < 0.2 and label:
        s = 1 + 0.10 * math.sin(clamp01(since / 0.2) * math.pi)
        b = b.resize((int(820 * s), int(820 * s)), Image.NEAREST)
    paste_center(img, b, W / 2, 950)
    if label and since < 0.5:
        pill(img, label, 430, px=58, bg=(255, 255, 255), max_w=620, rot=5)
    pill(img, 'Dress the REAL banana', 280, px=62)
    pill(img, '50 wearables · free · no signup', 1430, px=44, bg=(255, 255, 255))
    return img

def sc_share(t, T):
    img = Image.new('RGBA', (W, H), DISCORD + (255,))
    d = ImageDraw.Draw(img)
    rows = [('the group chat', 'today at 9:41', 480), ('banana enjoyer', 'today at 9:42', 950)]
    for i, (name, ts, y) in enumerate(rows):
        k = ease_out(clamp01((t - i * 0.35) / 0.4))
        if k <= 0.01:
            continue
        x = 90 + (1 - k) * 600
        d.ellipse([x, y, x + 88, y + 88], fill=YELLOW)
        av = banana('bare', 0.2, 76)
        img.alpha_composite(av, (int(x) + 6, y + 5))
        d.text((x + 116, y + 6), name, font=font('nunito', 42), fill=(242, 201, 76))
        d.text((x + 116 + d.textlength(name, font=font('nunito', 42)) + 18, y + 18), ts,
               font=font('nunito', 28), fill=(148, 155, 164))
        gif = banana('step5' if i == 0 else 'coney', t + i * 0.2, 330)
        img.alpha_composite(gif, (int(x) + 110, y + 70))
    pill(img, 'download it — send it anywhere', 1450, px=50)
    return img

RAVERS = [('raver1', 280, 780, 470, -8), ('raver2', 800, 760, 430, 6),
          ('raver3', 300, 1250, 430, 5), ('raver4', 790, 1270, 460, -6)]
def sc_rave(t, T):
    img = club_bg(t, seed=int(t * 4) % 5 + 5)
    for i, (name, cx, cy, size, rot) in enumerate(RAVERS):
        bob = math.sin((t + i * 0.35) * 5.2) * 16
        k = ease_out_back(clamp01((t - i * 0.1) / 0.35))
        paste_center(img, banana(name, t + i * 0.2, int(size * max(k, 0.01)), rot), cx, cy + bob)
    center_text(img, 'JOIN THE BANANA RAVE', 300, 'archivo', 76, YELLOW, max_w=880)
    center_text(img, 'a LIVE dance floor', 390, 'nunito', 48, (255, 253, 245))
    stro = math.sin(t * 8.5)
    return flash(img, 0.10 if stro > 0.92 else 0)

def sc_wall(t, T, remixes):
    img = Image.new('RGBA', (W, H), CREAM + (255,))
    cell, gap = 200, 22
    grid_w = 4 * cell + 3 * gap
    x0 = (W - grid_w) // 2
    y0 = 480
    for i, frames in enumerate(remixes[:16]):
        r, c = divmod(i, 4)
        k = ease_out_back(clamp01((t - i * 0.05) / 0.28))
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
    pill(img, '266+ bananas by the internet', 300, px=56)
    pill(img, 'the gallery — all free', 1480, px=46, bg=(255, 255, 255))
    return img

def sc_forge(t, T):
    img = Image.new('RGBA', (W, H), (28, 26, 36, 255))
    d = ImageDraw.Draw(img)
    small = RENDERS['bare'][2].resize((26, 26), Image.NEAREST)
    px_size = 30
    ox, oy = (W - 26 * px_size) // 2, 500
    for gx in range(0, 27):
        d.line([(ox + gx * px_size, oy), (ox + gx * px_size, oy + 26 * px_size)], fill=(255, 255, 255, 14))
        d.line([(ox, oy + gx * px_size), (ox + 26 * px_size, oy + gx * px_size)], fill=(255, 255, 255, 14))
    arr = np.array(small)
    filled = [(x, y) for y in range(26) for x in range(26) if arr[y, x, 3] > 60]
    random.Random(4).shuffle(filled)
    n = int(len(filled) * clamp01(t / (T * 0.8)))
    for x, y in filled[:n]:
        r, g, b, a = arr[y, x]
        d.rectangle([ox + x * px_size, oy + y * px_size, ox + (x + 1) * px_size - 1, oy + (y + 1) * px_size - 1],
                    fill=(int(r), int(g), int(b), 255))
    if n < len(filled):
        cx, cy = filled[min(n, len(filled) - 1)]
        d.rectangle([ox + cx * px_size - 3, oy + cy * px_size - 3,
                     ox + (cx + 1) * px_size + 2, oy + (cy + 1) * px_size + 2], outline=YELLOW, width=4)
    pill(img, 'or draw pixel GIFs in the Forge', 320, px=54)
    return img

def sc_pass(t, T):
    img = Image.new('RGBA', (W, H), PAPER + (255,))
    d = ImageDraw.Draw(img)
    # halftone corners, paper style
    d2 = ImageDraw.Draw(img)
    for i in range(40):
        gx, gy = i % 8, i // 8
        d2.ellipse([30 + gx * 24, 250 + gy * 24, 36 + gx * 24, 256 + gy * 24], fill=(17, 17, 17, 24))
    # the card slides up
    k = ease_out(clamp01(t / 0.45))
    CX, CW, CH2 = 70, 940, 700
    CY = int(560 + (1 - k) * 500)
    d.rectangle([CX + 14, CY + 14, CX + CW + 14, CY + CH2 + 14], fill=INK)
    d.rectangle([CX, CY, CX + CW, CY + CH2], fill=YELLOW)
    d.rectangle([CX + 4, CY + 4, CX + CW - 4, CY + CH2 - 4], outline=INK, width=8)
    d.rectangle([CX + 8, CY + 8, CX + CW - 8, CY + 72], fill=INK)
    d.text((CX + 36, CY + 40), 'BANANA WORLD · MEMBERSHIP', font=font('nunito', 34), fill=YELLOW, anchor='lm')
    d.ellipse([CX + CW - 62, CY + 26, CX + CW - 34, CY + 54], fill=PAPER, outline=YELLOW, width=4)
    # member bits
    d.text((CX + 44, CY + 150), 'OFFICIAL MEMBER', font=font('archivo', 54), fill=INK, anchor='lm')
    d.text((CX + 44, CY + 214), 'BADGES · LEVELS · GEAR', font=font('nunito', 32), fill=(17, 17, 17, 200), anchor='lm')
    d.rectangle([CX + 42, CY + 262, CX + 350, CY + 320], fill=INK)
    d.text((CX + 60, CY + 291), 'LVL 7 · REGULAR', font=font('nunito', 32), fill=YELLOW, anchor='lm')
    # barcode
    rng = random.Random(9)
    bx = CX + 44
    while bx < CX + 300:
        wd = 3 + rng.randrange(7)
        if rng.random() > 0.42:
            d.rectangle([bx, CY + CH2 - 110, bx + wd, CY + CH2 - 60], fill=INK)
        bx += wd + 3
    # the banana + stamp
    if k > 0.9:
        paste_center(img, banana('passb', t, 460, rot=8), CX + CW - 260, CY + 400)
        lay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        dl = ImageDraw.Draw(lay)
        scx, scy = CX + CW - 300, CY + CH2 - 90
        dl.rectangle([scx - 150, scy - 46, scx + 150, scy + 46], outline=RED, width=6)
        dl.rectangle([scx - 138, scy - 34, scx + 138, scy + 34], outline=RED, width=3)
        dl.text((scx, scy), 'OFFICIAL', font=font('archivo', 44), fill=RED, anchor='mm')
        img.alpha_composite(Image.eval(lay.rotate(-8, resample=Image.BICUBIC, center=(scx, scy)),
                                       lambda v: v).convert('RGBA'))
    pill(img, 'earn your Banana World pass', 350, px=54)
    return img

def sc_end(t, T):
    img = Image.new('RGBA', (W, H), YELLOW + (255,))
    confetti(img, 40, 21, alpha=80)
    center_text(img, 'One banana.', 330, 'archivo', 92, INK)
    center_text(img, 'Endless party.', 440, 'archivo', 92, INK)
    # the closer is the FULL absurd build (fishbowl/googly/chicken/balloons) —
    # it echoes the builder scene, which is where the ad's link goes; the cone
    # banana already had its moment in the chat scene
    k = ease_out_back(clamp01(t / 0.4))
    paste_center(img, banana('step5', t, int(700 * max(k, 0.01))), W / 2, 930)
    center_text(img, 'trymstene.com', 1330, 'archivo', 80, INK)
    pill(img, 'free · no signup', 1440, px=46, bg=(255, 255, 255))
    # hand off to TikTok's CTA button (bottom-left) — bouncing pointer
    if t > 0.6:
        bob = math.sin(t * 6) * 14
        d = ImageDraw.Draw(img)
        d.text((250, 1560 + bob), 'tap below', font=font('nunito', 44), fill=INK, anchor='mm')
        d.polygon([(250 - 26, 1610 + bob), (250 + 26, 1610 + bob), (250, 1665 + bob)], fill=INK)
    return img

# ---------------------------------------------------------------- timeline
def build(renders_dir, out_path):
    load_renders(renders_dir)
    remixes = load_remixes()
    scenes = [
        (1.6, sc_hook),
        (3.0, sc_builder),
        (2.0, sc_share),
        (1.8, sc_rave),
        (1.8, lambda t, T: sc_wall(t, T, remixes)),
        (1.6, sc_forge),
        (1.8, sc_pass),
        (2.2, sc_end),
    ]
    total = sum(d for d, _ in scenes)
    n_frames = int(total * FPS)
    print(f'{total:.1f}s -> {n_frames} frames @ {FPS}fps')
    import imageio_ffmpeg
    writer = imageio_ffmpeg.write_frames(
        out_path, (W, H), fps=FPS, codec='libx264', pix_fmt_out='yuv420p',
        macro_block_size=1,
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
        if acc > 0 and 0 < t - acc < 0.08:
            img = flash(img, 0.5)
        writer.send(np.array(img.convert('RGB')))
        if fi % 96 == 0:
            print(f'  frame {fi}/{n_frames}')
    writer.close()
    print('wrote', out_path, f'{os.path.getsize(out_path) / 1e6:.1f} MB')

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--renders', required=True)
    ap.add_argument('--out', default=os.path.join(SITE, 'ad-pack', 'ad-D-tiktok-1080x1920.mp4'))
    a = ap.parse_args()
    build(a.renders, a.out)
