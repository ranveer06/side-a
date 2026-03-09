-- Run in Supabase SQL Editor. Creates log_likes for liking reviews.

create table if not exists public.log_likes (
  id uuid primary key default gen_random_uuid(),
  log_id uuid not null references public.album_logs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(log_id, user_id)
);

create index if not exists idx_log_likes_log_id on public.log_likes(log_id);
create index if not exists idx_log_likes_user_id on public.log_likes(user_id);

alter table public.log_likes enable row level security;

create policy "Likes viewable by authenticated"
  on public.log_likes for select to authenticated using (true);

create policy "Users can like"
  on public.log_likes for insert to authenticated with check (auth.uid() = user_id);

create policy "Users can unlike"
  on public.log_likes for delete to authenticated using (auth.uid() = user_id);
