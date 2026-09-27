# The cat's sheet in the Basenji's exact layout (27 Sep 2026): 24 columns x 15 rows of 32x32 frames at the
# pack's 16x16 scale, the label rows in the pack's own letters, then x2 and x3 like the pack's 32x32/48x48 sheets.
# Trym asked for it (27 Sep 2026): a cat drawn from the dog sprites, same frames as the dog, a bit smaller, in the
# pack's own style. Every frame is converted from the Basenji's own (side.py, updown.py) or drawn to its grid (sleep.py).
# Run: python tools/cat/build_sheet.py   → tools/cat/out/Cat_Orange_{16x16,32x32,48x48}.png
from PIL import Image, ImageOps
import bas, side, updown, sleep
from sprite import sheet, OUT

F = 32
dog = sheet(bas.BAS)
NAVY = (58, 58, 80, 255)
BAR = (235, 228, 242, 255)
cat = Image.new('RGBA', dog.size, (0, 0, 0, 0))


def put(im, row, col):
    cat.alpha_composite(im, (col * F, row * F))


def mirror(im):
    # the pack's left-facing frames are its right-facing ones mirrored and moved one pixel left
    m = ImageOps.mirror(im)
    out = Image.new('RGBA', im.size, (0, 0, 0, 0))
    out.alpha_composite(m.crop((1, 0, im.width, im.height)), (0, 0))
    return out


img = lambda g: bas.to_image(g)

# ---- row 0: static right, up, left, down; the sheet's info labels copied as they are (still true for the cat)
right = img(side.cat_side('static', 0))
put(right, 0, 0)
put(img(updown.cat_up('static', 0)), 0, 1)
put(mirror(right), 0, 2)
put(img(updown.cat_down('static', 0)), 0, 3)
cat.alpha_composite(dog.crop((6 * F, 0, 24 * F, F)), (6 * F, 0))

# ---- the four-way rows: right 0-5, up 6-11, left 12-17, down 18-23
for anim, row in (('idle', 2), ('walk', 4), ('run', 6), ('eat', 8)):
    for i in range(6):
        r = img(side.cat_side(anim, i))
        put(r, row, i)
        put(img(updown.cat_up(anim, i)), row, 6 + i)
        put(mirror(r), row, 12 + i)
        put(img(updown.cat_down(anim, i)), row, 18 + i)

# ---- meow (the dog's bark row): right 0-2, up 3-5, left 6-8, down 9-11
for i in range(3):
    r = img(side.cat_side('bark', i))
    put(r, 10, i)
    put(img(updown.cat_up('bark', i)), 10, 3 + i)
    put(mirror(r), 10, 6 + i)
    put(img(updown.cat_down('bark', i)), 10, 9 + i)

# ---- happy (front view, 6) and sleep (8)
for i in range(6):
    put(img(updown.cat_down('happy', i)), 12, i)
for i in range(8):
    put(img(sleep.cat_sleep(i)), 14, i)

# ---- labels: the pack's own bars; MEOW and SLEEP set in the pack's own letters
for row in (1, 3, 5, 7, 11):
    cat.alpha_composite(dog.crop((0, row * F, 24 * F, row * F + F)), (0, row * F))


def text_rows(row):
    # the letters sit in the bar (the lower 16 rows); the doghouse picture above shares the navy, so it is left out
    band = dog.crop((0, row * F, 160, row * F + F))
    return [y for y in range(16, F) if any(band.getpixel((x, y)) == NAVY for x in range(160))]


def glyph(row, x0, x1, only=None):
    """the navy pixels of one letter on a label row, relative to its left edge and the text's top"""
    top = text_rows(row)[0]
    px = []
    for y in range(9):
        for x in range(x0, x1 + 1):
            if dog.getpixel((x, row * F + top + y)) == NAVY and (only is None or only(x, y)):
                px.append((x - x0, y))
    return px, x1 - x0 + 1


def bar_with(row, letters, x=3):
    """a blank 192-wide label bar (copied from BARK's) with letters set 1px apart"""
    base = dog.crop((0, 9 * F, 24 * F, 9 * F + F))
    top = text_rows(9)[0]
    for yy in range(top, top + 9):
        for xx in range(0, 192):
            if base.getpixel((xx, yy)) == NAVY:
                base.putpixel((xx, yy), BAR)
    for px, w in letters:
        for dx, dy in px:
            base.putpixel((x + dx, top + dy), NAVY)
        x += w + 1
    cat.alpha_composite(base, (0, row * F))


M = glyph(11, 5, 13)                                  # IMPATIENT's M
E = glyph(13, 126, 131)                               # DOGHOUSE's E
O = glyph(13, 72, 79)                                 # DOGHOUSE's first O
W = glyph(3, 2, 14, only=lambda x, y: x < 14 or y < 2)  # WALK's W, without the A it leans on
S = glyph(13, 1, 7)
L = glyph(13, 9, 14)
P = glyph(13, 32, 38)
bar_with(9, [M, E, O, W])
bar_with(13, [S, L, E, E, P])

cat.save(OUT + 'Cat_Orange_16x16.png')
cat.resize((cat.width * 2, cat.height * 2), Image.NEAREST).save(OUT + 'Cat_Orange_32x32.png')
cat.resize((cat.width * 3, cat.height * 3), Image.NEAREST).save(OUT + 'Cat_Orange_48x48.png')
# a look at the whole sheet on the pack's own dark green, 2x
look = Image.new('RGBA', cat.size, (41, 60, 41, 255)); look.alpha_composite(cat)
look.resize((cat.width * 2, cat.height * 2), Image.NEAREST).save(OUT + 'sheet-look.png')
print('ok', cat.size)
