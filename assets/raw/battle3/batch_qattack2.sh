#!/bin/bash
# Qwen attack 재시도(관우: 날이 자홍을 반사해 보랏빛 / 하후돈: 칼이 등 뒤(왼쪽)로 / 전위: 도끼 한 자루가 사라짐) — 지시문을 못박아 seed 2·3
Q=/c/claude/gunyoung/assets/raw/battle3/qedit.sh; D=/c/claude/gunyoung/assets/raw/battle3/units/q
KEEP="Keep the outfit, colors and style exactly the same. Keep the same character size and position, feet on the same spot. Keep the plain magenta background."
for S in 2 3; do
$Q $D/u2in_gen_guanyu_stand.png $D/gen_guanyu_attack_s$S.png $S "Make her swing the crescent blade polearm forward in a powerful slashing attack pose toward the right, the crescent blade in front of her on the right side. The blade stays plain silver-white metal with no pink or purple reflection. Her body and face stay turned to the right. $KEEP"
$Q $D/u2in_gen_xiahoudun_stand.png $D/gen_xiahoudun_attack_s$S.png $S "Make her slash with the huge broad sword in an attack pose: she lunges to the right and the sword blade points forward to the right side of the image, extended in front of her face. The sword must not point to the left. She stays in side view, face turned to the right, the black eyepatch stays on her visible eye. $KEEP"
$Q $D/u2in_gen_dianwei_stand.png $D/gen_dianwei_attack_s$S.png $S "Make her attack with two axes toward the right: she holds one axe in each hand, the front axe slashing forward to the right and the other axe raised above her head behind her. Both axes must be visible. She stays in side view, face turned to the right. $KEEP"
done
echo QATTACK2_DONE
