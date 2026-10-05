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
    'avatar_url', '/assets/abhishek-rai-public.jpeg',
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
      'image_url', '/assets/abhishek-rai-public.jpeg',
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

-- Session-only visitor totals. A random browser session UUID is used instead
-- of network identifiers; IP addresses and precise coordinates are not stored.
create table if not exists public.founder_page_visits (
  session_id uuid not null,
  visit_date date not null default current_date,
  created_at timestamptz not null default now(),
  primary key (session_id, visit_date)
);
alter table public.founder_page_visits enable row level security;

create table if not exists public.founder_page_visitor_cities (
  session_id uuid not null,
  shared_on date not null default current_date,
  city text not null check (char_length(trim(city)) between 2 and 80),
  region text not null check (char_length(trim(region)) between 2 and 80),
  country text not null check (char_length(trim(country)) between 2 and 80),
  primary key (session_id, shared_on),
  foreign key (session_id, shared_on)
    references public.founder_page_visits(session_id, visit_date)
    on delete cascade
);
alter table public.founder_page_visitor_cities enable row level security;

create table if not exists public.founder_page_visit_totals (
  id text primary key check (id = 'public'),
  total_visits bigint not null default 0 check (total_visits >= 0)
);
alter table public.founder_page_visit_totals enable row level security;
insert into public.founder_page_visit_totals (id, total_visits)
values ('public', 0)
on conflict (id) do nothing;
revoke all on public.founder_page_visits, public.founder_page_visitor_cities,
  public.founder_page_visit_totals from public, anon, authenticated;

create or replace function public.arrai_record_site_visit(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_new_visit uuid;
begin
  if p_session_id is null then
    raise exception 'A temporary visitor session is required.';
  end if;
  delete from public.founder_page_visits
  where visit_date < current_date - 30;
  insert into public.founder_page_visits (session_id, visit_date)
  values (p_session_id, current_date)
  on conflict (session_id, visit_date) do nothing
  returning session_id into v_new_visit;
  if v_new_visit is not null then
    update public.founder_page_visit_totals
    set total_visits = total_visits + 1
    where id = 'public';
  end if;
end;
$$;
revoke all on function public.arrai_record_site_visit(uuid) from public;
grant execute on function public.arrai_record_site_visit(uuid) to anon, authenticated;

drop function if exists public.arrai_share_visitor_city(uuid, text, text, text);
create or replace function public.arrai_share_visitor_city(
  p_session_id uuid,
  p_city text,
  p_region text,
  p_country text,
  p_consent boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_session_id is null
    or p_consent is not true
    or char_length(trim(coalesce(p_city, ''))) not between 2 and 80
    or char_length(trim(coalesce(p_region, ''))) not between 2 and 80
    or char_length(trim(coalesce(p_country, ''))) not between 2 and 80
  then
    raise exception 'Enter a city, state or region, and country (2–80 characters each).';
  end if;
  if not exists (
    select 1 from public.founder_page_visits
    where session_id = p_session_id and visit_date = current_date
  ) then
    raise exception 'Open the public page before sharing a city.';
  end if;
  insert into public.founder_page_visitor_cities
    (session_id, shared_on, city, region, country)
  values (
    p_session_id, current_date,
    trim(p_city), trim(p_region), trim(p_country)
  )
  on conflict (session_id, shared_on) do update
    set city = excluded.city, region = excluded.region, country = excluded.country;
end;
$$;
revoke all on function public.arrai_share_visitor_city(uuid, text, text, text, boolean) from public;
grant execute on function public.arrai_share_visitor_city(uuid, text, text, text, boolean) to anon, authenticated;

create or replace function public.arrai_public_visitor_stats()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with city_totals as (
    select
      initcap(lower(city)) as city,
      initcap(lower(region)) as region,
      initcap(lower(country)) as country,
      count(*)::integer as visits
    from public.founder_page_visitor_cities
    where shared_on >= current_date - 30
    group by lower(city), lower(region), lower(country)
    having count(*) >= 3
    order by count(*) desc, country, region, city
    limit 8
  )
  select jsonb_build_object(
    'visits', (select total_visits from public.founder_page_visit_totals where id = 'public'),
    'cities', coalesce(
      (select jsonb_agg(jsonb_build_object(
        'city', city,
        'region', region,
        'country', country,
        'visits', visits
      )) from city_totals),
      '[]'::jsonb
    )
  );
$$;
revoke all on function public.arrai_public_visitor_stats() from public;
grant execute on function public.arrai_public_visitor_stats() to anon, authenticated;
