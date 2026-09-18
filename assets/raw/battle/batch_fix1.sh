#!/bin/bash
G=/c/claude/gunyoung/assets/raw/battle/gen.sh
BASE="1boy, solo, full body, standing, from side, profile, facing to the right, ancient chinese soldier, grey armor, white clothes, grey clothes, leather armor, chibi, game sprite, flat color, simple background, green background, no shadow"
UN="multiple boys, 2boys, multiple views, from behind, from front, facing viewer, text, shadow, gradient background, pattern background, weapon rack, scenery, ghost, hood, ribbon, smoke"
for s in 7 8 9; do
  $G u_general_left $s 832 1216 "general, commander, ornate grey armor, helmet, red plume, long cape, flowing cape, holding polearm, guandao, tall, $BASE" "$UN"
done
GND="no humans, dirt ground texture, dry grass, sparse grass, pebbles, top-down view, seamless texture, tileable, flat, full frame texture, light brown, dusty, daylight, ancient battlefield ground"
GNDN="people, sky, horizon, objects, weapon, border, frame, perspective, footprints, shadow, animal, plant pot, flowers, dark, night"
for s in 4 5; do $G ground $s 1024 1024 "$GND" "$GNDN"; done
echo FIX1_DONE
