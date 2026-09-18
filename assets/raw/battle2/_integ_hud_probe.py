# 통합 담당: HUD 틀·메달리온·fx 링 기하 실측 (BattleHud.HUD_LAYOUT / fx.js RING_FILL 대조용)
import os, numpy as np
from PIL import Image
A = os.path.join(os.path.dirname(__file__), '..', '..', 'battle')
def hole(path):
    a = np.array(Image.open(path).convert('RGBA'))[:, :, 3]
    h, w = a.shape
    cy, cx = h // 2, w // 2
    row = a[cy]; col = a[:, cx]
    xs = np.where(row < 40)[0]; ys = np.where(col < 40)[0]
    print(os.path.basename(path), 'size', w, h, 'hole x', xs.min(), xs.max(), 'y', ys.min(), ys.max())
    # 불투명(>200) 테 두께
    print('   row alpha first20', row[:20].tolist())
    print('   col alpha first20', col[:20].tolist())
hole(os.path.join(A, 'hud', 'bar_frame.png'))
hole(os.path.join(A, 'hud', 'portrait_frame.png'))
m = np.array(Image.open(os.path.join(A, 'hud', 'medallion.png')).convert('RGBA')).astype(float)
h, w = m.shape[:2]
yy, xx = np.mgrid[0:h, 0:w]
r = np.hypot(xx - (w - 1) / 2, yy - (h - 1) / 2)
print('medallion radial: r, alpha mean, rgb mean')
for r0 in range(0, 82, 2):
    sel = (r >= r0) & (r < r0 + 2)
    print('  %2d-%2d a=%.2f rgb=%s' % (r0, r0 + 2, m[..., 3][sel].mean() / 255, m[..., :3][sel].mean(0).round().tolist()))
ring = np.array(Image.open(os.path.join(A, 'fx', 'ring.png')).convert('L')).astype(float)
h, w = ring.shape
yy, xx = np.mgrid[0:h, 0:w]
r = np.hypot(xx - (w - 1) / 2, yy - (h - 1) / 2)
prof = [ring[(r >= i) & (r < i + 1)].mean() for i in range(0, 128)]
pk = int(np.argmax(prof)); print('ring peak radius', pk, 'of', w / 2, '→ fill', pk * 2 / w, 'outer(<8)', max(i for i, v in enumerate(prof) if v > 8))
for name in ['slash_blue', 'slash_white', 'spark', 'dust', 'impact']:
    im = np.array(Image.open(os.path.join(A, 'fx', name + '.png')).convert('L')).astype(float)
    ys, xs = np.where(im > 40)
    cx = (im.sum(0) * np.arange(im.shape[1])).sum() / im.sum(); cy = (im.sum(1) * np.arange(im.shape[0])).sum() / im.sum()
    print(name, im.shape[::-1], 'bright bbox', xs.min(), ys.min(), xs.max(), ys.max(), 'centroid %.1f %.1f' % (cx, cy), 'max', im.max())
fog = np.array(Image.open(os.path.join(A, 'field', 'fog.png')))[:, :, 3] / 255
print('fog alpha mean %.3f max %.2f rowmax-mean %.3f' % (fog.mean(), fog.max(), fog.mean(1).max()))
g = np.array(Image.open(os.path.join(A, 'field', 'ground.png')))
print('ground alpha rows 0,10,20,30,39,40,45:', [int(g[y, :, 3].mean()) for y in (0, 10, 20, 30, 39, 40, 45)])
print('ground row mean rgb y40,120,200,300,359:', [g[y, :, :3].mean(0).round().tolist() for y in (40, 120, 200, 300, 359)])
mid = np.array(Image.open(os.path.join(A, 'field', 'mid.png')))
print('mid alpha row means:', [(y, round(float(mid[y, :, 3].mean() / 255), 2)) for y in range(0, 260, 20)] + [(y, round(float(mid[y, :, 3].mean() / 255), 2)) for y in (245, 250, 255, 259)])
