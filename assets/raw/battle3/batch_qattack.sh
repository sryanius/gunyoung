#!/bin/bash
# Qwen attack — 입력은 units/q/u2in_gen_<key>_stand.png (u2post.py flat: 128×160 배치 그대로 2.8배, 자홍 배경 383×448)
Q=/c/claude/gunyoung/assets/raw/battle3/qedit.sh; D=/c/claude/gunyoung/assets/raw/battle3/units/q; S="${1:-1}"
KEEP="Keep the outfit, colors and style exactly the same. Keep the same character size and position, feet on the same spot. Keep the plain magenta background."
$Q $D/u2in_gen_guanyu_stand.png $D/gen_guanyu_attack_s$S.png $S "Make her swing the crescent blade polearm forward in a powerful slashing attack pose toward the right, the silver crescent blade in front of her. Her body and face stay turned to the right. $KEEP"
$Q $D/u2in_gen_zhangfei_stand.png $D/gen_zhangfei_attack_s$S.png $S "Make her thrust the spear forward to the right in a fierce attack pose, lunging with both hands on the spear, the spear held level and pointing to the right, shouting with her mouth open. She stays in side view, face turned to the right. $KEEP"
$Q $D/u2in_gen_xiahoudun_stand.png $D/gen_xiahoudun_attack_s$S.png $S "Make her swing the huge broad sword forward in a powerful slashing attack pose toward the right, lunging forward with the blade extended in front of her. She stays in side view, face turned to the right, the black eyepatch stays on her visible eye. $KEEP"
$Q $D/u2in_gen_dianwei_stand.png $D/gen_dianwei_attack_s$S.png $S "Make her swing both axes forward in an attack pose toward the right, one axe slashing forward and the other raised. She stays in side view, face turned to the right. $KEEP"
echo QATTACK_DONE
