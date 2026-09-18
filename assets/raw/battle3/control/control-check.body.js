// control-check.body.js — control-check.mjs 가 view-check.mjs 의 Phaser 흉내 뒤에 이어 붙여 돌린다(단독 실행 불가).
//   위에서 오는 것: manager · clock · frame(scene, hud, dt) · makeSceneEnv · BattleScene · BattleHud · check · section · ART · ROOT

async function bootScene(data = { seed: 1 }) {
  const scene = new BattleScene();
  makeSceneEnv(scene, manager, 'BattleScene', data, clock);
  scene.create();
  for (let i = 0; i < 50 && !scene.sim; i++) await new Promise((r) => setTimeout(r, 20));
  return scene;
}
function bootHud(data = {}) {
  const hud = new BattleHud();
  makeSceneEnv(hud, manager, 'BattleHud', data, clock);
  hud.create();
  return hud;
}
const rowOf = (hud, u) => hud.genRows.find((r) => r.unit === u);
const near = (a, b, tol) => Math.abs(a - b) <= tol;
// (3차 통합) HUD 버튼·초상 블록은 「그 위에서 눌린 손가락이 뗄 때」만 동작한다 → 탭 = pointerdown + pointerup
const tap = (o) => { o.emit('pointerdown'); o.emit('pointerup'); };
// (3차 통합) 무장기를 쓰면 컷신(실시간 ~1.45초) + 멈칫 120ms 동안 sim 이 멈춘다 → 다 지나갈 때까지 프레임을 돌린 뒤 30프레임 더
function passCut(scene, hud) {
  for (let i = 0; i < 300 && (scene.pendingSkill || clock.now < scene.hitStopUntil); i++) frame(scene, hud);
  for (let i = 0; i < 30; i++) frame(scene, hud);
}

async function run() {
  section('배속 — registry 기본값 · 인트로 중 무시');
  const scene = await bootScene();
  check(!!scene.sim && scene.canSwitch === true, 'sim 로드 + setPlayer 있음(canSwitch)');
  if (!scene.sim) return;
  const hud = bootHud();
  const sim = scene.sim;
  const [guan, zhang] = sim.generalsOf('left');
  check(scene.speed === 1 && scene.auto === false && scene.playerUnit === guan, `처음: ×${scene.speed} · 수동 · ${scene.playerUnit.name}`);
  check(scene.cycleSpeed() === true && scene.speed === 2 && manager.registry.get('battleSpeed') === 2, '인트로 중에도 값은 받아 둔다(×2) + registry 기억');
  {
    const a0 = scene.animT, t0 = sim.time, c0 = clock.now;
    for (let i = 0; i < 10; i++) frame(scene, hud);
    check(sim.time === t0, '인트로 중 sim 정지');
    check(near(scene.animT - a0, clock.now - c0, 0.01), `인트로 중 연출 시계는 ×1 (${(scene.animT - a0).toFixed(1)} / ${(clock.now - c0).toFixed(1)}ms)`);
  }
  while (clock.now < scene.introUntil) frame(scene, hud);
  frame(scene, hud);
  check(hud.speedBtn.label.text === '×2' && hud.speedBtn.held === true, `HUD 배속 글자 「${hud.speedBtn.label.text}」 + 눌린 모습`);

  section('배속 — sim 시간·연출 시계 배율 · step 호출 상한');
  const rate = (n, dt = 16.7) => {
    const t0 = sim.time, a0 = scene.animT, c0 = clock.now;
    for (let i = 0; i < n; i++) frame(scene, hud, dt);
    return { sim: (sim.time - t0) / (clock.now - c0), anim: (scene.animT - a0) / (clock.now - c0) };
  };
  let r = rate(60);
  check(near(r.sim, 2, 0.05) && near(r.anim, 2, 0.001), `×2: sim ${r.sim.toFixed(3)}배 · animT ${r.anim.toFixed(3)}배`);
  scene.input.keyboard.emit('keydown-X');
  check(scene.speed === 3, 'X 키 → ×3');
  r = rate(60);
  check(near(r.sim, 3, 0.05) && near(r.anim, 3, 0.001), `×3: sim ${r.sim.toFixed(3)}배 · animT ${r.anim.toFixed(3)}배`);
  {
    // 탭 복귀 폭주 방지: 1초짜리 프레임 한 번 → ×3 이면 50ms × 12 = 600ms 까지만
    let calls = 0; const step0 = sim.step; sim.step = (dt) => { calls++; if (dt > 50.0001) check(false, `step(${dt}) > 50ms`); return step0(dt); };
    const t0 = sim.time; frame(scene, hud, 1000);
    check(calls === 12 && near(sim.time - t0, 600, 17), `×3 · delta 1000ms → step ${calls}번 · sim +${Math.round(sim.time - t0)}ms (상한 600)`);
    scene.input.keyboard.emit('keydown-MINUS'); scene.input.keyboard.emit('keydown-MINUS'); scene.input.keyboard.emit('keydown-MINUS');
    check(scene.speed === 1, '− 키 → ×1 에서 멈춤(아래로 안 돈다)');
    calls = 0; const t1 = sim.time; frame(scene, hud, 1000);
    check(calls === 4 && near(sim.time - t1, 200, 17), `×1 · delta 1000ms → step ${calls}번 · sim +${Math.round(sim.time - t1)}ms (기존 상한 200 그대로)`);
    sim.step = step0;
  }
  tap(hud.speedBtn); tap(hud.speedBtn);
  frame(scene, hud);
  check(scene.speed === 3 && hud.speedBtn.label.text === '×3', 'HUD 배속 버튼 두 번 → ×3');
  {
    // 히트스톱은 실시간: ×3 에서도 100ms 동안 sim 이 안 흐른다
    guan.gauge = 100;
    check(scene.tryUseSkill() === true, '무장기 발동(×3)');
    frame(scene, hud);
    const t0 = sim.time;
    for (let i = 0; i < 5; i++) frame(scene, hud);
    check(sim.time === t0, '×3 에서도 히트스톱 동안(실시간 ~100ms) sim 정지');
    // (3차 통합) 히트스톱 = 컷신 길이(복귀 시각까지, 실시간) + 120ms 멈칫 — ×3 에서도 실시간 그대로여야 한다(배속을 곱하면 컷신이 1/3 로 지나간다)
    const c0 = clock.now, stopFor = scene.hitStopUntil - c0;
    check(!!scene.pendingSkill && stopFor > 300 && stopFor <= 1450, `컷신 동안 sim 정지 — 복귀까지 실시간 ${Math.round(stopFor)}ms 남음(×3)`);
    let n = 0;
    while (sim.time === t0 && n < 200) { frame(scene, hud); n++; }
    const real = clock.now - c0;
    check(sim.time > t0 && near(real, stopFor + 120, 40), `히트스톱 뒤 다시 진행 — 실시간 ${Math.round(real)}ms 뒤(컷신 ${Math.round(stopFor)} + 멈칫 120, 배속 ×3 과 무관)`);
    for (let i = 0; i < 100; i++) frame(scene, hud);   // 컷신 연달아 판정 창(1.6초)을 넘겨 둔다
  }
  scene.setSpeed(1);

  section('조종 선택 — 초상 탭');
  frame(scene, hud);
  check(rowOf(hud, guan).sel.visible && rowOf(hud, guan).tag.text === '조종' && !rowOf(hud, zhang).sel.visible, '처음: 관우 초상에 금색 테 + 「조종」');
  check(hud.genRows.filter((x) => x.zone).length === 2 && hud.genRows.filter((x) => x.unit.side === 'right').every((x) => !x.zone), '탭 영역은 아군 무장 둘만');
  check(hud.skillText.text === '청룡참', `무장기 버튼 = ${hud.skillText.text}`);
  let playerEv = null; scene.events.on('battle:player', (e) => { playerEv = e; });
  sim.setGeneralInput('left', guan.id, { dx: 1, dy: 0 });
  // (3차 통합) 다른 데서 눌린 손가락(조이스틱)을 블록·버튼 위에서 떼면 아무 일도 없어야 한다 — pointerdown 없이 pointerup 만
  rowOf(hud, zhang).zone.emit('pointerup'); rowOf(hud, guan).zone.emit('pointerup'); hud.autoBtn.emit('pointerup'); hud.skillBtn.emit('pointerup');
  check(scene.playerUnit === guan && scene.auto === false && sim.playerOf('left') === guan, '조이스틱 손가락을 초상 블록·자동 버튼 위에서 떼도 조종 대상·자동 여부 그대로');
  tap(rowOf(hud, zhang).zone);
  check(scene.playerUnit === zhang && scene.playerId === zhang.id && sim.playerOf('left') === zhang && scene.auto === false, '장비 초상 탭 → 장비 조종(수동)');
  check(guan.ai === true && guan.inX === 0 && zhang.ai === false, '관우는 AI 로, 입력 벡터 0');
  check(playerEv && playerEv.id === zhang.id && playerEv.auto === false, "battle:player 이벤트 { id: 장비, auto: false }");
  frame(scene, hud);
  check(rowOf(hud, zhang).sel.visible && rowOf(hud, zhang).tag.text === '조종' && !rowOf(hud, guan).sel.visible && !rowOf(hud, guan).tag.visible, 'HUD 강조가 장비로 옮겨 감');
  check(hud.skillText.text === '포효', `무장기 버튼 이름 → ${hud.skillText.text}`);
  if (ART) check(hud.skillIcon.visible && hud.skillIcon.texture.key === 'hud_skill_zhangfei', `무장기 아이콘 → ${hud.skillIcon.texture.key}`);
  else check(hud.skillIcon.visible === false && hud.skillText.y === 0, '아이콘 없는 경로: 글자만(가운데 30px)');
  check(scene.genViews.find((v) => v.unit === zhang).label.color === '#ffe9a8' && scene.genViews.find((v) => v.unit === guan).label.color === '#d6ffd9', '전장 이름표 금색이 장비로');
  check(scene.camTarget() === zhang, '카메라 추적 대상 = 장비');
  {
    // 조이스틱이 장비를 몬다
    const ptr = manager.pointers[1];
    Object.assign(ptr, { x: 300, y: 400, isDown: true });
    scene.input.emit('pointerdown', ptr);
    ptr.x = 380;
    const zx = zhang.x;
    for (let i = 0; i < 30; i++) frame(scene, hud);
    check(!!scene.joy && zhang.x > zx + 30, `조이스틱 → 장비 이동 ${zx.toFixed(0)} → ${zhang.x.toFixed(0)}`);
    // 무장기 게이지·발동도 장비 것
    zhang.gauge = 100;
    let meta = null; const on = (m) => { meta = m; }; scene.events.on('battle:skill', on);
    tap(hud.skillBtn);
    frame(scene, hud);   // skill 이벤트는 다음 프레임의 handleEvents 에서 battle:skill 이 된다
    check(meta && meta.name === zhang.name, `무장기 버튼 → ${meta && meta.name} 의 ${meta && meta.skill && meta.skill.name}`);
    scene.events.off('battle:skill', on);
    passCut(scene, hud);

    section('자동/수동');
    tap(rowOf(hud, zhang).zone);
    check(scene.auto === true && sim.playerOf('left') === null && scene.playerUnit === zhang, '조종 중인 초상을 다시 탭 → 자동(고른 무장은 장비 그대로)');
    check(!scene.joy && zhang.ai === true && zhang.inX === 0, '자동: 쥐고 있던 조이스틱 사라짐 · 장비 AI · 입력 0');
    check(manager.registry.get('battleAuto') === true, 'registry 에 자동 기억');
    frame(scene, hud);
    check(rowOf(hud, zhang).tag.text === '자동' && hud.autoBtn.label.text === '자동' && hud.autoBtn.held === true, `HUD: 꼬리표 「${rowOf(hud, zhang).tag.text}」 · 토글 버튼 「${hud.autoBtn.label.text}」 눌림`);
    check(scene.camTarget() === zhang, '자동 중에도 카메라는 고른 무장');
    ptr.isDown = false; scene.input.emit('pointerup', ptr);
    // 자동일 때 왼쪽 탭: 조이스틱 안 생김. 살짝(10px) 움직여도 그대로. 40px 끌면 수동 + 누른 자리에 조이스틱
    Object.assign(ptr, { x: 320, y: 420, isDown: true });
    scene.input.emit('pointerdown', ptr);
    frame(scene, hud);
    check(!scene.joy && scene.joyPending && scene.auto === true, '자동: 왼쪽을 눌러도 조이스틱 없음');
    ptr.x = 330; frame(scene, hud);
    check(!scene.joy && scene.auto === true, '10px 움직임은 무시(그냥 탭)');
    ptr.x = 360; frame(scene, hud);
    check(scene.auto === false && scene.joy && scene.joy.ox === 320 && scene.joy.oy === 420 && sim.playerOf('left') === zhang, '40px 끌면 수동 복귀 + 누른 자리에 조이스틱(마지막 고른 무장 = 장비)');
    const toasts = manager.objs.filter((o) => o.kind === 'text' && /전환/.test(String(o.text)));
    check(toasts.length === 0, '「수동으로 전환」 토스트 없음');
    const zx2 = zhang.x;
    for (let i = 0; i < 20; i++) frame(scene, hud);
    check(zhang.x > zx2 + 10, '끌던 손가락이 그대로 장비를 몬다');
    ptr.isDown = false; scene.input.emit('pointerup', ptr);
    frame(scene, hud);
    check(hud.autoBtn.label.text === '수동' && hud.autoBtn.held === false && rowOf(hud, zhang).tag.text === '조종', 'HUD: 「수동」·「조종」 으로 복귀');
    // 자동 중 탭만 하고 떼면 그대로 자동
    scene.setAuto(true);
    Object.assign(ptr, { x: 320, y: 420, isDown: true }); scene.input.emit('pointerdown', ptr); frame(scene, hud);
    ptr.isDown = false; scene.input.emit('pointerup', ptr); frame(scene, hud);
    check(scene.auto === true && !scene.joyPending && !scene.joy, '자동 중 탭만 하고 떼면 자동 유지');
  }
  tap(hud.autoBtn);
  check(scene.auto === false && sim.playerOf('left') === zhang, 'HUD 토글 버튼 → 수동');
  scene.input.keyboard.emit('keydown-Q');
  check(scene.auto === true, 'Q 키 → 자동');
  {
    // 자동 중 무장기 버튼 = 고른 무장의 무장기를 직접
    zhang.gauge = 100;
    let meta = null; const on = (m) => { meta = m; }; scene.events.on('battle:skill', on);
    tap(hud.skillBtn);
    frame(scene, hud);
    check(meta && meta.name === zhang.name && sim.playerOf('left') === null, '자동 중에도 무장기 버튼이 고른 무장(장비)의 무장기를 쓴다');
    scene.events.off('battle:skill', on);
    passCut(scene, hud);
  }
  scene.input.keyboard.emit('keydown-TAB');
  check(scene.playerUnit === guan && scene.auto === true && sim.playerOf('left') === null, 'Tab(자동 중) → 볼 무장만 관우로, 자동 유지');
  scene.keys.D.isDown = true; frame(scene, hud); scene.keys.D.isDown = false;
  check(scene.auto === false && sim.playerOf('left') === guan, '자동 중 이동 키 → 수동 복귀(관우)');
  scene.input.keyboard.emit('keydown-TAB');
  check(scene.playerUnit === zhang && scene.auto === false && sim.playerOf('left') === zhang, 'Tab(수동) → 다음 무장 장비 조종');
  check(scene.selectGeneral(sim.generalsOf('right')[0].id) === false && scene.selectGeneral(12345) === false && scene.playerUnit === zhang, '적 무장·없는 id 는 못 고른다');

  section('부대 따라가기는 수동에서만');
  {
    scene.command('charge');
    scene.setAuto(true);
    let calls = 0; const sgi = sim.setGeneralInput; sim.setGeneralInput = (...a) => { calls++; return sgi(...a); };
    clock.now += 2000;
    for (let i = 0; i < 10; i++) frame(scene, hud);
    check(calls === 0, '자동: setGeneralInput 을 안 부른다(따라가기도 없음)');
    scene.setAuto(false);
    for (let i = 0; i < 5; i++) frame(scene, hud);
    check(calls === 5, '수동: 매 프레임 setGeneralInput');
    sim.setGeneralInput = sgi;
  }

  section('relayout — HUD restart 뒤에도 조종 대상·자동·배속 유지');
  scene.selectGeneral(zhang.id); if (!scene.auto) scene.setAuto(true);
  scene.setSpeed(3);
  frame(scene, hud);
  manager.W = 2400; scene.scale.width = 2400; scene.applyBounds();
  hud.events.emit('shutdown');
  const hud2 = bootHud({ relayout: true });
  frame(scene, hud2);
  check(scene.playerUnit === zhang && scene.auto === true && scene.speed === 3, 'BattleScene 상태 그대로(장비 · 자동 · ×3)');
  check(rowOf(hud2, zhang).sel.visible && rowOf(hud2, zhang).tag.text === '자동' && !rowOf(hud2, guan).sel.visible, '새 HUD: 장비 초상 강조 + 「자동」');
  check(hud2.autoBtn.label.text === '자동' && hud2.autoBtn.held === true && hud2.speedBtn.label.text === '×3', `새 HUD: 토글 「${hud2.autoBtn.label.text}」 · 배속 「${hud2.speedBtn.label.text}」`);
  check(hud2.skillText.text === '포효', `새 HUD: 무장기 버튼 = ${hud2.skillText.text}`);
  check(near(hud2.speedBtn.x, 2400 / 2 + 120, 0.01) && hud2.autoBtn.x < hud2.tacticBtns[0].x && hud2.autoBtn.x > 2400 / 2, `새 폭 2400 에서 배속 x ${hud2.speedBtn.x} · 자동 버튼 x ${hud2.autoBtn.x} (병법 줄 왼쪽, 오른쪽 반 안)`);
  r = rate(30);
  check(near(r.sim, 3, 0.1), `restart 뒤에도 ×3 으로 돈다(${r.sim.toFixed(2)}배)`);

  section('고른 무장 사망 → 다음 무장 / 없으면 자동');
  scene.setSpeed(1);
  scene.setAuto(false);
  manager.registry.set('battleAuto', false);
  check(sim.playerOf('left') === zhang, '수동 · 장비 조종 중');
  // sim 안쪽 kill 은 못 부른다 → 상태만 죽은 것으로 바꿔 view 의 전환을 본다
  zhang.hp = 0; zhang.alive = false; zhang.state = 'dead';
  frame(scene, hud2);
  check(scene.playerUnit === guan && scene.auto === false && sim.playerOf('left') === guan, '장비 사망 → 관우로 자동 전환(수동 유지, sim 조종 무장도 관우)');
  frame(scene, hud2);
  check(rowOf(hud2, guan).sel.visible && rowOf(hud2, guan).tag.text === '조종' && hud2.skillText.text === '청룡참', 'HUD 강조·무장기 버튼도 관우로');
  check(scene.selectGeneral(zhang.id) === false && scene.playerUnit === guan, '죽은 무장 초상 탭은 무시');
  check(scene.cycleGeneral() === false, '살아 있는 무장이 하나면 Tab 은 아무 일도 안 한다');
  guan.hp = 0; guan.alive = false; guan.state = 'dead';
  frame(scene, hud2);
  check(scene.auto === true && sim.playerOf('left') === null, '아군 무장 전멸 → 자동');
  check(manager.registry.get('battleAuto') === false, '강제로 자동이 된 것은 registry 에 안 남긴다');

  section('다음 전투 — registry 에서 배속·자동 이어받기');
  manager.registry.set('battleSpeed', 2);
  manager.registry.set('battleAuto', true);
  const scene2 = await bootScene({ seed: 2 });
  check(scene2.speed === 2 && scene2.auto === true && scene2.sim.playerOf('left') === null && scene2.playerUnit && scene2.playerUnit.name === '관우', `새 전투: ×${scene2.speed} · 자동 · 볼 무장 ${scene2.playerUnit && scene2.playerUnit.name}`);
  {
    // 자동 + ×3 으로 한 판을 끝까지 — 예외 없이 끝나는지, 60fps 프레임 수가 sim 시간의 1/3 쯤인지, fx 풀이 ×3 의 이벤트 밀도를 견디는지
    const hud3 = bootHud();
    const SP = [1, 2, 3].includes(Number(process.env.CC_SPEED)) ? Number(process.env.CC_SPEED) : 3;   // CC_SPEED=1 로 ×1 기준값과 견준다
    scene2.setSpeed(SP);
    scene2.command('charge');
    let spawnTry = 0, spawnFail = 0;
    const spawn0 = scene2.fx.spawn.bind(scene2.fx);
    scene2.fx.spawn = (...a) => { const o = spawn0(...a); spawnTry++; if (!o && manager.textures.has(a[0])) spawnFail++; return o; };
    while (clock.now < scene2.introUntil) frame(scene2, hud3);
    let frames = 0;
    const c0 = clock.now;
    while (!scene2.ended && frames < 14000) { frame(scene2, hud3); frames++; }
    const real = (clock.now - c0) / 1000, simS = scene2.sim.time / 1000;
    check(scene2.ended && scene2.result, `자동 ×${SP} 한 판 종료: ${scene2.result && scene2.result.winner} — sim ${simS.toFixed(1)}초를 실시간 ${real.toFixed(1)}초에(무장기 히트스톱 포함)`);
    check(simS / real > SP * 0.87 && simS / real <= SP + 0.001, `체감 배속 ${(simS / real).toFixed(2)}배`);
    if (ART) check(spawnFail / Math.max(1, spawnTry) < 0.15, `×${SP} 에서 fx 풀이 비어 건너뛴 이펙트 ${spawnFail}/${spawnTry} (${(100 * spawnFail / Math.max(1, spawnTry)).toFixed(1)}%)`);
    for (let i = 0; i < 80; i++) frame(scene2, hud3, 50);
    check(hud3.resultOpen, '결과 패널 열림');
    hud3.events.emit('shutdown');
  }
  manager.registry.set('battleSpeed', 7);
  manager.registry.set('battleAuto', false);
  const scene3 = await bootScene({ seed: 3 });
  check(scene3.speed === 1 && scene3.auto === false && scene3.sim.playerOf('left') === scene3.playerUnit, 'registry 값이 이상하면(7) ×1 · 수동');

  section('setPlayer 없는 sim(더미) — 버튼이 아무 일도 안 한다');
  scene3.canSwitch = false;
  check(scene3.toggleAuto() === false && scene3.selectGeneral(scene3.sim.generalsOf('left')[1].id) === false && scene3.cycleGeneral() === false
    && scene3.auto === false, 'canSwitch=false → 선택·자동 거절, 상태 그대로');
  check(scene3.cycleSpeed() === true && scene3.speed === 2, '배속은 sim 과 무관하게 된다');

  console.log(`\n${fails === 0 ? 'PASS' : 'FAIL'} — ${passes} ok, ${fails} fail`);
  process.exitCode = fails === 0 ? 0 : 1;
}

await run().catch((e) => { console.error('예외:', e); process.exitCode = 1; });
