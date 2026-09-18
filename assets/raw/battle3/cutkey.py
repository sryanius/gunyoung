# -*- coding: utf-8 -*-
"""컷인 3차(여성 무장) 키잉 — 배경이 그라데이션/빛무리여도 되게 「위치별 배경색」과의 거리로 뽑는다.
  python cutkey.py <src.png> <dst.png> --hue=lo,hi [--smin=0.25] [--vmin=0.25] [--thr=45] [--ramp=40] [--sigma=30]
                   [--erode=1] [--despeckle=900] [--close=1] [--bgkeep=20] [--fillholes=N] [--interior=200] [--seedmin=1500] [--fillnear=400] [--despill=N --despillgain=1.0] [--fgpoly=x,y;x,y;..] [--comp=r,g,b] [--flip] [--dump=<미리보기.png>]
  1) 씨앗 배경 = HSV 색상이 hue 구간(도) 안 · 채도 ≥ smin · 명도 ≥ vmin 인 픽셀(분홍/마젠타 285~345, 청록/초록 140~200)
  2) 배경색 장(field) = 씨앗 픽셀만의 가우시안 정규화 평균(sigma) → 인물 안쪽은 가장 가까운 씨앗 값으로 채움
  3) 알파 = clip((|rgb − 배경장| − thr)/ramp) → 1px 침식 → despeckle → close → bgkeep(배경장과 거리 < N 은 키잉 알파 유지) → fillnear(작은 구멍을 가까운 전경색으로) → decontam
  post.py(assets/raw/battle) 의 함수들을 그대로 가져다 쓴다. 단색 배경이면 post.py key 와 결과가 거의 같다."""
import sys, os, colorsys
import numpy as np
from PIL import Image
from scipy import ndimage
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'battle'))
_argv = sys.argv; sys.argv = ['post.py', 'none']
import post as P
sys.argv = _argv
sys.stdout.reconfigure(encoding='utf-8')

def arg(k, d=None):
    for a in reversed(sys.argv):        # 같은 옵션이 두 번이면 뒤엣것(공통 $M 뒤에 개별 값을 덧붙이는 build_cutin.sh)
        if a.startswith('--' + k + '='): return a[len(k) + 3:]
    return d
def has(k): return ('--' + k) in sys.argv

def hsv(rgb):
    f = rgb.astype(np.float32) / 255; mx = f.max(-1); mn = f.min(-1); d = mx - mn
    h = np.zeros_like(mx); r, g, b = f[..., 0], f[..., 1], f[..., 2]
    m = d > 1e-6
    hr = ((g - b) / np.where(m, d, 1)) % 6; hg = (b - r) / np.where(m, d, 1) + 2; hb = (r - g) / np.where(m, d, 1) + 4
    h = np.where(mx == r, hr, np.where(mx == g, hg, hb)) * 60; h = np.where(m, h, 0)
    s = np.where(mx > 0, d / np.where(mx > 0, mx, 1), 0)
    return h, s, mx

def bg_field(rgb, seed, sigma):
    f = rgb.astype(np.float32); w = seed.astype(np.float32)
    num = np.dstack([ndimage.gaussian_filter(f[..., c] * w, sigma) for c in range(3)]); den = ndimage.gaussian_filter(w, sigma)
    ok = den > 0.05
    field = np.where(ok[..., None], num / np.maximum(den, 1e-6)[..., None], 0)
    idx = ndimage.distance_transform_edt(~ok, return_distances=False, return_indices=True)
    return field[idx[0], idx[1]]

def main():
    src, dst = sys.argv[1], sys.argv[2]
    rgb = np.array(Image.open(src).convert('RGB'))
    lo, hi = (float(v) for v in arg('hue').split(','))
    h, s, v = hsv(rgb)
    inh = ((h >= lo) & (h <= hi)) if lo <= hi else ((h >= lo) | (h <= hi))
    seed = inh & (s >= float(arg('smin', 0.25))) & (v >= float(arg('vmin', 0.25)))
    seed = ndimage.binary_erosion(seed, iterations=2)          # 인물 가장자리의 혼합 픽셀이 배경장에 섞이지 않게
    # 씨앗은 캔버스 가장자리에 닿거나 seedmin px 이상인 덩어리만 — 전위의 살 하이라이트(옅은 분홍빛)가 씨앗으로 잡혀 배가 뚫렸다
    lab, n = ndimage.label(seed)
    if n:
        sizes = ndimage.sum(np.ones(seed.shape, np.float32), lab, range(1, n + 1)); okc = np.zeros(n + 1, bool); okc[1:] = sizes >= int(arg('seedmin', 1500))
        for strip in (lab[0], lab[-1], lab[:, 0], lab[:, -1]): okc[np.unique(strip)] = True
        okc[0] = False; seed = okc[lab]
    field = bg_field(rgb, seed, float(arg('sigma', 30)))
    d = np.sqrt(((rgb.astype(np.float32) - field) ** 2).sum(-1))
    thr = float(arg('thr', 45)); ramp = float(arg('ramp', 40))
    al = (np.clip((d - thr) / ramp, 0, 1) * 255).astype(np.uint8)
    # 「확실한 전경」: 색상이 배경 색상대(±20°) 밖이고 채도가 있거나 어두운 픽셀은 알파 255 — 하후돈 얼굴 살색이 옅은 분홍 빛무리 배경장과 거리 90 안팎이라
    #   알파 210~240 으로 떨어졌고 decontam 이 볼·입술을 줄무늬로 뭉갰다. 배경과 섞인 가장자리 픽셀은 색상이 배경 쪽으로 끌려가 이 규칙에 안 걸린다(램프 그대로).
    if not has('nosolid'):
        lw, hw = lo - 20, hi + float(arg('solidhi', 5))     # 위쪽 여유는 5° 만: 분홍빛 도는 살색이 H 0~10 이라 +20 이면 「배경 색상대」에 들어가 버린다(하후돈 볼·입술)
        inw = ((h >= lw) & (h <= hw)) if hw < 360 else ((h >= lw) | (h <= hw - 360))
        solid = ~inw & ((s > 0.04) | (v < 0.30))
        al = np.where(solid, 255, al).astype(np.uint8)
    er = int(arg('erode', 1))
    if er: al = P.erode_alpha(al, er)
    ds = int(arg('despeckle', 900))
    if ds: al = P.despeckle(al, ds)
    al_keyed = al.copy()
    fh = int(arg('fillholes', 0))       # 가장자리 미접촉 알파 0 구멍(<N px)을 원본 RGB 로 복원(살·칼날 하이라이트가 배경색과 가까울 때). 진짜 배경 틈은 아래 bgkeep 이 되돌린다
    if fh:
        al, nf = P.fill_holes(al, fh, 4); print('fillholes <%d: %d 개' % (fh, nf))
    cl = int(arg('close', 1))
    if cl: al = P.close_alpha(al, cl)
    # --interior=N : 「바깥 투명」(알파 0 성분 중 캔버스 가장자리에 닿거나 N px 이상)과 이어지지 않은 알파<255 덩어리는 전부 255 로(원본 RGB) —
    #   입술·볼 홍조·눈가처럼 배경 색상대의 분홍이 얼굴 안에서 뚫리거나 반투명해지는 것(하후돈). 머리카락 사이 진짜 틈은 N 이상이라 남는다.
    bk = float(arg('bgkeep', 20))
    itn = int(arg('interior', 0)); ext0 = al == 0
    if itn:
        lab, n = ndimage.label(al == 0); big = np.zeros(n + 1, bool)
        if n:
            big[1:] = ndimage.sum(np.ones(al.shape, np.float32), lab, range(1, n + 1)) >= itn
            for strip in (lab[0], lab[-1], lab[:, 0], lab[:, -1]): big[np.unique(strip)] = True
            big[0] = False
        ext0 = big[lab]
        lab2, n2 = ndimage.label(al < 255); hit = np.zeros(n2 + 1, bool); hit[np.unique(lab2[ext0])] = True; hit[0] = False
        m_in = (al < 255) & ~hit[lab2] & (d >= max(bk, 25))      # 배경색 그대로인 픽셀(머리카락 사이 작은 틈)은 복원하지 않는다 — 관우 눈 띠에 마젠타 점이 남았었다
        al = np.where(m_in, 255, al).astype(np.uint8); d = np.where(m_in, 999, d); forced_in = m_in
        print('interior <%d: %d px 복원' % (itn, int(m_in.sum())))
    else: forced_in = np.zeros(al.shape, bool)
    bk = float(arg('bgkeep', 20))
    if bk:
        keep = d < bk; al = np.where(keep, al_keyed, al).astype(np.uint8)
    forced = np.zeros(al.shape, bool)
    fp = arg('fgpoly')                  # --fgpoly=x,y;x,y;...[|x,y;...] : 다각형 안은 무조건 전경(알파 255) — 하얗게 날아간 살 하이라이트가 흰 빛무리 배경과 붙어 색으로는 못 가르는 곳(전위 어깨)
    if fp:
        from PIL import ImageDraw
        mk = Image.new('L', (rgb.shape[1], rgb.shape[0]), 0); dr = ImageDraw.Draw(mk)
        for poly in fp.split('|'):
            dr.polygon([tuple(int(v) for v in pt.split(',')) for pt in poly.split(';')], fill=255)
        al = np.maximum(al, np.array(mk)); d = np.where(np.array(mk) > 0, 999, d); forced = np.array(mk) > 0
    fn = int(arg('fillnear', 0)); a = rgb
    if fn:
        # post.fill_near 는 단색 bg 와의 거리로 「진짜 전경」을 고른다 → 위치별 배경장 버전
        lab, n = ndimage.label(al == 0)
        if n:
            sizes = ndimage.sum(np.ones_like(al, dtype=np.float32), lab, range(1, n + 1))
            edge = np.zeros(n + 1, bool)
            for strip in (lab[0], lab[-1], lab[:, 0], lab[:, -1]): edge[np.unique(strip)] = True
            fill = np.zeros(n + 1, bool); fill[1:] = sizes < fn; fill &= ~edge; fill[0] = False
            m = ndimage.binary_dilation(fill[lab], iterations=2) & (al < 255)
            good = (al == 255) & (d >= 30) & ~m
            idx = ndimage.distance_transform_edt(~good, return_distances=False, return_indices=True)
            a = rgb.copy(); a[m] = rgb[idx[0], idx[1]][m]; al = np.where(m, 255, al).astype(np.uint8)
            print('fillnear <%d: %d 개' % (fn, int(fill.sum())))
    # 불투명인데 배경장과 거리 < 30 인 픽셀(배경색 패치)은 가까운 전경색으로 칠한다 — 검수 규칙 「배경 거리<30 불투명 픽셀 0」
    a = P.decontaminate(a, al)
    d2 = np.sqrt(((a.astype(np.float32) - field) ** 2).sum(-1))
    bad = (al > 250) & (d2 < 30) & ~forced & ~forced_in
    if bad.any():
        good = (al == 255) & (d2 >= 40)
        idx = ndimage.distance_transform_edt(~good, return_distances=False, return_indices=True)
        a = a.copy(); a[bad] = a[idx[0], idx[1]][bad]
    dsp = int(arg('despill', 0))        # --despill=N : 투명 영역에서 N px 안쪽의 「배경 색상」 기운(가는 머리카락이 마젠타와 섞인 보랏빛 가닥·분홍 림 하이라이트)을 탈색. 옷·눈은 가장자리에서 멀어 안 건드린다
    if dsp:
        near = ndimage.distance_transform_edt(~(ext0 & (al == 0))) <= dsp     # 「바깥 투명」에서 잰다 — 얼굴 안 점 구멍 둘레의 입술·눈가를 탈색하지 않게
        db = arg('despillbox')             # --despillbox=x0,y0,x1,y1 : 상자 안은 가장자리 거리와 무관하게 탈색(전위 머리카락 속 마젠타 림 얼룩)
        if db:
            x0, y0, x1, y1 = (int(v) for v in db.split(',')); near = near.copy(); near[y0:y1, x0:x1] = True
        h2, s2, v2 = hsv(a); lo2, hi2 = lo - 25, hi + float(arg('despillhi', 0))   # 위쪽 여유 0: 분홍 림 받은 살색(H 350~10)을 건드리면 회색 얼룩이 된다(전위 귀·목)
        inh2 = ((h2 >= lo2) & (h2 <= hi2)) if hi2 < 360 else ((h2 >= lo2) | (h2 <= hi2 - 360))
        m = near & inh2 & (s2 > float(arg('despillsmin', 0.22))) & (al > 0)
        g = (a.astype(np.float32) @ np.array([0.299, 0.587, 0.114], np.float32))[..., None]
        k = float(arg('despillkeep', 0.12)); gn = float(arg('despillgain', 1.0))   # gain<1: 탈색한 가닥을 어둡게(검은 머리카락이 밝은 회색 실로 남지 않게)
        a = a.copy(); a[m] = ((g * (1 - k) + a.astype(np.float32) * k) * gn)[m].clip(0, 255).astype(np.uint8)
        print('despill %dpx: %d px 탈색' % (dsp, int(m.sum())))
    print('씨앗 배경 %.1f%%, 배경색 패치 다시 칠함 %d px' % (100 * seed.mean(), int(bad.sum())))
    out = Image.fromarray(np.dstack([a, al]), 'RGBA')
    np.save(os.path.splitext(dst)[0] + '_bgfield.npy', field.astype(np.uint8))
    if has('flip'):
        out = out.transpose(Image.FLIP_LEFT_RIGHT); np.save(os.path.splitext(dst)[0] + '_bgfield.npy', field[:, ::-1].astype(np.uint8))
    out.save(dst); print(dst, out.size)
    comp = arg('comp')                  # --comp=r,g,b[,out.png] : 단색 배경 위에 다시 합성한 RGB(하이레즈 img2img 입력용 — 그라데이션 배경을 단색으로 갈아 끼운다)
    if comp:
        c = comp.split(','); b = Image.new('RGBA', out.size, tuple(int(v) for v in c[:3]) + (255,)); b.alpha_composite(out)
        cp = c[3] if len(c) > 3 else os.path.splitext(dst)[0] + '_comp.png'; b.convert('RGB').save(cp); print(cp)
    dump = arg('dump')
    if dump:   # 어두운 배경 / 밝은 배경 위 합성 나란히(0.5배)
        W, H = out.size; sh = Image.new('RGB', (W, H // 2), (0, 0, 0))
        for k, c in enumerate(((18, 20, 30), (235, 235, 225))):
            b = Image.new('RGBA', out.size, c + (255,)); b.alpha_composite(out); sh.paste(b.convert('RGB').resize((W // 2, H // 2), Image.LANCZOS), (k * W // 2, 0))
        sh.save(dump)

if __name__ == '__main__': main()
