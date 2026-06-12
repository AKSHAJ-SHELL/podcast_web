# Professional Perspectives Podcast

Netlify static site + serverless API for contact submissions.

## Runtime architecture

- Frontend: `The podcast website code.html` published as `dist/index.html`, plus `app.js` (all page scripts are external; no inline scripts or handlers)
- Serverless API: `netlify/functions/contact.js` (shared logic in `lib/`)
- Retention sweep: `netlify/functions/retention.js`, scheduled daily via `netlify.toml`
- Database: Neon Postgres via `DATABASE_URL`
- Bot defense: honeypot + durable Postgres-backed rate limiting
- Email: SMTP via Nodemailer (operator notification only, delivered to a Gmail inbox)
- Newsletter: runs separately on Substack; nothing in this codebase reads or writes that list

## Security model

- **Rate limiting**: fixed-window counter in Postgres (`contact_rate_limits`), keyed on an HMAC-SHA256 of the client IP using the `RATE_LIMIT_PEPPER` secret (a plain hash of an IPv4 is enumerable; the pepper makes stored keys useless without the secret). IP comes from Netlify's `x-nf-client-connection-ip` header only; `x-forwarded-for` is never trusted. Limiter failure fails closed (503).
- **Config fail-fast**: production throws at module load if `DATABASE_URL`, `RATE_LIMIT_PEPPER`, SMTP settings, or `CONTACT_NOTIFY_TO` are missing.
- **CSP**: `script-src 'self'` with **no** `'unsafe-inline'` -- all scripts live in `app.js`, all event handlers are delegated, no inline `on*` attributes. `style-src` keeps `'unsafe-inline'` for the page's inline styles (styles cannot execute or exfiltrate). Full header set in `netlify.toml`.
- **Header injection**: user-controlled values placed in mail headers are control-character-stripped in `lib/mailer.js`, independent of Nodemailer's own encoding.
- **PII hygiene**: responses return `{ ok: true }` with no row id; logs carry error class/code only (never raw driver messages, which can echo submitted data), no email addresses, no raw IPs.
- **CSRF**: deliberately not implemented -- cookieless JSON API, no ambient credential.

## Privacy and compliance

- Policy is the `Privacy` page in the site footer (version `2026-06-12`): controller identity + contact, legal bases, named US subprocessors (Netlify, Neon, Google), international-transfer notice, Substack newsletter disclosure, honest retention (DB purge + inbox copy + backup caveat), verification method, EU complaint right, DNT, Shine the Light.
- Consent: required checkbox; each row stores `consented_at` and `consent_version` (= the policy version in `lib/config.js`). **Bump `privacyPolicyVersion` whenever the policy text changes materially.**
- Retention: rows purged after `CONTACT_RETENTION_DAYS` (default 90) by the daily scheduled function; stale rate-limit rows purged in the same sweep.

### DSAR runbook (access / correction / deletion)

The policy promises all three rights with a 30-day response target. Every request follows the same shape; only step 3 differs.

1. **Verify**: the request must arrive at `professionalperspectivespr@gmail.com` **from the same email address as the stored submission**. If it concerns another person's data or comes from a different address, reply explaining verification failed and stop. Do not "helpfully" act on unverified requests.
2. **Locate**: `select id, first_name, last_name, subject, message, consented_at, consent_version, created_at from contact_submissions where email = '<address>';` against Neon, plus a Gmail search for the address in the **notification inbox** (`CONTACT_NOTIFY_TO`, currently `shandilya.akshaj@gmail.com` -- note this is NOT the inbox where requests arrive) to find the notification copies.
3. **Fulfill**:
   - *Access*: reply with the row contents from step 2 (their own data only).
   - *Correction*: `update contact_submissions set <field> = '<corrected>' where email = '<address>';` -- the inbox copy stays as-received; note the correction in your reply.
   - *Deletion*: `delete from contact_submissions where email = '<address>';` then delete the notification email(s) from the `CONTACT_NOTIFY_TO` inbox **including from Trash**. Both stores, always -- the policy says a deletion request covers both.
4. **Confirm**: reply stating what was done and the date. Keep the request/confirmation thread (it contains no more PII than the requester already sent, and it is your evidence of compliance).

Notes: Neon backups age out on their own (disclosed in the policy); function logs contain no PII, so there is nothing to scrub there.

### Operational privacy notes

- **Netlify function logs** are a transient PII-adjacent store. Do not attach log drains without checking the drain's retention; the functions deliberately log no PII, but treat drains as in-scope for any future audit.
- **DPAs**: verify data-processing agreements/terms with Neon and Google (Workspace/Gmail) cover processor use. Netlify publishes a standard DPA.
- **Host inboxes**: every notification email is a PII copy. They are delivered to exactly one inbox -- `CONTACT_NOTIFY_TO` (currently `shandilya.akshaj@gmail.com`, a personal account; DSAR requests arrive at `professionalperspectivespr@gmail.com`, so fulfillment requires access to BOTH). Do not forward submissions onward or add recipients, or deletion requests become unfulfillable. If the notification inbox ever changes, update the DSAR runbook above and scrub the old inbox first.

### CAN-SPAM precondition (read before ever emailing submitters)

Contact-form addresses are **not** the newsletter: consent covers storage-to-respond only. The Substack list is opt-in on Substack's side with its own unsubscribe handling. Never import contact-form addresses into Substack or any other sender -- that requires separate provable marketing opt-in, a working unsubscribe, and a physical postal address in every message.

## Required Netlify environment variables

- `DATABASE_URL`
- `RATE_LIMIT_PEPPER` (random secret, e.g. `openssl rand -hex 32`; limiter fails closed without it)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`
- `CONTACT_NOTIFY_TO`
- `CORS_ORIGINS` (production + preview domains)
- `CONTACT_RATE_LIMIT_MAX` (optional, default 10)
- `CONTACT_RATE_LIMIT_WINDOW_MS` (optional, default 900000)
- `CONTACT_RETENTION_DAYS` (optional, default 90)

Copy `.env.example` for the local development shape.

## Database bootstrap (run once)

Run `sql/contact_submissions.sql` against Neon. Idempotent; creates `contact_submissions` (with `consented_at`, `consent_version`), the `created_at` index, and `contact_rate_limits`, and includes upgrade `alter table` statements for existing databases.

### Follow-up: least-privilege role

`DATABASE_URL` should use a dedicated Neon role with INSERT/DELETE/SELECT on the two tables only - not the owner role. Create it in the Neon console and swap the connection string.

## API contract

`POST /api/contact` accepts:

```json
{
  "first_name": "Akshaj",
  "last_name": "Shandilya",
  "email": "name@example.com",
  "subject": "Guest Suggestion",
  "message": "Hi there!",
  "website": "",
  "consent": true
}
```

Success: `201` with `{ "ok": true }`. No identifiers are returned.

## Deploy flow

1. Import the repo in Netlify (`netlify.toml` is picked up automatically).
2. Add the environment variables in Site configuration -> Environment variables (including `RATE_LIMIT_PEPPER`).
3. Run the SQL bootstrap against Neon.
4. Deploy a preview, verify, then publish to production.

## Smoke test checklist

- `GET /` serves the page; CSP header has no `'unsafe-inline'` in `script-src`; nav, episode filters, and search work (they're delegated from `app.js` now).
- `POST /api/contact` returns `201` for a valid payload (with consent).
- Submissions without consent return `400`.
- Row appears in `contact_submissions` with `consented_at` and `consent_version` set.
- Notification email arrives; a mail-failure log line contains no email address and no raw error message.
- Rate limit returns `429` after `CONTACT_RATE_LIMIT_MAX` submissions in the window.
- The `Email Us` / contact links open a real `mailto:` (no `/cdn-cgi/` artifacts).

## Local development

- `npm run dev` - Netlify dev server (requires `netlify-cli`; set `RATE_LIMIT_PEPPER` locally or every submit 503s)
- `npm test` - run the function test suite
- `npm run smoke:contact` - send a smoke request (defaults to `http://localhost:8888/api/contact`)
