-- Run once in Supabase SQL Editor. Gives comments timestamps, editing, and post-owner moderation.
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id text not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.comments add column if not exists updated_at timestamptz not null default now();
alter table public.comments enable row level security;

drop policy if exists "Comments are visible to signed-in users" on public.comments;
drop policy if exists "Users create comments" on public.comments;
drop policy if exists "Authors edit their own comments" on public.comments;
drop policy if exists "Authors or post owners remove comments" on public.comments;

create policy "Comments are visible to signed-in users" on public.comments
  for select to authenticated using (true);
create policy "Users create comments" on public.comments
  for insert to authenticated with check (author_id = auth.jwt() ->> 'sub');
create policy "Authors edit their own comments" on public.comments
  for update to authenticated using (author_id = auth.jwt() ->> 'sub') with check (author_id = auth.jwt() ->> 'sub');
create policy "Authors or post owners remove comments" on public.comments
  for delete to authenticated using (
    author_id = auth.jwt() ->> 'sub'
    or exists (select 1 from public.posts where posts.id = comments.post_id and posts.author_id = auth.jwt() ->> 'sub')
  );
