# 군영전 목업 — 사양·에셋 계약

> 목적: 「브라우저(Phaser)로 상용 게임급 화면이 나오는가」를 **전략맵 화면 하나**로 판정한다.
> 기능은 흉내만 낸다(실제 게임 로직 없음). 보기·움직임·소리가 전부다.
> 여러 에이전트가 동시에 만들므로 **이 문서의 파일명·크기·좌표계를 그대로 지켜라.**

## 1. 화면 규약

- 논리 해상도 **1280×720**, 폰 **가로 고정**. Phaser `Scale.FIT` + `CENTER_BOTH`, 배경 `#0b0a08`.
- 세로로 들면 「가로로 돌려 주세요」 안내 오버레이(HTML/CSS)만 보인다.
- 렌더러 WebGL(자동 폴백 Canvas). Phaser **3.90.0** — `https://cdnjs.cloudflare.com/ajax/libs/phaser/3.90.0/phaser.min.js`.
- 폰트(Google Fonts, `index.html` 에서 `<link>`; Phaser 텍스트 만들기 전에 `document.fonts.load` 로 대기):
  - 제목·큰 글씨: `'Nanum Brush Script'` (붓글씨)
  - 본문·라벨: `'Song Myung'` (고전 명조)
  - 한자: `'Noto Serif KR'` weight 900
- 모듈: `index.html` → `src/main.js` (ES module). 빌드 도구 없음. 서버는 `node tools/serve.mjs 5176`
  (`.claude/launch.json` 의 `gunyoung`). 서버에 `POST /__shot?name=x` 로 캔버스 PNG 를 `tools/shots/x.png` 에 떨굴 수 있다.

## 2. 지도 좌표계

- `src/data/cities.js` (sam3 에서 복사) — 46 도시, 논리 좌표 **1000×780**.
- 지도 그림은 **2000×1560** (`assets/map/map.jpg`). 도시 화면 위치 = `(x*2, y*2)`.
- 카메라: 드래그 팬, 휠/핀치 줌(0.6~1.6), 지도 밖으로 못 나감. 시작 줌은 세로가 딱 맞게(720/1560≈0.46 → 최소 줌 0.46).
- 지도 개형(그림 그릴 때 참고, 논리 좌표 기준):
  - 바다: 동쪽 x>870 & y<420 은 발해·황해, 남동 x>800 & y>500 동해(동중국해), 남쪽 y>740 남해. 서북 x<260 & y<300 사막.
  - 황하: 서평(198,322)~천수(298,330)~안정 위쪽~장안 북(417,300)~홍농~낙양 북(543,320)~진류 북~복양(672,330)~평원(702,285)~바다(880,300).
  - 장강: 성도 남(232,520)~강주(320,527)~영안(392,501)~강릉(519,542)~강하(610,531)~시상(679,552)~건업(758,507)~오(814,532)~바다(870,540).
  - 산맥: 진령(한중 위 y≈380, x 300~450), 태행(진양~업 사이 x≈600 세로), 파촉 분지 둘레, 남중(남만) 밀림.

## 3. 에셋 계약 (파일명·크기·형식 고정)

모두 `C:\claude\gunyoung\assets\` 아래. **투명이 필요한 것은 PNG(알파)**, 지도는 JPG(품질 90).
그림 안에 **글자·워터마크·서명이 있으면 탈락**. 원본(생성 그대로)은 `assets/raw/` 에 남겨라.

| 파일 | 크기 | 내용 |
|---|---|---|
| `map/map.jpg` | 2000×1560 | 채색 회화풍(수묵+담채) 중국 대륙 지형 지도. 산·강·숲·평야·사막·바다. **도시 표식·글자 없음.** §2 개형을 따른다 |
| `map/clouds.png` | 1024×512 | 흰 구름 안개 조각, 알파. 가장자리 투명. 지도 위를 천천히 흐르는 용도 |
| `ui/panel.png` | 384×384 | 9-slice 창틀. 모서리 **48px** 고정. 짙은 목재/옻칠 + 청동 장식, 가운데는 반투명 짙은색(알파 ~0.85) |
| `ui/parchment.png` | 256×256 | 9-slice 안쪽 종이(양피지/한지) 질감. 모서리 24px |
| `ui/button.png` | 256×96 | 버튼 보통 상태. 9-slice 모서리 32px. 목재+금테 |
| `ui/button_down.png` | 256×96 | 눌린 상태(어둡게) |
| `ui/hud_bar.png` | 1280×72 | 상단 HUD 띠. 양 끝 장식, 가운데 가로 반복 가능 |
| `ui/banner.png` | 512×128 | 제목 리본(붉은 비단+금테), 가운데 비움 |
| `ui/castle_1.png` `castle_2.png` `castle_3.png` | ≤160×160 | 성 아이콘 소·중·대(도시 size 1~2 / 3 / 4~5). 반측면(3/4 뷰), 알파 |
| `ui/flag.png` | 64×96 | 깃발 — **흰색/회색 톤**(코드에서 세력색 tint). 깃대 포함, 알파 |
| `ui/army.png` | 96×96 | 행군 부대 표식(기마 무장 실루엣 등), 알파 |
| `ui/portrait_placeholder.png` | 96×120 | 무장 초상 자리표시(실루엣) |
| `icons/gold.png` `food.png` `troops.png` `officer.png` `calendar.png` | 64×64 | 자원 아이콘(금괴·쌀가마·창검·사람·달력), 알파 |
| `icons/cmd_domestic.png` `cmd_military.png` `cmd_personnel.png` `cmd_scheme.png` `cmd_diplomacy.png` `cmd_march.png` | 64×64 | 커맨드 아이콘(괭이·창·인장·두루마리·옥새·말), 알파 |

에셋이 아직 없으면 코드는 **Phaser Graphics 로 자리표시 도형을 그려** 돌아가야 한다(에셋 로드 실패 시 폴백).

## 4. 목업 세력(가짜 데이터)

`src/data/factions.js` 에 둔다. 색은 깃발 tint·성 테두리·패널 강조에 쓴다.

| 세력 | 군주 | 색 | 도시 id |
|---|---|---|---|
| 위 | 조조 | `#3b6fd6` | 8 9 10 11 12 13 14 15 18 |
| 촉 | 유비 | `#3aa655` | 24 25 26 27 28 31 |
| 오 | 손권 | `#d9463b` | 16 17 36 40 41 42 43 |
| 원소 | 원소 | `#8e5bd6` | 2 3 4 5 6 7 |
| 마등 | 마등 | `#d6a23b` | 19 20 21 22 23 |
| 유표 | 유표 | `#3bb8c4` | 32 33 34 35 37 38 39 |
| 공손찬 | 공손찬 | `#e0e0e0` | 0 1 |
| 무주 | — | `#777` | 나머지 |

플레이어는 **유비(촉)**. 날짜 「건안 5년 3월」. 자원: 금 4,820 · 군량 61,300 · 병력 38,000 · 무장 27.

## 5. 화면 구성 (Phaser)

1. **BootScene** — 폰트 대기, 에셋 로드(진행 바). 로드 실패한 키는 기록해 두고 폴백.
2. **MapScene**
   - 지도 + 구름 2겹(속도 다르게, 알파 0.35/0.2) 흐름.
   - 도시 46개: 성 아이콘 + 깃발(세력색 tint, 살짝 펄럭임 tween) + 이름(한글, 세력색 테두리). 플레이어 도시는 은은한 빛 pulse.
   - 도로: `ROUTES` 를 점선(수로는 파란 점선)으로. 줌 0.8 미만이면 숨김.
   - 행군 데모: 성도→한중→장안 경로로 `army.png` 가 계속 움직이며 뒤에 먼지 파티클.
   - 탭/클릭 → 성이 튕기고(scale 1→1.15→1) 카메라가 그 성으로 부드럽게 이동, **도시 패널** 열림.
   - 드래그 팬, 휠/핀치 줌. 지도 경계 밖 금지.
3. **UIScene** (MapScene 위에 겹침, 카메라 영향 없음)
   - 상단 HUD: `hud_bar` + 날짜(붓글씨) + 자원 4종(아이콘+숫자, 숫자는 카운트업 애니).
   - 우측 하단 커맨드 바: 버튼 6개(내정·군사·인사·계략·외교·출진). 누르면 눌림 상태 + 짧은 효과음 + 토스트 「준비 중」.
   - 도시 패널: `panel` 9-slice, 배너에 도시명(한글+한자), 안에 parchment 위 정보(세력·태수·인구·병력·금·군량)와 태수 초상 자리, 닫기 버튼. **열릴 때 scale 0.8→1 + 알파, Back.Out 이징; 닫힐 때 반대.** 패널 뒤 지도는 살짝 어둡게.
   - 처음 진입 시 「군영전」 제목이 붓글씨로 크게 나타났다 사라지는 인트로(1.5초).
4. **효과음**: 외부 파일 없이 **WebAudio 합성**(탭 「톡」, 패널 열림 「스윽」, 버튼 「딱」). 첫 사용자 입력 뒤에 AudioContext 생성.

## 6. 그림 생성 도구 (로컬, 이미 세팅됨)

- ComfyUI `http://localhost:8188` (켜져 있음). 체크포인트 **`animagine-xl-4.0.safetensors`** (SDXL). NF4 FLUX 는 로더가 없어 못 쓴다.
- txt2img/img2img/ControlNet 클라이언트: `node C:\claude\gunyoung\tools\gen.mjs --ckpt=animagine-xl-4.0.safetensors --prompt="..." --neg="..." --w=1216 --h=832 --steps=28 --cfg=5 --seed=1 --out=파일.png [--init=그림.png --denoise=0.6]`
  - Animagine 은 Danbooru 태그. 앞에 `masterpiece, best quality, very aesthetic, absurdres`, 부정 `lowres, worst quality, text, watermark, signature, logo, blurry`. 네이티브 크기 1216×832 / 832×1216 / 1024×1024. 프롬프트 200 토큰 넘기면 무너진다.
  - 한 장 8초 안팎. ComfyUI 는 큐라서 여러 에이전트가 동시에 던져도 된다.
- 지시 편집(Qwen-Image-Edit): `"C:\pinokio\api\inteliweb-comfyui\app\env\Scripts\python.exe" C:\claude\image-edit\edit.py -i 원본.png -p "영어 지시문" --turbo -s 시드 -o 출력폴더` (한 장 30초). **모델을 갈아 끼우므로(12GB) SDXL 작업과 섞어 쓰지 말고 필요할 때 몰아서 써라.**
- 이미지 후처리(크로마키·9-slice·리사이즈·타일): `"C:\pinokio\api\inteliweb-comfyui\app\env\Scripts\python.exe"` 에 Pillow 12 + numpy 있음.
- 배경 빼기: 단색 배경(예: `simple background, green background`)으로 뽑아 색상 거리로 키잉. 경계에 배경색 번지면 1px 침식.
- 지도 등 큰 그림: 1216×832 로 뽑고 → img2img(denoise 0.35~0.45)로 1664×1280 하이레즈 → Lanczos 로 2000×1560.

## 7. 판정 기준

「상용 게임 화면처럼 보이는가」. 구체적으로:
- 웹 위젯(HTML button/select)이 화면에 **하나도** 없다.
- 창·버튼이 그려진 그림이고, 열리고 닫힐 때 움직인다.
- 지도가 그림이며 성·깃발·행군이 살아 움직인다.
- 붓글씨 제목, 효과음.
- 폰 가로(예: 844×390 논리)에서도 글자가 읽힌다.
