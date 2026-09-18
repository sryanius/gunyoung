// fx.js — 전투 이펙트 헬퍼 (BATTLE.md §4.1 「이펙트」). Phaser 를 쓴다.
//   new Fx(scene)       전장 좌표 이펙트 — 베기 궤적·화살·먼지·불꽃·피해 숫자·잔상·광역 범위 표시.
//                       BattleScene 이 만들고 매 프레임 fx.update() 를 부른다.
//   cutin(scene, opts)  화면 좌표 컷인 — BattleHud 씬에 띄운다(카메라 영향 없음).
//                       초상 텍스처(cutin_<id>)가 있으면 오른쪽→왼쪽 0.7초 슬라이드, 없으면 붓글씨 이름만 크게.
// 매 프레임 생성·파괴를 피하려고 궤적 Graphics·화살 Sprite·피해 Text·잔상 Sprite 는 풀로 둔다.
// 텍스처 'dust'·'spark'·'arrow'·'unit_inf' 는 BootScene 이 늘 만든다(없으면 해당 이펙트만 조용히 건너뛴다).
// 3.60+ 파티클 문법: scene.add.particles(x, y, key, config) → ParticleEmitter, explode(count, x, y).

const FONT_BRUSH = '"Nanum Brush Script", "Song Myung", serif';
const FONT_BODY = '"Song Myung", "Noto Serif KR", serif';
const DEG = Math.PI / 180;

/** 깊이 — 유닛은 y(400~690)를 깊이로 쓰므로 그보다 위/아래로 둔다 */
export const FX_DEPTH = { area: 398, arrow: 800, slash: 900, dust: 950, spark: 960, text: 1200 };

export class Fx {
  /** @param {Phaser.Scene} scene BattleScene */
  constructor(scene) {
    this.scene = scene;
    const has = (k) => scene.textures.exists(k);

    /** 베기 궤적: Graphics 풀 + 살아 있는 것 { g, life(프레임) } */
    this.slashPool = [];
    this.slashes = [];
    for (let i = 0; i < 14; i++) {
      this.slashPool.push(scene.add.graphics().setDepth(FX_DEPTH.slash).setVisible(false));
    }

    /** 화살 Sprite 풀 — 궁병 60명 × 비행 0.45초 / 1.4초 간격 ≈ 20개면 충분, 여유 48 */
    this.arrowPool = [];
    if (has('arrow')) {
      for (let i = 0; i < 48; i++) {
        this.arrowPool.push(scene.add.sprite(0, 0, 'arrow').setOrigin(0.85, 0.5).setDepth(FX_DEPTH.arrow)
          .setActive(false).setVisible(false));
      }
    }

    /** 피해 숫자 Text 풀 30 (무장 피해만 띄운다) */
    this.textPool = [];
    this.textLive = [];
    for (let i = 0; i < 30; i++) {
      this.textPool.push(scene.add.text(0, 0, '', {
        fontFamily: FONT_BODY, fontSize: '26px', color: '#fff1c0', stroke: '#3a1a0c', strokeThickness: 4,
      }).setOrigin(0.5).setDepth(FX_DEPTH.text).setVisible(false));
    }

    /** 넉백 잔상 Sprite 풀 */
    this.ghostPool = [];
    if (has('unit_inf')) {
      for (let i = 0; i < 24; i++) {
        this.ghostPool.push(scene.add.sprite(0, 0, 'unit_inf').setOrigin(0.5, 1).setActive(false).setVisible(false));
      }
    }

    // 먼지 — 기병 이동·넉백·죽음. emitting:false 로 두고 explode 로만 터뜨린다.
    this.dustEmitter = has('dust') ? scene.add.particles(0, 0, 'dust', {
      emitting: false,
      lifespan: { min: 320, max: 720 },
      speed: { min: 18, max: 70 },
      angle: { min: 200, max: 340 },
      scale: { start: 1.1, end: 0.2 },
      alpha: { start: 0.7, end: 0 },
      gravityY: 70,
      quantity: 1,
    }).setDepth(FX_DEPTH.dust) : null;

    // 불꽃 — 피격·무장기. 흰 점이 사방으로 튄다.
    this.sparkEmitter = has('spark') ? scene.add.particles(0, 0, 'spark', {
      emitting: false,
      lifespan: { min: 180, max: 420 },
      speed: { min: 60, max: 220 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.9, end: 0 },
      alpha: { start: 1, end: 0 },
      gravityY: 240,
      tint: 0xfff0a0,
      quantity: 1,
    }).setDepth(FX_DEPTH.spark) : null;
  }

  /** 매 프레임 — 궤적 3프레임 수명 */
  update() {
    for (let i = this.slashes.length - 1; i >= 0; i--) {
      const s = this.slashes[i];
      s.life--;
      if (s.life <= 0) {
        s.g.clear().setVisible(false);
        this.slashPool.push(s.g);
        this.slashes.splice(i, 1);
      } else {
        s.g.setAlpha(s.life / 3);
      }
    }
  }

  /**
   * 베기 궤적 — 공격자 앞쪽에 호 하나(+ 얇은 바깥 호), 3프레임 동안 흐려진다.
   * @param {number} facing 1 오른쪽 / -1 왼쪽
   * @param {boolean} big 무장이면 크게
   */
  slash(x, y, facing, big = false) {
    const g = this.slashPool.pop();
    if (!g) return;
    const r = big ? 30 : 18;
    const cx = x + facing * (big ? 10 : 6);
    const cy = y - (big ? 28 : 16);
    // Phaser 의 각도는 +x 에서 시계 방향(라디안). 오른쪽 보기: -75°→75°, 왼쪽 보기: 105°→255°
    const a0 = facing > 0 ? -75 * DEG : 105 * DEG;
    const a1 = a0 + 150 * DEG;
    g.clear().setVisible(true).setAlpha(1);
    g.lineStyle(big ? 4 : 2.5, 0xffffff, 0.95);
    g.beginPath(); g.arc(cx, cy, r, a0, a1, false); g.strokePath();
    g.lineStyle(1.5, 0xfff2b0, 0.6);
    g.beginPath(); g.arc(cx, cy, r + 5, a0 + 15 * DEG, a1 - 15 * DEG, false); g.strokePath();
    this.slashes.push({ g, life: 3 });
  }

  /** 화살 — (x0,y0)→(x1,y1) 를 ms 동안 포물선으로. 피해는 sim 이 예약해 두었다 준다 */
  arrow(x0, y0, x1, y1, ms) {
    const s = this.arrowPool.pop();
    if (!s) return;
    // sim 은 x0,y0 를 궁병 가슴 높이(y−20)로 주고 x1,y1 은 목표 발 위치 → 도착점만 가슴 높이로 올린다
    const sx = x0, sy = y0, ex = x1, ey = y1 - 16;
    const dx = ex - sx, dy = ey - sy;
    const h = Math.min(90, Math.max(16, Math.hypot(dx, dy) * 0.22));
    s.setActive(true).setVisible(true).setPosition(sx, sy).setAlpha(1);
    s.rotation = Math.atan2(dy - h * 4, dx);
    this.scene.tweens.addCounter({
      from: 0, to: 1, duration: Math.max(80, ms || 450),
      onUpdate: (tw) => {
        const t = tw.getValue();
        s.x = sx + dx * t;
        s.y = sy + dy * t - h * 4 * t * (1 - t);
        s.rotation = Math.atan2(dy - h * 4 * (1 - 2 * t), dx);
      },
      onComplete: () => {
        s.setActive(false).setVisible(false);
        this.arrowPool.push(s);
      },
    });
  }

  /** 먼지 n개 */
  dust(x, y, n = 4) {
    if (this.dustEmitter) this.dustEmitter.explode(n, x, y);
  }

  /** 불꽃 n개 */
  sparks(x, y, n = 6) {
    if (this.sparkEmitter) this.sparkEmitter.explode(n, x, y);
  }

  /** 피해 숫자 — 위로 뜨며 사라진다. 풀이 비면 가장 오래된 것을 재활용 */
  damage(x, y, dmg, crit = false) {
    let t = this.textPool.pop();
    if (!t) {
      t = this.textLive.shift();
      if (!t) return;
      this.scene.tweens.killTweensOf(t);
    }
    const jitter = ((Math.round(dmg) % 7) - 3) * 3;   // 같은 자리에 겹치지 않게 조금 흩뜨린다
    t.setText(String(Math.max(1, Math.round(dmg))))
      .setPosition(x + jitter, y).setAlpha(1).setScale(crit ? 1.4 : 1).setVisible(true)
      .setColor(crit ? '#ffd24a' : '#fff1c0');
    this.textLive.push(t);
    this.scene.tweens.add({
      targets: t, y: y - 46, alpha: 0, duration: 750, ease: 'Quad.easeOut',
      onComplete: () => {
        t.setVisible(false);
        const i = this.textLive.indexOf(t);
        if (i >= 0) this.textLive.splice(i, 1);
        this.textPool.push(t);
      },
    });
  }

  /**
   * 넉백 잔상 — 원본 스프라이트 모습을 복사해 반투명으로 남겼다 지운다.
   * @param {Phaser.GameObjects.Sprite} src  baseTint 필드(편 색)를 가진 유닛 스프라이트
   * @param {number} dir 밀려나는 방향(-1/1) — 잔상은 반대쪽에 남는다
   */
  ghost(src, dir = 0) {
    const g = this.ghostPool.pop();
    if (!g || !src.texture) return;
    g.setTexture(src.texture.key).setPosition(src.x, src.y).setFlipX(!!src.flipX)
      .setScale(src.scaleX, src.scaleY).setAngle(src.angle)
      .setTint(src.baseTint || 0xffffff).setAlpha(0.45).setDepth(src.depth - 0.5)
      .setActive(true).setVisible(true);
    this.scene.tweens.add({
      targets: g, alpha: 0, x: src.x - dir * 12, duration: 180,
      onComplete: () => {
        g.setActive(false).setVisible(false);
        this.ghostPool.push(g);
      },
    });
  }

  /**
   * 광역 범위 표시 — 땅에 깔린 부채꼴/원/직사각형, 0.25초 뒤 사라진다.
   * Graphics 를 (x,y) 에 두고 세로 0.5배로 눌러 가짜 원근을 준다.
   * @param {{shape:string, range:number}} skill
   */
  area(x, y, facing, skill) {
    const g = this.scene.add.graphics().setDepth(FX_DEPTH.area).setPosition(x, y).setScale(1, 0.5);
    const range = (skill && skill.range) || 200;
    g.fillStyle(0xfff0c0, 0.3);
    g.lineStyle(3, 0xffffff, 0.85);
    switch (skill && skill.shape) {
      case 'cone': {   // 전방 부채꼴 — 각도는 data.js coneDeg(청룡참 100°)
        const deg = (skill && skill.coneDeg) || 100;
        const a0 = (facing > 0 ? -deg / 2 : 180 - deg / 2) * DEG;
        g.slice(0, 0, range, a0, a0 + deg * DEG, false);
        g.fillPath();
        g.strokePath();
        break;
      }
      case 'dash': {   // 전방 돌진 띠 — 폭은 data.js pathWidth(맹공 70), 세로 0.5배 원근이라 실제 절반으로 보인다
        const w = (skill && skill.pathWidth) || 96;
        const x0 = facing > 0 ? 0 : -range;
        g.fillRect(x0, -w / 2, range, w);
        g.strokeRect(x0, -w / 2, range, w);
        break;
      }
      default:
        g.fillCircle(0, 0, range);
        g.strokeCircle(0, 0, range);
    }
    this.scene.tweens.add({ targets: g, alpha: 0, duration: 250, delay: 60, onComplete: () => g.destroy() });
  }
}

/**
 * 무장기 컷인 — HUD 씬(화면 좌표)에 띄운다. 약 1.5초 뒤 스스로 지운다.
 * @param {Phaser.Scene} scene  BattleHud
 * @param {{name?:string, skillName?:string, key?:string|null, color?:number}} opts
 *        key: 초상 텍스처 키(cutin_<id>). 없거나 텍스처가 없으면 붓글씨만.
 */
export function cutin(scene, { name = '', skillName = '', key = null, color = 0xffd24a } = {}) {
  const W = scene.scale.width, H = scene.scale.height;
  const D = 900;
  const T = scene.tweens;
  const objs = [];
  const hasImg = !!(key && scene.textures.exists(key));
  const hex = '#' + color.toString(16).padStart(6, '0');

  // 어두운 띠 + 세력색 선 두 줄 (위아래로 펼쳐진다)
  const band = scene.add.rectangle(W / 2, H / 2, W, 250, 0x000000, 0.6).setDepth(D).setScale(1, 0);
  const lineTop = scene.add.rectangle(W / 2, H / 2 - 125, W, 3, color, 0.9).setDepth(D).setAlpha(0);
  const lineBot = scene.add.rectangle(W / 2, H / 2 + 125, W, 3, color, 0.9).setDepth(D).setAlpha(0);
  objs.push(band, lineTop, lineBot);
  T.add({ targets: band, scaleY: 1, duration: 120, ease: 'Quad.easeOut' });
  T.add({ targets: [lineTop, lineBot], alpha: 1, duration: 120 });

  const fromX = W + 360;
  const toX = -460;
  if (hasImg) {
    // 초상: 오른쪽 밖 → 화면 오른쪽 60% 지점(0.7초) → 잠깐 머문 뒤 왼쪽 밖으로
    const img = scene.add.image(fromX, H / 2 + 40, key).setDepth(D + 1);
    const sc = Math.min(680 / Math.max(1, img.height), 0.9);
    img.setScale(sc);
    objs.push(img);
    T.add({ targets: img, x: W * 0.64, duration: 700, ease: 'Cubic.easeOut' });
    T.add({ targets: img, x: toX, duration: 420, delay: 1050, ease: 'Cubic.easeIn' });
  }

  // 이름·무장기 이름 붓글씨 — 초상이 있으면 왼쪽에서, 없으면 오른쪽에서 들어온다
  const nameSize = hasImg ? '96px' : '128px';
  const nx = hasImg ? -360 : fromX;
  const midX = hasImg ? W * 0.28 : W / 2;
  const nameT = scene.add.text(nx, H / 2 - 34, name, {
    fontFamily: FONT_BRUSH, fontSize: nameSize, color: '#fff3d6', stroke: '#3a1a0c', strokeThickness: 8,
  }).setOrigin(0.5).setDepth(D + 2);
  nameT.setShadow(4, 6, 'rgba(0,0,0,0.7)', 12, true, true);
  const skillT = scene.add.text(nx, H / 2 + 62, skillName, {
    fontFamily: FONT_BRUSH, fontSize: '58px', color: hex, stroke: '#2a1a0c', strokeThickness: 6,
  }).setOrigin(0.5).setDepth(D + 2);
  objs.push(nameT, skillT);
  T.add({ targets: [nameT, skillT], x: midX, duration: 700, ease: 'Cubic.easeOut' });
  T.add({ targets: [nameT, skillT], x: hasImg ? fromX : toX, duration: 420, delay: 1050, ease: 'Cubic.easeIn' });

  // 띠는 마지막에 접힌다
  T.add({
    targets: [band, lineTop, lineBot], alpha: 0, duration: 200, delay: 1300,
    onComplete: () => { for (const o of objs) o.destroy(); },
  });
}

export default Fx;
