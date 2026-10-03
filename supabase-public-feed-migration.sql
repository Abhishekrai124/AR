-- Allow the home page to show public community updates without exposing private profiles.
alter table public.profiles add column if not exists privacy text not null default 'public';
-- Keep profile columns private; public profiles are served by a restricted RPC.
drop policy if exists "Public profiles are visible to everyone" on public.profiles;
drop policy if exists "Public posts are visible to everyone" on public.posts;
create policy "Public posts are visible to everyone" on public.posts for select to anon using (exists (select 1 from public.profiles p where p.id = posts.author_id and p.privacy = 'public'));
