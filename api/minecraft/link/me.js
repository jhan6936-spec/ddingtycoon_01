const { handleCors, sendJson, supabaseRest, getSupabaseUser } = require('../../_supabase');

function discordDisplayName(user) {
  if (!user) return '';
  const meta = user.user_metadata || {};
  return (
    meta.full_name ||
    meta.name ||
    meta.preferred_username ||
    meta.user_name ||
    meta.custom_claims?.global_name ||
    meta.custom_claims?.username ||
    user.email ||
    ''
  ).trim();
}

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'method_not_allowed' });

  try {
    const user = await getSupabaseUser(req.headers.authorization || '');
    if (!user || !user.id) return sendJson(res, 401, { linked: false, error: 'login_required' });

    const rows = await supabaseRest(
      `/minecraft_link_codes?user_id=eq.${encodeURIComponent(user.id)}&access_token=not.is.null&select=minecraft_name,claimed_at&order=claimed_at.desc&limit=1`
    );
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) {
      return sendJson(res, 200, { linked: false, discordName: discordDisplayName(user) });
    }

    return sendJson(res, 200, {
      linked: true,
      discordName: discordDisplayName(user),
      minecraftName: row.minecraft_name || '',
      claimedAt: row.claimed_at || null
    });
  } catch (error) {
    console.error('[minecraft/link/me]', error);
    return sendJson(res, 500, { linked: false, error: 'link_me_failed' });
  }
};
