# The cat seen from behind ("up") and from the front ("down"), converted from the Basenji's own frames.
import copy
import bas
from convert import clear_box, reoutline, FILL
from side import drop_row, LEG_ROW

ROWS = {'static': 0, 'idle': 2, 'walk': 4, 'run': 6, 'eat': 8, 'bark': 10, 'happy': 12}
UP_COL = {'static': (1, 1), 'idle': (6, 6), 'walk': (6, 6), 'run': (6, 6), 'eat': (6, 6), 'bark': (3, 3)}
DOWN_COL = {'static': (3, 1), 'idle': (18, 6), 'walk': (18, 6), 'run': (18, 6), 'eat': (18, 6), 'bark': (9, 3), 'happy': (0, 6)}

# ---- from behind: the back of a round head, two ear-backs (no pink: it faces away)
HEAD_BACK = [
    '.M.......M.',
    'MLM.....MLM',
    'MLLMMMMMLLM',
    'SLLLLLLLLLS',
    'SMLLLLLLLMS',
    '.SMMLLLMMS.',
    '..SSSSSSS..',
]
# the tail rising from the rump up the middle of the back, tip curling over: its own outline, as it lies on the fur
TAIL_BACK = [
    '.ooo.',
    'oMDDo',
    'wLMo.',
    'wLMw.',
    'wSSw.',
    'wLMw.',
    'wLMw.',
    'wSSw.',
    'wLMw.',
]
TAIL_BACK_SWAY = [   # the tip leaning the other way, for the sway
    '.ooo.',
    'oDDMo',
    '.oLMw',
    '.wLMw',
    '.wSSw',
    '.wLMw',
    'wLMw.',
    'wSSw.',
    'wLMw.',
]

# ---- from the front: a cat's face (pink in the ears, a tabby M on the brow, green eyes, pink nose, white muzzle)
FACE = [
    '.oLLLLLLLo.',   # between the ears: the body behind, then the head's own top line
    'oMoMMMMMoMo',
    'oMPoooooPMo',
    'MPMMLLLMMPM',
    'MMLLMLMLLMM',
    'SLLLLLLLLLS',
    'SLEoLLLoELS',
    'SLLLLWLLLLS',
    'SLLWWPWWLLS',
    '.SWWWWWWWS.',
    '..SWWWWWS..',
    '...SSSSS...',
]
FACE_MEOW = [
    '.oLLLLLLLo.',
    'oMoMMMMMoMo',
    'oMPoooooPMo',
    'MPMMLLLMMPM',
    'MMLLMLMLLMM',
    'SLLLLLLLLLS',
    'SLEoLLLoELS',
    'SLLLLWLLLLS',
    'SLLWWPWWLLS',
    '.SWWmppWWS.',
    '..SWmpWWS..',
    '...SSSSS...',
]
def shut(face):
    return [r if y != 6 else r.replace('Eo', 'qq').replace('oE', 'qq') for y, r in enumerate(face)]


FACE_HAPPY = shut(FACE)
FACE_HAPPY_MEOW = shut(FACE_MEOW)
FACE_EAT = [      # the head tipped down to the bowl: more brow, the eyes cast down, only the nose tip shows
    '.oLLLLLLLo.',
    'oMoMMMMMoMo',
    'oMPoooooPMo',
    'MPMMLLLMMPM',
    'MMLLMLMLLMM',
    'SLLLLMLLLLS',
    'SLLLLMLLLLS',
    'SLLLLLLLLLS',
    'SLqqLLLqqLS',
    'SLLLLWLLLLS',
    '.SLLWPWLLS.',
    '..SSWWWSS..',
]
FACE_EYE_ROW = 6          # the row of the eyes in FACE
# the tail tip above the back, seen from the front (it rises behind the body)
TAIL_FRONT = [
    '.ooo.',
    'oLMDo',
    'oLo..',
    'oMLo.',
    '.oSSo',
    '.oLMo',
    '.oLMo',
]
TAIL_FRONT_SWAY = [
    '.ooo.',
    'oDMLo',
    '..oLo',
    '.oLMo',
    'oSSo.',
    'oLMo.',
    'oLMo.',
]


def rows_with(g, pred):
    return [y for y in range(len(g)) if any(pred(ch) for ch in g[y])]


BACK_HEAD = [
    '.M.......M.',
    '.MM.....MM.',
    '.MDM...MDM.',
    '.MDLMMMLDM.',
    '.SLLLLLLLS.',
    '.SMLLLLLMS.',
    '..SMLLLMS..',
]
BACK_ROWS = ['.SLLLLLLLS.', '.SLLMMMLLS.', '.SLLLLLLLS.', '.SMLLLLLMS.']   # the back: a tabby band every few rows
BACK_HAUNCH = ['SLLLLLLLLLS', 'SLLLMMMLLLS', 'SLLLLLLLLLS']                 # the hips, wider than the shoulders
BACK_RUMP = [
    'SSLLLLLLLSS',
    '.SSMMMMMSS.',
    '..SSSSSSS..',
]
# the tail from behind: out of the rump and up beside the right hip, clear of the body
TAIL_SIDE = [
    '..DD.',
    '.MLo.',
    '.LM..',
    '.SS..',
    'LM...',
    'LM...',
    'M....',
]
TAIL_SIDE_HIGH = [
    '.DD..',
    'MLo..',
    'LM...',
    'LM...',
    'SS...',
    'LM...',
    'M....',
]


def crotch_row(g, cx):
    """where the hips meet the hind legs: the first row (from the bottom half) with a run of outline between the legs"""
    for y in range(14, 31):
        row = ''.join(g[y][cx - 3:cx + 4])
        if 'ooo' in row:
            return y
    return 26


def cat_up(anim, i):
    col0, n = UP_COL[anim]
    g = bas.frame(ROWS[anim], col0 + (i if anim != 'static' else 0))
    top = min(rows_with(g, lambda ch: ch != '.'))
    xs = [x for y in range(32) for x in range(32) if g[y][x] != '.']
    cx = (min(xs) + max(xs)) // 2
    cr = crotch_row(g, cx)
    clear_box(g, cx - 8, 0, cx + 8, cr - 1)
    body = list(BACK_HEAD)
    k = 0
    while len(body) + len(BACK_HAUNCH) + len(BACK_RUMP) < cr - top + 1:
        body.append(BACK_ROWS[k % len(BACK_ROWS)]); k += 1
    body += BACK_HAUNCH + BACK_RUMP
    y0 = cr + 1 - len(body)
    bas.paste(g, body, cx - 5, y0)
    t = TAIL_SIDE if (i % 2) == 0 else TAIL_SIDE_HIGH
    bas.paste(g, t, cx + 6 if t is TAIL_SIDE else cx + 7, cr - len(t) + 1)
    g = drop_row(g, LEG_ROW)
    reoutline(g)
    return g


def cat_down(anim, i):
    col0, n = DOWN_COL[anim]
    row = ROWS[anim]
    g = bas.frame(row, col0 + (i if anim != 'static' else 0))
    eyes = [(x, y) for y in range(32) for x in range(32) if g[y][x] == 'C']
    ey = eyes[0][1] if eyes else 21
    xs = [x for y in range(32) for x in range(32) if g[y][x] != '.']
    cx = (min(xs) + max(xs)) // 2
    top = min(rows_with(g, lambda ch: ch != '.'))
    # the dog's face goes (from its ears down to its chin) and its curl above the back
    clear_box(g, cx - 6, ey - 3, cx + 6, ey + 4)
    clear_box(g, cx - 3, top, cx + 3, top + 3)
    # the dog's whites above the face (its chest and leg tops, seen as it runs) are the cat's orange fur
    WHITE_TO_FUR = {'W': 'L', 'Y': 'L', 'k': 'M', 'i': 'M', 'h': 'S', 'g': 'S', 'j': 'S'}
    for y in range(0, ey - 3):
        for x in range(len(g[0])):
            if g[y][x] in WHITE_TO_FUR:
                g[y][x] = WHITE_TO_FUR[g[y][x]]
    if anim == 'happy':
        face = FACE_HAPPY_MEOW if i in (2, 3) else FACE_HAPPY
    elif anim == 'eat':
        face = FACE_EAT
    else:
        face = FACE_MEOW if (anim == 'bark' and i == 1) else FACE
    bas.paste(g, face, cx - 5, ey - FACE_EYE_ROW)
    # the tail tip rising behind the back
    tf = (TAIL_FRONT if i % 2 == 0 else TAIL_FRONT_SWAY) if anim == 'happy' else (TAIL_FRONT if (i % 3) != 2 else TAIL_FRONT_SWAY)
    bas.paste(g, tf, cx, top - 3)
    g = drop_row(g, LEG_ROW)
    reoutline(g)
    return g
