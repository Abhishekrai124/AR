# Miss Makima setup

The floating assistant routes ordinary ARRAI.in questions to the browser-local intent and reasoning core in `lib/arrai-core.js`. It reads only the signed-in user's profile, own posts, RLS-visible private messages, and wallet snapshot. Public-feed queries are filtered to public profiles. The core can estimate spending pace, a straight-line month-end balance, and unusually large entries from up to 200 recent ledger records. These are bookkeeping estimates, not verified bank data or financial advice.

## Database

Run `supabase-wallet-migration.sql`, `supabase-ai-memory-migration.sql`, and `supabase-makima-brain-migration.sql` in the Supabase SQL Editor. The wallet and Brain Studio endpoints require `SUPABASE_SERVICE_ROLE_KEY` in Vercel. Never expose that key in browser code. AI memory stores up to 12 user/assistant turns per account; users can clear it from the assistant panel. If the memory migration is not installed, the assistant keeps only an in-memory fallback for the current page lifetime.

## Owner Brain Studio

Open the Brain Studio from Owner Studio after signing into the configured owner account. It stores only phrases explicitly submitted by the owner, hashed 32-feature vectors, co-activation edges, and teach/reinforce/correct episodes. The local feature hasher and SQL Hebbian update are a small inspectable learning graph, not a human brain or a general language model. Mic input is one-shot browser speech recognition and may use the browser vendor's service; it is not always-on or used as authentication.

## Optional live search

Only explicit outside-world questions (for example, current weather or today's news) may use the external bridge. Add `EXTERNAL_AI_KEY` (Gemini-compatible) and `TAVILY_API_KEY` in Vercel to enable it. Without both keys, the assistant stays local and explains that live search is unavailable. Internal wallet, profile, post, and message questions are not sent to the external bridge.

Keep all server keys out of `script.js`, HTML, and public repositories. On Vercel: Project → Settings → Environment Variables → add keys for the required environments → redeploy.

## Action boundaries

Chat can draft a ledger entry, community post, or direct message, but requires an explicit confirmation click before writing. Ledger entries are bookkeeping only. The site has no regulated payment rail, card controls, or detective case/clue schema, so transfers, card freezes, and case actions are unavailable. The assistant does not store chain-of-thought or act as a financial adviser.

## Private owner studio

`owner.html` lets the verified owner correct public community profile names and bios. The configured owner is `abhishekrai6897@gmail.com`; you may also explicitly set `OWNER_EMAIL` in Vercel. Add `SUPABASE_SERVICE_ROLE_KEY` server-side to activate the studio. Keep the service-role key server-only: never put it in browser code. Owner controls intentionally do not expose private direct messages.
