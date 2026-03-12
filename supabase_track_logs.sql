-- Optional per-track ratings/reviews, linked to a user's album log (or album when no log).
-- Run in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.track_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  album_id uuid NOT NULL REFERENCES public.albums(id) ON DELETE CASCADE,
  album_log_id uuid REFERENCES public.album_logs(id) ON DELETE CASCADE,
  track_number int NOT NULL,
  track_name text,
  rating numeric(2,1) CHECK (rating IS NULL OR (rating >= 0 AND rating <= 5)),
  review_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, album_id, track_number)
);

CREATE INDEX IF NOT EXISTS idx_track_logs_user_album ON public.track_logs(user_id, album_id);
CREATE INDEX IF NOT EXISTS idx_track_logs_album ON public.track_logs(album_id);

ALTER TABLE public.track_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all track_logs"
  ON public.track_logs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert own track_logs"
  ON public.track_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own track_logs"
  ON public.track_logs FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own track_logs"
  ON public.track_logs FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
