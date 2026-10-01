"""🍌📌 BANANABOT'S PICTURE (1 Oct 2026) — our own dancing banana (the real art, design library §51) in a graduation cap — a
hat no resident wears (Bean has the propeller beanie), so the bot is never mistaken for Trym's plain banana or for her. Drawn by tools/banana_render.py, head to hips, on the banana yellow
of the site, as a square Discord crops to a circle. Out: worker-bot/avatar.png (tools/discord.mjs avatar uploads it).

    python tools/build-bot-avatar.py
"""
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import banana_render  # noqa: E402

SIZE = 512
BG = (255, 225, 53, 255)   # #ffe135, the site's banana yellow


def main():
    im = banana_render.render(3, {'hat': 'gradcap', 'glasses': 'none', 'extras': {}}, scale=2, lenient=True)
    im = im.crop(im.getbbox())
    # the cap to the waist, arms and all, with air round it so nothing touches Discord's circle
    im = im.crop((0, 0, im.width, int(im.height * 0.66)))
    k = min(SIZE * 0.78 / im.width, SIZE * 0.74 / im.height)
    im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.NEAREST)
    card = Image.new('RGBA', (SIZE, SIZE), BG)
    card.alpha_composite(im, ((SIZE - im.width) // 2, (SIZE - im.height) // 2 + int(SIZE * 0.04)))
    out = os.path.join(ROOT, 'worker-bot', 'avatar.png')
    card.convert('RGB').save(out, optimize=True)
    print('avatar:', out)


if __name__ == '__main__':
    main()
