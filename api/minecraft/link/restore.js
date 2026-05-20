const {
  handleCors,
  sendJson,
  readJson,
  supabaseRest,
  classifySupabaseError
} = require('../../_supabase');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'method_not_allowed' });

  try {
    const body = await readJson(req);
    const minecraftUuid = String(body.minecraftUuid || '').trim();
    if (!minecraftUuid) {
      return sendJson(res, 400, { error: 'minecraft_identity_required' });
    }

    const rows = await supabaseRest(
      '/minecraft_link_codes'
        + `?minecraft_uuid=eq.${encodeURIComponent(minecraftUuid)}`
        + '&user_id=not.is.null'
        + '&access_token=not.is.null'
        + '&order=claimed_at.desc,created_at.desc'
        + '&limit=1'
        + '&select=access_token,user_id,claimed_at'
    );
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row || !row.access_token) {
      return sendJson(res, 200, { linked: false });
    }

    return sendJson(res, 200, { linked: true, accessToken: row.access_token });
  } catch (error) {
    console.error('[minecraft/link/restore]', error);
    const detail = classifySupabaseError(error);
    return sendJson(res, 500, {
      linked: false,
      error: 'link_restore_failed',
      code: detail.code,
      hint: detail.hint
    });
  }
};
