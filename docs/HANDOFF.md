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

## §9. 전투 프로토타입 (2026-09-18 통합) — 브라우저(폰 가로 844×390 에뮬) 확인 완료

**확인한 것(2026-09-18):** 지도 「출진」 → 전투 인트로 → 돌격 버튼 → 42초 격돌(아군 97/적 94) → 청룡참(컷인·플래시·부채꼴, 적 94→84) → 63초 승리 패널(남은 병력·시간·무장기 2회) → 「지도로」 → 지도 + 토스트 「승리! 적을 물리쳤습니다」. 콘솔 오류는 없는 컷인 2개의 404 뿐. 스크린샷 `tools/shots/battle_clash.png`·`battle_skill.png`·`battle_result.png`.
fps 는 데스크톱 앱 Browser 패인이 setTimeout 루프(≈36fps 상한)라 못 잰다 — 실기 폰에서 볼 것. 키보드 「1」(돌격)은 패인에서 안 먹었다(캔버스 포커스 문제로 추정, 폰과 무관).
실기 미확인: 조이스틱 손맛, 실제 fps, 컷인 타이밍 체감, 결과 패널 글자 가독성.

> 사양은 `docs/BATTLE.md`(통합에서 §1 승패·§2 규칙·§2.1 덧붙인 필드·§3 표를 코드 값으로 갱신). sim·view·art 를 따로 만들고 통합에서 계약을 전수 대조했다.
> 검증은 전부 node 로만 했다(`smoke` 194 ok · `battle-bench` PASS · `view-check` 44 ok). 그림이 실제로 어떻게 보이는지는 §9.6 을 브라우저에서 봐야 안다.

### 9.1 파일 구성

| 파일 | 역할 |
|---|---|
| `src/battle/data.js` | 병종·상성·무장·무장기·편성(ARMY_LEFT/RIGHT)·FIELD·FORMATION·GAUGE·TUNE. 벤치로 다듬은 값마다 「왜」 주석 |
| `src/battle/sim.js` | `createBattle({seed,left,right,aiControlled})` — BATTLE.md §2.1 API + 덧붙임(`playerOf`·`skillCount`·`unitById`·`commandOf`·`countInitial`·`sides`·`tick`, `TICK_MS` export, `Unit.alive/dataId/key/color`, `result.time`, `hit.skill`, `death.by`). Phaser/DOM/Date/Math.random 없음, mulberry32, 64px 격자, 고정 틱 16.7ms 누적기 |
| `src/battle/BattleScene.js` | 배경 3겹 패럴랙스, 유닛 Sprite 풀 260, 그림자 Graphics 하나, 코드 연출, 카메라, 가상 조이스틱(매 프레임 포인터 폴링)·키보드, sim 동적 import(실패 시 `assets/raw/battle/sim-stub.mjs` 더미, 둘 다 실패면 토스트 + 지도로) |
| `src/battle/BattleHud.js` | 병력 바·시간·무장 4명 HP·무장기 원형 버튼·병법 3버튼·인트로·결과 패널·컷인 호출. `HUD_LAYOUT` export(smoke 검사) |
| `src/battle/fx.js` | 베기 궤적·화살·먼지/불꽃 파티클·피해 숫자·넉백 잔상·광역 범위 표시·`cutin()` |
| `tools/battle-bench.mjs` | 헤드리스 벤치(§9.3). `--seeds=a-b --player --verbose --secs=N` |
| `tools/smoke.mjs` §6 | battle import·sim 계약·HUD 9-slice·에셋 크기(납품 10개는 필수)·FIELD 일치·폰트 표본(sim.js 문구 포함) |
| `assets/raw/battle/view-check.mjs` | Phaser 흉내 + 진짜 sim 으로 create→인트로→입력→병법→무장기→종료→결과→relayout→지도로 (개발용, 배포물 아님) |
| `assets/battle/` | sky·far·ground·cutin/guanyu·zhangfei·units/6종 (BATTLE.md §5 12개 중 10개 — 컷인 하후돈·전위는 없음) + `NOTES.md`(레시피·실측·실패 기록) |
| `assets/raw/battle/` | `post.py`(key/sky/far/ground/seam/sheet/check — 통합에서 `--bgkeep` 추가)·`build_far.py`·`mock.py`·`verify_cutin.py`·`gen.sh`·`batch_*.sh`·`sim-stub.mjs`·`_integ_check.py`(에셋 실측). 그림은 .gitignore |
| 기존 코드 수정 | `main.js`(씬 5개, relayout 이 BattleScene.applyBounds + BattleHud restart) · `BootScene.js`(BATTLE_ASSETS 선택 로드, 코드 텍스처 unit_*/arrow/spark, 배경 캔버스 폴백) · `UIScene.js`(「출진」→`startBattle()`, 토스트 데이터) · `MapScene.js`(launch 데이터, `city:close` 리스너 off) · `sfx.js`(hit·skill) · `factions.js`(폰트 표본) — 전부 최소 수정 + 이유 주석 |

### 9.2 실행·조작

- 지도의 커맨드 「출진」 → `BattleScene({ seed })` (seed = 출진 횟수, registry `battleCount`). 「전투 개시」 1.2초 뒤 시작. 시작 명령은 「대기」, 적 AI 는 5초 뒤 「돌격」 — **먼저 「돌격」을 눌러야** 병사가 나간다(대기로 두면 관우 혼자 적진에 들어가 죽는다).
- **폰**: 화면 왼쪽 반(HUD 아래 y≥132)을 누르면 그 자리에 조이스틱(반지름 70 논리 → 폰 38px, 데드존 12 → 6.5px) → 관우 이동. 오른쪽 아래 원형 **무장기 버튼**(⌀112, 게이지 호, 100 이면 빛남·펄스, 모자라면 떨림). 그 위 **돌격/대기/후퇴**(150×72, 현재 것 눌림 유지). 관우는 사거리 안 적을 자동 공격, 입력 0 이면 제자리.
- **키보드**: WASD/화살표 이동, Space 무장기, 1/2/3 = 돌격/대기/후퇴.
- 무장기 게이지: 적중 +3, 무장에게 맞으면 +1.5, 병사·화살 +0.1 — 난전에서 20초쯤. 관우 hp 는 3초 안 맞으면 초당 6 회복 → **적 무장 앞에 서 있기만 하면 30초에 hp 34/700 (벤치)**. 빠졌다 돌아오는 게 요령인데 화면엔 안내가 없다(§9.5).
- 결과 패널: 「다시」(같은 seed 재시작) / 「지도로」(MapScene 재시작 + UIScene 토스트 「승리!…/패배…/무승부…」, 인트로 없음).
- 검증: `node tools/smoke.mjs` · `node tools/battle-bench.mjs [--player] [--seeds=1-10]` · `node assets/raw/battle/view-check.mjs`. 에셋 실측: `python assets/raw/battle/_integ_check.py`.

### 9.3 벤치 결과 (통합 후 최종, `node tools/battle-bench.mjs --player`)

| seed | 종료 | 승자 | L | R | 무장기 L/R | 틱 avg | p99.9 | max | 사유 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 68.4s | right | 2 | 27 | 3/3 | 0.044ms | 0.75ms | 3.05ms | 적 병력 전멸·도주 |
| 2 | 68.5s | left | 32 | 1 | 3/2 | 0.043ms | 0.35ms | 2.04ms | 〃 |
| 3 | 76.1s | right | 2 | 21 | 3/3 | 0.038ms | 0.14ms | 0.23ms | 〃 |
| 4 | 71.2s | right | 2 | 32 | 4/3 | 0.039ms | 0.11ms | 0.26ms | 〃 |
| 5 | 71.6s | left | 19 | 1 | 4/3 | 0.040ms | 0.15ms | 0.32ms | 〃 |

- 5판: 종료 5/5, 평균 65.7 → **71.2s**(통합 sim 수정 뒤), 승 L2 R3, 틱 평균 0.041ms · p99.9 0.75ms · 최대 3.05ms(첫 틱 JIT). 이벤트 합 hit 16998 · arrow 3095 · death 994 · flee 87 · skill 31 · knockback 840.
- 10판(`--seeds=1-10`): 종료 10/10, 평균 **68.8s**(56.4~76.1), 승 **L5 R5**, 틱 평균 0.041ms · p99.9 0.84ms.
- 결정성: seed 1 두 번 hp 합 3905.9 / x 합 375900.789 같음. 프레임 dt 16.7/33/50/100 전부 승자·`result.time` 동일(sim 검수).
- 후퇴 시나리오(seed 1, 20초 돌격 → 후퇴 40초): 살아 있는 230, **벽(x≤1/≥3199)에 붙은 병사 0**, 무장 x L425·431 / R2768·2770.
- `--player`(seed 1, 30초 관우 조작): 24.5s 청룡참 적중 18 · 즉사 17, 30초 뒤 hp 34/700, 보통 공격 21 · 피격 317, 병력 L107 R97.
- 기준(BATTLE.md §6): 전부 종료 ✓ · 평균 60~120s ✓ · 틱 ≤2ms ✓ · 양쪽 승 ✓ · 결정성 ✓ · 벽 0 ✓ → PASS.

### 9.4 통합에서 손본 것

**sim ↔ view 계약 대조** — view 가 읽는 Unit 필드(id·side·kind·state·facing·x·y·attackT·hp·maxHp·gauge·name·skill·dataId)·이벤트 8종의 필드·result·메서드 7개 전부 sim.js 와 이름까지 일치, 어긋난 곳 0. 계약 밖 사용은 전부 존재 검사 뒤 폴백(`playerOf`·`skillCount`·`result.time`·`hit.skill`). 실제 `sim.js` 가 먼저 로드되고 더미(`sim-stub.mjs`)는 import 실패 때만.
- sim 에 `Unit.key`(무장 데이터 key 'guanyu') 추가 — view 가 컷인 텍스처 `cutin_<key>` 를 군 데이터를 뒤지지 않고 찾는다(view 요청). 없으면 이전 방식(data key → 문자열 id → 순서) 폴백.
- `normSkill` 이 `coneDeg`·`pathWidth` 를 통과시켜 fx.area 가 데이터대로 부채꼴 100°·돌진 폭 70 을 그린다(전엔 100°·96 고정).
- FIELD 상수가 둘(data.js `FIELD.W/GROUND_TOP`, BattleScene `FIELD.w/top`) — smoke 가 일치를 검사한다.

**에셋 실측 → 코드**(파이썬 `_integ_check.py`, 12 파일 크기·모드 계약대로): 병사 96×128 알파 폭×높이 inf 66×124 · spear 38×124 · bow 81×124 · cav 92×96 · general_left 86×124 · general_right 61×124, 발밑 y125 → origin **(0.5, 0.98)**, 배율 병사 **0.3**(높이 37px ≈ 코드 실루엣 34), **기병 0.345**(말이 넓어 높이 96), **무장 0.42**(52px). far.png 밑변 y 430(아래 30px 은 땅 밑) + 통합에서 **안개 띠**(y 372→400, 하늘색 (237,225,208) 그라데이션, WebGL) — far 아래변 봉우리 밑동 100여 열이 알파 1 이라 땅 경계에서 직선으로 잘리던 것. sky 는 비루프라 image + `scale=max(1, 1.05W/2048)`, 패럴랙스 ≤0.15. ground 1024 타일 4장.
- **에셋 재키잉(art 재검수 must)**: `units/bow.png`·`general_left.png` 가 왼쪽 보기였다(8배 얼굴 크롭으로 눈으로 확인) → 같은 레시피 `--flip`(general_left 는 기존 파일 거울과 픽셀 차 0). `cutin/guanyu.png` 머리카락 틈 10곳이 분홍으로 메워져 있었다 → `--fillholes` 제거(배경색 불투명 픽셀 0). `cutin/zhangfei.png` 초록 틈 44px(원인은 `--close=1`) → `post.py --bgkeep=20 --bgkeepskip=눈 상자 2개`(배경색 픽셀은 fillholes·close 뒤에도 투명 — 홍채 안에도 배경과 가까운 픽셀이 있어 눈 상자는 제외, 눈 알파 1.0 유지, 남은 잔여는 8px 이하 점뿐). 없는 컷인(하후돈·전위)은 붓글씨 컷인 폴백이 돈다(view-check).

**검수 should 반영**: view 6건 — `scene.launch('BattleHud', { relayout:false })`(relayout 뒤 인트로 소실) · sim/더미 둘 다 실패 시 토스트 「전투를 시작할 수 없습니다」 + 지도로 · KOREAN_SAMPLE 에 sim 문구('율쪽' 등) + smoke 가 sim.js·data.js 도 대조 · 그림자 `fillEllipse` smoothness 8(244개 × 32각형 → 8각형) · HUD 병력 라벨·결과 사유 22→24px, 무장 HP 바 14→18, 초상 30×38→34×44, 행 간격 44(HUD_TOP 132) · MapScene `city:close` 리스너 off. sim 5건 — 후퇴 때 무장이 진형 깊이(228)만큼 앞에 서서 뒷줄이 벽에 안 쌓임 · `rebuildGrid` 가 x=3200 유닛을 마지막 셀에 넣음(오른쪽 벽 궁병 공짜 사격) · 넉백 중에도 stunT 감산(포효 기절 2250→2000ms) · data.js 주석 드리프트 2곳 · BATTLE.md §1·§2·§3 갱신.

**수치 조정 이력**(data.js 주석에 벤치 회차별 「왜」; 표 값 → 현재 값): 병사 hp ×3·쿨다운 ×1.85(25초 종료 → 60~120) · 병사 atk 9/10/12→8/8/9 · 기병→보병 ×1.5→×1.25(우군 10전 10승) · 무장 600/38/8/550 → 700/30/12/950 + 3초 뒤 초당 6 회복(무장 20초 사망 → 결투 23초) · 반지름 7→10/11/14 · 무장기 dmg ×2.25 + 거리 감쇠 20%/(1−t)³/×0.1(청룡참 한 방 54명 즉사 방지) · 게이지 6/2→3/1.5/0.1 · 궁병 standOff 180·뒷걸음 ×0.75 · 공격자 상한 4/10 · 진형 「열 6·행 10」을 가로줄 6 × 뒤 10겹으로.

### 9.5 남은 should·미해결

- 컷인 `xiahoudun.png`·`dianwei.png` 없음 → 붓글씨 컷인. BootScene 이 로드 시도하므로 **콘솔 404 두 줄**(진행 지장 없음, 파일이 오면 자동). 지우고 싶으면 `BATTLE_ASSETS` 두 줄.
- `general_right.png` 망토가 어두워 tint 가 덜 먹는다(픽셀 30% 밝기 <80) → 깃발/링 편 표시 병행 권장, 아직 안 함. 무장 tint 는 병사보다 밝게(`GENERAL_COLOR`).
- far.png 아래변은 코드 안개 띠로 가렸을 뿐 파일은 그대로(build_far.py 에 아래 24~32px 알파 램프를 넣는 게 정석). Canvas 렌더러에선 그라데이션이 안 돼 옅은 단색 띠.
- 플레이어 무장 「빠지면 회복」 안내(튜토리얼/토스트) 없음 — 적 무장은 30% 후퇴·50% 복귀 AI 가 있고 플레이어는 없다.
- 폰 가독성은 논리값으로만 맞췄다(FIT 0.54: 병법 버튼 81×39px, 무장기 ⌀61px, 라벨 13px, 무장 이름 15px) — 실기 확인 필요.
- 더미 sim 의 무장기 id 'twinaxe' ≠ data 'twin'(GENERIC 폴백으로 무사, 더미 경로만).
- 지도 쪽 §8 미감 항목은 그대로.

### 9.6 브라우저에서 꼭 확인할 지점 (폰 가로 844×390 에뮬레이션 + 실기) — **아직 안 봄**

1. **성능 fps** — `__game.loop.actualFps` ≥ 50 인지: 유닛 244 Sprite + 그림자 Graphics(8각형 244개/프레임) + 파티클(먼지·불꽃) + 화살 48 풀. 특히 **무장기 발동 순간**(hit 수십 + 불꽃 18 + shake/flash + 컷인 텍스처 832×1216 업로드)과 양군 접전(hit 이벤트 초당 ~250)에서 프레임이 튀는지. `sim.step` 은 0.04ms 라 병목은 렌더 쪽.
2. **조이스틱** — 왼쪽 반(y≥132)을 누른 자리에 생기고(반지름 38px 폰), 손가락을 HUD 버튼 위로 끌거나 화면 밖에서 떼도 풀리는지(`pointerupoutside`·`gameout`), 오른손이 병법/무장기 버튼을 누르는 동안 왼손 조이스틱이 안 끊기는지(매 프레임 포인터 폴링), 첫 터치의 pointerup 이 전체 화면 진입(main.js)과 겹칠 때 조이스틱이 남지 않는지, 데드존 6.5px 손맛.
3. **무장기 연출** — shake(300ms, 0.012) + 흰 flash(120ms) + 부채꼴/원/띠 범위 표시(세로 0.5배 원근) + 먼지·불꽃 + 넉백 잔상, **컷인**: 관우·장비 초상이 오른쪽 밖 → 0.64W 지점(0.7초) → 왼쪽 밖, 머리카락 사이 분홍/초록 잔여가 어두운 띠 위에서 안 보이는지, 하후돈·전위는 붓글씨만(128px)인지, 컷인 1.5초 동안 HUD 입력이 막히지 않는지.
4. **결과 패널** — panel 9-slice + banner 「승리/패배/무승부」 붓글씨, 사유 문구(「적 병력 전멸·도주」「시간 초과 — 남은 병력 비율」)가 폴백 폰트로 찍히지 않는지('율'·'쪽' 표본 추가), 남은 병력·걸린 시간(`result.time`)·무장기 횟수(`skillCount.left`), Back.Out 열림, 「다시」가 같은 seed 로 재시작(같은 초기 배치)하는지.
5. **지도 복귀** — 「지도로」 → MapScene 재시작 + UIScene 토스트(인트로 없음), 다시 「출진」이 seed 2 로 열리는지, 성 패널 열고 닫기를 반복해도 `city:close` 가 한 번만 도는지, 전투 뒤 지도 카메라·줌이 정상(§8 START_ZOOM)인지.
6. **relayout** — 전투 중 주소창 숨김/전체 화면 진입/회전 → 논리 폭이 바뀌면 HUD 가 오른쪽 기준으로 재배치되고(인트로 없이 상태 복원: 게이지·명령·결과 패널) 배경 3겹이 새 폭으로 다시 깔리는지(sky 배율 k·패럴랙스 ≤0.15, far 이어 붙임 개수), 그 **다음 출진에서 인트로가 다시 뜨는지**(launch data 수정), 2400 폭에서 병법 3버튼이 오른쪽 반 안에 드는지.

추가: Canvas 강제(`type: Phaser.CANVAS`)에서 편 색 캔버스 텍스처·nineslice 대체 이미지·안개 띠 단색, `assets/battle/` 을 비웠을 때 코드 실루엣(24×34·44×60)과 캔버스 배경으로 전 화면이 도는지, 효과음 hit(90ms 스로틀)·skill.
