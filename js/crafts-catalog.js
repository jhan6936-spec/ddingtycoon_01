/**
 * 공예품: 페이지 로드 시 Supabase craft_items 테이블에서 직접 조회 (실시간 반영)
 */
const CRAFTS_BROADCAST_CHANNEL = 'ddingtahe-crafts-updated'

const refreshCraftPriceCharts = () => {
  try {
    if (window.CraftPriceCharts) window.CraftPriceCharts.refresh()
  } catch (_) {}
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
    if (item.priceChange != null) recipe.priceChange = Math.floor(Number(item.priceChange) || 0)
    if (typeof window.applyFixedCraftRecipe === 'function') {
      return window.applyFixedCraftRecipe(recipe)
    }
    return recipe
  },

  rowsToCatalog(rows) {
    const crafts = (Array.isArray(rows) ? rows : [])
      .map((row) => {
        if (!row || !row.name) return null
        const craft = {
          name: row.name,
          price: Number(row.price) || 0,
          timeMinutes: Number(row.time_minutes) || 1,
          time: Number(row.time_minutes) || 1,
          inputs: Array.isArray(row.inputs) ? row.inputs : [],
          group: 'craft'
        }
        if (row.current_price != null) craft.currentPrice = Number(row.current_price) || 0
        if (row.max_price != null) craft.maxPrice = Number(row.max_price) || 0
        if (row.price_change != null) craft.priceChange = Number(row.price_change) || 0
        return craft
      })
      .filter(Boolean)

    let updatedAt = null
    for (const row of rows || []) {
      if (row.updated_at && (!updatedAt || row.updated_at > updatedAt)) {
        updatedAt = row.updated_at
      }
    }

    return {
      version: 1,
      updatedAt: updatedAt || new Date().toISOString(),
      source: 'supabase-direct',
      crafts
    }
  },

  async fetchFromSupabaseDirect() {
    const cfg = window.SUPABASE_CONFIG
    if (!cfg || !cfg.url || !cfg.anonKey) {
      console.warn('[crafts-catalog] SUPABASE_CONFIG 없음 — /api/crafts 로 폴백')
      return null
    }
    const base = String(cfg.url).replace(/\/$/, '')
    const url =
      base +
      '/rest/v1/craft_items?select=name,price,current_price,max_price,price_change,time_minutes,inputs,sort_order,updated_at&order=sort_order.asc,name.asc'

    const response = await fetch(url, {
      cache: 'no-store',
      headers: {
        apikey: cfg.anonKey,
        Authorization: 'Bearer ' + cfg.anonKey,
        Accept: 'application/json'
      }
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error('Supabase craft_items 조회 실패: ' + response.status + ' ' + text.slice(0, 200))
    }

    const rows = await response.json()
    const catalog = this.rowsToCatalog(rows)
    if (!catalog.crafts.length) {
      throw new Error('craft_items 테이블에 데이터가 없습니다. supabase_craft_items.sql 을 실행하세요.')
    }
    return catalog
  },

  async fetchCatalogViaApi() {
    const response = await fetch('/api/crafts', { cache: 'no-store' })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.message || body.error || 'API crafts 조회 실패')
    }
    const catalog = await response.json()
    if (!catalog || !Array.isArray(catalog.crafts) || !catalog.crafts.length) {
      throw new Error('공예품 카탈로그가 비어 있습니다.')
    }
    catalog.source = catalog.source || 'supabase-api'
    return catalog
  },

  async fetchCatalog() {
    try {
      return await this.fetchFromSupabaseDirect()
    } catch (directErr) {
      console.warn('[crafts-catalog] direct Supabase failed:', directErr)
    }
    try {
      return await this.fetchCatalogViaApi()
    } catch (apiErr) {
      console.warn('[crafts-catalog] API fallback failed:', apiErr)
      throw apiErr
    }
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
      source: catalog.source || 'supabase',
      count: craftRecipes.length
    }
    return true
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
      try {
        const ok = await this.loadIntoData(data)
        if (!ok) return
        const next = this.meta && this.meta.updatedAt ? String(this.meta.updatedAt) : ''
        if (force || (next && next !== prev)) {
          lastKey = next
          if (typeof onUpdated === 'function') onUpdated(this.meta)
        }
      } catch (err) {
        console.warn('[crafts-catalog] refresh failed:', err)
      }
    }
    try {
      const channel = new BroadcastChannel(CRAFTS_BROADCAST_CHANNEL)
      channel.onmessage = () => {
        tick(true)
        refreshCraftPriceCharts()
      }
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
