-- Allow multiple logs per user per album (relistens)
-- Run in Supabase SQL editor.
-- If the drop fails with "constraint does not exist", your table already allows relistens.

-- Drop unique constraint on (user_id, album_id) if it exists
-- (PostgreSQL default name for UNIQUE(a,b) is tablename_a_b_key)
ALTER TABLE public.album_logs
  DROP CONSTRAINT IF EXISTS album_logs_user_id_album_id_key;

-- If your constraint was named differently, find it with:
-- SELECT conname FROM pg_constraint
-- WHERE conrelid = 'public.album_logs'::regclass AND contype = 'u';
-- Then: ALTER TABLE public.album_logs DROP CONSTRAINT <conname>;

-- Optional: index for "all logs for this user+album" queries
CREATE INDEX IF NOT EXISTS idx_album_logs_user_album
  ON public.album_logs(user_id, album_id);
