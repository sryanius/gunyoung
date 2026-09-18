#!/bin/bash
# 컷인 3차 후보 — 관우만: 1차(41~48)는 언월도 날이 안 보이거나(45 금빛 자루만) 관이 이상(43·44). 무기 태그를 앞세우고 배경은 magenta 로.
# (2차의 `flat color background` 는 그림체 자체를 납작한 셀화로 바꿔 버려 폐기 — 1차 골격으로 돌아간다)
G=/c/claude/gunyoung/assets/raw/battle3/gen.sh
CN="multiple girls, 2girls, 1boy, male, horse, scenery, gradient background, pattern background, hat, helmet, crown, headdress, swimsuit only, beach, green background, red armor, blue armor, sword"
COMMON="cowboy shot, dynamic pose, looking at viewer, wind, floating hair, rim lighting, dramatic lighting, simple background, magenta background, pink background"
GY="1girl, solo, mature female, tall female, adult, guan yu, (holding guandao:1.2), (glaive \(polearm\):1.2), large crescent blade, ornate blade, polearm, very long hair, black hair, straight hair, sharp eyes, narrowed eyes, green eyes, cold expression, elegant, beautiful, gold hair ornament, bikini armor, green armor, gold trim, green cape, pauldrons, gauntlets, faulds, cleavage, navel, midriff, $COMMON"
for s in 61 62 63 64 65 66 67 68 69 70; do $G cut_guanyu $s 832 1216 "$GY" "$CN"; done
echo CUTIN3_DONE
