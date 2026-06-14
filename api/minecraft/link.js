/**
 * 마인크래프트 ↔ 웹 연동 (단일 Serverless Function)
 * ?action=start|status|restore|me|claim|unlink
 */
const {
  handleCors,
  sendJson,
  readJson,
  supabaseRest,
  getSupabaseUser,
  randomCode,
  randomToken,
  hashToken,
  siteOrigin,
  classifySupabaseError,
  getSupabaseConfigStatus
} = require('../_supabase')

function discordDisplayName(user) {
  if (!user) return ''
  const meta = user.user_metadata || {}
  return (
    meta.full_name ||
    meta.name ||
    meta.preferred_username ||
    meta.user_name ||
    meta.custom_claims?.global_name ||
    meta.custom_claims?.username ||
    user.email ||
    ''
  ).trim()
}

function getAction(req) {
  const url = new URL(req.url || '', 'http://localhost')
  return String(url.searchParams.get('action') || '').trim().toLowerCase()
}

async function handleStart(req, res) {
  const config = getSupabaseConfigStatus()
  if (!config.ok) {
    return sendJson(res, 503, {
      error: 'config_missing',
      missing: config.missing,
      hint: 'Vercel 환경 변수 SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY 를 설정하세요.'
    })
  }
  if (config.serviceKeyRole === 'anon') {
    return sendJson(res, 503, {
      error: 'service_key_is_anon',
      hint: 'SUPABASE_SERVICE_ROLE_KEY 에 service_role secret 이 아닌 anon 키가 설정되어 있습니다.'
    })
  }

  const body = await readJson(req)
  const minecraftUuid = String(body.minecraftUuid || '').trim()
  const minecraftName = String(body.minecraftName || '').trim()
  if (!minecraftUuid || !minecraftName) {
    return sendJson(res, 400, { error: 'minecraft_identity_required' })
  }

  let code = randomCode()
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()
      await supabaseRest('/minecraft_link_codes', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          code,
          minecraft_uuid: minecraftUuid,
          minecraft_name: minecraftName,
          expires_at: expiresAt
        })
      })
      break
    } catch (error) {
      if (attempt === 3) throw error
      code = randomCode()
    }
  }

  const url = `${siteOrigin(req)}/?minecraft_link_code=${encodeURIComponent(code)}`
  return sendJson(res, 200, { code, url })
}

async function handleStatus(req, res) {
  const query = new URL(req.url || '', 'http://localhost').searchParams
  const code = String(query.get('code') || '').trim().toUpperCase()
  if (!code) return sendJson(res, 400, { error: 'code_required' })

  const rows = await supabaseRest(
    `/minecraft_link_codes?code=eq.${encodeURIComponent(code)}&select=code,user_id,access_token,expires_at`
  )
  const row = Array.isArray(rows) ? rows[0] : null
  if (!row) {
    return sendJson(res, 404, { linked: false, error: 'code_not_found_or_expired' })
  }

  if (row.user_id && row.access_token) {
    return sendJson(res, 200, { linked: true, accessToken: row.access_token })
  }

  if (new Date(row.expires_at).getTime() < Date.now()) {
    return sendJson(res, 404, { linked: false, error: 'code_not_found_or_expired' })
  }

  return sendJson(res, 200, { linked: false })
}

async function handleRestore(req, res) {
  const body = await readJson(req)
  const minecraftUuid = String(body.minecraftUuid || '').trim()
  if (!minecraftUuid) {
    return sendJson(res, 400, { error: 'minecraft_identity_required' })
  }

  const rows = await supabaseRest(
    '/minecraft_link_codes' +
      `?minecraft_uuid=eq.${encodeURIComponent(minecraftUuid)}` +
      '&user_id=not.is.null' +
      '&access_token=not.is.null' +
      '&order=claimed_at.desc,created_at.desc' +
      '&limit=1' +
      '&select=access_token,user_id,claimed_at'
  )
  const row = Array.isArray(rows) ? rows[0] : null
  if (!row || !row.access_token) {
    return sendJson(res, 200, { linked: false })
  }

  return sendJson(res, 200, { linked: true, accessToken: row.access_token })
}

async function handleMe(req, res) {
  const user = await getSupabaseUser(req.headers.authorization || '')
  if (!user || !user.id) return sendJson(res, 401, { linked: false, error: 'login_required' })

  const rows = await supabaseRest(
    `/minecraft_link_codes?user_id=eq.${encodeURIComponent(user.id)}&access_token=not.is.null&select=minecraft_name,claimed_at&order=claimed_at.desc&limit=1`
  )
  const row = Array.isArray(rows) ? rows[0] : null
  if (!row) {
    return sendJson(res, 200, { linked: false, discordName: discordDisplayName(user) })
  }

  return sendJson(res, 200, {
    linked: true,
    discordName: discordDisplayName(user),
    minecraftName: row.minecraft_name || '',
    claimedAt: row.claimed_at || null
  })
}

async function clearUserLinks(userId) {
  await supabaseRest(`/minecraft_link_codes?user_id=eq.${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      access_token: null,
      access_token_hash: null
    })
  })
}

async function handleUnlink(req, res) {
  const authorization = req.headers.authorization || ''
  const bearer = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''

  const user = await getSupabaseUser(authorization)
  if (user && user.id) {
    await clearUserLinks(user.id)
    return sendJson(res, 200, { unlinked: true, scope: 'user' })
  }

  if (bearer) {
    const tokenHash = hashToken(bearer)
    await supabaseRest(
      `/minecraft_link_codes?access_token_hash=eq.${encodeURIComponent(tokenHash)}`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          access_token: null,
          access_token_hash: null
        })
      }
    )
    return sendJson(res, 200, { unlinked: true, scope: 'token' })
  }

  return sendJson(res, 401, { error: 'login_required' })
}

async function handleClaim(req, res) {
  const user = await getSupabaseUser(req.headers.authorization || '')
  if (!user || !user.id) return sendJson(res, 401, { error: 'login_required' })

  const body = await readJson(req)
  const code = String(body.code || '').trim().toUpperCase()
  if (!code) return sendJson(res, 400, { error: 'code_required' })

  const existing = await supabaseRest(
    `/minecraft_link_codes?code=eq.${encodeURIComponent(code)}&select=id,user_id,expires_at`
  )
  const row = Array.isArray(existing) ? existing[0] : null
  if (!row || new Date(row.expires_at).getTime() < Date.now()) {
    return sendJson(res, 404, { error: 'code_not_found_or_expired' })
  }
  if (row.user_id && row.user_id !== user.id) {
    return sendJson(res, 409, { error: 'code_already_claimed' })
  }

  await clearUserLinks(user.id)

  const token = randomToken()
  await supabaseRest(`/minecraft_link_codes?id=eq.${encodeURIComponent(row.id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      user_id: user.id,
      access_token: token,
      access_token_hash: hashToken(token),
      claimed_at: new Date().toISOString()
    })
  })

  let dashboardSaved = false
  if (body.dashboard && typeof body.dashboard === 'object') {
    try {
      await supabaseRest('/minecraft_dashboard_snapshots?on_conflict=user_id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({
          user_id: user.id,
          dashboard: body.dashboard,
          updated_at: new Date().toISOString()
        })
      })
      dashboardSaved = true
    } catch (error) {
      console.warn('[minecraft/link] dashboard snapshot save failed:', error)
    }
  }

  return sendJson(res, 200, { linked: true, dashboardSaved })
}

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return

  const action = getAction(req)
  if (!action) {
    return sendJson(res, 400, {
      error: 'action_required',
      hint: 'action=start|status|restore|me|claim|unlink'
    })
  }

  try {
    if (action === 'start') {
      if (req.method !== 'POST') return sendJson(res, 405, { error: 'method_not_allowed' })
      return await handleStart(req, res)
    }
    if (action === 'status') {
      if (req.method !== 'GET') return sendJson(res, 405, { error: 'method_not_allowed' })
      return await handleStatus(req, res)
    }
    if (action === 'restore') {
      if (req.method !== 'POST') return sendJson(res, 405, { error: 'method_not_allowed' })
      return await handleRestore(req, res)
    }
    if (action === 'me') {
      if (req.method !== 'GET') return sendJson(res, 405, { error: 'method_not_allowed' })
      return await handleMe(req, res)
    }
    if (action === 'claim') {
      if (req.method !== 'POST') return sendJson(res, 405, { error: 'method_not_allowed' })
      return await handleClaim(req, res)
    }
    if (action === 'unlink') {
      if (req.method !== 'POST') return sendJson(res, 405, { error: 'method_not_allowed' })
      return await handleUnlink(req, res)
    }
    return sendJson(res, 400, { error: 'unknown_action', action })
  } catch (error) {
    console.error('[minecraft/link]', action, error)
    const detail = classifySupabaseError(error)
    return sendJson(res, 500, {
      error: 'link_handler_failed',
      action,
      code: detail.code,
      hint: detail.hint,
      message: String(error.message || error)
    })
  }
}
