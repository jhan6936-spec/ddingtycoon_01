/**
 * 브라우저 전용 설정
 *
 * [Supabase Dashboard → Authentication → URL Configuration]
 *   - Redirect URLs 에 oauthRedirectUrl 과 동일한 한 줄 필수
 *   - Site URL 권장: https://ddingtycoon-01.vercel.app (루트)
 *
 * [Discord Developer Portal → OAuth2 → Redirects]
 *   - 반드시 아래 discordOAuthRedirectUri 추가 (Vercel 주소만으로는 Discord 단계에서 오류)
 *
 * [거래소·질문채널 DB 동기화]
 *   - Dashboard → Project Settings → API 의 Project URL 과
 *     Data API 키( publishable 또는 legacy anon JWT )를 anonKey 에 넣습니다.
 *   - Discord 로그인만 되고 trade_posts / qa_posts 에 행이 안 쌓이면,
 *     대시보드에 표시된 다른 종류의 키(예: legacy anon)로 바꿔 보세요.
 */
window.SUPABASE_CONFIG = {
  url: 'https://noavfecpraqoitsyzonr.supabase.co',
  anonKey: 'sb_publishable_G4hh4mTl27AsyZuTrDtH_A_wMQ0yPMM',
  oauthRedirectUrl: 'https://ddingtycoon-01.vercel.app/auth/callback',
  discordOAuthRedirectUri: 'https://noavfecpraqoitsyzonr.supabase.co/auth/v1/callback'
};
