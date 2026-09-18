# banner.png ← banner_i2i2_d0.6_s1.png(1536×640, 초록 배경 img2img) → 초록 키잉 → 512×128 fit → 비단 광택(가로 띠 그라데이션) 오버레이
import sys, subprocess; from PIL import Image; import numpy as np
p='C:/claude/gunyoung/assets/raw/ui/'
src=sys.argv[1] if len(sys.argv)>1 else 'banner_i2i2_d0.6_s1.png'; dst=sys.argv[2] if len(sys.argv)>2 else 'banner_try2.png'
subprocess.check_call([sys.executable,p+'post.py','key',p+src,p+'_banner_keyed.png','--bg=green','--thr=30','--erode=1','--fit=512,128','--pad=2'])
im=Image.open(p+'_banner_keyed.png').convert('RGBA'); a=np.array(im).astype(np.float32)
al=a[...,3:4]/255
# 세로 방향 광택: 위 0.88 → 중앙(38%) 1.12 → 아래 0.82, 리본 픽셀(알파>0)에만 곱함
H=im.height; y=np.arange(H)[:,None,None]/H
sheen=np.where(y<0.38, 0.88+(1.12-0.88)*(y/0.38), 1.12-(1.12-0.82)*((y-0.38)/0.62))
# 가로 방향 살짝: 양 끝 0.95
x=np.arange(im.width)[None,:,None]/im.width; sheen=sheen*(0.95+0.05*np.sin(np.pi*x))
rgb=a[...,:3]*(1+(sheen-1)*al); a[...,:3]=np.clip(rgb,0,255)
Image.fromarray(a.astype(np.uint8),'RGBA').save(p+dst); print(dst, im.size)
