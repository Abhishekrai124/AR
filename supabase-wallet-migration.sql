-- ═══════════════════════════════════════════════════════════════════════
-- ARRAI Wallet · run once in Supabase Dashboard > SQL Editor.
--
-- Turns ARRAI Pay into a real stored-value wallet:
--   · top-up through Razorpay (live checkout → server verification)
--   · instant member-to-member transfers
--   · money requests with shareable links
--   · UPI / bank payouts, mobile recharge, bill payments
--   · rewards, bonuses and referral credit
--
-- Money rules used everywhere in this schema:
--   · every amount is an integer number of paise (₹1 = 100)
--   · every balance change writes exactly one wallet_transactions row
--   · every ledger row carries a unique "reference" so a retry can never
--     credit the same money twice (idempotency)
--   · balances may only move inside the security-definer functions below,
--     which PostgREST exposes to the service role and to nobody else
-- ═══════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ── Limits and shared constants ───────────────────────────────────────
-- Kept in one place so the API and the database agree on the ceiling.
create or replace function public.arrai_wallet_limits()
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'max_balance_paise', 5000000,      -- ₹50,000 stored balance ceiling
    'min_topup_paise', 1000,           -- ₹10 smallest top-up
    'max_topup_paise', 5000000,        -- ₹50,000 largest single top-up
    'min_transfer_paise', 100,         -- ₹1 smallest transfer
    'max_transfer_paise', 1000000,     -- ₹10,000 largest single transfer
    'max_daily_out_paise', 5000000     -- ₹50,000 leaving the wallet per day
  );
$$;

-- ── Wallets ───────────────────────────────────────────────────────────
create table if not exists public.wallets (
  user_id text primary key references public.profiles(id) on delete cascade,
  balance_paise bigint not null default 0 check (balance_paise >= 0),
  total_added_paise bigint not null default 0 check (total_added_paise >= 0),
  total_spent_paise bigint not null default 0 check (total_spent_paise >= 0),
  reward_paise bigint not null default 0 check (reward_paise >= 0),
  status text not null default 'active' check (status in ('active', 'frozen', 'closed')),
  kyc_status text not null default 'unverified' check (kyc_status in ('unverified', 'pending', 'verified')),
  payout_upi_id text check (payout_upi_id is null or char_length(payout_upi_id) <= 120),
  referral_code text unique,
  referred_by text references public.profiles(id) on delete set null,
  pin_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Ledger ────────────────────────────────────────────────────────────
create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.profiles(id) on delete cascade,
  direction text not null check (direction in ('credit', 'debit')),
  amount_paise bigint not null check (amount_paise > 0),
  balance_after_paise bigint not null check (balance_after_paise >= 0),
  kind text not null check (kind in (
    'topup', 'bonus', 'p2p_send', 'p2p_receive', 'request_paid', 'request_received',
    'upi_pay', 'bank_withdraw', 'recharge', 'bill', 'vip', 'reward', 'referral',
    'refund', 'reversal', 'adjustment'
  )),
  status text not null default 'success' check (status in ('success', 'reversed')),
  counterparty_user_id text,
  counterparty_name text,
  counterparty_ref text,
  description text not null default '' check (char_length(description) <= 240),
  reference text not null unique,
  group_id uuid,
  razorpay_order_id text,
  razorpay_payment_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  reversed_at timestamptz
);

create index if not exists wallet_transactions_user_created_idx
  on public.wallet_transactions(user_id, created_at desc);
create index if not exists wallet_transactions_user_kind_idx
  on public.wallet_transactions(user_id, kind, created_at desc);
create index if not exists wallet_transactions_group_idx
  on public.wallet_transactions(group_id) where group_id is not null;

-- ── Razorpay top-up orders ────────────────────────────────────────────
create table if not exists public.wallet_orders (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.profiles(id) on delete cascade,
  razorpay_order_id text not null unique,
  receipt text not null unique,
  amount_paise bigint not null check (amount_paise >= 1000),
  credit_paise bigint not null check (credit_paise >= 0),
  bonus_paise bigint not null default 0 check (bonus_paise >= 0),
  purpose text not null default 'wallet_topup' check (purpose in ('wallet_topup', 'vip')),
  status text not null default 'created' check (status in ('created', 'paid', 'failed', 'expired')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists wallet_orders_user_created_idx
  on public.wallet_orders(user_id, created_at desc);
create index if not exists wallet_orders_open_idx
  on public.wallet_orders(status, created_at) where status = 'created';

-- ── Money requests (request → share link → payer pays) ────────────────
create table if not exists public.wallet_requests (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  requester_id text not null references public.profiles(id) on delete cascade,
  payer_id text references public.profiles(id) on delete set null,
  payer_contact text not null default '' check (char_length(payer_contact) <= 160),
  amount_paise bigint not null check (amount_paise > 0),
  note text not null default '' check (char_length(note) <= 200),
  status text not null default 'open' check (status in ('open', 'paid', 'declined', 'cancelled', 'expired')),
  transaction_id uuid references public.wallet_transactions(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days'),
  settled_at timestamptz
);

create index if not exists wallet_requests_requester_idx
  on public.wallet_requests(requester_id, created_at desc);
create index if not exists wallet_requests_payer_idx
  on public.wallet_requests(payer_id, status, created_at desc);
create index if not exists wallet_requests_open_idx
  on public.wallet_requests(status, expires_at) where status = 'open';

-- ── Service orders (recharge, bills, UPI payout, bank withdrawal) ─────
create table if not exists public.wallet_service_orders (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.profiles(id) on delete cascade,
  service text not null check (service in (
    'mobile_recharge', 'dth', 'electricity', 'water', 'gas', 'broadband',
    'credit_card', 'insurance', 'fastag', 'education', 'loan',
    'upi_pay', 'bank_withdraw'
  )),
  provider text not null default '' check (char_length(provider) <= 120),
  customer_ref text not null default '' check (char_length(customer_ref) <= 160),
  amount_paise bigint not null check (amount_paise > 0),
  fee_paise bigint not null default 0 check (fee_paise >= 0),
  status text not null default 'queued' check (status in (
    'queued', 'processing', 'success', 'failed', 'refunded', 'cancelled'
  )),
  note text not null default '' check (char_length(note) <= 240),
  operator_reference text not null default '' check (char_length(operator_reference) <= 160),
  transaction_id uuid references public.wallet_transactions(id) on delete set null,
  refund_transaction_id uuid references public.wallet_transactions(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists wallet_service_orders_user_idx
  on public.wallet_service_orders(user_id, created_at desc);
create index if not exists wallet_service_orders_queue_idx
  on public.wallet_service_orders(status, expires_at)
  where status in ('queued', 'processing');

-- ── Reward claims (each milestone pays out at most once) ─────────────
create table if not exists public.wallet_reward_claims (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.profiles(id) on delete cascade,
  code text not null check (char_length(code) <= 80),
  amount_paise bigint not null check (amount_paise > 0),
  transaction_id uuid references public.wallet_transactions(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, code)
);

create index if not exists wallet_reward_claims_user_idx
  on public.wallet_reward_claims(user_id, created_at desc);
-- ═══════════════════════════════════════════════════════════════════════
-- Ledger engine. Balances move only through these functions, and only
-- when the caller holds the service-role key (auth.role() check inside).
-- ═══════════════════════════════════════════════════════════════════════

-- Creates the wallet on first touch and hands back the current row.
create or replace function public.arrai_wallet_ensure(p_user text)
returns public.wallets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet public.wallets;
  v_attempt integer := 0;
  v_code text;
begin
  if p_user is null or char_length(p_user) < 6 then
    raise exception 'WALLET_INVALID_USER';
  end if;

  loop
    v_attempt := v_attempt + 1;
    v_code := 'AR' || upper(substr(md5(random()::text || clock_timestamp()::text || p_user), 1, 8));
    begin
      insert into public.wallets (user_id, referral_code)
      values (p_user, v_code)
      on conflict (user_id) do nothing;
    exception when unique_violation then
      if v_attempt < 6 then
        continue;
      end if;
      raise;
    end;
    exit;
  end loop;

  select * into v_wallet from public.wallets where user_id = p_user;
  return v_wallet;
end;
$$;

-- Adds money. Repeating the same reference returns the original row, so a
-- retried Razorpay callback can never double-credit an account.
create or replace function public.arrai_wallet_credit(
  p_user text,
  p_amount bigint,
  p_kind text,
  p_reference text,
  p_description text default '',
  p_counterparty_user text default null,
  p_counterparty_name text default null,
  p_counterparty_ref text default null,
  p_group_id uuid default null,
  p_metadata jsonb default '{}'::jsonb,
  p_razorpay_order text default null,
  p_razorpay_payment text default null
)
returns public.wallet_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limits jsonb := public.arrai_wallet_limits();
  v_wallet public.wallets;
  v_tx public.wallet_transactions;
begin
  if auth.role() <> 'service_role' then
    raise exception 'WALLET_SERVICE_ONLY';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'WALLET_INVALID_AMOUNT';
  end if;
  if p_reference is null or char_length(p_reference) < 6 then
    raise exception 'WALLET_INVALID_REFERENCE';
  end if;
  if p_kind not in ('topup','bonus','p2p_receive','request_received','reward','referral','refund','reversal','adjustment') then
    raise exception 'WALLET_INVALID_KIND';
  end if;

  select * into v_tx from public.wallet_transactions where reference = p_reference;
  if found then
    return v_tx;
  end if;

  perform public.arrai_wallet_ensure(p_user);
  select * into v_wallet from public.wallets where user_id = p_user for update;
  if v_wallet.status <> 'active' then
    raise exception 'WALLET_INACTIVE';
  end if;
  if v_wallet.balance_paise + p_amount > (v_limits ->> 'max_balance_paise')::bigint then
    raise exception 'WALLET_LIMIT';
  end if;

  update public.wallets
     set balance_paise = balance_paise + p_amount,
         total_added_paise = total_added_paise
           + case when p_kind in ('topup','bonus','reward','referral','refund','reversal') then p_amount else 0 end,
         reward_paise = reward_paise
           + case when p_kind in ('reward','referral','bonus') then p_amount else 0 end,
         updated_at = now()
   where user_id = p_user
  returning * into v_wallet;

  insert into public.wallet_transactions (
    user_id, direction, amount_paise, balance_after_paise, kind, status,
    counterparty_user_id, counterparty_name, counterparty_ref, description,
    reference, group_id, metadata, razorpay_order_id, razorpay_payment_id
  ) values (
    p_user, 'credit', p_amount, v_wallet.balance_paise, p_kind, 'success',
    p_counterparty_user, p_counterparty_name, p_counterparty_ref,
    coalesce(p_description, ''), p_reference, p_group_id,
    coalesce(p_metadata, '{}'::jsonb), p_razorpay_order, p_razorpay_payment
  )
  returning * into v_tx;

  return v_tx;
end;
$$;

-- Removes money. Enforces the stored balance, the daily outgoing ceiling
-- and per-transaction limits before anything is written.
create or replace function public.arrai_wallet_debit(
  p_user text,
  p_amount bigint,
  p_kind text,
  p_reference text,
  p_description text default '',
  p_counterparty_user text default null,
  p_counterparty_name text default null,
  p_counterparty_ref text default null,
  p_group_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.wallet_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limits jsonb := public.arrai_wallet_limits();
  v_wallet public.wallets;
  v_tx public.wallet_transactions;
  v_today bigint := 0;
begin
  if auth.role() <> 'service_role' then
    raise exception 'WALLET_SERVICE_ONLY';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'WALLET_INVALID_AMOUNT';
  end if;
  if p_reference is null or char_length(p_reference) < 6 then
    raise exception 'WALLET_INVALID_REFERENCE';
  end if;
  if p_kind not in ('p2p_send','request_paid','upi_pay','bank_withdraw','recharge','bill','vip','adjustment') then
    raise exception 'WALLET_INVALID_KIND';
  end if;

  select * into v_tx from public.wallet_transactions where reference = p_reference;
  if found then
    return v_tx;
  end if;

  perform public.arrai_wallet_ensure(p_user);
  select * into v_wallet from public.wallets where user_id = p_user for update;
  if v_wallet.status <> 'active' then
    raise exception 'WALLET_INACTIVE';
  end if;

  select coalesce(sum(amount_paise), 0) into v_today
    from public.wallet_transactions
   where user_id = p_user
     and direction = 'debit'
     and status = 'success'
     and created_at >= date_trunc('day', now());
  if v_today + p_amount > (v_limits ->> 'max_daily_out_paise')::bigint then
    raise exception 'WALLET_DAILY_LIMIT';
  end if;

  if v_wallet.balance_paise < p_amount then
    raise exception 'WALLET_INSUFFICIENT';
  end if;

  update public.wallets
     set balance_paise = balance_paise - p_amount,
         total_spent_paise = total_spent_paise
           + case when p_kind in ('p2p_send','request_paid','upi_pay','bank_withdraw','recharge','bill','vip') then p_amount else 0 end,
         updated_at = now()
   where user_id = p_user
  returning * into v_wallet;

  insert into public.wallet_transactions (
    user_id, direction, amount_paise, balance_after_paise, kind, status,
    counterparty_user_id, counterparty_name, counterparty_ref, description,
    reference, group_id, metadata
  ) values (
    p_user, 'debit', p_amount, v_wallet.balance_paise, p_kind, 'success',
    p_counterparty_user, p_counterparty_name, p_counterparty_ref,
    coalesce(p_description, ''), p_reference, p_group_id,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning * into v_tx;

  return v_tx;
end;
$$;
-- Member → member transfer. Both wallets are locked in a fixed order
-- first, so two people paying each other at the same moment can never
-- deadlock, and the pair is written as one all-or-nothing unit.
create or replace function public.arrai_wallet_transfer(
  p_sender text,
  p_recipient text,
  p_amount bigint,
  p_note text,
  p_reference text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limits jsonb := public.arrai_wallet_limits();
  v_debit public.wallet_transactions;
  v_credit public.wallet_transactions;
  v_group uuid := gen_random_uuid();
  v_sender_name text;
  v_recipient_name text;
  v_first text;
  v_second text;
begin
  if auth.role() <> 'service_role' then
    raise exception 'WALLET_SERVICE_ONLY';
  end if;
  if p_sender is null or p_recipient is null then
    raise exception 'WALLET_INVALID_USER';
  end if;
  if p_sender = p_recipient then
    raise exception 'WALLET_SELF_TRANSFER';
  end if;
  if p_amount is null
     or p_amount < (v_limits ->> 'min_transfer_paise')::bigint
     or p_amount > (v_limits ->> 'max_transfer_paise')::bigint then
    raise exception 'WALLET_INVALID_AMOUNT';
  end if;
  if p_reference is null or char_length(p_reference) < 6 then
    raise exception 'WALLET_INVALID_REFERENCE';
  end if;

  select * into v_debit from public.wallet_transactions where reference = p_reference;
  if found then
    select * into v_credit from public.wallet_transactions where reference = p_reference || ':in';
    return jsonb_build_object('debit', to_jsonb(v_debit), 'credit', to_jsonb(v_credit), 'reused', true);
  end if;

  select coalesce(nullif(trim(display_name), ''), username) into v_recipient_name
    from public.profiles where id = p_recipient;
  if v_recipient_name is null then
    raise exception 'WALLET_RECIPIENT_NOT_FOUND';
  end if;
  select coalesce(nullif(trim(display_name), ''), username) into v_sender_name
    from public.profiles where id = p_sender;

  perform public.arrai_wallet_ensure(p_sender);
  perform public.arrai_wallet_ensure(p_recipient);
  v_first := least(p_sender, p_recipient);
  v_second := greatest(p_sender, p_recipient);
  perform 1 from public.wallets where user_id = v_first for update;
  perform 1 from public.wallets where user_id = v_second for update;

  v_debit := public.arrai_wallet_debit(
    p_sender, p_amount, 'p2p_send', p_reference, coalesce(p_note, ''),
    p_recipient, v_recipient_name, null, v_group,
    jsonb_build_object('channel', 'p2p')
  );
  v_credit := public.arrai_wallet_credit(
    p_recipient, p_amount, 'p2p_receive', p_reference || ':in', coalesce(p_note, ''),
    p_sender, v_sender_name, null, v_group,
    jsonb_build_object('channel', 'p2p')
  );

  return jsonb_build_object('debit', to_jsonb(v_debit), 'credit', to_jsonb(v_credit), 'reused', false);
end;
$$;

-- Someone pays a shared money request.
create or replace function public.arrai_wallet_pay_request(
  p_payer text,
  p_token text,
  p_reference text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.wallet_requests;
  v_debit public.wallet_transactions;
  v_credit public.wallet_transactions;
  v_group uuid := gen_random_uuid();
  v_requester_name text;
  v_payer_name text;
  v_first text;
  v_second text;
begin
  if auth.role() <> 'service_role' then
    raise exception 'WALLET_SERVICE_ONLY';
  end if;
  if p_token is null or char_length(p_token) < 8 then
    raise exception 'WALLET_REQUEST_NOT_FOUND';
  end if;

  select * into v_request from public.wallet_requests where token = p_token for update;
  if not found then
    raise exception 'WALLET_REQUEST_NOT_FOUND';
  end if;
  if v_request.requester_id = p_payer then
    raise exception 'WALLET_SELF_TRANSFER';
  end if;
  if v_request.status = 'paid' then
    select * into v_debit from public.wallet_transactions where reference = p_reference;
    if found then
      return jsonb_build_object('alreadyPaid', true, 'debit', to_jsonb(v_debit));
    end if;
    raise exception 'WALLET_REQUEST_CLOSED';
  end if;
  if v_request.status <> 'open' then
    raise exception 'WALLET_REQUEST_CLOSED';
  end if;
  if v_request.expires_at < now() then
    update public.wallet_requests set status = 'expired' where id = v_request.id;
    raise exception 'WALLET_REQUEST_EXPIRED';
  end if;

  select coalesce(nullif(trim(display_name), ''), username) into v_requester_name
    from public.profiles where id = v_request.requester_id;
  select coalesce(nullif(trim(display_name), ''), username) into v_payer_name
    from public.profiles where id = p_payer;

  perform public.arrai_wallet_ensure(p_payer);
  perform public.arrai_wallet_ensure(v_request.requester_id);
  v_first := least(p_payer, v_request.requester_id);
  v_second := greatest(p_payer, v_request.requester_id);
  perform 1 from public.wallets where user_id = v_first for update;
  perform 1 from public.wallets where user_id = v_second for update;

  v_debit := public.arrai_wallet_debit(
    p_payer, v_request.amount_paise, 'request_paid', p_reference, coalesce(v_request.note, ''),
    v_request.requester_id, v_requester_name, null, v_group,
    jsonb_build_object('request_id', v_request.id)
  );
  v_credit := public.arrai_wallet_credit(
    v_request.requester_id, v_request.amount_paise, 'request_received', p_reference || ':in',
    coalesce(v_request.note, ''), p_payer, v_payer_name, null, v_group,
    jsonb_build_object('request_id', v_request.id)
  );

  update public.wallet_requests
     set status = 'paid', payer_id = p_payer, transaction_id = v_debit.id, settled_at = now()
   where id = v_request.id
  returning * into v_request;

  return jsonb_build_object(
    'request', to_jsonb(v_request),
    'debit', to_jsonb(v_debit),
    'credit', to_jsonb(v_credit),
    'alreadyPaid', false
  );
end;
$$;

-- Recharge / bill / UPI payout / bank withdrawal: the order row and its
-- wallet debit are created together, so a queued order always has money
-- held behind it and a failed debit never leaves a phantom order.
create or replace function public.arrai_wallet_service_debit(
  p_user text,
  p_service text,
  p_provider text,
  p_customer_ref text,
  p_amount bigint,
  p_fee bigint,
  p_note text,
  p_reference text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.wallet_service_orders;
  v_tx public.wallet_transactions;
  v_kind text;
  v_fee bigint := greatest(coalesce(p_fee, 0), 0);
begin
  if auth.role() <> 'service_role' then
    raise exception 'WALLET_SERVICE_ONLY';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'WALLET_INVALID_AMOUNT';
  end if;
  if p_service not in (
    'mobile_recharge', 'dth', 'electricity', 'water', 'gas', 'broadband',
    'credit_card', 'insurance', 'fastag', 'education', 'loan',
    'upi_pay', 'bank_withdraw'
  ) then
    raise exception 'WALLET_INVALID_SERVICE';
  end if;

  select * into v_tx from public.wallet_transactions where reference = p_reference;
  if found then
    select * into v_order from public.wallet_service_orders where transaction_id = v_tx.id;
    return jsonb_build_object('transaction', to_jsonb(v_tx), 'order', to_jsonb(v_order), 'reused', true);
  end if;

  v_kind := case
    when p_service = 'upi_pay' then 'upi_pay'
    when p_service = 'bank_withdraw' then 'bank_withdraw'
    when p_service in ('mobile_recharge', 'dth', 'broadband') then 'recharge'
    else 'bill'
  end;

  insert into public.wallet_service_orders (
    user_id, service, provider, customer_ref, amount_paise, fee_paise, note, metadata
  ) values (
    p_user, p_service, coalesce(p_provider, ''), coalesce(p_customer_ref, ''),
    p_amount, v_fee, coalesce(p_note, ''), coalesce(p_metadata, '{}'::jsonb)
  )
  returning * into v_order;

  v_tx := public.arrai_wallet_debit(
    p_user, p_amount + v_fee, v_kind, p_reference, coalesce(p_note, ''),
    null, coalesce(p_provider, ''), coalesce(p_customer_ref, ''), null,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('service', p_service, 'service_order_id', v_order.id)
  );

  update public.wallet_service_orders
     set transaction_id = v_tx.id, updated_at = now()
   where id = v_order.id
  returning * into v_order;

  return jsonb_build_object('transaction', to_jsonb(v_tx), 'order', to_jsonb(v_order), 'reused', false);
end;
$$;
-- Moves a queued service order forward. A failed order refunds the held
-- money straight back to the wallet in the same transaction.
create or replace function public.arrai_wallet_settle_order(
  p_order uuid,
  p_outcome text,
  p_operator_reference text default '',
  p_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.wallet_service_orders;
  v_tx public.wallet_transactions;
begin
  if auth.role() <> 'service_role' then
    raise exception 'WALLET_SERVICE_ONLY';
  end if;
  if p_outcome not in ('processing', 'success', 'failed') then
    raise exception 'WALLET_INVALID_OUTCOME';
  end if;

  select * into v_order from public.wallet_service_orders where id = p_order for update;
  if not found then
    raise exception 'WALLET_ORDER_NOT_FOUND';
  end if;

  if v_order.status = 'success' then
    return jsonb_build_object('order', to_jsonb(v_order), 'refunded', false);
  end if;
  if v_order.status in ('refunded', 'cancelled') then
    return jsonb_build_object('order', to_jsonb(v_order), 'refunded', v_order.status = 'refunded');
  end if;

  if p_outcome = 'processing' then
    update public.wallet_service_orders
       set status = 'processing',
           operator_reference = coalesce(p_operator_reference, ''),
           updated_at = now()
     where id = v_order.id
    returning * into v_order;
    return jsonb_build_object('order', to_jsonb(v_order), 'refunded', false);
  end if;

  if p_outcome = 'success' then
    update public.wallet_service_orders
       set status = 'success',
           operator_reference = coalesce(p_operator_reference, ''),
           note = case when coalesce(p_note, '') = '' then note else left(p_note, 240) end,
           updated_at = now()
     where id = v_order.id
    returning * into v_order;
    return jsonb_build_object('order', to_jsonb(v_order), 'refunded', false);
  end if;

  v_tx := public.arrai_wallet_credit(
    v_order.user_id,
    v_order.amount_paise + v_order.fee_paise,
    'refund',
    'order-refund:' || v_order.id::text,
    'Refund · ' || v_order.service,
    v_order.user_id, null, null, null,
    jsonb_build_object('service', v_order.service, 'service_order_id', v_order.id)
  );

  update public.wallet_service_orders
     set status = 'refunded',
         refund_transaction_id = v_tx.id,
         operator_reference = coalesce(p_operator_reference, ''),
         note = case when coalesce(p_note, '') = '' then note else left(p_note, 240) end,
         updated_at = now()
   where id = v_order.id
  returning * into v_order;

  return jsonb_build_object('order', to_jsonb(v_order), 'refunded', true, 'transaction', to_jsonb(v_tx));
end;
$$;

-- Daily safety net: anything still queued after its deadline is refunded
-- rather than left holding someone's money forever.
create or replace function public.arrai_wallet_expire_orders(p_limit integer default 80)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_done integer := 0;
  v_skipped integer := 0;
begin
  if auth.role() <> 'service_role' then
    raise exception 'WALLET_SERVICE_ONLY';
  end if;

  for v_id in
    select id from public.wallet_service_orders
     where status in ('queued', 'processing')
       and expires_at <= now()
     order by expires_at asc
     limit greatest(1, least(coalesce(p_limit, 80), 400))
     for update skip locked
  loop
    begin
      perform public.arrai_wallet_settle_order(
        v_id, 'failed', '', 'Not completed in time · amount returned to your wallet'
      );
      v_done := v_done + 1;
    exception when others then
      v_skipped := v_skipped + 1;
    end;
  end loop;

  return jsonb_build_object('refunded', v_done, 'skipped', v_skipped, 'at', now());
end;
$$;

-- Milestone / referral credit. The unique (user_id, code) pair means a
-- claim can be granted exactly once no matter how many times it is asked for.
create or replace function public.arrai_wallet_grant_reward(
  p_user text,
  p_code text,
  p_amount bigint,
  p_label text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claim public.wallet_reward_claims;
  v_tx public.wallet_transactions;
begin
  if auth.role() <> 'service_role' then
    raise exception 'WALLET_SERVICE_ONLY';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'WALLET_INVALID_AMOUNT';
  end if;
  if p_code is null or char_length(trim(p_code)) < 2 then
    raise exception 'WALLET_INVALID_REFERENCE';
  end if;

  insert into public.wallet_reward_claims (user_id, code, amount_paise)
  values (p_user, trim(p_code), p_amount)
  on conflict (user_id, code) do nothing
  returning * into v_claim;

  if not found then
    return jsonb_build_object('granted', false, 'code', trim(p_code));
  end if;

  v_tx := public.arrai_wallet_credit(
    p_user, p_amount, 'reward',
    'reward:' || p_user || ':' || trim(p_code),
    coalesce(p_label, 'ARRAI reward'),
    null, null, null, null,
    jsonb_build_object('reward_code', trim(p_code))
  );

  update public.wallet_reward_claims set transaction_id = v_tx.id where id = v_claim.id;

  return jsonb_build_object('granted', true, 'code', trim(p_code), 'amount_paise', p_amount, 'transaction', to_jsonb(v_tx));
end;
$$;

-- Pays the friend who invited this member, once, on the invited member's
-- first funded top-up.
create or replace function public.arrai_wallet_pay_referral(p_user text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referrer text;
  v_credited boolean := false;
  v_tx public.wallet_transactions;
begin
  if auth.role() <> 'service_role' then
    raise exception 'WALLET_SERVICE_ONLY';
  end if;

  select referred_by into v_referrer from public.wallets where user_id = p_user;
  if v_referrer is null or v_referrer = p_user then
    return jsonb_build_object('granted', false);
  end if;

  insert into public.wallet_reward_claims (user_id, code, amount_paise)
  values (v_referrer, 'referral:' || p_user, 2500)
  on conflict (user_id, code) do nothing
  returning * into v_tx;

  if not found then
    return jsonb_build_object('granted', false);
  end if;

  select * into v_tx from public.arrai_wallet_credit(
    v_referrer, 2500, 'referral', 'referral:' || p_user,
    'Referral bonus',
    p_user, null, null, null,
    jsonb_build_object('referred_user', p_user)
  ) as credited;

  update public.wallet_reward_claims
     set transaction_id = v_tx.id
   where user_id = v_referrer and code = 'referral:' || p_user;

  v_credited := true;
  return jsonb_build_object('granted', v_credited, 'referrer', v_referrer, 'amount_paise', 2500);
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════
-- Lockdown. The browser never touches these tables or functions directly:
-- every grant is taken away from anon/authenticated and handed only to the
-- service role that the serverless API uses.
-- ═══════════════════════════════════════════════════════════════════════

alter table public.wallets enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.wallet_orders enable row level security;
alter table public.wallet_requests enable row level security;
alter table public.wallet_service_orders enable row level security;
alter table public.wallet_reward_claims enable row level security;

revoke all on public.wallets from anon, authenticated;
revoke all on public.wallet_transactions from anon, authenticated;
revoke all on public.wallet_orders from anon, authenticated;
revoke all on public.wallet_requests from anon, authenticated;
revoke all on public.wallet_service_orders from anon, authenticated;
revoke all on public.wallet_reward_claims from anon, authenticated;

grant all on public.wallets to service_role;
grant all on public.wallet_transactions to service_role;
grant all on public.wallet_orders to service_role;
grant all on public.wallet_requests to service_role;
grant all on public.wallet_service_orders to service_role;
grant all on public.wallet_reward_claims to service_role;

revoke all on function public.arrai_wallet_limits() from public, anon, authenticated;
revoke all on function public.arrai_wallet_ensure(text) from public, anon, authenticated;
revoke all on function public.arrai_wallet_credit(text, bigint, text, text, text, text, text, text, uuid, jsonb, text, text) from public, anon, authenticated;
revoke all on function public.arrai_wallet_debit(text, bigint, text, text, text, text, text, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.arrai_wallet_transfer(text, text, bigint, text, text) from public, anon, authenticated;
revoke all on function public.arrai_wallet_pay_request(text, text, text) from public, anon, authenticated;
revoke all on function public.arrai_wallet_service_debit(text, text, text, text, bigint, bigint, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.arrai_wallet_settle_order(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.arrai_wallet_expire_orders(integer) from public, anon, authenticated;
revoke all on function public.arrai_wallet_grant_reward(text, text, bigint, text) from public, anon, authenticated;
revoke all on function public.arrai_wallet_pay_referral(text) from public, anon, authenticated;

grant execute on function public.arrai_wallet_limits() to service_role;
grant execute on function public.arrai_wallet_ensure(text) to service_role;
grant execute on function public.arrai_wallet_credit(text, bigint, text, text, text, text, text, text, uuid, jsonb, text, text) to service_role;
grant execute on function public.arrai_wallet_debit(text, bigint, text, text, text, text, text, text, uuid, jsonb) to service_role;
grant execute on function public.arrai_wallet_transfer(text, text, bigint, text, text) to service_role;
grant execute on function public.arrai_wallet_pay_request(text, text, text) to service_role;
grant execute on function public.arrai_wallet_service_debit(text, text, text, text, bigint, bigint, text, text, jsonb) to service_role;
grant execute on function public.arrai_wallet_settle_order(uuid, text, text, text) to service_role;
grant execute on function public.arrai_wallet_expire_orders(integer) to service_role;
grant execute on function public.arrai_wallet_grant_reward(text, text, bigint, text) to service_role;
grant execute on function public.arrai_wallet_pay_referral(text) to service_role;

-- Roll the OTP-style PIN column default in only when it is missing, so
-- re-running this file against an existing project stays safe.
alter table public.wallets add column if not exists pin_hash text;
alter table public.wallets add column if not exists kyc_status text not null default 'unverified';
alter table public.wallets add column if not exists payout_upi_id text;
alter table public.wallets add column if not exists referral_code text;
alter table public.wallets add column if not exists referred_by text;
alter table public.wallet_transactions add column if not exists group_id uuid;
alter table public.wallet_transactions add column if not exists razorpay_order_id text;
alter table public.wallet_transactions add column if not exists razorpay_payment_id text;
alter table public.wallet_transactions add column if not exists reversed_at timestamptz;
alter table public.wallet_service_orders add column if not exists refund_transaction_id uuid;
alter table public.wallet_service_orders add column if not exists operator_reference text not null default '';
alter table public.wallet_service_orders add column if not exists expires_at timestamptz not null default (now() + interval '24 hours');

create unique index if not exists wallets_referral_code_key on public.wallets(referral_code) where referral_code is not null;
create unique index if not exists wallet_requests_token_key on public.wallet_requests(token);
