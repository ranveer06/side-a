-- Run this in your Supabase project: SQL Editor → New query → paste and run.
-- Creates the log_comments table required for home feed commenting.

create table if not exists public.log_comments (
  id uuid primary key default gen_random_uuid(),
  log_id uuid not null references public.album_logs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null check (char_length(trim(text)) > 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_log_comments_log_id on public.log_comments(log_id);
create index if not exists idx_log_comments_created_at on public.log_comments(created_at);

alter table public.log_comments enable row level security;

-- Anyone authenticated can read comments for any log
create policy "Comments are viewable by authenticated users"
  on public.log_comments for select
  to authenticated
  using (true);

-- Only authenticated users can insert their own comments
create policy "Authenticated users can add comments"
  on public.log_comments for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Optional: users can delete their own comments
create policy "Users can delete own comments"
  on public.log_comments for delete
  to authenticated
  using (auth.uid() = user_id);
