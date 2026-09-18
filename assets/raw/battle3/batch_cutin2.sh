#!/bin/bash
# 컷인 2차 후보(flat color background 추가 — 1차는 배경이 그라데이션·빛무리라 키잉 불가가 많았다) — 여성 무장 4명 × seed 41~48 (832×1216). 배경: 관우·하후돈·전위 = 분홍/마젠타, 장비(붉은 갑옷) = 초록.
G=/c/claude/gunyoung/assets/raw/battle3/gen.sh
CN="multiple girls, 2girls, 1boy, male, horse, scenery, gradient background, pattern background, two-tone background, glowing, light particles, vignetting, white background, hat, helmet, bare shoulders only, swimsuit only, beach"
COMMON="cowboy shot, dynamic pose, looking at viewer, wind, floating hair, rim lighting, dramatic lighting, simple background, flat color background"
GY="1girl, solo, mature female, tall female, adult, guan yu, very long hair, black hair, straight hair, sharp eyes, narrowed eyes, green eyes, cold expression, elegant, beautiful, bikini armor, green armor, gold trim, green cape, green robe on shoulders, pauldrons, gauntlets, faulds, cleavage, navel, midriff, holding polearm, guandao, crescent blade, green dragon ornament, $COMMON, pink background, magenta background"
ZF="1girl, solo, mature female, tall female, adult, zhang fei, black hair, messy hair, high ponytail, wild hair, red eyes, fierce grin, fang, confident, toned, abs, bikini armor, red armor, black armor, black gloves, pauldrons, gauntlets, armored boots, red waist cape, cleavage, navel, midriff, holding spear, serpent spear, long spear, polearm, $COMMON, green background"
XD="1girl, solo, mature female, tall female, adult, xiahou dun, eyepatch, black eyepatch, one eye covered, dark blue hair, short hair, blue eyes, cold expression, glaring, serious, bikini armor, blue armor, blue cape, pauldrons, gauntlets, faulds, thigh armor, cleavage, navel, midriff, holding sword, huge sword, dao, broadsword, $COMMON, pink background, magenta background"
DW="1girl, solo, mature female, tall female, adult, muscular female, abs, toned, broad shoulders, dian wei, very short hair, black hair, tomboy, yellow eyes, stoic, expressionless, serious, bikini armor, black armor, dark armor, blue sash, blue waist cloth, pauldrons, gauntlets, thigh armor, cleavage, navel, midriff, dual wielding, holding axe, two short halberds, halberd, $COMMON, pink background, magenta background"
for s in 51 52 53 54 55 56 57 58; do
  $G cut_guanyu $s 832 1216 "$GY" "$CN, green background, red armor, blue armor"
  $G cut_zhangfei $s 832 1216 "$ZF" "$CN, pink background, green eyes, green armor"
  $G cut_xiahoudun $s 832 1216 "$XD" "$CN, red armor, green armor, pink clothes, long hair"
  $G cut_dianwei $s 832 1216 "$DW" "$CN, red armor, green armor, pink clothes, long hair"
done
echo CUTIN2_DONE
