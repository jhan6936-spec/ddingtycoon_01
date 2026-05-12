-- 거래소·질문채널: 브라우저에서 다른 사람 글이 바로 보이게 하려면
-- trade_posts / qa_posts 변경을 Supabase Realtime으로 보내야 합니다.
--
-- 방법 A) Dashboard → Database → Publications → supabase_realtime
--         에서 trade_posts, qa_posts 테이블 체크
--
-- 방법 B) 아래를 SQL Editor에서 실행 (이미 publication에 있으면 오류 → 무시)

alter publication supabase_realtime add table public.trade_posts;
alter publication supabase_realtime add table public.qa_posts;
