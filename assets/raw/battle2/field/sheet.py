# -*- coding: utf-8 -*-
"""판정용 시트: python sheet.py out.png [--bg=r,g,b] [--scale=s] [--cols=n] files...  (알파는 배경색 위에 합성)"""
import sys
from PIL import Image
args = [a for a in sys.argv[2:] if not a.startswith('--')]
opt = {a.split('=')[0][2:]: a.split('=')[1] for a in sys.argv[2:] if a.startswith('--')}
bg = tuple(int(v) for v in opt.get('bg', '90,70,52').split(',')); sc = float(opt.get('scale', 1)); cols = int(opt.get('cols', 4))
ims = []
for f in args:
    im = Image.open(f).convert('RGBA')
    if sc != 1: im = im.resize((max(1, round(im.width * sc)), max(1, round(im.height * sc))), Image.LANCZOS)
    ims.append(im)
cw = max(i.width for i in ims) + 8; ch = max(i.height for i in ims) + 8
rows = (len(ims) + cols - 1) // cols
out = Image.new('RGB', (cw * cols, ch * rows), bg)
for k, im in enumerate(ims):
    out.paste(im, ((k % cols) * cw + 4, (k // cols) * ch + 4), im)
out.save(sys.argv[1]); print(sys.argv[1], out.size)
