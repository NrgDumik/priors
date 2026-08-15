-- Priors schema. Run this once in the Supabase SQL editor for your project.

-- Core thesis record
create table theses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null,
  name text,
  currency text default '$',
  verdict text default 'Watchlist',      -- Watchlist | Buy | Hold | Avoid | Sold
  conviction numeric(2,1) default 3.0,   -- 1.0 to 5.0
  thesis text not null,
  kill_switch text not null,             -- required by design, not just convention
  val_bear numeric,
  val_base numeric,
  val_bull numeric,
  val_current numeric,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, ticker)
);

-- Key business questions
create table kbqs (
  id uuid primary key default gen_random_uuid(),
  thesis_id uuid not null references theses(id) on delete cascade,
  question text not null,
  confidence text default 'Moderate',    -- Low | Moderate | High
  status text default 'open',            -- open | resolved-positive | resolved-negative
  created_at timestamptz default now(),
  resolved_at timestamptz                -- used later for calibration scoring
);

-- Dated catalysts
create table triggers (
  id uuid primary key default gen_random_uuid(),
  thesis_id uuid not null references theses(id) on delete cascade,
  description text not null,
  due_date date,
  done boolean default false,
  notified_at timestamptz                -- prevents duplicate notification pings
);

-- Append-only log. The application should never UPDATE or DELETE rows here.
create table history (
  id uuid primary key default gen_random_uuid(),
  thesis_id uuid not null references theses(id) on delete cascade,
  note text not null,
  source text default 'manual',          -- manual | research | refresh
  conviction_at_time numeric(2,1),
  created_at timestamptz default now()
);

-- Queue for background research awaiting review before it's applied
create table pending_updates (
  id uuid primary key default gen_random_uuid(),
  thesis_id uuid not null references theses(id) on delete cascade,
  payload jsonb not null,
  status text default 'pending',         -- pending | applied | dismissed
  created_at timestamptz default now()
);

create index on theses(user_id);
create index on triggers(due_date) where done = false;
create index on pending_updates(status) where status = 'pending';

-- Row-level security: without this, your app URL is a public read/write
-- endpoint to your entire investment thinking. Do not skip this section.

alter table theses enable row level security;
alter table kbqs enable row level security;
alter table triggers enable row level security;
alter table history enable row level security;
alter table pending_updates enable row level security;

create policy "own theses" on theses
  for all using (auth.uid() = user_id);

create policy "own kbqs" on kbqs
  for all using (
    exists (
      select 1 from theses
      where theses.id = kbqs.thesis_id
      and theses.user_id = auth.uid()
    )
  );

create policy "own triggers" on triggers
  for all using (
    exists (
      select 1 from theses
      where theses.id = triggers.thesis_id
      and theses.user_id = auth.uid()
    )
  );

create policy "own history" on history
  for all using (
    exists (
      select 1 from theses
      where theses.id = history.thesis_id
      and theses.user_id = auth.uid()
    )
  );

create policy "own pending_updates" on pending_updates
  for all using (
    exists (
      select 1 from theses
      where theses.id = pending_updates.thesis_id
      and theses.user_id = auth.uid()
    )
  );
