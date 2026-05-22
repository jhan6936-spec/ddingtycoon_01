const { handleCors, sendJson, supabaseRest, classifySupabaseError } = require('../_supabase')
const { verifyAdminSecret } = require('../../lib/crafts-store')
const { CRAFT_FIXED_RECIPES, applyFixedRecipeToCraft } = require('../../lib/craft-recipe-fixed')
const { upsertCraftItems, readCraftsFromSupabase } = require('../../lib/crafts-store')

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return

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

    const saved = await upsertCraftItems(supabaseRest, { crafts, updatedAt: new Date().toISOString() }, { source: 'wiki-fix' })

    sendJson(res, 200, {
      ok: true,
      message: '위키 기준 레시피로 복구했습니다 (시세 데이터는 유지)',
      catalog: saved
    })
  } catch (error) {
    const info = classifySupabaseError(error)
    sendJson(res, 500, { error: info.code, hint: info.hint, message: String(error.message || error) })
  }
}
