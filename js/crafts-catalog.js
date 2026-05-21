/**
 * 공예품(craft) 레시피를 /api/crafts 또는 data/crafts.json 에서 로드해 data.recipes 에 병합합니다.
 */
const CraftsCatalog = {
  loaded: false,
  meta: null,

  mapCraftRecipe(item) {
    return {
      name: String(item.name || '').trim(),
      inputs: Array.isArray(item.inputs) ? item.inputs : [],
      time: Math.max(1, Number(item.timeMinutes != null ? item.timeMinutes : item.time) || 1),
      price: Math.max(0, Number(item.price) || 0),
      group: 'craft'
    }
  },

  mergeIntoRecipes(data, catalog) {
    if (!data || !Array.isArray(data.recipes) || !catalog || !Array.isArray(catalog.crafts)) {
      return false
    }
    const recipes = data.recipes
    const craftRecipes = catalog.crafts.map((c) => this.mapCraftRecipe(c)).filter((c) => c.name)
    const firstCraftIdx = recipes.findIndex((r) => r && r.group === 'craft')
    const nonCraft = recipes.filter((r) => !r || r.group !== 'craft')
    if (firstCraftIdx >= 0) {
      data.recipes = [
        ...nonCraft.slice(0, firstCraftIdx),
        ...craftRecipes,
        ...nonCraft.slice(firstCraftIdx)
      ]
    } else {
      data.recipes = nonCraft.concat(craftRecipes)
    }
    this.loaded = true
    this.meta = {
      updatedAt: catalog.updatedAt || null,
      source: catalog.source || 'unknown',
      count: craftRecipes.length
    }
    return true
  },

  async fetchCatalog() {
    const endpoints = ['/api/crafts', '/data/crafts.json']
    for (const url of endpoints) {
      try {
        const response = await fetch(url, { cache: 'no-store' })
        if (!response.ok) continue
        const catalog = await response.json()
        if (catalog && Array.isArray(catalog.crafts)) return catalog
      } catch (error) {
        console.warn('[crafts-catalog] fetch failed:', url, error)
      }
    }
    return null
  },

  async loadIntoData(data) {
    const catalog = await this.fetchCatalog()
    if (!catalog) return false
    return this.mergeIntoRecipes(data, catalog)
  },

  startAutoRefresh(data, onUpdated) {
    let lastKey = this.meta && this.meta.updatedAt ? String(this.meta.updatedAt) : ''
    const tick = async () => {
      const prev = lastKey
      const ok = await this.loadIntoData(data)
      if (!ok) return
      const next = this.meta && this.meta.updatedAt ? String(this.meta.updatedAt) : ''
      if (next && next !== prev) {
        lastKey = next
        if (typeof onUpdated === 'function') onUpdated(this.meta)
      }
    }
    window.addEventListener('focus', tick)
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) tick()
    })
    setInterval(() => {
      if (!document.hidden) tick()
    }, 60000)
  }
}

window.CraftsCatalog = CraftsCatalog
