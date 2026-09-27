# Every side-view (right-facing) cat frame, converted from the Basenji's own frame (27 Sep 2026).
import copy
import bas
from convert import clear_box, reoutline

ROWS = {'static': 0, 'idle': 2, 'walk': 4, 'run': 6, 'eat': 8, 'bark': 10}
COUNT = {'static': 1, 'idle': 6, 'walk': 6, 'run': 6, 'eat': 6, 'bark': 3}
FILL = set('LMSDXWYkhigCPpEenmj')
WIDEN = 2        # the body is two columns longer than the Basenji's
LEG_ROW = 27     # one leg row goes: a cat stands lower

# heads: fill only; each is placed so its 'E' lands where the dog's eye was
HEAD = [
    '.M....D..',
    '.M...DD..',
    'MPM..SD..',
    'MPLMSSS..',
    'MLLLLLLM.',
    'MLLLLLLLW',
    'SLLLEoLWW',
    'SLLLLWWWP',
    '.SMLWWW..',
    '..SS.....',
]
HEAD_MEOW = [      # the mouth open: the jaw drops, a dark gape and a pink tongue
    '.M....D..',
    '.M...DD..',
    'MPM..SD..',
    'MPLMSSS..',
    'MLLLLLLM.',
    'MLLLLLLLW',
    'SLLLEoLWW',
    'SLLLLWWWP',
    '.SMLWmpp.',
    '..SSWW...',
]
HEAD_EAT = [       # lowered to the ground: the ears tip forward, the muzzle points down
    '..M....D.',
    '.MPM..DD.',
    '.MPLMSSD.',
    'MLLLLLLM.',
    'MLLLLLLLW',
    'SLLLEoLWW',
    'SLLLLLWWW',
    '.SLLLWWWP',
    '..SSWWW..',
]
EYE = {id(HEAD): (4, 6), id(HEAD_MEOW): (4, 6), id(HEAD_EAT): (4, 5)}

# tails: fill only; the last row is the base, sitting on the rump's back line
TAIL_UP = [
    '...LMD',
    '..LMS.',
    '.LM...',
    '.LM...',
    '.SS...',
    '.LM...',
    '.LM...',
    '..SS..',
    '...LM.',
]
TAIL_HIGH = [     # the tip curls further over
    '..LMD.',
    '.LMS..',
    '.LM...',
    '.LM...',
    '.SS...',
    '.LM...',
    '.LM...',
    '..SS..',
    '...LM.',
]
TAIL_LOW = [      # a lazier sway, leaning back
    '....MD',
    '...LS.',
    '..LM..',
    '.LM...',
    '.SS...',
    'LM....',
    'LM....',
    '.SS...',
    '..LMM.',
]
TAIL_RUN = [      # streaming back, a little up
    'MD......',
    'LMS.....',
    '.LMSS...',
    '...LMMM.',
]
BASE_COL = {id(TAIL_UP): 3, id(TAIL_HIGH): 3, id(TAIL_LOW): 3, id(TAIL_RUN): 5}


def find_eye(g):
    for y in range(32):
        for x in range(32):
            if g[y][x] == 'C':
                return x, y
    return None


def first_row(g, x):
    for y in range(32):
        if g[y][x] != '.':
            return y
    return None


def widen(g, x, n):
    g = copy.deepcopy(g)
    for row in g:
        for _ in range(n):
            row.insert(x, row[x])
    return g


def drop_row(g, y):
    g = copy.deepcopy(g)
    del g[y]
    g.insert(0, ['.'] * len(g[0]))
    return g


def cat_side(anim, i):
    g = bas.frame(ROWS[anim], i)
    ex, ey = find_eye(g)
    tip_y = min((y for y in range(32) for x in range(0, 12) if g[y][x] in FILL), default=15)
    rump_y = first_row(g, 12)            # the back's own top outline, clear of the curl
    # the dog's curl goes (everything above the back line on the rump side, and the line's tail pixels)
    clear_box(g, 0, 0, 11, rump_y)
    # the dog's head goes
    if anim == 'eat':
        clear_box(g, 19, ey - 7, 31, ey + 3)
    else:
        clear_box(g, 17, 0, 31, ey)
        clear_box(g, 21, ey + 1, 31, ey + 3)
    # a ginger tabby's bands across the back
    for x in (8, 11, 14):
        for dy, ch in ((1, 'M'), (2, 'S')):
            y = rump_y + dy
            if g[y][x] in 'LM':
                g[y][x] = ch
    g = widen(g, 12, WIDEN)
    # the head, on the dog's eye
    if anim == 'eat':
        head, lift = HEAD_EAT, 0
    elif anim == 'bark' and i == 1:
        head, lift = HEAD_MEOW, 1
    else:
        head, lift = HEAD, 1
    cx, cy = EYE[id(head)]
    bas.paste(g, head, ex + WIDEN - cx, ey - lift - cy)
    # the tail, on the rump
    rear = min(x for x in range(len(g[0])) if g[rump_y + 1][x] in FILL)
    if anim == 'run':
        tail = TAIL_RUN
    else:
        tail = TAIL_HIGH if tip_y <= 14 else TAIL_LOW if tip_y >= 16 else TAIL_UP
    bas.paste(g, tail, rear + 1 - BASE_COL[id(tail)], rump_y - (len(tail) - 1))
    g = drop_row(g, LEG_ROW)
    g = [r[:32] for r in g]   # back to the Basenji's 32x32 frame (the two added columns fit inside it)
    reoutline(g)
    return g


def all_side():
    out = {}
    for anim in ROWS:
        out[anim] = [cat_side(anim, i) for i in range(COUNT[anim])]
    return out
