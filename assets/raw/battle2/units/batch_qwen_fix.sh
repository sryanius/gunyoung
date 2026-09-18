#!/bin/bash
# (기록) 인라인으로 돌린 Qwen 편집들 — stand 고치기 4 + 재시도. 채택: bow_fix_s1 · cav_fix_s1 · zhangfei_fix_s1 · xiahoudun_fix_s1 · bow_g_stand_s2 · gen_xiahoudun_attack_s3
# 입력(q/u2in_*_fix.png)은 `u2post.py flat m/<SDXL 마스터>.png q/u2in_<k>_fix.png --h=130|150|146` 로 만든다(자홍 단색 383x448).
Q=/c/claude/gunyoung/assets/raw/battle2/units/qedit.sh; D=/c/claude/gunyoung/assets/raw/battle2/units/q
KEEP="Keep the character, outfit, colors and art style exactly the same. Keep the plain magenta background."
$Q $D/u2in_bow_fix.png $D/bow_fix_s1.png 1 "Replace the long bow with a small short bow, about half as tall, so that the bow does not reach above his head. He is still drawing the bowstring with an arrow, aiming to the right. $KEEP"
$Q $D/u2in_cav_fix.png $D/cav_fix_s1.png 1 "Make the spear much shorter: a short spear held in his hand, pointing forward and slightly upward. The spear tip must not extend past the horse's head and the spear end must not extend past the horse's tail. Keep the horse, the rider, outfit, colors and art style exactly the same. Keep the plain magenta background."
$Q $D/u2in_zhangfei_fix.png $D/zhangfei_fix_s1.png 1 "Remove the tall white horn from the top of his hat. Keep everything else exactly the same."
$Q $D/u2in_xiahoudun_fix.png $D/xiahoudun_fix_s1.png 1 "Replace his thin sword with a huge broad-bladed curved saber, held in the same hand with the blade pointing down and forward. $KEEP"
# 탈락: cav_fix_s2·s3(«turn it around … tip pointing forward» → 창 두 자루 / 머리 위 수평), s4·s5(«couched diagonally» → 허공에 뜬 창 한 자루 더)
KEEP2="Keep the outfit, colors and style exactly the same. Keep the same character size and position, feet on the same spot. Keep the plain magenta background."
# bow stand: batch_attack1 의 s1 은 정면을 보고 섰다 → 옆모습을 못박아 재시도(s2 채택, s3 도 옆모습이지만 화살을 아래로 쥐고 있어 s2 가 깔끔)
for s in 2 3; do $Q $D/u2in_bow_g_attack.png $D/bow_g_stand_s$s.png $s "Make him stop aiming and stand at ease, still in side view, profile, body and face turned to the right. He holds the short bow upright in his front hand with the arm lowered in front of him, the bowstring not drawn, and his other arm hangs down at his side. $KEEP2"; done
# 하후돈 attack: s1 은 안대가 반대쪽 눈으로 옮겨 갔다 → 안대 자리를 못박아 재시도(s3 채택, s2 는 또 반대쪽)
for s in 2 3; do $Q $D/u2in_gen_xiahoudun_stand.png $D/gen_xiahoudun_attack_s$s.png $s "Make him swing the huge saber forward in a slashing attack pose toward the right. His face stays exactly the same as in the original: the black eyepatch stays on the same eye, the eye on the left side of his face in the picture, and his uncovered blue eye stays on the right side of his face. $KEEP2"; done
