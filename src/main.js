// 군영전 목업 진입점 — Phaser 게임 생성 (SPEC §1).
// Phaser 는 index.html 에서 CDN 전역(window.Phaser)으로 들어온다. 빌드 도구 없음.

import BootScene from './scenes/BootScene.js';
import MapScene from './scenes/MapScene.js';
import UIScene from './scenes/UIScene.js';
import { unlock } from './sfx.js';

/**
 * 논리 해상도 — 세로 720 고정, 가로는 창 비율에 맞춘다(1280 = 16:9 ~ 1600 = 20:9).
 * 폰 가로(19.5:9 등)에서 FIT 만 쓰면 좌우에 검은 띠가 남는다. UIScene 은 this.scale.width 로 오른쪽을 잡는다.
 */
export const GAME_H = 720;
/** 논리 폭 범위 — 폰 브라우저는 주소창 때문에 가로가 3:1 에 가까워질 때도 있어 위를 넉넉히 둔다 */
const MIN_W = 1280, MAX_W = 2400;

/** 지금 창 비율로 정한 논리 폭. 창 크기를 모르면(스모크 스텁 등) 16:9. */
export function logicalWidth() {
  const aspect = (window.innerWidth > 0 && window.innerHeight > 0)
    ? window.innerWidth / window.innerHeight
    : 16 / 9;
  return Math.round(Phaser.Math.Clamp(GAME_H * aspect, MIN_W, MAX_W));
}
export const GAME_W = logicalWidth();

const config = {
  type: Phaser.AUTO,               // WebGL, 안 되면 Canvas
  parent: 'game',
  width: GAME_W,
  height: GAME_H,
  backgroundColor: '#0b0a08',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    antialias: true,
    pixelArt: false,
    roundPixels: false,
    powerPreference: 'high-performance',
  },
  input: {
    activePointers: 2,             // 핀치용 — MapScene 에서 addPointer(1) 도 한 번 더 부른다
    mouse: { preventDefaultWheel: true },
  },
  scene: [BootScene, MapScene, UIScene],
};

const game = new Phaser.Game(config);

// 첫 사용자 제스처에서 AudioContext 를 만들고 깨운다. 잠긴 채로 남을 수 있어 once 로 두지 않는다.
for (const ev of ['pointerdown', 'touchend', 'keydown']) {
  window.addEventListener(ev, unlock, { passive: true });
}

// ─────────────────────────────────────────────────────────────
// 창 비율이 바뀌면(세로↔가로 회전, 주소창 숨김, 전체 화면) 논리 폭을 다시 정한다.
//   FIT 은 배율만 다시 맞추므로 폭이 다르면 좌우 검은 띠가 남는다 → scale.resize 로 논리 크기 자체를 바꾸고,
//   오른쪽 기준으로 배치한 UIScene 은 인트로 없이 다시 만든다. MapScene 은 카메라 경계만 다시 계산.
// ─────────────────────────────────────────────────────────────
function relayout() {
  const w = logicalWidth();
  if (Math.abs(w - game.scale.width) <= 8) return;
  // scale.resize() 는 NO_SCALE 용이라 FIT 에서 표시 크기를 안 고친다(실측: 캔버스가 옛 폭에 머묾). setGameSize 를 쓴다.
  game.scale.setGameSize(w, GAME_H);
  const map = game.scene.getScene('MapScene');
  if (map && map.scene.isActive() && typeof map.applyBounds === 'function') {
    // 넓어진 화면에서 지도가 가로로 모자라면(양옆 배경색) 최소 줌을 올린다
    const cam = map.cameras.main;
    if (typeof map.minZoom === 'function' && cam.zoom < map.minZoom()) cam.setZoom(map.minZoom());
    map.applyBounds();
  }
  const ui = game.scene.getScene('UIScene');
  if (ui && ui.scene.isActive()) {
    // 열려 있던 도시 패널은 재시작 뒤 다시 연다 — 첫 성 탭이 전체 화면 진입과 겹치면 정확히 이 경로를 밟는다
    const reopen = ui.panelOpen ? ui.panelCity : null;
    ui.scene.restart({ noIntro: true, reopen });
  }
}
let relayoutTimer = 0;
const relayoutSoon = () => { clearTimeout(relayoutTimer); relayoutTimer = setTimeout(relayout, 150); };
window.addEventListener('resize', relayoutSoon);
if (typeof screen !== 'undefined' && screen.orientation && screen.orientation.addEventListener) {
  screen.orientation.addEventListener('change', relayoutSoon);
}

// ─────────────────────────────────────────────────────────────
// 전체 화면 + 가로 고정.
//   폰이 「세로 고정」이어도 전체 화면 안에서는 screen.orientation.lock('landscape') 가 먹는다
//   (Android Chrome·Samsung Internet. iOS Safari 는 둘 다 안 되므로 조용히 넘어간다).
//   사용자 제스처 안에서만 허용되므로 세로 안내의 버튼과 게임 첫 터치에서 부른다.
// ─────────────────────────────────────────────────────────────
let fullscreenInflight = null;
function goFullscreen() {
  if (fullscreenInflight) return fullscreenInflight;   // 버튼 click 과 pointerup 이 겹쳐도 lock 을 두 번 걸지 않는다
  const el = document.documentElement;
  let p;
  try {
    if (el.requestFullscreen) p = el.requestFullscreen({ navigationUI: 'hide' });
    else if (el.webkitRequestFullscreen) p = el.webkitRequestFullscreen();
  } catch (e) { p = Promise.reject(e); }
  fullscreenInflight = Promise.resolve(p).catch(() => {}).then(() => {
    if (screen.orientation && screen.orientation.lock) {
      return screen.orientation.lock('landscape').catch(() => {});
    }
  }).finally(() => { fullscreenInflight = null; });
  return fullscreenInflight;
}
window.__goFullscreen = goFullscreen;

// 터치 기기에서는 게임 첫 터치에 전체 화면으로 들어간다(주소창이 사라져 세로 공간이 늘고, 가로가 고정된다).
//   ※ 터치의 pointerdown 은 「사용자 활성화」를 주지 않는다(HTML 표준: 터치는 pointerup·touchend 만) —
//      pointerdown 에서 부르면 requestFullscreen 이 조용히 거부된다. 손가락을 뗄 때 부르고, 성공할 때까지 리스너를 둔다.
//   설치된 앱(display-mode: fullscreen)은 매니페스트가 이미 전체 화면·가로라 건너뛴다.
const isTouch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
const isInstalledFullscreen = typeof matchMedia === 'function' && matchMedia('(display-mode: fullscreen)').matches;
if (isTouch && !isInstalledFullscreen && document.fullscreenEnabled !== false) {
  const onFirstRelease = (e) => {
    if (e.pointerType === 'mouse') return;
    if (e.target && e.target.closest && e.target.closest('#rotate')) return;   // 세로 안내 버튼은 onclick 이 맡는다
    if (document.fullscreenElement) { window.removeEventListener('pointerup', onFirstRelease); return; }
    goFullscreen().then(() => {
      if (document.fullscreenElement) window.removeEventListener('pointerup', onFirstRelease);
    });
  };
  window.addEventListener('pointerup', onFirstRelease, { passive: true });
}

// 개발 편의: 콘솔에서 __shot('이름') → 서버 tools/shots/이름.png (tools/serve.mjs 의 /__shot)
window.__game = game;
window.__shot = (name = 'shot') => new Promise((resolve, reject) => {
  game.renderer.snapshot((img) => {
    fetch(`/__shot?name=${encodeURIComponent(name)}`, { method: 'POST', body: img.src })
      .then((r) => r.text()).then(resolve, reject);
  });
});
