# -*- coding: utf-8 -*-
"""mid.png 2048×260 — 중경 띠(나무·언덕 실루엣 + 안개), 위 알파 페이드, 가로 주기.
usage: python build_mid.py out.png [--x2=_x2.png] [--prev=_prev.png]
조각: 흰 배경 수묵 나무 띠(SDXL mid_s*.png) 를 밝기→알파로 바꿔 자줏빛 갈색으로 물들이고, 페더로 이어 붙인다(마지막 조각은 x=0 으로 감김).
그 위에 크림색 안개 띠(주기 잡음)를 얹어 나무 밑동과 «하늘/땅 경계» 를 가린다.
배치(코드 BattleScene): 아래 변 = 땅 윗변(y 360) + MID_SINK 20 = y 380, setOrigin(0,1), 패럴랙스 0.5, 땅(깊이 3)보다 뒤(깊이 2).
  → 행 240 = 땅 윗변. 안개 띠는 행 228 부터 아래로 계속 짙어(알파 ~0.9) 땅의 알파 페이드 윗변 뒤에 크림색으로 깔린다. 맨 아래 10행만 알파 0 으로 풀린다."""
import sys
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter

opt = {a.split('=')[0][2:]: a.split('=')[1] for a in sys.argv[1:] if a.startswith('--')}
dst = [a for a in sys.argv[1:] if not a.startswith('--')][0]
W, H, F = 2048, 260, 110
# (파일, 좌우반전, 원본 y0, y1, 놓일 행 top, bottom, 지울 상자[(x0,y0,x1,y1)...])
PIECES = [
    ('mid_s2.png', False, 20, 420, 70, 250, [], 1.0),
    ('mid_s7.png', False, 40, 600, 44, 258, [(1480, 590, 1536, 640)], 1.0),
    ('mid_s6.png', True, 0, 500, 56, 254, [], 1.0),
    ('mid_s5.png', False, 120, 640, 70, 258, [], 0.80),          # 배경이 회색(밝기 ~0.85) → 흰색 기준을 낮춰 편다
    ('mid_s9.png', False, 40, 640, 62, 260, [(1090, 190, 1130, 232)], 1.0),
]
tiles = []
for f, flip, y0, y1, r0, r1, boxes, white in PIECES:
    a = np.clip(np.array(Image.open(f).convert('L')).astype(np.float32) / 255 / white, 0, 1)
    for bx0, by0, bx1, by1 in boxes: a[by0:by1, bx0:bx1] = 1.0          # 낙관·붉은 점 지우기(흰 배경)
    a = a[y0:y1]
    if flip: a = a[:, ::-1]
    s = (r1 - r0) / (y1 - y0)
    tiles.append([a, s, r0, r1])
P0 = sum(t[0].shape[1] * t[1] for t in tiles) - F * len(tiles)
kx = W / P0                                                            # 가로만 살짝 늘리거나 줄여 주기 2048 에 맞춘다
print('pieces', len(tiles), 'period before fit %.0f → kx %.3f' % (P0, kx))
acc = np.zeros((H, W), np.float32); wsum = np.zeros((1, W), np.float32)
x = 0.0
for a, s, r0, r1 in tiles:
    tw = int(round(a.shape[1] * s * kx)); th = r1 - r0
    im = np.array(Image.fromarray((a * 255).astype(np.uint8)).resize((tw, th), Image.LANCZOS)).astype(np.float32) / 255
    # 조각 위·아래 가장자리는 흰색으로 풀어 잘린 선이 안 보이게
    vy = np.arange(th, dtype=np.float32)
    vfade = np.clip(np.minimum(vy / 14, (th - 1 - vy) / 10), 0, 1)[:, None]
    im = 1 - (1 - im) * vfade
    full = np.ones((H, tw), np.float32); full[r0:r1] = im
    xs = np.arange(tw, dtype=np.float32)
    wt = np.clip(np.minimum((xs + 0.5) / F, (tw - xs - 0.5) / F), 0, 1)
    idx = (int(round(x)) + np.arange(tw)) % W
    np.add.at(acc, (slice(None), idx), full * wt[None, :]); np.add.at(wsum, (slice(None), idx), wt[None, :])
    x += tw - F * kx
lum = acc / np.maximum(wsum, 1e-3)

lo, hi = 0.22, 0.90
ink = np.clip((hi - lum) / (hi - lo), 0, 1)                            # 먹 = 1
ink = ink ** 0.85
# 색: 짙은 먹(가까운 나무) = 어두운 자줏빛 갈색, 옅은 먹(먼 나무·언덕) = sky 산 색에 가까운 회자색
dark = np.array((54, 42, 54), np.float32); light = np.array((146, 126, 136), np.float32)   # far 의 짙은 먹 봉우리보다 가까워 보이게 어둡게
rgb = light + (dark - light) * (ink[..., None] ** 1.2)
alpha = np.clip(ink * 1.05, 0, 0.97)

# 안개 띠: 가로 주기 잡음, 행 200 부터 짙어져 228 아래는 계속 짙다. 나무 앞에 얹는다
g = np.random.default_rng(7)
f = np.fft.fft2(g.standard_normal((H, W)))
ky = np.fft.fftfreq(H)[:, None]; kxs = np.fft.fftfreq(W)[None, :]
k = np.sqrt((kxs * 6.0) ** 2 + (ky * 1.2) ** 2) + 1e-4
nz = np.real(np.fft.ifft2(f / (k ** 1.8) * np.exp(-(k / 0.06) ** 2))); nz = (nz - nz.mean()) / nz.std()
rows = np.arange(H, dtype=np.float32)[:, None]
band = np.exp(-(np.clip(228 - rows, 0, None) / 30) ** 2)       # 행 228 아래는 계속 짙다(땅 뒤에 가린다)
band = np.maximum(band, np.exp(-((rows - 200) / 60) ** 2) * 0.35)        # 위로 옅게 번짐
fog_a = np.clip(band * (0.78 + 0.22 * np.tanh(nz)), 0, 1) * 0.94
fog_c = np.array((246, 233, 210), np.float32)                            # sky 지평선 크림색
# over 합성(안개가 앞)
out_a = fog_a + alpha * (1 - fog_a)
out_rgb = (fog_c * fog_a[..., None] + rgb * (alpha * (1 - fog_a))[..., None]) / np.maximum(out_a, 1e-4)[..., None]
# 위 30행·아래 10행 알파 페이드
vf = np.clip(rows / 30, 0, 1) * np.clip((H - 1 - rows) / 10, 0, 1)
vf = vf * vf * (3 - 2 * vf)
out_a = out_a * vf
out_rgb[out_a < 1 / 255] = 0
res = np.dstack([np.clip(out_rgb, 0, 255), np.clip(out_a * 255, 0, 255)]).astype(np.uint8)
Image.fromarray(res, 'RGBA').save(dst)
al = res[..., 3].astype(np.float32)
print(dst, res.shape, 'alpha mean %.3f, row0 max %d, last row max %d, row200 mean %.2f, row220 mean %.2f' % (al.mean() / 255, al[0].max(), al[-1].max(), al[200].mean() / 255, al[220].mean() / 255),
      'seam diff %.2f vs %.2f' % (np.abs(al[:, 0] - al[:, -1]).mean(), np.abs(np.diff(al, axis=1)).mean()))
if 'prev' in opt:                                                        # sky 위에 얹어 본다(y 180~440)
    sky = Image.open('/c/claude/gunyoung/assets/battle/sky.png'.replace('/c/', 'C:/')).convert('RGBA')
    m = Image.fromarray(res, 'RGBA')
    sky.alpha_composite(m, (0, 150)); sky.crop((0, 120, 2048, 480)).convert('RGB').save(opt['prev'])
if 'x2' in opt:
    r2 = np.concatenate([res[:, W // 2:], res, res[:, :W // 2]], axis=1)
    bg = np.empty((H, W * 2, 3), np.float32); bg[...] = (240, 215, 175)
    a = r2[..., 3:4].astype(np.float32) / 255
    Image.fromarray((r2[..., :3] * a + bg * (1 - a)).astype(np.uint8)).save(opt['x2'])
