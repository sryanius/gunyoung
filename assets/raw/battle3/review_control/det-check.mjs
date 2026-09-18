// 검수용: setPlayer 결정성 · attackers 장부 · 예외/NaN 퍼징 (조종·배속 검수자)
import { createBattle, TICK_MS } from '../../../../src/battle/sim.js';

function mul32(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function hash(b) {
  let h = 0;
  for (const u of b.units) {
    h = (h * 31 + Math.round(u.x * 1000)) | 0;
    h = (h * 31 + Math.round(u.y * 1000)) | 0;
    h = (h * 31 + Math.round(u.hp * 1000)) | 0;
    h = (h * 31 + u.state.length + (u.tgt | 0) * 7 + (u.attackers | 0) * 13 + (u.ai ? 1 : 0)) | 0;
  }
  return h;
}

function ledger(b) {
  const want = new Array(b.units.length).fill(0);
  for (const u of b.units) {
    if (u.tgt >= 0 && u.kind !== 'bow' && u.ai) want[u.tgt]++;
  }
  const bad = [];
  for (const v of b.units) {
    if (v.attackers !== want[v.id]) bad.push({ id: v.id, kind: v.kind, alive: v.alive, have: v.attackers, want: want[v.id] });
    if (v.attackers < 0) bad.push({ id: v.id, neg: v.attackers });
  }
  return bad;
}

function finite(b) {
  for (const u of b.units) if (!Number.isFinite(u.x) || !Number.isFinite(u.y) || !Number.isFinite(u.hp)) return u.id;
  return -1;
}

// 뷰처럼: 프레임마다 (입력 → step) — 배속 sp 면 step(50)을 여러 번
function run(seed, fuzzSeed, { frames = 6000, speedPattern = false } = {}) {
  const b = createBattle({ seed });
  const r = mul32(fuzzSeed);
  const gl = b.generalsOf('left').map((u) => u.id);
  const gr = b.generalsOf('right').map((u) => u.id);
  let ledgerBad = 0, firstBad = null, calls = 0, ok = 0, rejected = 0;
  const hs = [];
  for (let f = 0; f < frames; f++) {
    const x = r();
    if (x < 0.03) {
      // 무작위 setPlayer — 일부러 죽은 무장·남의 편·병사 id·null·문자열도 섞는다
      const pick = r();
      let id;
      if (pick < 0.3) id = gl[0]; else if (pick < 0.6) id = gl[1]; else if (pick < 0.75) id = null;
      else if (pick < 0.85) id = gr[0]; else if (pick < 0.92) id = 50; else if (pick < 0.96) id = 9999; else id = undefined;
      const side = r() < 0.9 ? 'left' : (r() < 0.5 ? 'right' : 'nope');
      const res = b.setPlayer(side, side === 'right' && r() < 0.7 ? (r() < 0.5 ? gr[0] : gr[1]) : id);
      calls++; if (res) ok++; else rejected++;
    }
    if (x > 0.97) b.command('left', ['charge', 'hold', 'retreat'][(r() * 3) | 0]);
    const p = b.playerOf('left');
    if (p) b.setGeneralInput('left', p.id, { dx: r() * 2 - 1, dy: r() * 2 - 1 });
    const pr = b.playerOf('right');
    if (pr) b.setGeneralInput('right', pr.id, { dx: -(r()), dy: r() * 2 - 1 });
    if (r() < 0.05) { b.useSkill('left', gl[(r() * 2) | 0]); }
    const sp = speedPattern ? 1 + ((f / 300) | 0) % 3 : 1;
    let remain = 16.667 * sp; let n = 0;
    while (remain > 0 && n < 4 * sp) { const dt = Math.min(50, remain); b.step(dt); remain -= dt; n++; }
    b.drainEvents();
    if (f % 20 === 0) {
      const bad = ledger(b);
      if (bad.length) { ledgerBad++; if (!firstBad) firstBad = { f, t: b.time, bad: bad.slice(0, 4) }; }
      const nf = finite(b); if (nf >= 0) throw new Error('NaN unit ' + nf);
    }
    if (f % 500 === 0) hs.push(hash(b));
  }
  hs.push(hash(b));
  return { hs, ledgerBad, firstBad, calls, ok, rejected, result: b.result, time: b.time, L: b.countAlive('left'), R: b.countAlive('right') };
}

let fail = 0;
for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
  for (const sp of [false, true]) {
    const a = run(seed, 1000 + seed, { speedPattern: sp });
    const c = run(seed, 1000 + seed, { speedPattern: sp });
    const same = JSON.stringify(a.hs) === JSON.stringify(c.hs) && JSON.stringify(a.result) === JSON.stringify(c.result);
    if (!same || a.ledgerBad) fail++;
    console.log(`seed ${seed} speedPattern=${sp} calls ${a.calls}(ok ${a.ok}/rej ${a.rejected}) → ${a.result ? a.result.winner + ' ' + (a.result.time / 1000).toFixed(1) + 's' : 'no result'} L${a.L} R${a.R}  결정성 ${same ? '같음' : '다름!!'}  장부 어긋남 ${a.ledgerBad}${a.firstBad ? ' first ' + JSON.stringify(a.firstBad) : ''}`);
  }
}

// 기준선: setPlayer 를 한 번도 안 부르면 HEAD 와 같은가(벤치 수치로 이미 확인) + 배속 쪼개기(step 50×3 vs 16.667×… )가 AI 전투 결과를 안 바꾸는가
function aiRun(seed, chunk) {
  const b = createBattle({ seed, aiControlled: true });
  b.command('left', 'charge'); b.command('right', 'charge');
  let t = 0;
  while (!b.result && t < 200000) { b.step(chunk); t += chunk; b.drainEvents(); }
  return `${b.result && b.result.winner} ${b.result && b.result.time.toFixed(1)} L${b.result && b.result.leftAlive} R${b.result && b.result.rightAlive}`;
}
for (const seed of [1, 2, 3]) {
  const r1 = aiRun(seed, 1000 / 60), r2 = aiRun(seed, 50), r3 = aiRun(seed, 33.3);
  const same = r1 === r2 && r2 === r3;
  if (!same) fail++;
  console.log(`AI seed ${seed}: dt16.7 [${r1}] · dt50 [${r2}] · dt33.3 [${r3}] → ${same ? '같음' : '다름!!'}`);
}
console.log(fail ? `FAIL ${fail}` : 'PASS');
process.exit(fail ? 1 : 0);
