-- Run in Supabase SQL Editor.
-- Creates the follows table with correct structure and RLS.
-- If you already have a follows table and get "property following does not exist",
-- the app code no longer relies on FK join names; this script still helps add RLS and indexes.

-- Create table (skip if already exists)
CREATE TABLE IF NOT EXISTS public.follows (
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id)
);

-- Indexes for queries
CREATE INDEX IF NOT EXISTS idx_follows_follower_id ON public.follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following_id ON public.follows(following_id);

-- RLS
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running (optional)
-- DROP POLICY IF EXISTS "Users can view all follows" ON public.follows;
-- DROP POLICY IF EXISTS "Users can insert own follow" ON public.follows;
-- DROP POLICY IF EXISTS "Users can delete own follow" ON public.follows;

CREATE POLICY "Users can view all follows"
  ON public.follows FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert own follow"
  ON public.follows FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can delete own follow"
  ON public.follows FOR DELETE TO authenticated
  USING (auth.uid() = follower_id);
