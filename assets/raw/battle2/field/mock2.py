# -*- coding: utf-8 -*-
"""배치 목업(브라우저 대체): sky + far + mid(아래 변 y=440) + ground(y 360~720) + fog + 소품·깃발·데칼·병사(1차 그림 tint) → 1280×720 두 컷
usage: python mock2.py out.png ground.png mid.png [fielddir]"""
import sys, os
import numpy as np
from PIL import Image
B = 'C:/claude/gunyoung/assets/battle/'
out, gfile, mfile = sys.argv[1:4]; fd = sys.argv[4] if len(sys.argv) > 4 else None
W = 3200
def tile(im, w):
    o = Image.new('RGBA', (w, im.height)); x = 0
    while x < w: o.paste(im, (x, 0)); x += im.width
    return o
cv = Image.new('RGBA', (W, 720), (0, 0, 0, 255))
sky = Image.open(B + 'sky.png').convert('RGBA'); cv.alpha_composite(tile(sky, W), (0, 0))
far = Image.open(B + 'far.png').convert('RGBA'); f = tile(far, W); f.putalpha(f.split()[3].point(lambda v: int(v * 0.8))); cv.alpha_composite(f, (0, 400 - 360 + 30))
m = Image.open(mfile).convert('RGBA'); cv.alpha_composite(tile(m, W), (0, 410 - 260))   # mid(깊이 2)는 땅(3) 뒤 — 아래 변 y=410
g = Image.open(gfile).convert('RGBA'); cv.alpha_composite(tile(g, W), (0, 360))
# 땅 원근 그라데이션(코드의 battle_shade): 위 0.35 → 0
sh = np.zeros((320, W, 4), np.uint8); sh[..., :3] = (14, 10, 24)
t = np.linspace(0, 1, 320)[:, None]; a = np.where(t < 0.45, 0.35 + (0.12 - 0.35) * t / 0.45, 0.12 * (1 - (t - 0.45) / 0.55)); sh[..., 3] = (a * 255).astype(np.uint8)
cv.alpha_composite(Image.fromarray(sh, 'RGBA'), (0, 400))
def put(path, x, y, scale=1.0, flip=False, tint=None, alpha=1.0):
    if not os.path.exists(path): return
    im = Image.open(path).convert('RGBA')
    if flip: im = im.transpose(Image.FLIP_LEFT_RIGHT)
    if scale != 1: im = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)
    if tint:
        a = np.array(im).astype(np.float32); a[..., :3] *= np.array(tint, np.float32) / 255 * 1.25; im = Image.fromarray(a.clip(0, 255).astype(np.uint8), 'RGBA')
    if alpha != 1: im.putalpha(im.split()[3].point(lambda v: int(v * alpha)))
    cv.alpha_composite(im, (int(x - im.width / 2), int(y - im.height)))
if fd:
    put(fd + '/tent.png', 150, 470, 0.8); put(fd + '/tent.png', 330, 560, 1.0); put(fd + '/palisade.png', 520, 640, 0.9); put(fd + '/palisade.png', 470, 480, 0.7)
    put(fd + '/banner_g.png', 420, 520, 1.0); put(fd + '/banner_g.png', 600, 650, 1.0)
    put(fd + '/tree_dead.png', 900, 450, 0.8); put(fd + '/rock1.png', 1100, 600, 0.6); put(fd + '/rock2.png', 1500, 470, 0.5)
    put(fd + '/blood1.png', 1250, 600, 0.6); put(fd + '/blood2.png', 1350, 540, 0.5); put(fd + '/crater.png', 1180, 520, 0.7)
    put(fd + '/tent.png', 3050, 470, 0.8, True); put(fd + '/palisade.png', 2700, 640, 0.9, True); put(fd + '/banner_b.png', 2800, 520); put(fd + '/rock2.png', 2300, 640, 0.7); put(fd + '/tree_dead.png', 2450, 440, 0.7, True)
rng = np.random.default_rng(3)
for k in range(60):
    x = 1000 + rng.uniform(0, 300); y = 430 + rng.uniform(0, 250)
    put(B + 'units/%s.png' % ['inf', 'spear'][k % 2], x, y, 0.42, False, (58, 166, 85))
for k in range(60):
    x = 1340 + rng.uniform(0, 300); y = 430 + rng.uniform(0, 250)
    put(B + 'units/%s.png' % ['cav', 'bow'][k % 2], x, y, 0.42, True, (59, 111, 214))
if fd:
    for x, y in ((1040, 500), (1150, 600), (1220, 440)): put(fd + '/flag_g.png', x, y - 30, 0.8)
    fog = Image.open(fd + '/fog.png').convert('RGBA') if os.path.exists(fd + '/fog.png') else None
    if fog:
        f1 = tile(fog, W); cv.alpha_composite(f1, (0, 400 - 80))
        f2 = tile(fog, W); f2.putalpha(f2.split()[3].point(lambda v: int(v * 0.35))); cv.alpha_composite(f2, (300, 650 - 80))
a = cv.crop((0, 0, 1280, 720)); b = cv.crop((900, 0, 2180, 720)); c = cv.crop((1920, 0, 3200, 720))
o = Image.new('RGB', (1280, 720 * 3 + 16), (0, 0, 0)); o.paste(a.convert('RGB'), (0, 0)); o.paste(b.convert('RGB'), (0, 728)); o.paste(c.convert('RGB'), (0, 1456)); o.save(out); print(out)
