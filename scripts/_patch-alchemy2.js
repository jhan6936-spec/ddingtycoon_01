const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'index.html');
let s = fs.readFileSync(p, 'utf8');

const start = s.indexOf('/** 자세히 보기 등: 연금 단계별 열로 묶어 표시 */');
const end = s.indexOf('\nfunction partitionShellfishByStar(shellObj) {', start);
if (start < 0 || end < 0) {
  console.error('bounds not found', start, end);
  process.exit(1);
}

const fn = `/** 자세히보기: 1·2·3성 연금품 재료 → 정수·핵 등 하위 열 */
function renderAlchemyChainCategoryGroupsHTML(totalsObj, qtyMode) {
  const qm = qtyMode != null ? qtyMode : alchemySummaryQtyMode;
  const hasAny = Object.keys(totalsObj || {}).some((k) => (totalsObj[k] || 0) > 0);
  if (!hasAny) return '<div style="font-size:12px;color:#778899;">해당 없음</motion.div>';
  const tiers = partitionAlchemyChainByStarTier(totalsObj);
  if (!tiers.length) return '<div style="font-size:12px;color:#778899;">해당 없음</motion.div>';
  return tiers
    .map((tier) => {
      const cols = tier.cols.filter((c) => Object.keys(c.obj).length > 0);
      if (!cols.length) return '';
      const n = cols.length;
      const templateCols = n === 1 ? '1fr' : \`repeat(\${Math.min(n, 3)}, minmax(0, 1fr))\`;
      const grid = \`<div class="alchemy-vanilla-grid" style="display:grid;grid-template-columns:\${templateCols};gap:12px;align-items:start;margin-top:8px;">\${cols
        .map(
          (c) => \`
    <div class="alchemy-vanilla-col">
      <div class="alchemy-vanilla-col-title">\${c.title}</div>
      \${formatAlchemyMaterialLinesHTML(c.obj, qm)}
    </div>\`
        )
        .join('')}</div>\`;
      return \`<div class="alchemy-star-tier-block alchemy-star-tier-block--detail">
      <div class="alchemy-star-tier-heading">\${tier.title}</div>
      \${grid}
    </div>\`;
    })
    .filter(Boolean)
    .join('');
}
`;

const fixed = fn.split('motion.div').join('div');
s = s.slice(0, start) + fixed + s.slice(end);
fs.writeFileSync(p, s);
console.log('render fn ok');
