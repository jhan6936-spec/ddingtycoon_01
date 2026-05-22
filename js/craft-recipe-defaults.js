/** 공예품 고정 레시피·제작 판매가 (OCR/DB 오염 시 복구용) */
window.CRAFT_RECIPE_DEFAULTS = {
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

window.getDefaultCraftRecipe = (name) => {
  const d = window.CRAFT_RECIPE_DEFAULTS[name]
  if (!d) return null
  return {
    name,
    price: d.price,
    timeMinutes: d.timeMinutes,
    time: d.timeMinutes,
    inputs: d.inputs.map((i) => ({ ...i })),
    group: 'craft'
  }
}

const sanitizeCraftMarketFields = (out, fixed) => {
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

  if (max > 0 && max < 1000 && current > 5000) max = 0
  if (max > 0 && current > 0 && max < current * 0.5) max = 0

  if (current >= 5000) out.currentPrice = current
  else delete out.currentPrice
  if (max >= (out.currentPrice || 0) * 0.5) out.maxPrice = max
  else delete out.maxPrice
  if (change !== 0) out.priceChange = change
  else delete out.priceChange

  if (out.maxPricePercent && out.currentPrice && !out.maxPrice) {
    out.maxPrice = Math.round(out.currentPrice / (out.maxPricePercent / 100))
  }
  return out
}

window.applyFixedCraftRecipe = (recipe) => {
  if (!recipe || !recipe.name) return recipe
  const fixed = window.getDefaultCraftRecipe(recipe.name)
  if (!fixed) return recipe
  const out = {
    name: fixed.name,
    price: fixed.price,
    inputs: fixed.inputs.map((i) => ({ ...i })),
    time: fixed.timeMinutes,
    timeMinutes: fixed.timeMinutes,
    group: 'craft'
  }
  if (recipe.currentPrice != null && recipe.currentPrice > 0) out.currentPrice = recipe.currentPrice
  if (recipe.maxPrice != null && recipe.maxPrice > 0) out.maxPrice = recipe.maxPrice
  if (recipe.maxPricePercent != null) out.maxPricePercent = recipe.maxPricePercent
  if (recipe.priceChange != null && recipe.priceChange !== 0) out.priceChange = recipe.priceChange
  return sanitizeCraftMarketFields(out, fixed)
}
