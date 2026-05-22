-- 공예품 최고가 상한 고정값 (게임 내 최대 시세)
-- Supabase SQL Editor에서 실행 후 admin 「레시피 위키 기준 복구」 또는 시세 스크린샷 재업로드

update public.craft_items set max_price = 50000, updated_at = now() where name = '조개껍데기 브로치';
update public.craft_items set max_price = 150000, updated_at = now() where name = '푸른 향수병';
update public.craft_items set max_price = 300000, updated_at = now() where name = '자개 손거울';
update public.craft_items set max_price = 500000, updated_at = now() where name = '분홍 헤어핀';
update public.craft_items set max_price = 700000, updated_at = now() where name = '자개 부채';
update public.craft_items set max_price = 1000000, updated_at = now() where name = '흑진주 시계';

-- 오염된 현재 시세 복구 (시세+퍼센트 붙은 값 → /1000)
update public.craft_items set current_price = floor(current_price / 1000), updated_at = now()
where current_price > max_price * 2 and max_price > 0;
