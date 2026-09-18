# -*- coding: utf-8 -*-
"""키잉된 소품(k/*.png) → field/*.png : 색 보정 + 맞춤 크기 + 바닥 그림자.
usage: python props.py <k_dir> <out_dir>
 - 코드(BattleScene PROPS)는 origin (0.5, 0.94)·배율 0.4~0.9 로 놓는다 → 물체 바닥선을 캔버스 높이의 94% 에 두고, 그림자가 그 아래 6% 에 걸친다.
 - 크기는 병사 표시 키 47px 에 맞춘 것: 막사 0.9배 → 135px(병사 2.9명), 목책 0.8배 → 80px, 고목 0.85배 → 210px, 바위 0.5배 → 70~75px.
 - 색: 분홍 배경의 물듦(보라·분홍 기운)을 빼고, sky(해질녘 담채)에 맞춰 채도를 낮추고 따뜻한 쪽으로 민다."""
import sys, os
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter

kd, od = sys.argv[1], sys.argv[2]; os.makedirs(od, exist_ok=True)

def grade(a, sat=0.85, warm=(1.0, 0.97, 0.90), gain=1.0, depink=False, grey=0.0):
    rgb = a[..., :3].astype(np.float32)
    if depink:                                    # 분홍/자줏빛 픽셀(R≫G, B>G)을 같은 밝기의 천·나무색으로
        r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
        m = ((r - g) > 70) & (b > g + 5)
        l = rgb @ np.array([0.299, 0.587, 0.114], np.float32)
        rep = np.stack([l * 1.15, l * 0.85, l * 0.65], -1)
        rgb = np.where(m[..., None], rep, rgb)
    l = (rgb @ np.array([0.299, 0.587, 0.114], np.float32))[..., None]
    if grey: rgb = rgb * (1 - grey) + l * np.array([1.04, 1.0, 0.93], np.float32) * grey   # 바위: 회백색 쪽으로
    rgb = l + (rgb - l) * sat
    rgb = rgb * np.array(warm, np.float32) * gain
    a = a.copy(); a[..., :3] = np.clip(rgb, 0, 255); return a

def fit_shadow(a, box, sh_w=1.0, sh_h=0.11, sh_a=0.42, base_cut=0):
    """box=(w,h) 안에 맞추고, 바닥선 = 캔버스 높이 94%. 그림자는 바닥선에 걸친 납작한 타원(물체 뒤)."""
    im = Image.fromarray(a, 'RGBA'); bb = im.getbbox(); im = im.crop(bb)
    if base_cut: im = im.crop((0, 0, im.width, im.height - base_cut))
    s = min(box[0] / im.width, box[1] / im.height)
    # 프리멀티플라이드 축소(가장자리 색 번짐 방지)
    p = np.array(im).astype(np.float32); p[..., :3] *= p[..., 3:4] / 255
    sm = np.array(Image.fromarray(p.astype(np.uint8), 'RGBA').resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)).astype(np.float32)
    al = np.clip(sm[..., 3:4], 1, 255); sm[..., :3] = np.clip(sm[..., :3] / (al / 255), 0, 255)
    ow, oh = sm.shape[1], sm.shape[0]
    # 물체 바닥 폭: 아래 8% 행의 알파 범위
    rows = sm[int(oh * 0.92):, :, 3]; cols = np.where(rows.max(0) > 40)[0]
    bx0, bx1 = (cols.min(), cols.max()) if len(cols) else (0, ow - 1)
    bw = (bx1 - bx0) * sh_w; bcx = (bx0 + bx1) / 2
    H = int(np.ceil(oh / 0.94)); padx = int(max(0, bw * 0.06) + 3); W = ow + padx * 2
    y, x = np.mgrid[0:H, 0:W].astype(np.float32)
    ry = max(3.0, bw * sh_h); base = oh - 1
    d = ((x - (bcx + padx)) / (bw / 2 * 1.08)) ** 2 + ((y - base) / ry) ** 2
    sh = np.clip(1 - d, 0, 1) ** 0.8 * sh_a
    sh = gaussian_filter(sh, 1.5)
    out = np.zeros((H, W, 4), np.float32); out[..., :3] = (22, 14, 20); out[..., 3] = sh * 255
    o = Image.fromarray(out.astype(np.uint8), 'RGBA'); o.alpha_composite(Image.fromarray(sm.astype(np.uint8), 'RGBA'), (padx, 0))
    return o

JOBS = {
    # 이름: (grade 인자, 맞춤 상자, 그림자 인자)
    'tent':      (dict(sat=0.9, warm=(1.0, 0.98, 0.92), depink=True), (210, 150), dict(sh_w=1.0, sh_h=0.07)),
    'palisade':  (dict(sat=0.8, warm=(1.0, 0.97, 0.90), gain=1.12), (222, 100), dict(sh_w=1.0, sh_h=0.05)),
    'tree_dead': (dict(sat=0.7, warm=(1.06, 0.98, 0.92), gain=1.25, depink=True), (200, 238), dict(sh_w=2.4, sh_h=0.10)),
    'rock1':     (dict(sat=0.6, warm=(1.0, 0.97, 0.90), gain=0.86, grey=0.5), (180, 150), dict(sh_w=1.15, sh_h=0.10)),
    'rock2':     (dict(sat=0.5, warm=(1.0, 0.97, 0.90), gain=0.92, grey=0.7, depink=False), (150, 160), dict(sh_w=1.1, sh_h=0.10, base_cut=10)),
}
for name, (g, box, sh) in JOBS.items():
    a = np.array(Image.open(os.path.join(kd, name + '.png')).convert('RGBA'))
    o = fit_shadow(grade(a, **g), box, **sh)
    assert o.width <= 256 and o.height <= 256, (name, o.size)
    o.save(os.path.join(od, name + '.png')); print(name, o.size)
