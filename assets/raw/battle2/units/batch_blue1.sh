#!/bin/bash
# 파랑 편: 초록 그림(자홍 배경 383x448)에서 색만 바꾼다. attack 도 초록 attack 에서.
Q=/c/claude/gunyoung/assets/raw/battle2/units/qedit.sh; D=/c/claude/gunyoung/assets/raw/battle2/units/q
S=${SEED:-1}
TAIL="Keep everything else exactly the same: same pose, same face, same weapons, same size and position, same plain magenta background."
declare -A P
P[inf_b_stand]="u2in_inf_g_stand|Change the green armor and cloth to royal blue."
P[inf_b_attack]="u2in_inf_g_attack|Change the green armor and cloth to royal blue."
P[spear_b_stand]="u2in_spear_g_stand|Change the green scale armor and green cloth to royal blue."
P[spear_b_attack]="u2in_spear_g_attack|Change the green scale armor and green cloth to royal blue."
P[bow_b_stand]="u2in_bow_g_stand|Change the green tunic and the green headscarf to royal blue."
P[bow_b_attack]="u2in_bow_g_attack2|Change the green tunic and the green headscarf to royal blue."
P[cav_b_stand]="u2in_cav_g_stand2|Change the rider's green armor, green helmet and the green saddle cloth to royal blue. Keep the brown horse and the golden plume."
P[cav_b_attack]="u2in_cav_g_attack|Change the rider's green armor, green helmet and the green saddle cloth to royal blue. Keep the brown horse and the golden plume."
for k in ${KINDS:-inf_b_stand inf_b_attack spear_b_stand spear_b_attack bow_b_stand bow_b_attack cav_b_stand cav_b_attack}; do
  IFS='|' read -r IN PR <<< "${P[$k]}"
  $Q "$D/$IN.png" "$D/${k}_s$S.png" $S "$PR $TAIL"
done
