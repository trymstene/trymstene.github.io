# -*- coding: utf-8 -*-
"""🎟 stitch the four sticker clips into one reel (hook → sheet → packs → peel),
no re-encode: every clip already shares the rig's h264 settings.

    python stitch_stickers.py
"""
import os
import subprocess

import imageio_ffmpeg

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out')
ORDER = ['stk_hook', 'stk_sheet', 'stk_packs', 'stk_peel']

lst = os.path.join(OUT, '_stickers_list.txt')
with open(lst, 'w', encoding='utf-8') as f:
    for n in ORDER:
        f.write("file '%s'\n" % os.path.join(OUT, n + '.mp4').replace('\\', '/'))
dst = os.path.join(OUT, 'stickers_reel.mp4')
exe = imageio_ffmpeg.get_ffmpeg_exe()
subprocess.run([exe, '-y', '-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', '-movflags', '+faststart', dst],
               check=True, capture_output=True)
print('stitched: %s  %0.1fMB' % (dst, os.path.getsize(dst) / 1e6))
