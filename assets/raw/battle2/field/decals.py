# -*- coding: utf-8 -*-
"""바닥 데칼 128×64 알파 — blood1·blood2(핏자국)·crater(패인 자국). 옆에서 본 땅이라 세로로 눌린 타원.
usage: python decals.py <outdir>   (4배 슈퍼샘플. 코드는 폭 46px 안팎으로 작게 찍으므로 덩어리를 굵게)"""
import sys, os
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter
out = sys.argv[1]; os.makedirs(out, exist_ok=True)
S = 4; W, H = 128 * S, 64 * S
y, x = np.mgrid[0:H, 0:W].astype(np.float32)
u = (x - W / 2) / (W / 2); v = (y - H / 2) / (H / 2)

def fbm(seed, s0):
    g = np.random.default_rng(seed); t = np.zeros((H, W), np.float32)
    for k, amp in enumerate((1, 0.5, 0.25)):
        n = gaussian_filter(g.standard_normal((H, W)).astype(np.float32), (s0 / 2 ** k / 2, s0 / 2 ** k)); t += amp * n / n.std()
    return t / 1.75

def save(rgb, a, name):
    a = np.clip(a, 0, 1); pm = np.dstack([rgb * a[..., None], a * 255])
    sm = np.array(Image.fromarray(np.clip(pm, 0, 255).astype(np.uint8), 'RGBA').resize((128, 64), Image.LANCZOS)).astype(np.float32)
    al = np.clip(sm[..., 3:4], 1, 255); sm[..., :3] = np.clip(sm[..., :3] / (al / 255), 0, 255); sm[sm[..., 3] < 2] = 0
    sm[0, :, 3] = 0; sm[-1, :, 3] = 0; sm[:, 0, 3] = 0; sm[:, -1, 3] = 0
    p = os.path.join(out, name + '.png'); Image.fromarray(sm.astype(np.uint8), 'RGBA').save(p)
    print(p, 'alpha mean %.2f max %d' % (sm[..., 3].mean() / 255, sm[..., 3].max()))

def blood(name, seed, blobs, drops):
    g = np.random.default_rng(seed); f = np.zeros((H, W), np.float32)
    for bx, by, br in blobs: f = np.maximum(f, 1 - np.hypot((u - bx) / br, (v - by) / (br * 1.5)))
    f = f + fbm(seed, 28 * S / 4 * 2) * 0.28
    f = f - np.clip((np.hypot(u, v) - 0.70) / 0.25, 0, 1) * 1.2       # 캔버스 가장자리로 갈수록 덩어리가 스스로 줄어든다(알파 창으로 자르면 잘린 호가 보였다)
    m = np.clip((f - 0.30) / 0.05, 0, 1)
    for k in range(drops):                                        # 튄 방울 — 가로로 길쭉
        a = g.uniform(0, 2 * np.pi); rr = g.uniform(0.45, 0.88); dx, dy = np.cos(a) * rr, np.sin(a) * rr * 0.8
        r = g.uniform(0.02, 0.06)
        m = np.maximum(m, np.clip((1 - np.hypot((u - dx) / (r * 1.6), (v - dy) / (r * 1.6))) / 0.25, 0, 1))
    m = gaussian_filter(m, S * 0.5)
    depth = gaussian_filter(m, S * 3)
    dark = np.array((58, 6, 8), np.float32); red = np.array((132, 18, 14), np.float32)
    rgb = red + (dark - red) * np.clip(depth * 1.25 - 0.15, 0, 1)[..., None]
    spec = np.clip((gaussian_filter(m, S * 1.2) - gaussian_filter(np.roll(m, (S * 2, S * 2), (0, 1)), S * 1.2)) * 3, 0, 1)   # 위쪽 가장자리의 젖은 광택
    spec = spec * (m > 0.3)                                        # roll 이 감겨 생기는 바깥 얼룩 제거
    rgb = rgb + spec[..., None] * np.array((70, 30, 26), np.float32)
    save(rgb, m * 0.86 * (1 - np.clip((np.hypot(u, v) - 0.9) / 0.1, 0, 1)), name)

blood('blood1', 5, [(-0.05, 0.0, 0.62), (0.32, 0.18, 0.34), (-0.42, -0.15, 0.30)], 9)
blood('blood2', 9, [(0.1, 0.05, 0.50), (-0.30, 0.22, 0.36), (0.48, -0.20, 0.22), (-0.55, -0.1, 0.16)], 13)

# crater: 어두운 구덩이 + 위쪽 안벽 그늘, 아래쪽 밝은 흙 테, 방사 균열
r = np.hypot(u / 0.86, v / 0.80) + fbm(21, 40) * 0.07
pit = np.clip((0.62 - r) / 0.10, 0, 1)
rim = np.exp(-((r - 0.72) / 0.10) ** 2)
th = np.arctan2(v, u); g = np.random.default_rng(3); cr = np.zeros((H, W), np.float32)
for k in range(11):
    a = g.uniform(-np.pi, np.pi); L = g.uniform(0.78, 0.98); wd = g.uniform(0.018, 0.035)
    d = np.angle(np.exp(1j * (th - a))); perp = np.abs(np.sin(d)) * r; al = np.cos(d) * r
    cr = np.maximum(cr, np.clip(1 - perp / (wd * np.clip(1 - (al - 0.55) / (L - 0.55), 0.05, 1)), 0, 1) * (al > 0.55) * (al < L))
shade = np.clip(0.55 - v * 0.9, 0, 1)                             # 구덩이 위쪽(먼 안벽)이 더 어둡다
rgb = np.zeros((H, W, 3), np.float32) + np.array((46, 32, 24), np.float32)
rgb = rgb * (0.7 + 0.5 * (1 - shade))[..., None]
lit = np.clip(v * 1.2 + 0.2, 0, 1)                                # 테는 아래쪽이 밝다(빛 받는 흙더미)
rimc = np.array((120, 92, 62), np.float32) + (np.array((206, 172, 118), np.float32) - np.array((120, 92, 62), np.float32)) * lit[..., None]
a_pit = pit * 0.78; a_rim = rim * (0.30 + 0.45 * lit) * (1 - pit)
a_cr = cr * 0.6 * (1 - pit)
alpha = np.clip(a_pit + a_rim + a_cr, 0, 1)
col = (rgb * a_pit[..., None] + rimc * a_rim[..., None] + np.array((40, 28, 22), np.float32) * a_cr[..., None]) / np.maximum(alpha, 1e-3)[..., None]
alpha = gaussian_filter(alpha, S * 0.6) * (1 - np.clip((np.hypot(u, v) - 0.92) / 0.08, 0, 1))
save(col, alpha, 'crater')
