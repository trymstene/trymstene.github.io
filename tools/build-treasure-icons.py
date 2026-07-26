# -*- coding: utf-8 -*-
# Pixel icons for the beach dig reward popup (banana-beach.js):
#   chest.png  — an open treasure chest spilling gold (the popup hero)
#   ticket.png — a carnival ticket (the treasure pays PIER TICKETS)
# The coins already have coins.png (a 3-coin pile). ASCII-map → Pillow → crisp
# nearest-neighbour upscale, matching tools/floor-items.py's method.
from PIL import Image
import os

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'banana-stand')

def build(name, rows, pal, scale):
    h = len(rows); w = max(len(r) for r in rows)
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    px = img.load()
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in pal:
                px[x, y] = pal[ch]
    img = img.resize((w * scale, h * scale), Image.NEAREST)
    img.save(os.path.join(OUT, name))
    print('wrote', name, img.size)

# ---- palette ------------------------------------------------------------
O = (46, 28, 10, 255)      # dark outline (wood)
W = (138, 90, 43, 255)     # wood
w = (102, 64, 32, 255)     # wood shadow
L = (176, 118, 62, 255)    # wood light
G = (255, 210, 63, 255)    # gold
g = (224, 164, 40, 255)    # gold shadow
S = (255, 253, 245, 255)   # shine
# ticket palette
K = (122, 30, 46, 255)     # ticket outline (deep carnival red)
R = (255, 93, 122, 255)    # ticket body
r = (224, 69, 95, 255)     # ticket shadow
H = (255, 173, 190, 255)   # ticket highlight

CHEST = [
    "........................",
    "..........OOOOO.........",
    "........OOGGGGGOO.......",
    ".......OGLLLLLLLGO......",
    "......OGLLLLLLLLLGO.....",
    "......OGLLLLLLLLLGO.....",
    "......OGGGGGGGGGGGO.....",
    "......OOOOOOOOOOOOO.....",
    "....OOOOOOOOOOOOOOOOO...",
    "...OGSGgGSGgGSGgGSGgGO..",
    "...OgGSGgGSGgGSGgGSGgO..",
    "...OWLLLLLLLLLLLLLLLWO..",
    "...OGGGGGGGKKGGGGGGGGO..",
    "...OWLLLLLLKKLLLLLLLWO..",
    "...OWLLLLLLLLLLLLLLLWO..",
    "...OWwwwwwwwwwwwwwwwWO..",
    "....OOOOOOOOOOOOOOOO...",
    "........................",
]
CHEST_PAL = {'O': O, 'W': W, 'w': w, 'L': L, 'G': G, 'g': g, 'S': S, 'K': (122, 78, 20, 255)}

TICKET = [
    "......................",
    "..OOOOOOOOOOOOOOOOOO..",
    ".OHHHHHHHHHHHHHHHHHHO.",
    ".OR.Rr.RRRRRRRRRRRRRO.",
    ".OR.Rr.RRRRGGGRRRRRRO.",
    ".OR.Rr.RRRGGGGGRRRRRO.",
    ".OR.Rr.RRRRGGGRRRRRRO.",
    ".Or.rr.rrrrrrrrrrrrrO.",
    ".OOOOOOOOOOOOOOOOOOOO.",
    "......................",
]
TICKET_PAL = {'O': K, 'R': R, 'r': r, 'H': H, 'G': G}

build('chest.png', CHEST, CHEST_PAL, 6)
build('ticket.png', TICKET, TICKET_PAL, 6)
