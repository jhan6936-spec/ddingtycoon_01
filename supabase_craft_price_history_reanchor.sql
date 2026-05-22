-- craft_price_history 스냅샷을 5/21 03:00 KST부터 하루씩 재배치
-- (admin 「그래프 날짜 3시로 맞추기」와 동일한 결과)
-- Supabase SQL Editor에서 1회 실행

with distinct_times as (
  select recorded_at,
         row_number() over (order by recorded_at asc) - 1 as day_offset
  from (
    select distinct recorded_at
    from public.craft_price_history
    order by recorded_at asc
  ) t
),
mapped as (
  select
    recorded_at as old_at,
    (timestamptz '2026-05-21 03:00:00+09' + (day_offset || ' days')::interval) as new_at
  from distinct_times
)
update public.craft_price_history h
set recorded_at = m.new_at
from mapped m
where h.recorded_at = m.old_at;
