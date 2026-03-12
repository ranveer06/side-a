-- Add optional genre for album descriptions (from Spotify artist).
-- Run in Supabase SQL Editor.

alter table public.albums
  add column if not exists genre text;

comment on column public.albums.genre is 'Primary genre from Spotify artist (e.g. rock, indie)';
