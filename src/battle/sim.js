// 전투 시뮬레이션 — Phaser·DOM·Date.now·Math.random 을 쓰지 않는다. node 에서 그대로 돈다 (docs/BATTLE.md §2.1).
//
// 설계 요점
//   - 고정 틱(TUNE.TICK_MS ≈ 16.7ms). step(dt) 는 누적기로 틱을 쪼개 돌리므로 프레임 속도가 달라도 결과가 같다.
//   - 난수는 seed 기반 mulberry32 하나. 같은 seed·같은 입력 순서 = 같은 결과.
//   - 이웃 탐색은 64px 격자 해시(매 틱 다시 채움). 겹침 방지는 같은 셀 + 오른쪽·아래 이웃 셀(separate() 참고).
//   - 유닛은 units 배열에 그대로 남는다(죽어도 'dead'/'gone'). Unit.id === units 의 index.
//   - view 는 매 프레임 drainEvents() 로 이벤트를 가져가 연출한다. 넉백·기절·돌진은 sim 이 위치를 움직인다.
//
// Unit 필드(계약 — BATTLE.md §2.1)와 그 아래 내부 필드는 makeUnit() 참고.

import { FIELD, FORMATION, KINDS, AFFINITY, SKILLS, GAUGE, TUNE, ARMY_LEFT, ARMY_RIGHT } from './data.js';

export const TICK_MS = TUNE.TICK_MS;

/** seed 기반 PRNG (mulberry32). 0 ≤ r < 1 */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GRID_COLS = Math.ceil(FIELD.W / TUNE.CELL);
const GRID_ROWS = Math.ceil(FIELD.H / TUNE.CELL);
const GROUND_MID = (FIELD.GROUND_TOP + FIELD.GROUND_BOTTOM) / 2;

/** 편 → 전진 방향(x). 왼쪽 편은 오른쪽(+1)으로 간다 */
const DIR = { left: 1, right: -1 };
const OTHER = { left: 'right', right: 'left' };

const REASON = {
  generals: '적 무장 전멸',
  routed: '적 병력 전멸·도주',
  timeout: '시간 초과 — 남은 병력 비율',
  mutual: '양쪽 동시 궤멸',
};

/**
 * 전투를 만든다.
 * @param {object} opts
 * @param {number} opts.seed
 * @param {object} opts.left   data.js ARMY_LEFT 형식
 * @param {object} opts.right  data.js ARMY_RIGHT 형식
 * @param {boolean} [opts.aiControlled=false]  true 면 플레이어 무장도 AI 가 맡는다(벤치용)
 */
export function createBattle(opts = {}) {
  const seed = opts.seed == null ? 1 : opts.seed | 0;
  const rand = mulberry32(seed);
  const aiControlled = !!opts.aiControlled;
  const armies = { left: opts.left || ARMY_LEFT, right: opts.right || ARMY_RIGHT };

  /** @type {any[]} */
  const units = [];
  let events = [];
  /** 예약된 화살 피해 {at, from, to, dmg} — 발사 순서 = 도착 순서라 FIFO */
  let arrows = [];
  let arrowHead = 0;

  // 격자 해시: 셀마다 유닛 index 배열. 매 틱 length=0 으로 비우고 다시 채운다(할당 없음).
  const cells = new Array(GRID_COLS * GRID_ROWS);
  for (let i = 0; i < cells.length; i++) cells[i] = [];

  const sides = {
    left: makeSide('left', armies.left),
    right: makeSide('right', armies.right),
  };

  const b = {
    seed,
    units,
    time: 0,
    tick: 0,
    result: null,
    /** 편 상태(명령·병력 수). view 가 읽어도 된다(쓰지는 말 것) */
    sides,
    step,
    drainEvents,
    command,
    setGeneralInput,
    useSkill,
    generalsOf,
    countAlive,
    /** 소속 병사 수를 포함해 처음 병력 */
    countInitial: (side) => sides[side].init,
    unitById: (id) => units[id] || null,
    /** 플레이어가 조종하는 무장 Unit (없으면 null) */
    playerOf: (side) => (sides[side].player >= 0 ? units[sides[side].player] : null),
    /** 현재 병법 */
    commandOf: (side) => sides[side].cmd,
    /** 무장기 발동 횟수(결과 패널용) */
    skillCount: { left: 0, right: 0 },
  };

  let acc = 0;

  // ───────────────────────────────────────────────────────────
  // 생성
  // ───────────────────────────────────────────────────────────

  function makeSide(side, army) {
    return {
      side,
      cmd: 'hold',
      cmdByUser: false,       // 외부 command() 가 한 번이라도 왔는가(오면 AI 자동 돌격을 안 건다)
      aiCharged: false,
      generals: [],           // unit index
      soldiers: [],           // unit index
      init: 0,
      alive: 0,
      soldiersAlive: 0,
      generalsAlive: 0,
      player: -1,             // 플레이어 조종 무장 index (aiControlled 면 -1)
      playerId: army && army.player != null ? army.player : null,
      dir: DIR[side],
      retreatX: FIELD.RETREAT_X[side],
      exitX: FIELD.EXIT_X[side],
    };
  }

  function makeUnit(side, kind, generalId, x, y, gen) {
    const k = KINDS[kind];
    const u = {
      // ── 계약 필드 (BATTLE.md §2.1) ──
      id: units.length,
      side,
      kind,
      generalId,
      name: gen ? gen.name : undefined,
      x, y,
      facing: DIR[side],
      hp: k.hp,
      maxHp: k.hp,
      state: 'idle',
      attackT: 0,
      gauge: gen ? 0 : undefined,
      skill: gen ? gen.skill : undefined,
      vx: 0, vy: 0,
      // ── 덧붙인 공개 필드 ──
      alive: true,            // 싸울 수 있는 상태(죽거나 도주하면 false). countAlive 는 이것을 센다
      dataId: gen ? gen.id : -1,
      key: gen ? gen.key : undefined,   // 무장 데이터 key('guanyu') — view 가 컷인 텍스처(cutin_<key>)를 바로 찾게(통합: view 요청)
      color: gen ? gen.color : undefined,
      // ── 내부 필드 (view 는 안 써도 된다) ──
      atk: k.atk, def: k.def, speed: k.speed, range: k.range, cooldown: k.cooldown, attackMs: k.attackMs, radius: k.radius,
      tgt: -1,                // 목표 unit index
      retargetAt: 0,
      cd: 0,                  // 남은 쿨다운 ms
      act: 0,                 // 0 없음 / 1 공격 / 2 무장기 자세 / 3 돌진
      actT: 0,                // 현재 동작 경과 ms
      actDur: 0,
      struck: false,          // 이번 공격의 피해를 이미 줬는가
      hurtT: 0,
      stunT: 0,
      kbT: 0, kbVx: 0, kbVy: 0,
      deadT: 0,
      col: 0, row: 0,         // 진형 자리
      anchorX: x, anchorY: y, // 대기 명령 때 무장이 지키는 자리
      dashHit: null,          // 돌진 중 이미 맞춘 유닛 index Set
      dashDx: 0,
      inX: 0, inY: 0,         // 플레이어 입력
      ai: true,
      meleeNow: false,        // 궁병이 궁지에 몰려 근접전 중인가
      low: false,             // 무장 AI: 부대 뒤로 물러나는 중(30% 미만 → 50% 회복까지)
      noHitT: 1e9,            // 마지막 피격 뒤 지난 ms (무장 회복용)
      lastHitBy: -1,          // 나를 마지막으로 때린 유닛 index (근처에 적이 없으면 이걸 쫓는다 — 궁병 사냥)
      attackers: 0,           // 나를 목표로 잡은 근접 유닛 수 (ATTACKER_CAP)
      formSign: gen ? (y > GROUND_MID ? 1 : y < GROUND_MID ? -1 : 0) : 0,   // 무장: 진형 블록을 띠 바깥쪽으로 미는 방향
    };
    units.push(u);
    return u;
  }

  function build(side, army) {
    const S = sides[side];
    // 무장 먼저(기본 편성에서 id 0~3 = 배열 index 가 되게 좌·우 순서로 만든다)
    for (const g of army.generals) {
      const u = makeUnit(side, 'general', -1, g.x, g.y, g);
      u.generalId = u.id;
      S.generals.push(u.id);
      if (S.playerId != null && g.id === S.playerId && !aiControlled) {
        S.player = u.id;
        u.ai = false;
      }
    }
  }
  function buildSoldiers(side, army) {
    const S = sides[side];
    army.generals.forEach((g, gi) => {
      const gu = units[S.generals[gi]];
      let slot = 0;
      for (const t of g.troops) {
        for (let n = 0; n < t.n; n++, slot++) {
          const col = Math.floor(slot / FORMATION.ROWS), row = slot % FORMATION.ROWS;
          const u = makeUnit(side, t.kind, gu.id, 0, 0, null);
          u.col = col; u.row = row;
          const p = slotPos(u, gu);
          u.x = p.x; u.y = p.y;
          S.soldiers.push(u.id);
        }
      }
    });
  }

  const _slot = { x: 0, y: 0 };
  /** 병사 u 의 진형 자리(무장 g 기준). 반환 객체는 재사용된다 — 바로 읽을 것 */
  function slotPos(u, g) {
    const d = DIR[u.side];
    _slot.x = g.x - d * (FORMATION.BACK + u.col * FORMATION.DX);
    _slot.y = g.y + g.formSign * FORMATION.SPLIT + (u.row - (FORMATION.ROWS - 1) / 2) * FORMATION.DY;
    if (_slot.y < FIELD.GROUND_TOP) _slot.y = FIELD.GROUND_TOP;
    else if (_slot.y > FIELD.GROUND_BOTTOM) _slot.y = FIELD.GROUND_BOTTOM;
    return _slot;
  }

  build('left', armies.left);
  build('right', armies.right);
  buildSoldiers('left', armies.left);
  buildSoldiers('right', armies.right);
  for (const s of ['left', 'right']) {
    const S = sides[s];
    S.generalsAlive = S.generals.length;
    S.soldiersAlive = S.soldiers.length;
    S.alive = S.generalsAlive + S.soldiersAlive;
    S.init = S.alive;
  }

  // ───────────────────────────────────────────────────────────
  // 공개 API
  // ───────────────────────────────────────────────────────────

  function step(dtMs) {
    if (!(dtMs > 0)) return;
    acc += dtMs;
    while (acc >= TICK_MS - 1e-9) {
      acc -= TICK_MS;
      runTick(TICK_MS);
    }
  }

  function drainEvents() {
    const out = events;
    events = [];
    return out;
  }

  function command(side, cmd) {
    const S = sides[side];
    if (!S || (cmd !== 'charge' && cmd !== 'hold' && cmd !== 'retreat')) return false;
    S.cmdByUser = true;
    if (S.cmd === cmd) return true;
    setCommand(S, cmd);
    return true;
  }

  function setCommand(S, cmd) {
    S.cmd = cmd;
    // 대기: 무장이 지금 자리를 지킨다. 병사는 그 뒤 진형으로 모인다.
    for (const gi of S.generals) { const g = units[gi]; g.anchorX = g.x; g.anchorY = g.y; }
    // 명령이 바뀌면 곧 다시 목표를 잡게 한다(대기→돌격 전환이 굼뜨지 않게)
    for (const si of S.soldiers) units[si].retargetAt = 0;
    events.push({ type: 'command', side: S.side, cmd });
  }

  function setGeneralInput(side, generalId, v) {
    const u = units[generalId];
    if (!u || u.side !== side || u.kind !== 'general') return;
    let dx = v && typeof v.dx === 'number' ? v.dx : 0;
    let dy = v && typeof v.dy === 'number' ? v.dy : 0;
    const l2 = dx * dx + dy * dy;
    if (l2 > 1) { const l = Math.sqrt(l2); dx /= l; dy /= l; }
    u.inX = dx; u.inY = dy;
  }

  function useSkill(side, generalId) {
    const u = units[generalId];
    if (!u || u.side !== side || u.kind !== 'general' || !u.alive) return false;
    if (u.gauge < GAUGE.max) return false;
    if (u.stunT > 0 || u.kbT > 0 || u.act === 2 || u.act === 3) return false;
    const sk = SKILLS[u.skill];
    if (!sk) return false;
    u.gauge = 0;
    b.skillCount[side]++;
    events.push({ type: 'skill', id: u.id, side, skill: sk.id, x: u.x, y: u.y, facing: u.facing });
    // 진행 중이던 보통 공격은 끊는다
    u.act = 0; u.attackT = 0; u.struck = false;
    if (sk.shape === 'dash') {
      u.act = 3; u.actT = 0; u.actDur = sk.dashMs;
      u.dashDx = u.facing;
      u.dashHit = new Set();
      u.state = 'attack';
    } else {
      u.act = 2; u.actT = 0; u.actDur = TUNE.SKILL_POSE_MS;
      u.state = 'attack';
      applyAreaSkill(u, sk);
    }
    return true;
  }

  function generalsOf(side) {
    const S = sides[side];
    const out = [];
    for (const gi of S.generals) out.push(units[gi]);
    return out;
  }

  function countAlive(side) {
    return sides[side].alive;
  }

  // ───────────────────────────────────────────────────────────
  // 틱
  // ───────────────────────────────────────────────────────────

  function runTick(dt) {
    b.tick++;
    rebuildGrid();
    aiCommands();
    applyArrows();
    const n = units.length;
    for (let i = 0; i < n; i++) updateUnit(units[i], dt);
    separate();
    routCheck();
    b.time += dt;
    if (!b.result) judge();
  }

  function rebuildGrid() {
    for (let i = 0; i < cells.length; i++) cells[i].length = 0;
    for (let i = 0; i < units.length; i++) {
      const u = units[i];
      if (!u.alive) continue;
      // 통합 검수: clampPos 가 x 를 정확히 FIELD.W(3200)로 만들면 cx=50 ≥ GRID_COLS 라 격자에서 빠져
      //   오른쪽 벽의 궁병이 아무에게도 안 잡히는 공짜 사격이 됐다(왼쪽 x=0 은 cx=0 이라 비대칭). 마지막 셀로 넣는다.
      const cx = Math.min(GRID_COLS - 1, (u.x / TUNE.CELL) | 0), cy = Math.min(GRID_ROWS - 1, (u.y / TUNE.CELL) | 0);
      if (cx < 0 || cy < 0) continue;
      cells[cy * GRID_COLS + cx].push(i);
    }
  }

  /** 플레이어가 없는 편은 5초 뒤 「돌격」 */
  function aiCommands() {
    for (const s of ['left', 'right']) {
      const S = sides[s];
      if (S.player >= 0 || S.cmdByUser || S.aiCharged) continue;
      if (b.time >= TUNE.AI_CHARGE_AT_MS) { S.aiCharged = true; setCommand(S, 'charge'); }
    }
  }

  function applyArrows() {
    while (arrowHead < arrows.length && arrows[arrowHead].at <= b.time) {
      const a = arrows[arrowHead++];
      const to = units[a.to];
      if (to.alive) hit(units[a.from], to, a.dmg, false);
    }
    if (arrowHead > 64 && arrowHead * 2 > arrows.length) { arrows = arrows.slice(arrowHead); arrowHead = 0; }
  }

  // ───────────────────────────────────────────────────────────
  // 이웃 탐색 (격자)
  // ───────────────────────────────────────────────────────────

  /**
   * u 에서 radius 안의 가장 가까운 살아 있는 적 index, 없으면 -1.
   * capped=true 면 근접 공격자가 상한(ATTACKER_CAP)만큼 붙은 적은 건너뛴다(내가 이미 잡은 목표는 예외).
   */
  function nearestEnemy(u, radius, capped) {
    const r2max = radius * radius;
    const cr = Math.ceil(radius / TUNE.CELL);
    const cx = (u.x / TUNE.CELL) | 0, cy = (u.y / TUNE.CELL) | 0;
    const x0 = Math.max(0, cx - cr), x1 = Math.min(GRID_COLS - 1, cx + cr);
    const y0 = Math.max(0, cy - cr), y1 = Math.min(GRID_ROWS - 1, cy + cr);
    let best = -1, bd = r2max;
    const side = u.side, ux = u.x, uy = u.y, mine = u.tgt;
    const capS = TUNE.ATTACKER_CAP.soldier, capG = TUNE.ATTACKER_CAP.general;
    for (let gy = y0; gy <= y1; gy++) {
      for (let gx = x0; gx <= x1; gx++) {
        const cell = cells[gy * GRID_COLS + gx];
        for (let k = 0; k < cell.length; k++) {
          const vi = cell[k];
          const v = units[vi];
          if (v.side === side) continue;
          if (capped && vi !== mine && v.attackers >= (v.kind === 'general' ? capG : capS)) continue;
          const dx = v.x - ux, dy = v.y - uy;
          const d2 = dx * dx + dy * dy;
          if (d2 < bd) { bd = d2; best = vi; }
        }
      }
    }
    return best;
  }

  /** 목표를 바꾼다(근접 유닛이면 상대의 attackers 수를 맞춘다). 궁병·플레이어 무장의 자동 공격은 자리를 차지하지 않는다 */
  function setTarget(u, t) {
    if (u.tgt === t) return;
    const melee = u.kind !== 'bow' && u.ai;
    if (melee && u.tgt >= 0) units[u.tgt].attackers--;
    u.tgt = t;
    if (melee && t >= 0) units[t].attackers++;
  }

  /** 살아 있는 적 무장 중 가장 가까운 index, 없으면 -1 */
  function nearestEnemyGeneral(u) {
    const E = sides[OTHER[u.side]];
    let best = -1, bd = Infinity;
    for (const gi of E.generals) {
      const g = units[gi];
      if (!g.alive) continue;
      const dx = g.x - u.x, dy = g.y - u.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bd) { bd = d2; best = gi; }
    }
    return best;
  }

  /** 아무 적이나(무장 죽은 뒤 흩어진 병사용): 넓은 반지름 → 없으면 전수 조사(드묾) */
  function anyEnemy(u) {
    let t = nearestEnemy(u, 640, false);
    if (t >= 0) return t;
    const E = sides[OTHER[u.side]];
    let bd = Infinity;
    for (const si of E.soldiers) {
      const v = units[si];
      if (!v.alive) continue;
      const dx = v.x - u.x, dy = v.y - u.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bd) { bd = d2; t = si; }
    }
    return t;
  }

  function validTarget(u) {
    if (u.tgt < 0) return false;
    const v = units[u.tgt];
    if (!v.alive) { setTarget(u, -1); return false; }
    return true;
  }

  // ───────────────────────────────────────────────────────────
  // 유닛 갱신
  // ───────────────────────────────────────────────────────────

  function updateUnit(u, dt) {
    u.vx = 0; u.vy = 0;
    const st = u.state;
    if (st === 'gone') return;
    if (st === 'dead') {
      u.deadT -= dt;
      if (u.deadT <= 0) u.state = 'gone';
      return;
    }
    if (st === 'flee') { fleeMove(u, dt); return; }

    // 넉백: 위치를 옮긴다. 아무것도 못 한다.
    if (u.kbT > 0) {
      const f = dt / 1000;
      u.x += u.kbVx * f; u.y += u.kbVy * f;
      u.vx = u.kbVx; u.vy = u.kbVy;
      clampPos(u);
      u.kbT -= dt;
      // 통합 검수: 넉백 중에도 기절 시간은 흘러야 포효의 stun 2000 이 2000 이다(안 줄이면 넉백 250ms 가 더해졌다)
      if (u.stunT > 0) u.stunT -= dt;
      u.state = u.stunT > 0 ? 'stun' : 'hurt';   // ※ 무장도 넉백 250ms 동안 'hurt' (view 는 피격 연출을 hit 이벤트로)
      if (u.kbT <= 0) { u.kbT = 0; if (u.stunT <= 0) { u.stunT = 0; u.state = 'idle'; } }
      if (u.cd > 0) u.cd -= dt;
      return;
    }
    if (u.stunT > 0) {
      u.stunT -= dt;
      u.state = 'stun';
      if (u.stunT <= 0) { u.stunT = 0; u.state = 'idle'; }
      if (u.cd > 0) u.cd -= dt;
      return;
    }
    if (u.hurtT > 0) {
      u.hurtT -= dt;
      u.state = 'hurt';
      if (u.hurtT <= 0) { u.hurtT = 0; u.state = 'idle'; }
      if (u.cd > 0) u.cd -= dt;
      return;
    }
    if (u.cd > 0) u.cd -= dt;

    if (u.kind === 'general') updateGeneral(u, dt);
    else updateSoldier(u, dt);
  }

  // ── 동작(공격·무장기 자세·돌진) 진행. true 면 이번 틱은 동작 중(이동 결정 없음) ──
  function advanceAct(u, dt) {
    if (u.act === 0) return false;
    u.actT += dt;
    const t = Math.min(1, u.actT / u.actDur);
    u.attackT = t;
    u.state = 'attack';
    if (u.act === 1) {
      if (!u.struck && t >= 0.5) {
        u.struck = true;
        strike(u);
      }
    } else if (u.act === 3) {
      dashStep(u, dt);
    }
    if (u.actT >= u.actDur) {
      u.act = 0; u.attackT = 0; u.struck = false; u.state = 'idle';
      u.dashHit = null;
      return false;
    }
    return true;
  }

  /** 보통 공격의 피해 시점(attackT 0.5). 목표가 사거리×STRIKE_REACH_MUL+상대 반지름 안이면 맞는다(아니면 헛침) */
  function strike(u) {
    if (!validTarget(u)) return;
    const v = units[u.tgt];
    const dx = v.x - u.x, dy = v.y - u.y;
    const d2 = dx * dx + dy * dy;
    const k = KINDS[u.kind];
    if (u.kind === 'bow' && u.meleeNow !== true) {
      // 화살: 사거리 안이면 발사(비행 뒤 피해 예약)
      if (d2 > k.range * k.range * 1.2) return;
      const dmg = calcDamage(u, v, 1);
      events.push({ type: 'arrow', from: u.id, to: v.id, x0: u.x, y0: u.y - 20, x1: v.x, y1: v.y, ms: k.arrowMs });
      arrows.push({ at: b.time + k.arrowMs, from: u.id, to: v.id, dmg });
      return;
    }
    const range = u.kind === 'bow' ? k.meleeRange : u.range;
    const reach = range * TUNE.STRIKE_REACH_MUL + v.radius;
    if (d2 > reach * reach) return;
    const mul = u.kind === 'bow' ? k.meleeMul : 1;
    let dmg = calcDamage(u, v, mul);
    let crit = false;
    if (u.kind === 'general' && rand() < k.critChance) { dmg = Math.round(dmg * k.critMul); crit = true; }
    hit(u, v, dmg, crit);
  }

  /** 피해 = atk × 상성 × (0.85~1.15) × mul − def, 최소 1. 병사→무장은 ×0.6 */
  function calcDamage(a, v, mul) {
    const aff = (AFFINITY[a.kind] && AFFINITY[a.kind][v.kind]) || 1;
    const r = 1 - TUNE.DMG_VAR + rand() * TUNE.DMG_VAR * 2;
    let dmg = a.atk * aff * r * mul - v.def;
    if (v.kind === 'general' && a.kind !== 'general') dmg *= KINDS.general.soldierDmgMul;
    dmg = Math.round(dmg);
    return dmg < 1 ? 1 : dmg;
  }

  /**
   * 피해 적용 + hit 이벤트 + 게이지 + 죽음.
   * skill=true 면 무장기 피해: 게이지를 채우지 않는다(안 그러면 광역 한 방에 다시 100 이 되어 연발한다).
   */
  function hit(from, to, dmg, crit, skill) {
    if (!to.alive) return;
    to.hp -= dmg;
    to.noHitT = 0;
    if (from) to.lastHitBy = from.id;
    const ev = { type: 'hit', x: to.x, y: to.y, from: from ? from.id : -1, to: to.id, dmg };
    if (crit) ev.crit = true;
    if (skill) ev.skill = true;
    events.push(ev);
    if (!skill && from && from.kind === 'general' && from.gauge != null) from.gauge = Math.min(GAUGE.max, from.gauge + GAUGE.hit);
    if (to.kind === 'general') {
      // 무장의 일격은 +hurt, 병사의 잔매는 +hurtSoldier (떼로 맞으면 초당 스무 대라 2 씩이면 3초마다 무장기가 된다)
      const g = !from || from.kind === 'general' ? GAUGE.hurt : GAUGE.hurtSoldier;
      if (!skill) to.gauge = Math.min(GAUGE.max, to.gauge + g);
    } else if (to.act === 0 && to.kbT <= 0 && to.stunT <= 0) {
      to.hurtT = TUNE.HURT_MS;      // 병사만 잠깐 경직(공격 중이면 안 끊는다)
    }
    if (to.hp <= 0) kill(to, from);
  }

  function kill(u, by) {
    u.hp = 0;
    u.alive = false;
    u.state = 'dead';
    u.deadT = TUNE.DEAD_MS;
    setTarget(u, -1);
    u.act = 0; u.attackT = 0; u.kbT = 0; u.stunT = 0; u.hurtT = 0;
    const S = sides[u.side];
    S.alive--;
    events.push({ type: 'death', id: u.id, x: u.x, y: u.y, side: u.side, by: by ? by.id : -1 });
    if (u.kind === 'general') {
      S.generalsAlive--;
      // 무장이 죽으면 그 부대는 도주
      for (const si of S.soldiers) {
        const s = units[si];
        if (s.alive && s.generalId === u.id) startFlee(s);
      }
    } else {
      S.soldiersAlive--;
    }
  }

  function startFlee(u) {
    u.alive = false;
    u.state = 'flee';
    setTarget(u, -1);
    u.act = 0; u.attackT = 0; u.kbT = 0; u.stunT = 0; u.hurtT = 0;
    const S = sides[u.side];
    S.alive--;
    if (u.kind === 'general') S.generalsAlive--; else S.soldiersAlive--;
    events.push({ type: 'flee', id: u.id });
  }

  function fleeMove(u, dt) {
    const S = sides[u.side];
    const dir = -S.dir;                    // 자기 진영 쪽으로
    const sp = u.speed * TUNE.FLEE_SPEED_MUL;
    u.vx = dir * sp;
    u.facing = dir;
    u.x += u.vx * dt / 1000;
    if ((dir < 0 && u.x < S.exitX) || (dir > 0 && u.x > S.exitX)) u.state = 'gone';
  }

  /** 편 병력이 15% 미만이면 남은 병사 전원 도주 */
  function routCheck() {
    for (const s of ['left', 'right']) {
      const S = sides[s];
      if (S.soldiersAlive > 0 && S.alive < S.init * TUNE.ROUT_RATIO) {
        for (const si of S.soldiers) { const u = units[si]; if (u.alive) startFlee(u); }
      }
    }
  }

  // ── 이동 도우미 ──

  /** (tx,ty) 로 speed 로 다가간다. stop 안이면 안 움직이고 true */
  function moveToward(u, tx, ty, speed, dt, stop) {
    const dx = tx - u.x, dy = ty - u.y;
    const d2 = dx * dx + dy * dy;
    if (d2 <= stop * stop) return true;
    const d = Math.sqrt(d2);
    const maxStep = speed * dt / 1000;
    const stepLen = Math.min(maxStep, d - stop);
    const f = stepLen / d;
    u.x += dx * f; u.y += dy * f;
    u.vx = dx / d * speed; u.vy = dy / d * speed;
    if (dx > 1) u.facing = 1; else if (dx < -1) u.facing = -1;
    u.state = 'move';
    clampPos(u);
    return false;
  }

  function moveAway(u, fx, fy, speed, dt) {
    let dx = u.x - fx, dy = u.y - fy;
    const d2 = dx * dx + dy * dy;
    if (d2 < 1) { dx = -sides[u.side].dir; dy = 0; }
    const d = Math.sqrt(dx * dx + dy * dy);
    dx /= d; dy /= d;
    // 위아래 띠 끝에 몰리면 옆으로만
    if ((u.y <= FIELD.GROUND_TOP + 2 && dy < 0) || (u.y >= FIELD.GROUND_BOTTOM - 2 && dy > 0)) dy = 0;
    u.x += dx * speed * dt / 1000; u.y += dy * speed * dt / 1000;
    u.vx = dx * speed; u.vy = dy * speed;
    u.state = 'move';
    clampPos(u);
  }

  function clampPos(u) {
    if (u.x < 0) u.x = 0; else if (u.x > FIELD.W) u.x = FIELD.W;
    if (u.y < FIELD.GROUND_TOP) u.y = FIELD.GROUND_TOP; else if (u.y > FIELD.GROUND_BOTTOM) u.y = FIELD.GROUND_BOTTOM;
  }

  function faceTo(u, v) {
    if (v.x > u.x + 1) u.facing = 1; else if (v.x < u.x - 1) u.facing = -1;
  }

  function startAttack(u) {
    u.act = 1; u.actT = 0; u.actDur = u.attackMs; u.struck = false;
    u.attackT = 0; u.state = 'attack';
    u.cd = u.cooldown;
  }

  // ───────────────────────────────────────────────────────────
  // 병사 AI
  // ───────────────────────────────────────────────────────────

  function updateSoldier(u, dt) {
    if (advanceAct(u, dt)) return;      // 공격 동작 중엔 안 움직인다
    const S = sides[u.side];
    const cmd = S.cmd;
    const isBow = u.kind === 'bow';

    // 목표 유지·재탐색
    let keep = validTarget(u);
    if (keep && b.time >= u.retargetAt) {
      // 대기 명령: 너무 멀어진 적은 놓아 준다
      if (cmd === 'hold') {
        const v = units[u.tgt];
        const lim = isBow ? KINDS.bow.range : TUNE.HOLD_RELEASE;
        if (dist2(u, v) > lim * lim) { setTarget(u, -1); keep = false; }
      } else if (cmd === 'retreat') {
        const v = units[u.tgt];
        const lim = TUNE.RETREAT_ENGAGE + 40;
        if (dist2(u, v) > lim * lim) { setTarget(u, -1); keep = false; }
      }
    }
    if (!keep || b.time >= u.retargetAt) {
      if (!keep || cmd === 'charge') setTarget(u, findSoldierTarget(u, cmd, isBow));
      u.retargetAt = b.time + TUNE.RETARGET_MS + (u.id % 6) * TICK_MS;
    }

    if (u.tgt >= 0 && cmd !== 'retreat') {
      if (isBow) engageBow(u, dt); else engageMelee(u, dt);
      return;
    }
    if (u.tgt >= 0) {
      // 후퇴: 붙은 적은 쿨다운이 돌 때 한 번 치고(300ms 멈춤) 계속 물러난다. 서서 싸우면 영영 못 빠진다.
      const v = units[u.tgt];
      const reach = (isBow ? KINDS.bow.meleeRange : u.range) + v.radius;
      if (u.cd <= 0 && dist2(u, v) <= reach * reach) { u.meleeNow = isBow; faceTo(u, v); startAttack(u); return; }
    }

    // 목표 없음: 명령에 따라 자리로
    if (cmd === 'charge') {
      // 적 무장도 없고 근처에 적도 없다 → 아무 적이나 (재탐색 때 잡힌다)
      u.state = 'idle';
      return;
    }
    // hold / retreat: 진형 자리로 (retreat 는 무장이 진영 끝으로 가므로 따라간다)
    const g = units[u.generalId];
    if (g.alive) {
      const p = slotPos(u, g);
      if (moveToward(u, p.x, p.y, u.speed, dt, 3)) { u.state = 'idle'; u.facing = S.dir; }
    } else {
      u.state = 'idle';
    }
  }

  function findSoldierTarget(u, cmd, isBow) {
    if (cmd === 'hold') return nearestEnemy(u, isBow ? KINDS.bow.range : TUNE.HOLD_ENGAGE, false);
    if (cmd === 'retreat') return nearestEnemy(u, TUNE.RETREAT_ENGAGE, false);
    // charge
    if (isBow) {
      const t = nearestEnemy(u, TUNE.SEARCH_BOW, false);
      if (t >= 0) return t;
    } else {
      // 자리가 남은 가까운 적 → (없으면) 나를 쏘는 놈 → 자리가 없어도 가까운 적
      let t = nearestEnemy(u, TUNE.SEARCH_MELEE, true);
      if (t < 0 && u.lastHitBy >= 0) {
        // 근처엔 없는데 맞고 있다 → 쏜 놈을 쫓는다
        const s = units[u.lastHitBy];
        if (s.alive && dist2(u, s) <= TUNE.CHASE_SHOOTER * TUNE.CHASE_SHOOTER) t = u.lastHitBy;
        else u.lastHitBy = -1;
      }
      if (t < 0) t = nearestEnemy(u, TUNE.SEARCH_MELEE, false);
      if (t >= 0) return t;
    }
    let t = nearestEnemyGeneral(u);
    if (t < 0) t = anyEnemy(u);
    return t;
  }

  function engageMelee(u, dt) {
    const v = units[u.tgt];
    const reach = u.range + v.radius;
    const d2 = dist2(u, v);
    if (d2 <= reach * reach) {
      faceTo(u, v);
      if (u.cd <= 0) startAttack(u); else u.state = 'idle';
      return;
    }
    moveToward(u, v.x, v.y, u.speed, dt, reach * 0.9);
  }

  function engageBow(u, dt) {
    const v = units[u.tgt];
    const k = KINDS.bow;
    const d2 = dist2(u, v);
    const S = sides[u.side];
    const cornered = (S.dir > 0 && u.x <= 4) || (S.dir < 0 && u.x >= FIELD.W - 4);
    if (d2 < k.minRange * k.minRange) {
      const reach = k.meleeRange + v.radius;
      if (cornered || d2 <= reach * reach * 0.5) {
        // 궁지: 근접전(×0.5)
        u.meleeNow = true;
        faceTo(u, v);
        if (d2 <= reach * reach) { if (u.cd <= 0) startAttack(u); else u.state = 'idle'; }
        else moveToward(u, v.x, v.y, u.speed, dt, reach * 0.9);
        return;
      }
      u.meleeNow = false;
      moveAway(u, v.x, v.y, u.speed * TUNE.BOW_BACK_MUL, dt);
      return;
    }
    u.meleeNow = false;
    if (d2 <= k.range * k.range) {
      faceTo(u, v);
      if (u.cd <= 0) { startAttack(u); return; }
      // 쏘고 난 사이엔 standOff 까지 다가선다(사거리 끝에 머물면 아무도 못 닿는 공짜 사격이 된다)
      if (d2 > k.standOff * k.standOff) moveToward(u, v.x, v.y, u.speed, dt, k.standOff);
      else u.state = 'idle';
      return;
    }
    moveToward(u, v.x, v.y, u.speed, dt, k.standOff);
  }

  // ───────────────────────────────────────────────────────────
  // 무장
  // ───────────────────────────────────────────────────────────

  function updateGeneral(u, dt) {
    // 회복: 3초 동안 안 맞았으면 초당 regen (플레이어도 — 빠져서 숨 돌릴 이유)
    u.noHitT += dt;
    const kg = KINDS.general;
    if (u.noHitT >= kg.regenAfterMs && u.hp < u.maxHp) u.hp = Math.min(u.maxHp, u.hp + kg.regen * dt / 1000);
    const acting = advanceAct(u, dt);
    if (u.act === 2 || u.act === 3) return;           // 무장기 자세·돌진 중엔 이동 없음
    if (u.ai) { if (!acting) generalAI(u, dt); return; }

    // ── 플레이어 무장: 입력 벡터로 이동(공격 중엔 ×0.3), 사거리 안 적을 자동 공격 ──
    const inX = u.inX, inY = u.inY;
    const moving = inX !== 0 || inY !== 0;
    if (moving) {
      const sp = u.speed * (acting ? TUNE.ATTACK_MOVE_MUL : 1);
      u.x += inX * sp * dt / 1000; u.y += inY * sp * dt / 1000;
      u.vx = inX * sp; u.vy = inY * sp;
      if (inX > 0.05) u.facing = 1; else if (inX < -0.05) u.facing = -1;
      clampPos(u);
      if (!acting) u.state = 'move';
    } else if (!acting) {
      u.state = 'idle';
    }
    if (acting) return;
    // 자동 공격: 사거리 안 가장 가까운 적
    if (u.cd <= 0) {
      const t = nearestEnemy(u, u.range + 14, false);
      if (t >= 0) {
        setTarget(u, t);
        if (!moving) faceTo(u, units[t]);
        startAttack(u);
      }
    }
  }

  /** 무장 u 의 살아 있는 부대 중심 (없으면 null). 반환 객체 재사용 */
  const _cen = { x: 0, y: 0, n: 0 };
  function troopCenter(u) {
    const S = sides[u.side];
    let sx = 0, sy = 0, n = 0;
    for (const si of S.soldiers) {
      const s = units[si];
      if (s.alive && s.generalId === u.id) { sx += s.x; sy += s.y; n++; }
    }
    if (n === 0) return null;
    _cen.x = sx / n; _cen.y = sy / n; _cen.n = n;
    return _cen;
  }

  function generalAI(u, dt) {
    const S = sides[u.side];
    const cmd = S.cmd;
    // 30% 미만이면 부대 뒤로, 50% 까지 회복하면 복귀 (경계에서 왔다 갔다 하지 않게)
    if (!u.low && u.hp < u.maxHp * TUNE.GENERAL_RETREAT_HP) u.low = true;
    else if (u.low && u.hp >= u.maxHp * TUNE.GENERAL_RETURN_HP) u.low = false;
    const low = u.low;

    // 목표 재탐색
    if (!validTarget(u) || b.time >= u.retargetAt) {
      u.retargetAt = b.time + TUNE.RETARGET_MS + (u.id % 6) * TICK_MS;
      let t;
      if (low) t = nearestEnemy(u, 300, false);
      else if (cmd === 'charge') { t = nearestEnemy(u, 260, true); if (t < 0) t = nearestEnemy(u, 260, false); if (t < 0) t = nearestEnemyGeneral(u); if (t < 0) t = anyEnemy(u); }
      else if (cmd === 'hold') t = nearestEnemy(u, 140, false);
      else t = nearestEnemy(u, 100, false);
      setTarget(u, t);
    }

    // 무장기: 게이지 100 이고 적이 200 안이면
    if (u.gauge >= GAUGE.max) {
      const t = nearestEnemy(u, TUNE.GENERAL_SKILL_RANGE, false);
      if (t >= 0) {
        faceTo(u, units[t]);
        if (useSkill(u.side, u.id)) return;
      }
    }

    const hasT = u.tgt >= 0;
    const v = hasT ? units[u.tgt] : null;
    const reach = hasT ? u.range + v.radius : 0;
    const inReach = hasT && dist2(u, v) <= reach * reach;

    if (inReach) {
      faceTo(u, v);
      if (u.cd <= 0) { startAttack(u); return; }
    }

    if (low && cmd === 'charge') {
      // 부대 뒤로(부대 중심에서 진영 쪽 160px, 부대가 없으면 진영 끝). 사거리 안 적은 때린다.
      //   「가장 가까운 적의 반대쪽」으로 도망치면 띠 위아래 모서리에 갇혀 남은 판을 멍하니 서 있었다(일곱째 벤치).
      //   돌격 때만 — 대기·후퇴 때는 병사가 무장을 따라 진형을 잡으므로 「부대 뒤」가 계속 뒤로 밀리는 순환이 된다.
      const c = troopCenter(u);
      let tx, ty;
      if (c) { tx = c.x - S.dir * TUNE.GENERAL_BEHIND; ty = c.y; }
      else { tx = S.retreatX; ty = GROUND_MID; }
      if (tx < 0) tx = 0; else if (tx > FIELD.W) tx = FIELD.W;
      if (moveToward(u, tx, ty, u.speed, dt, 8)) {
        // 자리에 닿았는데 적이 붙어 있으면 조금 더 물러난다
        if (hasT && !inReach && dist2(u, v) < 150 * 150) moveToward(u, S.retreatX, u.y, u.speed, dt, 8);
        else { u.state = 'idle'; u.facing = S.dir; }
      }
      return;
    }
    if (cmd === 'charge') {
      if (hasT) {
        if (!inReach) {
          // 멀리 있는 적에게는 병사 걸음으로(부대와 같이 도착하게), 가까우면 제 속도
          const near = TUNE.GENERAL_MARCH_NEAR;
          const sp = dist2(u, v) > near * near ? u.speed * TUNE.GENERAL_MARCH_MUL : u.speed;
          moveToward(u, v.x, v.y, sp, dt, reach * 0.9);
        } else u.state = 'idle';
      } else u.state = 'idle';
      return;
    }
    if (cmd === 'hold') {
      if (hasT) { if (!inReach) moveToward(u, v.x, v.y, u.speed, dt, reach * 0.9); else u.state = 'idle'; return; }
      if (moveToward(u, u.anchorX, u.anchorY, u.speed, dt, 3)) { u.state = 'idle'; u.facing = S.dir; }
      return;
    }
    // retreat: 붙은 적이 있어도 물러난다(쿨다운이 돌면 위에서 한 번 치고 계속). 서서 싸우면 영영 못 빠진다.
    //   통합 검수: 무장이 RETREAT_X(200/3000)에 서면 뒤 진형(30+9×22=228px)이 전장 밖으로 넘쳐 벽에 겹쳐 쌓였다
    //   (실측 47명 중 12명이 x≤1) → 맨 뒷줄이 RETREAT_X 에 서도록 무장은 진형 깊이만큼 앞에 선다(428/2772).
    const rx = S.retreatX + S.dir * (FORMATION.BACK + (FORMATION.COLS - 1) * FORMATION.DX);
    if (moveToward(u, rx, u.y, u.speed, dt, 3)) { u.state = 'idle'; u.facing = S.dir; }
  }

  // ───────────────────────────────────────────────────────────
  // 무장기
  // ───────────────────────────────────────────────────────────

  /** cone / circle: 즉시 범위 피해 + 넉백(+기절) */
  function applyAreaSkill(u, sk) {
    const E = sides[OTHER[u.side]];
    const r2 = sk.range * sk.range;
    const cosHalf = sk.shape === 'cone' ? Math.cos((sk.coneDeg / 2) * Math.PI / 180) : -2;
    const list = [E.generals, E.soldiers];
    for (let li = 0; li < 2; li++) {
      const arr = list[li];
      for (let k = 0; k < arr.length; k++) {
        const v = units[arr[k]];
        if (!v.alive) continue;
        const dx = v.x - u.x, dy = v.y - u.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > r2) continue;
        const d = Math.sqrt(d2) || 1;
        if (sk.shape === 'cone' && (dx * u.facing) / d < cosHalf) continue;
        // 거리 감쇠: 가까운 적은 그대로, 먼 적은 덜 다치고 튕겨 나가기만 한다
        const fo = TUNE.SKILL_FALLOFF;
        const t = d / sk.range;
        const mul = t <= fo.near ? 1 : Math.max(fo.min, Math.pow(1 - (t - fo.near) / (1 - fo.near), fo.pow));
        skillHit(u, v, sk, dx / d, dy / d, Math.round(sk.dmg * mul));
      }
    }
  }

  function skillHit(u, v, sk, nx, ny, dmg) {
    hit(u, v, dmg == null ? sk.dmg : dmg, false, true);
    if (!v.alive) return;
    if (sk.stun) { v.stunT = sk.stun; v.state = 'stun'; v.act = 0; v.attackT = 0; }
    if (sk.knock) knockback(v, nx, ny, sk.knock);
  }

  function knockback(v, nx, ny, dist) {
    if (v.kind === 'general') dist *= TUNE.GENERAL_KNOCK_MUL;
    const ms = TUNE.KNOCK_MS;
    v.kbT = ms;
    v.kbVx = nx * dist / (ms / 1000);
    v.kbVy = ny * dist / (ms / 1000);
    v.act = 0; v.attackT = 0; v.hurtT = 0;
    v.state = v.stunT > 0 ? 'stun' : 'hurt';
    events.push({ type: 'knockback', id: v.id, dx: nx * dist, dy: ny * dist, ms });
  }

  /** dash: 매 틱 앞으로 나아가며 경로폭 안의 적을 한 번씩 때린다 */
  function dashStep(u, dt) {
    const sk = SKILLS[u.skill];
    const sp = sk.range / (sk.dashMs / 1000);
    u.vx = u.dashDx * sp;
    u.x += u.vx * dt / 1000;
    u.facing = u.dashDx;
    clampPos(u);
    const half = sk.pathWidth / 2;
    const cr = 1;
    const cx = (u.x / TUNE.CELL) | 0, cy = (u.y / TUNE.CELL) | 0;
    for (let gy = Math.max(0, cy - cr); gy <= Math.min(GRID_ROWS - 1, cy + cr); gy++) {
      for (let gx = Math.max(0, cx - cr); gx <= Math.min(GRID_COLS - 1, cx + cr); gx++) {
        const cell = cells[gy * GRID_COLS + gx];
        for (let k = 0; k < cell.length; k++) {
          const vi = cell[k];
          const v = units[vi];
          if (v.side === u.side || !v.alive || u.dashHit.has(vi)) continue;
          const dx = v.x - u.x, dy = v.y - u.y;
          if (Math.abs(dy) > half || dx * dx + dy * dy > half * half * 2) continue;
          u.dashHit.add(vi);
          // 옆으로 튕겨 낸다(돌진 방향 + 위아래)
          const sy = dy >= 0 ? 1 : -1;
          skillHit(u, v, sk, u.dashDx * 0.6, sy * 0.8);
        }
      }
    }
  }

  // ───────────────────────────────────────────────────────────
  // 겹침 방지 — 같은 셀 + 오른쪽·아래쪽 이웃 셀(각 쌍을 한 번만).
  //   같은 셀만 보면 셀 경계에 걸친 유닛끼리 겹쳐 무장 하나에 기병 45기가 달라붙었다(둘째 벤치: 무장 3초 만에 반피).
  //   유닛당 비교 수는 여전히 셀 안 인원 몫이라 244 유닛에 0.1ms 안쪽.
  // ───────────────────────────────────────────────────────────

  const NEIGHBOR = [[1, 0], [-1, 1], [0, 1], [1, 1]];

  function separatePair(a, bb) {
    const minD = a.radius + bb.radius;
    let dx = bb.x - a.x, dy = bb.y - a.y;
    let d2 = dx * dx + dy * dy;
    if (d2 >= minD * minD) return;
    if (d2 < 0.01) { const ang = rand() * Math.PI * 2; dx = Math.cos(ang) * 0.1; dy = Math.sin(ang) * 0.1; d2 = 0.01; }
    const d = Math.sqrt(d2);
    const push = (minD - d) * 0.5;
    // 무장은 잘 안 밀린다(병사에 떠밀려 조종감이 흐트러지지 않게)
    const wa = a.kind === 'general' ? 0.2 : 1, wb = bb.kind === 'general' ? 0.2 : 1;
    const ux = dx / d, uy = dy / d;
    a.x -= ux * push * wa; a.y -= uy * push * wa;
    bb.x += ux * push * wb; bb.y += uy * push * wb;
  }

  function separate() {
    for (let gy = 0; gy < GRID_ROWS; gy++) {
      for (let gx = 0; gx < GRID_COLS; gx++) {
        const cell = cells[gy * GRID_COLS + gx];
        const n = cell.length;
        if (n === 0) continue;
        for (let i = 0; i < n - 1; i++) {
          const a = units[cell[i]];
          for (let j = i + 1; j < n; j++) separatePair(a, units[cell[j]]);
        }
        for (let k = 0; k < 4; k++) {
          const nx = gx + NEIGHBOR[k][0], ny = gy + NEIGHBOR[k][1];
          if (nx < 0 || nx >= GRID_COLS || ny >= GRID_ROWS) continue;
          const other = cells[ny * GRID_COLS + nx];
          const m = other.length;
          if (m === 0) continue;
          for (let i = 0; i < n; i++) {
            const a = units[cell[i]];
            for (let j = 0; j < m; j++) separatePair(a, units[other[j]]);
          }
        }
      }
    }
    // 띠 밖으로 밀려난 것만 다시 넣는다
    for (let i = 0; i < units.length; i++) { const u = units[i]; if (u.alive) clampPos(u); }
  }

  // ───────────────────────────────────────────────────────────
  // 승패
  // ───────────────────────────────────────────────────────────

  function lost(S) {
    if (S.generalsAlive === 0) return 'generals';
    if (S.soldiersAlive === 0) return 'routed';
    return null;
  }

  function judge() {
    const L = sides.left, R = sides.right;
    const lLost = lost(L), rLost = lost(R);
    let winner = null, reason = null;
    if (lLost && rLost) { winner = 'draw'; reason = REASON.mutual; }
    else if (rLost) { winner = 'left'; reason = REASON[rLost]; }
    else if (lLost) { winner = 'right'; reason = REASON[lLost]; }
    else if (b.time >= TUNE.TIME_LIMIT_MS) {
      const lr = L.alive / L.init, rr = R.alive / R.init;
      winner = lr > rr ? 'left' : rr > lr ? 'right' : 'draw';
      reason = REASON.timeout;
    }
    if (!winner) return;
    b.result = { winner, reason, leftAlive: L.alive, rightAlive: R.alive, time: b.time };
    events.push({ type: 'end', winner, reason });
  }

  function dist2(a, v) {
    const dx = v.x - a.x, dy = v.y - a.y;
    return dx * dx + dy * dy;
  }

  return b;
}
