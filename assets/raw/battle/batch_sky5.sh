#!/bin/bash
node /c/claude/gunyoung/tools/gen.mjs --ckpt=animagine-xl-4.0.safetensors --w=1824 --h=1248 --steps=30 --cfg=5 --seed=5 \
  --init=/c/claude/gunyoung/assets/raw/battle/sky_s5_up.png --denoise=0.38 --out=/c/claude/gunyoung/assets/raw/battle/sky_s5_hi.png \
  --prompt="masterpiece, best quality, very aesthetic, absurdres, no humans, scenery, side view, vast battlefield, open plains, dry grassland, distant mountains, sunset, pale orange sky, soft clouds, traditional chinese painting, ink wash painting, sumi-e, watercolor on paper, washed out colors, faded, wide shot, horizon, intricate details" \
  --neg="lowres, worst quality, text, watermark, signature, logo, blurry, letters, writing, calligraphy, characters, seal, stamp, chinese text, kanji, people, 1boy, 1girl, soldier, buildings, castle, border, frame, river, lake, sea, tree, forest, digital art, photorealistic" 2>&1 | tail -1
echo SKY5_DONE
