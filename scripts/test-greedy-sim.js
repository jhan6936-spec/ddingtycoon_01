const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const m = html.match(/const data = (\{[\s\S]*?\n\});\s*\n+\/\/ 카테고리 매핑/);
const data = eval('(' + m[1] + ')');

const FINAL_GROUP1 = ['영생의 아쿠티스', '크라켄의 광란체', '리바이던의 깃털'];
const FINAL_GROUP2 = ['해구 파동의 코어', '침묵의 심해 비약', '청해룡의 날개'];
const FINAL_GROUP3 = ['아쿠아 펄스 파편', '나우틸러스의 손', '무저의 척추'];
const SHELLFISH_DOWNGRADE_ONE_STAR = new Set(['굴 ★', '소라 ★', '문어 ★', '미역 ★', '성게 ★']);
const ALL = [...FINAL_GROUP1, ...FINAL_GROUP2, ...FINAL_GROUP3, '추출된 희석액'];

const TEST_INV = {
  '굴 ★': 338, '소라 ★': 330, '문어 ★': 375, '미역 ★': 341, '성게 ★': 341,
  '굴 ★★': 166, '소라 ★★': 155, '문어 ★★': 151, '미역 ★★': 160, '성게 ★★': 155,
  '굴 ★★★': 64, '소라 ★★★': 66, '문어 ★★★': 58, '미역 ★★★': 64, '성게 ★★★': 61,
};

function deductCraftTree(name, count, inv, options) {
  if (!count || count <= 0) return;
  const skip = options.skipShellfishTierConvert === true;
  const recipe = data.materials[name];
  if (recipe && recipe.inputs && recipe.inputs.length) {
    if (skip && SHELLFISH_DOWNGRADE_ONE_STAR.has(name)) {
      inv[name] = (inv[name] || 0) - count;
      return;
    }
    for (const inp of recipe.inputs) deductCraftTree(inp.name, inp.count * count, inv, options);
  } else inv[name] = (inv[name] || 0) - count;
}

function deductFinalRecipe(recipe, inv, options) {
  for (const inp of recipe.inputs || []) deductCraftTree(inp.name, inp.count, inv, options);
}

function calculateMaxCraft(recipe, inventory, memo = {}, options = {}) {
  if (!recipe.inputs || !recipe.inputs.length) return Infinity;
  const skipShell = options.skipShellfishTierConvert === true;
  let maxCount = Infinity;
  for (const input of recipe.inputs) {
    let available = inventory[input.name] || 0;
    if (input.name in data.materials) {
      if (skipShell && SHELLFISH_DOWNGRADE_ONE_STAR.has(input.name)) {
        /* skip */
      } else {
        const materialRecipe = data.materials[input.name];
        const craftableFromRecipe = calculateMaxCraft(materialRecipe, inventory, memo, options);
        available += craftableFromRecipe;
      }
    }
    maxCount = Math.min(maxCount, Math.floor(available / input.count));
  }
  return maxCount === Infinity ? 0 : maxCount;
}

function prepInv(base) {
  const inv = { ...base };
  const isShell = (n) => /^(굴|소라|문어|미역|성게)\s+★+$/.test(n);
  const isAlch = (n) => /(정수|핵|에센스|결정|엘릭서|영약)\s+★/.test(n);
  Object.keys(data.materials).forEach((n) => {
    if (!isShell(n) && !isAlch(n)) inv[n] = 1e15;
  });
  return inv;
}

function greedy(inv, skipShell, includeDiluent) {
  const invCopy = prepInv(inv);
  const opts = { skipShellfishTierConvert: skipShell };
  const counts = {};
  ALL.forEach((n) => { counts[n] = 0; });
  let diluent = 0;
  const names = includeDiluent ? ALL : [...FINAL_GROUP1, ...FINAL_GROUP2, ...FINAL_GROUP3];
  for (let i = 0; i < 200000; i++) {
    const craftable = [];
    for (const name of names) {
      const recipe = data.recipes.find((r) => r.name === name);
      if (!recipe) continue;
      if (calculateMaxCraft(recipe, invCopy, {}, opts) >= 1) craftable.push(recipe);
    }
    if (!craftable.length) break;
    let best = craftable[0];
    let bestP = 0;
    for (const r of craftable) {
      const p = r.price || 0;
      if (p > bestP) { bestP = p; best = r; }
    }
    deductFinalRecipe(best, invCopy, opts);
    if (best.name === '추출된 희석액') diluent++;
    else counts[best.name]++;
  }
  counts['추출된 희석액'] = diluent;
  return counts;
}

function gold(counts) {
  let t = 0;
  Object.entries(counts).forEach(([n, c]) => {
    const r = data.recipes.find((x) => x.name === n);
    if (r && c) t += (r.price || 0) * c;
  });
  return Math.round(t * 1.12);
}

console.log('greedy skip1', gold(greedy({ ...TEST_INV }, true, true)));
console.log('greedy skip0', gold(greedy({ ...TEST_INV }, false, true)));
