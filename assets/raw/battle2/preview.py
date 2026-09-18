# -*- coding: utf-8 -*-
"""통합 담당의 정적 합성 미리보기(브라우저 대신 쓰는 눈 검사) — BattleScene/BattleHud 의 층·줌·배율·origin 을 그대로 Pillow 로 합성한다.

usage:  python assets/raw/battle2/preview.py [out.png] [--cx=1400] [--w=1558] [--zoom=1.15] [--camp] [--nohud]
  기본: assets/raw/battle2/preview.png (격돌 장면, 1558x720) + preview_camp.png (왼쪽 진영 — 막사·목책·진영 깃발·대기 진형)
  --camp 만 주면 진영 장면만 out 에.

수치는 가능한 한 src/battle/BattleScene.js · BattleHud.js · fx.js 에서 **정규식으로 읽는다**(U2 배율·U2_ANCHOR·FLAG_*·PROPS·FOG·MID_BASE·
HUD_LAYOUT). 못 읽으면 아래 기본값. 층 순서·수식(put)은 손으로 옮긴 것 — 코드의 LAYER/syncSprites/buildBackground 를 바꾸면 여기도.
유닛은 sim 을 안 돌리고 고정 난수로 30여 명을 stand/attack 섞어 놓는다(+ 진형 간격 20x22 블록 하나 — 배율이 간격에 비해 빽빽한지 보려고)."""
import sys, os, re, json, math, random
from PIL import Image, ImageDraw, ImageFont
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..', '..'))
A = os.path.join(ROOT, 'assets')
args = [a for a in sys.argv[1:] if not a.startswith('--')]
opts = dict(a[2:].split('=', 1) if '=' in a else (a[2:], '1') for a in sys.argv[1:] if a.startswith('--'))
W = int(opts.get('w', 1558)); H = 720
Z = float(opts.get('zoom', 1.15))
FW, FH, TOP, BOTTOM = 3200, 720, 400, 690

# ───────── 코드에서 수치 읽기 ─────────
def src(rel):
    with open(os.path.join(ROOT, rel), encoding='utf-8') as f: return f.read()
BS, BH, FXJS = src('src/battle/BattleScene.js'), src('src/battle/BattleHud.js'), src('src/battle/fx.js')
def num(text, pat, default):
    m = re.search(pat, text)
    return float(m.group(1)) if m else default
def obj(text, pat, default):
    """JS 객체/배열 리터럴(숫자·문자열·true/false 만) → 파이썬. 실패하면 default"""
    m = re.search(pat, text, re.S)
    if not m: return default
    s = re.sub(r'//[^\n]*', '', m.group(1))
    s = re.sub(r"'([^']*)'", r'"\1"', s)
    s = re.sub(r'([{,]\s*)([A-Za-z_]\w*)\s*:', r'\1"\2":', s)
    s = re.sub(r',\s*([}\]])', r'\1', s)
    s = s.replace('FIELD.top', str(TOP))
    s = re.sub(r'(-?\d+(?:\.\d+)?)\s*([-+])\s*(\d+(?:\.\d+)?)', lambda k: str(eval(k.group(0))), s)
    try: return json.loads(s)
    except Exception as e:
        print('  (파싱 실패 → 기본값)', pat[:30], e); return default
U2 = obj(BS, r'const U2 = (\{.*?\n\});', {'oy': 0.95, 'soldier': {'scale': 0.36, 'h': 47, 'sw': 24, 'sh': 8}, 'cav': {'scale': 0.36, 'h': 54, 'sw': 34, 'sh': 9}, 'general': {'scale': 0.46, 'h': 67, 'sw': 42, 'sh': 13}})
U2_ANCHOR = obj(BS, r'const U2_ANCHOR = (\{.*?\n\});', {})
PROPS = obj(BS, r'const PROPS = (\[.*?\n\]);', [])
FOG = obj(BS, r'const FOG = (\{.*?\});', {'backY': 390, 'backAlpha': 0.9, 'frontY': 650, 'frontAlpha': 0.45, 'frontScaleY': 1.5})
MID_BASE = obj(BS, r'const MID_BASE = (\{.*?\});', {'ground2': 392, 'ground1': 420})
FLAG_SCALE = num(BS, r'const FLAG_SCALE = ([\d.]+)', 0.62)
PROP_OY = num(BS, r'banner \? [\d.]+ : ([\d.]+)\)\.setScale', 0.94)
BANNER_OX = num(BS, r'setOrigin\(banner \? ([\d.]+)', 0.16)
BANNER_OY = num(BS, r'banner \? ([\d.]+) : [\d.]+\)\.setScale', 0.98)
HUD = obj(BH, r'export const HUD_LAYOUT = (\{.*?\n\});', None)
RING_FILL = num(FXJS, r'const RING_FILL = ([\d.]+)', 0.77)
print('U2', U2); print('U2_ANCHOR', U2_ANCHOR); print('FOG', FOG, 'MID_BASE', MID_BASE, 'FLAG_SCALE', FLAG_SCALE, 'props', len(PROPS))

def load(rel):
    p = os.path.join(A, rel)
    return Image.open(p).convert('RGBA') if os.path.exists(p) else None
def font(sz):
    for f in (r'C:\Windows\Fonts\malgunbd.ttf', r'C:\Windows\Fonts\malgun.ttf'):
        if os.path.exists(f): return ImageFont.truetype(f, sz)
    return ImageFont.load_default()

class Scene:
    def __init__(self, cx):
        hw = W / (2 * Z)
        self.scrollX = min(max(cx, hw), FW - hw) - W / 2
        self.scrollY = (FH - FH / Z) / 2
        self.canvas = Image.new('RGBA', (W, H), (11, 10, 8, 255))
    def scr(self, wx, wy, sf=1.0):
        return W / 2 + Z * (wx - self.scrollX * sf - W / 2), H / 2 + Z * (wy - self.scrollY - H / 2)
    def put(self, img, wx, wy, sf=1.0, ox=0.0, oy=0.0, sx=1.0, sy=None, alpha=1.0, flip=False, add=False, angle=0.0, mirror=False):
        """world (wx,wy) 에 origin(ox,oy)·배율로. flip = Phaser flipX(그림 상자 안에서 뒤집기, origin 그대로), mirror = 음수 scaleX(origin 기준 거울)"""
        if img is None: return
        sy = sx if sy is None else sy
        w, h = img.width * sx * Z, img.height * sy * Z
        if w < 1 or h < 1: return
        X, Y = self.scr(wx, wy, sf)
        if mirror: ox = 1 - ox
        x0, y0 = X - ox * w, Y - oy * h
        if x0 > W + 200 or y0 > H + 200 or x0 + w < -200 or y0 + h < -200: return
        im = img.transpose(Image.FLIP_LEFT_RIGHT) if (flip or mirror) else img
        im = im.resize((max(1, round(w)), max(1, round(h))), Image.LANCZOS)
        if alpha < 1:
            im.putalpha(im.split()[-1].point(lambda v: int(v * alpha)))
        layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        if angle:
            # origin 을 축으로 회전(Phaser angle 은 시계 방향 +)
            R = int(math.hypot(im.width, im.height)) + 4
            tmp = Image.new('RGBA', (2 * R, 2 * R), (0, 0, 0, 0))
            tmp.paste(im, (round(R - ox * im.width), round(R - oy * im.height)))
            tmp = tmp.rotate(-angle, resample=Image.BICUBIC)
            layer.paste(tmp, (round(X - R), round(Y - R)))
        else:
            layer.paste(im, (round(x0), round(y0)))
        if add:
            c = np.array(self.canvas).astype(float); l = np.array(layer).astype(float)
            c[..., :3] = np.clip(c[..., :3] + l[..., :3] * (l[..., 3:4] / 255), 0, 255)
            self.canvas = Image.fromarray(c.astype('uint8'), 'RGBA')
        else:
            self.canvas = Image.alpha_composite(self.canvas, layer)

def shade_tex():
    """BootScene.fbShade 와 같은 4x64 램프: 0 → 0.33(12%) → 0.12(45%) → 0"""
    sh = Image.new('RGBA', (4, 64)); sp = sh.load()
    for y in range(64):
        t = y / 63
        a = 0.33 * t / 0.12 if t < 0.12 else 0.33 + (0.12 - 0.33) * (t - 0.12) / 0.33 if t < 0.45 else 0.12 * (1 - (t - 0.45) / 0.55)
        for x in range(4): sp[x, y] = (14, 10, 24, int(255 * a))
    return sh

def background(S):
    R = max(1, FW - W)
    sky = load('battle/sky.png'); k = max(1, W * 1.05 / 2048)
    S.put(sky, 0, 0, sf=min(0.1, (2048 * k - W) / R), sx=k, sy=1)
    far = load('battle/far.png')
    for i in range(3): S.put(far, i * 2048, TOP + 30, sf=0.2, oy=1)
    hz = Image.new('RGBA', (8, 28)); hp = hz.load()
    for y in range(28):
        for x in range(8): hp[x, y] = (0xed, 0xe1, 0xd0, int(255 * 0.9 * y / 27))
    S.put(hz, 0, TOP - 28, sf=0.2, sx=FW / 8 * 1.2, sy=1)
    g2 = load('battle/field/ground.png'); mid = load('battle/field/mid.png')
    for i in range(3): S.put(mid, i * 2048, MID_BASE['ground2'] if g2 else MID_BASE['ground1'], sf=0.5, oy=1)
    if g2:
        for i in range(2): S.put(g2, i * 2048, FH - 360)
    else:
        g1 = load('battle/ground.png')
        for i in range(4): S.put(g1, i * 1024, TOP)
    shTop = TOP - 20 if g2 else TOP
    S.put(shade_tex(), 0, shTop, sx=FW / 4, sy=(FH - shTop) / 64)
    fog = load('battle/field/fog.png')
    for i in range(-1, 5): S.put(fog, i * 1024 + 300, FOG['backY'], oy=0.5, alpha=FOG['backAlpha'])
    return fog

def unit_tex(u):
    gen = u['kind'] == 'general'
    base = 'gen_%s' % u['key'] if gen else '%s_%s' % (u['kind'], 'g' if u['side'] == 'left' else 'b')
    m = U2['general'] if gen else U2['cav'] if u['kind'] == 'cav' else U2['soldier']
    aT = u.get('attackT', 0)
    atk = u['state'] == 'attack' and 0.15 <= aT <= 0.75
    name = '%s_%s' % (base, 'attack' if atk else 'stand')
    an = U2_ANCHOR.get('gen_%s' % u['key'] if gen else u['kind'], [64, 64])
    ax = (an[1 if atk else 0] - 64) * m['scale']          # BattleScene.texFor 의 t.ax / t.axAtk
    return load('battle/units2/%s.png' % name), m, atk, ax

def make_units(cx, rnd):
    """격돌: 왼쪽 초록 → / 오른쪽 파랑 ←. 가운데 120px 안은 공격 중(attackT 0.2~0.7), 나머지는 이동/대기"""
    us = []; uid = [0]
    def add(side, kind, x, y, state, key=None, aT=0.0, bearer=False, name=None):
        uid[0] += 1
        us.append(dict(id=uid[0], side=side, kind=kind, x=x, y=y, facing=1 if side == 'left' else -1, state=state, key=key, attackT=aT, bearer=bearer, name=name))
    kinds_l = ['inf', 'inf', 'spear', 'spear', 'bow', 'cav']
    kinds_r = ['cav', 'cav', 'inf', 'bow', 'bow', 'spear']
    for i in range(17):
        for side, kinds, sg in (('left', kinds_l, -1), ('right', kinds_r, 1)):
            kind = kinds[i % len(kinds)]
            d = 18 + rnd.random() * 330 if kind != 'bow' else 200 + rnd.random() * 220
            x = cx + sg * d; y = 425 + rnd.random() * 255
            near = d < 110
            add(side, kind, x, y, 'attack' if near or (kind == 'bow' and i % 2) else 'move' if i % 3 else 'idle', aT=0.2 + rnd.random() * 0.5, bearer=(i % 7 == 3))
    add('left', 'general', cx - 60, 520, 'attack', key='guanyu', aT=0.45, name='관우')
    add('left', 'general', cx - 170, 615, 'idle', key='zhangfei', name='장비')
    add('right', 'general', cx + 75, 600, 'attack', key='xiahoudun', aT=0.4, name='하후돈')
    add('right', 'general', cx + 190, 500, 'idle', key='dianwei', name='전위')
    # 진형 블록(간격 20x22 — sim 의 대기 진형): 왼쪽 뒤 창병 5x6, 오른쪽 뒤 기병 4x5
    for c in range(5):
        for r in range(6): add('left', 'spear', cx - 470 - c * 20, 470 + r * 22, 'idle', bearer=(c == 2 and r == 2))
    for c in range(4):
        for r in range(5): add('right', 'cav', cx + 480 + c * 20, 520 + r * 22, 'idle', bearer=(c == 1 and r == 2))
    return us

def camp_units():
    """왼쪽 진영 대기 진형 — sim 과 같은 자리(무장 x 520/560, y 520/600, 뒤로 6줄x10겹, 간격 20x22)"""
    us = []; n = 0
    for (gx, gy, kind, key, nm, shift) in ((520, 520, 'inf', 'guanyu', '관우', -20), (560, 600, 'spear', 'zhangfei', '장비', 20)):
        n += 1; us.append(dict(id=n, side='left', kind='general', x=gx, y=gy, facing=1, state='idle', key=key, attackT=0, bearer=False, name=nm))
        k = 0
        for col in range(10):
            for row in range(6):
                n += 1
                us.append(dict(id=n, side='left', kind=kind, x=gx - 30 - col * 20, y=gy + shift + (row - 2.5) * 22, facing=1, state='idle', key=None, attackT=0, bearer=(k in (2, 26, 50)), name=None))
                k += 1
    return us

SIDE = {'left': (0x3a, 0xa6, 0x55), 'right': (0x3b, 0x6f, 0xd6)}

def render(cx, units, out, hud=True, fx=True):
    S = Scene(cx)
    fog = background(S)
    # 데칼 표본(층 5)
    b1, b2, cr = load('battle/field/blood1.png'), load('battle/field/blood2.png'), load('battle/field/crater.png')
    if fx:
        for i, (dx, dy, px) in enumerate(((-30, 40, 44), (40, -50, 52), (120, 90, 40), (-150, -20, 48), (10, 120, 84))):
            S.put(b1 if i % 2 else b2, cx + dx, 540 + dy, ox=0.5, oy=0.5, sx=px / 128, alpha=0.85)
        S.put(cr, cx + 75, 602, ox=0.5, oy=0.5, sx=160 / 128, alpha=0.9)
    draw = []
    for key, x, y, s, fl in PROPS:
        banner = key.startswith('field_banner')
        img = load('battle/field/%s.png' % key.replace('field_', ''))
        draw.append((6 + y * 0.001 if y <= TOP + 20 else y, 'prop', (img, x, y, BANNER_OX if banner else 0.5, BANNER_OY if banner else PROP_OY, s, fl)))
    for u in units: draw.append((u['y'], 'unit', u))
    draw.sort(key=lambda t: t[0])
    # 그림자·무장 링(층 7) — 소품(층 6) 가운데 y<=420 인 것은 그림자보다 뒤, 나머지는 y 깊이
    for d, kind, v in draw:
        if kind == 'prop' and d < 7:
            img, x, y, ox, oy, s, fl = v; S.put(img, x, y, ox=ox, oy=oy, sx=s, mirror=fl)
    shadow = Image.new('RGBA', (W, H), (0, 0, 0, 0)); sd = ImageDraw.Draw(shadow)
    for u in units:
        _, m, _, _ = unit_tex(u)
        x, y = S.scr(u['x'], u['y'] + 1)
        sd.ellipse([x - m['sw'] * Z / 2, y - m['sh'] * Z / 2, x + m['sw'] * Z / 2, y + m['sh'] * Z / 2], fill=(0, 0, 0, 72))
        if u['kind'] == 'general':
            col = SIDE[u['side']]
            sd.ellipse([x - 28 * Z, y - 9 * Z, x + 28 * Z, y + 9 * Z], fill=col + (64,), outline=col + (242,), width=3)
    S.canvas = Image.alpha_composite(S.canvas, shadow)
    flag = {'left': load('battle/field/flag_g.png'), 'right': load('battle/field/flag_b.png')}
    labels = []
    for d, kind, v in draw:
        if kind == 'prop':
            if d >= 7:
                img, x, y, ox, oy, s, fl = v; S.put(img, x, y, ox=ox, oy=oy, sx=s, mirror=fl)
            continue
        u = v
        img, m, atk, ax = unit_tex(u)
        f = u['facing']; gen = u['kind'] == 'general'
        dx = dy = ang = 0.0
        if u['state'] == 'attack':
            k = math.sin(math.pi * u['attackT'])
            dx = f * (12 if gen else 8) * k
            ang = f * (8 if gen else 6) * k
        elif u['state'] == 'move':
            dy = math.sin(u['id'] * 1.7) * 2; ang = f * 4.3
        bx, sy_ = u['x'] + dx, u['y'] + dy
        sx_ = bx - f * ax                                     # syncSprites: s.x = bx − f·ax
        if u['bearer'] and flag[u['side']] is not None:
            S.put(flag[u['side']], bx - f * 6, sy_ - m['h'] * 0.42, ox=0.13, oy=1, sx=FLAG_SCALE * 0.9, sy=FLAG_SCALE, mirror=f > 0, angle=ang * 0.6 - f * 7)
        S.put(img, sx_, sy_, ox=0.5, oy=U2['oy'], sx=m['scale'], flip=f < 0, angle=ang)
        if gen: labels.append((u, m['h']))
    # 이름표(층 850)
    dr = ImageDraw.Draw(S.canvas)
    for u, h in labels:
        x, y = S.scr(u['x'], u['y'] - h - 6)
        dr.text((x, y), u['name'], font=font(round(22 * Z)), fill=(255, 233, 168) if u['key'] == 'guanyu' else (214, 255, 217) if u['side'] == 'left' else (214, 228, 255), anchor='mb', stroke_width=3, stroke_fill=(26, 18, 12))
    # fx 표본(층 900, ADD) — fx.js 의 화면 px 크기 그대로
    if fx:
        spk, sw, dust, ring, imp = [load('battle/fx/%s.png' % n) for n in ('spark', 'slash_white', 'dust', 'ring', 'impact')]
        for u in units:
            if u['state'] == 'attack' and u['kind'] not in ('bow', 'general') and u['id'] % 2:
                S.put(spk, u['x'] + u['facing'] * 30, u['y'] - 18, ox=0.5, oy=0.5, sx=40 / 64, add=True, angle=u['id'] * 37)
        g = next((u for u in units if u.get('key') == 'guanyu'), None)
        if g:
            S.put(sw, g['x'] + 26, g['y'] - 34, ox=0.5, oy=0.5, sx=110 / 256, add=True, angle=-6)
            S.put(spk, g['x'] + 52, g['y'] - 30, ox=0.5, oy=0.5, sx=70 / 64, add=True, angle=20)
        x_ = next((u for u in units if u.get('key') == 'xiahoudun'), None)
        if x_:
            S.put(ring, x_['x'], x_['y'], ox=0.5, oy=0.5, sx=240 * 1.4 / RING_FILL / 256, sy=240 * 1.4 / RING_FILL / 256 * 0.5, add=True, alpha=0.6)
    for i in range(-1, 5): S.put(fog, i * 1024 + 700, FOG['frontY'], oy=0.5, sy=FOG['frontScaleY'], alpha=FOG['frontAlpha'])
    # 비네트(HUD 씬 맨 아래 — 줌 영향 없음). BootScene.fbVignette 와 같은 곡선
    yy, xx = np.mgrid[0:H, 0:W]
    r = np.hypot((xx - W / 2) / (W / 2), (yy - H / 2) / (H / 2))
    t = np.clip((r - 0.62) / (1.42 - 0.62), 0, 1)
    va = np.where(t < 0.55, t / 0.55 * 0.16, 0.16 + (t - 0.55) / 0.45 * (0.45 - 0.16))
    vg = np.zeros((H, W, 4), 'uint8'); vg[..., 0] = 8; vg[..., 1] = 5; vg[..., 2] = 12; vg[..., 3] = (va * 255).astype('uint8')
    S.canvas = Image.alpha_composite(S.canvas, Image.fromarray(vg, 'RGBA'))
    if hud and HUD: draw_hud(S.canvas)
    S.canvas.convert('RGB').save(out)
    print(out, S.canvas.size, 'scrollX %.0f scrollY %.0f zoom %.2f units %d' % (S.scrollX, S.scrollY, Z, len(units)))

def nine(img, w, h, c):
    out = Image.new('RGBA', (w, h), (0, 0, 0, 0)); iw, ih = img.size
    xs = [(0, c, 0, c), (c, iw - c, c, w - c), (iw - c, iw, w - c, w)]
    ys = [(0, c, 0, c), (c, ih - c, c, h - c), (ih - c, ih, h - c, h)]
    for sx0, sx1, dx0, dx1 in xs:
        for sy0, sy1, dy0, dy1 in ys:
            if dx1 > dx0 and dy1 > dy0:
                out.paste(img.crop((sx0, sy0, sx1, sy1)).resize((dx1 - dx0, dy1 - dy0)), (dx0, dy0))
    return out

def draw_hud(im):
    """BattleHud.HUD_LAYOUT 그대로(9-slice·폰트는 근사)"""
    L = HUD; d = ImageDraw.Draw(im, 'RGBA')
    frame = load('battle/hud/bar_frame.png'); pframe = load('battle/hud/portrait_frame.png'); medal = load('battle/hud/medallion.png')
    def bar(x, y, w, h, inset, color, left, k, corner):
        x0 = x if left else x - w
        d.rectangle([x0 + 2, y - h / 2 + 2, x0 + w - 2, y + h / 2 - 2], fill=(14, 10, 8, 184))
        iw, ih = w - inset * 2, h - inset * 2
        fx0 = x0 + inset if left else x0 + inset + iw * (1 - k)
        d.rectangle([fx0, y - ih / 2, fx0 + iw * k, y + ih / 2], fill=color + (255,))
        sh = max(3, round(ih * 0.3)); sy = y - ih / 2 + max(2, ih * 0.18)
        d.rectangle([fx0, sy - sh / 2, fx0 + iw * k, sy + sh / 2], fill=(255, 255, 255, 76))
        if frame: im.alpha_composite(nine(frame, int(w), int(h), int(corner)), (int(x0), int(y - h / 2)))
    B, G, Sk, T = L['bar'], L['gen'], L['skill'], L['tactic']
    bar(B['margin'], B['y'], B['w'], B['h'], B['inset'], SIDE['left'], True, 0.82, B['corner'])
    bar(W - B['margin'], B['y'], B['w'], B['h'], B['inset'], SIDE['right'], False, 0.74, B['corner'])
    d.text((B['margin'] + 14, B['y']), '아군 100', font=font(24), fill=(255, 243, 214), anchor='lm', stroke_width=3, stroke_fill=(26, 18, 12))
    d.text((W - B['margin'] - 14, B['y']), '적군 90', font=font(24), fill=(255, 243, 214), anchor='rm', stroke_width=3, stroke_fill=(26, 18, 12))
    d.text((W / 2, B['y'] + 6), '0:24', font=font(40), fill=(246, 233, 201), anchor='mm', stroke_width=3, stroke_fill=(42, 26, 12))
    names = {'left': [('관우', 'guanyu'), ('장비', 'zhangfei')], 'right': [('하후돈', 'xiahoudun'), ('전위', 'dianwei')]}
    for side in ('left', 'right'):
        left = side == 'left'
        sx = (lambda x: x) if left else (lambda x: W - x)
        for i, (nm, key) in enumerate(names[side]):
            bx = B['margin'] + i * (G['blockW'] + G['gap']); y = G['y']
            px = sx(bx + G['frameW'] / 2)
            p = load('battle/hud/portrait_%s.png' % key) or load('ui/portrait_placeholder.png')
            p = p.resize((int(G['portraitW']), int(G['portraitH'])), Image.LANCZOS)
            im.alpha_composite(p, (int(px - G['portraitW'] / 2), int(y - G['portraitH'] / 2)))
            if pframe:
                im.alpha_composite(pframe.resize((int(G['frameW']), int(G['frameH'])), Image.LANCZOS), (int(px - G['frameW'] / 2), int(y - G['frameH'] / 2)))
                d.rectangle([px - (G['frameW'] - 22) / 2, y + G['frameH'] / 2 - 5, px + (G['frameW'] - 22) / 2, y + G['frameH'] / 2 - 1], fill=SIDE[side] + (255,))
            tx = sx(bx + G['textX'])
            d.text((tx, y + G['nameDy']), nm, font=font(30), fill=(255, 233, 168) if (left and i == 0) else (246, 233, 201), anchor='lm' if left else 'rm', stroke_width=3, stroke_fill=(42, 26, 12))
            bar(tx, y + G['barDy'], G['barW'], G['barH'], G['inset'], (0xd9, 0x4a, 0x3a), left, 0.66, G['corner'])
    cx, cy = W - Sk['cx'], H - Sk['cy']
    d.ellipse([cx - Sk['r'], cy - Sk['r'], cx + Sk['r'], cy + Sk['r']], fill=(26, 18, 12, 235))
    icon = load('battle/hud/skill_guanyu.png')
    if icon: im.alpha_composite(icon.resize((int(Sk['icon']), int(Sk['icon'])), Image.LANCZOS), (int(cx - Sk['icon'] / 2), int(cy - 2 - Sk['icon'] / 2)))
    if medal: im.alpha_composite(medal.resize((int(Sk['medallion']), int(Sk['medallion'])), Image.LANCZOS), (int(cx - Sk['medallion'] / 2), int(cy - Sk['medallion'] / 2)))
    r, aw = Sk['arcR'], Sk.get('arcW', 9)
    ov = Image.new('RGBA', im.size, (0, 0, 0, 0)); od = ImageDraw.Draw(ov)
    od.ellipse([cx - r - (aw + 1) / 2, cy - r - (aw + 1) / 2, cx + r + (aw + 1) / 2, cy + r + (aw + 1) / 2], outline=(14, 10, 8, 140), width=int(aw + 1))
    od.arc([cx - r - aw / 2, cy - r - aw / 2, cx + r + aw / 2, cy + r + aw / 2], -90, 150, fill=(0xd9, 0xb2, 0x5a, 255), width=int(aw))
    im.alpha_composite(ov)
    d = ImageDraw.Draw(im, 'RGBA')
    d.text((cx, cy + Sk['medallion'] / 2 - 24), '청룡참', font=font(24), fill=(246, 233, 201), anchor='mm', stroke_width=4, stroke_fill=(42, 26, 12))
    hit = Sk['medallion']
    total = 3 * T['w'] + 2 * T['gap']; x0 = W - B['margin'] - total; ty = cy - hit / 2 - 12 - T['h'] / 2
    btn = load('ui/button.png')
    for i, lab in enumerate(['돌격', '대기', '후퇴']):
        bx = x0 + i * (T['w'] + T['gap'])
        if btn: im.alpha_composite(nine(btn, int(T['w']), int(T['h']), 32), (int(bx), int(ty - T['h'] / 2)))
        d.text((bx + T['w'] / 2, ty), lab, font=font(26), fill=(247, 233, 201), anchor='mm', stroke_width=2, stroke_fill=(42, 26, 12))

if __name__ == '__main__':
    rnd = random.Random(7)
    cx = float(opts.get('cx', 1400))
    if 'camp' in opts:
        render(float(opts.get('cx', 640)), camp_units(), args[0] if args else os.path.join(HERE, 'preview_camp.png'), hud='nohud' not in opts, fx=False)
    else:
        render(cx, make_units(cx, rnd), args[0] if args else os.path.join(HERE, 'preview.png'), hud='nohud' not in opts)
        if not args: render(640, camp_units(), os.path.join(HERE, 'preview_camp.png'), hud=False, fx=False)
