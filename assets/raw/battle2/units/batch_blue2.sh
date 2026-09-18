#!/bin/bash
# 파랑 2차: 1차에서 장화·바지(inf attack, spear 둘 다)와 기병 갑옷·투구가 초록으로 남았다 → «모든 초록을 파랑으로, 초록이 남으면 안 된다» 를 부위까지 짚어서.
Q=/c/claude/gunyoung/assets/raw/battle2/units/qedit.sh; D=/c/claude/gunyoung/assets/raw/battle2/units/q
S=${SEED:-2}
TAIL="No green may remain anywhere in the image. Keep everything else exactly the same: same pose, same face, same weapons, same size and position, same plain magenta background."
declare -A P
P[inf_b_attack]="u2in_inf_g_attack|Recolor every green part to royal blue: the green robe, the green sleeves, the green trousers and the green boots all become royal blue."
P[spear_b_stand]="u2in_spear_g_stand|Recolor every green part to royal blue: the green scale armor, the green skirt, the green trousers and the green boots all become royal blue."
P[spear_b_attack]="u2in_spear_g_attack|Recolor every green part to royal blue: the green scale armor, the green skirt, the green trousers and the green boots all become royal blue."
P[cav_b_stand]="u2in_cav_g_stand2|Recolor every green part to royal blue: the rider's green helmet, the rider's green armor, green sleeves, green trousers and green boots, and the green saddle cloth all become royal blue. The horse stays brown and the plume stays golden."
P[cav_b_attack]="u2in_cav_g_attack|Recolor every green part to royal blue: the rider's green helmet, the rider's green armor, green sleeves, green trousers and green boots, and the green saddle cloth all become royal blue. The horse stays brown and the plume stays golden."
for k in ${KINDS:-inf_b_attack spear_b_stand spear_b_attack cav_b_stand cav_b_attack}; do
  IFS='|' read -r IN PR <<< "${P[$k]}"
  $Q "$D/$IN.png" "$D/${k}_s$S.png" $S "$PR $TAIL"
done
