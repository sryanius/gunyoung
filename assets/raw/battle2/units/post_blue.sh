#!/bin/bash
# 파랑 병사: 편집 결과 → 키잉 → 초록과 같은 변환(--same) 으로 128x160. --degreen 으로 남은 초록을 파랑으로.
cd /c/claude/gunyoung/assets/raw/battle2/units; export PYTHONIOENCODING=utf-8
PY="/c/pinokio/api/inteliweb-comfyui/app/env/Scripts/python.exe"; U="$PY u2post.py"
# 전부 --same: 초록 그림의 bbox 자리·크기에 맞춘다(Qwen 색 바꾸기가 그림을 2~3% 키운다).
$U unflat q/inf_b_stand_s1.png m/inf_b_stand.png out/inf_b_stand.png --same=out/inf_g_stand.json --degreen
$U unflat q/spear_b_stand_s2.png m/spear_b_stand.png out/spear_b_stand.png --same=out/spear_g_stand.json --degreen
$U unflat q/inf_b_attack_s2.png m/inf_b_attack.png out/inf_b_attack.png --same=out/inf_g_attack.json --degreen
$U unflat q/spear_b_attack_s2.png m/spear_b_attack.png out/spear_b_attack.png --same=out/spear_g_attack.json --degreen
$U unflat q/bow_b_stand_s1.png m/bow_b_stand.png out/bow_b_stand.png --same=out/bow_g_stand.json --degreen
$U unflat q/bow_b_attack_s1.png m/bow_b_attack.png out/bow_b_attack.png --same=out/bow_g_attack.json --degreen
$U unflat q/cav_b_stand_s4.png m/cav_b_stand.png out/cav_b_stand.png --same=out/cav_g_stand.json --degreen
$U unflat q/cav_b_attack_s2.png m/cav_b_attack.png out/cav_b_attack.png --same=out/cav_g_attack.json --degreen
