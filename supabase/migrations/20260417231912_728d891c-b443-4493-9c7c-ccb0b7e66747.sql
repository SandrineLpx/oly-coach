
-- Helper: athletes can see a program if they have an active assignment for it.
-- SECURITY DEFINER bypasses RLS on program_assignments to avoid recursion.
CREATE OR REPLACE FUNCTION public.has_active_assignment(_user_id uuid, _program_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.program_assignments
    WHERE program_id = _program_id
      AND athlete_id = _user_id
      AND is_active = true
  )
$$;

-- Helper: does a program belong to this user (coach)?
CREATE OR REPLACE FUNCTION public.is_program_owner(_user_id uuid, _program_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.programs WHERE id = _program_id AND user_id = _user_id
  )
$$;

-- Helper: can this user see the program (owner OR active assignee)?
CREATE OR REPLACE FUNCTION public.can_view_program(_user_id uuid, _program_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_program_owner(_user_id, _program_id)
      OR public.has_active_assignment(_user_id, _program_id)
$$;

-- ============= programs =============
DROP POLICY IF EXISTS "Athletes view published assigned programs" ON public.programs;
CREATE POLICY "Athletes view published assigned programs"
  ON public.programs FOR SELECT TO authenticated
  USING (published = true AND public.has_active_assignment(auth.uid(), id));

-- ============= program_assignments =============
DROP POLICY IF EXISTS "Coaches manage their program assignments - select" ON public.program_assignments;
DROP POLICY IF EXISTS "Coaches insert program assignments" ON public.program_assignments;
DROP POLICY IF EXISTS "Coaches update program assignments" ON public.program_assignments;
DROP POLICY IF EXISTS "Coaches delete program assignments" ON public.program_assignments;

CREATE POLICY "Coaches view their program assignments"
  ON public.program_assignments FOR SELECT TO authenticated
  USING (public.is_program_owner(auth.uid(), program_id));

CREATE POLICY "Coaches insert program assignments"
  ON public.program_assignments FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'coach'::app_role)
    AND public.is_program_owner(auth.uid(), program_id)
  );

CREATE POLICY "Coaches update program assignments"
  ON public.program_assignments FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'coach'::app_role)
    AND public.is_program_owner(auth.uid(), program_id)
  );

CREATE POLICY "Coaches delete program assignments"
  ON public.program_assignments FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'coach'::app_role)
    AND public.is_program_owner(auth.uid(), program_id)
  );

-- ============= program_sessions =============
DROP POLICY IF EXISTS "Users can view their program sessions" ON public.program_sessions;
DROP POLICY IF EXISTS "Users can insert their program sessions" ON public.program_sessions;
DROP POLICY IF EXISTS "Users can update their program sessions" ON public.program_sessions;
DROP POLICY IF EXISTS "Users can delete their program sessions" ON public.program_sessions;

CREATE POLICY "Users can view their program sessions"
  ON public.program_sessions FOR SELECT TO authenticated
  USING (public.can_view_program(auth.uid(), program_id));

CREATE POLICY "Users can insert their program sessions"
  ON public.program_sessions FOR INSERT TO authenticated
  WITH CHECK (public.is_program_owner(auth.uid(), program_id));

CREATE POLICY "Users can update their program sessions"
  ON public.program_sessions FOR UPDATE TO authenticated
  USING (public.is_program_owner(auth.uid(), program_id));

CREATE POLICY "Users can delete their program sessions"
  ON public.program_sessions FOR DELETE TO authenticated
  USING (public.is_program_owner(auth.uid(), program_id));

-- ============= program_exercises =============
-- Helper for exercise → session → program ownership chain
CREATE OR REPLACE FUNCTION public.can_view_exercise(_user_id uuid, _session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.program_sessions ps
    WHERE ps.id = _session_id
      AND public.can_view_program(_user_id, ps.program_id)
  )
$$;

CREATE OR REPLACE FUNCTION public.owns_exercise_session(_user_id uuid, _session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.program_sessions ps
    WHERE ps.id = _session_id
      AND public.is_program_owner(_user_id, ps.program_id)
  )
$$;

DROP POLICY IF EXISTS "Users can view their program exercises" ON public.program_exercises;
DROP POLICY IF EXISTS "Users can insert their program exercises" ON public.program_exercises;
DROP POLICY IF EXISTS "Users can update their program exercises" ON public.program_exercises;
DROP POLICY IF EXISTS "Users can delete their program exercises" ON public.program_exercises;

CREATE POLICY "Users can view their program exercises"
  ON public.program_exercises FOR SELECT TO authenticated
  USING (public.can_view_exercise(auth.uid(), session_id));

CREATE POLICY "Users can insert their program exercises"
  ON public.program_exercises FOR INSERT TO authenticated
  WITH CHECK (public.owns_exercise_session(auth.uid(), session_id));

CREATE POLICY "Users can update their program exercises"
  ON public.program_exercises FOR UPDATE TO authenticated
  USING (public.owns_exercise_session(auth.uid(), session_id));

CREATE POLICY "Users can delete their program exercises"
  ON public.program_exercises FOR DELETE TO authenticated
  USING (public.owns_exercise_session(auth.uid(), session_id));

-- ============= weekly_overrides =============
DROP POLICY IF EXISTS "Users can view their weekly overrides" ON public.weekly_overrides;
DROP POLICY IF EXISTS "Coaches insert weekly overrides" ON public.weekly_overrides;
DROP POLICY IF EXISTS "Coaches update weekly overrides" ON public.weekly_overrides;
DROP POLICY IF EXISTS "Coaches delete weekly overrides" ON public.weekly_overrides;

CREATE POLICY "Users can view their weekly overrides"
  ON public.weekly_overrides FOR SELECT TO authenticated
  USING (
    public.is_program_owner(auth.uid(), program_id)
    OR athlete_id = auth.uid()
  );

CREATE POLICY "Coaches insert weekly overrides"
  ON public.weekly_overrides FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'coach'::app_role)
    AND public.is_program_owner(auth.uid(), program_id)
  );

CREATE POLICY "Coaches update weekly overrides"
  ON public.weekly_overrides FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'coach'::app_role)
    AND public.is_program_owner(auth.uid(), program_id)
  );

CREATE POLICY "Coaches delete weekly overrides"
  ON public.weekly_overrides FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'coach'::app_role)
    AND public.is_program_owner(auth.uid(), program_id)
  );
