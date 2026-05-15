/**
 * 연금 최적화 검증 — 사용자 창고 기준, 1★→2★ 승급(3:1) 포함 ILP
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
const SHELLFISH_NAMES = ['굴', '소라', '문어', '미역', '성게'];
const SHELLFISH_PROMOTE_TWO_STAR = new Set(['굴 ★★', '소라 ★★', '문어 ★★', '미역 ★★', '성게 ★★']);
const SHELLFISH_PROMOTE_COST = 3;
const ALCHEMY_UNBOUNDED = 1e12;

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

function isShellfishStockName(name) {
  return /^(굴|소라|문어|미역|성게)(\s+★+)?$/.test(String(name || '').trim());
}

function accumulateCraftTree(name, count, accum, options = {}) {
  if (!count || count <= 0) return;
  const skip = options.skipShellfishTierConvert === true;
  const recipe = data.materials[name];
  if (recipe && recipe.inputs && recipe.inputs.length) {
    if (skip && SHELLFISH_PROMOTE_TWO_STAR.has(name)) {
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

function buildLeafNeeds(productName) {
  const needs = {};
  const recipe = data.recipes.find((r) => r.name === productName);
  if (!recipe || !recipe.inputs) return needs;
  for (const inp of recipe.inputs) {
    accumulateCraftTree(inp.name, inp.count || 0, needs, { skipShellfishTierConvert: true });
  }
  return needs;
}

function prepareInv(base) {
  const out = { ...base };
  const products = [...FINAL_GROUP1, ...FINAL_GROUP2, ...FINAL_GROUP3, '추출된 희석액'];
  products.forEach((name) => {
    Object.keys(buildLeafNeeds(name)).forEach((mat) => {
      if (!isShellfishStockName(mat)) out[mat] = ALCHEMY_UNBOUNDED;
    });
  });
  return out;
}

function solveILP(inv, withPromote) {
  const products = [...FINAL_GROUP1, ...FINAL_GROUP2, ...FINAL_GROUP3, '추출된 희석액'];
  const keyMap = new Map();
  let seq = 0;
  const matKey = (name) => {
    if (!keyMap.has(name)) keyMap.set(name, 'm' + seq++);
    return keyMap.get(name);
  };

  const needsList = products.map((n) => buildLeafNeeds(n));
  const constraints = {};
  const variables = {};
  const ints = {};

  const allMats = new Set();
  needsList.forEach((nd) => Object.keys(nd).forEach((k) => allMats.add(k)));

  allMats.forEach((mat) => {
    if (isShellfishStockName(mat)) return;
    constraints[matKey(mat)] = { max: Math.max(Number(inv[mat]) || 0, ALCHEMY_UNBOUNDED) };
  });

  products.forEach((name, i) => {
    const vid = 'v' + i;
    const recipe = data.recipes.find((r) => r.name === name);
    variables[vid] = { revenue: Math.round((recipe?.price || 0) * 1.12) };
    ints[vid] = 1;
  });

  if (withPromote) {
    SHELLFISH_NAMES.forEach((species) => {
      const n1 = `${species} ★`;
      const n2 = `${species} ★★`;
      const n3 = `${species} ★★★`;
      const c1 = matKey(`shell_t1:${species}`);
      const c2 = matKey(`shell_t2:${species}`);
      const c3 = matKey(`shell_t3:${species}`);
      constraints[c1] = { max: Math.max(0, Number(inv[n1]) || 0) };
      constraints[c2] = { max: Math.max(0, Number(inv[n2]) || 0) };
      constraints[c3] = { max: Math.max(0, Number(inv[n3]) || 0) };

      products.forEach((_, i) => {
        const vid = 'v' + i;
        const needs = needsList[i];
        if (needs[n1] > 0) variables[vid][c1] = (variables[vid][c1] || 0) + needs[n1];
        if (needs[n2] > 0) variables[vid][c2] = (variables[vid][c2] || 0) + needs[n2];
        if (needs[n3] > 0) variables[vid][c3] = (variables[vid][c3] || 0) + needs[n3];
      });

      const upId = 'up_' + species;
      variables[upId] = { revenue: 0 };
      variables[upId][c1] = SHELLFISH_PROMOTE_COST;
      variables[upId][c2] = -1;
      ints[upId] = 1;
    });
  } else {
    allMats.forEach((mat) => {
      if (!isShellfishStockName(mat)) return;
      constraints[matKey(mat)] = { max: Math.max(0, Number(inv[mat]) || 0) };
    });
    products.forEach((_, i) => {
      const vid = 'v' + i;
      Object.entries(needsList[i]).forEach(([mat, cnt]) => {
        if (cnt > 0) variables[vid][matKey(mat)] = cnt;
      });
    });
  }

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
  const upgrades = {};
  if (withPromote) {
    SHELLFISH_NAMES.forEach((s) => {
      const u = Math.max(0, Math.floor(Number(result['up_' + s]) || 0));
      if (u > 0) upgrades[s] = u;
    });
  }
  return { counts, upgrades, result };
}

function totalGold(counts) {
  let t = 0;
  Object.entries(counts).forEach(([name, n]) => {
    const r = data.recipes.find((x) => x.name === name);
    if (r && n) t += Math.round((r.price || 0) * 1.12) * n;
  });
  return t;
}

function verifyShellfish(counts, upgrades, inv) {
  const use = {};
  SHELLFISH_NAMES.forEach((s) => {
    use[`${s} ★`] = 0;
    use[`${s} ★★`] = 0;
    use[`${s} ★★★`] = 0;
  });
  const products = [...FINAL_GROUP1, ...FINAL_GROUP2, ...FINAL_GROUP3, '추출된 희석액'];
  products.forEach((name) => {
    const n = counts[name] || 0;
    if (!n) return;
    const needs = buildLeafNeeds(name);
    Object.entries(needs).forEach(([mat, c]) => {
      if (isShellfishStockName(mat)) use[mat] = (use[mat] || 0) + c * n;
    });
  });
  Object.entries(upgrades || {}).forEach(([species, u]) => {
    use[`${species} ★`] = (use[`${species} ★`] || 0) + SHELLFISH_PROMOTE_COST * u;
    use[`${species} ★★`] = (use[`${species} ★★`] || 0) - u;
  });
  let ok = true;
  Object.keys(use).forEach((k) => {
    const need = use[k] || 0;
    const have = inv[k] || 0;
    if (need > have + 0.001) {
      console.log('  VERIFY FAIL', k, 'need', need, 'have', have);
      ok = false;
    }
  });
  return ok;
}

const inv = prepareInv(TEST_INV);

console.log('=== Warehouse optimization ===\n');

const noPromote = solveILP(inv, false);
const withPromote = solveILP(inv, true);

for (const [label, res] of [
  ['ILP no promote (tiers separate)', noPromote],
  ['ILP with 1★→2★ promote 3:1', withPromote],
]) {
  if (!res) {
    console.log(label, '-> FAIL\n');
    continue;
  }
  const gold = totalGold(res.counts);
  console.log(`${label}: ${gold.toLocaleString()}G (boost 12%)`);
  if (res.upgrades && Object.keys(res.upgrades).length) {
    console.log('  upgrades:', res.upgrades);
  }
  Object.entries(res.counts)
    .filter(([, n]) => n > 0)
    .sort((a, b) => a[0].localeCompare(b[0], 'ko'))
    .forEach(([k, n]) => {
      const comp = COMPETITOR[k];
      const mark = comp != null ? ` (comp ${comp})` : '';
      console.log(`  ${k}: ${n}${mark}`);
    });
  console.log('  feasible:', verifyShellfish(res.counts, res.upgrades, TEST_INV));
  console.log('');
}

const compGold = totalGold(COMPETITOR);
console.log(`Competitor target (12% boost): ~${compGold.toLocaleString()}G`);
