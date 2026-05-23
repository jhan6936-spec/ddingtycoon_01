const { handleCors, sendJson, readJson, supabaseRest, classifySupabaseError } = require('../_supabase')
const { verifyShellfishAdmin, getShellfishAuthStatus } = require('../../lib/admin-auth')
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

  if (action === 'auth-status') {
    const status = getShellfishAuthStatus()
    sendJson(res, 200, {
      ok: true,
      ...status,
      hint:
        status.shellfishSlotCount === 0 && !status.craftConfigured
          ? 'Vercel에 ADMIN_SECRET 또는 ADMIN_SECRET_SHELLFISH_* 값을 넣고 재배포하세요.'
          : '로그인 입력란에는 환경 변수 이름이 아니라 값(비밀번호)을 입력하세요.'
    })
    return
  }

  if (action === 'verify') {
    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'Method not allowed' })
      return
    }
    const auth = verifyShellfishAdmin(req)
    if (!auth.ok) {
      const status = auth.status || getShellfishAuthStatus()
      let hint = '입력한 비밀번호가 서버에 설정된 값과 다릅니다. Vercel 환경 변수 값을 확인하세요.'
      if (auth.error === 'not_configured') {
        hint =
          '서버에 관리자 비밀번호가 하나도 없습니다. ADMIN_SECRET 또는 ADMIN_SECRET_SHELLFISH_leaf0_01 등을 설정한 뒤 반드시 재배포하세요.'
      } else if (status.shellfishSlotCount === 0 && !status.craftConfigured) {
        hint =
          '환경 변수가 배포에 반영되지 않았습니다. Vercel에서 저장 후 Redeploy 하세요.'
      } else if (status.shellfishSlotCount > 0) {
        hint += ` (서버에 어패류 슬롯 ${status.shellfishSlotCount}개 로드됨: ${status.shellfishEditors.join(', ')})`
      }
      sendJson(res, 401, {
        ok: false,
        message: '비밀번호가 올바르지 않습니다.',
        hint,
        authStatus: status
      })
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
