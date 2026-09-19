# 🎨 WEARABLE ART — pack the hand-authored pixel SVGs into the form the browser ships (19 Sep 2026).
#
# THE PROBLEM. Every wearable was stored in src/lib/banana-engine.js as an inline SVG string: a grid
# of <rect> elements, one per 10-px cell, with x/y/width/height/fill spelled out every time. 103 of
# them came to 195 804 B — 86% of the engine, 15% of everything a player downloads, on the file that
# the park, the beach, the homestead, the rave, the builder, the inbox and the quest all import.
#
# THE SHAPE OF THE FIX. imgFor() only ever does `img.src = 'data:image/svg+xml,' + encodeURIComponent(s)`,
# so the string is nothing but a source for a raster: ANY representation that yields the same string
# is the same art. And the strings turn out to be perfectly regular — a viewBox, then row-major
# horizontal runs of grid-aligned rects. So a wearable is really a small grid of palette indices.
#
# ⭐ THE SAFETY PROPERTY, and the reason this is worth doing at all: the decoder reproduces the
# original string BYTE FOR BYTE. Not "looks the same" — identical. This tool asserts it for every
# wearable before it writes anything, and tools/check-wearart.mjs asserts it again on every build
# using the browser's own decoder. The art cannot drift, because a drift is a red build.
#
# WHERE THINGS LIVE NOW:
#   tools/wearart-source.js   the readable SVGs. NOT under src/, so it is never bundled and never
#                             counted — paste a new wearable's art here, then run this tool.
#   src/data/wearart.js       GENERATED, packed, and the only one that ships.
#   tools/banana_render.py    reads the SOURCE file, so the Python compositor needs no decoder of
#   tools/build-og-cards.py   its own and the two halves cannot disagree.
#
# Run: python tools/build-wearart.py
import io
import os
import re

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(SITE, 'tools', 'wearart-source.js')
OUT = os.path.join(SITE, 'src', 'data', 'wearart.js')

ENT = re.compile(r"^\s{2}([\w$]+):\s*'([^']*)',?\s*$")
RECT = re.compile(r'<rect x="(-?\d+)" y="(-?\d+)" width="(\d+)" height="(\d+)" fill="([^"]+)"/>')
CELL = 10
# ⚠️ the three <svg> openings actually in the art, in this order. A new one means a new index here
# AND in the decoder in src/lib/banana-engine.js — they are a pair, and check-wearart proves it.
HEADS = [
    re.compile(r'^<svg xmlns="http://www\.w3\.org/2000/svg" viewBox="0 0 (\d+) (\d+)" width="\1" height="\2" shape-rendering="crispEdges">$'),
    re.compile(r'^<svg viewBox="0 0 (\d+) (\d+)" shape-rendering="crispEdges" xmlns="http://www\.w3\.org/2000/svg">$'),
    re.compile(r'^<svg xmlns="http://www\.w3\.org/2000/svg" viewBox="0 0 (\d+) (\d+)" shape-rendering="crispEdges">$'),
]
# the cell alphabet: index 0 is "nothing here", the rest are palette slots.
# ⚠️ IT CONTAINS NO HEX DIGIT ON PURPOSE. A run is written `X*n` with n in hex, so if a cell character
# could also be a hex digit then `X*3a` is ambiguous — X sixty times, or X three times then a cell 'a'?
# Making the two alphabets disjoint removes the question instead of answering it with a delimiter.
# Eleven colours is the widest palette in the art today; forty symbols is room to spare.
ALPHA = 'ghijklmnopqrstuvwxyzGHIJKLMNOPQRSTUVWXYZ'


def head_of(h):
    for i, rx in enumerate(HEADS):
        m = rx.match(h)
        if m:
            return i, int(m.group(1)), int(m.group(2))
    return None, 0, 0


def pack(svg):
    """a wearable as [headIndex, gridW, gridH, palette, cells] — or None if it is not a plain grid"""
    if not svg.startswith('<svg') or not svg.endswith('</svg>'):
        return None
    head, body = svg[:svg.index('>') + 1], svg[svg.index('>') + 1:-6]
    hi, W, H = head_of(head)
    if hi is None or W % CELL or H % CELL:
        return None
    rects = RECT.findall(body)
    if ''.join('<rect x="%s" y="%s" width="%s" height="%s" fill="%s"/>' % r for r in rects) != body:
        return None   # something in there is not a rect
    if any(int(v) % CELL for r in rects for v in r[:4]):
        return None   # sub-cell detail: keep it verbatim
    gw, gh = W // CELL, H // CELL
    grid = [[-1] * gw for _ in range(gh)]
    pal = []
    for (x, y, w, h, fill) in rects:
        if not re.match(r'^#[0-9a-f]{6}$', fill):
            return None
        if fill not in pal:
            pal.append(fill)
        ci = pal.index(fill)
        x, y, w, h = int(x) // CELL, int(y) // CELL, int(w) // CELL, int(h) // CELL
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                if 0 <= yy < gh and 0 <= xx < gw:
                    grid[yy][xx] = ci
    if len(pal) >= len(ALPHA):
        return None
    cells = ''.join(ALPHA[c + 1] if c >= 0 else ALPHA[0] for row in grid for c in row)
    rle, i = [], 0
    while i < len(cells):
        j = i
        while j < len(cells) and cells[j] == cells[i]:
            j += 1
        n = j - i
        rle.append(cells[i] + '*' + format(n, 'x') if n >= 3 else cells[i] * n)
        i = j
    out = [hi, gw, gh, ''.join(c[1:] for c in pal), ''.join(rle)]
    # ⭐ THE PACK PROVES ITSELF. Anything that does not come back byte for byte is not packed at all —
    # it is kept verbatim. That covers sub-cell detail, and it covers a wearable whose rects were
    # merged VERTICALLY (midnighttulip), where row-major runs cannot reproduce the original order.
    # Refusing is always right here; guessing would move a pixel.
    return out if unpack(out) == svg else None


def unpack(p):
    """the twin of the decoder in src/lib/banana-engine.js — kept here only to PROVE the pack"""
    hi, gw, gh, pal, cells = p
    W, H = gw * CELL, gh * CELL
    head = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" width="%d" height="%d" shape-rendering="crispEdges">' % (W, H, W, H),
            '<svg viewBox="0 0 %d %d" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">' % (W, H),
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" shape-rendering="crispEdges">' % (W, H)][hi]
    flat, i = [], 0
    while i < len(cells):
        ch = cells[i]
        if i + 1 < len(cells) and cells[i + 1] == '*':
            j = i + 2
            while j < len(cells) and cells[j] in '0123456789abcdef':
                j += 1
            flat.append(ch * int(cells[i + 2:j], 16))
            i = j
        else:
            flat.append(ch)
            i += 1
    flat = ''.join(flat)
    out, k = [], 0
    for ry in range(gh):
        rx = 0
        while rx < gw:
            c = ALPHA.index(flat[ry * gw + rx])
            if c == 0:
                rx += 1
                continue
            run = 1
            while rx + run < gw and flat[ry * gw + rx + run] == flat[ry * gw + rx]:
                run += 1
            out.append('<rect x="%d" y="%d" width="%d" height="%d" fill="#%s"/>'
                       % (rx * CELL, ry * CELL, run * CELL, CELL, pal[(c - 1) * 6:c * 6]))
            rx += run
    return head + ''.join(out) + '</svg>'


def main():
    src = io.open(SRC, encoding='utf-8').read()
    items = []
    for line in src.split('\n'):
        m = ENT.match(line)
        if m:
            items.append((m.group(1), m.group(2)))
    assert items, 'no art found in ' + SRC
    packed, raw = {}, {}
    for k, v in items:
        p = pack(v)
        if p is None:
            raw[k] = v
            continue
        assert unpack(p) == v, 'round trip broke for ' + k   # pack() already refused anything that did not
        packed[k] = p

    def js(o):
        return '{' + ','.join('%s:%s' % (kk, vv) for kk, vv in o) + '}'
    pj = js([(k, '[%d,%d,%d,"%s","%s"]' % tuple(v)) for k, v in packed.items()])
    rj = js([(k, "'" + v + "'") for k, v in raw.items()])
    out = (
        "// \U0001F3A8 GENERATED by tools/build-wearart.py — DO NOT EDIT.\n"
        "// The readable art is tools/wearart-source.js; paste a new wearable there and re-run the tool.\n"
        "//\n"
        "// ART_P is every wearable that is a plain grid of 10-px cells, as\n"
        "//   [headIndex, gridW, gridH, palette (6 hex digits per colour), cells]\n"
        "// where `cells` is row-major, one character per cell from the alphabet in the decoder, index 0\n"
        "// meaning nothing there, and `X*n` meaning n of X (n in hex). ART_R is the handful with\n"
        "// sub-cell detail or a real image URL, kept verbatim.\n"
        "//\n"
        "// ⭐ The decoder in src/lib/banana-engine.js reproduces the source string BYTE FOR BYTE — not\n"
        "// \"looks the same\", identical — and tools/check-wearart.mjs proves it on every build. That is the\n"
        "// whole reason this is safe: %d B of art ships as %d B and not one pixel can move.\n"
        "export const ART_P = %s;\n"
        "export const ART_R = %s;\n"
    ) % (sum(len(v) for _, v in items), len(pj) + len(rj), pj, rj)
    io.open(OUT, 'w', encoding='utf-8', newline='\n').write(out)
    before = sum(len(v) for _, v in items)
    print('  %d wearables: %d packed, %d kept verbatim' % (len(items), len(packed), len(raw)))
    print('  round trip:  byte-exact for all %d packed' % len(packed))
    print('  art bytes:   %d -> %d  (%.1f%% smaller)' % (before, len(pj) + len(rj), 100.0 * (before - len(pj) - len(rj)) / before))
    print('  wrote %s (%d B)' % (os.path.relpath(OUT, SITE), len(out)))


if __name__ == '__main__':
    main()
