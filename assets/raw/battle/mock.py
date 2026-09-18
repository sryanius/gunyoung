# -*- coding: utf-8 -*-
"""전투 화면 배치 목업(브라우저 대체): sky(0,0) + far(아래변 y=400) + ground 타일(y 400~720) + 병사 0.3배 + 컷인 슬라이드 위치.
usage: python mock.py out.png sky.png far.png ground.png [units_dir] [cutin.png]"""
import sys, os
from PIL import Image
out, sky, far, gnd = sys.argv[1:5]
ud = sys.argv[5] if len(sys.argv) > 5 else ''
cut = sys.argv[6] if len(sys.argv) > 6 else ''
W, H = 1280, 720
im = Image.new('RGBA', (W, H), (11, 10, 8, 255))
im.alpha_composite(Image.open(sky).convert('RGBA').crop((300, 0, 300 + W, H)))
f = Image.open(far).convert('RGBA'); im.alpha_composite(f.crop((200, 0, 200 + W, 360)), (0, 400 - 360))
g = Image.open(gnd).convert('RGBA')
for x in range(-200, W, g.width): im.alpha_composite(g, (x, 400))
if ud:
    kinds = ['inf', 'spear', 'bow', 'cav', 'general_left', 'general_right']
    for n, k in enumerate(kinds):
        p = os.path.join(ud, k + '.png')
        if not os.path.exists(p): continue
        u = Image.open(p).convert('RGBA')
        for side, tint, x0, flip in (('L', (58, 166, 85), 300, False), ('R', (59, 111, 214), 900, True)):
            t = Image.new('RGBA', u.size, tint + (255,)); t.putalpha(u.split()[-1])
            uu = Image.blend(u, t, 0.0)  # 원본
            # 곱셈 tint 흉내(Phaser setTint = multiply)
            import numpy as np
            a = np.array(u).astype(float); a[..., :3] *= np.array(tint) / 255; uu = Image.fromarray(a.clip(0, 255).astype('uint8'), 'RGBA')
            if flip: uu = uu.transpose(Image.FLIP_LEFT_RIGHT)
            for s, y in ((0.3, 470 + n * 12), (1.0, 20)):
                r = uu.resize((int(u.width * s), int(u.height * s)), Image.LANCZOS)
                im.alpha_composite(r, (x0 + n * (40 if s < 1 else 100), y if s < 1 else (20 if side == 'L' else 160)))
if cut:
    c = Image.open(cut).convert('RGBA'); s = 700 / c.height
    c = c.resize((int(c.width * s), 700), Image.LANCZOS)
    im.alpha_composite(c, (W - c.width - 40, 10))
im.convert('RGB').save(out); print(out, im.size)
