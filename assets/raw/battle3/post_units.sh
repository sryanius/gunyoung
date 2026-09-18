#!/bin/bash
# 전장 SD 무장(여성) 8장 후처리 전체(재현용): Qwen 결과(units/q) → 마스터(units/m) → 128×160(units/out) → assets/battle/units2/
# 앞 단계: batch_units1.sh(SDXL seed 71~78) → units/padflip.py --flip(네 장 모두 왼쪽 보기) → batch_qstand.sh 1 (+ 관우는 stand3 지시문, NOTES) → 여기 stand 부분 → flat → batch_qattack.sh / batch_qattack2.sh
cd /c/claude/gunyoung/assets/raw/battle3/units; export PYTHONIOENCODING=utf-8
PY="/c/pinokio/api/inteliweb-comfyui/app/env/Scripts/python.exe"; U="$PY ../../battle2/units/u2post.py"; F="$PY ../../battle2/units/u2fix.py"
mkdir -p m out
# stand: Qwen 이 고친 944×1104(청록/파랑/민트 배경) → 테두리 링 배경색 키잉. 관우만 thr 22(은빛 날 (190,195,200) 이 청록 배경 (135,202,196) 과 거리 55 라 thr 40 이면 날이 반투명해진다)
$U key q/gen_guanyu_stand3_s1.png  m/gen_guanyu_stand.png    --thr=22 --ramp=18
$U key q/gen_zhangfei_stand_s1.png m/gen_zhangfei_stand.png  --thr=40 --ramp=30
$U key q/gen_xiahoudun_stand_s1.png m/gen_xiahoudun_stand.png --thr=40 --ramp=30
$U key q/gen_dianwei_stand_s1.png  m/gen_dianwei_stand.png   --thr=40 --ramp=30
for k in guanyu zhangfei xiahoudun dianwei; do $U fit m/gen_${k}_stand.png out/gen_${k}_stand.png --h=146; done
# Qwen attack 입력(자홍 383×448): for k in ...; do $U flat m/gen_${k}_stand.png q/u2in_gen_${k}_stand.png --h=146; done   (관우 flat 은 thr 40 마스터로 만들었다 — 배치 차이 0.0002배)
# attack: 배치 유지(unflat 기본)
$U unflat q/gen_guanyu_attack_s2.png    m/gen_guanyu_attack.png    out/gen_guanyu_attack.png
$U unflat q/gen_zhangfei_attack_s1.png  m/gen_zhangfei_attack.png  out/gen_zhangfei_attack.png
$U unflat q/gen_xiahoudun_attack_s3.png m/gen_xiahoudun_attack.png out/gen_xiahoudun_attack.png
$U unflat q/gen_dianwei_attack_s3.png   m/gen_dianwei_attack.png   out/gen_dianwei_attack.png
$F clean out/gen_*.png
$F measure out/gen_*.png
cp out/gen_{guanyu,zhangfei,xiahoudun,dianwei}_{stand,attack}.png ../../../battle/units2/
$U sheet ../units_sheet.png 4 out/gen_guanyu_stand.png out/gen_zhangfei_stand.png out/gen_xiahoudun_stand.png out/gen_dianwei_stand.png out/gen_guanyu_attack.png out/gen_zhangfei_attack.png out/gen_xiahoudun_attack.png out/gen_dianwei_attack.png --scale=3
