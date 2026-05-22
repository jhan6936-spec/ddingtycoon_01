/**
 * 공예품 6종: 위키 레시피 고정 + Supabase/localStorage 에서 시세만 갱신
 */
const CRAFTS_BROADCAST_CHANNEL = 'ddingtahe-crafts-updated'
const CRAFT_CACHE_KEY = 'ddingtahe_craft_catalog_v1'

const refreshCraftPriceCharts = () => {
  try {
    if (window.CraftPriceCharts) window.CraftPriceCharts.refresh()
  } catch (_) {}
}

const getCraftNameOrder = () =>
  window.CRAFT_NAME_ORDER || [
    '조개껍데기 브로치',
    '푸른 향수병',
    '자개 손거울',
    '분홍 헤어핀',
    '자개 부채',
    '흑진주 시계'
  ]

const CraftsCatalog = {
  loaded: false,
  meta: null,

  saveLocalCache(catalog) {
    try {
      if (!catalog || !Array.isArray(catalog.crafts)) return
      localStorage.setItem(
        CRAFT_CACHE_KEY,
        JSON.stringify({
          updatedAt: catalog.updatedAt || new Date().toISOString(),
          crafts: catalog.crafts
        })
      )
    } catch (_) {}
  },

  loadLocalCache() {
    try {
      const raw = localStorage.getItem(CRAFT_CACHE_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw)
      if (!parsed || !Array.isArray(parsed.crafts) || !parsed.crafts.length) return null
      return {
        version: 1,
        updatedAt: parsed.updatedAt || null,
        source: 'local-cache',
        crafts: parsed.crafts
      }
    } catch (_) {
      return null
    }
  },

  buildDefaultCatalog() {
    const crafts = getCraftNameOrder()
      .map((name) => {
        if (typeof window.getDefaultCraftRecipe !== 'function') return null
        const d = window.getDefaultCraftRecipe(name)
        if (!d) return null
        return typeof window.applyFixedCraftRecipe === 'function'
          ? window.applyFixedCraftRecipe(d)
          : d
      })
      .filter(Boolean)
    return {
      version: 1,
      updatedAt: new Date().toISOString(),
      source: 'wiki-defaults',
      crafts
    }
  },

  ensureSixCraftCatalog(catalog) {
    const byName = new Map()
    ;(catalog?.crafts || []).forEach((c) => {
      if (c && c.name) byName.set(c.name, c)
    })
    const crafts = getCraftNameOrder()
      .map((name) => {
        const prev = byName.get(name) || { name }
        const base =
          typeof window.getDefaultCraftRecipe === 'function'
            ? window.getDefaultCraftRecipe(name)
            : null
        const merged = {
          name,
          price: base ? base.price : prev.price || 0,
          inputs: base ? base.inputs.map((i) => ({ ...i })) : prev.inputs || [],
          timeMinutes: base ? base.timeMinutes : prev.timeMinutes || 1,
          time: base ? base.timeMinutes : prev.time || 1,
          group: 'craft'
        }
        if (prev.currentPrice > 0) merged.currentPrice = prev.currentPrice
        if (prev.maxPrice > 0) merged.maxPrice = prev.maxPrice
        if (prev.priceChange != null) merged.priceChange = prev.priceChange
        return typeof window.applyFixedCraftRecipe === 'function'
          ? window.applyFixedCraftRecipe(merged)
          : merged
      })
      .filter(Boolean)

    return {
      version: catalog?.version || 1,
      updatedAt: catalog?.updatedAt || new Date().toISOString(),
      source: catalog?.source || 'merged',
      crafts
    }
  },

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
    if (item.priceChange != null && item.priceChange !== '') {
      recipe.priceChange = Math.floor(Number(item.priceChange))
    }
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
        if (row.price_change != null && row.price_change !== '') {
          craft.priceChange = Number(row.price_change)
        }
      })
      .filter(Boolean)

    let updatedAt = null
    for (const row of rows || []) {
      if (row.updated_at && (!updatedAt || row.updated_at > updatedAt)) {
        updatedAt = row.updated_at
      }
    }

    return this.ensureSixCraftCatalog({
      version: 1,
      updatedAt: updatedAt || new Date().toISOString(),
      source: 'supabase-direct',
      crafts
    })
  },

  async fetchFromSupabaseDirect() {
    const cfg = window.SUPABASE_CONFIG
    if (!cfg || !cfg.url || !cfg.anonKey) {
      console.warn('[crafts-catalog] SUPABASE_CONFIG 없음 — localStorage/위키 기본값 사용')
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
    this.saveLocalCache(catalog)
    return catalog
  },

  async fetchCatalog() {
    try {
      const direct = await this.fetchFromSupabaseDirect()
      if (direct && direct.crafts.length) return direct
    } catch (directErr) {
      console.warn('[crafts-catalog] direct Supabase failed:', directErr)
    }
    const cached = this.loadLocalCache()
    if (cached) {
      console.info('[crafts-catalog] using localStorage cache')
      return this.ensureSixCraftCatalog(cached)
    }
    console.warn('[crafts-catalog] using wiki default recipes only')
    return this.buildDefaultCatalog()
  },

  mergeIntoRecipes(data, catalog) {
    if (!data || !Array.isArray(data.recipes)) return false
    const full = this.ensureSixCraftCatalog(catalog)
    const craftRecipes = full.crafts.map((c) => this.mapCraftRecipe(c)).filter((c) => c.name)
    if (craftRecipes.length < getCraftNameOrder().length) return false

    const recipes = data.recipes
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
      updatedAt: full.updatedAt || null,
      source: full.source || 'supabase',
      count: craftRecipes.length
    }
    return true
  },

  async loadIntoData(data) {
    const catalog = await this.fetchCatalog()
    return this.mergeIntoRecipes(data, catalog)
  },

  hasCraftRecipes(data) {
    const order = getCraftNameOrder()
    if (!Array.isArray(data?.recipes)) return false
    const names = new Set(data.recipes.filter((r) => r && r.group === 'craft').map((r) => r.name))
    return order.every((n) => names.has(n))
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
      channel.onmessage = (ev) => {
        try {
          if (ev?.data?.catalog) {
            const merged = CraftsCatalog.ensureSixCraftCatalog(ev.data.catalog)
            CraftsCatalog.saveLocalCache(merged)
            CraftsCatalog.mergeIntoRecipes(data, merged)
            if (typeof onUpdated === 'function') onUpdated(CraftsCatalog.meta)
          }
        } catch (_) {}
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
    }, 12000)
  }
}

window.CraftsCatalog = CraftsCatalog
