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

// 1) 같은 프레임에 10회
{ const S = mkScene({ textures: ALL() }); const log = [];
  for (let i = 0; i < 10; i++) FX.cutin(S.scene, { name: '관우', skillName: '청룡참', key: 'cutin_guanyu', side: 'left', onImpact: (x) => log.push(['imp', i, x.canceled]), onDone: (x) => log.push(['done', i, x.canceled]) });
  const s = S.stats(); console.log('   같은 프레임 10회 직후', s);
  ok(s.upd === 1 && s.shut === 1 && s.masks === 1, '같은 프레임 10회: 리스너 update 1 · shutdown 1 · 마스크 1 만 살아 있다');
  ok(log.filter((l) => l[0] === 'imp' && l[2]).length === 9 && log.filter((l) => l[0] === 'done' && l[2]).length === 9, '앞 9개는 canceled 로 onImpact·onDone 한 번씩');
  stepTo(S, 2000); const e = S.stats(); console.log('   2초 뒤', e);
  ok(e.live === 0 && e.masks === 0 && e.upd === 0 && e.shut === 0 && !S.scene.__cutin, '끝난 뒤 오브젝트·마스크·리스너 0');
  ok(log.filter((l) => l[0] === 'imp').length === 10 && log.filter((l) => l[0] === 'done').length === 10, '콜백은 각각 정확히 10번(중복 없음)');
}
// 2) 300ms 간격 10회 + 끝까지
{ const S = mkScene({ textures: ALL() }); const modes = [];
  for (let i = 0; i < 10; i++) { const h = C.playCutin(S.scene, { name: '장비', skillName: '포효', key: 'guanyu', side: i % 2 ? 'right' : 'left' }); modes.push(h.mode + h.duration); stepTo(S, 300); }
  stepTo(S, 2000); const e = S.stats(); console.log('   300ms 간격 10회', modes.join(' '), e);
  ok(e.live === 0 && e.masks === 0 && e.upd === 0 && e.shut === 0, '300ms 간격 10회 뒤 누수 0');
}
// 3) 끝난 뒤 다시 × 10 (완주)
{ const S = mkScene({ textures: ALL() }); for (let i = 0; i < 10; i++) { C.playCutin(S.scene, { name: 'a', skillName: 'bcd', key: 'guanyu' }); stepTo(S, 4000); }
  const e = S.stats(); ok(e.live === 0 && e.masks === 0 && e.upd === 0 && e.shut === 0, `완주 10회 뒤 누수 0 (만든 것 ${e.created} · 마스크 ${e.maskCreated})`); }
// 4) 에셋 전무 + createCanvas 없음 + Canvas 렌더러
{ const S = mkScene({ textures: new Set(), canvas: false, rendererType: 1 }); let thrown = null, h = null;
  try { h = FX.cutin(S.scene, { name: '전위', skillName: '쌍극', key: null, color: 0x9cc0ff }); stepTo(S, 1200); } catch (e) { thrown = e; }
  const e = S.stats(); ok(!thrown && h && h.duration === 1100 && e.live === 0 && e.upd === 0, `에셋·캔버스 텍스처 전무: 예외 없이 ${h && h.duration}ms 에 끝`); }
// 5) opts 없이 / name 이 null
{ const S = mkScene({ textures: ALL() }); let thrown = null; const w = console.warn; const warns = []; console.warn = (...a) => warns.push(a.join(' '));
  try { FX.cutin(S.scene); stepTo(S, 2000); FX.cutin(S.scene, { name: null, skillName: null, key: 'cutin_guanyu' }); stepTo(S, 2000); } catch (e) { thrown = e; } console.warn = w;
  const e = S.stats(); ok(!thrown && e.live === 0 && e.upd === 0 && e.masks === 0, 'opts 없음·name null: 예외가 밖으로 안 나오고 누수 0' + (thrown ? ' — ' + thrown.message : '') + (warns.length ? ` (경고 ${warns.length}: ${warns[0].slice(0, 80)})` : '')); }
// 6) build 도중 예외(text 생성 실패)
{ const S = mkScene({ textures: ALL(), throwOn: 'text' }); let thrown = null, done = null; const w = console.warn; console.warn = () => {};
  try { FX.cutin(S.scene, { name: '관우', skillName: '청룡참', key: 'cutin_guanyu', onDone: (x) => { done = x; } }); } catch (e) { thrown = e; } console.warn = w;
  const e = S.stats(); ok(!thrown && e.live === 0 && e.masks === 0 && e.upd === 0 && e.shut === 0 && done && done.canceled, 'build 도중 예외: 만든 것 전부 걷고 onDone(canceled)'); }
// 7) shutdown 중간
{ const S = mkScene({ textures: ALL() }); C.playCutin(S.scene, { name: 'a', skillName: 'b', key: 'guanyu' }); stepTo(S, 500); S.ev.emit('shutdown'); const e = S.stats();
  ok(e.live === 0 && e.masks === 0 && e.upd === 0 && e.shut === 0, 'shutdown: 누수 0'); }
// 8) onDone 안에서 다시 playCutin(재진입)
{ const S = mkScene({ textures: ALL() }); let n = 0; let thrown = null;
  try { C.playCutin(S.scene, { name: 'a', skillName: 'b', key: 'guanyu', onDone: () => { if (n++ < 1) C.playCutin(S.scene, { name: 'c', skillName: 'd', key: 'guanyu' }); } }); stepTo(S, 4000); } catch (e) { thrown = e; }
  const e = S.stats(); ok(!thrown && e.live === 0 && e.upd === 0 && e.masks === 0, 'onDone 안에서 재호출: 누수 0'); }
// 9) 앞 컷신 cancel 의 콜백 안에서 재호출(cancel 재진입)
{ const S = mkScene({ textures: ALL() }); let n = 0; let thrown = null;
  try { C.playCutin(S.scene, { name: 'a', skillName: 'b', key: 'guanyu', onImpact: () => { if (n++ < 1) C.playCutin(S.scene, { name: 'x', skillName: 'y', key: 'guanyu' }); } });
    stepTo(S, 100); C.playCutin(S.scene, { name: 'e', skillName: 'f', key: 'guanyu' }); console.log('   재진입 직후', S.stats()); stepTo(S, 4000); } catch (e) { thrown = e; }
  const e = S.stats(); console.log('   재진입 끝', e); ok(!thrown && e.live === 0 && e.upd === 0 && e.masks === 0 && e.shut === 0, 'cancel 콜백 안 재진입: 누수 0'); }
console.log(fail ? `FAIL ${fail}` : 'ALL OK');
process.exit(fail ? 1 : 0);
