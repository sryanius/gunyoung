#!/bin/bash
# 골격 고르기: 보병으로 비율 3종(치비 / 치비 약 / 없음) × seed 2
G=/c/claude/gunyoung/assets/raw/battle2/units/gen.sh
UN="multiple boys, 2boys, multiple views, from behind, from front, facing viewer, shadow, gradient background, pattern background, weapon rack, scenery, 1girl, female"
TAIL="1boy, solo, full body, standing, from side, profile, facing to the right, ancient chinese soldier, three kingdoms, green armor, green clothes, green headband, leather armor, holding sword, dao, holding shield, round shield, game sprite, side view, simple background, pink background, flat color background, no shadow"
for s in 11 12; do
  $G t1_chibi $s 832 1216 "chibi, big head, short legs, $TAIL" "$UN, realistic proportions, tall, slender"
  $G t1_sd $s 832 1216 "chibi, $TAIL" "$UN"
  $G t1_norm $s 832 1216 "$TAIL" "$UN, chibi"
done
echo DONE
