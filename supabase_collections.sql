-- Run in Supabase SQL Editor. Creates collections table so "Add to Collection" and profile Collection section work.

CREATE TABLE IF NOT EXISTS public.collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  album_id uuid NOT NULL REFERENCES public.albums(id) ON DELETE CASCADE,
  format text NOT NULL CHECK (format IN ('vinyl', 'cd', 'tape', 'other')),
  "condition" text CHECK ("condition" IN ('mint', 'near_mint', 'very_good', 'good', 'fair', 'poor')),
  notes text,
  purchase_date date,
  purchase_price numeric(10,2),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_collections_user_id ON public.collections(user_id);
CREATE INDEX IF NOT EXISTS idx_collections_album_id ON public.collections(album_id);

ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read collections (to show on profiles)
CREATE POLICY "Authenticated can read collections"
  ON public.collections FOR SELECT TO authenticated USING (true);

-- Users can insert their own
CREATE POLICY "Users can insert own collection"
  ON public.collections FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own
CREATE POLICY "Users can update own collection"
  ON public.collections FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Users can delete their own
CREATE POLICY "Users can delete own collection"
  ON public.collections FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
