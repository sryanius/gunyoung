#!/usr/bin/env bash
# 경로 A: SDXL(animagine-xl-4.0) 로 아이콘 후보를 1024x1024 로 뽑는다. 항목당 seed 3개.
OUT=/c/claude/gunyoung/assets/raw/icons/sdxl
mkdir -p "$OUT"
PRE="masterpiece, best quality, very aesthetic, absurdres, game icon, "
POST=", centered, simple background, green background, no humans, thick outline, glossy, still life, single object, front view"
NEG="lowres, worst quality, text, watermark, signature, logo, blurry, multiple objects, human, 1girl, 1boy, cropped, border, frame, hands"
declare -A OBJ=(
  [gold]="gold bar, gold ingot, chinese sycee, shiny gold"
  [food]="rice bag, burlap sack, grain sack, rope tie"
  [troops]="crossed spears, two spears, crossed weapons"
  [officer]="chinese helmet, ancient armor helmet, red plume"
  [calendar]="calendar, hanging scroll calendar, wooden board"
  [cmd_domestic]="hoe, farming hoe, wooden handle"
  [cmd_military]="spear, chinese spear, red tassel"
  [cmd_personnel]="seal, red stamp seal, chinese seal, wooden stamp"
  [cmd_scheme]="scroll, paper scroll, rolled scroll, bamboo scroll"
  [cmd_diplomacy]="jade seal, imperial jade seal, dragon carving, green jade"
  [cmd_march]="horse head, war horse, black horse, bridle"
)
for name in gold food troops officer calendar cmd_domestic cmd_military cmd_personnel cmd_scheme cmd_diplomacy cmd_march; do
  for seed in 11 22 33; do
    f="$OUT/${name}_s${seed}.png"
    [ -f "$f" ] && continue
    node /c/claude/gunyoung/tools/gen.mjs --ckpt=animagine-xl-4.0.safetensors \
      --prompt="${PRE}${OBJ[$name]}${POST}" --neg="$NEG" \
      --w=1024 --h=1024 --steps=28 --cfg=5 --seed=$seed --out="$f" 2>&1 | tail -1
  done
done
echo "SDXL batch done"
