# -*- coding: utf-8 -*-
"""BATTLE_ART.md §2·§3·§4 계약 검사(크기·알파·fx 가장자리 순검정·seam). usage: python verify.py"""
import numpy as np
from PIL import Image
B = 'C:/claude/gunyoung/assets/battle/'
SPEC = [  # (경로, 폭, 높이, 'exact'|'max', 알파 필요)
 ('field/ground.png', 2048, 360, 'exact', None), ('field/mid.png', 2048, 260, 'exact', True), ('field/fog.png', 1024, 160, 'exact', True),
 ('field/tent.png', 256, 256, 'max', True), ('field/palisade.png', 256, 256, 'max', True), ('field/tree_dead.png', 256, 256, 'max', True),
 ('field/rock1.png', 256, 256, 'max', True), ('field/rock2.png', 256, 256, 'max', True),
 ('field/banner_g.png', 64, 192, 'exact', True), ('field/banner_b.png', 64, 192, 'exact', True), ('field/flag_g.png', 48, 72, 'exact', True), ('field/flag_b.png', 48, 72, 'exact', True),
 ('field/blood1.png', 128, 64, 'exact', True), ('field/blood2.png', 128, 64, 'exact', True), ('field/crater.png', 128, 64, 'exact', True),
 ('fx/slash_blue.png', 512, 256, 'exact', False), ('fx/slash_white.png', 256, 128, 'exact', False), ('fx/ring.png', 256, 256, 'exact', False), ('fx/spark.png', 64, 64, 'exact', False),
 ('fx/dust.png', 128, 128, 'exact', False), ('fx/speedlines.png', 1024, 512, 'exact', False), ('fx/impact.png', 128, 128, 'exact', False),
 ('hud/portrait_guanyu.png', 96, 120, 'exact', False), ('hud/portrait_zhangfei.png', 96, 120, 'exact', False), ('hud/portrait_xiahoudun.png', 96, 120, 'exact', False), ('hud/portrait_dianwei.png', 96, 120, 'exact', False),
 ('hud/portrait_frame.png', 112, 136, 'exact', True), ('hud/bar_frame.png', 320, 40, 'exact', True), ('hud/medallion.png', 160, 160, 'exact', True),
 ('hud/skill_guanyu.png', 64, 64, 'exact', False), ('hud/skill_zhangfei.png', 64, 64, 'exact', False)]
bad = 0
for rel, w, h, mode, alpha in SPEC:
    im = Image.open(B + rel); a = np.array(im); msg = []
    ok = (im.size == (w, h)) if mode == 'exact' else (im.width <= w and im.height <= h)
    if not ok: msg.append('SIZE %s' % (im.size,))
    has = im.mode == 'RGBA'
    if alpha is True and not has: msg.append('NO ALPHA')
    if alpha is True and has:
        al = a[..., 3]; 
        if al.min() > 0 or al.max() < 120: msg.append(   # 안개·패인 자국은 일부러 옅다(최대 0.74·0.78)
            'alpha range %d~%d' % (al.min(), al.max()))
    if rel.startswith('fx/'):
        if has: msg.append('fx has alpha')
        e = max(a[0].max(), a[-1].max(), a[:, 0].max(), a[:, -1].max()); e2 = max(a[2].max(), a[-3].max(), a[:, 2].max(), a[:, -3].max())
        if e > 0 or e2 > 12: msg.append(   # 맨 가장자리 행·열은 0, 2px 안쪽은 12 이하(0 으로 풀리는 중)
            'fx edge not black (edge %d, 2px in %d)' % (e, e2))
        extra = 'edge %d/%d peak %d' % (e, e2, a.max())
    elif has:
        al = a[..., 3].astype(np.float32); extra = 'alpha mean %.2f' % (al.mean() / 255)
        if rel in ('field/ground.png', 'field/mid.png', 'field/fog.png'):
            f = a.astype(np.float32); extra += ' seam %.2f vs neighbor %.2f' % (np.abs(f[:, 0] - f[:, -1]).mean(), np.abs(np.diff(f, axis=1)).mean())
        if rel in ('hud/portrait_frame.png', 'hud/bar_frame.png', 'hud/medallion.png'):
            extra += ' center alpha %d' % a[a.shape[0] // 2, a.shape[1] // 2, 3]
            if a[a.shape[0] // 2, a.shape[1] // 2, 3] != 0: msg.append('center not transparent')
    else: extra = im.mode
    bad += bool(msg)
    print('%-28s %-10s %-5s %s %s' % (rel, im.size, im.mode, extra, ('  <-- ' + '; '.join(msg)) if msg else 'ok'))
print('FAIL %d' % bad if bad else 'ALL OK (%d files)' % len(SPEC))
