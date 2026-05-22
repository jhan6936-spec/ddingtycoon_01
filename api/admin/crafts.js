const { handleCors, sendJson, readJson, supabaseRest, classifySupabaseError } = require('../_supabase')
const {
  getCraftsCatalog,
  upsertCraftItems,
  verifyAdminSecret,
  normalizeCraftsPayload
} = require('../../lib/crafts-store')

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return

  const auth = verifyAdminSecret(req)
  if (!auth.ok) {
    sendJson(res, 401, { error: auth.error })
    return
  }

  if (req.method === 'GET') {
    try {
      const catalog = await getCraftsCatalog(supabaseRest)
      sendJson(res, 200, catalog)
    } catch (error) {
      const info = classifySupabaseError(error)
      sendJson(res, 500, { error: info.code, hint: info.hint, message: String(error.message || error) })
    }
    return
  }

  if (req.method === 'PUT') {
    try {
      const body = await readJson(req)
      const normalized = normalizeCraftsPayload(body)
      if (!normalized.crafts.length) {
        sendJson(res, 400, { error: 'crafts array is required' })
        return
      }

      const source = body.source === 'manual' ? 'manual' : body.source === 'ocr' ? 'ocr' : 'admin'
      const saved = await upsertCraftItems(supabaseRest, normalized, { source })
      sendJson(res, 200, {
        ok: true,
        catalog: saved,
        persistedTo: 'supabase',
        table: 'craft_items'
      })
    } catch (error) {
      const info = classifySupabaseError(error)
      sendJson(res, 500, { error: info.code, hint: info.hint, message: String(error.message || error) })
    }
    return
  }

  sendJson(res, 405, { error: 'Method not allowed' })
}
