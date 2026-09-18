#!/bin/bash
# stand 1차: 병사 4 + 무장 4, 같은 골격(chibi + 명암 그림체) × seed 21~23. 배경은 옷과 안 겹치는 색(초록 유닛·장비 = 파랑, 푸른 갑옷 = 초록).
G=/c/claude/gunyoung/assets/raw/battle2/units/gen.sh
UN="multiple boys, 2boys, multiple views, from behind, from front, facing viewer, gradient background, pattern background, weapon rack, scenery, 1girl, female, silhouette, faceless, shadow"
HEAD="chibi, 1boy, solo, full body, standing, from side, facing to the right"
declare -A K BGC
K[inf]="ancient chinese soldier, three kingdoms, green armor, green clothes, iron helmet, green plume, leather armor, holding sword, dao, holding shield, round wooden shield, boots"
K[spear]="ancient chinese soldier, three kingdoms, green scale armor, scale armor, green clothes, iron helmet, green plume, holding spear, long spear, polearm, boots"
K[bow]="ancient chinese archer, three kingdoms, green clothes, green tunic, green headband, light clothes, holding bow (weapon), drawing bow, aiming, arrow (projectile), quiver, boots"
K[cav]="ancient chinese cavalry, three kingdoms, riding horse, horseback riding, brown horse, green armor, green clothes, iron helmet, green plume, holding spear, boots"
K[gen_guanyu]="guan yu, three kingdoms, mature male, very long beard, black beard, long hair, green robe, green hanfu, green hat, gold trim, holding polearm, guandao, crescent blade, boots"
K[gen_zhangfei]="zhang fei, three kingdoms, mature male, muscular, bushy beard, black beard, wild hair, angry, red armor, black clothes, ancient chinese armor, holding polearm, serpent spear, long spear, boots"
K[gen_xiahoudun]="xiahou dun, three kingdoms, mature male, eyepatch, short beard, black hair, blue armor, blue cape, ancient chinese armor, helmet, holding sword, huge sword, broadsword, dao, boots"
K[gen_dianwei]="dian wei, three kingdoms, mature male, muscular, bulky, broad shoulders, stubble, black hair, dark armor, black armor, blue sash, blue waist cloth, dual wielding, holding axe, halberd, boots"
BGC[inf]=blue; BGC[spear]=blue; BGC[bow]=blue; BGC[cav]=blue; BGC[gen_guanyu]=blue; BGC[gen_zhangfei]=blue; BGC[gen_xiahoudun]=green; BGC[gen_dianwei]=green
for s in ${SEEDS:-21 22 23}; do
  for k in ${KINDS:-inf spear bow cav gen_guanyu gen_zhangfei gen_xiahoudun gen_dianwei}; do
    W=832; H=1216; [ "$k" = cav ] && W=1024 && H=1024
    $G "st_$k" $s $W $H "$HEAD, ${K[$k]}, simple background, ${BGC[$k]} background" "$UN"
  done
done
echo DONE
