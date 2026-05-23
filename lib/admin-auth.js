function normalizeSecret(value) {
  let s = String(value ?? '').trim()
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim()
  }
  return s
}

function extractBearerToken(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || ''
  const raw = String(header).trim()
  if (!raw.toLowerCase().startsWith('bearer ')) return ''
  return normalizeSecret(raw.slice(7))
}

function getCraftAdminSecret() {
  return normalizeSecret(process.env.ADMIN_SECRET)
}

/** Vercel: ADMIN_SECRET_SHELLFISH_leaf0_01 등 + 선택적 ADMIN_SHELLFISH_SECRETS(쉼표 구분) */
function collectShellfishAdminSecrets() {
  const editors = []
  const seen = new Set()

  const push = (editor, secret) => {
    const norm = normalizeSecret(secret)
    if (!norm || seen.has(norm)) return
    seen.add(norm)
    editors.push({ editor, token: norm })
  }

  for (const [key, val] of Object.entries(process.env)) {
    if (!key.startsWith('ADMIN_SECRET_SHELLFISH_')) continue
    const editor = key.slice('ADMIN_SECRET_SHELLFISH_'.length)
    push(editor, val)
  }

  const bundled = normalizeSecret(process.env.ADMIN_SHELLFISH_SECRETS)
  if (bundled) {
    bundled.split(/[,;\n]+/).forEach((part, index) => {
      push(`shared_${index + 1}`, part)
    })
  }

  const single = normalizeSecret(process.env.ADMIN_SECRET_SHELLFISH)
  if (single) push('shellfish', single)

  return editors
}

function getShellfishAuthStatus() {
  const shellfish = collectShellfishAdminSecrets()
  return {
    craftConfigured: Boolean(getCraftAdminSecret()),
    shellfishSlotCount: shellfish.length,
    shellfishEditors: shellfish.map((s) => s.editor)
  }
}

/** 공예품 admin 전용 (전체 초기화·공예품 저장) */
function verifyCraftAdmin(req) {
  const expected = getCraftAdminSecret()
  if (!expected) return { ok: false, error: 'ADMIN_SECRET not configured' }
  const token = extractBearerToken(req)
  if (!token || token !== expected) return { ok: false, error: 'Unauthorized' }
  return { ok: true, role: 'craft', editor: 'owner' }
}

/** 어패류 시세 admin — ADMIN_SECRET(오너) 또는 ADMIN_SECRET_SHELLFISH_* */
function verifyShellfishAdmin(req) {
  const token = extractBearerToken(req)
  if (!token) return { ok: false, error: 'missing_token' }

  const craftSecret = getCraftAdminSecret()
  if (craftSecret && token === craftSecret) {
    return { ok: true, role: 'craft', editor: 'owner' }
  }

  for (const { editor, token: secret } of collectShellfishAdminSecrets()) {
    if (token === secret) {
      return { ok: true, role: 'shellfish', editor }
    }
  }

  const status = getShellfishAuthStatus()
  if (!status.craftConfigured && status.shellfishSlotCount === 0) {
    return { ok: false, error: 'not_configured', status }
  }
  return { ok: false, error: 'Unauthorized', status }
}

/** @deprecated — 공예품 API 호환 */
function verifyAdminSecret(req) {
  return verifyCraftAdmin(req)
}

module.exports = {
  extractBearerToken,
  normalizeSecret,
  getCraftAdminSecret,
  collectShellfishAdminSecrets,
  getShellfishAuthStatus,
  verifyCraftAdmin,
  verifyShellfishAdmin,
  verifyAdminSecret
}
