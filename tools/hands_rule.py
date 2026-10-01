"""✋ TWO GLOVES, ONE THING EACH — the bake and print renderer's copy of src/lib/hands.js resolveHands (1 Oct 2026).

Trym, on the Citizens' board: "It shouldnt be possible to have two wearable items in one hand at the same time." The
engine and this mirror decide every glove the same way, in this order:
  1. what the moment put in your hand claims first (`raveOnly`: a beer at the rave, the broom at work);
  2. then a community item, on the glove it was drawn for; the newest on a glove wins it;
  3. then the game's own hand items in CATALOG order: their own glove, else the free one, else not drawn.
⚠️ Catalog order, never the outfit's own key order: the old mirror walked the outfit's keys and put the plush and the
glowstick in opposite gloves to the engine. tools/check-hands.mjs runs one table of cases through both and fails on
any difference. Pure Python on purpose (no Pillow), so the gate runs anywhere.

    python tools/hands_rule.py < cases.json     → each case's {left, right, ownLeft, ownRight}, as ids
"""
import json
import sys


def glove_of(c):
    return 'left' if (c or {}).get('hand') == 'left' else 'right'


def resolve_hands(defs, customs):
    """defs: the game's hand items that are on, in catalog order; customs: the community items worn, in order.
    Returns {'left', 'right'} (a game item or None) and 'own' {'left', 'right'} (a community item or None)."""
    out = {'left': None, 'right': None, 'own': {'left': None, 'right': None}}

    def free(g):
        return out[g] is None and out['own'][g] is None

    def put(d):
        pref = 'left' if d.get('hand') == 'left' else 'right'
        other = 'right' if pref == 'left' else 'left'
        if free(pref):
            out[pref] = d
        elif free(other):
            out[other] = d

    for d in [d for d in (defs or []) if d.get('raveOnly')]:
        put(d)
    for c in customs or []:
        if c and c.get('anchor') == 'hand' and out[glove_of(c)] is None:
            out['own'][glove_of(c)] = c
    for d in [d for d in (defs or []) if not d.get('raveOnly')]:
        put(d)
    return out


if __name__ == '__main__':
    cases = json.load(sys.stdin)
    res = []
    for case in cases:
        r = resolve_hands(case.get('defs'), case.get('customs'))
        idof = lambda x: (x or {}).get('id')
        res.append({'left': idof(r['left']), 'right': idof(r['right']),
                    'ownLeft': idof(r['own']['left']), 'ownRight': idof(r['own']['right'])})
    sys.stdout.write(json.dumps(res))
