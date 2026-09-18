# -*- coding: utf-8 -*-
"""경로 A 후처리: 초록 배경 SDXL 그림을 키잉 → 1px 침식 → 트림 → 정사각 패딩 → 64x64 Lanczos.
가장자리에서 이어진 배경만 지운다(플러드필) — 사물 안의 초록은 보존.
실행: python key_sdxl.py <입력png> <출력png> [허용거리=60]
"""
import sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

src, dst = sys.argv[1], sys.argv[2]
TOL = float(sys.argv[3]) if len(sys.argv) > 3 else 60
im = Image.open(src).convert('RGB')
a = np.asarray(im).astype(np.int32)
H, W, _ = a.shape
# 배경색: 네 귀퉁이 24px 평균
c = np.concatenate([a[:24, :24].reshape(-1, 3), a[:24, -24:].reshape(-1, 3), a[-24:, :24].reshape(-1, 3), a[-24:, -24:].reshape(-1, 3)])
bg = c.mean(axis=0)
dist = np.sqrt(((a - bg) ** 2).sum(axis=2))
cand = (dist < TOL)                    # 배경 후보(참=배경색에 가까움)
# 연결 성분: 후보이면서 가장자리와 이어진 성분만 배경 (PIL floodfill 은 Pillow 12 에서 무반응이라 scipy 로)
lab, n = ndimage.label(cand)
edge_labels = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
isbg = np.isin(lab, list(edge_labels))
alpha = Image.fromarray(np.where(isbg, 0, 255).astype(np.uint8))
alpha = alpha.filter(ImageFilter.MinFilter(3))                # 1px 침식(배경색 번짐 제거)
rgba = im.convert('RGBA'); rgba.putalpha(alpha)
bb = alpha.getbbox()
if not bb: sys.exit('키잉 결과가 비었다')
cut = rgba.crop(bb)
side = max(cut.size) + 8
sq = Image.new('RGBA', (side, side), (0, 0, 0, 0))
sq.alpha_composite(cut, ((side - cut.width) // 2, (side - cut.height) // 2))
small = sq.convert('RGBa').resize((64, 64), Image.LANCZOS).convert('RGBA')
small.save(dst)
print(dst, 'bbox', bb, 'bg', bg.round(0).tolist(), 'alpha extrema', small.getchannel('A').getextrema())
