# -*- coding: utf-8 -*-
"""The dancing banana, packed for a Snapchat lens (Lens Studio).

Reads Trym's masters (public/assets/dancing-banana-highres, 8 frames, 2000x2000) and writes
tools/lens/out/dancing-banana-lens-kit/ + a zip beside it:

    frames-920/banana_00.png .. banana_07.png   the dance, feet on the bottom edge (a world lens stands it on the floor)
    frames-460/                                 the same, half size (lighter lens)
    sheet-4x2-460.png                           all eight in one sheet (a flipbook, if you prefer one texture)
    shadow.png                                  a flat ground shadow to put under its feet
    icon-1024.png                               the lens icon (Lens Studio refuses its own default icons)
    README.txt                                  the steps

Pixels are only ever halved or quartered with NEAREST: never smoothed, never rotated.
Run: python tools/lens/build_lens_kit.py
"""
import os
import shutil
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(os.path.dirname(HERE))
SRC = os.path.join(SITE, 'public', 'assets', 'dancing-banana-highres')
OUT = os.path.join(HERE, 'out', 'dancing-banana-lens-kit')

# every frame's art sits inside x 139..1861, y 87..1913 with the feet on y 1913 in all eight: one square crop keeps
# the feet on the same line, so the banana never hops
BOX = (80, 80, 1920, 1920)
HOT = (255, 77, 109, 255)

frames = [Image.open(os.path.join(SRC, 'dancing-banana-2000x2000-frame-%d.png' % (i + 1))).convert('RGBA').crop(BOX)
          for i in range(8)]

if os.path.exists(OUT):
    shutil.rmtree(OUT)
for size in (920, 460):
    d = os.path.join(OUT, 'frames-%d' % size)
    os.makedirs(d)
    for i, f in enumerate(frames):
        f.resize((size, size), Image.NEAREST).save(os.path.join(d, 'banana_%02d.png' % i), optimize=True)

sheet = Image.new('RGBA', (460 * 4, 460 * 2), (0, 0, 0, 0))
for i, f in enumerate(frames):
    sheet.alpha_composite(f.resize((460, 460), Image.NEAREST), ((i % 4) * 460, (i // 4) * 460))
sheet.save(os.path.join(OUT, 'sheet-4x2-460.png'), optimize=True)

# the shadow: a flat oval in blocks of the banana's own pixel size at 920 (26 px), a third black
sh = Image.new('RGBA', (26 * 20, 26 * 5), (0, 0, 0, 0))
dr = ImageDraw.Draw(sh)
for gy in range(5):
    for gx in range(20):
        cx, cy = (gx + 0.5) / 20 - 0.5, (gy + 0.5) / 5 - 0.5
        if (cx / 0.5) ** 2 + (cy / 0.5) ** 2 <= 1:
            dr.rectangle((gx * 26, gy * 26, gx * 26 + 25, gy * 26 + 25), fill=(0, 0, 0, 85))
sh.save(os.path.join(OUT, 'shadow.png'), optimize=True)

# the icon: the banana mid-wave on the site's hot pink, 1024 square (Snapchat shows it in a circle, so it keeps clear
# of the corners)
icon = Image.new('RGBA', (1024, 1024), HOT)
b = frames[2].resize((690, 690), Image.NEAREST)
icon.alpha_composite(b, ((1024 - 690) // 2, (1024 - 690) // 2 + 10))
icon.convert('RGB').save(os.path.join(OUT, 'icon-1024.png'), optimize=True)

README = """THE DANCING BANANA - LENS KIT
=============================

The art is Trym Stene's own (the 1999 dancing banana, remastered). Eight frames, one dance,
0.1 s a frame (10 fps) - the same timing as the original GIF.

WHAT IS IN HERE
  frames-920/        the eight frames, 920 x 920, transparent, feet on the bottom edge
  frames-460/        the same at half size, for a lighter lens
  sheet-4x2-460.png  all eight frames in one sheet (4 across, 2 down), if you use a flipbook
  shadow.png         a flat pixel shadow for under the feet
  icon-1024.png      the lens icon

THE LENS: A BANANA DANCING ON YOUR FLOOR (back camera, "world" lens)
  1. Open Lens Studio and log in with your Snapchat account.
  2. Start a new project from a world / "place an object on the ground" template
     (tap-to-place with the back camera).
  3. Drag the folder frames-920 into the Asset Browser. Lens Studio offers to make an
     animated texture from an image sequence - say yes. Set it to 10 fps and to loop.
  4. Replace the template's 3D object with an Image / screen-image plane that uses that
     animated texture. Set its pivot to the BOTTOM CENTRE, so the feet stand on the floor.
     Make it face the camera (billboard) so it never looks paper-thin from the side.
  5. Put shadow.png on a flat plane just under the feet.
  6. Keep the pixels sharp: set the texture filtering to "nearest" / point if your version
     offers it.
  7. Project Info: name it (e.g. "Dancing Banana"), set icon-1024.png as the icon, record a
     preview on your phone (a few seconds of the banana dancing in a room).
  8. Test it on your phone (Send to Snapchat / pair your device), then Publish.
     Sound: none - the "Peanut Butter Jelly Time" song is not ours to use.

Too heavy? Use frames-460 instead - the whole lens should stay under 2 MB.
Names of menus move between Lens Studio versions; Snap's "Publish your first Lens" guide
has the current ones.
"""
with open(os.path.join(OUT, 'README.txt'), 'w', encoding='utf-8', newline='\r\n') as f:
    f.write(README)

# the fallback when a Lens Studio version has no "2D Animation From Files": import the frames as plain textures and
# let this script flip them on an Image
DANCE_JS = """// banana_dance.js - plays the eight frames on an Image, 10 per second, forever.
// Attach to the object that has the Image; fill in the fields in the Inspector.
// @input Component.Image image
// @input Asset.Texture[] frames
// @input float fps = 10
var i = 0;
var t = 0;
script.createEvent("UpdateEvent").bind(function () {
    if (!script.image || !script.frames || script.frames.length === 0) { return; }
    t += getDeltaTime();
    var step = 1 / script.fps;
    while (t >= step) {
        t -= step;
        i = (i + 1) % script.frames.length;
    }
    script.image.mainPass.baseTex = script.frames[i];
});
"""
with open(os.path.join(OUT, 'banana_dance.js'), 'w', encoding='utf-8', newline='\n') as f:
    f.write(DANCE_JS)

zipbase = os.path.join(HERE, 'out', 'dancing-banana-lens-kit')
if os.path.exists(zipbase + '.zip'):
    os.remove(zipbase + '.zip')
shutil.make_archive(zipbase, 'zip', OUT)
print('wrote', zipbase + '.zip', os.path.getsize(zipbase + '.zip'), 'bytes')
