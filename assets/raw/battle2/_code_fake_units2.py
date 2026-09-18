# -*- coding: utf-8 -*-
"""배율 점검용 가짜 units2 — 1차 그림(units/*.png)에 편 색을 곱해 128×160, 몸 높이 130(기병 150·무장 145), 발끝 y152 로 앉힌다.
출력은 assets/raw/battle2/_code_fake_units2/ (진짜 units2 폴더는 건드리지 않는다). _code_mock.py 가 U2DIR 환경변수로 읽는다."""
import os
from PIL import Image
import numpy as np
ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
src = os.path.join(ROOT, 'assets', 'battle', 'units'); out = os.path.join(os.path.dirname(__file__), '_code_fake_units2')
os.makedirs(out, exist_ok=True)
TINT = {'g': (0x5a, 0xc6, 0x75), 'b': (0x5b, 0x8f, 0xf6)}
def fit(im, body_h):
    a = np.array(im)[..., 3]; ys, xs = np.where(a > 8)
    im = im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    s = body_h / im.height; im = im.resize((max(1, round(im.width * s)), body_h), Image.LANCZOS)
    if im.width > 128: im = im.resize((128, round(im.height * 128 / im.width)), Image.LANCZOS)
    c = Image.new('RGBA', (128, 160), (0, 0, 0, 0)); c.alpha_composite(im, ((128 - im.width) // 2, 152 - im.height)); return c
def tint(im, col):
    a = np.array(im).astype(float); a[..., :3] *= np.array(col) / 255; return Image.fromarray(a.clip(0, 255).astype('uint8'), 'RGBA')
for k, h in (('inf', 130), ('spear', 130), ('bow', 130), ('cav', 150)):
    im = Image.open(os.path.join(src, k + '.png')).convert('RGBA')
    for sd in 'gb':
        t = fit(tint(im, TINT[sd]), h)
        t.save(os.path.join(out, '%s_%s_stand.png' % (k, sd))); t.rotate(-12, center=(64, 152)).save(os.path.join(out, '%s_%s_attack.png' % (k, sd)))
for key, side, sd in (('guanyu', 'left', 'g'), ('zhangfei', 'left', 'g'), ('xiahoudun', 'right', 'b'), ('dianwei', 'right', 'b')):
    im = Image.open(os.path.join(src, 'general_%s.png' % side)).convert('RGBA')
    t = fit(tint(im, TINT[sd]), 145); t.save(os.path.join(out, 'gen_%s_stand.png' % key)); t.save(os.path.join(out, 'gen_%s_attack.png' % key))
print('ok', out)
