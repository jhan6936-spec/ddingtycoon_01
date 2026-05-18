const { handleCors, sendJson, supabaseRest } = require('../../_supabase');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'method_not_allowed' });

  try {
    const query = new URL(req.url, 'http://local').searchParams;
    const code = String(query.get('code') || '').trim().toUpperCase();
    if (!code) return sendJson(res, 400, { error: 'code_required' });

    const rows = await supabaseRest(
      `/minecraft_link_codes?code=eq.${encodeURIComponent(code)}&select=code,user_id,access_token,expires_at`
    );
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) {
      return sendJson(res, 404, { linked: false, error: 'code_not_found_or_expired' });
    }

    if (row.user_id && row.access_token) {
      return sendJson(res, 200, { linked: true, accessToken: row.access_token });
    }

    if (new Date(row.expires_at).getTime() < Date.now()) {
      return sendJson(res, 404, { linked: false, error: 'code_not_found_or_expired' });
    }

    if (!row.user_id || !row.access_token) {
      return sendJson(res, 200, { linked: false });
    }
  } catch (error) {
    console.error('[minecraft/link/status]', error);
    return sendJson(res, 500, { linked: false, error: 'link_status_failed' });
  }
};
