# -*- coding: utf-8 -*-
"""배치 목업 — BattleScene.buildBackground/PROPS(2차) 의 배치를 그대로 흉내: gTop=360, far 밑변 390, 하늘색 안개 띠 332~360,
mid 밑변 380(땅 뒤), ground y360, shade 360~720(0.35→0), fog 뒤 y368 α0.55 / 앞 y650 ×1.5 α0.13, 소품 origin 0.94(깃발 0.98). 줌 1.15 컷 3장.
usage: python mock3.py out.png [fielddir]"""
import sys, os
import numpy as np
from PIL import Image
B = 'C:/claude/gunyoung/assets/battle/'; fd = sys.argv[2] if len(sys.argv) > 2 else B + 'field'
out = sys.argv[1]; W = 3200
def tile(im, w, x0=0):
    o = Image.new('RGBA', (w, im.height)); x = x0
    while x < w: o.alpha_composite(im, (x, 0)) if x >= 0 else o.alpha_composite(im.crop((-x, 0, im.width, im.height)), (0, 0)); x += im.width
    return o
def withalpha(im, k): im = im.copy(); im.putalpha(im.split()[3].point(lambda v: int(v * k))); return im
cv = Image.new('RGBA', (W, 720), (0, 0, 0, 255))
sky = Image.open(B + 'sky.png').convert('RGBA').resize((int(2048 * 1.6), 720)); cv.alpha_composite(sky.crop((0, 0, W, 720)), (0, 0))
far = Image.open(B + 'far.png').convert('RGBA'); cv.alpha_composite(tile(far, W), (0, 390 - 360))
hz = np.zeros((28, W, 4), np.uint8); hz[..., :3] = (237, 225, 208); hz[..., 3] = (np.linspace(0, 0.9, 28) * 255).astype(np.uint8)[:, None]
cv.alpha_composite(Image.fromarray(hz, 'RGBA'), (0, 332))
cv.alpha_composite(tile(Image.open(fd + '/mid.png').convert('RGBA'), W, -700), (0, 380 - 260))
cv.alpha_composite(tile(Image.open(fd + '/ground.png').convert('RGBA'), W), (0, 360))
sh = np.zeros((360, W, 4), np.uint8); sh[..., :3] = (14, 10, 24)
t = np.linspace(0, 1, 360)[:, None]; a = np.where(t < 0.45, 0.35 + (0.12 - 0.35) * t / 0.45, 0.12 * (1 - (t - 0.45) / 0.55))
if '--ramp' in sys.argv: a = a * np.clip(t / 0.12, 0, 1)
sh[..., 3] = (a * 255).astype(np.uint8)
cv.alpha_composite(Image.fromarray(sh, 'RGBA'), (0, 360))
fog = Image.open(fd + '/fog.png').convert('RGBA')
cv.alpha_composite(withalpha(tile(fog, W, -300), 0.55), (0, 368 - 80))
def put(path, x, y, scale=1.0, flip=False, tint=None, oy=1.0):
    if not os.path.exists(path): return
    im = Image.open(path).convert('RGBA')
    if flip: im = im.transpose(Image.FLIP_LEFT_RIGHT)
    if scale != 1: im = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)
    if tint:
        a = np.array(im).astype(np.float32); a[..., :3] *= np.array(tint, np.float32) / 255 * 1.25; im = Image.fromarray(a.clip(0, 255).astype(np.uint8), 'RGBA')
    cv.alpha_composite(im, (max(0, int(x - im.width / 2)), int(y - im.height * oy)))
PROPS = [('tent', 150, 410, 0.9, 0), ('tent', 340, 404, 0.72, 1), ('palisade', 500, 414, 0.8, 0), ('palisade', 140, 416, 0.8, 1), ('banner_g', 250, 446, 0.8, 0), ('banner_g', 410, 668, 0.9, 0),
         ('tent', 3050, 410, 0.9, 1), ('tent', 2860, 404, 0.72, 0), ('palisade', 2700, 414, 0.8, 1), ('palisade', 3060, 416, 0.8, 0), ('banner_b', 2950, 446, 0.8, 1), ('banner_b', 2790, 668, 0.9, 1),
         ('tree_dead', 1180, 408, 0.85, 0), ('tree_dead', 2080, 412, 0.75, 1), ('rock1', 1580, 414, 0.5, 0), ('rock2', 880, 410, 0.45, 0), ('rock2', 2380, 412, 0.4, 1)]
for k, x, y, s, f in sorted(PROPS, key=lambda p: p[2]):
    if y <= 420: put(fd + '/%s.png' % k, x, y, s, f, None, 0.98 if k.startswith('banner') else 0.94)
for k, x, y, px in (('blood1', 1300, 560, 46), ('blood2', 1360, 610, 46), ('blood1', 1250, 640, 46), ('crater', 1420, 520, 90)):
    put(fd + '/%s.png' % k, x, y + 10, px / 128, False, None, 0.5)
rng = np.random.default_rng(3); us = []
for k in range(60): us.append((1000 + rng.uniform(0, 300), 420 + rng.uniform(0, 260), ['inf', 'spear'][k % 2], False, (58, 166, 85)))
for k in range(60): us.append((1340 + rng.uniform(0, 300), 420 + rng.uniform(0, 260), ['cav', 'bow'][k % 2], True, (59, 111, 214)))
items = [(y, 'u', x, kind, fl, tn) for x, y, kind, fl, tn in us] + [(y, 'p', x, k, f, s) for k, x, y, s, f in PROPS if y > 420]
for it in sorted(items, key=lambda i: i[0]):
    if it[1] == 'u': put(B + 'units/%s.png' % it[3], it[2], it[0], 0.4, it[4], it[5], 0.98)
    else: put(fd + '/%s.png' % it[3], it[2], it[0], it[5], it[4], None, 0.98)
for x, y in ((1040, 500), (1150, 600), (1220, 440)): put(fd + '/flag_g.png', x + 4, y - 30, 0.62)
for k, x, y, s, f in (('rock2', 1390, 718, 0.5, 0), ('rock1', 2240, 719, 0.5, 1)): put(fd + '/%s.png' % k, x, y, s, f, None, 0.94)
f2 = withalpha(tile(fog, W, -500).resize((W, 240)), 0.13); cv.alpha_composite(f2, (0, 650 - 120))
vw, vh = int(1280 / 1.15), int(720 / 1.15); o = Image.new('RGB', (1280, 720 * 3 + 16), (0, 0, 0))
for i, x0 in enumerate((0, 960, 3200 - vw)):
    o.paste(cv.crop((x0, 720 - vh, x0 + vw, 720)).resize((1280, 720), Image.LANCZOS).convert('RGB'), (0, i * 728))
o.save(out); print(out)
