# -*- coding: utf-8 -*-
"""SDXL 원본(832×1216) → Qwen stand 고치기 입력: [--flip] 뒤 좌우에 배경색(테두리 링 중앙값)을 덧대 1040×1216 (= 383:448, edit.py 가 고르는 944×1104 와 같은 비율).
   python padflip.py <src> <dst> [--flip]"""
import sys, numpy as np
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB')
if '--flip' in sys.argv: im = im.transpose(Image.FLIP_LEFT_RIGHT)
a = np.array(im); w = 8
ring = np.concatenate([a[:w].reshape(-1, 3), a[-w:].reshape(-1, 3), a[:, :w].reshape(-1, 3), a[:, -w:].reshape(-1, 3)]); bg = tuple(int(v) for v in np.median(ring, 0))
W = round(im.height * 383 / 448); out = Image.new('RGB', (W, im.height), bg); out.paste(im, ((W - im.width) // 2, 0)); out.save(dst); print(dst, out.size, 'bg', bg)
