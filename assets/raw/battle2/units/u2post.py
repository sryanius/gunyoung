"""units2 후처리 (assets/battle/units2 — 128x160 알파, 오른쪽 보기, 발끝 y=152).
키잉 함수는 assets/raw/battle/post.py 의 것을 그대로 가져다 쓴다(거리 키잉·침식·despeckle·decontam).

  python u2post.py bg   <png...>                       테두리 8px 링의 중앙값 배경색과 편차(키잉 thr 고르기)
  python u2post.py key  <src> <master.png> [--bg=auto|r,g,b] [--thr=55] [--ramp=40] [--erode=1] [--despeckle=300]
                        [--flip] [--crop=x0,y0,x1,y1] [--cutbelow=Y] [--close=1] [--bgkeep=20]
        → 트림한 원본 해상도 RGBA 마스터. --bg=auto 는 테두리 링 중앙값(모서리 평균보다 그라데이션·장식 띠에 덜 흔들린다).
          --cutbelow=Y: 원본 y>=Y 를 버린다(받침대·바닥 그림자).  --erase=x0,y0,x1,y1[;...]: 상자 안 알파 0(배경 장식).
  python u2post.py fit  <master.png> <dst.png> --h=130 [--headtop=auto|Y] [--cx=auto|X] [--canvas=128,160] [--toe=152] [--sharp=60]
        → 머리끝(headtop, 마스터 좌표)~발끝(bbox 아래) 을 h px 로 맞춰 줄이고, 발끝을 y=toe, 몸 중심(cx)을 캔버스 가운데로.
          bbox 가 캔버스를 벗어나면 cx 를 밀어 넣고, 그래도 넘치면(폭>캔버스) 그만큼만 더 줄인다(경고 출력).
          headtop auto = 위에서부터 불투명 폭이 bbox 높이의 9% 를 처음 넘는 행(창끝·투구 침 같은 가는 것은 머리로 안 친다).
          cx auto = 아래 18% 띠(발)의 알파 무게중심 x.
  python u2post.py flat <master.png> <dst.png> --h=130 [--headtop=..] [--cx=..] [--bg=255,0,255] [--k=2.8] [--padx=12.5]
        → Qwen 편집 입력(383x448, 자홍 단색 배경): fit 과 **같은 배치**(128x160)를 k=2.8 배로 그리고 좌우에 padx 씩 덧댄다.
          383:448 = 944:1104 — edit.py 의 FluxKontextImageScale 이 고르는 해상도와 같은 비율이라 늘어나지 않는다. 결과(944x1104)는 입력의 2.4643 배.
  python u2post.py unflat <qwen_out.png> <master_out.png> <dst.png> [--thr=60] [--ramp=40] [--refit --h=130 ...] [--dx=0]
        → 편집 결과를 키잉(테두리 링 배경색)해 마스터로 저장하고, 128x160 으로: 기본은 **배치 유지**(배율 160/1104 고정, 가운데 128 폭,
          발끝만 y=toe 로 다시 맞춤 — attack·색 바꾸기용: stand 와 같은 크기·같은 자리). --refit 은 fit 처럼 머리끝~발끝을 재서 다시 맞춘다(새 stand 용).
  python u2post.py shrink <qwen_out.png> <in.png>      편집 결과(944x1104) → 다음 편집 입력(383x448)
          --fillnear=250: 편집 결과 안쪽의 작은 키잉 구멍(자홍 반사광 점)을 가까운 전경색으로 메움(0 = 끔).
          --degreen: (파랑 편) 남은 초록 픽셀을 파랑으로 돌린다.
          fit·unflat 은 <dst>.json 에 bbox 가 놓인 자리·크기(x, y, w, h)를 남긴다. --same=<초록.json> 을 주면 편집 결과의 bbox 를 그 자리·크기에 그대로 맞춘다(파랑 = 초록과 같은 자리).
  python u2post.py measure <png...>                    128x160 결과 검사: bbox·머리끝(auto)~발끝 높이·발끝 y·조각 수·반투명 비율
  python u2post.py sheet <out.png> <cols> <png...> [--scale=2] [--bg=70,90,60]   결과 시트(땅색 위)
"""
import sys, os
import numpy as np
from PIL import Image, ImageFilter, ImageDraw
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'battle'))
import post as P   # key_alpha, erode_alpha, despeckle, close_alpha, decontaminate, trim

def arg(k, d=None):
    for a in sys.argv:
        if a.startswith('--' + k + '='): return a[len(k) + 3:]
    return d
def has(k): return ('--' + k) in sys.argv
def ints(s): return tuple(int(v) for v in s.split(','))
def files(start): return [a for a in sys.argv[start:] if not a.startswith('--')]

def ring_bg(a, w=8):
    r = np.concatenate([a[:w].reshape(-1, 3), a[-w:].reshape(-1, 3), a[:, :w].reshape(-1, 3), a[:, -w:].reshape(-1, 3)]).astype(np.float32)
    med = np.median(r, 0)
    d = np.sqrt(((r - med) ** 2).sum(-1))
    return med, float(np.percentile(d, 50)), float(np.percentile(d, 95)), float(d.max())

def do_bg():
    for f in files(2):
        a = np.array(Image.open(f).convert('RGB')); med, p50, p95, mx = ring_bg(a)
        print('%-32s bg=(%d,%d,%d) 링 편차 p50=%.1f p95=%.1f max=%.1f' % (os.path.basename(f), *med, p50, p95, mx))

def do_key():
    src, dst = sys.argv[2], sys.argv[3]
    im = Image.open(src).convert('RGB')
    a = np.array(im)
    bgn = arg('bg', 'auto')
    bg = ring_bg(a)[0] if bgn == 'auto' else np.array(ints(bgn), np.float32)
    thr = float(arg('thr', 55)); ramp = float(arg('ramp', 40))
    al = P.key_alpha(a, bg, thr, ramp)
    cb = arg('cutbelow')
    if cb: al[int(cb):] = 0
    for box in (arg('erase', '') or '').split(';'):
        if box:
            x0, y0, x1, y1 = ints(box); al[y0:y1, x0:x1] = 0
    c = arg('crop')
    if c:
        x0, y0, x1, y1 = ints(c); m = np.zeros_like(al); m[y0:y1, x0:x1] = 1; al = al * m
    keyed = al.copy()
    er = int(arg('erode', 1))
    if er: al = P.erode_alpha(al, er)
    ds = int(arg('despeckle', 300))
    if ds: al = P.despeckle(al, ds)
    cl = int(arg('close', 0))
    if cl:
        al = P.close_alpha(al, cl)
        bk = float(arg('bgkeep', 20))   # close 가 메운 배경색 틈은 되돌린다(battle/NOTES 실패 기록)
        keep = np.sqrt(((a.astype(np.float32) - bg) ** 2).sum(-1)) < bk
        al = np.where(keep, np.minimum(al, keyed), al).astype(np.uint8)
    a = P.decontaminate(a, al)
    out = Image.fromarray(np.dstack([a, al]), 'RGBA')
    if has('flip'): out = out.transpose(Image.FLIP_LEFT_RIGHT)
    out = P.trim(out)
    out.save(dst)
    print('%s bg=(%d,%d,%d) thr=%g → %s %s' % (os.path.basename(src), *bg, thr, os.path.basename(dst), out.size))

def head_top(al, frac=0.09):
    ys = np.where(al.max(1) > 128)[0]; y0, y1 = ys[0], ys[-1]
    need = max(3, frac * (y1 - y0 + 1))
    w = (al > 128).sum(1)
    for y in range(y0, y1):
        if w[y] >= need and w[y:y + 6].min() >= need * 0.8: return int(y)
    return int(y0)

def feet_cx(al, band=0.18):
    ys = np.where(al.max(1) > 128)[0]; y0, y1 = ys[0], ys[-1]
    b = al[int(y1 - band * (y1 - y0)):y1 + 1].astype(np.float32)
    xs = np.arange(al.shape[1], dtype=np.float32)
    return float((b.sum(0) * xs).sum() / max(b.sum(), 1))

def premul_resize(img, size):
    a = np.array(img).astype(np.float32); al = a[..., 3:4] / 255
    pm = Image.fromarray(np.dstack([a[..., :3] * al, a[..., 3:4]]).clip(0, 255).astype(np.uint8), 'RGBA').resize(size, Image.LANCZOS)
    b = np.array(pm).astype(np.float32); bl = np.maximum(b[..., 3:4] / 255, 1e-4)
    rgb = (b[..., :3] / bl).clip(0, 255)
    rgb[b[..., 3] == 0] = 0
    return Image.fromarray(np.dstack([rgb, b[..., 3:4]]).astype(np.uint8), 'RGBA')

def params(al):
    ht = arg('headtop', 'auto'); ht = head_top(al) if ht == 'auto' else int(ht)
    cx = arg('cx', 'auto'); cx = feet_cx(al) if cx == 'auto' else float(cx)
    ys = np.where(al.max(1) > 128)[0]
    return ht, cx, int(ys[-1]) + 1

def layout(m, al):
    """128x160 배치 계산 → (배율, 붙일 x, 붙일 y, 메모)."""
    W, H = ints(arg('canvas', '128,160')); toe = int(arg('toe', 152)); h = float(arg('h', 130))
    ht, cx, foot = params(al)
    s = h / (foot - ht)
    note = ' headtop=%d cx=%.0f foot=%d' % (ht, cx, foot)
    if m.width * s > W:                      # 무기가 길어 폭이 넘친다 → 그만큼 더 줄인다
        s2 = W / m.width; note += ' 폭 넘침: 배율 %.4f→%.4f (몸 높이 %.0f)' % (s, s2, (foot - ht) * s2); s = s2
    if foot * s > toe:                       # 머리 위(창끝·깃)가 캔버스 위로 넘친다
        s2 = toe / foot; note += ' 위 넘침: 배율 %.4f→%.4f (몸 높이 %.0f)' % (s, s2, (foot - ht) * s2); s = s2
    nw = max(1, round(m.width * s))
    x = round(W / 2 - cx * s) + int(arg('dx', 0)); x = min(max(x, 0), W - nw)
    y = toe - round(foot * s)
    return s, x, y, note + ' 몸 중심 x=%.1f' % (x + cx * s)

def finish(r, x, y, dst, W=128, H=160):
    sh = int(arg('sharp', 60))
    if sh:                                   # 6배 축소로 뭉개진 선을 살짝 세운다(RGB 만)
        rgb = r.convert('RGB').filter(ImageFilter.UnsharpMask(radius=1, percent=sh, threshold=2))
        r = Image.merge('RGBA', (*rgb.split(), r.split()[3]))
    out = Image.new('RGBA', (W, H), (0, 0, 0, 0)); out.paste(r, (x, y), r)
    o = np.array(out); o[..., 3][o[..., 3] < 8] = 0
    # 128x160 에서 3px 이하 안쪽 구멍(알파 0, 가장자리 미접촉)은 반짝이 점으로 보인다 → 가까운 불투명 색으로 메움
    from scipy import ndimage
    lab, n = ndimage.label(o[..., 3] == 0)
    if n > 1:
        sizes = ndimage.sum(np.ones(lab.shape, np.float32), lab, range(1, n + 1))
        edge = np.zeros(n + 1, bool)
        for strip in (lab[0], lab[-1], lab[:, 0], lab[:, -1]): edge[np.unique(strip)] = True
        fill = np.zeros(n + 1, bool); fill[1:] = sizes <= 3; fill &= ~edge; fill[0] = False
        mk = fill[lab]
        if mk.any():
            idx = ndimage.distance_transform_edt(o[..., 3] < 255, return_distances=False, return_indices=True)
            o[mk] = o[idx[0], idx[1]][mk]
    lab, n = ndimage.label(o[..., 3] > 0)            # 떨어진 4px 미만 점(활시위 끊긴 자국) 제거
    if n > 1:
        sizes = ndimage.sum(np.ones(lab.shape, np.float32), lab, range(1, n + 1))
        small = np.zeros(n + 1, bool); small[1:] = sizes < 4
        o[small[lab]] = 0
    o[o[..., 3] == 0] = 0
    Image.fromarray(o, 'RGBA').save(dst)

def do_fit():
    src, dst = sys.argv[2], sys.argv[3]
    m = Image.open(src).convert('RGBA'); al = np.array(m)[..., 3]
    s, x, y, note = layout(m, al)
    r = premul_resize(m, (max(1, round(m.width * s)), max(1, round(m.height * s))))
    finish(r, x, y, dst)
    import json
    json.dump({'x': x, 'y': y, 'w': r.width, 'h': r.height, 'src': os.path.basename(src)}, open(dst[:-4] + '.json', 'w'))
    print('%s → %s 배율 %.4f x=%d y=%d%s' % (os.path.basename(src), os.path.basename(dst), s, x, y, note))

def do_flat():
    src, dst = sys.argv[2], sys.argv[3]
    m = Image.open(src).convert('RGBA'); al = np.array(m)[..., 3]
    k = float(arg('k', 2.8)); padx = float(arg('padx', 12.5)); bg = ints(arg('bg', '255,0,255'))
    s, x, y, note = layout(m, al)
    W, H = round(128 * k + 2 * padx), round(160 * k)
    r = premul_resize(m, (max(1, round(m.width * s * k)), max(1, round(m.height * s * k))))
    out = Image.new('RGBA', (W, H), (*bg, 255)); out.paste(r, (round(x * k + padx), round(y * k)), r)
    out.convert('RGB').save(dst)
    print('%s → %s %dx%d (128x160 배치 x=%d y=%d 배율 %.4f ×%.1f)%s' % (os.path.basename(src), os.path.basename(dst), W, H, x, y, s, k, note))

def hsv(a):
    import colorsys
    f = a[..., :3].astype(np.float32) / 255; mx = f.max(-1); mn = f.min(-1); d = mx - mn
    r, g, b = f[..., 0], f[..., 1], f[..., 2]
    h = np.zeros_like(mx); m = d > 1e-6
    i = m & (mx == r); h[i] = ((g - b)[i] / d[i]) % 6
    i = m & (mx == g) & ~(mx == r); h[i] = (b - r)[i] / d[i] + 2
    i = m & (mx == b) & ~(mx == r) & ~(mx == g); h[i] = (r - g)[i] / d[i] + 4
    return h * 60, np.where(mx > 0, d / np.maximum(mx, 1e-6), 0), mx

def green_mask(a):
    h, sat, v = hsv(a)
    return (h > 65) & (h < 175) & (sat > 0.22) & (v > 0.12)

def degreen(a):
    """파랑 편 잔여 초록(Qwen 이 연두 소매·바지를 «green» 으로 안 쳐서 남긴 것)을 파랑으로 돌린다: H 65~175 → 222 근처, S·V 유지(V 는 0.85 배 — 연두가 형광 파랑이 되지 않게)."""
    h, sat, v = hsv(a); m = green_mask(a) | ((h > 160) & (h < 192) & (sat > 0.45) & (v > 0.25))   # 짙은 청록(바지 하이라이트·궁병 속자락)도 같이
    if not m.any(): return a, 0
    h2 = 222 + (h - 120) * 0.15; v2 = v * 0.85; s2 = np.minimum(sat * 1.1, 1)
    c = v2 * s2; hp = h2 / 60; x = c * (1 - np.abs(hp % 2 - 1)); z = np.zeros_like(c)
    # h2 는 214~230 → hp 3.5~3.9 구간: (0, x, c)
    rgb = np.dstack([z, x, c]) + (v2 - c)[..., None]
    out = a.copy(); out[..., :3][m] = (rgb[m] * 255).clip(0, 255).astype(np.uint8)
    return out, int(m.sum())

def key_full(src):
    a = np.array(Image.open(src).convert('RGB'))
    bg = ring_bg(a)[0]
    al = P.key_alpha(a, bg, float(arg('thr', 60)), float(arg('ramp', 40)))
    al = P.erode_alpha(al, int(arg('erode', 1)))
    al = P.despeckle(al, int(arg('despeckle', 300)))
    fn = int(arg('fillnear', 250))
    if fn:   # Qwen 이 자홍 배경을 투구·갑옷에 반사광 점으로 찍는다 → 키잉에 점 구멍. 가장자리 미접촉 구멍(<fn px, 128x160 에선 5px 미만)을 가까운 전경색으로 메운다
        a, al, nf = P.fill_near(a, al, fn, bg, 2)
        if nf: print('  fillnear <%d: %d 개 메움' % (fn, nf))
    a = P.decontaminate(a, al)
    if has('degreen'):
        a, n = degreen(a); print('  degreen: 초록 픽셀 %d 개를 파랑으로' % n)
    return Image.fromarray(np.dstack([a, al]), 'RGBA'), bg

def do_unflat():
    import json
    src, mout, dst = sys.argv[2], sys.argv[3], sys.argv[4]
    full, bg = key_full(src)
    toe = int(arg('toe', 152))
    bb = full.split()[-1].getbbox()
    m = full.crop(bb)
    same = arg('same')
    note = ''
    size = None
    if same:                                      # 색만 바꾼 편집: 초록 쪽 bbox 가 놓인 자리·크기에 그대로 맞춘다 — 두 편 그림이 픽셀 단위로 겹친다
        # (처음엔 초록의 배율·이동을 그대로 썼는데 Qwen 색 바꾸기가 그림을 2~3% 키워서 발끝이 y154 로 내려갔다 → bbox 를 초록 bbox 크기로 리사이즈)
        t = json.load(open(same)); x, y, size = t['x'], t['y'], (t['w'], t['h']); s = size[1] / m.height
        full.save(mout); note = ' (same=%s, 가로 배율 %.4f)' % (os.path.basename(same), size[0] / m.width)
    elif has('refit'):                            # 새 stand: 머리끝~발끝을 재서 다시 맞춘다
        m.save(mout)
        s, x, y, note = layout(m, np.array(m)[..., 3])
    else:                                         # 배치 유지: 배율 160/높이 고정, 발끝만 다시 맞춤
        full.save(mout)
        s = 160.0 / full.height
        padx = (full.width * s - 128) / 2
        x = round(bb[0] * s - padx) + int(arg('dx', 0)); y0 = round(bb[1] * s)
        y = y0 if has('keepy') else toe - max(1, round(m.height * s))   # 발끝 재정렬(편집이 1~3px 밀린다)
        note = ' 편집 결과 발끝 y=%d' % (y0 + round(m.height * s))
    r = premul_resize(m, size or (max(1, round(m.width * s)), max(1, round(m.height * s))))
    if not same and (x < 0 or x + r.width > 128):
        # 넘치면 뒤쪽(왼쪽 — 창 자루 끝)을 자른다: 오른쪽 끝(무기 날)을 캔버스 안에 둔다
        nx = min(max(x, 0), 128 - r.width); note += ' ※ 좌우 넘침: x %d→%d (폭 %d)' % (x, nx, r.width); x = nx
        if r.width > 128: note += ' ※※ 폭이 128 을 넘는다 — 왼쪽 %dpx 잘린다' % (r.width - 128)
    if y < 0: note += ' ※ 위 넘침 %dpx (잘린다)' % -y
    finish(r, x, y, dst)
    json.dump({'x': x, 'y': y, 'w': r.width, 'h': r.height, 'src': os.path.basename(src)}, open(dst[:-4] + '.json', 'w'))
    print('%s bg=(%d,%d,%d) → %s 배율 %.4f x=%d y=%d 크기 %s%s' % (os.path.basename(src), *bg, os.path.basename(dst), s, x, y, r.size, note))

def do_shrink():
    """편집 결과(944x1104)를 다시 편집 입력(383x448)으로 줄인다 — 색 바꾸기 입력."""
    src, dst = sys.argv[2], sys.argv[3]
    Image.open(src).convert('RGB').resize((383, 448), Image.LANCZOS).save(dst); print(dst)

def do_measure():
    from scipy import ndimage
    for f in files(2):
        im = Image.open(f).convert('RGBA'); al = np.array(im)[..., 3]
        bb = im.split()[-1].getbbox(); ht = head_top(al); ys = np.where(al.max(1) > 128)[0]
        n = ndimage.label(al > 0)[1]
        semi = ((al > 0) & (al < 255)).sum() / max((al > 0).sum(), 1)
        a = np.array(im); op = al > 128
        gm = green_mask(a) & op; h, sat, v = hsv(a); bm = (h > 200) & (h < 260) & (sat > 0.3) & (v > 0.15) & op
        print('%-28s %s bbox=%s 머리끝 y=%d 발끝 y=%d 몸 높이=%d 폭=%d 발 중심 x=%.0f 조각=%d 반투명=%.0f%% 초록=%.0f%% 파랑=%.0f%%' % (
            os.path.basename(f), im.size, bb, ht, ys[-1] + 1, ys[-1] + 1 - ht, bb[2] - bb[0], feet_cx(al), n, semi * 100,
            gm.sum() / op.sum() * 100, bm.sum() / op.sum() * 100))

def do_sheet():
    out = sys.argv[2]; cols = int(sys.argv[3]); fs = files(4); sc = int(arg('scale', 2)); bg = ints(arg('bg', '96,84,60'))
    ims = [Image.open(f).convert('RGBA') for f in fs]
    cw, ch = ims[0].width * sc, ims[0].height * sc; rows = (len(ims) + cols - 1) // cols
    sh = Image.new('RGB', (cols * cw, rows * (ch + 12)), bg); d = ImageDraw.Draw(sh)
    for n, (f, im) in enumerate(zip(fs, ims)):
        x, y = (n % cols) * cw, (n // cols) * (ch + 12)
        big = im.resize((cw, ch), Image.NEAREST if sc > 1 else Image.LANCZOS)
        sh.paste(big, (x, y), big)
        d.line([(x, y + 152 * sc), (x + cw, y + 152 * sc)], fill=(255, 255, 255), width=1) if has('guide') else None
        d.text((x + 2, y + ch), os.path.basename(f), fill=(255, 255, 255))
    sh.save(out); print(out, sh.size)

if __name__ == '__main__':
    {'bg': do_bg, 'key': do_key, 'fit': do_fit, 'flat': do_flat, 'unflat': do_unflat, 'shrink': do_shrink, 'measure': do_measure, 'sheet': do_sheet}[sys.argv[1]]()
