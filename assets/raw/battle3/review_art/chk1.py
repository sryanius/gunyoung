# -*- coding: utf-8 -*-
# 검수: 크기·모드·알파·가장자리 페이드·조각 수
import sys, numpy as np
from PIL import Image
from scipy import ndimage
sys.stdout.reconfigure(encoding='utf-8')
R='C:/claude/gunyoung/assets/battle/'
keys=['guanyu','zhangfei','xiahoudun','dianwei']
print('== cutin ==')
for k in keys:
    im=Image.open(R+'cutin/%s.png'%k); a=np.array(im.convert('RGBA')); al=a[...,3]
    print(k, im.size, im.mode, 'alpha min/max',al.min(),al.max(), 'opaque%%=%.1f'%((al>250).mean()*100))
    print('  edge max alpha: top',al[0].max(),'bot',al[-1].max(),'L',al[:,0].max(),'R',al[:,-1].max())
    # fade profile: max alpha per column near left / right, per row near top/bottom
    print('  col max alpha x=0,20,60,120,200,255,300:',[int(al[:,x].max()) for x in (0,20,60,120,200,255,300)])
    print('  col max alpha from right 0,20,60,100,135,160:',[int(al[:,-1-x].max()) for x in (0,20,60,100,135,160)])
    print('  row max alpha y=0,10,30,50,75,100:',[int(al[y].max()) for y in (0,10,30,50,75,100)])
    print('  row max alpha from bottom 0,20,60,110,165,200:',[int(al[-1-y].max()) for y in (0,20,60,110,165,200)])
    ys,xs=np.where(al>8); print('  bbox',xs.min(),ys.min(),xs.max(),ys.max())
    lab,n=ndimage.label(al>0); sz=ndimage.sum(al>0,lab,range(1,n+1)); print('  components',n, sorted([int(s) for s in sz])[-5:])
    print('  alpha0 rgb max', int(a[...,:3][al==0].max()) if (al==0).any() else None)
    # inner transparent holes not touching edge
    lab2,n2=ndimage.label(al==0); edge=set(np.unique(np.concatenate([lab2[0],lab2[-1],lab2[:,0],lab2[:,-1]])).tolist())
    inner=[(int(ndimage.sum(np.ones_like(al),lab2,i)),ndimage.center_of_mass(al==0,lab2,i)) for i in range(1,n2+1) if i not in edge]
    inner.sort(reverse=True); print('  inner holes',len(inner),[(s,int(c[1]),int(c[0])) for s,c in inner[:12]])
print('== eyes ==')
for k in keys:
    im=Image.open(R+'cutin/%s_eyes.png'%k); print(k,im.size,im.mode)
print('== portraits ==')
for k in keys:
    im=Image.open(R+'hud/portrait_%s.png'%k); a=np.array(im.convert('RGB')).astype(float)
    print(k,im.size,im.mode,'mean lum %.0f'%a.mean(),'center box lum %.0f'%a[30:90,24:72].mean())
print('== units ==')
for k in keys:
    for p in ('stand','attack'):
        im=Image.open(R+'units2/gen_%s_%s.png'%(k,p)); a=np.array(im.convert('RGBA')); al=a[...,3]
        ys,xs=np.where(al>8); 
        lab,n=ndimage.label(al>0)
        rgb=a[...,:3].astype(int)
        op=al>128
        # magenta-ish: r,b high g low
        mg=op&(rgb[...,0]>150)&(rgb[...,2]>150)&(rgb[...,1]<110)
        mg2=op&(rgb[...,0]-rgb[...,1]>50)&(rgb[...,2]-rgb[...,1]>50)
        # feet: rows 148..156 alpha counts
        rows={y:int((al[y]>128).sum()) for y in range(146,160)}
        print(k,p,im.size,im.mode,'bbox',xs.min(),ys.min(),xs.max(),ys.max(),'h',ys.max()-ys.min()+1,'comps',n,'magenta strict',int(mg.sum()),'loose',int(mg2.sum()))
        print('    rows',rows)
