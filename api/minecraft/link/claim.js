const {
  handleCors,
  sendJson,
  readJson,
  supabaseRest,
  getSupabaseUser,
  randomToken,
  hashToken
} = require('../../_supabase');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'method_not_allowed' });

  try {
    const user = await getSupabaseUser(req.headers.authorization || '');
    if (!user || !user.id) return sendJson(res, 401, { error: 'login_required' });

    const body = await readJson(req);
    const code = String(body.code || '').trim().toUpperCase();
    if (!code) return sendJson(res, 400, { error: 'code_required' });

    const existing = await supabaseRest(
      `/minecraft_link_codes?code=eq.${encodeURIComponent(code)}&select=id,user_id,expires_at`
    );
    const row = Array.isArray(existing) ? existing[0] : null;
    if (!row || new Date(row.expires_at).getTime() < Date.now()) {
      return sendJson(res, 404, { error: 'code_not_found_or_expired' });
    }
    if (row.user_id && row.user_id !== user.id) {
      return sendJson(res, 409, { error: 'code_already_claimed' });
    }

    const token = randomToken();
    await supabaseRest(`/minecraft_link_codes?id=eq.${encodeURIComponent(row.id)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        user_id: user.id,
        access_token: token,
        access_token_hash: hashToken(token),
        claimed_at: new Date().toISOString()
      })
    });

    if (body.dashboard && typeof body.dashboard === 'object') {
      await supabaseRest('/minecraft_dashboard_snapshots', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({
          user_id: user.id,
          dashboard: body.dashboard,
          updated_at: new Date().toISOString()
        })
      });
    }

    return sendJson(res, 200, { linked: true });
  } catch (error) {
    console.error('[minecraft/link/claim]', error);
    return sendJson(res, 500, { error: 'link_claim_failed' });
  }
};
