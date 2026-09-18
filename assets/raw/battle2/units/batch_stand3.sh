#!/bin/bash
# stand 3차(병사): 2차의 «big head, short legs» 는 2등신 투구 덩어리 → «chibi» 만(1차에서 3등신 안팎) + plume 제거 유지.
G=/c/claude/gunyoung/assets/raw/battle2/units/gen.sh
UN="multiple boys, 2boys, multiple views, from behind, from front, facing viewer, gradient background, pattern background, weapon rack, scenery, 1girl, female, silhouette, faceless, shadow, border, frame, plume, aura, fire, magic, debris"
HEAD="chibi, 1boy, solo, full body, standing, from side, facing to the right"
declare -A K
K[inf]="ancient chinese soldier, three kingdoms, green armor, green clothes, green tunic, iron helmet, leather armor, holding sword, dao, holding shield, round wooden shield, boots"
K[spear]="ancient chinese soldier, three kingdoms, green scale armor, scale armor, green clothes, green tunic, iron helmet, holding spear, long spear, polearm, boots"
K[bow]="ancient chinese archer, three kingdoms, green clothes, green tunic, green headband, light clothes, holding bow (weapon), drawing bow, aiming, arrow (projectile), quiver, boots"
K[cav]="ancient chinese cavalry, three kingdoms, riding horse, horseback riding, brown horse, green armor, green clothes, iron helmet, holding spear, boots"
for s in ${SEEDS:-21 22 23 24 25 26}; do
  for k in ${KINDS:-inf spear bow cav}; do
    W=832; H=1216; [ "$k" = cav ] && W=1024 && H=1024
    $G "s3_$k" $s $W $H "$HEAD, ${K[$k]}, simple background, blue background" "$UN"
  done
done
echo DONE
