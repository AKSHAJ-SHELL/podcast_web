# Podcast backend

Node.js API for the podcast site: contact form submissions and health check.

## Run

From this directory:

```bash
npm install
npm start
```

Server listens on **http://localhost:3000** (or `PORT` from `.env`).

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check. Returns `{ "ok": true }`. |
| GET | `/metrics` | In-memory counters/timings snapshot for operational visibility. |
| POST | `/api/contact` | Submit contact form. Body: `first_name`, `last_name`, `email`, `subject`, `message`. |
| GET | `/api/admin/submissions` | List stored submissions (`Authorization: Bearer <token>`). |
| GET | `/api/admin/report` | Aggregate reporting (`total`, `last_24h`, `last_7d`). |
| DELETE | `/api/admin/submissions/:id` | Delete one submission by id. |
| POST | `/api/admin/submissions/purge` | Purge old submissions (`older_than_days`). |
| POST | `/api/admin/backup` | Create timestamped SQLite backup copy. |

## Frontend

The same server serves the static frontend. Open:

**http://localhost:3000/The%20podcast%20website%20code.html**

The contact form in that page posts to `/api/contact` on the same origin.

## Environment

Copy `.env.example` to `.env` and adjust if needed:

- `PORT` – Server port (default `3000`).
- `DB_PATH` – SQLite file path (relative paths are resolved from `server/`).
- `DB_BACKUP_DIR` – Backup directory (default `./data/backups`).
- `DATA_RETENTION_DAYS` – Auto-purge cutoff for retention sweeps.
- `RETENTION_SWEEP_INTERVAL_MS` – Retention sweep interval in milliseconds.
- `CORS_ORIGINS` – Allowed origins, comma-separated (default includes `http://localhost:8000` and `http://localhost:3000`).
- `CONTACT_RATE_LIMIT_WINDOW_MS`, `CONTACT_RATE_LIMIT_MAX` – Contact rate limit settings.
- `REDIS_URL` – Redis connection string for distributed rate limiting.
- `CAPTCHA_VERIFY_URL`, `CAPTCHA_SECRET` – Optional; leave empty to skip captcha.
- `SMTP_*`, `CONTACT_NOTIFY_TO` – Mail notification delivery settings.
- `ADMIN_API_TOKEN` – Required to use `/api/admin/*` endpoints.
- `METRICS_*` – Metrics endpoint controls.
- `ALERT_WEBHOOK_URL` – Optional webhook for alert events.

## Data

Contact submissions are stored in SQLite. Schema is managed with versioned SQL migrations in `server/migrations/`.

### Retention and deletion

- Automatic retention sweeps run on `RETENTION_SWEEP_INTERVAL_MS` and delete rows older than `DATA_RETENTION_DAYS`.
- Use `POST /api/admin/submissions/purge` for manual purge.
- Use `DELETE /api/admin/submissions/:id` for per-record deletion.

### Backup workflow

- `POST /api/admin/backup` creates a timestamped SQLite copy in `DB_BACKUP_DIR`.
- Keep backup directory access restricted and rotate old backups by policy.

## Scripts

- `npm start` - start API server
- `npm run migrate` - apply pending database migrations
- `npm test` - run backend test suite
