# -*- coding: utf-8 -*-
"""눈 클로즈업 띠(1024×256 RGB) — 주 일러스트(하이레즈 원본, 배경 있는 cand/hi_*.png)에서 두 눈 가운데를 중심으로 잘라 확대.
  python eyes.py crop   → hi/eyes_<key>_in.png (1216×832, Lanczos 확대 — img2img 입력)
  (batch_eyes.sh 가 img2img denoise 0.3 으로 디테일을 다시 그린다 → cand/eyes_<key>_s<seed>.png)
  python eyes.py strip  → cutkey 로 배경을 빼고 어두운 무장 색 그라데이션 위에 합성, 가운데 1024×256 을 잘라 assets/battle/cutin/<key>_eyes.png
  EYES: 1248×1824 좌표(하후돈은 뒤집은 뒤)의 두 눈 가운데, 눈 사이 거리 d. 띠에서 눈 사이가 폭의 frac 이 되게 자른다."""
import sys, os, subprocess, numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
PY = sys.executable
EYES = {  # key: (src, flip, (mx, my), d, frac, seed, hue, 띠 배경 위/아래 색)
    'guanyu':    ('cand/hi_guanyu_s69.png',    False, (611, 660), 139, 0.27, 69, '300,350', ((26, 60, 38), (6, 16, 10))),
    'zhangfei':  ('cand/hi_zhangfei_s47.png',  False, (566, 549), 124, 0.27, 47, '165,190', ((84, 26, 22), (20, 6, 6))),
    'xiahoudun': ('cand/hi_xiahoudun_s41.png', True,  (536, 454), 137, 0.27, 41, '300,350', ((26, 44, 96), (6, 10, 28))),
    'dianwei':   ('cand/hi_dianwei_s44.png',   False, (653, 388),  91, 0.24, 44, '300,350', ((30, 36, 70), (6, 8, 20))),
}
def crop():
    for k, (src, flip, (mx, my), d, frac, seed, hue, cols) in EYES.items():
        im = Image.open(os.path.join(HERE, src)).convert('RGB')
        if flip: im = im.transpose(Image.FLIP_LEFT_RIGHT)
        wc = d / frac; s = 1024 / wc; cw, ch = 1216 / s, 832 / s
        box = (mx - cw / 2, my - ch / 2, mx + cw / 2, my + ch / 2)
        # 캔버스 밖은 가장자리 색으로 늘려 채운다(전위 머리 위)
        pad = int(max(0, -box[0], -box[1], box[2] - im.width, box[3] - im.height)) + 2
        a = np.pad(np.array(im), ((pad, pad), (pad, pad), (0, 0)), mode='edge'); im2 = Image.fromarray(a)
        c = im2.crop(tuple(int(round(v + pad)) for v in box)).resize((1216, 832), Image.LANCZOS)
        c.save(os.path.join(HERE, 'hi', 'eyes_%s_in.png' % k)); print(k, 'crop', [round(v) for v in box], 'scale %.2f' % s)
def strip():
    for k, (src, flip, (mx, my), d, frac, seed, hue, cols) in EYES.items():
        up = os.path.join(HERE, 'cand', 'eyes_%s_s%d.png' % (k, seed)); keyed = os.path.join(HERE, 'k', 'eyes_%s_key.png' % k)
        subprocess.run([PY, os.path.join(HERE, 'cutkey.py'), up, keyed, '--hue=' + hue, '--smin=0.45', '--vmin=0.3', '--thr=55', '--ramp=40', '--sigma=45',
                        '--despeckle=1400', '--interior=200', '--fillnear=60', '--despill=20'] + (['--despillgain=0.55'] if k in ('guanyu', 'dianwei') else []) + (['--despillsmin=0.08'] if k == 'dianwei' else []), check=True)
        fg = Image.open(keyed).convert('RGBA'); W, H = fg.size
        y = np.linspace(0, 1, H)[:, None, None]; x = np.linspace(-1, 1, W)[None, :, None]
        top, bot = np.array(cols[0], np.float32), np.array(cols[1], np.float32)
        bg = (top * (1 - y) + bot * y) * (1.15 - 0.35 * np.abs(x))
        base = Image.fromarray(np.dstack([bg.clip(0, 255), np.full((H, W, 1), 255)]).astype(np.uint8), 'RGBA'); base.alpha_composite(fg)
        out = base.convert('RGB').crop((96, 288, 1120, 544)); assert out.size == (1024, 256)
        if k == 'guanyu':   # 남은 배경색 점(머리카락 사이 수 px)을 가장 가까운 다른 색으로
            import colorsys; from scipy import ndimage
            a = np.array(out); f = a.astype(np.float32) / 255; mx_, mn_ = f.max(-1), f.min(-1)
            sat = np.where(mx_ > 0, (mx_ - mn_) / np.maximum(mx_, 1e-6), 0)
            mag = (f[..., 0] > f[..., 1] * 1.8) & (f[..., 2] > f[..., 1] * 1.3) & (sat > 0.5) & (mx_ > 0.3)
            mag = ndimage.binary_dilation(mag, iterations=2)
            if mag.any():
                idx = ndimage.distance_transform_edt(mag, return_distances=False, return_indices=True); a[mag] = a[idx[0], idx[1]][mag]; out = Image.fromarray(a); print(k, '마젠타 점', int(mag.sum()))
        dst = os.path.join(ROOT, 'assets', 'battle', 'cutin', k + '_eyes.png'); out.save(dst); print(dst, out.size)
if __name__ == '__main__': {'crop': crop, 'strip': strip}[sys.argv[1]]()
