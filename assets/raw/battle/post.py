# -*- coding: utf-8 -*-
"""전투 에셋 후처리 (Pillow + numpy). assets/raw/ui/post.py 의 key 를 가져와 확장.
  python post.py key    <src> <dst> [--bg=green|pink|auto|r,g,b] [--thr=..] [--ramp=..] [--erode=1] [--fit=W,H] [--pad=0] [--desat] [--flip] [--crop=x0,y0,x1,y1] [--anchor=bottom]
                        [--fillholes=600] 캔버스 가장자리에 안 닿는 알파 0 구멍(<N px)을 원본 RGB 로 복원(홍채 등 배경색과 가까운 내부 영역)
                        [--bgkeep=15] 원본 RGB 가 배경색과 거리 < N 인 픽셀은 진짜 배경(머리카락 틈)이라 fillholes·close 뒤에도 키잉 알파 유지(통합 수정)
                        [--close=1] 알파 closing(팽창→침식) — 키잉된 혼합 픽셀 톱니 메움   [--decontam] 반투명 픽셀 RGB 를 가장 가까운 불투명 픽셀 색으로(배경 프린지 제거), 알파 0 은 RGB 0
                        [--gain=1.0] 밝기 배수(어두운 망토 등)
                        [--fillnear=300] (컷인 2차) 가장자리 미접촉 알파 0 구멍(<N px)+둘레 2px 를 알파 255 로 메우되 RGB 는 가장 가까운 진짜 전경색(알파 255·배경 거리≥30) — 배경색과 같은 하이라이트 선이 뚫렸을 때. --bgkeep 뒤에 적용
  python post.py sky    <src> <dst>  --crop=x0,y0,x1,y1 [--loop=128] → 2048x720 Lanczos (--loop: 양끝 N px 페더로 가로 루프)
  python post.py far    <src> <dst>  --crop=x0,y0,x1,y1 [--fade=px] [--lum --lo=.. --hi=..] [--feather=96] → 2048x360, 위 알파 페이드, 좌우 페더 루프
  python post.py ground <src> <dst>  --crop=x0,y0,x1,y1 [--feather=64] → 1024x320 좌우 페더 블렌드(seamless)
  python post.py seam   <png> [--w=64]  좌우 끝 w px 를 겹쳐 붙여 이음새 확인용 그림 저장(<png>_seam.png)
  python post.py sheet  <out> <png...> [--scale=0.3] 체커 위에 나란히(원본 + 축소본) — 병종 판독용
  python post.py check  <png...>
"""
import sys, numpy as np
from PIL import Image, ImageFilter

def arg(k, d=None):
    for a in sys.argv:
        if a.startswith('--' + k + '='): return a[len(k) + 3:]
    return d
def has(k): return ('--' + k) in sys.argv
def ints(s): return tuple(int(v) for v in s.split(','))

BG = {'green': (0, 255, 0), 'black': (0, 0, 0), 'white': (255, 255, 255)}

def bg_color(a, name):
    if name in BG: return np.array(BG[name], dtype=np.float32)
    if name in ('auto', 'pink'):  # 네 모서리 16px 평균 (분홍은 생성마다 톤이 달라 모서리에서 잰다)
        c = np.concatenate([a[:16, :16].reshape(-1, 3), a[:16, -16:].reshape(-1, 3), a[-16:, :16].reshape(-1, 3), a[-16:, -16:].reshape(-1, 3)])
        return c.mean(0)
    return np.array(ints(name), dtype=np.float32)

def key_alpha(rgb, bg, thr, ramp=None):
    d = np.sqrt(((rgb.astype(np.float32) - bg) ** 2).sum(-1))
    a = np.clip((d - thr) / max(ramp or thr, 1), 0, 1)
    return (a * 255).astype(np.uint8)

def green_key_alpha(rgb, thr):
    f = rgb.astype(np.float32)
    g_dom = f[..., 1] - np.maximum(f[..., 0], f[..., 2])
    a = np.clip((thr - g_dom) / max(thr, 1), 0, 1)
    return (a * 255).astype(np.uint8)

def despill_green(rgb):
    f = rgb.astype(np.float32)
    m = np.maximum(f[..., 0], f[..., 2])
    f[..., 1] = np.minimum(f[..., 1], m + 8)
    return f.clip(0, 255).astype(np.uint8)

def erode_alpha(alpha, n):
    im = Image.fromarray(alpha)
    for _ in range(n): im = im.filter(ImageFilter.MinFilter(3))
    return np.array(im)

def despeckle(alpha, min_px):
    """min_px 미만 크기의 불투명 조각 제거 (scipy.ndimage.label)."""
    from scipy import ndimage
    lab, n = ndimage.label(alpha > 0)
    if n == 0: return alpha
    sizes = ndimage.sum(np.ones_like(alpha, dtype=np.float32), lab, range(1, n + 1))
    keep = np.zeros(n + 1, bool); keep[1:] = sizes >= min_px
    return np.where(keep[lab], alpha, 0).astype(np.uint8)

def fill_holes(alpha, max_px, ring=4):
    """검수 수정: 알파 0 연결 성분 중 캔버스 가장자리에 안 닿고 max_px 미만인 것을 알파 255 로 복원.
    (장비 컷인의 초록 홍채가 배경색과 거리 ~40 이라 thr=45 에 뚫렸다 — 눈 구멍 2개 ~300px. 정당한 머리카락 틈은 1000px 이상이라 살아남는다.)
    ring: 구멍 둘레 ring px 의 반투명(0<a<255) 픽셀도 255 로 — 키잉 램프가 남긴 테두리까지 메워야 상자 알파 평균이 1.0 이 된다.
    ※ 배경색 그대로인 작은 틈(머리카락 사이)도 메운다 — do_key 의 --bgkeep 이 되돌린다(통합 수정)."""
    from scipy import ndimage
    lab, n = ndimage.label(alpha == 0)
    if n == 0: return alpha, 0
    sizes = ndimage.sum(np.ones_like(alpha, dtype=np.float32), lab, range(1, n + 1))
    edge = np.zeros(n + 1, bool)
    for strip in (lab[0], lab[-1], lab[:, 0], lab[:, -1]): edge[np.unique(strip)] = True
    fill = np.zeros(n + 1, bool); fill[1:] = sizes < max_px; fill &= ~edge; fill[0] = False
    m = fill[lab]
    if ring:
        # 구멍을 품은 반투명(a<255) 연결 성분 전체를 메운다(가장자리 미접촉일 때) — 램프 테두리가 구멍보다 넓어도 남김없이.
        lab2, n2 = ndimage.label(alpha < 255)
        hit = np.zeros(n2 + 1, bool); hit[np.unique(lab2[m])] = True; hit[0] = False
        for strip in (lab2[0], lab2[-1], lab2[:, 0], lab2[:, -1]): hit[np.unique(strip)] = False
        m = m | hit[lab2]
    out = np.where(m, 255, alpha).astype(np.uint8)
    return out, int(fill.sum())

def close_alpha(alpha, n):
    """알파 closing(팽창 n → 침식 n): 키잉된 혼합 픽셀이 만든 톱니·점 구멍을 메운다."""
    im = Image.fromarray(alpha)
    for _ in range(n): im = im.filter(ImageFilter.MaxFilter(3))
    for _ in range(n): im = im.filter(ImageFilter.MinFilter(3))
    return np.array(im)

def decontaminate(rgb, alpha):
    """반투명(0<a<255) 픽셀의 RGB 를 가장 가까운 불투명 픽셀 색으로 치환(배경 프린지 제거), 알파 0 픽셀은 RGB 0.
    (관우 머리카락 가장자리 1px 붉은 프린지 — 분홍 배경 혼합.)"""
    from scipy import ndimage
    opaque = alpha == 255
    if not opaque.any(): return rgb
    idx = ndimage.distance_transform_edt(~opaque, return_distances=False, return_indices=True)
    out = rgb[idx[0], idx[1]]
    semi = (alpha > 0) & ~opaque
    res = rgb.copy(); res[semi] = out[semi]; res[alpha == 0] = 0
    return res

def fill_near(rgb, alpha, max_px, bg, ring=2):
    """컷인 2차(하후돈): 캔버스 가장자리에 안 닿는 알파 0 구멍(<max_px)과 둘레 ring px 의 반투명 픽셀을 알파 255 로 메우되,
    RGB 는 원본(배경색 그대로)이 아니라 가장 가까운 「진짜 전경」(알파 255 이고 배경색과 거리 >= 30) 픽셀 색으로.
    칼날 가장자리의 분홍 반사선이 배경색과 같아 거리 키잉에 2~3px 슬릿으로 뚫렸다 — --fillholes 는 분홍 패치를 되살리고(배경 거리<30 불투명 픽셀 0 규칙 위반),
    --bgkeep 은 원본 RGB 기준이라 다시 뚫는다 → bgkeep 뒤에 적용한다. 진짜 배경 틈(칼과 몸 사이 577px+)은 max_px 아래로 잡아 남긴다."""
    from scipy import ndimage
    lab, n = ndimage.label(alpha == 0)
    if n == 0: return rgb, alpha, 0
    sizes = ndimage.sum(np.ones_like(alpha, dtype=np.float32), lab, range(1, n + 1))
    edge = np.zeros(n + 1, bool)
    for strip in (lab[0], lab[-1], lab[:, 0], lab[:, -1]): edge[np.unique(strip)] = True
    fill = np.zeros(n + 1, bool); fill[1:] = sizes < max_px; fill &= ~edge; fill[0] = False
    m = fill[lab]
    if ring: m = ndimage.binary_dilation(m, iterations=ring) & (alpha < 255)
    good = (alpha == 255) & (np.sqrt(((rgb.astype(np.float32) - bg) ** 2).sum(-1)) >= 30) & ~m
    idx = ndimage.distance_transform_edt(~good, return_distances=False, return_indices=True)
    out = rgb.copy(); out[m] = rgb[idx[0], idx[1]][m]
    return out, np.where(m, 255, alpha).astype(np.uint8), int(fill.sum())

def trim(img):
    bb = img.split()[-1].getbbox()
    return img.crop(bb) if bb else img

def fit(img, W, H, pad=0, anchor='center'):
    w, h = img.size
    s = min((W - 2 * pad) / w, (H - 2 * pad) / h)
    nw, nh = max(1, round(w * s)), max(1, round(h * s))
    r = img.resize((nw, nh), Image.LANCZOS)
    out = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    y = (H - nh) // 2 if anchor == 'center' else H - pad - nh   # bottom: 발밑을 아래 변에 맞춤(병사 스프라이트)
    out.paste(r, ((W - nw) // 2, y), r)
    return out

def do_key():
    src, dst = sys.argv[2], sys.argv[3]
    im = Image.open(src).convert('RGB')
    c = arg('crop')
    if c: im = im.crop(ints(c))
    a = np.array(im)
    bgn = arg('bg', 'green'); thr = float(arg('thr', 60)); er = int(arg('erode', 1))
    if bgn == 'green':
        al = green_key_alpha(a, thr); a = despill_green(a)
    else:
        al = key_alpha(a, bg_color(a, bgn), thr, float(arg('ramp', 0)) or None)
    if er: al = erode_alpha(al, er)
    ds = int(arg('despeckle', 0))
    if ds: al = despeckle(al, ds)
    # 통합 수정 --bgkeep=N: 원본 RGB 가 배경색과 거리 < N 인 픽셀(진짜 배경 — 머리카락 사이 틈)은 fillholes·close 를 거쳐도 키잉 직후 알파를 지킨다.
    #   재검수에서 fillholes 가 관우 머리카락 틈 10곳(최대 58×36)을 분홍 그대로 메웠고, close=1 이 장비의 2px 틈(44px)을 초록으로 메웠다.
    #   홍채(장비 초록 눈)는 배경과 거리 ~40 이라 N=15 에 안 걸린다. 배경 'green'(G 우세도 키잉)엔 색 거리를 못 재서 적용 안 함.
    #   --bgkeepskip=x0,y0,x1,y1[;x0,y0,x1,y1] 은 bgkeep 을 적용하지 않는 상자(장비의 눈 두 개 — 홍채 안에도 배경과 거리 <15 인 픽셀이
    #   있어 색만으로는 못 가른다. 15/20/25 전부 눈 상자 min 알파 0 이 나왔다).
    bk = float(arg('bgkeep', 0))
    bgkeep = None
    if bk and bgn != 'green':
        keep = np.sqrt(((a.astype(np.float32) - bg_color(a, bgn)) ** 2).sum(-1)) < bk
        for box in (arg('bgkeepskip', '') or '').split(';'):
            if box:
                x0, y0, x1, y1 = ints(box); keep[y0:y1, x0:x1] = False
        bgkeep = (keep, al.copy())
    fh = int(arg('fillholes', 0))           # 검수 수정: 내부 구멍 복원(장비 눈)
    if fh:
        al, nf = fill_holes(al, fh, int(arg('fillring', 4))); print('fillholes <%d: %d 개 복원' % (fh, nf))
    cl = int(arg('close', 0))               # 검수 수정: 톱니 가장자리 closing
    if cl: al = close_alpha(al, cl)
    if bgkeep is not None:
        al = np.where(bgkeep[0], bgkeep[1], al).astype(np.uint8)
        print('bgkeep <%g: 배경색 픽셀 %d (키잉 알파 유지)' % (bk, int(bgkeep[0].sum())))
    fn = int(arg('fillnear', 0))            # 컷인 2차: 배경색 하이라이트 슬릿을 가까운 전경색으로 메움(bgkeep 뒤)
    if fn:
        bgc = np.array(BG['green'], np.float32) if bgn == 'green' else bg_color(a, bgn)
        a, al, nf = fill_near(a, al, fn, bgc, int(arg('fillring', 2))); print('fillnear <%d: %d 개 메움(가까운 전경색)' % (fn, nf))
    if has('decontam'): a = decontaminate(a, al)   # 검수 수정: 프린지 제거
    gain = float(arg('gain', 1))
    if gain != 1: a = (a.astype(np.float32) * gain).clip(0, 255).astype(np.uint8)
    sat = 0.0 if has('desat') else float(arg('sat', 1))
    if sat < 1:  # 부분 탈색: 코드 tint 가 편 색을 깨끗이 입히도록 채도를 줄인다
        f = a.astype(np.float32); g = f @ np.array([0.299, 0.587, 0.114], np.float32)
        a = (g[..., None] * (1 - sat) + f * sat).clip(0, 255).astype(np.uint8)
    out = Image.fromarray(np.dstack([a, al]), 'RGBA')
    if has('flip'): out = out.transpose(Image.FLIP_LEFT_RIGHT)
    out = trim(out)
    f = arg('fit')
    if f: out = fit(out, *ints(f), pad=int(arg('pad', 0)), anchor=arg('anchor', 'center'))
    out.save(dst); print(dst, out.size)

def do_sky():
    src, dst = sys.argv[2], sys.argv[3]
    im = Image.open(src).convert('RGB').crop(ints(arg('crop')))
    lp = int(arg('loop', 0))   # 검수 지적: 가로 루프가 아니라 tileSprite 로 못 깐다 → 양끝 N px 페더 루프(선택)
    if lp:
        out = np.array(im.resize((2048 + lp, 720), Image.LANCZOS))
        out = Image.fromarray(loop_blend(out, lp).clip(0, 255).astype(np.uint8))
    else:
        out = im.resize((2048, 720), Image.LANCZOS)
    out.save(dst); print(dst, out.size)

def loop_blend(a, feather):
    """가로 루프: 입력 폭 = W+feather. 오른쪽 여분(W~W+feather)을 왼쪽 0~feather 에 선형 블렌드해
    x=0 이 x=W 의 연장이 되게 한다(끝과 시작이 이어짐)."""
    H, Wf = a.shape[:2]; W = Wf - feather
    out = a[:, :W].astype(np.float32).copy()
    tail = a[:, W:Wf].astype(np.float32)
    t = np.linspace(0, 1, feather, dtype=np.float32)[None, :, None]
    out[:, :feather] = tail * (1 - t) + out[:, :feather] * t
    return out

def do_ground():
    src, dst = sys.argv[2], sys.argv[3]
    fe = int(arg('feather', 64))
    x0, y0, x1, y1 = ints(arg('crop'))
    im = Image.open(src).convert('RGB').crop((x0, y0, x1, y1))
    s = 320 / (y1 - y0)
    im = im.resize((int(round((x1 - x0) * s)), 320), Image.LANCZOS)
    a = np.array(im)
    if a.shape[1] < 1024 + fe: raise SystemExit('crop 이 좁다: 폭 %d < %d' % (a.shape[1], 1024 + fe))
    a = a[:, :1024 + fe]
    out = loop_blend(a, fe)
    gain = float(arg('gain', 1)); gamma = float(arg('gamma', 1))   # 어두운 생성물 밝히기
    out = (np.power(out / 255, 1 / gamma) * 255 * gain).clip(0, 255).astype(np.uint8)
    Image.fromarray(out).save(dst); print(dst, out.shape)

def do_far():
    src, dst = sys.argv[2], sys.argv[3]
    fe = int(arg('feather', 96)); fade = int(arg('fade', 120))
    x0, y0, x1, y1 = ints(arg('crop'))
    im = Image.open(src).convert('RGB').crop((x0, y0, x1, y1))
    s = 360 / (y1 - y0)
    im = im.resize((int(round((x1 - x0) * s)), 360), Image.LANCZOS)
    a = np.array(im).astype(np.float32)
    if a.shape[1] < 2048 + fe: raise SystemExit('crop 이 좁다: 폭 %d < %d' % (a.shape[1], 2048 + fe))
    a = a[:, :2048 + fe]
    rgb = loop_blend(a, fe)
    H = rgb.shape[0]
    if has('lum'):
        # 밝기 → 알파(먹빛 산 = 불투명, 흰 여백 = 투명). --lo/--hi 로 구간.
        lo = float(arg('lo', 0.55)); hi = float(arg('hi', 0.92))
        L = (rgb @ np.array([0.299, 0.587, 0.114], np.float32)) / 255
        al = np.clip((hi - L) / (hi - lo), 0, 1)
    else:
        al = np.ones((H, rgb.shape[1]), np.float32)
    tint = arg('tint')  # --tint=r0,g0,b0,r1,g1,b1 : 밝기 L 로 어두운색→밝은색 램프(수묵 산을 노을빛 실루엣으로)
    if tint:
        t = np.array(ints(tint), np.float32); L = (rgb @ np.array([0.299, 0.587, 0.114], np.float32)) / 255
        L = L[..., None]; rgb = t[:3] * (1 - L) + t[3:] * L
    ramp = np.clip(np.arange(H, dtype=np.float32) / max(fade, 1), 0, 1)[:, None]  # 위쪽 세로 페이드
    al = al * ramp
    solid = int(arg('solid', 0))  # 아래 solid px 는 불투명으로 올림(땅과 만나는 부분)
    if solid:
        ramp2 = np.linspace(0, 1, solid, dtype=np.float32)[:, None]
        al[H - solid:] = np.maximum(al[H - solid:], ramp2)
    out = np.dstack([rgb.clip(0, 255).astype(np.uint8), (al * 255).astype(np.uint8)])
    Image.fromarray(out, 'RGBA').save(dst); print(dst, out.shape)

def do_seam():
    f = sys.argv[2]; w = int(arg('w', 64))
    im = Image.open(f).convert('RGBA'); W, H = im.size
    out = Image.new('RGBA', (2 * w, H), (255, 0, 255, 255))
    out.alpha_composite(im.crop((W - w, 0, W, H)), (0, 0)); out.alpha_composite(im.crop((0, 0, w, H)), (w, 0))
    o = f.rsplit('.', 1)[0] + '_seam.png'; out.save(o); print(o, out.size)

def do_sheet():
    out = sys.argv[2]; files = [a for a in sys.argv[3:] if not a.startswith('--')]
    sc = float(arg('scale', 0.3))
    ims = [Image.open(f).convert('RGBA') for f in files]
    mh = max(i.height for i in ims)
    W = sum(i.width for i in ims) + 20 * (len(ims) + 1)
    H = mh + 40 + int(mh * sc) + 20
    bg = Image.new('RGBA', (W, H), (70, 100, 150, 255))
    for y in range(0, H, 16):
        for x in range(0, W, 16):
            if (x // 16 + y // 16) % 2: bg.paste((120, 120, 120, 255), (x, y, x + 16, y + 16))
    x = 20; top = mh + 40
    for i in ims:
        bg.alpha_composite(i, (x, 20))
        s = i.resize((max(1, int(i.width * sc)), max(1, int(i.height * sc))), Image.LANCZOS)
        bg.alpha_composite(s, (x, top))
        x += i.width + 20
    bg.save(out); print(out, bg.size)

def do_check():
    for f in sys.argv[2:]:
        im = Image.open(f); a = np.array(im.convert('RGBA')); al = a[..., 3]
        print('%-50s %s %s alpha[min=%d max=%d transparent=%.1f%%] corners=%s' % (
            f, im.size, im.mode, al.min(), al.max(), (al == 0).mean() * 100,
            [int(al[0, 0]), int(al[0, -1]), int(al[-1, 0]), int(al[-1, -1])]))

if __name__ == '__main__':
    {'key': do_key, 'sky': do_sky, 'far': do_far, 'ground': do_ground, 'seam': do_seam, 'sheet': do_sheet, 'check': do_check}[sys.argv[1]]()
