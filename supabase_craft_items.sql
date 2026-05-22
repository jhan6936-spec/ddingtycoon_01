-- 공예품 실시간 DB (Git/Vercel 재배포 없이 admin OCR → 즉시 반영)
-- Supabase SQL Editor에서 전체 실행

create table if not exists public.craft_items (
  name text primary key,
  price integer not null default 0,
  current_price integer,
  max_price integer,
  time_minutes integer not null default 1,
  inputs jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists craft_items_sort_order_idx on public.craft_items (sort_order, name);

alter table public.craft_items enable row level security;

drop policy if exists craft_items_public_read on public.craft_items;
create policy craft_items_public_read
  on public.craft_items
  for select
  to anon, authenticated
  using (true);

revoke all on public.craft_items from anon, authenticated;
grant select on public.craft_items to anon, authenticated;
grant all on public.craft_items to service_role;

-- 초기 시드 (crafts.json 동일 데이터)
insert into public.craft_items (name, price, current_price, max_price, time_minutes, inputs, sort_order)
values
  ('조개껍데기 브로치', 47682, null, 50000, 1, '[{"name":"깨진 조개껍데기","count":1},{"name":"노란빛 진주","count":1},{"name":"금속 재활용품","count":1},{"name":"거미줄","count":4}]'::jsonb, 0),
  ('푸른 향수병', 89700, null, 150000, 1, '[{"name":"깨진 조개껍데기","count":2},{"name":"푸른빛 진주","count":1},{"name":"합성수지 재활용품","count":1},{"name":"플라스틱 재활용품","count":1},{"name":"양동이","count":8}]'::jsonb, 1),
  ('자개 손거울', 257671, null, 300000, 1, '[{"name":"깨진 조개껍데기","count":3},{"name":"청록빛 진주","count":1},{"name":"합금 재활용품","count":2},{"name":"플라스틱 재활용품","count":2},{"name":"유리판","count":16}]'::jsonb, 2),
  ('분홍 헤어핀', 456177, null, 500000, 1, '[{"name":"깨진 조개껍데기","count":4},{"name":"분홍빛 진주","count":1},{"name":"합성수지 재활용품","count":3},{"name":"섬유 재활용품","count":3},{"name":"대나무","count":64},{"name":"분홍 꽃잎","count":16}]'::jsonb, 3),
  ('자개 부채', 90580, null, 700000, 1, '[{"name":"깨진 조개껍데기","count":5},{"name":"보라빛 진주","count":1},{"name":"합금 재활용품","count":5},{"name":"합성수지 재활용품","count":5},{"name":"막대기","count":64},{"name":"자수정 조각","count":16}]'::jsonb, 4),
  ('흑진주 시계', 735064, null, 1000000, 1, '[{"name":"깨진 조개껍데기","count":7},{"name":"흑진주","count":1},{"name":"금속 재활용품","count":7},{"name":"합금 재활용품","count":7},{"name":"섬유 재활용품","count":7},{"name":"흑요석","count":16},{"name":"시계","count":8}]'::jsonb, 5)
on conflict (name) do update set
  price = excluded.price,
  current_price = excluded.current_price,
  max_price = excluded.max_price,
  time_minutes = excluded.time_minutes,
  inputs = excluded.inputs,
  sort_order = excluded.sort_order,
  updated_at = now();

-- 이력 테이블: supabase_craft_price_history.sql 도 함께 실행
