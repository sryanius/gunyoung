# -*- coding: utf-8 -*-
import numpy as np
from PIL import Image
R='C:/claude/gunyoung/assets/battle/units2/'; O='C:/claude/gunyoung/assets/raw/battle3/review_art/'
keys=['guanyu','zhangfei','xiahoudun','dianwei']
S=7; cw,ch=80,70
sheet=Image.new('RGB',(cw*S*4,ch*S*2),(90,80,60))
for j,p in enumerate(('stand','attack')):
    for i,k in enumerate(keys):
        im=Image.open(R+'gen_%s_%s.png'%(k,p)).convert('RGBA')
        a=np.array(im)[...,3]; ys,xs=np.where(a>8); y0=max(0,ys.min()-2)
        # head column: widest region in top 60 rows
        cols=np.where(a[y0:y0+55].sum(0)>0)[0]
        # pick center by mass in top rows
        xs2=np.where(a[y0:y0+50]>128)[1]; cx=int(np.median(xs2))
        x0=max(0,min(128-cw,cx-cw//2))
        cr=im.crop((x0,y0,x0+cw,y0+ch)).resize((cw*S,ch*S),Image.NEAREST)
        sheet.paste(cr,(i*cw*S,j*ch*S),cr)
        # edges
        print(k,p,'edge alpha max L',a[:,0].max(),'R',a[:,-1].max(),'T',a[0].max(), 'L-col opaque px',int((a[:,0]>128).sum()),'R-col',int((a[:,-1]>128).sum()))
sheet.save(O+'unit_heads.png')
