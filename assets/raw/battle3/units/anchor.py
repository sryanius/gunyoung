# -*- coding: utf-8 -*-
"""무장 8장의 「몸 중심 열」 실측(BattleScene.U2_ANCHOR 용) — 몸통 띠(y 96~128)의 행마다 가장 긴 불투명 구간의 가운데 평균 + 머리(머리끝~+40px) 같은 식 + 발 덩어리.
   python anchor.py [x값 덮어쓰기: gen_guanyu_stand=60 ...] → units/_anchor_sheet.png (4배, 빨간 선 = 제안 열, 노란 선 = 64)"""
import sys, os, numpy as np
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__)); D = os.path.join(HERE, '..', '..', '..', 'battle', 'units2')
over = dict(a.split('=') for a in sys.argv[1:])
def longest_center(row):
    xs = np.where(row)[0]
    if len(xs) == 0: return None
    runs = np.split(xs, np.where(np.diff(xs) > 1)[0] + 1); r = max(runs, key=len); return (r[0] + r[-1]) / 2, len(r)
names = ['gen_%s_%s' % (k, p) for k in ('guanyu', 'zhangfei', 'xiahoudun', 'dianwei') for p in ('stand', 'attack')]
sh = Image.new('RGB', (128 * 4 * 4, 160 * 4 * 2), (96, 84, 60)); d = ImageDraw.Draw(sh)
for i, n in enumerate(names):
    a = np.array(Image.open(os.path.join(D, n + '.png')).convert('RGBA')); al = a[..., 3] > 128
    ys = np.where(al.any(1))[0]; top = ys[0]
    body = [longest_center(al[y]) for y in range(100, 130)]; body = [b for b in body if b and b[1] >= 10]
    bx = np.mean([b[0] for b in body]) if body else 64
    band = al[145:153].sum(0); cols = np.where(band >= 2)[0]; runs = []
    for c in cols:
        if runs and c - runs[-1][1] <= 2: runs[-1][1] = int(c)
        else: runs.append([int(c), int(c)])
    ax = float(over.get(n, bx)); print('%-24s 몸통 %.1f  발 덩어리 %s  → %d' % (n, bx, runs, round(ax)))
    im = Image.fromarray(a, 'RGBA').resize((512, 640), Image.NEAREST); ox, oy = (i // 2) * 512, (i % 2) * 640; sh.paste(im, (ox, oy), im)
    d.line((ox + 64 * 4, oy, ox + 64 * 4, oy + 640), fill=(255, 255, 0)); d.line((ox + ax * 4, oy, ox + ax * 4, oy + 640), fill=(255, 0, 0), width=2)
sh.save(os.path.join(HERE, '_anchor_sheet.png'))
