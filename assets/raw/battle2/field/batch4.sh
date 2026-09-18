#!/bin/bash
# 4차 — 땅 img2img 재시도: «wheel tracks» 가 진짜 바퀴를 그려서 뺌, 초안의 길·풀밭을 진하게, denoise 0.42/0.5
G="bash /c/claude/gunyoung/assets/raw/battle2/field/gen.sh"
D=/c/claude/gunyoung/assets/raw/battle2/field
GP="no humans, scenery, ground, field, dry grassland, yellow dry grass, grass tufts, dirt path, ruts in mud, pebbles, stones, from above, painting (medium), gouache, watercolor (medium), traditional media, soft colors, muted colors"
GN="sky, horizon, mountain, tree, building, people, border, frame, water, river, high contrast, glowing, lens flare, sunlight, flowers, wheel, cart, wagon, vehicle, railroad, fence"
for den in 0.42 0.50; do
for k in 0 1 2; do
$G "gj_d${den}_w${k}" 11 1536 640 "$GP" "$GN" 5 28 "$D/ginit/b2f_ginit_w${k}.png" $den
done; done
echo BATCH4 DONE
