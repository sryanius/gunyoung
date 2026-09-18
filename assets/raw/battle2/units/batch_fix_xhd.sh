#!/bin/bash
# 수정 회차: 하후돈을 나머지 무장과 같은 옆모습·작은 눈으로 다시 뽑는다(검수: s28 은 왼쪽 보기 3/4 모에 눈이라 세트에서 튄다).
#   → «profile, from side» 를 앞세우고 부정에 looking at viewer·big eyes·three quarter view.
G=/c/claude/gunyoung/assets/raw/battle2/units/gen.sh
UN="multiple boys, 2boys, multiple views, from behind, from front, facing viewer, looking at viewer, big eyes, three quarter view, gradient background, pattern background, weapon rack, scenery, 1girl, female, silhouette, faceless, shadow, border, frame, realistic proportions, tall, slender, plume, aura, fire, magic, wings, feather"
HEAD="chibi, big head, short legs, 1boy, solo, full body, standing, profile, from side, facing to the right, looking to the side"
K="xiahou dun, three kingdoms, eyepatch, black eyepatch, short beard, stubble, black hair, mature male face, blue armor, blue cape, ancient chinese armor, blue helmet, holding sword, huge sword, broadsword, dao, curved blade, boots"
for s in ${SEEDS:-33 34 35 36 37 38 39 40}; do
  $G "fx_gen_xiahoudun" $s 832 1216 "$HEAD, $K, simple background, green background" "$UN"
done
echo DONE
