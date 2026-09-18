#!/bin/bash
# 수정 회차(검수 지적): bow 가 사실 비율이라 치비 골격으로 재생성, general_left 는 망토가 어두워 tint 가 약해 회백 망토로 재생성.
# 골격·부정은 batch_units.sh 와 같고, 앞머리에 `chibi, big head` 를 두어 골격을 다른 병종(치비)에 맞춘다.
G=/c/claude/gunyoung/assets/raw/battle/gen.sh
BASE="1boy, solo, full body, standing, from side, profile, facing to the right, ancient chinese soldier, grey armor, white clothes, grey clothes, leather armor, chibi, game sprite, flat color, simple background, green background, no shadow"
UN="multiple boys, 2boys, multiple views, from behind, from front, facing viewer, text, shadow, gradient background, pattern background, weapon rack, scenery"
for s in 7 8 9 10; do
  $G u_bowc $s 832 1216 "chibi, big head, short legs, holding bow (weapon), bow (weapon), drawing bow, quiver, arrow, $BASE" "$UN, realistic proportions, tall, slender"
done
for s in 7 8 9 10; do
  $G u_glc $s 832 1216 "chibi, big head, general, commander, ornate grey armor, helmet, red plume, grey cape, white cape, holding polearm, guandao, $BASE" "$UN, ghost, hood, ribbon, smoke, red cape, blue cape, dark cape, black cape, teal"
done
echo FIX3_DONE
