# 전투 화면 품질 끌어올리기 — 사양·에셋 계약 (2차)

> 제작자 판정: 1차 전투 화면은 「허접」. 원인(스크린샷 `tools/shots/battle_clash.png` 기준):
> 1. 병사가 한 자세짜리 작은 그림에 단색 tint 를 씌운 것이라 **색깔 막대 뭉치**로 보인다. 병종·무장 구분이 안 된다.
> 2. 땅이 평평한 흙 텍스처 한 장 — 원근·풀·길·소품이 없어 **진흙판** 같다. 하늘/산과 땅이 y=400 직선으로 딱 갈린다(중경 없음).
> 3. HUD 가 맨 사각 바 + 회색 실루엣 초상. 지도 화면의 청동·목재 프레임 톤과 다르다.
> 4. 타격·무장기 이펙트가 얇은 선뿐 — 불꽃·먼지·피·충격파·베기 이펙트가 없다. 넉백은 그냥 미끄러진다.
> 5. 화면에 깊이감(안개·비네트·명암)이 없다.
>
> 목표: 「군영전 스크린샷」이라고 해도 믿을 정도. 방법은 **그림을 갈아 끼우고, 연출을 겹치는 것** — 시뮬레이션(sim.js)은 손대지 않는다.
> 기존 계약(docs/BATTLE.md)은 유지하고, 여기 정한 새 에셋이 있으면 쓰고 없으면 지금 그림/폴백으로 돈다.

## 1. 유닛 그림 — `assets/battle/units2/`

파일명 `<kind>_<side>_<pose>.png`. **128×160 알파 PNG, 오른쪽 보기, 발끝이 y≈152**(origin 0.5·0.95). 한 세트로 보이게 seed·프롬프트 골격·선 굵기·명암 방식 통일. 글자·낙관 금지.

| kind | 설명 | side | pose |
|---|---|---|---|
| inf | 보병 — 환도+둥근 방패, 가죽 갑옷 | g(초록 아군) / b(파랑 적군) | stand / attack |
| spear | 창병 — 긴 창, 비늘 갑옷 | g / b | stand / attack |
| bow | 궁병 — 활 시위 당김, 화살통, 가벼운 옷 | g / b | stand / attack |
| cav | 기병 — 말 탄 병사(말 포함, 150px 높이 허용), 창 | g / b | stand / attack |
| gen_guanyu | 관우 — 녹색 전포, 긴 수염, 청룡언월도 | (없음) | stand / attack |
| gen_zhangfei | 장비 — 검은 수염, 붉은 갑옷, 장팔사모 | (없음) | stand / attack |
| gen_xiahoudun | 하후돈 — 안대, 푸른 갑옷, 대도 | (없음) | stand / attack |
| gen_dianwei | 전위 — 거구, 쌍극, 어두운 갑옷+푸른 띠 | (없음) | stand / attack |

- 편 색: **옷·갑옷에 편 색이 들어간 그림 자체를 두 벌** 만든다(tint 로 씌우면 죽는다). 방법: 초록 버전을 뽑고 Qwen 지시 편집 «Change the green armor and cloth to blue. Keep everything else exactly the same.» 로 파랑 버전. 무장은 고유색이라 side 없음.
- 자세: stand 를 뽑고 Qwen 지시 편집 «Make him swing the sword forward in an attack pose. Keep the outfit, colors and style exactly the same.» 로 attack. (용병단에서 검증된 방법 — 옷을 지키며 자세 바꾸기는 지시 편집.) 키잉은 단색 배경(옷과 안 겹치는 색) → `assets/raw/ui/post.py key` 계열.
- 크기 통일: 보병·창병·궁병은 머리끝~발끝 **125~135px**, 기병 145~155, 무장 140~150. 파이썬으로 알파 bbox 를 재서 맞춰라(리사이즈·발끝 정렬).
- 코드는 stand↔attack 두 장을 `attackT` 로 바꿔 끼우고(0.15~0.75 구간 attack), bob·기울기·넉백 회전을 얹는다. 현재 `units/<kind>.png` + tint 는 폴백으로 남긴다.

## 2. 전장 그림 — `assets/battle/field/`

| 파일 | 크기 | 내용 |
|---|---|---|
| `ground.png` | 2048×360 | 채색 회화풍 전장 땅. **위(먼 곳)는 어둡고 흐리게, 아래(가까운 곳)는 밝고 풀·자갈·바퀴 자국 디테일.** 가로 seamless(좌우 페더 블렌드, 파이썬으로 이어 붙여 확인). 하늘 `sky.png` 와 색이 이어지게(해질녘 따뜻한 톤). **(납품·통합) RGBA — 윗변 40px 은 알파 페이드(0→1), 위 34% 는 어둡게 칠하지 않고 크림색 안개. 코드에서 땅(층 3)이 중경(층 2)보다 앞이라 그림이 스스로 풀려야 지평선에 직선이 안 생긴다. 「위는 어둡게」는 코드의 battle_shade 가 얹는다. smoke 가 알파를 요구한다** |
| `mid.png` | 2048×260 | 중경 띠 — 나무 실루엣·언덕·안개, 위쪽 알파 페이드. 가로 seamless. 하늘과 땅 경계(y=400)를 가린다 |
| `fog.png` | 1024×160 | 가로 반복 흰 안개 띠, 알파(위·아래 페이드). 지평선 근처와 앞쪽에 얇게 |
| `tent.png` `palisade.png` `tree_dead.png` `rock1.png` `rock2.png` | ≤256×256 알파 | 양 진영 소품(막사·목책) + 전장 소품(고목·바위). 옆에서 본 시점, 땅에 닿는 바닥 그림자 포함 |
| `banner_g.png` `banner_b.png` | 64×192 알파 | 진영 깃발(장대 포함) — 진영 앞에 세운다 |
| `flag_g.png` `flag_b.png` | 48×72 알파 | 병사가 드는 작은 부대 깃발(기수용 — 부대마다 3명) |
| `blood1.png` `blood2.png` `crater.png` | 128×64 알파 | 바닥 데칼(핏자국·패인 자국). 죽은 자리에 남았다 서서히 사라짐 |

## 3. 이펙트 — `assets/battle/fx/` (검정 배경에 흰/밝은색 → ADD 블렌드)

| 파일 | 크기 | 내용 |
|---|---|---|
| `slash_blue.png` | 512×256 | 청룡참 — 푸른 초승달 베기 파동(왼→오른쪽으로 날아감) |
| `slash_white.png` | 256×128 | 일반 베기 호(무장 공격) |
| `ring.png` | 256×256 | 포효·쌍극 충격파 링 |
| `spark.png` | 64×64 | 타격 불꽃 |
| `dust.png` | 128×128 | 먼지 뭉치(부드러운 흰 구름) |
| `speedlines.png` | 1024×512 | 컷인 뒤 집중선(가운데 비고 바깥으로 흰 선) |
| `impact.png` | 128×128 | 맹공 돌진 충격(방사형) |

## 4. HUD 그림 — `assets/battle/hud/`

| 파일 | 크기 | 내용 |
|---|---|---|
| `portrait_guanyu.png` `portrait_zhangfei.png` `portrait_xiahoudun.png` `portrait_dianwei.png` | 96×120 | 무장 초상 — 컷인(`cutin/*.png`)에서 얼굴 부분을 잘라 만든다(없는 것은 생성) |
| `portrait_frame.png` | 112×136 | 초상 테두리(청동, 가운데 투명) |
| `bar_frame.png` | 320×40 | HP/병력 바 틀 9-slice(모서리 12, 가운데 투명) — 지도 HUD 와 같은 청동·목재 톤 |
| `medallion.png` | 160×160 | 무장기 원형 버튼 틀(청동 메달리온, 가운데 투명) |
| `skill_guanyu.png` `skill_zhangfei.png` | 64×64 | 무장기 아이콘(청룡·포효) |

## 5. 화면 코드 (BattleScene / BattleHud / fx) — 겹치는 순서와 연출

렌더 층(깊이): sky(0) → far(1, 패럴랙스 0.2) → mid(2, 0.5) → ground(3, 1.0, 원근 그라데이션 오버레이) → fog 뒤(4) → 데칼(5) → 소품·깃발(6, y 깊이) → 그림자(7) → 유닛(y 깊이 100~800) → fx ADD(900) → fog 앞(950, 알파 0.15) → 비네트(990, 화면 고정) → HUD 씬.

- **유닛**: stand/attack 두 텍스처 교체 + bob(이동 6Hz ±2px) + 기울기(속도 방향 ±6°) + 공격 전진 8px + 피격 흰 플래시 + 넉백 회전(−40°→0) + 사망 회전 90°·알파·데칼 남김. 기수(부대당 3명)는 `flag_<side>` 를 등 뒤에 붙여 펄럭임(scaleX 트윈). 무장은 발밑에 편 색 링 + 이름표(붓글씨 20px, 위) — 전장에서 찾기 쉽게.
- **타격**: hit 이벤트마다 spark 1개(ADD, 0.15초) + 작은 먼지 2개. 무장 공격은 slash_white 호(ADD, 0.2초). 사망은 먼지 3개 + 데칼(blood, 20초 뒤 페이드).
- **무장기**: 컷인 = speedlines 회전 배경 + 초상 슬라이드(0.7초) + 이름 붓글씨 + 흰 플래시 + 흔들림 0.35초 + **히트스톱**(sim.step 을 120ms 멈춤) → 청룡참은 slash_blue 가 420px 날아가며 커지고(ADD), 포효·쌍극은 ring 이 2배로 퍼지며 사라짐, 맹공은 impact + 먼지 궤적. 맞은 적은 knockback 이벤트로 튕기며 회전.
- **카메라**: 기본 줌 **1.15**(유닛이 커 보이게), 무장기 때 1.25 로 0.2초 펀치 후 복귀. 조종 무장 추적 lerp 0.08 유지.
- **땅 원근**: ground 위에 세로 그라데이션(위 어둡게 알파 0.35 → 아래 0) Graphics 한 장. (납품·통합: 0.35 로 뚝 시작하면 풀린 땅 윗변에 회색 직선이 생겨 0 → 12% 에서 0.33 → 45% 에서 0.12 → 0 램프 — `BootScene.fbShade`.) fog 뒤층은 지평선(y≈400)에, 앞층은 y 650 근처 알파 0.12.
- **비네트**: 화면 크기 검은 테두리 그라데이션(모서리 알파 0.45) — 카메라 scrollFactor 0.
- **HUD**: 상단 좌우에 초상+테두리+이름(붓글씨)+HP 바(bar_frame + 붉은 채움 + 흰 하이라이트), 병력 바는 편 색 채움 + 숫자. 무장기 버튼 = medallion + 아이콘 + 게이지 호(금색). 명령 버튼은 현재 ui/button 유지. 「돌격!」 명령 시 화면 가운데 붓글씨가 커졌다 사라짐(0.6초).
- 성능: 추가 스프라이트는 기수 깃발(편당 6)·소품 10여 개·fx 풀 60 — 전체 400 미만. 데칼은 Graphics 가 아니라 sprite 풀 40 개(오래된 것부터 재사용).

## 6. 검증

- `node tools/smoke.mjs` 에 units2/field/fx/hud 계약(존재·크기·알파) 검사 추가 — **선택 에셋이므로 없으면 경고만**, 있으면 크기 검사.
- (연출 코드 담당 추가) 텍스처 키 표는 `src/scenes/BootScene.js` 의 `BATTLE2_ASSETS`(키 = `u2_`/`field_`/`fx_`/`hud_` + 파일명). `node assets/raw/battle/view-check.mjs` 는 2차 그림이 없는 폴백 경로를, `--art` 를 붙이면 2차 그림이 다 있는 경로(교체·기수·fx 풀 60·데칼 풀 40·히트스톱·줌 펀치)를 헤드리스로 밟는다. 배치 목업(브라우저 대체): `node assets/raw/battle2/_code_dump_units.mjs 24` → `python assets/raw/battle2/_code_mock.py out.png` → `python assets/raw/battle2/_code_mock_hud.py out.png hud.png`.
- (통합 추가) 정적 합성 미리보기: `python assets/raw/battle2/preview.py` → `assets/raw/battle2/preview.png`(격돌 1558×720 + HUD)·`preview_camp.png`(진영). U2·U2_ANCHOR·PROPS·FOG·HUD_LAYOUT 을 소스에서 읽어 BattleScene 수식대로 그린다. `view-check.mjs --art --drop=<정규식>` 는 일부만 납품된 상태의 폴백을 밟는다. 실측·고친 수치는 docs/HANDOFF.md §9.7.
- 브라우저 스크린샷(`__shot`)을 제작자가 보고 판정한다: 격돌 장면·무장기 장면·결과 패널. 기준은 「군영전 스크린샷으로 믿을 만한가」.
