#!/usr/bin/env node
// dump_frames.mjs — 브라우저 없이 컷신 프레임을 「눈으로」 보기 위한 덤프 (개발용).
//   진짜 src/battle/cutin.js 를 Phaser 흉내(의미가 맞는 setDisplaySize·setScale·origin·crop·mask 기록) 위에서 돌려
//   시각 t 마다 모든 오브젝트의 상태를 JSON 으로 떨군다 → mock_frames.py 가 Pillow 로 합성한다.
//   usage: node dump_frames.mjs [W=1558] > frames.json
import { pathToFileURL, fileURLToPath } from 'node:url';
import { join, normalize } from 'node:path';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';

const ROOT = normalize(join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..', '..'));
const W = Number(process.argv[2]) || 1558, H = 720;

function pngSize(rel) {
  const p = join(ROOT, 'assets', rel);
  if (!existsSync(p)) return null;
  const b = readFileSync(p);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}
const TEX = new Map();   // key → { w, h, file?, grad? }
for (const k of ['guanyu', 'zhangfei', 'xiahoudun', 'dianwei']) {
  const s = pngSize(`battle/cutin/${k}.png`);
  if (s) TEX.set(`cutin_${k}`, { w: s[0], h: s[1], file: `battle/cutin/${k}.png` });
  const e = pngSize(`battle/cutin/${k}_eyes.png`);
  TEX.set(`cutin_${k}_eyes`, { w: 1024, h: 256, file: e ? `battle/cutin/${k}_eyes.png` : null, eyesOf: `battle/cutin/${k}.png` });
}
{ const s = pngSize('battle/fx/speedlines.png'); if (s) TEX.set('fx_speedlines', { w: s[0], h: s[1], file: 'battle/fx/speedlines.png' }); }
{ const s = pngSize('battle/fx/spark.png'); if (s) TEX.set('fx_spark', { w: s[0], h: s[1], file: 'battle/fx/spark.png' }); }

let all = [];
function mk(kind, props = {}) {
  const o = {
    kind, x: 0, y: 0, alpha: 1, angle: 0, scaleX: 1, scaleY: 1, originX: 0.5, originY: 0.5, visible: true, depth: 0,
    flipX: false, flipY: false, blend: 0, tint: null, tintFill: false, mask: null, crop: null, cmds: [], width: 0, height: 0, destroyed: false, ...props,
  };
  const ch = (fn) => (...a) => { fn(...a); return o; };
  Object.assign(o, {
    setScrollFactor: ch(() => {}), setDepth: ch((d) => { o.depth = d; }), setAlpha: ch((a) => { o.alpha = a; }), setAngle: ch((a) => { o.angle = a; }),
    setVisible: ch((v) => { o.visible = v; }), setOrigin: ch((x, y = x) => { o.originX = x; o.originY = y; }), setFlipX: ch((v) => { o.flipX = !!v; }),
    setFlipY: ch((v) => { o.flipY = !!v; }), setBlendMode: ch((b) => { o.blend = b; }), setTint: ch((c) => { o.tint = c; o.tintFill = false; }),
    setTintFill: ch((c) => { o.tint = c; o.tintFill = true; }), setMask: ch((m) => { o.mask = m; }), clearMask: ch(() => { o.mask = null; }),
    setScale: ch((a, b = a) => { o.scaleX = a; o.scaleY = b; }), setPosition: ch((x, y) => { o.x = x; o.y = y; }),
    setDisplaySize: ch((w, h) => { o.scaleX = w / o.width; o.scaleY = h / o.height; }), setCrop: ch((x, y, w, h) => { o.crop = [x, y, w, h]; }),
    setPadding: ch(() => {}), setShadow: ch(() => {}), setFill: ch((g) => { o.fill = g; }), destroy: ch(() => { o.destroyed = true; }),
    fillStyle: ch((c, a = 1) => { o._fs = [c, a]; }), fillRect: ch((x, y, w, h) => { o.cmds.push(['rect', ...o._fs, x, y, w, h]); }),
    fillEllipse: ch((x, y, w, h) => { o.cmds.push(['ellipse', ...o._fs, x, y, w, h]); }), fillCircle: ch((x, y, r) => { o.cmds.push(['ellipse', ...o._fs, x, y, r * 2, r * 2]); }),
    createGeometryMask: () => ({ isMask: true, g: o, destroy() {} }),
  });
  all.push(o);
  return o;
}
const grads = {};
function fakeCanvas(key, w, h) {
  const rec = { w, h, stops: [], dir: null };
  grads[key] = rec;
  const ctx = {
    createLinearGradient: (x0, y0, x1, y1) => { rec.dir = [x0, y0, x1, y1]; return { addColorStop: (o, c) => rec.stops.push([o, c]) }; },
    fillRect() {}, set fillStyle(v) {},
  };
  TEX.set(key, { w, h, grad: key });
  return { context: ctx, refresh() {} };
}

globalThis.window = globalThis;
globalThis.Phaser = { CANVAS: 1, WEBGL: 2, BlendModes: { ADD: 1 } };
const listeners = { update: [], shutdown: [] };
const clock = { now: 10000 };
const registry = new Map();
const scene = {
  scale: { width: W, height: H },
  time: { get now() { return clock.now; } },
  registry: { get: (k) => registry.get(k), set: (k, v) => registry.set(k, v) },
  textures: { exists: (k) => TEX.has(k) && (TEX.get(k).file !== null || TEX.get(k).eyesOf != null || TEX.get(k).grad), createCanvas: fakeCanvas },
  sys: { game: { renderer: { type: 2 } } },
  events: {
    on: (ev, fn) => { listeners[ev].push(fn); }, once: (ev, fn) => { listeners[ev].push(fn); },
    off: (ev, fn) => { listeners[ev] = listeners[ev].filter((f) => f !== fn); },
  },
  add: {
    rectangle: (x, y, w, h, c, a) => mk('rect', { x, y, width: w, height: h, color: c, fillAlpha: a }),
    image: (x, y, key) => { const t = TEX.get(key) || { w: 64, h: 64 }; return mk('image', { x, y, key, width: t.w, height: t.h }); },
    graphics: () => mk('graphics'),
    text: (x, y, text, style) => {
      const fs = parseInt(style.fontSize, 10);
      const o = mk('text', { x, y, text, fontSize: fs, color: style.color, stroke: style.stroke, strokeThickness: style.strokeThickness, width: fs * 0.95 * Array.from(text).length + 36, height: fs * 1.25 + 36 });
      o.context = { createLinearGradient: (x0, y0, x1, y1) => { const g = { grad: true, y0, y1, stops: [], addColorStop(p, c) { this.stops.push([p, c]); } }; return g; } };
      return o;
    },
  },
};

const C = await import(pathToFileURL(join(ROOT, 'src/battle/cutin.js')).href);

const SHOTS = [
  { id: 'L_0120_eyes',  opts: { name: '관우', skillName: '청룡참', key: 'cutin_guanyu', side: 'left' }, t: 120 },
  { id: 'L_0330_open',  opts: { name: '관우', skillName: '청룡참', key: 'cutin_guanyu', side: 'left' }, t: 330 },
  { id: 'L_0520_slide', opts: { name: '관우', skillName: '청룡참', key: 'cutin_guanyu', side: 'left' }, t: 520 },
  { id: 'L_1000_hold',  opts: { name: '관우', skillName: '청룡참', key: 'cutin_guanyu', side: 'left' }, t: 1000 },
  { id: 'L_1225_fire',  opts: { name: '관우', skillName: '청룡참', key: 'cutin_guanyu', side: 'left' }, t: 1225 },
  { id: 'L_1330_split', opts: { name: '관우', skillName: '청룡참', key: 'cutin_guanyu', side: 'left' }, t: 1330 },
  { id: 'L_1500_out',   opts: { name: '관우', skillName: '청룡참', key: 'cutin_guanyu', side: 'left' }, t: 1500 },
  { id: 'R_1000_hold',  opts: { name: '하후돈', skillName: '맹공', key: 'cutin_xiahoudun', side: 'right', color: 0x9cc0ff }, t: 1000 },
  { id: 'Z_1000_hold',  opts: { name: '장비', skillName: '포효', key: 'cutin_zhangfei', side: 'left' }, t: 1000 },
  { id: 'D_1000_hold',  opts: { name: '전위', skillName: '쌍극', key: 'cutin_dianwei', side: 'right', color: 0x9cc0ff }, t: 1000 },
  { id: 'T_0600_text',  opts: { name: '조운', skillName: '용담', key: 'cutin_nobody', side: 'left' }, t: 600 },
  { id: 'S_0300_short', opts: { name: '관우', skillName: '청룡참', key: 'cutin_guanyu', side: 'left', mode: 'short' }, t: 300 },
];

const out = { W, H, tex: null, grads, shots: [] };
for (const s of SHOTS) {
  all = [];
  listeners.update = []; listeners.shutdown = [];
  registry.delete('cutinBusyUntil');
  clock.now += 10000;
  const t0 = clock.now;
  const h = C.playCutin(scene, s.opts);
  // 프레임을 밟아 간다(효과음·찍힘 플래그가 순서대로 서게)
  for (let t = 0; t <= s.t; t += 16.7) { clock.now = t0 + t; for (const fn of [...listeners.update]) fn(clock.now, 16.7); }
  clock.now = t0 + s.t; for (const fn of [...listeners.update]) fn(clock.now, 0);
  const objs = all.filter((o) => !o.destroyed).map((o) => {
    const { kind, x, y, alpha, angle, scaleX, scaleY, originX, originY, visible, depth, flipX, flipY, blend, tint, tintFill, crop, cmds, width, height, key, color, fillAlpha, text, fontSize, stroke, strokeThickness } = o;
    return { kind, x, y, alpha, angle, scaleX, scaleY, originX, originY, visible, depth, flipX, flipY, blend, tint, tintFill, crop, cmds, width, height, key, color, fillAlpha, text, fontSize, stroke, strokeThickness,
      textColor: o.kind === 'text' ? o.color : undefined, fill: o.fill && o.fill.grad ? o.fill : null,
      mask: o.mask ? { x: o.mask.g.x, y: o.mask.g.y, angle: o.mask.g.angle, scaleX: o.mask.g.scaleX, scaleY: o.mask.g.scaleY, cmds: o.mask.g.cmds } : null };
  });
  out.shots.push({ id: s.id, t: s.t, mode: h.mode, duration: h.duration, objs });
  h.cancel();
}
out.tex = Object.fromEntries(TEX);   // 캔버스 텍스처는 재생 중에 생긴다 → 마지막에
writeFileSync(join(ROOT, 'assets/raw/battle3/cutscene/frames.json'), JSON.stringify(out));
console.log(`frames.json — ${out.shots.length} 장면, W=${W}`);
