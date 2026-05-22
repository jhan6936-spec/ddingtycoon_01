const {
  applyFixedRecipeToCraft,
  CRAFT_MAX_PRICES,
  repairCraftCurrentPrice
} = require('./craft-recipe-fixed')

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
  const out = {
    name,
    time: timeMinutes,
    timeMinutes,
    group: 'craft',
    currentPrice: item.currentPrice
  }
  return applyFixedRecipeToCraft(out)
}

/** 저장 시: 최고가 % 자동, 전회 시세 있을 때만 변동(첫 입력은 변동 없음) */
function enrichCraftsForSave(crafts, existingCrafts) {
  const existingByName = new Map((existingCrafts || []).map((c) => [c.name, c]))

  return (crafts || []).map((craft) => {
    const name = craft.name
    const prev = existingByName.get(name)
    let current = repairCraftCurrentPrice(name, craft.currentPrice)
    if (!current || current < 500) {
      return applyFixedRecipeToCraft({ name, currentPrice: prev?.currentPrice })
    }

    let priceChange = null
    const prevCurrent =
      prev && prev.currentPrice != null && Number(prev.currentPrice) >= 500
        ? Number(prev.currentPrice)
        : null
    if (prevCurrent != null) {
      const delta = current - prevCurrent
      if (delta !== 0) priceChange = delta
    }

    return applyFixedRecipeToCraft({
      name,
      currentPrice: current,
      priceChange,
      maxPrice: CRAFT_MAX_PRICES[name] || null
    })
  })
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
  if (row.price_change != null && row.price_change !== '') {
    craft.priceChange = Number(row.price_change)
  }
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

const CRAFT_HISTORY_TIMEZONE = 'Asia/Seoul'

/** 서울 달력 기준 해당일 03:00 KST (+09:00) */
function getSeoulDailyRecordedAtISO(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CRAFT_HISTORY_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date)
  const pick = (type) => parts.find((p) => p.type === type)?.value || ''
  return `${pick('year')}-${pick('month')}-${pick('day')}T03:00:00+09:00`
}

function seoulRecordedAtISOFromYmd(year, month, day) {
  const y = String(year).padStart(4, '0')
  const m = String(month).padStart(2, '0')
  const d = String(day).padStart(2, '0')
  return `${y}-${m}-${d}T03:00:00+09:00`
}

function addDaysToSeoulRecordedAtISO(iso, dayOffset) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T03:00:00\+09:00$/.exec(iso)
  if (!match) throw new Error('Invalid Seoul anchor ISO: ' + iso)
  const base = new Date(`${match[1]}-${match[2]}-${match[3]}T03:00:00+09:00`)
  return getSeoulDailyRecordedAtISO(new Date(base.getTime() + dayOffset * 86400000))
}

async function deleteCraftPriceHistoryAtRecordedAt(supabaseRest, recordedAt) {
  await supabaseRest(
    `/craft_price_history?recorded_at=eq.${encodeURIComponent(recordedAt)}`,
    {
      method: 'DELETE',
      headers: { Prefer: 'return=minimal' }
    }
  )
}

async function appendCraftPriceHistory(supabaseRest, crafts, source) {
  if (!Array.isArray(crafts) || !crafts.length) return
  const recordedAt = getSeoulDailyRecordedAtISO()
  await deleteCraftPriceHistoryAtRecordedAt(supabaseRest, recordedAt)
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
  return recordedAt
}

/** 기존 이력 스냅샷을 5/21 03:00부터 하루씩 03:00 KST로 재배치 */
async function reanchorCraftPriceHistory(supabaseRest, options = {}) {
  const year = Number(options.year) || 2026
  const month = Number(options.month) || 5
  const day = Number(options.day) || 21
  const baseIso = seoulRecordedAtISOFromYmd(year, month, day)

  const rows = await supabaseRest(
    '/craft_price_history?select=id,recorded_at&order=recorded_at.asc'
  )
  if (!Array.isArray(rows) || !rows.length) {
    return { snapshotCount: 0, anchors: [] }
  }

  const distinct = []
  const seen = new Set()
  for (const row of rows) {
    const t = row.recorded_at
    if (t && !seen.has(t)) {
      seen.add(t)
      distinct.push(t)
    }
  }

  const anchors = []
  for (let i = 0; i < distinct.length; i++) {
    const oldAt = distinct[i]
    const newAt = addDaysToSeoulRecordedAtISO(baseIso, i)
    anchors.push({ from: oldAt, to: newAt })
    await supabaseRest(
      `/craft_price_history?recorded_at=eq.${encodeURIComponent(oldAt)}`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal', 'Content-Type': 'application/json' },
        body: JSON.stringify({ recorded_at: newAt })
      }
    )
  }

  return { snapshotCount: distinct.length, anchors, baseIso }
}

async function clearCraftPriceHistory(supabaseRest) {
  await supabaseRest('/craft_price_history?id=gte.0', {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' }
  })
}

/** craft_items 시세 필드 + 가격 이력 전부 초기화 (레시피·제작가는 위키 고정값 유지) */
async function resetCraftMarketData(supabaseRest) {
  await clearCraftPriceHistory(supabaseRest)

  const crafts = CRAFT_NAME_ORDER.map((name) =>
    applyFixedRecipeToCraft({
      name,
      currentPrice: null,
      priceChange: null,
      maxPrice: CRAFT_MAX_PRICES[name] || null
    })
  )
  const rows = crafts.map((craft, index) => {
    const row = craftToRow(craft, index)
    row.current_price = null
    row.price_change = null
    row.max_price = CRAFT_MAX_PRICES[craft.name] || null
    return row
  })

  await supabaseRest('/craft_items', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows)
  })

  return readCraftsFromSupabase(supabaseRest)
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

  const existing = await readCraftsFromSupabase(supabaseRest)
  const enrichedCrafts = enrichCraftsForSave(normalized.crafts, existing.crafts)
  const rows = enrichedCrafts.map((craft, index) => craftToRow(craft, index))
  await supabaseRest('/craft_items', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows)
  })

  await appendCraftPriceHistory(
    supabaseRest,
    enrichedCrafts,
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
  enrichCraftsForSave,
  normalizeCraftItem,
  normalizeCraftsPayload,
  readCraftsFromSupabase,
  getCraftsCatalog,
  getSeoulDailyRecordedAtISO,
  appendCraftPriceHistory,
  clearCraftPriceHistory,
  reanchorCraftPriceHistory,
  resetCraftMarketData,
  readCraftPriceHistory,
  upsertCraftItems,
  saveCraftsCatalog,
  verifyAdminSecret,
  rowsToCatalog,
  craftToRow,
  rowToCraftItem
}
