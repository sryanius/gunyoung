# -*- coding: utf-8 -*-
"""연출 코드 담당의 배치 목업(브라우저 대체) — BattleScene.js 의 층·줌·패럴랙스 수식을 그대로 Pillow 로 합성한다.
usage: python _code_mock.py out.png [W=1558] [centerX=auto(관우)] [zoom=1.15]
입력: _code_units.json (node _code_dump_units.mjs 24), assets/battle/** (있는 것만)
※ 수치를 BattleScene.js 와 같이 유지할 것: LAYER 순서, U2/U1 배율, PROPS, MID_BASE, FOG, 카메라 scrollY."""
import sys, os, json, math
from PIL import Image, ImageDraw
import numpy as np

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
A = os.path.join(ROOT, 'assets', 'battle')
out = sys.argv[1]
W = int(sys.argv[2]) if len(sys.argv) > 2 else 1558
H = 720
data = json.load(open(os.path.join(os.path.dirname(__file__), '_code_units.json'), encoding='utf-8'))
units = data['units']
player = next((u for u in units if u['id'] == data['player']), units[0])
CX = float(sys.argv[3]) if len(sys.argv) > 3 and sys.argv[3] != 'auto' else player['x'] + 120
Z = float(sys.argv[4]) if len(sys.argv) > 4 else 1.15
FW, FH, TOP = 3200, 720, 400
hw = W / (2 * Z)
cxw = min(max(CX, hw), FW - hw)
scrollX = cxw - W / 2
scrollY = (FH - FH / Z) / 2

def load(rel):
    p = os.path.join(A, rel)
    return Image.open(p).convert('RGBA') if os.path.exists(p) else None

canvas = Image.new('RGBA', (W, H), (11, 10, 8, 255))

def put(img, wx, wy, sf=1.0, ox=0.0, oy=0.0, sx=1.0, sy=None, alpha=1.0, flip=False, add=False):
    """world (wx,wy) 에 origin(ox,oy), 배율 sx/sy 로 — 화면 = c + Z*(world − scroll*sf − c)"""
    if img is None: return
    sy = sx if sy is None else sy
    w, h = img.width * sx * Z, img.height * sy * Z
    if w < 1 or h < 1: return
    x0 = W / 2 + Z * (wx - scrollX * sf - W / 2) - ox * w
    y0 = H / 2 + Z * (wy - scrollY - H / 2) - oy * h
    if x0 > W or y0 > H or x0 + w < 0 or y0 + h < 0: return
    im = img.transpose(Image.FLIP_LEFT_RIGHT) if flip else img
    im = im.resize((max(1, round(w)), max(1, round(h))), Image.LANCZOS)
    if alpha < 1:
        a = im.split()[-1].point(lambda v: int(v * alpha)); im.putalpha(a)
    layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    layer.paste(im, (round(x0), round(y0)))
    global canvas
    if add:
        c = np.array(canvas).astype(float); l = np.array(layer).astype(float)
        c[..., :3] = np.clip(c[..., :3] + l[..., :3] * (l[..., 3:4] / 255), 0, 255)
        canvas = Image.fromarray(c.astype('uint8'), 'RGBA')
    else:
        canvas = Image.alpha_composite(canvas, layer)

R = max(1, FW - W)
sky = load('sky.png'); k = max(1, W * 1.05 / 2048); put(sky, 0, 0, sf=min(0.1, (2048 * k - W) / R), sx=k, sy=1)
far = load('far.png')
for i in range(3): put(far, i * 2048, TOP + 30, sf=0.2, oy=1)
# 하늘색 띠 372→400
hz = Image.new('RGBA', (8, 28)); hp = hz.load()
for y in range(28):
    for x in range(8): hp[x, y] = (0xed, 0xe1, 0xd0, int(255 * 0.9 * y / 27))
put(hz, 0, TOP - 28, sf=0.2, sx=FW / 8 * 1.2, sy=1)
g2 = load('field/ground.png'); mid = load('field/mid.png')
for i in range(3): put(mid, i * 2048, (TOP - 8) if g2 else (TOP + 20), sf=0.5, oy=1)
if g2:
    for i in range(2): put(g2, i * 2048, FH - 360)
else:
    g1 = load('ground.png')
    for i in range(4): put(g1, i * 1024, TOP)
# 원근 그라데이션
shTop = TOP - 20 if g2 else TOP
sh = Image.new('RGBA', (4, 64)); sp = sh.load()
for y in range(64):
    t = y / 63
    a = 0.35 + (0.12 - 0.35) * (t / 0.45) if t < 0.45 else 0.12 * (1 - (t - 0.45) / 0.55)
    for x in range(4): sp[x, y] = (14, 10, 24, int(255 * a))
put(sh, 0, shTop, sx=FW / 4, sy=(FH - shTop) / 64)
fog = load('field/fog.png')
for i in range(-1, 5): put(fog, i * 1024 + 300, TOP - 10, oy=0.5, alpha=0.9)
# 데칼
b1 = load('field/blood1.png'); b2 = load('field/blood2.png')
for n, d in enumerate(data['deaths']):
    put(b1 if n % 2 else (b2 or b1), d['x'], d['y'] + 2, ox=0.5, oy=0.5, sx=(40 + (d['id'] % 5) * 4) / 128, alpha=0.8)
PROPS = [
  ['tent', 150, 410, 0.9, False], ['tent', 340, 404, 0.72, True], ['palisade', 500, 414, 0.8, False],
  ['palisade', 40, 416, 0.8, True], ['banner_g', 250, 446, 0.8, False], ['banner_g', 410, 668, 0.9, False],
  ['tent', 3050, 410, 0.9, True], ['tent', 2860, 404, 0.72, False], ['palisade', 2700, 414, 0.8, True],
  ['palisade', 3160, 416, 0.8, False], ['banner_b', 2950, 446, 0.8, True], ['banner_b', 2790, 668, 0.9, True],
  ['tree_dead', 1180, 408, 0.85, False], ['tree_dead', 2080, 412, 0.75, True],
  ['rock1', 1580, 414, 0.5, False], ['rock2', 880, 410, 0.45, False], ['rock2', 2380, 412, 0.4, True],
  ['rock2', 1390, 726, 0.4, False], ['rock1', 2240, 728, 0.42, True],
]
draw_list = []
for key, x, y, s, fl in PROPS:
    banner = key.startswith('banner')
    ox = 0.16 if banner else 0.5
    if fl and banner: ox = 1 - ox   # 음수 scaleX = origin 기준 거울
    draw_list.append((y if y > TOP + 20 else 6, 'prop', (load('field/' + key + '.png'), x, y, ox, 0.98 if banner else 0.94, s, fl)))
# 유닛 — 2차 그림이 있으면 그것, 없으면 1차 + tint
TINT = {'left': (0x3a, 0xa6, 0x55), 'right': (0x3b, 0x6f, 0xd6)}
GT = {'left': (0x8f, 0xe8, 0xa0), 'right': (0x9c, 0xc0, 0xff)}
cache = {}
def load2(rel):
    # U2DIR=폴더 를 주면 units2 를 거기서 읽는다(배율 점검용 가짜 그림 _code_fake_units2)
    d = os.environ.get('U2DIR')
    if d:
        p = os.path.join(d, os.path.basename(rel)); return Image.open(p).convert('RGBA') if os.path.exists(p) else None
    return load(rel)
def unit_img(u):
    gen = u['kind'] == 'general'
    sd = 'g' if u['side'] == 'left' else 'b'
    base = ('gen_%s' % u.get('key')) if gen else '%s_%s' % (u['kind'], sd)
    atk = u['state'] == 'attack' and 0.15 <= (u.get('attackT') or 0) <= 0.75
    k2 = 'units2/%s_%s.png' % (base, 'attack' if atk else 'stand')
    if k2 not in cache:
        cache[k2] = load2(k2) or (load2('units2/%s_stand.png' % base) if atk else None)
    if cache[k2] is not None:
        return cache[k2], (0.46 if gen else 0.36), 0.95, (67 if gen else 54 if u['kind'] == 'cav' else 47)
    k1 = ('general_%s' % u['side']) if gen else u['kind']
    ck = k1 + u['side']
    if ck not in cache:
        im = load('units/%s.png' % k1)
        a = np.array(im).astype(float); a[..., :3] *= np.array(GT[u['side']] if gen else TINT[u['side']]) / 255
        cache[ck] = Image.fromarray(a.clip(0, 255).astype('uint8'), 'RGBA')
    return cache[ck], (0.42 if gen else 0.345 if u['kind'] == 'cav' else 0.3), 0.98, (52 if gen else 37)
flag = {'left': load('field/flag_g.png'), 'right': load('field/flag_b.png')}
cnt = {}
for u in sorted(units, key=lambda u: u['id']):
    if u['kind'] == 'general': continue
    n = cnt.get(u['generalId'], 0); cnt[u['generalId']] = n + 1
    u['bearer'] = n in (2, 26, 50)
for u in units:
    draw_list.append((u['y'], 'unit', u))
draw_list.sort(key=lambda t: t[0])
# 그림자
shadow = Image.new('RGBA', (W, H), (0, 0, 0, 0)); sd = ImageDraw.Draw(shadow)
def scr(wx, wy): return W / 2 + Z * (wx - scrollX - W / 2), H / 2 + Z * (wy - scrollY - H / 2)
for u in units:
    gen = u['kind'] == 'general'
    x, y = scr(u['x'], u['y'] + 1); rw, rh = ((42, 13) if gen else (24, 8))
    sd.ellipse([x - rw * Z / 2, y - rh * Z / 2, x + rw * Z / 2, y + rh * Z / 2], fill=(0, 0, 0, 72))
    if gen:
        col = TINT[u['side']]
        sd.ellipse([x - 28 * Z, y - 9 * Z, x + 28 * Z, y + 9 * Z], fill=col + (64,), outline=col + (242,), width=3)
canvas = Image.alpha_composite(canvas, shadow)
for d, kind, v in draw_list:
    if kind == 'prop':
        img, x, y, ox, oy, s, fl = v
        put(img, x, y, ox=ox, oy=oy, sx=s, flip=fl)
    else:
        u = v
        img, s, oy, hgt = unit_img(u)
        f = -1 if u['facing'] < 0 else 1
        if u.get('bearer') and flag[u['side']] is not None:
            put(flag[u['side']], u['x'] - f * 6, u['y'] - hgt * 0.42, ox=(1 - 0.13) if f > 0 else 0.13, oy=1, sx=0.62, flip=f > 0)
        put(img, u['x'], u['y'], ox=0.5, oy=oy, sx=s, flip=f < 0)
# fx 표본: 관우 앞 청룡참 + 타격 불꽃 몇 개 + 링
sb = load('fx/slash_blue.png'); spk = load('fx/spark.png'); ring = load('fx/ring.png')
put(sb, player['x'] + 220, player['y'] - 36, ox=0.5, oy=0.5, sx=300 / 512, add=True)
for u in units[::9]:
    if u['state'] == 'attack': put(spk, u['x'] + 8, u['y'] - 18, ox=0.5, oy=0.5, sx=44 / 64, add=True)
for i in range(-1, 5): put(fog, i * 1024 + 700, 650, oy=0.5, sy=1.5, alpha=0.45)
# 비네트
vg = Image.new('RGBA', (W, H), (0, 0, 0, 0)); va = np.zeros((H, W), float)
yy, xx = np.mgrid[0:H, 0:W]
r = np.hypot((xx - W / 2) / (W / 2), (yy - H / 2) / (H / 2))
t = np.clip((r - 0.62) / (1.42 - 0.62), 0, 1)
va = np.where(t < 0.55, t / 0.55 * 0.16, 0.16 + (t - 0.55) / 0.45 * (0.45 - 0.16))
vg = np.zeros((H, W, 4), 'uint8'); vg[..., 0] = 8; vg[..., 1] = 5; vg[..., 2] = 12; vg[..., 3] = (va * 255).astype('uint8')
canvas = Image.alpha_composite(canvas, Image.fromarray(vg, 'RGBA'))
canvas.convert('RGB').save(out)
print(out, canvas.size, 'scrollX %.0f scrollY %.0f zoom %.2f' % (scrollX, scrollY, Z))
