-- Fixes the profile_locations schema-cache error.
-- Apply in Supabase Dashboard > SQL Editor after supabase-schema.sql and
-- supabase-vip-safety-migration.sql.

create table if not exists public.profile_locations (
  profile_id text primary key references public.profiles(id) on delete cascade,
  city text not null check (char_length(city) between 1 and 100),
  state text not null default '' check (char_length(state) <= 100),
  country text not null check (char_length(country) between 1 and 100),
  show_on_profile boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.profile_locations enable row level security;
revoke all on public.profile_locations from public, anon, authenticated;
grant select, insert, update, delete on public.profile_locations to authenticated;

drop policy if exists "Members manage their own approximate location"
  on public.profile_locations;
create policy "Members manage their own approximate location"
  on public.profile_locations for all to authenticated
  using (profile_id = auth.jwt() ->> 'sub')
  with check (profile_id = auth.jwt() ->> 'sub');

create or replace function public.arrai_public_profile_location(p_profile_id text)
returns table(city text, state text, country text)
language sql
stable
security definer
set search_path = public
as $$
  select location.city, location.state, location.country
  from public.profile_locations as location
  join public.profiles as profile on profile.id = location.profile_id
  where location.profile_id = p_profile_id
    and location.show_on_profile
    and profile.privacy = 'public'
    and profile.account_status = 'active';
$$;

revoke all on function public.arrai_public_profile_location(text) from public;
grant execute on function public.arrai_public_profile_location(text)
  to anon, authenticated;

notify pgrst, 'reload schema';
