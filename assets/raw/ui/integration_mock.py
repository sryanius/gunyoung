# 통합 확인용 — 코드(MapScene/UIScene)와 같은 수치로 HUD·커맨드 바·패널·성 배치를 Pillow 로 합성한다.
# 브라우저를 못 쓰는 환경에서 겹침·비율을 눈으로 보기 위한 근사(폰트·9-slice 는 근사).
#   "C:\pinokio\api\inteliweb-comfyui\app\env\Scripts\python.exe" assets/raw/ui/integration_mock.py
# 출력: assets/raw/ui/integration_mock_screen.png / _map_z1.png / _map_zmin.png
import os, re
from PIL import Image, ImageDraw, ImageFont

root = r"C:\claude\gunyoung\assets"
out = r"C:\claude\gunyoung\assets\raw\ui"


def load(n, scale=1.0):
    im = Image.open(os.path.join(root, n)).convert("RGBA")
    if scale != 1.0:
        im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    return im


def font(px, brush=False):
    cands = [r"C:\Windows\Fonts\HMKMRHD.TTF", r"C:\Windows\Fonts\batang.ttc"] if brush else [r"C:\Windows\Fonts\batang.ttc", r"C:\Windows\Fonts\malgun.ttf"]
    for c in cands:
        try:
            return ImageFont.truetype(c, px)
        except Exception:
            pass
    return ImageFont.truetype(r"C:\Windows\Fonts\malgun.ttf", px)


def tint(im, rgb):
    a = im.split()[3]
    base = Image.new("RGBA", im.size, rgb + (255,))
    base.putalpha(a)
    return base


def paste_c(canvas, im, cx, cy, ox=0.5, oy=0.5):
    canvas.alpha_composite(im, (round(cx - im.width * ox), round(cy - im.height * oy)))


def text(d, x, y, s, f, fill, ox=0, oy=0.5, stroke=0, sfill=(0, 0, 0)):
    bb = d.textbbox((0, 0), s, font=f, stroke_width=stroke)
    w, h = bb[2] - bb[0], bb[3] - bb[1]
    d.text((x - w * ox - bb[0], y - h * oy - bb[1]), s, font=f, fill=fill, stroke_width=stroke, stroke_fill=sfill)
    return w


def nine(im, w, h, c):
    W, H = im.size
    o = Image.new("RGBA", (w, h))
    xs = [0, c, W - c, W]; ys = [0, c, H - c, H]; dx = [0, c, w - c, w]; dy = [0, c, h - c, h]
    for i in range(3):
        for j in range(3):
            p = im.crop((xs[i], ys[j], xs[i + 1], ys[j + 1]))
            o.alpha_composite(p.resize((dx[i + 1] - dx[i], dy[j + 1] - dy[j]), Image.LANCZOS), (dx[i], dy[j]))
    return o


# 도시 데이터
cities = {}
src = open(r"C:\claude\gunyoung\src\data\cities.js", encoding="utf8").read()
pat = re.compile(r"id:\s*(\d+),\s*name:\s*'([^']+)',.*?x:\s*(\d+),\s*y:\s*(\d+),\s*size:\s*(\d)")
for m in pat.finditer(src):
    cities[int(m.group(1))] = (m.group(2), int(m.group(3)), int(m.group(4)), int(m.group(5)))

CASTLE = {1: ("ui/castle_1.png", 0.55, 0.42), 2: ("ui/castle_2.png", 0.52, 0.46), 3: ("ui/castle_3.png", 0.70, 0.52)}
FCOL = {"wei": (0x3b, 0x6f, 0xd6), "shu": (0x3a, 0xa6, 0x55), "wu": (0xd9, 0x46, 0x3b), "yuan": (0x8e, 0x5b, 0xd6),
        "ma": (0xd6, 0xa2, 0x3b), "liu": (0x3b, 0xb8, 0xc4), "gongsun": (0xe0, 0xe0, 0xe0)}
FC = {"wei": [8, 9, 10, 11, 12, 13, 14, 15, 18], "shu": [24, 25, 26, 27, 28, 31], "wu": [16, 17, 36, 40, 41, 42, 43],
      "yuan": [2, 3, 4, 5, 6, 7], "ma": [19, 20, 21, 22, 23], "liu": [32, 33, 34, 35, 37, 38, 39], "gongsun": [0, 1]}
fac = {}
for k, ids in FC.items():
    for i in ids:
        fac[i] = FCOL[k]


def draw_city(canvas, id_, sx, sy, zoom):
    name, x, y, size = cities[id_]
    k = 1 if size <= 2 else (2 if size == 3 else 3)
    path, sc, fs = CASTLE[k]
    c = load(path, sc * zoom)
    dw, dh = c.width, c.height
    top = -dh * 0.88; bottom = dh * 0.12
    paste_c(canvas, c, sx, sy, 0.5, 0.88)
    col = fac.get(id_, (0x77, 0x77, 0x77))
    fl = tint(load("ui/flag.png", fs * zoom), col)
    fx, fy = round(dw * 0.30), round(top * 0.68)
    paste_c(canvas, fl, sx + fx, sy + fy, 0.31, 0.98)
    dd = ImageDraw.Draw(canvas)
    f = font(round(24 * max(1, min(1.7, 0.75 / zoom)) * zoom))
    text(dd, sx, sy + round(bottom) + 3, name, f, (253, 243, 220), 0.5, 0, stroke=max(1, round(2.5 * zoom)), sfill=col)


mp = Image.open(os.path.join(root, "map/map.jpg")).convert("RGBA")

# ---------- 화면 1280×720 — 줌 0.9, 낙양이 (440,380) ----------
z = 0.9
cx, cy = 543 * 2, 346 * 2
ox, oy = cx - 440 / z, cy - 380 / z
scr = mp.crop((round(ox), round(oy), round(ox + 1280 / z), round(oy + 720 / z))).resize((1280, 720), Image.LANCZOS)
for id_, v in sorted(cities.items(), key=lambda kv: kv[1][2]):
    name, x, y, size = v
    sx = (x * 2 - ox) * z; sy = (y * 2 - oy) * z
    if -60 <= sx <= 1340 and -60 <= sy <= 780:
        draw_city(scr, id_, sx, sy, z)

# HUD
scr.alpha_composite(load("ui/hud_bar.png"), (0, 0))
HY = 36
paste_c(scr, load("icons/calendar.png", 28 / 64), 118, HY)
d = ImageDraw.Draw(scr)
text(d, 140, HY, "건안 5년 3월", font(36, True), (246, 233, 201), 0, 0.5, 2, (42, 26, 12))
x = 350
for ic, lab, val in [("gold", "금", "4,820"), ("food", "군량", "61,300"), ("troops", "병력", "38,000"), ("officer", "무장", "27")]:
    paste_c(scr, load(f"icons/{ic}.png", 28 / 64), x, HY)
    d = ImageDraw.Draw(scr)
    lw = text(d, x + 20, HY + 1, lab, font(20), (205, 185, 142))
    text(d, x + 20 + lw + 6, HY, val, font(26), (247, 233, 201), 0, 0.5, 2, (42, 26, 12))
    x += 172
paste_c(scr, tint(load("ui/flag.png").resize((26, 39), Image.LANCZOS), FCOL["shu"]), 1050, HY)
d = ImageDraw.Draw(scr)
text(d, 1070, HY, "유비군", font(32, True), (246, 233, 201), 0, 0.5, 2, (42, 26, 12))

# 커맨드 바
bw, bh, gap = 124, 64, 8
total = 6 * bw + 5 * gap; barW = total + 36; barH = 100
barCx = 1280 - 16 - barW / 2; by = 720 - 8 - barH / 2
paste_c(scr, nine(load("ui/panel.png"), barW, barH, 48), barCx, by)
x0 = barCx - total / 2 + bw / 2
btn = nine(load("ui/button.png"), bw, bh, 28)
for i, (k, lab) in enumerate([("cmd_domestic", "내정"), ("cmd_military", "군사"), ("cmd_personnel", "인사"), ("cmd_scheme", "계략"), ("cmd_diplomacy", "외교"), ("cmd_march", "출진")]):
    bx = x0 + i * (bw + gap)
    paste_c(scr, btn, bx, by)
    paste_c(scr, load(f"icons/{k}.png", 32 / 64), bx - 30, by)
    d = ImageDraw.Draw(scr)
    text(d, bx - 8, by, lab, font(24), (247, 233, 201), 0, 0.5, 2, (42, 26, 12))

# 패널 (980,350) + 뒤 어둡게
scr.alpha_composite(Image.new("RGBA", (1280, 720), (0, 0, 0, int(0.45 * 255))))
PX, PY = 980, 350
WEI = FCOL["wei"]
paste_c(scr, nine(load("ui/panel.png"), 520, 500, 48), PX, PY)
paste_c(scr, load("ui/banner.png", 0.82), PX, PY - 222)
d = ImageDraw.Draw(scr)
d.rectangle((PX - 190, PY - 158 - 1, PX + 190, PY - 158 + 1), fill=WEI + (242,))
text(d, PX - 6, PY - 222 - 2, "낙양", font(48, True), (255, 243, 214), 1, 0.5, 3, (90, 26, 18))
text(d, PX + 8, PY - 222 + 1, "洛陽", font(28), (255, 230, 168), 0, 0.5, 2, (90, 26, 18))
paste_c(scr, nine(load("ui/parchment.png"), 440, 360, 24), PX, PY + 34)
paste_c(scr, load("ui/portrait_placeholder.png", 1.1), PX - 150, PY - 40)
d = ImageDraw.Draw(scr)
d.rectangle((PX - 150 - 54, PY - 40 - 67, PX - 150 + 54, PY - 40 + 67), outline=WEI, width=3)
text(d, PX - 150, PY + 46, "조조", font(24), (42, 26, 12), 0.5, 0.5)
text(d, PX - 150, PY + 74, "태수", font(20), (122, 90, 52), 0.5, 0.5)
y0, dy, lx, vx = -112, 42, -40, 205
rows = [("세력", "위 (조조)"), ("태수", "조조"), ("인구", "412,300 명"), ("병력", "52,100 명"), ("금", "1,980 금"), ("군량", "24,600 석")]
for i, (lab, val) in enumerate(rows):
    yy = PY + y0 + i * dy
    text(d, PX + lx, yy, lab, font(20), (107, 74, 36), 0, 0.5)
    text(d, PX + vx, yy, val, font(24), (42, 26, 12), 1, 0.5)
    d.line((PX + lx, yy + 21, PX + vx, yy + 21), fill=(107, 74, 36, 80), width=1)
cbx, cby = PX + 520 / 2 - 28, PY - 500 / 2 + 26
d.ellipse((cbx - 21, cby - 21, cbx + 21, cby + 21), fill=(42, 26, 16), outline=(217, 178, 90), width=3)
text(d, cbx, cby - 1, "×", font(30), (247, 233, 201), 0.5, 0.5)
text(d, PX, PY + 234, "창 밖을 탭하면 닫힙니다", font(20), (205, 185, 142), 0.5, 0.5)
scr.save(os.path.join(out, "integration_mock_screen.png"))

# ---------- 줌 1.0 — 중원 밀집 구간 + 행군 부대 ----------
cx2, cy2 = 1200, 700
crop2 = mp.crop((cx2 - 640, cy2 - 360, cx2 + 640, cy2 + 360)).copy()
for id_, v in sorted(cities.items(), key=lambda kv: kv[1][2]):
    name, x, y, size = v
    sx = x * 2 - (cx2 - 640); sy = y * 2 - (cy2 - 360)
    if -80 <= sx <= 1360 and -80 <= sy <= 800:
        draw_city(crop2, id_, sx, sy, 1.0)
paste_c(crop2, load("ui/army.png", 0.6), 515 * 2 - (cx2 - 640), 344 * 2 - (cy2 - 360), 0.5, 0.95)
crop2.save(os.path.join(out, "integration_mock_map_z1.png"))

# ---------- 줌 0.46 — 전체 ----------
z = 720 / 1560
full = mp.resize((round(2000 * z), round(1560 * z)), Image.LANCZOS)
for id_, v in sorted(cities.items(), key=lambda kv: kv[1][2]):
    name, x, y, size = v
    draw_city(full, id_, x * 2 * z, y * 2 * z, z)
full.save(os.path.join(out, "integration_mock_map_zmin.png"))
print("saved 3 mocks")
