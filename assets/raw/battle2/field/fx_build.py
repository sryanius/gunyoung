# -*- coding: utf-8 -*-
"""전투 이펙트(ADD 블렌드용, 검정 배경 RGB) 를 파이썬으로 직접 그린다 — BATTLE_ART.md §3.
usage: python fx_build.py <outdir> [name ...]     (name: ring speedlines impact spark dust slash_white slash_blue fog)
전부 4배(또는 2배) 슈퍼샘플 → Lanczos 축소. 가장자리는 창 함수로 순검정(0,0,0) 까지 페이드.
fog 만 RGBA(흰색 + 알파) — field/ 용."""
import sys, os
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter, map_coordinates

def rng(seed): return np.random.default_rng(seed)

def save_rgb(a, path, size):
    a = np.clip(a, 0, 1)
    im = Image.fromarray((a * 255 + 0.5).astype(np.uint8), 'RGB').resize(size, Image.LANCZOS)
    b = np.array(im)
    # 축소 뒤 가장자리 1px 을 확실히 0 으로(Lanczos 링잉 방지)
    b[0, :] = 0; b[-1, :] = 0; b[:, 0] = 0; b[:, -1] = 0
    Image.fromarray(b, 'RGB').save(path); print(path, size, 'max', b.max(), 'edge max', max(b[1, :].max(), b[-2, :].max(), b[:, 1].max(), b[:, -2].max()))

def grid(W, H):
    y, x = np.mgrid[0:H, 0:W].astype(np.float32)
    return x, y

def smooth(t): t = np.clip(t, 0, 1); return t * t * (3 - 2 * t)

def edge_window(W, H, m):
    """직사각형 가장자리 m px 안에서 0 으로 떨어지는 창"""
    x, y = grid(W, H)
    d = np.minimum(np.minimum(x, W - 1 - x), np.minimum(y, H - 1 - y))
    return smooth(d / m)

def radial_window(r, r0, r1): return 1 - smooth((r - r0) / (r1 - r0))

def periodic_noise(n, seed, sigma):
    """길이 n 의 주기 1D 잡음(0~1)"""
    v = rng(seed).random(n).astype(np.float32)
    v = gaussian_filter(v, sigma, mode='wrap')
    v = (v - v.min()) / (v.max() - v.min() + 1e-6)
    return v

def tint(i, lo, hi):
    """세기 i(0~1+) → 색: 약한 곳 lo 색, 강한 곳 hi(흰색 쪽)"""
    lo = np.array(lo, np.float32) / 255; hi = np.array(hi, np.float32) / 255
    t = smooth(i)[..., None]
    return (lo * (1 - t) + hi * t) * np.clip(i, 0, 1.2)[..., None]

# ───────────────────────── ring 256 ─────────────────────────
def ring(path):
    S = 4; W = 256 * S
    x, y = grid(W, W); cx = cy = (W - 1) / 2
    dx, dy = x - cx, y - cy; r = np.hypot(dx, dy) / S; th = np.arctan2(dy, dx)
    n = 2048
    a_idx = ((th + np.pi) / (2 * np.pi) * n).astype(np.int32) % n
    nz1 = periodic_noise(n, 11, 6)[a_idx]; nz2 = periodic_noise(n, 12, 40)[a_idx]; nz3 = periodic_noise(n, 13, 2)[a_idx]
    R = 96 + (nz2 - 0.5) * 5                      # 링 반지름이 살짝 출렁
    core = np.exp(-((r - R) / 3.4) ** 2) * (0.75 + 0.5 * nz1)
    glow_out = np.exp(-np.clip(r - R, 0, None) / 7.0) * (r >= R) * 0.6
    glow_in = np.exp(-np.clip(R - r, 0, None) / 22.0) * (r < R) * (0.30 + 0.35 * nz1)
    streak = np.exp(-np.clip(R - r, 0, None) / 40.0) * (r < R) * (nz3 > 0.66) * 0.16 * smooth((r - 30) / 40)   # 안쪽으로 끌리는 가는 결
    i = core * 1.1 + glow_out + glow_in + streak
    i *= radial_window(r, 112, 126)
    save_rgb(tint(i, (150, 190, 255), (255, 255, 255)) , path, (256, 256))

# ───────────────────────── speedlines 1024×512 ─────────────────────────
def speedlines(path):
    S = 2; W, H = 1024 * S, 512 * S
    x, y = grid(W, H); cx, cy = (W - 1) / 2, (H - 1) / 2
    dx, dy = (x - cx) / (W / 2), (y - cy) / (H / 2)       # 타원 좌표(−1~1)
    r = np.hypot(dx, dy); th = np.arctan2(dy, dx)
    g = rng(21); n = 16384
    prof = np.zeros(n, np.float32); inner = np.ones(n, np.float32)
    # 코드(fx.js cutin)는 이 그림을 hypot(W,H)/512 ≈ 2.9배로 키워 화면에 깐다 → 화면에 보이는 건 가운데 |dx|≤0.44·|dy|≤0.49 뿐.
    #   선의 안쪽 끝을 0.16~0.42 로 당겨야 화면 가장자리에서 선이 보인다(0.34~0.75 였을 땐 모서리에만 몇 가닥).
    for k in range(190):
        c = g.integers(0, n); w = 4 * g.choice([5, 6, 8, 10, 14, 22], p=[.25, .25, .22, .15, .09, .04]); amp = g.uniform(0.45, 1.0)
        r_in = g.uniform(0.16, 0.42)
        idx = (np.arange(-w * 3, w * 3 + 1) + c) % n
        sh = amp * np.clip(1 - np.abs(np.arange(-w * 3, w * 3 + 1)) / w, 0, 1)      # 삼각형 단면 = 쐐기
        better = sh > prof[idx]
        prof[idx] = np.where(better, sh, prof[idx]); inner[idx] = np.where(better, r_in, inner[idx])
    a_idx = ((th.astype(np.float64) + np.pi) / (2 * np.pi) * n).astype(np.int64) % n   # n=16384: 가장 먼 곳에서도 색인 한 칸 < 0.5px (4096 은 가는 선이 점선으로 깨졌다)
    p = prof[a_idx]; rin = inner[a_idx]
    # 쐐기: 안쪽 끝(rin)에서 0, 바깥으로 갈수록 굵고 밝게
    t = np.clip((r - rin) / (0.95 - rin), 0, 1)
    i = smooth(np.clip(p - (1 - t) * 0.85, 0, 1) * 3) * smooth(t * 2.5)
    i = gaussian_filter(i, 1.3)
    i = np.clip(i * 1.15, 0, 1)
    i *= edge_window(W, H, 40 * S)
    save_rgb(np.dstack([i, i, i]), path, (1024, 512))

# ───────────────────────── impact 128 / spark 64 ─────────────────────────
def burst(path, size, seed, rays, core_r, ray_len, lo, hi, thin):
    S = 4; W = size * S
    x, y = grid(W, W); c = (W - 1) / 2
    dx, dy = x - c, y - c; r = np.hypot(dx, dy) / (W / 2); th = np.arctan2(dy, dx)
    g = rng(seed); i = np.zeros((W, W), np.float32)
    for k in range(rays):
        a = g.uniform(-np.pi, np.pi) if k >= 4 else (k * np.pi / 2 + g.uniform(-0.25, 0.25) + 0.4)
        L = ray_len * g.uniform(0.55, 1.0) if k >= 4 else ray_len
        wd = thin * g.uniform(0.6, 1.3)
        d = np.angle(np.exp(1j * (th - a)))
        perp = np.abs(np.sin(d)) * r; along = np.cos(d) * r
        w_at = wd * np.clip(1 - along / L, 0, 1) + 0.002
        ray = np.exp(-(perp / w_at) ** 2) * (along > 0) * np.clip(1 - along / L, 0, 1) ** 0.8
        i = np.maximum(i, ray * g.uniform(0.7, 1.0))
    core = np.exp(-(r / core_r) ** 2) * 1.3
    halo = np.exp(-(r / (core_r * 2.6)) ** 2) * 0.45
    i = np.maximum(i, core) + halo
    i *= radial_window(r, 0.80, 0.97)
    save_rgb(tint(i, lo, hi), path, (size, size))

def impact(path): burst(path, 128, 31, 26, 0.17, 0.95, (255, 150, 50), (255, 250, 225), 0.055)
def spark(path): burst(path, 64, 32, 9, 0.14, 0.92, (255, 170, 60), (255, 255, 235), 0.06)

# ───────────────────────── dust 128 ─────────────────────────
def dust(path):
    """뭉게뭉게한 먼지 구름 — 가운데 덩어리 + 둘레 작은 덩어리(콜리플라워 윤곽), 가장자리는 길게 풀린다."""
    S = 4; W = 128 * S
    x, y = grid(W, W); g = rng(41)
    i = np.zeros((W, W), np.float32)
    blobs = [(0.50, 0.55, 0.20, 1.0)]
    for k in range(9):                                   # 둘레 덩어리
        a = k / 9 * 2 * np.pi + g.uniform(-0.25, 0.25); rr = g.uniform(0.15, 0.22)
        blobs.append((0.5 + np.cos(a) * rr * 1.15, 0.54 + np.sin(a) * rr * 0.85, g.uniform(0.09, 0.14), g.uniform(0.55, 0.85)))
    for bx, by, br, amp in blobs:
        r2 = ((x - bx * W) ** 2 + (y - by * W) ** 2) / (br * W) ** 2
        i = np.maximum(i, amp * np.exp(-r2 * 1.1)) + amp * np.exp(-r2 * 0.9) * 0.25
    nz = gaussian_filter(g.random((W, W)).astype(np.float32), 5 * S); nz = (nz - nz.min()) / (nz.max() - nz.min())
    i = np.clip(i, 0, 1.25) / 1.25
    i = i * (0.70 + 0.6 * nz)
    shade = 1.08 - 0.30 * (y / W)                         # 위가 밝은 구름 명암
    i = gaussian_filter(i * shade, S * 1.2)
    r = np.hypot(x - W / 2, y - W / 2) / (W / 2)
    i *= radial_window(r, 0.55, 0.97)
    i = np.clip(i, 0, 1) * 0.85
    col = np.array([1.0, 0.97, 0.92], np.float32)
    save_rgb(i[..., None] * col, path, (128, 128))

# ───────────────────────── slash ─────────────────────────
def _colorize(tot, lo, mid, hi):
    lo = np.array(lo, np.float32) / 255; mid = np.array(mid, np.float32) / 255; hi = np.array(hi, np.float32) / 255
    t1 = smooth(tot / 0.55)[..., None]; t2 = smooth((tot - 0.55) / 0.6)[..., None]
    col = (lo * (1 - t1) + mid * t1) * (1 - t2) + hi * t2
    return col * np.clip(tot * 1.25, 0, 1)[..., None]

def _nz1(n, seed, sig):
    v = gaussian_filter(rng(seed).random(n).astype(np.float32), sig); return (v - v.min()) / (v.max() - v.min())

def crescent(path, size, seed, cols, shift=0.31, tail_len=0.9, tail_amp=0.5, S=2):
    """초승달 베기 — 코드 폴백(BootScene.fbFxCrescent)과 같은 기하: 오른쪽으로 볼록, 바깥 호 중심 (0.49w, 0.5h)·반지름 0.47h·끝점 ±75°,
    안쪽 호는 같은 끝점을 지나고 중심이 shift·h 만큼 왼쪽. 뒤(왼쪽)로 가로 결 잔상이 tail_len·h 까지 끌린다(왼→오른쪽으로 날아가는 느낌)."""
    Wt, Ht = size; W, H = Wt * S, Ht * S
    x, y = grid(W, H); x = x / S; y = y / S
    cy = Ht / 2; r1 = Ht * 0.47; cx1 = Wt * 0.49; A = np.deg2rad(75)
    ex, ey = cx1 + r1 * np.cos(A), r1 * np.sin(A)
    cx2 = cx1 - Ht * shift; r2 = np.hypot(ex - cx2, ey)
    d1 = np.hypot(x - cx1, y - cy); d2 = np.hypot(x - cx2, y - cy)
    o = r1 - d1; inn = d2 - r2                                  # 둘 다 > 0 이면 초승달 안
    inside = (o > 0) & (inn > 0) & (x > cx1)
    thick = np.maximum(o + inn, 1e-3)
    t = np.clip(inn / thick, 0, 1)                              # 0 = 안쪽 호, 1 = 바깥 날
    vi = np.clip((y * S).astype(np.int32), 0, H - 1)
    s1 = _nz1(H, seed, 4 * S)[vi]; s2 = _nz1(H, seed + 2, 0.8 * S)[vi]; s3 = _nz1(H, seed + 3, 1.8 * S)[vi]
    body = inside * (0.30 + 0.70 * t ** 1.6) * (0.60 + 0.55 * s1)
    body *= 1 - 0.35 * np.clip((s2 - 0.55) * 4, 0, 1) * (1 - t)               # 안쪽은 결이 갈라진다
    edge = np.exp(-(np.abs(o) / (Ht * 0.014)) ** 2) * (np.abs(y - cy) < ey) * (x > cx1)   # 날 선
    front = np.exp(-np.clip(-o, 0, None) / (Ht * 0.03)) * (o < 0) * (np.abs(y - cy) < ey * 0.98) * (x > cx1) * 0.45
    # 잔상: 안쪽 호 뒤로 가로 결 — y 마다 길이가 다르고, 위아래 끝으로 갈수록 짧다
    xin = cx2 + np.sqrt(np.clip(r2 ** 2 - (y - cy) ** 2, 0, None))            # 안쪽 호의 x
    behind = xin - x
    yy = np.clip(1 - (np.abs(y - cy) / ey) ** 2, 0, 1)
    L = Ht * tail_len * yy * (0.25 + 0.95 * s3)
    tail = np.clip(1 - behind / np.maximum(L, 1e-3), 0, 1) ** 2.2 * (behind >= 0) * (np.abs(y - cy) < ey) * np.clip((s2 - 0.42) * 3.5, 0, 1) * tail_amp
    i = body + edge * 1.2 + front + tail
    i = gaussian_filter(i, S * 0.6)
    tot = i + gaussian_filter(i, S * Ht * 0.035) * 0.6
    tot *= edge_window(W, H, max(4, Ht // 20) * S)
    save_rgb(_colorize(tot, *cols), path, (Wt, Ht))

def slash_blue(path): crescent(path, (512, 256), 51, ((16, 50, 190), (50, 165, 255), (235, 250, 255)), shift=0.31, tail_len=0.95, tail_amp=0.42, S=2)
def slash_white(path): crescent(path, (256, 128), 57, ((120, 130, 170), (228, 234, 250), (255, 255, 255)), shift=0.27, tail_len=0.6, tail_amp=0.4, S=4)

# ───────────────────────── fog 1024×160 RGBA (field/) ─────────────────────────
def fog(path):
    W, H = 1024, 160; g = rng(61)
    # 주기 잡음: FFT 저역 필터(가로로 길게) — 가로·세로 모두 주기라 tileSprite 로 이음새가 없다
    f = np.fft.fft2(g.standard_normal((H, W)))
    ky = np.fft.fftfreq(H)[:, None]; kx = np.fft.fftfreq(W)[None, :]
    k = np.sqrt((kx * 5.0) ** 2 + (ky * 1.0) ** 2) + 1e-4          # 가로 방향 고주파를 더 눌러 가로로 늘어진 결
    spec = 1.0 / (k ** 1.9) * np.exp(-(k / 0.05) ** 2)
    nz = np.real(np.fft.ifft2(f * spec)); nz = (nz - nz.mean()) / nz.std()
    a = smooth((nz + 0.9) / 2.4)                                   # 0~1, 군데군데 비는 안개
    yy = (np.arange(H, dtype=np.float32) + 0.5) / H
    win = np.sin(np.pi * yy) ** 1.6                                # 위·아래 0 으로
    alpha = a * win[:, None] * 0.92
    alpha[0, :] = 0; alpha[-1, :] = 0
    rgb = np.empty((H, W, 3), np.uint8); rgb[...] = (255, 250, 242)
    out = np.dstack([rgb, (np.clip(alpha, 0, 1) * 255 + 0.5).astype(np.uint8)])
    Image.fromarray(out, 'RGBA').save(path)
    al = out[..., 3].astype(np.float32)
    print(path, (W, H), 'alpha mean %.3f max %d' % (al.mean() / 255, al.max()), 'seam col diff %.2f vs mean %.2f' % (
        np.abs(al[:, 0] - al[:, -1]).mean(), np.abs(np.diff(al, axis=1)).mean()))

ALL = {'ring': ring, 'speedlines': speedlines, 'impact': impact, 'spark': spark, 'dust': dust,
       'slash_white': slash_white, 'slash_blue': slash_blue, 'fog': fog}
if __name__ == '__main__':
    out = sys.argv[1]; names = sys.argv[2:] or list(ALL)
    os.makedirs(out, exist_ok=True)
    for nme in names: ALL[nme](os.path.join(out, nme + '.png'))
