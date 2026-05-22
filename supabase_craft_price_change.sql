-- 가격 변동(▲▼) 필드 추가
alter table public.craft_items
  add column if not exists price_change integer default null;

alter table public.craft_price_history
  add column if not exists price_change integer default null;
