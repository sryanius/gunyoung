# 리본 초안: 붉은 가로 띠 + 제비꼬리 끝 + 금색 테두리, 초록 배경 (img2img 의 init)
from PIL import Image, ImageDraw
W,H=1536,640; im=Image.new('RGB',(W,H),(60,160,90)); d=ImageDraw.Draw(im)
x0,x1,y0,y1=120,1416,180,460; notch=110
poly=[(x0,y0),(x1,y0),(x1-notch,(y0+y1)//2),(x1,y1),(x0,y1),(x0+notch,(y0+y1)//2)]
d.polygon(poly,fill=(178,34,34),outline=(212,175,55),width=10)
# 안쪽 금선
inner=[(x0+28,y0+26),(x1-28,y0+26),(x1-notch-20,(y0+y1)//2),(x1-28,y1-26),(x0+28,y1-26),(x0+notch+20,(y0+y1)//2)]
d.line(inner+[inner[0]],fill=(230,190,80),width=5)
# 위아래 음영 띠
d.rectangle((x0+40,y0+10,x1-40,y0+40),fill=(150,25,25)); d.rectangle((x0+40,y1-40,x1-40,y1-10),fill=(120,18,18))
im.save('C:/claude/gunyoung/assets/raw/ui/ribbon_init2.png'); print('ribbon_init', im.size)
