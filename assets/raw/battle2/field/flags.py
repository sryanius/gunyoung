# -*- coding: utf-8 -*-
"""진영 깃발(banner 64×192)·부대 깃발(flag 48×72) 을 파이썬으로 그린다 — SDXL 은 «곧은 세로 깃발» 을 못 뽑았다(banner_s1~3, flag_s1~3).
usage: python flags.py <outdir> [--big]      --big: img2img 초안용 8배 그림(분홍 배경)도 저장
편 색: g = #3aa655 계열, b = #3b6fd6 계열(같은 모양·같은 주름 — 색만 다르다). 글자 없음(가운데 밝은 원 문양만)."""
import sys, os
import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import gaussian_filter, binary_erosion

out = sys.argv[1]; os.makedirs(out, exist_ok=True)
SIDE = {'g': ((58, 166, 85), (24, 84, 44)), 'b': ((59, 111, 214), (24, 48, 120))}   # (밝은 색, 그늘 색)
GOLD = np.array((226, 182, 92), np.float32); GOLD_D = np.array((138, 96, 38), np.float32)

def poly_mask(W, H, pts):
    m = Image.new('L', (W, H), 0); ImageDraw.Draw(m).polygon(pts, fill=255)
    return np.array(m, np.float32) / 255

def cloth(W, H, S, x0, y0, cw, chh, kind, side, seed):
    """천: 왼쪽 변이 장대에 붙고 오른쪽으로 나부낀다. kind 'banner' = 세로로 긴 직사각형 + 제비꼬리 아래, 'pennant' = 작은 깃발(오른쪽 끝 V 홈)"""
    g = np.random.default_rng(seed)
    ys = np.linspace(0, 1, 60)
    if kind == 'banner':
        # 오른쪽 변이 물결, 아래 변은 제비꼬리
        right = [(x0 + cw * (1 + 0.07 * np.sin(t * 7.0 + 0.6)) , y0 + chh * t * 0.93 + cw * 0.10 * np.sin(t * 3)) for t in ys]
        xr, yr = right[-1]
        pts = [(x0, y0)] + right + [(x0 + cw * 0.55, yr - chh * 0.07), (x0, y0 + chh)]
    else:
        top = [(x0 + cw * t, y0 + chh * 0.10 * np.sin(t * 5.0) * t) for t in ys]
        bot = [(x0 + cw * t, y0 + chh * (1 - 0.18 * t) + chh * 0.10 * np.sin(t * 5.0 + 0.8) * t) for t in ys][::-1]
        xe, ye = top[-1]; xb, yb = bot[0]
        pts = top + [(xe - cw * 0.22, (ye + yb) / 2)] + bot
    m = poly_mask(W, H, pts)
    y, x = np.mgrid[0:H, 0:W].astype(np.float32)
    u = (x - x0) / cw; v = (y - y0) / chh
    # 주름: 장대에서 멀어질수록 깊어지는 비스듬한 물결
    fold = np.sin(u * 8.5 + v * 3.2 + 0.4) * 0.75 + np.sin(u * 17 + v * 5 + 2.0) * 0.25
    fold = np.sign(fold) * np.abs(fold) ** 0.8                       # 주름 골을 또렷하게
    shade = 0.5 + 0.5 * fold * np.clip(u * 1.2 + 0.45, 0, 1)
    shade = np.clip(shade * 0.95 + 0.08 - v * 0.10, 0, 1)
    hi, lo = (np.array(c, np.float32) for c in SIDE[side])
    col = lo + (hi - lo) * shade[..., None]
    col += (np.clip(shade - 0.78, 0, 1) * 2.2)[..., None] * (255 - col) * 0.55       # 비단 광택
    # 금테: 마스크를 깎아 테두리 띠
    inner = binary_erosion(m > 0.5, iterations=max(1, int(S * 1.6)))
    trim = (m > 0.5) & ~inner
    gcol = GOLD_D + (GOLD - GOLD_D) * shade[..., None]
    col = np.where(trim[..., None], gcol, col)
    # 가운데 문양: 밝은 원 + 금 고리(글자 없음)
    if kind == 'banner':
        ex, ey, er = x0 + cw * 0.52, y0 + chh * 0.42, cw * 0.30
    else:
        ex, ey, er = x0 + cw * 0.40, y0 + chh * 0.46, chh * 0.24
    rr = np.hypot(x - ex, (y - ey)) / er
    disc = (rr < 1.0) & inner; ringm = (rr >= 0.82) & (rr < 1.0) & inner
    dcol = np.array((244, 232, 200), np.float32) * (0.62 + 0.38 * shade[..., None])
    col = np.where(disc[..., None], dcol, col); col = np.where(ringm[..., None], gcol, col)
    return col, m

def pole(img, al, S, x, y0, y1, w):
    y, xx = np.mgrid[0:img.shape[0], 0:img.shape[1]].astype(np.float32)
    d = (xx - x) / (w / 2)
    m = (np.abs(d) <= 1) & (y >= y0) & (y <= y1)
    shade = 0.55 + 0.45 * np.clip(1 - (d + 0.35) ** 2, 0, 1)
    c = np.array((120, 78, 40), np.float32) * shade[..., None]
    img[m] = c[m]; al[m] = 1

def tip(img, al, S, x, y0, h, w):
    """창날 모양 금빛 끝"""
    H, W = al.shape
    m = poly_mask(W, H, [(x, y0), (x + w / 2, y0 + h * 0.55), (x, y0 + h), (x - w / 2, y0 + h * 0.55)]) > 0.5
    y, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    shade = 0.6 + 0.4 * np.clip(1 - ((xx - x) / (w / 2) + 0.4) ** 2, 0, 1)
    img[m] = (GOLD * shade[..., None])[m]; al[m] = 1

def build(kind, side, S):
    if kind == 'banner':
        Wt, Ht = 64, 192; W, H = Wt * S, Ht * S
        img = np.zeros((H, W, 3), np.float32); al = np.zeros((H, W), np.float32)
        px = 11 * S
        pole(img, al, S, px, 14 * S, 186 * S, 4.2 * S)
        # 가로대(천 위쪽을 받치는 막대) + 붉은 술
        y, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        bar = (np.abs(y - 21 * S) <= 1.3 * S) & (xx >= px) & (xx <= 56 * S)
        img[bar] = (96, 60, 30); al[bar] = 1
        col, m = cloth(W, H, S, px + 1.5 * S, 22 * S, 42 * S, 128 * S, 'banner', side, 3)
        mm = m > 0.5; img[mm] = col[mm]; al = np.maximum(al, m)
        tas = poly_mask(W, H, [(px - 3 * S, 17 * S), (px + 3 * S, 17 * S), (px + 1.5 * S, 33 * S), (px - 2.5 * S, 31 * S)]) > 0.5
        img[tas] = (190, 44, 36); al[tas] = 1
        tip(img, al, S, px, 2 * S, 15 * S, 8 * S)
        # 바닥 그림자(땅에 닿는 자리)
        sh = np.exp(-(((xx - px - 4 * S) / (14 * S)) ** 2 + ((y - 187 * S) / (2.6 * S)) ** 2))
        sh_a = sh * 0.45 * (al < 0.5)
        al = np.maximum(al, sh_a)
    else:
        Wt, Ht = 48, 72; W, H = Wt * S, Ht * S
        img = np.zeros((H, W, 3), np.float32); al = np.zeros((H, W), np.float32)
        px = 6 * S
        pole(img, al, S, px, 5 * S, 71 * S, 2.6 * S)
        col, m = cloth(W, H, S, px + 1.0 * S, 7 * S, 38 * S, 30 * S, 'pennant', side, 5)
        mm = m > 0.5; img[mm] = col[mm]; al = np.maximum(al, m)
        tip(img, al, S, px, 0.5 * S, 7 * S, 4.5 * S)
    return img, al, (Wt, Ht)

for kind, name in (('banner', 'banner'), ('pennant', 'flag')):
    for side in 'gb':
        S = 8
        img, al, size = build(kind, side, S)
        # 살짝 붓질 느낌: 색에 저주파 얼룩
        nz = gaussian_filter(np.random.default_rng(9).standard_normal(al.shape).astype(np.float32), S * 1.5)
        img = np.clip(img * (1 + 0.025 * nz[..., None] / nz.std()), 0, 255)
        rgba = np.dstack([img, al * 255]).astype(np.uint8)
        big = Image.fromarray(rgba, 'RGBA')
        if '--big' in sys.argv:
            bgc = Image.new('RGB', big.size, (250, 30, 125)); bgc.paste(big, (0, 0), big); bgc.save(os.path.join(out, 'b2f_%s_%s_big.png' % (name, side)))
        # 프리멀티플라이드로 줄여 가장자리 색 번짐 방지
        a = np.array(big).astype(np.float32); pm = a.copy(); pm[..., :3] *= a[..., 3:4] / 255
        sm = np.array(Image.fromarray(pm.astype(np.uint8), 'RGBA').resize(size, Image.LANCZOS)).astype(np.float32)
        aa = np.clip(sm[..., 3:4], 1, 255); sm[..., :3] = np.clip(sm[..., :3] / (aa / 255), 0, 255)
        sm[sm[..., 3] < 2] = 0
        p = os.path.join(out, '%s_%s.png' % (name, side)); Image.fromarray(sm.astype(np.uint8), 'RGBA').save(p); print(p, size)
