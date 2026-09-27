# Drawing helpers for the cat (27 Sep 2026): cut frames from a sheet, blow them up to look at, save.
# The pack is read from OneDrive, never copied here; what this makes goes to tools/cat/out/ (gitignored:
# a full sheet derived from a bought pack must not reach this public repo, only the frames the site uses).
import os
from PIL import Image, ImageDraw

PACK = os.path.expanduser('~/OneDrive/banana-art-pack/').replace('\\', '/')
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out').replace('\\', '/') + '/'
os.makedirs(OUT, exist_ok=True)
FW, FH = 48, 32
BG = (58, 84, 58, 255)   # a grass-ish ground, like the game


def sheet(path):
    return Image.open(path).convert('RGBA')


def cell(sh, row, col, fw=FW, fh=FH):
    return sh.crop((col * fw, row * fh, col * fw + fw, row * fh + fh))


def zoom(im, k=10, grid=True, bg=BG):
    """blow a frame up k times on a flat ground, with a faint pixel grid"""
    base = Image.new('RGBA', im.size, bg)
    base.alpha_composite(im)
    big = base.resize((im.width * k, im.height * k), Image.NEAREST)
    if grid and k >= 6:
        d = ImageDraw.Draw(big)
        for x in range(0, big.width, k):
            d.line([(x, 0), (x, big.height)], fill=(0, 0, 0, 40))
        for y in range(0, big.height, k):
            d.line([(0, y), (big.width, y)], fill=(0, 0, 0, 40))
    return big


def strip(frames, k=10, gap=6, grid=True, bg=BG, labels=None):
    """frames side by side, each zoomed; optional small labels under each"""
    zs = [zoom(f, k, grid, bg) for f in frames]
    w = sum(z.width for z in zs) + gap * (len(zs) - 1)
    h = max(z.height for z in zs) + (14 if labels else 0)
    out = Image.new('RGBA', (w, h), (20, 20, 20, 255))
    x = 0
    d = ImageDraw.Draw(out)
    for i, z in enumerate(zs):
        out.paste(z, (x, 0))
        if labels:
            d.text((x + 2, z.height + 1), str(labels[i]), fill=(230, 230, 230, 255))
        x += z.width + gap
    return out


def rows(images, gap=8):
    w = max(i.width for i in images)
    h = sum(i.height for i in images) + gap * (len(images) - 1)
    out = Image.new('RGBA', (w, h), (20, 20, 20, 255))
    y = 0
    for i in images:
        out.paste(i, (0, y))
        y += i.height + gap
    return out


def palette(im):
    cols = {}
    for px in im.getdata():
        if px[3] > 0:
            cols[px] = cols.get(px, 0) + 1
    return sorted(cols.items(), key=lambda kv: -kv[1])


def save(im, name):
    os.makedirs(OUT, exist_ok=True)
    p = OUT + name
    im.save(p)
    return p
