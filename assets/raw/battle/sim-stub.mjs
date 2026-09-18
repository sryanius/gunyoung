// sim-stub.mjs — 화면(BattleScene) 개발·검증용 더미 sim. 진짜는 src/battle/sim.js (다른 에이전트).
//   BATTLE.md §2.1 의 API·Unit·Event 계약을 그대로 따르되 속은 아주 단순하다:
//   가장 가까운 적에게 직진, 사거리 안이면 attackT 0→1 로 공격(0.5 에서 피해), 궁병은 화살 이벤트 + 0.45초 뒤 피해,
//   무장기는 범위 피해 + 넉백 + (있으면) 기절, 병법 3종, 무장 사망 시 부대 도주, 승패·시간 초과 판정.
//   이웃 탐색은 O(n²)(재탐색 150ms 간격) — 벤치 기준(틱 2ms)은 신경 쓰지 않는다. Phaser·DOM·Date.now·Math.random 없음.
//   BattleScene 은 import('./sim.js') 가 실패할 때만 이 파일을 동적 import 한다.

const FIELD = { w: 3200, top: 400, bottom: 690 };

/** BATTLE.md §3 수치 */
const KINDS = {
  inf:     { hp: 40,  atk: 9,  def: 2, speed: 95,  range: 34,  cooldown: 900 },
  spear:   { hp: 45,  atk: 10, def: 3, speed: 85,  range: 40,  cooldown: 1000 },
  bow:     { hp: 28,  atk: 8,  def: 0, speed: 90,  range: 260, cooldown: 1400 },
  cav:     { hp: 55,  atk: 12, def: 3, speed: 170, range: 36,  cooldown: 800 },
  general: { hp: 600, atk: 38, def: 8, speed: 130, range: 48,  cooldown: 550 },
};
/** 상성: 공격자 kind → 피해자 kind → 배율 */
const AFFINITY = { cav: { inf: 1.5, bow: 1.5 }, spear: { cav: 1.5 }, inf: { spear: 1.5 } };
/** 무장기 — id 로 받았을 때 찾는 표 (BattleScene.DEFAULT_DATA 와 같은 id) */
const SKILLS = {
  qinglong: { id: 'qinglong', name: '청룡참', shape: 'cone',   range: 420, dmg: 60, knock: 120 },
  roar:     { id: 'roar',     name: '포효',   shape: 'circle', range: 300, dmg: 35, knock: 180, stun: 2000 },
  assault:  { id: 'assault',  name: '맹공',   shape: 'dash',   range: 500, dmg: 45, knock: 40 },
  twinaxe:  { id: 'twinaxe',  name: '쌍극',   shape: 'circle', range: 240, dmg: 50, knock: 60 },
};
const GENERIC_SKILL = { id: 'generic', name: '무장기', shape: 'circle', range: 240, dmg: 40, knock: 80 };

const ATTACK_MS = 300;        // attackT 0→1 시간
const ARROW_MS = 450;
const BOW_MIN = 120;
const HOLD_ENGAGE = 90;
const RETARGET_MS = 150;
const DEAD_MS = 1500;         // dead → gone
const TIME_LIMIT = 180000;

function mulberry32(a) {
  a = a >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const alive = (u) => u.state !== 'dead' && u.state !== 'gone' && u.state !== 'flee';

class StubBattle {
  constructor(seed, left, right) {
    this.rnd = mulberry32(seed);
    this.units = [];
    this.time = 0;
    this.result = null;
    this.events = [];
    this.cmds = { left: 'hold', right: 'hold' };
    this.inputs = new Map();
    this.playerIds = new Set();
    this.arrows = [];
    this.total = { left: 0, right: 0 };
    this.aiCharged = false;
    this.build('left', left || {});
    this.build('right', right || {});
    this.total.left = this.countAlive('left');
    this.total.right = this.countAlive('right');
  }

  mk(p) {
    const k = KINDS[p.kind] || KINDS.inf;
    const u = {
      id: this.units.length, side: p.side, kind: p.kind, generalId: -1,
      x: p.x, y: p.y, facing: p.facing, hp: k.hp, maxHp: k.hp,
      state: 'idle', attackT: 0, vx: 0, vy: 0,
      cd: 0, stunT: 0, deadT: 0, target: -1, retarget: 0, hitDone: false, slot: null,
    };
    if (p.kind === 'general') {
      u.name = p.name;
      u.gauge = 0;
      u.skill = p.skill;
      u.skillData = p.skillData;
    }
    this.units.push(u);
    return u;
  }

  build(side, army) {
    const facing = side === 'left' ? 1 : -1;
    const gens = Array.isArray(army.generals) ? army.generals.slice(0, 2) : [];
    if (!gens.length) return;
    // 무장 먼저 만들어 id 0~3 이 data.js 의 무장 id 와 같게(진짜 sim 과 같은 규약), 병사는 뒤에
    const made = gens.map((g, i) => {
      g = g || {};
      const gx = g.x != null ? g.x : (side === 'left' ? [520, 560][i] : [2680, 2640][i]);
      const gy = g.y != null ? g.y : [520, 600][i];
      const skillRef = g.skill;
      const skillId = typeof skillRef === 'object' && skillRef ? (skillRef.id || skillRef.name) : skillRef;
      const skillData = (typeof skillRef === 'object' && skillRef) || SKILLS[skillId] || { ...GENERIC_SKILL, id: skillId || 'generic' };
      const gen = this.mk({ side, kind: 'general', x: gx, y: gy, facing, name: g.name || `무장 ${i + 1}`, skill: skillId || skillData.id, skillData });
      gen.generalId = gen.id;
      gen.dataId = g.id != null ? g.id : -1;
      gen.color = g.color;
      const p = army.player;
      if (p != null && (p === g || p === g.id || p === g.key || (typeof p === 'object' && p.name === g.name))) this.playerIds.add(gen.id);
      return { g, gen, gx, gy };
    });
    for (const { g, gen, gx, gy } of made) {
      // troops: [{ kind, n }] (data.js) 또는 ['inf', ...](병종 이름 순환) — 합쳐서 60명
      const list = [];
      const raw = Array.isArray(g.troops) && g.troops.length ? g.troops : [g.kind || g.troop || 'inf'];
      for (const t of raw) {
        if (t && typeof t === 'object') for (let n = 0; n < (t.n || 0); n++) list.push(t.kind);
        else list.push(t);
      }
      // {kind,n} 형식이면 적힌 수만큼(최대 60), 이름 목록이면 순환해서 60명
      const n = raw.some((t) => t && typeof t === 'object') ? Math.min(60, list.length) : 60;
      for (let k = 0; k < n; k++) {
        const col = k % 6, row = Math.floor(k / 6);
        const want = list.length ? list[k % list.length] : 'inf';
        const kind = KINDS[want] ? want : 'inf';
        const u = this.mk({ side, kind, x: gx - facing * (30 + col * 22), y: clamp(gy + (row - 4.5) * 20, FIELD.top, FIELD.bottom), facing });
        u.generalId = gen.id;
        u.slot = { col, row };
      }
    }
  }

  // ── API ──────────────────────────────────────────────────────

  drainEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }

  command(side, cmd) {
    if (!(side in this.cmds)) return;
    this.cmds[side] = cmd;
    this.events.push({ type: 'command', side, cmd });
  }

  setGeneralInput(side, generalId, v) {
    this.inputs.set(generalId, { dx: clamp(+v.dx || 0, -1, 1), dy: clamp(+v.dy || 0, -1, 1) });
  }

  useSkill(side, generalId) {
    const g = this.units[generalId];
    if (!g || g.side !== side || g.kind !== 'general' || !alive(g) || g.state === 'stun') return false;
    if ((g.gauge || 0) < 100) return false;
    g.gauge = 0;
    const sk = g.skillData || GENERIC_SKILL;
    const f = g.facing;
    this.events.push({ type: 'skill', id: g.id, side, skill: g.skill, x: g.x, y: g.y, facing: f });
    const ox = g.x, oy = g.y;
    if (sk.shape === 'dash') {
      g.x = clamp(g.x + f * sk.range, 0, FIELD.w);
    }
    for (const u of this.units) {
      if (u.side === side || !alive(u)) continue;
      const dx = u.x - ox, dy = u.y - oy;
      const d = Math.hypot(dx, dy);
      let hit = false;
      if (sk.shape === 'cone') hit = d <= sk.range && dx * f > 0 && Math.abs(Math.atan2(dy, dx * f)) <= 50 * Math.PI / 180;
      else if (sk.shape === 'dash') hit = dx * f >= 0 && dx * f <= sk.range && Math.abs(dy) <= 48;
      else hit = d <= sk.range;
      if (!hit) continue;
      this.damage(g, u, sk.dmg, true);
      if (sk.knock && alive(u)) {
        const n = d > 1 ? d : 1;
        const kx = (dx / n) * sk.knock, ky = (dy / n) * sk.knock * 0.4;
        u.x = clamp(u.x + kx, 0, FIELD.w);
        u.y = clamp(u.y + ky, FIELD.top, FIELD.bottom);
        this.events.push({ type: 'knockback', id: u.id, dx: kx, dy: ky, ms: 200 });
      }
      if (sk.stun && alive(u)) {
        u.state = 'stun';
        u.stunT = sk.stun;
        u.attackT = 0;
      }
    }
    return true;
  }

  generalsOf(side) {
    return this.units.filter((u) => u.side === side && u.kind === 'general');
  }

  countAlive(side) {
    let n = 0;
    for (const u of this.units) if (u.side === side && alive(u)) n++;
    return n;
  }

  // ── 내부 ─────────────────────────────────────────────────────

  damage(from, to, base, isSkill = false) {
    if (!alive(to)) return;
    const fk = KINDS[from.kind] || KINDS.inf, tk = KINDS[to.kind] || KINDS.inf;
    let dmg;
    if (isSkill) dmg = base;
    else {
      const aff = (AFFINITY[from.kind] && AFFINITY[from.kind][to.kind]) || 1;
      dmg = fk.atk * aff * (0.85 + this.rnd() * 0.3) - tk.def;
      if (from.kind === 'bow' && from.meleeHit) dmg *= 0.5;
      if (to.kind === 'general' && from.kind !== 'general') dmg *= 0.6;
    }
    const crit = !isSkill && this.rnd() < 0.08;
    if (crit) dmg *= 1.5;
    dmg = Math.max(1, Math.round(dmg));
    to.hp -= dmg;
    this.events.push({ type: 'hit', x: to.x, y: to.y, from: from.id, to: to.id, dmg, crit });
    if (from.kind === 'general') from.gauge = Math.min(100, (from.gauge || 0) + 6);
    if (to.kind === 'general') to.gauge = Math.min(100, (to.gauge || 0) + 2);
    if (to.hp <= 0) this.kill(to);
  }

  kill(u) {
    u.hp = 0;
    u.state = 'dead';
    u.deadT = 0;
    u.attackT = 0;
    u.vx = u.vy = 0;
    this.events.push({ type: 'death', id: u.id, x: u.x, y: u.y, side: u.side });
    if (u.kind === 'general') {
      for (const s of this.units) if (s.generalId === u.id && s.id !== u.id && alive(s)) this.flee(s);
    }
    // 편 병력 15% 미만이면 남은 병사 도주(무장은 남는다)
    const side = u.side;
    if (this.countAlive(side) < this.total[side] * 0.15) {
      for (const s of this.units) if (s.side === side && s.kind !== 'general' && alive(s)) this.flee(s);
    }
  }

  flee(u) {
    u.state = 'flee';
    u.attackT = 0;
    u.target = -1;
    this.events.push({ type: 'flee', id: u.id });
  }

  nearestEnemy(u) {
    let best = null, bd = Infinity;
    for (const v of this.units) {
      if (v.side === u.side || !alive(v)) continue;
      const d = (v.x - u.x) * (v.x - u.x) + (v.y - u.y) * (v.y - u.y);
      if (d < bd) { bd = d; best = v; }
    }
    return best;
  }

  targetOf(u, dt) {
    let t = u.target >= 0 ? this.units[u.target] : null;
    u.retarget -= dt;
    if (!t || !alive(t) || u.retarget <= 0) {
      t = this.nearestEnemy(u);
      u.target = t ? t.id : -1;
      u.retarget = RETARGET_MS;
    }
    return t;
  }

  /** (tx,ty) 로 걷는다. 도착하면 false */
  moveToward(u, tx, ty, speed, dt) {
    const dx = tx - u.x, dy = ty - u.y;
    const d = Math.hypot(dx, dy);
    if (d < 2) { u.vx = u.vy = 0; return false; }
    const step = Math.min(d, speed * dt / 1000);
    const nx = dx / d, ny = dy / d;
    u.x = clamp(u.x + nx * step, 0, FIELD.w);
    u.y = clamp(u.y + ny * step, FIELD.top, FIELD.bottom);
    u.vx = nx * step; u.vy = ny * step;
    if (Math.abs(dx) > 1) u.facing = dx < 0 ? -1 : 1;
    u.state = 'move';
    return true;
  }

  /** 사거리 안 목표 공격 진행. 공격 중이면 true */
  attack(u, t, dt) {
    const k = KINDS[u.kind] || KINDS.inf;
    if (u.state === 'attack') {
      u.attackT += dt / ATTACK_MS;
      if (!u.hitDone && u.attackT >= 0.5) {
        u.hitDone = true;
        if (t && alive(t)) this.damage(u, t, 0);
      }
      if (u.attackT >= 1) {
        u.attackT = 0;
        u.state = 'idle';
        u.cd = k.cooldown;
      }
      return true;
    }
    if (!t) return false;
    const d = Math.hypot(t.x - u.x, t.y - u.y);
    if (d > k.range + 6) return false;
    u.facing = t.x < u.x ? -1 : 1;
    u.vx = u.vy = 0;
    if (u.cd > 0) { u.state = 'idle'; return true; }
    u.state = 'attack';
    u.attackT = 0;
    u.hitDone = false;
    return true;
  }

  step(dt) {
    this.time += dt;
    if (!this.aiCharged && this.time >= 5000) {
      this.aiCharged = true;
      this.command('right', 'charge');
    }
    // 예약된 화살 피해
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const a = this.arrows[i];
      if (this.time < a.at) continue;
      this.arrows.splice(i, 1);
      const from = this.units[a.from], to = this.units[a.to];
      if (from && to && alive(to)) this.damage(from, to, 0);
    }
    for (const u of this.units) {
      if (u.cd > 0) u.cd -= dt;
      switch (u.state) {
        case 'dead':
          u.deadT += dt;
          if (u.deadT >= DEAD_MS) u.state = 'gone';
          continue;
        case 'gone':
          continue;
        case 'flee': {
          const tx = u.side === 'left' ? -120 : FIELD.w + 120;
          const k = KINDS[u.kind] || KINDS.inf;
          this.moveToward(u, tx, u.y, k.speed * 1.2, dt);
          u.state = 'flee';
          if (u.x <= 0 || u.x >= FIELD.w) u.state = 'gone';
          continue;
        }
        case 'stun':
          u.stunT -= dt;
          if (u.stunT <= 0) u.state = 'idle';
          continue;
        default:
          break;
      }
      if (this.result) { if (u.state === 'move') u.state = 'idle'; continue; }   // 끝나면 제자리
      const k = KINDS[u.kind] || KINDS.inf;
      const t = this.targetOf(u, dt);

      // 플레이어 무장 — 입력 벡터로 이동, 사거리 안 적 자동 공격(공격 중 이동 0.3배)
      if (u.kind === 'general' && this.playerIds.has(u.id)) {
        const inp = this.inputs.get(u.id) || { dx: 0, dy: 0 };
        const attacking = this.attack(u, t, dt);
        const mag = Math.hypot(inp.dx, inp.dy);
        if (mag > 0.01) {
          const sp = k.speed * (attacking ? 0.3 : 1) * dt / 1000;
          u.x = clamp(u.x + inp.dx * sp, 0, FIELD.w);
          u.y = clamp(u.y + inp.dy * sp, FIELD.top, FIELD.bottom);
          u.vx = inp.dx * sp; u.vy = inp.dy * sp;
          if (!attacking) { u.state = 'move'; if (Math.abs(inp.dx) > 0.05) u.facing = inp.dx < 0 ? -1 : 1; }
        } else if (!attacking) { u.state = 'idle'; u.vx = u.vy = 0; }
        continue;
      }

      // AI 무장 — 가장 가까운 적으로, HP 30% 미만이면 물러남, 게이지 100 이면 적이 200 안일 때 무장기
      if (u.kind === 'general') {
        if (u.gauge >= 100 && t && Math.hypot(t.x - u.x, t.y - u.y) <= 200) { this.useSkill(u.side, u.id); continue; }
        if (u.hp < u.maxHp * 0.3) {
          const tx = u.side === 'left' ? 200 : FIELD.w - 200;
          if (this.attack(u, t, dt)) continue;
          if (!this.moveToward(u, tx, u.y, k.speed, dt)) u.state = 'idle';
          continue;
        }
        if (this.attack(u, t, dt)) continue;
        if (t) this.moveToward(u, t.x, t.y, k.speed, dt); else u.state = 'idle';
        continue;
      }

      // 병사
      const cmd = this.cmds[u.side];
      const gen = this.units[u.generalId];
      const dT = t ? Math.hypot(t.x - u.x, t.y - u.y) : Infinity;
      if (u.kind === 'bow' && t && cmd !== 'retreat' && (cmd === 'charge' || dT <= HOLD_ENGAGE + 40)) {
        // 궁병: 120~260 이면 서서 쏜다, 120 안이면 물러난다
        if (dT <= KINDS.bow.range && dT > BOW_MIN) {
          u.facing = t.x < u.x ? -1 : 1;
          u.vx = u.vy = 0;
          u.state = 'idle';
          if (u.cd <= 0) {
            u.cd = KINDS.bow.cooldown;
            u.state = 'attack'; u.attackT = 0; u.hitDone = true;   // 활 당기는 동작만
            this.events.push({ type: 'arrow', from: u.id, to: t.id, x0: u.x, y0: u.y, x1: t.x, y1: t.y, ms: ARROW_MS });
            this.arrows.push({ at: this.time + ARROW_MS, from: u.id, to: t.id });
          }
          continue;
        }
        if (u.state === 'attack') { u.attackT += dt / ATTACK_MS; if (u.attackT >= 1) { u.attackT = 0; u.state = 'idle'; } continue; }
        if (dT <= BOW_MIN) {
          const away = u.x + (u.x < t.x ? -60 : 60);
          this.moveToward(u, away, u.y, KINDS.bow.speed, dt);
          u.facing = t.x < u.x ? -1 : 1;
          continue;
        }
        if (cmd === 'charge') { this.moveToward(u, t.x, t.y, KINDS.bow.speed, dt); continue; }
      }
      if (u.state === 'attack' || (t && (cmd === 'charge' || dT <= HOLD_ENGAGE))) {
        if (this.attack(u, t, dt)) continue;
        if (cmd === 'charge' && t) { this.moveToward(u, t.x, t.y, k.speed, dt); continue; }
        if (t && dT <= HOLD_ENGAGE) { this.moveToward(u, t.x, t.y, k.speed, dt); continue; }
      }
      if (cmd === 'retreat') {
        const tx = u.side === 'left' ? 200 : FIELD.w - 200;
        if (!this.moveToward(u, tx, u.y, k.speed, dt)) u.state = 'idle';
        continue;
      }
      // 대기(hold) 또는 목표 없음: 무장 뒤 진형 자리로
      if (gen && alive(gen) && u.slot) {
        const f = gen.facing;
        const sx = gen.x - f * (30 + u.slot.col * 22);
        const sy = clamp(gen.y + (u.slot.row - 4.5) * 20, FIELD.top, FIELD.bottom);
        if (!this.moveToward(u, sx, sy, k.speed, dt)) { u.state = 'idle'; u.facing = f; }
      } else {
        u.state = 'idle';
      }
    }
    this.judge();
  }

  judge() {
    if (this.result) return;
    const gl = this.generalsOf('left').filter(alive).length;
    const gr = this.generalsOf('right').filter(alive).length;
    const al = this.countAlive('left'), ar = this.countAlive('right');
    let winner = null, reason = '';
    if (gr === 0) { winner = 'left'; reason = '적 무장 전멸'; }
    else if (ar === 0) { winner = 'left'; reason = '적군 궤멸'; }
    else if (gl === 0) { winner = 'right'; reason = '아군 무장 전멸'; }
    else if (al === 0) { winner = 'right'; reason = '아군 궤멸'; }
    else if (this.time >= TIME_LIMIT) {
      const rl = al / Math.max(1, this.total.left), rr = ar / Math.max(1, this.total.right);
      winner = Math.abs(rl - rr) < 0.05 ? 'draw' : (rl > rr ? 'left' : 'right');
      reason = '시간 초과';
    }
    if (!winner) return;
    this.result = { winner, reason, leftAlive: al, rightAlive: ar };
    this.events.push({ type: 'end', winner, reason });
  }
}

/** §2.1 — createBattle({ seed, left, right }) */
export function createBattle({ seed = 1, left, right } = {}) {
  return new StubBattle(seed, left, right);
}

export default { createBattle };
