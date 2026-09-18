// MapScene — 전략맵 (SPEC §5.2).
//   지도 + 구름 2겹, 도시 46개(성·깃발·이름), 도로(점선), 행군 데모, 카메라 팬/줌/핀치, 성 탭 → 패널.
// UIScene 은 이 씬 위에 겹쳐 뜨고(카메라 영향 없음), 씬 간 통신은 this.events 로 한다:
//   MapScene → UIScene : 'city:open'  (city)
//   UIScene  → MapScene: 'city:close' ()

import { CITIES, ROUTES } from '../data/cities.js';
import { factionOf, isPlayerCity, colorNum } from '../data/factions.js';
import { play as sfx } from '../sfx.js';

/** 논리 좌표(1000×780) → 지도 그림 좌표(2000×1560) */
const S = 2;
const MAP_W = 2000;
const MAP_H = 1560;
/** 최소 줌 = 세로가 딱 맞게 (SPEC §2) */
const MIN_ZOOM = 720 / MAP_H;
const MAX_ZOOM = 1.6;
/**
 * 시작은 지도 전체가 아니라 플레이어 수도(성도) 주변을 보여 준다.
 * 폰(FIT 배율 ≈0.54)에서 전체 지도를 띄우면 성이 25px, 이름이 11px 로 읽히지 않는다.
 */
const START_ZOOM = 0.9;
const START_CITY = 26; // 성도
/** 이 줌 미만이면 도로 숨김 */
const ROUTE_SHOW_ZOOM = 0.8;
/** 탭/드래그 구분 거리(화면 px) */
const TAP_DIST = 8;
/**
 * 성 아이콘 배율 — 실제 그림 112/136/160px(알파 폭 88/128/131) 기준.
 * 줌 1 에서 표시 폭 ≈ 53 / 72 / 92px (대도시 ≈ 90px). flag 는 그 성 위 깃발 배율.
 */
const CASTLE = {
  castle_1: { scale: 0.55, flag: 0.42 },   // ≈48px — 이웃 도시가 90~110px 간격이라 소·중은 작게
  castle_2: { scale: 0.52, flag: 0.46 },   // ≈67px
  castle_3: { scale: 0.70, flag: 0.52 },   // ≈92px (SPEC: 대도시 ≈90px)
};
/** 성 그림에서 성터(3/4 뷰 바닥면) 가운데의 세로 비율 — 이 점이 도시 좌표에 놓인다 */
const CASTLE_ORIGIN_Y = 0.88;
/** flag.png(64×96) 안의 깃대 밑동 위치 비율 — 깃대 x≈20, 밑동 y≈94. 이 점을 성 지붕에 꽂는다 */
const FLAG_ORIGIN = [0.31, 0.98];
/** 행군 데모 경로: 성도 → 재동 → 한중 → 장안 (왕복) */
const MARCH_PATH = [26, 25, 24, 19];
const MARCH_SPEED = 55; // 지도 px/초
/** army.png(96×96) 는 오른쪽을 보고 발굽이 y≈93 → origin y 0.95. 0.6 이면 기수 높이 ≈55px(중성보다 작게) */
const ARMY_SCALE = 0.6;

const FONT_BODY = '"Song Myung", "Noto Serif KR", serif';

/** 점선 — Graphics 에 대시가 없어 직접 자른다 */
function dashedLine(g, x1, y1, x2, y2, dash, gap) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 1) return;
  const ux = dx / len, uy = dy / len;
  for (let d = 0; d < len; d += dash + gap) {
    const e = Math.min(d + dash, len);
    g.lineBetween(x1 + ux * d, y1 + uy * d, x1 + ux * e, y1 + uy * e);
  }
}

export default class MapScene extends Phaser.Scene {
  constructor() {
    super('MapScene');
  }

  create() {
    this.missing = new Set(this.registry.get('missing') || []);
    // 핀치용 두 번째 터치 포인터 (pointer1 + pointer2)
    this.input.addPointer(1);

    this.buildMap();
    this.buildRoutes();
    this.buildCities();
    this.buildArmy();
    this.buildClouds();
    this.setupCamera();
    this.setupInput();

    // UI 는 위에 겹친다
    this.scene.launch('UIScene');
    this.events.on('city:close', () => this.setSelected(null));
  }

  // ─────────────────────────────────────────────────────────────
  // 지도·도로·구름
  // ─────────────────────────────────────────────────────────────

  buildMap() {
    if (this.textures.exists('map')) {
      this.mapImg = this.add.image(0, 0, 'map').setOrigin(0).setDepth(0);
    } else {
      // 최후 폴백 — BootScene 이 'map' 을 만들어 두므로 보통 안 온다
      const g = this.add.graphics().setDepth(0);
      g.fillStyle(0xcfbc90, 1).fillRect(0, 0, MAP_W, MAP_H);
      g.fillStyle(0x7f9fb8, 1).fillRect(1740, 0, 260, 860).fillRect(1600, 1000, 400, 560);
    }
  }

  buildRoutes() {
    const g = this.add.graphics().setDepth(1);
    for (const [a, b, , water] of ROUTES) {
      const A = CITIES[a], B = CITIES[b];
      const x1 = A.x * S, y1 = A.y * S, x2 = B.x * S, y2 = B.y * S;
      // 밑에 옅은 띠, 위에 점선
      g.lineStyle(7, water ? 0x9fc4e0 : 0xf0e2c0, 0.28);
      g.lineBetween(x1, y1, x2, y2);
      g.lineStyle(3, water ? 0x2f6fae : 0x5a3a1e, 0.85);
      dashedLine(g, x1, y1, x2, y2, water ? 8 : 13, water ? 8 : 9);
    }
    this.routes = g;
    this.routesTarget = 0;
    g.setAlpha(0).setVisible(false);
  }

  buildClouds() {
    if (!this.textures.exists('clouds')) return;
    // 지도 전체를 덮는 tileSprite 두 장 — 속도·배율·알파 다르게 (SPEC: 0.35 / 0.2)
    // TileSprite 는 표시 크기만 한 2D 캔버스를 따로 잡으므로 절반 크기로 만들고 2배 확대한다
    // (2000×1560×4B×2 ≈ 25MB → 6MB). tileScale 은 그만큼 절반(0.75 = 지도 위 1.5, 1.2 = 2.4).
    // 두 번째 겹은 좌우 반전 — 구름 그림에 박힌 대각선 결이 같은 방향으로 겹쳐 반복이 드러나는 것을 막는다.
    this.cloud1 = this.add.tileSprite(0, 0, MAP_W / 2, MAP_H / 2, 'clouds')
      .setOrigin(0).setScale(2).setAlpha(0.35).setDepth(30).setTileScale(0.75, 0.75);
    this.cloud2 = this.add.tileSprite(0, 0, MAP_W / 2, MAP_H / 2, 'clouds')
      .setOrigin(0).setScale(2).setAlpha(0.2).setDepth(31).setTileScale(1.2, 1.2).setFlipX(true);
    this.cloud2.tilePositionX = 400;
    this.cloud2.tilePositionY = 250;
  }

  // ─────────────────────────────────────────────────────────────
  // 도시
  // ─────────────────────────────────────────────────────────────

  buildCities() {
    /** @type {{city:any, node:Phaser.GameObjects.Container, name:Phaser.GameObjects.Text, flag:any, castle:any, glow:any, cy:number}[]} */
    this.cityNodes = [];
    /** city.id → cityNodes 항목 */
    this.nodeById = new Map();

    // 선택 표시(빛 무리) — 패널이 열린 도시 밑에 둔다
    this.selRing = this.add.image(0, 0, 'glow').setDepth(9).setVisible(false)
      .setBlendMode(Phaser.BlendModes.ADD).setScale(1.3).setAlpha(0.6);

    for (const city of CITIES) {
      const f = factionOf(city.id);
      const col = colorNum(f.color);
      const x = city.x * S, y = city.y * S;
      const node = this.add.container(x, y).setDepth(10 + city.y / 1000);

      // 성 — 규모별 소·중·대 (size 1~2 / 3 / 4~5). 성터 가운데(origin y 0.88)가 도시 좌표.
      const castleKey = city.size <= 2 ? 'castle_1' : (city.size === 3 ? 'castle_2' : 'castle_3');
      const spec = CASTLE[castleKey];
      let castle;
      if (this.textures.exists(castleKey)) {
        castle = this.add.image(0, 0, castleKey).setOrigin(0.5, CASTLE_ORIGIN_Y).setScale(spec.scale);
      } else {
        // 최후 폴백: 사각 탑
        const w = 24 + city.size * 8;
        castle = this.add.rectangle(0, 0, w, w * 0.8, 0x8f8168).setOrigin(0.5, CASTLE_ORIGIN_Y).setStrokeStyle(2, 0x3a2f24);
      }
      const dw = castle.displayWidth, dh = castle.displayHeight;
      const top = -dh * castle.originY;          // 성 꼭대기 (음수)
      const bottom = dh * (1 - castle.originY);  // 성터 아래 끝 (양수)
      const cy = Math.round(top * 0.45);         // 성 그림의 시각적 가운데 — 빛 무리 기준

      // 플레이어 도시: 은은한 빛 pulse (성보다 먼저 넣어 뒤에 깔린다)
      let glow = null;
      if (isPlayerCity(city.id)) {
        const gs = Math.max(0.8, dw / 90);
        glow = this.add.image(0, cy, 'glow').setTint(col).setBlendMode(Phaser.BlendModes.ADD)
          .setScale(gs).setAlpha(0.3);
        node.add(glow);
        this.tweens.add({
          targets: glow, alpha: 0.6, scale: gs * 1.25, duration: 1400 + (city.id % 5) * 120,
          yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: (city.id % 7) * 90,
        });
      }
      node.add(castle);

      // 깃발 — 흰 텍스처에 세력색 tint. 깃대 밑동(origin 0.31,0.98)을 성 위 오른쪽 지붕에 꽂는다.
      // 살짝 펄럭임(scaleX — 기준점이 깃대라 천만 줄었다 펴진다)
      let flag;
      const fx = Math.round(dw * 0.30), fy = Math.round(top * 0.68);
      if (this.textures.exists('flag')) {
        flag = this.add.image(fx, fy, 'flag').setOrigin(FLAG_ORIGIN[0], FLAG_ORIGIN[1]).setTint(col).setScale(spec.flag);
      } else {
        flag = this.add.triangle(fx, fy, 0, 0, 28, 8, 0, 18, col).setOrigin(0, 1);
      }
      node.add(flag);
      this.tweens.add({
        targets: flag, scaleX: flag.scaleX * 0.78, duration: 260 + (city.id * 37) % 200,
        yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: (city.id * 53) % 400,
      });

      // 이름 — 한글, 세력색 테두리. 성터 바로 아래.
      const name = this.add.text(0, Math.round(bottom) + 3, city.name, {
        fontFamily: FONT_BODY, fontSize: '28px', color: '#fdf3dc',
        stroke: f.color, strokeThickness: 5,
      }).setOrigin(0.5, 0).setResolution(2);
      name.setShadow(1, 2, 'rgba(0,0,0,0.7)', 4, true, false);
      node.add(name);

      // 탭 영역(성 + 깃발 + 이름) — 손가락 크기만큼 넉넉하게
      const hw = Math.max(52, dw / 2 + 10);
      const hTop = top - 10, hBot = bottom + 3 + 34;
      node.setInteractive({
        hitArea: new Phaser.Geom.Rectangle(-hw, hTop, hw * 2, hBot - hTop),
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
        useHandCursor: true,
      });
      node.on('pointerup', (pointer) => this.onCityTap(city, pointer));

      const entry = { city, node, name, flag, castle, glow, cy };
      this.cityNodes.push(entry);
      this.nodeById.set(city.id, entry);
    }
  }

  /** 성 탭(드래그·핀치 뒤 손 뗌은 무시) */
  onCityTap(city, pointer) {
    if (this.pinch || this.time.now < this.ignoreTapUntil) return;
    if (pointer.getDistance() > TAP_DIST) return;
    this.openCity(city);
  }

  /** 성 튕김 + 카메라 이동 + 패널 열기 요청 */
  openCity(city) {
    const n = this.nodeById.get(city.id);
    const cam = this.cameras.main;
    sfx('tap');

    this.tweens.killTweensOf(n.node);
    n.node.setScale(1);
    this.tweens.add({ targets: n.node, scale: 1.15, duration: 120, yoyo: true, ease: 'Quad.easeOut' });

    // 패널이 오른쪽에 뜨므로 성이 화면 (440, 380) 쯤 오게 카메라를 옮긴다
    const z = Math.max(cam.zoom, 0.9);
    const tx = city.x * S + (cam.width / 2 - 440) / z;
    const ty = city.y * S + (cam.height / 2 - 380) / z;
    if (Math.abs(z - cam.zoom) > 0.001) cam.zoomTo(z, 600, 'Sine.easeInOut', true);
    cam.pan(tx, ty, 600, 'Sine.easeInOut', true);

    this.setSelected(city);
    this.events.emit('city:open', city);
  }

  /** 선택 도시 빛 무리 (null 이면 숨김) */
  setSelected(city) {
    this.tweens.killTweensOf(this.selRing);
    if (!city) {
      this.tweens.add({ targets: this.selRing, alpha: 0, duration: 200, onComplete: () => this.selRing.setVisible(false) });
      return;
    }
    const col = colorNum(factionOf(city.id).color);
    const n = this.nodeById.get(city.id);
    const base = Math.max(1.0, n.castle.displayWidth / 80);
    this.selRing.setPosition(city.x * S, city.y * S + n.cy).setTint(col).setVisible(true).setAlpha(0).setScale(base);
    this.tweens.add({ targets: this.selRing, alpha: 0.7, duration: 250 });
    this.tweens.add({ targets: this.selRing, scale: base * 1.25, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  // ─────────────────────────────────────────────────────────────
  // 행군 데모
  // ─────────────────────────────────────────────────────────────

  buildArmy() {
    this.marchPts = MARCH_PATH.map((id) => ({ x: CITIES[id].x * S, y: CITIES[id].y * S }));
    if (this.textures.exists('army')) {
      // 발굽(y≈93/96)이 길 위에 오게 origin y 0.95
      this.army = this.add.image(0, 0, 'army').setOrigin(0.5, 0.95).setScale(ARMY_SCALE);
    } else {
      // 최후 폴백(Shape 라 setFlipX 가 없다 — updateArmy 에서 scaleX 로 뒤집는다)
      this.army = this.add.triangle(0, 0, 0, 36, 18, 0, 36, 36, 0x2e2015).setOrigin(0.5, 0.95);
    }
    this.army.setDepth(25);

    // 먼지 파티클 — 부대를 따라다니며 뒤에 남는다 (3.60+ 문법: add.particles(x, y, key, config))
    this.dust = this.add.particles(0, 0, 'dust', {
      lifespan: { min: 500, max: 950 },
      speed: { min: 6, max: 24 },
      angle: { min: 0, max: 360 },
      scale: { start: 1.0, end: 0.2 },
      alpha: { start: 0.55, end: 0 },
      gravityY: -8,
      frequency: 55,
      quantity: 1,
    }).setDepth(24);
    this.dust.startFollow(this.army, 0, -3);

    // 이동 상태: i 번째 점에서 next 로, 세그먼트 안 진행 거리 d
    const p0 = this.marchPts[0];
    this.march = { i: 0, dir: 1, d: 0, wait: 0 };
    this.army.setPosition(p0.x, p0.y);
  }

  updateArmy(time, delta) {
    const m = this.march, pts = this.marchPts;
    if (m.wait > 0) {
      m.wait -= delta;
      if (m.wait <= 0) this.dust.start();
      return;
    }
    let next = m.i + m.dir;
    let a = pts[m.i], b = pts[next];
    let L = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
    m.d += MARCH_SPEED * delta / 1000;
    while (m.d >= L) {
      m.d -= L;
      m.i = next;
      if (m.i === pts.length - 1 || m.i === 0) {
        // 끝에 닿으면 잠깐 쉬고 되돌아간다
        m.dir *= -1;
        m.wait = 900;
        m.d = 0;
        this.dust.stop();
        this.army.setPosition(pts[m.i].x, pts[m.i].y);
        return;
      }
      next = m.i + m.dir;
      a = pts[m.i]; b = pts[next];
      L = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
    }
    const t = m.d / L;
    const x = Phaser.Math.Linear(a.x, b.x, t);
    const y = Phaser.Math.Linear(a.y, b.y, t) + Math.sin(time / 90) * 1.5;
    this.army.setPosition(x, y);
    const left = b.x < a.x;
    if (this.army.setFlipX) this.army.setFlipX(left);                       // Image
    else this.army.scaleX = Math.abs(this.army.scaleX) * (left ? -1 : 1);   // Shape 폴백
    this.dust.followOffset.set(left ? 10 : -10, -3);
  }

  // ─────────────────────────────────────────────────────────────
  // 카메라
  // ─────────────────────────────────────────────────────────────

  setupCamera() {
    const cam = this.cameras.main;
    cam.setZoom(START_ZOOM);
    this.applyBounds();
    const c = CITIES[START_CITY];
    cam.centerOn(c.x * S + 260, c.y * S - 80);   // 성도가 왼쪽 아래, 한중·장안 쪽이 보이게
    this.lastZoom = cam.zoom;
    this.onZoomChanged();
  }

  /**
   * 지도 밖으로 못 나가게. 뷰가 지도보다 크면(줌 아웃) 지도가 가운데 오도록 경계를 넓힌다.
   * 줌이 바뀔 때마다 다시 계산한다.
   */
  applyBounds() {
    const cam = this.cameras.main;
    const dw = cam.width / cam.zoom, dh = cam.height / cam.zoom;
    const bx = dw > MAP_W ? -(dw - MAP_W) / 2 : 0;
    const by = dh > MAP_H ? -(dh - MAP_H) / 2 : 0;
    cam.setBounds(bx, by, Math.max(dw, MAP_W), Math.max(dh, MAP_H));
  }

  /** 화면 점 (sx, sy) 아래 지도 점이 그대로 있도록 줌 */
  zoomAt(z, sx, sy) {
    const cam = this.cameras.main;
    const oz = cam.zoom;
    if (Math.abs(z - oz) < 1e-4) return;
    const hw = cam.width / 2, hh = cam.height / 2;
    const cx = cam.scrollX + hw, cy = cam.scrollY + hh;
    const wx = cx + (sx - hw) / oz, wy = cy + (sy - hh) / oz;
    cam.setZoom(z);
    this.applyBounds();
    cam.centerOn(wx - (sx - hw) / z, wy - (sy - hh) / z);
  }

  /** 줌이 바뀌면: 이름은 너무 작아지지 않게 역배율, 도로는 0.8 미만에서 숨김 */
  onZoomChanged() {
    const z = this.cameras.main.zoom;
    const ls = Phaser.Math.Clamp(0.75 / z, 1, 1.7);
    for (const n of this.cityNodes) n.name.setScale(ls);
    this.routesTarget = z >= ROUTE_SHOW_ZOOM ? 1 : 0;
  }

  // ─────────────────────────────────────────────────────────────
  // 입력: 드래그 팬, 휠 줌, 두 손가락 핀치
  // ─────────────────────────────────────────────────────────────

  setupInput() {
    this.drag = null;          // { id, x, y }
    this.pinch = null;         // { dist, zoom, mx, my }
    this.ignoreTapUntil = 0;
    this.input.on('pointerdown', this.onPointerDown, this);
    this.input.on('pointermove', this.onPointerMove, this);
    this.input.on('pointerup', this.onPointerUp, this);
    this.input.on('pointerupoutside', this.onPointerUp, this);
    this.input.on('wheel', this.onWheel, this);
    this.input.on('gameout', () => { this.drag = null; });
  }

  stopCameraEffects() {
    const cam = this.cameras.main;
    if (cam.panEffect.isRunning) cam.panEffect.reset();
    if (cam.zoomEffect.isRunning) cam.zoomEffect.reset();
  }

  onPointerDown(p) {
    const p1 = this.input.pointer1, p2 = this.input.pointer2;
    if (p1 && p2 && p1.isDown && p2.isDown) {
      this.stopCameraEffects();
      this.pinch = {
        dist: Math.max(1, Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y)),
        zoom: this.cameras.main.zoom,
        mx: (p1.x + p2.x) / 2, my: (p1.y + p2.y) / 2,
      };
      this.drag = null;
      return;
    }
    // 다른 포인터가 아직 누른 채 드래그 중이면 그대로 두고, 아니면(끝난 드래그가 남아 있어도) 새로 시작
    const cur = this.drag && this.input.manager.pointers.find((q) => q.id === this.drag.id);
    if (!cur || !cur.isDown || cur.id === p.id) {
      this.stopCameraEffects();
      this.drag = { id: p.id, x: p.x, y: p.y };
    }
  }

  onPointerMove(p) {
    const cam = this.cameras.main;
    if (this.pinch) {
      const p1 = this.input.pointer1, p2 = this.input.pointer2;
      if (p1.isDown && p2.isDown) {
        const d = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
        const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
        const z = Phaser.Math.Clamp(this.pinch.zoom * d / this.pinch.dist, MIN_ZOOM, MAX_ZOOM);
        this.zoomAt(z, mx, my);
        // 두 손가락 가운데가 움직이면 같이 팬
        cam.scrollX -= (mx - this.pinch.mx) / cam.zoom;
        cam.scrollY -= (my - this.pinch.my) / cam.zoom;
        this.pinch.mx = mx; this.pinch.my = my;
      }
      return;
    }
    if (this.drag && p.id === this.drag.id) {
      if (!p.isDown) { this.drag = null; return; }
      const dx = p.x - this.drag.x, dy = p.y - this.drag.y;
      cam.scrollX -= dx / cam.zoom;
      cam.scrollY -= dy / cam.zoom;
      this.drag.x = p.x; this.drag.y = p.y;
    }
  }

  onPointerUp(p) {
    if (this.pinch) {
      const p1 = this.input.pointer1, p2 = this.input.pointer2;
      if (!(p1.isDown && p2.isDown)) {
        this.pinch = null;
        this.ignoreTapUntil = this.time.now + 350;   // 핀치 직후 손 뗌을 탭으로 오인하지 않게
        // 남은 손가락으로 바로 팬을 이어 간다 (다시 떼고 눌러야 움직이던 끊김 방지)
        const rest = p1.isDown ? p1 : (p2.isDown ? p2 : null);
        this.drag = rest ? { id: rest.id, x: rest.x, y: rest.y } : null;
        return;
      }
    }
    if (this.drag && p.id === this.drag.id) this.drag = null;
  }

  onWheel(pointer, over, dx, dy) {
    const cam = this.cameras.main;
    const factor = dy > 0 ? 0.9 : 1.1;
    this.zoomAt(Phaser.Math.Clamp(cam.zoom * factor, MIN_ZOOM, MAX_ZOOM), pointer.x, pointer.y);
  }

  // ─────────────────────────────────────────────────────────────

  update(time, delta) {
    const cam = this.cameras.main;
    // zoomTo 효과 등으로 줌이 바뀌었으면 경계·라벨 갱신
    if (cam.zoom !== this.lastZoom) {
      this.lastZoom = cam.zoom;
      this.applyBounds();
      this.onZoomChanged();
    }
    // 도로 페이드
    const ra = this.routes.alpha + (this.routesTarget - this.routes.alpha) * 0.15;
    this.routes.setAlpha(ra);
    this.routes.setVisible(ra > 0.02);
    // 구름 흐름
    if (this.cloud1) {
      // tileSprite 가 절반 크기 ×2 배율이라 체감 속도가 2배 — 증분은 절반
      this.cloud1.tilePositionX += 0.007 * delta;
      this.cloud1.tilePositionY += 0.002 * delta;
      this.cloud2.tilePositionX += 0.013 * delta;
      this.cloud2.tilePositionY -= 0.0015 * delta;
    }
    this.updateArmy(time, delta);
  }
}
