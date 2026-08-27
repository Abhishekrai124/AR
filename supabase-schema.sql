-- Run this once in Supabase Dashboard > SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id text primary key,
  username text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null check (char_length(display_name) between 1 and 50),
  bio text not null default '' check (char_length(bio) <= 180),
  avatar_url text,
  created_at timestamptz not null default now()
);

-- 👇 BLUE TICK WALA COLUMN YAHAN ADD KIYA HAI (Safe method)
alter table public.profiles add column if not exists blue_tick boolean default false;
-- 👆

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id text not null references public.profiles(id) on delete cascade,
  body text not null default '' check (char_length(body) <= 500),
  image_url text,
  created_at timestamptz not null default now(),
  check (char_length(trim(body)) > 0 or image_url is not null)
);

create table if not exists public.follows (
  follower_id text not null references public.profiles(id) on delete cascade,
  following_id text not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id text not null references public.profiles(id) on delete cascade,
  recipient_id text not null references public.profiles(id) on delete cascade,
  body text not null default '' check (char_length(body) <= 1500),
  media_url text,
  media_type text,
  created_at timestamptz not null default now(),
  check (char_length(trim(body)) > 0 or media_url is not null) 
);

create table if not exists public.call_signals (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null,
  sender_id text not null references public.profiles(id) on delete cascade,
  recipient_id text not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('offer', 'answer', 'candidate', 'hangup')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.follows enable row level security;
alter table public.direct_messages enable row level security;
alter table public.call_signals enable row level security;

create policy "Profiles are visible to signed-in users" on public.profiles for select to authenticated using (true);
create policy "Users create their own profile" on public.profiles for insert to authenticated with check (id = auth.jwt() ->> 'sub');
create policy "Users update their own profile" on public.profiles for update to authenticated using (id = auth.jwt() ->> 'sub') with check (id = auth.jwt() ->> 'sub');

create policy "Posts are visible to signed-in users" on public.posts for select to authenticated using (true);
create policy "Users create their own posts" on public.posts for insert to authenticated with check (author_id = auth.jwt() ->> 'sub');
create policy "Users update their own posts" on public.posts for update to authenticated using (author_id = auth.jwt() ->> 'sub') with check (author_id = auth.jwt() ->> 'sub');
create policy "Users delete their own posts" on public.posts for delete to authenticated using (author_id = auth.jwt() ->> 'sub');

create policy "Follows are visible to signed-in users" on public.follows for select to authenticated using (true);
create policy "Users follow from their own account" on public.follows for insert to authenticated with check (follower_id = auth.jwt() ->> 'sub');
create policy "Users remove their own follows" on public.follows for delete to authenticated using (follower_id = auth.jwt() ->> 'sub');

create policy "Participants read their DMs" on public.direct_messages for select to authenticated using (sender_id = auth.jwt() ->> 'sub' or recipient_id = auth.jwt() ->> 'sub');
create policy "Users send their own DMs" on public.direct_messages for insert to authenticated with check (sender_id = auth.jwt() ->> 'sub');

create policy "Call participants read signals" on public.call_signals for select to authenticated using (sender_id = auth.jwt() ->> 'sub' or recipient_id = auth.jwt() ->> 'sub');
create policy "Users send their own call signals" on public.call_signals for insert to authenticated with check (sender_id = auth.jwt() ->> 'sub');
create policy "Call participants remove signals" on public.call_signals for delete to authenticated using (sender_id = auth.jwt() ->> 'sub' or recipient_id = auth.jwt() ->> 'sub');

insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('post-media', 'post-media', true) on conflict (id) do nothing;

create policy "Signed-in users view public media" on storage.objects for select to authenticated using (bucket_id in ('avatars', 'post-media'));
create policy "Users upload only to their folder" on storage.objects for insert to authenticated with check (bucket_id in ('avatars', 'post-media') and (storage.foldername(name))[1] = auth.jwt() ->> 'sub');
create policy "Users update only their own media" on storage.objects for update to authenticated using (bucket_id in ('avatars', 'post-media') and (storage.foldername(name))[1] = auth.jwt() ->> 'sub');
create policy "Users delete only their own media" on storage.objects for delete to authenticated using (bucket_id in ('avatars', 'post-media') and (storage.foldername(name))[1] = auth.jwt() ->> 'sub');

alter publication supabase_realtime add table public.direct_messages;
alter publication supabase_realtime add table public.call_signals;

create or replace function public.send_media_message(
  media_type text,
  media_url text,
  message_body text,
  recipient text
) returns public.direct_messages as $$
declare
  result public.direct_messages;
begin
  insert into public.direct_messages (sender_id, recipient_id, body, media_type, media_url)
  values (auth.jwt() ->> 'sub', recipient, coalesce(message_body, ''), media_type, media_url)
  returning * into result;
  
  return result;
end;
$$ language plpgsql security invoker;