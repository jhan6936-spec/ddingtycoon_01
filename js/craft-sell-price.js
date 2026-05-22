/**
 * 공예품 기본/전문가 제작 판매가 — admin 현재 시세(currentPrice) 기준
 */
const getCraftMarketBasePrice = (recipe) => {
  if (!recipe) return 0
  let current = Math.floor(Number(recipe.currentPrice) || 0)
  if (typeof window.repairCraftCurrentPrice === 'function' && recipe.name) {
    current = window.repairCraftCurrentPrice(recipe.name, current)
  }
  return current >= 500 ? current : 0
}

const getCraftMarketBoostedPrice = (recipe, effects) => {
  const base = getCraftMarketBasePrice(recipe)
  if (base < 500) return 0
  const boost = effects && effects.craftPriceBoost ? Number(effects.craftPriceBoost) : 0
  return Math.round(base * (1 + boost / 100))
}

const refreshCraftSellPriceDisplays = (data, effects) => {
  const eff = effects || (typeof getExpertEffects === 'function' ? getExpertEffects() : { craftPriceBoost: 0 })
  const boost = eff.craftPriceBoost || 0
  const order = Array.isArray(window.CRAFT_NAME_ORDER) ? window.CRAFT_NAME_ORDER : []

  order.forEach((name) => {
    const recipe = (data?.recipes || []).find((r) => r && r.name === name && r.group === 'craft')
    if (!recipe) return
    const base = getCraftMarketBasePrice(recipe)
    const boosted = getCraftMarketBoostedPrice(recipe, eff)
    const baseEl = document.querySelector(`[data-craft-base="${CSS.escape(name)}"]`)
    const boostedEl = document.querySelector(`[data-craft-boosted="${CSS.escape(name)}"]`)
    if (baseEl) {
      baseEl.textContent = base >= 500 ? `${base.toLocaleString()}G` : '—'
    }
    if (boostedEl) {
      boostedEl.textContent =
        base >= 500
          ? `${boosted.toLocaleString()}G${boost > 0 ? ` ( +${boost}% )` : ''}`
          : '—'
      boostedEl.style.color = base >= 500 && boost > 0 ? '#8fd5ff' : '#9a9a9a'
    }
  })

  if (typeof updateCraftSalesCalcTotals === 'function') {
    updateCraftSalesCalcTotals()
  }
}

window.CraftSellPrice = {
  getCraftMarketBasePrice,
  getCraftMarketBoostedPrice,
  refreshCraftSellPriceDisplays
}
