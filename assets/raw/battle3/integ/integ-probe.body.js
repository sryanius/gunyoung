// integ-probe.body.js — (3차 통합) 컷신 + 배속 + 자동을 seed 여러 개로 끝까지 돌려 본다. integ-probe.mjs 가 view-check 의 Phaser 흉내 뒤에 붙여 돌린다.
async function bootScene(data) {
  const scene = new BattleScene();
  makeSceneEnv(scene, manager, 'BattleScene', data, clock);
  scene.create();
  for (let i = 0; i < 50 && !scene.sim; i++) await new Promise((r) => setTimeout(r, 20));
  return scene;
}
async function run() {
  for (const [seed, speed, auto] of [[1, 1, false], [2, 3, true], [3, 3, true], [4, 2, true], [5, 3, false]]) {
    section(`seed ${seed} · ×${speed} · ${auto ? '자동' : '수동(입력 없음 — 무장기는 게이지 차면 버튼)'}`);
    manager.registry.set('battleSpeed', speed); manager.registry.set('battleAuto', auto); manager.registry.set('cutinBusyUntil', 0);
    const scene = await bootScene({ seed });
    const hud = new BattleHud(); makeSceneEnv(hud, manager, 'BattleHud', {}, clock); hud.create();
    for (let i = 0; i < 80; i++) frame(scene, hud);
    scene.command('charge');
    let frames = 0, cuts = 0, shortCuts = 0, last = null, dyingInCut = 0, endedInCut = 0, stuck = 0, maxCutMs = 0, cutStart = 0, modes = {};
    const t0 = clock.now;
    while (!scene.ended && frames < 20000) {
      if (!auto && scene.playerUnit && scene.playerUnit.gauge >= 100 && frames % 7 === 0) scene.tryUseSkill();   // 컷신·멈칫 중에도 마구 누른다
      frame(scene, hud, 16.7); frames++;
      const inCut = !!scene.pendingSkill, first = inCut && last !== scene.pendingSkill;
      if (first) { last = scene.pendingSkill; cuts++; cutStart = clock.now; const m = hud.__cutin && hud.__cutin.mode; modes[m] = (modes[m] || 0) + 1; }
      if (inCut) maxCutMs = Math.max(maxCutMs, clock.now - cutStart);
      for (const sp of scene.spriteById.values()) { if (inCut && !first && sp.dying && !sp.__seen) dyingInCut++; sp.__seen = !!sp.dying; }
      if (inCut && scene.ended) endedInCut++;
      if (scene.pendingSkill && clock.now > scene.pendingSkill.at + 50) stuck++;
    }
    const real = clock.now - t0;
    for (let i = 0; i < 60; i++) frame(scene, hud, 50);
    check(scene.ended && hud.resultOpen && !scene.pendingSkill && !scene.heldEvents, `종료 ${scene.result && scene.result.winner} sim ${Math.round(scene.sim.time / 1000)}s · 실시간 ${Math.round(real / 1000)}s · 컷신 ${cuts}번 ${JSON.stringify(modes)}`);
    check(cuts > 0 && dyingInCut === 0 && endedInCut === 0 && stuck === 0 && maxCutMs <= 1460, `컷신 중 새 죽음 ${dyingInCut} · 종료 ${endedInCut} · 복귀 놓침 ${stuck} · 가장 긴 컷신 ${Math.round(maxCutMs)}ms`);
    check(scene.sim.skillCount.left + scene.sim.skillCount.right >= cuts, `sim 무장기 ${scene.sim.skillCount.left}+${scene.sim.skillCount.right} ≥ 컷신 ${cuts}(끝난 뒤 것은 컷신 없음)`);
    hud.events.emit('shutdown'); scene.events.emit('shutdown');
  }
  console.log(fails ? `\nFAIL — ${passes} ok, ${fails} fail` : `\nPASS — ${passes} ok, 0 fail`);
  process.exit(fails ? 1 : 0);
}
run();
