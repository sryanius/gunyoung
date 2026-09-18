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

const ROOT = "C:\\claude\\gunyoung";
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

/** (3차) 가짜 CanvasRenderingContext2D — 어떤 메서드든 받고, createLinearGradient 는 addColorStop 을 가진 객체를 돌려준다 */
function fakeCtx() {
  const grad = () => ({ stops: [], addColorStop(o, c) { this.stops.push([o, c]); } });
  return new Proxy({ createLinearGradient: grad, createRadialGradient: grad }, { get: (t, k) => (k in t ? t[k] : () => {}), set: (t, k, v) => { t[k] = v; return true; } });
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
  // (3차) createCanvas: cutin.js 가 패널 그라데이션·눈 띠 페이드 텍스처를 캔버스로 만든다 — 무엇을 불러도 되는 가짜 2D 컨텍스트
  const textures = {
    exists: (k) => manager.textures.has(k), get: () => ({ getSourceImage: () => ({ width: 64, height: 64 }) }),
    createCanvas: (k, w, h) => { manager.textures.add(k); manager.canvasTex.push(k); return { width: w, height: h, context: fakeCtx(), refresh() {} }; },
  };
  const add = new Proxy({}, {
    get: (_, k) => (...args) => {
      const kind = String(k);
      const g = gobj({ kind });
      if (kind === 'text') { g.text = args[2]; g.width = String(args[2] || '').length * 14; g.context = fakeCtx(); }   // (3차) context: 금색 그라데이션 fill
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
  tweens: null, canvasTex: [],
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
  // (3차) 컷신 눈 띠(BootScene.BATTLE3_ASSETS) — --art 는 눈 띠까지 있는 1.6초 경로, 기본은 눈 띠 없는 1.35초 경로
  for (const [key] of boot.BATTLE3_ASSETS || []) if (!DROP || !DROP.test(key)) manager.textures.add(key);
}
console.log(ART ? '[2차 그림 있음 --art]' : '[2차 그림 없음 — 폴백 경로]');

const { default: BattleScene } = await import(new URL('../cutscene/_try/BattleScene.mjs', import.meta.url).href);
const { default: BattleHud } = await import(new URL('../cutscene/_try/BattleHud.mjs', import.meta.url).href);

function frame(scene, hud, dt = 16.7) {
  clock.now += dt;
  scene.update(clock.now, dt);
  if (hud && manager.status.get('BattleHud') === 'running') hud.update(clock.now, dt);
  // (3차) Phaser 는 도는 씬마다 매 프레임 'update'(time, delta) 이벤트를 낸다 — cutin.js 가 트윈 대신 이걸로 컷신을 굴린다
  if (scene.events) scene.events.emit('update', clock.now, dt);
  if (hud && hud.events && manager.status.get('BattleHud') === 'running') hud.events.emit('update', clock.now, dt);
  manager.tweens.update();
  for (const s of [scene, hud]) {
    if (!s || !s.__delayed) continue;
    for (const d of [...s.__delayed]) if (clock.now >= d.at) { s.__delayed.splice(s.__delayed.indexOf(d), 1); d.fn(); }
  }
}

/** (3차) cutin.js — 시간표·배치(순수 함수) + 빈 씬에 직접 띄워 박자·반전·폴백·취소·누수를 본다 */
async function cutinChecks() {
  section('컷신 (src/battle/cutin.js — BATTLE_V3.md §3.3)');
  const C = await import(pathToFileURL(join(ROOT, 'src/battle/cutin.js')).href);
  const { cutin } = await import(pathToFileURL(join(ROOT, 'src/battle/fx.js')).href);

  const tf = C.cutinTiming('full', true, true), ts = C.cutinTiming('short', true, true), tn = C.cutinTiming('full', false, true), tt = C.cutinTiming('full', false, false);
  check(tf.eye === 250 && tf.open === 250 && tf.text === 450 && tf.fire === 1200 && tf.impact === 1450 && tf.total === 1600, '시간표 full: 눈 0~250 · 패널 250 · 글자 450 · 발동 1200 · 복귀 1450 · 끝 1600');
  check(ts.eye === 0 && ts.fire === 380 && ts.impact === 480 && ts.total === 600, '시간표 short: 눈 띠 없이 0.6초(발동 380 · 복귀 480)');
  check(tn.total === 1350 && tn.open === 0 && tt.total === 1100 && C.cutinTiming('off').total === 0, '시간표 폴백: 눈 띠 없음 1350 · 붓글씨만 1100 · off 0');

  const layoutBad = [];
  for (const W of [1280, 1558, 2400]) for (const side of ['left', 'right']) for (const [tw, th] of [[832, 1216], [1248, 1824]]) {
    const L = C.cutinLayout(W, 720, { side, texW: tw, texH: th });
    const bandCy = 360 + Math.tan(L.a) * (L.faceX - W / 2);
    const okFace = Math.abs(L.faceY - bandCy) < L.bandWin / 2 - 60;
    const okSize = Math.abs(L.dispH - 900) < 1e-6 && Math.abs(L.dispW - 900 * tw / th) < 1e-6;
    const okSides = (L.faceX - W / 2) * L.m > 0 && (L.textX - W / 2) * L.m < 0;
    const outerEdge = L.imgX + L.m * L.dispW / 2;                        // 그림 바깥쪽 변 — 폭 1680 까지는 화면 끝을 넘어야(잘린 세로선이 안 보인다), 넘어도 폭의 10% 안
    const over = L.m > 0 ? outerEdge - W : -outerEdge;
    const okRest = (W > 1680 || over >= 0) && over <= L.dispW * 0.1;
    const okStart = L.m > 0 ? L.startX - L.dispW / 2 >= W : L.startX + L.dispW / 2 <= 0;
    const okGap = Math.abs(L.textX - L.imgX) >= L.dispW / 2 + 141;      // 세 글자(≈141px 반폭)가 그림 상자와 안 겹친다
    const okTilt = L.tiltDeg === (side === 'right' ? 12 : -12) && L.flip === (side === 'right');
    if (!(okFace && okSize && okSides && okRest && okStart && okGap && okTilt)) layoutBad.push(`${W}/${side}/${tw}: ${[okFace, okSize, okSides, okRest, okStart, okGap, okTilt].map(Number).join('')}`);
  }
  check(layoutBad.length === 0, `배치 12가지(폭 1280·1558·2400 × 좌우 × 그림 832/1248): 그림 높이 = 화면×1.25 · 얼굴이 패널 창 안 · 그림/글자 반대편(안 겹침) · 그림 바깥 변은 화면 밖 · 적은 +12°·flipX${layoutBad.length ? ' — ' + layoutBad.join(', ') : ''}`);

  // 빈 씬에 직접 — 시계를 직접 굴린다(BattleScene 은 멈춰 있다)
  const cs = {};
  makeSceneEnv(cs, manager, 'CutinTest', {}, clock);
  const W = cs.scale.width;
  const step = (ms) => { for (let t = 0; t < ms - 1e-6; t += 16.7) { clock.now += 16.7; cs.events.emit('update', clock.now, 16.7); } };
  const listeners = (ev) => (cs.events.m.get(ev) || []).length;
  const hadEyes = manager.textures.has('cutin_guanyu_eyes');
  manager.textures.add('cutin_guanyu_eyes');
  clock.now += 5000;                                   // 앞 컷신과 1.6초 넘게 떨어뜨린다(연달아 = short 규칙)

  // ① full — 아군
  {
    const n0 = manager.objs.length, t0 = clock.now;
    let imp = null, done = null;
    const plan = C.cutinPlan(cs, { key: 'guanyu', now: clock.now });
    const h = cutin(cs, { name: '관우', skillName: '청룡참', key: 'cutin_guanyu', color: 0xffd24a, onImpact: (i) => { imp = { t: clock.now - t0, ...i }; }, onDone: (i) => { done = { t: clock.now - t0, ...i }; } });
    const mine = manager.objs.slice(n0);
    check(h.mode === 'full' && h.duration === 1600 && h.fireAt === 1200 && h.impactAt === 1450 && h.active && plan.total === h.duration && plan.mode === h.mode, `full 컷신 handle: 길이 ${h.duration} · 발동 ${h.fireAt} · 복귀 ${h.impactAt} (cutinPlan 과 같음)`);
    check(mine.length > 20 && mine.every((o) => o.scrollFactor === 0 && o.depth >= 900), `오브젝트 ${mine.length}개 전부 화면 고정(scrollFactor 0) · HUD 위 깊이(≥900)`);
    const eyes = mine.find((o) => o.texture && o.texture.key === 'cutin_guanyu_eyes');
    const arts = mine.filter((o) => o.kind === 'image' && o.texture.key === 'cutin_guanyu');
    const art = arts[0];
    const Lo = C.cutinLayout(W, 720, { side: 'left', texW: art.width, texH: art.height });
    step(100);
    check(eyes && eyes.visible && eyes.crop === 0 && !arts.some((o) => o.visible), '① 눈 띠가 열리고(setCrop) 주 일러스트는 아직 안 보인다');
    step(250);
    check(art.visible && art.mask && art.x > Lo.imgX + 50 && !eyes.visible, `② 패널이 열리고 일러스트가 오른쪽에서 미끄러져 들어오는 중 (x ${Math.round(art.x)} → ${Math.round(Lo.imgX)}), 눈 띠는 닫힘`);
    step(650);
    const texts = mine.filter((o) => o.kind === 'text');
    const chars = texts.filter((o) => String(o.text).length === 1);
    check(Math.abs(art.x - Lo.imgX) < 40 && art.scaleX > Lo.scale && art.scaleX < Lo.scale * 1.061 && art.flipX === false, `일러스트가 멈춘 뒤 천천히 줌 (배율 ×${(art.scaleX / Lo.scale).toFixed(3)})`);
    check(texts.length === 4 && chars.length === 3 && chars.every((c) => c.visible && c.alpha === 1 && c.fill && c.fill.stops && c.x < W / 2) && chars[0].x < chars[1].x && chars[1].x < chars[2].x,
      `③ 이름 + 무장기명 세 글자(금색 그라데이션 fill)가 반대편(왼쪽)에 차례로 — x ${chars.map((c) => Math.round(c.x)).join(' < ')}`);
    check(imp === null && done === null, '복귀 전에는 onImpact·onDone 이 안 불린다');
    step(460);
    check(imp && imp.t >= 1450 && imp.t < 1475 && imp.canceled === false && done === null, `⑤ onImpact 가 복귀 시각에 — ${imp && imp.t.toFixed(0)}ms`);
    step(160);
    const r = await Promise.race([h.done, new Promise((res) => setTimeout(() => res('timeout'), 200))]);
    check(done && done.t >= 1600 && done.t < 1625 && !h.active && r && r.canceled === false, `onDone·done Promise 가 끝에 — ${done && done.t.toFixed(0)}ms`);
    check(mine.every((o) => o.destroyed) && listeners('update') === 0 && listeners('shutdown') === 0 && !cs.__cutin, `누수 없음: ${mine.length}개 전부 destroy(마스크 포함) · update/shutdown 리스너 0`);
    check(manager.tweens.list.every((t) => ![].concat(t.cfg.targets || []).some((x) => mine.includes(x))) && cs.__delayed.length === 0, '트윈·타이머를 안 만든다(HUD 씬 timeScale 과 무관한 실시간 재생)');
  }

  // ② 연달아 → short
  {
    const n0 = manager.objs.length;
    const h = cutin(cs, { name: '장비', skillName: '포효', key: 'cutin_guanyu', color: 0xffd24a });
    const mine = manager.objs.slice(n0);
    check(h.mode === 'short' && h.duration === 600 && h.impactAt === 480 && !mine.some((o) => o.texture && o.texture.key === 'cutin_guanyu_eyes'), '1.6초 안에 또 터지면 짧은 버전 0.6초(눈 띠 생략)');
    step(620);
    check(!h.active && mine.every((o) => o.destroyed), '짧은 버전도 끝나면 전부 destroy');
  }

  // ③ 적 편 — 좌우 반전(편은 색 0x9cc0ff 로 짐작) + 도중 cancel
  {
    clock.now += 5000;
    const n0 = manager.objs.length;
    let imp = null, done = null;
    const h = cutin(cs, { name: '하후돈', skillName: '맹공', key: 'cutin_guanyu', color: 0x9cc0ff, onImpact: (i) => { imp = i; }, onDone: (i) => { done = i; } });
    const mine = manager.objs.slice(n0);
    step(1000);
    const art = mine.find((o) => o.kind === 'image' && o.texture.key === 'cutin_guanyu');
    const chars = mine.filter((o) => o.kind === 'text' && String(o.text).length === 1);
    check(h.mode === 'full' && art.x < W / 2 && art.flipX === true && chars.length === 2 && chars.every((c) => c.x > W / 2) && mine.some((o) => o.angle === 12),
      `적 편은 좌우 반전: 일러스트 x ${Math.round(art.x)} < 가운데 ${W / 2} · flipX · 글자는 오른쪽 · 패널 +12°`);
    h.cancel();
    check(!h.active && mine.every((o) => o.destroyed) && imp && imp.canceled && done && done.canceled && listeners('update') === 0, 'cancel(): 즉시 전부 destroy + onImpact·onDone(canceled) 은 빠뜨리지 않는다');
  }

  // ④ 에셋 없음 → 붓글씨만 + 씬 shutdown 때 정리
  {
    clock.now += 5000;
    const n0 = manager.objs.length;
    const h = cutin(cs, { name: '전위', skillName: '쌍극', key: 'cutin_nobody', color: 0x9cc0ff, side: 'left' });
    const mine = manager.objs.slice(n0);
    step(400);
    const chars = mine.filter((o) => o.kind === 'text' && String(o.text).length === 1);
    check(h.duration === 1100 && !mine.some((o) => o.texture && /^cutin_nobody/.test(o.texture.key)) && chars.length === 2 && chars.every((c) => c.visible) && Math.abs((chars[0].x + chars[1].x) / 2 - W / 2) < 30,
      '일러스트·눈 띠가 없으면 그 박자를 건너뛰고 패널 + 붓글씨만(가운데, 1.1초)');
    cs.events.emit('shutdown');
    check(!h.active && mine.every((o) => o.destroyed) && listeners('update') === 0 && listeners('shutdown') === 0, '씬 shutdown(HUD 재시작·지도 복귀) 때 컷신이 스스로 걷힌다');
  }

  // ⑤ registry.cutinMode
  {
    clock.now += 5000;
    manager.registry.set('cutinMode', 'off');
    const n0 = manager.objs.length;
    let calls = 0;
    const h = cutin(cs, { name: '관우', skillName: '청룡참', key: 'cutin_guanyu', onImpact: () => calls++, onDone: () => calls++ });
    check(h.mode === 'off' && h.duration === 0 && !h.active && calls === 2 && manager.objs.length === n0, "registry.cutinMode 'off': 아무것도 안 만들고 콜백은 바로");
    manager.registry.set('cutinMode', 'short');
    const h2 = cutin(cs, { name: '관우', skillName: '청룡참', key: 'cutin_guanyu' });
    check(h2.mode === 'short' && h2.duration === 600, "registry.cutinMode 'short': 늘 0.6초");
    h2.cancel();
    manager.registry.set('cutinMode', undefined);
  }
  check(manager.canvasTex.some((k) => /^cutin_pnl_/.test(k)) && manager.canvasTex.some((k) => /^cutin_pnh_/.test(k)) && manager.canvasTex.includes('cutin_fade')
    && new Set(manager.canvasTex).size === manager.canvasTex.length, `그라데이션 캔버스 텍스처는 색마다 한 번만 만든다 (${manager.canvasTex.join(', ')})`);
  if (!hadEyes) manager.textures.delete('cutin_guanyu_eyes');
  manager.status.set('CutinTest', 'stopped');
  clock.now += 5000;
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
  // (3차 컷신) 히트스톱 = 컷신의 복귀 시각까지(눈 띠 있으면 1450ms, 없으면 1200ms) + 120ms 멈칫. 피해 연출(shake·flash·넉백 회전)은 복귀 순간에.
  {
    const tStop = scene.sim.time, t0 = clock.now;
    const h = hud.__cutin;
    const impact = h ? h.impactAt : 0;
    let zMax = scene.cameras.main.zoom;
    check(h && h.active && scene.pendingSkill && Math.abs(scene.hitStopUntil - (scene.pendingSkill.at)) < 1e-6 && impact === (manager.textures.has('cutin_guanyu_eyes') ? 1450 : 1200),
      `컷신이 뜨고 히트스톱이 복귀 시각까지 (${impact}ms)`);
    check(!scene.cameras.main.calls.slice(camCalls0).some((c) => c[0] === 'shake'), '발동 순간엔 shake·flash 없음(복귀 때 터진다)');
    check(scene.tryUseSkill() === false, '컷신 중엔 무장기를 또 못 건다');
    while (clock.now + 16.7 < t0 + impact - 60) { frame(scene, hud); zMax = Math.max(zMax, scene.cameras.main.zoom); }
    // 이 첫 무장기는 적이 멀어 맞는 유닛이 없다 → 묵힌 목록에 넉백 하나를 직접 넣어 「복귀 순간에 터진다」를 본다
    const victim = scene.sim.units.find((u) => u.side === 'right' && u.kind !== 'general');
    check(scene.sim.time === tStop && Array.isArray(scene.heldEvents), `컷신 동안 sim.time 그대로(${Math.round(tStop)}) · 뒤 이벤트는 묵힌다(${scene.heldEvents && scene.heldEvents.length}개)`);
    scene.heldEvents.push({ type: 'knockback', id: victim.id, dx: 60, dy: 0, ms: 250 });
    for (let i = 0; i < 2; i++) { frame(scene, hud); zMax = Math.max(zMax, scene.cameras.main.zoom); }
    check(!scene.spriteById.get(victim.id).kb, '묵힌 넉백은 컷신 중엔 안 터진다');
    for (let i = 0; i < 3; i++) { frame(scene, hud); zMax = Math.max(zMax, scene.cameras.main.zoom); }
    check(scene.cameras.main.calls.slice(camCalls0).some((c) => c[0] === 'shake' && c[1] === 350) && scene.cameras.main.calls.slice(camCalls0).some((c) => c[0] === 'flash') && !scene.pendingSkill && !scene.heldEvents,
      '복귀 순간: 카메라 shake 0.35초 + flash + 묵힌 이벤트 처리');
    check(!!scene.spriteById.get(victim.id).kb, '복귀 순간 묵힌 넉백 회전이 걸린다');
    check(scene.sim.time === tStop, '복귀 직후 120ms 멈칫(sim.time 그대로)');
    for (let i = 0; i < 12; i++) { frame(scene, hud); zMax = Math.max(zMax, scene.cameras.main.zoom); }
    check(scene.sim.time > tStop, '히트스톱 뒤 sim 진행');
    check(zMax > 1.22 && zMax <= 1.25, `줌 펀치 최대 ${zMax.toFixed(3)}`);
    for (let i = 0; i < 30; i++) frame(scene, hud);
    check(scene.cameras.main.zoom === 1.15, '펀치 뒤 줌 1.15 복귀');
    if (ART) {
      check(scene.fx.fxLive.length + scene.fx.fxPool.length === 60, `fx 풀 합 60 (살아 있는 것 ${scene.fx.fxLive.length})`);
    }
  }
  // (3차) 컷인 = cutin.js 다섯 박자 컷신. 주 일러스트는 본체 + 림 라이트 + 가산 복사본 3겹, 전부 패널 마스크 안
  const cutinObjs = manager.objs.filter((o) => o.kind === 'image' && o.texture.key === 'cutin_guanyu');
  check(cutinObjs.length === 3 && cutinObjs[0].height === 1216 && cutinObjs.every((o) => o.mask), `컷신 주 일러스트 3겹 생성(cutin_guanyu) + 패널 마스크 — ${cutinObjs.length}개`);
  check(!hud.__cutin && cutinObjs.every((o) => o.destroyed), '컷신이 끝나면 스스로 전부 destroy');
  await cutinChecks();
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
    if (scene.pendingSkill) {
      globalThis.__probe = globalThis.__probe || { cutscenes: 0, dyingDuring: 0, maxDying: 0, endedDuring: 0, last: null };
      const P = globalThis.__probe;
      if (P.last !== scene.pendingSkill) { P.last = scene.pendingSkill; P.cutscenes++; P.cur = 0; }
      let d = 0; for (const sp of scene.spriteById.values()) if (sp.dying && !sp.__seen) { sp.__seen = true; d++; }
      P.dyingDuring += d; P.cur += d; P.maxDying = Math.max(P.maxDying, P.cur);
      if (scene.ended) P.endedDuring++;
    } else { for (const sp of scene.spriteById.values()) if (sp.dying) sp.__seen = true; else sp.__seen = false; }
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
  console.log('PROBE', JSON.stringify({...globalThis.__probe, last: undefined}));
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
