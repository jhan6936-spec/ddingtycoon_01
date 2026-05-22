/** 서버용 고정 레시피 (위키 해양 제작 시설 기준) */
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

function sanitizeMarketFields(out, fixed) {
  if (!out) return out

  let current = Math.floor(Number(out.currentPrice) || 0)
  let max = Math.floor(Number(out.maxPrice) || 0)
  let change = Math.floor(Number(out.priceChange) || 0)
  const base = fixed && fixed.price ? fixed.price : 0

  if (max >= 1 && max <= 100 && current > 5000) {
    out.maxPricePercent = max
    max = Math.round(current / (max / 100))
  }

  if (current > 0 && base > 20000 && current < base * 0.45) {
    current = base
  }

  if (change && current && Math.abs(current - Math.abs(change)) < 500 && base > current * 1.15) {
    current = base
  }

  if (max > 0 && max < 1000 && current > 5000) {
    max = 0
  }

  if (max > 0 && current > 0 && max < current * 0.5) {
    max = 0
  }

  if (current >= 5000) out.currentPrice = current
  else delete out.currentPrice

  if (max >= current * 0.5) out.maxPrice = max
  else delete out.maxPrice

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
  if (item.maxPrice != null) {
    const m = Math.floor(Number(item.maxPrice) || 0)
    if (m > 0) out.maxPrice = m
  }
  if (item.maxPricePercent != null) {
    const p = Math.floor(Number(item.maxPricePercent) || 0)
    if (p >= 1 && p <= 100) out.maxPricePercent = p
  }
  if (item.priceChange != null) {
    out.priceChange = Math.floor(Number(item.priceChange) || 0)
  }

  sanitizeMarketFields(out, fixed)

  if (out.maxPricePercent && out.currentPrice && !out.maxPrice) {
    out.maxPrice = Math.round(out.currentPrice / (out.maxPricePercent / 100))
  }

  return out
}

module.exports = { CRAFT_FIXED_RECIPES, applyFixedRecipeToCraft, sanitizeMarketFields }
