// BattleScene — 실시간 횡스크롤 대군 전투 화면 (BATTLE.md §4.1).
//   sim(src/battle/sim.js)을 굴리고 그린다. sim 은 Phaser 를 모르고, 이 씬은 sim 의 §2.1 API 만 안다.
//   진입: this.scene.start('BattleScene', { seed, left?, right? })  ← UIScene 「출진」
//   위에 BattleHud 를 겹쳐 띄운다(병력 바·HP·버튼·결과). HUD 는 이 씬의 공개 필드를 읽고 메서드를 부른다:
//     읽기: sim, genMeta(Map unitId→meta), playerId, playerUnit, cmd, skillUsed, total, introUntil, ended, result, seed
//           + 3차: auto(자동 여부) · speed(배속 1|2|3) · canSwitch(sim 에 setPlayer 가 있는가)
//     호출: command(cmd) · tryUseSkill() · restartBattle() · goMap()
//           + 3차: selectGeneral(unitId) · cycleGeneral() · toggleAuto() · setAuto(on) · cycleSpeed() · setSpeed(n)
//     이벤트(this.events): 'battle:ready' | 'battle:skill'(meta) | 'battle:skillfail' | 'battle:command'(e) | 'battle:end'(result)
//           + 3차: 'battle:player'({ id, auto }) | 'battle:speed'(n) — HUD 는 재시작(relayout)에도 안 놓치게 이벤트가 아니라 매 프레임 필드를 읽는다
//   3차(docs/BATTLE_V3.md §1·§2) — 조종 선택·자동/수동·배속:
//     playerId/playerUnit = 「고른 무장」(카메라 추적·무장기 버튼·발밑 빛). auto 면 sim 쪽 조종 무장은 없고(setPlayer(null)) 전원 AI 지만
//     고른 무장은 그대로라 카메라가 따라가고 무장기 버튼도 그 무장 것을 직접 쓴다. 이 상태들은 전부 이 씬이 들고 있어
//     main.js relayout(HUD 만 restart)에도 그대로 남는다. 배속·자동 여부는 registry 에도 적어 다음 전투에 이어진다.
//   data.js·sim.js 는 동적 import — 없으면 아래 DEFAULT_DATA 와 assets/raw/battle/sim-stub.mjs(더미)로 돈다.
//
// 그리기 규칙(§4.1): 유닛 = Sprite 하나(풀), 깊이 = y, 그림자는 Graphics 하나에 전부, 애니는 프레임이 아니라 코드 연출.
// 성능: sim.step 은 delta 를 ≤50ms 로 쪼개 프레임당 최대 4번. 스프라이트 갱신은 for 한 번. 매 프레임 drainEvents.
//
// 2차(docs/BATTLE_ART.md §5) — 그림을 갈아 끼우고 연출을 겹친다. 새 그림(BootScene.BATTLE2_ASSETS)은 전부 선택:
//   textures.exists 로 보고 있으면 쓰고, 없으면 1차 방식(units/<kind>.png + tint, 코드 실루엣, Graphics)으로 돈다.
//   렌더 층(LAYER): sky 0 → far 1(패럴랙스 0.2) → mid 2(0.5) → ground 3 + 원근 그라데이션 3.5 → 뒤 안개 4 → 데칼 5
//     → 소품·진영 깃발 6(띠 안·앞쪽 소품은 y 깊이) → 그림자·무장 링 7 → 유닛(y 400~690) · 기수 깃발(y−0.5) → 이름표 850
//     → fx ADD 900 → 앞 안개 950 → 비네트(HUD 씬 맨 아래 — 줌·흔들림에 안 끌려가게 거기 둔다) → HUD.
//   카메라 줌 1.15(무장기 때 1.25 펀치). ※ 줌은 scrollFactor 0 인 것도 키운다 → 조이스틱 그림은 역변환해 그린다(drawJoy).
//   무장기: 히트스톱 120ms(sim.step 을 건너뛴다) + 흔들림 0.35초 + 흰 flash + 줌 펀치 + 모양별 이펙트(fx.skillCone/skillRing/impact).
//
// ※ 한글 문구를 새로 넣으면 factions.js 의 KOREAN_SAMPLE 에도 넣어라(tools/smoke.mjs 가 대조한다).

import { play as sfx } from 'file:///C:/claude/gunyoung/src/sfx.js';
import { Fx } from 'file:///C:/claude/gunyoung/src/battle/fx.js';
import { cutinPlan } from 'file:///C:/claude/gunyoung/src/battle/cutin.js';   // (3차 컷신) 컷신이 뜨기 전에 길이를 안다 — 히트스톱·줌 펀치·피해 연출 시각

/** 전장 논리 크기·땅 띠 (§1) */
export const FIELD = { w: 3200, h: 720, top: 400, bottom: 690 };
/** 편 색 — 병사 tint (아군 초록·적 파랑, SPEC §4 세력색) */
export const SIDE_COLOR = { left: 0x3aa655, right: 0x3b6fd6 };
/** 무장 tint — 병사보다 밝게 */
const GENERAL_COLOR = { left: 0x8fe8a0, right: 0x9cc0ff };

const CAM_LERP = 0.08;      // 프레임(16.7ms)당 따라가는 비율
const CAM_LEAD = 120;       // 무장 앞쪽으로 내다보는 거리
const CAM_ZOOM = 1.15;      // 기본 줌 — 유닛이 커 보이게 (BATTLE_ART §5). 보이는 세로는 720/1.15 = 626 → 아래 변(y 720)에 붙인다
const CAM_PUNCH = 1.25;     // 무장기 줌 펀치
const PUNCH_IN = 200;       // 0.2초에 1.25 까지
const PUNCH_OUT = 320;      // 그 뒤 복귀
const HITSTOP_MS = 120;     // 무장기 히트스톱 — 이 동안 sim.step 을 안 부른다
const MAX_STEP = 50;        // sim.step 한 번의 최대 ms
const MAX_STEPS = 4;        // 프레임당 최대 step 횟수 (탭 복귀 폭주 방지)
const JOY_R = 70;           // 가상 조이스틱 반지름
const JOY_DEAD = 12;        // 데드존
const INTRO_MS = 1200;      // 「전투 개시」 동안 sim 정지
/** (3차) 배속 — sim 에 넘기는 시간·연출 시계(animT)에 곱한다. 컷인·히트스톱·결과 패널 트윈은 실시간 그대로 */
export const SPEEDS = [1, 2, 3];
const REG_SPEED = 'battleSpeed';   // registry 키 — 다음 전투에도 유지
const REG_AUTO = 'battleAuto';
const AUTO_DRAG = 24;       // 자동 중 왼쪽 반을 이만큼(화면 px) 끌면 수동으로 돌아온다 — 그냥 탭은 무시
const HUD_TOP = 158;        // 이 위쪽 터치는 조이스틱으로 안 잡는다(HUD 영역 — BattleHud 초상 테두리 아래 끝 154. 2차 HUD 에서 132→158)

/** 렌더 층(깊이) — BATTLE_ART.md §5. 유닛은 y(400~690), fx 쪽은 fx.js FX_DEPTH(데칼 5·범위 7.8·fx 900) */
export const LAYER = { sky: 0, far: 1, haze: 1.5, mid: 2, ground: 3, shade: 3.5, fogBack: 4, prop: 6, shadow: 7, glow: 7.5, name: 850, fogFront: 950 };

/**
 * 2차 유닛 그림(units2, 128×160, 발끝 y≈152) 배율·origin. 몸 높이 병사 ~130 · 기병 ~150 · 무장 ~145px 기준.
 *   0.36 → 병사 47px(줌 1.15 → 화면 54px, 폰 0.54배 → 29px), 기병 54px, 무장 0.5 → 72px.
 *   h = 표시 몸 높이(이름표·기수 깃발 위치), sw/sh = 그림자 타원. 납품 그림 실측(통합): 24장 전부 128×160, 발끝(알파 bbox 아래) y152 →
 *   oy 0.95, stand 몸 높이 병사 129~131 · 기병 147 · 무장 142~146.
 */
export const U2 = {
  oy: 0.95,
  soldier: { scale: 0.36, h: 47, sw: 24, sh: 8 },
  cav:     { scale: 0.36, h: 54, sw: 34, sh: 9 },
  // (통합) 납품 그림 실측: 무장 stand 몸 높이 142~146px. 0.46(67px)은 미리보기(assets/raw/battle2/preview.png)에서 난전의 불꽃·병사에
  //   묻혔다 → 0.5(72px, 병사의 1.53배). 병사 0.36 은 진형 간격 20×22 에 이미 반쯤 겹쳐(밀집 방진으로 읽힌다) 더 키우지 않는다
  general: { scale: 0.5, h: 72, sw: 46, sh: 14 },
};
/**
 * (통합) 2차 그림의 「몸 중심 x」(128px 캔버스 기준) [stand, attack] — 이 열이 유닛 좌표(u.x = 그림자·발밑 링) 위에 오게 놓는다.
 *   납품 그림은 attack 이 앞발을 stand 자리에 둔 채 뒷발을 뒤로 뻗는 자세라 몸통이 8~15px 뒤에 그려져 있다(실측: 아래 7행 발 덩어리 +
 *   y60~125 몸통 무게중심, assets/raw/battle2/_integ_feet.py). origin 0.5 로만 두면 교체 순간 몸이 뒤로 3~7px 튀고, 무장은
 *   stand 도 가운데가 아니라(장비 57 · 관우 72) 발밑 링이 몸에서 비껴 보인다. 표에 없는 키(1차 그림)는 64(가운데).
 */
export const U2_ANCHOR = {
  inf: [62, 50], spear: [62, 47], bow: [61, 64], cav: [64, 64],
  gen_guanyu: [72, 66], gen_zhangfei: [57, 51], gen_xiahoudun: [66, 52], gen_dianwei: [75, 60],   // 전위 stand 는 뒤로 든 도끼 탓에 무게중심(71)보다 몸이 앞(75) — 기준선을 그려 눈으로 맞춤(_integ_anchor_sheet.png)
};
/** 1차 그림·코드 실루엣의 몸 높이·그림자 (기존 값 그대로) */
const U1 = { soldier: { h: 37, sw: 18, sh: 6 }, general: { h: 52, sw: 36, sh: 11 } };

/**
 * 2차 땅(field_ground 2048×360)은 아래 변을 y 720 에 붙인다 → 그림 위 변 y 360. 납품 그림은 위 40px 이 알파 페이드(0→1)라
 *   불투명한 땅은 1차와 같이 y 400 부터다 — 지평선(far·하늘색 띠)은 두 경우 다 FIELD.top(400) 기준으로 둔다.
 */
const GROUND2_H = 360;
/** 중경(field_mid 2048×260, 아래 8px 도 알파 페이드) 밑변 y — 2차 땅이면 페이드 구간 안(392), 1차 땅(위 변이 직선)이면 땅 밑으로 20 숨긴다. 패럴랙스 0.5 */
const MID_BASE = { ground2: FIELD.top - 8, ground1: FIELD.top + 20 };
/** 안개(field_fog 1024×160 — 납품 그림은 평균 알파 0.13·최대 0.74 로 옅다) 층 알파와 y. 뒤 = 지평선, 앞 = y 650 근처 */
const FOG = { backY: FIELD.top - 10, backAlpha: 0.9, frontY: 650, frontAlpha: 0.45, frontScaleY: 1.5 };
/** 기수: 부대(무장)마다 병사 순번 2·26·50 번째(진형 앞·가운데·뒤 겹의 가운데 줄)가 깃발을 든다 */
const BEARER_SLOTS = [2, 26, 50];
const FLAG_SCALE = 0.62;    // 48×72 → 30×45px (머리 위로 솟는다)

/**
 * 소품 배치 [키, x, 바닥 y, 배율, flipX]. sim 은 소품을 모른다(유닛이 그냥 지나간다) → 막사·목책·고목은 땅 띠 위쪽 가장자리(y≤415,
 *   모든 유닛 뒤)에만, 띠 안에는 가는 진영 깃발만, 띠 아래(y≥700, 모든 유닛 앞)엔 낮은 바위만 둔다.
 * (통합, 미리보기 preview_camp.png 로 고침) 진영 깃발: 0.8·0.9배(화면 177·199px)는 병사(54px)의 3.5배라 막사보다 컸다 → 0.66·0.72.
 *   (410,668)·(250,446)은 대기 진형(x 230~560, y 445~686) 한가운데·첫 줄 위에 꽂혀 보였다 → 뒤 깃발은 띠 위 가장자리(y 418, 층 6),
 *   앞 깃발은 후퇴선(x 200 / 3000) 바깥. 앞쪽 바위 x 1390 은 격돌 지점(1400~1800) 맨 아랫줄을 가려 1010 으로.
 */
const PROPS = [
  ['field_tent', 150, 410, 0.9, false], ['field_tent', 340, 404, 0.72, true], ['field_palisade', 500, 414, 0.8, false],
  ['field_palisade', 40, 416, 0.8, true], ['field_banner_g', 250, 418, 0.66, false], ['field_banner_g', 96, 672, 0.72, false],
  ['field_tent', 3050, 410, 0.9, true], ['field_tent', 2860, 404, 0.72, false], ['field_palisade', 2700, 414, 0.8, true],
  ['field_palisade', 3160, 416, 0.8, false], ['field_banner_b', 2950, 418, 0.66, true], ['field_banner_b', 3104, 672, 0.72, true],
  ['field_tree_dead', 1180, 408, 0.85, false], ['field_tree_dead', 2080, 412, 0.75, true],
  ['field_rock1', 1580, 414, 0.5, false], ['field_rock2', 880, 410, 0.45, false], ['field_rock2', 2380, 412, 0.4, true],
  ['field_rock2', 1010, 726, 0.4, false], ['field_rock1', 2240, 728, 0.42, true],   // 앞쪽 바위는 낮게·작게(맨 아랫줄 유닛을 덜 가린다)
];

/** 논리 폭 — main.js 가 창 비율로 정한다. create()·applyBounds() 에서 실제 값으로 */
let W = 1280;

/**
 * data.js 가 없을 때 쓰는 기본 수치 (BATTLE.md §3 표 값). data.js 가 있으면 같은 이름의 export 로 덮어쓴다.
 * 형식은 data.js 와 같다: KINDS{kind→수치}, SKILLS{id→무장기}, GENERALS{key→무장 (id 는 숫자, key 는 컷인 파일명)},
 * ARMY_LEFT/RIGHT{ side, generals[{...무장, x, y}], player: 무장 id(숫자) }. troops 는 [{ kind, n }].
 */
export const DEFAULT_DATA = (() => {
  const KINDS = {
    inf:     { hp: 40,  atk: 9,  def: 2, speed: 95,  range: 34,  cooldown: 900 },
    spear:   { hp: 45,  atk: 10, def: 3, speed: 85,  range: 40,  cooldown: 1000 },
    bow:     { hp: 28,  atk: 8,  def: 0, speed: 90,  range: 260, cooldown: 1400 },
    cav:     { hp: 55,  atk: 12, def: 3, speed: 170, range: 36,  cooldown: 800 },
    general: { hp: 600, atk: 38, def: 8, speed: 130, range: 48,  cooldown: 550 },
  };
  const SKILLS = {
    qinglong: { id: 'qinglong', name: '청룡참', shape: 'cone',   range: 420, dmg: 60, knock: 120, coneDeg: 100, cutin: true },
    roar:     { id: 'roar',     name: '포효',   shape: 'circle', range: 300, dmg: 35, knock: 180, stun: 2000, cutin: true },
    assault:  { id: 'assault',  name: '맹공',   shape: 'dash',   range: 500, dmg: 45, knock: 90,  dashMs: 420, pathWidth: 70, cutin: true },
    twin:     { id: 'twin',     name: '쌍극',   shape: 'circle', range: 240, dmg: 50, knock: 60,  cutin: true },
  };
  const GENERALS = {
    guanyu:    { id: 0, key: 'guanyu',    name: '관우',   faction: 'shu', color: '#3aa655', skill: 'qinglong', troops: [{ kind: 'inf',   n: 60 }] },
    zhangfei:  { id: 1, key: 'zhangfei',  name: '장비',   faction: 'shu', color: '#3aa655', skill: 'roar',     troops: [{ kind: 'spear', n: 60 }] },
    xiahoudun: { id: 2, key: 'xiahoudun', name: '하후돈', faction: 'wei', color: '#3b6fd6', skill: 'assault',  troops: [{ kind: 'cav',   n: 60 }] },
    dianwei:   { id: 3, key: 'dianwei',   name: '전위',   faction: 'wei', color: '#3b6fd6', skill: 'twin',     troops: [{ kind: 'inf', n: 30 }, { kind: 'bow', n: 30 }] },
  };
  const ARMY_LEFT = {
    side: 'left',
    generals: [{ ...GENERALS.guanyu, x: 520, y: 520 }, { ...GENERALS.zhangfei, x: 560, y: 600 }],
    player: GENERALS.guanyu.id,
  };
  const ARMY_RIGHT = {
    side: 'right',
    generals: [{ ...GENERALS.xiahoudun, x: 2680, y: 520 }, { ...GENERALS.dianwei, x: 2640, y: 600 }],
    player: null,
  };
  return { KINDS, SKILLS, GENERALS, ARMY_LEFT, ARMY_RIGHT };
})();

/** 결과 → 지도 토스트 문구 */
const RESULT_TOAST = {
  left:  '승리! 적을 물리쳤습니다',
  right: '패배… 다음을 기약합시다',
  draw:  '무승부 — 양군이 물러났습니다',
};

// ─────────────────────────────────────────────────────────────
// 모듈 로드 — sim.js / data.js 는 다른 에이전트가 만든다. 없으면 폴백.
// ─────────────────────────────────────────────────────────────

async function loadModules() {
  let dataMod = null, simMod = null;
  try {
    dataMod = await import('file:///C:/claude/gunyoung/src/battle/data.js');
  } catch (e) {
    console.info('[전투] data.js 없음 — BattleScene 기본값 사용');
  }
  try {
    simMod = await import('file:///C:/claude/gunyoung/src/battle/sim.js');
    if (typeof simMod.createBattle !== 'function') throw new Error('no createBattle export');
  } catch (e) {
    console.warn('[전투] sim.js 를 못 읽어 더미 sim(assets/raw/battle/sim-stub.mjs)을 쓴다:', e && e.message);
    simMod = await import('file:///C:/claude/gunyoung/assets/raw/battle/sim-stub.mjs');
  }
  return { dataMod, simMod };
}

/** DEFAULT_DATA 위에 data.js 의 같은 이름 export 를 덮는다 */
function mergeData(mod) {
  const D = { ...DEFAULT_DATA };
  if (mod) for (const k of Object.keys(DEFAULT_DATA)) if (mod[k] != null) D[k] = mod[k];
  return D;
}

/** 무장기 데이터를 { id, name, shape, range, dmg, knock, stun, coneDeg, pathWidth } 로 맞춘다 (coneDeg·pathWidth 는 fx.area 범위 표시용) */
function normSkill(s) {
  return {
    id: s.id != null ? s.id : s.name,
    name: s.name || String(s.id || '무장기'),
    shape: s.shape || 'circle',
    range: s.range || 240,
    dmg: s.dmg || 0,
    knock: s.knock || 0,
    stun: s.stun || 0,
    coneDeg: s.coneDeg || 100,
    pathWidth: s.pathWidth || 96,
  };
}

/** Unit.skill(id) 또는 무장 데이터의 skill(id/객체) → 무장기 데이터 */
function resolveSkill(D, ref, g) {
  if (ref && typeof ref === 'object') return normSkill(ref);
  const S = D.SKILLS;
  let s = null;
  if (ref != null && S) {
    s = Array.isArray(S) ? S.find((x) => x && (x.id === ref || x.name === ref)) : S[ref];
  }
  if (!s && g && g.skill && typeof g.skill === 'object') s = g.skill;
  if (!s && g && g.skillData) s = g.skillData;
  return normSkill(s || { id: ref, name: ref != null ? String(ref) : '무장기' });
}

export default class BattleScene extends Phaser.Scene {
  constructor() {
    super('BattleScene');
  }

  create() {
    W = this.scale.width;
    this.isWebGL = this.sys.game.renderer.type === Phaser.WEBGL;
    const data = this.scene.settings.data || {};
    this.seed = Number.isFinite(data.seed) ? data.seed : 1;

    /** @type {any} sim 인스턴스 (§2.1). 로드 전엔 null — update/HUD 가 기다린다 */
    this.sim = null;
    this.genMeta = new Map();
    this.unitById = new Map();
    this.playerId = null;
    this.playerUnit = null;
    this.cmd = { left: 'hold', right: 'hold' };
    this.skillUsed = { left: 0, right: 0 };
    this.total = { left: 0, right: 0 };
    this.introUntil = 0;
    this.ended = false;
    this.result = null;
    this.freezeAt = 0;
    this.lastHitSfx = 0;
    this.joy = null;
    // 3차 — 조종 선택·배속. 자동 여부·배속은 registry 에서 이어받는다(「다시」·다음 출진에도 유지)
    this.joyPending = null;      // 자동 중 왼쪽 반을 누른 손가락 { id, ox, oy } — AUTO_DRAG 넘게 끌면 수동 + 조이스틱
    this.canSwitch = false;      // sim.setPlayer 가 있는가(더미 sim 엔 없다 → 선택·자동 버튼은 아무 일도 안 한다)
    this.auto = false;
    const sp0 = this.registry ? this.registry.get(REG_SPEED) : 1;
    this.speed = SPEEDS.includes(sp0) ? sp0 : 1;
    this.simSpeed = 1;           // 이번 프레임에 실제로 건 배율(인트로·종료 뒤엔 1) — 화살·돌진처럼 sim 시간으로 온 길이를 실시간으로 바꿀 때 쓴다
    // 2차 연출 상태 — 씬 재시작(「다시」) 때도 create 가 다시 돌므로 여기서 초기화한다
    this.animT = 0;              // 연출용 시계(ms) — 히트스톱 동안 멈춘다(bob·깃발 펄럭임)
    this.hitStopUntil = 0;
    this.heldEvents = null;      // (3차 컷신) 컷신 동안 묵혀 둔 sim 이벤트 — 무장기와 같은 틱에 나온 hit·death·knockback 은 복귀 순간에 터진다
    this.pendingSkill = null;    // (3차 컷신) 복귀 시각에 터뜨릴 피해 연출 { e, sk, facing, at }
    this.punchAt = -1e9;         // 줌 펀치 시작 시각
    this.dash = null;            // 맹공 돌진 궤적 { unit, until, next }
    this.fogOff = 0;
    this.flagByUnit = new Map(); // 기수 unit.id → 깃발 Sprite
    this.genViews = [];          // 무장 이름표·발밑 링 { unit, label, color, h }

    this.buildBackground();
    this.buildProps();
    this.buildUnits();
    this.fx = new Fx(this);
    this.setupCamera();
    this.setupInput();

    // data 를 명시해 넘긴다 — Phaser 는 data 가 없으면 이전 settings.data 를 그대로 두므로, main.js relayout 이 한 번이라도
    // restart({ relayout: true }) 를 했으면 그 뒤 모든 전투에서 인트로가 사라진 채 1.2초 정지만 남는다(통합 검수)
    this.scene.launch('BattleHud', { relayout: false });
    this.hud = this.scene.get('BattleHud');
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);

    this.boot(data);
  }

  /** sim·data 를 비동기로 읽어 전투를 만든다. 그 사이 씬이 닫히거나 재시작되면 버린다 */
  async boot(data) {
    const token = (this.bootToken = {});
    let mods;
    try {
      mods = await loadModules();
      if (this.bootToken !== token || !this.sys.isActive()) return;
      this.setupBattle(mods, data);
    } catch (e) {
      // sim.js 도 더미도 못 읽으면 HUD 는 battle:ready 를 영영 기다리고 조이스틱도 안 생긴다 → 토스트와 함께 지도로(통합 검수)
      console.error('[전투] sim 을 만들 수 없다:', e);
      if (this.bootToken !== token || !this.sys.isActive()) return;
      this.time.delayedCall(1500, () => { if (this.sys.isActive()) this.goMap('전투를 시작할 수 없습니다'); });
    }
  }

  setupBattle({ simMod, dataMod }, data) {
    // ※ this.data 는 Phaser Scene 의 DataManager 플러그인이라 덮어쓰면 안 된다 → battleData
    const D = (this.battleData = mergeData(dataMod));
    const left = data.left || D.ARMY_LEFT;
    const right = data.right || D.ARMY_RIGHT;
    this.armies = { left, right };
    this.sim = simMod.createBattle({ seed: this.seed, left, right });

    for (const u of this.sim.units) this.unitById.set(u.id, u);

    // 무장 메타 — sim 의 무장 Unit ↔ 군 데이터의 무장을 dataId(있으면)·이름·순서로 짝짓는다.
    //   key 는 컷인 파일명(cutin_<key>.png): sim 이 Unit.key 로 실어 주면(통합에서 추가) 그것, 없으면 data.js 의 무장 key('guanyu'),
    //   그것도 없으면 문자열 id, 마지막으로 순서.
    for (const side of ['left', 'right']) {
      const gens = this.sim.generalsOf(side) || [];
      const list = (this.armies[side] && this.armies[side].generals) || [];
      gens.forEach((u, i) => {
        const g = (u.dataId != null && list.find((x) => x && x.id === u.dataId))
          || list.find((x) => x && x.name && x.name === u.name) || list[i] || {};
        const key = u.key != null ? u.key : g.key != null ? g.key : (typeof g.id === 'string' ? g.id : `g${i}`);
        this.genMeta.set(u.id, {
          id: u.id, side, unit: u, data: g,
          key: String(key),
          name: u.name || g.name || `무장 ${i + 1}`,
          skill: resolveSkill(D, u.skill != null ? u.skill : g.skill, g),
          color: GENERAL_COLOR[side],
        });
      });
    }

    // 플레이어 무장 — sim 이 알려 주면(playerOf) 그것, 아니면 army.player(무장 id 또는 무장 객체)와 맞는 왼쪽 무장, 없으면 첫째
    const leftGens = this.sim.generalsOf('left') || [];
    let p = typeof this.sim.playerOf === 'function' ? this.sim.playerOf('left') : null;
    if (!p && left && left.player != null) {
      const want = left.player;
      p = leftGens.find((u) => {
        const m = this.genMeta.get(u.id);
        if (!m) return false;
        if (typeof want === 'object') return m.data === want || m.name === want.name;
        return m.data.id === want || m.key === String(want) || u.dataId === want || u.id === want;
      });
    }
    this.playerUnit = p || leftGens[0] || null;
    this.playerId = this.playerUnit ? this.playerUnit.id : null;
    // (3차) 지난 전투를 자동으로 두었으면 자동으로 시작한다 — 첫 틱 전에 부르므로 「같은 seed + 자동」 은 늘 같은 판이다
    this.canSwitch = typeof this.sim.setPlayer === 'function';
    if (this.canSwitch && this.registry && this.registry.get(REG_AUTO) === true) {
      this.auto = true;
      this.sim.setPlayer('left', null);
    }
    this.total.left = this.sim.countAlive('left');
    this.total.right = this.sim.countAlive('right');

    this.buildBearers();
    this.buildGeneralViews();
    this.refreshLabels();   // (3차) registry 에서 자동으로 시작했으면 빛 무리를 옅게

    // 카메라를 바로 무장 위에 두고 첫 프레임을 그려 둔다(인트로 뒤에 튀지 않게)
    if (this.playerUnit) {
      this.cameras.main.scrollX = this.scrollXFor(this.playerUnit.x + CAM_LEAD, this.cameras.main.zoom || 1);
    }
    this.syncSprites(this.time.now, 0);
    this.introUntil = this.time.now + INTRO_MS;
    this.events.emit('battle:ready');
  }

  onShutdown() {
    this.bootToken = null;
    this.endJoy();
    if (this.scene.isActive('BattleHud')) this.scene.stop('BattleHud');
  }

  // ─────────────────────────────────────────────────────────────
  // 배경 — BATTLE_ART.md §5 층: sky(0, ≤0.1) / far(1, 0.2) / mid(2, 0.5) / ground(3, 1.0) + 원근 그라데이션(3.5) / 뒤 안개(4)
  //   … 유닛 … / 앞 안개(950). 텍스처는 BootScene 이 폴백까지 만든다(1차 sky·far·ground, 2차 안개·그라데이션).
  // 창 비율이 바뀌면(main.js relayout → applyBounds) 다시 만든다.
  //   패럴랙스 계수·타일 수는 줌 1 기준으로 넉넉히 잡는다 — 줌 ≥ 1 이면 보이는 범위가 그 안쪽이다.
  // ─────────────────────────────────────────────────────────────

  buildBackground() {
    if (this.bgObjs) for (const o of this.bgObjs) o.destroy();
    this.bgObjs = [];
    this.fogBack = [];
    this.fogFront = [];
    const has = (k) => this.textures.exists(k);
    const R = Math.max(1, FIELD.w - W);   // 카메라 스크롤 범위
    // 지평선(불투명한 땅이 시작하는 y) — 1차·2차 땅 모두 400. 2차 땅 그림은 y 360 부터 깔리지만 위 40px 은 알파 페이드다
    const ground2 = has('field_ground');
    const gTop = FIELD.top;
    const gImgTop = ground2 ? FIELD.h - GROUND2_H : FIELD.top;
    this.groundImgTop = gImgTop;

    // 하늘: 2048×720 한 장. 화면보다 넓게 늘리고, 끝까지 스크롤해도 오른쪽이 비지 않는 배율만 준다
    if (has('battle_sky')) {
      const k = Math.max(1, (W * 1.05) / 2048);
      const sf = Math.min(0.1, (2048 * k - W) / R);
      this.bgObjs.push(this.add.image(0, 0, 'battle_sky').setOrigin(0).setScale(k, 1).setScrollFactor(sf, 1).setDepth(LAYER.sky));
    } else {
      // 최후 폴백 — 단색 하늘
      this.bgObjs.push(this.add.rectangle(0, 0, W, FIELD.h, 0x7c8ba3).setOrigin(0).setScrollFactor(0).setDepth(LAYER.sky));
    }

    // 먼 산: 2048×360 띠를 필요한 만큼 이어 붙인다(밑변은 땅 위 변 + 30 — 아래 30px 은 땅 밑에 숨는다). 스크롤 0.2 (1차 0.35)
    const sfFar = 0.2;
    if (has('battle_far')) {
      const n = Math.ceil((W + R * sfFar + 64) / 2048);
      for (let i = 0; i < n; i++) {
        this.bgObjs.push(this.add.image(i * 2048, gTop + 30, 'battle_far').setOrigin(0, 1).setScrollFactor(sfFar, 1).setDepth(LAYER.far));
      }
      // 안개 띠 — far.png 아래변은 평균 알파 0.11 이지만 봉우리 밑동 100여 열이 알파 1 이라 땅 경계에서 산 밑이
      //   직선으로 잘려 보인다(통합 검수, 실측 row 330). 하늘색(sky.png y 380~420 평균 (237,225,208))으로 땅 위 변 −28 → 위 변 그라데이션.
      //   fillGradientStyle 은 WebGL 전용 — Canvas 는 단색 띠가 되므로 알파를 낮게 둔다.
      const haze = this.add.graphics().setScrollFactor(sfFar, 1).setDepth(LAYER.haze);
      if (this.isWebGL) {
        haze.fillGradientStyle(0xede1d0, 0xede1d0, 0xede1d0, 0xede1d0, 0, 0, 0.9, 0.9);
        haze.fillRect(0, gTop - 28, n * 2048, 28);
      } else {
        haze.fillStyle(0xede1d0, 0.35).fillRect(0, gTop - 14, n * 2048, 14);
      }
      this.bgObjs.push(haze);
    } else {
      const g = this.add.graphics().setScrollFactor(sfFar, 1).setDepth(LAYER.far);
      g.fillStyle(0x55627a, 0.8);
      for (let x = 0; x < 4200; x += 300) g.fillTriangle(x, gTop + 30, x + 150, gTop - 100, x + 300, gTop + 30);
      this.bgObjs.push(g);
    }

    // 중경(2차): 2048×260 나무·언덕·안개 띠, 위 알파 페이드. 밑변은 MID_BASE — 땅(층 3)의 페이드가 덮고 뒤 안개(층 4)가 경계를 흐린다
    if (has('field_mid')) {
      const sfMid = 0.5;
      const n = Math.ceil((W + R * sfMid + 64) / 2048);
      const my = ground2 ? MID_BASE.ground2 : MID_BASE.ground1;
      for (let i = 0; i < n; i++) {
        this.bgObjs.push(this.add.image(i * 2048, my, 'field_mid').setOrigin(0, 1).setScrollFactor(sfMid, 1).setDepth(LAYER.mid));
      }
    }

    // 땅: 2차 2048×360 두 장(아래 변 = y 720) / 1차 1024×320 타일 4장(y 400~720). 전장 3200 을 덮는다
    if (ground2) {
      for (let i = 0; i < 2; i++) this.bgObjs.push(this.add.image(i * 2048, gImgTop, 'field_ground').setOrigin(0).setDepth(LAYER.ground));
    } else if (has('battle_ground')) {
      for (let i = 0; i < 4; i++) {
        this.bgObjs.push(this.add.image(i * 1024, FIELD.top, 'battle_ground').setOrigin(0).setDepth(LAYER.ground));
      }
    } else {
      this.bgObjs.push(this.add.rectangle(0, FIELD.top, FIELD.w + 200, FIELD.h - FIELD.top, 0x9a8258).setOrigin(0).setDepth(LAYER.ground));
    }

    // 땅 원근: 위(먼 곳) 어둡게 알파 0.35 → 아래 0. BootScene 의 4×64 그라데이션 텍스처를 늘린다(없으면 WebGL Graphics)
    //   2차 땅은 페이드 구간 중간(y 380)부터 — 그 위는 땅 알파가 옅어 그라데이션만 떠 보인다
    const shTop = ground2 ? gTop - 20 : gTop;
    const gh = FIELD.h - shTop;
    if (has('battle_shade')) {
      this.bgObjs.push(this.add.image(0, shTop, 'battle_shade').setOrigin(0).setDisplaySize(FIELD.w, gh).setDepth(LAYER.shade));
    } else if (this.isWebGL) {
      const sh = this.add.graphics().setDepth(LAYER.shade);
      sh.fillGradientStyle(0x0e0a18, 0x0e0a18, 0x0e0a18, 0x0e0a18, 0.35, 0.35, 0, 0);
      sh.fillRect(0, shTop, FIELD.w, gh * 0.8);
      this.bgObjs.push(sh);
    }

    // 안개 두 겹: 뒤(층 4)는 지평선에 — 땅 위 변의 직선을 흐린다, 앞(층 950)은 y 650 근처에 옅게. updateFog 가 천천히 흘린다
    if (has('field_fog')) {
      const n = Math.ceil(FIELD.w / 1024) + 2;       // 한 장 더: 흘러도 왼쪽이 비지 않게 −1024 부터 깐다
      for (let i = 0; i < n; i++) {
        const b = this.add.image((i - 1) * 1024, FOG.backY, 'field_fog').setOrigin(0, 0.5).setAlpha(FOG.backAlpha).setDepth(LAYER.fogBack);
        const f = this.add.image((i - 1) * 1024, FOG.frontY, 'field_fog').setOrigin(0, 0.5).setScale(1, FOG.frontScaleY).setAlpha(FOG.frontAlpha).setDepth(LAYER.fogFront);
        b.baseX = f.baseX = (i - 1) * 1024;
        this.fogBack.push(b);
        this.fogFront.push(f);
        this.bgObjs.push(b, f);
      }
    }
  }

  /** 안개를 천천히 흘린다 — 뒤는 오른쪽으로 6px/s, 앞은 왼쪽으로 11px/s. 1024 주기라 baseX 에서 나머지만 더한다 */
  updateFog(delta) {
    if (!this.fogBack.length) return;
    // (통합) 앞 안개는 ×1.8 로 흐른다 → fogOff 를 1024 로 감으면 감기는 순간 b 가 819→0 으로 튄다(170초마다, 검수). 공통 주기 5120(1.8 = 9/5)
    this.fogOff = (this.fogOff + delta * 0.006) % 5120;
    const a = this.fogOff % 1024, b = (this.fogOff * 1.8) % 1024;
    for (let i = 0; i < this.fogBack.length; i++) {
      this.fogBack[i].x = this.fogBack[i].baseX + a;
      this.fogFront[i].x = this.fogFront[i].baseX + 1024 - b;
    }
  }

  /**
   * 소품·진영 깃발(2차, 있는 것만). 한 번만 만든다 — 폭과 무관.
   * 깊이: 땅 띠 위쪽 가장자리(y ≤ top+20)는 층 6(모든 유닛 뒤) 안에서 y 순, 그 아래는 y 그대로(유닛과 같이 정렬).
   */
  buildProps() {
    this.props = [];
    for (let i = 0; i < PROPS.length; i++) {
      const [key, x, y, scale, flip] = PROPS[i];
      if (!this.textures.exists(key)) continue;
      // origin: 진영 깃발은 장대 밑동(통합 실측: 장대 x 9~12/64 → 0.17, 밑동 y 186/192 → 0.97) / 소품은 바닥 그림자만큼 위
      //   (통합 실측 — 불투명 바닥선/높이: 막사 150/160 · 목책 93/99 · 고목 238/254 · 바위 150/160·160/171 = 전부 0.936~0.939 → 0.94).
      //   뒤집기는 flipX 가 아니라 음수 scaleX — flipX 는 그림 상자 안에서만 뒤집어 장대가 origin 에서 떨어진다
      const banner = key === 'field_banner_g' || key === 'field_banner_b';
      const o = this.add.image(x, y, key).setOrigin(banner ? 0.17 : 0.5, banner ? 0.97 : 0.94).setScale(flip ? -scale : scale, scale)
        .setDepth(y <= FIELD.top + 20 ? LAYER.prop + y * 0.001 : y);
      this.props.push(o);
    }
  }

  /** main.js relayout — 논리 폭이 바뀌었을 때 카메라 경계·배경만 다시 */
  applyBounds() {
    W = this.scale.width;
    this.cameras.main.setBounds(0, 0, FIELD.w, FIELD.h);
    this.buildBackground();
  }

  // ─────────────────────────────────────────────────────────────
  // 유닛 스프라이트 풀 + 그림자
  // ─────────────────────────────────────────────────────────────

  buildUnits() {
    /** @type {Phaser.GameObjects.Sprite[]} 쉬는 스프라이트 */
    this.pool = [];
    /** unit.id → Sprite */
    this.spriteById = new Map();
    this.texCache = new Map();
    for (let i = 0; i < 260; i++) this.pool.push(this.makeUnitSprite());
    // 그림자 — Graphics 하나에 매 프레임 전부 다시 그린다 (§4.1). 무장 발밑 편 색 링도 여기에 같이 그린다(스프라이트 안 늘린다)
    this.shadowG = this.add.graphics().setDepth(LAYER.shadow);
    // 조종 무장 발밑 빛 무리
    this.playerGlow = this.textures.exists('glow')
      ? this.add.image(0, 0, 'glow').setTint(0xa8ffb8).setBlendMode(Phaser.BlendModes.ADD)
        .setScale(0.55, 0.28).setAlpha(0.5).setDepth(LAYER.glow).setVisible(false)
      : null;
  }

  makeUnitSprite() {
    return this.add.sprite(-200, -200, 'unit_inf').setOrigin(0.5, 1).setActive(false).setVisible(false);
  }

  /**
   * 병종·편(무장은 무장 key) → 그림 기록 { key(서 있는 그림), atk(공격 그림|null), scale, oy, tint(null = 그림에 편 색이 들어 있음), h, sw, sh }.
   * 2차(BATTLE_ART §1): u2_<kind>_<g|b>_stand/attack · u2_gen_<key>_stand/attack (128×160, origin 0.5·0.95) — 편 색이 그림에 있어 tint 안 함.
   *   stand 가 없으면 그 병종·편만 1차로 폴백, attack 만 없으면 교체 없이 stand 한 장(코드 찌르기 연출은 그대로).
   * 1차: 일러스트(bunit_*)가 있으면 0.3배(무장 0.42), 없으면 코드 생성 실루엣. 편 색은 tint.
   *   실제 납품 96×128 일러스트(assets/battle/NOTES.md 실측, 통합에서 맞춤): 발밑이 y125(아래 변 −2px) → origin (0.5, 0.98).
   *   알파 폭×높이 inf 66×124 · spear 38×124 · bow 81×124 · cav 92×96 · general_left 86×124 · general_right 61×124.
   *   0.3배면 병사 높이 37px(코드 실루엣 34 와 비슷), 기병만 말이 넓어 96 높이라 ×1.15(→33px) 로 키운다. 무장 0.42 → 52px.
   * Canvas 렌더러는 setTint 를 무시하므로(Phaser: tint 는 WebGL 전용) 편 색을 입힌 캔버스 텍스처를 따로 만든다.
   */
  texFor(u) {
    const isGen = u.kind === 'general';
    const gkey = isGen ? (u.key != null ? u.key : (this.genMeta.get(u.id) || {}).key) : null;
    const k = isGen ? `general:${u.side}:${gkey}` : `${u.kind}:${u.side}`;
    let t = this.texCache.get(k);
    if (t) return t;
    const has = (key) => this.textures.exists(key);
    const base2 = isGen ? `u2_gen_${gkey}` : `u2_${u.kind}_${u.side === 'left' ? 'g' : 'b'}`;
    if (has(`${base2}_stand`)) {
      const m = isGen ? U2.general : u.kind === 'cav' ? U2.cav : U2.soldier;
      t = { key: `${base2}_stand`, atk: has(`${base2}_attack`) ? `${base2}_attack` : null, scale: m.scale, oy: U2.oy, tint: null, h: m.h, sw: m.sw, sh: m.sh };
      // (통합) 몸 중심 열을 u.x 위로 — 오른쪽 보기 기준 화면 px. syncSprites 가 보는 방향(f)을 곱해 뺀다(flipX 는 상자 안에서 뒤집힌다)
      const an = U2_ANCHOR[isGen ? `gen_${gkey}` : u.kind];
      if (an) { t.ax = (an[0] - 64) * m.scale; t.axAtk = (an[1] - 64) * m.scale; }
    } else {
      const m = isGen ? U1.general : U1.soldier;
      const tint = isGen ? GENERAL_COLOR[u.side] : SIDE_COLOR[u.side];
      const ill = isGen ? `bunit_general_${u.side}` : `bunit_${u.kind}`;
      if (has(ill)) t = { key: ill, atk: null, scale: isGen ? 0.42 : u.kind === 'cav' ? 0.3 * 1.15 : 0.3, oy: 0.98, tint, h: m.h, sw: m.sw, sh: m.sh };
      else {
        const code = isGen ? 'unit_general' : `unit_${u.kind}`;
        t = { key: has(code) ? code : 'unit_inf', atk: null, scale: 1, oy: 1, tint, h: isGen ? 60 : 34, sw: m.sw, sh: m.sh };
      }
      if (!this.isWebGL) t.key = this.tintedTexture(t.key, tint);
    }
    this.texCache.set(k, t);
    return t;
  }

  /** Canvas 폴백: 흰 실루엣 텍스처에 색을 곱한 사본(`<key>_t<hex>`)을 한 번 만들어 쓴다 */
  tintedTexture(key, color) {
    const tk = `${key}_t${color.toString(16)}`;
    if (this.textures.exists(tk)) return tk;
    const src = this.textures.get(key).getSourceImage();
    if (!src || !src.width) return key;
    const w = src.width, h = src.height;
    const t = this.textures.createCanvas(tk, w, h);
    const c = t.context;
    c.drawImage(src, 0, 0);
    c.globalCompositeOperation = 'multiply';
    c.fillStyle = '#' + color.toString(16).padStart(6, '0');
    c.fillRect(0, 0, w, h);
    c.globalCompositeOperation = 'destination-in';   // 원본 알파로 되돌린다
    c.drawImage(src, 0, 0);
    t.refresh();
    return tk;
  }

  /** 피격 플래시가 끝나면 원래 색으로 — 1차는 편 색 tint, 2차 그림은 tint 없음 */
  restoreTint(s) {
    if (s.baseTint != null) s.setTint(s.baseTint);
    else s.clearTint();
  }

  acquire(u) {
    const s = this.pool.pop() || this.makeUnitSprite();
    const t = this.texFor(u);
    s.setTexture(t.key).setScale(t.scale).setOrigin(0.5, t.oy)
      .setAlpha(1).setAngle(0).setActive(true).setVisible(true);
    s.tex = t;
    s.curKey = t.key;             // 지금 끼워 둔 텍스처(stand/attack 교체 — 바뀔 때만 setTexture)
    s.baseTint = t.tint;
    this.restoreTint(s);
    s.uid = u.id;
    s.dying = false;
    s.flashing = false;
    s.flashUntil = 0;
    s.kb = 0;
    s.flag = this.flagByUnit.get(u.id) || null;   // 기수면 깃발 Sprite
    if (s.flag) s.flag.setVisible(true).setAlpha(1).setAngle(0);
    this.spriteById.set(u.id, s);
    return s;
  }

  release(s) {
    this.tweens.killTweensOf(s);
    s.setActive(false).setVisible(false).setAngle(0).setAlpha(1);
    s.dying = false;
    if (s.flag) {
      this.tweens.killTweensOf(s.flag);
      s.flag.setVisible(false);
      s.flag = null;
    }
    this.spriteById.delete(s.uid);
    s.uid = -1;
    this.pool.push(s);
  }

  /** 죽음 — 발을 축으로 뒤로 넘어지며(90°) 알파 0, 1.2초 뒤 풀로. 데칼·먼지는 'death' 이벤트 쪽(handleEvents) */
  startDeath(s, u) {
    s.dying = true;
    this.restoreTint(s);
    s.flashing = false;
    if (s.curKey !== s.tex.key) { s.setTexture(s.tex.key); s.curKey = s.tex.key; }   // 공격 자세로 죽지 않게
    if (s.flag) this.tweens.add({ targets: s.flag, alpha: 0, angle: -70 * (u.facing || 1), duration: 320 });
    this.tweens.add({ targets: s, angle: -90 * (u.facing || 1), duration: 260, ease: 'Quad.easeIn' });
    this.tweens.add({
      targets: s, alpha: 0, duration: 650, delay: 550,
      onComplete: () => this.release(s),
    });
  }

  /**
   * 기수(2차) — 부대(무장)마다 병사 3명이 작은 부대 깃발(field_flag_<g|b>)을 등 뒤에 든다. 유닛 Sprite 는 그대로 하나, 깃발만 별도 Sprite(편당 6).
   * 그림은 깃대가 왼쪽·천이 오른쪽 → 오른쪽 보는 유닛은 음수 scaleX 로 천을 뒤(왼쪽)로 날린다. origin 은 깃대 밑동(0.13, 1).
   */
  buildBearers() {
    for (const f of this.flagByUnit.values()) f.destroy();
    this.flagByUnit.clear();
    const count = new Map();   // generalId → 지금까지 센 병사 수
    const units = this.sim.units;
    for (let i = 0; i < units.length; i++) {
      const u = units[i];
      if (u.kind === 'general') continue;
      const n = count.get(u.generalId) || 0;
      count.set(u.generalId, n + 1);
      if (!BEARER_SLOTS.includes(n)) continue;
      const key = u.side === 'left' ? 'field_flag_g' : 'field_flag_b';
      if (!this.textures.exists(key)) continue;
      const f = this.add.sprite(u.x, u.y, key).setOrigin(0.13, 1).setScale(FLAG_SCALE).setVisible(false);   // 납품 그림 깃대 x 5~7/48
      this.flagByUnit.set(u.id, f);
    }
  }

  /** 무장 이름표(붓글씨, 머리 위) — 발밑 링은 syncSprites 가 그림자 Graphics 에 같이 그린다. 전장에서 찾기 쉽게 */
  buildGeneralViews() {
    for (const v of this.genViews) v.label.destroy();
    this.genViews = [];
    for (const meta of this.genMeta.values()) {
      const u = meta.unit;
      const label = this.add.text(u.x, u.y, meta.name, {
        fontFamily: '"Nanum Brush Script", "Song Myung", serif', fontSize: '22px',
        color: this.labelColor(u.id, meta.side),
        stroke: '#1a120c', strokeThickness: 4,
      }).setOrigin(0.5, 1).setDepth(LAYER.name);
      if (typeof label.setResolution === 'function') label.setResolution(1.5);   // 줌 1.15~1.25 에서 덜 뭉개지게
      this.genViews.push({ unit: u, label, side: meta.side, color: SIDE_COLOR[meta.side], h: this.texFor(u).h });
    }
  }

  /** 전장 이름표 색 — 고른 무장은 금색. (3차) 고른 무장이 바뀌면 refreshLabels 가 다시 칠한다 */
  labelColor(id, side) {
    return id === this.playerId ? '#ffe9a8' : side === 'left' ? '#d6ffd9' : '#d6e4ff';
  }

  refreshLabels() {
    for (const v of this.genViews) v.label.setColor(this.labelColor(v.unit.id, v.side));
    // 발밑 빛 무리: 수동 0.5(기존 값) / 자동이면 옅게 — 「따라가며 보고 있을 뿐」
    if (this.playerGlow) this.playerGlow.setAlpha(this.auto ? 0.25 : 0.5);
  }

  /**
   * 유닛 → 스프라이트 위치·연출. for 한 번 (§4.1 + BATTLE_ART §5).
   *   이동: 상하 bob ±2px 6Hz + 속도 방향 기울기 ±6° / 공격: attackT 로 전방 찌르기 8px(무장 12) + 0.15~0.75 구간 attack 그림
   *   피격: 0.1초 흰 tint / 기절: 흔들림 / 넉백: kb 각도(−40°→0, 밀려나는 쪽으로 젖혀진다)가 감쇠 / 기수: 깃발이 따라다니며 펄럭임(scaleX)
   */
  syncSprites(time, delta = 16.7, stopped = false) {
    const units = this.sim.units;
    const sg = this.shadowG;
    const at = this.animT;
    const kbDecay = Math.pow(0.86, delta / 16.67);   // 프레임 속도와 무관하게 같은 감쇠(250ms 에 −40° → −4°)
    sg.clear();
    sg.fillStyle(0x000000, 0.28);
    // 그림자에 편 색을 살짝 섞는다 — 병사 그림이 작아(폰 20px) 투구·갑옷 색만으론 아군/적군이 한눈에 안 갈린다.
    // 유닛 배열은 편별로 이어져 있어 fillStyle 호출은 프레임당 몇 번뿐이다.
    let shadowSide = null;
    let player = null;
    for (let i = 0; i < units.length; i++) {
      const u = units[i];
      let s = this.spriteById.get(u.id);
      if (u.state === 'gone') {
        if (s && !s.dying) this.release(s);
        continue;
      }
      if (!s) {
        if (u.state === 'dead') continue;
        s = this.acquire(u);
      }
      if (s.dying) continue;
      if (u.state === 'dead' && !this.pendingSkill) { this.startDeath(s, u); continue; }   // (검수 제안) 컷신 중엔 아직 서 있다 — 복귀 프레임에 쓰러진다

      const t = s.tex;
      const isGen = u.kind === 'general';
      const f = u.facing < 0 ? -1 : 1;
      let dx = 0, dy = 0, ang = 0;
      let want = t.key;
      if (u.state === 'move' || u.state === 'flee') {
        dy = Math.sin(at * 0.0377 + u.id * 1.7) * 2;   // 6Hz, 유닛마다 위상 다르게
        ang = u.vx * 0.045;                            // 달리는 쪽으로 숙인다: 보병 95px/s → 4.3°, 기병·무장은 ±6° 에서 자른다
        if (ang > 6) ang = 6; else if (ang < -6) ang = -6;
      } else if (u.state === 'attack') {
        const aT = u.attackT || 0;
        const k = Math.sin(Math.PI * aT);  // 0→1→0
        dx = f * (isGen ? 12 : 8) * k;
        // attack 그림이 있으면 자세는 그림이 맡는다 → 기울기는 조금만. 없으면 1차처럼 크게 숙인다
        ang = f * (t.atk ? (isGen ? 8 : 6) : (isGen ? 18 : 14)) * k;
        if (t.atk && aT >= 0.15 && aT <= 0.75) want = t.atk;
      } else if (u.state === 'stun') {
        ang = Math.sin(at * 0.02 + u.id) * 12;
      }
      if (s.curKey !== want) { s.setTexture(want); s.curKey = want; }
      if (s.kb) {
        ang += s.kb;
        // (통합) 히트스톱 동안은 감쇠를 멈춘다 — 무장기의 knockback 은 skill 과 같은 프레임에 와서, 멈춘 120ms 사이에 ±40° 가 13° 까지
        //   풀려 버리고 정작 밀려날 땐 회전이 안 남았다(검수)
        if (!stopped) s.kb *= kbDecay;
        if (s.kb < 0.5 && s.kb > -0.5) s.kb = 0;
      }
      if (s.flashing && time >= s.flashUntil) {
        this.restoreTint(s);
        s.flashing = false;
      }
      const bx = u.x + dx;                              // 몸(발밑) 자리
      s.x = bx - f * ((want === t.atk ? t.axAtk : t.ax) || 0);   // U2_ANCHOR — 그림 상자를 밀어 몸 중심 열이 bx 에 오게
      s.y = u.y + dy;
      s.flipX = f < 0;
      s.angle = ang;
      s.depth = u.y;
      const fl = s.flag;
      if (fl) {
        fl.x = bx - f * 6;                              // 깃대는 몸 기준(상자 기준이면 stand↔attack 교체 때 깃발이 튄다)
        fl.y = s.y - t.h * 0.42;                       // 깃대 밑동 = 허리 뒤
        // 천이 등 뒤로 + 펄럭임. ※ flipX 는 그림 상자 안에서만 뒤집어(깃대가 origin 에서 떨어져 나간다) 음수 scaleX 로 origin(깃대) 기준 거울
        fl.scaleX = (f > 0 ? -FLAG_SCALE : FLAG_SCALE) * (0.8 + 0.2 * Math.sin(at * 0.009 + u.id));
        fl.angle = ang * 0.6 - f * 7;
        fl.depth = u.y - 0.5;
      }
      // smoothness 8: 기본 32 면 244개 × 매 프레임 32각형 할당·삼각분할 — 18×6px 타원엔 8각형이면 같아 보이고 비용 1/4(통합 검수)
      if (u.side !== shadowSide) { shadowSide = u.side; sg.fillStyle(u.side === 'left' ? 0x0f4a22 : 0x13307a, 0.42); }
      sg.fillEllipse(u.x, u.y + 1, t.sw, t.sh, 8);
      if (u.id === this.playerId) player = u;
    }
    // 무장: 발밑 편 색 링(그림자 Graphics 에 같이) + 이름표
    const gv = this.genViews;
    for (let i = 0; i < gv.length; i++) {
      const v = gv[i], u = v.unit;
      const on = u.state !== 'dead' && u.state !== 'gone';
      if (v.label.visible !== on) v.label.setVisible(on);
      if (!on) continue;
      sg.fillStyle(v.color, 0.25);
      sg.fillEllipse(u.x, u.y + 1, 56, 18, 16);
      sg.lineStyle(2.5, v.color, 0.95);
      sg.strokeEllipse(u.x, u.y + 1, 56, 18, 16);
      v.label.x = u.x;
      v.label.y = u.y - v.h - 6;
    }
    if (this.playerGlow) {
      if (player) this.playerGlow.setPosition(player.x, player.y + 2).setVisible(true);
      else this.playerGlow.setVisible(false);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 카메라 — 조종 무장을 lerp 0.08 로 따라가며 전방 120px 앞서 본다. 줌 1.15(무장기 때 1.25 펀치), 경계 0~3200.
  //   줌 z 면 보이는 폭은 W/z, 화면 가운데는 scrollX + W/2 → 가운데를 [W/2z, 3200 − W/2z] 로 자른다(scrollX 는 음수도 된다).
  //   세로는 보이는 아래 변을 y 720 에 붙인다(땅 띠가 화면 아래쪽, 하늘 위 94px 은 HUD 뒤로 잘린다).
  // ─────────────────────────────────────────────────────────────

  setupCamera() {
    const cam = this.cameras.main;
    cam.setZoom(CAM_ZOOM);
    cam.setBounds(0, 0, FIELD.w, FIELD.h);
    cam.scrollX = this.scrollXFor(W / 2, CAM_ZOOM);
    cam.scrollY = this.scrollYFor(CAM_ZOOM);
  }

  /** 화면 가운데가 centerX 를 보게 하는 scrollX (전장 밖이 안 보이게 자른다) */
  scrollXFor(centerX, zoom) {
    const hw = W / (2 * zoom);
    return Phaser.Math.Clamp(centerX, hw, Math.max(hw, FIELD.w - hw)) - W / 2;
  }

  /** 보이는 아래 변을 전장 아래 변에 붙이는 scrollY */
  scrollYFor(zoom) {
    return (FIELD.h - FIELD.h / zoom) / 2;
  }

  /** 따라갈 무장 — 플레이어, 죽었으면 살아 있는 아군 무장, 없으면 마지막 위치 */
  camTarget() {
    const p = this.playerUnit;
    if (p && p.state !== 'dead' && p.state !== 'gone') return p;
    const gens = this.sim.generalsOf('left') || [];
    return gens.find((u) => u.state !== 'dead' && u.state !== 'gone') || p || null;
  }

  /** @param sp (3차) 배속 — 유닛이 sp 배로 빨리 움직이므로 추적 lerp 도 sp 배로(안 그러면 ×3 에서 무장이 화면 가운데서 80px 앞서 달린다). 줌 펀치는 실시간 */
  updateCamera(time, delta, sp = 1) {
    const cam = this.cameras.main;
    // 줌 펀치: 0.2초에 1.25 까지(easeOut) → 0.32초에 복귀(cos). 트윈·zoomTo 대신 직접 — 재발동·히트스톱과 안 엉킨다
    let z = CAM_ZOOM;
    const pt = time - this.punchAt;
    if (pt >= 0 && pt < PUNCH_IN + PUNCH_OUT) {
      let k;
      if (pt < PUNCH_IN) { const a = 1 - pt / PUNCH_IN; k = 1 - a * a; }
      else k = 0.5 + 0.5 * Math.cos(Math.PI * (pt - PUNCH_IN) / PUNCH_OUT);
      z += (CAM_PUNCH - CAM_ZOOM) * k;
    }
    if (cam.zoom !== z) cam.setZoom(z);
    cam.scrollY = this.scrollYFor(z);
    const t = this.camTarget();
    if (!t) return;
    // 목표도 경계 안으로 잘라 두어야 전장 끝에서 lerp 가 벽에 눌려 느려지지 않는다(카메라 bounds 는 preRender 에서 한 번 더 자른다)
    const want = this.scrollXFor(t.x + (t.facing < 0 ? -1 : 1) * CAM_LEAD, z);
    const k = 1 - Math.pow(1 - CAM_LERP, (delta * sp) / 16.67);   // 프레임 속도와 무관하게 같은 감쇠
    cam.scrollX += (want - cam.scrollX) * k;
  }

  // ─────────────────────────────────────────────────────────────
  // 입력 — 왼쪽 반 터치 = 가상 조이스틱(터치한 자리에 생김). 키보드 WASD/화살표, Space, 1/2/3.
  //   (3차) Tab 다음 무장 · Q 자동/수동 · X/+/− 배속. 자동일 때는 조이스틱이 안 생기고, 왼쪽 반을 끌거나 이동 키를 누르면 수동으로 돌아온다.
  //   조이스틱 위치는 이벤트가 아니라 매 프레임 포인터를 직접 읽는다 — HUD 버튼을 누른 손가락과 같은 touchmove 에
  //   묶이면 위 씬(HUD)이 그 이벤트를 삼켜(globalTopOnly) 아래 씬의 pointermove 가 빠질 수 있어서다.
  // ─────────────────────────────────────────────────────────────

  setupInput() {
    // main.js activePointers 2 + MapScene 1 = 3. 조이스틱 + 버튼 + 여유 → 4개 확보
    const have = this.input.manager.pointers.length;
    if (have < 4) this.input.addPointer(4 - have);

    this.joyG = this.add.graphics().setScrollFactor(0).setDepth(5000).setVisible(false);
    this.input.on('pointerdown', this.onPointerDown, this);
    this.input.on('pointerup', this.onPointerUp, this);
    this.input.on('pointerupoutside', this.onPointerUp, this);
    this.input.on('gameout', this.endJoy, this);

    const kb = this.input.keyboard;
    this.keys = null;
    if (kb) {
      this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT');
      kb.on('keydown-SPACE', () => this.tryUseSkill());
      kb.on('keydown-ONE', () => this.command('charge'));
      kb.on('keydown-TWO', () => this.command('hold'));
      kb.on('keydown-THREE', () => this.command('retreat'));
      // (3차) Tab = 다음 무장 · Q = 자동/수동 · X 또는 + = 배속 올림(3 다음은 1) · − = 배속 내림. 1/2/3 은 병법이라 못 쓴다.
      //   Tab 은 브라우저가 포커스를 캔버스 밖으로 옮기므로 기본 동작을 막는다(addCapture — 헤드리스 흉내엔 없어서 있는지 본다)
      if (typeof kb.addCapture === 'function') kb.addCapture('TAB');
      const once = (fn) => (ev) => { if (!ev || !ev.repeat) fn(); };   // 누르고 있을 때의 자동 반복은 버린다(토글이 깜빡인다)
      kb.on('keydown-TAB', once(() => this.cycleGeneral()));
      kb.on('keydown-Q', once(() => this.toggleAuto()));
      kb.on('keydown-X', once(() => this.cycleSpeed()));
      kb.on('keydown-PLUS', once(() => this.cycleSpeed()));
      kb.on('keydown-NUMPAD_ADD', once(() => this.cycleSpeed()));
      kb.on('keydown-MINUS', once(() => this.setSpeed(this.speed - 1)));
      kb.on('keydown-NUMPAD_SUBTRACT', once(() => this.setSpeed(this.speed - 1)));
    }
  }

  onPointerDown(p) {
    if (this.joy || this.ended || !this.sim) return;
    if (p.x >= W / 2 || p.y < HUD_TOP) return;
    // (3차) 자동일 때는 조이스틱을 안 만든다 — 누른 자리만 기억해 두고, 끌면(applyInput) 수동으로 돌아오며 그 자리에 조이스틱이 생긴다
    if (this.auto) {
      if (!this.joyPending) this.joyPending = { id: p.id, ox: p.x, oy: p.y };
      return;
    }
    this.joy = { id: p.id, ox: p.x, oy: p.y, dx: 0, dy: 0 };
    this.drawJoy();
  }

  onPointerUp(p) {
    if (this.joyPending && p.id === this.joyPending.id) this.joyPending = null;
    if (this.joy && p.id === this.joy.id) this.endJoy();
  }

  endJoy() {
    this.joy = null;
    this.joyPending = null;
    if (this.joyG) this.joyG.clear().setVisible(false);
  }

  pointerById(id) {
    const ps = this.input.manager.pointers;
    for (let i = 0; i < ps.length; i++) if (ps[i].id === id) return ps[i];
    return null;
  }

  /**
   * 조이스틱 그림. j.ox/oy 는 화면 좌표(포인터)인데, 카메라 줌은 scrollFactor 0 인 것도 화면 가운데 기준으로 z 배 키운다
   *   (화면 = c + z·(그린 자리 − c)) → 그릴 자리를 c + (화면 − c)/z, 크기를 1/z 로 역변환해야 손가락 밑에 제 크기로 나온다.
   *   (2차에서 줌 1 → 1.15 가 되며 추가. 입력 계산(onPointerDown·applyInput)은 화면 좌표 그대로라 손대지 않았다.)
   */
  drawJoy() {
    const j = this.joy;
    const g = this.joyG;
    const z = this.cameras.main.zoom || 1;
    const cx = W / 2, cy = FIELD.h / 2;
    const ox = cx + (j.ox - cx) / z, oy = cy + (j.oy - cy) / z, R = JOY_R / z;
    g.clear().setVisible(true);
    g.lineStyle(3 / z, 0xffffff, 0.35).strokeCircle(ox, oy, R);
    g.fillStyle(0xffffff, 0.08).fillCircle(ox, oy, R);
    const kx = ox + j.dx * R, ky = oy + j.dy * R;
    g.fillStyle(0xf6e9c9, 0.6).fillCircle(kx, ky, 26 / z);
    g.lineStyle(2 / z, 0x3a2a12, 0.6).strokeCircle(kx, ky, 26 / z);
  }

  /** 조이스틱·키보드 → setGeneralInput. 매 프레임 (0,0 이면 제자리에서 자동 공격만) */
  applyInput() {
    let dx = 0, dy = 0;
    // (3차) 자동 중 왼쪽 반을 누른 손가락이 AUTO_DRAG 넘게 끌렸으면 토스트 없이 수동으로 — 누른 자리에 조이스틱이 생겨 끌던 손가락이 그대로 이어진다
    if (this.joyPending) {
      const j = this.joyPending;
      const p = this.pointerById(j.id);
      if (!p || !p.isDown || !this.auto) this.joyPending = null;
      else if (Math.hypot(p.x - j.ox, p.y - j.oy) > AUTO_DRAG) {
        this.joyPending = null;
        this.setAuto(false);
        if (!this.auto && !this.joy) this.joy = { id: j.id, ox: j.ox, oy: j.oy, dx: 0, dy: 0 };
      }
    }
    if (this.joy) {
      const p = this.pointerById(this.joy.id);
      if (!p || !p.isDown) {
        this.endJoy();
      } else {
        const vx = p.x - this.joy.ox, vy = p.y - this.joy.oy;
        const d = Math.hypot(vx, vy);
        if (d > JOY_DEAD) {
          const m = Math.min(1, (d - JOY_DEAD) / (JOY_R - JOY_DEAD));
          dx = (vx / d) * m;
          dy = (vy / d) * m;
        }
        this.joy.dx = dx;
        this.joy.dy = dy;
        this.drawJoy();
      }
    }
    if (this.keys) {
      const k = this.keys;
      const kx = ((k.D.isDown || k.RIGHT.isDown) ? 1 : 0) - ((k.A.isDown || k.LEFT.isDown) ? 1 : 0);
      const ky = ((k.S.isDown || k.DOWN.isDown) ? 1 : 0) - ((k.W.isDown || k.UP.isDown) ? 1 : 0);
      if (kx || ky) {
        const n = Math.hypot(kx, ky);
        dx = kx / n;
        dy = ky / n;
        if (this.auto) this.setAuto(false);   // (3차) 자동 중 이동 키 = 조이스틱을 끈 것과 같다 → 수동 복귀
      }
    }
    // (3차) 자동: 전원 AI — sim 에 조종 무장이 없으니 입력도, 아래 「부대 따라가기」(수동 전용)도 없다
    if (this.auto) return;
    // 자동 따라가기 — 돌격 명령 뒤 손을 떼고 있으면 부대만 나가고 조종 무장이 혼자 남는다(첫 판에 누구나 겪는다).
    //   1.2초 이상 입력이 없고 병법이 돌격이면 자기 부대 중심을 향해 걷는다. 조이스틱·키를 건드리면 바로 수동으로 돌아온다.
    const now = this.time.now;
    if (dx || dy) {
      this.lastManualT = now;
    } else if (this.playerId != null && now - (this.lastManualT || 0) > 1200
      && this.sim.commandOf && this.sim.commandOf('left') === 'charge') {
      if (!this.followT || now - this.followT > 200) {           // 부대 중심은 0.2초마다만 다시 잰다
        this.followT = now;
        let sx = 0, sy = 0, n = 0;
        const us = this.sim.units;
        for (let i = 0; i < us.length; i++) {
          const u = us[i];
          if (u.generalId === this.playerId && u.id !== this.playerId && u.alive !== false
            && u.state !== 'dead' && u.state !== 'gone' && u.state !== 'flee') { sx += u.x; sy += u.y; n++; }
        }
        this.followTarget = n ? { x: sx / n, y: sy / n } : null;
      }
      const me = this.sim.unitById ? this.sim.unitById(this.playerId) : this.sim.units[this.playerId];
      const tg = this.followTarget;
      if (me && tg) {
        const vx = tg.x - me.x, vy = tg.y - me.y, d = Math.hypot(vx, vy);
        if (d > 70) { dx = (vx / d) * 0.85; dy = (vy / d) * 0.85; }
      }
    }
    if (this.playerId != null) this.sim.setGeneralInput('left', this.playerId, { dx, dy });
  }

  // ─────────────────────────────────────────────────────────────
  // HUD 가 부르는 것
  // ─────────────────────────────────────────────────────────────

  /** 병법 — 'charge' | 'hold' | 'retreat' (편 전체) */
  command(cmd) {
    if (!this.sim || this.ended) return;
    if (this.cmd.left === cmd) return;
    this.sim.command('left', cmd);
    this.cmd.left = cmd;
    sfx('click');
    this.events.emit('battle:command', { side: 'left', cmd });
  }

  /** 무장기 — 게이지 100 이면 sim 이 발동하고 'skill' 이벤트로 연출이 시작된다 */
  tryUseSkill() {
    if (!this.sim || this.ended || !this.playerUnit) return false;
    const p = this.playerUnit;
    if (p.state === 'dead' || p.state === 'gone') return false;
    if (this.pendingSkill) return false;   // (3차 컷신) 컷신 중엔 무장기를 또 못 건다 — sim 은 멈춰 있는데 피해만 먼저 들어가면 화면과 어긋난다
    const ok = !!this.sim.useSkill('left', this.playerId);
    if (!ok) this.events.emit('battle:skillfail');
    return ok;
  }

  // ── 3차(docs/BATTLE_V3.md §1·§2): 조종 선택 · 자동/수동 · 배속 ──────────────

  /** 지금 조종 대상으로 고를 수 있는(살아서 싸우는) 왼쪽 무장 — sim 순서 */
  aliveGenerals() {
    const gens = (this.sim && this.sim.generalsOf('left')) || [];
    return gens.filter((u) => u.alive !== false && u.state !== 'dead' && u.state !== 'gone' && u.state !== 'flee');
  }

  /**
   * 고른 무장(unit)·자동 여부를 sim 에 반영하고 화면에 알린다. 모든 선택·토글·사망 전환이 여기로 모인다.
   *   sim.setPlayer 는 이전 조종 무장을 AI 로 돌리고 입력 벡터를 0 으로 한다. 조이스틱을 쥔 채 무장만 바꾸면 그 손가락이 새 무장을 몬다.
   * @param opts.silent   효과음 없이(사망 전환)
   * @param opts.remember 자동 여부를 registry 에 적는다 — 사용자가 고른 것만. 무장이 다 죽어 강제로 자동이 된 것은 안 적는다
   */
  applyPlayer(unit, auto, { silent = false, remember = true } = {}) {
    if (!this.sim || !this.canSwitch) return false;
    auto = !!auto || !unit;
    if (!this.sim.setPlayer('left', auto ? null : unit.id)) return false;
    if (unit) { this.playerUnit = unit; this.playerId = unit.id; }
    this.auto = auto;
    if (auto) this.endJoy();
    // 「입력 없으면 부대 따라가기」는 옛 무장 기준으로 재 둔 것 — 버리고, 바꾼 직후 1.2초는 제자리(바꾸자마자 혼자 걸어가면 당황스럽다)
    this.lastManualT = this.time.now;
    this.followT = 0;
    this.followTarget = null;
    if (remember && this.registry) this.registry.set(REG_AUTO, auto);
    this.refreshLabels();
    if (!silent) sfx('click');
    this.events.emit('battle:player', { id: this.playerId, auto });
    return true;
  }

  /** HUD 초상 탭 — 그 무장을 조종(수동). 이미 조종 중인 초상을 다시 탭하면 자동으로 */
  selectGeneral(id) {
    if (!this.sim || this.ended || !this.canSwitch) return false;
    const u = this.unitById.get(id);
    if (!u || u.side !== 'left' || u.kind !== 'general') return false;
    if (id === this.playerId && !this.auto) return this.applyPlayer(u, true);
    if (!this.aliveGenerals().includes(u)) return false;
    return this.applyPlayer(u, false);
  }

  /** Tab — 다음 무장. 자동/수동은 그대로 둔다(자동으로 구경하면서 볼 무장만 바꿀 수 있게) */
  cycleGeneral() {
    if (!this.sim || this.ended || !this.canSwitch) return false;
    const alive = this.aliveGenerals();
    if (!alive.length) return false;
    const next = alive[(alive.indexOf(this.playerUnit) + 1) % alive.length];
    if (next === this.playerUnit) return false;
    return this.applyPlayer(next, this.auto);
  }

  /** 자동(전원 AI) ↔ 수동(마지막으로 고른 무장, 죽었으면 살아 있는 다음 무장) */
  setAuto(on) {
    on = !!on;
    if (!this.sim || this.ended || !this.canSwitch || on === this.auto) return false;
    if (on) return this.applyPlayer(this.playerUnit, true);
    const alive = this.aliveGenerals();
    const u = alive.includes(this.playerUnit) ? this.playerUnit : alive[0];
    return u ? this.applyPlayer(u, false) : false;
  }

  toggleAuto() {
    return this.setAuto(!this.auto);
  }

  /**
   * 고른 무장이 죽었으면 살아 있는 다른 아군 무장으로 넘긴다(수동이면 수동 그대로 — 그 무장을 바로 조종), 없으면 자동.
   *   sim 이 아니라 여기서 하는 까닭: sim 은 (seed, 호출 열)의 순함수로 남긴다 — 「누가 다음인가·자동이었는가」는 화면 정책이고,
   *   sim 이 스스로 바꾸면 입력을 안 넣는 헤드리스 벤치(--player)의 둘째 무장이 멍하니 서서 기존 수치가 달라진다(sim.js setPlayer 주석).
   *   조이스틱 입력과 똑같이 「프레임 경계에서 부르는 외부 호출」이라 결정성 조건(같은 호출 순서 = 같은 결과)은 그대로다.
   */
  checkPlayerAlive() {
    const p = this.playerUnit;
    if (!p || !this.canSwitch || this.ended) return;
    if (p.alive !== false && p.state !== 'dead' && p.state !== 'gone' && p.state !== 'flee') return;
    const next = this.aliveGenerals()[0];
    if (next) this.applyPlayer(next, this.auto, { silent: true });
    else if (!this.auto) this.applyPlayer(null, true, { silent: true, remember: false });
  }

  /** 배속 1|2|3 — registry 에 기억(다음 전투에도). 인트로·종료 뒤에는 update 가 ×1 로 굴린다(값은 받아 둔다) */
  setSpeed(n) {
    n = Math.max(SPEEDS[0], Math.min(SPEEDS[SPEEDS.length - 1], Math.round(n) || 1));
    if (n === this.speed) return false;
    this.speed = n;
    if (this.registry) this.registry.set(REG_SPEED, n);
    sfx('click');
    this.events.emit('battle:speed', n);
    return true;
  }

  /** 배속 버튼 — ×1 → ×2 → ×3 → ×1 */
  cycleSpeed() {
    return this.setSpeed(SPEEDS[(SPEEDS.indexOf(this.speed) + 1) % SPEEDS.length]);
  }

  /** 결과 패널 「다시」 — 같은 seed·같은 군으로 다시 */
  restartBattle() {
    this.scene.stop('BattleHud');
    this.scene.restart();
  }

  /** 결과 패널 「지도로」 — MapScene 으로, UIScene 에 인트로 없이 토스트만. toastText 를 주면 그 문구(전투 시작 실패 등) */
  goMap(toastText) {
    const r = this.result || (this.sim && this.sim.result);
    const toast = toastText || (r ? (RESULT_TOAST[r.winner] || RESULT_TOAST.draw) : RESULT_TOAST.draw);
    this.scene.stop('BattleHud');
    this.scene.start('MapScene', { ui: { noIntro: true, toast } });
  }

  // ─────────────────────────────────────────────────────────────
  // 이벤트 → 연출
  // ─────────────────────────────────────────────────────────────

  handleEvents(time) {
    // (3차 컷신) 묵혀 둔 것을 먼저, 그 뒤에 새 이벤트
    const fresh = this.sim.drainEvents();
    const evs = this.heldEvents ? this.heldEvents.concat(fresh || []) : fresh;
    this.heldEvents = null;
    if (!evs || !evs.length) return;
    const cam = this.cameras.main;
    // 보이는 범위 — 줌 z 면 화면 가운데(scrollX + W/2) ± W/2z. 타격 이펙트·타격음은 이 안에서만(풀 60 을 화면 밖에 쓰지 않는다)
    const vc = cam.scrollX + W / 2, vh = W / (2 * (cam.zoom || 1)) + 60;
    const viewL = vc - vh, viewR = vc + vh;
    const sp = this.simSpeed || 1;   // (3차) 이번 프레임에 건 배속
    for (let i = 0; i < evs.length; i++) {
      const e = evs[i];
      switch (e.type) {
        case 'hit': {
          const s = this.spriteById.get(e.to);
          if (s && !s.dying) {
            s.setTintFill(0xffffff);
            s.flashing = true;
            s.flashUntil = time + 100;
          }
          const from = this.unitById.get(e.from);
          const to = this.unitById.get(e.to);
          const fromGen = from && from.kind === 'general';
          const toGen = to && to.kind === 'general';
          let vis = e.x > viewL && e.x < viewR;
          // (3차) 배속이면 실시간 1초에 타격이 sp 배로 몰린다 — fx 수명은 실시간이라 풀 60 이 바닥난다(×3 관전에서 건너뛴 이펙트 8%).
          //   병사끼리의 타격 이펙트·타격음만 sp 번에 한 번으로 솎는다(무장이 낀 타격·무장기·흰 플래시는 그대로). ×1 이면 아무것도 안 바뀐다
          if (sp > 1 && !fromGen && !toGen && !e.skill && (this.hitSeq = ((this.hitSeq || 0) + 1) % sp) !== 0) vis = false;
          const dir = from && from.facing < 0 ? -1 : 1;
          // 무장기 피해(e.skill)는 한 방에 수십 명 — 궤적 대신 불꽃만. 화살은 궤적 없음(작은 불꽃만)
          if (e.skill) this.fx.sparks(e.x, e.y - 20, 2);
          else if (from && from.kind === 'bow') { if (vis) this.fx.spawnSpark(e.x, e.y - 18, 30); }
          else if (from) {
            // 2차: 무장 공격 = slash_white 호 + 불꽃, 병사 = 불꽃 1 + 먼지 2. 텍스처가 없으면(false) 1차 Graphics 호
            if (fromGen) {
              if (vis && !this.fx.slashBig(from.x, from.y, dir)) this.fx.slash(e.x, e.y, dir, true);
              if (vis) this.fx.hit(e.x, e.y, dir, true);
            } else if (vis && !this.fx.hit(e.x, e.y, dir, toGen)) {
              this.fx.slash(e.x, e.y, dir, false);
            }
          }
          if (toGen) {
            this.fx.damage(e.x, e.y - 62, e.dmg, !!e.crit);
            this.fx.sparks(e.x, e.y - 30, e.crit ? 10 : 5);
          }
          // 타격음 — 화면 안, 90ms 에 한 번, 병사끼리는 셋에 하나만
          if (!e.skill && vis && time - this.lastHitSfx > 90 && (fromGen || toGen || e.to % 3 === 0)) {
            this.lastHitSfx = time;
            sfx('hit');
          }
          break;
        }
        case 'arrow':
          // (3차) e.ms 는 sim 시간 — 배속이면 화살 그림도 그만큼 빨리 날아야 피해가 들어가는 순간에 닿는다
          this.fx.arrow(e.x0, e.y0, e.x1, e.y1, e.ms / sp);
          break;
        case 'death': {
          // 2차: 먼지 뭉치 3 + 핏자국 데칼(20초 뒤 페이드). 먼지 텍스처가 없으면 1차 파티클
          //   (3차) 배속이면 먼지 뭉치를 3 → 2(×2) → 1(×3) 로 — 실시간 1초에 죽는 수가 sp 배라 fx 풀(60)을 죽음 먼지가 다 쓴다
          if (e.x > viewL && e.x < viewR && !this.fx.puffs(e.x, e.y, Math.max(1, 4 - sp))) this.fx.dust(e.x, e.y, 6);
          const u = this.unitById.get(e.id);
          const gen = u && u.kind === 'general';
          this.fx.decal(e.x, e.y + 2, 'blood', gen ? 84 : 40 + (e.id % 5) * 4, time);
          if (gen) {
            cam.shake(220, 0.006);
            this.fx.sparks(e.x, e.y - 30, 14);
          }
          break;
        }
        case 'flee':
          break;
        case 'skill':
          // (3차 컷신) 컷신이 뜨면 true — 뒤 이벤트(같은 틱의 hit·death·knockback, 또 다른 skill)는 복귀 때까지 묵힌다
          if (this.onSkill(e, time)) { this.heldEvents = evs.slice(i + 1); return; }
          break;
        case 'knockback': {
          const s = this.spriteById.get(e.id);
          if (s && !s.dying) {
            const dir = e.dx < 0 ? -1 : 1;
            s.kb = 40 * dir;          // 밀려나는 쪽으로 −40°(왼쪽)/+40° 젖혀졌다 syncSprites 에서 0 으로 감쇠 (1차는 28° 앞으로 숙임)
            this.fx.ghost(s, dir);
            if (s.x > viewL && s.x < viewR && !this.fx.puffs(s.x, s.y, 1, 36)) this.fx.dust(s.x, s.y, 3);
          }
          break;
        }
        case 'command': {
          // (통합) command() 가 누르는 즉시 emit 하고 sim 도 같은 명령을 이벤트로 돌려준다. 인트로 1.2초 동안은 이 큐가 안 비워져
          //   HUD 의 400ms 중복 제거 창을 넘겨 「돌격!」 이 두 번 떴다(검수) → 이미 반영된 왼쪽 명령은 다시 알리지 않는다
          const echo = e.side === 'left' && this.cmd.left === e.cmd;
          if (e.side === 'left' || e.side === 'right') this.cmd[e.side] = e.cmd;
          if (!echo) this.events.emit('battle:command', e);
          break;
        }
        case 'end':
          this.onEnd(e);
          break;
        default:
          break;
      }
    }
  }

  /**
   * 무장기 발동 — 히트스톱 120ms + 흔들림 0.35초 + 흰 flash + 줌 펀치 1.25 + 모양별 이펙트 + 범위 표시·먼지·컷인(HUD).
   *   cone(청룡참): slash_blue 가 range 만큼 날아가며 커진다 / circle(포효·쌍극): ring 이 2배로 퍼진다 + 패인 자국
   *   dash(맹공): 출발 impact → update 의 돌진 궤적(먼지) → 도착 impact.  맞은 적은 'knockback' 이벤트로 튕기며 회전한다.
   */
  onSkill(e, time = this.time.now) {
    const meta = this.genMeta.get(e.id);
    const sk = (meta && meta.skill) || resolveSkill(this.battleData || DEFAULT_DATA, e.skill, null);
    const facing = e.facing < 0 ? -1 : 1;
    // (3차 컷신, BATTLE_V3.md §3.3) 컷신(실시간 — 배속을 곱하지 않는다) 동안 sim 을 멈추고, 피해 연출은 컷신의 「복귀」 시각에 터뜨린다.
    //   cutinPlan 은 emit 전에 부른다(emit 하면 HUD 가 컷신을 띄우며 registry 에 「바쁨」을 적어 다음 계획이 short 가 된다).
    const plan = cutinPlan(this, { key: meta && meta.key, now: time });   // { mode, fire, impact, total } ms
    if (e.side === 'left' || e.side === 'right') this.skillUsed[e.side]++;
    sfx('skill');
    this.events.emit('battle:skill', { ...(meta || { id: e.id, side: e.side, name: '', key: null, skill: sk, color: 0xffd24a }), cutinMode: plan.mode });
    const p = { e, sk, facing, at: time + plan.impact };
    if (plan.impact <= 0) { this.skillImpact(p, time); this.hitStopUntil = time + HITSTOP_MS; return false; }   // 컷신 off — 2차처럼 바로
    this.hitStopUntil = p.at;               // 히트스톱 = 컷신 길이(복귀 시각까지)
    this.punchAt = time + plan.fire;        // 줌 펀치는 「발동」 박자에 시작 → 0.2초 뒤(복귀 직전) 1.25 정점
    this.pendingSkill = p;
    return true;
  }

  /** (3차 컷신) 피해 연출 — 컷신이 전장으로 복귀하는 순간(update 가 부른다). 2차까지 onSkill 이 발동 즉시 하던 것 그대로 */
  skillImpact(p, time) {
    const { e, sk, facing } = p;
    const cam = this.cameras.main;
    cam.shake(350, 0.012);
    cam.flash(120, 255, 255, 255);
    let drawn = false;
    if (sk.shape === 'cone') drawn = this.fx.skillCone(e.x, e.y, facing, sk.range);
    else if (sk.shape === 'dash') {
      drawn = this.fx.impact(e.x + facing * 20, e.y - 26, 150);
      const u = this.unitById.get(e.id);
      const data = this.battleData && this.battleData.SKILLS && this.battleData.SKILLS[sk.id];
      // (3차) dashMs 는 sim 시간 → 배속으로 나눈다(히트스톱은 실시간). 안 나누면 ×3 에서 돌진이 끝난 뒤에도 먼지 궤적이 0.3초 더 나온다
      if (u) this.dash = { unit: u, facing, until: time + HITSTOP_MS + ((data && data.dashMs) || 420) / (this.simSpeed || 1), next: 0 };
    } else {
      drawn = this.fx.skillRing(e.x, e.y, sk.range);
      this.fx.decal(e.x, e.y + 2, 'crater', Math.min(200, sk.range * 0.6), time);
    }
    this.fx.area(e.x, e.y, facing, sk, drawn ? 0.5 : 1);   // 2차 이펙트가 나갔으면 범위 표시는 옅게
    if (!this.fx.puffs(e.x, e.y, 5, 70)) this.fx.dust(e.x, e.y, 14);
    this.fx.sparks(e.x, e.y - 30, 18);
    sfx('hit');
  }

  /** 맹공 돌진 궤적 — 돌진하는 동안 45ms 마다 발밑 먼지, 끝나면 도착 impact */
  updateDash(time) {
    const d = this.dash;
    if (!d) return;
    const u = d.unit;
    if (time >= d.until || u.state === 'dead' || u.state === 'gone') {
      this.fx.impact(u.x + d.facing * 24, u.y - 26, 190);
      this.fx.puffs(u.x, u.y, 4, 64);
      this.dash = null;
    } else if (time >= d.next) {
      d.next = time + 45 / (this.simSpeed || 1);   // (3차) 배속이어도 궤적 먼지 개수는 같게
      this.fx.puffs(u.x - d.facing * 14, u.y, 1, 52);
    }
  }

  onEnd(e) {
    if (this.ended) return;
    this.ended = true;
    const r = this.sim.result || {
      winner: e && e.winner, reason: (e && e.reason) || '',
      leftAlive: this.sim.countAlive('left'), rightAlive: this.sim.countAlive('right'),
    };
    const skills = this.sim.skillCount && typeof this.sim.skillCount.left === 'number' ? this.sim.skillCount.left : this.skillUsed.left;
    this.result = { ...r, time: r.time != null ? r.time : this.sim.time, skills };
    this.freezeAt = this.time.now + 1500;
    this.endJoy();
    if (this.playerId != null) this.sim.setGeneralInput('left', this.playerId, { dx: 0, dy: 0 });
    sfx(r.winner === 'left' ? 'open' : 'close');
    this.time.delayedCall(900, () => {
      if (this.sys.isActive()) this.events.emit('battle:end', this.result);
    });
  }

  // ─────────────────────────────────────────────────────────────

  update(time, delta) {
    this.fx.update(time, delta);
    this.updateFog(delta);
    if (!this.sim) return;
    // 히트스톱(무장기 직후 120ms): sim 도 연출 시계(bob·펄럭임)도 멈춘다. 카메라·fx·입력은 계속 돈다
    //   이 동안의 delta 는 버린다(누적해 뒤에 따라잡지 않는다) — sim 은 step 호출 누계·입력만 보므로 결정성과 무관하고,
    //   sim.time(180초 제한·HUD 시계)만 실시간보다 무장기 한 번에 0.12초씩 늦어진다
    // (3차 컷신) 복귀 시각: 피해 연출 + 묵힌 이벤트(넉백 회전·피격 플래시·사망)를 한 프레임에 터뜨리고, 2차와 같은 120ms 멈칫.
    //   묵힌 것 안에 또 skill 이 있으면 onSkill 이 새 컷신(짧은 버전)을 걸고 hitStopUntil 을 다시 잡는다 → 그때는 멈칫을 덮지 않는다
    if (this.pendingSkill && time >= this.pendingSkill.at) {
      const p = this.pendingSkill;
      this.pendingSkill = null;
      this.skillImpact(p, time);
      this.handleEvents(time);
      if (!this.pendingSkill) this.hitStopUntil = time + HITSTOP_MS;
    }
    const stopped = time < this.hitStopUntil;
    // (3차) 배속 — sim 에 넘기는 시간과 연출 시계(bob·깃발·기절 흔들림)에 곱한다. sim 은 고정 틱 누적기라 step 을 더 많이 부를 뿐 결정성은 그대로.
    //   인트로 중엔 무시(×1), 끝난 뒤 죽음 연출 1.5초도 ×1. 히트스톱·줌 펀치·컷인(HUD)·결과 패널 트윈·안개는 실시간(time/트윈) 그대로다.
    const intro = time < this.introUntil;
    const sp = (intro || this.ended) ? 1 : this.speed;
    this.simSpeed = sp;
    if (!stopped) this.animT += delta * sp;

    // 「전투 개시」 동안은 sim 을 멈춘 채 첫 장면만 보여 준다
    if (intro) {
      this.syncSprites(time, delta);
      this.updateCamera(time, delta);
      return;
    }
    // 끝난 뒤 1.5초는 죽음 연출을 위해 더 굴리고, 그 뒤 얼린다
    const frozen = this.ended && time >= this.freezeAt;
    if (!frozen) {
      this.applyInput();
      if (!stopped) {
        // delta 를 ≤50ms 로 쪼개 최대 4번 — 남는 시간은 버린다(탭 복귀 폭주 방지). (3차) 배속이면 시간도 호출 상한도 그 배(≤50ms × ≤4×배속)
        const maxSteps = MAX_STEPS * sp;
        let remain = Math.min(delta * sp, MAX_STEP * maxSteps);
        let n = 0;
        while (remain > 0 && n < maxSteps) {
          const dt = Math.min(MAX_STEP, remain);
          this.sim.step(dt);
          remain -= dt;
          n++;
        }
        this.handleEvents(time);
        this.updateDash(time);
        if (!this.ended && this.sim.result && !this.pendingSkill) this.onEnd(null);   // (검수 제안) 컷신 중엔 종료 연출을 미룬다
        this.checkPlayerAlive();   // (3차) 고른 무장이 이번 프레임에 죽었으면 다음 무장으로
      }
    }
    // (3차) 넉백 회전 감쇠는 sim 의 넉백(250ms sim 시간)과 같이 풀려야 한다 → 배속을 곱한 delta. 카메라 추적도 같은 배로
    this.syncSprites(time, delta * sp, stopped);
    this.updateCamera(time, delta, sp);
  }
}
