-- 어패류 매입가 (admin → 메인 연금 「매입 포함」 계산)
-- supabase_craft_items.sql 실행 후 이 파일도 실행

create table if not exists public.shellfish_buy_prices (
  item_name text primary key,
  buy_price integer not null default 0,
  updated_at timestamptz not null default now(),
  updated_by text
);

create index if not exists shellfish_buy_prices_updated_idx
  on public.shellfish_buy_prices (updated_at desc);

alter table public.shellfish_buy_prices enable row level security;

drop policy if exists shellfish_buy_prices_public_read on public.shellfish_buy_prices;
create policy shellfish_buy_prices_public_read
  on public.shellfish_buy_prices
  for select
  to anon, authenticated
  using (true);

revoke all on public.shellfish_buy_prices from anon, authenticated;
grant select on public.shellfish_buy_prices to anon, authenticated;
grant all on public.shellfish_buy_prices to service_role;

-- 15종 시드 (창고 키와 동일)
insert into public.shellfish_buy_prices (item_name, buy_price)
values
  ('굴 ★', 0), ('굴 ★★', 0), ('굴 ★★★', 0),
  ('소라 ★', 0), ('소라 ★★', 0), ('소라 ★★★', 0),
  ('문어 ★', 0), ('문어 ★★', 0), ('문어 ★★★', 0),
  ('미역 ★', 0), ('미역 ★★', 0), ('미역 ★★★', 0),
  ('성게 ★', 0), ('성게 ★★', 0), ('성게 ★★★', 0)
on conflict (item_name) do nothing;
