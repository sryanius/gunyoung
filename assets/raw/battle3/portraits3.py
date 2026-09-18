# -*- coding: utf-8 -*-
"""HUD 초상 96×120 (여성 무장) — assets/raw/battle2/field/hud_build.py 의 portraits() 와 같은 식:
   페이드 전 컷인(k/<key>_key.png, 1248×1824)에서 두 눈 가운데(ex,ey) 기준 폭 cw 를 잘라 96×120, 눈이 위 1/3(y=40), 어두운 편 색 그라데이션 위에 합성(RGB 불투명).
   python portraits3.py [outdir=assets/battle/hud]"""
import sys, os, numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'assets', 'battle', 'hud')
PORTRAITS = {  # key: (ex, ey, 자를 폭 ≈ 눈 사이 거리×3.2, 편, 얼굴 감마)
    'guanyu': (611, 660, 445, 'g', 0.80), 'zhangfei': (566, 549, 400, 'g', 1.0),
    'xiahoudun': (536, 454, 440, 'b', 1.0), 'dianwei': (653, 388, 345, 'b', 0.90),
}
def premul_resize(rgba, size):
    a = rgba.astype(np.float32); a[..., :3] *= a[..., 3:4] / 255
    sm = np.array(Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA').resize(size, Image.LANCZOS)).astype(np.float32)
    al = np.clip(sm[..., 3:4], 1, 255); sm[..., :3] = np.clip(sm[..., :3] / (al / 255), 0, 255); sm[sm[..., 3] < 2] = 0
    return sm.astype(np.uint8)
for key, (ex, ey, cw, side, gamma) in PORTRAITS.items():
    im = Image.open(os.path.join(HERE, 'k', key + '_key.png')).convert('RGBA')
    if gamma != 1.0:
        ga = np.array(im).astype(np.float32); ga[..., :3] = 255 * (ga[..., :3] / 255) ** gamma; im = Image.fromarray(ga.astype(np.uint8), 'RGBA')
    ch = cw * 120 / 96; box = (ex - cw / 2, ey - ch / 3, ex + cw / 2, ey + ch * 2 / 3)
    big = Image.new('RGBA', (int(cw), int(ch)), (0, 0, 0, 0))
    big.alpha_composite(im.crop(tuple(int(round(v)) for v in (max(0, box[0]), max(0, box[1]), min(im.width, box[2]), min(im.height, box[3])))),
                        (int(round(max(0, -box[0]))), int(round(max(0, -box[1])))))
    face = Image.fromarray(premul_resize(np.array(big), (96, 120)), 'RGBA')
    y, x = np.mgrid[0:120, 0:96].astype(np.float32)
    top, bot = ((44, 62, 46), (16, 24, 18)) if side == 'g' else ((44, 54, 84), (14, 18, 34))
    t = (y / 119)[..., None]; bg = np.array(top, np.float32) * (1 - t) + np.array(bot, np.float32) * t
    glow = np.exp(-(((x - 48) / 46) ** 2 + ((y - 46) / 50) ** 2))[..., None]; bg = bg * (0.75 + 0.7 * glow)
    base = Image.fromarray(np.dstack([np.clip(bg, 0, 255), np.full((120, 96), 255)]).astype(np.uint8), 'RGBA'); base.alpha_composite(face)
    a = np.array(base).astype(np.float32)
    vig = 1 - 0.30 * np.clip((np.maximum(np.abs(x - 47.5) / 48, np.abs(y - 59.5) / 60) - 0.72) / 0.28, 0, 1) ** 1.5
    a[..., :3] *= vig[..., None]
    p = os.path.join(out, 'portrait_%s.png' % key); Image.fromarray(a.astype(np.uint8), 'RGBA').convert('RGB').save(p)
    print(p, '가운데 상자 밝기 %.0f' % a[30:80, 24:72, :3].mean())
