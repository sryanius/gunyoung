#!/bin/bash
# 컷인 최종 키잉(1248×1824) → k/<key>_key.png → fade3.py 가 가장자리 페이드해서 assets/battle/cutin/<key>.png
D=/c/claude/gunyoung/assets/raw/battle3; PY="/c/pinokio/api/inteliweb-comfyui/app/env/Scripts/python.exe"; cd $D
M="--hue=300,350 --smin=0.5 --vmin=0.5 --thr=60 --ramp=40 --sigma=45 --despeckle=1400 --interior=200 --fillnear=60 --despill=24"
"$PY" cutkey.py cand/hi_guanyu_s69.png    k/guanyu_key.png    $M --despillgain=0.5
"$PY" cutkey.py cand/hi_xiahoudun_s41.png k/xiahoudun_key.png $M --flip          # 안대가 인물의 오른눈에 그려져 거울로 뒤집어 왼눈으로(남성판과 같은 처리)
# 전위 디자인엔 마젠타가 없다 → 머리카락 상자 안은 전부 탈색(--despillbox; 전체에 걸면 살 윤곽선의 붉은 기가 점선으로 죽는다). 머리카락 속 분홍 림 하이라이트가 마젠타 얼룩으로 남았었다
"$PY" cutkey.py cand/hi_dianwei_s44.png   k/dianwei_key.png   $M --despillbox=640,120,960,420 --despillgain=0.45 --despillsmin=0.12
"$PY" cutkey.py cand/hi_zhangfei_s47.png  k/zhangfei_key.png  --hue=165,190 --solidhi=8 --smin=0.45 --vmin=0.3 --thr=50 --ramp=40 --sigma=45 --despeckle=1400 --interior=200 --fillnear=60
for k in guanyu zhangfei xiahoudun dianwei; do "$PY" check_cutin.py k/${k}_key.png; done
"$PY" fade3.py
