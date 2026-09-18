#!/bin/bash
# 골격 2차: flat color/game sprite 를 빼고 명암 있는 그림체로. 보병으로 3종 × seed 2
G=/c/claude/gunyoung/assets/raw/battle2/units/gen.sh
UN="multiple boys, 2boys, multiple views, from behind, from front, facing viewer, gradient background, pattern background, weapon rack, scenery, 1girl, female, silhouette, faceless"
CORE="1boy, solo, full body, standing, from side, facing to the right, ancient chinese soldier, three kingdoms, green armor, green clothes, iron helmet, green plume, leather armor, holding sword, dao, holding shield, round wooden shield, boots, simple background, pink background"
for s in 11 12; do
  $G t2_chibi $s 832 1216 "chibi, $CORE" "$UN"
  $G t2_norm $s 832 1216 "$CORE, anime coloring, cel shading" "$UN, chibi"
  $G t2_sprite $s 832 1216 "chibi, $CORE, game sprite, cel shading, thick outline" "$UN"
done
echo DONE
