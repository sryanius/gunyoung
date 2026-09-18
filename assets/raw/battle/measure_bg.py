# -*- coding: utf-8 -*-
"""단색(분홍) 배경색 측정 + 키잉 결과 검증 (컷인 2차).
  python measure_bg.py bg <png...>            → 각 파일의 배경색(32단계 양자화 최빈색 근처 픽셀 평균)과 네 모서리 평균
  python measure_bg.py check <keyed.png> r,g,b [--eye=x0,y0,x1,y1 ...]  → 배경 거리<30 불투명 픽셀 수, 반투명 평균색, 알파0 RGB max, 내부 투명 성분, 눈 상자 알파"""
import sys, numpy as np
from PIL import Image
from scipy import ndimage
sys.stdout.reconfigure(encoding='utf-8')
def bg_of(a):
    # 분홍 후보(R>150, G<110, R>B) 픽셀만으로 최빈색 — 전체 최빈색은 검은 갑옷(1,2,3), 모서리는 인물이 덮는다(하후돈 s22 (63,4,79))
    a = a.reshape(-1, 3); pk = a[(a[:, 0] > 150) & (a[:, 1] < 110) & (a[:, 0] > a[:, 2])]
    if len(pk) > 1000: a = pk
    q = (a // 8).reshape(-1, 3).astype(np.int64)
    keys = q[:, 0] * 4096 + q[:, 1] * 64 + q[:, 2]
    vals, cnt = np.unique(keys, return_counts=True)
    k = vals[cnt.argmax()]
    m = keys == k
    c = a.reshape(-1, 3)[m].mean(0)
    # 최빈색 근처(거리<16) 전체 평균으로 다듬기
    d = np.sqrt(((a.reshape(-1, 3).astype(np.float32) - c) ** 2).sum(-1))
    c2 = a.reshape(-1, 3)[d < 16].mean(0)
    return tuple(int(round(v)) for v in c2), float(cnt.max()) / len(keys)
if sys.argv[1] == 'bg':
    for p in sys.argv[2:]:
        a = np.array(Image.open(p).convert('RGB'))
        c, frac = bg_of(a)
        corners = np.concatenate([a[:16, :16].reshape(-1, 3), a[:16, -16:].reshape(-1, 3), a[-16:, :16].reshape(-1, 3), a[-16:, -16:].reshape(-1, 3)]).mean(0)
        print('%s: 최빈 배경색 %s (비율 %.2f)  모서리 평균 %s' % (p, c, frac, tuple(int(v) for v in corners)))
else:
    p = sys.argv[2]; bg = np.array([int(v) for v in sys.argv[3].split(',')], np.float32)
    a = np.array(Image.open(p).convert('RGBA')).astype(int); rgb, al = a[..., :3], a[..., 3]
    d = np.sqrt(((rgb.astype(np.float32) - bg) ** 2).sum(-1))
    m = (al > 250) & (d < 30)
    lab, n = ndimage.label(m); sizes = ndimage.sum(m, lab, range(1, n + 1)) if n else np.array([])
    lab2, n2 = ndimage.label(al == 0); edge = set(np.unique(np.concatenate([lab2[0], lab2[-1], lab2[:, 0], lab2[:, -1]])).tolist())
    inner = sorted(int(v) for v in ndimage.sum(np.ones_like(al), lab2, [i for i in range(1, n2 + 1) if i not in edge])) if n2 else []
    semi = (al > 0) & (al < 255)
    ys, xs = np.where(al > 8)
    print('%s %dx%d bbox=(%d,%d,%d,%d)' % (p, a.shape[1], a.shape[0], xs.min(), ys.min(), xs.max(), ys.max()))
    print('  배경 거리<30 불투명 픽셀 %d (조각 %d, 최대 %d px)' % (int(m.sum()), n, int(sizes.max()) if n else 0))
    print('  반투명 픽셀 %d 평균색 %s / 알파0 RGB max %d' % (int(semi.sum()), tuple(int(v) for v in rgb[semi].mean(0)) if semi.any() else None, int(rgb[al == 0].max()) if (al == 0).any() else -1))
    print('  가장자리 미접촉 투명 성분 %d 개 %s' % (len(inner), inner[:12]))
    for arg in sys.argv[4:]:
        if arg.startswith('--eye='):
            x0, y0, x1, y1 = (int(v) for v in arg[6:].split(','))
            box = al[y0:y1, x0:x1] / 255.0
            print('  눈 상자 x%d-%d y%d-%d 알파 평균 %.3f min %.2f' % (x0, x1 - 1, y0, y1 - 1, box.mean(), box.min()))
