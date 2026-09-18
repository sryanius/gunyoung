# -*- coding: utf-8 -*-
"""SDXL 방사형 불꽃(검정 배경) → impact/spark: 가장 밝은 중심을 찾아 정사각 크롭 → 방사 창으로 가장자리를 순검정까지 → 축소.
usage: python fx_from_sd.py src.png out.png size crop_half [--floor=12]"""
import sys
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter
src, dst, size, half = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
floor = 12
for a in sys.argv: 
    if a.startswith('--floor='): floor = int(a[8:])
a = np.array(Image.open(src).convert('RGB')).astype(np.float32)
lum = gaussian_filter(a.max(-1), 12)
cy, cx = np.unravel_index(lum.argmax(), lum.shape)
half = min(half, cx, cy, a.shape[1] - cx, a.shape[0] - cy)
c = a[cy - half:cy + half, cx - half:cx + half]
c = np.clip(c - floor, 0, None) * (255 / (255 - floor))            # 배경의 검푸른 바닥값을 0 으로
y, x = np.mgrid[0:2 * half, 0:2 * half].astype(np.float32)
r = np.hypot(x - half, y - half) / half
t = np.clip((r - 0.62) / (0.96 - 0.62), 0, 1); win = 1 - t * t * (3 - 2 * t)
c *= win[..., None]
im = Image.fromarray(np.clip(c, 0, 255).astype(np.uint8)).resize((size, size), Image.LANCZOS)
b = np.array(im); b[0, :] = 0; b[-1, :] = 0; b[:, 0] = 0; b[:, -1] = 0
Image.fromarray(b).save(dst); print(dst, 'center', cx, cy, 'half', half, 'max', b.max(), 'edge1 max', max(b[1].max(), b[-2].max(), b[:, 1].max(), b[:, -2].max()))
