-- Run in Supabase SQL Editor. Creates profile_favorites table so "Five Favorites" show on profile and Manage Favorites works.

CREATE TABLE IF NOT EXISTS public.profile_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  album_id uuid NOT NULL REFERENCES public.albums(id) ON DELETE CASCADE,
  position integer NOT NULL CHECK (position >= 1 AND position <= 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, position)
);

CREATE INDEX IF NOT EXISTS idx_profile_favorites_user_id ON public.profile_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_profile_favorites_album_id ON public.profile_favorites(album_id);

ALTER TABLE public.profile_favorites ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read (to show Five Favorites on any profile)
CREATE POLICY "Authenticated can read profile_favorites"
  ON public.profile_favorites FOR SELECT TO authenticated USING (true);

-- Users can insert their own
CREATE POLICY "Users can insert own profile_favorites"
  ON public.profile_favorites FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own
CREATE POLICY "Users can update own profile_favorites"
  ON public.profile_favorites FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Users can delete their own
CREATE POLICY "Users can delete own profile_favorites"
  ON public.profile_favorites FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
