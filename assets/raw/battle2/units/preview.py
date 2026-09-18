"""마스터 미리보기: python preview.py <out.png> <cellh> <png...> — 어두운 배경과 자홍 배경 두 줄로 얹어 키잉 잔여·구멍을 본다."""
import sys, os
from PIL import Image, ImageDraw
out, ch = sys.argv[1], int(sys.argv[2]); fs = sys.argv[3:]
ims = []
for f in fs:
    im = Image.open(f).convert('RGBA'); s = ch / im.height
    ims.append(im.resize((max(1, round(im.width * s)), ch), Image.LANCZOS))
W = sum(i.width + 10 for i in ims)
sh = Image.new('RGB', (W, ch * 2 + 8), (30, 30, 34)); d = ImageDraw.Draw(sh)
d.rectangle([0, ch + 8, W, ch * 2 + 8], fill=(255, 0, 255))
x = 0
for im in ims:
    sh.paste(im, (x, 0), im); sh.paste(im, (x, ch + 8), im); x += im.width + 10
sh.save(out); print(out, sh.size)
