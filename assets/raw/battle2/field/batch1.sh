#!/bin/bash
# 1차 SDXL 배치 — 전장 질감·중경·소품·깃발·핏자국·fx·HUD 틀·아이콘 후보
G="bash /c/claude/gunyoung/assets/raw/battle2/field/gen.sh"
PROPNEG="people, soldier, scenery, grass, sky, clouds, modern, shadow, gradient background, pattern background, multiple views"
for s in 1 2 3; do
$G gtex $s 1536 640 "no humans, scenery, ground, dirt, dry grass, yellow grass, grass tufts, pebbles, wheel tracks, dirt road, from above, top-down view, painting (medium), watercolor (medium), traditional media, warm colors, sunset lighting, full frame" "sky, horizon, mountain, tree, building, people, border, frame"
$G gfield $s 1536 640 "no humans, scenery, battlefield ground, plains, dry grassland, trampled dirt, mud tracks, wheel ruts, sparse grass tufts, small stones, close-up of ground, from above, painting (medium), muted warm colors, golden hour" "sky, horizon, mountain, tree, building, people, border, frame, river, water"
done
for s in 1 2 3 4; do
$G mid $s 1536 640 "no humans, scenery, treeline, forest, trees, bushes, low hills, silhouette, fog, mist, ink wash painting, monochrome, greyscale, white background, simple background, horizontal, wide shot, side view" "sky, clouds, sun, moon, river, mountain, building, people, border, frame, birds, gradient"
done
for s in 1 2 3; do
$G tent $s 1024 1024 "no humans, ancient chinese military tent, army camp tent, large canvas tent, beige cloth, wooden poles, rope, side view, game asset, painterly, simple background, pink background, flat color background, centered, single object" "$PROPNEG, camping, nylon"
$G palisade $s 1216 832 "no humans, wooden palisade, spiked wooden barricade, sharpened logs, cheval de frise, rope bindings, side view, game asset, painterly, simple background, pink background, flat color background, centered, single object" "$PROPNEG, house, gate"
$G treedead $s 832 1216 "no humans, dead tree, bare tree, leafless, twisted trunk, gnarled branches, dark bark, side view, game asset, painterly, simple background, pink background, flat color background, centered, single object" "$PROPNEG, leaves, flowers, cherry blossoms, petals"
done
for s in 1 2 3 4; do
$G rock $s 1024 1024 "no humans, rock, large boulder, grey stone, weathered, side view, game asset, painterly, simple background, pink background, flat color background, centered, single object" "$PROPNEG, crystal, gem, face"
done
for s in 1 2 3; do
$G banner $s 640 1536 "no humans, war banner, tall vertical banner, long green flag, plain green cloth, gold trim border, wooden flagpole, spear tip, red tassel, waving in wind, solo, simple background, pink background, flat color, centered" "$PROPNEG, multiple flags, shield, emblem, crest, symbol, person, rope"
$G flag $s 832 1216 "no humans, flag, single green flag, plain green cloth, gold border, wooden flagpole, waving in wind, solo, simple background, pink background, flat color, vector art, centered" "$PROPNEG, multiple flags, shield, emblem, crest, symbol, pattern, banner stand, rope, person"
$G blood $s 1024 1024 "no humans, blood splatter, blood stain, blood pool, dark red, top-down view, white background, simple background" "people, weapon, scenery, hand, border, frame"
done
for s in 1 2 3 4; do
$G slashb $s 1216 832 "no humans, energy slash, crescent shaped sword wave, glowing blue crescent, slash effect, light trail, light particles, sparks, magic, blue theme, black background, simple background" "people, weapon, sword, moon, sky, scenery, planet, border, frame"
done
for s in 1 2 3; do
$G slashw $s 1216 832 "no humans, sword slash effect, white crescent arc, glowing white slash, motion trail, light particles, monochrome, black background, simple background" "people, weapon, sword, moon, sky, scenery, planet, border, frame"
done
for s in 1 2; do
$G dust $s 1024 1024 "no humans, smoke puff, dust cloud, single soft white smoke cloud, monochrome, black background, simple background, centered" "people, scenery, fire, border, frame"
$G spark $s 1024 1024 "no humans, impact flash, spark burst, star burst, glowing yellow white sparks, light particles, black background, simple background, centered" "people, scenery, border, frame, sun, moon"
done
for s in 1 2 3; do
$G pframe $s 896 1088 "no humans, ornate rectangular portrait frame, vertical picture frame, carved bronze frame, antique gold, corner ornaments, thin border, empty center, game ui frame, green background, simple background, symmetrical, front view" "person, face, landscape, sky, gem, tassel, portrait, painting"
$G medal $s 1024 1024 "no humans, round bronze medallion frame, circular ring, ornate bronze ring, engraved chinese pattern, antique gold, thick ring, empty center, hole, game ui, green background, simple background, symmetrical, front view" "person, face, landscape, sky, gem, tassel, coin face, clock, square"
$G skdragon $s 1024 1024 "no humans, chinese dragon, dragon head, azure dragon, green dragon, glowing eyes, open mouth, roaring, blue green flames, emblem, game skill icon, dark background, centered, close-up" "people, border, frame, full body"
$G skroar $s 1024 1024 "no humans, tiger head, roaring tiger, open mouth, fangs, red aura, shockwave, flames, emblem, game skill icon, dark background, centered, close-up" "people, border, frame, full body, cute"
done
echo BATCH1 DONE
