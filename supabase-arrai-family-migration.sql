-- ARRAI Family verified donation register and opt-in public leaderboard.
-- Apply after supabase-vip-membership-migration.sql.

create table if not exists public.family_donations (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.profiles(id) on delete cascade,
  amount_paise integer not null check (amount_paise between 100 and 10000000),
  payment_provider text not null
    check (payment_provider in ('razorpay', 'direct_upi')),
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'review', 'verified', 'rejected', 'failed')),
  display_public boolean not null default false,
  razorpay_order_id text unique,
  razorpay_payment_id text unique,
  upi_reference text,
  created_at timestamptz not null default now(),
  utr_submitted_at timestamptz,
  verified_at timestamptz,
  constraint family_donations_payment_reference check (
    (payment_provider = 'razorpay' and upi_reference is null)
    or
    (payment_provider = 'direct_upi' and razorpay_order_id is null and razorpay_payment_id is null)
  )
);

create unique index if not exists family_donations_upi_reference_unique
  on public.family_donations (upi_reference)
  where upi_reference is not null;
create index if not exists family_donations_public_leaderboard_idx
  on public.family_donations (payment_status, display_public, user_id)
  where payment_status = 'verified' and display_public;
create index if not exists family_donations_pending_review_idx
  on public.family_donations (created_at)
  where payment_status = 'review';

alter table public.family_donations enable row level security;
revoke all on public.family_donations from public, anon, authenticated;
grant all on public.family_donations to service_role;

create or replace function public.arrai_family_leaderboard()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with public_donors as (
    select
      p.display_name,
      p.avatar_url,
      sum(d.amount_paise)::bigint as amount_paise
    from public.family_donations d
    join public.profiles p on p.id = d.user_id
    where d.payment_status = 'verified'
      and d.display_public
      and p.account_status = 'active'
    group by p.id, p.display_name, p.avatar_url
    order by sum(d.amount_paise) desc, min(d.verified_at) asc
    limit 25
  ),
  totals as (
    select
      coalesce(sum(amount_paise), 0)::bigint as amount_paise,
      count(*)::integer as donation_count
    from public.family_donations
    where payment_status = 'verified'
  )
  select jsonb_build_object(
    'total_donated_paise', totals.amount_paise,
    'verified_donations', totals.donation_count,
    'top_donors', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'display_name', coalesce(nullif(public_donors.display_name, ''), 'ARRAI supporter'),
            'avatar_url', public_donors.avatar_url,
            'amount_paise', public_donors.amount_paise
          )
          order by public_donors.amount_paise desc
        )
        from public_donors
      ),
      '[]'::jsonb
    )
  )
  from totals;
$$;
revoke all on function public.arrai_family_leaderboard() from public;
grant execute on function public.arrai_family_leaderboard() to anon, authenticated;
