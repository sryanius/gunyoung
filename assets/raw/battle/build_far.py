# -*- coding: utf-8 -*-
"""far.png 조립: 수묵 산 그림(1536x640, 흰 배경) 여러 장을 축소해 좌우로 잇고(96px 페더) 루프 블렌드 → 2048x360 RGBA.
밝기 → 알파(흰 여백 투명), 위쪽 세로 페이드, 선택 --tint 로 노을빛 실루엣.
usage: python build_far.py out.png src1.png[:flip] src2.png[:flip] ... [--scale=0.56] [--y0=0] [--lo=0.5] [--hi=0.93] [--fade=16] [--tint=r0,g0,b0,r1,g1,b1]"""
import sys, numpy as np
from PIL import Image
sys.path.insert(0, '.'); from post import arg, has, ints, loop_blend
out = sys.argv[1]; srcs = [a for a in sys.argv[2:] if not a.startswith('--')]
sc = float(arg('scale', 0.56)); y0 = int(arg('y0', 0)); fe = 96; W = 2048 + fe
def band(spec):
    f, flip = (spec.split(':') + [''])[:2]
    im = Image.open(f).convert('RGB')
    if flip: im = im.transpose(Image.FLIP_LEFT_RIGHT)
    im = im.resize((int(im.width * sc), int(im.height * sc)), Image.LANCZOS)
    if im.height < y0 + 360:  # 밴드보다 낮으면 위를 흰색으로 채움(투명이 된다)
        pad = Image.new('RGB', (im.width, y0 + 360), (255, 255, 255)); pad.paste(im, (0, y0 + 360 - im.height)); im = pad
    return np.array(im.crop((0, y0, im.width, y0 + 360))).astype(np.float32)
bands = [band(s) for s in srcs]
canvas = np.zeros((360, W, 3), np.float32); x = 0
t = np.linspace(0, 1, fe, np.float32)[None, :, None]
for i, b in enumerate(bands):
    bw = b.shape[1]
    if i == 0: canvas[:, :bw] = b; x = bw
    else:
        s0 = x - fe                                   # 겹침 시작
        n = min(bw, W - s0)
        seg = canvas[:, s0:s0 + n]
        blend = seg[:, :fe] * (1 - t[:, :min(fe, n)]) + b[:, :min(fe, n)] * t[:, :min(fe, n)]
        canvas[:, s0:s0 + min(fe, n)] = blend
        if n > fe: canvas[:, s0 + fe:s0 + n] = b[:, fe:n]
        x = s0 + n
    if x >= W: break
if x < W: raise SystemExit('원본이 모자란다: %d < %d' % (x, W))
rgb = loop_blend(canvas, fe)
L = (rgb @ np.array([0.299, 0.587, 0.114], np.float32)) / 255
lo = float(arg('lo', 0.5)); hi = float(arg('hi', 0.93))
al = np.clip((hi - L) / (hi - lo), 0, 1)
fade = int(arg('fade', 16))
al *= np.clip(np.arange(360, dtype=np.float32) / max(fade, 1), 0, 1)[:, None]
tint = arg('tint')
if tint:
    tt = np.array(ints(tint), np.float32); Lc = L[..., None]
    rgb = tt[:3] * (1 - Lc) + tt[3:] * Lc
o = np.dstack([rgb.clip(0, 255).astype(np.uint8), (al * 255).astype(np.uint8)])
Image.fromarray(o, 'RGBA').save(out); print(out, o.shape, 'alpha mean %.2f' % al.mean(), 'used px', x)
