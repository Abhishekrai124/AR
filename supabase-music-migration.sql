-- Run this in the same Supabase project used by supabase.js.
create table if not exists public.music_tracks (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null references public.profiles(id) on delete cascade,
  title text not null,
  artist text not null,
  team text not null default '',
  description text not null default '',
  media_url text not null,
  media_type text not null,
  created_at timestamptz not null default now()
);
alter table public.music_tracks enable row level security;
drop policy if exists "Music is visible to signed-in users" on public.music_tracks;
drop policy if exists "Users upload music metadata" on public.music_tracks;
drop policy if exists "Users update their music" on public.music_tracks;
drop policy if exists "Users delete their music" on public.music_tracks;
create policy "Music is visible to signed-in users" on public.music_tracks for select to authenticated using (true);
create policy "Users upload music metadata" on public.music_tracks for insert to authenticated with check (owner_id = auth.jwt() ->> 'sub');
create policy "Users update their music" on public.music_tracks for update to authenticated using (owner_id = auth.jwt() ->> 'sub') with check (owner_id = auth.jwt() ->> 'sub');
create policy "Users delete their music" on public.music_tracks for delete to authenticated using (owner_id = auth.jwt() ->> 'sub');
insert into storage.buckets (id, name, public) values ('music-media', 'music-media', true) on conflict (id) do update set public = true;
drop policy if exists "Users upload music files" on storage.objects;
drop policy if exists "Users view music files" on storage.objects;
create policy "Users view music files" on storage.objects for select to authenticated using (bucket_id = 'music-media');
create policy "Users upload music files" on storage.objects for insert to authenticated with check (bucket_id = 'music-media' and (storage.foldername(name))[1] = auth.jwt() ->> 'sub');
