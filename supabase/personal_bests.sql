-- Personal Bests tables for tracking workout PBs and their history
-- Run this in your Supabase SQL Editor

-- Main table for PB exercises (e.g., "Bench Press", "Squat")
create table personal_bests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

-- History table for tracking PB records over time
create table personal_best_records (
  id uuid primary key default gen_random_uuid(),
  personal_best_id uuid not null references personal_bests(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  sets integer not null,
  reps integer not null,
  weight numeric not null,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Enable Row Level Security
alter table personal_bests enable row level security;
alter table personal_best_records enable row level security;

-- RLS Policies for personal_bests
create policy "Users can read own personal bests"
  on personal_bests for select
  using (user_id = auth.uid());

create policy "Users can create own personal bests"
  on personal_bests for insert
  with check (user_id = auth.uid());

create policy "Users can update own personal bests"
  on personal_bests for update
  using (user_id = auth.uid());

create policy "Users can delete own personal bests"
  on personal_bests for delete
  using (user_id = auth.uid());

-- RLS Policies for personal_best_records
create policy "Users can read own personal best records"
  on personal_best_records for select
  using (user_id = auth.uid());

create policy "Users can create own personal best records"
  on personal_best_records for insert
  with check (user_id = auth.uid());

create policy "Users can update own personal best records"
  on personal_best_records for update
  using (user_id = auth.uid());

create policy "Users can delete own personal best records"
  on personal_best_records for delete
  using (user_id = auth.uid());

-- Indexes for faster queries
create index idx_personal_bests_user_id on personal_bests(user_id);
create index idx_personal_best_records_user_id on personal_best_records(user_id);
create index idx_personal_best_records_pb_id on personal_best_records(personal_best_id);
create index idx_personal_best_records_recorded_at on personal_best_records(recorded_at desc);
