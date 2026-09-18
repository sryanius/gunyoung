#!/usr/bin/env node
// 전투 헤드리스 벤치 (docs/BATTLE.md §6) — 브라우저 없이 sim 만 굴린다.
//
//   node tools/battle-bench.mjs                 seed 1~5, AI vs AI(양쪽 돌격, 플레이어 무장도 AI) 180초
//   node tools/battle-bench.mjs --seeds=1-10    seed 범위
//   node tools/battle-bench.mjs --player        관우를 30초간 적 쪽으로 밀며(가장 가까운 적 무장 방향, 붙으면 멈춤) 게이지 100 이면 무장기
//                                               — 무장기가 실제로 적을 맞히고 죽이는지. 무작정 dx=1 이면 적진을 뚫고 지나 전장 끝에서 혼자 죽는다.
//   node tools/battle-bench.mjs --verbose       판마다 10초 간격 병력 추이
//
// 기준(하나라도 어긋나면 exit 1):
//   전부 종료(승패) · 평균 종료 60~120초 · 틱 평균 ≤2ms · 틱 p99.9 ≤8ms · 양쪽 다 이긴 적 있음 · 결정성(같은 seed 두 번 = 같은 hp 합·x 합)
//   틱 최대는 첫 틱 JIT 워밍업(~3ms)과 OS/GC 튐(한 번 10ms 가 나왔다 — 같은 seed 재실행에서는 2.7ms)이 섞이므로
//   표에 보여 주되 판정은 p99.9 로 하고, 원 최대가 8ms 를 넘으면 WARN 만 찍는다.

import { performance } from 'node:perf_hooks';
import { createBattle, TICK_MS } from '../src/battle/sim.js';
import { ARMY_LEFT, ARMY_RIGHT, GAUGE, FIELD } from '../src/battle/data.js';

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n, d) => { const a = args.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };

const SECS = Number(opt('secs', 180));
const VERBOSE = flag('verbose');
const [S0, S1] = opt('seeds', '1-5').split('-').map(Number);
const SEEDS = []; for (let s = S0; s <= (S1 || S0); s++) SEEDS.push(s);

const LIMITS = { endMin: 60, endMax: 120, tickAvg: 2, tickMax: 8 };

/** 한 판. 매 틱 시간을 재고 이벤트를 비운다(안 비우면 배열이 자란다). */
function runAI(seed, secs, verbose) {
  const b = createBattle({ seed, left: ARMY_LEFT, right: ARMY_RIGHT, aiControlled: true });
  b.command('left', 'charge');
  b.command('right', 'charge');
  const ticks = Math.round(secs * 1000 / TICK_MS);
  let sum = 0, max = 0, n = 0;
  const samples = [];
  const trace = [];
  let nextTrace = 0;
  let ev = { hit: 0, arrow: 0, death: 0, flee: 0, skill: 0, knockback: 0 };
  for (let i = 0; i < ticks; i++) {
    const t0 = performance.now();
    b.step(TICK_MS);
    const ms = performance.now() - t0;
    sum += ms; n++; if (ms > max) max = ms; samples.push(ms);
    for (const e of b.drainEvents()) if (ev[e.type] != null) ev[e.type]++;
    if (verbose && b.time >= nextTrace) {
      trace.push(`${(b.time / 1000).toFixed(0).padStart(3)}s L${String(b.countAlive('left')).padStart(3)} R${String(b.countAlive('right')).padStart(3)}`);
      nextTrace += 10000;
    }
    if (b.result) break;
  }
  samples.sort((a, c) => a - c);
  const p999 = samples[Math.min(samples.length - 1, Math.floor(samples.length * 0.999))];
  return { b, seed, avg: sum / n, max, p999, ticks: n, ev, trace };
}

function checksum(b) {
  let hp = 0, x = 0;
  for (const u of b.units) { hp += u.hp; x += u.x; }
  return { hp, x: Math.round(x * 1000) / 1000 };
}

const fails = [];
const failIf = (cond, msg) => { if (cond) fails.push(msg); };

// ─────────────────────────────────────────────────────────────
// AI vs AI
// ─────────────────────────────────────────────────────────────

console.log(`== AI vs AI (seed ${SEEDS[0]}~${SEEDS[SEEDS.length - 1]}, 양쪽 돌격, ${SECS}초)`);
const rows = [];
for (const seed of SEEDS) {
  const r = runAI(seed, SECS, VERBOSE);
  const res = r.b.result;
  rows.push({
    seed,
    end: res ? (res.time / 1000).toFixed(1) : '-',
    winner: res ? res.winner : '미종료',
    reason: res ? res.reason : '',
    left: r.b.countAlive('left'),
    right: r.b.countAlive('right'),
    skills: `${r.b.skillCount.left}/${r.b.skillCount.right}`,
    avg: r.avg,
    max: r.max,
    p999: r.p999,
    ev: r.ev,
  });
  if (VERBOSE) console.log(`  seed ${seed}: ${r.trace.join(' | ')}`);
}

const pad = (s, w) => String(s).padStart(w);
console.log(`  ${'seed'.padStart(4)} ${'종료'.padStart(7)} ${'승자'.padStart(6)} ${'L'.padStart(4)} ${'R'.padStart(4)} ${'무장기'.padStart(7)} ${'틱avg'.padStart(8)} ${'p99.9'.padStart(8)} ${'틱max'.padStart(8)}  사유`);
for (const r of rows) {
  console.log(`  ${pad(r.seed, 4)} ${pad(r.end + 's', 7)} ${pad(r.winner, 6)} ${pad(r.left, 4)} ${pad(r.right, 4)} ${pad(r.skills, 7)} ${pad(r.avg.toFixed(3) + 'ms', 8)} ${pad(r.p999.toFixed(2) + 'ms', 8)} ${pad(r.max.toFixed(2) + 'ms', 8)}  ${r.reason}`);
}
const ended = rows.filter((r) => r.winner !== '미종료');
const avgEnd = ended.length ? ended.reduce((a, r) => a + Number(r.end), 0) / ended.length : NaN;
const avgTick = rows.reduce((a, r) => a + r.avg, 0) / rows.length;
const maxTick = Math.max(...rows.map((r) => r.max));
const p999Tick = Math.max(...rows.map((r) => r.p999));
const lw = rows.filter((r) => r.winner === 'left').length;
const rw = rows.filter((r) => r.winner === 'right').length;
const dr = rows.filter((r) => r.winner === 'draw').length;
const evSum = rows.reduce((a, r) => { for (const k in r.ev) a[k] = (a[k] || 0) + r.ev[k]; return a; }, {});
console.log(`  종료 ${ended.length}/${rows.length} · 평균 종료 ${avgEnd.toFixed(1)}s · 승 L${lw} R${rw} 무${dr} · 틱 평균 ${avgTick.toFixed(3)}ms p99.9 ${p999Tick.toFixed(2)}ms 최대 ${maxTick.toFixed(2)}ms`);
console.log(`  이벤트 합: hit ${evSum.hit} arrow ${evSum.arrow} death ${evSum.death} flee ${evSum.flee} skill ${evSum.skill} knockback ${evSum.knockback}`);

failIf(ended.length !== rows.length, `미종료 ${rows.length - ended.length}판`);
failIf(!(avgEnd >= LIMITS.endMin && avgEnd <= LIMITS.endMax), `평균 종료 ${avgEnd.toFixed(1)}s (기준 ${LIMITS.endMin}~${LIMITS.endMax})`);
failIf(avgTick > LIMITS.tickAvg, `틱 평균 ${avgTick.toFixed(3)}ms > ${LIMITS.tickAvg}`);
failIf(p999Tick > LIMITS.tickMax, `틱 p99.9 ${p999Tick.toFixed(2)}ms > ${LIMITS.tickMax}`);
if (maxTick > LIMITS.tickMax) console.log(`  WARN 틱 최대 ${maxTick.toFixed(2)}ms > ${LIMITS.tickMax} (단발 튐 — 같은 seed 를 다시 돌려 재현되면 문제)`);
failIf(lw === 0 || rw === 0, `한쪽이 한 판도 못 이김 (L${lw} R${rw})`);

// ─────────────────────────────────────────────────────────────
// 결정성: 같은 seed 두 번
// ─────────────────────────────────────────────────────────────

{
  const a = runAI(SEEDS[0], SECS, false), c = runAI(SEEDS[0], SECS, false);
  const ka = checksum(a.b), kc = checksum(c.b);
  const same = ka.hp === kc.hp && ka.x === kc.x && a.b.time === c.b.time
    && JSON.stringify(a.b.result) === JSON.stringify(c.b.result);
  console.log(`== 결정성 (seed ${SEEDS[0]} 두 번): hp 합 ${ka.hp} / ${kc.hp}, x 합 ${ka.x} / ${kc.x} → ${same ? '같음' : '다름!'}`);
  failIf(!same, '결정성 깨짐');
}

// ─────────────────────────────────────────────────────────────
// 후퇴 시나리오(통합 검수): 20초 돌격 뒤 양쪽 「후퇴」 40초 — 진형이 전장 밖으로 넘쳐 벽(x≤1 / x≥W−1)에 쌓이면 안 된다
//   (고치기 전엔 왼쪽 병사 47명 중 12명이 x≤1 이었다). 무장은 RETREAT_X 에서 진형 깊이(228)만큼 앞에 선다.
// ─────────────────────────────────────────────────────────────

{
  const b = createBattle({ seed: SEEDS[0], left: ARMY_LEFT, right: ARMY_RIGHT, aiControlled: true });
  b.command('left', 'charge'); b.command('right', 'charge');
  const t20 = Math.round(20000 / TICK_MS), t60 = Math.round(60000 / TICK_MS);
  for (let i = 0; i < t20; i++) { b.step(TICK_MS); b.drainEvents(); }
  b.command('left', 'retreat'); b.command('right', 'retreat');
  for (let i = t20; i < t60; i++) { b.step(TICK_MS); b.drainEvents(); }
  let alive = 0, wall = 0;
  for (const u of b.units) if (u.alive) { alive++; if (u.x <= 1 || u.x >= FIELD.W - 1) wall++; }
  const gens = [...b.generalsOf('left'), ...b.generalsOf('right')].map((g) => `${g.side === 'left' ? 'L' : 'R'}${g.x | 0}`).join(' ');
  console.log(`== 후퇴 (seed ${SEEDS[0]}, 20초 돌격 → 후퇴 40초): 살아 있는 ${alive}, 벽에 붙은 ${wall}, 무장 x ${gens}`);
  failIf(wall > 0, `후퇴 진형이 벽에 쌓임 (${wall}명)`);
}

// ─────────────────────────────────────────────────────────────
// --player: 관우 조작 30초
// ─────────────────────────────────────────────────────────────

if (flag('player')) {
  console.log(`== 플레이어 조작 (seed ${SEEDS[0]}, 30초: 아군 돌격 + 관우를 적 무장 쪽으로, 게이지 100 이면 무장기)`);
  const b = createBattle({ seed: SEEDS[0], left: ARMY_LEFT, right: ARMY_RIGHT });
  b.command('left', 'charge');   // 플레이어가 「돌격」을 눌렀다고 치고 — 대기로 두면 관우 혼자 적진에 들어가 무장 둘에게 죽는다
  const me = b.playerOf('left');
  if (!me) { console.log('  플레이어 무장 없음'); fails.push('playerOf(left) 가 null'); }
  else {
    const ticks = Math.round(30000 / TICK_MS);
    let skills = 0, skillKills = 0, skillHits = 0, myHits = 0, hitsTaken = 0;
    const log = [];
    for (let i = 0; i < ticks; i++) {
      // 적 쪽으로: 살아 있는 적 무장 중 가장 가까운 쪽. 70px 안이면 멈춰 싸운다(입력 0 = 제자리 자동 공격).
      const gens = b.generalsOf('right').filter((g) => g.alive);
      let dx = 1, dy = 0;
      if (gens.length) {
        const g = gens.reduce((a, c) => (Math.hypot(c.x - me.x, c.y - me.y) < Math.hypot(a.x - me.x, a.y - me.y) ? c : a));
        const ex = g.x - me.x, ey = g.y - me.y, d = Math.hypot(ex, ey) || 1;
        if (d < 70) { dx = 0; dy = 0; } else { dx = ex / d; dy = ey / d; }
      }
      b.setGeneralInput('left', me.id, { dx, dy });
      b.step(TICK_MS);
      for (const e of b.drainEvents()) {
        if (e.type === 'hit' && e.from === me.id) myHits++;
        if (e.type === 'hit' && e.to === me.id) hitsTaken++;
      }
      if (me.gauge >= GAUGE.max && b.useSkill('left', me.id)) {
        skills++;
        let kills = 0, hits = 0, kb = 0, sk = false;
        for (const e of b.drainEvents()) {
          if (e.type === 'skill' && e.id === me.id) sk = true;
          if (e.type === 'hit' && e.from === me.id) hits++;
          if (e.type === 'death' && e.side === 'right') kills++;
          if (e.type === 'knockback') kb++;
        }
        skillKills += kills; skillHits += hits;
        log.push(`  ${(b.time / 1000).toFixed(1)}s 청룡참 @(${me.x | 0},${me.y | 0}) facing ${me.facing}: skill 이벤트 ${sk ? 'O' : 'X'}, 적중 ${hits}, 넉백 ${kb}, 즉사 ${kills}`);
      }
      if (b.result) break;
    }
    for (const l of log) console.log(l);
    console.log(`  30초 뒤 관우 (${me.x | 0},${me.y | 0}) hp ${me.hp}/${me.maxHp} state ${me.state} gauge ${me.gauge} · 보통 공격 적중 ${myHits} · 피격 ${hitsTaken}`);
    console.log(`  무장기 ${skills}회, 적중 ${skillHits}, 즉사 ${skillKills} · 병력 L${b.countAlive('left')} R${b.countAlive('right')}${b.result ? ` · 종료 ${b.result.winner}` : ''}`);
    failIf(skills === 0, '30초 안에 무장기를 한 번도 못 씀');
    failIf(skills > 0 && skillHits === 0, '무장기가 아무도 못 맞힘');
  }
}

// ─────────────────────────────────────────────────────────────

if (fails.length) {
  console.log(`\nFAIL — ${fails.join(' · ')}`);
  process.exit(1);
}
console.log('\nPASS');
