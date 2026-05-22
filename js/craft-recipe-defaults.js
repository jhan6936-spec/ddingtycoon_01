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

window.applyFixedCraftRecipe = (recipe) => {
  if (!recipe || !recipe.name) return recipe
  const fixed = window.getDefaultCraftRecipe(recipe.name)
  if (!fixed) return recipe
  return {
    ...recipe,
    price: fixed.price,
    inputs: fixed.inputs,
    time: recipe.time || fixed.timeMinutes,
    timeMinutes: recipe.timeMinutes || fixed.timeMinutes,
    group: 'craft'
  }
}
