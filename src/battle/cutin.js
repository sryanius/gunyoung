// cutin.js — 무장기 컷신 (docs/BATTLE_V3.md §3.3). Phaser 를 쓴다. fx.js 의 cutin() 이 이걸 부른다 — BattleHud 씬(화면 좌표)에 띄운다.
//
//   다섯 박자(전부 실시간 ms — 배속과 무관. HUD 씬의 'update' 이벤트가 주는 time 으로만 굴린다: 트윈·타이머를 하나도 안 만든다):
//     ① 0~250      암전(0.6) + 눈 띠(cutin_<key>_eyes)가 화면 가운데를 가로로 가르며 열린다(세로 0→180, 좌우 페이드, 살짝 줌). 효과음 「슥」
//     ② 250~1200   사선 패널(−12°, 무장 색 그라데이션 + 금테) 위로 주 일러스트(cutin_<key>)가 바깥에서 미끄러져 들어와 감속하며 멈춘다.
//                  패널 안에만 보인다(GeometryMask). 집중선 회전 + 무장 색 입자(ADD). 멈춘 뒤 1.00→1.06 줌. 뒤에 림 라이트(tintFill 가산 복사본,
//                  살짝 어긋나게) + 앞에 옅은 가산 복사본(들어올 때 하얗게 떴다 가라앉는다).
//     ③ 450~       반대편에 먹물 자국(Graphics) + 이름(64px 흰색·검은 외곽) + 무장기명(96px 금색 그라데이션, 한 글자씩 0.05초 간격으로 찍히며 흔들림)
//     ④ 1200~1450  흰 플래시 → 패널이 가운데 선에서 위아래로 갈라지며 닫힌다(가운데 흰 칼금). 효과음 「챙—쾅」
//     ⑤ 1450~1600  전장으로 복귀 — 이 시각(impact)에 BattleScene 이 피해 연출을 터뜨린다. 1600 에 전부 destroy.
//   짧은 버전(0.6초): 앞 컷신이 끝난 지 1.6초 안에 또 터지면(또는 registry.cutinMode = 'short') 눈 띠 없이 열림 0 → 글자 60 → 발동 380 → 복귀 480 → 끝 600.
//   에셋 폴백: 눈 띠가 없으면 ① 을 건너뛰고(−250ms), 주 일러스트가 없으면 패널 + 붓글씨만(가운데, 크게. 1100ms).
//   적 편(side 'right')은 좌우 반전 — 일러스트가 왼쪽에서 들어오고 글자는 오른쪽, 패널 기울기도 반대(+12°), 그림은 flipX.
//
//   내보내는 것
//     playCutin(scene, opts) → handle { mode, duration, fireAt, impactAt, plan, active, done: Promise, cancel() }
//         opts: { name, skillName, key('guanyu' 또는 'cutin_guanyu'), color(편 색 — 입자·눈 띠 선), side('left'|'right'),
//                 mode('full'|'short'|'off' — 주면 registry 보다 우선), onImpact(info), onDone(info) }   info = { canceled: boolean }
//     cutinPlan(scene, { key, mode, now }) → { mode, eye, open, text, fire, impact, total, hasArt, hasEyes … }
//         BattleScene 이 컷신을 띄우기 「전에」 불러 길이를 안다(히트스톱 = impact, 줌 펀치 = fire). 같은 입력이면 playCutin 과 같은 답.
//     cutinTiming(mode, hasEyes, hasArt) · cutinLayout(W, H, …)  — 순수 함수(node 에서 검사·목업에 쓴다)
//     CUTIN_MODE(기본 'full') · CUTIN_CHAIN_MS · CUTIN_ART(무장별 패널 색·얼굴 위치·반전 여부)
//
//   누수 없음: 만든 오브젝트·마스크는 objs/masks 에 모아 끝(또는 cancel·씬 shutdown)에서 전부 destroy, 'update'·'shutdown' 리스너도 뗀다.
//   트윈·delayedCall 은 안 쓴다 → HUD 씬의 tweens.timeScale·time.timeScale 을 누가 바꿔도 컷신 속도는 그대로다.
//
//   수정 내역(2026-09-19 검수 뒤) — 자리마다 「(검수 수정)」 주석
//     · 재진입: 앞 컷신을 걷어내는 콜백(또는 shutdown 콜백) 안에서 playCutin 이 또 불리면 컷신 둘이 겹쳐 돌았다 → 그 호출은 안 띄우고 canceled 로 바로 끝낸다.
//       그래도 onImpact/onDone 콜백 안에서 battle:skill 을 다시 emit 하는 통합은 피할 것(권장: BattleScene 이 update 의 time 으로 복귀 시각을 직접 본다).
//     · name·skillName 에 null 이 와도 컷신이 빠지지 않게 문자열로 고정.
//     · Text 다시 그리기 16번 → 8번(그림자는 style 로, 무장기명 글자의 패딩은 setFill 의 갱신 한 번에 같이).
//     · 입자에도 패널 마스크(WebGL) — 마스크 묶음이 깊이 순서로 이어져 스텐실 패스가 프레임당 2번 → 1번.

import { play as sfx } from '../sfx.js';

const FONT_BRUSH = '"Nanum Brush Script", "Song Myung", serif';
const DEG = Math.PI / 180;

/** registry 'cutinMode' 가 없을 때의 기본값 — 'full' | 'short' | 'off' (HUD 에는 아직 안 넣는다. 다음에 옵션 화면에서) */
export const CUTIN_MODE = 'full';
/** 앞 컷신이 끝난 뒤 이 시간 안에 또 터지면 짧은 버전 */
export const CUTIN_CHAIN_MS = 1600;

/** 깊이 — HUD(결과 패널 31·인트로 41)보다 위 */
const D0 = 900;

// ── 배치 상수 ─────────────────────────────────────────────────
const TILT_DEG = -12;        // 사선 패널 기울기(아군). Phaser 각도는 시계 방향이 + → −12° = 오른쪽이 올라간다. 적 편은 +12°
const BAND_H = 0.68;         // 패널 두께 = 화면 높이 × 0.68 (기울기 때문에 세로로 잰 창은 ÷cos12° ≈ 501px)
const ART_H = 1.25;          // 주 일러스트 displayHeight = 화면 높이 × 1.25 — 그림 크기(832×1216 이든 1248×1824 든)와 무관하게 같은 크기로 나온다
const FACE_IN_BAND = 0.38;   // 얼굴 중심이 패널 창 안에서 올 세로 위치(0 = 창 위 끝, 1 = 아래 끝). 0.5 보다 위에 둬야 상반신이 더 보인다
const ART_EDGE = 0.42;       // 일러스트 중심 x = 화면 가운데 ± clamp(W/2 − 그림 폭×0.42, 240, 560) — 그림의 바깥쪽 변이 화면 끝을 살짝(폭의 8%) 넘게.
const ART_DX = [240, 560];   //   목업(assets/raw/battle3/cutscene)에서 그림 바깥 변이 화면 안에 서면 머리카락·망토가 잘린 세로선이 「붙여 넣은 사각형」으로 보였다. 폭 1680 까지 가려진다
const TEXT_DX = [0.16, 210, 360];   // 붓글씨 x = 화면 가운데 ∓ clamp(W×0.16, 210, 360)
const EYE_BAND_H = 180;      // 눈 띠가 다 열렸을 때 높이
const EYE_IMG_H = 236;       // 눈 그림(4:1) 표시 높이 — 띠보다 커야 줌(×1.1)·열림 동안 위아래가 안 빈다
const PARTICLES = 16;

/**
 * 무장별 조정표(인물별 오프셋). color = 패널·림 라이트 색, faceU/faceV = 주 일러스트 안에서 얼굴 중심(0~1, 왼쪽 위 기준),
 * mirror = 적 편일 때 그림을 flipX 할지. 새 일러스트가 오면 faceU/faceV 만 재서 고치면 얼굴이 패널 창 안 제자리에 온다.
 *   선택 항목: faceIn = 그 무장만 FACE_IN_BAND 대신 쓸 값(얼굴의 패널 창 안 세로 위치 0~1), scale = ART_H 에 곱하는 배율(기본 1).
 *   (통합 2026-09-19) 최종 납품본(1248×1824 여성 일러스트 4장)으로 다시 쟀다 — 「두 눈 가운데와 입 사이(코끝)」 하나의 기준으로:
 *     두 눈 가운데(art 실측, 그림 px) 관우 (611,660) · 장비 (566,549) · 하후돈 (536,454) · 전위 (653,388) + 입 위치 → 얼굴 중심
 *     관우 (606,705) · 장비 (568,595) · 하후돈 (545,497) · 전위 (645,432).  전엔 눈대중이라 관우는 눈썹 위(−67px)·전위는 입(+24px)을 가리켰다.
 *     확인: assets/raw/battle3/_integ_face_check.png(십자선), 합성 미리보기 assets/raw/battle3/cutin_preview_<key>.png (cutin_preview.py).
 *   관우 faceIn 0.47: 그림 맨 위(y 0~250)에 언월도 날이 있다 — 0.38 이면 창 위로 잘려 「무기 없는 상반신」이 된다. 얼굴을 창 가운데 가까이 내려 날을 보인다
 *     (네 장 중 가장 정적인 포즈라 날이 보여야 산다 — art 검수).
 *   하후돈은 안대가 왼쪽 눈이라 flipX 하면 초상과 반대쪽이 된다 — 거슬리면 mirror:false (그 대신 화면 바깥을 본다).
 */
export const CUTIN_ART = {
  guanyu:    { color: 0x3aa655, faceU: 0.486, faceV: 0.387, mirror: true, faceIn: 0.56, scale: 0.92 },
  zhangfei:  { color: 0xc8402e, faceU: 0.455, faceV: 0.326, mirror: true },
  xiahoudun: { color: 0x3b6fd6, faceU: 0.437, faceV: 0.272, mirror: true },
  dianwei:   { color: 0x4a5a9c, faceU: 0.517, faceV: 0.237, mirror: true },
};
const ART_DEFAULT = { color: null, faceU: 0.5, faceV: 0.3, mirror: true, faceIn: null, scale: 1 };
const SIDE_PANEL = { left: 0x3aa655, right: 0x3b6fd6 };   // 표에 없는 무장의 패널 색

// ── 작은 수학 ─────────────────────────────────────────────────
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** t 가 a→b 를 지나는 동안 0→1 */
const seg = (t, a, b) => (b <= a ? (t >= b ? 1 : 0) : clamp01((t - a) / (b - a)));
const outCubic = (k) => 1 - (1 - k) * (1 - k) * (1 - k);
const inCubic = (k) => k * k * k;
const inOutQuad = (k) => (k < 0.5 ? 2 * k * k : 1 - 2 * (1 - k) * (1 - k));
const outBack = (k) => { const c = 1.4, u = k - 1; return 1 + (c + 1) * u * u * u + c * u * u; };
/** 두 색을 섞는다(k = b 의 비율) */
function mix(a, b, k) {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(ar + (br - ar) * k) << 16) | (Math.round(ag + (bg - ag) * k) << 8) | Math.round(ab + (bb - ab) * k);
}
const css = (c) => '#' + (c & 0xffffff).toString(16).padStart(6, '0');
/** 결정적 난수(먹물 자국·입자가 매번 같게) */
function lcg(seed) {
  let a = (seed >>> 0) || 1;
  return () => { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; return a / 4294967296; };
}

// ─────────────────────────────────────────────────────────────
// 시간표·계획·배치 (순수 함수)
// ─────────────────────────────────────────────────────────────

/**
 * 박자 시각(ms). full+눈+그림 = 눈 0~250 · 패널 250 · 글자 450 · 발동 1200 · 복귀(impact) 1450 · 끝 1600.
 * @param {'full'|'short'|'off'} mode
 */
export function cutinTiming(mode, hasEyes = true, hasArt = true) {
  if (mode === 'off') return { mode: 'off', eye: 0, open: 0, text: 0, fire: 0, impact: 0, total: 0, slide: 0, charGap: 0, openLen: 0 };
  const short = mode === 'short';
  const eye = !short && hasEyes ? 250 : 0;             // 눈 띠 박자(없으면 건너뛴다)
  const hold = short ? 380 : hasArt ? 950 : 700;       // 패널이 떠 있는 시간(②+③). 그림이 없으면 붓글씨만이라 짧게
  const fireLen = short ? 100 : 250;                   // ④ 플래시·갈라짐
  const outLen = short ? 120 : 150;                    // ⑤ 복귀
  return {
    mode: short ? 'short' : 'full',
    eye, open: eye, text: eye + (short ? 60 : 200), fire: eye + hold, impact: eye + hold + fireLen, total: eye + hold + fireLen + outLen,
    slide: short ? 200 : 420, charGap: short ? 30 : 50, openLen: short ? 90 : 140,
  };
}

/**
 * 이번 컷신이 어떤 모양·길이가 될지 — 띄우기 전에 안다. registry 'cutinMode'(없으면 CUTIN_MODE)·'cutinBusyUntil'(playCutin 이 적는다)
 * ·텍스처 유무만 본다. BattleScene 은 battle:skill 을 emit 하기 「전에」 부를 것(emit 뒤에는 방금 띄운 컷신 때문에 short 가 나온다).
 * @param {Phaser.Scene} scene 아무 씬(registry·textures 는 게임 전체 공유)
 * @param {{key?:string|null, mode?:string|null, now?:number|null}} o key: 'guanyu' 또는 'cutin_guanyu'
 */
export function cutinPlan(scene, { key = null, mode = null, now = null } = {}) {
  const reg = scene && scene.registry;
  const tex = scene && scene.textures;
  const base = key != null ? String(key).replace(/^cutin_/, '') : '';
  const has = (k) => !!(base && tex && typeof tex.exists === 'function' && tex.exists(k));
  let m = mode || (reg && reg.get('cutinMode')) || CUTIN_MODE;
  if (m !== 'off' && m !== 'short') m = 'full';
  const t = now != null ? now : (scene && scene.time ? scene.time.now : 0);
  if (m === 'full' && !mode) {   // mode 를 직접 줬으면(BattleScene 이 미리 세운 계획을 그대로 넘긴 경우) 연달아 판정을 다시 하지 않는다
    const busy = (reg && reg.get('cutinBusyUntil')) || 0;      // 앞 컷신이 끝나는(끝난) 시각
    if (busy > 0 && t < busy + CUTIN_CHAIN_MS) m = 'short';
  }
  const hasArt = has(`cutin_${base}`), hasEyes = has(`cutin_${base}_eyes`);
  return { ...cutinTiming(m, hasEyes, hasArt), key: base, hasArt, hasEyes, at: t };
}

/**
 * 화면 배치 — 전부 화면 좌표. m = 1(아군: 그림 오른쪽·글자 왼쪽) / −1(적: 반대).
 * @param {{side?:string, texW?:number, texH?:number, tune?:object, hasArt?:boolean}} o
 */
export function cutinLayout(W, H, { side = 'left', texW = 832, texH = 1216, tune = ART_DEFAULT, hasArt = true } = {}) {
  tune = { ...ART_DEFAULT, ...(tune || {}) };   // (통합) CUTIN_ART 의 한 줄을 그대로 넘겨도 되게(빠진 항목은 기본값)
  const m = side === 'right' ? -1 : 1;
  const tiltDeg = TILT_DEG * m;
  const a = tiltDeg * DEG;
  const cos = Math.cos(a), sin = Math.sin(a);
  const bandH = H * BAND_H;
  const bandWin = bandH / cos;                       // 세로로 잰 패널 창 높이
  const L = Math.hypot(W, H) + 240;                  // 패널 길이 — 기울여도 화면 양 끝을 넘는다
  const bandCy = (x) => H / 2 + Math.tan(a) * (x - W / 2);   // 패널 가운데 선의 y
  const dispH = H * ART_H * (tune.scale > 0 ? tune.scale : 1);   // (통합) 인물별 배율(CUTIN_ART.scale) — 없으면 1
  const scale = dispH / Math.max(1, texH);
  const dispW = texW * scale;
  const flip = m < 0 && tune.mirror !== false;
  const artDx = clamp(W / 2 - dispW * ART_EDGE, ART_DX[0], ART_DX[1]);
  const textDx = clamp(W * TEXT_DX[0], TEXT_DX[1], TEXT_DX[2]);
  const imgX = W / 2 + m * artDx;                                       // 그림 중심(origin 0.5) — 가로는 그림 기준, 세로는 얼굴 기준으로 맞춘다
  const faceX = imgX - (0.5 - tune.faceU) * dispW * (flip ? -1 : 1);    // 그 자리에서 얼굴이 놓이는 x (집중선 중심·줌 기준점)
  const faceIn = tune.faceIn != null ? tune.faceIn : FACE_IN_BAND;     // (통합) 인물별 값(CUTIN_ART.faceIn)이 있으면 그것
  const faceY = bandCy(faceX) - bandWin / 2 + faceIn * bandWin;         // 얼굴이 패널 창 안 38%(기본) 높이에 오게
  const imgY = faceY + (0.5 - tune.faceV) * dispH;
  const startX = imgX + m * (W / 2 - artDx + dispW * 0.6 + 60);        // 화면 밖(아군은 오른쪽, 적은 왼쪽)
  const textX = hasArt ? W / 2 - m * textDx : W / 2;
  const textY = bandCy(textX) + 6;
  return {
    m, tiltDeg, a, cos, sin, dirX: cos, dirY: sin, nX: -sin, nY: cos,   // dir = 패널 길이 방향, n = 패널 두께 방향(아래쪽)
    cx: W / 2, cy: H / 2, bandH, bandWin, L,
    faceX, faceY, dispH, dispW, scale, flip, imgX, imgY, startX,
    textX, textY, textScale: hasArt ? 1 : 1.3,
  };
}

// ─────────────────────────────────────────────────────────────
// 캔버스 그라데이션 텍스처 — WebGL/Canvas 어느 쪽이든 같은 그림(Graphics.fillGradientStyle 은 WebGL 전용, tint 는 Canvas 에서 안 먹는다)
// ─────────────────────────────────────────────────────────────

function ensureTex(scene, key, w, h, paint) {
  const T = scene.textures;
  if (T.exists(key)) return key;
  if (typeof T.createCanvas !== 'function') return null;
  try {
    const ct = T.createCanvas(key, w, h);
    const ctx = ct && (ct.context || (typeof ct.getContext === 'function' ? ct.getContext() : null));
    if (!ctx) return null;
    paint(ctx, w, h);
    if (typeof ct.refresh === 'function') ct.refresh();
    return key;
  } catch (e) {
    return null;
  }
}

/** 패널 통짜(어두운 가장자리 → 밝은 가운데 → 어두운 가장자리) */
function panelTex(scene, color) {
  return ensureTex(scene, `cutin_pnl_${css(color).slice(1)}`, 8, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, css(mix(color, 0x000000, 0.82)));
    g.addColorStop(0.28, css(mix(color, 0x000000, 0.5)));
    g.addColorStop(0.5, css(mix(color, 0xffffff, 0.1)));
    g.addColorStop(0.72, css(mix(color, 0x000000, 0.5)));
    g.addColorStop(1, css(mix(color, 0x000000, 0.82)));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

/** 패널 반쪽(위 = 가장자리, 아래 = 가운데) — ④ 에서 갈라질 때만 쓴다. 아래쪽 반은 flipY */
function panelHalfTex(scene, color) {
  return ensureTex(scene, `cutin_pnh_${css(color).slice(1)}`, 8, 128, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, css(mix(color, 0x000000, 0.82)));
    g.addColorStop(0.56, css(mix(color, 0x000000, 0.5)));
    g.addColorStop(1, css(mix(color, 0xffffff, 0.1)));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

/** 눈 띠 좌우 페이드(왼쪽 불투명 검정 → 오른쪽 투명) */
function fadeTex(scene) {
  return ensureTex(scene, 'cutin_fade', 128, 4, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(0.35, 'rgba(0,0,0,0.75)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

// ─────────────────────────────────────────────────────────────
// 재생
// ─────────────────────────────────────────────────────────────

/**
 * 컷신을 띄운다. 끝나면 스스로 전부 지운다.
 * @param {Phaser.Scene} scene BattleHud(카메라 스크롤·줌이 없는 화면 고정 씬)
 * @returns {{mode:string, duration:number, fireAt:number, impactAt:number, plan:object, active:boolean, done:Promise<{canceled:boolean}>, cancel:Function}}
 */
export function playCutin(scene, opts = {}) {
  const {
    key = null, color = 0xffd24a, side = 'left', mode = null, onImpact = null, onDone = null,
  } = opts;
  // (검수 수정) 이름·무장기명은 문자열로 고정 — 기본값은 undefined 에만 먹어서, 폴백 meta 가 null 을 실으면 build() 의 name.length 가
  //   TypeError → 컷신이 통째로 빠졌다.
  const name = opts.name == null ? '' : String(opts.name);
  const skillName = opts.skillName == null ? '' : String(opts.skillName);

  // 앞 컷신이 아직 돌고 있으면 바로 걷어낸다(그 컷신의 onImpact·onDone 은 canceled 로 불린다) — 이번 것은 cutinBusyUntil 때문에 짧은 버전이 된다.
  // (검수 수정) 재진입 방어: 그 취소 콜백(또는 씬 shutdown 콜백) 안에서 playCutin 이 또 불리면(onImpact → 피해 연출 → 묵힌 skill → battle:skill → HUD cutin)
  //   안쪽 컷신이 만들어진 뒤 바깥 호출이 scene.__cutin 을 덮어써 둘이 겹쳐 재생됐다. 걷어내는 동안은 표식을 세워 두고,
  //   그 사이 들어온 호출은 아무것도 안 띄운 채 곧바로 canceled 로 끝낸다(onImpact·onDone 은 정확히 한 번씩 — 계약 그대로).
  const nested = scene.__cutinCanceling === true;
  if (!nested && scene.__cutin && scene.__cutin.active) {
    scene.__cutinCanceling = true;
    try { scene.__cutin.cancel(); } finally { scene.__cutinCanceling = false; }
  }

  const startAt = scene.time.now;
  const plan = cutinPlan(scene, { key, mode: nested ? 'off' : mode, now: startAt });   // nested → 길이 0(handle.duration·impactAt 도 0 — 기다릴 것이 없다)
  const T = plan;

  let resolveDone = null;
  let impacted = false;
  let finished = false;
  const objs = [];
  const masks = [];
  let tick = null;
  let onShutdown = null;

  const handle = {
    mode: plan.mode, duration: plan.total, fireAt: plan.fire, impactAt: plan.impact, plan,
    active: plan.total > 0,
    done: new Promise((r) => { resolveDone = r; }),
    cancel: () => finish(true),
  };

  const call = (fn, info) => { if (typeof fn === 'function') { try { fn(info); } catch (e) { console.warn('[cutin] 콜백 오류', e); } } };

  function finish(canceled) {
    if (finished) return;
    finished = true;
    handle.active = false;
    if (tick) scene.events.off('update', tick);
    if (onShutdown) scene.events.off('shutdown', onShutdown);
    for (const o of objs) { try { if (o.mask && typeof o.clearMask === 'function') o.clearMask(); o.destroy(); } catch (e) { /* 씬이 먼저 지웠다 */ } }
    for (const mk of masks) { try { mk.destroy(); } catch (e) { /* 〃 */ } }
    objs.length = 0;
    masks.length = 0;
    if (scene.__cutin === handle) scene.__cutin = null;
    const info = { canceled: !!canceled };
    if (!impacted) { impacted = true; call(onImpact, info); }   // 걷어내도 피해 연출 신호는 빠뜨리지 않는다
    call(onDone, info);
    resolveDone(info);
  }

  if (plan.total <= 0) {   // 'off' — 아무것도 안 띄운다. nested(앞 컷신을 걷어내는 콜백 안에서 들어온 호출)는 canceled 로 알린다
    finish(nested);
    return handle;
  }

  if (scene.registry) scene.registry.set('cutinBusyUntil', startAt + plan.total);
  scene.__cutin = handle;

  try {
    const render = build();
    render(0);   // 첫 프레임에 알파 1 짜리가 한 번 번쩍이지 않게 바로 첫 상태로
    tick = (time) => {
      if (finished) return;
      const t = (typeof time === 'number' ? time : scene.time.now) - startAt;
      try {
        if (!impacted && t >= T.impact) { impacted = true; call(onImpact, { canceled: false }); }
        if (t >= T.total) { finish(false); return; }
        render(t);
      } catch (e) {
        console.warn('[cutin] 재생 오류 — 컷신을 걷어낸다', e);
        finish(true);
      }
    };
    // HUD 재시작(relayout)·지도 복귀 — 씬이 오브젝트를 지우지만 리스너·마스크는 우리가 뗀다.
    // (검수 수정) 닫히는 씬에 새 컷신이 만들어지지 않게, 이 취소 콜백 안에서 들어온 playCutin 도 nested 로 돌린다
    onShutdown = () => {
      const was = scene.__cutinCanceling;
      scene.__cutinCanceling = true;
      try { finish(true); } finally { scene.__cutinCanceling = was; }
    };
    scene.events.on('update', tick);           // Phaser.Scenes.Events.UPDATE — (time, delta)
    scene.events.once('shutdown', onShutdown);
  } catch (e) {
    console.warn('[cutin] 만들다 실패 — 컷신 없이 넘어간다', e);
    finish(true);
  }
  return handle;

  // ───────────────────────────────────────────────────────────
  // 오브젝트를 만들고, 경과 ms → 화면 상태를 그리는 함수를 돌려준다
  // ───────────────────────────────────────────────────────────
  function build() {
    const W = scene.scale.width, H = scene.scale.height;
    const ADD = Phaser.BlendModes.ADD;
    const has = (k) => scene.textures.exists(k);
    const rend = scene.sys && scene.sys.game && scene.sys.game.renderer;
    const canvasMode = !!(rend && rend.type === Phaser.CANVAS);   // Canvas: tint·tintFill 이 안 먹고 큰 그림 ADD 가 느리다 → 림·가산 복사본 생략
    const short = T.mode === 'short';
    const artKey = T.hasArt ? `cutin_${T.key}` : null;
    const eyeKey = T.eye > 0 ? `cutin_${T.key}_eyes` : null;
    const tune = { ...ART_DEFAULT, ...(CUTIN_ART[T.key] || {}) };
    const panelColor = tune.color != null ? tune.color : (SIDE_PANEL[side] || SIDE_PANEL.left);
    const lightColor = mix(panelColor, 0xffffff, 0.55);
    const gold = 0xffd24a;

    /** 화면 고정 + 목록에 넣기 */
    const keep = (o, depth) => { o.setScrollFactor(0).setDepth(D0 + depth); objs.push(o); return o; };

    // 주 일러스트 크기를 먼저 잰다(배치에 필요) — 그림이 없으면 계약 크기
    let texW = 832, texH = 1216;
    let art = null, rim = null, glow = null;
    if (artKey) {
      art = keep(scene.add.image(-9999, 0, artKey), 3.1);
      if (art.width > 0 && art.height > 0) { texW = art.width; texH = art.height; }
    }
    const Lo = cutinLayout(W, H, { side, texW, texH, tune, hasArt: !!artKey });
    const { m, tiltDeg, cx, cy, nX, nY, dirX, dirY, bandH, L } = Lo;

    // ── 암전 ──
    const veil = keep(scene.add.rectangle(W / 2, H / 2, W + 8, H + 8, 0x000000, 1), 0).setAlpha(0);

    // ── ① 눈 띠 ──
    let eyeBack = null, eyeImg = null, eyeFadeL = null, eyeFadeR = null, eyeTop = null, eyeBot = null;
    let eyeScale = 1, eyeTexW = 1024, eyeTexH = 256;
    if (eyeKey) {
      eyeBack = keep(scene.add.rectangle(W / 2, H / 2, W + 8, EYE_BAND_H, 0x000000, 1), 1).setAlpha(0);
      eyeImg = keep(scene.add.image(W / 2, H / 2, eyeKey), 1.1).setFlipX(Lo.flip);
      if (eyeImg.width > 0 && eyeImg.height > 0) { eyeTexW = eyeImg.width; eyeTexH = eyeImg.height; }
      eyeScale = EYE_IMG_H / eyeTexH;
      const fk = fadeTex(scene);
      if (fk) {   // 좌우 페이드 — 눈 그림(RGB, 알파 없음)의 양 끝을 검정으로 푼다
        eyeFadeL = keep(scene.add.image(0, H / 2, fk), 1.2).setOrigin(0, 0.5);
        eyeFadeR = keep(scene.add.image(0, H / 2, fk), 1.2).setOrigin(0, 0.5).setFlipX(true);
      }
      eyeTop = keep(scene.add.rectangle(W / 2, H / 2, W + 8, 4, lightColor, 1), 1.3);
      eyeBot = keep(scene.add.rectangle(W / 2, H / 2, W + 8, 4, lightColor, 1), 1.3);
    }

    // ── ② 사선 패널 ──
    //   통짜(panel) 한 장으로 열고 떠 있다가, ④ 에서 반쪽 두 장(halfUp/halfDn)으로 바꿔 갈라진다.
    //   그라데이션 캔버스 텍스처를 못 만들면(헤드리스 등) 단색 사각형.
    const pk = panelTex(scene, panelColor), hk = panelHalfTex(scene, panelColor);
    const flat = mix(panelColor, 0x000000, 0.45);
    const panel = keep(pk ? scene.add.image(cx, cy, pk).setDisplaySize(L, bandH) : scene.add.rectangle(cx, cy, L, bandH, flat, 1), 2).setAngle(tiltDeg);
    const panelSX = panel.scaleX, panelSY = panel.scaleY;   // setDisplaySize 가 정한 배율(사각형이면 1)
    const mkHalf = (up) => {
      const o = hk ? scene.add.image(cx, cy, hk).setDisplaySize(L, bandH / 2).setFlipY(!up) : scene.add.rectangle(cx, cy, L, bandH / 2, flat, 1);
      return keep(o, 2).setOrigin(0.5, up ? 1 : 0).setAngle(tiltDeg).setVisible(false);
    };
    const halfUp = mkHalf(true), halfDn = mkHalf(false);
    const halfSX = halfUp.scaleX, halfSY = halfUp.scaleY;
    // 금테(바깥 굵은 금선 + 안쪽 밝은 가는 선) × 위·아래
    const mkEdge = (h, c, d) => keep(scene.add.rectangle(cx, cy, L, h, c, 1), d).setAngle(tiltDeg);
    const edges = [
      { o: mkEdge(7, gold, 4), sign: -1, inset: 0 }, { o: mkEdge(2, 0xfff6cf, 4.1), sign: -1, inset: 8 },
      { o: mkEdge(7, gold, 4), sign: 1, inset: 0 },  { o: mkEdge(2, 0xfff6cf, 4.1), sign: 1, inset: 8 },
    ];

    // 패널 마스크 — Graphics 사각형을 패널과 같은 자리·각도로. GeometryMask 는 WebGL(스텐실)·Canvas(clip) 둘 다 된다.
    //   add.graphics + setVisible(false): 표시 목록에 있어 씬이 shutdown 하면 같이 지워진다(make.graphics 로 만들면 목록 밖이라 샌다).
    //   마스크는 보이기 여부와 상관없이 직접 렌더된다.
    const bandG = keep(scene.add.graphics(), 0).setVisible(false);
    bandG.fillStyle(0xffffff, 1).fillRect(-L / 2, -bandH / 2, L, bandH);
    bandG.setPosition(cx, cy).setAngle(tiltDeg);
    const bandMask = bandG.createGeometryMask();
    masks.push(bandMask);

    // 집중선 — 얼굴에서 뻗어 나가게 얼굴 자리에 중심. 패널 안에만.
    let lines = null, linesK = 1;
    if (has('fx_speedlines')) {
      const far = Math.max(Lo.faceX, W - Lo.faceX) * 1.08;     // 중심에서 먼 쪽 화면 끝까지
      linesK = Math.max((far * 2) / 1024, (H * 1.5) / 512);
      lines = keep(scene.add.image(artKey ? Lo.faceX : cx, artKey ? Lo.faceY : cy, 'fx_speedlines'), 2.2)
        .setBlendMode(ADD).setAlpha(0).setScale(linesK).setMask(bandMask);
    }

    // 무장 색 입자(ADD) — 패널 길이 방향으로 흘러간다. 패널 좌표 안에만 뿌린다.
    // (검수 수정) WebGL 에서는 입자에도 같은 패널 마스크를 건다. Phaser 3.50+ 의 WebGLRenderer 는 「같은 mask 를 가진 연속한 자식」에는
    //   스텐실 preRender/postRender 를 한 번만 한다 — 전엔 마스크 없는 입자(깊이 2.4)가 집중선(2.2)과 림·본체·가산(3~3.2) 사이에 끼어
    //   스텐실 패스가 프레임당 2번이었다(「입자마다 패스가 생긴다」는 옛 주석은 틀렸다). 이제 2.2~3.2 가 한 묶음 = 1번이고,
    //   패널이 열리는 0.14초 동안 입자가 패널 밖으로 삐져나오지도 않는다. Canvas 는 자식마다 clip 을 다시 거니 거기선 안 건다.
    const parts = [];
    const pKey = ['fx_spark', 'spark'].find(has);
    if (pKey) {
      const rnd = lcg(7 + String(T.key).length * 31);
      for (let i = 0; i < PARTICLES; i++) {
        const o = keep(scene.add.image(-9999, 0, pKey), 2.4).setBlendMode(ADD).setAlpha(0).setAngle(tiltDeg);
        if (!canvasMode) o.setMask(bandMask);
        if (!canvasMode) o.setTint(i % 3 === 0 ? 0xffffff : lightColor);
        const px = 12 + rnd() * 30;
        o.setDisplaySize(px * 2.2, px * 0.7);             // 흐르는 방향으로 길쭉하게
        parts.push({ o, u0: (rnd() - 0.5) * L, v: (rnd() - 0.5) * bandH * 0.86, sp: 320 + rnd() * 760, ph: rnd() * 6.28, st: 0.4 + rnd() * 0.6 });
      }
    }

    // 주 일러스트 + 림 라이트(뒤, tintFill 가산, 살짝 어긋나게) + 옅은 가산 복사본(앞)
    if (art) {
      art.setFlipX(Lo.flip).setMask(bandMask);
      if (!canvasMode) {
        rim = keep(scene.add.image(-9999, 0, artKey), 3).setFlipX(Lo.flip).setBlendMode(ADD).setTintFill(lightColor).setAlpha(0).setMask(bandMask);
        glow = keep(scene.add.image(-9999, 0, artKey), 3.2).setFlipX(Lo.flip).setBlendMode(ADD).setAlpha(0).setMask(bandMask);
      }
    }

    // ── ③ 먹물 자국 + 이름 + 무장기명(한 글자씩) ──
    const ts = Lo.textScale;
    const ink = keep(scene.add.graphics(), 5).setPosition(Lo.textX, Lo.textY).setAngle(tiltDeg).setAlpha(0);
    {
      const rnd = lcg(11 + name.length * 13 + skillName.length * 5);
      const iw = 560 * ts, ih = 170 * ts;
      ink.fillStyle(0x0a0705, 0.62).fillEllipse(0, 4, iw, ih);
      ink.fillStyle(0x0a0705, 0.5).fillEllipse(-iw * 0.1, 22 * ts, iw * 0.82, ih * 0.8);
      ink.fillStyle(0x0a0705, 0.5).fillEllipse(iw * 0.16, -20 * ts, iw * 0.7, ih * 0.62);
      for (let i = 0; i < 14; i++) {   // 가장자리 번짐·튄 방울
        const ang = rnd() * Math.PI * 2, rr = 0.42 + rnd() * 0.2;
        const bx = Math.cos(ang) * iw * rr, by = Math.sin(ang) * ih * rr;
        ink.fillStyle(0x0a0705, 0.35 + rnd() * 0.3).fillCircle(bx, by, (6 + rnd() * 22) * ts);
      }
    }
    // (검수 수정) Text 는 setPadding·setShadow·setFill 을 부를 때마다 updateText(캔버스 다시 그리기 + WebGL 텍스처 다시 올리기)를 한다.
    //   전엔 글자마다 4번(생성·패딩·그림자·fill) — 이름 1 + 「청룡참」 3글자면 t=0 프레임에 16번이라 폰에서 첫 프레임이 튈 자리였다.
    //   그림자는 style 로 넘기고(생성 때 한 번에), 무장기명 글자의 패딩은 값만 적어 두었다가 setFill 의 updateText 한 번에 같이 반영한다 → 글자당 2번.
    //   (Phaser 3.90 Text 생성자는 setText 뒤에 setPadding(style.padding) 을 또 부른다 — style.padding 으로 넘기면 글자당 3번이라 값만 적는 쪽을 골랐다.
    //    이름은 뒤따르는 갱신이 없으니 style.padding 그대로: 2번.)
    const nameT = name ? keep(scene.add.text(0, 0, name, {
      fontFamily: FONT_BRUSH, fontSize: `${Math.round(64 * ts)}px`, color: '#ffffff', stroke: '#000000', strokeThickness: 8,
      padding: { left: 14, top: 14, right: 14, bottom: 14 },
      shadow: { offsetX: 3, offsetY: 5, color: 'rgba(0,0,0,0.75)', blur: 8, stroke: true, fill: true },
    }), 6).setOrigin(0.5).setAngle(tiltDeg).setAlpha(0) : null;

    const chars = [];
    const glyphs = Array.from(skillName || '');
    const fs = Math.round(96 * ts);
    const PAD = 18;   // 붓글씨 획·그림자 번짐이 글자 상자 밖으로 나가 잘리지 않게
    glyphs.forEach((ch, i) => {
      const t = keep(scene.add.text(0, 0, ch, {
        fontFamily: FONT_BRUSH, fontSize: `${fs}px`, color: '#ffd24a', stroke: '#2a1408', strokeThickness: 10,
        shadow: { offsetX: 3, offsetY: 6, color: 'rgba(0,0,0,0.8)', blur: 10, stroke: true, fill: true },
      }), 6 + i * 0.01).setOrigin(0.5).setAngle(tiltDeg).setAlpha(0);
      // 금색 그라데이션 — Text 는 늘 캔버스에 그리므로 canvas gradient 를 fill 로 준다(WebGL/Canvas 공통). 못 만들면 단색 금색 그대로.
      const ctx = t.context;
      const canGrad = !!(ctx && typeof ctx.createLinearGradient === 'function' && t.height > 0);
      const pd = t.padding;
      const quiet = canGrad && pd && typeof pd === 'object';   // 패딩을 다시 그리기 없이 적을 수 있나(Phaser.Text.padding = {left,top,right,bottom})
      if (quiet) { pd.left = PAD; pd.top = PAD; pd.right = PAD; pd.bottom = PAD; }
      else t.setPadding(PAD, PAD, PAD, PAD);
      if (canGrad) {
        // (통합·검수) 그라데이션 좌표는 캔버스가 아니라 「글자 상자」 기준이다 — Phaser 3.90 Text.updateText 는 context.translate(padding.left, padding.top)
        //   뒤에 fillText 를 하고, 캔버스 그라데이션은 칠할 때의 변환을 따른다. 전엔 패딩 낀 높이로 잡아 색 띠가 18px 아래로 밀렸다(글자 위 1/8 이 단색 크림, 가장 어두운 끝은 글자 밖)
        const h0 = quiet ? t.height : t.height - PAD * 2;      // 패딩을 뺀 글자 상자 높이(quiet 면 아직 패딩이 반영되기 전)
        const g = ctx.createLinearGradient(0, h0 * 0.12, 0, h0 * 0.92);
        g.addColorStop(0, '#fff8d2');
        g.addColorStop(0.42, '#ffd24a');
        g.addColorStop(0.6, '#e9a520');
        g.addColorStop(1, '#8f5210');
        t.setFill(g);   // 여기서 updateText 한 번 — 패딩·그라데이션이 같이 반영된다
      }
      chars.push({ t, lx: (i - (glyphs.length - 1) / 2) * fs * 0.98, at: T.text + i * T.charGap, stamped: false, i });
    });
    const nameLY = -78 * ts, skillLY = 24 * ts;
    /** 글자 자리(패널 기울기를 따라 돈 좌표) */
    const place = (o, lx, ly) => { o.x = Lo.textX + dirX * lx + nX * ly; o.y = Lo.textY + dirY * lx + nY * ly; };

    // ── ④ 칼금 + 흰 플래시 ──
    const slash = keep(scene.add.rectangle(cx, cy, L, 14, 0xffffff, 1), 7).setAngle(tiltDeg).setBlendMode(ADD).setVisible(false);
    const flash = keep(scene.add.rectangle(W / 2, H / 2, W + 8, H + 8, 0xffffff, 1), 8).setAlpha(0);

    const flashUp = Math.min(50, (T.impact - T.fire) * 0.3);
    const hideAt = T.fire + flashUp;          // 플래시가 가장 하얄 때 그림·글자를 치운다
    let sfxEye = false, sfxSlide = false, sfxFire = false;

    // ─────────────────────────────────────────────────────────
    return function render(t) {
      // 효과음
      if (eyeKey && !sfxEye) { sfxEye = true; sfx('cut_eye'); }
      if (!sfxSlide && t >= T.open) { sfxSlide = true; if (artKey && !short) sfx('open'); else if (!eyeKey) sfx('cut_eye'); }
      if (!sfxFire && t >= T.fire) { sfxFire = true; sfx('cut_flash'); }

      // 암전: 0.6 까지 → 발동부터 0.15 로 → 복귀 동안 0
      const vIn = seg(t, 0, short ? 70 : 120);
      veil.alpha = t < hideAt ? 0.6 * vIn : t < T.impact ? 0.6 - 0.45 * seg(t, hideAt, T.impact) : 0.15 * (1 - seg(t, T.impact, T.total));

      // ① 눈 띠 — 0~120 열림, 패널이 열릴 때 90ms 에 닫힘
      if (eyeKey) {
        const open = outCubic(seg(t, 0, 120)) * (1 - inCubic(seg(t, T.eye - 10, T.eye + 90)));
        const on = open > 0.01;
        const bh = EYE_BAND_H * open;
        eyeBack.visible = on; eyeImg.visible = on; eyeTop.visible = on; eyeBot.visible = on;
        if (eyeFadeL) { eyeFadeL.visible = on; eyeFadeR.visible = on; }
        if (on) {
          const z = eyeScale * (1 + 0.1 * seg(t, 0, T.eye + 90));          // 살짝 줌
          const iw = eyeTexW * z;
          eyeBack.alpha = 0.94;
          eyeBack.scaleY = open;
          eyeImg.setScale(z);
          eyeImg.x = W / 2 - m * 18 * seg(t, 0, T.eye + 90);              // 아주 조금 흐른다
          // 띠 높이만큼만 보이게 crop(텍스처 좌표) — 그림 중심은 화면 가운데
          const ch = Math.min(eyeTexH, bh / z);
          eyeImg.setCrop(0, (eyeTexH - ch) / 2, eyeTexW, ch);
          eyeTop.y = H / 2 - bh / 2; eyeBot.y = H / 2 + bh / 2;
          eyeTop.alpha = open; eyeBot.alpha = open;
          if (eyeFadeL) {
            const fw = iw * 0.24;
            eyeFadeL.setDisplaySize(fw, bh + 2); eyeFadeR.setDisplaySize(fw, bh + 2);
            eyeFadeL.x = eyeImg.x - iw / 2 - 1; eyeFadeR.x = eyeImg.x + iw / 2 - fw + 1;
          }
        }
      }

      // ② 패널 — 가운데 선에서 위아래로 열린다(살짝 넘쳤다 돌아옴). ④ 에서 반쪽 둘로 갈라진다
      const po = t < T.open ? 0 : outBack(seg(t, T.open, T.open + T.openLen));
      const splitAt = T.fire + flashUp * 0.5;
      const sk = seg(t, splitAt, T.impact);
      const splitting = t >= splitAt;
      const off = bandH * 0.45 * outCubic(sk);          // 반쪽이 가운데 선에서 밀려난 거리
      const hs = 1 - inOutQuad(sk);                     // 반쪽 두께 배율
      panel.visible = po > 0 && !splitting;
      if (panel.visible) panel.setScale(panelSX, panelSY * po);
      bandG.scaleY = Math.max(0.0001, po);
      halfUp.visible = splitting && hs > 0.001; halfDn.visible = halfUp.visible;
      if (halfUp.visible) {
        halfUp.setScale(halfSX, halfSY * hs); halfDn.setScale(halfSX, halfSY * hs);
        halfUp.x = cx - nX * off; halfUp.y = cy - nY * off;
        halfDn.x = cx + nX * off; halfDn.y = cy + nY * off;
      }
      const outer = splitting ? off + (bandH / 2) * hs : (bandH / 2) * po;   // 가운데 선 → 패널 바깥 변
      const edgeA = (po > 0 ? Math.min(1, po) : 0) * (1 - seg(t, T.impact - 60, T.impact + 40));
      for (const e of edges) {
        const d = Math.max(0, outer - e.inset) * e.sign;
        e.o.visible = edgeA > 0.01;
        e.o.alpha = edgeA;
        e.o.x = cx + nX * d; e.o.y = cy + nY * d;
      }

      const inPanel = po > 0 && t < hideAt;
      const holdK = seg(t, T.open, T.fire);

      if (lines) {
        lines.visible = inPanel;
        if (inPanel) {
          lines.alpha = 0.5 * Math.min(1, po);
          lines.angle = -5 * m + 11 * m * holdK;
          lines.setScale(linesK * (1 + 0.12 * holdK));
        }
      }

      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        p.o.visible = inPanel;
        if (!inPanel) continue;
        let u = (p.u0 - m * p.sp * (t - T.open) / 1000 + L / 2) % L;
        if (u < 0) u += L;
        u -= L / 2;
        p.o.x = cx + dirX * u + nX * p.v; p.o.y = cy + dirY * u + nY * p.v;
        p.o.alpha = Math.min(1, po) * p.st * (0.55 + 0.45 * Math.sin(t * 0.02 + p.ph));
      }

      // 주 일러스트 — 미끄러져 들어와 감속(outCubic) → 멈춘 뒤에도 천천히 1.00→1.06 줌(얼굴 기준) + 아주 조금 더 밀린다
      if (art) {
        art.visible = inPanel;
        if (rim) { rim.visible = inPanel; glow.visible = inPanel; }
        if (inPanel) {
          const sl = outCubic(seg(t, T.open, T.open + T.slide));
          const z = 1 + 0.06 * seg(t, T.open + T.slide * 0.6, T.fire);
          const drift = m * 16 * seg(t, T.open + T.slide, T.fire);
          const bx = Lo.startX + (Lo.imgX - Lo.startX) * sl - drift;
          const x = Lo.faceX + (bx - Lo.faceX) * z, y = Lo.faceY + (Lo.imgY - Lo.faceY) * z;
          const s = Lo.scale * z;
          art.x = x; art.y = y; art.setScale(s);
          if (rim) {
            rim.x = x + m * 8; rim.y = y - 6; rim.setScale(s);
            rim.alpha = 0.5 * seg(t, T.open + T.slide * 0.55, T.open + T.slide + 120);
            glow.x = x - m * 4; glow.y = y + 2; glow.setScale(s);
            glow.alpha = 0.85 * (1 - seg(t, T.open + T.slide * 0.45, T.open + T.slide + 180))   // 들어올 때 하얗게 떴다
              + 0.13 + 0.05 * Math.sin(t * 0.012)                                               // 가라앉은 뒤에도 숨 쉬듯
              + 0.8 * seg(t, T.fire, hideAt);                                                   // 발동 직전 다시 하얗게
          }
        }
      }

      // ③ 글자
      const textOn = t < hideAt + 30;
      const pop = 1 + 0.16 * seg(t, T.fire, hideAt);
      const textA = 1 - seg(t, T.fire + flashUp * 0.4, hideAt + 30);
      {
        const k = seg(t, T.text - 90, T.text + 110);
        ink.visible = textOn && k > 0;
        if (ink.visible) { ink.setScale(Math.max(0.001, outCubic(k)) * pop, (0.7 + 0.3 * k) * pop); ink.alpha = 0.9 * Math.min(1, k * 2) * textA; }
      }
      if (nameT) {
        const k = seg(t, T.text - 60, T.text + 100);
        nameT.visible = textOn && k > 0;
        if (nameT.visible) { place(nameT, -m * 70 * (1 - outCubic(k)), nameLY); nameT.alpha = k * textA; nameT.setScale(pop); }
      }
      for (const c of chars) {
        const k = seg(t, c.at, c.at + 130);
        c.t.visible = textOn && k > 0;
        if (!c.t.visible) continue;
        if (!c.stamped && t >= c.at + 90) { c.stamped = true; if (c.i < 4) sfx('cut_stamp'); }
        const amp = 7 * (1 - seg(t, c.at + 90, c.at + 340)) * (t >= c.at + 90 ? 1 : 0);   // 찍힌 뒤 0.25초 흔들림
        place(c.t, c.lx + amp * Math.sin(t * 0.09 + c.i * 1.7), skillLY + amp * Math.cos(t * 0.11 + c.i * 2.3));
        c.t.angle = tiltDeg + amp * 0.7 * Math.sin(t * 0.07 + c.i);
        c.t.setScale((1 + 1.4 * (1 - k) * (1 - k) * (1 - k)) * pop);                      // 2.4배에서 내리꽂힌다
        c.t.alpha = Math.min(1, k * 3) * textA;
      }

      // ④ 칼금 + 플래시
      slash.visible = t >= T.fire && t < T.impact;
      if (slash.visible) slash.setScale(outCubic(seg(t, T.fire, T.fire + 70)), Math.max(0.02, 1 - seg(t, T.fire + 70, T.impact)));
      flash.alpha = t < T.fire ? 0 : t < hideAt ? 0.95 * seg(t, T.fire, hideAt) : 0.95 * (1 - seg(t, hideAt, T.impact)) * (1 - seg(t, hideAt, T.impact));
    };
  }
}

export default playCutin;
