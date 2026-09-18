# 통합 담당: assets/battle/{units2,field,fx,hud} 전수 실측 (크기·모드·알파 bbox·발끝·발 중심 x)
import sys, os, glob, json
import numpy as np
from PIL import Image
ROOT = os.path.join(os.path.dirname(__file__), '..', '..', 'battle')
out = {}
for sub in ['units2', 'field', 'fx', 'hud']:
    for p in sorted(glob.glob(os.path.join(ROOT, sub, '*.png'))):
        im = Image.open(p)
        w, h = im.size
        rec = {'w': w, 'h': h, 'mode': im.mode}
        if im.mode == 'RGBA':
            a = np.array(im)[:, :, 3]
            ys, xs = np.where(a > 32)
            if len(xs):
                rec['bbox'] = [int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1]
                # 단단한 바닥(알파>128) 맨 아래 행
                ys2, xs2 = np.where(a > 128)
                rec['solidBottom'] = int(ys2.max()) + 1 if len(ys2) else None
                # 발 중심 x: 맨 아래 8행의 알파 가중 평균
                yb = int(ys2.max()) if len(ys2) else int(ys.max())
                band = a[max(0, yb - 7):yb + 1, :].astype(float)
                rec['footX'] = round(float((band.sum(0) * np.arange(w)).sum() / max(1, band.sum())), 1)
                rec['alphaMean'] = round(float(a.mean() / 255), 3)
        key = sub + '/' + os.path.basename(p)
        out[key] = rec
        print(key, rec)
