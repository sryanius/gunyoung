#!/bin/bash
# 컷인 2차 — 하후돈(푸른 갑옷 → 분홍 배경), 전위(어두운 갑옷+푸른 띠 → 분홍 배경). batch_cutin.sh 와 같은 골격·부정.
G=/c/claude/gunyoung/assets/raw/battle/gen.sh
CN="multiple boys, 2boys, horse, scenery, gradient background, pattern background, text, chibi, cute, female, 1girl, hat, red armor, green armor, pink clothes"
XD="1boy, solo, mature male, xiahou dun, eyepatch, eyepatch over left eye, one eye covered, black beard, short beard, black hair, blue armor, blue robe, blue cape, ancient chinese armor, holding sword, huge weapon, large sword, curved sword, dao, upper body, dynamic pose, fierce, serious, glaring, looking at viewer, wind, dramatic, simple background, pink background, flat color background"
DW="1boy, solo, mature male, dian wei, muscular, bulky, broad shoulders, large pectorals, short beard, stubble, black hair, dark armor, black armor, blue sash, blue cloth, ancient chinese armor, dual wielding, two short halberds, halberd, polearm, upper body, dynamic pose, angry, fierce, shouting, looking at viewer, dramatic, simple background, pink background, flat color background"
for s in 21 22 23 24; do $G cut_xiahoudun $s 832 1216 "$XD" "$CN"; $G cut_dianwei $s 832 1216 "$DW" "$CN"; done
echo CUTIN2_DONE
