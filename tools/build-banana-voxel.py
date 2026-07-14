# -*- coding: utf-8 -*-
"""BANANA VOXEL — the dancing banana as a 3D-printable figurine.

Turns a master frame (public/assets/dancing-banana-highres/) into a voxel
model: every logical pixel becomes a cube, extruded to a chosen depth, plus
an optional base plate so he can actually stand on a desk.

Outputs (to banana-3d/, gitignored — the public repo must not give the model away):
  banana-frame<N>.stl            one solid mesh (single-color prints / viewing)
  banana-frame<N>-<color>.stl    one mesh per palette color — import ALL into a
                                 slicer (Bambu Studio / PrusaSlicer), assign a
                                 filament to each, print multi-color
  banana-frame<N>-front.png      preview: front view
  banana-frame<N>-iso.png        preview: isometric 3D view
  banana-frame<N>-report.txt     size/stats + how-to-print notes

Run:  python tools/build-banana-voxel.py [--frame 1] [--mm 2.5] [--depth 5]
                                         [--no-base] [--all-frames]
Defaults give a ~9-10 cm tall figurine, ~12.5 mm thick, with a base.

Pixel-grid facts come from the asset pipeline (build-banana-assets.py):
masters are 2000x2000, logical pixel unit = 52 master px, 6-color palette.
"""
import argparse
import os
import struct

import numpy as np
from PIL import Image, ImageDraw

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HIRES = os.path.join(SITE, 'public', 'assets', 'dancing-banana-highres')
OUT = os.path.join(SITE, 'banana-3d')
UNIT = 52  # master px per logical pixel

PALETTE = [
    ('outline',   (0, 0, 0)),
    ('yellow',    (255, 255, 0)),
    ('white',     (255, 255, 255)),
    ('shade',     (206, 206, 0)),
    ('red',       (255, 0, 0)),
    ('deepshade', (156, 156, 0)),
]
BASE_CODE = 1  # base plate prints in the outline color (black)


def load_master(n):
    """Same cleaning as the asset pipeline: alpha threshold + palette snap."""
    p = os.path.join(HIRES, 'dancing-banana-2000x2000-frame-%d.png' % n)
    a = np.asarray(Image.open(p).convert('RGBA')).copy()
    opaque = a[..., 3] >= 128
    a[~opaque] = 0
    a[opaque, 3] = 255
    rgb = a[..., :3].astype(np.int32)
    pal = np.array([c for _, c in PALETTE], dtype=np.int32)
    d = ((rgb[..., None, :] - pal[None, None, :, :]) ** 2).sum(-1)
    nearest = d.argmin(-1)
    a[..., :3] = np.where(opaque[..., None], pal[nearest].astype(np.uint8), 0)
    return a


def logical_grid(n):
    """2000x2000 master -> (H,W) uint8 grid of palette codes (0 = empty).
    Lattice = ~52px with ±1 hand-drawn jitter (measured via run lengths:
    sprite bbox 1096x1513 ≈ 21x29 logical px in frame 1 — the banana IS that
    small). Phase-aligned center sampling absorbs the jitter at this size;
    a reconstruction accuracy check guards against drift."""
    a = load_master(n)
    code = np.zeros(a.shape[:2], dtype=np.uint8)
    opaque = a[..., 3] == 255
    for i, (_, c) in enumerate(PALETTE):
        m = opaque & (a[..., 0] == c[0]) & (a[..., 1] == c[1]) & (a[..., 2] == c[2])
        code[m] = i + 1

    def phase(axis):
        d = (np.diff(code, axis=axis) != 0).sum(axis=1 - axis)
        scores = [d[p::UNIT].sum() for p in range(UNIT)]
        return (int(np.argmax(scores)) + 1) % UNIT

    oy, ox = phase(0), phase(1)
    ys = np.arange(oy + UNIT // 2, code.shape[0], UNIT)
    xs = np.arange(ox + UNIT // 2, code.shape[1], UNIT)
    grid = code[np.ix_(ys, xs)]
    # reconstruction check: every source pixel maps to its cell; mismatches
    # only come from lattice jitter at cell borders (expect >=95%)
    yy = ((np.arange(code.shape[0]) - oy) // UNIT).clip(0, len(ys) - 1)
    xx = ((np.arange(code.shape[1]) - ox) // UNIT).clip(0, len(xs) - 1)
    recon = grid[np.ix_(yy, xx)]
    acc = (recon == code).mean()
    print('  lattice: phase (%d,%d), %d cols x %d rows, reconstruction %.1f%%'
          % (ox, oy, len(xs), len(ys), acc * 100))
    if acc < 0.95:
        raise SystemExit('lattice drift too high — sampling unreliable, inspect frame %d' % n)
    nz_y, nz_x = np.nonzero(grid)
    if not len(nz_y):
        raise SystemExit('empty frame?')
    return grid[nz_y.min():nz_y.max() + 1, nz_x.min():nz_x.max() + 1]


def add_base(grid, depth):
    """A plate under the feet: 1 px tall, sprite width + margin, deeper than
    the body. Returns (grid_with_base_row, base_span, base_depth_range)."""
    H, W = grid.shape
    ys, xs = np.nonzero(grid)
    x0, x1 = max(0, xs.min() - 1), min(W - 1, xs.max() + 1)
    base_row = np.zeros((1, W), dtype=np.uint8)
    base_row[0, x0:x1 + 1] = BASE_CODE
    return np.vstack([grid, base_row]), (x0, x1)


def voxels_from_grid(grid, depth, base=False):
    """(H,W) grid -> dict {(x,y,z): code}. y: image row (down). z: depth."""
    vox = {}
    H, W = grid.shape
    body_rows = H - (1 if base else 0)
    for y in range(H):
        for x in range(W):
            c = grid[y, x]
            if not c:
                continue
            if base and y == H - 1:
                for z in range(-2, depth + 2):  # base sticks out for stability
                    vox[(x, y, z)] = c
            else:
                for z in range(depth):
                    vox[(x, y, z)] = c
    return vox


# ---- mesh ----
# STL coords in mm: X = x, Y = z (depth), Z = up = (maxy - y). CCW outward.
FACES = {  # dir -> (neighbor offset, 4 corners of the face as unit-cube verts)
    'x-': ((-1, 0, 0), [(0, 0, 0), (0, 1, 0), (0, 1, 1), (0, 0, 1)]),
    'x+': ((1, 0, 0),  [(1, 0, 0), (1, 0, 1), (1, 1, 1), (1, 1, 0)]),
    'y-': ((0, -1, 0), [(0, 0, 0), (0, 0, 1), (1, 0, 1), (1, 0, 0)]),
    'y+': ((0, 1, 0),  [(0, 1, 0), (1, 1, 0), (1, 1, 1), (0, 1, 1)]),
    'z-': ((0, 0, -1), [(0, 0, 0), (1, 0, 0), (1, 1, 0), (0, 1, 0)]),
    'z+': ((0, 0, 1),  [(0, 0, 1), (0, 1, 1), (1, 1, 1), (1, 0, 1)]),
}


def emit_mesh(vox, keep, mm, maxy):
    """Triangles for voxels where keep(code) is true; faces where the
    neighbor is not part of the same body (watertight per body)."""
    tris = []
    sel = {p: c for p, c in vox.items() if keep(c)}
    for (x, y, z), c in sel.items():
        for _, (off, corners) in FACES.items():
            nb = (x + off[0], y + off[1], z + off[2])
            if nb in sel:
                continue
            pts = []
            for cx, cy, cz in corners:
                # world: X right, Y depth, Z up (flip image y)
                pts.append(((x + cx) * mm, (z + cz) * mm, (maxy - y + (1 - cy)) * mm))
            tris.append((pts[0], pts[1], pts[2]))
            tris.append((pts[0], pts[2], pts[3]))
    return tris


def write_stl(path, tris):
    with open(path, 'wb') as f:
        f.write(b'banana voxel - trymstene.com'.ljust(80, b'\0'))
        f.write(struct.pack('<I', len(tris)))
        for a, b, c in tris:
            u = np.subtract(b, a); v = np.subtract(c, a)
            n = np.cross(u, v)
            ln = np.linalg.norm(n)
            n = n / ln if ln else n
            f.write(struct.pack('<3f', *n))
            for p in (a, b, c):
                f.write(struct.pack('<3f', *p))
            f.write(struct.pack('<H', 0))


def write_3mf(path, color_tris):
    """ONE file, colors included — STL can't carry color, 3MF can.
    color_tris: list of (name, (r,g,b), tris). Each color = one mesh object
    with a base material; slicers and POD quote forms read this directly."""
    import zipfile
    def fmt(v):
        s = ('%.3f' % v).rstrip('0').rstrip('.')
        return s if s else '0'
    objects, items = [], []
    for oid, (name, rgb, tris) in enumerate(color_tris, start=2):
        verts, index, tri_idx = [], {}, []
        for tri in tris:
            ids = []
            for p in tri:
                k = (round(p[0], 3), round(p[1], 3), round(p[2], 3))
                if k not in index:
                    index[k] = len(verts)
                    verts.append(k)
                ids.append(index[k])
            tri_idx.append(ids)
        vx = ''.join('<vertex x="%s" y="%s" z="%s"/>' % (fmt(v[0]), fmt(v[1]), fmt(v[2])) for v in verts)
        tx = ''.join('<triangle v1="%d" v2="%d" v3="%d"/>' % tuple(t) for t in tri_idx)
        objects.append(
            '<object id="%d" type="model" pid="1" pindex="%d" name="%s">'
            '<mesh><vertices>%s</vertices><triangles>%s</triangles></mesh></object>'
            % (oid, oid - 2, name, vx, tx))
        items.append('<item objectid="%d"/>' % oid)
    mats = ''.join('<base name="%s" displaycolor="#%02X%02X%02XFF"/>' % (n, *rgb)
                   for n, rgb, _ in color_tris)
    model = ('<?xml version="1.0" encoding="UTF-8"?>'
             '<model unit="millimeter" xml:lang="en-US" '
             'xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">'
             '<resources><basematerials id="1">%s</basematerials>%s</resources>'
             '<build>%s</build></model>' % (mats, ''.join(objects), ''.join(items)))
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml',
                   '<?xml version="1.0" encoding="UTF-8"?>'
                   '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
                   '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
                   '<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>'
                   '</Types>')
        z.writestr('_rels/.rels',
                   '<?xml version="1.0" encoding="UTF-8"?>'
                   '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                   '<Relationship Target="/3D/3dmodel.model" Id="rel-1" '
                   'Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>'
                   '</Relationships>')
        z.writestr('3D/3dmodel.model', model)


# ---- previews (no matplotlib: hand-rolled isometric painter) ----
def preview_front(grid, path, scale=14):
    H, W = grid.shape
    im = Image.new('RGBA', (W * scale, H * scale), (196, 202, 214, 255))
    d = ImageDraw.Draw(im)
    for y in range(H):
        for x in range(W):
            c = grid[y, x]
            if c:
                col = PALETTE[c - 1][1]
                d.rectangle([x * scale, y * scale, (x + 1) * scale - 1, (y + 1) * scale - 1], fill=col + (255,))
    im.save(path)


def preview_iso(vox, path, maxy, scale=9):
    def shade(col, f):
        return tuple(min(255, int(v * f)) for v in col)
    pts = sorted(vox.items(), key=lambda p: (p[0][2], p[0][1], p[0][0]))  # far z first
    xs = [p[0] for p, _ in pts]; zs = [p[2] for p, _ in pts]
    W = (max(xs) + max(zs) + 6) * scale + 200
    Hpx = (maxy + max(zs) + 8) * scale + 200
    im = Image.new('RGBA', (W, Hpx), (196, 202, 214, 255))
    d = ImageDraw.Draw(im)
    ox, oy = 60, 80
    hx, hy = scale, scale // 2  # iso axes
    for (x, y, z), c in pts:
        col = PALETTE[c - 1][1]
        wy = maxy - y  # world up
        sx = ox + x * hx + z * hx // 2
        sy = oy + (maxy - wy) * scale - z * hy
        top = [(sx, sy), (sx + hx, sy), (sx + hx + hx // 2, sy - hy), (sx + hx // 2, sy - hy)]
        front = [(sx, sy), (sx + hx, sy), (sx + hx, sy + scale), (sx, sy + scale)]
        side = [(sx + hx, sy), (sx + hx + hx // 2, sy - hy), (sx + hx + hx // 2, sy - hy + scale), (sx + hx, sy + scale)]
        d.polygon(front, fill=shade(col, 0.85) + (255,))
        d.polygon(side, fill=shade(col, 0.62) + (255,))
        d.polygon(top, fill=shade(col, 1.0) + (255,))
    im.save(path)


def build(frame, mm, depth, base, out):
    os.makedirs(out, exist_ok=True)
    grid = logical_grid(frame)
    if base:
        grid, _ = add_base(grid, depth)
    H, W = grid.shape
    vox = voxels_from_grid(grid, depth, base=base)
    maxy = H - 1

    tag = 'banana-frame%d' % frame
    all_tris = emit_mesh(vox, lambda c: True, mm, maxy)
    write_stl(os.path.join(out, tag + '.stl'), all_tris)
    used = sorted(set(vox.values()))
    per_color = {}
    color_tris = []
    for code in used:
        name = PALETTE[code - 1][0]
        tris = emit_mesh(vox, lambda c, k=code: c == k, mm, maxy)
        per_color[name] = len(tris)
        write_stl(os.path.join(out, '%s-%s.stl' % (tag, name)), tris)
        color_tris.append((name, PALETTE[code - 1][1], tris))
    write_3mf(os.path.join(out, tag + '.3mf'), color_tris)
    preview_front(grid, os.path.join(out, tag + '-front.png'))
    preview_iso(vox, os.path.join(out, tag + '-iso.png'), maxy)

    size = (W * mm, (depth + (4 if base else 0)) * mm, H * mm)
    rpt = [
        'BANANA VOXEL — frame %d' % frame,
        'grid %dx%d px · %d voxels · %d triangles (combined)' % (W, H, len(vox), len(all_tris)),
        'printed size: %.0f x %.0f x %.0f mm (W x D x H) at %.1f mm/px' % (size[0], size[1], size[2], mm),
        'colors used: ' + ', '.join('%s (%d tris)' % (n, t) for n, t in per_color.items()),
        '',
        'HOW TO PRINT (multi-color): open Bambu Studio / PrusaSlicer,',
        'File > Import, select ALL banana-frame%d-<color>.stl files TOGETHER' % frame,
        '(say YES to "load as single object with multiple parts"), assign a',
        'filament to each part: outline=black, yellow=yellow, white=white,',
        'red=red, shade/deepshade=darker yellows (or map both to yellow for',
        'a 4-color printer). Single-color print: use banana-frame%d.stl.' % frame,
    ]
    with open(os.path.join(out, tag + '-report.txt'), 'w') as f:
        f.write('\n'.join(rpt))
    print('\n'.join(rpt[:4]))
    print('-> %s' % out)


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--frame', type=int, default=1)
    ap.add_argument('--mm', type=float, default=2.5, help='mm per pixel')
    ap.add_argument('--depth', type=int, default=5, help='thickness in pixels')
    ap.add_argument('--no-base', action='store_true')
    ap.add_argument('--all-frames', action='store_true')
    ap.add_argument('--out', default=OUT)
    args = ap.parse_args()
    frames = range(1, 9) if args.all_frames else [args.frame]
    for fr in frames:
        build(fr, args.mm, args.depth, not args.no_base, args.out)
