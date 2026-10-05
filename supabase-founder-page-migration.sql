-- Run after supabase-schema.sql in Supabase Dashboard > SQL Editor.
-- This singleton JSON document is public to read; only the site owner's
-- authenticated email can change it. Visitor reactions and notes are separate.

create table if not exists public.founder_page_content (
  id text primary key check (id = 'abhishek-rai'),
  content jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.founder_page_content enable row level security;
drop policy if exists "Founder page is public" on public.founder_page_content;
create policy "Founder page is public"
  on public.founder_page_content for select to anon, authenticated
  using (id = 'abhishek-rai');
drop policy if exists "Only Abhishek edits the founder page" on public.founder_page_content;
create policy "Only Abhishek edits the founder page"
  on public.founder_page_content for update to authenticated
  using (id = 'abhishek-rai' and lower(auth.jwt() ->> 'email') = 'abhishekrai6897@gmail.com')
  with check (id = 'abhishek-rai' and lower(auth.jwt() ->> 'email') = 'abhishekrai6897@gmail.com');
grant select on public.founder_page_content to anon, authenticated;
grant update on public.founder_page_content to authenticated;

insert into public.founder_page_content (id, content)
values (
  'abhishek-rai',
  jsonb_build_object(
    'name', 'Abhishek Rai',
    'username', 'abhishekyadav312_',
    'title', 'A little corner of the internet',
    'crown', '♛',
    'bio', 'Building meaningful digital spaces and collecting little moments along the way. ✨',
    'description', 'Founder of ARRAI · Digital creator · Music, ideas, and everyday stories.',
    'avatar_url', '/assets/abhishek-rai.jpg',
    'location', '',
    'links', jsonb_build_object(
      'instagram', 'https://instagram.com/abhishekyadav312_',
      'threads', '',
      'x', 'https://x.com/abhishekrai781',
      'linkedin', 'https://linkedin.com/in/abhishekrai1576',
      'facebook', 'https://facebook.com/iiabhishekrai',
      'github', '',
      'youtube', 'https://youtube.com/@abhishekyadavrai',
      'website', 'https://arrai.in',
      'email', 'abhishekrai6897@gmail.com'
    ),
    'music', jsonb_build_object('title', '', 'artist', '', 'url', ''),
    'stories', '[]'::jsonb,
    'posts', jsonb_build_array(jsonb_build_object(
      'id', 'first-chord',
      'text', 'Finding my own rhythm — one little idea and one chord at a time. 🎸',
      'image_url', '/assets/abhishek-rai.jpg',
      'location', '',
      'music_title', '',
      'music_url', '',
      'created_at', '2026-10-05T00:00:00.000Z'
    ))
  )
)
on conflict (id) do nothing;

create table if not exists public.founder_page_reactions (
  post_id text not null,
  user_id text not null,
  kind text not null check (kind in ('like', 'repost')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id, kind)
);
alter table public.founder_page_reactions enable row level security;
drop policy if exists "Founder page reactions are public" on public.founder_page_reactions;
create policy "Founder page reactions are public"
  on public.founder_page_reactions for select to anon, authenticated
  using (exists (select 1 from public.founder_page_content where id = 'abhishek-rai'));
drop policy if exists "Members add their own founder page reactions" on public.founder_page_reactions;
create policy "Members add their own founder page reactions"
  on public.founder_page_reactions for insert to authenticated
  with check (user_id = auth.jwt() ->> 'sub');
drop policy if exists "Members remove their own founder page reactions" on public.founder_page_reactions;
create policy "Members remove their own founder page reactions"
  on public.founder_page_reactions for delete to authenticated
  using (user_id = auth.jwt() ->> 'sub');
drop policy if exists "Page owner removes reactions" on public.founder_page_reactions;
create policy "Page owner removes reactions"
  on public.founder_page_reactions for delete to authenticated
  using (lower(auth.jwt() ->> 'email') = 'abhishekrai6897@gmail.com');
grant select on public.founder_page_reactions to anon, authenticated;
grant insert, delete on public.founder_page_reactions to authenticated;

create table if not exists public.founder_page_comments (
  id uuid primary key default gen_random_uuid(),
  post_id text not null,
  author_id text not null,
  display_name text not null check (char_length(display_name) between 1 and 80),
  body text not null check (char_length(trim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists founder_page_comments_post_created_idx
  on public.founder_page_comments(post_id, created_at);
alter table public.founder_page_comments enable row level security;
drop policy if exists "Founder page comments are public" on public.founder_page_comments;
create policy "Founder page comments are public"
  on public.founder_page_comments for select to anon, authenticated
  using (exists (select 1 from public.founder_page_content where id = 'abhishek-rai'));
drop policy if exists "Members comment on the founder page" on public.founder_page_comments;
create policy "Members comment on the founder page"
  on public.founder_page_comments for insert to authenticated
  with check (
    author_id = auth.jwt() ->> 'sub'
    and char_length(trim(body)) between 1 and 500
    and exists (select 1 from public.founder_page_content where id = 'abhishek-rai')
  );
drop policy if exists "Members remove their own founder page comments" on public.founder_page_comments;
create policy "Members remove their own founder page comments"
  on public.founder_page_comments for delete to authenticated
  using (author_id = auth.jwt() ->> 'sub');
drop policy if exists "Page owner removes founder page comments" on public.founder_page_comments;
create policy "Page owner removes founder page comments"
  on public.founder_page_comments for delete to authenticated
  using (lower(auth.jwt() ->> 'email') = 'abhishekrai6897@gmail.com');
grant select on public.founder_page_comments to anon, authenticated;
grant insert, delete on public.founder_page_comments to authenticated;
