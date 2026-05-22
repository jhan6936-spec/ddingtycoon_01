const fs = require('fs')
const path = require('path')
const vm = require('vm')

const ctx = { window: {}, console }
const dir = path.join(__dirname, '..')
const sandbox = vm.createContext(ctx)
vm.runInContext(fs.readFileSync(path.join(dir, 'js/craft-recipe-defaults.js'), 'utf8'), sandbox)
ctx.window.applyFixedCraftRecipe = ctx.window.applyFixedCraftRecipe
ctx.window.getDefaultCraftRecipe = ctx.window.getDefaultCraftRecipe
const ocrCode = fs
  .readFileSync(path.join(dir, 'js/craft-ocr.js'), 'utf8')
  .replace(/\bwindow\./g, 'window.')
vm.runInContext(ocrCode, sandbox)

const expected = [
  ['조개껍데기 브로치', 14776, -32906, 30],
  ['푸른 향수병', 55385, -34315, 37],
  ['자개 손거울', 235913, -21758, 79],
  ['분홍 헤어핀', 40981, -415196, 8],
  ['자개 부채', 265427, 174847, 38],
  ['흑진주 시계', 477579, -257485, 48]
]

const cases = [
  {
    name: 'clean-lines',
    text: [
      '조개껍데기 브로치 14,776 Gold ▼ 32,906 최고가의 30%',
      '푸른 향수병 55,385 Gold ▼ 34,315 최고가의 37%',
      '자개 손거울 235,913 Gold ▼ 21,758 최고가의 79%',
      '분홍 헤어핀 40,981 Gold ▼ 415,196 최고가의 8%',
      '자개 부채 265,427 Gold ▲ 174,847 최고가의 38%',
      '흑진주 시계 477,579 Gold ▼ 257,485 최고가의 48%'
    ].join('\n')
  },
  {
    name: 'no-gold-word',
    text: [
      '조개껍데기 브로치 14776 ▼ 32906 최고가의 30%',
      '푸른 향수병 55385 ▼ 34315 최고가의 37%',
      '자개 손거울 235913 ▼ 21758 최고가의 79%',
      '분홍 헤어핀 40981 ▼ 415196 최고가의 8%',
      '자개 부채 265427 ▲ 174847 최고가의 38%',
      '흑진주 시계 477579 ▼ 257485 최고가의 48%'
    ].join('\n')
  },
  {
    name: 'spaced-numbers',
    text: [
      '조개껍데기 브로치 14, 776 G0ld ▼ 32, 906 최고 가 의 30 %',
      '푸른 향수병 55, 385 ▼ 34, 315 최고가의 37%',
      '자개 손거울 235, 913 ▼ 21, 758 최고가의 79%',
      '분홍 헤어핀 40, 981 ▼ 415, 196 최고가의 8%',
      '자개 부채 265, 427 ▲ 174, 847 최고가의 38%',
      '흑진주 시계 477, 579 ▼ 257, 485 최고가의 48%'
    ].join('\n')
  }
]

let failed = 0
for (const tc of cases) {
  const r = ctx.window.CraftOcr.parseCraftsFromOcrText(tc.text)
  console.log('\n===', tc.name, 'markers', r.markerCount, 'confidence', r.confidenceOk)
  for (const [name, cur, chg, pct] of expected) {
    const c = r.crafts.find((x) => x.name === name)
    const ok =
      c &&
      c.currentPrice === cur &&
      c.priceChange === chg &&
      c.maxPricePercent === pct
    if (!ok) {
      failed++
      console.log(
        'FAIL',
        name,
        'got',
        c?.currentPrice,
        c?.priceChange,
        c?.maxPricePercent,
        'want',
        cur,
        chg,
        pct
      )
    } else {
      console.log('ok', name, cur)
    }
  }
  if (r.validationIssues?.length) console.log('issues', r.validationIssues)
}

if (failed) {
  console.error('\n' + failed + ' assertion(s) failed')
  process.exit(1)
}
console.log('\nAll cases passed')
