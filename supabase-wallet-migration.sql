create table if not exists public.wallet_accounts (
  user_id text primary key references public.profiles(id) on delete cascade,
  balance_minor bigint not null default 0 check (balance_minor >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wallet_entries (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.wallet_accounts(user_id) on delete cascade,
  reference_id uuid not null unique default gen_random_uuid(),
  idempotency_key text not null,
  entry_type text not null check (entry_type in ('income', 'expense')),
  amount_minor bigint not null check (amount_minor > 0),
  category text not null check (char_length(category) between 1 and 40),
  description text not null check (char_length(description) between 1 and 100),
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create index if not exists wallet_entries_user_created_idx on public.wallet_entries(user_id, created_at desc);
alter table public.wallet_accounts enable row level security;
alter table public.wallet_entries enable row level security;

create or replace function public.wallet_read_snapshot(p_user_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  account public.wallet_accounts%rowtype;
  entries jsonb;
begin
  insert into public.wallet_accounts(user_id) values (p_user_id) on conflict (user_id) do nothing;
  select * into account from public.wallet_accounts where user_id = p_user_id;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id,
    'reference_id', reference_id,
    'type', entry_type,
    'amount_minor', amount_minor,
    'category', category,
    'description', description,
    'created_at', created_at
  ) order by created_at desc), '[]'::jsonb)
  into entries from (
    select * from public.wallet_entries where user_id = p_user_id order by created_at desc limit 200
  ) recent_entries;
  return jsonb_build_object('balanceMinor', account.balance_minor, 'transactions', entries);
end;
$$;

create or replace function public.wallet_post_entry(
  p_user_id text,
  p_type text,
  p_amount_minor bigint,
  p_description text,
  p_category text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  account public.wallet_accounts%rowtype;
  prior_entry public.wallet_entries%rowtype;
  new_entry public.wallet_entries%rowtype;
begin
  if p_type not in ('income', 'expense') or p_amount_minor <= 0 then
    raise exception 'Invalid ledger entry.' using errcode = '22023';
  end if;
  insert into public.wallet_accounts(user_id) values (p_user_id) on conflict (user_id) do nothing;
  select * into account from public.wallet_accounts where user_id = p_user_id for update;
  select * into prior_entry from public.wallet_entries where user_id = p_user_id and idempotency_key = p_idempotency_key;
  if found then
    return public.wallet_read_snapshot(p_user_id);
  end if;
  if p_type = 'expense' and account.balance_minor < p_amount_minor then
    raise exception 'This expense exceeds the recorded balance.' using errcode = 'P0001';
  end if;
  update public.wallet_accounts
  set balance_minor = balance_minor + case when p_type = 'income' then p_amount_minor else -p_amount_minor end,
      updated_at = now()
  where user_id = p_user_id
  returning * into account;
  insert into public.wallet_entries(user_id, entry_type, amount_minor, description, category, idempotency_key)
  values (p_user_id, p_type, p_amount_minor, trim(p_description), trim(p_category), p_idempotency_key)
  returning * into new_entry;
  return public.wallet_read_snapshot(p_user_id);
end;
$$;

revoke all on public.wallet_accounts, public.wallet_entries from anon, authenticated;
revoke all on function public.wallet_read_snapshot(text) from public, anon, authenticated;
revoke all on function public.wallet_post_entry(text, text, bigint, text, text, text) from public, anon, authenticated;
grant execute on function public.wallet_read_snapshot(text) to service_role;
grant execute on function public.wallet_post_entry(text, text, bigint, text, text, text) to service_role;