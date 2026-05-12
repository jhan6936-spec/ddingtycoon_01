-- Supabase SQL Editor에서 한 번 실행하세요.
-- 질문채널 글을 모든 방문자가 읽고 쓸 수 있게 하는 예시 정책(공개 게시판용).

create table if not exists public.qa_posts (
  id text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists qa_posts_updated_at_idx on public.qa_posts (updated_at desc);

alter table public.qa_posts enable row level security;

drop policy if exists "qa_posts_select_all" on public.qa_posts;
drop policy if exists "qa_posts_insert_all" on public.qa_posts;
drop policy if exists "qa_posts_update_all" on public.qa_posts;
drop policy if exists "qa_posts_delete_all" on public.qa_posts;

create policy "qa_posts_select_all" on public.qa_posts for select using (true);
create policy "qa_posts_insert_all" on public.qa_posts for insert with check (true);
create policy "qa_posts_update_all" on public.qa_posts for update using (true);
create policy "qa_posts_delete_all" on public.qa_posts for delete using (true);

create or replace function public.qa_fetch_posts()
returns table (id text, payload jsonb, updated_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select q.id, q.payload, q.updated_at
  from public.qa_posts q
  order by q.updated_at desc;
$$;

grant execute on function public.qa_fetch_posts() to anon, authenticated;
