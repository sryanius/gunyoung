#!/bin/bash
# 2차 SDXL 배치 — 땅 img2img(파이썬 초안 3창) + 중경 나무 띠 추가 seed
G="bash /c/claude/gunyoung/assets/raw/battle2/field/gen.sh"
D=/c/claude/gunyoung/assets/raw/battle2/field
GP="no humans, scenery, ground, field, dry grassland, dry grass tufts, dirt road, wheel tracks, pebbles, stones, from above, painting (medium), gouache, watercolor (medium), traditional media, soft colors, muted colors"
GN="sky, horizon, mountain, tree, building, people, border, frame, water, river, high contrast, glowing, lens flare, sunlight, flowers"
for den in 0.50 0.62; do
for k in 0 1 2; do
$G "gi2i_d${den}_w${k}" 7 1536 640 "$GP" "$GN" 5 28 "$D/ginit/b2f_ginit_w${k}.png" $den
done; done
for s in 5 6 7 8 9 10; do
$G mid $s 1536 640 "no humans, scenery, distant treeline, row of trees, deciduous trees, round trees, bushes, low hills, far away, silhouette, fog bank below, mist, ink wash painting, monochrome, greyscale, white background, simple background, horizontal, wide shot, side view" "sky, clouds, sun, moon, river, mountain, building, people, border, frame, birds, gradient, tree trunk, close-up"
done
echo BATCH2 DONE
