// UIScene — MapScene 위에 겹치는 HUD·커맨드 바·도시 패널·토스트·인트로 (SPEC §5.3).
// 카메라 영향을 안 받는 고정 좌표(1280×720). HTML 위젯은 하나도 쓰지 않는다.
//   MapScene → 'city:open'(city) 를 받아 패널을 연다.
//   패널을 닫으면 MapScene 에 'city:close' 를 보낸다.
//
// ※ 이 씬에 한글 문구를 새로 넣으면 factions.js 의 KOREAN_SAMPLE 에도 그 글자를 넣어라.
//   Google 한글 폰트는 유니코드 슬라이스라 표본에 없는 글자는 첫 렌더가 폴백 폰트로 찍힌다.
//   (tools/smoke.mjs 가 이 파일의 문자열 리터럴을 표본과 대조한다.)

import { RESOURCES, DATE, FACTIONS, PLAYER_ID, cityInfo, colorNum } from '../data/factions.js';
import { play as sfx } from '../sfx.js';

/** 논리 폭 — main.js 가 창 비율로 정한다(1280~1600). create() 에서 실제 값으로 바꾼다 */
let W = 1280;
const H = 720;

const FONT_BRUSH = '"Nanum Brush Script", "Song Myung", serif';
const FONT_BODY = '"Song Myung", "Noto Serif KR", serif';
const FONT_HANJA = '"Noto Serif KR", "Song Myung", serif';

/** 커맨드 6종 */
const CMDS = [
  { key: 'cmd_domestic',  label: '내정' },
  { key: 'cmd_military',  label: '군사' },
  { key: 'cmd_personnel', label: '인사' },
  { key: 'cmd_scheme',    label: '계략' },
  { key: 'cmd_diplomacy', label: '외교' },
  { key: 'cmd_march',     label: '출진' },
];

/**
 * 배치 수치 — 실제 에셋 크기에 맞춘 값. tools/smoke.mjs 가 9-slice 제약(2×corner ≤ 변)을 검사한다.
 *   panel.png 384² 모서리 48 / parchment.png 256² 모서리 24 / button.png 256×96 모서리 32
 *   hud_bar.png 1280×72: 메달리온 x 35~85·1195~1245, 글자 올릴 나무 띠 y 20~49(중심 35)
 *   banner.png 512×128: 리본 가운데 y 63.5, 금테 안쪽 세로 ≈ 20~108
 */
export const LAYOUT = {
  panel:     { w: 520, h: 500, corner: 48 },
  parchment: { w: 440, h: 360, corner: 24 },
  bar:       { h: 100, corner: 48 },                 // 커맨드 바(panel 9-slice)
  button:    { w: 124, h: 64, corner: 28, icon: 32, gap: 8 },
  toast:     { w: 360, h: 56, corner: 24 },
  hud:       { y: 36, icon: 28, dateX: 118, resX: 350, resStep: 172, playerX: 1050, safeX: [100, 1180] },
  banner:    { scale: 0.82, y: -222 },
};

/** 패널 크기 */
const PW = LAYOUT.panel.w;
const PH = LAYOUT.panel.h;

export default class UIScene extends Phaser.Scene {
  constructor() {
    super('UIScene');
  }

  create() {
    this.isWebGL = this.sys.game.renderer.type === Phaser.WEBGL;
    this.mapScene = this.scene.get('MapScene');
    this.panelOpen = false;

    // 폭이 1280 보다 넓으면(폰 가로) 오른쪽 기준 요소를 그만큼 민다. 기본값에서 계산해 씬 재시작에도 안전.
    W = this.scale.width;
    const extra = W - 1280;
    LAYOUT.hud.playerX = 1050 + extra;
    LAYOUT.hud.safeX = [100, 1180 + extra];

    // 창 비율이 바뀌어 main.js 가 restart({ noIntro: true, reopen }) 한 경우 — 인트로·카운트업 없이, 열려 있던 패널은 다시 연다
    const data = this.scene.settings.data || {};
    const noIntro = !!data.noIntro;

    this.buildHud(noIntro);
    this.buildCommandBar();
    this.buildToast();
    this.buildPanel();
    if (!noIntro) this.playIntro();

    this.mapScene.events.on('city:open', this.openPanel, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.mapScene.events.off('city:open', this.openPanel, this);
    });
    if (this.input.keyboard) {
      this.input.keyboard.on('keydown-ESC', () => this.closePanel());
    }
    if (data.reopen) this.openPanel(data.reopen);
  }

  // ─────────────────────────────────────────────────────────────
  // 공용: 9-slice 창틀 (텍스처 없거나 Canvas 렌더러면 대체 도형)
  // ─────────────────────────────────────────────────────────────

  /**
   * @returns {Phaser.GameObjects.GameObject} 가운데 기준(origin 0.5)의 창틀
   * nineslice 인자 순서: (x, y, key, frame, w, h, left, right, top, bottom)
   */
  frame9(x, y, key, w, h, l, r = l, t = l, b = t) {
    if (this.textures.exists(key)) {
      if (this.isWebGL) {
        return this.add.nineslice(x, y, key, undefined, w, h, l, r, t, b);
      }
      // Canvas 렌더러는 NineSlice 를 못 그린다 → 늘린 이미지로 대체
      return this.add.image(x, y, key).setDisplaySize(w, h);
    }
    // 최후 폴백: 둥근 사각
    const dark = key === 'parchment';
    return this.add.rectangle(x, y, w, h, dark ? 0xe9dcbb : 0x221a12, dark ? 1 : 0.92)
      .setStrokeStyle(3, dark ? 0xb8996a : 0x9a7a3a);
  }

  /** 아이콘(없으면 금색 네모) */
  icon(x, y, key, size) {
    if (this.textures.exists(key)) return this.add.image(x, y, key).setDisplaySize(size, size);
    return this.add.rectangle(x, y, size * 0.8, size * 0.8, 0xe6c36a).setStrokeStyle(2, 0x3a2a12);
  }

  // ─────────────────────────────────────────────────────────────
  // 상단 HUD
  // ─────────────────────────────────────────────────────────────

  /** @param instant true 면 숫자 카운트업 없이 최종값을 바로 찍는다(재배치 재시작) */
  buildHud(instant = false) {
    // hud_bar.png 는 1280 폭 — 더 넓으면 양 끝 메달리온(150px)을 고정하고 가운데 나무결만 늘린다(가로 3-slice).
    let bar;
    if (!this.textures.exists('hud_bar')) {
      bar = this.add.rectangle(0, 0, W, 72, 0x1a120c, 0.94).setOrigin(0);
    } else if (W > 1280 && this.isWebGL) {
      bar = this.add.nineslice(0, 0, 'hud_bar', 0, W, 72, 150, 150, 0, 0).setOrigin(0);
    } else {
      bar = this.add.image(0, 0, 'hud_bar').setOrigin(0).setDisplaySize(W, 72);
    }
    bar.setDepth(10).setInteractive();   // HUD 위 터치가 지도로 안 새게

    // hud_bar.png 의 나무 띠(y 20~49)는 한 줄 높이라 라벨·숫자를 세로로 쌓지 않고 한 줄에 놓는다.
    // 양 끝 메달리온(x<100, x>1180)은 비워 둔다.
    const L = LAYOUT.hud;
    const HY = L.y;

    // 날짜(붓글씨)
    this.icon(L.dateX, HY, 'icon_calendar', L.icon).setDepth(11);
    const date = this.add.text(L.dateX + 22, HY, DATE.text, {
      fontFamily: FONT_BRUSH, fontSize: '36px', color: '#f6e9c9', stroke: '#2a1a0c', strokeThickness: 4,
    }).setOrigin(0, 0.5).setDepth(11);

    // 자원 4종 — 아이콘 + 라벨 + 숫자(카운트업) 한 줄.
    // 붓글씨 폭은 폰트마다 달라 날짜 실측 폭 뒤에서 시작한다(기본 resX, 넘치면 밀림).
    const items = [
      ['icon_gold',    RESOURCES.gold,     '금'],
      ['icon_food',    RESOURCES.food,     '군량'],
      ['icon_troops',  RESOURCES.troops,   '병력'],
      ['icon_officer', RESOURCES.officers, '무장'],
    ];
    let x = Math.max(L.resX, Math.round(date.x + date.width + 30));
    for (const [key, val, label] of items) {
      this.icon(x, HY, key, L.icon).setDepth(11);
      const lab = this.add.text(x + 20, HY + 1, label, {
        fontFamily: FONT_BODY, fontSize: '20px', color: '#cdb98e',
      }).setOrigin(0, 0.5).setDepth(11);
      const num = this.add.text(x + 20 + lab.width + 6, HY, instant ? val.toLocaleString('ko-KR') : '0', {
        fontFamily: FONT_BODY, fontSize: '26px', color: '#f7e9c9', stroke: '#2a1a0c', strokeThickness: 3,
      }).setOrigin(0, 0.5).setDepth(11);
      if (!instant) {
        this.tweens.addCounter({
          from: 0, to: val, duration: 1200, delay: 400, ease: 'Cubic.easeOut',
          onUpdate: (tw) => num.setText(Math.round(tw.getValue()).toLocaleString('ko-KR')),
        });
      }
      x += L.resStep;
    }

    // 오른쪽: 플레이어 세력 표식 (오른쪽 메달리온 앞에서 끝나게)
    const player = FACTIONS.find((f) => f.id === PLAYER_ID);
    const col = colorNum(player.color);
    if (this.textures.exists('flag')) {
      this.add.image(L.playerX, HY, 'flag').setTint(col).setDisplaySize(26, 39).setDepth(11);
    } else {
      this.add.triangle(L.playerX, HY, 0, 0, 26, 8, 0, 16, col).setDepth(11);
    }
    this.add.text(L.playerX + 20, HY, `${player.ruler}군`, {
      fontFamily: FONT_BRUSH, fontSize: '32px', color: '#f6e9c9', stroke: '#2a1a0c', strokeThickness: 4,
    }).setOrigin(0, 0.5).setDepth(11);
  }

  // ─────────────────────────────────────────────────────────────
  // 우측 하단 커맨드 바
  // ─────────────────────────────────────────────────────────────

  buildCommandBar() {
    const B = LAYOUT.button;
    const bw = B.w, bh = B.h, gap = B.gap;
    const n = CMDS.length;
    const total = n * bw + (n - 1) * gap;          // 784
    const barW = total + 36, barH = LAYOUT.bar.h;   // panel 모서리 48×2 ≤ 100
    const barCx = W - 16 - barW / 2;
    const y = H - 8 - barH / 2;
    this.frame9(barCx, y, 'panel', barW, barH, LAYOUT.bar.corner).setDepth(10).setInteractive();

    const x0 = barCx - total / 2 + bw / 2;
    this.cmdButtons = CMDS.map((cmd, i) => this.makeButton(x0 + i * (bw + gap), y, bw, bh, cmd));
  }

  makeButton(x, y, bw, bh, cmd) {
    const B = LAYOUT.button;
    const c = this.add.container(x, y).setDepth(11);
    // button.png 모서리 32 — 높이 64 라 28 로 자른다(2×28 ≤ 64). 높이를 더 키우면 32 로.
    const up = this.frame9(0, 0, 'button', bw, bh, B.corner);
    const down = this.frame9(0, 0, 'button_down', bw, bh, B.corner).setVisible(false);
    const ic = this.icon(-30, 0, cmd.key, B.icon);
    const label = this.add.text(-8, 0, cmd.label, {
      fontFamily: FONT_BODY, fontSize: '24px', color: '#f7e9c9', stroke: '#2a1a0c', strokeThickness: 3,
    }).setOrigin(0, 0.5);
    c.add([up, down, ic, label]);
    c.setSize(bw, bh).setInteractive({ useHandCursor: true });

    const press = (on) => {
      up.setVisible(!on);
      down.setVisible(on);
      c.setScale(on ? 0.95 : 1);
      ic.y = on ? 2 : 0;
      label.y = on ? 2 : 0;
    };
    c.on('pointerdown', () => { press(true); sfx('click'); });
    c.on('pointerup', () => { press(false); this.toast(`${cmd.label} — 준비 중`); });
    c.on('pointerout', () => press(false));
    return c;
  }

  // ─────────────────────────────────────────────────────────────
  // 토스트
  // ─────────────────────────────────────────────────────────────

  buildToast() {
    this.toastBox = this.add.container(W / 2, H - 150).setDepth(30).setAlpha(0).setVisible(false);
    const T = LAYOUT.toast;
    const bg = this.frame9(0, 0, 'parchment', T.w, T.h, T.corner);
    this.toastText = this.add.text(0, 0, '', {
      fontFamily: FONT_BODY, fontSize: '24px', color: '#2a1a0c',
    }).setOrigin(0.5);
    this.toastBox.add([bg, this.toastText]);
  }

  toast(msg) {
    this.toastText.setText(msg);
    this.tweens.killTweensOf(this.toastBox);
    this.toastBox.setVisible(true).setAlpha(0).setY(H - 130);
    this.tweens.add({
      targets: this.toastBox, alpha: 1, y: H - 150, duration: 160, hold: 900, yoyo: true, ease: 'Quad.easeOut',
      onComplete: () => this.toastBox.setVisible(false),
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 도시 패널
  // ─────────────────────────────────────────────────────────────

  buildPanel() {
    // 패널 뒤 어둡게 — 탭하면 닫힘(드래그는 무시)
    this.dim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 1)
      .setAlpha(0).setVisible(false).setDepth(20).setInteractive();
    this.dim.on('pointerup', (p) => { if (p.getDistance() <= 8) this.closePanel(); });

    // 패널 (W-300,350): 1280 기준 x 720~1240, y 100~600. HUD(0~72)·커맨드 바(612~)와 안 겹친다.
    const P = this.panel = this.add.container(W - 300, 350).setDepth(21).setVisible(false).setAlpha(0);

    // 창틀 — 실제 그림의 틀 두께 ≈ 30px, 안쪽은 α0.85 짙은색
    P.add(this.frame9(0, 0, 'panel', PW, PH, LAYOUT.panel.corner));

    // 배너(리본) — 창틀 위 변에 걸치게(위로 24px 삐져나옴). 512×128 × 0.82 = 420×105, 세로 -274~-170
    const BN = LAYOUT.banner;
    const banner = this.textures.exists('banner')
      ? this.add.image(0, BN.y, 'banner').setScale(BN.scale)
      : this.add.rectangle(0, BN.y, 420, 76, 0x9b2a24).setStrokeStyle(4, 0xd9b25a);
    P.add(banner);

    // 세력색 강조선 — 배너 아래, 한지 위 틈에
    this.pAccent = this.add.rectangle(0, -158, 380, 3, 0xffffff, 0.95);
    P.add(this.pAccent);

    // 도시명(한글 붓글씨 + 한자) — 리본 가운데(y = BN.y)
    this.pName = this.add.text(-6, BN.y - 2, '', {
      fontFamily: FONT_BRUSH, fontSize: '48px', color: '#fff3d6', stroke: '#5a1a12', strokeThickness: 5,
    }).setOrigin(1, 0.5);
    this.pHanja = this.add.text(8, BN.y + 1, '', {
      fontFamily: FONT_HANJA, fontStyle: '900', fontSize: '28px', color: '#ffe6a8', stroke: '#5a1a12', strokeThickness: 3,
    }).setOrigin(0, 0.5);
    P.add([this.pName, this.pHanja]);

    // 한지 440×360 — 세로 -146~214 (틀 안쪽 ±220 안)
    const PA = LAYOUT.parchment;
    P.add(this.frame9(0, 34, 'parchment', PA.w, PA.h, PA.corner));

    // 태수 초상 자리 (96×120 × 1.1 = 106×132, 세로 -106~26)
    const px = -150, py = -40;
    if (this.textures.exists('portrait_placeholder')) {
      P.add(this.add.image(px, py, 'portrait_placeholder').setScale(1.1));
    } else {
      P.add(this.add.rectangle(px, py, 106, 132, 0x2a2018));
    }
    this.pPortraitFrame = this.add.rectangle(px, py, 108, 134).setStrokeStyle(3, 0xffffff);
    P.add(this.pPortraitFrame);
    this.pGovernor = this.add.text(px, 46, '', {
      fontFamily: FONT_BODY, fontSize: '24px', color: '#2a1a0c',
    }).setOrigin(0.5);
    P.add(this.pGovernor);
    P.add(this.add.text(px, 74, '태수', { fontFamily: FONT_BODY, fontSize: '20px', color: '#7a5a34' }).setOrigin(0.5));

    // 정보 행: 세력·태수·인구·병력·금·군량
    const labels = ['세력', '태수', '인구', '병력', '금', '군량'];
    const y0 = -112, dy = 42, lx = -40, vx = 205;
    this.pRows = labels.map((lab, i) => {
      const y = y0 + i * dy;
      const label = this.add.text(lx, y, lab, { fontFamily: FONT_BODY, fontSize: '20px', color: '#6b4a24' }).setOrigin(0, 0.5);
      const value = this.add.text(vx, y, '', { fontFamily: FONT_BODY, fontSize: '24px', color: '#2a1a0c' }).setOrigin(1, 0.5);
      const line = this.add.rectangle((lx + vx) / 2, y + 21, vx - lx, 1, 0x6b4a24, 0.3);
      P.add([label, value, line]);
      return { label, value };
    });
    this.pSwatch = this.add.rectangle(0, y0, 16, 16, 0xffffff).setStrokeStyle(1, 0x2a1a0c);
    P.add(this.pSwatch);

    // 닫기 버튼 — 입력 우선순위는 표시 목록 순서(패널 컨테이너가 dim 뒤에 추가됨)로 dim 보다 위가 된다.
    // 창틀 오른쪽 위 모서리(48px 장식) 위. 배너 오른쪽 끝(x 210)과 안 겹치게 x 232.
    const cb = this.add.container(PW / 2 - 28, -PH / 2 + 26);
    cb.add(this.add.circle(0, 0, 21, 0x2a1a10).setStrokeStyle(3, 0xd9b25a));
    cb.add(this.add.text(0, -1, '×', { fontFamily: FONT_BODY, fontSize: '30px', color: '#f7e9c9' }).setOrigin(0.5));
    cb.setSize(52, 52).setInteractive({ useHandCursor: true });
    cb.on('pointerdown', () => cb.setScale(0.9));
    cb.on('pointerup', () => { cb.setScale(1); this.closePanel(); });
    cb.on('pointerout', () => cb.setScale(1));
    P.add(cb);

    // 안내 — 한지 아래 창틀 아래 변(220~250) 위에
    P.add(this.add.text(0, 234, '창 밖을 탭하면 닫힙니다', {
      fontFamily: FONT_BODY, fontSize: '20px', color: '#cdb98e',
    }).setOrigin(0.5).setAlpha(0.85));
  }

  /** MapScene 'city:open' */
  openPanel(city) {
    const info = cityInfo(city);
    const f = info.faction;
    const col = colorNum(f.color);

    this.pName.setText(city.name);
    this.pHanja.setText(city.hanja);
    this.pAccent.setFillStyle(col, 0.95);
    this.pPortraitFrame.setStrokeStyle(3, col);
    this.pGovernor.setText(info.governor);

    const values = [
      f.id === 'none' ? f.name : `${f.name} (${f.ruler})`,
      info.governor,
      `${info.pop.toLocaleString('ko-KR')} 명`,
      `${info.troops.toLocaleString('ko-KR')} 명`,
      `${info.gold.toLocaleString('ko-KR')} 금`,
      `${info.food.toLocaleString('ko-KR')} 석`,
    ];
    values.forEach((v, i) => this.pRows[i].value.setText(v));
    this.pSwatch.setFillStyle(col, 1).setX(205 - this.pRows[0].value.width - 16);

    if (!this.panelOpen) {
      sfx('open');
      this.tweens.killTweensOf(this.dim);
      this.dim.setVisible(true);
      this.tweens.add({ targets: this.dim, alpha: 0.45, duration: 250 });
    }
    this.panelOpen = true;
    this.panelCity = city;

    // 열림: scale 0.8→1 + 알파, Back.Out
    this.tweens.killTweensOf(this.panel);
    this.panel.setVisible(true).setScale(0.8).setAlpha(0);
    this.tweens.add({ targets: this.panel, scale: 1, alpha: 1, duration: 280, ease: 'Back.easeOut' });
  }

  closePanel() {
    if (!this.panelOpen) return;
    this.panelOpen = false;
    this.panelCity = null;
    sfx('close');

    // 닫힘: 반대 (Back.In)
    this.tweens.killTweensOf(this.panel);
    this.tweens.add({
      targets: this.panel, scale: 0.8, alpha: 0, duration: 200, ease: 'Back.easeIn',
      onComplete: () => { if (!this.panelOpen) this.panel.setVisible(false); },
    });
    this.tweens.killTweensOf(this.dim);
    this.tweens.add({
      targets: this.dim, alpha: 0, duration: 200,
      onComplete: () => { if (!this.panelOpen) this.dim.setVisible(false); },
    });
    this.mapScene.events.emit('city:close');
  }

  // ─────────────────────────────────────────────────────────────
  // 인트로 — 「군영전」 붓글씨 제목이 크게 나타났다 사라진다 (약 1.5초)
  // ─────────────────────────────────────────────────────────────

  playIntro() {
    const veil = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.55).setDepth(40);
    const title = this.add.text(W / 2, H / 2 - 24, '군영전', {
      fontFamily: FONT_BRUSH, fontSize: '170px', color: '#f6e9c9', stroke: '#3a1a0c', strokeThickness: 8,
    }).setOrigin(0.5).setDepth(41).setAlpha(0).setScale(1.18);
    title.setShadow(4, 6, 'rgba(0,0,0,0.6)', 12, true, true);
    const sub = this.add.text(W / 2, H / 2 + 92, '軍 營 傳', {
      fontFamily: FONT_HANJA, fontStyle: '900', fontSize: '34px', color: '#d9b25a',
    }).setOrigin(0.5).setDepth(41).setAlpha(0);

    this.tweens.add({ targets: title, alpha: 1, scale: 1, duration: 420, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: sub, alpha: 1, duration: 400, delay: 260 });
    this.tweens.add({
      targets: [title, sub, veil], alpha: 0, duration: 450, delay: 1100, ease: 'Quad.easeIn',
      onComplete: () => { title.destroy(); sub.destroy(); veil.destroy(); },
    });
  }
}
