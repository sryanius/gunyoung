#!/bin/bash
# stand 2차: 1차에서 「green plume」 이 거대한 초록 불꽃 깃으로, 무장은 chibi 가 안 먹고 8등신으로 나왔다.
#   → 병사는 plume 빼고, 무장은 «chibi, big head, short legs» 를 앞세우고 mature male/muscular 를 빼고 부정에 realistic proportions.
G=/c/claude/gunyoung/assets/raw/battle2/units/gen.sh
UN="multiple boys, 2boys, multiple views, from behind, from front, facing viewer, gradient background, pattern background, weapon rack, scenery, 1girl, female, silhouette, faceless, shadow, border, frame, realistic proportions, tall, slender, plume, aura, fire, magic"
HEAD="chibi, big head, short legs, 1boy, solo, full body, standing, from side, facing to the right"
declare -A K BGC
K[inf]="ancient chinese soldier, three kingdoms, green armor, green clothes, green tunic, iron helmet, leather armor, holding sword, dao, holding shield, round wooden shield, boots"
K[spear]="ancient chinese soldier, three kingdoms, green scale armor, scale armor, green clothes, green tunic, iron helmet, holding spear, long spear, polearm, boots"
K[bow]="ancient chinese archer, three kingdoms, green clothes, green tunic, green headband, light clothes, holding bow (weapon), arrow (projectile), quiver, boots"
K[cav]="ancient chinese cavalry, three kingdoms, riding horse, horseback riding, brown horse, green armor, green clothes, iron helmet, holding spear, boots"
K[gen_guanyu]="guan yu, three kingdoms, very long beard, black beard, long hair, green robe, green hanfu, green hat, gold trim, holding polearm, guandao, crescent blade, boots"
K[gen_zhangfei]="zhang fei, three kingdoms, bushy beard, black beard, wild hair, angry, red armor, black clothes, ancient chinese armor, holding polearm, serpent spear, long spear, boots"
K[gen_xiahoudun]="xiahou dun, three kingdoms, eyepatch, short beard, black hair, blue armor, blue cape, ancient chinese armor, helmet, holding sword, huge sword, broadsword, dao, boots"
K[gen_dianwei]="dian wei, three kingdoms, bald, stubble, thick eyebrows, bulky, broad shoulders, dark armor, black armor, blue sash, blue waist cloth, dual wielding, holding axe, battle axe, boots"
BGC[inf]=blue; BGC[spear]=blue; BGC[bow]=blue; BGC[cav]=blue; BGC[gen_guanyu]=blue; BGC[gen_zhangfei]=blue; BGC[gen_xiahoudun]=green; BGC[gen_dianwei]=green
for s in ${SEEDS:-24 25 26 27}; do
  for k in ${KINDS:-inf spear bow cav gen_guanyu gen_zhangfei gen_xiahoudun gen_dianwei}; do
    W=832; H=1216; [ "$k" = cav ] && W=1024 && H=1024
    $G "st_$k" $s $W $H "$HEAD, ${K[$k]}, simple background, ${BGC[$k]} background" "$UN"
  done
done
echo DONE
