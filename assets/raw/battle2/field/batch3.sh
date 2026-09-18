#!/bin/bash
# 3차 SDXL 배치 — 목책 재시도(뾰족 말뚝 울타리), 바위 재시도(분홍 물듦 → 파란 배경·밝은 회색)
G="bash /c/claude/gunyoung/assets/raw/battle2/field/gen.sh"
PROPNEG="people, soldier, scenery, grass, sky, clouds, modern, shadow, gradient background, pattern background, multiple views"
for s in 11 12 13 14; do
$G palis2 $s 1216 832 "no humans, wooden stockade wall, row of sharpened wooden stakes, pointed log fence, fortification, defensive wall, rope bindings, brown wood, front view, side view, game asset, painterly, simple background, blue background, flat color background, centered, single object" "$PROPNEG, house, gate, roof, tower, perspective"
done
for s in 11 12 13; do
$G rockb $s 1024 1024 "no humans, rock, boulder, light grey stone, beige stone, weathered, cracks, side view, game asset, painterly, simple background, blue background, flat color background, centered, single object" "$PROPNEG, crystal, gem, face, dark, black rock, purple"
done
echo BATCH3 DONE
