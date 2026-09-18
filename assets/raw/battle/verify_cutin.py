# -*- coding: utf-8 -*-
"""검수 수정 확인: 컷인 알파 구멍·프린지.
usage: python verify_cutin.py zhangfei.png guanyu.png out.png
 - 장비 눈 상자 두 개의 알파 평균(1.0 이어야), 가장자리에 안 닿는 알파 0 성분 수·크기
 - 관우 반투명 픽셀 평균색(붉은 프린지면 R 이 높다), 알파 0 픽셀 RGB 최대
 - 어두운 배경(20,20,20) 위 얼굴 크롭 ±200 를 2배로 나란히 저장"""
import sys, numpy as np
from PIL import Image
from scipy import ndimage
zf, gy, out = sys.argv[1:4]
def load(p):
    a = np.array(Image.open(p).convert('RGBA')); return a[..., :3], a[..., 3]
def holes(al):
    lab, n = ndimage.label(al == 0)
    if n == 0: return []
    sizes = ndimage.sum(np.ones_like(al, dtype=np.float32), lab, range(1, n + 1))
    edge = set()
    for s in (lab[0], lab[-1], lab[:, 0], lab[:, -1]): edge |= set(np.unique(s).tolist())
    return sorted([int(sizes[i - 1]) for i in range(1, n + 1) if i not in edge])
for name, p in (('zhangfei', zf), ('guanyu', gy)):
    rgb, al = load(p)
    h = holes(al)
    semi = (al > 0) & (al < 255)
    print('%s: 가장자리 미접촉 투명 성분 %d 개 %s' % (name, len(h), h[:12]))
    print('   반투명 픽셀 %d 개 평균색 %s / 알파0 RGB max %d' % (semi.sum(), tuple(int(v) for v in rgb[semi].mean(0)) if semi.any() else None, int(rgb[al == 0].max()) if (al == 0).any() else -1))
rgb, al = load(zf)
for (x0, x1, y0, y1) in ((527, 546, 174, 195), (417, 442, 207, 227)):
    box = al[y0:y1, x0:x1] / 255.0
    print('장비 눈 상자 x%d-%d y%d-%d: 알파 평균 %.3f min %.2f  RGB 평균 %s' % (x0, x1 - 1, y0, y1 - 1, box.mean(), box.min(), tuple(int(v) for v in rgb[y0:y1, x0:x1].reshape(-1, 3).mean(0))))
# 얼굴 크롭을 어두운 배경 위에
def face(p, cx, cy):
    im = Image.open(p).convert('RGBA').crop((cx - 200, cy - 200, cx + 200, cy + 200))
    bg = Image.new('RGBA', im.size, (20, 20, 20, 255)); bg.alpha_composite(im)
    return bg.resize((800, 800), Image.LANCZOS)
def edge(p, cx, cy):  # 프린지 확인용 4배 크롭
    im = Image.open(p).convert('RGBA').crop((cx - 100, cy - 100, cx + 100, cy + 100))
    bg = Image.new('RGBA', im.size, (20, 20, 20, 255)); bg.alpha_composite(im)
    return bg.resize((800, 800), Image.NEAREST)
sheet = Image.new('RGBA', (3200, 800), (0, 0, 0, 255))
sheet.paste(face(zf, 560, 220), (0, 0)); sheet.paste(face(gy, 600, 300), (800, 0))
sheet.paste(edge(gy, int(sys.argv[4]) if len(sys.argv) > 4 else 500, int(sys.argv[5]) if len(sys.argv) > 5 else 150), (1600, 0))
sheet.paste(edge(zf, int(sys.argv[6]) if len(sys.argv) > 6 else 150, int(sys.argv[7]) if len(sys.argv) > 7 else 800), (2400, 0))
sheet.convert('RGB').save(out); print(out)
