-- 기존 Supabase 프로젝트에 이미 테이블이 있을 때 한 번 실행 (연동 코드 발급 500 / restore 500 복구용)
alter table if exists public.minecraft_link_codes disable row level security;

grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on table public.minecraft_link_codes to service_role;
grant all on table public.minecraft_dashboard_snapshots to service_role;
