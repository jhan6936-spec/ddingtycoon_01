/**
 * 연금 최적화 검증 — 사용자 창고(이미지1) 기준
 */
const fs = require('fs');
const path = require('path');
const solver = require('javascript-lp-solver');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const m = html.match(/const data = (\{[\s\S]*?\n\});\s*\n+\/\/ 카테고리 매핑/);
if (!m) {
  console.error('data parse fail');
  process.exit(1);
}
// eslint-disable-next-line no-eval
const data = eval('(' + m[1] + ')');

const FINAL_GROUP1 = ['영생의 아쿠티스', '크라켄의 광란체', '리바이던의 깃털'];
const FINAL_GROUP2 = ['해구 파동의 코어', '침묵의 심해 비약', '청해룡의 날개'];
const FINAL_GROUP3 = ['아쿠아 펄스 파편', '나우틸러스의 손', '무저의 척추'];
const SHELLFISH_DOWNGRADE_ONE_STAR = new Set(['굴 ★', '소라 ★', '문어 ★', '미역 ★', '성게 ★']);

const TEST_INV = {
  '굴 ★': 338,
  '소라 ★': 330,
  '문어 ★': 375,
  '미역 ★': 341,
  '성게 ★': 341,
  '굴 ★★': 166,
  '소라 ★★': 155,
  '문어 ★★': 151,
  '미역 ★★': 160,
  '성게 ★★': 155,
  '굴 ★★★': 64,
  '소라 ★★★': 66,
  '문어 ★★★': 58,
  '미역 ★★★': 64,
  '성게 ★★★': 61,
};

const COMPETITOR = {
  '영생의 아쿠티스': 46,
  '크라켄의 광란체': 124,
  '리바이던의 깃털': 80,
  '해구 파동의 코어': 45,
  '침묵의 심해 비약': 32,
  '청해룡의 날개': 38,
  '아쿠아 펄스 파편': 17,
  '나우틸러스의 손': 15,
  '무저의 척추': 11,
  '추출된 희석액': 21,
};

function accumulateCraftTree(name, count, accum, options = {}) {
  if (!count || count <= 0) return;
  const skip = options.skipShellfishTierConvert === true;
  const recipe = data.materials[name];
  if (recipe && recipe.inputs && recipe.inputs.length) {
    if (skip && SHELLFISH_DOWNGRADE_ONE_STAR.has(name)) {
      accum[name] = (accum[name] || 0) + count;
      return;
    }
    for (const inp of recipe.inputs) {
      accumulateCraftTree(inp.name, inp.count * count, accum, options);
    }
  } else {
    accum[name] = (accum[name] || 0) + count;
  }
}

function buildLeafNeeds(productName, skipShell) {
  const needs = {};
  const recipe = data.recipes.find((r) => r.name === productName);
  if (!recipe || !recipe.inputs) return needs;
  const opts = { skipShellfishTierConvert: skipShell };
  for (const inp of recipe.inputs) {
    accumulateCraftTree(inp.name, inp.count || 0, needs, opts);
  }
  return needs;
}

function solveILP(inv, skipShell, alchemyBoost = 0) {
  const products = [...FINAL_GROUP1, ...FINAL_GROUP2, ...FINAL_GROUP3, '추출된 희석액'];
  const keyMap = new Map();
  let seq = 0;
  const matKey = (name) => {
    if (!keyMap.has(name)) keyMap.set(name, 'm' + seq++);
    return keyMap.get(name);
  };

  const needsList = products.map((n) => buildLeafNeeds(n, skipShell));
  const allMats = new Set();
  needsList.forEach((nd) => Object.keys(nd).forEach((k) => allMats.add(k)));

  const constraints = {};
  allMats.forEach((mat) => {
    const isShell = /^(굴|소라|문어|미역|성게)(\s+★+)?$/.test(mat);
    const max = isShell
      ? Math.max(0, Number(inv[mat]) || 0)
      : Math.max(0, Number(inv[mat]) || 0, 1e15);
    constraints[matKey(mat)] = { max };
  });

  const variables = {};
  const ints = {};
  products.forEach((name, i) => {
    const vid = 'v' + i;
    const recipe = data.recipes.find((r) => r.name === name);
    const base = recipe ? recipe.price || 0 : 0;
    variables[vid] = { revenue: Math.round(base * (1 + alchemyBoost / 100)) };
    Object.entries(needsList[i]).forEach(([mat, cnt]) => {
      if (cnt > 0) variables[vid][matKey(mat)] = cnt;
    });
    ints[vid] = 1;
  });

  const result = solver.Solve({
    optimize: 'revenue',
    opType: 'max',
    constraints,
    variables,
    ints,
  });
  if (!result || result.feasible === false) return null;

  const counts = {};
  products.forEach((name, i) => {
    counts[name] = Math.max(0, Math.floor(Number(result['v' + i]) || 0));
  });
  return counts;
}

function totalGold(counts, boost = 0) {
  let t = 0;
  Object.entries(counts).forEach(([name, n]) => {
    const r = data.recipes.find((x) => x.name === name);
    if (r && n) t += Math.round((r.price || 0) * (1 + boost / 100)) * n;
  });
  return t;
}

function getVanillaNames() {
  const names = new Set();
  Object.keys(data.materials).forEach((n) => {
    if (/^(굴|소라|문어|미역|성게)\s+★+$/.test(n)) return;
    if (/(희석액|정수|핵|에센스|결정|엘릭서|영약)/.test(n)) return;
    names.add(n);
  });
  Object.keys(TEST_INV).forEach((n) => {
    if (!/★/.test(n)) names.add(n);
  });
  return names;
}

function invWithInfiniteVanilla(base) {
  const inv = { ...base };
  getVanillaNames().forEach((n) => {
    inv[n] = 1e15;
  });
  return inv;
}

console.log('=== Test inventory optimization ===\n');

const cases = [
  { label: 'ILP skip1★ + finite vanilla', inv: { ...TEST_INV }, skip: true },
  { label: 'ILP skip1★ + inf vanilla', inv: invWithInfiniteVanilla(TEST_INV), skip: true },
  { label: 'ILP allow downgrade + inf vanilla', inv: invWithInfiniteVanilla(TEST_INV), skip: false },
  { label: 'ILP allow downgrade + finite vanilla', inv: { ...TEST_INV }, skip: false },
];

for (const c of cases) {
  const counts = solveILP(c.inv, c.skip, 12);
  if (!counts) {
    console.log(c.label, '-> FAIL');
    continue;
  }
  const gold = totalGold(counts, 12);
  console.log(`\n${c.label}: ${gold.toLocaleString()}G (boost 12%)`);
  Object.entries(counts)
    .filter(([, n]) => n > 0)
    .sort((a, b) => a[0].localeCompare(b[0], 'ko'))
    .forEach(([k, n]) => {
      const comp = COMPETITOR[k];
      const mark = comp != null ? ` (comp ${comp})` : '';
      console.log(`  ${k}: ${n}${mark}`);
    });
}

const compGold = totalGold(COMPETITOR, 12);
console.log(`\nCompetitor target (12% boost): ~${compGold.toLocaleString()}G`);
