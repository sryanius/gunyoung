#!/bin/bash
# 컷인 — 관우(초록 옷 → 분홍 배경), 장비(붉은 옷 → 초록 배경). 상반신, 힘있는 포즈.
G=/c/claude/gunyoung/assets/raw/battle/gen.sh
CN="multiple boys, 2boys, horse, scenery, gradient background, pattern background, text, chibi, cute, female, 1girl, hat"
GY="1boy, solo, mature male, guan yu, long beard, black beard, long hair, green robe, green hanfu, green headband, ancient chinese armor, holding polearm, guandao, green dragon crescent blade, upper body, dynamic pose, fierce, serious, looking at viewer, wind, dramatic, simple background, pink background, flat color background"
ZF="1boy, solo, mature male, zhang fei, muscular, black beard, bushy beard, wild hair, angry, shouting, open mouth, red robe, red armor, ancient chinese armor, holding polearm, serpent spear, upper body, dynamic pose, looking at viewer, dramatic, simple background, green background, flat color background"
for s in 11 12 13; do $G cut_guanyu $s 832 1216 "$GY" "$CN"; $G cut_zhangfei $s 832 1216 "$ZF" "$CN"; done
echo CUTIN_DONE
