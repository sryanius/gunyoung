// BootScene — 폰트 대기, 에셋 로드(진행 바), 로드 실패 키 기록 + 자리표시 텍스처 생성 (SPEC §5.1).
//
// 에셋은 다른 에이전트가 동시에 만들고 있어 아직 없을 수 있다. SPEC §3 의 파일명·크기로 로드하되,
// 'loaderror' 로 실패한 키는 registry 'missing' 에 남기고, 같은 키 이름으로 Graphics/Canvas 자리표시
// 텍스처를 만들어 둔다 → 에셋 0개여도 MapScene/UIScene 은 같은 키로 그대로 돌아간다.
// (각 씬도 textures.exists() 로 한 번 더 확인해 최후의 도형 폴백을 가진다.)

import { KOREAN_SAMPLE, HANJA_SAMPLE } from '../data/factions.js';

/** 지도 논리 좌표(1000×780) → 그림 좌표 배율 */
const S = 2;

/** SPEC §3 에셋 계약: [키, 경로, 폭, 높이] */
export const ASSETS = [
  ['map',        'map/map.jpg',      2000, 1560],
  ['clouds',     'map/clouds.png',   1024, 512],
  ['panel',      'ui/panel.png',     384, 384],
  ['parchment',  'ui/parchment.png', 256, 256],
  ['button',     'ui/button.png',    256, 96],
  ['button_down','ui/button_down.png', 256, 96],
  ['hud_bar',    'ui/hud_bar.png',   1280, 72],
  ['banner',     'ui/banner.png',    512, 128],
  ['castle_1',   'ui/castle_1.png',  112, 112],   // SPEC 은 ≤160 — 실제 납품 크기
  ['castle_2',   'ui/castle_2.png',  136, 136],
  ['castle_3',   'ui/castle_3.png',  160, 160],
  ['flag',       'ui/flag.png',      64, 96],
  ['army',       'ui/army.png',      96, 96],
  ['portrait_placeholder', 'ui/portrait_placeholder.png', 96, 120],
  ['icon_gold',     'icons/gold.png',     64, 64],
  ['icon_food',     'icons/food.png',     64, 64],
  ['icon_troops',   'icons/troops.png',   64, 64],
  ['icon_officer',  'icons/officer.png',  64, 64],
  ['icon_calendar', 'icons/calendar.png', 64, 64],
  ['cmd_domestic',  'icons/cmd_domestic.png',  64, 64],
  ['cmd_military',  'icons/cmd_military.png',  64, 64],
  ['cmd_personnel', 'icons/cmd_personnel.png', 64, 64],
  ['cmd_scheme',    'icons/cmd_scheme.png',    64, 64],
  ['cmd_diplomacy', 'icons/cmd_diplomacy.png', 64, 64],
  ['cmd_march',     'icons/cmd_march.png',     64, 64],
];

/** 결정적 난수(자리표시 그림이 매번 같게) */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 세 폰트가 준비될 때까지 기다린다(최대 ~4초). 실패해도 그냥 진행. */
async function waitFonts() {
  if (!document.fonts || !document.fonts.load) return;
  const specs = [
    ['32px "Nanum Brush Script"', KOREAN_SAMPLE],
    ['20px "Song Myung"', KOREAN_SAMPLE],
    ['900 32px "Noto Serif KR"', HANJA_SAMPLE],
  ];
  const deadline = performance.now() + 4000;
  for (const [font, text] of specs) {
    // Google Fonts CSS 가 아직 안 왔으면 load() 가 빈 배열을 돌려준다 → 잠깐 쉬고 다시
    for (;;) {
      let faces = [];
      try { faces = await document.fonts.load(font, text); } catch (e) { break; }
      if (faces.length > 0 || performance.now() > deadline) break;
      await new Promise((r) => setTimeout(r, 150));
    }
  }
  try {
    await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]);
  } catch (e) { /* 무시 */ }
}

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    this.missing = new Set();
    this.load.setPath('assets/');
    // 실패한 파일은 키만 기록한다 (Phaser 가 콘솔에 오류를 찍지만 진행에는 지장 없다)
    this.load.on('loaderror', (file) => { this.missing.add(file.key); });
    for (const [key, path] of ASSETS) this.load.image(key, path);

    // 진행 바 — 폰트가 아직 없으니 글자는 그리지 않는다
    const W = this.scale.width, H = this.scale.height;
    const frame = this.add.graphics();
    frame.lineStyle(2, 0xb08a3e, 1).strokeRoundedRect(W / 2 - 200, H / 2 - 10, 400, 20, 6);
    const bar = this.add.graphics();
    this.load.on('progress', (v) => {
      bar.clear().fillStyle(0xd9b25a, 1).fillRoundedRect(W / 2 - 196, H / 2 - 6, Math.max(8, 392 * v), 12, 4);
    });
  }

  async create() {
    // 로드가 끝나도 텍스처가 없는 키(0×0 등)까지 잡는다
    for (const [key] of ASSETS) if (!this.textures.exists(key)) this.missing.add(key);
    const missing = [...this.missing];
    this.registry.set('missing', missing);
    if (missing.length) console.warn('[군영전] 자리표시로 대체한 에셋:', missing.join(', '));

    this.makeFallbacks(missing);
    this.makeAlwaysTextures();

    await waitFonts();
    this.scene.start('MapScene');
  }

  // ─────────────────────────────────────────────────────────────
  // 자리표시 텍스처
  // ─────────────────────────────────────────────────────────────

  /** 빠진 키마다 같은 이름·같은 크기의 자리표시 텍스처를 만든다 */
  makeFallbacks(missing) {
    const draw = {
      map: () => this.fbMap(),
      clouds: () => this.fbClouds(),
      panel: () => this.fbPanel(),
      parchment: () => this.fbParchment(),
      button: () => this.fbButton('button', false),
      button_down: () => this.fbButton('button_down', true),
      hud_bar: () => this.fbHudBar(),
      banner: () => this.fbBanner(),
      castle_1: () => this.fbCastle('castle_1', 112),
      castle_2: () => this.fbCastle('castle_2', 136),
      castle_3: () => this.fbCastle('castle_3', 160),
      flag: () => this.fbFlag(),
      army: () => this.fbArmy(),
      portrait_placeholder: () => this.fbPortrait(),
      icon_gold: () => this.fbIcon('icon_gold'),
      icon_food: () => this.fbIcon('icon_food'),
      icon_troops: () => this.fbIcon('icon_troops'),
      icon_officer: () => this.fbIcon('icon_officer'),
      icon_calendar: () => this.fbIcon('icon_calendar'),
      cmd_domestic: () => this.fbIcon('cmd_domestic'),
      cmd_military: () => this.fbIcon('cmd_military'),
      cmd_personnel: () => this.fbIcon('cmd_personnel'),
      cmd_scheme: () => this.fbIcon('cmd_scheme'),
      cmd_diplomacy: () => this.fbIcon('cmd_diplomacy'),
      cmd_march: () => this.fbIcon('cmd_march'),
    };
    for (const key of missing) {
      if (this.textures.exists(key)) continue;
      const fn = draw[key];
      if (fn) fn();
    }
  }

  /** 에셋 계약에 없는, 코드가 늘 쓰는 텍스처(파티클 먼지·빛 무리) */
  makeAlwaysTextures() {
    if (!this.textures.exists('dust')) {
      const t = this.textures.createCanvas('dust', 24, 24);
      const c = t.context;
      const g = c.createRadialGradient(12, 12, 1, 12, 12, 12);
      g.addColorStop(0, 'rgba(214,190,140,0.9)');
      g.addColorStop(1, 'rgba(214,190,140,0)');
      c.fillStyle = g; c.fillRect(0, 0, 24, 24);
      t.refresh();
    }
    if (!this.textures.exists('glow')) {
      const t = this.textures.createCanvas('glow', 160, 160);
      const c = t.context;
      const g = c.createRadialGradient(80, 80, 6, 80, 80, 80);
      g.addColorStop(0, 'rgba(255,255,255,0.85)');
      g.addColorStop(0.45, 'rgba(255,255,255,0.28)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(0, 0, 160, 160);
      t.refresh();
    }
  }

  /** 지도 — SPEC §2 개형을 Canvas 2D 로 대충 그린 수묵 담채풍 자리표시 */
  fbMap() {
    const W = 2000, H = 1560;
    const t = this.textures.createCanvas('map', W, H);
    const c = t.context;
    const rnd = rng(7);

    // 땅(한지색) 바탕
    const bg = c.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#d8c69b'); bg.addColorStop(0.5, '#cfbc90'); bg.addColorStop(1, '#c4b085');
    c.fillStyle = bg; c.fillRect(0, 0, W, H);
    // 종이 얼룩
    for (let i = 0; i < 260; i++) {
      const x = rnd() * W, y = rnd() * H, r = 20 + rnd() * 120;
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      const dark = rnd() < 0.5;
      g.addColorStop(0, dark ? 'rgba(120,95,60,0.10)' : 'rgba(255,245,215,0.12)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
    }

    // 평야(옅은 초록)
    const plains = [[600, 300, 260], [640, 420, 220], [700, 200, 180], [450, 340, 160], [270, 480, 110], [560, 560, 150]];
    for (const [x, y, r] of plains) {
      const g = c.createRadialGradient(x * S, y * S, 0, x * S, y * S, r * S);
      g.addColorStop(0, 'rgba(150,170,110,0.35)'); g.addColorStop(1, 'rgba(150,170,110,0)');
      c.fillStyle = g; c.fillRect((x - r) * S, (y - r) * S, r * 2 * S, r * 2 * S);
    }

    // 바다 — 발해·황해(동북), 동해·남해(동남·남)
    const sea = (pts) => {
      c.beginPath();
      pts.forEach(([x, y], i) => (i ? c.lineTo(x * S, y * S) : c.moveTo(x * S, y * S)));
      c.closePath();
      const g = c.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, '#8fb0c4'); g.addColorStop(1, '#6f95ae');
      c.fillStyle = g; c.fill();
      c.strokeStyle = 'rgba(60,80,100,0.55)'; c.lineWidth = 6; c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 14; c.stroke();
    };
    sea([[1000, -10], [905, -10], [925, 40], [940, 100], [905, 150], [890, 200], [860, 250], [875, 300], [850, 350], [870, 400], [895, 430], [1000, 430]]);
    sea([[1000, 425], [890, 445], [860, 480], [850, 520], [830, 560], [845, 610], [820, 650], [830, 700], [790, 720], [720, 745], [640, 752], [560, 757], [480, 762], [420, 776], [380, 790], [1000, 790]]);
    // 잔물결
    c.strokeStyle = 'rgba(255,255,255,0.28)'; c.lineWidth = 2;
    for (let i = 0; i < 90; i++) {
      const inNE = rnd() < 0.5;
      const x = inNE ? 900 + rnd() * 100 : 830 + rnd() * 170;
      const y = inNE ? 20 + rnd() * 380 : 460 + rnd() * 300;
      c.beginPath(); c.moveTo(x * S, y * S);
      c.quadraticCurveTo((x + 8) * S, (y - 4) * S, (x + 16) * S, y * S);
      c.stroke();
    }

    // 사막(서북)
    {
      const g = c.createRadialGradient(150 * S, 150 * S, 40 * S, 150 * S, 150 * S, 230 * S);
      g.addColorStop(0, 'rgba(236,220,170,0.95)'); g.addColorStop(0.7, 'rgba(232,214,160,0.6)'); g.addColorStop(1, 'rgba(232,214,160,0)');
      c.fillStyle = g; c.fillRect(0, 0, 420 * S, 380 * S);
      c.strokeStyle = 'rgba(180,150,90,0.35)'; c.lineWidth = 2;
      for (let i = 0; i < 40; i++) {
        const x = 20 + rnd() * 220, y = 20 + rnd() * 260;
        c.beginPath(); c.moveTo(x * S, y * S); c.quadraticCurveTo((x + 15) * S, (y - 6) * S, (x + 30) * S, y * S); c.stroke();
      }
    }

    // 남중(남만) 밀림
    for (let i = 0; i < 70; i++) {
      const x = 150 + rnd() * 200, y = 540 + rnd() * 170, r = 10 + rnd() * 26;
      c.fillStyle = `rgba(${60 + rnd() * 30 | 0},${100 + rnd() * 40 | 0},${60 + rnd() * 20 | 0},0.35)`;
      c.beginPath(); c.arc(x * S, y * S, r * S, 0, Math.PI * 2); c.fill();
    }
    // 형주 남부·강동 숲
    for (let i = 0; i < 50; i++) {
      const x = 470 + rnd() * 200, y = 580 + rnd() * 110, r = 8 + rnd() * 18;
      c.fillStyle = 'rgba(90,130,80,0.25)';
      c.beginPath(); c.arc(x * S, y * S, r * S, 0, Math.PI * 2); c.fill();
    }

    // 산 — 작은 삼각 산봉우리를 뿌린다
    const mountain = (x, y, size) => {
      const h = size * S, w = size * 1.3 * S;
      c.fillStyle = '#8d7b5f';
      c.beginPath(); c.moveTo(x * S - w / 2, y * S + h * 0.4); c.lineTo(x * S, y * S - h * 0.6); c.lineTo(x * S + w / 2, y * S + h * 0.4); c.closePath(); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.28)';
      c.beginPath(); c.moveTo(x * S, y * S - h * 0.6); c.lineTo(x * S + w / 2, y * S + h * 0.4); c.lineTo(x * S + w * 0.1, y * S + h * 0.4); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(50,40,25,0.6)'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(x * S - w / 2, y * S + h * 0.4); c.lineTo(x * S, y * S - h * 0.6); c.lineTo(x * S + w / 2, y * S + h * 0.4); c.stroke();
    };
    // 진령: 한중 위 y≈380, x 300~450
    for (let i = 0; i <= 9; i++) mountain(300 + i * 17 + rnd() * 6, 376 + rnd() * 10, 12 + rnd() * 8);
    // 태행: 진양~업 사이 x≈600 세로
    for (let i = 0; i <= 6; i++) mountain(598 + rnd() * 10, 196 + i * 16, 11 + rnd() * 6);
    // 파촉 분지 둘레(남동쪽 물길은 비운다)
    for (let a = 100; a < 440; a += 22) {
      const r = a * Math.PI / 180;
      mountain(278 + Math.cos(r) * 92, 478 + Math.sin(r) * 78, 10 + rnd() * 7);
    }
    // 서량·북방 산지 조금
    for (let i = 0; i < 12; i++) mountain(240 + rnd() * 80, 250 + rnd() * 50, 9 + rnd() * 6);
    for (let i = 0; i < 8; i++) mountain(760 + rnd() * 80, 100 + rnd() * 50, 9 + rnd() * 6);
    for (let i = 0; i < 8; i++) mountain(470 + rnd() * 40, 330 + rnd() * 30, 8 + rnd() * 5); // 홍농 협곡

    // 강 — 중간점을 지나는 2차 곡선으로 부드럽게
    const river = (pts) => {
      const P = pts.map(([x, y]) => [x * S, y * S]);
      const path = () => {
        c.beginPath(); c.moveTo(P[0][0], P[0][1]);
        for (let i = 1; i < P.length - 1; i++) {
          const mx = (P[i][0] + P[i + 1][0]) / 2, my = (P[i][1] + P[i + 1][1]) / 2;
          c.quadraticCurveTo(P[i][0], P[i][1], mx, my);
        }
        c.lineTo(P[P.length - 1][0], P[P.length - 1][1]);
      };
      c.lineCap = 'round'; c.lineJoin = 'round';
      path(); c.strokeStyle = 'rgba(60,85,110,0.55)'; c.lineWidth = 16; c.stroke();
      path(); c.strokeStyle = '#7d9fb8'; c.lineWidth = 10; c.stroke();
      path(); c.strokeStyle = 'rgba(200,225,240,0.7)'; c.lineWidth = 3; c.stroke();
    };
    river([[198, 322], [250, 318], [298, 330], [340, 305], [385, 296], [417, 300], [455, 318], [487, 320], [543, 320], [590, 335], [632, 338], [672, 330], [702, 285], [760, 292], [830, 300], [880, 300]]);
    river([[232, 520], [275, 532], [320, 527], [360, 512], [392, 501], [450, 530], [519, 542], [565, 548], [610, 531], [645, 545], [679, 552], [720, 530], [758, 507], [790, 522], [814, 532], [845, 538], [875, 540]]);

    // 가장자리 비네트
    const v = c.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 0.85);
    v.addColorStop(0, 'rgba(40,25,10,0)'); v.addColorStop(1, 'rgba(40,25,10,0.55)');
    c.fillStyle = v; c.fillRect(0, 0, W, H);

    t.refresh();
  }

  /** 구름 조각 — 가장자리 투명, 부드러운 흰 덩어리들 */
  fbClouds() {
    const W = 1024, H = 512;
    const t = this.textures.createCanvas('clouds', W, H);
    const c = t.context;
    const rnd = rng(11);
    c.clearRect(0, 0, W, H);
    for (let i = 0; i < 22; i++) {
      const x = 120 + rnd() * (W - 240), y = 90 + rnd() * (H - 180), r = 50 + rnd() * 110;
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,0.55)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.22)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    t.refresh();
  }

  /** 창틀 9-slice 384×384, 모서리 48 — 옻칠 목재 + 청동 테두리, 가운데 반투명 */
  fbPanel() {
    const g = this.add.graphics();
    g.fillStyle(0x2b1a0e, 1).fillRoundedRect(0, 0, 384, 384, 26);
    g.lineStyle(4, 0x8a6a2f, 1).strokeRoundedRect(6, 6, 372, 372, 22);
    g.lineStyle(2, 0xd2ad5a, 1).strokeRoundedRect(13, 13, 358, 358, 18);
    g.fillStyle(0x0f0a06, 0.85).fillRoundedRect(20, 20, 344, 344, 14);
    // 모서리 장식(청동 못)
    for (const [x, y] of [[24, 24], [360, 24], [24, 360], [360, 360]]) {
      g.fillStyle(0xb08a3e, 1).fillCircle(x, y, 7);
      g.fillStyle(0xe8c46a, 1).fillCircle(x - 2, y - 2, 2.5);
    }
    g.generateTexture('panel', 384, 384);
    g.destroy();
  }

  /** 안쪽 한지 9-slice 256×256, 모서리 24 */
  fbParchment() {
    const g = this.add.graphics();
    g.fillStyle(0xe9dcbb, 1).fillRoundedRect(0, 0, 256, 256, 12);
    g.lineStyle(2, 0xb8996a, 1).strokeRoundedRect(3, 3, 250, 250, 10);
    g.lineStyle(1, 0xcfb888, 1).strokeRoundedRect(8, 8, 240, 240, 8);
    const rnd = rng(3);
    for (let i = 0; i < 70; i++) {
      g.fillStyle(0xb89a68, 0.18 + rnd() * 0.2).fillCircle(26 + rnd() * 204, 26 + rnd() * 204, 1 + rnd() * 2.5);
    }
    g.generateTexture('parchment', 256, 256);
    g.destroy();
  }

  /** 버튼 9-slice 256×96, 모서리 32 — 목재 + 금테 (down 은 어둡게) */
  fbButton(key, down) {
    const g = this.add.graphics();
    g.fillStyle(down ? 0x3d2513 : 0x6a4324, 1).fillRoundedRect(0, 0, 256, 96, 18);
    g.lineStyle(4, down ? 0x9a7a3a : 0xd9b25a, 1).strokeRoundedRect(4, 4, 248, 88, 15);
    if (!down) g.lineStyle(2, 0x8a5a34, 1).strokeRoundedRect(10, 10, 236, 76, 11);
    g.generateTexture(key, 256, 96);
    g.destroy();
  }

  /** 상단 HUD 띠 1280×72 */
  fbHudBar() {
    const g = this.add.graphics();
    g.fillStyle(0x1a120c, 0.94).fillRect(0, 0, 1280, 72);
    g.fillStyle(0x2a1c12, 0.9).fillRect(0, 0, 1280, 30);
    g.fillStyle(0xb08a3e, 1).fillRect(0, 68, 1280, 4);
    g.fillStyle(0x6a5030, 1).fillRect(0, 0, 1280, 2);
    // 양 끝 장식(마름모 + 선)
    for (const x of [26, 1254]) {
      g.fillStyle(0xd9b25a, 1).fillPoints([{ x, y: 20 }, { x: x + 12, y: 36 }, { x, y: 52 }, { x: x - 12, y: 36 }], true);
      g.fillStyle(0x2a1c12, 1).fillCircle(x, 36, 4);
    }
    g.lineStyle(2, 0x8a6a2f, 1).lineBetween(48, 36, 60, 36).lineBetween(1220, 36, 1232, 36);
    g.generateTexture('hud_bar', 1280, 72);
    g.destroy();
  }

  /** 제목 리본 512×128 — 붉은 비단 + 금테, 가운데 비움 */
  fbBanner() {
    const g = this.add.graphics();
    // 양 끝 제비꼬리
    g.fillStyle(0x7a1e1a, 1)
      .fillPoints([{ x: 70, y: 22 }, { x: 14, y: 64 }, { x: 70, y: 106 }, { x: 40, y: 64 }], true)
      .fillPoints([{ x: 442, y: 22 }, { x: 498, y: 64 }, { x: 442, y: 106 }, { x: 472, y: 64 }], true);
    g.fillStyle(0x9b2a24, 1).fillRoundedRect(56, 18, 400, 92, 10);
    g.lineStyle(4, 0xd9b25a, 1).strokeRoundedRect(62, 24, 388, 80, 8);
    g.fillStyle(0xb8352c, 1).fillRoundedRect(70, 32, 372, 26, 6);
    g.generateTexture('banner', 512, 128);
    g.destroy();
  }

  /** 성 아이콘 — 사각 탑(성벽 + 망루 + 지붕). key 별 크기 */
  fbCastle(key, size) {
    const g = this.add.graphics();
    const w = size, h = size;
    const cx = w / 2;
    // 그림자
    g.fillStyle(0x000000, 0.25).fillEllipse(cx, h * 0.86, w * 0.8, h * 0.18);
    // 성벽
    const ww = w * 0.72, wh = h * 0.3, wx = cx - ww / 2, wy = h * 0.55;
    g.fillStyle(0x8f8168, 1).fillRect(wx, wy, ww, wh);
    g.fillStyle(0x6d6250, 1).fillRect(wx, wy + wh - 6, ww, 6);
    g.lineStyle(2, 0x3a2f24, 1).strokeRect(wx, wy, ww, wh);
    // 성가퀴
    const n = 6, bw = ww / (n * 2 - 1);
    for (let i = 0; i < n; i++) {
      g.fillStyle(0x9a8c74, 1).fillRect(wx + i * bw * 2, wy - bw * 0.9, bw, bw * 0.9);
      g.lineStyle(2, 0x3a2f24, 1).strokeRect(wx + i * bw * 2, wy - bw * 0.9, bw, bw * 0.9);
    }
    // 성문
    g.fillStyle(0x3a2a1a, 1).fillRoundedRect(cx - ww * 0.1, wy + wh * 0.35, ww * 0.2, wh * 0.65, { tl: 6, tr: 6, bl: 0, br: 0 });
    // 망루
    const tw = w * 0.36, th = h * 0.34, tx = cx - tw / 2, ty = wy - th + 2;
    g.fillStyle(0xa79a80, 1).fillRect(tx, ty, tw, th);
    g.lineStyle(2, 0x3a2f24, 1).strokeRect(tx, ty, tw, th);
    g.fillStyle(0x3a2a1a, 1).fillRect(cx - tw * 0.12, ty + th * 0.35, tw * 0.24, th * 0.3);
    // 지붕(처마)
    g.fillStyle(0x8a3a2a, 1).fillPoints([{ x: tx - w * 0.08, y: ty + 2 }, { x: cx, y: ty - h * 0.2 }, { x: tx + tw + w * 0.08, y: ty + 2 }], true);
    g.lineStyle(2, 0x3a1a12, 1).strokePoints([{ x: tx - w * 0.08, y: ty + 2 }, { x: cx, y: ty - h * 0.2 }, { x: tx + tw + w * 0.08, y: ty + 2 }], true);
    g.fillStyle(0xd9b25a, 1).fillCircle(cx, ty - h * 0.2, 3);
    g.generateTexture(key, w, h);
    g.destroy();
  }

  /** 깃발 64×96 — 흰 삼각기 + 깃대 (코드에서 세력색 tint) */
  fbFlag() {
    const g = this.add.graphics();
    g.fillStyle(0xd8d0c0, 1).fillRect(6, 0, 4, 96);
    g.fillStyle(0xf0e8dc, 1).fillCircle(8, 3, 4);
    g.fillStyle(0xffffff, 1).fillTriangle(10, 6, 60, 22, 10, 40);
    g.lineStyle(2, 0x555555, 0.6).strokeTriangle(10, 6, 60, 22, 10, 40);
    g.generateTexture('flag', 64, 96);
    g.destroy();
  }

  /** 행군 부대 96×96 — 기마 무장 실루엣 */
  fbArmy() {
    const g = this.add.graphics();
    const col = 0x2e2015;
    g.fillStyle(0x000000, 0.25).fillEllipse(48, 86, 70, 12);
    // 말 몸통·목·머리·다리
    g.fillStyle(col, 1).fillEllipse(46, 58, 54, 26);
    g.fillTriangle(64, 50, 82, 28, 74, 60);
    g.fillEllipse(84, 28, 16, 10);
    g.lineStyle(6, col, 1);
    g.lineBetween(30, 66, 24, 86).lineBetween(40, 68, 38, 86).lineBetween(56, 68, 60, 86).lineBetween(66, 64, 74, 84);
    // 꼬리
    g.lineStyle(5, col, 1).lineBetween(20, 56, 8, 70);
    // 기수
    g.fillStyle(col, 1).fillEllipse(44, 36, 16, 22);
    g.fillCircle(44, 20, 8);
    // 창 + 작은 깃발
    g.lineStyle(3, 0x5a4a3a, 1).lineBetween(58, 62, 74, 6);
    g.fillStyle(0xb8352c, 1).fillTriangle(74, 6, 92, 12, 76, 18);
    g.generateTexture('army', 96, 96);
    g.destroy();
  }

  /** 무장 초상 자리표시 96×120 */
  fbPortrait() {
    const g = this.add.graphics();
    g.fillStyle(0x2a2018, 1).fillRoundedRect(0, 0, 96, 120, 8);
    g.fillStyle(0x6a5a48, 1).fillEllipse(48, 100, 76, 60);
    g.fillStyle(0x2a2018, 1).fillRect(0, 112, 96, 8);
    g.fillStyle(0x7a6a58, 1).fillCircle(48, 46, 21);
    g.lineStyle(3, 0x9a7a3a, 1).strokeRoundedRect(2, 2, 92, 116, 7);
    g.generateTexture('portrait_placeholder', 96, 120);
    g.destroy();
  }

  /** 자원·커맨드 아이콘 64×64 — 금색 단순 도형 */
  fbIcon(key) {
    const g = this.add.graphics();
    const gold = 0xe6c36a, dark = 0x3a2a12;
    g.lineStyle(3, dark, 1);
    switch (key) {
      case 'icon_gold':   // 금괴
        g.fillStyle(gold, 1).fillPoints([{ x: 14, y: 44 }, { x: 22, y: 26 }, { x: 42, y: 26 }, { x: 50, y: 44 }], true);
        g.strokePoints([{ x: 14, y: 44 }, { x: 22, y: 26 }, { x: 42, y: 26 }, { x: 50, y: 44 }], true);
        g.fillStyle(0xfff0b0, 1).fillRect(24, 30, 10, 4);
        break;
      case 'icon_food':   // 쌀가마
        g.fillStyle(0xd8b57a, 1).fillRoundedRect(16, 22, 32, 34, 8);
        g.strokeRoundedRect(16, 22, 32, 34, 8);
        g.fillStyle(0xb8955a, 1).fillRect(24, 14, 16, 10);
        g.lineBetween(24, 14, 40, 14);
        break;
      case 'icon_troops': // 창검 교차
        g.lineStyle(5, 0xc0c0c0, 1).lineBetween(16, 50, 46, 18).lineBetween(48, 50, 18, 18);
        g.fillStyle(gold, 1).fillTriangle(42, 22, 52, 12, 48, 24).fillTriangle(22, 22, 12, 12, 16, 24);
        g.lineStyle(3, dark, 1).lineBetween(16, 50, 46, 18).lineBetween(48, 50, 18, 18);
        break;
      case 'icon_officer': // 사람
        g.fillStyle(0xd9c9a8, 1).fillCircle(32, 22, 10);
        g.fillEllipse(32, 52, 34, 26);
        g.fillStyle(0x1a120c, 1).fillRect(12, 52, 40, 12);
        g.strokeCircle(32, 22, 10);
        break;
      case 'icon_calendar': // 달력
        g.fillStyle(0xf0e6d2, 1).fillRoundedRect(12, 16, 40, 36, 4);
        g.fillStyle(0xb8352c, 1).fillRect(12, 16, 40, 10);
        g.strokeRoundedRect(12, 16, 40, 36, 4);
        g.fillStyle(dark, 1).fillRect(20, 32, 6, 6).fillRect(30, 32, 6, 6).fillRect(40, 32, 6, 6).fillRect(20, 42, 6, 6);
        break;
      case 'cmd_domestic': // 괭이
        g.lineStyle(5, 0x8a5a34, 1).lineBetween(16, 52, 44, 20);
        g.fillStyle(gold, 1).fillPoints([{ x: 40, y: 12 }, { x: 54, y: 22 }, { x: 46, y: 30 }, { x: 34, y: 20 }], true);
        g.lineStyle(3, dark, 1).strokePoints([{ x: 40, y: 12 }, { x: 54, y: 22 }, { x: 46, y: 30 }, { x: 34, y: 20 }], true);
        break;
      case 'cmd_military': // 창
        g.lineStyle(5, 0x8a5a34, 1).lineBetween(14, 52, 44, 22);
        g.fillStyle(gold, 1).fillTriangle(40, 26, 54, 10, 46, 30);
        g.lineStyle(3, dark, 1).strokeTriangle(40, 26, 54, 10, 46, 30);
        g.fillStyle(0xb8352c, 1).fillTriangle(38, 30, 30, 40, 40, 36);
        break;
      case 'cmd_personnel': // 인장
        g.fillStyle(gold, 1).fillRect(16, 16, 32, 32);
        g.strokeRect(16, 16, 32, 32);
        g.fillStyle(0xb8352c, 1).fillRect(24, 24, 16, 16);
        break;
      case 'cmd_scheme': // 두루마리
        g.fillStyle(0xf0e6d2, 1).fillRect(18, 18, 28, 30);
        g.strokeRect(18, 18, 28, 30);
        g.fillStyle(0x8a5a34, 1).fillRoundedRect(12, 12, 40, 10, 5).fillRoundedRect(12, 44, 40, 10, 5);
        g.lineStyle(2, dark, 1).lineBetween(24, 28, 40, 28).lineBetween(24, 36, 40, 36);
        break;
      case 'cmd_diplomacy': { // 옥새(육각)
        const pts = [];
        for (let i = 0; i < 6; i++) {
          const a = Math.PI / 3 * i - Math.PI / 6;
          pts.push({ x: 32 + Math.cos(a) * 20, y: 32 + Math.sin(a) * 20 });
        }
        g.fillStyle(0x7fc8a0, 1).fillPoints(pts, true);
        g.strokePoints(pts, true);
        g.fillStyle(gold, 1).fillCircle(32, 32, 7);
        break;
      }
      case 'cmd_march': // 말
        g.fillStyle(gold, 1).fillEllipse(30, 36, 32, 16);
        g.fillTriangle(42, 30, 54, 16, 48, 38);
        g.fillEllipse(54, 16, 10, 7);
        g.lineStyle(4, gold, 1).lineBetween(20, 42, 16, 54).lineBetween(28, 44, 26, 54).lineBetween(38, 44, 40, 54).lineBetween(44, 40, 50, 52);
        g.lineStyle(2, dark, 1).strokeEllipse(30, 36, 32, 16);
        break;
      default:
        g.fillStyle(gold, 1).fillCircle(32, 32, 20);
        g.strokeCircle(32, 32, 20);
    }
    g.generateTexture(key, 64, 64);
    g.destroy();
  }
}
