const { applyFixedRecipeToCraft } = require('./craft-recipe-fixed')

const CRAFT_NAME_ORDER = [
  '조개껍데기 브로치',
  '푸른 향수병',
  '자개 손거울',
  '분홍 헤어핀',
  '자개 부채',
  '흑진주 시계'
]

function normalizeCraftItem(item) {
  if (!item || typeof item !== 'object') return null
  const name = String(item.name || '').trim()
  if (!name) return null
  const inputs = Array.isArray(item.inputs)
    ? item.inputs
        .map((inp) => ({
          name: String(inp.name || '').trim(),
          count: Math.max(1, Math.floor(Number(inp.count) || 0))
        }))
        .filter((inp) => inp.name)
    : []
  const timeMinutes = Math.max(
    1,
    Math.floor(Number(item.timeMinutes != null ? item.timeMinutes : item.time) || 1)
  )
  const currentPrice = Math.max(0, Math.floor(Number(item.currentPrice) || 0)) || null
  let maxPrice = Math.max(0, Math.floor(Number(item.maxPrice) || 0)) || null
  const maxPct = Math.floor(Number(item.maxPricePercent) || 0)
  const priceChangeRaw = Number(item.priceChange)
  const priceChange = Number.isFinite(priceChangeRaw) ? Math.floor(priceChangeRaw) : null
  const out = {
    name,
    time: timeMinutes,
    timeMinutes,
    group: 'craft'
  }
  if (currentPrice) out.currentPrice = currentPrice
  if (maxPct >= 1 && maxPct <= 100) out.maxPricePercent = maxPct
  if (maxPrice >= 1 && maxPrice <= 100 && currentPrice) {
    out.maxPricePercent = maxPrice
    maxPrice = Math.round(currentPrice / (maxPrice / 100))
  }
  if (maxPrice) out.maxPrice = maxPrice
  if (priceChange != null && priceChange !== 0) out.priceChange = priceChange
  return applyFixedRecipeToCraft(out)
}

function ensureSixCrafts(crafts) {
  const byName = new Map()
  ;(crafts || []).forEach((c) => {
    if (c && c.name) byName.set(c.name, c)
  })
  return CRAFT_NAME_ORDER.map((name) => {
    const prev = byName.get(name) || { name }
    return applyFixedRecipeToCraft({
      name,
      currentPrice: prev.currentPrice,
      maxPrice: prev.maxPrice,
      priceChange: prev.priceChange,
      maxPricePercent: prev.maxPricePercent
    })
  })
}

function normalizeCraftsPayload(payload) {
  const crafts = Array.isArray(payload?.crafts)
    ? payload.crafts.map(normalizeCraftItem).filter(Boolean)
    : []
  return {
    version: Number(payload?.version) || 1,
    updatedAt: payload?.updatedAt || new Date().toISOString(),
    crafts: ensureSixCrafts(crafts)
  }
}

function sortOrderForName(name, fallbackIndex) {
  const idx = CRAFT_NAME_ORDER.indexOf(name)
  return idx >= 0 ? idx : 100 + fallbackIndex
}

function rowToCraftItem(row) {
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
  return applyFixedRecipeToCraft(craft)
}

function craftToRow(craft, index) {
  const fixed = applyFixedRecipeToCraft(craft)
  return {
    name: fixed.name,
    price: fixed.price || 0,
    current_price: fixed.currentPrice != null ? fixed.currentPrice : null,
    max_price: fixed.maxPrice != null ? fixed.maxPrice : null,
    price_change: fixed.priceChange != null ? fixed.priceChange : null,
    time_minutes: fixed.timeMinutes || fixed.time || 1,
    inputs: fixed.inputs || [],
    sort_order: sortOrderForName(fixed.name, index),
    updated_at: new Date().toISOString()
  }
}

function rowsToCatalog(rows) {
  const crafts = (Array.isArray(rows) ? rows : [])
    .map(rowToCraftItem)
    .filter(Boolean)
    .sort((a, b) => sortOrderForName(a.name, 0) - sortOrderForName(b.name, 0))

  let updatedAt = null
  for (const row of rows || []) {
    if (row.updated_at && (!updatedAt || row.updated_at > updatedAt)) {
      updatedAt = row.updated_at
    }
  }

  return {
    version: 1,
    updatedAt: updatedAt || new Date().toISOString(),
    source: 'supabase',
    crafts: ensureSixCrafts(crafts)
  }
}

async function readCraftsFromSupabase(supabaseRest) {
  const rows = await supabaseRest(
    '/craft_items?select=name,price,current_price,max_price,price_change,time_minutes,inputs,sort_order,updated_at&order=sort_order.asc,name.asc'
  )
  if (!Array.isArray(rows)) {
    return { version: 1, updatedAt: null, source: 'supabase', crafts: [] }
  }
  return rowsToCatalog(rows)
}

async function getCraftsCatalog(supabaseRest) {
  if (!supabaseRest) {
    throw new Error('Missing env: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }
  return readCraftsFromSupabase(supabaseRest)
}

async function appendCraftPriceHistory(supabaseRest, crafts, source) {
  if (!Array.isArray(crafts) || !crafts.length) return
  const recordedAt = new Date().toISOString()
  const rows = crafts.map((craft) => ({
    craft_name: craft.name,
    price: craft.price || 0,
    current_price: craft.currentPrice != null ? craft.currentPrice : null,
    max_price: craft.maxPrice != null ? craft.maxPrice : null,
    price_change: craft.priceChange != null ? craft.priceChange : null,
    source: source || 'admin',
    recorded_at: recordedAt
  }))
  await supabaseRest('/craft_price_history', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(rows)
  })
}

async function readCraftPriceHistory(supabaseRest, options) {
  const days = Math.max(1, Math.min(3650, Number(options?.days) || 90))
  const craftName = options?.craftName ? String(options.craftName).trim() : ''
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  let path =
    '/craft_price_history?select=id,craft_name,price,current_price,max_price,price_change,source,recorded_at' +
    `&recorded_at=gte.${encodeURIComponent(since)}` +
    '&order=recorded_at.asc'

  if (craftName) {
    path += `&craft_name=eq.${encodeURIComponent(craftName)}`
  }

  const rows = await supabaseRest(path)
  return Array.isArray(rows) ? rows : []
}

async function upsertCraftItems(supabaseRest, payload, options) {
  const normalized = normalizeCraftsPayload(payload)
  if (!normalized.crafts.length) {
    throw new Error('crafts array is required')
  }

  const rows = normalized.crafts.map((craft, index) => craftToRow(craft, index))
  await supabaseRest('/craft_items', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows)
  })

  await appendCraftPriceHistory(
    supabaseRest,
    normalized.crafts,
    options && options.source ? options.source : 'admin'
  )

  return readCraftsFromSupabase(supabaseRest)
}

/** @deprecated 정적 파일 저장 — Supabase 전용 운영 시 사용 안 함 */
async function saveCraftsCatalog(supabaseRest, payload) {
  return upsertCraftItems(supabaseRest, payload)
}

function verifyAdminSecret(req) {
  const expected = process.env.ADMIN_SECRET || ''
  if (!expected) return { ok: false, error: 'ADMIN_SECRET not configured' }
  const header = String(req.headers.authorization || '')
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token || token !== expected) return { ok: false, error: 'Unauthorized' }
  return { ok: true }
}

module.exports = {
  CRAFT_NAME_ORDER,
  ensureSixCrafts,
  normalizeCraftItem,
  normalizeCraftsPayload,
  readCraftsFromSupabase,
  getCraftsCatalog,
  appendCraftPriceHistory,
  readCraftPriceHistory,
  upsertCraftItems,
  saveCraftsCatalog,
  verifyAdminSecret,
  rowsToCatalog,
  craftToRow,
  rowToCraftItem
}
