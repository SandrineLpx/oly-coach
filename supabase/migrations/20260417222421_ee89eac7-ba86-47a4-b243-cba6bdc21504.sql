-- Add published flag to programs
ALTER TABLE public.programs ADD COLUMN IF NOT EXISTS published BOOLEAN NOT NULL DEFAULT false;

-- Create program_assignments table to link programs to athletes
CREATE TABLE IF NOT EXISTS public.program_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  athlete_id UUID NOT NULL,
  assigned_by UUID NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (program_id, athlete_id)
);

ALTER TABLE public.program_assignments ENABLE ROW LEVEL SECURITY;

-- Coach (owner of program) manages assignments
CREATE POLICY "Coaches manage their program assignments - select"
ON public.program_assignments FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.programs p WHERE p.id = program_assignments.program_id AND p.user_id = auth.uid()));

CREATE POLICY "Coaches manage their program assignments - insert"
ON public.program_assignments FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.programs p WHERE p.id = program_assignments.program_id AND p.user_id = auth.uid()));

CREATE POLICY "Coaches manage their program assignments - update"
ON public.program_assignments FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.programs p WHERE p.id = program_assignments.program_id AND p.user_id = auth.uid()));

CREATE POLICY "Coaches manage their program assignments - delete"
ON public.program_assignments FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.programs p WHERE p.id = program_assignments.program_id AND p.user_id = auth.uid()));

-- Athletes can see their own assignments
CREATE POLICY "Athletes view their own assignments"
ON public.program_assignments FOR SELECT TO authenticated
USING (athlete_id = auth.uid());

-- Update programs RLS: athletes see published programs assigned to them; coaches see all their own
DROP POLICY IF EXISTS "Users can view their own programs" ON public.programs;

CREATE POLICY "Coaches view their own programs"
ON public.programs FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Athletes view published assigned programs"
ON public.programs FOR SELECT TO authenticated
USING (
  published = true
  AND EXISTS (
    SELECT 1 FROM public.program_assignments pa
    WHERE pa.program_id = programs.id
      AND pa.athlete_id = auth.uid()
      AND pa.is_active = true
  )
);