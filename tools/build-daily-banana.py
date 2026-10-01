"""🍌 THE BANANA OF THE DAY, AS A PICTURE (1 Oct 2026) — for BananaBOT's /today and its morning post, drawn by the same
renderer as the Citizens' frames (tools/banana_render.py) from the same outfit the site and the stream overlay show
(src/lib/banana-daily.js dailyOutfit, a UTC day). The deploy runs it every night just after midnight UTC, so the file is
always today's: public/assets/daily/today.png (the bot adds ?d=<day> so Discord never shows yesterday's from its cache).

    python tools/build-daily-banana.py
"""
import json
import os
import subprocess
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import banana_render  # noqa: E402

JS = ("import { dailyOutfit } from './src/lib/banana-daily.js';"
      "const o = dailyOutfit(new Date());"
      "process.stdout.write(JSON.stringify({ hat: o.hat, glasses: o.glasses, extras: o.extras,"
      " day: new Date().toISOString().slice(0, 10) }));")
SIZE, PAD = 512, 44
CREAM = (255, 248, 231, 255)   # the site's own paper


def main():
    o = json.loads(subprocess.run(['node', '--input-type=module', '-e', JS], cwd=ROOT,
                                  capture_output=True, text=True, check=True).stdout)
    im = banana_render.render(2, {'hat': o['hat'], 'glasses': o['glasses'], 'extras': o['extras']}, scale=2, lenient=True)
    im = im.crop(im.getbbox())
    k = min((SIZE - 2 * PAD) / im.width, (SIZE - 2 * PAD) / im.height)
    im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.NEAREST)
    card = Image.new('RGBA', (SIZE, SIZE), CREAM)
    card.alpha_composite(im, ((SIZE - im.width) // 2, (SIZE - im.height) // 2))
    out = os.path.join(ROOT, 'public', 'assets', 'daily')
    os.makedirs(out, exist_ok=True)
    card.convert('RGB').save(os.path.join(out, 'today.png'), optimize=True)
    print('banana of the day: %s, %d extras' % (o['day'], len([k for k, v in o['extras'].items() if v])))


if __name__ == '__main__':
    main()
