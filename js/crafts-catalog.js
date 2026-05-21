/**
 * 공예품(craft) 레시피를 /api/crafts 또는 data/crafts.json 에서 로드해 data.recipes 에 병합합니다.
 */
const CRAFTS_BROADCAST_CHANNEL = 'ddingtahe-crafts-updated'

const DEFAULT_CRAFTS_CATALOG = {
  version: 1,
  updatedAt: null,
  source: 'embedded',
  crafts: [
    { name: '조개껍데기 브로치', price: 47682, currentPrice: 40624, maxPrice: 50178, timeMinutes: 1, group: 'craft', inputs: [{ name: '깨진 조개껍데기', count: 1 }, { name: '노란빛 진주', count: 1 }, { name: '금속 재활용품', count: 1 }, { name: '거미줄', count: 4 }] },
    { name: '푸른 향수병', price: 89700, currentPrice: 133645, maxPrice: 150163, timeMinutes: 1, group: 'craft', inputs: [{ name: '깨진 조개껍데기', count: 2 }, { name: '푸른빛 진주', count: 1 }, { name: '합성수지 재활용품', count: 1 }, { name: '플라스틱 재활용품', count: 1 }, { name: '양동이', count: 8 }] },
    { name: '자개 손거울', price: 257671, currentPrice: 144554, maxPrice: 301154, timeMinutes: 1, group: 'craft', inputs: [{ name: '깨진 조개껍데기', count: 3 }, { name: '청록빛 진주', count: 1 }, { name: '합금 재활용품', count: 2 }, { name: '플라스틱 재활용품', count: 2 }, { name: '유리판', count: 16 }] },
    { name: '분홍 헤어핀', price: 456177, currentPrice: 94420, maxPrice: 496947, timeMinutes: 1, group: 'craft', inputs: [{ name: '깨진 조개껍데기', count: 4 }, { name: '분홍빛 진주', count: 1 }, { name: '합성수지 재활용품', count: 3 }, { name: '섬유 재활용품', count: 3 }, { name: '대나무', count: 64 }, { name: '분홍 꽃잎', count: 16 }] },
    { name: '자개 부채', price: 90580, currentPrice: 630402, maxPrice: 700447, timeMinutes: 1, group: 'craft', inputs: [{ name: '깨진 조개껍데기', count: 5 }, { name: '보라빛 진주', count: 1 }, { name: '합금 재활용품', count: 5 }, { name: '합성수지 재활용품', count: 5 }, { name: '막대기', count: 64 }, { name: '자수정 조각', count: 16 }] },
    { name: '흑진주 시계', price: 735064, currentPrice: 631626, maxPrice: 1002581, timeMinutes: 1, group: 'craft', inputs: [{ name: '깨진 조개껍데기', count: 7 }, { name: '흑진주', count: 1 }, { name: '금속 재활용품', count: 7 }, { name: '합금 재활용품', count: 7 }, { name: '섬유 재활용품', count: 7 }, { name: '흑요석', count: 16 }, { name: '시계', count: 8 }] }
  ]
}

const CraftsCatalog = {
  loaded: false,
  meta: null,

  mapCraftRecipe(item) {
    const recipe = {
      name: String(item.name || '').trim(),
      inputs: Array.isArray(item.inputs) ? item.inputs : [],
      time: Math.max(1, Number(item.timeMinutes != null ? item.timeMinutes : item.time) || 1),
      price: Math.max(0, Number(item.price) || 0),
      group: 'craft'
    }
    if (item.currentPrice != null) recipe.currentPrice = Math.max(0, Number(item.currentPrice) || 0)
    if (item.maxPrice != null) recipe.maxPrice = Math.max(0, Number(item.maxPrice) || 0)
    return recipe
  },

  mergeIntoRecipes(data, catalog) {
    if (!data || !Array.isArray(data.recipes) || !catalog || !Array.isArray(catalog.crafts)) {
      return false
    }
    const recipes = data.recipes
    const craftRecipes = catalog.crafts.map((c) => this.mapCraftRecipe(c)).filter((c) => c.name)
    if (!craftRecipes.length) return false

    const nonCraft = recipes.filter((r) => !r || r.group !== 'craft')
    const firstCraftIdx = recipes.findIndex((r) => r && r.group === 'craft')
    const alchemyAnchorIdx = recipes.findIndex((r) => r && r.name === '추출된 희석액')

    if (firstCraftIdx >= 0) {
      data.recipes = [
        ...nonCraft.slice(0, firstCraftIdx),
        ...craftRecipes,
        ...nonCraft.slice(firstCraftIdx)
      ]
    } else if (alchemyAnchorIdx >= 0) {
      const head = recipes.slice(0, alchemyAnchorIdx).filter((r) => !r || r.group !== 'craft')
      const tail = recipes.slice(alchemyAnchorIdx)
      data.recipes = head.concat(craftRecipes, tail)
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
        if (catalog && Array.isArray(catalog.crafts) && catalog.crafts.length) return catalog
      } catch (error) {
        console.warn('[crafts-catalog] fetch failed:', url, error)
      }
    }
    return { ...DEFAULT_CRAFTS_CATALOG, source: 'embedded' }
  },

  async loadIntoData(data) {
    const catalog = await this.fetchCatalog()
    return this.mergeIntoRecipes(data, catalog)
  },

  hasCraftRecipes(data) {
    return Array.isArray(data?.recipes) && data.recipes.some((r) => r && r.group === 'craft')
  },

  startAutoRefresh(data, onUpdated) {
    let lastKey = this.meta && this.meta.updatedAt ? String(this.meta.updatedAt) : ''
    const tick = async (force) => {
      const prev = lastKey
      const ok = await this.loadIntoData(data)
      if (!ok) return
      const next = this.meta && this.meta.updatedAt ? String(this.meta.updatedAt) : ''
      if (force || (next && next !== prev)) {
        lastKey = next
        if (typeof onUpdated === 'function') onUpdated(this.meta)
      }
    }
    try {
      const channel = new BroadcastChannel(CRAFTS_BROADCAST_CHANNEL)
      channel.onmessage = () => tick(true)
    } catch (_) {}
    window.addEventListener('focus', () => tick(false))
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) tick(false)
    })
    setInterval(() => {
      if (!document.hidden) tick(false)
    }, 15000)
  }
}

window.CraftsCatalog = CraftsCatalog
