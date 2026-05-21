const { handleCors, sendJson, classifySupabaseError, supabaseRest } = require('./_supabase')
const { getCraftsCatalog } = require('../lib/crafts-store')

const supabaseRestOrNull =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? supabaseRest : null

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed' })
    return
  }
  try {
    const catalog = await getCraftsCatalog(supabaseRestOrNull)
    sendJson(res, 200, catalog)
  } catch (error) {
    const info = classifySupabaseError(error)
    sendJson(res, 500, { error: info.code, hint: info.hint, message: String(error.message || error) })
  }
}
