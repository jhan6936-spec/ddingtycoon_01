/** 공예품 6종 (표시·저장 순서 고정) */
window.CRAFT_NAME_ORDER = [
  '조개껍데기 브로치',
  '푸른 향수병',
  '자개 손거울',
  '분홍 헤어핀',
  '자개 부채',
  '흑진주 시계'
]

/** 레시피 잠금: 사용자가 직접 요청하기 전까지 재료·제작가는 아래 값만 사용 */
window.CRAFT_RECIPES_LOCKED = true

/** 위키 해양 제작 시설 기준 고정 레시피 */
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

const sanitizeCraftMarketFields = (out) => {
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

  if (recipe.currentPrice != null && recipe.currentPrice > 0) {
    out.currentPrice = Math.floor(Number(recipe.currentPrice) || 0)
  }
  if (recipe.priceChange != null && recipe.priceChange !== 0) {
    out.priceChange = Math.floor(Number(recipe.priceChange) || 0)
  }
  if (recipe.maxPricePercent != null) {
    const p = Math.floor(Number(recipe.maxPricePercent) || 0)
    if (p >= 1 && p <= 100) out.maxPricePercent = p
  }
  if (recipe.maxPrice != null && recipe.maxPrice > 0) {
    out.maxPrice = Math.floor(Number(recipe.maxPrice) || 0)
  }

  return sanitizeCraftMarketFields(out)
}
