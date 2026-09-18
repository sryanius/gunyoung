#!/bin/bash
# 전장 SD 무장(여성) 생성 래퍼. usage: gen_unit.sh <name> <seed> "<prompt tags>" ["<extra negative>"]  → units/cand/<name>_s<seed>.png (832×1216)
# 수위: 전장 유닛은 SD 등신(치비)이라 **노출 없이 갑옷 위주**(BATTLE_V3.md §3.1) — 부정에 cleavage·midriff·bikini 등을 넣어 옷을 다 입힌다. rating 태그는 general.
NAME="$1"; SEED="$2"; PROMPT="$3"; XNEG="${4:-}"
OUT="/c/claude/gunyoung/assets/raw/battle3/units/cand/${NAME}_s${SEED}.png"
PRE="masterpiece, best quality, very aesthetic, absurdres, general"
NEG="lowres, worst quality, text, watermark, signature, logo, blurry, letters, writing, calligraphy, characters, seal, stamp, chinese text, kanji"
NEG="$NEG, nsfw, explicit, nude, nipples, see-through, torn clothes, sex, cleavage, midriff, navel, bikini, swimsuit, bare legs, underwear, panties, school uniform"
NEG="$NEG, multiple girls, 2girls, 1boy, multiple views, from behind, from front, facing viewer, looking at viewer, three quarter view, gradient background, pattern background, weapon rack, scenery, silhouette, faceless, shadow, border, frame, plume, aura, fire, magic, realistic proportions, tall, slender, helmet, hat"
[ -n "$XNEG" ] && NEG="$NEG, $XNEG"
node /c/claude/gunyoung/tools/gen.mjs --ckpt=animagine-xl-4.0.safetensors --prompt="$PRE, $PROMPT" --neg="$NEG" --w=832 --h=1216 --steps=28 --cfg=5 --seed="$SEED" --out="$OUT" 2>&1 | tail -1
