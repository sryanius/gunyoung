#!/bin/bash
# 5차 — 목책 3차(뾰족하게 깎은 말뚝 한 줄, 전체가 화면 안에)
G="bash /c/claude/gunyoung/assets/raw/battle2/field/gen.sh"
PROPNEG="people, soldier, scenery, grass, sky, clouds, modern, shadow, gradient background, pattern background, multiple views"
for s in 21 22 23 24; do
$G palis3 $s 1216 832 "no humans, palisade, short wall of sharpened logs, pointed tips, spiked wooden stakes in a row, tied with rope, horizontal log rail, brown wood, front view, full object, wide margin, game asset, painterly, simple background, pink background, flat color background, centered, single object" "$PROPNEG, house, gate, roof, tower, perspective, cropped, flat top"
done
echo BATCH5 DONE
