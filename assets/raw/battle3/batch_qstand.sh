#!/bin/bash
# Qwen stand 고치기 — 입력은 units/q/in_<key>_stand.png (padflip.py: 오른쪽 보기로 뒤집고 1040×1216 으로 덧댐)
Q=/c/claude/gunyoung/assets/raw/battle3/qedit.sh; D=/c/claude/gunyoung/assets/raw/battle3/units/q; S="${1:-1}"
KEEP="Keep the character, face, hair, outfit, colors, size, position and chibi art style exactly the same. Keep the plain flat background."
$Q $D/in_guanyu_stand.png $D/gen_guanyu_stand_s$S.png $S "Remove the golden crescent ring floating above her head. Replace her thin golden staff with a guandao: a polearm with a dark green shaft and a large silver crescent blade with gold fittings at its top end, held upright in her front hand. The blade is beside her head and not higher than the top of her head. $KEEP"
$Q $D/in_zhangfei_stand.png $D/gen_zhangfei_stand_s$S.png $S "Make her stand firmly with both feet flat on the ground, legs straight, body and face still in side view turned to the right. She holds the black spear with the red spearhead diagonally in front of her, the spearhead pointing forward and up but not higher than the top of her head. $KEEP"
$Q $D/in_xiahoudun_stand.png $D/gen_xiahoudun_stand_s$S.png $S "Make the huge broad sword shorter so that the entire blade is visible inside the image and the sword tip does not touch the image edge. She holds the sword with the blade pointing down and backward. The black eyepatch stays on the same eye. $KEEP"
$Q $D/in_dianwei_stand.png $D/gen_dianwei_stand_s$S.png $S "Complete the axe that is cut off at the image edge so that both axes are fully visible inside the image. She holds one axe in each hand, blades down. $KEEP"
echo QSTAND_DONE
