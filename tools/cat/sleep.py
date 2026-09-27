# The sleeping cat: lying long like the pack's own lying cat, head at the front end, eyes shut,
# the tail round the front; 8 frames of breathing with a tail-tip twitch and one ear flick (27 Sep 2026).
import copy
import bas
from convert import reoutline, FILL

SLEEP = [
    '............M.....M....',
    '...........MPM...MPM...',
    '...........MLLMMMMLLM..',
    '.....LLLLLwMLLLMLMLLLM.',
    '...LLLMLLMwLLLLLLLLLLL.',
    '..LLLLMLLMwLLLLLLLLLLLS',
    '.LLLLLMLLMwLLqqLLLLqqLS',
    'LLMLLLMLLMwLLLLLWPWLLLS',
    'LMMLLLLLLLLwLLLWWWWWLS.',
    'SSMMLLLLLLMMwSWWWWWWS..',
    '.SSwwwwwwwwwwwSSWWWSW..',
    '.LLLLDLLLDLLLLLMMWWWW..',
    '..MMMSMMMSMMMMSDD......',
]
X0, Y0 = 5, 17            # the bottom outline lands on row 30, the standing frames' ground line
BACK = range(3, 10)       # the body's columns that rise when it breathes in (the head keeps still)


def base():
    g = [['.'] * 32 for _ in range(32)]
    bas.paste(g, SLEEP, X0, Y0)
    return g


def breathe_in(g):
    for x in BACK:
        X = X0 + x
        top = next(y for y in range(32) if g[y][X] in FILL)
        g[top - 1][X] = g[top][X]
    return g


def tail_flick(g):
    # the tip lifts off the ground and stands up in front of the paws
    bas.paste(g, ['..D', '..M', 'SM,'], X0 + 14, Y0 + 10)
    return g


def ear_flick(g):
    # the near ear folds back for a moment
    bas.paste(g, [',,,', ',MP', 'MLL'], X0 + 11, Y0)
    return g


def cat_sleep(i):
    g = base()
    if i in (2, 3, 4):
        breathe_in(g)
    if i in (4, 5):
        tail_flick(g)
    if i == 7:
        ear_flick(g)
    reoutline(g)
    return g
