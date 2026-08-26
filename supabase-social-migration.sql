-- Run this once in Supabase Dashboard > SQL Editor to add social reactions and comments.
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id text not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);

create table if not exists public.post_reactions (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id text not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.comments enable row level security;
alter table public.post_reactions enable row level security;

create policy "Comments are visible to signed-in users" on public.comments for select to authenticated using (true);
create policy "Users create their own comments" on public.comments for insert to authenticated with check (author_id = auth.jwt() ->> 'sub');
create policy "Users delete their own comments" on public.comments for delete to authenticated using (author_id = auth.jwt() ->> 'sub');
create policy "Reactions are visible to signed-in users" on public.post_reactions for select to authenticated using (true);
create policy "Users add their own reactions" on public.post_reactions for insert to authenticated with check (user_id = auth.jwt() ->> 'sub');
create policy "Users remove their own reactions" on public.post_reactions for delete to authenticated using (user_id = auth.jwt() ->> 'sub');
