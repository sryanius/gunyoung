# -*- coding: utf-8 -*-
"""컷인 가장자리 알파 페이드 — assets/raw/battle/cutin_fade.py 와 같은 식, 수치만 1.5배(832→1248): 좌 255 · 우 135 · 상 75 · 하 165.
   k/<key>_key.png → assets/battle/cutin/<key>.png (페이드 전 원본은 assets/raw/battle/cutin_orig/ 에도 복사 — 기존 cutin_fade.py 는 1차 수치(832용)라 다시 돌리지 말 것)"""
import os, shutil, numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
DST = os.path.join(ROOT, 'assets', 'battle', 'cutin')
L, R, T, B = 255, 135, 75, 165
for key in ('guanyu', 'zhangfei', 'xiahoudun', 'dianwei'):
    im = Image.open(os.path.join(HERE, 'k', key + '_key.png')).convert('RGBA'); a = np.asarray(im).astype(np.float32); h, w = a.shape[:2]
    mx = np.ones(w, np.float32); my = np.ones(h, np.float32)
    mx[:L] = np.linspace(0, 1, L) ** 1.6; mx[w-R:] = np.linspace(1, 0, R) ** 1.6
    my[:T] = np.linspace(0, 1, T) ** 1.6; my[h-B:] = np.linspace(1, 0, B) ** 1.6
    a[..., 3] *= my[:, None] * mx[None, :]
    u = a.clip(0, 255).astype(np.uint8); u[u[..., 3] == 0] = 0      # 알파 0 픽셀 RGB 0 유지(uint8 로 내린 뒤에 — 0.x 알파가 0 이 되면서 RGB 가 남았었다)
    Image.fromarray(u, 'RGBA').save(os.path.join(DST, key + '.png')); print(key, im.size)
