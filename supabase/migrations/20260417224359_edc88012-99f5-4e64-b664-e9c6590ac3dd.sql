
-- 1. Role enum
CREATE TYPE public.app_role AS ENUM ('coach', 'athlete');

-- 2. user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 3. has_role security definer (RLS-safe)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 4. Auto-grant athlete role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'athlete')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_grant_athlete
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- 5. gym_settings (single-row table)
CREATE TABLE public.gym_settings (
  id INT PRIMARY KEY DEFAULT 1,
  coach_invite_code_hash TEXT,
  is_setup_complete BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO public.gym_settings (id, is_setup_complete) VALUES (1, FALSE);

ALTER TABLE public.gym_settings ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read setup status (to know whether to show bootstrap UI)
CREATE POLICY "Anyone can view gym setup status"
  ON public.gym_settings FOR SELECT
  TO authenticated
  USING (true);

-- Only coaches can update
CREATE POLICY "Coaches can update gym settings"
  ON public.gym_settings FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'coach'));

-- 6. setup_gym_code: bootstrap (first user) OR coach updating code
CREATE OR REPLACE FUNCTION public.setup_gym_code(_plain_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _setup_done BOOLEAN;
  _is_coach BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  IF _plain_code IS NULL OR length(trim(_plain_code)) < 4 THEN
    RETURN jsonb_build_object('success', false, 'error', 'code_too_short');
  END IF;

  SELECT is_setup_complete INTO _setup_done FROM public.gym_settings WHERE id = 1;
  _is_coach := public.has_role(auth.uid(), 'coach');

  -- Bootstrap path: no setup yet → caller becomes first coach
  IF NOT _setup_done THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (auth.uid(), 'coach')
    ON CONFLICT (user_id, role) DO NOTHING;

    UPDATE public.gym_settings
    SET coach_invite_code_hash = extensions.crypt(_plain_code, extensions.gen_salt('bf')),
        is_setup_complete = TRUE,
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = 1;

    RETURN jsonb_build_object('success', true, 'bootstrapped', true);
  END IF;

  -- Otherwise must be coach
  IF NOT _is_coach THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  UPDATE public.gym_settings
  SET coach_invite_code_hash = extensions.crypt(_plain_code, extensions.gen_salt('bf')),
      updated_at = now(),
      updated_by = auth.uid()
  WHERE id = 1;

  RETURN jsonb_build_object('success', true, 'bootstrapped', false);
END;
$$;

-- 7. redeem_coach_code: athlete enters code → granted coach role
CREATE OR REPLACE FUNCTION public.redeem_coach_code(_plain_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _hash TEXT;
  _setup_done BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT coach_invite_code_hash, is_setup_complete
  INTO _hash, _setup_done
  FROM public.gym_settings WHERE id = 1;

  IF NOT _setup_done OR _hash IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_setup');
  END IF;

  IF extensions.crypt(_plain_code, _hash) <> _hash THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_code');
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), 'coach')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 8. Tighten RLS on programs / assignments / weekly_overrides → coach-only writes
DROP POLICY IF EXISTS "Users can insert their own programs" ON public.programs;
DROP POLICY IF EXISTS "Users can update their own programs" ON public.programs;
DROP POLICY IF EXISTS "Users can delete their own programs" ON public.programs;

CREATE POLICY "Coaches can insert programs"
  ON public.programs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.has_role(auth.uid(), 'coach'));

CREATE POLICY "Coaches can update their programs"
  ON public.programs FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND public.has_role(auth.uid(), 'coach'));

CREATE POLICY "Coaches can delete their programs"
  ON public.programs FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND public.has_role(auth.uid(), 'coach'));

DROP POLICY IF EXISTS "Coaches manage their program assignments - insert" ON public.program_assignments;
DROP POLICY IF EXISTS "Coaches manage their program assignments - update" ON public.program_assignments;
DROP POLICY IF EXISTS "Coaches manage their program assignments - delete" ON public.program_assignments;

CREATE POLICY "Coaches insert program assignments"
  ON public.program_assignments FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'coach') AND
    EXISTS (SELECT 1 FROM public.programs p WHERE p.id = program_id AND p.user_id = auth.uid())
  );

CREATE POLICY "Coaches update program assignments"
  ON public.program_assignments FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'coach') AND
    EXISTS (SELECT 1 FROM public.programs p WHERE p.id = program_id AND p.user_id = auth.uid())
  );

CREATE POLICY "Coaches delete program assignments"
  ON public.program_assignments FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'coach') AND
    EXISTS (SELECT 1 FROM public.programs p WHERE p.id = program_id AND p.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert their weekly overrides" ON public.weekly_overrides;
DROP POLICY IF EXISTS "Users can update their weekly overrides" ON public.weekly_overrides;
DROP POLICY IF EXISTS "Users can delete their weekly overrides" ON public.weekly_overrides;

CREATE POLICY "Coaches insert weekly overrides"
  ON public.weekly_overrides FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'coach') AND
    EXISTS (SELECT 1 FROM public.programs p WHERE p.id = program_id AND p.user_id = auth.uid())
  );

CREATE POLICY "Coaches update weekly overrides"
  ON public.weekly_overrides FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'coach') AND
    EXISTS (SELECT 1 FROM public.programs p WHERE p.id = program_id AND p.user_id = auth.uid())
  );

CREATE POLICY "Coaches delete weekly overrides"
  ON public.weekly_overrides FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'coach') AND
    EXISTS (SELECT 1 FROM public.programs p WHERE p.id = program_id AND p.user_id = auth.uid())
  );
