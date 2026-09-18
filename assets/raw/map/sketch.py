# 색 스케치 — SPEC §2 개형을 1216x832 로. 논리좌표(1000x780) → 배율 1.216 / 1.0667
import re, math, random
from PIL import Image, ImageDraw, ImageFilter
import numpy as np

W, H = 1216, 832
SX, SY = W / 1000, H / 780


def P(x, y):
    return (x * SX, y * SY)


def PL(pts):
    return [P(x, y) for x, y in pts]


src = open(r'C:\claude\gunyoung\src\data\cities.js', encoding='utf-8').read()
CITIES = [(int(m[0]), m[1], int(m[2]), int(m[3])) for m in
          re.findall(r"id:\s*(\d+),\s*name:\s*'([^']+)'.*?x:\s*(\d+),\s*y:\s*(\d+)", src)]
assert len(CITIES) == 46, len(CITIES)

random.seed(7)

# 1) 평야 — 북쪽 황토, 중원 황록, 남쪽 초록 (세로 그라데이션)
arr = np.zeros((H, W, 3), np.float32)
north = np.array([200, 178, 118], np.float32)
mid = np.array([170, 178, 108], np.float32)
south = np.array([132, 168, 100], np.float32)
for yy in range(H):
    t = yy / H
    if t < .45:
        c = north * (1 - t / .45) + mid * (t / .45)
    else:
        u = (t - .45) / .55
        c = mid * (1 - u) + south * u
    arr[yy, :, :] = c
rs = np.random.RandomState(11)
low = Image.fromarray((rs.rand(26, 38) * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC)
low = np.asarray(low).astype(np.float32) / 255
arr *= (0.86 + 0.28 * low)[:, :, None]
img = Image.fromarray(arr.clip(0, 255).astype(np.uint8))
d = ImageDraw.Draw(img)

# 2) 사막 (서북) 모래색
desert = [(0, 0), (280, 0), (286, 60), (272, 130), (266, 200), (252, 262), (256, 306), (228, 338), (175, 346),
          (110, 332), (0, 300)]
d.polygon(PL(desert), fill=(222, 204, 150))
for _ in range(60):  # 모래 무늬
    x = random.uniform(0, 250)
    y = random.uniform(10, 300)
    d.ellipse([P(x - 18, y - 4), P(x + 18, y + 4)], fill=(212, 190, 128))

# 3) 남중 밀림 (짙은 초록)
namjung = [(0, 585), (150, 578), (230, 582), (340, 602), (372, 650), (352, 722), (305, 770), (0, 780)]
d.polygon(PL(namjung), fill=(58, 110, 62))
d.ellipse([P(410, 712), P(540, 758)], fill=(64, 116, 66))  # 교지 주변

# 4) 숲 (중간 초록 덩어리)
for (cx, cy, rx, ry) in [(540, 635, 70, 45), (495, 600, 40, 28), (640, 700, 55, 28), (745, 625, 50, 45),
                         (700, 660, 40, 30), (270, 490, 60, 40), (340, 640, 35, 25), (150, 520, 30, 40)]:
    d.ellipse([P(cx - rx, cy - ry), P(cx + rx, cy + ry)], fill=(96, 142, 78))

# 5) 바다 — 동·남
coast = [(1000, 45), (975, 70), (950, 95), (925, 108), (905, 118), (890, 135), (878, 160), (872, 190), (868, 220),
         (870, 250), (875, 280), (882, 305), (884, 330), (880, 355), (872, 380), (862, 405), (852, 430), (848, 455),
         (852, 480), (858, 505), (864, 530), (866, 555), (862, 580), (852, 605), (838, 630), (820, 655), (798, 678),
         (772, 700), (742, 720), (708, 738), (672, 748), (632, 752), (592, 752), (552, 754), (512, 760), (472, 764),
         (430, 766), (380, 764), (320, 766), (250, 768), (150, 770), (60, 773), (0, 776)]
sea = coast + [(0, 780), (1000, 780)]
d.polygon(PL(sea), fill=(78, 150, 150))  # 얕은 바다
deep = [(min(x + (26 if x > 700 else 0), 1000), min(y + (26 if y > 600 else 0), 780)) for x, y in coast]
d.polygon(PL(deep + [(0, 780), (1000, 780)]), fill=(32, 96, 110))  # 깊은 바다
d.line(PL(coast), fill=(88, 160, 158), width=6, joint='curve')  # 해안선
for _ in range(140):  # 파도 결
    x = random.uniform(700, 1000)
    y = random.uniform(0, 780)
    px, py = P(x, y)
    if px < W - 1 and py < H - 1 and (lambda c: c[0] < 100 and c[2] > 105)(img.getpixel((int(px), int(py)))):
        d.line([P(x - 14, y), P(x + 14, y)], fill=(70, 130, 140), width=2)


# 6) 산맥 — 능선(폴리라인)을 따라 삼각 봉우리 글리프(밝은 면/어두운 면)를 겹쳐 찍는다
def peak(x, y, h, jungle):
    lit, shd, ln = ((160, 128, 88), (98, 70, 46), (60, 42, 28)) if not jungle else ((84, 118, 70), (46, 74, 46), (34, 52, 34))
    w = h * 1.25
    apex = P(x + random.uniform(-.15, .15) * w, y - h)
    l = P(x - w, y + h * .35); r = P(x + w, y + h * .35); b = P(x + random.uniform(-.2, .2) * w, y + h * .35)
    d.polygon([apex, l, b], fill=lit); d.polygon([apex, b, r], fill=shd)
    d.line([l, apex, r], fill=ln, width=2); d.line([apex, b], fill=ln, width=1)

def ridge(pts, thick, jungle=False):
    band = thick * .9
    # 능선 아래 밑색(넓게) — 산지 덩어리
    base = (140, 112, 76) if not jungle else (66, 96, 58)
    for i in range(len(pts) - 1):
        (x0, y0), (x1, y1) = pts[i], pts[i + 1]
        n = max(2, int(math.hypot(x1 - x0, y1 - y0) / 8))
        for k in range(n + 1):
            t = k / n; x = x0 + (x1 - x0) * t; y = y0 + (y1 - y0) * t
            d.ellipse([P(x - band, y - band * .8), P(x + band, y + band * .8)], fill=base)
    peaks = []
    for i in range(len(pts) - 1):
        (x0, y0), (x1, y1) = pts[i], pts[i + 1]
        n = max(2, int(math.hypot(x1 - x0, y1 - y0) / (thick * .55)))
        for k in range(n + 1):
            t = k / n; x = x0 + (x1 - x0) * t; y = y0 + (y1 - y0) * t
            for row in (-.45, .45, 0):
                peaks.append((y + row * band, x + random.uniform(-.3, .3) * thick, y + row * band + random.uniform(-2, 2), thick * (.55 if row else .8) * random.uniform(.8, 1.2)))
    peaks.sort()
    for _, x, y, h in peaks:
        peak(x, y, h, jungle)


ridge([(285, 378), (340, 372), (400, 378), (460, 384)], 22)  # 진령
ridge([(450, 370), (490, 372), (522, 378)], 13)  # 효산
ridge([(598, 175), (602, 230), (606, 292)], 18)  # 태행
ridge([(175, 410), (168, 470), (172, 530), (185, 578)], 22)  # 파촉 서
ridge([(205, 420), (245, 418), (285, 425), (320, 445), (355, 470), (375, 485)], 15)  # 파촉 북(대파산)
ridge([(215, 560), (260, 568), (305, 565), (345, 555)], 17)  # 파촉 남
ridge([(372, 478), (400, 470), (430, 480), (455, 500)], 13)  # 삼협
ridge([(455, 585), (470, 615), (450, 640)], 15)  # 무릉
ridge([(520, 690), (570, 700), (620, 690), (660, 680)], 15)  # 남령
ridge([(60, 360), (90, 430), (70, 500), (100, 570)], 30)  # 서쪽 고원
ridge([(120, 350), (140, 420), (130, 500)], 26)
ridge([(300, 90), (400, 80), (500, 95), (600, 85), (700, 100)], 17)  # 음산(북)
ridge([(760, 100), (800, 95), (840, 105), (868, 128)], 13)  # 북평 산
ridge([(320, 255), (360, 245), (400, 258)], 13)  # 안정 북
ridge([(255, 290), (285, 300)], 11)  # 천수 서
ridge([(640, 485), (670, 500), (690, 510)], 11)  # 대별산
ridge([(720, 600), (740, 640), (760, 670)], 15)  # 무이산
ridge([(150, 640), (200, 660), (260, 680), (320, 700)], 20, jungle=True)  # 남중 산
ridge([(100, 600), (140, 700)], 20, jungle=True)
ridge([(930, 15), (960, 40), (985, 30)], 14)  # 요동

# 7) 호수
for (cx, cy, rx, ry) in [(560, 572, 20, 13), (702, 590, 20, 16)]:
    d.ellipse([P(cx - rx, cy - ry), P(cx + rx, cy + ry)], fill=(60, 130, 170))


# 8) 강 — 굵은 파란 선 + 밝은 심
def river(pts, w):
    d.line(PL(pts), fill=(36, 78, 128), width=w + 3, joint='curve')
    d.line(PL(pts), fill=(52, 110, 178), width=w, joint='curve')
    d.line(PL(pts), fill=(110, 170, 222), width=max(2, w // 2), joint='curve')


huanghe = [(198, 318), (240, 312), (298, 316), (330, 290), (366, 268), (395, 285), (417, 300), (450, 310), (487, 318),
           (543, 320), (590, 328), (632, 336), (672, 316), (690, 305), (715, 290), (740, 278), (790, 280), (840, 290),
           (880, 300), (900, 302)]
changjiang = [(232, 522), (275, 532), (320, 540), (360, 522), (392, 514), (430, 520), (470, 545), (519, 554),
              (560, 548), (610, 543), (650, 555), (679, 564), (715, 540), (758, 519), (790, 520), (814, 544),
              (845, 540), (870, 540), (900, 540)]
han = [(345, 412), (380, 418), (420, 415), (455, 438), (490, 462), (515, 470), (540, 488), (540, 515), (528, 552)]
huai = [(580, 475), (640, 468), (706, 464), (760, 460), (810, 470), (850, 478), (870, 480)]
si = [(735, 385), (751, 392), (775, 420), (800, 455), (810, 470)]
xiang = [(540, 680), (552, 640), (578, 608), (600, 575), (610, 543)]
haihe = [(560, 235), (600, 245), (641, 256), (680, 240), (700, 218), (760, 212), (820, 205), (878, 200)]
minj = [(215, 440), (210, 480), (215, 522)]
zhu = [(600, 720), (640, 730), (680, 725), (722, 735)]
liao = [(870, 40), (900, 85), (915, 110)]
gan = [(700, 640), (695, 600), (690, 570), (679, 564)]
for r in (han, huai, si, xiang, haihe, minj, zhu, liao, gan):
    river(r, 6)
river(huanghe, 11)
river(changjiang, 11)


# 8b) 나무 글리프 — 숲 덩어리 + 남중 밀림 + 남부 평야 산재. 도시 22 유닛 안·강·바다·산은 피한다
CITY_XY = [(x, y) for _, _, x, y in CITIES]
def land_ok(x, y):
    px, py = P(x, y)
    if not (0 <= px < W and 0 <= py < H): return False
    if any((x - cx) ** 2 + (y - cy) ** 2 < 22 ** 2 for cx, cy in CITY_XY): return False
    r, g, b = img.getpixel((int(px), int(py)))
    if b > r + 25: return False            # 강·바다·호수
    if r > g + 12 and r > 120: return False  # 산(갈색)·사막
    return True
def tree(x, y, r, dark=False):
    c1, c2, ln = ((92, 150, 74), (48, 96, 46), (30, 58, 30)) if not dark else ((70, 120, 62), (36, 76, 40), (24, 46, 26))
    px, py = P(x, y); rx, ry = r * SX, r * SY
    d.ellipse([px - rx, py - ry * .6, px + rx, py + ry * 1.2], fill=c2, outline=ln)
    d.ellipse([px - rx * .7, py - ry * .9, px + rx * .5, py + ry * .4], fill=c1)
def forest(cx, cy, rx, ry, n, r=(4, 7), dark=False):
    pts = []
    for _ in range(n * 3):
        if len(pts) >= n: break
        a = random.uniform(0, 6.283); t = math.sqrt(random.uniform(0, 1))
        x = cx + rx * t * math.cos(a); y = cy + ry * t * math.sin(a)
        if land_ok(x, y): pts.append((y, x))
    for y, x in sorted(pts): tree(x, y, random.uniform(*r), dark)
for (cx, cy, rx, ry, n) in [(540, 635, 70, 45, 60), (495, 600, 40, 28, 18), (640, 700, 55, 28, 25), (745, 625, 50, 45, 40),
                            (700, 660, 40, 30, 20), (270, 490, 60, 40, 30), (340, 640, 35, 25, 14), (150, 520, 30, 40, 14),
                            (475, 735, 60, 22, 22)]:
    forest(cx, cy, rx, ry, n)
for (cx, cy, rx, ry, n) in [(110, 655, 100, 55, 60), (250, 720, 90, 45, 50), (330, 745, 60, 25, 20), (200, 620, 80, 30, 30)]:
    forest(cx, cy, rx, ry, n, dark=True)
# 남부 평야 산재 나무(작게)
for _ in range(220):
    x = random.uniform(150, 870); y = random.uniform(360, 760)
    if land_ok(x, y) and random.random() < 0.7: tree(x, y, random.uniform(2.5, 4))
# 북부 평야 드문 나무
for _ in range(60):
    x = random.uniform(300, 870); y = random.uniform(110, 360)
    if land_ok(x, y): tree(x, y, random.uniform(2, 3.5))

# 9) 질감 — 노이즈 + 약한 블러
a = np.asarray(img).astype(np.float32)
noise = np.random.RandomState(3).normal(0, 9, a.shape)
img = Image.fromarray((a + noise).clip(0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))
img.save(r'C:\claude\gunyoung\assets\raw\map\sketch.png')

# 확인용: 도시 점 찍기
chk = img.copy()
dc = ImageDraw.Draw(chk)
for cid, name, x, y in CITIES:
    px, py = P(x, y)
    dc.ellipse([px - 5, py - 5, px + 5, py + 5], fill=(255, 40, 40), outline=(0, 0, 0))
    dc.text((px + 7, py - 6), str(cid), fill=(0, 0, 0))
chk.save(r'C:\claude\gunyoung\assets\raw\map\sketch_check.png')
print('ok', img.size)
