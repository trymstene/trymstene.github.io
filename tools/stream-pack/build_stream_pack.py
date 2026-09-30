# -*- coding: utf-8 -*-
"""THE OFFICIAL DANCING BANANA STREAM PACK: emotes, sub badges, alerts, scene screens and panels for Twitch and Discord.

Every banana is tools/banana_render.py (the builder's own Python mirror, held to it by the print-parity rig), wearing the
builder's own wearables, cropped at the source size and resized ONCE (design library 6). The banana never changes its
face: an emote's mood is what it wears and holds, the way the builder dresses it.

    python tools/stream-pack/build_stream_pack.py            # tools/stream-pack/out/ (ignored) + a zip beside it
    python tools/stream-pack/build_stream_pack.py --quick    # the same, reusing last build's videos (they take minutes)

Twitch: emotes 28/56/112 (animated: GIF, 60 frames at most, no fast flashing), sub and bit badges 18/36/72. Discord:
emotes 128. Videos: the animated scenes as MP4 (H.264), the stinger and the webcam frames as WebM (VP9 with its
transparency, which OBS and Streamlabs play), by imageio-ffmpeg's own ffmpeg.
"""
import math
import os
import shutil
import subprocess
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
FPS = 30   # the videos: a dance frame is three video frames
LOOP = 8   # seconds a looping video lasts: the dance ten times over, so a player's restart is rarely seen
QUICK = '--quick' in sys.argv
VIDEO = os.path.join(HERE, 'out', 'video')   # kept between builds (the pack folder is emptied, this is not)
try:
    import imageio_ffmpeg
    FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
except ImportError:
    FFMPEG = shutil.which('ffmpeg')


def video(name, frames, size, alpha):
    """RGBA frames into out/video/<name>: a WebM (VP9) that keeps its transparency, or an MP4 (H.264) any player
    opens. `frames` is a generator, so --quick skips the drawing as well as the encoding."""
    path = os.path.join(VIDEO, name)
    if QUICK and os.path.exists(path):
        return path
    if not FFMPEG:
        raise SystemExit('no ffmpeg: pip install imageio-ffmpeg')
    os.makedirs(VIDEO, exist_ok=True)
    cmd = [FFMPEG, '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba' if alpha else 'rgb24',
           '-s', '%dx%d' % size, '-r', str(FPS), '-i', '-']
    if alpha:
        cmd += ['-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '0', '-crf', '30', '-row-mt', '1', '-auto-alt-ref', '0']
    else:
        cmd += ['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '21', '-preset', 'slow', '-tune', 'animation',
                '-movflags', '+faststart']
    p = subprocess.Popen(cmd + [path], stdin=subprocess.PIPE)
    for f in frames:
        p.stdin.write(f.convert('RGBA' if alpha else 'RGB').tobytes())
    p.stdin.close()
    if p.wait():
        raise SystemExit('ffmpeg could not write ' + name)
    print('video', name, os.path.getsize(path) // 1024, 'KB')
    return path

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


def edged(img, px):
    """the white edge on a canvas grown to hold it: edge() alone loses it wherever the art touches the border (a
    whole-pixel crop does: the top of the head, the soles, the outermost hand)"""
    big = Image.new('RGBA', (img.width + 2 * px, img.height + 2 * px), (0, 0, 0, 0))
    big.alpha_composite(img, (px, px))
    return edge(big, px)


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

# ── bit badges: the medal's finish cut as a GEM (a cheer is a gem on Twitch), a colour a tier, the banana dressing up
# the more they cheer. The top tier's rim is every colour at once.
GEMS = [
    (1, {}, 'grey'),
    (100, {'hat': 'party'}, 'purple'),
    (1000, {'glasses': 'threed'}, 'green'),
    (5000, {'hat': 'beanieprop'}, 'blue'),
    (10000, {'hat': 'viking'}, 'red'),
    (25000, {'hat': 'tophat', 'glasses': 'monocle'}, 'pink'),
    (50000, {'hat': 'jester'}, 'orange'),
    (75000, {'hat': 'crown', 'glasses': 'shades'}, 'teal'),
    (100000, {'hat': 'pixelcrown', 'glasses': 'shades', 'extras': ['goldchain']}, 'prism'),
]
# (light, mid, dark, the rays' tint)
GEM = {
    'grey': ((246, 248, 252), (168, 174, 190), (78, 82, 98), (228, 232, 242)),
    'purple': ((232, 210, 255), (150, 90, 236), (66, 26, 128), (206, 170, 255)),
    'green': ((200, 255, 218), (36, 192, 108), (6, 92, 46), (150, 240, 182)),
    'blue': ((204, 232, 255), (50, 140, 244), (12, 56, 142), (160, 206, 255)),
    'red': ((255, 210, 210), (230, 50, 62), (112, 8, 20), (255, 152, 152)),
    'pink': ((255, 218, 240), (240, 90, 170), (122, 16, 76), (255, 172, 216)),
    'orange': ((255, 232, 190), (250, 142, 28), (140, 62, 0), (255, 198, 122)),
    'teal': ((200, 255, 250), (26, 188, 188), (0, 92, 102), (150, 240, 236)),
    'prism': ((255, 246, 170), (246, 196, 40), (160, 104, 0), (255, 226, 110)),
}
RAINBOW = [(255, 77, 109), (255, 146, 40), (255, 222, 50), (55, 214, 122), (40, 200, 224), (77, 136, 255), (156, 96, 255), (238, 86, 200)]


def octagon(c, r):
    """a flat-topped octagon round c, r to its corners"""
    return [(c + r * math.cos(math.radians(22.5 + 45 * k)), c + r * math.sin(math.radians(22.5 + 45 * k))) for k in range(8)]


def gem(head, colour, N=288):
    light, mid, dark, ray = GEM[colour]
    im = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    c = N / 2

    def shape(pts):
        m = Image.new('L', (N, N), 0)
        ImageDraw.Draw(m).polygon(pts, fill=255)
        return m

    R = (N / 2 - 3) / math.cos(math.radians(22.5))                # the flat sides touch the edge
    im.paste(INK, mask=shape(octagon(c, R)))                        # the ink outline
    rim_o, rim_i = octagon(c, R - 6), octagon(c, (R - 6) * 0.78)
    d = ImageDraw.Draw(im)
    for k in range(8):                                              # eight facets, lit from the upper left
        lit = 0.5 + 0.5 * math.cos(math.radians(45 + 45 * k - 225))
        if colour == 'prism':
            col = lerp(lerp(RAINBOW[k], (0, 0, 0), 0.3), lerp(RAINBOW[k], (255, 255, 255), 0.5), lit)
        else:
            col = lerp(dark, light, 0.12 + 0.88 * lit)
        d.polygon([rim_o[k], rim_o[(k + 1) % 8], rim_i[(k + 1) % 8], rim_i[k]], fill=col + (255,))
    for k in range(8):                                              # the cuts between them
        d.line([rim_o[k], rim_i[k]], fill=lerp(dark, INK, 0.3) + (255,), width=2)
    face_m = shape(rim_i)
    face = vgrad((N, N), mid, lerp(mid, dark, 0.55))
    face.alpha_composite(ray_layer((N, N), c, c * 1.05, 16, ray + (150,), start=-math.pi / 2))
    im.paste(face, mask=face_m)
    d.polygon(rim_i, outline=dark + (255,), width=3)                # the bevel into the face
    inner = (R - 6) * 0.78 * math.cos(math.radians(22.5))           # the face's own half-width
    k = (inner * 1.62) / max(head.size)                             # the bust, as on the medals
    bust = edge(head.resize((max(1, round(head.width * k)), max(1, round(head.height * k))), Image.Resampling.BOX), 3)
    layer = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    layer.alpha_composite(bust, (round(c - bust.width / 2), round(c + inner * 0.92 - bust.height)))
    layer.putalpha(ImageChops.multiply(layer.getchannel('A'), face_m))
    im.alpha_composite(layer)
    glare = Image.new('L', (N, N), 0)                               # the crescent of light, as on the medals
    gl = ImageDraw.Draw(glare)
    gl.ellipse((c - R * 0.8, c - R * 0.84, c + R * 0.46, c + R * 0.18), fill=110)
    gl.ellipse((c - R * 0.68, c - R * 0.66, c + R * 0.62, c + R * 0.4), fill=0)
    glare = ImageChops.multiply(glare.filter(ImageFilter.GaussianBlur(N / 90)), shape(rim_o))
    im.paste((255, 255, 255, 255), mask=glare)
    sparkle(ImageDraw.Draw(im), c + R * 0.56, c - R * 0.54, N * 0.07)
    return im


gem_arts = {}
os.makedirs(os.path.join(OUT, 'bit-badges'))
for bits, outfit, colour in GEMS:
    art = gem_arts[bits] = gem(badge_art(outfit), colour)
    for size in (72, 36, 18):
        art.resize((size, size), Image.Resampling.LANCZOS).save(os.path.join(OUT, 'bit-badges', '%d-bits-%d.png' % (bits, size)), optimize=True)
    print('bits', bits)

# ── alerts: the whole banana, dancing, on transparency (a streaming app lays its own words over it) ─────────────
ALERTS = [('follow', {'hat': 'party'}, 'confetti'), ('subscribe', {'hat': 'crown', 'glasses': 'shades'}, 'sparkle'),
          ('gift-sub', {'glasses': 'hearts', 'extras': ['balloons']}, 'confetti'),
          ('cheer', {'hat': 'jester', 'extras': ['glowstick']}, 'sparkle'),
          ('tip', {'hat': 'tophat', 'glasses': 'monocle', 'extras': ['goldtoken']}, 'sparkle'),
          ('raid', {'hat': 'viking'}, 'confetti')]
ALERT_WORDS = {'follow': 'FOLLOW', 'subscribe': 'SUBSCRIBE', 'gift-sub': 'GIFT SUB', 'cheer': 'CHEER', 'tip': 'TIP', 'raid': 'RAID'}
alert_src = {}                                  # (arms-up frame, its box, effect): the listing's pictures cut from it
os.makedirs(os.path.join(OUT, 'alerts'))
for name, outfit, effect in ALERTS:
    fr = frames_of(outfit, S)
    box = square(union([f.getbbox() for f in fr]), 0.06)
    save_gif([cut(f, box, 500, effect, i) for i, f in enumerate(fr)], os.path.join(OUT, 'alerts', name + '-500.gif'))
    alert_src[name] = (fr[7], box, effect)
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
SCENES = [('starting-soon', 'STARTING SOON'), ('be-right-back', 'BE RIGHT BACK'), ('stream-ending', 'THANKS FOR WATCHING'),
          ('offline', 'STREAM OFFLINE')]
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


# what does not move, made once: the light, the rays' fade, the glow round the banana, the shadow at its feet, the signs
_STAGE = {}


def stage_parts():
    if not _STAGE:
        _STAGE['light'] = radial((SW, SH), SPOT[0], SPOT[1], [(0.0, (255, 250, 214)), (0.34, (255, 226, 60)), (0.75, (248, 200, 10)), (1.0, (222, 160, 0))])
        _STAGE['fade'] = fade_mask((SW, SH), SPOT[0], SPOT[1], 120, 1150, 150)
        halo = Image.new('L', (SW, SH), 0)
        ImageDraw.Draw(halo).ellipse((SPOT[0] - 360, SPOT[1] - 330, SPOT[0] + 360, SPOT[1] + 330), fill=175)
        _STAGE['halo'] = halo.filter(ImageFilter.GaussianBlur(70))
        sh = Image.new('L', (SW, SH), 0)
        ImageDraw.Draw(sh).ellipse((SPOT[0] - 230, FLOOR - 26, SPOT[0] + 230, FLOOR + 30), fill=95)
        _STAGE['shadow'] = sh.filter(ImageFilter.GaussianBlur(14))
    return _STAGE


# the builder's own confetti colours, squares and strips, and the glints, scattered by a fixed hand (the same every
# build), never on the banana
CONF_COLS = [(255, 77, 109), (77, 184, 255), (242, 194, 0), (55, 214, 122), (179, 136, 255)]
STAGE_CONFETTI = [((k * 397 + 131) % SW, (k * 211 + 57) % 900, 14 + (k * 7) % 12, k) for k in range(46)
                  if not (abs((k * 397 + 131) % SW - SPOT[0]) < 330 and (k * 211 + 57) % 900 > 380)]
STAGE_GLINTS = [((k * 523 + 210) % SW, (k * 277 + 330) % 1000, 14 + (k * 5) % 16, k) for k in range(9)
                if not (abs((k * 523 + 210) % SW - SPOT[0]) < 330 and (k * 277 + 330) % 1000 > 380)]
_SIGNS = {}


def stage(words, t=0.0):
    """the scene without its banana at loop time t (0 to 1; 0 is the still scene): the light, the rays turning, the
    confetti falling, the glints twinkling, the title, the shadow on the floor. Every piece moves a WHOLE number of
    times a loop (a fall of one or two screens, sways, tumbles, twinkles; the rays two turns of their own pattern),
    so the loop has no seam."""
    P = stage_parts()
    im = P['light'].copy()
    rl = ray_layer((SW, SH), SPOT[0], SPOT[1], 28, (255, 252, 225, 255), start=-math.pi / 2 + 0.05 + t * 4 * math.pi / 28)
    rl.putalpha(ImageChops.multiply(rl.getchannel('A'), P['fade']))
    im.alpha_composite(rl)
    im.paste((255, 253, 235, 255), mask=P['halo'])
    d = ImageDraw.Draw(im)
    span = SH + 120
    for x, y, s, k in STAGE_CONFETTI:
        yy = (y + 60 + (1 + k % 2) * span * t) % span - 60
        xx = x + 12 * math.sin(2 * math.pi * (2 + k % 3) * t)
        tall = s if k % 3 else int(s * 1.7)
        hgt = max(3, round(tall * (0.3 + 0.7 * abs(math.cos(2 * math.pi * (5 + k % 4) * t)))))
        d.rectangle((round(xx), round(yy), round(xx) + s - 1, round(yy) + hgt - 1), fill=CONF_COLS[k % 5] + (255,))
    for x, y, r, k in STAGE_GLINTS:
        sparkle(d, x, y, r * (0.4 + 0.3 * (1 + math.cos(2 * math.pi * (2 + k % 3) * t))))
    im.paste((120, 70, 0, 255), mask=P['shadow'])
    if words not in _SIGNS:
        _SIGNS[words] = sign(words)
    s = _SIGNS[words]
    im.alpha_composite(s, ((SW - s.width) // 2 + 8, 70))
    return im


def scene_frames(words):
    n = LOOP * FPS
    for fi in range(n):
        im = stage(words, fi / n)
        im.alpha_composite(dance[(fi * 10 // FPS) % 8], (DX, DY))
        yield im


os.makedirs(os.path.join(OUT, 'scenes'))
dance = [edged(f, 6) for f in crisp_dance(SCENE_PX)]
DX = SPOT[0] - dance[0].width // 2
DY = FLOOR + 14 - dance[0].height                         # the white edge's bottom sits just under the floor line
for name, words in SCENES:
    st = stage(words)
    st.convert('RGB').save(os.path.join(OUT, 'scenes', name + '-stage-1920x1080.png'), optimize=True)
    full = st.copy()
    full.alpha_composite(dance[7], (DX, DY))
    full.convert('RGB').save(os.path.join(OUT, 'scenes', name + '-1920x1080.png'), optimize=True)
    # ⭐ the same scene ANIMATED, the thing people search for ("animated starting soon screen"): an 8-second MP4
    # that loops seamlessly in an OBS media source
    mp4 = name + '-animated-1920x1080.mp4'
    shutil.copy2(video(mp4, scene_frames(words), (SW, SH), False), os.path.join(OUT, 'scenes', mp4))
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
PANELS = [('ABOUT ME', 2), ('SCHEDULE', 3), ('DISCORD', 6), ('SUPPORT', 7), ('RULES', 1), ('SOCIALS', 5),
          ('COMMANDS', 0), ('DONATE', 4), ('MERCH', 2), ('FAQ', 3), ('MY SETUP', 6), ('CONTACT', 7)]
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
panel('', 5, pf).save(os.path.join(OUT, 'panels', 'blank-320x150.png'), optimize=True)   # for a word of their own


# ── webcam frames: the panels' lacquer as a band round the camera, the banana dancing on its top edge ───────────
# The hole is truly empty (the camera shows through it); the hard ink shadow falls outside the band only, never
# across the face in the camera. Three shapes, each as a still PNG, a looping WebM that keeps its transparency, and
# a GIF for an image source.
CAMS = [('16x9', 1120, 630), ('4x3', 880, 660), ('square', 700, 700)]
CAM_PX = 8                                        # frame px an art pixel
C_IN, C_BAND, C_OUT, C_RAD, C_SH = 6, 44, 9, 34, 16
cam_dance = [edged(f, 3) for f in crisp_dance(CAM_PX)]


def cam_frame(iw, ih, sec=0.0, idx=7, inside=None, dancers=None):
    """the frame round an iw x ih camera at `sec` seconds into its loop, the banana on dance frame `idx`; `inside`
    fills the hole and `dancers` stands a bigger banana on it (for the listing's pictures only)"""
    dancers = dancers or cam_dance
    B = C_IN + C_BAND + C_OUT
    bw, bh = dancers[0].size
    sink = C_OUT + 5                              # the feet stand a little into the band
    W, H = iw + 2 * B + C_SH + 4, bh - sink + ih + 2 * B + C_SH + 4
    ox, oy = 2, bh - sink + 2
    outer = (ox, oy, ox + iw + 2 * B - 1, oy + ih + 2 * B - 1)
    hole = (ox + B, oy + B, ox + B + iw - 1, oy + B + ih - 1)

    def rr(box, r, grow=0, dx=0, dy=0):
        m = Image.new('L', (W, H), 0)
        ImageDraw.Draw(m).rounded_rectangle((box[0] - grow + dx, box[1] - grow + dy, box[2] + grow + dx, box[3] + grow + dy),
                                            max(1, r + grow), fill=255)
        return m

    hole_m = rr(hole, 8)
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    if inside is not None:
        im.paste(inside.convert('RGBA').resize((iw, ih), Image.Resampling.LANCZOS), (hole[0], hole[1]))
    im.paste(INK, mask=ImageChops.subtract(rr(outer, C_RAD, dx=C_SH, dy=C_SH), hole_m))
    im.paste(INK, mask=ImageChops.subtract(rr(outer, C_RAD), hole_m))
    band = ImageChops.subtract(rr(outer, C_RAD, grow=-C_OUT), rr(hole, 8, grow=C_IN))
    face = vgrad((W, H), (255, 232, 80), (244, 188, 0))
    stripes = Image.new('L', (W, H), 0)           # candy stripes along the band: the scenes' rays, as a band holds them
    sd = ImageDraw.Draw(stripes)
    for x in range(-H, W, 40):
        sd.polygon([(x, H), (x + 18, H), (x + 18 + H, 0), (x + H, 0)], fill=120)
    face.paste((255, 246, 180, 255), mask=stripes)
    # the bevel, lit from the upper left: the band's outer edge bright at the top and left and shaded at the bottom
    # and right, its inner edge (sloping down to the camera) the other way round
    tl = Image.new('L', (W, H), 0)
    ImageDraw.Draw(tl).polygon([(0, 0), (W, 0), (outer[2], outer[1]), (outer[0], outer[3]), (0, H)], fill=255)
    br_ = ImageChops.invert(tl)
    rim_out = ImageChops.subtract(rr(outer, C_RAD, grow=-C_OUT), rr(outer, C_RAD, grow=-(C_OUT + 6)))
    rim_in = ImageChops.subtract(rr(hole, 8, grow=C_IN + 6), rr(hole, 8, grow=C_IN))
    face.paste((255, 253, 230, 255), mask=ImageChops.multiply(rim_out, tl))
    face.paste((214, 146, 0, 255), mask=ImageChops.multiply(rim_out, br_))
    face.paste((214, 146, 0, 255), mask=ImageChops.multiply(rim_in, tl))
    face.paste((255, 253, 230, 255), mask=ImageChops.multiply(rim_in, br_))
    gl = Image.new('L', (W, H), 0)                # two streaks of glare across it, as on the signs
    g = ImageDraw.Draw(gl)
    for x, w, a in ((int(W * 0.56), 64, 80), (int(W * 0.56) + 92, 22, 105)):
        g.polygon([(x, H), (x + w, H), (x + w + H * 0.5, 0), (x + H * 0.5, 0)], fill=a)
    face.paste((255, 255, 255, 255), mask=gl.filter(ImageFilter.GaussianBlur(2)))
    im.paste(face, mask=band)
    d = ImageDraw.Draw(im)
    mid = C_OUT + C_BAND // 2                     # glints on the band, twinkling once a dance (0.8 s)
    for k, (gx, gy) in enumerate(((outer[0] + mid + 6, outer[1] + mid), (outer[2] - mid - 6, outer[3] - mid),
                                  (outer[0] + mid, (outer[1] + outer[3]) // 2))):
        tw = 0.5 + 0.5 * math.cos(2 * math.pi * (sec / 0.8 + k / 3))
        sparkle(d, gx, gy, 13 + 8 * tw)
    bx = ox + round((outer[2] - outer[0]) * 0.8) - bw // 2
    sh = Image.new('L', (W, H), 0)                # its shadow on the band
    ImageDraw.Draw(sh).ellipse((bx + bw * 0.14, oy + sink - 12, bx + bw * 0.86, oy + sink + 6), fill=110)
    im.paste((150, 88, 0, 255), mask=ImageChops.multiply(sh.filter(ImageFilter.GaussianBlur(5)), band))
    im.alpha_composite(dancers[idx], (bx, 2))
    return im


os.makedirs(os.path.join(OUT, 'webcam-frames'))
for shape, iw, ih in CAMS:
    base = 'webcam-frame-%s' % shape
    cam_frame(iw, ih).save(os.path.join(OUT, 'webcam-frames', base + '.png'), optimize=True)
    save_gif([cam_frame(iw, ih, i / 10, i) for i in range(8)], os.path.join(OUT, 'webcam-frames', base + '-animated.gif'))
    size = cam_frame(iw, ih).size
    size = (size[0] + size[0] % 2, size[1] + size[1] % 2)   # a video's sides are even

    def cam_frames(iw=iw, ih=ih, size=size):
        for fi in range(LOOP * FPS):
            f = Image.new('RGBA', size, (0, 0, 0, 0))
            f.alpha_composite(cam_frame(iw, ih, fi / FPS, (fi * 10 // FPS) % 8))
            yield f
    shutil.copy2(video(base + '-animated.webm', cam_frames(), size, True), os.path.join(OUT, 'webcam-frames', base + '-animated.webm'))
    print('webcam frame', shape)


# ── the stinger: a lacquered wipe with the banana riding it, for OBS and Streamlabs. It covers the whole screen from
# about 0.45 s to 1.15 s; the scene changes under it at ST_POINT. The panel is a slanted band of the scenes' light,
# rays and confetti, edged in the site's ink, white and hot pink, moving fast in and out and slowly while it covers.
ST_N = 48                                  # 1.6 s
ST_POINT = 800                             # ms: the transition point to type into OBS
SLANT, PANEL_W = 260, 2800
BANDS = [(HOT, 70), ((255, 255, 255), 22), (INK, 12)]   # outside in, on both edges
BANDS_W = sum(w for _, w in BANDS)
# the panel's centre: (seconds, x, speed px/s); cubic Hermite between them, fast in, slow across the middle, fast out
ST_KEYS = [(0.0, SW + PANEL_W / 2 + SLANT / 2 + BANDS_W + 20, -7000), (0.5, 1110, -500), (1.1, 810, -500),
           (1.6, -(PANEL_W / 2 + SLANT / 2 + BANDS_W + 20), -7000)]
# the banana glides in its own light, slower than the panel under it (so it is on screen for most of the wipe and a
# still of the wipe can show it); it stays inside the yellow the whole way
ST_BANANA = [(0.0, 2400, -4000), (0.5, 1010, -170), (1.1, 910, -170), (1.6, -480, -4000)]
ST_MARGIN = 3300                           # the moving layers are made once, this much wider than the screen each side


def hermite(p0, p1, m0, m1, u):
    return (2 * u ** 3 - 3 * u ** 2 + 1) * p0 + (u ** 3 - 2 * u ** 2 + u) * m0 + (-2 * u ** 3 + 3 * u ** 2) * p1 + (u ** 3 - u ** 2) * m1


def st_x(sec, keys=ST_KEYS):
    for (t0, x0, v0), (t1, x1, v1) in zip(keys, keys[1:]):
        if sec <= t1:
            h = t1 - t0
            return hermite(x0, x1, v0 * h, v1 * h, (sec - t0) / h)
    return keys[-1][1]


_ST = {}


def stinger_frame(fi):
    if not _ST:
        wide = (SW + 2 * ST_MARGIN, SH)
        gc = _ST['gc'] = ST_MARGIN + SW // 2       # the centre of the made-once layers
        _ST['glow'] = radial(wide, gc, 640, [(0.0, (255, 250, 214)), (0.05, (255, 232, 90)), (0.14, (250, 206, 20)), (0.3, (236, 176, 0)), (1.0, (226, 162, 0))])
        _ST['fade'] = fade_mask(wide, gc, 640, 100, 1300, 150)
        halo = Image.new('L', wide, 0)
        ImageDraw.Draw(halo).ellipse((gc - 380, 640 - 350, gc + 380, 640 + 350), fill=170)
        _ST['halo'] = halo.filter(ImageFilter.GaussianBlur(70))
    gc, glow, fade, halo = _ST['gc'], _ST['glow'], _ST['fade'], _ST['halo']
    bw, bh = dance[0].size
    by = (SH - bh) // 2 + 30
    feet = by + bh - 14
    sec = fi / FPS
    xc = st_x(sec)                             # the panel
    bx = st_x(sec, ST_BANANA)                  # the banana and its light
    xlb = xc - PANEL_W / 2 - SLANT / 2         # the yellow's bottom-left corner

    def para(x0, x1):
        return [(x0, SH), (x1, SH), (x1 + SLANT, 0), (x0 + SLANT, 0)]

    im = Image.new('RGBA', (SW, SH), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    x = xlb - BANDS_W
    for col, w in BANDS:                        # the leading edge: hot pink first
        d.polygon(para(x, x + w), fill=col + (255,))
        x += w
    x = xlb + PANEL_W
    for col, w in reversed(BANDS):              # the trailing edge: ink next to the yellow, pink last
        d.polygon(para(x, x + w), fill=col + (255,))
        x += w
    win = round(gc - bx)
    box = (win, 0, win + SW, SH)
    panel_ = glow.crop(box)
    rl = ray_layer((SW, SH), bx, 640, 28, (255, 252, 225, 255), start=-math.pi / 2 + sec * 0.7)
    rl.putalpha(ImageChops.multiply(rl.getchannel('A'), fade.crop(box)))
    panel_.alpha_composite(rl)
    panel_.paste((255, 253, 235, 255), mask=halo.crop(box))
    pd = ImageDraw.Draw(panel_)
    for k in range(40):                         # confetti riding the panel, tumbling as it goes
        rx = xc - 1300 + (k * 283) % 2600
        ry = (k * 157 + 40 + sec * (120 + (k % 3) * 60)) % (SH + 60) - 30
        if abs(rx - bx) < bw * 0.62 and by - 40 < ry < feet + 40:
            continue
        s = 16 + (k * 7) % 12
        hgt = max(4, round(s * (1.6 if k % 3 == 0 else 1) * (0.3 + 0.7 * abs(math.cos(sec * (5 + k % 4) + k)))))
        pd.rectangle((round(rx), round(ry), round(rx) + s - 1, round(ry) + hgt - 1), fill=CONF_COLS[k % 5] + (255,))
    for k in range(7):
        gx, gy = xc - 1100 + (k * 367) % 2200, 120 + (k * 211) % 840
        if abs(gx - bx) < bw * 0.62 and by - 40 < gy < feet + 40:
            continue
        sparkle(pd, gx, gy, (14 + (k * 5) % 14) * (0.5 + 0.5 * abs(math.cos(sec * 4 + k))))
    sh = Image.new('L', (SW, SH), 0)
    ImageDraw.Draw(sh).ellipse((bx - 230, feet - 24, bx + 230, feet + 30), fill=95)
    panel_.paste((120, 70, 0, 255), mask=sh.filter(ImageFilter.GaussianBlur(14)))
    ym = Image.new('L', (SW, SH), 0)
    ImageDraw.Draw(ym).polygon(para(xlb, xlb + PANEL_W), fill=255)
    im.paste(panel_, mask=ym)
    im.alpha_composite(dance[(fi * 10 // FPS) % 8], (round(bx - bw / 2), by))
    return im


def stinger_frames():
    return (stinger_frame(fi) for fi in range(ST_N))


os.makedirs(os.path.join(OUT, 'stinger'))
st_name = 'dancing-banana-stinger-1920x1080.webm'
shutil.copy2(video(st_name, stinger_frames(), (SW, SH), True), os.path.join(OUT, 'stinger', st_name))
print('stinger')

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


emote_board('EMOTES  ·  BADGES  ·  ALERTS  ·  SCENES  ·  PANELS  ·  CAM FRAME  ·  STINGER', 'preview-emotes-2000.png')
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

# ── one emote on its own (the classic, and each of the eleven sold singly): the whole banana big, dressed as that
# emote (a close-up cut an arm off at this size), then what the buyer actually gets, the still emote and the eight
# frames of the animated one
def board(title, line, h=2000):
    """a listing picture on the chat-dark board: the title, a line under it, the credit at the foot"""
    pv = Image.new('RGB', (2000, h), (24, 24, 30))
    d = ImageDraw.Draw(pv)
    f = font(96)
    while d.textlength(title, font=f) > 1800:
        f = font(f.size - 4)
    outlined(d, (1000, 150), title, f, fill=BANANA, sw=8, shadow=0)
    if line:
        d.text((1000, 265), line, font=font(38), fill=(255, 255, 255), anchor='mm')
    d.text((1000, h - 70), 'the dancing banana, by Trym Stene, since 1999', font=font(34), fill=(150, 150, 165), anchor='mm')
    return pv, d


def emote_sheet(name, title, path):
    pv, d = board(title, 'ANIMATED + STILL EMOTE  ·  TWITCH + DISCORD')
    fr, sbx, abx, eff = emote_stills[name]
    whole = fr[7].crop(fr[7].getbbox())
    h = 860
    whole = whole.resize((round(whole.width * h / whole.height), h), Image.Resampling.BOX)
    pv.paste(whole, ((2000 - whole.width) // 2, 340), whole)
    still = cut(fr[STILL], sbx, 230, eff, 0)
    pv.paste(still, (60, 1330), still)
    for i, f in enumerate(fr):
        t = cut(f, abx, 190, eff, i)
        pv.paste(t, (340 + i * 205, 1350), t)
    d.text((175, 1600), 'still', font=font(36), fill=(200, 200, 215), anchor='mm')
    d.text((1160, 1600), 'animated: it dances in chat', font=font(36), fill=(200, 200, 215), anchor='mm')
    d.text((1000, 1720), '112 · 56 · 28 px for Twitch  ·  128 px for Discord', font=font(40), fill=(255, 255, 255), anchor='mm')
    pv.save(os.path.join(OUT, path), optimize=True)


emote_sheet('dance', 'THE CLASSIC DANCING BANANA', 'preview-classic-emote-2000.png')
for name, _, _ in EMOTES[1:]:
    emote_sheet(name, 'THE %s EMOTE' % name.upper(), 'preview-emote-%s-2000.png' % name)


def play_pill(im, cx, y, k=1.0):
    """a hot pink pill with a play mark, centred on cx: this one moves"""
    d = ImageDraw.Draw(im)
    f = font(round(30 * k))
    w, h = round(d.textlength('ANIMATED', font=f) + 96 * k), round(58 * k)
    x, sh = round(cx - w / 2), round(5 * k)
    d.rounded_rectangle((x + sh, y + sh, x + w + sh, y + h + sh), h // 2, fill=INK)
    d.rounded_rectangle((x, y, x + w, y + h), h // 2, fill=HOT, outline=INK, width=max(2, round(4 * k)))
    tx, ty = x + 40 * k, y + h / 2
    d.polygon([(tx - 11 * k, ty - 14 * k), (tx - 11 * k, ty + 14 * k), (tx + 14 * k, ty)], fill=(255, 255, 255))
    d.text((x + 64 * k, ty), 'ANIMATED', font=f, fill=(255, 255, 255), anchor='lm')


def cam_placeholder(w, h):
    """a stand-in for the streamer in the camera (the listing's pictures only; the frame itself is empty)"""
    im = vgrad((w, h), (74, 82, 110), (30, 34, 50))
    d = ImageDraw.Draw(im)
    col = (106, 116, 150, 255)
    d.ellipse((w / 2 - h * 0.15, h * 0.24, w / 2 + h * 0.15, h * 0.56), fill=col)
    d.rounded_rectangle((w / 2 - h * 0.36, h * 0.62, w / 2 + h * 0.36, h * 1.2), radius=round(h * 0.18), fill=col)
    d.text((w / 2, h * 0.1), 'YOUR CAMERA', font=font(max(16, round(h * 0.05))), fill=(140, 150, 184), anchor='mm')
    return im


def scene_card(label, top, bottom):
    """a stand-in for the streamer's own scene (the stinger's pictures only)"""
    im = vgrad((SW, SH), top, bottom)
    ImageDraw.Draw(im).text((SW // 2, SH // 2), label, font=font(170), fill=lerp(top, (255, 255, 255), 0.28) + (255,), anchor='mm')
    return im


SCENE_A = scene_card('SCENE 1', (42, 72, 112), (14, 24, 46))
SCENE_B = scene_card('SCENE 2', (98, 42, 112), (36, 12, 46))


def stinger_shot(fi, size):
    im = (SCENE_A if fi * 1000 / FPS < ST_POINT else SCENE_B).copy()
    im.alpha_composite(stinger_frame(fi))
    return im.resize(size, Image.Resampling.LANCZOS)


# ── two more listing pictures: the badges and the panels, and the three scene screens ───────────────────────
pv = Image.new('RGB', (2000, 2000), (24, 24, 30))
d = ImageDraw.Draw(pv)
outlined(d, (1000, 140), 'SUB BADGES & PANELS', font(96), fill=BANANA, sw=8, shadow=0)
for k, (name, _, _) in enumerate(BADGES):
    b = badge_arts[name].resize((216, 216), Image.Resampling.LANCZOS)
    x = 130 + k * 300
    pv.paste(b, (x, 300), b)
    d.text((x + 108, 565), name.split('-')[0].lstrip('0') + (' MONTH' if name.startswith('01') else ' MONTHS'), font=font(30), fill=(200, 200, 215), anchor='mm')
for k, (words, _) in enumerate(PANELS[:6]):
    p = Image.open(os.path.join(OUT, 'panels', words.lower().replace(' ', '-') + '-320x150.png'))
    p = p.resize((p.width * 2, p.height * 2), Image.Resampling.NEAREST)   # 2x exactly: the banana's pixels stay whole
    pv.paste(p, (340 + (k % 2) * 680, 700 + (k // 2) * 390), p)
d.text((1000, 1930), 'the dancing banana, by Trym Stene, since 1999', font=font(34), fill=(150, 150, 165), anchor='mm')
pv.save(os.path.join(OUT, 'preview-badges-panels-2000.png'), optimize=True)

pv, d = board('ANIMATED STREAM SCENES', None)
for k, (name, _) in enumerate(SCENES):
    sc = Image.open(os.path.join(OUT, 'scenes', name + '-1920x1080.png')).resize((880, 495), Image.Resampling.LANCZOS)
    x, y = 60 + (k % 2) * 1000, 300 + (k // 2) * 600
    d.rectangle((x - 8, y - 8, x + 888, y + 503), fill=INK)
    pv.paste(sc, (x, y))
    play_pill(pv, x + 880 - 150, y + 495 - 84, 0.8)
d.text((1000, 1560), 'Starting soon  ·  Be right back  ·  Thanks for watching  ·  Stream offline', font=font(40), fill=(200, 200, 215), anchor='mm')
d.text((1000, 1650), 'each one animated (an MP4 that loops), still, and as an empty stage', font=font(36), fill=(255, 255, 255), anchor='mm')
d.text((1000, 1720), 'with the dancing banana as a separate overlay  ·  1920 × 1080', font=font(36), fill=(255, 255, 255), anchor='mm')
pv.save(os.path.join(OUT, 'preview-scenes-2000.png'), optimize=True)

# ── what the new listings hold (30 Sep), one board each ────────────────────────────────────────────────────────
pv, d = board('STREAM ALERTS', '6 ANIMATED ALERTS  ·  TRANSPARENT GIF  ·  500 × 500')
for k, (name, _, _) in enumerate(ALERTS):
    f7, box, eff = alert_src[name]
    t = cut(f7, box, 460, eff, 7)
    x, y = 150 + (k % 3) * 620, 360 + (k // 3) * 740
    pv.paste(t, (x, y), t)
    d.text((x + 230, y + 520), ALERT_WORDS[name], font=font(46), fill=(200, 200, 215), anchor='mm')
d.text((1000, 1800), 'your alert tool lays the words (the name, the amount) over them', font=font(34), fill=(255, 255, 255), anchor='mm')
pv.save(os.path.join(OUT, 'preview-alerts-2000.png'), optimize=True)

pv, d = board('TWITCH PANELS', '12 PANELS + 1 BLANK  ·  320 × 150  ·  SHOWN AT TWICE THEIR SIZE', h=2760)
for k, fn in enumerate([w.lower().replace(' ', '-') for w, _ in PANELS] + ['blank']):
    p = Image.open(os.path.join(OUT, 'panels', fn + '-320x150.png'))
    p = p.resize((p.width * 2, p.height * 2), Image.Resampling.NEAREST)   # 2x exactly: the banana's pixels stay whole
    pv.paste(p, (340 + (k % 2) * 680 if k < 12 else 680, 360 + (k // 2) * 320), p)
pv.save(os.path.join(OUT, 'preview-panels-2000.png'), optimize=True)

pv, d = board('WEBCAM FRAMES', '16:9  ·  4:3  ·  SQUARE  ·  ANIMATED (WEBM + GIF) AND STILL (PNG)', h=2900)
top = cam_frame(1120, 630, idx=7, inside=cam_placeholder(1120, 630))
pv.paste(top, ((2000 - top.width) // 2, 330), top)
d.text((1000, 330 + top.height + 40), '16:9', font=font(44), fill=(200, 200, 215), anchor='mm')
row = [cam_frame(880, 660, idx=3, inside=cam_placeholder(880, 660)), cam_frame(700, 700, idx=5, inside=cam_placeholder(700, 700))]
y2, low = 330 + top.height + 110, max(im.height for im in row)
x = (2000 - (row[0].width + row[1].width + 60)) // 2
for im, label in zip(row, ('4:3', 'SQUARE')):
    pv.paste(im, (x, y2 + low - im.height), im)
    d.text((x + im.width // 2, y2 + low + 40), label, font=font(44), fill=(200, 200, 215), anchor='mm')
    x += im.width + 60
pv.save(os.path.join(OUT, 'preview-webcam-2000.png'), optimize=True)

pv, d = board('STINGER TRANSITION', 'FOR OBS + STREAMLABS  ·  1.6 SECONDS  ·  TRANSPARENT WEBM')
for k, (fi, words) in enumerate(((6, '0.2 s'), (15, '0.5 s'), (24, '0.8 s: the scene changes'), (40, '1.3 s'))):
    x, y = 60 + (k % 2) * 1000, 330 + (k // 2) * 640
    d.rectangle((x - 8, y - 8, x + 888, y + 503), fill=INK)
    pv.paste(stinger_shot(fi, (880, 495)), (x, y))
    d.text((x + 440, y + 550), words, font=font(38), fill=(200, 200, 215), anchor='mm')
d.text((1000, 1720), 'Transition point: 800 ms. The scene switches there, under the banana.', font=font(36), fill=(255, 255, 255), anchor='mm')
pv.save(os.path.join(OUT, 'preview-stinger-2000.png'), optimize=True)

pv, d = board('BIT BADGES', '9 GEMS  ·  1 TO 100,000 BITS  ·  72, 36 AND 18 PX FOR TWITCH')
for k, (bits, _, _) in enumerate(GEMS):
    g = gem_arts[bits].resize((360, 360), Image.Resampling.LANCZOS)
    x, y = 260 + (k % 3) * 560, 340 + (k // 3) * 520
    pv.paste(g, (x, y), g)
    d.text((x + 180, y + 405), '{:,} BIT{}'.format(bits, '' if bits == 1 else 'S'), font=font(40), fill=(200, 200, 215), anchor='mm')
pv.save(os.path.join(OUT, 'preview-bit-badges-2000.png'), optimize=True)

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
    'bits': """BIT BADGES (bit-badges/)
  1, 100, 1000, 5000, 10000, 25000, 50000, 75000 and 100000 bits, each at 72, 36 and 18 px - a gem for every
  tier, and the banana dresses up the more they cheer.
""",
    'alerts': """ALERTS (alerts/, 500 x 500, transparent, they loop)
  follow, subscribe, gift-sub, cheer, tip, raid           add your own words (the name, the amount) in your alert tool
  dancing-banana-600.gif                                  the classic dance on its own, for any scene
""",
    'scenes': """SCENES (scenes/, 1920 x 1080)
  starting-soon, be-right-back, stream-ending, offline    ready to use, with the banana (PNG)
  ...-animated-1920x1080.mp4                              the same scenes animated: 8 seconds that loop. In OBS: a
                                                          Media Source with Loop ticked
  ...-stage versions                                      the same scenes with an empty spotlight
  dancing-banana-overlay-1920x1080.gif                    lay it full screen over a stage scene (in OBS: an Image
                                                          source, fit to screen) and the banana dances in the light
""",
    'panels': """PANELS (panels/, 320 x 150)
  about-me, schedule, discord, support, rules, socials, commands, donate, merch, faq, my-setup, contact
  blank-320x150.png                                       for a word of your own
""",
    'webcam': """WEBCAM FRAMES (webcam-frames/): 16x9, 4x3 and square
  webcam-frame-<shape>-animated.webm                      the banana dances on the frame, the middle is see-through.
                                                          In OBS: a Media Source with Loop ticked, above your camera
  webcam-frame-<shape>-animated.gif                       the same, for an Image source
  webcam-frame-<shape>.png                                still
""",
    'stinger': """STINGER TRANSITION (stinger/)
  dancing-banana-stinger-1920x1080.webm                   1.6 seconds, transparent
  OBS: Scene Transitions, +, Stinger. Video File: this file. Transition Point: 800 ms.
  Streamlabs: Scene Transitions, Add Transition, Stinger: the same file and 800 ms.
""",
}
for _name, _, _ in EMOTES:
    TXT['single-' + _name] = ('THE ' + _name.upper() + ' EMOTE (emotes/' + _name + '/)' + chr(10)
                              + '  twitch-112.png, twitch-56.png, twitch-28.png            still emote, the three sizes Twitch asks for' + chr(10)
                              + '  twitch-animated-112.gif, -56.gif, -28.gif               animated emote (8 frames, loops)' + chr(10)
                              + '  discord-128.png, discord-animated-128.gif               for Discord' + chr(10))
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


FULL = ['emotes', 'badges', 'bits', 'alerts', 'scenes', 'panels', 'webcam', 'stinger']
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
                                                lambda rel: not rel.startswith(('preview-', 'cover-')) and rel != 'README.txt'),
    'official-dancing-banana-emote-pack.zip': ('THE OFFICIAL DANCING BANANA - EMOTE PACK', ['emotes'],
                                               lambda rel: rel.startswith('emotes/')),
    'official-dancing-banana-sub-badges.zip': ('THE OFFICIAL DANCING BANANA - SUB BADGES', ['badges'],
                                               lambda rel: rel.startswith('sub-badges/')),
    'official-dancing-banana-classic-emote.zip': ('THE OFFICIAL DANCING BANANA - THE CLASSIC EMOTE', ['classic'],
                                                  lambda rel: rel.startswith('emotes/dance/')),
    'official-dancing-banana-stream-alerts.zip': ('THE OFFICIAL DANCING BANANA - STREAM ALERTS', ['alerts'],
                                                  lambda rel: rel.startswith('alerts/')),
    'official-dancing-banana-stream-scenes.zip': ('THE OFFICIAL DANCING BANANA - ANIMATED STREAM SCENES', ['scenes'],
                                                  lambda rel: rel.startswith('scenes/')),
    'official-dancing-banana-twitch-panels.zip': ('THE OFFICIAL DANCING BANANA - TWITCH PANELS', ['panels'],
                                                  lambda rel: rel.startswith('panels/')),
    'official-dancing-banana-webcam-frame.zip': ('THE OFFICIAL DANCING BANANA - WEBCAM FRAMES', ['webcam'],
                                                 lambda rel: rel.startswith('webcam-frames/')),
    'official-dancing-banana-stinger.zip': ('THE OFFICIAL DANCING BANANA - STINGER TRANSITION', ['stinger'],
                                            lambda rel: rel.startswith('stinger/')),
    'official-dancing-banana-bit-badges.zip': ('THE OFFICIAL DANCING BANANA - BIT BADGES', ['bits'],
                                               lambda rel: rel.startswith('bit-badges/')),
}
for _name, _, _ in EMOTES[1:]:   # the eleven emotes sold one at a time, like the classic
    PARTS['official-dancing-banana-%s-emote.zip' % _name] = ('THE OFFICIAL DANCING BANANA - THE %s EMOTE' % _name.upper(),
                                                             ['single-' + _name], lambda rel, n=_name: rel.startswith('emotes/%s/' % n))
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

# ── THE COVERS: each listing's FIRST photo, the one the shop grid and search show (Trym, 30 Sep: "photos makes them
# look the same though" — both cards showed the same dark emote board). Four looks that cannot be mistaken for each
# other: the full pack a bright yellow collage of everything, the emote pack the dark board, the badges deep navy with
# the medals, the classic emote hot pink with one big banana. ⚠️ Etsy crops a thumbnail 4:3, 3:4 or 1:1 by device (the
# first boards lost their title to the crop), so a cover is 2400 square with everything inside the centred 1700 square.
CV = 2400
SAFE = (350, 350, 2050, 2050)


def cover_bg(stops, ray_col, ray_peak=120):
    im = radial((CV, CV), CV // 2, CV // 2 + 100, stops)
    rl = ray_layer((CV, CV), CV // 2, CV // 2 + 100, 30, ray_col, start=-math.pi / 2 + 0.05)
    rl.putalpha(ImageChops.multiply(rl.getchannel('A'), fade_mask((CV, CV), CV // 2, CV // 2 + 100, 150, 1500, ray_peak)))
    im.alpha_composite(rl)
    return im


def framed(img, border=10, sh=18):
    """a picture in the pack's ink frame with its hard shadow"""
    out = Image.new('RGBA', (img.width + 2 * border + sh, img.height + 2 * border + sh), (0, 0, 0, 0))
    d = ImageDraw.Draw(out)
    d.rectangle((sh, sh, out.width - 1, out.height - 1), fill=INK)
    d.rectangle((0, 0, img.width + 2 * border - 1, img.height + 2 * border - 1), fill=INK)
    out.alpha_composite(img.convert('RGBA'), (border, border))
    return out


def cover_text(im, title, line, ty=470, fill=(255, 255, 255), line_fill=(255, 255, 255)):
    d = ImageDraw.Draw(im)
    f = font(170)
    while d.textlength(title, font=f) > SAFE[2] - SAFE[0] and f.size > 60:
        f = font(f.size - 6)
    outlined(d, (CV // 2, ty), title, f, fill=fill, sw=12, shadow=12)
    if line:
        f2 = font(56)
        while d.textlength(line, font=f2) > SAFE[2] - SAFE[0] and f2.size > 24:
            f2 = font(f2.size - 2)
        outlined(d, (CV // 2, ty + 150), line, f2, fill=line_fill, sw=6, shadow=5)


# 1 — the full pack: bright, everything in one picture
cv = cover_bg([(0.0, (255, 250, 214)), (0.4, (255, 226, 60)), (1.0, (232, 176, 0))], (255, 252, 225, 255))
cover_text(cv, 'FULL STREAM PACK', 'EMOTES  ·  BADGES  ·  ALERTS  ·  SCENES  ·  PANELS  ·  CAM FRAME  ·  STINGER')
scene = Image.open(os.path.join(OUT, 'scenes', 'starting-soon-1920x1080.png')).resize((1120, 630), Image.Resampling.LANCZOS)
fs = framed(scene)
cv.alpha_composite(fs, ((CV - fs.width) // 2, 720))
row = [cut(emote_stills[n][0][STILL], emote_stills[n][1], 250, emote_stills[n][3], 0) for n in ('hype', 'love', 'gg', 'cool')]
for k, t in enumerate(row):
    cv.alpha_composite(t, (560 + k * 330, 1410))
for k, m in enumerate((badge_arts['01-month'], badge_arts['12-months'], gem_arts[100000])):
    m = m.resize((250, 250), Image.Resampling.LANCZOS)
    cv.alpha_composite(m, (430 + k * 280, 1740))
pn = Image.open(os.path.join(OUT, 'panels', 'about-me-320x150.png'))
pn = pn.resize((pn.width * 2, pn.height * 2), Image.Resampling.NEAREST)
cv.alpha_composite(pn, (1300, 1720))
cv.convert('RGB').save(os.path.join(OUT, 'cover-full-stream-pack-2400.png'), optimize=True)

# 2 — the emote pack: the dark board, twelve faces
cv = cover_bg([(0.0, (44, 44, 56)), (0.5, (28, 28, 36)), (1.0, (16, 16, 20))], (60, 60, 74, 255), 160)
cover_text(cv, '12 EMOTES', 'ANIMATED + STILL  ·  TWITCH + DISCORD', fill=BANANA)
for k, (name, _, _) in enumerate(EMOTES):
    fr, sbx, _, eff = emote_stills[name]
    t = cut(fr[STILL], sbx, 330, eff, 0)
    cv.alpha_composite(t, (450 + (k % 4) * 390, 790 + (k // 4) * 400))
cv.convert('RGB').save(os.path.join(OUT, 'cover-emote-pack-2400.png'), optimize=True)

# 3 — the sub badges: deep navy, the medals
cv = cover_bg([(0.0, (46, 58, 110)), (0.5, (24, 30, 64)), (1.0, (10, 12, 30))], (80, 96, 170, 255), 140)
cover_text(cv, '6 SUB BADGES', 'BRONZE  ·  SILVER  ·  GOLD  ·  1 TO 12 MONTHS', fill=BANANA)
for k, (name, _, _) in enumerate(BADGES):
    m = badge_arts[name].resize((440, 440), Image.Resampling.LANCZOS)
    cv.alpha_composite(m, (440 + (k % 3) * 540, 780 + (k // 3) * 600))
cv.convert('RGB').save(os.path.join(OUT, 'cover-sub-badges-2400.png'), optimize=True)

# 4 — the classic emote: hot pink, one big banana
cv = cover_bg([(0.0, (255, 150, 170)), (0.45, (255, 90, 120)), (1.0, (214, 40, 78))], (255, 200, 212, 255), 120)
cover_text(cv, 'THE CLASSIC EMOTE', 'THE 1999 ORIGINAL  ·  ANIMATED')
big = edged(crisp_dance(30)[7], 10)
sh = Image.new('L', (CV, CV), 0)
ImageDraw.Draw(sh).ellipse((CV // 2 - 360, 1990, CV // 2 + 360, 2070), fill=90)
cv.paste((120, 10, 40, 255), mask=sh.filter(ImageFilter.GaussianBlur(18)))
cv.alpha_composite(big, ((CV - big.width) // 2, 2040 - big.height))
cv.convert('RGB').save(os.path.join(OUT, 'cover-classic-emote-2400.png'), optimize=True)

# 5 to 10 — the listings added 30 Sep, each in a colour of its own and showing only what it sells
cv = cover_bg([(0.0, (238, 216, 255)), (0.45, (150, 92, 236)), (1.0, (66, 26, 132))], (216, 190, 255, 255), 120)
cover_text(cv, '6 STREAM ALERTS', 'FOLLOW  ·  SUB  ·  GIFT SUB  ·  CHEER  ·  TIP  ·  RAID')
for k, (name, _, _) in enumerate(ALERTS):
    f7, box, eff = alert_src[name]
    t = cut(f7, box, 520, eff, 7)
    cv.alpha_composite(t, (380 + (k % 3) * 560, 720 + (k // 3) * 610))
cv.convert('RGB').save(os.path.join(OUT, 'cover-alerts-2400.png'), optimize=True)

cv = cover_bg([(0.0, (214, 240, 255)), (0.45, (70, 170, 250)), (1.0, (18, 76, 164))], (196, 230, 255, 255), 120)
cover_text(cv, 'ANIMATED SCENES', 'STARTING SOON  ·  BRB  ·  ENDING  ·  OFFLINE')
for k, (name, _) in enumerate(SCENES):
    sc = Image.open(os.path.join(OUT, 'scenes', name + '-1920x1080.png')).resize((780, 439), Image.Resampling.LANCZOS)
    cv.alpha_composite(framed(sc), (382 + (k % 2) * 830, 740 + (k // 2) * 520))
play_pill(cv, CV // 2, 1810, 1.5)
cv.convert('RGB').save(os.path.join(OUT, 'cover-scenes-2400.png'), optimize=True)

cv = cover_bg([(0.0, (222, 255, 214)), (0.45, (70, 200, 110)), (1.0, (14, 104, 52))], (204, 250, 204, 255), 120)
cover_text(cv, '13 TWITCH PANELS', '12 READY-MADE  ·  1 BLANK  ·  320 × 150')
for k, (words, _) in enumerate(PANELS[:6]):
    pn = Image.open(os.path.join(OUT, 'panels', words.lower().replace(' ', '-') + '-320x150.png'))
    pn = pn.resize((pn.width * 2, pn.height * 2), Image.Resampling.NEAREST)
    cv.alpha_composite(pn, (530 + (k % 2) * 700, 740 + (k // 2) * 380))
cv.convert('RGB').save(os.path.join(OUT, 'cover-panels-2400.png'), optimize=True)

cv = cover_bg([(0.0, (255, 214, 236)), (0.45, (230, 60, 140)), (1.0, (120, 10, 70))], (255, 190, 222, 255), 120)
cover_text(cv, 'WEBCAM FRAME', 'ANIMATED  ·  16:9  ·  4:3  ·  SQUARE')
cam = cam_frame(1400, 788, idx=7, inside=cam_placeholder(1400, 788), dancers=[edged(f, 4) for f in crisp_dance(10)])
cv.alpha_composite(cam, ((CV - cam.width) // 2, 2050 - cam.height))
cv.convert('RGB').save(os.path.join(OUT, 'cover-webcam-2400.png'), optimize=True)

cv = cover_bg([(0.0, (255, 236, 204)), (0.45, (255, 150, 50)), (1.0, (196, 76, 6))], (255, 214, 170, 255), 120)
cover_text(cv, 'STINGER TRANSITION', 'FOR OBS + STREAMLABS  ·  TRANSPARENT WEBM')
shot = framed(stinger_shot(6, (1560, 878)))
cv.alpha_composite(shot, ((CV - shot.width) // 2, 760))
play_pill(cv, CV // 2, 1760, 1.5)
cv.convert('RGB').save(os.path.join(OUT, 'cover-stinger-2400.png'), optimize=True)

cv = cover_bg([(0.0, (124, 94, 204)), (0.5, (60, 34, 130)), (1.0, (20, 10, 52))], (110, 84, 190, 255), 150)
cover_text(cv, '9 BIT BADGES', '1 TO 100K BITS  ·  TWITCH CHEER BADGES', fill=BANANA)
for k, (bits, _, _) in enumerate(GEMS):
    g = gem_arts[bits].resize((400, 400), Image.Resampling.LANCZOS)
    cv.alpha_composite(g, (540 + (k % 3) * 460, 720 + (k // 3) * 440))
cv.convert('RGB').save(os.path.join(OUT, 'cover-bit-badges-2400.png'), optimize=True)

# 11 to 21 — the eleven emotes sold one at a time: the whole banana dressed as the emote, on a colour of its own
SINGLE_BG = {
    'hype': ((238, 216, 255), (160, 100, 240), (80, 34, 160)),
    'love': ((255, 218, 232), (255, 104, 156), (190, 30, 90)),
    'cool': ((214, 240, 255), (60, 170, 255), (18, 86, 190)),
    'lol': ((236, 255, 208), (126, 212, 64), (52, 128, 16)),
    'gg': ((216, 224, 255), (72, 100, 224), (26, 36, 124)),
    'rip': ((236, 236, 246), (148, 148, 176), (70, 70, 96)),
    'evil': ((255, 200, 192), (222, 48, 48), (110, 8, 18)),
    'gn': ((104, 116, 196), (40, 48, 120), (12, 14, 46)),
    'gm': ((255, 238, 204), (255, 164, 66), (206, 94, 14)),
    'vibe': ((208, 255, 250), (28, 198, 190), (0, 104, 114)),
    'shiny': ((96, 84, 60), (44, 36, 24), (12, 10, 6)),
}
for name, _, effect in EMOTES[1:]:
    c0, c1, c2 = SINGLE_BG[name]
    cv = cover_bg([(0.0, c0), (0.45, c1), (1.0, c2)], lerp(c0, (255, 255, 255), 0.3) + (255,), 120)
    cover_text(cv, name.upper() + ' EMOTE', 'ANIMATED + STILL  ·  TWITCH + DISCORD', fill=BANANA if sum(c1) < 330 else (255, 255, 255))
    f7 = emote_stills[name][0][7]
    body = edged(f7.crop(f7.getbbox()), 10)
    side = max(body.width, body.height) + 240
    sq = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    sq.alpha_composite(body, ((side - body.width) // 2, side - body.height - 40))
    if effect:
        sq = fx(sq, effect, 7)
    sh = Image.new('L', (CV, CV), 0)
    ImageDraw.Draw(sh).ellipse((CV // 2 - 330, 1990, CV // 2 + 330, 2070), fill=90)
    cv.paste(lerp(c2, (0, 0, 0), 0.4) + (255,), mask=sh.filter(ImageFilter.GaussianBlur(18)))
    cv.alpha_composite(sq, ((CV - side) // 2, 2080 - side))
    cv.convert('RGB').save(os.path.join(OUT, 'cover-emote-%s-2400.png' % name), optimize=True)
print('covers')

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
     ['cover-full-stream-pack-2400.png', 'preview-emotes-2000.png', 'preview-badges-panels-2000.png', 'preview-scenes-2000.png',
      'preview-alerts-2000.png', 'preview-webcam-2000.png', 'preview-stinger-2000.png', 'preview-bit-badges-2000.png']),
    ('2-emote-pack', 'official-dancing-banana-emote-pack.zip', ['cover-emote-pack-2400.png', 'preview-emote-pack-2000.png']),
    ('3-sub-badges', 'official-dancing-banana-sub-badges.zip', ['cover-sub-badges-2400.png', 'preview-sub-badges-2000.png']),
    ('4-classic-emote', 'official-dancing-banana-classic-emote.zip', ['cover-classic-emote-2400.png', 'preview-classic-emote-2000.png']),
    ('5-stream-alerts', 'official-dancing-banana-stream-alerts.zip', ['cover-alerts-2400.png', 'preview-alerts-2000.png']),
    ('6-animated-scenes', 'official-dancing-banana-stream-scenes.zip', ['cover-scenes-2400.png', 'preview-scenes-2000.png']),
    ('7-twitch-panels', 'official-dancing-banana-twitch-panels.zip', ['cover-panels-2400.png', 'preview-panels-2000.png']),
    ('8-webcam-frame', 'official-dancing-banana-webcam-frame.zip', ['cover-webcam-2400.png', 'preview-webcam-2000.png']),
    ('9-stinger', 'official-dancing-banana-stinger.zip', ['cover-stinger-2400.png', 'preview-stinger-2000.png']),
    ('10-bit-badges', 'official-dancing-banana-bit-badges.zip', ['cover-bit-badges-2400.png', 'preview-bit-badges-2000.png']),
] + [('%d-emote-%s' % (11 + k, name), 'official-dancing-banana-%s-emote.zip' % name,
      ['cover-emote-%s-2400.png' % name, 'preview-emote-%s-2000.png' % name]) for k, (name, _, _) in enumerate(EMOTES[1:])]
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
