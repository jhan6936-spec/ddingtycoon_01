const fs = require('fs');
const solver = require('javascript-lp-solver');
const data = eval('(' + fs.readFileSync('index.html', 'utf8').match(/const data = (\{[\s\S]*?\n\});\s*\n+\/\/ 카테고리/)[1] + ')');

const FINAL1 = ['영생의 아쿠티스', '크라켄의 광란체', '리바이던의 깃털'];
const FINAL2 = ['해구 파동의 코어', '침묵의 심해 비약', '청해룡의 날개'];
const FINAL3 = ['아쿠아 펄스 파편', '나우틸러스의 손', '무저의 척추'];
const SPECIES = ['굴', '소라', '문어', '미역', '성게'];
const PROMOTE2 = new Set(['굴 ★★', '소라 ★★', '문어 ★★', '미역 ★★', '성게 ★★']);
const INV = {
  '굴 ★': 338, '소라 ★': 330, '문어 ★': 375, '미역 ★': 341, '성게 ★': 341,
  '굴 ★★': 166, '소라 ★★': 155, '문어 ★★': 151, '미역 ★★': 160, '성게 ★★': 155,
  '굴 ★★★': 64, '소라 ★★★': 66, '문어 ★★★': 58, '미역 ★★★': 64, '성게 ★★★': 61,
};
const COMP = {
  '영생의 아쿠티스': 46, '크라켄의 광란체': 124, '리바이던의 깃털': 80,
  '해구 파동의 코어': 45, '침묵의 심해 비약': 32, '청해룡의 날개': 38,
  '아쿠아 펄스 파편': 17, '나우틸러스의 손': 15, '무저의 척추': 11, '추출된 희석액': 21,
};
const BOOST = 12;
const UNB = 1e12;

function acc(name, count, accum) {
  if (!count) return;
  const recipe = data.materials[name];
  if (recipe?.inputs?.length) {
    if (PROMOTE2.has(name)) { accum[name] = (accum[name] || 0) + count; return; }
    for (const inp of recipe.inputs) acc(inp.name, inp.count * count, accum);
  } else accum[name] = (accum[name] || 0) + count;
}

function leaf(p) {
  const needs = {};
  const r = data.recipes.find((x) => x.name === p);
  for (const inp of r.inputs) acc(inp.name, inp.count, needs);
  return needs;
}

function gold(counts) {
  let t = 0;
  for (const [n, c] of Object.entries(counts)) {
    const r = data.recipes.find((x) => x.name === n);
    if (r && c) t += Math.round((r.price || 0) * (1 + BOOST / 100)) * c;
  }
  return t;
}

function solve(mode) {
  const products = [...FINAL1, ...FINAL2, ...FINAL3, '추출된 희석액'];
  const needsList = products.map(leaf);
  const km = new Map();
  let seq = 0;
  const mk = (n) => { if (!km.has(n)) km.set(n, 'm' + seq++); return km.get(n); };
  const constraints = {};
  const variables = {};
  const ints = {};
  products.forEach((name, i) => {
    variables['v' + i] = { revenue: Math.round((data.recipes.find((x) => x.name === name).price || 0) * (1 + BOOST / 100)) };
    ints['v' + i] = 1;
  });
  needsList.forEach((needs, pi) => {
    for (const [mat, cnt] of Object.entries(needs)) {
      if (!/^(굴|소라|문어|미역|성게)/.test(mat)) {
        constraints[mk(mat)] = { max: UNB };
        variables['v' + pi][mk(mat)] = (variables['v' + pi][mk(mat)] || 0) + cnt;
      }
    }
  });
  for (const sp of SPECIES) {
    const n1 = `${sp} ★`, n2 = `${sp} ★★`, n3 = `${sp} ★★★`;
    const s1 = INV[n1] || 0, s2 = INV[n2] || 0, s3 = INV[n3] || 0;
    if (mode === 'separate') {
      for (const [n, st] of [[n1, s1], [n2, s2], [n3, s3]]) {
        const c = mk(n);
        constraints[c] = { max: st };
        products.forEach((_, pi) => { if (needsList[pi][n]) variables['v' + pi][c] = needsList[pi][n]; });
      }
    } else if (mode === 'cascade') {
      const c1 = mk('c1:' + sp), c2 = mk('c2:' + sp), c3 = mk('c3:' + sp);
      constraints[c1] = { max: s1 + s2 + s3 };
      constraints[c2] = { max: s2 + s3 };
      constraints[c3] = { max: s3 };
      products.forEach((_, pi) => {
        const nd = needsList[pi];
        if (nd[n1]) variables['v' + pi][c1] = (variables['v' + pi][c1] || 0) + nd[n1];
        if (nd[n2]) variables['v' + pi][c2] = (variables['v' + pi][c2] || 0) + nd[n2];
        if (nd[n3]) variables['v' + pi][c3] = (variables['v' + pi][c3] || 0) + nd[n3];
      });
    } else if (mode === 'promote') {
      const c1 = mk('c1:' + sp), c2 = mk('c2:' + sp), c3 = mk('c3:' + sp);
      constraints[c1] = { max: s1 }; constraints[c2] = { max: s2 }; constraints[c3] = { max: s3 };
      products.forEach((_, pi) => {
        const nd = needsList[pi];
        if (nd[n1]) variables['v' + pi][c1] = (variables['v' + pi][c1] || 0) + nd[n1];
        if (nd[n2]) variables['v' + pi][c2] = (variables['v' + pi][c2] || 0) + nd[n2];
        if (nd[n3]) variables['v' + pi][c3] = (variables['v' + pi][c3] || 0) + nd[n3];
      });
      const up = 'up_' + sp;
      variables[up] = { revenue: 0 };
      variables[up][c1] = 3;
      variables[up][c2] = -1;
      ints[up] = 1;
    } else if (mode === 'cascade+promote') {
      const c1 = mk('c1:' + sp), c2 = mk('c2:' + sp), c3 = mk('c3:' + sp);
      constraints[c1] = { max: s1 + s2 + s3 };
      constraints[c2] = { max: s2 + s3 };
      constraints[c3] = { max: s3 };
      products.forEach((_, pi) => {
        const nd = needsList[pi];
        if (nd[n1]) variables['v' + pi][c1] = (variables['v' + pi][c1] || 0) + nd[n1];
        if (nd[n2]) variables['v' + pi][c2] = (variables['v' + pi][c2] || 0) + nd[n2];
        if (nd[n3]) variables['v' + pi][c3] = (variables['v' + pi][c3] || 0) + nd[n3];
      });
      const up = 'up_' + sp;
      variables[up] = { revenue: 0 };
      variables[up][c1] = 3;
      variables[up][c2] = -1;
      ints[up] = 1;
    }
  }
  const r = solver.Solve({ optimize: 'revenue', opType: 'max', constraints, variables, ints });
  if (!r || r.feasible === false) return null;
  const counts = {};
  products.forEach((n, i) => { counts[n] = Math.floor(r['v' + i] || 0); });
  return { counts, gold: gold(counts) };
}

for (const mode of ['separate', 'promote', 'cascade', 'cascade+promote']) {
  const r = solve(mode);
  console.log(`\n=== ${mode} === ${r ? r.gold.toLocaleString() + 'G' : 'FAIL'}`);
  if (!r) continue;
  for (const [k, n] of Object.entries(r.counts).filter(([, c]) => c > 0)) {
    const c = COMP[k];
    console.log(`  ${k}: ${n}${c != null ? ` (comp ${c})` : ''}`);
  }
}
console.log('\nCompetitor:', gold(COMP).toLocaleString() + 'G');
