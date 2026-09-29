# -*- coding: utf-8 -*-
"""THE OFFICIAL DANCING BANANA STREAM PACK: emotes, sub badges, alerts, scene screens and panels for Twitch and Discord.

Every banana is tools/banana_render.py (the builder's own Python mirror, held to it by the print-parity rig), wearing the
builder's own wearables, cropped at the source size and resized ONCE (design library 6). The banana never changes its
face: an emote's mood is what it wears and holds, the way the builder dresses it.

    python tools/stream-pack/build_stream_pack.py      # tools/stream-pack/out/ (ignored) + a zip beside it

Twitch: emotes 28/56/112 (animated: GIF, 60 frames at most, no fast flashing), sub badges 18/36/72. Discord: emotes 128.
"""
import math
import os
import shutil
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
TOOLS = os.path.dirname(HERE)
sys.path.insert(0, TOOLS)
import banana_render as br  # noqa: E402

OUT = os.path.join(HERE, 'out', 'official-dancing-banana-stream-pack')
FONT = os.path.join(TOOLS, 'ArchivoBlack.ttf')
BANANA = (255, 225, 53)
INK = (17, 17, 17)
PAPER = (255, 253, 245)
HOT = (255, 77, 109)
MS = 100   # a frame of the dance, the original GIF's timing

# ── the emotes: a name, what it wears and holds, and an effect (the builder's own confetti / sparkles) ──────────
EMOTES = [
    ('dance', {}, None),
    ('hype', {'hat': 'party'}, 'confetti'),
    ('love', {'glasses': 'hearts'}, None),
    ('cool', {'glasses': 'shades'}, None),
    ('lol', {'glasses': 'googlyeyes'}, None),
    ('gg', {'hat': 'crown', 'extras': ['trophy']}, None),
    ('rip', {'hat': 'halo', 'extras': ['candle']}, None),
    ('evil', {'hat': 'devilhorns'}, None),
    ('gn', {'hat': 'nightcap', 'extras': ['nightshirt']}, None),
    ('gm', {'extras': ['mug']}, None),
    ('vibe', {'hat': 'djheadphones', 'extras': ['glowstick']}, None),
    ('shiny', {'extras': ['goldbanana']}, 'sparkle'),
]
# ── the sub badges: a banana that dresses up the longer you stay ───────────────────────────────────────────────
BADGES = [
    ('01-month', {}),
    ('02-months', {'hat': 'party'}),
    ('03-months', {'glasses': 'shades'}),
    ('06-months', {'hat': 'cowboy', 'glasses': 'shades'}),
    ('09-months', {'hat': 'crown'}),
    ('12-months', {'hat': 'pixelcrown', 'glasses': 'shades', 'extras': ['goldchain']}),
]
STILL = 3   # the frame a still is taken from: facing you, hands up by the face (a held thing is in the picture)

# ── the builder's effects, redrawn exactly (banana-engine.js drawSparks / drawConfetti), on the square's own size ──
SPARKS = [(0.24, 0.30), (0.76, 0.26), (0.30, 0.55), (0.72, 0.58), (0.26, 0.76), (0.76, 0.78), (0.50, 0.14), (0.68, 0.40),
          (0.33, 0.40), (0.60, 0.84)]
CONF_C = [(255, 77, 109), (77, 184, 255), (242, 194, 0), (55, 214, 122), (179, 136, 255)]
CONFETTI = [(0.26 + ((k * 0.383) % 1) * 0.48, (k * 0.37) % 1, CONF_C[k % 5]) for k in range(14)]


def fx(img, kind, idx):
    W = img.width
    d = ImageDraw.Draw(img)
    if kind == 'sparkle':
        s = max(2, round(W * 0.014))
        for k, (px, py) in enumerate(SPARKS):
            t = (k * 3 + idx) % 8
            if t >= 4:
                continue
            c = (242, 194, 0, 255) if k % 2 else (255, 255, 255, 255)
            x, y = round(px * W), round(py * W)
            cells = [(0, 0)] + ([(0, -1), (0, 1), (-1, 0), (1, 0)] if t < 2 else [])
            for cx, cy in cells:
                d.rectangle((x - s / 2 + cx * s, y - s / 2 + cy * s, x + s / 2 + cx * s - 1, y + s / 2 + cy * s - 1), fill=c)
    if kind == 'confetti':
        s = max(2, round(W * 0.018))
        for k, (px, off, c) in enumerate(CONFETTI):
            prog = (off + idx / 8) % 1
            y = (0.10 + prog * 0.82) * W
            x = px * W + (s if (idx + k) % 2 else -s) / 2
            h = s if k % 3 else s * 1.6
            d.rectangle((round(x), round(y), round(x) + s - 1, round(y + h) - 1), fill=c + (255,))
    return img


def frames_of(outfit, scale=2):
    return [br.render(i, outfit, scale=scale) for i in range(br.NFRAMES)]


def square(box, margin=0.04):
    l, t, r, b = box
    side = max(r - l, b - t)
    side = round(side * (1 + 2 * margin))
    cx, cy = (l + r) / 2, (t + b) / 2
    return (round(cx - side / 2), round(cy - side / 2), round(cx - side / 2) + side, round(cy - side / 2) + side)


def upper_box(img, idx, scale):
    """hat to chest: the content's own box between its top and a little under the mouth (arms and held things included)"""
    pad = br.pad_for(scale)
    bottom = pad + (br.FRAMES[idx]['eyeCy'] + 150) * scale
    band = img.crop((0, 0, img.width, bottom))
    return band.getbbox()


def head_box(img, idx, below=110):
    """the face centred: from the top of whatever is on the head to just under the mouth, as wide as it is tall"""
    F = br.FRAMES[idx]
    pad = br.pad_for(S)
    bottom = pad + (F['eyeCy'] + below) * S
    t = img.crop((0, 0, img.width, bottom)).getbbox()[1]
    cx = pad + F['eyeCx'] * S
    half = (bottom - t) / 2
    return (round(cx - half), t, round(cx + half), bottom)


def face_box(img, idx, outfit):
    box = head_box(img, idx)
    held = [e for e in (outfit.get('extras') or []) if br.EXTRAS.get(e, {}).get('anchor') == 'hand']
    if held:
        # what the hand holds = what is drawn with it and not without it
        bare = br.render(idx, {k: v for k, v in outfit.items() if k != 'extras'}, scale=S)
        pa, pb = img.getchannel('A').load(), bare.getchannel('A').load()
        l, t, r, bt = box
        xs, ys = [], []
        for y in range(0, img.height, 2):
            for x in range(0, img.width, 2):
                if pa[x, y] > 0 and pb[x, y] == 0:
                    xs.append(x); ys.append(y)
        if xs:
            box = (min(l, min(xs)), min(t, min(ys)), max(r, max(xs)), max(bt, max(ys)))
    return square(box, 0.03)


def union(boxes):
    return (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))


def edge(img, px):
    """a white edge round the whole shape: Twitch's dark chat swallows the banana's black arms and outline without it"""
    a = img.getchannel('A').point(lambda v: 255 if v >= 96 else 0)
    grown = a.filter(ImageFilter.MaxFilter(2 * px + 1))
    out = Image.new('RGBA', img.size, (0, 0, 0, 0))
    out.paste((255, 255, 255, 255), mask=grown)
    out.alpha_composite(img)
    return out


def cut(img, box, size, effect=None, idx=0, rim=True):
    sq = Image.new('RGBA', (box[2] - box[0], box[3] - box[1]), (0, 0, 0, 0))
    sq.alpha_composite(img.crop(box))
    m = min(4, max(1, round(size / 48))) if rim else 0   # room for the edge inside the square
    out = sq.resize((size - 2 * m, size - 2 * m), Image.Resampling.BOX)
    full = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    full.alpha_composite(out, (m, m))
    if rim:
        full = edge(full, m)
    # the builder's confetti and sparkles fly in front, never inside the banana's edge (they read as white boxes there)
    return fx(full, effect, idx) if effect else full


def save_gif(frames, path):
    """a transparent looping GIF: one shared palette, a keyed transparent index, hard alpha (chat is dark or light)"""
    key = (255, 0, 255)
    rgb = []
    for f in frames:
        r = Image.new('RGB', f.size, key)
        m = f.getchannel('A').point(lambda a: 255 if a >= 128 else 0)
        r.paste(f.convert('RGB'), mask=m)
        rgb.append(r)
    mosaic = Image.new('RGB', (rgb[0].width, rgb[0].height * len(rgb)))
    for i, r in enumerate(rgb):
        mosaic.paste(r, (0, i * r.height))
    pal = mosaic.quantize(colors=255, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    ps = [r.quantize(palette=pal, dither=Image.Dither.NONE) for r in rgb]
    lut = pal.getpalette()[:768]
    cols = [tuple(lut[i * 3:i * 3 + 3]) for i in range(256)]
    t = min(range(256), key=lambda i: sum((a - b) ** 2 for a, b in zip(cols[i], key)))
    ps[0].save(path, save_all=True, append_images=ps[1:], duration=MS, loop=0, transparency=t, disposal=2, optimize=False)


def font(size):
    return ImageFont.truetype(FONT, size)


# ════════════════════════════════════════════ build ═════════════════════════════════════════════════════════════
# emptied, never removed: a shell standing in the folder holds it open on Windows
os.makedirs(OUT, exist_ok=True)
for fn in os.listdir(OUT):
    p = os.path.join(OUT, fn)
    shutil.rmtree(p) if os.path.isdir(p) else os.remove(p)
S = 2   # render at 2x the builder's space: every downscale is from plenty of pixels
PAD = br.pad_for(S)

# ── emotes ──────────────────────────────────────────────────────────────────────────────────────────────────────
emote_stills = {}
for name, outfit, effect in EMOTES:
    d = os.path.join(OUT, 'emotes', name)
    os.makedirs(d)
    fr = frames_of(outfit, S)
    still_box = face_box(fr[STILL], STILL, outfit)
    anim_box = square(union([upper_box(f, i, S) for i, f in enumerate(fr)]))
    for size in (112, 56, 28):
        cut(fr[STILL], still_box, size, effect, 0).save(os.path.join(d, 'twitch-%d.png' % size), optimize=True)
        save_gif([cut(f, anim_box, size, effect, i) for i, f in enumerate(fr)], os.path.join(d, 'twitch-animated-%d.gif' % size))
    cut(fr[STILL], still_box, 128, effect, 0).save(os.path.join(d, 'discord-128.png'), optimize=True)
    save_gif([cut(f, anim_box, 128, effect, i) for i, f in enumerate(fr)], os.path.join(d, 'discord-animated-128.gif'))
    emote_stills[name] = (fr, still_box, anim_box, effect)
    print('emote', name)

# ── sub badges: the head alone, it is read at 18 px ────────────────────────────────────────────────────────────
for name, outfit in BADGES:
    d = os.path.join(OUT, 'sub-badges')
    os.makedirs(d, exist_ok=True)
    # frame 2: facing you with both hands out wide at eye height, so the square round the face holds no stray hand
    f = br.render(2, outfit, scale=S)
    box = square(head_box(f, 2, below=80), 0.02)
    for size in (72, 36, 18):
        cut(f, box, size).save(os.path.join(d, '%s-%d.png' % (name, size)), optimize=True)
    print('badge', name)

# ── alerts: the whole banana, dancing, on transparency (a streaming app lays its own words over it) ─────────────
ALERTS = [('follow', {'hat': 'party'}, 'confetti'), ('subscribe', {'hat': 'crown', 'glasses': 'shades'}, 'sparkle'),
          ('raid', {'hat': 'viking'}, 'confetti')]
os.makedirs(os.path.join(OUT, 'alerts'))
for name, outfit, effect in ALERTS:
    fr = frames_of(outfit, S)
    box = square(union([f.getbbox() for f in fr]), 0.06)
    save_gif([cut(f, box, 500, effect, i) for i, f in enumerate(fr)], os.path.join(OUT, 'alerts', name + '-500.gif'))
    print('alert', name)

# ── the dancer for a scene: the classic dance on its own, big, for an OBS image source over a scene screen ─────
fr = frames_of({}, S)
box = square(union([f.getbbox() for f in fr]), 0.04)
save_gif([cut(f, box, 600, None, i) for i, f in enumerate(fr)], os.path.join(OUT, 'alerts', 'dancing-banana-600.gif'))


# ── scene screens, 1920×1080: the site's party (banana yellow, turning rays, the white word in a black outline) ──
def rays(W, H, cx, cy, n=18):
    im = Image.new('RGB', (W, H), BANANA)
    d = ImageDraw.Draw(im)
    R = math.hypot(W, H)
    for k in range(n):
        a0 = 2 * math.pi * k / n
        a1 = a0 + math.pi / n
        d.polygon([(cx, cy), (cx + R * math.cos(a0), cy + R * math.sin(a0)), (cx + R * math.cos(a1), cy + R * math.sin(a1))],
                  fill=(255, 236, 110))
    return im


def outlined(d, xy, text, f, fill=(255, 255, 255), stroke=INK, sw=10, anchor='mm', shadow=8):
    x, y = xy
    d.text((x + shadow, y + shadow), text, font=f, fill=stroke, anchor=anchor, stroke_width=sw, stroke_fill=stroke)
    d.text((x, y), text, font=f, fill=fill, anchor=anchor, stroke_width=sw, stroke_fill=stroke)


SCENES = [('starting-soon', 'STARTING SOON'), ('be-right-back', 'BE RIGHT BACK'), ('stream-ending', 'THANKS FOR WATCHING')]
os.makedirs(os.path.join(OUT, 'scenes'))
still = br.render(STILL, {}, scale=S)
sb = still.getbbox()
for name, words in SCENES:
    im = rays(1920, 1080, 960, 700)
    d = ImageDraw.Draw(im)
    f = font(150)
    while d.textlength(words, font=f) > 1700:
        f = font(f.size - 6)
    outlined(d, (960, 250), words, f)
    ban = Image.new('RGBA', (sb[2] - sb[0], sb[3] - sb[1]))
    ban.alpha_composite(still.crop(sb))
    h = 620
    ban = ban.resize((round(ban.width * h / ban.height), h), Image.Resampling.BOX)
    im = im.convert('RGBA')
    im.alpha_composite(ban, ((1920 - ban.width) // 2, 1080 - h - 20))
    im.convert('RGB').save(os.path.join(OUT, 'scenes', name + '-1920x1080.png'), optimize=True)
    print('scene', name)

# ── panels, 320×100: a yellow card with a black edge, the word, and a banana peeking in ───────────────────────
PANELS = ['ABOUT ME', 'SCHEDULE', 'DISCORD', 'SUPPORT', 'RULES', 'SOCIALS']
os.makedirs(os.path.join(OUT, 'panels'))
head = br.render(STILL, {}, scale=S)
F = br.FRAMES[STILL]
hb = head.crop((0, 0, head.width, PAD + (F['eyeCy'] + 150) * S)).getbbox()
hbox = square((PAD + (F['eyeCx'] - 150) * S, hb[1], PAD + (F['eyeCx'] + 150) * S, hb[3]), 0)
face = cut(head, hbox, 84)
for words in PANELS:
    im = Image.new('RGBA', (320, 100), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((6, 6, 319, 99), 14, fill=INK)                 # the hard shadow
    d.rounded_rectangle((0, 0, 312, 92), 14, fill=BANANA + (255,), outline=INK, width=4)
    im.alpha_composite(face, (6, 6))
    f = font(34)
    while d.textlength(words, font=f) > 196:
        f = font(f.size - 2)
    d.text((202, 46), words, font=f, fill=INK, anchor='mm')
    im.save(os.path.join(OUT, 'panels', words.lower().replace(' ', '-') + '-320x100.png'), optimize=True)
    print('panel', words)

# ── the preview: every emote on a chat-dark board, at a size a shop listing shows ─────────────────────────────
pv = Image.new('RGB', (2000, 2000), (24, 24, 30))
d = ImageDraw.Draw(pv)
outlined(d, (1000, 150), 'OFFICIAL DANCING BANANA', font(96), fill=BANANA, sw=8, shadow=0)
d.text((1000, 265), 'EMOTES  ·  SUB BADGES  ·  ALERTS  ·  SCENES  ·  PANELS', font=font(38), fill=(255, 255, 255), anchor='mm')
for k, (name, _, _) in enumerate(EMOTES):
    fr, sbx, _, eff = emote_stills[name]
    x, y = 170 + (k % 4) * 440, 390 + (k // 4) * 520
    tile = cut(fr[STILL], sbx, 330, eff, 0)
    pv.paste(tile, (x - 65, y), tile)
    d.text((x + 100, y + 380), ':' + name + ':', font=font(40), fill=(200, 200, 215), anchor='mm')
d.text((1000, 1930), 'the dancing banana, by Trym Stene, since 1999', font=font(34), fill=(150, 150, 165), anchor='mm')
pv.save(os.path.join(OUT, 'preview-emotes-2000.png'), optimize=True)

# ── two more listing pictures: the badges and the panels, and the three scene screens ───────────────────────
pv = Image.new('RGB', (2000, 2000), (24, 24, 30))
d = ImageDraw.Draw(pv)
outlined(d, (1000, 140), 'SUB BADGES & PANELS', font(96), fill=BANANA, sw=8, shadow=0)
for k, (name, _) in enumerate(BADGES):
    b = Image.open(os.path.join(OUT, 'sub-badges', name + '-72.png')).resize((216, 216), Image.Resampling.NEAREST)
    x = 130 + k * 300
    pv.paste(b, (x, 300), b)
    d.text((x + 108, 560), name.split('-')[0].lstrip('0') + (' MONTH' if name.startswith('01') else ' MONTHS'), font=font(30), fill=(200, 200, 215), anchor='mm')
for k, words in enumerate(PANELS):
    p = Image.open(os.path.join(OUT, 'panels', words.lower().replace(' ', '-') + '-320x100.png')).resize((640, 200), Image.Resampling.LANCZOS)
    pv.paste(p, (330 + (k % 2) * 700, 700 + (k // 2) * 330), p)
pv.save(os.path.join(OUT, 'preview-badges-panels-2000.png'), optimize=True)

pv = Image.new('RGB', (2000, 2000), (24, 24, 30))
d = ImageDraw.Draw(pv)
outlined(d, (1000, 140), 'STREAM SCENES', font(96), fill=BANANA, sw=8, shadow=0)
for k, (name, _) in enumerate(SCENES):
    sc = Image.open(os.path.join(OUT, 'scenes', name + '-1920x1080.png')).resize((880, 495), Image.Resampling.LANCZOS)
    x, y = (70, 330) if k == 0 else (1050, 330) if k == 1 else (560, 980)
    d.rectangle((x - 8, y - 8, x + 888, y + 503), fill=INK)
    pv.paste(sc, (x, y))
d.text((1000, 1800), 'Starting soon  ·  Be right back  ·  Thanks for watching  ·  1920 × 1080', font=font(40), fill=(200, 200, 215), anchor='mm')
pv.save(os.path.join(OUT, 'preview-scenes-2000.png'), optimize=True)

README = """THE OFFICIAL DANCING BANANA - STREAM PACK
==========================================
The dancing banana, by Trym Stene, the artist who made it in 1999.

EMOTES (emotes/<name>/)
  twitch-112.png, twitch-56.png, twitch-28.png            still emote, the three sizes Twitch asks for
  twitch-animated-112.gif, -56.gif, -28.gif               animated emote (8 frames, loops)
  discord-128.png, discord-animated-128.gif               for Discord
  dance, hype, love, cool, lol, gg, rip, evil, gn, gm, vibe, shiny

SUB BADGES (sub-badges/)
  01, 02, 03, 06, 09 and 12 months, each at 72, 36 and 18 px - the banana dresses up the longer they stay.

ALERTS (alerts/)
  follow-500.gif, subscribe-500.gif, raid-500.gif         transparent, loops; add your own text in your alert tool
  dancing-banana-600.gif                                  the classic dance on its own, for any scene

SCENES (scenes/, 1920 x 1080)
  starting-soon, be-right-back, stream-ending             put dancing-banana-600.gif over them for a dancing banana

PANELS (panels/, 320 x 100)
  about-me, schedule, discord, support, rules, socials

LICENCE
  For use on your own streams and channels (Twitch, YouTube, Kick, Discord and the like).
  Do not resell, share or redistribute the files, and do not use them in a logo or trademark.
  (c) Trym Stene. The dancing banana - trymstene.com
"""
with open(os.path.join(OUT, 'README.txt'), 'w', encoding='utf-8', newline='\r\n') as fh:
    fh.write(README)

# ── the zips a shop sells: the whole pack, and the smaller listings that lead to it (each carries the licence) ──
import zipfile  # noqa: E402

SHOP = os.path.join(HERE, 'out', 'shop')
os.makedirs(SHOP, exist_ok=True)
for fn in os.listdir(SHOP):
    os.remove(os.path.join(SHOP, fn))
PARTS = {
    'official-dancing-banana-stream-pack.zip': lambda rel: not rel.startswith('preview-'),
    'official-dancing-banana-emote-pack.zip': lambda rel: rel.startswith('emotes/') or rel == 'README.txt',
    'official-dancing-banana-sub-badges.zip': lambda rel: rel.startswith('sub-badges/') or rel == 'README.txt',
    'official-dancing-banana-classic-emote.zip': lambda rel: rel.startswith('emotes/dance/') or rel == 'README.txt',
}
for zname, keep in PARTS.items():
    with zipfile.ZipFile(os.path.join(SHOP, zname), 'w', zipfile.ZIP_DEFLATED) as z:
        for root, _, files in os.walk(OUT):
            for fn in files:
                full = os.path.join(root, fn)
                rel = os.path.relpath(full, OUT).replace(os.sep, '/')
                if keep(rel):
                    z.write(full, rel)
    print('zip', zname, os.path.getsize(os.path.join(SHOP, zname)) // 1024, 'KB')
