// fx.js — 전투 이펙트 헬퍼 (BATTLE.md §4.1 「이펙트」 + BATTLE_ART.md §3·§5). Phaser 를 쓴다.
//   new Fx(scene)       전장 좌표 이펙트 — 베기 궤적·화살·먼지·불꽃·피해 숫자·잔상·광역 범위 표시
//                       + 2차: ADD 스프라이트 풀 60(타격 불꽃·먼지 뭉치·베기 호·청룡참·충격파 링·돌진 충격) · 바닥 데칼 풀 40.
//                       BattleScene 이 만들고 매 프레임 fx.update(time, delta) 를 부른다.
//   cutin(scene, opts)  화면 좌표 컷인 — BattleHud 씬에 띄운다(카메라 영향 없음).
//                       (3차) 연출은 cutin.js 로 옮겼다: 눈 띠 → 사선 패널 + 주 일러스트 → 붓글씨 → 플래시 → 복귀 (BATTLE_V3.md §3.3).
//                       여기 cutin() 은 이름·인자를 그대로 둔 채 playCutin 을 부르고 그 handle 을 돌려준다.
// 매 프레임 생성·파괴를 피하려고 전부 풀로 둔다. 2차 풀(fx·데칼)은 트윈도 안 쓴다 — 스프라이트에 수명·속도·배율을 적어 두고
//   update() 의 for 한 번으로 굴린다(타격은 초당 수십 번이라 트윈·클로저를 만들면 그게 곧 GC 다).
// 텍스처: 'dust'·'spark'·'arrow'·'unit_inf' 는 BootScene 이 늘 만들고, 'fx_*'·'field_blood*'·'field_crater' 는 그림이 없으면
//   BootScene 이 같은 키로 캔버스 자리표시를 만든다. 그래도 없으면(헤드리스 점검 등) 해당 이펙트만 조용히 건너뛰고
//   hit()/slashBig() 은 false 를 돌려 BattleScene 이 1차 방식(Graphics 호)으로 폴백한다.
// 3.60+ 파티클 문법: scene.add.particles(x, y, key, config) → ParticleEmitter, explode(count, x, y).

import { playCutin } from './cutin.js';   // (3차) 컷신 연출 본체

// (검수 수정) FONT_BRUSH 상수는 지웠다 — 붓글씨는 컷인만 썼고 그 컷인이 cutin.js 로 갔다(거기 같은 상수가 있다). 안 쓰는 상수를 남겨 둘 이유가 없다.
const FONT_BODY = '"Song Myung", "Noto Serif KR", serif';
const DEG = Math.PI / 180;

/**
 * 깊이 — BATTLE_ART.md §5 층: 데칼 5 < 소품 6 < 그림자 7 < 유닛(y 400~690) < fx ADD 900 < 앞 안개 950.
 * 유닛은 y 를 깊이로 쓰므로 그보다 위/아래로 둔다.
 */
export const FX_DEPTH = { decal: 5, area: 7.8, arrow: 800, fx: 900, slash: 900, dust: 940, spark: 945, text: 1200 };

/** 풀 크기 (BATTLE_ART.md §5 성능) */
export const FX_POOL = 60;
export const DECAL_POOL = 40;
const DECAL_LIFE = 20000;   // 20초 뒤
const DECAL_FADE = 2500;    // 서서히 사라짐
const DUST_TINT = 0xd9c49a; // 먼지 — 흰 구름 그림에 흙빛을 곱한다(ADD 라 밝은 땅에서 하얗게 뜨지 않게 알파도 낮게)
const RING_FILL = 0.74;     // fx_ring 그림에서 링 지름 / 캔버스 폭 — (통합 실측) 가장 밝은 반지름 95/128 = 0.742 (0.77 은 번짐 바깥 끝 29~226 기준이라 링이 4% 작게 나왔다)
const GROUND_SQUASH = 0.5;  // 땅에 누운 원의 세로 비(가짜 원근) — 범위 표시(area)와 충격파 링이 같은 타원이 되게 하나로 (링만 0.42 였다, 검수)

/** 계약 크기(폭) — 실제 텍스처 폭을 못 읽을 때만 쓴다. 이펙트 크기는 「화면 px → 배율」로 주므로 그림 크기가 달라도 같은 크기로 나온다 */
const NOMINAL_W = {
  fx_spark: 64, fx_dust: 128, fx_slash_white: 256, fx_slash_blue: 512, fx_ring: 256, fx_impact: 128,
  field_blood1: 128, field_blood2: 128, field_crater: 128,
};

export class Fx {
  /** @param {Phaser.Scene} scene BattleScene */
  constructor(scene) {
    this.scene = scene;
    const has = (k) => scene.textures.exists(k);
    this.texWCache = {};

    /** 베기 궤적(1차 폴백): Graphics 풀 + 살아 있는 것 { g, life(프레임) } */
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

    /**
     * 2차 — ADD 스프라이트 풀 60. 필드: ft(경과 ms, 음수면 대기)·fdur·fs0/fs1(배율 시작/끝)·fsy(세로 배율비)·fa0/fa1(알파)
     *   ·fvx/fvy(px/s)·fspin(°/s). 풀이 비면 그 이펙트는 건너뛴다(오래된 것을 뺏지 않는다 — 무장기 이펙트가 끊기면 더 티 난다).
     */
    this.fxPool = [];
    this.fxLive = [];
    const fxKey = ['fx_spark', 'fx_dust', 'spark', 'dust'].find(has);
    if (fxKey) {
      for (let i = 0; i < FX_POOL; i++) {
        this.fxPool.push(scene.add.image(0, 0, fxKey).setBlendMode(Phaser.BlendModes.ADD).setDepth(FX_DEPTH.fx)
          .setActive(false).setVisible(false));
      }
    }

    /** 2차 — 바닥 데칼 풀 40 (Graphics 가 아니라 sprite). 다 쓰면 가장 오래된 것부터 재사용(decalNext 가 돈다) */
    this.decals = [];
    this.decalNext = 0;
    this.decalLive = 0;
    this.bloodKeys = ['field_blood1', 'field_blood2'].filter(has);
    const decalKey = this.bloodKeys[0] || (has('field_crater') ? 'field_crater' : null);
    if (decalKey) {
      for (let i = 0; i < DECAL_POOL; i++) {
        const d = scene.add.image(0, 0, decalKey).setDepth(FX_DEPTH.decal).setActive(false).setVisible(false);
        d.born = 0;
        this.decals.push(d);
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

  /** 텍스처 실제 폭(없으면 계약 폭) — 「화면 px → 배율」 환산용. 한 번 재면 기억해 둔다 */
  texW(key) {
    let w = this.texWCache[key];
    if (w) return w;
    w = NOMINAL_W[key] || 64;
    const T = this.scene.textures;
    if (T && typeof T.get === 'function') {
      const tex = T.get(key);
      const src = tex && typeof tex.getSourceImage === 'function' ? tex.getSourceImage() : null;
      if (src && src.width > 0) w = src.width;
    }
    this.texWCache[key] = w;
    return w;
  }

  /** 매 프레임 — 1차 궤적 3프레임 수명 + 2차 풀(수명·이동·배율·알파) + 데칼 페이드 */
  update(time, delta = 16.7) {
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

    const live = this.fxLive;
    const dts = delta / 1000;
    for (let i = live.length - 1; i >= 0; i--) {
      const s = live[i];
      s.ft += delta;
      if (s.ft < 0) continue;                      // 지연 시작
      const k = s.ft / s.fdur;
      if (k >= 1) {
        s.setActive(false).setVisible(false);
        live[i] = live[live.length - 1];           // 뒤에서부터 돌므로 마지막 것은 이미 처리됐다
        live.pop();
        this.fxPool.push(s);
        continue;
      }
      if (!s.visible) s.setVisible(true);
      const e = 1 - (1 - k) * (1 - k);             // 배율은 easeOut(처음에 확 커진다)
      const sc = s.fs0 + (s.fs1 - s.fs0) * e;
      s.x += s.fvx * dts;
      s.y += s.fvy * dts;
      s.setScale(sc, sc * s.fsy);
      s.alpha = s.fa0 + (s.fa1 - s.fa0) * k * k;   // 알파는 끝에서 빠르게
      if (s.fspin) s.angle += s.fspin * dts;
    }

    if (this.decalLive > 0) {
      const ds = this.decals;
      for (let i = 0; i < ds.length; i++) {
        const d = ds[i];
        if (!d.active) continue;
        const age = time - d.born;
        if (age < DECAL_LIFE) continue;
        const k = (age - DECAL_LIFE) / DECAL_FADE;
        if (k >= 1) {
          d.setActive(false).setVisible(false);
          this.decalLive--;
        } else {
          d.alpha = d.a0 * (1 - k);
        }
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 2차 — ADD 스프라이트 풀
  // ─────────────────────────────────────────────────────────────

  /**
   * 풀에서 하나 꺼내 띄운다. 크기는 화면 px(폭) 로 준다 — px0 → px1.
   * @returns {Phaser.GameObjects.Image|null} 돌려받은 스프라이트에 fvx·fvy·fsy·fspin·angle·flipX·tint 를 더 얹을 수 있다
   */
  spawn(key, x, y, dur, px0, px1, a0 = 1, a1 = 0, delay = 0) {
    if (!this.scene.textures.exists(key)) return null;
    const s = this.fxPool.pop();
    if (!s) return null;
    const w = this.texW(key);
    s.setTexture(key).setPosition(x, y).setAngle(0).setFlipX(false).setTint(0xffffff)
      .setDepth(FX_DEPTH.fx).setAlpha(a0).setScale(px0 / w).setActive(true).setVisible(delay <= 0);
    s.ft = -delay;
    s.fdur = dur;
    s.fs0 = px0 / w;
    s.fs1 = px1 / w;
    s.fsy = 1;
    s.fa0 = a0;
    s.fa1 = a1;
    s.fvx = 0;
    s.fvy = 0;
    s.fspin = 0;
    this.fxLive.push(s);
    return s;
  }

  /**
   * 타격 — 불꽃 1개(ADD, 0.15초) + 작은 먼지 2개. 풀이 빠듯하면(남은 18 미만) 먼지는 건너뛴다.
   * @param {number} dir 공격자가 보는 방향(1/-1)
   * @param {boolean} big 무장이 끼면 크게
   * @returns {boolean} 불꽃을 띄웠는가(false 면 BattleScene 이 1차 Graphics 호로 폴백)
   */
  hit(x, y, dir, big = false) {
    const s = this.spawn('fx_spark', x + dir * 4, y - (big ? 30 : 18), 150, big ? 44 : 26, big ? 92 : 54, 1, 0);
    if (!s) return false;
    s.angle = Math.random() * 360;
    if (this.fxPool.length >= 18) {
      for (let i = 0; i < 2; i++) {
        const sg = i ? 1 : -1;
        const d = this.spawn('fx_dust', x + sg * 7, y - 3, 360, 14, big ? 46 : 34, 0.34, 0);
        if (!d) break;
        d.setTint(DUST_TINT);
        d.fvx = sg * 20 - dir * 12;
        d.fvy = -16;
      }
    }
    return true;
  }

  /** 작은 불꽃 하나 — 화살 명중처럼 먼지 없이 */
  spawnSpark(x, y, px = 30) {
    const s = this.spawn('fx_spark', x, y, 130, px * 0.5, px, 0.9, 0);
    if (s) s.angle = Math.random() * 360;
    return !!s;
  }

  /** 먼지 뭉치 n개 — 죽음(3)·넉백(1)·돌진 궤적. 하나도 못 띄우면 false(→ 1차 파티클 먼지로) */
  puffs(x, y, n = 3, px = 44) {
    let ok = false;
    for (let i = 0; i < n; i++) {
      const a = (i / Math.max(1, n)) * Math.PI + Math.random() * 0.6;
      const d = this.spawn('fx_dust', x + Math.cos(a) * 10, y - 4 - Math.sin(a) * 4, 420 + i * 40, px * 0.4, px, 0.4, 0);
      if (!d) break;
      d.setTint(DUST_TINT);
      d.fvx = Math.cos(a) * 34;
      d.fvy = -12 - Math.sin(a) * 14;
      ok = true;
    }
    return ok;
  }

  /** 무장 공격 — slash_white 호(ADD, 0.2초). 그림은 오른쪽으로 볼록 → 왼쪽 보기면 뒤집는다 */
  slashBig(x, y, dir) {
    const s = this.spawn('fx_slash_white', x + dir * 20, y - 34, 200, 84, 136, 1, 0);
    if (!s) return false;
    s.setFlipX(dir < 0);
    s.angle = -dir * 14;
    s.fspin = dir * 140;          // 0.2초에 28° 쓸어내린다
    s.fvx = dir * 60;
    return true;
  }

  /** 청룡참 — slash_blue 가 range(420)px 날아가며 커진다 */
  skillCone(x, y, dir, range = 420) {
    const ms = 420;
    const s = this.spawn('fx_slash_blue', x + dir * 30, y - 36, ms, 150, Math.max(260, range), 1, 0);
    if (!s) return false;
    s.setFlipX(dir < 0);
    s.fvx = dir * range / (ms / 1000);
    // 뒤따르는 옅은 잔상 하나
    const t = this.spawn('fx_slash_blue', x + dir * 10, y - 36, ms, 120, Math.max(220, range * 0.8), 0.45, 0, 70);
    if (t) { t.setFlipX(dir < 0); t.fvx = s.fvx * 0.9; }
    return true;
  }

  /** 포효·쌍극 — 땅에 깔린 링이 지름 range → 2×range 로 퍼지며 사라진다 + 가슴 높이의 선 링 하나 */
  skillRing(x, y, range = 240) {
    const s = this.spawn('fx_ring', x, y, 460, range / RING_FILL, range * 2 / RING_FILL, 1, 0);
    if (!s) return false;
    s.fsy = GROUND_SQUASH;        // 가짜 원근(땅에 누운 원)
    s.scaleY = s.scaleX * GROUND_SQUASH;   // (통합) spawn 은 균일 배율로 띄운다 — update 전 첫 프레임에 정원으로 한 번 그려지지 않게(검수)
    const u = this.spawn('fx_ring', x, y - 30, 360, range * 0.4 / RING_FILL, range * 1.1 / RING_FILL, 0.7, 0, 60);
    if (u) u.fsy = 1;
    return true;
  }

  /** 맹공 돌진 충격(방사형) */
  impact(x, y, px = 150) {
    const s = this.spawn('fx_impact', x, y, 280, px * 0.45, px, 1, 0);
    if (!s) return false;
    s.angle = Math.random() * 360;
    return true;
  }

  /**
   * 바닥 데칼 — 'blood'(죽은 자리) | 'crater'(무장기 자리). 20초 뒤 서서히 사라진다. 풀 40, 오래된 것부터 재사용.
   * @param {number} px 표시 폭
   */
  decal(x, y, kind = 'blood', px = 46, time = this.scene.time.now) {
    if (!this.decals.length) return false;
    let key;
    if (kind === 'crater') key = this.scene.textures.exists('field_crater') ? 'field_crater' : null;
    else key = this.bloodKeys.length ? this.bloodKeys[(Math.random() * this.bloodKeys.length) | 0] : null;
    if (!key) return false;
    const d = this.decals[this.decalNext];
    this.decalNext = (this.decalNext + 1) % this.decals.length;
    if (!d.active) this.decalLive++;
    const sc = px / this.texW(key);
    d.a0 = kind === 'crater' ? 0.85 : 0.7 + Math.random() * 0.2;
    d.born = time;
    d.setTexture(key).setPosition(x, y).setScale(sc * (Math.random() < 0.5 ? -1 : 1), sc)
      .setAngle((Math.random() - 0.5) * 16).setAlpha(d.a0).setActive(true).setVisible(true);
    return true;
  }

  // ─────────────────────────────────────────────────────────────
  // 1차 이펙트 (그대로)
  // ─────────────────────────────────────────────────────────────

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

  /** 먼지 n개 (파티클) */
  dust(x, y, n = 4) {
    if (this.dustEmitter) this.dustEmitter.explode(n, x, y);
  }

  /** 불꽃 n개 (파티클) */
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
   * @param {Phaser.GameObjects.Sprite} src  baseTint 필드(편 색, 2차 그림이면 null)를 가진 유닛 스프라이트
   * @param {number} dir 밀려나는 방향(-1/1) — 잔상은 반대쪽에 남는다
   */
  ghost(src, dir = 0) {
    const g = this.ghostPool.pop();
    if (!g || !src.texture) return;
    g.setTexture(src.texture.key).setPosition(src.x, src.y).setFlipX(!!src.flipX)
      .setOrigin(src.originX, src.originY)   // 2차 그림은 origin 0.95 — 안 맞추면 잔상이 발밑으로 8px 꺼진다
      .setScale(src.scaleX, src.scaleY).setAngle(src.angle)
      .setTint(src.baseTint != null ? src.baseTint : 0xffffff).setAlpha(0.45).setDepth(src.depth - 0.5)
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
   * @param {number} strength 1 = 1차 그대로. 2차 이펙트(청룡참·링)가 같이 나갈 땐 0.5 쯤으로 옅게
   */
  area(x, y, facing, skill, strength = 1) {
    const g = this.scene.add.graphics().setDepth(FX_DEPTH.area).setPosition(x, y).setScale(1, GROUND_SQUASH);
    const range = (skill && skill.range) || 200;
    g.fillStyle(0xfff0c0, 0.3 * strength);
    g.lineStyle(3, 0xffffff, 0.85 * strength);
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
 * 무장기 컷인 — HUD 씬(화면 좌표)에 띄운다. 끝나면 스스로 지운다(누수 없음).
 * (3차, BATTLE_V3.md §3.3) 띠 + 초상 슬라이드였던 본문을 cutin.js 의 다섯 박자 컷신으로 바꿨다 — 제작자 피드백 「컷신이 안 이쁘다」.
 *   내보내는 이름·인자는 그대로라 BattleHud 는 안 고쳐도 돈다. 돌려주는 값만 새로 생겼다(전엔 undefined).
 * @param {Phaser.Scene} scene  BattleHud
 * @param {{name?:string, skillName?:string, key?:string|null, color?:number, side?:string, mode?:string, onImpact?:Function, onDone?:Function}} opts
 *        key: 초상 텍스처 키(cutin_<id>). 없거나 텍스처가 없으면 패널 + 붓글씨만. 눈 띠는 cutin_<id>_eyes(없으면 그 박자를 건너뛴다).
 *        side: 'right' 면 좌우 반전(BattleHud 가 side: meta.side 를 넘긴다). 없으면 아군('left')으로 본다.
 *              (검수 수정) 전엔 side 가 없을 때 색(0x9cc0ff)으로 편을 짐작했다 — HUD 색이 바뀌면 조용히 틀리는 폴백이라 뺐다.
 *        mode: 'full'|'short'|'off' — 없으면 registry 'cutinMode'(기본 'full') + 「1.6초 안 연달아 = short」 규칙.
 * @returns {{mode:string, duration:number, fireAt:number, impactAt:number, active:boolean, done:Promise, cancel:Function}}
 *        duration = 컷신 길이(ms, 실시간) · impactAt = 전장 복귀 시각(이때 onImpact) · done = 끝(또는 취소) 때 풀리는 Promise
 */
export function cutin(scene, { name = '', skillName = '', key = null, color = 0xffd24a, ...more } = {}) {
  const side = more.side === 'right' ? 'right' : 'left';
  return playCutin(scene, { ...more, name, skillName, key, color, side });
}

export default Fx;
