#!/bin/bash
# 컷인 하이레즈 — 고른 832×1216 을 Lanczos 1.5배(1248×1824)로 키운 hi/<key>_in.png 을 init 으로, 같은 프롬프트·같은 seed, img2img denoise 0.35.
#   장비·전위는 배경이 그라데이션/빛무리라 cutkey.py --comp 로 단색 배경에 다시 얹은 그림이 입력이다(k/<key>_rough_comp.png).
G=/c/claude/gunyoung/assets/raw/battle3/gen.sh
D=/c/claude/gunyoung/assets/raw/battle3
DEN="${1:-0.35}"
CN="multiple girls, 2girls, 1boy, male, horse, scenery, gradient background, pattern background, hat, helmet, bare shoulders only, swimsuit only, beach"
COMMON="cowboy shot, dynamic pose, looking at viewer, wind, floating hair, rim lighting, dramatic lighting, simple background"
CN3="multiple girls, 2girls, 1boy, male, horse, scenery, gradient background, pattern background, hat, helmet, crown, headdress, swimsuit only, beach, green background, red armor, blue armor, sword"
COMMON3="cowboy shot, dynamic pose, looking at viewer, wind, floating hair, rim lighting, dramatic lighting, simple background, magenta background, pink background"
GY="1girl, solo, mature female, tall female, adult, guan yu, (holding guandao:1.2), (glaive \(polearm\):1.2), large crescent blade, ornate blade, polearm, very long hair, black hair, straight hair, sharp eyes, narrowed eyes, green eyes, cold expression, elegant, beautiful, gold hair ornament, bikini armor, green armor, gold trim, green cape, pauldrons, gauntlets, faulds, cleavage, navel, midriff, $COMMON3"
ZF="1girl, solo, mature female, tall female, adult, zhang fei, black hair, messy hair, high ponytail, wild hair, red eyes, fierce grin, fang, confident, toned, abs, bikini armor, red armor, black armor, black gloves, pauldrons, gauntlets, armored boots, red waist cape, cleavage, navel, midriff, holding spear, serpent spear, long spear, polearm, $COMMON, green background"
XD="1girl, solo, mature female, tall female, adult, xiahou dun, eyepatch, black eyepatch, one eye covered, dark blue hair, short hair, blue eyes, cold expression, glaring, serious, bikini armor, blue armor, blue cape, pauldrons, gauntlets, faulds, thigh armor, cleavage, navel, midriff, holding sword, huge sword, dao, broadsword, $COMMON, pink background"
DW="1girl, solo, mature female, tall female, adult, muscular female, abs, toned, broad shoulders, dian wei, very short hair, black hair, tomboy, yellow eyes, stoic, expressionless, serious, bikini armor, black armor, dark armor, blue sash, blue waist cloth, pauldrons, gauntlets, thigh armor, cleavage, navel, midriff, dual wielding, holding axe, two short halberds, halberd, $COMMON, pink background"
$G hi_guanyu 69 1248 1824 "$GY" "$CN3" 5 28 "$D/hi/guanyu_in.png" $DEN
$G hi_guanyu64 64 1248 1824 "$GY" "$CN3" 5 28 "$D/hi/guanyu64_in.png" $DEN
$G hi_zhangfei 47 1248 1824 "$ZF" "$CN, pink background, green eyes, green armor" 5 28 "$D/hi/zhangfei_in.png" $DEN
$G hi_xiahoudun 41 1248 1824 "$XD" "$CN, red armor, green armor, pink clothes, long hair" 5 28 "$D/hi/xiahoudun_in.png" $DEN
$G hi_dianwei 44 1248 1824 "$DW" "$CN, red armor, green armor, pink clothes, long hair" 5 28 "$D/hi/dianwei_in.png" $DEN
echo HIRES_DONE
