# Miss Makima setup

The floating assistant routes ordinary ARRAI.in questions to the browser-local intent and reasoning core in `lib/arrai-core.js`. It reads only the signed-in user's profile, own posts, RLS-visible private messages, and wallet snapshot. Public-feed queries are filtered to public profiles. The core can estimate spending pace, a straight-line month-end balance, and unusually large entries from up to 200 recent ledger records. These are bookkeeping estimates, not verified bank data or financial advice.

## Database

Run `supabase-wallet-migration.sql`, `supabase-ai-memory-migration.sql`, and `supabase-makima-brain-migration.sql` in the Supabase SQL Editor. The wallet and Brain Studio endpoints require `SUPABASE_SERVICE_ROLE_KEY` in Vercel. Never expose that key in browser code. AI memory stores up to 12 user/assistant turns per account; users can clear it from the assistant panel. If the memory migration is not installed, the assistant keeps only an in-memory fallback for the current page lifetime.

## Owner Brain Studio

Open the Brain Studio from Owner Studio after signing into the configured owner account. It stores only phrases explicitly submitted by the owner, hashed 32-feature vectors, co-activation edges, and teach/reinforce/correct episodes. The local feature hasher and SQL Hebbian update are a small inspectable learning graph, not a human brain or a general language model. Mic input is one-shot browser speech recognition and may use the browser vendor's service; it is not always-on or used as authentication.

## Optional live search

Only explicit outside-world questions may use a public source. Wikipedia lookups use the Wikimedia API, and the home page's user-requested local weather uses Open-Meteo; neither requires an API key. Makima can look up weather for a named city. Other live search uses the Gemini-compatible `EXTERNAL_AI_KEY` and `TAVILY_API_KEY` in Vercel. Without those keys, general live search is unavailable. Internal wallet, profile, post, and message questions are not sent to external APIs.

Keep all server keys out of `script.js`, HTML, and public repositories. On Vercel: Project → Settings → Environment Variables → add keys for the required environments → redeploy.

The home page clock uses the browser's local time zone. Weather location is requested only after the visitor presses its button; ask Makima about a named city for a weather lookup.

## Visitor counts and notifications

Run `supabase-visitor-analytics-migration.sql` in the Supabase SQL Editor and set `SUPABASE_SERVICE_ROLE_KEY` in Vercel. Each browser-tab session is counted once per day, so navigating between pages does not inflate the count; the all-time total counts distinct sessions. The browser keeps a random session ID in session storage, and the server stores only its keyed hash for deduplication. No raw IP address, account name, or profile is associated with these counts. The public footer shows the all-time total, and the verified owner can see daily, weekly, monthly, yearly, and all-time totals in Owner Studio. These are browser session estimates, not verified unique people.

The sign-in page loads the enabled OAuth providers from Supabase Auth settings. The current project advertises email and Google, so the page provides password, one-time email link, and Google sign-in. Passkey sign-in and registration are also enabled when the project reports passkeys enabled and the visitor's browser supports WebAuthn. Keep the Supabase JavaScript client at v2.105.0 or newer; passkey support is experimental in Supabase Auth.

Browser notifications are opt-in and require a supported browser and permission. While the site is open, opted-in signed-in users can receive message and new-post notifications. Push delivery while the site is closed is not configured. Music playback state is restored when navigating between pages, but browser autoplay policy may require the visitor to tap Play again.

## Action boundaries

Chat can draft a ledger entry, community post, or direct message, but requires an explicit confirmation click before writing. Ledger entries are bookkeeping only. The site has no regulated payment rail, card controls, or detective case/clue schema, so transfers, card freezes, and case actions are unavailable. The assistant does not store chain-of-thought or act as a financial adviser.

## Private owner studio

`owner.html` lets the verified owner correct public community profile names and bios. The configured owner is `abhishekrai6897@gmail.com`; you may also explicitly set `OWNER_EMAIL` in Vercel. Add `SUPABASE_SERVICE_ROLE_KEY` server-side to activate the studio. Keep the service-role key server-only: never put it in browser code. Owner controls intentionally do not expose private direct messages.
