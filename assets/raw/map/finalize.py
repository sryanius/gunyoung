# 하이레즈 PNG → Lanczos 2000x1560 → JPG q90, 그리고 도시 46점 확인용 그림
import sys, re
from PIL import Image, ImageDraw
src, out_jpg, out_chk = sys.argv[1], sys.argv[2], sys.argv[3]
im = Image.open(src).convert('RGB').resize((2000, 1560), Image.LANCZOS)
im.save(out_jpg, 'JPEG', quality=90, subsampling=0)
js = open(r'C:\claude\gunyoung\src\data\cities.js', encoding='utf-8').read()
CITIES = [(int(m[0]), m[1], int(m[2]), int(m[3])) for m in re.findall(r"id:\s*(\d+),\s*name:\s*'([^']+)'.*?x:\s*(\d+),\s*y:\s*(\d+)", js)]
assert len(CITIES) == 46
chk = im.copy(); d = ImageDraw.Draw(chk)
sea = []
for cid, name, x, y in CITIES:
    px, py = x * 2, y * 2
    r, g, b = im.getpixel((px, py))
    is_sea = b > r + 20 and b > 90
    if is_sea: sea.append((cid, name))
    col = (255, 0, 0) if not is_sea else (255, 255, 0)
    d.ellipse([px - 9, py - 9, px + 9, py + 9], fill=col, outline=(0, 0, 0), width=2)
    d.text((px + 12, py - 8), str(cid), fill=(0, 0, 0))
chk.resize((1000, 780), Image.LANCZOS).save(out_chk)
print('saved', out_jpg, Image.open(out_jpg).size, 'sea-ish cities:', sea)
