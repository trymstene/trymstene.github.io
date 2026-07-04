# find-hand-anchors.py — locate the banana's white gloves on every dance frame.
#
# Adds HAND anchors to the per-frame anchor registry (FRAMES in
# src/lib/banana-engine.js) so accessories can be HELD, not just worn.
# Same doctrine as the hat/eye anchors: measured from the real sprite
# pixels with Pillow, never eyeballed.
#
# Method: per frame, collect near-white opaque pixels (the gloves are the
# only large white blobs outside the face), exclude a box around the face
# (the eye whites), flood-fill cluster what remains, keep the two biggest
# clusters = the two gloves. Emits a JS-ready `hands` array per frame,
# sorted left-to-right in screen space.
#
# Run:  python tools/find-hand-anchors.py
from PIL import Image
from collections import deque

FW, FH, NFRAMES = 469, 498, 8
# eye anchors from banana-engine.js FRAMES — the exclusion zone centre
EYES = [(232, 222), (232, 192), (234, 135), (232, 156),
        (236, 222), (236, 192), (234, 135), (237, 156)]
FACE_BOX = 95  # half-width of the face exclusion box around the eye anchor

img = Image.open('public/assets/banana-dance.png').convert('RGBA')
assert img.size == (FW * NFRAMES, FH), f'unexpected sheet size {img.size}'
px = img.load()

def clusters_for_frame(f):
    ex, ey = EYES[f]
    x0 = f * FW
    white = set()
    for y in range(FH):
        for x in range(FW):
            r, g, b, a = px[x0 + x, y]
            if a > 200 and r >= 225 and g >= 225 and b >= 225:
                if abs(x - ex) < FACE_BOX and abs(y - ey) < FACE_BOX:
                    continue  # eye whites / teeth
                white.add((x, y))
    # flood fill into clusters
    out = []
    seen = set()
    for start in list(white):
        if start in seen:
            continue
        q, blob = deque([start]), []
        seen.add(start)
        while q:
            cx, cy = q.popleft()
            blob.append((cx, cy))
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    n = (cx + dx, cy + dy)
                    if n in white and n not in seen:
                        seen.add(n)
                        q.append(n)
        out.append(blob)
    out.sort(key=len, reverse=True)
    return out

SHOE_Y = 420  # the white SHOES also cluster (y≈470) — gloves live above this line

print('frame | clusters(size,cy) | glove centres (x,y) left->right')
js_rows = []
for f in range(NFRAMES):
    cl = clusters_for_frame(f)
    info = []
    gloves = []
    for blob in cl[:6]:
        cx = round(sum(p[0] for p in blob) / len(blob))
        cy = round(sum(p[1] for p in blob) / len(blob))
        info.append((len(blob), cy))
        if cy < SHOE_Y and len(blob) > 200:
            gloves.append((cx, cy))
    centres = sorted(gloves)[:2]
    print(f'  {f}   | {info} | {centres}')
    assert len(centres) == 2, f'frame {f}: expected 2 gloves, got {len(centres)}'
    js_rows.append(centres)

print('\nJS (hands: [[x,y],[x,y]] left→right, paste into FRAMES):')
for f, c in enumerate(js_rows):
    print(f'  frame {f}: hands: [[{c[0][0]}, {c[0][1]}], [{c[1][0]}, {c[1][1]}]],')
