# -*- coding: utf-8 -*-
"""컷인 키잉 검증(위치별 배경장 기준). python check_cutin.py <keyed.png> [<bgfield.npy>] [--eye=x0,y0,x1,y1 ...]
  배경 거리<30 불투명 픽셀 수 · 반투명 평균색 · 알파0 RGB max · 가장자리 미접촉 투명 성분 · 눈 상자 알파"""
import sys, os, numpy as np
from PIL import Image
from scipy import ndimage
sys.stdout.reconfigure(encoding='utf-8')
p = sys.argv[1]; rest = [a for a in sys.argv[2:] if not a.startswith('--')]
fld = np.load(rest[0] if rest else os.path.splitext(p)[0] + '_bgfield.npy').astype(np.float32)
a = np.array(Image.open(p).convert('RGBA')).astype(int); rgb, al = a[..., :3], a[..., 3]
d = np.sqrt(((rgb.astype(np.float32) - fld) ** 2).sum(-1))
m = (al > 250) & (d < 30); lab, n = ndimage.label(m); sizes = ndimage.sum(m, lab, range(1, n + 1)) if n else np.array([])
lab2, n2 = ndimage.label(al == 0); edge = set(np.unique(np.concatenate([lab2[0], lab2[-1], lab2[:, 0], lab2[:, -1]])).tolist())
inner = sorted(int(v) for v in ndimage.sum(np.ones_like(al), lab2, [i for i in range(1, n2 + 1) if i not in edge])) if n2 else []
semi = (al > 0) & (al < 255); ys, xs = np.where(al > 8)
print('%s %dx%d bbox=(%d,%d,%d,%d) 배경장 평균 %s' % (p, a.shape[1], a.shape[0], xs.min(), ys.min(), xs.max(), ys.max(), tuple(int(v) for v in fld.reshape(-1, 3).mean(0))))
print('  배경 거리<30 불투명 픽셀 %d (조각 %d, 최대 %d px)' % (int(m.sum()), n, int(sizes.max()) if n else 0))
print('  반투명 픽셀 %d 평균색 %s / 알파0 RGB max %d' % (int(semi.sum()), tuple(int(v) for v in rgb[semi].mean(0)), int(rgb[al == 0].max())))
print('  가장자리 미접촉 투명 성분 %d 개 %s' % (len(inner), inner[:14]))
l3, n3 = ndimage.label(al > 0); print('  불투명 조각 수 %d' % n3)
for arg in sys.argv[2:]:
    if arg.startswith('--eye='):
        x0, y0, x1, y1 = (int(v) for v in arg[6:].split(',')); box = al[y0:y1, x0:x1] / 255.0
        print('  눈 상자 x%d-%d y%d-%d 알파 평균 %.3f min %.2f' % (x0, x1 - 1, y0, y1 - 1, box.mean(), box.min()))
