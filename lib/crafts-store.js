const fs = require('fs')
const path = require('path')

const CATALOG_ID = 'crafts'

function craftsJsonPath() {
  return path.join(process.cwd(), 'data', 'crafts.json')
}

function readStaticCraftsFile() {
  const filePath = craftsJsonPath()
  if (!fs.existsSync(filePath)) {
    return { version: 1, updatedAt: null, crafts: [] }
  }
  const raw = fs.readFileSync(filePath, 'utf8')
  const parsed = JSON.parse(raw)
  return normalizeCraftsPayload(parsed)
}

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
  const price = Math.max(0, Math.floor(Number(item.price) || 0))
  const currentPrice = Math.max(0, Math.floor(Number(item.currentPrice) || 0)) || null
  const maxPrice = Math.max(0, Math.floor(Number(item.maxPrice) || 0)) || null
  const out = {
    name,
    inputs,
    time: timeMinutes,
    timeMinutes,
    price,
    group: 'craft'
  }
  if (currentPrice) out.currentPrice = currentPrice
  if (maxPrice) out.maxPrice = maxPrice
  return out
}

function normalizeCraftsPayload(payload) {
  const crafts = Array.isArray(payload?.crafts)
    ? payload.crafts.map(normalizeCraftItem).filter(Boolean)
    : []
  return {
    version: Number(payload?.version) || 1,
    updatedAt: payload?.updatedAt || new Date().toISOString(),
    crafts
  }
}

async function readCraftsFromSupabase(supabaseRest) {
  try {
    const rows = await supabaseRest(
      `/site_catalog?id=eq.${CATALOG_ID}&select=id,payload,updated_at&limit=1`
    )
    if (!Array.isArray(rows) || !rows.length) return null
    const payload = rows[0].payload
    if (!payload) return null
    const normalized = normalizeCraftsPayload(payload)
    normalized.updatedAt = rows[0].updated_at || normalized.updatedAt
    normalized.source = 'supabase'
    return normalized
  } catch (_) {
    return null
  }
}

async function getCraftsCatalog(supabaseRest) {
  const staticPayload = readStaticCraftsFile()
  if (!supabaseRest) {
    staticPayload.source = 'static'
    return staticPayload
  }
  const remote = await readCraftsFromSupabase(supabaseRest)
  if (remote && remote.crafts.length) return remote
  staticPayload.source = 'static'
  return staticPayload
}

async function saveCraftsCatalog(supabaseRest, payload) {
  const normalized = normalizeCraftsPayload(payload)
  normalized.updatedAt = new Date().toISOString()
  await supabaseRest('/site_catalog', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify([
      {
        id: CATALOG_ID,
        payload: normalized,
        updated_at: normalized.updatedAt
      }
    ])
  })
  return normalized
}

function writeStaticCraftsFile(payload) {
  const normalized = normalizeCraftsPayload(payload)
  const filePath = craftsJsonPath()
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(normalized, null, 2), 'utf8')
  return normalized
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
  CATALOG_ID,
  normalizeCraftItem,
  normalizeCraftsPayload,
  readStaticCraftsFile,
  getCraftsCatalog,
  saveCraftsCatalog,
  writeStaticCraftsFile,
  verifyAdminSecret
}
