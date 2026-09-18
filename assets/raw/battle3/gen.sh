#!/bin/bash
# 전투 3차(여성 무장) 생성 래퍼. usage: gen.sh <name> <seed> <w> <h> "<prompt tags>" ["<extra negative>"] [cfg] [steps] [init.png] [denoise]
# → assets/raw/battle3/cand/<name>_s<seed>.png   (앞머리·기본 부정은 assets/raw/battle/gen.sh 와 같다 + 수위 규칙 부정: BATTLE_V3.md §3.1)
NAME="$1"; SEED="$2"; W="$3"; H="$4"; PROMPT="$5"; XNEG="${6:-}"; CFG="${7:-5}"; STEPS="${8:-28}"; INIT="${9:-}"; DEN="${10:-0.35}"
OUT="/c/claude/gunyoung/assets/raw/battle3/cand/${NAME}_s${SEED}.png"
PRE="masterpiece, best quality, very aesthetic, absurdres, sensitive"
NEG="lowres, worst quality, bad anatomy, bad hands, extra fingers, text, watermark, signature, logo, blurry, letters, writing, calligraphy, characters, seal, stamp, chinese text, kanji"
# 수위 규칙(절대선 1·2) — 모든 컷인 생성에 강제로 붙는다
SAFE="nsfw, explicit, nude, nipples, pussy, see-through, torn clothes, sex, loli, child, young girl, petite, flat chest, chibi, school uniform"
NEG="$NEG, $SAFE"
[ -n "$XNEG" ] && NEG="$NEG, $XNEG"
EXTRA=""
[ -n "$INIT" ] && EXTRA="--init=$INIT --denoise=$DEN"
node /c/claude/gunyoung/tools/gen.mjs --ckpt=animagine-xl-4.0.safetensors \
  --prompt="$PRE, $PROMPT" --neg="$NEG" --w="$W" --h="$H" --steps="$STEPS" --cfg="$CFG" --seed="$SEED" \
  --out="$OUT" $EXTRA 2>&1 | tail -1
