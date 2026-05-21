const { handleCors, sendJson } = require('../_supabase')
const { verifyAdminSecret } = require('../../lib/crafts-store')

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return
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
}
