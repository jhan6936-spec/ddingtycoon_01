const { handleCors, sendJson, readJson, supabaseRest, classifySupabaseError } = require('../_supabase')
const {
  getCraftsCatalog,
  upsertCraftItems,
  verifyAdminSecret,
  normalizeCraftsPayload,
  readCraftsFromSupabase,
  clearCraftPriceHistory,
  resetCraftMarketData,
  reanchorCraftPriceHistory
} = require('../../lib/crafts-store')
const { CRAFT_FIXED_RECIPES, applyFixedRecipeToCraft } = require('../../lib/craft-recipe-fixed')

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
    const auth = verifyAdminSecret(req)
    if (!auth.ok) {
      sendJson(res, 401, { ok: false, message: '비밀번호가 올바르지 않습니다.' })
      return
    }
    sendJson(res, 200, { ok: true, message: '인증되었습니다.' })
    return
  }

  if (action === 'clear-history') {
    const auth = verifyAdminSecret(req)
    if (!auth.ok) {
      sendJson(res, 401, { error: auth.error })
      return
    }
    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'Method not allowed' })
      return
    }
    try {
      await clearCraftPriceHistory(supabaseRest)
      sendJson(res, 200, {
        ok: true,
        message: '그래프 이력(craft_price_history)만 삭제했습니다.'
      })
    } catch (error) {
      const info = classifySupabaseError(error)
      sendJson(res, 500, { error: info.code, hint: info.hint, message: String(error.message || error) })
    }
    return
  }

  if (action === 'reanchor-history') {
    const auth = verifyAdminSecret(req)
    if (!auth.ok) {
      sendJson(res, 401, { error: auth.error })
      return
    }
    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'Method not allowed' })
      return
    }
    try {
      const body = req.method === 'POST' ? await readJson(req).catch(() => ({})) : {}
      const result = await reanchorCraftPriceHistory(supabaseRest, {
        year: body.year,
        month: body.month,
        day: body.day
      })
      sendJson(res, 200, {
        ok: true,
        message:
          result.snapshotCount > 0
            ? `그래프 이력 ${result.snapshotCount}개 스냅샷을 5/21 03:00(KST)부터 하루씩 맞췄습니다.`
            : '맞출 이력이 없습니다.',
        ...result
      })
    } catch (error) {
      const info = classifySupabaseError(error)
      sendJson(res, 500, { error: info.code, hint: info.hint, message: String(error.message || error) })
    }
    return
  }

  if (action === 'reset-market') {
    const auth = verifyAdminSecret(req)
    if (!auth.ok) {
      sendJson(res, 401, { error: auth.error })
      return
    }
    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'Method not allowed' })
      return
    }
    try {
      const catalog = await resetCraftMarketData(supabaseRest)
      sendJson(res, 200, {
        ok: true,
        message:
          '공예품 시세·이력을 초기화했습니다. 과거 이력을 넣은 뒤, 마지막에 오늘 시세를 저장하세요.',
        catalog
      })
    } catch (error) {
      const info = classifySupabaseError(error)
      sendJson(res, 500, { error: info.code, hint: info.hint, message: String(error.message || error) })
    }
    return
  }

  if (action === 'fix-recipes') {
    const auth = verifyAdminSecret(req)
    if (!auth.ok) {
      sendJson(res, 401, { error: auth.error })
      return
    }
    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'Method not allowed' })
      return
    }
    try {
      const existing = await readCraftsFromSupabase(supabaseRest)
      const byName = new Map((existing.crafts || []).map((c) => [c.name, c]))
      const crafts = Object.keys(CRAFT_FIXED_RECIPES).map((name) => {
        const prev = byName.get(name) || {}
        return applyFixedRecipeToCraft({
          name,
          currentPrice: prev.currentPrice,
          priceChange: prev.priceChange,
          maxPrice: prev.maxPrice,
          maxPricePercent: prev.maxPricePercent
        })
      })
      const saved = await upsertCraftItems(
        supabaseRest,
        { crafts, updatedAt: new Date().toISOString() },
        { source: 'wiki-fix' }
      )
      sendJson(res, 200, {
        ok: true,
        message: '위키 기준 레시피로 복구했습니다 (시세 데이터는 유지)',
        catalog: saved
      })
    } catch (error) {
      const info = classifySupabaseError(error)
      sendJson(res, 500, { error: info.code, hint: info.hint, message: String(error.message || error) })
    }
    return
  }

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
      const historyDate =
        body.historyDate != null
          ? String(body.historyDate).trim()
          : body.recordedAtDate != null
            ? String(body.recordedAtDate).trim()
            : ''
      const saved = await upsertCraftItems(supabaseRest, normalized, {
        source,
        historyDate: historyDate || undefined
      })
      sendJson(res, 200, {
        ok: true,
        catalog: saved,
        persistedTo: 'supabase',
        table: 'craft_items',
        historyDate: historyDate || null,
        recordedAt: saved.lastRecordedAt || null
      })
    } catch (error) {
      const info = classifySupabaseError(error)
      sendJson(res, 500, { error: info.code, hint: info.hint, message: String(error.message || error) })
    }
    return
  }

  sendJson(res, 405, { error: 'Method not allowed' })
}
