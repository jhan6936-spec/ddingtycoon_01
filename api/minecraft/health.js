const { handleCors, sendJson, getSupabaseConfigStatus, probeSupabaseTables } = require('../_supabase');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'method_not_allowed' });

  try {
    const config = getSupabaseConfigStatus();
    if (!config.ok) {
      return sendJson(res, 503, {
        ok: false,
        error: 'config_missing',
        missing: config.missing,
        hint: 'Vercel 환경 변수 SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY 를 설정한 뒤 재배포하세요.'
      });
    }

    if (config.serviceKeyRole === 'anon') {
      return sendJson(res, 503, {
        ok: false,
        error: 'service_key_is_anon',
        serviceKeyRole: config.serviceKeyRole,
        hint: 'SUPABASE_SERVICE_ROLE_KEY 에 anon 키가 들어가 있습니다. Supabase 대시보드 Settings → API 의 service_role secret 을 사용하세요.'
      });
    }

    const tables = await probeSupabaseTables();
    const linkInsertOk = await tables.linkInsertOk;
    if (!tables.linkCodesReadable || !linkInsertOk) {
      return sendJson(res, 503, {
        ok: false,
        error: 'supabase_table_or_policy',
        serviceKeyRole: config.serviceKeyRole,
        tables,
        hint: 'Supabase SQL Editor에서 supabase_minecraft_link.sql 을 실행해 minecraft_link_codes / minecraft_dashboard_snapshots 테이블과 권한을 적용하세요.'
      });
    }

    return sendJson(res, 200, {
      ok: true,
      serviceKeyRole: config.serviceKeyRole,
      tables
    });
  } catch (error) {
    console.error('[minecraft/health]', error);
    return sendJson(res, 500, {
      ok: false,
      error: 'health_check_failed',
      message: String(error.message || error)
    });
  }
};
