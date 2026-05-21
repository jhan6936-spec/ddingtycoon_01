const { handleCors, sendJson, readJson, supabaseRest, classifySupabaseError } = require('../_supabase')
const {
  getCraftsCatalog,
  saveCraftsCatalog,
  writeStaticCraftsFile,
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

      let saved = normalized
      const hasSupabase =
        process.env.SUPABASE_URL &&
        process.env.SUPABASE_SERVICE_ROLE_KEY

      if (hasSupabase) {
        saved = await saveCraftsCatalog(supabaseRest, normalized)
      }

      if (process.env.CRAFTS_WRITE_STATIC === '1') {
        writeStaticCraftsFile(saved)
      }

      sendJson(res, 200, {
        ok: true,
        catalog: saved,
        persistedTo: hasSupabase ? 'supabase' : 'memory',
        staticWritten: process.env.CRAFTS_WRITE_STATIC === '1'
      })
    } catch (error) {
      const info = classifySupabaseError(error)
      sendJson(res, 500, { error: info.code, hint: info.hint, message: String(error.message || error) })
    }
    return
  }

  sendJson(res, 405, { error: 'Method not allowed' })
}
