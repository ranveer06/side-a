-- Comment likes and replies. Run in Supabase SQL Editor.

-- 1) Add parent_id to log_comments for replies
ALTER TABLE public.log_comments
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.log_comments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_log_comments_parent_id ON public.log_comments(parent_id);

-- 2) Comment likes table
CREATE TABLE IF NOT EXISTS public.comment_likes (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  comment_id uuid NOT NULL REFERENCES public.log_comments(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, comment_id)
);

CREATE INDEX IF NOT EXISTS idx_comment_likes_comment_id ON public.comment_likes(comment_id);

ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view comment likes"
  ON public.comment_likes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert own comment like"
  ON public.comment_likes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comment like"
  ON public.comment_likes FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
