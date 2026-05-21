const { handleCors, sendJson, classifySupabaseError, supabaseRest } = require('./_supabase')
const { getCraftsCatalog } = require('../lib/crafts-store')

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed' })
    return
  }
  try {
    const catalog = await getCraftsCatalog(supabaseRest)
    sendJson(res, 200, catalog)
  } catch (error) {
    const info = classifySupabaseError(error)
    const hint =
      info.code === 'table_missing'
        ? 'Supabase SQL Editor에서 supabase_craft_items.sql 을 실행하세요.'
        : info.hint
    sendJson(res, 500, { error: info.code, hint, message: String(error.message || error) })
  }
}
