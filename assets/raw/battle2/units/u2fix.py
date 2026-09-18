"""units2 수정 회차 후처리 — 검수에서 잡힌 흠을 128x160 결과(out/*.png) 위에서 고친다. 바뀐 게 없으면 파일을 다시 쓰지 않는다.

  python u2fix.py clean <png...>            자홍 잔여 제거 + 떨어진 조각 제거
        자홍: 불투명 픽셀 중 H 283~332·S>0.5·V>0.35(배경 반사 점) → 가장 가까운 비자홍 불투명 색으로 대체,
              H 275~335·S 0.25~0.5·V>0.35(옅은 보랏빛 — 날·시위에 비친 배경) → 채도만 0.3배.
        조각: 알파>128 기준 8-이웃 연결 성분 중 8px 미만, 그리고 알파>0 성분 중 최대 알파<128 인 흐린 부스러기를 지운다.
  python u2fix.py bowstring <png...>        궁병 stand: 몸 위에만 남은 시위 띠(y 84~85)를 활 양 끝까지 잇는다(몸 밖은 키잉에 지워졌다)
  python u2fix.py bowtunic <src> <dst>      궁병 attack: 상체의 짙은 청록(H 135~185)을 stand 와 같은 연두 그늘색으로, 청록 속자락을 흰 속자락으로
  python u2fix.py cavblue <green.png> <dst> 파랑 기병 attack: 초록 attack 을 색상 이동만 해서 만든다(안장 덮개 금 자수가 그대로 남는다)
  python u2fix.py hairdots <png...> [--hue=65,175] [--max=8]   관우: 검은 머리카락 안의 초록 점(8px 이하, 둘레가 어두운 것)을 이웃색으로. 하후돈: --hue=170,215 --s=0.18 --v=0.45 --ringv=0.4 --max=14(청록 반짝이)
        [--s=0.3] [--v=0.3] 점의 최소 채도·명도, [--ringv=0.3] 둘레 2px 의 80% 이상이 이 명도보다 어두워야 점으로 친다
  python u2fix.py dwthigh <png>             전위 attack: 허벅지의 찢어진 듯한 살색 조각을 검정 갑옷색으로
  python u2fix.py fillholes <master.png> [--max=400]   마스터(원본 해상도)의 안쪽 키잉 구멍(가장자리 미접촉, max px 미만)을 가까운 전경색으로 메운다
        — 하후돈 새 그림(s34)의 머리카락 속 반짝이 점이 배경 민트와 같은 색이라 뚫린다. Qwen 입력(flat)에 구멍이 자홍 점으로 찍히지 않게 fit·flat 전에 돌린다.
  python u2fix.py debg <png> --bg=r,g,b [--d=38]      SDXL 직접 키잉분: 배경색과 거리 d 미만으로 남은 불투명 픽셀(틈새로 비친 배경)을 가까운 색으로
  python u2fix.py measure <png...>          자홍 잔여(clean 과 같은 기준)·조각 수(알파>0 / >64 / >128, 8-이웃)·발끝 y
"""
import sys, os
import numpy as np
from PIL import Image
from scipy import ndimage
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
_argv = sys.argv; sys.argv = ['u2post']      # u2post 는 import 때 argv 를 읽지 않지만 arg() 가 sys.argv 를 본다 — 섞이지 않게
import u2post as U
sys.argv = _argv
S8 = np.ones((3, 3), bool)

def load(f): return np.array(Image.open(f).convert('RGBA'))
def save(f, a, a0, what):
    a = a.copy(); a[a[..., 3] == 0] = 0
    if np.array_equal(a, a0): print('%-28s 변화 없음 (%s)' % (os.path.basename(f), what)); return
    Image.fromarray(a, 'RGBA').save(f); print('%-28s %s' % (os.path.basename(f), what))

def hsv2rgb(h, s, v):
    c = v * s; hp = (h % 360) / 60; x = c * (1 - np.abs(hp % 2 - 1)); z = np.zeros_like(c)
    i = np.floor(hp).astype(int) % 6
    r = np.choose(i, [c, x, z, z, x, c]); g = np.choose(i, [x, c, c, x, z, z]); b = np.choose(i, [z, z, x, c, c, x])
    return ((np.dstack([r, g, b]) + (v - c)[..., None]) * 255).round().clip(0, 255).astype(np.uint8)

def mag_masks(a):
    h, s, v = U.hsv(a); on = a[..., 3] > 0
    t1 = on & (h >= 283) & (h <= 332) & (s > 0.5) & (v > 0.35)
    t2 = on & (h >= 275) & (h <= 335) & (s > 0.25) & (s <= 0.5) & (v > 0.35)
    return t1, t2

def nearest_fill(a, mask, ok):
    """mask 픽셀의 RGB 를 가장 가까운 ok 픽셀의 RGB 로(알파는 그대로)."""
    if not mask.any() or not ok.any(): return a
    idx = ndimage.distance_transform_edt(~ok, return_distances=False, return_indices=True)
    out = a.copy(); out[..., :3][mask] = a[idx[0], idx[1]][..., :3][mask]
    return out

def demagenta(a):
    t1, t2 = mag_masks(a)
    n1, n2 = int(t1.sum()), int(t2.sum())
    if n1:
        ok = (a[..., 3] > 200) & ~t1 & ~t2
        a = nearest_fill(a, t1, ok)
    if n2 and n1:                                # 옅은 보라는 자홍 점이 실제로 있는 그림(= 자홍 배경이 비친 그림)에서만 손댄다 — SDXL 직접 키잉분의 보랏빛 강철은 원래 색이다
        h, s, v = U.hsv(a); rgb = hsv2rgb(h, s * 0.3, v)
        a = a.copy(); a[..., :3][t2] = rgb[t2]
    return a, n1, (n2 if n1 else 0)

def despeck(a):
    al = a[..., 3]; a = a.copy(); removed = 0
    lab, n = ndimage.label(al > 128, structure=S8)
    if n > 1:
        sizes = ndimage.sum(np.ones(lab.shape, np.float32), lab, range(1, n + 1))
        small = np.zeros(n + 1, bool); small[1:] = sizes < 8
        kill = ndimage.binary_dilation(small[lab], structure=S8, iterations=2) & (al < 255) | small[lab]   # 조각과 그 둘레의 반투명 테두리
        main = ndimage.binary_dilation((lab > 0) & ~small[lab], structure=S8)                             # 본체 가장자리는 건드리지 않는다
        kill &= ~main
        removed += int((kill & (al > 0)).sum()); a[kill] = 0
    al = a[..., 3]
    lab, n = ndimage.label(al > 0, structure=S8)
    if n > 1:
        mx = ndimage.maximum(al, lab, range(1, n + 1)); sizes = ndimage.sum(np.ones(lab.shape, np.float32), lab, range(1, n + 1))
        bad = np.zeros(n + 1, bool); bad[1:] = (np.array(mx) < 128) | (np.array(sizes) < 8)
        removed += int(bad[lab].sum()); a[bad[lab]] = 0
    # 본체에 흐린 실(알파<64)로만 매달린 점: 알파>64 성분이 8px 미만이면 그 성분을 지운다
    al = a[..., 3]
    lab, n = ndimage.label(al > 64, structure=S8)
    if n > 1:
        sizes = ndimage.sum(np.ones(lab.shape, np.float32), lab, range(1, n + 1))
        small = np.zeros(n + 1, bool); small[1:] = sizes < 8
        removed += int(small[lab].sum()); a[small[lab]] = 0
    return a, removed

def do_clean():
    for f in U.files(2):
        a0 = load(f); a, n1, n2 = demagenta(a0); a, r = despeck(a)
        save(f, a, a0, '자홍 %d px 대체 · 옅은 보라 %d px 채도↓ · 조각 %d px 제거' % (n1, n2, r))

def do_bowstring():
    """Qwen 결과의 시위는 활 양 끝을 잇는 흰 선(944 폭에서 3px)인데, 자홍 배경 위 부분은 키잉·침식에 지워지고 몸 위 부분만 2행 띠로 남았다.
    → 몸 밖 구간(활 왼쪽 끝 ~ 몸, 몸 ~ 활 오른쪽 끝)에 같은 자리에 선을 그려 잇는다: y84 알파 135, y85 알파 70, 색 (236,232,222)."""
    for f in U.files(2):
        a0 = load(f); a = a0.copy(); al = a[..., 3]
        ys = (84, 85); alphas = (135, 70); col = (236, 232, 222)
        solid = np.where(al[86] > 200)[0]            # 활 몸통이 지나는 행 — 양 끝 x
        x0, x1 = int(solid.min()) + 2, int(solid.max()) - 2
        n = 0
        for y, av in zip(ys, alphas):
            for x in range(x0, x1 + 1):
                if al[y, x] < av: a[y, x] = (*col, av); n += 1
        save(f, a, a0, '시위 %d px 그림 (x %d~%d, y 84~85)' % (n, x0, x1))

def do_bowtunic():
    src, dst = sys.argv[2], sys.argv[3]
    a0 = load(src); a = a0.copy(); h, s, v = U.hsv(a); on = a[..., 3] > 0
    box = np.zeros(on.shape, bool); box[38:80, 38:90] = True             # 상체(허리띠 위)
    m = on & box & (h >= 135) & (h <= 190) & (s > 0.4) & (v > 0.2) & (v < 0.55)
    # stand 의 그늘 초록(H 100~120, rgb (68,115,56)~(47,93,52))에 맞춘다: H→104, S 0.55, V×1.35
    rgb = hsv2rgb(np.full_like(h, 104.0), np.clip(s * 0.0 + 0.55, 0, 1), np.clip(v * 1.35, 0, 0.62))
    a[..., :3][m] = rgb[m]
    sk = np.zeros(on.shape, bool); sk[76:114, 70:90] = True               # 뒤쪽 청록 속자락 → 흰 속자락(stand 와 같게)
    m2 = on & sk & (h >= 175) & (h <= 215) & (s > 0.25) & (v > 0.35)
    rgb2 = hsv2rgb(np.full_like(h, 42.0), np.full_like(s, 0.10), np.clip(v * 1.35, 0, 0.95))
    a[..., :3][m2] = rgb2[m2]
    Image.fromarray(a, 'RGBA').save(dst); print('%s → %s 상체 청록 %d px → 연두 그늘, 속자락 %d px → 흰색' % (os.path.basename(src), os.path.basename(dst), m.sum(), m2.sum()))

def do_cavblue():
    """u2post.degreen 과 같은 색상 이동이되 명도는 Qwen 파랑(cav_b_stand: V 10/50/90% = .34/.66/.94)에 맞춘다 — 초록 V(.27/.52/.79) × 1.27."""
    src, dst = sys.argv[2], sys.argv[3]
    a0 = load(src); a = a0.copy(); h, s, v = U.hsv(a)
    m = (U.green_mask(a) | ((h > 160) & (h < 192) & (s > 0.45) & (v > 0.25))) & (a[..., 3] > 0)
    rgb = hsv2rgb(225 + (h - 120) * 0.15, np.minimum(s * 1.1, 1), np.minimum(v * 1.27, 1))
    a[..., :3][m] = rgb[m]
    Image.fromarray(a, 'RGBA').save(dst); print('%s → %s 초록 %d px → 파랑' % (os.path.basename(src), os.path.basename(dst), m.sum()))

def do_hairdots():
    for f in U.files(2):
        a0 = load(f); a = a0.copy(); h, s, v = U.hsv(a); on = a[..., 3] > 200
        lo, hi = U.ints(U.arg('hue', '65,175'))      # 하후돈(새 그림)은 머리카락 속 청록 반짝이 점(배경 민트와 비슷해 키잉 잔여로 읽힌다): --hue=150,215
        smin, vmin, rv = float(U.arg('s', 0.3)), float(U.arg('v', 0.3)), float(U.arg('ringv', 0.3))   # 점의 최소 채도·명도, 둘레(머리카락)의 최대 명도
        g = on & (h > lo) & (h < hi) & (s > smin) & (v > vmin)
        lab, n = ndimage.label(g, structure=S8); fix = np.zeros(g.shape, bool)
        for i in range(1, n + 1):
            c = lab == i
            if c.sum() > int(U.arg('max', 8)): continue
            ring = ndimage.binary_dilation(c, structure=S8, iterations=2) & ~c
            if ring.sum() and ((v[ring] < rv) & on[ring]).mean() > 0.8: fix |= c
        halo = ndimage.binary_dilation(fix, structure=S8) & on & (v > rv)      # 점 둘레의 번진 테두리도 같이
        fix |= halo
        a = nearest_fill(a, fix, on & ~fix & (v < rv))
        save(f, a, a0, '머리카락 속 점 %d px 덮음 (H %d~%d)' % (fix.sum(), lo, hi))

def do_dwthigh():
    f = sys.argv[2]
    a0 = load(f); a = a0.copy(); h, s, v = U.hsv(a); on = a[..., 3] > 0
    box = np.zeros(on.shape, bool); box[106:126, 44:82] = True
    skin = on & box & ((h < 35) | (h > 340)) & (s > 0.12) & (s < 0.7) & (v > 0.55)
    for _ in range(3):                                                         # 살색에 붙은 흰 하이라이트·번진 테두리도 같이(밝은 픽셀만)
        skin |= ndimage.binary_dilation(skin, structure=S8) & on & box & (v > 0.5) & (s < 0.45)
    base = np.array([58, 56, 74], np.float32)                                  # 주변 검정 갑옷의 밝은 면 색
    rgb = (base[None, None, :] * (v[..., None] / 0.95) * 0.9).clip(0, 255).astype(np.uint8)
    a[..., :3][skin] = rgb[skin]
    save(f, a, a0, '허벅지 살색 %d px → 갑옷색' % skin.sum())

def do_fillholes():
    f = sys.argv[2]; mx = int(U.arg('max', 400))
    a = load(f); rgb = a[..., :3].copy(); al = a[..., 3].copy()
    lab, n = ndimage.label(al < 128)
    sizes = ndimage.sum(np.ones(lab.shape, np.float32), lab, range(1, n + 1))
    edge = np.zeros(n + 1, bool)
    for strip in (lab[0], lab[-1], lab[:, 0], lab[:, -1]): edge[np.unique(strip)] = True
    fill = np.zeros(n + 1, bool); fill[1:] = sizes < mx; fill &= ~edge; fill[0] = False
    mk = fill[lab]; mk = ndimage.binary_dilation(mk, iterations=3) & (al < 255) | mk      # 구멍 둘레의 반투명 테두리까지
    idx = ndimage.distance_transform_edt(~((al == 255) & ~mk), return_distances=False, return_indices=True)
    rgb[mk] = rgb[idx[0], idx[1]][mk]; al[mk] = 255
    Image.fromarray(np.dstack([rgb, al]), 'RGBA').save(f); print('%s 구멍 %d 개(%d px) 메움' % (os.path.basename(f), fill.sum(), mk.sum()))

def do_debg():
    f = sys.argv[2]; bg = np.array(U.ints(U.arg('bg')), np.float32); dmax = float(U.arg('d', 38))
    a0 = load(f); on = a0[..., 3] > 0
    m = on & (np.sqrt(((a0[..., :3].astype(np.float32) - bg) ** 2).sum(-1)) < dmax)
    a = nearest_fill(a0, m, (a0[..., 3] > 200) & ~m)
    save(f, a, a0, '배경색 잔여 %d px 대체' % m.sum())

def do_measure():
    tot = 0
    for f in U.files(2):
        a = load(f); al = a[..., 3]; t1, t2 = mag_masks(a)
        ns = [ndimage.label(al > t, structure=S8)[1] for t in (0, 64, 128)]
        ys = np.where(al.max(1) > 128)[0]
        dirty = int((a[..., :3][al == 0].sum()))
        tot += int(t1.sum())
        print('%-28s %s 자홍=%d 옅은보라=%d 조각(α>0/64/128)=%s 발끝 y=%d 머리끝 y=%d 몸 높이=%d 알파0 RGB합=%d' % (
            os.path.basename(f), a.shape[1::-1], t1.sum(), t2.sum(), ns, ys[-1] + 1, U.head_top(al), ys[-1] + 1 - U.head_top(al), dirty))
    print('자홍 합계', tot)

if __name__ == '__main__':
    {'clean': do_clean, 'bowstring': do_bowstring, 'bowtunic': do_bowtunic, 'cavblue': do_cavblue, 'hairdots': do_hairdots,
     'dwthigh': do_dwthigh, 'fillholes': do_fillholes, 'debg': do_debg, 'measure': do_measure}[sys.argv[1]]()
