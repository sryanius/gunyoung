# hud_mock.py — 3차 HUD(조종 선택·자동/수동·배속) 배치를 상자로 그려 보는 목업 (브라우저 대체, 개발용).
#   python assets/raw/battle3/control/hud_mock.py            → hud_mock_1280.png · hud_mock_1558.png (+ 폰 0.54배 _phone.png)
# HUD_LAYOUT 은 src/battle/BattleHud.js 에서 node 로 뽑아 온다(수치를 고치면 그림이 따라온다). 겹침도 숫자로 검사한다.
import json, subprocess, sys, os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..'))
HERE = os.path.dirname(__file__)
js = ("globalThis.Phaser={Scene:class{},Scenes:{Events:{}},BlendModes:{}};"
      "import('file:///" + ROOT.replace('\\', '/') + "/src/battle/BattleHud.js').then(m=>console.log(JSON.stringify(m.HUD_LAYOUT)))")
L = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', js], cwd=ROOT).decode('utf-8'))
H = 720
HUD_TOP = 158

def font(px):
    for p in (r'C:\Windows\Fonts\malgunbd.ttf', r'C:\Windows\Fonts\malgun.ttf'):
        if os.path.exists(p):
            return ImageFont.truetype(p, px)
    return ImageFont.load_default()

def boxes(W):
    B, G, S, T, A, SP, SL = L['bar'], L['gen'], L['skill'], L['tactic'], L['auto'], L['speed'], L['sel']
    out = []   # (name, x0, y0, x1, y1, color, label, fontpx)
    out.append(('barL', B['margin'], B['y'] - B['h'] / 2, B['margin'] + B['w'], B['y'] + B['h'] / 2, (58, 166, 85), '아군 122', 24))
    out.append(('barR', W - B['margin'] - B['w'], B['y'] - B['h'] / 2, W - B['margin'], B['y'] + B['h'] / 2, (59, 111, 214), '적군 122', 24))
    out.append(('time', W / 2 - 44, B['y'] + 6 - 22, W / 2 + 44, B['y'] + 6 + 22, (90, 80, 60), '0:42', 40))
    out.append(('speed', W / 2 + SP['dx'] - SP['w'] / 2, SP['y'] - SP['h'] / 2, W / 2 + SP['dx'] + SP['w'] / 2, SP['y'] + SP['h'] / 2, (150, 110, 40), '×2', 30))
    names = {'left': ['관우', '장비'], 'right': ['하후돈', '전위']}
    for side in ('left', 'right'):
        for i in range(2):
            bx = B['margin'] + i * (G['blockW'] + G['gap'])
            sx = (lambda x: x) if side == 'left' else (lambda x: W - x)
            px = sx(bx + G['frameW'] / 2)
            y = G['y']
            out.append((f'frame_{side}{i}', px - G['frameW'] / 2, y - G['frameH'] / 2, px + G['frameW'] / 2, y + G['frameH'] / 2, (120, 100, 60), '', 0))
            tx = sx(bx + G['textX'])
            x0, x1 = (tx, tx + G['barW']) if side == 'left' else (tx - G['barW'], tx)
            out.append((f'hp_{side}{i}', x0, y + G['barDy'] - G['barH'] / 2, x1, y + G['barDy'] + G['barH'] / 2, (199, 59, 46), '', 0))
            nw = 30 * len(names[side][i])
            nx0, nx1 = (tx, tx + nw) if side == 'left' else (tx - nw, tx)
            out.append((f'name_{side}{i}', nx0, y + G['nameDy'] - 15, nx1, y + G['nameDy'] + 15, (70, 60, 40), names[side][i], 30))
            if side == 'left':
                out.append((f'zone_{i}', bx, y - G['frameH'] / 2, bx + G['blockW'], y + G['frameH'] / 2, None, '', 0))
                if i == 0:   # 고른 무장: 금색 테 + 꼬리표
                    p = SL['pad']
                    out.append(('sel', px - G['frameW'] / 2 - p, y - G['frameH'] / 2 - p, px + G['frameW'] / 2 + p, y + G['frameH'] / 2 + p, 'gold', '', 0))
                    ty = y + G['frameH'] / 2 + SL['tagDy']
                    out.append(('tag', px - SL['tagW'] / 2, ty - SL['tagH'] / 2, px + SL['tagW'] / 2, ty + SL['tagH'] / 2, (26, 18, 12), '조종', SL['font']))
    cx, cy = W - S['cx'], H - S['cy']
    hit = S['medallion']
    out.append(('skill', cx - hit / 2, cy - hit / 2, cx + hit / 2, cy + hit / 2, (110, 80, 30), '포효', 30))
    total = 3 * T['w'] + 2 * T['gap']
    x0 = W - B['margin'] - total + T['w'] / 2
    ty = cy - hit / 2 - 12 - T['h'] / 2
    for i, lab in enumerate(['돌격', '대기', '후퇴']):
        x = x0 + i * (T['w'] + T['gap'])
        out.append((f'tactic{i}', x - T['w'] / 2, ty - T['h'] / 2, x + T['w'] / 2, ty + T['h'] / 2, (100, 70, 40), lab, 26))
    ax = x0 - T['w'] / 2 - A['gap'] - A['w'] / 2
    out.append(('auto', ax - A['w'] / 2, ty - A['h'] / 2, ax + A['w'] / 2, ty + A['h'] / 2, (150, 110, 40), '자동', 26))
    return out

def overlap(a, b):
    return a[1] < b[3] and b[1] < a[3] and a[2] < b[4] and b[2] < a[4]

fails = 0
for W in (1280, 1558, 2400):
    bs = boxes(W)
    img = Image.new('RGB', (W, H), (60, 72, 60))
    d = ImageDraw.Draw(img, 'RGBA')
    d.rectangle([0, 400, W, H], fill=(120, 104, 72))
    d.line([W / 2, HUD_TOP, W / 2, H], fill=(255, 255, 255, 90), width=2)      # 조이스틱 영역(왼쪽 반 · HUD_TOP 아래)
    d.line([0, HUD_TOP, W / 2, HUD_TOP], fill=(255, 255, 255, 90), width=2)
    for name, x0, y0, x1, y1, col, label, fpx in bs:
        if col is None:
            d.rectangle([x0, y0, x1, y1], outline=(255, 255, 255, 120), width=1)
        elif col == 'gold':
            d.rectangle([x0, y0, x1, y1], outline=(255, 210, 74, 255), width=L['sel']['line'])
        else:
            d.rectangle([x0, y0, x1, y1], fill=col + (235,), outline=(20, 14, 8, 255), width=2)
        if label:
            f = font(fpx)
            tw = d.textlength(label, font=f)
            d.text(((x0 + x1) / 2 - tw / 2, (y0 + y1) / 2 - fpx * 0.62), label, font=f, fill=(255, 240, 210, 255))
    # 겹침 검사 — 새 버튼(speed·auto)·꼬리표가 다른 HUD 상자와 겹치는가(꼬리표는 자기 초상 틀 안이 정상), 조이스틱 영역을 침범하는가
    solid = [b for b in bs if b[5] is not None and b[5] != 'gold']
    for nb in [b for b in solid if b[0] in ('speed', 'auto')]:
        for o in solid:
            if o is nb or not overlap(nb, o):
                continue
            fails += 1
            print(f'  FAIL W={W}: {nb[0]} 가 {o[0]} 와 겹침')
    auto = next(b for b in bs if b[0] == 'auto')
    if auto[1] < W / 2:
        fails += 1
        print(f'  FAIL W={W}: 자동 버튼 왼쪽 끝 {auto[1]} 이 조이스틱 반(<{W / 2}) 안')
    speed = next(b for b in bs if b[0] == 'speed')
    if speed[4] > HUD_TOP:
        fails += 1
        print(f'  FAIL W={W}: 배속 버튼 아래 끝 {speed[4]} > HUD_TOP')
    print(f'  W={W}: 배속 x {speed[1]:.0f}~{speed[3]:.0f} y {speed[2]:.0f}~{speed[4]:.0f} · 자동 x {auto[1]:.0f}~{auto[3]:.0f} (화면 반 {W / 2:.0f}) · 폰 0.54배 → 배속 {(speed[3] - speed[1]) * 0.54:.0f}×{(speed[4] - speed[2]) * 0.54:.0f}px · 자동 {(auto[3] - auto[1]) * 0.54:.0f}×{(auto[4] - auto[2]) * 0.54:.0f}px · 꼬리표 글자 {L["sel"]["font"] * 0.54:.1f}px')
    if W != 2400:
        img.save(os.path.join(HERE, f'hud_mock_{W}.png'))
        if W == 1558:
            img.resize((844, 390), Image.LANCZOS).save(os.path.join(HERE, 'hud_mock_1558_phone.png'))
print('PASS' if fails == 0 else f'FAIL {fails}')
sys.exit(0 if fails == 0 else 1)
