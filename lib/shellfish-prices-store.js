const SHELLFISH_SPECIES = ['굴', '소라', '문어', '미역', '성게']
const STAR_SUFFIXES = [' ★', ' ★★', ' ★★★']

const SHELLFISH_ITEM_ORDER = SHELLFISH_SPECIES.flatMap((species) =>
  STAR_SUFFIXES.map((suffix) => species + suffix)
)

function normalizePriceItem(row) {
  if (!row || !row.item_name) return null
  const name = String(row.item_name).trim()
  if (!SHELLFISH_ITEM_ORDER.includes(name)) return null
  const buyPrice = Math.max(0, Math.floor(Number(row.buy_price) || 0))
  return {
    itemName: name,
    buyPrice,
    updatedAt: row.updated_at || null,
    updatedBy: row.updated_by || null
  }
}

function rowsToCatalog(rows) {
  const byName = new Map()
  ;(Array.isArray(rows) ? rows : []).forEach((row) => {
    const item = normalizePriceItem(row)
    if (item) byName.set(item.itemName, item)
  })
  const items = SHELLFISH_ITEM_ORDER.map((name) => {
    const prev = byName.get(name)
    return (
      prev || {
        itemName: name,
        buyPrice: 0,
        updatedAt: null,
        updatedBy: null
      }
    )
  })
  const updatedAt = items.reduce((latest, item) => {
    if (!item.updatedAt) return latest
    if (!latest || item.updatedAt > latest) return item.updatedAt
    return latest
  }, null)
  return {
    version: 1,
    updatedAt: updatedAt || new Date().toISOString(),
    items
  }
}

async function readShellfishPricesFromSupabase(supabaseRest) {
  const rows = await supabaseRest(
    '/shellfish_buy_prices?select=item_name,buy_price,updated_at,updated_by&order=item_name.asc'
  )
  return rowsToCatalog(Array.isArray(rows) ? rows : [])
}

async function upsertShellfishPrices(supabaseRest, payload, { editor } = {}) {
  const items = Array.isArray(payload?.items) ? payload.items : []
  const byName = new Map(items.map((i) => [i.itemName || i.item_name, i]))
  const now = new Date().toISOString()

  for (const name of SHELLFISH_ITEM_ORDER) {
    const src = byName.get(name) || {}
    const buyPrice = Math.max(0, Math.floor(Number(src.buyPrice ?? src.buy_price) || 0))
    await supabaseRest(`/shellfish_buy_prices?item_name=eq.${encodeURIComponent(name)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        buy_price: buyPrice,
        updated_at: now,
        updated_by: editor || null
      })
    })
  }

  return readShellfishPricesFromSupabase(supabaseRest)
}

function catalogToPriceMap(catalog) {
  const map = {}
  ;(catalog.items || []).forEach((item) => {
    if (item && item.itemName) map[item.itemName] = Math.max(0, Number(item.buyPrice) || 0)
  })
  return map
}

module.exports = {
  SHELLFISH_ITEM_ORDER,
  SHELLFISH_SPECIES,
  rowsToCatalog,
  readShellfishPricesFromSupabase,
  upsertShellfishPrices,
  catalogToPriceMap
}
