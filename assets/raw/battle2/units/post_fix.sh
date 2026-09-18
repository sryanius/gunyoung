#!/bin/bash
# 수정 회차 후처리 — post_green.sh → post_blue.sh 뒤에 돌린다. out/*.png (128x160) 위에서 검수 지적만 고친다.
cd /c/claude/gunyoung/assets/raw/battle2/units; export PYTHONIOENCODING=utf-8
PY="/c/pinokio/api/inteliweb-comfyui/app/env/Scripts/python.exe"; F="$PY u2fix.py"
# 1) 파랑 기병 attack: Qwen 색 바꾸기(q/cav_b_attack_s2)가 안장 덮개 금 자수를 지웠다 → 초록 attack 을 색상 이동만 해서 다시 만든다(무늬·자리 그대로)
$F cavblue out/cav_g_attack.png out/cav_b_attack.png
# 2) 궁병 attack: 상체가 stand(연두)보다 짙은 청록 + stand 에 없는 청록 속자락 → stand 색에 맞춘다(교체 때 상체 색 깜빡임). 파랑 편은 둘 다 로열블루라 그대로
$F bowtunic out/bow_g_attack.png out/bow_g_attack.png
# 3) 궁병 stand(g·b): 몸 위에만 남은 시위 띠를 활 양 끝까지 잇는다
$F bowstring out/bow_g_stand.png out/bow_b_stand.png
# 4) 관우 머리카락 속 초록 점, 하후돈(새 그림) 머리카락 속 청록 반짝이 점(배경 민트와 같은 색이라 키잉 잔여로 읽힌다)
$F hairdots out/gen_guanyu_stand.png out/gen_guanyu_attack.png
$F hairdots out/gen_xiahoudun_stand.png out/gen_xiahoudun_attack.png --hue=170,215 --s=0.18 --v=0.45 --ringv=0.4 --max=14
#    하후돈 stand(SDXL 직접 키잉, 배경 민트 115,205,178): 칼·허리 틈새로 비친 배경 2~3px
$F debg out/gen_xiahoudun_stand.png --bg=115,205,178 --d=38
# 5) 전위 attack 허벅지의 살색 조각
$F dwthigh out/gen_dianwei_attack.png
# 6) 자홍 잔여 + 떨어진 조각(24장 전부 — 해당 없는 파일은 다시 쓰지 않는다)
$F clean out/*.png
$F measure out/*.png
