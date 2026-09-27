# Detective System Setup

## 1. Apply the Supabase migration

Run `supabase-detective-migration.sql` once in the Supabase SQL Editor before deploying the new intake or member portal. It creates private application/case tables, a persistent case-number sequence, a service-role-only rate limiter and the private `detective-private` storage bucket. No browser role is granted direct access to case records or application photos.

## 2. Configure Vercel

Set these server-side environment variables in the Vercel project, then redeploy:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only; never put this in HTML, JS or Git)
- `OWNER_EMAIL` (the verified owner account; defaults to the existing Owner Studio address)
- `RESEND_API_KEY` (optional until transactional email is ready)
- `RESEND_FROM_EMAIL` (optional; must be a verified sender in Resend)
- `CRON_SECRET` (a long random value used only by Vercel's daily retention job)

Case records and PDFs can be created without Resend, but automatic email delivery of the seven-day private PDF link remains off until both Resend variables are configured. The applicant still downloads the PDF, and the owner can access the private case record from Owner Studio.

Quick inquiries are separate from private cases: an inquiry stores only name, email, topic and a short message, then notifies `OWNER_EMAIL` when Resend is configured. A private case creates the tracking record, PDF and client portal entry, and also sends a new-case notification to `OWNER_EMAIL` at the same time.

## 3. Review applications and cases

Open `/owner.html` with the verified owner account. Detective applications remain pending until approved there. Approval issues a random member ID; it is displayed once, and emailed only if Resend is configured. The owner can reissue a lost ID. A member must sign in with email/password and the current member ID. Members see only cases assigned to them; the owner sees the full register and controls assignment/status.

The member application collects a profile photo, contact/location, languages, experience, selected specialties and optional training/license details. It does not request identity-document scans. Member IDs and case numbers are generated server-side; case numbers are immutable. PDF documents are stored in private storage, not public URLs.

Professional case applicants (for example lawyers, police, public authorities and organizations) provide an organization, role, authorization confirmation, and a licence/service/registration reference. It is explicitly an owner-review workflow, not an automatic government or bar-registry identity verification claim. General enquiries remain available without professional credentials.

## 4. Retention / Burn Rule

`vercel.json` schedules `/api/detective-retention` once daily. After an owner closes a case, the selected 7- or 14-day period is counted from that close time. The job deletes private PDFs, uploaded evidence, invoices and timeline entries, scrubs the stored case fields, and leaves only the case number plus the required purge notice visible to the verified client. Set `CRON_SECRET` before deployment; without it the scheduled job intentionally refuses requests.

## 5. Legal and operational review

The downloaded document is a preliminary intake acknowledgement, not a final binding contract or legal advice. Have qualified counsel approve service scope, pricing, cancellation, privacy/retention and signature terms before using it as a service agreement. Do not advertise a specialty as available unless the agency has the lawful authority, qualifications, tools and coverage to perform it.

The public place lookup sends only an explicitly approved place search to Photon/OpenStreetMap. Map and police-station results are not official or guaranteed complete; verify with the relevant authority.

Opening files directly with `file://` does not provide the `/api` endpoints. Deploy to Vercel or use the Vercel development server with the required environment variables to test case submission, private storage and email delivery end to end.

The production workflow is not active until the migration and server environment are configured.
