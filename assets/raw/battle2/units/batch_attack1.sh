#!/bin/bash
# attack 1차: stand(자홍 단색 배경 383x448) → Qwen 지시 편집. bow 는 거꾸로(SDXL 이 당긴 자세라 attack → stand).
Q=/c/claude/gunyoung/assets/raw/battle2/units/qedit.sh; D=/c/claude/gunyoung/assets/raw/battle2/units/q
KEEP="Keep the outfit, colors and style exactly the same. Keep the same character size and position, feet on the same spot. Keep the plain magenta background."
S=${SEED:-1}
declare -A P
P[inf_g_attack]="u2in_inf_g_stand|Make him swing the sword forward in an attack pose, slashing toward the right with the sword extended in front of him, shield still on his back."
P[spear_g_attack]="u2in_spear_g_stand|Make him thrust the spear forward to the right in an attack pose, lunging with both hands on the spear, the spear held level and pointing to the right."
P[bow_g_stand]="u2in_bow_g_attack|Make him stand relaxed and lower the bow: he holds the short bow in his front hand down at his side, the other arm hanging down, not aiming, looking to the right."
P[cav_g_attack]="u2in_cav_g_stand|Make the rider stab with the spear in an attack pose: he raises the spear overhead and thrusts it forward and downward to the right, the spear tip pointing toward the front of the horse. Keep the horse the same."
P[gen_guanyu_attack]="u2in_gen_guanyu_stand|Make him swing the crescent blade polearm forward in a powerful slashing attack pose toward the right, the golden blade in front of him."
P[gen_zhangfei_attack]="u2in_gen_zhangfei_stand|Make him thrust the spear forward to the right in a fierce attack pose, shouting with his mouth open."
P[gen_xiahoudun_attack]="u2in_gen_xiahoudun_stand|Make him swing the huge saber forward in a slashing attack pose toward the right."
P[gen_dianwei_attack]="u2in_gen_dianwei_stand|Make him swing both axes forward in an attack pose toward the right, one axe slashing forward and the other raised."
for k in ${KINDS:-inf_g_attack spear_g_attack bow_g_stand cav_g_attack gen_guanyu_attack gen_zhangfei_attack gen_xiahoudun_attack gen_dianwei_attack}; do
  IFS='|' read -r IN PR <<< "${P[$k]}"
  $Q "$D/$IN.png" "$D/${k}_s$S.png" $S "$PR $KEEP"
done
