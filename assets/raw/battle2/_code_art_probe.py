from PIL import Image
import numpy as np
def cols(f, rows):
    a = np.array(Image.open(f).convert('RGBA'))[..., 3] / 255.0
    sub = a[rows[0]:rows[1]]
    c = sub.mean(axis=0)
    xs = np.where(c > 0.3)[0]
    return (int(xs.min()), int(xs.max())) if len(xs) else None
for f in ['flag_g', 'flag_b']:
    print(f, 'pole cols (bottom 20 rows):', cols(f'assets/battle/field/{f}.png', (50, 70)))
for f in ['banner_g', 'banner_b']:
    print(f, 'pole cols (bottom 30 rows):', cols(f'assets/battle/field/{f}.png', (160, 188)), 'cloth cols (top):', cols(f'assets/battle/field/{f}.png', (10, 100)))
for f in ['tent', 'palisade', 'rock1', 'rock2', 'tree_dead']:
    im = Image.open(f'assets/battle/field/{f}.png').convert('RGBA')
    a = np.array(im)[..., 3] / 255.0
    rows = a.mean(axis=1)
    # 바닥: 아래에서부터 알파 행 평균이 0.25 넘는 첫 행
    ys = np.where(rows > 0.25)[0]
    print(f, im.size, 'solid rows', int(ys.min()), '~', int(ys.max()), 'of', im.size[1], '→ origin y ≈ %.2f' % ((ys.max() + 1) / im.size[1]))
g = np.array(Image.open('assets/battle/field/ground.png').convert('RGBA')).astype(float)
print('ground alpha rows 0..40:', [round(float(g[y, :, 3].mean() / 255), 2) for y in range(0, 44, 4)])
print('ground lum rows:', [int(g[y, :, :3].mean()) for y in range(0, 360, 40)])
m = np.array(Image.open('assets/battle/field/mid.png').convert('RGBA')).astype(float)
print('mid alpha rows:', [round(float(m[y, :, 3].mean() / 255), 2) for y in range(0, 260, 20)], 'last rows', [round(float(m[y, :, 3].mean() / 255), 2) for y in range(240, 260, 4)])
fg = np.array(Image.open('assets/battle/field/fog.png').convert('RGBA')).astype(float)
print('fog alpha rows:', [round(float(fg[y, :, 3].mean() / 255), 2) for y in range(0, 160, 16)], 'max', fg[..., 3].max() / 255)
