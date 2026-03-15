-- Add strava_tokens table for OAuth token storage
CREATE TABLE IF NOT EXISTS public.strava_tokens (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at BIGINT NOT NULL,
  strava_athlete_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.strava_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own Strava tokens"
  ON public.strava_tokens
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add competition_date to athlete_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'athlete_profiles' AND column_name = 'competition_date'
  ) THEN
    ALTER TABLE public.athlete_profiles ADD COLUMN competition_date DATE;
  END IF;
END $$;

-- Add location columns to athlete_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'athlete_profiles' AND column_name = 'location_lat'
  ) THEN
    ALTER TABLE public.athlete_profiles ADD COLUMN location_lat DOUBLE PRECISION;
    ALTER TABLE public.athlete_profiles ADD COLUMN location_lon DOUBLE PRECISION;
  END IF;
END $$;
