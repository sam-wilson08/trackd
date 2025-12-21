-- Protein Intake table for tracking daily protein consumption
-- Run this in your Supabase SQL Editor

create table protein_intake (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  grams integer not null,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Enable Row Level Security
alter table protein_intake enable row level security;

-- RLS Policies
create policy "Users can read own protein intake"
  on protein_intake for select
  using (user_id = auth.uid());

create policy "Users can create own protein intake"
  on protein_intake for insert
  with check (user_id = auth.uid());

create policy "Users can update own protein intake"
  on protein_intake for update
  using (user_id = auth.uid());

create policy "Users can delete own protein intake"
  on protein_intake for delete
  using (user_id = auth.uid());

-- Index for faster queries
create index idx_protein_intake_user_id on protein_intake(user_id);
create index idx_protein_intake_recorded_at on protein_intake(recorded_at desc);
