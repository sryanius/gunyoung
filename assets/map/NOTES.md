# 지도 그룹 — 재현 노트

결과물: `assets/map/map.jpg` (2000×1560, JPG q90) · `assets/map/clouds.png` (1024×512, RGBA)
원본·중간물: `assets/raw/map/` (스케치 스크립트, 후보 전부, 확인용 그림)

도구: ComfyUI `http://localhost:8188`, 체크포인트 `animagine-xl-4.0.safetensors`, 클라이언트 `tools/gen.mjs`,
후처리 파이썬 `C:\pinokio\api\inteliweb-comfyui\app\env\Scripts\python.exe` (Pillow 12.3 + numpy).
ControlNet 은 openpose 뿐이라 안 씀 — 색 스케치 img2img 로 개형을 잡았다.

## map.jpg 파이프라인

1. **색 스케치** `raw/map/sketch.py` → `sketch.png` (1216×832).
   - 논리좌표 1000×780 을 1.216 / 1.0667 배율로. 도시 46개는 `src/data/cities.js` 에서 정규식으로 읽음.
   - 바다(동·남) 해안선 폴리라인, 사막(서북), 남중 밀림, 숲 타원, 산맥은 **삼각 봉우리 글리프**(밝은 면/어두운 면)를 능선 따라 겹쳐 찍음
     (타원 사슬로 그리면 SDXL 이 "갈색 벌레"로 그린다 — v1 실패), 황하·장강 굵은 파란 선 + 지류 9개, 호수 2개,
     숲·평야에 나무 글리프(도시 22유닛 안·강·바다·산은 피함), 저주파 노이즈로 수채 얼룩.
   - 강은 도시에서 12유닛 이상 띄웠다. 해안선은 도시에서 최소 33유닛(교지) 이상.
   - `sketch_check.png` 에 도시 점을 찍어 확인.
2. **img2img 1차** (1216×832, denoise 0.5, seed 33) → `raw/map/v3_d0.5_s33.png`
   ```
   node tools/gen.mjs --ckpt=animagine-xl-4.0.safetensors --w=1216 --h=832 --steps=28 --cfg=5 --seed=33 \
     --init=assets/raw/map/sketch_v3.png --denoise=0.5 --out=assets/raw/map/v3_d0.5_s33.png \
     --prompt="masterpiece, best quality, very aesthetic, absurdres, no humans, scenery, fantasy map, top-down view, bird's eye view, ancient chinese landscape painting, ink wash painting, watercolor, mountains, rivers, forests, trees, grassland, plains, desert, sea, ocean waves, parchment texture, detailed, muted colors" \
     --neg="lowres, worst quality, text, letters, watermark, signature, logo, blurry, border, frame, people, buildings, grid, 1girl, 1boy, seal, stamp, calligraphy, chinese text, kanji, bird, birds, animal, flying, swirl"
   ```
   - 굴린 것: denoise 0.45/0.5/0.55/0.65 × seed 11/22/33/44/55/66. 0.55 이상은 강·산이 스케치에서 크게 벗어남.
   - **seed 66·44 는 낙관(붉은 도장)+서명 글자가 자주 박힘 → 탈락.** seed 11 은 보라 깃털 같은 잡물. seed 33 이 수묵 산이 가장 좋았다.
3. **하이레즈 2차**: Pillow Lanczos 로 1664×1280 업스케일 후 img2img denoise 0.45, seed 5 → `raw/map/hi3_s33_d0.45_s5.png`
   (= `raw/map/map_final_raw_1664x1280.png`)
   ```
   python -c "from PIL import Image; Image.open('v3_d0.5_s33.png').resize((1664,1280), Image.LANCZOS).save('v3_d0.5_s33_up.png')"
   node tools/gen.mjs --ckpt=animagine-xl-4.0.safetensors --w=1664 --h=1280 --steps=30 --cfg=5 --seed=5 \
     --init=assets/raw/map/v3_d0.5_s33_up.png --denoise=0.45 --out=assets/raw/map/hi3_s33_d0.45_s5.png \
     --prompt="masterpiece, best quality, very aesthetic, absurdres, no humans, scenery, fantasy map, top-down view, ancient chinese landscape painting, ink wash painting, watercolor, detailed mountains, rivers, forests, trees, grassland, fields, hills, desert, ocean waves, parchment texture, intricate details" \
     --neg="(위와 같음)"
   ```
   - 후보: s33 기반 denoise 0.45/0.5 × seed 5/7 (4장 전부 깨끗), s55 기반 2장은 좌상단 낙관 → 탈락.
4. **완성** `raw/map/finalize.py hi3_s33_d0.45_s5.png cand_B.jpg check_B.png` — Lanczos 2000×1560 → JPG q90(4:4:4),
   도시 46점 확인용 `raw/map/check.png` (노랑 = 파랑 픽셀 위. 23 서평·36 강하 두 곳뿐이고 둘 다 강 위, 바다 아님).
   네 모서리 원본 해상도 크롭(`corners_B.png`)으로 낙관·글자 없음 확인.

## clouds.png

- txt2img 1216×832, seed 101~104. **seed 103** 선택(구름이 흩어져 있고 검정 틈이 많아 안개 조각에 맞음; 102·104 는 화면을 꽉 채워 알파로 바꾸면 덩어리).
  ```
  node tools/gen.mjs --ckpt=animagine-xl-4.0.safetensors --w=1216 --h=832 --steps=28 --cfg=5 --seed=103 --out=assets/raw/map/cloud_s103.png \
    --prompt="masterpiece, best quality, very aesthetic, absurdres, no humans, white clouds, cumulus clouds, mist, fog, smoke, simple background, black background, monochrome, soft edges, wispy" \
    --neg="lowres, worst quality, text, letters, watermark, signature, logo, blurry, border, frame, people, sky, blue sky, landscape, gradient, moon, sun, stars"
  ```
- 후처리(Pillow): 가운데 1216×608 크롭 → 1024×512 Lanczos → 밝기 L 을 알파로(`clip((L-0.08)/0.92)^1.15`, 검정=투명) →
  가장자리 64px 선형 페이드(알파 0) → RGB 전부 255. 평균 알파 0.17. 확인용 `raw/map/clouds_check.png`(짙은 파랑 위 합성).

## 다음에 손볼 만한 것

- 서북 사막·북부 평야가 밋밋하다(수묵 담채 특성). 더 질감을 원하면 스케치 사막에 모래 언덕 글리프를 넣고 다시 1·2단계.
- 태행산맥이 얇다(진양~업 사이). 스케치의 `ridge([(598,175),(602,230),(606,292)], 18)` 두께를 24 로 올리면 된다.
- 강하(36)·시상(40) 근처 강이 매듭처럼 얽혀 있다(한수·상강·장강·동정호가 모이는 곳) — 호수로 보여 무방.
