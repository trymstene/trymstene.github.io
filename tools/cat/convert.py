# Basenji frame -> cat frame: cut the dog's head and tail away, paint the cat's in, re-outline (27 Sep 2026).
import bas

OUTLINE = set('owqr')
FILL = set('LMSDXWYkhigCPpEenmj')


def clear_box(g, x0, y0, x1, y1, keep=None):
    """empty a box (inclusive); keep(x, y, ch) may spare a pixel"""
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if 0 <= y < len(g) and 0 <= x < len(g[0]):
                if keep and keep(x, y, g[y][x]):
                    continue
                g[y][x] = '.'
    return g


def reoutline(g):
    h, w = len(g), len(g[0])
    isfill = lambda x, y: 0 <= x < w and 0 <= y < h and g[y][x] in FILL
    # 1. drop outline pixels that no longer touch any fill (8-neighbourhood)
    for y in range(h):
        for x in range(w):
            if g[y][x] in OUTLINE and not any(isfill(x + dx, y + dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1) if dx or dy):
                g[y][x] = '.'
    # 2. every empty pixel beside fill (4-neighbourhood) becomes outline
    add = [(x, y) for y in range(h) for x in range(w)
           if g[y][x] == '.' and (isfill(x - 1, y) or isfill(x + 1, y) or isfill(x, y - 1) or isfill(x, y + 1))]
    for x, y in add:
        g[y][x] = 'o'
    return g
