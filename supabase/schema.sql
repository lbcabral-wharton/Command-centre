-- ============================================================
-- Command Center — Supabase schema
-- Postgres. Run in Supabase SQL editor (or via migrations).
-- Single-user app; RLS locks every row to the authenticated owner.
-- ============================================================

-- Extensions
create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists pg_cron;       -- scheduled jobs
create extension if not exists pg_net;        -- http from cron (call edge fn)

-- ============================================================
-- ENUMS
-- ============================================================
create type task_status   as enum ('inbox','doing','waiting','done');
create type task_area     as enum ('health','home','family','admin','work','other');
create type priority      as enum ('low','medium','high');
create type venture_stage as enum ('idea','validating','building','active','paused','killed');
create type asset_class   as enum ('equity','etf','crypto','bond','cash','other');

-- ============================================================
-- PERSONAL: tasks & habits
-- ============================================================
create table tasks (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null default auth.uid() references auth.users(id),
  title       text not null,
  status      task_status not null default 'inbox',
  area        task_area   not null default 'other',
  priority    priority    not null default 'medium',
  due_date    date,
  notes       text,
  done_at     timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table habits (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null default auth.uid() references auth.users(id),
  name        text not null,
  cadence     text not null default 'daily',  -- daily | weekly
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table habit_logs (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null default auth.uid() references auth.users(id),
  habit_id    uuid not null references habits(id) on delete cascade,
  log_date    date not null default current_date,
  done        boolean not null default true,
  unique (habit_id, log_date)
);

-- ============================================================
-- FINANCE: holdings, price history, risk snapshots
-- ============================================================
create table holdings (
  id            uuid primary key default gen_random_uuid(),
  owner         uuid not null default auth.uid() references auth.users(id),
  ticker        text not null,
  name          text,
  asset_class   asset_class not null default 'equity',
  sector        text,
  geography     text,
  quantity      numeric(20,6) not null default 0,
  cost_basis    numeric(20,6) not null default 0,  -- per unit
  target_weight numeric(6,4),                      -- e.g. 0.10 = 10%
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (owner, ticker)
);

-- daily close price per ticker (time series; fed by the edge function)
create table prices (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null default auth.uid() references auth.users(id),
  ticker      text not null,
  price_date  date not null default current_date,
  close       numeric(20,6) not null,
  prev_close  numeric(20,6),
  unique (owner, ticker, price_date)
);

-- one risk snapshot per day for the whole portfolio
create table risk_snapshots (
  id                 uuid primary key default gen_random_uuid(),
  owner              uuid not null default auth.uid() references auth.users(id),
  snapshot_date      date not null default current_date,
  total_value        numeric(20,2) not null,
  day_pl             numeric(20,2),
  day_pl_pct         numeric(8,4),
  cash_pct           numeric(8,4),
  largest_position   text,
  largest_weight     numeric(8,4),
  top5_weight        numeric(8,4),
  peak_value         numeric(20,2),
  drawdown_pct       numeric(8,4),
  flags              jsonb default '[]'::jsonb,   -- ["concentration","drawdown"]
  created_at         timestamptz not null default now(),
  unique (owner, snapshot_date)
);

-- user-configurable risk limits (single row per owner)
create table risk_settings (
  owner            uuid primary key default auth.uid() references auth.users(id),
  max_position_pct numeric(6,4) not null default 0.10,   -- 10%
  max_top5_pct     numeric(6,4) not null default 0.40,   -- 40%
  max_drawdown_pct numeric(6,4) not null default 0.15,   -- 15%
  min_cash_pct     numeric(6,4) not null default 0.05,   -- 5%
  rebalance_band   numeric(6,4) not null default 0.05    -- drift from target
);

-- ============================================================
-- VENTURES
-- ============================================================
create table ventures (
  id                uuid primary key default gen_random_uuid(),
  owner             uuid not null default auth.uid() references auth.users(id),
  name              text not null,
  thesis            text,
  stage             venture_stage not null default 'idea',
  priority          priority not null default 'medium',
  next_action       text,
  next_action_date  date,
  invested          numeric(20,2) default 0,
  links             jsonb default '[]'::jsonb,
  last_update       timestamptz not null default now(),
  created_at        timestamptz not null default now()
);

create table venture_log (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null default auth.uid() references auth.users(id),
  venture_id  uuid not null references ventures(id) on delete cascade,
  entry       text not null,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- LANDING: daily brief written by the edge function each morning
-- ============================================================
create table daily_brief (
  id            uuid primary key default gen_random_uuid(),
  owner         uuid not null default auth.uid() references auth.users(id),
  brief_date    date not null default current_date,
  summary       text,                       -- the 3-5 line narrative
  flags         jsonb default '[]'::jsonb,  -- cross-section high-priority items
  created_at    timestamptz not null default now(),
  unique (owner, brief_date)
);

-- ============================================================
-- updated_at trigger
-- ============================================================
create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end; $$ language plpgsql;

create trigger trg_tasks_upd    before update on tasks    for each row execute function set_updated_at();
create trigger trg_holdings_upd before update on holdings for each row execute function set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY  (each user sees only their own rows)
-- ============================================================
alter table tasks          enable row level security;
alter table habits         enable row level security;
alter table habit_logs     enable row level security;
alter table holdings       enable row level security;
alter table prices         enable row level security;
alter table risk_snapshots enable row level security;
alter table risk_settings  enable row level security;
alter table ventures       enable row level security;
alter table venture_log    enable row level security;
alter table daily_brief    enable row level security;

-- one generic owner policy per table
do $$
declare t text;
begin
  foreach t in array array[
    'tasks','habits','habit_logs','holdings','prices','risk_snapshots',
    'risk_settings','ventures','venture_log','daily_brief'
  ]
  loop
    execute format($f$
      create policy owner_all on %I
      for all using (owner = auth.uid())
      with check (owner = auth.uid());
    $f$, t);
  end loop;
end $$;

-- ============================================================
-- HELPER VIEW: live portfolio with current value & weights
-- ============================================================
create or replace view portfolio_live as
with latest as (
  select distinct on (owner, ticker) owner, ticker, close, prev_close
  from prices order by owner, ticker, price_date desc
)
select
  h.owner, h.ticker, h.name, h.asset_class, h.sector, h.geography,
  h.quantity, h.cost_basis, h.target_weight,
  l.close                                   as price,
  h.quantity * l.close                      as market_value,
  h.quantity * (l.close - l.prev_close)     as day_pl,
  h.quantity * (l.close - h.cost_basis)     as total_pl
from holdings h
left join latest l on l.owner = h.owner and l.ticker = h.ticker;

-- ============================================================
-- SCHEDULE: call the daily-refresh edge function every weekday 06:00
-- (replace <PROJECT_REF> and use a stored service key / secret)
-- ============================================================
-- select cron.schedule(
--   'daily-refresh', '0 6 * * 1-5',
--   $$
--   select net.http_post(
--     url := 'https://<PROJECT_REF>.functions.supabase.co/daily-refresh',
--     headers := jsonb_build_object(
--       'Content-Type','application/json',
--       'Authorization','Bearer ' || current_setting('app.service_key', true)
--     ),
--     body := '{}'::jsonb
--   );
--   $$
-- );
