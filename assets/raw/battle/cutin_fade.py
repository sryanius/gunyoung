# 컷인 가장자리 알파 페이드 — 그림이 사방 끝까지 차 있어 화면에서 「붙여 넣은 사각형」으로 보였다.
#   python assets/raw/battle/cutin_fade.py   (원본은 assets/raw/battle/cutin_orig/ 에서 읽는다)
import os, numpy as np
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
SRC = os.path.join(ROOT, 'assets', 'raw', 'battle', 'cutin_orig')
DST = os.path.join(ROOT, 'assets', 'battle', 'cutin')
L, R, T, B = 170, 90, 50, 110   # 페이드 폭(px)
for f in sorted(os.listdir(SRC)):
    if not f.endswith('.png'): continue
    im = Image.open(os.path.join(SRC, f)).convert('RGBA')
    a = np.asarray(im).astype(np.float32)
    h, w = a.shape[:2]
    mx = np.ones(w, np.float32); my = np.ones(h, np.float32)
    mx[:L] = np.linspace(0, 1, L) ** 1.6; mx[w-R:] = np.linspace(1, 0, R) ** 1.6
    my[:T] = np.linspace(0, 1, T) ** 1.6; my[h-B:] = np.linspace(1, 0, B) ** 1.6
    a[..., 3] *= my[:, None] * mx[None, :]
    Image.fromarray(a.clip(0, 255).astype(np.uint8), 'RGBA').save(os.path.join(DST, f))
    print(f, im.size)
