# 전장·이펙트·HUD 그림 제작 노트 (assets/battle/field · fx · hud)

BATTLE_ART.md §2(field 16)·§3(fx 7)·§4(hud 9) — 32 파일. 원본·후보·스크립트는 전부 `assets/raw/battle2/field/` (그림은 .gitignore, 스크립트만 저장소).
도구: ComfyUI `animagine-xl-4.0`(`tools/gen.mjs`), 파이썬 `"C:\pinokio\api\inteliweb-comfyui\app\env\Scripts\python.exe"`(Pillow·numpy·scipy), 키잉은 `assets/raw/battle/post.py key`. **Qwen 편집은 쓰지 않았다**(편 색 두 벌은 파이썬으로 같은 모양에 색만 바꿔 그렸다).
검사: `python assets/raw/battle2/field/verify.py`(크기·알파·fx 가장자리 0·seam) → ALL OK 31, `node tools/smoke.mjs` PASS, 배치 목업 `mock3.py`(BattleScene 배치를 그대로 흉내 — 브라우저 대체).

## 공통

- 생성 래퍼 `gen.sh <이름> <seed> <w> <h> "<태그>" ["<추가 부정>"] [cfg] [steps] [init] [denoise]` → `raw/battle2/field/<이름>_s<seed>.png`. 앞머리·부정은 `raw/battle/gen.sh` 와 같다. 실제로 돌린 프롬프트는 `batch1~5.sh` 그대로.
- img2img 초안 파일명은 `b2f_` 접두사(ComfyUI `/upload/image` 가 basename 으로 덮어써서 다른 에이전트와 겹치지 않게).
- 판정 그림: `sheet.py`(후보 시트), `_mock_*.png`(배치 목업), `_k*.png`·`_pyfx*.png`·`_khud*.png`.

## field/ — 항목별

| 파일 | 만든 법 | 재현 |
|---|---|---|
| `ground.png` 2048×360 **RGBA** | 파이썬 초안(가로 주기 3641px: 풀밭/흙 얼룩·가로로 흐르는 흙길+바퀴 자국 두 줄·자갈·풀 다발, 아래로 갈수록 크게) → 1536×640 창 3개(x 0·1214·2427, wrap)를 **img2img denoise 0.42 seed 11** → 0.5625배(864×360)로 줄여 181px 선형 페더로 잇고 마지막 창은 x=0 으로 감는다 → 위 34% 를 sky 지평선 크림색 (232,208,174) 안개로(0.62→0) + 위 40% 블러 + **윗변 40px 알파 페이드** | `python ground_init.py ginit 1` → `bash batch4.sh`(gj_d0.42_w0~2_s11) → `python ground_join.py ground.png gj_d0.42_w0_s11.png gj_d0.42_w1_s11.png gj_d0.42_w2_s11.png --gain=1.06 --sat=1.1 --haze=232,208,174 --hazea=0.62 --hazeh=0.34 --fade=40` |
| `mid.png` 2048×260 RGBA | 흰 배경 수묵 나무 띠 5장(mid_s2 소나무 숲 · s7 언덕 위 우산 나무 · s6 안개 속 전나무(뒤집음) · s5 비탈의 고목 · s9 바위산 나무)을 밝기→알파, 자줏빛 갈색 (54,42,54)~(146,126,136) 으로 물들여 110px 페더로 이음(가로 0.854배로 주기 2048 에 맞춤, 마지막 조각 wrap). 그 앞에 크림색 (246,233,210) 주기 잡음 안개 띠(행 200 부터 짙어져 228 아래 ~0.9). 위 30행·아래 10행 페이드. s7 오른쪽 아래 낙관·s9 붉은 점은 흰색으로 지움 | `python build_mid.py mid.png [--x2=이어붙임.png]` (조각·행 위치는 스크립트 PIECES) |
| `fog.png` 1024×160 RGBA | 파이썬: FFT 저역 잡음(가로·세로 모두 주기 → 이음 열 차 0.00), 흰색 (255,250,242), 알파 = 잡음 × sin^1.6 세로 창 × 0.92 (평균 0.13, 최대 0.74) | `python fx_build.py <dir> fog` |
| `tent.png` 175×160 | tent_s1(분홍 배경) `post.py key --bg=auto --thr=24 --ramp=14 --erode=1 --despeckle=200 --decontam` → `props.py`(분홍 기운 픽셀을 천 색으로, 210×150 맞춤, 바닥 그림자) | `python props.py k kp` |
| `palisade.png` 250×99 | palis3_s23(뾰족 말뚝 울타리, 분홍) `--thr=50 --ramp=30` → props.py (222×100, 밝기 1.12) | 〃 |
| `tree_dead.png` 178×254 | treedead_s2 `--thr=50 --ramp=30 --despeckle=100` → props.py (가지 끝 분홍 제거, 밝기 1.25 — 원본이 거의 검정) | 〃 |
| `rock1.png` 177×160 · `rock2.png` 164×171 | rockb_s11(파란 배경 밝은 바위) · rock_s2(분홍 배경 돌 두 개 — 보라 물듦을 회백색 0.7 로 빼고 바닥의 붉은 그림자 10px 잘라냄) → props.py | 〃 |
| `banner_g/b.png` 64×192 · `flag_g/b.png` 48×72 | **파이썬으로 직접 그림**(8배 슈퍼샘플): 나무 장대+금 창날, 편 색 천(g #3aa655 / b #3b6fd6 — 같은 모양·같은 주름, 색만), 금테, 가운데 밝은 원 문양(글자 없음). banner 는 가로대·붉은 술·제비꼬리·바닥 그림자, flag 는 V 홈 삼각기. **깃대가 왼쪽(x≈6 / 11), 천이 오른쪽** | `python flags.py <dir>` |
| `blood1/2.png` · `crater.png` 128×64 | 파이썬: 타원 덩어리 + fbm 잡음 문턱(가장자리로 갈수록 스스로 줄어듦) + 튄 방울, 검붉은 (58,6,8)~(132,18,14), 알파 ≤0.86 / crater 는 어두운 구덩이 + 아래쪽이 밝은 흙 테 + 방사 균열 | `python decals.py <dir>` |

## fx/ — 검정 배경 RGB(알파 없음), 맨 가장자리 행·열 = (0,0,0)

| 파일 | 만든 법 |
|---|---|
| `slash_blue.png` 512×256 · `slash_white.png` 256×128 | 파이썬 `fx_build.py crescent` — **코드 폴백(BootScene.fbFxCrescent)과 같은 기하**: 오른쪽으로 볼록, 바깥 호 중심 (0.49w, 0.5h)·반지름 0.47h·끝점 ±75°, 안쪽 호는 중심이 0.31h(흰색 0.27h) 왼쪽. 날 선 + 가로 결(날아가는 잔상)이 왼쪽으로 0.95h(흰색 0.6h) 끌린다. 파랑 (16,50,190)→(50,165,255)→(235,250,255) |
| `ring.png` 256 | 파이썬: 반지름 96(±2.5 출렁) 밝은 링 + 바깥 짧은 번짐 + 안쪽 긴 번짐·가는 결, 반지름 112~126 에서 0 으로. 거의 흰색(코드 tint 가능) |
| `speedlines.png` 1024×512 | 파이썬: 쐐기 190개(각도 16384칸), 안쪽 끝 타원 반지름 **0.16~0.42**. 코드가 hypot(W,H)/512≈2.9배로 키워 가운데 44%×49% 만 화면에 보이므로 선을 안쪽으로 당겼다(0.34~0.75 였을 땐 모서리에 몇 가닥뿐) |
| `dust.png` 128 | 파이썬: 가운데 덩어리 + 둘레 9 덩어리(콜리플라워), 저주파 얼룩, 최대 밝기 195 |
| `impact.png` 128 · `spark.png` 64 | **SDXL** spark_s1·spark_s2(`impact flash, spark burst, star burst, glowing yellow white sparks, black background`) → `fx_from_sd.py`: 가장 밝은 점 중심 정사각 크롭(반폭 427 / 321) → 바닥값 12 빼기 → 반지름 0.62~0.96 창으로 순검정까지 |
- SDXL 베기(`slashb_s1~4`·`slashw_s1~3`)는 소용돌이·가닥이 뒤엉켜 방향성 있는 초승달이 안 나왔다 → 파이썬. 먼지(dust_s1·s2)는 만화 뭉게구름·연기 줄기 — 14~46px 로 작게 찍는 용도엔 부드러운 덩어리가 낫다.

## hud/

| 파일 | 만든 법 |
|---|---|
| `portrait_<key>.png` 96×120 RGB | `hud_build.py portraits`: `cutin/<key>.png` 에서 두 눈 가운데 기준 크롭 — guanyu (452,236) 폭 250 · zhangfei (488,200) 300 · xiahoudun (440,358) 290 · dianwei (334,330) 290, 높이 = 폭×1.25, 눈이 위 1/3(y=40). 편 색 어두운 그라데이션(촉 (44,62,46)→(16,24,18) / 위 (44,54,84)→(14,18,34)) + 머리 뒤 은은한 빛 위에 합성, 가장자리 비네트. **불투명** |
| `portrait_frame.png` 112×136 · `bar_frame.png` 320×40 | `hud_build.py frames`: 둥근 사각형 SDF 베벨(4배 슈퍼샘플) — 바깥 옻칠 선 → 굵은 금 테(둥근 띠, 빛은 왼쪽 위) → 목재 홈 → 가는 금선 → 옻칠 선 → 안쪽 그림자(가운데 위에 3.5px 드리움). 색은 `ui/hud_bar.png` 실측(금 (190,122,50)/(255,240,176)/(92,52,20), 목재 (112,50,24), 옻칠 (28,8,5)). 모서리 청동 덮개+징: 초상 18px, 바 12px(= 9-slice 모서리). **테 두께 초상 8px(구멍 96×120) · 바 7px**, 변은 길이 방향으로 균일해 9-slice 로 늘려도 무늬가 안 끌린다 |
| `medallion.png` 160 | `hud_build.py medallion`: SDXL medal_s2(초록 배경 청동 고리)의 밝기만 금색 램프에 입혀 바깥 고리(반지름 52~78, 원본 무늬 유지) + 안쪽 목재 띠(36~52, 방사 나뭇결 — **게이지 호 자리**) + 금 안테(31~36.5) + 구멍 그림자. **구멍 반지름 31**(160 기준): 64px 아이콘을 같은 배율로 깔아도 구멍을 다 덮고 모서리는 테에 가린다 |
| `skill_guanyu.png` · `skill_zhangfei.png` 64 RGB | SDXL skdragon_s3(청룡 머리 정면, 크롭 82,40,942,900) · skroar_s1(포효하는 호랑이, 크롭 120,25,920,825) → 64×64 Lanczos + 대비·채도 살짝. 불투명 정사각(모서리는 메달리온이 가린다) |
- SDXL 초상 테두리(pframe_s1~3)는 타원 거울틀·가로대 있는 두 칸 틀만 나와 탈락 → 파이썬 베벨.

## 코드 쪽에 전할 수치

- **ground**: 윗변 40px 은 알파 0→1(smoothstep). 땅은 mid(깊이 2)보다 앞(깊이 3)이라 mid 가 윗변을 못 가린다 → 그림이 스스로 풀려야 y=gTop 직선이 안 생긴다. 위 34% 는 크림색 안개에 잠겨 있다(맨 윗줄 평균 (183,160,128), 아래 40행 평균 (176,143,86), 전체 평균 (160,131,85)). 「위는 어둡게」는 그림에 넣지 않았다 — 코드의 battle_shade 가 얹는다(그림까지 어두우면 밝은 하늘 밑에 검은 띠, `_mock_a.png`).
  - **BootScene.fbShade 를 고쳤다(주석 있음)**: 알파가 y=gTop 에서 0.35 로 뚝 시작하면 그 자리에 회색 직선이 다시 생겨서, 0 에서 시작해 12% 동안 0.33 까지 오르게 했다. 비교 `_mock_d_cmp.png`(위 = 0.35 시작, 아래 = 램프).
  - 가로 주기 2048(이음 열 차 1.64 vs 이웃 열 평균 1.99), 흙길은 y≈0.45~0.55H 를 가로로 흐른다.
- **mid**: 아래 변 = gTop+20(현재 코드 그대로)에 맞춰 그렸다 — 행 240 이 땅 윗변. 나무 밑동·far 봉우리 밑동은 안개 띠에 잠긴다. far 의 짙은 먹보다 어둡게 칠해(가장 짙은 곳 (54,42,54)) 앞뒤가 뒤집혀 보이지 않는다.
- **소품**: 물체 바닥선이 캔버스 높이의 94%(코드 origin 0.94 와 일치), 그 아래 6% 에 그림자 타원(알파 0.42, (22,14,20)). 크기는 병사 표시 키 47px·현재 PROPS 배율 기준: 막사 0.9배 → 표시 144px, 목책 0.8배 → 79px, 고목 0.85배 → 216px, 바위 0.5배 → 80px. 전부 왼쪽 위에서 빛을 받는 그림이라 flipX 해도 어색하지 않다.
- **banner**: 장대 바닥 y=186/192(0.969), 바닥 그림자 중심 y=187 — origin (0.5, 0.98) 에 맞다. 장대 x=11. **flag**: 장대 x=6, 천은 y 7~37, 깃대 끝 y=71.
- **fx**: slash 두 장은 폴백과 같은 기하라 위치·회전 값 그대로. ring 은 링 반지름이 캔버스의 37.5%(96/256) — 「지름 range」 로 맞추려면 표시 폭 = range×256/192. spark/impact 는 방사 대칭이 아니어서 랜덤 회전이 잘 먹는다.
- **medallion**: 160 기준 구멍 r31 · 금 안테 31~36.5 · 목재 띠 36~52 · 청동 고리 52~78. 게이지 호는 반지름 44±7 안에 그리면 목재 띠 위에 얹힌다(현재 코드 164px 표시·arcR 50·arcW 9 → 160 기준 44.4~53.2 — 띠 바깥 1px 이 고리에 걸친다, arcR 48 이면 딱 맞다).
- **bar_frame**: 안쪽 그림자까지 치면 채움은 inset 7~8 이 맞다(현재 코드 8).
- **초상**: 96×120 그대로 테두리 구멍(96×120)에 들어간다 — 표시 비율 72×90 : 84×102 도 같은 비(테 6px)라 어긋나지 않는다.

## 실패 기록 (다음에 피할 것)

- **땅을 txt2img 로**: `dry grass, sunset lighting` 은 역광에 빛나는 풀숲(검은 바탕+주황 하이라이트), `battlefield ground, mud tracks` 는 어두운 사막 모래결 — 둘 다 담채 하늘과 안 붙는다. **팔레트를 파이썬 초안으로 못 박고 img2img(denoise 0.42)** 가 정답. 0.50 은 길이 사라지고 창마다 구조가 갈렸고(한 창은 소실점으로 뻗는 바퀴 자국), 0.62 는 `wheel tracks` 를 **진짜 수레바퀴**로 그렸다 → 프롬프트는 `dirt path, ruts in mud` + 부정 `wheel, cart, wagon`.
- **깃발**: `war banner, tall vertical banner …`(640×1536)·`single green flag …`(832×1216) 세 seed 전부 실패(액자 속 줄무늬, 깃발 여러 개, 벡터 리본) → 파이썬으로 그림. 작은 스프라이트(64×192, 48×72)는 직접 그리는 편이 선이 깨끗하다.
- **목책**: `wooden palisade, cheval de frise`(s1~3)는 밧줄 묶은 통나무 기둥·문틀·통나무 더미, `stockade wall … blue background`(s11~14)는 화면 밖으로 잘린 울타리. `short wall of sharpened logs, pointed tips, … full object, wide margin` + 부정 `cropped, flat top` 의 s23 만 뾰족 말뚝 울타리가 화면 안에 다 들어왔다.
- **분홍 배경은 회색 물체를 물들인다**: rock_s1·s4 는 보라색 바위. 바위는 `blue background` + `light grey stone`(rockb) 가 깨끗하다. 분홍 배경 막사는 천 (191,141,105) 이 배경 (249,128,150) 과 거리 ~75 라 `--thr=50 --ramp=30` 에 몸통이 반투명 얼룩이 됐다 → `--thr=24 --ramp=14`.
- **중경 나무 띠**: `treeline, forest, trees`(s1·s3·s4)는 굵은 나무줄기 클로즈업. `distant treeline … far away … fog bank below` 도 절반은 줄기 숲 — 10장 뽑아 5장 채택. 수묵 프롬프트라 낙관(s7)·붉은 점(s9)이 또 나왔다 → 조각 상자를 흰색으로 지움. s5 는 배경이 회색(밝기 ~0.85)이라 흰색 기준 0.80 으로 펴지 않으면 조각 상자가 뿌옇게 보인다(`_mid_prev.png` 첫 판).
- **mid 의 안개를 땅 앞에 두는 설계는 틀렸다**(첫 판: 안개 띠 가운데를 지평선에, 아래 25px 페이드) — 코드에서 mid 는 땅 뒤다. 땅 윗변은 땅 그림의 알파 페이드 + fog 뒤층이 흐린다.
- speedlines: 각도 색인 4096 칸은 먼 곳에서 가는 선이 점선으로 깨졌다 → 16384 칸 + 최소 굵기 ×1.7 + 블러 1.3. 거의 수평인 가는 선 한두 가닥은 아직 살짝 끊겨 보인다(0.6 알파로 1.5초 도는 배경이라 그대로 둠).
- 데칼을 알파 창으로 둥글게 자르면 잘린 호가 보인다 → 잡음 문턱 전에 가장자리 쪽 값을 깎아 덩어리가 스스로 줄어들게.

## 파일 목록 (raw/battle2/field)

- 생성: `gen.sh`, `batch1.sh`(질감·mid 1~4·소품·깃발·핏자국·fx·HUD 틀·아이콘 1차), `batch2.sh`(땅 img2img 1차 0.50/0.62 · mid 5~10), `batch3.sh`(목책 2차·바위 파란 배경), `batch4.sh`(**땅 채택분** 0.42), `batch5.sh`(**목책 채택분** palis3)
- 조립: `ground_init.py` → `ground_join.py`, `build_mid.py`, `props.py`(← `k/*.png` 키잉본), `flags.py`, `decals.py`, `fx_build.py`, `fx_from_sd.py`, `hud_build.py`
- 검사: `verify.py`, `sheet.py`, `mock2.py`(첫 배치 가정), `mock3.py [--ramp]`(BattleScene 배치 그대로, 줌 1.15 컷 3장 — `_mock_d.png`·`_mock_d_ramp.png`·`_mock_d_cmp.png`)
- 채택 원본: `gj_d0.42_w0~2_s11` · `mid_s2·s5·s6·s7·s9` · `tent_s1` · `palis3_s23` · `treedead_s2` · `rockb_s11` · `rock_s2` · `spark_s1·s2` · `medal_s2` · `skdragon_s3` · `skroar_s1`

## 통합 회차 (검수 should → 통합 담당 처리, 2026-09-19)

| 지적 | 처리 | 확인 |
|---|---|---|
| `portrait_guanyu` 가 넷 중 가장 어둡고 얼굴이 작다(눈이 y≈60) | `hud_build.py` PORTRAITS 에 얼굴 감마(5번째 값) 추가, guanyu = 실제 두 눈 가운데 (445,292)·폭 190·감마 0.72 | 가운데 상자(24~72 × 30~90) 밝기 61 → 93 (나머지 121~149), 눈 y≈38. 나머지 세 장은 다시 만들어도 바이트 동일 |
| `medallion` 바깥 윤곽이 이가 빠짐(r 74~78 알파<128 이 21~48%) | `hud_build.py medallion` 끝에 r75 SDF 원 마스크 + 옻칠 선 1.4px | `_integ_hud_sheet2.png` — 깨끗한 원. 지름 150/160 |
| `tree_dead` 그림자가 오른쪽 변에서 잘림 + 가지 끝 연어색 프린지 | `assets/raw/battle2/_integ_fix_edges.py`: 그림자 행(y≥220·알파<128)만 오른쪽 16열 알파 램프, R>150·R−G>60 픽셀 843개 → (52,30,34) | 오른쪽 열 알파 max 0 |
| `banner_g/b` 그림자가 왼쪽 변에서 잘림(알파 37) | 같은 스크립트: y≥178·알파<128 만 왼쪽 8열 램프 | 왼쪽 열 알파 max 0 |
| `bar_frame` 덮개가 9-slice 모서리 12 를 1~2px 넘음 | 그림은 그대로, 코드·smoke 의 모서리를 **14** 로(12 로 자르면 늘어나는 구간 열 차 255, 14 면 3) | `BattleHud.HUD_LAYOUT.bar/gen.corner`, smoke |
| 계약 문서에 ground RGBA·그늘 램프가 없음 | `docs/BATTLE_ART.md` §2·§5·§6, `BootScene.fbShade` JSDoc, `field_ground` 알파 필요 = true | smoke |
| 그대로 둔 것 | tent 분홍 띠(재어 보니 2px), rock·tent·flag 가 캔버스 변에 닿음 | HANDOFF §9.7 남은 should |

원본은 `assets/raw/battle2/field/_integ_old/`(portrait_guanyu·medallion·tree_dead·banner_g/b). 재현: `python hud_build.py <outdir> portraits medallion` → 두 파일 복사, `python ../_integ_fix_edges.py`(백업본에서 읽어 제자리에 쓴다 — 두 번 돌려도 같다).

코드 쪽 수치 정정(통합 실측 `assets/raw/battle2/_integ_hud_probe.py`·`_integ_measure.py`): 메달리온 **목재 띠는 r 37~50**(160 기준, 그 밖 50~52 는 홈·52~75 는 청동 고리) → 게이지 호 arcR 45·굵기 9(164px 표시) — 위 「36~52」 는 홈까지 친 값이다. 링 그림의 가장 밝은 반지름 95/128 → `RING_FILL` 0.74. 진영 깃발 origin (0.17, 0.97), 소품 바닥선 0.936~0.939(코드 0.94).
