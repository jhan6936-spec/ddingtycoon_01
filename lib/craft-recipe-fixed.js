/** 서버용 고정 레시피 (craft-recipe-defaults.js 와 동일, OCR/수동입력으로 변경 불가) */
const CRAFT_FIXED_RECIPES = {
  '조개껍데기 브로치': {
    price: 47682,
    timeMinutes: 1,
    inputs: [
      { name: '깨진 조개껍데기', count: 1 },
      { name: '노란빛 진주', count: 1 },
      { name: '금속 재활용품', count: 1 },
      { name: '거미줄', count: 4 }
    ]
  },
  '푸른 향수병': {
    price: 89700,
    timeMinutes: 1,
    inputs: [
      { name: '깨진 조개껍데기', count: 2 },
      { name: '푸른빛 진주', count: 1 },
      { name: '합성수지 재활용품', count: 1 },
      { name: '플라스틱 재활용품', count: 1 },
      { name: '양동이', count: 8 }
    ]
  },
  '자개 손거울': {
    price: 257671,
    timeMinutes: 1,
    inputs: [
      { name: '깨진 조개껍데기', count: 3 },
      { name: '청록빛 진주', count: 1 },
      { name: '합금 재활용품', count: 2 },
      { name: '플라스틱 재활용품', count: 2 },
      { name: '유리판', count: 16 }
    ]
  },
  '분홍 헤어핀': {
    price: 456177,
    timeMinutes: 1,
    inputs: [
      { name: '깨진 조개껍데기', count: 4 },
      { name: '분홍빛 진주', count: 1 },
      { name: '합성수지 재활용품', count: 3 },
      { name: '섬유 재활용품', count: 3 },
      { name: '대나무', count: 64 },
      { name: '분홍 꽃잎', count: 16 }
    ]
  },
  '자개 부채': {
    price: 90580,
    timeMinutes: 1,
    inputs: [
      { name: '깨진 조개껍데기', count: 5 },
      { name: '보라빛 진주', count: 1 },
      { name: '합금 재활용품', count: 5 },
      { name: '합성수지 재활용품', count: 5 },
      { name: '막대기', count: 64 },
      { name: '자수정 조각', count: 16 }
    ]
  },
  '흑진주 시계': {
    price: 735064,
    timeMinutes: 1,
    inputs: [
      { name: '깨진 조개껍데기', count: 7 },
      { name: '흑진주', count: 1 },
      { name: '금속 재활용품', count: 7 },
      { name: '합금 재활용품', count: 7 },
      { name: '섬유 재활용품', count: 7 },
      { name: '흑요석', count: 16 },
      { name: '시계', count: 8 }
    ]
  }
}

function sanitizeMarketFields(out) {
  if (!out) return out

  let current = Math.floor(Number(out.currentPrice) || 0)
  let max = Math.floor(Number(out.maxPrice) || 0)
  let change = Math.floor(Number(out.priceChange) || 0)
  let pct = Math.floor(Number(out.maxPricePercent) || 0)

  if (pct >= 1 && pct <= 100) {
    out.maxPricePercent = pct
  } else if (max >= 1 && max <= 100 && current > 1000) {
    pct = max
    out.maxPricePercent = pct
    max = Math.round(current / (pct / 100))
  }

  if (current > 1000) out.currentPrice = current
  else delete out.currentPrice

  if (max > 0 && current > 0 && max >= current * 0.8) {
    out.maxPrice = max
  } else if (out.maxPricePercent && current > 1000) {
    out.maxPrice = Math.round(current / (out.maxPricePercent / 100))
  } else {
    delete out.maxPrice
  }

  if (change !== 0) out.priceChange = change
  else delete out.priceChange

  return out
}

function applyFixedRecipeToCraft(item) {
  if (!item || !item.name) return item
  const fixed = CRAFT_FIXED_RECIPES[item.name]
  if (!fixed) return item

  const out = {
    name: item.name,
    price: fixed.price,
    inputs: fixed.inputs.map((i) => ({ ...i })),
    timeMinutes: fixed.timeMinutes,
    time: fixed.timeMinutes,
    group: 'craft'
  }

  if (item.currentPrice != null) {
    const c = Math.floor(Number(item.currentPrice) || 0)
    if (c > 0) out.currentPrice = c
  }
  if (item.priceChange != null) {
    out.priceChange = Math.floor(Number(item.priceChange) || 0)
  }
  if (item.maxPricePercent != null) {
    const p = Math.floor(Number(item.maxPricePercent) || 0)
    if (p >= 1 && p <= 100) out.maxPricePercent = p
  }
  if (item.maxPrice != null) {
    const m = Math.floor(Number(item.maxPrice) || 0)
    if (m > 0) out.maxPrice = m
  }

  return sanitizeMarketFields(out)
}

module.exports = { CRAFT_FIXED_RECIPES, applyFixedRecipeToCraft, sanitizeMarketFields }
