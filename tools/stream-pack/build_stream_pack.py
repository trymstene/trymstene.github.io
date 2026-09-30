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

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

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
# ── the sub badges: a banana that dresses up the longer you stay, on a medal that climbs bronze → silver → gold ──
BADGES = [
    ('01-month', {}, 'bronze'),
    ('02-months', {'hat': 'party'}, 'bronze'),
    ('03-months', {'glasses': 'shades'}, 'silver'),
    ('06-months', {'hat': 'cowboy', 'glasses': 'shades'}, 'silver'),
    ('09-months', {'hat': 'crown'}, 'gold'),
    ('12-months', {'hat': 'pixelcrown', 'glasses': 'shades', 'extras': ['goldchain']}, 'gold'),
]
# the metals: (light, mid, dark, the rays' tint)
METAL = {
    'bronze': ((242, 196, 150), (186, 112, 52), (104, 54, 20), (222, 150, 88)),
    'silver': ((255, 255, 255), (200, 210, 222), (110, 122, 138), (232, 238, 246)),
    'gold': ((255, 246, 170), (246, 196, 40), (160, 104, 0), (255, 226, 110)),
}
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


# ── the banana at WHOLE pixels: cropped on its own 13-px art grid, resized once to exactly `px` an art pixel ────
CELL = br.PX


def grid_offset():
    sheet = br.sheet().load()
    xs = [x for x in range(br.FW) if any(sheet[x, y][3] > 0 for y in range(0, br.FH, 2))]
    ys = [y for y in range(br.FH) if any(sheet[x, y][3] > 0 for x in range(0, br.FW, 2))]
    return xs[0] % CELL, ys[0] % CELL


def grid_box(boxes):
    """the smallest box on the art grid round all of `boxes` (render space, scale 1)"""
    pad1 = br.pad_for(1)
    ox, oy = grid_offset()
    l, t = min(b[0] for b in boxes), min(b[1] for b in boxes)
    r, b = max(bb[2] for bb in boxes), max(bb[3] for bb in boxes)
    gx, gy = (pad1 + ox) % CELL, (pad1 + oy) % CELL
    x0 = gx + CELL * math.floor((l - gx) / CELL)
    y0 = gy + CELL * math.floor((t - gy) / CELL)
    return x0, y0, math.ceil((r - x0) / CELL), math.ceil((b - y0) / CELL)


def crisp_banana(idx, px):
    """one frame, its own box"""
    im = br.render(idx, {}, scale=1)
    x0, y0, cols, rows = grid_box([im.getbbox()])
    return im.crop((x0, y0, x0 + cols * CELL, y0 + rows * CELL)).resize((cols * px, rows * px), Image.Resampling.BOX)


def crisp_dance(px):
    """all eight frames in ONE box, so the feet stay on one line and nothing slides while it dances"""
    ims = [br.render(i, {}, scale=1) for i in range(br.NFRAMES)]
    x0, y0, cols, rows = grid_box([im.getbbox() for im in ims])
    return [im.crop((x0, y0, x0 + cols * CELL, y0 + rows * CELL)).resize((cols * px, rows * px), Image.Resampling.BOX) for im in ims]


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
# ⚠️ THE HEAD, NOT A SQUARE ROUND THE FACE. A square wide enough for the hat took in the arms too, and at badge size they
# were hooks in the corners. Now: as wide as the hat and the face (never the eye-high gloves), down to under the grin,
# and only the shapes that belong to the head (a stub of arm that runs in from outside is a separate little shape).
def only_head(img):
    w, h = img.size
    a = img.getchannel('A').load()
    seen = bytearray(w * h)
    comps = []
    for y0 in range(h):
        for x0 in range(w):
            if a[x0, y0] < 96 or seen[y0 * w + x0]:
                continue
            stack, pts = [(x0, y0)], []
            seen[y0 * w + x0] = 1
            while stack:
                x, y = stack.pop()
                pts.append((x, y))
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and a[nx, ny] >= 96:
                            seen[ny * w + nx] = 1
                            stack.append((nx, ny))
            comps.append(pts)
    big = max(len(c) for c in comps)
    out = Image.new('RGBA', img.size, (0, 0, 0, 0))
    src, dst = img.load(), out.load()
    for c in comps:
        if len(c) >= big * 0.02:
            for x, y in c:
                dst[x, y] = src[x, y]
    return out


def badge_art(outfit, idx=2, below=88):
    """the head, square, on transparency, at the render's size (frame 2: facing you)"""
    f = br.render(idx, outfit, scale=S)
    F = br.FRAMES[idx]
    top = f.getbbox()[1]
    bottom = PAD + (F['eyeCy'] + below) * S
    hb = f.crop((0, top, f.width, PAD + (F['eyeCy'] - 45) * S)).getbbox()   # the hat and the crown of the head
    l, r = hb[0] - 6 * S, hb[2] + 6 * S
    x0 = PAD + (F['eyeCx'] - 70) * S
    fb = f.crop((x0, PAD + (F['eyeCy'] - 30) * S, PAD + (F['eyeCx'] + 70) * S, PAD + (F['eyeCy'] + 30) * S)).getbbox()
    if fb:   # the face and whatever sits on it (shades reach past a bare head)
        l, r = min(l, x0 + fb[0] - 4 * S), max(r, x0 + fb[2] + 4 * S)
    part = only_head(f.crop((l, top, r, bottom)))
    side = max(part.width, part.height)
    sq = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    sq.alpha_composite(part, ((side - part.width) // 2, side - part.height))
    return sq


# ── the finish that makes it look like it cost something (Trym: "it has to actually look a little expensive") ──
def lerp(c1, c2, t):
    return tuple(round(a + (b - a) * t) for a, b in zip(c1, c2))


def vgrad(size, top, bottom):
    w, h = size
    g = Image.new('RGBA', size)
    d = ImageDraw.Draw(g)
    for y in range(h):
        d.line((0, y, w, y), fill=lerp(top, bottom, y / max(1, h - 1)) + (255,))
    return g


def ray_layer(size, cx, cy, n, col, start=0.0):
    """the scene screens' rays as a transparent layer: every other wedge of n, in col"""
    w, h = size
    m = Image.new('L', size, 0)
    d = ImageDraw.Draw(m)
    R = math.hypot(w, h) * 2
    for k in range(n):
        a0 = start + 2 * math.pi * k / n
        a1 = a0 + math.pi / n
        d.polygon([(cx, cy), (cx + R * math.cos(a0), cy + R * math.sin(a0)), (cx + R * math.cos(a1), cy + R * math.sin(a1))], fill=255)
    layer = Image.new('RGBA', size, col)
    layer.putalpha(m)
    return layer


def sparkle(d, cx, cy, r, col=(255, 255, 255, 255)):
    """a four-point star: the glint on something precious"""
    t = r * 0.22
    d.polygon([(cx, cy - r), (cx + t, cy - t), (cx + r, cy), (cx + t, cy + t), (cx, cy + r), (cx - t, cy + t),
               (cx - r, cy), (cx - t, cy - t)], fill=col)


# ⭐ THE BADGE IS A MEDAL (Trym, 29 Sep: "the badges needs the same stripey shade … like the stream scenes have …
# maybe just a glare … to make them less plain"). A rim lit from above, the scenes' rays in the face, a bevel, the
# banana's head as the bust, a soft glare and a glint. The metal says how long they have stayed; at 18 px a bright
# coin reads better than a narrow head ever did.
def medallion(head, metal, N=288):
    light, mid, dark, ray = METAL[metal]
    im = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    c = N / 2

    def disc(r):
        m = Image.new('L', (N, N), 0)
        ImageDraw.Draw(m).ellipse((c - r, c - r, c + r, c + r), fill=255)
        return m

    R = N / 2 - 3
    im.paste(INK, mask=disc(R))                                   # the ink outline
    im.paste(vgrad((N, N), light, dark), mask=disc(R - 5))         # the rim, lit from above
    inner = R - 5 - N * 0.075
    face = vgrad((N, N), mid, lerp(mid, dark, 0.55))
    face.alpha_composite(ray_layer((N, N), c, c * 1.05, 16, ray + (150,), start=-math.pi / 2))
    im.paste(face, mask=disc(inner))
    groove = Image.new('L', (N, N), 0)                             # the bevel between rim and face
    ImageDraw.Draw(groove).ellipse((c - inner - 2, c - inner - 2, c + inner + 2, c + inner + 2), outline=255, width=3)
    im.paste(dark + (255,), mask=groove)
    k = (inner * 1.62) / max(head.size)                            # the bust, standing on the face's lower rim
    bust = head.resize((max(1, round(head.width * k)), max(1, round(head.height * k))), Image.Resampling.BOX)
    bust = edge(bust, 3)
    layer = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    layer.alpha_composite(bust, (round(c - bust.width / 2), round(c + inner * 0.92 - bust.height)))
    layer.putalpha(ImageChops.multiply(layer.getchannel('A'), disc(inner)))
    im.alpha_composite(layer)
    glare = Image.new('L', (N, N), 0)                              # a soft crescent of light, upper left
    gl = ImageDraw.Draw(glare)
    gl.ellipse((c - R * 0.86, c - R * 0.9, c + R * 0.5, c + R * 0.2), fill=110)
    gl.ellipse((c - R * 0.74, c - R * 0.72, c + R * 0.66, c + R * 0.42), fill=0)
    glare = ImageChops.multiply(glare.filter(ImageFilter.GaussianBlur(N / 90)), disc(R - 5))
    im.paste((255, 255, 255, 255), mask=glare)
    sparkle(ImageDraw.Draw(im), c + R * 0.62, c - R * 0.58, N * 0.07)
    return im


badge_arts = {}
for name, outfit, metal in BADGES:
    d = os.path.join(OUT, 'sub-badges')
    os.makedirs(d, exist_ok=True)
    art = badge_arts[name] = medallion(badge_art(outfit), metal)
    for size in (72, 36, 18):
        art.resize((size, size), Image.Resampling.LANCZOS).save(os.path.join(d, '%s-%d.png' % (name, size)), optimize=True)
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


# ⭐ THE SCENES GET THE MEDALS' FINISH (Trym, 29 Sep: "the scenes need the same premium treatment too"): a spotlit
# stage (a radial glow and a vignette), rays that fade out from behind the banana, confetti and glints, the title
# on the panels' lacquered sign, and the banana at whole pixels with its white edge and a soft shadow at its feet.
# Each scene comes twice: with the banana, and as an empty STAGE for the full-screen dancing overlay (OBS), which
# dances in exactly the spot the still banana stands.
SCENES = [('starting-soon', 'STARTING SOON'), ('be-right-back', 'BE RIGHT BACK'), ('stream-ending', 'THANKS FOR WATCHING')]
SW, SH = 1920, 1080
SPOT = (960, 690)          # the light's centre: behind the banana's chest
FLOOR = 1012               # where its feet stand
SCENE_PX = 16              # scene px an art pixel


def radial(size, cx, cy, stops, small=8):
    """a smooth radial gradient: computed small, scaled up (a per-pixel loop at full HD is needlessly slow)"""
    w, h = size[0] // small, size[1] // small
    g = Image.new('RGB', (w, h))
    px = g.load()
    far = math.hypot(max(cx, size[0] - cx), max(cy, size[1] - cy)) / small
    for y in range(h):
        for x in range(w):
            t = min(1.0, math.hypot(x - cx / small, y - cy / small) / far)
            for (t0, c0), (t1, c1) in zip(stops, stops[1:]):
                if t <= t1:
                    px[x, y] = lerp(c0, c1, (t - t0) / max(1e-6, t1 - t0))
                    break
    return g.resize(size, Image.Resampling.BICUBIC).convert('RGBA')


def fade_mask(size, cx, cy, r0, r1, peak=255, small=8):
    """alpha that is `peak` inside r0 and fades to nothing at r1"""
    w, h = size[0] // small, size[1] // small
    m = Image.new('L', (w, h))
    px = m.load()
    for y in range(h):
        for x in range(w):
            r = math.hypot(x * small - cx, y * small - cy)
            px[x, y] = round(peak * max(0.0, min(1.0, (r1 - r) / (r1 - r0))))
    return m.resize(size, Image.Resampling.BICUBIC)


def sign(words, fsize=132):
    """the panels' lacquered sign, scene size: ink border, hard shadow, lit and shaded lips, glare, glint"""
    f = font(fsize)
    probe = ImageDraw.Draw(Image.new('RGBA', (10, 10)))
    while True:
        bb = probe.textbbox((0, 0), words, font=f, anchor='ls', stroke_width=10)
        if bb[2] - bb[0] <= 1560 or f.size <= 40:
            break
        f = font(f.size - 4)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    pw, ph = tw + 150, th + 96
    bd, rad, sh = 9, 34, 16
    im = Image.new('RGBA', (pw + sh + 4, ph + sh + 4), (0, 0, 0, 0))

    def rr(box, r, inset=0):
        m = Image.new('L', im.size, 0)
        ImageDraw.Draw(m).rounded_rectangle((box[0] + inset, box[1] + inset, box[2] - inset, box[3] - inset), max(1, r - inset), fill=255)
        return m

    card = (2, 2, 2 + pw, 2 + ph)
    im.paste(INK, mask=rr((card[0] + sh, card[1] + sh, card[2] + sh, card[3] + sh), rad))
    im.paste(INK, mask=rr(card, rad))
    face = vgrad(im.size, (255, 230, 70), (245, 192, 0))
    lip = Image.new('L', im.size, 0)
    ImageDraw.Draw(lip).rectangle((0, card[1] + bd, im.width, card[1] + bd + 8), fill=200)
    face.paste((255, 252, 225, 255), mask=lip)
    lip = Image.new('L', im.size, 0)
    ImageDraw.Draw(lip).rectangle((0, card[3] - bd - 13, im.width, card[3] - bd), fill=255)
    face.paste((226, 168, 0, 255), mask=lip)
    gl = Image.new('L', im.size, 0)
    g = ImageDraw.Draw(gl)
    for x, w, a in ((int(pw * 0.62), 70, 70), (int(pw * 0.62) + 95, 22, 95)):
        g.polygon([(x, card[3]), (x + w, card[3]), (x + w + ph * 0.7, card[1]), (x + ph * 0.7, card[1])], fill=a)
    face.paste((255, 255, 255, 255), mask=gl.filter(ImageFilter.GaussianBlur(3)))
    im.paste(face, mask=rr(card, rad, bd))
    d = ImageDraw.Draw(im)
    x = round(card[0] + pw / 2 - tw / 2 - bb[0])
    y = round(card[1] + (ph - 13) / 2 - th / 2 - bb[1] + 4)
    d.text((x + 9, y + 9), words, font=f, fill=INK, anchor='ls', stroke_width=10, stroke_fill=INK)
    d.text((x, y), words, font=f, fill=(255, 255, 255), anchor='ls', stroke_width=10, stroke_fill=INK)
    sparkle(d, card[2] - 46, card[1] + 34, 20)
    return im


def stage(words):
    """the scene without its banana: the light, the rays, the confetti, the title, the shadow on the floor"""
    im = radial((SW, SH), SPOT[0], SPOT[1], [(0.0, (255, 250, 214)), (0.34, (255, 226, 60)), (0.75, (248, 200, 10)), (1.0, (222, 160, 0))])
    rl = ray_layer((SW, SH), SPOT[0], SPOT[1], 28, (255, 252, 225, 255), start=-math.pi / 2 + 0.05)
    rl.putalpha(ImageChops.multiply(rl.getchannel('A'), fade_mask((SW, SH), SPOT[0], SPOT[1], 120, 1150, 150)))
    im.alpha_composite(rl)
    halo = Image.new('L', (SW, SH), 0)
    ImageDraw.Draw(halo).ellipse((SPOT[0] - 360, SPOT[1] - 330, SPOT[0] + 360, SPOT[1] + 330), fill=175)
    im.paste((255, 253, 235, 255), mask=halo.filter(ImageFilter.GaussianBlur(70)))
    d = ImageDraw.Draw(im)
    # the builder's own confetti colours, squares and strips, scattered by a fixed hand (the same every build)
    cols = [(255, 77, 109), (77, 184, 255), (242, 194, 0), (55, 214, 122), (179, 136, 255)]
    for k in range(46):
        x = (k * 397 + 131) % SW
        y = (k * 211 + 57) % 900
        if abs(x - SPOT[0]) < 330 and y > 380:
            continue                                     # never on the banana
        s = 14 + (k * 7) % 12
        hgt = s if k % 3 else int(s * 1.7)
        d.rectangle((x, y, x + s - 1, y + hgt - 1), fill=cols[k % 5] + (255,))
    for k in range(9):                                   # glints
        x, y = (k * 523 + 210) % SW, (k * 277 + 330) % 1000
        if abs(x - SPOT[0]) < 330 and y > 380:
            continue
        sparkle(d, x, y, 14 + (k * 5) % 16)
    sh = Image.new('L', (SW, SH), 0)                     # the shadow at its feet
    ImageDraw.Draw(sh).ellipse((SPOT[0] - 230, FLOOR - 26, SPOT[0] + 230, FLOOR + 30), fill=95)
    im.paste((120, 70, 0, 255), mask=sh.filter(ImageFilter.GaussianBlur(14)))
    s = sign(words)
    im.alpha_composite(s, ((SW - s.width) // 2 + 8, 70))
    return im


os.makedirs(os.path.join(OUT, 'scenes'))
dance = [edge(f, 6) for f in crisp_dance(SCENE_PX)]
DX = SPOT[0] - dance[0].width // 2
DY = FLOOR + 14 - dance[0].height                         # the white edge's bottom sits just under the floor line
for name, words in SCENES:
    st = stage(words)
    st.convert('RGB').save(os.path.join(OUT, 'scenes', name + '-stage-1920x1080.png'), optimize=True)
    full = st.copy()
    full.alpha_composite(dance[7], (DX, DY))
    full.convert('RGB').save(os.path.join(OUT, 'scenes', name + '-1920x1080.png'), optimize=True)
    print('scene', name)
# the overlay: the whole frame, transparent but for the banana dancing on the stage's spot
overlay = []
for f in dance:
    o = Image.new('RGBA', (SW, SH), (0, 0, 0, 0))
    o.alpha_composite(f, (DX, DY))
    overlay.append(o)
save_gif(overlay, os.path.join(OUT, 'scenes', 'dancing-banana-overlay-1920x1080.gif'))
print('overlay', os.path.getsize(os.path.join(OUT, 'scenes', 'dancing-banana-overlay-1920x1080.gif')) // 1024, 'KB')

# ── panels, 320×150: a lacquered sign with the whole banana standing on it ─────────────────────────────────────
# ⚠️ Trym, on the first ones: "the banana hand is cut off, and the banner text doesnt look horizontally centered
# properly - could use some more texture and quality overall, they look very plain". So: the WHOLE banana (a face
# crop sliced its arm), each panel a different frame of the dance, drawn at exactly 3 px an art pixel (crisp); the
# scenes' rays shining from behind it, a lit lip and a shaded lip, a glare, a glint; the word centred on its own INK
# (Pillow's anchor centres the font box), all six at ONE size; the site's ink border and hard shadow, and a white
# edge round the lot so Twitch's dark page does not swallow the border.
PANELS = [('ABOUT ME', 2), ('SCHEDULE', 3), ('DISCORD', 6), ('SUPPORT', 7), ('RULES', 1), ('SOCIALS', 5)]
PW, PH = 320, 150
CARD = (6, 52, 306, 138)
COL, BORDER, RADIUS, SHADOW = 118, 4, 14, 6


def rmask(box, radius, inset=0):
    m = Image.new('L', (PW, PH), 0)
    x0, y0, x1, y1 = box
    ImageDraw.Draw(m).rounded_rectangle((x0 + inset, y0 + inset, x1 - inset, y1 - inset), max(1, radius - inset), fill=255)
    return m


REGION = (CARD[0] + COL + 8, CARD[2] - BORDER - 10)   # where the word goes: right of the banana


def panel_font():
    """one size for all six: the largest that fits the longest word"""
    d = ImageDraw.Draw(Image.new('RGBA', (PW, PH)))
    size = 36
    while size > 14:
        f = font(size)
        if all(d.textbbox((0, 0), w, font=f, anchor='ls', stroke_width=3)[2] - d.textbbox((0, 0), w, font=f, anchor='ls', stroke_width=3)[0]
               <= REGION[1] - REGION[0] for w, _ in PANELS):
            return f
        size -= 1
    return font(size)


def panel(words, idx, f):
    im = Image.new('RGBA', (PW, PH), (0, 0, 0, 0))
    im.paste(INK, mask=rmask((CARD[0] + SHADOW, CARD[1] + SHADOW, CARD[2] + SHADOW, CARD[3] + SHADOW), RADIUS))
    im.paste(INK, mask=rmask(CARD, RADIUS))
    bcx = CARD[0] + COL // 2 + 4
    face = vgrad((PW, PH), (255, 225, 53), (245, 196, 0))
    face.alpha_composite(ray_layer((PW, PH), bcx, CARD[3] - 20, 22, (255, 244, 170, 200), start=-math.pi / 2 + 0.07))
    halo = Image.new('L', (PW, PH), 0)
    ImageDraw.Draw(halo).ellipse((bcx - 70, CARD[1] - 20, bcx + 70, CARD[3] + 40), fill=150)
    face.paste((255, 250, 215, 255), mask=halo.filter(ImageFilter.GaussianBlur(18)))
    lip = Image.new('L', (PW, PH), 0)
    ImageDraw.Draw(lip).rectangle((0, CARD[1] + BORDER, PW, CARD[1] + BORDER + 3), fill=190)
    face.paste((255, 252, 225, 255), mask=lip)
    lip = Image.new('L', (PW, PH), 0)
    ImageDraw.Draw(lip).rectangle((0, CARD[3] - BORDER - 5, PW, CARD[3] - BORDER), fill=255)
    face.paste((226, 170, 0, 255), mask=lip)
    gl = Image.new('L', (PW, PH), 0)
    g = ImageDraw.Draw(gl)
    for x, w, a in ((196, 22, 70), (226, 7, 90)):
        g.polygon([(x, CARD[3]), (x + w, CARD[3]), (x + w + 60, CARD[1]), (x + 60, CARD[1])], fill=a)
    face.paste((255, 255, 255, 255), mask=gl.filter(ImageFilter.GaussianBlur(1.2)))
    im.paste(face, mask=rmask(CARD, RADIUS, BORDER))
    ban = edge(crisp_banana(idx, 3), 2)
    im.alpha_composite(ban, (bcx - ban.width // 2, max(0, CARD[3] - BORDER - 5 - ban.height + 3)))
    d = ImageDraw.Draw(im)
    bb = d.textbbox((0, 0), words, font=f, anchor='ls', stroke_width=3)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    x = round((REGION[0] + REGION[1]) / 2 - tw / 2 - bb[0])
    y = round((CARD[1] + BORDER + CARD[3] - BORDER - 5) / 2 - th / 2 - bb[1])
    d.text((x + 3, y + 3), words, font=f, fill=INK, anchor='ls', stroke_width=3, stroke_fill=INK)
    d.text((x, y), words, font=f, fill=(255, 255, 255), anchor='ls', stroke_width=3, stroke_fill=INK)
    sparkle(d, CARD[2] - 22, CARD[1] + 14, 7)
    return edge(im, 2)


os.makedirs(os.path.join(OUT, 'panels'))
pf = panel_font()
for words, idx in PANELS:
    panel(words, idx, pf).save(os.path.join(OUT, 'panels', words.lower().replace(' ', '-') + '-320x150.png'), optimize=True)
    print('panel', words)

# ── the preview: every emote on a chat-dark board, at a size a shop listing shows ─────────────────────────────
# ⚠️ ONE PICTURE PER LISTING, SAYING ONLY WHAT THAT LISTING SELLS: the emote board's line names the whole pack, so the
# emote pack gets the same board with its own line, and the badges and the classic emote get boards of their own
def emote_board(line, path):
    pv = Image.new('RGB', (2000, 2000), (24, 24, 30))
    d = ImageDraw.Draw(pv)
    outlined(d, (1000, 150), 'OFFICIAL DANCING BANANA', font(96), fill=BANANA, sw=8, shadow=0)
    d.text((1000, 265), line, font=font(38), fill=(255, 255, 255), anchor='mm')
    for k, (name, _, _) in enumerate(EMOTES):
        fr, sbx, _, eff = emote_stills[name]
        x, y = 170 + (k % 4) * 440, 390 + (k // 4) * 520
        tile = cut(fr[STILL], sbx, 330, eff, 0)
        pv.paste(tile, (x - 65, y), tile)
        d.text((x + 100, y + 380), ':' + name + ':', font=font(40), fill=(200, 200, 215), anchor='mm')
    d.text((1000, 1930), 'the dancing banana, by Trym Stene, since 1999', font=font(34), fill=(150, 150, 165), anchor='mm')
    pv.save(os.path.join(OUT, path), optimize=True)


emote_board('EMOTES  ·  SUB BADGES  ·  ALERTS  ·  SCENES  ·  PANELS', 'preview-emotes-2000.png')
emote_board('12 EMOTES  ·  STILL + ANIMATED  ·  TWITCH + DISCORD', 'preview-emote-pack-2000.png')

# the sub badges on their own: six, big, with the months under them
pv = Image.new('RGB', (2000, 2000), (24, 24, 30))
d = ImageDraw.Draw(pv)
outlined(d, (1000, 150), 'OFFICIAL DANCING BANANA', font(96), fill=BANANA, sw=8, shadow=0)
d.text((1000, 265), '6 SUB BADGES  ·  1 TO 12 MONTHS  ·  TWITCH', font=font(38), fill=(255, 255, 255), anchor='mm')
for k, (name, _, _) in enumerate(BADGES):
    tile = badge_arts[name].resize((420, 420), Image.Resampling.LANCZOS)
    x, y = 150 + (k % 3) * 600, 420 + (k // 3) * 700
    pv.paste(tile, (x, y), tile)
    months = int(name.split('-')[0])
    d.text((x + 210, y + 500), '%d MONTH%s' % (months, '' if months == 1 else 'S'), font=font(44), fill=(200, 200, 215), anchor='mm')
d.text((1000, 1930), 'the dancing banana, by Trym Stene, since 1999', font=font(34), fill=(150, 150, 165), anchor='mm')
pv.save(os.path.join(OUT, 'preview-sub-badges-2000.png'), optimize=True)

# the classic emote on its own: the whole dancing banana big (a close-up cut an arm off at this size), then what the
# buyer actually gets, the still emote and the eight frames of the animated one
pv = Image.new('RGB', (2000, 2000), (24, 24, 30))
d = ImageDraw.Draw(pv)
outlined(d, (1000, 150), 'THE CLASSIC DANCING BANANA', font(96), fill=BANANA, sw=8, shadow=0)
d.text((1000, 265), 'ANIMATED + STILL EMOTE  ·  TWITCH + DISCORD', font=font(38), fill=(255, 255, 255), anchor='mm')
fr, sbx, abx, _ = emote_stills['dance']
whole = fr[7].crop(fr[7].getbbox())
h = 860
whole = whole.resize((round(whole.width * h / whole.height), h), Image.Resampling.BOX)
pv.paste(whole, ((2000 - whole.width) // 2, 340), whole)
still = cut(fr[STILL], sbx, 230, None, 0)
pv.paste(still, (60, 1330), still)
for i, f in enumerate(fr):
    t = cut(f, abx, 190, None, i)
    pv.paste(t, (340 + i * 205, 1350), t)
d.text((175, 1600), 'still', font=font(36), fill=(200, 200, 215), anchor='mm')
d.text((1160, 1600), 'animated: it dances in chat', font=font(36), fill=(200, 200, 215), anchor='mm')
d.text((1000, 1720), '112 · 56 · 28 px for Twitch  ·  128 px for Discord', font=font(40), fill=(255, 255, 255), anchor='mm')
d.text((1000, 1930), 'the dancing banana, by Trym Stene, since 1999', font=font(34), fill=(150, 150, 165), anchor='mm')
pv.save(os.path.join(OUT, 'preview-classic-emote-2000.png'), optimize=True)

# ── two more listing pictures: the badges and the panels, and the three scene screens ───────────────────────
pv = Image.new('RGB', (2000, 2000), (24, 24, 30))
d = ImageDraw.Draw(pv)
outlined(d, (1000, 140), 'SUB BADGES & PANELS', font(96), fill=BANANA, sw=8, shadow=0)
for k, (name, _, _) in enumerate(BADGES):
    b = badge_arts[name].resize((216, 216), Image.Resampling.LANCZOS)
    x = 130 + k * 300
    pv.paste(b, (x, 300), b)
    d.text((x + 108, 565), name.split('-')[0].lstrip('0') + (' MONTH' if name.startswith('01') else ' MONTHS'), font=font(30), fill=(200, 200, 215), anchor='mm')
for k, (words, _) in enumerate(PANELS):
    p = Image.open(os.path.join(OUT, 'panels', words.lower().replace(' ', '-') + '-320x150.png'))
    p = p.resize((p.width * 2, p.height * 2), Image.Resampling.NEAREST)   # 2x exactly: the banana's pixels stay whole
    pv.paste(p, (340 + (k % 2) * 680, 700 + (k // 2) * 390), p)
d.text((1000, 1930), 'the dancing banana, by Trym Stene, since 1999', font=font(34), fill=(150, 150, 165), anchor='mm')
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

# ── the shop's own face: its icon and its banner ──────────────────────────────────────────────────────────────
# ⚠️ ETSY SHOWS THE ICON ROUND. The first one was a face close-up, and the round crop took both hands (Trym: "the logo
# has his arms cut off"). Now the WHOLE banana, arms up (frame 7), as big as the smallest circle round every one of its
# pixels allows, that circle 93 % of the icon's: hands and shoes whole, nothing cut.
SHOPART = os.path.join(HERE, 'out', 'shop-art')
os.makedirs(SHOPART, exist_ok=True)


def smallest_circle(pts):
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    best = None
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    best = (max(math.hypot(x - cx, y - cy) for x, y in pts), cx, cy)
    step = (max(xs) - min(xs)) / 8
    while step > 0.5:
        moved = True
        while moved:
            moved = False
            for dx, dy in ((step, 0), (-step, 0), (0, step), (0, -step)):
                nx, ny = best[1] + dx, best[2] + dy
                r = max(math.hypot(x - nx, y - ny) for x, y in pts)
                if r < best[0]:
                    best, moved = (r, nx, ny), True
        step /= 2
    return best


f = br.render(7, {}, scale=S)
crop = f.crop(f.getbbox())
alpha = crop.getchannel('A').load()
r, ccx, ccy = smallest_circle([(x, y) for y in range(0, crop.height, 3) for x in range(0, crop.width, 3) if alpha[x, y] > 0])
k = 500 * 0.93 / r
sm = crop.resize((round(crop.width * k), round(crop.height * k)), Image.Resampling.BOX)
icon = Image.new('RGBA', (1000, 1000), HOT + (255,))
icon.alpha_composite(sm, (round(500 - ccx * k), round(500 - ccy * k)))
icon.convert('RGB').save(os.path.join(SHOPART, 'shop-icon-1000.png'), optimize=True)
ban = rays(3360, 840, 1680, 1400, 28).convert('RGBA')
d = ImageDraw.Draw(ban)
outlined(d, (1680, 350), 'THE OFFICIAL DANCING BANANA', font(128), sw=10, shadow=8)
d.text((1680, 510), 'BY TRYM STENE  ·  SINCE 1999', font=font(60), fill=INK, anchor='mm')
crew = [{}, {'hat': 'party'}, {'hat': 'crown', 'glasses': 'shades'}, {'glasses': 'hearts'}]
for k, o in enumerate(crew):
    fr = br.render([2, 3, 6, 7][k], o, scale=S)
    bb = fr.getbbox()
    b = Image.new('RGBA', (bb[2] - bb[0], bb[3] - bb[1]))
    b.alpha_composite(fr.crop(bb))
    h = 470
    b = b.resize((round(b.width * h / b.height), h), Image.Resampling.BOX)
    x = [170, 440, 3190, 2920][k] - b.width // 2
    ban.alpha_composite(b, (x, 840 - h - 30))
ban.convert('RGB').save(os.path.join(SHOPART, 'shop-banner-3360x840.png'), optimize=True)

# ── what each download says it holds: a README per zip, listing only what is in THAT zip ─────────────────────
# ⚠️ one README for every zip had the single emote's buyer reading about twelve emotes, alerts and scenes they never got
TXT = {
    'emotes': """EMOTES (emotes/<name>/)
  twitch-112.png, twitch-56.png, twitch-28.png            still emote, the three sizes Twitch asks for
  twitch-animated-112.gif, -56.gif, -28.gif               animated emote (8 frames, loops)
  discord-128.png, discord-animated-128.gif               for Discord
  dance, hype, love, cool, lol, gg, rip, evil, gn, gm, vibe, shiny
""",
    'classic': """THE CLASSIC DANCE (emotes/dance/)
  twitch-112.png, twitch-56.png, twitch-28.png            still emote, the three sizes Twitch asks for
  twitch-animated-112.gif, -56.gif, -28.gif               animated emote (8 frames, loops)
  discord-128.png, discord-animated-128.gif               for Discord
""",
    'badges': """SUB BADGES (sub-badges/)
  01, 02, 03, 06, 09 and 12 months, each at 72, 36 and 18 px - bronze, silver and gold medals, and the banana
  dresses up the longer they stay.
""",
    'alerts': """ALERTS (alerts/)
  follow-500.gif, subscribe-500.gif, raid-500.gif         transparent, loops; add your own text in your alert tool
  dancing-banana-600.gif                                  the classic dance on its own, for any scene
""",
    'scenes': """SCENES (scenes/, 1920 x 1080)
  starting-soon, be-right-back, stream-ending             ready to use, with the banana
  ...-stage versions                                      the same scenes with an empty spotlight
  dancing-banana-overlay-1920x1080.gif                    lay it full screen over a stage scene (in OBS: an Image
                                                          source, fit to screen) and the banana dances in the light
""",
    'panels': """PANELS (panels/, 320 x 150)
  about-me, schedule, discord, support, rules, socials
""",
}
LICENCE = """LICENCE
  For use on your own streams and channels (Twitch, YouTube, Kick, Discord and the like).
  Do not resell, share or redistribute the files, and do not use them in a logo or trademark.
  (c) Trym Stene. The dancing banana - trymstene.com
"""


NL = chr(10)   # ⚠️ built, never typed: a shell heredoc once ate this file's backslashes (windows-shell-traps)


def readme(title, parts):
    head = title + NL + '=' * len(title) + NL + 'The dancing banana, by Trym Stene, the artist who made it in 1999.' + NL + NL
    return head + NL.join(TXT[p] for p in parts) + NL + LICENCE


def crlf(t):
    return t.replace(NL, chr(13) + NL)   # a README opened in Windows Notepad keeps its lines


FULL = ['emotes', 'badges', 'alerts', 'scenes', 'panels']
with open(os.path.join(OUT, 'README.txt'), 'w', encoding='utf-8', newline='') as fh:
    fh.write(crlf(readme('THE OFFICIAL DANCING BANANA - STREAM PACK', FULL)))

# ── the zips a shop sells: the whole pack, and the smaller listings that lead to it (each carries the licence) ──
import zipfile  # noqa: E402

SHOP = os.path.join(HERE, 'out', 'shop')
os.makedirs(SHOP, exist_ok=True)
for fn in os.listdir(SHOP):
    os.remove(os.path.join(SHOP, fn))
PARTS = {
    'official-dancing-banana-stream-pack.zip': ('THE OFFICIAL DANCING BANANA - STREAM PACK', FULL,
                                                lambda rel: not rel.startswith('preview-') and rel != 'README.txt'),
    'official-dancing-banana-emote-pack.zip': ('THE OFFICIAL DANCING BANANA - EMOTE PACK', ['emotes'],
                                               lambda rel: rel.startswith('emotes/')),
    'official-dancing-banana-sub-badges.zip': ('THE OFFICIAL DANCING BANANA - SUB BADGES', ['badges'],
                                               lambda rel: rel.startswith('sub-badges/')),
    'official-dancing-banana-classic-emote.zip': ('THE OFFICIAL DANCING BANANA - THE CLASSIC EMOTE', ['classic'],
                                                  lambda rel: rel.startswith('emotes/dance/')),
}
for zname, (title, parts, keep) in PARTS.items():
    with zipfile.ZipFile(os.path.join(SHOP, zname), 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('README.txt', crlf(readme(title, parts)))
        for root, _, files in os.walk(OUT):
            for fn in files:
                full = os.path.join(root, fn)
                rel = os.path.relpath(full, OUT).replace(os.sep, '/')
                if keep(rel):
                    z.write(full, rel)
    print('zip', zname, os.path.getsize(os.path.join(SHOP, zname)) // 1024, 'KB')

# ── ONE FOLDER TO UPLOAD FROM (Trym: "give me the full folder path so i dont have to click around to find the
# files"): out/etsy/<n>-<listing>/ holds that listing's zip and its pictures, numbered in the order Etsy wants them
# (the first is the thumbnail), and shop-look/ holds the shop's icon and cover banner.
ETSY = os.path.join(HERE, 'out', 'etsy')
if os.path.isdir(ETSY):
    for fn in os.listdir(ETSY):
        p = os.path.join(ETSY, fn)
        shutil.rmtree(p) if os.path.isdir(p) else os.remove(p)
os.makedirs(ETSY, exist_ok=True)
LISTINGS = [
    ('1-full-stream-pack', 'official-dancing-banana-stream-pack.zip',
     ['preview-emotes-2000.png', 'preview-badges-panels-2000.png', 'preview-scenes-2000.png']),
    ('2-emote-pack', 'official-dancing-banana-emote-pack.zip', ['preview-emote-pack-2000.png']),
    ('3-sub-badges', 'official-dancing-banana-sub-badges.zip', ['preview-sub-badges-2000.png']),
    ('4-classic-emote', 'official-dancing-banana-classic-emote.zip', ['preview-classic-emote-2000.png']),
]
for folder, zname, pics in LISTINGS:
    d = os.path.join(ETSY, folder)
    os.makedirs(d)
    shutil.copy2(os.path.join(SHOP, zname), os.path.join(d, zname))
    for n, pic in enumerate(pics, 1):
        shutil.copy2(os.path.join(OUT, pic), os.path.join(d, 'photo-%d-%s' % (n, pic)))
look = os.path.join(ETSY, 'shop-look')
os.makedirs(look)
for fn in ('shop-icon-1000.png', 'shop-banner-3360x840.png'):
    shutil.copy2(os.path.join(SHOPART, fn), os.path.join(look, fn))
print('etsy folder', ETSY)

# ── the shop's About section: the eight original frames on the stage's light, and Trym's own photos from the site ──
ABOUT = os.path.join(ETSY, 'about-photos')
os.makedirs(ABOUT)
pic = radial((2000, 1200), 1000, 700, [(0.0, (255, 250, 214)), (0.4, (255, 226, 60)), (1.0, (232, 176, 0))])
rl = ray_layer((2000, 1200), 1000, 700, 28, (255, 252, 225, 255), start=-math.pi / 2 + 0.05)
rl.putalpha(ImageChops.multiply(rl.getchannel('A'), fade_mask((2000, 1200), 1000, 700, 120, 1200, 140)))
pic.alpha_composite(rl)
d = ImageDraw.Draw(pic)
outlined(d, (1000, 140), 'THE ORIGINAL DANCE  ·  1999', font(100), sw=9, shadow=8)
frames8 = crisp_dance(8)
fw, fh = frames8[0].size
gap = 40
x0 = (2000 - (4 * fw + 3 * gap)) // 2
for i, f in enumerate(frames8):
    pic.alpha_composite(f, (x0 + (i % 4) * (fw + gap), 290 + (i // 4) * (fh + 50)))
pic.convert('RGB').save(os.path.join(ABOUT, '1-the-original-1999.png'), optimize=True)
ASSETS = os.path.join(TOOLS, '..', 'public', 'assets')
shutil.copy2(os.path.join(ASSETS, 'trym-stene-studio.png'), os.path.join(ABOUT, '2-trym-in-the-studio.png'))
shutil.copy2(os.path.join(ASSETS, 'world', 'door-town.jpg'), os.path.join(ABOUT, '3-banana-world-the-town.jpg'))
shutil.copy2(os.path.join(ASSETS, 'trym-stene-profile-photo.jpg'), os.path.join(look, 'profile-photo-trym.jpg'))
print('about photos', ABOUT)
