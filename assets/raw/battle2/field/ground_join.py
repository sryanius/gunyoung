# -*- coding: utf-8 -*-
"""img2img 창 3장(1536×640, 시작 x = 0·1214·2427 of 3641) → 0.5625 배 → 2048×360 가로 주기 ground.
usage: python ground_join.py out.png w0.png w1.png w2.png [--top=r,g,b] [--topa=0.5] [--gain=1.0] [--sat=1.0] [--x2=_x2.png]
 - 겹침(181px)은 선형 페더, 마지막 창은 x=0 으로 감긴다(wrap) → tileSprite 이음새 없음
 - 위쪽(먼 곳): --top 색으로 덮고(알파 topa→0, 위 45%) 가로 블러 — 어둡고 흐리게. 아래는 그대로 선명
 - --x2: 2장 이어 붙인 확인 그림"""
import sys
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter

args = [a for a in sys.argv[1:] if not a.startswith('--')]
opt = {a.split('=')[0][2:]: a.split('=')[1] for a in sys.argv[1:] if a.startswith('--')}
dst, wins = args[0], args[1:4]
W, H, TW = 2048, 360, 864
starts = (0, 683, 1365); OV = TW - 683
acc = np.zeros((H, W, 3), np.float32); wsum = np.zeros((1, W, 1), np.float32)
xs = np.arange(TW, dtype=np.float32)
wt = np.minimum(1, np.minimum((xs + 0.5) / OV, (TW - xs - 0.5) / OV))
for f, s0 in zip(wins, starts):
    a = np.array(Image.open(f).convert('RGB').resize((TW, H), Image.LANCZOS)).astype(np.float32)
    idx = (s0 + np.arange(TW)) % W
    np.add.at(acc, (slice(None), idx), a * wt[None, :, None])
    np.add.at(wsum, (slice(None), idx), wt[None, :, None])
out = acc / wsum

gain = float(opt.get('gain', 1)); sat = float(opt.get('sat', 1))
if gain != 1: out *= gain
if sat != 1:
    g = out @ np.array([0.299, 0.587, 0.114], np.float32); out = g[..., None] * (1 - sat) + out * sat
# 창마다 평균 밝기가 달라 생기는 큰 얼룩을 줄인다: 열 평균(저주파)을 전체 평균으로 절반만 당김
col = out.mean(axis=(0, 2)); col_s = gaussian_filter(col, 120, mode='wrap')
out *= (1 + 0.6 * (col.mean() / col_s - 1))[None, :, None]

t = (np.arange(H, dtype=np.float32) / (H - 1))[:, None, None]
haze = np.array([int(v) for v in opt.get('haze', '226,208,186').split(',')], np.float32)
ha = float(opt.get('hazea', 0.8)); hh = float(opt.get('hazeh', 0.36)); fade = int(opt.get('fade', 40))
blur = gaussian_filter(out, (1.2, 2.5, 0), mode=('reflect', 'wrap', 'reflect'))
m = np.clip(1 - t / 0.40, 0, 1)
out = blur * m + out * (1 - m)                                   # 먼 곳은 흐리게
# 먼 곳은 안개에 잠긴다: sky 지평선의 크림색으로 (hazea → 0, 위 hazeh 구간). «어둡게» 는 코드의 battle_shade(위 0.35)가 얹는다 —
#   그림까지 어두우면 밝은 하늘 밑에 검은 띠가 생긴다(_mock_a.png).
k = np.clip(1 - t / hh, 0, 1) ** 1.5 * ha
out = out * (1 - k) + haze * k
# 윗변 알파 페이드: 땅은 mid 보다 앞(깊이 3)에 그려져 mid 가 윗변을 못 가린다 → 그림이 스스로 풀려야 y=360 직선이 안 생긴다
al = np.ones((H, W), np.float32)
r = np.clip(np.arange(H, dtype=np.float32) / fade, 0, 1); al *= (r * r * (3 - 2 * r))[:, None]
rgb = np.clip(out, 0, 255).astype(np.uint8)
res = np.dstack([rgb, (al * 255 + 0.5).astype(np.uint8)])
Image.fromarray(res, 'RGBA').save(dst)
out = rgb
f = out.astype(np.float32)
seam = np.abs(f[:, 0] - f[:, -1]).mean(); avg = np.abs(np.diff(f, axis=1)).mean()
print(dst, out.shape, 'seam col diff %.2f vs mean neighbor diff %.2f' % (seam, avg), 'mean rgb', f.mean(axis=(0, 1)).round(0),
      'top row', f[:8].mean(axis=(0, 1)).round(0), 'bottom', f[-40:].mean(axis=(0, 1)).round(0))
if 'x2' in opt:
    Image.fromarray(np.concatenate([out[:, W // 2:], out, out[:, :W // 2]], axis=1)).save(opt['x2'])
