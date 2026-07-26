-- Hangar Log — database setup
-- Paste this whole file into the Supabase SQL Editor and press Run. Once only.

-- ---------------------------------------------------------------- aircraft
create table if not exists public.aircraft (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users on delete cascade,
  airline       text not null,
  type          text not null,
  reg           text,
  contract_date date,
  in_at         timestamptz,
  out_at        timestamptz,
  amount        numeric(14,2),
  currency      text not null default 'GHS',
  notes         text,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------- jobs
create table if not exists public.jobs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  aircraft_id  uuid not null references public.aircraft(id) on delete cascade,
  job_date     date,
  job_type     text,
  performed_by text,
  hours        numeric(8,1),
  status       text,
  description  text,
  created_at   timestamptz not null default now()
);

create index if not exists jobs_aircraft_id_idx on public.jobs (aircraft_id);
create index if not exists aircraft_user_id_idx on public.aircraft (user_id);
create index if not exists jobs_user_id_idx     on public.jobs (user_id);

-- ------------------------------------------------- lock it to your account
-- Row Level Security: every query is filtered to the signed-in user.
-- Without this, anyone who found your web address could read your contract
-- amounts. Do not skip it.

alter table public.aircraft enable row level security;
alter table public.jobs     enable row level security;

drop policy if exists "own aircraft" on public.aircraft;
create policy "own aircraft" on public.aircraft
  for all
  using      (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "own jobs" on public.jobs;
create policy "own jobs" on public.jobs
  for all
  using      (auth.uid() = user_id)
  with check (auth.uid() = user_id);
