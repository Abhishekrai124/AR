# ARRAI Pay wallet setup

ARRAI Pay currently runs in **demo mode**. It supports test top-ups, member-to-member
ledger transfers, money requests, QR/share links and transaction history. Demo
balances have no cash value. UPI/bank payouts, bill payments and recharges are
intentionally disabled; do not accept or represent demo balances as real money.

## Supabase

1. Apply `supabase-schema.sql` to the ARRAI Supabase project if it has not already
   been applied.
2. Run `supabase-wallet-migration.sql` in that same project. Wallet rows depend on
   the existing `profiles` table.
3. Keep the existing `supabase.js` project URL and public key pointed at this
   project. The website and `pay.arrai.in` will then use the same Supabase user
   accounts and wallet ledger. Users may need to sign in once on each hostname
   because browser sessions are stored per origin.
4. Add `https://pay.arrai.in/auth.html` to the Supabase Authentication redirect
   URL allowlist so email confirmation and Google sign-in can return to ARRAI Pay.

## Vercel environment

Set these server-side environment variables and redeploy:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — secret; never expose it in browser code
- `ARRAI_WALLET_MODE=demo`
- `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` — Razorpay **test** credentials
  only (`RAZORPAY_KEY_ID` must start with `rzp_test_`)

The wallet API refuses live Razorpay keys and refuses wallet movement unless
`ARRAI_WALLET_MODE=demo`. Keep test and production credentials separate. The
existing direct merchant checkout and VIP purchase are separate from the demo
wallet ledger.

## `pay.arrai.in` hostname

The Vercel rewrite sends requests for `/` on `pay.arrai.in` to `payments.html`.
Add `pay.arrai.in` as a domain on the same Vercel project, then point its DNS
record to Vercel using the values Vercel provides. The hostname cannot become
active until that external DNS/domain step is complete.

## Before any live wallet launch

Do not switch the demo ledger to live balances by changing an environment
variable. Real stored-value funding, transfers, UPI/bank payouts, recharge and
biller payments need a provider-approved production integration, KYC and
applicable legal/compliance review. Implement and review those rails separately
before enabling real-money movement.
