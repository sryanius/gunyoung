# mock_frames.py — dump_frames.mjs 가 떨군 frames.json 을 Pillow 로 합성해 컷신 프레임을 눈으로 본다(브라우저 대체, 근사).
#   배경은 전장 스크린샷이 있으면 그것, 없으면 회색. 폰트는 맑은 고딕(붓글씨 폰트는 근사). ADD·마스크·tintFill·crop·회전·origin 을 흉내 낸다.
#   usage: python mock_frames.py  → sheet.png (+ 장면별 shot_<id>.png)
import json, math, os, sys
from PIL import Image, ImageDraw, ImageFont, ImageChops

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..', '..', '..'))
ASSETS = os.path.join(ROOT, 'assets')
D = json.load(open(os.path.join(HERE, 'frames.json'), encoding='utf-8'))
W, H = D['W'], D['H']
SS = 1  # 슈퍼샘플 없음

def hex2rgb(c):
    return ((c >> 16) & 255, (c >> 8) & 255, c & 255)

def css2rgb(s):
    s = s.lstrip('#')
    return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))

_tex_cache = {}
def load_tex(key):
    if key in _tex_cache:
        return _tex_cache[key]
    info = D['tex'].get(key)
    im = None
    if info is None:
        im = Image.new('RGBA', (64, 64), (255, 255, 255, 255))
    elif info.get('grad'):
        g = D['grads'][info['grad']]
        w, h = g['w'], g['h']
        im = Image.new('RGBA', (w, h))
        px = im.load()
        stops = g['stops']
        horiz = g['dir'][2] != g['dir'][0]
        n = w if horiz else h
        def parse(c):
            if c.startswith('rgba'):
                v = c[5:-1].split(',')
                return (int(v[0]), int(v[1]), int(v[2]), int(float(v[3]) * 255))
            return css2rgb(c) + (255,)
        for i in range(n):
            k = i / max(1, n - 1)
            for a, b in zip(stops, stops[1:]):
                if a[0] <= k <= b[0]:
                    u = (k - a[0]) / max(1e-6, b[0] - a[0])
                    ca, cb = parse(a[1]), parse(b[1])
                    col = tuple(int(ca[j] + (cb[j] - ca[j]) * u) for j in range(4))
                    break
            for j in range(h if horiz else w):
                if horiz: px[i, j] = col
                else: px[j, i] = col
    elif info.get('file'):
        im = Image.open(os.path.join(ASSETS, info['file'])).convert('RGBA')
    elif info.get('eyesOf'):
        # 눈 띠 그림이 아직 없다 → 주 일러스트에서 얼굴 둘레를 4:1 로 잘라 흉내(목업 전용)
        src = Image.open(os.path.join(ASSETS, info['eyesOf'])).convert('RGBA')
        sw, sh = src.size
        cw = int(sw * 0.62); chh = cw // 4
        cx, cy = int(sw * 0.45), int(sh * 0.245)
        box = (max(0, cx - cw // 2), max(0, cy - chh // 2), max(0, cx - cw // 2) + cw, max(0, cy - chh // 2) + chh)
        crop = src.crop(box).resize((1024, 256), Image.LANCZOS)
        bg = Image.new('RGBA', (1024, 256), (18, 16, 22, 255)); bg.alpha_composite(crop); im = bg
    else:
        im = Image.new('RGBA', (info['w'], info['h']), (255, 255, 255, 255))
    _tex_cache[key] = im
    return im

def affine_paste(layer_size, src, x, y, angle, sx, sy, ox, oy, flipx=False, flipy=False):
    """src 를 (x,y) 에 origin(ox,oy)·배율·각도로 놓은 RGBA 레이어"""
    if flipx: src = src.transpose(Image.FLIP_LEFT_RIGHT)
    if flipy: src = src.transpose(Image.FLIP_TOP_BOTTOM)
    w, h = src.size
    if abs(sx) < 1e-4 or abs(sy) < 1e-4:
        return Image.new('RGBA', layer_size, (0, 0, 0, 0))
    a = math.radians(angle)
    ca, sa = math.cos(a), math.sin(a)
    # 출력(u,v) → 입력(i,j):  p = R^-1 (q - pos); i = p.x/sx + ox*w; j = p.y/sy + oy*h
    m = (ca / sx, sa / sx, -(ca * x + sa * y) / sx + ox * w,
         -sa / sy, ca / sy, (sa * x - ca * y) / sy + oy * h)
    return src.transform(layer_size, Image.AFFINE, m, resample=Image.BILINEAR)

def band_mask(mk):
    m = Image.new('L', (W, H), 0)
    for c in mk['cmds']:
        if c[0] != 'rect': continue
        _, col, al, rx, ry, rw, rh = c
        a = math.radians(mk['angle']); ca, sa = math.cos(a), math.sin(a)
        pts = []
        for (px, py) in [(rx, ry), (rx + rw, ry), (rx + rw, ry + rh), (rx, ry + rh)]:
            px *= mk['scaleX']; py *= mk['scaleY']
            pts.append((mk['x'] + px * ca - py * sa, mk['y'] + px * sa + py * ca))
        ImageDraw.Draw(m).polygon(pts, fill=255)
    return m

def font(size):
    for f in ['C:/Windows/Fonts/malgunbd.ttf', 'C:/Windows/Fonts/malgun.ttf']:
        if os.path.exists(f): return ImageFont.truetype(f, size)
    return ImageFont.load_default()

def compose(layer, base, alpha, add):
    if alpha < 1:
        a = layer.getchannel('A').point(lambda v: int(v * alpha))
        layer.putalpha(a)
    if add:
        rgb = Image.new('RGB', base.size, (0, 0, 0))
        rgb.paste(layer.convert('RGB'), mask=layer.getchannel('A'))
        return ImageChops.add(base.convert('RGB'), rgb).convert('RGBA')
    base.alpha_composite(layer)
    return base

def background():
    for rel in ['tools/shots/battle2_clash.png', 'tools/shots/battle_clash.png', 'assets/raw/battle2/preview.png']:
        p = os.path.join(ROOT, rel)
        if os.path.exists(p):
            im = Image.open(p).convert('RGBA')
            k = max(W / im.width, H / im.height)
            im = im.resize((int(im.width * k) + 1, int(im.height * k) + 1), Image.LANCZOS).crop((0, 0, W, H))
            return im
    return Image.new('RGBA', (W, H), (120, 130, 110, 255))

BG = background()

def render(shot):
    base = BG.copy()
    for o in sorted([o for o in shot['objs'] if o['visible'] and o['alpha'] > 0.003], key=lambda o: o['depth']):
        kind = o['kind']
        layer = None
        if kind == 'rect':
            src = Image.new('RGBA', (max(1, int(o['width'])), max(1, int(o['height']))), hex2rgb(o['color']) + (int(255 * (o['fillAlpha'] if o['fillAlpha'] is not None else 1)),))
            layer = affine_paste((W, H), src, o['x'], o['y'], o['angle'], o['scaleX'], o['scaleY'], o['originX'], o['originY'])
        elif kind == 'image':
            src = load_tex(o['key']).copy()
            if o['crop']:
                cx, cy, cw, ch = o['crop']
                keep = Image.new('RGBA', src.size, (0, 0, 0, 0))
                box = (int(cx), int(cy), int(cx + cw), int(cy + ch))
                keep.paste(src.crop(box), box[:2]); src = keep
            if o['tint'] is not None:
                r, g, b = hex2rgb(o['tint'])
                if o['tintFill']:
                    fill = Image.new('RGBA', src.size, (r, g, b, 255)); fill.putalpha(src.getchannel('A')); src = fill
                else:
                    src = ImageChops.multiply(src, Image.new('RGBA', src.size, (r, g, b, 255)))
            layer = affine_paste((W, H), src, o['x'], o['y'], o['angle'], o['scaleX'], o['scaleY'], o['originX'], o['originY'], o['flipX'], o['flipY'])
        elif kind == 'graphics':
            size = 1400
            src = Image.new('RGBA', (size, size), (0, 0, 0, 0))
            for c in o['cmds']:
                tmp = Image.new('RGBA', (size, size), (0, 0, 0, 0))
                _, col, al, ex, ey, ew, eh = c
                box = [size / 2 + ex - ew / 2, size / 2 + ey - eh / 2, size / 2 + ex + ew / 2, size / 2 + ey + eh / 2]
                if c[0] == 'ellipse': ImageDraw.Draw(tmp).ellipse(box, fill=hex2rgb(col) + (int(255 * al),))
                else: ImageDraw.Draw(tmp).rectangle([size / 2 + ex, size / 2 + ey, size / 2 + ex + ew, size / 2 + ey + eh], fill=hex2rgb(col) + (int(255 * al),))
                src.alpha_composite(tmp)
            layer = affine_paste((W, H), src, o['x'], o['y'], o['angle'], o['scaleX'], o['scaleY'], 0.5, 0.5)
        elif kind == 'text':
            f = font(int(o['fontSize'] * 0.82))   # 붓글씨 폰트는 같은 px 에서 맑은 고딕보다 작게 나온다 — 근사
            tw, th = int(o['width']), int(o['height'])
            src = Image.new('RGBA', (tw, th), (0, 0, 0, 0))
            d = ImageDraw.Draw(src)
            sw = int(o['strokeThickness'] / 2)
            fillc = css2rgb(o['textColor']) + (255,)
            d.text((tw / 2, th / 2), o['text'], font=f, anchor='mm', fill=fillc, stroke_width=sw, stroke_fill=css2rgb(o['stroke']) + (255,))
            if o.get('fill'):   # 세로 그라데이션 fill
                g = o['fill']; stops = g['stops']
                grad = Image.new('RGBA', (tw, th))
                gp = grad.load()
                for yy in range(th):
                    k = min(1, max(0, (yy - g['y0']) / max(1, g['y1'] - g['y0'])))
                    col = css2rgb(stops[-1][1])
                    for a, b in zip(stops, stops[1:]):
                        if a[0] <= k <= b[0]:
                            u = (k - a[0]) / max(1e-6, b[0] - a[0]); ca_, cb_ = css2rgb(a[1]), css2rgb(b[1])
                            col = tuple(int(ca_[j] + (cb_[j] - ca_[j]) * u) for j in range(3)); break
                    for xx in range(tw): gp[xx, yy] = col + (255,)
                glyph = Image.new('L', (tw, th), 0)
                ImageDraw.Draw(glyph).text((tw / 2, th / 2), o['text'], font=f, anchor='mm', fill=255)
                src.paste(grad, mask=glyph)
            layer = affine_paste((W, H), src, o['x'], o['y'], o['angle'], o['scaleX'], o['scaleY'], o['originX'], o['originY'])
        if layer is None: continue
        if o['mask']:
            m = band_mask(o['mask'])
            layer.putalpha(ImageChops.multiply(layer.getchannel('A'), m))
        base = compose(layer, base, o['alpha'], o['blend'] == 1)
    return base

shots = []
for s in D['shots']:
    im = render(s).convert('RGB')
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, 420, 34], fill=(0, 0, 0))
    d.text((8, 4), f"{s['id']}  t={s['t']}ms  {s['mode']} {s['duration']}ms", font=font(22), fill=(255, 255, 255))
    im.save(os.path.join(HERE, f"shot_{s['id']}.png"))
    shots.append(im)

cols = 3
tw, th = W // 2, H // 2
rows = (len(shots) + cols - 1) // cols
sheet = Image.new('RGB', (tw * cols, th * rows), (20, 20, 20))
for i, im in enumerate(shots):
    sheet.paste(im.resize((tw, th), Image.LANCZOS), ((i % cols) * tw, (i // cols) * th))
sheet.save(os.path.join(HERE, 'sheet.png'))
print('sheet.png', sheet.size, len(shots), 'shots')
