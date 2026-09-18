// 검수용: cutin.js 를 독립적인 최소 Phaser 흉내 위에서 연속 10회 호출 — 오브젝트·마스크·리스너 누수, 예외 경로, 에셋 없음 경로
import { pathToFileURL, fileURLToPath } from 'url';
import { join, normalize, dirname } from 'path';
const ROOT = normalize(join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..'));
globalThis.window = {};   // sfx.js get() 이 window.AudioContext 를 본다
globalThis.Phaser = { BlendModes: { ADD: 1 }, CANVAS: 1, WEBGL: 2 };
const C = await import(pathToFileURL(join(ROOT, 'src/battle/cutin.js')).href);
const FX = await import(pathToFileURL(join(ROOT, 'src/battle/fx.js')).href);

function mkScene({ textures = new Set(), canvas = true, rendererType = 2, throwOn = null } = {}) {
  const live = new Set(); const masks = new Set(); let created = 0, maskCreated = 0;
  const listeners = new Map();
  const ev = {
    on(k, f) { (listeners.get(k) || listeners.set(k, []).get(k)).push({ f, once: false }); },
    once(k, f) { (listeners.get(k) || listeners.set(k, []).get(k)).push({ f, once: true }); },
    off(k, f) { const a = listeners.get(k) || []; const i = a.findIndex((l) => l.f === f); if (i >= 0) a.splice(i, 1); },
    emit(k, ...args) { for (const l of [...(listeners.get(k) || [])]) { if (l.once) ev.off(k, l.f); l.f(...args); } },
    count(k) { return (listeners.get(k) || []).length; },
  };
  const fakeCtx = () => new Proxy({}, { get: (t, p) => (p === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {}), set: () => true });
  const mkObj = (kind, key) => {
    if (throwOn === kind) throw new Error('boom ' + kind);
    created++;
    const big = key === 'cutin_guanyu', eyes = !!(key && /_eyes$/.test(key));
    const o = { kind, key, width: big ? 1248 : eyes ? 1024 : 100, height: big ? 1824 : eyes ? 256 : 100,
      scaleX: 1, scaleY: 1, x: 0, y: 0, alpha: 1, visible: true, angle: 0, mask: null, destroyed: false, context: kind === 'text' ? fakeCtx() : undefined };
    let p = null;
    o.destroy = () => { o.destroyed = true; live.delete(p); };
    o.setMask = (m) => { o.mask = m; return p; };
    o.clearMask = () => { o.mask = null; return p; };
    o.createGeometryMask = () => { maskCreated++; const m = { destroy() { masks.delete(m); } }; masks.add(m); return m; };
    o.setScale = (a, b) => { o.scaleX = a; o.scaleY = b === undefined ? a : b; return p; };
    o.setDisplaySize = (w, h) => { o.scaleX = w / o.width; o.scaleY = h / o.height; return p; };
    p = new Proxy(o, { get: (t, k) => (k in t ? t[k] : (typeof k === 'string' ? () => p : undefined)) });
    live.add(p);
    return p;
  };
  const scene = {
    scale: { width: 1558, height: 720 }, time: { now: 1000 }, events: ev,
    registry: { m: new Map(), get(k) { return this.m.get(k); }, set(k, v) { this.m.set(k, v); } },
    textures: { exists: (k) => textures.has(k), ...(canvas ? { createCanvas: (k) => { textures.add(k); return { context: fakeCtx(), refresh() {} }; } } : {}) },
    sys: { game: { renderer: { type: rendererType } } },
    add: { image: (x, y, k) => mkObj('image', k), rectangle: () => mkObj('rect'), graphics: () => mkObj('graphics'), text: () => mkObj('text') },
    tweens: { add() { throw new Error('tween 금지'); } },
  };
  return { scene, live, masks, ev, stats: () => ({ live: live.size, masks: masks.size, upd: ev.count('update'), shut: ev.count('shutdown'), created, maskCreated }) };
}
let fail = 0; const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fail++; };
const stepTo = (S, ms) => { const end = S.scene.time.now + ms; while (S.scene.time.now < end) { S.scene.time.now += 16.7; S.ev.emit('update', S.scene.time.now, 16.7); } };
const ALL = () => new Set(['cutin_guanyu', 'cutin_guanyu_eyes', 'fx_speedlines', 'fx_spark', 'spark']);

// A) 자연 진행 중 onImpact(복귀 시각) 안에서 새 컷신 — 겹치지 않고, 누수 없고, 예외 없음
{ const S = mkScene({ textures: ALL() }); let thrown = null; const w = console.warn; const warns = []; console.warn = (...a) => warns.push(a.join(' '));
  let inner = null; const log = [];
  try { C.playCutin(S.scene, { name: 'a', skillName: 'b', key: 'guanyu', onImpact: (x) => { log.push(['imp', x.canceled]); inner = C.playCutin(S.scene, { name: 'c', skillName: 'd', key: 'guanyu' }); }, onDone: (x) => log.push(['done', x.canceled]) });
    stepTo(S, 1500); console.log('   A 직후', S.stats(), 'inner', inner && inner.mode, inner && inner.active, JSON.stringify(log)); stepTo(S, 3000); } catch (e) { thrown = e; } console.warn = w;
  const e = S.stats(); ok(!thrown && inner && inner.mode === 'short' && e.live === 0 && e.upd === 0 && e.masks === 0 && e.shut === 0, 'A 자연 onImpact 안 재호출: 짧은 버전 1개만, 누수 0' + (warns.length ? ` (경고 ${warns.length}: ${warns[0].slice(0, 100)})` : '')); }
// B) cancel 콜백이 예외를 던져도 표식이 풀린다 → 다음 컷신은 정상
{ const S = mkScene({ textures: ALL() }); const w = console.warn; console.warn = () => {};
  C.playCutin(S.scene, { name: 'a', skillName: 'b', key: 'guanyu', onDone: () => { throw new Error('cb boom'); } }); stepTo(S, 100);
  const h2 = C.playCutin(S.scene, { name: 'e', skillName: 'f', key: 'guanyu' }); console.warn = w;
  ok(S.scene.__cutinCanceling === false && h2.active && S.stats().upd === 1, 'B 콜백 예외 뒤 표식 해제 · 새 컷신 정상'); stepTo(S, 3000);
  const e = S.stats(); ok(e.live === 0 && e.upd === 0 && e.masks === 0, 'B 누수 0'); }
// C) shutdown 콜백 안 재호출 → 안 뜬다
{ const S = mkScene({ textures: ALL() }); let inner = null;
  C.playCutin(S.scene, { name: 'a', skillName: 'b', key: 'guanyu', onDone: () => { inner = C.playCutin(S.scene, { name: 'x', skillName: 'y', key: 'guanyu' }); } }); stepTo(S, 300); S.ev.emit('shutdown');
  const e = S.stats(); ok(inner && inner.mode === 'off' && !inner.active && e.live === 0 && e.upd === 0 && e.shut === 0 && S.scene.__cutinCanceling !== true, 'C shutdown 콜백 안 재호출은 안 뜬다 · 표식 원복'); }
// D) 숫자 name · 긴 skillName(이모지 포함) · color 없음 · side 이상값
{ const S = mkScene({ textures: ALL() }); let thrown = null;
  try { FX.cutin(S.scene, { name: 123, skillName: '가나다라마바사😀', key: 'cutin_nobody', side: 'up', color: undefined }); stepTo(S, 3000); } catch (e) { thrown = e; }
  const e = S.stats(); ok(!thrown && e.live === 0, 'D 이상한 인자: 예외 없음·누수 0' + (thrown ? ' — ' + thrown.message : '')); }
// E) mode 'off' 10회 — 아무것도 안 만든다
{ const S = mkScene({ textures: ALL() }); let n = 0; for (let i = 0; i < 10; i++) FX.cutin(S.scene, { name: 'a', skillName: 'b', key: 'cutin_guanyu', mode: 'off', onDone: () => n++ });
  const e = S.stats(); ok(e.created === 0 && n === 10 && e.upd === 0, 'E off 10회: 생성 0 · onDone 10'); }
console.log(fail ? `FAIL ${fail}` : 'ALL OK');
process.exit(fail ? 1 : 0);
