from PIL import Image
import numpy as np
A = 'assets/battle/fx/'
for f in ['ring', 'impact', 'spark', 'dust', 'slash_white', 'slash_blue', 'speedlines']:
    a = np.array(Image.open(A + f + '.png').convert('RGB')).astype(float).mean(axis=2)
    h, w = a.shape
    ys, xs = np.where(a > 40)
    print(f, (w, h), 'bright bbox', xs.min(), ys.min(), xs.max(), ys.max(), 'edge max lum', int(max(a[0].max(), a[-1].max(), a[:, 0].max(), a[:, -1].max())))
    if f == 'ring':
        row = a[h // 2]; xs2 = np.where(row > 120)[0]; print('  ring mid-row bright cols', xs2.min(), xs2.max(), '→ 지름/캔버스 = %.2f' % ((xs2.max() - xs2.min()) / w))
    if f == 'speedlines':
        cy, cx = h // 2, w // 2
        print('  center lum', int(a[cy - 40:cy + 40, cx - 80:cx + 80].mean()), 'hole half-width(row mid)', int(np.where(a[cy, cx:] > 60)[0].min()), 'hole half-height', int(np.where(a[cy:, cx] > 60)[0].min()))
