#!/bin/bash
# 초록 병사 + 무장: 키잉·정렬 전체(재현용). SDXL 원본/편집 결과 → m/(마스터) → out/(128x160)
cd /c/claude/gunyoung/assets/raw/battle2/units; export PYTHONIOENCODING=utf-8
PY="/c/pinokio/api/inteliweb-comfyui/app/env/Scripts/python.exe"; U="$PY u2post.py"
mkdir -p m out
# SDXL stand → 마스터(왼쪽 보기는 --flip) → 128x160
$U key s3_inf_s27.png m/inf_g_stand.png --thr=40 --ramp=30 --flip
$U key s3_spear_s25.png m/spear_g_stand.png --thr=40 --ramp=30 --flip
$U key st_gen_guanyu_s25.png m/gen_guanyu_stand.png --thr=40 --ramp=30 --flip
$U key st_gen_dianwei_s26.png m/gen_dianwei_stand.png --thr=25 --ramp=25 --flip
$U fit m/inf_g_stand.png out/inf_g_stand.png --h=130
$U fit m/spear_g_stand.png out/spear_g_stand.png --h=130
$U fit m/gen_guanyu_stand.png out/gen_guanyu_stand.png --h=146
$U fit m/gen_dianwei_stand.png out/gen_dianwei_stand.png --h=146
# Qwen 으로 고친 stand(활 줄이기·창 줄이기·뿔 떼기·대도) → 다시 재서 맞춤
$U unflat q/bow_fix_s1.png m/bow_g_attack.png out/bow_g_attack.png --refit --h=130
$U unflat q/cav_fix_s1.png m/cav_g_stand.png out/cav_g_stand.png --refit --h=150
$U unflat q/zhangfei_fix_s1.png m/gen_zhangfei_stand.png out/gen_zhangfei_stand.png --refit --h=146
# [수정 회차] 하후돈 stand 를 새 그림으로 교체: 옛 st_gen_xiahoudun_s28(→ q/xiahoudun_fix_s1)은 **왼쪽 보기 3/4** 였는데 칼 방향만 보고 오른쪽 보기로 오판해 flip 을 안 했다
#   (attack 은 오른쪽 보기라 교체 때마다 방향이 뒤집혔다). 새 원본 fx_gen_xiahoudun_s34 는 옆모습 왼쪽 보기 → --flip. 배경 민트가 바지 그늘(132,152,179)과 거리 56 → thr 25.
$U key fx_gen_xiahoudun_s34.png m/gen_xiahoudun_stand.png --thr=25 --ramp=20 --flip
$PY u2fix.py fillholes m/gen_xiahoudun_stand.png
$U fit m/gen_xiahoudun_stand.png out/gen_xiahoudun_stand.png --h=146
# attack(bow 는 stand) — 배치 유지
$U unflat q/inf_g_attack_s1.png m/inf_g_attack.png out/inf_g_attack.png
$U unflat q/spear_g_attack_s1.png m/spear_g_attack.png out/spear_g_attack.png
$U unflat q/bow_g_stand_s2.png m/bow_g_stand.png out/bow_g_stand.png
$U unflat q/cav_g_attack_s1.png m/cav_g_attack.png out/cav_g_attack.png --dx=5   # 편집이 말을 8px 뒤로 밀었다 → 오른쪽 여유(5px)만큼 되돌림
for g in guanyu zhangfei dianwei; do $U unflat q/gen_${g}_attack_s1.png m/gen_${g}_attack.png out/gen_${g}_attack.png; done
# [수정 회차] 하후돈 attack: 새 stand(q/u2in_gen_xiahoudun2_stand.png = `u2post.py flat m/gen_xiahoudun_stand.png … --h=146`)에서 Qwen s1. (옛 그림은 q/gen_xiahoudun_attack_s3.png)
$U unflat q/gen_xiahoudun2_attack_s1.png m/gen_xiahoudun_attack.png out/gen_xiahoudun_attack.png
# → 이어서 post_blue.sh → post_fix.sh (수정 회차 후처리: 자홍 잔여·조각·시위·궁병 상체색·파랑 기병 attack·관우 머리 점·전위 허벅지)
