// BattleHud — BattleScene 위에 겹치는 전투 HUD (BATTLE.md §4.2 + BATTLE_ART.md §4·§5). 카메라 영향 없는 화면 좌표.
//   상단: 양편 병력 바(bar_frame 틀 + 편 색 채움 + 숫자) · 가운데 경과 시간
//         무장 4명 = 초상(hud_portrait_<key>) + 청동 테두리(hud_portrait_frame) + 이름 붓글씨 + HP 바(bar_frame 틀 + 붉은 채움 + 흰 하이라이트)
//   하단 오른쪽: 무장기 버튼 = 메달리온(hud_medallion) + 아이콘(hud_skill_<key>) + 금색 게이지 호(100 이면 빛남) · 그 위 병법 3버튼(ui/button 9-slice 그대로)
//   「전투 개시」 인트로 1.2초 · 결과 패널(ui/panel + banner, Back.Out) 「다시」「지도로」 · 무장기 컷인(fx.cutin) · 병법 외침 「돌격!」 붓글씨(0.6초)
//   비네트(battle_vignette)를 이 씬 맨 아래(깊이 −5)에 깐다 — BattleScene 카메라의 줌·흔들림에 끌려가지 않게 전장이 아니라 여기에.
//   2차 그림은 전부 선택: 없으면 1차 모습(자리표시 초상 + 편 색 테두리, 선 테두리 바, 원형 Graphics 버튼)으로 돈다.
//   BattleScene 의 공개 필드를 매 프레임 읽는다(sim·genMeta·cmd …). main.js relayout 은 restart({ relayout: true }).
//   폰 가로(FIT 0.54배) 기준: 버튼 ≥ 72px 논리, 글자 ≥ 22px(HUD 라벨 24·결과 사유 24·무장기 이름 24), 무장 이름 30px.
//   3차(docs/BATTLE_V3.md §1·§2): 아군 무장 블록 탭 = 그 무장 조종(금색 테 + 「조종」 꼬리표, 조종 중인 것을 다시 탭 = 자동) ·
//     병법 줄 왼쪽 「자동/수동」 토글 · 시간 옆 배속 버튼(×1→×2→×3) · 무장기 버튼은 고른 무장 것(아이콘 없으면 글자).
//     상태(고른 무장·자동·배속)는 BattleScene 이 들고 있고 여기선 매 프레임 읽어 달라졌을 때만 다시 칠한다 →
//     relayout 으로 이 씬이 restart 돼도 그대로 복원된다(this.last 가 비어 첫 update 에 전부 다시 칠한다).
// ※ 한글 문구를 새로 넣으면 factions.js 의 KOREAN_SAMPLE 에도 넣어라(tools/smoke.mjs 가 대조한다).

import { play as sfx } from '../sfx.js';
import { cutin } from './fx.js';
import { SIDE_COLOR } from './BattleScene.js';

/** 논리 폭 — create() 에서 실제 값으로 */
let W = 1280;
const H = 720;
const DEG = Math.PI / 180;

const FONT_BRUSH = '"Nanum Brush Script", "Song Myung", serif';
const FONT_BODY = '"Song Myung", "Noto Serif KR", serif';

/**
 * 배치 수치 — tools/smoke.mjs 가 9-slice 제약(corner ≤ 그림 모서리, 2×corner ≤ 짧은 변)과 버튼 크기를 검사한다.
 *   button.png 256×96 모서리 32 / panel.png 384² 모서리 48 / parchment.png 256² 모서리 24 / hud/bar_frame.png 320×40 모서리 14(덮개 12 + 윤곽선)
 * 2차 상단 배치(왼쪽 기준, 오른쪽은 거울): 병력 바 한 줄(y 26) 아래에 무장 블록 둘을 가로로 —
 *   블록 = [초상 72×90 + 테두리 84×102] + 오른쪽에 이름(위)·HP 바(아래). 블록 240 × 2 + 간격 10 → 왼쪽 묶음 끝 x 514 (가운데 시간 표시 580 안쪽).
 *   테두리 아래 끝 y 154 → BattleScene.HUD_TOP 158 (그 위는 조이스틱을 안 잡는다).
 * 납품 그림 실측: bar_frame 테 두께 8px(구멍 x 8~310 · y 8~30) — 9-slice 는 테를 안 줄이므로 바 높이 = 채움 + 16.
 *   → 병력 바 40(채움 24, 글자 24px 가 들어간다) · HP 바 40(채움 24, 폰 0.54배 → 13px). inset 8 = 테 두께(틀 그림이 없으면 4).
 *   portrait_frame 구멍 93×117(112×136 중) → 0.75배(84×102)면 구멍 70×88 — 초상 72×90 이 1px 씩 물린다.
 * (통합 실측 — assets/raw/battle2/_integ_hud_probe.py)
 *   bar_frame: 불투명 테 7px + 안쪽 그림자 3px(구멍 x 9~310 · y 9~30). 모서리 덮개가 12px 을 1~2px 넘어(열·행 12~13 이 가운데와 다르다, 검수)
 *     9-slice 모서리는 14 로 자른다 — 바 높이 40 = 그림 높이라 세로로는 안 늘어난다.
 *   medallion(160 기준): 구멍 r<28 · 금 안테 31~36.5 · 목재 띠 37~50 · 홈 50~52 · 청동 고리 52~75. 164px 로 그리면 목재 띠는 38~51 →
 *     게이지 호는 그 가운데(arcR 45 · 굵기 9 → 40.5~49.5). 앞 값 50 은 청동 고리를 목재 띠로 읽은 것이라 호가 홈·고리 위에 걸쳤다.
 *     아이콘 72 는 구멍(지름 57) 밑에 깔린다.
 */
export const HUD_LAYOUT = {
  bar:    { w: 380, h: 40, y: 28, margin: 24, inset: 8, corner: 14 },
  // 통합 검수(1차): 폰(FIT 0.54)에서 HP 바 14→7.6px·초상 30×38→16×21px 는 거의 안 보였다 → 2차: 초상 72×90(폰 39×49),
  //   HP 바 40(틀 8×2 를 뺀 채움 24 → 폰 13px. 32 였을 땐 채움 16 → 폰 8.7px 로 1차와 다를 게 없었다 — 2차 통합).
  //   이름(30px) 아래 끝 y 91 < 바 위 끝 105, 바 아래 끝 145 < 초상 테두리 아래 끝 154
  gen:    { y: 103, portraitW: 72, portraitH: 90, frameW: 84, frameH: 102, blockW: 240, gap: 10, textX: 92, nameDy: -27, barDy: 22, barW: 146, barH: 40, inset: 8, corner: 14 },
  skill:  { r: 60, cx: 104, cy: 104, medallion: 164, icon: 72, arcR: 45, arcW: 9 },   // cx/cy: 오른쪽 아래 모서리에서의 거리. 버튼 지름 ≥ 72
  tactic: { w: 150, h: 72, gap: 8, corner: 32 },
  // 3차(docs/BATTLE_V3.md §1·§2) — 폰 가로(FIT 0.54) 기준 버튼 ≥ 72px 논리 · 글자 ≥ 22px. smoke 가 검사한다.
  //   auto: 「자동/수동」 토글 — 병법 버튼 줄 왼쪽(gap 은 병법 묶음과의 간격). 줄 전체 폭 110+16+466 = 592 → 1280 폭에서 왼쪽 끝 x 664 > 640(조이스틱 반)
  //   speed: 배속 버튼 — 가운데 시간 표시 오른쪽(dx = 화면 가운데에서 버튼 가운데까지). 1280 폭에서 x 712~808 · y 8~80:
  //     시간 글자(600~680)·오른쪽 병력 바(876~)·오른쪽 둘째 무장 이름(864~, y 61~)·HP 바(y 105~)와 안 겹친다
  //   sel: 고른 무장 초상의 금색 테(초상 테두리 바깥 +pad)와 「조종」/「자동」 꼬리표(초상 아래쪽, 글자 22px)
  auto:   { w: 110, h: 72, gap: 16, corner: 32 },
  speed:  { w: 96, h: 72, corner: 32, dx: 120, y: 44 },
  sel:    { pad: 3, line: 4, tagW: 60, tagH: 30, tagDy: -19, font: 22 },
  result: {
    panel: { w: 600, h: 440, corner: 48 },
    parchment: { w: 520, h: 236, corner: 24 },
    button: { w: 200, h: 72, corner: 32 },
    banner: { scale: 0.9, y: -196 },
  },
};

/** 병법 외침 — 명령을 내리면 화면 가운데 붓글씨가 커졌다 사라진다(0.6초) */
const CMD_SHOUT = { charge: '돌격!', hold: '대기!', retreat: '후퇴!' };
/** (3차 통합) 포인터 id — 버튼이 「내 위에서 눌린 그 손가락」인지 가릴 때 쓴다(헤드리스 흉내는 포인터를 안 넘긴다 → 0) */
const pid = (p) => (p && p.id != null ? p.id : 0);

/** 병법 3종 */
const TACTICS = [
  { cmd: 'charge',  label: '돌격' },
  { cmd: 'hold',    label: '대기' },
  { cmd: 'retreat', label: '후퇴' },
];

const RESULT_TITLE = { left: '승리', right: '패배', draw: '무승부' };
const RESULT_COLOR = { left: '#ffe9a8', right: '#ffb8a8', draw: '#e6dcc6' };

export default class BattleHud extends Phaser.Scene {
  constructor() {
    super('BattleHud');
  }

  create() {
    W = this.scale.width;
    this.isWebGL = this.sys.game.renderer.type === Phaser.WEBGL;
    this.battle = this.scene.get('BattleScene');
    const data = this.scene.settings.data || {};
    const relayout = !!data.relayout;
    this.last = { l: -1, r: -1, sec: -1, gauge: -1, cmd: null, alive: true, playerId: -1, auto: null, speed: -1 };
    this.genRows = [];
    this.readyTween = null;
    this.resultOpen = false;

    this.lastShout = null;
    this.shoutText = null;

    this.buildVignette();
    this.buildTop();
    this.buildControls();
    this.buildResult();

    const b = this.battle;
    this.onReady = () => {
      this.fillGenerals();
      if (!relayout) this.playIntro();
    };
    if (b && b.sim) {
      this.fillGenerals();
      // 재배치 재시작이면 인트로는 건너뛴다(BattleScene.introUntil 이 sim 정지를 맡는다)
      if (!relayout && b.introUntil > this.time.now) this.playIntro();
    } else if (b) {
      b.events.once('battle:ready', this.onReady, this);
    }
    if (b) {
      b.events.on('battle:skill', this.onSkill, this);
      b.events.on('battle:skillfail', this.onSkillFail, this);
      b.events.on('battle:end', this.showResult, this);
      b.events.on('battle:command', this.onCommand, this);
      if (b.ended && b.result) this.showResult(b.result, true);
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (!b) return;
      b.events.off('battle:ready', this.onReady, this);
      b.events.off('battle:skill', this.onSkill, this);
      b.events.off('battle:skillfail', this.onSkillFail, this);
      b.events.off('battle:end', this.showResult, this);
      b.events.off('battle:command', this.onCommand, this);
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 공용 — UIScene.frame9 와 같은 방식 (텍스처 없거나 Canvas 렌더러면 대체)
  // ─────────────────────────────────────────────────────────────

  frame9(x, y, key, w, h, l, r = l, t = l, b = t) {
    if (this.textures.exists(key)) {
      if (this.isWebGL) return this.add.nineslice(x, y, key, undefined, w, h, l, r, t, b);
      return this.add.image(x, y, key).setDisplaySize(w, h);   // Canvas 렌더러는 NineSlice 를 못 그린다
    }
    const light = key === 'parchment';
    return this.add.rectangle(x, y, w, h, light ? 0xe9dcbb : 0x221a12, light ? 1 : 0.92)
      .setStrokeStyle(3, light ? 0xb8996a : 0x9a7a3a);
  }

  /** 9-slice 버튼(눌림 상태 포함). onUp 은 눌렀다 뗄 때 */
  makeButton(x, y, w, h, corner, label, onUp, fontSize = '26px') {
    const c = this.add.container(x, y);
    const up = this.frame9(0, 0, 'button', w, h, corner);
    const down = this.frame9(0, 0, 'button_down', w, h, corner).setVisible(false);
    const text = this.add.text(0, 0, label, {
      fontFamily: FONT_BODY, fontSize, color: '#f7e9c9', stroke: '#2a1a0c', strokeThickness: 3,
    }).setOrigin(0.5);
    c.add([up, down, text]);
    c.label = text;   // (3차) 자동/수동·배속 버튼은 상태에 따라 글자를 바꾼다
    c.setSize(w, h).setInteractive({ useHandCursor: true });
    c.press = (on) => {
      up.setVisible(!on);
      down.setVisible(on);
      text.y = on ? 2 : 0;
    };
    // (3차 통합) 「이 버튼 위에서 눌린 손가락」이 뗄 때만 동작한다. Phaser 는 어디서 눌렀든 손가락을 뗀 자리의 객체에 pointerup 을 보내서,
    //   조이스틱을 끌다 버튼 위에서 떼면 눌린 것으로 쳤다(검수: 1280 폭에선 자동 버튼이 조이스틱 반과 24px 차이). 병법 버튼도 같이 적용된다
    c.on('pointerdown', (p) => { c.downId = pid(p); c.press(true); c.setScale(0.96); });
    c.on('pointerup', (p) => {
      const ok = c.downId === pid(p);
      c.downId = null;
      c.setScale(1);
      if (!c.held) c.press(false);
      if (ok) onUp();
    });
    c.on('pointerout', () => { c.downId = null; c.setScale(1); if (!c.held) c.press(false); });
    return c;
  }

  // ─────────────────────────────────────────────────────────────
  // 상단 — 병력 바·시간·무장(초상·이름·HP)
  // ─────────────────────────────────────────────────────────────

  /** 비네트 — 화면 크기 검은 테두리 그라데이션(모서리 알파 0.45). 이 씬의 맨 아래 = 전장 위·HUD 아래 */
  buildVignette() {
    if (!this.textures.exists('battle_vignette')) return;
    this.add.image(W / 2, H / 2, 'battle_vignette').setDisplaySize(W, H).setDepth(-5);
  }

  /**
   * 바 하나 — 어두운 바탕 + 채움(+ 위쪽 흰 하이라이트) + 틀. left 면 왼쪽 끝 x 에서 오른쪽으로, 아니면 오른쪽 끝 x 에서 왼쪽으로.
   *   틀: hud_bar_frame(320×40, 모서리 12, 가운데 투명) 9-slice — 없으면 1차처럼 금색 선 테두리. Canvas 렌더러는 늘린 그림.
   *   채움·하이라이트는 origin 이 바깥쪽 끝이라 scaleX 로 줄이면 안쪽(화면 가운데 쪽)부터 줄어든다.
   * @returns {{fill, shine, objs}} setBar(bar, 0~1) 로 채움을 바꾼다
   */
  makeBar(x, y, w, h, inset, color, left, depth = 10) {
    const objs = [];
    const hasFrame = this.textures.exists('hud_bar_frame');
    if (!hasFrame) inset = 4;                       // 선 테두리(1차 모습)엔 틀 두께(8)만큼의 여백이 필요 없다
    const ox = left ? 0 : 1;
    const cx = left ? x + w / 2 : x - w / 2;
    const ix = left ? x + inset : x - inset;
    const iw = w - inset * 2, ih = h - inset * 2;
    objs.push(this.add.rectangle(cx, y, w - 4, h - 4, 0x0e0a08, 0.72).setDepth(depth));
    const fill = this.add.rectangle(ix, y, iw, ih, color).setOrigin(ox, 0.5).setDepth(depth + 1);
    // 흰 하이라이트 — 채움 위쪽 1/3 에 옅은 흰 띠(유리 막대 느낌). 채움과 같이 줄어든다
    const shine = this.add.rectangle(ix, y - ih / 2 + Math.max(2, ih * 0.18), iw, Math.max(3, Math.round(ih * 0.3)), 0xffffff, 0.3)
      .setOrigin(ox, 0.5).setDepth(depth + 1.5);
    objs.push(fill, shine);
    if (hasFrame) {
      const c = HUD_LAYOUT.bar.corner;
      objs.push((this.isWebGL
        ? this.add.nineslice(cx, y, 'hud_bar_frame', undefined, w, h, c, c, c, c)
        : this.add.image(cx, y, 'hud_bar_frame').setDisplaySize(w, h)).setDepth(depth + 2));
    } else {
      objs.push(this.add.rectangle(cx, y, w, h).setStrokeStyle(2, 0xd9b25a, 0.85).setDepth(depth + 2));
    }
    return { fill, shine, objs };
  }

  setBar(bar, k) {
    bar.fill.scaleX = k;
    bar.shine.scaleX = k;
  }

  buildTop() {
    const B = HUD_LAYOUT.bar;
    const y = B.y;
    const text = (x, originX, txt) => this.add.text(x, y, txt, {
      fontFamily: FONT_BODY, fontSize: '24px', color: '#fff3d6', stroke: '#1a120c', strokeThickness: 4,   // 22→24: 폰에서 13px (통합 검수)
    }).setOrigin(originX, 0.5).setDepth(14);

    // 왼쪽(아군, 초록) — 오른쪽으로 줄어든다 / 오른쪽(적군, 파랑) — 왼쪽으로 줄어든다
    this.barL = this.makeBar(B.margin, y, B.w, B.h, B.inset, SIDE_COLOR.left, true);
    this.barL.text = text(B.margin + 14, 0, '아군');
    this.barR = this.makeBar(W - B.margin, y, B.w, B.h, B.inset, SIDE_COLOR.right, false);
    this.barR.text = text(W - B.margin - 14, 1, '적군');
    // 가운데 경과 시간
    this.timeText = this.add.text(W / 2, y + 6, '0:00', {
      fontFamily: FONT_BRUSH, fontSize: '40px', color: '#f6e9c9', stroke: '#2a1a0c', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(14);
    // (3차) 배속 버튼 — 시간 오른쪽. 탭할 때마다 ×1 → ×2 → ×3 → ×1. 글자는 본문 폰트 굵게(붓글씨 아님), update 가 현재 값으로 칠한다
    const SP = HUD_LAYOUT.speed;
    this.speedBtn = this.makeButton(W / 2 + SP.dx, SP.y, SP.w, SP.h, SP.corner, '×1',
      () => { if (this.battle) this.battle.cycleSpeed(); }, '30px');
    this.speedBtn.label.setFontStyle('bold');
    this.speedBtn.setDepth(15);
  }

  /** 무장 4명 블록 — sim 이 준비된 뒤(이름·key 를 알아야) 만든다. 왼쪽 묶음은 x 가 커지는 쪽으로, 오른쪽은 거울 */
  fillGenerals() {
    for (const r of this.genRows) for (const o of r.objs) o.destroy();
    this.genRows = [];
    const b = this.battle;
    if (!b || !b.sim) return;
    const G = HUD_LAYOUT.gen;
    const M = HUD_LAYOUT.bar.margin;
    for (const side of ['left', 'right']) {
      const gens = b.sim.generalsOf(side) || [];
      gens.slice(0, 2).forEach((u, i) => {
        const meta = b.genMeta.get(u.id) || { unit: u, name: u.name || '', side };
        const left = side === 'left';
        const sx = (x) => (left ? x : W - x);   // 오른쪽은 거울
        const bx = M + i * (G.blockW + G.gap);  // 블록 바깥쪽 끝(왼쪽 기준)
        const y = G.y;
        const objs = [];
        const isPlayer = u.id === b.playerId;
        // 초상 — 2차 hud_portrait_<key>, 없으면 1차 자리표시
        const px = sx(bx + G.frameW / 2);
        const pKey = meta.key != null && this.textures.exists(`hud_portrait_${meta.key}`) ? `hud_portrait_${meta.key}`
          : this.textures.exists('portrait_placeholder') ? 'portrait_placeholder' : null;
        const portrait = pKey
          ? this.add.image(px, y, pKey).setDisplaySize(G.portraitW, G.portraitH).setDepth(11)
          : this.add.rectangle(px, y, G.portraitW, G.portraitH, 0x2a2018).setDepth(11);
        // ※ 초상은 뒤집지 않는다 — 하후돈 안대는 왼눈이어야 한다(컷인에서 일부러 맞춘 방향, assets/battle/NOTES.md)
        objs.push(portrait);
        // 테두리 — 청동 틀(가운데 투명), 없으면 편 색 선. 틀이 있어도 편은 아래 색 띠로 알린다
        if (this.textures.exists('hud_portrait_frame')) {
          objs.push(this.add.image(px, y, 'hud_portrait_frame').setDisplaySize(G.frameW, G.frameH).setDepth(12));
          objs.push(this.add.rectangle(px, y + G.frameH / 2 - 3, G.frameW - 22, 4, SIDE_COLOR[side]).setDepth(12.5));
        } else {
          objs.push(this.add.rectangle(px, y, G.portraitW + 4, G.portraitH + 4).setStrokeStyle(3, SIDE_COLOR[side]).setDepth(12));
        }
        // 이름(붓글씨) + HP 바
        const tx = sx(bx + G.textX);
        const name = this.add.text(tx, y + G.nameDy, meta.name, {
          fontFamily: FONT_BRUSH, fontSize: '30px', color: isPlayer ? '#ffe9a8' : '#f6e9c9', stroke: '#2a1a0c', strokeThickness: 4,
        }).setOrigin(left ? 0 : 1, 0.5).setDepth(13);
        objs.push(name);
        const bar = this.makeBar(tx, y + G.barDy, G.barW, G.barH, G.inset, isPlayer ? 0xd94a3a : 0xc73b2e, left);
        objs.push(...bar.objs);
        const row = { meta, unit: u, bar, fill: bar.fill, name, portrait, objs, lastHp: -1 };
        // (3차) 아군 무장 = 조종 선택. 블록 전체(초상+이름+HP 바 240×102)가 탭 영역 — 폰에서 초상(39×49px)만 맞히기는 어렵다.
        //   HUD_TOP(158) 위라 조이스틱과 안 겹친다. 고른 무장: 금색 테 + 꼬리표(수동 「조종」 / 자동 「자동」) — refreshSelection 이 칠한다
        if (left) {
          const SL = HUD_LAYOUT.sel;
          row.sel = this.add.rectangle(px, y, G.frameW + SL.pad * 2, G.frameH + SL.pad * 2).setStrokeStyle(SL.line, 0xffd24a).setDepth(12.6).setVisible(false);
          row.tagBg = this.add.rectangle(px, y + G.frameH / 2 + SL.tagDy, SL.tagW, SL.tagH, 0x1a120c, 0.92).setStrokeStyle(2, 0xffd24a).setDepth(12.7).setVisible(false);
          row.tag = this.add.text(px, y + G.frameH / 2 + SL.tagDy, '조종', {
            fontFamily: FONT_BODY, fontSize: `${SL.font}px`, fontStyle: 'bold', color: '#ffe08a',
          }).setOrigin(0.5).setDepth(12.8).setVisible(false);
          const zone = this.add.zone(bx + G.blockW / 2, y, G.blockW, G.frameH).setInteractive({ useHandCursor: true });
          // (3차 통합) 이 블록 위에서 눌린 손가락이 뗄 때만 — 블록 바로 아래(y≥158)가 조이스틱 영역이라, 조이스틱을 위로 밀다 여기서 떼면
          //   조종 무장이 바뀌거나 소리 없이 「자동」으로 넘어가고 그게 registry 에 기억됐다(검수)
          zone.on('pointerdown', (p) => { row.downId = pid(p); });
          zone.on('pointerout', () => { row.downId = null; });
          zone.on('pointerup', (p) => {
            const ok = row.downId === pid(p);
            row.downId = null;
            if (ok && this.battle && !this.resultOpen) this.battle.selectGeneral(u.id);
          });
          row.zone = zone;
          objs.push(row.sel, row.tagBg, row.tag, zone);
        }
        this.genRows.push(row);
      });
    }
    this.refreshSelection();
  }

  /** (3차) 고른 무장 강조 — 금색 테·꼬리표·이름 색·HP 바 색. 자동이면 테를 은빛으로, 꼬리표는 「자동」(카메라만 따라간다) */
  refreshSelection() {
    const b = this.battle;
    if (!b) return;
    for (const row of this.genRows) {
      if (!row.sel) continue;
      const on = row.unit.id === b.playerId;
      const edge = b.auto ? 0xcfd8e6 : 0xffd24a;
      row.sel.setVisible(on);
      row.tagBg.setVisible(on);
      row.tag.setVisible(on);
      if (on) {
        row.sel.setStrokeStyle(HUD_LAYOUT.sel.line, edge);
        row.tagBg.setStrokeStyle(2, edge);
        row.tag.setText(b.auto ? '자동' : '조종').setColor(b.auto ? '#e6edf7' : '#ffe08a');
      }
      row.name.setColor(on ? '#ffe9a8' : '#f6e9c9');
      row.bar.fill.setFillStyle(on ? 0xd94a3a : 0xc73b2e);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 하단 오른쪽 — 무장기 버튼(메달리온 + 아이콘 + 게이지 호) + 병법 3버튼
  // ─────────────────────────────────────────────────────────────

  buildControls() {
    const S = HUD_LAYOUT.skill;
    const cx = W - S.cx, cy = H - S.cy;
    const c = this.skillBtn = this.add.container(cx, cy).setDepth(20);
    const hasMedal = this.textures.exists('hud_medallion');
    // 빛 무리(게이지 100) — 뒤에 깔린다
    this.skillGlow = this.textures.exists('glow')
      ? this.add.image(0, 0, 'glow').setTint(0xffd24a).setBlendMode(Phaser.BlendModes.ADD).setScale(1.2).setAlpha(0)
      : this.add.circle(0, 0, S.r + 14, 0xffd24a, 0).setAlpha(0);
    c.add(this.skillGlow);
    // 바탕 원판 — 메달리온 구멍 뒤(없으면 1차 원형 버튼)
    const disc = this.add.circle(0, 0, S.r, 0x1a120c, 0.92);
    if (!hasMedal) disc.setStrokeStyle(4, 0x8a6a2f);
    c.add(disc);
    if (!hasMedal) c.add(this.add.circle(0, 0, S.r - 12, 0x2a1c12, 1).setStrokeStyle(2, 0x5a4020));
    // 아이콘 자리 — 조종 무장을 알아야 하므로(hud_skill_<key>) update 가 한 번 채운다
    this.skillIcon = this.add.image(0, -2, this.textures.exists('glow') ? 'glow' : '__DEFAULT').setVisible(false);   // 자리만 잡는다(fillSkill 이 텍스처를 끼운다)
    c.add(this.skillIcon);
    if (hasMedal) c.add(this.add.image(0, 0, 'hud_medallion').setDisplaySize(S.medallion, S.medallion));
    // 게이지 호(금색) — 메달리온 안쪽 가장자리 위에 그린다
    this.skillArc = this.add.graphics();
    c.add(this.skillArc);
    this.skillText = this.add.text(0, 0, '', {
      fontFamily: FONT_BRUSH, fontSize: '30px', color: '#f6e9c9', stroke: '#2a1a0c', strokeThickness: 5,
    }).setOrigin(0.5);
    c.add(this.skillText);
    const hit = (hasMedal ? S.medallion : S.r * 2 + 8);
    c.setSize(hit, hit).setInteractive({ useHandCursor: true });
    // (3차 통합) 다른 버튼과 같은 가드 — 이 버튼 위에서 눌린 손가락이 뗄 때만 무장기
    c.on('pointerdown', (p) => { c.downId = pid(p); c.setScale(0.92); });
    c.on('pointerup', (p) => {
      const ok = c.downId === pid(p);
      c.downId = null;
      c.setScale(1);
      if (ok && this.battle) this.battle.tryUseSkill();
    });
    c.on('pointerout', () => { c.downId = null; c.setScale(1); });

    // 병법 3버튼 — 무장기 버튼 위 한 줄, 오른쪽 정렬 (ui/button 9-slice 그대로)
    const T = HUD_LAYOUT.tactic;
    const total = TACTICS.length * T.w + (TACTICS.length - 1) * T.gap;
    const x0 = W - HUD_LAYOUT.bar.margin - total + T.w / 2;
    const ty = cy - hit / 2 - 12 - T.h / 2;
    this.tacticBtns = TACTICS.map((t, i) => {
      const btn = this.makeButton(x0 + i * (T.w + T.gap), ty, T.w, T.h, T.corner, t.label,
        () => { if (this.battle) this.battle.command(t.cmd); });
      btn.setDepth(20);
      btn.cmd = t.cmd;
      return btn;
    });
    // (3차) 「자동/수동」 토글 — 병법 줄 왼쪽. 글자는 지금 상태(자동이면 눌린 모습 + 금색). update 가 BattleScene.auto 를 읽어 칠한다
    const A = HUD_LAYOUT.auto;
    this.autoBtn = this.makeButton(x0 - T.w / 2 - A.gap - A.w / 2, ty, A.w, A.h, A.corner, '수동',
      () => { if (this.battle) this.battle.toggleAuto(); });
    this.autoBtn.setDepth(20);
  }

  /**
   * 고른 무장의 무장기 이름·아이콘을 채운다. 아이콘이 있으면 이름은 아래쪽 테 위에 24px 로.
   * (3차) 고른 무장이 바뀔 때마다 다시 부른다 → 아이콘이 없는 무장(hud_skill_<key> 없음)이면 아이콘을 치우고 이름을 가운데 30px 로 되돌린다
   */
  fillSkill(meta) {
    const S = HUD_LAYOUT.skill;
    const name = (meta && meta.skill && meta.skill.name) || '무장기';
    const iconKey = meta && meta.key != null ? `hud_skill_${meta.key}` : null;
    if (iconKey && this.textures.exists(iconKey)) {
      this.skillIcon.setTexture(iconKey).setDisplaySize(S.icon, S.icon).setVisible(true);
      this.skillText.setFontSize(24).setY(S.medallion / 2 - 24);   // 아래쪽 테 위
    } else {
      this.skillIcon.setVisible(false);
      this.skillText.setFontSize(30).setY(0);
    }
    this.skillText.setText(name);
  }

  /** 병법 외침 — 화면 가운데 붓글씨가 커졌다 사라진다(0.6초). 같은 명령이 연달아 오면(씬 emit + sim 이벤트) 한 번만 */
  shout(cmd) {
    const label = CMD_SHOUT[cmd];
    if (!label) return;
    const now = this.time.now;
    if (this.lastShout && this.lastShout.cmd === cmd && now - this.lastShout.at < 400) return;
    this.lastShout = { cmd, at: now };
    if (this.shoutText) { this.tweens.killTweensOf(this.shoutText); this.shoutText.destroy(); }
    const t = this.shoutText = this.add.text(W / 2, H * 0.4, label, {
      fontFamily: FONT_BRUSH, fontSize: '150px', color: cmd === 'charge' ? '#ffe08a' : '#f6e9c9', stroke: '#3a1a0c', strokeThickness: 10,
    }).setOrigin(0.5).setDepth(25).setScale(0.5).setAlpha(1);
    t.setShadow(4, 6, 'rgba(0,0,0,0.6)', 12, true, true);
    this.tweens.add({ targets: t, scale: 1, duration: 200, ease: 'Back.easeOut' });
    this.tweens.add({
      targets: t, scale: 1.3, alpha: 0, duration: 400, delay: 200, ease: 'Quad.easeIn',
      onComplete: () => { t.destroy(); if (this.shoutText === t) this.shoutText = null; },
    });
  }

  onCommand(e) {
    if (e && e.side === 'left' && !this.resultOpen) this.shout(e.cmd);
  }

  /** 게이지 호 — 12시부터 시계 방향 */
  drawGauge(g) {
    const a = this.skillArc;
    const r = HUD_LAYOUT.skill.arcR;
    a.clear();
    // 어두운 홈(트랙) — 메달리온 그림 위에서도 호가 어디까지 찼는지 읽히게
    a.lineStyle(HUD_LAYOUT.skill.arcW + 1, 0x0e0a08, 0.55);
    a.beginPath();
    a.arc(0, 0, r, 0, Math.PI * 2, false);
    a.strokePath();
    if (g <= 0) return;
    a.lineStyle(HUD_LAYOUT.skill.arcW, g >= 100 ? 0xffd24a : 0xd9b25a, 1);   // 금색
    a.beginPath();
    a.arc(0, 0, r, -90 * DEG, (-90 + 360 * Math.min(100, g) / 100) * DEG, false);
    a.strokePath();
  }

  setReady(on) {
    if (on && !this.readyTween) {
      this.skillGlow.setAlpha(0.5);
      this.readyTween = this.tweens.add({ targets: this.skillGlow, alpha: 0.95, scale: 1.3, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    } else if (!on && this.readyTween) {
      this.readyTween.stop();
      this.readyTween = null;
      this.skillGlow.setAlpha(0).setScale(1.1);
    }
  }

  onSkillFail() {
    // 게이지가 모자라면 버튼이 살짝 떤다
    this.tweens.killTweensOf(this.skillBtn);
    const x = W - HUD_LAYOUT.skill.cx;
    this.skillBtn.x = x;
    this.tweens.add({ targets: this.skillBtn, x: x + 6, duration: 40, yoyo: true, repeat: 3, onComplete: () => { this.skillBtn.x = x; } });
  }

  /** BattleScene 'battle:skill'(meta) → 컷인 */
  onSkill(meta) {
    if (!meta) return;
    cutin(this, {
      name: meta.name || '',
      skillName: (meta.skill && meta.skill.name) || '',
      key: meta.key != null ? `cutin_${meta.key}` : null,
      color: meta.side === 'right' ? 0x9cc0ff : 0xffd24a,
      side: meta.side,   // (3차) 컷신(cutin.js)이 적 편이면 좌우를 뒤집는다 — 옛 cutin() 은 모르는 인자라 그냥 무시한다
      mode: meta.cutinMode || null,   // (3차 컷신) BattleScene 이 cutinPlan 으로 정한 모양 그대로 — 히트스톱 길이와 어긋나지 않게
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 인트로 — 「전투 개시」 붓글씨 + 양편 무장 이름 (1.2초, 그동안 BattleScene 이 sim 을 멈춘다)
  // ─────────────────────────────────────────────────────────────

  playIntro() {
    const b = this.battle;
    const names = (side) => ((b && b.sim && b.sim.generalsOf(side)) || [])
      .map((u) => (b.genMeta.get(u.id) || {}).name || u.name || '').filter(Boolean).join(' · ');
    const veil = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.5).setDepth(40);
    const title = this.add.text(W / 2, H / 2 - 40, '전투 개시', {
      fontFamily: FONT_BRUSH, fontSize: '150px', color: '#f6e9c9', stroke: '#3a1a0c', strokeThickness: 8,
    }).setOrigin(0.5).setDepth(41).setAlpha(0).setScale(1.2);
    title.setShadow(4, 6, 'rgba(0,0,0,0.6)', 12, true, true);
    const sub = this.add.text(W / 2, H / 2 + 70, `${names('left')}   對   ${names('right')}`, {
      fontFamily: FONT_BRUSH, fontSize: '40px', color: '#d9b25a', stroke: '#2a1a0c', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(41).setAlpha(0);
    this.tweens.add({ targets: title, alpha: 1, scale: 1, duration: 320, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: sub, alpha: 1, duration: 300, delay: 200 });
    this.tweens.add({
      targets: [title, sub, veil], alpha: 0, duration: 300, delay: 900, ease: 'Quad.easeIn',
      onComplete: () => { title.destroy(); sub.destroy(); veil.destroy(); },
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 결과 패널 — ui/panel + banner 「승리」/「패배」, 남은 병력·걸린 시간·무장기 횟수, 「다시」「지도로」
  // ─────────────────────────────────────────────────────────────

  buildResult() {
    const R = HUD_LAYOUT.result;
    // 뒤를 어둡게 + 아래 씬(조이스틱) 입력을 막는다
    this.dim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 1).setAlpha(0).setVisible(false).setDepth(30).setInteractive();
    const P = this.panel = this.add.container(W / 2, H / 2 + 10).setDepth(31).setVisible(false).setAlpha(0);
    P.add(this.frame9(0, 0, 'panel', R.panel.w, R.panel.h, R.panel.corner));
    // 배너 — 창틀 위 변에 걸친다
    const BN = R.banner;
    P.add(this.textures.exists('banner')
      ? this.add.image(0, BN.y, 'banner').setScale(BN.scale)
      : this.add.rectangle(0, BN.y, 460, 84, 0x9b2a24).setStrokeStyle(4, 0xd9b25a));
    this.rTitle = this.add.text(0, BN.y - 2, '', {
      fontFamily: FONT_BRUSH, fontSize: '64px', color: '#fff3d6', stroke: '#5a1a12', strokeThickness: 6,
    }).setOrigin(0.5);
    P.add(this.rTitle);
    // 한지 + 정보 3행
    P.add(this.frame9(0, -12, 'parchment', R.parchment.w, R.parchment.h, R.parchment.corner));
    const labels = ['남은 병력', '걸린 시간', '무장기'];
    const y0 = -84, dy = 56, lx = -R.parchment.w / 2 + 40, vx = R.parchment.w / 2 - 40;
    this.rRows = labels.map((lab, i) => {
      const y = y0 + i * dy;
      P.add(this.add.text(lx, y, lab, { fontFamily: FONT_BODY, fontSize: '24px', color: '#6b4a24' }).setOrigin(0, 0.5));
      const value = this.add.text(vx, y, '', { fontFamily: FONT_BODY, fontSize: '28px', color: '#2a1a0c' }).setOrigin(1, 0.5);
      P.add(value);
      P.add(this.add.rectangle((lx + vx) / 2, y + 26, vx - lx, 1, 0x6b4a24, 0.3));
      return value;
    });
    this.rReason = this.add.text(0, 96, '', { fontFamily: FONT_BODY, fontSize: '24px', color: '#cdb98e' }).setOrigin(0.5).setAlpha(0.9);   // 22→24 (통합 검수)
    P.add(this.rReason);
    // 버튼 2개
    const BT = R.button;
    const by = R.panel.h / 2 - 20 - BT.h / 2;
    P.add(this.makeButton(-BT.w / 2 - 12, by, BT.w, BT.h, BT.corner, '다시', () => { sfx('click'); if (this.battle) this.battle.restartBattle(); }, '28px'));
    P.add(this.makeButton(BT.w / 2 + 12, by, BT.w, BT.h, BT.corner, '지도로', () => { sfx('click'); if (this.battle) this.battle.goMap(); }, '28px'));
  }

  /** @param instant 재배치 재시작이면 연출 없이 바로 */
  showResult(result, instant = false) {
    if (!result || this.resultOpen) return;
    this.resultOpen = true;
    const winner = RESULT_TITLE[result.winner] ? result.winner : 'draw';
    this.rTitle.setText(RESULT_TITLE[winner]).setColor(RESULT_COLOR[winner]);
    const sec = Math.floor((result.time || 0) / 1000);
    const l = result.leftAlive != null ? result.leftAlive : 0;
    const r = result.rightAlive != null ? result.rightAlive : 0;
    this.rRows[0].setText(`아군 ${l} · 적군 ${r}`);
    this.rRows[1].setText(`${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`);
    this.rRows[2].setText(`${result.skills || 0}회`);
    this.rReason.setText(result.reason ? String(result.reason) : '');
    this.setReady(false);

    this.tweens.killTweensOf(this.dim);
    this.tweens.killTweensOf(this.panel);
    this.dim.setVisible(true);
    this.panel.setVisible(true);
    if (instant) {
      this.dim.setAlpha(0.5);
      this.panel.setScale(1).setAlpha(1);
      return;
    }
    sfx('open');
    this.dim.setAlpha(0);
    this.tweens.add({ targets: this.dim, alpha: 0.5, duration: 250 });
    this.panel.setScale(0.8).setAlpha(0);
    this.tweens.add({ targets: this.panel, scale: 1, alpha: 1, duration: 300, ease: 'Back.easeOut' });
  }

  // ─────────────────────────────────────────────────────────────

  update() {
    const b = this.battle;
    const sim = b && b.sim;
    if (!sim) return;
    const L = this.last;

    const l = sim.countAlive('left'), r = sim.countAlive('right');
    if (l !== L.l) {
      L.l = l;
      this.setBar(this.barL, b.total.left ? Math.max(0, Math.min(1, l / b.total.left)) : 0);
      this.barL.text.setText(`아군 ${l}`);
    }
    if (r !== L.r) {
      L.r = r;
      this.setBar(this.barR, b.total.right ? Math.max(0, Math.min(1, r / b.total.right)) : 0);
      this.barR.text.setText(`적군 ${r}`);
    }
    const sec = Math.floor((sim.time || 0) / 1000);
    if (sec !== L.sec) {
      L.sec = sec;
      this.timeText.setText(`${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`);
    }
    for (let i = 0; i < this.genRows.length; i++) {
      const row = this.genRows[i];
      const u = row.unit;
      const hp = u.maxHp ? Math.max(0, Math.min(1, u.hp / u.maxHp)) : 0;
      if (hp !== row.lastHp) {
        row.lastHp = hp;
        this.setBar(row.bar, hp);
        if (hp <= 0) { row.name.setAlpha(0.45); row.portrait.setAlpha(0.45); }
      }
    }
    // (3차) 고른 무장·자동 여부가 달라졌으면 초상 강조·자동 버튼·무장기 버튼(아이콘·이름)을 다시 칠한다. restart 직후엔 L 이 비어 있어 전부 칠한다
    const p = b.playerUnit;
    const auto = !!b.auto;
    if (b.playerId !== L.playerId || auto !== L.auto) {
      const changedGen = b.playerId !== L.playerId;
      L.playerId = b.playerId;
      L.auto = auto;
      this.refreshSelection();
      this.autoBtn.label.setText(auto ? '자동' : '수동').setColor(auto ? '#ffe08a' : '#f7e9c9');
      this.autoBtn.held = auto;
      this.autoBtn.press(auto);
      this.autoBtn.setAlpha(b.canSwitch === false ? 0.4 : 1);   // 더미 sim(setPlayer 없음)이면 못 바꾼다
      if (changedGen && p) {
        this.fillSkill(b.genMeta.get(p.id));
        L.gauge = -1;                                           // 게이지 호·빛 무리를 새 무장 값으로
      }
    }
    // (3차) 배속 글자 — ×2·×3 이면 눌린 모습 + 금색
    const speed = b.speed || 1;
    if (speed !== L.speed) {
      L.speed = speed;
      this.speedBtn.label.setText(`×${speed}`).setColor(speed > 1 ? '#ffe08a' : '#f7e9c9');
      this.speedBtn.held = speed > 1;
      this.speedBtn.press(speed > 1);
    }
    // 무장기 게이지
    const g = p ? Math.round(Math.max(0, Math.min(100, p.gauge || 0))) : 0;
    if (g !== L.gauge) {
      L.gauge = g;
      this.drawGauge(g);
      this.setReady(g >= 100 && !b.ended);
    }
    const alive = !!p && p.state !== 'dead' && p.state !== 'gone';
    if (alive !== L.alive) {
      L.alive = alive;
      this.skillBtn.setAlpha(alive ? 1 : 0.4);
    }
    // 병법 — 현재 것 눌림 유지
    if (b.cmd.left !== L.cmd) {
      L.cmd = b.cmd.left;
      for (const btn of this.tacticBtns) {
        btn.held = btn.cmd === L.cmd;
        btn.press(btn.held);
      }
    }
  }
}
