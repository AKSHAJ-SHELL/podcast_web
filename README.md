# Professional Perspectives Podcast

Vercel-first static site + serverless API setup for contact submissions.

## Runtime architecture

- Frontend entrypoint: `index.html` (root)
- Serverless API: `api/contact.js`
- Database: Vercel Postgres (Neon) via `DATABASE_URL`
- Email: SMTP via Nodemailer
- Legacy local backend: `server/` (kept temporarily for fallback/local-only use)

## Critical security step first

1. Rotate the SMTP app password currently in your local `server/.env`.
2. Stop treating local `.env` as a secret store of record.
3. Put production credentials only in Vercel Project Environment Variables.

## Required Vercel environment variables

- `DATABASE_URL`
- `CONTACT_RATE_LIMIT_MAX`
- `CONTACT_RATE_LIMIT_WINDOW_MS` (optional, defaults to 900000)
- `CAPTCHA_VERIFY_URL` (optional)
- `CAPTCHA_SECRET` (optional)
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `CONTACT_NOTIFY_TO`
- `CORS_ORIGINS` (include production + preview domains as needed)

Copy `.env.example` for local development shape.

## Database bootstrap (run once)

Run SQL from `sql/contact_submissions.sql` against your Vercel Postgres instance:

```sql
create table if not exists contact_submissions (
  id bigserial primary key,
  first_name text not null check (length(first_name) <= 100),
  last_name text not null check (length(last_name) <= 100),
  email text not null check (length(email) <= 254),
  subject text not null check (length(subject) <= 100),
  message text not null check (length(message) <= 5000),
  created_at timestamptz not null default now()
);
create index if not exists idx_contact_submissions_created_at
  on contact_submissions(created_at desc);
```

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
  "captcha_token": ""
}
```

Success:

```json
{ "ok": true, "id": 1 }
```

## Vercel config

`vercel.json`:

```json
{
  "functions": {
    "api/contact.js": { "maxDuration": 10 }
  }
}
```

## Deploy flow

1. Import repo in Vercel.
2. Add environment variables in Project Settings.
3. Deploy preview, verify, then promote to production.

## Smoke test checklist

- `GET /` serves the page over HTTPS.
- `POST /api/contact` returns `201` for valid payload.
- Row appears in Postgres `contact_submissions`.
- Notification email arrives.
- Honeypot/rate-limit/captcha checks behave correctly.

## Local helper scripts

From repo root:

- `npm run dev` - run Vercel local development server
- `npm run smoke:contact` - send a contact submission smoke request

## Legacy backend note

`server/` is kept temporarily for local fallback and previous SQLite workflows. It is not the Vercel production runtime path.
