-- Supabase SQL Editor에서 한 번 실행하세요.
-- 로그인 사용자( Discord OAuth 등 )별 역할(user / admin)과 프로필 행을 관리합니다.

-- 1) 테이블
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'user' check (role in ('user', 'admin')),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles (role);

alter table public.profiles enable row level security;

-- 2) 신규 가입 시 자동으로 profiles 행 생성 (역할은 항상 user)
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role)
  values (new.id, 'user')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.handle_new_user_profile();

-- 3) 관리자 여부 (RLS에서 사용). SECURITY DEFINER로 profiles를 읽습니다.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

grant execute on function public.is_admin() to anon, authenticated;

-- 4) RLS 정책 (profiles)
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
drop policy if exists "profiles_insert_own_user_only" on public.profiles;
drop policy if exists "profiles_update_admin_only" on public.profiles;

-- 본인 행 또는 관리자만 조회
create policy "profiles_select_own_or_admin"
  on public.profiles for select
  using (id = auth.uid() or public.is_admin());

-- 직접 가입 시 백업용: 본인 id로만 삽입, 역할은 일반 유저만 허용 (트리거와 중복되어도 안전)
create policy "profiles_insert_own_user_only"
  on public.profiles for insert
  with check (auth.uid() = id and role = 'user');

-- 역할 변경 포함 모든 수정은 관리자만 (대시보드 SQL은 postgres 역할로 RLS 우회)
create policy "profiles_update_admin_only"
  on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());

-- 5) 첫 관리자 지정 (본인 Supabase Auth UUID로 바꾼 뒤 실행)
-- insert into public.profiles (id, role)
-- values ('여기에-본인-auth-users-의-uuid', 'admin')
-- on conflict (id) do update set role = 'admin', updated_at = now();

-- 이미 트리거로 user 행이 있다면:
-- update public.profiles set role = 'admin', updated_at = now()
-- where id = '여기에-본인-auth-users-의-uuid';

-- 6) 테이블 생성 전에 이미 가입한 사용자가 있다면(선택): 한 번 실행
-- insert into public.profiles (id, role)
-- select id, 'user' from auth.users
-- on conflict (id) do nothing;
