# UI 키트 제작 노트 (assets/ui)

재현용. 원본·후보·스크립트는 전부 `assets/raw/ui/` 에 있다.

## 공통

- 생성: `bash assets/raw/ui/gen.sh <이름> <seed> <w> <h> "<태그>" ["<추가 부정>"]`
  → `node tools/gen.mjs --ckpt=animagine-xl-4.0.safetensors --steps=28 --cfg=5 --sampler=euler_ancestral`
  - 앞머리 `masterpiece, best quality, very aesthetic, absurdres`
  - 부정 `lowres, worst quality, text, watermark, signature, logo, blurry, letters, writing, calligraphy, characters` + 항목별 추가
- 후처리: `"C:\pinokio\api\inteliweb-comfyui\app\env\Scripts\python.exe" assets/raw/ui/post.py`
  - `key`  : 단색 배경 키잉(초록은 G 우세도, 그 외는 색 거리) + 1px 침식 + 트림 + fit
  - `nine` : 프레임 그림에서 모서리 4 + 변 4 를 잘라 9-slice 재조립, 가운데 채움(단색/텍스처)
  - `check`: 크기·알파 확인
- 미리보기: `preview.py out.png in...` (체커+파랑 배경 위에 얹어 투명 판정)

## 항목별

| 파일 | 원본(seed) | 프롬프트 요지 | 후처리 |
|---|---|---|---|
| panel.png 384² c48 | panel_s6 (1024², seed 6) | `ornate square picture frame, thick carved dark wood border, black lacquer, bronze corner ornaments, empty center, game ui window frame, green background, simple background, no humans, symmetrical, front view` / 부정 `person, face, landscape, sky, gem, tassel, circle, diamond, arch` | 안쪽 프레임만 사용: `post.py nine panel_s6.png panel.png --out=384,384 --corner=48 --outer=146,146,878,878 --inner=222,221,803,805 --csrc=120 --espan=0.15,0.40 --bg=green --thr=6 --fill=14,10,8,217` (변 조각은 변 가운데 장식을 피해 15~40% 구간에서 샘플) |
| parchment.png 256² c24 | parchment_s1 (1024², seed 1) | `aged parchment texture, hanji paper texture, beige, blank paper, subtle fiber texture, slightly darker edges, flat, no text, full frame texture` | `build_parchment.py`: 256² Lanczos + 3px 안쪽 1px 갈색 선(α 0.22) |
| button.png / button_down.png 256×96 c32 | button_s5 (1216×832, seed 5) + wood_tex(hudw_s2 의 윗 판자) | `game ui button, wide rounded rectangle button, dark polished wood button face, thick gold border, bevel, glossy, front view, flat, centered, black background, simple background, no humans, symmetrical` / 부정 `... perspective, hole, empty, window, frame` | `post.py nine button_s5.png button.png --out=256,96 --corner=32 --outer=0,0,1216,832 --inner=52,48,1176,760 --csrc=90 --espan=0.05,0.25 --bg=black --thr=20 --fillimg=wood_tex.png --fillinset=10`; down = 밝기 0.62·채도 0.85 |
| hud_bar.png 1280×72 | hudw_s2 (1536×640, seed 2) | `wide wooden header bar, dark wood plank, gold trim edges, bronze medallion at both ends, plain center, top hud bar, 2d game ui, black background, ...` | `build_hud.py`: 가운데 띠(y350~452) 크롭 → 가운데 메달리온을 옆 구간으로 페더 덮기 → 끝단 70px 만 검정 키잉 → 1280×72 |
| flag.png 64×96 | flag_s6 (832×1216, seed 6) | `flag, single white flag, plain white cloth, wooden flagpole, waving in wind, solo, no humans, simple background, green background, flat color, vector art, centered` / 부정 `multiple flags, shield, emblem, crest, symbol, pattern, banner stand, rope, person, text` | `build_flag.py`: 좌우 반전(깃대 왼쪽) → crop → `key --bg=green --thr=25 --erode=1 --desat --fit=64,96 --pad=1` (채도 0 → 코드 tint 용) |
| army.png 96² | army_s3 (1024², seed 3) | `mounted warrior silhouette, cavalry, ancient chinese armor, horse, spear, banner, game icon, dark silhouette, simple background, green background, centered, side view` | `post.py key army_s3.png army.png --bg=green --thr=6 --erode=1 --fit=96,96 --pad=2` (배경이 짙은 초록이라 thr 낮게) |
| portrait_placeholder.png 96×120 | portrait_s1 (832×1216, seed 1) | `silhouette, bust, portrait, grey silhouette, monochrome, faceless, flat color, simple background, white background, upper body, ancient chinese general helmet` | 흰 배경 키잉 → 회색 톤 → 어두운 그라데이션(불투명) 위에 합성 (인라인 파이썬, 아래 참고) |
| castle_1.png 112² | castle1_s34 (1024², seed 34) | `small ancient chinese fort, single grey stone wall, one red roofed gate tower, tiny, 3/4 view, from above, game map icon, painterly, pink background, simple background, no humans, centered` / 부정 `cube, block, platform, floating island, cross-section, terrain, grass, trees, sky, clouds, person, text, purple, white walls` | `post.py key castle1_s34.png castle_1.png --bg=auto --thr=26 --ramp=14 --erode=1 --fit=112,112 --pad=2` |
| castle_2.png 136² | castle2_s33 (seed 33) | 위와 같고 `ancient chinese castle, grey stone city walls, red roofed gate tower, 3/4 view, from above, game map icon, painterly, pink background, ...` | `... --fit=136,136` |
| castle_3.png 160² | castle3_s34 (seed 34) | `grand ancient chinese fortress, three-tier grey stone city walls, tall red roofed pagoda keep, many watchtowers, 3/4 view, from above, game map icon, painterly, pink background, ...` | `... --fit=160,160` (분홍 배경은 색 거리 키잉, ramp 14 로 연분홍 벽면이 반투명해지지 않게) |
| banner.png 512×128 | banner_i2i2_d0.68_s2 (1536×640, img2img) | txt2img 로는 3회(seed 1~8, 프롬프트 3종) 모두 실패(메달리온·꼬인 리본·걸린 천). **`draw_ribbon.py` 로 그린 초안(ribbon_init2.png: 붉은 띠+제비꼬리+금테, 초록 배경)을 init 으로** `gen.mjs --init=ribbon_init2.png --denoise=0.68 --seed=2 --w=1536 --h=640 --prompt="…, red silk ribbon banner, horizontal, swallowtail forked ends, gold trim border, silk texture, soft folds, glossy fabric, blank center, game ui title ribbon, green background, simple background, no humans"` | `build_banner.py banner_i2i2_d0.68_s2.png banner.png`: 초록 키잉(thr 30) → 512×128 fit → 세로 광택 그라데이션(0.88→1.12→0.82) 곱해 비단 느낌 |

## 실패 기록 (다음에 피할 것)

- 프레임을 `black background` 로 뽑으면 옻칠(짙은 갈색)과 배경이 안 갈린다 → `green background` 로. 단 초록도 짙게 나와서(4,38,30) G 우세도 thr 6.
- `empty center` 는 잘 안 먹는다(가운데 장식이 들어감) → 어차피 가운데는 버리고 채우니 무시.
- 성(castle): `isometric ... green background` → 정육면체 디오라마 받침 + 안쪽 잔디가 초록이라 키잉 불가.
  `purple background` → 벽이 자주색으로 물들어 키잉 시 구멍. `white background` → 벽이 흰색으로 나옴.
  `pink background` 가 성 팔레트(회색 벽·붉은 지붕)와 안 겹쳐 유일하게 깨끗이 빠진다.
- 깃발: `white flag ... green background` 기본 프롬프트는 깃발 여러 개·방패가 나옴 → `single, solo, flat color, vector art` + 부정 `multiple flags, shield, emblem` 로 해결.
- HUD 바: 1216×832 로 뽑으면 띠가 여러 개 겹쳐 나옴 → 1536×640 가로로 뽑고 한 띠만 잘라 쓰는 편이 낫다.
- 배너(리본): txt2img 는 Danbooru 태그로 「곧은 가로 리본」을 못 만든다 → 파이썬으로 형태를 그려 img2img(denoise 0.6~0.68)에 넣는 것이 정답. Qwen 편집은 쓰지 않았다.
- 버튼: `empty center` 넣으면 가운데가 검은 구멍이 됨. 테두리만 쓰고 가운데는 `--fillimg`(나무결) + `--fillinset` 로 테두리 밑까지 채워야 이음새 없음.

## 파일 목록 (raw/ui)

- `gen.sh` 생성 래퍼, `post.py` 후처리(key/nine/bar/check), `preview.py` 체커 미리보기
- `build_hud.py`, `build_flag.py`, `build_parchment.py`, `build_banner.py`, `draw_ribbon.py`(리본 초안)
- `*_sN.png` 생성 원본(seed N), `*_try*.png` 후처리 후보, `preview_*.png`/`zoom_*.png` 판정용, `kit_sheet.png` 전체 시트
- 포트레이트는 인라인 파이썬(흰 배경 거리 키잉 thr 20 → 회색 톤 `g*0.75+40` → (58,52,46)→(38,34,30) 그라데이션 위 합성). 재현하려면 NOTES 의 이 줄대로.
