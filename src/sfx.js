// 효과음 — 외부 파일 없이 WebAudio 로 합성한다 (SPEC §5.4).
//   tap   : 성 탭 「톡」
//   click : 커맨드 버튼 「딱」
//   open  : 패널 열림 「스윽」(위로 쓸리는 소리)
//   close : 패널 닫힘 (아래로 쓸리는 소리)
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
      default:
        tone(c, { f0: 700, f1: 500, dur: 0.05, gain: 0.15 });
    }
  } catch (e) {
    // 오디오 오류는 화면에 영향 주지 않게 삼킨다
  }
}

export default { unlock, play };
