#!/bin/bash
# 수정 회차 Qwen 편집 (검수: gen_xiahoudun_stand 가 왼쪽 보기 — attack 은 오른쪽 보기라 교체 때마다 방향이 뒤집혔다)
#  A) 옛 디자인: attack(s3, 오른쪽 보기) → stand   (궁병과 같은 방식 — 단순 flip 은 안대가 반대 눈으로 간다)
#  B) 새 디자인: SDXL fx_gen_xiahoudun_s34(옆모습·작은 눈 — 나머지 무장과 같은 화풍, flip 해서 오른쪽 보기) → attack
Q=/c/claude/gunyoung/assets/raw/battle2/units/qedit.sh; D=/c/claude/gunyoung/assets/raw/battle2/units/fix/q
KEEP="Keep the outfit, colors and style exactly the same. Keep the same character size and position, feet on the same spot. Keep the plain magenta background."
PA="Make him stop attacking and stand at ease, body and face still turned to the right in the same three-quarter view, feet pointing right. He holds the huge saber lowered in his front hand, blade pointing down and forward to the right. The black eyepatch stays on the same eye, the eye on the left side of his face in the picture. $KEEP"
PB="Make him swing the huge broad sword forward in a powerful slashing attack pose toward the right, lunging forward with the blade extended in front of him. He stays in side view, profile, face turned to the right, the black eyepatch stays on his visible eye. $KEEP"
for s in ${SEEDS:-1 2}; do
  [ "${ONLY:-AB}" != B ] && $Q "$D/u2in_xhd_attack.png" "$D/xhd_stand_s$s.png" $s "$PA"
  [ "${ONLY:-AB}" != A ] && $Q "$D/u2in_xhd2_stand.png" "$D/xhd2_attack_s$s.png" $s "$PB"
done
echo DONE
