#!/bin/bash
# 병사 6종 — 프롬프트 골격·seed 통일, 무기/탈것 태그만 바꾼다. 초록 배경 키잉.
G=/c/claude/gunyoung/assets/raw/battle/gen.sh
BASE="1boy, solo, full body, standing, from side, profile, facing to the right, ancient chinese soldier, grey armor, white clothes, grey clothes, leather armor, chibi, game sprite, flat color, simple background, green background, no shadow"
UN="multiple boys, 2boys, multiple views, from behind, from front, facing viewer, text, shadow, gradient background, pattern background, weapon rack, scenery"
declare -A K
K[inf]="holding sword, sword, holding shield, round shield"
K[spear]="holding spear, long spear, polearm"
K[bow]="holding bow (weapon), bow (weapon), drawing bow, quiver, arrow"
K[cav]="riding horse, horseback riding, horse, holding spear, cavalry"
K[general_left]="general, ornate armor, helmet, plume, flowing cape, cape, holding polearm, guandao, big silhouette"
K[general_right]="general, ornate armor, horned helmet, cape, holding sword, sword raised"
for s in 7 8; do
  for k in inf spear bow cav general_left general_right; do
    W=832; H=1216; [ "$k" = cav ] && W=1024 && H=1024
    $G "u_$k" $s $W $H "${K[$k]}, $BASE" "$UN"
  done
done
echo UNITS_DONE
