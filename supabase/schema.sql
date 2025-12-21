-- Supabase Schema for Trackd Fitness App
-- Run this in your Supabase SQL Editor

-- Exercises table (library of available exercises)
create table exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in ('strength', 'cardio', 'flexibility', 'other')),
  muscle_groups text[] not null default '{}',
  created_at timestamptz not null default now(),
  user_id uuid references auth.users(id) on delete cascade
);

-- Workouts table (individual workout sessions)
create table workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

-- Workout exercises (links exercises to a workout)
create table workout_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references workouts(id) on delete cascade,
  exercise_id uuid not null references exercises(id) on delete cascade,
  "order" integer not null default 0,
  created_at timestamptz not null default now()
);

-- Sets table (individual sets within a workout exercise)
create table sets (
  id uuid primary key default gen_random_uuid(),
  workout_exercise_id uuid not null references workout_exercises(id) on delete cascade,
  set_number integer not null,
  reps integer,
  weight numeric, -- in user's preferred unit
  duration integer, -- in seconds
  distance numeric, -- for cardio
  notes text,
  created_at timestamptz not null default now()
);

-- Enable Row Level Security
alter table exercises enable row level security;
alter table workouts enable row level security;
alter table workout_exercises enable row level security;
alter table sets enable row level security;

-- RLS Policies for exercises
-- Users can read all default exercises (user_id is null) and their own custom exercises
create policy "Users can read default and own exercises"
  on exercises for select
  using (user_id is null or user_id = auth.uid());

create policy "Users can create own exercises"
  on exercises for insert
  with check (user_id = auth.uid());

create policy "Users can update own exercises"
  on exercises for update
  using (user_id = auth.uid());

create policy "Users can delete own exercises"
  on exercises for delete
  using (user_id = auth.uid());

-- RLS Policies for workouts
create policy "Users can read own workouts"
  on workouts for select
  using (user_id = auth.uid());

create policy "Users can create own workouts"
  on workouts for insert
  with check (user_id = auth.uid());

create policy "Users can update own workouts"
  on workouts for update
  using (user_id = auth.uid());

create policy "Users can delete own workouts"
  on workouts for delete
  using (user_id = auth.uid());

-- RLS Policies for workout_exercises
create policy "Users can read own workout exercises"
  on workout_exercises for select
  using (
    exists (
      select 1 from workouts
      where workouts.id = workout_exercises.workout_id
      and workouts.user_id = auth.uid()
    )
  );

create policy "Users can create own workout exercises"
  on workout_exercises for insert
  with check (
    exists (
      select 1 from workouts
      where workouts.id = workout_exercises.workout_id
      and workouts.user_id = auth.uid()
    )
  );

create policy "Users can update own workout exercises"
  on workout_exercises for update
  using (
    exists (
      select 1 from workouts
      where workouts.id = workout_exercises.workout_id
      and workouts.user_id = auth.uid()
    )
  );

create policy "Users can delete own workout exercises"
  on workout_exercises for delete
  using (
    exists (
      select 1 from workouts
      where workouts.id = workout_exercises.workout_id
      and workouts.user_id = auth.uid()
    )
  );

-- RLS Policies for sets
create policy "Users can read own sets"
  on sets for select
  using (
    exists (
      select 1 from workout_exercises
      join workouts on workouts.id = workout_exercises.workout_id
      where workout_exercises.id = sets.workout_exercise_id
      and workouts.user_id = auth.uid()
    )
  );

create policy "Users can create own sets"
  on sets for insert
  with check (
    exists (
      select 1 from workout_exercises
      join workouts on workouts.id = workout_exercises.workout_id
      where workout_exercises.id = sets.workout_exercise_id
      and workouts.user_id = auth.uid()
    )
  );

create policy "Users can update own sets"
  on sets for update
  using (
    exists (
      select 1 from workout_exercises
      join workouts on workouts.id = workout_exercises.workout_id
      where workout_exercises.id = sets.workout_exercise_id
      and workouts.user_id = auth.uid()
    )
  );

create policy "Users can delete own sets"
  on sets for delete
  using (
    exists (
      select 1 from workout_exercises
      join workouts on workouts.id = workout_exercises.workout_id
      where workout_exercises.id = sets.workout_exercise_id
      and workouts.user_id = auth.uid()
    )
  );

-- Create indexes for better performance
create index idx_workouts_user_id on workouts(user_id);
create index idx_workouts_started_at on workouts(started_at desc);
create index idx_workout_exercises_workout_id on workout_exercises(workout_id);
create index idx_sets_workout_exercise_id on sets(workout_exercise_id);

-- Insert default exercises (available to all users)
insert into exercises (name, category, muscle_groups, user_id) values
  -- Chest
  ('Bench Press', 'strength', array['chest', 'triceps', 'shoulders'], null),
  ('Incline Bench Press', 'strength', array['chest', 'triceps', 'shoulders'], null),
  ('Dumbbell Fly', 'strength', array['chest'], null),
  ('Push-ups', 'strength', array['chest', 'triceps', 'shoulders'], null),
  -- Back
  ('Deadlift', 'strength', array['back', 'hamstrings', 'glutes'], null),
  ('Pull-ups', 'strength', array['back', 'biceps'], null),
  ('Barbell Row', 'strength', array['back', 'biceps'], null),
  ('Lat Pulldown', 'strength', array['back', 'biceps'], null),
  -- Legs
  ('Squat', 'strength', array['quadriceps', 'glutes', 'hamstrings'], null),
  ('Leg Press', 'strength', array['quadriceps', 'glutes'], null),
  ('Romanian Deadlift', 'strength', array['hamstrings', 'glutes', 'back'], null),
  ('Leg Curl', 'strength', array['hamstrings'], null),
  ('Calf Raise', 'strength', array['calves'], null),
  -- Shoulders
  ('Overhead Press', 'strength', array['shoulders', 'triceps'], null),
  ('Lateral Raise', 'strength', array['shoulders'], null),
  ('Face Pull', 'strength', array['shoulders', 'back'], null),
  -- Arms
  ('Bicep Curl', 'strength', array['biceps'], null),
  ('Tricep Pushdown', 'strength', array['triceps'], null),
  ('Hammer Curl', 'strength', array['biceps', 'forearms'], null),
  -- Core
  ('Plank', 'strength', array['core'], null),
  ('Crunches', 'strength', array['core'], null),
  ('Hanging Leg Raise', 'strength', array['core'], null),
  -- Cardio
  ('Running', 'cardio', array['legs', 'cardio'], null),
  ('Cycling', 'cardio', array['legs', 'cardio'], null),
  ('Rowing', 'cardio', array['back', 'legs', 'cardio'], null),
  ('Jump Rope', 'cardio', array['legs', 'cardio'], null);
