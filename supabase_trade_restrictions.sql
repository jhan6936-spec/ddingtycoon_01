-- Supabase SQL Editor에서 실행하세요.
-- 거래소: 로그인 사용자·게스트별 활동 정지(시간/무기한) 및 관리자 조정용.

create table if not exists public.trade_user_restrictions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  indefinite boolean not null default false,
  suspended_until timestamptz,
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);

create table if not exists public.trade_guest_restrictions (
  guest_key text primary key,
  indefinite boolean not null default false,
  suspended_until timestamptz,
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);

alter table public.trade_user_restrictions enable row level security;
alter table public.trade_guest_restrictions enable row level security;

drop policy if exists "trade_user_restrictions_select_own" on public.trade_user_restrictions;
drop policy if exists "trade_user_restrictions_admin_all" on public.trade_user_restrictions;

create policy "trade_user_restrictions_select_own"
  on public.trade_user_restrictions for select
  using (auth.uid() = user_id or public.is_admin());

create policy "trade_user_restrictions_admin_all"
  on public.trade_user_restrictions for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "trade_guest_restrictions_admin_all" on public.trade_guest_restrictions;

create policy "trade_guest_restrictions_admin_all"
  on public.trade_guest_restrictions for all
  using (public.is_admin())
  with check (public.is_admin());

-- 클라이언트(anon 포함)가 본인 제재 여부만 조회 — 행 노출 없이 JSON 반환
create or replace function public.trade_me_restriction_status(p_guest_key text default null)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  r record;
begin
  if uid is not null then
    select * into r from public.trade_user_restrictions where user_id = uid;
    if found then
      if r.indefinite or (r.suspended_until is not null and r.suspended_until > now()) then
        return json_build_object(
          'active', true,
          'indefinite', r.indefinite,
          'until', r.suspended_until
        );
      end if;
    end if;
    return json_build_object('active', false, 'indefinite', false, 'until', null);
  end if;

  if p_guest_key is not null and length(trim(p_guest_key)) > 0 then
    select * into r from public.trade_guest_restrictions where guest_key = trim(p_guest_key);
    if found then
      if r.indefinite or (r.suspended_until is not null and r.suspended_until > now()) then
        return json_build_object(
          'active', true,
          'indefinite', r.indefinite,
          'until', r.suspended_until
        );
      end if;
    end if;
  end if;

  return json_build_object('active', false, 'indefinite', false, 'until', null);
end;
$$;

grant execute on function public.trade_me_restriction_status(text) to anon, authenticated;
