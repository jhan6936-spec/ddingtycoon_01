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

/** 게임 내 시세 상한 (최대 도달 가능 가격, 고정) */
window.CRAFT_MAX_PRICES = {
  '조개껍데기 브로치': 50000,
  '푸른 향수병': 150000,
  '자개 손거울': 300000,
  '분홍 헤어핀': 500000,
  '자개 부채': 700000,
  '흑진주 시계': 1000000
}

/** 위키 해양 제작 시설 기준 고정 레시피 */
window.CRAFT_RECIPE_DEFAULTS = {
  '조개껍데기 브로치': {
    price: 47682,
    timeMinutes: 5,
    inputs: [
      { name: '깨진 조개껍데기', count: 1 },
      { name: '노란빛 진주', count: 1 },
      { name: '금속 재활용품', count: 1 },
      { name: '거미줄', count: 4 }
    ]
  },
  '푸른 향수병': {
    price: 89700,
    timeMinutes: 7,
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
    timeMinutes: 7,
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
    timeMinutes: 10,
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
    timeMinutes: 10,
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
    timeMinutes: 15,
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

window.getCraftMaxPrice = (name) => window.CRAFT_MAX_PRICES[name] || 0

/** OCR/DB 오염: 시세+퍼센트가 붙은 숫자 복구 (예: 235913601 → 235913) */
window.repairCraftCurrentPrice = (name, raw) => {
  const ceiling = window.getCraftMaxPrice(name)
  let n = Math.floor(Number(raw) || 0)
  if (!n) return 0
  if (!ceiling) return n

  if (n > ceiling * 1.05) {
    const by1000 = Math.floor(n / 1000)
    if (by1000 >= 1000 && by1000 <= ceiling * 1.05) return by1000

    const by100 = Math.floor(n / 100)
    if (by100 >= 1000 && by100 <= ceiling * 1.05) return by100

    const s = String(n)
    if (s.length >= 7) {
      const head3 = parseInt(s.slice(0, -3), 10)
      if (head3 >= 1000 && head3 <= ceiling * 1.05) return head3
      const head2 = parseInt(s.slice(0, -2), 10)
      if (head2 >= 1000 && head2 <= ceiling * 1.05) return head2
    }
  }

  return Math.min(n, ceiling)
}

window.applyCraftMarketFields = (out) => {
  if (!out || !out.name) return out
  const ceiling = window.getCraftMaxPrice(out.name)
  if (!ceiling) return out

  out.maxPrice = ceiling

  const current = window.repairCraftCurrentPrice(out.name, out.currentPrice)
  if (current >= 500) out.currentPrice = current
  else delete out.currentPrice

  if (out.currentPrice) {
    out.maxPricePercent = Math.min(
      100,
      Math.max(1, Math.round((out.currentPrice / ceiling) * 100))
    )
  } else {
    delete out.maxPricePercent
  }

  if (out.priceChange === null) {
    delete out.priceChange
  } else {
    const change = Math.floor(Number(out.priceChange) || 0)
    if (change !== 0) out.priceChange = change
    else delete out.priceChange
  }

  return out
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
    group: 'craft',
    maxPrice: window.getCraftMaxPrice(name)
  }
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
    group: 'craft',
    currentPrice: recipe.currentPrice,
    priceChange: recipe.priceChange,
    maxPricePercent: recipe.maxPricePercent
  }

  return window.applyCraftMarketFields(out)
}
