const {
  handleCors,
  sendJson,
  readJson,
  supabaseRest,
  randomCode,
  siteOrigin
} = require('../../_supabase');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'method_not_allowed' });

  try {
    const body = await readJson(req);
    const minecraftUuid = String(body.minecraftUuid || '').trim();
    const minecraftName = String(body.minecraftName || '').trim();
    if (!minecraftUuid || !minecraftName) {
      return sendJson(res, 400, { error: 'minecraft_identity_required' });
    }

    let code = randomCode();
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
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
    return sendJson(res, 500, { error: 'link_start_failed' });
  }
};
