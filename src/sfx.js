// 효과음 — 외부 파일 없이 WebAudio 로 합성한다 (SPEC §5.4).
//   tap   : 성 탭 「톡」
//   click : 커맨드 버튼 「딱」
//   open  : 패널 열림 「스윽」(위로 쓸리는 소리)
//   close : 패널 닫힘 (아래로 쓸리는 소리)
//   hit   : 전투 타격 「퍽」 / skill : 무장기 발동 (BATTLE.md §4 — BattleScene 이 쓴다)
//   cut_eye : 컷신 눈 띠 「슥」 / cut_stamp : 붓글씨가 찍히는 「쿵」 / cut_flash : 컷신 발동 「챙—쾅」 (BATTLE_V3.md §3.3 — battle/cutin.js 가 쓴다)
// AudioContext 는 첫 사용자 입력(pointerdown) 뒤에 만들고, suspended 면 resume 한다.

let ctx = null;
let noiseBuf = null;

/** AudioContext 를 얻는다(없으면 만들고, 잠겨 있으면 깨운다). 지원 안 하면 null */
function get() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) {
    try { ctx = new AC(); } catch (e) { return null; }
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

/** 첫 pointerdown 등 사용자 제스처에서 부른다 */
export function unlock() {
  get();
}

/** 1초짜리 백색 잡음 버퍼(한 번만 만든다) */
function noise(c) {
  if (noiseBuf) return noiseBuf;
  const len = c.sampleRate;
  noiseBuf = c.createBuffer(1, len, c.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

/**
 * 짧은 음. 주파수 f0 → f1 로 미끄러지며 gain 은 attack 뒤 지수 감쇠.
 */
function tone(c, { type = 'sine', f0 = 880, f1 = 440, dur = 0.08, gain = 0.2, attack = 0.003, delay = 0 }) {
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f0, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/**
 * 잡음을 밴드패스로 걸러 「스윽」. 필터 중심 주파수를 f0 → f1 로 쓸어 올린다/내린다.
 */
function swoosh(c, { f0 = 300, f1 = 1800, dur = 0.22, gain = 0.12, q = 1.2 }) {
  const t0 = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = noise(c);
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = q;
  bp.frequency.setValueAtTime(f0, t0);
  bp.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + dur * 0.35);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(bp).connect(g).connect(c.destination);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

/** 이름으로 효과음 재생. 오디오가 없거나 아직 잠겨 있으면 조용히 넘어간다 */
export function play(name) {
  const c = get();
  if (!c || c.state !== 'running') return;
  try {
    switch (name) {
      case 'tap':    // 「톡」 — 짧고 둥근 소리
        tone(c, { type: 'sine', f0: 920, f1: 520, dur: 0.07, gain: 0.22 });
        break;
      case 'click':  // 「딱」 — 딱딱한 나무 소리: 짧은 삼각파 + 아주 짧은 잡음
        tone(c, { type: 'triangle', f0: 1500, f1: 700, dur: 0.045, gain: 0.25, attack: 0.001 });
        swoosh(c, { f0: 2500, f1: 1200, dur: 0.04, gain: 0.08, q: 0.8 });
        break;
      case 'open':   // 「스윽」 — 올라가는 쓸림 + 은은한 종 소리
        swoosh(c, { f0: 250, f1: 2200, dur: 0.24, gain: 0.12 });
        tone(c, { type: 'sine', f0: 520, f1: 780, dur: 0.18, gain: 0.08, delay: 0.05 });
        break;
      case 'close':  // 내려가는 쓸림
        swoosh(c, { f0: 1800, f1: 220, dur: 0.2, gain: 0.1 });
        tone(c, { type: 'sine', f0: 640, f1: 360, dur: 0.14, gain: 0.06 });
        break;
      // ── 전투(BATTLE.md §4) — BattleScene 이 부른다. 타격음은 90ms 에 한 번으로 씬이 걸러 준다
      case 'hit':    // 「퍽」 — 짧은 저음 + 잡음 한 조각
        tone(c, { type: 'triangle', f0: 260, f1: 90, dur: 0.07, gain: 0.14, attack: 0.002 });
        swoosh(c, { f0: 900, f1: 300, dur: 0.05, gain: 0.06, q: 0.7 });
        break;
      case 'skill':  // 무장기 — 낮게 깔리는 울림 + 올라가는 쓸림 + 종
        tone(c, { type: 'sawtooth', f0: 110, f1: 55, dur: 0.45, gain: 0.16, attack: 0.01 });
        swoosh(c, { f0: 200, f1: 3000, dur: 0.35, gain: 0.14, q: 1.0 });
        tone(c, { type: 'sine', f0: 880, f1: 1320, dur: 0.3, gain: 0.07, delay: 0.08 });
        break;
      // ── 무장기 컷신(BATTLE_V3.md §3.3) — cutin.js 가 박자에 맞춰 부른다
      case 'cut_eye':    // 「슥」 — 눈 띠가 화면을 가른다: 빠르게 올라가는 얇은 쓸림 + 칼 뽑는 듯한 높은 음
        swoosh(c, { f0: 900, f1: 6000, dur: 0.14, gain: 0.16, q: 2.2 });
        tone(c, { type: 'sine', f0: 2200, f1: 3400, dur: 0.12, gain: 0.05, attack: 0.002 });
        break;
      case 'cut_stamp':  // 「쿵」 — 붓글씨 한 글자가 찍힌다: 낮은 북 + 짧은 잡음 (0.05초 간격으로 두세 번 → 「두둥」)
        tone(c, { type: 'sine', f0: 170, f1: 48, dur: 0.16, gain: 0.3, attack: 0.002 });
        swoosh(c, { f0: 1400, f1: 300, dur: 0.05, gain: 0.1, q: 0.7 });
        break;
      case 'cut_flash':  // 「챙—쾅」 — 발동: 금속성 높은 음 둘(살짝 어긋난 배음) + 내려가는 쓸림 + 낮은 폭음
        tone(c, { type: 'square', f0: 3200, f1: 2400, dur: 0.22, gain: 0.05, attack: 0.001 });
        tone(c, { type: 'sine', f0: 2650, f1: 2500, dur: 0.38, gain: 0.07, attack: 0.001 });
        swoosh(c, { f0: 5000, f1: 300, dur: 0.3, gain: 0.2, q: 0.8 });
        tone(c, { type: 'sine', f0: 120, f1: 36, dur: 0.42, gain: 0.32, attack: 0.004, delay: 0.03 });
        break;
      default:
        tone(c, { f0: 700, f1: 500, dur: 0.05, gain: 0.15 });
    }
  } catch (e) {
    // 오디오 오류는 화면에 영향 주지 않게 삼킨다
  }
}

export default { unlock, play };
