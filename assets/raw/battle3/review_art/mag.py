# -*- coding: utf-8 -*-
# 채도 높은 자홍/분홍 불투명 픽셀(무장 색과 무관한 색) 세기 + 위치 덩어리
import sys, numpy as np, colorsys
from PIL import Image
from scipy import ndimage
sys.stdout.reconfigure(encoding='utf-8')
R='C:/claude/gunyoung/assets/battle/cutin/'
for k in ['guanyu','zhangfei','xiahoudun','dianwei']:
    a=np.array(Image.open(R+k+'.png').convert('RGBA')).astype(int); r,g,b,al=a[...,0],a[...,1],a[...,2],a[...,3]
    m=(al>128)&(r>150)&(b>130)&(g<r-70)&(g<b-50)
    lab,n=ndimage.label(ndimage.binary_dilation(m,iterations=3)); 
    sz=ndimage.sum(m,lab,range(1,n+1)) if n else []
    com=ndimage.center_of_mass(m,lab,range(1,n+1)) if n else []
    big=sorted([(int(s),int(c[1]),int(c[0])) for s,c in zip(sz,com) if s>=30],reverse=True)[:10]
    print(k,'magenta px',int(m.sum()),'clusters>=30:',big)
    # near-white opaque blobs (possible bg glow residue): r,g,b>235
    w=(al>200)&(r>238)&(g>232)&(b>238)
    lab,n=ndimage.label(w); sz=ndimage.sum(w,lab,range(1,n+1)) if n else []; com=ndimage.center_of_mass(w,lab,range(1,n+1)) if n else []
    big=sorted([(int(s),int(c[1]),int(c[0])) for s,c in zip(sz,com) if s>=800],reverse=True)[:8]
    print('   white blobs>=800:',big)
