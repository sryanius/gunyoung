# -*- coding: utf-8 -*-
"""4명 확인 시트 — 컷인(무장 색 그라데이션 위) + 눈 띠 + 초상. → cutin_sheet.png"""
from PIL import Image
import numpy as np, os
HERE = os.path.dirname(os.path.abspath(__file__)); A = os.path.join(HERE, '..', '..', 'battle')
keys = ['guanyu', 'zhangfei', 'xiahoudun', 'dianwei']; cols = [(30, 60, 40), (70, 28, 24), (28, 44, 84), (24, 28, 48)]
W, H = 520, 760; sh = Image.new('RGB', (W * 4, H + 130 + 130), (12, 12, 12))
for i, k in enumerate(keys):
    im = Image.open(os.path.join(A, 'cutin', k + '.png')).convert('RGBA').resize((W, H), Image.LANCZOS)
    y = np.linspace(0, 1, H)[:, None, None]; bg = np.broadcast_to((np.array(cols[i])[None, None, :] * (1.3 - 0.9 * y)).clip(0, 255).astype(np.uint8), (H, W, 3)).copy()
    b = Image.fromarray(bg, 'RGB').convert('RGBA'); b.alpha_composite(im); sh.paste(b.convert('RGB'), (i * W, 0))
    sh.paste(Image.open(os.path.join(A, 'cutin', k + '_eyes.png')).resize((W, 130), Image.LANCZOS), (i * W, H))
    p = Image.open(os.path.join(A, 'hud', 'portrait_%s.png' % k)); sh.paste(p, (i * W + 20, H + 135)); sh.paste(p.resize((72, 90), Image.LANCZOS), (i * W + 140, H + 150))
sh.save(os.path.join(HERE, 'cutin_sheet.png')); print(sh.size)
