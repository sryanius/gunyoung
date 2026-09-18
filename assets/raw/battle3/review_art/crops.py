# -*- coding: utf-8 -*-
# 검수용 크롭: 패널 색(무장 색 50% 어둡게) + 밝은 회색 위에 합성해 잔여·붕괴를 본다
import sys
from PIL import Image
R='C:/claude/gunyoung/assets/battle/'; O='C:/claude/gunyoung/assets/raw/battle3/review_art/'
col={'guanyu':(0x3a,0xa6,0x55),'zhangfei':(0xc8,0x40,0x2e),'xiahoudun':(0x3b,0x6f,0xd6),'dianwei':(0x4a,0x5a,0x9c)}
crops={
 'guanyu':[('face',380,420,880,900),('handL',200,1380,480,1680),('handR',560,1380,960,1700),('hairR',820,250,1248,1050),('blade',200,0,1000,420),('capeL',0,380,480,1100)],
 'zhangfei':[('face',380,380,880,800),('handUp',60,180,360,480),('handR',950,820,1248,1080),('hairblue',700,480,1248,1000),('capeblue',600,1300,1248,1824),('chest',380,700,960,1100),('specks',0,60,1248,400)],
 'xiahoudun':[('face',250,300,800,760),('hands',880,280,1248,700),('hip',900,820,1248,1150),('cornerTL',0,0,500,500),('legs',0,1150,1248,1824),('bladeedge',0,1050,700,1824)],
 'dianwei':[('face',400,80,900,560),('scarf',480,440,900,760),('capeW',880,560,1248,900),('handL',0,1150,420,1700),('axeL',0,0,480,860),('axeR',820,0,1248,520),('hips',250,1150,1050,1824)],
}
for k,cs in crops.items():
    im=Image.open(R+'cutin/%s.png'%k).convert('RGBA')
    c=col[k]; dark=tuple(int(v*0.5) for v in c)
    for name,x0,y0,x1,y1 in cs:
        cr=im.crop((x0,y0,x1,y1))
        w,h=cr.size
        out=Image.new('RGB',(w*2+8,h),(0,0,0))
        for i,bg in enumerate((dark,(200,200,200))):
            b=Image.new('RGBA',(w,h),bg+(255,)); b.alpha_composite(cr); out.paste(b.convert('RGB'),(i*(w+8),0))
        out.save(O+'c_%s_%s.png'%(k,name))
print('ok')
