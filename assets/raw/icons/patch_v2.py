# -*- coding: utf-8 -*-
"""draw_icons.py v1 → v2 좌표 수정 패치(재현용 기록)"""
import re, os
p = os.path.join(os.path.dirname(__file__), 'draw_icons.py')
s = open(p, encoding='utf-8').read()
n0 = s

def rep(a, b):
    global s
    assert a in s, a[:60]
    s = s.replace(a, b)

# gold: 돔 축소, 몸통 조금 아래로
rep('''    dome = E((70, 66, 186, 166))
    pts = []
    for t in range(0, 181, 5):
        a = math.radians(180 + t); pts.append((128 + 100 * math.cos(a), 124 - 78 * math.sin(a)))
    rim = [(x, 124 + 30 * (1 - ((x - 128) / 100) ** 2)) for x in range(228, 27, -5)]''',
'''    dome = E((84, 84, 172, 160))
    pts = []
    for t in range(0, 181, 5):
        a = math.radians(180 + t); pts.append((128 + 100 * math.cos(a), 128 - 74 * math.sin(a)))
    rim = [(x, 128 + 28 * (1 - ((x - 128) / 100) ** 2)) for x in range(228, 27, -5)]''')
rep("    hl(im, dome, E((92, 82, 130, 112)))", "    hl(im, dome, E((100, 94, 130, 116)))")
rep("    shade(im, body, HALF(172), (0, 0, 0, 70))", "    shade(im, body, HALF(174), (0, 0, 0, 70))")
rep("    hl(im, body, E((36, 118, 96, 146)), (255, 255, 255, 110))", "    hl(im, body, E((40, 124, 96, 150)), (255, 255, 255, 110))")

# food: 8px 위로
rep('''    flare = E((80, 36, 176, 66))
    neck = P([(94, 110), (162, 110), (174, 50), (82, 50)])
    body = U(RR((44, 104, 212, 236), 46), E((58, 88, 198, 156)))
    rope = RR((82, 82, 174, 106), 12)''', '''    flare = E((80, 30, 176, 60))
    neck = P([(94, 104), (162, 104), (174, 44), (82, 44)])
    body = U(RR((44, 98, 212, 228), 46), E((58, 82, 198, 150)))
    rope = RR((82, 76, 174, 100), 12)''')
rep("shade(im, flare, HALF(52), (0, 0, 0, 40))", "shade(im, flare, HALF(46), (0, 0, 0, 40))")
rep("line(im, [(90, 94), (166, 94)], 4); hl(im, rope, R((86, 84, 170, 90)), (255, 255, 255, 80))",
    "line(im, [(90, 88), (166, 88)], 4); hl(im, rope, R((86, 78, 170, 84)), (255, 255, 255, 80))")
rep("    shade(im, body, HALF(190), (0, 0, 0, 60))", "    shade(im, body, HALF(184), (0, 0, 0, 60))")
rep("    hl(im, body, E((64, 112, 116, 150)))", "    hl(im, body, E((64, 106, 116, 144)))")
rep("        line(im, [(x, 150), (x, 200)], 4)", "        line(im, [(x, 144), (x, 194)], 4)")

# officer: 전체 아래로, 관모 낮고 넓게(금테), 옷은 230 에서 자름
rep('''    robe = I(E((36, 148, 220, 330)), HALF(0)); robe = I(robe, R((0, 0, S, 236)))
    part(im, robe, ROBE)
    shade(im, robe, HALFX(150), (0, 0, 0, 50))
    collar = P([(96, 150), (128, 200), (160, 150)])
    paint(im, I(robe, collar), ROBE_D); line(im, [(96, 150), (128, 200), (160, 150)], 5)
    part(im, R((106, 118, 150, 166)), SKIN_D)
    head = E((76, 50, 180, 152))
    part(im, head, SKIN); shade(im, head, HALFX(148), (0, 0, 0, 35))
    for x in (102, 140):
        paint(im, E((x, 98, x + 14, 110)), HAIR)
    brow = LN([(96, 90), (118, 86)], 5); paint(im, brow, HAIR); paint(im, LN([(138, 86), (160, 90)], 5), HAIR)
    crown = RR((92, 10, 184, 66), 10); brim = RR((62, 56, 194, 80), 9)
    part(im, crown, HAT); hl(im, crown, R((100, 18, 130, 40)), (255, 255, 255, 60))
    part(im, brim, HAT);  hl(im, brim, R((70, 60, 130, 68)), (255, 255, 255, 60))
    beard = P([(104, 134), (152, 134), (142, 154), (128, 184), (114, 154)])
    part(im, beard, HAIR)''',
'''    robe = I(E((34, 158, 222, 340)), R((0, 0, S, 230)))
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
    part(im, beard, HAIR)''')

# cmd_domestic: 왼쪽·아래로 당기고 날 길이 축소
rep('''    s, e = (52, 232), (168, 64)''', '''    s, e = (40, 228), (146, 74)''')
rep('''    blade = P([add(add(e, bd, 4), d, 12), add(add(e, bd, 100), d, 30), add(add(e, bd, 106), d, 4),
               add(add(e, bd, 100), d, -22), add(add(e, bd, 4), d, -12)])''',
    '''    blade = P([add(add(e, bd, 4), d, 12), add(add(e, bd, 86), d, 30), add(add(e, bd, 92), d, 4),
               add(add(e, bd, 86), d, -22), add(add(e, bd, 4), d, -12)])''')
rep("add(add(e, bd, 100), d, 30), add(add(e, bd, 106), d, 4), add(e, bd, 40)]), (0, 0, 0, 55))",
    "add(add(e, bd, 86), d, 30), add(add(e, bd, 92), d, 4), add(e, bd, 40)]), (0, 0, 0, 55))")
rep("hl(im, blade, LN([add(add(e, bd, 20), d, -14), add(add(e, bd, 92), d, -18)], 6), (255, 255, 255, 120))",
    "hl(im, blade, LN([add(add(e, bd, 20), d, -14), add(add(e, bd, 78), d, -18)], 6), (255, 255, 255, 120))")

# cmd_military: 자루 굵게, 초승달 크게
rep('''    s, e = (78, 236), (158, 62)
    d = vec(s, e); n = perp(d)
    spear(im, s, e, tip_len=46, w=14)
    c = add(add(e, d, -22), n, 30)
    outer = E((c[0] - 34, c[1] - 34, c[0] + 34, c[1] + 34))
    cin = add(c, n, 16)
    inner = E((cin[0] - 32, cin[1] - 32, cin[0] + 32, cin[1] + 32))''',
'''    s, e = (80, 230), (156, 66)
    d = vec(s, e); n = perp(d)
    spear(im, s, e, tip_len=46, w=15, shaft_w=16)
    c = add(add(e, d, -24), n, 34)
    outer = E((c[0] - 40, c[1] - 40, c[0] + 40, c[1] + 40))
    cin = add(c, n, 18)
    inner = E((cin[0] - 38, cin[1] - 38, cin[0] + 38, cin[1] + 38))''')
rep("    bar = LN([add(e, d, -22), add(add(e, d, -22), n, 24)], 10)", "    bar = LN([add(e, d, -24), add(add(e, d, -24), n, 28)], 10)")

# cmd_diplomacy: 아치 → 거북 등딱지 손잡이(龜鈕)
rep('''    arch = ARC((92, 40, 178, 128), 180, 360, 22)
    headb = E((78, 78, 114, 114)); tail = E((166, 92, 190, 116))
    part(im, tail, JADE_D)
    part(im, arch, JADE); shade(im, arch, HALFX(150), (0, 0, 0, 50)); hl(im, arch, E((104, 48, 130, 66)))
    part(im, headb, JADE); hl(im, headb, E((86, 84, 98, 96)))
    paint(im, E((92, 90, 100, 98)), OUT)
    cord = LN([(184, 112), (196, 176)], 8)''',
'''    shell = I(E((94, 54, 182, 126)), R((0, 0, S, 96)))     # 등딱지: 타원 윗반
    headb = E((72, 78, 104, 104)); tail = E((176, 82, 196, 98))
    part(im, tail, JADE_D)
    part(im, headb, JADE); hl(im, headb, E((80, 82, 92, 92)))
    paint(im, E((84, 88, 92, 96)), OUT)
    part(im, shell, JADE); shade(im, shell, HALFX(150), (0, 0, 0, 50)); hl(im, shell, E((108, 60, 136, 78)))
    line(im, [(112, 96), (122, 68), (152, 68), (164, 96)], 4)   # 등딱지 무늬
    cord = LN([(186, 100), (196, 176)], 8)''')

# cmd_march: 8px 위로
start = s.index('def cmd_march(im):'); end = s.index('ICONS = [')
body = re.sub(r'\((\d+), (\d+)\)', lambda t: f'({t.group(1)}, {int(t.group(2)) - 8})', s[start:end])
s = s[:start] + body + s[end:]
assert s != n0
open(p, 'w', encoding='utf-8').write(s)
print('patched v2')
