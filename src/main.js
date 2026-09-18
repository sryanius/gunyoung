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
const ASPECT = (window.innerWidth > 0 && window.innerHeight > 0)
  ? window.innerWidth / window.innerHeight
  : 16 / 9;                      // 창 크기를 모르면(스모크 스텁 등) 16:9
export const GAME_W = Math.round(Phaser.Math.Clamp(GAME_H * ASPECT, 1280, 1600));

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

// 개발 편의: 콘솔에서 __shot('이름') → 서버 tools/shots/이름.png (tools/serve.mjs 의 /__shot)
window.__game = game;
window.__shot = (name = 'shot') => new Promise((resolve, reject) => {
  game.renderer.snapshot((img) => {
    fetch(`/__shot?name=${encodeURIComponent(name)}`, { method: 'POST', body: img.src })
      .then((r) => r.text()).then(resolve, reject);
  });
});
