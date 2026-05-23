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
    sendJson(res, 500, {
      ok: false,
      error: info.code,
      hint: info.hint,
      message:
        info.code === 'table_missing'
          ? '어패류 매입가 테이블(shellfish_buy_prices)이 Supabase에 없습니다.'
          : String(error.message || error)
    })
  }
}
