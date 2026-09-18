# hud_bar.png ← hudw_s2.png 가운데 띠(y 350~452) 크롭 → 가운데 메달리온을 옆 구간으로 덮음 → 끝단만 검정 키잉 → 1280×72
from PIL import Image, ImageFilter; import numpy as np
p='C:/claude/gunyoung/assets/raw/ui/'
im=Image.open(p+'hudw_s2.png').convert('RGB').crop((50,350,1485,452))
a=np.array(im); w,h=im.size
# 가운데 메달리온(원본 x≈700~830 → 크롭 좌표 650~780) 을 왼쪽 평범한 구간(470~600)으로 덮기
seg=a[:,470:600].astype(np.float32); dst=a[:,650:780].astype(np.float32)
ramp=np.ones(130,np.float32); ramp[:24]=np.linspace(0,1,24); ramp[-24:]=np.linspace(1,0,24)  # 양쪽 24px 페더
a[:,650:780]=(dst*(1-ramp[None,:,None])+seg*ramp[None,:,None]).astype(np.uint8)
# 알파: 안쪽은 불투명, 양 끝 70px 안에서만 검정 키잉(둥근 끝단 바깥을 투명하게)
lum=a.astype(np.float32)@np.array([0.299,0.587,0.114])
al=np.full((h,w),255,np.uint8)
k=np.clip((lum-18)/20,0,1)*255
al[:, :70]=k[:, :70]; al[:, w-70:]=k[:, w-70:]
# 위아래 검정 여백(띠 밖) 도 투명하게: 각 열에서 밝기 낮은 위/아래 행
top=np.clip((lum-14)/16,0,1)*255
al=np.minimum(al, np.where((np.arange(h)[:,None]<12)|(np.arange(h)[:,None]>h-12), top, 255)).astype(np.uint8)
al=np.array(Image.fromarray(al).filter(ImageFilter.MinFilter(3)))
rgba=Image.fromarray(np.dstack([a,al]),'RGBA')
out=rgba.resize((1280,72),Image.LANCZOS)
out.save(p+'hud_try1.png'); print('hud_try1', out.size)
