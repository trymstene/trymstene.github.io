# Coats: the same drawing, the fur ramp swapped for another the pack already has (27 Sep 2026).
from PIL import Image
from sprite import OUT, cell, strip, rows, save

ORANGE = {'d9a16a': 'L', 'ca8854': 'M', 'b35e3f': 'S', 'ab4a36': 'D', '6b5052': 'w'}
COATS = {
    # the pack's own grey tabby (Modern Interiors' animated cat): light, mid, dark, stripe, and its cool dark for inner lines
    'Grey': {'L': '9da3b7', 'M': '8b8bab', 'S': '6c6e85', 'D': '565972', 'w': '46465e'},
}


def recolour(im, coat):
    out = im.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            p = px[x, y]
            if p[3] == 0:
                continue
            h = '%02x%02x%02x' % p[:3]
            if h in ORANGE:
                n = coat[ORANGE[h]]
                px[x, y] = (int(n[0:2], 16), int(n[2:4], 16), int(n[4:6], 16), p[3])
    return out


orange = Image.open(OUT + 'Cat_Orange_16x16.png').convert('RGBA')
for name, coat in COATS.items():
    sh = recolour(orange, coat)
    sh.save(OUT + 'Cat_%s_16x16.png' % name)
    pick = [(2, 0), (4, 2), (6, 3), (2, 6), (2, 18), (12, 2), (14, 0)]
    save(rows([strip([cell(orange, r, c, 32, 32) for r, c in pick], 4, grid=False),
               strip([cell(sh, r, c, 32, 32) for r, c in pick], 4, grid=False)]), 'coats.png')
print('ok')
