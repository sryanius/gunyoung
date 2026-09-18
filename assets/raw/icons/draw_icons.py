# -*- coding: utf-8 -*-
"""경로 B: Pillow 로 아이콘 11개를 256x256 에 그려 64x64 로 줄인다.
스타일: 부품(part)마다 마스크를 가우시안 팽창시켜 짙은 갈색 외곽선(≈2px@64) → 밑색 → 그늘(클립) → 하이라이트(클립).
실행: python draw_icons.py [출력폴더]
"""
import math, os, sys
from PIL import Image, ImageDraw, ImageChops, ImageFilter

S = 256                      # 작업 캔버스
FINAL = 64                   # 계약 크기
OUTLINE_R = 8                # 외곽선 두께(px @256) ≈ 2px @64
OUT_DIR = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), 'pillow')

# ── 팔레트(한 세트로 보이게 공용) ──────────────────────────────
OUT     = (38, 24, 16)
GOLD, GOLD_D, GOLD_L = (244, 196, 72), (196, 134, 24), (255, 240, 170)
WOOD, WOOD_D = (156, 100, 50), (108, 64, 28)
IRON, IRON_D = (204, 212, 220), (128, 138, 150)
RED, RED_D = (204, 54, 44), (142, 32, 28)
TAN, TAN_D = (224, 188, 120), (178, 134, 72)
PAPER, PAPER_D = (246, 234, 202), (206, 188, 150)
JADE, JADE_D, JADE_L = (96, 192, 142), (48, 136, 94), (186, 238, 208)
BRONZE, BRONZE_D, BRONZE_L = (196, 144, 72), (134, 92, 42), (232, 196, 124)
SKIN, SKIN_D = (242, 204, 164), (204, 154, 112)
ROBE, ROBE_D = (72, 122, 192), (42, 82, 142)
HAT, HAT_L = (46, 38, 50), (84, 72, 92)
HAIR = (52, 36, 28)
HORSE, HORSE_D, MANE = (110, 72, 44), (70, 44, 26), (48, 32, 20)
HL = (255, 255, 255, 150)    # 하이라이트(반투명)
SHADE = (0, 0, 0, 70)        # 공용 그늘(반투명 검정)

# ── 마스크 도구 ────────────────────────────────────────────────
def M(fn):
    m = Image.new('L', (S, S), 0)
    fn(ImageDraw.Draw(m))
    return m

def P(pts):        return M(lambda d: d.polygon(pts, fill=255))
def E(box):        return M(lambda d: d.ellipse(box, fill=255))
def RR(box, r):    return M(lambda d: d.rounded_rectangle(box, radius=r, fill=255))
def R(box):        return M(lambda d: d.rectangle(box, fill=255))
def LN(pts, w):    return M(lambda d: d.line(pts, fill=255, width=w, joint='curve'))
def ARC(box, a0, a1, w): return M(lambda d: d.arc(box, a0, a1, fill=255, width=w))
def RING(box, w):  return M(lambda d: d.ellipse(box, outline=255, width=w))
def HALF(y):       return R((0, y, S, S))                 # y 아래 반평면
def HALFX(x):      return R((x, 0, S, S))                 # x 오른쪽 반평면
def U(*ms):
    out = ms[0]
    for m in ms[1:]: out = ImageChops.lighter(out, m)
    return out
def I(*ms):
    out = ms[0]
    for m in ms[1:]: out = ImageChops.multiply(out, m)
    return out
def SUB(a, b):     return ImageChops.subtract(a, b)
def dilate(m, r=OUTLINE_R):
    return m.filter(ImageFilter.GaussianBlur(r)).point(lambda v: 255 if v > 40 else 0)

def paint(im, mask, color):
    r, g, b = color[:3]
    a = color[3] if len(color) == 4 else 255
    layer = Image.new('RGBA', (S, S), (r, g, b, 0))
    layer.putalpha(mask if a == 255 else mask.point(lambda v: v * a // 255))
    im.alpha_composite(layer)

def part(im, mask, color, outline=True):
    """외곽선 + 밑색. 나중 부품의 외곽선이 앞 부품 위에 얹혀 구분선이 된다."""
    if outline: paint(im, dilate(mask), OUT)
    paint(im, mask, color)
    return mask

def shade(im, base, region, color=None):  paint(im, I(base, region), color or SHADE)
def hl(im, base, region, color=HL):        paint(im, I(base, region), color)
def line(im, pts, w=6):                    paint(im, LN(pts, w), OUT)

def vec(a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]; L = math.hypot(dx, dy); return (dx / L, dy / L)
def add(p, d, k): return (p[0] + d[0] * k, p[1] + d[1] * k)
def perp(d): return (-d[1], d[0])

# ── 아이콘 ────────────────────────────────────────────────────
def gold(im):
    """원보(元寶) 금괴: 배 모양 몸통 + 가운데 봉긋한 돔"""
    dome = E((84, 84, 172, 160))
    pts = []
    for t in range(0, 181, 5):
        a = math.radians(180 + t); pts.append((128 + 100 * math.cos(a), 128 - 74 * math.sin(a)))
    rim = [(x, 128 + 28 * (1 - ((x - 128) / 100) ** 2)) for x in range(228, 27, -5)]
    body = P(pts + rim)
    part(im, dome, GOLD)
    shade(im, dome, HALFX(150), (0, 0, 0, 45))
    hl(im, dome, E((100, 94, 130, 116)))
    part(im, body, GOLD)
    shade(im, body, HALF(174), (0, 0, 0, 70))
    shade(im, body, P([(228, 124)] + rim[:20] + [(228, 124)]), (0, 0, 0, 0))
    hl(im, body, E((40, 124, 96, 150)), (255, 255, 255, 110))
    line(im, [(x, y) for x, y in rim], 6)

def food(im):
    """쌀가마: 자루 몸통 + 어깨 + 노끈 + 열린 입구 안의 흰 쌀 무더기"""
    body = U(RR((40, 112, 216, 232), 44), P([(64, 126), (192, 126), (170, 72), (86, 72)]))
    neck = P([(92, 92), (164, 92), (176, 52), (80, 52)])
    rope = RR((80, 84, 176, 108), 12)
    mouth = E((74, 40, 182, 68))
    rice = E((86, 26, 170, 60))
    part(im, body, TAN)
    shade(im, body, HALF(188), (0, 0, 0, 60))
    shade(im, body, HALFX(170), (0, 0, 0, 40))
    hl(im, body, E((62, 118, 118, 158)))
    line(im, [(78, 128), (92, 176)], 4); line(im, [(178, 128), (164, 176)], 4)   # 주름
    part(im, neck, TAN);  shade(im, neck, HALFX(134), (0, 0, 0, 40))
    part(im, rope, WOOD); line(im, [(88, 96), (168, 96)], 4); hl(im, rope, R((84, 86, 172, 92)), (255, 255, 255, 80))
    part(im, mouth, TAN_D)
    part(im, rice, (250, 246, 232))
    for gx, gy in ((98, 36), (114, 30), (132, 34), (148, 38), (122, 44), (108, 48), (140, 48)):
        paint(im, E((gx, gy, gx + 10, gy + 6)), (216, 204, 170))
    part(im, I(mouth, HALF(54)), TAN); shade(im, I(mouth, HALF(54)), HALFX(140), (0, 0, 0, 40))

def spear(im, s, e, tip_len=46, w=15, shaft_w=14, tassel=True):
    d = vec(s, e); n = perp(d)
    t = add(e, d, tip_len)
    head = P([add(e, d, -6), add(add(e, n, w), d, 10), t, add(add(e, n, -w), d, 10)])
    part(im, LN([s, e], shaft_w), WOOD)
    hl(im, LN([s, e], shaft_w), LN([add(s, n, -3), add(e, n, -3)], 4), (255, 255, 255, 70))
    if tassel:
        knot = add(e, d, -8)
        strands = P([add(knot, n, 8), add(knot, n, -8), add(add(knot, n, -18), d, -34), add(add(knot, n, 12), d, -30)])
        part(im, strands, RED); shade(im, strands, HALFX(knot[0]), (0, 0, 0, 50))
        part(im, E((knot[0] - 12, knot[1] - 12, knot[0] + 12, knot[1] + 12)), RED)
    part(im, head, IRON)
    shade(im, head, P([add(e, d, -6), t, add(add(e, n, -w), d, 10)]), (0, 0, 0, 60))
    line(im, [add(e, d, 2), add(t, d, -8)], 4)

def troops(im):
    """교차한 창 두 자루"""
    spear(im, (204, 228), (84, 90))
    spear(im, (52, 228), (172, 90))

def officer(im):
    """관모 쓴 무장 흉상"""
    robe = I(E((34, 158, 222, 340)), R((0, 0, S, 230)))
    part(im, robe, ROBE)
    shade(im, robe, HALFX(150), (0, 0, 0, 50))
    collar = P([(96, 160), (128, 208), (160, 160)])
    paint(im, I(robe, collar), ROBE_D); line(im, [(96, 160), (128, 208), (160, 160)], 5)
    part(im, R((106, 130, 150, 176)), SKIN_D)
    head = E((76, 62, 180, 164))
    part(im, head, SKIN); shade(im, head, HALFX(148), (0, 0, 0, 35))
    for x in (102, 140):
        paint(im, E((x, 110, x + 14, 122)), HAIR)
    paint(im, LN([(96, 102), (118, 98)], 5), HAIR); paint(im, LN([(138, 98), (160, 102)], 5), HAIR)
    crown = P([(98, 36), (176, 36), (184, 78), (92, 78)]); brim = RR((62, 70, 194, 92), 9)
    part(im, crown, HAT); hl(im, crown, P([(104, 42), (130, 42), (126, 70), (100, 70)]), (255, 255, 255, 60))
    part(im, brim, HAT);  hl(im, brim, R((70, 74, 130, 80)), (255, 255, 255, 60))
    paint(im, R((62, 84, 194, 92)), (150, 120, 40))   # 관모 금테
    beard = P([(104, 146), (152, 146), (142, 166), (128, 196), (114, 166)])
    part(im, beard, HAIR)

def calendar(im):
    """달력: 붉은 머리띠 + 격자 + 표시된 날 + 고리 두 개"""
    page = RR((48, 62, 208, 228), 14)
    part(im, page, PAPER)
    shade(im, page, HALF(200), (0, 0, 0, 35))
    paint(im, I(page, R((48, 62, 208, 106))), RED)
    hl(im, page, R((56, 66, 200, 76)), (255, 255, 255, 70))
    # 격자
    for y in (150, 186): paint(im, LN([(64, y), (192, y)], 5), PAPER_D)
    for x in (101, 155): paint(im, LN([(x, 116), (x, 220)], 5), PAPER_D)
    paint(im, RR((109, 155, 148, 181), 5), RED)
    line(im, [(48, 106), (208, 106)], 6)
    for x in (78, 152):
        ring = RING((x, 30, x + 28, 78), 10)
        part(im, ring, IRON); shade(im, ring, HALFX(x + 14), (0, 0, 0, 50))

def cmd_domestic(im):
    """괭이: 나무 자루 + 무쇠 날"""
    s, e = (40, 228), (146, 74)
    d = vec(s, e); p = perp(d); bd = (p[0], p[1])   # 날 방향: 자루에 수직(오른쪽 아래)
    if bd[0] < 0: bd = (-bd[0], -bd[1])
    blade = P([add(add(e, bd, 4), d, 12), add(add(e, bd, 86), d, 30), add(add(e, bd, 92), d, 4),
               add(add(e, bd, 86), d, -22), add(add(e, bd, 4), d, -12)])
    shaft = LN([s, add(e, d, 4)], 16)
    part(im, blade, IRON)
    shade(im, blade, P([add(add(e, bd, 4), d, 12), add(add(e, bd, 86), d, 30), add(add(e, bd, 92), d, 4), add(e, bd, 40)]), (0, 0, 0, 55))
    hl(im, blade, LN([add(add(e, bd, 20), d, -14), add(add(e, bd, 78), d, -18)], 6), (255, 255, 255, 120))
    part(im, shaft, WOOD)
    hl(im, shaft, LN([add(s, p, -3), add(e, p, -3)], 4), (255, 255, 255, 70))
    part(im, E((e[0] - 16, e[1] - 16, e[0] + 16, e[1] + 16)), IRON_D)

def cmd_military(im):
    """극(戟): 창날 + 옆의 초승달 날 + 붉은 술"""
    s, e = (80, 230), (156, 66)
    d = vec(s, e); n = perp(d)
    spear(im, s, e, tip_len=46, w=15, shaft_w=16)
    c = add(add(e, d, -24), n, 34)
    outer = E((c[0] - 40, c[1] - 40, c[0] + 40, c[1] + 40))
    cin = add(c, n, 18)
    inner = E((cin[0] - 38, cin[1] - 38, cin[0] + 38, cin[1] + 38))
    cres = SUB(outer, inner)
    bar = LN([add(e, d, -24), add(add(e, d, -24), n, 28)], 10)
    part(im, bar, IRON_D)
    part(im, cres, IRON)
    shade(im, cres, HALF(c[1]), (0, 0, 0, 55))

def cmd_personnel(im):
    """인장(도장): 청동 네모 도장 + 손잡이 + 밑면 붉은 인주"""
    top = P([(60, 140), (172, 140), (206, 110), (94, 110)])
    front = R((60, 140, 172, 212))
    right = P([(172, 140), (206, 110), (206, 182), (172, 212)])
    part(im, front, BRONZE); part(im, right, BRONZE_D); part(im, top, BRONZE_L)
    paint(im, R((60, 196, 172, 212)), RED)
    paint(im, P([(172, 196), (206, 166), (206, 182), (172, 212)]), RED_D)
    line(im, [(60, 196), (172, 196), (206, 166)], 5)
    hl(im, top, R((72, 112, 140, 128)), (255, 255, 255, 80))
    neck = RR((118, 92, 148, 128), 6)
    knob = E((102, 44, 164, 106))
    part(im, neck, BRONZE_D)
    part(im, knob, BRONZE)
    shade(im, knob, HALFX(140), (0, 0, 0, 55))
    hl(im, knob, E((114, 54, 136, 74)))

def cmd_scheme(im):
    """두루마리: 펼친 종이 + 오른쪽 말린 축 + 왼쪽 말린 끝 + 붉은 낙관"""
    paper = R((52, 80, 184, 176))
    curl = RR((36, 84, 64, 172), 12)
    roll = RR((166, 56, 218, 200), 26)
    cap_t = RR((176, 46, 208, 66), 6); cap_b = RR((176, 190, 208, 210), 6)
    part(im, curl, PAPER_D)
    part(im, paper, PAPER)
    shade(im, paper, HALF(150), (0, 0, 0, 30))
    shade(im, paper, HALFX(160), (0, 0, 0, 45))
    paint(im, RR((136, 132, 166, 162), 4), RED)
    part(im, cap_t, WOOD_D); part(im, cap_b, WOOD_D)
    part(im, roll, WOOD)
    shade(im, roll, HALFX(196), (0, 0, 0, 60))
    hl(im, roll, R((176, 66, 186, 190)), (255, 255, 255, 80))

def cmd_diplomacy(im):
    """옥새: 옥 받침 + 금테 + 용 손잡이(단순화한 아치) + 붉은 인끈"""
    top = P([(66, 130), (166, 130), (200, 104), (100, 104)])
    front = R((66, 130, 166, 196))
    right = P([(166, 130), (200, 104), (200, 170), (166, 196)])
    part(im, front, JADE); part(im, right, JADE_D); part(im, top, JADE_L)
    paint(im, R((66, 152, 166, 168)), GOLD)
    paint(im, P([(166, 152), (200, 126), (200, 142), (166, 168)]), GOLD_D)
    line(im, [(66, 152), (166, 152), (200, 126)], 4); line(im, [(66, 168), (166, 168), (200, 142)], 4)
    hl(im, top, R((80, 108, 150, 120)), (255, 255, 255, 90))
    shell = I(E((94, 54, 182, 126)), R((0, 0, S, 96)))     # 등딱지: 타원 윗반
    headb = E((72, 78, 104, 104)); tail = E((176, 82, 196, 98))
    part(im, tail, JADE_D)
    part(im, headb, JADE); hl(im, headb, E((80, 82, 92, 92)))
    paint(im, E((84, 88, 92, 96)), OUT)
    part(im, shell, JADE); shade(im, shell, HALFX(150), (0, 0, 0, 50)); hl(im, shell, E((108, 60, 136, 78)))
    line(im, [(112, 96), (122, 68), (152, 68), (164, 96)], 4)   # 등딱지 무늬
    cord = LN([(186, 100), (196, 176)], 8)
    tassel = P([(188, 172), (204, 172), (212, 214), (180, 214)])
    part(im, tassel, RED); shade(im, tassel, HALFX(196), (0, 0, 0, 50))
    part(im, cord, RED)

def cmd_march(im):
    """말 머리(기사 말) + 갈기 + 붉은 굴레"""
    head = P([(70, 228), (206, 228), (206, 170), (196, 112), (176, 66), (162, 34), (148, 54), (134, 26),
              (122, 54), (92, 70), (50, 110), (36, 134), (44, 152), (74, 152), (94, 146), (104, 166),
              (88, 196), (70, 228)])
    mane = P([(176, 66), (196, 112), (206, 170), (206, 228), (186, 228), (184, 188), (174, 168), (176, 138),
              (164, 120), (166, 96), (152, 76), (160, 58)])
    part(im, head, HORSE)
    shade(im, head, HALF(176), (0, 0, 0, 55))
    hl(im, head, E((98, 84, 134, 112)), (255, 255, 255, 80))
    part(im, mane, MANE)
    hl(im, mane, LN([(172, 82), (190, 142), (196, 212)], 5), (255, 255, 255, 50))
    paint(im, E((98, 98, 114, 112)), OUT)          # 눈
    paint(im, E((104, 101, 108, 105)), (255, 255, 255, 200))
    paint(im, E((50, 132, 62, 142)), OUT)          # 콧구멍
    strap = LN([(58, 110), (86, 152)], 8)
    part(im, I(strap, head), RED)
    part(im, I(LN([(84, 84), (98, 144)], 7), head), RED)

ICONS = [('gold', gold), ('food', food), ('troops', troops), ('officer', officer), ('calendar', calendar),
         ('cmd_domestic', cmd_domestic), ('cmd_military', cmd_military), ('cmd_personnel', cmd_personnel),
         ('cmd_scheme', cmd_scheme), ('cmd_diplomacy', cmd_diplomacy), ('cmd_march', cmd_march)]

def render(name, fn):
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    fn(im)
    # 프레임 접촉 검사: 캔버스 가장자리 2px 에 알파가 있으면 잘린 것
    a = im.getchannel('A')
    edge = max(a.crop((0, 0, S, 2)).getextrema()[1], a.crop((0, S - 2, S, S)).getextrema()[1],
               a.crop((0, 0, 2, S)).getextrema()[1], a.crop((S - 2, 0, S, S)).getextrema()[1])
    small = im.convert('RGBa').resize((FINAL, FINAL), Image.LANCZOS).convert('RGBA')
    return im, small, edge

if __name__ == '__main__':
    os.makedirs(OUT_DIR, exist_ok=True)
    only = sys.argv[2].split(',') if len(sys.argv) > 2 else None
    for name, fn in ICONS:
        if only and name not in only: continue
        big, small, edge = render(name, fn)
        big.save(os.path.join(OUT_DIR, f'{name}_256.png'))
        small.save(os.path.join(OUT_DIR, f'{name}.png'))
        bb = small.getbbox()
        print(f'{name:14s} 64x64 bbox={bb} edge_alpha={edge}')
