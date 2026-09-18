# 통합 담당 확인용 — 실제 에셋 크기·모드·알파 경계·배경색 잔여·far 아래변 알파·루프 이음. 그림은 .gitignore.
#   python assets/raw/battle/_integ_check.py
# ※ 병사 방향은 수치로 못 잰다(살색 무게중심 휴리스틱은 투구·수염 때문에 전부 틀렸다) → _integ_faces_8x.png 를 눈으로 볼 것:
#   눈·볼·뻗은 팔이 오른쪽, 활·망토·화살통이 왼쪽(등 뒤)이어야 「오른쪽 보기」.
import os, sys
sys.stdout.reconfigure(encoding='utf-8')   # cp949 콘솔에서 '—' 출력 오류 방지
from PIL import Image
import numpy as np
from scipy import ndimage
root = r'C:\claude\gunyoung\assets\battle'
raw = r'C:\claude\gunyoung\assets\raw\battle'
files = ['sky.png','far.png','ground.png','cutin/guanyu.png','cutin/zhangfei.png','cutin/xiahoudun.png','cutin/dianwei.png',
         'units/inf.png','units/spear.png','units/bow.png','units/cav.png','units/general_left.png','units/general_right.png']
BG = {'cutin/guanyu.png': (241,34,109), 'cutin/zhangfei.png': (5,90,72), 'cutin/xiahoudun.png': (250,6,129), 'cutin/dianwei.png': (249,30,127)}   # 검수가 잰 배경색(키잉 뒤 남은 것 기준)
faces = []
for f in files:
    p = os.path.join(root, f)
    if not os.path.exists(p):
        print(f'{f:28s} (none)'); continue
    im = Image.open(p)
    a = np.array(im.convert('RGBA')).astype(int)
    al = a[...,3]
    ys, xs = np.where(al > 8)
    bbox = (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max()))
    line = f'{f:28s} {im.size[0]}x{im.size[1]} {im.mode:5s} bbox={bbox}'
    if f.startswith('units/'):
        lab, n = ndimage.label(al > 8)
        lum = (0.299*a[...,0]+0.587*a[...,1]+0.114*a[...,2])[al>200]
        line += f' aw={bbox[2]-bbox[0]+1} ah={bbox[3]-bbox[1]+1} foot_y={bbox[3]} lum={lum.mean():.0f} pieces={n}'
        faces.append(im.convert('RGBA').crop((0,0,96,60)).resize((96*8,60*8), Image.NEAREST))
    if f in BG:
        br,bg,bb = BG[f]
        d = np.sqrt((a[...,0]-br)**2+(a[...,1]-bg)**2+(a[...,2]-bb)**2)
        m = (al>250)&(d<22)
        lab,n = ndimage.label(m); sizes = ndimage.sum(m, lab, range(1,n+1)) if n else []
        lab2,n2 = ndimage.label(al<8); edge = set(np.unique(np.concatenate([lab2[0],lab2[-1],lab2[:,0],lab2[:,-1]])))
        inner = [i for i in range(1,n2+1) if i not in edge]
        semi = (al>8)&(al<250)
        line += f' bg_opaque(<22)={int(m.sum())} patches>=20px={int((np.array(sizes)>=20).sum()) if n else 0} inner_holes={len(inner)} semi_rgb={a[semi][:,:3].mean(0).astype(int)} alpha0_rgb_max={a[al==0][:,:3].max()}'
        if f.endswith('zhangfei.png'):
            e1 = al[174:195,527:546]/255.0; e2 = al[207:227,417:442]/255.0
            line += f' eyes={e1.mean():.3f}/{e1.min():.2f},{e2.mean():.3f}/{e2.min():.2f}'
    if f == 'far.png':
        bottom = al[-1]/255.0
        line += f' bottom_alpha_mean={bottom.mean():.2f} row330_cols>0.8={(al[330]/255.0>0.8).sum()} top16_alpha_max={al[:16].max()} seamLR={np.abs(a[:,0,:3]-a[:,-1,:3]).mean():.2f}'
    if f == 'ground.png':
        line += f' seamLR={np.abs(a[:,0,:3]-a[:,-1,:3]).mean():.2f} (adjacent {np.abs(a[:,1,:3]-a[:,2,:3]).mean():.2f}) mean={a[...,:3].reshape(-1,3).mean(0).astype(int)}'
    if f == 'sky.png':
        line += f' seamLR={np.abs(a[:,0,:3]-a[:,-1,:3]).mean():.2f} (비루프 — 코드는 image+배율)'
    print(line)
if faces:
    sheet = Image.new('RGBA', (len(faces)*(96*8+16), 60*8), (60,60,60,255))
    for i, im in enumerate(faces): sheet.paste(im, (i*(96*8+16), 0), im)
    out = os.path.join(raw, '_integ_faces_8x.png'); sheet.save(out); print('faces sheet ->', out, '(inf spear bow cav general_left general_right 순)')
