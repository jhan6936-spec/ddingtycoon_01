/** 해양 전문가 — wiki.ddingtycoon.kr/ko/articles/해양-전문가-8f880ed1 */
const EXPERT_WIKI_URL = 'https://wiki.ddingtycoon.kr/ko/articles/%ED%95%B4%EC%96%91-%EC%A0%84%EB%AC%B8%EA%B0%80-8f880ed1';

const expertMeta = {
  oceanBasics: {
    key: 'oceanBasics',
    tag: '아일랜드',
    name: '해양학개론',
    maxLevel: 7,
    values: [0, 1, 2, 3, 5, 7, 9, 15],
    unit: 'exp',
    desc: '아일랜드 낚시·수중 어획 경험치 증가',
    levels: [
      { lv: 1, effect: 1, sp: 1, gold: 5000, stone: 2 },
      { lv: 2, effect: 2, sp: 2, gold: 10000, stone: 4 },
      { lv: 3, effect: 3, sp: 5, gold: 25000, stone: 10 },
      { lv: 4, effect: 5, sp: 10, gold: 100000, stone: 20 },
      { lv: 5, effect: 7, sp: 25, gold: 400000, stone: 50 },
      { lv: 6, effect: 9, sp: 30, gold: 2000000, stone: 60 },
      { lv: 7, effect: 15, sp: 50, gold: 5000000, stone: 100 }
    ]
  },
  doubleCatch: {
    key: 'doubleCatch',
    tag: '아일랜드',
    name: '일타쌍피',
    maxLevel: 3,
    values: [0, 1, 3, 10],
    unit: 'percent',
    desc: '낚시 시 두 마리 동시 획득 확률',
    levels: [
      { lv: 1, effect: 1, sp: 1, gold: 5000, stone: 2 },
      { lv: 2, effect: 3, sp: 25, gold: 500000, stone: 50 },
      { lv: 3, effect: 10, sp: 50, gold: 1000000, stone: 100 }
    ]
  },
  deepCollector: {
    key: 'deepCollector',
    tag: '아일랜드',
    name: '심해 채집꾼',
    maxLevel: 5,
    values: [0, 5, 7, 10, 15, 20],
    unit: 'percent',
    desc: '수중 어획 시 어패류 추가 드롭 확률',
    levels: [
      { lv: 1, effect: 5, sp: 1, gold: 10000, stone: 2 },
      { lv: 2, effect: 7, sp: 10, gold: 500000, stone: 20 },
      { lv: 3, effect: 10, sp: 25, gold: 1000000, stone: 50 },
      { lv: 4, effect: 15, sp: 30, gold: 3000000, stone: 60 },
      { lv: 5, effect: 20, sp: 50, gold: 5000000, stone: 100 }
    ]
  },
  moonEpic: {
    key: 'moonEpic',
    tag: '아일랜드',
    name: '달밤의 대어',
    maxLevel: 3,
    values: [0, 10, 12, 15],
    unit: 'percent',
    desc: '밤 낚시 시 에픽 물고기 등장 확률 증가',
    levels: [
      { lv: 1, effect: 10, sp: 1, gold: 5000, stone: 2 },
      { lv: 2, effect: 12, sp: 30, gold: 1000000, stone: 60 },
      { lv: 3, effect: 15, sp: 50, gold: 2000000, stone: 100 }
    ]
  },
  baitScatter: {
    key: 'baitScatter',
    tag: '공용',
    name: '떡밥을 뿌려라!',
    maxLevel: 10,
    values: [0, 5, 10, 15, 20, 25, 30, 40, 50, 60, 70],
    unit: 'percentReduce',
    approachSec: [null, 2, 1.8, 1.6, 1.4, 1.2, 1, 0.8, 0.6, 0.4, 0.2],
    desc: '30초간 입질 시간 감소·접근 시간 단축 (쉬프트 우클릭)',
    levels: [
      { lv: 1, effect: 5, approach: 2, sp: 1, gold: 5000, stone: 2 },
      { lv: 2, effect: 10, approach: 1.8, sp: 3, gold: 10000, stone: 6 },
      { lv: 3, effect: 15, approach: 1.6, sp: 5, gold: 20000, stone: 10 },
      { lv: 4, effect: 20, approach: 1.4, sp: 7, gold: 50000, stone: 14 },
      { lv: 5, effect: 25, approach: 1.2, sp: 10, gold: 100000, stone: 20 },
      { lv: 6, effect: 30, approach: 1, sp: 25, gold: 300000, stone: 50 },
      { lv: 7, effect: 40, approach: 0.8, sp: 40, gold: 500000, stone: 80 },
      { lv: 8, effect: 50, approach: 0.6, sp: 80, gold: 1000000, stone: 160 },
      { lv: 9, effect: 60, approach: 0.4, sp: 100, gold: 3000000, stone: 200 },
      { lv: 10, effect: 70, approach: 0.2, sp: 150, gold: 7000000, stone: 300 }
    ]
  },
  craftPrice: {
    key: 'craftPrice',
    tag: '아일랜드',
    name: '조개 좀 사조개',
    maxLevel: 8,
    values: [0, 5, 7, 10, 15, 20, 30, 40, 50],
    unit: 'percentBoost',
    desc: '공예품 판매가 증가',
    levels: [
      { lv: 1, effect: 5, sp: 1, gold: 5000, stone: 2 },
      { lv: 2, effect: 7, sp: 3, gold: 15000, stone: 6 },
      { lv: 3, effect: 10, sp: 5, gold: 200000, stone: 10 },
      { lv: 4, effect: 15, sp: 30, gold: 1000000, stone: 60 },
      { lv: 5, effect: 20, sp: 60, gold: 5000000, stone: 120 },
      { lv: 6, effect: 30, sp: 80, gold: 7000000, stone: 160 },
      { lv: 7, effect: 40, sp: 100, gold: 10000000, stone: 200 },
      { lv: 8, effect: 50, sp: 130, gold: 15000000, stone: 260 }
    ]
  },
  alchemyPrice: {
    key: 'alchemyPrice',
    tag: '아일랜드',
    name: '프리미엄 한정가',
    maxLevel: 8,
    values: [0, 5, 7, 9, 12, 15, 20, 25, 30],
    unit: 'percentBoost',
    desc: '연금품 판매가 증가 (상점·무역)',
    levels: [
      { lv: 1, effect: 5, sp: 1, gold: 5000, stone: 2 },
      { lv: 2, effect: 7, sp: 3, gold: 15000, stone: 6 },
      { lv: 3, effect: 9, sp: 5, gold: 200000, stone: 10 },
      { lv: 4, effect: 12, sp: 30, gold: 1000000, stone: 60 },
      { lv: 5, effect: 15, sp: 60, gold: 5000000, stone: 120 },
      { lv: 6, effect: 20, sp: 80, gold: 7000000, stone: 160 },
      { lv: 7, effect: 25, sp: 100, gold: 10000000, stone: 200 },
      { lv: 8, effect: 30, sp: 130, gold: 15000000, stone: 260 }
    ]
  },
  fishPrice: {
    key: 'fishPrice',
    tag: '아일랜드',
    name: '치솟는 생선값',
    maxLevel: 5,
    values: [0, 2, 5, 7, 10, 20],
    unit: 'percentBoost',
    desc: '물고기 판매가 증가',
    levels: [
      { lv: 1, effect: 2, sp: 1, gold: 5000, stone: 2 },
      { lv: 2, effect: 5, sp: 3, gold: 15000, stone: 6 },
      { lv: 3, effect: 7, sp: 10, gold: 50000, stone: 20 },
      { lv: 4, effect: 10, sp: 20, gold: 500000, stone: 40 },
      { lv: 5, effect: 20, sp: 30, gold: 1000000, stone: 60 }
    ]
  },
  tropicalFish: {
    key: 'tropicalFish',
    tag: '공용',
    name: '열대어를 찾아서',
    maxLevel: 3,
    values: [0, 3, 3.2, 3.5],
    unit: 'percentPoint',
    desc: '야생·마을 낚시 시 열대어 확률 증가',
    levels: [
      { lv: 1, effect: 3, sp: 1, gold: 100000, stone: 2 },
      { lv: 2, effect: 3.2, sp: 5, gold: 500000, stone: 10 },
      { lv: 3, effect: 3.5, sp: 25, gold: 1000000, stone: 50 }
    ]
  },
  timeReduce: {
    key: 'timeReduce',
    tag: '아일랜드',
    name: '물 흐르듯 술술',
    maxLevel: 5,
    values: [0, 10, 20, 30, 50, 70],
    unit: 'percentReduce',
    desc: '해양 제작·연금 제작 시간 감소',
    levels: [
      { lv: 1, effect: 10, sp: 10, gold: 5000, stone: 20 },
      { lv: 2, effect: 20, sp: 30, gold: 1000000, stone: 60 },
      { lv: 3, effect: 30, sp: 50, gold: 3000000, stone: 100 },
      { lv: 4, effect: 50, sp: 70, gold: 5000000, stone: 140 },
      { lv: 5, effect: 70, sp: 100, gold: 7000000, stone: 200 }
    ]
  },
  starshell: {
    key: 'starshell',
    tag: '아일랜드',
    name: '별별별!',
    maxLevel: 6,
    values: [0, 1, 3, 5, 7, 10, 15],
    unit: 'percent',
    desc: '수중 어획 시 3성 어패류 등장 확률 증가',
    levels: [
      { lv: 1, effect: 1, sp: 10, gold: 5000, stone: 20 },
      { lv: 2, effect: 3, sp: 30, gold: 1000000, stone: 60 },
      { lv: 3, effect: 5, sp: 50, gold: 3000000, stone: 100 },
      { lv: 4, effect: 7, sp: 70, gold: 5000000, stone: 140 },
      { lv: 5, effect: 10, sp: 100, gold: 7000000, stone: 200 },
      { lv: 6, effect: 15, sp: 150, gold: 10000000, stone: 300 }
    ]
  },
  keyHook: {
    key: 'keyHook',
    tag: '아일랜드',
    name: '낚싯줄에 걸린 비밀',
    maxLevel: 8,
    values: [0, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6],
    unit: 'percentPoint',
    desc: '아일랜드 낚시 시 열쇠 조각 획득 확률 증가',
    levels: [
      { lv: 1, effect: 2.5, sp: 1, gold: 5000, stone: 2 },
      { lv: 2, effect: 3, sp: 3, gold: 200000, stone: 6 },
      { lv: 3, effect: 3.5, sp: 10, gold: 300000, stone: 20 },
      { lv: 4, effect: 4, sp: 25, gold: 500000, stone: 50 },
      { lv: 5, effect: 4.5, sp: 40, gold: 1000000, stone: 80 },
      { lv: 6, effect: 5, sp: 70, gold: 3000000, stone: 140 },
      { lv: 7, effect: 5.5, sp: 100, gold: 5000000, stone: 200 },
      { lv: 8, effect: 6, sp: 150, gold: 7000000, stone: 300 }
    ]
  },
  stormFisher: {
    key: 'stormFisher',
    tag: '아일랜드',
    name: '폭풍의 낚시꾼',
    maxLevel: 5,
    values: [0, 0.7, 0.9, 1.2, 1.5, 2],
    unit: 'percentPoint',
    desc: '비 오는 날 신화 물고기 등장 확률 증가',
    levels: [
      { lv: 1, effect: 0.7, sp: 1, gold: 5000, stone: 2 },
      { lv: 2, effect: 0.9, sp: 7, gold: 15000, stone: 14 },
      { lv: 3, effect: 1.2, sp: 10, gold: 100000, stone: 20 },
      { lv: 4, effect: 1.5, sp: 30, gold: 700000, stone: 60 },
      { lv: 5, effect: 2, sp: 50, gold: 1000000, stone: 100 }
    ]
  },
  shellRefill: {
    key: 'shellRefill',
    tag: '아일랜드',
    name: '조개 무한리필',
    maxLevel: 10,
    values: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    unit: 'percent',
    desc: '수중 어획 시 조개 등장 확률 증가',
    levels: [
      { lv: 1, effect: 1, sp: 1, gold: 10000, stone: 2 },
      { lv: 2, effect: 2, sp: 3, gold: 30000, stone: 6 },
      { lv: 3, effect: 3, sp: 7, gold: 50000, stone: 14 },
      { lv: 4, effect: 4, sp: 10, gold: 300000, stone: 20 },
      { lv: 5, effect: 5, sp: 20, gold: 700000, stone: 40 },
      { lv: 6, effect: 6, sp: 35, gold: 1000000, stone: 70 },
      { lv: 7, effect: 7, sp: 70, gold: 3000000, stone: 140 },
      { lv: 8, effect: 8, sp: 100, gold: 5000000, stone: 200 },
      { lv: 9, effect: 9, sp: 120, gold: 7000000, stone: 240 },
      { lv: 10, effect: 10, sp: 150, gold: 15000000, stone: 300 }
    ]
  },
  craftSlots: {
    key: 'craftSlots',
    tag: '아일랜드',
    name: '바다처럼 넓은',
    maxLevel: 5,
    values: [0, 5, 6, 7, 8, 9],
    unit: 'slots',
    desc: '해양 제작 시설 대기 슬롯',
    levels: [
      { lv: 1, effect: 5, sp: 10, gold: 10000, stone: 20 },
      { lv: 2, effect: 6, sp: 30, gold: 500000, stone: 60 },
      { lv: 3, effect: 7, sp: 50, gold: 1000000, stone: 100 },
      { lv: 4, effect: 8, sp: 70, gold: 3000000, stone: 140 },
      { lv: 5, effect: 9, sp: 100, gold: 5000000, stone: 200 }
    ]
  },
  oceanOrder: {
    key: 'oceanOrder',
    tag: '공용',
    name: '오션오더 더 더!',
    maxLevel: 5,
    values: [0, 12, 14, 16, 18, 20],
    unit: 'count',
    desc: '오션오더 일일 수령 한도 (마을 포함)',
    levels: [
      { lv: 1, effect: 12, sp: 1, gold: 10000, stone: 2 },
      { lv: 2, effect: 14, sp: 30, gold: 1000000, stone: 60 },
      { lv: 3, effect: 16, sp: 50, gold: 2000000, stone: 100 },
      { lv: 4, effect: 18, sp: 70, gold: 3000000, stone: 140 },
      { lv: 5, effect: 20, sp: 100, gold: 5000000, stone: 200 }
    ]
  },
  treasureHunter: {
    key: 'treasureHunter',
    tag: '아일랜드',
    name: '보물 사냥꾼',
    maxLevel: 8,
    values: [0, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6],
    unit: 'percentPoint',
    desc: '녹슨 상자 낚시 확률 증가',
    levels: [
      { lv: 1, effect: 2.5, sp: 1, gold: 5000, stone: 2 },
      { lv: 2, effect: 3, sp: 3, gold: 200000, stone: 6 },
      { lv: 3, effect: 3.5, sp: 10, gold: 300000, stone: 20 },
      { lv: 4, effect: 4, sp: 25, gold: 500000, stone: 50 },
      { lv: 5, effect: 4.5, sp: 40, gold: 1000000, stone: 80 },
      { lv: 6, effect: 5, sp: 70, gold: 3000000, stone: 140 },
      { lv: 7, effect: 5.5, sp: 100, gold: 5000000, stone: 200 },
      { lv: 8, effect: 6, sp: 150, gold: 7000000, stone: 300 }
    ]
  },
  alchemySlots: {
    key: 'alchemySlots',
    tag: '아일랜드',
    name: '증류실 확장 공사',
    maxLevel: 5,
    values: [0, 5, 6, 7, 8, 9],
    unit: 'slots',
    desc: '연금 제작 시설 대기 슬롯',
    levels: [
      { lv: 1, effect: 5, sp: 10, gold: 10000, stone: 20 },
      { lv: 2, effect: 6, sp: 30, gold: 500000, stone: 60 },
      { lv: 3, effect: 7, sp: 50, gold: 1000000, stone: 100 },
      { lv: 4, effect: 8, sp: 70, gold: 3000000, stone: 140 },
      { lv: 5, effect: 9, sp: 100, gold: 5000000, stone: 200 }
    ]
  },
  precisionAlchemySlots: {
    key: 'precisionAlchemySlots',
    tag: '아일랜드',
    name: '연금은 계속된다',
    maxLevel: 5,
    values: [0, 5, 6, 7, 8, 9],
    unit: 'slots',
    desc: '정밀 연금 제작 시설 대기 슬롯',
    levels: [
      { lv: 1, effect: 5, sp: 15, gold: 10000, stone: 30 },
      { lv: 2, effect: 6, sp: 35, gold: 700000, stone: 70 },
      { lv: 3, effect: 7, sp: 50, gold: 1500000, stone: 100 },
      { lv: 4, effect: 8, sp: 70, gold: 20000000, stone: 140 },
      { lv: 5, effect: 9, sp: 120, gold: 3000000, stone: 240 }
    ]
  }
};

function createDefaultExpertState() {
  const state = {};
  Object.keys(expertMeta).forEach((key) => {
    state[key] = 0;
  });
  return state;
}

function formatExpertEffectLabel(meta, level) {
  const value = meta.values[level] ?? 0;
  if (meta.unit === 'percentReduce') return `${value}% 감소`;
  if (meta.unit === 'percentBoost') return `${value}% 증가`;
  if (meta.unit === 'percent') return `${value}%`;
  if (meta.unit === 'percentPoint') return `${value}%p`;
  if (meta.unit === 'exp') return `EXP +${value}%`;
  if (meta.unit === 'slots') return `${value}칸`;
  if (meta.unit === 'count') return `${value}회/일`;
  return String(value);
}

function formatWikiLevelEffect(meta, row) {
  if (meta.unit === 'slots') return `${row.effect}칸`;
  if (meta.unit === 'count') return `${row.effect}회/일`;
  if (meta.unit === 'exp') return `EXP +${row.effect}%`;
  if (meta.unit === 'percentReduce') return `-${row.effect}%`;
  if (meta.unit === 'percentBoost') return `+${row.effect}%`;
  return `${row.effect}%`;
}

function renderExpertWikiLevels(meta) {
  if (!meta.levels || !meta.levels.length) return '';
  const rows = meta.levels.map((row) => {
    const extra = row.approach != null ? ` · 접근 ${row.approach}초` : '';
    return `<tr><td>Lv.${row.lv}</td><td>${formatWikiLevelEffect(meta, row)}${extra}</td><td>${row.sp}pt</td><td>${row.gold.toLocaleString()}G</td><td>스톤 ${row.stone}</td></tr>`;
  }).join('');
  return `<details class="expert-wiki-details"><summary>위키 레벨·비용</summary><table class="expert-wiki-table"><thead><tr><th>LV</th><th>효과</th><th>포인트</th><th>골드</th><th>스톤</th></tr></thead><tbody>${rows}</tbody></table></details>`;
}
