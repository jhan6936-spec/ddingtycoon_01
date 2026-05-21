-- [구버전] JSON blob 저장 — craft_items 테이블로 대체됨. supabase_craft_items.sql 사용
-- 공예품 crafts.json 카탈로그 (Vercel admin 저장용)
create table if not exists public.site_catalog (
  id text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.site_catalog enable row level security;

-- 서비스 롤만 REST로 읽기/쓰기 (클라이언트 anon 접근 없음)
revoke all on public.site_catalog from anon, authenticated;
grant all on public.site_catalog to service_role;
