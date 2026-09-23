# AR Support AI setup

The floating AR Support assistant works immediately with offline website guidance. For free/open-weight AI answers, add one or more of these Vercel environment variables before deploying:

- `GROQ_API_KEY` — free developer key for fast Llama models. Recommended first provider.
- `CEREBRAS_API_KEY` — free developer key for fast open Llama models.
- `OPENROUTER_API_KEY` — free key; defaults to `meta-llama/llama-3.3-70b-instruct:free`.
- `HUGGINGFACE_API_KEY` — free Hugging Face token for open models.
- `GEMINI_API_KEY` — optional non-open fallback from Google AI Studio.
- `TAVILY_API_KEY` — optional live web research. Tavily's free plan currently includes 1,000 monthly API credits.

The server tries configured open-source providers in this order: Groq, Cerebras, OpenRouter, Hugging Face, then Gemini. If one provider is rate-limited or unavailable, the next one is tried automatically. Use `GROQ_MODEL`, `CEREBRAS_MODEL`, `OPENROUTER_MODEL`, or `HUGGINGFACE_MODEL` to select another compatible model.

Never place keys in `script.js`, HTML, or a public Git repository. They are read only on the server by `api/assistant.js`.

On Vercel: Project → Settings → Environment Variables → add the keys for Production, Preview, and Development → redeploy.

## Private owner contact details

The public Contact page only exposes business email addresses. The verified Owner Studio can show private owner contact details after login. Add these server-only Vercel variables if you want the two personal mobile numbers available there:

- `OWNER_PRIVATE_EMAIL` = `abhishekrai6897@gmail.com`
- `OWNER_PRIVATE_PHONE_PRIMARY` = `7814516897`
- `OWNER_PRIVATE_PHONE_SECONDARY` = `7009446821`

Do not put personal phone numbers or passwords in HTML, browser JavaScript, SQL, or Git. Passwords are handled only by Supabase Auth.

The optional Tavily key lets the assistant fetch a small set of current public web sources before Gemini writes its answer. This does not grant access to private accounts or the entire internet, and results should still be checked for important decisions.

## Private owner studio

`owner.html` lets the verified owner correct public community profile names and bios. The configured owner is `abhishekrai6897@gmail.com`; you may also explicitly set `OWNER_EMAIL` in Vercel. Add `SUPABASE_SERVICE_ROLE_KEY` server-side to activate the studio. Keep the service-role key server-only: never put it in browser code. Owner controls intentionally do not expose private direct messages.
