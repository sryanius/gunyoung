# -*- coding: utf-8 -*-
"""확인용 시트: 64px 아이콘 11개를 한 줄로(짙은 배경) + 같은 것을 3배 확대(밝은 배경) 로 이어 붙인다.
실행: python make_sheet.py <아이콘폴더> <출력png> [name1,name2,...]
"""
import os, sys
from PIL import Image
NAMES = ['gold', 'food', 'troops', 'officer', 'calendar', 'cmd_domestic', 'cmd_military',
         'cmd_personnel', 'cmd_scheme', 'cmd_diplomacy', 'cmd_march']
src, out = sys.argv[1], sys.argv[2]
names = sys.argv[3].split(',') if len(sys.argv) > 3 else NAMES
PAD, Z = 8, 3
w1 = len(names) * (64 + PAD) + PAD
w2 = len(names) * (64 * Z + PAD) + PAD
W = max(w1, w2)
sheet = Image.new('RGBA', (W, PAD + 64 + PAD + 64 * Z + PAD), (36, 30, 26, 255))
# 아래 줄(확대)은 밝은 배경 — 가장자리 번짐 검사용
sheet.paste((214, 204, 184, 255), (0, PAD + 64 + PAD, W, sheet.height))
x = PAD
for n in names:
    p = os.path.join(src, n + '.png')
    if not os.path.exists(p): x += 64 + PAD; continue
    ic = Image.open(p).convert('RGBA')
    sheet.alpha_composite(ic, (x, PAD))
    x += 64 + PAD
x = PAD
for n in names:
    p = os.path.join(src, n + '.png')
    if not os.path.exists(p): x += 64 * Z + PAD; continue
    ic = Image.open(p).convert('RGBA').resize((64 * Z, 64 * Z), Image.NEAREST)
    sheet.alpha_composite(ic, (x, PAD + 64 + PAD))
    x += 64 * Z + PAD
sheet.save(out)
print(out, sheet.size)
