# The Basenji (Modern Farm, orange) as editable letter grids, and back to pixels (27 Sep 2026).
from PIL import Image
from sprite import PACK, sheet, cell

BAS = PACK + 'Modern_Farm_v1.2/16x16/Animals_16x16/Dogs/Dog_Basenji_Orange_16x16.png'
F = 32  # the Basenji's frame: 32x32 at the pack's 16x16 scale

# every colour the Basenji uses, by letter (orange ramp, LimeZu's cool whites, outline, the face)
HEX = {
    'o': '3a3a50', 'w': '6b5052',
    'L': 'd9a16a', 'M': 'ca8854', 'S': 'b35e3f', 'D': 'ab4a36', 'X': '754632',
    'q': '46465e', 'r': '565972', 'j': '6c6e85', 'g': '8b8bab', 'h': '989ebe', 'i': 'b2aecb',
    'k': 'c6bdd5', 'W': 'd8d0e0', 'Y': 'ebe4f2', 'C': 'e0d0b2', 'P': 'ff8575',
    'm': '6b383b', 'n': 'a82b2d',
    # the cat's own, added to the Basenji's colours
    'p': 'd56868',   # a deeper pink: the open mouth (LimeZu's Palette.png)
    'E': '9bc246',   # a green eye (LimeZu's Palette.png)
    'e': '63a650',   # its darker green (LimeZu's Palette.png)
    's': '3a3a50',   # (shadow drawn semi-transparent, see to_image)
}
RGB = {k: tuple(int(v[i:i + 2], 16) for i in (0, 2, 4)) for k, v in HEX.items()}
BACK = {v: k for k, v in HEX.items() if k not in ('s', 'E', 'e')}


def frame(row, col):
    """a Basenji frame as a list of lists of letters ('.' = empty)"""
    im = cell(sheet(BAS), row, col, F, F)
    out = []
    for y in range(F):
        line = []
        for x in range(F):
            p = im.getpixel((x, y))
            if p[3] == 0:
                line.append('.')
            elif p[3] < 255:
                line.append('s')
            else:
                line.append(BACK.get('%02x%02x%02x' % p[:3], '?'))
        out.append(line)
    return out


def text(g, x0=0, y0=0, x1=None, y1=None):
    x1 = x1 or len(g[0]); y1 = y1 or len(g)
    return '\n'.join(''.join(r[x0:x1]) for r in g[y0:y1])


def to_image(g):
    h, w = len(g), len(g[0])
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    for y in range(h):
        for x in range(w):
            ch = g[y][x]
            if ch == '.':
                continue
            if ch == 's':
                im.putpixel((x, y), RGB['o'] + (100,))
            else:
                im.putpixel((x, y), RGB.get(ch, (255, 0, 255)) + (255,))
    return im


def paste(g, part, x0, y0, clear=True):
    """a part (list of strings) onto a grid; '.' in the part leaves the grid alone,
    ',' in the part clears the grid pixel (to cut away what was there)"""
    for y, row in enumerate(part):
        for x, ch in enumerate(row):
            if ch == '.':
                continue
            X, Y = x0 + x, y0 + y
            if 0 <= Y < len(g) and 0 <= X < len(g[0]):
                g[Y][X] = '.' if ch == ',' else ch
    return g
