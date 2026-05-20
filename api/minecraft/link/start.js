const {
  handleCors,
  sendJson,
  readJson,
  supabaseRest,
  randomCode,
  siteOrigin,
  classifySupabaseError,
  getSupabaseConfigStatus
} = require('../../_supabase');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'method_not_allowed' });

  try {
    const config = getSupabaseConfigStatus();
    if (!config.ok) {
      return sendJson(res, 503, {
        error: 'config_missing',
        missing: config.missing,
        hint: 'Vercel 환경 변수 SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY 를 설정하세요.'
      });
    }
    if (config.serviceKeyRole === 'anon') {
      return sendJson(res, 503, {
        error: 'service_key_is_anon',
        hint: 'SUPABASE_SERVICE_ROLE_KEY 에 service_role secret 이 아닌 anon 키가 설정되어 있습니다.'
      });
    }

    const body = await readJson(req);
    const minecraftUuid = String(body.minecraftUuid || '').trim();
    const minecraftName = String(body.minecraftName || '').trim();
    if (!minecraftUuid || !minecraftName) {
      return sendJson(res, 400, { error: 'minecraft_identity_required' });
    }

    let code = randomCode();
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
        await supabaseRest('/minecraft_link_codes', {
          method: 'POST',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({
            code,
            minecraft_uuid: minecraftUuid,
            minecraft_name: minecraftName,
            expires_at: expiresAt
          })
        });
        break;
      } catch (error) {
        if (attempt === 3) throw error;
        code = randomCode();
      }
    }

    const url = `${siteOrigin(req)}/?minecraft_link_code=${encodeURIComponent(code)}`;
    return sendJson(res, 200, { code, url });
  } catch (error) {
    console.error('[minecraft/link/start]', error);
    const detail = classifySupabaseError(error);
    return sendJson(res, 500, {
      error: 'link_start_failed',
      code: detail.code,
      hint: detail.hint
    });
  }
};
