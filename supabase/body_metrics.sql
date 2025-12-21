-- Body Metrics table for tracking fat and muscle weight
-- Run this in your Supabase SQL Editor

create table body_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recorded_at timestamptz not null default now(),
  fat_st integer, -- stone component of fat weight
  fat_lbs numeric, -- pounds component of fat weight
  muscle_st integer, -- stone component of muscle weight
  muscle_lbs numeric, -- pounds component of muscle weight
  created_at timestamptz not null default now()
);

-- Enable Row Level Security
alter table body_metrics enable row level security;

-- RLS Policies
create policy "Users can read own body metrics"
  on body_metrics for select
  using (user_id = auth.uid());

create policy "Users can create own body metrics"
  on body_metrics for insert
  with check (user_id = auth.uid());

create policy "Users can update own body metrics"
  on body_metrics for update
  using (user_id = auth.uid());

create policy "Users can delete own body metrics"
  on body_metrics for delete
  using (user_id = auth.uid());

-- Index for faster queries
create index idx_body_metrics_user_id on body_metrics(user_id);
create index idx_body_metrics_recorded_at on body_metrics(recorded_at desc);
