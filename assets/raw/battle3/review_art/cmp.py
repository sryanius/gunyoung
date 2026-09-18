# -*- coding: utf-8 -*-
from PIL import Image, ImageDraw
R='C:/claude/gunyoung/assets/'; O=R+'raw/battle3/review_art/'
keys=['guanyu','zhangfei','xiahoudun','dianwei']
S=3
W=128*S; H=160*S
sheet=Image.new('RGB',(W*5,H*3),(150,130,90))
d=ImageDraw.Draw(sheet)
def put(path,cx,cy,flip=False):
    im=Image.open(path).convert('RGBA')
    if flip: im=im.transpose(Image.FLIP_LEFT_RIGHT)
    im=im.resize((W,H),Image.NEAREST); sheet.paste(im,(cx*W,cy*H),im)
    d.line([(cx*W,cy*H+152*S),(cx*W+W,cy*H+152*S)],fill=(255,0,0))
    d.line([(cx*W+W//2,cy*H),(cx*W+W//2,cy*H+H)],fill=(255,255,0))
for i,k in enumerate(keys):
    put(R+'raw/battle/male_v2/units2/gen_%s_stand.png'%k,i,0)
    put(R+'battle/units2/gen_%s_stand.png'%k,i,1)
    put(R+'battle/units2/gen_%s_attack.png'%k,i,2)
put(R+'battle/units2/inf_g_stand.png',4,0); put(R+'battle/units2/spear_b_stand.png',4,1); put(R+'battle/units2/cav_g_stand.png',4,2)
sheet.save(O+'units_cmp.png')
