-- Listen list: albums the user wants to listen to
-- Run in Supabase SQL editor

create table if not exists public.listen_list (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  album_id uuid not null references public.albums(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, album_id)
);

create index if not exists idx_listen_list_user_id on public.listen_list(user_id);
create index if not exists idx_listen_list_created_at on public.listen_list(created_at desc);

alter table public.listen_list enable row level security;

drop policy if exists "Users can view own listen list" on public.listen_list;
create policy "Users can view own listen list"
  on public.listen_list for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own listen list" on public.listen_list;
create policy "Users can insert own listen list"
  on public.listen_list for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own listen list" on public.listen_list;
create policy "Users can delete own listen list"
  on public.listen_list for delete to authenticated
  using (auth.uid() = user_id);
