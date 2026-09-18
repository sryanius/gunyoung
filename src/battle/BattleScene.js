// BattleScene — 실시간 횡스크롤 대군 전투 화면 (BATTLE.md §4.1).
//   sim(src/battle/sim.js)을 굴리고 그린다. sim 은 Phaser 를 모르고, 이 씬은 sim 의 §2.1 API 만 안다.
//   진입: this.scene.start('BattleScene', { seed, left?, right? })  ← UIScene 「출진」
//   위에 BattleHud 를 겹쳐 띄운다(병력 바·HP·버튼·결과). HUD 는 이 씬의 공개 필드를 읽고 메서드를 부른다:
//     읽기: sim, genMeta(Map unitId→meta), playerId, playerUnit, cmd, skillUsed, total, introUntil, ended, result, seed
//     호출: command(cmd) · tryUseSkill() · restartBattle() · goMap()
//     이벤트(this.events): 'battle:ready' | 'battle:skill'(meta) | 'battle:skillfail' | 'battle:command'(e) | 'battle:end'(result)
//   data.js·sim.js 는 동적 import — 없으면 아래 DEFAULT_DATA 와 assets/raw/battle/sim-stub.mjs(더미)로 돈다.
//
// 그리기 규칙(§4.1): 유닛 = Sprite 하나(풀), 깊이 = y, 그림자는 Graphics 하나에 전부, 애니는 프레임이 아니라 코드 연출.
// 성능: sim.step 은 delta 를 ≤50ms 로 쪼개 프레임당 최대 4번. 스프라이트 갱신은 for 한 번. 매 프레임 drainEvents.
//
// ※ 한글 문구를 새로 넣으면 factions.js 의 KOREAN_SAMPLE 에도 넣어라(tools/smoke.mjs 가 대조한다).

import { play as sfx } from '../sfx.js';
import { Fx } from './fx.js';

/** 전장 논리 크기·땅 띠 (§1) */
export const FIELD = { w: 3200, h: 720, top: 400, bottom: 690 };
/** 편 색 — 병사 tint (아군 초록·적 파랑, SPEC §4 세력색) */
export const SIDE_COLOR = { left: 0x3aa655, right: 0x3b6fd6 };
/** 무장 tint — 병사보다 밝게 */
const GENERAL_COLOR = { left: 0x8fe8a0, right: 0x9cc0ff };

const CAM_LERP = 0.08;      // 프레임(16.7ms)당 따라가는 비율
const CAM_LEAD = 120;       // 무장 앞쪽으로 내다보는 거리
const MAX_STEP = 50;        // sim.step 한 번의 최대 ms
const MAX_STEPS = 4;        // 프레임당 최대 step 횟수 (탭 복귀 폭주 방지)
const JOY_R = 70;           // 가상 조이스틱 반지름
const JOY_DEAD = 12;        // 데드존
const INTRO_MS = 1200;      // 「전투 개시」 동안 sim 정지
const HUD_TOP = 132;        // 이 위쪽 터치는 조이스틱으로 안 잡는다(HUD 영역 — BattleHud 무장 행 둘째 줄 아래 끝 128)

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
    dataMod = await import('./data.js');
  } catch (e) {
    console.info('[전투] data.js 없음 — BattleScene 기본값 사용');
  }
  try {
    simMod = await import('./sim.js');
    if (typeof simMod.createBattle !== 'function') throw new Error('no createBattle export');
  } catch (e) {
    console.warn('[전투] sim.js 를 못 읽어 더미 sim(assets/raw/battle/sim-stub.mjs)을 쓴다:', e && e.message);
    simMod = await import('../../assets/raw/battle/sim-stub.mjs');
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

    this.buildBackground();
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
    this.total.left = this.sim.countAlive('left');
    this.total.right = this.sim.countAlive('right');

    // 카메라를 바로 무장 위에 두고 첫 프레임을 그려 둔다(인트로 뒤에 튀지 않게)
    if (this.playerUnit) {
      this.cameras.main.scrollX = Phaser.Math.Clamp(this.playerUnit.x + CAM_LEAD - W / 2, 0, FIELD.w - W);
    }
    this.syncSprites(this.time.now);
    this.introUntil = this.time.now + INTRO_MS;
    this.events.emit('battle:ready');
  }

  onShutdown() {
    this.bootToken = null;
    this.endJoy();
    if (this.scene.isActive('BattleHud')) this.scene.stop('BattleHud');
  }

  // ─────────────────────────────────────────────────────────────
  // 배경 3겹 패럴랙스 — sky(0.15) / far(0.35) / ground(1). 텍스처는 BootScene 이 폴백까지 만든다.
  // 창 비율이 바뀌면(main.js relayout → applyBounds) 다시 만든다.
  // ─────────────────────────────────────────────────────────────

  buildBackground() {
    if (this.bgObjs) for (const o of this.bgObjs) o.destroy();
    this.bgObjs = [];
    const R = Math.max(1, FIELD.w - W);   // 카메라 스크롤 범위

    // 하늘: 2048×720 한 장. 화면보다 넓게 늘리고, 끝까지 스크롤해도 오른쪽이 비지 않는 배율만 준다
    if (this.textures.exists('battle_sky')) {
      const k = Math.max(1, (W * 1.05) / 2048);
      const sf = Math.min(0.15, (2048 * k - W) / R);
      this.bgObjs.push(this.add.image(0, 0, 'battle_sky').setOrigin(0).setScale(k, 1).setScrollFactor(sf, 1).setDepth(-30));
    } else {
      // 최후 폴백 — 단색 하늘
      this.bgObjs.push(this.add.rectangle(0, 0, W, FIELD.h, 0x7c8ba3).setOrigin(0).setScrollFactor(0).setDepth(-30));
    }

    // 먼 산: 2048×360 띠를 필요한 만큼 이어 붙인다(밑변 y 430 — 아래 30px 은 땅 밑에 숨는다). 스크롤 0.35
    const sfFar = 0.35;
    if (this.textures.exists('battle_far')) {
      const need = W + R * sfFar + 64;
      const n = Math.ceil(need / 2048);
      for (let i = 0; i < n; i++) {
        this.bgObjs.push(this.add.image(i * 2048, 430, 'battle_far').setOrigin(0, 1).setScrollFactor(sfFar, 1).setDepth(-20));
      }
      // 안개 띠 — far.png 아래변은 평균 알파 0.11 이지만 봉우리 밑동 100여 열이 알파 1 이라 땅 경계(y 400)에서 산 밑이
      //   직선으로 잘려 보인다(통합 검수, 실측 row 330). 하늘색(sky.png y 380~420 평균 (237,225,208))으로 y 372→400 그라데이션.
      //   fillGradientStyle 은 WebGL 전용 — Canvas 는 단색 띠가 되므로 알파를 낮게 둔다.
      const haze = this.add.graphics().setScrollFactor(sfFar, 1).setDepth(-15);
      if (this.isWebGL) {
        haze.fillGradientStyle(0xede1d0, 0xede1d0, 0xede1d0, 0xede1d0, 0, 0, 0.9, 0.9);
        haze.fillRect(0, 372, n * 2048, 28);
      } else {
        haze.fillStyle(0xede1d0, 0.35).fillRect(0, 386, n * 2048, 14);
      }
      this.bgObjs.push(haze);
    } else {
      const g = this.add.graphics().setScrollFactor(sfFar, 1).setDepth(-20);
      g.fillStyle(0x55627a, 0.8);
      for (let x = 0; x < 4200; x += 300) g.fillTriangle(x, 430, x + 150, 300, x + 300, 430);
      this.bgObjs.push(g);
    }

    // 땅: 1024×320 타일 4장 (0~4096 ≥ 3200), y 400~720
    if (this.textures.exists('battle_ground')) {
      for (let i = 0; i < 4; i++) {
        this.bgObjs.push(this.add.image(i * 1024, FIELD.top, 'battle_ground').setOrigin(0).setDepth(-10));
      }
    } else {
      this.bgObjs.push(this.add.rectangle(0, FIELD.top, FIELD.w + 200, FIELD.h - FIELD.top, 0x9a8258).setOrigin(0).setDepth(-10));
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
    // 그림자 — Graphics 하나에 매 프레임 전부 다시 그린다 (§4.1)
    this.shadowG = this.add.graphics().setDepth(FIELD.top - 1);
    // 조종 무장 발밑 빛 무리
    this.playerGlow = this.textures.exists('glow')
      ? this.add.image(0, 0, 'glow').setTint(0xa8ffb8).setBlendMode(Phaser.BlendModes.ADD)
        .setScale(0.55, 0.28).setAlpha(0.5).setDepth(FIELD.top - 0.5).setVisible(false)
      : null;
  }

  makeUnitSprite() {
    return this.add.sprite(-200, -200, 'unit_inf').setOrigin(0.5, 1).setActive(false).setVisible(false);
  }

  /**
   * 병종·편 → 텍스처 키·배율·origin. 일러스트(bunit_*)가 있으면 0.3배(무장 0.42), 없으면 코드 생성 실루엣.
   * 실제 납품 96×128 일러스트(assets/battle/NOTES.md 실측, 통합에서 맞춤): 발밑이 y125(아래 변 −2px) → origin (0.5, 0.98).
   *   알파 폭×높이 inf 66×124 · spear 38×124 · bow 81×124 · cav 92×96 · general_left 86×124 · general_right 61×124.
   *   0.3배면 병사 높이 37px(코드 실루엣 34 와 비슷), 기병만 말이 넓어 96 높이라 ×1.15(→33px) 로 키운다. 무장 0.42 → 52px.
   * Canvas 렌더러는 setTint 를 무시하므로(Phaser: tint 는 WebGL 전용) 편 색을 입힌 캔버스 텍스처를 따로 만든다.
   */
  texFor(u) {
    const k = `${u.kind}:${u.side}`;
    let t = this.texCache.get(k);
    if (t) return t;
    const isGen = u.kind === 'general';
    const ill = isGen ? `bunit_general_${u.side}` : `bunit_${u.kind}`;
    if (this.textures.exists(ill)) t = { key: ill, scale: isGen ? 0.42 : u.kind === 'cav' ? 0.3 * 1.15 : 0.3, oy: 0.98 };
    else {
      const code = isGen ? 'unit_general' : `unit_${u.kind}`;
      t = { key: this.textures.exists(code) ? code : 'unit_inf', scale: 1, oy: 1 };
    }
    if (!this.isWebGL) t.key = this.tintedTexture(t.key, isGen ? GENERAL_COLOR[u.side] : SIDE_COLOR[u.side]);
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

  acquire(u) {
    const s = this.pool.pop() || this.makeUnitSprite();
    const t = this.texFor(u);
    const isGen = u.kind === 'general';
    s.setTexture(t.key).setScale(t.scale).setOrigin(0.5, t.oy)
      .setAlpha(1).setAngle(0).setActive(true).setVisible(true);
    s.baseTint = isGen ? GENERAL_COLOR[u.side] : SIDE_COLOR[u.side];
    s.setTint(s.baseTint);
    s.uid = u.id;
    s.dying = false;
    s.flashing = false;
    s.flashUntil = 0;
    s.kb = 0;
    this.spriteById.set(u.id, s);
    return s;
  }

  release(s) {
    this.tweens.killTweensOf(s);
    s.setActive(false).setVisible(false).setAngle(0).setAlpha(1);
    s.dying = false;
    this.spriteById.delete(s.uid);
    s.uid = -1;
    this.pool.push(s);
  }

  /** 죽음 — 발을 축으로 뒤로 넘어지며(90°) 알파 0, 1.2초 뒤 풀로 */
  startDeath(s, u) {
    s.dying = true;
    s.setTint(s.baseTint);
    s.flashing = false;
    this.tweens.add({ targets: s, angle: -90 * (u.facing || 1), duration: 260, ease: 'Quad.easeIn' });
    this.tweens.add({
      targets: s, alpha: 0, duration: 650, delay: 550,
      onComplete: () => this.release(s),
    });
  }

  /**
   * 유닛 → 스프라이트 위치·연출. for 한 번 (§4.1).
   *   이동: 상하 bob ±2px 6Hz + 살짝 기울기 / 공격: attackT 로 전방 찌르기 + 앞으로 기울기
   *   피격: 0.1초 흰 tint / 기절: 흔들림 / 넉백: kb 각도가 감쇠
   */
  syncSprites(time) {
    const units = this.sim.units;
    const sg = this.shadowG;
    sg.clear();
    sg.fillStyle(0x000000, 0.28);
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
      if (u.state === 'dead') { this.startDeath(s, u); continue; }

      const isGen = u.kind === 'general';
      const f = u.facing < 0 ? -1 : 1;
      let dx = 0, dy = 0, ang = 0;
      if (u.state === 'move' || u.state === 'flee') {
        const ph = time * 0.0377 + u.id * 1.7;        // 6Hz, 유닛마다 위상 다르게
        dy = Math.sin(ph) * 2;
        ang = f * 3 * Math.sin(ph * 0.5);
      } else if (u.state === 'attack') {
        const k = Math.sin(Math.PI * (u.attackT || 0));  // 0→1→0
        dx = f * (isGen ? 12 : 8) * k;
        ang = f * (isGen ? 18 : 14) * k;
      } else if (u.state === 'stun') {
        ang = Math.sin(time * 0.02 + u.id) * 12;
      }
      if (s.kb) {
        ang += s.kb * f;
        s.kb *= 0.86;
        if (Math.abs(s.kb) < 0.5) s.kb = 0;
      }
      if (s.flashing && time >= s.flashUntil) {
        s.setTint(s.baseTint);
        s.flashing = false;
      }
      s.x = u.x + dx;
      s.y = u.y + dy;
      s.flipX = f < 0;
      s.angle = ang;
      s.depth = u.y;
      // smoothness 8: 기본 32 면 244개 × 매 프레임 32각형 할당·삼각분할 — 18×6px 타원엔 8각형이면 같아 보이고 비용 1/4(통합 검수)
      sg.fillEllipse(u.x, u.y + 1, isGen ? 36 : 18, isGen ? 11 : 6, 8);
      if (u.id === this.playerId) player = u;
    }
    if (this.playerGlow) {
      if (player) this.playerGlow.setPosition(player.x, player.y + 2).setVisible(true);
      else this.playerGlow.setVisible(false);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 카메라 — 조종 무장을 lerp 0.08 로 따라가며 전방 120px 앞서 본다. 줌 1, 경계 0~3200.
  // ─────────────────────────────────────────────────────────────

  setupCamera() {
    const cam = this.cameras.main;
    cam.setZoom(1);
    cam.setBounds(0, 0, FIELD.w, FIELD.h);
    cam.scrollX = 0;
    cam.scrollY = 0;
  }

  /** 따라갈 무장 — 플레이어, 죽었으면 살아 있는 아군 무장, 없으면 마지막 위치 */
  camTarget() {
    const p = this.playerUnit;
    if (p && p.state !== 'dead' && p.state !== 'gone') return p;
    const gens = this.sim.generalsOf('left') || [];
    return gens.find((u) => u.state !== 'dead' && u.state !== 'gone') || p || null;
  }

  updateCamera(delta) {
    const t = this.camTarget();
    if (!t) return;
    const cam = this.cameras.main;
    // 목표도 경계 안으로 잘라 두어야 전장 끝에서 lerp 가 벽에 눌려 느려지지 않는다(카메라 bounds 는 preRender 에서 한 번 더 자른다)
    const want = Phaser.Math.Clamp(t.x + (t.facing < 0 ? -1 : 1) * CAM_LEAD - W / 2, 0, FIELD.w - W);
    const k = 1 - Math.pow(1 - CAM_LERP, delta / 16.67);   // 프레임 속도와 무관하게 같은 감쇠
    cam.scrollX += (want - cam.scrollX) * k;
  }

  // ─────────────────────────────────────────────────────────────
  // 입력 — 왼쪽 반 터치 = 가상 조이스틱(터치한 자리에 생김). 키보드 WASD/화살표, Space, 1/2/3.
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
    }
  }

  onPointerDown(p) {
    if (this.joy || this.ended || !this.sim) return;
    if (p.x >= W / 2 || p.y < HUD_TOP) return;
    this.joy = { id: p.id, ox: p.x, oy: p.y, dx: 0, dy: 0 };
    this.drawJoy();
  }

  onPointerUp(p) {
    if (this.joy && p.id === this.joy.id) this.endJoy();
  }

  endJoy() {
    this.joy = null;
    if (this.joyG) this.joyG.clear().setVisible(false);
  }

  pointerById(id) {
    const ps = this.input.manager.pointers;
    for (let i = 0; i < ps.length; i++) if (ps[i].id === id) return ps[i];
    return null;
  }

  drawJoy() {
    const j = this.joy;
    const g = this.joyG;
    g.clear().setVisible(true);
    g.lineStyle(3, 0xffffff, 0.35).strokeCircle(j.ox, j.oy, JOY_R);
    g.fillStyle(0xffffff, 0.08).fillCircle(j.ox, j.oy, JOY_R);
    const kx = j.ox + j.dx * JOY_R, ky = j.oy + j.dy * JOY_R;
    g.fillStyle(0xf6e9c9, 0.6).fillCircle(kx, ky, 26);
    g.lineStyle(2, 0x3a2a12, 0.6).strokeCircle(kx, ky, 26);
  }

  /** 조이스틱·키보드 → setGeneralInput. 매 프레임 (0,0 이면 제자리에서 자동 공격만) */
  applyInput() {
    let dx = 0, dy = 0;
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
    const ok = !!this.sim.useSkill('left', this.playerId);
    if (!ok) this.events.emit('battle:skillfail');
    return ok;
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
    const evs = this.sim.drainEvents();
    if (!evs || !evs.length) return;
    const cam = this.cameras.main;
    const viewL = cam.scrollX - 60, viewR = cam.scrollX + W + 60;
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
          // 무장기 피해(e.skill)는 한 방에 수십 명 — 궤적 대신 불꽃만. 화살은 궤적 없음
          if (e.skill) this.fx.sparks(e.x, e.y - 20, 2);
          else if (from && from.kind !== 'bow') this.fx.slash(e.x, e.y, from.facing < 0 ? -1 : 1, fromGen);
          if (toGen) {
            this.fx.damage(e.x, e.y - 62, e.dmg, !!e.crit);
            this.fx.sparks(e.x, e.y - 30, e.crit ? 10 : 5);
          }
          // 타격음 — 화면 안, 90ms 에 한 번, 병사끼리는 셋에 하나만
          if (!e.skill && e.x > viewL && e.x < viewR && time - this.lastHitSfx > 90 && (fromGen || toGen || e.to % 3 === 0)) {
            this.lastHitSfx = time;
            sfx('hit');
          }
          break;
        }
        case 'arrow':
          this.fx.arrow(e.x0, e.y0, e.x1, e.y1, e.ms);
          break;
        case 'death': {
          this.fx.dust(e.x, e.y, 6);
          const u = this.unitById.get(e.id);
          if (u && u.kind === 'general') {
            cam.shake(220, 0.006);
            this.fx.sparks(e.x, e.y - 30, 14);
          }
          break;
        }
        case 'flee':
          break;
        case 'skill':
          this.onSkill(e, time);
          break;
        case 'knockback': {
          const s = this.spriteById.get(e.id);
          if (s && !s.dying) {
            const dir = e.dx < 0 ? -1 : 1;
            s.kb = 28;
            this.fx.ghost(s, dir);
            this.fx.dust(s.x, s.y, 3);
          }
          break;
        }
        case 'command':
          if (e.side === 'left' || e.side === 'right') this.cmd[e.side] = e.cmd;
          this.events.emit('battle:command', e);
          break;
        case 'end':
          this.onEnd(e);
          break;
        default:
          break;
      }
    }
  }

  /** 무장기 발동 — 흔들림·번쩍임·범위 표시·먼지·컷인(HUD) */
  onSkill(e) {
    const meta = this.genMeta.get(e.id);
    const sk = (meta && meta.skill) || resolveSkill(this.battleData || DEFAULT_DATA, e.skill, null);
    const facing = e.facing < 0 ? -1 : 1;
    const cam = this.cameras.main;
    cam.shake(300, 0.012);
    cam.flash(120, 255, 255, 255);
    this.fx.area(e.x, e.y, facing, sk);
    this.fx.dust(e.x, e.y, 14);
    this.fx.sparks(e.x, e.y - 30, 18);
    if (e.side === 'left' || e.side === 'right') this.skillUsed[e.side]++;
    sfx('skill');
    this.events.emit('battle:skill', meta || { id: e.id, side: e.side, name: '', key: null, skill: sk, color: 0xffd24a });
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
    if (!this.sim) return;

    // 「전투 개시」 동안은 sim 을 멈춘 채 첫 장면만 보여 준다
    if (time < this.introUntil) {
      this.syncSprites(time);
      this.updateCamera(delta);
      return;
    }
    // 끝난 뒤 1.5초는 죽음 연출을 위해 더 굴리고, 그 뒤 얼린다
    const frozen = this.ended && time >= this.freezeAt;
    if (!frozen) {
      this.applyInput();
      // delta 를 ≤50ms 로 쪼개 최대 4번 — 남는 시간은 버린다(탭 복귀 폭주 방지)
      let remain = Math.min(delta, MAX_STEP * MAX_STEPS);
      let n = 0;
      while (remain > 0 && n < MAX_STEPS) {
        const dt = Math.min(MAX_STEP, remain);
        this.sim.step(dt);
        remain -= dt;
        n++;
      }
      this.handleEvents(time);
      if (!this.ended && this.sim.result) this.onEnd(null);
    }
    this.syncSprites(time);
    this.updateCamera(delta);
  }
}
