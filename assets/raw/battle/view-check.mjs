#!/usr/bin/env node
// view-check.mjs — 브라우저 없이 BattleScene·BattleHud·fx 를 굴려 보는 헤드리스 점검 (개발용, 배포물 아님).
//
//   node assets/raw/battle/view-check.mjs          1차 그림만 있는 상태(2차 텍스처 없음 → 폴백 경로)
//   node assets/raw/battle/view-check.mjs --art    2차 그림(BootScene.BATTLE2_ASSETS)이 전부 있는 상태 — 교체·기수·fx 풀·데칼 경로
//
// Phaser 를 「무엇을 불러도 체이닝되는 가짜 게임 오브젝트」로 흉내 내고(속성 x/y/alpha… 는 실제 값),
// 진짜 sim(src/battle/sim.js, 없으면 더미)을 붙여 create → 인트로 → 조이스틱·키보드 → 병법 → 무장기 → 종료 →
// 결과 패널 → 재배치 재시작 → 지도 복귀까지 순서대로 밟는다. 예외가 나면 그 자리에서 FAIL.
// 그림이 맞게 나오는지는 못 본다 — 호출 경로·계약·풀 관리·이벤트 연결만 확인한다.

import { pathToFileURL } from 'node:url';
import { join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const ROOT = normalize(join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..'));
let fails = 0, passes = 0;
const ok = (m) => { passes++; console.log(`  ok   ${m}`); };
const bad = (m) => { fails++; console.log(`  FAIL ${m}`); };
const check = (c, m) => (c ? ok(m) : bad(m));
const section = (t) => console.log(`\n== ${t}`);

// ─────────────────────────────────────────────────────────────
// Phaser 흉내
// ─────────────────────────────────────────────────────────────

/** EventEmitter3 처럼 context 를 받는 이벤트 */
class EE {
  constructor() { this.m = new Map(); }
  on(ev, fn, ctx) { if (!this.m.has(ev)) this.m.set(ev, []); this.m.get(ev).push({ fn, ctx, once: false }); return this; }
  once(ev, fn, ctx) { if (!this.m.has(ev)) this.m.set(ev, []); this.m.get(ev).push({ fn, ctx, once: true }); return this; }
  off(ev, fn, ctx) {
    const l = this.m.get(ev); if (!l) return this;
    this.m.set(ev, l.filter((h) => !(h.fn === fn && (ctx === undefined || h.ctx === ctx))));
    return this;
  }
  emit(ev, ...a) {
    const l = this.m.get(ev); if (!l) return false;
    for (const h of [...l]) { if (h.once) this.off(ev, h.fn, h.ctx); h.fn.apply(h.ctx, a); }
    return true;
  }
  removeAllListeners() { this.m.clear(); }
}

let gobjCount = 0;
/** 체이닝되는 가짜 게임 오브젝트. setXxx(v) 는 속성에 기록한다 */
function gobj(extra = {}) {
  const o = {
    x: 0, y: 0, alpha: 1, angle: 0, rotation: 0, scaleX: 1, scaleY: 1, scale: 1, width: 100, height: 100,
    displayWidth: 100, displayHeight: 100, depth: 0, originX: 0.5, originY: 0.5, visible: true, active: true,
    flipX: false, texture: { key: 'unit_inf' }, tintTopLeft: 0xffffff, text: '', destroyed: false, list: [],
    ...extra,
  };
  gobjCount++;
  const ee = new EE();
  o.on = (ev, fn, ctx) => { ee.on(ev, fn, ctx); return p; };
  o.once = (ev, fn, ctx) => { ee.once(ev, fn, ctx); return p; };
  o.off = (ev, fn, ctx) => { ee.off(ev, fn, ctx); return p; };
  o.emit = (ev, ...a) => ee.emit(ev, ...a);
  o.add = (c) => { o.list.push(...(Array.isArray(c) ? c : [c])); return p; };
  const p = new Proxy(o, {
    get(t, k) {
      if (k in t) return t[k];
      if (typeof k === 'symbol' || k === 'then') return undefined;
      return (...args) => {
        const m = String(k);
        if (m.startsWith('set') && m.length > 3) {
          const prop = m[3].toLowerCase() + m.slice(4);
          if (prop === 'position') { t.x = args[0]; t.y = args[1]; }
          else if (prop === 'scale') { t.scaleX = args[0]; t.scaleY = args.length > 1 ? args[1] : args[0]; t.scale = args[0]; }
          else if (prop === 'texture') t.texture = { key: args[0] };
          else if (prop === 'tint') t.tintTopLeft = args[0];
          else if (prop === 'tintFill') t.tintFill = true;
          else if (prop === 'size') { t.width = args[0]; t.height = args[1]; }
          else if (prop === 'displaySize') { t.displayWidth = args[0]; t.displayHeight = args[1]; }
          else if (prop === 'origin') { t.originX = args[0]; t.originY = args.length > 1 ? args[1] : args[0]; }
          else t[prop] = args[0];
        } else if (m === 'destroy') t.destroyed = true;
        else if (m === 'clear') { /* graphics */ }
        return p;
      };
    },
    set(t, k, v) { t[k] = v; return true; },
  });
  return p;
}

/** 시간이 흐르면 끝나는 가짜 트윈 */
class Tweens {
  constructor(clock) { this.clock = clock; this.list = []; }
  add(cfg) {
    const t = { cfg, start: this.clock.now, stopped: false, stop() { this.stopped = true; }, remove() { this.stopped = true; } };
    this.list.push(t);
    return t;
  }
  addCounter(cfg) {
    const t = this.add(cfg);
    t.getValue = () => Math.min(1, Math.max(0, (this.clock.now - t.start - (cfg.delay || 0)) / (cfg.duration || 1))) * ((cfg.to ?? 1) - (cfg.from ?? 0)) + (cfg.from ?? 0);
    return t;
  }
  killTweensOf(target) {
    for (const t of this.list) {
      const ts = Array.isArray(t.cfg.targets) ? t.cfg.targets : [t.cfg.targets];
      if (ts.includes(target)) t.stopped = true;
    }
  }
  update() {
    const now = this.clock.now;
    for (const t of [...this.list]) {
      if (t.stopped) { this.list.splice(this.list.indexOf(t), 1); continue; }
      const c = t.cfg;
      if (c.repeat === -1) continue;
      const total = (c.delay || 0) + (c.duration || 0) * (c.yoyo ? 2 : 1) + (c.hold || 0);
      if (c.onUpdate) c.onUpdate(t.getValue ? t : { getValue: () => 1 });
      if (now - t.start >= total) {
        this.list.splice(this.list.indexOf(t), 1);
        if (c.onComplete) c.onComplete();
      }
    }
  }
}

/** 씬 하나에 붙는 가짜 Phaser 시스템 */
function makeSceneEnv(scene, manager, key, data, clock) {
  const W = manager.W;
  // get(): fx.js 가 텍스처 실제 폭을 잰다(「화면 px → 배율」) — 가짜 폭 64
  const textures = { exists: (k) => manager.textures.has(k), get: () => ({ getSourceImage: () => ({ width: 64, height: 64 }) }) };
  const add = new Proxy({}, {
    get: (_, k) => (...args) => {
      const kind = String(k);
      const g = gobj({ kind });
      if (kind === 'text') { g.text = args[2]; g.width = String(args[2] || '').length * 14; }
      if (kind === 'image' || kind === 'sprite') { g.x = args[0]; g.y = args[1]; g.texture = { key: args[2] }; if (args[2] === 'cutin_guanyu') g.height = 1216; }
      if (kind === 'rectangle' || kind === 'container' || kind === 'circle' || kind === 'graphics') { g.x = args[0] || 0; g.y = args[1] || 0; }
      manager.objs.push(g);
      return g;
    },
  });
  const pointers = manager.pointers;
  const keyboard = new EE();
  keyboard.addKeys = (s) => Object.fromEntries(s.split(',').map((n) => [n, { isDown: false }]));
  const input = new EE();
  input.keyboard = keyboard;
  input.manager = { pointers };
  input.addPointer = (n) => { for (let i = 0; i < n; i++) pointers.push({ id: pointers.length, x: 0, y: 0, isDown: false }); };
  const cam = gobj({ width: W, height: 720, scrollX: 0, scrollY: 0, zoom: 1, calls: [] });
  const camP = new Proxy(cam, { get(t, k) { if (k === 'shake' || k === 'flash') return (...a) => { t.calls.push([k, ...a]); return t; }; return t[k]; } });
  const delayed = [];
  Object.assign(scene, {
    add,
    tweens: manager.tweens,
    cameras: { main: camP },
    input,
    textures,
    time: { get now() { return clock.now; }, delayedCall: (ms, fn) => { delayed.push({ at: clock.now + ms, fn }); } },
    scale: { width: W, height: 720 },
    registry: manager.registry,
    events: new EE(),
    sys: { isActive: () => manager.status.get(key) === 'running', game: { renderer: { type: 2 } }, settings: { data } },
    scene: {
      settings: { data },
      get: (k) => manager.scenes.get(k),
      launch: (k, d) => { manager.log.push(['launch', k, d]); manager.status.set(k, 'running'); },
      stop: (k) => { manager.log.push(['stop', k]); manager.status.set(k, 'stopped'); const s = manager.scenes.get(k); if (s && s.events) s.events.emit('shutdown'); },
      start: (k, d) => { manager.log.push(['start', k, d]); manager.status.set(key, 'stopped'); scene.events.emit('shutdown'); manager.status.set(k, 'running'); },
      restart: (d) => { manager.log.push(['restart', key, d]); },
      isActive: (k) => manager.status.get(k || key) === 'running',
    },
    __delayed: delayed,
  });
  manager.scenes.set(key, scene);
  manager.status.set(key, 'running');
}

// ─────────────────────────────────────────────────────────────

globalThis.window = globalThis;
globalThis.addEventListener = () => {};
globalThis.Phaser = {
  AUTO: 0, CANVAS: 1, WEBGL: 2,
  Scene: class { constructor(key) { this.sceneKey = key; } },
  Scenes: { Events: { SHUTDOWN: 'shutdown' } },
  Scale: { FIT: 'FIT', CENTER_BOTH: 'CENTER_BOTH', Events: { RESIZE: 'resize' } },
  BlendModes: { ADD: 1 },
  Math: { Clamp: (v, a, b) => Math.min(b, Math.max(a, v)), Linear: (a, b, t) => a + (b - a) * t, Distance: { Between: (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1) } },
  Geom: { Rectangle: class { static Contains() { return false; } } },
};

const clock = { now: 1000 };
const manager = {
  W: 1558, scenes: new Map(), status: new Map(), log: [], objs: [], pointers: [{ id: 0, x: 0, y: 0, isDown: false }, { id: 1, x: 0, y: 0, isDown: false }],
  textures: new Set(['unit_inf', 'unit_spear', 'unit_bow', 'unit_cav', 'unit_general', 'arrow', 'spark', 'dust', 'glow', 'battle_sky', 'battle_far', 'battle_ground',
    'panel', 'parchment', 'button', 'button_down', 'banner', 'portrait_placeholder', 'cutin_guanyu']),
  registry: { m: new Map(), get(k) { return this.m.get(k); }, set(k, v) { this.m.set(k, v); } },
  tweens: null,
};
manager.tweens = new Tweens(clock);

// --art: 2차 그림이 전부 로드된 것처럼 — 키는 BootScene 표에서 그대로. 늘 만드는 비네트·원근 그라데이션도 넣는다
const ART = process.argv.includes('--art');
if (ART) {
  const boot = await import(pathToFileURL(join(ROOT, 'src/scenes/BootScene.js')).href);
  // (통합) --drop=<정규식>: 그 키만 빠진 「일부만 납품」 상태 — 기대값 검사(FAIL 줄)는 어긋날 수 있으니 예외 없이 끝까지 도는지만 본다(끝줄 DROP-OK)
  const dropArg = process.argv.find((a) => a.startsWith('--drop='));
  const DROP = dropArg ? new RegExp(dropArg.slice(7)) : null;
  globalThis.__DROP = !!DROP;
  for (const [key] of boot.BATTLE2_ASSETS) if (!DROP || !DROP.test(key)) manager.textures.add(key);
  manager.textures.add('battle_vignette');
  manager.textures.add('battle_shade');
}
console.log(ART ? '[2차 그림 있음 --art]' : '[2차 그림 없음 — 폴백 경로]');

const { default: BattleScene } = await import(pathToFileURL(join(ROOT, 'src/battle/BattleScene.js')).href);
const { default: BattleHud } = await import(pathToFileURL(join(ROOT, 'src/battle/BattleHud.js')).href);

function frame(scene, hud, dt = 16.7) {
  clock.now += dt;
  scene.update(clock.now, dt);
  if (hud && manager.status.get('BattleHud') === 'running') hud.update(clock.now, dt);
  manager.tweens.update();
  for (const s of [scene, hud]) {
    if (!s || !s.__delayed) continue;
    for (const d of [...s.__delayed]) if (clock.now >= d.at) { s.__delayed.splice(s.__delayed.indexOf(d), 1); d.fn(); }
  }
}

async function run() {
  section('BattleScene.create + sim 로드');
  const scene = new BattleScene();
  makeSceneEnv(scene, manager, 'BattleScene', { seed: 1 }, clock);
  scene.create();
  check(manager.log.some((l) => l[0] === 'launch' && l[1] === 'BattleHud'), 'create 가 BattleHud 를 launch 한다');
  check(scene.pool.length === 260 && scene.shadowG && scene.fx, '스프라이트 풀 260 + 그림자 Graphics + Fx');
  check(scene.cameras.main.zoom === 1.15, `카메라 기본 줌 1.15 (지금 ${scene.cameras.main.zoom})`);
  check(scene.fx.fxPool.length === 60 && scene.fx.decals.length === (ART ? 40 : 0), `fx 풀 60 · 데칼 풀 ${scene.fx.decals.length}${ART ? '' : ' (데칼 텍스처 없음 → 0)'}`);
  check(scene.props.length === (ART ? 19 : 0), `소품·진영 깃발 ${scene.props.length}개`);
  check(ART ? (scene.fogBack.length >= 5 && scene.groundImgTop === 360) : (scene.fogBack.length === 0 && scene.groundImgTop === 400), `안개 ${scene.fogBack.length}×2장 · 땅 그림 위 변 y ${scene.groundImgTop}`);
  for (let i = 0; i < 20 && !scene.sim; i++) await new Promise((r) => setTimeout(r, 20));
  check(!!scene.sim, `sim 로드됨 (${existsSync(join(ROOT, 'src/battle/sim.js')) ? 'src/battle/sim.js' : '더미'})`);
  if (!scene.sim) return;
  check(scene.playerUnit && scene.playerUnit.kind === 'general' && scene.playerUnit.side === 'left', `플레이어 무장 = ${scene.playerUnit && scene.playerUnit.name}`);
  check(scene.genMeta.size === 4, '무장 메타 4');
  const metas = [...scene.genMeta.values()];
  check(metas.every((m) => m.skill && m.skill.name && m.skill.shape), `무장기 데이터 해석: ${metas.map((m) => `${m.name}=${m.skill.name}/${m.skill.shape}`).join(' ')}`);
  check(metas[0].key === 'guanyu', `컷인 키 = cutin_${metas[0].key}`);
  check(scene.introUntil > clock.now, '인트로 동안 sim 정지');
  check(scene.genViews.length === 4 && scene.genViews.every((v) => v.label.text && v.h > 0), `무장 이름표 4 (${scene.genViews.map((v) => v.label.text).join('·')})`);
  check(scene.flagByUnit.size === (ART ? 12 : 0), `기수 깃발 ${scene.flagByUnit.size}개 (부대당 3 × 4)`);
  if (ART) {
    const texOf = (u) => scene.spriteById.get(u.id).texture.key;
    const gl = scene.sim.generalsOf('left')[0], sr = scene.sim.units.find((u) => u.side === 'right' && u.kind !== 'general');
    check(texOf(gl) === 'u2_gen_guanyu_stand' && texOf(sr) === `u2_${sr.kind}_b_stand`, `2차 유닛 텍스처: ${texOf(gl)} / ${texOf(sr)}`);
    const sp = scene.spriteById.get(sr.id);
    check(sp.originY === 0.95 && sp.baseTint === null, '2차 그림은 origin 0.95 · tint 없음');
  } else {
    const sr = scene.sim.units.find((u) => u.side === 'right' && u.kind !== 'general');
    const sp = scene.spriteById.get(sr.id);
    check(/^(bunit_|unit_)/.test(sp.texture.key) && sp.baseTint === 0x3b6fd6, `1차 폴백: ${sp.texture.key} + 편 색 tint`);
  }

  section('BattleHud.create');
  const hud = new BattleHud();
  makeSceneEnv(hud, manager, 'BattleHud', {}, clock);
  hud.create();
  check(hud.genRows.length === 4, 'HUD 무장 HP 행 4개 (sim 준비된 뒤 진입)');
  check(hud.tacticBtns.length === 3 && hud.skillBtn, '병법 3버튼 + 무장기 버튼');

  // 인트로 통과
  const simT0 = scene.sim.time;
  for (let i = 0; i < 10; i++) frame(scene, hud);
  check(scene.sim.time === simT0, '인트로 중엔 sim.time 이 안 흐른다');
  while (clock.now < scene.introUntil) frame(scene, hud);
  frame(scene, hud);
  check(scene.sim.time > simT0, '인트로 뒤 sim 진행');
  const activeSprites = () => scene.spriteById.size;
  check(activeSprites() === 244, `스프라이트 244 활성 (풀 남음 ${scene.pool.length})`);
  check(hud.timeText.text === '0:00' && /아군 122/.test(hud.barL.text.text) && /적군 122/.test(hud.barR.text.text), `HUD 병력·시간 문구: ${hud.barL.text.text} / ${hud.barR.text.text} / ${hud.timeText.text}`);

  section('조이스틱·키보드 → setGeneralInput');
  const p = scene.playerUnit;
  const x0 = p.x;
  const ptr = manager.pointers[1];
  Object.assign(ptr, { x: 300, y: 400, isDown: true });
  scene.input.emit('pointerdown', ptr);
  check(!!scene.joy && scene.joy.ox === 300, '왼쪽 반 터치 → 조이스틱 생성(터치한 자리)');
  ptr.x = 380;                       // 오른쪽으로 80px → 데드존 12 넘음
  for (let i = 0; i < 30; i++) frame(scene, hud);
  check(scene.joy.dx > 0.9 && Math.abs(scene.joy.dy) < 0.01, `조이스틱 벡터 (${scene.joy.dx.toFixed(2)}, ${scene.joy.dy.toFixed(2)})`);
  check(p.x > x0 + 30, `무장이 오른쪽으로 이동 ${x0.toFixed(0)} → ${p.x.toFixed(0)}`);
  ptr.isDown = false;
  scene.input.emit('pointerup', ptr);
  check(!scene.joy, '손 떼면 조이스틱 사라짐');
  const hudPtr = { id: 2, x: manager.W - 90, y: 630, isDown: true };
  scene.input.emit('pointerdown', hudPtr);
  check(!scene.joy, '오른쪽 반(HUD 버튼 자리) 터치는 조이스틱이 아니다');
  const x1 = p.x;
  scene.keys.A.isDown = true;
  for (let i = 0; i < 30; i++) frame(scene, hud);
  scene.keys.A.isDown = false;
  check(p.x < x1 - 30, `키보드 A → 왼쪽 이동 ${x1.toFixed(0)} → ${p.x.toFixed(0)}`);
  check(p.facing === -1 && scene.spriteById.get(p.id).flipX === true, '왼쪽 보면 flipX');
  const camX = scene.cameras.main.scrollX;
  // 줌 1.15: 보이는 폭 W/1.15, 화면 가운데 = scrollX + W/2 → scrollX 는 −(W − W/1.15)/2 까지 내려간다(전장 왼쪽 끝)
  const minScroll = manager.W / (2 * 1.15) - manager.W / 2;
  check(camX >= minScroll - 0.01 && Math.abs(camX - (p.x - 120 - manager.W / 2)) < 400, `카메라가 무장을 따라감 scrollX=${camX.toFixed(0)} (하한 ${minScroll.toFixed(0)})`);
  check(Math.abs(scene.cameras.main.scrollY - (720 - 720 / 1.15) / 2) < 0.01, `세로는 아래 변에 붙음 scrollY=${scene.cameras.main.scrollY.toFixed(1)}`);

  section('병법·무장기');
  scene.input.keyboard.emit('keydown-ONE');
  check(scene.cmd.left === 'charge', '1 키 → 돌격');
  frame(scene, hud);
  const shouts = manager.objs.filter((o) => o.kind === 'text' && o.text === '돌격!');
  check(shouts.length === 1, `「돌격!」 붓글씨 한 번(씬 emit + sim 이벤트 중복 제거) — ${shouts.length}개`);
  check(hud.tacticBtns.find((b) => b.cmd === 'charge').held === true, 'HUD 병법 버튼 「돌격」 눌림 유지');
  hud.tacticBtns.find((b) => b.cmd === 'hold').emit('pointerup');
  check(scene.cmd.left === 'hold', 'HUD 버튼 → 대기');
  let failEv = 0; scene.events.on('battle:skillfail', () => failEv++);
  check(scene.tryUseSkill() === false && failEv === 1, '게이지 0 이면 무장기 실패 이벤트');
  p.gauge = 100;
  let skillMeta = null; scene.events.on('battle:skill', (m) => { skillMeta = m; });
  const camCalls0 = scene.cameras.main.calls.length;
  scene.input.keyboard.emit('keydown-SPACE');
  frame(scene, hud);
  check(skillMeta && skillMeta.name === p.name, `무장기 발동 → battle:skill(${skillMeta && skillMeta.name})`);
  check(scene.cameras.main.calls.slice(camCalls0).some((c) => c[0] === 'shake' && c[1] === 350) && scene.cameras.main.calls.some((c) => c[0] === 'flash'), '카메라 shake 0.35초 + flash');
  // 히트스톱 120ms: sim.time 이 멈췄다 다시 흐른다 / 줌 펀치: 1.25 근처까지 갔다 1.15 로 복귀
  {
    const tStop = scene.sim.time;
    let zMax = scene.cameras.main.zoom;
    for (let i = 0; i < 6; i++) { frame(scene, hud); zMax = Math.max(zMax, scene.cameras.main.zoom); }   // 100ms
    check(scene.sim.time === tStop, `히트스톱: 100ms 동안 sim.time 그대로(${Math.round(tStop)})`);
    for (let i = 0; i < 12; i++) { frame(scene, hud); zMax = Math.max(zMax, scene.cameras.main.zoom); }
    check(scene.sim.time > tStop, '히트스톱 뒤 sim 진행');
    check(zMax > 1.22 && zMax <= 1.25, `줌 펀치 최대 ${zMax.toFixed(3)}`);
    for (let i = 0; i < 30; i++) frame(scene, hud);
    check(scene.cameras.main.zoom === 1.15, '펀치 뒤 줌 1.15 복귀');
    if (ART) {
      check(scene.fx.fxLive.length + scene.fx.fxPool.length === 60, `fx 풀 합 60 (살아 있는 것 ${scene.fx.fxLive.length})`);
    }
  }
  const cutinObjs = manager.objs.filter((o) => o.kind === 'image' && o.texture.key === 'cutin_guanyu');
  check(cutinObjs.length === 1 && cutinObjs[0].height === 1216, '컷인 초상 이미지 생성(cutin_guanyu)');
  check(scene.result === null, '아직 결과 없음');

  section('전투 진행 → 종료 → 결과 패널');
  scene.command('charge');
  let frames = 0;
  let sawAttackTex = false, maxFx = 0, maxDecal = 0, sawKb = false;
  // fx 풀 압력: spawn 이 null(풀 빔)을 돌려준 횟수와 평균 점유 — 60fps(16.7ms) 프레임으로 잰다
  let spawnTry = 0, spawnFail = 0, liveSum = 0;
  const spawn0 = scene.fx.spawn.bind(scene.fx);
  scene.fx.spawn = (...a) => { const r = spawn0(...a); spawnTry++; if (!r && manager.textures.has(a[0])) spawnFail++; return r; };
  let endEv = null; scene.events.on('battle:end', (r) => { endEv = r; });
  const t0 = Date.now();
  while (!scene.ended && frames < 12000) {
    frame(scene, hud, 16.7); frames++;
    maxFx = Math.max(maxFx, scene.fx.fxLive.length);
    liveSum += scene.fx.fxLive.length;
    maxDecal = Math.max(maxDecal, scene.fx.decalLive);
    if (!sawAttackTex || !sawKb) for (const sp of scene.spriteById.values()) {
      if (/_attack$/.test(sp.texture.key)) sawAttackTex = true;
      if (sp.kb) sawKb = true;
    }
  }
  if (ART) {
    check(sawAttackTex, 'attackT 0.15~0.75 구간에 attack 텍스처로 교체됨');
    check(maxFx > 0 && maxFx <= 60 && maxDecal > 0 && maxDecal <= 40, `fx 동시 최대 ${maxFx}/60 (평균 ${(liveSum / frames).toFixed(1)}) · 데칼 동시 최대 ${maxDecal}/40`);
    check(spawnFail / Math.max(1, spawnTry) < 0.05, `fx 풀이 비어 건너뛴 이펙트 ${spawnFail}/${spawnTry} (${(100 * spawnFail / Math.max(1, spawnTry)).toFixed(1)}%) < 5%`);
  } else {
    check(!sawAttackTex && maxFx === 0 && maxDecal === 0, '2차 텍스처 없음 → 교체·fx 풀·데칼 미사용(1차 경로)');
  }
  check(sawKb, '넉백 회전(kb) 이 걸린 스프라이트가 있었다');
  const wall = Date.now() - t0;
  check(scene.ended && scene.result, `전투 종료: ${scene.result && scene.result.winner} (${scene.result && scene.result.reason}) sim ${Math.round(scene.sim.time / 1000)}초, 프레임 ${frames}, 실시간 ${wall}ms`);
  for (let i = 0; i < 40; i++) frame(scene, hud, 50);
  check(endEv && hud.resultOpen, `battle:end → 결과 패널 열림 「${hud.rTitle.text}」 ${hud.rRows.map((r) => r.text).join(' | ')}`);
  check(scene.spriteById.size <= scene.sim.units.filter((u) => u.state !== 'gone').length + 1, `죽은 유닛 스프라이트가 풀로 돌아옴 (활성 ${scene.spriteById.size}, 풀 ${scene.pool.length})`);
  check(scene.fx.slashPool.length + scene.fx.slashes.length === 14 && scene.fx.arrowPool.length === 48 && scene.fx.textPool.length + scene.fx.textLive.length === 30, '이펙트 풀 누수 없음');
  check(scene.fx.fxPool.length + scene.fx.fxLive.length === 60 && scene.fx.fxLive.every((x) => x.active), `2차 fx 풀 누수 없음 (살아 있는 것 ${scene.fx.fxLive.length})`);
  const flagsShown = [...scene.flagByUnit.entries()].filter(([id, f]) => f.visible && scene.sim.units[id].state === 'gone').length;
  check(flagsShown === 0, '사라진 기수의 깃발은 안 보인다');
  check(!scene.joy && !hud.readyTween, '종료 뒤 조이스틱·게이지 빛 없음');

  section('재배치(relayout) — HUD 재시작, BattleScene.applyBounds');
  manager.W = 2400;
  scene.scale.width = 2400;
  scene.applyBounds();
  check(scene.bgObjs.length >= 6, `배경 다시 만듦 (${scene.bgObjs.length}개)`);
  const hud2 = new BattleHud();
  makeSceneEnv(hud2, manager, 'BattleHud', { relayout: true }, clock);
  hud2.scale.width = 2400;
  hud2.create();
  check(hud2.genRows.length === 4 && hud2.resultOpen && hud2.panel.alpha === 1, '재시작 HUD 가 무장 행·결과 패널을 즉시 복원(인트로 없음)');

  section('「지도로」 / 「다시」');
  scene.goMap();
  const st = manager.log.find((l) => l[0] === 'start' && l[1] === 'MapScene');
  check(st && st[2] && st[2].ui && st[2].ui.noIntro && /승리|패배|무승부/.test(st[2].ui.toast), `MapScene 시작 데이터 ui.toast=「${st && st[2].ui.toast}」`);
  check(manager.log.some((l) => l[0] === 'stop' && l[1] === 'BattleHud'), 'BattleHud stop');
  scene.restartBattle();
  check(manager.log.some((l) => l[0] === 'restart' && l[1] === 'BattleScene'), '「다시」 → scene.restart');

  section('더미 sim(assets/raw/battle/sim-stub.mjs) 계약');
  const stub = await import(pathToFileURL(join(ROOT, 'assets/raw/battle/sim-stub.mjs')).href);
  const { DEFAULT_DATA } = await import(pathToFileURL(join(ROOT, 'src/battle/BattleScene.js')).href);
  const sb = stub.createBattle({ seed: 2, left: DEFAULT_DATA.ARMY_LEFT, right: DEFAULT_DATA.ARMY_RIGHT });
  check(sb.units.length === 244 && sb.generalsOf('left').length === 2, `더미 units ${sb.units.length}`);
  sb.command('left', 'charge');
  const types = new Set();
  let n = 0;
  while (!sb.result && n < 180 * 60) { sb.step(16.7); for (const e of sb.drainEvents()) types.add(e.type); n++; }
  check(!!sb.result, `더미 종료 ${sb.result && sb.result.winner} (${sb.result && sb.result.reason}) ${Math.round(sb.time / 1000)}초, 이벤트 ${[...types].join(',')}`);
  const g0 = sb.generalsOf('left')[0];
  const sb2 = stub.createBattle({ seed: 5, left: DEFAULT_DATA.ARMY_LEFT, right: DEFAULT_DATA.ARMY_RIGHT });
  const pg = sb2.generalsOf('left')[0];
  pg.gauge = 100;
  check(sb2.useSkill('left', pg.id) === true && sb2.drainEvents().some((e) => e.type === 'skill'), '더미 useSkill → skill 이벤트');
  check(typeof g0.gauge === 'number' && g0.skill, '더미 무장 gauge·skill');

  if (globalThis.__DROP) { console.log(`\nDROP-OK — 예외 없이 끝까지 (${passes} ok, 기대값 어긋남 ${fails})`); process.exit(0); }
  console.log(`\n${fails === 0 ? 'PASS' : 'FAIL'} — ${passes} ok, ${fails} fail`);
  process.exit(fails === 0 ? 0 : 1);
}

run().catch((e) => { console.error('예외:', e); process.exit(1); });
