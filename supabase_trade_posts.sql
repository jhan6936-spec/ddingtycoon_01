-- Supabase SQL Editor에서 한 번 실행하세요.
-- 거래소 글을 모든 방문자가 읽고 쓸 수 있게 하는 예시 정책(공개 게시판용).

create table if not exists public.trade_posts (
  id text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists trade_posts_updated_at_idx on public.trade_posts (updated_at desc);

alter table public.trade_posts enable row level security;

drop policy if exists "trade_posts_select_all" on public.trade_posts;
drop policy if exists "trade_posts_insert_all" on public.trade_posts;
drop policy if exists "trade_posts_update_all" on public.trade_posts;
drop policy if exists "trade_posts_delete_all" on public.trade_posts;

create policy "trade_posts_select_all" on public.trade_posts for select using (true);
create policy "trade_posts_insert_all" on public.trade_posts for insert with check (true);
create policy "trade_posts_update_all" on public.trade_posts for update using (true);
create policy "trade_posts_delete_all" on public.trade_posts for delete using (true);
