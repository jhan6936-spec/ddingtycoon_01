const { handleCors, sendJson, supabaseRest, classifySupabaseError } = require('../_supabase')
const { readShellfishPricesFromSupabase } = require('../lib/shellfish-prices-store')

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return

  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed' })
    return
  }

  try {
    const catalog = await readShellfishPricesFromSupabase(supabaseRest)
    sendJson(res, 200, catalog)
  } catch (error) {
    const info = classifySupabaseError(error)
    sendJson(res, 500, { error: info.code, hint: info.hint, message: String(error.message || error) })
  }
}
