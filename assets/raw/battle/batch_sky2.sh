#!/bin/bash
G=/c/claude/gunyoung/assets/raw/battle/gen.sh
# 수묵 담채 쪽으로 더 기울인 변형
SKY2="no humans, scenery, side view, vast battlefield, open plains, dry grassland, distant mountains, sunset, pale orange sky, soft clouds, traditional chinese painting, ink wash painting, sumi-e, watercolor on paper, washed out colors, faded, wide shot, horizon"
SKYN="people, 1boy, 1girl, soldier, buildings, castle, border, frame, river, lake, sea, tree, forest, digital art, photorealistic"
for s in 5 6; do $G sky $s 1216 832 "$SKY2" "$SKYN"; done
# sky_s2 하이레즈 img2img (1824x1248, denoise 0.4)
node /c/claude/gunyoung/tools/gen.mjs --ckpt=animagine-xl-4.0.safetensors --w=1824 --h=1248 --steps=30 --cfg=5 --seed=5 \
  --init=/c/claude/gunyoung/assets/raw/battle/sky_s2_up.png --denoise=0.4 --out=/c/claude/gunyoung/assets/raw/battle/sky_s2_hi.png \
  --prompt="masterpiece, best quality, very aesthetic, absurdres, no humans, scenery, side view, vast battlefield, open plains, dry grassland, sunset, orange sky, dramatic clouds, ink wash painting, watercolor, ancient china, muted colors, wide shot, horizon, intricate details" \
  --neg="lowres, worst quality, text, watermark, signature, logo, blurry, letters, writing, calligraphy, characters, seal, stamp, chinese text, kanji, people, 1boy, 1girl, soldier, buildings, castle, border, frame, river, lake, sea, tree, forest" 2>&1 | tail -1
echo SKY2_DONE
