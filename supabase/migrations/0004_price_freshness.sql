-- =====================================================================
-- Priors — Slice 4
-- Price freshness tracking.
--
-- Upside and asymmetry are only meaningful relative to a price, and
-- val_current is frozen at whatever it was when the research file was
-- written. Without knowing WHEN it was set, the dashboard would quietly
-- show decaying numbers as if they were live.
--
-- Idempotent: safe to run more than once.
-- =====================================================================

alter table public.theses
  add column if not exists price_updated_at timestamptz;

-- Backfill: for rows that already carry a price, the best estimate of
-- when it was set is the row's last update.
update public.theses
set price_updated_at = updated_at
where val_current is not null and price_updated_at is null;

-- Stamp on insert, and on any update that actually changes the price.
-- `is distinct from` rather than `<>` so a null-to-value transition
-- counts as a change.
create or replace function public.stamp_price_updated()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if new.val_current is not null then
      new.price_updated_at := now();
    end if;
  elsif new.val_current is distinct from old.val_current then
    new.price_updated_at := case
      when new.val_current is null then null
      else now()
    end;
  end if;
  return new;
end $$;

drop trigger if exists theses_stamp_price on public.theses;
create trigger theses_stamp_price
  before insert or update on public.theses
  for each row execute function public.stamp_price_updated();

-- Note on trigger order: Postgres fires BEFORE triggers in alphabetical
-- order, so theses_stamp_price runs before theses_touch_updated_at.
-- They write different columns, so the order is immaterial — but if you
-- ever add a third, check that assumption.
