# -*- coding: utf-8 -*-
"""후보 시트. python sheet.py <out.png> <cols> <cell_w> <png...>  — 각 그림을 cell_w 폭으로 줄여 격자에, 왼쪽 위에 파일명."""
import sys, os
from PIL import Image, ImageDraw
out, cols, cw = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]); files = sys.argv[4:]
ims = []
for f in files:
    im = Image.open(f); 
    if im.mode == 'RGBA':
        bg = Image.new('RGBA', im.size, (40, 40, 48, 255)); bg.alpha_composite(im); im = bg
    im = im.convert('RGB'); h = int(im.height * cw / im.width); ims.append((os.path.basename(f), im.resize((cw, h), Image.LANCZOS)))
ch = max(i.height for _, i in ims); rows = (len(ims) + cols - 1) // cols
sh = Image.new('RGB', (cols * cw, rows * ch), (20, 20, 20)); d = ImageDraw.Draw(sh)
for k, (n, im) in enumerate(ims):
    x, y = (k % cols) * cw, (k // cols) * ch; sh.paste(im, (x, y)); d.rectangle((x, y, x + 8 * len(n) + 6, y + 14), fill=(0, 0, 0)); d.text((x + 3, y + 1), n, fill=(255, 255, 0))
sh.save(out); print(out, sh.size)
