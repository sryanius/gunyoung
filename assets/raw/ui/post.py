# -*- coding: utf-8 -*-
"""UI 키트 후처리 도구 (Pillow + numpy).
  python post.py key  <src> <dst> [--bg=green|black|white|auto|r,g,b] [--thr=60] [--erode=1] [--fit=W,H] [--pad=0] [--desat]
  python post.py nine <src> <dst> --out=W,H --corner=C --outer=x0,y0,x1,y1 [--inner=x0,y0,x1,y1] [--fill=r,g,b,a|none] [--bg=black|green] [--thr=..] [--edge=frac]
  python post.py bar  <src> <dst> --out=W,H --crop=x0,y0,x1,y1 [--bg=black] [--thr=..]
  python post.py check <png...>
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
    if name == 'auto':
        # 네 모서리 16px 평균
        h, w = a.shape[:2]
        c = np.concatenate([a[:16, :16].reshape(-1, 3), a[:16, -16:].reshape(-1, 3), a[-16:, :16].reshape(-1, 3), a[-16:, -16:].reshape(-1, 3)])
        return c.mean(0)
    return np.array(ints(name), dtype=np.float32)

def key_alpha(rgb, bg, thr, ramp=None):
    """색상 거리 기반 알파(0~255). thr 이하 → 0, thr+ramp 이상 → 255, 사이는 선형(ramp 기본 = thr)."""
    d = np.sqrt(((rgb.astype(np.float32) - bg) ** 2).sum(-1))
    a = np.clip((d - thr) / max(ramp or thr, 1), 0, 1)
    return (a * 255).astype(np.uint8)

def green_key_alpha(rgb, thr):
    """초록 키잉: G 가 R,B 보다 얼마나 우세한지로 판단(색상 번짐에 강함)."""
    f = rgb.astype(np.float32)
    g_dom = f[..., 1] - np.maximum(f[..., 0], f[..., 2])
    a = np.clip((thr - g_dom) / max(thr, 1) , 0, 1)  # g_dom >= thr → 0, <= 0 → 1
    return (a * 255).astype(np.uint8)

def despill_green(rgb, alpha):
    """경계의 초록 번짐 제거: G 를 max(R,B) 로 제한."""
    f = rgb.astype(np.float32)
    m = np.maximum(f[..., 0], f[..., 2])
    f[..., 1] = np.minimum(f[..., 1], m + 8)
    return f.clip(0, 255).astype(np.uint8)

def erode_alpha(alpha, n):
    im = Image.fromarray(alpha)
    for _ in range(n): im = im.filter(ImageFilter.MinFilter(3))
    return np.array(im)

def trim(img):
    bb = img.split()[-1].getbbox()
    return img.crop(bb) if bb else img

def fit(img, W, H, pad=0):
    w, h = img.size
    s = min((W - 2 * pad) / w, (H - 2 * pad) / h)
    nw, nh = max(1, round(w * s)), max(1, round(h * s))
    r = img.resize((nw, nh), Image.LANCZOS)
    out = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    out.paste(r, ((W - nw) // 2, (H - nh) // 2), r)
    return out

def do_key():
    src, dst = sys.argv[2], sys.argv[3]
    im = Image.open(src).convert('RGB'); a = np.array(im)
    bgn = arg('bg', 'green'); thr = float(arg('thr', 60)); er = int(arg('erode', 1))
    if bgn == 'green':
        al = green_key_alpha(a, thr); a = despill_green(a, al)
    else:
        al = key_alpha(a, bg_color(a, bgn), thr, float(arg('ramp', 0)) or None)
    if er: al = erode_alpha(al, er)
    if has('desat'):
        g = (a.astype(np.float32) @ np.array([0.299, 0.587, 0.114])).astype(np.uint8)
        a = np.stack([g, g, g], -1)
    out = Image.fromarray(np.dstack([a, al]), 'RGBA')
    out = trim(out)
    f = arg('fit')
    if f: out = fit(out, *ints(f), pad=int(arg('pad', 0)))
    out.save(dst); print(dst, out.size)

def do_nine():
    """프레임 그림에서 모서리 4개·변 4개를 잘라 9-slice 로 재조립.
    --outer: 프레임 바깥 사각형(원본 좌표). --corner: 출력 모서리 px. --out: 출력 크기.
    --edge: 변 조각을 원본 변 중앙에서 잘라올 길이 비율(0~1, 기본 0.5) — 길이는 늘려 붙인다.
    --inner: 프레임 안쪽 빈 영역(원본 좌표). 주어지면 그 안은 --fill 로 칠하고 프레임은 그 위에 얹는다.
    --bg/--thr: 바깥 배경 키잉(프레임 바깥은 어차피 잘려 나가지만 모서리 장식의 여백에 필요).
    """
    src, dst = sys.argv[2], sys.argv[3]
    W, H = ints(arg('out')); C = int(arg('corner'))
    ox0, oy0, ox1, oy1 = ints(arg('outer'))
    im = Image.open(src).convert('RGB').crop((ox0, oy0, ox1, oy1))
    a = np.array(im); sw, sh = im.size
    bgn = arg('bg', 'black'); thr = float(arg('thr', 40))
    if bgn == 'green': al = green_key_alpha(a, thr); a = despill_green(a, al)
    elif bgn == 'none': al = np.full(a.shape[:2], 255, np.uint8)
    else: al = key_alpha(a, bg_color(a, bgn), thr)
    inner = arg('inner')
    if inner:
        ix0, iy0, ix1, iy1 = ints(inner); ix0 -= ox0; ix1 -= ox0; iy0 -= oy0; iy1 -= oy0
        # 안쪽 빈 영역은 완전 투명으로(나중에 fill 로 채움). 프레임 안쪽 경계에서 약간 안으로 들여 프레임 픽셀을 보존.
        m = int(arg('inset', 6))
        al[iy0 + m:iy1 - m, ix0 + m:ix1 - m] = 0
    rgba = Image.fromarray(np.dstack([a, al]), 'RGBA')
    # 원본에서의 모서리 크기: 출력 corner 에 대응. 원본 짧은 변 기준 스케일.
    # 스케일은 사용자가 --scale 로 주거나, 원본 모서리 크기 --csrc 로 준다.
    csrc = int(arg('csrc', 0))
    if not csrc:
        scale = float(arg('scale', C / (min(sw, sh) * (C / min(W, H)) ) if False else min(W / sw, H / sh)))
        csrc = int(round(C / scale))
    scale = C / csrc
    ef = float(arg('edge', 0.5))
    L = Image.LANCZOS
    span = arg('espan')  # 변 조각을 잘라올 구간(모서리 사이 길이의 비율 a,b) — 변 가운데 장식을 피할 때
    out = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    # 모서리
    tl = rgba.crop((0, 0, csrc, csrc)).resize((C, C), L)
    tr = rgba.crop((sw - csrc, 0, sw, csrc)).resize((C, C), L)
    bl = rgba.crop((0, sh - csrc, csrc, sh)).resize((C, C), L)
    br = rgba.crop((sw - csrc, sh - csrc, sw, sh)).resize((C, C), L)
    # 변: 원본 변 중앙에서 ef 비율 길이만큼 잘라 출력 길이로 늘림
    mw, mh = W - 2 * C, H - 2 * C
    if span:
        sa, sb = (float(v) for v in span.split(','))
        ex0 = int(csrc + (sw - 2 * csrc) * sa); ex1 = int(csrc + (sw - 2 * csrc) * sb)
        ey0 = int(csrc + (sh - 2 * csrc) * sa); ey1 = int(csrc + (sh - 2 * csrc) * sb)
    else:
        ex0 = int(sw / 2 - (sw - 2 * csrc) * ef / 2); ex1 = int(sw / 2 + (sw - 2 * csrc) * ef / 2)
        ey0 = int(sh / 2 - (sh - 2 * csrc) * ef / 2); ey1 = int(sh / 2 + (sh - 2 * csrc) * ef / 2)
    top = rgba.crop((ex0, 0, ex1, csrc)).resize((mw, C), L)
    bot = rgba.crop((ex0, sh - csrc, ex1, sh)).resize((mw, C), L)
    lef = rgba.crop((0, ey0, csrc, ey1)).resize((C, mh), L)
    rig = rgba.crop((sw - csrc, ey0, sw, ey1)).resize((C, mh), L)
    frame = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    frame.paste(tl, (0, 0)); frame.paste(tr, (W - C, 0)); frame.paste(bl, (0, H - C)); frame.paste(br, (W - C, H - C))
    frame.paste(top, (C, 0)); frame.paste(bot, (C, H - C)); frame.paste(lef, (0, C)); frame.paste(rig, (W - C, C))
    # 가운데 채움
    fill = arg('fill', 'none')
    fill_src = arg('fillimg')
    if fill != 'none' or fill_src:
        # 채움 영역: 프레임의 안쪽 경계(원본 inner 를 스케일) 보다 약간 바깥까지
        fi = arg('fillinset')  # 채움 사각형을 바깥 테두리에서 N px 안쪽으로(둥근 버튼: 테두리 아래까지 채움)
        if fi:
            fi = int(fi); fx0 = fy0 = fi; fx1 = W - fi; fy1 = H - fi
        elif inner:
            fx0 = int(round(ix0 * scale)) - 4; fy0 = int(round(iy0 * scale)) - 4
            fx1 = W - int(round((sw - ix1) * scale)) + 4; fy1 = H - int(round((sh - iy1) * scale)) + 4
        else:
            fx0 = fy0 = C - 4; fx1 = W - C + 4; fy1 = H - C + 4
        if fill_src:
            tex = Image.open(fill_src).convert('RGBA').resize((fx1 - fx0, fy1 - fy0), L)
            out.paste(tex, (fx0, fy0))
        else:
            r, g, b, al_ = ints(fill)
            out.paste(Image.new('RGBA', (fx1 - fx0, fy1 - fy0), (r, g, b, al_)), (fx0, fy0))
    out.alpha_composite(frame)
    out.save(dst); print(dst, out.size, 'scale=%.3f csrc=%d' % (scale, csrc))

def do_bar():
    """가로 띠: 원본에서 --crop 영역을 잘라 --out 크기로 리사이즈(가로는 늘림). 배경 키잉 선택."""
    src, dst = sys.argv[2], sys.argv[3]
    W, H = ints(arg('out')); x0, y0, x1, y1 = ints(arg('crop'))
    im = Image.open(src).convert('RGB').crop((x0, y0, x1, y1)); a = np.array(im)
    bgn = arg('bg', 'none'); thr = float(arg('thr', 40))
    if bgn == 'none': al = np.full(a.shape[:2], 255, np.uint8)
    elif bgn == 'green': al = green_key_alpha(a, thr); a = despill_green(a, al)
    else: al = key_alpha(a, bg_color(a, bgn), thr)
    rgba = Image.fromarray(np.dstack([a, al]), 'RGBA')
    # 양 끝 장식은 비율 유지, 가운데는 늘림: --ends=px(원본) 지정 시
    ends = int(arg('ends', 0))
    if ends:
        sw, sh = rgba.size; s = H / sh; E = int(round(ends * s))
        L = Image.LANCZOS
        left = rgba.crop((0, 0, ends, sh)).resize((E, H), L)
        right = rgba.crop((sw - ends, 0, sw, sh)).resize((E, H), L)
        mid = rgba.crop((ends, 0, sw - ends, sh)).resize((W - 2 * E, H), L)
        out = Image.new('RGBA', (W, H)); out.paste(left, (0, 0)); out.paste(mid, (E, 0)); out.paste(right, (W - E, 0))
    else:
        out = rgba.resize((W, H), Image.LANCZOS)
    out.save(dst); print(dst, out.size)

def do_check():
    for f in sys.argv[2:]:
        im = Image.open(f); a = np.array(im.convert('RGBA'))
        al = a[..., 3]
        print('%-60s %s %s alpha[min=%d max=%d transparent=%.1f%%] corners_alpha=%s' % (
            f, im.size, im.mode, al.min(), al.max(), (al == 0).mean() * 100,
            [int(al[0, 0]), int(al[0, -1]), int(al[-1, 0]), int(al[-1, -1])]))

if __name__ == '__main__':
    {'key': do_key, 'nine': do_nine, 'bar': do_bar, 'check': do_check}[sys.argv[1]]()
