# usage: preview.py out.png in1.png [in2.png ...]  — 체커+파랑 배경 위에 나란히 올려 투명 판정용
import sys; from PIL import Image
ins=[Image.open(f).convert('RGBA') for f in sys.argv[2:]]
W=sum(i.width for i in ins)+20*(len(ins)+1); H=max(i.height for i in ins)+40
bg=Image.new('RGBA',(W,H),(70,100,150,255))
for y in range(0,H,16):
    for x in range(0,W,16):
        if (x//16+y//16)%2: bg.paste((120,120,120,255),(x,y,x+16,y+16))
x=20
for i in ins: bg.alpha_composite(i,(x,20)); x+=i.width+20
bg.save(sys.argv[1]); print(sys.argv[1], bg.size)
