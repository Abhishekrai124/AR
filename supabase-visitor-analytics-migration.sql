create table if not exists public.site_visits (
  visitor_hash text not null,
  visit_date date not null,
  user_id text,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  primary key (visitor_hash, visit_date)
);

create index if not exists site_visits_date_idx on public.site_visits (visit_date);
create index if not exists site_visits_user_date_idx on public.site_visits (user_id, visit_date desc);

alter table public.site_visits enable row level security;
revoke all on public.site_visits from anon, authenticated;
grant all on public.site_visits to service_role;

create or replace function public.site_visit_analytics()
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'today', (select count(distinct visitor_hash) from public.site_visits where visit_date = (now() at time zone 'UTC')::date),
    'yesterday', (select count(distinct visitor_hash) from public.site_visits where visit_date = (now() at time zone 'UTC')::date - 1),
    'week', (select count(distinct visitor_hash) from public.site_visits where visit_date >= (now() at time zone 'UTC')::date - 6),
    'month', (select count(distinct visitor_hash) from public.site_visits where visit_date >= date_trunc('month', now() at time zone 'UTC')::date),
    'year', (select count(distinct visitor_hash) from public.site_visits where visit_date >= date_trunc('year', now() at time zone 'UTC')::date),
    'total', (select count(distinct visitor_hash) from public.site_visits),
    'recentUsers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'username', recent.username,
        'display_name', recent.display_name,
        'last_seen', recent.last_seen
      ) order by recent.last_seen desc)
      from (
        select p.username, p.display_name, max(v.last_seen) as last_seen
        from public.site_visits v
        join public.profiles p on p.id = v.user_id
        group by p.id, p.username, p.display_name
        order by max(v.last_seen) desc
        limit 20
      ) recent
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.site_visit_analytics() from public, anon, authenticated;
grant execute on function public.site_visit_analytics() to service_role;

create table if not exists public.site_page_views (
  visit_date date primary key,
  page_views bigint not null default 0 check (page_views >= 0),
  updated_at timestamptz not null default now()
);

alter table public.site_page_views enable row level security;
revoke all on public.site_page_views from anon, authenticated;
grant all on public.site_page_views to service_role;

create or replace function public.site_page_view_counts()
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'today', coalesce(sum(page_views) filter (where visit_date = (now() at time zone 'UTC')::date), 0),
    'yesterday', coalesce(sum(page_views) filter (where visit_date = (now() at time zone 'UTC')::date - 1), 0),
    'week', coalesce(sum(page_views) filter (where visit_date >= (now() at time zone 'UTC')::date - 6), 0),
    'month', coalesce(sum(page_views) filter (where visit_date >= date_trunc('month', now() at time zone 'UTC')::date), 0),
    'year', coalesce(sum(page_views) filter (where visit_date >= date_trunc('year', now() at time zone 'UTC')::date), 0),
    'total', coalesce(sum(page_views), 0)
  )
  from public.site_page_views;
$$;

create or replace function public.record_site_page_view()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  today_utc date := (now() at time zone 'UTC')::date;
begin
  insert into public.site_page_views as current_day(visit_date, page_views)
  values (today_utc, 1)
  on conflict (visit_date) do update
  set page_views = current_day.page_views + 1,
      updated_at = now();
  return public.site_page_view_counts();
end;
$$;

revoke all on function public.site_page_view_counts() from public, anon, authenticated;
revoke all on function public.record_site_page_view() from public, anon, authenticated;
grant execute on function public.site_page_view_counts() to service_role;
grant execute on function public.record_site_page_view() to service_role;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'posts'
  ) then
    alter publication supabase_realtime add table public.posts;
  end if;
end
$$;
