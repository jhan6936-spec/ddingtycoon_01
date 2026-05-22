-- 공예품 가격 이력 (장기 그래프용) — admin 저장할 때마다 자동 적재
-- supabase_craft_items.sql 실행 후 이 파일도 실행

create table if not exists public.craft_price_history (
  id bigserial primary key,
  craft_name text not null,
  price integer not null default 0,
  current_price integer,
  max_price integer,
  source text not null default 'admin',
  recorded_at timestamptz not null default now()
);

create index if not exists craft_price_history_name_time_idx
  on public.craft_price_history (craft_name, recorded_at desc);

create index if not exists craft_price_history_time_idx
  on public.craft_price_history (recorded_at desc);

alter table public.craft_price_history enable row level security;

drop policy if exists craft_price_history_public_read on public.craft_price_history;
create policy craft_price_history_public_read
  on public.craft_price_history
  for select
  to anon, authenticated
  using (true);

revoke all on public.craft_price_history from anon, authenticated;
grant select on public.craft_price_history to anon, authenticated;
grant all on public.craft_price_history to service_role;
