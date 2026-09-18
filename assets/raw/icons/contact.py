# -*- coding: utf-8 -*-
"""SDXL 후보 콘택트 시트: 폴더 안 PNG 를 이름순으로 썸네일(T px) 격자로. python contact.py <폴더> <출력> [열수] [T]"""
import os, sys
from PIL import Image, ImageDraw
src, out = sys.argv[1], sys.argv[2]
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 6
T = int(sys.argv[4]) if len(sys.argv) > 4 else 220
files = sorted(f for f in os.listdir(src) if f.endswith('.png') and not f.startswith('sheet'))
rows = (len(files) + cols - 1) // cols
sheet = Image.new('RGB', (cols * (T + 6) + 6, rows * (T + 22) + 6), (30, 30, 30))
d = ImageDraw.Draw(sheet)
for i, f in enumerate(files):
    im = Image.open(os.path.join(src, f)).convert('RGB')
    im.thumbnail((T, T), Image.LANCZOS)
    x, y = 6 + (i % cols) * (T + 6), 6 + (i // cols) * (T + 22)
    sheet.paste(im, (x, y))
    d.text((x + 2, y + T + 4), f[:-4], fill=(220, 220, 220))
sheet.save(out); print(out, sheet.size, len(files))
