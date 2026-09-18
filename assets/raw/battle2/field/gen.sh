#!/bin/bash
# 전장·이펙트·HUD 2차 에셋 생성 래퍼. usage: gen.sh <name> <seed> <w> <h> "<tags>" ["<extra negative>"] [cfg] [steps] [init] [denoise]
# → assets/raw/battle2/field/<name>_s<seed>.png   (raw/battle/gen.sh 와 같은 앞머리·부정)
NAME="$1"; SEED="$2"; W="$3"; H="$4"; PROMPT="$5"; XNEG="${6:-}"; CFG="${7:-5}"; STEPS="${8:-28}"; INIT="${9:-}"; DEN="${10:-1}"
OUT="/c/claude/gunyoung/assets/raw/battle2/field/${NAME}_s${SEED}.png"
PRE="masterpiece, best quality, very aesthetic, absurdres"
NEG="lowres, worst quality, text, watermark, signature, logo, blurry, letters, writing, calligraphy, characters, seal, stamp, chinese text, kanji"
[ -n "$XNEG" ] && NEG="$NEG, $XNEG"
EXTRA=""
[ -n "$INIT" ] && EXTRA="--init=$INIT --denoise=$DEN"
node /c/claude/gunyoung/tools/gen.mjs --ckpt=animagine-xl-4.0.safetensors \
  --prompt="$PRE, $PROMPT" --neg="$NEG" --w="$W" --h="$H" --steps="$STEPS" --cfg="$CFG" --seed="$SEED" \
  --out="$OUT" $EXTRA 2>&1 | tail -1
