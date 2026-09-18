// BootScene.makeBattle2Fallbacks 를 가짜 캔버스 컨텍스트로 굴려 본다(오타·예외 잡기용 — 그림은 못 본다)
import { pathToFileURL } from 'node:url';
import { join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = normalize(join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..'));
globalThis.window = globalThis;
globalThis.Phaser = { Scene: class { constructor(k) { this.key = k; } }, Scenes: { Events: { SHUTDOWN: 'shutdown' } }, Scale: { Events: { RESIZE: 'resize' } } };
const { default: BootScene, BATTLE2_ASSETS } = await import(pathToFileURL(join(ROOT, 'src/scenes/BootScene.js')).href);
const made = new Map();
const calls = { n: 0 };
const ctx = () => new Proxy({}, {
  get: (t, k) => (k in t ? t[k] : (...a) => { calls.n++; return new Proxy({}, { get: () => () => {} }); }),
  set: (t, k, v) => { t[k] = v; return true; },
});
const s = new BootScene();
s.textures = {
  exists: (k) => made.has(k),
  createCanvas: (k, w, h) => { const t = { key: k, width: w, height: h, context: ctx(), refresh() { this.refreshed = true; } }; made.set(k, t); return t; },
};
s.makeBattle2Fallbacks();
const want = { battle_vignette: [256, 144], battle_shade: [4, 64] };
for (const [key, , w, h] of BATTLE2_ASSETS) if (/^(fx_|field_(fog|flag_|blood1|crater))/.test(key)) want[key] = [w, h];
let bad = 0;
for (const [k, [w, h]] of Object.entries(want)) {
  const t = made.get(k);
  if (k === 'field_blood2') continue;
  if (!t || t.width !== w || t.height !== h || !t.refreshed) { bad++; console.log('FAIL', k, t && [t.width, t.height]); }
}
console.log(bad ? 'FAIL' : 'PASS', '— 자리표시', made.size, '개:', [...made.keys()].join(', '), '/ 컨텍스트 호출', calls.n);
// 다 있으면 아무것도 안 만든다
const made2 = new Set(BATTLE2_ASSETS.map((a) => a[0]).concat(['battle_vignette', 'battle_shade']));
let created = 0;
s.textures = { exists: (k) => made2.has(k), createCanvas: () => { created++; throw new Error('should not create'); } };
s.makeBattle2Fallbacks();
console.log(created === 0 ? 'PASS' : 'FAIL', '— 그림이 다 있으면 자리표시를 안 만든다');
process.exit(bad || created ? 1 : 0);
