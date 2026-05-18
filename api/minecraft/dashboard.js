const { handleCors, sendJson, supabaseRest, hashToken } = require('../_supabase');

const fallbackDashboard = {
  craftingQueueTitle: '웹 연동 대기',
  materialLine: 'Discord 로그인 후 연동 코드를 입력하세요',
  materialCurrent: 0,
  materialTarget: 1,
  efficiencyResult: '효율 정보 없음',
  expectedProfit: '예상 수익 없음',
  expertBonusLine: '웹 전문가 보정 없음',
  captainLog: ['웹사이트 계산 결과가 아직 저장되지 않았습니다.'],
  completionLog: ['띵타해 웹 연동 대기중'],
  resourceLines: ['Discord 로그인 후 재료 계산을 저장하세요'],
  routeLines: ['제작 목표 저장 후 추천 항로가 표시됩니다'],
  activityLines: ['웹 연동 대기중'],
  crewWebsite: '웹사이트 미연결',
  crewSync: '동기화 대기',
  crewApi: 'API 설정 필요',
  crewPlayer: '미등록 선장',
  crewContract: '계약 대기',
  durability: 100,
  fuel: 100,
  food: '0일',
  sailingState: '연동 대기'
};

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'method_not_allowed' });

  try {
    const authorization = req.headers.authorization || '';
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
    if (!token) return sendJson(res, 401, { error: 'token_required' });

    const tokenHash = hashToken(token);
    const links = await supabaseRest(
      `/minecraft_link_codes?access_token_hash=eq.${encodeURIComponent(tokenHash)}&select=user_id`
    );
    const link = Array.isArray(links) ? links[0] : null;
    if (!link || !link.user_id) {
      return sendJson(res, 401, { error: 'invalid_token' });
    }

    const rows = await supabaseRest(
      `/minecraft_dashboard_snapshots?user_id=eq.${encodeURIComponent(link.user_id)}&select=dashboard,updated_at`
    );
    const row = Array.isArray(rows) ? rows[0] : null;
    return sendJson(res, 200, row && row.dashboard ? row.dashboard : fallbackDashboard);
  } catch (error) {
    console.error('[minecraft/dashboard]', error);
    return sendJson(res, 500, { error: 'dashboard_fetch_failed' });
  }
};
