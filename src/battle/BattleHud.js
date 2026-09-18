// BattleHud — BattleScene 위에 겹치는 전투 HUD (BATTLE.md §4.2). 카메라 영향 없는 화면 좌표.
//   상단: 양편 병력 바(초록/파랑, 숫자) · 가운데 경과 시간 · 무장 4명 HP 바(이름 붓글씨 + 초상 자리표시)
//   하단 오른쪽: 무장기 원형 버튼(게이지 호, 100 이면 빛남) · 그 위 병법 3버튼(ui/button 9-slice, 현재 것 눌림)
//   「전투 개시」 인트로 1.2초 · 결과 패널(ui/panel + banner, Back.Out) 「다시」「지도로」 · 무장기 컷인(fx.cutin)
//   BattleScene 의 공개 필드를 매 프레임 읽는다(sim·genMeta·cmd …). main.js relayout 은 restart({ relayout: true }).
//   폰 가로(FIT 0.54배) 기준: 버튼 ≥ 72px 논리, 글자 ≥ 24px(HUD 라벨·결과 사유), 무장 이름 28px.
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
 *   button.png 256×96 모서리 32 / panel.png 384² 모서리 48 / parchment.png 256² 모서리 24
 */
export const HUD_LAYOUT = {
  bar:    { w: 380, h: 22, y: 22, margin: 24 },
  // 통합 검수: 폰(FIT 0.54)에서 HP 바 14→7.6px·초상 30×38→16×21px 는 거의 안 보였다 → barH 18, 초상 34×44, 행 간격 44
  gen:    { y0: 62, dy: 44, nameX: 66, barX: 150, barW: 230, barH: 18, portraitW: 34, portraitH: 44 },
  skill:  { r: 56, cx: 90, cy: 90 },                      // 오른쪽 아래 모서리에서의 거리
  tactic: { w: 150, h: 72, gap: 8, corner: 32 },
  result: {
    panel: { w: 600, h: 440, corner: 48 },
    parchment: { w: 520, h: 236, corner: 24 },
    button: { w: 200, h: 72, corner: 32 },
    banner: { scale: 0.9, y: -196 },
  },
};

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
    this.last = { l: -1, r: -1, sec: -1, gauge: -1, cmd: null, alive: true };
    this.genRows = [];
    this.readyTween = null;
    this.resultOpen = false;

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
      if (b.ended && b.result) this.showResult(b.result, true);
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (!b) return;
      b.events.off('battle:ready', this.onReady, this);
      b.events.off('battle:skill', this.onSkill, this);
      b.events.off('battle:skillfail', this.onSkillFail, this);
      b.events.off('battle:end', this.showResult, this);
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
    c.setSize(w, h).setInteractive({ useHandCursor: true });
    c.press = (on) => {
      up.setVisible(!on);
      down.setVisible(on);
      text.y = on ? 2 : 0;
    };
    c.on('pointerdown', () => { c.press(true); c.setScale(0.96); });
    c.on('pointerup', () => { c.setScale(1); if (!c.held) c.press(false); onUp(); });
    c.on('pointerout', () => { c.setScale(1); if (!c.held) c.press(false); });
    return c;
  }

  // ─────────────────────────────────────────────────────────────
  // 상단 — 병력 바·시간·무장 HP
  // ─────────────────────────────────────────────────────────────

  buildTop() {
    const B = HUD_LAYOUT.bar;
    const y = B.y;
    const text = (x, originX, txt) => this.add.text(x, y, txt, {
      fontFamily: FONT_BODY, fontSize: '24px', color: '#fff3d6', stroke: '#1a120c', strokeThickness: 3,   // 22→24: 폰에서 13px (통합 검수)
    }).setOrigin(originX, 0.5).setDepth(12);

    // 왼쪽(아군, 초록) — 오른쪽으로 줄어든다
    this.add.rectangle(B.margin, y, B.w, B.h, 0x000000, 0.55).setOrigin(0, 0.5).setStrokeStyle(2, 0xd9b25a, 0.85).setDepth(10);
    this.barL = {
      fill: this.add.rectangle(B.margin + 2, y, B.w - 4, B.h - 4, SIDE_COLOR.left).setOrigin(0, 0.5).setDepth(11),
      text: text(B.margin + 8, 0, '아군'),
    };
    // 오른쪽(적군, 파랑) — 왼쪽으로 줄어든다
    this.add.rectangle(W - B.margin, y, B.w, B.h, 0x000000, 0.55).setOrigin(1, 0.5).setStrokeStyle(2, 0xd9b25a, 0.85).setDepth(10);
    this.barR = {
      fill: this.add.rectangle(W - B.margin - 2, y, B.w - 4, B.h - 4, SIDE_COLOR.right).setOrigin(1, 0.5).setDepth(11),
      text: text(W - B.margin - 8, 1, '적군'),
    };
    // 가운데 경과 시간
    this.timeText = this.add.text(W / 2, y + 6, '0:00', {
      fontFamily: FONT_BRUSH, fontSize: '40px', color: '#f6e9c9', stroke: '#2a1a0c', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(12);
  }

  /** 무장 4명 HP 행 — sim 이 준비된 뒤(이름을 알아야) 만든다 */
  fillGenerals() {
    for (const r of this.genRows) for (const o of r.objs) o.destroy();
    this.genRows = [];
    const b = this.battle;
    if (!b || !b.sim) return;
    const G = HUD_LAYOUT.gen;
    for (const side of ['left', 'right']) {
      const gens = b.sim.generalsOf(side) || [];
      gens.slice(0, 2).forEach((u, i) => {
        const meta = b.genMeta.get(u.id) || { unit: u, name: u.name || '', side };
        const y = G.y0 + i * G.dy;
        const left = side === 'left';
        const sx = (x) => (left ? x : W - x);   // 오른쪽은 거울
        const objs = [];
        // 초상 자리표시 + 편 색 테두리
        const px = sx(HUD_LAYOUT.bar.margin + 15);
        const pw = G.portraitW, ph = G.portraitH;
        if (this.textures.exists('portrait_placeholder')) {
          objs.push(this.add.image(px, y, 'portrait_placeholder').setDisplaySize(pw, ph).setDepth(11));
        } else {
          objs.push(this.add.rectangle(px, y, pw, ph, 0x2a2018).setDepth(11));
        }
        objs.push(this.add.rectangle(px, y, pw + 2, ph + 2).setStrokeStyle(2, SIDE_COLOR[side]).setDepth(12));
        const isPlayer = u.id === b.playerId;
        const name = this.add.text(sx(G.nameX), y, meta.name, {
          fontFamily: FONT_BRUSH, fontSize: '28px', color: isPlayer ? '#ffe9a8' : '#f6e9c9', stroke: '#2a1a0c', strokeThickness: 4,
        }).setOrigin(left ? 0 : 1, 0.5).setDepth(12);
        objs.push(name);
        // HP 바 — 왼쪽은 오른쪽으로, 오른쪽은 왼쪽으로 줄어든다
        objs.push(this.add.rectangle(sx(G.barX), y, G.barW, G.barH, 0x000000, 0.55).setOrigin(left ? 0 : 1, 0.5)
          .setStrokeStyle(1, 0xd9b25a, 0.7).setDepth(10));
        const fill = this.add.rectangle(sx(G.barX + 1), y, G.barW - 2, G.barH - 4, isPlayer ? 0xd94a3a : 0xc73b2e)
          .setOrigin(left ? 0 : 1, 0.5).setDepth(11);
        objs.push(fill);
        const portrait = objs[0];
        this.genRows.push({ meta, unit: u, fill, name, portrait, objs, lastHp: -1 });
      });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 하단 오른쪽 — 무장기 원형 버튼 + 병법 3버튼
  // ─────────────────────────────────────────────────────────────

  buildControls() {
    const S = HUD_LAYOUT.skill;
    const cx = W - S.cx, cy = H - S.cy;
    const c = this.skillBtn = this.add.container(cx, cy).setDepth(20);
    // 빛 무리(게이지 100) — 뒤에 깔린다
    this.skillGlow = this.textures.exists('glow')
      ? this.add.image(0, 0, 'glow').setTint(0xffd24a).setBlendMode(Phaser.BlendModes.ADD).setScale(1.1).setAlpha(0)
      : this.add.circle(0, 0, S.r + 14, 0xffd24a, 0).setAlpha(0);
    c.add(this.skillGlow);
    c.add(this.add.circle(0, 0, S.r, 0x1a120c, 0.92).setStrokeStyle(4, 0x8a6a2f));
    this.skillArc = this.add.graphics();
    c.add(this.skillArc);
    c.add(this.add.circle(0, 0, S.r - 12, 0x2a1c12, 1).setStrokeStyle(2, 0x5a4020));
    this.skillText = this.add.text(0, 0, '', {
      fontFamily: FONT_BRUSH, fontSize: '30px', color: '#f6e9c9', stroke: '#2a1a0c', strokeThickness: 4,
    }).setOrigin(0.5);
    c.add(this.skillText);
    c.setSize(S.r * 2 + 8, S.r * 2 + 8).setInteractive({ useHandCursor: true });
    c.on('pointerdown', () => c.setScale(0.92));
    c.on('pointerup', () => { c.setScale(1); if (this.battle) this.battle.tryUseSkill(); });
    c.on('pointerout', () => c.setScale(1));

    // 병법 3버튼 — 무장기 버튼 위 한 줄, 오른쪽 정렬
    const T = HUD_LAYOUT.tactic;
    const total = TACTICS.length * T.w + (TACTICS.length - 1) * T.gap;
    const x0 = W - HUD_LAYOUT.bar.margin - total + T.w / 2;
    const ty = cy - S.r - 14 - T.h / 2;
    this.tacticBtns = TACTICS.map((t, i) => {
      const btn = this.makeButton(x0 + i * (T.w + T.gap), ty, T.w, T.h, T.corner, t.label,
        () => { if (this.battle) this.battle.command(t.cmd); });
      btn.setDepth(20);
      btn.cmd = t.cmd;
      return btn;
    });
  }

  /** 게이지 호 — 12시부터 시계 방향 */
  drawGauge(g) {
    const a = this.skillArc;
    const r = HUD_LAYOUT.skill.r - 6;
    a.clear();
    if (g <= 0) return;
    a.lineStyle(8, g >= 100 ? 0xffd24a : 0xd9b25a, 1);
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
      this.barL.fill.scaleX = b.total.left ? Math.max(0, l / b.total.left) : 0;
      this.barL.text.setText(`아군 ${l}`);
    }
    if (r !== L.r) {
      L.r = r;
      this.barR.fill.scaleX = b.total.right ? Math.max(0, r / b.total.right) : 0;
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
        row.fill.scaleX = hp;
        if (hp <= 0) { row.name.setAlpha(0.45); row.portrait.setAlpha(0.45); }
      }
    }
    // 무장기 게이지·이름
    const p = b.playerUnit;
    const g = p ? Math.round(Math.max(0, Math.min(100, p.gauge || 0))) : 0;
    if (g !== L.gauge) {
      L.gauge = g;
      this.drawGauge(g);
      this.setReady(g >= 100 && !b.ended);
    }
    if (!L.skillName && p) {
      const meta = b.genMeta.get(p.id);
      L.skillName = (meta && meta.skill && meta.skill.name) || '무장기';
      this.skillText.setText(L.skillName);
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
