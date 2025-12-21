-- Goals table for tracking user goals with target dates
-- Run this in your Supabase SQL Editor

create table goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  target_date date not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- Enable Row Level Security
alter table goals enable row level security;

-- RLS Policies for goals
create policy "Users can read own goals"
  on goals for select
  using (user_id = auth.uid());

create policy "Users can create own goals"
  on goals for insert
  with check (user_id = auth.uid());

create policy "Users can update own goals"
  on goals for update
  using (user_id = auth.uid());

create policy "Users can delete own goals"
  on goals for delete
  using (user_id = auth.uid());

-- Indexes for faster queries
create index idx_goals_user_id on goals(user_id);
create index idx_goals_target_date on goals(target_date);
