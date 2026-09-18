// 목업 세력(가짜 데이터) — SPEC §4.
// 색은 깃발 tint·성 테두리·패널 강조에 쓴다. 실제 게임 로직은 없고 화면에 보여 줄 값만 만든다.

import { CITIES, cityCaps } from './cities.js';

/** @typedef {{id:string,name:string,ruler:string,color:string,cities:number[],governors:string[]}} Faction */

/** @type {Faction[]} */
export const FACTIONS = [
  { id: 'wei',     name: '위',     ruler: '조조',   color: '#3b6fd6', cities: [8, 9, 10, 11, 12, 13, 14, 15, 18],
    governors: ['우금', '조인', '하후돈', '서황', '조조', '악진', '장료', '이전', '조홍'] },
  { id: 'shu',     name: '촉',     ruler: '유비',   color: '#3aa655', cities: [24, 25, 26, 27, 28, 31],
    governors: ['위연', '황충', '유비', '장비', '조운', '관우'] },
  { id: 'wu',      name: '오',     ruler: '손권',   color: '#d9463b', cities: [16, 17, 36, 40, 41, 42, 43],
    governors: ['태사자', '정보', '감녕', '주유', '손권', '노숙', '여몽'] },
  { id: 'yuan',    name: '원소',   ruler: '원소',   color: '#8e5bd6', cities: [2, 3, 4, 5, 6, 7],
    governors: ['안량', '문추', '고간', '저수', '원소', '전풍'] },
  { id: 'ma',      name: '마등',   ruler: '마등',   color: '#d6a23b', cities: [19, 20, 21, 22, 23],
    governors: ['마등', '마대', '방덕', '한수', '마휴'] },
  { id: 'liu',     name: '유표',   ruler: '유표',   color: '#3bb8c4', cities: [32, 33, 34, 35, 37, 38, 39],
    governors: ['문빙', '유표', '채모', '괴월', '한현', '유도', '조범'] },
  { id: 'gongsun', name: '공손찬', ruler: '공손찬', color: '#e0e0e0', cities: [0, 1],
    governors: ['공손속', '공손찬'] },
];

/** 세력 없는 도시(무주) */
export const NEUTRAL = { id: 'none', name: '무주', ruler: '—', color: '#777777', cities: [], governors: [] };

/** 플레이어 세력 id (유비·촉) */
export const PLAYER_ID = 'shu';

/** 현재 날짜 표기 */
export const DATE = { text: '건안 5년 3월', year: 200, month: 3 };

/** 상단 HUD 자원 */
export const RESOURCES = { gold: 4820, food: 61300, troops: 38000, officers: 27 };

/** cityId → Faction (무주면 NEUTRAL) */
const FACTION_OF = (() => {
  const m = new Map();
  for (const f of FACTIONS) for (const id of f.cities) m.set(id, f);
  return m;
})();

export function factionOf(cityId) {
  return FACTION_OF.get(cityId) || NEUTRAL;
}

export function isPlayerCity(cityId) {
  return factionOf(cityId).id === PLAYER_ID;
}

/** '#3b6fd6' / '#777' → 0x3b6fd6 (Phaser tint 용 숫자) */
export function colorNum(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return parseInt(h, 16);
}

/** 0~1 사이 결정적 잡음 — 같은 id 면 항상 같은 값(가짜 수치용) */
function noise(id, salt) {
  const x = Math.sin(id * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** 도시 패널에 보여 줄 가짜 정보 */
export function cityInfo(city) {
  const f = factionOf(city.id);
  const caps = cityCaps(city.size);
  const idx = f.cities.indexOf(city.id);
  const governor = idx >= 0 ? (f.governors[idx] || f.ruler) : '호족';
  const pop = Math.round(caps.pop * (0.42 + 0.4 * noise(city.id, 1)) / 100) * 100;
  const troops = Math.round(caps.troops * (0.25 + 0.45 * noise(city.id, 2)) / 100) * 100;
  const gold = Math.round((300 + city.size * 450) * (0.6 + 0.8 * noise(city.id, 3)) / 10) * 10;
  const food = Math.round((3000 + city.size * 5000) * (0.5 + 0.9 * noise(city.id, 4)) / 100) * 100;
  return { faction: f, governor, pop, troops, gold, food };
}

/** 모든 세력(무주 포함) — 범례 등에 쓴다 */
export const ALL_FACTIONS = [...FACTIONS, NEUTRAL];

/** 폰트 슬라이스 미리 로드용 한글 표본 — 화면에 나올 글자를 다 모아 둔다 */
export const KOREAN_SAMPLE = [
  ...CITIES.map((c) => c.name),
  ...ALL_FACTIONS.map((f) => f.name + f.ruler + f.governors.join('')),
  '호족', DATE.text,
  '내정군사인사계략외교출진', '준비중', '군영전', '세력태수인구병력금군량',
  '닫기지도를탭하면닫힙니다', '창밖을', '명석가마', '유비군', '천하를도모하라',
  // 전투 화면(src/battle — BATTLE.md §4): HUD·결과·컷인·토스트 문구와 기본 무장·무장기 이름
  '전투개시아군적군승리패배무승부남은병력걸린시간무장기회다시지도로돌격대기후퇴',
  '적을물리쳤습니다다음을기약합시다양군이물러났습니다전멸궤멸초과',
  '관우장비하후돈전위청룡참포효맹공쌍극',
  // sim.js REASON 문구(결과 패널 사유)·전투 시작 실패 토스트 — smoke 가 sim.js 도 대조한다(통합)
  '남은병력비율양쪽동시궤멸시간초과전투를시작할수없습니다',
  // 전투 3차(docs/BATTLE_V3.md §1) — HUD 「자동/수동」 버튼·초상 꼬리표 「조종」 ('종' 이 표본에 없었다)
  '자동수동조종',
].join('');
// ※ UIScene/MapScene 에 문구를 더하면 여기에도 그 글자를 넣어라 — tools/smoke.mjs 가 대조한다.

/** 한자 표본 */
export const HANJA_SAMPLE = CITIES.map((c) => c.hanja).join('') + '軍營傳對';   // 對: 전투 인트로 「아군 對 적군」
