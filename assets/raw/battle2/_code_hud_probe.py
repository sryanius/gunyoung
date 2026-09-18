from PIL import Image
import numpy as np
A = 'assets/battle/hud/'
for f in ['portrait_frame', 'bar_frame', 'medallion']:
    im = Image.open(A + f + '.png').convert('RGBA'); a = np.array(im)[..., 3] / 255.0
    h, w = a.shape
    print(f, im.size, 'alpha mean %.2f' % a.mean())
    row = a[h // 2]; col = a[:, w // 2]
    def hole(v):
        xs = np.where(v < 0.2)[0]
        return (int(xs.min()), int(xs.max())) if len(xs) else None
    print('  mid row hole', hole(row), ' mid col hole', hole(col))
    if f == 'medallion':
        # 구멍 반지름을 여러 방향으로
        cx = cy = w / 2
        rs = []
        for ang in range(0, 360, 30):
            r = 0
            while r < w / 2 and a[int(cy + np.sin(np.radians(ang)) * r), int(cx + np.cos(np.radians(ang)) * r)] < 0.2: r += 1
            rs.append(r)
        print('  hole radius by angle', rs)
        ys, xs = np.where(a > 0.5); print('  outer bbox', xs.min(), ys.min(), xs.max(), ys.max())
for f in ['portrait_guanyu', 'skill_guanyu', 'skill_zhangfei']:
    im = Image.open(A + f + '.png'); print(f, im.size, im.mode)
