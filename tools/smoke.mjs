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
  Scale: { FIT: 'FIT', CENTER_BOTH: 'CENTER_BOTH', Events: { RESIZE: 'resize' } },
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
// 전투(BATTLE.md §2): data.js·sim.js 는 다른 작업에서 오므로 있을 때만 import 한다. 화면 3파일과 더미 sim 은 항상.
const BATTLE_OPTIONAL = ['src/battle/data.js', 'src/battle/sim.js'].filter((rel) => existsSync(join(ROOT, rel)));
const IMPORTS = [
  'src/data/cities.js', 'src/data/factions.js', 'src/sfx.js', 'src/scenes/BootScene.js', 'src/scenes/MapScene.js', 'src/scenes/UIScene.js',
  'src/battle/fx.js', 'src/battle/cutin.js', 'src/battle/BattleScene.js', 'src/battle/BattleHud.js', 'assets/raw/battle/sim-stub.mjs', ...BATTLE_OPTIONAL,
  'src/main.js',
];
for (const rel of IMPORTS) {
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
const battle = mods['src/battle/BattleScene.js'];
const hud = mods['src/battle/BattleHud.js'];

check(boot && typeof boot.default === 'function' && boot.default.prototype instanceof Scene, 'BootScene default export 는 Phaser.Scene 서브클래스');
check(map && typeof map.default === 'function' && map.default.prototype instanceof Scene, 'MapScene default export 는 Phaser.Scene 서브클래스');
check(ui && typeof ui.default === 'function' && ui.default.prototype instanceof Scene, 'UIScene default export 는 Phaser.Scene 서브클래스');
check(battle && typeof battle.default === 'function' && battle.default.prototype instanceof Scene, 'BattleScene default export 는 Phaser.Scene 서브클래스');
check(hud && typeof hud.default === 'function' && hud.default.prototype instanceof Scene, 'BattleHud default export 는 Phaser.Scene 서브클래스');
check(main && main.GAME_H === 720 && main.GAME_W >= 1280 && main.GAME_W <= 2400, 'main.js 논리 해상도 세로 720 · 가로 1280~2400(창 비율)');
check(globalThis.__game && globalThis.__game.config && globalThis.__game.config.scene.length === 5, 'main.js 가 Phaser.Game 을 씬 5개(Boot·Map·UI·Battle·BattleHud)로 만든다');

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
  // BootScene 은 화면에 글자를 안 그린다(console.warn 뿐) → 대상은 텍스트를 만드는 씬들 + 전투 화면(기본 무장 이름·문구)
  //   + sim.js(결과 사유 REASON 문구를 HUD 가 그대로 그린다)·data.js(무장·무장기 이름) — 통합에서 추가
  for (const rel of ['src/scenes/UIScene.js', 'src/scenes/MapScene.js', 'src/battle/BattleScene.js', 'src/battle/BattleHud.js', 'src/battle/fx.js',
    'src/battle/sim.js', 'src/battle/data.js'].filter((r) => existsSync(join(ROOT, r)))) {
    let src = readFileSync(join(ROOT, rel), 'utf8');
    src = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
    src = src.replace(/console\.\w+\(.*\)/g, '');   // 콘솔 문구는 화면에 안 그린다

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
// 6) 전투 (BATTLE.md) — HUD 배치 제약, 선택 에셋 크기(있을 때만), sim 계약(sim.js 없으면 더미로)
// ─────────────────────────────────────────────────────────────

section('6) 전투 HUD 배치 제약 (BattleHud.HUD_LAYOUT) — 폰 가로 기준 버튼 ≥ 72px');
if (hud && hud.HUD_LAYOUT) {
  const L = hud.HUD_LAYOUT;
  const DESIGN = { panel: 48, parchment: 24, button: 32 };
  const nine = (name, w, h, corner, design) => {
    check(corner <= design, `${name} corner ${corner} ≤ 그림 모서리 ${design}`);
    check(corner * 2 <= Math.min(w, h), `${name} ${w}×${h}: 2×${corner} ≤ 짧은 변`);
  };
  nine('병법 버튼(button)', L.tactic.w, L.tactic.h, L.tactic.corner, DESIGN.button);
  nine('결과 패널(panel)', L.result.panel.w, L.result.panel.h, L.result.panel.corner, DESIGN.panel);
  nine('결과 한지(parchment)', L.result.parchment.w, L.result.parchment.h, L.result.parchment.corner, DESIGN.parchment);
  nine('결과 버튼(button)', L.result.button.w, L.result.button.h, L.result.button.corner, DESIGN.button);
  check(L.tactic.h >= 72 && L.result.button.h >= 72 && L.skill.r * 2 >= 72, '버튼 높이·무장기 버튼 지름 ≥ 72px');
  const tacticW = 3 * L.tactic.w + 2 * L.tactic.gap;
  check(tacticW + L.bar.margin <= 1280 / 2, `병법 3버튼 폭 ${tacticW} 이 화면 오른쪽 반 안(조이스틱 영역과 안 겹침)`);
  check(L.result.parchment.w <= L.result.panel.w - 60 && L.result.parchment.h <= L.result.panel.h - 120, '결과 한지가 창틀 안쪽·버튼 위에 들어감');
  // 2차 HUD(BATTLE_ART §5): 무장 블록 둘을 가로로 — 왼쪽 묶음 끝 = margin + 2×blockW + gap. 블록 안에서 HP 바가 안 넘치는지도 본다
  const genEnd = L.bar.margin + 2 * L.gen.blockW + L.gen.gap;
  check(genEnd <= 1280 / 2 - 60, `무장 블록 묶음 끝 x ${genEnd} 이 가운데 시간 표시(580)를 안 침범`);
  check(L.gen.textX >= L.gen.frameW + 4 && L.gen.textX + L.gen.barW <= L.gen.blockW, '무장 블록 안에 초상 테두리·HP 바가 안 겹치고 들어감');
  // hud/bar_frame.png 320×40 — HP 바·병력 바 9-slice. 덮개는 12px 이지만 윤곽선이 열·행 12~13 까지 나와 있어(통합 실측: 12 로 자르면
  //   늘어나는 구간 열 차 255, 14 로 자르면 3) 모서리는 14 — 바를 넓게 늘려도 덮개 윤곽이 같이 안 굵어진다
  nine('무장 HP 바(bar_frame)', L.gen.barW, L.gen.barH, L.gen.corner, 14);
  nine('병력 바(bar_frame)', L.bar.w, L.bar.h, L.bar.corner, 14);
  check(L.bar.corner >= 14 && L.gen.corner >= 14, 'bar_frame 9-slice 모서리 ≥ 14 (덮개 윤곽선까지 모서리 조각에)');
  check(L.gen.barH - 2 * L.gen.inset >= 22, `무장 HP 바 채움 높이 ${L.gen.barH - 2 * L.gen.inset} ≥ 22px (폰 0.54배 → 12px)`);
  // 초상 테두리 아래 끝 ↔ HP 바 아래 끝 ↔ BattleScene.HUD_TOP
  check(L.gen.y + L.gen.barDy + L.gen.barH / 2 <= L.gen.y + L.gen.frameH / 2, '무장 HP 바 아래 끝이 초상 테두리 아래 끝(HUD_TOP) 안');
  check(L.skill.medallion >= 72 && L.skill.arcR < L.skill.medallion / 2, '무장기 메달리온 ≥ 72px · 게이지 호가 메달리온 안');
  // medallion.png(160 기준) 목재 띠 37~50 — 게이지 호(arcR ± arcW/2, 표시 px)가 그 안에(통합 실측 assets/raw/battle2/_integ_hud_probe.py)
  {
    const k = L.skill.medallion / 160, lo = L.skill.arcR - L.skill.arcW / 2, hi = L.skill.arcR + L.skill.arcW / 2;
    check(lo >= 36.5 * k && hi <= 51 * k, `게이지 호 ${lo}~${hi}px 가 메달리온 목재 띠 ${(36.5 * k).toFixed(1)}~${(51 * k).toFixed(1)}px 안`);
  }
  // 3차(docs/BATTLE_V3.md §1·§2): 자동/수동 토글·배속 버튼·초상 선택 꼬리표 — 폰 가로(FIT 0.54) 버튼 ≥ 72px · 글자 ≥ 22px
  if (L.auto && L.speed && L.sel) {
    nine('자동/수동 버튼(button)', L.auto.w, L.auto.h, L.auto.corner, DESIGN.button);
    nine('배속 버튼(button)', L.speed.w, L.speed.h, L.speed.corner, DESIGN.button);
    check(Math.min(L.auto.w, L.auto.h, L.speed.w, L.speed.h) >= 72, `자동/수동 ${L.auto.w}×${L.auto.h} · 배속 ${L.speed.w}×${L.speed.h} 버튼 ≥ 72px`);
    const rowW = tacticW + L.auto.gap + L.auto.w;
    check(rowW + L.bar.margin <= 1280 / 2, `자동 버튼 + 병법 3버튼 줄 폭 ${rowW} 이 화면 오른쪽 반 안(1280 폭에서 왼쪽 끝 x ${1280 - L.bar.margin - rowW} ≥ 640)`);
    // 배속 버튼(1280 폭 기준): 시간 글자(가운데 ±44)·오른쪽 병력 바·오른쪽 둘째 무장의 이름/HP 바와 안 겹치는가
    const sx0 = 640 + L.speed.dx - L.speed.w / 2, sx1 = 640 + L.speed.dx + L.speed.w / 2, sy1 = L.speed.y + L.speed.h / 2;
    check(sx0 >= 640 + 44 + 16, `배속 버튼 왼쪽 끝 x ${sx0} 이 시간 글자(≤684) 오른쪽`);
    check(sx1 <= 1280 - L.bar.margin - L.bar.w, `배속 버튼 오른쪽 끝 x ${sx1} ≤ 오른쪽 병력 바 왼쪽 끝 ${1280 - L.bar.margin - L.bar.w}`);
    const gen2TextL = 1280 - (L.bar.margin + L.gen.blockW + L.gen.gap + L.gen.textX) - 60;   // 오른쪽 둘째 무장 이름(오른쪽 정렬, 두세 글자 ≈ 60px)의 왼쪽 끝
    const gen2BarTop = L.gen.y + L.gen.barDy - L.gen.barH / 2;
    check(sx1 <= gen2TextL && sy1 <= gen2BarTop, `배속 버튼(~x ${sx1}, ~y ${sy1}) 이 오른쪽 둘째 무장 이름(x ${gen2TextL}~)·HP 바(y ${gen2BarTop}~)와 안 겹침`);
    check(L.speed.y - L.speed.h / 2 >= 0 && sy1 <= L.gen.y + L.gen.frameH / 2, '배속 버튼이 화면 위 끝~HUD 영역(HUD_TOP) 안');
    check(L.sel.font >= 22 && L.sel.tagH >= L.sel.font + 6 && L.sel.tagW <= L.gen.portraitW, `초상 꼬리표 글자 ${L.sel.font}px ≥ 22 · 꼬리표 ${L.sel.tagW}×${L.sel.tagH} 가 초상(${L.gen.portraitW}) 안`);
    check(L.gen.blockW >= 72 && L.gen.frameH >= 72, `초상 탭 영역(블록 ${L.gen.blockW}×${L.gen.frameH}) ≥ 72px`);
  } else bad('HUD_LAYOUT 에 3차 항목(auto·speed·sel)이 없음');
  // 3차 글자 크기 — BattleHud 소스의 fontSize 리터럴이 전부 ≥ 22px 인가(템플릿 `${…}px` 는 위 sel.font 로 본다)
  {
    const src = readFileSync(join(ROOT, 'src/battle/BattleHud.js'), 'utf8');
    const sizes = [...src.matchAll(/fontSize:\s*'(\d+)px'/g)].map((m) => Number(m[1]));
    const calls = [...src.matchAll(/setFontSize\((\d+)\)/g)].map((m) => Number(m[1]));
    const small = [...sizes, ...calls].filter((n) => n < 22);
    check(sizes.length > 0 && small.length === 0, `BattleHud 글자 크기 최소 ${Math.min(...sizes, ...calls)}px ≥ 22 (폰 0.54배 → 12px)`);
  }
}

section('6) 전투 2차 그림 (BootScene.BATTLE2_ASSETS, BATTLE_ART.md §1~§4) — 전부 선택: 없으면 경고만, 있으면 크기·알파 검사');
let warns = 0;
const warn = (msg) => { warns++; console.log(`  warn ${msg}`); };
if (boot && Array.isArray(boot.BATTLE2_ASSETS)) {
  const keys = boot.BATTLE2_ASSETS.map((a) => a[0]);
  check(new Set(keys).size === keys.length, `BATTLE2_ASSETS 키 ${keys.length}개 중복 없음`);
  // 키 규칙: 폴더 접두사 + 파일명 (units2→u2_, field→field_, fx→fx_, hud→hud_) — 통합 담당이 파일명만 보고 키를 안다
  const PREFIX = { units2: 'u2_', field: 'field_', fx: 'fx_', hud: 'hud_' };
  check(boot.BATTLE2_ASSETS.every(([key, rel]) => {
    const m = /^battle\/(units2|field|fx|hud)\/([a-z0-9_]+)\.png$/.exec(rel);
    return m && key === PREFIX[m[1]] + m[2];
  }), 'BATTLE2_ASSETS 키 = 폴더 접두사 + 파일명');
  const old = new Set([...boot.ASSETS, ...boot.BATTLE_ASSETS].map((a) => a[0]));
  check(keys.every((k) => !old.has(k)), '2차 키가 1차 키와 안 겹침');
  let have = 0;
  const missing = [];
  for (const [key, rel, w, h, needAlpha, rule] of boot.BATTLE2_ASSETS) {
    const p = join(ASSET_DIR, rel);
    if (!existsSync(p)) { missing.push(rel.replace('battle/', '')); continue; }
    have++;
    const info = imageSize(readFileSync(p));
    if (!info || info.fmt !== 'png') { bad(`${rel} PNG 헤더를 못 읽음`); continue; }
    if (rule === 'max') check(info.w <= w && info.h <= h, `'${key}' ${rel} ${info.w}×${info.h} ≤ ${w}×${h}`);
    else check(info.w === w && info.h === h, `'${key}' ${rel} ${info.w}×${info.h}${info.w === w && info.h === h ? '' : ` (계약 ${w}×${h})`}`);
    if (needAlpha) check(info.alpha, `${rel} 알파 채널`);
  }
  if (missing.length) warn(`2차 그림 ${missing.length}/${keys.length} 없음(코드 폴백으로 돈다): ${missing.join(', ')}`);
  else ok(`2차 그림 ${have}개 전부 있음`);
  // 코드가 쓰는 2차 키가 전부 표에 있는가 — 전투 3파일의 문자열에서 u2_/field_/fx_/hud_ 로 시작하는 고정 키를 모아 대조
  const keySet = new Set(keys);
  const used = new Set();
  for (const rel of ['src/battle/BattleScene.js', 'src/battle/BattleHud.js', 'src/battle/fx.js']) {
    const src = readFileSync(join(ROOT, rel), 'utf8');
    for (const m of src.matchAll(/['"`]((?:field|fx|hud)_[a-z0-9_]+)['"`]/g)) used.add(m[1]);
  }
  const unknown = [...used].filter((k) => !keySet.has(k) && !old.has(k));
  check(unknown.length === 0, `전투 코드의 2차 텍스처 키가 전부 BATTLE2_ASSETS 에 있음${unknown.length ? ` — 없는 키: ${unknown.join(', ')}` : ''}`);
  // (통합) 폴더에 있는데 표에 없는 PNG — 이름을 잘못 지어 납품하면 조용히 폴백이 돈다 → 경고
  const listed = new Set(boot.BATTLE2_ASSETS.map((a) => a[1]));
  const orphans = [];
  for (const dir of ['units2', 'field', 'fx', 'hud']) {
    const d = join(ASSET_DIR, 'battle', dir);
    if (!existsSync(d)) continue;
    for (const f of readdirSync(d)) if (f.endsWith('.png') && !listed.has(`battle/${dir}/${f}`)) orphans.push(`${dir}/${f}`);
  }
  if (orphans.length) warn(`표(BATTLE2_ASSETS)에 없는 2차 그림 ${orphans.length}개 — 코드가 안 읽는다: ${orphans.join(', ')}`);
  else ok('2차 그림 폴더에 표 밖 PNG 없음');
  // (통합) 유닛 그림의 몸 중심 표(BattleScene.U2_ANCHOR)가 표의 모든 유닛(병종·무장)을 덮고 값이 캔버스 안인가, stand↔attack 이 짝으로 있는가
  if (battle && battle.U2_ANCHOR && battle.U2) {
    const bases = new Set(keys.filter((k) => k.startsWith('u2_')).map((k) => k.replace(/^u2_/, '').replace(/_(stand|attack)$/, '')));
    const anchorKey = (b) => (b.startsWith('gen_') ? b : b.replace(/_(g|b)$/, ''));
    const noAnchor = [...bases].filter((b) => !battle.U2_ANCHOR[anchorKey(b)]);
    check(noAnchor.length === 0, `U2_ANCHOR 가 유닛 ${bases.size}종을 다 덮음${noAnchor.length ? ` — 없는 것: ${noAnchor.join(', ')}` : ''}`);
    check(Object.values(battle.U2_ANCHOR).every((a) => Array.isArray(a) && a.length === 2 && a.every((v) => v >= 24 && v <= 104)), 'U2_ANCHOR 값 [stand, attack] 이 128px 캔버스 가운데 쪽(24~104)');
    check([...bases].every((b) => keySet.has(`u2_${b}_stand`) && keySet.has(`u2_${b}_attack`)), '유닛 그림이 stand·attack 짝으로 표에 있음');
    check(battle.U2.oy > 0.9 && battle.U2.oy < 1 && battle.U2.general.scale > battle.U2.soldier.scale, 'U2 origin y 0.9~1 · 무장 배율 > 병사 배율');
  }
}

section('6) 전투 선택 에셋 (BootScene.BATTLE_ASSETS) — 있으면 크기 검사, 없으면 통과');
if (boot && Array.isArray(boot.BATTLE_ASSETS)) {
  const EXPECT = { 'battle/sky.png': [2048, 720], 'battle/far.png': [2048, 360], 'battle/ground.png': [1024, 320] };
  for (const [key, rel] of boot.BATTLE_ASSETS) {
    const p = join(ASSET_DIR, rel);
    if (!existsSync(p)) continue;
    const info = imageSize(readFileSync(p));
    if (!info) { bad(`${rel} 이미지 헤더를 못 읽음`); continue; }
    // (3차 통합) 컷인 주 일러스트는 1248×1824(BATTLE_V3.md §3.2 — SDXL 832×1216 의 1.5배 하이레즈). 크기가 달라도 cutin.js 는 화면 높이 기준으로 맞추지만
    //   얼굴 위치표(CUTIN_ART.faceU/faceV)는 이 납품본으로 잰 것이라 그림이 바뀌면 여기서 알아채게 한다
    const want = EXPECT[rel] || (rel.startsWith('battle/units/') ? [96, 128] : rel.startsWith('battle/cutin/') ? [1248, 1824] : null);
    if (want) check(info.w === want[0] && info.h === want[1], `'${key}' ${rel} ${info.w}×${info.h} (계약 ${want[0]}×${want[1]})`);
    else ok(`'${key}' ${rel} ${info.w}×${info.h} 있음`);
    if (/battle\/(far\.png|cutin\/|units\/)/.test(rel)) check(info.alpha, `${rel} 알파 채널`);   // 하늘·땅은 불투명이어도 된다
  }
  const keys = boot.BATTLE_ASSETS.map((a) => a[0]);
  check(new Set(keys).size === keys.length, 'BATTLE_ASSETS 키 중복 없음');
  // 통합: BATTLE.md §5 의 12 파일 중 납품된 10개는 이제 필수(사라지면 실패). 컷인 하후돈·전위는 아직 없어 선택으로 남긴다.
  const paths = new Set(boot.BATTLE_ASSETS.map((a) => a[1]));
  //   (3차 통합) 컷인 하후돈·전위도 납품됐다(2차 끝) → 네 장 모두 필수.
  const REQUIRED = ['battle/sky.png', 'battle/far.png', 'battle/ground.png',
    ...['guanyu', 'zhangfei', 'xiahoudun', 'dianwei'].map((n) => `battle/cutin/${n}.png`),
    ...['inf', 'spear', 'bow', 'cav', 'general_left', 'general_right'].map((n) => `battle/units/${n}.png`)];
  for (const rel of REQUIRED) check(existsSync(join(ASSET_DIR, rel)) && paths.has(rel), `${rel} 납품됨 + BATTLE_ASSETS 가 로드`);
}

section('6) 전투 3차 에셋 (BootScene.BATTLE3_ASSETS — 컷신 눈 띠) · 컷신 조정표');
if (boot && Array.isArray(boot.BATTLE3_ASSETS)) {
  for (const [key, rel, w, h, needAlpha] of boot.BATTLE3_ASSETS) {
    const p = join(ASSET_DIR, rel);
    if (!existsSync(p)) { warn(`'${key}' ${rel} 없음 — 컷신이 첫 박자(눈 띠)를 건너뛴다`); continue; }
    const info = imageSize(readFileSync(p));
    if (!info) { bad(`${rel} 이미지 헤더를 못 읽음`); continue; }
    check(info.w === w && info.h === h && (!needAlpha || info.alpha), `'${key}' ${rel} ${info.w}×${info.h} (계약 ${w}×${h})`);
  }
  const cutMod = mods['src/battle/cutin.js'];
  const dataMod3 = mods['src/battle/data.js'];
  if (cutMod && cutMod.CUTIN_ART && dataMod3 && dataMod3.GENERALS) {
    const gk = Object.values(dataMod3.GENERALS).map((g) => g.key);
    const eyeKeys = new Set(boot.BATTLE3_ASSETS.map((a) => a[0]));
    check(gk.every((k) => cutMod.CUTIN_ART[k] && eyeKeys.has(`cutin_${k}_eyes`)), `무장 key(${gk.join(',')}) 마다 CUTIN_ART 줄 + 눈 띠 키 cutin_<key>_eyes`);
    check(Object.values(cutMod.CUTIN_ART).every((t) => t.faceU > 0.2 && t.faceU < 0.8 && t.faceV > 0.1 && t.faceV < 0.6
      && (t.faceIn == null || (t.faceIn >= 0.25 && t.faceIn <= 0.65)) && (t.scale == null || (t.scale >= 0.8 && t.scale <= 1.2))),
      'CUTIN_ART faceU/faceV·faceIn·scale 이 말이 되는 범위');
  }
}

section('6) 전투 파일·상수 일치 (통합)');
{
  check(BATTLE_OPTIONAL.length === 2, 'src/battle/sim.js·data.js 존재(더 이상 선택이 아님)');
  check(existsSync(join(ROOT, 'tools/battle-bench.mjs')), 'tools/battle-bench.mjs 존재 (node tools/battle-bench.mjs 로 sim 판정)');
  check(existsSync(join(ROOT, 'assets/raw/battle/view-check.mjs')), 'assets/raw/battle/view-check.mjs 존재 (헤드리스 화면 점검)');
  const dataMod = mods['src/battle/data.js'];
  if (dataMod && battle && battle.FIELD) {
    const F = dataMod.FIELD, V = battle.FIELD;
    check(F.W === V.w && F.H === V.h && F.GROUND_TOP === V.top && F.GROUND_BOTTOM === V.bottom,
      `BattleScene.FIELD ${V.w}×${V.h} 땅 ${V.top}~${V.bottom} = data.js FIELD ${F.W}×${F.H} 땅 ${F.GROUND_TOP}~${F.GROUND_BOTTOM}`);
    // 컷인 텍스처 키 cutin_<key> ↔ 무장 key
    const gk = Object.values(dataMod.GENERALS).map((g) => g.key);
    const cutKeys = new Set(boot.BATTLE_ASSETS.map((a) => a[0]).filter((k) => k.startsWith('cutin_')).map((k) => k.slice(6)));
    check(gk.every((k) => cutKeys.has(k)), `무장 key(${gk.join(',')}) 마다 BootScene 컷인 키 cutin_<key> 가 있음`);
  }
}

section('6) sim 계약 (BATTLE.md §2.1) — ' + (BATTLE_OPTIONAL.includes('src/battle/sim.js') ? 'src/battle/sim.js' : '더미 assets/raw/battle/sim-stub.mjs'));
{
  const simMod = mods['src/battle/sim.js'] || mods['assets/raw/battle/sim-stub.mjs'];
  const dataMod = mods['src/battle/data.js'];
  const D = battle && battle.DEFAULT_DATA;
  if (simMod && D) {
    const left = (dataMod && dataMod.ARMY_LEFT) || D.ARMY_LEFT;
    const right = (dataMod && dataMod.ARMY_RIGHT) || D.ARMY_RIGHT;
    const run = (seed, steps) => {
      const b = simMod.createBattle({ seed, left, right });
      b.command('left', 'charge');
      b.command('right', 'charge');
      const types = new Set();
      for (let i = 0; i < steps; i++) {
        b.step(16.7);
        for (const e of b.drainEvents()) types.add(e.type);
      }
      return { b, types };
    };
    const { b, types } = run(1, 60 * 30);   // 30초
    const U = b.units;
    check(typeof b.step === 'function' && typeof b.drainEvents === 'function' && typeof b.command === 'function'
      && typeof b.setGeneralInput === 'function' && typeof b.useSkill === 'function' && typeof b.generalsOf === 'function'
      && typeof b.countAlive === 'function', 'createBattle() 가 §2.1 메서드를 전부 가진다');
    check(Array.isArray(U) && U.length === 244, `units ${U.length}개 (편당 무장 2 + 병사 120)`);
    check(b.generalsOf('left').length === 2 && b.generalsOf('right').length === 2, '무장 편당 2');
    const fields = ['id', 'side', 'kind', 'generalId', 'x', 'y', 'facing', 'hp', 'maxHp', 'state', 'attackT', 'vx', 'vy'];
    check(U.every((u) => fields.every((f) => f in u)), `Unit 필드 ${fields.join('·')}`);
    check(U.every((u) => u.id === U.indexOf(u)), 'units 배열 인덱스 = id (view 가 id 로 스프라이트를 맵핑)');
    check(b.generalsOf('left').every((g) => 'gauge' in g && 'skill' in g && g.name), '무장 Unit 에 name·gauge·skill');
    // 덧붙인 필드(통합에서 view 가 쓰기로 한 것): Unit.key(컷인 파일명)·alive, result.time, playerOf, skillCount
    check(b.generalsOf('left').every((g) => typeof g.key === 'string') && U.every((u) => 'alive' in u), '덧붙인 Unit 필드 key(무장)·alive');
    check(typeof b.playerOf === 'function' && b.skillCount && typeof b.skillCount.left === 'number', '덧붙인 API playerOf·skillCount');
    // 3차(docs/BATTLE_V3.md §1): setPlayer(side, id|null) — 진짜 sim 에만(더미엔 없다 → view 는 canSwitch=false 로 폴백)
    if (mods['src/battle/sim.js']) {
      const s = simMod.createBattle({ seed: 4, left, right });
      const [g0, g1] = s.generalsOf('left');
      const eg = s.generalsOf('right')[0];
      check(typeof s.setPlayer === 'function', 'sim.setPlayer 존재');
      if (typeof s.setPlayer === 'function') {
        check(s.playerOf('left') === g0, `처음 조종 무장 = ${g0.name}`);
        s.setGeneralInput('left', g0.id, { dx: 1, dy: 0 });
        check(s.setPlayer('left', g1.id) === true && s.playerOf('left') === g1, `setPlayer(left, ${g1.name}) → playerOf = ${g1.name}`);
        check(g0.inX === 0 && g0.inY === 0 && g0.ai === true && g1.ai === false, '교체 순간 이전 무장은 AI · 입력 벡터 0');
        check(s.setPlayer('left', eg.id) === false && s.setPlayer('left', 9999) === false && s.playerOf('left') === g1, '남의 편·없는 id 는 거절하고 그대로');
        check(s.setPlayer('left', null) === true && s.playerOf('left') === null && g1.ai === true, 'setPlayer(left, null) → 전원 AI(자동)');
        check(s.setPlayer('left', g0.id) === true && s.playerOf('left') === g0, '자동 → 다시 조종');
        // 결정성: 같은 seed·같은 호출 순서 두 번
        const runSw = () => {
          const q = simMod.createBattle({ seed: 6, left, right });
          q.command('left', 'charge'); q.command('right', 'charge');
          const gs = q.generalsOf('left');
          for (let i = 0; i < 900; i++) {
            if (i === 200) q.setPlayer('left', gs[1].id);
            if (i === 500) q.setPlayer('left', null);
            const pl = q.playerOf('left');
            if (pl) q.setGeneralInput('left', pl.id, { dx: 1, dy: 0.2 });
            q.step(16.7); q.drainEvents();
          }
          return q.units.reduce((acc, u) => acc + u.hp + u.x, 0);
        };
        const r1 = runSw(), r2 = runSw();
        check(r1 === r2, `setPlayer 결정성: 같은 호출 순서 두 번 = ${r1.toFixed(3)} / ${r2.toFixed(3)}`);
      }
    }
    // 3차: BattleScene 이 HUD 에 내놓는 조종·배속 메서드
    {
      const P = battle && battle.default && battle.default.prototype;
      const need = ['selectGeneral', 'cycleGeneral', 'toggleAuto', 'setAuto', 'cycleSpeed', 'setSpeed', 'checkPlayerAlive'];
      check(P && need.every((n) => typeof P[n] === 'function'), `BattleScene 3차 메서드 ${need.join('·')}`);
      check(Array.isArray(battle.SPEEDS) && battle.SPEEDS.join() === '1,2,3', 'BattleScene.SPEEDS = [1,2,3]');
    }
    check(typeof b.time === 'number' && b.time > 29000, `time ${Math.round(b.time)}ms`);
    check(types.has('hit') && types.has('death'), `30초 안에 hit·death 이벤트 (${[...types].join(',')})`);
    check(U.every((u) => ['idle', 'move', 'attack', 'hurt', 'stun', 'flee', 'dead', 'gone'].includes(u.state)), 'state 값이 계약 안');
    // 결정성: 같은 seed 두 번 = 같은 hp 합
    const sum = (bb) => bb.units.reduce((s, u) => s + u.hp, 0);
    const a1 = run(3, 600).b, a2 = run(3, 600).b;
    check(sum(a1) === sum(a2), `결정성: seed 3 두 번 hp 합 ${sum(a1)} = ${sum(a2)}`);
    // 종료: 180초 안에 result
    const { b: bEnd } = run(2, 60 * 185);
    check(bEnd.result && ['left', 'right', 'draw'].includes(bEnd.result.winner), `185초 뒤 result ${bEnd.result ? bEnd.result.winner + ' (' + bEnd.result.reason + ')' : '없음'}`);
    check(!bEnd.result || typeof bEnd.result.time === 'number', 'result.time(ms) — 결과 패널 「걸린 시간」');
  } else {
    bad('sim 또는 BattleScene.DEFAULT_DATA 를 못 읽음');
  }
}

// ─────────────────────────────────────────────────────────────

console.log(`\n${fails === 0 ? 'PASS' : 'FAIL'} — ${passes} ok, ${fails} fail${warns ? `, ${warns} warn` : ''}`);
process.exit(fails === 0 ? 0 : 1);
