-- Migration: 20260315000001_exercise_module.sql
-- Purpose: Exercise module tables for PMS (running, swimming, calories)
-- Rollback strategy (DOWN):
--   DROP TABLE IF EXISTS body_metrics CASCADE;
--   DROP TABLE IF EXISTS saved_foods CASCADE;
--   DROP TABLE IF EXISTS food_logs CASCADE;
--   DROP TABLE IF EXISTS personal_records CASCADE;
--   DROP TABLE IF EXISTS run_laps CASCADE;
--   DROP TABLE IF EXISTS exercise_sessions CASCADE;
--   ALTER TABLE user_preferences DROP COLUMN IF EXISTS distance_unit;
--   ALTER TABLE user_preferences DROP COLUMN IF EXISTS bmr_calories;
--   ALTER TABLE user_preferences DROP COLUMN IF EXISTS daily_calorie_goal;
--   ALTER TABLE user_preferences DROP COLUMN IF EXISTS height_cm;
--   ALTER TABLE user_preferences DROP COLUMN IF EXISTS weight_kg;
--   ALTER TABLE user_preferences DROP COLUMN IF EXISTS age;
--   ALTER TABLE user_preferences DROP COLUMN IF EXISTS biological_sex;
--   ALTER TABLE user_preferences DROP COLUMN IF EXISTS last_exercise_date;

-- =========================
-- exercise_sessions
-- =========================
CREATE TABLE exercise_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL CHECK (type IN ('run', 'swim', 'other')),
  date date NOT NULL,
  started_at timestamptz,
  duration_seconds integer NOT NULL CHECK (duration_seconds > 0),
  distance_metres numeric(8,2),
  calories_burned integer,
  notes text,
  -- Running-specific
  route_name text,
  effort_level integer CHECK (effort_level BETWEEN 1 AND 5),
  is_pr boolean DEFAULT false,
  pr_distance_bucket text CHECK (pr_distance_bucket IN (
    '1km', '5km', '10km', 'half_marathon'
  )),
  -- Swimming-specific
  pool_length_metres integer CHECK (pool_length_metres IN (25, 50)),
  total_laps integer,
  stroke_type text CHECK (stroke_type IN (
    'freestyle', 'backstroke', 'breaststroke', 'butterfly', 'mixed'
  )),
  swolf_score numeric(5,1),
  -- Calendar integration
  calendar_event_id uuid REFERENCES calendar_events(id) ON DELETE SET NULL,
  -- Metadata
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

DROP TRIGGER IF EXISTS set_exercise_sessions_updated_at ON public.exercise_sessions;
CREATE TRIGGER set_exercise_sessions_updated_at
BEFORE UPDATE ON public.exercise_sessions
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- run_laps
-- =========================
CREATE TABLE run_laps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES exercise_sessions(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  lap_number integer NOT NULL,
  distance_metres numeric(6,2) NOT NULL,
  duration_seconds integer NOT NULL,
  pace_seconds_per_km numeric(6,2),
  created_at timestamptz DEFAULT now() NOT NULL
);

-- =========================
-- personal_records
-- =========================
CREATE TABLE personal_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  distance_bucket text NOT NULL CHECK (distance_bucket IN (
    '1km', '5km', '10km', 'half_marathon'
  )),
  best_pace_seconds_per_km numeric(6,2) NOT NULL,
  best_session_id uuid REFERENCES exercise_sessions(id) ON DELETE SET NULL,
  achieved_at date NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (user_id, distance_bucket)
);

DROP TRIGGER IF EXISTS set_personal_records_updated_at ON public.personal_records;
CREATE TRIGGER set_personal_records_updated_at
BEFORE UPDATE ON public.personal_records
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- saved_foods (must be created before food_logs due to FK)
-- =========================
CREATE TABLE saved_foods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  food_name text NOT NULL,
  calories integer NOT NULL CHECK (calories >= 0),
  carbs_g numeric(6,1),
  fat_g numeric(6,1),
  protein_g numeric(6,1),
  use_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

DROP TRIGGER IF EXISTS set_saved_foods_updated_at ON public.saved_foods;
CREATE TRIGGER set_saved_foods_updated_at
BEFORE UPDATE ON public.saved_foods
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- food_logs
-- =========================
CREATE TABLE food_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date date NOT NULL,
  meal_slot text NOT NULL CHECK (meal_slot IN (
    'breakfast', 'lunch', 'dinner', 'snack'
  )),
  food_name text NOT NULL,
  calories integer NOT NULL CHECK (calories >= 0),
  carbs_g numeric(6,1),
  fat_g numeric(6,1),
  protein_g numeric(6,1),
  water_ml integer DEFAULT 0,
  saved_food_id uuid REFERENCES saved_foods(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- =========================
-- body_metrics
-- =========================
CREATE TABLE body_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date date NOT NULL,
  weight_kg numeric(5,2),
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (user_id, date)
);

-- =========================
-- Extend user_preferences
-- =========================
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS distance_unit text DEFAULT 'km'
    CHECK (distance_unit IN ('km', 'miles')),
  ADD COLUMN IF NOT EXISTS bmr_calories integer,
  ADD COLUMN IF NOT EXISTS daily_calorie_goal integer,
  ADD COLUMN IF NOT EXISTS height_cm integer,
  ADD COLUMN IF NOT EXISTS weight_kg numeric(5,2),
  ADD COLUMN IF NOT EXISTS age integer,
  ADD COLUMN IF NOT EXISTS biological_sex text
    CHECK (biological_sex IN ('male', 'female')),
  ADD COLUMN IF NOT EXISTS last_exercise_date date;

-- =========================
-- Indexes
-- =========================
CREATE INDEX idx_exercise_sessions_user_date
  ON exercise_sessions(user_id, date DESC);
CREATE INDEX idx_exercise_sessions_type
  ON exercise_sessions(user_id, type);
CREATE INDEX idx_exercise_sessions_pr
  ON exercise_sessions(user_id, is_pr) WHERE is_pr = true;
CREATE INDEX idx_run_laps_session
  ON run_laps(session_id);
CREATE INDEX idx_personal_records_user
  ON personal_records(user_id);
CREATE INDEX idx_food_logs_user_date
  ON food_logs(user_id, date DESC);
CREATE INDEX idx_body_metrics_user_date
  ON body_metrics(user_id, date DESC);

-- =========================
-- RLS Policies
-- =========================

-- exercise_sessions
ALTER TABLE exercise_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_exercise_sessions"
  ON exercise_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert_own_exercise_sessions"
  ON exercise_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_exercise_sessions"
  ON exercise_sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "delete_own_exercise_sessions"
  ON exercise_sessions FOR DELETE USING (auth.uid() = user_id);

-- run_laps
ALTER TABLE run_laps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_run_laps"
  ON run_laps FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert_own_run_laps"
  ON run_laps FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_run_laps"
  ON run_laps FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "delete_own_run_laps"
  ON run_laps FOR DELETE USING (auth.uid() = user_id);

-- personal_records
ALTER TABLE personal_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_personal_records"
  ON personal_records FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert_own_personal_records"
  ON personal_records FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_personal_records"
  ON personal_records FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "delete_own_personal_records"
  ON personal_records FOR DELETE USING (auth.uid() = user_id);

-- food_logs
ALTER TABLE food_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_food_logs"
  ON food_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert_own_food_logs"
  ON food_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_food_logs"
  ON food_logs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "delete_own_food_logs"
  ON food_logs FOR DELETE USING (auth.uid() = user_id);

-- saved_foods
ALTER TABLE saved_foods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_saved_foods"
  ON saved_foods FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert_own_saved_foods"
  ON saved_foods FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_saved_foods"
  ON saved_foods FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "delete_own_saved_foods"
  ON saved_foods FOR DELETE USING (auth.uid() = user_id);

-- body_metrics
ALTER TABLE body_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_body_metrics"
  ON body_metrics FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert_own_body_metrics"
  ON body_metrics FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_body_metrics"
  ON body_metrics FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "delete_own_body_metrics"
  ON body_metrics FOR DELETE USING (auth.uid() = user_id);
