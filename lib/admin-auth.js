function extractBearerToken(req) {
  const header = String(req.headers.authorization || '')
  if (!header.startsWith('Bearer ')) return ''
  return header.slice(7).trim()
}

function collectShellfishAdminSecrets() {
  const editors = []
  for (const [key, val] of Object.entries(process.env)) {
    if (!key.startsWith('ADMIN_SECRET_SHELLFISH_') || !val) continue
    const editor = key.slice('ADMIN_SECRET_SHELLFISH_'.length)
    editors.push({ editor, token: String(val).trim() })
  }
  return editors
}

/** 공예품 admin 전용 (전체 초기화·공예품 저장) */
function verifyCraftAdmin(req) {
  const expected = process.env.ADMIN_SECRET || ''
  if (!expected) return { ok: false, error: 'ADMIN_SECRET not configured' }
  const token = extractBearerToken(req)
  if (!token || token !== expected) return { ok: false, error: 'Unauthorized' }
  return { ok: true, role: 'craft', editor: 'owner' }
}

/** 어패류 시세 admin — OWNER 또는 ADMIN_SECRET_SHELLFISH_* */
function verifyShellfishAdmin(req) {
  const craft = verifyCraftAdmin(req)
  if (craft.ok) return craft

  const token = extractBearerToken(req)
  if (!token) return { ok: false, error: 'Unauthorized' }

  for (const { editor, token: secret } of collectShellfishAdminSecrets()) {
    if (token === secret) {
      return { ok: true, role: 'shellfish', editor }
    }
  }
  return { ok: false, error: 'Unauthorized' }
}

/** @deprecated — 공예품 API 호환 */
function verifyAdminSecret(req) {
  return verifyCraftAdmin(req)
}

module.exports = {
  extractBearerToken,
  verifyCraftAdmin,
  verifyShellfishAdmin,
  verifyAdminSecret
}
