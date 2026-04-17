-- 1. Per-assignment progress
ALTER TABLE public.program_assignments
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS current_week INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Validate status values via trigger (matches existing project pattern)
CREATE OR REPLACE FUNCTION public.validate_program_assignment_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS NOT NULL AND NEW.status NOT IN ('active','paused','completed') THEN
    RAISE EXCEPTION 'status must be one of: active, paused, completed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_program_assignment_status ON public.program_assignments;
CREATE TRIGGER trg_validate_program_assignment_status
  BEFORE INSERT OR UPDATE ON public.program_assignments
  FOR EACH ROW EXECUTE FUNCTION public.validate_program_assignment_status();

-- Backfill start_date from programs
UPDATE public.program_assignments pa
SET start_date = p.start_date
FROM public.programs p
WHERE pa.program_id = p.id
  AND pa.start_date IS NULL
  AND p.start_date IS NOT NULL;

-- 2. weekly_overrides FK realignment + NOT NULL
-- Clean any orphan rows that would block the new FK to auth.users
DELETE FROM public.weekly_overrides wo
WHERE wo.athlete_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = wo.athlete_id);

DELETE FROM public.weekly_overrides WHERE program_id IS NULL OR athlete_id IS NULL;

ALTER TABLE public.weekly_overrides
  DROP CONSTRAINT IF EXISTS weekly_overrides_athlete_id_fkey;

ALTER TABLE public.weekly_overrides
  ADD CONSTRAINT weekly_overrides_athlete_id_fkey
  FOREIGN KEY (athlete_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.weekly_overrides
  ALTER COLUMN program_id SET NOT NULL,
  ALTER COLUMN athlete_id SET NOT NULL;

-- 3. Prevent duplicate week plans
ALTER TABLE public.weekly_overrides
  DROP CONSTRAINT IF EXISTS weekly_overrides_unique_week;

ALTER TABLE public.weekly_overrides
  ADD CONSTRAINT weekly_overrides_unique_week
  UNIQUE (program_id, athlete_id, week_number);