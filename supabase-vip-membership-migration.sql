-- Annual ARRAI VIP membership, member location privacy, and public opt-ins.
-- Apply after supabase-vip-safety-migration.sql.

alter table public.profiles
  add column if not exists vip_expires_at timestamptz,
  add column if not exists show_vip_on_home boolean not null default false;

update public.profiles
set vip_expires_at = coalesce(vip_granted_at, created_at, now()) + interval '1 year'
where vip_badge = 'purchased'
  and is_vip
  and vip_expires_at is null;

create or replace function public.protect_vip_home_opt_in()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.show_vip_on_home and (
    not new.is_vip
    or new.vip_badge <> 'purchased'
    or (new.vip_expires_at is not null and new.vip_expires_at <= now())
  ) then
    raise exception 'Only active paid VIP members can be featured on the homepage';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_vip_home_opt_in on public.profiles;
create trigger protect_vip_home_opt_in
  before insert or update of show_vip_on_home, is_vip, vip_badge, vip_expires_at
  on public.profiles
  for each row execute function public.protect_vip_home_opt_in();

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
drop policy if exists "Members manage their own approximate location" on public.profile_locations;
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
  select l.city, l.state, l.country
  from public.profile_locations l
  join public.profiles p on p.id = l.profile_id
  where l.profile_id = p_profile_id
    and l.show_on_profile
    and p.privacy = 'public'
    and p.account_status = 'active';
$$;
revoke all on function public.arrai_public_profile_location(text) from public;
grant execute on function public.arrai_public_profile_location(text) to anon, authenticated;

create or replace function public.arrai_featured_vip_members()
returns table(display_name text, username text, avatar_url text)
language sql
stable
security definer
set search_path = public
as $$
  select p.display_name, p.username, p.avatar_url
  from public.profiles p
  where p.is_vip
    and p.vip_badge = 'purchased'
    and p.show_vip_on_home
    and p.account_status = 'active'
    and (p.vip_expires_at is null or p.vip_expires_at > now())
  order by p.vip_granted_at desc nulls last
  limit 12;
$$;
revoke all on function public.arrai_featured_vip_members() from public;
grant execute on function public.arrai_featured_vip_members() to anon, authenticated;

create table if not exists public.vip_membership_payments (
  id uuid primary key default gen_random_uuid(),
  payment_provider text not null default 'razorpay'
    check (payment_provider in ('razorpay', 'arrai_wallet')),
  razorpay_order_id text unique,
  razorpay_payment_id text unique,
  user_id text not null references public.profiles(id) on delete cascade,
  amount_paise integer not null check (amount_paise = 4500),
  wallet_idempotency_key uuid unique,
  wallet_transaction_id uuid,
  created_at timestamptz not null default now()
);
alter table public.vip_membership_payments enable row level security;
revoke all on public.vip_membership_payments from public, anon, authenticated;
grant all on public.vip_membership_payments to service_role;

create or replace function public.arrai_activate_vip_membership(
  p_user_id text,
  p_order_id text,
  p_payment_id text
)
returns table(activated boolean, expires_at timestamptz)
language plpgsql
-- Invoker is intentional: only service_role may call this, allowing the
-- existing identity-protection trigger to verify the trusted role.
set search_path = public
as $$
declare
  v_inserted_order text;
  v_existing_user text;
begin
  if coalesce(p_user_id, '') = ''
     or coalesce(p_order_id, '') = ''
     or coalesce(p_payment_id, '') = '' then
    raise exception 'VIP_PAYMENT_INVALID';
  end if;

  insert into public.vip_membership_payments (
    razorpay_order_id, razorpay_payment_id, user_id, amount_paise
  ) values (p_order_id, p_payment_id, p_user_id, 4500)
  on conflict do nothing
  returning razorpay_order_id into v_inserted_order;

  if v_inserted_order is null then
    select user_id into v_existing_user
    from public.vip_membership_payments
    where razorpay_order_id = p_order_id
       or razorpay_payment_id = p_payment_id
    limit 1;
    if v_existing_user is distinct from p_user_id then
      raise exception 'VIP_PAYMENT_ALREADY_USED';
    end if;
    return query
      select false, p.vip_expires_at
      from public.profiles p
      where p.id = p_user_id;
    return;
  end if;

  update public.profiles p
  set is_vip = true,
      vip_badge = 'purchased',
      gold_tick = true,
      vip_granted_at = now(),
      vip_expires_at = greatest(coalesce(p.vip_expires_at, now()), now()) + interval '1 year'
  where p.id = p_user_id
  returning p.vip_expires_at into expires_at;

  if not found then
    raise exception 'VIP_PROFILE_NOT_FOUND';
  end if;
  return query select true, expires_at;
end;
$$;
revoke all on function public.arrai_activate_vip_membership(text, text, text) from public, anon, authenticated;
grant execute on function public.arrai_activate_vip_membership(text, text, text) to service_role;
