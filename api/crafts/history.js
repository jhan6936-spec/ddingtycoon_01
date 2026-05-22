const { handleCors, sendJson, classifySupabaseError, supabaseRest } = require('../_supabase')
const { readCraftPriceHistory, CRAFT_NAME_ORDER } = require('../../lib/crafts-store')

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed' })
    return
  }

  try {
    const url = new URL(req.url || '', 'http://localhost')
    const days = url.searchParams.get('days') || '90'
    const craftName = url.searchParams.get('name') || ''

    const rows = await readCraftPriceHistory(supabaseRest, {
      days,
      craftName
    })

    sendJson(res, 200, {
      days: Number(days) || 90,
      craftNames: CRAFT_NAME_ORDER,
      count: rows.length,
      history: rows
    })
  } catch (error) {
    const info = classifySupabaseError(error)
    const hint =
      info.code === 'table_missing'
        ? 'Supabase SQL Editor에서 supabase_craft_price_history.sql 을 실행하세요.'
        : info.hint
    sendJson(res, 500, { error: info.code, hint, message: String(error.message || error) })
  }
}
