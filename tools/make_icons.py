# PWA 아이콘 — 대성(castle_3) 을 짙은 나무색 바탕 + 금테 위에 올린다.
#   "C:\pinokio\api\inteliweb-comfyui\app\env\Scripts\python.exe" tools/make_icons.py
# → icons/icon-192.png, icon-512.png, icon-512-maskable.png (안전 영역 80% 안에 그림)
import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'icons')
os.makedirs(OUT, exist_ok=True)
# 160px 납품본을 512 아이콘에 늘리면 물러지므로, 원본에서 400px 로 다시 키잉한 그림이 있으면 그것을 쓴다:
#   python assets/raw/ui/post.py key assets/raw/ui/castle3_s34.png assets/raw/ui/castle3_icon.png --bg=auto --thr=26 --ramp=14 --erode=1 --fit=400,400 --pad=2
_big = os.path.join(ROOT, 'assets', 'raw', 'ui', 'castle3_icon.png')
_src = _big if os.path.exists(_big) else os.path.join(ROOT, 'assets', 'ui', 'castle_3.png')
castle = Image.open(_src).convert('RGBA')
castle = castle.crop(castle.getbbox())


def make(size, maskable):
    im = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    # 바탕: 세로 그라데이션(짙은 옻칠) — maskable 은 모서리까지 꽉 채우고, 일반은 둥근 사각
    bg = Image.new('RGBA', (size, size))
    bd = ImageDraw.Draw(bg)
    for y in range(size):
        t = y / size
        bd.line([(0, y), (size, y)], fill=(int(58 - 28 * t), int(36 - 18 * t), int(20 - 10 * t), 255))
    if maskable:
        im.alpha_composite(bg)
    else:
        mask = Image.new('L', (size, size), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1], radius=size // 5, fill=255)
        im.paste(bg, (0, 0), mask)
        d.rounded_rectangle([size * 0.03, size * 0.03, size * 0.97, size * 0.97], radius=size // 6,
                            outline=(200, 162, 74, 255), width=max(2, size // 40))
    # 성: 안전 영역(가운데 80%) 안에
    box = int(size * (0.62 if maskable else 0.74))
    # thumbnail 은 축소만 하므로(160px 원본이 512 아이콘에서 점이 된다) 배율로 늘리고 줄인다
    s = box / max(castle.width, castle.height)
    c = castle.resize((max(1, round(castle.width * s)), max(1, round(castle.height * s))), Image.LANCZOS)
    im.alpha_composite(c, ((size - c.width) // 2, (size - c.height) // 2 + size // 40))
    return im


make(192, False).save(os.path.join(OUT, 'icon-192.png'))
make(512, False).save(os.path.join(OUT, 'icon-512.png'))
make(512, True).save(os.path.join(OUT, 'icon-512-maskable.png'))
print('icons ->', OUT)
