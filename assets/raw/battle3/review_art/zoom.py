# -*- coding: utf-8 -*-
# python zoom.py <png> x0 y0 x1 y1 scale out [r,g,b]
import sys
from PIL import Image
p,x0,y0,x1,y1,s,out=sys.argv[1],*map(int,sys.argv[2:6]),float(sys.argv[6]),sys.argv[7]
bg=tuple(int(v) for v in sys.argv[8].split(',')) if len(sys.argv)>8 else (37,45,78)
im=Image.open(p).convert('RGBA').crop((x0,y0,x1,y1))
b=Image.new('RGBA',im.size,bg+(255,)); b.alpha_composite(im)
b=b.convert('RGB').resize((int(im.width*s),int(im.height*s)),Image.NEAREST if s>=3 else Image.LANCZOS); b.save(out)
