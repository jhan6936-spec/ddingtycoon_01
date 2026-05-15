const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'index.html');
let s = fs.readFileSync(p, 'utf8');

const start = s.indexOf('  return cols\n    .map((col) => {');
if (start < 0) {
  console.error('start not found');
  process.exit(1);
}
const endMarker = "    .join('');\n}\n\nfunction buildAlchemySummaryStageViewsHTML";
const end = s.indexOf(endMarker, start);
if (end < 0) {
  console.error('end not found');
  process.exit(1);
}

const lines = [
  '  const renderCol = (col) => {',
  "    const sorted = Object.entries(col.obj).sort((a, b) => a[0].localeCompare(b[0], 'ko'));",
  "    if (!sorted.length) return '';",
  '    return `<div class="alchemy-summary-stage-cat-block">',
  '        <motion.div class="alchemy-summary-stage-cat-heading">${col.title}</motion.div>',
];
// Build replacement without typo - use array join
const replacement = [
  '  const renderCol = (col) => {',
  "    const sorted = Object.entries(col.obj).sort((a, b) => a[0].localeCompare(b[0], 'ko'));",
  "    if (!sorted.length) return '';",
  '    return `<div class="alchemy-summary-stage-cat-block">',
  '        <div class="alchemy-summary-stage-cat-heading">${col.title}</motion.div>',
  '        <div class="alchemy-summary-stage-grid">${sorted.map(renderCard).join(\'\')}</motion.div>',
  '      </motion.div>`;',
  '  };',
  '  return partitionAlchemyChainByStarTier(directInputs)',
  '    .map((tier) => {',
  '      const inner = tier.cols.map(renderCol).filter(Boolean).join(\'\');',
  '      if (!inner) return \'\';',
  '      return `<div class="alchemy-star-tier-block">',
  '        <div class="alchemy-star-tier-heading">${tier.title}</motion.div>',
  '        ${inner}',
  '      </motion.div>`;',
  '    })',
  '    .filter(Boolean)',
  "    .join('');",
].join('\n');

// Fix any motion.div typos I introduced
const fixed = replacement
  .split('motion.div')
  .join('div');

s = s.slice(0, start) + fixed + s.slice(end);
fs.writeFileSync(p, s);
console.log('patched');
