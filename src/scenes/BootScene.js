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

/**
 * BATTLE.md §5 전투 선택 에셋: [키, 경로]. 없어도 코드 폴백으로 전부 돈다 — 계약 검사(smoke) 대상이 아니라 ASSETS 와 분리.
 * 배경 3겹은 없으면 fbBattle*() 로 같은 키의 캔버스 텍스처를 만들고, 컷인·병사 일러스트는 없으면 코드 실루엣/붓글씨로.
 */
export const BATTLE_ASSETS = [
  ['battle_sky',        'battle/sky.png'],          // 2048×720
  ['battle_far',        'battle/far.png'],          // 2048×360 먼 산, 위 투명
  ['battle_ground',     'battle/ground.png'],       // 1024×320 가로 반복
  ['cutin_guanyu',      'battle/cutin/guanyu.png'],
  ['cutin_zhangfei',    'battle/cutin/zhangfei.png'],
  ['cutin_xiahoudun',   'battle/cutin/xiahoudun.png'],
  ['cutin_dianwei',     'battle/cutin/dianwei.png'],
  ['bunit_inf',         'battle/units/inf.png'],    // 96×128, 옆모습 오른쪽 보기, 옷 회백색(코드 tint)
  ['bunit_spear',       'battle/units/spear.png'],
  ['bunit_bow',         'battle/units/bow.png'],
  ['bunit_cav',         'battle/units/cav.png'],
  ['bunit_general_left',  'battle/units/general_left.png'],
  ['bunit_general_right', 'battle/units/general_right.png'],
];
const BATTLE_KEYS = new Set(BATTLE_ASSETS.map((a) => a[0]));

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
    this.missingBattle = new Set();   // 전투 선택 에셋은 따로 센다(없는 게 정상일 수 있어 경고 문구를 나눈다)
    this.load.setPath('assets/');
    // 실패한 파일은 키만 기록한다 (Phaser 가 콘솔에 오류를 찍지만 진행에는 지장 없다)
    this.load.on('loaderror', (file) => { (BATTLE_KEYS.has(file.key) ? this.missingBattle : this.missing).add(file.key); });
    for (const [key, path] of ASSETS) this.load.image(key, path);
    for (const [key, path] of BATTLE_ASSETS) this.load.image(key, path);

    // 진행 바 — 폰트가 아직 없으니 글자는 그리지 않는다
    // 컨테이너에 넣어 로딩 중 창 비율이 바뀌어도(main.js relayout → RESIZE) 가운데를 지킨다
    const box = this.add.container(this.scale.width / 2, this.scale.height / 2);
    const frame = this.add.graphics();
    frame.lineStyle(2, 0xb08a3e, 1).strokeRoundedRect(-200, -10, 400, 20, 6);
    const bar = this.add.graphics();
    box.add([frame, bar]);
    this.load.on('progress', (v) => {
      bar.clear().fillStyle(0xd9b25a, 1).fillRoundedRect(-196, -6, Math.max(8, 392 * v), 12, 4);
    });
    const onResize = (gs) => box.setPosition(gs.width / 2, gs.height / 2);
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, onResize));
  }

  async create() {
    // 로드가 끝나도 텍스처가 없는 키(0×0 등)까지 잡는다
    for (const [key] of ASSETS) if (!this.textures.exists(key)) this.missing.add(key);
    const missing = [...this.missing];
    this.registry.set('missing', missing);
    if (missing.length) console.warn('[군영전] 자리표시로 대체한 에셋:', missing.join(', '));

    this.makeFallbacks(missing);
    this.makeAlwaysTextures();

    // 전투(BATTLE.md §4.1): 선택 에셋이 없으면 배경은 캔버스 폴백, 병종·무장 실루엣은 늘 코드로 만든다
    for (const [key] of BATTLE_ASSETS) if (!this.textures.exists(key)) this.missingBattle.add(key);
    const missingBattle = [...this.missingBattle];
    this.registry.set('missingBattle', missingBattle);
    if (missingBattle.length) console.info('[군영전] 전투 선택 에셋 없음(코드 폴백):', missingBattle.join(', '));
    this.makeBattleTextures(missingBattle);

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

  // ─────────────────────────────────────────────────────────────
  // 전투 텍스처 (BATTLE.md §4.1·§5)
  // ─────────────────────────────────────────────────────────────

  /**
   * 병종·무장 실루엣은 흰색으로 그려 BattleScene 이 편 색으로 tint 한다(무기 글리프는 살짝 어둡게 → tint 뒤 명도 차).
   * 배경 3겹(sky/far/ground)은 에셋이 없을 때만 캔버스로 만든다. 화살·불꽃은 늘 만든다.
   * generateTexture 는 Graphics 의 (0,0) 이 캔버스 왼쪽 위 — 좌표를 그대로 캔버스 픽셀로 쓴다.
   */
  makeBattleTextures(missing) {
    const has = (k) => this.textures.exists(k);
    if (!has('unit_inf')) this.fbUnitSoldier('unit_inf', 'inf');
    if (!has('unit_spear')) this.fbUnitSoldier('unit_spear', 'spear');
    if (!has('unit_bow')) this.fbUnitSoldier('unit_bow', 'bow');
    if (!has('unit_cav')) this.fbUnitCav();
    if (!has('unit_general')) this.fbUnitGeneral();
    if (!has('arrow')) this.fbArrow();
    if (!has('spark')) this.fbSpark();
    const miss = new Set(missing);
    if (miss.has('battle_sky') && !has('battle_sky')) this.fbBattleSky();
    if (miss.has('battle_far') && !has('battle_far')) this.fbBattleFar();
    if (miss.has('battle_ground') && !has('battle_ground')) this.fbBattleGround();
  }

  /** 병사 24×34 치비 실루엣(발이 아래 가운데, 오른쪽 보기). kind 별 무기 글리프·몸 명도 */
  fbUnitSoldier(key, kind) {
    const g = this.add.graphics();
    const body = { inf: 0xffffff, spear: 0xf0f0f0, bow: 0xe2e2e2 }[kind] || 0xffffff;
    const wpn = 0xc4c4c4;
    // 머리·몸·다리
    g.fillStyle(body, 1).fillCircle(12, 8, 6);
    g.fillRoundedRect(6, 14, 12, 13, 3);
    g.fillRect(7, 27, 4, 7).fillRect(13, 27, 4, 7);
    // 투구 챙
    g.fillStyle(0xd8d8d8, 1).fillRect(6, 7, 12, 2);
    switch (kind) {
      case 'spear':   // 긴 창 + 촉
        g.lineStyle(2, wpn, 1).lineBetween(20, 33, 20, 3);
        g.fillStyle(0xe8e8e8, 1).fillTriangle(17, 5, 23, 5, 20, 0);
        break;
      case 'bow': {   // 활 + 시위
        g.lineStyle(2, wpn, 1);
        g.beginPath(); g.arc(17, 18, 9, -80 * Math.PI / 180, 80 * Math.PI / 180, false); g.strokePath();
        g.lineStyle(1, 0xf4f4f4, 0.9).lineBetween(18.5, 9.2, 18.5, 26.8);
        break;
      }
      default:        // 보병: 검(사선) + 둥근 방패
        g.lineStyle(2.5, wpn, 1).lineBetween(16, 23, 23, 9);
        g.fillStyle(0xe4e4e4, 1).fillCircle(5, 20, 4);
        g.lineStyle(1, 0xbcbcbc, 1).strokeCircle(5, 20, 4);
    }
    g.generateTexture(key, 24, 34);
    g.destroy();
  }

  /** 기병 32×34 — 말 + 기수 + 기창 */
  fbUnitCav() {
    const g = this.add.graphics();
    const horse = 0xd6d6d6, rider = 0xffffff, wpn = 0xc4c4c4;
    // 말 몸통·목·머리·다리·꼬리
    g.fillStyle(horse, 1).fillEllipse(15, 24, 24, 11);
    g.fillTriangle(24, 21, 31, 13, 28, 26);
    g.fillEllipse(30, 14, 7, 5);
    g.lineStyle(3, horse, 1).lineBetween(7, 28, 5, 34).lineBetween(12, 29, 11, 34).lineBetween(19, 29, 20, 34).lineBetween(24, 27, 27, 33);
    g.lineStyle(2, horse, 1).lineBetween(4, 22, 0, 28);
    // 기수
    g.fillStyle(rider, 1).fillCircle(14, 7, 5);
    g.fillRoundedRect(9, 12, 10, 11, 3);
    g.fillStyle(0xd8d8d8, 1).fillRect(9, 6, 10, 2);
    // 기창
    g.lineStyle(2, wpn, 1).lineBetween(18, 21, 30, 4);
    g.fillStyle(0xe8e8e8, 1).fillTriangle(28, 6, 32, 3, 30, 1);
    g.generateTexture('unit_cav', 32, 34);
    g.destroy();
  }

  /** 무장 44×60 — 큰 실루엣 + 등의 깃발 + 언월도 */
  fbUnitGeneral() {
    const g = this.add.graphics();
    const body = 0xffffff, wpn = 0xc8c8c8;
    // 등의 깃대·깃발(왼쪽 = 뒤)
    g.lineStyle(2, 0xdcdcdc, 1).lineBetween(10, 56, 10, 4);
    g.fillStyle(0xf0f0f0, 1).fillTriangle(10, 5, 1, 11, 10, 18);
    // 머리·투구 장식·몸·어깨·다리
    g.fillStyle(body, 1).fillCircle(24, 13, 8);
    g.fillCircle(24, 4, 3);
    g.fillRoundedRect(15, 20, 18, 22, 4);
    g.fillCircle(15, 23, 4).fillCircle(33, 23, 4);
    g.fillRect(17, 42, 6, 17).fillRect(26, 42, 6, 17);
    g.fillStyle(0xdedede, 1).fillRect(16, 11, 16, 2).fillRect(15, 30, 18, 2);
    // 언월도
    g.lineStyle(3, wpn, 1).lineBetween(37, 59, 37, 8);
    g.fillStyle(0xe8e8e8, 1).fillPoints([{ x: 37, y: 6 }, { x: 44, y: 14 }, { x: 37, y: 26 }, { x: 40, y: 15 }], true);
    g.generateTexture('unit_general', 44, 60);
    g.destroy();
  }

  /** 화살 18×4 — 촉이 오른쪽 */
  fbArrow() {
    const g = this.add.graphics();
    g.fillStyle(0xe8dcc0, 1).fillRect(0, 1, 15, 2);
    g.fillStyle(0xd8d8d8, 1).fillTriangle(14, 0, 18, 2, 14, 4);
    g.fillStyle(0xb8352c, 1).fillRect(0, 0, 3, 4);
    g.generateTexture('arrow', 18, 4);
    g.destroy();
  }

  /** 불꽃 16×16 — 흰 점(파티클) */
  fbSpark() {
    const t = this.textures.createCanvas('spark', 16, 16);
    const c = t.context;
    const gr = c.createRadialGradient(8, 8, 1, 8, 8, 8);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.5, 'rgba(255,255,255,0.6)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = gr; c.fillRect(0, 0, 16, 16);
    t.refresh();
  }

  /** 하늘 2048×720 — 해질녘 그라데이션 + 해 + 안개, 아래 1/3 은 땅색으로 이어진다 */
  fbBattleSky() {
    const Wd = 2048, Hd = 720;
    const t = this.textures.createCanvas('battle_sky', Wd, Hd);
    const c = t.context;
    const bg = c.createLinearGradient(0, 0, 0, Hd);
    bg.addColorStop(0, '#2e3a5c'); bg.addColorStop(0.35, '#8a6a7a'); bg.addColorStop(0.55, '#d9946a');
    bg.addColorStop(0.62, '#e8c28a'); bg.addColorStop(0.7, '#a08a60'); bg.addColorStop(1, '#6e5638');
    c.fillStyle = bg; c.fillRect(0, 0, Wd, Hd);
    // 해
    const sun = c.createRadialGradient(1500, 372, 10, 1500, 372, 140);
    sun.addColorStop(0, 'rgba(255,240,200,0.95)'); sun.addColorStop(0.25, 'rgba(255,210,140,0.55)'); sun.addColorStop(1, 'rgba(255,200,120,0)');
    c.fillStyle = sun; c.fillRect(1340, 220, 320, 320);
    // 옅은 구름 띠
    const rnd = rng(31);
    for (let i = 0; i < 26; i++) {
      const x = rnd() * Wd, y = 60 + rnd() * 260, w = 120 + rnd() * 300, h = 14 + rnd() * 22;
      // 납작한 타원 구름: 원형 그라데이션을 세로로 눌러 찍는다
      c.save();
      c.translate(x, y);
      c.scale(1, h / (w / 2));
      const gr = c.createRadialGradient(0, 0, 0, 0, 0, w / 2);
      gr.addColorStop(0, 'rgba(255,235,215,0.22)'); gr.addColorStop(1, 'rgba(255,235,215,0)');
      c.fillStyle = gr; c.fillRect(-w / 2, -w / 2, w, w);
      c.restore();
    }
    t.refresh();
  }

  /** 먼 산 2048×360 — 실루엣 두 겹, 위 투명. 가로 반복되게 주기 2048 의 sin 합으로 */
  fbBattleFar() {
    const Wd = 2048, Hd = 360;
    const t = this.textures.createCanvas('battle_far', Wd, Hd);
    const c = t.context;
    c.clearRect(0, 0, Wd, Hd);
    const ridge = (base, amp, seedA, seedB, color) => {
      c.fillStyle = color;
      c.beginPath(); c.moveTo(0, Hd);
      for (let x = 0; x <= Wd; x += 8) {
        const p = x / Wd * Math.PI * 2;
        const y = base - amp * (0.55 * Math.sin(p * 3 + seedA) + 0.3 * Math.sin(p * 7 + seedB) + 0.15 * Math.sin(p * 13 + seedA * 2) + 1.0);
        c.lineTo(x, y);
      }
      c.lineTo(Wd, Hd); c.closePath(); c.fill();
    };
    ridge(230, 70, 0.4, 1.9, 'rgba(90,100,130,0.55)');
    ridge(300, 55, 2.1, 0.7, 'rgba(70,78,100,0.8)');
    // 밑변은 땅과 이어지도록 흐릿하게
    const g = c.createLinearGradient(0, 300, 0, Hd);
    g.addColorStop(0, 'rgba(110,86,56,0)'); g.addColorStop(1, 'rgba(110,86,56,0.9)');
    c.fillStyle = g; c.fillRect(0, 300, Wd, 60);
    t.refresh();
  }

  /** 땅 1024×320 — 흙·풀·돌, 가로 반복(seamless: 조각을 x±1024 에도 찍는다) */
  fbBattleGround() {
    const Wd = 1024, Hd = 320;
    const t = this.textures.createCanvas('battle_ground', Wd, Hd);
    const c = t.context;
    const bg = c.createLinearGradient(0, 0, 0, Hd);
    bg.addColorStop(0, '#b39a6a'); bg.addColorStop(0.3, '#a58a5c'); bg.addColorStop(1, '#7e6440');
    c.fillStyle = bg; c.fillRect(0, 0, Wd, Hd);
    const rnd = rng(19);
    const wrap = (fn, x) => { fn(x); fn(x - Wd); fn(x + Wd); };
    for (let i = 0; i < 160; i++) {
      const x = rnd() * Wd, y = rnd() * Hd, r = 6 + rnd() * 30;
      const dark = rnd() < 0.5;
      wrap((xx) => {
        const gr = c.createRadialGradient(xx, y, 0, xx, y, r);
        gr.addColorStop(0, dark ? 'rgba(80,60,30,0.16)' : 'rgba(220,200,150,0.14)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = gr; c.fillRect(xx - r, y - r, r * 2, r * 2);
      }, x);
    }
    for (let i = 0; i < 140; i++) {   // 풀
      const x = rnd() * Wd, y = rnd() * Hd, h = 4 + rnd() * 7;
      wrap((xx) => {
        c.strokeStyle = `rgba(${90 + rnd() * 30 | 0},${120 + rnd() * 40 | 0},${60 + rnd() * 20 | 0},0.7)`; c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(xx, y); c.lineTo(xx - 2, y - h); c.moveTo(xx, y); c.lineTo(xx + 2, y - h * 0.8); c.stroke();
      }, x);
    }
    for (let i = 0; i < 40; i++) {    // 돌
      const x = rnd() * Wd, y = rnd() * Hd, r = 2 + rnd() * 4;
      wrap((xx) => {
        c.fillStyle = 'rgba(120,110,95,0.85)'; c.beginPath(); c.ellipse(xx, y, r, r * 0.6, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(xx + 1, y + r * 0.5, r, r * 0.35, 0, 0, Math.PI * 2); c.fill();
      }, x);
    }
    t.refresh();
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
