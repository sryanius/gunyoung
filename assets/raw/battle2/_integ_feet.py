# 통합 담당: 발 위치 실측 — 아래 7행(y146~152)의 알파>128 열을 덩어리로 나눠 본다(무기 끝·옷자락과 발을 가르려고)
import os, glob, numpy as np
from PIL import Image
D = os.path.join(os.path.dirname(__file__), '..', '..', 'battle', 'units2')
for p in sorted(glob.glob(os.path.join(D, '*.png'))):
    a = np.array(Image.open(p))[:, :, 3]
    band = (a[145:153] > 128).sum(0)
    cols = np.where(band >= 2)[0]
    runs = []
    for c in cols:
        if runs and c - runs[-1][1] <= 2: runs[-1][1] = c
        else: runs.append([c, c])
    # 몸통 중심: y 60~120 알파>128 의 열 무게중심(무기 가는 선 영향 줄이려 열 합이 8 이상인 열만)
    body = (a[60:125] > 128).sum(0); bc = np.where(body >= 12)[0]
    bx = (body[bc] * bc).sum() / max(1, body[bc].sum())
    print('%-26s feet runs %-40s body cx %.1f' % (os.path.basename(p), runs, bx))
