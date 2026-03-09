-- Community Reviews: allow all authenticated users to read ALL album_logs
-- (so the album detail page can show every review for that album, including your own).
-- Run in Supabase SQL editor.

ALTER TABLE public.album_logs ENABLE ROW LEVEL SECURITY;

-- Remove any SELECT policy that only allows "own rows" (so we can replace with public read)
DROP POLICY IF EXISTS "Users can view own logs" ON public.album_logs;
DROP POLICY IF EXISTS "Users can view own album logs" ON public.album_logs;
DROP POLICY IF EXISTS "album_logs_select_own" ON public.album_logs;

-- Allow all authenticated users to read all album_logs
CREATE POLICY "Authenticated users can view all album logs"
  ON public.album_logs
  FOR SELECT
  TO authenticated
  USING (true);

-- Ensure you still have policies for INSERT/UPDATE/DELETE (own rows only).
-- If you get "permission denied" when creating/updating/deleting a log, add:
--   INSERT: WITH CHECK (auth.uid() = user_id)
--   UPDATE: USING (auth.uid() = user_id)
--   DELETE: USING (auth.uid() = user_id)
