import sys, glob
from PIL import Image
import numpy as np
for f in sorted(glob.glob('assets/battle/field/*.png') + glob.glob('assets/battle/fx/*.png') + glob.glob('assets/battle/hud/*.png') + glob.glob('assets/battle/units2/*.png')):
    im = Image.open(f)
    a = np.array(im.convert('RGBA')).astype(float)
    al = a[..., 3] / 255
    lum = a[..., :3].mean(axis=2)
    ys, xs = np.where(al > 0.05)
    bbox = (xs.min(), ys.min(), xs.max(), ys.max()) if len(xs) else None
    print(f.replace('assets/battle/', ''), im.size, im.mode, 'alpha mean %.2f' % al.mean(), 'bbox', bbox, 'lum mean %.0f' % lum.mean(),
          'rows alpha top/mid/bot %.2f %.2f %.2f' % (al[0].mean(), al[al.shape[0] // 2].mean(), al[-1].mean()))
