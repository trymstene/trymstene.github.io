# -*- coding: utf-8 -*-
"""Render scene modules to 1080x1920 @30fps mp4 (no text, no audio).

    python render.py                 # every scene in scenes/
    python render.py park            # one
    python render.py park --still    # 6 preview stills only (fast iteration)
    python render.py park --contact  # a 6-up contact sheet (one PNG to review)
"""
import importlib.util
import os
import subprocess
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SCENES_DIR = os.path.join(HERE, 'scenes')
OUT = os.path.join(HERE, 'out')
FRAMES = os.path.join(HERE, 'frames')
os.makedirs(OUT, exist_ok=True)

sys.path.insert(0, HERE)
from engine import W, H, FPS  # noqa: E402


def load(name):
    path = os.path.join(SCENES_DIR, name + '.py')
    spec = importlib.util.spec_from_file_location('scene_' + name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.SCENE


def render(name, stills=False, contact=False):
    sc = load(name)
    fn, secs = sc['fn'], sc['secs']
    n = round(secs * FPS)
    fdir = os.path.join(FRAMES, name)
    os.makedirs(fdir, exist_ok=True)
    picks = [round(x * (n - 1)) for x in (0.0, 0.2, 0.4, 0.6, 0.8, 1.0)]
    shots = []
    for i in range(n):
        t = i / (n - 1)
        if (stills or contact) and i not in picks:
            continue
        im = fn(t, i).convert('RGB')
        if contact or stills:
            shots.append(im.copy())
        if not (stills or contact):
            im.resize((W * 2, H * 2), Image.NEAREST).save(os.path.join(fdir, '%04d.png' % i))
    if contact or stills:
        cw, ch = 260, 462
        sheet = Image.new('RGB', (cw * 3 + 16, ch * 2 + 12), (24, 22, 30))
        for k, im in enumerate(shots[:6]):
            sheet.paste(im.resize((cw, ch)), ((k % 3) * (cw + 4) + 4, (k // 3) * (ch + 4) + 4))
        sheet.save(os.path.join(OUT, '_sheet_%s.png' % name))
        print('contact sheet: out/_sheet_%s.png' % name)
        return
    import imageio_ffmpeg
    exe = imageio_ffmpeg.get_ffmpeg_exe()
    dst = os.path.join(OUT, name + '.mp4')
    subprocess.run([exe, '-y', '-framerate', str(FPS), '-i', os.path.join(fdir, '%04d.png'),
                    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '17',
                    '-movflags', '+faststart', dst], check=True, capture_output=True)
    print('encoded: %s  %0.1fMB' % (dst, os.path.getsize(dst) / 1e6))


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    stills = '--still' in sys.argv
    contact = '--contact' in sys.argv
    names = args or sorted(f[:-3] for f in os.listdir(SCENES_DIR)
                           if f.endswith('.py') and not f.startswith('_'))
    for nm in names:
        render(nm, stills=stills, contact=contact)
