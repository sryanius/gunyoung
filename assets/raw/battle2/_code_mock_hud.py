# -*- coding: utf-8 -*-
"""HUD 배치 목업 — BattleHud.HUD_LAYOUT 수치 그대로 Pillow 로 얹는다(9-slice·폰트는 근사). 그림이 있으면 쓰고 없으면 폴백 도형.
usage: python _code_mock_hud.py in.png out.png   (in = _code_mock.py 결과, 폭은 그 그림에서)"""
import sys, os
from PIL import Image, ImageDraw, ImageFont
ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
A = os.path.join(ROOT, 'assets')
im = Image.open(sys.argv[1]).convert('RGBA'); W, H = im.size
d = ImageDraw.Draw(im, 'RGBA')
def font(sz):
    for f in (r'C:\Windows\Fonts\malgunbd.ttf', r'C:\Windows\Fonts\malgun.ttf'):
        if os.path.exists(f): return ImageFont.truetype(f, sz)
    return ImageFont.load_default()
def load(rel):
    p = os.path.join(A, rel); return Image.open(p).convert('RGBA') if os.path.exists(p) else None
def nine(img, w, h, c):
    out = Image.new('RGBA', (w, h), (0, 0, 0, 0)); iw, ih = img.size
    xs = [(0, c, 0, c), (c, iw - c, c, w - c), (iw - c, iw, w - c, w)]
    ys = [(0, c, 0, c), (c, ih - c, c, h - c), (ih - c, ih, h - c, h)]
    for sx0, sx1, dx0, dx1 in xs:
        for sy0, sy1, dy0, dy1 in ys:
            if dx1 > dx0 and dy1 > dy0:
                out.paste(img.crop((sx0, sy0, sx1, sy1)).resize((dx1 - dx0, dy1 - dy0)), (dx0, dy0))
    return out
L = dict(bar=dict(w=380, h=40, y=28, margin=24, inset=8, corner=12),
         gen=dict(y=103, portraitW=72, portraitH=90, frameW=84, frameH=102, blockW=240, gap=10, textX=92, nameDy=-27, barDy=19, barW=146, barH=32, inset=8, corner=12),
         skill=dict(r=60, cx=104, cy=104, medallion=164, icon=72, arcR=50), tactic=dict(w=150, h=72, gap=8))
SIDE = {'left': (0x3a, 0xa6, 0x55), 'right': (0x3b, 0x6f, 0xd6)}
frame = load('battle/hud/bar_frame.png'); pframe = load('battle/hud/portrait_frame.png'); medal = load('battle/hud/medallion.png')
def bar(x, y, w, h, inset, color, left, k):
    x0 = x if left else x - w
    d.rectangle([x0 + 2, y - h / 2 + 2, x0 + w - 2, y + h / 2 - 2], fill=(14, 10, 8, 184))
    iw, ih = w - inset * 2, h - inset * 2
    fx0 = x0 + inset if left else x0 + inset + iw * (1 - k)
    d.rectangle([fx0, y - ih / 2, fx0 + iw * k, y + ih / 2], fill=color + (255,))
    d.rectangle([fx0, y - ih / 2 + max(2, ih * 0.18) - max(3, round(ih * 0.3)) / 2, fx0 + iw * k, y - ih / 2 + max(2, ih * 0.18) + max(3, round(ih * 0.3)) / 2], fill=(255, 255, 255, 76))
    if frame: im.alpha_composite(nine(frame, w, h, 12), (int(x0), int(y - h / 2)))
    else: d.rectangle([x0, y - h / 2, x0 + w, y + h / 2], outline=(0xd9, 0xb2, 0x5a, 216), width=2)
B = L['bar']; G = L['gen']
bar(B['margin'], B['y'], B['w'], B['h'], B['inset'], SIDE['left'], True, 0.82)
bar(W - B['margin'], B['y'], B['w'], B['h'], B['inset'], SIDE['right'], False, 0.74)
d.text((B['margin'] + 14, B['y']), '아군 100', font=font(24), fill=(255, 243, 214), anchor='lm', stroke_width=3, stroke_fill=(26, 18, 12))
d.text((W - B['margin'] - 14, B['y']), '적군 90', font=font(24), fill=(255, 243, 214), anchor='rm', stroke_width=3, stroke_fill=(26, 18, 12))
d.text((W / 2, B['y'] + 6), '0:24', font=font(40), fill=(246, 233, 201), anchor='mm', stroke_width=3, stroke_fill=(42, 26, 12))
names = {'left': [('관우', 'guanyu'), ('장비', 'zhangfei')], 'right': [('하후돈', 'xiahoudun'), ('전위', 'dianwei')]}
ph = load('ui/portrait_placeholder.png')
for side in ('left', 'right'):
    left = side == 'left'
    sx = (lambda x: x) if left else (lambda x: W - x)
    for i, (nm, key) in enumerate(names[side]):
        bx = B['margin'] + i * (G['blockW'] + G['gap']); y = G['y']
        px = sx(bx + G['frameW'] / 2)
        p = load('battle/hud/portrait_%s.png' % key) or ph
        p = p.resize((G['portraitW'], G['portraitH']))
        im.alpha_composite(p, (int(px - G['portraitW'] / 2), int(y - G['portraitH'] / 2)))
        if pframe:
            im.alpha_composite(pframe.resize((G['frameW'], G['frameH'])), (int(px - G['frameW'] / 2), int(y - G['frameH'] / 2)))
            d.rectangle([px - (G['frameW'] - 22) / 2, y + G['frameH'] / 2 - 5, px + (G['frameW'] - 22) / 2, y + G['frameH'] / 2 - 1], fill=SIDE[side] + (255,))
        else:
            d.rectangle([px - G['portraitW'] / 2 - 2, y - G['portraitH'] / 2 - 2, px + G['portraitW'] / 2 + 2, y + G['portraitH'] / 2 + 2], outline=SIDE[side] + (255,), width=3)
        tx = sx(bx + G['textX'])
        d.text((tx, y + G['nameDy']), nm, font=font(30), fill=(255, 233, 168) if (left and i == 0) else (246, 233, 201), anchor='lm' if left else 'rm', stroke_width=3, stroke_fill=(42, 26, 12))
        bar(tx, y + G['barDy'], G['barW'], G['barH'], G['inset'], (0xd9, 0x4a, 0x3a), left, 0.66)
d.line([0, 158, W, 158], fill=(255, 0, 0, 90))   # BattleScene.HUD_TOP
S = L['skill']; cx, cy = W - S['cx'], H - S['cy']
d.ellipse([cx - S['r'], cy - S['r'], cx + S['r'], cy + S['r']], fill=(26, 18, 12, 235))
icon = load('battle/hud/skill_guanyu.png')
if icon: im.alpha_composite(icon.resize((S['icon'], S['icon'])), (int(cx - S['icon'] / 2), int(cy - 2 - S['icon'] / 2)))
if medal: im.alpha_composite(medal.resize((S['medallion'], S['medallion'])), (int(cx - S['medallion'] / 2), int(cy - S['medallion'] / 2)))
else: d.ellipse([cx - S['r'], cy - S['r'], cx + S['r'], cy + S['r']], outline=(0x8a, 0x6a, 0x2f, 255), width=4)
d.arc([cx - S['arcR'], cy - S['arcR'], cx + S['arcR'], cy + S['arcR']], 0, 360, fill=(14, 10, 8, 140), width=8)
d.arc([cx - S['arcR'], cy - S['arcR'], cx + S['arcR'], cy + S['arcR']], -90, 150, fill=(0xd9, 0xb2, 0x5a, 255), width=7)
d.text((cx, cy + (S['medallion'] / 2 - 24 if icon else 0)), '청룡참', font=font(24 if icon else 30), fill=(246, 233, 201), anchor='mm', stroke_width=4, stroke_fill=(42, 26, 12))
T = L['tactic']; hit = S['medallion'] if medal else S['r'] * 2 + 8
total = 3 * T['w'] + 2 * T['gap']; x0 = W - B['margin'] - total; ty = cy - hit / 2 - 12 - T['h'] / 2
btn = load('ui/button.png')
for i, lab in enumerate(['돌격', '대기', '후퇴']):
    bx = x0 + i * (T['w'] + T['gap'])
    if btn: im.alpha_composite(nine(btn, T['w'], T['h'], 32), (int(bx), int(ty - T['h'] / 2)))
    d.text((bx + T['w'] / 2, ty), lab, font=font(26), fill=(247, 233, 201), anchor='mm', stroke_width=2, stroke_fill=(42, 26, 12))
im.convert('RGB').save(sys.argv[2]); print(sys.argv[2])
