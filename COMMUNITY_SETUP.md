# ARRAI Community setup

## Database migration

Back up the Supabase project, then run these migrations in order in the Supabase
SQL editor:

1. `supabase-schema.sql`
2. `supabase-social-migration.sql`
3. `supabase-vip-safety-migration.sql`
4. Optionally, `supabase-public-feed-migration.sql` if enabling the anonymous
   public feed.
5. `supabase-community-platform-migration.sql`
6. `supabase-vip-membership-migration.sql` for annual VIP and opt-in city display.
7. `supabase-public-profile-migration.sql` for safe public username pages.
8. `supabase-vip-wallet-migration.sql` to enable payment from the ARRAI Pay
   wallet.

The Community page expects the last migration to be applied. It is not applied
by deploying the static site, and no live database changes are implied by this
repository update.

Public profile pages use a column-limited RPC so anonymous visitors do not get
direct access to phone numbers, birth dates, or other profile-table columns.
Run the public-profile migration before deploying the new profile page.

## VIP membership configuration

The annual VIP offer is ₹45 for 12 months. Configure these Vercel environment
variables before enabling checkout:

- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET` (a long random secret; Vercel sends it to scheduled functions)

Keep the service-role key and Razorpay secret private. Vercel schedules
`/api/vip-expiry` daily; the endpoint checks the `CRON_SECRET` bearer token and
removes purchased VIP access after the recorded expiry. Membership activation
is server-verified against Razorpay before the database RPC can grant VIP.
Until the migrations and environment variables are configured in the live
services, checkout and location persistence are unavailable.

### Pay with ARRAI Wallet

In Community, click the **VIP membership · ₹45/year** button in the page
header and choose **Pay with ARRAI Wallet**. The page checks the signed-in member's
`wallet_accounts` balance and requires at least ₹45. Payment is a single,
atomic wallet debit: it also writes a `vip_membership` entry to
`wallet_transactions` so the purchase appears in the wallet's activity/history,
then activates VIP for 12 months. No wallet balance is copied or transferred
between sites. ARRAI Community and `pay.arrai.in` must use the same Supabase
project and Auth user for the wallet balance to match. If the balance is short,
use **Add money in ARRAI Pay**, then return to Community and try again. The
Razorpay option remains available as an alternative.

## Connected features

- Public community discovery, creation, joining and leaving.
- Server-checked community roles, text channels, announcement posting rules,
  slow mode and real-time channel messages.
- Latest, following and saved feeds; bookmarks, reposts, replies, editing,
  reporting, block and mute controls.
- Comment/follow notifications and a report queue for ARRAI staff.
- Profile privacy plus server-enforced follow, messaging and block rules.

Private profiles reject new follows until a follow-request and approval flow is
implemented; existing followers retain access.

## Not connected yet

- Private-channel invitations and custom community roles.
- Group chats, end-to-end encryption, group voice and malware scanning.
- Complete poll, event and expiring-story creation/voting/reminder flows.
  Story media cleanup also needs a scheduled provider task.
- ARRAI Pay's wallet and merchant payment features are hosted separately at
  `https://pay.arrai.in/`. VIP can be purchased by an atomic wallet debit or
  separate Razorpay checkout; wallet balances are not copied between sites.
- Approximate profile location is opt-in and uses browser permission. Rounded
  coordinates are sent to OpenStreetMap for city lookup; only city, state and
  country are saved. Exact coordinates and IP-based location are not used.

Existing direct messages and channel messages are not end-to-end encrypted.
Provider-dependent capabilities must remain unavailable until their services,
policies and production setup are implemented and verified.

## Navigation and owner console

The shared three-dot menu links to Home, ARRAI Pay, Search, Community, and the
signed-in user's profile. Search ranks ARRAI pages locally and offers an
optional Google link for web-wide results. The home VIP prompt is dismissible
and limited to once per browser session.

The Admin Console (`/admin`) and Owner Studio are protected by the existing
Supabase owner account and server-side owner/service-role checks. Configure
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and
`OWNER_EMAIL` in the deployment environment. Do not use a static client-side
admin password. The console displays recent wallet/VIP ledger entries and
reports; full member, VIP, role, and site controls remain in Owner Studio.
Browser sessions are origin-scoped, so users may need to sign in on both
`arrai.in` and `pay.arrai.in`, even when both sites use the same Supabase
account and database.
