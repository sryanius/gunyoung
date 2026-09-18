"""후보 시트: python sheet.py <out.png> <cols> <cellh> <png...>  — 각 그림을 cellh 높이로 줄여 격자로(파일명 라벨)."""
import sys, os
from PIL import Image, ImageDraw
out, cols, ch = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]); files = sys.argv[4:]
ims = []
for f in files:
    im = Image.open(f).convert('RGBA'); s = ch / im.height
    ims.append((os.path.basename(f), im.resize((max(1, round(im.width * s)), ch), Image.LANCZOS)))
cw = max(i.width for _, i in ims); rows = (len(ims) + cols - 1) // cols
sh = Image.new('RGB', (cols * cw, rows * (ch + 14)), (70, 70, 70)); d = ImageDraw.Draw(sh)
for n, (name, im) in enumerate(ims):
    x, y = (n % cols) * cw, (n // cols) * (ch + 14)
    sh.paste(im, (x, y), im); d.text((x + 2, y + ch + 1), name[:40], fill=(255, 255, 255))
sh.save(out); print(out, sh.size)
