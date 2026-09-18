#!/usr/bin/env node
// integ_patch.cjs — (3차 컷신) 통합 담당용. ※ 2026-09-19 통합에서 --write 로 적용 끝(그 뒤 BattleScene·view-check 를 더 손봤다 — docs/HANDOFF.md §9.9). 다시 돌리면 전부 「이미 있음」.
// BattleScene.js·BattleHud.js·view-check.mjs 에 컷신 연결을 넣는다.
//   cutscene 갈래는 이 세 파일 중 BattleScene·BattleHud 를 못 건드린다(BATTLE_V3.md §4) → 넣을 조각을 「문자열 치환」으로 적어 두고,
//   기본은 시험 사본(assets/raw/battle3/cutscene/_try/)에만 적용해 헤드리스로 돌려 본다.
//
//   node assets/raw/battle3/cutscene/integ_patch.cjs            시험: _try/ 에 사본을 만들고 view-check 사본을 돌린다(원본 무수정)
//   node assets/raw/battle3/cutscene/integ_patch.cjs --art      〃 (2차 그림·눈 띠가 다 있는 경로)
//   node assets/raw/battle3/cutscene/integ_patch.cjs --write    진짜 파일에 적용(통합 담당만). 이미 들어가 있으면 건너뛴다
//   (시험 전용) --skip-fix    ⑦⑧ 을 빼고 시험 — 새 검사 「컷신 중 죽음·종료 0」 이 FAIL 로 잡아내는지 보는 용도
//   (시험 전용) --force-end   전투 루프의 첫 컷신에 sim.result 를 세워 「무장기로 전투가 끝나는 장면」을 흉내 — 종료 연출이 복귀 뒤에 시작되는지만 본다
//
// 넣는 것
//   BattleScene: ① import cutinPlan ② heldEvents·pendingSkill 필드 ③ handleEvents 가 묵힌 이벤트를 먼저 + 'skill' 뒤 이벤트를 묵힌다
//                ④ onSkill = 컷신 시작(히트스톱 = plan.impact, 줌 펀치 = plan.fire) / skillImpact = 피해 연출(전에 onSkill 이 하던 것)
//                ⑤ update 머리에서 복귀 시각이 되면 skillImpact + 묵힌 이벤트 + 120ms 멈칫 ⑥ 컷신 중 tryUseSkill 막기
//                ⑦ (검수 수정·must) 컷신 중엔 죽음 연출을 미룬다 — syncSprites 는 state='dead' 를 보고 히트스톱 중에도 startDeath 를 돌렸다
//                ⑧ (검수 수정) 컷신 중엔 종료 연출(onEnd)을 미룬다 — 무장기로 전투가 끝나면 결과 패널이 컷신 아래에서 먼저 열렸다
//   BattleHud:   cutin() 에 side·mode 를 넘긴다
//   view-check:  히트스톱 검사를 컷신 길이 기준으로 + 「컷신 중엔 죽은 병사가 서 있다」 + 전투 루프 전체에서 「컷신 중 새 죽음·종료 연출 0」
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');

const ROOT = path.normalize(path.join(__dirname, '..', '..', '..', '..'));
const WRITE = process.argv.includes('--write');
const TRY = path.join(__dirname, '_try');

function patch(src, name, pairs) {
  let s = src;
  for (const [a, b, tag, marker] of pairs) {
    if (marker && s.includes(marker)) { console.log(`  = ${name}: 이미 있음 — ${tag}`); continue; }   // marker = 넣은 뒤에만 있는 문자열
    if (!s.includes(a)) throw new Error(`${name}: 치환할 자리를 못 찾음 — ${tag}\n--- 찾는 문자열 ---\n${a}`);
    s = s.replace(a, () => b);
    console.log(`  + ${name}: ${tag}`);
  }
  return s;
}

// ───────────────────────── BattleScene.js ─────────────────────────
const SCENE = [
  [`import { Fx } from './fx.js';`,
   `import { Fx } from './fx.js';
import { cutinPlan } from './cutin.js';   // (3차 컷신) 컷신이 뜨기 전에 길이를 안다 — 히트스톱·줌 펀치·피해 연출 시각`, '① import', "import { cutinPlan } from './cutin.js'"],

  [`    this.hitStopUntil = 0;`,
   `    this.hitStopUntil = 0;
    this.heldEvents = null;      // (3차 컷신) 컷신 동안 묵혀 둔 sim 이벤트 — 무장기와 같은 틱에 나온 hit·death·knockback 은 복귀 순간에 터진다
    this.pendingSkill = null;    // (3차 컷신) 복귀 시각에 터뜨릴 피해 연출 { e, sk, facing, at }`, '② 필드', 'this.heldEvents = null;      //'],

  [`    const evs = this.sim.drainEvents();
    if (!evs || !evs.length) return;`,
   `    // (3차 컷신) 묵혀 둔 것을 먼저, 그 뒤에 새 이벤트
    const fresh = this.sim.drainEvents();
    const evs = this.heldEvents ? this.heldEvents.concat(fresh || []) : fresh;
    this.heldEvents = null;
    if (!evs || !evs.length) return;`, '③ handleEvents 머리', 'const fresh = this.sim.drainEvents();'],

  [`        case 'skill':
          this.onSkill(e, time);
          break;`,
   `        case 'skill':
          // (3차 컷신) 컷신이 뜨면 true — 뒤 이벤트(같은 틱의 hit·death·knockback, 또 다른 skill)는 복귀 때까지 묵힌다
          if (this.onSkill(e, time)) { this.heldEvents = evs.slice(i + 1); return; }
          break;`, "③ case 'skill'", 'if (this.onSkill(e, time)) {'],

  [`    const facing = e.facing < 0 ? -1 : 1;
    const cam = this.cameras.main;
    cam.shake(350, 0.012);
    cam.flash(120, 255, 255, 255);
    this.hitStopUntil = time + HITSTOP_MS;
    this.punchAt = time;
    let drawn = false;`,
   `    const facing = e.facing < 0 ? -1 : 1;
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
    let drawn = false;`, '④ onSkill → onSkill + skillImpact', 'skillImpact(p, time) {'],

  [`    this.fx.sparks(e.x, e.y - 30, 18);
    if (e.side === 'left' || e.side === 'right') this.skillUsed[e.side]++;
    sfx('skill');
    this.events.emit('battle:skill', meta || { id: e.id, side: e.side, name: '', key: null, skill: sk, color: 0xffd24a });
  }`,
   `    this.fx.sparks(e.x, e.y - 30, 18);
    sfx('hit');
  }`, '④ skillImpact 꼬리', "this.fx.sparks(e.x, e.y - 30, 18);\n    sfx('hit');"],

  [`    const stopped = time < this.hitStopUntil;
    // (3차) 배속`,
   `    // (3차 컷신) 복귀 시각: 피해 연출 + 묵힌 이벤트(넉백 회전·피격 플래시·사망)를 한 프레임에 터뜨리고, 2차와 같은 120ms 멈칫.
    //   묵힌 것 안에 또 skill 이 있으면 onSkill 이 새 컷신(짧은 버전)을 걸고 hitStopUntil 을 다시 잡는다 → 그때는 멈칫을 덮지 않는다
    if (this.pendingSkill && time >= this.pendingSkill.at) {
      const p = this.pendingSkill;
      this.pendingSkill = null;
      this.skillImpact(p, time);
      this.handleEvents(time);
      if (!this.pendingSkill) this.hitStopUntil = time + HITSTOP_MS;
    }
    const stopped = time < this.hitStopUntil;
    // (3차) 배속`, '⑤ update 머리', 'if (this.pendingSkill && time >= this.pendingSkill.at) {'],

  [`    if (p.state === 'dead' || p.state === 'gone') return false;
    const ok = !!this.sim.useSkill('left', this.playerId);`,
   `    if (p.state === 'dead' || p.state === 'gone') return false;
    if (this.pendingSkill) return false;   // (3차 컷신) 컷신 중엔 무장기를 또 못 건다 — sim 은 멈춰 있는데 피해만 먼저 들어가면 화면과 어긋난다
    const ok = !!this.sim.useSkill('left', this.playerId);`, '⑥ 컷신 중 tryUseSkill 막기', 'if (this.pendingSkill'],   // (통합) 적용 뒤 통합 담당이 이 줄을 「멈칫 중에도 막고 적어 둔다」로 넓혔다 — marker 는 앞머리만 본다

  // (검수 수정 — must) sim.useSkill 은 광역 피해를 발동 틱에 바로 적용해 state='dead' 를 만든다. syncSprites 는 이벤트가 아니라 state 를 보고
  //   히트스톱 중에도 매 프레임 돌기 때문에, 이 줄이 없으면 죽음 연출(쓰러짐·페이드 1.2초)이 컷신 「시작」 순간에 돌아 컷신(1.45초) 안에 끝나 버린다
  //   → 복귀하면 청룡참 파동이 빈 땅 위를 지나간다(검수 실측: 컷신 4번에 18개, 한 번에 최대 10개). 'dead' 는 아래 자세 분기 어디에도 안 걸려
  //   stand 그림·그림자 그대로 서 있고, ⑤ 가 pendingSkill 을 비우는 복귀 프레임의 syncSprites 에서 쓰러진다(같은 프레임에 묵힌 death 이벤트의 먼지·핏자국도).
  [`      if (u.state === 'dead') { this.startDeath(s, u); continue; }`,
   `      if (u.state === 'dead' && !this.pendingSkill) { this.startDeath(s, u); continue; }   // (3차 컷신) 컷신 중엔 아직 서 있다 — 복귀 프레임에 쓰러진다(피해는 컷신이 끝나는 순간 터지는 것처럼)`,
   '⑦ 컷신 중엔 죽음 연출을 미룬다', `u.state === 'dead' && !this.pendingSkill`],

  // (검수 수정 — should) 무장기로 전투가 끝나면(마지막 적 무장을 무장기로 잡는 흔한 장면) 이 줄이 handleEvents 가 조기 return 한 「같은 프레임」에 돌아
  //   승리 효과음·freezeAt(+1.5초)·900ms 뒤 결과 패널이 컷신 도중(깊이 900 아래)에 시작됐다. 묵힌 'end' 이벤트는 복귀 프레임의 handleEvents 가 onEnd 로 처리하고,
  //   이벤트 없이 result 만 선 경우는 복귀 뒤 120ms 멈칫이 풀린 프레임에 이 줄이 다시 본다.
  [`        if (!this.ended && this.sim.result) this.onEnd(null);`,
   `        if (!this.ended && this.sim.result && !this.pendingSkill) this.onEnd(null);   // (3차 컷신) 종료 연출은 컷신 복귀 뒤에`,
   '⑧ 컷신 중엔 종료 연출을 미룬다', 'this.sim.result && !this.pendingSkill'],
];

// ───────────────────────── BattleHud.js ─────────────────────────
const HUD = [
  [`      color: meta.side === 'right' ? 0x9cc0ff : 0xffd24a,
    });`,
   `      color: meta.side === 'right' ? 0x9cc0ff : 0xffd24a,
      side: meta.side,                  // (3차 컷신) 적 편은 좌우 반전
    });`, 'cutin() 에 side', 'side: meta.side,'],   // control 갈래가 이미 넣었다(2026-09-19) — 그러면 건너뛴다
];
/** BattleHud 의 cutin() 호출에 mode 줄 — side 줄(누가 넣었든) 바로 뒤에 */
function hudMode(s) {
  if (s.includes('mode: meta.cutinMode')) { console.log('  = src/battle/BattleHud.js: 이미 있음 — cutin() 에 mode'); return s; }
  const m = /^( *)side: meta\.side,.*$/m.exec(s);
  if (!m) throw new Error('BattleHud.js: side: meta.side 줄을 못 찾음');
  console.log('  + src/battle/BattleHud.js: cutin() 에 mode');
  return s.replace(m[0], () => `${m[0]}\n${m[1]}mode: meta.cutinMode || null,   // (3차 컷신) BattleScene 이 cutinPlan 으로 정한 모양 그대로 — 히트스톱 길이와 어긋나지 않게`);
}

// ───────────────────────── view-check.mjs ─────────────────────────
const CHECK = [
  [`  check(scene.cameras.main.calls.slice(camCalls0).some((c) => c[0] === 'shake' && c[1] === 350) && scene.cameras.main.calls.some((c) => c[0] === 'flash'), '카메라 shake 0.35초 + flash');
  // 히트스톱 120ms: sim.time 이 멈췄다 다시 흐른다 / 줌 펀치: 1.25 근처까지 갔다 1.15 로 복귀
  {
    const tStop = scene.sim.time;
    let zMax = scene.cameras.main.zoom;
    for (let i = 0; i < 6; i++) { frame(scene, hud); zMax = Math.max(zMax, scene.cameras.main.zoom); }   // 100ms
    check(scene.sim.time === tStop, \`히트스톱: 100ms 동안 sim.time 그대로(\${Math.round(tStop)})\`);
    for (let i = 0; i < 12; i++) { frame(scene, hud); zMax = Math.max(zMax, scene.cameras.main.zoom); }
    check(scene.sim.time > tStop, '히트스톱 뒤 sim 진행');`,
   `  // (3차 컷신) 히트스톱 = 컷신의 복귀 시각까지(눈 띠 있으면 1450ms, 없으면 1200ms) + 120ms 멈칫. 피해 연출(shake·flash·넉백 회전)은 복귀 순간에.
  {
    const tStop = scene.sim.time, t0 = clock.now;
    const h = hud.__cutin;
    const impact = h ? h.impactAt : 0;
    let zMax = scene.cameras.main.zoom;
    check(h && h.active && scene.pendingSkill && Math.abs(scene.hitStopUntil - (scene.pendingSkill.at)) < 1e-6 && impact === (manager.textures.has('cutin_guanyu_eyes') ? 1450 : 1200),
      \`컷신이 뜨고 히트스톱이 복귀 시각까지 (\${impact}ms)\`);
    check(!scene.cameras.main.calls.slice(camCalls0).some((c) => c[0] === 'shake'), '발동 순간엔 shake·flash 없음(복귀 때 터진다)');
    check(scene.tryUseSkill() === false, '컷신 중엔 무장기를 또 못 건다');
    while (clock.now + 16.7 < t0 + impact - 60) { frame(scene, hud); zMax = Math.max(zMax, scene.cameras.main.zoom); }
    // 이 첫 무장기는 적이 멀어 맞는 유닛이 없다 → 묵힌 목록에 넉백 하나를 직접 넣어 「복귀 순간에 터진다」를 본다
    const victim = scene.sim.units.find((u) => u.side === 'right' && u.kind !== 'general');
    check(scene.sim.time === tStop && Array.isArray(scene.heldEvents), \`컷신 동안 sim.time 그대로(\${Math.round(tStop)}) · 뒤 이벤트는 묵힌다(\${scene.heldEvents && scene.heldEvents.length}개)\`);
    scene.heldEvents.push({ type: 'knockback', id: victim.id, dx: 60, dy: 0, ms: 250 });
    // (검수 수정) sim 은 무장기 피해를 발동 틱에 바로 적용한다(state='dead') → 그 상태를 두 프레임만 흉내 내 「컷신 중엔 아직 서 있다」를 본다(sim 은 멈춰 있어 되돌리면 흔적이 없다)
    const vSprite = scene.spriteById.get(victim.id), vState = victim.state;
    victim.state = 'dead';
    for (let i = 0; i < 2; i++) { frame(scene, hud); zMax = Math.max(zMax, scene.cameras.main.zoom); }
    check(vSprite.dying === false && scene.spriteById.get(victim.id) === vSprite, '컷신 중엔 무장기로 죽은 병사가 아직 서 있다(죽음 연출은 복귀 프레임에)');
    victim.state = vState;
    check(!scene.spriteById.get(victim.id).kb, '묵힌 넉백은 컷신 중엔 안 터진다');
    for (let i = 0; i < 3; i++) { frame(scene, hud); zMax = Math.max(zMax, scene.cameras.main.zoom); }
    check(scene.cameras.main.calls.slice(camCalls0).some((c) => c[0] === 'shake' && c[1] === 350) && scene.cameras.main.calls.slice(camCalls0).some((c) => c[0] === 'flash') && !scene.pendingSkill && !scene.heldEvents,
      '복귀 순간: 카메라 shake 0.35초 + flash + 묵힌 이벤트 처리');
    check(!!scene.spriteById.get(victim.id).kb, '복귀 순간 묵힌 넉백 회전이 걸린다');
    check(scene.sim.time === tStop, '복귀 직후 120ms 멈칫(sim.time 그대로)');
    for (let i = 0; i < 12; i++) { frame(scene, hud); zMax = Math.max(zMax, scene.cameras.main.zoom); }
    check(scene.sim.time > tStop, '히트스톱 뒤 sim 진행');`, '히트스톱 검사를 컷신 기준으로', '발동 순간엔 shake·flash 없음'],

  [`  check(cutinObjs.length === 3 && cutinObjs[0].height === 1216 && cutinObjs.every((o) => o.mask), \`컷신 주 일러스트 3겹 생성(cutin_guanyu) + 패널 마스크 — \${cutinObjs.length}개\`);
  {
    const h = hud.__cutin;
    const want = manager.textures.has('cutin_guanyu_eyes') ? 1600 : 1350;
    check(h && h.active && h.duration === want && h.impactAt === want - 150, \`HUD 컷신 진행 중: \${h && h.mode} \${h && h.duration}ms (눈 띠 \${want === 1600 ? '있음' : '없음 → 첫 박자 건너뜀'})\`);
    for (let i = 0; i < 120 && hud.__cutin; i++) frame(scene, hud);
    check(!hud.__cutin && h && !h.active && cutinObjs.every((o) => o.destroyed), '컷신이 끝나면 스스로 전부 destroy');
  }`,
   `  check(cutinObjs.length === 3 && cutinObjs[0].height === 1216 && cutinObjs.every((o) => o.mask), \`컷신 주 일러스트 3겹 생성(cutin_guanyu) + 패널 마스크 — \${cutinObjs.length}개\`);
  check(!hud.__cutin && cutinObjs.every((o) => o.destroyed), '컷신이 끝나면 스스로 전부 destroy');`, '본 흐름 컷신 검사(이미 끝난 뒤)', 'check(!hud.__cutin && cutinObjs.every('],

  // (검수 수정) 전투 전체를 도는 동안: 컷신(pendingSkill) 중에 새로 쓰러지기 시작한 스프라이트·종료 연출이 하나도 없어야 한다.
  //   ⑦⑧ 이 빠지면 여기서 잡힌다(검수 실측: ⑦ 없이 18~23개). 전엔 조각을 넣은 view-check 가 이 상태로도 통과했다.
  [`  while (!scene.ended && frames < 12000) {
    frame(scene, hud, 16.7); frames++;`,
   `  let cutCount = 0, cutLast = null, dyingInCut = 0, endedInCut = 0;   // (3차 컷신) 컷신 중 죽음·종료 연출 감시
  while (!scene.ended && frames < 12000) {
    frame(scene, hud, 16.7); frames++;
    {
      const inCut = !!scene.pendingSkill;
      if (inCut && cutLast !== scene.pendingSkill) { cutLast = scene.pendingSkill; cutCount++; }
      for (const sp of scene.spriteById.values()) {
        if (inCut && sp.dying && !sp.__dyingSeen) dyingInCut++;
        sp.__dyingSeen = !!sp.dying;
      }
      if (inCut && scene.ended) endedInCut++;
    }`, '전투 루프에 컷신 중 죽음·종료 감시', 'let cutCount = 0, cutLast = null'],

  [`  check(sawKb, '넉백 회전(kb) 이 걸린 스프라이트가 있었다');`,
   `  check(sawKb, '넉백 회전(kb) 이 걸린 스프라이트가 있었다');
  check(cutCount > 0 && dyingInCut === 0 && endedInCut === 0, \`(3차 컷신) 컷신 \${cutCount}번 동안 새로 시작된 죽음 연출 \${dyingInCut}개 · 종료 연출 \${endedInCut}번 — 피해·종료는 복귀 뒤에만 보인다\`);`,
   '컷신 중 죽음·종료 0 검사', 'dyingInCut === 0 && endedInCut === 0'],
];

const FILES = [
  ['src/battle/BattleScene.js', SCENE],
  ['src/battle/BattleHud.js', HUD],
  ['assets/raw/battle/view-check.mjs', CHECK],
];

if (WRITE) {
  for (const [rel, pairs] of FILES) {
    const p = path.join(ROOT, rel);
    let out = patch(fs.readFileSync(p, 'utf8'), rel, pairs);
    if (rel.endsWith('BattleHud.js')) out = hudMode(out);
    fs.writeFileSync(p, out);
  }
  console.log('적용 끝 — node assets/raw/battle/view-check.mjs [--art] 로 확인');
  process.exit(0);
}

// 시험: _try/ 에 사본 — 상대 import 를 절대 URL 로 바꿔 원본 모듈(sim·data·fx·cutin·sfx)을 그대로 쓴다
fs.mkdirSync(TRY, { recursive: true });
const url = (rel) => pathToFileURL(path.join(ROOT, rel)).href;
const SKIP_FIX = process.argv.includes('--skip-fix');     // ⑦⑧ 없이 — 새 검사가 FAIL 로 잡는지
const FORCE_END = process.argv.includes('--force-end');   // 무장기로 전투가 끝나는 장면 흉내
const scenePairs = SKIP_FIX ? SCENE.filter((p) => !/^[⑦⑧]/.test(p[2])) : SCENE;
let scene = patch(fs.readFileSync(path.join(ROOT, FILES[0][0]), 'utf8'), FILES[0][0], scenePairs)
  .replace(`'../sfx.js'`, `'${url('src/sfx.js')}'`).replace(`'./fx.js'`, `'${url('src/battle/fx.js')}'`).replace(`'./cutin.js'`, `'${url('src/battle/cutin.js')}'`)
  .replace(`import('./data.js')`, `import('${url('src/battle/data.js')}')`).replace(`import('./sim.js')`, `import('${url('src/battle/sim.js')}')`)
  .replace(`import('../../assets/raw/battle/sim-stub.mjs')`, `import('${url('assets/raw/battle/sim-stub.mjs')}')`);
fs.writeFileSync(path.join(TRY, 'BattleScene.mjs'), scene);
let hud = hudMode(patch(fs.readFileSync(path.join(ROOT, FILES[1][0]), 'utf8'), FILES[1][0], HUD))
  .replace(`'../sfx.js'`, `'${url('src/sfx.js')}'`).replace(`'./fx.js'`, `'${url('src/battle/fx.js')}'`).replace(`'./BattleScene.js'`, `'./BattleScene.mjs'`);
fs.writeFileSync(path.join(TRY, 'BattleHud.mjs'), hud);
let vc = patch(fs.readFileSync(path.join(ROOT, FILES[2][0]), 'utf8'), FILES[2][0], CHECK)
  .replace(`const ROOT = normalize(join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..'));`, `const ROOT = ${JSON.stringify(ROOT)};`)
  .replace(`await import(pathToFileURL(join(ROOT, 'src/battle/BattleScene.js')).href)`, `await import(new URL('./BattleScene.mjs', import.meta.url).href)`)
  .replace(`await import(pathToFileURL(join(ROOT, 'src/battle/BattleHud.js')).href)`, `await import(new URL('./BattleHud.mjs', import.meta.url).href)`);
if (FORCE_END) {
  // (시험 전용) 전투 루프의 첫 컷신이 걸리는 순간 sim.result 를 세운다 = 「그 무장기로 전투가 끝났다」. update() 의 onEnd 줄이 같은 프레임에 본다.
  //   ⑧ 이 있으면 scene.ended 는 복귀 시각 뒤에야 true 가 된다. 없으면(--skip-fix) 발동 프레임에 바로 true.
  const hookAt = `  let cutCount = 0, cutLast = null, dyingInCut = 0, endedInCut = 0;`;
  if (!vc.includes(hookAt)) throw new Error('--force-end: 전투 루프 감시 줄을 못 찾음');
  vc = vc.replace(hookAt, () => `  let forceEnd = null;
  {
    const os = scene.onSkill.bind(scene);
    scene.onSkill = (e, t) => {
      const r = os(e, t);
      if (r && !forceEnd) {
        forceEnd = { skillAt: clock.now, impactAt: scene.pendingSkill.at };
        scene.sim.result = { winner: 'left', reason: '시험', leftAlive: scene.sim.countAlive('left'), rightAlive: 0, time: scene.sim.time };
      }
      return r;
    };
  }
${hookAt}`);
  const tail = `  check(sawKb, '넉백 회전(kb) 이 걸린 스프라이트가 있었다');`;
  vc = vc.replace(tail, () => `  {
    const dt = forceEnd ? clock.now - forceEnd.skillAt : -1, imp = forceEnd ? forceEnd.impactAt - forceEnd.skillAt : -1;
    const ok = !!forceEnd && scene.ended && dt >= imp && endedInCut === 0;
    console.log(\`FORCE-END \${ok ? 'ok' : 'FAIL'} — 무장기 발동 +\${Math.round(dt)}ms 에 종료 연출 시작(복귀 +\${Math.round(imp)}ms), 컷신 중 종료 \${endedInCut}번\`);
    process.exit(ok ? 0 : 1);
  }
${tail}`);
}
fs.writeFileSync(path.join(TRY, 'view-check.mjs'), vc);
const args = process.argv.slice(2).filter((a) => a !== '--write' && a !== '--skip-fix' && a !== '--force-end');
const r = spawnSync(process.execPath, [path.join(TRY, 'view-check.mjs'), ...args], { encoding: 'utf8' });
const out = (r.stdout || '') + (r.stderr || '');
console.log(out.split('\n').filter((l) => !/^  ok /.test(l) || /컷신|복귀|히트스톱|묵힌|넉백/.test(l)).join('\n'));
process.exit(r.status);
