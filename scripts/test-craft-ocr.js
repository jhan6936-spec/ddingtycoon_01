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

const text = [
  '조개껍데기 브로치 14,776 Gold ▼ 32,906 최고가의 30%',
  '푸른 향수병 55,385 Gold ▼ 34,315 최고가의 37%',
  '자개 손거울 235,913 Gold ▼ 21,758 최고가의 79%',
  '분홍 헤어핀 40,981 Gold ▼ 415,196 최고가의 8%',
  '자개 부채 265,427 Gold ▲ 174,847 최고가의 38%',
  '흑진주 시계 477,579 Gold ▼ 257,485 최고가의 48%'
].join('\n')

const r = ctx.window.CraftOcr.parseCraftsFromOcrText(text, { crafts: [] })
const { CRAFT_MAX_PRICES } = require('../lib/craft-recipe-fixed')
r.crafts.forEach((c) => {
  console.log(c.name, c.currentPrice, c.priceChange, c.maxPricePercent + '%', 'max', c.maxPrice, 'ceiling', CRAFT_MAX_PRICES[c.name])
})
console.log('count', r.crafts.length, 'updated', r.priceUpdatedCount)
