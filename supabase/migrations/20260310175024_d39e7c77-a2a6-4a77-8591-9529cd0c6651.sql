
-- Programs table
CREATE TABLE public.programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  start_date date NOT NULL,
  weeks integer NOT NULL DEFAULT 8,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own programs" ON public.programs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own programs" ON public.programs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own programs" ON public.programs FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own programs" ON public.programs FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Program sessions table
CREATE TABLE public.program_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  week_number integer NOT NULL,
  day_of_week integer NOT NULL,
  session_type text NOT NULL DEFAULT 'T',
  name text,
  notes text,
  order_index integer NOT NULL DEFAULT 0
);

ALTER TABLE public.program_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their program sessions" ON public.program_sessions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.programs WHERE programs.id = program_sessions.program_id AND programs.user_id = auth.uid()));
CREATE POLICY "Users can insert their program sessions" ON public.program_sessions FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.programs WHERE programs.id = program_sessions.program_id AND programs.user_id = auth.uid()));
CREATE POLICY "Users can update their program sessions" ON public.program_sessions FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.programs WHERE programs.id = program_sessions.program_id AND programs.user_id = auth.uid()));
CREATE POLICY "Users can delete their program sessions" ON public.program_sessions FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.programs WHERE programs.id = program_sessions.program_id AND programs.user_id = auth.uid()));

-- Program exercises table
CREATE TABLE public.program_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.program_sessions(id) ON DELETE CASCADE,
  name text NOT NULL,
  sets integer,
  reps text,
  weight numeric,
  percent_of_max numeric,
  notes text,
  order_index integer NOT NULL DEFAULT 0
);

ALTER TABLE public.program_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their program exercises" ON public.program_exercises FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.program_sessions ps JOIN public.programs p ON p.id = ps.program_id WHERE ps.id = program_exercises.session_id AND p.user_id = auth.uid()));
CREATE POLICY "Users can insert their program exercises" ON public.program_exercises FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.program_sessions ps JOIN public.programs p ON p.id = ps.program_id WHERE ps.id = program_exercises.session_id AND p.user_id = auth.uid()));
CREATE POLICY "Users can update their program exercises" ON public.program_exercises FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.program_sessions ps JOIN public.programs p ON p.id = ps.program_id WHERE ps.id = program_exercises.session_id AND p.user_id = auth.uid()));
CREATE POLICY "Users can delete their program exercises" ON public.program_exercises FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.program_sessions ps JOIN public.programs p ON p.id = ps.program_id WHERE ps.id = program_exercises.session_id AND p.user_id = auth.uid()));
