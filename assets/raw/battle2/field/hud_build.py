# -*- coding: utf-8 -*-
"""HUD 그림(BATTLE_ART.md §4) — 초상 4 · 초상 테두리 · 바 틀 · 메달리온 · 무장기 아이콘 2.
usage: python hud_build.py <outdir> [portraits|frames|medallion|icons ...]
 - 초상: cutin/<key>.png 에서 두 눈 가운데(ex, ey)를 기준으로 폭 cw 를 잘라 96×120, 눈이 위 1/3(y=40). 어두운 편 색 그라데이션 위에 합성(불투명).
 - 틀: ui/hud_bar.png 의 금테(180,110,48 / 255,245,185)·목재(128,58,27)·옻칠(31,6,3) 색을 그대로 쓴 SDF 베벨(4배 슈퍼샘플).
 - 메달리온: SDXL medal_s2(청동 고리)를 키잉해 바깥 고리로, 안쪽은 목재 띠 + 금 안테. 구멍 반지름 31 — 64×64 아이콘이 1:1 로 깔려도 구멍을 다 덮는다."""
import sys, os
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter

out = sys.argv[1]; os.makedirs(out, exist_ok=True)
what = sys.argv[2:] or ['portraits', 'frames', 'medallion', 'icons']
ROOT = 'C:/claude/gunyoung/assets/'
HERE = os.path.dirname(os.path.abspath(__file__))

GOLD = np.array((190, 122, 50), np.float32); GOLD_HI = np.array((255, 240, 176), np.float32); GOLD_LO = np.array((92, 52, 20), np.float32)
WOOD = np.array((112, 50, 24), np.float32); DARK = np.array((28, 8, 5), np.float32)

def smooth(t): t = np.clip(t, 0, 1); return t * t * (3 - 2 * t)

def premul_resize(rgba, size):
    a = rgba.astype(np.float32); a[..., :3] *= a[..., 3:4] / 255
    sm = np.array(Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA').resize(size, Image.LANCZOS)).astype(np.float32)
    al = np.clip(sm[..., 3:4], 1, 255); sm[..., :3] = np.clip(sm[..., :3] / (al / 255), 0, 255); sm[sm[..., 3] < 2] = 0
    return sm.astype(np.uint8)

# ───────────── 초상 ─────────────
PORTRAITS = {   # key: (ex, ey, 자를 폭, 편[, 얼굴 감마])
    # (통합 회차) guanyu: (452,236,250) 은 관을 기준으로 잡혀 눈이 y≈60 에 작고 어둡게 들어갔다(가운데 상자 밝기 55 vs 나머지 114~145)
    #   → 실제 두 눈 가운데 (445,292), 폭 190, 얼굴 감마 0.72 로 다른 세 장과 크기·밝기를 맞춘다
    'guanyu': (445, 292, 190, 'g', 0.72), 'zhangfei': (488, 200, 300, 'g'),
    'xiahoudun': (440, 358, 290, 'b'), 'dianwei': (334, 330, 290, 'b'),
}
def portraits():
    for key, spec in PORTRAITS.items():
        ex, ey, cw, side = spec[:4]; gamma = spec[4] if len(spec) > 4 else 1.0
        im = Image.open(ROOT + 'battle/cutin/%s.png' % key).convert('RGBA')
        if gamma != 1.0:
            ga = np.array(im).astype(np.float32); ga[..., :3] = 255 * (ga[..., :3] / 255) ** gamma; im = Image.fromarray(ga.astype(np.uint8), 'RGBA')
        ch = cw * 120 / 96
        box = (ex - cw / 2, ey - ch / 3, ex + cw / 2, ey + ch * 2 / 3)
        big = Image.new('RGBA', (int(cw), int(ch)), (0, 0, 0, 0))
        big.alpha_composite(im.crop(tuple(int(round(v)) for v in (max(0, box[0]), max(0, box[1]), min(im.width, box[2]), min(im.height, box[3])))),
                            (int(round(max(0, -box[0]))), int(round(max(0, -box[1])))))
        face = Image.fromarray(premul_resize(np.array(big), (96, 120)), 'RGBA')
        y, x = np.mgrid[0:120, 0:96].astype(np.float32)
        top, bot = ((44, 62, 46), (16, 24, 18)) if side == 'g' else ((44, 54, 84), (14, 18, 34))
        t = (y / 119)[..., None]; bg = np.array(top, np.float32) * (1 - t) + np.array(bot, np.float32) * t
        glow = np.exp(-(((x - 48) / 46) ** 2 + ((y - 46) / 50) ** 2))[..., None]       # 머리 뒤 은은한 빛
        bg = bg * (0.75 + 0.7 * glow)
        base = Image.fromarray(np.dstack([np.clip(bg, 0, 255), np.full((120, 96), 255)]).astype(np.uint8), 'RGBA')
        base.alpha_composite(face)
        a = np.array(base).astype(np.float32)
        vig = 1 - 0.30 * np.clip((np.maximum(np.abs(x - 47.5) / 48, np.abs(y - 59.5) / 60) - 0.72) / 0.28, 0, 1) ** 1.5   # 테두리 쪽을 살짝 어둡게
        a[..., :3] *= vig[..., None]
        p = os.path.join(out, 'portrait_%s.png' % key); Image.fromarray(a.astype(np.uint8), 'RGBA').convert('RGB').save(p); print(p)

# ───────────── SDF 베벨 틀 ─────────────
def bevel_frame(Wt, Ht, border, radius, cap, name, S=4):
    """가운데 투명. border = 테 두께(px), cap = 모서리 청동 덮개 한 변(px, 0 이면 없음)"""
    W, H = Wt * S, Ht * S
    y, x = np.mgrid[0:H, 0:W].astype(np.float32); x = (x + 0.5) / S; y = (y + 0.5) / S
    # 둥근 사각형 SDF(안쪽 +)
    qx = np.abs(x - Wt / 2) - (Wt / 2 - radius); qy = np.abs(y - Ht / 2) - (Ht / 2 - radius)
    outside = np.hypot(np.maximum(qx, 0), np.maximum(qy, 0)) + np.minimum(np.maximum(qx, qy), 0) - radius
    d = -outside                                                     # 바깥 가장자리에서 안쪽으로 들어간 깊이
    gy, gx = np.gradient(d, 1.0 / S); nrm = np.hypot(gx, gy) + 1e-6; nx, ny = -gx / nrm, -gy / nrm   # 바깥쪽 법선
    lit = nx * -0.45 + ny * -0.89                                    # 빛은 왼쪽 위에서
    b = float(border)
    rgb = np.zeros((H, W, 3), np.float32); al = np.zeros((H, W), np.float32)
    def band(d0, d1, col, a=1.0):
        m = smooth((d - d0) * S / 1.5 + 0.5) * smooth((d1 - d) * S / 1.5 + 0.5)
        rgb[...] = rgb * (1 - m[..., None]) + col * m[..., None]; al[...] = np.maximum(al, m * a)
        return m
    def bead(d0, d1, base=GOLD):
        t = np.clip((d - d0) / (d1 - d0), 0, 1); tilt = np.cos(np.pi * t)             # 바깥 반은 바깥으로, 안쪽 반은 안으로 기운 둥근 띠
        k = tilt * lit
        col = base + (GOLD_HI - base) * np.clip(k, 0, 1)[..., None] ** 0.8 + (GOLD_LO - base) * np.clip(-k, 0, 1)[..., None]
        col += (GOLD_HI - base) * (np.exp(-((t - 0.35) / 0.12) ** 2) * np.clip(lit + 0.2, 0, 1))[..., None] * 0.5   # 윗면 광택 줄
        band(d0, d1, col)
    band(0, 1.0, DARK, 0.95)                                         # 바깥 옻칠 선
    bead(0.9, b * 0.52)                                              # 굵은 금 테
    band(b * 0.52, b * 0.74, WOOD)                                   # 목재 홈
    bead(b * 0.72, b * 0.92, GOLD * 0.92)                            # 가는 안쪽 금선
    band(b * 0.90, b, DARK, 0.95)                                    # 안쪽 옻칠 선
    # 안쪽 그림자(내용물 위에 드리움): 위·왼쪽이 짙다
    inner = d - b
    sh = np.clip(1 - inner / 3.5, 0, 1) * (inner > 0) * (0.30 + 0.25 * np.clip(-lit, 0, 1))
    shm = (inner > 0)
    rgb[shm] = (8, 4, 3); al = np.where(shm, sh, al)
    # 모서리 덮개: 청동 판 + 징
    if cap:
        for cx, cy in ((cap / 2, cap / 2), (Wt - cap / 2, cap / 2), (cap / 2, Ht - cap / 2), (Wt - cap / 2, Ht - cap / 2)):
            dx, dy = np.abs(x - cx), np.abs(y - cy); dd = cap / 2 - np.maximum(dx, dy)          # 덮개 안쪽 깊이
            m = smooth(dd * S / 1.5 + 0.5) * (d > 0.4)
            # 덮개 바깥쪽 모서리는 틀의 둥근 모서리를 따른다(d>0), 안쪽 모서리는 직각
            gyy, gxx = np.gradient(dd, 1.0 / S); l2 = -(-gxx) * 0.45 - (-gyy) * 0.89
            edge = np.clip(1 - dd / 1.6, 0, 1)
            col = GOLD * 0.95 + (GOLD_HI - GOLD) * (np.clip(l2, 0, 1) * edge)[..., None] * 0.9 + (GOLD_LO - GOLD) * (np.clip(-l2, 0, 1) * edge)[..., None] * 0.9
            # 가운데 징
            rr = np.hypot(x - cx, y - cy) / (cap * 0.20)
            stud = np.clip(1 - rr, 0, 1); sl = np.clip((-(x - cx) * 0.45 - (y - cy) * 0.89) / (cap * 0.2), -1, 1)
            col = np.where((rr < 1)[..., None], GOLD + (GOLD_HI - GOLD) * np.clip(sl, 0, 1)[..., None] + (GOLD_LO - GOLD) * np.clip(-sl, 0, 1)[..., None], col)
            ringm = (rr >= 1) & (rr < 1.35); col = np.where(ringm[..., None], GOLD_LO * 0.8, col)
            rgb[...] = rgb * (1 - m[..., None]) + col * m[..., None]; al[...] = al * (1 - m) + m
            # 덮개 둘레 어두운 선
            lm = smooth((0.6 - np.abs(dd)) * S / 1.5 + 0.5) * (d > 0.4) * (np.maximum(dx, dy) > 0)
            inner_side = ((x - cx) * (Wt / 2 - cx) > 0) | ((y - cy) * (Ht / 2 - cy) > 0)
            lm = lm * inner_side
            rgb[...] = rgb * (1 - lm[..., None] * 0.85) + DARK * lm[..., None] * 0.85
    al = al * smooth(d * S / 1.5 + 0.5)
    res = premul_resize(np.dstack([np.clip(rgb, 0, 255), np.clip(al, 0, 1) * 255]).astype(np.uint8), (Wt, Ht))
    p = os.path.join(out, name + '.png'); Image.fromarray(res, 'RGBA').save(p)
    c = res[Ht // 2 - 2:Ht // 2 + 2, Wt // 2 - 2:Wt // 2 + 2, 3]; print(p, (Wt, Ht), 'center alpha', int(c.max()), 'corner alpha', int(res[0, 0, 3]))

def frames():
    bevel_frame(112, 136, 8, 5, 18, 'portrait_frame')
    bevel_frame(320, 40, 7, 4, 12, 'bar_frame')

# ───────────── 메달리온 ─────────────
def medallion():
    S = 4; Wt = 160; W = Wt * S
    src = Image.open(os.path.join(HERE, 'medal_s2.png')).convert('RGB'); a = np.array(src).astype(np.float32)
    bgc = np.concatenate([a[:24, :24].reshape(-1, 3), a[:24, -24:].reshape(-1, 3), a[-24:, :24].reshape(-1, 3), a[-24:, -24:].reshape(-1, 3)]).mean(0)
    dist = np.sqrt(((a - bgc) ** 2).sum(-1)); fg = dist > 45
    ys, xs = np.where(fg); cx, cy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2; R = ((xs.max() - xs.min()) + (ys.max() - ys.min())) / 4
    print('medal_s2 bg', bgc.round(), 'center', cx, cy, 'R', R)
    Ro = 78.0                                                         # 바깥 반지름(px, 160 기준)
    k = R / (Ro * S); half = W / 2 * k
    ring = src.crop((int(cx - half), int(cy - half), int(cx + half), int(cy + half))).resize((W, W), Image.LANCZOS)
    rg = np.array(ring).astype(np.float32)
    y, x = np.mgrid[0:W, 0:W].astype(np.float32); x = (x + 0.5) / S - Wt / 2; y = (y + 0.5) / S - Wt / 2
    r = np.hypot(x, y); lit = (-x * 0.45 - y * 0.89) / np.maximum(r, 1e-3)      # 바깥쪽 법선 · 빛
    # 초록 물듦 제거 + 청동 톤으로: 밝기만 남겨 금색 램프에 입힌다(원본 무늬는 밝기에 남는다)
    l = (rg @ np.array([0.299, 0.587, 0.114], np.float32)) / 255
    l = np.clip((l - 0.08) / 0.75, 0, 1)
    bronze = GOLD_LO[None, None] * (1 - l[..., None]) + GOLD[None, None] * l[..., None]
    bronze = bronze + (GOLD_HI - GOLD)[None, None] * np.clip((l - 0.72) / 0.28, 0, 1)[..., None]
    rgb = np.zeros((W, W, 3), np.float32); al = np.zeros((W, W), np.float32)
    def band(r0, r1, col, a=1.0):
        m = smooth((r - r0) * S / 1.5 + 0.5) * smooth((r1 - r) * S / 1.5 + 0.5)
        rgb[...] = rgb * (1 - m[..., None]) + col * m[..., None]; al[...] = al * (1 - m) + m * a
    def bead(r0, r1, base=GOLD):
        t = np.clip((r - r0) / (r1 - r0), 0, 1); tilt = -np.cos(np.pi * t)    # 안쪽 반은 중심 쪽으로 기움
        kk = tilt * lit
        col = base + (GOLD_HI - base) * np.clip(kk, 0, 1)[..., None] ** 0.8 + (GOLD_LO - base) * np.clip(-kk, 0, 1)[..., None]
        band(r0, r1, col)
    Ri = Ro * 0.665                                                   # 원본 고리의 안쪽 반지름
    band(Ri - 0.5, Ro + 0.5, bronze)                                  # 바깥 청동 고리(SDXL 무늬)
    wood = WOOD[None, None] * (0.80 + 0.06 * np.cos(np.arctan2(y, x) * 24 + r * 0.9) - 0.10 * np.clip(lit, -1, 1))[..., None]   # 방사 나뭇결 + 위쪽이 살짝 어두운 오목면
    band(36.0, Ri + 0.5, wood)                                        # 안쪽 목재 띠(코드가 게이지 호를 그릴 자리)
    band(Ri - 0.6, Ri + 0.8, DARK)                                    # 고리와 띠 사이 홈
    bead(31.0, 36.5)                                                  # 금 안테
    band(30.2, 31.2, DARK, 0.95)
    band(Ro - 0.2, Ro + 0.9, DARK, 0.9)
    # 구멍 안 그림자(아이콘 위에 드리움)
    inner = 30.5 - r; shm = inner > 0
    sh = np.clip(1 - inner / 4.0, 0, 1) * (0.28 + 0.25 * np.clip(lit, 0, 1))
    rgb[shm] = (8, 4, 3); al = np.where(shm, sh, al)
    # 원본 고리의 실제 윤곽(키잉)으로 바깥 가장자리를 다듬는다
    fgim = Image.fromarray((fg * 255).astype(np.uint8)).crop((int(cx - half), int(cy - half), int(cx + half), int(cy + half))).resize((W, W), Image.LANCZOS)
    fga = gaussian_filter(np.array(fgim).astype(np.float32) / 255, 1.0)
    al = np.where(r > Ro - 3, al * np.clip(fga * 1.2, 0, 1), al)
    # (통합 회차) 키잉 윤곽은 r 74~78 에서 이가 빠져 보인다(검수: 알파<128 이 21~48%) → r 75 SDF 원으로 깨끗이 자르고 옻칠 선으로 닫는다
    Rc = 75.0
    edge = smooth((Rc - r) * S / 1.5 + 0.5)
    line = smooth((r - (Rc - 1.4)) * S / 1.5 + 0.5) * edge
    rgb[...] = rgb * (1 - line[..., None]) + DARK * line[..., None]
    al = np.where(r > Rc - 3, np.maximum(al, line * 0.95) * edge, al)
    res = premul_resize(np.dstack([np.clip(rgb, 0, 255), np.clip(al, 0, 1) * 255]).astype(np.uint8), (Wt, Wt))
    p = os.path.join(out, 'medallion.png'); Image.fromarray(res, 'RGBA').save(p)
    print(p, 'center alpha', int(res[78:82, 78:82, 3].max()), 'alpha@r25', int(res[80, 80 + 25, 3]), 'alpha@r34', int(res[80, 80 + 34, 3]), 'corner', int(res[2, 2, 3]))

# ───────────── 무장기 아이콘 ─────────────
def icons():
    for name, src, box in (('skill_guanyu', 'skdragon_s3.png', (82, 40, 942, 900)), ('skill_zhangfei', 'skroar_s1.png', (120, 25, 920, 825))):
        im = Image.open(os.path.join(HERE, src)).convert('RGB').crop(box).resize((64, 64), Image.LANCZOS)
        a = np.array(im).astype(np.float32)
        l = a @ np.array([0.299, 0.587, 0.114], np.float32); a = l[..., None] + (a - l[..., None]) * 1.08; a = (a - 128) * 1.06 + 132   # 작게 줄이면 탁해져 대비·채도를 살짝
        p = os.path.join(out, name + '.png'); Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGB').save(p); print(p)

for w in what: {'portraits': portraits, 'frames': frames, 'medallion': medallion, 'icons': icons}[w]()
