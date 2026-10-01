"""Contact sheet of a filmed shot: python sheet.py <shot> [count] [width] -> tools/reel/out/_cap_<shot>.png
Samples `count` frames evenly (first and last included), each scaled to `width`, frame numbers in the corner."""
import os
import sys
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
CAP = os.path.join(HERE, '..', 'frames', 'cap')
OUT = os.path.join(HERE, '..', 'out')

name = sys.argv[1]
count = int(sys.argv[2]) if len(sys.argv) > 2 else 6
width = int(sys.argv[3]) if len(sys.argv) > 3 else 360
d = os.path.join(CAP, name)
files = sorted(f for f in os.listdir(d) if f.endswith('.png'))
picks = [files[round(k * (len(files) - 1) / max(1, count - 1))] for k in range(count)]
thumbs = []
for f in picks:
    im = Image.open(os.path.join(d, f)).convert('RGB')
    h = round(im.height * width / im.width)
    im = im.resize((width, h), Image.LANCZOS)
    ImageDraw.Draw(im).text((8, 6), f[:-4], fill=(255, 255, 0))
    thumbs.append(im)
cols = min(count, 6)
rows = (len(thumbs) + cols - 1) // cols
th = max(t.height for t in thumbs)
sheet = Image.new('RGB', (cols * (width + 6) + 6, rows * (th + 6) + 6), (20, 20, 24))
for k, t in enumerate(thumbs):
    sheet.paste(t, (6 + (k % cols) * (width + 6), 6 + (k // cols) * (th + 6)))
os.makedirs(OUT, exist_ok=True)
out = os.path.join(OUT, '_cap_' + name + '.png')
sheet.save(out)
print(out, sheet.size)
