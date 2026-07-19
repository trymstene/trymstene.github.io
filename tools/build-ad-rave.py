"""Ad D (rave cut) — the RAVE is the whole ad (1080x1920, 9:16, ~15.5s).

Trym's brief: make the Banana Rave the hero. Multiplayer live floor, drops,
jelly, an LED banner behind the DJ, dress your banana (hat / shoes / rubber
chicken) — and hammer that it's all FREE. One CTA → the rave. The rave-loop
track lays on top (muxed by --music at the end).

INPUTS: engine renders as <set>-<frame>.png (512 transparent), sets:
  bare / dress1..4 / raver1..4  (rendered via tools/ad-render-receiver.py).
RUN:
  python tools/build-ad-rave.py --renders ad-pack/renders-rave \
    [--music public/assets/audio/rave-loop.mp3] [--out ad-pack/ad-D-rave-1080x1920.mp4]
"""
import argparse
import math
import os
import random
import subprocess
import tempfile

import numpy as np
from PIL import Image, ImageDraw, ImageFont

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H = 1080, 1920
FPS = 24

TOP_SAFE = 220
BOT_SAFE = H - 420
YELLOW = (255, 225, 53)
INK = (17, 17, 17)
CREAM = (250, 247, 234)
CYAN = (120, 235, 255)
PINK = (255, 77, 157)
GREEN = (88, 192, 92)
PURPLE = (179, 136, 255)
CLUB = (13, 11, 20)
CLUB_CHECK = (179, 136, 255)
CONF = [(255, 225, 53), (255, 77, 157), (120, 235, 255), (88, 192, 92)]

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
            if idx.isdigit():
                RENDERS.setdefault(name, {})[int(idx)] = Image.open(os.path.join(d, f)).convert('RGBA')

def banana(set_name, t, size, rot=0.0):
    frames = RENDERS[set_name]
    idx = int(t * 10) % 8
    im = frames.get(idx) or frames[0]
    im = im.resize((size, size), Image.NEAREST)
    if rot:
        im = im.rotate(rot, expand=True, resample=Image.NEAREST)
    return im

# ---------------------------------------------------------------- drawing
def paste_center(img, sprite, cx, cy):
    img.alpha_composite(sprite, (int(cx - sprite.width / 2), int(cy - sprite.height / 2)))

def pill(img, text, cy, px=64, pad=24, fg=INK, bg=YELLOW, max_w=900, cx=None, rot=0.0, kind='nunito'):
    cx = W / 2 if cx is None else cx
    d = ImageDraw.Draw(img)
    while px > 26 and d.textlength(text, font=font(kind, px)) > max_w:
        px -= 4
    f = font(kind, px)
    tw = d.textlength(text, font=f)
    h = px + pad * 2
    if rot:
        lay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        dl = ImageDraw.Draw(lay)
        dl.rectangle([cx - tw / 2 - pad * 1.4, cy - h / 2, cx + tw / 2 + pad * 1.4, cy + h / 2], fill=bg, outline=INK, width=6)
        dl.text((cx, cy - px * 0.06), text, font=f, fill=fg, anchor='mm')
        img.alpha_composite(lay.rotate(rot, resample=Image.BICUBIC, center=(cx, cy)))
    else:
        d.rectangle([cx - tw / 2 - pad * 1.4, cy - h / 2, cx + tw / 2 + pad * 1.4, cy + h / 2], fill=bg, outline=INK, width=6)
        d.text((cx, cy - px * 0.06), text, font=f, fill=fg, anchor='mm')

def center_text(img, text, cy, kind, px, fill, max_w=940):
    d = ImageDraw.Draw(img)
    while px > 22 and d.textlength(text, font=font(kind, px)) > max_w:
        px -= 4
    d.text((W / 2, cy), text, font=font(kind, px), fill=fill, anchor='mm')

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
    img.alpha_composite(Image.new('RGBA', img.size, (255, 255, 255, int(255 * min(amt, 1)))))
    return img

def led_banner(img, t, lines, y=300):
    """the club's LED wall — dark panel, flashing cyan/yellow text (a callback to
    the real wall behind the DJ)."""
    d = ImageDraw.Draw(img)
    x0, x1, h = 70, W - 70, 150
    d.rectangle([x0, y, x1, y + h], fill=(20, 15, 32, 235), outline=PURPLE, width=5)
    # scanline texture
    for yy in range(y + 4, y + h - 2, 6):
        d.line([(x0 + 4, yy), (x1 - 4, yy)], fill=(255, 255, 255, 12))
    msg = lines[int(t * 1.6) % len(lines)]
    col = CYAN if int(t * 1.6) % 2 == 0 else YELLOW
    f = font('archivo', 58)
    while d.textlength(msg, font=f) > (x1 - x0 - 40):
        f = font('archivo', f.size - 4)
    d.text((W / 2, y + h / 2), msg, font=f, fill=col, anchor='mm')

def club_bg(t, seed=7, beams=True):
    img = Image.new('RGBA', (W, H), CLUB + (255,))
    lay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    for ty in range(12, 22):
        for tx in range(12):
            if (tx + ty) % 2:
                d.rectangle([tx * 90, ty * 90, tx * 90 + 90, ty * 90 + 90], fill=CLUB_CHECK + (80,))
    if beams:
        sway = math.sin(t * 2.2) * 90
        for bx in (260 + sway, 820 - sway):
            d.polygon([(bx - 46, 0), (bx + 46, 0), (bx + 240, H), (bx - 240, H)], fill=(255, 225, 53, 55))
    rng = random.Random(seed)
    for i in range(64):
        c = CONF[i % len(CONF)]
        x = rng.randrange(0, W - 12, 12)
        y = rng.randrange(0, H - 12, 12)
        d.rectangle([x, y, x + 10, y + 10], fill=c + (175,))
    img.alpha_composite(lay)
    return img

def jelly(img, t, seed):
    """pink jelly drops raining on the floor (the rave's collectible)."""
    d = ImageDraw.Draw(img)
    rng = random.Random(seed)
    for i in range(10):
        x = rng.randrange(80, W - 120)
        fall = (t * 260 + i * 180) % (H + 200) - 100
        s = 34
        d.rectangle([x, fall, x + s, fall + s], fill=PINK + (235,))
        d.rectangle([x + 6, fall + 6, x + 15, fall + 15], fill=(255, 190, 225, 235))

# ---------------------------------------------------------------- scenes
RAVERS = [('raver1', 280, 760, 470, -8), ('raver2', 800, 740, 430, 6),
          ('raver3', 300, 1230, 440, 5), ('raver4', 790, 1250, 470, -6)]

def sc_hook(t, T):
    img = Image.new('RGBA', (W, H), YELLOW + (255,))
    confetti(img, 30, 3, alpha=70)
    pop = ease_out_back(t / 0.4)
    size = int(880 * max(pop, 0.01))
    if size > 2:
        paste_center(img, banana('bare', t, size), W / 2, 980)
    if t > 0.35:
        pill(img, 'you know this banana.', 420, px=76)
    if t > 0.95:
        pill(img, 'since 1999', 1480, px=52, bg=(255, 255, 255), rot=-3)
    return flash(img, (0.28 - t) * 1.3 if t < 0.28 else 0)

def sc_reveal(t, T):
    img = club_bg(t, seed=int(t * 3) % 4 + 5)
    for i, (name, cx, cy, size, rot) in enumerate(RAVERS):
        k = ease_out_back(clamp01((t - i * 0.14) / 0.4))
        bob = math.sin((t + i * 0.4) * 5.4) * 18
        if k > 0.01:
            paste_center(img, banana(name, t + i * 0.2, int(size * k), rot), cx, cy + bob)
    led_banner(img, t, ['WELCOME TO THE BANANA RAVE', 'EVERY BANANA HERE IS REAL'], y=250)
    center_text(img, 'but not like this.', 1500, 'archivo', 70, YELLOW)
    return img

def sc_drop(t, T):
    img = club_bg(t, seed=int(t * 8) % 6 + 9)
    confetti(img, 60, int(t * 20) + 1, alpha=150)
    for i, (name, cx, cy, size, rot) in enumerate(RAVERS):
        jump = abs(math.sin((t + i * 0.2) * 7)) * 40
        paste_center(img, banana(name, t + i * 0.25, size, rot), cx, cy - jump)
    center_text(img, 'A LIVE DANCE FLOOR', 300, 'archivo', 78, YELLOW, max_w=920)
    center_text(img, 'everyone dances together — right now', 400, 'nunito', 44, (255, 253, 245))
    stro = math.sin(t * 30)
    return flash(img, 0.5 if t < 0.12 else (0.14 if stro > 0.9 else 0))

DRESS = [(0.0, 'dress1', 'ADD A HAT'), (0.75, 'dress2', 'ADD SHOES'),
         (1.5, 'dress3', 'A RUBBER CHICKEN?!'), (2.25, 'dress4', 'HIT THE FLOOR')]
def sc_dress(t, T):
    img = club_bg(t, seed=3, beams=False)
    set_name, label, since = 'bare', None, 9.0
    for start, name, lab in DRESS:
        if t >= start:
            set_name, label, since = name, lab, t - start
    b = banana(set_name, t, 860)
    if since < 0.2 and label:
        s = 1 + 0.12 * math.sin(clamp01(since / 0.2) * math.pi)
        b = b.resize((int(860 * s), int(860 * s)), Image.NEAREST)
    paste_center(img, b, W / 2, 1040)
    pill(img, 'dress YOUR banana', 300, px=66)
    if label and since < 0.6:
        pill(img, label, 470, px=58, bg=(255, 255, 255), max_w=680, rot=4)
    pill(img, '50+ wearables — all free', 1520, px=48, bg=INK, fg=YELLOW)
    return img

PLAY = [(0.0, 'collect the JELLY'), (0.9, 'catch the DROPS'), (1.8, 'survive the night')]
def sc_play(t, T):
    img = club_bg(t, seed=int(t * 4) % 4 + 2)
    jelly(img, t, 11)
    for i, (name, cx, cy, size, rot) in enumerate(RAVERS[:2]):
        bob = math.sin((t + i) * 5.5) * 16
        paste_center(img, banana(name, t + i * 0.3, 380, rot), cx, cy + bob - 120)
    # a wearable DROP falling (headphones-ish pixel puck)
    d = ImageDraw.Draw(img)
    dy = (t * 320) % (H + 100) - 80
    d.rounded_rectangle([W / 2 - 46, dy, W / 2 + 46, dy + 60], radius=14, fill=(30, 26, 40, 255), outline=CYAN, width=6)
    d.rectangle([W / 2 - 40, dy + 20, W / 2 - 26, dy + 46], fill=CYAN)
    d.rectangle([W / 2 + 26, dy + 20, W / 2 + 40, dy + 46], fill=CYAN)
    label = PLAY[min(int(t / 0.9), len(PLAY) - 1)][1]
    pill(img, label, 300, px=64, bg=YELLOW)
    pill(img, 'level up · earn gear · badges', 1520, px=44, bg=(255, 255, 255))
    return img

def sc_free(t, T):
    img = Image.new('RGBA', (W, H), PINK + (255,))
    confetti(img, 54, 21, alpha=90)
    k = ease_out_back(clamp01(t / 0.4))
    center_text(img, '100% FREE', 780, 'archivo', int(150 * max(k, 0.2)), YELLOW)
    center_text(img, 'no signup. no app.', 980, 'archivo', 66, (255, 255, 255))
    center_text(img, 'just dance.', 1080, 'nunito', 54, INK)
    return flash(img, (0.2 - t) * 1.4 if t < 0.2 else 0)

def sc_end(t, T):
    img = club_bg(t, seed=7)
    led_banner(img, t, ['JOIN THE RAVE', 'THE FLOOR IS OPEN'], y=250)
    k = ease_out_back(clamp01(t / 0.4))
    paste_center(img, banana('dress3', t, int(760 * max(k, 0.01))), W / 2, 1020)
    center_text(img, 'trymstene.com', 1440, 'archivo', 84, YELLOW)
    pill(img, 'free · plays in your browser', 1560, px=46, bg=(255, 255, 255))
    if t > 0.6:
        bob = math.sin(t * 6) * 14
        d = ImageDraw.Draw(img)
        d.text((250, 1660 + bob), 'tap below', font=font('nunito', 46), fill=YELLOW, anchor='mm')
        d.polygon([(250 - 26, 1712 + bob), (250 + 26, 1712 + bob), (250, 1768 + bob)], fill=YELLOW)
    return img

# ---------------------------------------------------------------- timeline
SCENES = [
    (2.0, sc_hook),
    (2.6, sc_reveal),
    (1.5, sc_drop),
    (3.2, sc_dress),
    (2.6, sc_play),
    (1.3, sc_free),
    (2.6, sc_end),
]

def build(renders_dir, out_path, music=None):
    load_renders(renders_dir)
    total = sum(d for d, _ in SCENES)
    n_frames = int(total * FPS)
    print(f'{total:.1f}s -> {n_frames} frames @ {FPS}fps')
    import imageio_ffmpeg
    silent = out_path if not music else out_path.replace('.mp4', '.silent.mp4')
    writer = imageio_ffmpeg.write_frames(
        silent, (W, H), fps=FPS, codec='libx264', pix_fmt_out='yuv420p',
        macro_block_size=1, output_params=['-crf', '21', '-movflags', '+faststart'])
    writer.send(None)
    for fi in range(n_frames):
        t = fi / FPS
        acc = 0.0
        img = None
        for dur, fn in SCENES:
            if t < acc + dur:
                img = fn(t - acc, dur)
                break
            acc += dur
        if img is None:
            img = Image.new('RGBA', (W, H), (0, 0, 0, 255))
        if acc > 0 and 0 < t - acc < 0.06:  # a white blink on every cut
            img = flash(img, 0.55)
        writer.send(np.array(img.convert('RGB')))
        if fi % 60 == 0:
            print(f'  frame {fi}/{n_frames}')
    writer.close()
    print('video ->', silent)

    if music:
        ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
        # loop bed, trimmed to the video, with a short fade out at the end
        fade_start = max(0.0, total - 0.6)
        cmd = [ffmpeg, '-y', '-i', silent, '-i', music,
               '-filter_complex', f'[1:a]atrim=0:{total},afade=t=out:st={fade_start:.2f}:d=0.6[a]',
               '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k',
               '-shortest', out_path]
        subprocess.run(cmd, check=True)
        os.remove(silent)
        print('muxed ->', out_path)
    print('DONE', out_path, f'{os.path.getsize(out_path) / 1e6:.1f} MB')

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--renders', default=os.path.join(SITE, 'ad-pack', 'renders-rave'))
    ap.add_argument('--music', default=os.path.join(SITE, 'public', 'assets', 'audio', 'rave-loop.mp3'))
    ap.add_argument('--out', default=os.path.join(SITE, 'ad-pack', 'ad-D-rave-1080x1920.mp4'))
    a = ap.parse_args()
    build(a.renders, a.out, a.music if a.music.lower() != 'none' else None)
