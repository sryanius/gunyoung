# flag.png ← flag_s6.png : 좌우 반전 → crop(x150..570, y205..835) → 초록 키잉(thr 25, 1px 침식) → 채도 0 → 64×96 fit
from PIL import Image, ImageOps; import numpy as np, subprocess, sys
p='C:/claude/gunyoung/assets/raw/ui/'
im=ImageOps.mirror(Image.open(p+'flag_s6.png').convert('RGB'))   # 원본 깃대 x≈425~450 → 반전 후 x≈382~407
W=im.width
im=im.crop((W-570, 205, W-150, 835)); im.save(p+'flag_s6_crop.png')
sys.exit(subprocess.call([sys.executable, p+'post.py','key',p+'flag_s6_crop.png',p+'flag_try1.png','--bg=green','--thr=25','--erode=1','--desat','--fit=64,96','--pad=1']))
