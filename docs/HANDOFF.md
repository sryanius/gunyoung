# 군영전 목업 — 인수인계 (통합 시점)

> 기준 문서: `docs/SPEC.md`. 이 문서는 「지금 어디까지 됐고, 어떻게 돌리고, 무엇이 남았나」만 적는다.
> 2026-09-18 브라우저(폰 가로 844×390 에뮬레이션)에서 확인했다 — §8. 스크린샷은 `tools/shots/phone_*.png`.

## 1. 현재 상태

| 항목 | 상태 |
|---|---|
| 에셋 27개 (map 2 · ui 13 · icons 11 + NOTES 3) | 전부 존재, 계약 크기 일치 — `node tools/smoke.mjs` 로 헤더 검증 |
| 코드 (`src/` 7 파일, `index.html`) | node --check 통과, Phaser 스텁 import 통과. 에셋이 없어도 BootScene 이 자리표시 텍스처를 만들어 돈다 |
| 통합 수정 | 실제 에셋 크기·알파 경계에 맞춰 성/깃발/부대/HUD/버튼/패널 배치 수치 조정 (§4) |
| 검수 should 항목 | 코드 5건 전부 반영. 에셋 미감 항목은 미반영(§5) |
| 브라우저 확인 | 폰 가로 844×390 에서 확인 (§8). 실기 폰은 아직 |

## 2. 실행

**배포:** GitHub `sryanius/gunyoung` (Pages, 브랜치 master, 루트) → https://sryanius.github.io/gunyoung/
`git push` 하면 1~2분 뒤 반영된다. 원본 그림(assets/raw/*.png·jpg, 241MB)은 .gitignore 로 제외 — 이 PC 에만 있다.


```
cd C:\claude\gunyoung
node tools/serve.mjs 5176        # http://localhost:5176  (.claude/launch.json 의 gunyoung 과 같음)
node tools/smoke.mjs             # 에셋 계약·문법·import·데이터·9-slice 제약 검사 (브라우저 불필요)
```

- `python -m http.server` 는 쓰지 마라 — 캐시 헤더가 없어 고친 소스가 안 뜬다. serve.mjs 는 no-store.
- 콘솔에서 `__shot('이름')` → `tools/shots/이름.png` 로 캔버스 저장(서버 `/__shot`). 헤드리스 확인용.
- 폰트는 Google Fonts CDN. 오프라인이면 4초 뒤 폴백 폰트로 진행한다(BootScene.waitFonts).

## 3. 에셋 재생성

각 그룹 NOTES 에 프롬프트·seed·후처리 명령이 그대로 있다. 원본·후보·스크립트는 `assets/raw/<그룹>/`.

- 지도·구름: [`assets/map/NOTES.md`](../assets/map/NOTES.md) — `raw/map/sketch.py` 색 스케치 → img2img(d0.5 s33) → 1664×1280 img2img(d0.45 s5) → `finalize.py` Lanczos 2000×1560.
- UI 키트: [`assets/ui/NOTES.md`](../assets/ui/NOTES.md) — `raw/ui/gen.sh` + `post.py`(key/nine) + `build_*.py`. 성은 분홍 배경 키잉, 배너는 `draw_ribbon.py` 초안의 img2img.
- 아이콘: [`assets/icons/NOTES.md`](../assets/icons/NOTES.md) — `raw/icons/draw_icons.py <출력폴더> [이름]` (Pillow 직접 그리기, SDXL 탈락).
- 파이썬은 `"C:\pinokio\api\inteliweb-comfyui\app\env\Scripts\python.exe"` (Pillow 12 + numpy + scipy). Animagine 은 seed 44/55/66 계열에서 낙관·서명이 박히니 부정 프롬프트에 `seal, stamp, calligraphy, chinese text, kanji` 를 넣고 모서리를 원본 해상도로 확인할 것.
- 통합용 배치 목업(브라우저 대체): `python assets/raw/ui/integration_mock.py` → `raw/ui/integration_mock_{screen,map_z1,map_zmin}.png`. 코드와 같은 수치로 Pillow 합성(폰트·9-slice 는 근사).

## 4. 통합에서 손본 것 (코드 ↔ 실제 에셋)

측정값(알파 경계, Pillow): castle_1/2/3 = 112/136/160px, 알파 폭 88/128/131 · flag 깃대 x≈20 밑동 y≈94 · army 오른쪽 향함, 발굽 y≈93 · hud_bar 메달리온 x 35~85 / 1195~1245, 나무 띠 y 20~49 · banner 리본 중심 y 63.5.

MapScene
- 성 배율 `CASTLE` = castle_1 0.55 / castle_2 0.52 / castle_3 0.70 → 줌 1 표시 폭 ≈ 48 / 67 / 92px. origin (0.5, **0.88**) = 성터 가운데가 도시 좌표.
- 깃발 origin (**0.31, 0.98**)(깃대 밑동), 위치 (dw×0.30, top×0.68) = 성 위 오른쪽 지붕. 배율 0.42/0.46/0.52. 펄럭임 tween 은 깃대 기준으로 천만 줄어든다.
- 이름 y = 성터 아래 끝 + 3. 탭 영역은 성 꼭대기−10 ~ 이름 아래.
- 빛 무리(플레이어)·선택 링 위치 = 성 시각 중심(top×0.45), 배율은 성 폭 비례. `nodeById` 로 id→노드.
- 부대 `ARMY_SCALE` 0.6, origin (0.5, 0.95). 폴백 Shape 에는 setFlipX 가 없어 scaleX 로 뒤집는다.
- 구름 tileSprite 를 절반 크기 ×2 배율로(캔버스 25MB→6MB), 속도 절반, 둘째 겹 flipX(대각선 결 반복 완화).
- 핀치 끝나면 남은 손가락으로 드래그를 이어 간다.

UIScene (`LAYOUT` 을 export — smoke 가 9-slice 제약을 검사)
- HUD: 한 줄 배치(y 36). 달력 x 118, 날짜 36px, 자원 4칸 x 350 부터 172 간격(날짜 실측 폭이 넓으면 밀림), 아이콘 **28px**, 라벨 20px + 숫자 26px, 플레이어 표식 x 1050. 메달리온(x<100, x>1180) 비움.
- 커맨드 버튼 **124×64**, 9-slice 모서리 28(그림 32; 높이 64 라 28), 아이콘 **32px**, 라벨 24px. 바 820×100.
- 패널 520×500 (980,350). 배너 0.82 배 y −222(창틀 위로 24px 걸침), 강조선 −158, 한지 440×360 y 34, 닫기 (232,−224), 안내문 y 234·20px.
- 폰 가독성: 16px 였던 글자를 전부 20px 이상으로.
- factions.js `KOREAN_SAMPLE` 에 '창밖을' 추가. **새 문구를 넣으면 표본에도 넣어라** — smoke 가 UIScene/MapScene 문자열 리터럴의 한글·한자를 표본과 대조한다.
- BootScene.ASSETS 의 castle 크기 112/136/160 으로(자리표시 크기도 동일).

## 5. 검수에서 'should' 로 남은 미감 문제 (에셋, 미반영)

지도 `map.jpg`
- 서북 사막·북부 평야가 밋밋하다 → sketch.py 에 모래 언덕 글리프·저주파 얼룩 추가 후 1·2단계 재생성, 또는 종이 결 노이즈 3~4%.
- 강이 균일 두께 벡터 띠 느낌, 황하·장강 색 구분 없음 → 상류 얇게·하류 굵게, 황하는 황토빛, 프롬프트에 `ink outline river, painted riverbank`.
- 태행산맥이 얇음 → `ridge(..., 18)` → 24~28, 봉우리 밀도 1.5배. 진령을 y 360~390 으로 내려 장안이 산 위에 앉지 않게.
- 바다 연안 밝은 띠가 후광처럼 보임, 남해 띠 얇음 → 포말선·파도 글리프, 원해 물결 밀도 낮춤.
- 강하·시상 사이 강이 매듭처럼 되감김 → 동정호 타원 하나로 합치고 장강을 단조 곡선으로.
- `clouds.png` 윤곽이 선명한 적운 + 대각선 결 → 알파 가우시안 블러 6~10px, 또는 `thin mist, haze` 로 재생성. (코드는 둘째 겹을 flipX 해 두었다.)
- `raw/map` 121MB 후보 전량 보관 → 탈락 후보는 `_discard/` 로(.gitignore 에 넣어 둠).

UI
- `castle_1.png` 벽면이 분홍 배경에 물들어 연보라(마젠타 11%) → 부정 프롬프트 `pink walls, purple walls, lavender` 로 재생성하거나 벽 픽셀 채도 ≤0.3.
- `army.png` (39,29) 5px 흰 점 등 키잉 잔여 조각, castle_2 (113,75)·castle_3 (58,3)·hud_bar (297,0) 도 → post.py 에 despeckle(8px 미만 성분 제거).
- `hud_bar.png` 가운데는 반복 타일이 아님 → 1280 폭 그대로 쓰는 중(문제 없음). 다른 폭이 필요하면 양끝 150px 3-slice.
- `panel.png` 위·아래 변 청동 띠에 좌→우 밝기 그라데이션 → 늘리면 좌우 밝기 차. 선택 사항.
- `button.png` 높이 64 미만으로 쓰지 말 것(모서리 32) — 코드는 64.

아이콘
- `calendar.png` 모던 벽걸이 달력(스프링 고리) → 죽간/한지 달력 등 시대풍으로.
- `cmd_scheme.png` 두루마리가 한쪽 축만 → 양끝 축.
- `cmd_diplomacy.png` 옥새가 초록 상자로 읽힘, cmd_personnel 과 유사 → 손잡이 짐승 실루엣 키우고 인면 강조.
- `cmd_military.png` 극 자루가 가늘어 32px 에서 선 하나 → 자루 1.5배.
- `food.png` 48px 이하에서 항아리로 보임 → 입구 쌀 더미 키우기.

## 6. 브라우저에서 꼭 확인할 지점 (아직 안 봄)

1. **성·깃발·이름 배치** — 줌 1 에서 대도시 성 폭 ≈90px 인지, 깃발 깃대가 성 위 오른쪽 지붕에 꽂혀 보이는지(origin 0.31/0.98 이 맞는지), 이름이 성터 바로 아래인지. 낙양·홍농·진류·허창 밀집 구간에서 겹침 정도.
2. **HUD 한 줄** — Nanum Brush 날짜 폭에 따라 자원 칸이 밀리는지, 4칸이 플레이어 표식(x 1050) 앞에서 끝나는지, 글자가 나무 띠(y 20~49) 위에 오는지, 메달리온과 안 겹치는지.
3. **패널** — 배너가 창틀 위 변에 걸치는 모양, 도시명(붓글씨+한자)이 리본 가운데인지, 열림/닫힘 Back 이징, 뒤 지도 어두워짐, 닫기 ×가 배너 꼬리와 안 겹치는지.
4. **구름·행군** — 절반 크기 ×2 tileSprite 가 WebGL 에서 이음새 없이 흐르는지(1024×512 POT), flipX 겹이 정상인지, 부대가 성도→장안 길 위(발굽 기준)로 가고 되돌아올 때 뒤집히는지, 먼지 파티클 위치.
5. **폰 가로 844×390 + 터치** — FIT 배율 0.54 에서 20px 라벨이 읽히는지, 핀치 → 한 손가락 팬이 끊기지 않는지, HUD/커맨드 바 위를 지나는 드래그가 멈추는 현상(UIScene bar.setInteractive) 이 거슬리는지, 효과음 4종(첫 입력 뒤).

추가로: Canvas 렌더러로 강제(`type: Phaser.CANVAS`)했을 때 nineslice 대신 늘린 이미지 폴백이 보기 괜찮은지, 에셋 폴더를 비웠을 때 자리표시로 전 화면이 도는지.

## 7. 다음 할 일

1. 브라우저 확인(§6) → 배치 수치(`MapScene.CASTLE`, `UIScene.LAYOUT`) 미세 조정.
2. §5 에셋 미감 항목 중 castle_1 벽색·despeckle·달력은 값싸다 — 먼저.
3. 지도 재생성은 sketch.py 수정 후 두 단계 img2img 를 다시 돌려야 하므로 나머지 지도 항목을 한 번에 모아서.
4. 판정(SPEC §7): 웹 위젯 0개(HTML 은 세로 안내뿐) · 창/버튼 그림+애니 · 지도/성/깃발/행군 · 붓글씨 제목 · 효과음 · 폰 가독성 — 브라우저에서 스크린샷으로 남길 것(`__shot`).

## §8. 브라우저 확인 결과 (2026-09-18, 844×390 에뮬레이션)

**돌아간다.** 콘솔 오류 0. 인트로 → HUD 카운트업 → 성 탭 → 패널 열림/닫힘 → 커맨드 버튼 전부 동작.
스크린샷: `tools/shots/phone_start.png`(시작 화면) · `phone_panel.png`(성도 패널) · `phone_toast.png`.

폰에서 드러나 고친 것:
1. **좌우 검은 띠** — 1280×720 FIT 는 19.5:9 폰에서 양쪽 75px 씩 비었다. `main.js` 가 창 비율로 논리 폭을 1280~1600 사이에서 정한다(844×390 → 1558). `UIScene` 은 `this.scale.width` 로 오른쪽 요소(HUD 플레이어 표식·커맨드 바·패널)를 잡고, hud_bar 는 양 끝 150px 고정 가로 3-slice.
2. **시작 줌** — 지도 전체(MIN_ZOOM 0.46)를 띄우면 폰에서 성 25px·이름 11px 로 안 읽힌다. `START_ZOOM 0.9`, 성도(id 26) 기준 오른쪽 위로 치우쳐 한중·장안까지 보이게.
3. 도시 이름 24 → 28px.
4. smoke 의 해상도 검사를 「세로 720 · 가로 1280~2400」 으로.

실기 폰(Samsung Internet, 세로 고정 폰을 가로로 돌림)에서 본 뒤 더 고친 것:
5. **주소창 때문에 가로가 2.8:1 까지 넓어져** 1600 상한으로는 좌우 띠가 남았다 → 상한 2400. 창 비율이 바뀌면(회전·주소창·전체 화면) `relayout()` 이 `scale.setGameSize` 로 논리 폭을 다시 정하고 UIScene 을 인트로 없이 재시작한다(`scale.resize` 는 FIT 에서 표시 크기를 안 고친다 — 실측).
6. **세로 고정 폰 대응** — 세로 안내에 「전체 화면으로 시작」 버튼, 터치 기기는 게임 **첫 터치를 뗄 때(pointerup)** `requestFullscreen` → `screen.orientation.lock('landscape')`. 터치의 pointerdown 은 사용자 활성화를 안 줘서 requestFullscreen 이 조용히 거부된다(검토에서 잡힘 — HTML 표준·Chromium 소스 확인). 전체 화면 안에서는 시스템 자동 회전이 꺼져 있어도 가로로 잠긴다(Android Chrome·Samsung Internet; iOS 는 둘 다 미지원이라 조용히 넘어감). Back 으로 전체 화면을 나가면 잠금이 풀려 세로 고정 폰은 다시 세로 안내로 돌아간다. 열려 있던 패널은 재배치 뒤 다시 열린다(`reopen`).
7. `manifest.webmanifest`(display fullscreen · orientation landscape) + 아이콘(`tools/make_icons.py`) — 「홈 화면에 추가」 하면 앱처럼 가로 전체 화면으로 뜬다.

개발 환경 메모: 데스크톱 앱의 Browser 패인이 **숨겨져 있으면 rAF 가 멈춰** 게임이 프레임 21 에서 정지한 것처럼 보인다(코드 문제 아님).
검증할 때는 콘솔에서 `const l=__game.loop; l.stop(); l.forceSetTimeOut=true; l.useRAF=false; l.start(__game.step.bind(__game))` 로 setTimeout 루프로 바꾸면 돈다. 실기·일반 브라우저는 해당 없음.

남은 미감 항목(검수 should + 이번에 본 것):
- 낙양·홍농·허창·진류·여남 밀집 구간에서 이름이 이웃 성에 가려진다(허창·진류). 밀집 구간만 이름을 성 옆으로 빼거나 castle 배율을 0.9배.
- castle_1 벽면 연보라 톤, army/castle 잡티 몇 픽셀 (assets/ui/NOTES.md).
- 지도 서북 사막·북부 평야가 밋밋, 강이 벡터 느낌, 태행산맥 얇음 (assets/map/NOTES.md).
- 구름 가장자리가 선명해 대각선 결이 보임 → 알파 블러 6~10px.
- 실기 폰(터치·핀치·효과음·폰트 로드)은 아직 안 봤다. GitHub Pages 에 올리면 바로 볼 수 있다.
