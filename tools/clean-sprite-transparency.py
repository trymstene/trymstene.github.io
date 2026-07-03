# clean-sprite-transparency.py — THE fix for the 1999 white-background
# extraction dirt in the dancing-banana sprite (July 2026 "white-pixel saga",
# solved after FOUR wrong attempts — see memory: generator-asset-notes).
#
# SYMPTOM: white/grey patches on transparent backgrounds — at glove inner
# edges, between arm and body, at the crotch — visible in the builder preview,
# exported GIFs, and the hub's dancing-banana-transparent.gif.
#
# THE THREE DIRT CLASSES (each defeated a naive fix):
#   1. Pure-white speckles/strips touching transparency (small components).
#   2. A grey ANTI-ALIASING HALO around the whole silhouette (RGB ~124-228,
#      white bg blended into the black outline) — invisible to "white>235"
#      thresholds.
#   3. Enclosed white GAP PATCHES between arm and body — up to 1475px
#      (GLOVE-SIZED, so size filters fail) and fully surrounded by black
#      (so transparency-adjacency audits fail). Identified only by
#      classifying components against the sprite's known anatomy:
#      per frame = 2 eye whites (side frames: far eye SPLIT in two 141-202px
#      halves by the pupil — do NOT auto-delete!), 2 gloves, 2 shoes.
#
# THE ALGORITHM (per-pixel classification — removal is the wrong verb half
# the time; grey edge pixels next to white objects are MISSING OUTLINE):
#   dark (max<=110)            -> keep (outline, legs)
#   saturated (max-min>=35)    -> keep (yellow body, red mouth)
#   white-strong (min>=235)    -> keep — NEVER deleted except the
#                                 seed-approved gap patches and <=400px
#                                 white components touching transparency
#   grey AA (the rest)         -> BLACK if any 8-neighbour is white-strong
#                                 (missing outline of a white object),
#                                 else TRANSPARENT (halo outside the outline)
# HARD INVARIANTS printed per frame (all must be 0):
#   whiteLost / brightNonWhiteEdge / whiteTouchingBg
#
# VERIFICATION (non-negotiable, this is where the four wrong fixes died):
#   - run audits on RAW asset pixels, never through a scaled canvas
#     (the 720px preview downscales ~0.87x and silently drops 1px dirt)
#   - render an all-8-frames magenta grid AND 3x zoom crops of gaps,
#     gloves, shoes, and faces — whole-frame eyeballing misses 1-2px damage
#   - after deploy: chrome-devtools MCP -> draw live sheet frames on a loud
#     bg in a real browser and screenshot
#
# USAGE: python tools/clean-sprite-transparency.py
#   Input = the ORIGINAL dirty sheet extracted from git history:
#     cmd /c "git show 8b7b626:public/assets/banana-dance.png > %TEMP%\original-sheet.png"
#   Outputs: cleaned public/assets/banana-dance.png + regenerated
#   dancing-banana-transparent.gif (100ms, disposal=2). After running:
#   bump ?v=N in SHEET_SRC (banana-builder.js) to bust caches.
from PIL import Image
from collections import deque
import os

ORIG = os.path.expandvars(r'%TEMP%\original-sheet.png')
HERE = os.path.dirname(os.path.abspath(__file__))
SHEET = os.path.join(HERE, '..', 'public', 'assets', 'banana-dance.png')
GIF = os.path.join(HERE, '..', 'public', 'assets', 'dancing-banana-transparent.gif')
OUTDIR = os.environ.get('TEMP', '.')

fw, H = 469, 498
sheet = Image.open(ORIG).convert('RGBA')
frames = [sheet.crop((i * fw, 0, (i + 1) * fw, H)).copy() for i in range(8)]

def cls(p):
    r, g, b, a = p
    if a == 0:
        return 'bg'
    mx, mn = max(r, g, b), min(r, g, b)
    if mx <= 110:
        return 'dark'
    if mx - mn >= 35:
        return 'sat'
    if mn >= 235:
        return 'white'
    return 'grey'

# gap-patch seeds on the ORIGINAL sheet (same anatomy as before)
DIRT_SEEDS = {0: [(326, 375), (177, 395), (290, 418)],
              4: [(142, 375), (290, 395), (177, 418)]}
OUTLINE = (17, 17, 17, 255)

for i, f in enumerate(frames):
    px = f.load()
    white_before = sum(1 for y in range(H) for x in range(fw) if cls(px[x, y]) == 'white')

    # 1: remove approved gap patches (flood white+grey from seed)
    removed_white = 0
    for sx, sy in DIRT_SEEDS.get(i, []):
        if cls(px[sx, sy]) not in ('white', 'grey'):
            print(f'frame {i}: seed ({sx},{sy}) unexpected class {cls(px[sx, sy])} — SKIPPED')
            continue
        q = deque([(sx, sy)])
        seen = {(sx, sy)}
        comp = []
        while q:
            cx, cy = q.popleft()
            comp.append((cx, cy))
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = cx + dx, cy + dy
                if 0 <= nx < fw and 0 <= ny < H and (nx, ny) not in seen and cls(px[nx, ny]) in ('white', 'grey'):
                    seen.add((nx, ny))
                    q.append((nx, ny))
        for cx, cy in comp:
            if cls(px[cx, cy]) == 'white':
                removed_white += 1
            px[cx, cy] = (0, 0, 0, 0)
        print(f'frame {i}: gap patch at ({sx},{sy}) removed, {len(comp)}px')

    # 2: classify every grey: white-neighbour -> black, else transparent
    to_black, to_clear = [], []
    for y in range(H):
        for x in range(fw):
            if cls(px[x, y]) != 'grey':
                continue
            has_white = False
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < fw and 0 <= ny < H and cls(px[nx, ny]) == 'white':
                        has_white = True
            (to_black if has_white else to_clear).append((x, y))
    for x, y in to_black:
        px[x, y] = OUTLINE
    for x, y in to_clear:
        px[x, y] = (0, 0, 0, 0)
    print(f'frame {i}: greys -> {len(to_black)} black, {len(to_clear)} transparent')

    # 2b: white components touching transparency: small (<=400px) = dirt ->
    # remove; big (gloves) -> recolor their bg-touching edge pixels to black rim
    seen = [[False] * fw for _ in range(H)]
    for y in range(H):
        for x in range(fw):
            if seen[y][x] or cls(px[x, y]) != 'white':
                continue
            q = deque([(x, y)])
            seen[y][x] = True
            comp = []
            touches = []
            while q:
                cx, cy = q.popleft()
                comp.append((cx, cy))
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = cx + dx, cy + dy
                    if not (0 <= nx < fw and 0 <= ny < H) or px[nx, ny][3] == 0:
                        touches.append((cx, cy))
                        break
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = cx + dx, cy + dy
                    if 0 <= nx < fw and 0 <= ny < H and not seen[ny][nx] and cls(px[nx, ny]) == 'white':
                        seen[ny][nx] = True
                        q.append((nx, ny))
            touches = list(dict.fromkeys(touches))
            if touches:
                if len(comp) <= 400:
                    for cx, cy in comp:
                        px[cx, cy] = (0, 0, 0, 0)
                    removed_white += len(comp)
                    print(f'frame {i}: white dirt comp {len(comp)}px removed at ({comp[0][0]},{comp[0][1]})')
                else:
                    for cx, cy in touches:
                        px[cx, cy] = OUTLINE
                    removed_white += len(touches)  # accounted-for white->rim transitions
                    print(f'frame {i}: big white comp {len(comp)}px — {len(touches)} bg-edge px given black rim')

    # 3: any bright pixel still touching transparency -> outline black
    fixed = 0
    for _ in range(4):
        batch = []
        for y in range(H):
            for x in range(fw):
                r, g, b, a = px[x, y]
                if a > 0 and max(r, g, b) > 120 and cls(px[x, y]) != 'white':
                    for nx, ny in ((x+1, y), (x-1, y), (x, y+1), (x, y-1)):
                        if not (0 <= nx < fw and 0 <= ny < H) or px[nx, ny][3] == 0:
                            batch.append((x, y))
                            break
        if not batch:
            break
        for x, y in batch:
            px[x, y] = OUTLINE
        fixed += len(batch)

    # 4: audits + hard invariant
    white_after = sum(1 for y in range(H) for x in range(fw) if cls(px[x, y]) == 'white')
    bad = 0
    for y in range(H):
        for x in range(fw):
            r, g, b, a = px[x, y]
            if a > 0 and max(r, g, b) > 120 and cls(px[x, y]) != 'white':
                for nx, ny in ((x+1, y), (x-1, y), (x, y+1), (x, y-1)):
                    if not (0 <= nx < fw and 0 <= ny < H) or px[nx, ny][3] == 0:
                        bad += 1
                        break
    white_edge = 0
    for y in range(H):
        for x in range(fw):
            if cls(px[x, y]) == 'white':
                for nx, ny in ((x+1, y), (x-1, y), (x, y+1), (x, y-1)):
                    if not (0 <= nx < fw and 0 <= ny < H) or px[nx, ny][3] == 0:
                        white_edge += 1
                        break
    print(f'frame {i}: edgeRecoloured={fixed} | whiteLost={white_before - white_after - removed_white} (must be 0) | brightNonWhiteEdge={bad} | whiteTouchingBg={white_edge} (must be 0)')

# write sheet + gif
new_sheet = Image.new('RGBA', (fw * 8, H), (0, 0, 0, 0))
for i, f in enumerate(frames):
    new_sheet.paste(f, (i * fw, 0))
new_sheet.save(SHEET)
out_frames = []
for f in frames:
    rgb = Image.new('RGB', f.size, (1, 1, 1))
    rgb.paste(f, (0, 0), f)
    p = rgb.convert('P', palette=Image.ADAPTIVE, colors=255)
    ppx = p.load()
    apx = f.getchannel('A').load()
    for y in range(H):
        for x in range(fw):
            if apx[x, y] == 0:
                ppx[x, y] = 255
    out_frames.append(p)
out_frames[0].save(GIF, save_all=True, append_images=out_frames[1:], duration=100,
                   loop=0, transparency=255, disposal=2, optimize=False)
print('sheet', os.path.getsize(SHEET), 'gif', os.path.getsize(GIF))

# review renders: all-8 grid + zoom crops of gloves/shoes on frames 2 and 0
grid = Image.new('RGB', (fw * 4, H * 2), (255, 0, 255))
for i, f in enumerate(frames):
    cell = Image.new('RGBA', f.size, (255, 0, 255, 255))
    cell.paste(f, (0, 0), f)
    grid.paste(cell.convert('RGB'), ((i % 4) * fw, (i // 4) * H))
grid.save(rf'{OUTDIR}\v5-all8.png')
for idx, box, name in ((2, (0, 90, 469, 200), 'gloves'), (2, (100, 430, 380, 498), 'shoes'), (0, (60, 300, 460, 470), 'gap')):
    f = frames[idx]
    bg = Image.new('RGBA', f.size, (255, 60, 90, 255))   # Trym's pink-red bg
    bg.paste(f, (0, 0), f)
    crop = bg.convert('RGB').crop(box)
    crop = crop.resize((crop.width * 3, crop.height * 3), Image.NEAREST)
    crop.save(rf'{OUTDIR}\v5-f{idx}-{name}.png')
print('renders saved')
