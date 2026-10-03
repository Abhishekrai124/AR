-- Public username routes use this column-limited RPC instead of granting
-- anonymous reads on the full profiles table (which contains private data).
drop policy if exists "Public profiles are visible to everyone" on public.profiles;
create or replace function public.arrai_public_profile(p_username text)
returns table(
  id text,
  username text,
  display_name text,
  bio text,
  avatar_url text,
  is_vip boolean,
  vip_expires_at timestamptz,
  blue_tick boolean,
  gold_tick boolean,
  created_at timestamptz,
  privacy text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.username,
    p.display_name,
    p.bio,
    p.avatar_url,
    p.is_vip,
    p.vip_expires_at,
    p.blue_tick,
    p.gold_tick,
    p.created_at,
    p.privacy
  from public.profiles p
  where p.username = lower(trim(p_username))
    and p.privacy = 'public'
    and p.account_status = 'active'
  limit 1;
$$;
revoke all on function public.arrai_public_profile(text) from public;
grant execute on function public.arrai_public_profile(text) to anon, authenticated;
