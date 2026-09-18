#!/usr/bin/env node
// 군영전 스모크 테스트 — 브라우저 없이 확인할 수 있는 것만 확인한다.
//
//   node tools/smoke.mjs
//
// 1) 에셋 계약(SPEC §3): 파일 존재·크기 (PNG IHDR / JPEG SOF 헤더를 직접 읽는다 — 의존성 없음)
// 2) BootScene.ASSETS ↔ 계약 파일 대조 (키·경로·크기, 빠진 계약 파일 없음)
// 3) src/·tools/ 의 모든 .js/.mjs → node --check
// 4) window/Phaser 를 스텁으로 두고 src/ 각 모듈을 실제 import (문법·import 그래프·최상위 실행)
// 5) 데이터·배치 제약: 도시 46·세력 배정 42, UI 문구의 한글/한자가 폰트 표본에 있는지, 9-slice 2×corner ≤ 변
//
// 브라우저에서 실제로 그려지는 모습은 검사하지 못한다 — docs/HANDOFF.md 의 「브라우저에서 꼭 확인할 지점」 참고.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, normalize, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = normalize(join(fileURLToPath(new URL('.', import.meta.url)), '..'));
const ASSET_DIR = join(ROOT, 'assets');

let fails = 0, passes = 0;
const ok = (msg) => { passes++; console.log(`  ok   ${msg}`); };
const bad = (msg) => { fails++; console.log(`  FAIL ${msg}`); };
const check = (cond, msg) => (cond ? ok(msg) : bad(msg));
const section = (t) => console.log(`\n== ${t}`);

// ─────────────────────────────────────────────────────────────
// 이미지 헤더에서 크기 읽기
// ─────────────────────────────────────────────────────────────

function imageSize(buf) {
  // PNG
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), fmt: 'png', alpha: buf[25] === 6 || buf[25] === 4 };
  }
  // JPEG — SOFn 마커까지 건너뛴다
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const m = buf[i + 1];
      if (m === 0xff) { i++; continue; }
      const sof = m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc;
      if (sof) return { w: buf.readUInt16BE(i + 7), h: buf.readUInt16BE(i + 5), fmt: 'jpg', alpha: false };
      if (m === 0xd8 || (m >= 0xd0 && m <= 0xd7) || m === 0x01) { i += 2; continue; }
      i += 2 + buf.readUInt16BE(i + 2);
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// 1) 에셋 계약 (SPEC §3)
// ─────────────────────────────────────────────────────────────

/** [경로, 폭, 높이, 최대변(있으면 크기 대신 ≤ 검사), 알파 필요] */
const CONTRACT = [
  ['map/map.jpg', 2000, 1560, null, false],
  ['map/clouds.png', 1024, 512, null, true],
  ['ui/panel.png', 384, 384, null, true],
  ['ui/parchment.png', 256, 256, null, false],
  ['ui/button.png', 256, 96, null, true],
  ['ui/button_down.png', 256, 96, null, true],
  ['ui/hud_bar.png', 1280, 72, null, true],
  ['ui/banner.png', 512, 128, null, true],
  ['ui/castle_1.png', null, null, 160, true],
  ['ui/castle_2.png', null, null, 160, true],
  ['ui/castle_3.png', null, null, 160, true],
  ['ui/flag.png', 64, 96, null, true],
  ['ui/army.png', 96, 96, null, true],
  ['ui/portrait_placeholder.png', 96, 120, null, false],
  ...['gold', 'food', 'troops', 'officer', 'calendar', 'cmd_domestic', 'cmd_military', 'cmd_personnel', 'cmd_scheme', 'cmd_diplomacy', 'cmd_march']
    .map((n) => [`icons/${n}.png`, 64, 64, null, true]),
];

section('1) 에셋 계약 파일 존재·크기');
const actualSize = new Map();
for (const [rel, w, h, maxSide, needAlpha] of CONTRACT) {
  const p = join(ASSET_DIR, rel);
  if (!existsSync(p)) { bad(`${rel} 없음`); continue; }
  const info = imageSize(readFileSync(p));
  if (!info) { bad(`${rel} 이미지 헤더를 못 읽음`); continue; }
  actualSize.set(rel, info);
  const expectExt = rel.endsWith('.jpg') ? 'jpg' : 'png';
  if (info.fmt !== expectExt) { bad(`${rel} 형식 ${info.fmt} (확장자와 다름)`); continue; }
  if (needAlpha && !info.alpha) { bad(`${rel} 알파 채널 없음`); continue; }
  if (maxSide != null) {
    check(info.w <= maxSide && info.h <= maxSide, `${rel} ${info.w}×${info.h} ≤ ${maxSide}`);
  } else {
    check(info.w === w && info.h === h, `${rel} ${info.w}×${info.h}${info.w === w && info.h === h ? '' : ` (계약 ${w}×${h})`}`);
  }
}
// 2의 거듭제곱: WebGL tileSprite 가 REPEAT 하려면 필수
{
  const c = actualSize.get('map/clouds.png');
  const pot = (n) => (n & (n - 1)) === 0;
  if (c) check(pot(c.w) && pot(c.h), `clouds.png ${c.w}×${c.h} 는 2의 거듭제곱 (tileSprite REPEAT)`);
}

// ─────────────────────────────────────────────────────────────
// 3) node --check
// ─────────────────────────────────────────────────────────────

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(m?js)$/.test(e)) out.push(p);
  }
  return out;
}

section('3) node --check');
const jsFiles = [...walk(join(ROOT, 'src')), ...walk(join(ROOT, 'tools'))];
for (const f of jsFiles) {
  const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
  check(r.status === 0, `${relative(ROOT, f)}${r.status === 0 ? '' : `\n${r.stderr}`}`);
}

// ─────────────────────────────────────────────────────────────
// 4) Phaser·window 스텁 + import
// ─────────────────────────────────────────────────────────────

section('4) 스텁 import');
class Scene { constructor(key) { this.sceneKey = key; } }
globalThis.Phaser = {
  AUTO: 0, CANVAS: 1, WEBGL: 2,
  Scene,
  Game: class { constructor(cfg) { this.config = cfg; this.renderer = { snapshot() {} }; } },
  Scale: { FIT: 'FIT', CENTER_BOTH: 'CENTER_BOTH' },
  BlendModes: { ADD: 1 },
  Geom: { Rectangle: class { static Contains() { return false; } } },
  Math: {
    Clamp: (v, a, b) => Math.min(b, Math.max(a, v)),
    Linear: (a, b, t) => a + (b - a) * t,
    Distance: { Between: (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1) },
  },
  Scenes: { Events: { SHUTDOWN: 'shutdown' } },
};
globalThis.window = globalThis;
globalThis.addEventListener = () => {};

const mods = {};
for (const rel of ['src/data/cities.js', 'src/data/factions.js', 'src/sfx.js', 'src/scenes/BootScene.js', 'src/scenes/MapScene.js', 'src/scenes/UIScene.js', 'src/main.js']) {
  try {
    mods[rel] = await import(pathToFileURL(join(ROOT, rel)).href);
    ok(`import ${rel}`);
  } catch (e) {
    bad(`import ${rel}: ${e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e}`);
  }
}

const cities = mods['src/data/cities.js'];
const factions = mods['src/data/factions.js'];
const boot = mods['src/scenes/BootScene.js'];
const map = mods['src/scenes/MapScene.js'];
const ui = mods['src/scenes/UIScene.js'];
const main = mods['src/main.js'];

check(boot && typeof boot.default === 'function' && boot.default.prototype instanceof Scene, 'BootScene default export 는 Phaser.Scene 서브클래스');
check(map && typeof map.default === 'function' && map.default.prototype instanceof Scene, 'MapScene default export 는 Phaser.Scene 서브클래스');
check(ui && typeof ui.default === 'function' && ui.default.prototype instanceof Scene, 'UIScene default export 는 Phaser.Scene 서브클래스');
check(main && main.GAME_H === 720 && main.GAME_W >= 1280 && main.GAME_W <= 1600, 'main.js 논리 해상도 세로 720 · 가로 1280~1600(창 비율)');
check(globalThis.__game && globalThis.__game.config && globalThis.__game.config.scene.length === 3, 'main.js 가 Phaser.Game 을 씬 3개로 만든다');

// ─────────────────────────────────────────────────────────────
// 2) BootScene.ASSETS ↔ 계약
// ─────────────────────────────────────────────────────────────

section('2) BootScene.ASSETS ↔ 에셋 파일');
if (boot && Array.isArray(boot.ASSETS)) {
  const seen = new Set();
  for (const [key, rel, w, h] of boot.ASSETS) {
    seen.add(rel);
    const info = actualSize.get(rel);
    if (!info) { bad(`ASSETS '${key}' → ${rel}: 계약에 없는 경로거나 파일 없음`); continue; }
    check(info.w === w && info.h === h, `'${key}' ${rel} 코드 ${w}×${h} = 파일 ${info.w}×${info.h}`);
  }
  for (const [rel] of CONTRACT) if (!seen.has(rel)) bad(`계약 파일 ${rel} 을 BootScene.ASSETS 가 로드하지 않음`);
  const keys = boot.ASSETS.map((a) => a[0]);
  check(new Set(keys).size === keys.length, 'ASSETS 키 중복 없음');
} else {
  bad('BootScene.ASSETS 를 못 읽음');
}

// ─────────────────────────────────────────────────────────────
// 5) 데이터·문구·배치 제약
// ─────────────────────────────────────────────────────────────

section('5) 데이터');
if (cities) {
  const C = cities.CITIES;
  check(C.length === 46, `도시 ${C.length}개`);
  check(C.every((c, i) => c.id === i), '도시 id 가 0..45 순서(MapScene 가 id 로 찾는다)');
  check(C.every((c) => c.x >= 0 && c.x <= 1000 && c.y >= 0 && c.y <= 780), '도시 좌표가 1000×780 안');
  check(C.every((c) => c.size >= 1 && c.size <= 5 && c.name && c.hanja), '도시 size 1~5·이름·한자 있음');
  const ids = new Set(C.map((c) => c.id));
  check(cities.ROUTES.every(([a, b]) => ids.has(a) && ids.has(b)), 'ROUTES 가 존재하는 도시만 잇는다');
}
if (factions && cities) {
  const all = factions.FACTIONS.flatMap((f) => f.cities);
  check(new Set(all).size === all.length, '세력 도시 배정 중복 없음');
  check(all.length === 42, `세력 배정 ${all.length}개 (무주 ${46 - all.length})`);
  check(factions.FACTIONS.some((f) => f.id === factions.PLAYER_ID), `플레이어 세력 '${factions.PLAYER_ID}' 존재`);
  check(factions.FACTIONS.every((f) => /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(f.color)), '세력색 hex');
  // 행군 경로(성도→재동→한중→장안)가 실제 ROUTES 로 이어져 있는가
  const adj = cities.ADJ;
  const path = [26, 25, 24, 19];
  check(path.every((id, i) => i === 0 || adj[path[i - 1]].some((e) => e.to === id)), '행군 데모 경로 26→25→24→19 가 ROUTES 로 이어짐');
}

section('5) 폰트 표본 — UI 문구의 글자가 KOREAN_SAMPLE / HANJA_SAMPLE 에 있는가');
if (factions) {
  const ko = new Set(factions.KOREAN_SAMPLE);
  const hj = new Set(factions.HANJA_SAMPLE);
  // BootScene 은 화면에 글자를 안 그린다(console.warn 뿐) → 대상은 텍스트를 만드는 두 씬
  for (const rel of ['src/scenes/UIScene.js', 'src/scenes/MapScene.js']) {
    let src = readFileSync(join(ROOT, rel), 'utf8');
    src = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
    const lits = [...src.matchAll(/(['"`])((?:\\.|(?!\1)[^\\\n])*)\1/g)].map((m) => m[2]).join('');
    const missKo = [...new Set(lits.match(/[가-힣]/g) || [])].filter((ch) => !ko.has(ch));
    const missHj = [...new Set(lits.match(/[一-鿿]/g) || [])].filter((ch) => !hj.has(ch));
    check(missKo.length === 0, `${rel} 한글 ${missKo.length ? `빠짐: ${missKo.join('')}` : '전부 표본에 있음'}`);
    check(missHj.length === 0, `${rel} 한자 ${missHj.length ? `빠짐: ${missHj.join('')}` : '전부 표본에 있음'}`);
  }
}

section('5) 9-slice 배치 제약 (UIScene.LAYOUT)');
if (ui && ui.LAYOUT) {
  const L = ui.LAYOUT;
  const DESIGN = { panel: 48, parchment: 24, button: 32 };   // 그림이 가진 모서리 장식 크기
  const nine = (name, w, h, corner, design) => {
    check(corner <= design, `${name} corner ${corner} ≤ 그림 모서리 ${design}`);
    check(corner * 2 <= Math.min(w, h), `${name} ${w}×${h}: 2×${corner} ≤ 짧은 변`);
  };
  nine('panel', L.panel.w, L.panel.h, L.panel.corner, DESIGN.panel);
  nine('parchment', L.parchment.w, L.parchment.h, L.parchment.corner, DESIGN.parchment);
  nine('toast(parchment)', L.toast.w, L.toast.h, L.toast.corner, DESIGN.parchment);
  nine('button', L.button.w, L.button.h, L.button.corner, DESIGN.button);
  const barW = 6 * L.button.w + 5 * L.button.gap + 36;
  nine('command bar(panel)', barW, L.bar.h, L.bar.corner, DESIGN.panel);
  check(L.button.h + 8 <= L.bar.h, '버튼이 커맨드 바 안에 들어감');
  check(barW + 16 <= 1280, `커맨드 바 폭 ${barW} 이 화면 안`);
  check(L.parchment.w <= L.panel.w - 60 && L.parchment.h <= L.panel.h - 60, '한지가 창틀(두께≈30) 안쪽에 들어감');
  const h = L.hud;
  check(h.dateX - h.icon / 2 >= h.safeX[0], `HUD 달력 아이콘이 왼쪽 메달리온(x<${h.safeX[0]}) 을 피함`);
  check(h.resX + 3 * h.resStep + 150 <= h.playerX - 20, 'HUD 자원 4칸이 플레이어 표식 앞에서 끝남');
  check(h.playerX + 20 + 100 <= h.safeX[1], `HUD 플레이어 표식이 오른쪽 메달리온(x>${h.safeX[1]}) 을 피함`);
  check(h.icon === 28, 'HUD 아이콘 28px');
}

// ─────────────────────────────────────────────────────────────

console.log(`\n${fails === 0 ? 'PASS' : 'FAIL'} — ${passes} ok, ${fails} fail`);
process.exit(fails === 0 ? 0 : 1);
