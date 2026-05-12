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

-- 직접 SELECT가 RLS·역할 설정으로 막혀도, 클라이언트가 전체 글을 읽을 수 있게 RPC로 조회 (SECURITY DEFINER).
create or replace function public.trade_fetch_posts()
returns table (id text, payload jsonb, updated_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.payload, t.updated_at
  from public.trade_posts t
  order by t.updated_at desc;
$$;

grant execute on function public.trade_fetch_posts() to anon, authenticated;
