#!/bin/bash
# stand 4차: bow(3차 s23 은 활이 머리 위로 몸 높이의 절반만큼 솟아 128x160 에 몸 130px 로 못 넣는다 → short bow) · cav(창이 말보다 길어 폭 128 에 몸 117px → 짧게·세워 들게)
G=/c/claude/gunyoung/assets/raw/battle2/units/gen.sh
UN="multiple boys, 2boys, multiple views, from behind, from front, facing viewer, gradient background, pattern background, weapon rack, scenery, 1girl, female, silhouette, faceless, shadow, border, frame, plume, aura, fire, magic, debris"
HEAD="chibi, 1boy, solo, full body, standing, from side, facing to the right"
declare -A K
K[bow]="ancient chinese archer, three kingdoms, green clothes, green tunic, green headband, light clothes, holding bow (weapon), short bow, small bow, drawing bow, aiming, arrow (projectile), quiver, boots"
K[cav]="ancient chinese cavalry, three kingdoms, riding horse, horseback riding, brown horse, green armor, green clothes, iron helmet, holding spear, short spear, spear pointing up, boots"
for s in ${SEEDS:-27 28 29 30 31 32}; do
  for k in ${KINDS:-bow cav}; do
    W=832; H=1216; [ "$k" = cav ] && W=1024 && H=1024
    UNX="$UN"; [ "$k" = bow ] && UNX="$UN, longbow, huge weapon, tall, slender"
    $G "s4_$k" $s $W $H "$HEAD, ${K[$k]}, simple background, blue background" "$UNX"
  done
done
echo DONE
