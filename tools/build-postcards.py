# -*- coding: utf-8 -*-
"""📮 THE POSTCARD TEMPLATES — three backgrounds a banana stands in front of.

docs/town-jobs-plan.md §6: "A picture, a picked line, a stamp. The picture is your own banana
composited live over a baked template … stored as a RECIPE, not an image — which is what keeps it
inside the $0 model."

So nothing here draws a banana. These are the THREE PLACES, baked once; the sender's own outfit
rides the rail as five short strings and the receiver's browser draws it on top. A postcard that
travelled as a picture would be 40 KB per send through a Durable Object, which is the one thing the
plan says it must never be.

⚠️ THREE IN v1, NOT SIX. The plan is explicit about why: "each is a tuning loop plus a copy field,
and looking at six until they are funny is a session by itself."
   park — the fountain and its plaza, cropped out of the park's own plate
   home — your own gate on the road, out of the homestead's
   rave — the one that CANNOT be photographed: the club has no plate, because it is a DOM page

⚠️ PNG-8, CROPPED NATIVE AND SCALED ×2 WITH NEAREST. The plan again, and it is a measurement rather
than a taste: the area plates are 2200–2760 px wide, so a postcard crop is about 600×400 NATIVE. A
JPEG at 1200×800 is an upscale, and an upscale of pixel art rings on every hard edge. 20–60 KB each,
sharper and smaller than the estimate it replaces.

Run: python tools/build-postcards.py
"""
import os

from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(HERE)
PUB = os.path.join(SITE, 'public', 'assets')
OUT = os.path.join(PUB, 'world')

W, H = 600, 400          # the native crop; the card shows it at ×2 with nearest
COLORS = 128             # PNG-8: a pixel-art crop has nowhere near 256 distinct colours


def save(im, key):
    os.makedirs(OUT, exist_ok=True)
    p = os.path.join(OUT, 'pc-%s.png' % key)
    # ⚠️ QUANTISE, THEN SAVE. `optimize` alone leaves a 24-bit PNG; the palette is where the bytes go.
    im.convert('RGB').quantize(colors=COLORS, method=Image.MEDIANCUT).save(p, optimize=True)
    print('  pc-%s.png %dx%d  %d KB' % (key, im.width, im.height, os.path.getsize(p) // 1024))


def crop(plate, folder, geo_overlays, cx, cy, key):
    """a window of an area, with its own overlays composited in the game's own order"""
    im = Image.open(os.path.join(PUB, plate)).convert('RGBA')
    for fn, x, y, base in sorted(geo_overlays, key=lambda o: o[3]):
        f = os.path.join(PUB, folder, fn)
        if os.path.exists(f):
            im.alpha_composite(Image.open(f).convert('RGBA'), (x, y))
    x0 = max(0, min(im.width - W, cx - W // 2))
    y0 = max(0, min(im.height - H, cy - H // 2))
    save(im.crop((x0, y0, x0 + W, y0 + H)), key)


def overlays_of(geo):
    """the OVERLAYS of a generated geo module, read by the runtime that owns them"""
    import json
    import subprocess
    js = ("import('file://' + process.argv[1]).then(m => "
          "process.stdout.write(JSON.stringify(m.OVERLAYS || [])))")
    path = os.path.join(SITE, 'src', 'scripts', geo).replace(os.sep, '/')
    r = subprocess.run(['node', '-e', js, path], capture_output=True, text=True)
    rows = json.loads(r.stdout or '[]')
    out = []
    for x in rows:
        if isinstance(x, dict):
            out.append((x['src'], int(x['x']), int(x['y']), int(x.get('base', x['y']))))
        else:
            out.append((x[0], int(x[1]), int(x[2]), int(x[5])))
    return out


def rave():
    """🪩 THE ONE THAT CANNOT BE PHOTOGRAPHED.

    The rave is a DOM page — lit divs, CSS beams, a canvas crowd — so there is no plate to crop and
    a screenshot would be a picture of a browser. It is built here out of the club's OWN palette
    (rave.astro: #0d0b14 the hall, #241a38 the desk, #b388ff and #ff4d9d the lights, #ffe135 the
    world's yellow) as light and floor rather than as drawn objects — which is exactly how the
    dressing room's changing room is made, and why neither needed a sprite invented for it.
    """
    im = Image.new('RGB', (W, H), (13, 11, 20))
    d = ImageDraw.Draw(im, 'RGBA')
    # the floor: a lighter band with the stage's own purple in it
    d.rectangle([0, int(H * 0.72), W, H], fill=(46, 33, 71))
    d.rectangle([0, int(H * 0.72), W, int(H * 0.72) + 4], fill=(72, 52, 118))
    # ⚠️ THE FLOOR HAS TO CARRY A BANANA. Everything above is light and the sender is drawn standing
    # on this band, so it is the one part of the card that must not be nearly black — a yellow banana
    # on a #0d0b14 floor reads as a sticker rather than as somebody at the rave.
    # four beams from a rig above the frame, the club's two light colours
    beams = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    b = ImageDraw.Draw(beams)
    for i, (x, col) in enumerate([(90, (179, 136, 255)), (240, (255, 77, 157)),
                                  (380, (179, 136, 255)), (520, (55, 214, 122))]):
        spread = 58 + i * 9
        b.polygon([(x, -10), (x - spread, int(H * 0.82)), (x + spread, int(H * 0.82))],
                  fill=col + (78,))
    # ⚠️ blurred, because a hard-edged triangle is a shape and a soft one is a light
    beams = beams.filter(ImageFilter.GaussianBlur(9))
    im = Image.alpha_composite(im.convert('RGBA'), beams).convert('RGB')
    d = ImageDraw.Draw(im, 'RGBA')
    # the crowd: a dark silhouette line along the floor, no faces, no bananas — the sender is the banana
    for i in range(-20, W + 20, 14):
        h = 22 + (i * 7919 % 15)
        d.ellipse([i, int(H * 0.72) - h, i + 16, int(H * 0.72) + 6], fill=(14, 10, 24, 185))
    # and the club's own yellow, as a glow on the back wall
    glow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse([W // 2 - 170, -80, W // 2 + 170, 150], fill=(255, 225, 53, 46))
    im = Image.alpha_composite(im.convert('RGBA'), glow.filter(ImageFilter.GaussianBlur(26))).convert('RGB')
    # ⚠️ AND THEN IT IS MADE OF PIXELS, or it is a postcard from a different game. The other two are
    # 1:1 crops of hand-drawn pixel art and this is gradients and blurs — side by side in the rack, a
    # smooth one reads as a photograph somebody pasted in. So it goes down to a third and back up with
    # NEAREST: 3-px blocks and a 24-colour palette, which is the same treatment blockify() gives every
    # prop in the town (tools/build-town-scene.py).
    K = 3
    im = im.resize((W // K, H // K), Image.BOX).quantize(colors=24, method=Image.MEDIANCUT).convert('RGB')
    im = im.resize((W, H), Image.NEAREST)
    save(im, 'rave')


if __name__ == '__main__':
    print('postcards:')
    # 🌳 the park's fountain and the plaza round it: the most recognisable 600 px in the park
    crop('park/park.png', 'park', overlays_of('park-geo.js'), 1380, 620, 'park')
    # 🏡 your own gate on the road, with the fence running off both sides of the frame
    crop('homestead/homestead.png', 'homestead', [
        ('ov-fyard1.png', 816, 432, 464), ('ov-fsouth1.png', 816, 764, 816),
        ('m-mail.png', 1234, 808, 850), ('m-sign.png', 994, 819, 850),
    ], 1120, 760, 'home')
    rave()
