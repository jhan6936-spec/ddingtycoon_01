/**
 * 공예품 기본/전문가 제작 판매가 — 재료 단가 합산 (NPC 시세·직접 입력)
 */
const CRAFT_INGREDIENT_PRICE_STORAGE = 'thingta_craft_ingredient_prices_v1'

window.npcMarketPricesByItem = window.npcMarketPricesByItem || {}
window.craftIngredientPriceOverrides = window.craftIngredientPriceOverrides || {}

const loadCraftIngredientPriceOverrides = () => {
  try {
    const raw = localStorage.getItem(CRAFT_INGREDIENT_PRICE_STORAGE)
    if (!raw) return
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      window.craftIngredientPriceOverrides = parsed
    }
  } catch (_) {}
}

const saveCraftIngredientPriceOverrides = () => {
  try {
    localStorage.setItem(
      CRAFT_INGREDIENT_PRICE_STORAGE,
      JSON.stringify(window.craftIngredientPriceOverrides || {})
    )
  } catch (_) {}
}

const setCraftIngredientPriceOverride = (name, value) => {
  const key = String(name || '').trim()
  if (!key) return
  const n = Math.max(0, Math.round(Number(value) || 0))
  if (!n) {
    delete window.craftIngredientPriceOverrides[key]
  } else {
    window.craftIngredientPriceOverrides[key] = n
  }
  saveCraftIngredientPriceOverrides()
}

const buildNpcPriceLookup = (data) => {
  const map = new Map()
  const recipes = (data && data.recipes) || []

  recipes.forEach((r) => {
    const p = Math.round(Number(r.price) || 0)
    if (r && r.name && p > 0) map.set(r.name, p)
  })

  const market = window.npcMarketPricesByItem || {}
  Object.keys(market).forEach((name) => {
    const p = Math.round(Number(market[name]) || 0)
    if (name && p > 0) map.set(name, p)
  })

  const overrides = window.craftIngredientPriceOverrides || {}
  Object.keys(overrides).forEach((name) => {
    const p = Math.round(Number(overrides[name]) || 0)
    if (name && p > 0) map.set(name, p)
  })

  return map
}

const computeCraftBaseSellPrice = (recipe, lookup) => {
  if (!recipe) return 0
  const fixed =
    typeof window.getDefaultCraftRecipe === 'function'
      ? window.getDefaultCraftRecipe(recipe.name)?.price
      : window.CRAFT_RECIPE_DEFAULTS?.[recipe.name]?.price
  const inputs = recipe.inputs || []
  if (!inputs.length) {
    return Math.round(Number(fixed) || Number(recipe.price) || 0)
  }

  let sum = 0
  let missing = 0
  inputs.forEach((inp) => {
    const unit = lookup.get(inp.name) || 0
    if (!unit) missing += 1
    sum += unit * Math.max(1, Math.floor(Number(inp.count) || 1))
  })

  if (missing === 0 && sum > 0) return sum
  return Math.round(Number(fixed) || Number(recipe.price) || 0)
}

const computeCraftBoostedSellPrice = (recipe, effects, lookup) => {
  const base = computeCraftBaseSellPrice(recipe, lookup)
  const boost = effects && effects.craftPriceBoost ? Number(effects.craftPriceBoost) : 0
  return Math.round(base * (1 + boost / 100))
}

const getCraftIngredientUnitPrice = (ingredientName, lookup) => {
  const fromLookup = lookup.get(ingredientName) || 0
  if (fromLookup > 0) return fromLookup
  const override = window.craftIngredientPriceOverrides?.[ingredientName]
  return Math.round(Number(override) || 0)
}

const refreshCraftSellPriceDisplays = (data, effects) => {
  const lookup = buildNpcPriceLookup(data)
  const eff = effects || (typeof getExpertEffects === 'function' ? getExpertEffects() : { craftPriceBoost: 0 })
  const boost = eff.craftPriceBoost || 0
  const order = Array.isArray(window.CRAFT_NAME_ORDER) ? window.CRAFT_NAME_ORDER : []

  order.forEach((name) => {
    const recipe = (data?.recipes || []).find((r) => r && r.name === name && r.group === 'craft')
    if (!recipe) return
    const base = computeCraftBaseSellPrice(recipe, lookup)
    const boosted = computeCraftBoostedSellPrice(recipe, eff, lookup)
    const baseEl = document.querySelector(`[data-craft-base="${CSS.escape(name)}"]`)
    const boostedEl = document.querySelector(`[data-craft-boosted="${CSS.escape(name)}"]`)
    if (baseEl) baseEl.textContent = `${base.toLocaleString()}G`
    if (boostedEl) {
      boostedEl.textContent = `${boosted.toLocaleString()}G${boost > 0 ? ` ( +${boost}% )` : ''}`
      boostedEl.style.color = boost > 0 ? '#8fd5ff' : '#9a9a9a'
    }
  })

  if (typeof updateCraftSalesCalcTotals === 'function') {
    updateCraftSalesCalcTotals()
  }
}

loadCraftIngredientPriceOverrides()

window.CraftSellPrice = {
  loadCraftIngredientPriceOverrides,
  saveCraftIngredientPriceOverrides,
  setCraftIngredientPriceOverride,
  buildNpcPriceLookup,
  computeCraftBaseSellPrice,
  computeCraftBoostedSellPrice,
  getCraftIngredientUnitPrice,
  refreshCraftSellPriceDisplays
}
