#!/bin/bash
# 전투 에셋 생성 래퍼. usage: gen.sh <name> <seed> <w> <h> "<prompt tags>" ["<extra negative>"] [cfg] [steps]
# → C:\claude\gunyoung\assets\raw\battle\<name>_s<seed>.png
# 부정 프롬프트에 seal/stamp/calligraphy/chinese text/kanji — Animagine 이 낙관·서명을 박는 버릇(assets/map/NOTES.md) 대비.
NAME="$1"; SEED="$2"; W="$3"; H="$4"; PROMPT="$5"; XNEG="${6:-}"; CFG="${7:-5}"; STEPS="${8:-28}"
OUT="/c/claude/gunyoung/assets/raw/battle/${NAME}_s${SEED}.png"
PRE="masterpiece, best quality, very aesthetic, absurdres"
NEG="lowres, worst quality, text, watermark, signature, logo, blurry, letters, writing, calligraphy, characters, seal, stamp, chinese text, kanji"
[ -n "$XNEG" ] && NEG="$NEG, $XNEG"
node /c/claude/gunyoung/tools/gen.mjs --ckpt=animagine-xl-4.0.safetensors \
  --prompt="$PRE, $PROMPT" --neg="$NEG" --w="$W" --h="$H" --steps="$STEPS" --cfg="$CFG" --seed="$SEED" \
  --out="$OUT" 2>&1 | tail -1
