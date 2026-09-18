#!/bin/bash
G=/c/claude/gunyoung/assets/raw/battle/gen.sh
SKY="no humans, scenery, side view, vast battlefield, open plains, dry grassland, distant mountains, sunset, orange sky, dramatic clouds, ink wash painting, watercolor, ancient china, muted colors, wide shot, horizon"
SKYN="people, 1boy, 1girl, soldier, buildings, castle, border, frame, river, lake, sea, tree, forest"
for s in 1 2 3 4; do $G sky $s 1216 832 "$SKY" "$SKYN"; done
FAR="no humans, scenery, mountain range, layered mountains, distant mountains, mist, fog, ink wash painting, sumi-e, monochrome, greyscale, simple background, white background, horizontal, wide shot"
FARN="people, buildings, trees, sky, clouds, sun, moon, river, border, frame, gradient, birds"
for s in 1 2 3; do $G far $s 1536 640 "$FAR" "$FARN"; done
GND="no humans, dirt ground texture, dry grass, sparse grass, pebbles, top-down view, seamless texture, tileable, flat, full frame texture, muted colors, brown earth, ancient battlefield ground"
GNDN="people, sky, horizon, objects, weapon, border, frame, perspective, footprints, shadow, animal, plant pot, flowers"
for s in 1 2 3; do $G ground $s 1024 1024 "$GND" "$GNDN"; done
echo BG_DONE
