# parchment.png ← parchment_s1.png(1024, 가장자리 살짝 어두운 한지) → 256×256 Lanczos → 3px 안쪽에 갈색 1px 선(알파 0.22)
from PIL import Image, ImageDraw
p='C:/claude/gunyoung/assets/raw/ui/'
im=Image.open(p+'parchment_s1.png').convert('RGB').resize((256,256),Image.LANCZOS).convert('RGBA')
ov=Image.new('RGBA',im.size,(0,0,0,0)); d=ImageDraw.Draw(ov)
d.rectangle((3,3,252,252),outline=(120,80,40,56),width=1)
im.alpha_composite(ov); im.save(p+'parchment_try1.png'); print('parchment', im.size)
