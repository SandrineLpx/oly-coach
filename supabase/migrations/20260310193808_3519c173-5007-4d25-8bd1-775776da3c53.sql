
CREATE TABLE public.pr_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  lift_name text NOT NULL,
  weight numeric NOT NULL,
  unit text NOT NULL DEFAULT 'kg',
  achieved_at date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pr_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own PR history"
  ON public.pr_history FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own PR history"
  ON public.pr_history FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own PR history"
  ON public.pr_history FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
