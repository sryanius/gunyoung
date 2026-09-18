# 군영전 전투 프로토타입 — 사양·모듈 계약

> 목적: 삼국군영전의 핵심인 **실시간 횡스크롤 대군 전투**가 브라우저(Phaser)와 폰에서 「재미있고 60fps 로」 도는지 판정한다.
> 전략층(MapScene)과는 「출진 → 전투 → 결과 → 지도」 로만 이어진다. 여러 에이전트가 동시에 만들므로 **이 문서의 파일·API·수치를 그대로 지켜라.**
> 화면 규약(1280~2400×720 논리, 폰 가로, 폰트, 9-slice 에셋)은 `docs/SPEC.md` 를 따른다.

## 1. 전투의 모양 (군영전 기준)

- **옆에서 본 전장**. 왼쪽이 아군(유비군), 오른쪽이 적군(조조군). 전장 논리 폭 **3200**, 높이 720.
- 땅은 y **400~690** 띠(가짜 깊이 — y 가 클수록 앞). 유닛은 이 띠 안에서 상하좌우로 움직인다. 하늘·먼 산은 배경.
- 각 편에 **무장 2명**, 무장마다 **병사 60명**(→ 편당 122, 전체 244). 병사는 자기 무장을 따라다니는 「부대」다.
- **병종** 4: 보병(검)·창병·궁병(원거리)·기병(빠름). 상성: 기병→보병·궁병 ×1.5, 창병→기병 ×1.5, 보병→창병 ×1.5. 궁병은 사거리 260 에서 화살을 쏜다.
- **무장**은 강하다(병사 20명 몫). 플레이어는 **첫째 무장(관우)** 을 직접 조종하고, 둘째 무장(장비)과 병사는 AI+병법 명령을 따른다. 적은 전부 AI.
- **무장기(필살기)**: 게이지가 공격할 때마다 차고(피격 시 조금), 가득 차면 발동. 화면이 번쩍이고 흔들리며 무장 컷인(초상)이 슬라이드로 지나가고, 광역 피해 + 적이 튕겨 난다.
  - 관우 「청룡참」: 전방 부채꼴 420px(100°), 피해 135, 적 넉백 120
  - 장비 「포효」: 반경 300 원, 피해 75, 넉백 180, 적 2초 기절
  - 하후돈 「맹공」: 전방 돌진 500px(420ms, 경로 폭 70), 지나간 자리 피해 105, 넉백 90
  - 전위 「쌍극」: 반경 240 원, 피해 112, 넉백 60
  - (피해는 처음 60/35/45/50 이었다 — 병사 hp 를 ×3 하면서 ×2.25. 범위 20% 안은 그대로, 밖은 (1−t)³ 감쇠, 가장자리 ×0.1 — 가까운 적만 죽고 먼 적은 튕겨 나간다. §3)
- **병법(부대 명령)** 3: 돌격(적을 향해 전진·교전) / 대기(무장 곁 진형 유지, 접근한 적만 상대) / 후퇴(자기 진영 쪽으로 물러남, 사기 회복). 편 전체에 적용. 시작은 「대기」, 적 AI 는 5초 뒤 「돌격」.
- **사기**: 무장이 죽으면 그 부대 병사는 도주(전장 밖으로 달려 나가며 사라짐). 편 전체 병력 15% 미만이면 나머지도 도주. (수치 사기는 없다 — 규칙만. 「후퇴 시 사기 회복」은 무장 자연 회복(3초 안 맞으면 초당 6)으로 대신한다.)
- **승패**(양편 대칭): 적 무장 전원 사망 또는 적 병력 전멸·도주 → 승리. 아군 무장 전원 사망 **또는 아군 병사 전멸·도주** → 패배(관우가 살아 있어도 진다 — AI vs AI 벤치가 대칭이어야 해서 같은 규칙). 3분 넘으면 남은 병력 비율로 판정, 같으면 무승부.
- 목표 체감: AI 끼리 붙이면 **60~120초** 안에 끝난다. 플레이어의 무장기 두 방이 흐름을 바꾼다.

## 2. 모듈 계약

```
src/battle/data.js        병종·무장·무장기 수치 (아래 §3). Phaser 의존 없음.
src/battle/sim.js         전투 시뮬레이션 — Phaser 의존 없음. node 에서 그대로 돈다.
src/battle/BattleScene.js Phaser 씬: sim 을 굴리고 그린다 + 입력(조이스틱·버튼) + 카메라 + 이펙트
src/battle/BattleHud.js   Phaser 씬(BattleScene 위에 겹침): 병력 바·무장 HP·게이지·버튼·결과 패널
src/battle/fx.js          이펙트 헬퍼(번쩍임·흔들림·컷인·베기 궤적·화살·먼지). Phaser 사용.
tools/battle-bench.mjs    헤드리스 벤치: sim 만 300초 굴려 종료·승패·틱당 ms 를 찍는다
```

### 2.1 sim.js API (view 는 이 인터페이스에만 의존한다)

```js
import { createBattle } from './sim.js';
const b = createBattle({ seed: 1, left: ARMY_LEFT, right: ARMY_RIGHT });   // ARMY_* 는 data.js 의 형식
b.step(dtMs);          // dtMs ≤ 50 으로 잘라 부른다(view 가 delta 를 쪼갠다). 결정적(같은 seed·입력 = 같은 결과).
b.units;               // Unit[] — 죽은 유닛도 state 'dead'/'gone' 으로 남는다(배열 인덱스 안정). view 는 id 로 스프라이트를 맵핑.
b.time;                // 경과 ms
b.result;              // null | { winner: 'left'|'right'|'draw', reason: string, leftAlive, rightAlive }
b.drainEvents();       // Event[] 를 돌려주고 비운다. view 가 매 프레임 부른다.
b.command(side, 'charge'|'hold'|'retreat');   // 병법
b.setGeneralInput(side, generalId, { dx, dy });// 조종 무장 이동 벡터(-1~1). 매 프레임 갱신. 0,0 이면 AI 가 맡는다? → 아니, 플레이어 무장은 입력이 0 이면 제자리(자동 공격만).
b.useSkill(side, generalId);                    // 게이지가 100 이면 발동하고 true, 아니면 false
b.generalsOf(side);    // Unit[] (무장만)
b.countAlive(side);    // 살아 있는 병력 수(무장 포함)
// ── 덧붙인 것(계약 밖 — view 는 있으면 쓰고 없으면 폴백한다) ──
b.playerOf(side);      // 플레이어 조종 무장 Unit | null
b.skillCount;          // { left, right } 무장기 발동 횟수(결과 패널)
b.unitById(id); b.commandOf(side); b.countInitial(side); b.sides; b.tick; TICK_MS(export, 16.667)
b.result.time;         // 종료 시각 ms(결과 패널 「걸린 시간」). result 가 난 뒤에도 step 은 계속 돈다(end 이벤트는 한 번, result 고정)
```
시간: `step(dt)` 는 누적기로 TICK_MS 단위 고정 틱을 돌린다(step(50) = 3틱) — 프레임 속도와 무관하게 결정적. view 는 delta 를 ≤50ms×≤4 로 쪼개 부른다.

```ts
type Unit = {
  id: number; side: 'left'|'right'; kind: 'inf'|'spear'|'bow'|'cav'|'general';
  generalId: number;     // 소속 무장 id (무장 본인은 자기 id)
  name?: string;         // 무장만
  x: number; y: number;  // 전장 좌표
  facing: 1 | -1;        // 1 = 오른쪽
  hp: number; maxHp: number;
  state: 'idle'|'move'|'attack'|'hurt'|'stun'|'flee'|'dead'|'gone';
  attackT: number;       // 공격 동작 진행 0~1 (view 가 찌르기/휘두르기 연출에 쓴다)
  gauge?: number;        // 무장만, 0~100
  skill?: string;        // 무장만, data.js 의 무장기 id
  vx: number; vy: number;// 마지막 프레임 속도(뒤집기·기울기 연출용)
  // 덧붙인 공개 필드: alive(싸울 수 있는가 — dead/flee/gone 이면 false), dataId(무장 데이터 id), key(무장 데이터 key 'guanyu' — 컷인 텍스처 cutin_<key>), color
};
// state 메모: attackT 는 공격 중이 아니면 0, 'attack' 동안 0→1(병사 300ms·무장 250ms, 0.5 에서 hit). 무장기도 'attack'(cone/circle 500ms 자세, dash 420ms 돌진).
//   넉백은 250ms 동안 sim 이 위치를 옮기며 state 'hurt'(기절 겹치면 'stun') — **무장도 넉백 중엔 'hurt'** 다(무장 피격 연출은 hit 이벤트로).
//   병사는 맞으면 100ms 'hurt'(공격 중이면 안 끊김). 무장 사망 → 부대 'flee' → 전장 밖 'gone'.
type Event =
  | { type: 'hit', x, y, from: number, to: number, dmg: number, crit?: boolean, skill?: true }   // skill: 무장기 피해(view 는 궤적 대신 불꽃만)
  | { type: 'arrow', from: number, to: number, x0, y0, x1, y1, ms: number }   // view 가 화살 스프라이트를 날린다. y0 는 가슴(y−20), x1/y1 은 발사 시점 목표 발 위치
  | { type: 'death', id: number, x, y, side, by: number }                     // by: 죽인 유닛 id(없으면 −1)
  | { type: 'flee', id: number }
  | { type: 'skill', id: number, side, skill: string, x, y, facing }          // 컷인·광역 연출 시작
  | { type: 'knockback', id: number, dx, dy, ms }
  | { type: 'command', side, cmd }
  | { type: 'end', winner, reason };
```

규칙:
- sim 은 **Phaser·DOM·Date.now·Math.random 을 쓰지 않는다.** 난수는 seed 기반 자체 PRNG(`src/core` 없음 — sim.js 안에 mulberry32 한 개).
- 이웃 탐색은 **격자 해시**(셀 64px)로. 244 유닛에서 틱(16.7ms 분량) 하나가 **2ms 이하**(노드 벤치 기준). O(n²) 금지.
- 유닛 겹침 방지(분리력)는 가볍게 — 같은 셀 + 오른쪽·아래 이웃 셀(각 쌍 한 번). (처음엔 「같은 셀만」이었는데 셀 경계에서 무장 하나에 기병 45기가 붙어 3초 만에 반피가 났다. 틱 비용은 0.04ms 그대로.)
- 병사 AI(대기): 무장 뒤 진형 자리(가로줄 6 × 뒤로 10겹, 간격 20×22, 무장 뒤쪽 30px 부터 — 블록 y 중심은 무장 시작 y 에서 땅 띠 바깥쪽으로 20 밀어 두 부대가 맞닿는다)로 간다. 적이 90px 안이면 상대한다.
  돌격: 가장 가까운 적(격자에서 탐색, 없으면 적 무장)에게 간다. 한 목표에 근접 공격자 4명(무장 10명)까지. 후퇴: 진영 끝(왼쪽 x=200 / 오른쪽 x=3000)으로 — 진형 맨 뒷줄이 거기 서고 무장은 228 앞(428/2772).
- 궁병: 목표가 사거리 260 안이고 120 밖이면 서서 쏜다(2.2초 간격, 화살 비행 0.45초 뒤 피해 — sim 이 예약해 두었다 적용, 목표가 그 사이 죽으면 빗나감). 쏘고 난 사이엔 180 까지 다가선다. 120 안이면 ×0.75 로 뒤로 물러나고, 궁지면 근접 ×0.5.
- 공격: 사거리(근접 34, 무장 48) 안에서 `attackT` 를 0→1 로 올리고 0.5 지점에 피해. 쿨다운 병종별. 피해 = atk × 상성 × (0.85~1.15 난수) − def.
- 무장 AI(비조종): 가장 가까운 적을 향해 전진·공격, HP 30% 미만이면 부대 뒤로 물러남. 게이지 100 이면 적이 200 안일 때 무장기.
- 플레이어 무장: `setGeneralInput` 의 벡터로 이동(속도 데이터값), 사거리 안 적을 자동 공격. 입력 중에도 공격 동작은 끊기지 않는다(attack 중엔 이동 속도 0.3배).
- 넉백·기절은 sim 이 위치를 옮기고 'knockback' 이벤트도 낸다(view 는 회전·잔상만 얹는다).
- 시간 초과 180초 → 남은 병력 비율 판정.

## 3. 수치 (data.js) — 벤치로 다듬은 현재 값 (처음 값은 괄호, 「왜」는 data.js 주석)

| kind | hp | atk | def | speed(px/s) | range | cooldown(ms) | 비고 |
|---|---|---|---|---|---|---|---|
| inf 보병 | 150 (40) | 8 (9) | 2 | 95 | 34 | 2000 (900) | 창병에 ×1.5 |
| spear 창병 | 135 (45) | 8 (10) | 3 | 85 | 40 | 2350 (1000) | 기병에 ×1.5 |
| bow 궁병 | 84 (28) | 7 (8) | 0 | 90 | 260 | 2200 (1400) | 근접 피해 ×0.5, 180 까지 접근, 120 안이면 ×0.75 뒷걸음 |
| cav 기병 | 140 (55) | 9 (12) | 3 | 170 | 36 | 1850 (800) | 보병에 ×1.25 (1.5), 궁병에 ×1.5 |
| general 무장 | 700 (600) | 30 (38) | 12 (8) | 130 | 48 | 950 (550) | 광역 없음(무장기 제외). 병사 피해 −40%. 3초 안 맞으면 초당 6 회복. 치명 10%·×1.5 |

병사 hp ×3·쿨다운 ×1.85: 표 값으로는 편당 초당 7명이 죽어 25초에 끝났다. 반지름 10(기병 11, 무장 14). 피해 = atk × 상성 × (0.85~1.15) − def, 최소 1.
무장(data.js `GENERALS`): 관우(청룡참, 색 #3aa655, 부대 보병) · 장비(포효, 촉, 부대 창병) · 하후돈(맹공, #3b6fd6, 부대 기병) · 전위(쌍극, 부대 궁병+보병 반반). 무장 `id` 는 숫자(0~3 = Unit.id), `key` 는 'guanyu' 등(컷인 파일명).
`ARMY_LEFT = { side:'left', generals:[관우, 장비], player: 관우.id }`, `ARMY_RIGHT` 는 조조 쪽. 시작 위치: 왼쪽 무장 x 520/560, 오른쪽 2680/2640, y 각 520/600. 병사는 진형 자리에 배치.
무장기 게이지: 공격 적중 +3 (6), 무장에게 맞으면 +1.5 (2), 병사·화살에 맞으면 +0.1, 무장기 피해는 안 채움, 발동 시 0 — 난전에서 20초쯤에 한 번. 무장기 데이터: `{ id, name, shape:'cone'|'circle'|'dash', range, dmg, knock, stun?, coneDeg?, dashMs?, pathWidth?, cutin: true }`.

## 4. 화면 (Phaser)

### 4.1 BattleScene
- 진입: `this.scene.start('BattleScene', { seed, left, right })`. MapScene 의 커맨드 「출진」 버튼(UIScene)이 부른다 — 현재 「준비 중」 토스트 대신. 끝나면 결과 패널의 「지도로」 → `scene.start('MapScene')` + UIScene 이 토스트 「승리/패배」 (UIScene 은 `{ noIntro:true, toast:'…' }` 데이터를 받게).
- 배경 3겹 패럴랙스(`assets/battle/sky.png` 2048×720, `far.png` 2048×360 산, `ground.png` 1024×320 타일). 없으면 Graphics 그라데이션 + 산 실루엣 폴백.
- 유닛: **한 유닛 = Sprite 하나** (Container 금지 — 244개 성능). 텍스처는 BootScene 이 **코드로 생성**(`generateTexture`): 병종별 24×34 «치비 실루엣»(머리·몸·무기 글리프)을 흰색으로 그리고 편별 `setTint`(아군 초록 #3aa655 계열, 적 파랑 #3b6fd6 계열 — 병종은 무기 글리프와 살짝 다른 명도로 구분). 무장은 44×60 + 등에 깃발. `assets/battle/units/<kind>.png`(96×128 일러스트, BootScene 키 `bunit_<kind>`·`bunit_general_left/right`) 가 있으면 그것을 0.3 배(기병 0.345 — 말이 넓어 높이 96, 무장 0.42)로 쓴다. 일러스트는 발밑이 y125 라 origin (0.5, 0.98). Canvas 렌더러는 tint 를 못 하므로 편 색을 곱한 캔버스 텍스처 사본을 쓴다.
- 애니메이션은 프레임이 아니라 **코드 연출**: 이동 중 상하 bob(±2px, 6Hz) + 살짝 기울기, 공격은 `attackT` 로 전방 찌르기(x 오프셋 0→8→0)+무기 글리프 회전, 피격은 0.1초 흰 tint 플래시, 죽음은 넘어지며(각도 90°) 알파 0 → 1.2초 뒤 스프라이트 풀로 반환.
- 깊이: `setDepth(unit.y)`. 그림자: 유닛 발밑 타원(Graphics 하나에 전부 그리기 — 매 프레임 clear 후 244개 fillEllipse 는 괜찮다).
- 카메라: 조종 무장을 따라간다(lerp 0.08, 전방 120px 앞서 봄), 줌 1, bounds 0~3200. 무장기 때 shake(300ms, 0.012) + 흰 flash(120ms).
- 이펙트(fx.js): 베기 궤적(Graphics 호 3프레임), 화살(작은 sprite tween, 포물선), 먼지(파티클, 기병 이동·넉백), 피해 숫자(작은 Text 풀 30개, 위로 뜨며 사라짐 — 무장 피해만, 병사는 안 띄움), 무장기 컷인(초상 `assets/battle/cutin/<id>.png` 를 화면 오른쪽에서 왼쪽으로 0.7초 슬라이드, 없으면 이름 붓글씨만 크게), 광역 범위 표시(부채꼴/원 0.25초).
- 입력(폰 우선): 왼쪽 반 터치 → **가상 조이스틱**(터치한 자리에 생김, 반지름 70, 데드존 12) → `setGeneralInput`. 오른쪽 아래 **무장기 버튼**(게이지 원형, 100 이면 빛남), 그 위에 **병법 3버튼**(돌격/대기/후퇴, 현재 것 강조). 키보드도: WASD/화살표 이동, Space 무장기, 1/2/3 병법.
- 성능: `update` 에서 sim.step 은 delta 를 ≤50ms 로 쪼개 부르되 프레임당 최대 4번(탭 복귀 시 폭주 방지). 스프라이트 위치 갱신은 for 루프 한 번. 매 프레임 `drainEvents` 처리.

### 4.2 BattleHud
- 상단: 양편 병력 바(초록/파랑, 숫자), 가운데 경과 시간. 무장 4명 HP 바(이름 붓글씨 + 초상 자리표시).
- 하단 오른쪽: 무장기 버튼(ui/button 9-slice 아님 — 원형 Graphics + 게이지 호), 병법 3버튼(ui/button 9-slice, 눌림 상태).
- 결과 패널: ui/panel 9-slice + banner 「승리」/「패배」 붓글씨, 남은 병력·걸린 시간·무장기 횟수, 버튼 「다시」「지도로」. 열림 연출은 UIScene 패널과 같게(Back.Out).
- 첫 진입 1.2초: 「전투 개시」 붓글씨 + 양편 무장 이름. 그동안 sim 은 멈춰 있다가 시작.

## 5. 에셋 (선택 — 없으면 코드 폴백으로 전부 돈다)

모두 `assets/battle/` 아래. 생성 도구는 SPEC §6. 글자·워터마크 금지. 원본은 `assets/raw/battle/`.

| 파일 | 크기 | 내용 |
|---|---|---|
| `sky.png` | 2048×720 | 옆에서 본 전장 하늘+먼 풍경(수묵 담채, 해질녘 또는 낮). 아래 1/3 은 땅색으로 이어지게 |
| `far.png` | 2048×360 | 먼 산 실루엣 띠, 위쪽 투명(알파), 가로 반복 가능하면 좋음 |
| `ground.png` | 1024×320 | 땅 타일(흙·풀·돌), 가로 반복(seamless) |
| `cutin/guanyu.png` `cutin/zhangfei.png` | 832×1216 → 알파 | 관우·장비 상반신/전신 일러스트(애니풍, 배경 키잉). 무장기 컷인용 |
| `units/inf.png` `spear.png` `bow.png` `cav.png` `general_left.png` `general_right.png` | 96×128 알파 | 병종별 서 있는 병사 한 장(옆모습, 오른쪽 보기). 기병은 말 탄 모습. **편 색은 코드 tint 로 입히므로 옷은 회백색** |

## 6. 검증

- `node tools/battle-bench.mjs [--seeds=a-b] [--player] [--verbose] [--secs=N]` : seed 1~5 로 AI vs AI(양쪽 돌격) 를 180초 굴려 — 전부 종료(승패), 평균 종료 60~120초, 틱당 평균 ≤2ms·p99.9 ≤8ms(원 최대는 첫 틱 JIT·GC 튐이 섞여 WARN 만), 양쪽 다 이긴 적 있음, 결정성(같은 seed 두 번 = 같은 hp 합·x 합), 후퇴 시나리오(벽에 쌓인 병사 0). `--player` 는 관우를 30초 조작해 무장기 적중·즉사를 본다. 기준 미달이면 exit 1.
- `node tools/smoke.mjs` : battle 파일 import·sim 계약·HUD 9-slice·선택 에셋 크기·FIELD 일치·폰트 표본(sim.js 문구 포함) 검사.
- `node assets/raw/battle/view-check.mjs` : Phaser 를 흉내 내고 진짜 sim 을 붙여 BattleScene·BattleHud·fx 를 create → 인트로 → 입력 → 병법 → 무장기 → 종료 → 결과 → relayout → 지도로 순서로 밟는다(그림은 못 본다).
- 브라우저: 폰 가로(844×390)에서 60fps 근처(`game.loop.actualFps` ≥ 50), 조이스틱·무장기·병법·결과·지도 복귀 — docs/HANDOFF.md §9.
