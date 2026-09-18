#!/bin/bash
G=/c/claude/gunyoung/assets/raw/battle/gen.sh
GND="no humans, dry dirt ground, yellowed grass tufts, dead grass, small stones, gravel, top-down view, seamless texture, tileable, flat, full frame texture, ochre, khaki, painterly, muted colors, ancient battlefield ground"
GNDN="people, sky, horizon, objects, weapon, border, frame, perspective, footprints, shadow, animal, plant pot, flowers, smooth, plain, sand dune, orange, night"
for s in 6 7; do $G ground $s 1024 1024 "$GND" "$GNDN"; done
echo FIX2_DONE
