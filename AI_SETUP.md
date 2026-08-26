# AR Support AI setup

The floating AR Support assistant works immediately with offline website guidance. For real AI answers, add these Vercel environment variables before deploying:

- `GEMINI_API_KEY` — create a key in Google AI Studio. Gemini has a free tier with usage limits.
- `TAVILY_API_KEY` — optional live web research. Tavily's free plan currently includes 1,000 monthly API credits.

Never place either key in `script.js`, HTML, or a public Git repository. They are read only on the server by `api/assistant.js`.

On Vercel: Project → Settings → Environment Variables → add the keys for Production, Preview, and Development → redeploy.

The optional Tavily key lets the assistant fetch a small set of current public web sources before Gemini writes its answer. This does not grant access to private accounts or the entire internet, and results should still be checked for important decisions.

## Private owner studio

`owner.html` lets the verified owner correct public community profile names and bios. In Vercel, add `OWNER_EMAIL` (the owner’s sign-in email) and `SUPABASE_SERVICE_ROLE_KEY`. Keep the service-role key server-only: never put it in browser code. Owner controls intentionally do not expose private direct messages.
