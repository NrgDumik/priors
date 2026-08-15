-- =====================================================================
-- Priors — Slice 3
-- Reconciled against the live Slice 2 schema (checked 2026-08-15).
--
-- Adds only what is genuinely missing:
--   kbqs.sort_order
--   triggers.sort_order, triggers.created_at
--   history.snapshot
--
-- Adopts the columns Slice 2 already had rather than duplicating them:
--   history.source            <- used as the entry type (was going to be `event`)
--   history.conviction_at_time <- auto-stamped by trigger
--   kbqs.resolved_at           <- auto-stamped by trigger
--
-- Idempotent: safe to run more than once.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Pre-flight. The unique index below cannot be created if you already
--    have two theses with the same ticker. This surfaces that first.
-- ---------------------------------------------------------------------

do $$
declare v_dupes text;
begin
  select string_agg(ticker, ', ') into v_dupes
  from (
    select upper(ticker) as ticker
    from public.theses
    group by user_id, upper(ticker)
    having count(*) > 1
  ) d;

  if v_dupes is not null then
    raise exception
      'Duplicate tickers exist and must be merged before this migration: %',
      v_dupes;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Missing columns
-- ---------------------------------------------------------------------

alter table public.kbqs
  add column if not exists sort_order int not null default 0;

alter table public.triggers
  add column if not exists sort_order int not null default 0,
  add column if not exists created_at timestamptz not null default now();

alter table public.history
  add column if not exists snapshot jsonb;

-- ---------------------------------------------------------------------
-- 2. Nullability. Slice 2 left several columns nullable that the app
--    treats as always-present. Backfill, then tighten, so the TypeScript
--    row types are actually true rather than optimistic.
-- ---------------------------------------------------------------------

update public.theses set
  name       = coalesce(name, ticker),
  currency   = coalesce(currency, '$'),
  verdict    = coalesce(verdict, 'Watchlist'),
  conviction = coalesce(conviction, 3),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now())
where name is null or currency is null or verdict is null
   or conviction is null or created_at is null or updated_at is null;

alter table public.theses
  alter column name       set default '',
  alter column name       set not null,
  alter column currency   set default '$',
  alter column currency   set not null,
  alter column verdict    set default 'Watchlist',
  alter column verdict    set not null,
  alter column conviction set default 3,
  alter column conviction set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

update public.kbqs set
  confidence = coalesce(confidence, 'Moderate'),
  status     = coalesce(status, 'open'),
  created_at = coalesce(created_at, now())
where confidence is null or status is null or created_at is null;

alter table public.kbqs
  alter column confidence set default 'Moderate',
  alter column confidence set not null,
  alter column status     set default 'open',
  alter column status     set not null,
  alter column created_at set default now(),
  alter column created_at set not null;

update public.triggers set done = coalesce(done, false) where done is null;

alter table public.triggers
  alter column done set default false,
  alter column done set not null;

update public.history set
  source     = coalesce(source, 'note'),
  created_at = coalesce(created_at, now())
where source is null or created_at is null;

alter table public.history
  alter column source     set default 'note',
  alter column source     set not null,
  alter column created_at set default now(),
  alter column created_at set not null;

-- ---------------------------------------------------------------------
-- 3. Constraints and indexes
-- ---------------------------------------------------------------------

-- One thesis per ticker per user. This is what makes "overwrite in
-- place" a well-defined operation.
create unique index if not exists theses_user_ticker_uniq
  on public.theses (user_id, upper(ticker));

create index if not exists kbqs_thesis_idx     on public.kbqs (thesis_id);
create index if not exists triggers_thesis_idx on public.triggers (thesis_id);
create index if not exists history_thesis_idx  on public.history (thesis_id, created_at desc);

do $$
begin
  -- A thesis without a kill switch is a hope, not a thesis.
  if not exists (select 1 from pg_constraint where conname = 'theses_kill_switch_not_blank') then
    alter table public.theses add constraint theses_kill_switch_not_blank
      check (length(btrim(kill_switch)) > 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'theses_verdict_valid') then
    alter table public.theses add constraint theses_verdict_valid
      check (verdict in ('Watchlist', 'Buy', 'Hold', 'Avoid', 'Sold'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'theses_conviction_range') then
    alter table public.theses add constraint theses_conviction_range
      check (conviction >= 1 and conviction <= 5);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'kbqs_status_valid') then
    alter table public.kbqs add constraint kbqs_status_valid
      check (status in ('open', 'resolved-positive', 'resolved-negative'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'kbqs_confidence_valid') then
    alter table public.kbqs add constraint kbqs_confidence_valid
      check (confidence in ('Low', 'Moderate', 'High'));
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 4. Triggers that keep the Slice 2 bonus columns populated
-- ---------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists theses_touch_updated_at on public.theses;
create trigger theses_touch_updated_at
  before update on public.theses
  for each row execute function public.touch_updated_at();

-- history.conviction_at_time: stamp the parent thesis's conviction as it
-- stands at insert time, so the log doubles as a conviction time series.
create or replace function public.stamp_history_conviction()
returns trigger language plpgsql as $$
begin
  if new.conviction_at_time is null then
    select conviction into new.conviction_at_time
    from public.theses where id = new.thesis_id;
  end if;
  return new;
end $$;

drop trigger if exists history_stamp_conviction on public.history;
create trigger history_stamp_conviction
  before insert on public.history
  for each row execute function public.stamp_history_conviction();

-- kbqs.resolved_at: set when a question leaves 'open', cleared if it
-- returns. Means the app never has to remember to maintain it.
create or replace function public.stamp_kbq_resolved()
returns trigger language plpgsql as $$
begin
  if new.status = 'open' then
    new.resolved_at := null;
  elsif tg_op = 'INSERT' or old.status is distinct from new.status then
    new.resolved_at := now();
  end if;
  return new;
end $$;

drop trigger if exists kbqs_stamp_resolved on public.kbqs;
create trigger kbqs_stamp_resolved
  before insert or update on public.kbqs
  for each row execute function public.stamp_kbq_resolved();

-- ---------------------------------------------------------------------
-- 5. import_thesis(payload jsonb) -> uuid
--
--    SECURITY INVOKER: RLS still applies; the caller can only touch rows
--    they already own. One statement from the client, so a partial
--    failure rolls the whole thing back — no orphan KBQs.
--
--    Existing ticker -> snapshot current state into history, then
--                       overwrite the thesis and replace KBQs/triggers.
--    New ticker      -> insert.
-- ---------------------------------------------------------------------

create or replace function public.import_thesis(payload jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user      uuid := auth.uid();
  v_ticker    text;
  v_thesis_id uuid;
  v_existing  public.theses%rowtype;
  v_snapshot  jsonb;
  v_summary   text;
  v_kill      jsonb;
  v_item      jsonb;
  v_idx       int := 0;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  v_ticker := upper(btrim(coalesce(payload ->> 'ticker', '')));
  if v_ticker = '' then
    raise exception 'ticker is required' using errcode = '22023';
  end if;

  -- Defence in depth: the client validates with Zod, but the database
  -- refuses a thesis with no way to be proven wrong regardless.
  v_kill := coalesce(payload #> '{thesis,kill_switch}', 'null'::jsonb);
  if jsonb_typeof(v_kill) <> 'string'
     or length(btrim(v_kill #>> '{}')) = 0 then
    raise exception 'kill_switch is required and must be a non-empty string'
      using errcode = '22023';
  end if;

  select * into v_existing
  from public.theses
  where user_id = v_user and upper(ticker) = v_ticker;

  if found then
    v_thesis_id := v_existing.id;

    v_snapshot := jsonb_build_object(
      'thesis', to_jsonb(v_existing),
      'kbqs', coalesce((
        select jsonb_agg(to_jsonb(k) order by k.sort_order, k.created_at)
        from public.kbqs k where k.thesis_id = v_thesis_id), '[]'::jsonb),
      'triggers', coalesce((
        select jsonb_agg(to_jsonb(t) order by t.sort_order, t.created_at)
        from public.triggers t where t.thesis_id = v_thesis_id), '[]'::jsonb)
    );

    -- Inserted BEFORE the update, so conviction_at_time captures the
    -- conviction being replaced rather than the incoming one.
    insert into public.history (thesis_id, note, source, snapshot)
    values (
      v_thesis_id,
      format('Replaced by import. Previous: %s, conviction %s.',
             v_existing.verdict, v_existing.conviction),
      'import_overwrite',
      v_snapshot
    );

    update public.theses set
      name        = coalesce(nullif(payload ->> 'company', ''), name),
      currency    = coalesce(nullif(payload ->> 'currency', ''), currency),
      verdict     = coalesce(nullif(payload #>> '{thesis,verdict}', ''), verdict),
      conviction  = coalesce((payload #>> '{thesis,conviction}')::numeric, conviction),
      thesis      = coalesce(nullif(payload #>> '{thesis,one_liner}', ''), thesis),
      kill_switch = payload #>> '{thesis,kill_switch}',
      val_bear    = (payload #>> '{valuation,bear}')::numeric,
      val_base    = (payload #>> '{valuation,base}')::numeric,
      val_bull    = (payload #>> '{valuation,bull}')::numeric,
      val_current = (payload #>> '{valuation,current_price}')::numeric
    where id = v_thesis_id;

    delete from public.kbqs     where thesis_id = v_thesis_id;
    delete from public.triggers where thesis_id = v_thesis_id;

  else
    insert into public.theses (
      user_id, ticker, name, currency, verdict, conviction,
      thesis, kill_switch, val_bear, val_base, val_bull, val_current
    ) values (
      v_user,
      v_ticker,
      coalesce(nullif(payload ->> 'company', ''), v_ticker),
      coalesce(nullif(payload ->> 'currency', ''), '$'),
      coalesce(nullif(payload #>> '{thesis,verdict}', ''), 'Watchlist'),
      coalesce((payload #>> '{thesis,conviction}')::numeric, 3),
      coalesce(payload #>> '{thesis,one_liner}', ''),
      payload #>> '{thesis,kill_switch}',
      (payload #>> '{valuation,bear}')::numeric,
      (payload #>> '{valuation,base}')::numeric,
      (payload #>> '{valuation,bull}')::numeric,
      (payload #>> '{valuation,current_price}')::numeric
    )
    returning id into v_thesis_id;

    insert into public.history (thesis_id, note, source)
    values (v_thesis_id, 'Thesis created by import.', 'import_create');
  end if;

  -- KBQs. sort_order carries file order: now() is transaction time and
  -- is identical for every row inserted here, so created_at alone cannot
  -- break the tie.
  v_idx := 0;
  for v_item in select * from jsonb_array_elements(coalesce(payload -> 'kbqs', '[]'::jsonb))
  loop
    insert into public.kbqs (thesis_id, question, confidence, status, sort_order)
    values (
      v_thesis_id,
      v_item ->> 'question',
      coalesce(nullif(v_item ->> 'confidence', ''), 'Moderate'),
      coalesce(nullif(v_item ->> 'status', ''), 'open'),
      v_idx
    );
    v_idx := v_idx + 1;
  end loop;

  v_idx := 0;
  for v_item in select * from jsonb_array_elements(coalesce(payload -> 'triggers', '[]'::jsonb))
  loop
    insert into public.triggers (thesis_id, description, due_date, sort_order)
    values (
      v_thesis_id,
      v_item ->> 'description',
      nullif(v_item ->> 'date', '')::date,
      v_idx
    );
    v_idx := v_idx + 1;
  end loop;

  -- Research summary becomes the top history entry.
  v_summary := btrim(coalesce(payload ->> 'summary', ''));
  if v_summary <> '' then
    insert into public.history (thesis_id, note, source)
    values (v_thesis_id, v_summary, 'research');
  end if;

  -- Full report, if one was uploaded alongside the JSON.
  if btrim(coalesce(payload ->> 'report_md', '')) <> '' then
    insert into public.history (thesis_id, note, source, snapshot)
    values (
      v_thesis_id,
      'Research report attached.',
      'report',
      jsonb_build_object('report_md', payload ->> 'report_md')
    );
  end if;

  return v_thesis_id;
end $$;

revoke all on function public.import_thesis(jsonb) from public;
grant execute on function public.import_thesis(jsonb) to authenticated;
