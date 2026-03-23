create table mutants (
  id uuid primary key default gen_random_uuid(),
  agent_id integer unique,
  owner_address text,
  name text,
  description text,
  image_url text,
  image_prompt text,
  genome jsonb not null,
  bankroll numeric default 0,
  reserved_margin numeric default 0,
  high_water_mark numeric default 0,
  pnl numeric default 0,
  fitness float default 0,
  capital_allocation numeric default 1.0 check (capital_allocation >= 0),
  generation integer default 0,
  parent_ids uuid[],
  lifecycle_status text default 'active',
  trades_today integer default 0,
  last_trade_at timestamptz,
  last_evaluated_at timestamptz,
  last_signal_status text,
  halt_reason text,
  revival_count integer default 0,
  last_revival_at timestamptz,
  novelty_score float default 0,
  correlation_score float default 0,
  created_at timestamptz default now()
);

create table trades (
  id uuid primary key default gen_random_uuid(),
  mutant_id uuid references mutants(id),
  tx_hash text,
  bankr_job_id text,
  action text,
  asset text,
  amount float,
  leverage float,
  entry_price float,
  exit_price float,
  stop_loss_price float,
  take_profit_price float,
  pnl float,
  reasoning text,
  created_at timestamptz default now()
);

create table evolution_logs (
  id uuid primary key default gen_random_uuid(),
  generation integer not null,
  elite_ids uuid[],
  survivor_ids uuid[],
  offspring_ids uuid[],
  axed_ids uuid[],
  tier_counts jsonb,
  mutations jsonb,
  avg_fitness float,
  created_at timestamptz default now()
);

create table tx_queue (
  id uuid primary key default gen_random_uuid(),
  type text,
  payload jsonb,
  status text default 'pending',
  tx_hash text,
  nonce integer,
  created_at timestamptz default now(),
  processed_at timestamptz
);

-- Storage bucket for trader assets (images, etc.)
insert into storage.buckets (id, name, public)
values ('trader-assets', 'trader-assets', true);

-- Public read policy for trader-assets bucket
create policy "Public read access for trader-assets"
  on storage.objects for select
  using (bucket_id = 'trader-assets');
