const { handleCors, sendJson, readJson, supabaseRest, classifySupabaseError } = require('../../_supabase')
const { verifyShellfishAdmin } = require('../../lib/admin-auth')
const {
  readShellfishPricesFromSupabase,
  upsertShellfishPrices
} = require('../../lib/shellfish-prices-store')

function getAction(req) {
  const url = new URL(req.url || '', 'http://localhost')
  return String(url.searchParams.get('action') || '').trim().toLowerCase()
}

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return

  const action = getAction(req)

  if (action === 'verify') {
    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'Method not allowed' })
      return
    }
    const auth = verifyShellfishAdmin(req)
    if (!auth.ok) {
      sendJson(res, 401, { ok: false, message: '비밀번호가 올바르지 않습니다.' })
      return
    }
    sendJson(res, 200, {
      ok: true,
      message: '인증되었습니다.',
      role: auth.role,
      editor: auth.editor || null
    })
    return
  }

  const auth = verifyShellfishAdmin(req)
  if (!auth.ok) {
    sendJson(res, 401, { error: auth.error })
    return
  }

  if (req.method === 'GET') {
    try {
      const catalog = await readShellfishPricesFromSupabase(supabaseRest)
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
      const items = Array.isArray(body.items) ? body.items : []
      if (!items.length) {
        sendJson(res, 400, { error: 'items array is required' })
        return
      }
      const saved = await upsertShellfishPrices(supabaseRest, body, {
        editor: auth.editor || body.editor || null
      })
      sendJson(res, 200, {
        ok: true,
        catalog: saved,
        persistedTo: 'supabase',
        table: 'shellfish_buy_prices'
      })
    } catch (error) {
      const info = classifySupabaseError(error)
      sendJson(res, 500, { error: info.code, hint: info.hint, message: String(error.message || error) })
    }
    return
  }

  sendJson(res, 405, { error: 'Method not allowed' })
}
