# -*- coding: utf-8 -*-
"""통합 회차 — field 검수 should 중 픽셀 손질로 끝나는 것(원본은 field/_integ_old/ 에 백업):
  tree_dead.png : 바닥 그림자가 오른쪽 변에서 수직으로 잘림 → 오른쪽 16열 알파 램프 / 가지 끝 연어색 프린지(R>150·R−G>60) → 줄기색
  banner_g/b.png: 바닥 그림자가 왼쪽 변에서 잘림(알파 37) → 왼쪽 8열 알파 램프(그림자 행만)
usage: python _integ_fix_edges.py   (assets/battle/field 를 제자리에서 고친다. 두 번 돌려도 같은 결과가 되게 백업본에서 읽는다)"""
import os, numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'field', '_integ_old'); DST = os.path.join(HERE, '..', '..', 'battle', 'field')
a = np.array(Image.open(os.path.join(SRC, 'tree_dead.png')).convert('RGBA')).astype(np.float32)
h, w = a.shape[:2]
fr = (a[..., 0] > 150) & (a[..., 0] - a[..., 1] > 60) & (a[..., 3] > 0)
print('tree_dead fringe px', int(fr.sum()))
a[fr, :3] = (52, 30, 34)
ramp = np.clip((w - 1 - np.arange(w)) / 16.0, 0, 1)[None, :]
sh = np.zeros((h, w), bool); sh[220:, :] = True; sh &= a[..., 3] < 128          # 그림자(반투명)만 — 줄기·가지는 그대로
a[..., 3] = np.where(sh, a[..., 3] * ramp, a[..., 3])
print('tree_dead right col alpha max', a[:, -1, 3].max())
Image.fromarray(a.astype(np.uint8), 'RGBA').save(os.path.join(DST, 'tree_dead.png'))
for n in ('banner_g.png', 'banner_b.png'):
    b = np.array(Image.open(os.path.join(SRC, n)).convert('RGBA')).astype(np.float32)
    h, w = b.shape[:2]
    ramp = np.clip(np.arange(w) / 8.0, 0, 1)[None, :]
    sh = np.zeros((h, w), bool); sh[178:, :] = True; sh &= b[..., 3] < 128
    b[..., 3] = np.where(sh, b[..., 3] * ramp, b[..., 3])
    print(n, 'left col alpha max', b[:, 0, 3].max())
    Image.fromarray(b.astype(np.uint8), 'RGBA').save(os.path.join(DST, n))
