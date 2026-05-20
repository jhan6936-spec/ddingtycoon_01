create extension if not exists pgcrypto;

create table if not exists public.minecraft_link_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  minecraft_uuid text not null,
  minecraft_name text not null,
  user_id uuid references auth.users(id) on delete cascade,
  access_token text,
  access_token_hash text,
  expires_at timestamptz not null,
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists minecraft_link_codes_token_hash_idx
  on public.minecraft_link_codes(access_token_hash);

create index if not exists minecraft_link_codes_uuid_claimed_idx
  on public.minecraft_link_codes(minecraft_uuid, claimed_at desc);

create table if not exists public.minecraft_dashboard_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  dashboard jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- link_codes: Vercel API(service_role)만 접근. RLS를 켜면 anon 키 오설정 시 INSERT가 막혀 연동 코드 발급이 500으로 실패합니다.
alter table public.minecraft_link_codes disable row level security;

alter table public.minecraft_dashboard_snapshots enable row level security;

grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on table public.minecraft_link_codes to service_role;
grant all on table public.minecraft_dashboard_snapshots to service_role;

drop policy if exists "minecraft dashboard owner read" on public.minecraft_dashboard_snapshots;
create policy "minecraft dashboard owner read"
  on public.minecraft_dashboard_snapshots
  for select
  using (auth.uid() = user_id);

drop policy if exists "minecraft dashboard owner upsert" on public.minecraft_dashboard_snapshots;
create policy "minecraft dashboard owner upsert"
  on public.minecraft_dashboard_snapshots
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "minecraft dashboard owner update" on public.minecraft_dashboard_snapshots;
create policy "minecraft dashboard owner update"
  on public.minecraft_dashboard_snapshots
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
