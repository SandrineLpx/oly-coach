-- 1. Extend program_sessions with scheduling metadata
ALTER TABLE public.program_sessions ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'primary';
ALTER TABLE public.program_sessions ADD COLUMN IF NOT EXISTS droppable BOOLEAN DEFAULT false;
ALTER TABLE public.program_sessions ADD COLUMN IF NOT EXISTS focus_label TEXT;
ALTER TABLE public.program_sessions ADD COLUMN IF NOT EXISTS can_merge_into UUID REFERENCES public.program_sessions(id) ON DELETE SET NULL;

-- Validate priority values via trigger (CHECK constraints can be limiting; using trigger for flexibility)
CREATE OR REPLACE FUNCTION public.validate_program_session_priority()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.priority IS NOT NULL AND NEW.priority NOT IN ('primary', 'secondary', 'supplemental') THEN
    RAISE EXCEPTION 'priority must be one of: primary, secondary, supplemental';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_program_session_priority_trigger ON public.program_sessions;
CREATE TRIGGER validate_program_session_priority_trigger
  BEFORE INSERT OR UPDATE ON public.program_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_program_session_priority();

-- 2. Add programs source + template flag
ALTER TABLE public.programs ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'upload';
ALTER TABLE public.programs ADD COLUMN IF NOT EXISTS is_template BOOLEAN DEFAULT false;

CREATE OR REPLACE FUNCTION public.validate_program_source()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.source IS NOT NULL AND NEW.source NOT IN ('upload', 'library') THEN
    RAISE EXCEPTION 'source must be one of: upload, library';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_program_source_trigger ON public.programs;
CREATE TRIGGER validate_program_source_trigger
  BEFORE INSERT OR UPDATE ON public.programs
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_program_source();

-- 3. Create weekly_overrides table
CREATE TABLE IF NOT EXISTS public.weekly_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID REFERENCES public.programs(id) ON DELETE CASCADE,
  athlete_id UUID REFERENCES public.athlete_profiles(id) ON DELETE CASCADE,
  week_number INT NOT NULL,
  available_days TEXT[],
  session_assignments JSONB,
  dropped_sessions JSONB,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_weekly_overrides_program_id ON public.weekly_overrides(program_id);
CREATE INDEX IF NOT EXISTS idx_weekly_overrides_athlete_id ON public.weekly_overrides(athlete_id);

ALTER TABLE public.weekly_overrides ENABLE ROW LEVEL SECURITY;

-- RLS: a user can manage overrides for programs they own
CREATE POLICY "Users can view their weekly overrides"
ON public.weekly_overrides
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.programs p
    WHERE p.id = weekly_overrides.program_id AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert their weekly overrides"
ON public.weekly_overrides
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.programs p
    WHERE p.id = weekly_overrides.program_id AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their weekly overrides"
ON public.weekly_overrides
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.programs p
    WHERE p.id = weekly_overrides.program_id AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their weekly overrides"
ON public.weekly_overrides
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.programs p
    WHERE p.id = weekly_overrides.program_id AND p.user_id = auth.uid()
  )
);