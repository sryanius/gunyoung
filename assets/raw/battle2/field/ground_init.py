# -*- coding: utf-8 -*-
"""ground.png 용 img2img 초안 — 가로 주기(3641px = 2048/0.5625) 의 전장 땅을 파이썬으로 그리고 1536×640 창 3개로 자른다.
usage: python ground_init.py <outdir> [seed]
 - 위(먼 곳): 어둡고 흐린 자줏빛 갈색, 무늬가 가로로 눌림 / 아래(가까운 곳): 밝은 황토·마른 풀, 풀 다발·자갈이 크게
 - 가운데쯤 가로로 흐르는 흙길 + 바퀴 자국 두 줄
창 시작 x = 0, 1214, 2427 (폭 1536, wrap). 합칠 땐 ground_join.py."""
import sys, os
import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import gaussian_filter

out = sys.argv[1]; seed = int(sys.argv[2]) if len(sys.argv) > 2 else 1
os.makedirs(out, exist_ok=True)
W, H = 3641, 640
g = np.random.default_rng(seed)

def pnoise(sx, sy, s):
    """가로 주기 잡음(0~1). sx, sy = 블러 시그마"""
    n = np.random.default_rng(s).standard_normal((H, W)).astype(np.float32)
    n = gaussian_filter(n, (sy, sx), mode=('reflect', 'wrap'))
    return (n - n.min()) / (n.max() - n.min())

yy = (np.arange(H, dtype=np.float32) / (H - 1))[:, None]          # 0 위 ~ 1 아래
xx = np.arange(W, dtype=np.float32)[None, :]

def lerp(c0, c1, t): return np.array(c0, np.float32) * (1 - t[..., None]) + np.array(c1, np.float32) * t[..., None]

# 바탕 세로 그라데이션: 자줏빛 어두운 갈색 → 올리브 황토 → 밝은 황토
t = np.broadcast_to(yy, (H, W))
base = np.where((t < 0.45)[..., None], lerp((104, 88, 80), (150, 124, 84), t / 0.45), lerp((150, 124, 84), (186, 154, 98), (t - 0.45) / 0.55))

# 풀밭/흙 얼룩 — 위로 갈수록 세로 시그마를 줄여 눌린 무늬(원근)
patch_far = pnoise(120, 8, seed + 1); patch_near = pnoise(90, 36, seed + 2)
patch = patch_far * (1 - t) + patch_near * t
grass = np.clip((patch - 0.40) * 5, 0, 1)                           # 1 = 마른 풀밭, 0 = 맨흙
grass_col = lerp((126, 112, 74), (204, 182, 104), t)                # 마른 풀(위는 흐리게)
dirt_col = lerp((96, 80, 74), (150, 112, 76), t)
img = dirt_col * (1 - grass[..., None]) + grass_col * grass[..., None]
img = img * 0.85 + base * 0.15

# 흙길: 가운데쯤을 가로로 흐르는 띠(주기 사인 합)
ph = g.uniform(0, 6.28, 3)
road_y = 0.50 + 0.05 * np.sin(2 * np.pi * xx / W + ph[0]) + 0.025 * np.sin(2 * np.pi * 2 * xx / W + ph[1]) + 0.012 * np.sin(2 * np.pi * 5 * xx / W + ph[2])
road_w = 0.095
d = (t - road_y) / road_w
road = np.exp(-d ** 2 * 1.4)
road_col = np.array((158, 126, 92), np.float32)
road = np.clip(road * 1.5, 0, 1)
img = img * (1 - road[..., None] * 0.95) + road_col * road[..., None] * 0.95
for off in (-0.42, 0.42):                                           # 바퀴 자국 두 줄
    rut = np.exp(-((d - off) / 0.11) ** 2)
    img = img * (1 - rut[..., None] * 0.8) + np.array((78, 58, 46), np.float32) * rut[..., None] * 0.8

img = np.clip(img, 0, 255)
im = Image.fromarray(img.astype(np.uint8), 'RGB')
dr = ImageDraw.Draw(im, 'RGBA')

def put(fn, x, *a):
    """가로 wrap: 경계에 걸친 것은 양쪽에 그린다"""
    for ox in (-W, 0, W): fn(x + ox, *a)

# 자갈 — 아래로 갈수록 크고 많다
def pebble(x, y, r, c): dr.ellipse((x - r * 1.5, y - r * 0.8, x + r * 1.5, y + r * 0.8), fill=c)
for k in range(420):
    ty = g.random() ** 0.6; y = 40 + ty * (H - 50); x = g.uniform(0, W)
    r = 1.5 + 7 * ty * g.uniform(0.5, 1.0); v = int(g.uniform(95, 150))
    put(pebble, x, y + r * 0.5, r, (60, 46, 40, 120)); put(pebble, x, y, r, (v + 10, v, v - 12, 255))

# 풀 다발 — 위는 점, 아래는 부채꼴 획
def tuft(x, y, s, c, c2):
    n = int(5 + s * 0.5)
    for i in range(n):
        a = -np.pi / 2 + (i / (n - 1) - 0.5) * 1.5 + g.uniform(-0.12, 0.12); L = s * g.uniform(0.6, 1.0)
        dr.line((x, y, x + np.cos(a) * L * 0.8, y + np.sin(a) * L), fill=c if i % 2 else c2, width=max(1, int(s / 12)))
for k in range(760):
    ty = g.random() ** 0.55; y = 30 + ty * (H - 36); x = g.uniform(0, W)
    xi, yi = int(x) % W, min(H - 1, int(y))
    if grass[yi, xi] < 0.3 and g.random() < 0.75: continue            # 풀밭 위주로
    if abs((yi / (H - 1) - road_y[0, xi]) / road_w) < 0.9: continue   # 길 위엔 없음
    s = 6 + 46 * ty * g.uniform(0.5, 1.0)
    f = 0.55 + 0.45 * ty
    c = (int(226 * f), int(196 * f), int(112 * f), 255); c2 = (int(150 * f), int(128 * f), int(70 * f), 255)
    put(tuft, x, y, s, c, c2)

a = np.array(im).astype(np.float32)
# 위쪽은 흐리게(먼 곳) — 아래는 선명
blur = gaussian_filter(a, (3, 3, 0), mode=('reflect', 'wrap', 'reflect'))
m = np.clip(1 - t / 0.5, 0, 1)[..., None]
a = blur * m + a * (1 - m)
full = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGB')
full.save(os.path.join(out, 'ginit_full.png'))
wide = np.concatenate([np.array(full), np.array(full)], axis=1)
for k, x0 in enumerate((0, 1214, 2427)):
    Image.fromarray(wide[:, x0:x0 + 1536]).save(os.path.join(out, 'b2f_ginit_w%d.png' % k))
print('init', full.size)
