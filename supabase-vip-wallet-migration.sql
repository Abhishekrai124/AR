-- Allow a signed-in ARRAI member to pay the annual VIP fee from the shared
-- pay.arrai.in wallet. Apply after the ARRAI Pay wallet tables and
-- supabase-vip-membership-migration.sql.

create or replace function public.arrai_purchase_vip_with_wallet(
  p_user_id uuid,
  p_idempotency_key uuid
)
returns table(
  activated boolean,
  expires_at timestamptz,
  balance_after_paise bigint
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_balance bigint;
  v_reference text;
  v_wallet_transaction_id uuid;
  v_existing_user text;
begin
  if p_user_id is null or p_idempotency_key is null then
    raise exception 'VIP_WALLET_INVALID_REQUEST';
  end if;

  select w.balance_paise into v_balance
  from public.wallet_accounts w
  where w.user_id = p_user_id
  for update;

  if not found then
    raise exception 'WALLET_NOT_FOUND';
  end if;

  select m.user_id into v_existing_user
  from public.vip_membership_payments m
  where m.wallet_idempotency_key = p_idempotency_key;

  if found then
    if v_existing_user is distinct from p_user_id::text then
      raise exception 'VIP_WALLET_IDEMPOTENCY_CONFLICT';
    end if;
    return query
      select false, p.vip_expires_at, v_balance
      from public.profiles p
      where p.id = p_user_id::text;
    return;
  end if;

  if v_balance < 4500 then
    raise exception 'WALLET_INSUFFICIENT';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = p_user_id::text
      and p.account_status = 'active'
  ) then
    raise exception 'VIP_PROFILE_NOT_FOUND';
  end if;

  v_reference := 'arrai_vip_membership:' || p_idempotency_key::text;

  update public.wallet_accounts w
  set balance_paise = w.balance_paise - 4500,
      updated_at = now()
  where w.user_id = p_user_id
  returning w.balance_paise into v_balance;

  insert into public.wallet_transactions (
    user_id,
    amount_paise,
    transaction_type,
    status,
    provider,
    provider_reference,
    metadata
  ) values (
    p_user_id,
    4500,
    'vip_membership',
    'completed',
    'arrai_vip',
    v_reference,
    jsonb_build_object(
      'product', 'arrai_annual_vip',
      'duration_years', 1,
      'idempotency_key', p_idempotency_key::text
    )
  )
  returning id into v_wallet_transaction_id;

  insert into public.vip_membership_payments (
    user_id,
    amount_paise,
    payment_provider,
    wallet_idempotency_key,
    wallet_transaction_id
  ) values (
    p_user_id::text,
    4500,
    'arrai_wallet',
    p_idempotency_key,
    v_wallet_transaction_id
  );

  update public.profiles p
  set is_vip = true,
      vip_badge = 'purchased',
      gold_tick = true,
      vip_granted_at = now(),
      vip_expires_at =
        greatest(coalesce(p.vip_expires_at, now()), now()) + interval '1 year'
  where p.id = p_user_id::text
  returning p.vip_expires_at into expires_at;

  if not found then
    raise exception 'VIP_PROFILE_NOT_FOUND';
  end if;

  return query select true, expires_at, v_balance;
end;
$$;

revoke all on function public.arrai_purchase_vip_with_wallet(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.arrai_purchase_vip_with_wallet(uuid, uuid)
  to service_role;
